/* Presentación de las reglas del núcleo. No detecta causales nuevas de dictamen. */
(function () {
  const tx=(k,v)=>SATE.texto('sate.situacion.'+k,v);
  const el=(tag,texto,clase)=>{const n=document.createElement(tag);if(texto!=null)n.textContent=texto;if(clase)n.className=clase;return n};
  const fecha=x=>new Date(x+'T00:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'long'});
  function tarjetas(d,R) {
    const A=ALUMNO, rd=d.rd, lista=[];
    const add=(id,estado,titulo,cuerpo,detalle,trámite)=>lista.push({id,estado,titulo,cuerpo,detalle,tramite:trámite});
    if(d.nDes) {
      const tipos=Object.values(rd?.por||{}), dict=tipos.some(x=>x!=='oficio');
      add('desfase',rd?.ok?'aviso':'error',tx(rd?.ok?'recursar':rd?.n?'desfase_dictamen':'revisar_desfase'),
        rd?.ok?tx('recursar_cuerpo',{fecha:fecha(rd.R.fecha),cr:fmtCr(rd.tope)}):tx('desfase_cuerpo',{n:d.nDes}),
        rd?.n&&!rd.ok?tx(dict?'dictamen_detalle':'limite_detalle',{n:rd.R.maxDesfasadas}):tx('desfase_detalle'),rd?.n&&!rd.ok?'dictamen':'reinscripcion');
    } else add('desfase',d.fis.some(f=>f.estado==='riesgo')?'aviso':'ok',tx(d.fis.some(f=>f.estado==='riesgo')?'plazo_titulo':'desfase'),
      tx(d.fis.some(f=>f.estado==='riesgo')?'plazo_proximo':A.reprobadas_periodo==null?'sin_confirmar':'sin_desfase'),tx('desfase_detalle'),'reinscripcion');
    if(d.adeudos.length) add('adeudos','aviso',tx('adeudos'),tx('adeudos_cuerpo',{n:d.adeudos.length,cr:fmtCr(d.ret)}),tx('adeudos_detalle'),'ets');
    const ets=R?.items.find(a=>a.para==='adeudo'&&!a.pasada);
    if(d.adeudos.length) add('ets',ets?'aviso':'info',tx('ets'),ets?tx('ets_fecha',{actividad:ets.titulo,fecha:fecha(ets.hasta||ets.desde)}):tx('ets_sin_aviso'),tx('ets_detalle'),'ets');
    add('cita',d.nDes?'aviso':'info',tx('reinscripcion'),
      A.cita?.inicio?tx(citaPasada(A)?'cita_vencida':'cita',{fecha:A.cita.inicio}):tx('sin_cita'),tx('cita_detalle'),'reinscripcion');
    add('carga','info',tx('carga'),d.aut==null?tx('carga_sin_dato'):tx('carga_cuerpo',{cr:fmtCr(d.aut),ret:fmtCr(d.ret)}),tx('carga_detalle'),'reinscripcion');
    const actualizar=avisoActualizar(A);
    if(actualizar)add('actualizacion','aviso',tx('actualizar'),actualizar,tx('actualizar_detalle'),'reinscripcion');
    // Prioridad explícita y estable: la primera tarjeta en el DOM es la más grave, también a 375 px.
    const prioridad={error:0,aviso:1,info:2,ok:3};
    return lista.sort((a,b)=>prioridad[a.estado]-prioridad[b.estado]);
  }
  const tt=(k,v)=>SATE.texto('sate.trayectoria.'+k,v);
  const config=()=>SATE_CONFIG.unidades[SATE_UNIDAD];
  function abrirTramite(tarjeta) {
    if(tarjeta.id==='actualizacion'){SAES.open();return}
    if(config().tramites.includes(tarjeta.tramite))SATE.ir('tramites/'+tarjeta.tramite);
    else SateUI.modal(tarjeta.titulo,tarjeta.cuerpo+' '+tarjeta.detalle,{pequeno:true});
  }
  function detalle(tarjeta) {
    SateUI.modal(tarjeta.titulo,tarjeta.cuerpo,{acciones:config().tramites.includes(tarjeta.tramite)?[{texto:tx('ventanilla'),primaria:true,onclick:()=>abrirTramite(tarjeta)}]:[],pequeno:true});
  }
  function datos() {
    const d=situacionDatos();renderCalendario(d.rd,d.nDes);
    return {d,lista:tarjetas(d,calItems())};
  }
  function avisos() {
    const box=document.getElementById('sate-avisos-globales');box.replaceChildren();
    box.hidden=!isPersonal()||SATE.actual?.pestana==='trayectoria';if(box.hidden)return;
    const {d,lista}=datos();
    const importantes=lista.filter(x=>x.id==='adeudos'||x.id==='desfase'&&(d.nDes||x.estado==='aviso')||x.id==='cita'&&ALUMNO.cita?.inicio);
    box.appendChild(SateUI.chips(importantes.map(x=>({id:x.id,estado:x.estado,texto:x.titulo+' ⓘ',abre:()=>detalle(x)}))));
  }
  function mostrar() {
    const box=document.getElementById('sate-presente');box.replaceChildren();
    box.hidden=!isPersonal();if(box.hidden)return;
    const {d,lista}=datos();
    const avance=d.D.obt!=null&&d.D.total>0?Math.round(d.D.obt/d.D.total*100)+' %':tt('sin_avance');
    const estado=d.nDes?tx('desfase_cuerpo',{n:d.nDes}):tx(ALUMNO.reprobadas_periodo==null?'sin_confirmar':'sin_desfase');
    const resumen=el('p',tt('resumen',{periodo:perName(d.D.actual??d.meta),avance,desfase:String(estado).replace(/[.\s]+$/,'')}),'trayectoria-resumen');
    const recorte=SateUI.recorteCalendario(SATE.calendario.recorte('trayectoria'));
    if(recorte)resumen.appendChild(recorte);box.appendChild(resumen);
    // El presente muestra siempre el SAES real, aunque esté activo el escenario N+1.
    const mini=conPlan(()=>conSim(false,()=>minimapaCurricular()),0);
    if(mini){
      const vista=el('div',null,'trayectoria-minimapa');
      const boton=el('button');boton.type='button';boton.setAttribute('aria-label',SATE.texto('sate.minimapa.abrir'));
      boton.innerHTML=mini.svg;boton.onclick=()=>SATE.ir('mapa');vista.appendChild(boton);
      const leyenda=el('div',null,'mm-leg');leyenda.innerHTML=mini.leyenda;vista.appendChild(leyenda);box.appendChild(vista);
    }
    const principal=lista[0];
    box.appendChild(SateUI.aviso({estado:principal.estado,titulo:tt('siguiente_paso'),cuerpo:principal.titulo+': '+principal.cuerpo,accion:{texto:tx(principal.id==='actualizacion'?'usar_lector':config().tramites.includes(principal.tramite)?'que_hacer':'ver_detalles'),onclick:()=>abrirTramite(principal)}}));
    box.appendChild(el('h3',tx('pendientes')));
    box.appendChild(SateUI.chips(lista.filter(x=>x!==principal&&x.estado!=='ok').map(x=>({id:x.id,estado:x.estado,texto:x.titulo+' ⓘ',abre:()=>detalle(x)}))));
    const planear=el('button',SATE.texto('sate.planeacion.titulo'),'sate-enlace');planear.type='button';planear.onclick=()=>SATE.ir('mapa');box.appendChild(planear);
  }
  function tramite(box,id) {
    if(!isPersonal())return;
    const {lista}=datos();
    for(const x of lista.filter(x=>x.tramite===id)){
      const section=el('section',null,'trayectoria-tramite');
      section.appendChild(el('h3',x.titulo));section.appendChild(el('p',x.cuerpo));section.appendChild(el('p',x.detalle));
      box.appendChild(section);
    }
    if(id==='ets'||id==='dictamen'||id==='reinscripcion'){
      const d=situacionDatos();
      for(const k of d.adeudos){
        const f=d.fis.find(f=>f.k===k),tipo=d.rd?.por[k];
        const section=el('section');section.appendChild(el('h3',pretty(cur()[k][0])));
        section.appendChild(el('p',tx(f?.curso?'opcion_recurse':tipo==='agotada'?'opcion_agotada':tipo==='dictamen'?'opcion_dictamen':f?.estado==='desfasada'?'opcion_desfasada':f?.limite!=null?'opcion_plazo':'opcion_actualizar',{periodo:perName(f?.limite)})));
        box.appendChild(section);
      }
    }
  }
  // Ventanilla consume la misma decisión presentada en Mi trayectoria.
  function aplicaTramite(id){
    if(!isPersonal())return null;
    const {lista}=datos(),aviso=lista.find(x=>x.tramite===id);
    return aviso?{aplica:true,motivo:aviso.cuerpo}:null;
  }
  SATE.presente={mostrar,avisos,tramite,aplicaTramite};
})();
