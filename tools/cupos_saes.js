/* Cupos: lectura de ocupabilidad y funciones compartidas con SATE. */
(function(raiz){
  'use strict';
  const origenSaes=o=>/^https:\/\/(www\.)?saes\.[a-z0-9]+\.ipn\.mx$/.test(o);
  const origenSate=(o,url)=>!!url&&o===new URL(url).origin;
  const clave=f=>f.grupo+'|'+f.materia;
  function parsear(doc){
    if(doc.querySelector('input[type="password"]'))throw new Error('sesion');
    const tabla=doc.querySelector('#ctl00_mainCopy_GrvOcupabilidad');
    if(!tabla)throw new Error('vacia');
    const rows=[...tabla.querySelectorAll('tr')];
    const normal=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
    const headers=['grupo','materia','nombre de la materia','semestre','cupo','inscritos','disponibles'];
    if(!rows.length||[...rows[0].children].map(c=>normal(c.textContent)).join('|')!==headers.join('|'))throw new Error('columnas');
    const filas=rows.slice(1).filter(r=>r.children.length===7).map(r=>{
      const c=[...r.children].map(x=>x.textContent.trim());
      if(!c.slice(4).every(x=>/^\d+$/.test(x)))throw new Error('numeros');
      return {grupo:c[0],materia:c[1],nombre:c[2],nivel:c[3],cupo:+c[4],inscritos:+c[5],disponibles:+c[6]};
    });
    if(!filas.length)throw new Error('vacia');
    if(rows.slice(1).some(r=>r.children.length!==7))throw new Error('columnas');
    return filas;
  }
  function validar(d){
    return d?.tipo==='ipnt.cupos.datos'&&d.v===1&&typeof d.unidad==='string'&&/^[a-z0-9]+$/.test(d.unidad)&&
      typeof d.carrera==='string'&&d.carrera.length<=40&&typeof d.plan==='string'&&d.plan.length<=40&&typeof d.hora==='string'&&Number.isFinite(Date.parse(d.hora))&&
      Date.parse(d.hora)<=Date.now()+60000&&Array.isArray(d.filas)&&d.filas.length<=5000&&d.filas.every(f=>
        f&&typeof f.grupo==='string'&&f.grupo.length<=40&&typeof f.materia==='string'&&f.materia.length<=40&&
        ['nombre','nivel'].every(k=>f[k]===undefined||typeof f[k]==='string'&&f[k].length<=500)&&
        ['cupo','inscritos','disponibles'].every(k=>Number.isSafeInteger(f[k])&&f[k]>=0));
  }
  const antigua=d=>!d||Date.now()-Date.parse(d.hora)>3600000;
  const limpiar=d=>({tipo:'ipnt.cupos.datos',v:1,unidad:d.unidad,carrera:d.carrera,plan:d.plan,hora:d.hora,
    filas:d.filas.map(({grupo,materia,cupo,inscritos,disponibles,nombre,nivel})=>({grupo,materia,cupo,inscritos,disponibles,...(nombre===undefined?{}:{nombre}),...(nivel===undefined?{}:{nivel})}))});
  const reciente=(a,b)=>validar(b)&&(!validar(a)||Date.parse(b.hora)>Date.parse(a.hora))?b:a;
  const fecha=d=>new Date(d.hora).toLocaleString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  function cambios(antes,despues,grupos){
    if(!antes||antes.carrera!==despues.carrera||antes.plan!==despues.plan)return [];
    const prev=new Map(antes.filas.map(f=>[clave(f),f.disponibles])),propios=new Set(grupos.map(clave));
    return despues.filas.filter(f=>{const a=prev.get(clave(f)),n=f.disponibles;
      return propios.has(clave(f))&&a!==undefined&&a!==n&&(a===0&&n>0||n===0||n<=3);
    });
  }
  function tarjetas(datos,seleccion,oferta){return seleccion.map(s=>({...s,fila:datos.filas.find(f=>clave(f)===clave(s)),alternativas:datos.filas.filter(f=>f.materia===s.materia&&f.grupo!==s.grupo&&f.disponibles>0).map(f=>{
    const o=oferta.find(o=>clave(o)===clave(f));
    return {...f,choque:!o?null:seleccion.some(t=>t.materia!==s.materia&&t.horas.some(a=>o.horas.some(b=>a[0]===b[0]&&a[1]<b[2]&&b[1]<a[2])))};
  })}))}
  async function consultar({fetch:pedir,parser,url,carrera,plan,opciones}){
    async function leer(body){
      let r;
      try{r=await pedir(url,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',redirect:'manual',
        ...(body?{headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body.toString()}:{})})}
      catch(e){throw Object.assign(new Error('red'),{etapa:body?.get('__EVENTTARGET')||'GET'})}
      if(r.type==='opaqueredirect'||r.status>=300&&r.status<400)throw Object.assign(new Error('sesion'),{etapa:body?.get('__EVENTTARGET')||'GET',estado:r.status});
      if(new URL(r.url||url).origin!==new URL(url).origin||!/\/Academica\/Ocupabilidad_grupos\.aspx$/i.test(new URL(r.url||url).pathname))throw new Error('sesion');
      if(!r.ok)throw Object.assign(new Error('http'),{etapa:body?.get('__EVENTTARGET')||'GET',estado:r.status});
      const doc=parser(await r.text());if(doc.querySelector('input[type="password"]'))throw new Error('sesion');return doc;
    }
    let doc=await leer();
    const select=id=>doc.querySelector('[name="ctl00$mainCopy$'+id+'"]');
    async function post(target,val){
      const body=new URLSearchParams();
      for(const el of doc.querySelectorAll('input[type="hidden"],select'))if(el.name&&!el.disabled)body.set(el.name,el.value);
      body.set('ctl00$mainCopy$rblEsquema','1');body.set('__EVENTTARGET','ctl00$mainCopy$'+target);body.set('__EVENTARGUMENT','');body.set('__LASTFOCUS','');
      if(target!=='rblEsquema$0')body.set('ctl00$mainCopy$'+target,val);doc=await leer(body);
    }
    // El SAES muestra carrera y plan solo después de elegir «Periodo Escolar Actual» (verificado con sesión real, 2026-10-14).
    await post('rblEsquema$0','1');
    if(!select('dpdcarrera')||!select('dpdplan'))throw new Error('sesion');
    if(['Chkespecialidad','ChkSemestre','Chkgrupo','Chkmateria'].some(k=>doc.querySelector('[name="ctl00$mainCopy$'+k+'"]:checked')))await post('dpdcarrera',select('dpdcarrera').value);
    carrera=carrera||select('dpdcarrera').value;
    if(![...select('dpdcarrera').options].some(o=>o.value===carrera))throw new Error('seleccion');
    await post('dpdcarrera',carrera);
    const planes=[...select('dpdplan').options];
    if(plan&&!planes.some(o=>o.value===plan)){opciones(doc);throw new Error('plan')}
    plan=plan||select('dpdplan').value;
    if(select('dpdplan').value!==plan)await post('dpdplan',plan);
    opciones(doc);
    if(select('dpdcarrera').value!==carrera||select('dpdplan').value!==plan||!doc.querySelector('[name="ctl00$mainCopy$rblEsquema"][value="1"]:checked'))throw new Error('seleccion');
    return {carrera,plan,filas:parsear(doc)};
  }
  function texto(textos,k,v={}){
    const s=textos['sate.cupos.'+k]||k;
    return s.replace(/\{(\w+),\s*plural,\s*((?:[^{}]*\{[^{}]*\})+)\s*\}/g,(_,key,cuerpo)=>{
      const n=Number(v[key]),op={};cuerpo.replace(/(=?\w+)\s*\{([^{}]*)\}/g,(_,c,t)=>{op[c]=t});
      return (op['='+n]??op[new Intl.PluralRules('es-MX').select(n)]??op.other??'').replace(/#/g,new Intl.NumberFormat('es-MX').format(n));
    }).replace(/\{(\w+)\}/g,(_,key)=>v[key]??'');
  }
  function notificar(titulo,opciones){
    if(typeof raiz.Notification!=='function'||raiz.Notification.permission!=='granted')return;
    const directo=()=>{try{const n=new raiz.Notification(titulo,opciones);n.onclick=()=>{raiz.focus();n.close()}}catch(e){/* Algunas plataformas solo admiten notificaciones persistentes. */}};
    const sw=raiz.navigator?.serviceWorker;
    if(sw?.getRegistration)Promise.resolve().then(()=>sw.getRegistration()).then(r=>r?sw.ready:null).then(r=>r?.showNotification?r.showNotification(titulo,opciones):directo()).catch(()=>{});
    else directo();
  }
  raiz.IPNCupos={texto,origenSaes,origenSate,clave,parsear,validar,limpiar,antigua,reciente,fecha,tarjetas,consultar,cambios,notificar};
})(typeof window==='undefined'?globalThis:window);

