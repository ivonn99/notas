-- Búsqueda q siempre en serie_folio + cliente + usuario_vendedor_pv (contiene).
-- Antes: tokens sin espacios se trataban solo como folio y no buscaban cliente/vendedor.

CREATE OR REPLACE FUNCTION public.seguimiento_list_aggregates(
  p_empresa text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_atencion text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_ruta_ids bigint[] DEFAULT NULL,
  p_fecha_nota_desde date DEFAULT NULL,
  p_fecha_nota_hasta date DEFAULT NULL,
  p_dias_buckets text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_empresa text := NULLIF(upper(trim(COALESCE(p_empresa, ''))), '');
  v_estado text := NULLIF(upper(trim(COALESCE(p_estado, ''))), '');
  v_atencion text := lower(trim(COALESCE(p_atencion, '')));
  v_q text := NULLIF(trim(COALESCE(p_q, '')), '');
  v_q_like text;
  v_has_buckets boolean := COALESCE(cardinality(p_dias_buckets), 0) > 0;
  v_resumen jsonb;
  v_por_ruta jsonb;
  v_por_antiguedad jsonb;
BEGIN
  PERFORM set_config('statement_timeout', '60s', true);

  IF v_q IS NOT NULL THEN
    v_q_like := replace(replace(replace(v_q, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
  END IF;

  WITH filtered AS MATERIALIZED (
    SELECT
      n.fecha_nota,
      n.monto,
      n.abono,
      n.saldo,
      n.requiere_atencion,
      COALESCE(NULLIF(trim(r.codigo), ''), '(sin ruta)') AS ruta_codigo
    FROM public.notas_credito n
    LEFT JOIN public.rutas r ON r.id = n.ruta_id
    WHERE (v_empresa IS NULL OR n.empresa = v_empresa)
      AND (v_estado IS NULL OR n.estado = v_estado)
      AND (
        CASE
          WHEN v_atencion IN ('si', 'sí', 'true', '1') THEN n.requiere_atencion IS TRUE
          WHEN v_atencion IN ('no', 'false', '0') THEN n.requiere_atencion IS FALSE
          ELSE TRUE
        END
      )
      AND (p_ruta_ids IS NULL OR n.ruta_id = ANY (p_ruta_ids))
      AND (
        NOT v_has_buckets
        OR (
          n.fecha_nota IS NOT NULL
          AND (
            (
              'r1' = ANY (p_dias_buckets)
              AND n.fecha_nota >= (CURRENT_DATE - 30)
            )
            OR (
              'r2' = ANY (p_dias_buckets)
              AND n.fecha_nota >= (CURRENT_DATE - 45)
              AND n.fecha_nota < (CURRENT_DATE - 30)
            )
            OR (
              'r2b' = ANY (p_dias_buckets)
              AND n.fecha_nota >= (CURRENT_DATE - 60)
              AND n.fecha_nota < (CURRENT_DATE - 45)
            )
            OR (
              'r3' = ANY (p_dias_buckets)
              AND n.fecha_nota >= (CURRENT_DATE - 90)
              AND n.fecha_nota < (CURRENT_DATE - 60)
            )
            OR (
              'r4' = ANY (p_dias_buckets)
              AND n.fecha_nota >= (CURRENT_DATE - 180)
              AND n.fecha_nota < (CURRENT_DATE - 90)
            )
            OR (
              'r5' = ANY (p_dias_buckets)
              AND n.fecha_nota >= (CURRENT_DATE - 365)
              AND n.fecha_nota < (CURRENT_DATE - 180)
            )
            OR (
              'r6' = ANY (p_dias_buckets)
              AND n.fecha_nota < (CURRENT_DATE - 365)
            )
          )
        )
      )
      AND (
        v_has_buckets
        OR (
          (p_fecha_nota_desde IS NULL OR n.fecha_nota >= p_fecha_nota_desde)
          AND (p_fecha_nota_hasta IS NULL OR n.fecha_nota < p_fecha_nota_hasta)
        )
      )
      AND (
        v_q IS NULL
        OR (
          n.serie_folio ILIKE ('%' || v_q_like || '%') ESCAPE E'\\'
          OR n.cliente ILIKE ('%' || v_q_like || '%') ESCAPE E'\\'
          OR n.usuario_vendedor_pv ILIKE ('%' || v_q_like || '%') ESCAPE E'\\'
        )
      )
  ),
  resumen AS (
    SELECT
      COUNT(*)::int AS total_filtrado,
      COUNT(*) FILTER (WHERE requiere_atencion IS TRUE)::int AS requiere_atencion,
      COALESCE(SUM(monto), 0)::float8 AS monto_total,
      COALESCE(SUM(abono), 0)::float8 AS abono_total,
      COALESCE(SUM(saldo), 0)::float8 AS saldo_total
    FROM filtered
  ),
  por_ruta AS (
    SELECT
      ruta_codigo,
      COUNT(*)::int AS registros
    FROM filtered
    GROUP BY ruta_codigo
    ORDER BY registros DESC, ruta_codigo ASC
    LIMIT 200
  ),
  por_antiguedad AS (
    SELECT
      CASE
        WHEN f.fecha_nota IS NULL THEN 'negativo'
        WHEN (CURRENT_DATE - f.fecha_nota) < 0 THEN 'negativo'
        WHEN (CURRENT_DATE - f.fecha_nota) <= 30 THEN 'd0_30'
        WHEN (CURRENT_DATE - f.fecha_nota) <= 45 THEN 'd31_45'
        WHEN (CURRENT_DATE - f.fecha_nota) <= 60 THEN 'd46_60'
        WHEN (CURRENT_DATE - f.fecha_nota) <= 90 THEN 'd61_90'
        WHEN (CURRENT_DATE - f.fecha_nota) <= 180 THEN 'd91_180'
        WHEN (CURRENT_DATE - f.fecha_nota) <= 365 THEN 'd181_365'
        ELSE 'd366_plus'
      END AS bucket_id,
      COUNT(*)::int AS registros,
      COALESCE(SUM(f.saldo), 0)::float8 AS saldo_total
    FROM filtered f
    GROUP BY 1
  )
  SELECT
    (SELECT to_jsonb(resumen) FROM resumen),
    COALESCE(
      (SELECT jsonb_agg(to_jsonb(por_ruta) ORDER BY por_ruta.registros DESC, por_ruta.ruta_codigo ASC)
       FROM por_ruta),
      '[]'::jsonb
    ),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'bucket_id', a.bucket_id,
            'registros', a.registros,
            'saldo_total', a.saldo_total
          )
          ORDER BY
            CASE a.bucket_id
              WHEN 'negativo' THEN 0
              WHEN 'd0_30' THEN 1
              WHEN 'd31_45' THEN 2
              WHEN 'd46_60' THEN 3
              WHEN 'd61_90' THEN 4
              WHEN 'd91_180' THEN 5
              WHEN 'd181_365' THEN 6
              WHEN 'd366_plus' THEN 7
              ELSE 8
            END
        )
        FROM por_antiguedad a
        WHERE a.registros > 0
      ),
      '[]'::jsonb
    )
  INTO v_resumen, v_por_ruta, v_por_antiguedad;

  RETURN jsonb_build_object(
    'resumen', COALESCE(
      v_resumen,
      jsonb_build_object(
        'total_filtrado', 0,
        'requiere_atencion', 0,
        'monto_total', 0,
        'abono_total', 0,
        'saldo_total', 0
      )
    ),
    'porRuta', COALESCE(v_por_ruta, '[]'::jsonb),
    'porAntiguedad', COALESCE(v_por_antiguedad, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.seguimiento_list_aggregates IS
  'Agregados de Seguimiento (resumen, por ruta, por antigüedad). q busca en serie, cliente y vendedor.';
