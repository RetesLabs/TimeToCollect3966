import { createContext, useContext, useState, useCallback } from 'react'
import { login as apiLogin } from '../api/sheets'

const AuthContext = createContext(null)

const SESSION_KEY = 'cuotas3966_admin'

export function AuthProvider({ children }) {
  const [adminPassword, setAdminPassword] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_KEY) || null
    } catch {
      return null
    }
  })

  const isAdmin = Boolean(adminPassword)

  const login = useCallback(async (password) => {
    try {
      const result = await apiLogin(password)

      if (result.success) {
        setAdminPassword(password)
        try {
          sessionStorage.setItem(SESSION_KEY, password)
        } catch {
          // sessionStorage might not be available
        }
        return { success: true }
      }

      return { success: false, error: 'Contraseña incorrecta' }
    } catch (error) {
      return { success: false, error: error.message || 'Error al verificar contraseña' }
    }
  }, [])

  const logout = useCallback(() => {
    setAdminPassword(null)
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // sessionStorage might not be available
    }
  }, [])

  const value = {
    isAdmin,
    adminPassword,
    login,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider')
  }
  return context
}

export default AuthContext
