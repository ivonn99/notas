# Análisis del proyecto — Notas de crédito

Documento actualizado tras revisión de código, esquema de BD y endurecimiento aplicado en Supabase (2026).

Complementa [`reglas-negocio.md`](reglas-negocio.md) (dominio) y [`../guia.txt`](../guia.txt) (referencia legacy Django).

---

## 1. Resumen ejecutivo

Sistema de gestión de **notas de crédito** para DMH (Distribuidora de Medicamentos Homeopáticos), migrado de **Django** a **React 19 + Vite + API Node/Express + PostgreSQL (Supabase)**.

| Dimensión | Valoración | Notas |
|-----------|------------|-------|
| Dominio de negocio | **Alta** | Reglas documentadas y reflejadas en código |
| Funcionalidad | **Alta** | Seguimiento, importación, reportes, admin, WhatsApp |
| Base de datos | **Alta** | Endurecida: RLS, CHECKs, índices, sin anon en `usuarios` |
| Seguridad aplicación | **Media** | API sin rate limit; RLS en BD; front unificado en Supabase |
| Calidad / tests | **Media** | Tests API + `shared/`; CI lint/build/test |
| Operaciones | **Media-baja** | CI en GitHub Actions; despliegue fragmentado (Netlify + API externo) |
| Mantenibilidad | **Media** | Archivos monolíticos; JS sin tipos; importación aún duplicada API/front |

**Conclusión:** el proyecto es **operativamente maduro en negocio** y la **capa de datos ya está en forma production-ready**. La deuda principal se concentra en **refactor de pantallas monolíticas**, **endurecer el API Node** y **reducir duplicación de importación** (front vs rutas legacy del API).

---

## 2. Stack y arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend React (Vite) — Netlify                            │
│  Zustand · React Router · Bootstrap · Supabase JS (canónico)│
└───────────────────────────┬─────────────────────────────────┘
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
          ▼                                   ▼
┌─────────────────────┐           ┌─────────────────────────┐
│  API Node :3001     │           │  Supabase               │
│  Express + pg       │           │  PostgREST + Edge Funcs  │
│  JWT cookie / Bearer│           │  db-login-jwt + RLS      │
└──────────┬──────────┘           └────────────┬────────────┘
           │                                   │
           └─────────────┬─────────────────────┘
                         ▼
              ┌─────────────────────┐
              │  PostgreSQL (Supabase)│
              │  11 tablas + RLS     │
              └─────────────────────┘
