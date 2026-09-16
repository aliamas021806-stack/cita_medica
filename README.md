# Sistema de Reserva de Citas — Consultorio Médico

Proyecto integrador de Ingeniería de Software. Aplicación web full-stack para la gestión de citas
médicas: los pacientes reservan en línea, recepción administra la agenda completa y cada médico
consulta su día de trabajo.

> **Nota sobre el stack:** el enunciado sugería Node.js + Express + PostgreSQL/MySQL. Esta
> implementación conserva el mismo diseño arquitectónico (API REST + base de datos relacional +
> autenticación con JWT) pero sobre el stack edge de Cloudflare: **Hono** en lugar de Express y
> **Cloudflare D1 (SQLite distribuido)** en lugar de PostgreSQL. Todos los endpoints, el modelo de
> datos y las reglas de negocio son equivalentes.

---

## 1. Descripción del proyecto

| Campo | Valor |
|---|---|
| **Nombre** | webapp — Reserva de Citas Consultorio |
| **Objetivo** | Digitalizar la reserva de citas de un consultorio médico, eliminando el agendado manual por teléfono |
| **Stack** | Hono (API REST) + TypeScript · Cloudflare Pages/Workers · Cloudflare D1 · Tailwind CSS (CDN) |
| **Frontend** | HTML + JavaScript vanilla con Tailwind CSS, diseño mobile-first responsive |
| **Autenticación** | JWT firmado (HS256) en cookie `httpOnly` + middleware de roles |
| **Hash de contraseñas** | PBKDF2-SHA256, 100 000 iteraciones (WebCrypto) |

---

## 2. URLs

| Entorno | URL |
|---|---|
| **Repositorio GitHub** | https://github.com/aliamas021806-stack/cita_medica |
| **Desarrollo (sandbox)** | `https://3000-<sandbox-id>.sandbox.novita.ai` (temporal: caduca con el sandbox) |
| **Producción** | *(pendiente de despliegue — ver sección 10)* |
| **Health check** | `/api/health` |

### Vistas de la aplicación

| Ruta | Vista | Rol requerido |
|---|---|---|
| `/` | Reserva de citas (paciente) | Público; requiere sesión para reservar |
| `/admin` | Panel de recepción / administración | `recepcionista`, `admin` |
| `/medico` | Portal del médico | `medico` |

---

## 3. Actores y funcionalidades implementadas

### 3.1 Paciente
| # | Requisito | Estado | Dónde |
|---|---|---|---|
| 1 | Registro e inicio de sesión con validación de datos | ✅ | `/api/auth/registro`, `/api/auth/login` |
| 2 | Búsqueda de disponibilidad por médico, especialidad y fecha | ✅ | `/api/disponibilidad/medicos`, `/api/disponibilidad/slots` |
| 3 | Reserva de cita con confirmación automática | ✅ | `POST /api/citas` |
| 4 | Cancelación y reprogramación con límite de 24 h | ✅ | `PATCH /api/citas/:id/cancelar`, `PATCH /api/citas/:id/reprogramar` |
| 7 | Recordatorio de cita próxima (pantalla + correo simulado) | ✅ | `/api/notificaciones`, `/api/citas/proximas` |
| 8 | Historial de citas (pasadas y futuras) | ✅ | `GET /api/citas/historial/:pacienteId` |

### 3.2 Recepcionista / Administrador
| # | Requisito | Estado | Dónde |
|---|---|---|---|
| 5 | Ver, confirmar, reprogramar o cancelar cualquier cita | ✅ | `GET /api/citas`, `PATCH /api/citas/:id/estado`, `/reprogramar`, `/cancelar` |
| 6 | CRUD de médicos y sus horarios de atención | ✅ | `/api/medicos`, `/api/horarios` |
| — | Registro presencial de citas (sin límite de 24 h) | ✅ | `POST /api/citas` con `paciente_id` |
| — | Gestión de especialidades | ✅ | `/api/especialidades` |
| — | Gestión de pacientes (activar/desactivar) | ✅ | `/api/admin/usuarios` |
| — | Panel de métricas y ocupación | ✅ | `/api/admin/dashboard`, `/api/disponibilidad/resumen` |
| — | Auditoría de acciones sensibles | ✅ | `/api/admin/auditoria` |

