import { createBrowserRouter } from 'react-router-dom'
import RequireAuth from '../components/RequireAuth.jsx'
import RequireRole from '../components/RequireRole.jsx'
import MainLayout from '../layouts/MainLayout.jsx'
import ForbiddenPage from '../pages/public/ForbiddenPage.jsx'
import HealthzPage from '../pages/public/HealthzPage.jsx'
import LoginPage from '../pages/auth/LoginPage.jsx'
import PaginaPrincipalPage from '../pages/dashboard/PaginaPrincipalPage.jsx'
import TodasLasNotasPage from '../pages/notas-credito/TodasLasNotasPage.jsx'
import SeguimientoPage from '../pages/seguimiento/SeguimientoPage.jsx'
import DetalleNotaPage from '../pages/seguimiento/DetalleNotaPage.jsx'
import HistorialEstadosNotasPage from '../pages/seguimiento/HistorialEstadosNotasPage.jsx'
import ReportePage from '../pages/reporte/ReportePage.jsx'
import ImportarReportePage from '../pages/admin/ImportarReportePage.jsx'
import HistorialImportacionesPage from '../pages/admin/HistorialImportacionesPage.jsx'
import UsuariosPage from '../pages/admin/usuarios/UsuariosPage.jsx'
import EditarUsuarioPage from '../pages/admin/usuarios/EditarUsuarioPage.jsx'
import AsignarRutasPage from '../pages/admin/usuarios/AsignarRutasPage.jsx'
import RutasPage from '../pages/admin/rutas/RutasPage.jsx'
import RutasSinAsignarVendedorPage from '../pages/admin/rutas/RutasSinAsignarVendedorPage.jsx'
import EditarRutaPage from '../pages/admin/rutas/EditarRutaPage.jsx'
import AsignarUsuariosRutaPage from '../pages/admin/rutas/AsignarUsuariosRutaPage.jsx'
import ParametrosPage from '../pages/admin/parametros/ParametrosPage.jsx'
import EditarParametroPage from '../pages/admin/parametros/EditarParametroPage.jsx'
import LogsSistemaPage from '../pages/admin/LogsSistemaPage.jsx'
import WhatsappCobranzaPage from '../pages/admin/WhatsappCobranzaPage.jsx'
import PerfilPage from '../pages/cuenta/PerfilPage.jsx'
import NotificacionesPage from '../pages/cuenta/NotificacionesPage.jsx'
import EnlacesImagenesPage from '../pages/herramientas/EnlacesImagenesPage.jsx'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/forbidden', element: <ForbiddenPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <PaginaPrincipalPage /> },
      { path: 'notas-credito', element: <TodasLasNotasPage /> },
      { path: 'enlaces-imagenes', element: <EnlacesImagenesPage /> },
      {
        path: 'alertas',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <NotificacionesPage initialTab="alertas" />
          </RequireRole>
        ),
      },
      { path: 'seguimiento', element: <SeguimientoPage /> },
      { path: 'seguimiento/historial-estados', element: <HistorialEstadosNotasPage /> },
      { path: 'seguimiento/nota/:id', element: <DetalleNotaPage /> },
      {
        path: 'reporte',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <ReportePage />
          </RequireRole>
        ),
      },
      {
        path: 'importar-reporte',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <ImportarReportePage />
          </RequireRole>
        ),
      },
      {
        path: 'historial-importaciones',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <HistorialImportacionesPage />
          </RequireRole>
        ),
      },
      {
        path: 'usuarios',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <UsuariosPage />
          </RequireRole>
        ),
      },
      {
        path: 'usuarios/editar/:id',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <EditarUsuarioPage />
          </RequireRole>
        ),
      },
      {
        path: 'usuarios/asignar-rutas/:id',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <AsignarRutasPage />
          </RequireRole>
        ),
      },
      {
        path: 'rutas',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <RutasPage />
          </RequireRole>
        ),
      },
      {
        path: 'rutas/sin-asignar-vendedor',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <RutasSinAsignarVendedorPage />
          </RequireRole>
        ),
      },
      {
        path: 'rutas/editar/:id',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <EditarRutaPage />
          </RequireRole>
        ),
      },
      {
        path: 'rutas/asignar-usuarios/:id',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <AsignarUsuariosRutaPage />
          </RequireRole>
        ),
      },
      {
        path: 'parametros',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <ParametrosPage />
          </RequireRole>
        ),
      },
      {
        path: 'parametros/editar/:id',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <EditarParametroPage />
          </RequireRole>
        ),
      },
      {
        path: 'logs-sistema',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <LogsSistemaPage />
          </RequireRole>
        ),
      },
      {
        path: 'whatsapp-cobranza',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <WhatsappCobranzaPage />
          </RequireRole>
        ),
      },
      { path: 'perfil', element: <PerfilPage /> },
      { path: 'notificaciones', element: <NotificacionesPage /> },
      {
        path: 'healthz',
        element: (
          <RequireRole roles={['ADMIN', 'CREDITO']}>
            <HealthzPage />
          </RequireRole>
        ),
      },
    ],
  },
])
