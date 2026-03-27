import { createClient } from '@supabase/supabase-js'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

/**
 * Por defecto el front no usa Supabase Auth ni PostgREST desde el navegador: todo va al API (JWT en cookie).
 * Solo con `VITE_USE_SUPABASE_CLIENT=true` se activa el modo híbrido anterior (URL + anon key obligatorias).
 */
const useSupabaseFromBrowser =
  String(import.meta.env.VITE_USE_SUPABASE_CLIENT || '').toLowerCase() === 'true'

export const isSupabaseConfigured =
  useSupabaseFromBrowser && Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
