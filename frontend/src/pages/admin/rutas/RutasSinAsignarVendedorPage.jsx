import { useEffect, useRef, useState } from 'react'
import { adminApi } from '../../../services/adminApi.js'

export default function RutasSinAsignarVendedorPage() {
  const [tab, setTab] = useState('rutas')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [rutasItems, setRutasItems] = useState([])
  const [notasDistribuidora, setNotasDistribuidora] = useState([])
  const [notasRodrigo, setNotasRodrigo] = useState([])
  const [pageDist, setPageDist] = useState(1)
  const [pageRod, setPageRod] = useState(1)
  const [hasMoreDist, setHasMoreDist] = useState(true)
  const [hasMoreRod, setHasMoreRod] = useState(true)
  const sentinelRef = useRef(null)
  const PAGE_SIZE = 100

  useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [rutasR, distR, rodR] = await Promise.all([
          adminApi.listRutasSinAsignarVendedor(),
          adminApi.listNotasSinAsignarVendedor('DISTRIBUIDORA', 1, PAGE_SIZE),
          adminApi.listNotasSinAsignarVendedor('RODRIGO', 1, PAGE_SIZE),
        ])
        if (!cancel) {
          setRutasItems(rutasR.items || [])
          setNotasDistribuidora(distR.items || [])
          setNotasRodrigo(rodR.items || [])
          setPageDist(1)
          setPageRod(1)
          setHasMoreDist(Boolean(distR.hasMore))
          setHasMoreRod(Boolean(rodR.hasMore))
        }
      } catch (e) {
        if (!cancel) setError(e?.message || 'No se pudo cargar información')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const notasActivas = tab === 'notas_distribuidora' ? notasDistribuidora : notasRodrigo

  useEffect(() => {
    if (tab === 'rutas') return undefined
    const el = sentinelRef.current
    if (!el) return undefined
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (!first?.isIntersecting) return
        if (loading || loadingMore) return
        if (tab === 'notas_distribuidora' && !hasMoreDist) return
        if (tab === 'notas_rodrigo' && !hasMoreRod) return

        ;(async () => {
          setLoadingMore(true)
          try {
            if (tab === 'notas_distribuidora') {
              const nextPage = pageDist + 1
              const r = await adminApi.listNotasSinAsignarVendedor(
                'DISTRIBUIDORA',
                nextPage,
                PAGE_SIZE,
              )
              setNotasDistribuidora((prev) => [...prev, ...(r.items || [])])
              setPageDist(nextPage)
              setHasMoreDist(Boolean(r.hasMore))
            } else {
              const nextPage = pageRod + 1
              const r = await adminApi.listNotasSinAsignarVendedor('RODRIGO', nextPage, PAGE_SIZE)
              setNotasRodrigo((prev) => [...prev, ...(r.items || [])])
              setPageRod(nextPage)
              setHasMoreRod(Boolean(r.hasMore))
            }
          } catch (e) {
            setError(e?.message || 'No se pudo cargar más notas')
          } finally {
            setLoadingMore(false)
          }
        })()
      },
      { root: null, rootMargin: '200px 0px', threshold: 0 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [tab, loading, loadingMore, hasMoreDist, hasMoreRod, pageDist, pageRod])

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">Rutas sin asignar a vendedor</h1>
      {error ? <div className="alert alert-warning">{error}</div> : null}
      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${tab === 'rutas' ? ' active' : ''}`}
            onClick={() => setTab('rutas')}
          >
            Rutas sin asignar
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${tab === 'notas_distribuidora' ? ' active' : ''}`}
            onClick={() => setTab('notas_distribuidora')}
          >
            Notas sin asignar Distribuidora
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link${tab === 'notas_rodrigo' ? ' active' : ''}`}
            onClick={() => setTab('notas_rodrigo')}
          >
            Notas sin asignar Rodrigo
          </button>
        </li>
      </ul>
      <div className="card">
        <div className="card-body border-bottom">
          <div className="small text-body-secondary">
            {tab === 'rutas'
              ? 'Se listan rutas que no tienen vendedores activos asignados en la matriz de rutas.'
              : 'Se listan notas sin usuario vendedor asignado para la empresa seleccionada.'}
          </div>
        </div>
        <div className="table-responsive">
          {tab === 'rutas' ? (
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>ID</th>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Descripción</th>
                  <th>Activa</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-4">
                      Cargando...
                    </td>
                  </tr>
                ) : rutasItems.length ? (
                  rutasItems.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.codigo}</td>
                      <td>{r.nombre || '—'}</td>
                      <td>{r.descripcion || '—'}</td>
                      <td>{r.activa ? 'Sí' : 'No'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-4">
                      Sin rutas pendientes de asignación
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="table table-sm table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>ID</th>
                  <th>Serie/Folio</th>
                  <th>Cliente</th>
                  <th>Empresa</th>
                  <th>Ruta</th>
                  <th>Estado</th>
                  <th>Usuario/Vendedor (archivo)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      Cargando...
                    </td>
                  </tr>
                ) : notasActivas.length ? (
                  notasActivas.map((n) => (
                    <tr key={n.id}>
                      <td>{n.id}</td>
                      <td>{n.serie_folio || '—'}</td>
                      <td>{n.cliente || '—'}</td>
                      <td>{n.empresa || '—'}</td>
                      <td>{n.ruta_codigo || '—'}</td>
                      <td>{n.estado || '—'}</td>
                      <td>{n.usuario_vendedor_pv || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      Sin notas pendientes de asignación
                    </td>
                  </tr>
                )}
                {notasActivas.length > 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-2">
                      <div ref={sentinelRef} />
                      {loadingMore ? (
                        <small className="text-body-secondary">Cargando más...</small>
                      ) : tab === 'notas_distribuidora' && hasMoreDist ? (
                        <small className="text-body-secondary">Desliza para cargar más</small>
                      ) : tab === 'notas_rodrigo' && hasMoreRod ? (
                        <small className="text-body-secondary">Desliza para cargar más</small>
                      ) : (
                        <small className="text-body-secondary">Fin de resultados</small>
                      )}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  )
}