```

### Acceso a datos (frontend)

| Capa | Uso |
|------|-----|
| **Supabase PostgREST** | Canónico: todos los `*Api.js` de datos + login `db-login-jwt` |
| **API Node** | Solo WhatsApp (`whatsappApi.js`) y tail de `app.log` (`logsApi.archivo`) |

El dual path `isSupabaseConfigured` fue **eliminado** (2026). Reglas compartidas de importación viven en `shared/`; la ruta `/api/importaciones` del API sigue existiendo para herramientas legacy pero el front ya no la usa.

### Roles

| Rol | Alcance habitual |
|-----|------------------|
| `VENDEDOR` | Notas de sus rutas (`usuario_rutas`); comentarios; sin cambio de estado |
| `CREDITO` | Todo el universo de notas; panel admin (importación, usuarios, rutas…) |
| `ADMIN` | Igual que crédito + operaciones destructivas según pantalla |

---

## 3. Fortalezas

- **Reglas de negocio documentadas** en `docs/reglas-negocio.md` con referencias a archivos de código.
- **Auditoría** (`auditoria_eventos`, `logAudit`) en operaciones sensibles.
- **Separación de carpetas** clara: `frontend/`, `api/`, `supabase/`, `docs/`.
- **Resiliencia de arranque** del API (bootstrap DB no tumba el proceso).
- **Request IDs** y manejo centralizado de errores en Express.
- **Compatibilidad legacy** con hashes de contraseña Django durante la migración.
- **Scripts SQL de operaciones** en `supabase/scripts/` (diagnóstico, RLS, verificación).

---

## 4. Base de datos — estado actual (corregido)

Verificación **V.11 OK** en todas las comprobaciones:

| Comprobación | Estado |
|--------------|--------|
| CHECK constraints de negocio (5) | OK |
| UNIQUE `(empresa, serie_folio)` | OK |
| Sin duplicados de notas | OK |
| Sin grants `anon` en `usuarios` | OK |
| Sin políticas RLS `anon` | OK |
| RLS activo en 11 tablas | OK |
| 6 funciones JWT/RLS | OK |

### Qué se aplicó

1. **`diagnostico-y-endurecimiento.sql`** — índices, CHECKs, corrección de datos inconsistentes.
2. **`revocar-anon-usuarios.sql`** — cierre del agujero demo en `usuarios`.
3. **`aplicar-rls-completo.sql`** — funciones helper + políticas por rol + grants `authenticated`.

### Scripts de mantenimiento

| Script | Uso |
|--------|-----|
| [`supabase/scripts/verificar-configuracion-bd.sql`](../supabase/scripts/verificar-configuracion-bd.sql) | Auditoría periódica; pegar V.11 tras cambios |
| [`supabase/scripts/diagnostico-y-endurecimiento.sql`](../supabase/scripts/diagnostico-y-endurecimiento.sql) | Índices y CHECKs en entornos nuevos |
| [`supabase/scripts/aplicar-rls-completo.sql`](../supabase/scripts/aplicar-rls-completo.sql) | RLS + funciones en entornos sin migraciones |
| [`supabase/scripts/revocar-anon-usuarios.sql`](../supabase/scripts/revocar-anon-usuarios.sql) | Revocar acceso demo si se reaplicó por error |

### Pendiente menor en BD

- **Storage:** bucket `documentos-notas` y políticas (sección comentada en `aplicar-rls-completo.sql`) si se usan adjuntos.
- **Migración demo anon:** [`20260327170000_rls_usuarios_anon_full_access.sql`](../supabase/migrations/20260327170000_rls_usuarios_anon_full_access.sql) fue **sustituida** por script de revocación idempotente (no vuelve a abrir el agujero en entornos nuevos).
- **`ALTER TABLE` en arranque del API** (`notasSchema.js`, `usuariosSchema.js`, `audit.js`) — duplica responsabilidad con migraciones SQL; preferir solo migraciones Supabase.

---

## 5. Deficiencias pendientes

### 5.1 Arquitectura — Prioridad alta

| Problema | Impacto | Estado |
|----------|---------|--------|
| Doble vía API / Supabase en frontend | Bugs según entorno; lógica duplicada | **Resuelto** — front Supabase-only |
| Lógica de importación en front y API | Divergencia de comportamiento | **Parcial** — `shared/importValidation.js`; API legacy aún tiene router propio |
| `djangoPassword` duplicado (API + Edge Functions) | Parches en dos sitios | Pendiente |

### 5.2 Seguridad aplicación — Prioridad media-alta

| Problema | Estado | Recomendación |
|----------|--------|---------------|
| RLS `anon` en `usuarios` | **Resuelto** | Mantener verificación V.11 |
| CORS `origin: true` en API | **Resuelto** | `CORS_ORIGINS` + localhost solo en dev |
| Sin rate limit en `/api/auth/login` | Pendiente | `express-rate-limit` |
| Sin `helmet` | Pendiente | Headers de seguridad estándar |
| Vendedor puede UPDATE notas vía PostgREST (RLS) | Parcial | Restringir columnas en política o forzar mutaciones vía API |
| JWT dev fallback inseguro | Solo dev | Validar `JWT_SECRET` en prod al desplegar |
| Baileys / WhatsApp no oficial | Riesgo operativo | Microservicio aislado o proveedor oficial |

### 5.3 Calidad y pruebas — Prioridad alta

| Área | Estado |
|------|--------|
| Tests API + shared | **Hecho** — `api/test/*.test.js` (25 tests) |
| Tests frontend | Ninguno |
| Tests integración / RLS | Ninguno |
| CI en push/PR | **Hecho** — `.github/workflows/ci.yml` |

**Priorizar tests en:** login/roles, importación masiva, `requiere_atencion`, filtros de seguimiento, upsert `(empresa, serie_folio)`.

### 5.4 Operaciones y despliegue — Prioridad media

| Problema | Detalle |
|----------|---------|
| Despliegue fragmentado | Netlify (front) + host aparte (API) + Supabase |
| Sin Dockerfile | Onboarding y reproducibilidad difíciles |
| Sin README raíz | Setup no documentado en un solo lugar |
| `frontend/README.md` | Plantilla Vite genérica |
| Progreso importación en memoria (`Map`) | Se pierde al reiniciar API (parcialmente mitigado con `EN_PROCESO` → `FALLIDA`) |

### 5.5 Mantenibilidad — Prioridad media

Archivos que concentran demasiada lógica:

| Archivo | ~Líneas | Riesgo |
|---------|---------|--------|
| `frontend/src/pages/reporte/ReportePage.jsx` | ~1 900 | UI + estado + queries mezclados |
| `frontend/src/pages/seguimiento/SeguimientoPage.jsx` | ~1 100 | Idem |
| `api/src/routes/importacionesRoutes.js` | ~1 100 | Toda la importación en un router |
| `frontend/src/services/seguimientoApi.js` | ~900 | Queries PostgREST concentradas |
| `frontend/src/lib/importacionReporte.js` | ~720 | Duplica API |

- **JavaScript sin TypeScript** en front y API.
- **Sin OpenAPI / Zod** para contratos HTTP.
- **`cartera_global_4_(1).html`** en raíz del repo — artefacto ajeno; eliminar o mover fuera del repo.

---

## 6. Matriz de prioridades actualizada

| Prioridad | Tema | Estado |
|-----------|------|--------|
| P0 | RLS + revocar `anon` en `usuarios` | **Hecho** |
| P0 | UNIQUE + CHECKs + índices críticos | **Hecho** |
| P1 | Unificar acceso a datos (API vs Supabase) | **Hecho** — front Supabase-only; ver [arquitectura.md](arquitectura.md) |
| P1 | Tests en importación, auth, seguimiento | **Hecho** — `api/test/` + módulos `shared/` |
| P1 | CI mínimo (lint + test + build) | **Hecho** — `.github/workflows/ci.yml` |
| P1 | README de proyecto + onboarding | **Hecho** — [README.md](../README.md) |
| P2 | Endurecer API (CORS, rate limit, helmet) | **Parcial** — CORS hecho; rate limit y helmet pendientes |
| P2 | Refactor páginas/servicios monolíticos | Pendiente |
| P2 | Migración demo anon sustituida por revocación | **Hecho** |
| P3 | TypeScript gradual | Pendiente |
| P3 | Storage documentos + políticas | Pendiente si hay adjuntos |
| P3 | WhatsApp en servicio aislado | Pendiente |

---

## 7. Roadmap sugerido

### Fase 1 — Estabilizar (1–2 semanas)

1. ~~README raíz~~ — [README.md](../README.md)
2. ~~GitHub Action~~ — `.github/workflows/ci.yml`
3. ~~Migración demo anon~~ — sustituida por revocación en repo.
4. [Checklist manual por rol](checklist-pruebas-manuales.md) — ejecutar tras deploys.

### Fase 2 — Reducir deuda (2–4 semanas)

1. Decidir stack canónico (recomendado: **Supabase + RLS** ya listo; API solo para WhatsApp, importación pesada o tareas batch).
2. Tests automatizados: importación, auth, `requiere_atencion`.
3. CORS restrictivo + rate limit en login.

### Fase 3 — Mantenibilidad (continuo)

1. Dividir `ReportePage` y `importacionesRoutes`.
2. TypeScript en servicios API críticos.
3. Storage adjuntos si aplica.

---

## 8. Referencias rápidas

| Tema | Ubicación |
|------|-----------|
| Reglas de negocio | [`docs/reglas-negocio.md`](reglas-negocio.md) |
| Legacy Django | [`guia.txt`](../guia.txt) |
| Migraciones Supabase | [`supabase/migrations/`](../supabase/migrations/) |
| Variables entorno API | [`api/.env.example`](../api/.env.example) |
| Variables entorno front | [`frontend/.env.example`](../frontend/.env.example) |
| Despliegue Netlify | [`netlify.toml`](../netlify.toml) |

---

*Actualizar este documento cuando cambien decisiones de arquitectura o se cierren ítems del roadmap.*