### 3.3 Médico
| # | Requisito | Estado | Dónde |
|---|---|---|---|
| — | Agenda del día | ✅ | `GET /api/medico/agenda?fecha=` |
| — | Historial de citas de sus pacientes | ✅ | `/api/medico/pacientes`, `/api/medico/paciente/:id` |
| — | Registro de notas clínicas | ✅ | `PATCH /api/medico/notas/:citaId` |

### Requisitos no funcionales
- **Responsive**: layout mobile-first con Tailwind; barra de navegación compacta en móvil.
- **Rendimiento**: las búsquedas de disponibilidad resuelven los slots en memoria a partir de los
  horarios recurrentes del médico (sin generar filas por slot en base de datos).
- **Persistencia real**: toda la información vive en Cloudflare D1 (SQLite), nunca en memoria.
- **Validación doble**: las mismas reglas se aplican en cliente (JS) y servidor (TypeScript).

---

## 4. Arquitectura y estructura de carpetas

```
webapp/
├── migrations/
│   └── 0001_initial_schema.sql     # Esquema: 7 tablas + índices
├── scripts/
│   └── generar-seed.mjs            # Genera seed.sql con hashes PBKDF2
├── seed.sql                        # Datos de ejemplo listos para cargar
├── src/                            # ---------- BACKEND ----------
│   ├── index.tsx                   # Punto de entrada: monta la API y las vistas
│   ├── types.ts                    # Tipos compartidos (Bindings, SesionUsuario)
│   ├── lib/
│   │   ├── auth.ts                 # JWT, PBKDF2, middlewares de rol
│   │   ├── validation.ts           # Validaciones reutilizables
│   │   ├── slots.ts                # Motor de disponibilidad (generación de slots)
│   │   ├── citas.ts                # Reglas de negocio (24 h, validación de slot)
│   │   └── db.ts                   # Auditoría, notificaciones, formateo de fechas
│   ├── routes/                     # ---------- API REST ----------
│   │   ├── auth.ts                 # /api/auth
│   │   ├── especialidades.ts       # /api/especialidades
│   │   ├── medicos.ts              # /api/medicos
│   │   ├── horarios.ts             # /api/horarios
│   │   ├── disponibilidad.ts       # /api/disponibilidad
│   │   ├── citas.ts                # /api/citas
│   │   ├── notificaciones.ts       # /api/notificaciones
│   │   ├── admin.ts                # /api/admin
│   │   └── medico.ts               # /api/medico
│   └── views/
│       └── paginas.ts              # Vistas HTML (paciente / admin / médico)
├── public/static/                  # ---------- FRONTEND ----------
│   ├── style.css                   # Estilos complementarios a Tailwind
│   ├── comun.js                    # Cliente HTTP, avisos, notificaciones, sesión
│   ├── paciente.js                 # Vista del paciente
│   ├── admin.js                    # Panel de recepción
│   └── medico.js                   # Portal del médico
├── wrangler.jsonc                  # Configuración de Cloudflare Pages + D1
├── ecosystem.config.cjs            # Configuración de PM2
└── package.json
```

**Separación backend/frontend:** el backend expone exclusivamente JSON bajo `/api/*`; el frontend son
archivos estáticos servidos por el mismo origen que consumen esa API con `fetch` y `credentials:
'same-origin'`. La sesión se inyecta en el HTML inicial (`window.__SESION_INICIAL__`) para evitar
parpadeos y se revalida contra `/api/auth/me`.

---

## 5. Modelo de datos

Siete tablas en Cloudflare D1 (SQLite), definidas en `migrations/0001_initial_schema.sql`:

| Tabla | Descripción | Campos clave |
|---|---|---|
| `especialidades` | Catálogo de especialidades médicas | `nombre` (único), `descripcion`, `activo` |
| `medicos` | Profesionales del consultorio | `nombre`, `especialidad_id` →, `consultorio`, `numero_colegiado`, `activo` |
| `usuarios` | Pacientes, recepcionistas, admins y médicos | `email` (único), `password_hash`, `rol` (CHECK), `medico_id` → |
| `horarios` | Plantilla semanal recurrente de atención | `medico_id` →, `dia_semana` (0-6), `hora_inicio`, `hora_fin`, `duracion_min` |
| `citas` | Citas agendadas | `medico_id` →, `paciente_id` →, `fecha`, `hora_inicio`, `hora_fin`, `estado`, `motivo`, `notas` |
| `notificaciones` | Recordatorios y avisos | `usuario_id` →, `cita_id` →, `tipo`, `canal` (`pantalla`/`correo`), `leida` |
| `auditoria` | Trazabilidad de acciones sensibles | `usuario_id` →, `accion`, `entidad`, `entidad_id`, `detalle` |

