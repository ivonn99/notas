import { Router } from 'express'

import { getPool } from '../db.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth, requireRoles('ADMIN', 'CREDITO'))

const EMPRESAS = new Set(['DISTRIBUIDORA', 'RODRIGO'])
const ESTADOS = new Set(['PENDIENTE', 'RESUELTA', 'CANCELADA'])
const DIAS_BUCKETS = new Set(['all', 'r1', 'r2', 'r2b', 'r3', 'r4', 'r5', 'r6'])
const MAX_ROWS = 5000
const ATRASO_UMBRAL_DEFAULT = 50
const ATRASO_PARAM_CLAVE = 'cobranza_umbral_atraso_pct'
const ATRASO_DIAS_CORTE = 30

async function loadUmbralAtrasoPct(pool) {
  try {
    const r = await pool.query('SELECT valor FROM parametros WHERE clave = $1 LIMIT 1', [
      ATRASO_PARAM_CLAVE,
    ])
    const n = Number(r.rows[0]?.valor)
    if (Number.isFinite(n) && n > 0 && n <= 100) return n
  } catch {
    // parametros opcional
  }
  return ATRASO_UMBRAL_DEFAULT
}

function buildComposicionExtraSql({ q, fechaDesde, fechaHasta, rutasList, params }) {
  const parts = []
  if (q) {
    params.push(`%${q}%`)
    const i = params.length
    parts.push(
      `(n.cliente ILIKE $${i} OR n.serie_folio ILIKE $${i} OR COALESCE(n.usuario_vendedor_pv,'') ILIKE $${i} OR COALESCE(r.codigo,'') ILIKE $${i} OR COALESCE(vu.username,'') ILIKE $${i})`,
    )
  }
  if (fechaDesde) {
    params.push(fechaDesde)
    parts.push(`n.fecha_nota::date >= $${params.length}::date`)
  }
  if (fechaHasta) {
    params.push(fechaHasta)
    parts.push(`n.fecha_nota::date <= $${params.length}::date`)
  }
  if (rutasList.length > 0) {
    params.push(rutasList)
    parts.push(`UPPER(TRIM(COALESCE(r.codigo,''))) = ANY($${params.length}::text[])`)
  }
  return parts.length ? ` AND ${parts.join(' AND ')}` : ''
}

const SORT_SQL = {
  saldo_desc: 'lined.saldo DESC NULLS LAST, lined.id DESC',
  saldo_asc: 'lined.saldo ASC NULLS LAST, lined.id ASC',
  dias_desc: 'lined.dias DESC NULLS LAST, lined.id DESC',
  dias_asc: 'lined.dias ASC NULLS LAST, lined.id ASC',
  fecha_desc: 'lined.fecha_nota DESC NULLS LAST, lined.id DESC',
  fecha_asc: 'lined.fecha_nota ASC NULLS LAST, lined.id ASC',
  cliente_asc: 'lined.cliente ASC NULLS LAST, lined.id ASC',
  folio_asc: 'lined.serie_folio ASC NULLS LAST, lined.id ASC',
}

function clasificarBucketDias(dias) {
  const d = Number(dias)
  if (!Number.isFinite(d)) return 'negativo'
  if (d < 0) return 'negativo'
  if (d <= 30) return 'd0_30'
  if (d <= 45) return 'd31_45'
  if (d <= 60) return 'd46_60'
  if (d <= 90) return 'd61_90'
  if (d <= 180) return 'd91_180'
  if (d <= 365) return 'd181_365'
  return 'd366_plus'
}

function diasBucketSql(bucket) {
  const d = 'lined.dias'
  switch (bucket) {
    case 'r1':
      return `${d} >= 0 AND ${d} <= 30`
    case 'r2':
      return `${d} > 30 AND ${d} <= 45`
    case 'r2b':
      return `${d} > 45 AND ${d} <= 60`
    case 'r3':
      return `${d} > 60 AND ${d} <= 90`
    case 'r4':
      return `${d} > 90 AND ${d} <= 180`
    case 'r5':
      return `${d} > 180 AND ${d} <= 365`
    case 'r6':
      return `${d} > 365`
    default:
      return null
  }
}

