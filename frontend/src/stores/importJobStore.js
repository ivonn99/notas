import { create } from 'zustand'
import { importacionesApi } from '../services/importacionesApi.js'
import { buildImportacionResumenMessage } from '../utils/importacionResumen.js'

const POLL_MS = 1200

function isDoneStatus(status) {
  const s = String(status || '').toUpperCase()
  return ['COMPLETADA', 'PARCIAL', 'FALLIDA'].includes(s)
}

export const useImportJobStore = create((set, get) => ({
  currentImportacionId: null,
  status: null,
  total: 0,
  processed: 0,
  errorCount: 0,
  pct: 0,
  loading: false,
  error: '',
  okMessage: '',

  resetMessages: () => set({ error: '', okMessage: '' }),

  pollProgress: async (importacionId) => {
    let last = null
    while (true) {
      const p = await importacionesApi.progreso(importacionId)
      last = p
      if (p.inMemory) {
        set({
          currentImportacionId: importacionId,
          status: p.status,
          total: p.total ?? 0,
          processed: p.processed ?? 0,
          errorCount: p.errorCount ?? 0,
          pct: p.pct ?? 0,
        })
        if (p.done) break
      } else {
        const pr = p.progress || {}
        const i = p.importacion || {}
        const status = pr.status || i.estado
        set({
          currentImportacionId: importacionId,
          status,
          total: pr.total ?? i.total_registros ?? 0,
          processed:
            pr.processed ?? (Number(i.registros_nuevos || 0) + Number(i.registros_actualizados || 0)),
          errorCount: pr.errorCount ?? 0,
          pct: pr.pct ?? 0,
        })
        if (Boolean(pr.done) || isDoneStatus(status)) break
      }
      await new Promise((r) => setTimeout(r, POLL_MS))
    }
    return last
  },

  startImport: async ({ file, mapping, empresaImportacion }) => {
    set({
      loading: true,
      error: '',
      okMessage: '',
      currentImportacionId: null,
      status: null,
      total: 0,
      processed: 0,
      errorCount: 0,
      pct: 0,
    })
    try {
      const r = await importacionesApi.uploadCsv(file, mapping, empresaImportacion)
      const lastPoll = await get().pollProgress(r.importacionId)
      set({
        okMessage: buildImportacionResumenMessage(r.importacionId, lastPoll),
      })
      return r
    } catch (e) {
      set({ error: e?.message || 'No se pudo importar' })
      throw e
    } finally {
      set({ loading: false })
    }
  },
}))

