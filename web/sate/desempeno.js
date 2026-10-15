/* Render y controles propios de Desempeño; el motor académico permanece compartido. */
const FORMA_COLOR={Ordinario:'--ipn-ok',Extraordinario:'--ipn-aviso',ETS:'--ch-alert',Recurse:'--rel-pre',Equivalencia:'--ipn-tenue',Revalidación:'--n4',Dictamen:'--n6','No identificada':'--ipn-linea'};
const LIB_PLOT=[['../assets/vendor/d3-7.9.0.min.js','sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i'],
  ['../assets/vendor/plot-0.6.17.min.js','sha384-JUpn2GgRr0gxU0xOBd8D8P634jhRCwobtG8G2MMEkX1RnGJ7/FJNnuukpfT+H2w1']];
let PLOT_P=null;
const cargarPlot=()=>window.Plot?Promise.resolve():PLOT_P||(PLOT_P=LIB_PLOT.reduce((p,[src,sri])=>p.then(()=>new Promise((ok,no)=>{
  const s=document.createElement('script');s.src=src;s.integrity=sri;s.crossOrigin='anonymous';s.onload=ok;s.onerror=()=>{
    PLOT_P=null;
    console.error('SATE: biblioteca de gráficas no disponible',{unidad:UNIDAD,ruta:location.hash,archivo:src,integridad:sri});
    s.remove();no(new Error(SATE.texto('sate.desempeno.error_graficas')));
  };document.head.appendChild(s)})),Promise.resolve()));

let ST_RENDER=0;
const trayectoriaAbierta=(id,inicial=false)=>store.get('trayectoria.seccion.'+id,!MQ_PHONE.matches&&inicial);
function prepararSeccion(el,id,dibujar){
  el.open=trayectoriaAbierta(id,id==='kardex'||id==='escenario'||id==='simulacion');
  let dibujada=false,turno=0;
  const abrir=()=>{if(!el.open||dibujada)return;dibujada=true;const actual=++turno;return Promise.resolve(dibujar?.(()=>el.open&&actual===turno)).catch(e=>{
    if(actual===turno)dibujada=false;console.error('SATE: fallo al abrir sección',{unidad:UNIDAD,carrera:S.car,seccion:id,error:e.message});
  })};
  // El primer toggle también se emite al montar: solo guardar cambios del usuario.
  let anterior=el.open;
  el.addEventListener('toggle',()=>{if(anterior!==el.open){anterior=el.open;store.set('trayectoria.seccion.'+id,el.open)}if(!el.open){dibujada=false;turno++}return abrir()});
  return abrir();
}
function metaResumen(D,H,incluyeActual){
  const M=metaCreditos(D,H,incluyeActual);
  if(!M.valida)return '<p class="muted">Escribe un número entero de periodos (1 o más).</p>';
  if(M.pendientes==null)return '<p class="muted">No se puede calcular: los créditos que te faltan no son consistentes. Actualiza tus datos del SAES.</p>';
  if(M.pendientes===0)return '<p><b>Ya completaste los créditos del plan.</b> Consulta con Gestión Escolar los demás requisitos para concluir tus estudios.</p>';
  // regla: lo que has aprobado por periodo, lo que necesitas y tu máximo autorizado
  const tope=Math.max(M.necesarios,D.ritmo||0,M.autorizada||0)*1.15||1, x=v=>(v/tope*100).toFixed(1)+'%';
  // «necesitas» arriba; «tu ritmo» y «máximo» abajo. En un mismo lado, si dos marcas quedan cerca (o junto al borde
  // derecho), la etiqueta de la izquierda se escribe hacia la izquierda de su línea para no encimarse.
  const pos=v=>v/tope*100, ab=[[D.ritmo||null,'ritmo','tu ritmo'],[M.autorizada,'max','máximo']].filter(m=>m[0]!=null).sort((p,q)=>p[0]-q[0]);
  // abajo: si las dos marcas están cerca, sus etiquetas van a lados opuestos; si el borde derecho no lo permite,
  // la de la izquierda baja a un segundo renglón
  const lugar=ab.map(([v])=>({izq:pos(v)>82,fila2:false}));
  if(ab.length===2&&pos(ab[1][0])-pos(ab[0][0])<16){lugar[0].izq=true;if(pos(ab[1][0])>82){lugar[1].izq=true;lugar[0].fila2=true}}
  const marca=(v,cls,t,lado,aIzq)=>v==null?'':`<span class="mt-m ${cls} ${lado}${aIzq?' izq':''}" style="left:${x(v)}"><span><b>${fmtCr(v)}</b> ${t}</span></span>`;
  const estado=M.autorizada==null?'No se conoce tu carga máxima autorizada para compararla.':M.supera?`Rebasa tu carga máxima autorizada (${fmtCr(M.autorizada)} cr).`:'Cabe en tu carga máxima autorizada; revisa también la seriación y que haya grupos.';
  // equivalencia aproximada en materias: promedio de créditos de las materias del plan que te faltan
  let porMat=null;try{const c=cur(),hechas=new Set(tr().done),cr=Object.keys(c).filter(k=>!hechas.has(k)&&!isElec(k)&&c[k][1]>0).map(k=>c[k][1]);if(cr.length)porMat=cr.reduce((a,b)=>a+b,0)/cr.length}catch(e){}
  const nMat=porMat?Math.max(1,Math.round(M.necesarios/porMat)):null;
  return `<p class="mt-h"><b>${fmtCr(M.necesarios)} créditos por periodo</b> ${ayudaCreditos()}${nMat?` <span class="mt-mat">≈ ${nMat} ${nMat===1?'materia':'materias'} por periodo ${info(`Aproximado con el promedio de créditos de las materias que te faltan (${porMat.toFixed(1)} créditos por materia).`)}</span>`:''}${M.fin!=null?` · de ${perName(M.inicio)} a ${perName(M.fin)}`:''}</p>
    <div class="mt-regla${M.supera?' supera':''}" aria-hidden="true"><i class="mt-zona" style="width:${M.autorizada!=null?x(M.autorizada):'100%'}"></i>
      ${marca(M.necesarios,'nec','necesitas','arriba',pos(M.necesarios)>82)}${ab.map(([v,c,t],j)=>marca(v,c,t,lugar[j].fila2?'abajo fila2':'abajo',lugar[j].izq)).join('')}</div>
    <p class="mt-e${M.supera?' warn':''}">${estado}${M.bajoMin?' Es menos que la carga mínima; requiere autorización.':''} ${info('Promedio de créditos que necesitas aprobar por periodo, no una lista exacta de materias. Tu carga autorizada puede cambiar cada periodo; los periodos se estiman con tu cita de reinscripción y tu kárdex.')}</p>`;
}

