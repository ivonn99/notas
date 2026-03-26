import { http } from './http.js'

export const notificacionesApi = {
  list: () => http('/api/notificaciones'),
  resumen: () => http('/api/notificaciones/resumen'),
  marcarTodas: () => http('/api/notificaciones/leer-todo', { method: 'POST' }),
  marcarLeida: (kind, id) =>
    http(`/api/notificaciones/${kind}/${id}/leer`, { method: 'POST' }),
}
