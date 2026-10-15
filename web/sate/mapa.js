function renderMap(){return conSim(usaSim('mapa'),()=>conPlan(renderMap0))}
/* Cadena de requisitos y dependientes de la materia bajo el cursor (o de la fila elegida en «requisitos»).
   Devuelve null sin resaltado, o un Set con .pre (antes) y .post (después). Pura: solo usa sus argumentos. */
function calcHot(mapHover,reqHover,pre){
  if(mapHover&&reqHover){
    const hot=new Set([mapHover,...reqHover]);hot.pre=new Set([mapHover]);hot.post=new Set(reqHover);return hot;
  }
  if(!mapHover)return null;
  const hot=new Set([mapHover]);
  const post={};Object.entries(pre).forEach(([b,as])=>as.forEach(a=>(post[a]=post[a]||[]).push(b)));
  const walk=(k,g)=>{(g[k]||[]).forEach(x=>{if(!hot.has(x)){hot.add(x);walk(x,g)}})};
  walk(mapHover,pre);hot.pre=new Set([...hot].filter(x=>x!==mapHover));   // requisitos (antes)
  const antes=new Set(hot);walk(mapHover,post);hot.post=new Set([...hot].filter(x=>!antes.has(x)));   // lo que desbloquea (después)
  return hot;
}
// estado de resaltado de una flecha a->b: clases y marcador de punta
function resalteArista(hot,a,b,mapHover){
  if(!hot)return {cls:'',marker:'ah'};
  if(!(hot.has(a)&&hot.has(b)))return {cls:' dim',marker:'ah'};
  const lado=b===mapHover||hot.pre.has(b)?'pre':'post';
  return {cls:' hot '+lado,marker:'ah'+lado};
}
function renderMap0(){
  MAPIDX=null;
  $('#mapcut').hidden=true;   // se vuelve a mostrar si aplica (mapa con trayectoria y datos del SAES)
  const mv=mview();document.querySelectorAll('[data-mview]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mview===mv)));
  $('#zoomseg [data-zoom="0"]').textContent=SATE.texto('sate.planeacion.'+(MQ_PHONE.matches?'zoom_completo_corto':'zoom_completo'));
  $('#mapwrap').hidden=mv==='lista';$('#zoomseg').hidden=mv==='lista';$('#tlist').hidden=mv!=='lista';
  const L=MAP().layout, wrap=$('#mapwrap'), el=$('#map');
  MARK=conPlan(()=>isPersonal()?{avail:new Set(Object.keys(cur()).filter(k=>cur()[k][3]==='O'&&available(k)&&!statusOf(k).includes('fail'))),sug:new Set(SHOWSUG?suggestions().list:[])}:{avail:new Set(),sug:new Set()},S.planPaso);
  $('#sug-tgl').hidden=!isPersonal();$('#sug-on').checked=SHOWSUG;
  const want=planElegidas(), off=offeredClaves(), pre=prereqs();
  const done=new Set(tr().done), req=new Set([...ancestors(want)].filter(k=>!want.has(k)&&!done.has(k)));
  // cadena de requisitos y dependientes de la materia bajo el cursor
  const hot=calcHot(S.mapHover,S.reqHover,pre);
  renderInsp();
  if(mv==='lista')renderList();
  if(!L){ // carrera sin trayectoria propuesta: cuadrícula por nivel del SAES
    const by={};Object.entries(cur()).forEach(([k,v])=>(by[v[2]]=by[v[2]]||[]).push(k));
    const cols=Math.max(...Object.values(by).map(a=>a.length)), bw=118, bh=48, gx=10, gy=18, lw=40;
    const w=lw+cols*(bw+gx)+10, h=Object.keys(by).length*(bh+gy)+gy;
    const sc=ZOOM??Math.min(1.2,Math.max(.6,(wrap.clientWidth-4)/w));MAPSC=sc;
    let html=`<svg width="${w*sc}" height="${h*sc}" aria-hidden="true">`;
    Object.keys(by).sort((a,b)=>a-b).forEach((n,i)=>{const y=gy/2+i*(bh+gy);html+=`<rect class="band" x="0" y="${y*sc}" width="${w*sc}" height="${(bh+gy/2)*sc}"/><text class="rowlbl" x="${12*sc}" y="${(y+bh/2+5)*sc}" font-size="${16*sc}">${n}</text>`});
    html+='</svg>';
    Object.keys(by).sort((a,b)=>a-b).forEach((n,i)=>by[n].forEach((k,j)=>{
      const x=lw+j*(bw+gx), y=gy/2+i*(bh+gy)+gy/4;
      html+=boxHtml(k,x,y,bw,bh,sc,want,off,hot,+n,req);
    }));
    el.style.width=w*sc+'px';el.style.height=h*sc+'px';el.innerHTML=html;$('#areas').hidden=true;
    $('#mapnote').innerHTML='<li>'+esc(SATE.texto('sate.planeacion.sin_trayectoria'))+'</li>';
    return;
  }
  let sc=ZOOM??Math.min(1.1,Math.max(.2,(wrap.clientWidth-2)/L.w));MAPSC=sc;
  const FILL=slotFill(L,want);
  /* Con datos del SAES, lo que sigue va a la vista: los semestres ya completos al inicio del mapa se dibujan
     compactos (menos alto, mismas materias y flechas) y el primero con algo pendiente queda a tamaño normal.
     Nada se oculta; la vista «Mapa completo» lo desactiva (preferencia mapVista). */
  const bands=rowBands(L);let nPend=0;
  if(isPersonal()){
    const pend=bands.findIndex(([n,y,a,b])=>L.boxes.some(([bx,by,bw,bh,k,slot],i)=>{const cy=by+bh/2;if(cy<a||cy>=b)return false;
      if(k)return !done.has(k)&&!isElec(k);const f=FILL.get(i);return /^optativa/i.test(slot)&&!(f?.k&&done.has(f.k))}));
    if(pend>0)nPend=pend;
  }
  /* Enfoque: el bloque de lo que sigue (cajas pendientes, en curso o espacios de optativa por cubrir desde la primera
     fila pendiente). Sin zoom del alumno, el mapa se acerca para que ese bloque llene el ancho y se desplaza hasta él. */
  let FOCO=null;const vista=mapVista();
  // «Recomendaciones»: lo que puedes cursar el siguiente periodo (sugeridas, disponibles y por recursar);
  // «Pendientes»: todo lo que falta. Si no hay recomendaciones, se usa «Pendientes».
  const recom=new Set([...MARK.sug,...MARK.avail,...(isPersonal()?tr().fail:[])]);
  if(isPersonal()&&nPend&&vista!=='todo'){
    const y0=bands[nPend][2];let fx0=Infinity,fx1=-Infinity;
    const enFoco=(k,slot,f)=>vista==='sigue'&&recom.size?recom.has(k):k?!done.has(k)&&!isElec(k):/^optativa/i.test(slot)&&!(f?.k&&done.has(f.k));
    L.boxes.forEach(([bx,by,bw,bh,k,slot],i)=>{if(by+bh/2<y0)return;const f=FILL.get(i);
      if(enFoco(k||f?.k,slot,f)){fx0=Math.min(fx0,bx);fx1=Math.max(fx1,bx+bw)}});
    if(fx1>fx0){FOCO={x0:Math.max(0,fx0-24),x1:Math.min(L.w,fx1+24),y0};
      if(ZOOM==null){sc=Math.min(1.1,Math.max(.2,(wrap.clientWidth-2)/(FOCO.x1-FOCO.x0)));MAPSC=sc}}
  }
  const full=vista==='todo', KC=nPend&&!full?0:1;   // filas completadas: plegadas (se ven en el minimapa)
  const mc=$('#mapcut');mc.hidden=!nPend;
  if(nPend){
    const fila=porNiveles()?['Nivel','Niveles']:['Semestre','Semestres'];
    $('#mapcut-sim').innerHTML=simTag('mapa');
    $('#mapcut-txt').textContent=(nPend>1?`${fila[1]} ${bands[0][0]} a ${bands[nPend-1][0]} acreditados`:`${fila[0]} ${bands[0][0]} acreditado`)+'. '+
      (full?'Se muestra el mapa completo.':vista==='sigue'&&recom.size?'Se muestran primero las materias que puedes cursar el siguiente periodo.':'Se muestran primero las materias que te faltan.');
  }
  if(isPersonal()){
    const mini=minimapaCurricular(L,FILL,{nPend,FOCO});
    $('#minimap').innerHTML=mini.svg;$('#mapcut').hidden=false;
    $('#mm-leg').innerHTML=mini.leyenda;
    if(!nPend){$('#mapcut-txt').textContent='Aún no hay '+(porNiveles()?'niveles':'semestres')+' completos; se muestra el mapa completo.';$('#mapvista').hidden=true}else $('#mapvista').hidden=false;
    document.querySelectorAll('#mapvista [data-vista]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.vista===vista)));
  }
  // y del PDF -> y dibujada: lineal por tramos (las bandas completadas se encogen)
  const kOf=i=>i<nPend?KC:1, tops=[];let acc=bands.length?bands[0][2]:0;
  bands.forEach(([n,y,a,b],i)=>{tops.push(acc);acc+=(b-a)*kOf(i)});
  const bandOf=y=>{for(let i=0;i<bands.length;i++)if(y<bands[i][3])return i;return bands.length-1};
  const Y=y=>{if(!bands.length||y<=bands[0][2])return y;const i=bandOf(y);const [,,a,b]=bands[i];return y>=b&&i===bands.length-1?tops[i]+(b-a)*kOf(i)+(y-b):tops[i]+(y-a)*kOf(i)};
  const H=Y(L.h);
  let svg=`<svg width="${L.w*sc}" height="${H*sc}" viewBox="0 0 ${L.w} ${H}" aria-hidden="true"><defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--edge)"/></marker><marker id="ahh" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker><marker id="ahpre" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--rel-pre)"/></marker><marker id="ahpost" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--rel-post)"/></marker></defs>`;
  bands.forEach(([n,y,a,b],i)=>{const k=kOf(i);if(!k)return;if(i%2===0)svg+=`<rect class="band" x="0" y="${Y(a)}" width="${L.w}" height="${(b-a)*k}"/>`;svg+=`<text class="rowlbl" x="12" y="${Y(y)+6*k}" font-size="${18*Math.max(k,.7)}">${n}</text>`});
  /* Flechas lejanas (saltan filas o cruzan varias columnas) no se dibujan: su requisito se cursa muchas materias antes.
     Aparecen completas al resaltar una de sus materias, junto con toda la cadena. */
  L.edges.forEach(([s,d,p,larga,ls,ld])=>{
    const bs=L.boxes[s];if(!kOf(bandOf(bs[1]+bs[3]/2)))return;   // sale de un semestre plegado: no se dibuja
    const a=L.boxes[s][4], b=L.boxes[d][4], r=resalteArista(hot,a,b,S.mapHover);
    const pts=[];for(let i=0;i<p.length;i+=2)pts.push([p[i],Y(p[i+1])]);
    const pasada=isPersonal()&&done.has(b);
    // las flechas lejanas existen siempre pero solo se ven al resaltarlas (clase «lejana», sin redibujar al pasar el cursor)
    const cls=`edge${L.propuesto?' prop':''}${L.rutas&&larga?' lejana':''}${r.cls}${!hot&&pasada?' past':''}`, mk=`marker-end="url(#${r.marker})"`, dt=`data-a="${a}" data-b="${b}"${pasada?' data-past="1"':''}`;
    svg+=L.rutas?`<path class="${cls}" ${dt} d="${rutaRedonda(pts)}" ${mk}/>`:`<polyline class="${cls}" ${dt} points="${pts.map(q=>q.join(',')).join(' ')}" ${mk}/>`;
  });
  svg+='</svg>';
  let html=svg;
  // caja en fila compacta: misma posición relativa, menos alto y letra más chica
  const compacta=(h0,y0,h)=>{const k=kOf(bandOf(y0+h/2));if(k===1)return h0;if(!k)return '';return h0.replace(/font-size:([\d.]+)px/,(m,v)=>`font-size:${(+v*Math.max(k,.62)).toFixed(2)}px`).replace('class="box ','class="box compact ')};
  L.boxes.forEach(([x,y0,w,h0,k,slot,sem],i)=>{
    const f=FILL.get(i), y=Y(y0), h=h0*kOf(bandOf(y0+h0/2));
    if(!k&&f?.k){html+=compacta(boxHtml(f.k,x,y,w,h,sc,want,off,hot,sem,req).replace('class="box ','class="box optfill '),y0,h0);return}
    if(!kOf(bandOf(y0+h0/2)))return;   // fila plegada
    if(!k&&f?.sigue){html+=`<div class="box slot${hot?' dim':''}" style="left:${x*sc}px;top:${y*sc}px;width:${w*sc}px;height:${h*sc}px;font-size:${9*sc}px" title="${esc(slot)}: continúa tu línea con ${esc(cur()[f.sigue][0])}">${esc(slot)}<small class="slot-sig">sigue: ${esc(pretty(cur()[f.sigue][0]).replace(/\s*\(.*\)$/,''))}</small></div>`;return}
    if(k) html+=compacta(boxHtml(k,x,y,w,h,sc,want,off,hot,sem,req),y0,h0);
    else html+=compacta(`<div class="box slot${hot?' dim':''}" style="left:${x*sc}px;top:${y*sc}px;width:${w*sc}px;height:${h*sc}px;font-size:${9.5*sc}px" title="${esc(slot)}: ${/^electiva/i.test(slot)?SATE.texto('sate.electivas.acreditacion_breve'):'cualquiera de las ofertadas'}">${esc(slot)}</div>`,y0,h0);
  });
  el.style.width=L.w*sc+'px';el.style.height=H*sc+'px';el.innerHTML=html;
  if(FOCO&&ZOOM==null){const c=((FOCO.x0+FOCO.x1)/2)*sc-wrap.clientWidth/2;requestAnimationFrame(()=>{wrap.scrollLeft=Math.max(0,c)})}
  const ar=$('#areas');ar.hidden=!L.cols;ar.style.width=L.w*sc+'px';
  // columnas que agrupan áreas pequeñas («A · B»): un renglón por área y letra un poco menor
  ar.innerHTML=(L.cols||[]).map(([n,a,b],i)=>{const k=n.includes(' · ')?.82:1;return `<div style="left:${a*sc}px;width:${(b-a)*sc}px;font-size:${Math.max(8,Math.min(14,13*sc*1.4)*k)}px;white-space:pre-line;border-bottom:3px solid ${AREA_COLORES[i%AREA_COLORES.length]}" title="${esc(n)}">${esc(n.replaceAll(' · ','\n'))}</div>`}).join('');
  // La ayuda conserva las notas específicas del plan fuera del flujo del mapa.
  const tx=(k,v)=>SATE.texto('sate.planeacion.'+k,v), notas=[];
  if(L.nota)notas.push(...L.nota.split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚÑ¿])/));
  else if(L.propuesto)notas.push(tx('propuesta'));
  else notas.push(tx('flechas'),
    tx('sombreado'));
  notas.push(tx(tactil()?'resaltar_tactil':'resaltar_cursor'));
  if(porNiveles())notas.push(tx('niveles'));
  if(L.rutas&&L.edges.some(e=>e[3]))notas.push(tx('flechas_lejanas'));
  if(L.ocultas)notas.push(tx('flechas_ocultas',{n:L.ocultas}));
  $('#mapnote').innerHTML=notas.map(t=>`<li>${esc(t)}</li>`).join('');
}
function renderList(){
  if(mview()!=='lista')return;
  const c=cur(), off=offeredClaves(), sp=semOf(), me=isPersonal(), oblig=new Set(tr().oblig);
  const useSem=!porNiveles()&&Object.keys(c).some(k=>sp[k]), by={};
  Object.keys(c).forEach(k=>{const g=(useSem?sp[k]:null)||c[k][2];(by[g]=by[g]||[]).push(k)});
  const tag=k=>{const st=statusOf(k);
    if(st==='done')return['Acreditada','ok'];
    if(isElec(k))return['Por actividades',''];
    if(st==='curso')return['En curso',''];
    if(st==='late fail')return['Desfasada','bad'];
    if(st==='fail')return['Por recursar','warn'];
    if(st.includes('lock'))return['Requisitos pendientes',''];
    if(me&&MARK.sug.has(k))return['Sugerida','ok'];
    if(me&&MARK.avail.has(k))return['Puedes cursarla','ok'];
    return null};
  $('#tlist').innerHTML=Object.keys(by).sort((a,b)=>a-b).map(g=>`<section class="tl-sem"><h4>${useSem?'Semestre propuesto '+g:'Nivel '+g}</h4><div class="tl-rows">`+
    by[g].sort((a,b)=>c[a][2]-c[b][2]||a.localeCompare(b)).map(k=>{const t=tag(k), paso=planAsignado(k), w=paso===S.planPaso, done=statusOf(k)==='done', ob=oblig.has(k), open=S.lfocus===k;
      return `<div class="tl-row${done?' done':''}${paso!=null?' want plan-'+(paso+1)+(PLAN_DOS_PERIODOS&&paso!==S.planPaso?' plan-otra':''):''}${S.reqHover?(k===S.mapHover?' hpre':S.reqHover.includes(k)?' hpost':''):''}" style="--nv:var(--n${c[k][2]})"><span class="tl-bar"></span>`+
        `<button type="button" class="tl-name" data-lfocus="${esc(k)}" aria-expanded="${open}"><b>${esc(pretty(c[k][0]))}</b><small>${esc(k)} · ${esc(textoCreditos(k,c[k][1],true))}${off.has(k)||isElec(k)?'':' · sin grupos'}${t?` <span class="tl-tag ${t[1]}">${t[0]}</span>`:''}${ob?' <span class="tl-tag bad">Obligatoria</span>':''}</small></button>`+
        `<span class="tl-acciones">${ayudaCreditos(k)}<button type="button" class="tl-want" data-lwant="${esc(k)}" aria-pressed="${w}"${(done||ob)&&!(PLAN_DOS_PERIODOS&&paso!=null&&paso!==S.planPaso)||isElec(k)?' disabled':''} aria-label="${PLAN_DOS_PERIODOS&&paso!=null&&paso!==S.planPaso?'Ver acciones de':w?'Quitar':'Agregar'} ${esc(pretty(c[k][0]))}">${paso!=null?(PLAN_DOS_PERIODOS?(paso===0&&S.planPaso===1?'en ':'')+esc(planEtiqueta(paso)):'✓'):'+'}</button></span>`+
        (open?`<div class="tl-more">${inspParts(k).l2}${PLAN_DOS_PERIODOS?`<div class="insp-act">${planAcciones(k)}</div>`:''}</div>`:'')+'</div>'}).join('')+'</div></section>').join('');
  montarAyudasCreditos();
}