const pmEst=x=>x==null?'':x<=6?'cualquier calificación aprobatoria te alcanza':x>10?'no alcanzable':`<b>${x.toFixed(2)}</b>`;
const pmEscala=x=>x==null||x>10||x<6?'':`<span class="k-regla pm-regla" aria-hidden="true"><i style="left:${(x-6)/4*100}%"></i><em>6</em><em>10</em></span>`;

function pmEstado(M){const comb=pmCombinacion(M), v=Object.values(comb);if(!v.length)return '';
  const prom=v.reduce((a,b)=>a+b,0)/v.length, fin=(M.n*M.actual+prom*v.length)/(M.n+v.length), ok=M.periodo!=null&&prom>=M.periodo-1e-9;
  return `<span class="pm-estado ${ok?'ok':'no'}">${ok?'✓':'✗'} Tu combinación promedia <b>${prom.toFixed(2)}</b>${ok?' y alcanza tu meta':M.periodo<=10?` · te faltan ${(M.periodo-prom).toFixed(2)} puntos de promedio`:''}</span><span class="muted">Promedio sin reprobadas al terminar el periodo: ${fin.toFixed(2)}</span>`}
function promMetaHtml(M){
  const est=pmEst, escala=pmEscala;
  if(!M.n)return '<p class="muted">Aún no hay materias acreditadas para calcular.</p>';
  let per='<p class="muted">No tienes materias inscritas registradas.</p>';
  if(M.k){const c=cur(), comb=pmCombinacion(M);
    per=`<div class="pm-fila"><div><span class="pm-t">Este periodo</span><span>${M.periodo>10?`No alcanzable este periodo: aun con 10 en tus ${M.k} materias inscritas llegarías a ${M.max.toFixed(2)}.`:`Necesitas promediar ${est(M.periodo)} en tus ${M.k} ${M.k===1?'materia inscrita':'materias inscritas'} para alcanzar ${(+store.get('promMeta.'+S.car,0)||0)?'tu meta':'esta meta'}.`}</span></div>${escala(M.periodo)}</div>`+
      (M.periodo<=10?`<p class="pm-sub">Prueba otras combinaciones: puedes subir unas y bajar otras mientras el promedio alcance lo necesario.</p>
      <div class="pm-mats">${tr().enCurso.map(k=>`<label class="pm-mat"><span>${esc(pretty(c[k][0]))}</span><select data-pmcal="${esc(k)}" aria-label="Calificación de ${esc(pretty(c[k][0]))}">${[10,9,8,7,6].map(n=>`<option${comb[k]===n?' selected':''}>${n}</option>`).join('')}</select></label>`).join('')}</div>
      <div class="pm-res" id="pm-estado" aria-live="polite">${pmEstado(M)}</div>
      <div class="pm-acc"><button class="btn" type="button" id="prom-sim">Usar en la simulación</button><button class="link" type="button" id="pm-reset">Repartir de nuevo</button></div>`:'')}
  const car=M.R?`<div class="pm-fila"><div><span class="pm-t">Al terminar la carrera</span><span>Necesitas promediar ${est(M.carrera)} en las ${M.R} materias obligatorias que te faltan.</span></div>${escala(M.carrera)}</div>`:'';
  return per+car;
}

