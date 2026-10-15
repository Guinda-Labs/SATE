/* El rescate trabaja sobre el mismo horario, oferta y motor que la vista completa. */
window.SateCuposVista=(()=>{
  const tx=(k,v)=>SATE.texto('sate.cupos.'+k,v);
  let raiz,deshacer=null,opciones=[],versionOpciones='';
  const version=()=>JSON.stringify([S.per,S.car,plan().sel,plan().own,CUPOS.datos?.hora]);
  const revision=DEMO&&new URLSearchParams(location.search).get('revisionCupos')==='1'&&/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const horario=c=>c[6].length?pattern(c).join(' · '):tx('sin_horas');
  function alternativas(c){
    const resto=selected().filter(x=>keyOf(x)!==keyOf(c));
    return classes().filter(x=>x[0]===S.car&&x[8]===c[8]&&keyOf(x)!==keyOf(c)&&CUPOS.fila(x)?.disponibles>0)
      .map(x=>({c:x,choques:[...resto,...ownAsClasses()].filter(r=>overlaps(r,x)),incierto:!x[6].length||resto.some(r=>!r[6].length)}))
      .sort((a,b)=>Number(!!a.choques.length||a.incierto)-Number(!!b.choques.length||b.incierto)||CUPOS.fila(b.c).disponibles-CUPOS.fila(a.c).disponibles||a.c[3].localeCompare(b.c[3]));
  }
  function aplicar(cs){
    deshacer={periodo:S.per,version:ws().plan,antes:plan().sel.slice(),despues:cs.map(keyOf)};
    plan().sel=deshacer.despues.slice();save();
    console.info('SATE Cupos: horario actualizado',{periodo:S.per,version:ws().plan,grupos:plan().sel.length});
    renderCal();$('#cupos-cambio').textContent=tx('cambio_listo');$('#cupos-deshacer').hidden=false;
  }
  function restaurar(){
    if(!deshacer)return;
    const d=deshacer,p=W[d.periodo]?.plans[d.version];
    // Una edición posterior de otra pestaña debe conservarse.
    if(!p||JSON.stringify(p.sel)!==JSON.stringify(d.despues)){$('#cupos-cambio').textContent=tx('deshacer_conflicto');return}
    p.sel=d.antes;store.set('w.'+d.periodo,W[d.periodo]);deshacer=null;
    $('#cupos-deshacer').hidden=true;renderCal();$('#cupos-cambio').textContent=tx('cambio_deshecho');
  }
  function pintar(){
    if(!raiz)return;
    if(opciones.length&&versionOpciones!==version()){opciones=[];$('#cupos-opciones').innerHTML=''}
    const riesgo=selected().filter(c=>{const f=CUPOS.fila(c);return f&&f.disponibles<=3});
    $('#cupos-riesgos').innerHTML=riesgo.length?riesgo.map(c=>{
      const alts=alternativas(c);
      return `<article class="box2"><h3>${esc(name(c))} · ${esc(c[3])} ${CUPOS.insignia(c)}</h3>`+
        (alts.length?alts.map(a=>`<div class="cupos-alternativa"><div><b>${esc(a.c[3])}</b> · ${esc(profs(a.c))}<p>${esc(horario(a.c))}</p><p>${CUPOS.insignia(a.c)} · ${esc(a.choques.length?tx('choque_con',{nombre:a.choques.map(x=>x.own?x.n:name(x)+' '+x[3]).join(', ')}):tx(a.incierto?'sin_horas':'sin_choque'))}</p></div><button class="btn" data-cupos-cambiar="${esc(keyOf(a.c))}" data-cupos-quitar="${esc(keyOf(c))}">${esc(tx('cambiar_grupo'))}</button></div>`).join(''):`<p class="muted">${esc(tx('sin_alternativas'))}</p>`)+`</article>`;
    }).join(''):`<p class="muted">${esc(tx(selected().length?'sin_riesgo':'horario_vacio_vista'))}</p>`;
    $('#cupos-buscar').hidden=!riesgo.some(c=>!alternativas(c).some(a=>!a.choques.length&&!a.incierto));
  }
  function mini(cs,n){
    const cont=document.createElement('div');cont.className='cal cupos-mini';
    const items=SateUI.cuadriculaHorario(cs,{S,slots,START,BLOCK,SLOT,SLOTPX:18,$:()=>cont,DAYS,hm,esc,txH,hue,keyOf,name,profs,roomAt,soloLectura:true,insignia:CUPOS.insignia});
    return `<article class="box2"><h3>${esc(tx('opcion_vista',{n:n+1}))}</h3><div class="calwrap">${cont.outerHTML}</div><div class="agenda cupos-mini-agenda">${agendaHorario(items,true)}</div><button class="btn primary" data-cupos-usar="${n}">${esc(tx('usar_opcion'))}</button></article>`;
  }
  async function buscar(){
    const boton=$('#cupos-buscar');boton.disabled=true;
    try{
      CUPOS.omitirLlenos();const previo=GT.n;GT.n='0';
      let g;try{g=generate([...new Set(selected().map(c=>c[8]))],true)}finally{GT.n=previo}
      const materias=new Set(selected().map(c=>c[8]));
      opciones=(g.top||[]).filter(r=>[...materias].every(k=>r.cs.some(c=>c[8]===k))&&r.cs.every(c=>CUPOS.fila(c)?.disponibles!==0)).slice(0,3);
      versionOpciones=version();
      $('#cupos-opciones').innerHTML=opciones.length?opciones.map((r,i)=>mini(r.cs,i)).join(''):`<p role="status">${esc(tx('sin_opciones'))}</p>`;
    }catch(e){console.error('SATE Cupos: búsqueda fallida',{periodo:S.per,carrera:S.car,error:e.message,pila:e.stack});$('#cupos-opciones').textContent=tx('error_busqueda')}
    finally{boton.disabled=false}
  }
  async function montar(){
    if(revision){
      ALUMNO=null;for(const k in T)delete T[k];S.per='actual';S.cview=null;S.weekend=false;
      const claves=Object.keys(cur()).filter(k=>!isElec(k)).slice(0,5),base=DATA.asig.length,pf=DATA.prof.length;
      DATA.prof.push('Docente de ejemplo');
      const oferta=[];
      claves.forEach((k,i)=>{DATA.asig.push('Materia ficticia '+(i+1));for(let j=0;j<3;j++)oferta.push([S.car,'M',1,'F'+(i+1)+(j+1),base+i,[pf],[[j===2?(i+1)%5:i,540+j*90,630+j*90]],4,k])});
      // La primera materia solo tiene alternativas que chocan con la segunda.
      oferta[1][6]=[[1,540,630]];oferta[2][6]=[[1,540,630]];
      DATA.periodos.actual=oferta;actualizarOferta();W.actual={plan:'A',plans:{A:{sel:oferta.filter((c,i)=>i%3===0).map(keyOf),own:[]}},marks:{}};
      GT.n='0';GT.a='';GT.b='';GT.breaks=[];GT.days='';S.gavoid=[];S.gpref=[];S.gt='*';
      CUPOS.recibir({tipo:'ipnt.cupos.datos',v:1,unidad:UNIDAD,carrera:DATA.opciones_plan?.[S.car]?.carrera||S.car,plan:DATA.opciones_plan?.[S.car]?.plan||'',hora:new Date().toISOString(),filas:oferta.map((c,i)=>({grupo:c[3],materia:c[8],nivel:'1',cupo:30,inscritos:i%3===0?(i<6?30:i===6?28:20):20,disponibles:i%3===0?(i<6?0:i===6?2:10):10}))});
    }
    raiz=document.createElement('section');raiz.id='cupos-vista';
    raiz.innerHTML=`<div class="colhead"><h2>${esc(tx('tu_horario_cupos'))}</h2><a class="btn" id="cupos-completo">${esc(tx('abrir_completo'))}</a></div><p id="cupos-resumen" role="status" aria-live="polite"></p><div id="cupos-calendario"></div><p class="cupos-leyenda">${['lleno','pocos','con_lugar','sin_dato'].map((k,i)=>`<span class="cupos-insignia cupos-${['lleno','pocos','lugar','sin-dato'][i]}">${esc(tx(k))}</span>`).join(' ')}</p><h2>${esc(tx('en_riesgo'))}</h2><p id="cupos-cambio" role="status" aria-live="polite"></p><button class="btn" id="cupos-deshacer" hidden>${esc(tx('deshacer'))}</button><div id="cupos-riesgos"></div><button class="btn primary" id="cupos-buscar">${esc(tx('buscar_sin_llenos'))}</button><div id="cupos-opciones"></div><details class="box2"><summary>${esc(tx('oferta_completa'))}</summary><div id="cupos-controles"></div><div id="cupos-tabla" class="cupos-tabla"></div></details><details class="box2"><summary>${esc(tx('avisos_mas'))}</summary><div id="cupos-avisos-controles"></div><p id="cupos-dejar"></p><button class="btn" id="cupos-permitir" hidden></button><p id="cupos-aviso" role="status"></p><p id="cupos-nube" role="status"></p></details>`;
    $('#v-hor').after(raiz);
    document.querySelector('.brand').appendChild($('#cupos-resumen'));
    const url=new URL(location.href);url.searchParams.delete('vista');url.hash='#/'+UNIDAD+'/horarios';$('#cupos-completo').href=url.href;
    for(const selector of ['.calwrap','#agenda'])$('#cupos-calendario').appendChild($(selector));
    $('#cupos-buscar').onclick=buscar;$('#cupos-deshacer').onclick=restaurar;
    raiz.onclick=e=>{
      const b=e.target.closest('[data-cupos-cambiar],[data-cupos-usar]');if(!b)return;
      if(b.dataset.cuposUsar!==undefined){const r=opciones[+b.dataset.cuposUsar];if(r&&r.cs.every(c=>CUPOS.fila(c)?.disponibles!==0))aplicar(r.cs);return}
      const c=byKey(b.dataset.cuposCambiar),anterior=byKey(b.dataset.cuposQuitar);
      if(!c||!anterior||!plan().sel.includes(keyOf(anterior))||c[8]!==anterior[8]||!(CUPOS.fila(c)?.disponibles>0))return;
      const accion=()=>aplicar(selected().map(x=>keyOf(x)===keyOf(anterior)?c:x));
      const a=alternativas(anterior).find(a=>keyOf(a.c)===keyOf(c));
      if(a?.choques.length){const contenido=document.createElement('div'),p=document.createElement('p'),si=document.createElement('button');p.textContent=tx('choque_con',{nombre:a.choques.map(x=>x.own?x.n:name(x)+' '+x[3]).join(', ')});si.className='btn';si.textContent=tx('cambiar_grupo');si.onclick=()=>{SateUI.cerrarModal();accion()};contenido.append(p,si);SateUI.modal(tx('con_choque'),contenido)}else accion();
    };
    window.CUPOS_CONFIG={unidades:{[UNIDAD]:{saes:CAPACIDADES.saes,prefijo:HU}},textos:SATE_CONFIG.textos};
    renderCal();
  }
  return {montar,pintar,alternativas,aplicar,restaurar,buscar,revision};
})();
