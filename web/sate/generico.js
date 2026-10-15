/* Sin plan cargado: conservar el SAES como fuente, sin completar datos académicos por inferencia. */
window.IPNT_UNIDAD = window.SATE_UNIDAD;
/*__CUENTA_JS__*/
/*__SAES_JS__*/
(function () {
  if (!SATE_UNIDAD) {
    // Reutilizar el Lector: una unidad vacía dirige cualquier pegado válido a su SATE.
    window.IPNT_UNIDAD='entrada';
    const abrir=SAES.open.bind(SAES); let conectado=false;
    SAES.open=async()=>{
      try {
        await SATE.script('saes-dialogo.js');
        if(!conectado){SAES.wire(()=>{});conectado=true}
        SAES.status(null); abrir();
      } catch(e){SATE.error(e)}
    };
    document.addEventListener('click',e=>{if(e.target.closest?.('[data-saes-open]')&&!conectado){e.preventDefault();SAES.open()}});
    return;
  }
  const unidad = SATE_UNIDAD, $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const numero = v => v != null && String(v).trim() !== '' && Number.isFinite(+v) && +v >= 0 ? +v : null;
  const dato = v => numero(v) == null ? 'Sin dato del SAES' : esc(numero(v));
  function datos(a) {
    a ||= {};
    const materias = new Map(), altas = new Set((a.acreditadas || []).filter(r => numero(r[1]) >= 6 && numero(r[1]) <= 10).map(r => r[0]));
    const curso = new Set([...(a.en_curso || []), ...(a.horario_inscrito || []).map(r => r[1])]);
    const reprobadas = new Set((a.reprobadas_periodo || []).map(r => r[0]));
    const normal = s => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
    const reproNombres = new Set((a.reprobadas || []).map(r => normal(r[0])));
    const desfasadas = new Set((a.desfasadas_saes || []).map(r => r[0]));
    const agregar = (k, nombre, semestre, periodo) => {
      if (!k) return;
      const m = materias.get(k) || {clave:k,nombre:k,semestre:null,periodo:null};
      if (nombre) m.nombre = nombre;
      if (numero(semestre) > 0) m.semestre = numero(semestre);
      if (periodo) m.periodo = periodo;
      materias.set(k,m);
    };
    Object.entries(a.materias || {}).forEach(([k,m]) => {if(Array.isArray(m))agregar(k,m[0],m[1])});
    for (const tipo of ['acreditadas','kardex_reprobadas']) for (const r of a[tipo] || []) agregar(r[0],null,null,r[2]);
    for (const tipo of ['no_cursadas','reprobadas_periodo','desfasadas_saes']) for (const r of a[tipo] || []) agregar(r[0],null,r[3],null);
    for (const k of curso) agregar(k,null,null,null);
    for (const r of a.horario_inscrito || []) agregar(r[1],r[2],null,null);
    const porSemestre = [...materias.values()].some(m => m.semestre != null), grupos = new Map();
    for (const m of materias.values()) {
      if (reproNombres.has(normal(m.nombre)) || reproNombres.has(normal(m.clave))) reprobadas.add(m.clave);
      m.estado = altas.has(m.clave) ? 'Acreditada' : desfasadas.has(m.clave) ? 'Desfasada según el SAES' : curso.has(m.clave) ? 'En curso' : reprobadas.has(m.clave) ? 'Reprobada' : 'Por cursar';
      m.color = altas.has(m.clave) ? 'var(--ok)' : desfasadas.has(m.clave) ? 'var(--ipn-desfasada)' : curso.has(m.clave) ? 'var(--accent)' : reprobadas.has(m.clave) ? 'var(--ipn-reprobada)' : 'var(--line)';
      const grupo = porSemestre ? m.semestre == null ? 'Sin semestre informado' : 'Semestre '+m.semestre : m.periodo ? 'Periodo '+m.periodo : curso.has(m.clave) ? 'En curso' : 'Por cursar';
      if (!grupos.has(grupo)) grupos.set(grupo,[]);
      grupos.get(grupo).push(m);
    }
    const ordenados = [...grupos].sort((a,b) => {
      if(porSemestre)return (a[1][0].semestre ?? Infinity)-(b[1][0].semestre ?? Infinity);
      return (a[0].startsWith('Periodo ') ? 0 : 1)-(b[0].startsWith('Periodo ') ? 0 : 1)||a[0].localeCompare(b[0],'es',{numeric:true});
    });
    return {grupos:ordenados,materias:[...materias.values()],viejo:!a.materias};
  }
  function demo(conHorario=false) {
    const periodos=['23/2','24/1','24/2','25/1','25/2','26/1'], cantidades=[6,5,7,6,5,8];
    const notas=[7,8,9,8,10,7,8,9,6,8,9,8];
    const a={upiita_saes:1,demo:true,unidad,plan:'19',carrera_nombre:'Carrera ficticia de demostración',leido:'2026-10-09T12:00:00Z',
      materias:{},creditos_materias:{},acreditadas:[],kardex_reprobadas:[],no_cursadas:[],reprobadas_periodo:[],desfasadas_saes:[],en_curso:[],horario_inscrito:[],promedio:8,
      carga:{total:450,min:30,media:60,max:90,duracion:8,duracion_max:12},avance:{obtenidos:370,faltan:80,cursados:6}};
    for(let i=0;i<45;i++){
      const k='Z'+String(i+1).padStart(3,'0'), sem=i<36?1+Math.floor(i/6):i<40?7:8;
      a.materias[k]=['Materia ficticia '+(i+1),sem];
      a.creditos_materias[k]=10;
      if(i<37){
        let p=0, limite=cantidades[0];
        while(i>=limite)limite+=cantidades[++p];
        a.acreditadas.push([k,notas[i%notas.length],periodos[p],i===6?'REC':i===8||i===22?'EXT':i===30?'ETS':'ORD']);
      }
      else a.no_cursadas.push([k,null,0,sem]);
      if(conHorario&&i>=37&&i<42){a.en_curso.push(k);a.horario_inscrito.push(['7FV1',k,a.materias[k][0],['Docente ficticio A','Docente ficticio B'],[[i-37,420,510]]]);}
    }
    a.no_cursadas=a.no_cursadas.filter(r=>!a.en_curso.includes(r[0]));
    // El intento previo al recurse también cuenta en el promedio oficial, pero no duplica créditos.
    a.kardex_reprobadas.push(['Z007',5,'23/2','ORD']);
    const kardex=[...a.acreditadas,...a.kardex_reprobadas];
    a.promedio=Math.round(kardex.reduce((s,r)=>s+r[1],0)/kardex.length*100)/100;
    a.avance.cursados=new Set(kardex.map(r=>r[2])).size;
    a.avance.obtenidos=a.acreditadas.reduce((s,r)=>s+a.creditos_materias[r[0]],0);
    a.avance.faltan=a.carga.total-a.avance.obtenidos;
    return a;
  }
  window.SateGenerico = {datos,demo};
  const esDemo=location.hash==='#demo'||location.hash==='#demo-horario';
  let alumno = esDemo?demo(location.hash==='#demo-horario'):SAES.load(), conectado = false;
  if(esDemo){
    const avisoDemo=document.createElement('div');avisoDemo.className='demo-bar';avisoDemo.textContent='Modo demostración · Perfil ficticio; no se guarda en tu cuenta ni en tus datos del SAES.';
    const salir=document.createElement('button');salir.type='button';salir.className='btn';salir.textContent='Salir del modo demostración';
    salir.onclick=()=>{location.hash='';location.reload()};avisoDemo.appendChild(salir);
    document.body.prepend(avisoDemo);
  }
  function pestañas(){
    const cfg=SATE_CONFIG.unidades[unidad], hay=!!alumno?.horario_inscrito?.length;
    cfg.pestanas=['trayectoria','mapa','calendario',...(hay?['horarios']:[])];cfg.grupos=[['trayectoria'],['mapa','calendario'],...(hay?[['horarios']]:[])];
    const oculta=t=>(SATE_CONFIG.pestanasOcultas||[]).includes(t);cfg.pestanas=cfg.pestanas.filter(t=>!oculta(t));cfg.grupos=cfg.grupos.map(g=>g.filter(t=>!oculta(t))).filter(g=>g.length);
  }
  pestañas();
  const abrir = SAES.open.bind(SAES);
  SAES.open = async () => {
    try {
      await SATE.script('saes-dialogo.js'); SATE.identidadSaes();
      if (!conectado) { SAES.wire(d => {alumno=d;simular=false;notas={};pendientes=false;zoom=null;pestañas();SATE.actualizarPestanas();SATE.repintar();estado()}); conectado=true; }
      estado(); abrir();
    } catch(e) { SATE.error(e); }
  };
  document.addEventListener('click',e=>{if(e.target.closest?.('[data-saes-open]')&&!conectado){e.preventDefault();SAES.open()}});
  $('b-unidad').addEventListener('click',()=>SATE.elegirUnidad());
  function estado() {
    const hay = !!alumno, clave = 'sate.encabezado.'+(hay?'actualizar':'cargar');
    $('saes-open').querySelector('.sate-texto-largo').textContent=SATE.texto(clave);
    $('saes-open').querySelector('.sate-texto-corto').textContent=SATE.texto(clave+'_corto');
    const indicador=$('sate-saes-indicador');indicador.classList.toggle('on',hay);
    const fecha = hay ? new Date(alumno.leido).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}) : '';
    const mensaje=SATE.texto(hay?'sate.encabezado.usando_datos':'sate.encabezado.sin_datos',{fecha});
    indicador.setAttribute('aria-label',mensaje);indicador.title=mensaje;
    if(conectado){$('saes-status').hidden=!hay;$('saes-steps').hidden=hay;$('saes-clear').hidden=!hay;
      $('saes-who').textContent=hay?(alumno.carrera_nombre||'')+' · leídos el '+fecha:'';}
  }
  const aviso = d => '<p class="muted">Tu trayectoria con los datos del SAES.</p>'+(d.viejo&&alumno?'<p role="status">Actualiza tus datos con el marcador SATE para ver los nombres de las materias.</p>':'');
  function representacion(d){
    const cols=Math.max(1,...d.grupos.map(([,ms])=>ms.length)), boxes=[],rows=[];
    d.grupos.forEach(([g,ms],i)=>{rows.push([g,32+i*76]);ms.forEach((m,j)=>boxes.push([150+j*138,10+i*76,128,56,m.clave]));});
    const L={w:150+cols*138,h:Math.max(1,d.grupos.length)*76,boxes,rows,edges:[],pitch:76,filas_exactas:true};
    const porClave=new Map(d.materias.map(m=>[m.clave,m])), curriculum=Object.fromEntries(d.materias.map(m=>[m.clave,[m.nombre,null,m.semestre]]));
    const statusOf=k=>({'Acreditada':'done','En curso':'curso','Reprobada':'fail','Desfasada según el SAES':'late'}[porClave.get(k).estado]||'');
    const ctx={isPersonal:()=>!!alumno,cur:()=>curriculum,
      slotFill:()=>new Map(),isElec:()=>false,statusOf,esc,SATE,soloLectura:true,etiqueta:k=>statusOf(k)==='done'?'Ya acreditada':porClave.get(k).estado,planAsignado:()=>null};
    return {L,ctx,mini:SateUI.minimapaCurricular(ctx,L,new Map())};
  }
  function minimapa(d,abrir=false){
    const mini=representacion(d).mini;
    return '<div class="trayectoria-minimapa">'+(abrir?'<button type="button" data-abrir-mapa aria-label="Abrir mapa curricular">'+mini.svg+'</button>':mini.svg)+'<div class="mm-leg">'+mini.leyenda+'</div></div>';
  }
  let vistaMapa='mapa', pendientes=false, zoom=null;
  function escalaMapa(L){
    const ancho=$('mapwrap').clientWidth||$('v-tray').clientWidth||1000;
    return Math.max(ancho>720?.2:.6,(ancho-2)/L.w);
  }
  function cuadricula(d){
    const {L,ctx}=representacion(d);
    // El ancho se mide después de montar la vista; en teléfono se conserva el desplazamiento para leer las cajas.
    const sc=zoom??escalaMapa(L);
    return '<div class="map" style="position:relative;width:'+L.w*sc+'px;height:'+L.h*sc+'px">'+
      '<svg width="'+L.w*sc+'" height="'+L.h*sc+'" viewBox="0 0 '+L.w+' '+L.h+'" aria-hidden="true">'+L.rows.map(([n,y],i)=>'<rect class="band" x="0" y="'+(i*76)+'" width="'+L.w+'" height="76"/><text class="rowlbl" x="12" y="'+y+'">'+esc(n)+'</text>').join('')+'</svg>'+
      L.boxes.map(([x,y,w,h,k])=>SateUI.cajaMateria(ctx,k,x,y,w,h,sc)).join('')+'</div>';
  }
  function vacio() {return '<p>Usa el marcador SATE desde el SAES de tu unidad y pega tus datos para ver tu trayectoria.</p><button class="btn primary" type="button" data-saes-open>Traer mis datos del SAES</button>'}
  function mapa() {
    const d=datos(alumno);
    if(!alumno||!d.materias.length){$('v-tray').innerHTML='<h2>Mapa curricular</h2>'+aviso(d)+(alumno?'<p>El SAES no informó materias. Actualiza tus datos con el marcador SATE.</p>':vacio());return}
    const {mini}=representacion(d), mostrar=pendientes?{...d}:d;
    // Filtrar la representación, conservando el estado real y los grupos del SAES.
    if(pendientes){mostrar.materias=d.materias.filter(m=>m.estado!=='Acreditada');mostrar.grupos=d.grupos.map(([g,ms])=>[g,ms.filter(m=>m.estado!=='Acreditada')]).filter(([,ms])=>ms.length);}
    $('v-tray').innerHTML='<h2>Mapa curricular</h2>'+aviso(d)+
      '<div class="maptools"><div class="seg" role="group" aria-label="Vista de la trayectoria">'+['mapa','lista'].map(v=>'<button type="button" data-mview="'+v+'" aria-pressed="'+(vistaMapa===v)+'">'+(v==='mapa'?'Mapa':'Lista')+'</button>').join('')+'</div>'+
      '<div class="seg" role="group" aria-label="Zoom" id="zoomseg"'+(vistaMapa==='lista'?' hidden':'')+'><button type="button" data-zoom="-1" aria-label="Alejar">−</button><button type="button" data-zoom="0">Mapa completo</button><button type="button" data-zoom="1" aria-label="Acercar">+</button></div></div>'+
      '<div class="legend" aria-label="Simbología">'+mini.leyenda+'</div>'+
      '<div class="mapcut" id="mapcut"><button class="minimap" type="button" data-vista="todo" aria-label="Avance completo en miniatura; muestra el mapa completo">'+mini.svg+'</button><div class="mapcut-info"><b>Tu avance</b><span>'+mini.cnt.done+' de '+d.materias.length+' materias acreditadas</span><span class="mm-leg">'+mini.leyenda+'</span><div class="seg sm mapvista" role="group" aria-label="Qué mostrar del mapa">'+[['todo','Mapa completo'],['pend','Pendientes']].map(([v,n])=>'<button type="button" data-vista="'+v+'" aria-pressed="'+(pendientes===(v==='pend'))+'">'+n+'</button>').join('')+'</div></div></div>'+
      '<div class="mapwrap" id="mapwrap"'+(vistaMapa==='lista'?' hidden':'')+'></div><div class="tlist"'+(vistaMapa==='mapa'?' hidden':'')+'>'+mostrar.grupos.map(([g,ms])=>'<section class="tl-sem"><h4>'+esc(g)+'</h4><div class="tl-rows">'+ms.map(m=>'<div class="tl-row'+(m.estado==='Acreditada'?' done':'')+'"><span class="tl-bar"></span><span class="tl-name"><b>'+esc(m.nombre)+'</b><small>'+esc(m.clave)+'</small></span><span>'+esc(m.estado==='Acreditada'?'Ya acreditada':m.estado)+'</span></div>').join('')+'</div></section>').join('')+'</div>';
    $('mapwrap').innerHTML=mostrar.materias.length?cuadricula(mostrar):'<p>Ya acreditaste todas las materias informadas.</p>';
  }

  const fmtCr=v=>numero(v)==null?'Sin dato del SAES':String(Math.round(v*100)/100);
  const info=t=>'<span class="info" title="'+esc(t)+'" aria-label="'+esc(t)+'">ⓘ</span>';
  const perIdx=p=>{const m=String(p||'').match(/^(\d{2,4})\/([12])$/);return m?(+m[1]%100)*2+(+m[2]-1):null};
  const perName=p=>String(Math.floor(p/2)).padStart(2,'0')+'/'+(p%2+1);
  const formas={ORD:'Ordinario',EXT:'Extraordinario',ETS:'ETS',REC:'Recurse',EQV:'Equivalencia',REV:'Revalidación',DIC:'Dictamen'};
  let simular=false, notas={}, metaPeriodos=4, metaPromedio=8.5;
  const secciones={};
  const abierto=(id,inicial=true)=>(secciones[id]??(inicial&&$('sate-trayectoria').clientWidth>720))?' open':'';
  function estadisticas(a,d){
    const mean=xs=>xs.length?xs.reduce((s,n)=>s+n,0)/xs.length:null;
    const nombres=new Map(d.materias.map(m=>[m.clave,m.nombre])), unicas=new Map();
    for(const r of a.acreditadas||[])if(numero(r[1])>=6&&numero(r[1])<=10)unicas.set(r[0],r);
    const rows=[...unicas.values()].map(([clave,cal,p,codigo])=>({clave,nombre:nombres.get(clave)||clave,cal:+cal,per:perIdx(p),codigo:String(codigo||'').toUpperCase(),cr:numero(a.creditos_materias?.[clave])}));
    const curso=d.materias.filter(m=>m.estado==='En curso');
    if(simular)for(const m of curso)rows.push({clave:m.clave,nombre:m.nombre,cal:notas[m.clave]??8,per:null,codigo:'ORD',cr:numero(a.creditos_materias?.[m.clave]),sim:true});
    rows.forEach(r=>{r.eqv=['EQV','REV','DIC'].includes(r.codigo);r.forma=formas[r.codigo]||'No identificada'});
    const reales=rows.filter(r=>!r.sim), reg=reales.filter(r=>!r.eqv&&r.per!=null);
    const porPer=[...new Set(reg.map(r=>r.per))].sort((a,b)=>a-b).map(per=>{const rs=reg.filter(r=>r.per===per);return {per,lbl:perName(per),prom:mean(rs.map(r=>r.cal)),n:rs.length,cr:rs.every(r=>r.cr!=null)?rs.reduce((s,r)=>s+r.cr,0):null}});
    const valores=rows.map(r=>r.cal).sort((a,b)=>a-b), media=mean(valores), mediana=valores.length?(valores[(valores.length-1)>>1]+valores[valores.length>>1])/2:null;
    const evaluadas=rows.filter(r=>['ORD','EXT','ETS','REC'].includes(r.codigo));
    const ultimos=porPer.slice(-3), ritmo=ultimos.length&&ultimos.every(p=>p.cr!=null)?mean(ultimos.map(p=>p.cr)):null;
    const total=numero(a.carga?.total), base=numero(a.avance?.obtenidos), saldo=numero(a.avance?.faltan);
    const extras=rows.filter(r=>r.sim), simCr=extras.every(r=>r.cr!=null)?extras.reduce((s,r)=>s+r.cr,0):null;
    const consistente=total!=null&&base!=null&&saldo!=null&&Math.abs(total-base-saldo)<.01;
    const obt=base!=null&&simCr!=null&&(!simular||consistente&&simCr<=saldo)?base+simCr:simular?null:base;
    const falta=consistente&&simCr!=null&&simCr<=saldo?saldo-simCr:null;
    let acum=0;
    const cobertura=reales.every(r=>r.cr!=null&&(r.eqv||r.per!=null))&&consistente&&Math.abs(reales.reduce((s,r)=>s+r.cr,0)-base)<.01;
    if(cobertura)acum=reales.filter(r=>r.eqv).reduce((s,r)=>s+r.cr,0);
    const curva=cobertura?porPer.map(p=>({...p,acum:acum+=p.cr})):[];
    const actual=porPer.at(-1)?.per??null, meta=actual!=null?actual+1:null;
    const nper=falta===0?0:ritmo>0&&falta!=null?Math.ceil(falta/ritmo):null, fin=nper>0&&meta!=null?meta+nper-1:null;
    const avisos=[];
    if(reales.some(r=>r.cr==null))avisos.push('El SAES no informó créditos por materia. No se pueden calcular créditos por periodo ni estimar tu ritmo.');
    else if(!cobertura)avisos.push('El kárdex no permite distribuir el saldo del SAES por periodo.');
    if(!consistente)avisos.push('Saldo de créditos sin confirmar: actualiza tus datos del SAES.');
    if(simular&&extras.some(r=>r.cr==null))avisos.push('La simulación de promedio está disponible; faltan créditos de las materias inscritas para simular el avance.');
    return {rows,porPer,media,mediana,sd:valores.length>1?Math.sqrt(valores.reduce((s,v)=>s+(v-media)**2,0)/(valores.length-1)):null,
      ord:evaluadas.length?evaluadas.filter(r=>r.codigo==='ORD').length/evaluadas.length:null,formasN:evaluadas.length,formasExcluidas:rows.length-evaluadas.length,
      delta:porPer.length>1?porPer.at(-1).prom-porPer.at(-2).prom:null,ritmo,ritmoN:ultimos.length,total,obt,falta,simCr,simulado:simular,curva,actual,meta,nper,fin,avisos,curso};
  }
  window.SateGenerico.estadisticas=estadisticas;
  function proyeccionCreditos(D){
    if(!(D.ritmo>0)||D.obt==null||D.meta==null||D.nper==null)return [];
    return [{acum:D.obt,per:D.meta-1},...Array.from({length:Math.min(200,D.nper)},(_,i)=>({acum:Math.min(D.total,D.obt+(i+1)*D.ritmo),per:D.meta+i}))];
  }
  function escenario(D){
    const necesarias=D.falta!=null?D.falta/metaPeriodos:null, n=D.rows.filter(r=>!r.sim).length, promedio=D.rows.filter(r=>!r.sim).reduce((s,r)=>s+r.cal,0);
    const objetivo=D.curso.length?(metaPromedio*(n+D.curso.length)-promedio)/D.curso.length:null;
    return '<details class="trayectoria-plegable" id="trayectoria-escenario"'+abierto('trayectoria-escenario')+'><summary>¿Y si…?</summary><div>'+
      '<section class="meta-panel"><h3>¿En cuántos periodos quieres terminar?</h3><div class="meta-controls"><label>Periodos <input id="gen-meta-periodos" type="number" min="1" step="1" value="'+metaPeriodos+'"></label></div><p aria-live="polite">'+(necesarias!=null?fmtCr(necesarias)+' créditos por periodo. '+(numero(alumno.carga?.max)!=null&&necesarias>alumno.carga.max?'Rebasa la carga máxima del SAES.':'Confirma tu carga autorizada con Gestión Escolar.'):'Faltan créditos consistentes del SAES para calcular esta meta.')+'</p></section>'+
      '<section class="meta-panel pm"><h3>¿Qué promedio quieres alcanzar?</h3><div class="meta-controls"><label>Promedio meta <input id="gen-meta-promedio" type="number" min="6" max="10" step="0.1" value="'+metaPromedio+'"></label></div><p aria-live="polite">'+(objetivo!=null?'Necesitas promediar '+objetivo.toFixed(2)+' en tus '+D.curso.length+' materias inscritas'+(objetivo>10?' · No alcanzable este periodo.':objetivo<=6?' · Cualquier calificación aprobatoria alcanza.':'.'):'No tienes materias inscritas informadas para calcular la meta.')+'</p></section>'+
      '<details class="sate-desp" id="gen-simulacion"'+abierto('gen-simulacion',false)+'><summary>Simular fin de semestre</summary><div class="est-sim"><label class="tgl"><input id="gen-sim" type="checkbox"'+(simular?' checked':'')+'><span class="tgl-ui" aria-hidden="true"></span>Activar simulación</label><p class="sim-hint">Escenario ficticio; tus datos del SAES se conservan.</p><div class="simrows'+(simular?'':' off')+'">'+D.curso.map(m=>'<label class="simrow"><span class="sim-n">'+esc(m.nombre)+'</span><select data-gen-nota="'+esc(m.clave)+'"'+(simular?'':' disabled')+' aria-label="Calificación de '+esc(m.nombre)+'">'+[10,9,8,7,6].map(v=>'<option'+((notas[m.clave]??8)===v?' selected':'')+'>'+v+'</option>').join('')+'</select></label>').join('')+'</div></div></details></div></details>';
  }
  function trayectoria() {
    const d=datos(alumno), a=alumno;
    if(!a){$('sate-trayectoria').innerHTML='<h2>Mi trayectoria</h2>'+vacio();return}
    const D=estadisticas(a,d), plazo={max:numero(a.carga?.duracion_max),dur:numero(a.carga?.duracion)}, cursados=numero(a.avance?.cursados);
    const totalPer=D.nper!=null&&cursados!=null?cursados+D.nper:null;
    const ec=D.curso.every(m=>numero(a.creditos_materias?.[m.clave])!=null)?D.curso.reduce((s,m)=>s+numero(a.creditos_materias[m.clave]),0):0;
    const camino=SateUI.caminoTrayectoria(D,a,plazo,totalPer,{esc,fmtCr,perName,proyeccionCreditos,ec:simular?0:ec,info},$('sate-trayectoria').clientWidth||600);
    const periodos=[...new Set(D.rows.filter(r=>!r.eqv).map(r=>r.per))].sort((a,b)=>(a??Infinity)-(b??Infinity));
    const col=(t,rs)=>SateUI.fichasKardex(t,rs.length+' '+(rs.length===1?'materia':'materias')+' · promedio '+(rs.reduce((s,r)=>s+r.cal,0)/rs.length).toFixed(2)+(rs.every(r=>r.cr!=null)?' · '+fmtCr(rs.reduce((s,r)=>s+r.cr,0))+' cr':''),rs,esc);
    const eq=D.rows.filter(r=>r.eqv);
    const kardex='<div class="kx">'+(eq.length?col('Equivalencias',eq):'')+periodos.map(p=>col(p==null?'Sin periodo':perName(p),D.rows.filter(r=>!r.eqv&&r.per===p))).join('')+'</div>';
    const desfase=(a.desfasadas_saes||[]).length?'Desfasadas según el SAES: '+(a.desfasadas_saes||[]).length:a.desfasadas_saes!=null?'El SAES no lista materias desfasadas.':'Desfase sin confirmar: actualiza el Estado General con el marcador SATE.';
    $('sate-trayectoria').innerHTML='<h2>Mi trayectoria</h2><div id="sate-presente"><p class="trayectoria-resumen">'+esc(a.carrera_nombre||'')+(a.plan?' · Plan '+esc(a.plan):'')+' · '+(D.total>0&&numero(a.avance?.obtenidos)!=null?Math.round(a.avance.obtenidos/D.total*100)+' % de avance':'Avance sin informar')+'</p>'+minimapa(d,true)+
      '<div class="trayectoria-datos"><p>'+esc(desfase)+'</p><p>Promedio del SAES: '+dato(a.promedio)+'</p><p>Periodos cursados: '+dato(a.avance?.cursados)+' · Duración: '+dato(a.carga?.duracion)+' · Duración máxima: '+dato(a.carga?.duracion_max)+'</p><p>Carga mínima: '+dato(a.carga?.min)+' · Media: '+dato(a.carga?.media)+' · Máxima: '+dato(a.carga?.max)+'</p></div></div>'+aviso(d)+
      '<div class="kstats" id="kstats">'+(D.avisos.length?'<p class="st-note">'+D.avisos.map(esc).join(' ')+'</p>':'')+SateUI.indicadoresTrayectoria(D,{esc,fmtCr,info,SATE})+
      '<div class="charts"><figure class="ch-wide"><figcaption><b>Tu camino en la carrera'+(simular?' · simulado':'')+'</b>'+SateUI.leyendaGrafica([['cuadro','var(--accent)','Acreditado'],['rayado','var(--accent)',simular?'Simulado':'En curso'],['cuadro','var(--line)','Te falta'],['marca','var(--accent)','Estimado a tu ritmo']],esc)+'</figcaption><div id="ch-camino">'+camino+'</div></figure></div>'+
      '<details class="trayectoria-plegable" id="trayectoria-kardex"'+abierto('trayectoria-kardex')+'><summary>Tu kárdex por periodo<small>'+D.rows.length+' materias acreditadas</small></summary><div class="charts"><figure class="ch-wide"><figcaption>'+SateUI.leyendaGrafica([['grado','','Calificación'],['letra','E','Extraordinario'],['letra','T','ETS'],['letra','R','Recurse']],esc)+'</figcaption><div id="ch-kx">'+kardex+'</div></figure></div></details>'+escenario(D)+'</div>';
    if(D.avisos.length)console.debug('SATE genérico: cobertura de analítica',{unidad,materias:D.rows.length,periodos:D.porPer.length,avisos:D.avisos});
  }
  document.querySelector('.sate-controles').hidden=true;
  document.querySelector('.bar-top').hidden=true;
  document.body.setAttribute('data-sate-generico','true');
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-abrir-mapa]'))SATE.ir('mapa');
    if(e.target.closest?.('[data-demo-open]')){location.hash='#demo';location.reload()}
    const vista=e.target.closest?.('[data-mview]'), foco=e.target.closest?.('[data-vista]'), z=e.target.closest?.('[data-zoom]');
    if(vista){vistaMapa=vista.dataset.mview;mapa()}
    if(foco){pendientes=foco.dataset.vista==='pend';zoom=null;mapa()}
    if(z){const paso=+z.dataset.zoom;zoom=paso===0?null:Math.max(.2,Math.min(10,(zoom??escalaMapa(representacion(datos(alumno)).L))*(paso>0?1.2:1/1.2)));mapa()}
  });
  document.addEventListener('change',e=>{
    const t=e.target;
    if(t.id==='gen-sim'){simular=t.checked;trayectoria()}
    if(t.dataset?.genNota&&Number.isInteger(+t.value)&&+t.value>=6&&+t.value<=10){notas[t.dataset.genNota]=+t.value;trayectoria()}
    if(t.id==='gen-meta-periodos'&&Number.isSafeInteger(+t.value)&&+t.value>0){metaPeriodos=+t.value;trayectoria()}
    if(t.id==='gen-meta-promedio'&&+t.value>=6&&+t.value<=10){metaPromedio=+t.value;trayectoria()}
  });
  document.addEventListener('toggle',e=>{if(['trayectoria-kardex','trayectoria-escenario','gen-simulacion'].includes(e.target.id))secciones[e.target.id]=e.target.open},true);
  window.addEventListener('resize',()=>{if(SATE.actual?.pestana==='mapa')mapa()});
  function horario(){
    const H=alumno?.horario_inscrito||[];
    const all=H.map(([g,k,n,p,ses],i)=>Object.assign([null,null,null,g],{g,k,n,p,ses:(ses||[]).filter(([d,a,b])=>Number.isInteger(d)&&d>=0&&d<7&&Number.isFinite(a)&&Number.isFinite(b)&&a>=0&&b>a&&b<=1440),i}));
    const DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'], hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
    // La misma secuencia de tonos que Horarios, con índice estable por materia y no por grupo.
    const claves=[...new Set(all.map(c=>c.k))], hue=c=>(claves.indexOf(c.k)*137.508)%360;
    $('v-hor').innerHTML='<h2>Tu horario inscrito</h2><p class="muted">Horario del SAES · Solo lectura</p><div class="calwrap"><div id="cal" class="cal"></div></div><div class="summary"><table class="horario-inscrito"><caption>Materias inscritas</caption><thead><tr><th scope="col">Materia</th><th scope="col">Grupo</th><th scope="col">Profesor(es)</th><th scope="col">Días y horas</th></tr></thead><tbody>'+all.map(c=>'<tr style="--h:'+hue(c)+'"><td data-label="Materia"><span class="sw"></span><b>'+esc(c.n)+'</b><small>'+esc(c.k)+'</small></td><td data-label="Grupo">'+esc(c.g)+'</td><td data-label="Profesor(es)">'+esc(Array.isArray(c.p)?c.p.join(', '):c.p||'Profesor sin informar')+'</td><td data-label="Días y horas">'+(c.ses.length?c.ses.map(([d,a,b])=>DAYS[d]+' '+hm(a)+'–'+hm(b)).join('<br>'):'Sin horario informado')+'</td></tr>').join('')+'</tbody></table></div>';
    SateUI.cuadriculaHorario(all,{S:{weekend:false},slots:c=>c.ses,START:420,BLOCK:90,SLOT:30,SLOTPX:22,
      $:s=>document.querySelector(s),DAYS,hm,
      esc,hue,keyOf:c=>c.k,name:c=>c.n,profs:c=>Array.isArray(c.p)?c.p.join(', '):c.p||'',roomAt:()=>'',soloLectura:true});
  }
  SATE.presente={avisos(){}};
  SATE.pestana('mapa',{mostrar:mapa});SATE.pestana('trayectoria',{mostrar:trayectoria});
  SATE.pestana('horarios',{mostrar:horario});
  SATE.alumno=()=>alumno;
  if(!esDemo)IPNT.set('ipnt.unidad',unidad);
  SATE.nucleoListo({personal:()=>!!alumno,estado:{},renderTop:estado,renderAviso(){},
    store:{get(k,d){try{const v=(window.IPNT?.almacen||localStorage).getItem('hu.'+unidad+'.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set:(k,v)=>IPNT.set('hu.'+unidad+'.'+k,JSON.stringify(v))}}).catch(SATE.error);
})();
