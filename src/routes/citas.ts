import { Hono } from 'hono'
import { requerirSesion, ROLES_GESTION, requerirRol } from '../lib/auth'
import { limpiarTexto, parseId, validarFechaHora } from '../lib/validation'
import { auditar, notificar, formatearCita } from '../lib/db'
import {
  validarSlot,
  permiteCambioPaciente,
  tzOffset,
  sumarMinutos,
  HORAS_LIMITE_PACIENTE,
} from '../lib/citas'
import { fechaLocal } from '../lib/slots'
import type { AppEnv, SesionUsuario } from '../types'

const citas = new Hono<AppEnv>()

const SELECT_CITA = `
  SELECT c.*, m.nombre AS medico_nombre, m.consultorio, e.nombre AS especialidad,
         u.nombre AS paciente_nombre, u.email AS paciente_email, u.telefono AS paciente_telefono
  FROM citas c
  JOIN medicos m ON m.id = c.medico_id
  JOIN especialidades e ON e.id = m.especialidad_id
  JOIN usuarios u ON u.id = c.paciente_id
`

/* ------------------------------------------------------------------ */
/* GET /api/citas  -> según el rol                                     */
/*   paciente: sus propias citas | gestión: todas | médico: su agenda  */
/* ------------------------------------------------------------------ */
citas.get('/', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const estado = limpiarTexto(c.req.query('estado'), 20)
  const desde = limpiarTexto(c.req.query('desde'), 10)
  const hasta = limpiarTexto(c.req.query('hasta'), 10)
  const medicoId = parseId(c.req.query('medico_id'))
  const pacienteId = parseId(c.req.query('paciente_id'))
  const q = limpiarTexto(c.req.query('q'), 80)

  let sql = SELECT_CITA + ' WHERE 1=1'
  const params: unknown[] = []

  if (usuario.rol === 'paciente') {
    sql += ' AND c.paciente_id = ?'
    params.push(usuario.id)
  } else if (usuario.rol === 'medico') {
    sql += ' AND c.medico_id = ?'
    params.push(usuario.medico_id ?? -1)
  } else {
    if (medicoId) {
      sql += ' AND c.medico_id = ?'
      params.push(medicoId)
    }
    if (pacienteId) {
      sql += ' AND c.paciente_id = ?'
      params.push(pacienteId)
    }
  }

  if (estado) {
    sql += ' AND c.estado = ?'
    params.push(estado)
  }
  if (desde) {
    sql += ' AND c.fecha >= ?'
    params.push(desde)
  }
  if (hasta) {
    sql += ' AND c.fecha <= ?'
    params.push(hasta)
  }
  if (q) {
    sql += ' AND (u.nombre LIKE ? OR m.nombre LIKE ? OR c.motivo LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY c.fecha DESC, c.hora_inicio DESC LIMIT 300'

  const res = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ citas: res.results ?? [] })
})

/* ------------------------------------------------------------------ */
/* GET /api/citas/proximas  -> recordatorios (RF7)                     */
/* ------------------------------------------------------------------ */
citas.get('/proximas', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const hoy = fechaLocal(Date.now(), tzOffset(c.env))

  let sql = SELECT_CITA + " WHERE c.estado IN ('pendiente','confirmada') AND c.fecha >= ?"
  const params: unknown[] = [hoy]

  if (usuario.rol === 'paciente') {
    sql += ' AND c.paciente_id = ?'
    params.push(usuario.id)
  } else if (usuario.rol === 'medico') {
    sql += ' AND c.medico_id = ?'
    params.push(usuario.medico_id ?? -1)
  }
  sql += ' ORDER BY c.fecha, c.hora_inicio LIMIT 20'

  const res = await c.env.DB.prepare(sql).bind(...params).all<{
    id: number; fecha: string; hora_inicio: string; medico_nombre: string;
    paciente_nombre: string; especialidad: string; estado: string; consultorio: string | null
  }>()

  const citasProximas = res.results ?? []
  const manana = (() => {
    const d = new Date(Date.now() - tzOffset(c.env) * 60_000)
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
  })()

  return c.json({
    citas: citasProximas.map((cita) => ({
      ...cita,
      etiqueta:
        cita.fecha === hoy ? 'Hoy' : cita.fecha === manana ? 'Mañana' : formatearCita(cita.fecha, cita.hora_inicio),
      es_inminente: cita.fecha === hoy || cita.fecha === manana,
    })),
  })
})

