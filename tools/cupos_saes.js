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
      return {grupo:c[0],materia:c[1],nombre:c[2],cupo:+c[4],inscritos:+c[5],disponibles:+c[6]};
    });
    if(!filas.length)throw new Error('vacia');
    if(rows.slice(1).some(r=>r.children.length!==7))throw new Error('columnas');
    return filas;
  }
  function validar(d){
    return d?.tipo==='ipnt.cupos.datos'&&d.v===1&&/^[a-z0-9]+$/.test(d.unidad)&&
      typeof d.carrera==='string'&&typeof d.plan==='string'&&Number.isFinite(Date.parse(d.hora))&&
      Date.parse(d.hora)<=Date.now()+60000&&Array.isArray(d.filas)&&d.filas.length<=5000&&d.filas.every(f=>
        typeof f.grupo==='string'&&f.grupo.length<=40&&typeof f.materia==='string'&&f.materia.length<=40&&
        ['cupo','inscritos','disponibles'].every(k=>Number.isSafeInteger(f[k])&&f[k]>=0));
  }
  /* El plazo cuenta tiempo de pared, también mientras la pestaña está oculta. */
  function reloj({ahora=Date.now,oculta=()=>false,consultar,fin}){
    let inicio=null,ultima=null;
    return {activar(){inicio=ahora();ultima=ahora()},desactivar(){inicio=null},
      tick(){if(inicio===null)return;if(ahora()-inicio>=1800000){inicio=null;fin();return}
        if(!oculta()&&ahora()-ultima>=60000){ultima=ahora();consultar()}},
      consultada(){ultima=ahora()}};
  }
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
      body.set('ctl00$mainCopy$'+target,val);doc=await leer(body);
    }
    if(!select('dpdcarrera')||!select('dpdplan'))throw new Error('sesion');
    if(!doc.querySelector('[name="ctl00$mainCopy$rblEsquema"][value="1"]:checked'))await post('rblEsquema','1');
    if(['Chkespecialidad','ChkSemestre','Chkgrupo','Chkmateria'].some(k=>doc.querySelector('[name="ctl00$mainCopy$'+k+'"]:checked')))await post('dpdcarrera',select('dpdcarrera').value);
    carrera=carrera||select('dpdcarrera').value;
    if(![...select('dpdcarrera').options].some(o=>o.value===carrera))throw new Error('seleccion');
    if(select('dpdcarrera').value!==carrera)await post('dpdcarrera',carrera);
    const planes=[...select('dpdplan').options];
    if(plan&&!planes.some(o=>o.value===plan)){opciones(doc);throw new Error('plan')}
    plan=plan||select('dpdplan').value;
    if(select('dpdplan').value!==plan)await post('dpdplan',plan);
    opciones(doc);
    if(select('dpdcarrera').value!==carrera||select('dpdplan').value!==plan||!doc.querySelector('[name="ctl00$mainCopy$rblEsquema"][value="1"]:checked'))throw new Error('seleccion');
    return {carrera,plan,filas:parsear(doc)};
  }
  raiz.IPNCupos={origenSaes,origenSate,clave,parsear,validar,reloj,consultar};
})(typeof window==='undefined'?globalThis:window);

