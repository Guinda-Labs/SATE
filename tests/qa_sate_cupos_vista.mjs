// Integración del rescate y del generador real, sin navegador, SAES ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=f=>readFileSync(f,'utf8'),nodos=new Map(),guardados=[];
const nodo=id=>{if(!nodos.has(id))nodos.set(id,{innerHTML:'',textContent:'',hidden:false,style:{setProperty(){}},outerHTML:'<div class="cal"></div>',appendChild(){},after(){},append(){},addEventListener(){},setAttribute(){}});return nodos.get(id)};
const oferta=[];
for(let i=0;i<5;i++)for(let j=0;j<3;j++)oferta.push(['X','M',1,'G'+i+j,i,[],[[i,540+j*90,630+j*90]],4,'K'+i]);
oferta[1][6]=[[1,540,630]];oferta[2][6]=[[1,540,630]];
const key=c=>c[3]+'|'+c[8],w={plan:'A',plans:{A:{sel:oferta.filter((c,i)=>i%3===0).map(key),own:[]}},marks:{}};
let omitir=false,miniaturas=0;
const cupos=c=>({disponibles:oferta.indexOf(c)%3===0?(oferta.indexOf(c)<6?0:oferta.indexOf(c)===6?2:10):10});
const c=vm.createContext({console,URL,URLSearchParams,Date,performance,DEMO:false,location:{href:'http://localhost/sate/index.html?vista=cupos',search:'?vista=cupos',hostname:'localhost'},
  document:{createElement:()=>nodo('nuevo'+nodos.size),querySelector:nodo,addEventListener(){}},$:nodo,UNIDAD:'unidad-ficticia',HU:'hu.ficticia.',CAPACIDADES:{saes:'https://saes.ficticia.ipn.mx'},SATE_CONFIG:{textos:{}},
  SATE:{texto:k=>k},SateUI:{cuadriculaHorario(cs,op){miniaturas++;assert.equal(op.soloLectura,true);assert.ok(cs.every(x=>cupos(x).disponibles>0));return []}},agendaHorario:()=>'',
  S:{car:'X',per:'actual',weekend:false,chips:[],gpref:[],gavoid:[],gt:'*',onlyWant:true},GT:{n:'',src:'todo',a:'',b:'',days:'',breaks:[]},DATA:{prof:[]},MARK:{sug:[]},
  W:{actual:w},ws:()=>w,plan:()=>w.plans.A,selected:()=>w.plans.A.sel.map(k=>oferta.find(c=>key(c)===k)),
  classes:()=>oferta,keyOf:key,byKey:k=>oferta.find(c=>key(c)===k),name:c=>c[8],profs:()=>'Docente ficticio',pattern:()=>['Lun 09:00–10:30'],
  overlaps:(a,b)=>a[6].some(x=>b[6].some(y=>x[0]===y[0]&&x[1]<y[2]&&y[1]<x[2])),ownAsClasses:()=>[],
  save:()=>guardados.push(JSON.stringify(w)),store:{set:(k,v)=>guardados.push(JSON.stringify(v))},renderCal(){c.SateCuposVista.pintar()},
  CUPOS:{fila:cupos,insignia:()=>'lugares',omitirLlenos(){omitir=true},excluir:c=>omitir&&cupos(c).disponibles===0},
  esc:String,hm:String,DAYS:['Lun','Mar','Mié','Jue','Vie'],slots:c=>c[6],START:420,BLOCK:90,SLOT:30,hue:()=>1,roomAt:()=>'',
  txH:k=>k,tr:()=>({want:[],done:[],curso:[],oblig:[]}),cur:()=>Object.fromEntries(oferta.map(c=>[c[8],[c[8],4]])),norm:String,tmin:()=>null,
  optCupo:()=>({}),optExceso:()=>({}),nivOpt:()=>null,breaksOk:()=>true,semanaOk:()=>true,semanaPena:()=>0,daysOf:cs=>[...new Set(cs.flatMap(c=>c[6].map(b=>b[0])))],isPersonal:()=>false});
