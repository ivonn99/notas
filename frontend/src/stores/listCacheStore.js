import { create } from 'zustand'

/** Caché temporal en memoria (sobrevive navegación SPA; se pierde al recargar el navegador). */
const CACHE_TTL_MS = 15 * 60 * 1000

const BUCKET_KEYS = new Set(['notas', 'seguimiento', 'conciliacion', 'reporte'])

function ensureBucket(state, screen) {
  if (BUCKET_KEYS.has(screen) && state[screen]) return state[screen]
  return state.notas
}

function withBucket(state, screen, nextBucket) {
  if (BUCKET_KEYS.has(screen)) return { ...state, [screen]: nextBucket }
  return { ...state, notas: nextBucket }
}

function isFresh(entry) {
  return Boolean(entry) && Date.now() - Number(entry.updatedAt || 0) <= CACHE_TTL_MS
}

export const useListCacheStore = create((set, get) => ({
  notas: {},
  seguimiento: {},
  conciliacion: {},
  reporte: {},

  getEntry: (screen, key) => {
    const bucket = ensureBucket(get(), screen)
    const entry = bucket[key]
    if (!isFresh(entry)) return null
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
        ui: null,
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
      // Agregados de la 1.ª página (o cuando el API los manda).
      if (payload?.resumen != null) nextEntry.resumen = payload.resumen
      if (payload?.porRuta != null) nextEntry.porRuta = payload.porRuta
      if (payload?.porAntiguedad != null) nextEntry.porAntiguedad = payload.porAntiguedad
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

  /**
   * Estado de UI (scroll, grupos colapsados). No renueva el TTL de los datos.
   */
  setUiState: (screen, key, ui) => {
    if (!key) return
    set((state) => {
      const bucket = ensureBucket(state, screen)
      const prev = bucket[key]
      if (!prev) return state
      return withBucket(state, screen, {
        ...bucket,
        [key]: {
          ...prev,
          ui: { ...(prev.ui || {}), ...(ui || {}) },
        },
      })
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

export function maxConsecutiveCachedPage(entry) {
  if (!entry?.pages) return 0
  let page = 1
  while (Array.isArray(entry.pages[page])) page += 1
  return page - 1
}

export { CACHE_TTL_MS }
