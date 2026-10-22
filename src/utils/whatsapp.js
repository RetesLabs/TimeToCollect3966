import { formatPesos, formatMesAnio } from './format'

export const PLANTILLA_DEFAULT =
  'TimeToCollect3966: Hola vecino, recordatorio de pago de <mes-activo>. <adeudo-mes-actual>. Gracias.'

export const VARIABLES_WHATSAPP = [
  { variable: '<nombre inquilino>', descripcion: 'Nombre del residente' },
  { variable: '<numero de departamento>', descripcion: 'Número del departamento' },
  { variable: '<mes-activo>', descripcion: 'Mes activo del cobro (ej. Marzo 2025)' },
  { variable: '<adeudo-mes-actual>', descripcion: 'Adeudo del mes actual' },
  { variable: '<adeudo-meses-pasados>', descripcion: 'Adeudo acumulado de meses pasados' },
  { variable: '<saldo-a-favor>', descripcion: 'Saldo a favor actual del departamento' },
]

/**
 * Sustituye todas las variables de la plantilla por sus valores.
 * @param {string} plantilla
 * @param {{nombre?: string, depto?: string|number, mes?: string, adeudoMesActual?: number, adeudoMesesPasados?: number, saldoFavor?: number}} valores
 *   `mes` en formato YYYY-MM.
 * @returns {string}
 */
export function renderMensaje(plantilla, valores = {}) {
  const mapa = {
    '<nombre inquilino>': valores.nombre ?? '',
    '<numero de departamento>': String(valores.depto ?? ''),
    '<mes-activo>': formatMesAnio(valores.mes),
    '<adeudo-mes-actual>': formatPesos(valores.adeudoMesActual),
    '<adeudo-meses-pasados>': formatPesos(valores.adeudoMesesPasados),
    '<saldo-a-favor>': formatPesos(valores.saldoFavor),
  }
  let resultado = String(plantilla ?? '')
  for (const [variable, valor] of Object.entries(mapa)) {
    resultado = resultado.split(variable).join(valor)
  }
  return resultado
}

/**
 * Arma la URL de WhatsApp. El teléfono se usa tal cual.
 * @param {string} telefono
 * @param {string} mensaje
 * @returns {string}
 */
export function buildWhatsappUrl(telefono, mensaje) {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`
}
