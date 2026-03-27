import { create } from 'zustand'

export const useDomainSyncStore = create((set) => ({
  notasVersion: 0,
  rutasVersion: 0,
  usuariosVersion: 0,
  notificacionesVersion: 0,

  emitNotaChanged: () =>
    set((s) => ({
      notasVersion: s.notasVersion + 1,
      notificacionesVersion: s.notificacionesVersion + 1,
    })),

  emitRutasChanged: () =>
    set((s) => ({
      rutasVersion: s.rutasVersion + 1,
      notasVersion: s.notasVersion + 1,
    })),

  emitUsuariosChanged: () =>
    set((s) => ({
      usuariosVersion: s.usuariosVersion + 1,
      rutasVersion: s.rutasVersion + 1,
      notificacionesVersion: s.notificacionesVersion + 1,
    })),

  emitNotificacionesChanged: () =>
    set((s) => ({
      notificacionesVersion: s.notificacionesVersion + 1,
    })),
}))

