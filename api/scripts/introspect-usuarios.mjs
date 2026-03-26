import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const pool = new pg.Pool({ connectionString: process.env.NEON_DATABASE_URL })
const r = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'usuarios'
  ORDER BY ordinal_position
`)
console.log(JSON.stringify(r.rows, null, 2))
await pool.end()
