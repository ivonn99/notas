import { getPool } from '../db.js'

/** Alineado a guia.txt (NotaCredito): columna opcional si la BD es antigua. */
export async function ensureNotasOptionalColumns() {
  const pool = getPool()
  await pool.query(`
    ALTER TABLE notas_credito
    ADD COLUMN IF NOT EXISTS resuelta_automaticamente BOOLEAN NOT NULL DEFAULT false;
  `)
}
