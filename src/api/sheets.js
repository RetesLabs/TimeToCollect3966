import { clearCache, CACHE_KEYS } from './cache'

const API_URL = import.meta.env.VITE_GAS_URL || ''

/**
 * Helper for GET requests to the Google Apps Script API.
 * Appends action and any extra params as query-string parameters.
 */
export async function fetchAPI(action, params = {}) {
  if (!API_URL) {
    throw new Error('La URL de la API no está configurada. Establece VITE_GAS_URL en tu archivo .env')
  }

  const url = new URL(API_URL)
  url.searchParams.set('action', action)

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  })

  const response = await fetch(url.toString())

  if (!response.ok) {
    throw new Error(`Error en la petición: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(data.error)
  }

  // GAS wraps responses in { success, data } — unwrap if present
  if (data.success !== undefined && data.data !== undefined) {
    return data.data
  }

  return data
}

/**
 * Helper for POST requests to the Google Apps Script API.
 * Sends JSON body with the action field included.
 */
export async function postAPI(action, body = {}) {
  if (!API_URL) {
    throw new Error('La URL de la API no está configurada. Establece VITE_GAS_URL en tu archivo .env')
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...body }),
  })

  if (!response.ok) {
    throw new Error(`Error en la petición: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.success === false) {
    throw new Error(data.error || 'Error en la operación')
  }

  if (data.data !== undefined) {
    return data.data
  }

  return data
}

/**
 * Obtiene la lista de los 12 departamentos con su información.
 */
export async function getDepartamentos() {
  return fetchAPI('getDepartamentos')
}

/**
 * Obtiene el cobro del mes actual (mes vigente) con sus pagos.
 */
export async function getCobroActual() {
  return fetchAPI('getCobroActual')
}

/**
 * Obtiene el histórico de cobros y pagos de meses anteriores.
 */
export async function getHistorico() {
  return fetchAPI('getHistorico')
}

/**
 * Crea un nuevo cobro mensual.
 * @param {string} mes - Formato YYYY-MM
 * @param {number} montoBase - Monto base a cobrar
 * @param {string} password - Contraseña de administrador
 */
export async function crearCobro(mes, montoBase, password) {
  const result = await postAPI('crearCobro', { mes, montoBase: Number(montoBase), password })
  clearCache(CACHE_KEYS.cobroActual)
  clearCache(CACHE_KEYS.historico)
  return result
}

/**
 * Registra el pago de un departamento para un cobro específico.
 * @param {string} cobroId - ID del cobro
 * @param {string|number} depto - Número de departamento
 * @param {number} montoPagado - Monto que pagó el residente
 * @param {number} montoAdeudo - Monto que queda pendiente
 * @param {number} saldoFavorUsado - Saldo a favor utilizado
 * @param {string} password - Contraseña de administrador
 * @param {string} [status] - "pagado" o "adelanto"
 */
export async function registrarPago(cobroId, depto, montoPagado, montoAdeudo, saldoFavorUsado, password, status) {
  const body = {
    cobroId,
    depto: Number(depto),
    montoPagado: Number(montoPagado),
    montoAdeudo: Number(montoAdeudo),
    saldoFavorUsado: Number(saldoFavorUsado),
    password,
  }
  if (status) body.status = status
  const result = await postAPI('registrarPago', body)
  clearCache(CACHE_KEYS.cobroActual)
  clearCache(CACHE_KEYS.historico)
  clearCache(CACHE_KEYS.departamentos)
  return result
}

/**
 * Actualiza la información de un departamento.
 * @param {string|number} depto - Número de departamento
 * @param {string} nombre - Nombre del residente
 * @param {string} telefono - Teléfono de contacto
 * @param {boolean} activo - Si el departamento está activo
 * @param {string} password - Contraseña de administrador
 */
export async function actualizarDepto(depto, nombre, telefono, activo, password) {
  const result = await postAPI('actualizarDepto', {
    depto: Number(depto),
    nombre,
    telefono,
    activo: Boolean(activo),
    password,
  })
  clearCache(CACHE_KEYS.departamentos)
  return result
}

/**
 * Activa un cobro como el mes vigente (mesActivo = true), desactivando los demás.
 * @param {string} cobroId - ID del cobro a activar
 * @param {string} password - Contraseña de administrador
 */
export async function activarMes(cobroId, password) {
  const result = await postAPI('activarMes', { cobroId, password })
  clearCache(CACHE_KEYS.cobroActual)
  clearCache(CACHE_KEYS.historico)
  return result
}

/**
 * Obtiene la lista de cobroIds que ya tienen snapshot en la hoja Historico.
 */
export async function getHistoricoSnapshots() {
  const result = await fetchAPI('getHistoricoSnapshots')
  return Array.isArray(result) ? result : []
}

/**
 * Guarda (congela) el snapshot histórico de un cobro. Falla si ya existe.
 * @param {string} cobroId - ID del cobro
 * @param {string} password - Contraseña de administrador
 */
export async function guardarHistorico(cobroId, password) {
  const result = await postAPI('guardarHistorico', { cobroId, password })
  clearCache(CACHE_KEYS.historicoSnapshots)
  return result
}

/**
 * Registra un depósito adelantado que se suma al saldo a favor de un departamento.
 * @param {string|number} depto - Número de departamento
 * @param {number} monto - Monto depositado (> 0)
 * @param {string} nota - Nota opcional
 * @param {string} password - Contraseña de administrador
 */
export async function registrarDeposito(depto, monto, nota, password) {
  const result = await postAPI('registrarDeposito', {
    depto: Number(depto),
    monto: Number(monto),
    nota: nota || '',
    password,
  })
  clearCache(CACHE_KEYS.departamentos)
  clearCache(CACHE_KEYS.cobroActual)
  return result
}

/**
 * Obtiene la plantilla del mensaje de WhatsApp (texto). Si no hay, devuelve cadena vacía.
 */
export async function getWhatsappTemplate() {
  const result = await fetchAPI('getWhatsappTemplate')
  return typeof result?.template === 'string' ? result.template : ''
}

/**
 * Guarda la plantilla del mensaje de WhatsApp.
 * @param {string} template - Texto de la plantilla
 * @param {string} password - Contraseña de administrador
 */
export async function saveWhatsappTemplate(template, password) {
  const result = await postAPI('saveWhatsappTemplate', { template, password })
  clearCache(CACHE_KEYS.whatsappTemplate)
  return result
}

/**
 * Verifica la contraseña del administrador.
 * @param {string} password - Contraseña a verificar
 */
export async function login(password) {
  const result = await postAPI('login', { password })
  // login returns { success: true, message } — postAPI unwraps data,
  // but login has no data field, so result may be the full response.
  // Return a normalized object.
  return { success: true }
}

