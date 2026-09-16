import { Hono } from 'hono'
import { requerirRol, ROLES_GESTION } from '../lib/auth'
import { limpiarTexto, parseId } from '../lib/validation'
import { auditar } from '../lib/db'
import type { AppEnv } from '../types'

const especialidades = new Hono<AppEnv>()

/* ------------------------------------------------------------------ */
/* GET /api/especialidades                                             */
/* ------------------------------------------------------------------ */
especialidades.get('/', async (c) => {
  const incluirInactivas = c.req.query('incluir_inactivas') === '1'
  const res = await c.env.DB.prepare(
    `SELECT e.*, (SELECT COUNT(*) FROM medicos m WHERE m.especialidad_id = e.id AND m.activo = 1) AS total_medicos
     FROM especialidades e
     ${incluirInactivas ? '' : 'WHERE e.activo = 1'}
     ORDER BY e.nombre`,
  ).all()
  return c.json({ especialidades: res.results ?? [] })
})

/* ------------------------------------------------------------------ */
/* POST /api/especialidades (gestión)                                  */
/* ------------------------------------------------------------------ */
especialidades.post('/', requerirRol(...ROLES_GESTION), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const nombre = limpiarTexto(body?.nombre, 80)
  const descripcion = limpiarTexto(body?.descripcion, 300)
  const errores: Record<string, string> = {}

  if (!nombre || nombre.length < 3) errores.nombre = 'El nombre es obligatorio (mín. 3 caracteres)'
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  const dup = await c.env.DB.prepare('SELECT id FROM especialidades WHERE LOWER(nombre) = LOWER(?)')
    .bind(nombre)
    .first()
  if (dup) return c.json({ error: 'Datos inválidos', errores: { nombre: 'Esa especialidad ya existe' } }, 409)

  const res = await c.env.DB.prepare('INSERT INTO especialidades (nombre, descripcion) VALUES (?, ?)')
    .bind(nombre, descripcion || null)
    .run()
  const id = Number(res.meta.last_row_id)
  await auditar(c.env, c.get('usuario').id, 'crear_especialidad', 'especialidades', id, { nombre })

  const esp = await c.env.DB.prepare('SELECT * FROM especialidades WHERE id = ?').bind(id).first()
  return c.json({ especialidad: esp }, 201)
})

/* ------------------------------------------------------------------ */
/* PUT /api/especialidades/:id                                         */
/* ------------------------------------------------------------------ */
especialidades.put('/:id', requerirRol(...ROLES_GESTION), async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const body = await c.req.json().catch(() => ({}))
  const nombre = limpiarTexto(body?.nombre, 80)
  const descripcion = limpiarTexto(body?.descripcion, 300)
  const activo = body?.activo === undefined ? 1 : body.activo ? 1 : 0
  const errores: Record<string, string> = {}

  if (!nombre || nombre.length < 3) errores.nombre = 'El nombre es obligatorio (mín. 3 caracteres)'
  if (Object.keys(errores).length) return c.json({ error: 'Datos inválidos', errores }, 400)

  const existe = await c.env.DB.prepare('SELECT id FROM especialidades WHERE id = ?').bind(id).first()
  if (!existe) return c.json({ error: 'Especialidad no encontrada' }, 404)

  await c.env.DB.prepare('UPDATE especialidades SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?')
    .bind(nombre, descripcion || null, activo, id)
    .run()
  await auditar(c.env, c.get('usuario').id, 'actualizar_especialidad', 'especialidades', id)

  const esp = await c.env.DB.prepare('SELECT * FROM especialidades WHERE id = ?').bind(id).first()
  return c.json({ especialidad: esp })
})

/* ------------------------------------------------------------------ */
/* DELETE /api/especialidades/:id -> baja lógica                       */
/* ------------------------------------------------------------------ */
especialidades.delete('/:id', requerirRol(...ROLES_GESTION), async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return c.json({ error: 'Identificador inválido' }, 400)

  const enUso = await c.env.DB.prepare('SELECT COUNT(*) AS total FROM medicos WHERE especialidad_id = ? AND activo = 1')
    .bind(id)
    .first<{ total: number }>()
  if ((enUso?.total ?? 0) > 0) {
    return c.json({ error: `No se puede desactivar: hay ${enUso?.total} médico(s) activo(s) en esta especialidad.` }, 409)
  }

  await c.env.DB.prepare('UPDATE especialidades SET activo = 0 WHERE id = ?').bind(id).run()
  await auditar(c.env, c.get('usuario').id, 'baja_especialidad', 'especialidades', id)
  return c.json({ ok: true })
})

export default especialidades