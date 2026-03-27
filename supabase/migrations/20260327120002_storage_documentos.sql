-- Bucket privado para adjuntos (nombre alineado con VITE_SUPABASE_DOCUMENTOS_BUCKET).
-- Ajusta el id si usas otro nombre de bucket.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('documentos-notas', 'documentos-notas', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Políticas sobre storage.objects
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