c.window=c;
const motor=leer('web/sate/horarios.js');
vm.runInContext(motor.slice(motor.indexOf('let generacion=null;'),motor.indexOf('function renderGen(')),c);
vm.runInContext(leer('web/sate/cupos-vista.js'),c);
const vista=c.SateCuposVista;await vista.montar();
assert.match(nodo('#cupos-riesgos').innerHTML,/K0.*K1.*K2/s);
assert.equal(nodo('#cupos-buscar').hidden,false);
assert.equal(vista.alternativas(oferta[0]).length,2);assert.ok(vista.alternativas(oferta[0]).every(a=>a.choques.length));
// Aun con más lugares, la alternativa con choque se ordena al final.
oferta[4][6]=[[2,540,630]];
assert.equal(vista.alternativas(oferta[3])[0].c,oferta[5]);
const original=w.plans.A.sel.slice();
const raiz=[...nodos.values()].find(n=>n.id==='cupos-vista');
raiz.onclick({target:{closest:()=>({dataset:{cuposCambiar:key(oferta[5]),cuposQuitar:key(oferta[3])}})}});
assert.ok(w.plans.A.sel.includes(key(oferta[5])));assert.equal(guardados.length,1);
vista.restaurar();assert.deepEqual(w.plans.A.sel,original);assert.equal(guardados.length,2);
c.tr=()=>({want:[],oblig:['AJENA'],done:['K1'],curso:['K0']});
await vista.buscar();assert.ok(miniaturas>0&&miniaturas<=3);assert.equal(omitir,true);
raiz.onclick({target:{closest:()=>({dataset:{cuposUsar:'0'}})}});
assert.equal(w.plans.A.sel.length,5);assert.ok(c.selected().every(x=>cupos(x).disponibles>0));
vista.restaurar();assert.deepEqual(w.plans.A.sel,original);
vista.aplicar([oferta[1]]);w.plans.A.sel=[key(oferta[2])];vista.restaurar();assert.deepEqual(w.plans.A.sel,[key(oferta[2])]);
// Redirección ejecutada, conserva modo, unidad, parámetros OAuth y opener.
let destino;const opener={};const loc={href:'https://sate.test/sate/cupos.html?unidad=unidad-ficticia&modo=saes&code=ficticio',search:'?unidad=unidad-ficticia&modo=saes&code=ficticio',hash:'#estado',replace:u=>destino=new URL(u)};
vm.runInNewContext(leer('web/sate/cupos.html').match(/<script>([\s\S]*?)<\/script>/)[1],{URL,URLSearchParams,location:loc,opener});
assert.equal(destino.pathname,'/sate/index.html');assert.equal(destino.searchParams.get('vista'),'cupos');assert.equal(destino.searchParams.get('modo'),'saes');assert.equal(destino.searchParams.get('code'),'ficticio');assert.equal(destino.hash,'#estado');
const css=leer('web/sate/cascaron.html');assert.match(css,/html\[data-vista=cupos\] \.sate-navegacion/);assert.match(css,/#cupos-vista button.*min-height:44px/);
assert.match(leer('web/dist/sate.js'),/sate\/index\.html\?vista=cupos/);
// El núcleo completo adopta los cambios de la ventana receptora sin escribirlos otra vez.
const core=leer('web/sate/nucleo.js'),eventos={};let renders=0;
const sincronizado={actual:{plan:'A',plans:{A:{sel:[],own:[]}}}},nuevo={plan:'A',plans:{A:{sel:['alternativa'],own:[]}}};
vm.runInNewContext(core.slice(core.indexOf('// storage no se dispara'),core.indexOf('/*__SAES_JS__*/')),
  {window:{addEventListener:(k,f)=>eventos[k]=f},DEMO:false,HU:'hu.ficticia.',S:{per:'actual'},W:sincronizado,store:{get:()=>nuevo},renderPlans:()=>renders++,renderOffer:()=>renders++,renderCal:()=>renders++});
eventos.storage({key:'hu.ajena.w.actual'});assert.equal(renders,0);
eventos.storage({key:'hu.ficticia.w.actual'});assert.equal(sincronizado.actual,nuevo);assert.equal(renders,3);
console.log('OK CUP8: riesgos, orden sin choques, cambiar y deshacer, conflicto de edición, motor sin llenos, tres miniaturas y redirección compatible.');
