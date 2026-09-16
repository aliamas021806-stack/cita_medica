import type { AppEnv } from '../types'

/** Registra una acción en la tabla de auditoría (nunca interrumpe el flujo). */
export async function auditar(
  env: AppEnv['Bindings'],
  usuarioId: number | null,
  accion: string,
  entidad?: string,
  entidadId?: number | null,
  detalle?: unknown,
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(
        usuarioId,
        accion,
        entidad ?? null,
        entidadId ?? null,
        detalle === undefined ? null : JSON.stringify(detalle),
      )
      .run()
  } catch (err) {
    console.error('auditar():', err)
  }
}

/** Crea una notificación para un usuario (pantalla o "correo" simulado). */
export async function notificar(
  env: AppEnv['Bindings'],
  usuarioId: number,
  citaId: number | null,
  tipo: 'info' | 'confirmacion' | 'cancelacion' | 'reprogramacion' | 'recordatorio',
  asunto: string,
  mensaje: string,
  canal: 'pantalla' | 'correo' = 'pantalla',
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO notificaciones (usuario_id, cita_id, tipo, canal, asunto, mensaje)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(usuarioId, citaId, tipo, canal, asunto, mensaje)
      .run()
  } catch (err) {
    console.error('notificar():', err)
  }
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/** Formatea 'YYYY-MM-DD' + 'HH:MM' como texto legible en español. */
export function formatearCita(fecha: string, hora: string): string {
  const [y, m, d] = fecha.split('-').map(Number)
  return `${d} de ${MESES[m - 1]} de ${y} a las ${hora} hrs`
}

export async function obtenerEmails(
  env: AppEnv['Bindings'],
  ids: number[],
): Promise<{ id: number; email: string; nombre: string }[]> {
  if (!ids.length) return []
  const placeholders = ids.map(() => '?').join(',')
  const res = await env.DB.prepare(
    `SELECT id, email, nombre FROM usuarios WHERE id IN (${placeholders})`,
  )
    .bind(...ids)
    .all<{ id: number; email: string; nombre: string }>()
  return res.results ?? []
}