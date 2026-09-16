import { Hono } from 'hono'
import { requerirRol } from '../lib/auth'
import { limpiarTexto, parseId } from '../lib/validation'
import { fechaLocal } from '../lib/slots'
import { tzOffset } from '../lib/citas'
import type { AppEnv } from '../types'

const medico = new Hono<AppEnv>()

/* ------------------------------------------------------------------ */
/* GET /api/medico/agenda?fecha=YYYY-MM-DD  -> agenda del día (RF)     */
/* ------------------------------------------------------------------ */
medico.get('/agenda', requerirRol('medico'), async (c) => {
  const usuario = c.get('usuario')
  const medicoId = usuario.medico_id
  if (!medicoId) return c.json({ error: 'Tu usuario no está vinculado a un médico' }, 400)

  const fecha = limpiarTexto(c.req.query('fecha'), 10) || fechaLocal(Date.now(), tzOffset(c.env))

  const res = await c.env.DB.prepare(
    `SELECT c.id, c.fecha, c.hora_inicio, c.hora_fin, c.estado, c.motivo, c.notas,
            u.id AS paciente_id, u.nombre AS paciente_nombre, u.email AS paciente_email,
            u.telefono AS paciente_telefono, u.documento AS paciente_documento,
            (SELECT COUNT(*) FROM citas x WHERE x.paciente_id = u.id AND x.estado = 'completada') AS visitas_previas
     FROM citas c JOIN usuarios u ON u.id = c.paciente_id
     WHERE c.medico_id = ? AND c.fecha = ? AND c.estado != 'cancelada'
     ORDER BY c.hora_inicio`,
  )
    .bind(medicoId, fecha)
    .all()

  const citas = (res.results ?? []) as any[]
  const ahora = fechaLocal(Date.now(), tzOffset(c.env))

  return c.json({
    fecha,
    es_hoy: fecha === ahora,
    citas,
    resumen: {
      total: citas.length,
      confirmadas: citas.filter((x) => x.estado === 'confirmada').length,
      pendientes: citas.filter((x) => x.estado === 'pendiente').length,
      completadas: citas.filter((x) => x.estado === 'completada').length,
      no_asistio: citas.filter((x) => x.estado === 'no_asistio').length,
    },
  })
})

/* ------------------------------------------------------------------ */
/* GET /api/medico/pacientes  -> historial de sus pacientes (RF)       */
/* ------------------------------------------------------------------ */
medico.get('/pacientes', requerirRol('medico'), async (c) => {
  const usuario = c.get('usuario')
  const medicoId = usuario.medico_id
  if (!medicoId) return c.json({ error: 'Tu usuario no está vinculado a un médico' }, 400)

  const q = limpiarTexto(c.req.query('q'), 80)
  const res = await c.env.DB.prepare(
    `SELECT u.id, u.nombre, u.email, u.telefono, u.documento,
            COUNT(c.id) AS total_citas,
            SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) AS completadas,
            SUM(CASE WHEN c.estado = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
            SUM(CASE WHEN c.estado = 'no_asistio' THEN 1 ELSE 0 END) AS no_asistio,
            MAX(c.fecha) AS ultima_cita
     FROM citas c JOIN usuarios u ON u.id = c.paciente_id
     WHERE c.medico_id = ? ${q ? 'AND (u.nombre LIKE ? OR u.email LIKE ? OR u.documento LIKE ?)' : ''}
     GROUP BY u.id ORDER BY ultima_cita DESC LIMIT 200`,
  )
    .bind(...(q ? [medicoId, `%${q}%`, `%${q}%`, `%${q}%`] : [medicoId]))
    .all()

  return c.json({ pacientes: res.results ?? [] })
})

/* ------------------------------------------------------------------ */
/* GET /api/medico/paciente/:id  -> historial completo de un paciente  */
/* ------------------------------------------------------------------ */
medico.get('/paciente/:id', requerirRol('medico'), async (c) => {
  const usuario = c.get('usuario')
  const medicoId = usuario.medico_id
  if (!medicoId) return c.json({ error: 'Tu usuario no está vinculado a un médico' }, 400)

  const pacienteId = parseId(c.req.param('id'))
  if (!pacienteId) return c.json({ error: 'Identificador inválido' }, 400)

  const paciente = await c.env.DB.prepare(
    'SELECT id, nombre, email, telefono, documento, created_at FROM usuarios WHERE id = ?',
  )
    .bind(pacienteId)
    .first()
  if (!paciente) return c.json({ error: 'Paciente no encontrado' }, 404)

  const res = await c.env.DB.prepare(
    `SELECT c.id, c.fecha, c.hora_inicio, c.hora_fin, c.estado, c.motivo, c.notas
     FROM citas c WHERE c.medico_id = ? AND c.paciente_id = ?
     ORDER BY c.fecha DESC, c.hora_inicio DESC`,
  )
    .bind(medicoId, pacienteId)
    .all()

  const citas = (res.results ?? []) as any[]
  return c.json({
    paciente,
    citas,
    estadisticas: {
      total: citas.length,
      completadas: citas.filter((x) => x.estado === 'completada').length,
      canceladas: citas.filter((x) => x.estado === 'cancelada').length,
      no_asistio: citas.filter((x) => x.estado === 'no_asistio').length,
    },
  })
})

/* ------------------------------------------------------------------ */
/* PATCH /api/medico/notas/:citaId -> el médico agrega notas clínicas  */
/* ------------------------------------------------------------------ */
medico.patch('/notas/:citaId', requerirRol('medico'), async (c) => {
  const usuario = c.get('usuario')
  const medicoId = usuario.medico_id
  if (!medicoId) return c.json({ error: 'Tu usuario no está vinculado a un médico' }, 400)

  const citaId = parseId(c.req.param('citaId'))
  if (!citaId) return c.json({ error: 'Identificador inválido' }, 400)

  const body = await c.req.json().catch(() => ({}))
  const notas = limpiarTexto(body?.notas, 1000)
  if (!notas) return c.json({ error: 'Datos inválidos', errores: { notas: 'Las notas no pueden estar vacías' } }, 400)

  const cita = await c.env.DB.prepare('SELECT id FROM citas WHERE id = ? AND medico_id = ?')
    .bind(citaId, medicoId)
    .first()
  if (!cita) return c.json({ error: 'Cita no encontrada en tu agenda' }, 404)

  await c.env.DB.prepare('UPDATE citas SET notas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(notas, citaId)
    .run()

  return c.json({ ok: true })
})

export default medico