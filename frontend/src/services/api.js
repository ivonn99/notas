/**
 * Base del API. En desarrollo, rutas relativas `/api` pasan por el proxy de Vite → `api` (puerto 3001).
 * En producción, define `VITE_API_URL` (p. ej. https://tu-servicio.onrender.com) sin barra final.
 */
function apiOrigin() {
  const raw = import.meta.env.VITE_API_URL
  return typeof raw === 'string' ? raw.replace(/\/$/, '') : ''
}

/**
 * @returns {Promise<{ ok: boolean, status: number, data: object, hint?: string }>}
 */
export async function fetchDbPing() {
  const prefix = apiOrigin()
  const url = `${prefix}/api/db/ping`
  const res = await fetch(url)
  const ct = (res.headers.get('content-type') || '').toLowerCase()

  if (ct.includes('application/json')) {
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, status: res.status, data }
  }

  const text = await res.text()
  const preview = text.slice(0, 160).replace(/\s+/g, ' ').trim()
  const looksLikeHtml = /<!doctype html|<html[\s>]/i.test(text)

  return {
    ok: res.ok,
    status: res.status,
    data: {},
    hint: looksLikeHtml
      ? 'El servidor respondió con HTML (suele ser la SPA), no con el API JSON. Arranca el backend en la carpeta api (npm run dev, puerto 3001) y usa npm run dev o npm run preview en frontend con proxy configurado.'
      : preview
        ? `Respuesta no JSON (HTTP ${res.status}): ${preview}…`
        : `Respuesta vacía o no JSON (HTTP ${res.status}).`,
  }
}
