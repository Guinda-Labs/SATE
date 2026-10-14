// Ejecuta las funciones reales en VM con datos ficticios; no requiere navegador ni red.
import vm from 'node:vm';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
const fuente=readFileSync('web/sate/horarios.js','utf8');
const inicioBanco=performance.now();
let semilla=20261014;
const azar=()=>{semilla=(Math.imul(1664525,semilla)+1013904223)>>>0;return semilla/4294967296};
const filas=[];
for(const materias of [4,6,8,10,12]){
  const oferta=[];
  for(let i=0;i<materias;i++)for(let j=0,n=2+Math.floor(azar()*5);j<n;j++){
    const d=Math.floor(azar()*5),a=480+Math.floor(azar()*16)*30;
    oferta.push(['X','M',1,'G'+i+'-'+j,oferta.length,[],[[d,a,a+90]],6,'K'+i,'O']);
  }
  for(const modo of ['Automático','Todas']){
    const tray={want:Array.from({length:materias},(_,i)=>'K'+i),done:[],curso:[],oblig:[],fail:[]};
    const contexto=vm.createContext({performance,window:{},navigator:{hardwareConcurrency:8,deviceMemory:8},
      S:{car:'X',fit:false,gap:null,onlyWant:true,chips:[],gpref:[],gavoid:[],gt:'*'},
      GT:{src:'todo',n:modo==='Automático'?'auto':'',days:'',breaks:[]},DATA:{prof:[]},MARK:{sug:[]},
      $:()=>({checked:false}),txH:k=>k,classes:()=>oferta,filtered:()=>oferta,tr:()=>tray,ws:()=>({marks:{}}),
      ownAsClasses:()=>[],cur:()=>Object.fromEntries(tray.want.map(k=>[k,[k,6]])),
      keyOf:c=>c[3]+'|'+c[8],norm:s=>s.toLowerCase(),tmin:()=>null,
      overlaps:(a,b)=>a[6].some(x=>b[6].some(y=>x[0]===y[0]&&x[1]<y[2]&&y[1]<x[2])),
      optCupo:()=>({}),optExceso:()=>({}),nivOpt:()=>null,statusOf:()=>'',
      cargaInfo:()=>({ret:0,tope:80,L:{min:27,media:40},adeudo:false}),
      breaksOk:()=>true,semanaOk:()=>true,semanaPena:()=>0,daysOf:cs=>[...new Set(cs.flatMap(c=>c[6].map(x=>x[0])))]});
    vm.runInContext(fuente.slice(fuente.indexOf('let generacion=null;'),fuente.indexOf('\nfunction renderOffer()')),contexto);
    const inicio=performance.now();
    vm.runInContext('globalThis.run={start:performance.now(),nodes:0,limited:false};globalThis.iter=generarPasos(run);globalThis.r=null;do{r=iter.next()}while(!r.done)',contexto,{timeout:10000});
    filas.push({materias,grupos:tray.want.map(k=>oferta.filter(c=>c[8]===k).length),modo,pasos:contexto.run.nodes,ms:+(performance.now()-inicio).toFixed(2),opciones:contexto.r.value.top?.length||0,trunco:!!contexto.r.value.trunc});
  }
}
mkdirSync('docs/rendimiento',{recursive:true});
const msTotal=+(performance.now()-inicioBanco).toFixed(2);
writeFileSync('docs/rendimiento/bench-generador.json',JSON.stringify({version:1,semilla:20261014,node:process.version,msTotal,presupuesto:{ms:3000,nodos:250000},filas},null,2)+'\n');
console.table(filas.map(({grupos,...r})=>({...r,grupos:grupos.join('/')})));
if(msTotal>=60000)throw Error('El banco excedió 60 segundos');
