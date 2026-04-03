import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import imageCompression from 'browser-image-compression'
import { useAuth } from '../../contexts/AuthContext.jsx'

const STORAGE_KEY_PREFIX = 'dmh_enlaces_imagenes_v1'
const LAST_UPLOAD_OK_PREFIX = 'dmh_cloudinary_upload_ok_v1'

function storageKeyForUser(userId) {
  const id = userId != null && String(userId).trim() !== '' ? String(userId) : 'anon'
  return `${STORAGE_KEY_PREFIX}:${id}`
}

function lastUploadOkKey(userId) {
  const id = userId != null && String(userId).trim() !== '' ? String(userId) : 'anon'
  return `${LAST_UPLOAD_OK_PREFIX}:${id}`
}

function loadLinks(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x) => x && typeof x.secureUrl === 'string' && x.id)
  } catch {
    return []
  }
}

function saveLinks(key, links) {
  try {
    localStorage.setItem(key, JSON.stringify(links))
  } catch {
    // quota exceeded or private mode
  }
}

function getCloudinaryConfig() {
  const cloudName = String(import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '').trim()
  const uploadPreset = String(import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '').trim()
  return { cloudName, uploadPreset, ok: Boolean(cloudName && uploadPreset) }
}

const COMPRESSION_BASE = {
  maxSizeMB: 1,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
  initialQuality: 0.85,
}

/** Prioridad WebP (mejor peso); si el navegador no puede, JPEG. */
async function compressForUpload(file) {
  try {
    const out = await imageCompression(file, {
      ...COMPRESSION_BASE,
      fileType: 'image/webp',
    })
    return { file: out, format: 'webp' }
  } catch {
    const out = await imageCompression(file, {
      ...COMPRESSION_BASE,
      fileType: 'image/jpeg',
    })
    return { file: out, format: 'jpeg' }
  }
}

async function uploadToCloudinary(file, cloudName, uploadPreset) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || res.statusText || 'Error al subir'
    throw new Error(String(msg))
  }
  if (!data.secure_url) throw new Error('Cloudinary no devolvió URL')
  return {
    secureUrl: data.secure_url,
    publicId: data.public_id || null,
    bytes: data.bytes ?? file.size,
  }
}

