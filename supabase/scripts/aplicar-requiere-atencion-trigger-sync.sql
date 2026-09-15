-- Repara desfase: bandera requiere_atencion vs comentarios reales.
-- Regla: PENDIENTE + existe aclaración → true; si no → false.
-- Trigger: se mantiene tras importaciones que sobrescribían la bandera a false.

CREATE OR REPLACE FUNCTION public.recompute_requiere_atencion_nota(p_nota_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_nota_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.notas_credito n
  SET requiere_atencion = (
    n.estado = 'PENDIENTE'
    AND EXISTS (
      SELECT 1
      FROM public.aclaraciones a
      WHERE a.nota_id = n.id
    )
  )
  WHERE n.id = p_nota_id
    AND n.requiere_atencion IS DISTINCT FROM (
      n.estado = 'PENDIENTE'
      AND EXISTS (
        SELECT 1
        FROM public.aclaraciones a
        WHERE a.nota_id = n.id
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_aclaraciones_sync_requiere_atencion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_requiere_atencion_nota(OLD.nota_id);
    RETURN OLD;
  END IF;
  PERFORM public.recompute_requiere_atencion_nota(NEW.nota_id);
  IF TG_OP = 'UPDATE' AND OLD.nota_id IS DISTINCT FROM NEW.nota_id THEN
    PERFORM public.recompute_requiere_atencion_nota(OLD.nota_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_notas_sync_requiere_atencion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalcula tras upsert/import o cambio de estado (evita borrar la bandera a false).
  PERFORM public.recompute_requiere_atencion_nota(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_aclaraciones_sync_requiere_atencion ON public.aclaraciones;
CREATE TRIGGER trg_aclaraciones_sync_requiere_atencion
  AFTER INSERT OR UPDATE OR DELETE ON public.aclaraciones
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_aclaraciones_sync_requiere_atencion();

DROP TRIGGER IF EXISTS trg_notas_sync_requiere_atencion ON public.notas_credito;
CREATE TRIGGER trg_notas_sync_requiere_atencion
  AFTER INSERT OR UPDATE OF estado, requiere_atencion ON public.notas_credito
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notas_sync_requiere_atencion();

-- Sync masivo inmediato (todas las notas desfasadas).
UPDATE public.notas_credito n
SET requiere_atencion = (
  n.estado = 'PENDIENTE'
  AND EXISTS (
    SELECT 1
    FROM public.aclaraciones a
    WHERE a.nota_id = n.id
  )
)
WHERE n.requiere_atencion IS DISTINCT FROM (
  n.estado = 'PENDIENTE'
  AND EXISTS (
    SELECT 1
    FROM public.aclaraciones a
    WHERE a.nota_id = n.id
  )
);

COMMENT ON FUNCTION public.recompute_requiere_atencion_nota(bigint) IS
  'Alinea notas_credito.requiere_atencion con PENDIENTE + existencia de aclaraciones.';
