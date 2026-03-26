import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext.jsx'

export default function RequireRole({ roles, children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="d-flex min-vh-100 justify-content-center align-items-center">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando permisos...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const allowed = user.isSuperuser || roles.includes(user.rol)
  if (!allowed) {
    return <Navigate to="/forbidden" replace />
  }

  return children
}