function metaPanel(D){
  const cfg=store.get('meta.'+S.car,{periodos:4,actual:true}), incluye=D.simulado?false:cfg.actual!==false;
  return `<section class="meta-panel" aria-labelledby="meta-h"><h3 id="meta-h">¿En cuántos periodos quieres terminar? ${simTag('meta')}</h3>
    <div class="meta-controls"><label for="meta-periodos">Periodos <input id="meta-periodos" type="number" min="1" step="1" value="${esc(String(cfg.periodos??4))}" aria-describedby="meta-result"></label>
    <label><input id="meta-actual" type="checkbox"${incluye?' checked':''}${D.simulado?' disabled':''}> Contar el periodo actual</label>${D.simulado?info('Los créditos incluyen tu simulación de fin de semestre; la meta empieza después de ese periodo.'):''}</div>
    <div id="meta-result" aria-live="polite">${metaResumen(D,cfg.periodos??4,incluye)}</div></section>`;
}
function montarGrafica(host,fig){
  host.replaceChildren(fig);
  const svg=fig.matches('svg')?fig:fig.querySelector('svg');if(!svg)return;
  const nativa=svg.getScreenCTM.bind(svg);let avisado=false;
  // Firefox puede omitir el zoom CSS de los ancestros en getScreenCTM. D3 usa su inversa para el cursor.
  // Estos SVG de Plot conservan xMidYMid meet; sus límites visibles incluyen zoom, resize y scroll.
  svg.getScreenCTM=()=>{
    const r=svg.getBoundingClientRect(),v=svg.viewBox.baseVal,m=nativa();
    if(!r.width||!r.height||!v.width||!v.height)return m;
    const k=Math.min(r.width/v.width,r.height/v.height);
    const x=r.left+(r.width-v.width*k)/2-v.x*k,y=r.top+(r.height-v.height*k)/2-v.y*k;
    if(m&&Math.abs(m.a-k)<.01&&Math.abs(m.d-k)<.01&&Math.abs(m.e-x)<.1&&Math.abs(m.f-y)<.1)return m;
    if(!avisado){console.debug('Gráfica: corregida matriz del cursor por escala CSS',{grafica:host.id,escala:k,ancho:r.width,alto:r.height});avisado=true}
    return new DOMMatrix([k,0,0,k,x,y]);
  };
}
function promMetaPanel(D){
  const T=store.get('promMeta.'+S.car,null), v=T??(D.media!=null?Math.min(10,Math.ceil((D.media+.3)*10)/10):8.5), M=promMeta(D,v);
  return `<section class="meta-panel pm" aria-labelledby="pm-h"><h3 id="pm-h">¿Qué promedio quieres alcanzar? ${simTag('pm')}${info('Se calcula con tu promedio sin reprobadas (tus materias acreditadas). El promedio oficial del SAES también cuenta calificaciones reprobadas, así que para subirlo puede hacer falta un poco más.')}</h3>
    <div class="meta-controls"><label for="prom-meta">Promedio meta <input id="prom-meta" type="number" min="6" max="10" step="0.1" value="${v}"></label>
    <span class="muted">Hoy: ${M.actual!=null?M.actual.toFixed(2):'—'} (${M.n} materias)</span></div>
    <div id="pm-res">${promMetaHtml(M)}</div></section>`;
}
// leyenda visual de una gráfica: [tipo, color, texto]; tipos: linea, punteada, guion, area, barra, punto, anillo, vertical, vertical-p
function ley(items){return SateUI.leyendaGrafica(items,esc)}
function renderAnalisis(D){
  const el=$('#kanal');if(!el)return;
  const X=analisis(), f2=v=>v==null?'—':(+v).toFixed(2);
  const cuid=X.cuidar.length?`<ul class="an-list">${X.cuidar.map(r=>`<li><b>${esc(X.nm(r.k))}</b><small>${esc(r.motivos.join('. '))}.</small></li>`).join('')}</ul>`:
    '<p class="muted">Sin requisitos pendientes.</p>';
  const lin=X.lineas.length?`<section><h4>Promedio por línea de especialización</h4><p class="an-sub">Tus materias aprobadas de cada línea.</p><ul class="an-bars">${X.lineas.map(l=>`<li><span>${esc(l.nombre)}${l.sim?' · simulado':''}</span><b>${f2(l.prom)}</b><small>${l.n} de ${l.total} materias · ${esc(l.claves.map(X.nm).join(', '))}</small></li>`).join('')}</ul></section>`:'';
  const ruta=X.ciclo?'<p class="muted">No se puede mostrar la cadena: el mapa tiene requisitos circulares.</p>':X.cadena.length?
    `<p class="an-sub">${X.cadena.length} materias seguidas: cada una abre la siguiente, así que se cursan en periodos distintos.</p><ol class="an-chain">${X.cadena.map(k=>`<li>${esc(X.nm(k))}</li>`).join('')}</ol>`:
    '<p class="muted">No tienes cadenas de materias seriadas pendientes.</p>';
  el.innerHTML=`<h3 class="an-h">Observaciones para planear ${simTag('obs')}</h3><div class="an-grid">
    <section><h4>Tus materias elegidas y reprobadas</h4><p class="an-sub">Lo que les falta y lo que desbloquean.</p>${cuid}</section>
    ${lin}<section><h4>Cadena de seriación más larga</h4>${ruta}</section>
    </div>`;
}

