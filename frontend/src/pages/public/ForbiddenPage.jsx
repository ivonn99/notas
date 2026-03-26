import { Link } from 'react-router-dom'

export default function ForbiddenPage() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="card shadow-sm" style={{ maxWidth: '30rem', width: '100%' }}>
        <div className="card-body">
          <h1 className="h4 mb-2">403 - Sin permiso</h1>
          <p className="text-body-secondary mb-3">
            Tu usuario no tiene acceso a esta sección.
          </p>
          <Link to="/" className="btn btn-primary">
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}
