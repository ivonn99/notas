/**
 * Días calendario entre fecha_nota y fecha_corriente ("día corriente" en BD).
 * Si no hay fecha_corriente, se usa la fecha local de hoy.
 * @param {unknown} fechaNota
 * @param {unknown} fechaCorriente
 * @returns {number | null}
 */
export function diasEntreNotaYCorriente(fechaNota, fechaCorriente) {
  const ymdNota = ymdFromDbValue(fechaNota)
  if (!ymdNota) return null
  const ymdCor = ymdFromDbValue(fechaCorriente) ?? ymdTodayLocal()
  const t0 = Date.UTC(ymdNota.y, ymdNota.m - 1, ymdNota.d)
  const t1 = Date.UTC(ymdCor.y, ymdCor.m - 1, ymdCor.d)
  return Math.round((t1 - t0) / 86400000)
}

export function ymdFromDbValue(v) {
  if (v == null || v === '') return null
  const s = String(v).trim()
  const m = s.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null
  return { y, m: mo, d }
}

function ymdTodayLocal() {
  const t = new Date()
  return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
}

/** Días calendario desde fecha_nota hasta hoy (mismo criterio que el reporte). */
export function diasDesdeFechaNota(fechaNota) {
  return diasEntreNotaYCorriente(fechaNota, null)
}

export function formatDiasNotaCorriente(fechaNota) {
  const n = diasDesdeFechaNota(fechaNota)
  if (n == null) return '—'
  return String(n)
}

/** Fecha calendario de BD (sin desfase por zona horaria). */
export function formatFechaNotaDb(value) {
  const ymd = ymdFromDbValue(value)
  if (!ymd) return '—'
  const day = String(ymd.d).padStart(2, '0')
  const month = String(ymd.m).padStart(2, '0')
  return `${day}/${month}/${ymd.y}`
}

export function compareFechaNotaDb(a, b) {
  const ya = ymdFromDbValue(a)
  const yb = ymdFromDbValue(b)
  if (!ya && !yb) return 0
  if (!ya) return 1
  if (!yb) return -1
  if (ya.y !== yb.y) return ya.y - yb.y
  if (ya.m !== yb.m) return ya.m - yb.m
  return ya.d - yb.d
}
