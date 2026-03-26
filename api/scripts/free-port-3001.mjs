/**
 * Libera el puerto 3001 antes de arrancar el API (evita 404 por proceso viejo).
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const killPort = require('kill-port')

try {
  await killPort(3001)
} catch {
  // Sin proceso en ese puerto u otro fallo: seguimos; node --watch fallará si sigue ocupado.
}
