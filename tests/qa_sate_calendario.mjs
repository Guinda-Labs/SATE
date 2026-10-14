// Integración local con DOM en memoria; no abre navegador ni transmite datos.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(p,'utf8'), data=JSON.parse(leer('data/calendario.json'));
const config=JSON.parse(leer('web/dist/sate/index.html').match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
const base=JSON.parse(leer('data/calendario_ipn.json'));
assert.deepEqual(config.calendarioBase,base);
for(const u of ['upiita','escom','upibi']) assert.ok(config.unidades[u].pestanas.includes('calendario'));
assert.equal(leer('web/dist/sate/index.html').split('"ciclo":"2026-2027"').length,2,'Base inyectada una vez');
for(const e of [...base.eventos,...data.upiita.actividades,...data.upiita.eventos]){
  for(const f of [e.desde,e.hasta]){assert.match(f,/^\d{4}-\d{2}-\d{2}$/);assert.equal(new Date(f+'T00:00:00Z').toISOString().slice(0,10),f)}
  assert.ok(e.desde<=e.hasta);assert.ok(e.titulo&&e.simbolo&&e.audiencia.length);
}
class Nodo{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.style={};this.listeners={};this.scrollWidth=640;this.clientWidth=300;this.scrollLeft=0}
  appendChild(n){this.children.push(n);n.parent=this;return n}
  addEventListener(k,fn){this.listeners[k]=fn}
  querySelector(s){return this.all().find(n=>n.className?.split(' ').includes(s.slice(1)))||null}
  querySelectorAll(){return this.all().filter(n=>n.tagName==='button'||n.tagName==='summary'||n.tagName==='a'&&n.getAttribute('href'))}
  insertBefore(n,antes){this.children.splice(antes?this.children.indexOf(antes):0,0,n);n.parent=this;return n}
  get firstChild(){return this.children[0]}
  remove(){this.parent.children=this.parent.children.filter(n=>n!==this)}
  replaceChildren(){this.children=[];this.text=''}
  removeAttribute(k){delete this.attrs[k]}
  set textContent(t){this.text=String(t)}get textContent(){return (this.text||'')+this.children.map(n=>n.textContent).join(' ')}
  setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]}
  focus(){document.activeElement=this}
  all(){return this.children.flatMap(n=>[n,...n.all()])}
}
const paneles=Object.fromEntries(['v-hor','v-tray','sate-trayectoria'].map(id=>[id,new Nodo('section')]));
const box=new Nodo('section'), document={addEventListener(){},createElement:t=>new Nodo(t),createElementNS:(_,t)=>new Nodo(t),getElementById:id=>paneles[id]|| (id==='sate-calendario'?box:box.all().find(n=>n.id===id))};
const SATE={modulos:{},texto:(k,v={})=>(config.textos[k]||k).replace(/\{(\w+)\}/g,(_,k)=>v[k]??'{'+k+'}'),pestana(id,m){this.modulos[id]=m}};

const c=vm.createContext({SATE,DATA:{calendario:data.upiita},SATE_CONFIG:config,SATE_UNIDAD:'upiita',document,console,
  perMeta:()=>0,perName:()=> '27/1',isPersonal:()=>false,conSim:(_,fn)=>fn(),tr:()=>({fail:[]})});
