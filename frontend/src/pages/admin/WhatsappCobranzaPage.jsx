import { useCallback, useMemo, useState } from 'react'
import Swal from 'sweetalert2'

import {
  fetchMensajesPendientes30d,
  fetchWhatsappQr,
  fetchWhatsappStatus,
  postWhatsappConnect,
  postWhatsappDisconnect,
  postWhatsappSendBatch,
  postWhatsappSendTest,
} from '../../services/whatsappApi.js'

const TAB_AUTOMATIZADA = 'automatizada'
const TAB_MANUAL = 'manual'

/** Enlace wa.me si hay teléfono guardado (heurística MX: 10 dígitos → prefijo 52). */
function waMeUrl(telefono) {
  const raw = String(telefono ?? '').replace(/\D/g, '')
  if (!raw) return null
  let n = raw
  if (n.length === 10) n = `52${n}`
  return `https://wa.me/${n}`
}

function criterioTexto(payload, diasMinFallback) {
  if (payload?.diasMax != null) return `${payload.diasMin ?? diasMinFallback} a ${payload.diasMax} días`
  return `>= ${payload?.diasMin ?? diasMinFallback} días`
}

function buildEmpresaSection(titulo, rutas = []) {
  const lines = []
  lines.push(`${titulo}:`)
  if (!rutas.length) {
    lines.push('• Sin notas para este criterio')
    lines.push('')
    return lines
  }
  for (const ruta of rutas) {
    lines.push(`Ruta ${ruta.codigo}:`)
    for (const n of ruta.notas || []) {
      lines.push(
        `• ${n.serieFolio} — ${n.cliente} — Saldo ${n.saldoFmt} — ${n.dias} días (fecha ${n.fechaNota})`,
      )
    }
    lines.push('')
  }
  return lines
}

const MENSAJES_BASE = [
  {
    id: 'recordatorio',
    titulo: 'Recordatorio cordial',
    texto:
      'Hola {vendedor}, te comparto recordatorio de cobranza de la ruta {ruta}. Saldo pendiente estimado: {saldo}. Por favor, priorizar gestión hoy. Gracias.',
  },
  {
    id: 'seguimiento',
    titulo: 'Seguimiento de pendientes',
    texto:
      'Hola {vendedor}, seguimos con notas pendientes en {ruta}. ¿Me apoyas con avance y compromiso de cobro para hoy? Total pendiente: {saldo}.',
  },
  {
    id: 'escalacion',
    titulo: 'Escalación amable',
    texto:
      'Hola {vendedor}, necesitamos reforzar la cobranza de {ruta}. El pendiente actual es {saldo}. Por favor comparte plan y fecha de regularización.',
  },
]

