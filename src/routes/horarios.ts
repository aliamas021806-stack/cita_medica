import { Hono } from 'hono'
import { requerirRol, ROLES_GESTION } from '../lib/auth'
import { limpiarTexto, parseId, validarHorario } from '../lib/validation'
import { auditar } from '../lib/db'
import type { AppEnv } from '../types'

const horarios = new Hono<AppEnv>()

/* ------------------------------------------------------------------ */
/* GET /api/horarios?medico_id=X                                       */
/* ------------------------------------------------------------------ */
horarios.get('/', async (c) => {
  const medicoId = parseId(c.req.query('medico_id'))
  if (!medicoId) return c.json({ error: 'Debes indicar medico_id' }, 400)

  const res = await c.env.DB.prepare(
    'SELECT * FROM horarios WHERE medico_id = ? ORDER BY dia_semana, hora_inicio',
  )
    .bind(medicoId)
    .all()
  return c.json({ horarios: res.results ?? [] })
})

/* ------------------------------------------------------------------ */
/* PUT /api/horarios/:id                                               */
/* ------------------------------------------------------------------ */
horarios.put('/:id', requerirRol(...ROLES_GESTION), async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const actual = await c.env.DB.prepare('SELECT * FROM horarios WHERE id = ?')
    .bind(id)
    .first<{ id: number; medico_id: number }>()
  if (!actual) return c.json({ error: 'Horario no encontrado' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const dia = body?.dia_semana === undefined ? undefined : Number(body.dia_semana)
  const horaInicio = limpiarTexto(body?.hora_inicio, 5)
  const horaFin = limpiarTexto(body?.hora_fin, 5)
  const duracion = Number(body?.duracion_min ?? 30)
  const activo = body?.activo === undefined ? 1 : body.activo ? 1 : 0

  const errores: Record<string, string> = {}
  if (dia !== undefined && (!Number.isInteger(dia) || dia < 0 || dia > 6))
    errores.dia_semana = 'El día de la semana no es válido'
  const errHorario = validarHorario(horaInicio, horaFin, duracion)
  if (errHorario) errores.hora_inicio = errHorario
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  const solapa = await c.env.DB.prepare(
    `SELECT id FROM horarios WHERE medico_id = ? AND dia_semana = ? AND id != ? AND activo = 1
       AND NOT (hora_fin <= ? OR hora_inicio >= ?)`,
  )
    .bind(actual.medico_id, dia ?? 0, id, horaInicio, horaFin)
    .first()
  if (solapa) {
    return c.json({ error: 'Datos inválidos', errores: { hora_inicio: 'Ese bloque se solapa con otro horario ya registrado' } }, 409)
  }

  await c.env.DB.prepare(
    `UPDATE horarios SET dia_semana = COALESCE(?, dia_semana), hora_inicio = ?, hora_fin = ?,
       duracion_min = ?, activo = ? WHERE id = ?`,
  )
    .bind(dia ?? null, horaInicio, horaFin, duracion, activo, id)
    .run()

  await auditar(c.env, c.get('usuario').id, 'actualizar_horario', 'horarios', id, { horaInicio, horaFin, duracion, activo })
  const horario = await c.env.DB.prepare('SELECT * FROM horarios WHERE id = ?').bind(id).first()
  return c.json({ horario })
})

/* ------------------------------------------------------------------ */
/* DELETE /api/horarios/:id                                            */
/* ------------------------------------------------------------------ */
horarios.delete('/:id', requerirRol(...ROLES_GESTION), async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const existe = await c.env.DB.prepare('SELECT id FROM horarios WHERE id = ?').bind(id).first()
  if (!existe) return c.json({ error: 'Horario no encontrado' }, 404)

  await c.env.DB.prepare('DELETE FROM horarios WHERE id = ?').bind(id).run()
  await auditar(c.env, c.get('usuario').id, 'eliminar_horario', 'horarios', id)
  return c.json({ ok: true })
})

export default horarios