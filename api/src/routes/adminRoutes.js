import { Router } from 'express'

import { encodeDjangoPassword } from '../auth/djangoPassword.js'
import { getPool } from '../db.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { logAudit } from '../services/audit.js'

const router = Router()

router.use(requireAuth, requireRoles('ADMIN'))

function parseId(value) {
  const id = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

function normalizeEmail(emailRaw, usernameRaw) {
  const email = String(emailRaw ?? '').trim().toLowerCase()
  if (email) return email
  const user = String(usernameRaw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return `${user || 'usuario'}@local.test`
}

router.get('/usuarios', async (_req, res, next) => {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      SELECT
        u.id, u.username, u.nombre_completo, u.email, u.telefono,
        u.rol, u.activo, u.is_active, u.is_superuser, u.created_at,
        COUNT(ur.ruta_id)::int AS rutas_enlazadas
      FROM usuarios u
      LEFT JOIN usuario_rutas ur ON ur.usuario_id = u.id
      GROUP BY u.id, u.username, u.nombre_completo, u.email, u.telefono, u.rol, u.activo, u.is_active, u.is_superuser, u.created_at
      ORDER BY u.id DESC
    `,
    )
    res.json({ ok: true, items: r.rows })
  } catch (e) {
    next(e)
  }
})

router.post('/usuarios', async (req, res, next) => {
  try {
    const username = String(req.body?.username ?? '').trim()
    const password = String(req.body?.password ?? '')
    const nombreCompleto = String(req.body?.nombre_completo ?? '').trim()
    const email = normalizeEmail(req.body?.email, username)
    const telefono = String(req.body?.telefono ?? '').trim()
    const rol = String(req.body?.rol ?? 'VENDEDOR').trim().toUpperCase()

    if (!username || !password) {
      return res.status(400).json({ ok: false, error: 'Username y password son obligatorios' })
    }
    if (!['ADMIN', 'CREDITO', 'VENDEDOR'].includes(rol)) {
      return res.status(400).json({ ok: false, error: 'Rol inválido' })
    }

    const pool = getPool()
    const dup = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(username) = LOWER($1) LIMIT 1',
      [username],
    )
    if (dup.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese username' })
    }
    const dupEmail = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email],
    )
    if (dupEmail.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese email' })
    }

    const encoded = encodeDjangoPassword(password)

    const ins = await pool.query(
      `
      INSERT INTO usuarios (
        password, last_login, is_superuser, username, first_name, last_name, email,
        is_staff, is_active, date_joined, nombre_completo, rol, activo, created_at, telefono
      ) VALUES (
        $1, NULL, false, $2, '', '', $3,
        false, true, NOW(), $4, $5, true, NOW(), NULLIF($6, '')
      )
      RETURNING id, username, nombre_completo, email, telefono, rol, activo, is_active
    `,
      [encoded, username, email, nombreCompleto || username, rol, telefono],
    )

    await logAudit({
      req,
      accion: 'admin.usuario.crear',
      entidad: 'usuarios',
      entidadId: ins.rows[0].id,
      detalle: {
        username,
        rol,
      },
    })

    res.status(201).json({ ok: true, item: ins.rows[0] })
  } catch (e) {
    next(e)
  }
})

router.get('/usuarios/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const pool = getPool()
    const r = await pool.query(
      `
      SELECT id, username, nombre_completo, email, telefono, rol, activo, is_active, is_superuser
      FROM usuarios
      WHERE id = $1
      LIMIT 1
    `,
      [id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

router.put('/usuarios/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const username = String(req.body?.username ?? '').trim()
    const nombreCompleto = String(req.body?.nombre_completo ?? '').trim()
    const email = normalizeEmail(req.body?.email, username)
    const telefono = String(req.body?.telefono ?? '').trim()
    const rol = String(req.body?.rol ?? '').trim().toUpperCase()
    const activo = Boolean(req.body?.activo)
    const isActive = Boolean(req.body?.is_active)

    if (!username) {
      return res.status(400).json({ ok: false, error: 'Username requerido' })
    }

    if (!['ADMIN', 'CREDITO', 'VENDEDOR'].includes(rol)) {
      return res.status(400).json({ ok: false, error: 'Rol inválido' })
    }

    const pool = getPool()
    const dup = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1',
      [username, id],
    )
    if (dup.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese username' })
    }
    const dupEmail = await pool.query(
      'SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
      [email, id],
    )
    if (dupEmail.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese email' })
    }

    const r = await pool.query(
      `
      UPDATE usuarios
      SET username = $1,
          nombre_completo = $2,
          email = $3,
          telefono = NULLIF($4, ''),
          rol = $5,
          activo = $6,
          is_active = $7
      WHERE id = $8
      RETURNING id, username, nombre_completo, email, telefono, rol, activo, is_active, is_superuser
    `,
      [username, nombreCompleto, email, telefono, rol, activo, isActive, id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    await logAudit({
      req,
      accion: 'admin.usuario.actualizar',
      entidad: 'usuarios',
      entidadId: id,
      detalle: { rol, username },
    })
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

router.post('/usuarios/:id/reset-password', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })
    const newPassword = String(req.body?.newPassword ?? '')
    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ ok: false, error: 'Nueva contraseña inválida' })
    }

    const pool = getPool()
    const encoded = encodeDjangoPassword(newPassword)
    const r = await pool.query(
      'UPDATE usuarios SET password = $1 WHERE id = $2 RETURNING id, username',
      [encoded, id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    await logAudit({
      req,
      accion: 'admin.usuario.reset_password',
      entidad: 'usuarios',
      entidadId: id,
    })
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

router.delete('/usuarios/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })
    const pool = getPool()
    const r = await pool.query(
      `
      UPDATE usuarios
      SET activo = false, is_active = false
      WHERE id = $1
      RETURNING id, username, activo, is_active
    `,
      [id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    await logAudit({
      req,
      accion: 'admin.usuario.desactivar',
      entidad: 'usuarios',
      entidadId: id,
    })
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

/**
 * Borra el usuario de la BD. Desvincula referencias (notas, importaciones, historial, etc.).
 * No puedes eliminarte a ti mismo ni (si no eres superusuario) a un superusuario.
 */
router.post('/usuarios/:id/eliminar-permanente', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) {
      return res.status(400).json({ ok: false, error: 'ID inválido' })
    }
    if (String(req.user.sub) === String(id)) {
      return res.status(400).json({ ok: false, error: 'No puedes eliminar tu propio usuario' })
    }

    const pool = getPool()
    const prevR = await pool.query(
      'SELECT id, username, is_superuser FROM usuarios WHERE id = $1 LIMIT 1',
      [id],
    )
    if (prevR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }
    const target = prevR.rows[0]
    if (target.is_superuser && !req.user.isSuperuser) {
      return res.status(403).json({ ok: false, error: 'No se puede eliminar un superusuario' })
    }

    const actorId = Number.parseInt(String(req.user.sub), 10)
    if (!Number.isFinite(actorId) || actorId <= 0) {
      return res.status(500).json({ ok: false, error: 'Sesión inválida para esta operación' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM usuario_rutas WHERE usuario_id = $1', [id])
      // Tablas con usuario_id NOT NULL (Django / esquema antiguo): no se puede SET NULL.
      await client.query('DELETE FROM documentos WHERE usuario_id = $1', [id])
      await client.query('DELETE FROM aclaraciones WHERE usuario_id = $1', [id])
      await client.query('DELETE FROM historial_notas WHERE usuario_id = $1', [id])
      await client.query('UPDATE notas_credito SET usuario_id = NULL WHERE usuario_id = $1', [id])
      // Importaciones suelen exigir usuario: reasignar al admin que ejecuta el borrado.
      await client.query('UPDATE importaciones SET usuario_id = $2 WHERE usuario_id = $1', [
        id,
        actorId,
      ])
      await client.query('UPDATE auditoria_eventos SET usuario_id = NULL WHERE usuario_id = $1', [id])
      const delR = await client.query('DELETE FROM usuarios WHERE id = $1 RETURNING id, username', [id])
      await client.query('COMMIT')

      await logAudit({
        req,
        accion: 'admin.usuario.eliminar_permanente',
        entidad: 'usuarios',
        entidadId: id,
        detalle: { username: target.username },
      })
      res.json({ ok: true, item: delR.rows[0] })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    next(e)
  }
})

router.get('/usuarios/:id/rutas', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })
    const pool = getPool()

    const userR = await pool.query(
      'SELECT id, username, nombre_completo FROM usuarios WHERE id = $1 LIMIT 1',
      [id],
    )
    if (userR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }

    const rutasR = await pool.query(
      `
      SELECT
        r.id, r.codigo, r.nombre,
        EXISTS (
          SELECT 1 FROM usuario_rutas ur
          WHERE ur.usuario_id = $1 AND ur.ruta_id = r.id
        ) AS asignada
      FROM rutas r
      ORDER BY r.codigo ASC
    `,
      [id],
    )

    res.json({ ok: true, user: userR.rows[0], rutas: rutasR.rows })
  } catch (e) {
    next(e)
  }
})

router.put('/usuarios/:id/rutas', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const rutaIds = Array.isArray(req.body?.rutaIds)
      ? req.body.rutaIds
          .map((v) => Number.parseInt(String(v), 10))
          .filter((v) => Number.isFinite(v) && v > 0)
      : []

    const pool = getPool()
    const userR = await pool.query('SELECT id FROM usuarios WHERE id = $1 LIMIT 1', [id])
    if (userR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Usuario no encontrado' })
    }

    await pool.query('DELETE FROM usuario_rutas WHERE usuario_id = $1', [id])
    for (const rutaId of rutaIds) {
      await pool.query(
        `
        INSERT INTO usuario_rutas (created_at, ruta_id, usuario_id)
        VALUES (NOW(), $1, $2)
      `,
        [rutaId, id],
      )
    }

    await logAudit({
      req,
      accion: 'admin.usuario.asignar_rutas',
      entidad: 'usuario_rutas',
      entidadId: id,
      detalle: { rutaIds },
    })

    res.json({ ok: true, assignedCount: rutaIds.length })
  } catch (e) {
    next(e)
  }
})

router.get('/rutas/:id/usuarios', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })
    const pool = getPool()

    const rutaR = await pool.query(
      'SELECT id, codigo, nombre FROM rutas WHERE id = $1 LIMIT 1',
      [id],
    )
    if (rutaR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
    }

    const usuariosR = await pool.query(
      `
      SELECT
        u.id, u.username, u.nombre_completo, u.rol, u.activo, u.is_active,
        EXISTS (
          SELECT 1 FROM usuario_rutas ur
          WHERE ur.ruta_id = $1 AND ur.usuario_id = u.id
        ) AS asignado
      FROM usuarios u
      ORDER BY u.nombre_completo ASC NULLS LAST, u.username ASC
    `,
      [id],
    )

    res.json({ ok: true, ruta: rutaR.rows[0], usuarios: usuariosR.rows })
  } catch (e) {
    next(e)
  }
})

router.put('/rutas/:id/usuarios', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const usuarioIdsRaw = Array.isArray(req.body?.usuarioIds)
      ? req.body.usuarioIds
      : []
    const usuarioIds = [...new Set(usuarioIdsRaw.map((x) => parseId(x)).filter(Boolean))]

    const pool = getPool()
    const rutaR = await pool.query('SELECT id FROM rutas WHERE id = $1 LIMIT 1', [id])
    if (rutaR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
    }

    if (usuarioIds.length > 0) {
      const usersR = await pool.query(
        'SELECT id FROM usuarios WHERE id = ANY($1::int[])',
        [usuarioIds],
      )
      const found = new Set(usersR.rows.map((r) => Number(r.id)))
      const missing = usuarioIds.filter((x) => !found.has(Number(x)))
      if (missing.length > 0) {
        return res.status(400).json({
          ok: false,
          error: `Usuarios inexistentes: ${missing.join(', ')}`,
        })
      }
    }

    await pool.query('DELETE FROM usuario_rutas WHERE ruta_id = $1', [id])

    if (usuarioIds.length > 0) {
      await pool.query(
        `
        INSERT INTO usuario_rutas (created_at, ruta_id, usuario_id)
        SELECT NOW(), $1, x::int
        FROM UNNEST($2::int[]) AS x
      `,
        [id, usuarioIds],
      )
    }

    await logAudit({
      req,
      accion: 'admin.ruta.asignar_usuarios',
      entidad: 'usuario_rutas',
      entidadId: id,
      detalle: { usuarioIds },
    })

    res.json({ ok: true, assignedCount: usuarioIds.length })
  } catch (e) {
    next(e)
  }
})

router.get('/rutas', async (_req, res, next) => {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      SELECT
        r.id, r.codigo, r.nombre, r.descripcion, r.activa, r.created_at,
        COUNT(ur.usuario_id)::int AS rutas_enlazadas
      FROM rutas r
      LEFT JOIN usuario_rutas ur ON ur.ruta_id = r.id
      GROUP BY r.id, r.codigo, r.nombre, r.descripcion, r.activa, r.created_at
      ORDER BY codigo ASC
    `,
    )
    res.json({ ok: true, items: r.rows })
  } catch (e) {
    next(e)
  }
})

