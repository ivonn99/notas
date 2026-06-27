import { decodeDbJwtPayloadUnsafe, isDbJwtLoginEnabled } from '../lib/dbJwtSession.js'
import { canAdmin, getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { getEdgeFunctionBearer } from '../lib/supabaseSessionToken.js'
import { supabase } from '../lib/supabaseClient.js'

/** Si no defines VITE_SUPABASE_ADMIN_*_ENDPOINT, se usa VITE_SUPABASE_URL + /functions/v1/<nombre>. */
function supabaseFunctionUrl(name) {
  const base = String(import.meta.env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '')
  if (!base) return ''
  return `${base}/functions/v1/${name}`
}

function adminResetPasswordEndpoint() {
  const explicit = String(import.meta.env.VITE_SUPABASE_ADMIN_RESET_ENDPOINT || '').trim()
  if (explicit) return explicit
  return supabaseFunctionUrl('admin-reset-password')
}

function adminSyncUserEmailEndpoint() {
  const explicit = String(import.meta.env.VITE_SUPABASE_ADMIN_SYNC_EMAIL_ENDPOINT || '').trim()
  if (explicit) return explicit
  return supabaseFunctionUrl('admin-sync-user-email')
}

function adminSyncUsuarioMetadataEndpoint() {
  const explicit = String(import.meta.env.VITE_SUPABASE_ADMIN_SYNC_METADATA_ENDPOINT || '').trim()
  if (explicit) return explicit
  return supabaseFunctionUrl('admin-sync-usuario-metadata')
}

/** PostgREST y el gateway de Edge Functions suelen exigir `apikey` (anon) además del JWT del usuario. */
function supabaseEdgeFunctionHeaders(bearerAccessToken) {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${bearerAccessToken}`,
    ...(anon ? { apikey: anon } : {}),
  }
}

function normalizeEmail(emailRaw, usernameRaw) {
  const email = String(emailRaw ?? '').trim().toLowerCase()
  if (email) return email
  const user = String(usernameRaw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${user || 'usuario'}@local.test`
}

/** Firefox: "NetworkError when attempting to fetch resource"; Chrome: "Failed to fetch". */
function isBrowserFetchNetworkFailure(err) {
  const name = err?.name
  const m = String(err?.message || err)
  if (name === 'TypeError' && /fetch|network|load failed|failed to fetch/i.test(m)) return true
  return /networkerror|failed to fetch|network request failed/i.test(m)
}

/** Columnas legacy Django (NOT NULL): el API Node inserta '' ''; aquí derivamos de nombre completo. */
function djangoFirstLastFromNombreCompleto(nombreCompletoRaw, usernameFallback) {
  const s =
    String(nombreCompletoRaw ?? '').trim() || String(usernameFallback ?? '').trim()
  const parts = s.split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] || '',
    last_name: parts.length > 1 ? parts.slice(1).join(' ') : '',
  }
}

async function assertAdmin() {
  const meta = await getSupabaseAuthMeta()
  if (!canAdmin(meta)) throw new Error('Sin permiso')
  return meta
}

/** Sin token completo: iss, exp, rol en metadata (solo depuración). */
function bearerDebugSummary(token) {
  if (!token) return { present: false }
  const pay = decodeDbJwtPayloadUnsafe(token)
  const expSec = typeof pay?.exp === 'number' ? pay.exp : null
  let expIso = null
  let expired = null
  if (expSec != null) {
    try {
      expIso = new Date(expSec * 1000).toISOString()
      expired = Date.now() / 1000 > expSec
    } catch {
      /* ignore */
    }
  }
  const meta = pay?.user_metadata && typeof pay.user_metadata === 'object' ? pay.user_metadata : {}
  return {
    present: true,
    lengthChars: token.length,
    iss: pay?.iss ?? null,
    aud: pay?.aud ?? null,
    expIso,
    expiredGuess: expired,
    rolMeta: meta.rol ?? meta.Rol ?? null,
    isSuperMeta: meta.isSuperuser ?? null,
  }
}

