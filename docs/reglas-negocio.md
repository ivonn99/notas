# Reglas de negocio — Notas de crédito

Documento de referencia para el stack actual (**React + Supabase / API Node**).  
Actualizado a partir de las decisiones de Seguimiento y filtros compartidos (2026).

Para arquitectura legacy Django y esquema general de BD, ver también [`guia.txt`](../guia.txt) en la raíz del repo.

---

## 1. Estados de una nota

| Estado      | Significado |
|-------------|-------------|
| `PENDIENTE` | Nota abierta; puede recibir comentarios y puede marcarse como que requiere atención. |
| `RESUELTA`  | Nota cerrada; conserva historial y comentarios, pero **no** requiere atención operativa. |
| `CANCELADA` | Nota anulada; mismo tratamiento que RESUELTA respecto a `requiere_atencion`. |

---

## 2. Dos conceptos distintos: comentarios vs requiere atención

| Concepto | Dónde vive | Qué significa |
|----------|------------|---------------|
| **Tiene comentarios** | Tabla `aclaraciones` (filas por nota) | Historial de comentarios / aclaraciones / seguimiento. Es independiente de la bandera operativa. |
| **Requiere atención** | Columna `notas_credito.requiere_atencion` (boolean) | Bandera operativa: “esta nota pendiente debe ser revisada por crédito/cobranza”. |

### Reglas clave

- Una nota **RESUELTA** puede seguir teniendo comentarios visibles (“Ver comentarios”), pero **no** cuenta como que requiere atención.
- En la UI (badge, columna, Excel, detalle), “requiere atención” = `requiere_atencion === true`, **no** “tiene filas en aclaraciones”.
- `requiere_atencion` solo tiene sentido operativo en notas **PENDIENTE**. En RESUELTA/CANCELADA debe estar en `false` (validado también en importación).

---

## 3. Cuándo cambia `requiere_atencion`

### Se activa (`true`)

- Al **agregar un comentario** en una nota en estado **PENDIENTE** (cualquier tipo: COMENTARIO, ACLARACION, SEGUIMIENTO).
- Comentar en una nota **RESUELTA** o **CANCELADA** **no** la reabre ni activa la bandera.
- En **importación masiva**, si el archivo trae `requiere_atencion = true` y la nota queda PENDIENTE (según validaciones del importador).

### Se apaga (`false`)

- Al **resolver manualmente** la nota (cambio de estado a RESUELTA o CANCELADA).
- En **importación masiva** cuando el proceso marca notas como resueltas automáticamente.
- Si el archivo de importación trae `requiere_atencion = false` en una fila válida.

### No se apaga

- Al **eliminar comentarios**. Borrar aclaraciones no modifica `requiere_atencion`; la nota sigue marcada hasta que alguien la resuelva (manual o importación).

---

## 4. Seguimiento — filtros

Los filtros de Seguimiento se persisten en el store compartido (`listFiltersStore`, clave `seguimiento`).

| Filtro | Comportamiento |
|--------|----------------|
| **Empresa** | DISTRIBUIDORA / RODRIGO. |
| **Estado** | PENDIENTE, RESUELTA, CANCELADA o vacío (todos). Valor inicial habitual: PENDIENTE. |
| **Atención** | Sí → `requiere_atencion = true`. No → `requiere_atencion = false`. Vacío → sin filtrar por bandera. |
| **Rutas** | Lista separada por comas (multiruta). Lookup **case-insensitive** por código de ruta. Solo aplica por este campo. |
| **Buscar (`q`)** | Texto libre (cliente, folio, etc.). **No** filtra por ruta; la ruta va solo en el campo Rutas. |
| **Antigüedad (`dias_bucket`)** | Tramos combinables (varios chips a la vez). Ver sección 5. |
| **Mostrar comentarios** | Preferencia de UI para expandir comentarios en el listado; no altera la lógica de `requiere_atencion`. |

### Resumen en pantalla

- **Total filtrado:** cantidad de notas que cumplen todos los filtros activos.
- **Requieren atención:** cantidad con `requiere_atencion = true` **dentro del mismo conjunto filtrado** (no es el total global del sistema).

### Visibilidad por rol

- **VENDEDOR:** solo ve notas de sus rutas asignadas (`usuario_rutas`). El filtro Rutas se limita a ese universo; si no elige rutas, aplican todas las asignadas.
- **CREDITO / ADMIN:** ven todas las rutas; pueden filtrar por una o varias.

---

## 5. Antigüedad (columna “Días” y tramos)

**Definición:** días = **hoy − `fecha_nota`** (misma lógica que Reporte).  
No se usa `fecha_corriente` para antigüedad ni para los tramos del filtro.

| ID tramo | Etiqueta | Rango (días desde `fecha_nota`) |
|----------|----------|----------------------------------|
| `r1` | 0–30 d | 0 a 30 |
| `r2` | 31–45 d | 31 a 45 |
| `r2b` | 46–60 d | 46 a 60 |
| `r3` | 61–90 d | 61 a 90 |
| `r4` | 91–180 d | 91 a 180 |
| `r5` | 181–365 d | 181 a 365 |
| `r6` | >365 d | más de 365 |

Los tramos son **combinables**: seleccionar varios chips equivale a un OR (nota en cualquiera de los tramos elegidos).

