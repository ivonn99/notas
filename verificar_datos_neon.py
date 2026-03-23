"""
Script para verificar qué datos hay en Neon después del reset
"""
import os
from dotenv import load_dotenv
from django.conf import settings

load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proyecto.settings')

import django
django.setup()

from django.db import connection
from pagina.models import Usuario, Ruta, NotaCredito, Parametro, Importacion

print("=" * 70)
print("VERIFICACIÓN DE DATOS EN NEON")
print("=" * 70)
print()

# Verificar usuarios
usuarios_count = Usuario.objects.count()
print(f"[USUARIOS] Total: {usuarios_count}")
if usuarios_count > 0:
    usuarios = Usuario.objects.all()[:5]
    for u in usuarios:
        print(f"  - {u.username} ({u.get_rol_display()})")
print()

# Verificar rutas
rutas_count = Ruta.objects.count()
print(f"[RUTAS] Total: {rutas_count}")
if rutas_count > 0:
    rutas = Ruta.objects.all()[:5]
    for r in rutas:
        print(f"  - {r.codigo} - {r.nombre}")
print()

# Verificar notas de crédito
notas_count = NotaCredito.objects.count()
print(f"[NOTAS DE CRÉDITO] Total: {notas_count}")
print()

# Verificar parámetros
parametros_count = Parametro.objects.count()
print(f"[PARÁMETROS] Total: {parametros_count}")
if parametros_count > 0:
    parametros = Parametro.objects.all()
    for p in parametros:
        print(f"  - {p.clave} = {p.valor}")
print()

# Verificar importaciones
importaciones_count = Importacion.objects.count()
print(f"[IMPORTACIONES] Total: {importaciones_count}")
print()

print("=" * 70)
print("VERIFICACIÓN DE TABLAS EN BASE DE DATOS")
print("=" * 70)

cursor = connection.cursor()
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('usuarios', 'rutas', 'notas_credito', 'parametros', 'importaciones')
    ORDER BY table_name
""")
tablas = cursor.fetchall()
print(f"\nTablas encontradas: {len(tablas)}")
for tabla in tablas:
    cursor.execute(f"SELECT COUNT(*) FROM {tabla[0]}")
    count = cursor.fetchone()[0]
    print(f"  - {tabla[0]}: {count} registros")

cursor.close()

print()
print("=" * 70)




