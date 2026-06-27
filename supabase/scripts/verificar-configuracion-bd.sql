-- =============================================================================
-- Verificación de configuración BD — Notas de crédito
-- =============================================================================
-- Solo lectura. Ejecuta TODO en Supabase → SQL Editor y pega los resultados
-- completos en el chat para revisión.
--
-- Resultado esperado (resumen):
--   V.1  → 11 tablas, rls_activo = true en todas
--   V.2  → 0 filas (sin grants anon en usuarios)
--   V.3  → 0 filas (sin policies anon)
--   V.4  → 6 funciones RLS
--   V.5  → índices UNIQUE críticos presentes
--   V.6  → 5 CHECK constraints de negocio
--   V.7  → 0 filas en duplicados e inconsistencias
--   V.8  → resumen OK / REVISAR por sección
-- =============================================================================


-- -----------------------------------------------------------------------------
-- V.1 RLS activo por tabla
-- Esperado: rls_activo = true en las 11 tablas
-- -----------------------------------------------------------------------------
SELECT
  'V.1' AS verificacion,
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


-- -----------------------------------------------------------------------------
-- V.2 Grants del rol anon en tablas sensibles
-- Esperado: 0 filas (sobre todo usuarios)
-- -----------------------------------------------------------------------------
SELECT
  'V.2' AS verificacion,
  table_name AS tabla,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee = 'anon'
  AND table_name IN (
    'usuarios', 'notas_credito', 'importaciones', 'parametros', 'auditoria_eventos'
  )
ORDER BY table_name, privilege_type;


-- -----------------------------------------------------------------------------
-- V.3 Políticas RLS del rol anon
-- Esperado: 0 filas
-- -----------------------------------------------------------------------------
SELECT
  'V.3' AS verificacion,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
  AND 'anon' = ANY(roles)
ORDER BY tablename, policyname;


-- -----------------------------------------------------------------------------
-- V.4 Funciones helper RLS (login db-jwt + PostgREST)
-- Esperado: 6 filas
-- -----------------------------------------------------------------------------
SELECT
  'V.4' AS verificacion,
  p.proname AS funcion,
  pg_get_function_identity_arguments(p.oid) AS argumentos
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'jwt_usuario_id', 'jwt_rol', 'jwt_is_superuser', 'jwt_is_admin',
    'jwt_is_credito_o_admin', 'vendedor_puede_ver_nota'
  )
ORDER BY p.proname;


-- -----------------------------------------------------------------------------
-- V.5 Índices críticos (integridad + rendimiento)
-- Esperado: al menos los 3 UNIQUE marcados como critico
-- -----------------------------------------------------------------------------
SELECT
  'V.5' AS verificacion,
  t.relname AS tabla,
  i.relname AS indice,
  ix.indisunique AS es_unique,
  CASE
    WHEN i.relname IN (
      'notas_credito_empresa_serie_folio_uidx',
      'rutas_codigo_upper_uidx',
      'usuario_rutas_usuario_ruta_uidx'
    ) THEN 'CRITICO'
    ELSE 'recomendado'
  END AS prioridad
FROM pg_index ix
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_class t ON t.oid = ix.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND (
    i.relname IN (
      'notas_credito_empresa_serie_folio_uidx',
      'rutas_codigo_upper_uidx',
      'usuario_rutas_usuario_ruta_uidx',
      'idx_notas_empresa_estado_atencion',
      'idx_notas_empresa_fecha_nota',
      'idx_notas_ruta_id',
      'idx_aclaraciones_nota_id',
      'idx_usuario_rutas_usuario_id'
    )
    OR (t.relname = 'notas_credito' AND ix.indisunique AND pg_get_indexdef(ix.indexrelid) ILIKE '%empresa%')
  )
ORDER BY prioridad, tabla, indice;


