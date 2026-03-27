import { create } from 'zustand'
import { alertasApi } from '../services/alertasApi.js'
import { notificacionesApi } from '../services/notificacionesApi.js'

const POLL_MS = 30000

let pollTimer = null
let pollRefs = 0

export const useNotificationsStore = create((set, get) => ({
  total: 0,
  items: [],
  alertas: [],
  loadingItems: false,
  loadingAlertas: false,
  lastError: '',

  loadResumen: async () => {
    try {
      const r = await notificacionesApi.resumen()
      set({ total: r?.counts?.total ?? 0 })
      return r
    } catch {
      set({ total: 0 })
      return null
    }
  },

  loadItems: async () => {
    set({ loadingItems: true, lastError: '' })
    try {
      const r = await notificacionesApi.list()
      set({ items: r?.items || [] })
      await get().loadResumen()
      return r
    } catch (e) {
      set({ lastError: e?.message || 'No se pudo cargar notificaciones' })
      return null
    } finally {
      set({ loadingItems: false })
    }
  },

  loadAlertas: async (canCredito) => {
    if (!canCredito) {
      set({ alertas: [], loadingAlertas: false })
      return null
    }
    set({ loadingAlertas: true, lastError: '' })
    try {
      const r = await alertasApi.list()
      set({ alertas: r?.items || [] })
      return r
    } catch (e) {
      set({ lastError: e?.message || 'No se pudo cargar alertas' })
      return null
    } finally {
      set({ loadingAlertas: false })
    }
  },

  marcarNotificacionLeida: async (item) => {
    await notificacionesApi.marcarLeida(item.tipo, item.id)
    await get().loadItems()
  },

  marcarTodasNotificaciones: async () => {
    await notificacionesApi.marcarTodas()
    await get().loadItems()
  },

  marcarAlertaLeida: async (id, canCredito) => {
    await alertasApi.marcarLeida(id)
    await get().loadAlertas(canCredito)
    await get().loadResumen()
  },

  startPolling: () => {
    pollRefs += 1
    if (pollTimer) return
    // Primer refresh inmediato para no esperar la primera ventana.
    void get().loadResumen()
    pollTimer = setInterval(() => {
      void get().loadResumen()
    }, POLL_MS)
  },

  stopPolling: () => {
    pollRefs = Math.max(0, pollRefs - 1)
    if (pollRefs > 0) return
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  },
}))

