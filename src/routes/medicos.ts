import { Hono } from 'hono'
import { requerirRol, ROLES_GESTION, cargarSesion } from '../lib/auth'
import { limpiarTexto, parseId } from '../lib/validation'
import { validarHorario } from '../lib/validation'
import { auditar } from '../lib/db'
import type { AppEnv } from '../types'

const medicos = new Hono<AppEnv>()

/* ------------------------------------------------------------------ */
/* GET /api/medicos  -> catálogo público (búsqueda por especialidad)   */
/* ------------------------------------------------------------------ */
medicos.get('/', cargarSesion, async (c) => {
  const q = limpiarTexto(c.req.query('q'), 80)
  const especialidadId = parseId(c.req.query('especialidad_id'))
  const incluirInactivos = c.req.query('incluir_inactivos') === '1'
  const soloActivos = incluirInactivos ? '' : 'AND m.activo = 1'

  let sql = `SELECT m.*, e.nombre AS especialidad
             FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id
             WHERE 1=1 ${soloActivos}`
  const params: unknown[] = []

  if (especialidadId) {
    sql += ' AND m.especialidad_id = ?'
    params.push(especialidadId)
  }
  if (q) {
    sql += ' AND (m.nombre LIKE ? OR e.nombre LIKE ? OR m.consultorio LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY e.nombre, m.nombre'

  const res = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ medicos: res.results ?? [] })
})

/* ------------------------------------------------------------------ */
/* GET /api/medicos/:id -> detalle + horarios                          */
/* ------------------------------------------------------------------ */
medicos.get('/:id', cargarSesion, async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const medico = await c.env.DB.prepare(
    `SELECT m.*, e.nombre AS especialidad
     FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id
     WHERE m.id = ?`,
  )
    .bind(id)
    .first()
  if (!medico) return c.json({ error: 'Médico no encontrado' }, 404)

  const horarios = await c.env.DB.prepare(
    'SELECT * FROM horarios WHERE medico_id = ? ORDER BY dia_semana, hora_inicio',
  )
    .bind(id)
    .all()

  return c.json({ medico, horarios: horarios.results ?? [] })
})

