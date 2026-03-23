#!/usr/bin/env python
"""
Script para crear rutas de prueba
Ejecutar: python crear_rutas_prueba.py
"""

import os
import sys
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

# Configurar Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proyecto.settings')

import django
django.setup()

from pagina.models import Ruta


def crear_rutas_prueba():
    """Crea rutas de prueba"""
    
    print('=' * 70)
    print('CREANDO RUTAS DE PRUEBA')
    print('=' * 70)
    print()
    
    rutas_prueba = [
        {
            'codigo': 'RUTA-001',
            'nombre': 'Ruta Norte',
            'descripcion': 'Ruta que cubre la zona norte de la ciudad',
            'activa': True,
        },
        {
            'codigo': 'RUTA-002',
            'nombre': 'Ruta Sur',
            'descripcion': 'Ruta que cubre la zona sur de la ciudad',
            'activa': True,
        },
    ]
    
    creadas = 0
    actualizadas = 0
    
    for ruta_data in rutas_prueba:
        ruta, created = Ruta.objects.update_or_create(
            codigo=ruta_data['codigo'],
            defaults={
                'nombre': ruta_data['nombre'],
                'descripcion': ruta_data['descripcion'],
                'activa': ruta_data['activa'],
            }
        )
        
        if created:
            creadas += 1
            print(f'[OK] Creada ruta: {ruta.codigo} - {ruta.nombre}')
        else:
            actualizadas += 1
            print(f'[ACTUALIZADA] Ruta: {ruta.codigo} - {ruta.nombre}')
    
    print()
    print('=' * 70)
    print(f'[OK] Proceso completado: {creadas} creadas, {actualizadas} actualizadas')
    print('=' * 70)
    print()
    
    # Mostrar todas las rutas
    print('Rutas en la base de datos:')
    print('-' * 70)
    for ruta in Ruta.objects.all().order_by('codigo'):
        print(f'  - {ruta.codigo} | {ruta.nombre} | Activa: {ruta.activa}')


if __name__ == '__main__':
    crear_rutas_prueba()




