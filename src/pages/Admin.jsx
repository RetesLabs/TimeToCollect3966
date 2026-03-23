import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import LoginModal from '../components/LoginModal'
import NuevoCobro from '../components/NuevoCobro'
import { CACHE_KEYS } from '../api/cache'
import useCachedData from '../hooks/useCachedData'
import {
  getDepartamentos,
  getHistorico,
  getCobroActual,
  registrarPago,
  actualizarDepto,
  activarMes,
} from '../api/sheets'
import { formatPesos, formatMesAnio } from '../utils/format'

const TABS = [
  { key: 'crear', label: 'Crear Cobro' },
  { key: 'pagos', label: 'Gestionar Pagos' },
  { key: 'deptos', label: 'Gestionar Departamentos' },
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
        {activeTab === 'crear' && <TabCrearCobro adminPassword={adminPassword} />}
        {activeTab === 'pagos' && <TabGestionarPagos adminPassword={adminPassword} />}
        {activeTab === 'deptos' && <TabGestionarDeptos adminPassword={adminPassword} />}
      </div>
    </div>
  )
}

/* --- Tab: Crear Cobro + Mes Activo --- */
function TabCrearCobro({ adminPassword }) {
  const [activating, setActivating] = useState(null)
  const [activateMsg, setActivateMsg] = useState(null)

  const fetchHistorico = useCallback(() => getHistorico().catch(() => []), [])
  const {
    data: historicoRaw,
    loading,
    refetch: refetchH,
  } = useCachedData(CACHE_KEYS.historico, fetchHistorico)

  const cobros = (() => {
    if (!historicoRaw) return []
    const list = Array.isArray(historicoRaw) ? historicoRaw : (historicoRaw.cobros || [])
    return [...list].sort((a, b) => (b.mes || '').localeCompare(a.mes || ''))
  })()

  const handleActivar = async (cobroId, mes) => {
    setActivating(cobroId)
    setActivateMsg(null)
    try {
      await activarMes(cobroId, adminPassword)
      setActivateMsg({ type: 'success', text: `${formatMesAnio(mes)} activado.` })
      refetchH()
    } catch (err) {
      setActivateMsg({ type: 'error', text: err.message || 'Error al activar mes.' })
    } finally {
      setActivating(null)
    }
  }

  return (
    <div>
      <NuevoCobro onSuccess={() => refetchH()} />

      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>Mes Activo</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)', marginBottom: '0.75rem' }}>
          El mes activo es el que se muestra en la pantalla principal. Solo un mes puede estar activo a la vez.
        </p>

        {activateMsg && (
          <div className={`form-message form-message--${activateMsg.type}`} style={{ marginBottom: '0.75rem' }}>
            {activateMsg.text}
          </div>
        )}

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /><p>Cargando...</p></div>
        ) : cobros.length === 0 ? (
          <p className="text-muted">No hay cobros creados.</p>
        ) : (
          <div className="tabla-deptos-wrapper">
            <table className="tabla-deptos">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Monto Base</th>
                  <th>Mes Activo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cobros.map((cobro) => {
                  const cobroId = cobro.id || cobro.cobroId
                  const isActive = cobro.mesActivo === true || cobro.mesActivo === 'true'
                  const isActivating = activating === cobroId

                  return (
                    <tr key={cobroId}>
                      <td style={{ fontWeight: isActive ? 700 : 400 }}>
                        {formatMesAnio(cobro.mes)}
                      </td>
                      <td>{formatPesos(cobro.montoBase)}</td>
                      <td>
                        {isActive ? (
                          <span className="badge badge--paid">Activo</span>
                        ) : (
                          <span className="badge badge--inactive">Inactivo</span>
                        )}
                      </td>
                      <td>
                        {!isActive && (
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => handleActivar(cobroId, cobro.mes)}
                            disabled={isActivating}
                          >
                            {isActivating ? 'Activando...' : 'Activar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
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

  const montoBase = selectedCobro ? (selectedCobro.montoBase || 0) : 0

  const handlePagoInputChange = (depto, field, value) => {
    setPagoForms((prev) => {
      const current = prev[depto] || {}
      const updated = { ...current, [field]: value }

      // Auto-calculate montoAdeudo when montoPagado or saldoFavorUsado changes
      if (field === 'montoPagado' || field === 'saldoFavorUsado') {
        const pagado = parseFloat(field === 'montoPagado' ? value : (current.montoPagado || 0)) || 0
        const sfUsado = parseFloat(field === 'saldoFavorUsado' ? value : (current.saldoFavorUsado || 0)) || 0
        const adeudo = Math.max(0, montoBase - pagado - sfUsado)
        updated.montoAdeudo = adeudo > 0 ? String(adeudo) : '0'

        // Auto-set status
        if (pagado + sfUsado > montoBase) {
          updated.status = 'adelanto'
        } else {
          updated.status = updated.status === 'adelanto' ? 'pagado' : (current.status || 'pagado')
        }
      }

      return { ...prev, [depto]: updated }
    })
  }

  const handleStatusChange = (depto, value) => {
    setPagoForms((prev) => ({
      ...prev,
      [depto]: { ...(prev[depto] || {}), status: value },
    }))
  }

  // Quick fill: set montoPagado = montoBase for a depto
  const handleQuickFill = (depto, saldoFavor) => {
    const sfUsado = saldoFavor > 0 ? Math.min(saldoFavor, montoBase) : 0
    const montoPagado = montoBase - sfUsado
    const adeudo = 0
    setPagoForms((prev) => ({
      ...prev,
      [depto]: {
        montoPagado: String(montoPagado),
        montoAdeudo: '0',
        saldoFavorUsado: sfUsado > 0 ? String(sfUsado) : '0',
        status: 'pagado',
      },
    }))
  }

  const handleRegistrarPago = async (dept) => {
    const form = pagoForms[dept.depto] || {}
    const montoPagado = parseFloat(form.montoPagado) || 0
    const montoAdeudo = parseFloat(form.montoAdeudo) || 0
    const saldoFavorUsado = parseFloat(form.saldoFavorUsado) || 0
    const status = form.status || 'pagado'

    if (montoPagado <= 0 && saldoFavorUsado <= 0) {
      setSaveMessage({ depto: dept.depto, type: 'error', text: 'Ingresa un monto pagado.' })
      return
    }

    setSavingDepto(dept.depto)
    setSaveMessage(null)

    try {
      await registrarPago(
        effectiveCobroId,
        dept.depto,
        montoPagado,
        montoAdeudo,
        saldoFavorUsado,
        adminPassword,
        status
      )
      setSaveMessage({ depto: dept.depto, type: 'success', text: 'Pago registrado.' })
      // Clear form for this depto
      setPagoForms((prev) => ({ ...prev, [dept.depto]: {} }))
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
                  <th>Saldo a Favor</th>
                  <th>Estado Actual</th>
                  <th>Monto Pagado</th>
                  <th>Adeudo</th>
                  <th>Saldo Favor Usado</th>
                  <th>Tipo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {departamentos.map((dept) => {
                  const pagos = selectedCobro.pagos || []
                  const deptoDetalle = (selectedCobro.departamentos || []).find(
                    (d) => Number(d.depto) === Number(dept.depto)
                  )
                  const pagoExistente = deptoDetalle || pagos.find((p) => Number(p.depto) === Number(dept.depto))
                  const form = pagoForms[dept.depto] || {}
                  const isSaving = savingDepto === dept.depto
                  const msg =
                    saveMessage && saveMessage.depto === dept.depto ? saveMessage : null
                  const saldoFavor = Number(dept.saldoFavor) || 0
                  const statusActual = pagoExistente?.status || 'pendiente'

                  return (
                    <tr
                      key={dept.depto}
                      className={!dept.activo ? 'tabla-deptos-row--inactive' : ''}
                    >
                      <td>{dept.depto}</td>
                      <td>{dept.nombre || '—'}</td>
                      <td>
                        {saldoFavor > 0 ? (
                          <span className="badge badge--advance">{formatPesos(saldoFavor)}</span>
                        ) : (
                          <span className="text-muted">$0</span>
                        )}
                      </td>
                      <td>
                        {statusActual === 'pagado' && (
                          <span className="badge badge--paid">
                            Pagado {formatPesos(pagoExistente?.montoPagado || 0)}
                          </span>
                        )}
                        {statusActual === 'adelanto' && (
                          <span className="badge badge--advance">
                            Adelanto {formatPesos(pagoExistente?.montoPagado || 0)}
                          </span>
                        )}
                        {statusActual === 'pendiente' && (
                          <span className="badge badge--pending">Pendiente</span>
                        )}
                        {pagoExistente && Number(pagoExistente.montoAdeudo) > 0 && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-danger)', marginTop: 2 }}>
                            Adeudo: {formatPesos(pagoExistente.montoAdeudo)}
                          </div>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder={String(montoBase)}
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
                          placeholder="auto"
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
                          max={saldoFavor}
                          step="0.01"
                          placeholder="0"
                          value={form.saldoFavorUsado ?? ''}
                          onChange={(e) =>
                            handlePagoInputChange(dept.depto, 'saldoFavorUsado', e.target.value)
                          }
                          disabled={isSaving || !dept.activo || saldoFavor <= 0}
                          className="input-sm"
                        />
                      </td>
                      <td>
                        <select
                          value={form.status || 'pagado'}
                          onChange={(e) => handleStatusChange(dept.depto, e.target.value)}
                          disabled={isSaving || !dept.activo}
                          className="input-sm"
                          style={{ width: '90px' }}
                        >
                          <option value="pagado">Pagado</option>
                          <option value="adelanto">Adelanto</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.3rem', flexDirection: 'column' }}>
                          <button
                            className="btn btn--sm btn--secondary"
                            onClick={() => handleQuickFill(dept.depto, saldoFavor)}
                            disabled={isSaving || !dept.activo}
                            title="Llenar con monto base completo"
                          >
                            Pago completo
                          </button>
                          <button
                            className="btn btn--sm btn--primary"
                            onClick={() => handleRegistrarPago(dept)}
                            disabled={isSaving || !dept.activo}
                          >
                            {isSaving ? 'Guardando...' : 'Registrar'}
                          </button>
                        </div>
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

export default Admin
