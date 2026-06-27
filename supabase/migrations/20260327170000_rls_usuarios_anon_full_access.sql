-- REVOCADO: sustituye la migración demo que abría acceso total de `anon` a `usuarios`.
-- Idempotente — seguro en prod (ya corregida) y en entornos nuevos.
-- Ver también: supabase/scripts/revocar-anon-usuarios.sql

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
