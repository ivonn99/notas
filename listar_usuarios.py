"""
Script para listar los usuarios creados
"""
import os
from dotenv import load_dotenv
from django.conf import settings

load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proyecto.settings')

import django
django.setup()

from pagina.models import Usuario

print('=' * 70)
print('USUARIOS CREADOS EN EL SISTEMA')
print('=' * 70)
print()

usuarios = Usuario.objects.all().order_by('rol', 'username')

for usuario in usuarios:
    print(f'Usuario: {usuario.username}')
    print(f'  Nombre: {usuario.nombre_completo}')
    print(f'  Email: {usuario.email}')
    print(f'  Rol: {usuario.get_rol_display()}')
    print(f'  Activo: {"Si" if usuario.activo else "No"}')
    print(f'  Superusuario: {"Si" if usuario.is_superuser else "No"}')
    print()

print('=' * 70)
print(f'Total: {usuarios.count()} usuarios')
print('=' * 70)