const nucleo=leer('web/dist/sate/nucleo.js');
// El almacén real conserva la ruta IPNT.set; sólo el medio de almacenamiento es ficticio.
const almacen=new Map(),escrituras=[];
c.HU='hu.';c.DEMO=false;c.ALM={getItem:k=>almacen.get(k)??null};
c.IPNT={set(k,v){escrituras.push([k,v]);almacen.set(k,v)}};
vm.runInContext(nucleo.slice(nucleo.indexOf('const store='),nucleo.indexOf('\n',nucleo.indexOf('const store='))),c);
SATE.almacen=vm.runInContext('store',c);
vm.runInContext(nucleo.slice(nucleo.indexOf('SATE.calendario={'),nucleo.indexOf('let CALAP=')),c);
const api=SATE.calendario;api.hoy=()=> '2026-10-20';
const e=(categoria,desde,extra={})=>({categoria,desde,hasta:desde,periodo:'27/1',titulo:categoria,audiencia:['alumnos'],simbolo:'relleno',...extra});
const pruebaBase={fuente:'Calendario académico IPN',eventos:[e('inicio','2026-08-24'),e('descanso','2026-09-16'),e('descanso','2026-11-16')]};
const local={periodo:'27/1',fuente:'Aviso ficticio',actividades:[e('gestion','2026-10-07')],eventos:[e('inicio','2026-10-19',{reemplaza:true}),e('descanso','2026-11-16',{reemplaza:true})]};
const fusion=api.fusion(pruebaBase,local);
assert.equal(fusion.length,4);assert.ok(!fusion.some(e=>e.desde==='2026-08-24'));
assert.ok(fusion.some(e=>e.desde==='2026-09-16'&&e.origen==='ipn'),'Un descanso no borra los restantes');
assert.equal(fusion.filter(e=>e.desde==='2026-11-16').length,1);
assert.ok(fusion.some(e=>e.categoria==='gestion'&&e.origen==='unidad'));
assert.equal(api.fusion(pruebaBase,null).length,3);
assert.equal(api.fusion(null,local).length,3);
c.SATE_CONFIG={...config,calendariosUnidad:{encb:local}};c.SATE_UNIDAD='encb';c.DATA.calendario=null;
assert.ok(api.eventos().some(e=>e.desde==='2026-10-19'&&e.origen==='unidad'),'Aviso de unidad sin plan');
c.SATE_CONFIG=config;c.SATE_UNIDAD='upiita';c.DATA.calendario=data.upiita;
const audiencias=['alumnos','nuevo_ingreso','docentes','posgrado','nms'].map(a=>e('gestion','2026-10-01',{audiencia:[a]}));
assert.equal(api.filtrarAudiencia(audiencias).length,2);
assert.equal(api.filtrarAudiencia(audiencias,false,{avance:{cursados:1}}).length,2);
assert.equal(api.filtrarAudiencia(audiencias,false,{avance:{cursados:2}}).length,1);
assert.equal(api.filtrarAudiencia(audiencias,true,{avance:{cursados:2}}).length,4);
assert.equal(api.filtrarAudiencia(audiencias,true).length,5);
const mixto=e('inicio','2026-08-24',{audiencia:['nuevo_ingreso','alumnos']});
assert.equal(api.fusion({eventos:[mixto]}, {periodo:'27/1',eventos:[{...mixto,desde:'2026-10-19',audiencia:['alumnos','nuevo_ingreso'],reemplaza:true}]}).length,1,'Orden de audiencias no altera el reemplazo');
assert.equal(api.eventos().filter(e=>e.categoria==='inicio'&&e.periodo==='27/1').length,1);
assert.equal(api.eventos().find(e=>e.categoria==='inicio'&&e.periodo==='27/1').desde,'2026-10-19');
assert.equal(api.eventos().find(e=>e.categoria==='fin'&&e.periodo==='27/1').desde,'2027-02-15');
assert.ok(!api.eventos(true).some(e=>e.origen==='ipn'&&data.upiita.periodosPropios.includes(e.periodo)),'UPIITA no hereda procesos del calendario incompatible');
for(const p of ['26/2','27/1','27/2'])assert.ok(api.eventos().filter(e=>e.categoria==='ets'&&e.periodo===p).every(e=>e.origen==='unidad'&&e.fuenteOriginal.includes('Gestión Escolar UPIITA')));
assert.deepEqual(Array.from(api.eventos().filter(e=>e.categoria==='ets'&&e.periodo==='26/2').map(e=>[e.desde,e.hasta])),[['2026-10-07','2026-10-09'],['2026-10-12','2026-10-12']]);
assert.deepEqual(data.upiita.eventos.filter(e=>e.verificar).map(e=>e.desde),['2026-02-27']);
// CAL8: correcciones del dueño sin heredar fechas oficiales incompatibles.
const locales=api.eventos();
const inscripcionNoviembre=locales.find(e=>e.desde==='2026-11-06');
assert.equal(inscripcionNoviembre.categoria,'inscripcion_ets');
assert.equal(inscripcionNoviembre.titulo,'Inscripción a ETS');
assert.ok(!inscripcionNoviembre.verificar);
assert.ok(!locales.some(e=>e.desde<='2027-04-09'&&e.hasta>='2027-04-09'),'UPIITA sin evento el 9 abr 2027');
const vacacionesLocal=locales.find(e=>e.categoria==='vacaciones'&&e.periodo==='27/1');
assert.deepEqual([vacacionesLocal.desde,vacacionesLocal.hasta],['2026-12-21','2027-01-01']);
assert.ok(!vacacionesLocal.verificar);assert.match(vacacionesLocal.nota,/Último día de clases antes de vacaciones: 19 dic/);
assert.match(vacacionesLocal.nota,/Regreso a clases: lunes 4 ene 2027/);
assert.ok(locales.some(e=>e.categoria==='reanudacion'&&e.desde==='2027-01-04'&&e.audiencia.includes('alumnos')));
const vacacionesOficial=base.eventos.find(e=>e.categoria==='vacaciones'&&e.desde==='2026-12-21');
assert.equal(vacacionesOficial.hasta,'2027-01-01');
assert.match(vacacionesOficial.nota,/Último día de clases antes de vacaciones: 19 dic 2026/);
assert.equal(base.periodos['27/1'].fin_clases,'2026-12-19');
const procesosEnero=base.eventos.find(e=>e.categoria==='planeacion'&&e.desde==='2027-01-04');
assert.equal(procesosEnero.hasta,'2027-01-22');assert.deepEqual(procesosEnero.audiencia,['docentes']);
assert.equal(procesosEnero.titulo,'Procesos académico-administrativos');
// Noviembre: jueves, viernes y lunes; sábado y domingo carecen de registro ordinario.
for(const d of ['05','06','09'])assert.ok(base.eventos.some(e=>e.categoria==='ordinaria'&&e.desde<='2026-11-'+d&&e.hasta>='2026-11-'+d),'Registro ordinario oficial: 2026-11-'+d);
for(const d of ['07','08'])assert.ok(!base.eventos.some(e=>e.categoria==='ordinaria'&&e.desde<='2026-11-'+d&&e.hasta>='2026-11-'+d),'Sin registro ordinario en fin de semana: 2026-11-'+d);
assert.deepEqual(data.upiita.periodos['26/2'],{desde:'2026-02-02',hasta:'2026-10-12'});
const fechasLocales={
 '26/2|descanso':['2026-02-02:2026-02-02','2026-03-16:2026-03-16','2026-05-01:2026-05-01','2026-05-05:2026-05-05','2026-07-21:2026-07-21','2026-09-16:2026-09-16'],
 '26/2|inicio':['2026-02-03:2026-02-03'],
 '26/2|saberes':['2026-02-27:2026-02-27'],
 '26/2|ordinaria':['2026-03-12:2026-03-13','2026-03-17:2026-03-17','2026-05-12:2026-05-12','2026-09-28:2026-09-30'],
 '26/2|vacaciones':['2026-03-30:2026-04-10','2026-07-20:2026-07-31','2026-08-01:2026-08-08'],
 '26/2|sindical':['2026-05-15:2026-05-15'],
 '26/2|politecnico':['2026-05-21:2026-05-21'],
 '26/2|suspension':['2026-05-18:2026-09-11'],
 '26/2|reanudacion':['2026-09-14:2026-09-14'],
 '27/1|ordinaria':['2026-11-18:2026-11-20','2027-01-04:2027-01-06','2027-02-08:2027-02-10'],
 '27/1|extraordinaria':['2027-02-11:2027-02-12'],
 '27/1|ets':['2027-02-18:2027-02-19','2027-02-22:2027-02-24'],
 '27/2|ordinaria':['2027-04-16:2027-04-16','2027-05-19:2027-05-20','2027-05-24:2027-05-26','2027-06-25:2027-06-25','2027-06-28:2027-06-29'],
 '27/2|extraordinaria':['2027-06-30:2027-07-01'],
 '27/2|ets':['2027-07-07:2027-07-09','2027-07-12:2027-07-13'],
};
for(const [clave,fechas] of Object.entries(fechasLocales))assert.deepEqual(Array.from(api.eventos().filter(e=>e.periodo+'|'+e.categoria===clave).map(e=>e.desde+':'+e.hasta)),fechas,'Transcripción UPIITA: '+clave);
c.SATE_UNIDAD='escom';c.DATA.calendario=null;
assert.equal(api.eventos().find(e=>e.categoria==='inicio'&&e.periodo==='27/2').desde,'2027-01-25');
assert.match(api.eventos().find(e=>e.categoria==='inicio'&&e.periodo==='27/2').nota,/Regreso a clases: 25 ene 2027/);
assert.ok(!api.eventos().some(e=>e.categoria==='reanudacion'&&e.desde==='2027-01-04'),'ESCOM no hereda el regreso UPIITA');
assert.equal(api.eventos().find(e=>e.categoria==='inicio'&&e.periodo==='27/1').desde,'2026-08-24');
assert.ok(api.eventos().filter(e=>e.categoria==='ets').every(e=>e.origen==='ipn'));
assert.deepEqual(Array.from(api.eventos(true)),Array.from(api.filtrarAudiencia(api.fusion(base,null),true)),'ESCOM conserva íntegro el calendario oficial disponible');
assert.ok(!api.eventos(true).some(e=>e.periodo==='26/2'&&e.origen==='unidad'),'ESCOM no recibe el periodo local UPIITA 26/2');
c.SATE_UNIDAD='upiita';c.DATA.calendario=data.upiita;
assert.ok(api.eventos().some(e=>e.origen==='ipn')&&api.eventos().some(e=>e.origen==='unidad'));
assert.ok(api.eventos().every(e=>!e.audiencia.includes('docentes')));
assert.ok(api.eventos(true).some(e=>e.audiencia.includes('docentes')));
assert.equal(api.proximos(0).length,0);assert.equal(api.proximos(3,[]).length,0);
assert.equal(api.proximos(2,['becas']).length,2);


