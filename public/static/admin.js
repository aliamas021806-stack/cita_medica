/* ==================================================================
   Panel RECEPCIONISTA / ADMIN: agenda, citas, médicos, horarios,
   especialidades, pacientes y auditoría.
   ================================================================== */
(function () {
  'use strict';

  const { api, aviso, escapar, hoyISO, fechaLarga, diaSemana, etiquetaEstado,
    limpiarErrores, pintarErrores, ocupado } = window.App;

  const acceso = document.getElementById('acceso-admin');
  const zona = document.getElementById('zona-admin');
  let especialidadesCache = [];
  let medicosCache = [];
  let pacientesCache = [];
  let medicoEnEdicion = null;

  /* ================================================================== */
  /* 1. Autenticación                                                    */
  /* ================================================================== */
  const formLogin = document.getElementById('form-login-admin');

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formLogin);
    const boton = formLogin.querySelector('button[type="submit"]');
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

    if (!email || !password) {
      return pintarErrores(formLogin, {
        general: !email && !password ? 'Indica tu correo y contraseña' : !email ? 'Indica tu correo' : 'Indica tu contraseña',
      });
    }

    ocupado(boton, true, 'Entrando…');
    try {
      const datos = await api('/auth/login', { method: 'POST', body: { email, password } });
      if (!['recepcionista', 'admin'].includes(datos.usuario.rol)) {
        await api('/auth/logout', { method: 'POST' });
        const mensaje =
          datos.usuario.rol === 'medico'
            ? 'Esa cuenta es de médico. Usa el portal del médico.'
            : 'Esa cuenta es de paciente. Usa la vista de reserva.';
        pintarErrores(formLogin, { general: mensaje });
        return aviso(mensaje, 'info');
      }
      window.location.reload();
    } catch (err) {
      pintarErrores(formLogin, { general: err.message });
    } finally {
      ocupado(boton, false);
    }
  });

  document.getElementById('btn-demo-admin').addEventListener('click', () => {
    document.getElementById('admin-email').value = 'recepcion@consultorio.test';
    document.getElementById('admin-password').value = 'Demo1234';
    aviso('Credenciales de recepción cargadas. Pulsa "Entrar al panel".', 'info');
  });

  /* ================================================================== */
  /* 2. Pestañas                                                         */
  /* ================================================================== */
  document.querySelectorAll('.tab-admin').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-admin').forEach((t) => t.classList.remove('tab-activo'));
      tab.classList.add('tab-activo');
      document.querySelectorAll('.panel-admin').forEach((p) => p.classList.add('hidden'));
      document.getElementById('panel-' + tab.dataset.panel).classList.remove('hidden');
      recargarPanel(tab.dataset.panel);
    });
  });

  function recargarPanel(panel) {
    if (panel === 'agenda') {
      cargarMetricas();
      cargarAgendaDia();
      cargarResumenOcupacion();
    } else if (panel === 'citas') buscarCitas();
    else if (panel === 'nueva') prepararPanelNueva();
    else if (panel === 'medicos') cargarMedicos();
    else if (panel === 'especialidades') cargarEspecialidades();
    else if (panel === 'pacientes') cargarPacientes();
    else if (panel === 'auditoria') cargarAuditoria();
  }

  /* ================================================================== */
  /* 3. Agenda del día y métricas                                        */
  /* ================================================================== */
  const campoAgendaFecha = document.getElementById('agenda-fecha');

  document.getElementById('btn-dia-anterior').addEventListener('click', () => moverAgenda(-1));
  document.getElementById('btn-dia-siguiente').addEventListener('click', () => moverAgenda(1));
  campoAgendaFecha.addEventListener('change', () => {
    cargarAgendaDia();
    cargarResumenOcupacion();
  });

  function moverAgenda(delta) {
    const base = campoAgendaFecha.value || hoyISO();
    const d = new Date(base + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    campoAgendaFecha.value = d.toISOString().slice(0, 10);
    cargarAgendaDia();
    cargarResumenOcupacion();
  }

  async function cargarMetricas() {
    const contenedor = document.getElementById('metricas-admin');
    try {
      const d = await api('/admin/dashboard');
      contenedor.innerHTML = `
        ${metrica('Citas hoy', d.hoy.total_citas, 'fa-calendar-day', 'text-marca-600')}
        ${metrica('Activas hoy', d.hoy.activas, 'fa-circle-check', 'text-green-600')}
        ${metrica('Médicos activos', d.total_medicos_activos, 'fa-user-doctor', 'text-sky-600')}
        ${metrica('Pacientes', d.total_pacientes, 'fa-users', 'text-violet-600')}
      `;
    } catch (err) {
      contenedor.innerHTML = '<p class="vacio col-span-full">No se pudieron cargar las métricas.</p>';
    }
  }

  function metrica(titulo, valor, icono, color) {
    return `<article class="metrica">
      <div class="flex items-center justify-between">
        <p class="titulo">${escapar(titulo)}</p>
        <i class="fa-solid ${icono} ${color}" aria-hidden="true"></i>
      </div>
      <p class="valor">${escapar(String(valor))}</p>
    </article>`;
  }

  async function cargarAgendaDia() {
    const contenedor = document.getElementById('listado-agenda-dia');
    const fecha = campoAgendaFecha.value || hoyISO();
    contenedor.innerHTML = '<p class="vacio">Cargando agenda…</p>';
    try {
      const datos = await api('/citas?desde=' + fecha + '&hasta=' + fecha);
      const citas = (datos.citas || []).filter((c) => c.estado !== 'cancelada');
      if (!citas.length) {
        contenedor.innerHTML = `<p class="vacio">Sin citas activas el ${fechaLarga(fecha)} (${diaSemana(fecha)}).</p>`;
        return;
      }
      citas.sort((a, b) => (a.hora_inicio > b.hora_inicio ? 1 : -1));
      contenedor.innerHTML = citas.map(filaAgenda).join('');
      conectarAccionesCita(contenedor);
    } catch (err) {
      contenedor.innerHTML = '<p class="vacio">Error al cargar la agenda.</p>';
      aviso(err.message, 'error');
    }
  }

  function filaAgenda(c) {
    return `
      <article class="tarjeta-cita borde-${c.estado}">
        <div class="flex flex-wrap items-center gap-3">
          <span class="shrink-0 w-16 text-center font-bold text-marca-700">${escapar(c.hora_inicio)}</span>
          <div class="flex-1 min-w-[12rem]">
            <p class="font-semibold">${escapar(c.paciente_nombre)}</p>
            <p class="text-sm text-slate-600">${escapar(c.medico_nombre)} · ${escapar(c.especialidad)}${c.consultorio ? ' · ' + escapar(c.consultorio) : ''}</p>
            <p class="text-xs text-slate-500 mt-0.5">${escapar(c.motivo)}</p>
          </div>
          ${etiquetaEstado(c.estado)}
          <div class="flex flex-wrap gap-1.5">
            ${
              c.estado !== 'completada'
                ? `<button class="btn-secundario btn-mini" data-completar="${c.id}" title="Marcar como completada"><i class="fa-solid fa-check" aria-hidden="true"></i></button>`
                : ''
            }
            ${
              c.estado !== 'no_asistio'
                ? `<button class="btn-secundario btn-mini" data-no-asistio="${c.id}" title="Marcar inasistencia"><i class="fa-solid fa-user-slash" aria-hidden="true"></i></button>`
                : ''
            }
            <button class="btn-secundario btn-mini" data-reprogramar-admin="${c.id}" data-medico="${c.medico_id}" data-fecha="${c.fecha}" title="Reprogramar"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
            <button class="btn-peligro btn-mini" data-cancelar-admin="${c.id}" title="Cancelar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
          </div>
        </div>
      </article>`;
  }

  async function cargarResumenOcupacion() {
    const contenedor = document.getElementById('resumen-ocupacion');
    const fecha = campoAgendaFecha.value || hoyISO();
    contenedor.innerHTML = '<p class="vacio">Calculando ocupación…</p>';
    try {
      const datos = await api('/disponibilidad/resumen?fecha=' + fecha);
      const resumen = datos.resumen || [];
      if (!resumen.length) {
        contenedor.innerHTML = '<p class="vacio">No hay médicos activos.</p>';
        return;
      }
      contenedor.innerHTML = resumen
        .map((m) => {
          const pct = m.total_slots ? Math.round((m.ocupados / m.total_slots) * 100) : 0;
          return `
          <div>
            <div class="flex flex-wrap items-center gap-2 text-sm mb-1">
              <span class="font-medium">${escapar(m.nombre)}</span>
              <span class="text-xs text-slate-500">${escapar(m.especialidad)}</span>
              <span class="ml-auto text-xs text-slate-600">
                ${m.ocupados}/${m.total_slots} ocupados · <span class="text-green-700 font-semibold">${m.libres} libres</span>
              </span>
            </div>
            <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-marca-600" style="width:${pct}%"></div>
            </div>
          </div>`;
        })
        .join('');
    } catch (err) {
      contenedor.innerHTML = '<p class="vacio">Error al calcular la ocupación.</p>';
    }
  }

  /* ================================================================== */
  /* 4. Gestión de citas (filtros + acciones)                            */
  /* ================================================================== */
  const formFiltros = document.getElementById('form-filtros-citas');

  formFiltros.addEventListener('submit', (e) => {
    e.preventDefault();
    buscarCitas();
  });

  document.getElementById('btn-limpiar-filtros').addEventListener('click', () => {
    ['filtro-q', 'filtro-estado', 'filtro-desde', 'filtro-hasta'].forEach((id) => {
      document.getElementById(id).value = '';
    });
    buscarCitas();
  });

  async function buscarCitas() {
    const cuerpo = document.getElementById('cuerpo-tabla-citas');
    cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">Cargando citas…</td></tr>';
    try {
      const params = new URLSearchParams();
      const q = document.getElementById('filtro-q').value.trim();
      const estado = document.getElementById('filtro-estado').value;
      const desde = document.getElementById('filtro-desde').value;
      const hasta = document.getElementById('filtro-hasta').value;
      if (q) params.set('q', q);
      if (estado) params.set('estado', estado);
      if (desde) params.set('desde', desde);
      if (hasta) params.set('hasta', hasta);

      const datos = await api('/citas?' + params.toString());
      const citas = datos.citas || [];
      if (!citas.length) {
        cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">No hay citas con esos filtros.</td></tr>';
        return;
      }
      cuerpo.innerHTML = citas
        .map(
          (c) => `
          <tr>
            <td>${escapar(c.fecha)}<br><span class="text-xs text-slate-500">${escapar(diaSemana(c.fecha).slice(0, 3))}</span></td>
            <td>${escapar(c.hora_inicio)}<br><span class="text-xs text-slate-500">${escapar(c.hora_fin)}</span></td>
            <td>${escapar(c.paciente_nombre)}<br><span class="text-xs text-slate-500">${escapar(c.paciente_email)}</span></td>
            <td>${escapar(c.medico_nombre)}<br><span class="text-xs text-slate-500">${escapar(c.especialidad)}</span></td>
            <td>${etiquetaEstado(c.estado)}</td>
            <td class="text-right whitespace-nowrap">
              ${
                !['cancelada', 'completada', 'no_asistio'].includes(c.estado)
                  ? `<button class="btn-secundario btn-mini" data-reprogramar-admin="${c.id}" data-medico="${c.medico_id}" data-fecha="${c.fecha}" title="Reprogramar"><i class="fa-solid fa-rotate" aria-hidden="true"></i></button>
                     <button class="btn-secundario btn-mini" data-confirmar="${c.id}" title="Confirmar"><i class="fa-solid fa-check" aria-hidden="true"></i></button>
                     <button class="btn-peligro btn-mini" data-cancelar-admin="${c.id}" title="Cancelar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>`
                  : '<span class="text-xs text-slate-400">Sin acciones</span>'
              }
            </td>
          </tr>`,
        )
        .join('');
      conectarAccionesCita(cuerpo);
    } catch (err) {
      cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">Error al cargar las citas.</td></tr>';
      aviso(err.message, 'error');
    }
  }

  /** Conecta botones de acciones sobre cualquier contenedor con citas. */
  function conectarAccionesCita(contenedor) {
    contenedor.querySelectorAll('[data-confirmar]').forEach((b) =>
      b.addEventListener('click', () => cambiarEstado(b.dataset.confirmar, 'confirmada', b)),
    );
    contenedor.querySelectorAll('[data-completar]').forEach((b) =>
      b.addEventListener('click', () => cambiarEstado(b.dataset.completar, 'completada', b)),
    );
    contenedor.querySelectorAll('[data-no-asistio]').forEach((b) =>
      b.addEventListener('click', () => cambiarEstado(b.dataset.noAsistio, 'no_asistio', b)),
    );
    contenedor.querySelectorAll('[data-cancelar-admin]').forEach((b) =>
      b.addEventListener('click', () => cancelarComoAdmin(b.dataset.cancelarAdmin, b)),
    );
    contenedor.querySelectorAll('[data-reprogramar-admin]').forEach((b) =>
      b.addEventListener('click', () => abrirReprogramarAdmin(b.dataset.reprogramarAdmin, b.dataset.medico, b.dataset.fecha)),
    );
  }

  async function cambiarEstado(id, estado, boton) {
    ocupado(boton, true, '…');
    try {
      await api('/citas/' + id + '/estado', { method: 'PATCH', body: { estado } });
      aviso('Estado actualizado a "' + estado + '".', 'exito');
      recargarPanel(panelActiva());
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  }

  async function cancelarComoAdmin(id, boton) {
    const motivo = prompt('Motivo de la cancelación (se notificará al paciente):');
    if (motivo === null) return;
    ocupado(boton, true, '…');
    try {
      await api('/citas/' + id + '/cancelar', { method: 'PATCH', body: { motivo } });
      aviso('Cita cancelada. El paciente fue notificado.', 'exito');
      recargarPanel(panelActiva());
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  }

  function panelActiva() {
    const activo = document.querySelector('.tab-admin.tab-activo');
    return activo ? activo.dataset.panel : 'agenda';
  }

  /* ================================================================== */
  /* 5. Modal reprogramar (admin)                                        */
  /* ================================================================== */
  const modalReprog = document.getElementById('modal-reprogramar-admin');
  const selectReprogMedico = document.getElementById('reprogramar-admin-medico');
  const inputReprogFecha = document.getElementById('reprogramar-admin-fecha');
  const inputReprogHora = document.getElementById('reprogramar-admin-hora');
  const contenedorReprogSlots = document.getElementById('reprogramar-admin-slots');

  async function abrirReprogramarAdmin(citaId, medicoId, fecha) {
    await asegurarMedicos();
    document.getElementById('reprogramar-admin-cita-id').value = citaId;
    inputReprogHora.value = '';
    selectReprogMedico.innerHTML = medicosCache
      .map(
        (m) => `<option value="${m.id}" ${String(m.id) === String(medicoId) ? 'selected' : ''}>
          ${escapar(m.nombre)} — ${escapar(m.especialidad)}</option>`,
      )
      .join('');
    inputReprogFecha.min = hoyISO();
    inputReprogFecha.value = fecha >= hoyISO() ? fecha : hoyISO();
    document.getElementById('reprogramar-admin-motivo').value = '';
    modalReprog.classList.remove('hidden');
    cargarSlotsReprogAdmin();
  }

  async function cargarSlotsReprogAdmin() {
    const medicoId = selectReprogMedico.value;
    const fecha = inputReprogFecha.value;
    if (!medicoId || !fecha) return;
    contenedorReprogSlots.innerHTML = '<p class="col-span-full text-xs text-slate-400">Cargando…</p>';
    try {
      const datos = await api(`/disponibilidad/slots?medico_id=${medicoId}&fecha=${fecha}`);
      const libres = (datos.slots || []).filter((s) => s.disponible);
      if (!libres.length) {
        contenedorReprogSlots.innerHTML =
          '<p class="col-span-full text-xs text-slate-400">Sin horarios libres. Prueba otra fecha.</p>';
        return;
      }
      contenedorReprogSlots.innerHTML = libres
        .map((s) => `<button type="button" class="slot" data-hora="${s.hora_inicio}">${s.hora_inicio}</button>`)
        .join('');
      contenedorReprogSlots.querySelectorAll('.slot').forEach((b) =>
        b.addEventListener('click', () => {
          contenedorReprogSlots.querySelectorAll('.slot').forEach((x) => x.classList.remove('seleccionado'));
          b.classList.add('seleccionado');
          inputReprogHora.value = b.dataset.hora;
        }),
      );
    } catch (err) {
      contenedorReprogSlots.innerHTML = '<p class="col-span-full text-xs text-red-600">Error al cargar horarios.</p>';
    }
  }

  selectReprogMedico.addEventListener('change', cargarSlotsReprogAdmin);
  inputReprogFecha.addEventListener('change', () => {
    inputReprogHora.value = '';
    cargarSlotsReprogAdmin();
  });
  document.getElementById('btn-cerrar-reprogramar-admin').addEventListener('click', () => modalReprog.classList.add('hidden'));
  modalReprog.addEventListener('click', (e) => {
    if (e.target === modalReprog) modalReprog.classList.add('hidden');
  });

  document.getElementById('form-reprogramar-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.target.querySelector('button[type="submit"]');
    const id = document.getElementById('reprogramar-admin-cita-id').value;
    if (!inputReprogHora.value) return aviso('Selecciona un horario disponible.', 'error');

    ocupado(boton, true, 'Reprogramando…');
    try {
      await api('/citas/' + id + '/reprogramar', {
        method: 'PATCH',
        body: {
          medico_id: Number(selectReprogMedico.value),
          fecha: inputReprogFecha.value,
          hora_inicio: inputReprogHora.value,
          motivo: document.getElementById('reprogramar-admin-motivo').value.trim(),
        },
      });
      aviso('Cita reprogramada y paciente notificado.', 'exito');
      modalReprog.classList.add('hidden');
      recargarPanel(panelActiva());
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  });

  /* ================================================================== */
  /* 6. Nueva cita presencial                                            */
  /* ================================================================== */
  async function prepararPanelNueva() {
    await Promise.all([asegurarEspecialidades(), asegurarMedicos(), asegurarPacientes()]);

    const selectPacientes = document.getElementById('nueva-paciente');
    selectPacientes.innerHTML =
      '<option value="">Selecciona un paciente…</option>' +
      pacientesCache
        .filter((p) => p.rol === 'paciente' && p.activo)
        .map((p) => `<option value="${p.id}">${escapar(p.nombre)} — ${escapar(p.email)}</option>`)
        .join('');

    const selectEspecialidades = document.getElementById('nueva-especialidad');
    selectEspecialidades.innerHTML =
      '<option value="">Todas</option>' +
      especialidadesCache.map((es) => `<option value="${es.id}">${escapar(es.nombre)}</option>`).join('');

    pintarSelectMedicos();
    const fecha = document.getElementById('nueva-fecha');
    fecha.min = hoyISO();
    if (!fecha.value) fecha.value = hoyISO();
  }

  function pintarSelectMedicos() {
    const espFiltro = document.getElementById('nueva-especialidad').value;
    const select = document.getElementById('nueva-medico');
    const filtrados = medicosCache.filter((m) => !espFiltro || String(m.especialidad_id) === String(espFiltro));
    select.innerHTML =
      '<option value="">Selecciona un médico…</option>' +
      filtrados.map((m) => `<option value="${m.id}">${escapar(m.nombre)} — ${escapar(m.especialidad)}</option>`).join('');
  }

  document.getElementById('nueva-especialidad').addEventListener('change', pintarSelectMedicos);

  document.getElementById('btn-ver-slots-nueva').addEventListener('click', async () => {
    const medicoId = document.getElementById('nueva-medico').value;
    const fecha = document.getElementById('nueva-fecha').value;
    const contenedor = document.getElementById('slots-nueva-cita');
    if (!medicoId || !fecha) return aviso('Selecciona médico y fecha primero.', 'error');
    contenedor.innerHTML = '<p class="col-span-full text-xs text-slate-400">Cargando…</p>';
    try {
      const datos = await api(`/disponibilidad/slots?medico_id=${medicoId}&fecha=${fecha}`);
      const libres = (datos.slots || []).filter((s) => s.disponible);
      if (!libres.length) {
        contenedor.innerHTML = '<p class="col-span-full text-xs text-slate-400">Sin horarios libres ese día.</p>';
        return;
      }
      contenedor.innerHTML = libres
        .map((s) => `<button type="button" class="slot" data-hora="${s.hora_inicio}">${s.hora_inicio}</button>`)
        .join('');
      contenedor.querySelectorAll('.slot').forEach((b) =>
        b.addEventListener('click', () => {
          contenedor.querySelectorAll('.slot').forEach((x) => x.classList.remove('seleccionado'));
          b.classList.add('seleccionado');
          document.getElementById('nueva-hora').value = b.dataset.hora;
        }),
      );
    } catch (err) {
      contenedor.innerHTML = '<p class="col-span-full text-xs text-red-600">Error al cargar horarios.</p>';
    }
  });

  const formNuevaCita = document.getElementById('form-nueva-cita');
  formNuevaCita.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formNuevaCita);
    const boton = formNuevaCita.querySelector('button[type="submit"]');

    const cuerpo = {
      paciente_id: document.getElementById('nueva-paciente').value,
      medico_id: document.getElementById('nueva-medico').value,
      fecha: document.getElementById('nueva-fecha').value,
      hora_inicio: document.getElementById('nueva-hora').value,
      motivo: document.getElementById('nueva-motivo').value.trim(),
    };

    const errores = {};
    if (!cuerpo.paciente_id) errores.paciente_id = 'Selecciona un paciente';
    if (!cuerpo.medico_id) errores.medico_id = 'Selecciona un médico';
    if (!cuerpo.fecha) errores.fecha = 'Selecciona una fecha';
    if (!cuerpo.hora_inicio) errores.hora_inicio = 'Selecciona una hora';
    if (!cuerpo.motivo || cuerpo.motivo.length < 5) errores.motivo = 'Describe el motivo (mín. 5 caracteres)';
    if (Object.keys(errores).length) return pintarErrores(formNuevaCita, errores);

    ocupado(boton, true, 'Registrando…');
    try {
      await api('/citas', {
        method: 'POST',
        body: {
          paciente_id: Number(cuerpo.paciente_id),
          medico_id: Number(cuerpo.medico_id),
          fecha: cuerpo.fecha,
          hora_inicio: cuerpo.hora_inicio,
          motivo: cuerpo.motivo,
        },
      });
      aviso('Cita registrada. El paciente recibió la confirmación.', 'exito');
      formNuevaCita.reset();
      document.getElementById('nueva-fecha').value = hoyISO();
      document.getElementById('slots-nueva-cita').innerHTML = '';
    } catch (err) {
      pintarErrores(formNuevaCita, err.datos && err.datos.errores ? err.datos.errores : {});
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  });

  /* ================================================================== */
  /* 7. Catálogos en caché                                               */
  /* ================================================================== */
  async function asegurarEspecialidades(forzar) {
    if (especialidadesCache.length && !forzar) return especialidadesCache;
    const datos = await api('/especialidades?incluir_inactivas=1');
    especialidadesCache = datos.especialidades || [];
    return especialidadesCache;
  }

  async function asegurarMedicos(forzar) {
    if (medicosCache.length && !forzar) return medicosCache;
    const datos = await api('/medicos?incluir_inactivos=1');
    medicosCache = datos.medicos || [];
    return medicosCache;
  }

  async function asegurarPacientes() {
    const datos = await api('/admin/usuarios?rol=paciente');
    pacientesCache = datos.usuarios || [];
    return pacientesCache;
  }

  /* ================================================================== */
  /* 8. CRUD de médicos y horarios                                       */
  /* ================================================================== */
  const modalMedico = document.getElementById('modal-medico');
  const formMedico = document.getElementById('form-medico');

  document.getElementById('btn-nuevo-medico').addEventListener('click', () => abrirModalMedico(null));
  document.getElementById('btn-cerrar-modal-medico').addEventListener('click', () => modalMedico.classList.add('hidden'));
  modalMedico.addEventListener('click', (e) => {
    if (e.target === modalMedico) modalMedico.classList.add('hidden');
  });

  async function cargarMedicos() {
    const contenedor = document.getElementById('lista-medicos');
    contenedor.innerHTML = '<p class="vacio">Cargando médicos…</p>';
    try {
      const datos = await api('/medicos?incluir_inactivos=1');
      medicosCache = datos.medicos || [];
      if (!medicosCache.length) {
        contenedor.innerHTML = '<p class="vacio">Aún no hay médicos registrados. Usa "Nuevo médico".</p>';
        return;
      }
      contenedor.innerHTML = medicosCache
        .map(
          (m) => `
          <article class="tarjeta-cita ${m.activo ? '' : 'opacity-60'}">
            <div class="flex flex-wrap items-start gap-3">
              <span class="w-10 h-10 shrink-0 rounded-full bg-marca-50 text-marca-700 flex items-center justify-center" aria-hidden="true">
                <i class="fa-solid fa-user-doctor"></i>
              </span>
              <div class="flex-1 min-w-[12rem]">
                <p class="font-semibold">${escapar(m.nombre)} ${m.activo ? '' : '<span class="etiqueta etiqueta-no_asistio ml-1">Inactivo</span>'}</p>
                <p class="text-sm text-marca-700">${escapar(m.especialidad)}</p>
                <p class="text-xs text-slate-500">
                  ${m.consultorio ? escapar(m.consultorio) + ' · ' : ''}${m.email ? escapar(m.email) : 'sin correo'}
                  ${m.numero_colegiado ? ' · ' + escapar(m.numero_colegiado) : ''}
                </p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <button class="btn-secundario btn-mini" data-editar-medico="${m.id}">
                  <i class="fa-solid fa-pen" aria-hidden="true"></i><span class="ml-1">Editar</span>
                </button>
                <button class="btn-secundario btn-mini" data-ver-horarios="${m.id}">
                  <i class="fa-solid fa-clock" aria-hidden="true"></i><span class="ml-1">Horarios</span>
                </button>
                <button class="btn-secundario btn-mini" data-ver-agenda-medico="${m.id}" data-nombre="${escapar(m.nombre)}">
                  <i class="fa-solid fa-calendar-day" aria-hidden="true"></i><span class="ml-1">Agenda</span>
                </button>
                ${
                  m.activo
                    ? `<button class="btn-peligro btn-mini" data-baja-medico="${m.id}"><i class="fa-solid fa-user-slash" aria-hidden="true"></i><span class="ml-1">Baja</span></button>`
                    : ''
                }
              </div>
            </div>
          </article>`,
        )
        .join('');

      contenedor.querySelectorAll('[data-editar-medico]').forEach((b) =>
        b.addEventListener('click', () => abrirModalMedico(b.dataset.editarMedico)),
      );
      contenedor.querySelectorAll('[data-ver-horarios]').forEach((b) =>
        b.addEventListener('click', () => abrirModalMedico(b.dataset.verHorarios, true)),
      );
      contenedor.querySelectorAll('[data-baja-medico]').forEach((b) =>
        b.addEventListener('click', () => darBajaMedico(b.dataset.bajaMedico, b)),
      );
      contenedor.querySelectorAll('[data-ver-agenda-medico]').forEach((b) =>
        b.addEventListener('click', () => verAgendaMedico(b.dataset.verAgendaMedico, b.dataset.nombre)),
      );
    } catch (err) {
      contenedor.innerHTML = '<p class="vacio">Error al cargar los médicos.</p>';
      aviso(err.message, 'error');
    }
  }

  async function abrirModalMedico(id, soloHorarios) {
    await asegurarEspecialidades(true);
    limpiarErrores(formMedico);

    const select = document.getElementById('medico-especialidad');
    select.innerHTML =
      '<option value="">Selecciona una especialidad…</option>' +
      especialidadesCache
        .filter((es) => es.activo)
        .map((es) => `<option value="${es.id}">${escapar(es.nombre)}</option>`)
        .join('');

    if (id) {
      const datos = await api('/medicos/' + id);
      medicoEnEdicion = datos.medico;
      document.getElementById('titulo-modal-medico').textContent = 'Editar médico';
      document.getElementById('medico-id').value = medicoEnEdicion.id;
      document.getElementById('medico-nombre').value = medicoEnEdicion.nombre || '';
      document.getElementById('medico-especialidad').value = medicoEnEdicion.especialidad_id || '';
      document.getElementById('medico-consultorio').value = medicoEnEdicion.consultorio || '';
      document.getElementById('medico-email').value = medicoEnEdicion.email || '';
      document.getElementById('medico-telefono').value = medicoEnEdicion.telefono || '';
      document.getElementById('medico-colegiado').value = medicoEnEdicion.numero_colegiado || '';
      document.getElementById('medico-bio').value = medicoEnEdicion.bio || '';
      document.getElementById('medico-activo').value = String(medicoEnEdicion.activo);
      document.getElementById('bloque-horarios').classList.remove('hidden');
      await cargarHorarios(medicoEnEdicion.id);
      await cargarResumenMedico(medicoEnEdicion.id);
    } else {
      medicoEnEdicion = null;
      formMedico.reset();
      document.getElementById('titulo-modal-medico').textContent = 'Nuevo médico';
      document.getElementById('medico-id').value = '';
      document.getElementById('medico-activo').value = '1';
      document.getElementById('bloque-horarios').classList.add('hidden');
      document.getElementById('bloque-resumen-medico').classList.add('hidden');
    }

    modalMedico.classList.remove('hidden');
    if (!soloHorarios && !id) document.getElementById('medico-nombre').focus();
    if (soloHorarios) document.getElementById('bloque-horarios').scrollIntoView({ block: 'nearest' });
  }

  formMedico.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formMedico);
    const boton = formMedico.querySelector('button[type="submit"]');
    const id = document.getElementById('medico-id').value;

    const cuerpo = {
      nombre: document.getElementById('medico-nombre').value.trim(),
      especialidad_id: document.getElementById('medico-especialidad').value,
      consultorio: document.getElementById('medico-consultorio').value.trim(),
      email: document.getElementById('medico-email').value.trim(),
      telefono: document.getElementById('medico-telefono').value.trim(),
      numero_colegiado: document.getElementById('medico-colegiado').value.trim(),
      bio: document.getElementById('medico-bio').value.trim(),
      activo: document.getElementById('medico-activo').value === '1',
    };

    const errores = {};
    if (!cuerpo.nombre || cuerpo.nombre.length < 3) errores.nombre = 'El nombre es obligatorio (mín. 3 caracteres)';
    if (!cuerpo.especialidad_id) errores.especialidad_id = 'Selecciona una especialidad';
    if (cuerpo.email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(cuerpo.email))
      errores.email = 'El correo no tiene un formato válido';
    if (Object.keys(errores).length) return pintarErrores(formMedico, errores);

    cuerpo.especialidad_id = Number(cuerpo.especialidad_id);

    ocupado(boton, true, 'Guardando…');
    try {
      if (id) {
        await api('/medicos/' + id, { method: 'PUT', body: cuerpo });
        aviso('Médico actualizado.', 'exito');
      } else {
        await api('/medicos', { method: 'POST', body: cuerpo });
        aviso('Médico creado. Ahora puedes asignar sus horarios.', 'exito');
      }
      await cargarMedicos();
      if (!id) {
        const creado = medicosCache[medicosCache.length - 1];
        if (creado) await abrirModalMedico(creado.id);
      }
    } catch (err) {
      pintarErrores(formMedico, err.datos && err.datos.errores ? err.datos.errores : {});
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  });

  async function cargarHorarios(medicoId) {
    const lista = document.getElementById('lista-horarios');
    lista.innerHTML = '<li class="py-2 text-slate-400">Cargando horarios…</li>';
    try {
      const datos = await api('/horarios?medico_id=' + medicoId);
      const horarios = datos.horarios || [];
      if (!horarios.length) {
        lista.innerHTML =
          '<li class="py-2 text-slate-400">Sin horarios definidos. Añade al menos un bloque para que el médico reciba citas.</li>';
        return;
      }
      lista.innerHTML = horarios
        .map(
          (h) => `
          <li class="py-2 flex items-center gap-2 ${h.activo ? '' : 'opacity-50'}">
            <span class="font-semibold w-24">${escapar(window.App.DIAS[h.dia_semana])}</span>
            <span>${escapar(h.hora_inicio)} – ${escapar(h.hora_fin)}</span>
            <span class="text-xs text-slate-500">${h.duracion_min} min/cita</span>
            <span class="ml-auto flex gap-1.5">
              <button class="btn-secundario btn-mini" data-toggle-horario="${h.id}" data-activo="${h.activo}">
                ${h.activo ? 'Desactivar' : 'Activar'}
              </button>
              <button class="btn-peligro btn-mini" data-borrar-horario="${h.id}">
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
              </button>
            </span>
          </li>`,
        )
        .join('');

      lista.querySelectorAll('[data-toggle-horario]').forEach((b) =>
        b.addEventListener('click', async () => {
          ocupado(b, true, '…');
          try {
            await api('/horarios/' + b.dataset.toggleHorario, {
              method: 'PUT',
              body: { activo: b.dataset.activo === '1' ? false : true },
            });
            await cargarHorarios(medicoId);
          } catch (err) {
            aviso(err.message, 'error');
          }
        }),
      );
      lista.querySelectorAll('[data-borrar-horario]').forEach((b) =>
        b.addEventListener('click', async () => {
          if (!confirm('¿Eliminar este bloque de horario?')) return;
          ocupado(b, true, '…');
          try {
            await api('/horarios/' + b.dataset.borrarHorario, { method: 'DELETE' });
            aviso('Horario eliminado.', 'exito');
            await cargarHorarios(medicoId);
          } catch (err) {
            aviso(err.message, 'error');
          }
        }),
      );
    } catch (err) {
      lista.innerHTML = '<li class="py-2 text-red-600">Error al cargar los horarios.</li>';
    }
  }

  document.getElementById('form-horario').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!medicoEnEdicion) return aviso('Guarda el médico antes de asignar horarios.', 'error');
    const boton = e.target.querySelector('button[type="submit"]');
    const cuerpo = {
      dia_semana: Number(document.getElementById('horario-dia').value),
      hora_inicio: document.getElementById('horario-inicio').value,
      hora_fin: document.getElementById('horario-fin').value,
      duracion_min: Number(document.getElementById('horario-duracion').value),
    };
    if (!cuerpo.hora_inicio || !cuerpo.hora_fin) return aviso('Indica la hora de inicio y de fin.', 'error');
    if (cuerpo.hora_fin <= cuerpo.hora_inicio) return aviso('La hora de fin debe ser posterior a la de inicio.', 'error');

    ocupado(boton, true, 'Añadiendo…');
    try {
      await api('/medicos/' + medicoEnEdicion.id + '/horarios', { method: 'POST', body: cuerpo });
      aviso('Bloque de horario añadido.', 'exito');
      await cargarHorarios(medicoEnEdicion.id);
    } catch (err) {
      if (err.datos && err.datos.errores) {
        aviso(err.datos.errores.hora_inicio || err.datos.errores.dia_semana || err.message, 'error');
      } else {
        aviso(err.message, 'error');
      }
    } finally {
      ocupado(boton, false);
    }
  });

  async function cargarResumenMedico(medicoId) {
    const contenedor = document.getElementById('bloque-resumen-medico');
    try {
      const hoy = hoyISO();
      const datos = await api(`/citas?medico_id=${medicoId}&desde=${hoy}`);
      const citas = datos.citas || [];
      const activas = citas.filter((c) => ['pendiente', 'confirmada'].includes(c.estado));
      contenedor.classList.remove('hidden');
      contenedor.innerHTML = `
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="metrica"><p class="titulo">Citas futuras</p><p class="valor">${activas.length}</p></div>
          <div class="metrica"><p class="titulo">Total registradas</p><p class="valor">${citas.length}</p></div>
          <div class="metrica"><p class="titulo">Canceladas</p><p class="valor">${citas.filter((c) => c.estado === 'cancelada').length}</p></div>
        </div>`;
    } catch (err) {
      contenedor.classList.add('hidden');
    }
  }

  async function darBajaMedico(id, boton) {
    if (!confirm('¿Dar de baja a este médico? Su historial de citas se conserva.')) return;
    ocupado(boton, true, '…');
    try {
      await api('/medicos/' + id, { method: 'DELETE' });
      aviso('Médico dado de baja. Sus horarios quedaron inactivos.', 'exito');
      await cargarMedicos();
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  }

  /** SImple visor de la agenda de un médico (reutiliza la pestaña Agenda). */
  async function verAgendaMedico(medicoId, nombre) {
    document.querySelector('.tab-admin[data-panel="agenda"]').click();
    const filtro = document.getElementById('filtro-q');
    void filtro;
    aviso('Mostrando la agenda general. Filtra por "' + nombre + '" en la pestaña Citas.', 'info');
    const select = document.getElementById('filtro-estado');
    void select;
    document.querySelector('.tab-admin[data-panel="citas"]').click();
    document.getElementById('filtro-q').value = nombre;
    buscarCitas();
  }

  /* ================================================================== */
  /* 9. Especialidades                                                   */
  /* ================================================================== */
  const formEspecialidad = document.getElementById('form-especialidad');

  formEspecialidad.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formEspecialidad);
    const boton = formEspecialidad.querySelector('button[type="submit"]');
    const nombre = document.getElementById('esp-nombre').value.trim();
    const descripcion = document.getElementById('esp-descripcion').value.trim();

    if (!nombre || nombre.length < 3) return pintarErrores(formEspecialidad, { nombre: 'El nombre es obligatorio (mín. 3 caracteres)' });

    ocupado(boton, true, 'Guardando…');
    try {
      await api('/especialidades', { method: 'POST', body: { nombre, descripcion } });
      aviso('Especialidad añadida.', 'exito');
      formEspecialidad.reset();
      await cargarEspecialidades();
    } catch (err) {
      pintarErrores(formEspecialidad, err.datos && err.datos.errores ? err.datos.errores : {});
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  });

  async function cargarEspecialidades() {
    const lista = document.getElementById('lista-especialidades');
    lista.innerHTML = '<li class="py-2 text-slate-400">Cargando…</li>';
    try {
      await asegurarEspecialidades(true);
      lista.innerHTML = especialidadesCache
        .map(
          (es) => `
          <li class="py-3 flex flex-wrap items-center gap-2 ${es.activo ? '' : 'opacity-50'}">
            <div class="flex-1 min-w-[12rem]">
              <p class="font-semibold">${escapar(es.nombre)} ${es.activo ? '' : '<span class="etiqueta etiqueta-no_asistio ml-1">Inactiva</span>'}</p>
              <p class="text-xs text-slate-500">${escapar(es.descripcion || 'Sin descripción')}</p>
            </div>
            <span class="text-xs text-slate-600"><i class="fa-solid fa-user-doctor mr-1" aria-hidden="true"></i>${es.total_medicos} médico(s)</span>
            <div class="flex gap-1.5">
              <button class="btn-secundario btn-mini" data-toggle-esp="${es.id}" data-activo="${es.activo}">
                ${es.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </li>`,
        )
        .join('');

      lista.querySelectorAll('[data-toggle-esp]').forEach((b) =>
        b.addEventListener('click', async () => {
          ocupado(b, true, '…');
          const fila = especialidadesCache.find((x) => String(x.id) === String(b.dataset.toggleEsp));
          try {
            await api('/especialidades/' + b.dataset.toggleEsp, {
              method: 'PUT',
              body: {
                nombre: fila.nombre,
                descripcion: fila.descripcion,
                activo: b.dataset.activo === '1' ? false : true,
              },
            });
            aviso('Especialidad actualizada.', 'exito');
            await cargarEspecialidades();
          } catch (err) {
            aviso(err.message, 'error');
          } finally {
            ocupado(b, false);
          }
        }),
      );
    } catch (err) {
      lista.innerHTML = '<li class="py-2 text-red-600">Error al cargar especialidades.</li>';
    }
  }

  /* ================================================================== */
  /* 10. Pacientes                                                       */
  /* ================================================================== */
  let temporizadorPacientes = null;

  document.getElementById('buscar-pacientes').addEventListener('input', () => {
    clearTimeout(temporizadorPacientes);
    temporizadorPacientes = setTimeout(cargarPacientes, 300);
  });

  async function cargarPacientes() {
    const cuerpo = document.getElementById('cuerpo-tabla-pacientes');
    const q = document.getElementById('buscar-pacientes').value.trim();
    cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">Cargando pacientes…</td></tr>';
    try {
      const datos = await api('/admin/usuarios?rol=paciente' + (q ? '&q=' + encodeURIComponent(q) : ''));
      pacientesCache = datos.usuarios || [];
      if (!pacientesCache.length) {
        cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">No se encontraron pacientes.</td></tr>';
        return;
      }
      cuerpo.innerHTML = pacientesCache
        .map(
          (p) => `
          <tr>
            <td>${escapar(p.nombre)}</td>
            <td>${escapar(p.email)}<br><span class="text-xs text-slate-500">${escapar(p.telefono || 'sin teléfono')}</span></td>
            <td>${escapar(p.documento || '—')}</td>
            <td>${escapar(String(p.total_citas))}</td>
            <td>${p.activo ? '<span class="etiqueta etiqueta-confirmada">Activo</span>' : '<span class="etiqueta etiqueta-no_asistio">Inactivo</span>'}</td>
            <td class="text-right whitespace-nowrap">
              <button class="btn-secundario btn-mini" data-historial="${p.id}" data-nombre="${escapar(p.nombre)}">
                <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span class="ml-1">Historial</span>
              </button>
              <button class="btn-secundario btn-mini" data-toggle-paciente="${p.id}" data-activo="${p.activo}">
                ${p.activo ? 'Desactivar' : 'Activar'}
              </button>
            </td>
          </tr>`,
        )
        .join('');

      cuerpo.querySelectorAll('[data-toggle-paciente]').forEach((b) =>
        b.addEventListener('click', async () => {
          ocupado(b, true, '…');
          try {
            await api('/admin/usuarios/' + b.dataset.togglePaciente + '/estado', {
              method: 'PATCH',
              body: { activo: b.dataset.activo === '1' ? false : true },
            });
            aviso('Estado del paciente actualizado.', 'exito');
            await cargarPacientes();
          } catch (err) {
            aviso(err.message, 'error');
          } finally {
            ocupado(b, false);
          }
        }),
      );
      cuerpo.querySelectorAll('[data-historial]').forEach((b) =>
        b.addEventListener('click', () => verHistorialPaciente(b.dataset.historial, b.dataset.nombre)),
      );
    } catch (err) {
      cuerpo.innerHTML = '<tr><td colspan="6" class="vacio">Error al cargar pacientes.</td></tr>';
    }
  }

  async function verHistorialPaciente(id, nombre) {
    try {
      const datos = await api('/citas/historial/' + id);
      const todas = [...(datos.futuras || []), ...(datos.pasadas || [])];
      const detalle = todas.length
        ? todas
            .slice(0, 25)
            .map(
              (c) =>
                `${c.fecha} ${c.hora_inicio} · ${c.medico_nombre} · ${c.estado}${c.motivo ? ' · ' + c.motivo : ''}`,
            )
            .join('\n')
        : 'Sin citas registradas.';
      alert(
        `Historial de ${nombre}\n\n` +
          `Total: ${datos.estadisticas.total} | Completadas: ${datos.estadisticas.completadas} | ` +
          `Canceladas: ${datos.estadisticas.canceladas} | No asistió: ${datos.estadisticas.no_asistio}\n\n` +
          detalle,
      );
    } catch (err) {
      aviso(err.message, 'error');
    }
  }

  /* ================================================================== */
  /* 11. Auditoría                                                       */
  /* ================================================================== */
  async function cargarAuditoria() {
    const cuerpo = document.getElementById('cuerpo-tabla-auditoria');
    cuerpo.innerHTML = '<tr><td colspan="5" class="vacio">Cargando auditoría…</td></tr>';
    try {
      const datos = await api('/admin/auditoria?limite=150');
      const registros = datos.auditoria || [];
      if (!registros.length) {
        cuerpo.innerHTML = '<tr><td colspan="5" class="vacio">Sin registros.</td></tr>';
        return;
      }
      cuerpo.innerHTML = registros
        .map(
          (a) => `
          <tr>
            <td class="whitespace-nowrap text-xs">${escapar(String(a.created_at).replace('T', ' ').slice(0, 16))}</td>
            <td>${a.usuario_nombre ? escapar(a.usuario_nombre) : '<span class="text-slate-400">sistema</span>'}
                <br><span class="text-xs text-slate-500">${escapar(a.usuario_rol || '—')}</span></td>
            <td><code class="text-xs bg-slate-100 px-1.5 py-0.5 rounded">${escapar(a.accion)}</code></td>
            <td class="text-xs">${escapar(a.entidad || '—')}${a.entidad_id ? ' #' + a.entidad_id : ''}</td>
            <td class="text-xs text-slate-500 max-w-[16rem] truncate" title="${escapar(a.detalle || '')}">${escapar(a.detalle || '—')}</td>
          </tr>`,
        )
        .join('');
    } catch (err) {
      cuerpo.innerHTML = '<tr><td colspan="5" class="vacio">Error al cargar la auditoría.</td></tr>';
    }
  }

  /* ================================================================== */
  /* 12. Arranque                                                        */
  /* ================================================================== */
  (async function init() {
    const sesion = window.App.getSesion();

    if (!sesion || !['recepcionista', 'admin'].includes(sesion.rol)) {
      if (sesion) {
        aviso(
          'Tu cuenta es de ' +
            sesion.rol +
            '. Este panel es exclusivo de recepción y administración.',
          'info',
        );
      }
      return;
    }

    acceso.classList.add('hidden');
    zona.classList.remove('hidden');

    campoAgendaFecha.value = hoyISO();
    await cargarMetricas();
    await cargarAgendaDia();
    await cargarResumenOcupacion();
  })();
})();