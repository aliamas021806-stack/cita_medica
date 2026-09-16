import type { SesionUsuario } from '../types'

const MARCA = 'Consultorio Vida Sana'

type Opciones = {
  titulo: string
  archivoJs: string
  cuerpo: string
  sesion?: SesionUsuario | null
}

function layout({ titulo, archivoJs, cuerpo, sesion }: Opciones): string {
  const datosSesion = JSON.stringify(sesion ?? null).replace(/</g, '\\u003c')
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Sistema de reserva de citas médicas en línea" />
  <title>${titulo} · ${MARCA}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
  <link rel="stylesheet" href="/static/style.css" />
  <script>
    window.__SESION_INICIAL__ = ${datosSesion};
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            marca: { 50:'#eff6ff',100:'#dbeafe',200:'#bfdbfe',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8',800:'#1e40af',900:'#1e3a8a' }
          }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen flex flex-col">
  <a href="#contenido-principal" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:rounded focus:shadow">Saltar al contenido</a>

  <header id="cabecera-principal" class="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
      <a href="/" class="flex items-center gap-2 font-bold text-marca-700 text-lg shrink-0">
        <i class="fa-solid fa-stethoscope" aria-hidden="true"></i>
        <span class="hidden sm:inline">${MARCA}</span>
      </a>

      <nav id="navegacion-principal" class="ml-auto flex items-center gap-1 sm:gap-2 text-sm" aria-label="Navegación principal">
        <a href="/" data-nav="paciente" class="nav-link px-2.5 py-1.5 rounded-lg hover:bg-marca-50 hover:text-marca-700 font-medium">
          <i class="fa-solid fa-calendar-plus" aria-hidden="true"></i>
          <span class="hidden sm:inline ml-1">Reservar</span>
        </a>
        <a href="/admin" data-nav="admin" class="nav-link px-2.5 py-1.5 rounded-lg hover:bg-marca-50 hover:text-marca-700 font-medium">
          <i class="fa-solid fa-clipboard-list" aria-hidden="true"></i>
          <span class="hidden sm:inline ml-1">Recepción</span>
        </a>
        <a href="/medico" data-nav="medico" class="nav-link px-2.5 py-1.5 rounded-lg hover:bg-marca-50 hover:text-marca-700 font-medium">
          <i class="fa-solid fa-user-doctor" aria-hidden="true"></i>
          <span class="hidden sm:inline ml-1">Médico</span>
        </a>
        <button id="btn-notificaciones" type="button" class="relative px-2.5 py-1.5 rounded-lg hover:bg-marca-50" aria-label="Notificaciones">
          <i class="fa-regular fa-bell" aria-hidden="true"></i>
          <span id="badge-notificaciones" class="hidden absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"></span>
        </button>
        <span id="zona-sesion" class="flex items-center gap-2"></span>
      </nav>
    </div>
  </header>

  <div id="bandeja-notificaciones" class="hidden fixed inset-0 z-50 bg-black/30" role="dialog" aria-modal="true" aria-labelledby="titulo-bandeja">
    <aside class="absolute right-0 top-0 h-full w-full max-w-sm bg-white shadow-xl flex flex-col">
      <header class="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 id="titulo-bandeja" class="font-semibold"><i class="fa-regular fa-bell mr-2" aria-hidden="true"></i>Notificaciones</h2>
        <div class="flex gap-2">
          <button id="btn-leer-todas" class="text-xs text-marca-600 hover:underline">Marcar leídas</button>
          <button id="btn-cerrar-bandeja" class="text-slate-400 hover:text-slate-700" aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
      </header>
      <div id="lista-notificaciones" class="flex-1 overflow-y-auto divide-y divide-slate-100"></div>
    </aside>
  </div>

  <div id="avisos" class="fixed top-16 right-4 z-50 space-y-2 w-[min(92vw,22rem)]" aria-live="polite" aria-atomic="true"></div>

  <main id="contenido-principal" class="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
${cuerpo}
  </main>

  <footer id="pie-principal" class="bg-white border-t border-slate-200 mt-8">
    <div class="max-w-6xl mx-auto px-4 py-5 text-xs text-slate-500 flex flex-col sm:flex-row gap-2 justify-between">
      <p>${MARCA} · Sistema de Reserva de Citas · Proyecto integrador de Ingeniería de Software</p>
      <p>Datos demostrativos · Todos los usuarios demo usan la contraseña <code class="bg-slate-100 px-1 rounded">Demo1234</code></p>
    </div>
  </footer>

  <script src="/static/comun.js"></script>
  <script src="${archivoJs}"></script>
</body>
</html>`
}

/* ================================================================== */
/* Vista del PACIENTE                                                  */
/* ================================================================== */
export function paginaPaciente(sesion?: SesionUsuario | null): string {
  const cuerpo = `
    <section id="seccion-autenticacion" class="mb-6">
      <div class="grid gap-4 md:grid-cols-2">
        <article id="tarjeta-login" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 class="text-lg font-semibold mb-1"><i class="fa-solid fa-right-to-bracket text-marca-600 mr-2" aria-hidden="true"></i>Iniciar sesión</h2>
          <p class="text-sm text-slate-500 mb-4">Accede para reservar y gestionar tus citas.</p>
          <form id="form-login" class="space-y-3" novalidate>
            <div>
              <label for="login-email" class="block text-sm font-medium mb-1">Correo electrónico</label>
              <input id="login-email" name="email" type="email" autocomplete="email" required
                     class="campo" placeholder="paciente@consultorio.test" />
              <p class="error-campo" data-error="email"></p>
            </div>
            <div>
              <label for="login-password" class="block text-sm font-medium mb-1">Contraseña</label>
              <input id="login-password" name="password" type="password" autocomplete="current-password" required
                     class="campo" placeholder="••••••••" />
              <p class="error-campo" data-error="password"></p>
            </div>
            <button type="submit" class="btn-primario w-full">
              <i class="fa-solid fa-right-to-bracket mr-2" aria-hidden="true"></i>Entrar
            </button>
          </form>
          <button id="btn-demo-paciente" type="button" class="mt-3 w-full text-xs text-marca-600 hover:underline">
            Usar credenciales de paciente de prueba
          </button>
        </article>

        <article id="tarjeta-registro" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 class="text-lg font-semibold mb-1"><i class="fa-solid fa-user-plus text-marca-600 mr-2" aria-hidden="true"></i>Crear cuenta de paciente</h2>
          <p class="text-sm text-slate-500 mb-4">Registro gratuito. Valida tus datos antes de reservar.</p>
          <form id="form-registro" class="space-y-3" novalidate>
            <div>
              <label for="reg-nombre" class="block text-sm font-medium mb-1">Nombre completo</label>
              <input id="reg-nombre" name="nombre" type="text" autocomplete="name" required class="campo" placeholder="Juan Pérez" />
              <p class="error-campo" data-error="nombre"></p>
            </div>
            <div>
              <label for="reg-email" class="block text-sm font-medium mb-1">Correo electrónico</label>
              <input id="reg-email" name="email" type="email" autocomplete="email" required class="campo" placeholder="tucorreo@ejemplo.com" />
              <p class="error-campo" data-error="email"></p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label for="reg-telefono" class="block text-sm font-medium mb-1">Teléfono</label>
                <input id="reg-telefono" name="telefono" type="tel" autocomplete="tel" class="campo" placeholder="+52 55 0000 0000" />
                <p class="error-campo" data-error="telefono"></p>
              </div>
              <div>
                <label for="reg-password" class="block text-sm font-medium mb-1">Contraseña</label>
                <input id="reg-password" name="password" type="password" autocomplete="new-password" required class="campo" placeholder="Mín. 8, letras y números" />
                <p class="error-campo" data-error="password"></p>
              </div>
            </div>
            <button type="submit" class="btn-primario w-full">
              <i class="fa-solid fa-user-plus mr-2" aria-hidden="true"></i>Registrarme
            </button>
          </form>
        </article>
      </div>
    </section>

    <section id="zona-paciente" class="hidden space-y-6">
      <article id="tarjeta-bienvenida" class="bg-gradient-to-r from-marca-600 to-marca-800 text-white rounded-2xl p-5 shadow-sm">
        <h1 class="text-xl font-bold"><span id="saludo-paciente">Hola</span> </h1>
        <p class="text-marca-100 text-sm mt-1">Busca disponibilidad, reserva y gestiona tus citas médicas.</p>
      </article>

      <article id="tarjeta-recordatorios" class="hidden bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h2 class="font-semibold text-amber-900 mb-3"><i class="fa-solid fa-bell text-amber-600 mr-2" aria-hidden="true"></i>Tus próximas citas</h2>
        <ul id="lista-recordatorios" class="space-y-2"></ul>
      </article>

      <article id="tarjeta-busqueda" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <h2 class="text-lg font-semibold mb-4"><i class="fa-solid fa-magnifying-glass text-marca-600 mr-2" aria-hidden="true"></i>Buscar disponibilidad</h2>
        <form id="form-busqueda" class="grid gap-3 sm:grid-cols-4" novalidate>
          <div class="sm:col-span-1">
            <label for="busqueda-especialidad" class="block text-sm font-medium mb-1">Especialidad</label>
            <select id="busqueda-especialidad" name="especialidad_id" class="campo">
              <option value="">Todas</option>
            </select>
          </div>
          <div class="sm:col-span-1">
            <label for="busqueda-medico" class="block text-sm font-medium mb-1">Médico</label>
            <input id="busqueda-medico" name="q" type="text" class="campo" placeholder="Nombre o consultorio" />
          </div>
          <div class="sm:col-span-1">
            <label for="busqueda-fecha" class="block text-sm font-medium mb-1">Fecha</label>
            <input id="busqueda-fecha" name="fecha" type="date" class="campo" required />
          </div>
          <div class="sm:col-span-1">
            <label for="busqueda-dias" class="block text-sm font-medium mb-1">Días a revisar</label>
            <select id="busqueda-dias" name="dias" class="campo">
              <option value="1">Solo ese día</option>
              <option value="3">3 días</option>
              <option value="7" selected>7 días</option>
              <option value="14">14 días</option>
            </select>
          </div>
          <div class="sm:col-span-4">
            <button type="submit" class="btn-primario w-full sm:w-auto">
              <i class="fa-solid fa-magnifying-glass mr-2" aria-hidden="true"></i>Buscar horarios disponibles
            </button>
          </div>
        </form>
      </article>

      <section id="resultados-disponibilidad" class="space-y-4" aria-live="polite">
        <p id="estado-busqueda" class="text-sm text-slate-500"></p>
        <div id="lista-disponibilidad" class="grid gap-4 md:grid-cols-2"></div>
      </section>

      <article id="tarjeta-mis-citas" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <h2 class="text-lg font-semibold"><i class="fa-solid fa-list-check text-marca-600 mr-2" aria-hidden="true"></i>Mis citas</h2>
          <div class="ml-auto flex gap-1 text-sm" role="tablist">
            <button class="tab-citas tab-activo" data-tab="futuras" role="tab">Futuras</button>
            <button class="tab-citas" data-tab="pasadas" role="tab">Historial</button>
          </div>
        </div>
        <div id="lista-mis-citas" class="space-y-3"></div>
      </article>
    </section>

    <div id="modal-reprogramar" class="hidden fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-reprogramar">
      <div class="bg-white rounded-2xl max-w-lg w-full mx-auto mt-8 p-5 shadow-xl">
        <h2 id="titulo-modal-reprogramar" class="text-lg font-semibold mb-1">Reprogramar cita</h2>
        <p class="text-sm text-slate-500 mb-4">Elige un nuevo médico, fecha y horario disponible.</p>
        <form id="form-reprogramar" class="space-y-3" novalidate>
          <input type="hidden" id="reprogramar-cita-id" />
          <input type="hidden" id="reprogramar-hora" />
          <div>
            <label for="reprogramar-medico" class="block text-sm font-medium mb-1">Médico</label>
            <select id="reprogramar-medico" class="campo"></select>
          </div>
          <div>
            <label for="reprogramar-fecha" class="block text-sm font-medium mb-1">Fecha</label>
            <input id="reprogramar-fecha" type="date" class="campo" required />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Horario disponible</label>
            <div id="reprogramar-slots" class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1"></div>
          </div>
          <div>
            <label for="reprogramar-motivo" class="block text-sm font-medium mb-1">Motivo del cambio (opcional)</label>
            <textarea id="reprogramar-motivo" rows="2" class="campo" placeholder="Ej. cambio de agenda"></textarea>
          </div>
          <div class="flex gap-2 justify-end pt-1">
            <button type="button" id="btn-cancelar-reprogramar" class="btn-secundario">Cerrar</button>
            <button type="submit" class="btn-primario"><i class="fa-solid fa-rotate mr-2" aria-hidden="true"></i>Confirmar cambio</button>
          </div>
        </form>
      </div>
    </div>
  `
  return layout({ titulo: 'Reserva de citas', archivoJs: '/static/paciente.js', cuerpo, sesion })
}

/* ================================================================== */
/* Vista del RECEPCIONISTA / ADMIN                                     */
/* ================================================================== */
export function paginaAdmin(sesion?: SesionUsuario | null): string {
  const cuerpo = `
    <section id="acceso-admin" class="max-w-md mx-auto">
      <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 class="text-xl font-bold mb-1"><i class="fa-solid fa-clipboard-list text-marca-600 mr-2" aria-hidden="true"></i>Panel de recepción</h1>
        <p class="text-sm text-slate-500 mb-5">Acceso exclusivo para recepcionistas y administradores.</p>
        <form id="form-login-admin" class="space-y-3" novalidate>
          <div>
            <label for="admin-email" class="block text-sm font-medium mb-1">Correo</label>
            <input id="admin-email" type="email" autocomplete="email" required class="campo" placeholder="recepcion@consultorio.test" />
          </div>
          <div>
            <label for="admin-password" class="block text-sm font-medium mb-1">Contraseña</label>
            <input id="admin-password" type="password" autocomplete="current-password" required class="campo" placeholder="••••••••" />
          </div>
          <p class="error-campo" data-error="general"></p>
          <button type="submit" class="btn-primario w-full"><i class="fa-solid fa-right-to-bracket mr-2" aria-hidden="true"></i>Entrar al panel</button>
        </form>
        <button id="btn-demo-admin" type="button" class="mt-3 w-full text-xs text-marca-600 hover:underline">Usar credenciales de recepción de prueba</button>
      </article>
    </section>

    <section id="zona-admin" class="hidden space-y-6">
      <nav id="tabs-admin" class="flex flex-wrap gap-1 bg-white p-1.5 rounded-xl border border-slate-200 text-sm" role="tablist">
        <button class="tab-admin tab-activo" data-panel="agenda" role="tab"><i class="fa-solid fa-calendar-day mr-1.5" aria-hidden="true"></i>Agenda</button>
        <button class="tab-admin" data-panel="citas" role="tab"><i class="fa-solid fa-list-check mr-1.5" aria-hidden="true"></i>Citas</button>
        <button class="tab-admin" data-panel="nueva" role="tab"><i class="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Nueva cita</button>
        <button class="tab-admin" data-panel="medicos" role="tab"><i class="fa-solid fa-user-doctor mr-1.5" aria-hidden="true"></i>Médicos</button>
        <button class="tab-admin" data-panel="especialidades" role="tab"><i class="fa-solid fa-tags mr-1.5" aria-hidden="true"></i>Especialidades</button>
        <button class="tab-admin" data-panel="pacientes" role="tab"><i class="fa-solid fa-users mr-1.5" aria-hidden="true"></i>Pacientes</button>
        <button class="tab-admin" data-panel="auditoria" role="tab"><i class="fa-solid fa-shield-halved mr-1.5" aria-hidden="true"></i>Auditoría</button>
      </nav>

      <section id="panel-agenda" class="panel-admin space-y-4">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" id="metricas-admin"></div>
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <header class="flex flex-wrap items-center gap-3 mb-4">
            <h2 class="text-lg font-semibold"><i class="fa-solid fa-calendar-day text-marca-600 mr-2" aria-hidden="true"></i>Agenda del día</h2>
            <div class="ml-auto flex items-center gap-2">
              <button id="btn-dia-anterior" class="btn-icono" aria-label="Día anterior"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
              <input id="agenda-fecha" type="date" class="campo w-auto" />
              <button id="btn-dia-siguiente" class="btn-icono" aria-label="Día siguiente"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
            </div>
          </header>
          <div id="listado-agenda-dia" class="space-y-2"></div>
        </article>
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 class="text-lg font-semibold mb-4"><i class="fa-solid fa-chart-simple text-marca-600 mr-2" aria-hidden="true"></i>Ocupación por médico (día seleccionado)</h2>
          <div id="resumen-ocupacion" class="space-y-3"></div>
        </article>
      </section>

      <section id="panel-citas" class="panel-admin hidden space-y-4">
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 class="text-lg font-semibold mb-4"><i class="fa-solid fa-list-check text-marca-600 mr-2" aria-hidden="true"></i>Gestión de citas</h2>
          <form id="form-filtros-citas" class="grid gap-3 sm:grid-cols-5 mb-4" novalidate>
            <div class="sm:col-span-2">
              <label for="filtro-q" class="block text-sm font-medium mb-1">Buscar</label>
              <input id="filtro-q" type="text" class="campo" placeholder="Paciente, médico o motivo" />
            </div>
            <div>
              <label for="filtro-estado" class="block text-sm font-medium mb-1">Estado</label>
              <select id="filtro-estado" class="campo">
                <option value="">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="confirmada">Confirmada</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
                <option value="no_asistio">No asistió</option>
              </select>
            </div>
            <div>
              <label for="filtro-desde" class="block text-sm font-medium mb-1">Desde</label>
              <input id="filtro-desde" type="date" class="campo" />
            </div>
            <div>
              <label for="filtro-hasta" class="block text-sm font-medium mb-1">Hasta</label>
              <input id="filtro-hasta" type="date" class="campo" />
            </div>
            <div class="sm:col-span-5 flex gap-2">
              <button type="submit" class="btn-primario"><i class="fa-solid fa-filter mr-2" aria-hidden="true"></i>Aplicar filtros</button>
              <button type="button" id="btn-limpiar-filtros" class="btn-secundario">Limpiar</button>
            </div>
          </form>
          <div class="overflow-x-auto">
            <table class="tabla w-full text-sm">
              <thead>
                <tr>
                  <th>Fecha</th><th>Hora</th><th>Paciente</th><th>Médico</th><th>Estado</th><th class="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody id="cuerpo-tabla-citas"></tbody>
            </table>
          </div>
        </article>
      </section>

      <section id="panel-nueva" class="panel-admin hidden">
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 max-w-3xl">
          <h2 class="text-lg font-semibold mb-1"><i class="fa-solid fa-plus text-marca-600 mr-2" aria-hidden="true"></i>Registrar cita para un paciente</h2>
          <p class="text-sm text-slate-500 mb-4">La reserva hecha por recepción no está sujeta al límite de 24 horas.</p>
          <form id="form-nueva-cita" class="grid gap-3 sm:grid-cols-2" novalidate>
            <div class="sm:col-span-2">
              <label for="nueva-paciente" class="block text-sm font-medium mb-1">Paciente</label>
              <select id="nueva-paciente" class="campo" required></select>
              <p class="error-campo" data-error="paciente_id"></p>
            </div>
            <div>
              <label for="nueva-especialidad" class="block text-sm font-medium mb-1">Especialidad</label>
              <select id="nueva-especialidad" class="campo"></select>
            </div>
            <div>
              <label for="nueva-medico" class="block text-sm font-medium mb-1">Médico</label>
              <select id="nueva-medico" class="campo" required></select>
              <p class="error-campo" data-error="medico_id"></p>
            </div>
            <div>
              <label for="nueva-fecha" class="block text-sm font-medium mb-1">Fecha</label>
              <input id="nueva-fecha" type="date" class="campo" required />
              <p class="error-campo" data-error="fecha"></p>
            </div>
            <div>
              <label for="nueva-hora" class="block text-sm font-medium mb-1">Hora</label>
              <input id="nueva-hora" type="time" class="campo" required />
              <p class="error-campo" data-error="hora_inicio"></p>
            </div>
            <div class="sm:col-span-2">
              <label for="nueva-motivo" class="block text-sm font-medium mb-1">Motivo de la consulta</label>
              <textarea id="nueva-motivo" rows="2" class="campo" required placeholder="Describe el motivo"></textarea>
              <p class="error-campo" data-error="motivo"></p>
            </div>
            <div class="sm:col-span-2">
              <button type="button" id="btn-ver-slots-nueva" class="btn-secundario mr-2"><i class="fa-solid fa-clock mr-2" aria-hidden="true"></i>Ver horarios libres</button>
              <button type="submit" class="btn-primario"><i class="fa-solid fa-calendar-check mr-2" aria-hidden="true"></i>Registrar cita</button>
            </div>
            <div class="sm:col-span-2">
              <div id="slots-nueva-cita" class="grid grid-cols-3 sm:grid-cols-6 gap-2"></div>
            </div>
          </form>
        </article>
      </section>

      <section id="panel-medicos" class="panel-admin hidden space-y-4">
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div class="flex items-center gap-3 mb-4">
            <h2 class="text-lg font-semibold"><i class="fa-solid fa-user-doctor text-marca-600 mr-2" aria-hidden="true"></i>Médicos</h2>
            <button id="btn-nuevo-medico" class="btn-primario ml-auto text-sm"><i class="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Nuevo médico</button>
          </div>
          <div id="lista-medicos" class="space-y-3"></div>
        </article>
      </section>

      <section id="panel-especialidades" class="panel-admin hidden">
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 max-w-2xl">
          <h2 class="text-lg font-semibold mb-4"><i class="fa-solid fa-tags text-marca-600 mr-2" aria-hidden="true"></i>Especialidades</h2>
          <form id="form-especialidad" class="grid gap-3 sm:grid-cols-[1fr_1fr_auto] mb-5" novalidate>
            <div>
              <label for="esp-nombre" class="block text-sm font-medium mb-1">Nombre</label>
              <input id="esp-nombre" class="campo" required placeholder="Ej. Neurología" />
              <p class="error-campo" data-error="nombre"></p>
            </div>
            <div>
              <label for="esp-descripcion" class="block text-sm font-medium mb-1">Descripción</label>
              <input id="esp-descripcion" class="campo" placeholder="Breve descripción" />
            </div>
            <div class="flex items-end">
              <button type="submit" class="btn-primario w-full"><i class="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Añadir</button>
            </div>
          </form>
          <ul id="lista-especialidades" class="divide-y divide-slate-100"></ul>
        </article>
      </section>

      <section id="panel-pacientes" class="panel-admin hidden">
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <h2 class="text-lg font-semibold"><i class="fa-solid fa-users text-marca-600 mr-2" aria-hidden="true"></i>Pacientes</h2>
            <input id="buscar-pacientes" type="search" class="campo ml-auto w-auto" placeholder="Buscar por nombre, correo o documento" />
          </div>
          <div class="overflow-x-auto">
            <table class="tabla w-full text-sm">
              <thead><tr><th>Nombre</th><th>Contacto</th><th>Documento</th><th>Citas</th><th>Estado</th><th class="text-right">Acciones</th></tr></thead>
              <tbody id="cuerpo-tabla-pacientes"></tbody>
            </table>
          </div>
        </article>
      </section>

      <section id="panel-auditoria" class="panel-admin hidden">
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 class="text-lg font-semibold mb-4"><i class="fa-solid fa-shield-halved text-marca-600 mr-2" aria-hidden="true"></i>Registro de auditoría</h2>
          <div class="overflow-x-auto">
            <table class="tabla w-full text-sm">
              <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th></tr></thead>
              <tbody id="cuerpo-tabla-auditoria"></tbody>
            </table>
          </div>
        </article>
      </section>
    </section>

    <div id="modal-medico" class="hidden fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-medico">
      <div class="bg-white rounded-2xl max-w-2xl w-full mx-auto mt-6 p-5 shadow-xl">
        <h2 id="titulo-modal-medico" class="text-lg font-semibold mb-4">Médico</h2>
        <form id="form-medico" class="grid gap-3 sm:grid-cols-2" novalidate>
          <input type="hidden" id="medico-id" />
          <div class="sm:col-span-2">
            <label for="medico-nombre" class="block text-sm font-medium mb-1">Nombre completo</label>
            <input id="medico-nombre" class="campo" required placeholder="Dra. Nombre Apellido" />
            <p class="error-campo" data-error="nombre"></p>
          </div>
          <div>
            <label for="medico-especialidad" class="block text-sm font-medium mb-1">Especialidad</label>
            <select id="medico-especialidad" class="campo" required></select>
            <p class="error-campo" data-error="especialidad_id"></p>
          </div>
          <div>
            <label for="medico-consultorio" class="block text-sm font-medium mb-1">Consultorio</label>
            <input id="medico-consultorio" class="campo" placeholder="Consultorio 101" />
          </div>
          <div>
            <label for="medico-email" class="block text-sm font-medium mb-1">Correo</label>
            <input id="medico-email" type="email" class="campo" placeholder="medico@consultorio.test" />
            <p class="error-campo" data-error="email"></p>
          </div>
          <div>
            <label for="medico-telefono" class="block text-sm font-medium mb-1">Teléfono</label>
            <input id="medico-telefono" class="campo" placeholder="+52 55 0000 0000" />
          </div>
          <div>
            <label for="medico-colegiado" class="block text-sm font-medium mb-1">Número de colegiado</label>
            <input id="medico-colegiado" class="campo" placeholder="COL-00000" />
          </div>
          <div>
            <label for="medico-activo" class="block text-sm font-medium mb-1">Estado</label>
            <select id="medico-activo" class="campo"><option value="1">Activo</option><option value="0">Inactivo</option></select>
          </div>
          <div class="sm:col-span-2">
            <label for="medico-bio" class="block text-sm font-medium mb-1">Reseña</label>
            <textarea id="medico-bio" rows="2" class="campo" placeholder="Breve semblanza profesional"></textarea>
          </div>
          <div class="sm:col-span-2 flex gap-2 justify-end">
            <button type="button" id="btn-cerrar-modal-medico" class="btn-secundario">Cancelar</button>
            <button type="submit" class="btn-primario"><i class="fa-solid fa-floppy-disk mr-2" aria-hidden="true"></i>Guardar</button>
          </div>
        </form>

        <div id="bloque-horarios" class="mt-6 pt-5 border-t border-slate-200 hidden">
          <h3 class="font-semibold mb-3"><i class="fa-solid fa-clock text-marca-600 mr-2" aria-hidden="true"></i>Horarios de atención</h3>
          <form id="form-horario" class="grid gap-2 sm:grid-cols-5 mb-3" novalidate>
            <div class="sm:col-span-2">
              <label for="horario-dia" class="block text-xs font-medium mb-1">Día</label>
              <select id="horario-dia" class="campo">
                <option value="1">Lunes</option><option value="2">Martes</option><option value="3">Miércoles</option>
                <option value="4">Jueves</option><option value="5">Viernes</option><option value="6">Sábado</option><option value="0">Domingo</option>
              </select>
            </div>
            <div><label for="horario-inicio" class="block text-xs font-medium mb-1">Inicio</label><input id="horario-inicio" type="time" class="campo" value="09:00" /></div>
            <div><label for="horario-fin" class="block text-xs font-medium mb-1">Fin</label><input id="horario-fin" type="time" class="campo" value="13:00" /></div>
            <div><label for="horario-duracion" class="block text-xs font-medium mb-1">Min/slot</label><input id="horario-duracion" type="number" min="5" max="240" step="5" class="campo" value="30" /></div>
            <div class="sm:col-span-5"><button type="submit" class="btn-secundario w-full sm:w-auto"><i class="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Añadir bloque de horario</button></div>
          </form>
          <ul id="lista-horarios" class="divide-y divide-slate-100 text-sm"></ul>
        </div>

        <div id="bloque-resumen-medico" class="mt-4 hidden"></div>
      </div>
    </div>

    <div id="modal-reprogramar-admin" class="hidden fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="titulo-modal-reprogramar-admin">
      <div class="bg-white rounded-2xl max-w-lg w-full mx-auto mt-8 p-5 shadow-xl">
        <h2 id="titulo-modal-reprogramar-admin" class="text-lg font-semibold mb-1">Reprogramar cita</h2>
        <p class="text-sm text-slate-500 mb-4">Como recepción puedes reprogramar incluso dentro de las 24 horas previas.</p>
        <form id="form-reprogramar-admin" class="space-y-3" novalidate>
          <input type="hidden" id="reprogramar-admin-cita-id" />
          <div><label for="reprogramar-admin-medico" class="block text-sm font-medium mb-1">Médico</label><select id="reprogramar-admin-medico" class="campo"></select></div>
          <div><label for="reprogramar-admin-fecha" class="block text-sm font-medium mb-1">Fecha</label><input id="reprogramar-admin-fecha" type="date" class="campo" required /></div>
          <div>
            <label class="block text-sm font-medium mb-1">Horario disponible</label>
            <div id="reprogramar-admin-slots" class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1"></div>
          </div>
          <input type="hidden" id="reprogramar-admin-hora" />
          <div><label for="reprogramar-admin-motivo" class="block text-sm font-medium mb-1">Motivo (opcional)</label><textarea id="reprogramar-admin-motivo" rows="2" class="campo"></textarea></div>
          <div class="flex gap-2 justify-end">
            <button type="button" id="btn-cerrar-reprogramar-admin" class="btn-secundario">Cerrar</button>
            <button type="submit" class="btn-primario"><i class="fa-solid fa-rotate mr-2" aria-hidden="true"></i>Reprogramar</button>
          </div>
        </form>
      </div>
    </div>
  `
  return layout({ titulo: 'Panel de recepción', archivoJs: '/static/admin.js', cuerpo, sesion })
}

/* ================================================================== */
/* Vista del MÉDICO                                                    */
/* ================================================================== */
export function paginaMedico(sesion?: SesionUsuario | null): string {
  const cuerpo = `
    <section id="acceso-medico" class="max-w-md mx-auto">
      <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <h1 class="text-xl font-bold mb-1"><i class="fa-solid fa-user-doctor text-marca-600 mr-2" aria-hidden="true"></i>Portal del médico</h1>
        <p class="text-sm text-slate-500 mb-5">Consulta tu agenda del día y el historial de tus pacientes.</p>
        <form id="form-login-medico" class="space-y-3" novalidate>
          <div>
            <label for="medico-login-email" class="block text-sm font-medium mb-1">Correo</label>
            <input id="medico-login-email" type="email" autocomplete="email" required class="campo" placeholder="laura.mendez@consultorio.test" />
          </div>
          <div>
            <label for="medico-login-password" class="block text-sm font-medium mb-1">Contraseña</label>
            <input id="medico-login-password" type="password" autocomplete="current-password" required class="campo" placeholder="••••••••" />
          </div>
          <p class="error-campo" data-error="general"></p>
          <button type="submit" class="btn-primario w-full"><i class="fa-solid fa-right-to-bracket mr-2" aria-hidden="true"></i>Entrar</button>
        </form>
        <button id="btn-demo-medico" type="button" class="mt-3 w-full text-xs text-marca-600 hover:underline">Usar credenciales de médico de prueba</button>
      </article>
    </section>

    <section id="zona-medico" class="hidden space-y-6">
      <article class="bg-gradient-to-r from-marca-700 to-marca-900 text-white rounded-2xl p-5 shadow-sm">
        <h1 class="text-xl font-bold">Agenda de <span id="nombre-medico">—</span></h1>
        <p class="text-marca-100 text-sm mt-1" id="especialidad-medico"></p>
      </article>

      <nav id="tabs-medico" class="flex flex-wrap gap-1 bg-white p-1.5 rounded-xl border border-slate-200 text-sm" role="tablist">
        <button class="tab-medico tab-activo" data-panel="agenda-dia" role="tab"><i class="fa-solid fa-calendar-day mr-1.5" aria-hidden="true"></i>Mi agenda</button>
        <button class="tab-medico" data-panel="pacientes-medico" role="tab"><i class="fa-solid fa-users mr-1.5" aria-hidden="true"></i>Mis pacientes</button>
      </nav>

      <section id="panel-agenda-dia" class="panel-medico space-y-4">
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <header class="flex flex-wrap items-center gap-3 mb-4">
            <h2 class="text-lg font-semibold">Citas del día</h2>
            <div class="ml-auto flex items-center gap-2">
              <button id="btn-medico-dia-anterior" class="btn-icono" aria-label="Día anterior"><i class="fa-solid fa-chevron-left" aria-hidden="true"></i></button>
              <input id="medico-agenda-fecha" type="date" class="campo w-auto" />
              <button id="btn-medico-dia-siguiente" class="btn-icono" aria-label="Día siguiente"><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>
            </div>
          </header>
          <div id="resumen-medico-dia" class="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-4"></div>
          <div id="agenda-medico-lista" class="space-y-3"></div>
        </article>
      </section>

      <section id="panel-pacientes-medico" class="panel-medico hidden space-y-4">
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div class="flex flex-wrap items-center gap-3 mb-4">
            <h2 class="text-lg font-semibold">Historial de pacientes</h2>
            <input id="buscar-mis-pacientes" type="search" class="campo ml-auto w-auto" placeholder="Buscar paciente" />
          </div>
          <div id="lista-mis-pacientes" class="space-y-2"></div>
        </article>
      </section>
    </section>

    <div id="modal-historial-paciente" class="hidden fixed inset-0 z-50 bg-black/40 p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="titulo-historial">
      <div class="bg-white rounded-2xl max-w-2xl w-full mx-auto mt-6 p-5 shadow-xl">
        <header class="flex items-start gap-3 mb-4">
          <div>
            <h2 id="titulo-historial" class="text-lg font-semibold">Historial del paciente</h2>
            <p id="subtitulo-historial" class="text-sm text-slate-500"></p>
          </div>
          <button id="btn-cerrar-historial" class="ml-auto text-slate-400 hover:text-slate-700" aria-label="Cerrar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </header>
        <div id="estadisticas-historial" class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4"></div>
        <div id="lista-historial-citas" class="space-y-2 max-h-[50vh] overflow-y-auto"></div>
      </div>
    </div>
  `
  return layout({ titulo: 'Portal del médico', archivoJs: '/static/medico.js', cuerpo, sesion })
}