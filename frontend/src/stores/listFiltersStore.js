import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const initialNotas = {
  empresaActiva: 'DISTRIBUIDORA',
  estado: '',
  ruta: '',
  q: '',
  dias: '',
  sort: 'fecha_nota_desc',
}

const initialSeguimiento = {
  empresaActiva: 'DISTRIBUIDORA',
  estado: 'PENDIENTE',
  atencion: '',
  ruta: '',
  q: '',
  orden: 'default',
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
      partialize: (state) => ({
        notas: state.notas,
        seguimiento: state.seguimiento,
      }),
    },
  ),
)

