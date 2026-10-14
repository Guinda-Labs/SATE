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
vm.runInContext(codigo,c);
const mostrar=()=>SATE.modulos.calendario.mostrar();
const nodos=clase=>box.all().filter(n=>(n.className||n.getAttribute('class')||'').split(' ').includes(clase));
const dias=()=>box.all().filter(n=>n.getAttribute('data-fecha'));
const dia=s=>dias().find(n=>n.getAttribute('data-fecha')===s);
const cambiar=p=>{const n=document.getElementById('cal-periodo');n.value=p;n.onchange()};
mostrar();cambiar('27/1');
assert.equal(nodos('calendario-semicirculo')[0].getAttribute('role'),'img');
assert.equal(nodos('calendario-semicirculo')[0].getAttribute('viewBox'),'0 0 680 372');
assert.equal(nodos('calendario-pista').length,2);
assert.equal(nodos('calendario-mes').length,1);
assert.equal(nodos('calendario-aguja').length,1);
assert.equal(nodos('calendario-svg-mes').some(n=>n.getAttribute('data-mes')==='2026-10'),false);
assert.equal(nodos('calendario-etiqueta-exterior').length,0);
assert.equal(box.all().filter(n=>n.tagName==='textPath').length,0);
assert.ok(document.getElementById('cal-periodo').textContent.includes('Periodo 27/1'));assert.ok(!document.getElementById('cal-periodo').textContent.includes('mitad'));
assert.equal(dias().filter(n=>n.getAttribute('data-fecha').startsWith('2026-10')).length,31);
assert.equal(dias().filter(n=>n.tabIndex===0).length,1);
const arco=nodos('calendario-arco').find(n=>n.getAttribute('aria-label').includes('registro de protocolo'));
arco.onclick();
assert.equal(dias().filter(n=>n.getAttribute('aria-pressed')==='true').length,5);
assert.match(nodos('calendario-detalle')[0].textContent,/Aviso de Gestión Escolar UPIITA/);
dia('2026-10-19').onclick();
assert.ok(nodos('calendario-arco').filter(n=>n.getAttribute('aria-pressed')==='true').length>1);
dia('2026-10-19').onkeydown({key:'ArrowRight',preventDefault(){}});
assert.equal(document.activeElement.getAttribute('data-fecha'),'2026-10-20');
document.activeElement.onkeydown({key:'ArrowDown',preventDefault(){}});
assert.equal(document.activeElement.getAttribute('data-fecha'),'2026-10-27');
document.getElementById('cal-volver').onclick();
assert.equal(nodos('calendario-arco').filter(n=>n.getAttribute('aria-pressed')==='true').length,0);
const ordinaria=nodos('calendario-proceso').find(n=>n.getAttribute('data-grupo')==='g:ordinaria');
assert.match(ordinaria.textContent,/×3/);ordinaria.onclick();
assert.equal(nodos('calendario-detalle-evento').length,3);
assert.equal(nodos('calendario-arco').filter(n=>n.getAttribute('aria-pressed')==='true').length,3);
assert.equal(nodos('calendario-arco').find(n=>n.getAttribute('aria-pressed')==='true').children[1].getAttribute('d').includes('A269 269'),true);
assert.ok(nodos('calendario-categorias')[0].children.every(n=>api.eventos().some(e=>e.categoria===n.getAttribute('data-categoria')&&e.desde<='2026-11-30'&&e.hasta>='2026-11-01')));
for(const n of nodos('calendario-proceso')){assert.ok(n.getAttribute('aria-label').includes(','));assert.ok(['true','false'].includes(n.getAttribute('aria-pressed')))}
api.hoy=()=> '2026-01-01';cambiar('26/2');
assert.equal(box.getAttribute('data-estado'),'antes');assert.equal(nodos('calendario-aguja').length,0);assert.match(nodos('calendario-centro')[0].textContent,/Faltan 32 días/);
api.hoy=()=> '2026-10-13';mostrar();
assert.equal(box.getAttribute('data-estado'),'despues');assert.equal(nodos('calendario-aguja').length,0);assert.match(nodos('calendario-centro')[0].textContent,/Periodo cerrado/);
for(const unidad of ['escom','upibi','encb']){
 c.SATE_UNIDAD=unidad;c.DATA.calendario=null;api.hoy=()=> '2027-01-25';mostrar();cambiar('27/2');
 assert.equal(nodos('calendario-pista').length,2);assert.equal(nodos('calendario-aguja').length,1);
 dia('2027-01-25').onclick();assert.match(nodos('calendario-detalle')[0].textContent,/Regreso a clases: 25 ene 2027/);
 assert.ok(!box.textContent.includes('sate.calendario.'));
}
c.SATE_CONFIG={...config,calendarioBase:null};c.DATA.calendario={periodo:'28/2',eventos:[e('ets','2028-02-01',{hasta:'2028-03-10',periodo:'28/2'}),e('descanso','2028-02-29',{periodo:'28/2'})]};
api.hoy=()=> '2028-02-29';mostrar();assert.equal(dias().filter(n=>n.getAttribute('data-fecha').startsWith('2028-02')).length,29);
dia('2028-02-29').onclick();assert.equal(nodos('calendario-detalle-evento').length,2);
c.DATA.calendario=null;mostrar();assert.equal(box.getAttribute('data-estado'),'vacio');assert.equal(nodos('calendario-pista').length,2);assert.equal(nodos('calendario-aguja').length,0);assert.match(box.textContent,/Fechas por publicar/);
c.SATE_CONFIG=config;c.SATE_UNIDAD='upiita';c.DATA.calendario=data.upiita;api.hoy=()=> '2026-10-20';c.matchMedia=()=>({matches:true});mostrar();cambiar('27/1');
const proceso=nodos('calendario-proceso')[0];proceso.onclick();assert.equal(nodos('calendario-detalle')[0].getAttribute('role'),'dialog');assert.equal(nodos('calendario-detalle')[0].getAttribute('aria-modal'),'true');assert.equal(nodos('calendario-hoja-fondo').length,1);
const modal=nodos('calendario-detalle')[0],enlaces=modal.querySelectorAll();enlaces.at(-1).focus();modal.onkeydown({key:'Tab',preventDefault(){}});assert.equal(document.activeElement,enlaces[0]);modal.onkeydown({key:'Tab',shiftKey:true,preventDefault(){}});assert.equal(document.activeElement,enlaces.at(-1));
nodos('calendario-detalle')[0].onkeydown({key:'Escape',preventDefault(){}});assert.equal(nodos('calendario-hoja-fondo').length,0);assert.equal(document.activeElement.id,proceso.id);
// Recortes existentes: clic al proceso, fuente, cita personal y ausencia.
c.matchMedia=()=>({matches:false});c.SATE_CONFIG=config;c.DATA.calendario=data.upiita;c.perName=()=> '27/1';api.hoy=()=> '2026-10-07';
c.addEventListener=()=>{};vm.runInContext('window=globalThis',c);vm.runInContext(leer('web/dist/sate/componentes.js'),c);c.SateUI.usarTextos(SATE.texto);
let destino;SATE.ir=id=>destino=id;
assert.equal(api.recorte('calendario').length,0);assert.equal(api.recorte('horarios')[0].titulo,'Citas publicadas');
for(const id of ['horarios','mapa','trayectoria']){api.pintarRecorte(id);api.pintarRecorte(id);const p=paneles[id==='horarios'?'v-hor':id==='mapa'?'v-tray':'sate-trayectoria'];assert.equal(p.all().filter(n=>n.className==='sate-recorte-calendario').length,1)}
paneles['v-hor'].firstChild.listeners.click();mostrar();assert.equal(destino,'calendario');assert.match(nodos('calendario-detalle')[0].textContent,/Citas publicadas/);
c.isPersonal=()=>true;c.ALUMNO={cita:{inicio:'08/10/2026 10:00:00',fin:'08/10/2026 10:30:00'}};c.perDeFecha=()=>0;
assert.equal(api.cita().desde,'2026-10-08');api.abrirProceso(api.cita());mostrar();assert.match(nodos('calendario-detalle')[0].textContent,/10:00:00/);
assert.match(nodos('calendario-detalle')[0].textContent,/SAES del alumno/);assert.ok(!box.textContent.includes('sate.calendario.'));

