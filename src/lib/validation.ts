/** Validaciones reutilizables (frontend y backend aplican las mismas reglas). */

export const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/
export const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/
export const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/
export const RE_TELEFONO = /^[0-9+()\-\s]{7,20}$/

export type Errores = Record<string, string>

export function validarRegistro(body: any): Errores {
  const e: Errores = {}
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')
  const nombre = String(body?.nombre ?? '').trim()
  const telefono = String(body?.telefono ?? '').trim()

  if (!nombre) e.nombre = 'El nombre es obligatorio'
  else if (nombre.length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres'
  else if (nombre.length > 80) e.nombre = 'El nombre es demasiado largo'

  if (!email) e.email = 'El correo es obligatorio'
  else if (!RE_EMAIL.test(email)) e.email = 'El correo no tiene un formato válido'

  if (!password) e.password = 'La contraseña es obligatoria'
  else if (password.length < 8) e.password = 'La contraseña debe tener al menos 8 caracteres'
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    e.password = 'La contraseña debe incluir letras y números'

  if (telefono && !RE_TELEFONO.test(telefono)) e.telefono = 'El teléfono no es válido'
  return e
}

export function validarFechaHora(fecha: string, hora: string): string | null {
  if (!RE_FECHA.test(fecha)) return 'La fecha debe tener el formato AAAA-MM-DD'
  const d = new Date(`${fecha}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return 'La fecha no es válida'
  if (!RE_HORA.test(hora)) return 'La hora debe tener el formato HH:MM'
  return null
}

export function validarHorario(horaInicio: string, horaFin: string, duracion: number): string | null {
  if (!RE_HORA.test(horaInicio)) return 'La hora de inicio no es válida'
  if (!RE_HORA.test(horaFin)) return 'La hora de fin no es válida'
  if (horaFin <= horaInicio) return 'La hora de fin debe ser posterior a la de inicio'
  if (!Number.isFinite(duracion) || duracion < 5 || duracion > 240)
    return 'La duración debe estar entre 5 y 240 minutos'
  return null
}

export function limpiarTexto(valor: unknown, max = 500): string {
  return String(valor ?? '').trim().slice(0, max)
}

export function parseId(valor: unknown): number | null {
  const n = Number(valor)
  return Number.isInteger(n) && n > 0 ? n : null
}