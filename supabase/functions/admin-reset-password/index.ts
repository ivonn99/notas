import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: "Faltan variables en el servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const meta = user.user_metadata ?? {}
    const isSuper = Boolean(meta.isSuperuser)
    const rol = String(meta.rol ?? "").toUpperCase()
    if (!isSuper && rol !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Sin permiso" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as {
      usuarioId?: number
      newPassword?: string
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
      .select("id, email")
      .eq("id", usuarioId)
      .maybeSingle()

    if (rowErr || !row?.email) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const emailNorm = String(row.email).trim().toLowerCase()
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
      return new Response(
        JSON.stringify({
          error:
            "No existe usuario en Supabase Auth con el mismo email que en la tabla usuarios",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
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