async function adminResetPasswordViaSupabase(id, newPassword) {
  const uid = Number.parseInt(String(id), 10)
  if (!Number.isFinite(uid) || uid <= 0) throw new Error('ID inválido')
  const nextPass = String(newPassword ?? '')
  if (!nextPass || nextPass.length < 4) throw new Error('Nueva contraseña inválida')

  await assertAdmin()

  const endpoint = adminResetPasswordEndpoint()
  if (endpoint) {
    const token = await getEdgeFunctionBearer()
    const anonConfigured = Boolean(String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim())
    const debugBase = {
      context: 'admin-reset-password',
      usuarioTablaId: uid,
      endpoint,
      dbLoginMode: isDbJwtLoginEnabled(),
      viteSupabaseUrlSet: Boolean(String(import.meta.env.VITE_SUPABASE_URL || '').trim()),
      anonKeyConfigured: anonConfigured,
      bearer: bearerDebugSummary(token),
    }
    if (!token) {
      console.error('[adminApi] admin-reset-password: no hay bearer (getEdgeFunctionBearer vacío)', debugBase)
      throw new Error('Sesión inválida para reset de contraseña')
    }
    let res
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: supabaseEdgeFunctionHeaders(token),
        body: JSON.stringify({ usuarioId: uid, newPassword: nextPass, accessToken: token }),
      })
    } catch (netErr) {
      console.error('[adminApi] admin-reset-password: fallo de red al llamar Edge Function', {
        ...debugBase,
        networkMessage: netErr?.message,
        networkName: netErr?.name,
      })
      throw netErr
    }
    const rawText = await res.text()
    let payload = {}
    try {
      payload = rawText ? JSON.parse(rawText) : {}
    } catch {
      const prev =
        rawText.length > 280 ? `${rawText.slice(0, 280)}…` : rawText || 'Respuesta vacía'
      payload = { error: prev, _rawParseFailed: true }
    }
    if (!res.ok) {
      console.error('[adminApi] admin-reset-password: respuesta HTTP no OK', {
        ...debugBase,
        httpStatus: res.status,
        httpStatusText: res.statusText,
        responseBody: payload,
      })
      throw new Error(payload?.error || `Error HTTP ${res.status} al resetear contraseña`)
    }
    return payload
  }

  const { data: userRows, error: userErr } = await supabase
    .from('usuarios')
    .select('id, username, email')
    .eq('id', uid)
    .limit(1)
  if (userErr) throw new Error(userErr.message || 'No se pudo validar usuario')
  const user = userRows?.[0]
  if (!user) throw new Error('Usuario no encontrado')
  if (!user.email) throw new Error('El usuario no tiene email para recuperación')

  const redirectTo =
    String(import.meta.env.VITE_SUPABASE_RESET_REDIRECT_URL || '').trim() ||
    `${window.location.origin}/login`
  const { error: resetErr } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo })
  if (resetErr) throw new Error(resetErr.message || 'No se pudo enviar correo de recuperación')

  return {
    ok: true,
    mode: 'email_reset',
    message:
      'Se envió un correo de recuperación al usuario. Con VITE_SUPABASE_URL desplegado, suele bastar la función admin-reset-password en la misma instancia.',
    item: { id: user.id, username: user.username, email: user.email },
  }
}

/**
 * Si el admin cambia el email, actualiza también Supabase Auth (Edge Function con service_role).
 */
async function syncAuthEmailIfChanged(uid, beforeRow, nextEmailNormalized) {
  const beforeEmail = normalizeEmail(beforeRow?.email, beforeRow?.username)
  if (beforeEmail === nextEmailNormalized) {
    return { synced: true, skipped: true }
  }

  const endpoint = adminSyncUserEmailEndpoint()
  if (!endpoint) {
    return {
      synced: false,
      message:
        'Email guardado en la base. Define VITE_SUPABASE_URL para poder llamar a la función admin-sync-user-email.',
    }
  }

  const token = await getEdgeFunctionBearer()
  if (!token) throw new Error('Sesión inválida para sincronizar email en Auth')

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: supabaseEdgeFunctionHeaders(token),
      body: JSON.stringify({
        usuarioId: uid,
        previousEmail: beforeEmail,
        newEmail: nextEmailNormalized,
        accessToken: token,
      }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(payload?.error || `Error HTTP ${res.status} al sincronizar email en Auth`)
    }
    if (payload?.skipped && payload?.message) {
      return { synced: false, skipped: true, message: payload.message }
    }
    return { synced: Boolean(payload?.synced) }
  } catch (e) {
    if (isBrowserFetchNetworkFailure(e)) {
      return {
        synced: false,
        message:
          'Email guardado solo en la base; no se pudo contactar admin-sync-user-email (red o función no desplegada). Ajusta VITE_SUPABASE_URL y despliega la función, o sincroniza el correo en Auth manualmente.',
      }
    }
    throw e
  }
}

