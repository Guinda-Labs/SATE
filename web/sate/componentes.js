/* Componentes comunes de SATE (sin dependencias). Uso: SateUI.usarTextos(t); SateUI.chips([...]), etc.
   Los textos van por clave (contenido/textos/es.toml). Candidatos a subir a ipn-comun/componentes. */
(function (raiz) {
  'use strict';
  var traducir = function (k, v) { return typeof raiz.t === 'function' ? raiz.t(k, v) : k; };
  var guardar = null, leer = null;
  var MOVIL = '(max-width:720px)';
  var contador = 0;

  function usarTextos(fn) { traducir = fn; }
  /* Almacén del desplegable: por omisión IPNT.set si existe, o localStorage. */
  function usarAlmacen(o) { guardar = o.guardar; leer = o.leer; }
  function almGuardar(k, v) {
    if (guardar) return guardar(k, v);
    try { if (raiz.IPNT && raiz.IPNT.set) raiz.IPNT.set(k, v); else localStorage.setItem(k, v); } catch (e) {}
  }
  function almLeer(k) {
    if (leer) return leer(k);
    try { return localStorage.getItem(k); } catch (e) { return null; }
  }

  function el(tag, attrs, hijos) {
    var n = document.createElement(tag);
    for (var k in (attrs || {})) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'texto') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    (hijos || []).forEach(function (h) { if (h != null) n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h); });
    return n;
  }
  function esMovil() { return !!(raiz.matchMedia && (raiz.matchMedia(MOVIL).matches || raiz.matchMedia('(hover:none)').matches)); }
  function id(p) { return 'sate-' + p + '-' + (++contador); }
  var ESTADOS = { ok: '✓', aviso: '!', error: '✕', info: 'i' };
  function estado(e) { return ESTADOS[e] ? e : 'info'; }

  /* ---------- Modal ---------- */
  var dlg = null, origen = null, alCerrar = null;
  function crearDialogo() {
    var d = el('dialog', { class: 'sate-modal', 'aria-labelledby': 'sate-modal-titulo' }, [
      el('div', { class: 'sate-modal__cab' }, [
        el('h2', { id: 'sate-modal-titulo', class: 'sate-modal__titulo' }),
        el('button', { type: 'button', class: 'sate-modal__x', 'aria-label': traducir('componentes.cerrar'), texto: '✕' })
      ]),
      el('div', { class: 'sate-modal__cuerpo' }),
      el('div', { class: 'sate-modal__pie' })
    ]);
    d.querySelector('.sate-modal__x').addEventListener('click', function () { cerrar(); });
    d.addEventListener('click', function (e) { if (e.target === d) cerrar(); });   // clic en el fondo
    d.addEventListener('cancel', function (e) { e.preventDefault(); cerrar(); });  // Esc
    d.addEventListener('keydown', function (e) {   // respaldo del foco atrapado si showModal no existe
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(d.querySelectorAll('button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex="-1"])'), function (x) { return !x.disabled && x.offsetParent !== null; });
      if (!f.length) return;
      var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    });
    document.body.appendChild(d);
    return d;
  }
  /* modal(titulo, contenido, {acciones:[{texto, primaria, cierra, onclick}], pequeno, alCerrar})
     contenido: texto (cadena), Node o función que devuelve Node. Devuelve {cerrar, elemento}. */
  function modal(titulo, contenido, op) {
    op = op || {};
    if (!dlg) dlg = crearDialogo();
    var abierto = dlg.open;
    if (!abierto) origen = document.activeElement;
    alCerrar = op.alCerrar || null;
    dlg.querySelector('.sate-modal__titulo').textContent = titulo;
    dlg.querySelector('.sate-modal__x').setAttribute('aria-label', traducir('componentes.cerrar'));
    dlg.classList.toggle('sate-modal--pequeno', !!op.pequeno);
    var cuerpo = dlg.querySelector('.sate-modal__cuerpo');
    cuerpo.textContent = '';
    var c = typeof contenido === 'function' ? contenido() : contenido;
    if (c != null) cuerpo.appendChild(typeof c === 'string' ? el('p', { texto: c }) : c);
    var pie = dlg.querySelector('.sate-modal__pie');
    pie.textContent = '';
    pie.hidden = !(op.acciones && op.acciones.length);
    (op.acciones || []).forEach(function (a) {
      var b = el('button', { type: 'button', class: 'sate-btn' + (a.primaria ? ' sate-btn--primario' : ''), texto: a.texto });
      b.addEventListener('click', function () { if (a.onclick) a.onclick(); if (a.cierra !== false) cerrar(); });
      pie.appendChild(b);
    });
    if (!abierto) {
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      document.documentElement.classList.add('sate-sin-scroll');
    }
    cuerpo.scrollTop = 0;
    var foco = dlg.querySelector('.sate-modal__pie .sate-btn--primario') || dlg.querySelector('.sate-modal__x');
    foco.focus();
    return { cerrar: cerrar, elemento: dlg };
  }
  function cerrar() {
    if (!dlg || !dlg.open) return;
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
    document.documentElement.classList.remove('sate-sin-scroll');
    var o = origen, f = alCerrar;
    origen = null; alCerrar = null;
    if (o && o.focus && document.contains(o)) o.focus();
    if (f) f();
  }

  /* ---------- Chips de estado ---------- */
  /* chips([{id, estado, texto, abre}], contenedor?) ; abre: función o {titulo, contenido, acciones}. Máx. 5. */
  function chips(lista, donde) {
    if (lista.length > 5 && raiz.console) console.warn('chips: máximo 5 (se muestran los primeros 5)');
    var fila = donde || el('div');
    fila.textContent = '';
    fila.className = 'sate-chips';
    fila.setAttribute('role', 'list');
    lista.slice(0, 5).forEach(function (c) {
      var e = estado(c.estado);
      var hijos = [
        el('span', { class: 'sate-chip__marca', 'aria-hidden': 'true', texto: ESTADOS[e] }),
        el('span', { class: 'sate-sr', texto: traducir('componentes.estado.' + e) + ': ' }),
        el('span', { class: 'sate-chip__texto', texto: c.texto })
      ];
      var attrs = { class: 'sate-chip', 'data-estado': e, 'data-id': c.id };
      var n;
      if (c.abre) {
        attrs.type = 'button'; attrs['aria-haspopup'] = 'dialog';
        n = el('button', attrs, hijos);
        n.addEventListener('click', function () {
          if (typeof c.abre === 'function') c.abre(n);
          else modal(c.abre.titulo || c.texto, c.abre.contenido, { acciones: c.abre.acciones });
        });
      } else n = el('span', attrs, hijos);
      fila.appendChild(el('span', { role: 'listitem', class: 'sate-chips__item' }, [n]));
    });
    return fila;
  }

  /* Una sola línea; el nombre accesible conserva el proceso y la fecha sin truncar. */
  function recorteCalendario(eventos) {
    if (!eventos.length) return null;
    var e = eventos[0], fecha = new Date(e.desde + 'T00:00:00').toLocaleDateString('es-MX', {day:'numeric', month:'long', year:'numeric'});
    var texto = traducir('sate.calendario.recorte', {proceso:e.titulo, fecha:fecha});
    var b = el('button', {type:'button', class:'sate-recorte-calendario', 'aria-label':traducir('sate.calendario.recorte_abrir', {proceso:e.titulo, fecha:fecha}), title:texto}, [
      el('span', {class:'sate-recorte-calendario__texto', texto:texto})
    ]);
    if (eventos.length > 1) b.appendChild(el('span', {class:'sate-recorte-calendario__mas', texto:traducir('sate.calendario.recorte_mas')}));
    b.addEventListener('click', function () { raiz.SATE.calendario.abrirProceso(e); });
    return b;
  }

  /* ---------- Tarjeta de aviso ---------- */
  /* aviso({estado, titulo, cuerpo, accion:{texto, onclick|href}, descartable}) */
  function aviso(o) {
    var e = estado(o.estado);
    var n = el('div', { class: 'sate-aviso', 'data-estado': e }, [
      el('span', { class: 'sate-sr', texto: traducir('componentes.estado.' + e) + ': ' }),
      el('p', { class: 'sate-aviso__titulo', texto: o.titulo })
    ]);
    if (o.cuerpo) n.appendChild(el('p', { class: 'sate-aviso__cuerpo', texto: o.cuerpo }));
    if (o.accion) {
      var a = o.accion.href ? el('a', { class: 'sate-enlace', href: o.accion.href, texto: o.accion.texto })
        : el('button', { type: 'button', class: 'sate-enlace', texto: o.accion.texto });
      if (o.accion.onclick) a.addEventListener('click', o.accion.onclick);
      n.appendChild(a);
    }
    if (o.descartable) {
      var x = el('button', { type: 'button', class: 'sate-aviso__x', 'aria-label': traducir('componentes.descartar'), texto: '✕' });
      x.addEventListener('click', function () { n.remove(); if (o.alDescartar) o.alDescartar(); });
      n.appendChild(x);
    }
    return n;
  }
  /* avisos([...]) : rejilla lado a lado (1 columna en teléfono) */
  function avisos(lista) {
    return el('div', { class: 'sate-avisos' }, lista.map(aviso));
  }

  /* ---------- Ayuda ⓘ ---------- */
  var globoAbierto = null;
  function cerrarGlobo() { if (globoAbierto) { globoAbierto(); globoAbierto = null; } }
  /* ayuda(clave, vars?) → elemento. Escritorio: globo (hover, foco, clic). Teléfono/táctil: modal pequeño. */
  function ayuda(clave, vars) {
    var env = el('span', { class: 'sate-ayuda' });
    var b = el('button', { type: 'button', class: 'sate-ayuda__btn', 'aria-label': traducir('componentes.ayuda.boton'), texto: 'ⓘ' });
    var gid = id('globo');
    var g = el('span', { class: 'sate-globo', role: 'tooltip', id: gid, hidden: true });
    env.appendChild(b); env.appendChild(g);
    var fijo = false, t = null;
    function colocar() {
      var r = b.getBoundingClientRect(), w = Math.min(320, raiz.innerWidth - 16);
      g.style.width = w + 'px';
      var x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, raiz.innerWidth - w - 8));
      g.style.left = x + 'px';
      g.style.top = (r.bottom + 6) + 'px';
      var alto = g.offsetHeight;
      if (r.bottom + 6 + alto > raiz.innerHeight && r.top - 6 - alto > 0) g.style.top = (r.top - 6 - alto) + 'px';
    }
    function mostrar() {
      if (!g.hidden) return;
      cerrarGlobo();
      g.innerHTML = traducir(clave, vars);
      g.hidden = false; b.setAttribute('aria-describedby', gid);
      colocar();
      globoAbierto = ocultar;
    }
    function ocultar() { g.hidden = true; fijo = false; b.removeAttribute('aria-describedby'); if (globoAbierto === ocultar) globoAbierto = null; }
    function programar() { clearTimeout(t); t = setTimeout(function () { if (!fijo && !env.contains(document.activeElement)) ocultar(); }, 160); }
    env.addEventListener('mouseenter', function () { if (!esMovil()) { clearTimeout(t); mostrar(); } });
    env.addEventListener('mouseleave', function () { if (!esMovil()) programar(); });
    env.addEventListener('focusin', function () { if (!esMovil()) { clearTimeout(t); mostrar(); } });
    env.addEventListener('focusout', function () { programar(); });
    env.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !g.hidden) { e.stopPropagation(); ocultar(); b.focus(); } });
    b.addEventListener('click', function () {
      if (esMovil()) { modal(traducir('componentes.ayuda.titulo'), function () { return el('p', { html: traducir(clave, vars) }); }, { pequeno: true }); return; }
      if (g.hidden) { mostrar(); fijo = true; } else if (fijo) ocultar(); else fijo = true;
    });
    return env;
  }
  document.addEventListener('click', function (e) { if (globoAbierto && !(e.target.closest && e.target.closest('.sate-ayuda'))) cerrarGlobo(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && globoAbierto) cerrarGlobo(); });
  raiz.addEventListener('scroll', function () { cerrarGlobo(); }, true);

  /* ---------- Desplegable recordado ---------- */
  /* desplegable({clave, titulo, contenido, ayuda:'clave', abierto}) ; el estado se guarda en ipnt.ui.desp.<clave> */
  function desplegable(o) {
    var k = 'ipnt.ui.desp.' + o.clave;
    var g = almLeer(k);
    var d = el('details', { class: 'sate-desp' });
    var s = el('summary', {}, [el('span', { texto: o.titulo })]);
    d.appendChild(s);
    if (o.ayuda) s.appendChild(ayuda(o.ayuda));
    var c = typeof o.contenido === 'function' ? o.contenido() : o.contenido;
    d.appendChild(el('div', { class: 'sate-desp__cuerpo' }, [typeof c === 'string' ? el('p', { texto: c }) : c]));
    d.open = g === '1' ? true : g === '0' ? false : !!o.abierto;
    d.addEventListener('toggle', function () { almGuardar(k, d.open ? '1' : '0'); });
    return d;
  }

  /* ---------- Pestañas ---------- */
  /* pestanas({items:[{id, texto, panel:Element|id}], activa, etiqueta, segmentado, alCambiar}) → tablist con .seleccionar(id) */
  function iconoPestana(ident) {
    var trazos = {
      trayectoria: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
      tramites: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16m-8 0v9"/>',
      mapa: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',
      horarios: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h3m4 0h3"/>'
    };
    if (!trazos[ident]) return null;
    return el('span', {class:'sate-pestana__icono', 'aria-hidden':'true', html:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" focusable="false">'+trazos[ident]+'</svg>'});
  }
  function contenidoPestana(b, it) {
    var icono = iconoPestana(it.id);
    if (icono) b.appendChild(icono);
    b.appendChild(el('span', {class:'sate-pestana__texto', texto:it.texto}));
    if (it.corto) {
      b.appendChild(el('span', {class:'sate-pestana__texto sate-pestana__texto--corto', texto:it.corto}));
      b.setAttribute('aria-label', it.texto);
    }
    if (it.titulo) b.setAttribute('aria-label', it.titulo);
  }
  function pestanas(o) {
    var lista = el('div', { class: 'sate-pestanas' + (o.segmentado ? ' sate-pestanas--seg' : ''), role: 'tablist', 'aria-label': o.etiqueta || null });
    var base = id('tab'), botones = [];
    function panelDe(it) { return typeof it.panel === 'string' ? document.getElementById(it.panel) : it.panel; }
    function seleccionar(ident, foco) {
      o.items.forEach(function (it, i) {
        var sel = it.id === ident, p = panelDe(it);
        botones[i].setAttribute('aria-selected', String(sel));
        botones[i].tabIndex = sel ? 0 : -1;
        if (p) p.hidden = !sel;
        if (sel && foco) botones[i].focus();
      });
      if (o.alCambiar) o.alCambiar(ident);
    }
    o.items.forEach(function (it, i) {
      var b = el('button', { type: 'button', role: 'tab', class: 'sate-pestana', id: base + '-' + it.id, 'data-id': it.id });
      contenidoPestana(b, it);
      if (i && it.grupo != null && it.grupo !== o.items[i-1].grupo) b.className += ' sate-grupo-inicio';
      var p = panelDe(it);
      if (p) {
        if (!p.id) p.id = base + '-p-' + it.id;
        b.setAttribute('aria-controls', p.id);
        p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', b.id);
      }
      b.addEventListener('click', function () { seleccionar(it.id, false); });
      b.addEventListener('keydown', function (e) {
        var n = o.items.length, j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % n;
        else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = n - 1;
        if (j === null) return;
        e.preventDefault(); seleccionar(o.items[j].id, true);
      });
      botones.push(b); lista.appendChild(b);
    });
    lista.seleccionar = function (ident) { seleccionar(ident, false); };
    seleccionar(o.activa || o.items[0].id, false);
    return lista;
  }

  /* ---------- Barra inferior (teléfono o pestañas sin espacio) ---------- */
  /* barraInferior({items:[{id, texto, titulo}], activa, alElegir}) → <nav> */
  function barraInferior(o) {
    var nav = el('nav', { class: 'sate-barra', 'aria-label': traducir('componentes.barra.etiqueta') });
    var bs = o.items.map(function (it, i) {
      var b = el('button', { type: 'button', class: 'sate-barra__btn', 'data-id': it.id });
      contenidoPestana(b, it);
      b.addEventListener('click', function () { marcar(it.id); if (o.alElegir) o.alElegir(it.id); });
      if (i && it.grupo != null && it.grupo !== o.items[i-1].grupo) b.className += ' sate-grupo-inicio';
      nav.appendChild(b); return b;
    });
    function marcar(ident) { bs.forEach(function (b) { if (b.dataset.id === ident) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }); }
    nav.marcar = marcar;
    marcar(o.activa || o.items[0].id);
    return nav;
  }

function rowBands(L){
  if(L._bands) return L._bands;
  const cs=L.rows.map(()=>[]);
  L.boxes.forEach(b=>{const cy=b[1]+b[3]/2;let j=0;L.rows.forEach((r,i)=>{if(Math.abs(r[1]-cy)<Math.abs(L.rows[j][1]-cy))j=i});cs[j].push(cy)});
  // Los mapas por áreas tienen filas exactas; solo se ajustan los centros de los PDF.
  const ys=L.rows.map(([n,y],i)=>{const v=cs[i].sort((a,b)=>a-b);return v.length&&!L.propuesto&&!L.filas_exactas?v[Math.floor(v.length/2)]:y});
  return L._bands=L.rows.map(([n],i)=>{const y=ys[i];
    const a=i?(ys[i-1]+y)/2:Math.max(0,y-(ys[1]!=null?(ys[1]-y)/2:L.pitch/2));
    const b=i<ys.length-1?(y+ys[i+1])/2:Math.min(L.h,y+(i?(y-ys[i-1])/2:L.pitch/2));
    return [n,y,a,b]});
}
function minimapaCurricular(ctx,L,FILL,op={}){
  const {isPersonal,cur,slotFill,isElec,statusOf,esc,SATE}=ctx;
  if(!isPersonal())return null;
  if(!L){
    const niveles=[...new Set(Object.values(cur()).map(v=>v[2]))].sort((a,b)=>a-b),boxes=[];
    let cols=1;
    niveles.forEach((n,i)=>{const keys=Object.keys(cur()).filter(k=>cur()[k][2]===n);cols=Math.max(cols,keys.length);keys.forEach((k,j)=>boxes.push([j*50,i*50,40,40,k]))});
    L={w:cols*50,h:Math.max(1,niveles.length)*50,boxes,edges:[],rows:niveles.map((n,i)=>[n,i*50+20]),pitch:50,filas_exactas:true};
  }
  FILL=FILL||slotFill(L,new Set());
  const {nPend=0,FOCO=null}=op,bands=rowBands(L);
  const colores={done:'var(--ipn-ok)',curso:'var(--sate-realce)',pend:'var(--ipn-tenue)',fail:'var(--ipn-reprobada)',late:'var(--ipn-desfasada)'};
  const cnt={done:0,curso:0,pend:0,fail:0,late:0};
  const estado=st=>st==='done'?'done':st.startsWith('curso')?'curso':st.startsWith('late')?'late':st.includes('fail')?'fail':'pend';
  let svg=`<svg viewBox="0 0 ${L.w} ${L.h}" aria-hidden="true" focusable="false">`;
  bands.forEach(([n,y,a,b],i)=>{
    if(i%2===0)svg+=`<rect x="0" y="${a}" width="${L.w}" height="${b-a}" fill="var(--ipn-hundido)"/>`;
    if(i===nPend&&nPend){const fx=FOCO?FOCO.x0:1,fw=FOCO?FOCO.x1-FOCO.x0:L.w-2;svg+=`<rect x="${fx}" y="${a}" width="${fw}" height="${L.h-a-1}" fill="none" stroke="var(--ipn-acento)" stroke-width="4" stroke-dasharray="14 8" rx="8"/>`}
  });
  L.edges.forEach(([s,d,pp])=>{const pts=[];for(let i=0;i<pp.length;i+=2)pts.push(pp[i]+','+pp[i+1]);svg+=`<polyline points="${pts.join(' ')}" fill="none" stroke="var(--ipn-tenue)" stroke-opacity=".35" stroke-width="3"/>`});
  L.boxes.forEach(([x,y,w,h,k,slot],i)=>{
    const kk=k||FILL.get(i)?.k,cx=x+w/2,cy=y+h/2,r=Math.min(w,h)*.3;
    if(!kk){if(/^optativa/i.test(slot)){svg+=`<circle data-estado="pend" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colores.pend}" stroke-width="4" stroke-dasharray="6 5"/>`;cnt.pend++}return}
    if(isElec(kk))return;
    const st=estado(statusOf(kk));cnt[st]++;
    svg+=`<circle data-estado="${st}" cx="${cx}" cy="${cy}" r="${r}" fill="${colores[st]}"/>`;
  });
  svg+='</svg>';
  // leyenda en dos filas centradas: avance (acreditadas, en curso, por cursar) y alertas (reprobadas, desfasadas)
  const pastilla=st=>`<span><i style="background:${colores[st]}"></i>${esc(SATE.texto('sate.minimapa.'+st,{n:cnt[st]}))}</span>`;
  const leyenda=[['done','curso','pend'],['fail','late']].map(fila=>fila.filter(st=>st in cnt)).filter(f=>f.length)
    .map(f=>`<div class="mm-fila">${f.map(pastilla).join('')}</div>`).join('');
  return {svg,leyenda,cnt};
}
/* Clase de resaltado de una caja del mapa (única fuente: la usan el dibujo y el resaltado sin redibujar). */
function resalteCaja(hot,k,mapHover,reqHover){
  if(!hot)return '';
  if(!hot.has(k))return ' dim';
  return k===mapHover?(reqHover?' hpre':' hot'):hot.pre?.has(k)?' hpre':hot.post?.has(k)?' hpost':'';
}
function cajaMateria(ctx,k,x,y,w,h,sc,want,off,hot,sem,req){
  const {cur,statusOf,planAsignado,isElec,MARK,S,fmtCr,porNiveles,esc,SATE,PLAN_DOS_PERIODOS,planEtiqueta}=ctx;
  const [n,cr,niv]=cur()[k]||[k,0,1];
  const st=statusOf(k), paso=planAsignado(k);
  if(ctx.soloLectura){
    const tip=k+' · '+n+' · '+ctx.etiqueta(k);
    return `<div class="box ${st}" data-estado="${st}" style="--nv:var(--sate-realce);left:${x*sc}px;top:${y*sc}px;width:${w*sc}px;height:${h*sc}px;font-size:${Math.max(5.5,(n.length>34?9:10.5)*sc)}px" title="${esc(tip)}" aria-label="${esc(tip)}">${esc(n)}</div>`;
  }
  const el=isElec(k);
  const cls=`box ${st}${el?' elec':''}${MARK.avail.has(k)?' avail':''}${MARK.sug.has(k)?' sug':''}${paso!=null?' want plan-'+(paso+1)+(PLAN_DOS_PERIODOS&&paso!==S.planPaso?' plan-otra':''):req&&req.has(k)?' req':''}${resalteCaja(hot,k,S.mapHover,S.reqHover)}${off.has(k)||el?'':' offered-no'}`;
  const tip=`${k} · ${n} · ${ctx.textoCreditos?ctx.textoCreditos(k,cr,true):fmtCr(cr)+' créditos'} · nivel ${niv}${sem&&!porNiveles()?` · semestre propuesto ${sem}`:''}${el?' · consulta su acreditación con Gestión Escolar':off.has(k)?'':' · sin grupos este periodo'}${st.startsWith('late fail')?' · desfasada (SAES): inscripción obligatoria':st.startsWith('fail')?' · reprobada: por recursar':st==='curso'?' · en curso':st.startsWith('late')?' · atrasada según el semestre propuesto':st.includes('far')?' · más de un año adelante de tu semestre de referencia: aún no puedes inscribirla':st.includes('lock')?' · le faltan requisitos':MARK.avail.has(k)?' · puedes cursarla el siguiente periodo':''}${MARK.sug.has(k)?' · sugerida para tu carga':''}${req&&req.has(k)?' · conviene cursarla antes que una materia elegida':''}`;
  return `<div class="${cls}" data-box="${k}" role="button" tabindex="0" aria-pressed="${paso===S.planPaso}" aria-label="${esc(tip+(paso==null?'':' · '+SATE.texto('sate.planeacion.periodo_elegido',{marca:paso+1,periodo:planEtiqueta(paso)})))}" style="--nv:var(--n${niv});left:${x*sc}px;top:${y*sc}px;width:${w*sc}px;height:${h*sc}px;font-size:${Math.max(5.5,(n.length>34?9:10.5)*sc)}px" title="${esc(tip)}">${esc(n)}${paso==null||!PLAN_DOS_PERIODOS?'':`<span class="plan-marca" aria-hidden="true">${paso===0&&S.planPaso===1?'en ':''}${esc(planEtiqueta(paso))}</span>`}</div>`;
}
function lanes(items){
  const out=[];
  for(let d=0;d<7;d++){
    const bs=items.filter(b=>b.d===d).sort((a,b)=>a.a-b.a||b.b-a.b);
    let group=[],end=-1;
    const flush=()=>{const le=[];group.forEach(b=>{let i=le.findIndex(e=>e<=b.a);if(i<0){i=le.length;le.push(0)}le[i]=b.b;b.lane=i});group.forEach(b=>{b.n=le.length;b.clash=le.length>1&&!b.ghost});out.push(...group);group=[]};
    bs.forEach(b=>{if(b.a>=end&&group.length)flush();group.push(b);end=Math.max(end,b.b)});
    if(group.length)flush();
  }
  return out;
}
function cuadriculaHorario(all,op){
  const {S,slots,START,BLOCK,SLOT,SLOTPX,$,DAYS,hm,esc,txH,hue,keyOf,name,profs,roomAt,ghost,soloLectura=false}=op;
  // Las actividades de solo horas no ocupan celdas ni amplían el rango visible.
  all=all.filter(c=>!c.own||!c.oculto);
  const maxDay=Math.max(4,...all.flatMap(c=>slots(c).map(b=>b[0])));
  const days=S.weekend?7:maxDay+1;
  // bloques de 1:30 alineados a las 7:00 (si algo empieza antes, se agregan bloques completos hacia arriba)
  const first=Math.min(START,...all.flatMap(c=>slots(c).map(b=>b[1])));
  const lo=START-Math.ceil((START-first)/BLOCK)*BLOCK;
  const hi=Math.max(14*60+30,...all.flatMap(c=>slots(c).map(b=>b[2])));
  const end=lo+Math.ceil((hi-lo)/BLOCK)*BLOCK, h=(end-lo)/SLOT*SLOTPX;
  const cal=$('#cal');cal.style.setProperty('--days',days);cal.style.setProperty('--slot',SLOTPX+'px');
  let html='<div class="dh"></div>'+DAYS.slice(0,days).map(d=>`<div class="dh">${d}</div>`).join('');
  html+=`<div class="hours" style="height:${h}px">`;
  for(let m=lo;m<end;m+=BLOCK) html+=`<div style="top:${(m-lo)/SLOT*SLOTPX}px">${hm(m)}</div>`;
  html+='</div>';
  const items=lanes(all.flatMap(c=>slots(c).map(([d,a,b])=>({c,d,a,b,ghost:c===ghost}))));
  for(let d=0;d<days;d++){
    html+=`<div class="day" style="height:${h}px">`;
    if(!soloLectura)for(let m=lo;m<end;m+=BLOCK){const on=S.gap&&S.gap.d===d&&S.gap.a===m;
      html+=`<button type="button" class="gapcell${on?' on':''}" data-gap="${d}|${m}" style="top:${(m-lo)/SLOT*SLOTPX}px;height:${BLOCK/SLOT*SLOTPX}px" title="${esc(txH('buscar_hueco',{dia:DAYS[d],horas:hm(m)+'–'+hm(m+BLOCK)}))}" aria-label="${esc(txH('buscar_hueco',{dia:DAYS[d],horas:hm(m)}))}"></button>`}
    items.filter(b=>b.d===d).forEach(b=>{
      const top=(b.a-lo)/SLOT*SLOTPX, ht=(b.b-b.a)/SLOT*SLOTPX-2, w=100/b.n, pos=`top:${top}px;height:${ht}px;left:calc(${b.lane*w}% + 2px);width:calc(${w}% - 4px)`;
      if(b.c.own) html+=`<div class="blk own${b.clash?' clash':''}"${b.c.tipo?` data-tipo="${esc(b.c.tipo)}"`:""}${!soloLectura&&b.c.i!=null?` data-own="${b.c.i}" tabindex="0" role="button" aria-label="${esc(txH('semana_abrir_bloque',{nombre:b.c.n}))}"`:''} style="${pos}" title="${esc(b.c.n)} · ${hm(b.a)}–${hm(b.b)}"><b>${esc(b.c.n)}</b><span class="t">${hm(b.a)}</span></div>`;
      else html+=`<div class="blk${b.clash?' clash':''}${b.ghost?' ghost':''}" style="--h:${hue(b.c)};${pos}"${soloLectura?'':` data-k="${keyOf(b.c)}"`} title="${esc(b.c[3])} · ${esc(name(b.c))} · ${esc(profs(b.c))} · ${hm(b.a)}–${hm(b.b)}${roomAt(b.c,b.d,b.a)?' · '+esc(roomAt(b.c,b.d,b.a)):''}"><b>${esc(name(b.c))}</b><span class="t">${esc(b.c[3])} · ${hm(b.a)}${roomAt(b.c,b.d,b.a)?' · '+esc(roomAt(b.c,b.d,b.a)):''}</span></div>`;
    });
    html+='</div>';
  }
  cal.innerHTML=html;
  return items;
}

function indicadoresTrayectoria(D,{esc,fmtCr,info,SATE}){
  const f2=v=>v==null||!isFinite(v)?'—':(+v).toFixed(2);
  const kpi=(lbl,val,viz,sub='',ayuda='',cls='')=>`<div class="kpi"><span>${lbl}${ayuda?' '+info(ayuda):''}</span><div class="kpi-v"><b class="${cls}">${val}</b>${viz||''}</div>${sub?`<small>${sub}</small>`:''}</div>`;
  // promedio: regla 6–10 con tu marca
  const regla=v=>v==null?'':`<span class="k-regla" aria-hidden="true"><i style="left:${Math.max(0,Math.min(100,(v-6)/4*100))}%"></i><em>6</em><em>10</em></span>`;
  // calificaciones: mini histograma 6–10
  const cuenta=[6,7,8,9,10].map(g=>D.rows.filter(r=>Math.round(r.cal)===g).length), cmax=Math.max(1,...cuenta), moda=[6,7,8,9,10].filter((g,j)=>cuenta[j]===Math.max(...cuenta)).sort((x,y)=>Math.abs(x-(D.mediana??8))-Math.abs(y-(D.mediana??8)))[0];   // en empate, la más cercana a la mediana
  const hist=`<span class="k-hist" aria-hidden="true">${cuenta.map((n,j)=>`<i class="g${j+6}" style="height:${Math.max(2,n/cmax*100)}%" title="${n} con ${j+6}"></i>`).join('')}</span>`;
  // ordinario: anillo de porcentaje
  const pct=D.ord!=null?Math.round(D.ord*100):null, Rr=15, Cc=2*Math.PI*Rr;
  const anillo=pct==null?'':`<svg class="k-anillo" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="${Rr}" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="20" cy="20" r="${Rr}" fill="none" stroke="var(--ok)" stroke-width="6" stroke-dasharray="${(pct/100*Cc).toFixed(1)} ${Cc.toFixed(1)}" transform="rotate(-90 20 20)"/></svg>`;
  const otras=[['EXT','extraordinario','extraordinarios'],['ETS','ETS','ETS'],['REC','recursada','recursadas']].map(([c,u,v])=>{const n=D.rows.filter(r=>r.codigo===c).length;return [n,n===1?u:v]}).filter(([n])=>n);
  // créditos por periodo: mini barras de los últimos periodos
  const ult=D.porPer.filter(d=>d.cr!=null&&!d.sim).slice(-6), crmax=Math.max(1,...ult.map(d=>d.cr));
  const barras=ult.length?`<span class="k-bars" aria-hidden="true">${ult.map(d=>`<i style="height:${Math.max(4,d.cr/crmax*100)}%" title="${esc(d.lbl)}: ${fmtCr(d.cr)} créditos"></i>`).join('')}</span>`:'';
  const dTxt=D.delta!=null&&Math.abs(D.delta)>=.01?`<em class="${D.delta>0?'up':'down'}">${D.delta>0?'▲':'▼'} ${Math.abs(D.delta).toFixed(2)}</em> frente al periodo anterior`:SATE.texto('sate.desempeno.materias',{n:D.rows.length});
  return `<div class="kpis">
      ${kpi(D.rows.some(r=>r.sim)?'Promedio sin reprobadas · simulado':'Promedio sin reprobadas',f2(D.media),regla(D.media),dTxt,`Promedio de tus ${D.rows.length} materias acreditadas (incluye equivalencias y revalidaciones). A diferencia del promedio oficial, no cuenta reprobadas ni no acreditadas: las que debes se acreditarán con calificación aprobatoria.`)}
      ${kpi('Tus calificaciones',moda!=null&&D.rows.length?String(moda):'—',hist,moda!=null&&D.rows.length?`la más frecuente · mediana ${f2(D.mediana)}`:'',`Cuántas materias aprobaste con cada calificación, de 6 a 10. Desviación estándar: ${f2(D.sd)} (entre más baja, más parejas).`)}
      ${kpi('En ordinario',pct!=null?pct+' %':'—',anillo,otras.length?otras.map(([n,l])=>`<span class="k-chip">${n} ${l}</span>`).join(' '):'sin extraordinarios',`Materias aprobadas en ordinario entre ${D.formasN} aprobadas en ordinario, extraordinario, ETS o recurse${D.formasExcluidas?`; no cuenta ${D.formasExcluidas} por equivalencia u otra vía`:''}.`)}
      ${kpi('Créditos por periodo <span data-ayuda-creditos="escala"></span>',D.ritmo?fmtCr(D.ritmo):'—',barras,D.ritmo?`promedio de ${D.ritmoN} periodos`:'',`Créditos aprobados en promedio en tus últimos ${D.ritmoN} periodos${D.ritmoNota?'; '+D.ritmoNota:''}.`)}
    </div>`;
}
function fichasKardex(t,sub,rs,esc){
    const col=()=>`<div class="kx-col"><div class="kx-h"><b>${esc(t)}</b><small>${sub}</small></div><div class="kx-cs">${rs.slice().sort((a,b)=>b.cal-a.cal).map(r=>{
      const l={EXT:'E',ETS:'T',REC:'R'}[r.codigo]||'';
      return `<span class="kx-c g${Math.round(r.cal)}${r.sim?' sim':''}" title="${esc(r.nombre)} · ${r.cal} · ${esc(r.forma)}${r.sim?' · simulada':''}">${r.cal}${l?`<i>${l}</i>`:''}</span>`}).join('')}</div></div>`;
  return col();
}
function caminoTrayectoria(Dc,A,plazo,totalPer,{esc,fmtCr,perName,proyeccionCreditos,ec,info},ancho){
  const host={clientWidth:ancho,innerHTML:""}, tot=Dc.total;
    if(!(tot>0)||Dc.obt==null){host.innerHTML='<p class="muted">Faltan los créditos del plan para dibujar tu camino.</p>'}else{
      const hecho=Math.min(tot,Dc.obt-(Dc.simCr||0)), sim=Math.min(tot-hecho,Dc.simCr||0), curso=Math.min(tot-hecho-sim,ec);
      const pc=v=>(v/tot*100).toFixed(2)+'%';
      const proy=proyeccionCreditos(Dc).slice(1), cursados=A.avance?.cursados;
      const inicio=Dc.actual!=null&&cursados!=null?Dc.actual-cursados+1:null, limite=plazo.max&&inicio!=null?inicio+plazo.max-1:null;
      const W=host.clientWidth||600;let ult=-1e9;
      const marcas=(lst,cls)=>lst.map(d=>{const x=d.acum/tot*W, ver=x-ult>=46;if(ver)ult=x;
        const pp=d.acum/tot*100;
        return `<span class="cm-m ${cls}${limite!=null&&d.per>limite?' fuera':''}${pp>94?' der':pp<6?' izq':''}" style="left:${pc(d.acum)}" title="${esc(perName(d.per))}: ${fmtCr(d.acum)} créditos${cls==='fut'?' (estimado)':''}">${ver?esc(perName(d.per)):''}</span>`}).join('');
      ult=-1e9;const pasado=marcas(Dc.curva.filter(d=>!d.sim),'pas');ult=-1e9;const futuro=marcas(proy,'fut');
      const fin=Dc.falta===0?'Créditos completos':Dc.fin!=null?`Terminarías en <b>${esc(perName(Dc.fin))}</b>${totalPer?` (unos ${totalPer} periodos en total)`:''}`:'';
      host.innerHTML=`<p class="cm-h"><span class="cm-n"><b>${fmtCr(Dc.obt)}</b> de ${fmtCr(tot)} créditos <span data-ayuda-creditos="escala"></span> · ${Math.round(Dc.obt/tot*100)} %${Dc.falta?` · te faltan ${fmtCr(Dc.falta)}`:''}</span><span>${fin}</span></p>`+
        `<div class="cm-past">${pasado}</div><div class="cm-track"><i class="hecho" style="width:${pc(hecho)}"></i><i class="rayado" style="width:${pc(sim+curso)}"></i></div><div class="cm-fut">${futuro}</div>`+
        (limite!=null&&totalPer>plazo.max?`<p class="cm-alerta">A tu ritmo rebasarías el plazo de referencia de ${plazo.max} periodos (${esc(perName(limite))}).</p>`:'')+
        (plazo.max?`<p class="cm-ref">Plazo de referencia: ${plazo.max} periodos ${info(plazo.calculado?`${fmtCr(A.carga.total)} créditos del plan ÷ ${fmtCr(A.carga.min)} de carga mínima. El SAES indica una duración de ${A.carga.duracion??'—'} y un máximo de ${A.carga.duracion_max??'—'} periodos; confirma tu plazo con Gestión Escolar.`:'Plazo máximo indicado por el SAES.')}</p>`:'')}
  return host.innerHTML;
}

function leyendaGrafica(items,esc){
  const m=(t,c)=>({linea:`<path d="M1 7H21" stroke="${c}" stroke-width="2.4"/><circle cx="11" cy="7" r="2.6" fill="${c}"/>`,
    punteada:`<path d="M1 7H21" stroke="${c}" stroke-width="2" stroke-dasharray="4 3"/><circle cx="11" cy="7" r="2.8" fill="var(--bg)" stroke="${c}" stroke-width="1.5"/>`,
    guion:`<path d="M1 7H21" stroke="${c}" stroke-width="1.6" stroke-dasharray="2 3"/>`,
    area:`<rect x="1" y="2" width="20" height="10" rx="2" fill="${c}" fill-opacity=".2"/>`,
    numero:`<text x="11" y="11" text-anchor="middle" font-size="10" font-weight="700" fill="${c}">8.5</text>`,
    rayado:`<rect x="1" y="2" width="20" height="10" rx="2" fill="${c}" fill-opacity=".35"/><path d="M4 12L10 2M10 12L16 2M16 12L21 4" stroke="${c}" stroke-width="1.5"/>`,
    marca:`<path d="M11 1V13" stroke="${c}" stroke-width="2"/>`,
    grado:`<rect x="0" y="2" width="4" height="10" fill="var(--g6)"/><rect x="4.5" y="2" width="4" height="10" fill="var(--g7)"/><rect x="9" y="2" width="4" height="10" fill="var(--g8)"/><rect x="13.5" y="2" width="4" height="10" fill="var(--g9)"/><rect x="18" y="2" width="4" height="10" fill="var(--g10)"/>`,
    letra:`<text x="11" y="11" text-anchor="middle" font-size="11" font-weight="700" fill="var(--fg)">${c}</text>`,
    simulada:`<rect x="4" y="1.5" width="14" height="11" rx="2" fill="none" stroke="${c}" stroke-dasharray="2 2"/>`,
    cuadro:`<rect x="5" y="2" width="12" height="10" rx="2" fill="${c}"/>`,
    rango:`<path d="M11 2V12" stroke="${c}" stroke-opacity=".35" stroke-width="7" stroke-linecap="round"/>`,
    barra:`<rect x="4" y="3" width="6" height="10" fill="${c}" fill-opacity=".75"/><rect x="12" y="6" width="6" height="7" fill="${c}" fill-opacity=".75"/>`,
    punto:`<circle cx="11" cy="7" r="4" fill="${c}" fill-opacity=".8"/>`,
    anillo:`<circle cx="11" cy="7" r="4" fill="var(--bg)" stroke="${c}" stroke-width="1.8"/>`,
    vertical:`<path d="M11 1V13" stroke="${c}" stroke-width="2"/>`,
    'vertical-p':`<path d="M11 1V13" stroke="${c}" stroke-width="1.6" stroke-dasharray="3 2"/>`}[t]);
  return `<span class="ley">${items.map(([t,c,x])=>`<span><svg viewBox="0 0 22 14" width="22" height="14" aria-hidden="true" fill="none">${m(t,c)}</svg>${esc(x)}</span>`).join('')}</span>`;
}

  raiz.SateUI = { leyendaGrafica, indicadoresTrayectoria, fichasKardex, caminoTrayectoria, bandasMapa:rowBands, minimapaCurricular, cajaMateria, resalteCaja, cuadriculaHorario, usarTextos: usarTextos, usarAlmacen: usarAlmacen, chips: chips, recorteCalendario: recorteCalendario, aviso: aviso, avisos: avisos, modal: modal, cerrarModal: cerrar,
    ayuda: ayuda, desplegable: desplegable, pestanas: pestanas, barraInferior: barraInferior };
})(typeof window !== 'undefined' ? window : globalThis);
