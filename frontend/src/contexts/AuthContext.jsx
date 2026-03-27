/* eslint-disable react-refresh/only-export-components */
import { useEffect } from 'react'
import { useAuthStore } from '../stores/authStore.js'

export function AuthProvider({ children }) {
  const ensureInit = useAuthStore((s) => s.ensureInit)

  useEffect(() => {
    void ensureInit()
  }, [ensureInit])

  return children
}

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const reload = useAuthStore((s) => s.reload)
  return { user, loading, login, logout, reload }
}
