export type Bindings = {
  DB: D1Database
  JWT_SECRET?: string
  /** Offset en minutos respecto a UTC de la hora local del consultorio (por defecto UTC-5) */
  TZ_OFFSET_MIN?: string
}

export type Rol = 'paciente' | 'recepcionista' | 'admin' | 'medico'

export type SesionUsuario = {
  id: number
  email: string
  nombre: string
  rol: Rol
  medico_id: number | null
}

export type Variables = {
  usuario: SesionUsuario
}

export type AppEnv = { Bindings: Bindings; Variables: Variables }