function renderSimulacion(){
  const c=cur();
    const ec=tr().enCurso, pr=tr().pendRep;$('#est-sim').hidden=!ec.length&&!pr.length;
    const calSel=(k,attr,v,esc_=[10,9,8,7,6])=>`<select data-${attr}="${esc(k)}" aria-label="${esc(SATE.texto('sate.desempeno.calificacion'))}"${SIM.on?'':' disabled'}>${esc_.map(n=>`<option${+v===n?' selected':''}>${n}</option>`).join('')}</select>`;
    $('#est-sim').innerHTML=ec.length||pr.length?`<label class="tgl" title="${esc(SATE.texto('sate.desempeno.sim_aviso'))}"><input type="checkbox" id="sim-on"${SIM.on?' checked':''}><span class="tgl-ui" aria-hidden="true"></span><span>${esc(SATE.texto('sate.desempeno.simular'))}</span></label>`+(SIM.on&&(Object.keys(SIM.res).length||Object.keys(SIM.rec).length||Object.keys(SIMBLK).length)?`<button type="button" class="link sim-reset" id="sim-reset" title="${esc(SATE.texto('sate.desempeno.reiniciar_ayuda'))}">${esc(SATE.texto('sate.desempeno.reiniciar'))}</button>`:'')+
      `<span class="sim-hint">${SIM.on?SATE.texto('sate.desempeno.sim_efecto'):SATE.texto('sate.desempeno.sim_ayuda')}</span>`+
      `<div class="simrows${SIM.on?'':' off'}">`+
      ec.map(k=>{const r=SIM.res[k]||{},ok=r.ok!==false;return `<div class="simrow"><span class="sim-n">${esc(pretty(c[k][0]))}<small>${tr().encEqv?.includes(k)?SATE.texto('sate.desempeno.en_curso_eqv'):SATE.texto('sate.desempeno.en_curso')}</small></span>`+
        `<div class="seg sm" role="group"><button type="button" data-simok="${esc(k)}" aria-pressed="${ok}"${SIM.on?'':' disabled'}>${esc(SATE.texto('sate.desempeno.aprobada'))}</button><button type="button" data-simko="${esc(k)}" aria-pressed="${!ok}"${SIM.on?'':' disabled'}>${esc(SATE.texto('sate.desempeno.reprobada'))}</button></div>`+
        (ok?calSel(k,'simcal',r.cal??8):calSel(k,'simcalr',r.calR??5,[5,4,3,2,1,0])+`<span class="sim-x">${esc(SATE.texto('sate.desempeno.recursar'))}</span>`)+`</div>`}).join('')+
      pr.map(k=>{const r=SIM.rec[k]||{};return `<div class="simrow"><span class="sim-n">${esc(pretty(c[k][0]))}<small class="bad">${esc(SATE.texto('sate.desempeno.reprobada'))}</small></span>`+
        `<select data-simrec="${esc(k)}" aria-label="${esc(SATE.texto('sate.desempeno.como_acredita'))}"${SIM.on?'':' disabled'}><option value="">${esc(SATE.texto('sate.desempeno.pendiente'))}</option>${['ETS','REC','EXT'].map(f=>`<option value="${f}"${r.forma===f?' selected':''}>${esc(SATE.texto('sate.desempeno.acreditada_por',{forma:FORMAS[f].toLowerCase()}))}</option>`).join('')}</select>`+
        (r.forma?calSel(k,'simreccal',r.cal??7):'')+`</div>`}).join('')+`</div>`:'';

}
async function renderStatsVista(){
  const revision=++ST_RENDER;
  const box=$('#kstats');
  if(!isPersonal()||SATE.actual?.pestana!=='trayectoria')return;
  const D=statsDatos(), A=ALUMNO;
  const Dde=blk=>usaSim(blk)===SIM.on?D:conSim(usaSim(blk),statsDatos), Dc=Dde('camino'), Dk=Dde('kardex'), Da=Dde('areas');
  
  const f2=v=>v==null||!isFinite(v)?'—':(+v).toFixed(2), sg=v=>v==null?'':(v>=0?'+':'')+v.toFixed(2);
  const plazo=plazoReferencia(A), dur=plazo.dur, cursados=A.avance?.cursados, limite0=plazo.max&&cursados!=null&&D.actual!=null?1:null, totalPer=D.nper!=null&&cursados!=null?D.fin!=null&&D.actual!=null?cursados+D.fin-D.actual:cursados:null;
  // Conserva el nodo y sus eventos al reconstruir las gráficas.
  const focoSim=$('#desempeno-simulacion').contains(document.activeElement)?document.activeElement:null;
  $('#sate-trayectoria').appendChild($('#desempeno-simulacion'));
  box.innerHTML=`${D.avisos.length?`<p class="st-note">${D.avisos.map(esc).join(' ')}</p>`:''}${SateUI.indicadoresTrayectoria(D,{esc,fmtCr,info,SATE})}
    <div class="charts">
      <figure class="ch-wide"><figcaption><b>Tu camino en la carrera ${simTag('camino')}</b>${ley([['cuadro','var(--ipn-acento)','Acreditado'],['rayado','var(--ipn-acento)',Dc.simulado?'Simulado':'En curso'],['cuadro','var(--ipn-linea)','Te falta'],['marca','var(--ipn-acento)','Estimado a tu ritmo'],...(totalPer!=null&&plazo.max&&totalPer>plazo.max?[['anillo','var(--ch-alert)','Rebasa el plazo']]:[])])}</figcaption><div id="ch-camino"></div></figure>
    </div>
    <details class="trayectoria-plegable" id="trayectoria-kardex"><summary>${esc(SATE.texto('sate.trayectoria.kardex'))}<small>${esc(SATE.texto('sate.trayectoria.kardex_resumen',{n:Dk.rows.length}))}</small></summary><div class="charts">
      <figure class="ch-wide"><figcaption>${simTag('kardex')}${ley([['grado','','Calificación'],...[['E','Extraordinario'],['T','ETS'],['R','Recurse']].filter(([l])=>Dk.rows.some(r=>({EXT:'E',ETS:'T',REC:'R'})[r.codigo]===l)).map(([l,t])=>['letra',l,t]),...(Dk.rows.some(r=>r.sim)?[['simulada','var(--ipn-texto)','Simulada']]:[])])}</figcaption><div id="ch-kx"></div></figure>
    </div></details>
    <div id="trayectoria-sim-slot"></div>
    <details class="trayectoria-plegable" id="trayectoria-escenario"><summary id="trayectoria-escenario-titulo">${esc(SATE.texto('sate.trayectoria.y_si'))}<small>${esc(SATE.texto('sate.trayectoria.y_si_resumen'))}</small></summary><div>
      ${conSim(usaSim('meta'),()=>metaPanel(statsDatos()))}
      ${conSim(usaSim('pm'),()=>promMetaPanel(statsDatos()))}
    </div></details>
    <details class="trayectoria-plegable" id="trayectoria-areas"><summary>${esc(SATE.texto('sate.trayectoria.areas'))}<small id="trayectoria-areas-resumen"></small></summary><div class="charts">
      <figure class="ch-wide trayectoria-afinidades"><figcaption>${simTag('areas')}<span>${esc(SATE.texto('sate.trayectoria.areas_media',{promedio:f2(Da.media)}))}</span></figcaption><div id="ch-cat" aria-hidden="true"></div><details class="trayectoria-areas-detalle"><summary>${esc(SATE.texto('sate.trayectoria.areas_detalle'))}</summary><p id="trayectoria-areas-lectura"></p><div id="trayectoria-areas-datos"></div></details></figure>
    </div></details>
    <details class="trayectoria-plegable" id="trayectoria-observaciones"><summary>${esc(SATE.texto('sate.trayectoria.observaciones'))}</summary><div class="kanal" id="kanal"></div></details>
    ${D.rows.some(r=>r.eqv)?`<p class="st-note">${D.rows.filter(r=>r.eqv).length} ${D.rows.filter(r=>r.eqv).length===1?'materia reconocida':'materias reconocidas'} por equivalencia, revalidación o dictamen (${D.crEqv==null?'créditos incompletos':fmtCr(D.crEqv)+' créditos'}) ${info('Equivalencia: materia de otra carrera o plan del IPN (por ejemplo, cambio de carrera). Revalidación: materia cursada en otra institución, incluida la movilidad académica nacional o internacional. Dictamen: reconocimiento por resolución académica. Todas cuentan en tus promedios, áreas y créditos; como el SAES las registra al reconocerlas y no en el periodo en que se cursaron, no entran en el promedio por periodo ni en tu ritmo de créditos.')}</p>`:''}`;
  $('#trayectoria-sim-slot').appendChild($('#desempeno-simulacion'));
  montarAyudasCreditos();
  if(focoSim)focoSim.focus();
  prepararSeccion($('#trayectoria-escenario'),'escenario');
  prepararSeccion($('#trayectoria-observaciones'),'observaciones',()=>conSim(usaSim('obs'),()=>renderAnalisis(statsDatos())));
  const cs=getComputedStyle(document.documentElement), tok=n=>cs.getPropertyValue(n).trim();
  const base=el=>({width:$(el).clientWidth,style:{background:'transparent',color:tok('--ipn-texto'),fontSize:'11px',fontFamily:'inherit'},marginLeft:40,marginBottom:32});
  const put=(id,fig)=>montarGrafica($(id),fig);
  const tickPer=d=>perName(d);
  // 1) camino en la carrera: regla del plan completo con lo acreditado, lo que está en curso y la estimación por periodo
  $('#ch-camino').innerHTML=SateUI.caminoTrayectoria(Dc,A,plazo,totalPer,{esc,fmtCr,perName,proyeccionCreditos,
    ec:Dc.simulado?0:[...new Set(tr().enCurso)].reduce((t,k)=>t+(cur()[k]?.[1]||0),0),info},$('#ch-camino').clientWidth);
  montarAyudasCreditos();
  // 2) kárdex por periodo: cada materia es un cuadro con su calificación; encabezado con promedio y créditos
  prepararSeccion($('#trayectoria-kardex'),'kardex',()=>{const host=$('#ch-kx');
    const col=(t,sub,rs)=>SateUI.fichasKardex(t,sub,rs,esc);
    const eq=Dk.rows.filter(r=>r.eqv), sinP=Dk.rows.filter(r=>!r.eqv&&r.per==null);
    let prev=null;
    host.innerHTML=`<div class="kx">`+(eq.length?col('Equivalencias',`${eq.length} materias`,eq):'')+
      Dk.porPer.filter(d=>d.n).map(d=>{const rs=Dk.rows.filter(r=>!r.eqv&&r.per===d.per), dif=prev!=null?d.prom-prev:null;prev=d.prom;
        return col(d.lbl,`${f2(d.prom)}${dif!=null&&Math.abs(dif)>=.01?` <em class="${dif>0?'up':'down'}">${dif>0?'▲':'▼'}</em>`:''} · ${d.cr!=null?fmtCr(d.cr)+' cr':''}`,rs)}).join('')+
      (sinP.length?col('Sin periodo',`${sinP.length} materias`,sinP):'')+`</div>`});
  // Dos materias evitan presentar una sola calificación como una afinidad consolidada.
  const grupos=new Map();for(const r of Da.rows){if(!grupos.has(r.cat))grupos.set(r.cat,[]);grupos.get(r.cat).push(r)}
  const porArea=[...grupos].map(([cat,v])=>({cat,media:v.reduce((a,r)=>a+r.cal,0)/v.length,n:v.length,
    cr:v.every(r=>r.cr!=null)?v.reduce((a,r)=>a+r.cr,0):null})).sort((a,b)=>b.media-a.media||a.cat.localeCompare(b.cat,'es'));
  const mejores=porArea.filter(d=>d.n>=2).slice(0,2), tx=(k,v)=>SATE.texto('sate.trayectoria.areas_'+k,v);
  const lectura=mejores.length?tx(mejores.length===2?'mejores':'mejor',{primera:`${mejores[0].cat} (${mejores[0].media.toFixed(1)})`,segunda:mejores[1]?`${mejores[1].cat} (${mejores[1].media.toFixed(1)})`:''}):tx(porArea.length?'muestra':'vacio');
  $('#trayectoria-areas-resumen').textContent=mejores.length?tx('resumen',{area:mejores[0].cat,promedio:mejores[0].media.toFixed(1)}):'';
  $('#trayectoria-areas-lectura').textContent=lectura;
  return prepararSeccion($('#trayectoria-areas'),'areas',async(abierta)=>{
  const vigente=()=>revision===ST_RENDER&&SATE.actual?.pestana==='trayectoria'&&abierta();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); // Medir después de abrir el details.
  if(!vigente())return;
  // La lista conserva todos los nombres y datos, incluso si la biblioteca no carga.
  $('#trayectoria-areas-datos').innerHTML=porArea.length?`<ol class="trayectoria-areas-ranking">${porArea.map(d=>`<li${d.n===1?' class="area-muestra"':''}><b>${esc(d.cat)}${d.n===1?' '+esc(tx('una')):''}</b><span>${esc(tx('datos',{promedio:f2(d.media),creditos:d.cr==null?tx('creditos_desconocidos'):fmtCr(d.cr)+' cr',materias:SATE.texto('sate.desempeno.materias',{n:d.n})}))}</span></li>`).join('')}</ol>`:'';
  if(!porArea.length)return;
  try{await cargarPlot()}catch(e){if(vigente())$('#ch-cat').innerHTML=`<p class="muted">${esc(e.message)}</p>`;throw e}
  if(!vigente())return;
  const P=window.Plot;
  const col=d=>tok(mejores.includes(d)?'--ipn-acento':'--ipn-tenue');
  put('#ch-cat',P.plot({...base('#ch-cat'),height:porArea.length*24+32,marginTop:0,marginBottom:32,marginLeft:$('#ch-cat').clientWidth<480?118:160,marginRight:20,
    x:{label:null,domain:[6,10],ticks:[6,7,8,9,10]},y:{label:null,domain:porArea.map(d=>d.cat),padding:0,tickSize:0,tickFormat:d=>d.length>18?d.slice(0,17)+'…':d},
    marks:[P.ruleY(porArea,{y:'cat',x1:6,x2:10,stroke:tok('--ipn-linea')}),
      P.ruleX(Da.media==null?[]:[Da.media],{stroke:tok('--ipn-tenue'),strokeOpacity:.4,strokeWidth:1}),
      P.dot(porArea,{x:'media',y:'cat',fill:col,fillOpacity:d=>d.n===1?.6:1,r:4.5})]}));
  });
}