// Los textos legibles se resuelven por clave o provienen de los calendarios.
assert.doesNotMatch(codigo,/'(?:Hoy|Ahora|Sigue|Volver a hoy|Semana|Periodo cerrado|Vacaciones|Ordinaria|Descansos|Calendario|Cerrar detalle)[^']*'/);
assert.doesNotMatch(codigo,/_diseno|2026-\d\d-\d\d|startsWith\('Baja'\)/);
const css=leer('web/sate/componentes.css');
for(const categoria of api.categorias){assert.ok(css.includes('--ipn-cal-'+categoria+':'),'Token '+categoria)}
assert.match(css,/\[data-theme=dark\] #sate-calendario\{/);assert.match(css,/@media\(prefers-color-scheme:dark\)/);
assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);assert.match(css,/\.calendario-layout\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
assert.match(css,/\.calendario-centro\{bottom:16%/);assert.match(css,/\.calendario-centro-largo\{display:none\}/);assert.match(css,/\.calendario-svg-mes,\.calendario-svg-extremo\{font-size:21px\}/);
for(const bloque of css.matchAll(/\.calendario-centro\{([^}]+)\}/g))assert.doesNotMatch(bloque[1],/overflow\s*:\s*(auto|scroll)|max-height/,'El centro crece como en la maqueta, sin barra de desplazamiento');

// Las tintas de lectura permanecen AA sobre superficie y mezcla del mes.
const rgb=hex=>hex.match(/[a-f\d]{2}/gi).map(v=>parseInt(v,16)/255);
const lum=c=>c.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contraste=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
const temas=[{fondo:'#ffffff',texto:'#18181b',tenue:'#52525b',acento:'#7a1f45'},{fondo:'#18181b',texto:'#fafafa',tenue:'#a1a1aa',acento:'#f0a3c4'}];
for(const tema of temas){for(const tinta of ['texto','tenue','acento'])assert.ok(contraste(rgb(tema[tinta]),rgb(tema.fondo))>=4.5,tinta+' AA');for(const color of css.matchAll(/--ipn-cal-[\w]+:(#[a-f\d]{6})/gi)){const mezcla=rgb(color[1]).map((v,i)=>v*.15+rgb(tema.fondo)[i]*.85);assert.ok(contraste(rgb(tema.texto),mezcla)>=4.5,'Número sobre '+color[1])}}
const paletas=css.split('\n').filter(l=>l.includes('--ipn-cal-academico:')).map((l,i)=>Object.fromEntries([...l.matchAll(/--ipn-cal-(\w+):([^;]+);/g)].map(([,k,v])=>[k,(v.startsWith('var(')?temas[0].acento:v).toLowerCase()])));
assert.equal(paletas.length,3,'Claro, oscuro explícito y oscuro del sistema');
assert.deepEqual(paletas[1],paletas[2],'Misma paleta en ambos modos oscuros');
for(const [i,paleta] of paletas.entries()){
 assert.equal(new Set(Object.values(paleta)).size,api.categorias.length,'Todas las categorías tienen color propio: tema '+i);
 for(const categoria of api.categorias)assert.ok(contraste(rgb(paleta[categoria]),rgb(temas[i?1:0].fondo))>=4.5,'Color AA: '+categoria+', tema '+i);
}
c.SATE_CONFIG=config;c.SATE_UNIDAD='upiita';c.DATA.calendario=data.upiita;api.hoy=()=> '2026-09-10';mostrar();cambiar('26/2');
assert.ok(dia('2026-09-11').className.includes('calendario-suspension'));assert.ok(!dia('2026-09-12').className.includes('calendario-suspension'));
dia('2026-09-16').onclick();assert.equal(nodos('calendario-detalle-evento').filter(n=>n.getAttribute('data-categoria')==='descanso').length,6,'Descanso del mes selecciona su grupo íntegro');
assert.ok(!config.pestanasOcultas.includes('calendario'));

// Integración de las leyendas reales y la tarjeta: todos los meses, periodos y audiencias.
c.isPersonal=()=>false;c.matchMedia=()=>({matches:false});
let leyendas=0;
for(const unidad of ['upiita','escom','upibi']){
 c.SATE_UNIDAD=unidad;c.DATA.calendario=data[unidad]||null;mostrar();
 for(const ampliar of [false,true]){
  const check=document.getElementById('cal-audiencia');check.checked=ampliar;check.onchange();
  const periodos=document.getElementById('cal-periodo').children.map(n=>n.value);
  for(const p of periodos){
   cambiar(p);while(!document.getElementById('cal-anterior').disabled)document.getElementById('cal-anterior').onclick();
   do{
    const categorias=nodos('calendario-categorias')[0].children.map(n=>n.getAttribute('data-categoria'));
    for(const [i,paleta] of paletas.entries())assert.equal(new Set(categorias.map(k=>paleta[k])).size,categorias.length,'Leyenda sin colores repetidos: '+unidad+', '+p+', '+document.getElementById('cal-mes').textContent+', tema '+i);
    for(const fila of nodos('calendario-resumen-fila'))assert.doesNotMatch(fila.children[1].textContent,/^(Ahora|Sigue)\s*:/,'Prefijo único en la tarjeta: '+fila.textContent);
    leyendas++;if(document.getElementById('cal-proximo').disabled)break;document.getElementById('cal-proximo').onclick();
   }while(true);
  }
 }
}
c.SATE_UNIDAD='upiita';c.DATA.calendario=data.upiita;
const check=document.getElementById('cal-audiencia');check.checked=false;check.onchange();
for(const [hoy,p] of [['2026-10-26','27/1'],['2026-11-10','27/1'],['2026-01-01','26/2'],['2026-10-13','26/2']]){
 api.hoy=()=>hoy;mostrar();cambiar(p);
 for(const fila of nodos('calendario-resumen-fila'))assert.doesNotMatch(fila.children[1].textContent,/^(Ahora|Sigue)\s*:/,'Tarjeta sin prefijos, fecha '+hoy);
}
assert.equal(nodos('calendario-resumen-fila')[0].children[0].textContent,'Ahora');
assert.equal(nodos('calendario-resumen-fila')[1].children[0].textContent,'Sigue');

// SEMI3: dos geometrías, una selección, preferencia por unidad y datos compartidos.
const cambiarVista=v=>document.getElementById('cal-vista-'+v).onclick();
assert.equal(document.getElementById('cal-vista-semicirculo').getAttribute('aria-pressed'),'true');
api.hoy=()=> '2026-10-20';cambiar('27/1');cambiarVista('carriles');
assert.equal(nodos('calendario-semicirculo').length,0);
assert.equal(nodos('calendario-carriles').length,1);
assert.equal(nodos('calendario-carriles-meses')[0].getAttribute('role'),'img');
assert.match(nodos('calendario-carriles-meses')[0].getAttribute('aria-label'),/en carriles de izquierda a derecha/);
assert.equal(document.getElementById('cal-vista-carriles').getAttribute('aria-pressed'),'true');
assert.deepEqual(escrituras.at(-1),['hu.cal.vista','"carriles"']);
assert.equal(nodos('calendario-carriles-contenedor')[0].getAttribute('data-ampliado'),'false','Inicio con el periodo completo');
assert.ok(nodos('calendario-carriles-scroll').every(n=>n.scrollLeft===0));
assert.ok(nodos('calendario-carril-hoy').length>=5);
const protocolo=nodos('calendario-carril-evento').find(n=>n.getAttribute('aria-label').includes('registro de protocolo'));
assert.equal(protocolo.tagName,'button');protocolo.onclick();
assert.equal(dias().filter(n=>n.getAttribute('aria-pressed')==='true').length,5,'Carril selecciona el mes');
assert.equal(nodos('calendario-detalle-evento').length,1);
document.getElementById('cal-carriles-zoom').onclick();
assert.equal(nodos('calendario-carriles-contenedor')[0].getAttribute('data-ampliado'),'true');
const desplazamientoHoy=nodos('calendario-carriles-scroll')[0].scrollLeft;
assert.ok(desplazamientoHoy>=0&&desplazamientoHoy<=340,'Hoy visible al ampliar');
assert.ok(nodos('calendario-carriles-scroll').every(n=>n.scrollLeft===desplazamientoHoy),'Franjas sincronizadas al abrir');
nodos('calendario-carriles-scroll')[0].scrollLeft=123;dia('2026-10-19').onclick();
assert.equal(nodos('calendario-carriles-scroll')[0].scrollLeft,123,'Seleccionar conserva el desplazamiento interno');
const franja=nodos('calendario-carriles-scroll')[1];franja.scrollLeft=75;franja.onscroll();
assert.ok(nodos('calendario-carriles-scroll').every(n=>n.scrollLeft===75),'Desplazar un carril sincroniza meses y marcas');
document.getElementById('cal-carriles-zoom').onclick();
assert.ok(nodos('calendario-carriles-scroll').every(n=>n.scrollLeft===0),'Ver periodo completo elimina el desplazamiento');
assert.ok(nodos('calendario-carril-evento').filter(n=>n.getAttribute('aria-pressed')==='true').length>1,'Mes selecciona carriles');
cambiarVista('semicirculo');
assert.ok(nodos('calendario-arco').filter(n=>n.getAttribute('aria-pressed')==='true').length>1,'La selección sobrevive al cambio de geometría');
const tecla=nodos('calendario-arco')[0];assert.equal(tecla.getAttribute('role'),'button');assert.equal(tecla.getAttribute('tabindex'),'0');
tecla.onkeydown({key:'Enter',preventDefault(){}});assert.ok(nodos('calendario-detalle-evento').length);
cambiarVista('carriles');vm.runInContext(codigo,c);mostrar();
assert.equal(nodos('calendario-carriles').length,1,'Recuerdo al volver a cargar el módulo');
const grupoCarril=nodos('calendario-carril-evento').find(n=>n.getAttribute('data-grupo')==='g:ordinaria');grupoCarril.onclick();
assert.equal(nodos('calendario-detalle-evento').length,3);assert.match(nodos('calendario-carril-nombres').map(n=>n.textContent).join(' '),/×3/);
assert.equal(nodos('calendario-carril-evento').filter(n=>n.getAttribute('aria-pressed')==='true').length,3);
for(const [hoy,p,estado] of [['2026-01-01','26/2','antes'],['2026-10-13','26/2','despues'],['2026-10-20','27/1','durante']]){
 api.hoy=()=>hoy;cambiar(p);assert.equal(box.getAttribute('data-estado'),estado);
 assert.equal(nodos('calendario-carril-hoy').length>0,estado==='durante');assert.ok(!box.textContent.includes('sate.calendario.'));
}
for(const unidad of ['escom','upibi']){
 c.SATE_UNIDAD=unidad;c.HU='hu.'+unidad+'.';c.DATA.calendario=null;mostrar();
 assert.equal(nodos('calendario-semicirculo').length,1,'Preferencia independiente: '+unidad);
 cambiarVista('carriles');assert.deepEqual(escrituras.at(-1),['hu.'+unidad+'.cal.vista','"carriles"']);
 mostrar();assert.equal(nodos('calendario-carriles').length,1);assert.ok(!box.textContent.includes('sate.calendario.'));
}
c.HU='hu.';c.SATE_UNIDAD='upiita';c.DATA.calendario=data.upiita;c.matchMedia=()=>({matches:true});mostrar();cambiar('27/1');
const tactil=nodos('calendario-carril-evento')[0];tactil.onclick();
assert.equal(nodos('calendario-detalle')[0].getAttribute('role'),'dialog');
document.getElementById('cal-cerrar').onclick();assert.equal(document.activeElement.id,tactil.id,'Cerrar devuelve el foco al carril');
c.SATE_CONFIG={...config,calendarioBase:null};c.DATA.calendario=null;mostrar();
assert.equal(box.getAttribute('data-estado'),'vacio');assert.equal(nodos('calendario-carril-hoy').length,0);assert.match(box.textContent,/Fechas por publicar/);
assert.equal(nodos('calendario-carril').length,0,'Sin eventos no se dibujan carriles vacíos');
// SEMI4: apilado real, altura por filas y resúmenes fuera de la franja desplazable.
c.DATA.calendario={periodo:'27/1',eventos:[e('gestion','2026-10-01',{hasta:'2026-10-04'}),e('gestion','2026-10-02',{hasta:'2026-10-05'}),e('gestion','2026-10-20')]};
api.hoy=()=> '2026-10-10';mostrar();
assert.equal(nodos('calendario-carril').length,1,'Sólo se muestra el carril con eventos');
const pistaPrueba=nodos('calendario-carril-pista')[0];
assert.equal(pistaPrueba.getAttribute('data-filas'),'2','Solapamientos en dos filas, evento distante reutiliza fila');
assert.equal(pistaPrueba.style.height,'calc(2 * var(--cal-fila) + 8px)');
assert.deepEqual(nodos('calendario-carril-evento').map(n=>n.getAttribute('data-fila')),['0','1','0']);
for(const n of nodos('calendario-carril-nombres'))assert.equal(n.parent.className,'calendario-carril','Resumen fuera de la franja');
document.getElementById('cal-carriles-zoom').onclick();
assert.equal(nodos('calendario-carriles-scroll')[0].scrollLeft,138,'Hoy centrado: 9/20 × 640 − 300/2');
cambiarVista('semicirculo');cambiarVista('carriles');
assert.equal(nodos('calendario-carriles-scroll')[0].scrollLeft,138,'Reabrir la vista ampliada centra hoy');
document.getElementById('cal-carriles-zoom').onclick();
c.DATA.calendario.eventos=[e('gestion','2026-10-01')];mostrar();
assert.equal(nodos('calendario-carril-pista')[0].style.height,'calc(1 * var(--cal-fila) + 8px)');
almacen.set('hu.cal.vista','"desconocida"');mostrar();assert.equal(nodos('calendario-semicirculo').length,1,'Valor inválido vuelve a la vista predeterminada');
assert.match(css,/\.calendario-carriles-scroll\{[^}]*max-width:100%;overflow-x:hidden/);
assert.match(css,/\[data-ampliado=true\] \.calendario-carriles-scroll\{overflow-x:auto\}/);
assert.match(css,/\.calendario-carriles\{min-width:0\}/);
assert.match(css,/\.calendario-carriles-contenedor\{[^}]*--cal-fila:36px/);
assert.match(css,/@media\(max-width:600px\)\{\.calendario-carriles-contenedor\{--cal-fila:28px\}/);
assert.match(css,/\.calendario-carril-evento::before\{[^}]*44px/);
for(const bloque of css.matchAll(/\.calendario-carril-nombres\{([^}]+)\}/g))assert.doesNotMatch(bloque[1],/white-space:nowrap|overflow:hidden/);
assert.match(css,/\.calendario-carriles-contenedor\{[^}]*min-width:0;max-width:100%/);
assert.doesNotMatch(codigo,/'(?:Semicírculo|Carriles|Compacto|Detallado|Inscripción|Evaluación|Otros trámites|Desplaza)[^']*'/);
assert.doesNotMatch(document.getElementById('cal-periodo').textContent,/mitad/i);
console.log('SEMI3 OK: selector y recuerdo IPNT por unidad, selección carriles ↔ mes ↔ arco, grupos, teclado, retorno de foco móvil y estados.');
console.log('SEMI4 OK: filas de 28/36 px, carriles vacíos ocultos, resúmenes fuera del desplazamiento, periodo completo inicial y ampliación sincronizada con hoy visible.');
console.log('SEMI2 OK: '+leyendas+' leyendas por unidad, periodo y audiencia; colores propios AA y tarjeta sin prefijos duplicados.');

console.log('SEMI OK: datos y fusión, dos anillos, grupo ×N, selección arco ↔ mes, teclado, hoja móvil, vacío/antes/después, tres unidades y genérico, tokens claro/oscuro y textos por clave.');
