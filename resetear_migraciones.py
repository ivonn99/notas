"""
Script para resetear las migraciones y aplicarlas en el orden correcto
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

cursor = connection.cursor()

# Eliminar registros de migraciones de admin, auth, contenttypes, sessions
print('Eliminando registros de migraciones anteriores...')
cursor.execute("""
    DELETE FROM django_migrations 
    WHERE app IN ('admin', 'auth', 'contenttypes', 'sessions', 'pagina')
""")
connection.commit()
print('[OK] Registros eliminados')

cursor.close()

# Aplicar todas las migraciones en el orden correcto
print('\nAplicando migraciones en el orden correcto...')
call_command('migrate', verbosity=2)

print('\n[OK] Migraciones aplicadas correctamente')




