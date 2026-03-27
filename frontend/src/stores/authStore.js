import { create } from 'zustand'
import { authLogin, authLogout, authMe } from '../services/authApi.js'

export const useAuthStore = create((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

  reload: async () => {
    set({ loading: true })
    try {
      const u = await authMe()
      set({ user: u || null })
      return u || null
    } catch {
      set({ user: null })
      return null
    } finally {
      set({ loading: false, initialized: true })
    }
  },

  ensureInit: async () => {
    if (get().initialized) return get().user
    return get().reload()
  },

  login: async (username, password) => {
    const u = await authLogin(username, password)
    set({ user: u || null, loading: false, initialized: true })
    return u
  },

  logout: async () => {
    await authLogout()
    set({ user: null })
  },
}))

