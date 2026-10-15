// Parser real del Lector y entrada SATE real con DOM en memoria; sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=f=>readFileSync(f,'utf8'), lector=leer('tools/lector_saes.js');
const limpio=s=>s.replace(/<[^>]*>/g,'').trim();
// Doble de las tablas de estos fixtures: conserva caption, encabezados y título anterior.
function kardex(html) {
  const tablas=[];let fin=0;
  for(const m of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/g)){
    const anterior=html.slice(fin,m.index).match(/<h3>(.*?)<\/h3>/);
    const tabla={id:(m[1].match(/id="([^"]+)"/)||[])[1]||'',tagName:'TABLE',caption:m[2].includes('<caption>')?{textContent:limpio(m[2].match(/<caption>(.*?)<\/caption>/)[1])}:null,
      previousElementSibling:anterior?{tagName:'H3',textContent:anterior[1]}:null,rows:[]};
    for(const fila of m[2].matchAll(/<tr>([\s\S]*?)<\/tr>/g)){
      const cells=[...fila[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map(c=>({textContent:limpio(c[1])}));
      tabla.rows.push({cells,textContent:cells.map(c=>c.textContent).join(' '),closest:()=>tabla});
    }
    tablas.push(tabla);fin=m.index+m[0].length;
  }
  return {querySelectorAll:()=>tablas};
}
const parser=lector.slice(lector.indexOf('    var acred ='),lector.indexOf('    /* materias reprobadas'));
for(const [f,esperado] of [['titulos',{Z101:['Álgebra ficticia',1],Z301:['Control ficticio',3],Z401:['Laboratorio ficticio',4]}],
  ['sin_titulos',{Z101:['Álgebra ficticia',1],Z201:['Física ficticia',2]}]]){
  const c=vm.createContext({kx:kardex(leer('tests/fixtures/kardex_generico_'+f+'.html')),
    CLAVE:/^(?=[A-Z0-9]*\d)[A-Z][A-Z0-9]{2,6}$/i,clean:s=>String(s||'').replace(/\s+/g,' ').trim(),num:s=>{const n=String(s).match(/\d+(?:\.\d+)?/);return n?+n[0]:null}});
  vm.runInContext(parser,c);
  assert.deepEqual(JSON.parse(JSON.stringify(c.materias)),esperado);
  assert.deepEqual(JSON.parse(JSON.stringify(c.creditosMaterias)),{},'No confundir fecha o semestre con créditos');
  assert.equal(c.acred[0][0],'Z101');assert.equal(c.acred[0][1],8);
  assert.equal(c.semestreTitulo('SEGUNDO SEMESTRE'),2);assert.equal(c.semestreTitulo('TERCERO SEMESTRE'),3);
  assert.equal(c.semestreTitulo('NIVEL 5'),5);assert.equal(c.semestreTitulo('1'),1);assert.equal(c.semestreTitulo('Clave Materia'),null);
  assert.equal(c.semestreTitulo('NIVEL: 5'),5);assert.equal(c.semestreTitulo('1º SEMESTRE'),1);
}
{
  const html=leer('tests/fixtures/kardex_generico_titulos.html').replace('<th>Calificación</th>','<th>Calificación</th><th>Créditos</th>').replace('<td>8</td>','<td>8</td><td>7.5</td>');
  const c=vm.createContext({kx:kardex(html),CLAVE:/^(?=[A-Z0-9]*\d)[A-Z][A-Z0-9]{2,6}$/i,clean:s=>String(s||'').trim(),num:s=>{const n=String(s).match(/\d+(?:\.\d+)?/);return n?+n[0]:null}});
  vm.runInContext(parser,c);assert.deepEqual(JSON.parse(JSON.stringify(c.creditosMaterias)),{Z101:7.5});
  assert.equal(c.acred[0][1],8,'Conservar la calificación cuando hay columna opcional');
  const intermedia=leer('tests/fixtures/kardex_generico_titulos.html').replace('<th>Materia</th>','<th>Materia</th><th>Créditos</th>').replace('<td>Álgebra ficticia</td>','<td>Álgebra ficticia</td><td>7.5</td>');
  c.kx=kardex(intermedia);vm.runInContext(parser,c);
  assert.deepEqual(JSON.parse(JSON.stringify(c.creditosMaterias)),{Z101:7.5});
  assert.deepEqual(JSON.parse(JSON.stringify(c.acred[0])),['Z101',8,'25/1','ORD'],'Créditos entre nombre y fecha no desplaza evaluaciones');
}
const config=JSON.parse(leer('web/dist/sate/index.html').match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
// Ejecuta el Lector completo: los únicos GET son dobles de las cinco páginas de SAES.
for(const unidad of ['esimez','upiita','escom','upibi']){
  const nodos=new Map(), solicitudes=[];let copiado;
  const nodo=id=>{if(!nodos.has(id))nodos.set(id,{style:{},setAttribute(){},innerHTML:'',textContent:''});return nodos.get(id)};
  const document={getElementById:id=>id==='upiita-lector'?null:nodo(id),createElement:()=>nodo('lector'),body:{appendChild(){}}};
  const documento=(html='')=>{
    const tablas=kardex(html).querySelectorAll();
    const titulos=[...html.matchAll(/<span id="([^"]+)">(.*?)<\/span>/g)].map(m=>({id:m[1],tagName:'SPAN',textContent:m[2],closest:()=>null,querySelector:()=>null}));
    return {body:{textContent:limpio(html)},querySelector(s){
      if(s.includes('mainCopy_Lbl_Nombre'))return {textContent:'PERFIL FICTICIO'};
      if(s.includes('Lbl_Kardex'))return tablas.length?{}:null;
      return tablas.find(t=>s.includes(t.id)&&t.id)||null;
    },querySelectorAll(s){
      if(s==='table'||s.includes('Lbl_Kardex'))return tablas;
      if(s.includes('mainCopy_'))return [...titulos,...tablas];
      return [];
    }};
  };
  const estado=documento(leer('tests/fixtures/estado_generico.html'));
  // Orden de documento: cada título precede a su tabla, como en el SAES.
  const titulos=estado.querySelectorAll('[id*="mainCopy_"]').filter(e=>e.tagName==='SPAN'), tablas=estado.querySelectorAll('table');
  estado.querySelectorAll=()=>titulos.flatMap((t,i)=>[t,tablas[i]]);
  const docs={
    '/Alumnos/Reinscripciones/fichas_reinscripcion.aspx':documento(),
    '/Alumnos/boleta/kardex.aspx':documento(leer('tests/fixtures/kardex_generico_titulos.html')),
    '/Alumnos/boleta/Estado_Alumno.aspx':estado,
    '/Alumnos/Informacion_semestral/Horario_Alumno.aspx':documento(leer('tests/fixtures/horario_generico.html')),
    '/Academica/agenda_escolar.aspx':documento()
  };
  const c=vm.createContext({document,location:{hostname:'saes.'+unidad+'.ipn.mx'},navigator:{clipboard:{async writeText(t){copiado=t}}},
    DOMParser:class {parseFromString(t){return docs[t]}},alert(t){throw new Error(t)},
    fetch:async(path,op)=>{assert.equal(op.credentials,'same-origin');assert.equal(op.method,undefined);solicitudes.push(path);return {text:async()=>path}}});
  const fuente=lector.replace('__TOOL_URL__','https://ejemplo.invalid/upiita/horarios.html').replace('__LECTOR_VERSION__','version-ficticia')
    .replace('__LECTOR_UNIDADES__',JSON.stringify(Object.keys(config.unidades))).replace('__LECTOR_NOMBRES__',JSON.stringify(config.nombresUnidades));
  await vm.runInContext(fuente,c);
  assert.equal(typeof nodo('ul-copy').onclick,'function',nodo('lector').innerHTML);
  await nodo('ul-copy').onclick();const d=JSON.parse(copiado);
  assert.deepEqual(d.materias.Z101,['Álgebra ficticia',1]);
  assert.deepEqual(d.materias.Z301,['Control ficticio',3]);
  assert.deepEqual(d.materias.Z501,['Materia pendiente ficticia',5]);
  assert.deepEqual(d.materias.Z601,['Materia desfasada ficticia',6]);
  assert.deepEqual(d.materias.Z202,['Circuitos ficticios',null]);
  assert.deepEqual(d.en_curso,['Z202']);assert.equal(d.unidad,unidad);assert.equal(d.lector,'version-ficticia');
  assert.deepEqual(d.acreditadas,[['Z101',8,'25/1','ORD'],['Z401',9,'26/2','ETS']]);
  assert.deepEqual(d.kardex_reprobadas,[['Z301',5,'26/1','ORD']]);
  assert.deepEqual(d.desfasadas_saes,[['Z601','25/1',2,6]]);
  assert.equal(solicitudes.length,5);
}
const perfil={upiita_saes:1,unidad:'esimez',leido:'2026-10-07T12:00:00Z',carrera_nombre:'Ingeniería ficticia',
  acreditadas:[['Z101',8,'25/1','ORD']],kardex_reprobadas:[['Z201',5,'25/2','ORD']],
  reprobadas_periodo:[['Z201','25/2',1,2]],desfasadas_saes:[['Z301','25/1',1,3]],no_cursadas:[['Z401',null,0,4]],
  en_curso:['Z202'],horario_inscrito:[['DEMO','Z202','Circuitos ficticios','Docente ficticio',[]]],
  materias:{Z101:['Álgebra ficticia',1],Z201:['Física ficticia',2],Z202:['Circuitos ficticios',2],Z301:['Control ficticio',3],Z401:['Laboratorio ficticio',4]},
  promedio:8,carga:{total:300,min:20,media:40,max:60,duracion:8,duracion_max:12},avance:{obtenidos:30,faltan:270,cursados:2}};
const vaciar=async()=>{for(let i=0;i<16;i++)await new Promise(r=>setImmediate(r))};
const generico=leer('web/sate/generico.js');
const fabrica=vm.createContext({unidad:'encb'});
vm.runInContext(generico.slice(generico.indexOf('  function demo('),generico.indexOf('  window.SateGenerico')),fabrica);
const encb=JSON.parse(JSON.stringify(fabrica.demo())), encbHorario=JSON.parse(JSON.stringify(fabrica.demo(true)));
assert.equal(Object.keys(encb.materias).length,45);assert.equal(encb.acreditadas.length,37);assert.equal(encb.no_cursadas.length,8);
assert.ok(encb.no_cursadas.every(r=>r[3]>=7));assert.equal(encb.en_curso.length,0);
assert.deepEqual([...new Set(encb.acreditadas.map(r=>r[3]))].sort(),['ETS','EXT','ORD','REC']);
assert.equal(encbHorario.en_curso.length,5);assert.equal(encbHorario.horario_inscrito.length,5);
for(const a of [encb,encbHorario]){
  const kardex=[...a.acreditadas,...a.kardex_reprobadas], periodos=[...new Set(kardex.map(r=>r[2]))].sort();
  assert.deepEqual(periodos,['23/2','24/1','24/2','25/1','25/2','26/1']);
  assert.equal(periodos.length,a.avance.cursados,'Periodos cursados = periodos distintos del kárdex');
  for(const p of periodos){
    const n=kardex.filter(r=>r[2]===p).length;
    assert.ok(n>=5&&n<=8,p+': entre 5 y 8 evaluaciones, incluidas las reprobadas');
  }
  assert.ok(new Set(a.acreditadas.map(r=>r[1])).size>=4,'Histograma con al menos cuatro notas distintas');
  assert.ok(a.acreditadas.every(r=>r[1]>=6&&r[1]<=10));
  for(const [forma,n] of [['EXT',2],['ETS',1],['REC',1]])assert.equal(a.acreditadas.filter(r=>r[3]===forma).length,n,forma);
  const recurse=a.acreditadas.find(r=>r[3]==='REC'), previa=a.kardex_reprobadas.find(r=>r[0]===recurse[0]);
  assert.ok(previa&&previa[1]>=0&&previa[1]<=5&&previa[2]<recurse[2],'Recurse después de un intento reprobado');
  const media=kardex.reduce((s,r)=>s+r[1],0)/kardex.length;
  assert.equal(a.promedio,Math.round(media*100)/100,'Promedio SAES incluye las reprobadas 0–5 y se redondea a centésimas');
  const cr=periodos.map(p=>a.acreditadas.filter(r=>r[2]===p).reduce((s,r)=>s+a.creditos_materias[r[0]],0));
  assert.ok(new Set(cr).size>=4,'Créditos por periodo variables');
  assert.equal(cr.reduce((s,n)=>s+n,0),a.avance.obtenidos);
  assert.equal(a.avance.obtenidos+a.avance.faltan,a.carga.total);
}
assert.deepEqual(encbHorario.acreditadas,encb.acreditadas,'El horario no cambia el historial de seis periodos');
assert.deepEqual(encbHorario.kardex_reprobadas,encb.kardex_reprobadas);
assert.ok(encbHorario.en_curso.every(k=>!encbHorario.acreditadas.some(r=>r[0]===k)),'Inscritas pendientes para el siguiente periodo 26/2');
for(const ancho of [1440,375])for(const modo of ['actual','viejo','periodos','vacio','encb','encb-horario','encb-viejo','encb-curso-sin-horario','demo','demo-horario']){
  const unidad=modo.startsWith('encb')||modo.startsWith('demo')?'encb':'esimez';
  const p=structuredClone(unidad==='encb'?(modo.endsWith('horario')?encbHorario:encb):perfil);
  if(modo==='encb-curso-sin-horario'){Object.assign(p,structuredClone(encbHorario));p.horario_inscrito=[];}
  if(modo==='viejo'||modo==='periodos'||modo==='encb-viejo')delete p.materias;
  if(modo==='periodos'){p.no_cursadas=[['Z401',null,0,null]];p.reprobadas_periodo=p.reprobadas_periodo.map(r=>r.slice(0,3));p.desfasadas_saes=[];}
  const almacen=new Map(modo==='vacio'||modo.startsWith('demo')?[]:[['saes.alumno',JSON.stringify(p)]]),nodos=new Map(),archivos=[],eventos={};let c;
  function nodo(id=''){return {id,hidden:false,textContent:'',innerHTML:'',style:{setProperty(k,v){this[k]=v}},dataset:{},children:[],
    clientWidth:ancho,classList:{toggle(){}},setAttribute(){},getAttribute(){return null},removeAttribute(){},addEventListener(){},replaceChildren(){this.children=[]},focus(){document.activeElement=this},remove(){},prepend(n){this.children.unshift(n)},appendChild(n){this.children.push(n)},
    querySelector:s=>nodo(s),querySelectorAll:()=>[],closest:()=>null};}
  const buscarId=(n,id)=>n.id===id?n:n.children.map(h=>buscarId(h,id)).find(Boolean);
  const document={readyState:'loading',documentElement:{getAttribute(){return null},setAttribute(){},style:{setProperty(){},removeProperty(){}}},addEventListener(k,f){(eventos['dom:'+k]??=[]).push(f)},getElementById(id){for(const n of nodos.values()){const encontrado=buscarId(n,id);if(encontrado)return encontrado}if(!nodos.has(id))nodos.set(id,nodo(id));return nodos.get(id)},
    querySelector:s=>document.getElementById(s),querySelectorAll:()=>[],createElement:tag=>Object.assign(nodo(),{tagName:tag}),createElementNS:(_,tag)=>Object.assign(nodo(),{tagName:tag}),body:nodo(),head:{appendChild(s){
      if(!s.src)return;archivos.push(s.src);setImmediate(()=>{vm.runInContext(leer('web/dist/sate/'+s.src),c,{filename:s.src});s.onload()});
    }}};
  const location={hash:modo.startsWith('demo')?'#'+modo:'',search:'?sateUnidad='+unidad,pathname:'/sate/index.html'};
  c=vm.createContext({console:{...console,debug(){}},URL,URLSearchParams,document,location,SATE_CONFIG:structuredClone(config),setTimeout,clearTimeout,
    localStorage:{getItem:k=>almacen.get(k)??null,setItem:(k,v)=>almacen.set(k,v)},navigator:{userAgent:'Node',connection:{saveData:true}},
    addEventListener:(k,f)=>eventos[k]=f,history:{replaceState(a,b,url){location.hash=url.slice(url.indexOf('#'))}},
    fetch(){throw new Error('SATE genérico no descarga datos de planes')},
    SateUI:{usarTextos(){},usarAlmacen(){},cerrarModal(){},pestanas(o){const n=nodo();n.seleccionar=()=>{};return n},barraInferior(){return {marcar(){}}}}});
  vm.runInContext('window=globalThis',c);
  const doblesUI=c.SateUI;
  vm.runInContext(leer('web/dist/sate/componentes.js'),c);
  Object.assign(c.SateUI,doblesUI);
  for(const f of ['rutas.js','inicio.js'])vm.runInContext(leer('web/sate/'+f),c,{filename:f});
  await vaciar();
  assert.equal(c.SATE_UNIDAD,unidad);
  assert.equal(c.SATE_CONFIG.unidades[unidad].nombre,config.identidadUnidades[unidad].nombre,'Nombre completo de la unidad genérica');
  assert.deepEqual(c.SATE_CONFIG.unidades[unidad].realce,config.identidadUnidades[unidad].realce,'Realce institucional conservado');
  const hayHorario=modo!=='vacio'&&p.horario_inscrito.length>0;
  assert.deepEqual([...c.SATE_CONFIG.unidades[unidad].pestanas],['trayectoria','mapa','calendario',...(hayHorario?['horarios']:[])].filter(t=>!(config.pestanasOcultas||[]).includes(t)));
  assert.deepEqual(archivos,['generico.js']);
  assert.equal(c.SATE.actual.pestana,modo==='vacio'?'mapa':'trayectoria');
  const tray=document.getElementById('sate-trayectoria');
  if(modo!=='vacio'){
    assert.ok(tray.innerHTML.includes('Promedio del SAES: '+p.promedio));assert.match(tray.innerHTML,/Duración máxima: 12/);
    assert.match(tray.innerHTML,/<div class="trayectoria-datos"><p>[^<]+<\/p><p>Promedio del SAES:/,'Estado y datos agrupados, sin filas separadas por el minimapa');
    assert.match(tray.innerHTML,/class="kx-c g8"/);assert.doesNotMatch(tray.innerHTML,/NaN|undefined|Sugerida|Sin área/);
    for(const componente of ['Promedio sin reprobadas','k-regla','Tus calificaciones','k-hist','En ordinario','k-anillo','Créditos por periodo','Tu camino en la carrera','cm-track','Tu kárdex por periodo','trayectoria-kardex','¿Y si…?','meta-panel','id="sate-presente"','trayectoria-minimapa'])assert.ok(tray.innerHTML.includes(componente),componente+' a '+ancho+' px');
    assert.doesNotMatch(tray.innerHTML,/trayectoria-areas|trayectoria-observaciones|Tus áreas|seriación|oferta/);
    assert.equal(/id="trayectoria-kardex" open/.test(tray.innerHTML),ancho>720,'Kárdex abierto en escritorio y plegado en teléfono');
    assert.equal(/id="trayectoria-escenario" open/.test(tray.innerHTML),ancho>720,'Escenario sigue el mismo acomodo responsive');
    if(unidad==='encb')for(const componente of ['k-bars','cm-m pas','cm-m fut','Terminarías','<i>E</i>','<i>T</i>'])assert.ok(tray.innerHTML.includes(componente),componente);
    const D=c.SateGenerico.estadisticas(p,c.SateGenerico.datos(p));
    assert.equal(D.media,p.acreditadas.reduce((s,r)=>s+r[1],0)/p.acreditadas.length);assert.ok(D.rows.every(r=>r.cal>=6&&r.cal<=10));
    if(unidad==='encb'){
      assert.equal(D.porPer.length,6);assert.equal(D.curva.length,6,'Tu camino tiene marcas de los seis periodos');
      assert.equal(D.curva.at(-1).acum,p.avance.obtenidos);
      assert.equal(D.meta,26*2+1,'Siguiente periodo en curso: 26/2');
      assert.equal((tray.innerHTML.match(/class="cm-m pas/g)||[]).length,6);
      for(const periodo of ['23/2','24/1','24/2','25/1','25/2','26/1'])assert.ok(tray.innerHTML.includes('title="'+periodo+':'),periodo+' en Tu camino');
      assert.match(tray.innerHTML,/<i>R<\/i>/);
    }
    const repetido=c.SateGenerico.estadisticas({...p,acreditadas:[...p.acreditadas,p.acreditadas[0]]},c.SateGenerico.datos(p));
    assert.equal(repetido.rows.length,D.rows.length,'Una acreditación por clave');
    if(modo==='actual')assert.equal(D.ritmo,null,'No inferir créditos por materia');
    const invalido=c.SateGenerico.estadisticas({...p,acreditadas:[...p.acreditadas,['INVALIDA',null,'26/1','ORD'],['INVALIDA2',11,'26/1','ORD']]},c.SateGenerico.datos(p));
    assert.equal(invalido.rows.length,D.rows.length,'Excluir notas inválidas');
    const equivalencia=structuredClone(p);equivalencia.acreditadas[0][3]='EQV';
    const De=c.SateGenerico.estadisticas(equivalencia,c.SateGenerico.datos(equivalencia));
    assert.equal(De.formasExcluidas,D.formasExcluidas+1);assert.ok(!De.porPer.length||De.porPer.reduce((s,r)=>s+r.n,0)===D.rows.length-1,'Equivalencias fuera del ritmo');
    const inconsistente=c.SateGenerico.estadisticas({...p,avance:{...p.avance,obtenidos:999}},c.SateGenerico.datos(p));
    assert.equal(inconsistente.fin,null);assert.equal(inconsistente.curva.length,0);
    if(hayHorario){
      const original=JSON.stringify(c.SATE.alumno()), cambio=t=>eventos['dom:change'].forEach(f=>f({target:t}));
      cambio({id:'gen-sim',checked:true});assert.match(tray.innerHTML,/simulado/);
      cambio({dataset:{genNota:p.horario_inscrito[0][1]},value:'10'});assert.match(tray.innerHTML,/kx-c g10 sim/);
      assert.equal(JSON.stringify(c.SATE.alumno()),original,'La simulación conserva el SAES en memoria');
      cambio({id:'gen-sim',checked:false});assert.doesNotMatch(tray.innerHTML,/kx-c g10 sim/);
    }
    if(modo==='viejo')assert.match(tray.innerHTML,/Actualiza tus datos con el marcador SATE/);
    if(modo==='actual')assert.match(tray.innerHTML,/Álgebra ficticia/);
  }
  location.hash='#/'+unidad+'/mapa';eventos.hashchange();await vaciar();
  const mapa=document.getElementById('v-tray').innerHTML+document.getElementById('mapwrap').innerHTML;
  assert.match(mapa,/Mapa curricular/);
  if(modo==='actual'){assert.match(mapa,/Semestre 1/);assert.match(mapa,/Semestre 4/);assert.match(mapa,/Desfasada según el SAES/);assert.match(mapa,/En curso/);}
  if(modo==='actual')for(const st of ['done','curso','fail','late','']){
    assert.equal((mapa.match(new RegExp('class="box '+st+'"','g'))||[]).length,1,'Una caja por estado SAES: '+st);
  }
  if(modo==='periodos'){assert.match(mapa,/Periodo 25\/1/);assert.match(mapa,/Por cursar/);}
  if(modo==='vacio')assert.match(mapa,/Traer mis datos del SAES/);
  assert.equal(c.SateGenerico.datos({...perfil,desfasadas_saes:[],reprobadas_periodo:[['Z201','10/1',10,2]]}).materias.find(m=>m.clave==='Z201').estado,'Reprobada','La antigüedad no inventa desfase');
  assert.equal(c.SateGenerico.datos({...perfil,reprobadas_periodo:null,reprobadas:[['FÍSICA FICTICIA',20]]}).materias.find(m=>m.clave==='Z201').estado,'Reprobada','Reprobadas de la cita si no se leyó Estado General');
  if(!(config.pestanasOcultas||[]).includes('calendario')){
  location.hash='#/'+unidad+'/calendario';eventos.hashchange();await vaciar();
  assert.equal(c.SATE.actual.pestana,'calendario');
  assert.equal(document.getElementById('sate-calendario').hidden,false);
  assert.equal(archivos.filter(a=>a==='calendario.js').length,1);
  assert.ok(c.SATE.calendario.eventos().some(e=>e.categoria==='inicio'));
  const buscar=(n,clase)=>n.children?.some(h=>h.className===clase||buscar(h,clase));
  assert.ok(buscar(document.getElementById('sate-calendario'),'calendario-mes'));
  document.getElementById('cal-vista-carriles').onclick();
  assert.ok(buscar(document.getElementById('sate-calendario'),'calendario-linea'));
  assert.equal(c.SATE.almacen.get('cal.vista'),'carriles','Recuerdo también sin plan cargado');
  document.getElementById('cal-vista-semicirculo').onclick();
  assert.equal(c.SATE.calendario.eventos().filter(e=>e.audiencia.includes('nuevo_ingreso')).length,modo==='vacio'?7:0);
  }
  const rutaHor=c.SateRutas.ruta('#/'+unidad+'/horarios',unidad,c.SATE_CONFIG.unidades);
  assert.equal(!!rutaHor,hayHorario);
  if(modo!=='vacio'){
    for(const componente of ['class="maptools"','data-mview="mapa"','data-mview="lista"','data-zoom="-1"','Mapa completo','data-zoom="1"','class="legend"','class="mapcut"','Tu avance','data-vista="pend"','Ya acreditada'])assert.ok(mapa.includes(componente),componente);
    assert.match(mapa,/class="mapwrap"/);assert.match(mapa,/data-estado="done"/);assert.match(mapa,/<circle/);
    assert.doesNotMatch(mapa,/data-box|role="button"|data-gap|data-lwant|sug-tgl|Agregar sugeridas|sin grupos|seriación|oferta/);
    assert.match(tray.innerHTML,/data-abrir-mapa/);
    const click=(selector,dataset)=>eventos['dom:click'].forEach(f=>f({target:{closest:s=>s===selector?{dataset}:null}}));
    click('[data-mview]',{mview:'lista'});assert.match(document.getElementById('v-tray').innerHTML,/id="mapwrap" hidden/);
    click('[data-mview]',{mview:'mapa'});
    click('[data-vista]',{vista:'pend'});assert.doesNotMatch(document.getElementById('mapwrap').innerHTML,/class="box done"/);
    click('[data-vista]',{vista:'todo'});assert.match(document.getElementById('mapwrap').innerHTML,/class="box done"/);
    const antes=document.getElementById('mapwrap').innerHTML;
    const anchoMapa=+antes.match(/width:([\d.]+)px/)[1];
    if(ancho===1440)assert.ok(Math.abs(anchoMapa-(ancho-2))<.01,'Mapa completo ocupa el ancho disponible');
    click('[data-zoom]',{zoom:'1'});assert.notEqual(document.getElementById('mapwrap').innerHTML,antes);
    click('[data-zoom]',{zoom:'0'});assert.equal(document.getElementById('mapwrap').innerHTML,antes);
  }
  if(unidad==='encb'){
    assert.equal((mapa.match(/class="box /g)||[]).length,45);
    assert.equal((mapa.match(/class="box done"/g)||[]).length,37);
    assert.equal((mapa.match(/class="box curso"/g)||[]).length,p.en_curso.length);
    assert.equal((mapa.match(/<circle data-estado="done"/g)||[]).length,37);
    if(modo!=='encb-viejo')for(let s=1;s<=8;s++)assert.match(mapa,new RegExp('Semestre '+s));
    if(modo.startsWith('demo'))assert.equal(almacen.has('saes.alumno'),false,'Demo no persiste el perfil');
  }
  if(hayHorario){
    location.hash=rutaHor.hash;eventos.hashchange();await vaciar();
    const hor=document.getElementById('v-hor').innerHTML;
    assert.match(hor,/Tu horario inscrito/);assert.match(hor,/Solo lectura/);assert.match(hor,/Docente ficticio/);
    assert.match(hor,/<table class="horario-inscrito">/);
    for(const etiqueta of ['Materia','Grupo','Profesor(es)','Días y horas'])assert.ok(hor.includes('data-label="'+etiqueta+'"'));
    const cal=document.querySelector('#cal').innerHTML;
    assert.doesNotMatch(hor+cal,/data-gap|data-k=|<button|oferta|Agregar|Generar|undefined/);
    if(unidad==='encb'){assert.equal((cal.match(/class="blk/g)||[]).length,5);assert.match(cal,/7FV1/);assert.match(cal,/07:00/);assert.match(cal,/--h:137\.508/);assert.match(hor,/Lun 07:00–08:30/);}
    assert.equal(document.getElementById('sate-oferta-periodo').hidden,true);
    assert.equal(document.getElementById('notice').hidden,true);
  }
  // Callback real del adaptador: cargar con horario, sustituir sin horario y borrar datos.
  vm.runInContext('SAES.wire=fn=>{globalThis.recargar=fn}',c);
  const cargarScript=c.SATE.script;c.SATE.script=async()=>{};
  await vm.runInContext('SAES.open()',c);c.SATE.script=cargarScript;
  c.recargar({...structuredClone(encbHorario),unidad});await vaciar();
  assert.ok(c.SATE_CONFIG.unidades[unidad].pestanas.includes('horarios'));
  location.hash='#/'+unidad+'/horarios';eventos.hashchange();await vaciar();
  c.recargar({...structuredClone(encb),unidad});await vaciar();
  assert.equal(c.SATE.actual.pestana,'trayectoria');
  assert.equal(document.getElementById('v-hor').hidden,true);
  assert.ok(!c.SATE_CONFIG.unidades[unidad].pestanas.includes('horarios'));
  c.recargar(null);await vaciar();
  assert.match(tray.innerHTML,/Traer mis datos del SAES/);
  assert.doesNotMatch(tray.innerHTML,/Calificación|<circle|<progress/);
  assert.ok(!archivos.includes('nucleo.js'));
}
const css=leer('web/sate/componentes.css'), shell=leer('web/sate/cascaron.html');
assert.match(css,/@media\(max-width:720px\)\{\.horario-inscrito/);
assert.doesNotMatch(css,/\[data-sate-generico\] \.trayectoria-minimapa\{/,'Sin sustituir el acomodo compartido');
assert.match(css,/\.trayectoria-datos\{[^}]*grid-column:1;grid-row:2 \/ span 4;align-self:start;display:grid;gap:\.35rem/);
assert.match(css,/\.trayectoria-datos p\{margin:0;line-height:1\.6\}/);
assert.match(css,/@media\(max-width:720px\)\{\.trayectoria-datos\{grid-row:3\}\}/);
const acreditada=shell.match(/\.box\.done\{([^}]+)\}/)[1];
assert.match(acreditada,/opacity:1/);assert.match(acreditada,/color:var\(--fg\)/);assert.match(acreditada,/background:var\(--surface\)/);
assert.doesNotMatch(acreditada,/line-through/,'Contrato de contraste: texto sin tachado ni opacidad reducida');
const luminancia=hex=>{const v=hex.match(/\w\w/g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]};
const superficies=[...shell.matchAll(/--surface:(#[a-f0-9]{6})/g)].map(m=>m[1]), textos=[...shell.matchAll(/--fg:(#[a-f0-9]{6})/g)].map(m=>m[1]);
assert.equal(superficies.length,textos.length);
superficies.forEach((f,i)=>{const a=luminancia(f.slice(1)),b=luminancia(textos[i].slice(1));assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,'Acreditadas: contraste AA en tema '+i)});
const componentes=leer('web/sate/componentes.js'), desempeno=leer('web/sate/desempeno.js');
// Regresiones de la fusión: el adaptador especializado usa los mismos componentes que el genérico.
{
  const c=vm.createContext({document:{addEventListener(){}},addEventListener(){}});vm.runInContext(componentes,c);
  const UI=c.SateUI, esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;');
  const S={planPaso:1,mapHover:'A',reqHover:['B']},hot=new Set(['A','B']);hot.pre=new Set(['A']);hot.post=new Set(['B']);
  const ctx={cur:()=>({A:['Materia A',4,1],B:['Materia B',4,2]}),statusOf:()=>'',planAsignado:k=>k==='A'?0:null,
    isElec:()=>false,MARK:{avail:new Set(),sug:new Set()},S,fmtCr:String,porNiveles:()=>false,esc,
    SATE:{texto:(k,v)=>v.periodo},PLAN_DOS_PERIODOS:true,planEtiqueta:p=>['26/2','27/1'][p]};
  const caja=k=>UI.cajaMateria(ctx,k,0,0,100,50,1,new Set(),new Set(['A','B']),hot,1,new Set(['B']));
  assert.match(caja('A'),/plan-otra/);assert.match(caja('A'),/hpre/);
  assert.match(caja('A'),/aria-pressed="false"/);assert.match(caja('A'),/>en 26\/2<\/span>/);
  assert.match(caja('B'),/req hpost/);assert.match(caja('B'),/conviene cursarla antes/);
  S.planPaso=0;assert.match(caja('A'),/aria-pressed="true"/);assert.doesNotMatch(caja('A'),/plan-otra/);
  const cal={style:{setProperty(){}},innerHTML:''};
  const propios=[{own:true,i:2,n:'Trabajo ficticio',tipo:'trabajo',h:[[0,480,540]]},
    {own:true,n:'Traslado ficticio',h:[[0,420,480]]},{own:true,i:3,n:'Solo horas',oculto:true,h:[[6,0,1440]]}];
  const op={S:{weekend:false,gap:{d:0,a:420}},slots:c=>c.h,START:420,BLOCK:90,SLOT:30,SLOTPX:22,
    $:()=>cal,DAYS:['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],hm:String,esc,txH:(k,v)=>v.nombre||k};
  const items=UI.cuadriculaHorario(propios,op);
  assert.equal(items.length,2);assert.match(cal.innerHTML,/Traslado ficticio/);
  assert.match(cal.innerHTML,/data-tipo="trabajo" data-own="2" tabindex="0" role="button"/);
  assert.match(cal.innerHTML,/class="gapcell on"/);assert.doesNotMatch(cal.innerHTML,/Solo horas|data-own="3"/);
  UI.cuadriculaHorario(propios,{...op,soloLectura:true});assert.doesNotMatch(cal.innerHTML,/data-own|data-gap|role="button"/);
  for(const nombre of ['cajaMateria','cuadriculaHorario'])assert.ok(generico.includes('SateUI.'+nombre),nombre+' compartido');
}
for(const componente of ['indicadoresTrayectoria','fichasKardex','caminoTrayectoria','leyendaGrafica']){
  assert.ok(componentes.includes('function '+componente));
  assert.ok(desempeno.includes('SateUI.'+componente));assert.ok(generico.includes('SateUI.'+componente));
}
assert.match(css,/\[data-sate-generico\] #v-tray[^}]*min-width:0;max-width:100%/);
assert.match(css,/\[data-sate-generico\] \.mapwrap[^}]*max-width:100%;min-width:0/);
assert.match(shell,/\.mapwrap\{[^}]*overflow:auto/);
assert.match(shell,/\.calwrap\{overflow-x:auto/);
// Destino del Lector: contrato de los tres enlaces existentes y la unidad genérica.
const destino=lector.slice(lector.indexOf('  if (TOOL) TOOL ='),lector.indexOf('  // claves:'));
for(const u of ['upiita','escom','upibi','esimez']){
  const c=vm.createContext({TOOL:'https://ejemplo.invalid/upiita/horarios.html',UNIDAD:u,__LECTOR_UNIDADES__:Object.keys(config.unidades)});
  vm.runInContext(destino,c);
  assert.equal(c.TOOL,'https://ejemplo.invalid/upiita/'+(u==='esimez'?'sate/index.html?sateUnidad=esimez':'horarios-'+u+'.html'));
}
console.log('SATE genérico: Lector, analítica y componentes compartidos, simulación sin persistencia, mapa/lista/zoom/pendientes, horario compacto y contraste AA; DOM a 1440 y 375 px, sin navegador ni red.');
