import { createClient } from '@supabase/supabase-js'
import { getDbJwtToken, isDbJwtLoginEnabled } from './dbJwtSession.js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

const CONFIG_MSG =
  'Faltan variables de entorno de Supabase. Copia frontend/.env.example → frontend/.env y define ' +
  'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y VITE_SUPABASE_DB_LOGIN=true.'

/**
 * Comprueba configuración obligatoria (Supabase + login db-login-jwt).
 * Llamar al arrancar la app; no ejecutar en build estático sin env (CI usa placeholders).
 */
export function assertSupabaseConfigured() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(CONFIG_MSG)
  }
  if (!isDbJwtLoginEnabled()) {
    throw new Error(
      'Define VITE_SUPABASE_DB_LOGIN=true en frontend/.env. El login usa la Edge Function db-login-jwt.',
    )
  }
}

/** @deprecated Siempre true cuando assertSupabaseConfigured() pasó. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

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

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: dbJwtAwareFetch,
        },
      })
    : null

/** Cliente Supabase; lanza si falta configuración. */
export function getSupabase() {
  assertSupabaseConfigured()
  if (!supabase) throw new Error(CONFIG_MSG)
  return supabase
}
