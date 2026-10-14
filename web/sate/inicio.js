/* Los módulos clásicos comparten los globales históricos. Cambiar de unidad recarga
   el mismo punto de entrada para no mezclar estado ni registrar eventos dos veces. */
(function () {
  const config = SATE_CONFIG.unidades, cargas = new Map(), modulos = {}, montados = new Set();
  // Pestañas en rediseño: se ocultan en todas las unidades desde data/sate.json (pestanasOcultas).
  const oculta = t => (SATE_CONFIG.pestanasOcultas || []).includes(t);
  for (const c of Object.values(config)) { c.pestanas = c.pestanas.filter(t => !oculta(t)); c.grupos = (c.grupos || []).map(g => g.filter(t => !oculta(t))).filter(g => g.length); }
  const cascaron = document.querySelector('html[data-pestanas]');
  const variante = new URLSearchParams(location.search).get('pestanas');
  if (cascaron && ['v1','v3'].includes(variante)) cascaron.setAttribute('data-pestanas', variante);
  let api, actual, tabs, barra, version = 0, recalcularPestanas=()=>{};
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const parametros = new URLSearchParams(location.search), entrada = parametros.get('sateEntrada') === '1';
  let alumnoUnidad;
  try { alumnoUnidad = JSON.parse(leer('saes.alumno'))?.unidad; } catch {}
  const recordada = leer('ipnt.unidad');
  const solicitada = entrada ? null : location.hash.match(/^#\/([a-z0-9-]+)\//)?.[1] || parametros.getAll('sateUnidad').at(-1) || alumnoUnidad || recordada;
  if (solicitada && /^[a-z0-9-]+$/.test(solicitada) && !config[solicitada]) {
    const identidad = SATE_CONFIG.identidadUnidades?.[solicitada] || Object.values(SATE_CONFIG.identidadUnidades || {}).find(c=>c.alias?.includes(solicitada));
    const siglas = identidad?.siglas || solicitada.toUpperCase();
    config[solicitada] = {generica:true,siglas,nombre:identidad?.nombre || siglas,realce:identidad?.realce,logoUnidad:identidad?.logo,saes:'https://saes.'+solicitada+'.ipn.mx/',
      pestanas:['trayectoria','mapa','calendario'].filter(t=>!oculta(t)),grupos:[['trayectoria'],['mapa','calendario'].filter(t=>!oculta(t))],tramites:[]};
  }
  const inicial = entrada ? null : SateRutas.ruta(location.hash, solicitada, config);
  const unidad = inicial?.unidad || solicitada;
  window.SATE_UNIDAD = config[unidad] ? unidad : null;
  const u = window.SATE_UNIDAD, cfg = config[u];
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
  function error(e) {
    console.error('SATE: carga fallida', {unidad:u, ruta:location.hash, mensaje:e.message, pila:e.stack});
    const p = document.getElementById('sate-carga'); p.hidden = false; p.textContent = 'No se pudo cargar la vista. Recarga la página. ' + e.message;
  }
  function script(src) {
    if (!cargas.has(src)) cargas.set(src, new Promise((ok, no) => {
      const s = document.createElement('script'); s.src = src;
      s.onload = () => { window.SateMedicion?.instrumentar(); ok(); }; s.onerror = () => { cargas.delete(src); no(new Error('Archivo: ' + src)); };
      document.head.appendChild(s);
    }));
    return cargas.get(src);
  }
  async function json(nombre) {
    const url = 'datos/' + u + '/' + nombre + '.json', r = await fetch(url);
    if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
    return r.json();
  }
  let oferta;
  function cargarOferta() {
    return oferta ||= json('oferta').then(d => {
      Object.assign(window.SATE_DATA, d);
      if (api) api.ofertaLista();
    }).catch(e => { oferta = null; throw e; });
  }
  async function modulo(id) {
    if (cfg.generica && id !== 'calendario') return modulos[id];
    if (id === 'trayectoria') await script('desempeno.js');
    if (id === 'calendario') await script('calendario.js');
    if (id === 'mapa' || id === 'horarios') await script(id + '.js');
    if (id === 'tramites' && !cargas.has('tramites.json')) {
      cargas.set('tramites.json',json('tramites').then(d=>Object.assign(window.SATE_DATA,d)).catch(e=>{cargas.delete('tramites.json');throw e}));
    }
    if (id === 'tramites') {
      await cargas.get('tramites.json'); await script('tramites.js');
      for (const tramite of cfg.tramites) {
        if (tramite === 'electivas') await script('../tramites/electivas-reglas.js');
        await script(tramite + '.js');
      }
    }
    if (!modulos[id]) throw new Error('Módulo sin registrar: ' + id);
    return modulos[id];
  }
  function ir(id) { location.hash = '#/' + u + '/' + id; }
  function adaptarPestanas() {
    const contenedor = document.getElementById('sate-tabs'), navegacion = contenedor?.closest?.('.sate-navegacion');
    const controles = navegacion?.querySelector('.sate-controles');
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
      if (escalon === 'flotante' && tabs.contains(foco)) barra.querySelector('[data-id="'+foco.dataset.id+'"]').focus();
      else if (escalon !== 'flotante' && !(typeof matchMedia === 'function' && matchMedia('(max-width:720px)').matches) && barra.contains(foco)) tabs.querySelector('[data-id="'+foco.dataset.id+'"]').focus();
    }
    function programar() { if (!pendiente) { pendiente = true; requestAnimationFrame(calcular); } }
    recalcularPestanas=programar;
    new ResizeObserver(programar).observe(navegacion);
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
    img.src = '../assets/logos/unidades/' + (SATE_CONFIG.identidadUnidades?.[id]?.logo || config[id]?.logoUnidad || 'ipn') + '.webp';
    img.alt = nombre; img.onerror = () => { halo.hidden = true; img.hidden = true; };
    halo.appendChild(img);
    return halo;
  }
  function elegirUnidad() {
    const caja = document.createElement('div');
    const boton = document.createElement('button'); boton.type='button'; boton.className='btn'; boton.textContent=texto('sate.entrada.cambiar');
    // La entrada explícita conserva el perfil y la preferencia hasta elegir otra unidad.
    boton.onclick=()=>{location.href='index.html?sateEntrada=1'};
    caja.appendChild(boton);
    SateUI.modal(texto('sate.encabezado.unidad'), caja);
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
    const medida = window.SateMedicion?.iniciar('ruta', r.pestana);
    try {
    if (unidadRealce || r.unidad !== u) aplicarRealce(r.unidad);
    if (r.unidad !== u) { IPNT.set('ipnt.unidad', r.unidad); location.reload(); return; }
    const v = ++version;
    // El mapa y sus sugeridas necesitan los grupos; no pintar una copia parcial de la oferta.
    if (!cfg.generica && (r.pestana === 'mapa' || r.pestana === 'horarios')) await cargarOferta();
    const m = await modulo(r.pestana);
    if (r.pestana === 'tramites' && r.tramite === 'electivas') await SateElectivas.preparar();
    if (v !== version) return;
    if (actual) modulos[actual.pestana]?.ocultar?.();
    actual = r;
    if (location.hash.startsWith('#/') && location.hash !== r.hash) history.replaceState(null,'',location.pathname+location.search+r.hash);
    api.estado.tab = r.pestana === 'horarios' ? 'hor' : 'tray';
    if (!montados.has(r.pestana)) { m.montar?.(); montados.add(r.pestana); }
    tabs.seleccionar(r.pestana); barra.marcar(r.pestana);
    document.getElementById('v-tray').hidden = r.pestana !== 'mapa';
    document.getElementById('sate-trayectoria').hidden = r.pestana !== 'trayectoria';
    document.getElementById('sate-calendario').hidden = r.pestana !== 'calendario';
    document.getElementById('v-hor').hidden = r.pestana !== 'horarios';
    document.getElementById('sate-tramites').hidden = r.pestana !== 'tramites';
    const panel = document.getElementById(r.pestana === 'horarios' ? 'v-hor' : r.pestana === 'tramites' ? 'sate-tramites' : r.pestana === 'trayectoria' ? 'sate-trayectoria' : r.pestana === 'calendario' ? 'sate-calendario' : 'v-tray');
    panel.setAttribute('role','tabpanel');
    panel.setAttribute('aria-labelledby',tabs.querySelector('[data-id="'+r.pestana+'"]').id);
    api.store.set('ruta', r.hash);
    document.getElementById('sate-carga').hidden = true;
    repintar();
    } finally { window.SateMedicion?.terminar(medida); }
  }
  function repintar() {
    if (!actual) return;
    if (!cfg.generica && window.SATE_DATA.mapas[api.estado.car]?.generico && !['horarios','calendario'].includes(actual.pestana)) { ir('horarios'); return; }
    api.renderTop(); api.renderAviso(); SATE.presente.avisos();
    const m = window.SateMedicion;
    if (m) m.render(actual.pestana, () => modulos[actual.pestana].mostrar(actual));
    else modulos[actual.pestana].mostrar(actual);
    SATE.calendario?.pintarRecorte(actual.pestana);
    document.body.setAttribute('data-sate-pestana',actual.pestana);
    document.getElementById('sate-oferta-periodo').hidden=cfg.generica||actual.pestana!=='horarios';
    document.getElementById('notice').hidden=cfg.generica||actual.pestana!=='horarios';
    document.getElementById('mobnote').hidden=true;
  }
  window.SATE = {texto, modulos, error, script, identidadSaes, get actual(){return actual}, get almacen(){return api?.store}, pestana(id, m) { modulos[id] = m; }, ir, elegirUnidad, repintar, cargarOferta,
    async nucleoListo(a) {
      api = a; if (!cfg.generica) await script('situacion.js'); SateUI.usarAlmacen({leer,guardar:(k,v)=>IPNT.set(k,v)});
      const r = SateRutas.ruta(location.hash, u, config) ||
        SateRutas.ruta('#/' + u + '/' + (api.personal() && cfg.pestanas.includes('trayectoria') ? 'trayectoria' : 'mapa'), u, config);
      actualizarPestanas(r.pestana);
      adaptarPestanas();
      addEventListener('hashchange',()=>{const r=SateRutas.ruta(location.hash,u,config);if(r)activar(r).catch(error)});
      // Un hash ajeno pertenece a cuenta/tema/demo: nunca se reemplaza por una ruta SATE.
      if (!location.hash) history.replaceState(null,'',location.pathname+location.search+r.hash);
      await activar(r);
    }, actualizarPestanas
  };
  function actualizarPestanas(activa=actual?.pestana){
      if(!cfg.pestanas.includes(activa))activa=api.personal()?'trayectoria':'mapa';
      const items = cfg.pestanas.map(id => ({id,grupo:cfg.grupos.findIndex(g=>g.includes(id)),texto:texto('sate.pestana.'+id+'.titulo'),corto:texto('sate.pestana.'+id+'.corto')}));
      tabs = SateUI.pestanas({items,activa,alCambiar:id=>{if(actual && actual.pestana!==id)ir(id)}});
      document.getElementById('sate-tabs').replaceChildren();
      document.getElementById('sate-tabs').appendChild(tabs);
      for (const id of cfg.pestanas) tabs.querySelector('[data-id="'+id+'"]').setAttribute('aria-controls',id==='horarios'?'v-hor':id==='tramites'?'sate-tramites':id==='trayectoria'?'sate-trayectoria':id==='calendario'?'sate-calendario':'v-tray');
      barra?.remove?.();
      barra = SateUI.barraInferior({items:items.map(it=>({id:it.id,grupo:it.grupo,texto:it.corto,titulo:it.texto})),activa,alElegir:ir});
      document.body.appendChild(barra);
      recalcularPestanas();
      if(actual&&actual.pestana!==activa)activar(SateRutas.ruta('#/'+u+'/'+activa,u,config)).catch(error);
  }
  // Sin el parámetro no se descarga ni se ejecuta el módulo de diagnóstico.
  // Medición interna: solo con ?medir en un servidor local (el archivo no se publica).
  const medicionLista = parametros.has('medir') && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? script('medicion.js').catch(() => {}) : Promise.resolve();
  if (!u) { medicionLista.then(mostrarEntrada).catch(error); return; }
  const siglasUnidad = document.createElement('span'); siglasUnidad.className = 'sate-unidad'; siglasUnidad.textContent = cfg.siglas;
  document.getElementById('sate-titulo').replaceChildren(logoUnidad(u, cfg.nombre), texto('sate.siglas') + ' ', siglasUnidad);
  if (cfg.leyenda) {
    const ayuda = SateUI.ayuda('sate.leyenda.'+cfg.leyenda,{unidad:cfg.siglas});
    const boton = ayuda.querySelector('button');
    boton.textContent = texto('sate.encabezado.prueba');
    boton.setAttribute('aria-label', texto('sate.encabezado.prueba'));
    document.getElementById('sate-leyenda').appendChild(ayuda);
  }
  const nombreUnidad = document.querySelector('.inst-name');
  if (nombreUnidad) nombreUnidad.textContent = cfg.nombre;
  if (cfg.logo) {
    const enlace = document.createElement('a'); enlace.className = 'unit'; enlace.href = cfg.logo.enlace;
    for (const [tema, clase] of [['claro','logo-lt'],['oscuro','logo-dk']]) {
      const img = document.createElement('img'); img.className = clase; img.src = '../' + cfg.logo[tema];
      img.alt = cfg.logo.alt; img.width = 91; img.height = 72; enlace.appendChild(img);
    }
    document.querySelector('.inst-in')?.appendChild(enlace);
  }
  function identidadSaes() {
    for (const a of document.querySelectorAll('#saes-dlg a')) {
      if (/^https?:\/\/saes\.[^/]+/.test(a.href||'') && a.protocol !== 'javascript:') {
        a.href = cfg.saes; a.textContent = cfg.saes.replace(/^https?:\/\//,'').replace(/\/$/,'');
      }
    }
  }
  medicionLista.then(() => {
    if (cfg.generica) return script('generico.js');
    return json('nucleo').then(d=>{window.SATE_DATA=Object.assign({periodos:{actual:[],proximo:[]},asig:[],prof:[]},d);return script('nucleo.js')});
  }).catch(error);
})();
