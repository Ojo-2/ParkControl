/**
 * api.js
 * Capa de acceso a la API REST de ParkControl.
 * Todos los errores HTTP se propagan como Error con el mensaje del backend.
 */

const API_BASE = 'http://localhost:3000/api';

/** Wrapper genérico que lanza si ok === false o HTTP >= 400. */
async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json();

  if (!res.ok || data.ok === false) {
    throw new Error(data.mensaje ?? `Error ${res.status}`);
  }

  return data.data;
}

/** GET /api/infraestructura/cajones
 *  Retorna la matriz de pisos con sus cajones y resúmenes. */
export async function getMapaCajones() {
  return request('GET', '/infraestructura/cajones');
}

/** POST /api/estancias/entrada
 *  @param {{ placa, tipoVehiculo, cajonId, fechaEntradaOverride? }} datos */
export async function registrarEntrada(datos) {
  return request('POST', '/estancias/entrada', datos);
}

/** GET /api/estancias/salida/:placa
 *  Retorna { estancia, cotizacion } sin finalizar la estancia. */
export async function consultarSalida(placa) {
  return request('GET', `/estancias/salida/${encodeURIComponent(placa)}`);
}

/** POST /api/estancias/pago
 *  @param {{ estanciaId, metodoPago, requiereFactura, datosFiscales? }} datosPago */
export async function procesarPago(datosPago) {
  return request('POST', '/estancias/pago', datosPago);
}
