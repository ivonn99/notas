#!/usr/bin/env python
"""
Script para verificar que la columna empresa se agregó a notas_credito
Ejecutar: python verificar_columna_empresa.py
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

from django.db import connection


def verificar_columna_empresa():
    """Verifica que la columna empresa existe en la tabla notas_credito"""
    
    print('=' * 80)
    print('VERIFICACIÓN: COLUMNA EMPRESA EN NOTAS_CREDITO')
    print('=' * 80)
    print()
    
    cursor = connection.cursor()
    
    # Verificar estructura de la tabla
    print('[ESTRUCTURA DE LA TABLA notas_credito]')
    print('-' * 80)
    cursor.execute("""
        SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'notas_credito'
        AND column_name = 'empresa'
        ORDER BY ordinal_position
    """)
    
    column = cursor.fetchone()
    if column:
        col_name, data_type, max_length, nullable, default = column
        print(f"   Columna encontrada: {col_name}")
        print(f"   Tipo: {data_type}")
        print(f"   Longitud máxima: {max_length}")
        print(f"   Permite NULL: {'Sí' if nullable == 'YES' else 'No'}")
        print(f"   Valor por defecto: {default if default else 'Ninguno'}")
        print()
        print('=' * 80)
        print('[OK] La columna "empresa" se agregó correctamente a la tabla notas_credito')
        print('=' * 80)
    else:
        print("   [ERROR] La columna 'empresa' no se encontró en la tabla")
        print()
        print('Todas las columnas de la tabla:')
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = 'notas_credito'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        for col in columns:
            print(f"   - {col[0]} ({col[1]})")
    
    cursor.close()
    print()


if __name__ == '__main__':
    verificar_columna_empresa()




