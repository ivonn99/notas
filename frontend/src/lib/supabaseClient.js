import { createClient } from '@supabase/supabase-js'
import { getDbJwtToken, isDbJwtLoginEnabled } from './dbJwtSession.js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

/**
 * Con URL + anon key el front usa Supabase (Auth + PostgREST) desde el navegador.
 * Sin ellas, todo va al API Node (cookies/JWT).
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Sustituye el Bearer por el JWT de db-login. Debe conservar apikey y el resto de cabeceras
 * que ya añade supabase-js (incl. si el primer argumento es un objeto Request).
 */
function dbJwtAwareFetch(input, init = {}) {
  const next = { ...init }
  const headers = new Headers()

  if (typeof Request !== 'undefined' && input instanceof Request) {
    input.headers.forEach((value, key) => {
      headers.set(key, value)
    })
  }
  if (init.headers != null) {
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value)
    })
  }

  if (isDbJwtLoginEnabled()) {
    const token = getDbJwtToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  next.headers = headers
  if (next.mode == null) next.mode = 'cors'
  return fetch(input, next)
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: isDbJwtLoginEnabled()
        ? {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          }
        : {
            persistSession: true,
            autoRefreshToken: true,
          },
      global: {
        fetch: dbJwtAwareFetch,
      },
    })
  : null
