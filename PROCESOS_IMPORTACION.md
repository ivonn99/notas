# PROCESOS REALIZADOS AL IMPORTAR UN ARCHIVO

Este documento detalla todos los procesos que se ejecutan cuando se importa un archivo (CSV, TSV o Excel) en el sistema de Notas de Crédito.

---

## FASE 1: VALIDACIÓN Y LECTURA DEL ARCHIVO (0% - 15%)

### 1.1. Validación del Formulario (0%)
- Se valida que el formulario contenga un archivo
- Se verifica que el archivo no esté vacío

### 1.2. Detección del Formato (5%)
- Se detecta automáticamente el formato del archivo:
  - **CSV**: Archivos con extensión `.csv` o delimitador `,`
  - **TSV**: Archivos con extensión `.tsv` o delimitador `\t` (tabulador)
  - **Excel**: Archivos con extensión `.xlsx`, `.xls`
- Si el formato no es reconocido, se detiene el proceso y se registra un error

### 1.3. Lectura del Archivo (15%)
- Según el formato detectado, se lee el archivo:
  - **CSV/TSV**: Se lee línea por línea usando el delimitador correspondiente
  - **Excel**: Se lee usando la librería `openpyxl` o `pandas`
- Se extraen todas las filas de datos (excluyendo la fila de encabezados)
- Se cuenta el total de registros encontrados
- Si el archivo está vacío o no contiene datos válidos, se detiene el proceso

---

## FASE 2: PROCESAMIENTO Y MAPEO DE DATOS (25%)

### 2.1. Mapeo de Columnas (25%)
- Se define un diccionario de mapeo que relaciona los nombres de columnas del archivo con los campos del sistema:
  - `empresa` → ['empresa', 'company', 'compania', 'emp']
  - `serie_folio` → ['serie/folio', 'serie_folio', 'serie folio', 'serie-folio', 'folio', 'serie', 'numero', 'no', 'nro']
  - `fecha_nota` → ['fecha nota', 'fecha_nota', 'fecha', 'fecha_nota_credito', 'fecha de nota']
  - `fecha_corriente` → ['fecha corriente', 'fecha_corriente', 'fecha actual']
  - `cliente` → ['cliente', 'customer', 'cliente_nombre', 'nombre_cliente']
  - `ruta_codigo` → ['rutas', 'ruta', 'ruta_codigo', 'codigo_ruta', 'ruta codigo', 'codigo de ruta']
  - `usuario_vendedor_pv` → ['usuario/vendedor', 'usuario_vendedor', 'usuario_vendedor_pv', 'vendedor_pv']
  - `monto` → ['monto', 'amount', 'total', 'importe', 'valor']
  - `abono` → ['abono', 'payment', 'pago', 'pagado']
  - `saldo` → ['saldo', 'balance', 'restante']
  - `dias` → ['dias', 'days', 'días']

### 2.2. Procesamiento de Datos
- Se recorre cada fila del archivo
- Se buscan las columnas por nombre (insensible a mayúsculas/minúsculas)
- Se normalizan los valores:
  - Se eliminan espacios en blanco al inicio y final
  - Se convierten fechas a formato `date`
  - Se convierten montos a formato `Decimal`
  - Se valida que los campos requeridos no estén vacíos
- Se crea un diccionario por cada registro con los datos normalizados
- Se registran errores de parseo si alguna fila no se puede procesar

---

## FASE 3: PRECARGA DE DATOS (40%)

### 3.1. Precarga de Rutas Activas (40%)
- Se consultan todas las rutas activas de la base de datos
- Se crea un diccionario en memoria: `{codigo_ruta: objeto_ruta}`
- Esto evita consultas individuales a la base de datos por cada registro
- **Optimización**: Reduce drásticamente el número de consultas SQL

### 3.2. Precarga de Notas Existentes (40%)
- Se extraen todas las combinaciones únicas de `(empresa, serie_folio)` del archivo
- Se agrupan por empresa para optimizar las consultas
- Se consultan todas las notas existentes que coincidan con estas combinaciones
- Se crea un diccionario en memoria: `{(empresa, serie_folio): objeto_nota}`
- **Optimización**: Evita consultas individuales por cada registro durante el procesamiento

---

## FASE 4: PROCESAMIENTO DE REGISTROS EN LOTES (40% - 80%)

