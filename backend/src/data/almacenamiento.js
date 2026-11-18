/**
 * almacenamiento.js
 * Capa de persistencia sobre archivo JSON para ParkControl.
 *
 * Coordina la lectura/escritura del archivo datosDemo.json y orquesta
 * las reglas de negocio puras importadas desde el core.
 * Es la única capa que toca el sistema de archivos del servidor.
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

import { normalizarPlaca }              from '../utils/normalizador.js';
import {
  validarCompatibilidadCajon,
  calcularTarifa,
}                                       from '../core/reglasNegocio.js';

// ---------------------------------------------------------------------------
// Ruta absoluta al archivo de datos
// ---------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const RUTA_DATOS = join(__dirname, 'datosDemo.json');

// ---------------------------------------------------------------------------
// Helpers de I/O
// ---------------------------------------------------------------------------

/** Lee y parsea el archivo JSON completo. */
async function leerDatos() {
  const raw = await readFile(RUTA_DATOS, 'utf-8');
  return JSON.parse(raw);
}

/** Serializa y escribe el objeto completo en el archivo JSON. */
async function guardarDatos(datos) {
  await writeFile(RUTA_DATOS, JSON.stringify(datos, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Generador de tokens de autofacturación (RN-09)
// ---------------------------------------------------------------------------
function generarTokenAutofacturacion() {
  const ahora = new Date();
  const mes   = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  return `AF-${randomUUID().split('-')[0].toUpperCase()}-${mes}`;
}

// ---------------------------------------------------------------------------
// API Pública del módulo
// ---------------------------------------------------------------------------

/**
 * Retorna pisos y cajones con sus estados actuales, agrupados.
 * @returns {Promise<{ pisos: Array, cajones: Array }>}
 */
export async function obtenerEstadoMatriz() {
  const { pisos, cajones } = await leerDatos();
  return { pisos, cajones };
}

/**
 * Busca una estancia en estado ACTIVA para la placa dada (normalizada).
 * @param {string} placa
 * @returns {Promise<object|null>}
 */
export async function buscarEstanciaActivaPorPlaca(placa) {
  const placaNorm    = normalizarPlaca(placa);
  const { estancias } = await leerDatos();
  return estancias.find(
    (e) => e.placa === placaNorm && e.estado === 'ACTIVA'
  ) ?? null;
}

/**
 * Registra la entrada de un vehículo al estacionamiento.
 *
 * Validaciones aplicadas:
 *  - Normalización de placa (RN-04)
 *  - Sin estancia activa duplicada (RN-05)
 *  - Compatibilidad de cajón (RN-10 / RN-03)
 *  - Cajón en estado DISPONIBLE (RN-03)
 *
 * @param {{ placa: string, tipoVehiculo: string, cajonId: string }} payload
 * @returns {Promise<object>} Estancia creada.
 */
export async function registrarEntrada({ placa, tipoVehiculo, cajonId, fechaEntradaOverride }) {
  const datos = await leerDatos();

  // 1. Normalizar placa
  const placaNorm = normalizarPlaca(placa);

  // 2. RN-05: sin estancia activa para esa placa
  const estanciaExistente = datos.estancias.find(
    (e) => e.placa === placaNorm && e.estado === 'ACTIVA'
  );
  if (estanciaExistente) {
    const err = new Error(`La placa ${placaNorm} ya tiene una estancia activa (ID: ${estanciaExistente.id})`);
    err.codigoHttp = 409;
    throw err;
  }

  // 3. Buscar cajón
  const cajon = datos.cajones.find((c) => c.id === cajonId);
  if (!cajon) {
    const err = new Error(`El cajón '${cajonId}' no existe`);
    err.codigoHttp = 404;
    throw err;
  }

  // 4. RN-03: cajón disponible
  if (cajon.estado !== 'DISPONIBLE') {
    const err = new Error(`El cajón '${cajonId}' no está disponible (estado: ${cajon.estado})`);
    err.codigoHttp = 409;
    throw err;
  }

  // 5. RN-10 / RN-03: compatibilidad tipo vehículo ↔ categoría cajón
  const compatible = validarCompatibilidadCajon(tipoVehiculo, cajon.categoria);
  if (!compatible) {
    const err = new Error(
      `Incompatibilidad: vehículo '${tipoVehiculo}' no puede asignarse al cajón de categoría '${cajon.categoria}'`
    );
    err.codigoHttp = 422;
    throw err;
  }

  // 6. Crear estancia
  const estanciaId = `EST-${Date.now()}`;
  const fechaEntrada = fechaEntradaOverride
    ? new Date(fechaEntradaOverride).toISOString()
    : new Date().toISOString();

  const nuevaEstancia = {
    id:           estanciaId,
    placa:        placaNorm,
    tipoVehiculo,
    cajonId:      cajon.id,
    codigoCajon:  cajon.codigo,
    pisoId:       cajon.pisoId,
    fechaEntrada,
    fechaSalida:  null,
    estado:       'ACTIVA',
    pagoId:       null,
  };

  // 7. Actualizar cajón
  cajon.estado          = 'OCUPADO';
  cajon.estanciaActivaId = estanciaId;

  // 8. Persistir
  datos.estancias.push(nuevaEstancia);
  await guardarDatos(datos);

  return nuevaEstancia;
}

/**
 * Calcula la cotización de salida sin cerrar la estancia.
 *
 * @param {string} placa
 * @returns {Promise<{ estancia: object, cotizacion: object }>}
 */
export async function consultarSalida(placa) {
  const datos     = await leerDatos();
  const placaNorm = normalizarPlaca(placa);

  const estancia = datos.estancias.find(
    (e) => e.placa === placaNorm && e.estado === 'ACTIVA'
  );
  if (!estancia) {
    const err = new Error(`No se encontró estancia activa para la placa '${placaNorm}'`);
    err.codigoHttp = 404;
    throw err;
  }

  const ahora      = new Date().toISOString();
  const cotizacion = calcularTarifa(
    {
      fechaEntrada:  estancia.fechaEntrada,
      fechaSalida:   ahora,
      tipoVehiculo:  estancia.tipoVehiculo,
    },
    datos.configuracionTarifas
  );

  return { estancia, cotizacion };
}

/**
 * Registra el pago, finaliza la estancia y libera el cajón.
 *
 * @param {{
 *   estanciaId:      string,
 *   metodoPago:      string,
 *   requiereFactura: boolean,
 *   datosFiscales?:  object
 * }} payload
 * @returns {Promise<object>} Pago registrado.
 */
export async function registrarPago({ estanciaId, metodoPago, requiereFactura, datosFiscales }) {
  const datos = await leerDatos();

  // 1. Localizar estancia activa
  const estancia = datos.estancias.find(
    (e) => e.id === estanciaId && e.estado === 'ACTIVA'
  );
  if (!estancia) {
    const err = new Error(`No se encontró estancia activa con ID '${estanciaId}'`);
    err.codigoHttp = 404;
    throw err;
  }

  // 2. Calcular tarifa final al momento del pago
  const fechaSalida = new Date().toISOString();
  const tarifa = calcularTarifa(
    {
      fechaEntrada:  estancia.fechaEntrada,
      fechaSalida,
      tipoVehiculo:  estancia.tipoVehiculo,
    },
    datos.configuracionTarifas
  );

  // 3. Estado de facturación (RN-08)
  const estadoFacturacion = requiereFactura && datosFiscales
    ? 'FACTURADO_INDIVIDUAL'
    : 'PENDIENTE_GLOBAL';

  // 4. Crear registro de pago (RN-07, RN-09)
  const pagoId = `PAG-${Date.now()}`;
  const nuevoPago = {
    id:            pagoId,
    estanciaId,
    placa:         estancia.placa,
    tipoVehiculo:  estancia.tipoVehiculo,
    cajonId:       estancia.cajonId,
    codigoCajon:   estancia.codigoCajon,
    fechaEntrada:  estancia.fechaEntrada,
    fechaSalida,
    tiempoTotalMinutos: tarifa.minutosTotales,
    desgloseTiempo: {
      horasDiurnas:     tarifa.horasDiurnas,
      fraccionesDiurnas: tarifa.fraccionesDiurnas,
      horasNocturnas:   tarifa.horasNocturnas,
    },
    cobro: {
      montoTotal: tarifa.montoTotal,
      subtotal:   tarifa.subtotal,
      iva:        tarifa.iva,
      moneda:     'MXN',
    },
    detallesPago: {
      metodoPago:   metodoPago ?? 'EFECTIVO',
      cajeroId:     null,
    },
    facturacion: {
      requiereFacturaIndividual: !!requiereFactura,
      estadoFacturacion,
      tokenAutofacturacion: generarTokenAutofacturacion(),
      datosFiscales: datosFiscales ?? null,
    },
    creadoEn: fechaSalida,
  };

  // 5. Actualizar estancia → FINALIZADA
  estancia.fechaSalida = fechaSalida;
  estancia.estado      = 'FINALIZADA';
  estancia.pagoId      = pagoId;

  // 6. Liberar cajón → DISPONIBLE (RN-03)
  const cajon = datos.cajones.find((c) => c.id === estancia.cajonId);
  if (cajon) {
    cajon.estado           = 'DISPONIBLE';
    cajon.estanciaActivaId = null;
  }

  // 7. Persistir
  datos.pagos.push(nuevoPago);
  await guardarDatos(datos);

  return nuevoPago;
}

/**
 * Crea un nuevo cajón dinámicamente (RF-11 / RN-10).
 * @param {{ pisoId: string, codigo: string, categoria: string }} payload
 * @returns {Promise<object>} Cajón creado.
 */
export async function crearCajon({ pisoId, codigo, categoria }) {
  const datos = await leerDatos();

  // Verificar que el piso exista
  const piso = datos.pisos.find((p) => p.id === pisoId);
  if (!piso) {
    const err = new Error(`El piso '${pisoId}' no existe`);
    err.codigoHttp = 404;
    throw err;
  }

  // Verificar que el código sea único
  const duplicado = datos.cajones.find((c) => c.codigo === codigo);
  if (duplicado) {
    const err = new Error(`Ya existe un cajón con el código '${codigo}'`);
    err.codigoHttp = 409;
    throw err;
  }

  // Validar categoría
  const categoriasValidas = ['AUTOMOVIL', 'MOTOCICLETA'];
  if (!categoriasValidas.includes(categoria)) {
    const err = new Error(`Categoría inválida '${categoria}'. Valores permitidos: ${categoriasValidas.join(', ')}`);
    err.codigoHttp = 422;
    throw err;
  }

  const nuevoCajon = {
    id:               codigo,  // usar el código como ID legible
    pisoId,
    codigo,
    categoria,
    estado:           'DISPONIBLE',
    estanciaActivaId: null,
  };

  datos.cajones.push(nuevoCajon);
  await guardarDatos(datos);

  return nuevoCajon;
}
