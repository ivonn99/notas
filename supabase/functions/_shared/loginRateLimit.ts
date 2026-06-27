const DEFAULT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_MAX = 20

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(raw ?? "").trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function isLoginRateLimitDisabled(): boolean {
  const v = String(Deno.env.get("LOGIN_RATE_LIMIT_DISABLED") ?? "")
    .trim()
    .toLowerCase()
  return v === "true" || v === "1" || v === "yes"
}

export function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const first = xff.split(",")[0]?.trim()
    if (first) return first
  }
  const cf = req.headers.get("cf-connecting-ip")?.trim()
  if (cf) return cf
  const real = req.headers.get("x-real-ip")?.trim()
  if (real) return real
  return "unknown"
}

/** @returns null si permitido; mensaje de error si bloqueado */
export function checkLoginRateLimit(ip: string): string | null {
  if (isLoginRateLimitDisabled()) return null

  const windowMs = parsePositiveInt(
    Deno.env.get("LOGIN_RATE_LIMIT_WINDOW_MS"),
    DEFAULT_WINDOW_MS,
  )
  const max = parsePositiveInt(Deno.env.get("LOGIN_RATE_LIMIT_MAX"), DEFAULT_MAX)
  const now = Date.now()
  const key = ip || "unknown"

  let bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs }
    buckets.set(key, bucket)
  }

  bucket.count += 1
  if (bucket.count > max) {
    return "Demasiados intentos de inicio de sesión. Intenta más tarde."
  }
  return null
}
