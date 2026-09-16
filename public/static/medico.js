/* ==================================================================
   Portal del MÉDICO: agenda del día e historial de pacientes.
   ================================================================== */
(function () {
  'use strict';

  const { api, aviso, escapar, hoyISO, fechaLarga, diaSemana, etiquetaEstado,
    limpiarErrores, pintarErrores, ocupado } = window.App;

  const acceso = document.getElementById('acceso-medico');
  const zona = document.getElementById('zona-medico');
  const campoFecha = document.getElementById('medico-agenda-fecha');

  /* ================================================================== */
  /* 1. Autenticación                                                    */
  /* ================================================================== */
  const formLogin = document.getElementById('form-login-medico');

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    limpiarErrores(formLogin);
    const boton = formLogin.querySelector('button[type="submit"]');
    const email = document.getElementById('medico-login-email').value.trim();
    const password = document.getElementById('medico-login-password').value;

    if (!email || !password) {
      return pintarErrores(formLogin, { general: 'Indica tu correo y contraseña' });
    }

    ocupado(boton, true, 'Entrando…');
    try {
      const datos = await api('/auth/login', { method: 'POST', body: { email, password } });
      if (datos.usuario.rol !== 'medico') {
        await api('/auth/logout', { method: 'POST' });
        const mensaje =
          datos.usuario.rol === 'paciente'
            ? 'Esa cuenta es de paciente. Usa la vista de reserva.'
            : 'Esa cuenta es de recepción. Usa el panel de administración.';
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

  document.getElementById('btn-demo-medico').addEventListener('click', () => {
    document.getElementById('medico-login-email').value = 'laura.mendez@consultorio.test';
    document.getElementById('medico-login-password').value = 'Demo1234';
    aviso('Credenciales de médico cargadas. Pulsa "Entrar".', 'info');
  });

  /* ================================================================== */
  /* 2. Pestañas                                                         */
  /* ================================================================== */
  document.querySelectorAll('.tab-medico').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-medico').forEach((t) => t.classList.remove('tab-activo'));
      tab.classList.add('tab-activo');
      document.querySelectorAll('.panel-medico').forEach((p) => p.classList.add('hidden'));
      document.getElementById('panel-' + tab.dataset.panel).classList.remove('hidden');
      if (tab.dataset.panel === 'pacientes-medico') cargarMisPacientes();
    });
  });

  /* ================================================================== */
  /* 3. Agenda del día                                                   */
  /* ================================================================== */
  document.getElementById('btn-medico-dia-anterior').addEventListener('click', () => moverDia(-1));
  document.getElementById('btn-medico-dia-siguiente').addEventListener('click', () => moverDia(1));
  campoFecha.addEventListener('change', cargarAgenda);

  function moverDia(delta) {
    const base = campoFecha.value || hoyISO();
    const d = new Date(base + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    campoFecha.value = d.toISOString().slice(0, 10);
    cargarAgenda();
  }

  async function cargarAgenda() {
    const contenedor = document.getElementById('agenda-medico-lista');
    const resumen = document.getElementById('resumen-medico-dia');
    const fecha = campoFecha.value || hoyISO();

    contenedor.innerHTML = '<p class="vacio">Cargando agenda…</p>';
    try {
      const datos = await api('/medico/agenda?fecha=' + fecha);
      const citas = datos.citas || [];

      resumen.innerHTML = `
        ${tarjetaResumen('Citas', datos.resumen.total, 'fa-calendar-day', 'text-marca-600')}
        ${tarjetaResumen('Confirmadas', datos.resumen.confirmadas, 'fa-circle-check', 'text-green-600')}
        ${tarjetaResumen('Completadas', datos.resumen.completadas, 'fa-clipboard-check', 'text-sky-600')}
        ${tarjetaResumen('No asistió', datos.resumen.no_asistio, 'fa-user-slash', 'text-slate-500')}
      `;

      if (!citas.length) {
        contenedor.innerHTML = `<p class="vacio">No tienes citas el ${fechaLarga(fecha)} (${diaSemana(fecha)}).</p>`;
        return;
      }

      const ahora = new Date().toTimeString().slice(0, 5);
      contenedor.innerHTML = citas.map((c) => tarjetaCitaMedico(c, ahora, datos.es_hoy)).join('');

      contenedor.querySelectorAll('[data-notas]').forEach((btn) =>
        btn.addEventListener('click', () => guardarNotas(btn.dataset.notas, contenedor)),
      );
    } catch (err) {
      if (err.status === 400) {
        contenedor.innerHTML = '<p class="vacio">Tu usuario no está vinculado a un médico.</p>';
      } else {
        contenedor.innerHTML = '<p class="vacio">Error al cargar la agenda.</p>';
        aviso(err.message, 'error');
      }
    }
  }

  function tarjetaResumen(titulo, valor, icono, color) {
    return `<article class="metrica">
      <div class="flex items-center justify-between">
        <p class="titulo">${escapar(titulo)}</p>
        <i class="fa-solid ${icono} ${color}" aria-hidden="true"></i>
      </div>
      <p class="valor">${escapar(String(valor))}</p>
    </article>`;
  }

  function tarjetaCitaMedico(c, ahora, esHoy) {
    const enCurso = esHoy && c.hora_inicio <= ahora && c.hora_fin >= ahora;
    return `
      <article class="tarjeta-cita borde-${c.estado} ${enCurso ? 'ring-2 ring-marca-400' : ''}">
        <div class="flex flex-wrap items-start gap-3">
          <div class="shrink-0 text-center w-[4.5rem]">
            <p class="font-bold text-marca-700 text-lg leading-none">${escapar(c.hora_inicio)}</p>
            <p class="text-xs text-slate-500">${escapar(c.hora_fin)}</p>
            ${enCurso ? '<span class="etiqueta etiqueta-info mt-1">En curso</span>' : ''}
          </div>
          <div class="flex-1 min-w-[13rem]">
            <p class="font-semibold">${escapar(c.paciente_nombre)}</p>
            <p class="text-xs text-slate-500">
              <i class="fa-solid fa-envelope mr-1" aria-hidden="true"></i>${escapar(c.paciente_email)}
              ${c.paciente_telefono ? ' · <i class="fa-solid fa-phone mr-1" aria-hidden="true"></i>' + escapar(c.paciente_telefono) : ''}
            </p>
            <p class="text-sm text-slate-700 mt-1">
              <i class="fa-solid fa-notes-medical mr-1 text-slate-400" aria-hidden="true"></i>${escapar(c.motivo)}
            </p>
            ${c.notas ? `<p class="text-xs text-slate-500 mt-1 bg-slate-50 rounded px-2 py-1"><i class="fa-solid fa-comment-medical mr-1" aria-hidden="true"></i>${escapar(c.notas)}</p>` : ''}
            <p class="text-xs text-slate-400 mt-1">
              ${escapar(String(c.visitas_previas))} consulta(s) completada(s) previas
              ${c.paciente_documento ? ' · Documento: ' + escapar(c.paciente_documento) : ''}
            </p>
          </div>
          <div class="flex flex-col items-end gap-2">
            ${etiquetaEstado(c.estado)}
            <div class="flex gap-1.5">
              <button class="btn-secundario btn-mini" data-historial-medico="${c.paciente_id}" data-nombre="${escapar(c.paciente_nombre)}">
                <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i><span class="ml-1">Historial</span>
              </button>
              <button class="btn-secundario btn-mini" data-notas="${c.id}" data-notas-texto="${escapar(c.notas || '')}">
                <i class="fa-solid fa-pen" aria-hidden="true"></i><span class="ml-1">Notas</span>
              </button>
            </div>
          </div>
        </div>
      </article>`;
  }

  async function guardarNotas(citaId, contenedor) {
    const boton = contenedor.querySelector(`[data-notas="${citaId}"]`);
    const actual = boton ? boton.dataset.notasTexto : '';
    const notas = prompt('Notas clínicas de la consulta:', actual);
    if (notas === null) return;
    if (!notas.trim()) return aviso('Las notas no pueden estar vacías.', 'error');

    ocupado(boton, true, '…');
    try {
      await api('/medico/notas/' + citaId, { method: 'PATCH', body: { notas: notas.trim() } });
      aviso('Notas guardadas.', 'exito');
      await cargarAgenda();
    } catch (err) {
      aviso(err.message, 'error');
    } finally {
      ocupado(boton, false);
    }
  }

  /* ================================================================== */
  /* 4. Mis pacientes                                                    */
  /* ================================================================== */
  let temporizador = null;

  document.getElementById('buscar-mis-pacientes').addEventListener('input', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(cargarMisPacientes, 300);
  });

  async function cargarMisPacientes() {
    const contenedor = document.getElementById('lista-mis-pacientes');
    const q = document.getElementById('buscar-mis-pacientes').value.trim();
    contenedor.innerHTML = '<p class="vacio">Cargando pacientes…</p>';
    try {
      const datos = await api('/medico/pacientes' + (q ? '?q=' + encodeURIComponent(q) : ''));
      const pacientes = datos.pacientes || [];
      if (!pacientes.length) {
        contenedor.innerHTML = '<p class="vacio">No se encontraron pacientes en tu historial.</p>';
        return;
      }
      contenedor.innerHTML = pacientes
        .map(
          (p) => `
          <article class="tarjeta-cita">
            <div class="flex flex-wrap items-center gap-3">
              <span class="w-10 h-10 shrink-0 rounded-full bg-marca-50 text-marca-700 flex items-center justify-center font-bold" aria-hidden="true">
                ${escapar((p.nombre || '?').charAt(0).toUpperCase())}
              </span>
              <div class="flex-1 min-w-[12rem]">
                <p class="font-semibold">${escapar(p.nombre)}</p>
                <p class="text-xs text-slate-500">
                  ${escapar(p.email)}${p.telefono ? ' · ' + escapar(p.telefono) : ''}
                  ${p.documento ? ' · Doc: ' + escapar(p.documento) : ''}
                </p>
                <p class="text-xs text-slate-500 mt-0.5">
                  Última cita: ${p.ultima_cita ? escapar(fechaLarga(p.ultima_cita)) : '—'}
                </p>
              </div>
              <div class="flex flex-wrap gap-1.5 text-xs">
                <span class="etiqueta etiqueta-completada">${escapar(String(p.completadas || 0))} completadas</span>
                <span class="etiqueta etiqueta-cancelada">${escapar(String(p.canceladas || 0))} canceladas</span>
                <span class="etiqueta etiqueta-no_asistio">${escapar(String(p.no_asistio || 0))} no asistió</span>
              </div>
              <button class="btn-secundario btn-mini" data-ver-historial="${p.id}" data-nombre="${escapar(p.nombre)}">
                <i class="fa-solid fa-folder-open" aria-hidden="true"></i><span class="ml-1">Ver historial</span>
              </button>
            </div>
          </article>`,
        )
        .join('');

      contenedor.querySelectorAll('[data-ver-historial]').forEach((b) =>
        b.addEventListener('click', () => verHistorial(b.dataset.verHistorial, b.dataset.nombre)),
      );
    } catch (err) {
      contenedor.innerHTML = '<p class="vacio">Error al cargar tus pacientes.</p>';
    }
  }

  /* ================================================================== */
  /* 5. Historial de un paciente (modal)                                 */
  /* ================================================================== */
  const modalHistorial = document.getElementById('modal-historial-paciente');

  document.getElementById('btn-cerrar-historial').addEventListener('click', () => modalHistorial.classList.add('hidden'));
  modalHistorial.addEventListener('click', (e) => {
    if (e.target === modalHistorial) modalHistorial.classList.add('hidden');
  });

  async function verHistorial(pacienteId, nombre) {
    document.getElementById('titulo-historial').textContent = nombre;
    document.getElementById('subtitulo-historial').textContent = 'Cargando…';
    document.getElementById('estadisticas-historial').innerHTML = '';
    document.getElementById('lista-historial-citas').innerHTML = '<p class="vacio">Cargando historial…</p>';
    modalHistorial.classList.remove('hidden');

    try {
      const datos = await api('/medico/paciente/' + pacienteId);
      document.getElementById('subtitulo-historial').textContent =
        `${datos.paciente.email}${datos.paciente.telefono ? ' · ' + datos.paciente.telefono : ''}`;

      const est = datos.estadisticas;
      document.getElementById('estadisticas-historial').innerHTML = `
        ${miniMetrica('Total', est.total, 'text-slate-700')}
        ${miniMetrica('Completadas', est.completadas, 'text-green-700')}
        ${miniMetrica('Canceladas', est.canceladas, 'text-red-700')}
        ${miniMetrica('No asistió', est.no_asistio, 'text-slate-500')}
      `;

      const citas = datos.citas || [];
      document.getElementById('lista-historial-citas').innerHTML = citas.length
        ? citas
            .map(
              (c) => `
            <article class="tarjeta-cita">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold text-sm">${escapar(c.fecha)} · ${escapar(c.hora_inicio)}</span>
                ${etiquetaEstado(c.estado)}
                <span class="text-xs text-slate-500 ml-auto">${escapar(c.motivo || 'Sin motivo registrado')}</span>
              </div>
              ${c.notas ? `<p class="text-xs text-slate-600 mt-1.5 bg-slate-50 rounded px-2 py-1">${escapar(c.notas)}</p>` : '<p class="text-xs text-slate-400 mt-1.5">Sin notas clínicas.</p>'}
            </article>`,
            )
            .join('')
        : '<p class="vacio">Este paciente no tiene citas contigo.</p>';
    } catch (err) {
      document.getElementById('lista-historial-citas').innerHTML = '<p class="vacio">Error al cargar el historial.</p>';
      aviso(err.message, 'error');
    }
  }

  function miniMetrica(titulo, valor, color) {
    return `<div class="bg-slate-50 rounded-xl p-3 text-center">
      <p class="text-[10px] uppercase tracking-wide text-slate-500">${escapar(titulo)}</p>
      <p class="text-xl font-bold ${color}">${escapar(String(valor))}</p>
    </div>`;
  }

  /* ================================================================== */
  /* 6. Arranque                                                         */
  /* ================================================================== */
  (async function init() {
    const sesion = window.App.getSesion();

    if (!sesion || sesion.rol !== 'medico') {
      if (sesion) {
        aviso('Tu cuenta es de ' + sesion.rol + '. Este portal es exclusivo del personal médico.', 'info');
      }
      return;
    }

    acceso.classList.add('hidden');
    zona.classList.remove('hidden');

    document.getElementById('nombre-medico').textContent = sesion.nombre;
    document.getElementById('especialidad-medico').textContent =
      'Portal médico · Consultorio Vida Sana';

    campoFecha.value = hoyISO();
    await cargarAgenda();
  })();
})();