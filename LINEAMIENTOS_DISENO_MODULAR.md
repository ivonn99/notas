# Lineamientos de Diseño Modular

## 📋 Principios de Diseño Modular

Todas las páginas del sistema deben seguir una estructura modular para facilitar el mantenimiento, reutilización y consistencia.

## 🧩 Componentes Modulares Disponibles

### 1. **Page Header** (`includes/page_header.html`)
Header estándar para todas las páginas con título e icono.

```django
{% include 'pagina/includes/page_header.html' with titulo="Gestión de Usuarios" icono="fa-users" %}
```

**Parámetros:**
- `titulo` (requerido): Título de la página
- `icono` (opcional): Clase de icono Font Awesome (ej: "fa-users")
- `descripcion` (opcional): Descripción adicional

---

### 2. **Stats Cards** (`includes/stats_cards.html`)
Tarjetas de estadísticas reutilizables.

```django
{% include 'pagina/includes/stats_cards.html' with cards=lista_cards %}
```

**Estructura de `cards`:**
```python
cards = [
    {
        'titulo': 'Rutas Activas',
        'valor': 4,
        'icono': 'fa-route',
        'bg_color': 'rgba(76, 161, 80, 0.2)',
        'border_color': 'rgba(76, 161, 80, 0.5)',
        'col_size': 4  # Tamaño de columna (default: 4)
    },
    # ... más cards
]
```

---

### 3. **Action Button** (`includes/action_button.html`)
Botones de acción estándar.

```django
{% include 'pagina/includes/action_button.html' with texto="Agregar Usuario" icono="fa-user-plus" color="success" modal_target="#modalCrear" %}
```

**Parámetros:**
- `texto` (requerido): Texto del botón
- `icono` (opcional): Clase de icono Font Awesome
- `color` (opcional): Color Bootstrap (default: "success")
- `modal_target` (opcional): ID del modal a abrir
- `url` (opcional): URL para redirección
- `onclick` (opcional): Función JavaScript

---

### 4. **Data Table** (`includes/data_table.html`)
Tablas de datos estándar.

```django
{% include 'pagina/includes/data_table.html' with headers=lista_headers rows=lista_rows %}
```

**Estructura:**
```python
headers = ['Usuario', 'Nombre', 'Email', 'Rol']
rows = [
    ['usuario1', 'Nombre 1', 'email1@test.com', 'Admin'],
    # ... más filas
]
```

---

### 5. **Alert Messages** (`includes/alert_messages.html`)
Mensajes de alerta del sistema.

```django
{% include 'pagina/includes/alert_messages.html' %}
```

Este componente muestra automáticamente todos los mensajes de Django messages framework.

---

### 6. **Page Container** (`includes/page_container.html`)
Contenedor estándar para páginas.

```django
{% include 'pagina/includes/page_container.html' with max_width="1200px" %}
    {% block page_content %}
        <!-- Contenido de la página -->
    {% endblock %}
{% endinclude %}
```

---

## 📐 Estructura Estándar de una Página

```django
{% extends 'pagina/base.html' %}
{% load static %}

{% block title %}Título de la Página{% endblock %}

{% block content %}
    {% include 'pagina/includes/page_container.html' with max_width="1200px" %}
        {% block page_content %}
            {# Header #}
            {% include 'pagina/includes/page_header.html' with titulo="Título" icono="fa-icon" %}
            
            {# Mensajes #}
            {% include 'pagina/includes/alert_messages.html' %}
            
            {# Estadísticas (opcional) #}
            {% include 'pagina/includes/stats_cards.html' with cards=lista_cards %}
            
            {# Botón de acción (opcional) #}
            {% include 'pagina/includes/action_button.html' with texto="Agregar" icono="fa-plus" %}
            
            {# Contenido principal #}
            <div class="main-content">
                <!-- Contenido específico de la página -->
            </div>
        {% endblock %}
    {% endinclude %}
{% endblock %}

{% block extra_js %}
    {# JavaScript específico de la página #}
{% endblock %}
```

---

## 🎨 Estilos y Clases CSS Estándar

### Contenedores
- `.seccion`: Contenedor principal de sección
- `.seccion-content`: Contenido de la sección con ancho máximo
- `.page-header`: Header de página estándar

### Botones
- `.btn-success`: Botón verde (acciones principales)
- `.btn-primary`: Botón azul (acciones secundarias)
- `.btn-danger`: Botón rojo (acciones destructivas)
- `.btn-warning`: Botón amarillo (advertencias)

### Tablas
- `.table-dark`: Tabla con fondo oscuro
- `.table-hover`: Efecto hover en filas
- `.table-responsive`: Tabla responsive

### Cards
- Usar colores semitransparentes con `rgba()`
- Bordes sutiles con `border: 1px solid rgba(...)`

---

## ✅ Checklist para Páginas Modulares

- [ ] Usa `{% extends 'pagina/base.html' %}`
- [ ] Incluye el header con `page_header.html`
- [ ] Incluye mensajes con `alert_messages.html`
- [ ] Usa componentes modulares cuando sea posible
- [ ] Mantiene estructura consistente
- [ ] Usa clases CSS estándar
- [ ] JavaScript en `{% block extra_js %}`
- [ ] Responsive design
- [ ] Iconos Font Awesome consistentes

