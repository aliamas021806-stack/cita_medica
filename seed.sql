-- =====================================================================
-- Datos de ejemplo (seed) - Sistema de Reserva de Citas
-- Contraseña para TODOS los usuarios demo: Demo1234
-- (hashes PBKDF2-SHA256, 100000 iteraciones)
-- =====================================================================

DELETE FROM auditoria;
DELETE FROM notificaciones;
DELETE FROM citas;
DELETE FROM horarios;
DELETE FROM usuarios;
DELETE FROM medicos;
DELETE FROM especialidades;
DELETE FROM sqlite_sequence WHERE name IN ('especialidades','medicos','usuarios','horarios','citas','notificaciones','auditoria');

-- Especialidades
INSERT INTO especialidades (nombre, descripcion) VALUES
  ('Medicina General', 'Atención primaria, control y derivación de pacientes'),
  ('Pediatría', 'Atención médica para niños y adolescentes'),
  ('Cardiología', 'Diagnóstico y tratamiento de enfermedades del corazón'),
  ('Dermatología', 'Cuidado de la piel, cabello y uñas'),
  ('Traumatología', 'Lesiones del aparato locomotor y rehabilitación'),
  ('Ginecología', 'Salud integral de la mujer');

-- Médicos
INSERT INTO medicos (nombre, email, telefono, numero_colegiado, especialidad_id, consultorio, bio) VALUES
  ('Dra. Laura Méndez', 'laura.mendez@consultorio.test', '+52 55 1000 2201', 'COL-10231', 1, 'Consultorio 101', 'Médica general con 12 años de experiencia en atención primaria.'),
  ('Dr. Carlos Rivas', 'carlos.rivas@consultorio.test', '+52 55 1000 2202', 'COL-10455', 1, 'Consultorio 102', 'Especialista en medicina familiar y prevención.'),
  ('Dra. Sofía Herrera', 'sofia.herrera@consultorio.test', '+52 55 1000 2203', 'COL-11876', 2, 'Consultorio 201', 'Pediatra, enfocada en desarrollo infantil temprano.'),
  ('Dr. Andrés Salinas', 'andres.salinas@consultorio.test', '+52 55 1000 2204', 'COL-12002', 3, 'Consultorio 301', 'Cardiólogo intervencionista, ecocardiografía y prevención cardiovascular.'),
  ('Dra. Valeria Ortega', 'valeria.ortega@consultorio.test', '+52 55 1000 2205', 'COL-13440', 4, 'Consultorio 202', 'Dermatóloga clínica y estética, manejo de dermatitis y acné.'),
  ('Dr. Miguel Ángel Ponce', 'miguel.ponce@consultorio.test', '+52 55 1000 2206', 'COL-14512', 5, 'Consultorio 103', 'Traumatólogo deportivo, rehabilitación de lesiones.'),
  ('Dra. Paola Jiménez', 'paola.jimenez@consultorio.test', '+52 55 1000 2207', 'COL-15900', 6, 'Consultorio 203', 'Ginecóloga, control prenatal y salud preventiva de la mujer.'),
  ('Dr. Ricardo Fuentes', 'ricardo.fuentes@consultorio.test', '+52 55 1000 2208', 'COL-16233', 3, 'Consultorio 302', 'Cardiólogo clínico, hipertensión y arritmias.');

