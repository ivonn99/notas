# Ejemplo de Página Modular

## 📄 Estructura de una Página Modular

Todas las páginas deben seguir esta estructura modular:

```django
{% extends 'pagina/base.html' %}
{% load static %}

{% block title %}Título de la Página{% endblock %}

{% block content %}
    {# Contenedor principal #}
    <div class="seccion">
        <div class="seccion-content" style="max-width: 1200px; text-align: left;">
            
            {# 1. Header de página #}
            {% include 'pagina/includes/page_header.html' with titulo="Gestión de Rutas" icono="fa-route" %}
            
            {# 2. Mensajes (opcional, ya están en base.html) #}
            
            {# 3. Tarjetas de estadísticas #}
            {% include 'pagina/includes/stats_cards.html' with cards=stats_cards %}
            
            {# 4. Botón de acción #}
            {% include 'pagina/includes/action_button.html' with texto="Agregar Nueva Ruta" icono="fa-plus" color="success" modal_target="#modalCrearRuta" %}
            
            {# 5. Contenido principal #}
            <div class="main-content">
                <!-- Tabla, formularios, etc. -->
            </div>
            
        </div>
    </div>
{% endblock %}

{% block extra_js %}
    {# JavaScript específico de la página #}
{% endblock %}
```

## 🔧 Preparación en la Vista

En `views.py`, prepara los datos en formato modular:

```python
def rutas(request):
    # ... lógica existente ...
    
    # Preparar tarjetas de estadísticas
    stats_cards = [
        {
            'titulo': 'Rutas Activas',
            'valor': rutas_activas,
            'icono': 'fa-route',
            'bg_color': 'rgba(76, 161, 80, 0.2)',
            'border_color': 'rgba(76, 161, 80, 0.5)',
            'col_size': 4
        },
        {
            'titulo': 'Rutas Inactivas',
            'valor': rutas_inactivas,
            'icono': 'fa-ban',
            'bg_color': 'rgba(108, 117, 125, 0.2)',
            'border_color': 'rgba(108, 117, 125, 0.5)',
            'col_size': 4
        },
    ]
    
    context = {
        'rutas': rutas_list,
        'stats_cards': stats_cards,
        # ... otros datos ...
    }
    return render(request, 'pagina/rutas.html', context)
```

## ✅ Ventajas del Diseño Modular

1. **Reutilización**: Componentes usables en múltiples páginas
2. **Consistencia**: Mismo look & feel en todo el sistema
3. **Mantenibilidad**: Cambios centralizados en un solo lugar
4. **Escalabilidad**: Fácil agregar nuevas páginas
5. **Legibilidad**: Código más limpio y organizado

## 📦 Componentes Disponibles

1. `page_header.html` - Header con título e icono
2. `stats_cards.html` - Tarjetas de estadísticas
3. `action_button.html` - Botones de acción
4. `data_table.html` - Tablas de datos
5. `alert_messages.html` - Mensajes del sistema
6. `page_container.html` - Contenedor estándar

## 🎯 Próximos Pasos

1. Migrar páginas existentes a estructura modular
2. Crear más componentes según necesidad
3. Documentar nuevos componentes
4. Mantener consistencia en todas las páginas




