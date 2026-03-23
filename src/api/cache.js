const PREFIX = 'ttc3966_'

export const CACHE_KEYS = {
  departamentos: `${PREFIX}departamentos`,
  cobroActual: `${PREFIX}cobroActual`,
  historico: `${PREFIX}historico`,
}

export function getCache(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw).data
  } catch {
    return null
  }
}

export function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function clearCache(key) {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

export function clearAllCache() {
  Object.values(CACHE_KEYS).forEach(clearCache)
}