/* ------------------------------------------------------------------ */
/* GET /api/citas/:id                                                  */
/* ------------------------------------------------------------------ */
citas.get('/:id', requerirSesion, async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const cita = await c.env.DB.prepare(SELECT_CITA + ' WHERE c.id = ?').bind(id).first<any>()
  if (!cita) return c.json({ error: 'Cita no encontrada' }, 404)

  const usuario = c.get('usuario')
  const puedeVer =
    usuario.rol !== 'paciente' || cita.paciente_id === usuario.id
  if (!puedeVer) return c.json({ error: 'No autorizado' }, 403)

  return c.json({ cita })
})

/* ------------------------------------------------------------------ */
/* POST /api/citas  -> reservar (RF3)                                  */
/* ------------------------------------------------------------------ */
citas.post('/', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const body = await c.req.json().catch(() => ({}))

  const medicoId = parseId(body?.medico_id)
  const fecha = limpiarTexto(body?.fecha, 10)
  const hora = limpiarTexto(body?.hora_inicio, 5)
  const motivo = limpiarTexto(body?.motivo, 300)

  const errores: Record<string, string> = {}
  if (!medicoId) errores.medico_id = 'Debes seleccionar un médico'
  const errFH = validarFechaHora(fecha, hora)
  if (errFH) errores.fecha = errFH
  if (!motivo) errores.motivo = 'Indica el motivo de la consulta'
  else if (motivo.length < 5) errores.motivo = 'Describe el motivo con al menos 5 caracteres'
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  // ¿Quién es el paciente? El paciente sólo puede reservar para sí mismo.
  let pacienteId = usuario.id
  if (usuario.rol !== 'paciente') {
    const solicitado = parseId(body?.paciente_id)
    if (!solicitado) {
      return c.json({ error: 'Datos inválidos', errores: { paciente_id: 'Debes seleccionar un paciente' } }, 400)
    }
    pacienteId = solicitado
  }

  const paciente = await c.env.DB.prepare("SELECT id, email, nombre, activo FROM usuarios WHERE id = ? AND rol = 'paciente'")
    .bind(pacienteId)
    .first<{ id: number; email: string; nombre: string; activo: number }>()
  if (!paciente || !paciente.activo) {
    return c.json({ error: 'Datos inválidos', errores: { paciente_id: 'El paciente no existe o está inactivo' } }, 400)
  }

  const medico = await c.env.DB.prepare(
    `SELECT m.id, m.nombre, m.activo, e.activo AS esp_activa, e.nombre AS especialidad
     FROM medicos m JOIN especialidades e ON e.id = m.especialidad_id WHERE m.id = ?`,
  )
    .bind(medicoId)
    .first<{ id: number; nombre: string; activo: number; esp_activa: number; especialidad: string }>()
  if (!medico) return c.json({ error: 'Médico no encontrado' }, 404)
  if (!medico.activo || !medico.esp_activa) {
    return c.json({ error: 'Ese médico no está disponible para agendar citas' }, 400)
  }

  // Evitar que un paciente tenga dos citas solapadas el mismo día
  const solapePaciente = await c.env.DB.prepare(
    `SELECT c.id, c.hora_inicio, c.hora_fin, m.nombre AS medico_nombre FROM citas c
     JOIN medicos m ON m.id = c.medico_id
     WHERE c.paciente_id = ? AND c.fecha = ? AND c.estado IN ('pendiente','confirmada')`,
  )
    .bind(pacienteId, fecha)
    .all<{ id: number; hora_inicio: string; hora_fin: string; medico_nombre: string }>()
  const yaTieneSolape = (solapePaciente.results ?? []).some(
    (x) => x.hora_inicio < sumarMinutos(hora, 15) && x.hora_fin > hora,
  )
  if (yaTieneSolape) {
    return c.json({ error: 'Ya tienes otra cita en ese horario. Revisa "Mis citas".' }, 409)
  }

  const validacion = await validarSlot(c.env, medicoId, fecha, hora)
  if (!validacion.ok) return c.json({ error: validacion.error }, validacion.status)

  const horaFin = sumarMinutos(hora, validacion.duracion_min)
  const res = await c.env.DB.prepare(
    `INSERT INTO citas (medico_id, paciente_id, fecha, hora_inicio, hora_fin, estado, motivo, creada_por)
     VALUES (?, ?, ?, ?, ?, 'confirmada', ?, ?)`,
  )
    .bind(medicoId, pacienteId, fecha, hora, horaFin, motivo, usuario.id)
    .run()

  const citaId = Number(res.meta.last_row_id)
  const cuando = formatearCita(fecha, hora)

  await notificar(
    c.env,
    pacienteId,
    citaId,
    'confirmacion',
    'Cita confirmada',
    `Tu cita con ${medico.nombre} (${medico.especialidad}) quedó confirmada para el ${cuando}.`,
  )
  // Recordatorio simulado por "correo"
  await notificar(
    c.env,
    pacienteId,
    citaId,
    'recordatorio',
    'Recordatorio de cita',
    `Recuerda tu cita del ${cuando}. Llega 10 minutos antes con tu identificación.`,
    'correo',
  )
  if (usuario.rol !== 'paciente' && usuario.id !== pacienteId) {
    await notificar(
      c.env,
      usuario.id,
      citaId,
      'info',
      'Cita registrada',
      `Registraste una cita para ${paciente.nombre} el ${cuando}.`,
    )
  }
  await auditar(c.env, usuario.id, 'crear_cita', 'citas', citaId, { medicoId, pacienteId, fecha, hora })

  const cita = await c.env.DB.prepare(SELECT_CITA + ' WHERE c.id = ?').bind(citaId).first()
  return c.json({ cita }, 201)
})

