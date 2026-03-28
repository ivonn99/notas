-- PELIGRO / DEMO: el rol `anon` usa la misma clave pública que va en el frontend.
-- Cualquiera puede leer, crear, modificar y borrar filas en `usuarios` sin iniciar sesión.
-- No uses esto en producción con datos reales.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.usuarios TO anon;

DO $$
DECLARE
  seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('public.usuarios', 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO anon', seq_name);
  END IF;
END $$;

DROP POLICY IF EXISTS usuarios_anon_select ON public.usuarios;
CREATE POLICY usuarios_anon_select ON public.usuarios
  FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS usuarios_anon_insert ON public.usuarios;
CREATE POLICY usuarios_anon_insert ON public.usuarios
  FOR INSERT TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS usuarios_anon_update ON public.usuarios;
CREATE POLICY usuarios_anon_update ON public.usuarios
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS usuarios_anon_delete ON public.usuarios;
CREATE POLICY usuarios_anon_delete ON public.usuarios
  FOR DELETE TO anon
  USING (true);