router.get('/rutas/sin-asignar-vendedor', async (_req, res, next) => {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      SELECT
        r.id,
        r.codigo,
        r.nombre,
        r.descripcion,
        r.activa,
        COUNT(u.id)::int AS vendedores_asignados
      FROM rutas r
      LEFT JOIN usuario_rutas ur ON ur.ruta_id = r.id
      LEFT JOIN usuarios u
        ON u.id = ur.usuario_id
       AND u.rol = 'VENDEDOR'
       AND u.activo = true
       AND u.is_active = true
      GROUP BY r.id, r.codigo, r.nombre, r.descripcion, r.activa
      HAVING COUNT(u.id) = 0
      ORDER BY r.codigo ASC
    `,
    )
    res.json({ ok: true, items: r.rows })
  } catch (e) {
    next(e)
  }
})

router.get('/notas/sin-asignar-vendedor', async (req, res, next) => {
  try {
    const empresa = String(req.query?.empresa ?? '')
      .trim()
      .toUpperCase()
    if (empresa && !['DISTRIBUIDORA', 'RODRIGO'].includes(empresa)) {
      return res.status(400).json({ ok: false, error: 'Empresa inválida' })
    }
    const page = Math.max(1, Number.parseInt(String(req.query?.page ?? '1'), 10) || 1)
    const pageSize = Math.min(
      200,
      Math.max(20, Number.parseInt(String(req.query?.pageSize ?? '100'), 10) || 100),
    )

    const pool = getPool()
    const params = []
    const where = [
      `NOT EXISTS (
        SELECT 1
        FROM usuario_rutas ur
        JOIN usuarios u ON u.id = ur.usuario_id
        WHERE ur.ruta_id = n.ruta_id
          AND u.rol = 'VENDEDOR'
          AND u.activo = true
          AND u.is_active = true
      )`,
    ]
    if (empresa) {
      params.push(empresa)
      where.push(`n.empresa = $${params.length}`)
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
    const offset = (page - 1) * pageSize
    params.push(pageSize)
    const limitParam = `$${params.length}`
    params.push(offset)
    const offsetParam = `$${params.length}`

    const r = await pool.query(
      `
      SELECT
        n.id,
        n.serie_folio,
        n.cliente,
        n.empresa,
        n.estado,
        n.usuario_vendedor_pv,
        rc.codigo AS ruta_codigo
      FROM notas_credito n
      LEFT JOIN rutas rc ON rc.id = n.ruta_id
      ${whereSql}
      ORDER BY n.id DESC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
      params,
    )
    res.json({
      ok: true,
      empresa: empresa || null,
      page,
      pageSize,
      hasMore: r.rows.length === pageSize,
      items: r.rows,
    })
  } catch (e) {
    next(e)
  }
})

