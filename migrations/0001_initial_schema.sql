-- =====================================================================
-- Sistema de Reserva de Citas - Consultorio Médico
-- Migración 0001: esquema inicial
-- Motor: SQLite (Cloudflare D1)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Especialidades médicas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS especialidades (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre      TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- Médicos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre            TEXT NOT NULL,
  email             TEXT UNIQUE,
  telefono          TEXT,
  numero_colegiado  TEXT,
  especialidad_id   INTEGER NOT NULL REFERENCES especialidades(id),
  consultorio       TEXT,
  bio               TEXT,
  activo            INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_medicos_especialidad ON medicos(especialidad_id, activo);

-- ---------------------------------------------------------------------
-- Usuarios del sistema (pacientes, recepcionista, admin, médicos)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  telefono      TEXT,
  documento     TEXT,
  rol           TEXT NOT NULL DEFAULT 'paciente'
                CHECK (rol IN ('paciente','recepcionista','admin','medico')),
  medico_id     INTEGER REFERENCES medicos(id),
  activo        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol, activo);

-- ---------------------------------------------------------------------
-- Horarios de atención (plantilla semanal recurrente por médico)
--   dia_semana: 0=domingo ... 6=sábado
--   hora_*: 'HH:MM' en hora local del consultorio
--   duracion_min: duración de cada slot de cita
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horarios (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  medico_id    INTEGER NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  dia_semana   INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio  TEXT NOT NULL,
  hora_fin     TEXT NOT NULL,
  duracion_min INTEGER NOT NULL DEFAULT 30 CHECK (duracion_min BETWEEN 5 AND 240),
  activo       INTEGER NOT NULL DEFAULT 1,
  CHECK (hora_fin > hora_inicio)
);
CREATE INDEX IF NOT EXISTS idx_horarios_medico ON horarios(medico_id, dia_semana, activo);

-- ---------------------------------------------------------------------
-- Citas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citas (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  medico_id          INTEGER NOT NULL REFERENCES medicos(id),
  paciente_id        INTEGER NOT NULL REFERENCES usuarios(id),
  fecha              TEXT NOT NULL,   -- 'YYYY-MM-DD'
  hora_inicio        TEXT NOT NULL,   -- 'HH:MM'
  hora_fin           TEXT NOT NULL,   -- 'HH:MM'
  estado             TEXT NOT NULL DEFAULT 'confirmada'
                     CHECK (estado IN ('pendiente','confirmada','cancelada','completada','no_asistio')),
  motivo             TEXT,
  notas              TEXT,
  creada_por         INTEGER REFERENCES usuarios(id),
  cancelada_por      INTEGER REFERENCES usuarios(id),
  motivo_cancelacion TEXT,
  cancelada_at       TEXT,
  created_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_citas_medico_fecha ON citas(medico_id, fecha);
CREATE INDEX IF NOT EXISTS idx_citas_paciente      ON citas(paciente_id, fecha);
CREATE INDEX IF NOT EXISTS idx_citas_estado        ON citas(estado, fecha);

-- Un médico no puede tener dos citas activas en el mismo slot
CREATE UNIQUE INDEX IF NOT EXISTS idx_citas_slot_unico
  ON citas(medico_id, fecha, hora_inicio)
  WHERE estado IN ('pendiente','confirmada');

-- ---------------------------------------------------------------------
-- Notificaciones / recordatorios (simulados en pantalla y "correo")
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cita_id    INTEGER REFERENCES citas(id) ON DELETE CASCADE,
  tipo       TEXT NOT NULL DEFAULT 'info'
             CHECK (tipo IN ('info','confirmacion','cancelacion','reprogramacion','recordatorio')),
  canal      TEXT NOT NULL DEFAULT 'pantalla' CHECK (canal IN ('pantalla','correo')),
  asunto     TEXT,
  mensaje    TEXT NOT NULL,
  leida      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON notificaciones(usuario_id, leida);

-- ---------------------------------------------------------------------
-- Auditoría de acciones sensibles (regla de 24h, cancelaciones, CRUD)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion     TEXT NOT NULL,
  entidad    TEXT,
  entidad_id INTEGER,
  detalle    TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(created_at);