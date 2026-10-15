// Integración del rescate y del generador real, sin navegador, SAES ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=f=>readFileSync(f,'utf8'),nodos=new Map(),guardados=[],almacen={},eventosDOM={};
const nodo=id=>{if(!nodos.has(id))nodos.set(id,{innerHTML:'',textContent:'',hidden:false,style:{setProperty(){}},outerHTML:'<div class="cal"></div>',appendChild(){},after(){},append(){},addEventListener(){},setAttribute(){},focus(){}});return nodos.get(id)};
const oferta=[];
for(let i=0;i<5;i++)for(let j=0;j<3;j++)oferta.push(['X','M',1,'G'+i+j,i,[],[[i,540+j*90,630+j*90]],4,'K'+i]);
oferta[1][6]=[[1,540,630]];oferta[2][6]=[[1,540,630]];
const key=c=>c[3]+'|'+c[8],w={plan:'A',plans:{A:{sel:oferta.filter((c,i)=>i%3===0).map(key),own:[]}},marks:{}};
let omitir=false,miniaturas=0;
const cupos=c=>({disponibles:oferta.indexOf(c)%3===0?(oferta.indexOf(c)<6?0:oferta.indexOf(c)===6?2:10):10});
const c=vm.createContext({console,URL,URLSearchParams,Date,performance,DEMO:false,location:{href:'http://localhost/sate/index.html?vista=cupos',search:'?vista=cupos',hostname:'localhost'},
  document:{documentElement:{dataset:{}},querySelectorAll:()=>[],createElement:()=>nodo('nuevo'+nodos.size),querySelector:nodo,addEventListener:(k,f)=>eventosDOM[k]=f},$:nodo,UNIDAD:'unidad-ficticia',HU:'hu.ficticia.',CAPACIDADES:{saes:'https://saes.ficticia.ipn.mx'},SATE_CONFIG:{textos:{}},
  SATE:{texto:(k,v)=>k+(v?JSON.stringify(v):'')},SateUI:{cuadriculaHorario(cs,op){if(op.SLOTPX===18){miniaturas++;assert.equal(op.soloLectura,true);assert.ok(cs.every(x=>cupos(x).disponibles>0))}return []}},agendaHorario:()=>'',
  S:{car:'X',per:'actual',weekend:false,chips:[],gpref:[],gavoid:[],gt:'*',onlyWant:true},GT:{n:'',src:'todo',a:'',b:'',days:'',breaks:[]},DATA:{prof:[]},MARK:{sug:[]},
  W:{actual:w},ws:()=>w,plan:()=>w.plans.A,selected:()=>w.plans.A.sel.map(k=>oferta.find(c=>key(c)===k)),
  classes:()=>oferta,keyOf:key,byKey:k=>oferta.find(c=>key(c)===k),name:c=>c[8],profs:()=>'Docente ficticio',pattern:()=>['Lun 09:00–10:30'],
  overlaps:(a,b)=>a[6].some(x=>b[6].some(y=>x[0]===y[0]&&x[1]<y[2]&&y[1]<x[2])),ownAsClasses:()=>[],
  save:()=>guardados.push(JSON.stringify(w)),store:{get:(k,d)=>almacen[k]??d,set(k,v){almacen[k]=structuredClone(v);guardados.push(JSON.stringify(v))}},renderCal(){c.SateCuposVista.pintar()},
  CUPOS:{pintar(){},pocos:n=>n>0&&n<10,fila:cupos,insignia:()=>'lugares',omitirLlenos(){omitir=true},excluir:c=>omitir&&cupos(c).disponibles===0},
  esc:String,hm:String,DAYS:['Lun','Mar','Mié','Jue','Vie'],slots:c=>c.own?c.h:c[6],START:420,BLOCK:90,SLOT:30,hue:()=>1,roomAt:()=>'',structuredClone,
  txH:k=>k,tr:()=>almacen['t.X']??trayectoria,cur:()=>Object.fromEntries(oferta.map(c=>[c[8],[c[8],4,1,'O']])),norm:String,tmin:()=>null,
  conPlan:f=>f(),prereqs:()=>({}),suggestions:()=>({list:['K5']}),available:k=>!trayectoria.done.includes(k)&&!trayectoria.curso.includes(k),
  renderOffer(){},renderPlans(){},renderTray(){},saveT(){c.store.set('t.X',c.tr())},T:{},PLAN_CACHE:null,cargaInfo:n=>({total:n,L:{min:27,media:40,max:80},tope:80,ret:0}),fmtCr:String,
  renderSemana(){},SEMANA_ACTIVA:false,MQ_PHONE:{matches:false},cview:()=> 'dia',SLOTPX:30,pretty:String,textoCreditos:(k,n)=>n+' créditos',ayudaCreditos:()=>'',montarAyudasCreditos(){},tactil:()=>false,
  optCupo:()=>({}),optExceso:()=>({}),nivOpt:()=>null,breaksOk:()=>true,semanaOk:()=>true,semanaPena:()=>0,daysOf:cs=>[...new Set(cs.flatMap(c=>c[6].map(b=>b[0])))],isPersonal:()=>false});
