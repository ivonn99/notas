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
  ruta: '',
  q: '',
  dias: '',
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
    'id_desc',
    'id_asc',
    'serie_folio_asc',
    'serie_folio_desc',
    'cliente_asc',
    'cliente_desc',
    'saldo_desc',
    'saldo_asc',
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
      version: 3,
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== 'object') return persisted
        const state = persisted
        const notas = state.notas && typeof state.notas === 'object' ? state.notas : {}
        const seguimiento =
          state.seguimiento && typeof state.seguimiento === 'object'
            ? state.seguimiento
            : {}

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
            dias: seguimiento.dias != null ? seguimiento.dias : initialSeguimiento.dias,
            orden: normalizeSeguimientoOrden(seguimiento.orden),
          },
        }

        return migrated
      },
      partialize: (state) => ({
        notas: state.notas,
        seguimiento: state.seguimiento,
      }),
    },
  ),
)

