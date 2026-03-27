-- Helpers para políticas RLS basadas en JWT (user_metadata del usuario de Supabase Auth).
-- Requiere que el login rellene: usuarioId (o usuario_id / dbUserId), rol, isSuperuser.

CREATE OR REPLACE FUNCTION public.jwt_usuario_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(TRIM(COALESCE(
    auth.jwt()->'user_metadata'->>'usuarioId',
    auth.jwt()->'user_metadata'->>'usuario_id',
    auth.jwt()->'user_metadata'->>'dbUserId'
  )), '')::integer;
$$;

CREATE OR REPLACE FUNCTION public.jwt_rol()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT UPPER(COALESCE(TRIM(auth.jwt()->'user_metadata'->>'rol'), 'VENDEDOR'));
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_superuser()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt()->'user_metadata'->>'isSuperuser')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.jwt_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_is_superuser() OR public.jwt_rol() = 'ADMIN';
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

CREATE OR REPLACE FUNCTION public.vendedor_puede_ver_nota(p_nota_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM notas_credito n
    JOIN usuario_rutas ur ON ur.ruta_id = n.ruta_id
    WHERE n.id = p_nota_id
      AND ur.usuario_id = public.jwt_usuario_id()
  );
$$;
