"""
Script para probar la autenticación de usuarios
"""
import os
from dotenv import load_dotenv
from django.conf import settings

load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proyecto.settings')

import django
django.setup()

from django.contrib.auth import authenticate

usuarios_prueba = [
    ('zoram', '1995'),
    ('vendedor1', 'vendedor123'),
    ('credito1', 'credito123'),
]

print('=' * 70)
print('PRUEBA DE AUTENTICACION')
print('=' * 70)
print()

for username, password in usuarios_prueba:
    user = authenticate(username=username, password=password)
    if user:
        print(f'[OK] {username:15} | Password: {password:15} | Rol: {user.get_rol_display()}')
    else:
        print(f'[ERROR] {username:15} | Password: {password:15} | No autenticado')

print()
print('=' * 70)