export default function WhatsappCobranzaPage() {
  const [tabActiva, setTabActiva] = useState(TAB_MANUAL)
  const [copiadoId, setCopiadoId] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkEmpresa, setBulkEmpresa] = useState(null)
  const [bulkPayload, setBulkPayload] = useState(null)
  const [bulkConsolidado, setBulkConsolidado] = useState(null)
  const [diasMin, setDiasMin] = useState(30)
  const [diasMax, setDiasMax] = useState('')
  const [waStatus, setWaStatus] = useState(null)
  const [waQr, setWaQr] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [waError, setWaError] = useState('')
  const [waTestPhone, setWaTestPhone] = useState('')
  const [waTestMessage, setWaTestMessage] = useState(
    'Mensaje de prueba DMH: conexión WhatsApp operativa.',
  )
  const [waSendInfo, setWaSendInfo] = useState('')
  const [selectedMap, setSelectedMap] = useState({})
  const [batchSending, setBatchSending] = useState(false)
  const [batchInfo, setBatchInfo] = useState('')

  const usuariosConsolidados = useMemo(() => {
    if (!Array.isArray(bulkConsolidado)) return []
    const [dist, rod] = bulkConsolidado
    const byUser = new Map()

    function pushEmpresa(payload, empresaKey) {
      for (const u of payload?.usuarios || []) {
        const k = `${u.usuarioId}-${u.username}`
        if (!byUser.has(k)) {
          byUser.set(k, {
            usuarioId: u.usuarioId,
            username: u.username,
            nombreCompleto: u.nombreCompleto,
            telefono: u.telefono,
            distRutas: [],
            rodRutas: [],
            diasMin: payload?.diasMin ?? 30,
            diasMax: payload?.diasMax ?? null,
          })
        }
        const entry = byUser.get(k)
        if (!entry.telefono && u.telefono) entry.telefono = u.telefono
        if (empresaKey === 'DISTRIBUIDORA') entry.distRutas = u.rutas || []
        if (empresaKey === 'RODRIGO') entry.rodRutas = u.rutas || []
      }
    }

    pushEmpresa(dist, 'DISTRIBUIDORA')
    pushEmpresa(rod, 'RODRIGO')

    return [...byUser.values()].map((u) => {
      const nombre = String(u.nombreCompleto || u.username || 'colega').trim()
      const primerNombre = nombre.split(/\s+/)[0] || nombre
      const lines = []
      lines.push(`Hola ${primerNombre},`)
      lines.push('')
      lines.push(
        'Te recordamos que puedas acudir a resolver las siguientes notas de crédito por empresa (según fecha nota):',
      )
      lines.push('')
      lines.push(...buildEmpresaSection('Distribuidora', u.distRutas))
      lines.push(...buildEmpresaSection('Rodrigo', u.rodRutas))
      lines.push('Gracias por tu atención.')

      return {
        ...u,
        mensaje: lines.join('\n').trim(),
      }
    })
  }, [bulkConsolidado])

  const usuariosVisibles = useMemo(() => {
    if (Array.isArray(bulkConsolidado)) {
      return usuariosConsolidados.map((u) => ({
        key: `consolidado-${u.usuarioId}`,
        usuarioId: u.usuarioId,
        username: u.username,
        nombre: u.nombreCompleto?.trim() || u.username,
        telefono: u.telefono || '',
        mensaje: u.mensaje || '',
      }))
    }
    if (bulkPayload?.ok) {
      return (bulkPayload.usuarios || []).map((u) => ({
        key: `usr-${u.usuarioId}`,
        usuarioId: u.usuarioId,
        username: u.username,
        nombre: u.nombreCompleto?.trim() || u.username,
        telefono: u.telefono || '',
        mensaje: u.mensaje || '',
      }))
    }
    return []
  }, [bulkConsolidado, usuariosConsolidados, bulkPayload])

  const selectedCount = useMemo(
    () => usuariosVisibles.filter((u) => selectedMap[u.key]).length,
    [usuariosVisibles, selectedMap],
  )

  const cargarMensajesPorEmpresa = useCallback(async (empresa) => {
    setBulkLoading(true)
    setBulkError('')
    setBulkEmpresa(empresa)
    setBulkPayload(null)
    setBulkConsolidado(null)
    setSelectedMap({})
    setBatchInfo('')
    try {
      const diasSanitizado =
        Number.isFinite(Number(diasMin)) && Number(diasMin) >= 1 && Number(diasMin) <= 3650
          ? Number(diasMin)
          : 30
      const diasMaxNum = Number(diasMax)
      const diasMaxSanitizado =
        diasMax === ''
          ? null
          : Number.isFinite(diasMaxNum) && diasMaxNum >= diasSanitizado && diasMaxNum <= 3650
            ? diasMaxNum
            : null
      const data = await fetchMensajesPendientes30d(empresa, diasSanitizado, diasMaxSanitizado)
      setBulkPayload(data)
    } catch (e) {
      setBulkError(e?.message || 'No se pudo cargar los mensajes')
      setBulkEmpresa(null)
    } finally {
      setBulkLoading(false)
    }
  }, [diasMin, diasMax])

  const cargarMensajesConsolidados = useCallback(async () => {
    setBulkLoading(true)
    setBulkError('')
    setBulkEmpresa('CONSOLIDADO')
    setBulkPayload(null)
    setBulkConsolidado(null)
    setSelectedMap({})
    setBatchInfo('')
    try {
      const diasSanitizado =
        Number.isFinite(Number(diasMin)) && Number(diasMin) >= 1 && Number(diasMin) <= 3650
          ? Number(diasMin)
          : 30
      const diasMaxNum = Number(diasMax)
      const diasMaxSanitizado =
        diasMax === ''
          ? null
          : Number.isFinite(diasMaxNum) && diasMaxNum >= diasSanitizado && diasMaxNum <= 3650
            ? diasMaxNum
            : null
      const [dist, rod] = await Promise.all([
        fetchMensajesPendientes30d('DISTRIBUIDORA', diasSanitizado, diasMaxSanitizado),
        fetchMensajesPendientes30d('RODRIGO', diasSanitizado, diasMaxSanitizado),
      ])
      setBulkConsolidado([dist, rod])
    } catch (e) {
      setBulkError(e?.message || 'No se pudo cargar los mensajes consolidados')
      setBulkEmpresa(null)
    } finally {
      setBulkLoading(false)
    }
  }, [diasMin, diasMax])

  async function copyText(id, text) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiadoId(id)
      setTimeout(() => setCopiadoId(''), 1500)
    } catch {
      setCopiadoId('')
    }
  }

  function toggleSelectAll(checked) {
    if (!checked) {
      setSelectedMap({})
      return
    }
    const next = {}
    for (const u of usuariosVisibles) {
      if (u.telefono && u.mensaje) next[u.key] = true
    }
    setSelectedMap(next)
  }

  async function enviarSeleccionados() {
    const selected = usuariosVisibles.filter((u) => selectedMap[u.key] && u.telefono && u.mensaje)
    if (!selected.length) {
      setBatchInfo('Selecciona al menos un usuario con teléfono y mensaje.')
      return
    }
    const total = selected.length
    const segundosEstimados = Math.max(0, (total - 1) * 5)
    const conf = await Swal.fire({
      title: 'Confirmar envío por lote',
      html: `<p>Se enviarán <strong>${total}</strong> mensajes.</p>
             <p class="mb-0 small text-body-secondary">Pausa entre mensajes: 5 segundos. Tiempo estimado: ~${segundosEstimados}s.</p>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, enviar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    })
    if (!conf.isConfirmed) return

    setBatchSending(true)
    setBatchInfo('')
    try {
      const payload = {
        delay_seconds: 5,
        items: selected.map((u) => ({
          usuarioId: u.usuarioId,
          username: u.username,
          phone: u.telefono,
          message: u.mensaje,
        })),
      }
      const r = await postWhatsappSendBatch(payload)
      setBatchInfo(
        `Lote terminado. Enviados: ${r?.enviados ?? 0}, fallidos: ${r?.fallidos ?? 0}, total: ${r?.total ?? selected.length}.`,
      )
    } catch (e) {
      setBatchInfo(e?.message || 'No se pudo enviar el lote')
    } finally {
      setBatchSending(false)
    }
  }

  const cargarEstadoWhatsapp = useCallback(async () => {
    setWaLoading(true)
    setWaError('')
    try {
      const s = await fetchWhatsappStatus()
      setWaStatus(s?.status || null)
      if (['qr', 'connecting', 'disconnected'].includes(String(s?.status?.status || ''))) {
        try {
          const qr = await fetchWhatsappQr()
          setWaQr(qr?.qrDataUrl || '')
        } catch {
          setWaQr('')
        }
      } else {
        setWaQr('')
      }
    } catch (e) {
      setWaError(e?.message || 'No se pudo consultar estado de WhatsApp')
    } finally {
      setWaLoading(false)
    }
  }, [])

  const conectarWhatsapp = useCallback(async () => {
    setWaLoading(true)
    setWaError('')
    setWaSendInfo('')
    try {
      await postWhatsappConnect()
      await cargarEstadoWhatsapp()
    } catch (e) {
      setWaError(e?.message || 'No se pudo iniciar conexión de WhatsApp')
      setWaLoading(false)
    }
  }, [cargarEstadoWhatsapp])

  const desconectarWhatsapp = useCallback(async () => {
    const conf = await Swal.fire({
      title: 'Desconectar WhatsApp',
      text: 'Se cerrará la sesión actual de WhatsApp Web.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, desconectar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    })
    if (!conf.isConfirmed) return
    setWaLoading(true)
    setWaError('')
    setWaSendInfo('')
    try {
      await postWhatsappDisconnect({ clearSession: false })
      setWaStatus((prev) => ({
        ...(prev || {}),
        status: 'disconnected',
        isConnected: false,
        me: null,
      }))
      setWaQr('')
      setWaSendInfo('WhatsApp desconectado correctamente.')
    } catch (e) {
      setWaError(e?.message || 'No se pudo desconectar WhatsApp')
    } finally {
      setWaLoading(false)
    }
  }, [])

  const desconectarYBorrarSesionWhatsapp = useCallback(async () => {
    const conf = await Swal.fire({
      title: 'Desconectar y borrar sesión',
      html: '<p>Se cerrará la sesión actual y se eliminarán credenciales locales.</p><p class="mb-0 small text-body-secondary">La próxima conexión pedirá QR nuevo obligatoriamente.</p>',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar sesión',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
      confirmButtonColor: '#dc3545',
    })
    if (!conf.isConfirmed) return
    setWaLoading(true)
    setWaError('')
    setWaSendInfo('')
    try {
      await postWhatsappDisconnect({ clearSession: true })
      setWaStatus((prev) => ({
        ...(prev || {}),
        status: 'disconnected',
        isConnected: false,
        me: null,
      }))
      setWaQr('')
      setWaSendInfo('WhatsApp desconectado y sesión borrada. Conecta de nuevo para generar QR.')
    } catch (e) {
      setWaError(e?.message || 'No se pudo desconectar y borrar la sesión')
    } finally {
      setWaLoading(false)
    }
  }, [])

  const enviarPruebaWhatsapp = useCallback(async () => {
    setWaLoading(true)
    setWaError('')
    setWaSendInfo('')
    try {
      const payload = {}
      if (String(waTestPhone || '').trim()) payload.phone = String(waTestPhone).trim()
      if (String(waTestMessage || '').trim()) payload.message = String(waTestMessage).trim()
      const r = await postWhatsappSendTest(payload)
      setWaSendInfo(`Enviado a ${r?.to || 'destino'} correctamente.`)
    } catch (e) {
      setWaError(e?.message || 'No se pudo enviar mensaje de prueba')
    } finally {
      setWaLoading(false)
    }
  }, [waTestPhone, waTestMessage])

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-3">WhatsApp cobranza</h1>

      <div className="card mb-3">
        <div className="card-body">
          <p className="mb-2">
            Esta sección está preparada para integrar envío de mensajes de cobranza a vendedores.
          </p>
          <p className="text-body-secondary mb-0 small">
            Acceso solo ADMIN. Aquí puedes centralizar conexión, plantillas y monitoreo.
          </p>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tabActiva === TAB_AUTOMATIZADA ? 'active' : ''}`}
            onClick={() => setTabActiva(TAB_AUTOMATIZADA)}
          >
            Automatizada
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tabActiva === TAB_MANUAL ? 'active' : ''}`}
            onClick={() => setTabActiva(TAB_MANUAL)}
          >
            Mensajes manuales
          </button>
        </li>
      </ul>

      {tabActiva === TAB_AUTOMATIZADA ? (
        <>
          <div className="card mb-3">
            <div className="card-header">Estado de conexión Baileys</div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className="btn btn-primary" disabled={waLoading} onClick={conectarWhatsapp}>
                  Conectar WhatsApp
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={waLoading}
                  onClick={desconectarWhatsapp}
                >
                  Desconectar WhatsApp
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={waLoading}
                  onClick={desconectarYBorrarSesionWhatsapp}
                >
                  Desconectar y borrar sesión
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  disabled={waLoading}
                  onClick={cargarEstadoWhatsapp}
                >
                  Refrescar estado
                </button>
              </div>
              {waError ? <div className="alert alert-danger py-2">{waError}</div> : null}
              {waSendInfo ? <div className="alert alert-success py-2">{waSendInfo}</div> : null}
              <div className="small text-body-secondary">
                Estado actual:{' '}
                <strong>{waStatus?.status || 'sin consultar'}</strong>
                {waStatus?.isConnected ? ' (conectado)' : ''}
              </div>
              {waStatus?.me?.id ? (
                <div className="small text-body-secondary">Cuenta: {waStatus.me.id}</div>
              ) : null}
              {waQr ? (
                <div className="mt-3">
                  <div className="small text-body-secondary mb-2">Escanea este QR en WhatsApp Web:</div>
                  <img
                    src={waQr}
                    alt="QR de conexión WhatsApp"
                    style={{ width: 260, height: 260, border: '1px solid #d5d5d5', borderRadius: 8 }}
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Envío de prueba</div>
            <div className="card-body">
              <div className="row g-2">
                <div className="col-12 col-md-4">
                  <label className="form-label mb-1">Teléfono (opcional)</label>
                  <input
                    className="form-control"
                    placeholder="Ejemplo: 5215512345678"
                    value={waTestPhone}
                    onChange={(e) => setWaTestPhone(e.target.value)}
                  />
                  <div className="form-text">
                    Si lo dejas vacío, usa <code>WHATSAPP_TEST_PHONE</code> del backend.
                  </div>
                </div>
                <div className="col-12 col-md-8">
                  <label className="form-label mb-1">Mensaje de prueba</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={waTestMessage}
                    onChange={(e) => setWaTestMessage(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-3">
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={waLoading}
                  onClick={enviarPruebaWhatsapp}
                >
                  Enviar mensaje de prueba
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card mb-3">
            <div className="card-header">
              Mensajes por usuario (notas pendientes por antigüedad configurable)
            </div>
            <div className="card-body">
              <p className="text-body-secondary small mb-3">
                Se toman las notas <strong>PENDIENTE</strong> de la empresa elegida, con antigüedad{' '}
                <strong>en un rango de días</strong> según <strong>fecha nota</strong> (igual que en
                Reportes).
                Cada usuario enlazado a la ruta de la nota (tabla <code>usuario_rutas</code>) recibe un
                mensaje. Si tiene varias rutas con notas en esas condiciones, el texto incluye un
                bloque por cada ruta y el listado de notas correspondiente.
              </p>
              <div className="row g-2 align-items-end mb-3">
                <div className="col-12 col-md-4 col-lg-3">
                  <label className="form-label mb-1">Días mínimos</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    step={1}
                    className="form-control"
                    value={diasMin}
                    onChange={(e) => setDiasMin(e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-4 col-lg-3">
                  <label className="form-label mb-1">Días máximos (opcional)</label>
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    step={1}
                    className="form-control"
                    value={diasMax}
                    onChange={(e) => setDiasMax(e.target.value)}
                    placeholder="Ejemplo: 60"
                  />
                </div>
              </div>
              <div className="d-flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={bulkLoading}
                  onClick={() => cargarMensajesPorEmpresa('DISTRIBUIDORA')}
                >
                  {bulkLoading && bulkEmpresa === 'DISTRIBUIDORA'
                    ? 'Generando…'
                    : 'Generar mensajes — Distribuidora'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  disabled={bulkLoading}
                  onClick={() => cargarMensajesPorEmpresa('RODRIGO')}
                >
                  {bulkLoading && bulkEmpresa === 'RODRIGO'
                    ? 'Generando…'
                    : 'Generar mensajes — Rodrigo'}
                </button>
              </div>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className="btn btn-success"
                  disabled={bulkLoading}
                  onClick={cargarMensajesConsolidados}
                >
                  {bulkLoading && bulkEmpresa === 'CONSOLIDADO'
                    ? 'Generando…'
                    : 'Generar mensajes consolidados (Distribuidora + Rodrigo)'}
                </button>
              </div>
              {bulkError ? (
                <div className="alert alert-danger py-2 mb-0" role="alert">
                  {bulkError}
                </div>
              ) : null}
              {usuariosVisibles.length > 0 ? (
                <div className="card border mb-3">
                  <div className="card-body py-2">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <div className="form-check m-0">
                        <input
                          id="check-all-whatsapp"
                          className="form-check-input"
                          type="checkbox"
                          checked={selectedCount > 0 && selectedCount === usuariosVisibles.filter((u) => u.telefono && u.mensaje).length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                        <label htmlFor="check-all-whatsapp" className="form-check-label small">
                          Seleccionar todos
                        </label>
                      </div>
                      <span className="small text-body-secondary">
                        Seleccionados: <strong>{selectedCount}</strong>
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        disabled={batchSending || selectedCount === 0}
                        onClick={enviarSeleccionados}
                      >
                        {batchSending
                          ? 'Enviando lote (5s por mensaje)...'
                          : 'Enviar seleccionados por WhatsApp'}
                      </button>
                    </div>
                    {batchInfo ? (
                      <div className="small text-body-secondary mt-2">{batchInfo}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {bulkPayload?.ok ? (
                <div className="mt-3">
                  <p className="small text-body-secondary mb-2">
                    Empresa: <strong>{bulkPayload.empresa}</strong> — {bulkPayload.totalUsuarios}{' '}
                    usuario(s), {bulkPayload.totalNotas} nota(s) en los mensajes. Criterio:{' '}
                    <strong>
                      {bulkPayload.diasMax != null
                        ? `${bulkPayload.diasMin ?? diasMin} a ${bulkPayload.diasMax} días`
                        : `>= ${bulkPayload.diasMin ?? diasMin} días`}
                    </strong>
                    .
                  </p>
                  {bulkPayload.totalUsuarios === 0 ? (
                    <p className="text-body-secondary small mb-0">
                      No hay notas que cumplan el criterio para esta empresa.
                    </p>
                  ) : (
                    <div className="d-grid gap-3">
                      {bulkPayload.usuarios.map((u) => {
                        const copyId = `usr-${u.usuarioId}`
                        const wa = waMeUrl(u.telefono)
                        return (
                          <div key={u.usuarioId} className="border rounded p-3">
                            <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                              <div>
                                <div className="form-check mb-1">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`sel-${copyId}`}
                                    checked={Boolean(selectedMap[copyId])}
                                    onChange={(e) =>
                                      setSelectedMap((prev) => ({
                                        ...prev,
                                        [copyId]: e.target.checked,
                                      }))
                                    }
                                  />
                                  <label className="form-check-label small" htmlFor={`sel-${copyId}`}>
                                    Seleccionar para envío automatizado
                                  </label>
                                </div>
                                <div className="fw-semibold">
                                  {u.nombreCompleto?.trim() || u.username}
                                </div>
                                <div className="small text-body-secondary">
                                  Usuario: @{u.username}
                                </div>
                                <div className="small text-body-secondary">
                                  Teléfono: {u.telefono || '—'}
                                </div>
                              </div>
                              <div className="d-flex flex-wrap gap-2">
                                {wa ? (
                                  <a
                                    className="btn btn-sm btn-success"
                                    href={wa}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Abrir WhatsApp
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => copyText(copyId, u.mensaje)}
                                >
                                  {copiadoId === copyId ? 'Copiado' : 'Copiar mensaje'}
                                </button>
                              </div>
                            </div>
                            <pre className="small mb-0 text-body-secondary bg-body-tertiary border rounded p-2 overflow-auto">
                              {u.mensaje}
                            </pre>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : null}
              {Array.isArray(bulkConsolidado) ? (
                <div className="mt-3 d-grid gap-4">
                  <div>
                    <p className="small text-body-secondary mb-2">
                      Consolidado de empresas (orden: <strong>Distribuidora</strong> y luego{' '}
                      <strong>Rodrigo</strong>). Criterio:{' '}
                      <strong>{criterioTexto(bulkConsolidado[0], diasMin)}</strong>.
                    </p>
                    {usuariosConsolidados.length === 0 ? (
                      <p className="text-body-secondary small mb-0">
                        No hay notas que cumplan el criterio para ambas empresas.
                      </p>
                    ) : (
                      <div className="d-grid gap-3">
                        {usuariosConsolidados.map((u) => {
                          const copyId = `consolidado-${u.usuarioId}`
                          const wa = waMeUrl(u.telefono)
                          return (
                            <div key={copyId} className="border rounded p-3">
                              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                                <div>
                                  <div className="form-check mb-1">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`sel-${copyId}`}
                                      checked={Boolean(selectedMap[copyId])}
                                      onChange={(e) =>
                                        setSelectedMap((prev) => ({
                                          ...prev,
                                          [copyId]: e.target.checked,
                                        }))
                                      }
                                    />
                                    <label className="form-check-label small" htmlFor={`sel-${copyId}`}>
                                      Seleccionar para envío automatizado
                                    </label>
                                  </div>
                                  <div className="fw-semibold">
                                    {u.nombreCompleto?.trim() || u.username}
                                  </div>
                                  <div className="small text-body-secondary">
                                    Usuario: @{u.username}
                                  </div>
                                  <div className="small text-body-secondary">
                                    Teléfono: {u.telefono || '—'}
                                  </div>
                                </div>
                                <div className="d-flex flex-wrap gap-2">
                                  {wa ? (
                                    <a
                                      className="btn btn-sm btn-success"
                                      href={wa}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Abrir WhatsApp
                                    </a>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => copyText(copyId, u.mensaje)}
                                  >
                                    {copiadoId === copyId ? 'Copiado' : 'Copiar mensaje'}
                                  </button>
                                </div>
                              </div>
                              <pre className="small mb-0 text-body-secondary bg-body-tertiary border rounded p-2 overflow-auto">
                                {u.mensaje}
                              </pre>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="card-header">Plantillas rápidas (copiar y pegar)</div>
            <div className="card-body">
              <p className="text-body-secondary small">
                Variables sugeridas: {'{vendedor}'}, {'{ruta}'}, {'{saldo}'}.
              </p>
              <div className="d-grid gap-3">
                {MENSAJES_BASE.map((m) => (
                  <div key={m.id} className="border rounded p-3">
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div className="fw-semibold">{m.titulo}</div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => copyText(m.id, m.texto)}
                      >
                        {copiadoId === m.id ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <div className="small">{m.texto}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}