function renderAyudaPrimeraVisita(){
  const box=$('#map-primera-visita');box.replaceChildren();
  box.hidden=!!ALUMNO&&!ALUMNO.demo||store.get('mapAyudaDescartada',false);
  if(!box.hidden)box.appendChild(SateUI.aviso({estado:'info',titulo:SATE.texto('sate.planeacion.primera_visita'),descartable:true,
    alDescartar(){store.set('mapAyudaDescartada',true);box.hidden=true}}));
}
SATE.pestana('mapa',{montar(){},mostrar(){renderAyudaPrimeraVisita();renderTray()},ocultar(){tipOculta()}});

/* ---------- resaltado al pasar el cursor, sin redibujar ----------
   Alterna clases en las cajas y flechas ya dibujadas (mismas reglas que el dibujo: resalteCaja y resalteArista). */
let MAPIDX=null, RESALTE_RAF=0;
function indiceMapa(){
  if(!MAPIDX){const el=$('#map');MAPIDX={cajas:[...el.querySelectorAll('.box')],aristas:[...el.querySelectorAll('.edge')]}}
  return MAPIDX;
}
function resaltarMapa(){
  RESALTE_RAF=0;
  if(!$('#map').childElementCount){renderMap();return}   // aún sin dibujar: dibujo completo
  const hot=calcHot(S.mapHover,S.reqHover,prereqs()), ix=indiceMapa();
  const Q=['hot','hpre','hpost','dim'];
  for(const n of ix.cajas){
    n.classList.remove(...Q);
    const c=n.dataset.box?SateUI.resalteCaja(hot,n.dataset.box,S.mapHover,S.reqHover):hot?' dim':'';
    if(c)n.classList.add(...c.trim().split(' '));
  }
  for(const n of ix.aristas){
    const r=resalteArista(hot,n.dataset.a,n.dataset.b,S.mapHover);
    n.classList.remove('hot','pre','post','dim','past');
    if(r.cls)n.classList.add(...r.cls.trim().split(' '));
    else if(n.dataset.past)n.classList.add('past');
    n.setAttribute('marker-end',`url(#${r.marker})`);
  }
  conSim(usaSim('mapa'),()=>conPlan(()=>{renderInsp();if(mview()==='lista')renderList()}));
}
// agrupa los eventos del cursor y del teclado en un solo cuadro de animación
function pedirResalte(){if(!RESALTE_RAF)RESALTE_RAF=requestAnimationFrame(resaltarMapa)}