-- -----------------------------------------------------------------------------
-- V.6 CHECK constraints de negocio
-- Esperado: 5 filas
-- -----------------------------------------------------------------------------
SELECT
  'V.6' AS verificacion,
  conrelid::regclass AS tabla,
  conname AS constraint,
  pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND contype = 'c'
  AND conname IN (
    'notas_credito_empresa_chk',
    'notas_credito_saldo_chk',
    'notas_credito_atencion_estado_chk',
    'importaciones_estado_chk',
    'aclaraciones_tipo_chk'
  )
ORDER BY conname;


-- -----------------------------------------------------------------------------
-- V.7 Integridad de datos (debe ser 0 en filas_problema)
-- Esperado: filas_problema = 0 en todas las filas
-- -----------------------------------------------------------------------------
SELECT 'V.7' AS verificacion, 'dup_notas_empresa_folio' AS prueba, COUNT(*) AS filas_problema
FROM (
  SELECT empresa, serie_folio
  FROM public.notas_credito
  GROUP BY empresa, serie_folio
  HAVING COUNT(*) > 1
) x

UNION ALL
SELECT 'V.7', 'dup_rutas_codigo_upper', COUNT(*)
FROM (
  SELECT upper(trim(codigo))
  FROM public.rutas
  GROUP BY upper(trim(codigo))
  HAVING COUNT(*) > 1
) x

UNION ALL
SELECT 'V.7', 'dup_usuario_rutas', COUNT(*)
FROM (
  SELECT usuario_id, ruta_id
  FROM public.usuario_rutas
  GROUP BY usuario_id, ruta_id
  HAVING COUNT(*) > 1
) x

UNION ALL
SELECT 'V.7', 'saldo_incoherente', COUNT(*)
FROM public.notas_credito
WHERE saldo IS DISTINCT FROM (monto - abono)

UNION ALL
SELECT 'V.7', 'atencion_en_no_pendiente', COUNT(*)
FROM public.notas_credito
WHERE requiere_atencion = true AND estado <> 'PENDIENTE'

UNION ALL
SELECT 'V.7', 'empresa_invalida', COUNT(*)
FROM public.notas_credito
WHERE empresa NOT IN ('DISTRIBUIDORA', 'RODRIGO')

UNION ALL
SELECT 'V.7', 'activo_distinto_is_active', COUNT(*)
FROM public.usuarios
WHERE activo IS DISTINCT FROM is_active

ORDER BY prueba;


-- -----------------------------------------------------------------------------
-- V.8 Políticas RLS por tabla (authenticated / service_role)
-- Referencia: revisar que usuarios, notas, importaciones tengan políticas
-- -----------------------------------------------------------------------------
SELECT
  'V.8' AS verificacion,
  tablename,
  COUNT(*) AS num_policies,
  array_agg(DISTINCT unnest_roles ORDER BY unnest_roles) AS roles_con_politica
FROM (
  SELECT tablename, unnest(roles) AS unnest_roles
  FROM pg_policies
  WHERE schemaname = 'public'
) sub
WHERE tablename IN (
  'rutas', 'usuarios', 'usuario_rutas', 'notas_credito', 'aclaraciones',
  'historial_notas', 'documentos', 'alertas', 'importaciones', 'parametros',
  'auditoria_eventos'
)
GROUP BY tablename
ORDER BY tablename;


-- -----------------------------------------------------------------------------
-- V.9 Conteos y parámetros clave
-- -----------------------------------------------------------------------------
SELECT 'V.9' AS verificacion, 'conteos' AS metrica, 'usuarios' AS detalle, COUNT(*)::bigint AS valor
FROM public.usuarios
UNION ALL SELECT 'V.9', 'conteos', 'notas_credito', COUNT(*) FROM public.notas_credito
UNION ALL SELECT 'V.9', 'conteos', 'rutas', COUNT(*) FROM public.rutas
UNION ALL SELECT 'V.9', 'conteos', 'importaciones', COUNT(*) FROM public.importaciones
UNION ALL SELECT 'V.9', 'conteos', 'parametros', COUNT(*) FROM public.parametros
ORDER BY detalle;

