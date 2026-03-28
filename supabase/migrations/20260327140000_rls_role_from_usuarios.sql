-- Rol y superusuario desde la tabla usuarios (fuente de verdad), no solo desde JWT.
-- Evita desincronización cuando un admin cambia rol en BD y user_metadata de Auth va atrasado.

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
