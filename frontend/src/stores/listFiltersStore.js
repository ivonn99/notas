import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { formatDiasBucketsList, parseDiasBucketsList } from '../utils/diasBuckets.js'

const initialNotas = {
  empresaActiva: 'DISTRIBUIDORA',
  estado: 'PENDIENTE',
  ruta: '',
  q: '',
  dias_bucket: '',
  sort: 'fecha_nota_desc',
  mostrarComentarios: false,
}

const initialSeguimiento = {
  empresaActiva: 'DISTRIBUIDORA',
  estado: 'PENDIENTE',
  atencion: '',
  rutas: '',
  q: '',
  dias_bucket: '',
  orden: 'fecha_nota_asc',
  mostrarComentarios: false,
}

function normalizeNotasSort(sort) {
  const raw = String(sort || '').trim()
  if (raw === 'fecha_corriente_desc') return 'fecha_nota_desc'
  if (raw === 'fecha_corriente_asc') return 'fecha_nota_asc'
  return [
    'fecha_nota_desc',
    'fecha_nota_asc',
    'saldo_desc',
    'saldo_asc',
    'estado_asc',
    'atencion_desc',
  ].includes(raw)
    ? raw
    : initialNotas.sort
}

function normalizeSeguimientoOrden(orden) {
  const raw = String(orden || '').trim().toLowerCase()
  if (raw === 'fecha_corriente_desc') return 'fecha_nota_desc'
  if (raw === 'fecha_corriente_asc') return 'fecha_nota_asc'
  if (raw === 'default' || raw === 'atencion') return 'fecha_nota_asc'
  return [
    'fecha_ultima_desc',
    'fecha_ultima_asc',
    'fecha_nota_desc',
    'fecha_nota_asc',
    'dias_corriente_desc',
    'dias_corriente_asc',
  ].includes(raw)
    ? raw
    : initialSeguimiento.orden
}

/** Mapea el viejo filtro «últimos N días» a chips de antigüedad. */
function legacyDiasToBuckets(diasRaw) {
  const dias = Number.parseInt(String(diasRaw ?? ''), 10)
  if (!Number.isFinite(dias) || dias <= 0) return ''
  if (dias <= 30) return 'r1'
  if (dias <= 60) return formatDiasBucketsList(['r1', 'r2', 'r2b'])
  if (dias <= 90) return formatDiasBucketsList(['r1', 'r2', 'r2b', 'r3'])
  if (dias <= 180) return formatDiasBucketsList(['r1', 'r2', 'r2b', 'r3', 'r4'])
  if (dias <= 365) return formatDiasBucketsList(['r1', 'r2', 'r2b', 'r3', 'r4', 'r5'])
  return ''
}

export const useListFiltersStore = create(
  persist(
    (set) => ({
      notas: initialNotas,
      seguimiento: initialSeguimiento,

      setNotasFilters: (partial) =>
        set((state) => ({
          notas: { ...state.notas, ...partial },
        })),
      resetNotasFilters: () => set({ notas: initialNotas }),

      setSeguimientoFilters: (partial) =>
        set((state) => ({
          seguimiento: { ...state.seguimiento, ...partial },
        })),
      resetSeguimientoFilters: () => set({ seguimiento: initialSeguimiento }),
    }),
    {
      name: 'nc_list_filters_v1',
      version: 9,
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted
        const state = persisted
        const notas = state.notas && typeof state.notas === 'object' ? state.notas : {}
        const seguimiento =
          state.seguimiento && typeof state.seguimiento === 'object'
            ? state.seguimiento
            : {}

        const rutasLegacy =
          seguimiento.rutas != null
            ? String(seguimiento.rutas)
            : seguimiento.ruta != null
              ? String(seguimiento.ruta)
              : initialSeguimiento.rutas

        let diasBucketSeg =
          seguimiento.dias_bucket != null ? String(seguimiento.dias_bucket) : initialSeguimiento.dias_bucket
        if (!diasBucketSeg) {
          const legacyDias = Number.parseInt(String(seguimiento.dias ?? ''), 10)
          if (Number.isFinite(legacyDias) && legacyDias > 0 && legacyDias <= 30) {
            diasBucketSeg = 'r1'
          }
        }

        let diasBucketNotas =
          notas.dias_bucket != null && String(notas.dias_bucket).trim()
            ? formatDiasBucketsList(parseDiasBucketsList(notas.dias_bucket))
            : ''
        if (!diasBucketNotas && notas.dias != null && String(notas.dias).trim()) {
          diasBucketNotas = legacyDiasToBuckets(notas.dias)
        }

        // Antes el default de "Todas las notas" era estado vacío (= Todos).
        // A partir de v9 el default es PENDIENTE (alineado con Seguimiento).
        const estadoNotas =
          notas.estado != null && String(notas.estado).trim()
            ? String(notas.estado).trim().toUpperCase()
            : initialNotas.estado

        const migrated = {
          ...state,
          notas: {
            ...initialNotas,
            ...notas,
            estado: estadoNotas,
            dias_bucket: diasBucketNotas,
            sort: normalizeNotasSort(notas.sort),
          },
          seguimiento: {
            ...initialSeguimiento,
            ...seguimiento,
            rutas: rutasLegacy,
            dias_bucket: diasBucketSeg,
            orden: normalizeSeguimientoOrden(seguimiento.orden),
          },
        }
        delete migrated.seguimiento.ruta
        delete migrated.seguimiento.dias
        delete migrated.notas.dias

        return migrated
      },
      partialize: (state) => ({
        notas: state.notas,
        seguimiento: state.seguimiento,
      }),
    },
  ),
)
