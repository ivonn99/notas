const jsonHeaders = { 'Content-Type': 'application/json' }

function parseBody(text) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text.slice(0, 200) }
  }
}

function loginErrorMessage(status, data) {
  if (data.error) return data.error

  if (status === 404) {
    return 'No hay ruta de login (404). En la carpeta api: npm run dev. Comprueba http://127.0.0.1:3001/api/auth/ping'
  }

  // Vite proxy cuando el API no responde en 3001
  if (status === 502 || status === 503 || status === 504) {
    return `El front no puede hablar con el API (HTTP ${status}). Arranca el servidor: carpeta api → npm run dev y espera a ver "API lista en http://localhost:3001". Abre http://127.0.0.1:3001/api/health en el navegador (debe salir JSON).`
  }

  if (data._raw) {
    return `HTTP ${status}: ${data._raw}`
  }

  return `Error HTTP ${status} al iniciar sesión`
}

export async function authLogin(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify({ username, password }),
  })
  const text = await res.text()
  const data = parseBody(text)
  if (!res.ok) {
    throw new Error(loginErrorMessage(res.status, data))
  }
  return data.user
}

export async function authLogout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
}

export async function authMe() {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return null
  return data.user
}