const cambiarMeta=e=>{
  if(!['meta-periodos','meta-actual'].includes(e.target.id))return;
  const cfg={periodos:$('#meta-periodos').value,actual:$('#meta-actual').checked};
  store.set('meta.'+S.car,cfg);
  const D=statsDatos();$('#meta-result').innerHTML=metaResumen(D,cfg.periodos,D.simulado?false:cfg.actual);
  $('#meta-periodos').setAttribute('aria-invalid',String(!metaCreditos(D,cfg.periodos,cfg.actual).valida));
};
$('#kstats').addEventListener('input',cambiarMeta);
$('#kstats').addEventListener('input',e=>{if(e.target.id!=='prom-meta')return;const v=+e.target.value;if(!(v>=6&&v<=10))return;
  store.set('promMeta.'+S.car,v);store.set('pmCal.'+S.car,{});const D=statsDatos(),M=promMeta(D,v);
  $('#pm-res').innerHTML=promMetaHtml(M)});
// combinación por materia: actualiza solo el indicador; «Usar en la simulación» la lleva al simulador
$('#kstats').addEventListener('change',e=>{const k=e.target.dataset?.pmcal;if(!k)return;
  const g=store.get('pmCal.'+S.car,{});g[k]=+e.target.value;store.set('pmCal.'+S.car,g);
  const v=store.get('promMeta.'+S.car,null)??+$('#prom-meta').value;$('#pm-estado').innerHTML=pmEstado(promMeta(statsDatos(),v))});
