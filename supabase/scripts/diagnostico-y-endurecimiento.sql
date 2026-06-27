-- =============================================================================
-- Notas de crédito — Diagnóstico + endurecimiento de BD (Supabase SQL Editor)
-- =============================================================================
-- Cómo usar:
--   1. Ejecuta solo la PARTE A (diagnóstico) y revisa los resultados.
--   2. Si hay duplicados o datos inválidos, corrígelos antes de la PARTE B.
--   3. Ejecuta la PARTE B (endurecimiento) en una ventana aparte o tras revisar.
--
-- Es idempotente donde es posible (IF NOT EXISTS). Algunos CHECK pueden fallar
-- si ya existen filas que los violan; en ese caso revisa la PARTE A.4.
-- =============================================================================


-- =============================================================================
-- PARTE A — DIAGNÓSTICO (solo lectura)
-- =============================================================================

-- A.1 Conteos por tabla
SELECT 'A.1 conteos' AS seccion, 'rutas' AS tabla, COUNT(*)::bigint AS filas FROM public.rutas
UNION ALL SELECT 'A.1 conteos', 'usuarios', COUNT(*) FROM public.usuarios
UNION ALL SELECT 'A.1 conteos', 'usuario_rutas', COUNT(*) FROM public.usuario_rutas
UNION ALL SELECT 'A.1 conteos', 'notas_credito', COUNT(*) FROM public.notas_credito
UNION ALL SELECT 'A.1 conteos', 'aclaraciones', COUNT(*) FROM public.aclaraciones
UNION ALL SELECT 'A.1 conteos', 'historial_notas', COUNT(*) FROM public.historial_notas
UNION ALL SELECT 'A.1 conteos', 'documentos', COUNT(*) FROM public.documentos
UNION ALL SELECT 'A.1 conteos', 'alertas', COUNT(*) FROM public.alertas
UNION ALL SELECT 'A.1 conteos', 'importaciones', COUNT(*) FROM public.importaciones
UNION ALL SELECT 'A.1 conteos', 'parametros', COUNT(*) FROM public.parametros
UNION ALL SELECT 'A.1 conteos', 'auditoria_eventos', COUNT(*) FROM public.auditoria_eventos
ORDER BY tabla;

-- A.2 Duplicados críticos: notas (empresa + serie_folio)
SELECT 'A.2 dup notas' AS seccion, empresa, serie_folio, COUNT(*) AS veces
FROM public.notas_credito
GROUP BY empresa, serie_folio
HAVING COUNT(*) > 1
ORDER BY veces DESC, empresa, serie_folio
LIMIT 50;

-- A.3 Duplicados rutas (codigo exacto e insensible a mayúsculas)
SELECT 'A.3 dup rutas exacto' AS seccion, codigo, COUNT(*) AS veces
FROM public.rutas
GROUP BY codigo
HAVING COUNT(*) > 1
ORDER BY veces DESC
LIMIT 50;

SELECT 'A.3 dup rutas upper' AS seccion, upper(trim(codigo)) AS codigo_norm, COUNT(*) AS veces
FROM public.rutas
GROUP BY upper(trim(codigo))
HAVING COUNT(*) > 1
ORDER BY veces DESC
LIMIT 50;

-- A.4 Duplicados usuario_rutas
SELECT 'A.4 dup usuario_rutas' AS seccion, usuario_id, ruta_id, COUNT(*) AS veces
FROM public.usuario_rutas
GROUP BY usuario_id, ruta_id
HAVING COUNT(*) > 1
ORDER BY veces DESC
LIMIT 50;

-- A.5 Datos que bloquearían CHECKs de negocio
SELECT 'A.5 empresa invalida' AS seccion, COUNT(*) AS filas
FROM public.notas_credito
WHERE empresa NOT IN ('DISTRIBUIDORA', 'RODRIGO');

SELECT 'A.5 saldo incoherente' AS seccion, COUNT(*) AS filas
FROM public.notas_credito
WHERE saldo IS DISTINCT FROM (monto - abono);

SELECT 'A.5 atencion en no pendiente' AS seccion, COUNT(*) AS filas
FROM public.notas_credito
WHERE requiere_atencion = true AND estado <> 'PENDIENTE';

SELECT 'A.5 activo vs is_active' AS seccion, COUNT(*) AS filas
FROM public.usuarios
WHERE activo IS DISTINCT FROM is_active;