const codigo=leer('web/sate/calendario.js');
// Doble de IntersectionObserver: el mes chico de arriba se observa sin escuchar scroll.
const observadores=[];
c.IntersectionObserver=class{constructor(f){this.f=f;this.desconectado=false;observadores.push(this)}observe(n){this.n=n}disconnect(){this.desconectado=true}};
const visible=v=>observadores.filter(o=>!o.desconectado).at(-1).f([{isIntersecting:v}]);
vm.runInContext(codigo,c);
const mostrar=()=>SATE.modulos.calendario.mostrar();
const nodos=clase=>box.all().filter(n=>(n.className||n.getAttribute('class')||'').split(' ').includes(clase));
const dias=()=>box.all().filter(n=>n.getAttribute('data-fecha')&&!n.id.endsWith('-b'));
const dia=s=>dias().find(n=>n.getAttribute('data-fecha')===s);
const cambiar=p=>{const n=document.getElementById('cal-periodo');n.value=p;n.onchange()};
const cambiarVista=v=>document.getElementById('cal-vista-'+v).onclick();
const seleccionados=clase=>nodos(clase).filter(n=>n.getAttribute('aria-pressed')==='true');
const sinClaves=()=>assert.ok(!box.textContent.includes('sate.calendario.'),'Texto sin resolver');
mostrar();cambiar('27/1');

// 1. Acomodo común: encabezado, resumen + mes arriba, bloque principal debajo, agenda + detalle al final.
api.hoy=()=> '2026-10-20';mostrar();cambiar('27/1');
const clasesBox=box.children.map(n=>n.className);
assert.deepEqual(clasesBox,['calendario-cabecera','calendario-audiencia','calendario-arriba','calendario-principal','calendario-abajo']);
const arriba=nodos('calendario-arriba')[0];
assert.deepEqual(arriba.children.map(n=>n.className),['calendario-tarjeta calendario-estado','calendario-tarjeta calendario-mes-chico'],'Resumen a la izquierda y mes chico a la derecha');
const cabecera=nodos('calendario-cabecera')[0];
assert.ok(cabecera.all().some(n=>n.id==='cal-periodo')&&cabecera.all().some(n=>n.id==='cal-vista-semicirculo'),'Periodo y vista en el encabezado');
assert.equal(nodos('calendario-principal')[0].all().filter(n=>n.getAttribute('class')==='calendario-semicirculo').length,1,'Compacto: semicírculo a todo lo ancho');
assert.equal(nodos('calendario-linea').length,0);
assert.deepEqual(nodos('calendario-abajo')[0].children.map(n=>n.className),['calendario-tarjeta calendario-agenda','calendario-lado']);
assert.match(nodos('calendario-estado')[0].textContent,/Hoy · mar 20 (de )?oct/);assert.match(nodos('calendario-estado')[0].textContent,/Semana 3 de 20/);
assert.equal(nodos('calendario-barra').length,1);assert.equal(nodos('calendario-extremos')[0].children.length,2);
const fichas=nodos('calendario-ficha');
assert.ok(fichas.length>=2&&fichas.length<=4,'Ahora y las dos siguientes');
assert.ok(fichas.some(n=>n.children[1].textContent==='Ahora'));assert.ok(fichas.some(n=>/^En \d+ días$/.test(n.children[1].textContent)));
for(const f of fichas){assert.ok(f.getAttribute('aria-label').includes(','));assert.ok(['true','false'].includes(f.getAttribute('aria-pressed')))}
assert.equal(nodos('calendario-semicirculo')[0].getAttribute('role'),'img');
assert.equal(nodos('calendario-semicirculo')[0].getAttribute('viewBox'),'0 0 680 372');
assert.equal(nodos('calendario-pista').length,2);
assert.equal(nodos('calendario-aguja').length,1);
assert.equal(nodos('calendario-svg-mes').some(n=>n.getAttribute('data-mes')==='2026-10'),false);
assert.equal(box.all().filter(n=>n.tagName==='textPath').length,0);
assert.ok(document.getElementById('cal-periodo').textContent.includes('Periodo 27/1'));assert.ok(!document.getElementById('cal-periodo').textContent.includes('mitad'));
assert.doesNotMatch(box.textContent,/mitad/i);
assert.equal(dias().filter(n=>n.getAttribute('data-fecha').startsWith('2026-10')).length,31);
assert.equal(dias().filter(n=>n.tabIndex===0).length,1);
assert.equal(nodos('calendario-ficha-punto').length,fichas.length);
// El mes chico lleva puntos por día con eventos y marca hoy.
assert.ok(dia('2026-10-19').getAttribute('data-categoria'));assert.equal(dia('2026-10-20').getAttribute('aria-current'),'date');
assert.ok(dia('2026-10-19').all().some(n=>n.className==='calendario-signo'));
assert.ok(dias().filter(n=>!n.getAttribute('data-categoria')).every(n=>n.all().filter(x=>x.className==='calendario-signo').length===0)&&dias().some(n=>!n.getAttribute('data-categoria')));