/*__CUPOS_PANEL__*/
window.IPNCuposMontar=function(revision){
  'use strict';
  const URL_SATE='__CUPOS_URL__',textos=__CUPOS_TEXTOS__;
  const C=window.IPNCupos,tx=(k,v)=>C.texto(textos,k,v),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(document.getElementById('ipnt-cupos')){document.getElementById('ipnt-cupos').focus();return}
  const permitido=C.origenSaes(location.origin),unidad=permitido?location.hostname.match(/saes\.([a-z0-9]+)\.ipn\.mx$/)[1]:'',origin=URL_SATE?new URL(URL_SATE).origin:null;
  let sate=null,datos=null,carrera='',plan='',contexto='',busy=false,destruido=false,ultima=window.IPNCuposUltimaConsulta??null;
  let automatico=false,hasta=0,proxima=0,conectado=false,consultaInicial=false;
  let modo=window.matchMedia?.('(min-width: 900px) and (pointer: fine)').matches?'ventana':'saes',seleccion=null,envioPendiente=false,audio=null,avisos=0,plegada=false;
  const tituloOriginal=document.title;
  try{const p=localStorage.getItem('ipnt.cupos.modo');if(['saes','ventana'].includes(p))modo=p}catch(e){}
  try{const s=JSON.parse(sessionStorage.getItem('ipnt.cupos.contexto'));if(s&&typeof s.carrera==='string'&&s.carrera.length<=40&&typeof s.plan==='string'&&s.plan.length<=40&&Array.isArray(s.grupos)&&s.grupos.length<=500&&s.grupos.every(g=>g&&typeof g.grupo==='string'&&typeof g.materia==='string')){seleccion=s;carrera=s.carrera;plan=s.plan}}catch(e){}
  if(revision){modo='saes';seleccion=revision.seleccion;datos=revision.datos;carrera=datos.carrera;plan=datos.plan;plegada=!!revision.plegada}
  const panel=document.createElement('section');panel.id='ipnt-cupos';panel.tabIndex=-1;panel.setAttribute('aria-label',tx('titulo'));
  const estilo=document.createElement('style');estilo.textContent=`
  #ipnt-cupos,#ipnt-cupos *{all:revert;box-sizing:border-box;font:inherit;color:inherit}
  #ipnt-cupos{--ipn-texto:#29252b;--ipn-superficie:#fff;--ipn-linea:#ded8dc;--ipn-acento:#71334c;color-scheme:light dark;position:fixed;z-index:2147483646;right:12px;bottom:12px;max-width:calc(100vw - 24px);background:var(--ipn-superficie);color:var(--ipn-texto);border:1px solid var(--ipn-linea);border-radius:16px;padding:8px 16px;box-shadow:0 4px 20px #0003;font:14px/1.5 system-ui;display:flex;flex-wrap:wrap;align-items:center;gap:8px;box-sizing:border-box}
  @media(prefers-color-scheme:dark){#ipnt-cupos{--ipn-texto:#eee8eb;--ipn-superficie:#211e22;--ipn-linea:#61565e;--ipn-acento:#efb7ce}}
  #ipnt-cupos button,#ipnt-cupos input,#ipnt-cupos select{font:inherit;color:inherit;background:var(--ipn-superficie);border:1px solid var(--ipn-linea);border-radius:8px;padding:8px;min-height:44px;max-width:100%;box-sizing:border-box}#ipnt-cupos button{cursor:pointer}#ipnt-cupos label{display:flex;align-items:center;gap:8px;min-height:44px}#ipnt-cupos :focus-visible{outline:3px solid var(--ipn-acento);outline-offset:2px}#ipnt-cupos [hidden]{display:none!important}
  #ipnt-cupos[data-modo="saes"]{left:8px;right:8px;bottom:0;width:calc(100% - 16px);max-width:48rem;max-height:calc(100vh - 16px);max-height:calc(100dvh - 16px);overflow:auto;margin:auto;padding-bottom:max(12px,env(safe-area-inset-bottom));border-radius:16px 16px 0 0}
  #ipnt-cupos [data-c="hoja"]{flex-basis:100%;min-width:0;max-height:60vh;max-height:60dvh;overflow:auto;overscroll-behavior:contain;padding-right:8px;scrollbar-gutter:stable}
  #ipnt-cupos article{border:1px solid var(--ipn-linea);border-radius:8px;padding:16px;margin:8px 0;overflow-wrap:anywhere}#ipnt-cupos header{display:grid;grid-template-columns:minmax(0,1fr) 7rem;gap:8px}#ipnt-cupos strong{text-align:right}#ipnt-cupos .ipnt-tabla{max-width:100%;overflow:auto}#ipnt-cupos table{border-collapse:collapse;width:100%}#ipnt-cupos td,#ipnt-cupos th{padding:8px;text-align:left;border-bottom:1px solid var(--ipn-linea)}#ipnt-cupos td:last-child,#ipnt-cupos th:last-child{position:sticky;right:0;min-width:7rem;background:var(--ipn-superficie)}#ipnt-cupos [data-c="aviso"]{color:var(--ipn-acento);font-weight:600;overflow-wrap:anywhere}
  #ipnt-cupos .ipnt-cabecera{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%}#ipnt-cupos h2{font-size:18px;font-weight:650;margin:0;overflow-wrap:anywhere;overflow-wrap:anywhere}#ipnt-cupos h3{font-weight:650;margin:16px 0 8px}#ipnt-cupos p{margin:8px 0;font-size:13px}#ipnt-cupos p:empty{display:none}
  #ipnt-cupos [data-c="ultima"]{font-size:12px;opacity:.75}#ipnt-cupos [data-c="cerrar"]{border:0;font-size:24px;width:44px;flex:none;padding:0}
  #ipnt-cupos .ipnt-asa{width:100%;border:0;padding:0;min-height:44px;touch-action:none;display:grid;place-items:center;gap:8px}#ipnt-cupos .ipnt-tirador{display:block;width:40px;height:4px;background:var(--ipn-linea);border-radius:8px}#ipnt-cupos [data-c="resumen"]{display:none}
  #ipnt-cupos[data-plegada="true"] [data-c="resumen"]{display:block;padding:8px 0;font-size:13px}#ipnt-cupos[data-plegada="true"] .ipnt-tirador{display:none}
  #ipnt-cupos .ipnt-selectores{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:8px 0 16px}#ipnt-cupos .ipnt-selectores label,#ipnt-cupos .ipnt-filtro{display:grid;gap:8px;font-size:13px}#ipnt-cupos select,#ipnt-cupos input[type="search"]{width:100%;font-size:16px;padding:8px}
  #ipnt-cupos .ipnt-acciones{display:flex;align-items:center;gap:8px;margin-bottom:8px}#ipnt-cupos .ipnt-primario{flex:1;background:var(--ipn-acento);color:var(--ipn-superficie);border-color:transparent;padding:8px;font-weight:600}#ipnt-cupos input[type="checkbox"]{accent-color:var(--ipn-acento);width:20px;min-height:20px;height:20px;padding:0}#ipnt-cupos .ipnt-switch{font-size:13px;white-space:nowrap}
  #ipnt-cupos summary{display:list-item;cursor:pointer;min-height:44px;padding:8px 0;font-weight:600}#ipnt-cupos details{border-top:1px solid var(--ipn-linea);margin-top:16px}#ipnt-cupos .ipnt-extras{display:grid;gap:8px}#ipnt-cupos [data-c="estado"],#ipnt-cupos [data-c="automatico"]{display:block;font-size:13px}#ipnt-cupos [data-c="automatico"]:empty{display:none}
  #ipnt-cupos[data-modo="ventana"] [data-c="hoja"]{display:block;max-height:none}#ipnt-cupos[data-modo="ventana"] .ipnt-selectores,#ipnt-cupos[data-modo="ventana"] details,#ipnt-cupos[data-modo="ventana"] .ipnt-filtro,#ipnt-cupos[data-modo="ventana"] [data-c="tabla"],#ipnt-cupos[data-modo="ventana"] [data-c="grupos"],#ipnt-cupos[data-modo="ventana"] [data-c="otros"],#ipnt-cupos[data-modo="ventana"] [data-c="sincronizar"]{display:none}
  @media(min-width:600px){#ipnt-cupos .ipnt-selectores{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}`;

  document.head.appendChild(estilo);
  panel.innerHTML=`<button data-c="plegar" class="ipnt-asa" aria-expanded="true" aria-label="${esc(tx('plegar'))}"><span class="ipnt-tirador"></span><span data-c="resumen"></span></button>
    <div data-c="cabecera" class="ipnt-cabecera"><div><h2 data-c="titulo">${esc(tx('titulo'))}</h2><span data-c="ultima"></span></div><button data-c="cerrar" aria-label="${esc(tx('cerrar'))}">×</button></div>
    <div data-c="hoja" hidden>
      <div class="ipnt-selectores"><label>${esc(tx('carrera'))}<select data-c="carrera"></select></label><label>${esc(tx('plan'))}<select data-c="plan"></select></label></div>
      <div data-c="acciones" class="ipnt-acciones"><button data-c="actualizar" class="ipnt-primario">${esc(tx('consultar'))}</button><label class="ipnt-switch"><input type="checkbox" role="switch" data-c="auto">${esc(tx('auto_breve'))}</label></div>
      <span data-c="estado" role="status" aria-live="polite">${esc(tx('conectando'))}</span><button data-c="abrir" hidden>${esc(tx('reabrir'))}</button>
      <span data-c="automatico" role="status"></span><button data-c="seguir" hidden>${esc(tx('seguir'))}</button>
      <p data-c="sincronizar"></p><p data-c="aviso" role="status" aria-live="polite"></p>
      <div data-c="grupos"></div><div data-c="otros"></div>
      <label class="ipnt-filtro">${esc(tx('filtro'))}<input type="search" data-c="filtro"></label><div data-c="tabla" class="ipnt-tabla"></div>
      <details><summary>${esc(tx('avisos_mas'))}</summary><div class="ipnt-extras"><label><input type="checkbox" data-c="sonido">${esc(tx('sonido'))}</label><button data-c="permitir" hidden>${esc(tx('permitir'))}</button><button data-c="detalle">${esc(tx('abrir_detalle'))}</button><p>${esc(tx('movil_pausa'))}</p></div></details>
    </div>`;
  document.body.appendChild(panel);panel.focus();const el=k=>panel.querySelector('[data-c="'+k+'"]');
  function enviar(d){if(sate&&!sate.closed)sate.postMessage(d,origin)}
  function preferencias(){enviar({tipo:'ipnt.cupos.avisos',v:1,unidad,hasta:automatico?hasta:0,notificacion:automatico})}
  function enviarDatos(){if(datos&&conectado&&(modo==='ventana'||envioPendiente)){enviar(C.limpiar(datos));envioPendiente=false}}
  function pintar(){
    panel.setAttribute('data-modo',modo);el('hoja').hidden=modo==='saes'&&plegada;el('plegar').hidden=modo!=='saes';panel.setAttribute('data-plegada',String(plegada));el('cabecera').hidden=modo==='saes'&&plegada;el('plegar').setAttribute?.('aria-expanded',String(!plegada));el('plegar').setAttribute?.('aria-label',tx(plegada?'desplegar':'plegar'));
    el('permitir').hidden=typeof window.Notification!=='function'||window.Notification.permission!=='default';
    el('sincronizar').textContent=seleccion?tx('contexto_sesion'):tx('sin_contexto');
    el('sincronizar').hidden=!!seleccion;
    const hora=datos?new Date(datos.hora).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}):tx('sin_actualizar');
    const nombre=el('carrera').selectedOptions?.[0]?.textContent||carrera;
    el('titulo').textContent=tx('hoja_titulo',{carrera:nombre.replace(/^ingenier[ií]a (en )?/i,'')});
    const grupos=seleccion&&datos&&seleccion.carrera===datos.carrera&&seleccion.plan===datos.plan?seleccion.grupos:[];
    const n=datos?grupos.filter(g=>datos.filas.some(f=>C.clave(f)===C.clave(g)&&f.disponibles>0)).length:0;
    el('resumen').textContent=tx(seleccion?'resumen_plegado':'resumen_sin_contexto',{hora,n});
    if(!datos)return;
    el('ultima').textContent=tx('ultima',{hora:C.fecha(datos)});
    const propios=seleccion?.carrera===datos.carrera&&seleccion?.plan===datos.plan?seleccion.grupos:[];
    const fila=f=>`<header><span>${esc(f.nombre||f.materia)} · ${esc(f.grupo)}</span><strong>${esc(f.disponibles===undefined?tx('sin_dato'):tx('lugares',{n:f.disponibles}))}</strong></header>`;
    el('grupos').innerHTML=propios.length?`<h3>${esc(tx('tus_grupos'))}</h3>`+C.tarjetas(datos,propios,[]).map(s=>`<article>${fila({...s,...s.fila})}</article>`).join(''):'';
    const otros=datos.filas.filter(f=>f.disponibles>0&&!propios.some(g=>C.clave(g)===C.clave(f)));
    el('otros').innerHTML=otros.length?`<h3>${esc(tx('otros_lugar'))}</h3>`+otros.map(f=>`<article>${fila(f)}</article>`).join(''):'';
    const q=(el('filtro').value||'').toLocaleLowerCase();
    el('tabla').innerHTML=`<table><caption>${esc(tx('todos'))}</caption><thead><tr><th>${esc(tx('materia'))}</th><th>${esc(tx('disponibles'))}</th></tr></thead><tbody>`+datos.filas.filter(f=>(f.grupo+' '+f.materia+' '+f.nombre).toLocaleLowerCase().includes(q)).map(f=>`<tr><td>${esc(f.nombre||f.materia)} · ${esc(f.grupo)}</td><td>${esc(tx('lugares',{n:f.disponibles}))}</td></tr>`).join('')+'</tbody></table>';
  }
  function alertar(antes){if(!automatico||modo!=='saes'||seleccion?.carrera!==datos.carrera||seleccion?.plan!==datos.plan)return;
    const cambios=C.cambios(antes,datos,seleccion.grupos);if(!cambios.length)return;
    avisos+=cambios.length;document.title=tx('titulo_avisos',{n:avisos});el('aviso').textContent=cambios.map(f=>tx('aviso',{...f,n:f.disponibles})).join(' · ');
    try{window.navigator?.vibrate?.([150,80,150])}catch(e){}
    for(const f of cambios)C.notificar(tx('titulo'),{body:tx('aviso',{...f,n:f.disponibles}),tag:unidad+'|'+C.clave(f)});
    if(!document.hidden&&audio?.state==='running'&&el('sonido').checked)try{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=660;g.gain.value=.04;o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.2)}catch(e){}
    // Un registro del SAES no puede usar el service worker de otro origen (SATE).
  }
  function estado(){
    if(modo==='saes')return true;
    if(sate?.closed){conectado=false;el('estado').textContent=tx('cerrada');el('abrir').hidden=false;return false}
    return !!sate;
  }
  function abrir(){
    if(revision)return;
    if(!permitido){el('estado').textContent=tx('solo_saes');return}
    if(!URL_SATE){el('estado').textContent=tx('sin_sitio');return}
    const url=new URL(URL_SATE);url.searchParams.set('unidad',unidad);if(modo==='saes')url.searchParams.set('modo','saes');conectado=false;envioPendiente=modo==='saes';
    sate=window.open(url.href,'sate-cupos','width=1024,height=760');
    el('abrir').hidden=modo==='saes'||!!sate;el('estado').textContent=tx(sate?'conectando':'ventana');
    if(sate)enviar({tipo:'ipnt.cupos.hola',v:1,unidad});
  }
  function detener(vencido=false){automatico=false;el('auto').checked=false;preferencias();el('automatico').textContent=tx(vencido?'auto_fin':'auto_apagada');el('seguir').hidden=!vencido}
  function activar(){automatico=true;hasta=Date.now()+30*60000;proxima=Math.max(Date.now(),(ultima??0)+60000);el('auto').checked=true;el('seguir').hidden=true;preferencias();pulso()}
  async function actualizar(){
    if(revision||busy||destruido||!permitido||!estado()||modo==='ventana'&&!conectado)return;
    if(ultima!==null&&Date.now()-ultima<15000){cuenta();return}
    busy=true;ultima=Date.now();window.IPNCuposUltimaConsulta=ultima;proxima=ultima+60000;el('actualizar').disabled=true;el('estado').textContent=tx('consultando');
    try{
      const r=await C.consultar({fetch:window.fetch.bind(window),parser:s=>new DOMParser().parseFromString(s,'text/html'),url:location.origin+'/Academica/Ocupabilidad_grupos.aspx',carrera,plan,
        opciones(doc){const opciones=Object.fromEntries(['carrera','plan'].map(k=>{const s=doc.querySelector('[name="ctl00$mainCopy$dpd'+k+'"]');return [k,s?[...s.options].map(o=>({valor:o.value,texto:o.textContent,elegido:o.value===s.value})):[]]}));for(const k of ['carrera','plan']){el(k).innerHTML=opciones[k].map(o=>`<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('');el(k).value=opciones[k].find(o=>o.elegido)?.valor||''}enviar({tipo:'ipnt.cupos.opciones',v:1,unidad,opciones})}});
      if(destruido)return;
      const nuevos={tipo:'ipnt.cupos.datos',v:1,unidad,...r,hora:new Date().toISOString()};
      const antes=datos;datos=nuevos;carrera=r.carrera;plan=r.plan;pintar();alertar(antes);
      enviarDatos();if(estado())el('estado').textContent=modo==='saes'?'':tx('conectada',{hora:new Date(datos.hora).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})});
    }catch(e){console.warn('IPN Cupos: consulta fallida',{unidad,carrera,plan,codigo:e.message,etapa:e.etapa,estado:e.estado,pila:e.stack});el('estado').textContent=tx('error_'+(textos['sate.cupos.error_'+e.message]?e.message:'red'))}
    finally{busy=false;if(!destruido)cuenta()}
  }
  function cuenta(){const n=ultima===null?0:Math.max(0,Math.ceil((15000-Date.now()+ultima)/1000));el('actualizar').textContent=tx(n?'cuenta':'consultar',{n});el('actualizar').disabled=busy||n>0;enviar({tipo:'ipnt.cupos.ritmo',v:1,unidad,n,busy})}
  function pulso(){
    if(destruido)return;cuenta();estado();
    if(!conectado&&sate&&!sate.closed)enviar({tipo:'ipnt.cupos.hola',v:1,unidad});
    if(!automatico)return;if(Date.now()>=hasta){detener(true);return}
    el('automatico').textContent=tx(document.hidden?'auto_pausa':'auto_activa');
    if(!document.hidden&&Date.now()>=proxima&&(modo==='saes'||conectado)&&estado())return actualizar();
  }
  function mensaje(e){
    if(!C.origenSate(e.origin,URL_SATE)||e.source!==sate)return;const d=e.data;
    if(d?.tipo==='ipnt.cupos.hola'){conectado=true;el('estado').textContent=datos?tx('conectada',{hora:new Date(datos.hora).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}):tx('conectado');preferencias();enviarDatos()}
    if(d?.tipo==='ipnt.cupos.seleccion'&&d.v===1&&Array.isArray(d.grupos)&&d.grupos.length<=500){
      const nuevo=JSON.stringify([d.carrera,d.plan]);
      if(contexto!==nuevo){contexto=nuevo;if(typeof d.carrera==='string'&&d.carrera.length<=40)carrera=d.carrera;if(typeof d.plan==='string'&&d.plan.length<=40)plan=d.plan}
      for(const k of ['texto','superficie','linea','acento'])if(/^#[a-f0-9]{3,8}$/i.test(d.tokens?.[k]||''))panel.style.setProperty('--ipn-'+k,d.tokens[k]);
      seleccion={carrera:typeof d.carrera==='string'?d.carrera:'',plan:typeof d.plan==='string'?d.plan:'',grupos:d.grupos.filter(g=>g&&typeof g.grupo==='string'&&typeof g.materia==='string').map(g=>({grupo:g.grupo,materia:g.materia,nombre:typeof g.nombre==='string'?g.nombre.slice(0,500):g.materia}))};
      if(!seleccion.carrera||!seleccion.plan)seleccion=null;
      try{sessionStorage.setItem('ipnt.cupos.contexto',JSON.stringify(seleccion))}catch(e){console.warn('IPN Cupos: contexto de sesión no disponible',{unidad,error:e.message})}pintar();
      if(!consultaInicial){consultaInicial=true;actualizar()}
    }
    if(d?.tipo==='ipnt.cupos.consultar'&&d.v===1){if(typeof d.carrera==='string'&&typeof d.plan==='string'&&d.carrera.length<=40&&d.plan.length<=40){carrera=d.carrera;plan=d.plan;actualizar()}}

  }
  window.addEventListener('message',mensaje);el('actualizar').onclick=actualizar;el('abrir').onclick=abrir;
  el('auto').onchange=()=>el('auto').checked?activar():detener();el('seguir').onclick=activar;
  el('detalle').onclick=abrir;el('filtro').oninput=pintar;
  el('permitir').onclick=async()=>{try{if(typeof window.Notification?.requestPermission==='function')await window.Notification.requestPermission();el('aviso').textContent=tx(window.Notification?.permission==='granted'?'permiso_listo':'permiso_panel')}catch(e){el('aviso').textContent=tx('permiso_panel')}pintar()};
  el('carrera').onchange=()=>{carrera=el('carrera').value;plan='';el('plan').innerHTML=''};el('plan').onchange=()=>{plan=el('plan').value};
  let inicioY=null,arrastre=false;
  el('plegar').onclick=()=>{if(arrastre){arrastre=false;return}plegada=!plegada;pintar()};
  el('plegar').onpointerdown=e=>{inicioY=e.clientY;arrastre=false;el('plegar').setPointerCapture?.(e.pointerId)};
  el('plegar').onpointerup=e=>{if(inicioY!==null&&Math.abs(e.clientY-inicioY)>24){arrastre=true;plegada=e.clientY>inicioY;pintar()}inicioY=null};
  el('plegar').onpointercancel=()=>{inicioY=null;arrastre=false};
  el('sonido').onchange=()=>{try{const A=window.AudioContext||window.webkitAudioContext;if(A&&el('sonido').checked){audio=audio||new A();audio.resume().catch(()=>{})}}catch(e){}};
  window.IPNCuposCambiarModo=m=>{modo=m;pintar();if(modo==='ventana')abrir();else{el('abrir').hidden=true;actualizar()}};
  document.addEventListener('visibilitychange',pulso);const reloj=setInterval(pulso,1000);
  function cerrar(){detener();destruido=true;delete window.IPNCuposCambiarModo;document.title=tituloOriginal;clearInterval(reloj);document.removeEventListener('visibilitychange',pulso);window.removeEventListener('message',mensaje);panel.remove();estilo.remove()}
  el('cerrar').onclick=cerrar;panel.addEventListener('keydown',e=>{if(e.key==='Escape')cerrar()});if(revision){
    for(const k of ['carrera','plan']){el(k).innerHTML=revision.opciones[k].map(o=>`<option value="${esc(o.valor)}">${esc(o.texto)}</option>`).join('');el(k).value=datos[k]}
    el('detalle').onclick=()=>{};el('permitir').onclick=()=>{};
  }
  pintar();if(revision){el('estado').textContent='';return}if(modo==='ventana')abrir();else{el('estado').textContent=seleccion?tx('inicio'):'';actualizar()}
};
/*__CUPOS_INICIO__*/
window.IPNCuposMontar();
