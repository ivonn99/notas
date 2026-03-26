import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  FaBars,
  FaBell,
  FaClipboardList,
  FaClockRotateLeft,
  FaFileArrowUp,
  FaFileInvoiceDollar,
  FaFileLines,
  FaHeartPulse,
  FaHouse,
  FaMoon,
  FaRoad,
  FaRightFromBracket,
  FaRoute,
  FaSliders,
  FaSun,
  FaTriangleExclamation,
  FaUser,
  FaUsers,
} from 'react-icons/fa6'
import { ROUTES } from '../constants/routes.js'
import { useAuth } from '../contexts/AuthContext.jsx'
import { notificacionesApi } from '../services/notificacionesApi.js'

const navLinkClass = ({ isActive }) =>
  `nav-link py-1 px-2 rounded d-flex align-items-center position-relative${isActive ? ' active' : ''}`

function NavIcon({ children, className = '' }) {
  return (
    <span
      className={`sidebar-nav-icon d-inline-flex align-items-center justify-content-center me-2 flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}

/**
 * Menú lateral alineado a guia.txt (visibilidad por rol).
 */
export default function MainLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [notifTotal, setNotifTotal] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [theme, setTheme] = useState('light')
  const [viewportLg, setViewportLg] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 992px)').matches,
  )

  const isAdmin = user.isSuperuser || user.rol === 'ADMIN'
  const canCredito =
    user.isSuperuser || ['ADMIN', 'CREDITO'].includes(user.rol)
  const canSeguimiento =
    user.isSuperuser || ['ADMIN', 'CREDITO', 'VENDEDOR'].includes(user.rol)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 992px)')
    function syncViewport() {
      setViewportLg(mq.matches)
    }
    syncViewport()
    mq.addEventListener('change', syncViewport)
    return () => mq.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    const savedTheme = localStorage.getItem('nc_theme')
    const nextTheme = savedTheme === 'dark' ? 'dark' : 'light'
    setTheme(nextTheme)
    document.documentElement.setAttribute('data-theme', nextTheme)
    document.documentElement.setAttribute('data-bs-theme', nextTheme)
  }, [])

  useEffect(() => {
    const savedCollapsed = localStorage.getItem('nc_sidebar_collapsed')
    setSidebarCollapsed(savedCollapsed === '1')
  }, [])

  useEffect(() => {
    localStorage.setItem('nc_sidebar_collapsed', sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  /** Escritorio: clic fuera del sidebar lo colapsa (solo queda la hamburguesa). */
  useEffect(() => {
    function handlePointerDown(e) {
      if (!window.matchMedia('(min-width: 992px)').matches) return
      const aside = e.target.closest('.app-sidebar')
      const toggle = e.target.closest('.app-menu-toggle')
      if (aside || toggle) return
      setSidebarCollapsed(true)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [])

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const r = await notificacionesApi.resumen()
        if (!cancel) setNotifTotal(r?.counts?.total ?? 0)
      } catch {
        if (!cancel) setNotifTotal(0)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      document.documentElement.setAttribute('data-bs-theme', next)
      localStorage.setItem('nc_theme', next)
      return next
    })
  }

  function toggleSidebar() {
    if (viewportLg) {
      setSidebarCollapsed((v) => !v)
    } else {
      setSidebarOpen((v) => !v)
    }
  }

  const menuToggleLabel = viewportLg
    ? sidebarCollapsed
      ? 'Abrir menú lateral'
      : 'Ocultar menú lateral'
    : sidebarOpen
      ? 'Cerrar menú'
      : 'Abrir menú'

  return (
    <div
      className={`app-shell d-flex flex-column min-vh-100${
        sidebarCollapsed ? ' is-sidebar-collapsed' : ''
      }`}
    >
      <header className="app-topbar border-bottom px-3 px-md-4 py-2 d-flex align-items-center justify-content-between gap-2 flex-shrink-0">
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="app-menu-toggle btn btn-sm btn-outline-secondary d-inline-flex align-items-center justify-content-center"
            onClick={toggleSidebar}
            aria-label={menuToggleLabel}
            aria-expanded={viewportLg ? !sidebarCollapsed : sidebarOpen}
          >
            <FaBars size={18} aria-hidden />
          </button>
          <div className="fw-semibold d-none d-md-inline">
            Distribuidora de Medicamentos Homeopáticos
          </div>
          <div className="fw-semibold d-inline d-md-none">DMH</div>
        </div>
        <div className="small text-body-secondary">{user?.rol}</div>
      </header>
      <div className="app-shell-body d-flex flex-grow-1 min-vh-0 position-relative">
      {sidebarOpen ? (
        <button
          className="sidebar-overlay d-lg-none"
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
        />
      ) : null}
      <aside
        className={`app-sidebar border-end flex-shrink-0 p-3 ${
          sidebarOpen ? 'is-open' : ''
        } ${sidebarCollapsed ? 'is-collapsed' : ''}`}
        aria-label="Navegación principal"
      >
        <div className="mb-3 pb-2 border-bottom border-secondary-subtle">
          <div className="fw-bold text-body">DMH</div>
          <div className="small text-body-secondary lh-sm d-none d-lg-block">
            Distribuidora de Medicamentos Homeopáticos
          </div>
        </div>
        <div className="small text-body-secondary mb-3 pb-2 border-bottom border-secondary-subtle">
          <div className="fw-semibold text-body text-truncate" title={user.username}>
            {user.nombreCompleto || user.username}
          </div>
          <div className="text-muted">{user.rol}</div>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm mt-2 w-100 d-inline-flex align-items-center justify-content-center gap-1"
            onClick={handleLogout}
            title="Cerrar sesión"
          >
            <FaRightFromBracket aria-hidden className="flex-shrink-0" />
            <span className="sidebar-btn-label">Cerrar sesión</span>
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm mt-2 w-100 d-inline-flex align-items-center justify-content-center gap-1"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          >
            {theme === 'dark' ? (
              <FaSun aria-hidden className="flex-shrink-0" />
            ) : (
              <FaMoon aria-hidden className="flex-shrink-0" />
            )}
            <span className="sidebar-btn-label">
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </span>
          </button>
        </div>
        <nav className="nav flex-column gap-1">
          <NavLink to={ROUTES.home} className={navLinkClass} end title="Inicio">
            <NavIcon>
              <FaHouse size={18} />
            </NavIcon>
            <span className="sidebar-nav-label">Inicio</span>
          </NavLink>
          <NavLink to={ROUTES.notasCredito} className={navLinkClass} title="Notas de crédito">
            <NavIcon>
              <FaFileInvoiceDollar size={18} />
            </NavIcon>
            <span className="sidebar-nav-label">Notas de crédito</span>
          </NavLink>
          {canSeguimiento ? (
            <NavLink to={ROUTES.seguimiento} className={navLinkClass} title="Seguimiento">
              <NavIcon>
                <FaRoute size={18} />
              </NavIcon>
              <span className="sidebar-nav-label">Seguimiento</span>
            </NavLink>
          ) : null}
          {canCredito ? (
            <NavLink to={ROUTES.reporte} className={navLinkClass} title="Reporte">
              <NavIcon>
                <FaFileLines size={18} />
              </NavIcon>
              <span className="sidebar-nav-label">Reporte</span>
            </NavLink>
          ) : null}
          {isAdmin ? (
            <>
              <hr className="my-2" />
              <div className="text-uppercase text-muted small fw-semibold mt-1">
                Admin
              </div>
              <NavLink to={ROUTES.importarReporte} className={navLinkClass} title="Importar reporte">
                <NavIcon>
                  <FaFileArrowUp size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">Importar reporte</span>
              </NavLink>
              <NavLink
                to={ROUTES.historialImportaciones}
                className={navLinkClass}
                title="Historial importaciones"
              >
                <NavIcon>
                  <FaClockRotateLeft size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">Historial importaciones</span>
              </NavLink>
              <NavLink to={ROUTES.usuarios} className={navLinkClass} title="Usuarios">
                <NavIcon>
                  <FaUsers size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">Usuarios</span>
              </NavLink>
              <NavLink to={ROUTES.rutas} className={navLinkClass} title="Rutas">
                <NavIcon>
                  <FaRoad size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">Rutas</span>
              </NavLink>
              <NavLink
                to={ROUTES.rutasSinAsignarVendedor}
                className={navLinkClass}
                title="Rutas sin asignar a vendedor"
              >
                <NavIcon>
                  <FaTriangleExclamation size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">Rutas sin asignar</span>
              </NavLink>
              <NavLink to={ROUTES.parametros} className={navLinkClass} title="Parámetros">
                <NavIcon>
                  <FaSliders size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">Parámetros</span>
              </NavLink>
              <NavLink to={ROUTES.logsSistema} className={navLinkClass} title="Logs">
                <NavIcon>
                  <FaClipboardList size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">Logs</span>
              </NavLink>
              <NavLink
                to={ROUTES.whatsappCobranza}
                className={navLinkClass}
                title="WhatsApp cobranza"
              >
                <NavIcon>
                  <FaBell size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">WhatsApp cobranza</span>
              </NavLink>
            </>
          ) : null}
          <hr className="my-2" />
          <div className="text-uppercase text-muted small fw-semibold mt-1">
            Cuenta
          </div>
          <NavLink to={ROUTES.perfil} className={navLinkClass} title="Perfil">
            <NavIcon>
              <FaUser size={18} />
            </NavIcon>
            <span className="sidebar-nav-label">Perfil</span>
          </NavLink>
          <NavLink
            to={ROUTES.notificaciones}
            className={({ isActive }) =>
              `${navLinkClass({ isActive })} justify-content-between gap-1`
            }
            title={
              notifTotal > 0
                ? `Notificaciones (${notifTotal} sin leer)`
                : 'Notificaciones'
            }
          >
            <span className="d-flex align-items-center min-w-0 flex-grow-1">
              <NavIcon>
                <FaBell size={18} />
              </NavIcon>
              <span className="sidebar-nav-label">Notificaciones</span>
            </span>
            {notifTotal > 0 ? (
              <span className="badge rounded-pill text-bg-danger sidebar-nav-badge flex-shrink-0">
                {notifTotal}
              </span>
            ) : null}
          </NavLink>
          {isAdmin ? (
            <>
              <hr className="my-2" />
              <NavLink to={ROUTES.healthz} className={navLinkClass} title="Healthz">
                <NavIcon>
                  <FaHeartPulse size={18} />
                </NavIcon>
                <span className="sidebar-nav-label">Healthz</span>
              </NavLink>
            </>
          ) : null}
        </nav>
      </aside>
      <main className="app-main flex-grow-1 min-w-0 d-flex flex-column">
        <section className="p-3 p-md-4 overflow-auto flex-grow-1">
          <Outlet />
        </section>
      </main>
      </div>
    </div>
  )
}
