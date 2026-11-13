/**
 * normalizador.js
 * Utilidades de normalización de datos de entrada.
 * Sin dependencias externas (Clean Architecture – capa de utilidades puras).
 */

/**
 * Normaliza una placa de vehículo eliminando espacios, guiones y caracteres
 * especiales, y convirtiéndola a mayúsculas estrictas.
 *
 * @param {string} placaInput - Placa tal como viene del usuario.
 * @returns {string} Placa normalizada.
 * @throws {Error} Si la placa resultante tiene menos de 3 caracteres.
 */
export function normalizarPlaca(placaInput) {
  if (typeof placaInput !== 'string') {
    throw new Error('Formato de placa inválido');
  }

  // Elimina espacios, guiones y cualquier carácter que no sea alfanumérico
  const placaNormalizada = placaInput
    .replace(/[\s\-_]/g, '')       // espacios, guiones y guiones bajos
    .replace(/[^A-Za-z0-9]/g, '')  // cualquier otro carácter especial
    .toUpperCase();

  if (placaNormalizada.length < 3) {
    throw new Error('Formato de placa inválido');
  }

  return placaNormalizada;
}