### Relaciones
```
especialidades 1 ──< medicos 1 ──< horarios
                      │
                      └──< citas >── usuarios (paciente)
usuarios 1 ──< notificaciones >── citas
usuarios 1 ──< auditoria
```

### Restricciones destacadas
- **Índice único parcial** `idx_citas_slot_unico`: impide dos citas activas del mismo médico en la
  misma fecha y hora (garantía a nivel de base de datos, no solo de aplicación).
- `citas.estado` y `usuarios.rol` usan `CHECK` para impedir valores inválidos.
- `horarios` valida `hora_fin > hora_inicio` y `duracion_min` entre 5 y 240 minutos.
- Borrado lógico (columna `activo`) en médicos, especialidades y usuarios: el historial clínico nunca
  se pierde.

### Horarios recurrentes vs. slots concretos
`horarios` guarda **plantillas semanales** (p. ej. «lunes de 09:00 a 13:00 en bloques de 30 min»). Los
slots concretos de un día se calculan al vuelo en `src/lib/slots.ts`, restando las citas ya ocupadas.
Esto evita almacenar millones de filas y mantiene las búsquedas instantáneas.

---

## 6. API REST

Base: `/api`. Todas las respuestas son JSON. La sesión viaja en la cookie `citas_token` (`httpOnly`).

### Autenticación — `/api/auth`
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/registro` | público | Registra un paciente y abre sesión |
| POST | `/login` | público | Inicia sesión (cualquier rol) |
| POST | `/logout` | público | Destruye la cookie de sesión |
| GET | `/me` | autenticado | Datos del usuario actual + notificaciones sin leer |
| PUT | `/perfil` | autenticado | Actualiza nombre, teléfono y documento |
| PUT | `/password` | autenticado | Cambia la contraseña |

### Catálogos
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/especialidades` | público | Lista especialidades (`?incluir_inactivas=1`) |
| POST | `/especialidades` | gestión | Crea especialidad |
| PUT | `/especialidades/:id` | gestión | Actualiza especialidad |
| DELETE | `/especialidades/:id` | gestión | Baja lógica (bloqueada si tiene médicos activos) |
| GET | `/medicos` | público | Busca médicos (`?q=`, `?especialidad_id=`, `?incluir_inactivos=1`) |
| GET | `/medicos/:id` | público | Detalle del médico + sus horarios |
| POST | `/medicos` | gestión | Crea médico |
| PUT | `/medicos/:id` | gestión | Actualiza médico |
| DELETE | `/medicos/:id` | gestión | Baja lógica (bloqueada si tiene citas futuras) |
| GET | `/horarios?medico_id=` | público | Horarios de un médico |
| POST | `/medicos/:id/horarios` | gestión | Añade bloque de horario |
| PUT | `/horarios/:id` | gestión | Actualiza/activa/desactiva horario |
| DELETE | `/horarios/:id` | gestión | Elimina horario |

### Disponibilidad
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/disponibilidad/medicos` | Médicos con huecos libres. Params: `especialidad_id`, `q`, `fecha`, `dias` |
| GET | `/disponibilidad/slots` | Slots de un día. Params: `medico_id`, `fecha` |
| GET | `/disponibilidad/resumen` | Ocupación por médico del día. Param: `fecha` |

### Citas
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/citas` | autenticado | Lista filtrada según rol. Params: `estado`, `desde`, `hasta`, `medico_id`, `paciente_id`, `q` |
| GET | `/citas/proximas` | autenticado | Próximas citas para recordatorios |
| GET | `/citas/:id` | autenticado | Detalle de una cita |
| GET | `/citas/historial/:pacienteId` | autenticado | Historial agrupado en futuras/pasadas + estadísticas |
| POST | `/citas` | autenticado | Reserva una cita (el paciente siempre para sí mismo) |
| PATCH | `/citas/:id/cancelar` | autenticado | Cancela (paciente: límite 24 h) |
| PATCH | `/citas/:id/reprogramar` | paciente/gestión | Reprograma (paciente: límite 24 h) |
| PATCH | `/citas/:id/estado` | gestión | Cambia estado: `pendiente`, `confirmada`, `completada`, `no_asistio` |

