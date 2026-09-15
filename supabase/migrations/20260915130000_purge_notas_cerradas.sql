-- Limpieza de notas RESUELTA/CANCELADA antiguas (solo ADMIN).
-- Hard delete por lotes + preview. SECURITY DEFINER tras verificar jwt_is_admin().

CREATE OR REPLACE FUNCTION public.preview_purge_notas_cerradas(
  p_dias_minimos integer,
  p_empresa text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias integer := COALESCE(p_dias_minimos, 0);
  v_empresa text := NULLIF(upper(trim(COALESCE(p_empresa, ''))), '');
  v_corte timestamptz;
  v_out jsonb;
BEGIN
  IF NOT public.jwt_is_admin() THEN
    RAISE EXCEPTION 'Solo ADMIN puede previsualizar la limpieza de notas';
  END IF;
  IF v_dias < 1 OR v_dias > 3650 THEN
    RAISE EXCEPTION 'dias_minimos debe estar entre 1 y 3650';
  END IF;

  v_corte := now() - make_interval(days => v_dias);

  WITH candidatos AS (
    SELECT
      n.id,
      n.estado,
      n.empresa,
      n.monto,
      n.saldo
    FROM public.notas_credito n
    WHERE n.estado IN ('RESUELTA', 'CANCELADA')
      AND COALESCE(
        n.fecha_resolucion,
        (n.fecha_nota::timestamp AT TIME ZONE 'UTC'),
        n.fecha_ultima_actualizacion
      ) <= v_corte
      AND (v_empresa IS NULL OR n.empresa = v_empresa)
  ),
  por_estado AS (
    SELECT estado, COUNT(*)::int AS c
    FROM candidatos
    GROUP BY estado
  ),
  por_empresa AS (
    SELECT empresa, COUNT(*)::int AS c
    FROM candidatos
    GROUP BY empresa
  ),
  docs AS (
    SELECT COUNT(*)::int AS c
    FROM public.documentos d
    WHERE d.nota_id IN (SELECT id FROM candidatos)
  )
  SELECT jsonb_build_object(
    'candidatos', (SELECT COUNT(*)::int FROM candidatos),
    'monto_total', (SELECT COALESCE(SUM(monto), 0)::float8 FROM candidatos),
    'saldo_total', (SELECT COALESCE(SUM(saldo), 0)::float8 FROM candidatos),
    'documentos', (SELECT c FROM docs),
    'por_estado', COALESCE(
      (SELECT jsonb_object_agg(estado, c) FROM por_estado),
      '{}'::jsonb
    ),
    'por_empresa', COALESCE(
      (SELECT jsonb_object_agg(empresa, c) FROM por_empresa),
      '{}'::jsonb
    ),
    'dias_minimos', v_dias,
    'fecha_corte', v_corte,
    'empresa', v_empresa,
    'criterio_fecha', 'fecha_resolucion → fecha_nota → fecha_ultima_actualizacion'
  )
  INTO v_out;

  RETURN v_out;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_notas_cerradas(
  p_dias_minimos integer,
  p_empresa text DEFAULT NULL,
  p_limit integer DEFAULT 500
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dias integer := COALESCE(p_dias_minimos, 0);
  v_empresa text := NULLIF(upper(trim(COALESCE(p_empresa, ''))), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);
  v_corte timestamptz;
  v_ids bigint[];
  v_paths text[];
  v_deleted integer := 0;
  v_restantes integer := 0;
  v_usuario_id integer;
  v_username text;
BEGIN
  IF NOT public.jwt_is_admin() THEN
    RAISE EXCEPTION 'Solo ADMIN puede eliminar notas cerradas';
  END IF;
  IF v_dias < 1 OR v_dias > 3650 THEN
    RAISE EXCEPTION 'dias_minimos debe estar entre 1 y 3650';
  END IF;

  v_corte := now() - make_interval(days => v_dias);
  v_usuario_id := public.jwt_usuario_id();
  SELECT u.username INTO v_username
  FROM public.usuarios u
  WHERE u.id = v_usuario_id;

  SELECT COALESCE(array_agg(x.id), ARRAY[]::bigint[])
  INTO v_ids
  FROM (
    SELECT n.id
    FROM public.notas_credito n
    WHERE n.estado IN ('RESUELTA', 'CANCELADA')
      AND COALESCE(
        n.fecha_resolucion,
        (n.fecha_nota::timestamp AT TIME ZONE 'UTC'),
        n.fecha_ultima_actualizacion
      ) <= v_corte
      AND (v_empresa IS NULL OR n.empresa = v_empresa)
    ORDER BY COALESCE(
      n.fecha_resolucion,
      (n.fecha_nota::timestamp AT TIME ZONE 'UTC'),
      n.fecha_ultima_actualizacion
    ) ASC, n.id ASC
    LIMIT v_limit
  ) x;

  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object(
      'eliminadas', 0,
      'restantes', 0,
      'storage_paths', '[]'::jsonb,
      'dias_minimos', v_dias,
      'empresa', v_empresa
    );
  END IF;

  SELECT COALESCE(array_agg(d.ruta_archivo), ARRAY[]::text[])
  INTO v_paths
  FROM public.documentos d
  WHERE d.nota_id = ANY (v_ids)
    AND NULLIF(trim(d.ruta_archivo), '') IS NOT NULL;

  DELETE FROM public.aclaraciones WHERE nota_id = ANY (v_ids);
  DELETE FROM public.historial_notas WHERE nota_id = ANY (v_ids);
  DELETE FROM public.alertas WHERE nota_id = ANY (v_ids);
  DELETE FROM public.documentos WHERE nota_id = ANY (v_ids);
  DELETE FROM public.notas_credito WHERE id = ANY (v_ids);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  SELECT COUNT(*)::int
  INTO v_restantes
  FROM public.notas_credito n
  WHERE n.estado IN ('RESUELTA', 'CANCELADA')
    AND COALESCE(
      n.fecha_resolucion,
      (n.fecha_nota::timestamp AT TIME ZONE 'UTC'),
      n.fecha_ultima_actualizacion
    ) <= v_corte
    AND (v_empresa IS NULL OR n.empresa = v_empresa);

  INSERT INTO public.auditoria_eventos (
    usuario_id, username, accion, entidad, entidad_id, detalle
  ) VALUES (
    v_usuario_id,
    COALESCE(v_username, 'admin'),
    'purge_notas_cerradas',
    'notas_credito',
    NULL,
    jsonb_build_object(
      'eliminadas', v_deleted,
      'restantes', v_restantes,
      'dias_minimos', v_dias,
      'empresa', v_empresa,
      'fecha_corte', v_corte,
      'documentos_rutas', cardinality(v_paths),
      'lote_ids_count', cardinality(v_ids),
      'criterio_fecha', 'fecha_resolucion → fecha_nota → fecha_ultima_actualizacion'
    )
  );

  RETURN jsonb_build_object(
    'eliminadas', v_deleted,
    'restantes', v_restantes,
    'storage_paths', to_jsonb(COALESCE(v_paths, ARRAY[]::text[])),
    'dias_minimos', v_dias,
    'empresa', v_empresa
  );
END;
$$;

COMMENT ON FUNCTION public.preview_purge_notas_cerradas(integer, text) IS
  'Preview de notas RESUELTA/CANCELADA más antiguas que N días (ADMIN).';

COMMENT ON FUNCTION public.purge_notas_cerradas(integer, text, integer) IS
  'Hard delete por lote de notas RESUELTA/CANCELADA antiguas (ADMIN).';

GRANT EXECUTE ON FUNCTION public.preview_purge_notas_cerradas(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_notas_cerradas(integer, text, integer) TO authenticated;
