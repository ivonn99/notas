import { getSupabaseAuthMeta } from '../lib/supabaseAuth.js'
import { supabase } from '../lib/supabaseClient.js'

function limpiezaDebugEnabled() {
  if (import.meta.env.DEV) return true
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG_LIMPIEZA') === '1'
  } catch {
    return false
  }
}

function logLimpieza(level, step, payload = {}) {
  if (!limpiezaDebugEnabled() && level === 'debug') return
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(`[limpieza-notas] ${step}`, payload)
}

function msSince(t0) {
  return Math.round(performance.now() - t0)
}

function assertSoloAdmin(meta) {
  if (!(meta?.isSuperuser || meta?.rol === 'ADMIN')) {
    throw new Error('Solo ADMIN puede limpiar notas cerradas')
  }
}

function sanitizeDias(raw) {
  const n = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(n) || n < 1 || n > 3650) {
    throw new Error('Los días mínimos deben estar entre 1 y 3650')
  }
  return n
}

function sanitizeEmpresa(raw) {
  const e = String(raw ?? '').trim().toUpperCase()
  if (!e) return null
  if (e !== 'DISTRIBUIDORA' && e !== 'RODRIGO') {
    throw new Error('Empresa inválida')
  }
  return e
}

function storageObjectPath(rutaArchivo, bucket) {
  const raw = String(rutaArchivo || '').trim()
  if (!raw || !bucket) return null
  const publicMarker = `/storage/v1/object/public/${bucket}/`
  const signMarker = `/storage/v1/object/sign/${bucket}/`
  if (raw.includes(publicMarker)) return raw.split(publicMarker)[1]?.split('?')[0] || null
  if (raw.includes(signMarker)) return raw.split(signMarker)[1]?.split('?')[0] || null
  if (raw.startsWith('nota/') || raw.startsWith(`${bucket}/`)) {
    return raw.startsWith(`${bucket}/`) ? raw.slice(bucket.length + 1) : raw
  }
  return raw
}

async function removeStoragePaths(paths) {
  const bucket = String(import.meta.env.VITE_SUPABASE_DOCUMENTOS_BUCKET || '').trim()
  if (!bucket || !Array.isArray(paths) || paths.length === 0) {
    logLimpieza('debug', 'storage:skip', {
      bucket: bucket || null,
      paths: Array.isArray(paths) ? paths.length : 0,
    })
    return { removed: 0, skipped: paths?.length || 0 }
  }
  const objectPaths = [
    ...new Set(
      paths
        .map((p) => storageObjectPath(p, bucket))
        .filter(Boolean),
    ),
  ]
  if (!objectPaths.length) return { removed: 0, skipped: 0 }

  logLimpieza('debug', 'storage:remove-start', { bucket, files: objectPaths.length })
  let removed = 0
  const chunkSize = 50
  for (let i = 0; i < objectPaths.length; i += chunkSize) {
    const chunk = objectPaths.slice(i, i + chunkSize)
    const { error } = await supabase.storage.from(bucket).remove(chunk)
    if (error) {
      logLimpieza('warn', 'storage:remove-parcial', {
        message: error.message,
        chunk: chunk.length,
      })
    } else {
      removed += chunk.length
    }
  }
  logLimpieza('debug', 'storage:remove-done', {
    removed,
    skipped: objectPaths.length - removed,
  })
  return { removed, skipped: objectPaths.length - removed }
}

/**
 * Preview de notas RESUELTA/CANCELADA con antigüedad >= diasMinimos.
 */