$('#kstats').addEventListener('click',e=>{
  if(e.target.id==='pm-reset'){store.set('pmCal.'+S.car,{});renderStats();return}
  if(e.target.id!=='prom-sim')return;
  const v=store.get('promMeta.'+S.car,null)??+$('#prom-meta').value, comb=pmCombinacion(promMeta(statsDatos(),v));
  Object.entries(comb).forEach(([k,cal])=>{SIM.res[k]={ok:true,cal}});
  SIM.on=true;simTodos();simSave()});
// las gráficas toman los colores del tema al dibujarse: se redibujan si cambia el tema (sistema o botón)
{const redibuja=()=>{if(!$('#kstats')?.hidden)renderStats()};
  try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',redibuja)}catch(e){}
  new MutationObserver(redibuja).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})}
$('#est-sim').addEventListener('change',e=>{if(e.target.id==='sim-on'){SIM.on=e.target.checked;simTodos();simSave()}});
$('#est-sim').addEventListener('click',e=>{if(e.target.closest('#sim-reset')){SIM.res={};SIM.rec={};SIM.on=true;simTodos();simSave();return}
  const b=e.target.closest('[data-simok],[data-simko]');if(!b||b.disabled)return;
  const k=b.dataset.simok||b.dataset.simko;SIM.res[k]={...(SIM.res[k]||{}),ok:!!b.dataset.simok};simSave()});
