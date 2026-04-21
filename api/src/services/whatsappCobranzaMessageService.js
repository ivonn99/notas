import { getPool } from '../db.js'

export const EMPRESAS_WHATSAPP = new Set(['DISTRIBUIDORA', 'RODRIGO'])

const EMPRESA_ETIQUETA = {
  DISTRIBUIDORA: 'Distribuidora',
  RODRIGO: 'Rodrigo',
}

function fmtFechaNota(value) {
  if (value == null) return '—'
  if (value instanceof Date) {
    const d = String(value.getUTCDate()).padStart(2, '0')
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const y = value.getUTCFullYear()
    return `${d}/${m}/${y}`
  }
  const s = String(value).trim()
  const iso = s.slice(0, 10)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const parsed = new Date(s)
  if (!Number.isNaN(parsed.getTime())) {
    const d = String(parsed.getUTCDate()).padStart(2, '0')
    const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0')
    const y = parsed.getUTCFullYear()
    return `${d}/${mm}/${y}`
  }
  return s
}

function fmtSaldo(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function nombreSaludo(row) {
  const nc = String(row.nombre_completo ?? '').trim()
  if (nc) return nc.split(/\s+/)[0] || nc
  return String(row.username ?? '').trim() || 'colega'
}

function armarMensaje({ empresaKey, nombre, rutasOrdenadas, diasMin, diasMax }) {
  const etiqueta = EMPRESA_ETIQUETA[empresaKey] || empresaKey
  const lines = []
  lines.push(`Hola ${nombre},`)
  lines.push('')
  const rangoTxt =
    Number.isFinite(diasMax) && diasMax > 0
      ? `entre ${diasMin} y ${diasMax} días`
      : `más de ${diasMin} días`
  lines.push(`Te recordamos que puedas acudir a resolver las siguientes notas de crédito de ${etiqueta} con antigüedad ${rangoTxt} (según fecha nota):`)
  lines.push('')
  for (const ruta of rutasOrdenadas) {
    lines.push(`Ruta ${ruta.codigo}:`)
    for (const n of ruta.notas) {
      lines.push(
        `• ${n.serieFolio} — ${n.cliente} — Saldo ${n.saldoFmt} — ${n.dias} días (fecha ${n.fechaFmt})`,
      )
    }
    lines.push('')
  }
  lines.push('Gracias por tu atención.')
  return lines.join('\n').trim()
}

export async function buildMensajesPendientesPayload({ empresa, diasMin, diasMax }) {
  const pool = getPool()
  const r = await pool.query(
    `
      SELECT DISTINCT ON (u.id, n.id)
        u.id AS usuario_id,
        u.username,
        u.nombre_completo,
        u.telefono,
        UPPER(TRIM(r.codigo)) AS ruta_codigo,
        n.id AS nota_id,
        n.serie_folio,
        n.cliente,
        n.saldo::float8 AS saldo,
        n.fecha_nota::date AS fecha_nota,
        (CURRENT_DATE - n.fecha_nota::date)::int AS dias
      FROM notas_credito n
      INNER JOIN rutas r ON r.id = n.ruta_id
      INNER JOIN usuario_rutas ur ON ur.ruta_id = n.ruta_id
      INNER JOIN usuarios u ON u.id = ur.usuario_id
      WHERE n.empresa = $1
        AND n.estado = 'PENDIENTE'
        AND n.fecha_nota IS NOT NULL
        AND (CURRENT_DATE - n.fecha_nota::date) >= $2
        AND ($3::int IS NULL OR (CURRENT_DATE - n.fecha_nota::date) <= $3::int)
        AND COALESCE(u.is_active, true) = true
        AND COALESCE(u.activo, true) = true
        AND COALESCE(r.activa, true) = true
      ORDER BY u.id ASC, n.id ASC, ruta_codigo ASC, dias DESC, saldo DESC
    `,
    [empresa, diasMin, diasMax],
  )

  const byUser = new Map()
  for (const row of r.rows) {
    const uid = row.usuario_id
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        usuarioId: uid,
        username: row.username,
        nombreCompleto: row.nombre_completo,
        telefono: row.telefono,
        rutas: new Map(),
      })
    }
    const entry = byUser.get(uid)
    const codigo = row.ruta_codigo || '(sin código)'
    if (!entry.rutas.has(codigo)) {
      entry.rutas.set(codigo, [])
    }
    entry.rutas.get(codigo).push({
      notaId: row.nota_id,
      serieFolio: String(row.serie_folio ?? '').trim() || `ID ${row.nota_id}`,
      cliente: String(row.cliente ?? '').trim() || '—',
      saldo: row.saldo,
      dias: row.dias,
      fechaFmt: fmtFechaNota(row.fecha_nota),
      saldoFmt: fmtSaldo(row.saldo),
    })
  }

  const usuarios = []
  for (const u of byUser.values()) {
    const rutasOrdenadas = [...u.rutas.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
      .map(([codigo, notas]) => ({ codigo, notas }))

    const saludo = nombreSaludo({
      nombre_completo: u.nombreCompleto,
      username: u.username,
    })
    const mensaje = armarMensaje({
      empresaKey: empresa,
      nombre: saludo,
      rutasOrdenadas,
      diasMin,
      diasMax,
    })

    usuarios.push({
      usuarioId: u.usuarioId,
      username: u.username,
      nombreCompleto: u.nombreCompleto,
      nombreSaludo: saludo,
      telefono: u.telefono,
      rutas: rutasOrdenadas.map((rr) => ({
        codigo: rr.codigo,
        notas: rr.notas.map((n) => ({
          notaId: n.notaId,
          serieFolio: n.serieFolio,
          cliente: n.cliente,
          saldo: n.saldo,
          dias: n.dias,
          fechaNota: n.fechaFmt,
          saldoFmt: n.saldoFmt,
        })),
      })),
      mensaje,
    })
  }

  return {
    ok: true,
    empresa,
    diasMin,
    diasMax,
    totalUsuarios: usuarios.length,
    totalNotas: r.rows.length,
    usuarios,
  }
}
