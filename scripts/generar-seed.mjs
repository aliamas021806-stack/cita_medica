/**
 * Genera seed.sql con contraseñas hasheadas en el mismo formato que src/lib/auth.ts
 * Formato: pbkdf2$<iteraciones>$<saltB64>$<hashB64>
 * Uso: node scripts/generar-seed.mjs
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const ITERACIONES = 100_000

function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(password, salt, ITERACIONES, 32, 'sha256')
  return `pbkdf2$${ITERACIONES}$${salt.toString('base64')}$${hash.toString('base64')}`
}

const PASSWORD_DEMO = 'Demo1234'

/* ------------------------------------------------------------------ */
/* Especialidades                                                      */
/* ------------------------------------------------------------------ */
const especialidades = [
  ['Medicina General', 'Atención primaria, control y derivación de pacientes'],
  ['Pediatría', 'Atención médica para niños y adolescentes'],
  ['Cardiología', 'Diagnóstico y tratamiento de enfermedades del corazón'],
  ['Dermatología', 'Cuidado de la piel, cabello y uñas'],
  ['Traumatología', 'Lesiones del aparato locomotor y rehabilitación'],
  ['Ginecología', 'Salud integral de la mujer'],
]

/* ------------------------------------------------------------------ */
/* Médicos                                                             */
/* ------------------------------------------------------------------ */
const medicos = [
  // nombre, email, telefono, colegiado, especialidad_id, consultorio, bio
  ['Dra. Laura Méndez', 'laura.mendez@consultorio.test', '+52 55 1000 2201', 'COL-10231', 1, 'Consultorio 101', 'Médica general con 12 años de experiencia en atención primaria.'],
  ['Dr. Carlos Rivas', 'carlos.rivas@consultorio.test', '+52 55 1000 2202', 'COL-10455', 1, 'Consultorio 102', 'Especialista en medicina familiar y prevención.'],
  ['Dra. Sofía Herrera', 'sofia.herrera@consultorio.test', '+52 55 1000 2203', 'COL-11876', 2, 'Consultorio 201', 'Pediatra, enfocada en desarrollo infantil temprano.'],
  ['Dr. Andrés Salinas', 'andres.salinas@consultorio.test', '+52 55 1000 2204', 'COL-12002', 3, 'Consultorio 301', 'Cardiólogo intervencionista, ecocardiografía y prevención cardiovascular.'],
  ['Dra. Valeria Ortega', 'valeria.ortega@consultorio.test', '+52 55 1000 2205', 'COL-13440', 4, 'Consultorio 202', 'Dermatóloga clínica y estética, manejo de dermatitis y acné.'],
  ['Dr. Miguel Ángel Ponce', 'miguel.ponce@consultorio.test', '+52 55 1000 2206', 'COL-14512', 5, 'Consultorio 103', 'Traumatólogo deportivo, rehabilitación de lesiones.'],
  ['Dra. Paola Jiménez', 'paola.jimenez@consultorio.test', '+52 55 1000 2207', 'COL-15900', 6, 'Consultorio 203', 'Ginecóloga, control prenatal y salud preventiva de la mujer.'],
  ['Dr. Ricardo Fuentes', 'ricardo.fuentes@consultorio.test', '+52 55 1000 2208', 'COL-16233', 3, 'Consultorio 302', 'Cardiólogo clínico, hipertensión y arritmias.'],
]

/* ------------------------------------------------------------------ */
/* Plantilla de horarios por médico (día 1=lunes ... 6=sábado)          */
/* ------------------------------------------------------------------ */
function horariosDeMedico(indice) {
  const planes = [
    // cada plan: [dias, inicio, fin, duracion]
    [[[1, 2, 3, 4, 5], '09:00', '13:00', 30], [[1, 3, 5], '15:00', '18:00', 30]],
    [[[1, 2, 4], '08:00', '12:00', 20], [[2, 4], '14:00', '17:00', 20]],
    [[[2, 3, 4, 6], '10:00', '14:00', 30]],
    [[[1, 2, 3, 4, 5], '07:00', '11:00', 15], [[3], '16:00', '19:00', 15]],
    [[[1, 3, 5], '11:00', '15:00', 20], [[6], '09:00', '12:00', 20]],
    [[[2, 4, 6], '13:00', '18:00', 30]],
    [[[1, 2, 3, 5], '09:30', '13:30', 30]],
    [[[2, 3, 4, 5], '14:00', '18:30', 30]],
  ]
  return planes[indice % planes.length]
}

