import { create } from 'zustand'

const CACHE_TTL_MS = 5 * 60 * 1000

function ensureBucket(state, screen) {
  if (screen === 'seguimiento') return state.seguimiento
  if (screen === 'reporte') return state.reporte
  return state.notas
}

function withBucket(state, screen, nextBucket) {
  if (screen === 'seguimiento') return { ...state, seguimiento: nextBucket }
  if (screen === 'reporte') return { ...state, reporte: nextBucket }
  return { ...state, notas: nextBucket }
}

export const useListCacheStore = create((set, get) => ({
  notas: {},
  seguimiento: {},
  reporte: {},

  getEntry: (screen, key) => {
    const bucket = ensureBucket(get(), screen)
    const entry = bucket[key]
    if (!entry) return null
    const isFresh = Date.now() - Number(entry.updatedAt || 0) <= CACHE_TTL_MS
    if (!isFresh) return null
    return entry
  },

  setPage: (screen, key, page, payload) => {
    set((state) => {
      const bucket = ensureBucket(state, screen)
      const prev = bucket[key] || {
        pages: {},
        total: 0,
        totalPages: 1,
        updatedAt: 0,
      }
      const nextEntry = {
        ...prev,
        pages: {
          ...prev.pages,
          [page]: Array.isArray(payload?.items) ? payload.items : [],
        },
        total: Number(payload?.total || prev.total || 0),
        totalPages: Number(payload?.totalPages || prev.totalPages || 1),
        updatedAt: Date.now(),
      }
      return withBucket(state, screen, { ...bucket, [key]: nextEntry })
    })
  },

  /** Guarda un payload completo (p. ej. reporte de cartera) bajo una cacheKey. */
  setPayload: (screen, key, payload) => {
    set((state) => {
      const bucket = ensureBucket(state, screen)
      const nextEntry = {
        payload,
        updatedAt: Date.now(),
      }
      return withBucket(state, screen, { ...bucket, [key]: nextEntry })
    })
  },

  clearEntry: (screen, key) => {
    set((state) => {
      const next = { ...ensureBucket(state, screen) }
      delete next[key]
      return withBucket(state, screen, next)
    })
  },

  clearScreen: (screen) => {
    set((state) => withBucket(state, screen, {}))
  },
}))
