import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { signDbLoginAccessToken } from "../_shared/dbJwt.ts"
import {
  djangoPasswordAlgorithm,
  encodeDjangoPasswordAsync,
  isProbablyLegacyPlaintextPassword,
  legacyPlaintextMatches,
  verifyDjangoPassword,
} from "../_shared/djangoPassword.ts"

import {
  checkLoginRateLimit,
  clientIpFromRequest,
} from "../_shared/loginRateLimit.ts"

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

  const rateMsg = checkLoginRateLimit(clientIpFromRequest(req))
  if (rateMsg) {
    return new Response(JSON.stringify({ error: rateMsg }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const jwtSecret = (Deno.env.get("JWT_SECRET") ?? Deno.env.get("SUPABASE_JWT_SECRET") ?? "").trim()
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    if (!jwtSecret) {
      return new Response(
        JSON.stringify({
          error:
            "Falta JWT_SECRET (o SUPABASE_JWT_SECRET) en secrets de la función: debe ser el JWT Secret del proyecto (Settings → API → JWT Settings).",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Faltan variables en el servidor" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = (await req.json()) as { username?: string; password?: string }
    const username = String(body?.username ?? "").trim()
    const password = String(body?.password ?? "")
    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Usuario y contraseña son obligatorios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    // Evita que `%` o `_` en ILIKE actúen como comodines
    if (!/^[a-zA-Z0-9._@-]+$/.test(username)) {
      return new Response(JSON.stringify({ error: "Usuario con caracteres no permitidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: rows, error: qErr } = await admin
      .from("usuarios")
      .select(
        "id, username, password, rol, nombre_completo, activo, is_active, is_superuser, is_staff, email",
      )
      .ilike("username", username)
      .limit(2)

    if (qErr) {
      return new Response(JSON.stringify({ error: qErr.message || "Error al leer usuario" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const list = rows ?? []
    const row = list.find((r) => {
      const u = String(r.username ?? "").trim().toLowerCase()
      return u === username.toLowerCase()
    })
    const fail = () =>
      new Response(JSON.stringify({ error: "Usuario o contraseña incorrectos" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })

    if (!row) return fail()
    if (row.activo === false || row.is_active === false) {
      return new Response(JSON.stringify({ error: "Usuario desactivado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const passVal = row.password
    if (passVal == null || String(passVal).trim() === "") {
      return new Response(
        JSON.stringify({
          error:
            "Este usuario no tiene contraseña en la tabla usuarios. Un admin puede usar «Restablecer contraseña» en la lista de usuarios, o vuelve a crear el usuario indicando contraseña (mín. 4 caracteres) si usas login por base de datos.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }
    const stored = String(passVal)

    if (isProbablyLegacyPlaintextPassword(stored)) {
      if (!legacyPlaintextMatches(password, stored)) return fail()
      const newHash = await encodeDjangoPasswordAsync(password)
      await admin.from("usuarios").update({ password: newHash }).eq("id", row.id)
    } else {
      const algo = djangoPasswordAlgorithm(stored)
      if (algo !== "pbkdf2_sha256") {
        return new Response(
          JSON.stringify({
            error: "Formato de contraseña no compatible (se espera pbkdf2_sha256).",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        )
      }
      if (!(await verifyDjangoPassword(password, stored))) return fail()
    }

    const emailOut = normalizeEmail(row.email, row.username)
    const { token, expiresIn } = await signDbLoginAccessToken(jwtSecret, {
      id: row.id,
      username: String(row.username ?? ""),
      email: row.email != null ? String(row.email) : null,
      rol: row.rol != null ? String(row.rol) : null,
      nombre_completo: row.nombre_completo != null ? String(row.nombre_completo) : null,
      is_superuser: Boolean(row.is_superuser),
      is_staff: Boolean(row.is_staff),
    })

    return new Response(
      JSON.stringify({
        access_token: token,
        token_type: "bearer",
        expires_in: expiresIn,
        user: {
          id: row.id,
          usuarioId: row.id,
          username: String(row.username ?? ""),
          rol: String(row.rol ?? "VENDEDOR").toUpperCase(),
          nombreCompleto: row.nombre_completo ?? null,
          isSuperuser: Boolean(row.is_superuser),
          isStaff: Boolean(row.is_staff),
          email: emailOut,
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