/* ------------------------------------------------------------------ */
/* PATCH /api/citas/:id/cancelar  (RF4 - límite 24h)                   */
/* ------------------------------------------------------------------ */
citas.patch('/:id/cancelar', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const body = await c.req.json().catch(() => ({}))
  const motivo = limpiarTexto(body?.motivo, 300)

  const cita = await c.env.DB.prepare(SELECT_CITA + ' WHERE c.id = ?').bind(id).first<any>()
  if (!cita) return c.json({ error: 'Cita no encontrada' }, 404)

  const esPaciente = usuario.rol === 'paciente'
  const esDueno = cita.paciente_id === usuario.id
  const esSuMedico = usuario.rol === 'medico' && cita.medico_id === usuario.medico_id
  if (esPaciente && !esDueno) return c.json({ error: 'No autorizado' }, 403)
  if (usuario.rol === 'medico' && !esSuMedico) return c.json({ error: 'No autorizado' }, 403)

  if (cita.estado === 'cancelada') return c.json({ error: 'Esta cita ya está cancelada' }, 409)
  if (cita.estado === 'completada' || cita.estado === 'no_asistio') {
    return c.json({ error: 'No se puede cancelar una cita ya finalizada' }, 409)
  }

  // Regla de negocio: el paciente sólo puede cancelar con >24h de antelación
  if (esPaciente) {
    const permiso = permiteCambioPaciente(cita.fecha, cita.hora_inicio, tzOffset(c.env))
    if (!permiso.ok) {
      await auditar(c.env, usuario.id, 'cancelacion_rechazada_24h', 'citas', id, { horas: permiso.horas })
      return c.json({ error: permiso.mensaje, codigo: 'LIMITE_24H', horas_restantes: permiso.horas }, 409)
    }
  }

  await c.env.DB.prepare(
    `UPDATE citas SET estado = 'cancelada', cancelada_por = ?, motivo_cancelacion = ?,
       cancelada_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
  )
    .bind(usuario.id, motivo || null, id)
    .run()

  const quien = esPaciente ? 'el paciente' : usuario.rol === 'medico' ? 'el médico' : 'el consultorio'
  await notificar(
    c.env,
    cita.paciente_id,
    id,
    'cancelacion',
    'Cita cancelada',
    `Tu cita con ${cita.medico_nombre} del ${formatearCita(cita.fecha, cita.hora_inicio)} fue cancelada por ${quien}.${motivo ? ` Motivo: ${motivo}` : ''}`,
  )
  await notificar(
    c.env,
    cita.medico_id && usuario.rol !== 'medico' ? (await medicoUsuarioId(c.env, cita.medico_id)) : usuario.id,
    id,
    'info',
    'Cita cancelada',
    `La cita de ${cita.paciente_nombre} del ${formatearCita(cita.fecha, cita.hora_inicio)} fue cancelada.`,
  )
  await auditar(c.env, usuario.id, 'cancelar_cita', 'citas', id, { motivo })

  const actualizada = await c.env.DB.prepare(SELECT_CITA + ' WHERE c.id = ?').bind(id).first()
  return c.json({ ok: true, cita: actualizada })
})

/* ------------------------------------------------------------------ */
/* PATCH /api/citas/:id/reprogramar (RF4)                              */
/* ------------------------------------------------------------------ */
citas.patch('/:id/reprogramar', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const body = await c.req.json().catch(() => ({}))
  const nuevaFecha = limpiarTexto(body?.fecha, 10)
  const nuevaHora = limpiarTexto(body?.hora_inicio, 5)
  const nuevoMedicoId = parseId(body?.medico_id)
  const motivo = limpiarTexto(body?.motivo, 300)

  const errFH = validarFechaHora(nuevaFecha, nuevaHora)
  if (errFH) return c.json({ error: 'Datos inválidos', errores: { fecha: errFH } }, 400)

  const cita = await c.env.DB.prepare(SELECT_CITA + ' WHERE c.id = ?').bind(id).first<any>()
  if (!cita) return c.json({ error: 'Cita no encontrada' }, 404)

  const esPaciente = usuario.rol === 'paciente'
  const esDueno = cita.paciente_id === usuario.id
  if (esPaciente && !esDueno) return c.json({ error: 'No autorizado' }, 403)
  if (usuario.rol === 'medico') return c.json({ error: 'El médico no puede reprogramar citas; contacta a recepción' }, 403)
  if (cita.estado === 'cancelada') return c.json({ error: 'No se puede reprogramar una cita cancelada' }, 409)
  if (cita.estado === 'completada' || cita.estado === 'no_asistio') {
    return c.json({ error: 'No se puede reprogramar una cita ya finalizada' }, 409)
  }

  if (esPaciente) {
    const permiso = permiteCambioPaciente(cita.fecha, cita.hora_inicio, tzOffset(c.env))
    if (!permiso.ok) {
      await auditar(c.env, usuario.id, 'reprogramacion_rechazada_24h', 'citas', id, { horas: permiso.horas })
      return c.json({ error: permiso.mensaje, codigo: 'LIMITE_24H', horas_restantes: permiso.horas }, 409)
    }
  }

  const medicoDestino = nuevoMedicoId && nuevoMedicoId !== cita.medico_id ? nuevoMedicoId : cita.medico_id
  const medico = await c.env.DB.prepare('SELECT id, nombre FROM medicos WHERE id = ? AND activo = 1')
    .bind(medicoDestino)
    .first<{ id: number; nombre: string }>()
  if (!medico) return c.json({ error: 'El médico destino no está disponible' }, 400)

  const validacion = await validarSlot(c.env, medicoDestino, nuevaFecha, nuevaHora, id)
  if (!validacion.ok) return c.json({ error: validacion.error }, validacion.status)

  const horaFin = sumarMinutos(nuevaHora, validacion.duracion_min)
  await c.env.DB.prepare(
    `UPDATE citas SET medico_id = ?, fecha = ?, hora_inicio = ?, hora_fin = ?,
       estado = 'confirmada', updated_at = CURRENT_TIMESTAMP,
       notas = COALESCE(?, notas) WHERE id = ?`,
  )
    .bind(medicoDestino, nuevaFecha, nuevaHora, horaFin, motivo ? `Reprogramada: ${motivo}` : null, id)
    .run()

  await notificar(
    c.env,
    cita.paciente_id,
    id,
    'reprogramacion',
    'Cita reprogramada',
    `Tu cita con ${medico.nombre} cambió al ${formatearCita(nuevaFecha, nuevaHora)} (antes ${formatearCita(cita.fecha, cita.hora_inicio)}).`,
  )
  await auditar(c.env, usuario.id, 'reprogramar_cita', 'citas', id, {
    antes: { fecha: cita.fecha, hora: cita.hora_inicio, medico_id: cita.medico_id },
    despues: { fecha: nuevaFecha, hora: nuevaHora, medico_id: medicoDestino },
  })

  const actualizada = await c.env.DB.prepare(SELECT_CITA + ' WHERE c.id = ?').bind(id).first()
  return c.json({ ok: true, cita: actualizada })
})

/* ------------------------------------------------------------------ */
/* PATCH /api/citas/:id/estado  (gestión: confirmar / completar)       */
/* ------------------------------------------------------------------ */
citas.patch('/:id/estado', requerirRol(...ROLES_GESTION), async (c) => {
  const usuario = c.get('usuario')
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const body = await c.req.json().catch(() => ({}))
  const estado = limpiarTexto(body?.estado, 20)
  const notas = limpiarTexto(body?.notas, 500)
  const permitidos = ['pendiente', 'confirmada', 'completada', 'no_asistio']

  if (!permitidos.includes(estado)) {
    return c.json({ error: 'Datos inválidos', errores: { estado: `Estado no válido. Use: ${permitidos.join(', ')}` } }, 400)
  }

  const cita = await c.env.DB.prepare(SELECT_CITA + ' WHERE c.id = ?').bind(id).first<any>()
  if (!cita) return c.json({ error: 'Cita no encontrada' }, 404)
  if (cita.estado === 'cancelada') {
    return c.json({ error: 'No se puede cambiar el estado de una cita cancelada' }, 409)
  }

  await c.env.DB.prepare(
    'UPDATE citas SET estado = ?, notas = COALESCE(?, notas), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
  )
    .bind(estado, notas || null, id)
    .run()

  const mensajes: Record<string, string> = {
    confirmada: 'Tu cita fue confirmada por el consultorio.',
    completada: 'Tu cita fue marcada como completada. ¡Gracias por tu visita!',
    no_asistio: 'Registramos que no asististe a tu cita. Contacta al consultorio para reprogramar.',
    pendiente: 'Tu cita quedó pendiente de confirmación.',
  }
  await notificar(c.env, cita.paciente_id, id, 'info', 'Actualización de tu cita', mensajes[estado] ?? 'Tu cita fue actualizada.')
  await auditar(c.env, usuario.id, 'cambiar_estado_cita', 'citas', id, { estado })

  const actualizada = await c.env.DB.prepare(SELECT_CITA + ' WHERE c.id = ?').bind(id).first()
  return c.json({ ok: true, cita: actualizada })
})

/* ------------------------------------------------------------------ */
/* GET /api/citas/historial/:pacienteId (RF8)                          */
/* ------------------------------------------------------------------ */
citas.get('/historial/:pacienteId', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const pacienteId = parseId(c.req.param('pacienteId'))
  if (!pacienteId) return c.json({ error: 'Identificador inválido' }, 400)

  if (usuario.rol === 'paciente' && usuario.id !== pacienteId) {
    return c.json({ error: 'No autorizado' }, 403)
  }

  const hoy = fechaLocal(Date.now(), tzOffset(c.env))
  const paciente = await c.env.DB.prepare('SELECT id, nombre, email, telefono, documento FROM usuarios WHERE id = ?')
    .bind(pacienteId)
    .first()
  if (!paciente) return c.json({ error: 'Paciente no encontrado' }, 404)

  const res = await c.env.DB.prepare(
    SELECT_CITA + ' WHERE c.paciente_id = ? ORDER BY c.fecha DESC, c.hora_inicio DESC',
  )
    .bind(pacienteId)
    .all<any>()

  const todas = res.results ?? []
  const filtro =
    usuario.rol === 'medico'
      ? todas.filter((x) => x.medico_id === usuario.medico_id)
      : todas

  const esFutura = (x: any) => x.fecha >= hoy && ['pendiente', 'confirmada'].includes(x.estado)
  return c.json({
    paciente,
    limite_cancelacion_horas: HORAS_LIMITE_PACIENTE,
    futuras: filtro.filter(esFutura),
    pasadas: filtro.filter((x) => !esFutura(x)),
    estadisticas: {
      total: filtro.length,
      completadas: filtro.filter((x) => x.estado === 'completada').length,
      canceladas: filtro.filter((x) => x.estado === 'cancelada').length,
      no_asistio: filtro.filter((x) => x.estado === 'no_asistio').length,
    },
  })
})

async function medicoUsuarioId(env: AppEnv['Bindings'], medicoId: number): Promise<number> {
  const fila = await env.DB.prepare("SELECT id FROM usuarios WHERE medico_id = ? AND rol = 'medico'")
    .bind(medicoId)
    .first<{ id: number }>()
  return fila?.id ?? 0
}

export default citas