export const ATRASO_ESTRUCTURAL_DIAS_CORTE = 30
export const ATRASO_ESTRUCTURAL_UMBRAL_DEFAULT = 50
export const PARAM_UMBRAL_ATRASO_CLAVE = 'cobranza_umbral_atraso_pct'

export function parseUmbralAtrasoPct(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0 || n > 100) return ATRASO_ESTRUCTURAL_UMBRAL_DEFAULT
  return n
}

/** Saldo en tramo 0–30 días desde fecha_nota (días null o negativos → cartera antigua). */
export function isSaldoCarteraReciente(dias) {
  const d = Number(dias)
  return Number.isFinite(d) && d >= 0 && d <= ATRASO_ESTRUCTURAL_DIAS_CORTE
}

export function evalAtrasoEstructural(saldo0_30, saldoMas30, umbralPct) {
  const s0 = Number(saldo0_30) || 0
  const s1 = Number(saldoMas30) || 0
  const total = s0 + s1
  if (total <= 0) {
    return { atraso_estructural: false, pct_mas_30: 0, saldo_total: 0 }
  }
  const pct = (s1 / total) * 100
  const umbral = parseUmbralAtrasoPct(umbralPct)
  return {
    atraso_estructural: s1 > s0 || pct > umbral,
    pct_mas_30: Math.round(pct * 10) / 10,
    saldo_total: total,
  }
}

/**
 * @param {Array<{ saldo?: number, dias?: number | null }>} rows
 * @param {number} umbralPct
 * @param {(row: object) => string} getGroupKey
 * @param {string} labelField
 */
function buildAtrasoEstructuralPorGrupo(rows, umbralPct, getGroupKey, labelField) {
  const map = new Map()
  for (const r of rows) {
    const saldo = Number(r.saldo || 0)
    if (saldo <= 0) continue
    const key = getGroupKey(r)
    const prev = map.get(key) || { [labelField]: key, notas: 0, saldo_0_30: 0, saldo_mas_30: 0 }
    prev.notas += 1
    if (isSaldoCarteraReciente(r.dias)) prev.saldo_0_30 += saldo
    else prev.saldo_mas_30 += saldo
    map.set(key, prev)
  }

  const items = []
  for (const c of map.values()) {
    const ev = evalAtrasoEstructural(c.saldo_0_30, c.saldo_mas_30, umbralPct)
    items.push({
      [labelField]: c[labelField],
      notas: c.notas,
      saldo_0_30: c.saldo_0_30,
      saldo_mas_30: c.saldo_mas_30,
      saldo_total: ev.saldo_total,
      pct_mas_30: ev.pct_mas_30,
      atraso_estructural: ev.atraso_estructural,
    })
  }
  items.sort(
    (a, b) =>
      Number(b.atraso_estructural) - Number(a.atraso_estructural) ||
      b.pct_mas_30 - a.pct_mas_30 ||
      b.saldo_total - a.saldo_total ||
      String(a[labelField]).localeCompare(String(b[labelField])),
  )
  return items
}

/**
 * @param {Array<{ cliente?: string, saldo?: number, dias?: number | null }>} rows
 * @param {number} umbralPct
 */
export function buildAtrasoEstructuralPorCliente(rows, umbralPct) {
  return buildAtrasoEstructuralPorGrupo(
    rows,
    umbralPct,
    (r) => (r.cliente && String(r.cliente).trim() ? String(r.cliente).trim() : '(sin cliente)'),
    'cliente',
  )
}

/**
 * @param {Array<{ ruta_codigo?: string | null, saldo?: number, dias?: number | null }>} rows
 * @param {number} umbralPct
 */
export function buildAtrasoEstructuralPorRuta(rows, umbralPct) {
  return buildAtrasoEstructuralPorGrupo(
    rows,
    umbralPct,
    (r) =>
      r.ruta_codigo && String(r.ruta_codigo).trim()
        ? String(r.ruta_codigo).trim()
        : '(sin ruta)',
    'ruta_codigo',
  )
}

export function summarizeAtrasoEstructuralGrupos(items, umbralPct, totalLabel, atrasoLabel) {
  const gruposTotal = items.length
  const conAtraso = items.filter((i) => i.atraso_estructural)
  const saldoCartera = items.reduce((s, i) => s + Number(i.saldo_total || 0), 0)
  const saldoAtraso = conAtraso.reduce((s, i) => s + Number(i.saldo_total || 0), 0)
  return {
    umbral_pct: parseUmbralAtrasoPct(umbralPct),
    dias_corte: ATRASO_ESTRUCTURAL_DIAS_CORTE,
    [totalLabel]: gruposTotal,
    [atrasoLabel]: conAtraso.length,
    [`${atrasoLabel}_pct`]:
      gruposTotal > 0 ? Math.round((conAtraso.length / gruposTotal) * 1000) / 10 : 0,
    saldo_cartera_total: saldoCartera,
    saldo_atraso_total: saldoAtraso,
  }
}

export function summarizeAtrasoEstructural(items, umbralPct) {
  const base = summarizeAtrasoEstructuralGrupos(
    items,
    umbralPct,
    'clientes_total',
    'clientes_atraso',
  )
  return {
    ...base,
    clientes_atraso_pct: base.clientes_atraso_pct,
  }
}

export function buildAtrasoEstructuralPayload(rows, umbralPct) {
  const items = buildAtrasoEstructuralPorCliente(rows, umbralPct)
  const porRuta = buildAtrasoEstructuralPorRuta(rows, umbralPct)
  const resumen = summarizeAtrasoEstructural(items, umbralPct)
  const resumenRutas = summarizeAtrasoEstructuralGrupos(
    porRuta,
    umbralPct,
    'rutas_total',
    'rutas_atraso',
  )
  return {
    ...resumen,
    items,
    porRuta,
    rutas_total: resumenRutas.rutas_total,
    rutas_atraso: resumenRutas.rutas_atraso,
    rutas_atraso_pct: resumenRutas.rutas_atraso_pct,
    saldo_atraso_rutas_total: resumenRutas.saldo_atraso_total,
  }
}
