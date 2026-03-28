import { createClient } from '@supabase/supabase-js'
import { getDbJwtToken, isDbJwtLoginEnabled } from './dbJwtSession.js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

/**
 * Con URL + anon key el front usa Supabase (Auth + PostgREST) desde el navegador.
 * Sin ellas, todo va al API Node (cookies/JWT).
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function dbJwtAwareFetch(url, options = {}) {
  const headers = new Headers(options.headers ?? undefined)
  if (isDbJwtLoginEnabled()) {
    const token = getDbJwtToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(url, { ...options, headers })
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
