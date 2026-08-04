import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaComment, FaEye, FaFilePdf } from 'react-icons/fa6'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useDomainSyncStore } from '../../stores/domainSyncStore.js'
import { profileApi } from '../../services/profileApi.js'
import { fetchSeguimientoList } from '../../services/seguimientoApi.js'
import { exportarSeguimientoExcelConFiltros } from '../../utils/exportSeguimientoExcel.js'
import { exportarSeguimientoPdfConFiltros } from '../../utils/exportSeguimientoPdf.js'
import { useListCacheStore } from '../../stores/listCacheStore.js'
import { useListFiltersStore } from '../../stores/listFiltersStore.js'
import { estadoBadgeClass, notaMuestraAtencion } from '../../utils/estadoBadge.js'
import { formatDiasNotaCorriente, formatFechaNotaDb } from '../../utils/diasCorriente.js'
import {
  DIAS_BUCKETS_FILTER,
  DIAS_BUCKET_LABELS,
  formatDiasBucketsList,
  parseDiasBucketsList,
} from '../../utils/diasBuckets.js'
import { formatRutasList, parseRutasList } from '../../utils/seguimientoRutas.js'
import ComentarioNotaRapidoModal from '../../components/ComentarioNotaRapidoModal.jsx'

const PAGE_SIZE = 20
const BUCKET_LABELS = {
  negativo: 'Fecha inconsistente',
  d0_30: '0–30 días',
  d31_45: '31–45 días',
  d46_60: '46–60 días',
  d61_90: '61–90 días',
  d91_180: '91–180 días',
  d181_365: '181–365 días',
  d366_plus: '>365 días',
  ...DIAS_BUCKET_LABELS,
}

const BUCKET_TO_R = {
  d0_30: 'r1',
  d31_45: 'r2',
  d46_60: 'r2b',
  d61_90: 'r3',
  d91_180: 'r4',
  d181_365: 'r5',
  d366_plus: 'r6',
}