SELECT 'A.5 importaciones estado raro' AS seccion, estado, COUNT(*) AS filas
FROM public.importaciones
GROUP BY estado
ORDER BY filas DESC;

SELECT 'A.5 aclaraciones tipo raro' AS seccion, tipo, COUNT(*) AS filas
FROM public.aclaraciones
GROUP BY tipo
ORDER BY filas DESC;

-- A.6 RLS habilitado por tabla
SELECT
  'A.6 rls' AS seccion,
  c.relname AS tabla,
  c.relrowsecurity AS rls_activo,
  c.relforcerowsecurity AS rls_forzado
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'rutas', 'usuarios', 'usuario_rutas', 'notas_credito', 'aclaraciones',
    'historial_notas', 'documentos', 'alertas', 'importaciones', 'parametros',
    'auditoria_eventos'
  )
ORDER BY c.relname;

-- A.7 Políticas RLS (busca peligro: rol anon en usuarios)
SELECT
  'A.7 policies' AS seccion,
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual IS NOT NULL AS tiene_using,
  with_check IS NOT NULL AS tiene_with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- A.8 Grants peligrosos al rol anon en usuarios
SELECT
  'A.8 grants anon usuarios' AS seccion,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND grantee = 'anon'
ORDER BY privilege_type;

-- A.9 Funciones helper RLS (deben existir si usas PostgREST + db-login-jwt)
SELECT
  'A.9 funciones rls' AS seccion,
  p.proname AS funcion,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'jwt_usuario_id', 'jwt_rol', 'jwt_is_superuser', 'jwt_is_admin',
    'jwt_is_credito_o_admin', 'vendedor_puede_ver_nota'
  )
ORDER BY p.proname;

-- A.10 Índices existentes en tablas clave
SELECT
  'A.10 indices' AS seccion,
  t.relname AS tabla,
  i.relname AS indice,
  pg_get_indexdef(ix.indexrelid) AS definicion
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname IN (
    'notas_credito', 'rutas', 'usuario_rutas', 'aclaraciones',
    'historial_notas', 'documentos', 'alertas', 'importaciones', 'auditoria_eventos'
  )
ORDER BY t.relname, i.relname;


-- =============================================================================
-- PARTE B — ENDURECIMIENTO (escritura; ejecutar tras revisar PARTE A)
-- =============================================================================
-- Si A.2 devuelve filas → unifica duplicados antes de B.1
-- Si A.3 devuelve filas → unifica rutas antes de B.2
-- Si A.5 saldo incoherente > 0 → ejecuta B.0 antes de B.5
-- Si A.5 atencion en no pendiente > 0 → ejecuta B.0b antes de B.5
-- =============================================================================

BEGIN;

-- B.0 Corregir saldo = monto - abono (solo filas inconsistentes)
UPDATE public.notas_credito
SET saldo = monto - abono
WHERE saldo IS DISTINCT FROM (monto - abono);

-- B.0b Apagar requiere_atencion en notas no PENDIENTE
UPDATE public.notas_credito
SET requiere_atencion = false
WHERE requiere_atencion = true
  AND estado <> 'PENDIENTE';

-- B.0c Sincronizar activo e is_active (preferencia: desactivado gana)
UPDATE public.usuarios
SET activo = false, is_active = false
WHERE activo IS DISTINCT FROM is_active
  AND (activo = false OR is_active = false);

UPDATE public.usuarios
SET is_active = activo
WHERE activo IS DISTINCT FROM is_active;

-- B.1 UNIQUE notas: empresa + serie_folio (crítico para importación / upsert)
CREATE UNIQUE INDEX IF NOT EXISTS notas_credito_empresa_serie_folio_uidx
  ON public.notas_credito (empresa, serie_folio);

