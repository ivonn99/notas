# Lineamientos de Diseño - Sistema de Gestión de Notas de Crédito

## 📋 Índice
1. [Paleta de Colores](#paleta-de-colores)
2. [Tipografía](#tipografía)
3. [Componentes UI](#componentes-ui)
4. [Espaciado](#espaciado)
5. [Iconografía](#iconografía)
6. [Formularios](#formularios)
7. [Modales](#modales)
8. [Alertas y Notificaciones](#alertas-y-notificaciones)
9. [Tablas](#tablas)
10. [Navegación](#navegación)
11. [Responsive Design](#responsive-design)
12. [Animaciones](#animaciones)

---

## 🎨 Paleta de Colores

### Colores Principales

#### Fondo
- **Fondo Principal (Gradiente)**: 
  - Verde claro/medio: `#81C784` (Material Design "Light Green 500")
  - Verde medio: `#66BB6A` (Material Design "Light Green 400")
  - Verde oscuro: `#388E3C` (Material Design "Green 700")
  - Verde más oscuro: `#2E7D32` (Material Design "Green 800")
  - **Dirección**: Horizontal (de izquierda a derecha)

#### Componentes Oscuros
- **Fondo de Recuadros**: `#1a1a1a` (Casi negro)
- **Fondo de Inputs**: `#2a2a2a` (Gris oscuro)
- **Bordes**: `rgba(200, 230, 212, 0.2)` (Verde claro semitransparente)
- **Bordes Activos**: `rgba(200, 230, 212, 0.3)` (Verde claro más visible)

#### Navbar y Sidebar
- **Fondo**: `#1a1a1a` (Casi negro, uniforme)
- **Texto**: `#c8e6d4` (Verde claro)
- **Texto Hover**: `#ffffff` (Blanco)
- **Borde Inferior Navbar**: `rgba(200, 230, 212, 0.2)`
- **Borde Superior Sidebar (desplegado)**: `#c8e6d4` (3px sólido)

#### Texto
- **Títulos**: `#ffffff` (Blanco)
- **Texto Principal**: `#ffffff` (Blanco)
- **Texto Secundario**: `#c8e6d4` (Verde claro)
- **Texto Deshabilitado**: `rgba(255, 255, 255, 0.6)` (Blanco semitransparente)
- **Placeholders**: `rgba(255, 255, 255, 0.5)` (Blanco semitransparente)

### Colores de Estado

#### Success (Éxito)
- **Fondo**: `#4CA150` (Verde)
- **Texto**: `#ffffff` (Blanco)
- **Uso**: Operaciones exitosas, confirmaciones

#### Error (Error)
- **Fondo**: `#f44336` (Rojo)
- **Texto**: `#ffffff` (Blanco)
- **Uso**: Errores, validaciones fallidas

#### Warning (Advertencia)
- **Fondo**: `#ff9800` (Naranja)
- **Texto**: `#ffffff` (Blanco)
- **Uso**: Advertencias, confirmaciones importantes

#### Info (Información)
- **Fondo**: `#2196F3` (Azul)
- **Texto**: `#ffffff` (Blanco)
- **Uso**: Información general, tips

### Colores de Roles (Badges)
- **ADMIN**: `bg-danger` (Rojo)
- **CREDITO**: `bg-warning` (Amarillo/Naranja)
- **VENDEDOR**: `bg-info` (Azul)

---

## 📝 Tipografía

### Fuente Principal
- **Familia**: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`
- **Tamaño Base**: `16px`
- **Line Height**: `1.6`

### Jerarquía de Títulos

#### Títulos de Sección
- **Tamaño**: `42px`
- **Peso**: `700` (Bold)
- **Color**: `#ffffff`
- **Transform**: `uppercase`
- **Letter Spacing**: `2px`
- **Margin Bottom**: `20px`

#### Subtítulos
- **Tamaño**: `18px`
- **Peso**: `500` (Medium)
- **Color**: `#ffffff`
- **Line Height**: `1.8`

#### Labels de Formularios
- **Tamaño**: `14px`
- **Peso**: `600` (Semi-bold)
- **Color**: `#c8e6d4`

### Responsive
- **Pantallas pequeñas**: Títulos `32px`, Texto `16px`

---

## 🧩 Componentes UI

### Botones

#### Botón Primario
```css
background: linear-gradient(135deg, #4CA150 0%, #2E7D32 100%);
border: none;
border-radius: 8px;
padding: 12px 24px;
color: #ffffff;
font-weight: 600;
transition: all 0.3s;
```

#### Botón Primario Hover
```css
background: linear-gradient(135deg, #2E7D32 0%, #1B5E20 100%);
transform: translateY(-2px);
box-shadow: 0 5px 15px rgba(46, 125, 50, 0.4);
```

#### Botón Secundario
```css
background: #6c757d;
border: none;
border-radius: 8px;
padding: 12px 24px;
color: #ffffff;
```

#### Botón de Acción (Success)
```css
background: #4CA150;
color: #ffffff;
```

#### Botón de Acción (Danger)
```css
background: #f44336;
color: #ffffff;
```

#### Botón de Acción (Warning)
```css
background: #ff9800;
color: #ffffff;
```

### Recuadros de Contenido

#### Sección Content
```css
background: #1a1a1a;
padding: 50px;
border-radius: 20px;
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
border: 1px solid rgba(200, 230, 212, 0.2);
color: #ffffff;
max-width: 800px; /* Ajustable según necesidad */
```

#### Login Card
```css
background: #1a1a1a;
border-radius: 15px;
box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
padding: 40px;
max-width: 450px;
width: 100%;
border: 1px solid rgba(200, 230, 212, 0.2);
```

---

## 📏 Espaciado

### Sistema de Espaciado
- **XS**: `5px`
- **SM**: `10px`
- **MD**: `15px`
- **LG**: `20px`
- **XL**: `30px`
- **XXL**: `50px`

### Padding
- **Recuadros**: `50px` (desktop), `30px` (mobile)
- **Modales**: `40px`
- **Formularios**: `12px 15px` (inputs)

### Margin
- **Entre elementos**: `20px`
- **Entre secciones**: `40px`
- **Bottom de títulos**: `20px`

---

## 🎯 Iconografía

### Biblioteca
- **Font Awesome 6.4.0** (CDN)
- **Uso**: Iconos en botones, labels, navegación

### Iconos Principales
- **Home**: `fa-home`
- **Usuario**: `fa-user`
- **Editar**: `fa-edit`
- **Eliminar**: `fa-trash`
- **Guardar**: `fa-save`
- **Cerrar**: `fa-times`
- **Menú**: `fa-bars`
- **Notas**: `fa-file-invoice-dollar`
- **Crédito**: `fa-money-check-alt`
- **Configuración**: `fa-cog`
- **Alertas**: `fa-exclamation-triangle`
- **Búsqueda**: `fa-search`
- **Subir**: `fa-upload`
- **Historial**: `fa-history`
- **Rutas**: `fa-route`
- **Parámetros**: `fa-sliders-h`
- **Logs**: `fa-file-alt`
- **Perfil**: `fa-user-circle`
- **Notificaciones**: `fa-bell`
- **Cerrar Sesión**: `fa-sign-out-alt`

### Tamaños
- **Pequeño**: `14px`
- **Mediano**: `16px`
- **Grande**: `20px`
- **Extra Grande**: `24px`

---

## 📋 Formularios

### Inputs

#### Input Normal
```css
background: #2a2a2a;
border: 2px solid rgba(200, 230, 212, 0.3);
border-radius: 8px;
padding: 12px 15px;
color: #ffffff;
transition: all 0.3s;
```

#### Input Focus
```css
border-color: #4CA150;
box-shadow: 0 0 0 0.2rem rgba(76, 161, 80, 0.25);
background: #2a2a2a;
color: #ffffff;
```

#### Input Disabled
```css
background: #1a1a1a;
border-color: rgba(200, 230, 212, 0.2);
color: rgba(255, 255, 255, 0.6);
cursor: not-allowed;
```

#### Input Group (con icono)
```css
.input-group-text {
    background: #2a2a2a;
    border: 2px solid rgba(200, 230, 212, 0.3);
    color: #c8e6d4;
}
```

### Selects
- Mismo estilo que inputs
- Usar `form-select` de Bootstrap

### Checkboxes
```css
.form-check-input:checked {
    background-color: #4CA150;
    border-color: #4CA150;
}
```

### Labels
```css
font-weight: 600;
color: #c8e6d4;
margin-bottom: 8px;
```

---

## 🪟 Modales

### Estructura
```css
.modal-content {
    background: #1a1a1a;
    border: 1px solid rgba(200, 230, 212, 0.2);
    border-radius: 15px;
}
```

### Header
```css
.modal-header {
    background: rgba(200, 230, 212, 0.05);
    border-bottom: 1px solid rgba(200, 230, 212, 0.2);
    color: #ffffff;
}
```

### Body
```css
.modal-body {
    color: #ffffff;
    padding: 40px;
}
```

### Footer
```css
.modal-footer {
    background: rgba(200, 230, 212, 0.05);
    border-top: 1px solid rgba(200, 230, 212, 0.2);
}
```

### Botón Cerrar
- Usar `btn-close-white` de Bootstrap
- Filtro invertido para visibilidad

---

## 🔔 Alertas y Notificaciones

### Alertas Bootstrap (Login y otras páginas)

#### Success
```css
background: #4CA150;
color: #ffffff;
border-radius: 8px;
padding: 14px 18px;
```

#### Error
```css
background: #f44336;
color: #ffffff;
```

#### Warning
```css
background: #ff9800;
color: #ffffff;
```

#### Info
```css
background: #2196F3;
color: #ffffff;
```

### SweetAlert2 (Gestión de Usuarios)

#### Configuración Base
```javascript
{
    background: '#1a1a1a',
    color: '#ffffff',
    confirmButtonColor: '#4CA150', // Ajustar según tipo
    customClass: {
        popup: 'swal-dark',
        title: 'swal-title-dark',
        content: 'swal-content-dark',
        confirmButton: 'swal-button-dark'
    }
}
```

#### Tipos
- **Success**: Icon `success`, Color `#4CA150`
- **Error**: Icon `error`, Color `#f44336`
- **Warning**: Icon `warning`, Color `#ff9800`
- **Info**: Icon `info`, Color `#2196F3`
- **Question**: Icon `question`, Color según acción

---

## 📊 Tablas

### Estilo Base
```css
.table-dark {
    background: #1a1a1a;
    border-color: rgba(200, 230, 212, 0.2);
}
```

### Headers
```css
.table-dark th {
    border-color: rgba(200, 230, 212, 0.2);
    color: #c8e6d4;
    font-weight: 600;
}
```

### Celdas
```css
.table-dark td {
    border-color: rgba(200, 230, 212, 0.2);
    color: #ffffff;
}
```

### Hover
```css
.table-dark tbody tr:hover {
    background: rgba(200, 230, 212, 0.1);
}
```

### Badges en Tablas
- Usar colores según rol/estado
- Tamaño: `badge` de Bootstrap

---

## 🧭 Navegación

### Navbar
- **Fondo**: `#1a1a1a`
- **Altura**: `56px`
- **Posición**: `fixed` en top
- **Z-index**: `1030`
- **Brand**: Centrado, responsive (texto completo/abreviado)

### Sidebar
- **Fondo**: `#1a1a1a`
- **Ancho**: `250px`
- **Posición**: `fixed` en left
- **Z-index**: `1020`
- **Estado**: Oculto por defecto, se despliega con hamburger
- **Borde superior**: `3px solid #c8e6d4` cuando está desplegado

### Links de Navegación
```css
.nav-link {
    color: #ecf0f1;
    padding: 15px 25px;
    border-left: 3px solid transparent;
    transition: all 0.3s ease;
}
```

### Links Hover/Active
```css
.nav-link:hover,
.nav-link.active {
    background: rgba(200, 230, 212, 0.2);
    border-left-color: #c8e6d4;
    color: #c8e6d4;
    transform: translateX(5px);
}
```

### Botón Hamburger
- **Siempre visible**: `display: flex !important`
- **Borde**: `2px solid #c8e6d4`
- **Hover**: `background: rgba(200, 230, 212, 0.1)`
- **Iconos**: `fa-bars` (abierto), `fa-times` (cerrado)

---

## 📱 Responsive Design

### Breakpoints
- **Mobile**: `max-width: 768px`
- **Tablet**: `769px - 1024px`
- **Desktop**: `min-width: 1025px`

### Comportamiento Mobile
- **Navbar Brand**: Muestra solo "DMH"
- **Sidebar**: Overlay completo, no desplaza contenido
- **Recuadros**: Padding reducido a `30px`
- **Títulos**: Tamaño reducido a `32px`
- **Tablas**: Scroll horizontal

### Comportamiento Desktop
- **Sidebar**: Desplaza contenido cuando está abierto
- **Recuadros**: Padding completo `50px`
- **Títulos**: Tamaño completo `42px`

---

## ✨ Animaciones

### Transiciones
- **Duración estándar**: `0.3s`
- **Easing**: `ease`

### Fade In Up (Recuadros)
```css
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

### Slide In Down (Alertas)
```css
@keyframes slideInDown {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
```

### Hover Effects
- **Botones**: `translateY(-2px)` + sombra
- **Links**: `translateX(5px)`
- **Cards**: Sombra aumentada

---

## 🎨 Reglas Generales

### Consistencia
1. **Siempre usar diseño oscuro** para recuadros y componentes
2. **Texto blanco** en fondos oscuros
3. **Bordes sutiles** con verde claro semitransparente
4. **Iconos Font Awesome** para mejor UX
5. **Animaciones suaves** en interacciones

### Accesibilidad
1. **Contraste mínimo**: 4.5:1 para texto normal
2. **Focus visible**: Bordes y sombras en inputs
3. **Estados claros**: Hover, active, disabled bien diferenciados
4. **Labels descriptivos**: Siempre asociar labels con inputs

### Performance
1. **CDN para librerías**: Bootstrap, Font Awesome, SweetAlert2
2. **CSS optimizado**: Usar clases reutilizables
3. **Animaciones ligeras**: Solo transform y opacity

---

## 📚 Recursos

### Librerías Externas
- **Bootstrap 5.3.2**: Componentes base
- **Font Awesome 6.4.0**: Iconografía
- **SweetAlert2 v11**: Alertas modernas

### Archivos de Estilos
- `static/css/style.css`: Estilos principales
- Estilos inline en templates cuando sea necesario

---

## 🔄 Actualizaciones

**Última actualización**: 2026-01-22
**Versión**: 1.0

---

## 📝 Notas

- Todos los componentes deben seguir estos lineamientos
- Cualquier desviación debe ser justificada y documentada
- Mantener consistencia visual en todo el proyecto
- Priorizar UX y accesibilidad

---

**Documento creado para mantener la consistencia del diseño en el Sistema de Gestión de Notas de Crédito DMH**