$('#est-sim').addEventListener('change',e=>{const t=e.target,d=t.dataset;
  if(d.simcal){SIM.res[d.simcal]={...(SIM.res[d.simcal]||{ok:true}),cal:+t.value};simSave()}
  else if(d.simcalr){SIM.res[d.simcalr]={...(SIM.res[d.simcalr]||{ok:false}),calR:+t.value};simSave()}
  else if(d.simrec!==undefined){if(t.value)SIM.rec[d.simrec]={...(SIM.rec[d.simrec]||{}),forma:t.value};else delete SIM.rec[d.simrec];simSave()}
  else if(d.simreccal){SIM.rec[d.simreccal]={...(SIM.rec[d.simreccal]||{}),cal:+t.value};simSave()}});

SATE.pestana('trayectoria',{
  montar(){
    prepararSeccion($('#desempeno-simulacion'),'simulacion');
    $('#desempeno-titulo').textContent=SATE.texto('sate.pestana.trayectoria.titulo');
    $('#desempeno-sim-titulo').textContent=SATE.texto('sate.desempeno.sim_titulo');
    $('#desempeno-lector').textContent=SATE.texto('sate.desempeno.lector');
    $('#desempeno-lector').addEventListener('click',()=>SAES.open());
    $('#desempeno-explorar').textContent=SATE.texto('sate.trayectoria.explorar');
    $('#desempeno-explorar').addEventListener('click',()=>SATE.ir('mapa'));
  },
  mostrar(){
    SATE.presente?.mostrar();
    const personal=isPersonal();
    $('#desempeno-lector').textContent=SATE.texto('sate.encabezado.'+(ALUMNO&&!ALUMNO.demo?'actualizar':'cargar'));
    $('#desempeno-vacio').hidden=personal;
    $('#desempeno-vacio-texto').textContent=SATE.texto('sate.trayectoria.sin_datos');
    $('#desempeno-simulacion').hidden=!personal;
    $('#kstats').hidden=!personal;
    const abrir=SATE.simAbrir;SATE.simAbrir=false;
    if(abrir)$('#desempeno-simulacion').open=true;
    if(abrir&&!personal)$('#desempeno-lector').focus();
    if(!personal){++ST_RENDER;return}
    renderSimulacion();
    const pendiente=renderStatsVista().catch(SATE.error);
    if(abrir)$('#desempeno-sim-titulo').focus();
    return pendiente;
  },
  ocultar(){++ST_RENDER;SateUI.cerrarModal()}
});
