/**
 * Crea usuarios desde la lista operativa (nombres + roles).
 *
 * Uso (desde carpeta api/):
 *   node scripts/seed-usuarios-lista.mjs "ContraseñaTemporalUnica"
 *
 * Requiere SUPABASE_DB_URL (o DATABASE_URL) en .env
 * Omite MAGO (CREDITO) si ya existe usuario mago o nombre MAGO con rol CREDITO.
 * Si vuelves a ejecutar, no duplica (username ya existe).
 */
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

import { encodeDjangoPassword } from '../src/auth/djangoPassword.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const plainPassword = process.argv[2]
if (!plainPassword || plainPassword.length < 4) {
  console.error('Uso: node scripts/seed-usuarios-lista.mjs "<contraseña_inicial_mín_4_chars>"')
  process.exit(1)
}

const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL
if (!conn) {
  console.error('Falta SUPABASE_DB_URL o DATABASE_URL en api/.env')
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

/** Orden del listado (misma fila = mismo sufijo al repetir nombre). */
const ROWS = [
  ['DAMIAN', 'VENDEDOR'],
  ['LUIS H', 'VENDEDOR'],
  ['GONZALO', 'VENDEDOR'],
  ['LUIS A', 'VENDEDOR'],
  ['MARCE', 'VENDEDOR'],
  ['SOCO', 'VENDEDOR'],
  ['FANI', 'VENDEDOR'],
  ['EDGAR', 'VENDEDOR'],
  ['GONZALO', 'VENDEDOR'],
  ['FRANK', 'VENDEDOR'],
  ['DANIEL', 'VENDEDOR'],
  ['AARON E', 'VENDEDOR'],
  ['CARMEN', 'VENDEDOR'],
  ['MAGO', 'CREDITO'],
  ['YAHEL', 'VENDEDOR'],
  ['LUIS H', 'VENDEDOR'],
  ['LUIS H', 'VENDEDOR'],
  ['GERMAN', 'VENDEDOR'],
  ['EDWIN', 'VENDEDOR'],
  ['EDWIN', 'VENDEDOR'],
  ['EDWIN', 'VENDEDOR'],
  ['OSCAR', 'VENDEDOR'],
  ['BAYRON', 'VENDEDOR'],
  ['CARMEN', 'VENDEDOR'],
  ['MARTIN', 'VENDEDOR'],
  ['LUIS A', 'VENDEDOR'],
  ['LUIS A', 'VENDEDOR'],
  ['CARMEN', 'VENDEDOR'],
  ['CONCHITA', 'ADMIN'],
]

function slugify(name) {
  const s = String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return s || 'usuario'
}

const usingSupabase = Boolean(process.env.SUPABASE_DB_URL?.trim())
const pool = new pg.Pool({
  connectionString: stripSslParams(conn),
  ssl: usingSupabase ? { rejectUnauthorized: false } : undefined,
})

async function usernameTaken(u) {
  const r = await pool.query(
    'SELECT 1 FROM usuarios WHERE LOWER(username) = LOWER($1) LIMIT 1',
    [u],
  )
  return r.rowCount > 0
}

/** MAGO suele existir ya: mismo username o mismo nombre con rol CREDITO. */
async function debeOmitirFilaMagoCredito() {
  const r = await pool.query(
    `
    SELECT 1 FROM usuarios
    WHERE LOWER(TRIM(username)) = 'mago'
       OR (UPPER(TRIM(nombre_completo)) = 'MAGO' AND UPPER(TRIM(rol)) = 'CREDITO')
    LIMIT 1
  `,
  )
  return r.rowCount > 0
}

async function pickUsername(nombreCompleto, reservedInRun) {
  const base = slugify(nombreCompleto)
  let candidate = base
  let n = 2
  while (reservedInRun.has(candidate) || (await usernameTaken(candidate))) {
    candidate = `${base}_${n}`
    n += 1
  }
  reservedInRun.add(candidate)
  return candidate
}

try {
  await pool.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS telefono TEXT;
  `)

  const skipMago = await debeOmitirFilaMagoCredito()
  if (skipMago) {
    console.log('[info] Ya hay usuario "mago" o MAGO (CREDITO) — se omite esa fila del listado.\n')
  }

  const encoded = encodeDjangoPassword(plainPassword)
  const reserved = new Set()
  const existing = await pool.query(
    'SELECT LOWER(username) AS u FROM usuarios WHERE TRIM(username) <> \'\'',
  )
  for (const row of existing.rows) {
    reserved.add(row.u)
  }

  let creados = 0
  let omitidos = 0

  for (const [nombreCompleto, rol] of ROWS) {
    const rolU = String(rol).trim().toUpperCase()
    const nombre = String(nombreCompleto).trim()

    if (nombre.toUpperCase() === 'MAGO' && rolU === 'CREDITO' && skipMago) {
      console.log(`omitido  MAGO (CREDITO) — ya existe`)
      omitidos += 1
      continue
    }

    const username = await pickUsername(nombre, reserved)

    const dup = await pool.query(
      'SELECT id, username FROM usuarios WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username],
    )
    if (dup.rowCount > 0) {
      console.log(`omitido  ${nombre} (${rolU}) — username ${username} ya existe`)
      omitidos += 1
      continue
    }

    await pool.query(
      `
      INSERT INTO usuarios (
        password, last_login, is_superuser, username, first_name, last_name, email,
        is_staff, is_active, date_joined, nombre_completo, rol, activo, created_at, telefono
      ) VALUES (
        $1, NULL, false, $2, '', '', '',
        false, true, NOW(), $3, $4, true, NOW(), NULL
      )
    `,
      [encoded, username, nombre, rolU],
    )

    console.log(`creado   ${username.padEnd(14)} | ${nombre.padEnd(12)} | ${rolU}`)
    creados += 1
  }

  console.log(`\nListo: ${creados} creados, ${omitidos} omitidos.`)
  console.log('Todos usan la misma contraseña inicial que pasaste por línea de comandos.')
  console.log('Recomendación: que cada uno cambie su contraseña (perfil) o usa set-user-password.mjs.')
} catch (e) {
  console.error(e)
  process.exit(1)
} finally {
  await pool.end()
}