// 2. Agenda «Lo que viene»: por mes, pasado plegado y estados.
const agendaNodo=nodos('calendario-agenda')[0];
assert.match(agendaNodo.textContent,/Lo que viene/);
const mesesAgenda=nodos('calendario-agenda-mes');
assert.ok(mesesAgenda.length>=4);assert.deepEqual(mesesAgenda.map(n=>n.getAttribute('data-mes')),[...mesesAgenda.map(n=>n.getAttribute('data-mes'))].sort());
assert.match(mesesAgenda[0].children[0].textContent,/octubre 2026/);
const pasadosBtn=document.getElementById('cal-pasados');assert.match(pasadosBtn.textContent,/^Ver lo que ya pasó \(\d+\)$/);
assert.equal(nodos('calendario-item').filter(n=>n.getAttribute('data-estado')==='pasado').length,0,'Lo pasado queda plegado');
const filaItem=nodos('calendario-item')[0];
assert.equal(filaItem.children[0].className,'calendario-fecha');assert.equal(filaItem.children[0].children.length,2,'Día y día de la semana');
assert.match(filaItem.children[1].children[1].textContent,/ · /,'Categoría · rango');
assert.ok(filaItem.getAttribute('aria-label').includes(','));
for(const n of nodos('calendario-item')){assert.ok(['true','false'].includes(n.getAttribute('aria-pressed')))}
assert.ok(nodos('calendario-pildora').some(n=>n.textContent==='Ahora'));assert.ok(nodos('calendario-pildora').every(n=>/^(Ahora|Mañana|En \d+ días|✓ Ya pasó)$/.test(n.textContent)));
pasadosBtn.onclick();
assert.match(document.getElementById('cal-pasados').textContent,/Ocultar lo que ya pasó/);
assert.ok(nodos('calendario-item').some(n=>n.getAttribute('data-estado')==='pasado'));assert.ok(nodos('calendario-pildora').some(n=>n.textContent==='✓ Ya pasó'));
document.getElementById('cal-pasados').onclick();assert.equal(nodos('calendario-item').filter(n=>n.getAttribute('data-estado')==='pasado').length,0);
api.hoy=()=> '2026-10-12';mostrar();assert.ok(nodos('calendario-pildora').some(n=>n.textContent==='Mañana'));api.hoy=()=> '2026-10-20';mostrar();

// 3. Selección compartida: arco ↔ mes ↔ agenda ↔ ficha ↔ detalle.
const detalleActual=()=>nodos('calendario-detalle')[0];
assert.equal(detalleActual().hidden,false,'Escritorio: la tarjeta de detalle siempre está');
assert.equal(nodos('calendario-detalle-evento').length,1,'Sin selección muestra lo siguiente');assert.equal(document.getElementById('cal-volver-detalle'),undefined);
const arco=nodos('calendario-arco').find(n=>n.getAttribute('aria-label').includes('registro de protocolo'));
arco.onclick();
assert.equal(dias().filter(n=>n.getAttribute('aria-pressed')==='true').length,5);
assert.equal(seleccionados('calendario-item').length,1);
assert.match(detalleActual().textContent,/Aviso de Gestión Escolar UPIITA/);
assert.match(detalleActual().textContent,/Constancias de registro de protocolo|protocolo/i);
assert.ok(document.getElementById('cal-volver-detalle'));assert.equal(document.activeElement.id,arco.id,'Escritorio conserva el foco en el elemento elegido');
dia('2026-10-19').onclick();
assert.ok(seleccionados('calendario-arco').length>1);assert.ok(seleccionados('calendario-item').length>1);
dia('2026-10-19').onkeydown({key:'ArrowRight',preventDefault(){}});
assert.equal(document.activeElement.getAttribute('data-fecha'),'2026-10-20');
document.activeElement.onkeydown({key:'ArrowDown',preventDefault(){}});
assert.equal(document.activeElement.getAttribute('data-fecha'),'2026-10-27');
document.getElementById('cal-volver').onclick();
assert.equal(seleccionados('calendario-arco').length,0);assert.equal(seleccionados('calendario-item').length,0);assert.equal(seleccionados('calendario-ficha').length,0);
nodos('calendario-ficha').find(n=>n.getAttribute('aria-label').includes('Inicio')||true).onclick();
assert.ok(seleccionados('calendario-ficha').length>=1);assert.ok(seleccionados('calendario-item').length>=1);
document.getElementById('cal-volver-detalle').onclick();assert.equal(seleccionados('calendario-item').length,0);assert.equal(document.activeElement.id,'cal-dia-2026-10-20');
// Grupos ×N.
const itemOrdinaria=nodos('calendario-item').find(n=>n.getAttribute('aria-label').includes('ordinaria'));
assert.match(itemOrdinaria.textContent,/×3/);itemOrdinaria.onclick();
assert.equal(nodos('calendario-detalle-evento').length,3);assert.equal(seleccionados('calendario-arco').length,3);assert.equal(seleccionados('calendario-item').length,3);
assert.equal(nodos('calendario-arco').find(n=>n.getAttribute('aria-pressed')==='true').children[1].getAttribute('d').includes('A269 269'),true);
document.getElementById('cal-volver').onclick();
// Tooltips accesibles.
for(const n of nodos('calendario-arco'))assert.ok(n.getAttribute('aria-label').includes(','));

