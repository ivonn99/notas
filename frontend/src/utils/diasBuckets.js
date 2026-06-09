export const DIAS_BUCKET_IDS = ['r1', 'r2', 'r2b', 'r3', 'r4', 'r5', 'r6']

/** Chips de filtro por tramo (sin «Todos»). */
export const DIAS_BUCKETS_FILTER = [
  { id: 'r1', label: '0–30 d' },
  { id: 'r2', label: '31–45 d' },
  { id: 'r2b', label: '46–60 d' },
  { id: 'r3', label: '61–90 d' },
  { id: 'r4', label: '91–180 d' },
  { id: 'r5', label: '181–365 d' },
  { id: 'r6', label: '>365 d' },
]

export const DIAS_BUCKET_LABELS = {
  r1: '0–30 días',
  r2: '31–45 días',
  r2b: '46–60 días',
  r3: '61–90 días',
  r4: '91–180 días',
  r5: '181–365 días',
  r6: '>365 días',
}

/** Parsea ids de tramo separados por coma (sin duplicados, orden de aparición). */
export function parseDiasBucketsList(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return []
  return [
    ...new Set(
      s
        .split(',')
        .map((part) => part.trim().toLowerCase())
        .filter((id) => DIAS_BUCKET_IDS.includes(id)),
    ),
  ]
}

/** Serializa lista de tramos para store / query string. */
export function formatDiasBucketsList(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return ''
  return parseDiasBucketsList(ids.join(','))
}

function ymdDaysAgo(days) {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const d = new Date(today.getTime() - days * 24 * 60 * 60 * 1000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Rango de fecha_nota para un tramo (mismo criterio que el reporte: hoy − fecha_nota). */
export function diasBucketToDateRange(bucket) {
  switch (bucket) {
    case 'r1':
      return { desde: ymdDaysAgo(30), hasta: null }
    case 'r2':
      return { desde: ymdDaysAgo(45), hasta: ymdDaysAgo(30) }
    case 'r2b':
      return { desde: ymdDaysAgo(60), hasta: ymdDaysAgo(45) }
    case 'r3':
      return { desde: ymdDaysAgo(90), hasta: ymdDaysAgo(60) }
    case 'r4':
      return { desde: ymdDaysAgo(180), hasta: ymdDaysAgo(90) }
    case 'r5':
      return { desde: ymdDaysAgo(365), hasta: ymdDaysAgo(180) }
    case 'r6':
      return { desde: null, hasta: ymdDaysAgo(365) }
    default:
      return null
  }
}

/** Cláusula `.or()` de PostgREST para combinar varios tramos. */
export function buildDiasBucketsSupabaseOr(buckets) {
  const parts = []
  for (const bucket of buckets) {
    const range = diasBucketToDateRange(bucket)
    if (!range) continue
    const andParts = ['fecha_nota.not.is.null']
    if (range.desde) andParts.push(`fecha_nota.gte.${range.desde}`)
    if (range.hasta) andParts.push(`fecha_nota.lt.${range.hasta}`)
    parts.push(`and(${andParts.join(',')})`)
  }
  return parts.length ? parts.join(',') : null
}
