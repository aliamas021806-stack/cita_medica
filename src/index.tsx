import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { cargarSesion } from './lib/auth'
import type { AppEnv } from './types'

import authRoutes from './routes/auth'
import especialidadesRoutes from './routes/especialidades'
import medicosRoutes from './routes/medicos'
import horariosRoutes from './routes/horarios'
import disponibilidadRoutes from './routes/disponibilidad'
import citasRoutes from './routes/citas'
import notificacionesRoutes from './routes/notificaciones'
import adminRoutes from './routes/admin'
import medicoRoutes from './routes/medico'

import { paginaPaciente, paginaAdmin, paginaMedico } from './views/paginas'

const app = new Hono<AppEnv>()

app.use('*', logger())
// El frontend se sirve desde el mismo origen, por lo que no se habilita CORS.
app.use('*', secureHeaders({ xFrameOptions: 'SAMEORIGIN', xContentTypeOptions: 'nosniff' }))
app.use('*', cargarSesion)

/* ------------------------------------------------------------------ */
/* API REST                                                            */
/* ------------------------------------------------------------------ */
app.route('/api/auth', authRoutes)
app.route('/api/especialidades', especialidadesRoutes)
app.route('/api/medicos', medicosRoutes)
app.route('/api/horarios', horariosRoutes)
app.route('/api/disponibilidad', disponibilidadRoutes)
app.route('/api/citas', citasRoutes)
app.route('/api/notificaciones', notificacionesRoutes)
app.route('/api/admin', adminRoutes)
app.route('/api/medico', medicoRoutes)

app.get('/api/health', (c) =>
  c.json({ ok: true, servicio: 'reserva-citas-consultorio', hora_utc: new Date().toISOString() }),
)

app.all('/api/*', (c) => c.json({ error: 'Ruta de API no encontrada' }, 404))

/* ------------------------------------------------------------------ */
/* Vistas (la sesión se inyecta en el HTML y el cliente la hidrata)     */
/* ------------------------------------------------------------------ */
app.get('/', (c) => c.html(paginaPaciente(c.get('usuario'))))
app.get('/admin', (c) => c.html(paginaAdmin(c.get('usuario'))))
app.get('/medico', (c) => c.html(paginaMedico(c.get('usuario'))))

// Cualquier otra ruta devuelve la vista pública del paciente
app.notFound((c) => c.html(paginaPaciente(c.get('usuario')), 200))

app.onError((err, c) => {
  console.error('Error no controlado:', err)
  if (c.req.path.startsWith('/api/')) {
    return c.json({ error: 'Error interno del servidor' }, 500)
  }
  return c.html(
    '<h1>Error interno</h1><p>Ocurrió un problema al procesar la solicitud.</p><a href="/">Volver al inicio</a>',
    500,
  )
})

export default app