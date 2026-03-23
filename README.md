# Proyecto Django - Página con Sidebar

Una página web simple creada con Django que incluye 6 secciones y un sidebar de navegación.

## Características

- ✅ 6 secciones de contenido
- ✅ Sidebar fijo con navegación
- ✅ Diseño moderno y responsive
- ✅ Scroll suave entre secciones
- ✅ Efectos visuales y animaciones

## Instalación

1. Instala las dependencias:
```bash
pip install -r requirements.txt
```

2. Ejecuta las migraciones (si es necesario):
```bash
python manage.py migrate
```

3. Inicia el servidor de desarrollo:
```bash
python manage.py runserver
```

4. Abre tu navegador en: `http://127.0.0.1:8000/`

## Estructura del Proyecto

```
proyecto/
├── manage.py
├── proyecto/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── pagina/
│   ├── views.py
│   ├── urls.py
│   └── templates/
│       └── pagina/
│           ├── base.html
│           └── index.html
└── static/
    ├── css/
    │   └── style.css
    └── js/
        └── main.js
```

## Secciones

1. **Inicio** - Página de bienvenida
2. **Sobre Nosotros** - Información de la empresa
3. **Servicios** - Lista de servicios ofrecidos
4. **Productos** - Catálogo de productos
5. **Contacto** - Información de contacto
6. **Galería** - Galería de imágenes

## Personalización

Puedes modificar el contenido de las secciones editando el archivo `pagina/views.py` en el diccionario `secciones`.





