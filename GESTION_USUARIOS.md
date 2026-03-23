# Documentación: Gestión de Usuarios

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura General](#arquitectura-general)
3. [Modelo de Datos](#modelo-de-datos)
4. [Formularios](#formularios)
5. [Vistas y Lógica de Negocio](#vistas-y-lógica-de-negocio)
6. [Templates y Frontend](#templates-y-frontend)
7. [Seguridad y Permisos](#seguridad-y-permisos)
8. [Validación de Contraseñas](#validación-de-contraseñas)
9. [Flujos de Trabajo](#flujos-de-trabajo)
10. [Mensajes y Notificaciones](#mensajes-y-notificaciones)
11. [Logs y Debugging](#logs-y-debugging)
12. [Configuración](#configuración)
13. [Ejemplos de Uso](#ejemplos-de-uso)

---

## Introducción

El sistema de gestión de usuarios permite a los administradores crear, editar, activar/desactivar y eliminar usuarios del sistema. Está diseñado con un enfoque en seguridad, usabilidad y trazabilidad mediante logs detallados.

### Características Principales

- ✅ Creación de usuarios con validación de contraseñas
- ✅ Edición de información de usuarios
- ✅ Activación/Desactivación de usuarios
- ✅ Eliminación de usuarios con confirmación
- ✅ Control de acceso basado en roles
- ✅ Validación de contraseñas (mínimo 4 caracteres)
- ✅ Prevención de auto-eliminación y auto-desactivación
- ✅ Mensajes informativos con SweetAlert2
- ✅ Logs detallados para debugging

---

## Arquitectura General

```
┌─────────────────┐
│   Template      │  (usuarios.html)
│   (Frontend)    │
└────────┬────────┘
         │
         │ POST/GET
         ▼
┌─────────────────┐
│     Views       │  (views.py)
│   (Backend)     │
└────────┬────────┘
         │
         ├──► Forms (forms.py) ──► Validación
         │
         ├──► Models (models.py) ──► Base de Datos
         │
         └──► Decorators (decorators.py) ──► Permisos
```

### Componentes Principales

1. **Modelo Usuario** (`pagina/models.py`): Define la estructura de datos
2. **Formularios** (`pagina/forms.py`): Maneja validación y entrada de datos
3. **Vistas** (`pagina/views.py`): Lógica de negocio y procesamiento
4. **Templates** (`pagina/templates/pagina/usuarios.html`): Interfaz de usuario
5. **Decoradores** (`pagina/decorators.py`): Control de acceso por roles
6. **URLs** (`pagina/urls.py`): Enrutamiento de peticiones

---

## Modelo de Datos

### Clase Usuario

El modelo `Usuario` extiende `AbstractUser` de Django, agregando campos personalizados:

```python
class Usuario(AbstractUser):
    ROL_CHOICES = [
        ('VENDEDOR', 'Vendedor'),
        ('CREDITO', 'Crédito y Cobranza'),
        ('ADMIN', 'Administrador'),
    ]
    
    nombre_completo = models.CharField(max_length=200)
    rol = models.CharField(max_length=20, choices=ROL_CHOICES, default='VENDEDOR')
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### Campos Heredados de AbstractUser

- `username`: Nombre de usuario único
- `email`: Correo electrónico
- `password`: Contraseña hasheada
- `is_active`: Estado activo/inactivo (Django)
- `is_superuser`: Superusuario
- `is_staff`: Acceso al admin
- `date_joined`: Fecha de registro

### Campos Personalizados

- **nombre_completo**: Nombre completo del usuario
- **rol**: Rol del usuario (VENDEDOR, CREDITO, ADMIN)
- **activo**: Estado personalizado (independiente de `is_active`)
- **created_at**: Fecha de creación del registro

### Relaciones

- **Many-to-Many con Rutas**: Un usuario puede tener múltiples rutas asignadas
- **Foreign Keys**: Relacionado con Notas de Crédito, Historial, Alertas, etc.

---

## Formularios

### UsuarioForm

Formulario principal para crear y editar usuarios, basado en `UserCreationForm` de Django.

#### Campos

```python
- username: Nombre de usuario (único)
- email: Correo electrónico
- nombre_completo: Nombre completo
- rol: Rol del usuario (VENDEDOR, CREDITO, ADMIN)
- activo: Checkbox para activar/desactivar
- password1: Contraseña (mínimo 4 caracteres)
- password2: Confirmación de contraseña
```

#### Validaciones

1. **Validación de Contraseñas** (`clean_password2`):
   - Las contraseñas deben coincidir
   - Mínimo 4 caracteres
   - Validación personalizada que sobrescribe validadores estrictos de Django

2. **Validación de Campos**:
   - Email debe ser válido
   - Username debe ser único
   - Todos los campos requeridos deben estar presentes

#### Comportamiento en Edición

Cuando se edita un usuario existente:
- Las contraseñas se vuelven opcionales
- Si no se proporciona contraseña, se mantiene la actual
- El username no se puede cambiar (deshabilitado en el template)

#### Método save()

```python
def save(self, commit=True):
    user = super().save(commit=False)
    user.email = self.cleaned_data['email']
    user.nombre_completo = self.cleaned_data['nombre_completo']
    user.rol = self.cleaned_data['rol']
    user.activo = self.cleaned_data.get('activo', True)
    
    # Manejo de contraseñas
    if self.instance and self.instance.pk:  # Edición
        if not self.cleaned_data.get('password1'):
            user.set_password(user.password)  # Mantener actual
        else:
            user.set_password(self.cleaned_data['password1'])
    else:  # Creación
        user.set_password(self.cleaned_data['password1'])
    
    if commit:
        user.save()
    return user
```

---

## Vistas y Lógica de Negocio

### Vista usuarios()

**Ruta**: `/usuarios/`  
**Método**: GET y POST  
**Permisos**: Solo ADMIN (`@rol_requerido('ADMIN')`)

#### Funcionalidades

1. **Listar Usuarios** (GET):
   - Obtiene todos los usuarios ordenados por username
   - Inicializa formulario vacío para crear nuevos usuarios
   - Renderiza template con lista de usuarios

2. **Crear Usuario** (POST con `crear`):
   ```python
   if 'crear' in request.POST:
       form = UsuarioForm(request.POST)
       if form.is_valid():
           usuario = form.save()
           messages.success(request, f'Usuario "{usuario.username}" creado exitosamente.')
           return redirect('usuarios')
   ```

3. **Eliminar Usuario** (POST con `eliminar`):
   - Valida que el usuario existe
   - Previene auto-eliminación
   - Elimina usuario de la base de datos
   - Verifica eliminación exitosa
   - Logs detallados de todo el proceso

4. **Activar/Desactivar Usuario** (POST con `toggle_activo`):
   - Cambia estado `activo` del usuario
   - Previene auto-desactivación
   - Verifica cambio en base de datos
   - Logs detallados

#### Flujo de Eliminación

```
1. Usuario hace clic en botón eliminar
2. JavaScript muestra confirmación SweetAlert2
3. Usuario confirma
4. Formulario se envía con POST
5. Backend valida:
   - usuario_id presente
   - Usuario existe en BD
   - No es el mismo usuario
6. Ejecuta usuario.delete()
7. Verifica eliminación
8. Redirige con mensaje
```

#### Logs Implementados

Todos los procesos tienen logs detallados con prefijos:
- `[USUARIOS]`: Logs generales de la vista
- `[ELIMINAR_USUARIO]`: Logs específicos de eliminación
- `[TOGGLE_ACTIVO]`: Logs de activación/desactivación

---

## Templates y Frontend

### Template: usuarios.html

#### Estructura

1. **Tabla de Usuarios**:
   - Muestra todos los usuarios con sus datos
   - Badges de colores para roles y estados
   - Botones de acción por usuario

2. **Modal Crear Usuario**:
   - Formulario completo con todos los campos
   - Validación en frontend y backend
   - Mensajes de ayuda

3. **Modales Editar Usuario**:
   - Un modal por cada usuario
   - Formulario pre-poblado
   - Username deshabilitado

#### JavaScript

##### Confirmación de Eliminación

```javascript
document.querySelectorAll('.eliminar-form').forEach(function(form) {
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Obtener datos del formulario
        const formData = new FormData(formElement);
        const usuarioId = formData.get('usuario_id');
        
        // Mostrar confirmación SweetAlert2
        Swal.fire({
            title: '¿Eliminar Usuario?',
            html: '...',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar permanentemente',
            cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) {
                formElement.submit();
            }
        });
    });
});
```

##### Confirmación de Activar/Desactivar

Similar a eliminación, pero con mensajes específicos según el estado actual.

##### Mensajes SweetAlert2

Los mensajes de Django se convierten automáticamente a alertas SweetAlert2:

- **Éxito**: Verde, con auto-cierre en 3 segundos
- **Error**: Rojo, con explicaciones detalladas
- **Advertencia**: Naranja
- **Info**: Azul

#### Campos Ocultos Importantes

```html
<!-- En formulario de eliminar -->
<input type="hidden" name="eliminar" value="1">
<input type="hidden" name="usuario_id" value="{{ usuario.id }}">
```

**Nota**: El campo `eliminar` debe ser un input hidden, no solo el atributo `name` del botón, para asegurar que se envíe en el POST.

---

## Seguridad y Permisos

### Decorador @rol_requerido

```python
@rol_requerido('ADMIN')
def usuarios(request):
    # Solo usuarios con rol ADMIN pueden acceder
    ...
```

#### Funcionamiento

1. Verifica que el usuario esté autenticado
2. Si es superusuario, permite acceso
3. Verifica que el rol del usuario esté en la lista permitida
4. Si no tiene permisos, redirige con mensaje de error

### Protecciones Implementadas

1. **Auto-eliminación**: Un usuario no puede eliminarse a sí mismo
2. **Auto-desactivación**: Un usuario no puede desactivarse a sí mismo
3. **CSRF Protection**: Todos los formularios incluyen token CSRF
4. **Validación de IDs**: Se valida que los IDs sean enteros válidos
5. **Verificación de existencia**: Se verifica que el usuario exista antes de operaciones

### Validaciones de Seguridad

```python
# Prevenir auto-eliminación
if usuario == request.user:
    messages.error(request, 'No puedes eliminar tu propio usuario.')
    return redirect('usuarios')

# Validar ID
try:
    usuario_id_int = int(usuario_id)
except (ValueError, TypeError):
    messages.error(request, 'ID de usuario inválido.')
    return redirect('usuarios')

# Verificar existencia
try:
    usuario = Usuario.objects.get(id=usuario_id_int)
except Usuario.DoesNotExist:
    messages.error(request, 'Usuario no encontrado.')
    return redirect('usuarios')
```

---

## Validación de Contraseñas

### Configuración Global

En `proyecto/settings.py`:

```python
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 4,
        }
    },
]
```

**Nota**: Solo se mantiene el validador de longitud mínima. Se eliminaron validadores estrictos (similitud, comunes, numéricos).

### Validación en Formulario

En `UsuarioForm.clean_password2()`:

```python
def clean_password2(self):
    password1 = self.cleaned_data.get("password1")
    password2 = self.cleaned_data.get("password2")
    
    if password1 and password2:
        if password1 != password2:
            raise forms.ValidationError("Las contraseñas no coinciden.")
        if len(password1) < 4:
            raise forms.ValidationError("La contraseña debe tener al menos 4 caracteres.")
    
    return password2
```

### Características

- ✅ Mínimo 4 caracteres
- ✅ Sin restricciones de complejidad
- ✅ Validación en frontend (placeholder, help_text)
- ✅ Validación en backend (clean_password2)
- ✅ Validación global (AUTH_PASSWORD_VALIDATORS)

---

## Flujos de Trabajo

### Crear Usuario

```
1. Admin hace clic en "Agregar Nuevo Usuario"
2. Se abre modal con formulario
3. Admin completa campos:
   - Username (único)
   - Email
   - Nombre completo
   - Rol
   - Contraseña (mínimo 4 caracteres)
   - Confirmar contraseña
   - Activo (checkbox)
4. Admin hace clic en "Crear Usuario"
5. Backend valida:
   - Formulario válido
   - Contraseñas coinciden
   - Contraseña >= 4 caracteres
   - Username único
6. Se crea usuario en BD
7. Se muestra mensaje de éxito
8. Se recarga lista de usuarios
```

### Editar Usuario

```
1. Admin hace clic en botón "Editar" (ícono lápiz)
2. Se abre modal con datos del usuario
3. Admin modifica campos (username deshabilitado)
4. Si desea cambiar contraseña, la ingresa
5. Admin hace clic en "Guardar Cambios"
6. Backend valida y actualiza
7. Si hay nueva contraseña, se actualiza
8. Se muestra mensaje de éxito
```

### Eliminar Usuario

```
1. Admin hace clic en botón "Eliminar" (ícono basura)
2. JavaScript previene envío inmediato
3. Se muestra SweetAlert2 de confirmación:
   - Muestra nombre del usuario
   - Advertencia de acción permanente
   - Botones: "Sí, eliminar" / "Cancelar"
4. Si confirma:
   - Formulario se envía con POST
   - Backend valida:
     * usuario_id presente
     * Usuario existe
     * No es el mismo usuario
   - Se ejecuta usuario.delete()
   - Se verifica eliminación
   - Se muestra mensaje de éxito
5. Si cancela:
   - No se envía formulario
```

### Activar/Desactivar Usuario

```
1. Admin hace clic en botón activar/desactivar
2. JavaScript muestra confirmación
3. Si confirma:
   - Backend cambia estado activo
   - Previene auto-desactivación
   - Verifica cambio en BD
   - Muestra mensaje de éxito
```

---

## Mensajes y Notificaciones

### Sistema de Mensajes Django

El sistema usa `django.contrib.messages` para comunicar resultados al usuario.

### Tipos de Mensajes

1. **Success** (`messages.success`):
   - Usuario creado/actualizado/eliminado
   - Usuario activado/desactivado

2. **Error** (`messages.error`):
   - Errores de validación
   - Intentos de auto-eliminación/desactivación
   - Usuario no encontrado

3. **Warning** (`messages.warning`):
   - Advertencias de seguridad

4. **Info** (`messages.info`):
   - Información general

### Conversión a SweetAlert2

Los mensajes de Django se convierten automáticamente a alertas SweetAlert2 en el template:

```javascript
{% if messages %}
    {% for message in messages %}
        {% if message.tags == 'success' %}
            Swal.fire({
                icon: 'success',
                title: 'Usuario Creado',
                html: '...',
                timer: 3000,
                timerProgressBar: true
            });
        {% elif message.tags == 'error' %}
            Swal.fire({
                icon: 'error',
                title: 'Error',
                html: '...'
            });
        {% endif %}
    {% endfor %}
{% endif %}
```

### Mensajes Personalizados

Los mensajes se personalizan según el tipo de acción:

- **Crear**: "Usuario Creado" - "El usuario ha sido creado correctamente."
- **Eliminar**: "Usuario Eliminado" - "El usuario ha sido eliminado del sistema."
- **Activar**: "Usuario Activado" - "El usuario ahora puede acceder al sistema."
- **Desactivar**: "Usuario Desactivado" - "El usuario ya no puede acceder al sistema."
- **Actualizar**: "Usuario Actualizado" - "Los cambios se han guardado correctamente."

---

## Logs y Debugging

### Configuración de Logs

En `proyecto/settings.py`:

```python
LOGGING = {
    'loggers': {
        'pagina': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}
```

### Logs en Backend (Consola del Servidor)

#### Prefijos de Logs

- `[USUARIOS]`: Logs generales de la vista usuarios()
- `[ELIMINAR_USUARIO]`: Logs específicos de eliminación
- `[TOGGLE_ACTIVO]`: Logs de activación/desactivación

#### Ejemplo de Logs de Eliminación

```
[ELIMINAR_USUARIO] ===== INICIANDO PROCESO DE ELIMINACIÓN =====
[ELIMINAR_USUARIO] Usuario que solicita eliminación: admin (ID: 1)
[ELIMINAR_USUARIO] Método de petición: POST
[ELIMINAR_USUARIO] Datos POST recibidos: {'usuario_id': ['4'], 'eliminar': ['1'], ...}
[ELIMINAR_USUARIO] usuario_id obtenido del POST: 4
[ELIMINAR_USUARIO] Usuario encontrado en BD:
[ELIMINAR_USUARIO]   - ID: 4
[ELIMINAR_USUARIO]   - Username: usuario_test
[ELIMINAR_USUARIO]   - Email: test@example.com
[ELIMINAR_USUARIO] Intentando eliminar usuario: usuario_test (ID: 4)
[ELIMINAR_USUARIO] Método delete() ejecutado sin excepciones
[ELIMINAR_USUARIO] ✓ Usuario eliminado correctamente de la BD
[ELIMINAR_USUARIO] ===== FIN DEL PROCESO DE ELIMINACIÓN =====
```

### Logs en Frontend (Consola del Navegador)

#### Prefijos de Logs

- `[JS-ELIMINAR]`: Logs de JavaScript para eliminación
- `[JS]`: Logs generales de JavaScript

#### Ejemplo de Logs Frontend

```javascript
[JS-ELIMINAR] Buscando formularios de eliminación...
[JS-ELIMINAR] Formularios encontrados: 3
[JS-ELIMINAR] Configurando listener para formulario 1
[JS-ELIMINAR] ===== EVENTO SUBMIT CAPTURADO =====
[JS-ELIMINAR] Datos del formulario:
[JS-ELIMINAR]   usuario_id: 4
[JS-ELIMINAR]   eliminar: 1
[JS-ELIMINAR] Usuario confirmó eliminación
[JS-ELIMINAR] Enviando formulario...
```

### Uso de Logs para Debugging

1. **Problema**: Usuario no se elimina
   - Revisar logs `[ELIMINAR_USUARIO]` en consola del servidor
   - Verificar si `usuario_id` se recibe correctamente
   - Verificar si el usuario existe en BD
   - Verificar si hay errores en `delete()`

2. **Problema**: Formulario no se envía
   - Revisar logs `[JS-ELIMINAR]` en consola del navegador
   - Verificar que el evento submit se capture
   - Verificar que los datos del formulario estén presentes

3. **Problema**: Validación de contraseña falla
   - Revisar logs de validación en backend
   - Verificar configuración de `AUTH_PASSWORD_VALIDATORS`
   - Verificar método `clean_password2()`

---

## Configuración

### Settings Requeridos

#### 1. Modelo de Usuario Personalizado

```python
# proyecto/settings.py
AUTH_USER_MODEL = 'pagina.Usuario'
```

#### 2. Validadores de Contraseña

```python
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 4,
        }
    },
]
```

#### 3. URLs de Autenticación

```python
LOGIN_URL = '/login/'
LOGIN_REDIRECT_URL = 'pagina_principal'
LOGOUT_REDIRECT_URL = '/login/'
```

#### 4. Logging

```python
LOGGING = {
    'loggers': {
        'pagina': {
            'handlers': ['console', 'file'],
            'level': 'DEBUG',
        },
    },
}
```

### Dependencias Externas

- **SweetAlert2**: Para alertas modernas
- **Bootstrap 5**: Para estilos
- **Font Awesome**: Para iconos

---

## Ejemplos de Uso

### Crear Usuario Programáticamente

```python
from pagina.models import Usuario

usuario = Usuario.objects.create_user(
    username='nuevo_usuario',
    email='usuario@example.com',
    nombre_completo='Usuario Nuevo',
    rol='VENDEDOR',
    password='1234',  # Mínimo 4 caracteres
    activo=True
)
```

### Verificar Permisos

```python
from pagina.decorators import rol_requerido

@rol_requerido('ADMIN', 'CREDITO')
def mi_vista(request):
    # Solo ADMIN o CREDITO pueden acceder
    ...
```

### Obtener Usuarios por Rol

```python
from pagina.models import Usuario

# Todos los administradores
admins = Usuario.objects.filter(rol='ADMIN', activo=True)

# Usuarios activos
usuarios_activos = Usuario.objects.filter(activo=True)
```

### Cambiar Estado de Usuario

```python
usuario = Usuario.objects.get(username='usuario_test')
usuario.activo = False
usuario.save()
```

---

## Solución de Problemas Comunes

### Problema: "MinimumLengthValidator object is not callable"

**Causa**: Intentar usar validadores de contraseña directamente en campos de formulario.

**Solución**: Usar método `clean_password2()` para validación personalizada.

### Problema: Usuario no se elimina

**Causas posibles**:
1. Campo `eliminar` no se envía en POST
2. Usuario intenta auto-eliminarse
3. Error en base de datos

**Solución**: 
- Agregar `<input type="hidden" name="eliminar" value="1">` en formulario
- Revisar logs `[ELIMINAR_USUARIO]` para diagnóstico

### Problema: Contraseña no se valida

**Causa**: Validadores estrictos de Django bloquean contraseñas simples.

**Solución**: Configurar `AUTH_PASSWORD_VALIDATORS` con solo `MinimumLengthValidator` y `min_length=4`.

### Problema: Mensajes no se muestran

**Causa**: JavaScript no convierte mensajes de Django a SweetAlert2.

**Solución**: Verificar que el bloque de JavaScript de mensajes esté presente en el template.

---

## Mejores Prácticas

1. **Siempre validar en backend**: No confiar solo en validación frontend
2. **Usar logs detallados**: Facilitan debugging y auditoría
3. **Prevenir auto-eliminación**: Protección importante de seguridad
4. **Mensajes claros**: Ayudan al usuario a entender qué pasó
5. **Confirmaciones para acciones destructivas**: Eliminar, desactivar
6. **Verificar existencia antes de operaciones**: Evitar errores 404
7. **Usar transacciones para operaciones críticas**: Asegurar integridad
8. **Mantener logs de auditoría**: Para rastrear cambios importantes

---

## Referencias

- **Archivos Clave**:
  - `pagina/models.py`: Modelo Usuario
  - `pagina/forms.py`: Formularios
  - `pagina/views.py`: Vistas
  - `pagina/templates/pagina/usuarios.html`: Template
  - `pagina/decorators.py`: Control de acceso
  - `proyecto/settings.py`: Configuración

- **Documentación Django**:
  - [User Authentication](https://docs.djangoproject.com/en/stable/topics/auth/)
  - [Forms](https://docs.djangoproject.com/en/stable/topics/forms/)
  - [Model Forms](https://docs.djangoproject.com/en/stable/topics/forms/modelforms/)

---

**Última actualización**: Enero 2026  
**Versión**: 1.0




