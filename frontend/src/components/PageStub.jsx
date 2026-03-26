/**
 * Contenedor mínimo para páginas del esqueleto (Bootstrap utilities).
 */
export default function PageStub({ titulo, nota }) {
  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-2">{titulo}</h1>
      {nota ? (
        <div className="row">
          <div className="col-lg-8">
            <p className="text-body-secondary mb-0">{nota}</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
