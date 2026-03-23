# Usuarios de Prueba Creados

## ✅ Usuarios Creados Exitosamente

Se han creado **3 usuarios de prueba**, uno por cada rol:

### 1. Administrador
- **Username**: `zoram`
- **Password**: `1995`
- **Email**: zoram@dmh.com
- **Nombre**: Zoram Usuario
- **Rol**: ADMIN (Administrador)
- **Superusuario**: Sí
- **Staff**: Sí

### 2. Vendedor
- **Username**: `vendedor1`
- **Password**: `vendedor123`
- **Email**: vendedor1@dmh.com
- **Nombre**: Vendedor de Prueba
- **Rol**: VENDEDOR
- **Superusuario**: No
- **Staff**: No

### 3. Crédito y Cobranza
- **Username**: `credito1`
- **Password**: `credito123`
- **Email**: credito1@dmh.com
- **Nombre**: Crédito y Cobranza
- **Rol**: CREDITO
- **Superusuario**: No
- **Staff**: No

---

## Comandos Útiles

### Listar usuarios
```bash
python listar_usuarios.py
```

### Crear más usuarios
```bash
python manage.py crear_usuarios_prueba
```

### Probar autenticación
```bash
python probar_autenticacion.py
```

### Crear superusuario manualmente
```bash
python manage.py createsuperuser
```

---

## Notas

- Todos los usuarios están **activos** por defecto
- Las contraseñas están **hasheadas** (no se almacenan en texto plano)
- El usuario `zoram` es **superusuario** y puede acceder al panel de administración
- Los usuarios están almacenados en la tabla `usuarios` en Neon PostgreSQL

---

## Próximos Pasos

1. **Implementar sistema de login** en las vistas
2. **Configurar permisos** por rol en las vistas
3. **Probar acceso** con cada usuario




