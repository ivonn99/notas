-- CREDITO puede usar el mismo panel que ADMIN (importaciones, usuarios, rutas, parámetros, logs, etc.).
-- jwt_is_credito_o_admin() ya incluía CREDITO; jwt_is_admin() queda alineado para políticas que solo citaban "admin".

CREATE OR REPLACE FUNCTION public.jwt_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.jwt_is_superuser() OR public.jwt_rol() IN ('ADMIN', 'CREDITO');
$$;
