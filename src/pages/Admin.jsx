import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import LoginModal from '../components/LoginModal'
import NuevoCobro from '../components/NuevoCobro'
import TablaDeptos from '../components/TablaDeptos'
import { CACHE_KEYS } from '../api/cache'
import useCachedData from '../hooks/useCachedData'
import {
  getDepartamentos,
  getHistorico,
  getCobroActual,
  registrarPago,
  actualizarDepto,
} from '../api/sheets'
import { formatPesos, formatMesAnio } from '../utils/format'

const TABS = [
  { key: 'crear', label: 'Crear Cobro' },
  { key: 'pagos', label: 'Gestionar Pagos' },
  { key: 'deptos', label: 'Gestionar Departamentos' },
  { key: 'comprobantes', label: 'Comprobantes' },
]

function Admin() {
  const { isAdmin, adminPassword } = useAuth()
  const [activeTab, setActiveTab] = useState('crear')

  if (!isAdmin) {
    return (
      <div className="page-container">
        <h2>Panel de Administración</h2>
        <p>Debes iniciar sesión como administrador para acceder a esta sección.</p>
        <LoginModal />
      </div>
    )
  }

  return (
    <div className="page-container">
      <h2>Panel de Administración</h2>

      <div className="admin-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab ${activeTab === tab.key ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-tab-content">
        {activeTab === 'crear' && <TabCrearCobro />}
        {activeTab === 'pagos' && <TabGestionarPagos adminPassword={adminPassword} />}
        {activeTab === 'deptos' && <TabGestionarDeptos adminPassword={adminPassword} />}
        {activeTab === 'comprobantes' && <TabComprobantes />}
      </div>
    </div>
  )
}

/* --- Tab: Crear Cobro --- */
function TabCrearCobro() {
  return <NuevoCobro onSuccess={() => {}} />
}

