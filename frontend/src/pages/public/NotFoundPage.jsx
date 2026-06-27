import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="card shadow-sm" style={{ maxWidth: '30rem', width: '100%' }}>
        <div className="card-body text-center text-md-start">
          <p className="text-body-secondary small mb-1">Error 404</p>
          <h1 className="h4 mb-2">Página no encontrada</h1>
          <p className="text-body-secondary mb-4">
            La ruta que buscas no existe, fue movida o no tienes el enlace correcto.
          </p>
          <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-md-start">
            <Link to="/" className="btn btn-primary">
              Volver al inicio
            </Link>
            <button type="button" className="btn btn-outline-secondary" onClick={() => window.history.back()}>
              Regresar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
