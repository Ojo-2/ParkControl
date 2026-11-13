/**
 * reglasNegocio.js
 * Motor de reglas de negocio puras para ParkControl.
 *
 * IMPORTANTE: Este módulo NO importa Express, bases de datos ni ninguna
 * librería externa. Es el corazón de la Clean Architecture.
 */

// ---------------------------------------------------------------------------
// Constantes de factores por tipo de vehículo
// ---------------------------------------------------------------------------
const FACTORES_VEHICULO = {
  AUTOMOVIL: 1.0,
  MOTOCICLETA: 0.6,
  SUV: 1.3,
};

// ---------------------------------------------------------------------------
// calcularTiempoTranscurrido
// ---------------------------------------------------------------------------

/**
 * Calcula los minutos totales transcurridos entre dos momentos.
 * El resultado se redondea hacia arriba (Math.ceil).
 *
 * @param {Date|string} fechaEntrada - Fecha/hora de entrada.
 * @param {Date|string} fechaSalida  - Fecha/hora de salida.
 * @returns {number} Minutos totales (entero, redondeado hacia arriba).
 */
export function calcularTiempoTranscurrido(fechaEntrada, fechaSalida) {
  const entrada = new Date(fechaEntrada);
  const salida  = new Date(fechaSalida);

  const diferenciaMs = salida.getTime() - entrada.getTime();

  if (diferenciaMs < 0) {
    throw new Error('La fecha de salida no puede ser anterior a la de entrada');
  }

  return Math.ceil(diferenciaMs / 60_000);
}

// ---------------------------------------------------------------------------
// validarCompatibilidadCajon  (RN-10)
// ---------------------------------------------------------------------------

/**
 * Valida que el tipo de vehículo sea compatible con la categoría del cajón.
 *
 * Reglas:
 *   - MOTOCICLETA  → cajón MOTOCICLETA
 *   - AUTOMOVIL    → cajón AUTOMOVIL
 *   - SUV          → cajón AUTOMOVIL
 *
 * @param {string} tipoVehiculo   - 'AUTOMOVIL' | 'MOTOCICLETA' | 'SUV'
 * @param {string} categoriaCajon - 'AUTOMOVIL' | 'MOTOCICLETA'
 * @returns {boolean}
 */
export function validarCompatibilidadCajon(tipoVehiculo, categoriaCajon) {
  if (tipoVehiculo === 'MOTOCICLETA') {
    return categoriaCajon === 'MOTOCICLETA';
  }

  if (tipoVehiculo === 'AUTOMOVIL' || tipoVehiculo === 'SUV') {
    return categoriaCajon === 'AUTOMOVIL';
  }

  // Tipo de vehículo desconocido → incompatible por defecto
  return false;
}

// ---------------------------------------------------------------------------
// Helpers internos para calcularTarifa
// ---------------------------------------------------------------------------

/**
 * Convierte una hora en formato "HH:MM" a minutos desde medianoche.
 * @param {string} horaStr
 * @returns {number}
 */
function horaAMinutos(horaStr) {
  const [hh, mm] = horaStr.split(':').map(Number);
  return hh * 60 + mm;
}

/**
 * Determina cuántos minutos de un intervalo [inicioMs, finMs) caen dentro
 * de la franja nocturna (22:00–06:00) y cuántos en la diurna.
 *
 * @param {Date} inicio
 * @param {Date} fin
 * @param {string} inicioDiurno - p.ej. "06:00"
 * @param {string} finDiurno    - p.ej. "22:00"
 * @returns {{ diurnoMin: number, nocturnoMin: number }}
 */
function dividirMinutosDiurnosNocturnos(inicio, fin, inicioDiurno, finDiurno) {
  const inicioDiurnoMin = horaAMinutos(inicioDiurno); // 360
  const finDiurnoMin    = horaAMinutos(finDiurno);    // 1320

  let diurnoMin   = 0;
  let nocturnoMin = 0;

  // Iteramos minuto a minuto para manejar correctamente cruces de medianoche
  // y estancias largas. Para rendimiento usamos bloques de día completo
  // cuando el intervalo es muy largo.
  let cursor = new Date(inicio);

  while (cursor < fin) {
    // Calcular el minuto del día del cursor
    const minDia = cursor.getHours() * 60 + cursor.getMinutes();
    const esDiurno = minDia >= inicioDiurnoMin && minDia < finDiurnoMin;

    // Avanzar hasta el siguiente "punto de cambio" (inicio/fin de franja)
    // o hasta el fin de la estancia
    let siguienteCambio;

    if (esDiurno) {
      // Próximo cambio: fin de franja diurna en este día
      siguienteCambio = new Date(cursor);
      siguienteCambio.setHours(
        Math.floor(finDiurnoMin / 60),
        finDiurnoMin % 60,
        0, 0
      );
    } else {
      // Próximo cambio: inicio de franja diurna
      // Puede ser hoy si aún no llegamos a 06:00, o mañana si ya pasamos de 22:00
      siguienteCambio = new Date(cursor);
      siguienteCambio.setHours(
        Math.floor(inicioDiurnoMin / 60),
        inicioDiurnoMin % 60,
        0, 0
      );
      if (siguienteCambio <= cursor) {
        // Ya pasó el inicio diurno de hoy → apuntar al del día siguiente
        siguienteCambio.setDate(siguienteCambio.getDate() + 1);
      }
    }

    // El bloque termina en el mínimo entre el siguiente cambio y el fin real
    const bloqueHasta = siguienteCambio < fin ? siguienteCambio : fin;
    const minutos = Math.round((bloqueHasta - cursor) / 60_000);

    if (esDiurno) {
      diurnoMin += minutos;
    } else {
      nocturnoMin += minutos;
    }

    cursor = bloqueHasta;
  }

  return { diurnoMin, nocturnoMin };
}

