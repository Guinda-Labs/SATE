// Arranque y Lector reales con perfiles ficticios y DOM en memoria, sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=f=>readFileSync(f,'utf8');
const html=leer('web/dist/sate/index.html');
const config=JSON.parse(html.match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
const inicio=leer('web/dist/sate/inicio.js');
const saes=leer('web/dist/sate/generico.js').match(/const SAES=\{[\s\S]*?\n\};/)[0];
const generico=leer('web/sate/generico.js');
const adaptador=generico.slice(generico.indexOf('(function () {'),generico.indexOf('  const unidad ='))+'})();';
async function entorno(valores={},search='',hash=''){
  const nodos=new Map(), archivos=[], consultas=[], timers=[];
  function nodo(tag='div'){
    return {tag,hidden:false,value:'',dataset:{},children:[],eventos:{},style:{setProperty(){}},classList:{toggle(){}},
      setAttribute(k,v){this[k]=v},getAttribute(){return null},removeAttribute(k){delete this[k]},
      appendChild(n){this.children.push(n)},replaceChildren(...n){this.children=n},
      querySelector(s){return s==='img'?this.children.find(n=>n.tag==='img'):obtener(s)},
      addEventListener(k,f){this.eventos[k]=f},showModal(){this.open=true},focus(){this.foco=true}};
  }
  function obtener(id){if(!nodos.has(id))nodos.set(id,nodo());return nodos.get(id)}
  const doc={documentElement:nodo(),body:nodo(),head:{appendChild(s){archivos.push(s.src);s.onload()}},
    createElement:nodo,getElementById:obtener,querySelector:s=>s==='html[data-pestanas]'?null:obtener(s),
    querySelectorAll:()=>[],addEventListener(){}};
  const c=vm.createContext({console,URLSearchParams,document:doc,
    location:{pathname:'/sate/index.html',search,hash},localStorage:{getItem:k=>valores[k]??null},
    IPNT:{set(k,v){valores[k]=v}},SATE_CONFIG:structuredClone(config),
    SateUI:{usarTextos(){},ayuda:()=>nodo(),modal(t,n){c.menu=n}},setTimeout:f=>timers.push(f),
    fetch:url=>{consultas.push(url);return new Promise(()=>{})},
    navigator:{},matchMedia:()=>({matches:false,addEventListener(){}})});
  vm.runInContext('window=globalThis',c);
  vm.runInContext(leer('web/sate/rutas.js'),c);
  vm.runInContext(inicio,c);
  await new Promise(r=>setImmediate(r));
  return {c,obtener,valores,archivos,consultas,timers};
}
for(const [valores,search,hash,esperada] of [
  [{},'','',null],
  [{'saes.alumno':JSON.stringify({unidad:'encb'})},'','','encb'],
  [{'ipnt.unidad':'escom'},'','','escom'],
  [{'ipnt.unidad':'escom','saes.alumno':JSON.stringify({unidad:'encb'})},'','','encb'],
  [{'ipnt.unidad':'escom','saes.alumno':JSON.stringify({unidad:'encb'})},'?sateUnidad=upibi','','upibi'],
  [{},'?sateUnidad=escom','#/upiita/mapa','upiita'],
  [{'ipnt.unidad':'escom','saes.alumno':JSON.stringify({unidad:'encb'})},'?sateEntrada=1','',null],
  [{'saes.alumno':'datos inválidos'},'','',null],
  [{},'','#code=ficticio',null]
]){
  const e=await entorno(valores,search,hash);
  assert.equal(e.c.SATE_UNIDAD,esperada,JSON.stringify({search,hash,valores}));
  if(esperada){assert.equal(e.c.document.body['data-sate-entrada'],undefined);continue}
  assert.equal(e.c.document.body['data-sate-entrada'],'true');
  assert.equal(e.consultas.length,0,'La entrada no descarga datos académicos');
  assert.deepEqual(e.archivos,['generico.js']);
  const panel=e.obtener('sate-entrada'), [titulo,alternativa,etiqueta,buscar,estado,lista]=panel.children;
  assert.equal(titulo.textContent,'¿De qué unidad académica eres?');
  assert.equal(alternativa.textContent,'O carga tus datos del SAES');
  assert.equal(alternativa['data-saes-open'],'');assert.equal(etiqueta.htmlFor,buscar.id);
  assert.equal(buscar['aria-controls'],lista.id);assert.equal(estado.role,'status');
  assert.equal(lista.children.length,Object.keys(config.identidadUnidades).length);
  for(const fila of lista.children){
    const boton=fila.children[0];assert.equal(boton.type,'button');
    assert.equal(boton.children[0].querySelector('img').alt,'','El nombre accesible proviene del texto de la unidad');
  }
  assert.deepEqual(lista.children.slice(0,Object.keys(config.unidades).length).map(n=>n.children[0].dataset.unidad).sort(),Object.keys(config.unidades).sort());
  buscar.value='biol';buscar.eventos.input();
  assert.deepEqual(lista.children.filter(n=>!n.hidden).map(n=>n.children[0].dataset.unidad),['encb']);
  buscar.value='sin coincidencia';buscar.eventos.input();assert.equal(lista.children.filter(n=>!n.hidden).length,0);
  assert.equal(estado.textContent,config.textos['sate.entrada.sin_resultados']);
  buscar.value='';buscar.eventos.input();
  const encb=lista.children.find(n=>n.children[0].dataset.unidad==='encb').children[0];
  encb.onclick();assert.equal(valores['ipnt.unidad'],'encb');assert.equal(e.c.location.href,'index.html?sateUnidad=encb');
}
const perfilGuardado=JSON.stringify({upiita_saes:1,unidad:'encb',acreditadas:[],boleta:'DEMO'});
const cambio=await entorno({'ipnt.unidad':'encb','saes.alumno':perfilGuardado});
cambio.c.SATE.elegirUnidad();cambio.c.menu.children[0].onclick();
assert.equal(cambio.c.location.href,'index.html?sateEntrada=1');
assert.equal(cambio.valores['saes.alumno'],perfilGuardado);assert.equal(cambio.valores['ipnt.unidad'],'encb');
// Pegado en la entrada: reutiliza wire/save/redirección del Lector para ambas clases de unidad.
for(const unidad of ['upiita','encb']){
  const e=await entorno();vm.runInContext(saes+'\n'+adaptador+'\nglobalThis.lector=SAES;',e.c);
  await e.c.lector.open();assert.equal(e.obtener('saes-dlg').open,true);
  const datos={upiita_saes:1,unidad,acreditadas:[],boleta:'DEMO'};
  await e.obtener('#saes-paste').eventos.paste({preventDefault(){},clipboardData:{getData:()=>JSON.stringify(datos)}});
  assert.deepEqual(JSON.parse(e.valores['saes.alumno']),datos);
  e.timers.at(-1)();assert.equal(e.c.location.href,'index.html?sateUnidad='+unidad);
  assert.ok(!e.archivos.includes('tramites.js'),'La entrada no carga confirmaciones de una unidad ajena');
}
const css=leer('web/sate/componentes.css');
assert.match(css,/grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,16rem\),1fr\)\)/);
assert.match(css,/\.sate-entrada>input\{[^}]*box-sizing:border-box;width:100%;min-width:0/);
assert.match(css,/\.sate-entrada :is\(input,button\):focus-visible/);
const legacy=await entorno();assert.equal(legacy.c.SateRutas.redireccion(null,'',''),'sate/index.html');
for(const u of Object.keys(config.unidades))assert.equal(legacy.c.SateRutas.redireccion(u,'',''),'sate/index.html#/'+u+'/mapa');
assert.match(leer('web/dist/index.html'),/href="sate\/index.html">Abrir SATE/);
console.log('Entrada SATE: prioridades, catálogo, búsqueda biol, selección, cambio y pegado real del SAES OK; DOM sin navegador ni red.');
