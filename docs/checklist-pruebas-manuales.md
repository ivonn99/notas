# Checklist de pruebas manuales

Ejecutar tras cambios en auth, RLS, importación o seguimiento. Marcar con fecha y rol probado.

---

## Login

- [ ] Login con usuario **VENDEDOR** activo
- [ ] Login con usuario **CREDITO** activo
- [ ] Login con usuario **ADMIN** activo
- [ ] Usuario desactivado (`activo=false`) → rechazo
- [ ] Contraseña incorrecta → mensaje genérico (sin filtrar si existe usuario)
- [ ] Logout y vuelta a `/login`

---

## VENDEDOR

- [ ] **Seguimiento:** solo notas de rutas asignadas
- [ ] **Todas las notas:** mismo universo de rutas
- [ ] **Comentario** en nota PENDIENTE → `requiere_atencion = true`
- [ ] **Comentario** en nota RESUELTA → no reactiva atención
- [ ] **No** puede cambiar estado a RESUELTA/CANCELADA
- [ ] **No** accede a Usuarios / Importación / Parámetros

---

## CREDITO / ADMIN

- [ ] Ve **todas** las rutas en Seguimiento
- [ ] Filtro **Atención = Sí** muestra solo `requiere_atencion`
- [ ] **Cambio de estado** PENDIENTE → RESUELTA apaga `requiere_atencion`
- [ ] **Importación** CSV/Excel empresa DISTRIBUIDORA o RODRIGO
- [ ] Fila con `requiere_atencion=true` + RESUELTA → error de validación
- [ ] **Usuarios:** listar, editar, asignar rutas
- [ ] **Historial importaciones** refleja última carga

---

## Reporte

- [ ] KPIs cargan por empresa
- [ ] Pestaña **Atraso estructural** (CREDITO/ADMIN)
- [ ] Filtros rutas / búsqueda aplican

---

## API Node (si desplegado)

- [ ] `GET /api/health` → `{ status: 'ok' }`
- [ ] `GET /api/db/ping` → conexión BD
- [ ] WhatsApp status (si `WHATSAPP_MODE` ≠ disabled)

---

## Base de datos (periódico)

- [ ] Ejecutar [`verificar-configuracion-bd.sql`](../supabase/scripts/verificar-configuracion-bd.sql)
- [ ] **V.11** — todos los ítems en **OK**

---

## Regresión rápida post-deploy Netlify

- [ ] Login en URL de producción
- [ ] Seguimiento carga notas
- [ ] Una importación de prueba (archivo pequeño)

---

*Última revisión sugerida: tras cada deploy mayor o cambio en RLS / Edge Functions.*
