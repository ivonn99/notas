# Tablas Creadas en Neon - Explicación

## ❌ NO son tablas de prueba

Las tablas que se crearon son **tablas del sistema de Django**. Son necesarias para que Django funcione correctamente.

---

## 📋 Tablas del Sistema de Django

### 1. Sistema de Autenticación (`auth_*`)

| Tabla | Propósito |
|-------|-----------|
| `auth_user` | Almacena los usuarios del sistema |
| `auth_group` | Grupos de usuarios (roles) |
| `auth_permission` | Permisos del sistema |
| `auth_user_groups` | Relación usuarios-grupos |
| `auth_user_user_permissions` | Permisos específicos por usuario |

**Uso**: Cuando crees usuarios, superusuarios, o implementes login, estas tablas se usarán.

---

### 2. Panel de Administración (`django_admin_*`)

| Tabla | Propósito |
|-------|-----------|
| `django_admin_log` | Registra todas las acciones en el panel de admin |

**Uso**: Cuando uses `python manage.py createsuperuser` y accedas a `/admin/`, esta tabla registrará tus acciones.

---

### 3. Sistema de Contenido (`django_content_*`)

| Tabla | Propósito |
|-------|-----------|
| `django_content_type` | Tipos de contenido (modelos) del sistema |

**Uso**: Django usa esto para relacionar permisos con modelos específicos.

---

### 4. Sistema de Migraciones (`django_migrations`)

| Tabla | Propósito |
|-------|-----------|
| `django_migrations` | Registra qué migraciones se han aplicado |

**Uso**: Django usa esto para saber qué migraciones ya se ejecutaron y cuáles faltan.

---

### 5. Sistema de Sesiones (`django_session`)

| Tabla | Propósito |
|-------|-----------|
| `django_session` | Almacena las sesiones de los usuarios |

**Uso**: Cuando un usuario inicia sesión, Django guarda la sesión aquí.

---

## ✅ ¿Cuándo se crean tus propias tablas?

Las tablas que **TÚ** crees aparecerán cuando:

1. **Crees modelos** en tus aplicaciones Django
2. **Ejecutes migraciones** con `python manage.py makemigrations` y `python manage.py migrate`

### Ejemplo:

Si creas un modelo como este:

```python
# pagina/models.py
from django.db import models

class NotaCredito(models.Model):
    numero = models.CharField(max_length=50)
    fecha = models.DateField()
    monto = models.DecimalField(max_digits=10, decimal_places=2)
```

Y ejecutas:
```bash
python manage.py makemigrations
python manage.py migrate
```

Se creará la tabla `pagina_notacredito` en Neon.

---

## 📊 Resumen

| Tipo | Tablas | Estado |
|------|--------|--------|
| **Sistema Django** | 10 tablas | ✅ Creadas (necesarias) |
| **Tus modelos** | 0 tablas | ⏳ Se crearán cuando definas modelos |

---

## 🎯 Próximos Pasos

Para crear **tus propias tablas**:

1. Crea modelos en `pagina/models.py`
2. Ejecuta `python manage.py makemigrations`
3. Ejecuta `python manage.py migrate`
4. Verifica con `python verificar_neon.py`

Las tablas del sistema siempre estarán ahí, y se agregarán las tuyas cuando las definas.