// 4. Vista Detallado: todo el periodo de un vistazo.
cambiarVista('carriles');
assert.deepEqual(escrituras.at(-1),['hu.cal.vista','"carriles"']);
assert.equal(document.getElementById('cal-vista-carriles').getAttribute('aria-pressed'),'true');
assert.equal(nodos('calendario-semicirculo').length,0);assert.equal(nodos('calendario-centro').length,0);
assert.equal(nodos('calendario-linea').length,1);assert.deepEqual(box.children.map(n=>n.className),clasesBox,'Mismo acomodo en ambas vistas');
assert.equal(nodos('calendario-principal')[0].all().filter(n=>n.className==='calendario-linea').length,1);
assert.match(nodos('calendario-linea-tarjeta')[0].textContent,/Todo el periodo de un vistazo/);
const filas=nodos('calendario-linea-fila');
assert.deepEqual(filas.map(n=>n.getAttribute('data-fila')),['tramites','evaluaciones','ets','becas','tt','sin_clases','dias_clave']);
assert.deepEqual(filas.map(n=>n.children[0].textContent),['Trámites','Evaluaciones','ETS','Becas','Trabajo terminal','Sin clases','Días clave']);
for(const f of filas){const pista=f.children[1];assert.ok(pista.all().some(n=>n.className==='calendario-ev'),'Fila sin eventos: '+f.getAttribute('data-fila'));assert.ok(parseInt(pista.style.height)>=34)}
const evs=nodos('calendario-ev');assert.equal(evs.length,api.eventos().filter(e=>e.periodo==='27/1').length);
for(const n of evs){assert.equal(n.tagName,'button');assert.ok(n.getAttribute('aria-label').includes(','));assert.ok(['true','false'].includes(n.getAttribute('aria-pressed')));assert.match(n.getAttribute('data-desde'),/^\d{4}-/)}
assert.ok(evs.some(n=>n.getAttribute('data-puntual')==='true'),'Puntos para días únicos');
assert.ok(evs.some(n=>n.getAttribute('data-rayado')==='true')&&evs.filter(n=>n.getAttribute('data-rayado')==='true').every(n=>['sindical','descanso','suspension','feriado'].includes(n.getAttribute('data-categoria'))),'Rayado para descansos');
assert.ok(evs.some(n=>n.getAttribute('data-pasado')==='true')&&evs.some(n=>n.getAttribute('data-pasado')==='false'),'Lo pasado atenuado');
assert.ok(nodos('calendario-linea-nombre').length>0&&nodos('calendario-linea-nombre').every(n=>n.getAttribute('aria-hidden')==='true'),'Nombre junto a la barra cuando cabe');
assert.ok(nodos('calendario-linea-nombre').length<evs.length,'Sólo cuando cabe');
const hoyLinea=nodos('calendario-linea-hoy');assert.equal(hoyLinea.length,1);assert.equal(hoyLinea[0].getAttribute('data-etiqueta'),'Hoy');
const mesesLinea=nodos('calendario-linea-meses')[0];assert.ok(mesesLinea.children.some(n=>n.getAttribute('data-mes')==='2027-02'),'El rango cubre los ETS posteriores al fin de clases');
assert.equal(mesesLinea.style.gridTemplateColumns.split(' ').length,mesesLinea.children.length);
// Traslapes: se apilan en la misma fila, sin escalonar filas vacías.
const trasl=filas.find(f=>f.getAttribute('data-fila')==='tramites').children[1];assert.ok(Number(trasl.getAttribute('data-carriles'))>=2,'Planeación e inscripción se traslapan');
// Selección compartida desde la línea.
const barra=evs.find(n=>n.getAttribute('aria-label').includes('registro de protocolo'));barra.onclick();
assert.equal(dias().filter(n=>n.getAttribute('aria-pressed')==='true').length,5);assert.equal(seleccionados('calendario-item').length,1);assert.equal(nodos('calendario-detalle-evento').length,1);assert.equal(seleccionados('calendario-ev').length,1);
assert.ok(document.getElementById('cal-volver'),'Volver a hoy junto a la línea');document.getElementById('cal-volver').onclick();assert.equal(seleccionados('calendario-ev').length,0);
dia('2026-10-19').onclick();assert.ok(seleccionados('calendario-ev').length>1,'El mes selecciona barras');
document.getElementById('cal-volver').onclick();
nodos('calendario-item').find(n=>n.getAttribute('aria-label').includes('ordinaria')).onclick();
assert.equal(seleccionados('calendario-ev').length,3);assert.equal(nodos('calendario-detalle-evento').length,3);
document.getElementById('cal-volver').onclick();
cambiarVista('semicirculo');dia('2026-10-19').onclick();cambiarVista('carriles');assert.ok(seleccionados('calendario-ev').length>1,'La selección sobrevive al cambio de vista');
vm.runInContext(codigo,c);mostrar();assert.equal(nodos('calendario-linea').length,1,'Recuerdo al volver a cargar el módulo');
// Estados antes / después / durante en ambas vistas.
for(const v of ['carriles','semicirculo']){
 cambiarVista(v);
 for(const [hoy,p,estado] of [['2026-01-01','26/2','antes'],['2026-10-13','26/2','despues'],['2026-10-20','27/1','durante']]){
  api.hoy=()=>hoy;cambiar(p);assert.equal(box.getAttribute('data-estado'),estado);
  assert.equal(nodos(v==='carriles'?'calendario-linea-hoy':'calendario-aguja').length>0,estado==='durante');sinClaves();
 }
}
api.hoy=()=> '2026-01-01';cambiar('26/2');assert.match(nodos('calendario-estado')[0].textContent,/Faltan 32 días/);
assert.equal(nodos('calendario-item').filter(n=>n.getAttribute('data-estado')==='pasado').length,0);
api.hoy=()=> '2026-10-13';cambiar('26/2');assert.match(nodos('calendario-estado')[0].textContent,/Periodo cerrado/);
assert.match(nodos('calendario-agenda')[0].textContent,/Ya no hay más fechas/);assert.match(document.getElementById('cal-pasados').textContent,/Ver lo que ya pasó/);
cambiarVista('semicirculo');assert.match(nodos('calendario-centro')[0].textContent,/Periodo cerrado/);
// Otras unidades y modo genérico.
for(const unidad of ['escom','upibi','encb']){
 c.SATE_UNIDAD=unidad;c.HU=unidad==='encb'?'hu.encb.':'hu.'+unidad+'.';c.DATA.calendario=null;api.hoy=()=> '2027-01-25';mostrar();cambiar('27/2');
 for(const v of ['semicirculo','carriles']){cambiarVista(v);assert.equal(nodos(v==='carriles'?'calendario-linea':'calendario-semicirculo').length,1);assert.equal(nodos('calendario-pista').length,v==='carriles'?0:2);sinClaves()}
 cambiarVista('semicirculo');assert.equal(nodos('calendario-aguja').length,1);
 dia('2027-01-25').onclick();assert.match(nodos('calendario-detalle')[0].textContent,/Regreso a clases: 25 ene 2027/);
 assert.deepEqual(escrituras.at(-1)[0],c.HU+'cal.vista');
}
c.HU='hu.';
c.SATE_CONFIG={...config,calendarioBase:null};c.DATA.calendario={periodo:'28/2',eventos:[e('ets','2028-02-01',{hasta:'2028-03-10',periodo:'28/2'}),e('descanso','2028-02-29',{periodo:'28/2'})]};
api.hoy=()=> '2028-02-29';mostrar();assert.equal(dias().filter(n=>n.getAttribute('data-fecha').startsWith('2028-02')).length,29);
cambiarVista('carriles');assert.deepEqual(nodos('calendario-linea-fila').map(n=>n.getAttribute('data-fila')),['otros'],'Sin vista en los datos, una sola fila genérica');assert.equal(nodos('calendario-linea-fila')[0].children[0].textContent,'Otros');
cambiarVista('semicirculo');dia('2028-02-29').onclick();assert.equal(nodos('calendario-detalle-evento').length,2);
c.DATA.calendario=null;mostrar();assert.equal(box.getAttribute('data-estado'),'vacio');assert.equal(nodos('calendario-pista').length,2);assert.equal(nodos('calendario-aguja').length,0);assert.match(box.textContent,/Fechas por publicar/);
assert.equal(nodos('calendario-ficha').length,0);assert.equal(nodos('calendario-item').length,0);assert.equal(nodos('calendario-detalle')[0].hidden,false);assert.match(nodos('calendario-detalle')[0].textContent,/Elige una fecha/);
cambiarVista('carriles');assert.equal(nodos('calendario-linea-fila').length,0,'Sin eventos no se dibujan filas vacías');assert.match(nodos('calendario-linea-tarjeta')[0].textContent,/Aún no hay fechas confirmadas/);sinClaves();
// Una fila sólo existe si tiene eventos.
c.SATE_CONFIG=config;c.SATE_UNIDAD='upiita';const p99={periodo:'99/9'};c.DATA.calendario={periodo:'99/9',eventos:[e('gestion','2026-10-01',{...p99,hasta:'2026-10-04'}),e('gestion','2026-10-02',{...p99,hasta:'2026-10-05'}),e('gestion','2026-10-20',p99)]};
api.hoy=()=> '2026-10-10';mostrar();cambiar('99/9');
assert.deepEqual(nodos('calendario-linea-fila').map(n=>n.getAttribute('data-fila')),['tramites']);
assert.equal(nodos('calendario-linea-pista')[0].getAttribute('data-carriles'),'2','Solapamientos en dos carriles; el evento distante reutiliza el primero');
assert.equal(nodos('calendario-linea-pista')[0].style.height,'60px');
c.DATA.calendario.eventos=[e('gestion','2026-10-01',p99)];mostrar();assert.equal(nodos('calendario-linea-pista')[0].style.height,'34px');
almacen.set('hu.cal.vista','"desconocida"');mostrar();assert.equal(nodos('calendario-semicirculo').length,1,'Valor inválido vuelve a la vista predeterminada');
c.DATA.calendario=data.upiita;

