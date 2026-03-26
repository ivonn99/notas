import { http } from './http.js'

export const adminApi = {
  listUsuarios: () => http('/api/admin/usuarios'),
  createUsuario: (body) =>
    http('/api/admin/usuarios', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getUsuario: (id) => http(`/api/admin/usuarios/${id}`),
  updateUsuario: (id, body) =>
    http(`/api/admin/usuarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  resetUsuarioPassword: (id, newPassword) =>
    http(`/api/admin/usuarios/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  deleteUsuario: (id) =>
    http(`/api/admin/usuarios/${id}`, {
      method: 'DELETE',
    }),
  eliminarUsuarioPermanente: (id) =>
    http(`/api/admin/usuarios/${id}/eliminar-permanente`, {
      method: 'POST',
    }),
  getUsuarioRutas: (id) => http(`/api/admin/usuarios/${id}/rutas`),
  updateUsuarioRutas: (id, rutaIds) =>
    http(`/api/admin/usuarios/${id}/rutas`, {
      method: 'PUT',
      body: JSON.stringify({ rutaIds }),
    }),

  listRutas: () => http('/api/admin/rutas'),
  listRutasSinAsignarVendedor: () => http('/api/admin/rutas/sin-asignar-vendedor'),
  listNotasSinAsignarVendedor: (empresa, page = 1, pageSize = 100) =>
    http(
      empresa
        ? `/api/admin/notas/sin-asignar-vendedor?empresa=${encodeURIComponent(empresa)}&page=${page}&pageSize=${pageSize}`
        : `/api/admin/notas/sin-asignar-vendedor?page=${page}&pageSize=${pageSize}`,
    ),
  createRuta: (body) =>
    http('/api/admin/rutas', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getRuta: (id) => http(`/api/admin/rutas/${id}`),
  updateRuta: (id, body) =>
    http(`/api/admin/rutas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getRutaUsuarios: (id) => http(`/api/admin/rutas/${id}/usuarios`),
  updateRutaUsuarios: (id, usuarioIds) =>
    http(`/api/admin/rutas/${id}/usuarios`, {
      method: 'PUT',
      body: JSON.stringify({ usuarioIds }),
    }),
  deleteRuta: (id) =>
    http(`/api/admin/rutas/${id}`, {
      method: 'DELETE',
    }),

  listParametros: () => http('/api/admin/parametros'),
  getParametro: (id) => http(`/api/admin/parametros/${id}`),
  updateParametro: (id, body) =>
    http(`/api/admin/parametros/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
}
