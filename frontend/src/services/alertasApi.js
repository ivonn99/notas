import { http } from './http.js'

export const alertasApi = {
  list: () => http('/api/alertas'),
  marcarLeida: (id) =>
    http(`/api/alertas/${id}/leer`, {
      method: 'POST',
    }),
}
