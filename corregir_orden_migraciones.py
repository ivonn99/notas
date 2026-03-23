"""
Script para corregir el orden de migraciones
"""
import os
from dotenv import load_dotenv
from django.conf import settings
from django.utils import timezone
from datetime import timedelta

load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proyecto.settings')

import django
django.setup()

from django.db import connection

cursor = connection.cursor()

# Obtener la fecha de admin.0001_initial
cursor.execute("""
    SELECT applied FROM django_migrations 
    WHERE app = 'admin' AND name = '0001_initial'
    LIMIT 1
""")
result = cursor.fetchone()

if result:
    admin_date = result[0]
    # Marcar pagina.0001_initial con una fecha anterior
    pagina_date = admin_date - timedelta(seconds=1)
    
    # Eliminar si existe
    cursor.execute("DELETE FROM django_migrations WHERE app = 'pagina' AND name = '0001_initial'")
    
    # Insertar con fecha anterior
    cursor.execute("""
        INSERT INTO django_migrations (app, name, applied)
        VALUES (%s, %s, %s)
    """, ['pagina', '0001_initial', pagina_date])
    
    connection.commit()
    print(f'[OK] Migracion pagina.0001_initial marcada con fecha anterior a admin')
else:
    print('[INFO] No se encontro admin.0001_initial')

cursor.close()

print('\nAhora ejecuta: python manage.py migrate pagina')




