import { create } from 'zustand'

const CACHE_TTL_MS = 5 * 60 * 1000

function ensureBucket(state, screen) {
  if (screen === 'seguimiento') return state.seguimiento
  return state.notas
}

export const useListCacheStore = create((set, get) => ({
  notas: {},
  seguimiento: {},

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
      if (screen === 'seguimiento') {
        return { ...state, seguimiento: { ...state.seguimiento, [key]: nextEntry } }
      }
      return { ...state, notas: { ...state.notas, [key]: nextEntry } }
    })
  },

  clearEntry: (screen, key) => {
    set((state) => {
      if (screen === 'seguimiento') {
        const next = { ...state.seguimiento }
        delete next[key]
        return { ...state, seguimiento: next }
      }
      const next = { ...state.notas }
      delete next[key]
      return { ...state, notas: next }
    })
  },

  clearScreen: (screen) => {
    set((state) => {
      if (screen === 'seguimiento') return { ...state, seguimiento: {} }
      return { ...state, notas: {} }
    })
  },
}))

