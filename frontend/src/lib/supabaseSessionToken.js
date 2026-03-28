import { getDbJwtToken, isDbJwtLoginEnabled } from './dbJwtSession.js'
import { supabase } from './supabaseClient.js'

/** Bearer para llamadas a Edge Functions (GoTrue o JWT de tabla usuarios). */
export async function getEdgeFunctionBearer() {
  if (isDbJwtLoginEnabled()) return getDbJwtToken()
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token ?? null
}
