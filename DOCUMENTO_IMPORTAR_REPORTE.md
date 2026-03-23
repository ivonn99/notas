# 📋 Documento de Trabajo: Importar Reporte

## 📌 Propósito

La sección **"Importar Reporte"** permite cargar periódicamente los reportes de deudas generados por el punto de venta (PV) al sistema de gestión de notas de crédito. Esta funcionalidad es fundamental para mantener actualizada la base de datos con el estado real de las deudas.

---

## 🔄 Flujo de Trabajo Esperado

### 1. **Frecuencia de Importación**
- Los reportes se suben **cada cierto tiempo** (periódicamente)
- Cada importación representa un "snapshot" del estado actual de las deudas en el punto de venta

### 2. **Proceso de Importación**

#### **Paso 1: Validación de Ruta**
- ✅ **YA IMPLEMENTADO**: Antes de subir a la base de datos, el sistema verifica que la ruta exista en el catálogo de rutas
- Si la ruta no existe, el registro se marca como error y se registra en las observaciones

#### **Paso 2: Identificación Única**
- ✅ **YA IMPLEMENTADO**: El identificador único es la combinación **`empresa + serie_folio`**
- **Razón**: Puede haber folios duplicados porque pertenecen a dos empresas distintas
- Ejemplo:
  - `DISTRIBUIDORA + NC-001-2024` ≠ `RODRIGO + NC-001-2024`
  - Son dos notas diferentes aunque tengan el mismo folio

#### **Paso 3: Procesamiento de Registros**

**A) Registro Nuevo:**
- Si `empresa + serie_folio` no existe en la base de datos → Se crea como nueva nota
- Estado inicial: `PENDIENTE`
- Si `saldo <= 0` → Se marca automáticamente como `RESUELTA` con `resuelta_automaticamente = True`

**B) Registro Existente:**
- Si `empresa + serie_folio` ya existe → Se actualiza con los nuevos datos del reporte
- Se actualizan: `fecha_corriente`, `monto`, `abono`, `saldo`, `cliente`, `ruta`, etc.
- Si `saldo <= 0` y estaba `PENDIENTE` → Se marca como `RESUELTA` automáticamente

---

## 🎯 Lógica de Resolución Automática

### **Registro que Desaparece del Reporte**

**Situación:**
- Una nota de crédito estaba en el reporte anterior
- En el nuevo reporte **NO aparece**

**Interpretación:**
- ✅ **La deuda fue resuelta/pagada**
- La nota ya no está pendiente en el punto de venta

**Acción Implementada:**
- ✅ **IMPLEMENTADO**: El sistema detecta automáticamente estas notas y las marca como resueltas
- Cambiar estado de `PENDIENTE` → `RESUELTA`
- Marcar `resuelta_automaticamente = True`
- Registrar `fecha_resolucion = fecha de la importación actual`
- Se registra en las observaciones de la importación

### **Registro que Reaparece en el Reporte**

**Situación:**
- Una nota de crédito estaba resuelta (no aparecía en reportes anteriores)
- En el nuevo reporte **VUELVE A APARECER**

**Interpretación:**
- ⚠️ **La deuda NO se resolvió completamente**
- Hubo algún problema o la resolución fue incorrecta
- La nota sigue pendiente en el punto de venta

**Acción Implementada:**
- ✅ **IMPLEMENTADO**: El sistema detecta automáticamente estas notas y las reactiva
- Cambiar estado de `RESUELTA` → `PENDIENTE` (solo si fue resuelta automáticamente)
- Limpiar `fecha_resolucion` y `resuelta_automaticamente = False`
- Actualizar con los nuevos datos del reporte
- Se registra en las observaciones de la importación

---

## 📊 Campos del Reporte

### **Columnas Esperadas del Archivo CSV/Excel:**

| Columna | Descripción | Requerido | Ejemplo |
|---------|-------------|-----------|---------|
| `FECHA NOTA` | Fecha de creación de la nota en el PV | ✅ Sí | `2024-01-15` |
| `FECHA CORRIENTE` | Fecha actual del reporte | ✅ Sí | `2024-01-23` |
| `SERIE/FOLIO` | Identificador único de la nota | ✅ Sí | `NC-001-2024` |
| `CLIENTE` | Nombre del cliente | ✅ Sí | `Juan Pérez` |
| `RUTAS` | Código de la ruta | ✅ Sí | `DR201` |
| `USUARIO/VENDEDOR` | Valor interno del PV (ej: "PERSONA_1") | ❌ No | `PERSONA_1` |
| `MONTO` | Monto total de la nota | ✅ Sí | `5000.00` |
| `ABONO` | Monto abonado | ✅ Sí | `2000.00` |
| `SALDO` | Saldo pendiente | ✅ Sí | `3000.00` |
| `DIAS` | Días de antigüedad | ❌ No | `30` |
| `EMPRESA` | Empresa (DISTRIBUIDORA o RODRIGO) | ✅ Sí | `DISTRIBUIDORA` |

---

## ✅ Funcionalidades Ya Implementadas

1. ✅ **Validación de formato de archivo** (CSV, TSV, Excel)
2. ✅ **Validación de existencia de ruta** antes de procesar
3. ✅ **Identificador único: empresa + serie_folio**
4. ✅ **Creación de notas nuevas**
5. ✅ **Actualización de notas existentes**
6. ✅ **Resolución automática cuando saldo <= 0**
7. ✅ **Registro de importaciones en historial**
8. ✅ **Manejo de errores y observaciones**
9. ✅ **Archivo de muestra descargable**

---

## ⚠️ Funcionalidades Pendientes de Implementar

### **1. Detección de Notas Desaparecidas** ✅ IMPLEMENTADO

