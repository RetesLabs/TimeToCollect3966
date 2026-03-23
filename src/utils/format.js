/**
 * Formatea un número como pesos mexicanos.
 * @param {number} amount
 * @returns {string}
 */
export function formatPesos(amount) {
  const num = Number(amount) || 0
  return num.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Convierte una cadena YYYY-MM a un nombre de mes legible en español.
 * Ejemplo: "2025-03" → "Marzo 2025"
 * @param {string} yearMonth - Formato YYYY-MM
 * @returns {string}
 */
export function formatMesAnio(yearMonth) {
  if (!yearMonth) return '—'

  try {
    // Parse as the first day of the month
    const [year, month] = yearMonth.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)

    const mesNombre = date.toLocaleDateString('es-MX', { month: 'long' })
    // Capitalize first letter
    return `${mesNombre.charAt(0).toUpperCase()}${mesNombre.slice(1)} ${year}`
  } catch {
    return yearMonth
  }
}