-- Usuarios (contraseña demo para todos: Demo1234)
INSERT INTO usuarios (email, password_hash, nombre, telefono, documento, rol, medico_id) VALUES
  ('admin@consultorio.test', 'pbkdf2$100000$vSUvdzvWOZ5D5hp4BFoDoA==$wbCT0bQlWpTvTyQO976rboLUFK0sR4vzNmc0MsjoRrY=', 'Ana Gómez', '+52 55 2000 0001', 'ADM-001', 'admin', NULL),
  ('recepcion@consultorio.test', 'pbkdf2$100000$C6wBy1QY9oXrREB03swJgw==$GlYP4/T4WuUhnJtSP3ClIT2DYArdFwxRpljtdNCwW8Q=', 'Beatriz Núñez', '+52 55 2000 0002', 'REC-001', 'recepcionista', NULL),
  ('laura.mendez@consultorio.test', 'pbkdf2$100000$anQKmhdn/PgkGrqwCcj9GQ==$n6ut1PCryDKogbIQ8c52jdy3K51LxlT0MDXIdG4TZuU=', 'Dra. Laura Méndez', '+52 55 1000 2201', 'COL-10231', 'medico', 1),
  ('sofia.herrera@consultorio.test', 'pbkdf2$100000$gHTpQzzEF/1SmKwqY1Frrw==$1X/h1MQpbBj086D1zR8AUhAdM3DQte9Q2UfbHFcSAD4=', 'Dra. Sofía Herrera', '+52 55 1000 2203', 'COL-11876', 'medico', 3),
  ('andres.salinas@consultorio.test', 'pbkdf2$100000$APVJWKL8U+oAzxnglBisgA==$tKp7iKbFhPDk6INT2BgPe5Izvwpj0U+Zw2FVPEmsGu0=', 'Dr. Andrés Salinas', '+52 55 1000 2204', 'COL-12002', 'medico', 4),
  ('paciente@consultorio.test', 'pbkdf2$100000$Ozgp/PREmVB2gKy6EZ+JVg==$CCSrLjM9UfqQYNYTPdIbYOF41umBUyPSfSEtPGJvNoc=', 'Juan Pérez', '+52 55 3000 1001', 'PAC-1001', 'paciente', NULL),
  ('maria.lopez@correo.test', 'pbkdf2$100000$l0zEOBtNbMV5ltL0W9oquw==$u0ZM+JLycK5SIv1P97Y+UtnunpfVCif3ADDrgbpX8J0=', 'María López', '+52 55 3000 1002', 'PAC-1002', 'paciente', NULL),
  ('pedro.ramirez@correo.test', 'pbkdf2$100000$7Egi4fAPOEnRMl8x7rwOpA==$oDg3yImiGPs9sGAq5MP24HWpK09XMumHeiqQewcNwmI=', 'Pedro Ramírez', '+52 55 3000 1003', 'PAC-1003', 'paciente', NULL),
  ('lucia.torres@correo.test', 'pbkdf2$100000$/sqbxUYY6SZct0Y4sT6BTQ==$k5oODv3JE+jE8GFWU/0/J7Qos1EmIuXtTI4oZUJaa3M=', 'Lucía Torres', '+52 55 3000 1004', 'PAC-1004', 'paciente', NULL),
  ('diego.santos@correo.test', 'pbkdf2$100000$BfhaXpY/a5VQRgTw+gy2GQ==$lIDzIURcLa383MsFmGi4GISalc3XG2LV9CqkXoxMemI=', 'Diego Santos', '+52 55 3000 1005', 'PAC-1005', 'paciente', NULL);

-- Horarios de atención (plantilla semanal)
INSERT INTO horarios (medico_id, dia_semana, hora_inicio, hora_fin, duracion_min, activo) VALUES
  (1, 1, '09:00', '13:00', 30, 1),
  (1, 2, '09:00', '13:00', 30, 1),
  (1, 3, '09:00', '13:00', 30, 1),
  (1, 4, '09:00', '13:00', 30, 1),
  (1, 5, '09:00', '13:00', 30, 1),
  (1, 1, '15:00', '18:00', 30, 1),
  (1, 3, '15:00', '18:00', 30, 1),
  (1, 5, '15:00', '18:00', 30, 1),
  (2, 1, '08:00', '12:00', 20, 1),
  (2, 2, '08:00', '12:00', 20, 1),
  (2, 4, '08:00', '12:00', 20, 1),
  (2, 2, '14:00', '17:00', 20, 1),
  (2, 4, '14:00', '17:00', 20, 1),
  (3, 2, '10:00', '14:00', 30, 1),
  (3, 3, '10:00', '14:00', 30, 1),
  (3, 4, '10:00', '14:00', 30, 1),
  (3, 6, '10:00', '14:00', 30, 1),
  (4, 1, '07:00', '11:00', 15, 1),
  (4, 2, '07:00', '11:00', 15, 1),
  (4, 3, '07:00', '11:00', 15, 1),
  (4, 4, '07:00', '11:00', 15, 1),
  (4, 5, '07:00', '11:00', 15, 1),
  (4, 3, '16:00', '19:00', 15, 1),
  (5, 1, '11:00', '15:00', 20, 1),
  (5, 3, '11:00', '15:00', 20, 1),
  (5, 5, '11:00', '15:00', 20, 1),
  (5, 6, '09:00', '12:00', 20, 1),
  (6, 2, '13:00', '18:00', 30, 1),
  (6, 4, '13:00', '18:00', 30, 1),
  (6, 6, '13:00', '18:00', 30, 1),
  (7, 1, '09:30', '13:30', 30, 1),
  (7, 2, '09:30', '13:30', 30, 1),
  (7, 3, '09:30', '13:30', 30, 1),
  (7, 5, '09:30', '13:30', 30, 1),
  (8, 2, '14:00', '18:30', 30, 1),
  (8, 3, '14:00', '18:30', 30, 1),
  (8, 4, '14:00', '18:30', 30, 1),
  (8, 5, '14:00', '18:30', 30, 1);