/**
 * Tras guardar en `usuarios`, alinea user_metadata en Supabase Auth (rol, usuarioId, etc.).
 * Sin esto el JWT sigue con el rol antiguo hasta volver a iniciar sesión.
 */
async function syncAuthUserMetadataFromDb(usuarioId) {
  const endpoint = adminSyncUsuarioMetadataEndpoint()
  if (!endpoint) {
    return {
      synced: false,
      skipped: true,
      message:
        'Rol guardado en la base. Define VITE_SUPABASE_URL y despliega la función admin-sync-usuario-metadata para actualizar la sesión en Auth.',
    }
  }
  const token = await getEdgeFunctionBearer()
  if (!token) throw new Error('Sesión inválida para sincronizar metadatos en Auth')

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: supabaseEdgeFunctionHeaders(token),
      body: JSON.stringify({ usuarioId, accessToken: token }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(payload?.error || `Error HTTP ${res.status} al sincronizar metadatos en Auth`)
    }
    return payload
  } catch (e) {
    if (isBrowserFetchNetworkFailure(e)) {
      return {
        synced: false,
        message:
          'Los cambios ya están guardados en la base. No se pudo contactar la función admin-sync-usuario-metadata (red, URL de Supabase o función no desplegada). ' +
          'Revisa VITE_SUPABASE_URL, despliega las Edge Functions y prueba sin VPN o bloqueadores. ' +
          'El usuario editado verá rol y datos actualizados al volver a iniciar sesión.',
      }
    }
    throw e
  }
}

