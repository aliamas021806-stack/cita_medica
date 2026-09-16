import { Hono } from 'hono'
import { requerirRol, ROLES_GESTION } from '../lib/auth'
import { limpiarTexto } from '../lib/validation'
import { fechaLocal } from '../lib/slots'
import { tzOffset } from '../lib/citas'
import type { AppEnv } from '../types'

const admin = new Hono<AppEnv>()

/* ------------------------------------------------------------------ */
/* GET /api/admin/dashboard  -> métricas del consultorio               */
/* ------------------------------------------------------------------ */
admin.get('/dashboard', requerirRol(...ROLES_GESTION), async (c) => {
  const hoy = fechaLocal(Date.now(), tzOffset(c.env))

  const [hoyRes, estadosRes, medicosRes, pacientesRes, semanaRes, proximasRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN estado IN ('pendiente','confirmada') THEN 1 ELSE 0 END) AS activas,
              SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
              SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) AS completadas
       FROM citas WHERE fecha = ?`,
    ).bind(hoy).first<{ total: number; activas: number; canceladas: number; completadas: number }>(),

    c.env.DB.prepare(
      `SELECT estado, COUNT(*) AS total FROM citas
       WHERE fecha >= date(?, '-30 day') GROUP BY estado`,
    ).bind(hoy).all<{ estado: string; total: number }>(),

    c.env.DB.prepare('SELECT COUNT(*) AS total FROM medicos WHERE activo = 1').first<{ total: number }>(),

    c.env.DB.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'paciente' AND activo = 1").first<{ total: number }>(),

    c.env.DB.prepare(
      `SELECT fecha, COUNT(*) AS total FROM citas
       WHERE fecha BETWEEN ? AND date(?, '+6 day') AND estado IN ('pendiente','confirmada')
       GROUP BY fecha ORDER BY fecha`,
    ).bind(hoy, hoy).all<{ fecha: string; total: number }>(),

    c.env.DB.prepare(
      `SELECT c.id, c.fecha, c.hora_inicio, c.estado, c.motivo,
              u.nombre AS paciente_nombre, m.nombre AS medico_nombre, e.nombre AS especialidad
       FROM citas c
       JOIN usuarios u ON u.id = c.paciente_id
       JOIN medicos m ON m.id = c.medico_id
       JOIN especialidades e ON e.id = m.especialidad_id
       WHERE c.fecha >= ? AND c.estado IN ('pendiente','confirmada')
       ORDER BY c.fecha, c.hora_inicio LIMIT 15`,
    ).bind(hoy).all(),
  ])

  const porEstado: Record<string, number> = {}
  for (const fila of estadosRes.results ?? []) porEstado[fila.estado] = fila.total

  return c.json({
    hoy: {
      fecha: hoy,
      total_citas: hoyRes?.total ?? 0,
      activas: hoyRes?.activas ?? 0,
      canceladas: hoyRes?.canceladas ?? 0,
      completadas: hoyRes?.completadas ?? 0,
    },
    por_estado_30dias: porEstado,
    total_medicos_activos: medicosRes?.total ?? 0,
    total_pacientes: pacientesRes?.total ?? 0,
    agenda_semana: semanaRes.results ?? [],
    proximas_citas: proximasRes.results ?? [],
  })
})

/* ------------------------------------------------------------------ */
/* GET /api/admin/auditoria                                            */
/* ------------------------------------------------------------------ */
admin.get('/auditoria', requerirRol(...ROLES_GESTION), async (c) => {
  const limite = Math.min(Number(c.req.query('limite') ?? 100) || 100, 500)
  const accion = limpiarTexto(c.req.query('accion'), 40)

  const res = await c.env.DB.prepare(
    `SELECT a.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol
     FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
     ${accion ? 'WHERE a.accion = ?' : ''}
     ORDER BY a.created_at DESC, a.id DESC LIMIT ?`,
  )
    .bind(...(accion ? [accion, limite] : [limite]))
    .all()

  return c.json({ auditoria: res.results ?? [] })
})

/* ------------------------------------------------------------------ */
/* GET /api/admin/usuarios -> listado de pacientes y personal          */
/* ------------------------------------------------------------------ */
admin.get('/usuarios', requerirRol(...ROLES_GESTION), async (c) => {
  const rol = limpiarTexto(c.req.query('rol'), 20)
  const q = limpiarTexto(c.req.query('q'), 80)

  let sql = `SELECT u.id, u.email, u.nombre, u.telefono, u.documento, u.rol, u.activo,
                    u.created_at, m.nombre AS medico_nombre,
                    (SELECT COUNT(*) FROM citas c WHERE c.paciente_id = u.id) AS total_citas
             FROM usuarios u LEFT JOIN medicos m ON m.id = u.medico_id WHERE 1=1`
  const params: unknown[] = []
  if (rol) {
    sql += ' AND u.rol = ?'
    params.push(rol)
  }
  if (q) {
    sql += ' AND (u.nombre LIKE ? OR u.email LIKE ? OR u.documento LIKE ?)'
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  sql += ' ORDER BY u.rol, u.nombre LIMIT 300'

  const res = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json({ usuarios: res.results ?? [] })
})

/* ------------------------------------------------------------------ */
/* PATCH /api/admin/usuarios/:id/estado -> activar / desactivar        */
/* ------------------------------------------------------------------ */
admin.patch('/usuarios/:id/estado', requerirRol(...ROLES_GESTION), async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return c.json({ error: 'Identificador inválido' }, 400)
  if (id === c.get('usuario').id) return c.json({ error: 'No puedes desactivar tu propia cuenta' }, 400)

  const body = await c.req.json().catch(() => ({}))
  const activo = body?.activo ? 1 : 0

  const objetivo = await c.env.DB.prepare('SELECT id, rol FROM usuarios WHERE id = ?')
    .bind(id)
    .first<{ id: number; rol: string }>()
  if (!objetivo) return c.json({ error: 'Usuario no encontrado' }, 404)

  await c.env.DB.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').bind(activo, id).run()
  return c.json({ ok: true, activo })
})

export default admin