"""
Script para aplicar las migraciones de pagina realmente
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

# Verificar si las tablas existen
cursor = connection.cursor()
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('usuarios', 'rutas', 'notas_credito', 'parametros')
""")
tablas_existentes = [row[0] for row in cursor.fetchall()]
cursor.close()

print(f'Tablas existentes: {tablas_existentes}')

if not tablas_existentes:
    print('Aplicando migraciones de pagina...')
    # Eliminar el registro falso
    cursor = connection.cursor()
    cursor.execute("DELETE FROM django_migrations WHERE app = 'pagina'")
    connection.commit()
    cursor.close()
    
    # Aplicar la migración real
    call_command('migrate', 'pagina', verbosity=2)
    print('\n[OK] Migraciones aplicadas')
else:
    print('[INFO] Las tablas ya existen')




