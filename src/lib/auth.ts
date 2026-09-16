import { sign, verify } from 'hono/jwt'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import type { AppEnv, Bindings, Rol, SesionUsuario } from '../types'

const COOKIE_NAME = 'citas_token'
const ITERACIONES = 100_000
const DIAS_SESION = 7

/* ------------------------------------------------------------------ */
/* Utilidades base64                                                   */
/* ------------------------------------------------------------------ */
function aBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

function deBase64(str: string): Uint8Array {
  return Uint8Array.from(atob(str), (ch) => ch.charCodeAt(0))
}

/* ------------------------------------------------------------------ */
/* Hash de contraseñas: PBKDF2-SHA256 (WebCrypto, disponible en Workers)*/
/* Formato almacenado: pbkdf2$iteraciones$saltB64$hashB64              */
/* ------------------------------------------------------------------ */
export async function hashPassword(password: string, saltB64?: string): Promise<string> {
  const salt = saltB64 ? deBase64(saltB64) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERACIONES, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2$${ITERACIONES}$${aBase64(salt)}$${aBase64(bits)}`
}

export async function verifyPassword(password: string, almacenado: string): Promise<boolean> {
  try {
    const [algoritmo, iteraciones, saltB64, hashB64] = almacenado.split('$')
    if (algoritmo !== 'pbkdf2' || !saltB64 || !hashB64) return false
    const salt = deBase64(saltB64)
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: Number(iteraciones), hash: 'SHA-256' },
      key,
      256,
    )
    const calculado = aBase64(bits)
    // comparación en tiempo constante
    if (calculado.length !== hashB64.length) return false
    let diff = 0
    for (let i = 0; i < calculado.length; i++) diff |= calculado.charCodeAt(i) ^ hashB64.charCodeAt(i)
    return diff === 0
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* JWT en cookie httpOnly                                              */
/* ------------------------------------------------------------------ */

/** Secreto de conveniencia SOLO para el sandbox local (http://localhost). */
const SECRETO_DEV = 'dev-secret-solo-para-desarrollo-local'

/** ¿La petición llega por http (desarrollo local) o https (producción)? */
function esLocal(url: string): boolean {
  try {
    return new URL(url).protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Resuelve el secreto de firma de los JWT.
 *
 * En producción (`https`) `JWT_SECRET` es OBLIGATORIO: si falta se devuelve
 * `null` y las sesiones quedan deshabilitadas (fallo en cerrado). Nunca se usa
 * un secreto por defecto en producción, porque el bundle es público y un
 * secreto conocido permitiría falsificar tokens y suplantar a cualquier usuario.
 */
export function secreto(env: Bindings, url: string): string | null {
  if (env.JWT_SECRET) return env.JWT_SECRET
  if (esLocal(url)) return SECRETO_DEV
  console.error(
    '[auth] JWT_SECRET no configurado en producción: las sesiones están deshabilitadas. ' +
      'Defínelo con: wrangler pages secret put JWT_SECRET --project-name <proyecto>',
  )
  return null
}

/** Verifica un token y devuelve el usuario, o `null` si no es válido. */
export async function usuarioDesdeToken(
  env: Bindings,
  token: string,
  url: string,
): Promise<SesionUsuario | null> {
  const clave = secreto(env, url)
  if (!clave) return null
  try {
    const payload = await verify(token, clave, 'HS256')
    return {
      id: Number(payload.sub),
      email: String(payload.email),
      nombre: String(payload.nombre),
      rol: payload.rol as Rol,
      medico_id: payload.medico_id == null ? null : Number(payload.medico_id),
    }
  } catch {
    return null
  }
}

export async function crearSesion(
  c: any,
  usuario: SesionUsuario,
): Promise<void> {
  const clave = secreto(c.env, c.req.url)
  if (!clave) {
    throw new Error(
      'JWT_SECRET no configurado: no es posible crear sesiones en producción sin él.',
    )
  }

  const exp = Math.floor(Date.now() / 1000) + DIAS_SESION * 86400
  const token = await sign(
    {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      medico_id: usuario.medico_id,
      exp,
    },
    clave,
    'HS256',
  )
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: !esLocal(c.req.url),
    path: '/',
    maxAge: DIAS_SESION * 86400,
  })
}

export function cerrarSesion(c: any): void {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

async function leerSesion(c: any): Promise<SesionUsuario | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  return usuarioDesdeToken(c.env, token, c.req.url)
}

/** Adjunta el usuario a la petición si hay sesión válida; NO bloquea. */
export const cargarSesion = createMiddleware<AppEnv>(async (c, next) => {
  const usuario = await leerSesion(c)
  if (usuario) c.set('usuario', usuario)
  await next()
})

/** Bloquea si no hay sesión válida. */
export const requerirSesion = createMiddleware<AppEnv>(async (c, next) => {
  const usuario = (c.get('usuario') as SesionUsuario | undefined) ?? (await leerSesion(c))
  if (!usuario) return c.json({ error: 'No autenticado' }, 401)
  c.set('usuario', usuario)
  await next()
})

/** Bloquea si el rol no está autorizado. */
export function requerirRol(...roles: Rol[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const usuario = (c.get('usuario') as SesionUsuario | undefined) ?? (await leerSesion(c))
    if (!usuario) return c.json({ error: 'No autenticado' }, 401)
    if (!roles.includes(usuario.rol)) {
      return c.json({ error: 'No autorizado para esta operación' }, 403)
    }
    c.set('usuario', usuario)
    await next()
  })
}

/** Roles de gestión (recepcionista y admin). */
export const ROLES_GESTION: Rol[] = ['recepcionista', 'admin']

export function esGestion(usuario?: SesionUsuario | null): boolean {
  return !!usuario && ROLES_GESTION.includes(usuario.rol)
}