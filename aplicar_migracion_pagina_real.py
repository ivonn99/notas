"""
Script para aplicar realmente la migración de pagina
"""
import os
from dotenv import load_dotenv
from django.conf import settings

load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proyecto.settings')

import django
django.setup()

from django.db import connection
from django.core.management import call_command

# Eliminar el registro falso de pagina
cursor = connection.cursor()
cursor.execute("DELETE FROM django_migrations WHERE app = 'pagina'")
connection.commit()
cursor.close()

print('[OK] Registro falso eliminado')
print('Aplicando migracion de pagina realmente...')

# Aplicar la migración realmente
call_command('migrate', 'pagina', verbosity=2)

print('\n[OK] Migracion aplicada')




