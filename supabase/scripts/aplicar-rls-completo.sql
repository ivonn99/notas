-- =============================================================================
-- Aplicar RLS completo — Notas de crédito
-- =============================================================================
-- Corrige lo que V.11 reportó como REVISAR:
--   • funciones_rls: 0 de 6  → crea las 6 funciones
--   • rls_todas_tablas: 10 sin RLS → activa RLS + políticas en 11 tablas
--
-- NO incluye la migración demo anon (20260327170000). Esa ya la revocaste.
--
-- Ejecutar en Supabase → SQL Editor (todo el archivo).
-- Después vuelve a correr verificar-configuracion-bd.sql y pega V.11.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Funciones helper RLS (bigint: tus IDs son bigint)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jwt_usuario_id()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(TRIM(COALESCE(
    auth.jwt()->'user_metadata'->>'usuarioId',
    auth.jwt()->'user_metadata'->>'usuario_id',
    auth.jwt()->'user_metadata'->>'dbUserId'
  )), '')::bigint;
$$;

CREATE OR REPLACE FUNCTION public.jwt_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT UPPER(TRIM(u.rol))
      FROM public.usuarios u
      WHERE u.id = public.jwt_usuario_id()
      LIMIT 1
    ),
    UPPER(COALESCE(TRIM(auth.jwt()->'user_metadata'->>'rol'), 'VENDEDOR'))
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT u.is_superuser
      FROM public.usuarios u
      WHERE u.id = public.jwt_usuario_id()
      LIMIT 1
    ),
    COALESCE((auth.jwt()->'user_metadata'->>'isSuperuser')::boolean, false)
  );
$$;

-- ADMIN y CREDITO: panel admin (importaciones, usuarios, rutas, parámetros…)
CREATE OR REPLACE FUNCTION public.jwt_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_is_superuser() OR public.jwt_rol() IN ('ADMIN', 'CREDITO');
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_credito_o_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_is_superuser()
    OR public.jwt_rol() IN ('ADMIN', 'CREDITO');
$$;

CREATE OR REPLACE FUNCTION public.vendedor_puede_ver_nota(p_nota_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.notas_credito n
    JOIN public.usuario_rutas ur ON ur.ruta_id = n.ruta_id
    WHERE n.id = p_nota_id
      AND ur.usuario_id = public.jwt_usuario_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.jwt_usuario_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_rol() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_superuser() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.jwt_is_credito_o_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vendedor_puede_ver_nota(bigint) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Privilegios base para rol authenticated (PostgREST)
-- -----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.rutas,
  public.usuarios,
  public.usuario_rutas,
  public.notas_credito,
  public.aclaraciones,
  public.historial_notas,
  public.documentos,
  public.alertas,
  public.importaciones,
  public.parametros,
  public.auditoria_eventos
TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. RLS + políticas por tabla
-- -----------------------------------------------------------------------------

-- usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_select ON public.usuarios;
CREATE POLICY usuarios_select ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR id = public.jwt_usuario_id()
  );

DROP POLICY IF EXISTS usuarios_insert ON public.usuarios;
CREATE POLICY usuarios_insert ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_admin());

DROP POLICY IF EXISTS usuarios_update ON public.usuarios;
CREATE POLICY usuarios_update ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.jwt_is_admin()
    OR id = public.jwt_usuario_id()
  )
  WITH CHECK (
    public.jwt_is_admin()
    OR id = public.jwt_usuario_id()
  );

DROP POLICY IF EXISTS usuarios_delete ON public.usuarios;
CREATE POLICY usuarios_delete ON public.usuarios
  FOR DELETE TO authenticated
  USING (public.jwt_is_admin());

-- rutas
ALTER TABLE public.rutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rutas_select ON public.rutas;
CREATE POLICY rutas_select ON public.rutas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS rutas_write ON public.rutas;
CREATE POLICY rutas_write ON public.rutas
  FOR ALL TO authenticated
  USING (public.jwt_is_admin())
  WITH CHECK (public.jwt_is_admin());

-- usuario_rutas
ALTER TABLE public.usuario_rutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuario_rutas_select ON public.usuario_rutas;
CREATE POLICY usuario_rutas_select ON public.usuario_rutas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS usuario_rutas_write ON public.usuario_rutas;
CREATE POLICY usuario_rutas_write ON public.usuario_rutas
  FOR ALL TO authenticated
  USING (public.jwt_is_admin())
  WITH CHECK (public.jwt_is_admin());

-- notas_credito
ALTER TABLE public.notas_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notas_credito_select ON public.notas_credito;
CREATE POLICY notas_credito_select ON public.notas_credito
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(id)
  );

DROP POLICY IF EXISTS notas_credito_insert ON public.notas_credito;
CREATE POLICY notas_credito_insert ON public.notas_credito
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_credito_o_admin());

DROP POLICY IF EXISTS notas_credito_update ON public.notas_credito;
CREATE POLICY notas_credito_update ON public.notas_credito
  FOR UPDATE TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(id)
  )
  WITH CHECK (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(id)
  );

DROP POLICY IF EXISTS notas_credito_delete ON public.notas_credito;
CREATE POLICY notas_credito_delete ON public.notas_credito
  FOR DELETE TO authenticated
  USING (public.jwt_is_admin());

-- aclaraciones
ALTER TABLE public.aclaraciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aclaraciones_select ON public.aclaraciones;
CREATE POLICY aclaraciones_select ON public.aclaraciones
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(nota_id)
  );

