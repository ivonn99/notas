-- Usuarios creados solo vía Supabase (admin en navegador) no envían password al INSERT.
-- Login por API (/api/auth/login) sigue exigiendo hash en BD; NULL = solo Supabase Auth o reset desde admin.

ALTER TABLE public.usuarios
  ALTER COLUMN password DROP NOT NULL;
