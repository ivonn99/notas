import { createClient, type User } from "https://esm.sh/@supabase/supabase-js@2"
import { DB_JWT_ISSUER, verifyDbLoginJwt, verifyDbLoginJwtRelaxed } from "./dbJwt.ts"

function decodeJwtPayloadUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".")
    if (parts.length < 2) return null
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/")
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4))
    return JSON.parse(atob(b64 + pad)) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Token para admin: prioriza `accessToken` del JSON.
 * Algunos entornos reemplazan `Authorization` por el JWT del anon key; el body lo envía el front explícito.
 */
export function pickBearerAuth(
  authorizationHeader: string | null,
  body: Record<string, unknown>,
): string | null {
  const fromBody = String(body?.accessToken ?? "").trim()
  if (fromBody) return `Bearer ${fromBody}`
  const h = authorizationHeader?.trim()
  if (h?.startsWith("Bearer ") && h.length > 7) return h
  return null
}

export type AdminAuthOk =
  | { source: "gotrue"; user: User }
  | { source: "db_jwt"; sub: string; meta: Record<string, unknown> }

function isAdminFromMeta(meta: Record<string, unknown>): boolean {
  const isSuper = Boolean(meta.isSuperuser)
  const rol = String(meta.rol ?? "").toUpperCase()
  return isSuper || rol === "ADMIN" || rol === "CREDITO"
}

function errRes(
  status: number,
  body: Record<string, unknown>,
  cors?: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  })
}

/**
 * Acepta sesión Supabase Auth (GoTrue) o JWT emitido por `db-login-jwt` (mismo JWT Secret del proyecto).
 */
export async function resolveAdminAuth(
  supabaseUrl: string,
  supabaseAnonKey: string,
  authHeader: string | null,
  jwtSecret: string | undefined,
  corsHeaders?: Record<string, string>,
): Promise<AdminAuthOk | Response> {
  if (!authHeader?.startsWith("Bearer ")) {
    return errRes(401, { error: "No autorizado" }, corsHeaders)
  }
  const token = authHeader.slice(7).trim()
  if (!token) {
    return errRes(401, { error: "No autorizado" }, corsHeaders)
  }

  const unsafe = decodeJwtPayloadUnsafe(token)

  if (jwtSecret) {
    const strict = await verifyDbLoginJwt(jwtSecret, token)
    if (strict) {
      const meta = (strict.user_metadata ?? {}) as Record<string, unknown>
      if (!isAdminFromMeta(meta)) {
        return errRes(403, { error: "Sin permiso" }, corsHeaders)
      }
      return { source: "db_jwt", sub: String(strict.sub ?? ""), meta }
    }
    const relaxed = await verifyDbLoginJwtRelaxed(jwtSecret, token)
    if (relaxed) {
      const meta = (relaxed.user_metadata ?? {}) as Record<string, unknown>
      if (!isAdminFromMeta(meta)) {
        return errRes(403, { error: "Sin permiso" }, corsHeaders)
      }
      return { source: "db_jwt", sub: String(relaxed.sub ?? ""), meta }
    }
  } else {
    const iss = String(unsafe?.iss ?? "").trim()
    const meta = (unsafe?.user_metadata ?? {}) as Record<string, unknown>
    const uid = meta.usuarioId ?? meta.usuario_id ?? meta.dbUserId
    const looksDb =
      iss === DB_JWT_ISSUER ||
      (String(unsafe?.role ?? "") === "authenticated" && uid != null && uid !== "")
    if (looksDb) {
      return errRes(503, {
        error:
          "Falta JWT_SECRET en secrets de Edge Functions. Debe ser el mismo valor que «JWT Secret» (legacy) en Settings → API de Supabase.",
      }, corsHeaders)
    }
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return errRes(401, {
      error:
        "Sesión inválida. Si iniciaste sesión con usuario/contraseña de la tabla, configura JWT_SECRET en secrets de Edge (Legacy JWT Secret), despliega las funciones y vuelve a entrar; si el token es antiguo, cierra sesión e inicia de nuevo.",
    }, corsHeaders)
  }
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const isSuper = Boolean(meta.isSuperuser)
  const rol = String(meta.rol ?? "").toUpperCase()
  if (!isSuper && rol !== "ADMIN" && rol !== "CREDITO") {
    return errRes(403, { error: "Sin permiso" }, corsHeaders)
  }
  return { source: "gotrue", user }
}
