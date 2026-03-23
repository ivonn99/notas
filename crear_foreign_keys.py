"""
Script para crear los foreign keys con sintaxis correcta de PostgreSQL
"""
import os
from dotenv import load_dotenv
from django.conf import settings

load_dotenv()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'proyecto.settings')

import django
django.setup()

from django.db import connection

cursor = connection.cursor()

# Foreign keys con verificación
foreign_keys = [
    ('usuario_rutas', 'ruta_id', 'rutas', 'id', 'usuario_rutas_ruta_id_468ec4cd_fk_rutas_id'),
    ('usuario_rutas', 'usuario_id', 'usuarios', 'id', 'usuario_rutas_usuario_id_20db5479_fk_usuarios_id'),
    ('notas_credito', 'ruta_id', 'rutas', 'id', 'notas_credito_ruta_id_edd95f93_fk_rutas_id'),
    ('notas_credito', 'usuario_id', 'usuarios', 'id', 'notas_credito_usuario_id_fe8865fe_fk_usuarios_id'),
    ('importaciones', 'usuario_id', 'usuarios', 'id', 'importaciones_usuario_id_dc15351a_fk_usuarios_id'),
    ('historial_notas', 'nota_id', 'notas_credito', 'id', 'historial_notas_nota_id_7f3166de_fk_notas_credito_id', True),
    ('historial_notas', 'usuario_id', 'usuarios', 'id', 'historial_notas_usuario_id_df96e4ff_fk_usuarios_id'),
    ('documentos', 'nota_id', 'notas_credito', 'id', 'documentos_nota_id_2902a736_fk_notas_credito_id', True),
    ('documentos', 'usuario_id', 'usuarios', 'id', 'documentos_usuario_id_3f82df78_fk_usuarios_id'),
    ('alertas', 'nota_id', 'notas_credito', 'id', 'alertas_nota_id_7f4c2ed7_fk_notas_credito_id', True),
    ('alertas', 'usuario_asignado_id', 'usuarios', 'id', 'alertas_usuario_asignado_id_c2e76347_fk_usuarios_id'),
    ('aclaraciones', 'nota_id', 'notas_credito', 'id', 'aclaraciones_nota_id_dd10c42d_fk_notas_credito_id', True),
    ('aclaraciones', 'usuario_id', 'usuarios', 'id', 'aclaraciones_usuario_id_631bcfd4_fk_usuarios_id'),
    ('usuarios_groups', 'usuario_id', 'usuarios', 'id', 'usuarios_groups_usuario_id_1132ca50_fk_usuarios_id'),
    ('usuarios_groups', 'group_id', 'auth_group', 'id', 'usuarios_groups_group_id_18c61092_fk_auth_group_id'),
    ('usuarios_user_permissions', 'usuario_id', 'usuarios', 'id', 'usuarios_user_permissions_usuario_id_232fd58d_fk_usuarios_id'),
    ('usuarios_user_permissions', 'permission_id', 'auth_permission', 'id', 'usuarios_user_permis_permission_id_af615ca1_fk_auth_perm'),
]

print('Creando foreign keys...')
creados = 0

for fk in foreign_keys:
    table, column, ref_table, ref_column, constraint_name = fk[:5]
    on_delete = 'ON DELETE CASCADE' if len(fk) > 5 and fk[5] else ''
    
    # Verificar si el constraint ya existe
    cursor.execute("""
        SELECT 1 FROM pg_constraint 
        WHERE conname = %s
    """, [constraint_name])
    
    if cursor.fetchone():
        print(f'[INFO] {constraint_name} ya existe')
        continue
    
    # Crear el constraint
    if on_delete:
        sql = f"""
            ALTER TABLE "{table}" 
            ADD CONSTRAINT "{constraint_name}" 
            FOREIGN KEY ("{column}") 
            REFERENCES "{ref_table}" ("{ref_column}") 
            {on_delete}
        """
    else:
        sql = f"""
            ALTER TABLE "{table}" 
            ADD CONSTRAINT "{constraint_name}" 
            FOREIGN KEY ("{column}") 
            REFERENCES "{ref_table}" ("{ref_column}") 
            DEFERRABLE INITIALLY DEFERRED
        """
    
    try:
        cursor.execute(sql)
        creados += 1
        print(f'[OK] {constraint_name}')
    except Exception as e:
        print(f'[ERROR] {constraint_name}: {e}')

connection.commit()
cursor.close()

print(f'\n[OK] {creados} foreign keys creados')