c.window=c;
let trayectoria={want:[],done:[],curso:[],oblig:[],fail:[]};
const motor=leer('web/sate/horarios.js');
vm.runInContext(motor.slice(motor.indexOf('let generacion=null;'),motor.indexOf('function renderGen(')),c);
vm.runInContext(leer('web/sate/cupos-vista.js'),c);
const vista=c.SateCuposVista;await vista.montar();
// CUP11: función pura; los bloques y el resto de la selección no se modifican.
const materia=(materia,grupo,horas,nombre=materia)=>({materia,grupo,horas,nombre});
const retirada=materia('A','G1',[[0,600,660]]),otra=horas=>materia('B','G2',horas);
const bordes=[materia('C','G3',[[0,480,540]]),materia('D','G4',[[0,720,780]])];
const clasificar=vista.clasificarReemplazo,antesClasificar=JSON.stringify([retirada,bordes]);
assert.equal(clasificar(retirada,materia('A','G2',[[0,600,660]]),bordes),'tipo_misma_materia','Misma materia prevalece sobre horario y hueco');
assert.equal(clasificar(materia('A','G1',[], ' Cálculo  I '),materia('B','G2',[], 'calculo i'),[]),'tipo_misma_materia','Identidad por nombre normalizado');
assert.equal(clasificar(retirada,otra([[0,600,660]]),bordes),'tipo_mismo_horario','Horario exacto prevalece sobre hueco');
assert.equal(clasificar(retirada,otra([[0,540,720]]),bordes),'tipo_ocupa_hueco','Cuenta el hueco completo, incluidos descansos contiguos');
assert.equal(clasificar(retirada,otra([[0,550,580],[0,680,710]]),bordes),'tipo_ocupa_hueco','Puede reducir minutos aunque aumente el número de huecos');
assert.equal(clasificar(retirada,otra([[0,540,730]]),bordes),null,'No invade otra clase');
assert.equal(clasificar(retirada,otra([[1,540,600]]),bordes),null,'No confunde días');
assert.equal(clasificar(retirada,otra([[0,780,840]]),bordes),null,'No llama hueco a ampliar la jornada');
assert.equal(clasificar(retirada,otra([]),bordes),null,'Sin horario no afirma compatibilidad');
assert.equal(clasificar(retirada,otra([[0,550,580]]),[...bordes,materia('E','G5',[])]),null);
assert.equal(clasificar(retirada,otra([[0,550,580],[1,550,580]]),bordes),null,'Todos los bloques deben caber');
assert.equal(clasificar(retirada,otra([[0,550,580]]),[...bordes,materia('E','G5',[[0,540,600]])]),null,'Respeta actividades propias');
assert.equal(clasificar(retirada,otra([[0,550,580]]),[bordes[0]]),null,'Sin dos bordes no hay hueco interior');
assert.equal(clasificar(materia('A','G1',[[1,600,630],[0,540,600],[1,630,660]]),otra([[1,600,660],[0,540,600]]),[]),'tipo_mismo_horario','Orden y segmentación no alteran los bloques efectivos');
assert.equal(JSON.stringify([retirada,bordes]),antesClasificar);
assert.equal(nodo('#cupos-alerta').hidden,false);
assert.match(nodo('#cupos-alerta button').textContent,/"n":3/);
assert.match(vista.sugerencias(oferta[0]),/cupos-sugerencias/);
assert.equal(vista.alternativas(oferta[0]).length,2);assert.ok(vista.alternativas(oferta[0]).every(a=>a.choques.length));
// Aun con más lugares, la alternativa con choque se ordena al final.
oferta[4][6]=[[2,540,630]];
assert.equal(vista.alternativas(oferta[3])[0].c,oferta[5]);
const sesion=oferta[4][6];oferta[4][6]=[[1,630,720]];
const filaBase=c.CUPOS.fila;c.CUPOS.fila=x=>({disponibles:x===oferta[4]?25:filaBase(x).disponibles});
assert.equal(vista.alternativas(oferta[3])[0].c,oferta[4],'Entre grupos sin choque, más lugares primero');
c.CUPOS.fila=filaBase;oferta[4][6]=sesion;
const original=w.plans.A.sel.slice();
vista.cambiar(oferta[5],oferta[3]);
assert.ok(w.plans.A.sel.includes(key(oferta[5])));assert.equal(guardados.length,1);
vista.restaurar();assert.deepEqual(w.plans.A.sel,original);assert.equal(guardados.length,2);
trayectoria={want:[],oblig:['AJENA'],done:['K1'],curso:['K0'],fail:[]};
await vista.buscar();assert.ok(miniaturas>0&&miniaturas<=3);assert.equal(omitir,true);
eventosDOM.click({target:{closest:()=>({dataset:{cuposUsar:'0'},hasAttribute:()=>false})}});
assert.equal(w.plans.A.sel.length,5);assert.ok(c.selected().every(x=>cupos(x).disponibles>0));
vista.restaurar();assert.deepEqual(w.plans.A.sel,original);
vista.aplicar([oferta[1]]);w.plans.A.sel=[key(oferta[2])];vista.restaurar();assert.deepEqual(w.plans.A.sel,[key(oferta[2])]);
// Reemplazos de otra materia, usando los filtros y recomendaciones reales del núcleo.
const core=leer('web/sate/nucleo.js');
w.plans.A.sel=original.slice();trayectoria={want:['K0'],done:['K7'],curso:[],oblig:[],fail:[]};
for(let i=5;i<=12;i++)oferta.push(['X','M',1,'R'+i,i,[],[[0,540,630]],i===6?70:4,'K'+i]);
oferta.at(-3)[6]=[[1,540,630]]; // K10 choca con K1.
oferta.at(-2)[6]=[]; // K11 no permite comprobar compatibilidad.
oferta.at(-1)[0]='OTRO'; // K12 pertenece a otro plan/carrera.
c.isPersonal=()=>true;c.ALUMNO={};c.PLAN_PASO=0;c.failInfo=()=>null;c.semNow=()=>null;c.semRef=()=>null;c.DESFASE_SEM=new Set();
c.semOf=()=>({});c.dependents=()=>({K5:['K6']});c.offeredClaves=()=>new Set(oferta.map(x=>x[8]));c.aunNo=()=>false;c.isElec=()=>false;
c.prereqs=()=>({K8:['PENDIENTE']});c.cargaInfo=n=>({total:n,L:{min:27,media:4,max:80},tope:80,libre:80,ret:0});
vm.runInContext(core.slice(core.indexOf('function statusOf('),core.indexOf('// Las electivas se acreditan')),c);
vm.runInContext(core.match(/function available\(k\)\{[^\n]+/)[0],c);
vm.runInContext(core.slice(core.indexOf('function suggestions('),core.indexOf('let ZOOM=')),c);
assert.deepEqual(Array.from(vista.otras(oferta[0]),a=>a.c[8]),['K5','K6','K9']);
const html= vista.sugerencias(oferta[0]);
assert.match(html,/class="sate-chip sate-chip--reemplazo" data-estado="info"/);
assert.match(html,/tipo_misma_materia<\/span><\/span><\/div><b>/,'Etiqueta encima del nombre');
assert.match(html,/tipo_mismo_horario/);
// La clasificación se conecta al render, además de comprobarse aisladamente.
const horasOriginales=oferta.find(x=>x[8]==='K5')[6];
oferta.find(x=>x[8]==='K5')[6]=[[1,650,700]];
const horasBorde=oferta[4][6];oferta[4][6]=[[1,720,780]];
const seleccionBorde=w.plans.A.sel.slice();w.plans.A.sel.push(key(oferta[4]));
assert.match(vista.sugerencias(oferta[0]),/tipo_ocupa_hueco/);
w.plans.A.sel=seleccionBorde;oferta[4][6]=horasBorde;oferta.find(x=>x[8]==='K5')[6]=horasOriginales;
assert.ok(html.indexOf('misma_materia')<html.indexOf('recomendada'));
assert.ok(html.indexOf('recomendada')<html.indexOf('todas_disponibles'));
for(const k of ['K7','K8','K10','K11','K12'])assert.ok(!html.includes('data-cupos-cambiar="R'+k.slice(1)+'|'+k+'"'),k+' excluida');
assert.match(html,/choque_con/);
for(const k of ['K7','K8','K10','K11','K12']){const antes=w.plans.A.sel.slice();vista.cambiar(oferta.find(x=>x[8]===k),oferta[0]);assert.deepEqual(w.plans.A.sel,antes,'Rechaza reemplazo inválido '+k)}
const personal=c.isPersonal;c.isPersonal=()=>false;assert.ok(!vista.otras(oferta[0]).some(a=>a.c[8]==='K8'),'Sin perfil tampoco se asumen requisitos acreditados');c.isPersonal=personal;
const mapaAntes=structuredClone(trayectoria);almacen['t.X']=structuredClone(trayectoria);
vista.cambiar(oferta.find(x=>x[8]==='K5'),oferta[0]);
assert.ok(c.tr().want.includes('K5'));assert.ok(!c.tr().want.includes('K0'));
assert.ok(w.plans.A.sel.includes('R5|K5'));assert.match(vista.avisoCarga(oferta.find(x=>x[8]==='K5')),/cambio_carga/);
vista.restaurar();assert.deepEqual(w.plans.A.sel,original);assert.deepEqual(c.tr(),mapaAntes);
vista.cambiar(oferta.find(x=>x[8]==='K6'),oferta[0]);
assert.match(vista.avisoCarga(oferta.find(x=>x[8]==='K6')),/"n":"86"/);
c.tr().want.push('EDICION_POSTERIOR');vista.restaurar();assert.ok(w.plans.A.sel.includes('R6|K6'));assert.match(nodo('#cupos-cambio').textContent,/deshacer_conflicto/);
// Integración del renderCal real, tanto en SATE principal como en la vista reducida.
vm.runInContext(motor.slice(motor.indexOf('function renderCal('),motor.indexOf('function renderOwnForm(')),c);
c.renderCal();assert.match(nodo('#sel').innerHTML,/sel-meta.*lugares/s);assert.match(nodo('#sel').innerHTML,/cupos-riesgo/);
const resumen=nodo('#sel').innerHTML;c.document.documentElement.dataset.vista='cupos';c.renderCal();assert.equal(nodo('#sel').innerHTML,resumen);
const filaAnterior=c.CUPOS.fila,insigniaAnterior=c.CUPOS.insignia;c.CUPOS.fila=()=>null;c.CUPOS.insignia=()=>'';c.renderCal();
assert.doesNotMatch(nodo('#sel').innerHTML,/cupos-riesgo|cupos-sugerencias|lugares/);assert.equal(nodo('#cupos-alerta').hidden,true);
c.CUPOS.fila=filaAnterior;c.CUPOS.insignia=insigniaAnterior;
// Redirección ejecutada, conserva modo, unidad, parámetros OAuth y opener.
let destino;const opener={};const loc={href:'https://sate.test/sate/cupos.html?unidad=unidad-ficticia&modo=saes&code=ficticio',search:'?unidad=unidad-ficticia&modo=saes&code=ficticio',hash:'#estado',replace:u=>destino=new URL(u)};
vm.runInNewContext([...leer('web/sate/cupos.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1],{URL,URLSearchParams,location:loc,opener});
assert.equal(destino.pathname,'/sate/index.html');assert.equal(destino.searchParams.get('vista'),'cupos');assert.equal(destino.searchParams.get('modo'),'saes');assert.equal(destino.searchParams.get('code'),'ficticio');assert.equal(destino.hash,'#estado');
const css=leer('web/sate/cascaron.html');assert.match(css,/html\[data-vista=cupos\] \.sate-navegacion/);assert.match(css,/#cupos-vista button.*min-height:44px/);
assert.match(leer('web/sate/componentes.css'),/\.sate-chip--reemplazo\{[^}]*white-space:normal[^}]*margin-bottom:var\(--ipn-esp-2\)/);
assert.match(leer('web/dist/sate.js'),/sate\/index\.html\?vista=cupos/);
// El núcleo completo adopta los cambios de la ventana receptora sin escribirlos otra vez.
const eventos={};let renders=0;
const sincronizado={actual:{plan:'A',plans:{A:{sel:[],own:[]}}}},nuevo={plan:'A',plans:{A:{sel:['alternativa'],own:[]}}};
vm.runInNewContext(core.slice(core.indexOf('// storage no se dispara'),core.indexOf('/*__SAES_JS__*/')),
  {window:{addEventListener:(k,f)=>eventos[k]=f},DEMO:false,HU:'hu.ficticia.',S:{per:'actual'},W:sincronizado,store:{get:()=>nuevo},renderPlans:()=>renders++,renderOffer:()=>renders++,renderCal:()=>renders++});
eventos.storage({key:'hu.ajena.w.actual'});assert.equal(renders,0);
eventos.storage({key:'hu.ficticia.w.actual'});assert.equal(sincronizado.actual,nuevo);assert.equal(renders,3);
assert.match(css,/@media\(max-width:639px\)/);assert.match(css,/\.ticks\{display:flex;flex-wrap:wrap/);
assert.match(leer('web/sate/inicio.js'),/await script\('cupos.js'\); await script\('cupos-vista.js'\)/);
console.log('OK CUP10/CUP11: resumen compartido, clasificación pura, prioridad y chips de reemplazo, huecos reales, elegibilidad, cambiar/deshacer, carga y generador. Sin navegador ni red.');
