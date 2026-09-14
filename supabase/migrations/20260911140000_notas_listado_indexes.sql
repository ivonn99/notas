-- Índices de listado frecuentes (antes solo en script manual de endurecimiento).
-- Ayudan a "Todas las notas" / Seguimiento: filtro por empresa + orden por fecha_nota,
-- y carga de aclaraciones por nota_id.

CREATE INDEX IF NOT EXISTS idx_notas_empresa_estado_atencion
  ON public.notas_credito (empresa, estado, requiere_atencion);

CREATE INDEX IF NOT EXISTS idx_notas_empresa_fecha_nota
  ON public.notas_credito (empresa, fecha_nota);

CREATE INDEX IF NOT EXISTS idx_notas_ruta_id
  ON public.notas_credito (ruta_id);

CREATE INDEX IF NOT EXISTS idx_notas_fecha_ultima_actualizacion
  ON public.notas_credito (fecha_ultima_actualizacion DESC);

CREATE INDEX IF NOT EXISTS idx_aclaraciones_nota_id
  ON public.aclaraciones (nota_id);

CREATE INDEX IF NOT EXISTS idx_aclaraciones_nota_created
  ON public.aclaraciones (nota_id, created_at DESC);
