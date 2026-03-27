-- Políticas RLS por tabla. Ajusta nombres si tus tablas difieren.

-- usuarios
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuarios_select ON public.usuarios;
CREATE POLICY usuarios_select ON public.usuarios
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR id = public.jwt_usuario_id()
  );

DROP POLICY IF EXISTS usuarios_insert ON public.usuarios;
CREATE POLICY usuarios_insert ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_admin());

DROP POLICY IF EXISTS usuarios_update ON public.usuarios;
CREATE POLICY usuarios_update ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    public.jwt_is_admin()
    OR id = public.jwt_usuario_id()
  )
  WITH CHECK (
    public.jwt_is_admin()
    OR id = public.jwt_usuario_id()
  );

DROP POLICY IF EXISTS usuarios_delete ON public.usuarios;
CREATE POLICY usuarios_delete ON public.usuarios
  FOR DELETE TO authenticated
  USING (public.jwt_is_admin());

-- rutas
ALTER TABLE public.rutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rutas_select ON public.rutas;
CREATE POLICY rutas_select ON public.rutas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS rutas_write ON public.rutas;
CREATE POLICY rutas_write ON public.rutas
  FOR ALL TO authenticated
  USING (public.jwt_is_admin())
  WITH CHECK (public.jwt_is_admin());

-- usuario_rutas
ALTER TABLE public.usuario_rutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS usuario_rutas_select ON public.usuario_rutas;
CREATE POLICY usuario_rutas_select ON public.usuario_rutas
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS usuario_rutas_write ON public.usuario_rutas;
CREATE POLICY usuario_rutas_write ON public.usuario_rutas
  FOR ALL TO authenticated
  USING (public.jwt_is_admin())
  WITH CHECK (public.jwt_is_admin());

-- notas_credito
ALTER TABLE public.notas_credito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notas_credito_select ON public.notas_credito;
CREATE POLICY notas_credito_select ON public.notas_credito
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(id)
  );

DROP POLICY IF EXISTS notas_credito_insert ON public.notas_credito;
CREATE POLICY notas_credito_insert ON public.notas_credito
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_credito_o_admin());

DROP POLICY IF EXISTS notas_credito_update ON public.notas_credito;
CREATE POLICY notas_credito_update ON public.notas_credito
  FOR UPDATE TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(id)
  )
  WITH CHECK (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(id)
  );

DROP POLICY IF EXISTS notas_credito_delete ON public.notas_credito;
CREATE POLICY notas_credito_delete ON public.notas_credito
  FOR DELETE TO authenticated
  USING (public.jwt_is_admin());

-- aclaraciones
ALTER TABLE public.aclaraciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aclaraciones_select ON public.aclaraciones;
CREATE POLICY aclaraciones_select ON public.aclaraciones
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(nota_id)
  );

DROP POLICY IF EXISTS aclaraciones_insert ON public.aclaraciones;
CREATE POLICY aclaraciones_insert ON public.aclaraciones
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.jwt_is_credito_o_admin()
      OR public.vendedor_puede_ver_nota(nota_id)
    )
    AND usuario_id = public.jwt_usuario_id()
  );

DROP POLICY IF EXISTS aclaraciones_update ON public.aclaraciones;
CREATE POLICY aclaraciones_update ON public.aclaraciones
  FOR UPDATE TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR (
      public.vendedor_puede_ver_nota(nota_id)
      AND usuario_id = public.jwt_usuario_id()
    )
  )
  WITH CHECK (
    public.jwt_is_credito_o_admin()
    OR (
      public.vendedor_puede_ver_nota(nota_id)
      AND usuario_id = public.jwt_usuario_id()
    )
  );

-- alertas
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS alertas_select ON public.alertas;
CREATE POLICY alertas_select ON public.alertas
  FOR SELECT TO authenticated
  USING (public.jwt_is_credito_o_admin());

DROP POLICY IF EXISTS alertas_update ON public.alertas;
CREATE POLICY alertas_update ON public.alertas
  FOR UPDATE TO authenticated
  USING (public.jwt_is_credito_o_admin())
  WITH CHECK (public.jwt_is_credito_o_admin());

DROP POLICY IF EXISTS alertas_insert ON public.alertas;
CREATE POLICY alertas_insert ON public.alertas
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_credito_o_admin());

-- documentos
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documentos_select ON public.documentos;
CREATE POLICY documentos_select ON public.documentos
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(nota_id)
  );

DROP POLICY IF EXISTS documentos_insert ON public.documentos;
CREATE POLICY documentos_insert ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.jwt_is_credito_o_admin()
      OR public.vendedor_puede_ver_nota(nota_id)
    )
    AND usuario_id = public.jwt_usuario_id()
  );

DROP POLICY IF EXISTS documentos_delete ON public.documentos;
CREATE POLICY documentos_delete ON public.documentos
  FOR DELETE TO authenticated
  USING (public.jwt_is_admin());

-- historial_notas
ALTER TABLE public.historial_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS historial_select ON public.historial_notas;
CREATE POLICY historial_select ON public.historial_notas
  FOR SELECT TO authenticated
  USING (
    public.jwt_is_credito_o_admin()
    OR public.vendedor_puede_ver_nota(nota_id)
  );

DROP POLICY IF EXISTS historial_insert ON public.historial_notas;
CREATE POLICY historial_insert ON public.historial_notas
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.jwt_is_credito_o_admin()
      OR public.vendedor_puede_ver_nota(nota_id)
    )
    AND usuario_id = public.jwt_usuario_id()
  );

-- importaciones
ALTER TABLE public.importaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS importaciones_select ON public.importaciones;
CREATE POLICY importaciones_select ON public.importaciones
  FOR SELECT TO authenticated
  USING (public.jwt_is_admin());

DROP POLICY IF EXISTS importaciones_insert ON public.importaciones;
CREATE POLICY importaciones_insert ON public.importaciones
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_admin());

DROP POLICY IF EXISTS importaciones_update ON public.importaciones;
CREATE POLICY importaciones_update ON public.importaciones
  FOR UPDATE TO authenticated
  USING (public.jwt_is_admin())
  WITH CHECK (public.jwt_is_admin());

-- auditoria_eventos
ALTER TABLE public.auditoria_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auditoria_select ON public.auditoria_eventos;
CREATE POLICY auditoria_select ON public.auditoria_eventos
  FOR SELECT TO authenticated
  USING (public.jwt_is_admin());

DROP POLICY IF EXISTS auditoria_insert ON public.auditoria_eventos;
CREATE POLICY auditoria_insert ON public.auditoria_eventos
  FOR INSERT TO authenticated
  WITH CHECK (public.jwt_is_admin());

-- parametros
ALTER TABLE public.parametros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS parametros_select ON public.parametros;
CREATE POLICY parametros_select ON public.parametros
  FOR SELECT TO authenticated
  USING (public.jwt_is_admin());

DROP POLICY IF EXISTS parametros_update ON public.parametros;
CREATE POLICY parametros_update ON public.parametros
  FOR UPDATE TO authenticated
  USING (public.jwt_is_admin())
  WITH CHECK (public.jwt_is_admin());
