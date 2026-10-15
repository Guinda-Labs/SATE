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
  raiz.IPNCupos={texto,origenSaes,origenSate,clave,parsear,validar,limpiar,antigua,reciente,fecha,tarjetas,consultar,cambios};
})(typeof window==='undefined'?globalThis:window);

/*__CUPOS_PANEL__*/
(function(){
  'use strict';
  const URL_SATE='__CUPOS_URL__',textos=__CUPOS_TEXTOS__;
  const C=window.IPNCupos,tx=(k,v)=>C.texto(textos,k,v),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(document.getElementById('ipnt-cupos')){document.getElementById('ipnt-cupos').focus();return}
  const permitido=C.origenSaes(location.origin),unidad=permitido?location.hostname.match(/saes\.([a-z0-9]+)\.ipn\.mx$/)[1]:'',origin=URL_SATE?new URL(URL_SATE).origin:null;
  let sate=null,datos=null,carrera='',plan='',contexto='',busy=false,destruido=false,ultima=window.IPNCuposUltimaConsulta??null;
  let automatico=false,hasta=0,proxima=0,conectado=false,consultaInicial=false;
  const panel=document.createElement('section');panel.id='ipnt-cupos';panel.tabIndex=-1;panel.setAttribute('aria-label',tx('titulo'));
  const estilo=document.createElement('style');estilo.textContent=`
  #ipnt-cupos{--ipn-texto:#29252b;--ipn-superficie:#fff;--ipn-linea:#ded8dc;--ipn-acento:#71334c;position:fixed;z-index:2147483646;right:12px;bottom:12px;max-width:calc(100vw - 24px);background:var(--ipn-superficie);color:var(--ipn-texto);border:1px solid var(--ipn-linea);border-radius:12px;padding:10px 12px;box-shadow:0 4px 20px #0003;font:14px/1.5 system-ui;display:flex;flex-wrap:wrap;align-items:center;gap:8px;box-sizing:border-box}
  @media(prefers-color-scheme:dark){#ipnt-cupos{--ipn-texto:#eee8eb;--ipn-superficie:#211e22;--ipn-linea:#61565e;--ipn-acento:#efb7ce}}
  #ipnt-cupos button{font:inherit;color:inherit;background:var(--ipn-superficie);border:1px solid var(--ipn-linea);border-radius:8px;padding:6px;cursor:pointer}#ipnt-cupos :focus-visible{outline:3px solid var(--ipn-acento);outline-offset:2px}#ipnt-cupos [hidden]{display:none}`;
  document.head.appendChild(estilo);
  panel.innerHTML=`<span data-c="estado" role="status" aria-live="polite">${esc(tx('conectando'))}</span>
    <button data-c="actualizar">${esc(tx('consultar'))}</button><button data-c="abrir" hidden>${esc(tx('reabrir'))}</button>
    <label><input type="checkbox" data-c="auto"> ${esc(tx('auto'))}</label>
    <span data-c="automatico" role="status"></span><button data-c="seguir" hidden>${esc(tx('seguir'))}</button>
    <button data-c="cerrar" aria-label="${esc(tx('cerrar'))}">×</button>`;
  document.body.appendChild(panel);panel.focus();const el=k=>panel.querySelector('[data-c="'+k+'"]');
  function enviar(d){if(sate&&!sate.closed)sate.postMessage(d,origin)}
  function preferencias(){enviar({tipo:'ipnt.cupos.avisos',v:1,unidad,hasta:automatico?hasta:0,notificacion:automatico})}
  function enviarDatos(){if(datos)enviar(C.limpiar(datos))}
  function estado(){
    if(sate?.closed){conectado=false;el('estado').textContent=tx('cerrada');el('abrir').hidden=false;return false}
    return !!sate;
  }
  function abrir(){
    if(!permitido){el('estado').textContent=tx('solo_saes');return}
    if(!URL_SATE){el('estado').textContent=tx('sin_sitio');return}
    const url=new URL(URL_SATE);url.searchParams.set('unidad',unidad);conectado=false;
    sate=window.open(url.href,'sate-cupos','width=1024,height=760');
    el('abrir').hidden=!!sate;el('estado').textContent=tx(sate?'conectando':'ventana');
    if(sate)enviar({tipo:'ipnt.cupos.hola',v:1,unidad});
  }
  function detener(vencido=false){automatico=false;el('auto').checked=false;preferencias();el('automatico').textContent=tx(vencido?'auto_fin':'auto_apagada');el('seguir').hidden=!vencido}
  function activar(){automatico=true;hasta=Date.now()+30*60000;proxima=Math.max(Date.now(),(ultima??0)+60000);el('auto').checked=true;el('seguir').hidden=true;preferencias();pulso()}
  async function actualizar(){
    if(busy||destruido||!permitido||!estado()||!conectado)return;
    if(ultima!==null&&Date.now()-ultima<15000){cuenta();return}
    busy=true;ultima=Date.now();window.IPNCuposUltimaConsulta=ultima;proxima=ultima+60000;el('actualizar').disabled=true;el('estado').textContent=tx('consultando');
    try{
      const r=await C.consultar({fetch:window.fetch.bind(window),parser:s=>new DOMParser().parseFromString(s,'text/html'),url:location.origin+'/Academica/Ocupabilidad_grupos.aspx',carrera,plan,
        opciones(doc){enviar({tipo:'ipnt.cupos.opciones',v:1,unidad,opciones:Object.fromEntries(['carrera','plan'].map(k=>{const s=doc.querySelector('[name="ctl00$mainCopy$dpd'+k+'"]');return [k,s?[...s.options].map(o=>({valor:o.value,texto:o.textContent,elegido:o.value===s.value})):[]]}))})}});
      if(destruido)return;
      const nuevos={tipo:'ipnt.cupos.datos',v:1,unidad,...r,hora:new Date().toISOString()};
      datos=nuevos;carrera=r.carrera;plan=r.plan;
      enviarDatos();if(estado())el('estado').textContent=tx('conectada',{hora:new Date(datos.hora).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})});
    }catch(e){console.warn('IPN Cupos: consulta fallida',{unidad,carrera,plan,codigo:e.message,etapa:e.etapa,estado:e.estado,pila:e.stack});el('estado').textContent=tx('error_'+(textos['sate.cupos.error_'+e.message]?e.message:'red'))}
    finally{busy=false;if(!destruido)cuenta()}
  }
  function cuenta(){const n=ultima===null?0:Math.max(0,Math.ceil((15000-Date.now()+ultima)/1000));el('actualizar').textContent=tx(n?'cuenta':'consultar',{n});el('actualizar').disabled=busy||n>0;enviar({tipo:'ipnt.cupos.ritmo',v:1,unidad,n,busy})}
  function pulso(){
    if(destruido)return;cuenta();estado();
    if(!conectado&&sate&&!sate.closed)enviar({tipo:'ipnt.cupos.hola',v:1,unidad});
    if(!automatico)return;if(Date.now()>=hasta){detener(true);return}
    el('automatico').textContent=tx(document.hidden?'auto_pausa':'auto_activa');
    if(!document.hidden&&Date.now()>=proxima&&conectado&&estado())return actualizar();
  }
  function mensaje(e){
    if(!C.origenSate(e.origin,URL_SATE)||e.source!==sate)return;const d=e.data;
    if(d?.tipo==='ipnt.cupos.hola'){conectado=true;el('estado').textContent=datos?tx('conectada',{hora:new Date(datos.hora).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}):tx('conectado');preferencias();enviarDatos()}
    if(d?.tipo==='ipnt.cupos.seleccion'&&d.v===1&&Array.isArray(d.grupos)&&d.grupos.length<=500){
      const nuevo=JSON.stringify([d.carrera,d.plan]);
      if(contexto!==nuevo){contexto=nuevo;if(typeof d.carrera==='string'&&d.carrera.length<=40)carrera=d.carrera;if(typeof d.plan==='string'&&d.plan.length<=40)plan=d.plan}
      for(const k of ['texto','superficie','linea','acento'])if(/^#[a-f0-9]{3,8}$/i.test(d.tokens?.[k]||''))panel.style.setProperty('--ipn-'+k,d.tokens[k]);
      if(!consultaInicial){consultaInicial=true;actualizar()}
    }
    if(d?.tipo==='ipnt.cupos.consultar'&&d.v===1){if(typeof d.carrera==='string'&&typeof d.plan==='string'&&d.carrera.length<=40&&d.plan.length<=40){carrera=d.carrera;plan=d.plan;actualizar()}}

  }
  window.addEventListener('message',mensaje);el('actualizar').onclick=actualizar;el('abrir').onclick=abrir;
  el('auto').onchange=()=>el('auto').checked?activar():detener();el('seguir').onclick=activar;
  document.addEventListener('visibilitychange',pulso);const reloj=setInterval(pulso,1000);
  function cerrar(){detener();destruido=true;clearInterval(reloj);document.removeEventListener('visibilitychange',pulso);window.removeEventListener('message',mensaje);panel.remove();estilo.remove()}
  el('cerrar').onclick=cerrar;panel.addEventListener('keydown',e=>{if(e.key==='Escape')cerrar()});abrir();
})();