### Notificaciones, administración y médico
| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/notificaciones` | autenticado | Bandeja (`?no_leidas=1`) |
| PATCH | `/notificaciones/:id/leer` | autenticado | Marca una como leída |
| PATCH | `/notificaciones/leer-todas` | autenticado | Marca todas como leídas |
| DELETE | `/notificaciones/:id` | autenticado | Elimina una notificación |
| GET | `/admin/dashboard` | gestión | Métricas, agenda semanal y próximas citas |
| GET | `/admin/auditoria` | gestión | Registro de auditoría |
| GET | `/admin/usuarios` | gestión | Listado de usuarios (`?rol=`, `?q=`) |
| PATCH | `/admin/usuarios/:id/estado` | gestión | Activa/desactiva usuario |
| GET | `/medico/agenda` | médico | Agenda del día (`?fecha=`) |
| GET | `/medico/pacientes` | médico | Sus pacientes (`?q=`) |
| GET | `/medico/paciente/:id` | médico | Historial completo con un paciente |
| PATCH | `/medico/notas/:citaId` | médico | Guarda notas clínicas |

### Códigos de estado empleados
| Código | Significado |
|---|---|
| 400 | Datos inválidos (incluye campo `errores` con el detalle por campo) |
| 401 | No autenticado |
| 403 | Rol sin permiso |
| 404 | Recurso no encontrado |
| 409 | Conflicto: slot ocupado, límite de 24 h, registro duplicado |

---

## 7. Reglas de negocio

1. **Confirmación automática** — al reservar, la cita nace en estado `confirmada` y el paciente
   recibe dos notificaciones: confirmación (pantalla) y recordatorio (correo simulado).
2. **Límite de 24 horas** — el paciente solo puede cancelar o reprogramar si faltan **más de 24 h**.
   En caso contrario la API responde `409` con `codigo: "LIMITE_24H"` y las horas restantes. La
   recepción y el administrador **no** están sujetos a este límite (es su función resolver
   urgencias), pero el intento queda registrado en auditoría.
3. **Sin citas en el pasado** — la validación de slot compara contra la hora local del consultorio
   (configurable con `TZ_OFFSET_MIN`).
4. **Sin solapamientos** — un médico no puede tener dos citas activas en el mismo bloque (índice
   único parcial en base de datos + comprobación previa).
5. **Sin doble reserva del paciente** — un paciente no puede tener dos citas solapadas el mismo día.
6. **Historial siempre preservado** — bajas de médicos, especialidades y usuarios son lógicas
   (`activo = 0`); no se borra ningún dato clínico.

---

## 8. Datos de ejemplo (seed)

Cargados desde `seed.sql` (generado por `scripts/generar-seed.mjs`):

| Entidad | Cantidad |
|---|---|
| Especialidades | 6 (Medicina General, Pediatría, Cardiología, Dermatología, Traumatología, Ginecología) |
| Médicos | 8 (con consultorio, colegiado y reseña) |
| Usuarios | 10 (1 admin, 1 recepcionista, 3 médicos, 5 pacientes) |
| Bloques de horario | 38 |
| Citas | 14 (pasadas, de hoy, futuras, canceladas y con inasistencia) |
| Notificaciones | 5 |

### Credenciales de prueba

**Todos los usuarios demo usan la contraseña: `Demo1234`**

| Rol | Correo |
|---|---|
| Administrador | `admin@consultorio.test` |
| Recepcionista | `recepcion@consultorio.test` |
| Médico (Medicina General) | `laura.mendez@consultorio.test` |
| Médico (Pediatría) | `sofia.herrera@consultorio.test` |
| Médico (Cardiología) | `andres.salinas@consultorio.test` |
| Paciente | `paciente@consultorio.test` |
| Paciente | `maria.lopez@correo.test` |
| Paciente | `pedro.ramirez@correo.test` |
| Paciente | `lucia.torres@correo.test` |
| Paciente | `diego.santos@correo.test` |

Cada vista incluye un botón **«Usar credenciales de prueba»** que rellena el formulario automáticamente.

---

## 9. Guía de uso

### Como paciente
1. Abre `/` y pulsa **«Usar credenciales de paciente de prueba»** → **Entrar** (o crea una cuenta nueva).
2. En **Buscar disponibilidad**, elige especialidad (opcional), una fecha y cuántos días revisar.
3. Aparecerán las tarjetas de los médicos con huecos libres. Pulsa un día, elige una hora y escribe el
   **motivo de la consulta**.
4. Pulsa **Reservar cita**. La confirmación es inmediata y verás el recordatorio en la campana.
5. En **Mis citas → Futuras** puedes **Reprogramar** o **Cancelar** (siempre con más de 24 h).
6. En **Historial** consultas tus citas pasadas con su estado.

### Como recepcionista / administrador
1. Entra en `/admin` (botón de credenciales de prueba → **Entrar al panel**).
2. **Agenda**: métricas del día, agenda completa, navegación por días y barras de ocupación por médico.
3. **Citas**: filtra por texto, estado o rango de fechas; confirma, completa, marca inasistencia,
   reprograma o cancela. Las acciones notifican automáticamente al paciente.
4. **Nueva cita**: registra una cita presencial para cualquier paciente (sin límite de 24 h).
5. **Médicos**: crea, edita o da de baja médicos y gestiona sus **bloques de horario** por día de la semana.
6. **Especialidades / Pacientes / Auditoría**: mantén el catálogo, activa o desactiva pacientes y
   revisa la trazabilidad de cada acción.

### Como médico
1. Entra en `/medico` (botón de credenciales de prueba → **Entrar**).
2. **Mi agenda**: navega por días, ve el resumen (confirmadas, completadas, inasistencias) y detecta la
   cita «En curso» resaltada.
3. Pulsa **Notas** en una cita para añadir las notas clínicas.
4. **Mis pacientes**: consulta el historial completo de cada paciente con sus estadísticas de asistencia.

---

## 10. Desarrollo y despliegue

### Requisitos
Node.js 20+ y npm. Las dependencias ya están instaladas en el sandbox.

### Comandos disponibles

```bash
# Desarrollo
npm run dev              # Servidor de desarrollo de Vite (con recarga en caliente)
npm run build            # Compila el worker en dist/
npm run dev:sandbox      # wrangler pages dev sobre dist/ en el puerto 3000