DROP POLICY IF EXISTS aclaraciones_insert ON public.aclaraciones;
CREATE POLICY aclaraciones_insert ON public.aclaraciones
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.jwt_is_credito_o_admin()
      OR public.vendedor_puede_ver_nota(nota_id)
    )
    AND usuario_id = public.jwt_usuario_id()
  );

DROP POLICY IF EXISTS aclaraciones_update ON public.aclaraciones;
CREATE POLICY aclaraciones_update ON public.aclaraciones
  FOR UPDATE TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR (
      public.vendedor_puede_ver_nota(nota_id)
      AND usuario_id = public.jwt_usuario_id()
    )
  )
  WITH CHECK (
    public.jwt_is_credito_o_admin()
    OR (
      public.vendedor_puede_ver_nota(nota_id)
      AND usuario_id = public.jwt_usuario_id()
    )
  );

-- alertas
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alertas_select ON public.alertas;
CREATE POLICY alertas_select ON public.alertas
  FOR SELECT TO authenticated
  USING (public.jwt_is_credito_o_admin());

DROP POLICY IF EXISTS alertas_update ON public.alertas;
CREATE POLICY alertas_update ON public.alertas
  FOR UPDATE TO authenticated
  USING (public.jwt_is_credito_o_admin())
  WITH CHECK (public.jwt_is_credito_o_admin());

DROP POLICY IF EXISTS alertas_insert ON public.alertas;
CREATE POLICY alertas_insert ON public.alertas
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_credito_o_admin());

-- documentos
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documentos_select ON public.documentos;
CREATE POLICY documentos_select ON public.documentos
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(nota_id)
  );

DROP POLICY IF EXISTS documentos_insert ON public.documentos;
CREATE POLICY documentos_insert ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.jwt_is_credito_o_admin()
      OR public.vendedor_puede_ver_nota(nota_id)
    )
    AND usuario_id = public.jwt_usuario_id()
  );

DROP POLICY IF EXISTS documentos_delete ON public.documentos;
CREATE POLICY documentos_delete ON public.documentos
  FOR DELETE TO authenticated
  USING (public.jwt_is_admin());

-- historial_notas
ALTER TABLE public.historial_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historial_select ON public.historial_notas;
CREATE POLICY historial_select ON public.historial_notas
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(nota_id)
  );

DROP POLICY IF EXISTS historial_insert ON public.historial_notas;
CREATE POLICY historial_insert ON public.historial_notas
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.jwt_is_credito_o_admin()
      OR public.vendedor_puede_ver_nota(nota_id)
    )
    AND usuario_id = public.jwt_usuario_id()
  );

-- importaciones
ALTER TABLE public.importaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS importaciones_select ON public.importaciones;
CREATE POLICY importaciones_select ON public.importaciones
  FOR SELECT TO authenticated
  USING (public.jwt_is_admin());

DROP POLICY IF EXISTS importaciones_insert ON public.importaciones;
CREATE POLICY importaciones_insert ON public.importaciones
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_admin());

DROP POLICY IF EXISTS importaciones_update ON public.importaciones;
CREATE POLICY importaciones_update ON public.importaciones
  FOR UPDATE TO authenticated
  USING (public.jwt_is_admin())
  WITH CHECK (public.jwt_is_admin());

-- auditoria_eventos
ALTER TABLE public.auditoria_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_select ON public.auditoria_eventos;
CREATE POLICY auditoria_select ON public.auditoria_eventos
  FOR SELECT TO authenticated
  USING (public.jwt_is_admin());

DROP POLICY IF EXISTS auditoria_insert ON public.auditoria_eventos;
CREATE POLICY auditoria_insert ON public.auditoria_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_admin());

-- parametros
ALTER TABLE public.parametros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parametros_select ON public.parametros;
CREATE POLICY parametros_select ON public.parametros
  FOR SELECT TO authenticated
  USING (public.jwt_is_admin());

DROP POLICY IF EXISTS parametros_update ON public.parametros;
CREATE POLICY parametros_update ON public.parametros
  FOR UPDATE TO authenticated
  USING (public.jwt_is_admin())
  WITH CHECK (public.jwt_is_admin());

COMMIT;


-- =============================================================================
-- 4. Storage adjuntos (opcional; ejecuta aparte si usas documentos en Storage)
-- =============================================================================
/*
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documentos-notas', 'documentos-notas', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS documentos_storage_select ON storage.objects;
CREATE POLICY documentos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-notas');

DROP POLICY IF EXISTS documentos_storage_insert ON storage.objects;
CREATE POLICY documentos_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos-notas'
    AND split_part(name, '/', 1) = 'nota'
  );

DROP POLICY IF EXISTS documentos_storage_delete ON storage.objects;
CREATE POLICY documentos_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-notas');
*/


-- =============================================================================
-- 5. Verificación rápida (pega resultado en el chat)
-- =============================================================================
SELECT 'post_rls funciones' AS check_name, COUNT(*)::text AS valor
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'jwt_usuario_id','jwt_rol','jwt_is_superuser','jwt_is_admin',
    'jwt_is_credito_o_admin','vendedor_puede_ver_nota'
  );

SELECT 'post_rls tablas_sin_rls' AS check_name, COUNT(*)::text AS valor
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
  AND c.relname IN (
    'rutas','usuarios','usuario_rutas','notas_credito','aclaraciones',
    'historial_notas','documentos','alertas','importaciones','parametros',
    'auditoria_eventos'
  )
  AND NOT c.relrowsecurity;