// 5. Teléfono: una columna y detalle como hoja inferior.
api.hoy=()=> '2026-10-20';c.matchMedia=()=>({matches:true});mostrar();cambiar('27/1');
assert.equal(nodos('calendario-detalle')[0].hidden,true,'Teléfono: el detalle sólo aparece como hoja');
const item=nodos('calendario-item')[0];item.onclick();
assert.equal(nodos('calendario-detalle')[0].getAttribute('role'),'dialog');assert.equal(nodos('calendario-detalle')[0].getAttribute('aria-modal'),'true');assert.equal(nodos('calendario-hoja-fondo').length,1);
assert.equal(document.activeElement.id,'cal-detalle-titulo');
const modal=nodos('calendario-detalle')[0],enlaces=modal.querySelectorAll();enlaces.at(-1).focus();modal.onkeydown({key:'Tab',preventDefault(){}});assert.equal(document.activeElement,enlaces[0]);modal.onkeydown({key:'Tab',shiftKey:true,preventDefault(){}});assert.equal(document.activeElement,enlaces.at(-1));
modal.onkeydown({key:'Escape',preventDefault(){}});assert.equal(nodos('calendario-hoja-fondo').length,0);assert.equal(document.activeElement.id,item.id,'Cerrar devuelve el foco a la agenda');
cambiarVista('carriles');const tactil=nodos('calendario-ev')[0];tactil.onclick();assert.equal(nodos('calendario-detalle')[0].getAttribute('role'),'dialog');
document.getElementById('cal-cerrar').onclick();assert.equal(document.activeElement.id,tactil.id,'Cerrar devuelve el foco a la línea');
assert.ok(document.getElementById('cal-volver'),'En teléfono la selección se limpia desde la línea');
// En teléfono no hay copia del mes chico.
visible(false);assert.equal(nodos('calendario-mes-chico')[1].hidden,true);assert.equal(nodos('calendario-mes-chico')[0].inert,false);
cambiarVista('semicirculo');c.matchMedia=()=>({matches:false});

