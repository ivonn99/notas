#!/usr/bin/env python
"""
Script para verificar la conexión con Neon PostgreSQL
Ejecutar: python verificar_neon.py
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
from django.core.management import execute_from_command_line


def verificar_conexion():
    """Verifica la conexión con Neon y muestra información"""
    
    print('=' * 70)
    print('VERIFICACION DE CONEXION A NEON POSTGRESQL')
    print('=' * 70)
    print()
    
    try:
        # Información de configuración
        db_config = connection.settings_dict
        print('[CONFIGURACION]')
        print(f'   Motor:        {db_config["ENGINE"]}')
        print(f'   Base de datos: {db_config.get("NAME", "N/A")}')
        print(f'   Host:          {db_config.get("HOST", "N/A")}')
        print(f'   Puerto:        {db_config.get("PORT", "N/A")}')
        print(f'   Usuario:       {db_config.get("USER", "N/A")}')
        print()
        
        # Probar conexión
        print('[PROBANDO CONEXION...]')
        cursor = connection.cursor()
        
        # Versión de PostgreSQL
        cursor.execute('SELECT version()')
        version = cursor.fetchone()[0]
        print(f'   [OK] Version PostgreSQL: {version.split(",")[0]}')
        
        # Información del servidor
        cursor.execute('''
            SELECT 
                current_database() as db,
                current_user as user,
                inet_server_addr() as ip,
                inet_server_port() as port
        ''')
        info = cursor.fetchone()
        print(f'   [OK] Base de datos: {info[0]}')
        print(f'   [OK] Usuario: {info[1]}')
        print(f'   [OK] IP del servidor: {info[2]}')
        print(f'   [OK] Puerto: {info[3]}')
        print()
        
        # Contar tablas
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        """)
        table_count = cursor.fetchone()[0]
        print(f'[TABLAS EN LA BASE DE DATOS: {table_count}]')
        print()
        
        # Listar tablas con conteo de registros
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE' 
            ORDER BY table_name
        """)
        tables = cursor.fetchall()
        
        if tables:
            print('   Tabla                          Registros')
            print('   ' + '-' * 50)
            for table in tables:
                table_name = table[0]
                try:
                    cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                    count = cursor.fetchone()[0]
                    print(f'   {table_name:30} {count:>10}')
                except Exception as e:
                    print(f'   {table_name:30} {"Error":>10}')
            print()
        
        # Verificar migraciones aplicadas
        cursor.execute("""
            SELECT COUNT(*) 
            FROM django_migrations
        """)
        migrations_count = cursor.fetchone()[0]
        print(f'[MIGRACIONES APLICADAS: {migrations_count}]')
        print()
        
        cursor.close()
        
        print('=' * 70)
        print('[OK] CONEXION EXITOSA - NEON ESTA FUNCIONANDO CORRECTAMENTE')
        print('=' * 70)
        return True
        
    except Exception as e:
        print()
        print('=' * 70)
        print('[ERROR] ERROR DE CONEXION')
        print('=' * 70)
        print(f'Error: {str(e)}')
        print()
        print('Verifica:')
        print('  1. Que la URL de Neon este correcta en el archivo .env')
        print('  2. Que tengas conexion a internet')
        print('  3. Que el proyecto de Neon este activo en el dashboard')
        print('=' * 70)
        return False


if __name__ == '__main__':
    try:
        success = verificar_conexion()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print('\n\n[AVISO] Verificacion cancelada por el usuario')
        sys.exit(1)
    except Exception as e:
        print(f'\n[ERROR] Error inesperado: {e}')
        sys.exit(1)

