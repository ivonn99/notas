export default function PaginaPrincipalPage() {
  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-2">Página principal</h1>
      <p className="text-body-secondary small mb-3">
        <strong>DMH</strong> — Distribuidora de Medicamentos Homeopáticos · Notas de crédito
      </p>
      <div className="alert alert-info mb-0" role="alert">
        Bienvenido. El estado técnico del sistema y conexión a base de datos ahora está en{' '}
        <strong>Healthz</strong>.
      </div>
    </section>
  )
}
