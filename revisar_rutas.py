#!/usr/bin/env python
"""
Script para revisar las tablas rutas y usuario_rutas en Neon
Ejecutar: python revisar_rutas.py
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
from pagina.models import Ruta, UsuarioRuta, Usuario


def revisar_tabla_rutas():
    """Revisa la estructura y datos de la tabla rutas"""
    
    print('=' * 80)
    print('TABLA: RUTAS')
    print('=' * 80)
    print()
    
    cursor = connection.cursor()
    
    # 1. Estructura de la tabla
    print('[ESTRUCTURA DE LA TABLA]')
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
        AND table_name = 'rutas'
        ORDER BY ordinal_position
    """)
    
    columns = cursor.fetchall()
    if columns:
        print(f"{'Columna':<20} {'Tipo':<20} {'Longitud':<12} {'Nulo':<8} {'Default'}")
        print('-' * 80)
        for col in columns:
            col_name, data_type, max_length, nullable, default = col
            max_len_str = str(max_length) if max_length else '-'
            nullable_str = 'Sí' if nullable == 'YES' else 'No'
            default_str = str(default) if default else '-'
            print(f"{col_name:<20} {data_type:<20} {max_len_str:<12} {nullable_str:<8} {default_str}")
    else:
        print("   [ADVERTENCIA] Tabla 'rutas' no encontrada")
    print()
    
    # 2. Índices
    print('[ÍNDICES]')
    print('-' * 80)
    cursor.execute("""
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes
        WHERE tablename = 'rutas'
        AND schemaname = 'public'
    """)
    
    indexes = cursor.fetchall()
    if indexes:
        for idx_name, idx_def in indexes:
            print(f"   {idx_name}")
            print(f"   {idx_def}")
            print()
    else:
        print("   No hay índices definidos")
    print()
    
    # 3. Conteo de registros
    print('[REGISTROS]')
    print('-' * 80)
    try:
        cursor.execute('SELECT COUNT(*) FROM rutas')
        count = cursor.fetchone()[0]
        print(f"   Total de rutas: {count}")
        print()
        
        # 4. Datos de la tabla
        if count > 0:
            print('[DATOS DE LA TABLA]')
            print('-' * 80)
            cursor.execute("""
                SELECT 
                    id,
                    codigo,
                    nombre,
                    descripcion,
                    activa,
                    created_at
                FROM rutas
                ORDER BY codigo
            """)
            
            rutas = cursor.fetchall()
            print(f"{'ID':<6} {'Código':<15} {'Nombre':<30} {'Activa':<8} {'Creado'}")
            print('-' * 80)
            for ruta in rutas:
                ruta_id, codigo, nombre, descripcion, activa, created_at = ruta
                nombre_display = (nombre[:27] + '...') if nombre and len(nombre) > 30 else (nombre or '-')
                activa_str = 'Sí' if activa else 'No'
                created_str = str(created_at)[:19] if created_at else '-'
                print(f"{ruta_id:<6} {codigo:<15} {nombre_display:<30} {activa_str:<8} {created_str}")
        else:
            print("   [INFO] No hay registros en la tabla")
    except Exception as e:
        print(f"   [ERROR] Error al consultar datos: {e}")
    print()
    
    # 5. Usando el modelo Django
    print('[USANDO MODELO DJANGO]')
    print('-' * 80)
    try:
        rutas_django = Ruta.objects.all().order_by('codigo')
        print(f"   Total de rutas (Django ORM): {rutas_django.count()}")
        if rutas_django.exists():
            print()
            for ruta in rutas_django:
                print(f"   - {ruta.codigo} | {ruta.nombre} | Activa: {ruta.activa}")
    except Exception as e:
        print(f"   [ERROR] Error: {e}")
    print()


