// Motor y ciclo de interfaz reales en VM, con oferta ficticia y sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=f=>readFileSync(f,'utf8');
const fuente=leer('web/sate/horarios.js'), html=leer('web/sate/cascaron.html');
const config=JSON.parse(leer('web/dist/sate/index.html').match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
const nodos=new Map(), capturas={}, errores=[];
function nodo(id){
  if(!nodos.has(id))nodos.set(id,{id,innerHTML:'',textContent:'',hidden:false,disabled:false,checked:false,attrs:{},eventos:{},children:[],
    addEventListener(k,f){this.eventos[k]=f},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
    focus(){this.enfocado=true},appendChild(n){this.children.push(n)},insertBefore(n){this.children.push(n)},
    showModal(){this.open=true},close(){this.open=false;this.eventos.close?.()}});
  return nodos.get(id);
}
const oferta=Array.from({length:4},(_,i)=>['X','M',1,'G'+i,i,[],[[i,480,540]],6,'K'+i,'O']);
const tray={want:oferta.map(c=>c[8]),done:[],curso:[],oblig:[],fail:[]};
const plan={sel:['elegido'],own:[]}, workspace={marks:{},plan:'A'};
let reloj=null, fallo=false, calendarios=0;
const c=vm.createContext({console:{error:(...args)=>errores.push(args)},setTimeout,performance:{now:()=>reloj===null?performance.now():reloj++},
  document:{addEventListener(k,f){capturas[k]=f}},$:nodo,window:{},
  txH:(k,v={})=>(config.textos['sate.horarios.'+k]||k).replace(/\{(\w+)\}/g,(_,k)=>v[k]??k),
  S:{car:'X',per:'actual',fit:false,gap:null,onlyWant:true,chips:[],gpref:[],gavoid:[],gt:'*',gen:null},
  GT:{src:'todo',n:'',days:'',breaks:[]},DATA:{prof:[]},MARK:{sug:[]},
  classes:()=>{if(fallo)throw Error('fallo ficticio');return oferta},filtered:()=>oferta,
  tr:()=>tray,ws:()=>workspace,plan:()=>plan,ownAsClasses:()=>[],cur:()=>Object.fromEntries(oferta.map(x=>[x[8],[x[8],6]])),
  keyOf:c=>c[3]+'|'+c[8],norm:s=>s.toLowerCase(),tmin:()=>null,overlaps:()=>false,
  optCupo:()=>({}),optExceso:()=>({}),nivOpt:()=>null,cargaInfo:()=>null,statusOf:()=>'',
  breaksOk:()=>true,semanaOk:()=>true,semanaPena:()=>0,
  renderCal:()=>calendarios++,
  daysOf:cs=>[...new Set(cs.map(c=>c[6][0][0]))],
  esc:s=>String(s),fmtCr:String,pretty:s=>s,name:c=>c[8],DAYS:['Lu','Ma','Mi','Ju','Vi','Sa']});
const ejecutar=s=>vm.runInContext(s,c);
ejecutar(fuente.slice(fuente.indexOf('let generacion=null;'),fuente.indexOf('\nfunction renderOffer()')));
ejecutar(fuente.slice(fuente.indexOf("$('#b-gen').addEventListener"),fuente.indexOf("$('#offer').addEventListener('pointerover'")));
const generar=()=>ejecutar('iniciarGeneracion()');
function listo(){assert.equal(nodo('#b-gen').disabled,false);assert.equal(nodo('#b-gen').textContent,'Generar');assert.equal(nodo('#genres').attrs['aria-busy'],undefined);assert.equal(ejecutar('generacion'),null)}
// Excepción y recuperación sin recargar.
fallo=true;await generar();listo();assert.equal(errores.length,1);assert.match(nodo('#gen-status').textContent,/No se pudo/);
fallo=false;await generar();listo();assert.equal(c.S.gen.top.length,6);assert.equal(nodo('#b-gen-clear').hidden,false);
await generar();listo();assert.equal(c.S.gen.top.length,6);
const elegidas=[...tray.want], seleccionado=[...plan.sel];
nodo('#b-gen-clear').eventos.click();assert.equal(c.S.gen,null);assert.equal(nodo('#genres').innerHTML,'');assert.equal(nodo('#b-gen-clear').hidden,true);
assert.deepEqual(tray.want,elegidas);assert.deepEqual(plan.sel,seleccionado);assert.equal(nodo('#b-gen').enfocado,true);
assert.equal(calendarios,1,'Borrar también retira la vista previa de una opción sin cambiar la selección');
tray.want=[];await generar();listo();assert.match(nodo('#genres').innerHTML,/Selecciona materias/);
tray.want=elegidas;c.semanaOk=()=>false;await generar();listo();assert.equal(c.S.gen.top.length,0);assert.match(nodo('#genres').innerHTML,/No hay combinaciones/);
c.semanaOk=()=>true;
// Un clic nuevo invalida la corrida anterior, que no puede limpiar el estado de su sucesora.
const anterior=generar(), siguiente=generar();await Promise.all([anterior,siguiente]);listo();assert.ok(c.S.gen.top.length);
for(const evento of ['change','input','click']){
  const pendiente=generar();capturas[evento]({target:{closest:()=>({id:'otro-filtro'})}});await pendiente;listo();assert.equal(c.S.gen,null);
}
// Plazo vencido y retorno al estado normal, seguido de otra generación.
reloj=0;const pendiente=generar();reloj=4000;await pendiente;listo();assert.equal(c.S.gen.trunc,true);assert.match(nodo('#gen-status').textContent,/límite/);reloj=null;
await generar();listo();assert.ok(c.S.gen.top.length);
// La explosión combinatoria de subconjuntos rechazados también cede y termina.
const banco=Array.from({length:38},(_,i)=>({k:'B'+i,opts:[oferta[0]],must:false}));
c.banco=banco;c.cargaInfo=()=>({ret:100,tope:1,L:{min:1,media:1},adeudo:true});
ejecutar("globalThis.limite={start:performance.now(),nodes:0,limited:false};globalThis.busqueda=generateBank(banco,8,{marks:{},pscore:()=>0,oq:{},run:limite})");
let paso,cesiones=0;do{paso=ejecutar('busqueda.next()');if(!paso.done)cesiones++}while(!paso.done);
assert.ok(cesiones>0);assert.equal(c.limite.limited,true);assert.equal(paso.value.trunc,true);assert.ok(c.limite.nodes<=250128);
// El diálogo mueve el calendario real y lo devuelve al cerrar (incluido Escape nativo).
nodo('#b-horario').eventos.click();assert.equal(nodo('#horario-compacto').open,true);
assert.ok(nodo('#horario-compacto-cuerpo').children.includes(nodo('.calwrap')));
nodo('#horario-compacto-cerrar').eventos.click();assert.equal(nodo('#horario-compacto').open,false);assert.ok(nodo('.planner').children.includes(nodo('.calwrap')));
assert.match(html,/\.planner\{position:sticky/);
assert.match(html,/@media \(max-width:1024px\)\{\.hlayout/);
assert.match(html,/@media \(max-width:1024px\)\{\.horario-flotante\{display:block/);  // una columna y botón «Ver horario» bajo 981 px
assert.match(html,/\.horario-compacto \.cal\{min-width:0;grid-template-columns:2\.2rem repeat\(var\(--days\),minmax\(0,1fr\)\)/);
assert.match(html,/id="b-horario"[^>]*aria-haspopup="dialog"/);
assert.match(html,/id="horario-compacto" aria-labelledby=/);
console.log('OK generador: recuperación, segunda corrida, cancelación, vacíos, límites, borrado, calendario y contratos CSS. Sin verificación visual.');
