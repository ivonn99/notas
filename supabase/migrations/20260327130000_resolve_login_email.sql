-- Email para login: coincide con sync-usuarios-to-supabase-auth (normalizeEmail).
-- Permite a anon resolver username → email antes de signInWithPassword (sin sesión).
CREATE OR REPLACE FUNCTION public.resolve_login_email(p_username text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT CASE
    WHEN nullif(trim(u.email), '') IS NOT NULL THEN lower(trim(u.email))
    ELSE
      coalesce(
        nullif(
          regexp_replace(
            regexp_replace(lower(trim(u.username)), '[^a-z0-9._-]+', '_', 'g'),
            '^_+|_+$',
            '',
            'g'
          ),
          ''
        ),
        'usuario'
      ) || '@local.test'
  END
  FROM public.usuarios u
  WHERE lower(trim(u.username)) = lower(trim(p_username))
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_login_email(text) IS
  'Devuelve el email de login (tabla usuarios) para un username; uso previo a Supabase Auth.';

GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO authenticated;
