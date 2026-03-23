import { useCallback } from 'react'
import { getCobroActual, getDepartamentos } from '../api/sheets'
import { CACHE_KEYS } from '../api/cache'
import useCachedData from '../hooks/useCachedData'
import TablaDeptos from '../components/TablaDeptos'
import { formatPesos, formatMesAnio } from '../utils/format'

function MesActual() {
  const fetchCobro = useCallback(() => getCobroActual(), [])
  const fetchDeptos = useCallback(() => getDepartamentos(), [])

  const {
    data: cobro,
    loading: loadingCobro,
    refreshing: refreshingCobro,
    error: errorCobro,
    refetch: refetchCobro,
  } = useCachedData(CACHE_KEYS.cobroActual, fetchCobro)

  const {
    data: deptosRaw,
    loading: loadingDeptos,
    refreshing: refreshingDeptos,
    error: errorDeptos,
    refetch: refetchDeptos,
  } = useCachedData(CACHE_KEYS.departamentos, fetchDeptos)

  const loading = loadingCobro || loadingDeptos
  const refreshing = refreshingCobro || refreshingDeptos
  const error = errorCobro || errorDeptos
  const departamentos = Array.isArray(deptosRaw) ? deptosRaw : (deptosRaw?.departamentos || [])

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">
          <div className="spinner" />
          <p>Cargando datos del mes actual...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="btn btn--primary" onClick={() => { refetchCobro(); refetchDeptos() }}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!cobro) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h2>Sin mes activo</h2>
          <p>No hay un mes activo configurado.</p>
          <p>El administrador debe activar un mes desde el panel de administración.</p>
        </div>
      </div>
    )
  }

  // getCobroActual returns payment info merged into cobro.departamentos, not cobro.pagos
  const pagos = cobro.departamentos || cobro.pagos || []
  // Only count "pagado" status towards recaudado, exclude "adelanto"
  const totalRecaudado = pagos.reduce((sum, p) => {
    const status = (p.status || '').toLowerCase()
    if (status === 'pagado') return sum + (Number(p.montoPagado) || 0)
    return sum
  }, 0)
  const deptosActivos = departamentos.filter((d) => d.activo).length
  const totalEsperado = deptosActivos * (cobro.montoBase || 0)

  return (
    <div className="page-container">
      {refreshing && <div className="refreshing-bar" />}

      <div className="mes-actual-header">
        <h2>{formatMesAnio(cobro.mes)}</h2>
        <div className="mes-actual-stats">
          <div className="stat-card">
            <span className="stat-label">Monto Base</span>
            <span className="stat-value">{formatPesos(cobro.montoBase)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Recaudado</span>
            <span className="stat-value">{formatPesos(totalRecaudado)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Esperado</span>
            <span className="stat-value">{formatPesos(totalEsperado)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Progreso</span>
            <span className="stat-value">
              {totalEsperado > 0
                ? `${Math.round((totalRecaudado / totalEsperado) * 100)}%`
                : '0%'}
            </span>
          </div>
        </div>
      </div>

      <TablaDeptos
        departamentos={departamentos}
        pagos={pagos}
        montoBase={cobro.montoBase || 0}
      />
    </div>
  )
}

export default MesActual
