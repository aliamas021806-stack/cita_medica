/* ==================================================================
   Funciones compartidas por las tres vistas (paciente/admin/médico)
   ================================================================== */
(function () {
  'use strict';

  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  /* ------------------------- Cliente HTTP ------------------------- */
  async function api(ruta, opciones) {
    const config = Object.assign({ method: 'GET', headers: {} }, opciones || {});
    if (config.body && typeof config.body !== 'string') {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(config.body);
    }
    const respuesta = await fetch('/api' + ruta, Object.assign(config, { credentials: 'same-origin' }));

    let datos = null;
    const tipo = respuesta.headers.get('content-type') || '';
    if (tipo.includes('application/json')) {
      datos = await respuesta.json().catch(() => null);
    } else {
      datos = await respuesta.text().catch(() => null);
    }

    if (!respuesta.ok) {
      const error = new Error((datos && datos.error) || 'Ocurrió un error inesperado');
      error.status = respuesta.status;
      error.datos = datos;
      throw error;
    }
    return datos;
  }

  /* --------------------------- Avisos ----------------------------- */
  function aviso(mensaje, tipo) {
    const contenedor = document.getElementById('avisos');
    if (!contenedor) return;
    const el = document.createElement('div');
    el.className = 'aviso aviso-' + (tipo || 'info');
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML =
      '<i class="fa-solid ' +
      (tipo === 'error' ? 'fa-circle-exclamation' : tipo === 'exito' ? 'fa-circle-check' : 'fa-circle-info') +
      ' mr-2" aria-hidden="true"></i>' +
      escapar(mensaje);
    contenedor.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 320);
    }, tipo === 'error' ? 6500 : 4200);
  }

  /* ------------------------- Utilidades --------------------------- */
  function escapar(texto) {
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function hoyISO(offsetDias) {
    const d = new Date();
    d.setDate(d.getDate() + (offsetDias || 0));
    return d.toISOString().slice(0, 10);
  }

  function fechaLarga(fecha) {
    const [y, m, d] = String(fecha).split('-').map(Number);
    if (!y || !m || !d) return fecha;
    return `${d} de ${MESES[m - 1]} de ${y}`;
  }

  function diaSemana(fecha) {
    const [y, m, d] = String(fecha).split('-').map(Number);
    return DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  }

  function etiquetaEstado(estado) {
    const texto = { confirmada: 'Confirmada', pendiente: 'Pendiente', cancelada: 'Cancelada', completada: 'Completada', no_asistio: 'No asistió' };
    return `<span class="etiqueta etiqueta-${estado}">${texto[estado] || estado}</span>`;
  }

  function limpiarErrores(form) {
    if (!form) return;
    form.querySelectorAll('.error-campo').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('.campo').forEach((el) => el.classList.remove('invalido'));
  }

  function pintarErrores(form, errores) {
    if (!form || !errores) return;
    Object.keys(errores).forEach((campo) => {
      const p = form.querySelector(`[data-error="${campo}"]`);
      if (p) p.textContent = errores[campo];
      const input = form.querySelector(`[name="${campo}"], #${campo}`);
      if (input) input.classList.add('invalido');
    });
    const primero = form.querySelector('.invalido');
    if (primero) primero.focus();
  }

  function ocupado(boton, activo, textoEspera) {
    if (!boton) return;
    if (activo) {
      boton.dataset.textoOriginal = boton.innerHTML;
      boton.disabled = true;
      boton.innerHTML = '<span class="cargando"></span><span class="ml-1">' + (textoEspera || 'Procesando…') + '</span>';
    } else {
      boton.disabled = false;
      if (boton.dataset.textoOriginal) boton.innerHTML = boton.dataset.textoOriginal;
    }
  }

  /* ---------------------- Validación cliente ---------------------- */
  const RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  function validarRegistro(datos) {
    const e = {};
    if (!datos.nombre || datos.nombre.trim().length < 3) e.nombre = 'El nombre debe tener al menos 3 caracteres';
    if (!datos.email) e.email = 'El correo es obligatorio';
    else if (!RE_EMAIL.test(datos.email)) e.email = 'El correo no tiene un formato válido';
    if (!datos.password) e.password = 'La contraseña es obligatoria';
    else if (datos.password.length < 8) e.password = 'La contraseña debe tener al menos 8 caracteres';
    else if (!/[A-Za-z]/.test(datos.password) || !/\d/.test(datos.password))
      e.password = 'La contraseña debe incluir letras y números';
    if (datos.telefono && !/^[0-9+()\-\s]{7,20}$/.test(datos.telefono)) e.telefono = 'El teléfono no es válido';
    return e;
  }

  /* --------------------------- Sesión ----------------------------- */
  let sesion = window.__SESION_INICIAL__ || null;

  async function refrescarSesion() {
    try {
      const datos = await api('/auth/me');
      sesion = datos.usuario;
      return sesion;
    } catch (err) {
      if (err.status === 401) sesion = null;
      return sesion;
    }
  }

  function getSesion() {
    return sesion;
  }

  async function cerrarSesion() {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (err) {
      /* ignorar */
    }
    sesion = null;
    window.location.reload();
  }

  function pintarZonaSesion() {
    const zona = document.getElementById('zona-sesion');
    if (!zona) return;
    if (!sesion) {
      zona.innerHTML =
        '<span class="text-xs text-slate-500 hidden sm:inline">Sin sesión</span>';
      return;
    }
    const inicial = (sesion.nombre || '?').trim().charAt(0).toUpperCase();
    const rolTexto = { paciente: 'Paciente', recepcionista: 'Recepción', admin: 'Administrador', medico: 'Médico' }[sesion.rol] || sesion.rol;
    zona.innerHTML = `
      <span class="hidden sm:flex flex-col items-end leading-tight">
        <span class="text-xs font-semibold">${escapar(sesion.nombre)}</span>
        <span class="text-[10px] text-slate-500">${escapar(rolTexto)}</span>
      </span>
      <span class="w-8 h-8 rounded-full bg-marca-600 text-white text-sm font-bold flex items-center justify-center" aria-hidden="true">${escapar(inicial)}</span>
      <button id="btn-salir" class="text-xs text-slate-500 hover:text-red-600 px-1.5" title="Cerrar sesión">
        <i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>
        <span class="sr-only">Cerrar sesión</span>
      </button>`;
    const btn = document.getElementById('btn-salir');
    if (btn) btn.addEventListener('click', cerrarSesion);
  }

  function marcarNavActivo() {
    const ruta = window.location.pathname;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.getAttribute('href') === ruta) a.classList.add('activo');
    });
  }

  /* ----------------------- Notificaciones ------------------------- */
  async function cargarNotificaciones() {
    if (!sesion) return;
    try {
      const datos = await api('/notificaciones');
      pintarBadge(datos.sin_leer);
      pintarListaNotificaciones(datos.notificaciones);
    } catch (err) {
      /* silencioso */
    }
  }

  function pintarBadge(total) {
    const badge = document.getElementById('badge-notificaciones');
    if (!badge) return;
    if (total > 0) {
      badge.textContent = total > 9 ? '9+' : String(total);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function pintarListaNotificaciones(lista) {
    const contenedor = document.getElementById('lista-notificaciones');
    if (!contenedor) return;
    if (!lista || !lista.length) {
      contenedor.innerHTML = '<p class="vacio">No tienes notificaciones.</p>';
      return;
    }
    const iconos = {
      confirmacion: 'fa-circle-check text-green-600',
      cancelacion: 'fa-circle-xmark text-red-600',
      reprogramacion: 'fa-rotate text-amber-600',
      recordatorio: 'fa-bell text-marca-600',
      info: 'fa-circle-info text-sky-600',
    };
    contenedor.innerHTML = lista
      .map(
        (n) => `
        <article class="p-4 ${n.leida ? 'bg-white' : 'bg-marca-50/50'}">
          <div class="flex gap-3">
            <i class="fa-solid ${iconos[n.tipo] || 'fa-circle-info'} mt-0.5" aria-hidden="true"></i>
            <div class="flex-1 min-w-0">
              <p class="font-semibold text-sm">${escapar(n.asunto || 'Notificación')}</p>
              <p class="text-sm text-slate-600 mt-0.5">${escapar(n.mensaje)}</p>
              <p class="text-[11px] text-slate-400 mt-1">
                ${escapar(String(n.created_at).replace('T', ' ').slice(0, 16))}
                · canal: ${escapar(n.canal)}${n.canal === 'correo' ? ' (simulado)' : ''}
              </p>
            </div>
            <button class="btn-icono btn-mini ${n.leida ? 'hidden' : ''}" data-leer="${n.id}" title="Marcar como leída">
              <i class="fa-solid fa-check" aria-hidden="true"></i>
            </button>
          </div>
        </article>`,
      )
      .join('');

    contenedor.querySelectorAll('[data-leer]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api('/notificaciones/' + btn.dataset.leer + '/leer', { method: 'PATCH' });
          cargarNotificaciones();
        } catch (err) {
          aviso(err.message, 'error');
        }
      });
    });
  }

  function inicializarBandeja() {
    const btn = document.getElementById('btn-notificaciones');
    const bandeja = document.getElementById('bandeja-notificaciones');
    const cerrar = document.getElementById('btn-cerrar-bandeja');
    const leerTodas = document.getElementById('btn-leer-todas');
    if (!btn || !bandeja) return;

    btn.addEventListener('click', () => {
      bandeja.classList.remove('hidden');
      cargarNotificaciones();
    });
    if (cerrar) cerrar.addEventListener('click', () => bandeja.classList.add('hidden'));
    bandeja.addEventListener('click', (e) => {
      if (e.target === bandeja) bandeja.classList.add('hidden');
    });
    if (leerTodas) {
      leerTodas.addEventListener('click', async () => {
        try {
          await api('/notificaciones/leer-todas', { method: 'PATCH' });
          cargarNotificaciones();
          aviso('Todas las notificaciones marcadas como leídas.', 'exito');
        } catch (err) {
          aviso(err.message, 'error');
        }
      });
    }
  }

  /* --------------------------- Exportar --------------------------- */
  window.App = {
    api, aviso, escapar, hoyISO, fechaLarga, diaSemana, etiquetaEstado,
    limpiarErrores, pintarErrores, ocupado, validarRegistro,
    refrescarSesion, getSesion, cerrarSesion, pintarZonaSesion,
    marcarNavActivo, cargarNotificaciones, inicializarBandeja, DIAS, MESES,
  };

  document.addEventListener('DOMContentLoaded', () => {
    marcarNavActivo();
    pintarZonaSesion();
    inicializarBandeja();
    if (window.__SESION_INICIAL__) cargarNotificaciones();
  });
})();