/*__CUPOS_PANEL__*/
(function(){
  'use strict';
  const URL_SATE='__CUPOS_URL__', textos=__CUPOS_TEXTOS__;
  const C=window.IPNCupos, tx=(k,v={})=>(textos['sate.cupos.'+k]||k).replace(/\{(\w+)\}/g,(_,k)=>v[k]??''), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(!C.origenSaes(location.origin)){alert(tx('solo_saes'));return}
  if(document.getElementById('ipnt-cupos')){document.getElementById('ipnt-cupos').focus();return}
  const unidad=location.hostname.match(/saes\.([a-z0-9]+)\.ipn\.mx$/)[1], origin=URL_SATE?new URL(URL_SATE).origin:null;
  let sate=null,seleccion=[],datos=null,anterior=new Map(),busy=false,destruido=false,conexion=null;
  const panel=document.createElement('section');panel.id='ipnt-cupos';panel.tabIndex=-1;panel.setAttribute('aria-label',tx('titulo'));
  panel.innerHTML=`<style>
    #ipnt-cupos{--ipn-texto:#24242b;--ipn-superficie:#fff;--ipn-linea:#dddde5;--ipn-acento:#71334c;position:fixed;z-index:2147483646;right:12px;bottom:12px;width:min(580px,calc(100vw - 24px));max-height:85vh;overflow:auto;background:var(--ipn-superficie);color:var(--ipn-texto);border:1px solid var(--ipn-linea);border-radius:16px;padding:18px;box-shadow:0 8px 32px #0003;font:14px/1.5 system-ui;box-sizing:border-box}
    #ipnt-cupos *{box-sizing:border-box}#ipnt-cupos header,#ipnt-cupos .acciones{display:flex;gap:10px;align-items:center;flex-wrap:wrap}#ipnt-cupos h2{margin:0;flex:1;font-size:20px}#ipnt-cupos button,#ipnt-cupos select,#ipnt-cupos input[type=search]{font:inherit;color:inherit;background:var(--ipn-superficie);border:1px solid var(--ipn-linea);border-radius:8px;padding:6px}#ipnt-cupos button{cursor:pointer}#ipnt-cupos :focus-visible{outline:3px solid var(--ipn-acento);outline-offset:2px}#ipnt-cupos label{display:inline-block;margin:8px 8px 8px 0}#ipnt-cupos table{width:100%;border-collapse:collapse;font-size:13px}#ipnt-cupos th,#ipnt-cupos td{text-align:left;padding:6px;border-bottom:1px solid var(--ipn-linea)}#ipnt-cupos .tabla{overflow:auto}#ipnt-cupos .lleno{color:var(--ipn-acento);font-weight:600}#ipnt-cupos p{margin:10px 0}
    </style><header><h2>${esc(tx('titulo'))}</h2><button data-c="cerrar" aria-label="${esc(tx('cerrar'))}">×</button></header>
    <p>${esc(tx('limites'))}</p><label>${esc(tx('carrera'))} <select data-c="carrera"></select></label><label>${esc(tx('plan'))} <select data-c="plan"></select></label>
    <div class="acciones"><button data-c="actualizar">${esc(tx('actualizar'))}</button><button data-c="sate">${esc(tx('abrir_sate'))}</button><label><input type="checkbox" data-c="auto"> ${esc(tx('automatico'))}</label></div>
    <label>${esc(tx('filtro'))} <input type="search" data-c="filtro"></label><p data-c="estado" role="status" aria-live="polite">${esc(tx('inicio'))}</p><div class="tabla" data-c="tabla"></div>`;
  document.body.appendChild(panel);panel.focus();
  const el=k=>panel.querySelector('[data-c="'+k+'"]');
  function opciones(doc){for(const k of ['carrera','plan']){const s=doc.querySelector('[name="ctl00$mainCopy$dpd'+k+'"]');if(s){el(k).innerHTML=[...s.options].map(o=>`<option value="${esc(o.value)}">${esc(o.textContent)}</option>`).join('');el(k).value=s.value}}}
  opciones(document);
  if(!URL_SATE){el('sate').disabled=true;el('sate').title=tx('sin_sitio')}
  function enviar(d){if(sate&&!sate.closed)sate.postMessage(d,origin)}
  function pintar(){if(!datos)return;const q=el('filtro').value.toLocaleLowerCase();
    const filas=datos.filas.filter(f=>(!seleccion.length||seleccion.some(s=>C.clave(s)===C.clave(f)))&&(!q||(f.grupo+' '+f.materia+' '+f.nombre).toLocaleLowerCase().includes(q)));
    el('tabla').innerHTML=`<table><caption>${esc(tx(seleccion.length?'elegidos':'todos'))}</caption><thead><tr>${['grupo','materia','cupo','inscritos','disponibles','cambio'].map(k=>`<th scope="col">${esc(tx(k))}</th>`).join('')}</tr></thead><tbody>${filas.map(f=>{const antes=anterior.get(C.clave(f)),delta=antes==null?null:f.disponibles-antes;return `<tr><th scope="row">${esc(f.grupo)}</th><td>${esc(f.materia)}<br>${esc(f.nombre)}</td><td>${f.cupo}</td><td>${f.inscritos}</td><td class="${f.disponibles===0?'lleno':''}">${f.disponibles===0?esc(tx('lleno')):f.disponibles}</td><td>${delta==null?'':delta>0?'▲ '+delta:delta<0?'▼ '+Math.abs(delta):'='}</td></tr>`}).join('')}</tbody></table>`+(filas.length?'':`<p>${esc(tx('sin_coincidencias'))}</p>`);
  }
  const reloj=C.reloj({oculta:()=>document.hidden,consultar:actualizar,fin(){el('auto').checked=false;el('estado').textContent=tx('fin')}});
  async function actualizar(){if(busy||destruido)return;busy=true;el('actualizar').disabled=true;reloj.consultada();
    el('estado').textContent=tx('consultando');const carrera=el('carrera').value,plan=el('plan').value;
    try{const r=await C.consultar({fetch:window.fetch.bind(window),parser:s=>new DOMParser().parseFromString(s,'text/html'),url:location.origin+'/Academica/Ocupabilidad_grupos.aspx',carrera,plan,opciones});
      if(destruido)return;
      anterior=new Map(datos&&datos.carrera===r.carrera&&datos.plan===r.plan?datos.filas.map(f=>[C.clave(f),f.disponibles]):[]);
      datos={tipo:'ipnt.cupos.datos',v:1,unidad,...r,hora:new Date().toISOString()};
      el('estado').textContent=tx('ultima',{hora:new Date(datos.hora).toLocaleTimeString('es-MX')});pintar();enviar({...datos,filas:datos.filas.map(({nombre,...f})=>f)});
    }catch(e){if(destruido)return;console.warn('IPN Cupos: consulta fallida',{unidad,carrera,plan,codigo:e.message,etapa:e.etapa,estado:e.estado,pila:e.stack});el('estado').textContent=tx('error_'+(textos['sate.cupos.error_'+e.message]?e.message:'red'));
      if(e.message==='sesion'){el('auto').checked=false;reloj.desactivar()}}
    finally{busy=false;if(!destruido)el('actualizar').disabled=false}
  }
  function mensaje(e){if(!C.origenSate(e.origin,URL_SATE)||e.source!==sate)return;const d=e.data;
    if(d?.tipo==='ipnt.cupos.hola'){clearInterval(conexion);enviar({tipo:'ipnt.cupos.hola',v:1,unidad});if(datos)enviar({...datos,filas:datos.filas.map(({nombre,...f})=>f)})}
    if(d?.tipo==='ipnt.cupos.seleccion'&&d.v===1&&Array.isArray(d.grupos)&&d.grupos.length<=5000&&d.grupos.every(g=>typeof g.grupo==='string'&&typeof g.materia==='string')){seleccion=d.grupos.map(({grupo,materia})=>({grupo,materia}));pintar()}}
  window.addEventListener('message',mensaje);
  const timer=setInterval(()=>reloj.tick(),1000);
  el('auto').onchange=()=>el('auto').checked?reloj.activar():reloj.desactivar();el('actualizar').onclick=actualizar;el('filtro').oninput=pintar;
  el('carrera').onchange=()=>{el('plan').innerHTML='';};
  el('sate').onclick=()=>{if(sate&&!sate.closed){sate.focus();enviar({tipo:'ipnt.cupos.hola',v:1,unidad});return}
    const url=new URL(URL_SATE);url.searchParams.set('sateUnidad',unidad);url.hash='cupos';sate=window.open(url.href,'ipnt-cupos-sate');
    if(!sate){el('estado').textContent=tx('ventana');return}
    clearInterval(conexion);let n=0;conexion=setInterval(()=>{enviar({tipo:'ipnt.cupos.hola',v:1,unidad});if(++n>=15)clearInterval(conexion)},1000)};
  function cerrar(){destruido=true;clearInterval(timer);clearInterval(conexion);window.removeEventListener('message',mensaje);panel.remove()}
  el('cerrar').onclick=cerrar;panel.addEventListener('keydown',e=>{if(e.key==='Escape')cerrar()});
})();