/* ------------------------------------------------------------------ */
/* Construcción del SQL                                                */
/* ------------------------------------------------------------------ */
const lineas = []
lineas.push('-- =====================================================================')
lineas.push('-- Datos de ejemplo (seed) - Sistema de Reserva de Citas')
lineas.push('-- Contraseña para TODOS los usuarios demo: ' + PASSWORD_DEMO)
lineas.push('-- (hashes PBKDF2-SHA256, 100000 iteraciones)')
lineas.push('-- =====================================================================')
lineas.push('')
lineas.push("DELETE FROM auditoria;")
lineas.push("DELETE FROM notificaciones;")
lineas.push("DELETE FROM citas;")
lineas.push("DELETE FROM horarios;")
lineas.push("DELETE FROM usuarios;")
lineas.push("DELETE FROM medicos;")
lineas.push("DELETE FROM especialidades;")
lineas.push("DELETE FROM sqlite_sequence WHERE name IN ('especialidades','medicos','usuarios','horarios','citas','notificaciones','auditoria');")
lineas.push('')

lineas.push('-- Especialidades')
lineas.push('INSERT INTO especialidades (nombre, descripcion) VALUES')
lineas.push(
  especialidades.map(([n, d]) => `  ('${n}', '${d}')`).join(',\n') + ';',
)
lineas.push('')

lineas.push('-- Médicos')
lineas.push(
  'INSERT INTO medicos (nombre, email, telefono, numero_colegiado, especialidad_id, consultorio, bio) VALUES',
)
lineas.push(
  medicos
    .map(
      ([n, e, t, col, esp, cons, bio]) =>
        `  ('${n}', '${e}', '${t}', '${col}', ${esp}, '${cons}', '${bio}')`,
    )
    .join(',\n') + ';',
)
lineas.push('')

lineas.push('-- Usuarios (contraseña demo para todos: ' + PASSWORD_DEMO + ')')
const usuarios = [
  // email, password, nombre, telefono, documento, rol, medico_id
  ['admin@consultorio.test', 'Ana Gómez', '+52 55 2000 0001', 'ADM-001', 'admin', null],
  ['recepcion@consultorio.test', 'Beatriz Núñez', '+52 55 2000 0002', 'REC-001', 'recepcionista', null],
  ['laura.mendez@consultorio.test', 'Dra. Laura Méndez', '+52 55 1000 2201', 'COL-10231', 'medico', 1],
  ['sofia.herrera@consultorio.test', 'Dra. Sofía Herrera', '+52 55 1000 2203', 'COL-11876', 'medico', 3],
  ['andres.salinas@consultorio.test', 'Dr. Andrés Salinas', '+52 55 1000 2204', 'COL-12002', 'medico', 4],
  ['paciente@consultorio.test', 'Juan Pérez', '+52 55 3000 1001', 'PAC-1001', 'paciente', null],
  ['maria.lopez@correo.test', 'María López', '+52 55 3000 1002', 'PAC-1002', 'paciente', null],
  ['pedro.ramirez@correo.test', 'Pedro Ramírez', '+52 55 3000 1003', 'PAC-1003', 'paciente', null],
  ['lucia.torres@correo.test', 'Lucía Torres', '+52 55 3000 1004', 'PAC-1004', 'paciente', null],
  ['diego.santos@correo.test', 'Diego Santos', '+52 55 3000 1005', 'PAC-1005', 'paciente', null],
]
lineas.push(
  'INSERT INTO usuarios (email, password_hash, nombre, telefono, documento, rol, medico_id) VALUES',
)
lineas.push(
  usuarios
    .map(([email, nombre, tel, doc, rol, mid]) => {
      const h = hashPassword(PASSWORD_DEMO)
      const medicoId = mid === null ? 'NULL' : String(mid)
      return `  ('${email}', '${h}', '${nombre}', '${tel}', '${doc}', '${rol}', ${medicoId})`
    })
    .join(',\n') + ';',
)
lineas.push('')

lineas.push('-- Horarios de atención (plantilla semanal)')
const filasHorario = []
medicos.forEach((_, i) => {
  const medicoId = i + 1
  for (const [dias, inicio, fin, dur] of horariosDeMedico(i)) {
    for (const d of dias) {
      filasHorario.push(`  (${medicoId}, ${d}, '${inicio}', '${fin}', ${dur}, 1)`)
    }
  }
})
lineas.push(
  'INSERT INTO horarios (medico_id, dia_semana, hora_inicio, hora_fin, duracion_min, activo) VALUES',
)
lineas.push(filasHorario.join(',\n') + ';')
lineas.push('')