// ---------------------------------------------------------------------------
// calcularTarifa
// ---------------------------------------------------------------------------

/**
 * Calcula la tarifa de estancia con todas las reglas de negocio aplicadas.
 *
 * @param {{ fechaEntrada: Date|string, fechaSalida: Date|string, tipoVehiculo: string }} datosEstancia
 * @param {{
 *   tarifaBaseHora: number,
 *   cuotaFraccion15: number,
 *   inicioDiurno: string,
 *   finDiurno: string,
 *   tarifaNocturnaFija: number
 * }} configuracionTarifas
 *
 * @returns {{
 *   minutosTotales: number,
 *   horasDiurnas: number,
 *   fraccionesDiurnas: number,
 *   horasNocturnas: number,
 *   factorVehiculo: number,
 *   montoTotal: number,
 *   subtotal: number,
 *   iva: number
 * }}
 */
export function calcularTarifa(datosEstancia, configuracionTarifas) {
  const { fechaEntrada, fechaSalida, tipoVehiculo } = datosEstancia;
  const {
    tarifaBaseHora,
    cuotaFraccion15,
    inicioDiurno,
    finDiurno,
    tarifaNocturnaFija,
  } = configuracionTarifas;

  // --- Factor por tipo de vehículo ---
  const factorVehiculo = FACTORES_VEHICULO[tipoVehiculo] ?? 1.0;

  // --- Tiempo total ---
  const minutosTotales = calcularTiempoTranscurrido(fechaEntrada, fechaSalida);

  // --- Dividir tiempo diurno / nocturno ---
  const entrada = new Date(fechaEntrada);
  const salida  = new Date(fechaSalida);

  const { diurnoMin, nocturnoMin } = dividirMinutosDiurnosNocturnos(
    entrada, salida, inicioDiurno, finDiurno
  );

  // -------------------------------------------------------------------------
  // RN-01: Del minuto 1 al 60 → 1 hora base completa × factor
  // RN-02: Del minuto 61 en adelante → fracciones de 15 min adicionales
  // -------------------------------------------------------------------------

  // Cálculo sobre fracción diurna
  let costoDiurno = 0;
  let horasDiurnas = 0;
  let fraccionesDiurnas = 0;

  if (diurnoMin > 0) {
    // Primera hora (RN-01)
    horasDiurnas = 1;
    costoDiurno = tarifaBaseHora * factorVehiculo;

    const minExcedenteDiurno = diurnoMin - 60;
    if (minExcedenteDiurno > 0) {
      // RN-02: fracciones de 15 min redondeando hacia arriba
      fraccionesDiurnas = Math.ceil(minExcedenteDiurno / 15);
      costoDiurno += fraccionesDiurnas * cuotaFraccion15;
    }
  }

  // Cálculo sobre fracción nocturna
  let costoNocturno = 0;
  let horasNocturnas = 0;

  if (nocturnoMin > 0) {
    // Tarifa nocturna fija (RN-02 Tarifa Mixta)
    horasNocturnas = Math.ceil(nocturnoMin / 60);
    costoNocturno = tarifaNocturnaFija;
  }

  // -------------------------------------------------------------------------
  // Monto total (con IVA incluido)
  // -------------------------------------------------------------------------
  const montoTotal = Math.round((costoDiurno + costoNocturno) * 100) / 100;

  // -------------------------------------------------------------------------
  // RN-07: Desglose IVA 16%
  // -------------------------------------------------------------------------
  const subtotal = Math.round((montoTotal / 1.16) * 100) / 100;
  const iva      = Math.round((montoTotal - subtotal) * 100) / 100;

  return {
    minutosTotales,
    horasDiurnas,
    fraccionesDiurnas,
    horasNocturnas,
    factorVehiculo,
    montoTotal,
    subtotal,
    iva,
  };
}
