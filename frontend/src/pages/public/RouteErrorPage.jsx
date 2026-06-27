import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import NotFoundPage from './NotFoundPage.jsx'

export default function RouteErrorPage() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />
  }

  let title = 'Error inesperado'
  let message = 'Ocurrió un problema al cargar esta pantalla. Intenta de nuevo o vuelve al inicio.'
  let code = null

  if (isRouteErrorResponse(error)) {
    code = error.status
    if (error.status === 403) {
      title = 'Sin permiso'
      message = 'No tienes acceso a este recurso.'
    } else if (error.statusText) {
      title = `Error ${error.status}`
      message = error.statusText
    }
  } else if (error instanceof Error && error.message) {
    if (import.meta.env.DEV) {
      message = error.message
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3">
      <div className="card shadow-sm" style={{ maxWidth: '32rem', width: '100%' }}>
        <div className="card-body text-center text-md-start">
          {code ? <p className="text-body-secondary small mb-1">Error {code}</p> : null}
          <h1 className="h4 mb-2">{title}</h1>
          <p className="text-body-secondary mb-4">{message}</p>
          <div className="d-flex flex-wrap gap-2 justify-content-center justify-content-md-start">
            <Link to="/" className="btn btn-primary">
              Volver al inicio
            </Link>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
