import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const fuente=readFileSync('web/sate/medicion.js','utf8');
function iniciar(search,apis=false){
  const nodos=[],observadores=[];
  const nodo=()=>({style:{},append(){},setAttribute(){},textContent:''});
  const c={URL,URLSearchParams,TextEncoder,location:{search,href:'https://ejemplo.test/index.html?medir'},window:null,
    navigator:{},SATE:{texto:k=>k},document:{createElement:()=>{const n=nodo();nodos.push(n);return n},body:{appendChild(){}},scripts:[{src:'',textContent:'abc'}],getElementsByTagName:()=>[1,2]},
    localStorage:{length:1,key:()=> 'saes.alumno',getItem:()=> 'ficticio'},console};c.window=c;
  if(apis){c.performance={now:()=>10,getEntriesByType:()=>[],mark(){},measure(){},memory:{usedJSHeapSize:5},measureUserAgentSpecificMemory:async()=>({bytes:42,breakdown:[{url:'privado'}]})};
    c.PerformanceObserver=class{constructor(fn){this.fn=fn;observadores.push(this)}observe(o){this.tipo=o.type}};
  }
  vm.createContext(c);vm.runInContext(fuente,c);return {c,nodos,observadores};
}
assert.equal(iniciar('').c.SateMedicion,undefined);
assert.equal(iniciar('?medirX').nodos.length,0);
const sin=iniciar('?medir').c;
const r=sin.SateMedicion.resultados();
for(const k of ['version','carga','pinturas','tareasLargas','renders','rutas','generaciones','interacciones','inpAproximado','memoria','dom','almacenamiento','dispositivo'])assert.ok(k in r,k);
assert.equal(r.memoria.heap,null);assert.equal(r.dispositivo.nucleos,null);
assert.ok(!JSON.stringify(r).includes('ficticio'));
const {c,observadores}=iniciar('?medir',true);
for(const o of observadores)o.fn({getEntries:()=>[{name:'first-contentful-paint',startTime:8,duration:24,interactionId:1,target:{closest:()=>({id:'b-gen'})}}]});
assert.equal(c.SateMedicion.resultados().pinturas.fcp,8);
assert.equal(c.SateMedicion.resultados().inpAproximado.ms,24);
assert.equal(await c.SateMedicion.render('mapa',()=>7),7);
await c.SateMedicion.render('perfil',()=>Promise.resolve(8));
assert.throws(()=>c.SateMedicion.render('fallo',()=>{throw Error('ficticio')}));
const m=c.SateMedicion.iniciar('generacion','auto');c.SateMedicion.terminar(m,{pasos:12});
assert.equal(c.SateMedicion.resultados().generaciones[0].pasos,12);
await c.SateMedicion.medirMemoria();assert.equal(c.SateMedicion.resultados().memoria.agente.bytes,42);
assert.ok(!JSON.stringify(c.SateMedicion.resultados()).includes('privado'));
c.renderMap=()=>9;c.SateMedicion.instrumentar();c.SateMedicion.instrumentar();assert.equal(c.renderMap(),9);
const motor=readFileSync('web/sate/horarios.js','utf8');
vm.runInContext(motor.slice(motor.indexOf('const GEN_MS='),motor.indexOf('function cancelarGeneracion')),c);
assert.equal(vm.runInContext('presupuestoGenerador({hardwareConcurrency:4}).nodos',c),60000);
assert.equal(vm.runInContext('presupuestoGenerador({deviceMemory:4}).clase',c),'baja');
assert.equal(vm.runInContext('presupuestoGenerador({connection:{saveData:true}}).clase',c),'baja');
assert.equal(vm.runInContext('presupuestoGenerador({hardwareConcurrency:6,deviceMemory:8}).nodos',c),140000);
assert.equal(vm.runInContext('presupuestoGenerador({hardwareConcurrency:8,deviceMemory:8}).ms',c),3000);
assert.equal(vm.runInContext('presupuestoGenerador({}).nodos',c),250000);
vm.runInContext(motor.slice(motor.indexOf('function* pasoGen'),motor.indexOf('async function iniciarGeneracion')),c);
vm.runInContext('globalThis.runBajo={start:10,nodes:60000,limited:false,presupuesto:presupuestoGenerador({deviceMemory:2})};pasoGen(runBajo).next()',c);
assert.equal(c.runBajo.limited,true);
c.performance.measureUserAgentSpecificMemory=()=>{throw Object.assign(Error(),{name:'SecurityError'})};
await c.SateMedicion.medirMemoria();assert.equal(c.SateMedicion.resultados().memoria.agente.noDisponible,'SecurityError');
assert.match(readFileSync('web/sate/inicio.js','utf8'),/parametros.has\('medir'\) \? script\('medicion.js'\)/);
console.log('OK medición: opt-in, APIs opcionales, privacidad, renders, generación y presupuestos.');