/* --- Tab: Gestionar Pagos --- */
function TabGestionarPagos({ adminPassword }) {
  const [selectedCobroId, setSelectedCobroId] = useState('')
  const [pagoForms, setPagoForms] = useState({})
  const [savingDepto, setSavingDepto] = useState(null)
  const [saveMessage, setSaveMessage] = useState(null)

  const fetchHistorico = useCallback(() => getHistorico().catch(() => []), [])
  const fetchCobroActual = useCallback(() => getCobroActual().catch(() => null), [])
  const fetchDeptos = useCallback(() => getDepartamentos(), [])

  const {
    data: historicoRaw,
    loading: loadingH,
    refreshing: refreshingH,
    error: errorH,
    refetch: refetchH,
  } = useCachedData(CACHE_KEYS.historico, fetchHistorico)

  const {
    data: cobroActualData,
    loading: loadingCA,
    refreshing: refreshingCA,
    refetch: refetchCA,
  } = useCachedData(CACHE_KEYS.cobroActual, fetchCobroActual)

  const {
    data: deptosRaw,
    loading: loadingD,
    refreshing: refreshingD,
    error: errorD,
    refetch: refetchD,
  } = useCachedData(CACHE_KEYS.departamentos, fetchDeptos)

  const loading = loadingH || loadingCA || loadingD
  const refreshing = refreshingH || refreshingCA || refreshingD
  const error = errorH || errorD

  // Build cobros list
  const cobros = (() => {
    let allCobros = Array.isArray(historicoRaw)
      ? [...historicoRaw]
      : [...(historicoRaw?.cobros || [])]

    if (cobroActualData) {
      const currentId = cobroActualData.id || cobroActualData.cobroId
      const alreadyExists = allCobros.some(
        (c) => (c.id || c.cobroId) === currentId
      )
      if (!alreadyExists) {
        allCobros.unshift(cobroActualData)
      }
    }

    allCobros.sort((a, b) => (b.mes || '').localeCompare(a.mes || ''))
    return allCobros
  })()

  const departamentos = Array.isArray(deptosRaw) ? deptosRaw : (deptosRaw?.departamentos || [])

  // Auto-select first cobro
  const effectiveCobroId = selectedCobroId || (cobros.length > 0 ? (cobros[0].id || cobros[0].cobroId || cobros[0].mes) : '')

  const selectedCobro = cobros.find(
    (c) => (c.id || c.cobroId || c.mes) === effectiveCobroId
  )

  const handlePagoInputChange = (depto, field, value) => {
    setPagoForms((prev) => ({
      ...prev,
      [depto]: {
        ...(prev[depto] || {}),
        [field]: value,
      },
    }))
  }

  const handleRegistrarPago = async (dept) => {
    const form = pagoForms[dept.depto] || {}
    const montoPagado = parseFloat(form.montoPagado) || 0
    const montoAdeudo = parseFloat(form.montoAdeudo) || 0
    const saldoFavorUsado = parseFloat(form.saldoFavorUsado) || 0

    setSavingDepto(dept.depto)
    setSaveMessage(null)

    try {
      await registrarPago(
        effectiveCobroId,
        dept.depto,
        montoPagado,
        montoAdeudo,
        saldoFavorUsado,
        adminPassword
      )
      setSaveMessage({ depto: dept.depto, type: 'success', text: 'Pago registrado.' })
      refetchH()
      refetchCA()
      refetchD()
    } catch (err) {
      setSaveMessage({
        depto: dept.depto,
        type: 'error',
        text: err.message || 'Error al registrar pago.',
      })
    } finally {
      setSavingDepto(null)
    }
  }

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <p>Cargando cobros...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-message">
        <p>{error}</p>
        <button className="btn btn--primary" onClick={() => { refetchH(); refetchCA(); refetchD() }}>Reintentar</button>
      </div>
    )
  }

  if (cobros.length === 0) {
    return (
      <div className="empty-state">
        <p>No hay cobros registrados. Crea uno primero en la pestaña "Crear Cobro".</p>
      </div>
    )
  }

  return (
    <div className="gestionar-pagos">
      {refreshing && <div className="refreshing-bar" />}

      <div className="form-group">
        <label htmlFor="select-cobro">Seleccionar cobro:</label>
        <select
          id="select-cobro"
          value={effectiveCobroId}
          onChange={(e) => setSelectedCobroId(e.target.value)}
        >
          {cobros.map((c) => {
            const id = c.id || c.cobroId || c.mes
            return (
              <option key={id} value={id}>
                {formatMesAnio(c.mes)} — Base: {formatPesos(c.montoBase)}
              </option>
            )
          })}
        </select>
      </div>

      {selectedCobro && (
        <div className="pagos-table-section">
          <h4>{formatMesAnio(selectedCobro.mes)} — Base: {formatPesos(selectedCobro.montoBase)}</h4>

          <div className="tabla-deptos-wrapper">
            <table className="tabla-deptos">
              <thead>
                <tr>
                  <th># Depto</th>
                  <th>Residente</th>
                  <th>Estado Actual</th>
                  <th>Monto Pagado</th>
                  <th>Monto Adeudo</th>
                  <th>Saldo Favor Usado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {departamentos.map((dept) => {
                  const pagos = selectedCobro.pagos || []
                  const pagoExistente = pagos.find((p) => Number(p.depto) === Number(dept.depto))
                  const form = pagoForms[dept.depto] || {}
                  const isSaving = savingDepto === dept.depto
                  const msg =
                    saveMessage && saveMessage.depto === dept.depto ? saveMessage : null

                  return (
                    <tr
                      key={dept.depto}
                      className={!dept.activo ? 'tabla-deptos-row--inactive' : ''}
                    >
                      <td>{dept.depto}</td>
                      <td>{dept.nombre || '—'}</td>
                      <td>
                        {pagoExistente ? (
                          <span>
                            Pagado: {formatPesos(pagoExistente.montoPagado || 0)}
                            {pagoExistente.montoAdeudo > 0 && (
                              <> | Adeudo: {formatPesos(pagoExistente.montoAdeudo)}</>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted">Sin pago</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={form.montoPagado ?? ''}
                          onChange={(e) =>
                            handlePagoInputChange(dept.depto, 'montoPagado', e.target.value)
                          }
                          disabled={isSaving || !dept.activo}
                          className="input-sm"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={form.montoAdeudo ?? ''}
                          onChange={(e) =>
                            handlePagoInputChange(dept.depto, 'montoAdeudo', e.target.value)
                          }
                          disabled={isSaving || !dept.activo}
                          className="input-sm"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={form.saldoFavorUsado ?? ''}
                          onChange={(e) =>
                            handlePagoInputChange(dept.depto, 'saldoFavorUsado', e.target.value)
                          }
                          disabled={isSaving || !dept.activo}
                          className="input-sm"
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn--sm btn--primary"
                          onClick={() => handleRegistrarPago(dept)}
                          disabled={isSaving || !dept.activo}
                        >
                          {isSaving ? 'Guardando...' : 'Registrar Pago'}
                        </button>
                        {msg && (
                          <div className={`form-message form-message--${msg.type} form-message--inline`}>
                            {msg.text}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* --- Tab: Gestionar Departamentos --- */
function TabGestionarDeptos({ adminPassword }) {
  const [editForms, setEditForms] = useState({})
  const [savingDepto, setSavingDepto] = useState(null)
  const [saveMessages, setSaveMessages] = useState({})
  const [initialized, setInitialized] = useState(false)

  const fetchDeptos = useCallback(() => getDepartamentos(), [])

  const {
    data: deptosRaw,
    loading,
    refreshing,
    error,
    refetch: refetchDeptos,
  } = useCachedData(CACHE_KEYS.departamentos, fetchDeptos)

  const departamentos = Array.isArray(deptosRaw) ? deptosRaw : (deptosRaw?.departamentos || [])

  // Initialize edit forms when data arrives
  if (departamentos.length > 0 && !initialized) {
    const forms = {}
    departamentos.forEach((d) => {
      forms[d.depto] = {
        nombre: d.nombre || '',
        telefono: d.telefono || '',
        activo: d.activo !== false,
      }
    })
    setEditForms(forms)
    setInitialized(true)
  }

  const handleInputChange = (depto, field, value) => {
    setEditForms((prev) => ({
      ...prev,
      [depto]: {
        ...(prev[depto] || {}),
        [field]: value,
      },
    }))
  }

  const handleSave = async (depto) => {
    const form = editForms[depto]
    if (!form) return

    setSavingDepto(depto)
    setSaveMessages((prev) => ({ ...prev, [depto]: null }))

    try {
      await actualizarDepto(depto, form.nombre, form.telefono, form.activo, adminPassword)
      setSaveMessages((prev) => ({
        ...prev,
        [depto]: { type: 'success', text: 'Guardado.' },
      }))
      setTimeout(() => {
        setSaveMessages((prev) => ({ ...prev, [depto]: null }))
      }, 3000)
      refetchDeptos()
    } catch (err) {
      setSaveMessages((prev) => ({
        ...prev,
        [depto]: { type: 'error', text: err.message || 'Error al guardar.' },
      }))
    } finally {
      setSavingDepto(null)
    }
  }

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <p>Cargando departamentos...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-message">
        <p>{error}</p>
        <button className="btn btn--primary" onClick={refetchDeptos}>Reintentar</button>
      </div>
    )
  }

  return (
    <div className="gestionar-deptos">
      {refreshing && <div className="refreshing-bar" />}

      <h3>Departamentos</h3>
      <div className="tabla-deptos-wrapper">
        <table className="tabla-deptos">
          <thead>
            <tr>
              <th># Depto</th>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Activo</th>
              <th>Saldo a Favor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {departamentos.map((dept) => {
              const form = editForms[dept.depto] || {}
              const isSaving = savingDepto === dept.depto
              const msg = saveMessages[dept.depto]

              return (
                <tr key={dept.depto}>
                  <td>{dept.depto}</td>
                  <td>
                    <input
                      type="text"
                      value={form.nombre ?? ''}
                      onChange={(e) =>
                        handleInputChange(dept.depto, 'nombre', e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="Nombre del residente"
                      className="input-sm"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={form.telefono ?? ''}
                      onChange={(e) =>
                        handleInputChange(dept.depto, 'telefono', e.target.value)
                      }
                      disabled={isSaving}
                      placeholder="Teléfono"
                      className="input-sm"
                    />
                  </td>
                  <td>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={form.activo ?? true}
                        onChange={(e) =>
                          handleInputChange(dept.depto, 'activo', e.target.checked)
                        }
                        disabled={isSaving}
                      />
                      {form.activo ? 'Sí' : 'No'}
                    </label>
                  </td>
                  <td>{formatPesos(dept.saldoFavor || 0)}</td>
                  <td>
                    <button
                      className="btn btn--sm btn--primary"
                      onClick={() => handleSave(dept.depto)}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                    {msg && (
                      <div className={`form-message form-message--${msg.type} form-message--inline`}>
                        {msg.text}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* --- Tab: Comprobantes --- */
function TabComprobantes() {
  const fetchHistorico = useCallback(() => getHistorico().catch(() => []), [])
  const fetchCobroActual = useCallback(() => getCobroActual().catch(() => null), [])

  const {
    data: historicoRaw,
    loading: loadingH,
    refreshing: refreshingH,
    error: errorH,
  } = useCachedData(CACHE_KEYS.historico, fetchHistorico)

  const {
    data: cobroActualData,
    loading: loadingCA,
    refreshing: refreshingCA,
  } = useCachedData(CACHE_KEYS.cobroActual, fetchCobroActual)

  const loading = loadingH || loadingCA
  const refreshing = refreshingH || refreshingCA

  // Build cobros list
  const cobros = (() => {
    let allCobros = Array.isArray(historicoRaw)
      ? [...historicoRaw]
      : [...(historicoRaw?.cobros || [])]

    if (cobroActualData) {
      const currentId = cobroActualData.id || cobroActualData.cobroId
      const alreadyExists = allCobros.some(
        (c) => (c.id || c.cobroId) === currentId
      )
      if (!alreadyExists) {
        allCobros.unshift(cobroActualData)
      }
    }

    allCobros.sort((a, b) => (b.mes || '').localeCompare(a.mes || ''))
    return allCobros
  })()

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <p>Cargando comprobantes...</p>
      </div>
    )
  }

  if (errorH) {
    return (
      <div className="error-message">
        <p>{errorH}</p>
      </div>
    )
  }

  // Collect all comprobantes from all cobros
  const comprobantes = []
  cobros.forEach((cobro) => {
    const pagos = cobro.pagos || []
    pagos.forEach((pago) => {
      if (pago.comprobante || pago.comprobanteUrl) {
        comprobantes.push({
          mes: cobro.mes,
          depto: pago.depto,
          url: pago.comprobanteUrl || pago.comprobante,
          nombreArchivo: pago.nombreArchivo || 'Comprobante',
        })
      }
    })
  })

  if (comprobantes.length === 0) {
    return (
      <div className="empty-state">
        {refreshing && <div className="refreshing-bar" />}
        <p>No hay comprobantes subidos.</p>
      </div>
    )
  }

  return (
    <div className="comprobantes-list">
      {refreshing && <div className="refreshing-bar" />}

      <h3>Comprobantes Subidos</h3>
      <div className="tabla-deptos-wrapper">
        <table className="tabla-deptos">
          <thead>
            <tr>
              <th>Mes</th>
              <th>Depto</th>
              <th>Archivo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {comprobantes.map((comp, index) => (
              <tr key={`${comp.mes}-${comp.depto}-${index}`}>
                <td>{formatMesAnio(comp.mes)}</td>
                <td>{comp.depto}</td>
                <td>{comp.nombreArchivo}</td>
                <td>
                  <a
                    href={comp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--sm btn--secondary"
                  >
                    Ver Comprobante
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Admin
