import { canAdmin, getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient.js'
import { http } from './http.js'

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

async function assertAdmin() {
  const meta = await getSupabaseAuthMeta()
  if (!canAdmin(meta)) throw new Error('Sin permiso')
  return meta
}

async function adminResetPasswordViaSupabase(id, newPassword) {
  const uid = Number.parseInt(String(id), 10)
  if (!Number.isFinite(uid) || uid <= 0) throw new Error('ID inválido')
  const nextPass = String(newPassword ?? '')
  if (!nextPass || nextPass.length < 4) throw new Error('Nueva contraseña inválida')

  await assertAdmin()

  const endpoint = adminResetPasswordEndpoint()
  if (endpoint) {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData?.session?.access_token
    if (!token) throw new Error('Sesión inválida para reset de contraseña')
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ usuarioId: uid, newPassword: nextPass }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
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

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData?.session?.access_token
  if (!token) throw new Error('Sesión inválida para sincronizar email en Auth')

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      usuarioId: uid,
      previousEmail: beforeEmail,
      newEmail: nextEmailNormalized,
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
}

export const adminApi = {
  listUsuarios: async () => {
    if (!isSupabaseConfigured) return http('/api/admin/usuarios')
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
    if (!isSupabaseConfigured) return http('/api/admin/usuarios', { method: 'POST', body: JSON.stringify(body) })
    await assertAdmin()
    const username = String(body?.username ?? '').trim()
    const nombreCompleto = String(body?.nombre_completo ?? '').trim()
    const email = normalizeEmail(body?.email, username)
    const telefono = String(body?.telefono ?? '').trim()
    const rol = String(body?.rol ?? 'VENDEDOR').trim().toUpperCase()
    if (!username) throw new Error('Username obligatorio')
    if (!['ADMIN', 'CREDITO', 'VENDEDOR'].includes(rol)) throw new Error('Rol inválido')
    const { data, error } = await supabase
      .from('usuarios')
      .insert({ username, nombre_completo: nombreCompleto || username, email, telefono: telefono || null, rol, activo: true, is_active: true })
      .select('id, username, nombre_completo, email, telefono, rol, activo, is_active')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo crear usuario')
    return { ok: true, item: data?.[0] || null }
  },
  getUsuario: async (id) => {
    if (!isSupabaseConfigured) return http(`/api/admin/usuarios/${id}`)
    await assertAdmin()
    const uid = Number.parseInt(String(id), 10)
    const { data, error } = await supabase.from('usuarios').select('id, username, nombre_completo, email, telefono, rol, activo, is_active, is_superuser').eq('id', uid).limit(1)
    if (error) throw new Error(error.message || 'No se pudo cargar usuario')
    if (!data?.[0]) throw new Error('Usuario no encontrado')
    return { ok: true, item: data[0] }
  },
  updateUsuario: async (id, body) => {
    if (!isSupabaseConfigured) return http(`/api/admin/usuarios/${id}`, { method: 'PUT', body: JSON.stringify(body) })
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

    const { data, error } = await supabase
      .from('usuarios')
      .update({ username, nombre_completo: nombreCompleto, email, telefono: telefono || null, rol, activo, is_active: isActive })
      .eq('id', uid)
      .select('id, username, nombre_completo, email, telefono, rol, activo, is_active, is_superuser')
      .limit(1)
    if (error) throw new Error(error.message || 'No se pudo actualizar usuario')
    if (!data?.[0]) throw new Error('Usuario no encontrado')
    return { ok: true, item: data[0], authEmailSync }
  },
  resetUsuarioPassword: async (id, newPassword) => {
    if (!isSupabaseConfigured) {
      return http(`/api/admin/usuarios/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      })
    }
    return adminResetPasswordViaSupabase(id, newPassword)
  },
  deleteUsuario: async (id) => {
    if (!isSupabaseConfigured) return http(`/api/admin/usuarios/${id}`, { method: 'DELETE' })
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
    if (!isSupabaseConfigured) return http(`/api/admin/usuarios/${id}/eliminar-permanente`, { method: 'POST' })
    await assertAdmin()
    const uid = Number.parseInt(String(id), 10)
    const { data: del, error } = await supabase.from('usuarios').delete().eq('id', uid).select('id, username').limit(1)
    if (error) throw new Error(error.message || 'No se pudo eliminar usuario')
    if (!del?.[0]) throw new Error('Usuario no encontrado')
    return { ok: true, item: del[0] }
  },
  getUsuarioRutas: async (id) => {
    if (!isSupabaseConfigured) return http(`/api/admin/usuarios/${id}/rutas`)
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
    if (!isSupabaseConfigured) return http(`/api/admin/usuarios/${id}/rutas`, { method: 'PUT', body: JSON.stringify({ rutaIds }) })
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
    if (!isSupabaseConfigured) return http('/api/admin/rutas')
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
    if (!isSupabaseConfigured) return http('/api/admin/rutas/sin-asignar-vendedor')
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
    if (!isSupabaseConfigured) {
      return http(
        empresa
          ? `/api/admin/notas/sin-asignar-vendedor?empresa=${encodeURIComponent(empresa)}&page=${page}&pageSize=${pageSize}`
          : `/api/admin/notas/sin-asignar-vendedor?page=${page}&pageSize=${pageSize}`,
      )
    }
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
    if (!isSupabaseConfigured) return http('/api/admin/rutas', { method: 'POST', body: JSON.stringify(body) })
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
    if (!isSupabaseConfigured) return http(`/api/admin/rutas/${id}`)
    await assertAdmin()
    const rid = Number.parseInt(String(id), 10)
    const { data, error } = await supabase.from('rutas').select('id, codigo, nombre, descripcion, activa').eq('id', rid).limit(1)
    if (error) throw new Error(error.message || 'No se pudo cargar ruta')
    if (!data?.[0]) throw new Error('Ruta no encontrada')
    return { ok: true, item: data[0] }
  },
  updateRuta: async (id, body) => {
    if (!isSupabaseConfigured) return http(`/api/admin/rutas/${id}`, { method: 'PUT', body: JSON.stringify(body) })
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
    if (!isSupabaseConfigured) return http(`/api/admin/rutas/${id}/usuarios`)
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
    if (!isSupabaseConfigured) return http(`/api/admin/rutas/${id}/usuarios`, { method: 'PUT', body: JSON.stringify({ usuarioIds }) })
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
    if (!isSupabaseConfigured) return http(`/api/admin/rutas/${id}`, { method: 'DELETE' })
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
    if (!isSupabaseConfigured) return http('/api/admin/parametros')
    await assertAdmin()
    const { data, error } = await supabase.from('parametros').select('id, clave, valor, descripcion, updated_at').order('clave', { ascending: true })
    if (error) throw new Error(error.message || 'No se pudieron cargar parámetros')
    return { ok: true, items: data || [] }
  },
  getParametro: async (id) => {
    if (!isSupabaseConfigured) return http(`/api/admin/parametros/${id}`)
    await assertAdmin()
    const pid = Number.parseInt(String(id), 10)
    const { data, error } = await supabase.from('parametros').select('id, clave, valor, descripcion, updated_at').eq('id', pid).limit(1)
    if (error) throw new Error(error.message || 'No se pudo cargar parámetro')
    if (!data?.[0]) throw new Error('Parámetro no encontrado')
    return { ok: true, item: data[0] }
  },
  updateParametro: async (id, body) => {
    if (!isSupabaseConfigured) return http(`/api/admin/parametros/${id}`, { method: 'PUT', body: JSON.stringify(body) })
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
