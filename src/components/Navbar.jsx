import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { isAdmin, logout } = useAuth()

  const toggleMenu = () => setMenuOpen((prev) => !prev)
  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <h1 className="navbar-title">Cuotas 3966</h1>
        {isAdmin && <span className="navbar-admin-badge">Admin</span>}
        <button
          className="navbar-hamburger"
          onClick={toggleMenu}
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
        >
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
        </button>
      </div>

      <ul className={`navbar-links ${menuOpen ? 'navbar-links--open' : ''}`}>
        <li>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `navbar-link ${isActive ? 'navbar-link--active' : ''}`}
            onClick={closeMenu}
          >
            Mes Actual
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/historico"
            className={({ isActive }) => `navbar-link ${isActive ? 'navbar-link--active' : ''}`}
            onClick={closeMenu}
          >
            Histórico
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/admin"
            className={({ isActive }) => `navbar-link ${isActive ? 'navbar-link--active' : ''}`}
            onClick={closeMenu}
          >
            Admin
          </NavLink>
        </li>
        {isAdmin && (
          <li>
            <button className="navbar-logout-btn" onClick={() => { logout(); closeMenu() }}>
              Cerrar sesión
            </button>
          </li>
        )}
      </ul>
    </nav>
  )
}

export default Navbar
