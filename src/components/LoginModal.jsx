import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Modal de inicio de sesión para administrador.
 *
 * Props:
 * - onClose: () => void (optional) - callback al cerrar sin iniciar sesión
 */
function LoginModal({ onClose }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!password.trim()) {
      setError('Ingresa la contraseña.')
      return
    }

    setLoading(true)
    setError('')

    const result = await login(password.trim())

    if (!result.success) {
      setError(result.error || 'Contraseña incorrecta.')
      setLoading(false)
    }
    // On success, the AuthContext updates and the parent component
    // will react to the isAdmin state change — no need to close manually.
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && onClose) {
      onClose()
    }
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content modal-content--sm">
        <div className="modal-header">
          <h3>Acceso Administrador</h3>
          {onClose && (
            <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar">
              &times;
            </button>
          )}
        </div>

        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="admin-password">Contraseña:</label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa la contraseña de administrador"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="form-message form-message--error">
                {error}
              </div>
            )}

            <div className="modal-actions">
              {onClose && (
                <button
                  type="button"
                  className="btn btn--secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className="btn btn--primary"
                disabled={loading}
              >
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginModal
