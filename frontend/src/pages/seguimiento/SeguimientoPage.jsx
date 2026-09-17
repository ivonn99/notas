import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { FaChevronDown, FaChevronRight, FaComment, FaEye, FaFilePdf } from 'react-icons/fa6'
import { getListadoSection } from '../../constants/listadoSection.js'
import { ROUTES } from '../../constants/routes.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { useDomainSyncStore } from '../../stores/domainSyncStore.js'
import { profileApi } from '../../services/profileApi.js'
import { fetchRutasCatalogo, fetchSeguimientoList } from '../../services/seguimientoApi.js'
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
import {
  RUTAS_FILTRO_NINGUNA,
  formatRutasList,
  getRutasFiltroMode,
  parseRutasList,
} from '../../utils/seguimientoRutas.js'
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

function NotaSeguimientoCardMovil({
  n,
  detalleTo,
  onCopySerieFolio,
  onAbrirComentario,
  mostrarComentarios,
}) {
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
              to={detalleTo}
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

export default function SeguimientoPage({ section = 'seguimiento' } = {}) {
  const sectionConfig = getListadoSection(section)
  const location = useLocation()
  const fromReport = location.state?.fromReport || false
  const { user } = useAuth()
  const isVendedor = Boolean(
    sectionConfig.scopeByUsuarioRutas &&
      user &&
      !user.isSuperuser &&
      user.rol === 'VENDEDOR',
  )
  const showRutasFilter = Boolean(sectionConfig.showRutasFilter)
  const antiguedadMode = sectionConfig.antiguedadMode === 'dias_min' ? 'dias_min' : 'chips'
  const defaultDiasMin = Number(sectionConfig.defaultDiasMin) > 0 ? Number(sectionConfig.defaultDiasMin) : 60
  const groupByRuta = sectionConfig.tableLayout === 'group_by_ruta'
  const pageSize = Math.min(
    100,
    Math.max(1, Number(sectionConfig.pageSize) || PAGE_SIZE),
  )
  const infiniteScrollRootMargin =
    String(sectionConfig.infiniteScrollRootMargin || '200px 0px').trim() ||
    '200px 0px'
  const prefetchNextPage = Boolean(sectionConfig.prefetchNextPage)
  const [refreshKey, setRefreshKey] = useState(0)
  const listFilters = useListFiltersStore((s) => s[sectionConfig.filtersKey])
  const setListFilters = useListFiltersStore((s) => s[sectionConfig.setFiltersKey])
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [exportandoExcel, setExportandoExcel] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)
  const [copyToast, setCopyToast] = useState('')
  const [comentarioNota, setComentarioNota] = useState(null)
  const [qInput, setQInput] = useState(listFilters.q || '')
  const [diasMinInput, setDiasMinInput] = useState(() =>
    String(
      listFilters.dias_min != null && String(listFilters.dias_min).trim() !== ''
        ? listFilters.dias_min
        : defaultDiasMin,
    ),
  )
  const [diasMaxInput, setDiasMaxInput] = useState(() =>
    listFilters.dias_max != null && String(listFilters.dias_max).trim() !== ''
      ? String(listFilters.dias_max)
      : '',
  )
  /** Rutas colapsadas (vacío = todas expandidas). */
  const [rutasGrupoColapsadas, setRutasGrupoColapsadas] = useState(() => new Set())

  const updateListFilters = useCallback(
    (partial) => {
      setListFilters(partial)
    },
    [setListFilters],
  )
  const [rutasAsignadas, setRutasAsignadas] = useState([])
  const [rutasAsignadasError, setRutasAsignadasError] = useState('')
  const [rutasCatalogo, setRutasCatalogo] = useState([])
  const [rutasCatalogoError, setRutasCatalogoError] = useState('')
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
    () => parseRutasList(listFilters.rutas),
    [listFilters.rutas],
  )
  const rutasFiltroMode = useMemo(
    () => getRutasFiltroMode(listFilters.rutas),
    [listFilters.rutas],
  )

  const filtros = useMemo(
    () => ({
      pageSize,
      empresa: listFilters.empresaActiva,
      estado: listFilters.estado,
      atencion: listFilters.atencion,
      ...(showRutasFilter ? { rutas: listFilters.rutas } : {}),
      q: listFilters.q,
      sort: listFilters.orden,
      ...(antiguedadMode === 'dias_min'
        ? {
            dias_min:
              Number.parseInt(String(listFilters.dias_min ?? ''), 10) > 0
                ? Number.parseInt(String(listFilters.dias_min), 10)
                : defaultDiasMin,
            ...(Number.parseInt(String(listFilters.dias_max ?? ''), 10) > 0
              ? { dias_max: Number.parseInt(String(listFilters.dias_max), 10) }
              : {}),
          }
        : listFilters.dias_bucket
          ? { dias_bucket: listFilters.dias_bucket }
          : {}),
      ...(!sectionConfig.scopeByUsuarioRutas ? { ignoreUsuarioRutasScope: true } : {}),
    }),
    [
      listFilters.empresaActiva,
      listFilters.estado,
      listFilters.atencion,
      listFilters.rutas,
      listFilters.q,
      listFilters.dias_bucket,
      listFilters.dias_min,
      listFilters.dias_max,
      listFilters.orden,
      showRutasFilter,
      antiguedadMode,
      defaultDiasMin,
      pageSize,
      sectionConfig.scopeByUsuarioRutas,
    ],
  )

  const filtrosExportacion = useMemo(
    () => ({
      empresa: filtros.empresa,
      estado: filtros.estado,
      atencion: filtros.atencion,
      ...(showRutasFilter ? { rutas: filtros.rutas } : {}),
      q: filtros.q,
      sort: filtros.sort,
      ...(filtros.dias_bucket ? { dias_bucket: filtros.dias_bucket } : {}),
      ...(filtros.dias_min != null ? { dias_min: filtros.dias_min } : {}),
      ...(filtros.dias_max != null ? { dias_max: filtros.dias_max } : {}),
      ...(!sectionConfig.scopeByUsuarioRutas ? { ignoreUsuarioRutasScope: true } : {}),
    }),
    [filtros, showRutasFilter, sectionConfig.scopeByUsuarioRutas],
  )

  const opcionesExportacion = useMemo(
    () => ({
      title: sectionConfig.exportTitle || sectionConfig.title,
      filePrefix: sectionConfig.exportFilePrefix || sectionConfig.id || 'seguimiento',
      sheetName: sectionConfig.exportSheetName || sectionConfig.title,
      groupByRuta:
        sectionConfig.exportGroupByRuta != null
          ? Boolean(sectionConfig.exportGroupByRuta)
          : groupByRuta,
    }),
    [sectionConfig, groupByRuta],
  )

  const rutasChipList = isVendedor ? rutasAsignadas : rutasCatalogo

  const rutasActivasLabel = useMemo(() => {
    if (rutasFiltroMode === 'none') return 'Ninguna'
    if (rutasFiltroMode === 'all') return 'Todas'

    const allCodes = rutasChipList
      .map((r) => String(r.codigo || '').trim().toUpperCase())
      .filter(Boolean)
    const selected = rutasSeleccionadas

    if (selected.length === 0) {
      if (isVendedor) {
        return allCodes.length ? allCodes.join(', ') : '—'
      }
      return 'Todas'
    }

    // Evitar listar decenas de códigos (empuja/mueve los chips).
    if (allCodes.length > 0) {
      const selectedSet = new Set(selected)
      const excluded = allCodes.filter((c) => !selectedSet.has(c))
      if (excluded.length > 0 && excluded.length <= 3 && selected.length >= allCodes.length - 3) {
        return `Todas excepto ${excluded.join(', ')}`
      }
      if (selected.length > 4) {
        return `${selected.length} de ${allCodes.length} rutas`
      }
    }

    return selected.join(', ')
  }, [isVendedor, rutasFiltroMode, rutasSeleccionadas, rutasChipList])

  const tramosSeleccionados = useMemo(
    () => parseDiasBucketsList(listFilters.dias_bucket),
    [listFilters.dias_bucket],
  )

  const tramoActivoLabel = useMemo(() => {
    if (antiguedadMode === 'dias_min') {
      const n = Number.parseInt(String(listFilters.dias_min ?? ''), 10)
      const dias = Number.isFinite(n) && n > 0 ? n : defaultDiasMin
      const m = Number.parseInt(String(listFilters.dias_max ?? ''), 10)
      if (Number.isFinite(m) && m > 0) {
        return `Mayores a ${dias} y menores a ${m} días`
      }
      return `Mayores a ${dias} días`
    }
    if (tramosSeleccionados.length === 0) return 'Todos'
    return tramosSeleccionados.map((id) => BUCKET_LABELS[id] || id).join(', ')
  }, [antiguedadMode, defaultDiasMin, listFilters.dias_min, listFilters.dias_max, tramosSeleccionados])

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

  const gruposPorRuta = useMemo(() => {
    if (!groupByRuta) return []
    const map = new Map()
    for (const n of data.items || []) {
      const key = String(n.ruta_codigo || '').trim() || '(sin ruta)'
      if (!map.has(key)) {
        map.set(key, {
          key,
          items: [],
          monto: 0,
          abono: 0,
          saldo: 0,
        })
      }
      const g = map.get(key)
      g.items.push(n)
      g.monto += Number(n.monto) || 0
      g.abono += Number(n.abono) || 0
      g.saldo += Number(n.saldo) || 0
    }
    return [...map.values()].sort((a, b) =>
      String(a.key).localeCompare(String(b.key), 'es', { numeric: true }),
    )
  }, [groupByRuta, data.items])

  useEffect(() => {
    if (!groupByRuta) return
    setRutasGrupoColapsadas(new Set())
  }, [groupByRuta, cacheKey])

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
      const tUi = performance.now()
      if (!append && targetPage === 1) {
        clearCacheEntry(sectionConfig.screen, requestCacheKey)
      } else {
        const cached = getCacheEntry(sectionConfig.screen, requestCacheKey)
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

      const q = String(filtros.q || '').trim()
      if (q || includeAggregates) {
        if (import.meta.env.DEV || localStorage.getItem('DEBUG_SEGUIMIENTO') === '1') {
          console.log('[seguimiento:search] ui:fetch-start', {
            page: targetPage,
            append,
            includeAggregates,
            q: q || null,
            filtros,
          })
        }
      }

      const r = await fetchSeguimientoList({
        ...filtros,
        page: targetPage,
        includeAggregates: includeAggregates ? 'true' : 'false',
      })
      if (q || includeAggregates) {
        if (import.meta.env.DEV || localStorage.getItem('DEBUG_SEGUIMIENTO') === '1') {
          console.log('[seguimiento:search] ui:fetch-ok', {
            ms: Math.round(performance.now() - tUi),
            page: r.page,
            total: r.total,
            items: r.items?.length ?? 0,
            q: q || null,
          })
        }
      }
      if (
        requestSeq !== requestSeqRef.current ||
        epoch !== listEpochRef.current ||
        requestCacheKey !== cacheKey
      ) {
        if (import.meta.env.DEV || localStorage.getItem('DEBUG_SEGUIMIENTO') === '1') {
          console.warn('[seguimiento:search] ui:fetch-stale-discarded', {
            q: q || null,
            targetPage,
          })
        }
        return
      }
      setCachePage(sectionConfig.screen, requestCacheKey, targetPage, r)
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
      console.error('[seguimiento:search] ui:fetch-error', {
        message: e?.message,
        page: targetPage,
        q: String(filtros.q || '').trim() || null,
      })
      if (
        requestSeq !== requestSeqRef.current ||
        epoch !== listEpochRef.current ||
        requestCacheKey !== cacheKey
      ) {
        return
      }
      setError(e?.message || `No se pudo cargar ${sectionConfig.title.toLowerCase()}`)
    } finally {
      pagesInFlightRef.current.delete(targetPage)
      if (requestSeq === requestSeqRef.current && epoch === listEpochRef.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [filtros, getCacheEntry, cacheKey, setCachePage, clearCacheEntry, sectionConfig.screen, sectionConfig.title])

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
    clearScreenCache(sectionConfig.screen)
    setData({ items: [], total: 0, totalPages: 1 })
    setPage(1)
    setLoading(true)
    setLoadingMore(false)
    setError('')
    void cargarPagina(1, false)
  }, [cacheKey, notasVersion, rutasVersion, refreshKey, clearScreenCache, cargarPagina, sectionConfig.screen])

  useEffect(() => {
    if (!showRutasFilter || !isVendedor) return undefined
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
  }, [showRutasFilter, isVendedor, rutasVersion])

  useEffect(() => {
    if (!showRutasFilter || isVendedor) return undefined
    let cancel = false
    setRutasCatalogoError('')
    void fetchRutasCatalogo()
      .then((rows) => {
        if (!cancel) setRutasCatalogo(rows || [])
      })
      .catch((e) => {
        if (!cancel) {
          setRutasCatalogo([])
          setRutasCatalogoError(e?.message || 'No se pudieron cargar las rutas')
        }
      })
    return () => {
      cancel = true
    }
  }, [showRutasFilter, isVendedor, rutasVersion])

  useEffect(() => {
    setQInput(listFilters.q || '')
  }, [listFilters.q])

  useEffect(() => {
    if (antiguedadMode !== 'dias_min') return undefined
    const n = Number.parseInt(String(listFilters.dias_min ?? ''), 10)
    setDiasMinInput(String(Number.isFinite(n) && n > 0 ? n : defaultDiasMin))
    const m = Number.parseInt(String(listFilters.dias_max ?? ''), 10)
    setDiasMaxInput(Number.isFinite(m) && m > 0 ? String(m) : '')
  }, [antiguedadMode, defaultDiasMin, listFilters.dias_min, listFilters.dias_max])

  useEffect(() => {
    if (antiguedadMode !== 'dias_min') return undefined
    const parsedMin = Number.parseInt(String(diasMinInput || '').trim(), 10)
    const nextMin = Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : defaultDiasMin
    const rawMax = String(diasMaxInput || '').trim()
    const parsedMax = Number.parseInt(rawMax, 10)
    const nextMax = rawMax === '' || !Number.isFinite(parsedMax) || parsedMax <= 0 ? '' : parsedMax

    const currentMinRaw = Number.parseInt(String(listFilters.dias_min ?? ''), 10)
    const currentMin =
      Number.isFinite(currentMinRaw) && currentMinRaw > 0 ? currentMinRaw : defaultDiasMin
    const currentMaxRaw = Number.parseInt(String(listFilters.dias_max ?? ''), 10)
    const currentMax =
      Number.isFinite(currentMaxRaw) && currentMaxRaw > 0 ? currentMaxRaw : ''

    if (nextMin === currentMin && nextMax === currentMax) return undefined
    const t = setTimeout(() => {
      updateListFilters({ dias_min: nextMin, dias_max: nextMax, dias_bucket: '' })
    }, 400)
    return () => clearTimeout(t)
  }, [
    antiguedadMode,
    defaultDiasMin,
    diasMinInput,
    diasMaxInput,
    listFilters.dias_min,
    listFilters.dias_max,
    updateListFilters,
  ])

  useEffect(() => {
    const next = String(qInput || '').trim()
    if (next === String(listFilters.q || '').trim()) return
    const t = setTimeout(() => {
      if (import.meta.env.DEV || localStorage.getItem('DEBUG_SEGUIMIENTO') === '1') {
        console.log('[seguimiento:search] ui:debounce-apply', {
          q: next || '(vacío)',
          prev: listFilters.q || '(vacío)',
        })
      }
      updateListFilters({ q: next })
    }, 400)
    return () => clearTimeout(t)
  }, [qInput, listFilters.q, updateListFilters])

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
      { root: null, rootMargin: infiniteScrollRootMargin, threshold: 0.01 },
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [page, data.items.length, cacheKey, infiniteScrollRootMargin])

  /** Tras la 1.ª página, precarga la 2.ª en segundo plano (scroll fluido). */
  useEffect(() => {
    if (!prefetchNextPage) return
    if (loading || loadingMore || error) return
    if (activeCacheKeyRef.current !== cacheKey) return
    if (maxLoadedPageRef.current !== 1) return
    if (page < 1 || !hasMore) return
    if (pagesInFlightRef.current.has(2)) return
    void cargarPagina(2, true)
  }, [
    prefetchNextPage,
    loading,
    loadingMore,
    error,
    page,
    hasMore,
    cacheKey,
    cargarPagina,
  ])

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
    updateListFilters({ dias_bucket: '' })
  }

  function handleClickSaldoAntiguedad(bucketId) {
    if (bucketId === 'all') {
      handleTodasTramos()
      return
    }
    const rId = BUCKET_TO_R[bucketId]
    if (!rId) return
    updateListFilters({ dias_bucket: rId })
  }

  function toggleTramo(bucketId) {
    const id = String(bucketId || '').trim().toLowerCase()
    if (!id) return
    const selected = parseDiasBucketsList(listFilters.dias_bucket)
    if (selected.length === 0) {
      updateListFilters({ dias_bucket: id })
      return
    }
    const set = new Set(selected)
    if (set.has(id)) {
      set.delete(id)
      updateListFilters({ dias_bucket: formatDiasBucketsList([...set]) })
      return
    }
    set.add(id)
    updateListFilters({ dias_bucket: formatDiasBucketsList([...set]) })
  }

  function toggleRutaGrupo(rutaKey) {
    setRutasGrupoColapsadas((prev) => {
      const next = new Set(prev)
      if (next.has(rutaKey)) next.delete(rutaKey)
      else next.add(rutaKey)
      return next
    })
  }

  function handleTodasRutas() {
    // Toggle: Todas ↔ ninguna. Desde una selección parcial, vuelve a Todas.
    if (rutasFiltroMode === 'all') {
      setListFilters({ rutas: RUTAS_FILTRO_NINGUNA })
      return
    }
    setListFilters({ rutas: '' })
  }

  function codigosRutasDisponibles() {
    return rutasChipList
      .map((r) => String(r.codigo || '').trim().toUpperCase())
      .filter(Boolean)
  }

  function toggleRuta(codigo) {
    const code = String(codigo || '').trim().toUpperCase()
    if (!code) return
    const allCodes = codigosRutasDisponibles()

    if (rutasFiltroMode === 'none') {
      setListFilters({ rutas: code })
      return
    }

    // Con Todas activas: quitar solo esta ruta (quedan las demás).
    if (rutasFiltroMode === 'all') {
      const rest = allCodes.filter((c) => c !== code)
      setListFilters({
        rutas: rest.length === 0 ? RUTAS_FILTRO_NINGUNA : formatRutasList(rest),
      })
      return
    }

    const set = new Set(parseRutasList(listFilters.rutas))
    if (set.has(code)) {
      set.delete(code)
      setListFilters({
        rutas: set.size === 0 ? RUTAS_FILTRO_NINGUNA : formatRutasList([...set]),
      })
      return
    }

    set.add(code)
    // Si ya están todas las del catálogo, volver a modo Todas.
    if (allCodes.length > 0 && allCodes.every((c) => set.has(c))) {
      setListFilters({ rutas: '' })
      return
    }
    setListFilters({ rutas: formatRutasList([...set]) })
  }

  const tableColCount = groupByRuta ? 12 : 13

  function renderNotaRows(n) {
    return (
      <Fragment key={n.id}>
        <tr
          className={
            listFilters.mostrarComentarios && n.aclaraciones?.length > 0 ? 'border-bottom-0' : ''
          }
        >
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
          <td
            className="text-end text-nowrap small"
            title="Días desde la fecha de la nota hasta hoy"
          >
            {formatDiasNotaCorriente(n.fecha_nota, n.fecha_corriente)}
          </td>
          <td>{n.cliente || '—'}</td>
          <td>{n.empresa || '—'}</td>
          {groupByRuta ? null : <td>{n.ruta_codigo || '—'}</td>}
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
                to={sectionConfig.detalleRoute(String(n.id))}
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
        {listFilters.mostrarComentarios && n.aclaraciones?.length > 0 ? (
          <tr className="bg-transparent">
            <td colSpan={tableColCount} className="p-0 border-top-0">
              <div className="bg-body-secondary bg-opacity-25 p-2 small ms-4 me-4 mb-2 rounded border shadow-sm">
                <div className="fw-bold mb-1 border-bottom pb-1 d-flex align-items-center gap-2 text-body">
                  <span>Comentarios recientes:</span>
                  <span className="badge rounded-pill text-bg-secondary opacity-75">
                    {n.aclaraciones.length}
                  </span>
                </div>
                {n.aclaraciones.map((c) => (
                  <div key={c.id} className="mb-1 border-bottom border-secondary-subtle pb-1">
                    <span
                      className="badge text-bg-secondary me-1 opacity-75"
                      style={{ fontSize: '0.65rem' }}
                    >
                      {c.tipo}
                    </span>
                    <span className="text-body-secondary me-1 fw-semibold">
                      {c.usuarios?.username || '—'}{' '}
                      <span className="fw-normal opacity-75" style={{ fontSize: '0.7rem' }}>
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
        ) : null}
      </Fragment>
    )
  }

  return (
    <section className="container-fluid px-0">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 mb-0">{sectionConfig.title}</h1>
        {(sectionConfig.showReportBack && (fromReport || listFilters.dias_bucket)) && (
          <Link to={ROUTES.reporte} className="btn btn-primary btn-sm px-3 shadow-sm">
            ← Regresar al Reporte
          </Link>
        )}
      </div>
      <div className="alert alert-light border py-2 mb-3 small">
        <div className="d-flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <span className="text-body-secondary">Empresa:</span>{' '}
            <strong>{listFilters.empresaActiva}</strong>
          </span>
          {showRutasFilter ? (
            <span>
              <span className="text-body-secondary">Rutas:</span> <strong>{rutasActivasLabel}</strong>
              {rutasFiltroMode === 'some' &&
              rutasSeleccionadas.length > 0 &&
              rutasChipList.length > 0 ? (
                <span className="text-body-secondary">
                  {' '}
                  ({rutasSeleccionadas.length}/{rutasChipList.length})
                </span>
              ) : null}
            </span>
          ) : null}
          <span>
            <span className="text-body-secondary">
              {antiguedadMode === 'dias_min' ? 'Antigüedad:' : 'Tramos:'}
            </span>{' '}
            <strong>{tramoActivoLabel}</strong>
            {antiguedadMode === 'chips' && tramosSeleccionados.length > 1 ? (
              <span className="text-body-secondary"> ({tramosSeleccionados.length} seleccionados)</span>
            ) : null}
          </span>
        </div>
        {showRutasFilter && isVendedor && rutasAsignadas.length === 0 && !rutasAsignadasError ? (
          <div className="text-warning mt-1">Sin rutas asignadas. Contacta al administrador.</div>
        ) : null}
        {showRutasFilter && (rutasAsignadasError || rutasCatalogoError) ? (
          <div className="text-danger mt-1">{rutasAsignadasError || rutasCatalogoError}</div>
        ) : null}
      </div>
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${listFilters.empresaActiva === 'DISTRIBUIDORA' ? ' active' : ''}`}
            onClick={() => updateListFilters({ empresaActiva: 'DISTRIBUIDORA' })}
          >
            Distribuidora
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${listFilters.empresaActiva === 'RODRIGO' ? ' active' : ''}`}
            onClick={() => updateListFilters({ empresaActiva: 'RODRIGO' })}
          >
            Rodrigo
          </button>
        </li>
      </ul>

      <div className="card mb-3">
        <div className="card-body">
          {antiguedadMode === 'dias_min' ? (
            <div className="mb-3">
              <div className="form-label mb-1">Antigüedad (días desde fecha de nota)</div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="small text-body-secondary">Mayores a</span>
                <input
                  id="conciliacion-dias-min"
                  type="number"
                  min={1}
                  step={1}
                  className="form-control"
                  style={{ maxWidth: '7rem' }}
                  aria-label="Mayores a días"
                  value={diasMinInput}
                  onChange={(e) => setDiasMinInput(e.target.value)}
                  onBlur={() => {
                    const parsed = Number.parseInt(String(diasMinInput || '').trim(), 10)
                    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultDiasMin
                    setDiasMinInput(String(next))
                    const rawMax = String(diasMaxInput || '').trim()
                    const parsedMax = Number.parseInt(rawMax, 10)
                    const nextMax =
                      rawMax === '' || !Number.isFinite(parsedMax) || parsedMax <= 0
                        ? ''
                        : parsedMax
                    updateListFilters({ dias_min: next, dias_max: nextMax, dias_bucket: '' })
                  }}
                />
                <span className="small text-body-secondary">menores a</span>
                <input
                  id="conciliacion-dias-max"
                  type="number"
                  min={1}
                  step={1}
                  className="form-control"
                  style={{ maxWidth: '7rem' }}
                  placeholder="opcional"
                  aria-label="Menores a días"
                  value={diasMaxInput}
                  onChange={(e) => setDiasMaxInput(e.target.value)}
                  onBlur={() => {
                    const parsedMin = Number.parseInt(String(diasMinInput || '').trim(), 10)
                    const nextMin =
                      Number.isFinite(parsedMin) && parsedMin > 0 ? parsedMin : defaultDiasMin
                    setDiasMinInput(String(nextMin))
                    const rawMax = String(diasMaxInput || '').trim()
                    if (rawMax === '') {
                      setDiasMaxInput('')
                      updateListFilters({ dias_min: nextMin, dias_max: '', dias_bucket: '' })
                      return
                    }
                    const parsedMax = Number.parseInt(rawMax, 10)
                    if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
                      setDiasMaxInput('')
                      updateListFilters({ dias_min: nextMin, dias_max: '', dias_bucket: '' })
                      return
                    }
                    setDiasMaxInput(String(parsedMax))
                    updateListFilters({
                      dias_min: nextMin,
                      dias_max: parsedMax,
                      dias_bucket: '',
                    })
                  }}
                />
                <span className="small text-body-secondary">días</span>
              </div>
              {Number.parseInt(String(listFilters.dias_max ?? ''), 10) > 0 &&
              Number.parseInt(String(listFilters.dias_max), 10) <=
                (Number.parseInt(String(listFilters.dias_min ?? ''), 10) > 0
                  ? Number.parseInt(String(listFilters.dias_min), 10)
                  : defaultDiasMin) ? (
                <div className="small text-warning mt-1">
                  «Menores a» debe ser mayor que «Mayores a» para aplicar el tope.
                </div>
              ) : null}
            </div>
          ) : (
            <>
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
            </>
          )}

          {showRutasFilter ? (
            <div className="mb-3">
              <div className="mb-2 small text-body-secondary">
                {isVendedor ? 'Tus rutas asignadas' : 'Rutas'}
              </div>
              <div className="nc-rutas-chips">
                <button
                  type="button"
                  className={`btn btn-sm nc-ruta-chip ${rutasFiltroMode === 'all' ? 'is-selected' : ''}`}
                  onClick={handleTodasRutas}
                >
                  Todas
                </button>
                {rutasChipList.map((r) => {
                  const code = String(r.codigo || '').trim().toUpperCase()
                  const isSelected =
                    rutasFiltroMode === 'all' || rutasSeleccionadas.includes(code)
                  const inactiva = r.activa === false
                  return (
                    <button
                      key={r.id ?? code}
                      type="button"
                      title={inactiva ? `${r.nombre || code} (inactiva)` : r.nombre || code}
                      className={`btn btn-sm nc-ruta-chip${isSelected ? ' is-selected' : ''}${inactiva ? ' is-inactive' : ''}`}
                      onClick={() => toggleRuta(code)}
                    >
                      <span className="nc-ruta-chip-label">{code}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="row g-2">
            <div className="col-12 col-md-6 col-lg-2">
              <label className="form-label mb-1">Estado</label>
              <select
                className="form-select"
                value={listFilters.estado}
                onChange={(e) => updateListFilters({ estado: e.target.value })}
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
                value={listFilters.atencion}
                onChange={(e) => {
                  const next = e.target.value
                  const estadoActual = String(listFilters.estado || '').toUpperCase()
                  // Atención solo aplica a PENDIENTE; evita filtros que se anulan entre sí.
                  if (
                    next === 'si' &&
                    (estadoActual === 'RESUELTA' || estadoActual === 'CANCELADA')
                  ) {
                    updateListFilters({ atencion: next, estado: 'PENDIENTE' })
                    return
                  }
                  updateListFilters({ atencion: next })
                }}
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
                value={listFilters.orden}
                onChange={(e) => updateListFilters({ orden: e.target.value })}
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
                  checked={listFilters.mostrarComentarios}
                  onChange={(e) => setListFilters({ mostrarComentarios: e.target.checked })}
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
                    const r = await exportarSeguimientoExcelConFiltros(
                      filtrosExportacion,
                      opcionesExportacion,
                    )
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
                    const r = await exportarSeguimientoPdfConFiltros(
                      filtrosExportacion,
                      opcionesExportacion,
                    )
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
        <div className="card-header py-2 px-3">
          <h2 className="h6 mb-0">{sectionConfig.tableTitle || 'Listado de notas'}</h2>
        </div>
        <div className="d-none d-md-block table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th className="text-nowrap">ID</th>
                <th className="text-nowrap">Serie/Folio</th>
                <th className="text-nowrap">Fecha nota</th>
                <th className="text-end text-nowrap" title="Días desde la fecha de la nota hasta hoy">
                  Días
                </th>
                <th className="text-nowrap">Cliente</th>
                <th className="text-nowrap">Empresa</th>
                {groupByRuta ? null : <th className="text-nowrap">Ruta</th>}
                <th className="text-end text-nowrap">Monto</th>
                <th className="text-end text-nowrap">Abono</th>
                <th className="text-end text-nowrap">Saldo</th>
                <th className="text-nowrap">Estado</th>
                <th className="text-nowrap">Atención</th>
                <th className="text-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={tableColCount} className="text-center py-4">
                    Cargando...
                  </td>
                </tr>
              ) : data.items?.length ? (
                groupByRuta ? (
                  gruposPorRuta.map((grupo) => {
                    const collapsed = rutasGrupoColapsadas.has(grupo.key)
                    return (
                      <Fragment key={`ruta-${grupo.key}`}>
                        <tr className="conciliacion-ruta-group">
                          <td colSpan={tableColCount} className="p-0">
                            <button
                              type="button"
                              className="conciliacion-ruta-group-btn btn w-100 text-start rounded-0 border-0 px-3 py-2 d-flex flex-wrap align-items-center gap-2"
                              onClick={() => toggleRutaGrupo(grupo.key)}
                              aria-expanded={!collapsed}
                            >
                              <span className="d-inline-flex align-items-center justify-content-center flex-shrink-0" aria-hidden>
                                {collapsed ? <FaChevronRight size={14} /> : <FaChevronDown size={14} />}
                              </span>
                              <span className="fw-semibold text-nowrap">
                                Ruta {grupo.key}
                              </span>
                              <span className="badge text-bg-secondary fw-normal">
                                {grupo.items.length} nota{grupo.items.length === 1 ? '' : 's'}
                              </span>
                              <span className="small text-body-secondary ms-md-auto text-nowrap">
                                Saldo {money(grupo.saldo)}
                                <span className="mx-1">·</span>
                                Monto {money(grupo.monto)}
                              </span>
                            </button>
                          </td>
                        </tr>
                        {collapsed ? null : grupo.items.map((n) => renderNotaRows(n))}
                      </Fragment>
                    )
                  })
                ) : (
                  data.items.map((n) => renderNotaRows(n))
                )
              ) : (
                <tr>
                  <td colSpan={tableColCount} className="text-center py-4">
                    Sin resultados
                  </td>
                </tr>
              )}
            </tbody>
            {!loading && data.items?.length ? (
              <tfoot className="table-light">
                <tr>
                  <td colSpan={groupByRuta ? 6 : 7} className="small fw-semibold">
                    Suma filtrada
                    <span className="fw-normal text-body-secondary ms-1">
                      ({(data?.resumen?.total_filtrado ?? data?.total ?? 0).toLocaleString('es-MX')}{' '}
                      notas)
                    </span>
                  </td>
                  <td className="text-end small fw-semibold">{money(data?.resumen?.monto_total)}</td>
                  <td className="text-end small fw-semibold">{money(data?.resumen?.abono_total)}</td>
                  <td className="text-end small fw-semibold text-primary">
                    {money(data?.resumen?.saldo_total)}
                  </td>
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
              {groupByRuta
                ? gruposPorRuta.map((grupo) => {
                    const collapsed = rutasGrupoColapsadas.has(grupo.key)
                    return (
                      <div key={`m-ruta-${grupo.key}`} className="border rounded">
                        <button
                          type="button"
                          className="conciliacion-ruta-group-btn btn btn-sm w-100 text-start d-flex align-items-center gap-2 py-2 px-3 rounded-0 border-0"
                          onClick={() => toggleRutaGrupo(grupo.key)}
                          aria-expanded={!collapsed}
                        >
                          {collapsed ? (
                            <FaChevronRight size={14} aria-hidden />
                          ) : (
                            <FaChevronDown size={14} aria-hidden />
                          )}
                          <span className="fw-semibold">Ruta {grupo.key}</span>
                          <span className="badge text-bg-secondary">
                            {grupo.items.length}
                          </span>
                          <span className="small text-body-secondary ms-auto">{money(grupo.saldo)}</span>
                        </button>
                        {collapsed ? null : (
                          <div className="d-flex flex-column gap-2 p-2">
                            {grupo.items.map((n) => (
                              <NotaSeguimientoCardMovil
                                key={n.id}
                                n={n}
                                detalleTo={sectionConfig.detalleRoute(String(n.id))}
                                onCopySerieFolio={handleCopySerieFolio}
                                onAbrirComentario={setComentarioNota}
                                mostrarComentarios={listFilters.mostrarComentarios}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                : data.items.map((n) => (
                    <NotaSeguimientoCardMovil
                      key={n.id}
                      n={n}
                      detalleTo={sectionConfig.detalleRoute(String(n.id))}
                      onCopySerieFolio={handleCopySerieFolio}
                      onAbrirComentario={setComentarioNota}
                      mostrarComentarios={listFilters.mostrarComentarios}
                    />
                  ))}
              <div className="card border shadow-sm bg-body-tertiary">
                <div className="card-body py-3">
                  <div className="fw-semibold mb-2">
                    Suma filtrada
                    <span className="fw-normal text-body-secondary ms-1">
                      ({(data?.resumen?.total_filtrado ?? data?.total ?? 0).toLocaleString('es-MX')}{' '}
                      notas)
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
        {loadingMore ? 'Cargando más…' : hasMore ? 'Desplázate para cargar más' : 'Fin de resultados'}
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
