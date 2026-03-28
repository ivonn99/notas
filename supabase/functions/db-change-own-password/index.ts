import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { verifyDbLoginJwt } from "../_shared/dbJwt.ts"
import {
  djangoPasswordAlgorithm,
  encodeDjangoPasswordAsync,
  isProbablyLegacyPlaintextPassword,
  legacyPlaintextMatches,
  verifyDjangoPassword,
} from "../_shared/djangoPassword.ts"

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
    const jwtSecret = (Deno.env.get("JWT_SECRET") ?? Deno.env.get("SUPABASE_JWT_SECRET") ?? "").trim()
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!jwtSecret) {
      return new Response(JSON.stringify({ error: "Falta JWT_SECRET en secrets" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Faltan variables en el servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const raw = await req.text()
    let body: Record<string, unknown> = {}
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
    } catch {
      return new Response(JSON.stringify({ error: "Cuerpo JSON inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const authHeader = req.headers.get("Authorization")
    const fromHeader = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : ""
    const fromBody = String(body.accessToken ?? "").trim()
    const accessToken = fromHeader || fromBody
    if (!accessToken) {
      return new Response(
        JSON.stringify({
          error:
            "Falta token: envía Authorization: Bearer <jwt> o accessToken en el JSON (login por base de datos).",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    const payload = await verifyDbLoginJwt(jwtSecret, accessToken)
    if (!payload) {
      return new Response(
        JSON.stringify({
          error:
            "Token inválido o expirado. Comprueba JWT_SECRET en secrets de la función (Legacy JWT Secret del proyecto) y vuelve a iniciar sesión.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    const meta = (payload.user_metadata ?? {}) as Record<string, unknown>
    const usuarioId = Number(meta.usuarioId ?? meta.usuario_id ?? meta.dbUserId)
    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      return new Response(JSON.stringify({ error: "Token sin usuarioId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const current = String(body.currentPassword ?? "")
    const nextPass = String(body.newPassword ?? "")
    if (!current || !nextPass || nextPass.length < 4) {
      return new Response(JSON.stringify({ error: "Contraseña inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: row, error: qErr } = await admin
      .from("usuarios")
      .select("id, password")
      .eq("id", usuarioId)
      .maybeSingle()

    if (qErr || !row) {
      return new Response(JSON.stringify({ error: "Usuario no encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const stored = row.password != null ? String(row.password) : ""
    if (!stored.trim()) {
      return new Response(JSON.stringify({ error: "Sin contraseña en base; usa reset de admin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    let currentOk = false
    if (isProbablyLegacyPlaintextPassword(stored)) {
      currentOk = legacyPlaintextMatches(current, stored)
    } else {
      const algo = djangoPasswordAlgorithm(stored)
      if (algo !== "pbkdf2_sha256") {
        return new Response(
          JSON.stringify({
            error:
              "Formato de contraseña no compatible. Contacta a un administrador.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }
      currentOk = await verifyDjangoPassword(current, stored)
    }

    if (!currentOk) {
      return new Response(JSON.stringify({ error: "Contraseña actual incorrecta" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const encoded = await encodeDjangoPasswordAsync(nextPass)
    const { error: upErr } = await admin
      .from("usuarios")
      .update({ password: encoded })
      .eq("id", usuarioId)

    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message || "No se pudo actualizar" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error interno"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
