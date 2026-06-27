# Arquitectura — Notas de crédito

Decisión de stack y reparto de responsabilidades (2026).

---

## Modelo canónico (producción)

```
┌──────────────┐     JWT db-login-jwt      ┌─────────────────────┐
│  React (web) │ ────────────────────────► │  Supabase PostgREST │
│  Netlify     │     + anon key (apikey)   │  + RLS por rol/ruta │
└──────┬───────┘                           └──────────┬──────────┘
       │                                              │
       │  WhatsApp, logs app, fallback legacy         │
       ▼                                              ▼
┌──────────────┐                           ┌─────────────────────┐
│  API Node    │ ──── PostgreSQL ─────────►│  Misma BD Supabase  │
└──────────────┘                           └─────────────────────┘
```

### Supabase (canónico para datos)

- **Login:** Edge Function `db-login-jwt` → JWT con `user_metadata.usuarioId`, `rol`, `isSuperuser`.
- **Lectura/escritura:** cliente `@supabase/supabase-js` en el navegador, rol `authenticated`.
- **Autorización:** políticas RLS (`jwt_is_admin`, `vendedor_puede_ver_nota`, etc.).
- **Importación masiva:** corre en el navegador (`importacionReporte.js`) contra PostgREST.
- **Storage:** bucket `documentos-notas` (adjuntos), si está configurado.

### API Node (complementario)

| Responsabilidad | Motivo |
|-----------------|--------|
| WhatsApp / Baileys | No viable en browser |
| Logs de archivo | `api/logs/app.log` (pestaña Logs) |

El frontend ya **no** bifurca datos entre PostgREST y `/api/*`. Solo `whatsappApi.js` y `logsApi.archivo()` usan el API Node vía `http.js`.

---

## Módulos compartidos (`shared/`)

Reglas puras, sin I/O, usadas por API y frontend:

| Módulo | Contenido |
|--------|-----------|
| [`shared/importValidation.js`](../shared/importValidation.js) | Validación de filas de importación |
| [`shared/notasNegocio.js`](../shared/notasNegocio.js) | `requiere_atencion`, permisos por rol |

Tests en `api/test/*.test.js` importan desde `shared/`.

---

## Frontend (`*Api.js`)

Todos los servicios de datos usan **PostgREST** (`supabase.from(...)`). `assertSupabaseConfigured()` en `main.jsx` exige env al arrancar.

Excepciones que siguen llamando al API Node:

- `whatsappApi.js` — sesión Baileys
- `logsApi.archivo()` — tail de `app.log` (opcional si `VITE_API_URL` apunta al servidor)

---

## Autenticación

| Flujo | Detalle |
|-------|---------|
| Login | `authApi.js` → Edge `db-login-jwt` → token en localStorage → Bearer en PostgREST |
| API Node | Misma sesión: `getApiAuthorizationHeader()` envía el JWT db-login en WhatsApp/logs |

El API Node acepta cookie legacy o Bearer (`middleware/auth.js`) por compatibilidad con herramientas internas; el frontend web ya no usa cookie de login.

## Base de datos

- PostgreSQL en Supabase; esquema legacy Django (`usuarios`, `notas_credito`, …).
- Endurecimiento aplicado: CHECKs, índices UNIQUE, RLS, sin grants `anon` en `usuarios`.
- Scripts: [`supabase/scripts/`](../supabase/scripts/).

---

## Despliegue típico

1. **Supabase** — BD, RLS, Edge Functions, secrets.
2. **Netlify** — build `frontend/` con `VITE_SUPABASE_*`.
3. **Render / similar** — API Node (WhatsApp; opcional para `app.log`).

---

Ver también [`analisis-proyecto.md`](analisis-proyecto.md) y [`reglas-negocio.md`](reglas-negocio.md).
