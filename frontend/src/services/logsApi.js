import { http } from './http.js'

export const logsApi = {
  /** Tabla importaciones (como vista “operativa”). */
  importaciones: () => http('/api/logs-sistema'),
  /** Últimas líneas de api/logs/app.log (tipo django.log). */
  archivo: (lines = 200) => http(`/api/logs-sistema/archivo?lines=${lines}`),
}
