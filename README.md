# Notas de crédito — DMH

Sistema web para gestión de **notas de crédito**, seguimiento, importación masiva, reportes y administración. Stack: **React 19 + Vite + Supabase (PostgreSQL + RLS + db-login-jwt)**; **API Node** solo para WhatsApp y lectura de logs de archivo.

Documentación adicional:

- [Reglas de negocio](docs/reglas-negocio.md)
- [Análisis del proyecto](docs/analisis-proyecto.md)
- [Arquitectura](docs/arquitectura.md)
- [Checklist de pruebas manuales](docs/checklist-pruebas-manuales.md)

---

## Requisitos

- **Node.js** 20+
- Proyecto **Supabase** con PostgreSQL
- (Producción) **Netlify** u otro host para el frontend
- (Opcional) Host para el API Node si usas WhatsApp o logs de archivo (`app.log`)

---

## Inicio rápido (local)

```bash
# Raíz del monorepo
npm install

# Variables de entorno
cp frontend/.env.example frontend/.env
cp api/.env.example api/.env
# Edita frontend/.env con VITE_SUPABASE_* (obligatorio)

# API + frontend juntos
npm run dev
```

- Frontend: http://localhost:5173  
- API: http://localhost:3001/api/health  

Con Supabase configurado, Vite hace proxy de `/api` al API Node para WhatsApp y `app.log`.

---

## Supabase + RLS (obligatorio)

El frontend **requiere** Supabase y habla con **PostgREST** usando JWT de la Edge Function **`db-login-jwt`**. La seguridad por filas (RLS) filtra por rol y rutas. Al arrancar, la app valida `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_SUPABASE_DB_LOGIN=true`.

### Frontend (`frontend/.env`)

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_SUPABASE_DB_LOGIN=true
```

### Supabase

1. Desplegar Edge Functions: `db-login-jwt`, `db-change-own-password` (+ admin si aplica).
2. Secret **`JWT_SECRET`** en Edge = JWT Secret del proyecto (Settings → API).
3. Aplicar RLS: [`supabase/scripts/aplicar-rls-completo.sql`](supabase/scripts/aplicar-rls-completo.sql) (si partes de cero).
4. Verificar: [`supabase/scripts/verificar-configuracion-bd.sql`](supabase/scripts/verificar-configuracion-bd.sql) → **V.11 todo OK**.

### API Node (`api/.env`) — complementario

- WhatsApp (Baileys)
- Lectura de `api/logs/app.log` desde la pantalla Logs (opcional)
- Desarrollo local con `npm run dev` en monorepo

```env
SUPABASE_DB_URL=postgresql://...
JWT_SECRET=...   # mismo valor que en Supabase Edge
# Producción (Netlify → API en otro host):
CORS_ORIGINS=https://tu-app.netlify.app,https://*.netlify.app
```

---

## Despliegue

| Componente | Dónde | Notas |
|------------|-------|-------|
| Frontend | Netlify | Ver [`netlify.toml`](netlify.toml); variables `VITE_*` en build |
| API | Render, Railway, VPS… | `SUPABASE_DB_URL`, `JWT_SECRET`, `CORS_ORIGINS` |
| BD + Auth | Supabase | RLS, Edge Functions, scripts en `supabase/scripts/` |

En Netlify, configura **`VITE_SUPABASE_URL`**, **`VITE_SUPABASE_ANON_KEY`**, **`VITE_SUPABASE_DB_LOGIN=true`** y redeploy.

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | API + frontend en paralelo |
| `npm run dev:api` | Solo API (:3001) |
| `npm run dev:web` | Solo Vite |
| `npm test` | Tests del API + módulos `shared/` |
| `npm run lint` | ESLint del frontend |
| `npm run build` | Build de producción del frontend |

---

## Estructura

```
frontend/          React + Vite
api/               Express + PostgreSQL
shared/            Reglas de negocio compartidas (importación, notas)
supabase/          Migraciones, Edge Functions, scripts SQL
docs/              Reglas de negocio, análisis, arquitectura
```

---

## Tests y CI

```bash
npm test              # api/test/*.test.js
npm run lint --prefix frontend
npm run build --prefix frontend
```

GitHub Actions ejecuta lint, test y build en cada push/PR (`.github/workflows/ci.yml`).

---

## Roles

| Rol | Acceso habitual |
|-----|-----------------|
| `VENDEDOR` | Notas de sus rutas; comentarios |
| `CREDITO` | Todas las notas; panel admin |
| `ADMIN` | Igual que crédito + operaciones restringidas |

Ver [checklist de pruebas](docs/checklist-pruebas-manuales.md).

---

## Mantenimiento BD

Ejecutar periódicamente en Supabase SQL Editor:

[`supabase/scripts/verificar-configuracion-bd.sql`](supabase/scripts/verificar-configuracion-bd.sql)

---

## Licencia

Proyecto privado — DMH / uso interno.