export async function previewLimpiezaNotas({ diasMinimos, empresa } = {}) {
  const t0 = performance.now()
  const meta = await getSupabaseAuthMeta()
  assertSoloAdmin(meta)
  const dias = sanitizeDias(diasMinimos)
  const emp = sanitizeEmpresa(empresa)

  logLimpieza('debug', 'preview:start', {
    diasMinimos: dias,
    empresa: emp,
    rol: meta.rol,
    usuarioId: meta.usuarioId,
  })

  const { data, error } = await supabase.rpc('preview_purge_notas_cerradas', {
    p_dias_minimos: dias,
    p_empresa: emp,
  })
  if (error) {
    logLimpieza('error', 'preview:fail', {
      ms: msSince(t0),
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      diasMinimos: dias,
      empresa: emp,
    })
    throw new Error(error.message || 'No se pudo previsualizar la limpieza')
  }

  const result = { ok: true, ...(data || {}) }
  logLimpieza('debug', 'preview:ok', {
    ms: msSince(t0),
    candidatos: result.candidatos,
    documentos: result.documentos,
    monto_total: result.monto_total,
    saldo_total: result.saldo_total,
    por_estado: result.por_estado,
    por_empresa: result.por_empresa,
    fecha_corte: result.fecha_corte,
    criterio_fecha: result.criterio_fecha,
    diag_total_cerradas: result.diag_total_cerradas,
    diag_con_fecha_resolucion: result.diag_con_fecha_resolucion,
    diag_muestra: result.diag_muestra,
  })
  return result
}

/**
 * Ejecuta un lote de hard delete. Devuelve eliminadas/restantes.
 */
export async function purgeLimpiezaNotasLote({ diasMinimos, empresa, limit = 500 } = {}) {
  const t0 = performance.now()
  const meta = await getSupabaseAuthMeta()
  assertSoloAdmin(meta)
  const dias = sanitizeDias(diasMinimos)
  const emp = sanitizeEmpresa(empresa)
  const lim = Math.min(2000, Math.max(1, Number.parseInt(String(limit), 10) || 500))

  logLimpieza('debug', 'lote:start', {
    diasMinimos: dias,
    empresa: emp,
    limit: lim,
  })

  const { data, error } = await supabase.rpc('purge_notas_cerradas', {
    p_dias_minimos: dias,
    p_empresa: emp,
    p_limit: lim,
  })
  if (error) {
    logLimpieza('error', 'lote:rpc-fail', {
      ms: msSince(t0),
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    throw new Error(error.message || 'No se pudo eliminar el lote')
  }

  const storagePaths = Array.isArray(data?.storage_paths) ? data.storage_paths : []
  logLimpieza('debug', 'lote:rpc-ok', {
    ms: msSince(t0),
    eliminadas: data?.eliminadas,
    restantes: data?.restantes,
    storagePaths: storagePaths.length,
  })

  const tStorage = performance.now()
  const storage = await removeStoragePaths(storagePaths)
  logLimpieza('debug', 'lote:done', {
    totalMs: msSince(t0),
    storageMs: msSince(tStorage),
    eliminadas: Number(data?.eliminadas || 0),
    restantes: Number(data?.restantes || 0),
    storage,
  })

  return {
    ok: true,
    eliminadas: Number(data?.eliminadas || 0),
    restantes: Number(data?.restantes || 0),
    storage,
  }
}

/**
 * Ejecuta lotes hasta vaciar candidatos (o maxLotes).
 */
export async function purgeLimpiezaNotasTodo({
  diasMinimos,
  empresa,
  limit = 500,
  maxLotes = 200,
  onProgress,
} = {}) {
  const t0 = performance.now()
  let totalEliminadas = 0
  let lotes = 0
  let restantes = null
  let storageRemoved = 0

  logLimpieza('debug', 'purge-all:start', {
    diasMinimos,
    empresa: empresa || null,
    limit,
    maxLotes,
  })

  while (lotes < maxLotes) {
    const r = await purgeLimpiezaNotasLote({ diasMinimos, empresa, limit })
    lotes += 1
    totalEliminadas += r.eliminadas
    restantes = r.restantes
    storageRemoved += r.storage?.removed || 0
    const progress = {
      lotes,
      eliminadasLote: r.eliminadas,
      totalEliminadas,
      restantes,
      storageRemoved,
    }
    logLimpieza('debug', 'purge-all:lote', progress)
    onProgress?.(progress)
    if (r.eliminadas === 0 || r.restantes === 0) break
  }

  const summary = {
    ok: true,
    totalEliminadas,
    lotes,
    restantes: restantes ?? 0,
    storageRemoved,
    totalMs: msSince(t0),
  }
  logLimpieza('debug', 'purge-all:done', summary)
  return summary
}