export default function EnlacesImagenesPage() {
  const { user } = useAuth()
  const storageKey = useMemo(() => storageKeyForUser(user?.id), [user?.id])
  const { cloudName, uploadPreset, ok: configOk } = useMemo(() => getCloudinaryConfig(), [])

  const [links, setLinks] = useState([])
  const [phase, setPhase] = useState('')
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [copyId, setCopyId] = useState('')
  const [lastUploadOkAt, setLastUploadOkAt] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    setLinks(loadLinks(storageKey))
  }, [storageKey])

  useEffect(() => {
    try {
      const v = localStorage.getItem(lastUploadOkKey(user?.id))
      setLastUploadOkAt(v && String(v).trim() ? v : null)
    } catch {
      setLastUploadOkAt(null)
    }
  }, [user?.id])

  const persist = useCallback(
    (next) => {
      setLinks(next)
      saveLinks(storageKey, next)
    },
    [storageKey],
  )

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setError('Selecciona un archivo de imagen (JPG, PNG, WebP, etc.).')
      return
    }
    if (!configOk) {
      setError('Revisa el estado de Cloudinary arriba: faltan variables en .env o reinicia el servidor.')
      return
    }

    setError('')
    setOkMsg('')
    setPhase('Comprimiendo…')

    try {
      const { file: compressed, format: uploadFormat } = await compressForUpload(file)

      setPhase('Subiendo a Cloudinary…')
      const { secureUrl, publicId, bytes } = await uploadToCloudinary(
        compressed,
        cloudName,
        uploadPreset,
      )

      const entry = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `l-${Date.now()}`,
        secureUrl,
        publicId,
        createdAt: new Date().toISOString(),
        originalName: file.name || 'imagen',
        uploadFormat,
        bytesCompressed: compressed.size,
        bytesUploaded: bytes,
      }

      setLinks((prev) => {
        const next = [entry, ...prev]
        saveLinks(storageKey, next)
        return next
      })
      const okIso = new Date().toISOString()
      try {
        localStorage.setItem(lastUploadOkKey(user?.id), okIso)
        setLastUploadOkAt(okIso)
      } catch {
        setLastUploadOkAt(okIso)
      }
      setOkMsg('Imagen subida. El enlace quedó guardado abajo.')
      setPhase('')
    } catch (e) {
      setPhase('')
      setError(e?.message || 'No se pudo procesar la imagen')
    }
  }

  const onInputChange = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    void handleFile(f)
  }

  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const f = e.dataTransfer.files?.[0]
    void handleFile(f)
  }

  const onDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  function removeLink(id) {
    persist(links.filter((l) => l.id !== id))
  }

  function clearAll() {
    persist([])
    setOkMsg('')
  }

  async function copyUrl(url, id) {
    try {
      await navigator.clipboard.writeText(url)
      setCopyId(id)
      setTimeout(() => setCopyId(''), 2000)
    } catch {
      setError('No se pudo copiar al portapapeles.')
    }
  }

  const busy = Boolean(phase)

  return (
    <section className="container-fluid px-0">
      <h1 className="h3 mb-2">Enlaces imágenes</h1>
      <p className="text-body-secondary small mb-3">
        Comprime la imagen en el navegador, súbela a Cloudinary y conserva los enlaces en este equipo (
        <strong>localStorage</strong>), listos para copiar.
      </p>

      <div
        className={`card mb-3 border ${configOk ? 'border-success-subtle' : 'border-warning-subtle'}`}
        role="status"
        aria-label="Estado de Cloudinary"
      >
        <div className="card-body py-3">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <span className="fw-semibold text-body">Cloudinary</span>
            {configOk ? (
              <span className="badge text-bg-success">Conexión exitosa</span>
            ) : (
              <span className="badge text-bg-warning text-dark">Sin configurar</span>
            )}
          </div>
          <ul className="small text-body-secondary ps-3 mb-2">
            <li>
              Cloud:{' '}
              <code className="user-select-all">{cloudName || '—'}</code>
            </li>
            <li>
              Preset (unsigned):{' '}
              <code className="user-select-all">{uploadPreset || '—'}</code>
            </li>
          </ul>
          {lastUploadOkAt ? (
            <p className="small text-body-secondary mb-0">
              <strong className="text-body">Última subida:</strong>{' '}
              {new Date(lastUploadOkAt).toLocaleString('es-MX', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              (este navegador y usuario).
            </p>
          ) : !configOk ? (
            <p className="small text-body-secondary mb-0">
              En <code>.env</code> define <code>VITE_CLOUDINARY_CLOUD_NAME</code> y{' '}
              <code>VITE_CLOUDINARY_UPLOAD_PRESET</code> (preset sin firmar en Cloudinary) y reinicia{' '}
              <code>npm run dev</code>.
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}
      {okMsg ? (
        <div className="alert alert-success py-2" role="status">
          {okMsg}
        </div>
      ) : null}

      <div className="row g-3">
        <div className="col-12 col-lg-5">
          <div className="card h-100">
            <div className="card-header">Subir imagen</div>
            <div className="card-body">
              <div
                className={`border border-2 rounded-3 p-4 text-center mb-3 ${busy ? 'opacity-50' : ''}`}
                style={{ borderStyle: 'dashed', cursor: busy ? 'wait' : 'pointer' }}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={() => !busy && inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    if (!busy) inputRef.current?.click()
                  }
                }}
              >
                <p className="mb-1 fw-medium">Arrastra una imagen aquí</p>
                <p className="small text-body-secondary mb-0">o haz clic para elegir archivo</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="d-none"
                disabled={busy || !configOk}
                onChange={onInputChange}
              />
              {phase ? (
                <p className="small text-primary mb-0">
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden />
                  {phase}
                </p>
              ) : (
                <p className="small text-body-secondary mb-0">
                  Tras comprimir se sube en <strong>WebP</strong> (si el navegador lo permite; si no, JPEG).
                  Máx. ~1&nbsp;MB y 2048&nbsp;px en el lado mayor.
                  {configOk && uploadPreset ? (
                    <>
                      {' '}
                      Preset <code className="small">{uploadPreset}</code>.
                    </>
                  ) : null}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-7">
          <div className="card h-100">
            <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-2">
              <span>Links generados en la sesión</span>
              {links.length > 0 ? (
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={clearAll}>
                  Vaciar lista
                </button>
              ) : null}
            </div>
            <div className="card-body">
              {links.length === 0 ? (
                <p className="text-body-secondary small mb-0">
                  Aún no hay enlaces. Los que generes se guardan en el navegador de este usuario en este
                  equipo (persisten al recargar la página).
                </p>
              ) : (
                <ul className="list-group list-group-flush">
                  {links.map((l) => (
                    <li key={l.id} className="list-group-item px-0">
                      <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch align-items-md-start">
                        <a
                          href={l.secureUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 rounded border overflow-hidden bg-body-secondary"
                          style={{ width: '4.5rem', height: '4.5rem' }}
                        >
                          <img
                            src={l.secureUrl}
                            alt=""
                            className="w-100 h-100"
                            style={{ objectFit: 'cover' }}
                          />
                        </a>
                        <div className="flex-grow-1 min-w-0">
                          <div className="small text-body-secondary mb-1">
                            {l.originalName}
                            {l.uploadFormat ? (
                              <span className="badge text-bg-secondary ms-1 text-uppercase">
                                {l.uploadFormat}
                              </span>
                            ) : null}
                            {l.createdAt
                              ? ` · ${new Date(l.createdAt).toLocaleString('es-MX', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })}`
                              : null}
                          </div>
                          <div className="small text-break font-monospace bg-body-secondary rounded px-2 py-1 mb-2">
                            {l.secureUrl}
                          </div>
                          <div className="d-flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => copyUrl(l.secureUrl, l.id)}
                            >
                              {copyId === l.id ? 'Copiado' : 'Copiar enlace'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() => window.open(l.secureUrl, '_blank', 'noopener,noreferrer')}
                            >
                              Abrir
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger ms-md-auto"
                              onClick={() => removeLink(l.id)}
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