**Lógica Implementada:**
```
Al importar un nuevo reporte:
1. Durante el procesamiento, se crea un set con todas las combinaciones (empresa, serie_folio) del reporte
2. Después de procesar todos los registros, se obtienen todas las notas PENDIENTE de la base de datos
3. Se compara cada nota PENDIENTE con el set del reporte
4. Si una nota PENDIENTE no aparece en el nuevo reporte:
   → Marcar como RESUELTA automáticamente
   → Establecer resuelta_automaticamente = True
   → Registrar fecha_resolucion = fecha actual
   → Incrementar contador registros_desaparecidos
```

**Consideraciones:**
- ✅ Solo aplica a notas con estado `PENDIENTE`
- ✅ No afecta notas ya resueltas manualmente
- ✅ Se registra en las observaciones de la importación
- ✅ Se muestra en el mensaje de éxito

### **2. Detección de Notas Reaparecidas** ✅ IMPLEMENTADO

**Lógica Implementada:**
```
Al importar un nuevo reporte:
1. Cuando se procesa un registro del reporte y se encuentra una nota existente:
2. Si la nota está RESUELTA y resuelta_automaticamente = True:
   → Cambiar estado a PENDIENTE
   → Limpiar resuelta_automaticamente = False
   → Limpiar fecha_resolucion = None
   → Incrementar contador registros_reaparecidos
3. Luego se actualiza con los nuevos datos del reporte
```

**Consideraciones:**
- ✅ Solo reactiva notas resueltas automáticamente
- ✅ No reactiva notas resueltas manualmente por usuarios
- ✅ Se registra en las observaciones de la importación
- ✅ Se muestra en el mensaje de éxito

---

## 📈 Métricas y Estadísticas

### **Registros de Importación:**

Cada importación registra:
- `total_registros`: Total de filas en el archivo
- `registros_nuevos`: Notas creadas por primera vez
- `registros_actualizados`: Notas existentes actualizadas
- `registros_resueltos`: Notas marcadas como resueltas (saldo = 0)
- `registros_desaparecidos`: ✅ **IMPLEMENTADO** - Notas que desaparecieron del reporte (se registran en observaciones)
- `registros_reaparecidos`: ✅ **IMPLEMENTADO** - Notas que volvieron a aparecer (se registran en observaciones)

---

## 🔍 Casos de Uso

### **Caso 1: Primera Importación**
- Se sube el primer reporte
- Todas las notas son nuevas
- Se crean en estado `PENDIENTE`

### **Caso 2: Importación Periódica Normal**
- Se sube un nuevo reporte
- Algunas notas se actualizan (cambios en saldo, abono, etc.)
- Algunas notas nuevas aparecen
- Algunas notas desaparecen → Deben marcarse como resueltas

### **Caso 3: Nota Pagada Completamente**
- Una nota tenía saldo pendiente
- En el nuevo reporte aparece con `saldo = 0`
- Se marca automáticamente como `RESUELTA`

### **Caso 4: Nota que Desaparece**
- Una nota estaba en reportes anteriores
- No aparece en el nuevo reporte
- Se marca automáticamente como `RESUELTA` (deuda pagada)

### **Caso 5: Nota que Reaparece**
- Una nota estaba resuelta (no aparecía en reportes)
- Vuelve a aparecer en el nuevo reporte
- Se reactiva a estado `PENDIENTE` (deuda no resuelta)

---

## 🛠️ Mejoras Sugeridas

1. **Validación de Integridad:**
   - Verificar que `SALDO = MONTO - ABONO` en el archivo
   - Alertar si hay discrepancias

2. **Reporte de Cambios:**
   - Generar un resumen de cambios entre importaciones
   - Mostrar qué notas se resolvieron, reactivaron, etc.

3. **Validación de Empresa:**
   - Verificar que `EMPRESA` solo contenga valores válidos: `DISTRIBUIDORA` o `RODRIGO`
   - ✅ **YA IMPLEMENTADO**: Constraint en base de datos

4. **Historial de Cambios:**
   - Registrar en `historial_notas` cuando una nota cambia de estado automáticamente
   - Incluir referencia a la importación que causó el cambio

---

## 📝 Notas Técnicas

### **Identificador Único:**
- **Constraint en BD**: `UNIQUE(empresa, serie_folio)`
- **Índice**: `idx_notas_empresa_serie` para búsquedas rápidas

### **Estados de Nota:**
- `PENDIENTE`: Nota activa con saldo pendiente
- `EN_PROCESO`: Nota en proceso de resolución
- `ACLARADA`: Nota con aclaración pendiente
- `RESUELTA`: Nota resuelta (saldo = 0 o desapareció del reporte)
- `CANCELADA`: Nota cancelada manualmente

### **Campo `resuelta_automaticamente`:**
- `True`: Resuelta por el sistema (saldo = 0 o desapareció)
- `False`: Resuelta manualmente por un usuario

---

## ✅ Checklist de Implementación

- [x] Validación de formato de archivo
- [x] Validación de existencia de ruta
- [x] Identificador único: empresa + serie_folio
- [x] Creación de notas nuevas
- [x] Actualización de notas existentes
- [x] Resolución automática cuando saldo <= 0
- [x] **Detección de notas desaparecidas** ✅
- [x] **Detección de notas reaparecidas** ✅
- [x] Registro de notas desaparecidas en observaciones ✅
- [x] Registro de notas reaparecidas en observaciones ✅
- [ ] Historial de cambios automáticos (mejora futura)

---

## 📞 Contacto y Soporte

Para dudas o mejoras sobre esta funcionalidad, contactar al equipo de desarrollo.

**Última actualización:** 24 de enero de 2026

