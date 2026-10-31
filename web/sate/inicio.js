/* Los módulos clásicos comparten los globales históricos. Cambiar de unidad recarga
   el mismo punto de entrada para no mezclar estado ni registrar eventos dos veces. */
(function () {
  // Conserva el interruptor de la URL mientras se cargan las pestañas bajo demanda.
  if(location.hash?.includes('#filtros-d'))SATE_CONFIG.pruebaFiltrosD=true;
  const config = SATE_CONFIG.unidades, cargas = new Map(), modulos = {}, montados = new Set();
  // Pestañas en rediseño: se ocultan en todas las unidades desde data/sate.json (pestanasOcultas).
  const oculta = t => (SATE_CONFIG.pestanasOcultas || []).includes(t);
  for (const c of Object.values(config)) { c.pestanas = c.pestanas.filter(t => !oculta(t)); c.grupos = (c.grupos || []).map(g => g.filter(t => !oculta(t))).filter(g => g.length); }
  const cascaron = document.querySelector('html[data-pestanas]');
  const variante = new URLSearchParams(location.search).get('pestanas');
  if (cascaron && ['v1','v3'].includes(variante)) cascaron.setAttribute('data-pestanas', variante);
  let api, actual, tabs, barra, version = 0, recalcularPestanas=()=>{}, seleccionProgramada=false, temariosListos=null;
  const leer = k => { try { return window.IPNT?.almacen?IPNT.almacen.getItem(k):((typeof sessionStorage!=='undefined'?sessionStorage.getItem(k):null)??localStorage.getItem(k)); } catch { return null; } };
  const parametros = new URLSearchParams(location.search), entrada = parametros.get('sateEntrada') === '1';
  const cuposReducida = parametros.get('vista') === 'cupos' || /\/cupos(?:\?|$)/.test(location.hash);
  if(cuposReducida) document.documentElement.dataset.vista='cupos';
  let alumnoUnidad;
  try { alumnoUnidad = JSON.parse(leer('saes.alumno'))?.unidad; } catch {}
  const recordada = leer('ipnt.unidad');
  const solicitada = entrada ? null : location.hash.match(/^#\/([a-z0-9-]+)\//)?.[1] || parametros.getAll('sateUnidad').at(-1) || (cuposReducida?parametros.get('unidad'):null) || alumnoUnidad || recordada;
  if (solicitada && /^[a-z0-9-]+$/.test(solicitada) && !config[solicitada]) {
    const identidad = SATE_CONFIG.identidadUnidades?.[solicitada] || Object.values(SATE_CONFIG.identidadUnidades || {}).find(c=>c.alias?.includes(solicitada));
    const siglas = identidad?.siglas || solicitada.toUpperCase();
    config[solicitada] = {generica:true,siglas,nombre:identidad?.nombre || siglas,realce:identidad?.realce,logoUnidad:identidad?.logo,saes:'https://saes.'+solicitada+'.ipn.mx/',
      pestanas:['trayectoria','mapa','calendario','guia'].filter(t=>!oculta(t)),grupos:[['trayectoria'],['mapa','calendario','guia'].filter(t=>!oculta(t))],tramites:[]};
  }
  const inicial = entrada ? null : SateRutas.ruta(location.hash, solicitada, config);
  const unidad = inicial?.unidad || solicitada;
  window.SATE_UNIDAD = config[unidad] ? unidad : null;
  const u = window.SATE_UNIDAD, cfg = config[u];
  const guiaLigera = inicial?.pestana === 'guia' || inicial?.padre === 'guia';
  let unidadRealce = u;
  const raiz = document.documentElement, temaSistema = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener() {} };
  function colorHalo(id) {
    const tema = raiz.getAttribute('data-theme') || raiz.getAttribute('data-tema');
    const oscuro = tema ? tema === 'dark' || tema === 'oscuro' : temaSistema.matches;
    const realce = config[id]?.realce || SATE_CONFIG.identidadUnidades?.[id]?.realce;
    return realce?.[oscuro ? 'oscuro' : 'claro'] || 'var(--sate-acento-base)';
  }
  function aplicarRealce(id = unidadRealce) {
    unidadRealce = id;
    const tema = raiz.getAttribute('data-theme') || raiz.getAttribute('data-tema');
    const oscuro = tema ? tema === 'dark' || tema === 'oscuro' : temaSistema.matches;
    const realce = (config[id]?.realce || SATE_CONFIG.identidadUnidades?.[id]?.realce)?.[oscuro ? 'oscuro' : 'claro'];
    // Elegir el mayor contraste evita texto blanco ilegible sobre los realces claros del tema oscuro.
    const luminancia = hex => hex.slice(1).match(/../g).map(h => parseInt(h,16)/255)
      .map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4)
      .reduce((s,c,i) => s+c*[.2126,.7152,.0722][i],0);
    const l = realce ? luminancia(realce) : null, negro = luminancia('#18181b');
    raiz.style.setProperty('--sate-realce', realce || 'var(--sate-acento-base)');
    raiz.style.setProperty('--sate-sobre-realce', realce ? (1.05/(l+.05) >= (l+.05)/(negro+.05) ? '#ffffff' : '#18181b') : 'var(--sate-sobre-base)');
    for (const halo of document.querySelectorAll('.sate-logo-halo')) halo.style.setProperty('--halo', colorHalo(halo.dataset.unidad));
  }
  aplicarRealce();
  if (typeof MutationObserver === 'function') new MutationObserver(() => aplicarRealce()).observe(raiz, {attributes:true,attributeFilter:['data-theme','data-tema']});
  temaSistema.addEventListener('change', () => aplicarRealce());
  // plurales ICU mínimos del TOML: {n, plural, one {# materia} other {# materias}} (un nivel, «#» = el número)
  const reglaPlural = new Intl.PluralRules('es-MX'), numero = new Intl.NumberFormat('es-MX');
  const plurales = (s, vars) => s.replace(/\{(\w+),\s*plural,\s*((?:[^{}]*\{[^{}]*\})+)\s*\}/g, (m, k, cuerpo) => {
    const n = Number(vars[k]); if (Number.isNaN(n)) return m;
    const op = {}; cuerpo.replace(/(=?\w+)\s*\{([^{}]*)\}/g, (_, c, t) => { op[c] = t; });
    return (op['=' + n] ?? op[reglaPlural.select(n)] ?? op.other ?? '').replace(/#/g, numero.format(n));
  });
  const texto = (clave, vars = {}) => plurales(SATE_CONFIG.textos[clave] || clave, vars).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '{' + k + '}');
  SateUI.usarTextos(texto);
  document.addEventListener('click',e=>{
    const a=e.target.closest?.('a[href]');
    const destino=a?.getAttribute('href');
    if(destino?.startsWith('#/') && actual && destino!==location.hash &&
      /\/guia(?:\/|$|\?)/.test(location.hash)!==/\/guia(?:\/|$|\?)/.test(destino)) {
      pendientePuente={hash:location.hash,y:window.scrollY,nombre:texto('sate.pestana.'+(actual.padre||actual.pestana)+'.titulo')};
    }
    const m=a?.getAttribute('href')?.match(/^#\/[^/]+\/guia\/reglamentos\/([\w-]+)\/art-([\w %.-]+)$/);
    if(!m || a.closest('.guia-articulo') || actual?.pestana==='guia' || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey)return;
    pendientePuente=null;
    e.preventDefault();
    SATE.articulo(m[1],decodeURIComponent(m[2]).split('.')[0]).catch(error);
  });
  let regresoPuente = null, pendientePuente = null;
  function guardarPuente(origen, destino) {
    if(regresoPuente) return;
    try { sessionStorage.setItem('ipnt.puente', JSON.stringify({origen,destino})); }
    catch(e) { console.debug('SATE: regreso sin almacenamiento', {mensaje:e.message}); }
  }
  function pintarPlataformas(r) {
    if(!document.querySelector('.sate-marca'))return;
    const guia = r.padre === 'guia' || r.pestana === 'guia';
    let boton = document.getElementById('b-plataforma');
    if(!boton) {
      const siglas=document.querySelector('.sate-siglas');
      boton=document.createElement('button');boton.setAttribute('id','b-plataforma');
      boton.type='button';boton.className='sate-unidad-btn sate-siglas';
      boton.setAttribute('aria-haspopup','dialog');
      siglas.parentNode.replaceChild(boton,siglas);
    }
    boton.textContent=texto(guia?'sate.pestana.guia.titulo':'sate.siglas');
    boton.setAttribute('aria-label',boton.textContent+'. '+texto('sate.puentes.plataformas'));
    boton.onclick=()=>selectorMarca(texto('sate.puentes.plataformas'),['sate','guia'].map(id=>({
      texto:texto(id==='guia'?'sate.pestana.guia.titulo':'sate.puentes.sate'),
      href:'#/'+u+'/'+(id==='guia'?'guia':'mapa'),actual:(id==='guia')===guia
    })));
    document.documentElement.setAttribute('data-vista',guia?'guia-vinculada':'');
  }
  function restaurarPuente(r) {
    const previo=document.getElementById('sate-regresar');
    if(previo?.parentNode?.classList?.contains('sate-regreso'))previo.parentNode.parentNode?.removeChild(previo.parentNode);
    else previo?.remove?.();
    if(regresoPuente?.hash===r.hash) {
      const y=regresoPuente.y;regresoPuente=null;
      requestAnimationFrame(()=>window.scrollTo(0,y));return;
    }
    let p;
    try { p=JSON.parse(sessionStorage.getItem('ipnt.puente')); } catch { return; }
    if(!p)return;
    if(p.destino!==r.hash){try{sessionStorage.removeItem('ipnt.puente')}catch{}return;}
    if(!SateRutas.ruta(p.origen?.hash||'',u,config) || !Number.isFinite(p.origen.y))return;
    const a=document.createElement('a');a.setAttribute('id','sate-regresar');a.className='sate-regresar';a.setAttribute('href',p.origen.hash);
    a.append(document.createTextNode('‹ '),document.createTextNode(texto('sate.puentes.regresar',{origen:p.origen.nombre}).replace(/^‹\s*/,'')));
    a.onclick=()=>{regresoPuente=p.origen;try{sessionStorage.removeItem('ipnt.puente')}catch{}};
    const control=document.createElement('div');control.className='sate-regreso';control.appendChild(a);
    const cerrar=document.createElement('button');cerrar.type='button';cerrar.className='sate-regreso-cerrar';cerrar.textContent='×';
    cerrar.setAttribute('aria-label',texto('componentes.cerrar'));
    cerrar.onclick=()=>{try{sessionStorage.removeItem('ipnt.puente')}catch{}control.parentNode?.removeChild(control)};control.appendChild(cerrar);
    const contenido=r.pestana==='guia'?document.getElementById('sate-guia'):document.getElementById('v-tray');
    contenido?.parentNode?.insertBefore(control,contenido);
  }
  let rutaFallida = null;
  function error(e) {
    console.error('SATE: carga fallida', {unidad:u, ruta:location.hash, mensaje:e.message, pila:e.stack});
    const p = document.getElementById('sate-carga');
    p.hidden = false;
    const mensaje = document.createElement('p'); mensaje.textContent = texto('sate.vista_error', {detalle: e.message});
    const reintentar = document.createElement('button'); reintentar.type = 'button'; reintentar.textContent = texto('sate.vista_reintentar');
    reintentar.onclick = () => { if (rutaFallida) activar(rutaFallida).catch(error); };
    p.replaceChildren(mensaje, reintentar);
  }
  function script(src) {
    const medida = !cargas.has(src) && window.SateMedicion?.iniciar('recurso', src);
    if (!cargas.has(src)) cargas.set(src, new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = src;
      if(/^https?:/.test(src)){
        const integridad={};
        if(!integridad[src]){cargas.delete(src);no(new Error('Biblioteca externa sin integridad: '+src));return}
        s.integrity=integridad[src];s.crossOrigin='anonymous';
      }
      s.onload = () => { window.SateMedicion?.terminar(medida); window.SateMedicion?.instrumentar(); ok(); }; s.onerror = () => { window.SateMedicion?.terminar(medida,{error:true}); cargas.delete(src); no(new Error('Archivo: ' + src)); };
      document.head.appendChild(s);
    }));
    return cargas.get(src);
  }
  const datosCache = new Map();
  function jsonURL(url) {
    const medida = !datosCache.has(url) && window.SateMedicion?.iniciar('recurso', url);
    if (!datosCache.has(url)) datosCache.set(url, fetch(url).then(r => {
      if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
      if (!window.SateMedicion) return r.json();
      return r.text().then(src => {
        window.SateMedicion?.terminar(medida);
        return window.SateMedicion ? window.SateMedicion.render('parse JSON ' + url, () => JSON.parse(src)) : JSON.parse(src);
      });
    }).catch(e => { window.SateMedicion?.terminar(medida,{error:true}); datosCache.delete(url); throw e; }));
    return datosCache.get(url);
  }
  const json = nombre => jsonURL('datos/' + u + '/' + nombre + '.json');
  const precarga = SateRutas.precargador(cfg || {}, u, jsonURL);
  async function prepararTramite(id) {
    const clave = id.startsWith('baja_') ? 'bajas' : id;
    if (!['dictamen','bajas'].includes(clave) || !window.SATE_DATA[clave]) return;
    window.SATE_DATA[clave].pdfs ||= await json(clave + '-pdf');
  }
  let oferta;
  function cargarOferta() {
    return oferta ||= json('oferta').then(d => {
      Object.assign(window.SATE_DATA, d);
      if (api) api.ofertaLista();
    }).catch(e => { oferta = null; throw e; });
  }
  async function modulo(id) {
    if (cfg.generica && !['calendario','guia','temarios'].includes(id)) return modulos[id];
    if (id === 'trayectoria') await script('desempeno.js');
    if (id === 'calendario') await script('calendario.js');
    if (id === 'horarios' && cfg.cupos) { await script('cupos.js'); await script('cupos-vista.js'); }
    if (id === 'mapa' || id === 'horarios') await script(id + '.js');
    if (id === 'guia') await Promise.all([script('bibliotecas.js'), script('actividades.js'), script('guia.js')]);
    if (id === 'temarios') await Promise.all([script('bibliotecas.js'), script('actividades.js'), script('guia.js'), script('temarios.js')]);
    if (id === 'tramites' && !cargas.has('tramites.json')) {
      cargas.set('tramites.json',json('tramites').then(d=>Object.assign(window.SATE_DATA,d)).catch(e=>{cargas.delete('tramites.json');throw e}));
    }
    if (id === 'tramites') {
      await cargas.get('tramites.json'); await script('tramites.js');
      for (const tramite of cfg.tramites) {
        if (tramite === 'electivas') await script('../tramites/electivas-reglas.js');
        await script(cfg.scriptsTramite?.[tramite] || tramite + '.js');
      }
    }
    if (!modulos[id]) throw new Error('Módulo sin registrar: ' + id);
    return modulos[id];
  }
  // Los temarios son una vista con ruta propia (data/sate.json: vistas); sin datos en la unidad, esta carga no existe.
  function cargarTemarios() {
    if (!cfg.vistas?.some(v => v.id === 'temarios')) return null;
    return temariosListos ||= Promise.all([script('bibliotecas.js'), script('temarios.js')])
      .then(() => SATE.temarios.preparar()).catch(e => { temariosListos = null; console.debug('SATE: temarios no disponibles', e.message); });
  }
  function ir(id) {
    const externa=cfg.vistas?.find(v=>v.id===id&&v.externa&&v.habilitada!==false&&!oculta(v.id));
    if(externa){location.href=externa.href;return}
    location.hash = '#/' + u + '/' + id;
  }
  function adaptarPestanas() {
    const contenedor = document.getElementById('sate-tabs'), navegacion = contenedor?.closest?.('.sate-navegacion');
    const controles = navegacion?.querySelector('.sate-controles') || document.querySelector?.('header.top .sate-controles');
    // La navegación sigue funcionando en un contenedor sin medición responsiva.
    if (!navegacion || !controles) return;
    const medicion = document.createElement('div');
    medicion.className = 'sate-medicion'; medicion.setAttribute('aria-hidden','true'); medicion.inert = true;
    navegacion.appendChild(medicion);
    let pendiente = false;
    function calcular() {
      pendiente = false;
      // La copia conserva la tipografía y los grupos, sin depender del escalón visible.
      // Todas las etiquetas se miden en negrita para que cambiar de pestaña no cambie el escalón.
      const copia = tabs.cloneNode(true), carrera = controles.cloneNode(true);
      for (const nodo of [copia, carrera, ...copia.querySelectorAll('[id]'), ...carrera.querySelectorAll('[id]')]) nodo.removeAttribute('id');
      medicion.replaceChildren(copia, carrera);
      copia.dataset.escalon = 'completo';
      const completo = Math.max(copia.scrollWidth + copia.offsetWidth - copia.clientWidth, Math.ceil(copia.getBoundingClientRect().width));
      copia.dataset.escalon = 'corto';
      const corto = Math.max(copia.scrollWidth + copia.offsetWidth - copia.clientWidth, Math.ceil(copia.getBoundingClientRect().width));
      const estilo = getComputedStyle(navegacion);
      const disponible = navegacion.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
      const enFila = completo + carrera.getBoundingClientRect().width + (parseFloat(estilo.columnGap) || 0) <= disponible;
      const escalon = completo <= disponible ? 'completo' : corto <= disponible ? 'corto' : 'flotante';
      const separado = !enFila;
      const foco = document.activeElement;
      if (navegacion.dataset.controlesSeparados !== String(separado)) navegacion.dataset.controlesSeparados = String(separado);
      if (tabs.dataset.escalon !== escalon) tabs.dataset.escalon = escalon;
      document.body.classList.toggle('sate-flotante', escalon === 'flotante');
      // Si el cambio oculta el botón enfocado, conservar el foco en la navegación equivalente.
      if (escalon === 'flotante' && tabs.contains(foco)) (barra.querySelector('[data-id="'+foco.dataset.id+'"]') || barra.querySelector('[data-id="mas"]')).focus();
      else if (escalon !== 'flotante' && !(typeof matchMedia === 'function' && matchMedia('(max-width:639px)').matches) && barra.contains(foco)) tabs.querySelector('[data-id="'+(foco.dataset.id==='mas' ? (actual?.padre || actual?.pestana) : foco.dataset.id)+'"]').focus();
    }
    function programar() { if (!pendiente) { pendiente = true; requestAnimationFrame(calcular); } }
    recalcularPestanas=programar;
    new ResizeObserver(programar).observe(navegacion);
    // La bandeja puede envolver o cambiar con la selección: reservar su alto real.
    const bandeja=document.querySelector?.('.plan-bandeja');
    if(bandeja)new ResizeObserver(()=>{
      document.documentElement.style.setProperty('--sate-plan-alto',Math.ceil(bandeja.getBoundingClientRect().height)+'px');
    }).observe(bandeja);
    new MutationObserver(programar).observe(tabs, {childList:true,subtree:true,characterData:true});
    new MutationObserver(programar).observe(document.documentElement, {attributes:true,attributeFilter:['lang','class','style','data-pestanas']});
    if (document.fonts) { document.fonts.ready.then(programar); document.fonts.addEventListener('loadingdone',programar); }
    addEventListener('resize',programar);
    programar();
  }
  function logoUnidad(id, nombre) {
    const halo = document.createElement('span'); halo.className = 'sate-logo-halo'; halo.dataset.unidad = id;
    halo.style.setProperty('--halo', colorHalo(id));
    const img = document.createElement('img'); img.className = 'sate-logo-unidad';
    img.src = SATE_CONFIG.identidadUnidades?.[id]?.logoDisponible===false?'../assets/logos/ipn-isologo-guinda.webp':'../assets/logos/unidades/' + (SATE_CONFIG.identidadUnidades?.[id]?.logo || config[id]?.logoUnidad || 'ipn') + '.webp';
    img.alt = nombre; img.onerror = () => { halo.hidden = true; img.hidden = true; };
    halo.appendChild(img);
    return halo;
  }
  function selectorMarca(titulo, opciones) {
    const caja = document.createElement('div');
    caja.className='sate-selector-marca';
    for(const opcion of opciones) {
      const boton=document.createElement(opcion.href?'a':'button');
      boton.className='btn';boton.textContent=opcion.texto;
      if(opcion.href)boton.setAttribute('href',opcion.href);else boton.type='button';
      if(opcion.actual)boton.setAttribute('aria-current','page');
      boton.onclick=()=>{dialogo?.cerrar();opcion.accion?.()};
      caja.appendChild(boton);
    }
    const dialogo=SateUI.modal(titulo,caja);
  }
  function elegirUnidad() {
    // La entrada explícita conserva el perfil y la preferencia hasta elegir otra unidad.
    selectorMarca(texto('sate.encabezado.unidad'),[{texto:texto('sate.entrada.cambiar'),accion:()=>{location.href='index.html?sateEntrada=1'}}]);
  }
  async function mostrarEntrada() {
    // La cuenta y el Lector deben estar listos antes de habilitar la selección y el pegado.
    await script('generico.js');
    document.body.setAttribute('data-sate-entrada','true');
    document.getElementById('b-unidad').hidden=true;
    for (const selector of ['.sate-navegacion','.sate-fila-avisos','.bar-top']) document.querySelector(selector).hidden=true;
    document.getElementById('sate-carga').hidden=true;
    const panel=document.getElementById('sate-entrada'); panel.hidden=false;
    const titulo=document.createElement('h2'); titulo.id='sate-entrada-titulo'; titulo.textContent=texto('sate.entrada.titulo');
    const alternativa=document.createElement('button'); alternativa.type='button'; alternativa.className='btn primary';
    alternativa.textContent=texto('sate.entrada.saes'); alternativa.setAttribute('data-saes-open','');
    const etiqueta=document.createElement('label'); etiqueta.htmlFor='sate-unidad-buscar'; etiqueta.textContent=texto('sate.entrada.buscar');
    const buscar=document.createElement('input'); buscar.type='search'; buscar.id=etiqueta.htmlFor; buscar.autocomplete='off';
    const lista=document.createElement('ul'); lista.className='sate-unidades'; lista.id='sate-unidades'; buscar.setAttribute('aria-controls',lista.id);
    const estado=document.createElement('p'); estado.className='muted'; estado.setAttribute('role','status');
    const normal=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
    const unidades=Object.entries(SATE_CONFIG.identidadUnidades).sort(([a,ca],[b,cb])=>Number(!!config[b])-Number(!!config[a])||ca.siglas.localeCompare(cb.siglas,'es'));
    const filas=unidades.map(([id,c])=>{
      const fila=document.createElement('li'), boton=document.createElement('button'); boton.type='button'; boton.className='btn sate-selector-unidad';
      boton.dataset.unidad=id;
      const nombres=document.createElement('span'), siglas=document.createElement('strong'), nombre=document.createElement('span');
      siglas.textContent=c.siglas; nombre.textContent=c.nombre; nombres.appendChild(siglas); nombres.appendChild(nombre);
      const logo=logoUnidad(id,c.nombre); logo.querySelector('img').alt='';
      boton.style.setProperty('--halo',colorHalo(id));
      boton.appendChild(logo); boton.appendChild(nombres);
      boton.onclick=()=>{IPNT.set('ipnt.unidad',id);location.href='index.html?sateUnidad='+id};
      fila.appendChild(boton); lista.appendChild(fila); return {fila,terminos:normal(c.siglas+' '+c.nombre)};
    });
    buscar.addEventListener('input',()=>{
      let n=0; for(const {fila,terminos} of filas){fila.hidden=!terminos.includes(normal(buscar.value.trim()));if(!fila.hidden)n++}
      estado.textContent=texto(n?'sate.entrada.resultados':'sate.entrada.sin_resultados',{n});
    });
    panel.replaceChildren(titulo,alternativa,etiqueta,buscar,estado,lista);
  }
  async function activar(r) {
    if (!r || !api) return;
    rutaFallida = r;
    // El núcleo académico conserva sus globales: se inicia al cruzar a SATE.
    if (guiaLigera && r.pestana !== 'guia' && r.padre !== 'guia') { location.reload(); return; }
    const medida = window.SateMedicion?.iniciar('ruta', r.pestana);
    let v;
    try {
    if (unidadRealce || r.unidad !== u) aplicarRealce(r.unidad);
    // La Guía ligera no carga nucleo.js (IPNT); la ruta ya trae la unidad al recargar.
    if (r.unidad !== u) { window.IPNT?.set('ipnt.unidad', r.unidad); location.reload(); return; }
    v = ++version;
    const marca = r.vista ? r.padre : r.pestana;
    seleccionProgramada = true; tabs.seleccionar(marca); seleccionProgramada = false; barra.marcar(marca);
    if (actual) modulos[actual.pestana]?.ocultar?.();
    const espera = document.getElementById('sate-carga');
    espera.textContent = texto('sate.pestana.' + marca + '.titulo'); espera.style.minHeight = '40vh'; espera.hidden = false;
    for (const id of ['v-tray','sate-trayectoria','sate-calendario','v-hor','sate-tramites','sate-temarios','sate-guia']) document.getElementById(id).hidden = true;
    // Incluso con caché caliente se entrega un frame antes de montar o calcular la vista.
    if (window.requestAnimationFrame) await new Promise(ok => requestAnimationFrame(() => setTimeout(ok, 0)));
    if (v !== version) return;
    // El mapa y sus sugeridas necesitan los grupos; no pintar una copia parcial de la oferta.
    const [m] = await Promise.all([modulo(r.pestana),
      !cfg.generica && (r.pestana === 'mapa' || r.pestana === 'horarios') ? cargarOferta() : null,
      r.pestana === 'guia' && cfg.guiaDatos ? json('guia/indice') : null,
      r.pestana === 'temarios' ? json('temarios/indice') : null]);
    if (v !== version) return;
    if (r.pestana === 'tramites' && r.tramite) await prepararTramite(r.tramite);
    if (v !== version) return;
    const origenPuente = pendientePuente || actual && {hash:actual.hash, y:window.scrollY, nombre:texto('sate.pestana.'+(actual.padre||actual.pestana)+'.titulo')};
    const cruza = actual && (actual.padre === 'guia' || actual.pestana === 'guia') !== (r.padre === 'guia' || r.pestana === 'guia');
    if(cruza) guardarPuente(origenPuente, r.hash);
    pendientePuente=null;
    actual = r;
    pintarPlataformas(r);
    if (location.hash.startsWith('#/') && location.hash !== r.hash) history.replaceState(null,'',location.pathname+location.search+r.hash);
    api.estado.tab = r.pestana === 'horarios' ? 'hor' : 'tray';
    if (!montados.has(r.pestana)) {
      if (window.SateMedicion) window.SateMedicion.render('montar ' + r.pestana, () => m.montar?.());
      else m.montar?.();
      montados.add(r.pestana);
    }
    document.getElementById('v-tray').hidden = r.pestana !== 'mapa';
    document.getElementById('sate-trayectoria').hidden = r.pestana !== 'trayectoria';
    document.getElementById('sate-calendario').hidden = r.pestana !== 'calendario';
    document.getElementById('v-hor').hidden = r.pestana !== 'horarios';
    document.getElementById('sate-tramites').hidden = r.pestana !== 'tramites';
    document.getElementById('sate-temarios').hidden = r.pestana !== 'temarios';
    document.getElementById('sate-guia').hidden = r.pestana !== 'guia';
    const panel = document.getElementById(r.pestana === 'guia' ? 'sate-guia' : r.pestana === 'horarios' ? 'v-hor' : r.pestana === 'tramites' ? 'sate-tramites' : r.pestana === 'temarios' ? 'sate-temarios' : r.pestana === 'trayectoria' ? 'sate-trayectoria' : r.pestana === 'calendario' ? 'sate-calendario' : 'v-tray');
    panel.setAttribute('role','tabpanel');
    panel.setAttribute('aria-labelledby',(tabs.querySelector('[data-id="'+marca+'"]') || document.getElementById('b-plataforma')).id);
    api.store.set('ruta', r.hash);
    document.getElementById('sate-carga').hidden = true;
    await repintar();
    restaurarPuente(r);
    } catch (e) {
      if (v == null || v === version) throw e;
      console.debug('SATE: carga de ruta sustituida', {pestana:r.pestana, mensaje:e.message});
    } finally { window.SateMedicion?.terminar(medida, {desdeNavegacion:performance.now(), sustituida:v !== version}); }
  }
  function repintar() {
    if (!actual) return;
    if (!guiaLigera && !cfg.generica && window.SATE_DATA.mapas[api.estado.car]?.generico && !['horarios','calendario','temarios','guia'].includes(actual.pestana)) { ir('horarios'); return; }
    api.renderTop(); api.renderAviso(); SATE.presente?.avisos();
    const m = window.SateMedicion;
    const guiaSola = actual.padre==='guia' || actual.pestana==='guia';
    document.title = texto(actual.tramite ? 'sate.tramite.' + actual.tramite + '.titulo' : 'sate.pestana.' + (actual.padre || actual.pestana) + '.titulo') + (guiaSola ? ' — ' + texto('sate.pestana.guia.titulo') : ' — SATE');
    const pendiente = m ? m.render(actual.pestana, () => modulos[actual.pestana].mostrar(actual)) : modulos[actual.pestana].mostrar(actual);
    SATE.calendario?.pintarRecorte(actual.pestana);
    document.body.setAttribute('data-sate-pestana',actual.pestana);
    // La entrada ligera de la Guía no monta los controles académicos de Horarios.
    for (const id of ['sate-oferta-periodo','notice','mobnote']) {
      const nodo = document.getElementById(id);
      if (nodo) nodo.hidden = id === 'mobnote' || cfg.generica || actual.pestana !== 'horarios';
    }
    return pendiente;
  }
  async function iniciarRecorrido() {
    try { await script('recorrido.js'); await SateRecorrido.iniciar(); }
    catch(e) { console.error('SATE: recorrido fallido',{mensaje:e.message,pila:e.stack}); SateUI.modal(texto('sate.encabezado.ayuda'),texto('sate.recorrido.error'),{pequeno:true}); }
  }
  window.SATE = {texto, modulos, error, script, json:jsonURL, prepararTramite, identidadSaes, cargarTemarios, get actual(){return actual}, get almacen(){return api?.store}, pestana(id, m) { modulos[id] = m; }, ir, elegirUnidad, repintar, cargarOferta,
    async visitar(id) { const r=SateRutas.ruta('#/'+u+'/'+id,u,config);if(!r)return;history.replaceState(null,'',location.pathname+location.search+r.hash);await activar(r); },
    articulo: async (doc, n) => { await script('guia.js'); return SATE.articulo(doc, n); },
    async nucleoListo(a) {
      api = a; if (!cfg.generica && !guiaLigera) await script('situacion.js'); SateUI.usarAlmacen({leer,guardar:(k,v)=>IPNT.set(k,v)});
      const r = SateRutas.ruta((cuposReducida||location.hash==='#cupos')&&cfg.cupos?'#/'+u+'/horarios':location.hash, u, config) ||
        SateRutas.ruta('#/' + u + '/' + (api.personal() && cfg.pestanas.includes('trayectoria') ? 'trayectoria' : 'mapa'), u, config);
      actualizarPestanas(r.vista ? r.padre : r.pestana);
      adaptarPestanas();
      addEventListener('hashchange',()=>{const r=SateRutas.ruta(location.hash,u,config);if(r)activar(r).catch(error)});
      // Un hash ajeno pertenece a cuenta/tema/demo: nunca se reemplaza por una ruta SATE.
      if (!location.hash) history.replaceState(null,'',location.pathname+location.search+r.hash);
      await activar(r);
      // Las otras pestañas solo se descargan por intención, nunca por estar en reposo.
      document.getElementById('sate-ayuda-recorrido').onclick=()=>iniciarRecorrido();
      if(cuposReducida&&cfg.cupos){await script('cupos-vista.js');await SateCuposVista.montar();await script('cupos-receptor.js')}
    }, actualizarPestanas
  };
  function actualizarPestanas(activa=actual?.padre || actual?.pestana){
      if(!cfg.pestanas.includes(activa))activa=api.personal()?'trayectoria':'mapa';
      const items = cfg.pestanas.filter(id=>id!=='guia').map(id => ({id,grupo:cfg.grupos.findIndex(g=>g.includes(id)),texto:texto('sate.pestana.'+id+'.titulo'),corto:texto('sate.pestana.'+id+'.corto')}));
      for(const v of cfg.vistas||[])if(v.externa&&v.habilitada!==false&&!oculta(v.id))items.push({id:v.id,href:v.href,texto:texto('sate.pestana.'+v.id+'.titulo'),corto:texto('sate.pestana.'+v.id+'.corto')});
      tabs = SateUI.pestanas({items,activa,alCambiar:id=>{if(!seleccionProgramada && SateRutas.requiereRaiz(actual,id))ir(id)}});
      document.getElementById('sate-tabs').replaceChildren();
      document.getElementById('sate-tabs').appendChild(tabs);
      for (const id of cfg.pestanas.filter(id=>id!=='guia')) tabs.querySelector('[data-id="'+id+'"]').setAttribute('aria-controls',id==='horarios'?'v-hor':id==='tramites'?'sate-tramites':id==='trayectoria'?'sate-trayectoria':id==='calendario'?'sate-calendario':'v-tray');
      barra?.remove?.();
      barra = SateUI.barraInferior({items:items.map(it=>({id:it.id,href:it.href,grupo:it.grupo,texto:it.corto,titulo:it.texto})),activa,alElegir:ir});
      document.body.appendChild(barra);
      const selectorPlan=document.getElementById('plan-periodos'), etiquetaPlan=document.getElementById('plan-vista-etiqueta'), anclaPlan=document.getElementById('plan-periodos-ancla');
      if(selectorPlan&&anclaPlan?.after){
        const botonMapa=barra.querySelector?.('[data-id="mapa"]');
        if(activa==='mapa'&&botonMapa){
          const envoltura=document.createElement('div');envoltura.className='sate-barra__plan';envoltura.setAttribute('aria-label',texto('sate.planeacion.periodos'));
          if(etiquetaPlan)envoltura.appendChild(etiquetaPlan);
          envoltura.appendChild(selectorPlan);barra.insertBefore(envoltura,botonMapa.nextSibling);
        }else{const destino=etiquetaPlan?.after?etiquetaPlan:anclaPlan;if(etiquetaPlan?.after)anclaPlan.after(etiquetaPlan);destino.after(selectorPlan)}
      }
      for (const nav of [tabs, barra]) for (const evento of ['pointerover','focusin']) nav.addEventListener?.(evento, e => {
        const id = e.target.closest?.('[data-id]')?.dataset.id;
        if (cfg.pestanas.includes(id)) precarga.precargar(id);
      });
      recalcularPestanas();
      if(actual&&(actual.padre || actual.pestana)!==activa)activar(SateRutas.ruta('#/'+u+'/'+activa,u,config)).catch(error);
  }
  // Una fuente externa lenta no debe detener scripts ni la primera pintura.
  const fuentes = document.getElementById('sate-fuentes');
  if (fuentes) {
    if (fuentes.sheet) fuentes.media = 'all';
    else fuentes.addEventListener('load', () => { fuentes.media = 'all'; }, {once:true});
  }
  // Sin el parámetro no se descarga ni se ejecuta el módulo de diagnóstico.
  // Medición interna: solo con ?medir en un servidor local (el archivo no se publica).
  const medicionLista = parametros.has('medir') && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? script('medicion.js').catch(() => {}) : Promise.resolve();
  if (!u) { medicionLista.then(mostrarEntrada).catch(error); return; }
  // «SATE {unidad}»: la unidad es el botón subrayado (color de la unidad) que abre el cambio de unidad.
  const botonUnidad = document.getElementById('b-unidad');
  botonUnidad.textContent = texto('sate.encabezado.unidad_marca', {unidad: cfg.siglas}); botonUnidad.hidden = false;
  botonUnidad.setAttribute('aria-label', cfg.siglas + '. ' + texto('sate.encabezado.unidad')); botonUnidad.title = texto('sate.encabezado.unidad');
  const siglasSate = document.createElement('span'); siglasSate.className = 'sate-siglas'; siglasSate.textContent = texto('sate.siglas');
  const separador = document.createElement('span'); separador.className = 'sate-sep';
  document.getElementById('sate-titulo').replaceChildren(siglasSate, separador, botonUnidad);
  if (cfg.leyenda) {
    const ayuda = SateUI.ayuda('sate.leyenda.'+cfg.leyenda,{unidad:cfg.siglas});
    const boton = ayuda.querySelector('button');
    // El texto largo se oculta en móvil sin cambiar la escala tipográfica.
    const etiqueta = document.createElement('span');
    etiqueta.textContent = texto('sate.encabezado.prueba');
    boton.replaceChildren(etiqueta);
    boton.setAttribute('aria-label', texto('sate.encabezado.prueba')); boton.dataset.corto = texto('sate.encabezado.prueba_corto');
    document.getElementById('sate-leyenda').appendChild(ayuda);
  }
  // Logo de la unidad, hasta la derecha: el oficial de la unidad si lo hay; si no, el del catálogo SAES con su halo.
  const ranura = document.getElementById('sate-logo-unidad');
  if (cfg.logo) {
    const enlace = document.createElement('a'); enlace.className = 'unit'; enlace.href = cfg.logo.enlace;
    for (const [tema, clase] of [['claro','logo-lt'],['oscuro','logo-dk']]) {
      const img = document.createElement('img'); img.className = clase; img.src = '../' + cfg.logo[tema];
      img.alt = cfg.logo.alt; img.width = 91; img.height = 72; enlace.appendChild(img);
    }
    ranura.appendChild(enlace);
  } else ranura.appendChild(logoUnidad(u, cfg.nombre));
  function identidadSaes() {
    for (const a of document.querySelectorAll('#saes-dlg a')) {
      if (/^https?:\/\/saes\.[^/]+/.test(a.href||'') && a.protocol !== 'javascript:') {
        a.href = cfg.saes; a.textContent = cfg.saes.replace(/^https?:\/\//,'').replace(/\/$/,'');
      }
    }
  }
  medicionLista.then(() => {
    if (guiaLigera) {
      botonUnidad.addEventListener('click', elegirUnidad);
      document.getElementById('saes-open').addEventListener('click', () => {
        location.hash = '#/' + u + '/trayectoria'; location.reload();
      });
      return SATE.nucleoListo({estado:{}, personal:()=>false,
        store:{set(){},get:(_k,d)=>d},renderTop(){},renderAviso(){}});
    }
    if (cfg.generica) return script('generico.js');
    return json('nucleo').then(d=>{window.SATE_DATA=Object.assign({periodos:{actual:[],proximo:[]},asig:[],prof:[]},d);return script('nucleo.js')});
  }).catch(error);
})();
