import { ROUTES } from './routes.js'

/**
 * Config compartida entre Seguimiento y Conciliación (réplica admin).
 * Cuando Conciliación diverja, se puede ampliar aquí o dejar de reutilizar las páginas.
 */
export const LISTADO_SECTIONS = {
  seguimiento: {
    id: 'seguimiento',
    title: 'Seguimiento',
    screen: 'seguimiento',
    filtersKey: 'seguimiento',
    setFiltersKey: 'setSeguimientoFilters',
    detalleRoute: ROUTES.detalleNota,
    listRoute: ROUTES.seguimiento,
    showReportBack: true,
    logTag: 'seguimiento',
    /** Vendedor limitado a usuario_rutas; ADMIN/CREDITO ven todo. */
    scopeByUsuarioRutas: true,
    showRutasFilter: true,
    antiguedadMode: 'chips',
    tableTitle: 'Listado de seguimiento',
    tableLayout: 'flat',
    pageSize: 80,
    /** Precarga cuando el sentinel está a esta distancia del viewport. */
    infiniteScrollRootMargin: '800px 0px',
    /** Tras la 1.ª página, pide la siguiente en segundo plano. */
    prefetchNextPage: true,
    exportTitle: 'Seguimiento — Listado de notas',
    exportFilePrefix: 'seguimiento',
    exportSheetName: 'Seguimiento',
    exportGroupByRuta: false,
  },
  conciliacion: {
    id: 'conciliacion',
    title: 'Conciliación',
    screen: 'conciliacion',
    filtersKey: 'conciliacion',
    setFiltersKey: 'setConciliacionFilters',
    detalleRoute: ROUTES.detalleNotaConciliacion,
    listRoute: ROUTES.conciliacion,
    showReportBack: false,
    logTag: 'conciliacion',
    /** Solo ADMIN: sin recorte por rutas asignadas; filtro de rutas como chips del catálogo. */
    scopeByUsuarioRutas: false,
    showRutasFilter: true,
    antiguedadMode: 'dias_min',
    defaultDiasMin: 60,
    /** Vacío = sin tope superior. */
    defaultDiasMax: '',
    tableTitle: 'Rutas y notas a conciliar',
    tableLayout: 'group_by_ruta',
    pageSize: 80,
    infiniteScrollRootMargin: '800px 0px',
    /** Tras la 1.ª página, pide la siguiente en segundo plano. */
    prefetchNextPage: true,
    exportTitle: 'Conciliación — Rutas y notas a conciliar',
    exportFilePrefix: 'conciliacion',
    exportSheetName: 'Conciliación',
    exportGroupByRuta: true,
  },
}

export function getListadoSection(section = 'seguimiento') {
  return LISTADO_SECTIONS[section] || LISTADO_SECTIONS.seguimiento
}
