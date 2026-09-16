/* ==================================================================
   Vista PACIENTE: registro, login, búsqueda de disponibilidad,
   reserva, cancelación y reprogramación de citas.
   ================================================================== */
(function () {
  'use strict';

  const { api, aviso, escapar, hoyISO, fechaLarga, diaSemana, etiquetaEstado,
    limpiarErrores, pintarErrores, ocupado, validarRegistro } = window.App;

  const seccionAuth = document.getElementById('seccion-autenticacion');
  const zonaPaciente = document.getElementById('zona-paciente');
  const estadoBusqueda = document.getElementById('estado-busqueda');
  const listaDisponibilidad = document.getElementById('lista-disponibilidad');
  let tabCitasActiva = 'futuras';

  /* ================================================================== */
  /* 1. Autenticación                                                    */
  /* ================================================================== */
  const formLogin = document.getElementById('form-login');
  const formRegistro = document.getElementById('form-registro');

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formLogin);
    const boton = formLogin.querySelector('button[type="submit"]');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errores = {};
    if (!email) errores.email = 'El correo es obligatorio';
    if (!password) errores.password = 'La contraseña es obligatoria';
    if (Object.keys(errores).length) return pintarErrores(formLogin, errores);

    ocupado(boton, true, 'Entrando…');
    try {
      const datos = await api('/auth/login', { method: 'POST', body: { email, password } });
      if (datos.usuario.rol !== 'paciente') {
        aviso('Esa cuenta es de ' + datos.usuario.rol + '. Usa el panel correspondiente.', 'info');
        await api('/auth/logout', { method: 'POST' });
        return;
      }
      window.location.reload();
    } catch (err) {
      pintarErrores(formLogin, err.datos && err.datos.errores ? err.datos.errores : { email: err.message });
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  });

  formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formRegistro);
    const boton = formRegistro.querySelector('button[type="submit"]');
    const datos = {
      nombre: document.getElementById('reg-nombre').value.trim(),
      email: document.getElementById('reg-email').value.trim(),
      telefono: document.getElementById('reg-telefono').value.trim(),
      password: document.getElementById('reg-password').value,
    };
    const errores = validarRegistro(datos);
    if (Object.keys(errores).length) return pintarErrores(formRegistro, errores);

    ocupado(boton, true, 'Creando cuenta…');
    try {
      await api('/auth/registro', { method: 'POST', body: datos });
      aviso('¡Cuenta creada! Ya puedes reservar tu cita.', 'exito');
      window.location.reload();
    } catch (err) {
      pintarErrores(formRegistro, err.datos && err.datos.errores ? err.datos.errores : {});
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  });

  document.getElementById('btn-demo-paciente').addEventListener('click', () => {
    document.getElementById('login-email').value = 'paciente@consultorio.test';
    document.getElementById('login-password').value = 'Demo1234';
    aviso('Credenciales de paciente de prueba cargadas. Pulsa "Entrar".', 'info');
  });

  /* ================================================================== */
  /* 2. Catálogos                                                        */
  /* ================================================================== */
  async function cargarEspecialidades() {
    try {
      const datos = await api('/especialidades');
      const select = document.getElementById('busqueda-especialidad');
      select.innerHTML =
        '<option value="">Todas las especialidades</option>' +
        datos.especialidades
          .map((e) => `<option value="${e.id}">${escapar(e.nombre)} (${e.total_medicos})</option>`)
          .join('');
    } catch (err) {
      aviso('No se pudieron cargar las especialidades.', 'error');
    }
  }

  function prepararFechas() {
    const campo = document.getElementById('busqueda-fecha');
    campo.min = hoyISO();
    if (!campo.value) campo.value = hoyISO();
  }

  /* ================================================================== */
  /* 3. Búsqueda de disponibilidad                                       */
  /* ================================================================== */
  const formBusqueda = document.getElementById('form-busqueda');

  formBusqueda.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = formBusqueda.querySelector('button[type="submit"]');
    const especialidad = document.getElementById('busqueda-especialidad').value;
    const q = document.getElementById('busqueda-medico').value.trim();
    const fecha = document.getElementById('busqueda-fecha').value;
    const dias = document.getElementById('busqueda-dias').value;

    if (!fecha) return aviso('Selecciona una fecha para buscar.', 'error');
    if (fecha < hoyISO()) return aviso('No puedes buscar disponibilidad en fechas pasadas.', 'error');

    ocupado(boton, true, 'Buscando…');
    estadoBusqueda.innerHTML = '<span class="cargando" style="border-top-color:#2563eb;border-color:rgba(37,99,235,.3)"></span> Consultando agenda…';
    try {
      const params = new URLSearchParams();
      if (especialidad) params.set('especialidad_id', especialidad);
      if (q) params.set('q', q);
      params.set('fecha', fecha);
      params.set('dias', dias);
      const datos = await api('/disponibilidad/medicos?' + params.toString());
      pintarDisponibilidad(datos, { fecha, dias });
    } catch (err) {
      estadoBusqueda.textContent = '';
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  });

  function pintarDisponibilidad(datos, parametros) {
    const medicos = datos.medicos || [];
    const conCupo = medicos.filter((m) => m.total_slots_libres > 0);

    if (!medicos.length) {
      estadoBusqueda.textContent = 'No se encontraron médicos con esos criterios.';
      listaDisponibilidad.innerHTML =
        '<p class="vacio">Prueba quitando filtros o cambiando la especialidad.</p>';
      return;
    }
    if (!conCupo.length) {
      estadoBusqueda.textContent =
        `${medicos.length} médico(s) encontrados, pero sin horarios libres entre ${fechaLarga(parametros.fecha)} y ${parametros.dias} día(s).`;
      listaDisponibilidad.innerHTML =
        '<p class="vacio">Intenta con otra fecha u otro médico.</p>';
      return;
    }

    estadoBusqueda.textContent = `${conCupo.length} médico(s) con disponibilidad desde ${fechaLarga(parametros.fecha)}.`;

    listaDisponibilidad.innerHTML = conCupo
      .map((m) => {
        const dias = m.dias_con_disponibilidad || [];
        return `
        <article class="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col"
                 data-medico="${m.id}" data-nombre="${escapar(m.nombre)}" data-especialidad="${escapar(m.especialidad)}">
          <header class="flex gap-3 mb-3">
            <span class="w-11 h-11 shrink-0 rounded-full bg-marca-50 text-marca-700 flex items-center justify-center text-lg" aria-hidden="true">
              <i class="fa-solid fa-user-doctor"></i>
            </span>
            <div class="min-w-0">
              <h3 class="font-semibold leading-tight">${escapar(m.nombre)}</h3>
              <p class="text-sm text-marca-700 font-medium">${escapar(m.especialidad)}</p>
              <p class="text-xs text-slate-500">${m.consultorio ? escapar(m.consultorio) : 'Consultorio por asignar'}</p>
            </div>
          </header>
          ${m.bio ? `<p class="text-xs text-slate-500 mb-3">${escapar(m.bio)}</p>` : ''}

          <p class="text-xs font-semibold text-slate-600 mb-2">
            <i class="fa-solid fa-calendar-days mr-1" aria-hidden="true"></i>
            ${m.total_slots_libres} horario(s) libre(s) · elige una fecha
          </p>
          <div class="flex flex-wrap gap-2 mb-3" data-dias>
            ${dias
              .map(
                (d) => `<button type="button" class="btn-secundario btn-mini" data-fecha="${d.fecha}">
                  <span class="font-semibold">${diaSemana(d.fecha).slice(0, 3)} ${d.fecha.slice(8)}</span>
                  <span class="text-[10px] text-slate-500 ml-1">${d.slots_libres} libres</span>
                </button>`,
              )
              .join('')}
          </div>

          <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3" data-slots>
            <p class="col-span-full text-xs text-slate-400">Selecciona una fecha para ver los horarios.</p>
          </div>

          <label class="block text-sm font-medium mb-1" for="motivo-${m.id}">Motivo de la consulta</label>
          <textarea id="motivo-${m.id}" data-motivo rows="2" class="campo mb-1"
                    placeholder="Describe brevemente el motivo de tu consulta"></textarea>
          <p class="error-campo" data-error="motivo"></p>

          <button type="button" class="btn-primario mt-2 w-full" data-reservar disabled>
            <i class="fa-solid fa-calendar-check mr-2" aria-hidden="true"></i>Reservar cita
          </button>
          <p class="text-[11px] text-slate-400 mt-2">
            La confirmación es inmediata. Podrás cancelar o reprogramar hasta 24 h antes.
          </p>
        </article>`;
      })
      .join('');

    listaDisponibilidad.querySelectorAll('article[data-medico]').forEach(conectarTarjetaMedico);
  }

  /** Conecta los eventos de una tarjeta de médico (días, slots, reservar). */
  function conectarTarjetaMedico(tarjeta) {
    const medicoId = tarjeta.dataset.medico;
    const contenedorSlots = tarjeta.querySelector('[data-slots]');
    const botonReservar = tarjeta.querySelector('[data-reservar]');
    let horaSeleccionada = null;

    tarjeta.querySelectorAll('[data-dias] button').forEach((btn) => {
      btn.addEventListener('click', async () => {
        tarjeta.querySelectorAll('[data-dias] button').forEach((b) => b.classList.remove('btn-primario'));
        btn.classList.add('btn-primario');
        horaSeleccionada = null;
        botonReservar.disabled = true;
        contenedorSlots.innerHTML = '<p class="col-span-full text-xs text-slate-400">Cargando horarios…</p>';
        try {
          const datos = await api(
            `/disponibilidad/slots?medico_id=${medicoId}&fecha=${btn.dataset.fecha}`,
          );
          pintarSlotsReserva(contenedorSlots, datos, (hora) => {
            horaSeleccionada = hora;
            tarjeta.dataset.fecha = btn.dataset.fecha;
            tarjeta.dataset.hora = hora;
            botonReservar.disabled = false;
          });
          tarjeta.dataset.fechaActiva = btn.dataset.fecha;
        } catch (err) {
          contenedorSlots.innerHTML = '<p class="col-span-full text-xs text-red-600">No se pudieron cargar los horarios.</p>';
          aviso(err.message, 'error');
        }
      });
    });

    botonReservar.addEventListener('click', async () => {
      const motivo = tarjeta.querySelector('[data-motivo]').value.trim();
      const errorMotivo = tarjeta.querySelector('[data-error="motivo"]');
      errorMotivo.textContent = '';
      if (motivo.length < 5) {
        errorMotivo.textContent = 'Describe el motivo con al menos 5 caracteres';
        tarjeta.querySelector('[data-motivo]').focus();
        return;
      }
      if (!horaSeleccionada) return aviso('Selecciona un horario disponible.', 'error');

      ocupado(botonReservar, true, 'Reservando…');
      try {
        await api('/citas', {
          method: 'POST',
          body: {
            medico_id: Number(medicoId),
            fecha: tarjeta.dataset.fechaActiva,
            hora_inicio: horaSeleccionada,
            motivo,
          },
        });
        aviso(
          `Cita reservada con ${tarjeta.dataset.nombre} el ${fechaLarga(tarjeta.dataset.fechaActiva)} a las ${horaSeleccionada}. Te enviamos un recordatorio.`,
          'exito',
        );
        window.App.cargarNotificaciones();
        cargarRecordatorios();
        await cargarMisCitas();
        formBusqueda.dispatchEvent(new Event('submit'));
      } catch (err) {
        aviso(err.message, 'error');
        if (err.status === 409) formBusqueda.dispatchEvent(new Event('submit'));
      } finally {
        ocupado(botonReservar, false);
      }
    });
  }

  /** Dibuja los slots; los no disponibles quedan deshabilitados. */
  function pintarSlotsReserva(contenedor, datos, alSeleccionar) {
    const slots = datos.slots || [];
    if (!slots.length) {
      contenedor.innerHTML =
        '<p class="col-span-full text-xs text-slate-400">El médico no atiende ese día.</p>';
      return;
    }
    contenedor.innerHTML = slots
      .map((s) => {
        const titulo = s.motivo === 'ocupado' ? 'Ocupado' : s.motivo === 'pasado' ? 'Hora pasada' : 'Disponible';
        return `<button type="button" class="slot" data-hora="${s.hora_inicio}"
          ${s.disponible ? '' : 'disabled'} title="${titulo}">${s.hora_inicio}</button>`;
      })
      .join('');

    contenedor.querySelectorAll('.slot:not(:disabled)').forEach((btn) => {
      btn.addEventListener('click', () => {
        contenedor.querySelectorAll('.slot').forEach((b) => b.classList.remove('seleccionado'));
        btn.classList.add('seleccionado');
        alSeleccionar(btn.dataset.hora);
      });
    });
  }

  /* ================================================================== */
  /* 4. Recordatorios de citas próximas (RF7)                            */
  /* ================================================================== */
  async function cargarRecordatorios() {
    const tarjeta = document.getElementById('tarjeta-recordatorios');
    const lista = document.getElementById('lista-recordatorios');
    try {
      const datos = await api('/citas/proximas');
      const citas = datos.citas || [];
      if (!citas.length) {
        tarjeta.classList.add('hidden');
        return;
      }
      tarjeta.classList.remove('hidden');
      lista.innerHTML = citas
        .map(
          (c) => `
          <li class="flex flex-wrap items-center gap-2 bg-white/70 rounded-xl px-3 py-2">
            <i class="fa-solid ${c.es_inminente ? 'fa-bell text-amber-600' : 'fa-calendar-day text-slate-400'}" aria-hidden="true"></i>
            <span class="font-semibold text-sm">${escapar(c.etiqueta)} · ${escapar(c.hora_inicio)}</span>
            <span class="text-sm text-slate-600">${escapar(c.medico_nombre)} (${escapar(c.especialidad)})</span>
            ${etiquetaEstado(c.estado)}
          </li>`,
        )
        .join('');
    } catch (err) {
      tarjeta.classList.add('hidden');
    }
  }

  /* ================================================================== */
  /* 5. Mis citas: futuras e historial (RF8)                             */
  /* ================================================================== */
  document.querySelectorAll('.tab-citas').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-citas').forEach((t) => t.classList.remove('tab-activo'));
      tab.classList.add('tab-activo');
      tabCitasActiva = tab.dataset.tab;
      cargarMisCitas();
    });
  });

  async function cargarMisCitas() {
    const contenedor = document.getElementById('lista-mis-citas');
    const sesion = window.App.getSesion();
    if (!sesion) return;
    contenedor.innerHTML = '<p class="vacio">Cargando tus citas…</p>';

    try {
      const datos = await api('/citas/historial/' + sesion.id);
      const citas = tabCitasActiva === 'futuras' ? datos.futuras : datos.pasadas;

      if (!citas.length) {
        contenedor.innerHTML =
          '<p class="vacio">' +
          (tabCitasActiva === 'futuras'
            ? 'No tienes citas programadas. Busca disponibilidad arriba para reservar.'
            : 'Todavía no tienes citas en tu historial.') +
          '</p>';
        return;
      }

      contenedor.innerHTML = citas.map(tarjetaMiCita).join('');
      conectarAccionesMiCita(contenedor, datos.limite_cancelacion_horas);
    } catch (err) {
      contenedor.innerHTML = '<p class="vacio">No se pudieron cargar tus citas.</p>';
      aviso(err.message, 'error');
    }
  }

  function tarjetaMiCita(c) {
    const esFutura = tabCitasActiva === 'futuras';
    const puedeGestionar = esFutura && ['pendiente', 'confirmada'].includes(c.estado);
    return `
      <article class="tarjeta-cita borde-${c.estado}">
        <div class="flex flex-wrap items-start gap-3">
          <div class="w-14 shrink-0 text-center rounded-xl bg-slate-50 border border-slate-200 py-1.5">
            <p class="text-[10px] uppercase text-slate-500 font-semibold">${escapar(diaSemana(c.fecha).slice(0, 3))}</p>
            <p class="text-lg font-bold leading-none">${escapar(c.fecha.slice(8))}</p>
            <p class="text-[10px] text-slate-500">${escapar(c.fecha.slice(0, 7))}</p>
          </div>
          <div class="flex-1 min-w-[11rem]">
            <p class="font-semibold">${escapar(c.hora_inicio)} – ${escapar(c.hora_fin)} · ${escapar(c.medico_nombre)}</p>
            <p class="text-sm text-marca-700">${escapar(c.especialidad)}${c.consultorio ? ' · ' + escapar(c.consultorio) : ''}</p>
            <p class="text-sm text-slate-600 mt-1"><i class="fa-solid fa-notes-medical mr-1 text-slate-400" aria-hidden="true"></i>${escapar(c.motivo)}</p>
            ${c.notas ? `<p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-comment-medical mr-1" aria-hidden="true"></i>${escapar(c.notas)}</p>` : ''}
            ${c.estado === 'cancelada' && c.motivo_cancelacion ? `<p class="text-xs text-red-600 mt-1">Motivo de cancelación: ${escapar(c.motivo_cancelacion)}</p>` : ''}
          </div>
          <div class="flex flex-col items-end gap-2">
            ${etiquetaEstado(c.estado)}
            ${
              puedeGestionar
                ? `<div class="flex gap-1.5">
                     <button class="btn-secundario btn-mini" data-reprogramar="${c.id}"
                             data-medico="${c.medico_id}" data-fecha="${c.fecha}">
                       <i class="fa-solid fa-rotate" aria-hidden="true"></i><span class="ml-1">Reprogramar</span>
                     </button>
                     <button class="btn-peligro btn-mini" data-cancelar="${c.id}">
                       <i class="fa-solid fa-xmark" aria-hidden="true"></i><span class="ml-1">Cancelar</span>
                     </button>
                   </div>`
                : ''
            }
          </div>
        </div>
      </article>`;
  }

  function conectarAccionesMiCita(contenedor, limiteHoras) {
    contenedor.querySelectorAll('[data-cancelar]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.cancelar;
        if (!confirm('¿Confirmas la cancelación de esta cita?')) return;
        const motivo = prompt('Motivo de la cancelación (opcional):') || '';
        ocupado(btn, true, '…');
        try {
          await api('/citas/' + id + '/cancelar', { method: 'PATCH', body: { motivo } });
          aviso('Cita cancelada correctamente.', 'exito');
          await cargarMisCitas();
          cargarRecordatorios();
          window.App.cargarNotificaciones();
        } catch (err) {
          if (err.datos && err.datos.codigo === 'LIMITE_24H') {
            aviso(err.message, 'error');
          } else {
            aviso(err.message, 'error');
          }
        } finally {
          ocupado(btn, false);
        }
      });
    });

    contenedor.querySelectorAll('[data-reprogramar]').forEach((btn) => {
      btn.addEventListener('click', () => abrirModalReprogramar(btn.dataset, limiteHoras));
    });
  }

  /* ================================================================== */
  /* 6. Modal de reprogramación                                          */
  /* ================================================================== */
  const modal = document.getElementById('modal-reprogramar');
  const formReprogramar = document.getElementById('form-reprogramar');
  const selectMedicoReprog = document.getElementById('reprogramar-medico');
  const inputFechaReprog = document.getElementById('reprogramar-fecha');
  const contenedorSlotsReprog = document.getElementById('reprogramar-slots');
  const inputHoraReprog = document.getElementById('reprogramar-hora');
  let medicosCache = null;

  async function abrirModalReprogramar(datos, limiteHoras) {
    document.getElementById('reprogramar-cita-id').value = datos.reprogramar;
    inputHoraReprog.value = '';
    contenedorSlotsReprog.innerHTML =
      '<p class="col-span-full text-xs text-slate-400">Selecciona médico y fecha.</p>';

    if (!medicosCache) {
      try {
        const res = await api('/medicos');
        medicosCache = res.medicos;
      } catch (err) {
        medicosCache = [];
      }
    }
    selectMedicoReprog.innerHTML = medicosCache
      .map(
        (m) => `<option value="${m.id}" ${String(m.id) === String(datos.medico) ? 'selected' : ''}>
          ${escapar(m.nombre)} — ${escapar(m.especialidad)}</option>`,
      )
      .join('');

    inputFechaReprog.min = hoyISO();
    inputFechaReprog.value = datos.fecha >= hoyISO() ? datos.fecha : hoyISO();

    const avisoLimite = document.getElementById('reprogramar-motivo');
    avisoLimite.placeholder = `Recuerda: puedes reprogramar hasta ${limiteHoras || 24} h antes de tu cita.`;

    modal.classList.remove('hidden');
    cargarSlotsReprogramar();
  }

  async function cargarSlotsReprogramar() {
    const medicoId = selectMedicoReprog.value;
    const fecha = inputFechaReprog.value;
    if (!medicoId || !fecha) return;
    contenedorSlotsReprog.innerHTML = '<p class="col-span-full text-xs text-slate-400">Cargando…</p>';
    try {
      const datos = await api(`/disponibilidad/slots?medico_id=${medicoId}&fecha=${fecha}`);
      const libres = (datos.slots || []).filter((s) => s.disponible);
      if (!libres.length) {
        contenedorSlotsReprog.innerHTML =
          '<p class="col-span-full text-xs text-slate-400">Sin horarios libres ese día. Prueba otra fecha.</p>';
        return;
      }
      contenedorSlotsReprog.innerHTML = libres
        .map((s) => `<button type="button" class="slot" data-hora="${s.hora_inicio}">${s.hora_inicio}</button>`)
        .join('');
      contenedorSlotsReprog.querySelectorAll('.slot').forEach((btn) => {
        btn.addEventListener('click', () => {
          contenedorSlotsReprog.querySelectorAll('.slot').forEach((b) => b.classList.remove('seleccionado'));
          btn.classList.add('seleccionado');
          inputHoraReprog.value = btn.dataset.hora;
        });
      });
    } catch (err) {
      contenedorSlotsReprog.innerHTML = '<p class="col-span-full text-xs text-red-600">Error al cargar horarios.</p>';
    }
  }

  selectMedicoReprog.addEventListener('change', cargarSlotsReprogramar);
  inputFechaReprog.addEventListener('change', () => {
    inputHoraReprog.value = '';
    cargarSlotsReprogramar();
  });

  document.getElementById('btn-cancelar-reprogramar').addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.add('hidden');
  });

  formReprogramar.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = formReprogramar.querySelector('button[type="submit"]');
    const id = document.getElementById('reprogramar-cita-id').value;
    if (!inputHoraReprog.value) return aviso('Selecciona un horario disponible.', 'error');

    ocupado(boton, true, 'Reprogramando…');
    try {
      await api('/citas/' + id + '/reprogramar', {
        method: 'PATCH',
        body: {
          medico_id: Number(selectMedicoReprog.value),
          fecha: inputFechaReprog.value,
          hora_inicio: inputHoraReprog.value,
          motivo: document.getElementById('reprogramar-motivo').value.trim(),
        },
      });
      aviso('Cita reprogramada correctamente.', 'exito');
      modal.classList.add('hidden');
      await cargarMisCitas();
      cargarRecordatorios();
      window.App.cargarNotificaciones();
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  });

  /* ================================================================== */
  /* 7. Arranque según el estado de sesión                               */
  /* ================================================================== */
  (async function init() {
    await cargarEspecialidades();
    prepararFechas();

    const sesion = window.App.getSesion();
    if (!sesion || sesion.rol !== 'paciente') {
      if (sesion && sesion.rol !== 'paciente') {
        aviso(
          'Has iniciado sesión como ' + sesion.rol + '. Usa el panel de recepción o el portal del médico.',
          'info',
        );
      }
      return;
    }

    seccionAuth.classList.add('hidden');
    zonaPaciente.classList.remove('hidden');
    document.getElementById('saludo-paciente').textContent = 'Hola, ' + sesion.nombre.split(' ')[0];

    await cargarRecordatorios();
    await cargarMisCitas();
  })();
})();