SELECT
  'V.9' AS verificacion,
  'parametros' AS metrica,
  clave,
  left(valor, 80) AS valor_preview
FROM public.parametros
ORDER BY clave;


-- -----------------------------------------------------------------------------
-- V.10 Storage (adjuntos de notas) — opcional si usas bucket documentos
-- Esperado: bucket documentos-notas o el definido en VITE_SUPABASE_DOCUMENTOS_BUCKET
-- -----------------------------------------------------------------------------
SELECT
  'V.10' AS verificacion,
  id AS bucket_id,
  name AS bucket_name,
  public AS es_publico
FROM storage.buckets
WHERE name ILIKE '%documento%' OR name ILIKE '%notas%'
ORDER BY name;


-- -----------------------------------------------------------------------------
-- V.11 RESUMEN AUTOMÁTICO — pega esta tabla al final
-- Esperado: estado = OK en todas las filas
-- -----------------------------------------------------------------------------
WITH checks AS (
  SELECT 'rls_todas_tablas' AS item,
    CASE WHEN COUNT(*) FILTER (WHERE NOT c.relrowsecurity) = 0 THEN 'OK' ELSE 'REVISAR' END AS estado,
    COUNT(*) FILTER (WHERE NOT c.relrowsecurity)::text || ' tablas sin RLS' AS detalle
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN (
      'rutas','usuarios','usuario_rutas','notas_credito','aclaraciones',
      'historial_notas','documentos','alertas','importaciones','parametros','auditoria_eventos'
    )

  UNION ALL
  SELECT 'sin_grants_anon_usuarios',
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END,
    COUNT(*)::text || ' privilegios anon en usuarios'
  FROM information_schema.table_privileges
  WHERE table_schema = 'public' AND table_name = 'usuarios' AND grantee = 'anon'

  UNION ALL
  SELECT 'sin_policies_anon',
    CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'REVISAR' END,
    COUNT(*)::text || ' policies anon'
  FROM pg_policies
  WHERE schemaname = 'public' AND 'anon' = ANY(roles)

  UNION ALL
  SELECT 'funciones_rls',
    CASE WHEN COUNT(*) >= 6 THEN 'OK' ELSE 'REVISAR' END,
    COUNT(*)::text || ' de 6 funciones'
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'jwt_usuario_id','jwt_rol','jwt_is_superuser','jwt_is_admin',
      'jwt_is_credito_o_admin','vendedor_puede_ver_nota'
    )

  UNION ALL
  SELECT 'unique_empresa_folio',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'notas_credito_empresa_serie_folio_uidx'
    ) THEN 'OK' ELSE 'REVISAR' END,
    'indice notas_credito_empresa_serie_folio_uidx'

  UNION ALL
  SELECT 'checks_negocio',
    CASE WHEN COUNT(*) >= 5 THEN 'OK' ELSE 'REVISAR' END,
    COUNT(*)::text || ' de 5 CHECK constraints'
  FROM pg_constraint
  WHERE connamespace = 'public'::regnamespace
    AND conname IN (
      'notas_credito_empresa_chk','notas_credito_saldo_chk',
      'notas_credito_atencion_estado_chk','importaciones_estado_chk','aclaraciones_tipo_chk'
    )

  UNION ALL
  SELECT 'datos_duplicados_notas',
    CASE WHEN (
      SELECT COUNT(*) FROM (
        SELECT 1 FROM public.notas_credito
        GROUP BY empresa, serie_folio HAVING COUNT(*) > 1
      ) d
    ) = 0 THEN 'OK' ELSE 'REVISAR' END,
    (SELECT COUNT(*)::text FROM (
      SELECT 1 FROM public.notas_credito
      GROUP BY empresa, serie_folio HAVING COUNT(*) > 1
    ) d) || ' grupos duplicados'
)
SELECT 'V.11' AS verificacion, item, estado, detalle
FROM checks
ORDER BY
  CASE estado WHEN 'OK' THEN 1 ELSE 0 END,
  item;
