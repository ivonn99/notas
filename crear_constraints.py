"""
Script para crear los constraints y foreign keys faltantes
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

# Constraints y foreign keys
constraints_sql = [
    # Unique constraint para usuario_rutas
    """DO $$ BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'usuario_rutas_usuario_id_ruta_id_60f54d57_uniq'
        ) THEN
            ALTER TABLE "usuario_rutas" ADD CONSTRAINT "usuario_rutas_usuario_id_ruta_id_60f54d57_uniq" UNIQUE ("usuario_id", "ruta_id");
        END IF;
    END $$;""",
    
    # Foreign keys
    """ALTER TABLE "usuario_rutas" ADD CONSTRAINT IF NOT EXISTS "usuario_rutas_ruta_id_468ec4cd_fk_rutas_id" FOREIGN KEY ("ruta_id") REFERENCES "rutas" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "usuario_rutas" ADD CONSTRAINT IF NOT EXISTS "usuario_rutas_usuario_id_20db5479_fk_usuarios_id" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "notas_credito" ADD CONSTRAINT IF NOT EXISTS "notas_credito_ruta_id_edd95f93_fk_rutas_id" FOREIGN KEY ("ruta_id") REFERENCES "rutas" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "notas_credito" ADD CONSTRAINT IF NOT EXISTS "notas_credito_usuario_id_fe8865fe_fk_usuarios_id" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "importaciones" ADD CONSTRAINT IF NOT EXISTS "importaciones_usuario_id_dc15351a_fk_usuarios_id" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "historial_notas" ADD CONSTRAINT IF NOT EXISTS "historial_notas_nota_id_7f3166de_fk_notas_credito_id" FOREIGN KEY ("nota_id") REFERENCES "notas_credito" ("id") DEFERRABLE INITIALLY DEFERRED ON DELETE CASCADE;""",
    """ALTER TABLE "historial_notas" ADD CONSTRAINT IF NOT EXISTS "historial_notas_usuario_id_df96e4ff_fk_usuarios_id" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "documentos" ADD CONSTRAINT IF NOT EXISTS "documentos_nota_id_2902a736_fk_notas_credito_id" FOREIGN KEY ("nota_id") REFERENCES "notas_credito" ("id") DEFERRABLE INITIALLY DEFERRED ON DELETE CASCADE;""",
    """ALTER TABLE "documentos" ADD CONSTRAINT IF NOT EXISTS "documentos_usuario_id_3f82df78_fk_usuarios_id" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "alertas" ADD CONSTRAINT IF NOT EXISTS "alertas_nota_id_7f4c2ed7_fk_notas_credito_id" FOREIGN KEY ("nota_id") REFERENCES "notas_credito" ("id") DEFERRABLE INITIALLY DEFERRED ON DELETE CASCADE;""",
    """ALTER TABLE "alertas" ADD CONSTRAINT IF NOT EXISTS "alertas_usuario_asignado_id_c2e76347_fk_usuarios_id" FOREIGN KEY ("usuario_asignado_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "aclaraciones" ADD CONSTRAINT IF NOT EXISTS "aclaraciones_nota_id_dd10c42d_fk_notas_credito_id" FOREIGN KEY ("nota_id") REFERENCES "notas_credito" ("id") DEFERRABLE INITIALLY DEFERRED ON DELETE CASCADE;""",
    """ALTER TABLE "aclaraciones" ADD CONSTRAINT IF NOT EXISTS "aclaraciones_usuario_id_631bcfd4_fk_usuarios_id" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "usuarios_groups" ADD CONSTRAINT IF NOT EXISTS "usuarios_groups_usuario_id_1132ca50_fk_usuarios_id" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "usuarios_groups" ADD CONSTRAINT IF NOT EXISTS "usuarios_groups_group_id_18c61092_fk_auth_group_id" FOREIGN KEY ("group_id") REFERENCES "auth_group" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "usuarios_user_permissions" ADD CONSTRAINT IF NOT EXISTS "usuarios_user_permissions_usuario_id_232fd58d_fk_usuarios_id" FOREIGN KEY ("usuario_id") REFERENCES "usuarios" ("id") DEFERRABLE INITIALLY DEFERRED;""",
    """ALTER TABLE "usuarios_user_permissions" ADD CONSTRAINT IF NOT EXISTS "usuarios_user_permis_permission_id_af615ca1_fk_auth_perm" FOREIGN KEY ("permission_id") REFERENCES "auth_permission" ("id") DEFERRABLE INITIALLY DEFERRED;""",
]

print('Creando constraints y foreign keys...')
for sql in constraints_sql:
    try:
        cursor.execute(sql)
        print(f'[OK] Constraint creado')
    except Exception as e:
        if 'already exists' not in str(e).lower() and 'duplicate' not in str(e).lower():
            print(f'[INFO] {e}')

connection.commit()
cursor.close()

print('\n[OK] Constraints creados')




