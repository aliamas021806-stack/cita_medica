import type { AppEnv, Bindings } from '../types'
import { aMillisLocal, TZ_DEFECTO, duracionDelSlot, type Horario } from './slots'

/** Offset horario del consultorio (minutos respecto a UTC). */
export function tzOffset(env: Bindings): number {
  const n = Number(env.TZ_OFFSET_MIN)
  return Number.isFinite(n) ? n : TZ_DEFECTO
}

export async function horariosDeMedico(env: Bindings, medicoId: number): Promise<Horario[]> {
  const res = await env.DB.prepare(
    'SELECT * FROM horarios WHERE medico_id = ? ORDER BY dia_semana, hora_inicio',
  )
    .bind(medicoId)
    .all<Horario>()
  return res.results ?? []
}

export async function citasOcupadas(
  env: Bindings,
  medicoId: number,
  fecha: string,
  excluirCitaId?: number,
): Promise<{ id: number; hora_inicio: string; hora_fin: string }[]> {
  const sql = `SELECT id, hora_inicio, hora_fin FROM citas
               WHERE medico_id = ? AND fecha = ? AND estado IN ('pendiente','confirmada')
               ${excluirCitaId ? 'AND id != ?' : ''}`
  const stmt = excluirCitaId
    ? env.DB.prepare(sql).bind(medicoId, fecha, excluirCitaId)
    : env.DB.prepare(sql).bind(medicoId, fecha)
  const res = await stmt.all<{ id: number; hora_inicio: string; hora_fin: string }>()
  return res.results ?? []
}

export type ValidacionSlot =
  | { ok: true; duracion_min: number }
  | { ok: false; error: string; status: number }

/**
 * Valida que un slot (medico, fecha, hora) exista en los horarios y esté libre.
 * Aplica la regla de que no se puede reservar en el pasado.
 */
export async function validarSlot(
  env: Bindings,
  medicoId: number,
  fecha: string,
  hora: string,
  excluirCitaId?: number,
): Promise<ValidacionSlot> {
  const horarios = await horariosDeMedico(env, medicoId)
  const duracion = duracionDelSlot(horarios, fecha, hora)
  if (!duracion) {
    return { ok: false, error: 'El médico no atiende en ese horario', status: 400 }
  }

  const ahora = Date.now()
  if (aMillisLocal(fecha, hora, tzOffset(env)) <= ahora) {
    return { ok: false, error: 'No es posible agendar citas en el pasado', status: 400 }
  }

  const ocupadas = await citasOcupadas(env, medicoId, fecha, excluirCitaId)
  const fin = sumarMinutos(hora, duracion)
  const choque = ocupadas.find(
    (o) => aMinutos(o.hora_inicio) < aMinutos(fin) && aMinutos(o.hora_fin) > aMinutos(hora),
  )
  if (choque) {
    return { ok: false, error: 'Ese horario ya fue reservado por otro paciente', status: 409 }
  }

  return { ok: true, duracion_min: duracion }
}

export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function sumarMinutos(hhmm: string, minutos: number): string {
  const total = aMinutos(hhmm) + minutos
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Horas mínimas de antelación exigidas al paciente para cancelar/reprogramar. */
export const HORAS_LIMITE_PACIENTE = 24

export function horasHasta(fecha: string, hora: string, tzOffsetMin: number): number {
  return (aMillisLocal(fecha, hora, tzOffsetMin) - Date.now()) / 3_600_000
}

export function permiteCambioPaciente(
  fecha: string,
  hora: string,
  tzOffsetMin: number,
): { ok: boolean; horas: number; mensaje?: string } {
  const horas = horasHasta(fecha, hora, tzOffsetMin)
  if (horas < HORAS_LIMITE_PACIENTE) {
    return {
      ok: false,
      horas,
      mensaje: `Solo puedes cancelar o reprogramar con más de ${HORAS_LIMITE_PACIENTE} horas de antelación. Tu cita es en ${Math.max(
        0,
        Math.round(horas * 10) / 10,
      )} horas. Contacta al consultorio si necesitas un cambio urgente.`,
    }
  }
  return { ok: true, horas }
}