-- Citas (fechas relativas al día de ejecución del seed)
INSERT INTO citas (medico_id, paciente_id, fecha, hora_inicio, hora_fin, estado, motivo, notas, creada_por) VALUES
  (1, 6, '2026-09-16', '09:00', '09:30', 'confirmada', 'Control de presión arterial', 'Paciente con hipertensión leve', 6),
  (1, 7, '2026-09-16', '10:00', '10:30', 'confirmada', 'Dolor de garganta persistente', NULL, 7),
  (1, 6, '2026-09-09', '09:30', '10:00', 'completada', 'Revisión general anual', 'Se solicitaron estudios de laboratorio', 6),
  (1, 8, '2026-09-02', '11:00', '11:30', 'no_asistio', 'Consulta por fiebre', 'Paciente no se presentó', 8),
  (3, 7, '2026-09-17', '10:30', '11:00', 'confirmada', 'Vacunación infantil', 'Refuerzo de cuadro básico', 7),
  (3, 9, '2026-09-13', '10:00', '10:30', 'completada', 'Control de niño sano', 'Peso y talla dentro de percentiles', 9),
  (4, 8, '2026-09-18', '07:15', '07:30', 'confirmada', 'Electrocardiograma de control', 'Traer estudios previos', 8),
  (4, 10, '2026-09-11', '08:00', '08:15', 'completada', 'Dolor torácico en esfuerzo', 'ECG normal, se recomienda prueba de esfuerzo', 10),
  (5, 9, '2026-09-19', '11:20', '11:40', 'confirmada', 'Dermatitis en manos', NULL, 9),
  (6, 10, '2026-09-20', '13:30', '14:00', 'confirmada', 'Rehabilitación de rodilla', 'Post operatorio semana 4', 10),
  (7, 6, '2026-09-06', '09:30', '10:00', 'completada', 'Control ginecológico anual', 'Sin hallazgos relevantes', 6),
  (8, 7, '2026-09-21', '14:00', '14:30', 'confirmada', 'Seguimiento de arritmia', 'Traer Holter', 7),
  (2, 8, '2026-09-15', '08:20', '08:40', 'cancelada', 'Consulta de seguimiento', 'Cancelada por el paciente', 8),
  (3, 6, '2026-09-22', '11:00', '11:30', 'confirmada', 'Consulta pediátrica de control', NULL, 6);

-- Notificaciones de ejemplo
INSERT INTO notificaciones (usuario_id, cita_id, tipo, canal, asunto, mensaje, leida) VALUES
  (6, 1, 'confirmacion', 'pantalla', 'Cita confirmada', 'Su cita con la Dra. Laura Méndez fue confirmada para hoy a las 09:00.', 0),
  (6, 3, 'recordatorio', 'correo', 'Recordatorio de cita', 'Le recordamos su cita de control. Llegue 10 minutos antes.', 1),
  (7, 5, 'confirmacion', 'pantalla', 'Cita confirmada', 'Su cita de vacunación infantil fue registrada correctamente.', 0),
  (8, 13, 'cancelacion', 'pantalla', 'Cita cancelada', 'Su cita del día de ayer fue cancelada a petición suya.', 1),
  (9, 9, 'recordatorio', 'correo', 'Recordatorio de cita', 'Recuerde su cita de dermatología. Evite aplicar cremas el día previo.', 0);

-- Auditoría inicial
INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle) VALUES (1, 'seed', 'sistema', NULL, 'Carga de datos de ejemplo');
