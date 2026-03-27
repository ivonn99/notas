import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BRAND_IMG_DARK, BRAND_IMG_LIGHT } from '../../constants/brand.js'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { isSupabaseConfigured } from '../../lib/supabaseClient.js'

export default function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from || '/'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [themeDark, setThemeDark] = useState(
    () => document.documentElement.getAttribute('data-theme') === 'dark',
  )

  useEffect(() => {
    const el = document.documentElement
    const sync = () =>
      setThemeDark(el.getAttribute('data-theme') === 'dark')
    sync()
    const obs = new MutationObserver(sync)
    obs.observe(el, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  const loginBrandImg = themeDark ? BRAND_IMG_DARK : BRAND_IMG_LIGHT

  if (loading) {
    return (
      <div className="d-flex min-vh-100 justify-content-center align-items-center">
        <div className="spinner-border text-light" role="status">
          <span className="visually-hidden">Cargando…</span>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSending(true)
    const u = username.trim()
    if (import.meta.env.DEV) {
      console.info(
        isSupabaseConfigured
          ? '[login] Supabase Auth (signInWithPassword)'
          : '[login] API (POST /api/auth/login, cookie JWT)',
        { usuario: u, longitudClave: password.length },
      )
    }
    try {
      await login(u, password)
      if (import.meta.env.DEV) {
        console.info('[login] sesión OK, redirigiendo a', from)
      }
      navigate(from, { replace: true })
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[login] fallo:', err?.message)
      }
      setError(err?.message || 'No se pudo iniciar sesión')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="card shadow-sm" style={{ maxWidth: '24rem', width: '100%' }}>
        <div className="card-body p-4">
          <div className="text-center mb-3">
            <img
              src={loginBrandImg}
              alt="DMH — Distribuidora de Medicamentos Homeopáticos"
              className="img-fluid rounded d-block mx-auto"
              style={{ maxHeight: '11rem', width: 'auto', objectFit: 'contain' }}
              decoding="async"
            />
          </div>
          <h1 className="h4 mb-2 text-center">Iniciar sesión</h1>
          <p className="small text-body-secondary text-center mb-4">
            <strong>DMH</strong> — Distribuidora de Medicamentos Homeopáticos
          </p>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="login-user" className="form-label">
                Usuario o correo
              </label>
              <input
                id="login-user"
                type="text"
                className="form-control"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="login-pass" className="form-label">
                Contraseña
              </label>
              <div className="position-relative">
                <input
                  id="login-pass"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control pe-5"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn btn-link position-absolute top-50 end-0 translate-middle-y py-1 px-2 me-1 border-0 text-body-secondary"
                  style={{ zIndex: 5 }}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                  aria-pressed={showPassword}
                  tabIndex={0}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            {error ? (
              <div className="alert alert-danger py-2 small mb-3" role="alert">
                {error}
              </div>
            ) : null}
            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={sending}
            >
              {sending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