# Base de datos (D1)
npm run db:migrate:local   # Aplica migraciones a la base local
npm run db:seed            # Carga los datos de ejemplo
npm run db:reset           # Reinicia la base local: migraciones + seed
npm run db:console:local   # Consola SQL interactiva
npm run seed:generar       # Regenera seed.sql (hashes de contraseña nuevos)

# Producción
npm run db:migrate:prod    # Aplica migraciones a la base remota
npm run db:seed:prod       # Carga el seed remoto
npm run deploy             # Compila y despliega en Cloudflare Pages
```

### Arranque local en el sandbox
```bash
cd /home/user/webapp
npm run build
pm2 start ecosystem.config.cjs     # wrangler pages dev dist --local --port 3000
curl http://localhost:3000/api/health
pm2 logs webapp --nostream         # Ver logs
```

> **Importante:** el binding de D1 se resuelve desde `wrangler.jsonc` (no se debe forzar con
> `--d1=DB` en la CLI, porque wrangler crearía entonces una base local distinta y las migraciones no
> coincidirían con la que usa el servidor).

### Estado del despliegue
- ✅ Desarrollo local verificado de extremo a extremo.
- ✅ Código publicado en GitHub: https://github.com/aliamas021806-stack/cita_medica
- ⏳ **Producción pendiente**. El proyecto está listo para desplegar (el *preflight* de bindings pasa
  limpio: 1× D1, sin KV, sin R2, sin cron, `vars` correctas), pero el hosting gestionado de Genspark
  está bloqueado por el plan de la cuenta (`plan: free`, 90.69 créditos; requiere plan de pago o
  ≥500 créditos). Rutas posibles:
  1. **Cloudflare propio (BYOK)**: pegar un API Token en la pestaña *Deploy* y ejecutar `npm run deploy`.
  2. **Hosting de Genspark**: al actualizar el plan, funciona sin tocar el código.

  En ambos casos hay que crear la base D1 remota, sustituir `PLACEHOLDER_DATABASE_ID` en
  `wrangler.jsonc` y ejecutar `npm run db:migrate:prod` + `npm run db:seed:prod`.

### Variables de entorno
| Variable | Descripción | Valor por defecto |
|---|---|---|
| `JWT_SECRET` | Secreto para firmar los JWT | En local `secreto-local-...`; en producción debe definirse como secreto |
| `TZ_OFFSET_MIN` | Offset en minutos respecto a UTC de la hora local del consultorio | `-300` (UTC-5) |

En local se configuran en `.dev.vars` (no versionado). En producción deben cargarse como secretos de
Cloudflare, nunca en el repositorio.

---

## 11. Pruebas realizadas

| Escenario | Resultado |
|---|---|
| Registro con datos inválidos (nombre corto, correo mal formado, contraseña débil) | ✅ Devuelve `400` con el detalle por campo |
| Correo ya registrado | ✅ `409` |
| Login correcto / contraseña incorrecta | ✅ `200` / `401` |
| Búsqueda de disponibilidad por fecha y especialidad | ✅ |
| Reserva en slot libre | ✅ Cita creada en estado `confirmada` |
| Reserva en slot ya ocupado | ✅ `409` |
| Reserva en el pasado | ✅ `400` |
| Reserva en día no laborable del médico | ✅ `400` («El médico no atiende en ese horario») |
| Cancelación con más de 24 h | ✅ |
| Cancelación con menos de 24 h (paciente) | ✅ `409` con `codigo: LIMITE_24H` |
| Reprogramación por el paciente (con antelación) | ✅ |
| Reprogramación por recepción dentro de las 24 h | ✅ (sin límite, con auditoría) |
| Acceso de paciente a endpoints de gestión | ✅ `403` |
| Acceso de médico al panel de administración | ✅ `403` |
| Acceso sin sesión | ✅ `401` |
| Historial de otro paciente | ✅ `403` |
| Horario solapado | ✅ `409` con mensaje por campo |
| Horario con fin anterior al inicio | ✅ `400` |
| Baja de médico con citas futuras | ✅ `409` (bloqueada correctamente) |
| Las tres vistas renderizan sin errores de JavaScript | ✅ |

---

## 12. Limitaciones conocidas y siguientes pasos

### Limitaciones
- El envío de correo es **simulado**: los recordatorios se guardan con `canal = 'correo'` y se muestran
  en la bandeja de la aplicación. Integrar un proveedor real (Resend, SendGrid) solo requiere añadir su
  API key como secreto y una llamada en `src/lib/db.ts`.
- No hay recuperación de contraseña por correo.
- Un médico pertenece a una sola especialidad.
- La zona horaria es única para todo el consultorio (`TZ_OFFSET_MIN`); no hay soporte multi-sede.

### Siguientes pasos recomendados
1. Desplegar en producción y crear la base D1 remota (sección 10).
2. Integrar correo real para los recordatorios (el modelo de datos ya lo soporta).
3. Añadir recuperación de contraseña con enlace de un solo uso.
4. Implementar lista de espera y auto-completado de huecos liberados por cancelaciones.
5. Añadir pruebas automatizadas (Vitest para la lógica de slots y reglas de 24 h).
6. Incorporar expediente clínico con archivos adjuntos usando Cloudflare R2.
7. Añadir exportación de reportes (CSV/PDF) para la administración.
8. Soporte multi-sede con zona horaria por consultorio.

---

## 13. Glosario de decisiones técnicas

| Decisión | Motivo |
|---|---|
| Hono en lugar de Express | Express requiere un proceso Node persistente; el runtime de Workers es edge y sin estado |
| Cloudflare D1 en lugar de PostgreSQL | Es el motor relacional gestionado disponible en la plataforma de destino; SQL estándar y migraciones versionadas |
| Horarios como plantilla semanal | Evita pre-generar miles de filas de slots y hace las búsquedas instantáneas |
| JWT en cookie `httpOnly` | Protege el token frente a XSS y permite que el frontend sea HTML estático del mismo origen |
| Borrado lógico | En un contexto clínico el historial nunca debe perderse |
| Índice único parcial en `citas` | La integridad del agendado se garantiza en base de datos, no solo en código |
| Validación duplicada cliente + servidor | Cumple el requisito no funcional y da feedback inmediato sin confiar en el navegador |

---

**Última actualización:** 2026-09-16
**Estado:** ✅ Desarrollo completo y verificado en local · ⏳ Despliegue en producción pendiente