/**
 * GET /api/reportes/cartera
 * Cartera operativa desde notas_credito (ADMIN / CREDITO).
 * Query: empresa (req), estado (default PENDIENTE; TODOS = sin filtro estado),
 * dias_bucket, q, fecha_desde, fecha_hasta, rutas (códigos separados por coma), sort
 */
router.get('/cartera', async (req, res, next) => {
  try {
    const empresa = String(req.query.empresa ?? '').trim().toUpperCase()
    if (!EMPRESAS.has(empresa)) {
      return res.status(400).json({ ok: false, error: 'empresa requerida: DISTRIBUIDORA o RODRIGO' })
    }

    const params = []
    params.push(empresa)
    let innerWhere = [`n.empresa = $${params.length}`]

    const estadoRaw = String(req.query.estado ?? 'PENDIENTE').trim().toUpperCase()
    if (estadoRaw && estadoRaw !== 'TODOS') {
      if (!ESTADOS.has(estadoRaw)) {
        return res.status(400).json({ ok: false, error: 'estado inválido' })
      }
      params.push(estadoRaw)
      innerWhere.push(`n.estado = $${params.length}`)
    }

    const diasBucket = String(req.query.dias_bucket ?? 'all').trim().toLowerCase()
    if (!DIAS_BUCKETS.has(diasBucket)) {
      return res.status(400).json({ ok: false, error: 'dias_bucket inválido' })
    }

    const q = String(req.query.q ?? '').trim()
    const fechaDesde = String(req.query.fecha_desde ?? '').trim()
    const fechaHasta = String(req.query.fecha_hasta ?? '').trim()
    const rutasRaw = String(req.query.rutas ?? '').trim()
    const debugEnabled = ['1', 'true', 'si', 'sí', 'yes'].includes(
      String(req.query.debug ?? '').trim().toLowerCase(),
    )
    const rutasList = rutasRaw
      ? rutasRaw
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean)
      : []

    const sortKey = String(req.query.sort ?? 'saldo_desc').trim()
    const orderBy = SORT_SQL[sortKey] || SORT_SQL.saldo_desc

    const innerWhereSql = innerWhere.length ? `WHERE ${innerWhere.join(' AND ')}` : ''

    const linedSql = `
      SELECT
        n.id,
        n.serie_folio,
        n.cliente,
        n.empresa,
        n.estado,
        n.monto::float8 AS monto,
        n.abono::float8 AS abono,
        n.saldo::float8 AS saldo,
        n.fecha_nota,
        n.fecha_corriente,
        n.created_at,
        n.usuario_vendedor_pv,
        n.requiere_atencion,
        n.resuelta_automaticamente,
        n.ruta_id,
        n.usuario_id,
        r.codigo AS ruta_codigo,
        vu.username AS vendedor_username,
        EXISTS (SELECT 1 FROM aclaraciones a WHERE a.nota_id = n.id) AS tiene_comentarios,
        CASE
          WHEN n.fecha_nota IS NULL THEN NULL
          ELSE (CURRENT_DATE - n.fecha_nota::date)::int
        END AS dias
      FROM notas_credito n
      LEFT JOIN rutas r ON r.id = n.ruta_id
      LEFT JOIN usuarios vu ON vu.id = n.usuario_id
      ${innerWhereSql}
    `

    const outerParts = []
    const bucketSql = diasBucketSql(diasBucket)
    if (bucketSql) outerParts.push(bucketSql)

    if (q) {
      params.push(`%${q}%`)
      const i = params.length
      outerParts.push(
        `(lined.cliente ILIKE $${i} OR lined.serie_folio ILIKE $${i} OR COALESCE(lined.usuario_vendedor_pv,'') ILIKE $${i} OR COALESCE(lined.ruta_codigo,'') ILIKE $${i} OR COALESCE(lined.vendedor_username,'') ILIKE $${i})`,
      )
    }

    if (fechaDesde) {
      params.push(fechaDesde)
      outerParts.push(`lined.fecha_nota::date >= $${params.length}::date`)
    }
    if (fechaHasta) {
      params.push(fechaHasta)
      outerParts.push(`lined.fecha_nota::date <= $${params.length}::date`)
    }

    if (rutasList.length > 0) {
      params.push(rutasList)
      outerParts.push(`UPPER(TRIM(COALESCE(lined.ruta_codigo,''))) = ANY($${params.length}::text[])`)
    }

    const outerWhereSql = outerParts.length ? `WHERE ${outerParts.join(' AND ')}` : ''

    const pool = getPool()
    const umbralAtrasoPct = await loadUmbralAtrasoPct(pool)

    const aggR = await pool.query(
      `
      WITH lined AS (${linedSql})
      SELECT
        COUNT(*)::int AS registros,
        COALESCE(SUM(lined.saldo), 0)::float8 AS saldo_total,
        COALESCE(SUM(lined.abono), 0)::float8 AS abonos_total,
        COALESCE(SUM(lined.monto), 0)::float8 AS monto_total,
        CASE WHEN COUNT(*) > 0 THEN COALESCE(AVG(lined.dias::numeric), 0)::float8 ELSE 0 END AS dias_promedio,
        COUNT(*) FILTER (WHERE lined.dias > 365)::int AS vencidos_365,
        COUNT(DISTINCT lined.ruta_codigo) FILTER (WHERE lined.ruta_codigo IS NOT NULL AND TRIM(lined.ruta_codigo) <> '')::int AS rutas_activas,
        COUNT(*) FILTER (WHERE lined.requiere_atencion = true)::int AS requiere_atencion,
        COALESCE(SUM(lined.saldo) FILTER (WHERE lined.dias > 90), 0)::float8 AS saldo_mas_90,
        COALESCE(SUM(lined.saldo) FILTER (WHERE lined.dias > 180), 0)::float8 AS saldo_mas_180,
        COUNT(*) FILTER (WHERE lined.dias > 90)::int AS notas_mas_90,
        COUNT(*) FILTER (WHERE lined.dias > 180)::int AS notas_mas_180
      FROM lined
      ${outerWhereSql}
    `,
      params,
    )

    const kpis = aggR.rows[0] || {}
    const montoTotalKpi = Number(kpis.monto_total ?? 0)
    const abonosTotalKpi = Number(kpis.abonos_total ?? 0)
    const registrosKpi = Number(kpis.registros ?? 0)
    const requiereAtencionKpi = Number(kpis.requiere_atencion ?? 0)

    const countR = await pool.query(
      `
      WITH lined AS (${linedSql})
      SELECT COUNT(*)::int AS c FROM lined
      ${outerWhereSql}
    `,
      params,
    )
    const totalFiltered = countR.rows[0]?.c ?? 0

    const listParams = [...params, Math.min(MAX_ROWS, totalFiltered)]
    const limitIdx = listParams.length

    const listR = await pool.query(
      `
      WITH lined AS (${linedSql})
      SELECT * FROM lined
      ${outerWhereSql}
      ORDER BY ${orderBy}
      LIMIT $${limitIdx}
    `,
      listParams,
    )

    const porRutaR = await pool.query(
      `
      WITH lined AS (${linedSql})
      SELECT
        COALESCE(NULLIF(TRIM(lined.ruta_codigo), ''), '(sin ruta)') AS ruta_codigo,
        COUNT(*)::int AS notas,
        COALESCE(SUM(lined.saldo), 0)::float8 AS saldo_total,
        COALESCE(SUM(lined.monto), 0)::float8 AS monto_total,
        COALESCE(SUM(lined.abono), 0)::float8 AS abono_total
      FROM lined
      ${outerWhereSql}
      GROUP BY 1
      ORDER BY saldo_total DESC NULLS LAST, ruta_codigo ASC
      LIMIT 500
    `,
      params,
    )

    const porAntiguedadR = await pool.query(
      `
      WITH lined AS (${linedSql}),
      por_ant AS (
        SELECT
          CASE
            WHEN lined.dias IS NULL THEN 'negativo'
            WHEN lined.dias < 0 THEN 'negativo'
            WHEN lined.dias <= 30 THEN 'd0_30'
            WHEN lined.dias <= 45 THEN 'd31_45'
            WHEN lined.dias <= 60 THEN 'd46_60'
            WHEN lined.dias <= 90 THEN 'd61_90'
            WHEN lined.dias <= 180 THEN 'd91_180'
            WHEN lined.dias <= 365 THEN 'd181_365'
            ELSE 'd366_plus'
          END AS bucket_id,
          COUNT(*)::int AS notas,
          COALESCE(SUM(lined.saldo), 0)::float8 AS saldo_total
        FROM lined
        ${outerWhereSql}
        GROUP BY 1
      )
      SELECT bucket_id, notas, saldo_total
      FROM por_ant
      ORDER BY
        CASE por_ant.bucket_id
          WHEN 'negativo' THEN 0
          WHEN 'd0_30' THEN 1
          WHEN 'd31_45' THEN 2
          WHEN 'd46_60' THEN 3
          WHEN 'd61_90' THEN 4
          WHEN 'd91_180' THEN 5
          WHEN 'd181_365' THEN 6
          WHEN 'd366_plus' THEN 7
        END
    `,
      params,
    )

    const porClienteR = await pool.query(
      `
      WITH lined AS (${linedSql})
      SELECT
        COALESCE(NULLIF(TRIM(lined.cliente), ''), '(sin cliente)') AS cliente,
        COUNT(*)::int AS notas,
        COALESCE(SUM(lined.saldo), 0)::float8 AS saldo_total
      FROM lined
      ${outerWhereSql}
      GROUP BY 1
      ORDER BY saldo_total DESC NULLS LAST, cliente ASC
      LIMIT 15
    `,
      params,
    )

    const porSituacionR = await pool.query(
      `
      WITH lined AS (${linedSql}),
      filtered AS (
        SELECT * FROM lined
        ${outerWhereSql}
      )
      SELECT situacion_id, notas, saldo_total
      FROM (
        SELECT 'requiere_atencion' AS situacion_id,
          COUNT(*)::int AS notas,
          COALESCE(SUM(saldo), 0)::float8 AS saldo_total
        FROM filtered WHERE requiere_atencion = true
        UNION ALL
        SELECT 'sin_comentarios',
          COUNT(*)::int,
          COALESCE(SUM(saldo), 0)::float8
        FROM filtered WHERE tiene_comentarios = false
        UNION ALL
        SELECT 'sin_ruta',
          COUNT(*)::int,
          COALESCE(SUM(saldo), 0)::float8
        FROM filtered WHERE ruta_codigo IS NULL OR TRIM(ruta_codigo) = ''
        UNION ALL
        SELECT 'sin_vendedor',
          COUNT(*)::int,
          COALESCE(SUM(saldo), 0)::float8
        FROM filtered
        WHERE COALESCE(TRIM(usuario_vendedor_pv), '') = ''
          AND vendedor_username IS NULL
          AND usuario_id IS NULL
        UNION ALL
        SELECT 'antiguedad_90',
          COUNT(*)::int,
          COALESCE(SUM(saldo), 0)::float8
        FROM filtered WHERE dias > 90
        UNION ALL
        SELECT 'antiguedad_180',
          COUNT(*)::int,
          COALESCE(SUM(saldo), 0)::float8
        FROM filtered WHERE dias > 180
        UNION ALL
        SELECT 'saldo_cero',
          COUNT(*)::int,
          COALESCE(SUM(saldo), 0)::float8
        FROM filtered WHERE COALESCE(saldo, 0) <= 0
        UNION ALL
        SELECT 'resuelta_automatica',
          COUNT(*)::int,
          COALESCE(SUM(saldo), 0)::float8
        FROM filtered WHERE resuelta_automaticamente = true
      ) s
      WHERE notas > 0
      ORDER BY saldo_total DESC NULLS LAST, situacion_id ASC
    `,
      params,
    )

    const compParams = [empresa]
    const compExtraSql = buildComposicionExtraSql({
      q,
      fechaDesde,
      fechaHasta,
      rutasList,
      params: compParams,
    })
    compParams.push(umbralAtrasoPct)
    const umbralIdx = compParams.length

    const atrasoEstructuralR = await pool.query(
      `
      WITH lined AS (
        SELECT
          COALESCE(NULLIF(TRIM(n.cliente), ''), '(sin cliente)') AS cliente,
          n.saldo::float8 AS saldo,
          CASE
            WHEN n.fecha_nota IS NULL THEN NULL
            ELSE (CURRENT_DATE - n.fecha_nota::date)::int
          END AS dias
        FROM notas_credito n
        LEFT JOIN rutas r ON r.id = n.ruta_id
        LEFT JOIN usuarios vu ON vu.id = n.usuario_id
        WHERE n.empresa = $1
          AND n.estado = 'PENDIENTE'
          AND n.saldo > 0
          ${compExtraSql}
      ),
      agg AS (
        SELECT
          cliente,
          COUNT(*)::int AS notas,
          COALESCE(SUM(saldo) FILTER (
            WHERE dias IS NOT NULL AND dias >= 0 AND dias <= ${ATRASO_DIAS_CORTE}
          ), 0)::float8 AS saldo_0_30,
          COALESCE(SUM(saldo) FILTER (
            WHERE dias IS NULL OR dias < 0 OR dias > ${ATRASO_DIAS_CORTE}
          ), 0)::float8 AS saldo_mas_30
        FROM lined
        GROUP BY cliente
      )
      SELECT
        cliente,
        notas,
        saldo_0_30,
        saldo_mas_30,
        (saldo_0_30 + saldo_mas_30)::float8 AS saldo_total,
        CASE
          WHEN (saldo_0_30 + saldo_mas_30) > 0 THEN
            ROUND((saldo_mas_30 / (saldo_0_30 + saldo_mas_30) * 100)::numeric, 1)::float8
          ELSE 0
        END AS pct_mas_30,
        (
          saldo_mas_30 > saldo_0_30
          OR (
            (saldo_0_30 + saldo_mas_30) > 0
            AND (saldo_mas_30 / (saldo_0_30 + saldo_mas_30) * 100) > $${umbralIdx}
          )
        ) AS atraso_estructural
      FROM agg
      ORDER BY atraso_estructural DESC, pct_mas_30 DESC, saldo_total DESC, cliente ASC
    `,
      compParams,
    )

    const atrasoItems = atrasoEstructuralR.rows.map((row) => ({
      ...row,
      atraso_estructural: Boolean(row.atraso_estructural),
    }))
    const atrasoCon = atrasoItems.filter((r) => r.atraso_estructural)
    const saldoCarteraComp = atrasoItems.reduce((s, r) => s + Number(r.saldo_total || 0), 0)
    const saldoAtrasoComp = atrasoCon.reduce((s, r) => s + Number(r.saldo_total || 0), 0)

    const atrasoEstructuralRutaR = await pool.query(
      `
      WITH lined AS (
        SELECT
          COALESCE(NULLIF(TRIM(r.codigo), ''), '(sin ruta)') AS ruta_codigo,
          n.saldo::float8 AS saldo,
          CASE
            WHEN n.fecha_nota IS NULL THEN NULL
            ELSE (CURRENT_DATE - n.fecha_nota::date)::int
          END AS dias
        FROM notas_credito n
        LEFT JOIN rutas r ON r.id = n.ruta_id
        LEFT JOIN usuarios vu ON vu.id = n.usuario_id
        WHERE n.empresa = $1
          AND n.estado = 'PENDIENTE'
          AND n.saldo > 0
          ${compExtraSql}
      ),
      agg AS (
        SELECT
          ruta_codigo,
          COUNT(*)::int AS notas,
          COALESCE(SUM(saldo) FILTER (
            WHERE dias IS NOT NULL AND dias >= 0 AND dias <= ${ATRASO_DIAS_CORTE}
          ), 0)::float8 AS saldo_0_30,
          COALESCE(SUM(saldo) FILTER (
            WHERE dias IS NULL OR dias < 0 OR dias > ${ATRASO_DIAS_CORTE}
          ), 0)::float8 AS saldo_mas_30
        FROM lined
        GROUP BY ruta_codigo
      )
      SELECT
        ruta_codigo,
        notas,
        saldo_0_30,
        saldo_mas_30,
        (saldo_0_30 + saldo_mas_30)::float8 AS saldo_total,
        CASE
          WHEN (saldo_0_30 + saldo_mas_30) > 0 THEN
            ROUND((saldo_mas_30 / (saldo_0_30 + saldo_mas_30) * 100)::numeric, 1)::float8
          ELSE 0
        END AS pct_mas_30,
        (
          saldo_mas_30 > saldo_0_30
          OR (
            (saldo_0_30 + saldo_mas_30) > 0
            AND (saldo_mas_30 / (saldo_0_30 + saldo_mas_30) * 100) > $${umbralIdx}
          )
        ) AS atraso_estructural
      FROM agg
      ORDER BY atraso_estructural DESC, pct_mas_30 DESC, saldo_total DESC, ruta_codigo ASC
    `,
      compParams,
    )

    const atrasoRutaItems = atrasoEstructuralRutaR.rows.map((row) => ({
      ...row,
      atraso_estructural: Boolean(row.atraso_estructural),
    }))
    const atrasoRutaCon = atrasoRutaItems.filter((r) => r.atraso_estructural)
    const saldoAtrasoRutasComp = atrasoRutaCon.reduce((s, r) => s + Number(r.saldo_total || 0), 0)

    const resumenPivotR = await pool.query(
      `
      WITH lined AS (${linedSql}),
      base AS (
        SELECT
          CASE
            WHEN lined.dias IS NULL OR lined.dias < 0 THEN 'negativo'
            WHEN lined.dias <= 30 THEN 'd0_30'
            WHEN lined.dias <= 45 THEN 'd31_45'
            WHEN lined.dias <= 60 THEN 'd46_60'
            WHEN lined.dias <= 90 THEN 'd61_90'
            WHEN lined.dias <= 180 THEN 'd91_180'
            WHEN lined.dias <= 365 THEN 'd181_365'
            ELSE 'd366_plus'
          END AS bucket_id,
          COALESCE(NULLIF(TRIM(lined.ruta_codigo), ''), '(sin ruta)') AS ruta_codigo,
          COALESCE(lined.saldo, 0)::float8 AS saldo
        FROM lined
        ${outerWhereSql}
      )
      SELECT
        bucket_id,
        ruta_codigo,
        COUNT(*)::int AS notas,
        COALESCE(SUM(saldo), 0)::float8 AS saldo_total
      FROM base
      GROUP BY bucket_id, ruta_codigo
      ORDER BY
        CASE bucket_id
          WHEN 'negativo' THEN 0
          WHEN 'd0_30' THEN 1
          WHEN 'd31_45' THEN 2
          WHEN 'd46_60' THEN 3
          WHEN 'd61_90' THEN 4
          WHEN 'd91_180' THEN 5
          WHEN 'd181_365' THEN 6
          WHEN 'd366_plus' THEN 7
        END,
        ruta_codigo ASC
    `,
      params,
    )

    /** @type {any} */
    const response = {
      ok: true,
      empresa,
      estadoFiltro: estadoRaw === 'TODOS' ? null : estadoRaw || 'PENDIENTE',
      filters: {
        dias_bucket: diasBucket,
        q: q || null,
        fecha_desde: fechaDesde || null,
        fecha_hasta: fechaHasta || null,
        rutas: rutasList.length ? rutasList : null,
        sort: sortKey,
      },
      kpis: {
        registros: registrosKpi,
        saldo_total: kpis.saldo_total ?? 0,
        abonos_total: abonosTotalKpi,
        monto_total: montoTotalKpi,
        dias_promedio: kpis.dias_promedio ?? 0,
        vencidos_365: kpis.vencidos_365 ?? 0,
        rutas_activas: kpis.rutas_activas ?? 0,
        requiere_atencion: requiereAtencionKpi,
        requiere_atencion_pct:
          registrosKpi > 0 ? Math.round((requiereAtencionKpi / registrosKpi) * 1000) / 10 : 0,
        pct_recuperado:
          montoTotalKpi > 0 ? Math.round((abonosTotalKpi / montoTotalKpi) * 1000) / 10 : 0,
        saldo_mas_90: kpis.saldo_mas_90 ?? 0,
        saldo_mas_180: kpis.saldo_mas_180 ?? 0,
        notas_mas_90: kpis.notas_mas_90 ?? 0,
        notas_mas_180: kpis.notas_mas_180 ?? 0,
        atraso_estructural_clientes: atrasoCon.length,
        atraso_estructural_clientes_pct:
          atrasoItems.length > 0
            ? Math.round((atrasoCon.length / atrasoItems.length) * 1000) / 10
            : 0,
        atraso_estructural_saldo: saldoAtrasoComp,
        atraso_estructural_rutas: atrasoRutaCon.length,
        atraso_estructural_rutas_pct:
          atrasoRutaItems.length > 0
            ? Math.round((atrasoRutaCon.length / atrasoRutaItems.length) * 1000) / 10
            : 0,
      },
      atrasoEstructural: {
        umbral_pct: umbralAtrasoPct,
        dias_corte: ATRASO_DIAS_CORTE,
        clientes_total: atrasoItems.length,
        clientes_atraso: atrasoCon.length,
        clientes_atraso_pct:
          atrasoItems.length > 0
            ? Math.round((atrasoCon.length / atrasoItems.length) * 1000) / 10
            : 0,
        saldo_cartera_total: saldoCarteraComp,
        saldo_atraso_total: saldoAtrasoComp,
        rutas_total: atrasoRutaItems.length,
        rutas_atraso: atrasoRutaCon.length,
        rutas_atraso_pct:
          atrasoRutaItems.length > 0
            ? Math.round((atrasoRutaCon.length / atrasoRutaItems.length) * 1000) / 10
            : 0,
        saldo_atraso_rutas_total: saldoAtrasoRutasComp,
        items: atrasoItems,
        porRuta: atrasoRutaItems,
      },
      total: totalFiltered,
      truncated: totalFiltered > MAX_ROWS,
      maxRows: MAX_ROWS,
      porRuta: porRutaR.rows,
      porAntiguedad: porAntiguedadR.rows,
      porCliente: porClienteR.rows,
      porSituacion: porSituacionR.rows,
      resumenPivot: resumenPivotR.rows,
      items: listR.rows,
    }

    if (debugEnabled) {
      const debugSample = listR.rows.slice(0, 20).map((it) => ({
        id: it.id,
        serie_folio: it.serie_folio,
        fecha_nota: it.fecha_nota,
        dias: it.dias,
        bucket_calculado: clasificarBucketDias(it.dias),
        ruta_codigo: it.ruta_codigo ?? null,
        saldo: Number(it.saldo || 0),
      }))
      const byBucket = {}
      for (const s of debugSample) {
        byBucket[s.bucket_calculado] = (byBucket[s.bucket_calculado] || 0) + 1
      }
      response.debug = {
        enabled: true,
        criterio: {
          dias: 'CURRENT_DATE - fecha_nota::date',
          buckets: {
            negativo: 'dias null o dias < 0',
            d0_30: '0..30',
            d31_45: '31..45',
            d46_60: '46..60',
            d61_90: '61..90',
            d91_180: '91..180',
            d181_365: '181..365',
            d366_plus: '>365',
          },
        },
        sample_size: debugSample.length,
        sample_by_bucket: byBucket,
        sample_rows: debugSample,
      }
      console.info('[reportes:debug]', {
        requestId: req.requestId || null,
        empresa,
        total: totalFiltered,
        sampleSize: debugSample.length,
      })
    }

    res.json(response)
  } catch (e) {
    next(e)
  }
})

export default router
