import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FaBell,
  FaClipboardList,
  FaClockRotateLeft,
  FaFileArrowUp,
  FaFileInvoiceDollar,
  FaFileLines,
  FaHeartPulse,
  FaImage,
  FaRoad,
  FaRoute,
  FaSliders,
  FaTriangleExclamation,
  FaUser,
  FaUsers,
} from 'react-icons/fa6'
import {
  BRAND_IMG_DARK,
  BRAND_IMG_LIGHT,
  BRAND_NAME_LONG,
  BRAND_NAME_SHORT,
} from '../../constants/brand.js'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { getNavFlags } from '../../utils/navAccess.js'

function useThemeDark() {
  const [themeDark, setThemeDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  )
  useEffect(() => {
    const el = document.documentElement
    const sync = () =>
      setThemeDark(el.getAttribute('data-theme') === 'dark')
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return themeDark
}

/** Definición de accesos: mismo orden lógico que el menú lateral + alertas (ruta /alertas). */
const SHORTCUT_DEFS = [
  {
    id: 'notas',
    to: ROUTES.notasCredito,
    title: 'Notas de crédito',
    description: 'Listado principal de notas.',
    icon: FaFileInvoiceDollar,
    show: () => true,
  },
  {
    id: 'enlaces-imagenes',
    to: ROUTES.enlacesImagenes,
    title: 'Enlaces imágenes',
    description: 'Comprimir, subir a Cloudinary y copiar enlaces.',
    icon: FaImage,
    show: () => true,
  },
  {
    id: 'seguimiento',
    to: ROUTES.seguimiento,
    title: 'Seguimiento',
    description: 'Seguimiento de notas y estados.',
    icon: FaRoute,
    show: (f) => f.canSeguimiento,
  },
  {
    id: 'reporte',
    to: ROUTES.reporte,
    title: 'Reporte',
    description: 'Reportes y vistas resumidas.',
    icon: FaFileLines,
    show: (f) => f.canCredito,
  },
  {
    id: 'alertas',
    to: ROUTES.alertas,
    title: 'Alertas',
    description: 'Alertas del equipo de crédito.',
    icon: FaTriangleExclamation,
    show: (f) => f.canCredito,
  },
  {
    id: 'importar',
    to: ROUTES.importarReporte,
    title: 'Importar reporte',
    description: 'Carga de archivos e importación.',
    icon: FaFileArrowUp,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'historial-import',
    to: ROUTES.historialImportaciones,
    title: 'Historial importaciones',
    description: 'Importaciones anteriores.',
    icon: FaClockRotateLeft,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'usuarios',
    to: ROUTES.usuarios,
    title: 'Usuarios',
    description: 'Usuarios y roles.',
    icon: FaUsers,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'rutas',
    to: ROUTES.rutas,
    title: 'Rutas',
    description: 'Catálogo de rutas.',
    icon: FaRoad,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'rutas-sin',
    to: ROUTES.rutasSinAsignarVendedor,
    title: 'Rutas sin asignar',
    description: 'Rutas sin vendedor asignado.',
    icon: FaTriangleExclamation,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'parametros',
    to: ROUTES.parametros,
    title: 'Parámetros',
    description: 'Ajustes del sistema.',
    icon: FaSliders,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'logs',
    to: ROUTES.logsSistema,
    title: 'Logs del sistema',
    description: 'Registros y diagnóstico.',
    icon: FaClipboardList,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'whatsapp',
    to: ROUTES.whatsappCobranza,
    title: 'WhatsApp cobranza',
    description: 'Integración de mensajes.',
    icon: FaBell,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'healthz',
    to: ROUTES.healthz,
    title: 'Estado del sistema',
    description: 'Salud y conexión a servicios.',
    icon: FaHeartPulse,
    show: (f) => f.canAccessAdminPanel,
  },
  {
    id: 'perfil',
    to: ROUTES.perfil,
    title: 'Mi perfil',
    description: 'Datos de cuenta.',
    icon: FaUser,
    show: () => true,
  },
  {
    id: 'notificaciones',
    to: ROUTES.notificaciones,
    title: 'Notificaciones',
    description: 'Avisos y mensajes.',
    icon: FaBell,
    show: () => true,
  },
]

function ShortcutCard({ to, icon: Icon, title, description }) {
  return (
    <div className="col-sm-6 col-xl-4">
      <Link
        to={to}
        className="text-decoration-none d-block h-100 rounded-3 border shadow-sm home-shortcut-card p-3 bg-body"
      >
        <div className="d-flex align-items-start gap-3">
          <span
            className="rounded-3 d-inline-flex align-items-center justify-content-center flex-shrink-0 home-shortcut-icon text-primary"
            aria-hidden="true"
          >
            <Icon size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="h6 mb-1 text-body">{title}</h2>
            <p className="small text-body-secondary mb-0">{description}</p>
          </div>
        </div>
      </Link>
    </div>
  )
}

export default function PaginaPrincipalPage() {
  const { user } = useAuth()
  const themeDark = useThemeDark()
  const brandImg = themeDark ? BRAND_IMG_DARK : BRAND_IMG_LIGHT

  const displayName =
    (user?.nombreCompleto && String(user.nombreCompleto).trim()) ||
    user?.username ||
    'Usuario'

  const { canCredito, canSeguimiento, canAccessAdminPanel } = getNavFlags(user)
  const shortcuts = useMemo(
    () =>
      SHORTCUT_DEFS.filter((s) =>
        s.show({ canCredito, canSeguimiento, canAccessAdminPanel }),
      ),
    [canCredito, canSeguimiento, canAccessAdminPanel],
  )

  return (
    <section className="container-fluid px-0">
      <style>{`
        .home-shortcut-card {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .home-shortcut-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.08) !important;
        }
        [data-theme="dark"] .home-shortcut-card:hover {
          box-shadow: 0 0.5rem 1.25rem rgba(0, 0, 0, 0.35) !important;
        }
        .home-shortcut-icon {
          width: 2.75rem;
          height: 2.75rem;
          background: color-mix(in srgb, var(--bs-primary) 12%, transparent);
        }
      `}</style>

      <div className="card border-0 shadow-sm overflow-hidden mb-4">
        <div className="card-body p-4 p-md-5">
          <div className="row align-items-center g-4">
            <div className="col-md-auto text-center text-md-start">
              <img
                src={brandImg}
                alt={`${BRAND_NAME_SHORT} — ${BRAND_NAME_LONG}`}
                className="img-fluid rounded d-block mx-auto mx-md-0"
                style={{ maxHeight: '12rem', width: 'auto', objectFit: 'contain' }}
                decoding="async"
              />
            </div>
            <div className="col">
              <p className="text-body-secondary small text-uppercase letter-spacing mb-2 mb-md-1">
                Inicio
              </p>
              <h1 className="h3 mb-2">Hola, {displayName}</h1>
              <p className="text-body-secondary mb-3 mb-md-2">
                <strong>{BRAND_NAME_SHORT}</strong> — {BRAND_NAME_LONG}. Abajo solo aparecen enlaces a
                secciones que tu usuario puede usar (mismas reglas que el menú lateral).
              </p>
              {canAccessAdminPanel ? (
                <p className="small text-body-secondary mb-0">
                  Para revisar conexión a base de datos y servicios:{' '}
                  <Link to={ROUTES.healthz}>Estado del sistema</Link>.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <h2 className="h5 mb-3">Accesos rápidos</h2>
      {shortcuts.length === 0 ? (
        <p className="text-body-secondary small">No hay accesos para mostrar.</p>
      ) : (
        <div className="row g-3">
          {shortcuts.map((s) => (
            <ShortcutCard
              key={s.id}
              to={s.to}
              icon={s.icon}
              title={s.title}
              description={s.description}
            />
          ))}
        </div>
      )}
    </section>
  )
}
