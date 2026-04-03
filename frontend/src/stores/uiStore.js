import { create } from 'zustand'

const THEME_KEY = 'nc_theme'
const SIDEBAR_COLLAPSED_KEY = 'nc_sidebar_collapsed'

function applyTheme(theme) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.setAttribute('data-bs-theme', theme)
}

export const useUiStore = create((set) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  theme: 'dark',
  initialized: false,

  initialize: () =>
    set((state) => {
      if (state.initialized || typeof window === 'undefined') {
        return state
      }
      const savedTheme = localStorage.getItem(THEME_KEY)
      const savedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
      const theme = savedTheme === 'light' ? 'light' : 'dark'
      const sidebarCollapsed = savedCollapsed === '1'
      applyTheme(theme)
      return { ...state, theme, sidebarCollapsed, initialized: true }
    }),

  setSidebarOpen: (value) => set({ sidebarOpen: Boolean(value) }),

  setSidebarCollapsed: (value) => {
    const next = Boolean(value)
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
    }
    set({ sidebarCollapsed: next })
  },

  toggleTheme: () =>
    set((state) => {
      const next = state.theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      if (typeof window !== 'undefined') {
        localStorage.setItem(THEME_KEY, next)
      }
      return { theme: next }
    }),
}))

