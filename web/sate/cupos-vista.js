/* El rescate trabaja sobre el mismo horario, oferta y motor que la vista completa. */
window.SateCuposVista=(()=>{
  const tx=(k,v)=>SATE.texto('sate.cupos.'+k,v);
  let raiz,deshacer=null,opciones=[],versionOpciones='',mensaje='';
  const abiertos=new Set();
  const version=()=>JSON.stringify([S.per,S.car,plan().sel,plan().own,CUPOS.datos?.hora]);
  const revision=DEMO&&new URLSearchParams(location.search).get('revisionCupos')==='1'&&/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const horario=c=>c[6].length?pattern(c).join(' · '):tx('sin_horas');
  function clasificarReemplazo(original,candidata,resto){
    const normal=s=>String(s||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
    if(original.grupo!==candidata.grupo&&((original.materia&&original.materia===candidata.materia)||
      (normal(original.nombre)&&normal(original.nombre)===normal(candidata.nombre))))return 'tipo_misma_materia';
    function unir(bloques){
      const unidos=[];
      for(const [d,a,b] of bloques.map(b=>b.slice()).sort((a,b)=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2])){
        const ultimo=unidos.at(-1);
        if(ultimo&&ultimo[0]===d&&a<=ultimo[2])ultimo[2]=Math.max(ultimo[2],b);else unidos.push([d,a,b]);
      }
      return unidos;
    }
    const horas=unir(candidata.horas);
    if(!horas.length)return null;
    if(JSON.stringify(unir(original.horas))===JSON.stringify(horas))return 'tipo_mismo_horario';
    // Sin horas de alguna actividad restante no se puede asegurar que el hueco esté libre.
    if(resto.some(r=>!r.horas.length))return null;
    function huecos(bloques){
      const ocupados=unir(bloques),libres=[];
      for(let i=1;i<ocupados.length;i++)if(ocupados[i-1][0]===ocupados[i][0])libres.push([ocupados[i][0],ocupados[i-1][2],ocupados[i][1]]);
      return libres;
    }
    const ocupados=resto.flatMap(r=>r.horas),libres=huecos(ocupados),minutos=bs=>bs.reduce((s,[,a,b])=>s+b-a,0);
    // El hueco puede abarcar la materia retirada y descansos contiguos, no solo sus bloques.
    return horas.every(([d,a,b])=>libres.some(([e,i,f])=>d===e&&a>=i&&b<=f))&&
      minutos(huecos([...ocupados,...horas]))<minutos(libres)?'tipo_ocupa_hueco':null;
  }
  const datoReemplazo=c=>({materia:c[8],nombre:c.own?c.n:name(c),grupo:c[3],horas:slots(c)});
  const tipoReemplazo=(c,x,resto)=>clasificarReemplazo(datoReemplazo(c),datoReemplazo(x),resto.map(datoReemplazo));
  function alternativas(c){
    const resto=selected().filter(x=>keyOf(x)!==keyOf(c));
    return classes().filter(x=>x[0]===S.car&&x[8]===c[8]&&keyOf(x)!==keyOf(c)&&CUPOS.fila(x)?.disponibles>0)
      .map(x=>({c:x,tipo:tipoReemplazo(c,x,[...resto,...ownAsClasses()]),choques:[...resto,...ownAsClasses()].filter(r=>overlaps(r,x)),incierto:!x[6].length||resto.some(r=>!r[6].length)}))
      .sort((a,b)=>Number(!!a.choques.length||a.incierto)-Number(!!b.choques.length||b.incierto)||CUPOS.fila(b.c).disponibles-CUPOS.fila(a.c).disponibles||a.c[3].localeCompare(b.c[3]));
  }
  // Se consulta el mismo periodo de planeación que alimenta las recomendaciones del mapa.
  function otras(c){return conPlan(()=>{
    const resto=selected().filter(x=>keyOf(x)!==keyOf(c)),elegidas=new Set(resto.map(x=>x[8])),recomendadas=new Set(suggestions().list),hecho=new Set([...tr().done,...tr().curso]),req=prereqs();
    return classes().filter(x=>x[0]===S.car&&x[8]!==c[8]&&cur()[x[8]]&&!elegidas.has(x[8])&&available(x[8])&&
      (req[x[8]]||[]).every(k=>hecho.has(k))&&CUPOS.fila(x)?.disponibles>0&&x[6].length&&![...resto,...ownAsClasses()].some(r=>!slots(r).length||overlaps(r,x)))
      .map(x=>{const tipo=tipoReemplazo(c,x,[...resto,...ownAsClasses()]);return {c:x,choques:[],recomendada:recomendadas.has(x[8]),tipo,hueco:tipo==='tipo_mismo_horario'||tipo==='tipo_ocupa_hueco'}})
      .sort((a,b)=>Number(b.recomendada)-Number(a.recomendada)||Number(b.hueco)-Number(a.hueco)||CUPOS.fila(b.c).disponibles-CUPOS.fila(a.c).disponibles||a.c[3].localeCompare(b.c[3]));
  },0)}
  const riesgo=c=>{const f=CUPOS.fila(c);return !!f&&(f.disponibles===0||CUPOS.pocos(f.disponibles))};
  const idSugerencias=c=>'cupos-sug-'+encodeURIComponent(keyOf(c));
  function opcion(a,c){return `<div class="cupos-alternativa"><div>${a.tipo?`<div class="sate-chips"><span class="sate-chip sate-chip--reemplazo" data-estado="info"><span class="sate-chip__texto">${esc(tx(a.tipo))}</span></span></div>`:''}<b>${esc(name(a.c))} · ${esc(a.c[3])}</b>${a.recomendada?` <span class="cupos-recomendada">${esc(tx('recomendada'))}</span>`:''}<p>${esc(profs(a.c))}</p><p>${esc(horario(a.c))}</p><p>${CUPOS.insignia(a.c)} · ${esc(a.choques.length?tx('choque_con',{nombre:a.choques.map(x=>x.own?x.n:name(x)+' '+x[3]).join(', ')}):tx(a.incierto?'sin_horas':'sin_choque'))}</p></div><button type="button" class="btn" data-cupos-cambiar="${esc(keyOf(a.c))}" data-cupos-quitar="${esc(keyOf(c))}">${esc(tx('cambiar'))}</button></div>`}
  function sugerencias(c){
    if(!riesgo(c))return '';
    const mismas=alternativas(c),otras_=otras(c),recom=otras_.filter(a=>a.recomendada),resto=otras_.filter(a=>!a.recomendada);
    return `<details class="cupos-sugerencias" id="${idSugerencias(c)}" data-cupos-detalle="${esc(keyOf(c))}"${abiertos.has(keyOf(c))?' open':''}><summary>${esc(tx('sugerencias'))}</summary><h4>${esc(tx('misma_materia'))}</h4>`+
      (mismas.length?mismas.map(a=>opcion(a,c)).join(''):`<p>${esc(tx('sin_alternativas'))}</p>`)+
      `<h4>${esc(tx('mismo_horario'))}</h4><p class="muted">${esc(tx('mismo_horario_ayuda'))}</p>`+recom.map(a=>opcion(a,c)).join('')+
      (resto.length?`<details><summary>${esc(tx('todas_disponibles',{n:resto.length}))}</summary>${resto.map(a=>opcion(a,c)).join('')}</details>`:'')+
      (!mismas.some(a=>!a.choques.length&&!a.incierto)&&!otras_.length?`<button type="button" class="btn primary" data-cupos-buscar>${esc(tx('buscar_sin_llenos'))}</button>`:'')+`</details>`;
  }
  function avisoCarga(c){
    if(!deshacer||deshacer.periodo!==S.per||deshacer.car!==S.car||deshacer.version!==ws().plan||!deshacer.despues.includes(keyOf(c))||deshacer.antes.includes(keyOf(c)))return '';
    const fail=new Set(tr().fail),ci=cargaInfo(selected().filter(x=>!fail.has(x[8])).reduce((s,x)=>s+x[7],0));
    return ci&&(ci.total<ci.L.min||ci.total>ci.tope+.01)?`<p class="cupos-carga" role="status">${esc(tx('cambio_carga',{n:fmtCr(ci.total),min:fmtCr(ci.L.min),max:fmtCr(ci.tope)}))}</p>`:'';
  }
  function pintarEstado(){
    $('#cupos-cambio').textContent=mensaje;$('#cupos-deshacer').textContent=tx('deshacer');$('#cupos-deshacer').hidden=!deshacer;
    $('#cupos-resultado').hidden=!mensaje&&!deshacer;
  }
  function aplicar(cs){
    deshacer={periodo:S.per,car:S.car,version:ws().plan,antes:plan().sel.slice(),despues:cs.map(keyOf)};
    plan().sel=deshacer.despues.slice();save();
    console.info('SATE Cupos: horario actualizado',{periodo:S.per,version:ws().plan,grupos:plan().sel.length});
    mensaje=tx('cambio_listo');renderCal();
  }
  function restaurar(){
    if(!deshacer)return;
    const d=deshacer,p=W[d.periodo]?.plans[d.version];
    // Una edición posterior de otra pestaña debe conservarse.
    if(!p||S.car!==d.car||S.per!==d.periodo||ws().plan!==d.version||JSON.stringify(p.sel)!==JSON.stringify(d.despues)||
      d.mapa&&JSON.stringify(store.get('t.'+d.car,{}))!==JSON.stringify(d.mapa.despues)){mensaje=tx('deshacer_conflicto');pintarEstado();console.warn('SATE Cupos: deshacer rechazado por edición posterior',{periodo:d.periodo,carrera:d.car,version:d.version});return}
    if(d.mapa){store.set('t.'+d.car,d.mapa.antes);for(const k in T)delete T[k];PLAN_CACHE=null}
    p.sel=d.antes;store.set('w.'+d.periodo,W[d.periodo]);deshacer=null;
    mensaje=tx('cambio_deshecho');renderCal();if(d.mapa)renderTray();renderOffer();renderPlans();
    console.info('SATE Cupos: cambio deshecho',{periodo:d.periodo,carrera:d.car,version:d.version});
  }
  function pintar(){
    if(opciones.length&&versionOpciones!==version()){opciones=[];$('#cupos-opciones').innerHTML=''}
    const riesgos=selected().filter(riesgo);
    $('#cupos-alerta').hidden=!riesgos.length;
    $('#cupos-alerta button').textContent=tx('resumen_riesgo',{n:riesgos.length});
    pintarEstado();
  }
  function mini(cs,n){
    const cont=document.createElement('div');cont.className='cal cupos-mini';
    const items=SateUI.cuadriculaHorario(cs,{S,slots,START,BLOCK,SLOT,SLOTPX:18,$:()=>cont,DAYS,hm,esc,txH,hue,keyOf,name,profs,roomAt,soloLectura:true,insignia:CUPOS.insignia});
    return `<article class="box2"><h3>${esc(tx('opcion_vista',{n:n+1}))}</h3><div class="calwrap">${cont.outerHTML}</div><div class="agenda cupos-mini-agenda">${agendaHorario(items,true)}</div><button class="btn primary" data-cupos-usar="${n}">${esc(tx('usar_opcion'))}</button></article>`;
  }
  async function buscar(boton=$('[data-cupos-buscar]')){
    if(boton)boton.disabled=true;
    try{
      CUPOS.omitirLlenos();const previo=GT.n;GT.n='0';
      let g;try{g=generate([...new Set(selected().map(c=>c[8]))],true)}finally{GT.n=previo}
      const materias=new Set(selected().map(c=>c[8]));
      opciones=(g.top||[]).filter(r=>[...materias].every(k=>r.cs.some(c=>c[8]===k))&&r.cs.every(c=>CUPOS.fila(c)?.disponibles!==0)).slice(0,3);
      versionOpciones=version();
      $('#cupos-opciones').innerHTML=opciones.length?opciones.map((r,i)=>mini(r.cs,i)).join(''):`<p role="status">${esc(tx('sin_opciones'))}</p>`;
    }catch(e){console.error('SATE Cupos: búsqueda fallida',{periodo:S.per,carrera:S.car,error:e.message,pila:e.stack});$('#cupos-opciones').textContent=tx('error_busqueda')}
    finally{if(boton)boton.disabled=false}
  }
  function cambiar(c,anterior){
    if(!c||!anterior||!plan().sel.includes(keyOf(anterior))||!(CUPOS.fila(c)?.disponibles>0))return;
    const a=(c[8]===anterior[8]?alternativas(anterior):otras(anterior)).find(a=>keyOf(a.c)===keyOf(c));if(!a)return;
    const accion=()=>{
      // El modal puede seguir abierto mientras llega otra consulta de cupos o cambia el horario.
      const vigente=(c[8]===anterior[8]?alternativas(anterior):otras(anterior)).find(a=>keyOf(a.c)===keyOf(c));
      if(!plan().sel.includes(keyOf(anterior))||!vigente)return;
      const antes=structuredClone(store.get('t.'+S.car,{}));
      aplicar(selected().map(x=>keyOf(x)===keyOf(anterior)?c:x));
      if(c[8]!==anterior[8]){
        conPlan(()=>{const t=tr();if(!t.oblig.includes(anterior[8]))t.want=t.want.filter(k=>k!==anterior[8]);if(!t.want.includes(c[8]))t.want.push(c[8]);saveT()},0);
        deshacer.mapa={antes,despues:structuredClone(store.get('t.'+S.car,{}))};renderTray();
      }
      console.info('SATE Cupos: reemplazo',{periodo:S.per,carrera:S.car,version:ws().plan,anterior:keyOf(anterior),nuevo:keyOf(c),choques:vigente.choques.map(x=>x.own?'actividad':keyOf(x))});
      renderOffer();renderPlans();renderCal();$('#cupos-deshacer').focus();
    };
    if(a.choques.length){const contenido=document.createElement('div'),p=document.createElement('p'),si=document.createElement('button');p.textContent=tx('choque_con',{nombre:a.choques.map(x=>x.own?x.n:name(x)+' '+x[3]).join(', ')});si.className='btn';si.textContent=tx('cambiar');si.onclick=()=>{SateUI.cerrarModal();accion()};contenido.append(p,si);SateUI.modal(tx('con_choque'),contenido)}else accion();
  }
  document.addEventListener('toggle',e=>{const k=e.target.dataset?.cuposDetalle;if(k&&e.target.isConnected){if(e.target.open)abiertos.add(k);else abiertos.delete(k)}},true);
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-cupos-cambiar],[data-cupos-usar],[data-cupos-deshacer],[data-cupos-buscar],[data-cupos-riesgos]');if(!b)return;
    if(b.hasAttribute('data-cupos-deshacer')){restaurar();return}
    if(b.hasAttribute('data-cupos-buscar')){buscar(b);return}
    if(b.hasAttribute('data-cupos-riesgos')){for(const c of selected().filter(riesgo)){const d=document.getElementById(idSugerencias(c));if(d)d.open=true}const d=document.querySelector('.cupos-sugerencias');d?.scrollIntoView({block:'start',behavior:'smooth'});d?.querySelector('summary').focus();return}
    if(b.dataset.cuposUsar!==undefined){const r=opciones[+b.dataset.cuposUsar];if(versionOpciones===version()&&r&&r.cs.every(c=>CUPOS.fila(c)?.disponibles!==0))aplicar(r.cs);return}
    cambiar(byKey(b.dataset.cuposCambiar),byKey(b.dataset.cuposQuitar));
  });
  async function montar(){
    if(revision){
      ALUMNO=null;for(const k in T)delete T[k];S.per='actual';S.cview=null;S.weekend=false;
      const claves=Object.keys(cur()).filter(k=>!isElec(k)&&!(prereqs()[k]||[]).length).slice(0,7),base=DATA.asig.length,pf=DATA.prof.length;
      DATA.prof.push('Docente de ejemplo');
      const oferta=[];
      claves.forEach((k,i)=>{DATA.asig.push('Materia ficticia '+(i+1));for(let j=0;j<3;j++)oferta.push([S.car,'M',1,'F'+(i+1)+(j+1),base+i,[pf],[[j===2?(i+1)%5:i,540+j*90,630+j*90]],4,k])});
      // La primera materia solo tiene alternativas que chocan con la segunda.
      oferta[1][6]=[[1,540,630]];oferta[2][6]=[[1,540,630]];
      for(const c of oferta.slice(15))c[6]=[[0,540,630]];
      DATA.periodos.actual=oferta;actualizarOferta();W.actual={plan:'A',plans:{A:{sel:oferta.filter((c,i)=>i<15&&i%3===0).map(keyOf),own:[]}},marks:{}};
      GT.n='0';GT.a='';GT.b='';GT.breaks=[];GT.days='';S.gavoid=[];S.gpref=[];S.gt='*';
      CUPOS.recibir({tipo:'ipnt.cupos.datos',v:1,unidad:UNIDAD,carrera:DATA.opciones_plan?.[S.car]?.carrera||S.car,plan:DATA.opciones_plan?.[S.car]?.plan||'',hora:new Date().toISOString(),filas:oferta.map((c,i)=>({grupo:c[3],materia:c[8],nivel:'1',cupo:30,inscritos:i%3===0?(i<6?30:i===6?28:20):20,disponibles:i%3===0?(i<6?0:i===6?2:10):10}))});
    }
    raiz=document.createElement('section');raiz.id='cupos-vista';
    raiz.innerHTML=`<div class="colhead"><h2>${esc(tx('resumen_titulo'))}</h2><a class="btn" id="cupos-completo">${esc(tx('abrir_completo'))}</a></div><p id="cupos-resumen" role="status" aria-live="polite"></p><div id="cupos-resumen-horario"></div><details class="box2"><summary>${esc(tx('ver_horario'))}</summary><div id="cupos-calendario"></div></details><details class="box2"><summary>${esc(tx('oferta_completa'))}</summary><div id="cupos-controles"></div><div id="cupos-tabla" class="cupos-tabla"></div></details><details class="box2"><summary>${esc(tx('avisos_mas'))}</summary><div id="cupos-avisos-controles"></div><p id="cupos-dejar"></p><button class="btn" id="cupos-permitir" hidden></button><p id="cupos-aviso" role="status"></p><p id="cupos-nube" role="status"></p></details>`;
    $('#v-hor').after(raiz);
    document.querySelector('.brand').appendChild($('#cupos-resumen'));
    const url=new URL(location.href);url.searchParams.delete('vista');url.hash='#/'+UNIDAD+'/horarios';$('#cupos-completo').href=url.href;
    for(const selector of ['.calwrap','#agenda'])$('#cupos-calendario').appendChild($(selector));
    $('#cupos-resumen-horario').appendChild($('.summary'));
    window.CUPOS_CONFIG={unidades:{[UNIDAD]:{saes:CAPACIDADES.saes,prefijo:HU}},textos:SATE_CONFIG.textos};
    renderCal();
  }
  return {montar,pintar,alternativas,otras,sugerencias,riesgo,avisoCarga,cambiar,aplicar,restaurar,buscar,revision,clasificarReemplazo};
})();