### 4.1. División en Lotes
- Los registros se dividen en lotes de **150 registros** cada uno
- Esto permite actualizar el progreso en tiempo real y procesar de forma eficiente

### 4.2. Procesamiento de Cada Lote
Para cada lote, se ejecuta dentro de una **transacción atómica** (si falla, se revierte todo):

#### 4.2.1. Validación de Campos Requeridos
- Se valida que `empresa` y `serie_folio` no estén vacíos
- Si faltan, se registra un error y se continúa con el siguiente registro

#### 4.2.2. Validación de Ruta
- Se busca la ruta en el diccionario precargado usando el código de ruta
- Se valida que la ruta exista y esté activa
- Si no existe o está inactiva, se registra un error y se continúa

#### 4.2.3. Conversión de Fechas
- Se convierte `fecha_nota` a formato `date`
- Se convierte `fecha_corriente` a formato `date` (si viene del PV) o se usa la fecha actual
- Si la conversión falla, se usa la fecha actual como valor por defecto

#### 4.2.4. Conversión de Montos
- Se convierten `monto` y `abono` a formato `Decimal`
- Se calcula `saldo = monto - abono`
- Se valida que el monto sea mayor a cero
- Si el monto es cero o negativo, se registra un error y se continúa

#### 4.2.5. Normalización de Datos Adicionales
- Se normaliza el nombre del `cliente` (si está vacío, se usa "Sin nombre")
- Se normaliza `usuario_vendedor_pv` (valor interno del PV, no relacionado con usuarios del sistema)

#### 4.2.6. Verificación de Nota Existente
- Se busca la nota en el diccionario precargado usando `(empresa, serie_folio)` como clave
- **Si la nota EXISTE**:
  - Se actualizan todos los campos: fechas, cliente, ruta, montos, saldo
  - Se determina el nuevo estado:
    - Si `saldo <= 0`: Se marca como `RESUELTA` automáticamente
    - Si `saldo > 0` y estaba `RESUELTA` o `CANCELADA`: Se reactiva a `PENDIENTE` (nota reaparecida)
    - Si ya estaba `PENDIENTE`: Se mantiene pendiente
  - Se agrega a la lista `notas_a_actualizar` para bulk update
  - Se incrementa el contador de `registros_actualizados` o `registros_reaparecidos`
- **Si la nota NO EXISTE**:
  - Se crea un nuevo objeto `NotaCredito` con todos los datos
  - Si `saldo <= 0`, se marca como `RESUELTA` desde el inicio
  - Se agrega a la lista `notas_a_crear` para bulk create
  - Se incrementa el contador de `registros_nuevos` o `registros_resueltos`
  - Se agrega al diccionario de notas existentes para evitar duplicados

#### 4.2.7. Registro de Notas en el Reporte
- Se agrega `(empresa, serie_folio)` al conjunto `notas_en_reporte`
- Este conjunto se usa después para detectar notas desaparecidas

### 4.3. Guardado del Lote (Bulk Operations)
- Después de procesar cada lote, se guardan los datos usando operaciones masivas:
  - **`bulk_create()`**: Crea todas las notas nuevas del lote en una sola operación SQL
  - **`bulk_update()`**: Actualiza todas las notas modificadas del lote en una sola operación SQL
- Se limpian las listas para el siguiente lote
- **Optimización**: Reduce drásticamente el número de operaciones SQL

### 4.4. Actualización de Progreso
- Se actualiza el progreso en la sesión del usuario (40% a 80%)
- Se muestra: "Procesando registro X de Y"
- Se guarda la sesión para que el frontend pueda consultarlo
- Se agrega un pequeño delay (50ms) para permitir que el frontend capture el progreso

---

## FASE 5: DETECCIÓN DE NOTAS DESAPARECIDAS (80%)

### 5.1. Identificación de Empresas en el Reporte
- Se extraen todas las empresas únicas que aparecen en el archivo importado
- Esto permite limitar la búsqueda solo a notas de esas empresas

### 5.2. Búsqueda de Notas Pendientes
- Se consultan todas las notas con estado `PENDIENTE` de las empresas del reporte
- Se verifica si cada nota aparece en el conjunto `notas_en_reporte`

