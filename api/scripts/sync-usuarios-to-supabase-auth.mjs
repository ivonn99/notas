/**
 * Sincroniza filas de `usuarios` con Supabase Auth (email + contraseña + user_metadata).
 * Útil para login directo desde el frontend con VITE_SUPABASE_*.
 *
 * Requiere en api/.env:
 *   - SUPABASE_DB_URL o DATABASE_URL
 *   - SUPABASE_URL (https://xxxx.supabase.co)
 *   - SUPABASE_SERVICE_ROLE_KEY (solo servidor; no subir a git)
 *
 * Uso (desde carpeta api/):
 *   node scripts/sync-usuarios-to-supabase-auth.mjs "<contraseña_para_todos>"
 *   node scripts/sync-usuarios-to-supabase-auth.mjs --metadata-only
 *   node scripts/sync-usuarios-to-supabase-auth.mjs "<pass>" --dry-run
 *
 * Email: si en BD está vacío, se usa el mismo criterio que el front: `<username>@local.test`
 * y opcionalmente se persiste en `usuarios.email` (--fix-db-email).
 */
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const metadataOnly = args.includes('--metadata-only')
const fixDbEmail = args.includes('--fix-db-email')
const positional = args.filter((a) => !a.startsWith('--'))
const plainPassword =
  process.env.SUPABASE_AUTH_SYNC_PASSWORD?.trim() ||
  (metadataOnly || dryRun ? '' : positional[0]) ||
  ''

if (!metadataOnly && !dryRun && (!plainPassword || plainPassword.length < 4)) {
  console.error(
    'Uso: node scripts/sync-usuarios-to-supabase-auth.mjs "<contraseña_mín_4_chars>" [--dry-run] [--fix-db-email]',
  )
  console.error('   o: SUPABASE_AUTH_SYNC_PASSWORD=... node scripts/sync-usuarios-to-supabase-auth.mjs')
  console.error('   Metadatos sin cambiar contraseña: ... --metadata-only')
  console.error('   Vista previa: ... --dry-run (sin contraseña)')
  process.exit(1)
}

const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL

if (!conn) {
  console.error('Falta SUPABASE_DB_URL o DATABASE_URL en api/.env')
  process.exit(1)
}
if (!dryRun && (!supabaseUrl || !serviceKey)) {
  console.error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en api/.env')
  process.exit(1)
}

function stripSslParams(connectionString) {
  const cs = String(connectionString || '')
  if (!cs.includes('?')) return cs
  const [base, qs] = cs.split('?', 2)
  if (!qs) return cs
  const params = new URLSearchParams(qs)
  params.delete('sslmode')
  params.delete('channel_binding')
  const nextQs = params.toString()
  return nextQs ? `${base}?${nextQs}` : base
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

const usingSupabase = Boolean(process.env.SUPABASE_DB_URL?.trim())
const pool = new pg.Pool({
  connectionString: stripSslParams(conn),
  ssl: usingSupabase ? { rejectUnauthorized: false } : undefined,
})

async function loadAuthUsersByEmail(admin) {
  const map = new Map()
  let page = 1
  const perPage = 1000
  while (page <= 500) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(error.message || 'listUsers')
    const users = data?.users ?? []
    for (const u of users) {
      if (u.email) map.set(u.email.trim().toLowerCase(), u)
    }
    if (users.length < perPage) break
    page += 1
  }
  return map
}

async function main() {
  const { rows } = await pool.query(`
    SELECT id, username, email, rol, is_superuser
    FROM usuarios
    ORDER BY id
  `)

  if (dryRun) {
    console.log('[dry-run] Se procesarían', rows.length, 'usuarios (sin llamar a Auth).')
    for (const r of rows) {
      const email = normalizeEmail(r.email, r.username)
      console.log(`  id=${r.id} username=${r.username} email→${email} rol=${r.rol}`)
    }
    return
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const byEmail = await loadAuthUsersByEmail(admin)
  let creados = 0
  let actualizados = 0
  let dbEmailFix = 0

  for (const r of rows) {
    const emailNorm = normalizeEmail(r.email, r.username)
    const rolU = String(r.rol ?? 'VENDEDOR').trim().toUpperCase()
    const meta = {
      usuarioId: r.id,
      rol: rolU,
      isSuperuser: Boolean(r.is_superuser),
    }

    const dbEmailEmpty = !String(r.email ?? '').trim()
    if (fixDbEmail && dbEmailEmpty) {
      await pool.query('UPDATE usuarios SET email = $1 WHERE id = $2', [emailNorm, r.id])
      dbEmailFix += 1
    }

    const existing = byEmail.get(emailNorm.toLowerCase())

    if (!existing) {
      if (metadataOnly) {
        console.warn(
          `[skip] no existe en Auth ${emailNorm} (tabla id ${r.id}) — ejecuta primero sin --metadata-only`,
        )
        continue
      }
      const { error } = await admin.auth.admin.createUser({
        email: emailNorm,
        password: plainPassword,
        email_confirm: true,
        user_metadata: meta,
      })
      if (error) {
        console.error(`[error] create ${emailNorm}:`, error.message)
        continue
      }
      console.log(`creado   Auth  ${emailNorm} (usuario id ${r.id})`)
      creados += 1
      continue
    }

    const payload = { user_metadata: meta }
    if (!metadataOnly) payload.password = plainPassword

    const { error: upErr } = await admin.auth.admin.updateUserById(existing.id, payload)
    if (upErr) {
      console.error(`[error] update ${emailNorm}:`, upErr.message)
      continue
    }
    console.log(`actualizado  ${emailNorm} (auth ${existing.id}) usuario tabla ${r.id}`)
    actualizados += 1
  }

  console.log(`\nListo: ${creados} creados, ${actualizados} actualizados en Auth.`)
  if (fixDbEmail) console.log(`Emails persistidos en BD (vacíos): ${dbEmailFix}`)
}

try {
  await main()
} catch (e) {
  console.error(e)
  process.exit(1)
} finally {
  await pool.end()
}