-- B.2 UNIQUE rutas por código normalizado (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS rutas_codigo_upper_uidx
  ON public.rutas (upper(trim(codigo)));

-- B.3 UNIQUE asignación usuario ↔ ruta
CREATE UNIQUE INDEX IF NOT EXISTS usuario_rutas_usuario_ruta_uidx
  ON public.usuario_rutas (usuario_id, ruta_id);

-- B.4 Índices de consulta frecuente
CREATE INDEX IF NOT EXISTS idx_notas_empresa_estado_atencion
  ON public.notas_credito (empresa, estado, requiere_atencion);

CREATE INDEX IF NOT EXISTS idx_notas_empresa_fecha_nota
  ON public.notas_credito (empresa, fecha_nota);

CREATE INDEX IF NOT EXISTS idx_notas_ruta_id
  ON public.notas_credito (ruta_id);

CREATE INDEX IF NOT EXISTS idx_notas_fecha_ultima_actualizacion
  ON public.notas_credito (fecha_ultima_actualizacion DESC);

CREATE INDEX IF NOT EXISTS idx_usuario_rutas_usuario_id
  ON public.usuario_rutas (usuario_id);

CREATE INDEX IF NOT EXISTS idx_usuario_rutas_ruta_id
  ON public.usuario_rutas (ruta_id);

CREATE INDEX IF NOT EXISTS idx_aclaraciones_nota_id
  ON public.aclaraciones (nota_id);

CREATE INDEX IF NOT EXISTS idx_aclaraciones_nota_created
  ON public.aclaraciones (nota_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_historial_notas_nota_id
  ON public.historial_notas (nota_id);

CREATE INDEX IF NOT EXISTS idx_documentos_nota_id
  ON public.documentos (nota_id);

CREATE INDEX IF NOT EXISTS idx_alertas_nota_id
  ON public.alertas (nota_id);

CREATE INDEX IF NOT EXISTS idx_alertas_leida
  ON public.alertas (leida, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_importaciones_created_at
  ON public.importaciones (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_created_at
  ON public.auditoria_eventos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_usuario_id
  ON public.auditoria_eventos (usuario_id);

CREATE INDEX IF NOT EXISTS idx_auditoria_eventos_accion
  ON public.auditoria_eventos (accion);

-- B.5 CHECKs de dominio (fallan si A.5 aún reporta filas inválidas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notas_credito_empresa_chk'
  ) THEN
    ALTER TABLE public.notas_credito
      ADD CONSTRAINT notas_credito_empresa_chk
      CHECK (empresa IN ('DISTRIBUIDORA', 'RODRIGO'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notas_credito_saldo_chk'
  ) THEN
    ALTER TABLE public.notas_credito
      ADD CONSTRAINT notas_credito_saldo_chk
      CHECK (saldo = monto - abono);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notas_credito_atencion_estado_chk'
  ) THEN
    ALTER TABLE public.notas_credito
      ADD CONSTRAINT notas_credito_atencion_estado_chk
      CHECK (NOT requiere_atencion OR estado = 'PENDIENTE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'importaciones_estado_chk'
  ) THEN
    ALTER TABLE public.importaciones
      ADD CONSTRAINT importaciones_estado_chk
      CHECK (estado IN ('COMPLETADA', 'FALLIDA', 'PARCIAL', 'EN_PROCESO'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aclaraciones_tipo_chk'
  ) THEN
    ALTER TABLE public.aclaraciones
      ADD CONSTRAINT aclaraciones_tipo_chk
      CHECK (tipo IN ('COMENTARIO', 'ACLARACION', 'SEGUIMIENTO'));
  END IF;
END $$;

COMMIT;


-- =============================================================================
-- PARTE C — SEGURIDAD: revocar acceso anon a usuarios (si A.8 muestra grants)
-- =============================================================================
-- Ejecuta aparte solo si confirmaste que NO necesitas el modo demo.
-- =============================================================================

/*
BEGIN;

DROP POLICY IF EXISTS usuarios_anon_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_anon_insert ON public.usuarios;
DROP POLICY IF EXISTS usuarios_anon_update ON public.usuarios;
DROP POLICY IF EXISTS usuarios_anon_delete ON public.usuarios;

REVOKE ALL ON TABLE public.usuarios FROM anon;

DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('public.usuarios', 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon', seq_name);
  END IF;
END $$;

COMMIT;
*/


-- =============================================================================
-- PARTE D — Verificación final (ejecutar después de B)
-- =============================================================================

SELECT 'D.1 indices nuevos' AS seccion, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'notas_credito_empresa_serie_folio_uidx',
    'rutas_codigo_upper_uidx',
    'usuario_rutas_usuario_ruta_uidx',
    'idx_notas_empresa_estado_atencion',
    'idx_notas_empresa_fecha_nota',
    'idx_notas_ruta_id'
  )
ORDER BY indexname;

SELECT 'D.2 constraints nuevos' AS seccion, conname, contype, pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conname IN (
    'notas_credito_empresa_chk',
    'notas_credito_saldo_chk',
    'notas_credito_atencion_estado_chk',
    'importaciones_estado_chk',
    'aclaraciones_tipo_chk'
  )
ORDER BY conname;
