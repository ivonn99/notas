# Configuración de Neon con Django

## ¿Qué es Neon?

Neon es un **PostgreSQL serverless** en la nube. Es perfecto para Django porque:
- ✅ Django tiene soporte nativo para PostgreSQL
- ✅ Plan gratuito generoso
- ✅ Auto-scaling automático
- ✅ Branching de bases de datos (como Git)
- ✅ Sin problemas de compatibilidad

---

## Requisitos

### 1. Cuenta en Neon
- Crear cuenta gratuita en: https://neon.tech
- No requiere tarjeta de crédito para el plan gratuito

### 2. Paquete Python
- `psycopg2-binary` o `psycopg2` (driver de PostgreSQL para Python)

### 3. Variables de Entorno
- URL de conexión de Neon (se obtiene del dashboard)
- Contraseña de la base de datos

---

## Pasos para Configurar Neon

### Paso 1: Crear cuenta y proyecto en Neon

1. Ve a https://neon.tech
2. Crea una cuenta (puedes usar GitHub, Google, etc.)
3. Crea un nuevo proyecto
4. Elige la región más cercana a ti
5. Selecciona PostgreSQL (versión más reciente)

### Paso 2: Obtener la URL de conexión

En el dashboard de Neon:

1. Ve a tu proyecto
2. Busca la sección **"Connection Details"** o **"Connection String"**
3. Copia la **Connection String** que se ve así:
   ```
   postgresql://usuario:contraseña@ep-xxxx-xxxx.region.aws.neon.tech/nombre_db?sslmode=require
   ```

   O también puedes obtener los datos individuales:
   - **Host**: `ep-xxxx-xxxx.region.aws.neon.tech`
   - **Database**: nombre de tu base de datos
   - **User**: usuario
   - **Password**: contraseña (la puedes resetear si es necesario)
   - **Port**: 5432 (por defecto)

### Paso 3: Configurar en Django

#### 3.1. Instalar el driver de PostgreSQL

```bash
pip install psycopg2-binary
```

#### 3.2. Agregar al archivo `.env`

Crea o actualiza tu archivo `.env`:

```env
# Neon PostgreSQL
NEON_DATABASE_URL=postgresql://usuario:contraseña@ep-xxxx-xxxx.region.aws.neon.tech/nombre_db?sslmode=require

# O usar variables individuales:
NEON_DB_HOST=ep-xxxx-xxxx.region.aws.neon.tech
NEON_DB_NAME=nombre_db
NEON_DB_USER=usuario
NEON_DB_PASSWORD=contraseña
NEON_DB_PORT=5432
```

#### 3.3. Actualizar `settings.py`

Django puede usar la URL completa o las variables individuales.

---

---

## Plan Gratuito de Neon

- ✅ 0.5 GB de almacenamiento
- ✅ 1 proyecto
- ✅ Branching de bases de datos
- ✅ Sin límite de tiempo
- ✅ Perfecto para desarrollo y proyectos pequeños

---

## Próximos Pasos

Una vez que tengas la URL de conexión de Neon, puedo ayudarte a:
1. Actualizar `requirements.txt`
2. Configurar `settings.py` para usar Neon
3. Ejecutar las migraciones
4. Probar la conexión

¿Tienes ya una cuenta en Neon o necesitas ayuda para crearla?