export const adminApi = {
  listUsuarios: async () => {
    await assertAdmin()
    const { data, error } = await supabase
      .from('usuarios')
      .select('id, username, nombre_completo, email, telefono, rol, activo, is_active, is_superuser, created_at')
      .order('id', { ascending: false })
    if (error) throw new Error(error.message || 'No se pudieron cargar usuarios')
    const ids = (data || []).map((u) => u.id)
    const { data: ur } = await supabase.from('usuario_rutas').select('usuario_id').in('usuario_id', ids.length ? ids : [-1])
    const countByUser = {}
    for (const r of ur || []) countByUser[r.usuario_id] = (countByUser[r.usuario_id] || 0) + 1
    return { ok: true, items: (data || []).map((u) => ({ ...u, rutas_enlazadas: countByUser[u.id] || 0 })) }
  },
  createUsuario: async (body) => {
    await assertAdmin()
    const username = String(body?.username ?? '').trim()
    const nombreCompleto = String(body?.nombre_completo ?? '').trim()
    const email = normalizeEmail(body?.email, username)
    const telefono = String(body?.telefono ?? '').trim()
    const rol = String(body?.rol ?? 'VENDEDOR').trim().toUpperCase()
    const plainPassword = String(body?.password ?? '').trim()
    if (!username) throw new Error('Username obligatorio')
    if (isDbJwtLoginEnabled()) {
      if (!plainPassword || plainPassword.length < 4) {
        throw new Error('Contraseña obligatoria (mín. 4 caracteres) para login por base de datos')
      }
    }
    if (!['ADMIN', 'CREDITO', 'VENDEDOR'].includes(rol)) throw new Error('Rol inválido')
    const nc = nombreCompleto || username
    const { first_name, last_name } = djangoFirstLastFromNombreCompleto(nc, username)
    const { data, error } = await supabase
      .from('usuarios')
      .insert({
        username,
        nombre_completo: nc,
        first_name,
        last_name,
        email,
        telefono: telefono || null,
        rol,
        activo: true,
        is_active: true,
      })
      .select('id, username, nombre_completo, email, telefono, rol, activo, is_active')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo crear usuario')
    const item = data?.[0] || null
    if (isDbJwtLoginEnabled() && item?.id && plainPassword) {
      try {
        await adminResetPasswordViaSupabase(item.id, plainPassword)
      } catch (e) {
        console.error('[adminApi] createUsuario: insert OK pero falló guardar hash de contraseña', {
          usuarioTablaId: item.id,
          username: item.username,
          errorMessage: e?.message,
          errorName: e?.name,
          ...(import.meta.env.DEV ? { stack: e?.stack } : {}),
        })
        throw new Error(
          `Usuario creado (#${item.id}) pero no se pudo guardar la contraseña: ${e?.message || e}. Usa «Restablecer contraseña».`,
        )
      }
    }
    return { ok: true, item }
  },
  getUsuario: async (id) => {
    await assertAdmin()
    const uid = Number.parseInt(String(id), 10)
    const { data, error } = await supabase.from('usuarios').select('id, username, nombre_completo, email, telefono, rol, activo, is_active, is_superuser').eq('id', uid).limit(1)
    if (error) throw new Error(error.message || 'No se pudo cargar usuario')
    if (!data?.[0]) throw new Error('Usuario no encontrado')
    return { ok: true, item: data[0] }
  },
  updateUsuario: async (id, body) => {
    await assertAdmin()
    const uid = Number.parseInt(String(id), 10)
    const username = String(body?.username ?? '').trim()
    const nombreCompleto = String(body?.nombre_completo ?? '').trim()
    const email = normalizeEmail(body?.email, username)
    const telefono = String(body?.telefono ?? '').trim()
    const rol = String(body?.rol ?? '').trim().toUpperCase()
    const activo = Boolean(body?.activo)
    const isActive = Boolean(body?.is_active)
    if (!username) throw new Error('Username requerido')
    if (!['ADMIN', 'CREDITO', 'VENDEDOR'].includes(rol)) throw new Error('Rol inválido')

    const { data: before, error: beforeErr } = await supabase
      .from('usuarios')
      .select('email, username')
      .eq('id', uid)
      .maybeSingle()
    if (beforeErr) throw new Error(beforeErr.message || 'No se pudo leer usuario')
    if (!before) throw new Error('Usuario no encontrado')

    let authEmailSync = null
    if (normalizeEmail(before.email, before.username) !== email) {
      authEmailSync = await syncAuthEmailIfChanged(uid, before, email)
    }

    const { first_name, last_name } = djangoFirstLastFromNombreCompleto(nombreCompleto, username)
    const { data, error } = await supabase
      .from('usuarios')
      .update({
        username,
        nombre_completo: nombreCompleto,
        first_name,
        last_name,
        email,
        telefono: telefono || null,
        rol,
        activo,
        is_active: isActive,
      })
      .eq('id', uid)
      .select('id, username, nombre_completo, email, telefono, rol, activo, is_active, is_superuser')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo actualizar usuario')
    if (!data?.[0]) throw new Error('Usuario no encontrado')

    let authMetadataSync = null
    try {
      authMetadataSync = await syncAuthUserMetadataFromDb(uid)
    } catch (e) {
      authMetadataSync = {
        synced: false,
        error: String(e?.message || e),
      }
    }

    const metadataApplied = Boolean(authMetadataSync?.synced === true || authMetadataSync?.ok === true)
    if (metadataApplied && !isDbJwtLoginEnabled()) {
      try {
        const meta = await getSupabaseAuthMeta()
        if (Number(meta.usuarioId) === uid) {
          await supabase.auth.refreshSession()
        }
      } catch {
        /* ignore */
      }
    }

    return { ok: true, item: data[0], authEmailSync, authMetadataSync }
  },
  resetUsuarioPassword: async (id, newPassword) => {
    return adminResetPasswordViaSupabase(id, newPassword)
  },
  deleteUsuario: async (id) => {
    await assertAdmin()
    const uid = Number.parseInt(String(id), 10)
    const { data, error } = await supabase
      .from('usuarios')
      .update({ activo: false, is_active: false })
      .eq('id', uid)
      .select('id, username, activo, is_active')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo desactivar usuario')
    if (!data?.[0]) throw new Error('Usuario no encontrado')
    return { ok: true, item: data[0] }
  },
  eliminarUsuarioPermanente: async (id) => {
    await assertAdmin()
    const uid = Number.parseInt(String(id), 10)
    const { data: del, error } = await supabase.from('usuarios').delete().eq('id', uid).select('id, username').limit(1)
    if (error) throw new Error(error.message || 'No se pudo eliminar usuario')
    if (!del?.[0]) throw new Error('Usuario no encontrado')
    return { ok: true, item: del[0] }
  },
  getUsuarioRutas: async (id) => {
    await assertAdmin()
    const uid = Number.parseInt(String(id), 10)
    const { data: userRows, error: userErr } = await supabase.from('usuarios').select('id, username, nombre_completo').eq('id', uid).limit(1)
    if (userErr) throw new Error(userErr.message || 'No se pudo cargar usuario')
    if (!userRows?.[0]) throw new Error('Usuario no encontrado')
    const { data: rutas, error: rutasErr } = await supabase.from('rutas').select('id, codigo, nombre').order('codigo', { ascending: true })
    if (rutasErr) throw new Error(rutasErr.message || 'No se pudieron cargar rutas')
    const { data: ur, error: urErr } = await supabase.from('usuario_rutas').select('ruta_id').eq('usuario_id', uid)
    if (urErr) throw new Error(urErr.message || 'No se pudo cargar asignación')
    const set = new Set((ur || []).map((x) => x.ruta_id))
    return { ok: true, user: userRows[0], rutas: (rutas || []).map((r) => ({ ...r, asignada: set.has(r.id) })) }
  },
  updateUsuarioRutas: async (id, rutaIds) => {
    await assertAdmin()
    const uid = Number.parseInt(String(id), 10)
    const cleanIds = Array.isArray(rutaIds) ? rutaIds.map((v) => Number.parseInt(String(v), 10)).filter((v) => Number.isFinite(v) && v > 0) : []
    await supabase.from('usuario_rutas').delete().eq('usuario_id', uid)
    if (cleanIds.length > 0) {
      const payload = cleanIds.map((rid) => ({ usuario_id: uid, ruta_id: rid }))
      const { error } = await supabase.from('usuario_rutas').insert(payload)
      if (error) throw new Error(error.message || 'No se pudieron asignar rutas')
    }
    return { ok: true, assignedCount: cleanIds.length }
  },

  listRutas: async () => {
    await assertAdmin()
    const { data, error } = await supabase.from('rutas').select('id, codigo, nombre, descripcion, activa, created_at').order('codigo', { ascending: true })
    if (error) throw new Error(error.message || 'No se pudieron cargar rutas')
    const ids = (data || []).map((r) => r.id)
    const { data: ur } = await supabase.from('usuario_rutas').select('ruta_id').in('ruta_id', ids.length ? ids : [-1])
    const countByRuta = {}
    for (const row of ur || []) countByRuta[row.ruta_id] = (countByRuta[row.ruta_id] || 0) + 1
    return { ok: true, items: (data || []).map((r) => ({ ...r, rutas_enlazadas: countByRuta[r.id] || 0 })) }
  },
  listRutasSinAsignarVendedor: async () => {
    await assertAdmin()
    const { data: rutas, error: rutasErr } = await supabase.from('rutas').select('id, codigo, nombre, descripcion, activa').order('codigo', { ascending: true })
    if (rutasErr) throw new Error(rutasErr.message || 'No se pudieron cargar rutas')
    const { data: vendedores, error: vendErr } = await supabase.from('usuarios').select('id').eq('rol', 'VENDEDOR').eq('activo', true).eq('is_active', true)
    if (vendErr) throw new Error(vendErr.message || 'No se pudieron cargar vendedores')
    const vendSet = new Set((vendedores || []).map((v) => v.id))
    const { data: ur, error: urErr } = await supabase.from('usuario_rutas').select('ruta_id, usuario_id')
    if (urErr) throw new Error(urErr.message || 'No se pudo cargar asignaciones')
    const count = {}
    for (const row of ur || []) {
      if (!vendSet.has(row.usuario_id)) continue
      count[row.ruta_id] = (count[row.ruta_id] || 0) + 1
    }
    return { ok: true, items: (rutas || []).filter((r) => (count[r.id] || 0) === 0).map((r) => ({ ...r, vendedores_asignados: 0 })) }
  },
  listNotasSinAsignarVendedor: async (empresa, page = 1, pageSize = 100) => {
    await assertAdmin()
    const emp = String(empresa || '').trim().toUpperCase()
    const p = Math.max(1, Number.parseInt(String(page), 10) || 1)
    const ps = Math.min(200, Math.max(20, Number.parseInt(String(pageSize), 10) || 100))
    const from = (p - 1) * ps
    const to = from + ps - 1
    let q = supabase.from('notas_credito').select('id, serie_folio, cliente, empresa, estado, usuario_vendedor_pv, ruta_id, rutas:ruta_id(codigo)').order('id', { ascending: false }).range(from, to)
    if (emp) q = q.eq('empresa', emp)
    const { data: notas, error: notasErr } = await q
    if (notasErr) throw new Error(notasErr.message || 'No se pudieron cargar notas')
    const { data: vendedores, error: vendErr } = await supabase.from('usuarios').select('id').eq('rol', 'VENDEDOR').eq('activo', true).eq('is_active', true)
    if (vendErr) throw new Error(vendErr.message || 'No se pudieron cargar vendedores')
    const vendSet = new Set((vendedores || []).map((v) => v.id))
    const rutaIds = [...new Set((notas || []).map((n) => n.ruta_id).filter((v) => v != null))]
    const { data: ur } = await supabase.from('usuario_rutas').select('ruta_id, usuario_id').in('ruta_id', rutaIds.length ? rutaIds : [-1])
    const rutaWithVend = new Set((ur || []).filter((x) => vendSet.has(x.usuario_id)).map((x) => x.ruta_id))
    const items = (notas || [])
      .filter((n) => !rutaWithVend.has(n.ruta_id))
      .map((n) => ({ ...n, ruta_codigo: n.rutas?.codigo || null }))
    return { ok: true, empresa: emp || null, page: p, pageSize: ps, hasMore: items.length === ps, items }
  },
  createRuta: async (body) => {
    await assertAdmin()
    const codigo = String(body?.codigo ?? '').trim().toUpperCase()
    const nombre = String(body?.nombre ?? '').trim()
    const descripcion = String(body?.descripcion ?? '').trim()
    const activa = body?.activa !== false
    const { data, error } = await supabase
      .from('rutas')
      .insert({ codigo, nombre, descripcion, activa })
      .select('id, codigo, nombre, descripcion, activa, created_at')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo crear ruta')
    return { ok: true, item: data?.[0] || null }
  },
  getRuta: async (id) => {
    await assertAdmin()
    const rid = Number.parseInt(String(id), 10)
    const { data, error } = await supabase.from('rutas').select('id, codigo, nombre, descripcion, activa').eq('id', rid).limit(1)
    if (error) throw new Error(error.message || 'No se pudo cargar ruta')
    if (!data?.[0]) throw new Error('Ruta no encontrada')
    return { ok: true, item: data[0] }
  },
  updateRuta: async (id, body) => {
    await assertAdmin()
    const rid = Number.parseInt(String(id), 10)
    const codigo = String(body?.codigo ?? '').trim().toUpperCase()
    const nombre = String(body?.nombre ?? '').trim()
    const descripcion = String(body?.descripcion ?? '').trim()
    const activa = Boolean(body?.activa)
    const { data, error } = await supabase
      .from('rutas')
      .update({ codigo, nombre, descripcion, activa })
      .eq('id', rid)
      .select('id, codigo, nombre, descripcion, activa')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo actualizar ruta')
    if (!data?.[0]) throw new Error('Ruta no encontrada')
    return { ok: true, item: data[0] }
  },
  getRutaUsuarios: async (id) => {
    await assertAdmin()
    const rid = Number.parseInt(String(id), 10)
    const { data: rutaRows, error: rutaErr } = await supabase.from('rutas').select('id, codigo, nombre').eq('id', rid).limit(1)
    if (rutaErr) throw new Error(rutaErr.message || 'No se pudo cargar ruta')
    if (!rutaRows?.[0]) throw new Error('Ruta no encontrada')
    const { data: users, error: usersErr } = await supabase.from('usuarios').select('id, username, nombre_completo, rol, activo, is_active').order('nombre_completo', { ascending: true })
    if (usersErr) throw new Error(usersErr.message || 'No se pudieron cargar usuarios')
    const { data: ur, error: urErr } = await supabase.from('usuario_rutas').select('usuario_id').eq('ruta_id', rid)
    if (urErr) throw new Error(urErr.message || 'No se pudo cargar asignación')
    const set = new Set((ur || []).map((x) => x.usuario_id))
    return { ok: true, ruta: rutaRows[0], usuarios: (users || []).map((u) => ({ ...u, asignado: set.has(u.id) })) }
  },
  updateRutaUsuarios: async (id, usuarioIds) => {
    await assertAdmin()
    const rid = Number.parseInt(String(id), 10)
    const clean = [...new Set((Array.isArray(usuarioIds) ? usuarioIds : []).map((x) => Number.parseInt(String(x), 10)).filter((x) => Number.isFinite(x) && x > 0))]
    await supabase.from('usuario_rutas').delete().eq('ruta_id', rid)
    if (clean.length > 0) {
      const payload = clean.map((uid) => ({ ruta_id: rid, usuario_id: uid }))
      const { error } = await supabase.from('usuario_rutas').insert(payload)
      if (error) throw new Error(error.message || 'No se pudo asignar usuarios')
    }
    return { ok: true, assignedCount: clean.length }
  },
  deleteRuta: async (id) => {
    await assertAdmin()
    const rid = Number.parseInt(String(id), 10)
    const { data: notas, error: notasErr } = await supabase.from('notas_credito').select('id', { count: 'exact' }).eq('ruta_id', rid).limit(1)
    if (notasErr) throw new Error(notasErr.message || 'No se pudo validar ruta')
    if ((notas?.length || 0) > 0) throw new Error('No se puede eliminar la ruta: hay notas de crédito asociadas.')
    await supabase.from('usuario_rutas').delete().eq('ruta_id', rid)
    const { data, error } = await supabase.from('rutas').delete().eq('id', rid).select('id, codigo').limit(1)
    if (error) throw new Error(error.message || 'No se pudo eliminar ruta')
    if (!data?.[0]) throw new Error('Ruta no encontrada')
    return { ok: true, item: data[0] }
  },

  listParametros: async () => {
    await assertAdmin()
    const { data, error } = await supabase.from('parametros').select('id, clave, valor, descripcion, updated_at').order('clave', { ascending: true })
    if (error) throw new Error(error.message || 'No se pudieron cargar parámetros')
    return { ok: true, items: data || [] }
  },
  getParametro: async (id) => {
    await assertAdmin()
    const pid = Number.parseInt(String(id), 10)
    const { data, error } = await supabase.from('parametros').select('id, clave, valor, descripcion, updated_at').eq('id', pid).limit(1)
    if (error) throw new Error(error.message || 'No se pudo cargar parámetro')
    if (!data?.[0]) throw new Error('Parámetro no encontrado')
    return { ok: true, item: data[0] }
  },
  updateParametro: async (id, body) => {
    await assertAdmin()
    const pid = Number.parseInt(String(id), 10)
    const valor = String(body?.valor ?? '').trim()
    const descripcion = String(body?.descripcion ?? '').trim()
    const { data, error } = await supabase
      .from('parametros')
      .update({ valor, descripcion, updated_at: new Date().toISOString() })
      .eq('id', pid)
      .select('id, clave, valor, descripcion, updated_at')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo actualizar parámetro')
    if (!data?.[0]) throw new Error('Parámetro no encontrado')
    return { ok: true, item: data[0] }
  },
}
