import { useState, useRef } from 'react'
import { subirComprobante } from '../api/sheets'

/**
 * Modal para subir comprobante de pago.
 *
 * Props:
 * - cobroId: string - ID del cobro actual
 * - depto: number - número de departamento
 * - mes: string - nombre del mes para mostrar en el encabezado
 * - onClose: () => void
 * - onSuccess: () => void - callback tras subir exitosamente
 */
function ModalComprobante({ cobroId, depto, mes, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setMessage(null)

    // Generate image preview
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(selected)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!file) {
      setMessage({ type: 'error', text: 'Selecciona una imagen primero.' })
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      await subirComprobante(cobroId, depto, file)
      setMessage({ type: 'success', text: 'Comprobante subido correctamente.' })
      if (onSuccess) {
        setTimeout(onSuccess, 1500)
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Error al subir el comprobante. Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>Subir Comprobante</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
            &times;
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-info">
            <strong>Departamento:</strong> {depto}
            {mes && (
              <>
                {' — '}
                <strong>Mes:</strong> {mes}
              </>
            )}
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="comprobante-file">Imagen del comprobante:</label>
              <input
                ref={fileInputRef}
                id="comprobante-file"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>

            {preview && (
              <div className="comprobante-preview">
                <img src={preview} alt="Vista previa del comprobante" />
              </div>
            )}

            {message && (
              <div className={`form-message form-message--${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={onClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={loading || !file}
              >
                {loading ? 'Subiendo...' : 'Subir Comprobante'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default ModalComprobante
