import { SignJWT, jwtVerify } from "https://esm.sh/jose@5.9.6"

export const DB_JWT_ISSUER = "notas-db-login"
const AUD = "authenticated"

function secretKey(jwtSecret: string) {
  return new TextEncoder().encode(jwtSecret)
}

export type DbLoginJwtPayload = {
  sub: string
  role?: string
  email?: string
  user_metadata?: Record<string, unknown>
  iss?: string
  [k: string]: unknown
}

export async function signDbLoginAccessToken(
  jwtSecret: string,
  row: {
    id: number
    username: string
    email: string | null
    rol: string | null
    nombre_completo: string | null
    is_superuser: boolean
    is_staff: boolean
  },
): Promise<{ token: string; expiresIn: number }> {
  const sub = crypto.randomUUID()
  const rol = String(row.rol ?? "VENDEDOR").trim().toUpperCase()
  const user_metadata = {
    usuarioId: row.id,
    usuario_id: row.id,
    dbUserId: row.id,
    rol,
    isSuperuser: Boolean(row.is_superuser),
    username: String(row.username ?? "").trim(),
    nombreCompleto: row.nombre_completo != null ? String(row.nombre_completo).trim() : null,
    isStaff: Boolean(row.is_staff),
  }
  const expSeconds = 60 * 60 * 24 * 7
  const token = await new SignJWT({
    role: "authenticated",
    email: row.email ?? `${user_metadata.username || "usuario"}@local.test`,
    user_metadata,
    app_metadata: {},
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(sub)
    .setIssuer(DB_JWT_ISSUER)
    .setAudience(AUD)
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + expSeconds * 1000))
    .sign(secretKey(jwtSecret))

  return { token, expiresIn: expSeconds }
}

export async function verifyDbLoginJwt(
  jwtSecret: string,
  token: string,
): Promise<DbLoginJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(jwtSecret), {
      algorithms: ["HS256"],
      issuer: DB_JWT_ISSUER,
      audience: AUD,
      clockTolerance: 60,
    })
    if (String(payload.role ?? "") !== "authenticated") return null
    return payload as DbLoginJwtPayload
  } catch {
    return null
  }
}

/**
 * Tokens emitidos antes de fijar `iss` en db-login-jwt, o sin `aud` esperado.
 * Verifica firma con el JWT secret del proyecto y descarta JWT de GoTrue (`iss` *.supabase.co*).
 */
export async function verifyDbLoginJwtRelaxed(
  jwtSecret: string,
  token: string,
): Promise<DbLoginJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(jwtSecret), {
      algorithms: ["HS256"],
      clockTolerance: 60,
    })
    const iss = String(payload.iss ?? "").trim()
    if (iss.includes("supabase.co")) return null
    if (iss && iss !== DB_JWT_ISSUER) return null
    if (String(payload.role ?? "") !== "authenticated") return null
    const meta = (payload.user_metadata ?? {}) as Record<string, unknown>
    const uid = meta.usuarioId ?? meta.usuario_id ?? meta.dbUserId
    if (uid == null || uid === "") return null
    return payload as DbLoginJwtPayload
  } catch {
    return null
  }
}
