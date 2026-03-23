# Explicación: Mapeo USUARIO/VENDEDOR

## 🔄 Cómo Funciona el Mapeo

### 1. **En el Archivo CSV (Punto de Venta)**
```
USUARIO/VENDEDOR
vendedor1
vendedor2
zoram
```

### 2. **En la Base de Datos**

#### Tabla `usuarios`:
| id (BIGINT) | username (VARCHAR) | nombre_completo | activo | rol |
|-------------|-------------------|-----------------|--------|-----|
| 1 | vendedor1 | Juan Pérez | true | VENDEDOR |
| 2 | vendedor2 | María García | true | VENDEDOR |
| 3 | zoram | Admin | true | ADMIN |

#### Tabla `notas_credito`:
| id | serie_folio | cliente | usuario_id (BIGINT) | ... |
|----|-------------|---------|---------------------|-----|
| 1 | NC-001 | Cliente A | 1 | ... |
| 2 | NC-002 | Cliente B | 2 | ... |
| 3 | NC-003 | Cliente C | NULL | ... |

### 3. **Proceso de Conversión**

```
CSV: "vendedor1" (username como texto)
    ↓
Sistema busca en tabla usuarios:
    SELECT * FROM usuarios WHERE username = 'vendedor1' AND activo = true
    ↓
Encuentra: id = 1, username = 'vendedor1'
    ↓
Guarda en notas_credito:
    INSERT INTO notas_credito (..., usuario_id) VALUES (..., 1)
```

## 📋 Flujo Completo

1. **Archivo CSV llega con:**
   - Columna: `USUARIO/VENDEDOR`
   - Valor: `"vendedor1"` (texto)

2. **Sistema procesa:**
   ```python
   usuario_username = "vendedor1"  # Del CSV
   usuario = Usuario.objects.get(username=usuario_username, activo=True)
   # usuario.id = 1 (BIGINT)
   ```

3. **Al crear/actualizar la nota:**
   ```python
   NotaCredito(
       ...
       usuario=usuario  # Django automáticamente usa usuario.id
   )
   ```

4. **En la base de datos:**
   - Campo `usuario_id` recibe el valor `1` (BIGINT)
   - Foreign Key constraint valida que existe en tabla `usuarios`

## ⚠️ Casos Especiales

### Caso 1: Usuario no existe
- **CSV tiene:** `"vendedor99"` (no existe)
- **Sistema:** Registra warning en logs
- **Resultado:** `usuario_id = NULL` (la nota se crea sin vendedor)

### Caso 2: Usuario inactivo
- **CSV tiene:** `"vendedor1"` (existe pero `activo = false`)
- **Sistema:** No lo encuentra (filtro `activo=True`)
- **Resultado:** `usuario_id = NULL`

### Caso 3: Campo vacío en CSV
- **CSV tiene:** `""` o `NULL` en USUARIO/VENDEDOR
- **Sistema:** No busca usuario
- **Resultado:** `usuario_id = NULL` (opcional)

## 🔍 Verificación

Para verificar que el mapeo funcionó correctamente:

```sql
-- Ver notas con sus vendedores asignados
SELECT 
    nc.serie_folio,
    nc.cliente,
    nc.usuario_id,
    u.username,
    u.nombre_completo
FROM notas_credito nc
LEFT JOIN usuarios u ON nc.usuario_id = u.id;
```

## ✅ Resumen

- **CSV trae:** Username (texto) → `"vendedor1"`
- **Sistema busca:** En tabla `usuarios` por `username`
- **Sistema obtiene:** ID numérico → `1`
- **BD guarda:** `usuario_id = 1` (BIGINT)
- **Foreign Key:** Valida que existe en `usuarios`

El campo `usuario_id` en `notas_credito` es **opcional** (puede ser NULL), por lo que si el usuario no se encuentra, la nota se crea igualmente sin vendedor asignado.