Implementación de rangos: `frontend/src/utils/diasBuckets.js`.

---

## 6. Seguimiento — ordenamiento

| Orden | Campo(s) |
|-------|----------|
| **Fecha nota — más antigua** (`fecha_nota_asc`) | **`fecha_nota` ASC** — **orden por defecto** |
| Fecha nota — más reciente (`fecha_nota_desc`) | `fecha_nota` DESC |
| Última actividad — más reciente (`fecha_ultima_desc`) | `fecha_ultima_actualizacion` DESC |
| Última actividad — más antigua (`fecha_ultima_asc`) | `fecha_ultima_actualizacion` ASC |
| Saldo — mayor / menor (`saldo_desc` / `saldo_asc`) | `saldo` |
| Cliente A→Z / Z→A (`cliente_asc` / `cliente_desc`) | `cliente` |

### Retirado

- **“Atención y última actividad”** (`default` / `atencion`): eliminado de Seguimiento.  
  Usuarios con ese valor guardado en el navegador se migran automáticamente a `fecha_nota_asc` (persistencia v7).

---

## 7. Todas las notas (listado general)

Pantalla distinta a Seguimiento, pero comparte store de filtros (`notas`).

- También usa `notaMuestraAtencion()` → `requiere_atencion`.
- Orden por defecto allí: `fecha_nota_desc` (más reciente primero).
- Sigue existiendo orden `atencion_desc` en este listado (prioriza `requiere_atencion` y luego última actualización).

---

## 8. Importación de reporte

- Columna opcional `requiere_atencion` (alias: `requiereatencion`, `atencion`).
- **Validación:** no puede importarse `requiere_atencion = true` si el estado es RESUELTA o CANCELADA.
- Resolución masiva por importación pone `requiere_atencion = false` en las notas afectadas.

---

## 9. Dónde está implementado (referencia rápida)

| Regla | Archivo principal |
|-------|-------------------|
| Badge / Excel “atención” | `frontend/src/utils/estadoBadge.js` |
| Filtros y listado Seguimiento | `frontend/src/services/seguimientoApi.js`, `api/src/routes/seguimientoRoutes.js` |
| Comentario → activar bandera | `postSeguimientoComentario*` en seguimientoApi / seguimientoRoutes |
| Resolver → apagar bandera | `postSeguimientoEstado*` |
| Eliminar comentario (sin tocar bandera) | `deleteSeguimientoComentario*` |
| Tramos de antigüedad | `frontend/src/utils/diasBuckets.js` |
| Filtros persistidos | `frontend/src/stores/listFiltersStore.js` |
| Validación importación | `frontend/src/lib/importacionReporte.js` |

---

## 10. Glosario

| Término | Definición |
|---------|------------|
| **Nota abierta** | `estado = PENDIENTE` |
| **Bandera de atención** | `requiere_atencion` en `notas_credito` |
| **Aclaración / comentario** | Fila en `aclaraciones` ligada a `nota_id` |
| **Tramo de antigüedad** | Bucket `r1`…`r6` según días desde `fecha_nota` |

---

## 11. Atraso estructural (composición de cartera)

Indicador **informativo** en Reporte → Indicadores. No bloquea operaciones en el sistema.

### Universo

- Notas `PENDIENTE` con `saldo > 0`.
- Agrupación por `cliente` (texto) dentro de la **empresa** activa.
- Respeta filtros de reporte: rutas, búsqueda (`q`), fechas. **No** usa el filtro de estado ni `dias_bucket` del listado (la composición define sus propios tramos).

### Tramos

| Tramo | Criterio (`días = hoy − fecha_nota`) |
|-------|-------------------------------------|
| **Cartera 0–30 d** | `días` entre 0 y 30 inclusive |
| **Cartera >30 d** | `días > 30`, o `fecha_nota` nula/inconsistente |

### Regla

Por cliente, con `saldo_total = saldo_0_30 + saldo_mas_30`:

```
atraso_estructural =
  saldo_mas_30 > saldo_0_30
  OR
  (saldo_mas_30 / saldo_total × 100) > umbral_pct
```

- **Umbral por defecto:** 50 %.
- **Parámetro opcional:** `cobranza_umbral_atraso_pct` en tabla `parametros` (1–100).

### Interpretación operativa

Si hay atraso estructural, la guía operativa es que el cliente **no debería recibir más producto**; la decisión final es humana.

El mismo criterio de composición (0–30 d vs >30 d) aplica **por ruta**: suma de saldos pendientes de todas las notas de la ruta.

### Dónde se muestra

| Vista | Contenido |
|-------|-----------|
| **Atraso estructural** (pestaña) | Tabla **por ruta** y tabla **por cliente** |
| **Indicadores** | KPIs generales, antigüedad, situación, etc. (sin atraso estructural) |

### Implementación

| Pieza | Archivo |
|-------|---------|
| Lógica compartida | `frontend/src/utils/atrasoEstructural.js` |
| API reporte | `api/src/routes/reportesRoutes.js` → `atrasoEstructural` |
| UI | `frontend/src/pages/reporte/ReportePage.jsx` (pestaña **Atraso estructural**) |

---

*Si cambian reglas de producto, actualizar este archivo en el mismo PR que el código.*
