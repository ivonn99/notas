import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { pickBearerAuth, resolveAdminAuth } from "../_shared/resolveAdminAuth.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

function normalizeEmail(emailRaw: unknown, usernameRaw: unknown): string {
  const email = String(emailRaw ?? "").trim().toLowerCase()
  if (email) return email
  const user = String(usernameRaw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
  return `${user || "usuario"}@local.test`
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  emailNorm: string,
): Promise<string | null> {
  let page = 1
  const perPage = 200
  while (page <= 50) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage,
    })
    if (listErr) throw new Error(listErr.message)
    const found = list.users.find((u) => u.email?.toLowerCase() === emailNorm)
    if (found?.id) return found.id
    const users = list?.users ?? []
    if (!users.length || users.length < perPage) break
    page += 1
  }
  return null
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    const jwtSecret = (Deno.env.get("JWT_SECRET") ?? Deno.env.get("SUPABASE_JWT_SECRET") ?? "")
      .trim() || undefined

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: "Faltan variables en el servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const raw = await req.text()
    let body: Record<string, unknown> = {}
    try {
      if (raw) body = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const effectiveAuth = pickBearerAuth(req.headers.get("Authorization"), body)
    const adminAuth = await resolveAdminAuth(
      supabaseUrl,
      supabaseAnonKey,
      effectiveAuth,
      jwtSecret,
      corsHeaders,
    )
    if (adminAuth instanceof Response) return adminAuth

    const usuarioId = Number(body?.usuarioId)
    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      return new Response(JSON.stringify({ error: "usuarioId inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: row, error: rowErr } = await admin
      .from("usuarios")
      .select("id, username, email, nombre_completo, rol, is_superuser")
      .eq("id", usuarioId)
      .maybeSingle()

    if (rowErr) {
      return new Response(JSON.stringify({ error: rowErr.message || "Error al leer usuario" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!row) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const emailNorm = normalizeEmail(row.email, row.username)
    const authId = await findAuthUserIdByEmail(admin, emailNorm)
    if (!authId) {
      return new Response(
        JSON.stringify({
          synced: false,
          message:
            "No hay usuario en Supabase Auth con ese email. Ejecuta sync: api → npm run sync:supabase-auth.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const rolU = String(row.rol ?? "VENDEDOR").trim().toUpperCase()
    const user_metadata = {
      usuarioId: row.id,
      rol: rolU,
      isSuperuser: Boolean(row.is_superuser),
      username: String(row.username ?? "").trim() || undefined,
      nombreCompleto: String(row.nombre_completo ?? "").trim() || undefined,
    }

    const { error: upErr } = await admin.auth.admin.updateUserById(authId, {
      user_metadata,
    })
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message || "No se pudo actualizar Auth" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: true, synced: true, authUserId: authId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
