# Guía Rápida: Configurar Neon en 5 minutos

## Paso 1: Crear cuenta en Neon (2 min)

1. Ve a https://neon.tech
2. Haz clic en "Sign Up" (puedes usar GitHub, Google, etc.)
3. Crea un nuevo proyecto
4. Elige un nombre para tu proyecto (ej: "notas-de-credito")
5. Selecciona la región más cercana

## Paso 2: Obtener la URL de conexión (1 min)

En el dashboard de Neon:

1. Ve a tu proyecto
2. Busca **"Connection Details"** o **"Connection String"**
3. Haz clic en **"Copy connection string"**
4. La URL se ve así:
   ```
   postgresql://usuario:contraseña@ep-xxxx-xxxx.region.aws.neon.tech/nombre_db?sslmode=require
   ```

## Paso 3: Configurar en tu proyecto (2 min)

### 3.1. Instalar dependencias

```bash
pip install -r requirements.txt
```

### 3.2. Agregar al archivo `.env`

Abre tu archivo `.env` y agrega:

```env
# Neon PostgreSQL (usa la URL completa que copiaste)
NEON_DATABASE_URL=postgresql://usuario:contraseña@ep-xxxx-xxxx.region.aws.neon.tech/nombre_db?sslmode=require
```

**¡Importante!** Reemplaza `usuario`, `contraseña`, `ep-xxxx-xxxx`, `region` y `nombre_db` con los valores reales de tu Neon.

### 3.3. Ejecutar migraciones

```bash
python manage.py migrate
```

### 3.4. Probar la conexión

```bash
python manage.py check --database default
```

Si todo está bien, verás: `System check identified no issues`

## ✅ ¡Listo!

Tu proyecto Django ahora está usando Neon PostgreSQL.

---

## Alternativa: Usar variables individuales

Si prefieres usar variables separadas en lugar de la URL completa, agrega esto a `.env`:

```env
NEON_DB_HOST=ep-xxxx-xxxx.region.aws.neon.tech
NEON_DB_NAME=nombre_db
NEON_DB_USER=usuario
NEON_DB_PASSWORD=contraseña
NEON_DB_PORT=5432
```

---

## Solución de Problemas

### Error: "No module named 'psycopg2'"
```bash
pip install psycopg2-binary
```

### Error: "Connection refused"
- Verifica que la URL de conexión sea correcta
- Asegúrate de que `sslmode=require` esté en la URL

### Error: "Authentication failed"
- Verifica el usuario y contraseña
- Puedes resetear la contraseña en el dashboard de Neon

---

## ¿Necesitas ayuda?

Si tienes problemas, comparte:
1. El error exacto que ves
2. Si tienes la URL de conexión configurada
3. El resultado de `python manage.py check`




