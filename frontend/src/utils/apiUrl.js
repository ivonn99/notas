/**
 * Prefijo del API en producción (Netlify, etc.).
 * En local déjalo vacío: Vite hace proxy de `/api` → backend.
 * En Netlify: variable de build `VITE_API_URL=https://tu-api.example.com` (sin barra final).
 *
 * @param {string} path Ruta que empieza con `/`, p. ej. `/api/auth/me`
 */
export function apiUrl(path) {
  const raw = import.meta.env.VITE_API_URL
  const origin = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
  const normalized = path.startsWith('/') ? path : `/${path}`
  return origin ? `${origin}${normalized}` : normalized
}
