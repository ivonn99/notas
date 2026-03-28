import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { encodeDjangoPasswordAsync } from "../_shared/djangoPassword.ts"
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
    if (adminAuth instanceof Response) {
      const errText = await adminAuth.clone().text().catch(() => "")
      console.error(
        "[admin-reset-password] auth rechazado",
        JSON.stringify({
          status: adminAuth.status,
          jwtSecretConfigured: Boolean(jwtSecret),
          hadHeaderAuthorization: Boolean(req.headers.get("Authorization")?.trim()),
          hadBodyAccessToken: Boolean(String(body?.accessToken ?? "").trim()),
          effectiveBearerPresent: Boolean(effectiveAuth),
          responseBodyPreview: errText.slice(0, 400),
        }),
      )
      return adminAuth
    }

    const usuarioId = Number(body?.usuarioId)
    const newPassword = String(body?.newPassword ?? "")
    if (!Number.isFinite(usuarioId) || usuarioId <= 0 || newPassword.length < 4) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: row, error: rowErr } = await admin
      .from("usuarios")
      .select("id, email, username")
      .eq("id", usuarioId)
      .maybeSingle()

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const emailNorm = normalizeEmail(row.email, row.username)
    let authUserId: string | null = null
    let page = 1
    const perPage = 200

    while (!authUserId && page <= 50) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page,
        perPage,
      })
      if (listErr) {
        return new Response(JSON.stringify({ error: listErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      const found = list.users.find(
        (u) => u.email?.toLowerCase() === emailNorm,
      )
      if (found?.id) {
        authUserId = found.id
        break
      }
      if (!list.users.length || list.users.length < perPage) break
      page += 1
    }

    if (!authUserId) {
      const newHash = await encodeDjangoPasswordAsync(newPassword)
      const { error: upDb } = await admin
        .from("usuarios")
        .update({ password: newHash })
        .eq("id", usuarioId)
      if (upDb) {
        return new Response(JSON.stringify({ error: upDb.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
      return new Response(
        JSON.stringify({
          ok: true,
          mode: "db_password_only",
          message: "Contraseña actualizada en la tabla usuarios (sin cuenta en Supabase Auth).",
          item: { usuarioTablaId: row.id },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(
      authUserId,
      { password: newPassword },
    )
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        item: {
          id: updated.user?.id,
          email: updated.user?.email,
          usuarioTablaId: row.id,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