/* ------------------------------------------------------------------ */
/* Citas de ejemplo: relativas a "hoy"                                 */
/* ------------------------------------------------------------------ */
const hoy = new Date()
const dias = (n) => {
  const d = new Date(hoy)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const citas = [
  // medico_id, paciente_id, fecha, hora_inicio, hora_fin, estado, motivo, notas
  [1, 6, dias(0), '09:00', '09:30', 'confirmada', 'Control de presión arterial', 'Paciente con hipertensión leve'],
  [1, 7, dias(0), '10:00', '10:30', 'confirmada', 'Dolor de garganta persistente', null],
  [1, 6, dias(-7), '09:30', '10:00', 'completada', 'Revisión general anual', 'Se solicitaron estudios de laboratorio'],
  [1, 8, dias(-14), '11:00', '11:30', 'no_asistio', 'Consulta por fiebre', 'Paciente no se presentó'],
  [3, 7, dias(1), '10:30', '11:00', 'confirmada', 'Vacunación infantil', 'Refuerzo de cuadro básico'],
  [3, 9, dias(-3), '10:00', '10:30', 'completada', 'Control de niño sano', 'Peso y talla dentro de percentiles'],
  [4, 8, dias(2), '07:15', '07:30', 'confirmada', 'Electrocardiograma de control', 'Traer estudios previos'],
  [4, 10, dias(-5), '08:00', '08:15', 'completada', 'Dolor torácico en esfuerzo', 'ECG normal, se recomienda prueba de esfuerzo'],
  [5, 9, dias(3), '11:20', '11:40', 'confirmada', 'Dermatitis en manos', null],
  [6, 10, dias(4), '13:30', '14:00', 'confirmada', 'Rehabilitación de rodilla', 'Post operatorio semana 4'],
  [7, 6, dias(-10), '09:30', '10:00', 'completada', 'Control ginecológico anual', 'Sin hallazgos relevantes'],
  [8, 7, dias(5), '14:00', '14:30', 'confirmada', 'Seguimiento de arritmia', 'Traer Holter'],
  [2, 8, dias(-1), '08:20', '08:40', 'cancelada', 'Consulta de seguimiento', 'Cancelada por el paciente'],
  [3, 6, dias(6), '11:00', '11:30', 'confirmada', 'Consulta pediátrica de control', null],
]
lineas.push('-- Citas (fechas relativas al día de ejecución del seed)')
lineas.push(
  'INSERT INTO citas (medico_id, paciente_id, fecha, hora_inicio, hora_fin, estado, motivo, notas, creada_por) VALUES',
)
lineas.push(
  citas
    .map(([m, p, f, hi, hf, est, motivo, notas]) => {
      const n = notas === null ? 'NULL' : `'${notas}'`
      return `  (${m}, ${p}, '${f}', '${hi}', '${hf}', '${est}', '${motivo}', ${n}, ${p})`
    })
    .join(',\n') + ';',
)
lineas.push('')

lineas.push('-- Notificaciones de ejemplo')
lineas.push('INSERT INTO notificaciones (usuario_id, cita_id, tipo, canal, asunto, mensaje, leida) VALUES')
lineas.push(
  [
    `  (6, 1, 'confirmacion', 'pantalla', 'Cita confirmada', 'Su cita con la Dra. Laura Méndez fue confirmada para hoy a las 09:00.', 0)`,
    `  (6, 3, 'recordatorio', 'correo', 'Recordatorio de cita', 'Le recordamos su cita de control. Llegue 10 minutos antes.', 1)`,
    `  (7, 5, 'confirmacion', 'pantalla', 'Cita confirmada', 'Su cita de vacunación infantil fue registrada correctamente.', 0)`,
    `  (8, 13, 'cancelacion', 'pantalla', 'Cita cancelada', 'Su cita del día de ayer fue cancelada a petición suya.', 1)`,
    `  (9, 9, 'recordatorio', 'correo', 'Recordatorio de cita', 'Recuerde su cita de dermatología. Evite aplicar cremas el día previo.', 0)`,
  ].join(',\n') + ';',
)
lineas.push('')

lineas.push('-- Auditoría inicial')
lineas.push("INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle) VALUES (1, 'seed', 'sistema', NULL, 'Carga de datos de ejemplo');")
lineas.push('')

writeFileSync(new URL('../seed.sql', import.meta.url), lineas.join('\n'), 'utf8')
console.log('seed.sql generado correctamente')
console.log('Contraseña demo:', PASSWORD_DEMO)