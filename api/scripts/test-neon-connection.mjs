/**
 * Prueba rápida: lee api/.env y verifica conexión + tablas básicas.
 */
import dotenv from 'dotenv'
import pg from 'pg'

dotenv.config({ path: new URL('../.env', import.meta.url) })

const url = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Falta NEON_DATABASE_URL o DATABASE_URL en api/.env')
  process.exit(1)
}

let host = '(desconocido)'
try {
  host = new URL(url.replace(/^postgres/, 'http')).hostname
} catch {
  /* ignore */
}

console.log('Host configurado:', host)

const pool = new pg.Pool({ connectionString: url })

const info = await pool.query(`
  SELECT current_database() AS db,
         version() AS version_line
`)
console.log('Base actual:', info.rows[0].db)
console.log('PostgreSQL:', info.rows[0].version_line.split(',')[0])

let usuarios = '?'
let notas = '?'
try {
  const c = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios')
  usuarios = c.rows[0].n
} catch (e) {
  usuarios = '(error: ' + e.message + ')'
}
try {
  const c = await pool.query('SELECT COUNT(*)::int AS n FROM notas_credito')
  notas = c.rows[0].n
} catch (e) {
  notas = '(tabla ausente o error)'
}
console.log('Filas — usuarios:', usuarios, '| notas_credito:', notas)

console.log('Resultado: conexión OK (misma cadena que usa el API).')
await pool.end()
