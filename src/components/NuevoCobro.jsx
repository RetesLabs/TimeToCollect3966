import { useState } from 'react'
import { crearCobro } from '../api/sheets'
import { useAuth } from '../context/AuthContext'

/**
 * Formulario para crear un nuevo cobro mensual.
 *
 * Props:
 * - onSuccess: () => void - callback tras crear exitosamente
 */
function NuevoCobro({ onSuccess }) {
  const { adminPassword } = useAuth()

  // Default to current month in YYYY-MM format
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [mes, setMes] = useState(currentMonth)
  const [montoBase, setMontoBase] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!mes) {
      setMessage({ type: 'error', text: 'Selecciona el mes.' })
      return
    }

    const monto = parseFloat(montoBase)
    if (!montoBase || isNaN(monto) || monto <= 0) {
      setMessage({ type: 'error', text: 'Ingresa un monto base válido mayor a 0.' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      await crearCobro(mes, monto, adminPassword)
      setMessage({ type: 'success', text: `Cobro para ${mes} creado exitosamente.` })
      setMontoBase('')
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Error al crear el cobro. Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="nuevo-cobro">
      <h3>Crear Nuevo Cobro</h3>
      <form onSubmit={handleSubmit} className="nuevo-cobro-form">
        <div className="form-group">
          <label htmlFor="cobro-mes">Mes:</label>
          <input
            id="cobro-mes"
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="cobro-monto">Monto Base ($):</label>
          <input
            id="cobro-monto"
            type="number"
            min="0"
            step="0.01"
            value={montoBase}
            onChange={(e) => setMontoBase(e.target.value)}
            placeholder="Ej: 350.00"
            disabled={loading}
          />
        </div>

        {message && (
          <div className={`form-message form-message--${message.type}`}>
            {message.text}
          </div>
        )}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={loading}
        >
          {loading ? 'Creando...' : 'Crear Cobro'}
        </button>
      </form>
    </div>
  )
}

export default NuevoCobro