def revisar_tabla_usuario_rutas():
    """Revisa la estructura y datos de la tabla usuario_rutas"""
    
    print('=' * 80)
    print('TABLA: USUARIO_RUTAS')
    print('=' * 80)
    print()
    
    cursor = connection.cursor()
    
    # 1. Estructura de la tabla
    print('[ESTRUCTURA DE LA TABLA]')
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
        AND table_name = 'usuario_rutas'
        ORDER BY ordinal_position
    """)
    
    columns = cursor.fetchall()
    if columns:
        print(f"{'Columna':<20} {'Tipo':<20} {'Longitud':<12} {'Nulo':<8} {'Default'}")
        print('-' * 80)
        for col in columns:
            col_name, data_type, max_length, nullable, default = col
            max_len_str = str(max_length) if max_length else '-'
            nullable_str = 'Sí' if nullable == 'YES' else 'No'
            default_str = str(default) if default else '-'
            print(f"{col_name:<20} {data_type:<20} {max_len_str:<12} {nullable_str:<8} {default_str}")
    else:
        print("   [ADVERTENCIA] Tabla 'usuario_rutas' no encontrada")
    print()
    
    # 2. Foreign Keys
    print('[FOREIGN KEYS]')
    print('-' * 80)
    cursor.execute("""
        SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'usuario_rutas'
        AND tc.table_schema = 'public'
    """)
    
    fks = cursor.fetchall()
    if fks:
        for fk_name, col_name, foreign_table, foreign_col in fks:
            print(f"   {col_name} -> {foreign_table}.{foreign_col} ({fk_name})")
    else:
        print("   No hay foreign keys definidas")
    print()
    
    # 3. Índices
    print('[ÍNDICES]')
    print('-' * 80)
    cursor.execute("""
        SELECT 
            indexname,
            indexdef
        FROM pg_indexes
        WHERE tablename = 'usuario_rutas'
        AND schemaname = 'public'
    """)
    
    indexes = cursor.fetchall()
    if indexes:
        for idx_name, idx_def in indexes:
            print(f"   {idx_name}")
            print(f"   {idx_def}")
            print()
    else:
        print("   No hay índices definidos")
    print()
    
    # 4. Conteo de registros
    print('[REGISTROS]')
    print('-' * 80)
    try:
        cursor.execute('SELECT COUNT(*) FROM usuario_rutas')
        count = cursor.fetchone()[0]
        print(f"   Total de relaciones usuario-ruta: {count}")
        print()
        
        # 5. Datos de la tabla con JOINs
        if count > 0:
            print('[DATOS DE LA TABLA (con información de usuarios y rutas)]')
            print('-' * 80)
            cursor.execute("""
                SELECT 
                    ur.id,
                    u.username,
                    u.nombre_completo,
                    r.codigo,
                    r.nombre,
                    ur.created_at
                FROM usuario_rutas ur
                JOIN usuarios u ON ur.usuario_id = u.id
                JOIN rutas r ON ur.ruta_id = r.id
                ORDER BY u.username, r.codigo
            """)
            
            relaciones = cursor.fetchall()
            print(f"{'ID':<6} {'Usuario':<20} {'Nombre':<25} {'Ruta':<15} {'Nombre Ruta':<30}")
            print('-' * 80)
            for rel in relaciones:
                rel_id, username, nombre_completo, codigo_ruta, nombre_ruta, created_at = rel
                nombre_display = (nombre_completo[:22] + '...') if nombre_completo and len(nombre_completo) > 25 else (nombre_completo or '-')
                nombre_ruta_display = (nombre_ruta[:27] + '...') if nombre_ruta and len(nombre_ruta) > 30 else (nombre_ruta or '-')
                print(f"{rel_id:<6} {username:<20} {nombre_display:<25} {codigo_ruta:<15} {nombre_ruta_display:<30}")
        else:
            print("   [INFO] No hay registros en la tabla")
    except Exception as e:
        print(f"   [ERROR] Error al consultar datos: {e}")
        import traceback
        traceback.print_exc()
    print()
    
    # 6. Estadísticas
    print('[ESTADÍSTICAS]')
    print('-' * 80)
    try:
        # Usuarios con rutas asignadas
        cursor.execute("""
            SELECT COUNT(DISTINCT usuario_id) 
            FROM usuario_rutas
        """)
        usuarios_con_rutas = cursor.fetchone()[0]
        print(f"   Usuarios con rutas asignadas: {usuarios_con_rutas}")
        
        # Rutas asignadas a usuarios
        cursor.execute("""
            SELECT COUNT(DISTINCT ruta_id) 
            FROM usuario_rutas
        """)
        rutas_asignadas = cursor.fetchone()[0]
        print(f"   Rutas asignadas a usuarios: {rutas_asignadas}")
        
        # Rutas más asignadas
        cursor.execute("""
            SELECT 
                r.codigo,
                r.nombre,
                COUNT(ur.id) as total_usuarios
            FROM rutas r
            LEFT JOIN usuario_rutas ur ON r.id = ur.ruta_id
            GROUP BY r.id, r.codigo, r.nombre
            ORDER BY total_usuarios DESC, r.codigo
        """)
        rutas_stats = cursor.fetchall()
        if rutas_stats:
            print()
            print("   Rutas y cantidad de usuarios asignados:")
            for codigo, nombre, total in rutas_stats:
                nombre_display = (nombre[:40] + '...') if nombre and len(nombre) > 43 else (nombre or '-')
                print(f"      {codigo:<15} {nombre_display:<43} {total:>3} usuarios")
    except Exception as e:
        print(f"   [ERROR] Error al calcular estadísticas: {e}")
    print()
    
    # 7. Usando el modelo Django
    print('[USANDO MODELO DJANGO]')
    print('-' * 80)
    try:
        relaciones_django = UsuarioRuta.objects.select_related('usuario', 'ruta').all()
        print(f"   Total de relaciones (Django ORM): {relaciones_django.count()}")
        if relaciones_django.exists():
            print()
            for rel in relaciones_django[:10]:  # Mostrar solo las primeras 10
                print(f"   - {rel.usuario.username} -> {rel.ruta.codigo} ({rel.ruta.nombre})")
            if relaciones_django.count() > 10:
                print(f"   ... y {relaciones_django.count() - 10} más")
    except Exception as e:
        print(f"   [ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
    print()


def main():
    """Función principal"""
    
    print()
    print('=' * 80)
    print('REVISIÓN DE TABLAS: RUTAS Y USUARIO_RUTAS')
    print('=' * 80)
    print()
    
    try:
        # Verificar conexión
        cursor = connection.cursor()
        cursor.execute('SELECT version()')
        version = cursor.fetchone()[0]
        print(f'[CONECTADO A NEON POSTGRESQL]')
        print(f'   {version.split(",")[0]}')
        print()
        
        # Revisar tabla rutas
        revisar_tabla_rutas()
        
        # Revisar tabla usuario_rutas
        revisar_tabla_usuario_rutas()
        
        print('=' * 80)
        print('[REVISIÓN COMPLETADA]')
        print('=' * 80)
        print()
        
    except Exception as e:
        print()
        print('=' * 80)
        print(f'[ERROR] {e}')
        print('=' * 80)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

