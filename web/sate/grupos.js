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
  function normalizarBusqueda(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }
  function leerHash(hash) {
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    return {c:p.get('c') || '', s:/^[1-9]$/.test(p.get('s')) ? p.get('s') : '',
      t:['M','V','X'].includes(p.get('t')) ? p.get('t') : '', q:p.get('q') || '', sin:p.get('sin') === '1', g:(p.get('g') || '').toUpperCase()};
  }
  function escribirHash(filtros) {
    const p = new URLSearchParams();
    for (const clave of ['c','s','t','q']) if (filtros[clave]) p.set(clave, filtros[clave]);
    if (filtros.sin) p.set('sin', '1');
    if (filtros.g) p.set('g', filtros.g);
    return p.size ? '#' + p.toString() : '';
  }
  function filtrar(casillas, enlaces, filtros) {
    const q = normalizarBusqueda(filtros.q);
    return casillas.filter(c => (!filtros.c || c.carrera === filtros.c) &&
      (!filtros.s || String(c.nivel) === filtros.s) && (!filtros.t || c.turno === filtros.t) &&
      (!filtros.sin || !enlaces[c.id]) && (!q || normalizarBusqueda(c.grupo).includes(q) || normalizarBusqueda(c.materia).includes(q)));
  }
  function periodoHorario(oferta, periodo) {
    // La oferta actual no publica ids escolares; conservar el respaldo en un solo lugar.
    const id = valor => String(valor || '').replace(/^20/, '').replace(/\//g, '');
    return Object.keys(oferta.periodos || {}).find(p => id(oferta.periodos[p]?.id) === id(periodo)) || 'proximo';
  }
  function leerHorario(local, sesion, clave) {
    let mantener = false;
    try {
      const previa = local.getItem('ipnt.persistir') ?? sesion.getItem('ipnt.persistir');
      mantener = previa === 'si' || (previa === null && Object.keys(local).some(k => /^(hu\.|ue\.|saes\.)|^perfil\.opciones$/.test(k)));
    } catch (_) { /* Igual que Cuenta: sin preferencia legible, usar la sesión. */ }
    try { return JSON.parse((mantener ? local : sesion).getItem(clave)); } catch (_) { return null; }
  }
  function emparejarClave(clave, oferta, casillas, periodo = 'proximo') {
    if (typeof clave !== 'string') return null;
    const partes = clave.split('|');
    if (partes.length !== 3 || !/^\d+$/.test(partes[2])) return null;
    const [carrera, grupo, indice] = partes;
    if (!(oferta.periodos?.[periodo] || []).some(c => c[0] === carrera && c[3] === grupo && String(c[4]) === indice)) return null;
    const nombre = oferta.asig?.[Number(indice)];
    if (typeof nombre !== 'string') return null;
    const normal = v => normalizarBusqueda(v).replace(/\s+/g, ' ').toUpperCase();
    return casillas.find(c => normal(c.grupo) === normal(grupo) && normal(c.materia) === normal(nombre))?.id || null;
  }
  function seleccionHorario(horario, elegido) {
    const plans = horario?.plans || {}, plan = elegido && plans[elegido] ? elegido : horario?.plan;
    return {plan, planes:Object.keys(plans), claves:Array.isArray(plans[plan]?.sel) ? [...new Set(plans[plan].sel)] : []};
  }
  const funciones = {normalizarURL, proximaVerificacion, mezclar, normalizarBusqueda, leerHash, escribirHash, filtrar,
    periodoHorario, leerHorario, emparejarClave, seleccionHorario};
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
  let ofertaSate, planElegido, conteoTus;
  const tusMaterias = document.getElementById('tus-materias');
  function horarioPersonal() {
    try { return leerHorario(localStorage, sessionStorage, 'hu.w.' + periodoHorario(ofertaSate, config.periodo)); }
    catch (_) { return null; }
  }
  function renderizarTusMaterias() {
    if (!ofertaSate) return;
    tusMaterias.replaceChildren(); tusMaterias.hidden = false; conteoTus = null;
    const horario = horarioPersonal(), seleccion = seleccionHorario(horario, planElegido);
    const link = elemento('a', t('grupos.tus.horarios'), 'grupos-volver'); link.href = '../index.html#/upiita/horarios';
    const hayHorario = seleccion.planes.some(p => horario.plans[p]?.sel?.length || horario.plans[p]?.own?.length);
    if (!hayHorario) {
      const linea = elemento('p', t('grupos.tus.sin_horario') + ' ', 'tenue'); linea.append(link); tusMaterias.append(linea); return;
    }
    const cabecera = elemento('div', null, 'renglon');
    cabecera.append(elemento('h2', t('grupos.tus.titulo')), link);
    if (seleccion.planes.length > 1) {
      const etiqueta = elemento('label', t('grupos.tus.plan')), selector = elemento('select');
      for (const p of seleccion.planes) { const o = elemento('option', p); o.value = p; selector.append(o); }
      selector.value = seleccion.plan;
      selector.addEventListener('change', () => { planElegido = selector.value; renderizarTusMaterias(); });
      etiqueta.append(selector); cabecera.append(etiqueta);
    }
    tusMaterias.append(cabecera);
    const contador = elemento('p', '', 'tenue'); contador.id = 'tus-conteo'; contador.setAttribute('role', 'status');
    tusMaterias.append(contador); conteoTus = contador;
    for (const clave of seleccion.claves) {
      const id = emparejarClave(clave, ofertaSate, oferta.casillas, periodoHorario(ofertaSate, config.periodo));
      const casilla = oferta.casillas.find(c => c.id === id);
      if (casilla) tusMaterias.append(fila(casilla));
    }
    if (!seleccion.claves.length) tusMaterias.append(elemento('p', t('grupos.tus.plan_vacio'), 'tenue'));
    actualizarTusConteos();
  }
  function actualizarTusConteos() {
    if (!ofertaSate) return;
    if (!conteoTus) return;
    const seleccion = seleccionHorario(horarioPersonal(), planElegido);
    const con = seleccion.claves.filter(k => enlaces[emparejarClave(k, ofertaSate, oferta.casillas, periodoHorario(ofertaSate, config.periodo))]).length;
    conteoTus.textContent = t('grupos.tus.contador', {con, total:seleccion.claves.length});
  }
  function actualizarFilas(origen) {
    for (const raiz of [lista, tusMaterias]) for (const nodo of raiz.querySelectorAll('.materia')) {
      if (nodo !== origen && nodo.dataset.casilla === origen.dataset.casilla) nodo.actualizar();
    }
    actualizarTusConteos();
  }
  const carrera = document.getElementById('carrera'), buscar = document.getElementById('buscar');
  const semestre = document.getElementById('semestre'), turno = document.getElementById('turno'), sin = document.getElementById('sin');
  let filtros = leerHash(''), abierto = '', ultimo = leer(prefijo + 'grupo', '');
  let avisoTimer;
  const lista = document.getElementById('lista'), mensaje = document.getElementById('mensaje');
  document.getElementById('prueba').hidden = !prueba;
  const estado = document.getElementById('estado');
  function notificar(texto) {
    clearTimeout(avisoTimer); mensaje.hidden = false; mensaje.textContent = texto;
    avisoTimer = setTimeout(() => { mensaje.hidden = true; }, 6000);
  }
  function fecha(valor) {
    if (!valor || !Number.isFinite(Date.parse(valor))) return t('grupos.estado.sin_cambio');
    return new Intl.DateTimeFormat('es-MX', {timeZone:config.zona, hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(new Date(valor));
  }
  function actualizarEstado() {
    estado.querySelector('summary').textContent = cambio ? t('grupos.estado.pastilla', {hora:fecha(cambio)}) : t('grupos.estado.sin_cambio');
    document.getElementById('proxima').textContent = t('grupos.estado.proxima', {hora:fecha(proximaVerificacion(config.horario)?.toISOString())});
    document.getElementById('global').textContent = t('grupos.estado.global', {con:oferta.casillas.filter(c => enlaces[c.id]).length, total:oferta.casillas.length});
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
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.5');
    svg.append(path); a.prepend(svg);
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
    contenedor.dataset.casilla = casilla.id;
    function dibujar() {
      contenedor.replaceChildren();
      const renglon = elemento('div', null, 'renglon'), acciones = elemento('div', null, 'acciones');
      const nombre = elemento('span', raiz.GRUPOS.nombres[casilla.materia] || casilla.materia, 'nombre');
      if (!resumen) nombre.append(elemento('small', casilla.grupo));
      renglon.append(nombre, acciones);
      contenedor.append(renglon);
      const vigente = enlaces[casilla.id];
      if (vigente) {
        acciones.append(unirse(vigente));
        const menu = elemento('details', null, 'menu'), sum = elemento('summary', '⋯');
        sum.setAttribute('aria-label', t('grupos.accion.opciones'));
        menu.append(sum); acordeon(menu, sum);
        const opciones = elemento('div'); menu.append(opciones);
        opciones.append(boton(t('grupos.accion.copiar'), async () => {
          menu.open = false;
          try { await navigator.clipboard.writeText(vigente.url); notificar(t('grupos.estado.copiado')); }
          catch (_) { notificar(t('grupos.error.copiar')); }
        }), boton(t('grupos.accion.reemplazar'), () => { menu.open = false; editar(true); }));
        acciones.append(menu);
        if (vigente.reemplazo) contenedor.append(elemento('small', t('grupos.estado.reemplazado', {fecha:relativo(vigente.reemplazo.fecha), motivo:t(motivos[vigente.reemplazo.motivo] || motivos.otro)})));
      } else { const agregar = boton(t('grupos.accion.agregar'), () => editar(false)); agregar.className = 'texto-enlace'; acciones.append(agregar); }
      if (resumen) contador(grupo, resumen);
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
          if (!respuesta.ok) notificar(errorAPI(respuesta));
          if (respuesta.enlace) {
            recordar(casilla.id, respuesta.enlace); dibujar(); actualizarFilas(contenedor); actualizarEstado(); notificar(t('grupos.estado.alguien')); return;
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
        catch (_) { notificar(t('grupos.error.pegar')); }
      }));
      botones.append(enviar, cancelar); formulario.append(etiqueta, validacion, trampaLabel, botones); editor.append(formulario); entrada.focus();
      formulario.addEventListener('submit', async evento => {
        evento.preventDefault(); validar(); if (enviar.disabled) return;
        ocupado = true; validar(); aviso.textContent = t('grupos.estado.guardando');
        try {
          const respuesta = await api(reemplazo ? 'reemplazar' : 'agregar', {id:casilla.id, url:normalizarURL(entrada.value), web:trampa.value,
            ...(reemplazo ? {anterior, motivo:motivo.value, detalle:motivo.value === 'otro' ? detalle.value.trim() : ''} : {})});
          if (!respuesta.ok) { aviso.textContent = ''; notificar(errorAPI(respuesta)); return; }
          const claves = {guardado:'grupos.estado.guardado', existe:'grupos.estado.alguien', cambio:'grupos.estado.cambio'};
          if (!claves[respuesta.estado]) throw new Error('respuesta');
          recordar(casilla.id, respuesta.enlace); dibujar(); actualizarFilas(contenedor); actualizarEstado(); actualizarConteos(); notificar(t(claves[respuesta.estado]));
          contenedor.classList.add('guardada'); setTimeout(() => {
            contenedor.classList.remove('guardada');
            if (filtros.sin) { renderizar(); sincronizar(); document.getElementById('resultados').focus(); }
          }, 1000);
          contenedor.querySelector('a')?.focus();
        } catch (error) { aviso.textContent = ''; notificar(errorRed(error, reemplazo ? 'reemplazar' : 'agregar')); }
        finally { ocupado = false; validar(); }
      });
    }
    contenedor.actualizar = dibujar;
    dibujar(); return contenedor;
  }
  function actualizarConteos() {
    const visibles = filtrar(oferta.casillas, enlaces, filtros);
    const cantidad = new Set(visibles.map(c => c.grupo)).size;
    document.getElementById('resultados').textContent = visibles.length ? t('grupos.lista.resultados',
      {grupos:t(cantidad === 1 ? 'grupos.lista.grupo_uno' : 'grupos.lista.grupo_varios', {n:cantidad}),
        materias:t(visibles.length === 1 ? 'grupos.lista.materia_una' : 'grupos.lista.materia_varias', {n:visibles.length})}) : t('grupos.lista.vacio');
    for (const b of lista.querySelectorAll('button.grupo')) contador(oferta.casillas.filter(c => c.grupo === b.dataset.grupo), b);
  }
  function sincronizar() {
    const hash = escribirHash({...filtros, g:abierto});
    // replaceState evita una entrada de historial por cada letra del buscador.
    history.replaceState(null, '', location.pathname + location.search + hash);
    guardar(prefijo + 'filtros', {...filtros, g:''});
  }
  function controles() {
    buscar.value = filtros.q; semestre.value = filtros.s; turno.value = filtros.t; sin.checked = filtros.sin;
    for (const b of carrera.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.carrera === filtros.c));
    document.getElementById('limpiar').hidden = !['c','s','t','q','sin'].some(k => filtros[k]);
  }
  async function compartir(nombre) {
    const url = new URL(location.href); url.pathname = url.pathname.replace(/\/index\.html$/, '/');
    url.hash = escribirHash({g:nombre});
    try {
      if (navigator.share && matchMedia('(max-width: 767px)').matches) await navigator.share({title:t('grupos.pagina.titulo'), url:url.href});
      else { await navigator.clipboard.writeText(url.href); notificar(t('grupos.estado.compartido')); }
    } catch (error) { if (error.name !== 'AbortError') notificar(t('grupos.error.compartir')); }
  }
  function renderizar(automatico = true) {
    lista.replaceChildren(); const grupos = new Map();
    for (const c of filtrar(oferta.casillas, enlaces, filtros)) {
      if (!grupos.has(c.grupo)) grupos.set(c.grupo, []);
      grupos.get(c.grupo).push(c);
    }
    if (automatico) {
      const exacto = [...grupos.keys()].find(g => normalizarBusqueda(g) === normalizarBusqueda(filtros.q));
      if (!grupos.has(abierto)) abierto = '';
      abierto = abierto || exacto || (grupos.size === 1 ? [...grupos.keys()][0] : '');
      if (abierto) { ultimo = abierto; guardar(prefijo + 'grupo', ultimo); }
    }
    const secciones = new Map();
    function seccion(clave, titulo) {
      if (!secciones.has(clave)) {
        const s = elemento('section', null, 'grupos-seccion'), grid = elemento('div', null, 'grupos-cuadricula');
        s.append(elemento('h2', titulo), grid); lista.append(s); secciones.set(clave, grid);
      }
      return secciones.get(clave);
    }
    function agregar(nombre, casillas, grid) {
      const b = boton('', () => {
        abierto = abierto === nombre ? '' : nombre;
        if (abierto) { ultimo = abierto; guardar(prefijo + 'grupo', ultimo); }
        renderizar(false); sincronizar();
        [...lista.querySelectorAll('button.grupo')].find(n => n.dataset.grupo === nombre)?.focus();
      });
      b.className = 'grupo'; b.dataset.grupo = nombre;
      b.id = 'grupo-' + nombre; b.setAttribute('aria-controls', 'panel-' + nombre);
      b.setAttribute('aria-expanded', String(abierto === nombre));
      b.append(elemento('strong', nombre), elemento('span', '', 'contador')); grid.append(b);
      if (abierto === nombre) {
        const panel = elemento('div', null, 'grupos-panel'); panel.id = 'panel-' + nombre;
        panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', b.id);
        const cabecera = elemento('div', null, 'renglon');
        const compartirBoton = boton(t('grupos.accion.compartir'), () => compartir(nombre)); compartirBoton.className = 'texto-enlace';
        cabecera.append(elemento('h3', nombre), compartirBoton); panel.append(cabecera);
        for (const c of casillas) panel.append(fila(c, oferta.casillas.filter(f => f.grupo === nombre), b));
        grid.append(panel);
      }
    }
    if (grupos.has(ultimo)) agregar(ultimo, grupos.get(ultimo), seccion('tu', t('grupos.lista.tu')));
    for (const [nombre, casillas] of [...grupos].sort((a,b) => a[1][0].nivel - b[1][0].nivel || a[0].localeCompare(b[0], 'es', {numeric:true}))) {
      if (nombre === ultimo) continue;
      const nivel = casillas[0].nivel;
      agregar(nombre, casillas, seccion(nivel, t('grupos.lista.semestre_' + nivel)));
    }
    controles(); actualizarConteos();
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
      function cambiar() {
        filtros = {...filtros, q:buscar.value, s:semestre.value, t:turno.value, sin:sin.checked, g:''};
        abierto = ''; renderizar(); sincronizar();
      }
      for (const id of ['', ...Object.keys(oferta.carreras)]) {
        const b = boton('', () => { filtros.c = id; cambiar(); }); b.dataset.carrera = id;
        b.append(elemento('span', t(id ? 'grupos.carrera.' + id.toLowerCase() : 'grupos.filtro.todas'), 'carrera-larga'),
          elemento('span', t(id ? 'grupos.carrera_corta.' + id.toLowerCase() : 'grupos.filtro.todas'), 'carrera-corta'));
        carrera.append(b);
      }
      for (const nivel of [...new Set(oferta.casillas.map(c => c.nivel))].sort((a,b) => a-b)) {
        const o = elemento('option', String(nivel)); o.value = String(nivel); semestre.append(o);
      }
      function restaurar() {
        filtros = leerHash(location.hash || escribirHash(leer(prefijo + 'filtros', {})));
        if (filtros.c && !oferta.carreras[filtros.c]) filtros.c = '';
        abierto = filtros.g; controles(); renderizar();
      }
      restaurar(); sincronizar();
      buscar.addEventListener('input', cambiar);
      for (const control of [semestre, turno, sin]) control.addEventListener('change', cambiar);
      document.getElementById('limpiar').addEventListener('click', () => {
        filtros = leerHash(''); abierto = ''; controles(); renderizar(); sincronizar(); buscar.focus();
      });
      window.addEventListener('hashchange', () => { filtros = leerHash(location.hash); abierto = filtros.g; controles(); renderizar(); guardar(prefijo + 'filtros', {...filtros,g:''}); });
      actualizarEstado(); setInterval(actualizarEstado, 30000);
      window.addEventListener('storage', () => { planElegido = undefined; renderizarTusMaterias(); });
      // Carga independiente: una oferta de SATE ausente no afecta al directorio.
      try {
        const r = await fetch('../datos/upiita/oferta.json');
        if (!r.ok) throw new Error('oferta');
        const datos = await r.json();
        if (!Array.isArray(datos.asig) || !datos.periodos) throw new Error('formato');
        ofertaSate = datos; renderizarTusMaterias();
      } catch (error) {
        ofertaSate = undefined; tusMaterias.hidden = true;
        console.warn('[grupos]', {accion:'cargar_oferta_sate', error:error.name});
      }
    } catch (error) { notificar(t('grupos.error.datos')); console.warn('[grupos]', {accion:'cargar', error:error.name}); }
  }
  iniciar();
})(typeof globalThis !== 'undefined' ? globalThis : this);