router.get('/rutas/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const pool = getPool()
    const r = await pool.query(
      'SELECT id, codigo, nombre, descripcion, activa FROM rutas WHERE id = $1 LIMIT 1',
      [id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
    }
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

router.post('/rutas', async (req, res, next) => {
  try {
    const codigo = String(req.body?.codigo ?? '').trim().toUpperCase()
    const nombre = String(req.body?.nombre ?? '').trim()
    const descripcion = String(req.body?.descripcion ?? '').trim()
    const activa = req.body?.activa !== false

    if (!codigo || !nombre) {
      return res.status(400).json({ ok: false, error: 'Código y nombre son obligatorios' })
    }

    const pool = getPool()
    const dup = await pool.query(
      'SELECT id FROM rutas WHERE UPPER(TRIM(codigo)) = $1 LIMIT 1',
      [codigo],
    )
    if (dup.rowCount > 0) {
      return res.status(409).json({ ok: false, error: 'Ya existe una ruta con ese código' })
    }

    const r = await pool.query(
      `
      INSERT INTO rutas (codigo, nombre, descripcion, activa, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id, codigo, nombre, descripcion, activa, created_at
    `,
      [codigo, nombre, descripcion, activa],
    )

    await logAudit({
      req,
      accion: 'admin.ruta.crear',
      entidad: 'rutas',
      entidadId: r.rows[0].id,
      detalle: { codigo, nombre },
    })

    res.status(201).json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

router.put('/rutas/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const codigo = String(req.body?.codigo ?? '').trim().toUpperCase()
    const nombre = String(req.body?.nombre ?? '').trim()
    const descripcion = String(req.body?.descripcion ?? '').trim()
    const activa = Boolean(req.body?.activa)

    if (!codigo || !nombre) {
      return res.status(400).json({ ok: false, error: 'Código y nombre son obligatorios' })
    }

    const pool = getPool()
    const r = await pool.query(
      `
      UPDATE rutas
      SET codigo = $1, nombre = $2, descripcion = $3, activa = $4
      WHERE id = $5
      RETURNING id, codigo, nombre, descripcion, activa
    `,
      [codigo, nombre, descripcion, activa, id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
    }
    await logAudit({
      req,
      accion: 'admin.ruta.actualizar',
      entidad: 'rutas',
      entidadId: id,
      detalle: { codigo, nombre, activa },
    })
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

/**
 * Elimina una ruta solo si no hay notas de crédito con esa ruta_id.
 */
router.delete('/rutas/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const pool = getPool()
    const notasR = await pool.query(
      'SELECT COUNT(*)::int AS c FROM notas_credito WHERE ruta_id = $1',
      [id],
    )
    const nNotas = notasR.rows[0]?.c ?? 0
    if (nNotas > 0) {
      return res.status(409).json({
        ok: false,
        error: `No se puede eliminar la ruta: hay ${nNotas} nota(s) de crédito asociada(s). Reasigna o archiva las notas antes.`,
        notasCount: nNotas,
      })
    }

    const prevR = await pool.query('SELECT id, codigo, nombre FROM rutas WHERE id = $1 LIMIT 1', [id])
    if (prevR.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Ruta no encontrada' })
    }
    const prev = prevR.rows[0]

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('DELETE FROM usuario_rutas WHERE ruta_id = $1', [id])
      const delR = await client.query('DELETE FROM rutas WHERE id = $1 RETURNING id, codigo', [id])
      await client.query('COMMIT')

      await logAudit({
        req,
        accion: 'admin.ruta.eliminar',
        entidad: 'rutas',
        entidadId: id,
        detalle: { codigo: prev.codigo, nombre: prev.nombre },
      })
      res.json({ ok: true, item: delR.rows[0] })
    } catch (e) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      throw e
    } finally {
      client.release()
    }
  } catch (e) {
    next(e)
  }
})

router.get('/parametros', async (_req, res, next) => {
  try {
    const pool = getPool()
    const r = await pool.query(
      `
      SELECT id, clave, valor, descripcion, updated_at
      FROM parametros
      ORDER BY clave ASC
    `,
    )
    res.json({ ok: true, items: r.rows })
  } catch (e) {
    next(e)
  }
})

router.get('/parametros/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const pool = getPool()
    const r = await pool.query(
      'SELECT id, clave, valor, descripcion, updated_at FROM parametros WHERE id = $1 LIMIT 1',
      [id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Parámetro no encontrado' })
    }
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

router.put('/parametros/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id)
    if (!id) return res.status(400).json({ ok: false, error: 'ID inválido' })

    const valor = String(req.body?.valor ?? '').trim()
    const descripcion = String(req.body?.descripcion ?? '').trim()

    const pool = getPool()
    const r = await pool.query(
      `
      UPDATE parametros
      SET valor = $1, descripcion = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING id, clave, valor, descripcion, updated_at
    `,
      [valor, descripcion, id],
    )
    if (r.rowCount === 0) {
      return res.status(404).json({ ok: false, error: 'Parámetro no encontrado' })
    }
    await logAudit({
      req,
      accion: 'admin.parametro.actualizar',
      entidad: 'parametros',
      entidadId: id,
      detalle: { clave: r.rows[0]?.clave },
    })
    res.json({ ok: true, item: r.rows[0] })
  } catch (e) {
    next(e)
  }
})

export default router
