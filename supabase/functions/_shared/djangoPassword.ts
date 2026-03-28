/** Misma lógica que `api/src/auth/djangoPassword.js` (PBKDF2-SHA256 Django). */

const PBKDF2_ITERATIONS = 600_000

function randomSalt22(): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let s = ""
  const buf = new Uint8Array(22)
  crypto.getRandomValues(buf)
  for (let i = 0; i < 22; i++) {
    s += chars[buf[i]! % chars.length]
  }
  return s
}

export async function encodeDjangoPasswordAsync(
  plain: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = randomSalt22()
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(plain), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  )
  const bytes = new Uint8Array(bits)
  let bin = ""
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  const hash = btoa(bin)
  return `pbkdf2_sha256$${iterations}$${salt}$${hash}`
}

export function isProbablyLegacyPlaintextPassword(stored: unknown): boolean {
  return Boolean(
    stored && typeof stored === "string" && !String(stored).includes("$"),
  )
}

function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a[i]! ^ b[i]!
  return x === 0
}

export function legacyPlaintextMatches(plain: string, stored: string): boolean {
  if (!plain || !stored) return false
  if (plain.length !== stored.length) return false
  const enc = new TextEncoder()
  return timingSafeEqualBytes(enc.encode(plain), enc.encode(stored))
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

export async function verifyDjangoPassword(plain: string, encoded: string): Promise<boolean> {
  if (!plain || !encoded || typeof encoded !== "string") return false
  const parts = encoded.split("$")
  if (parts.length !== 4) return false
  const [algorithm, iterStr, salt, hashB64] = parts
  if (algorithm !== "pbkdf2_sha256") return false
  const iterations = parseInt(iterStr, 10)
  if (!Number.isFinite(iterations) || iterations < 1) return false
  const expected = base64ToBytes(hashB64)
  if (!expected || expected.length !== 32) return false
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(plain), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  )
  const derived = new Uint8Array(bits)
  return timingSafeEqualBytes(expected, derived)
}

export function djangoPasswordAlgorithm(encoded: string): string | null {
  if (!encoded || typeof encoded !== "string") return null
  return encoded.split("$")[0] ?? null
}
