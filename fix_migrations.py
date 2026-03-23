"""
Script para corregir el orden de migraciones
Ejecutar: python fix_migrations.py
"""
import os
from dotenv import load_dotenv
from django.conf import settings

load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proyecto.settings')

import django
django.setup()

from django.db import connection
from django.utils import timezone

cursor = connection.cursor()

# Marcar la migración de pagina como aplicada
try:
    cursor.execute(
        "INSERT INTO django_migrations (app, name, applied) VALUES (%s, %s, %s)",
        ['pagina', '0001_initial', timezone.now()]
    )
    connection.commit()
    print('[OK] Migracion de pagina marcada como aplicada')
except Exception as e:
    print(f'[INFO] {e}')

cursor.close()

print('\nAhora ejecuta: python manage.py migrate')




