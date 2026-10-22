import { useCallback, useEffect, useState } from 'react'
import { getCobroActual, getDepartamentos, getHistorico, getWhatsappTemplate } from '../api/sheets'
import { CACHE_KEYS } from '../api/cache'
import useCachedData from '../hooks/useCachedData'
import { useAuth } from '../context/AuthContext'
import TablaDeptos from '../components/TablaDeptos'
import { formatPesos, formatMesAnio } from '../utils/format'
import { PLANTILLA_DEFAULT, renderMensaje, buildWhatsappUrl } from '../utils/whatsapp'

const COLUMNAS = [
  { id: 'depto', label: '# Depto' },
  { id: 'residente', label: 'Residente' },
  { id: 'porPagar', label: 'Por Pagar' },
  { id: 'status', label: 'Status' },
  { id: 'saldoFavor', label: 'Saldo a Favor' },
]

function MesActual() {
  const [columnasOcultas, setColumnasOcultas] = useState([])
  const toggleColumna = (id) =>
    setColumnasOcultas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    )
  const { isAdmin } = useAuth()
  const fetchCobro = useCallback(() => getCobroActual(), [])
  const fetchDeptos = useCallback(() => getDepartamentos(), [])
  // Solo admin: plantilla e histórico (para el adeudo de meses pasados).
  // Se piden sin pasar por el caché para no contaminar claves compartidas.
  const [plantilla, setPlantilla] = useState('')
  const [historico, setHistorico] = useState([])
  useEffect(() => {
    if (!isAdmin) return undefined
    let cancelled = false
    getWhatsappTemplate()
      .then((t) => { if (!cancelled) setPlantilla(t || '') })
      .catch(() => {})
    getHistorico()
      .then((h) => { if (!cancelled) setHistorico(Array.isArray(h) ? h : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isAdmin])

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
  // Recaudado = number of "pagado" departments × montoBase (exclude adelantos and saldo a favor)
  const montoBase = cobro.montoBase || 0
  const deptosPagados = pagos.filter((p) => (p.status || '').toLowerCase() === 'pagado').length
  const totalRecaudado = deptosPagados * montoBase
  const deptosActivos = departamentos.filter((d) => d.activo).length
  const totalEsperado = deptosActivos * montoBase

  // Adeudo acumulado de meses pasados por depto (suma de montoAdeudo de cobros anteriores)
  const adeudoPasadoPorDepto = {}
  historico.forEach((c) => {
    if (!c || String(c.mes) >= String(cobro.mes)) return
    ;(c.pagos || []).forEach((p) => {
      const key = String(p.depto)
      adeudoPasadoPorDepto[key] = (adeudoPasadoPorDepto[key] || 0) + (Number(p.montoAdeudo) || 0)
    })
  })

  const renderActions = isAdmin
    ? (dept, pago) => {
        const telefono = String(dept.telefono ?? '').trim()
        if (!telefono) {
          return (
            <button
              type="button"
              className="btn btn--whatsapp"
              disabled
              title="Este departamento no tiene teléfono registrado"
              aria-label={`Sin teléfono registrado para el depto ${dept.depto}`}
            >
              WhatsApp
            </button>
          )
        }
        const mensaje = renderMensaje(plantilla || PLANTILLA_DEFAULT, {
          nombre: dept.nombre || '',
          depto: dept.depto,
          mes: cobro.mes,
          adeudoMesActual: pago ? (Number(pago.montoAdeudo) || 0) : montoBase,
          adeudoMesesPasados: adeudoPasadoPorDepto[String(dept.depto)] || 0,
          saldoFavor: Number(dept.saldoFavor) || 0,
        })
        return (
          <button
            type="button"
            className="btn btn--whatsapp"
            title="Enviar recordatorio por WhatsApp"
            aria-label={`Enviar recordatorio por WhatsApp al depto ${dept.depto}`}
            onClick={() =>
              window.open(buildWhatsappUrl(telefono, mensaje), '_blank', 'noopener,noreferrer')
            }
          >
            WhatsApp
          </button>
        )
      }
    : undefined

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

      <div className="columnas-toggle">
        <span className="columnas-toggle-label">Columnas:</span>
        {COLUMNAS.map((col) => {
          const oculta = columnasOcultas.includes(col.id)
          return (
            <label
              key={col.id}
              className={`columnas-chip${oculta ? ' columnas-chip--off' : ''}`}
            >
              <input
                type="checkbox"
                checked={!oculta}
                onChange={() => toggleColumna(col.id)}
              />
              {col.label}
            </label>
          )
        })}
      </div>

      <TablaDeptos
        departamentos={departamentos}
        pagos={pagos}
        montoBase={montoBase}
        columnasOcultas={columnasOcultas}
        renderActions={renderActions}
      />
    </div>
  )
}

export default MesActual
