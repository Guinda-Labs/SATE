/* SPDX-License-Identifier: MIT */
(function (raiz) {
  'use strict';
  function normalizarURL(valor) {
    const url = String(valor || '').replace(/\s/g, '').split(/[?#]/)[0];
    return /^https:\/\/chat\.whatsapp\.com\/(invite\/)?[A-Za-z0-9]{20,24}$/.test(url) ? url : null;
  }
  function proximaVerificacion(horario, ahora = new Date()) {
    const instante = +new Date(ahora);
    let inicio = -Infinity;
    for (const fase of horario) {
      const fin = fase.hasta ? +new Date(fase.hasta) : Infinity;
      if (instante >= fin) { inicio = fin; continue; }
      const paso = fase.cada_min * 60000;
      const ancla = fase.hora_utc == null ? 0 : fase.hora_utc * 3600000;
      const siguiente = (Math.floor((Math.max(instante, inicio - 1) - ancla) / paso) + 1) * paso + ancla;
      // En el límite ya rige la fase siguiente; no anunciar una ejecución de la fase anterior.
      if (siguiente >= fin) { inicio = fin; continue; }
      return new Date(siguiente);
    }
    return null;
  }
  function mezclar(publicados, locales, ahora = Date.now()) {
    const enlaces = {...publicados}, pendientes = {};
    for (const [id, dato] of Object.entries(locales || {})) {
      if (!dato || ahora - dato.guardado >= 86400000 || !normalizarURL(dato.enlace?.url)) continue;
      const publicado = publicados[id];
      if (publicado?.url === dato.enlace.url || (publicado?.desde && dato.enlace.desde && Date.parse(publicado.desde) >= Date.parse(dato.enlace.desde))) continue;
      pendientes[id] = dato;
      enlaces[id] = dato.enlace;
    }
    return {enlaces, pendientes};
  }
  const funciones = {normalizarURL, proximaVerificacion, mezclar};
  if (typeof module !== 'undefined' && module.exports) module.exports = funciones;
  raiz.GruposFunciones = funciones;
  if (typeof document === 'undefined') return;

  const T = raiz.GRUPOS.textos;
  function t(clave, variables = {}) {
    return T[clave].replace(/\{([a-z_]+)\}/g, (_, k) => String(variables[k] ?? ''));
  }
  function elemento(tag, texto, clase) {
    const nodo = document.createElement(tag);
    if (texto != null) nodo.textContent = texto;
    if (clase) nodo.className = clase;
    return nodo;
  }
  function boton(texto, accion) {
    const b = elemento('button', texto); b.type = 'button'; b.addEventListener('click', accion); return b;
  }
  function leer(clave, reserva) {
    try { return JSON.parse(localStorage.getItem(clave)) ?? reserva; } catch (_) { return reserva; }
  }
  function guardar(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (_) { /* El directorio también funciona sin almacenamiento. */ }
  }
  const prueba = location.pathname.startsWith('/prueba/'), modo = prueba ? 'prueba' : '';
  const prefijo = 'ipnt.grupos.' + (prueba ? 'prueba.' : 'real.');
  let config, oferta, enlaces = {}, locales = {}, cambio;
  const carrera = document.getElementById('carrera'), buscar = document.getElementById('buscar');
  const lista = document.getElementById('lista'), mensaje = document.getElementById('mensaje');
  document.getElementById('prueba').hidden = !prueba;
  const estado = document.getElementById('estado');
  function fecha(valor) {
    if (!valor || !Number.isFinite(Date.parse(valor))) return t('grupos.estado.sin_cambio');
    return new Intl.DateTimeFormat('es-MX', {timeZone:config.zona, day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}).format(new Date(valor));
  }
  function actualizarEstado() {
    estado.textContent = t('grupos.estado.linea', {ultima:fecha(cambio), proxima:fecha(proximaVerificacion(config.horario)?.toISOString())});
  }
  function relativo(valor) {
    const minutos = Math.round((Date.parse(valor) - Date.now()) / 60000);
    if (!Number.isFinite(minutos)) return t('grupos.estado.sin_cambio');
    const unidad = Math.abs(minutos) < 60 ? 'minute' : Math.abs(minutos) < 1440 ? 'hour' : 'day';
    return new Intl.RelativeTimeFormat('es-MX', {numeric:'auto'}).format(Math.round(minutos / (unidad === 'day' ? 1440 : unidad === 'hour' ? 60 : 1)), unidad);
  }
  const motivos = {caido:'grupos.motivo.caido', lleno:'grupos.motivo.lleno', equivocado:'grupos.motivo.equivocado', otro:'grupos.motivo.otro'};
  function enlaceValido(dato) { return dato && normalizarURL(dato.url) ? {...dato, url:normalizarURL(dato.url)} : null; }
  function recordar(id, dato) {
    const valido = enlaceValido(dato);
    if (!valido) throw new Error('respuesta');
    enlaces[id] = valido;
    locales[id] = {enlace:valido, guardado:Date.now()}; guardar(prefijo + config.periodo, locales);
  }
  async function api(accion, datos) {
    if (!config.endpoint || config.endpoint === '__ENDPOINT__') throw new Error('pendiente');
    const url = new URL(config.endpoint);
    let opciones = {signal:AbortSignal.timeout(25000)};
    if (accion === 'consultar') {
      url.search = new URLSearchParams({accion, modo, id:datos.id}).toString();
    } else opciones = {...opciones, method:'POST', headers:{'Content-Type':'text/plain'}, body:JSON.stringify({accion, modo, ...datos})};
    const respuesta = await fetch(url, opciones);
    if (!respuesta.ok) throw Object.assign(new Error('red'), {status:respuesta.status});
    const dato = await respuesta.json();
    if (typeof dato.ok !== 'boolean') throw new Error('respuesta');
    if (!dato.ok) console.warn('[grupos]', {accion, estado:dato.estado});
    return dato;
  }
  function errorAPI(dato) {
    const claves = {invalido:'grupos.error.invalido', cerrado:'grupos.error.cerrado', limite:'grupos.error.limite'};
    return t(claves[dato.estado] || 'grupos.error.red');
  }
  function errorRed(error, accion) {
    // Solo metadatos operativos: nunca enlaces, motivos libres ni identificadores personales.
    console.warn('[grupos]', {accion, error:error.name, estadoHttp:error.status ?? null, tipo:error.message === 'pendiente' ? 'sin_endpoint' : 'solicitud_fallida'});
    return t(error.message === 'pendiente' ? 'grupos.error.pendiente' : 'grupos.error.red');
  }
  function unirse(dato) {
    const a = elemento('a', t('grupos.accion.unirse'), 'unirse');
    a.href = dato.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  }
  function acordeon(detalle, resumen) {
    detalle.addEventListener('toggle', () => resumen.setAttribute('aria-expanded', String(detalle.open)));
    resumen.setAttribute('aria-expanded', String(detalle.open));
  }
  function contador(grupo, resumen) {
    resumen.querySelector('.contador').textContent = t('grupos.lista.contador', {con:grupo.filter(c => enlaces[c.id]).length, total:grupo.length});
  }
  function fila(casilla, grupo, resumen) {
    const contenedor = elemento('div', null, 'materia');
    function dibujar() {
      contenedor.replaceChildren();
      const renglon = elemento('div', null, 'renglon'), acciones = elemento('div', null, 'acciones');
      renglon.append(elemento('span', raiz.GRUPOS.nombres[casilla.materia] || casilla.materia, 'nombre'), acciones);
      contenedor.append(renglon);
      const vigente = enlaces[casilla.id];
      if (vigente) {
        acciones.append(unirse(vigente));
        const menu = elemento('details', null, 'menu'), sum = elemento('summary', t('grupos.accion.opciones'));
        menu.append(sum); acordeon(menu, sum);
        menu.append(boton(t('grupos.accion.copiar'), async () => {
          try { await navigator.clipboard.writeText(vigente.url); mensaje.textContent = t('grupos.estado.copiado'); }
          catch (_) { mensaje.textContent = t('grupos.error.copiar'); }
        }), boton(t('grupos.accion.reemplazar'), () => { menu.open = false; editar(true); }));
        acciones.append(menu);
        if (vigente.reemplazo) contenedor.append(elemento('small', t('grupos.estado.reemplazado', {fecha:relativo(vigente.reemplazo.fecha), motivo:t(motivos[vigente.reemplazo.motivo] || motivos.otro)})));
      } else acciones.append(boton(t('grupos.accion.agregar'), () => editar(false)));
      contador(grupo, resumen);
    }
    async function editar(reemplazo) {
      if (contenedor.querySelector('.editor')) return;
      const editor = elemento('div', null, 'editor'), aviso = elemento('p');
      aviso.setAttribute('role', 'status'); aviso.setAttribute('aria-live', 'polite');
      editor.append(aviso); contenedor.append(editor);
      const cancelar = boton(t('grupos.accion.cancelar'), () => { editor.remove(); contenedor.querySelector('button')?.focus(); });
      if (!reemplazo) {
        aviso.textContent = t('grupos.estado.revisando');
        try {
          const respuesta = await api('consultar', {id:casilla.id});
          if (!respuesta.ok) { aviso.textContent = errorAPI(respuesta); editor.append(cancelar); return; }
          if (respuesta.enlace) {
            recordar(casilla.id, respuesta.enlace); dibujar(); mensaje.textContent = t('grupos.estado.alguien'); return;
          }
        } catch (error) { errorRed(error, 'consultar'); }   // al guardar, el script vuelve a revisar con candado
      }
      const anterior = enlaces[casilla.id]?.url;
      aviso.textContent = reemplazo ? t('grupos.form.registro') : t('grupos.form.ayuda');
      const formulario = elemento('form'), etiqueta = elemento('label', t('grupos.form.url'));
      formulario.noValidate = true;
      const entrada = elemento('input'); entrada.type = 'url'; entrada.required = true; entrada.autocomplete = 'off';
      etiqueta.append(entrada);
      const validacion = elemento('small'); validacion.setAttribute('aria-live', 'polite');
      const motivo = elemento('select'), detalle = elemento('input'); detalle.maxLength = 140;
      if (reemplazo) {
        const motivoLabel = elemento('label', t('grupos.form.motivo'));
        for (const clave of config.motivos) { const o = elemento('option', t(motivos[clave])); o.value = clave; motivo.append(o); }
        motivoLabel.append(motivo);
        const detalleLabel = elemento('label', t('grupos.form.detalle')); detalleLabel.append(detalle); detalleLabel.hidden = true;
        motivo.addEventListener('change', () => { detalleLabel.hidden = motivo.value !== 'otro'; detalle.required = motivo.value === 'otro'; validar(); });
        formulario.append(motivoLabel, detalleLabel);
      }
      const trampaLabel = elemento('label', t('grupos.form.web'), 'trampa'), trampa = elemento('input');
      trampa.name = 'web'; trampa.tabIndex = -1; trampa.autocomplete = 'off'; trampaLabel.setAttribute('aria-hidden', 'true'); trampaLabel.append(trampa);
      const enviar = elemento('button', t('grupos.accion.guardar')); enviar.type = 'submit'; enviar.disabled = true;
      let ocupado = false;
      function validar() {
        const url = normalizarURL(entrada.value);
        entrada.setAttribute('aria-invalid', String(!!entrada.value && !url));
        validacion.textContent = entrada.value && !url ? t('grupos.error.url') : '';
        enviar.disabled = ocupado || !url || (reemplazo && motivo.value === 'otro' && (!detalle.value.trim() || /[\r\n]/.test(detalle.value) || detalle.value.length > 140));
      }
      entrada.addEventListener('input', validar); detalle.addEventListener('input', validar);
      const botones = elemento('div', null, 'botones');
      if (navigator.clipboard?.readText) botones.append(boton(t('grupos.accion.pegar'), async () => {
        try { entrada.value = await navigator.clipboard.readText(); validar(); entrada.focus(); }
        catch (_) { aviso.textContent = t('grupos.error.pegar'); }
      }));
      botones.append(enviar, cancelar); formulario.append(etiqueta, validacion, trampaLabel, botones); editor.append(formulario); entrada.focus();
      formulario.addEventListener('submit', async evento => {
        evento.preventDefault(); validar(); if (enviar.disabled) return;
        ocupado = true; validar(); aviso.textContent = t('grupos.estado.guardando');
        try {
          const respuesta = await api(reemplazo ? 'reemplazar' : 'agregar', {id:casilla.id, url:normalizarURL(entrada.value), web:trampa.value,
            ...(reemplazo ? {anterior, motivo:motivo.value, detalle:motivo.value === 'otro' ? detalle.value.trim() : ''} : {})});
          if (!respuesta.ok) { aviso.textContent = errorAPI(respuesta); return; }
          const claves = {guardado:'grupos.estado.guardado', existe:'grupos.estado.alguien', cambio:'grupos.estado.cambio'};
          if (!claves[respuesta.estado]) throw new Error('respuesta');
          recordar(casilla.id, respuesta.enlace); dibujar(); mensaje.textContent = t(claves[respuesta.estado]);
          contenedor.querySelector('a')?.focus();
        } catch (error) { aviso.textContent = errorRed(error, reemplazo ? 'reemplazar' : 'agregar'); }
        finally { ocupado = false; validar(); }
      });
    }
    dibujar(); return contenedor;
  }
  function renderizar() {
    const abiertos = new Set([...lista.querySelectorAll('details.grupo[open]')].map(d => d.dataset.grupo));
    lista.replaceChildren(); const grupos = new Map(), filtro = buscar.value.trim().toUpperCase();
    for (const c of oferta.casillas) {
      if ((carrera.value && c.carrera !== carrera.value) || !c.grupo.startsWith(filtro)) continue;
      if (!grupos.has(c.grupo)) grupos.set(c.grupo, []);
      grupos.get(c.grupo).push(c);
    }
    for (const [nombre, casillas] of [...grupos].sort((a,b) => a[1][0].nivel - b[1][0].nivel || a[0].localeCompare(b[0], 'es', {numeric:true}))) {
      const d = elemento('details', null, 'grupo'), resumen = elemento('summary'); d.dataset.grupo = nombre;
      d.open = nombre === filtro || abiertos.has(nombre); resumen.append(elemento('strong', nombre), elemento('span', '', 'contador'));
      acordeon(d, resumen); d.append(resumen);
      for (const c of casillas) d.append(fila(c, casillas, resumen));
      lista.append(d);
    }
    mensaje.textContent = grupos.size ? '' : t('grupos.lista.vacio');
  }
  async function iniciar() {
    try {
      const respuestas = await Promise.all(['config.json', 'oferta.json'].map(async ruta => {
        const r = await fetch(ruta); if (!r.ok) throw new Error('datos'); return r.json();
      }));
      [config, oferta] = respuestas;
      locales = leer(prefijo + config.periodo, {});
      let publicados = {};
      try {
        const r = await fetch(prueba ? config.enlaces_prueba : config.enlaces, {cache:'no-store'});
        if (r.ok) { const datos = await r.json(); if (datos.periodo === config.periodo) { publicados = datos.enlaces || {}; cambio = datos.cambio; } }
      } catch (_) { /* La publicación todavía puede no existir. */ }
      publicados = Object.fromEntries(Object.entries(publicados).map(([id,dato]) => [id,enlaceValido(dato)]).filter(([,dato]) => dato));
      const mezcla = mezclar(publicados, locales); enlaces = mezcla.enlaces; locales = mezcla.pendientes;
      guardar(prefijo + config.periodo, locales);
      const todos = elemento('option', t('grupos.filtro.todas')); todos.value = ''; carrera.append(todos);
      for (const [id, nombre] of Object.entries(oferta.carreras)) { const o = elemento('option', nombre); o.value = id; carrera.append(o); }
      carrera.value = leer('ipnt.grupos.carrera', ''); if (carrera.selectedIndex < 0) carrera.value = '';
      carrera.addEventListener('change', () => { guardar('ipnt.grupos.carrera', carrera.value); renderizar(); });
      buscar.addEventListener('input', () => { const posicion = buscar.selectionStart; buscar.value = buscar.value.toUpperCase(); if (posicion != null) buscar.setSelectionRange(posicion,posicion); renderizar(); });
      actualizarEstado(); setInterval(actualizarEstado, 30000); renderizar();
    } catch (error) { mensaje.textContent = t('grupos.error.datos'); console.warn('[grupos]', {accion:'cargar', error:error.name}); }
  }
  iniciar();
})(typeof globalThis !== 'undefined' ? globalThis : this);
