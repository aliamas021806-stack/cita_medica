import { Hono } from 'hono'
import { hashPassword, verifyPassword, crearSesion, cerrarSesion, requerirSesion } from '../lib/auth'
import { validarRegistro, limpiarTexto, RE_EMAIL } from '../lib/validation'
import { auditar, notificar } from '../lib/db'
import type { AppEnv, SesionUsuario } from '../types'

const auth = new Hono<AppEnv>()

/* ------------------------------------------------------------------ */
/* POST /api/auth/registro  -> registro de paciente                    */
/* ------------------------------------------------------------------ */
auth.post('/registro', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const errores = validarRegistro(body)
  if (Object.keys(errores).length) {
    return c.json({ error: 'Datos inválidos', errores }, 400)
  }

  const email = String(body.email).trim().toLowerCase()
  const nombre = limpiarTexto(body.nombre, 80)
  const telefono = limpiarTexto(body.telefono, 20) || null

  const existe = await c.env.DB.prepare('SELECT id FROM usuarios WHERE email = ?')
    .bind(email)
    .first<{ id: number }>()
  if (existe) {
    return c.json({ error: 'Datos inválidos', errores: { email: 'Este correo ya está registrado' } }, 409)
  }

  const hash = await hashPassword(String(body.password))
  const res = await c.env.DB.prepare(
    `INSERT INTO usuarios (email, password_hash, nombre, telefono, rol)
     VALUES (?, ?, ?, ?, 'paciente')`,
  )
    .bind(email, hash, nombre, telefono)
    .run()

  const id = Number(res.meta.last_row_id)
  const usuario: SesionUsuario = { id, email, nombre, rol: 'paciente', medico_id: null }

  await notificar(
    c.env,
    id,
    null,
    'info',
    '¡Bienvenido al consultorio!',
    `Hola ${nombre}, tu cuenta fue creada correctamente. Ya puedes buscar disponibilidad y reservar tu primera cita.`,
  )
  await auditar(c.env, id, 'registro', 'usuarios', id, { email })
  await crearSesion(c, usuario)

  return c.json({ usuario }, 201)
})

/* ------------------------------------------------------------------ */
/* POST /api/auth/login                                                */
/* ------------------------------------------------------------------ */
auth.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const email = String(body?.email ?? '').trim().toLowerCase()
  const password = String(body?.password ?? '')

  const errores: Record<string, string> = {}
  if (!email) errores.email = 'El correo es obligatorio'
  else if (!RE_EMAIL.test(email)) errores.email = 'El correo no tiene un formato válido'
  if (!password) errores.password = 'La contraseña es obligatoria'
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  const fila = await c.env.DB.prepare(
    `SELECT id, email, nombre, password_hash, rol, medico_id, activo
     FROM usuarios WHERE email = ?`,
  )
    .bind(email)
    .first<{
      id: number
      email: string
      nombre: string
      password_hash: string
      rol: SesionUsuario['rol']
      medico_id: number | null
      activo: number
    }>()

  const credencialesInvalidas = () =>
    c.json({ error: 'Correo o contraseña incorrectos' }, 401)

  if (!fila) return credencialesInvalidas()
  if (!fila.activo) return c.json({ error: 'Tu cuenta está desactivada. Contacta al consultorio.' }, 403)

  const ok = await verifyPassword(password, fila.password_hash)
  if (!ok) return credencialesInvalidas()

  const usuario: SesionUsuario = {
    id: fila.id,
    email: fila.email,
    nombre: fila.nombre,
    rol: fila.rol,
    medico_id: fila.medico_id,
  }
  await crearSesion(c, usuario)
  await auditar(c.env, fila.id, 'login', 'usuarios', fila.id, { rol: fila.rol })

  return c.json({ usuario })
})

/* ------------------------------------------------------------------ */
/* POST /api/auth/logout                                               */
/* ------------------------------------------------------------------ */
auth.post('/logout', (c) => {
  cerrarSesion(c)
  return c.json({ ok: true })
})

/* ------------------------------------------------------------------ */
/* GET /api/auth/me                                                    */
/* ------------------------------------------------------------------ */
auth.get('/me', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const fila = await c.env.DB.prepare(
    `SELECT id, email, nombre, telefono, documento, rol, medico_id, created_at
     FROM usuarios WHERE id = ?`,
  )
    .bind(usuario.id)
    .first()

  const sinLeer = await c.env.DB.prepare(
    'SELECT COUNT(*) AS total FROM notificaciones WHERE usuario_id = ? AND leida = 0',
  )
    .bind(usuario.id)
    .first<{ total: number }>()

  return c.json({ usuario: fila, notificaciones_sin_leer: sinLeer?.total ?? 0 })
})

/* ------------------------------------------------------------------ */
/* PUT /api/auth/perfil  -> actualizar datos propios                   */
/* ------------------------------------------------------------------ */
auth.put('/perfil', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const body = await c.req.json().catch(() => ({}))
  const errores: Record<string, string> = {}

  const nombre = limpiarTexto(body?.nombre, 80)
  const telefono = limpiarTexto(body?.telefono, 20)
  const documento = limpiarTexto(body?.documento, 40)

  if (!nombre) errores.nombre = 'El nombre es obligatorio'
  else if (nombre.length < 3) errores.nombre = 'El nombre debe tener al menos 3 caracteres'
  if (telefono && !/^[0-9+()\-\s]{7,20}$/.test(telefono)) errores.telefono = 'El teléfono no es válido'
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  await c.env.DB.prepare(
    'UPDATE usuarios SET nombre = ?, telefono = ?, documento = ? WHERE id = ?',
  )
    .bind(nombre, telefono || null, documento || null, usuario.id)
    .run()

  await auditar(c.env, usuario.id, 'actualizar_perfil', 'usuarios', usuario.id)
  return c.json({ ok: true, usuario: { ...usuario, nombre } })
})

/* ------------------------------------------------------------------ */
/* PUT /api/auth/password                                              */
/* ------------------------------------------------------------------ */
auth.put('/password', requerirSesion, async (c) => {
  const usuario = c.get('usuario')
  const body = await c.req.json().catch(() => ({}))
  const actual = String(body?.password_actual ?? '')
  const nueva = String(body?.password_nueva ?? '')

  const errores: Record<string, string> = {}
  if (!actual) errores.password_actual = 'Debes indicar tu contraseña actual'
  if (!nueva) errores.password_nueva = 'La nueva contraseña es obligatoria'
  else if (nueva.length < 8) errores.password_nueva = 'La nueva contraseña debe tener al menos 8 caracteres'
  else if (!/[A-Za-z]/.test(nueva) || !/\d/.test(nueva))
    errores.password_nueva = 'La contraseña debe incluir letras y números'
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  const fila = await c.env.DB.prepare('SELECT password_hash FROM usuarios WHERE id = ?')
    .bind(usuario.id)
    .first<{ password_hash: string }>()
  if (!fila || !(await verifyPassword(actual, fila.password_hash))) {
    return c.json({ error: 'Datos inválidos', errores: { password_actual: 'La contraseña actual no es correcta' } }, 400)
  }

  await c.env.DB.prepare('UPDATE usuarios SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(nueva), usuario.id)
    .run()
  await auditar(c.env, usuario.id, 'cambio_password', 'usuarios', usuario.id)

  return c.json({ ok: true })
})

export default auth