import { useState, useEffect, useCallback, useRef } from 'react'
import { getCache, setCache } from '../api/cache'

/**
 * Stale-while-revalidate hook.
 * Shows cached data instantly, then refreshes from the network in background.
 *
 * @param {string} cacheKey  — localStorage key
 * @param {() => Promise<any>} fetchFn — async function that returns fresh data
 * @returns {{ data, loading, refreshing, error, refetch }}
 */
export default function useCachedData(cacheKey, fetchFn) {
  const [data, setData] = useState(() => getCache(cacheKey))
  const [loading, setLoading] = useState(() => getCache(cacheKey) === null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const fetchFromNetwork = useCallback(async () => {
    const hadCache = getCache(cacheKey) !== null
    if (hadCache) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const fresh = await fetchFn()
      if (!mountedRef.current) return
      setCache(cacheKey, fresh)
      setData(fresh)
      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      // Only surface errors when there is no cached data
      if (!hadCache) {
        setError(err.message || 'Error al cargar datos.')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [cacheKey, fetchFn])

  useEffect(() => {
    mountedRef.current = true
    fetchFromNetwork()
    return () => { mountedRef.current = false }
  }, [fetchFromNetwork])

  const refetch = useCallback(() => {
    fetchFromNetwork()
  }, [fetchFromNetwork])

  return { data, loading, refreshing, error, refetch }
}
