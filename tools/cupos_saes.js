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
        ['cupo','inscritos','disponibles'].every(k=>Number.isSafeInteger(f[k])&&f[k]>=0));
  }
  const antigua=d=>!d||Date.now()-Date.parse(d.hora)>3600000;
  const limpiar=d=>({tipo:'ipnt.cupos.datos',v:1,unidad:d.unidad,carrera:d.carrera,plan:d.plan,hora:d.hora,
    filas:d.filas.map(({grupo,materia,cupo,inscritos,disponibles})=>({grupo,materia,cupo,inscritos,disponibles}))});
  const reciente=(a,b)=>validar(b)&&(!validar(a)||Date.parse(b.hora)>Date.parse(a.hora))?b:a;
  const fecha=d=>new Date(d.hora).toLocaleString('es-MX',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
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
    if(!select('dpdcarrera')||!select('dpdplan'))throw new Error('sesion');
    await post('rblEsquema$0','1');
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
  raiz.IPNCupos={origenSaes,origenSate,clave,parsear,validar,limpiar,antigua,reciente,fecha,tarjetas,consultar};
})(typeof window==='undefined'?globalThis:window);

/*__CUPOS_PANEL__*/
(function(){
  'use strict';
  const URL_SATE='__CUPOS_URL__',textos=__CUPOS_TEXTOS__;
  const C=window.IPNCupos,tx=(k,v={})=>(textos['sate.cupos.'+k]||k).replace(/\{(\w+)\}/g,(_,k)=>v[k]??''),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if(!C.origenSaes(location.origin)){alert(tx('solo_saes'));return}
  if(document.getElementById('ipnt-cupos')){document.getElementById('ipnt-cupos').focus();return}
  const unidad=location.hostname.match(/saes\.([a-z0-9]+)\.ipn\.mx$/)[1],origin=URL_SATE?new URL(URL_SATE).origin:null;
  let sate=null,seleccion=[],oferta=[],datos=null,anterior=new Map(),busy=false,destruido=false,ultima=window.IPNCuposUltimaConsulta??null,conexion=null;
  const originales=new Map();
  const panel=document.createElement('section');panel.id='ipnt-cupos';panel.tabIndex=-1;panel.setAttribute('aria-label',tx('titulo'));
  const estilo=document.createElement('style');estilo.id='ipnt-cupos-estilo';estilo.textContent=`
  #ipnt-cupos{--ipn-texto:#29252b;--ipn-superficie:#fff;--ipn-linea:#ded8dc;--ipn-acento:#71334c;position:fixed;z-index:2147483646;right:12px;bottom:12px;width:min(620px,calc(100vw - 24px));max-height:85vh;overflow:auto;background:var(--ipn-superficie);color:var(--ipn-texto);border:1px solid var(--ipn-linea);border-radius:16px;padding:18px;box-shadow:0 8px 32px #0003;font:14px/1.5 system-ui;box-sizing:border-box}
  @media(prefers-color-scheme:dark){#ipnt-cupos{--ipn-texto:#eee8eb;--ipn-superficie:#211e22;--ipn-linea:#61565e;--ipn-acento:#efb7ce}}
  #ipnt-cupos *{box-sizing:border-box}#ipnt-cupos header{display:flex;gap:12px;align-items:center}#ipnt-cupos h2{flex:1;margin:0;font-size:20px}#ipnt-cupos button,#ipnt-cupos select,#ipnt-cupos input{font:inherit;color:inherit;background:var(--ipn-superficie);border:1px solid var(--ipn-linea);border-radius:8px;padding:7px}#ipnt-cupos button{cursor:pointer}#ipnt-cupos :focus-visible{outline:3px solid var(--ipn-acento);outline-offset:2px}#ipnt-cupos label{display:inline-block;margin:8px 6px 8px 0}#ipnt-cupos .tabla{overflow:auto}#ipnt-cupos table{width:100%;border-collapse:collapse;font-size:13px}#ipnt-cupos th,#ipnt-cupos td{padding:6px;text-align:left;border-bottom:1px solid var(--ipn-linea)}#ipnt-cupos article{padding:10px;border:1px solid var(--ipn-linea);border-radius:10px;margin:8px 0}
  #ipnt-cupos tr.elegido{font-weight:600;background:color-mix(in srgb,var(--ipn-acento) 12%,var(--ipn-superficie))}.ipnt-cupo-barra{display:block;height:6px;border-radius:4px;background:#ddd;min-width:70px;margin-top:4px}.ipnt-cupo-barra i{display:block;height:100%;border-radius:4px;background:var(--ocupacion)}#ctl00_mainCopy_GrvOcupabilidad tr.ipnt-elegido{outline:2px solid #71334c;outline-offset:-2px}`;
  document.head.appendChild(estilo);
  panel.innerHTML=`<header><h2>${esc(tx('titulo'))}</h2><button data-c="cerrar" aria-label="${esc(tx('cerrar'))}">×</button></header><p>${esc(tx('limites'))}</p>
  <label>${esc(tx('carrera'))} <select data-c="carrera"></select></label><label>${esc(tx('plan'))} <select data-c="plan"></select></label>
  <p><button data-c="actualizar">${esc(tx('consultar'))}</button></p>
  <p data-c="estado" role="status" aria-live="polite">${esc(tx('inicio'))}</p><div data-c="tarjetas"></div>
  <label>${esc(tx('filtro'))} <input type="search" data-c="filtro"></label><label>${esc(tx('nivel'))} <select data-c="nivel"><option value="">${esc(tx('todos_niveles'))}</option></select></label>
  <label>${esc(tx('orden'))} <select data-c="orden"><option value="desc">${esc(tx('orden_mas'))}</option><option value="asc">${esc(tx('orden_menos'))}</option></select></label><div class="tabla" data-c="tabla"></div>`;
  document.body.appendChild(panel);panel.focus();const el=k=>panel.querySelector('[data-c="'+k+'"]');
  function opciones(doc){for(const k of ['carrera','plan']){const s=doc.querySelector('[name="ctl00$mainCopy$dpd'+k+'"]');if(s){el(k).innerHTML=[...s.options].map(o=>`<option value="${esc(o.value)}">${esc(o.textContent)}</option>`).join('');el(k).value=s.value}}}
  opciones(document);
  function enviar(d){if(sate&&!sate.closed)sate.postMessage(d,origin)}
  function abrir(){if(!URL_SATE)return;const url=new URL(URL_SATE);url.searchParams.set('unidad',unidad);
    sate=window.open(url.href,'sate-cupos','width=420,height=560');
    if(!sate){el('estado').textContent=tx('ventana');return}
    clearInterval(conexion);let n=0;conexion=setInterval(()=>{enviar({tipo:'ipnt.cupos.hola',v:1,unidad});if(++n>=15)clearInterval(conexion)},500);
  }
  function barra(f){const n=f.cupo?Math.min(100,Math.round(f.inscritos/f.cupo*100)):100;return `<span class="ipnt-cupo-barra" aria-hidden="true"><i style="width:${n}%;--ocupacion:${f.disponibles===0?'var(--ipn-acento)':n>=80?'#ab751b':'#35805a'}"></i></span>`}
  function disponibilidad(f){return tx(f.disponibles===0?'lleno':'lugares',{n:f.disponibles})}
  function pintar(){if(!datos)return;const q=el('filtro').value.toLocaleLowerCase(),nivel=el('nivel').value;
    const elegido=f=>seleccion.some(s=>C.clave(s)===C.clave(f));
    const filas=datos.filas.filter(f=>(!nivel||f.nivel===nivel)&&(!q||(f.grupo+' '+f.materia+' '+f.nombre).toLocaleLowerCase().includes(q))).sort((a,b)=>Number(elegido(b))-Number(elegido(a))+(elegido(a)===elegido(b)?(el('orden').value==='asc'?a.disponibles-b.disponibles:b.disponibles-a.disponibles):0));
    el('tabla').innerHTML=`<table><caption>${esc(tx('todos'))}</caption><thead><tr>${['grupo','materia','disponibles','cambio'].map(k=>`<th scope="col">${esc(tx(k))}</th>`).join('')}</tr></thead><tbody>${filas.map(f=>{const a=anterior.get(C.clave(f)),delta=a==null?null:f.disponibles-a;return `<tr class="${elegido(f)?'elegido':''}"><th scope="row">${esc(f.grupo)}${elegido(f)?' · '+esc(tx('tu_grupo')):''}</th><td>${esc(f.materia)}<br>${esc(f.nombre)}</td><td>${esc(disponibilidad(f))} · ${f.inscritos}/${f.cupo}${barra(f)}</td><td>${delta==null?'':delta>0?'▲ '+delta:delta<0?'▼ '+Math.abs(delta):'='}</td></tr>`}).join('')}</tbody></table>`;
    el('tarjetas').innerHTML=seleccion.length?`<h3>${esc(tx('tu_horario'))}</h3>`+C.tarjetas(datos,seleccion,oferta).map(s=>`<article><b>${esc(s.materia)} · ${esc(s.grupo)}</b><p>${esc(s.fila?disponibilidad(s.fila):tx('sin_dato'))}</p>${s.fila?.disponibles===0?s.alternativas.map(a=>`<p>${esc(a.grupo)} · ${esc(disponibilidad(a))} · ${esc(tx(a.choque===null?'sin_horas':a.choque?'con_choque':'sin_choque'))}</p>`).join(''):''}</article>`).join(''):'';
    // Se conservan las filas y sus valores originales para restaurarlos al cerrar el panel.
    const tabla=document.getElementById('ctl00_mainCopy_GrvOcupabilidad');if(tabla)for(const r of [...tabla.querySelectorAll('tr')].slice(1)){
      const f=datos.filas.find(f=>f.grupo===r.children[0]?.textContent.trim()&&f.materia===r.children[1]?.textContent.trim());if(!f)continue;
      if(!originales.has(r))originales.set(r,{padre:r.parentNode,hidden:r.hidden,celdas:[...r.children].slice(4).map(c=>c.innerHTML)});
      r.hidden=!filas.includes(f);r.classList.toggle('ipnt-elegido',elegido(f));
      r.children[4].textContent=f.cupo;r.children[5].textContent=f.inscritos;
      const a=anterior.get(C.clave(f)),delta=a==null?null:f.disponibles-a;
      r.children[6].innerHTML=esc(disponibilidad(f))+(elegido(f)?' · '+esc(tx('tu_grupo')):'')+(delta>0?' ▲ '+delta:delta<0?' ▼ '+Math.abs(delta):'')+barra(f);
    }
    if(tabla){const orden=new Map(datos.filas.map(f=>[C.clave(f),f]));const rows=[...originales.keys()].filter(r=>r.isConnected!==false);
      rows.sort((a,b)=>{const fa=orden.get(a.children[0].textContent.trim()+'|'+a.children[1].textContent.trim()),fb=orden.get(b.children[0].textContent.trim()+'|'+b.children[1].textContent.trim());return fa&&fb?Number(elegido(fb))-Number(elegido(fa))+(elegido(fa)===elegido(fb)?(el('orden').value==='asc'?fa.disponibles-fb.disponibles:fb.disponibles-fa.disponibles):0):0});
      for(const r of rows)r.parentNode.appendChild(r);
    }
  }
  async function actualizar(){if(busy||destruido)return;
    if(ultima!==null&&Date.now()-ultima<60000){el('estado').textContent=tx('esperar');return}
    if(!sate||sate.closed)abrir();busy=true;ultima=Date.now();window.IPNCuposUltimaConsulta=ultima;el('actualizar').disabled=true;el('estado').textContent=tx('consultando');
    const carrera=el('carrera').value,plan=el('plan').value;
    try{const r=await C.consultar({fetch:window.fetch.bind(window),parser:s=>new DOMParser().parseFromString(s,'text/html'),url:location.origin+'/Academica/Ocupabilidad_grupos.aspx',carrera,plan,opciones});if(destruido)return;
      anterior=new Map(datos&&datos.carrera===r.carrera&&datos.plan===r.plan?datos.filas.map(f=>[C.clave(f),f.disponibles]):[]);
      datos={tipo:'ipnt.cupos.datos',v:1,unidad,...r,hora:new Date().toISOString()};el('estado').textContent=tx('ultima',{hora:C.fecha(datos)});
      el('nivel').innerHTML=`<option value="">${esc(tx('todos_niveles'))}</option>`+[...new Set(r.filas.map(f=>f.nivel))].map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');pintar();enviarDatos();
    }catch(e){console.warn('IPN Cupos: consulta fallida',{unidad,carrera,plan,codigo:e.message,etapa:e.etapa,estado:e.estado,pila:e.stack});el('estado').textContent=tx('error_'+(textos['sate.cupos.error_'+e.message]?e.message:'red'))}
    finally{busy=false;if(!destruido)el('actualizar').disabled=false}
  }
  function enviarDatos(){if(datos)enviar({...datos,filas:datos.filas.map(({grupo,materia,cupo,inscritos,disponibles})=>({grupo,materia,cupo,inscritos,disponibles}))})}
  function mensaje(e){if(!C.origenSate(e.origin,URL_SATE)||e.source!==sate)return;const d=e.data;
    if(d?.tipo==='ipnt.cupos.hola'){clearInterval(conexion);enviarDatos()}
    if(d?.tipo==='ipnt.cupos.seleccion'&&d.v===1&&Array.isArray(d.grupos)&&Array.isArray(d.oferta)&&d.grupos.length<=500&&d.oferta.length<=10000){
      const valida=g=>typeof g.grupo==='string'&&typeof g.materia==='string'&&Array.isArray(g.horas)&&g.horas.every(h=>Array.isArray(h)&&h.length===3&&h.every(Number.isFinite));
      if(!d.grupos.every(valida)||!d.oferta.every(valida))return;seleccion=d.grupos;oferta=d.oferta;
      for(const k of ['texto','superficie','linea','acento'])if(/^#[a-f0-9]{3,8}$/i.test(d.tokens?.[k]||''))panel.style.setProperty('--ipn-'+k,d.tokens[k]);pintar();
    }
  }
  window.addEventListener('message',mensaje);el('actualizar').onclick=actualizar;for(const k of ['filtro','nivel','orden'])el(k).oninput=pintar;
  el('carrera').onchange=()=>{el('plan').innerHTML=''};
  function cerrar(){destruido=true;clearInterval(conexion);window.removeEventListener('message',mensaje);panel.remove();estilo.remove();
    for(const [r,o] of originales){r.hidden=o.hidden;r.classList.remove('ipnt-elegido');o.celdas.forEach((html,i)=>r.children[4+i].innerHTML=html);o.padre.appendChild(r)}
  }
  el('cerrar').onclick=cerrar;panel.addEventListener('keydown',e=>{if(e.key==='Escape')cerrar()});
  abrir();
})();
