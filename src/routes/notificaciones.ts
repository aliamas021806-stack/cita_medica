import { Hono } from 'hono'
import { requerirSesion } from '../lib/auth'
import { parseId } from '../lib/validation'
import type { AppEnv } from '../types'

const notificaciones = new Hono<AppEnv>()

/* ------------------------------------------------------------------ */
/* GET /api/notificaciones  -> bandeja del usuario (RF7)               */
/* ------------------------------------------------------------------ */
notificaciones.get('/', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const soloNoLeidas = c.req.query('no_leidas') === '1'

  const res = await c.env.DB.prepare(
    `SELECT n.*, c.fecha AS cita_fecha, c.hora_inicio AS cita_hora, m.nombre AS medico_nombre
     FROM notificaciones n
     LEFT JOIN citas c ON c.id = n.cita_id
     LEFT JOIN medicos m ON m.id = c.medico_id
     WHERE n.usuario_id = ? ${soloNoLeidas ? 'AND n.leida = 0' : ''}
     ORDER BY n.leida ASC, n.created_at DESC LIMIT 100`,
  )
    .bind(usuario.id)
    .all()

  const sinLeer = await c.env.DB.prepare(
    'SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida = 0',
  )
    .bind(usuario.id)
    .first<{ total: number }>()

  return c.json({ notificaciones: res.results ?? [], sin_leer: sinLeer?.total ?? 0 })
})

/* ------------------------------------------------------------------ */
/* PATCH /api/notificaciones/:id/leer                                  */
/* ------------------------------------------------------------------ */
notificaciones.patch('/:id/leer', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  await c.env.DB.prepare('UPDATE notificaciones SET leida = 1 WHERE id = ? AND usuario_id = ?')
    .bind(id, usuario.id)
    .run()
  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ */
/* PATCH /api/notificaciones/leer-todas                                */
/* ------------------------------------------------------------------ */
notificaciones.patch('/leer-todas', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  await c.env.DB.prepare('UPDATE notificaciones SET leida = 1 WHERE usuario_id = ?')
    .bind(usuario.id)
    .run()
  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ */
/* DELETE /api/notificaciones/:id                                      */
/* ------------------------------------------------------------------ */
notificaciones.delete('/:id', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  await c.env.DB.prepare('DELETE FROM notificaciones WHERE id = ? AND usuario_id = ?')
    .bind(id, usuario.id)
    .run()
  return c.json({ ok: true })
})

export default notificaciones