function formatFechaComentario(value) {
  if (value == null || value === '') return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  const hour = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${day}/${month}/${year} ${hour}:${min}`
}

function money(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '—'
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(n)
}

function mergeCachedPages(entry, upToPage) {
  if (!entry?.pages) return []
  const ids = new Set()
  const merged = []
  for (let p = 1; p <= upToPage; p += 1) {
    const rows = entry.pages[p]
    if (!Array.isArray(rows)) return null
    for (const row of rows) {
      if (ids.has(row.id)) continue
      ids.add(row.id)
      merged.push(row)
    }
  }
  return merged
}

function appendUniqueItems(prevItems, nextItems) {
  const seen = new Set((prevItems || []).map((row) => row.id))
  const added = []
  for (const row of nextItems || []) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    added.push(row)
  }
  return [...(prevItems || []), ...added]
}

function cacheHasPages(entry, upToPage) {
  if (!entry?.pages || upToPage < 1) return false
  for (let p = 1; p <= upToPage; p += 1) {
    if (!Array.isArray(entry.pages[p])) return false
  }
  return true
}

async function copyText(text) {
  const value = String(text ?? '').trim()
  if (!value) return
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function NotaSeguimientoCardMovil({ n, onCopySerieFolio, onAbrirComentario, mostrarComentarios }) {
  return (
    <div className="card border shadow-sm">
      <div className="card-body py-3">
        <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
          <div className="min-w-0">
            <div className="d-flex align-items-center gap-1">
              <div className="fw-semibold text-truncate" title={n.serie_folio || ''}>
                {n.serie_folio || '—'}
              </div>
              <button
                type="button"
                className="btn btn-sm btn-secondary py-0 px-2"
                aria-label="Copiar Serie/Folio"
                title="Copiar Serie/Folio"
                disabled={!n.serie_folio}
                onClick={() => {
                  void onCopySerieFolio(n.serie_folio)
                }}
              >
                <span aria-hidden="true">📋</span>
              </button>
            </div>
            <div className="small text-body-secondary">ID {n.id}</div>
          </div>
          <div className="d-flex flex-row flex-wrap gap-1 flex-shrink-0 align-items-center justify-content-end">
            <Link
              className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center px-2"
              to={ROUTES.detalleNota(String(n.id))}
              title="Detalle"
              aria-label="Ver detalle de la nota"
            >
              <FaEye className="fs-6" aria-hidden />
            </Link>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center px-2"
              title="Comentario"
              aria-label="Agregar comentarios o aclaraciones"
              onClick={() =>
                onAbrirComentario({
                  id: n.id,
                  serie_folio: n.serie_folio,
                  cliente: n.cliente,
                })
              }
            >
              <FaComment className="fs-6" aria-hidden />
            </button>
          </div>
        </div>
        <dl className="row small mb-0 gx-2">
          <dt className="col-5 text-body-secondary">Fecha nota</dt>
          <dd className="col-7 mb-1">{formatFechaNotaDb(n.fecha_nota)}</dd>
          <dt className="col-5 text-body-secondary">Días</dt>
          <dd className="col-7 mb-1" title="Días desde la fecha de la nota hasta hoy">
            {formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente)}
          </dd>
          <dt className="col-5 text-body-secondary">Cliente</dt>
          <dd className="col-7 mb-1 text-break">{n.cliente || '—'}</dd>
          <dt className="col-5 text-body-secondary">Empresa</dt>
          <dd className="col-7 mb-1">{n.empresa || '—'}</dd>
          <dt className="col-5 text-body-secondary">Ruta</dt>
          <dd className="col-7 mb-1">{n.ruta_codigo || '—'}</dd>
          <dt className="col-5 text-body-secondary">Monto</dt>
          <dd className="col-7 mb-1 text-end">{money(n.monto)}</dd>
          <dt className="col-5 text-body-secondary">Abono</dt>
          <dd className="col-7 mb-1 text-end">{money(n.abono)}</dd>
          <dt className="col-5 text-body-secondary">Saldo</dt>
          <dd className="col-7 mb-1 text-end fw-medium">{money(n.saldo)}</dd>
          <dt className="col-5 text-body-secondary">Estado</dt>
          <dd className="col-7 mb-1">
            <span className={`badge ${estadoBadgeClass(n.estado)}`}>{n.estado || '—'}</span>
          </dd>
          <dt className="col-5 text-body-secondary">Atención</dt>
          <dd className="col-7 mb-0">{notaMuestraAtencion(n) ? 'Sí' : 'No'}</dd>
        </dl>
        {mostrarComentarios && n.aclaraciones?.length > 0 && (
          <div className="mt-3 bg-body-secondary bg-opacity-25 p-2 small rounded border shadow-sm">
            <div className="fw-bold mb-1 border-bottom pb-1 d-flex align-items-center gap-2 text-body">
              <span>Comentarios recientes:</span>
              <span className="badge rounded-pill text-bg-secondary opacity-75">{n.aclaraciones.length}</span>
            </div>
            {n.aclaraciones.map((c) => (
              <div key={c.id} className="mb-1 border-bottom border-secondary-subtle last-child-no-border pb-1">
                <span className="badge text-bg-secondary me-1 opacity-75" style={{fontSize: '0.6rem'}}>
                  {c.tipo}
                </span>
                <span className="text-body-secondary me-1 fw-semibold">
                  {c.usuarios?.username || '—'}{' '}
                  <span className="fw-normal opacity-75" style={{fontSize: '0.7rem'}}>
                    ({formatFechaComentario(c.created_at)})
                  </span>
                  :
                </span>
                <span className="text-body">{c.comentario}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SeguimientoPage() {
  const location = useLocation()
  const fromReport = location.state?.fromReport || false
  const { user } = useAuth()
  const isVendedor = Boolean(user && !user.isSuperuser && user.rol === 'VENDEDOR')
  const [refreshKey, setRefreshKey] = useState(0)
  const seguimientoFilters = useListFiltersStore((s) => s.seguimiento)
  const setSeguimientoFilters = useListFiltersStore((s) => s.setSeguimientoFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [copyToast, setCopyToast] = useState('')
  const [comentarioNota, setComentarioNota] = useState(null)
  const [rutasInput, setRutasInput] = useState(seguimientoFilters.rutas || '')
  const [qInput, setQInput] = useState(seguimientoFilters.q || '')

  const pendingRutasFromInput = useCallback(() => {
    return formatRutasList(parseRutasList(rutasInput))
  }, [rutasInput])

  const updateSeguimientoFilters = useCallback(
    (partial) => {
      if (!isVendedor && !Object.prototype.hasOwnProperty.call(partial, 'rutas')) {
        const pending = pendingRutasFromInput()
        const current = formatRutasList(parseRutasList(seguimientoFilters.rutas))
        if (pending !== current) {
          setSeguimientoFilters({ ...partial, rutas: pending })
          return
        }
      }
      setSeguimientoFilters(partial)
    },
    [isVendedor, pendingRutasFromInput, seguimientoFilters.rutas, setSeguimientoFilters],
  )

  const applyRutasInputNow = useCallback(() => {
    if (isVendedor) return
    const next = pendingRutasFromInput()
    if (next === formatRutasList(parseRutasList(seguimientoFilters.rutas))) return
    setSeguimientoFilters({ rutas: next })
  }, [isVendedor, pendingRutasFromInput, seguimientoFilters.rutas, setSeguimientoFilters])
  const [rutasAsignadas, setRutasAsignadas] = useState([])
  const [rutasAsignadasError, setRutasAsignadasError] = useState('')
  const requestSeqRef = useRef(0)
  const listEpochRef = useRef(0)
  const activeCacheKeyRef = useRef('')
  const loadMoreRef = useRef(null)
  const maxLoadedPageRef = useRef(0)
  const pagesInFlightRef = useRef(new Set())
  const loadMoreStateRef = useRef({
    loading: true,
    loadingMore: false,
    error: '',
    totalPages: 1,
    cacheKey: '',
    cargarPagina: null,
  })
  const getCacheEntry = useListCacheStore((s) => s.getEntry)
  const setCachePage = useListCacheStore((s) => s.setPage)
  const clearCacheEntry = useListCacheStore((s) => s.clearEntry)
  const clearScreenCache = useListCacheStore((s) => s.clearScreen)
  const notasVersion = useDomainSyncStore((s) => s.notasVersion)
  const rutasVersion = useDomainSyncStore((s) => s.rutasVersion)

  const rutasSeleccionadas = useMemo(
    () => parseRutasList(seguimientoFilters.rutas),
    [seguimientoFilters.rutas],
  )

  const filtros = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      empresa: seguimientoFilters.empresaActiva,
      estado: seguimientoFilters.estado,
      atencion: seguimientoFilters.atencion,
      rutas: seguimientoFilters.rutas,
      q: seguimientoFilters.q,
      sort: seguimientoFilters.orden,
      ...(seguimientoFilters.dias_bucket ? { dias_bucket: seguimientoFilters.dias_bucket } : {}),
    }),
    [
      seguimientoFilters.empresaActiva,
      seguimientoFilters.estado,
      seguimientoFilters.atencion,
      seguimientoFilters.rutas,
      seguimientoFilters.q,
      seguimientoFilters.dias_bucket,
      seguimientoFilters.orden,
    ],
  )

  const filtrosExportacion = useMemo(
    () => ({
      empresa: filtros.empresa,
      estado: filtros.estado,
      atencion: filtros.atencion,
      rutas: filtros.rutas,
      q: filtros.q,
      sort: filtros.sort,
      ...(filtros.dias_bucket ? { dias_bucket: filtros.dias_bucket } : {}),
    }),
    [filtros],
  )

  const rutasActivasLabel = useMemo(() => {
    if (isVendedor) {
      if (rutasSeleccionadas.length > 0) return rutasSeleccionadas.join(', ')
      const codes = rutasAsignadas.map((r) => r.codigo).filter(Boolean)
      return codes.length ? codes.join(', ') : '—'
    }
    return rutasSeleccionadas.length ? rutasSeleccionadas.join(', ') : 'Todas'
  }, [isVendedor, rutasSeleccionadas, rutasAsignadas])

  const tramosSeleccionados = useMemo(
    () => parseDiasBucketsList(seguimientoFilters.dias_bucket),
    [seguimientoFilters.dias_bucket],
  )

  const tramoActivoLabel = useMemo(() => {
    if (tramosSeleccionados.length === 0) return 'Todos'
    return tramosSeleccionados.map((id) => BUCKET_LABELS[id] || id).join(', ')
  }, [tramosSeleccionados])

  const totalesAntiguedad = useMemo(() => {
    const rows = data?.porAntiguedad || []
    return rows.reduce(
      (acc, r) => ({
        registros: acc.registros + (r.registros ?? 0),
        saldo: acc.saldo + Number(r.saldo_total || 0),
      }),
      { registros: 0, saldo: 0 },
    )
  }, [data?.porAntiguedad])
  const cacheKey = useMemo(() => JSON.stringify(filtros), [filtros])

  const totalPages = data.totalPages || 1
  const hasMore = page < totalPages

  const cargarPagina = useCallback(async (targetPage, append = false) => {
    const includeAggregates = !append && targetPage === 1
    const requestSeq = ++requestSeqRef.current
    const epoch = listEpochRef.current
    const requestCacheKey = cacheKey

    if (pagesInFlightRef.current.has(targetPage)) return
    pagesInFlightRef.current.add(targetPage)

    try {
      if (!append && targetPage === 1) {
        clearCacheEntry('seguimiento', requestCacheKey)
      } else {
        const cached = getCacheEntry('seguimiento', requestCacheKey)
        if (cacheHasPages(cached, targetPage)) {
          const merged = mergeCachedPages(cached, targetPage)
          if (merged) {
            if (
              requestSeq !== requestSeqRef.current ||
              epoch !== listEpochRef.current ||
              requestCacheKey !== cacheKey
            ) {
              return
            }
            setData((prev) => ({
              ...prev,
              items: merged,
              total: cached.total ?? prev.total ?? 0,
              totalPages: cached.totalPages ?? prev.totalPages ?? 1,
            }))
            setPage(targetPage)
            maxLoadedPageRef.current = Math.max(maxLoadedPageRef.current, targetPage)
            activeCacheKeyRef.current = requestCacheKey
            setLoading(false)
            setLoadingMore(false)
            setError('')
            return
          }
        }
      }

      if (append) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError('')
      }

      const r = await fetchSeguimientoList({
        ...filtros,
        page: targetPage,
        includeAggregates: includeAggregates ? 'true' : 'false',
      })
      if (
        requestSeq !== requestSeqRef.current ||
        epoch !== listEpochRef.current ||
        requestCacheKey !== cacheKey
      ) {
        return
      }
      setCachePage('seguimiento', requestCacheKey, targetPage, r)
      setData((prev) => ({
        ...r,
        resumen: includeAggregates ? r.resumen : prev.resumen,
        porRuta: includeAggregates ? r.porRuta : prev.porRuta,
        porAntiguedad: includeAggregates ? r.porAntiguedad : prev.porAntiguedad,
        items: append
          ? appendUniqueItems(prev.items, r.items || [])
          : r.items || [],
      }))
      const loadedPage = typeof r.page === 'number' ? r.page : targetPage
      setPage(loadedPage)
      maxLoadedPageRef.current = Math.max(maxLoadedPageRef.current, loadedPage)
      if (!append && targetPage === 1) {
        activeCacheKeyRef.current = requestCacheKey
      } else if (append && targetPage > 1) {
        activeCacheKeyRef.current = requestCacheKey
      }
    } catch (e) {
      if (
        requestSeq !== requestSeqRef.current ||
        epoch !== listEpochRef.current ||
        requestCacheKey !== cacheKey
      ) {
        return
      }
      setError(e?.message || 'No se pudo cargar seguimiento')
    } finally {
      pagesInFlightRef.current.delete(targetPage)
      if (requestSeq === requestSeqRef.current && epoch === listEpochRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [filtros, getCacheEntry, cacheKey, setCachePage, clearCacheEntry])

  loadMoreStateRef.current = {
    loading,
    loadingMore,
    error,
    totalPages,
    cacheKey,
    cargarPagina,
  }

  useEffect(() => {
    listEpochRef.current += 1
    activeCacheKeyRef.current = ''
    maxLoadedPageRef.current = 0
    pagesInFlightRef.current = new Set()
    clearScreenCache('seguimiento')
    setData({ items: [], total: 0, totalPages: 1 })
    setPage(1)
    setLoading(true)
    setLoadingMore(false)
    setError('')
    void cargarPagina(1, false)
  }, [cacheKey, notasVersion, rutasVersion, refreshKey, clearScreenCache, cargarPagina])

  useEffect(() => {
    if (isVendedor) return undefined
    setRutasInput(seguimientoFilters.rutas || '')
  }, [isVendedor, seguimientoFilters.rutas])

  useEffect(() => {
    if (!isVendedor) return undefined
    let cancel = false
    setRutasAsignadasError('')
    void profileApi
      .getMe()
      .then((r) => {
        if (!cancel) setRutasAsignadas(r.rutas || [])
      })
      .catch((e) => {
        if (!cancel) {
          setRutasAsignadas([])
          setRutasAsignadasError(e?.message || 'No se pudieron cargar tus rutas asignadas')
        }
      })
    return () => {
      cancel = true
    }
  }, [isVendedor, rutasVersion])

  useEffect(() => {
    setQInput(seguimientoFilters.q || '')
  }, [seguimientoFilters.q])

  useEffect(() => {
    if (isVendedor) return undefined
    const next = formatRutasList(parseRutasList(rutasInput))
    if (next === formatRutasList(parseRutasList(seguimientoFilters.rutas))) return
    const t = setTimeout(() => setSeguimientoFilters({ rutas: next }), 400)
    return () => clearTimeout(t)
  }, [isVendedor, rutasInput, seguimientoFilters.rutas, setSeguimientoFilters])

  useEffect(() => {
    const next = String(qInput || '').trim()
    if (next === String(seguimientoFilters.q || '').trim()) return
    const t = setTimeout(() => updateSeguimientoFilters({ q: next }), 400)
    return () => clearTimeout(t)
  }, [qInput, seguimientoFilters.q, updateSeguimientoFilters])

  useEffect(() => {
    const node = loadMoreRef.current
    if (!node) return undefined
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        const s = loadMoreStateRef.current
        if (s.loading || s.loadingMore || s.error) return
        if (activeCacheKeyRef.current !== s.cacheKey) return
        const nextPage = maxLoadedPageRef.current + 1
        if (nextPage > s.totalPages) return
        if (pagesInFlightRef.current.has(nextPage)) return
        void s.cargarPagina?.(nextPage, true)
      },
      { root: null, rootMargin: '200px 0px', threshold: 0.1 },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [page, data.items.length, cacheKey])

  async function handleCopySerieFolio(value) {
    try {
      await copyText(value)
      setCopyToast(`Serie/Folio copiado: ${value}`)
    } catch {
      window.alert('No se pudo copiar Serie/Folio')
    }
  }

  useEffect(() => {
    if (!copyToast) return
    const t = setTimeout(() => setCopyToast(''), 1800)
    return () => clearTimeout(t)
  }, [copyToast])

  function handleActualizar() {
    setRefreshKey((k) => k + 1)
  }

  function handleTodasTramos() {
    updateSeguimientoFilters({ dias_bucket: '' })
  }

  function handleClickSaldoAntiguedad(bucketId) {
    if (bucketId === 'all') {
      handleTodasTramos()
      return
    }
    const rId = BUCKET_TO_R[bucketId]
    if (!rId) return
    updateSeguimientoFilters({ dias_bucket: rId })
  }

  function toggleTramo(bucketId) {
    const id = String(bucketId || '').trim().toLowerCase()
    if (!id) return
    const selected = parseDiasBucketsList(seguimientoFilters.dias_bucket)
    if (selected.length === 0) {
      updateSeguimientoFilters({ dias_bucket: id })
      return
    }
    const set = new Set(selected)
    if (set.has(id)) {
      set.delete(id)
      updateSeguimientoFilters({ dias_bucket: formatDiasBucketsList([...set]) })
      return
    }
    set.add(id)
    updateSeguimientoFilters({ dias_bucket: formatDiasBucketsList([...set]) })
  }

  function handleTodasRutasVendedor() {
    setSeguimientoFilters({ rutas: '' })
  }

  function toggleRutaVendedor(codigo) {
    const code = String(codigo || '').trim().toUpperCase()
    if (!code) return
    const selected = parseRutasList(seguimientoFilters.rutas)
    if (selected.length === 0) {
      setSeguimientoFilters({ rutas: code })
      return
    }
    const set = new Set(selected)
    if (set.has(code)) {
      set.delete(code)
      setSeguimientoFilters({ rutas: formatRutasList([...set]) })
      return
    }
    set.add(code)
    setSeguimientoFilters({ rutas: formatRutasList([...set]) })
  }

  return (
    <section className="container-fluid px-0">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 mb-0">Seguimiento</h1>
        {(fromReport || seguimientoFilters.dias_bucket) && (
          <Link to={ROUTES.reporte} className="btn btn-primary btn-sm px-3 shadow-sm">
            ← Regresar al Reporte
          </Link>
        )}
      </div>
      <div className="alert alert-light border py-2 mb-3 small">
        <div className="d-flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <span className="text-body-secondary">Empresa:</span>{' '}
            <strong>{seguimientoFilters.empresaActiva}</strong>
          </span>
          <span>
            <span className="text-body-secondary">Rutas:</span> <strong>{rutasActivasLabel}</strong>
            {isVendedor && rutasSeleccionadas.length > 0 && rutasAsignadas.length > 0 ? (
              <span className="text-body-secondary">
                {' '}
                ({rutasSeleccionadas.length} de {rutasAsignadas.length} asignadas)
              </span>
            ) : null}
          </span>
          <span>
            <span className="text-body-secondary">Tramos:</span> <strong>{tramoActivoLabel}</strong>
            {tramosSeleccionados.length > 1 ? (
              <span className="text-body-secondary"> ({tramosSeleccionados.length} seleccionados)</span>
            ) : null}
          </span>
        </div>
        {isVendedor && rutasAsignadas.length === 0 && !rutasAsignadasError ? (
          <div className="text-warning mt-1">Sin rutas asignadas. Contacta al administrador.</div>
        ) : null}
        {rutasAsignadasError ? <div className="text-danger mt-1">{rutasAsignadasError}</div> : null}
      </div>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${seguimientoFilters.empresaActiva === 'DISTRIBUIDORA' ? ' active' : ''}`}
            onClick={() => updateSeguimientoFilters({ empresaActiva: 'DISTRIBUIDORA' })}
          >
            Distribuidora
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${seguimientoFilters.empresaActiva === 'RODRIGO' ? ' active' : ''}`}
            onClick={() => updateSeguimientoFilters({ empresaActiva: 'RODRIGO' })}
          >
            Rodrigo
          </button>
        </li>
      </ul>

      <div className="card mb-3">
        <div className="card-body">
          <div className="mb-2 small text-body-secondary">Antigüedad (días desde fecha de nota)</div>
          <div className="d-flex flex-wrap gap-1 mb-3">
            <button
              type="button"
              className={`btn btn-sm ${tramosSeleccionados.length === 0 ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={handleTodasTramos}
            >
              Todos
            </button>
            {DIAS_BUCKETS_FILTER.map((b) => {
              const isTodas = tramosSeleccionados.length === 0
              const isSelected = tramosSeleccionados.includes(b.id)
              return (
                <button
                  key={b.id}
                  type="button"
                  className={`btn btn-sm ${isTodas ? 'btn-outline-secondary' : isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => toggleTramo(b.id)}
                >
                  {b.label}
                </button>
              )
            })}
          </div>

          {isVendedor ? (
            <div className="mb-3">
              <div className="form-label mb-1">Tus rutas asignadas</div>
              <div className="d-flex flex-wrap gap-1">
                <button
                  type="button"
                  className={`btn btn-sm ${rutasSeleccionadas.length === 0 ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={handleTodasRutasVendedor}
                >
                  Todas
                </button>
                {rutasAsignadas.map((r) => {
                  const code = String(r.codigo || '').trim().toUpperCase()
                  const isTodas = rutasSeleccionadas.length === 0
                  const isSelected = rutasSeleccionadas.includes(code)
                  return (
                    <button
                      key={r.id}
                      type="button"
                      title={r.nombre || code}
                      className={`btn btn-sm ${isTodas ? 'btn-outline-secondary' : isSelected ? 'btn-primary' : 'btn-outline-secondary'}`}
                      onClick={() => toggleRutaVendedor(code)}
                    >
                      {code}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <label className="form-label mb-1">Rutas (códigos, separados por coma)</label>
              <input
                className="form-control"
                placeholder="DR201, DR202"
                title="Códigos de ruta separados por coma; vacío = todas las rutas"
                value={rutasInput}
                onChange={(e) => setRutasInput(e.target.value)}
                onBlur={applyRutasInputNow}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyRutasInputNow()
                }}
              />
            </div>
          )}

          <div className="row g-2">
            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label mb-1">Estado</label>
              <select
                className="form-select"
                value={seguimientoFilters.estado}
                onChange={(e) => updateSeguimientoFilters({ estado: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="RESUELTA">RESUELTA</option>
                <option value="CANCELADA">CANCELADA</option>
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label mb-1">Atención</label>
              <select
                className="form-select"
                value={seguimientoFilters.atencion}
                onChange={(e) => updateSeguimientoFilters({ atencion: e.target.value })}
              >
                <option value="">Todos</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="col-12 col-lg-6">
              <label className="form-label mb-1">Buscar</label>
              <input
                className="form-control"
                placeholder="serie, cliente o vendedor"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
            </div>
          </div>
          <div className="row g-2 mt-1">
            <div className="col-12 col-md-6 col-lg-5">
              <label className="form-label mb-1">Ordenar por</label>
              <select
                className="form-select"
                value={seguimientoFilters.orden}
                onChange={(e) => updateSeguimientoFilters({ orden: e.target.value })}
              >
                <option value="fecha_nota_asc">Fecha nota — más antigua (predeterminado)</option>
                <option value="fecha_ultima_desc">Última actualización — más reciente</option>
                <option value="fecha_ultima_asc">Última actualización — más antigua</option>
                <option value="fecha_nota_desc">Fecha nota — más reciente</option>
                <option value="dias_corriente_desc">Días — mayor antigüedad</option>
                <option value="dias_corriente_asc">Días — menor antigüedad</option>
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-7 d-flex align-items-end justify-content-md-end gap-3 mt-2 mt-md-0">
              <div className="form-check form-switch mb-2 me-auto">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="switchComentarios"
                  checked={seguimientoFilters.mostrarComentarios}
                  onChange={(e) => setSeguimientoFilters({ mostrarComentarios: e.target.checked })}
                />
                <label className="form-check-label small" htmlFor="switchComentarios">
                  Ver comentarios
                </label>
              </div>
              <button
                type="button"
                className="btn btn-success btn-nc-export-excel"
                disabled={loading}
                onClick={handleActualizar}
                title="Recargar datos desde el servidor"
              >
                {loading ? 'Cargando…' : '↻ Actualizar'}
              </button>
              <button
                type="button"
                className="btn btn-success btn-nc-export-excel"
                disabled={exportandoExcel || exportandoPdf || loading}
                onClick={async () => {
                  setExportandoExcel(true)
                  try {
                    const r = await exportarSeguimientoExcelConFiltros(filtrosExportacion)
                    if (r.truncated) {
                      window.alert(
                        `Se exportaron ${r.rowCount.toLocaleString('es-MX')} filas. El total filtrado es ${r.totalReported.toLocaleString('es-MX')}; el archivo se cortó por límite de seguridad (máx. 30000 filas).`,
                      )
                    }
                  } catch (e) {
                    window.alert(e?.message || 'No se pudo exportar a Excel')
                  } finally {
                    setExportandoExcel(false)
                  }
                }}
              >
                {exportandoExcel ? 'Exportando…' : 'Exportar Excel (filtros actuales)'}
              </button>
              <button
                type="button"
                className="btn btn-success btn-nc-export-excel d-inline-flex align-items-center justify-content-center gap-2"
                disabled={exportandoExcel || exportandoPdf || loading}
                onClick={async () => {
                  setExportandoPdf(true)
                  try {
                    const r = await exportarSeguimientoPdfConFiltros(filtrosExportacion)
                    if (r.truncated) {
                      window.alert(
                        `Se exportaron ${r.rowCount.toLocaleString('es-MX')} filas al PDF. El total filtrado es ${r.totalReported.toLocaleString('es-MX')}; el archivo se cortó por límite de seguridad (máx. 5000 filas).`,
                      )
                    }
                  } catch (e) {
                    window.alert(e?.message || 'No se pudo generar el PDF')
                  } finally {
                    setExportandoPdf(false)
                  }
                }}
                title="Descarga un PDF del listado con los filtros actuales"
              >
                <FaFilePdf aria-hidden size={14} />
                {exportandoPdf ? 'Generando PDF…' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Total filtrado</div>
              <div className="fs-5 fw-semibold">
                {(data?.resumen?.total_filtrado ?? data?.total ?? 0).toLocaleString('es-MX')}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Requieren atención</div>
              <div className="fs-5 fw-semibold text-warning">
                {(data?.resumen?.requiere_atencion ?? 0).toLocaleString('es-MX')}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Rutas con notas</div>
              <div className="fs-5 fw-semibold">
                {(data?.porRuta?.length ?? 0).toLocaleString('es-MX')}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Monto total</div>
              <div className="fs-6 fw-semibold">
                {loading ? '…' : money(data?.resumen?.monto_total)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Abono total</div>
              <div className="fs-6 fw-semibold">
                {loading ? '…' : money(data?.resumen?.abono_total)}
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-xl-2">
          <div className="card h-100 border-0 shadow-sm">
            <div className="card-body py-2 px-3">
              <div className="text-body-secondary small">Saldo total</div>
              <div className="fs-6 fw-semibold text-primary">
                {loading ? '…' : money(data?.resumen?.saldo_total)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header">Registros por ruta</div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-striped mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Ruta</th>
                      <th className="text-end">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="2" className="text-center py-3">Cargando...</td>
                      </tr>
                    ) : (data?.porRuta?.length || 0) === 0 ? (
                      <tr>
                        <td colSpan="2" className="text-center py-3 text-body-secondary">Sin datos</td>
                      </tr>
                    ) : (
                      (data.porRuta || []).slice(0, 15).map((r) => (
                        <tr key={r.ruta_codigo}>
                          <td>{r.ruta_codigo}</td>
                          <td className="text-end">{(r.registros ?? 0).toLocaleString('es-MX')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-6">
          <div className="card h-100">
            <div className="card-header">Rangos de antigüedad</div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-sm table-bordered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Rango</th>
                      <th className="text-end">Registros</th>
                      <th className="text-end">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="3" className="text-center py-3">Cargando...</td>
                      </tr>
                    ) : (data?.porAntiguedad?.length || 0) === 0 ? (
                      <tr>
                        <td colSpan="3" className="text-center py-3 text-body-secondary">Sin datos</td>
                      </tr>
                    ) : (
                      (data.porAntiguedad || []).map((r) => {
                        const rId = BUCKET_TO_R[r.bucket_id]
                        const saldoClickable = Boolean(rId) && (r.registros ?? 0) > 0
                        return (
                          <tr key={r.bucket_id}>
                            <td>{BUCKET_LABELS[r.bucket_id] || r.bucket_id}</td>
                            <td className="text-end">{(r.registros ?? 0).toLocaleString('es-MX')}</td>
                            <td
                              className={`text-end fw-medium${saldoClickable ? ' text-decoration-underline' : ''}`}
                              style={{ cursor: saldoClickable ? 'pointer' : 'default' }}
                              onClick={() => saldoClickable && handleClickSaldoAntiguedad(r.bucket_id)}
                              title={saldoClickable ? 'Filtrar notas de este tramo' : undefined}
                            >
                              {money(r.saldo_total)}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                  {!loading && (data?.porAntiguedad?.length || 0) > 0 ? (
                    <tfoot className="table-light">
                      <tr>
                        <td className="fw-semibold">Total</td>
                        <td className="text-end fw-semibold">
                          {totalesAntiguedad.registros.toLocaleString('es-MX')}
                        </td>
                        <td
                          className={`text-end fw-semibold${totalesAntiguedad.registros > 0 ? ' text-decoration-underline' : ''}`}
                          style={{ cursor: totalesAntiguedad.registros > 0 ? 'pointer' : 'default' }}
                          onClick={() =>
                            totalesAntiguedad.registros > 0 && handleClickSaldoAntiguedad('all')
                          }
                          title={totalesAntiguedad.registros > 0 ? 'Quitar filtro por tramo' : undefined}
                        >
                          {money(totalesAntiguedad.saldo)}
                        </td>
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
              <p className="small text-body-secondary mb-0 px-3 py-2">
                Clic en un saldo para filtrar el listado por ese tramo.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error ? <div className="alert alert-warning">{error}</div> : null}

      <div className="card">
        <div className="d-none d-md-block table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>ID</th>
                <th>Serie/Folio</th>
                <th>Fecha nota</th>
                <th className="text-end" title="Días desde la fecha de la nota hasta hoy">
                  Días
                </th>
                <th>Cliente</th>
                <th>Empresa</th>
                <th>Ruta</th>
                <th className="text-end">Monto</th>
                <th className="text-end">Abono</th>
                <th className="text-end">Saldo</th>
                <th>Estado</th>
                <th>Atención</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="13" className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : data.items?.length ? (
                data.items.map((n) => (
                  <Fragment key={n.id}>
                    <tr className={seguimientoFilters.mostrarComentarios && n.aclaraciones?.length > 0 ? 'border-bottom-0' : ''}>
                      <td>{n.id}</td>
                      <td>
                        <div className="d-inline-flex align-items-center gap-1">
                          <span>{n.serie_folio || '—'}</span>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary py-0 px-2"
                            aria-label="Copiar Serie/Folio"
                            title="Copiar Serie/Folio"
                            disabled={!n.serie_folio}
                            onClick={() => {
                              void handleCopySerieFolio(n.serie_folio)
                            }}
                          >
                            <span aria-hidden="true">📋</span>
                          </button>
                        </div>
                      </td>
                      <td className="text-nowrap small">{formatFechaNotaDb(n.fecha_nota)}</td>
                      <td className="text-end text-nowrap small" title="Días desde la fecha de la nota hasta hoy">
                        {formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente)}
                      </td>
                      <td>{n.cliente || '—'}</td>
                      <td>{n.empresa || '—'}</td>
                      <td>{n.ruta_codigo || '—'}</td>
                      <td className="text-end small">{money(n.monto)}</td>
                      <td className="text-end small">{money(n.abono)}</td>
                      <td className="text-end small fw-medium">{money(n.saldo)}</td>
                      <td>
                        <span className={`badge ${estadoBadgeClass(n.estado)}`}>{n.estado || '—'}</span>
                      </td>
                      <td>{notaMuestraAtencion(n) ? 'Sí' : 'No'}</td>
                      <td>
                        <div className="d-inline-flex flex-row flex-wrap gap-1 align-items-center">
                          <Link
                            className="btn btn-sm btn-primary d-inline-flex align-items-center justify-content-center px-2"
                            to={ROUTES.detalleNota(String(n.id))}
                            title="Detalle"
                            aria-label="Ver detalle de la nota"
                          >
                            <FaEye className="fs-6" aria-hidden />
                          </Link>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary d-inline-flex align-items-center justify-content-center px-2"
                            title="Comentario"
                            aria-label="Agregar comentarios o aclaraciones"
                            onClick={() =>
                              setComentarioNota({
                                id: n.id,
                                serie_folio: n.serie_folio,
                                cliente: n.cliente,
                              })
                            }
                          >
                            <FaComment className="fs-6" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {seguimientoFilters.mostrarComentarios && n.aclaraciones?.length > 0 && (
                      <tr className="bg-transparent">
                        <td colSpan="13" className="p-0 border-top-0">
                          <div className="bg-body-secondary bg-opacity-25 p-2 small ms-4 me-4 mb-2 rounded border shadow-sm">
                            <div className="fw-bold mb-1 border-bottom pb-1 d-flex align-items-center gap-2 text-body">
                              <span>Comentarios recientes:</span>
                              <span className="badge rounded-pill text-bg-secondary opacity-75">{n.aclaraciones.length}</span>
                            </div>
                            {n.aclaraciones.map((c) => (
                              <div key={c.id} className="mb-1 border-bottom border-secondary-subtle pb-1">
                                <span className="badge text-bg-secondary me-1 opacity-75" style={{fontSize: '0.65rem'}}>
                                  {c.tipo}
                                </span>
                                <span className="text-body-secondary me-1 fw-semibold">
                                  {c.usuarios?.username || '—'}{' '}
                                  <span className="fw-normal opacity-75" style={{fontSize: '0.7rem'}}>
                                    ({formatFechaComentario(c.created_at)})
                                  </span>
                                  :
                                </span>
                                <span className="text-body">{c.comentario}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="13" className="text-center py-4">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && data.items?.length ? (
              <tfoot className="table-light">
                <tr>
                  <td colSpan={7} className="small fw-semibold">
                    Suma filtrada
                    <span className="fw-normal text-body-secondary ms-1">
                      ({(data?.resumen?.total_filtrado ?? data?.total ?? 0).toLocaleString('es-MX')} notas)
                    </span>
                  </td>
                  <td className="text-end small fw-semibold">{money(data?.resumen?.monto_total)}</td>
                  <td className="text-end small fw-semibold">{money(data?.resumen?.abono_total)}</td>
                  <td className="text-end small fw-semibold text-primary">{money(data?.resumen?.saldo_total)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        <div className="d-md-none p-2 p-sm-3">
          {loading ? (
            <p className="text-center text-body-secondary py-4 mb-0">Cargando...</p>
          ) : data.items?.length ? (
            <div className="d-flex flex-column gap-2">
              {data.items.map((n) => (
                <NotaSeguimientoCardMovil
                  key={n.id}
                  n={n}
                  onCopySerieFolio={handleCopySerieFolio}
                  onAbrirComentario={setComentarioNota}
                  mostrarComentarios={seguimientoFilters.mostrarComentarios}
                />
              ))}
              <div className="card border shadow-sm bg-body-tertiary">
                <div className="card-body py-3">
                  <div className="fw-semibold mb-2">
                    Suma filtrada
                    <span className="fw-normal text-body-secondary ms-1">
                      ({(data?.resumen?.total_filtrado ?? data?.total ?? 0).toLocaleString('es-MX')} notas)
                    </span>
                  </div>
                  <div className="d-flex justify-content-between small mb-1 gap-2">
                    <span className="text-body-secondary">Monto</span>
                    <span className="fw-medium">{money(data?.resumen?.monto_total)}</span>
                  </div>
                  <div className="d-flex justify-content-between small mb-1 gap-2">
                    <span className="text-body-secondary">Abono</span>
                    <span className="fw-medium">{money(data?.resumen?.abono_total)}</span>
                  </div>
                  <div className="d-flex justify-content-between small fw-semibold gap-2 border-top pt-2 mt-1">
                    <span>Saldo</span>
                    <span className="text-primary">{money(data?.resumen?.saldo_total)}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-body-secondary py-4 mb-0">Sin resultados</p>
          )}
        </div>
        <div className="card-footer d-flex justify-content-between align-items-center">
          <span className="small text-body-secondary">Total: {data.total ?? 0}</span>
          <span className="small text-body-secondary">
            Página {page} / {data.totalPages || 1}
          </span>
        </div>
      </div>
      <div ref={loadMoreRef} className="py-3 text-center small text-body-secondary">
        {loadingMore ? 'Cargando más...' : hasMore ? 'Desplázate para cargar más' : 'Fin de resultados'}
      </div>
      {copyToast ? (
        <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 1080 }}>
          <div className="toast show align-items-center text-bg-success border-0" role="status" aria-live="polite" aria-atomic="true">
            <div className="d-flex">
              <div className="toast-body">{copyToast}</div>
              <button
                type="button"
                className="btn-close btn-close-white me-2 m-auto"
                aria-label="Cerrar"
                onClick={() => setCopyToast('')}
              />
            </div>
          </div>
        </div>
      ) : null}
      <ComentarioNotaRapidoModal
        show={Boolean(comentarioNota)}
        notaId={comentarioNota?.id}
        serieFolio={comentarioNota?.serie_folio}
        cliente={comentarioNota?.cliente}
        onClose={() => setComentarioNota(null)}
        onGuardado={() => setCopyToast('Comentario guardado')}
      />
    </section>
  )
}
