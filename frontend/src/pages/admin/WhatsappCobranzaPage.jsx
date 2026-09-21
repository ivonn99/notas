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

const TAB_CONEXION = 'conexion'
const TAB_MENSAJES = 'mensajes'

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

/** Texto multilínea con resumen del API /send-batch (incluye motivo de cada fallo). */
function textoResumenLoteWhatsapp(r, totalEsperado) {
  const enviados = r?.enviados ?? 0
  const fallidos = r?.fallidos ?? 0
  const total = r?.total ?? totalEsperado
  const lines = [
    `Lote terminado. Enviados: ${enviados}, fallidos: ${fallidos}, total: ${total}.`,
  ]
  const results = Array.isArray(r?.results) ? r.results : []
  const failures = results.filter((x) => x && x.ok === false)
  if (failures.length) {
    lines.push('')
    lines.push('Detalle de fallos:')
    for (const f of failures) {
      const idx = Number(f.index)
      const who =
        f.username != null && String(f.username).trim()
          ? `@${String(f.username).trim()}`
          : f.usuarioId != null
            ? `Usuario #${f.usuarioId}`
            : `Mensaje #${Number.isFinite(idx) ? idx + 1 : '?'}`
      const dest = f.to != null && String(f.to).trim() ? ` → ${String(f.to).trim()}` : ''
      const err = f.error != null && String(f.error).trim() ? String(f.error).trim() : 'Error desconocido'
      lines.push(`• ${who}${dest}: ${err}`)
    }
  }
  return lines.join('\n')
}

function primerNombreDe(nombreCompleto, username) {
  const nombre = String(nombreCompleto || username || 'colega').trim()
  return nombre.split(/\s+/)[0] || nombre
}

function rangoAntiguedadTexto(diasMin, diasMax) {
  const min = Number.isFinite(Number(diasMin)) ? Number(diasMin) : 30
  if (Number.isFinite(Number(diasMax)) && Number(diasMax) > 0) {
    return `mayores a ${min} días y hasta ${Number(diasMax)} días`
  }
  return `mayores a ${min} días`
}

/** “más de X días, pero menos de Y” (si no hay máximo, solo “más de X días”). */
function rangoMasDeMenosDe(diasMin, diasMax) {
  const min = Number.isFinite(Number(diasMin)) ? Number(diasMin) : 30
  if (Number.isFinite(Number(diasMax)) && Number(diasMax) > 0) {
    return `más de ${min} días, pero menos de ${Number(diasMax)} días`
  }
  return `más de ${min} días`
}

function buildPlantillaVars({ nombre, empresa, diasMin, diasMax }) {
  const min = Number.isFinite(Number(diasMin)) ? Number(diasMin) : 30
  const maxOk = Number.isFinite(Number(diasMax)) && Number(diasMax) > 0
  return {
    nombre: nombre || 'colega',
    empresa: empresa || '',
    diasMin: String(min),
    diasMax: maxOk ? String(Number(diasMax)) : '',
    rango: rangoAntiguedadTexto(diasMin, diasMax),
    rangoMasMenos: rangoMasDeMenosDe(diasMin, diasMax),
  }
}

function applyApertura(texto, vars = {}) {
  let out = String(texto ?? '')
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, value ?? '')
  }
  return out
}