---

## 📝 Ejemplo Completo

Ver `pagina/templates/pagina/usuarios.html` para un ejemplo completo de página modular.

---

## 🔄 Migración de Páginas Existentes

Para migrar una página existente a estructura modular:

1. Reemplazar header manual por `page_header.html`
2. Extraer estadísticas a `stats_cards.html`
3. Extraer botones a `action_button.html`
4. Extraer tablas a `data_table.html` (si aplica)
5. Agregar `alert_messages.html`
6. Envolver en `page_container.html`

---

## 📱 Diseño Responsive - Tablas en Móviles

### Principio: Tablas → Cards Verticales

En dispositivos móviles, **todas las tablas deben convertirse automáticamente en cards verticales** para evitar scroll horizontal y mejorar la experiencia de usuario.

### Implementación

#### 1. **Estructura Dual (Desktop/Móvil)**

```django
<!-- Tabla para Desktop -->
<div class="table-responsive d-none d-md-block">
    <table class="table table-dark table-hover">
        <!-- Contenido de la tabla -->
    </table>
</div>

<!-- Cards para Móvil -->
<div class="d-md-none">
    {% for item in items %}
    <div class="card bg-dark text-white mb-3">
        <div class="card-body" style="padding: 1rem;">
            <!-- Información organizada verticalmente -->
        </div>
    </div>
    {% endfor %}
</div>
```

#### 2. **Estructura de Card Móvil**

Cada card debe incluir:

- **Header**: Título principal + Badge de estado (si aplica)
- **Información principal**: Campos más importantes
- **Información secundaria**: Campos adicionales con separadores
- **Acciones**: Botones táctiles (mínimo 44x44px)

#### 3. **Ejemplo de Card Móvil**

```django
<div class="card bg-dark text-white mb-3" style="border: 1px solid rgba(200, 230, 212, 0.2);">
    <div class="card-body" style="padding: 1rem;">
        <!-- Header -->
        <div class="d-flex justify-content-between align-items-start mb-3">
            <div>
                <h5 class="card-title mb-1" style="font-size: 1.1rem; color: #c8e6d4;">
                    <i class="fas fa-icon"></i> Título Principal
                </h5>
                <p class="mb-0" style="font-size: 0.9rem;">Subtítulo</p>
            </div>
            <div>
                <span class="badge bg-success">Estado</span>
            </div>
        </div>
        
        <!-- Información con separadores -->
        <div class="mb-2 pb-2" style="border-bottom: 1px solid rgba(200, 230, 212, 0.1);">
            <strong style="color: #c8e6d4; display: block; margin-bottom: 0.25rem; font-size: 0.85rem;">
                <i class="fas fa-icon"></i> Campo:
            </strong>
            <span style="font-size: 0.9rem; word-wrap: break-word;">Valor</span>
        </div>
        
        <!-- Acciones -->
        <div class="mt-3 pt-2">
            <strong style="color: #c8e6d4; display: block; margin-bottom: 0.5rem; font-size: 0.85rem;">
                <i class="fas fa-cog"></i> Acciones:
            </strong>
            <div class="d-flex flex-wrap gap-2">
                <button class="btn btn-sm btn-primary" style="min-width: 44px; min-height: 44px;">
                    <i class="fas fa-edit"></i>
                </button>
            </div>
        </div>
    </div>
</div>
```

#### 4. **Reglas de Diseño para Cards Móviles**

- ✅ **Ancho completo**: `width: 100%`, sin márgenes laterales
- ✅ **Separadores visuales**: Bordes sutiles entre secciones
- ✅ **Iconos**: Usar Font Awesome para mejor identificación
- ✅ **Tipografía**: 
  - Títulos: `1.1rem`
  - Labels: `0.85rem`
  - Valores: `0.9rem`
- ✅ **Espaciado**: Padding `1rem`, margins entre secciones `0.5rem`
- ✅ **Botones**: Mínimo 44x44px, usar `gap-2` para espaciado
- ✅ **Word-wrap**: Activar para texto largo
- ✅ **Badges**: Tamaño reducido (`0.75rem` - `0.8rem`)

#### 5. **Páginas que Implementan Cards Móviles**

- ✅ Gestión de Usuarios (`usuarios.html`)
- ✅ Gestión de Rutas (`rutas.html`)
- 🔄 Pendiente: Otras páginas con tablas

#### 6. **Checklist para Conversión Tabla → Cards**

- [ ] Crear vista de tabla con `d-none d-md-block`
- [ ] Crear vista de cards con `d-md-none`
- [ ] Organizar información verticalmente
- [ ] Agregar separadores visuales
- [ ] Incluir iconos en cada sección
- [ ] Asegurar botones táctiles (44x44px)
- [ ] Probar en diferentes tamaños de pantalla
- [ ] Verificar que no haya scroll horizontal

---

**Última actualización:** 2026-01-24

