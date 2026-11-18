/**
 * testApi.js
 * Suite de integración para la API REST de ParkControl.
 *
 * Requisito previo: el servidor debe estar corriendo en localhost:3000.
 *   → npm start  (en otra terminal)
 * Ejecución:
 *   → node tests/testApi.js
 */

const BASE = 'http://localhost:3000/api';

// ---------------------------------------------------------------------------
// Runner liviano
// ---------------------------------------------------------------------------
let pasadas = 0;
let fallidas = 0;

async function prueba(nombre, fn) {
  try {
    await fn();
    console.log(`  ✅  PASS  ${nombre}`);
    pasadas++;
  } catch (err) {
    console.error(`  ❌  FAIL  ${nombre}`);
    console.error(`           ${err.message}`);
    fallidas++;
  }
}

function assertEqual(valor, esperado, msg) {
  if (valor !== esperado) {
    throw new Error(msg ?? `Esperado: ${JSON.stringify(esperado)}  Obtenido: ${JSON.stringify(valor)}`);
  }
}

function assertTrue(valor, msg) {
  if (!valor) throw new Error(msg ?? `Se esperaba verdadero, obtuvo: ${valor}`);
}

async function post(ruta, body) {
  const res  = await fetch(`${BASE}${ruta}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function get(ruta) {
  const res = await fetch(`${BASE}${ruta}`);
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// Reiniciar datos antes de las pruebas
// ---------------------------------------------------------------------------
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath }       from 'url';
import { dirname, join }       from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const RUTA_DATOS = join(__dirname, '../src/data/datosDemo.json');

const ESTADO_INICIAL = {
  pisos: [{ id: 'PISO-1', nombre: 'Planta Baja', estado: 'ACTIVO' }],
  cajones: [
    { id: 'A-01', pisoId: 'PISO-1', codigo: 'A-01', categoria: 'AUTOMOVIL',   estado: 'DISPONIBLE', estanciaActivaId: null },
    { id: 'A-02', pisoId: 'PISO-1', codigo: 'A-02', categoria: 'AUTOMOVIL',   estado: 'DISPONIBLE', estanciaActivaId: null },
    { id: 'M-01', pisoId: 'PISO-1', codigo: 'M-01', categoria: 'MOTOCICLETA', estado: 'DISPONIBLE', estanciaActivaId: null },
  ],
  estancias: [],
  pagos: [],
  configuracionTarifas: {
    tarifaBaseHora: 30, cuotaFraccion15: 8,
    inicioDiurno: '06:00', finDiurno: '22:00', tarifaNocturnaFija: 50,
  },
};

async function resetearDatos() {
  await writeFile(RUTA_DATOS, JSON.stringify(ESTADO_INICIAL, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Pruebas
// ---------------------------------------------------------------------------

console.log('\n══════════════════════════════════════════════════');
console.log('  ParkControl – Suite de Integración API (Fase 2)');
console.log('══════════════════════════════════════════════════\n');

await resetearDatos();

// Estado compartido entre pruebas (simula flujo secuencial)
let estanciaId = null;
let estanciaMotoId = null;

// ── P1: Health check ──────────────────────────────────────────────────────
await prueba('P1 – Health check responde ok:true', async () => {
  const { status, body } = await get('/health');
  assertEqual(status, 200);
  assertEqual(body.ok, true);
});

// ── P2: Tablero inicial – todos disponibles ────────────────────────────────
await prueba('P2 – Tablero inicial: 3 cajones disponibles', async () => {
  const { status, body } = await get('/infraestructura/cajones');
  assertEqual(status, 200);
  assertEqual(body.ok, true);
  const piso = body.data[0];
  assertEqual(piso.resumen.disponibles, 3, `Esperaba 3 disponibles, encontró ${piso.resumen.disponibles}`);
  assertEqual(piso.resumen.ocupados,    0);
});

// ── P3: Registrar entrada AUTOMOVIL ────────────────────────────────────────
await prueba('P3 – Entrada AUTOMOVIL en A-01 → estancia ACTIVA', async () => {
  // Inyectamos fechaEntrada 2 horas atrás en franja diurna para garantizar cobro
  const dosHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
  // Si cae en franja nocturna, forzar a las 10:00 de hoy
  const hora = dosHorasAtras.getHours();
  let fechaEntradaOverride;
  if (hora < 6 || hora >= 22) {
    const hoy = new Date();
    hoy.setHours(10, 0, 0, 0);
    fechaEntradaOverride = new Date(hoy.getTime() - 2 * 60 * 60 * 1000).toISOString();
  } else {
    fechaEntradaOverride = dosHorasAtras.toISOString();
  }

  const { status, body } = await post('/estancias/entrada', {
    placa: 'ABC-123', tipoVehiculo: 'AUTOMOVIL', cajonId: 'A-01',
    fechaEntradaOverride,
  });
  assertEqual(status, 201);
  assertEqual(body.ok, true);
  assertEqual(body.data.estado, 'ACTIVA');
  assertEqual(body.data.placa,  'ABC123');   // normalizada
  assertEqual(body.data.cajonId, 'A-01');
  estanciaId = body.data.id;
});

// ── P4: Registrar entrada MOTOCICLETA ──────────────────────────────────────
await prueba('P4 – Entrada MOTOCICLETA en M-01 → estancia ACTIVA', async () => {
  const unHoraAtras = new Date(Date.now() - 60 * 60 * 1000);
  const hora = unHoraAtras.getHours();
  let fechaEntradaOverride;
  if (hora < 6 || hora >= 22) {
    const hoy = new Date();
    hoy.setHours(11, 0, 0, 0);
    fechaEntradaOverride = new Date(hoy.getTime() - 60 * 60 * 1000).toISOString();
  } else {
    fechaEntradaOverride = unHoraAtras.toISOString();
  }

  const { status, body } = await post('/estancias/entrada', {
    placa: 'XYZ 789', tipoVehiculo: 'MOTOCICLETA', cajonId: 'M-01',
    fechaEntradaOverride,
  });
  assertEqual(status, 201);
  assertEqual(body.ok, true);
  assertEqual(body.data.placa, 'XYZ789');
  estanciaMotoId = body.data.id;
});

// ── P5: Tablero tras entradas – 2 ocupados ─────────────────────────────────
await prueba('P5 – Tablero tras 2 entradas: disponibles=1, ocupados=2', async () => {
  const { body } = await get('/infraestructura/cajones');
  const piso = body.data[0];
  assertEqual(piso.resumen.disponibles, 1);
  assertEqual(piso.resumen.ocupados,    2);
});

// ── P6: RN-05 – Placa duplicada → 409 ─────────────────────────────────────
await prueba('P6 – RN-05: placa duplicada → HTTP 409', async () => {
  const { status, body } = await post('/estancias/entrada', {
    placa: 'ABC123', tipoVehiculo: 'AUTOMOVIL', cajonId: 'A-02',
  });
  assertEqual(status, 409);
  assertEqual(body.ok, false);
  assertTrue(body.mensaje.includes('estancia activa'), `Mensaje inesperado: ${body.mensaje}`);
});

// ── P7: RN-10 – Incompatibilidad cajón → 422 ──────────────────────────────
// M-01 está OCUPADO (P4), usamos A-02 (AUTOMOVIL disponible) para probar
// que una MOTOCICLETA no puede entrar en un cajón de categoría AUTOMOVIL.
await prueba('P7 – RN-10: MOTOCICLETA en cajón AUTOMOVIL → HTTP 422', async () => {
  const { status, body } = await post('/estancias/entrada', {
    placa: 'NEW999', tipoVehiculo: 'MOTOCICLETA', cajonId: 'A-02',
  });
  assertEqual(status, 422);
  assertEqual(body.ok, false);
});

// ── P8: Consulta de salida – retorna cotización ────────────────────────────
await prueba('P8 – Consulta salida: cotización con montoTotal > 0', async () => {
  const { status, body } = await get('/estancias/salida/ABC123');
  assertEqual(status, 200);
  assertEqual(body.ok, true);
  assertTrue(body.data.cotizacion.montoTotal >= 30, `Monto debería ser ≥ $30, fue $${body.data.cotizacion.montoTotal}`);
  assertTrue(body.data.cotizacion.subtotal > 0);
  assertTrue(body.data.cotizacion.iva > 0);
  // La estancia sigue ACTIVA (no cerrada por la consulta)
  assertEqual(body.data.estancia.estado, 'ACTIVA');
});

// ── P9: Registrar pago – cierra estancia y libera cajón ───────────────────
await prueba('P9 – Pago EFECTIVO: estancia FINALIZADA + cajón A-01 DISPONIBLE', async () => {
  assertTrue(estanciaId !== null, 'estanciaId no fue capturado en P3');

  const { status, body } = await post('/estancias/pago', {
    estanciaId,
    metodoPago:     'EFECTIVO',
    requiereFactura: false,
  });

  assertEqual(status, 201);
  assertEqual(body.ok, true);

  const pago = body.data;
  assertEqual(pago.facturacion.estadoFacturacion, 'PENDIENTE_GLOBAL');
  assertTrue(pago.cobro.montoTotal >= 30, `montoTotal debe ser ≥ $30`);
  assertTrue(pago.cobro.subtotal > 0);
  assertTrue(pago.cobro.iva > 0);
  assertTrue(typeof pago.facturacion.tokenAutofacturacion === 'string');

  // Verificar IVA: subtotal + iva ≈ montoTotal (tolerancia de redondeo $0.02)
  const diff = Math.abs((pago.cobro.subtotal + pago.cobro.iva) - pago.cobro.montoTotal);
  assertTrue(diff <= 0.02, `Desglose IVA incoherente: ${pago.cobro.subtotal} + ${pago.cobro.iva} ≠ ${pago.cobro.montoTotal}`);
});

// ── P10: Tablero post-pago – cajón A-01 liberado ──────────────────────────
await prueba('P10 – Post-pago: cajón A-01 vuelve a DISPONIBLE', async () => {
  const { body } = await get('/infraestructura/cajones');
  const cajones  = body.data[0].cajones;
  const cajonA01 = cajones.find((c) => c.id === 'A-01');
  assertEqual(cajonA01.estado, 'DISPONIBLE');
  assertEqual(cajonA01.estanciaActivaId, null);
});

// ── P11: Pago con factura individual ──────────────────────────────────────
await prueba('P11 – Pago con factura individual → FACTURADO_INDIVIDUAL', async () => {
  assertTrue(estanciaMotoId !== null, 'estanciaMotoId no fue capturado en P4');

  const { status, body } = await post('/estancias/pago', {
    estanciaId:      estanciaMotoId,
    metodoPago:      'TARJETA',
    requiereFactura: true,
    datosFiscales: {
      rfc:        'XAXX010101000',
      razonSocial: 'Público en General',
      codigoPostal: '06600',
      usoCFDI:    'G03',
    },
  });

  assertEqual(status, 201);
  assertEqual(body.ok, true);
  assertEqual(body.data.facturacion.estadoFacturacion, 'FACTURADO_INDIVIDUAL');
  assertTrue(body.data.facturacion.datosFiscales !== null);
});

// ── P12: Admin crea nuevo cajón dinámicamente ─────────────────────────────
await prueba('P12 – RF-11: crear cajón A-03 → estado DISPONIBLE', async () => {
  const { status, body } = await post('/infraestructura/cajones', {
    pisoId:    'PISO-1',
    codigo:    'A-03',
    categoria: 'AUTOMOVIL',
  });

  assertEqual(status, 201);
  assertEqual(body.ok, true);
  assertEqual(body.data.estado,    'DISPONIBLE');
  assertEqual(body.data.categoria, 'AUTOMOVIL');
});

// ── P13: Cajón duplicado → 409 ────────────────────────────────────────────
await prueba('P13 – Cajón duplicado → HTTP 409', async () => {
  const { status, body } = await post('/infraestructura/cajones', {
    pisoId: 'PISO-1', codigo: 'A-03', categoria: 'AUTOMOVIL',
  });
  assertEqual(status, 409);
  assertEqual(body.ok, false);
});

// ── P14: Tablero final – 4 cajones, todos disponibles ─────────────────────
await prueba('P14 – Tablero final: 4 cajones, todos DISPONIBLE', async () => {
  const { body } = await get('/infraestructura/cajones');
  const resumen  = body.data[0].resumen;
  assertEqual(resumen.total,       4);
  assertEqual(resumen.disponibles, 4);
  assertEqual(resumen.ocupados,    0);
});

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
console.log('\n──────────────────────────────────────────────────');
console.log(`  Total:   ${pasadas + fallidas} pruebas`);
console.log(`  ✅ PASS: ${pasadas}`);
console.log(`  ❌ FAIL: ${fallidas}`);
console.log('──────────────────────────────────────────────────\n');

if (fallidas > 0) process.exit(1);
