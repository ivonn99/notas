import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const initialNotas = {
  empresaActiva: 'DISTRIBUIDORA',
  estado: '',
  ruta: '',
  q: '',
  dias: '',
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
  orden: 'default',
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
  return [
    'default',
    'atencion',
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
      version: 6,
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

        let diasBucket =
          seguimiento.dias_bucket != null ? String(seguimiento.dias_bucket) : initialSeguimiento.dias_bucket
        if (!diasBucket) {
          const legacyDias = Number.parseInt(String(seguimiento.dias ?? ''), 10)
          if (Number.isFinite(legacyDias) && legacyDias > 0 && legacyDias <= 30) {
            diasBucket = 'r1'
          }
        }

        const migrated = {
          ...state,
          notas: {
            ...initialNotas,
            ...notas,
            sort: normalizeNotasSort(notas.sort),
          },
          seguimiento: {
            ...initialSeguimiento,
            ...seguimiento,
            rutas: rutasLegacy,
            dias_bucket: diasBucket,
            orden: normalizeSeguimientoOrden(seguimiento.orden),
          },
        }
        delete migrated.seguimiento.ruta
        delete migrated.seguimiento.dias

        return migrated
      },
      partialize: (state) => ({
        notas: state.notas,
        seguimiento: state.seguimiento,
      }),
    },
  ),
)

