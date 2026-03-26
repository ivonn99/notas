import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { authLogin, authLogout, authMe } from '../services/authApi.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const u = await authMe()
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const login = useCallback(async (username, password) => {
    const u = await authLogin(username, password)
    setUser(u)
    return u
  }, [])

  const logout = useCallback(async () => {
    await authLogout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      reload,
    }),
    [user, loading, login, logout, reload],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}
