import { Hono } from 'hono'
import { limpiarTexto, parseId, validarFechaHora } from '../lib/validation'
import { generarSlots, fechaLocal, sumarDias, type Slot } from '../lib/slots'
import { horariosDeMedico, citasOcupadas, tzOffset } from '../lib/citas'
import { getCookie } from 'hono/cookie'
import { verify } from 'hono/jwt'
import type { AppEnv, SesionUsuario } from '../types'

const disponibilidad = new Hono<AppEnv>()

/* ------------------------------------------------------------------ */
/* GET /api/disponibilidad/medicos                                     */
/*   Busca médicos con huecos libres por especialidad y fecha          */
/* ------------------------------------------------------------------ */
disponibilidad.get('/medicos', async (c) => {
  const especialidadId = parseId(c.req.query('especialidad_id'))
  const q = limpiarTexto(c.req.query('q'), 80)
  const fecha = limpiarTexto(c.req.query('fecha'), 10) || fechaLocal(Date.now(), tzOffset(c.env))
  const diasFuturos = Math.min(Math.max(Number(c.req.query('dias') ?? 1) || 1, 1), 30)

  if (validarFechaHora(fecha, '00:00')) return c.json({ error: 'La fecha no es válida' }, 400)

  let sql = `SELECT m.id, m.nombre, m.consultorio, m.bio, e.nombre AS especialidad, e.id AS especialidad_id
             FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id
             WHERE m.activo = 1 AND e.activo = 1`
  const params: unknown[] = []
  if (especialidadId) {
    sql += ' AND m.especialidad_id = ?'
    params.push(especialidadId)
  }
  if (q) {
    sql += ' AND (m.nombre LIKE ? OR e.nombre LIKE ?)'
    params.push(`%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY e.nombre, m.nombre'

  const medicos = await c.env.DB.prepare(sql).bind(...params).all<{
    id: number
    nombre: string
    consultorio: string | null
    bio: string | null
    especialidad: string
    especialidad_id: number
  }>()

  const ahora = Date.now()
  const resultado = []

  for (const m of medicos.results ?? []) {
    const horarios = await horariosDeMedico(c.env, m.id)
    const agenda: { fecha: string; slots_libres: number; primer_slot: string | null }[] = []
    let totalLibres = 0

    for (let i = 0; i < diasFuturos; i++) {
      const f = sumarDias(fecha, i)
      const ocupadas = await citasOcupadas(c.env, m.id, f)
      const slots = generarSlots(horarios, ocupadas, f, ahora, tzOffset(c.env))
      const libres = slots.filter((s) => s.disponible)
      totalLibres += libres.length
      if (libres.length) {
        agenda.push({ fecha: f, slots_libres: libres.length, primer_slot: libres[0].hora_inicio })
      }
    }

    resultado.push({ ...m, total_slots_libres: totalLibres, dias_con_disponibilidad: agenda })
  }

  // Primero los médicos con más disponibilidad
  resultado.sort((a, b) => b.total_slots_libres - a.total_slots_libres || a.nombre.localeCompare(b.nombre))

  return c.json({ fecha_inicio: fecha, dias: diasFuturos, medicos: resultado })
})

/* ------------------------------------------------------------------ */
/* GET /api/disponibilidad/slots?medico_id=X&fecha=YYYY-MM-DD          */
/* ------------------------------------------------------------------ */
disponibilidad.get('/slots', async (c) => {
  const medicoId = parseId(c.req.query('medico_id'))
  const fecha = limpiarTexto(c.req.query('fecha'), 10)
  if (!medicoId) return c.json({ error: 'Debes indicar medico_id' }, 400)
  if (!fecha || validarFechaHora(fecha, '00:00')) return c.json({ error: 'Debes indicar una fecha válida (AAAA-MM-DD)' }, 400)

  const medico = await c.env.DB.prepare(
    `SELECT m.id, m.nombre, m.consultorio, m.activo, e.nombre AS especialidad
     FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id WHERE m.id = ?`,
  )
    .bind(medicoId)
    .first()
  if (!medico) return c.json({ error: 'Médico no encontrado' }, 404)

  const horarios = await horariosDeMedico(c.env, medicoId)
  const ocupadas = await citasOcupadas(c.env, medicoId, fecha)
  const slots: Slot[] = generarSlots(horarios, ocupadas, fecha, Date.now(), tzOffset(c.env))

  // Si el solicitante es el propio paciente, marcamos sus citas para poder distinguirlas
  let misCitas: number[] = []
  const usuario = await usuarioDesdeCookie(c)
  if (usuario) {
    const res = await c.env.DB.prepare(
      `SELECT id FROM citas WHERE medico_id = ? AND fecha = ? AND paciente_id = ?
       AND estado IN ('pendiente','confirmada')`,
    )
      .bind(medicoId, fecha, usuario.id)
      .all<{ id: number }>()
    misCitas = (res.results ?? []).map((r) => r.id)
  }

  return c.json({
    medico,
    fecha,
    slots,
    total_libres: slots.filter((s) => s.disponible).length,
    mis_citas_en_fecha: misCitas,
  })
})

/* ------------------------------------------------------------------ */
/* GET /api/disponibilidad/resumen?fecha=YYYY-MM-DD  (gestión)         */
/* ------------------------------------------------------------------ */
disponibilidad.get('/resumen', async (c) => {
  const fecha = limpiarTexto(c.req.query('fecha'), 10) || fechaLocal(Date.now(), tzOffset(c.env))
  if (validarFechaHora(fecha, '00:00')) return c.json({ error: 'La fecha no es válida' }, 400)

  const medicos = await c.env.DB.prepare(
    `SELECT m.id, m.nombre, m.consultorio, e.nombre AS especialidad
     FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id
     WHERE m.activo = 1 ORDER BY e.nombre, m.nombre`,
  ).all<{ id: number; nombre: string; consultorio: string | null; especialidad: string }>()

  const ahora = Date.now()
  const resumen = []
  for (const m of medicos.results ?? []) {
    const horarios = await horariosDeMedico(c.env, m.id)
    const ocupadas = await citasOcupadas(c.env, m.id, fecha)
    const slots = generarSlots(horarios, ocupadas, fecha, ahora, tzOffset(c.env))
    resumen.push({
      ...m,
      total_slots: slots.length,
      libres: slots.filter((s) => s.disponible).length,
      ocupados: slots.filter((s) => !s.disponible && s.motivo === 'ocupado').length,
      pasados: slots.filter((s) => s.motivo === 'pasado').length,
    })
  }
  return c.json({ fecha, resumen })
})

async function usuarioDesdeCookie(c: any): Promise<SesionUsuario | null> {
  const token = getCookie(c, 'citas_token')
  if (!token) return null
  try {
    const p = await verify(token, c.env.JWT_SECRET || 'dev-secret-citas-consultorio-2026', 'HS256')
    return {
      id: Number(p.sub),
      email: String(p.email),
      nombre: String(p.nombre),
      rol: p.rol as SesionUsuario['rol'],
      medico_id: p.medico_id == null ? null : Number(p.medico_id),
    }
  } catch {
    return null
  }
}

export default disponibilidad