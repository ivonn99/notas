import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { pickBearerAuth, resolveAdminAuth } from "../_shared/resolveAdminAuth.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const previousEmail = String(body?.previousEmail ?? "").trim().toLowerCase()
    const newEmail = String(body?.newEmail ?? "").trim().toLowerCase()

    if (!Number.isFinite(usuarioId) || usuarioId <= 0 || !previousEmail || !newEmail) {
      return new Response(JSON.stringify({ error: "Datos inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (previousEmail === newEmail) {
      return new Response(JSON.stringify({ ok: true, synced: false, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: row, error: rowErr } = await admin
      .from("usuarios")
      .select("id")
      .eq("id", usuarioId)
      .maybeSingle()

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado en la tabla" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const authUserId = await findAuthUserIdByEmail(admin, previousEmail)
    if (!authUserId) {
      return new Response(
        JSON.stringify({
          ok: true,
          synced: false,
          skipped: true,
          message:
            "No hay cuenta en Auth con el email anterior; solo se actualizará la tabla usuarios.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const { data: updated, error: updErr } = await admin.auth.admin.updateUserById(authUserId, {
      email: newEmail,
    })
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        synced: true,
        item: {
          authId: updated.user?.id,
          email: updated.user?.email,
          usuarioTablaId: usuarioId,
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
