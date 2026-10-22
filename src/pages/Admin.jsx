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
  getHistoricoSnapshots,
  guardarHistorico,
  registrarDeposito,
  getWhatsappTemplate,
  saveWhatsappTemplate,
} from '../api/sheets'
import { formatPesos, formatMesAnio } from '../utils/format'
import { PLANTILLA_DEFAULT, VARIABLES_WHATSAPP, renderMensaje } from '../utils/whatsapp'

const TABS = [
  { key: 'crear', label: 'Crear Cobro' },
  { key: 'pagos', label: 'Gestionar Pagos' },
  { key: 'deptos', label: 'Gestionar Departamentos' },
  { key: 'depositos', label: 'Depósitos' },
  { key: 'whatsapp', label: 'Mensaje WhatsApp' },
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
        {activeTab === 'depositos' && <TabDepositos adminPassword={adminPassword} />}
        {activeTab === 'whatsapp' && <TabMensajeWhatsapp adminPassword={adminPassword} />}
      </div>
    </div>
  )
}

/* --- Tab: Crear Cobro + Mes Activo --- */
function TabCrearCobro({ adminPassword }) {
  const [activating, setActivating] = useState(null)
  const [activateMsg, setActivateMsg] = useState(null)
  const [submitting, setSubmitting] = useState(null)

  const fetchHistorico = useCallback(() => getHistorico().catch(() => []), [])
  const {
    data: historicoRaw,
    loading,
    refetch: refetchH,
  } = useCachedData(CACHE_KEYS.historico, fetchHistorico)

  const fetchSnapshots = useCallback(() => getHistoricoSnapshots().catch(() => []), [])
  const { data: snapshotsRaw, refetch: refetchS } = useCachedData(
    CACHE_KEYS.historicoSnapshots,
    fetchSnapshots,
  )
  const snapshotIds = (snapshotsRaw || []).map(String)

  const handleSubmit = async (cobroId, mes) => {
    setSubmitting(cobroId)
    setActivateMsg(null)
    try {
      await guardarHistorico(cobroId, adminPassword)
      setActivateMsg({ type: 'success', text: `Histórico de ${formatMesAnio(mes)} guardado.` })
      refetchS()
    } catch (err) {
      setActivateMsg({ type: 'error', text: err.message || 'Error al guardar el histórico.' })
      refetchS()
    } finally {
      setSubmitting(null)
    }
  }

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
                  const hasSnapshot = snapshotIds.includes(String(cobroId))
                  const isSubmitting = submitting === cobroId

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
                        )}{' '}
                        <button
                          className="btn btn--sm btn--primary"
                          onClick={() => handleSubmit(cobroId, cobro.mes)}
                          disabled={hasSnapshot || isSubmitting}
                          title={hasSnapshot ? 'Este mes ya tiene un histórico guardado' : undefined}
                        >
                          {isSubmitting ? 'Guardando...' : 'Submit'}
                        </button>
                        {hasSnapshot && (
                          <span className="text-muted" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}>
                            Histórico ya guardado
                          </span>
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

/* --- Tab: Depósitos adelantados --- */

function TabDepositos({ adminPassword }) {
  const [depto, setDepto] = useState('')
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState(null)

  const fetchDeptos = useCallback(() => getDepartamentos(), [])

  const {
    data: deptosRaw,
    loading,
    refreshing,
    error,
    refetch: refetchDeptos,
  } = useCachedData(CACHE_KEYS.departamentos, fetchDeptos)

  const departamentos = Array.isArray(deptosRaw) ? deptosRaw : (deptosRaw?.departamentos || [])
  const deptoSel = departamentos.find((d) => String(d.depto) === String(depto))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage(null)

    if (!depto) {
      setMessage({ type: 'error', text: 'Selecciona un departamento.' })
      return
    }
    const montoNum = Number(monto)
    if (!monto || isNaN(montoNum) || montoNum <= 0) {
      setMessage({ type: 'error', text: 'Ingresa un monto mayor a cero.' })
      return
    }

    setSubmitting(true)
    try {
      const result = await registrarDeposito(depto, montoNum, nota.trim(), adminPassword)
      const nuevo = result?.nuevoSaldoFavor
      setMessage({
        type: 'success',
        text: `Depósito de ${formatPesos(montoNum)} registrado para el depto ${depto}.` +
          (nuevo !== undefined ? ` Nuevo saldo a favor: ${formatPesos(nuevo)}.` : ''),
      })
      setMonto('')
      setNota('')
      refetchDeptos()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Error al registrar el depósito.' })
    } finally {
      setSubmitting(false)
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
    <div className="nuevo-cobro">
      {refreshing && <div className="refreshing-bar" />}
      <h3>Registrar Depósito Adelantado</h3>
      <form onSubmit={handleSubmit} className="nuevo-cobro-form">
        <div className="form-group">
          <label htmlFor="deposito-depto">Departamento:</label>
          <select
            id="deposito-depto"
            value={depto}
            onChange={(e) => setDepto(e.target.value)}
            disabled={submitting}
          >
            <option value="">Selecciona...</option>
            {departamentos.map((d) => (
              <option key={d.depto} value={d.depto}>
                {d.depto}{d.nombre ? ` - ${d.nombre}` : ''}
              </option>
            ))}
          </select>
          {deptoSel && (
            <small>Saldo a favor actual: {formatPesos(deptoSel.saldoFavor || 0)}</small>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="deposito-monto">Monto ($):</label>
          <input
            id="deposito-monto"
            type="number"
            min="0"
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            placeholder="Ej: 350.00"
            disabled={submitting}
          />
        </div>

        <div className="form-group">
          <label htmlFor="deposito-nota">Nota (opcional):</label>
          <input
            id="deposito-nota"
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: Adelanto de 2 meses"
            disabled={submitting}
          />
        </div>

        {message && (
          <div className={`form-message form-message--${message.type}`}>
            {message.text}
          </div>
        )}

        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Registrando...' : 'Registrar Depósito'}
        </button>
      </form>
    </div>
  )
}

/* --- Tab: Mensaje WhatsApp --- */

const VALORES_EJEMPLO = {
  nombre: 'Juan Pérez',
  depto: 3,
  mes: '2025-03',
  adeudoMesActual: 350,
  adeudoMesesPasados: 700,
  saldoFavor: 200,
}

function TabMensajeWhatsapp({ adminPassword }) {
  const [plantilla, setPlantilla] = useState(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  const fetchPlantilla = useCallback(() => getWhatsappTemplate(), [])

  const {
    data: guardada,
    loading,
    refreshing,
    error,
    refetch,
  } = useCachedData(CACHE_KEYS.whatsappTemplate, fetchPlantilla)

  // Valor mostrado: lo editado, o lo guardado, o el default
  const valorGuardado = typeof guardada === 'string' && guardada ? guardada : PLANTILLA_DEFAULT
  const texto = plantilla ?? valorGuardado

  const handleGuardar = async () => {
    setMessage(null)
    if (!texto.trim()) {
      setMessage({ type: 'error', text: 'La plantilla no puede estar vacía.' })
      return
    }
    setSaving(true)
    try {
      await saveWhatsappTemplate(texto, adminPassword)
      setMessage({ type: 'success', text: 'Plantilla guardada correctamente.' })
      setPlantilla(null)
      refetch()
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Error al guardar la plantilla.' })
    } finally {
      setSaving(false)
    }
  }

  const handleRestaurar = () => {
    setMessage(null)
    setPlantilla(PLANTILLA_DEFAULT)
  }

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <p>Cargando plantilla...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-message">
        <p>{error}</p>
        <button className="btn btn--primary" onClick={refetch}>Reintentar</button>
      </div>
    )
  }

  return (
    <div className="nuevo-cobro">
      {refreshing && <div className="refreshing-bar" />}
      <h3>Mensaje de WhatsApp</h3>

      <div className="form-group">
        <label htmlFor="whatsapp-plantilla">Plantilla:</label>
        <textarea
          id="whatsapp-plantilla"
          rows={5}
          value={texto}
          onChange={(e) => setPlantilla(e.target.value)}
          disabled={saving}
          style={{ width: '100%' }}
        />
      </div>

      <div className="form-group">
        <label>Variables disponibles:</label>
        <ul>
          {VARIABLES_WHATSAPP.map((v) => (
            <li key={v.variable}>
              <code>{v.variable}</code> — {v.descripcion}
            </li>
          ))}
        </ul>
      </div>

      <div className="form-group">
        <label>Vista previa (con valores de ejemplo):</label>
        <p style={{ whiteSpace: 'pre-wrap' }}>{renderMensaje(texto, VALORES_EJEMPLO)}</p>
      </div>

      {message && (
        <div className={`form-message form-message--${message.type}`}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn--primary" onClick={handleGuardar} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button className="btn" onClick={handleRestaurar} disabled={saving}>
          Restaurar plantilla por defecto
        </button>
      </div>
    </div>
  )
}

export default Admin
