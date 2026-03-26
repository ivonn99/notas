import { getPool } from '../db.js'

/** Columna opcional si la BD fue creada antes de exponer teléfono en admin. */
export async function ensureUsuariosOptionalColumns() {
  const pool = getPool()
  await pool.query(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS telefono TEXT;
  `)
}