// 6. Mes chico que acompaña: una sola copia activa según IntersectionObserver.
mostrar();cambiar('27/1');
{const vivos=observadores.filter(o=>!o.desconectado).length;mostrar();assert.equal(observadores.filter(o=>!o.desconectado).length,vivos,'Cada redibujo desconecta el observador anterior')}
visible(true);const [mesArriba,mesAbajo]=nodos('calendario-mes-chico');
assert.equal(observadores.at(-1).n,mesArriba,'Se observa el mes de arriba');
assert.equal(mesAbajo.hidden,true);assert.equal(mesArriba.inert,false);assert.equal(mesArriba.getAttribute('aria-hidden'),'false');
assert.equal(nodos('calendario-lado')[0].children.at(-1),mesAbajo,'La copia va debajo del detalle');assert.equal(nodos('calendario-lado')[0].children[0].className,'calendario-detalle');
dia('2026-10-19').focus();
visible(false);
assert.equal(mesAbajo.hidden,false);assert.equal(mesArriba.inert,true);assert.equal(mesArriba.getAttribute('aria-hidden'),'true');assert.equal(nodos('calendario-lado')[0].getAttribute('data-copia'),'true');
assert.equal(document.activeElement.id,'cal-dia-2026-10-19-b','El foco pasa a la copia');
visible(false);assert.equal(mesAbajo.hidden,false,'Repetir no cambia nada');
// Mes mostrado y selección se conservan al navegar en la copia.
document.getElementById('cal-proximo-b').onclick();
assert.equal(document.activeElement.id,'cal-proximo-b','Foco en la copia tras redibujar');
let [arr2,aba2]=nodos('calendario-mes-chico');assert.equal(aba2.hidden,false);assert.equal(arr2.inert,true,'La copia sigue activa tras redibujar');
assert.equal(arr2.children[0].children[1].textContent,aba2.children[0].children[1].textContent,'Mismo mes en ambos');assert.match(aba2.textContent,/noviembre 2026/);
document.getElementById('cal-dia-2026-11-16-b').onclick();
assert.ok(seleccionados('calendario-item').length>=1);
const marcados=n=>n.all().filter(x=>x.getAttribute('data-fecha')&&x.getAttribute('data-seleccionado')==='true').length;
[arr2,aba2]=nodos('calendario-mes-chico');assert.equal(marcados(arr2),marcados(aba2));assert.ok(marcados(aba2)>=1,'Selección compartida entre las dos copias');
assert.equal(nodos('calendario-ficha').length>0,true);
// Al volver el de arriba: desaparece la copia y el foco regresa.
document.getElementById('cal-dia-2026-11-16-b').focus();
visible(true);
[arr2,aba2]=nodos('calendario-mes-chico');assert.equal(aba2.hidden,true);assert.equal(arr2.inert,false);assert.equal(document.activeElement.id,'cal-dia-2026-11-16');
assert.equal(arr2.children[0].children[1].textContent,aba2.children[0].children[1].textContent);
assert.equal(box.all().filter(n=>n.getAttribute('data-fecha')&&n.tabIndex===0&&!n.id.endsWith('-b')).length,1);
// Nunca activos a la vez ni sin ninguno.
for(const v of [false,true,false,true]){visible(v);[arr2,aba2]=nodos('calendario-mes-chico');assert.equal(!!arr2.inert,!aba2.hidden)}
visible(true);
document.getElementById('cal-volver')?.onclick?.();

// Recortes existentes: clic al proceso, fuente, cita personal y ausencia.
c.matchMedia=()=>({matches:false});c.SATE_CONFIG=config;c.DATA.calendario=data.upiita;c.perName=()=> '27/1';api.hoy=()=> '2026-10-07';
c.addEventListener=()=>{};vm.runInContext('window=globalThis',c);vm.runInContext(leer('web/dist/sate/componentes.js'),c);c.SateUI.usarTextos(SATE.texto);
let destino;SATE.ir=id=>destino=id;
assert.equal(api.recorte('calendario').length,0);assert.equal(api.recorte('horarios')[0].titulo,'Citas publicadas');
for(const id of ['horarios','mapa','trayectoria']){api.pintarRecorte(id);api.pintarRecorte(id);const p=paneles[id==='horarios'?'v-hor':id==='mapa'?'v-tray':'sate-trayectoria'];assert.equal(p.all().filter(n=>n.className==='sate-recorte-calendario').length,1)}
paneles['v-hor'].firstChild.listeners.click();mostrar();assert.equal(destino,'calendario');assert.match(nodos('calendario-detalle')[0].textContent,/Citas publicadas/);
c.isPersonal=()=>true;c.ALUMNO={cita:{inicio:'08/10/2026 10:00:00',fin:'08/10/2026 10:30:00'}};c.perDeFecha=()=>0;
assert.equal(api.cita().desde,'2026-10-08');api.abrirProceso(api.cita());mostrar();assert.match(nodos('calendario-detalle')[0].textContent,/10:00:00/);
assert.match(nodos('calendario-detalle')[0].textContent,/SAES del alumno/);sinClaves();
c.isPersonal=()=>false;

