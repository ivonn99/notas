/**
 * Rutas alineadas con guia.txt (Django → SPA).
 * Ajustar prefijos aquí cuando conectemos API y guards por rol.
 */
export const ROUTES = {
  healthz: '/healthz',
  login: '/login',
  home: '/',
  notasCredito: '/notas-credito',
  alertas: '/alertas',
  seguimiento: '/seguimiento',
  reporte: '/reporte',
  detalleNota: (id = ':id') => `/seguimiento/nota/${id}`,
  importarReporte: '/importar-reporte',
  historialImportaciones: '/historial-importaciones',
  usuarios: '/usuarios',
  editarUsuario: (id = ':id') => `/usuarios/editar/${id}`,
  asignarRutas: (id = ':id') => `/usuarios/asignar-rutas/${id}`,
  rutas: '/rutas',
  rutasSinAsignarVendedor: '/rutas/sin-asignar-vendedor',
  editarRuta: (id = ':id') => `/rutas/editar/${id}`,
  asignarUsuariosRuta: (id = ':id') => `/rutas/asignar-usuarios/${id}`,
  parametros: '/parametros',
  editarParametro: (id = ':id') => `/parametros/editar/${id}`,
  logsSistema: '/logs-sistema',
  whatsappCobranza: '/whatsapp-cobranza',
  perfil: '/perfil',
  notificaciones: '/notificaciones',
  enlacesImagenes: '/enlaces-imagenes',
}
