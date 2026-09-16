/* ------------------------------------------------------------------ */
/* Motor de disponibilidad                                             */
/* Las fechas/horas se guardan como texto 'YYYY-MM-DD' / 'HH:MM' en la  */
/* hora local del consultorio (TZ_OFFSET_MIN, por defecto UTC-5).      */
/* ------------------------------------------------------------------ */

export const TZ_DEFECTO = -300 // UTC-5

export type Horario = {
  id: number
  medico_id: number
  dia_semana: number
  hora_inicio: string
  hora_fin: string
  duracion_min: number
  activo: number
}

export type Slot = {
  hora_inicio: string
  hora_fin: string
  disponible: boolean
  motivo?: string
  cita_id?: number
}

export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function aHHMM(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Día de la semana (0=domingo) de una fecha 'YYYY-MM-DD'. */
export function diaSemana(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay()
}

/** Milisegundos UTC de una fecha+hora local del consultorio. */
export function aMillisLocal(fecha: string, hora: string, tzOffsetMin: number = TZ_DEFECTO): number {
  const [y, m, d] = fecha.split('-').map(Number)
  const [hh, mm] = hora.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) - tzOffsetMin * 60_000
}

/** Fecha local 'YYYY-MM-DD' de un instante dado. */
export function fechaLocal(ms: number = Date.now(), tzOffsetMin: number = TZ_DEFECTO): string {
  const d = new Date(ms - tzOffsetMin * 60_000)
  return d.toISOString().slice(0, 10)
}

/** Hora local 'HH:MM' de un instante dado. */
export function horaLocal(ms: number = Date.now(), tzOffsetMin: number = TZ_DEFECTO): string {
  const d = new Date(ms - tzOffsetMin * 60_000)
  return d.toISOString().slice(11, 16)
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export function diasEntre(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime()
  const db = new Date(`${b}T00:00:00Z`).getTime()
  return Math.round((db - da) / 86_400_000)
}

export type CitaOcupada = { id: number; hora_inicio: string; hora_fin: string }

/**
 * Genera la rejilla de slots de un día para un médico y marca los ocupados.
 * @param ahoraMs instante actual (Date.now())
 */
export function generarSlots(
  horarios: Horario[],
  ocupadas: CitaOcupada[],
  fecha: string,
  ahoraMs: number = Date.now(),
  tzOffsetMin: number = TZ_DEFECTO,
): Slot[] {
  const dow = diaSemana(fecha)
  const delDia = horarios.filter((h) => h.activo && h.dia_semana === dow)
  const slots: Slot[] = []

  for (const h of delDia) {
    const inicio = aMinutos(h.hora_inicio)
    const fin = aMinutos(h.hora_fin)
    const paso = h.duracion_min > 0 ? h.duracion_min : 30
    for (let t = inicio; t + paso <= fin; t += paso) {
      const sIni = aHHMM(t)
      const sFin = aHHMM(t + paso)
      const slotMs = aMillisLocal(fecha, sIni, tzOffsetMin)
      const choque = ocupadas.find(
        (o) => aMinutos(o.hora_inicio) < aMinutos(sFin) && aMinutos(o.hora_fin) > aMinutos(sIni),
      )
      if (choque) {
        slots.push({ hora_inicio: sIni, hora_fin: sFin, disponible: false, motivo: 'ocupado', cita_id: choque.id })
      } else if (slotMs <= ahoraMs) {
        slots.push({ hora_inicio: sIni, hora_fin: sFin, disponible: false, motivo: 'pasado' })
      } else {
        slots.push({ hora_inicio: sIni, hora_fin: sFin, disponible: true })
      }
    }
  }

  slots.sort((a, b) => aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio))
  return slots
}

/** Duración del slot que contiene una hora concreta, según los horarios del médico. */
export function duracionDelSlot(horarios: Horario[], fecha: string, hora: string): number | null {
  const dow = diaSemana(fecha)
  const min = aMinutos(hora)
  for (const h of horarios.filter((x) => x.activo && x.dia_semana === dow)) {
    const ini = aMinutos(h.hora_inicio)
    const fin = aMinutos(h.hora_fin)
    const paso = h.duracion_min > 0 ? h.duracion_min : 30
    if (min >= ini && min + paso <= fin && (min - ini) % paso === 0) return paso
  }
  return null
}