// Los textos legibles se resuelven por clave o provienen de los calendarios.
assert.doesNotMatch(codigo,/'(?:Hoy|Ahora|Sigue|Volver a hoy|Semana|Periodo cerrado|Vacaciones|Ordinaria|Descansos|Calendario|Cerrar detalle|Lo que viene|Mañana|En |Ver lo que|Trámites|Evaluaciones|Días clave|Sin clases|Todo el periodo|Semicírculo|Carriles|Compacto|Detallado|Inscripción|Evaluación|Otros)[^']*'/);
assert.doesNotMatch(codigo,/_diseno|2026-\d\d-\d\d|startsWith\('Baja'\)/);
assert.doesNotMatch(codigo,/addEventListener\(\s*['"]scroll|onscroll/,'Sin escuchar scroll');
assert.match(codigo,/new IntersectionObserver/);
const css=leer('web/sate/componentes.css');
for(const categoria of api.categorias){assert.ok(css.includes('--ipn-cal-'+categoria+':'),'Token '+categoria)}
assert.match(css,/\[data-theme=dark\] #sate-calendario\{/);assert.match(css,/@media\(prefers-color-scheme:dark\)/);
assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
assert.match(css,/\.calendario-arriba\{display:grid;grid-template-columns:minmax\(0,1fr\) 300px/);
assert.match(css,/@media\(max-width:819px\)\{\.calendario-arriba,\.calendario-abajo\{grid-template-columns:minmax\(0,1fr\)\}/);
assert.match(css,/\.calendario-centro\{bottom:16%/);assert.match(css,/\.calendario-centro-largo\{display:none\}/);assert.match(css,/\.calendario-svg-mes,\.calendario-svg-extremo\{font-size:21px\}/);
assert.match(css,/\.calendario-lado\{position:sticky/);assert.match(css,/\.calendario-tarjeta\[hidden\]\{display:none\}/);
assert.match(css,/\.calendario-linea-fila\{[^}]*min-height:34px/);
assert.doesNotMatch(css,/carril/,'Sin restos de los carriles');
assert.doesNotMatch(css,/calendario-linea[^{]*\{[^}]*overflow-x\s*:\s*(auto|scroll)/,'Sin desplazamiento horizontal en la línea');
for(const bloque of css.matchAll(/\.calendario-centro\{([^}]+)\}/g))assert.doesNotMatch(bloque[1],/overflow\s*:\s*(auto|scroll)|max-height/,'El centro crece como en la maqueta, sin barra de desplazamiento');

// Las tintas de lectura permanecen AA sobre superficie y mezcla del mes.
const rgb=hex=>hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255);
const lum=c=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contraste=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const temas=[{fondo:'#ffffff',texto:'#18181b',tenue:'#52525b',acento:'#7a1f45'},{fondo:'#18181b',texto:'#fafafa',tenue:'#a1a1aa',acento:'#f0a3c4'}];
for(const tema of temas){for(const tinta of ['texto','tenue','acento'])assert.ok(contraste(rgb(tema[tinta]),rgb(tema.fondo))>=4.5,tinta+' AA');for(const color of css.matchAll(/--ipn-cal-[\w]+:(#[a-f\d]{6})/gi)){const mezcla=rgb(color[1]).map((v,i)=>v*.24+rgb(tema.fondo)[i]*.76);assert.ok(contraste(rgb(tema.texto),mezcla)>=4.5,'Número sobre día seleccionado '+color[1])}}
const paletas=css.split('\n').filter(l=>l.includes('--ipn-cal-academico:')).map((l,i)=>Object.fromEntries([...l.matchAll(/--ipn-cal-(\w+):([^;]+);/g)].map(([,k,v])=>[k,(v.startsWith('var(')?temas[0].acento:v).toLowerCase()])));
assert.equal(paletas.length,3,'Claro, oscuro explícito y oscuro del sistema');
assert.deepEqual(paletas[1],paletas[2],'Misma paleta en ambos modos oscuros');
for(const [i,paleta] of paletas.entries()){
 assert.equal(new Set(Object.values(paleta)).size,api.categorias.length,'Todas las categorías tienen color propio: tema '+i);
 for(const categoria of api.categorias)assert.ok(contraste(rgb(paleta[categoria]),rgb(temas[i?1:0].fondo))>=4.5,'Color AA: '+categoria+', tema '+i);
}
c.SATE_CONFIG=config;c.SATE_UNIDAD='upiita';c.DATA.calendario=data.upiita;api.hoy=()=> '2026-09-10';c.HU='hu.';mostrar();cambiar('26/2');
assert.ok(dia('2026-09-11').className.includes('calendario-suspension'));assert.ok(!dia('2026-09-12').className.includes('calendario-suspension'));
dia('2026-09-16').onclick();assert.equal(nodos('calendario-detalle-evento').filter(n=>n.getAttribute('data-categoria')==='descanso').length,6,'Descanso del mes selecciona su grupo íntegro');
assert.ok(!config.pestanasOcultas.includes('calendario'));

// Todos los meses, periodos y audiencias, en ambas vistas, sin textos sin resolver ni errores.
c.isPersonal=()=>false;c.matchMedia=()=>({matches:false});
let recorridos=0;
for(const unidad of ['upiita','escom','upibi']){
 c.SATE_UNIDAD=unidad;c.DATA.calendario=data[unidad]||null;mostrar();
 for(const ampliar of [false,true]){
  const check=document.getElementById('cal-audiencia');check.checked=ampliar;check.onchange();
  const periodos=document.getElementById('cal-periodo').children.map(n=>n.value);
  for(const p of periodos)for(const v of ['semicirculo','carriles']){
   cambiar(p);cambiarVista(v);while(!document.getElementById('cal-anterior').disabled)document.getElementById('cal-anterior').onclick();
   do{sinClaves();assert.equal(nodos('calendario-ficha').every(n=>!/^(Ahora|Sigue)\s*:/.test(n.children[2].textContent)),true);recorridos++;if(document.getElementById('cal-proximo').disabled)break;document.getElementById('cal-proximo').onclick()}while(true);
   if(v==='carriles')for(const f of nodos('calendario-linea-fila'))assert.ok(f.children[1].all().some(n=>n.className==='calendario-ev'));
  }
 }
}
cambiarVista('semicirculo');
c.SATE_UNIDAD='upiita';c.DATA.calendario=data.upiita;api.hoy=()=> '2026-10-20';
document.getElementById('cal-audiencia').checked=false;document.getElementById('cal-audiencia').onchange();
console.log('CAL OK: acomodo común (resumen + mes arriba, vista abajo), Compacto y Detallado ('+recorridos+' recorridos por unidad, periodo, audiencia y mes), filas sólo con eventos, agenda por mes con pasados plegados, selección compartida, grupos ×N, hoja móvil, mes chico que acompaña con IntersectionObserver, estados vacío/antes/después, tokens AA claro/oscuro y textos por clave.');
