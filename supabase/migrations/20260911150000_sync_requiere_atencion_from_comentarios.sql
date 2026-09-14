-- Sincroniza requiere_atencion con la regla de negocio:
-- PENDIENTE + tiene al menos un comentario/aclaración → true; en cualquier otro caso → false.

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
