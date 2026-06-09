import { compareFechaNotaDb, diasDesdeFechaNota } from './diasCorriente.js'

function toTimestamp(value) {
  if (value == null || value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/** Reordena filas ya cargadas (p. ej. tras fusionar páginas del scroll infinito). */
export function stabilizeSeguimientoItemsOrder(items, sort) {
  const rows = [...(items || [])]
  if (sort === 'fecha_nota_asc') {
    return rows.sort(
      (a, b) => compareFechaNotaDb(a.fecha_nota, b.fecha_nota) || (a.id || 0) - (b.id || 0),
    )
  }
  if (sort === 'fecha_nota_desc') {
    return rows.sort(
      (a, b) => compareFechaNotaDb(b.fecha_nota, a.fecha_nota) || (b.id || 0) - (a.id || 0),
    )
  }
  if (sort === 'fecha_ultima_asc') {
    return rows.sort((a, b) => {
      const ta = toTimestamp(a.fecha_ultima_actualizacion) ?? Number.POSITIVE_INFINITY
      const tb = toTimestamp(b.fecha_ultima_actualizacion) ?? Number.POSITIVE_INFINITY
      return ta - tb || (a.id || 0) - (b.id || 0)
    })
  }
  if (sort === 'fecha_ultima_desc') {
    return rows.sort((a, b) => {
      const ta = toTimestamp(a.fecha_ultima_actualizacion) ?? Number.NEGATIVE_INFINITY
      const tb = toTimestamp(b.fecha_ultima_actualizacion) ?? Number.NEGATIVE_INFINITY
      return tb - ta || (b.id || 0) - (a.id || 0)
    })
  }
  if (sort === 'dias_corriente_asc') {
    return rows.sort((a, b) => {
      const da = diasDesdeFechaNota(a.fecha_nota) ?? -1
      const db = diasDesdeFechaNota(b.fecha_nota) ?? -1
      return da - db || (a.id || 0) - (b.id || 0)
    })
  }
  if (sort === 'dias_corriente_desc') {
    return rows.sort((a, b) => {
      const da = diasDesdeFechaNota(a.fecha_nota) ?? -1
      const db = diasDesdeFechaNota(b.fecha_nota) ?? -1
      return db - da || (b.id || 0) - (a.id || 0)
    })
  }
  return rows
}