### 5.3. Marcado de Notas Desaparecidas
- Si una nota `PENDIENTE` NO aparece en el reporte actual:
  - Se marca como `RESUELTA` automáticamente
  - Se establece `resuelta_automaticamente = True`
  - Se establece `fecha_resolucion = ahora`
  - Se establece `requiere_atencion = False`
  - Se agrega a la lista para bulk update
  - Se incrementa el contador de `registros_desaparecidos`

### 5.4. Guardado Masivo
- Se actualizan todas las notas desaparecidas usando `bulk_update()` en una sola operación SQL

---

## FASE 6: FINALIZACIÓN Y REGISTRO (90% - 100%)

### 6.1. Determinación del Estado de Importación
- **COMPLETADA**: Si no hay errores
- **PARCIAL**: Si hay errores pero se procesaron algunos registros
- **FALLIDA**: Si no se procesó ningún registro

### 6.2. Preparación de Observaciones
- Se recopilan todos los errores de procesamiento (hasta 20 errores)
- Se agregan estadísticas:
  - Total de errores
  - Notas desaparecidas (resueltas automáticamente)
  - Notas reaparecidas (reactivadas)

### 6.3. Registro en Historial de Importaciones
- Se crea un registro en la tabla `Importacion` con:
  - Usuario que realizó la importación
  - Nombre del archivo
  - Total de registros procesados
  - Registros nuevos
  - Registros actualizados
  - Registros resueltos automáticamente
  - Registros desaparecidos
  - Registros reaparecidos
  - Estado de la importación (COMPLETADA/PARCIAL/FALLIDA)
  - Observaciones (errores y estadísticas)

### 6.4. Mensajes al Usuario
- Se muestra un mensaje de éxito con las estadísticas
- Si hay errores, se muestra un mensaje de advertencia con el total de errores

### 6.5. Actualización Final del Progreso
- Se marca el progreso como completado (100%)
- Se establece `completado = True` en la sesión

### 6.6. Respuesta al Frontend
- Si es una petición AJAX, se responde con JSON:
  - `success`: true/false
  - `message`: Mensaje descriptivo
  - `registros_nuevos`: Cantidad de notas nuevas
  - `registros_actualizados`: Cantidad de notas actualizadas
  - `registros_resueltos`: Cantidad de notas resueltas automáticamente
  - `registros_desaparecidos`: Cantidad de notas desaparecidas
  - `registros_reaparecidos`: Cantidad de notas reaparecidas
  - `total_registros`: Total de registros procesados
  - `errores`: Cantidad de errores encontrados

---

## RESUMEN DE OPTIMIZACIONES

1. **Precarga de Rutas**: Evita N consultas SQL (una por registro)
2. **Precarga de Notas Existentes**: Evita N consultas SQL (una por registro)
3. **Procesamiento en Lotes**: Permite actualizar progreso en tiempo real
4. **Bulk Operations**: Reduce operaciones SQL de N a ~2 por lote (create + update)
5. **Transacciones Atómicas**: Garantiza integridad de datos por lote
6. **Delays Controlados**: Permiten que el frontend capture el progreso sin ralentizar demasiado

---

## ESTADÍSTICAS REGISTRADAS

- **registros_nuevos**: Notas que no existían y se crearon
- **registros_actualizados**: Notas existentes que se actualizaron
- **registros_resueltos**: Notas que se marcaron como resueltas automáticamente (saldo = 0)
- **registros_desaparecidos**: Notas PENDIENTE que desaparecieron del reporte (resueltas automáticamente)
- **registros_reaparecidos**: Notas RESUELTA/CANCELADA que reaparecieron con saldo > 0 (reactivadas a PENDIENTE)

---

## MANEJO DE ERRORES

- Todos los errores se capturan y se registran en `errores_procesamiento`
- Los errores no detienen el proceso completo, solo se saltan los registros problemáticos
- Se muestran hasta 20 errores en las observaciones del historial
- Si hay más de 20 errores, se indica "y X errores más"

---

## IDENTIFICADOR ÚNICO

- El identificador único de una nota es la combinación: **`(empresa, serie_folio)`**
- Esto permite que el sistema maneje notas de diferentes empresas sin conflictos
- Si una nota de la empresa "DISTRIBUIDORA" tiene el mismo folio que una de "RODRIGO", se consideran notas diferentes




