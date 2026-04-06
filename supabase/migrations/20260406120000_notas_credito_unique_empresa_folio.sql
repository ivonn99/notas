-- Necesario para upsert desde el cliente (importación solo Supabase).
-- Si ya existe un UNIQUE equivalente, este índice no se duplica.
CREATE UNIQUE INDEX IF NOT EXISTS notas_credito_empresa_serie_folio_uidx
  ON public.notas_credito (empresa, serie_folio);