/* ------------------------------------------------------------------ */
/* POST /api/medicos  (recepcionista / admin)                          */
/* ------------------------------------------------------------------ */
medicos.post('/', requerirRol(...ROLES_GESTION), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const errores: Record<string, string> = {}

  const nombre = limpiarTexto(body?.nombre, 80)
  const email = limpiarTexto(body?.email, 120).toLowerCase()
  const telefono = limpiarTexto(body?.telefono, 20)
  const colegiado = limpiarTexto(body?.numero_colegiado, 40)
  const consultorio = limpiarTexto(body?.consultorio, 40)
  const bio = limpiarTexto(body?.bio, 400)
  const especialidadId = parseId(body?.especialidad_id)

  if (!nombre || nombre.length < 3) errores.nombre = 'El nombre del médico es obligatorio (mín. 3 caracteres)'
  if (!especialidadId) errores.especialidad_id = 'Debes seleccionar una especialidad'
  if (email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email))
    errores.email = 'El correo no tiene un formato válido'
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  const esp = await c.env.DB.prepare('SELECT id FROM especialidades WHERE id = ? AND activo = 1')
    .bind(especialidadId)
    .first()
  if (!esp) return c.json({ error: 'Datos inválidos', errores: { especialidad_id: 'La especialidad no existe o está inactiva' } }, 400)

  if (email) {
    const dup = await c.env.DB.prepare('SELECT id FROM medicos WHERE email = ?').bind(email).first()
    if (dup) return c.json({ error: 'Datos inválidos', errores: { email: 'Ya existe un médico con ese correo' } }, 409)
  }

  const res = await c.env.DB.prepare(
    `INSERT INTO medicos (nombre, email, telefono, numero_colegiado, especialidad_id, consultorio, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(nombre, email || null, telefono || null, colegiado || null, especialidadId, consultorio || null, bio || null)
    .run()

  const id = Number(res.meta.last_row_id)
  await auditar(c.env, c.get('usuario').id, 'crear_medico', 'medicos', id, { nombre })
  const medico = await c.env.DB.prepare('SELECT * FROM medicos WHERE id = ?').bind(id).first()
  return c.json({ medico }, 201)
})

/* ------------------------------------------------------------------ */
/* PUT /api/medicos/:id                                                */
/* ------------------------------------------------------------------ */
medicos.put('/:id', requerirRol(...ROLES_GESTION), async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)
  const body = await c.req.json().catch(() => ({}))

  const existe = await c.env.DB.prepare('SELECT id FROM medicos WHERE id = ?').bind(id).first()
  if (!existe) return c.json({ error: 'Médico no encontrado' }, 404)

  const errores: Record<string, string> = {}
  const nombre = limpiarTexto(body?.nombre, 80)
  const email = limpiarTexto(body?.email, 120).toLowerCase()
  const telefono = limpiarTexto(body?.telefono, 20)
  const colegiado = limpiarTexto(body?.numero_colegiado, 40)
  const consultorio = limpiarTexto(body?.consultorio, 40)
  const bio = limpiarTexto(body?.bio, 400)
  const especialidadId = parseId(body?.especialidad_id)
  const activo = body?.activo === undefined ? 1 : body.activo ? 1 : 0

  if (!nombre || nombre.length < 3) errores.nombre = 'El nombre del médico es obligatorio (mín. 3 caracteres)'
  if (!especialidadId) errores.especialidad_id = 'Debes seleccionar una especialidad'
  if (email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email))
    errores.email = 'El correo no tiene un formato válido'
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  if (email) {
    const dup = await c.env.DB.prepare('SELECT id FROM medicos WHERE email = ? AND id != ?').bind(email, id).first()
    if (dup) return c.json({ error: 'Datos inválidos', errores: { email: 'Ya existe otro médico con ese correo' } }, 409)
  }

  await c.env.DB.prepare(
    `UPDATE medicos SET nombre = ?, email = ?, telefono = ?, numero_colegiado = ?,
       especialidad_id = ?, consultorio = ?, bio = ?, activo = ? WHERE id = ?`,
  )
    .bind(nombre, email || null, telefono || null, colegiado || null, especialidadId, consultorio || null, bio || null, activo, id)
    .run()

  await auditar(c.env, c.get('usuario').id, 'actualizar_medico', 'medicos', id, { nombre, activo })
  const medico = await c.env.DB.prepare('SELECT * FROM medicos WHERE id = ?').bind(id).first()
  return c.json({ medico })
})

/* ------------------------------------------------------------------ */
/* DELETE /api/medicos/:id -> baja lógica (conserva el historial)      */
/* ------------------------------------------------------------------ */
medicos.delete('/:id', requerirRol(...ROLES_GESTION), async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const proximas = await c.env.DB.prepare(
    `SELECT COUNT(*) AS total FROM citas
     WHERE medico_id = ? AND estado IN ('pendiente','confirmada')
       AND date(fecha) >= date('now')`,
  )
    .bind(id)
    .first<{ total: number }>()

  if ((proximas?.total ?? 0) > 0) {
    return c.json(
      {
        error: `No se puede dar de baja: el médico tiene ${proximas?.total} cita(s) futura(s). Cancélalas o reasígnalas primero.`,
      },
      409,
    )
  }

  await c.env.DB.prepare('UPDATE medicos SET activo = 0 WHERE id = ?').bind(id).run()
  await c.env.DB.prepare('UPDATE horarios SET activo = 0 WHERE medico_id = ?').bind(id).run()
  await c.env.DB.prepare("UPDATE usuarios SET activo = 0 WHERE medico_id = ? AND rol = 'medico'").bind(id).run()
  await auditar(c.env, c.get('usuario').id, 'baja_medico', 'medicos', id)

  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ */
/* POST /api/medicos/:id/horarios  -> añadir horario                   */
/* ------------------------------------------------------------------ */
medicos.post('/:id/horarios', requerirRol(...ROLES_GESTION), async (c) => {
  const medicoId = parseId(c.req.param('id'))
  if (!medicoId) return c.json({ error: 'Identificador inválido' }, 400)

  const medico = await c.env.DB.prepare('SELECT id FROM medicos WHERE id = ?').bind(medicoId).first()
  if (!medico) return c.json({ error: 'Médico no encontrado' }, 404)

  const body = await c.req.json().catch(() => ({}))
  const dia = Number(body?.dia_semana)
  const horaInicio = limpiarTexto(body?.hora_inicio, 5)
  const horaFin = limpiarTexto(body?.hora_fin, 5)
  const duracion = Number(body?.duracion_min ?? 30)

  const errores: Record<string, string> = {}
  if (!Number.isInteger(dia) || dia < 0 || dia > 6) errores.dia_semana = 'El día de la semana no es válido'
  const errHorario = validarHorario(horaInicio, horaFin, duracion)
  if (errHorario) errores.hora_inicio = errHorario
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  const solapa = await c.env.DB.prepare(
    `SELECT id FROM horarios WHERE medico_id = ? AND dia_semana = ? AND activo = 1
       AND NOT (hora_fin <= ? OR hora_inicio >= ?)`,
  )
    .bind(medicoId, dia, horaInicio, horaFin)
    .first()
  if (solapa) {
    return c.json({ error: 'Datos inválidos', errores: { hora_inicio: 'Ese bloque se solapa con otro horario ya registrado' } }, 409)
  }

  const res = await c.env.DB.prepare(
    `INSERT INTO horarios (medico_id, dia_semana, hora_inicio, hora_fin, duracion_min)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(medicoId, dia, horaInicio, horaFin, duracion)
    .run()

  await auditar(c.env, c.get('usuario').id, 'crear_horario', 'horarios', Number(res.meta.last_row_id), { medicoId, dia, horaInicio, horaFin })
  const horario = await c.env.DB.prepare('SELECT * FROM horarios WHERE id = ?')
    .bind(Number(res.meta.last_row_id))
    .first()
  return c.json({ horario }, 201)
})

export default medicos