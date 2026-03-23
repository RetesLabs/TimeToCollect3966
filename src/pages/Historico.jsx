import { useState, useCallback } from 'react'
import { getHistorico, getDepartamentos } from '../api/sheets'
import { CACHE_KEYS } from '../api/cache'
import useCachedData from '../hooks/useCachedData'
import TablaDeptos from '../components/TablaDeptos'
import { formatPesos, formatMesAnio } from '../utils/format'

function Historico() {
  const [expandedMonth, setExpandedMonth] = useState(null)

  const fetchHistorico = useCallback(() => getHistorico(), [])
  const fetchDeptos = useCallback(() => getDepartamentos(), [])

  const {
    data: historicoRaw,
    loading: loadingHistorico,
    refreshing: refreshingHistorico,
    error: errorHistorico,
  } = useCachedData(CACHE_KEYS.historico, fetchHistorico)

  const {
    data: deptosRaw,
    loading: loadingDeptos,
    refreshing: refreshingDeptos,
    error: errorDeptos,
  } = useCachedData(CACHE_KEYS.departamentos, fetchDeptos)

  const loading = loadingHistorico || loadingDeptos
  const refreshing = refreshingHistorico || refreshingDeptos
  const error = errorHistorico || errorDeptos

  const cobros = (() => {
    if (!historicoRaw) return []
    const list = Array.isArray(historicoRaw) ? historicoRaw : (historicoRaw.cobros || [])
    return [...list].sort((a, b) => (b.mes || '').localeCompare(a.mes || ''))
  })()

  const departamentos = Array.isArray(deptosRaw) ? deptosRaw : (deptosRaw?.departamentos || [])

  const toggleMonth = (cobroId) => {
    setExpandedMonth((prev) => (prev === cobroId ? null : cobroId))
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">
          <div className="spinner" />
          <p>Cargando histórico...</p>
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
          <button className="btn btn--primary" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (cobros.length === 0) {
    return (
      <div className="page-container">
        <h2>Histórico de Cobros</h2>
        <div className="empty-state">
          <p>No hay cobros registrados en el histórico.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      {refreshing && <div className="refreshing-bar" />}

      <h2>Histórico de Cobros</h2>

      <div className="accordion">
        {cobros.map((cobro) => {
          const cobroId = cobro.id || cobro.cobroId || cobro.mes
          const pagos = cobro.pagos || []
          const deptosPagados = pagos.filter((p) => (p.status || '').toLowerCase() === 'pagado').length
          const totalRecaudado = deptosPagados * (cobro.montoBase || 0)
          const deptosActivos = departamentos.filter((d) => d.activo).length
          const totalEsperado = deptosActivos * (cobro.montoBase || 0)
          const isExpanded = expandedMonth === cobroId

          return (
            <div key={cobroId} className="accordion-item">
              <button
                className={`accordion-header ${isExpanded ? 'accordion-header--open' : ''}`}
                onClick={() => toggleMonth(cobroId)}
                aria-expanded={isExpanded}
              >
                <div className="accordion-header-info">
                  <span className="accordion-month">
                    {formatMesAnio(cobro.mes)}
                  </span>
                  <span className="accordion-monto">
                    Base: {formatPesos(cobro.montoBase)}
                  </span>
                  <span className="accordion-progress">
                    {formatPesos(totalRecaudado)} / {formatPesos(totalEsperado)}
                  </span>
                </div>
                <span className={`accordion-arrow ${isExpanded ? 'accordion-arrow--open' : ''}`}>
                  &#9660;
                </span>
              </button>

              {isExpanded && (
                <div className="accordion-body">
                  <TablaDeptos
                    departamentos={departamentos}
                    pagos={pagos}
                    montoBase={cobro.montoBase || 0}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Historico
