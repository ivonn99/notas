-- =============================================================================
-- URGENTE — Revocar acceso del rol `anon` a la tabla `usuarios`
-- =============================================================================
-- Contexto: la migración demo 20260327170000_rls_usuarios_anon_full_access
-- concedió SELECT/INSERT/UPDATE/DELETE a `anon`. Cualquiera con la anon key
-- del frontend (visible en el bundle) puede manipular usuarios.
--
-- El login por db-login-jwt NO depende de esto (usa service role en Edge).
-- PostgREST con JWT autenticado sigue usando políticas RLS para `authenticated`.
--
-- Ejecutar en Supabase → SQL Editor. Luego vuelve a correr la verificación al final.
-- =============================================================================

-- Antes (debe listar privilegios si aún no corregiste)
SELECT 'ANTES grants anon' AS paso, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND grantee = 'anon'
ORDER BY privilege_type;

SELECT 'ANTES policies anon' AS paso, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'usuarios'
  AND 'anon' = ANY(roles)
ORDER BY policyname;

BEGIN;

-- Políticas RLS demo (USING true / WITH CHECK true)
DROP POLICY IF EXISTS usuarios_anon_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_anon_insert ON public.usuarios;
DROP POLICY IF EXISTS usuarios_anon_update ON public.usuarios;
DROP POLICY IF EXISTS usuarios_anon_delete ON public.usuarios;

-- Privilegios de tabla
REVOKE ALL ON TABLE public.usuarios FROM anon;

-- Secuencia del ID (si se concedió en la migración demo)
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

-- Después (debe devolver 0 filas en ambas consultas)
SELECT 'DESPUES grants anon' AS paso, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name = 'usuarios'
  AND grantee = 'anon'
ORDER BY privilege_type;

SELECT 'DESPUES policies anon' AS paso, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'usuarios'
  AND 'anon' = ANY(roles)
ORDER BY policyname;

-- Políticas normales para usuarios autenticados (solo lectura de diagnóstico)
SELECT 'policies authenticated usuarios' AS paso, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'usuarios'
ORDER BY policyname;