function buildRutasLines(rutas = []) {
  const lines = []
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

function buildEmpresaSection(titulo, rutas = []) {
  const lines = []
  lines.push(`${titulo}:`)
  lines.push(...buildRutasLines(rutas))
  return lines
}

/** Plantillas de apertura (después del saludo). El listado de notas se agrega después. */
const PLANTILLAS_INICIO = [
  {
    id: 'recordatorio',
    titulo: 'Recordatorio cordial',
    textoEmpresa:
      'Te recordamos que puedas acudir a resolver las siguientes notas de crédito de {empresa} con antigüedad {rango} (según fecha nota):',
    textoConsolidado:
      'Te recordamos que puedas acudir a resolver las siguientes notas de crédito por empresa con antigüedad {rango} (según fecha nota):',
  },
  {
    id: 'seguimiento',
    titulo: 'Seguimiento de pendientes',
    textoEmpresa:
      'Seguimos con notas pendientes de {empresa} con antigüedad {rango}. ¿Me apoyas con avance y compromiso de cobro? Detalle:',
    textoConsolidado:
      'Seguimos con notas pendientes por empresa con antigüedad {rango}. ¿Me apoyas con avance y compromiso de cobro? Detalle:',
  },
  {
    id: 'escalacion',
    titulo: 'Escalación amable',
    textoEmpresa:
      'Necesitamos reforzar la cobranza de {empresa} con antigüedad {rango}. Por favor revisa el detalle y comparte plan de regularización:',
    textoConsolidado:
      'Necesitamos reforzar la cobranza por empresa con antigüedad {rango}. Por favor revisa el detalle y comparte plan de regularización:',
  },
  {
    id: 'conciliacion-1',
    titulo: 'Conciliación 1',
    textoEmpresa:
      'Te escribimos con gusto para dar seguimiento al proceso de conciliación. Te compartimos estas notas de {empresa} que presentan {rangoMasMenos}:',
    textoConsolidado:
      'Te escribimos con gusto para dar seguimiento al proceso de conciliación. Te compartimos estas notas por empresa que presentan {rangoMasMenos}:',
    cierre:
      'Si esta situación continúa, lamentablemente tendríamos que descontarlas de comisiones. Te pedimos de favor nos apoyes a la brevedad; quedamos atentos para ayudarte.',
  },
  {
    id: 'conciliacion-2',
    titulo: 'Conciliación 2',
    saludo: 'Hola, compañer@ vendedor,',
    textoEmpresa:
      'Nos preocupa informarte que tenemos estas notas de {empresa} mayores de {diasMin} días:',
    textoConsolidado:
      'Nos preocupa informarte que tenemos estas notas por empresa mayores de {diasMin} días:',
    cierre:
      'Como aún no hemos recibido aclaración o la aclaración ha sido insuficiente, en el siguiente corte de comisiones se verá reflejado un descuento equivalente al importe de estas notas. Te pedimos que te acerques antes del día de corte para revisarlas juntos. Gracias.',
  },
]

function armarMensajeEmpresa({ plantilla, nombre, empresaEtiqueta, rutas, diasMin, diasMax }) {
  const vars = buildPlantillaVars({
    nombre,
    empresa: empresaEtiqueta,
    diasMin,
    diasMax,
  })
  const lines = []
  lines.push(applyApertura(plantilla.saludo || 'Hola {nombre},', vars))
  lines.push('')
  lines.push(applyApertura(plantilla.textoEmpresa, vars))
  lines.push('')
  lines.push(...buildRutasLines(rutas))
  lines.push(applyApertura(plantilla.cierre || 'Gracias por tu atención.', vars))
  return lines.join('\n').trim()
}

function armarMensajeConsolidado({ plantilla, nombre, distRutas, rodRutas, diasMin, diasMax }) {
  const vars = buildPlantillaVars({ nombre, diasMin, diasMax })
  const lines = []
  lines.push(applyApertura(plantilla.saludo || 'Hola {nombre},', vars))
  lines.push('')
  lines.push(applyApertura(plantilla.textoConsolidado, vars))
  lines.push('')
  lines.push(...buildEmpresaSection('Distribuidora', distRutas))
  lines.push(...buildEmpresaSection('Rodrigo', rodRutas))
  lines.push(applyApertura(plantilla.cierre || 'Gracias por tu atención.', vars))
  return lines.join('\n').trim()
}

export default function WhatsappCobranzaPage() {
  const [tabActiva, setTabActiva] = useState(TAB_MENSAJES)
  const [copiadoId, setCopiadoId] = useState('')
  const [plantillaId, setPlantillaId] = useState(PLANTILLAS_INICIO[0].id)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkEmpresa, setBulkEmpresa] = useState(null)
  const [bulkPayload, setBulkPayload] = useState(null)
  const [bulkConsolidado, setBulkConsolidado] = useState(null)
  const [diasMin, setDiasMin] = useState(30)
  const [diasMax, setDiasMax] = useState('')
  const [waStatus, setWaStatus] = useState(null)
  const [waQr, setWaQr] = useState('')
  const [waStatusLoading, setWaStatusLoading] = useState(false)
  const [waActionLoading, setWaActionLoading] = useState(false)
  const [waError, setWaError] = useState('')
  const [waTestPhone, setWaTestPhone] = useState('')
  const [waTestMessage, setWaTestMessage] = useState(
    'Mensaje de prueba DMH: conexión WhatsApp operativa.',
  )
  const [waSendInfo, setWaSendInfo] = useState('')
  const [selectedMap, setSelectedMap] = useState({})
  const [batchSending, setBatchSending] = useState(false)
  const [batchInfo, setBatchInfo] = useState('')

  const plantillaActiva = useMemo(
    () => PLANTILLAS_INICIO.find((p) => p.id === plantillaId) || PLANTILLAS_INICIO[0],
    [plantillaId],
  )

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
      const primerNombre = primerNombreDe(u.nombreCompleto, u.username)
      return {
        ...u,
        mensaje: armarMensajeConsolidado({
          plantilla: plantillaActiva,
          nombre: primerNombre,
          distRutas: u.distRutas,
          rodRutas: u.rodRutas,
          diasMin: u.diasMin,
          diasMax: u.diasMax,
        }),
      }
    })
  }, [bulkConsolidado, plantillaActiva])

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
      const empresaEtiqueta =
        bulkPayload.empresa === 'RODRIGO' ? 'Rodrigo' : 'Distribuidora'
      const diasMinPayload = bulkPayload.diasMin ?? 30
      const diasMaxPayload = bulkPayload.diasMax ?? null
      return (bulkPayload.usuarios || []).map((u) => ({
        key: `usr-${u.usuarioId}`,
        usuarioId: u.usuarioId,
        username: u.username,
        nombre: u.nombreCompleto?.trim() || u.username,
        telefono: u.telefono || '',
        mensaje: armarMensajeEmpresa({
          plantilla: plantillaActiva,
          nombre: primerNombreDe(u.nombreCompleto, u.username),
          empresaEtiqueta,
          rutas: u.rutas || [],
          diasMin: diasMinPayload,
          diasMax: diasMaxPayload,
        }),
      }))
    }
    return []
  }, [bulkConsolidado, usuariosConsolidados, bulkPayload, plantillaActiva])

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
      setBatchInfo(textoResumenLoteWhatsapp(r, selected.length))
    } catch (e) {
      setBatchInfo(e?.message || 'No se pudo enviar el lote')
    } finally {
      setBatchSending(false)
    }
  }

  const cargarEstadoWhatsapp = useCallback(async () => {
    setWaStatusLoading(true)
    setWaError('')
    try {
      const s = await fetchWhatsappStatus()
      setWaStatus(s?.status || null)
      if (s?.status?.isConnected) {
        setWaQr('')
      } else if (
        ['qr', 'connecting', 'disconnected'].includes(String(s?.status?.status || ''))
      ) {
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
      setWaStatusLoading(false)
    }
  }, [])

  const conectarWhatsapp = useCallback(async () => {
    setWaActionLoading(true)
    setWaError('')
    setWaSendInfo('')
    try {
      await postWhatsappConnect()
      setWaSendInfo('Solicitud de conexión enviada. Usa "Refrescar estado" para consultar avance.')
    } catch (e) {
      setWaError(e?.message || 'No se pudo iniciar conexión de WhatsApp')
    } finally {
      setWaActionLoading(false)
    }
  }, [])

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
    setWaActionLoading(true)
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
      setWaActionLoading(false)
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
    setWaActionLoading(true)
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
      setWaActionLoading(false)
    }
  }, [])

  const enviarPruebaWhatsapp = useCallback(async () => {
    setWaActionLoading(true)
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
      setWaActionLoading(false)
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
            Acceso ADMIN o CREDITO. Aquí puedes centralizar conexión, plantillas y monitoreo.
          </p>
        </div>
      </div>

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tabActiva === TAB_CONEXION ? 'active' : ''}`}
            onClick={() => setTabActiva(TAB_CONEXION)}
          >
            Conexión
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${tabActiva === TAB_MENSAJES ? 'active' : ''}`}
            onClick={() => setTabActiva(TAB_MENSAJES)}
          >
            Mensajes de cobranza
          </button>
        </li>
      </ul>

      {tabActiva === TAB_CONEXION ? (
        <>
          <div className="card mb-3">
            <div className="card-header">Estado de conexión Baileys</div>
            <div className="card-body">
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className="btn btn-primary" onClick={conectarWhatsapp}>
                  {waActionLoading ? 'Procesando...' : 'Conectar WhatsApp'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={desconectarWhatsapp}
                >
                  {waActionLoading ? 'Procesando...' : 'Desconectar WhatsApp'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={desconectarYBorrarSesionWhatsapp}
                >
                  {waActionLoading ? 'Procesando...' : 'Desconectar y borrar sesión'}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={cargarEstadoWhatsapp}
                >
                  {waStatusLoading ? 'Consultando...' : 'Refrescar estado'}
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
                  onClick={enviarPruebaWhatsapp}
                >
                  {waActionLoading ? 'Procesando...' : 'Enviar mensaje de prueba'}
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
              <div className="mb-3">
                <div className="form-label mb-2">Plantilla de inicio del mensaje</div>
                <p className="text-body-secondary small mb-2">
                  Elige el tono del mensaje. El listado de notas se agrega automáticamente. Si ya
                  generaste mensajes, al cambiar la plantilla se actualizan al instante. En
                  Conciliación 1 conviene llenar también días máximos.
                </p>
                <div className="d-grid gap-2">
                  {PLANTILLAS_INICIO.map((p) => {
                    const activa = p.id === plantillaActiva.id
                    const previewVars = buildPlantillaVars({
                      nombre: 'Juan',
                      empresa: 'Distribuidora',
                      diasMin: Number.isFinite(Number(diasMin)) ? Number(diasMin) : 30,
                      diasMax: diasMax === '' ? null : Number(diasMax),
                    })
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`text-start border rounded p-3 bg-body ${
                          activa ? 'border-primary' : ''
                        }`}
                        style={{
                          cursor: 'pointer',
                          boxShadow: activa ? 'inset 0 0 0 1px var(--bs-primary)' : undefined,
                        }}
                        onClick={() => setPlantillaId(p.id)}
                        aria-pressed={activa}
                      >
                        <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
                          <div className="fw-semibold">{p.titulo}</div>
                          {activa ? (
                            <span className="badge text-bg-primary">Activa</span>
                          ) : null}
                        </div>
                        <div className="small text-body-secondary">
                          {applyApertura(p.saludo || 'Hola {nombre},', previewVars)}{' '}
                          {applyApertura(p.textoEmpresa, previewVars)}
                          {p.cierre ? (
                            <>
                              {' '}
                              […] {applyApertura(p.cierre, previewVars)}
                            </>
                          ) : null}
                        </div>
                      </button>
                    )
                  })}
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
                      <div
                        className="small text-body-secondary mt-2 text-break"
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {batchInfo}
                      </div>
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
                    . Plantilla: <strong>{plantillaActiva.titulo}</strong>.
                  </p>
                  {usuariosVisibles.length === 0 ? (
                    <p className="text-body-secondary small mb-0">
                      No hay notas que cumplan el criterio para esta empresa.
                    </p>
                  ) : (
                    <div className="d-grid gap-3">
                      {usuariosVisibles.map((u) => {
                        const copyId = u.key
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
                                    Seleccionar para envío
                                  </label>
                                </div>
                                <div className="fw-semibold">{u.nombre}</div>
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
                      <strong>{criterioTexto(bulkConsolidado[0], diasMin)}</strong>. Plantilla:{' '}
                      <strong>{plantillaActiva.titulo}</strong>.
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
                                      Seleccionar para envío
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
        </>
      )}
    </section>
  )
}
