// R16: navegación entre plataformas sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {crearEntorno} from './dom_minimo.mjs';
const leer=p=>readFileSync(p,'utf8');
const inicio=leer('web/sate/inicio.js');
const config=JSON.parse(leer('data/sate.json')).unidades;
for(const u of Object.keys(config)) {
  const {document}=crearEntorno();
  const cab=document.createElement('header');cab.className='sate-encabezado';
  const marca=document.createElement('div');marca.className='sate-marca';
  const siglas=document.createElement('span');siglas.className='sate-siglas';marca.appendChild(siglas);cab.appendChild(marca);document.body.appendChild(cab);
  const brand=document.createElement('div');brand.className='brand';marca.appendChild(brand);
  const contenido=document.createElement('section');contenido.setAttribute('id','sate-guia');document.body.appendChild(contenido);
  const almacen=new Map();let posicion;
  const c=vm.createContext({document,u,config,console,Number,JSON,
    texto:(k,v={})=>k==='sate.puentes.regresar'?'‹ Regresar a '+v.origen:k,
    requestAnimationFrame:f=>f(),window:{scrollTo:(_,y)=>posicion=y},
    sessionStorage:{setItem:(k,v)=>almacen.set(k,v),getItem:k=>almacen.get(k),removeItem:k=>almacen.delete(k)}});
  vm.runInContext(leer('web/sate/rutas.js'),c);
  c.SateRutas=c.window.SateRutas;
  vm.runInContext(inicio.slice(inicio.indexOf('  let regresoPuente'),inicio.indexOf('  function error(e)')),c);
  vm.runInContext(`pintarPlataformas({pestana:'mapa'});pintarPlataformas({pestana:'guia'});`,c);
  const boton=document.getElementById('b-plataforma');
  assert.equal(document.querySelectorAll('#b-plataforma').length,1);
  assert.equal(boton.className,'sate-unidad-btn sate-siglas');
  assert.equal(boton.getAttribute('aria-haspopup'),'dialog');
  assert.equal(boton.textContent,'sate.pestana.guia.titulo');
  let opciones;
  c.selectorMarca=(_,lista)=>opciones=lista;
  boton.onclick();
  assert.equal(opciones.length,2);
  assert.equal(opciones[1].actual,true);
  assert.equal(opciones[0].href,'#/'+u+'/mapa');
  vm.runInContext("pintarPlataformas({pestana:'mapa'})",c);
  boton.onclick();assert.equal(opciones[0].actual,true);
  assert.equal(opciones[1].href,'#/'+u+'/guia');
  const origen={hash:'#/'+u+'/mapa',nombre:'Mapa curricular',y:437};
  c.origen=origen;c.destino='#/'+u+'/guia';
  vm.runInContext('guardarPuente(origen,destino);restaurarPuente({hash:destino,pestana:"guia"})',c);
  const volver=document.getElementById('sate-regresar');assert.equal(volver.getAttribute('href'),origen.hash);
  assert.equal(volver.textContent,'‹ Regresar a Mapa curricular');volver.onclick();
  assert.equal(volver.parentNode.parentNode,contenido.parentNode,'el regreso queda pegado antes del contenido de Guía');
  vm.runInContext('restaurarPuente({hash:origen.hash})',c);assert.equal(posicion,437);
  c.origen=origen;c.destino='#/'+u+'/guia';
  vm.runInContext('guardarPuente(origen,destino);restaurarPuente({hash:destino,pestana:"guia"})',c);
  document.querySelector('.sate-regreso-cerrar').onclick();
  assert.equal(document.getElementById('sate-regresar'),null,'× descarta el regreso');
  assert.equal(almacen.has('ipnt.puente'),false,'× borra el salto pendiente');
  c.origen=origen;c.destino='#/'+u+'/guia';
  vm.runInContext('guardarPuente(origen,destino);restaurarPuente({hash:destino,pestana:"guia"});restaurarPuente({hash:"#/"+u+"/horarios",pestana:"horarios"})',c);
  assert.equal(almacen.has('ipnt.puente'),false,'navegar a otra sección descarta el salto pendiente');
  c.sessionStorage.getItem=()=>{throw Error('almacen bloqueado')};
  vm.runInContext('restaurarPuente({hash:destino})',c);
}
const css=leer('web/sate/componentes.css');
assert.match(css,/a:visited\{color:var\(--ipn-acento\)\}/,'los enlaces visitados conservan el color de acción');
assert.match(css,/\.sate-regreso\{[^}]*margin:0 0 var\(--ipn-esp-3\)/);
assert.match(css,/\.sate-regreso-cerrar\{[^}]*min-width:var\(--ipn-objetivo-tactil\)[^}]*min-height:var\(--ipn-objetivo-tactil\)/);
assert.match(css,/html\[data-vista=guia-vinculada\] #sate-nombre\{display:none\}/);
const cssEnc=leer('web/sate/encabezado.css');
assert.match(cssEnc,/@media\(min-width:1024px\)[\s\S]*?grid-template-areas:"marca contexto acciones"/,
  'desde 1024 px el puente mantiene marca, carrera y acciones en la misma fila');
assert.match(cssEnc,/@media\(min-width:1024px\) and \(max-width:1199px\)/,
  'el escalón corto se limita a 1024–1199 px');
assert.match(cssEnc,/\.sate-encabezado:has\(#b-plataforma\) #sate-leyenda\{[^}]*color:transparent/);
assert.match(cssEnc,/\.sate-encabezado:has\(#b-plataforma\) #sate-leyenda (?:\.sate-ayuda__btn)?::before\{content:"•"/,
  'la fase de prueba se reduce a un punto con el title como ayuda');
assert.match(cssEnc,/\.sate-encabezado:has\(#b-plataforma\) \.header-actions \.saes-open \.sate-texto-corto\{display:inline\}/,
  'el escalón corto muestra Actualizar y conserva el aria-label del botón');
assert.match(cssEnc,/@media\(max-width:767px\)/);
assert.match(inicio,/function selectorMarca\(titulo, opciones\)/);
assert.match(inicio,/selectorMarca\(texto\('sate.encabezado.unidad'\)/);
assert.match(inicio,/boton.onclick=\(\)=>selectorMarca/);
assert.doesNotMatch(inicio,/sate-plataformas/);
// Ambos selectores construyen sus opciones y delegan el foco/Escape al mismo diálogo.
{
  const {document}=crearEntorno();let caja,cerrados=0;
  const c=vm.createContext({document,texto:k=>k,location:{},SateUI:{modal:(_,n)=>{caja=n;return {cerrar:()=>cerrados++}}}});
  vm.runInContext(inicio.slice(inicio.indexOf('  function selectorMarca('),inicio.indexOf('  async function mostrarEntrada(')),c);
  vm.runInContext('elegirUnidad()',c);
  assert.equal(caja.className,'sate-selector-marca');
  caja.children[0].onclick();assert.equal(c.location.href,'index.html?sateEntrada=1');
  vm.runInContext("selectorMarca('Plataformas',[{texto:'SATE',href:'#/unidad/mapa',actual:true},{texto:'Guía politécnica',href:'#/unidad/guia'}])",c);
  assert.equal(caja.className,'sate-selector-marca');
  assert.equal(caja.children[0].getAttribute('aria-current'),'page');
  assert.equal(caja.children[1].getAttribute('aria-current'),null);
  caja.children[1].onclick();assert.equal(cerrados,2);
}
// Sin navegador se comprueban las reglas, no se afirma haber medido geometría.
assert.match(css,/\.sate-marca:has\(#b-plataforma\) #sate-titulo\{font-size:var\(--ipn-tamano-s\)\}/);
assert.doesNotMatch(css,/\.sate-marca:has\(#b-plataforma\)[^{]*\.sate-siglas[^}]*display:none/);
assert.match(inicio,/filter\(id=>id!=='guia'\)/);
assert.match(inicio,/SATE\.articulo\(m\[1\]/);
assert.doesNotMatch(inicio,/config\[unidad\] = .*generica:true/);
const temarios=leer('web/sate/temarios.js');
assert.match(temarios,/sate\.puentes\.programa/);assert.match(temarios,/new Set\(grupos\.map\(c=>c\[3\]\)\)/);
assert.match(temarios,/horarios\?materia=/);assert.match(temarios,/sate\.puentes\.todo/);
assert.match(leer('web/sate/horarios.js'),/if\(materia\)S\.q=materia/);
assert.match(leer('web/sate/guia.js'),/if\(s\)\{/);
assert.match(leer('web/sate/guia.js'),/sate\.puentes\.ets/);
assert.match(leer('contenido/textos/es.toml'),/en_ventanilla = "Llenar en la Ventanilla ›"/);
const nucleo=leer('web/sate/nucleo.js');
const mapa=leer('web/sate/mapa.js');
assert.match(mapa,/open\?`<div class="tl-more">\$\{inspParts\(k\)\.l2\}/,
  'la ficha expandida de Lista consume el mismo bloque de relaciones');
assert.match(nucleo,/const l2=.*SATE\.relacionesHtml\(SATE\.relacionesMateria\(k\)\)/,
  'la ficha compartida incluye Fundamento y Trámite para situaciones del perfil');
assert.match(leer('web/sate/horarios.js'),/SATE\.relacionesHtml\(SATE\.relacionesMateria\(k\)\)/,
  'Horarios usa las mismas relaciones de la ficha');
const unidadesConfig=JSON.parse(leer('data/sate.json')).unidades;
for(const unidad of ['escom','upibi']){
  assert.deepEqual(unidadesConfig[unidad].tramites,[],`${unidad} no declara trámites activos`);
  assert.ok(!unidadesConfig[unidad].guiaTramites,`${unidad} no enlaza trámites a una ruta de Guía`);
  assert.equal(unidadesConfig[unidad].electivas.tramite,null,`${unidad} no activa trámite de electivas`);
}
const inspector=vm.createContext({cur:()=>({DEMO:['Materia ficticia',3,1]}),prereqs:()=>({}),dependents:()=>({}),ancestors:()=>new Set(),semOf:()=>({}),offeredClaves:()=>new Set(),esc:String,pretty:String,textoCreditos:()=>3,ayudaCreditos:()=>'',porNiveles:()=>false,PLAN_DOS_PERIODOS:false,isPersonal:()=>false,isElec:()=>false,S:{car:'B'},UNIDAD:'unidad',classes:()=>[['B',null,null,'1BM1',null,null,null,null,'DEMO']],SATE:{texto:(k,v={})=>k+':'+(v.n||'')}});
vm.runInContext(nucleo.slice(nucleo.indexOf('function inspParts(k)'),nucleo.indexOf('/* Materias del horario inscrito')),inspector);
const ficha=inspector.inspParts('DEMO');
assert.match(ficha.l2,/horarios\?materia=DEMO/);assert.match(ficha.l2,/sate.puentes.grupos:1/);
assert.match(ficha.l2,/sate.puentes.todo/);assert.doesNotMatch(ficha.l2,/tag-rel|guia\/programas/);
console.log('R16: selector compartido, regreso y desplazamiento, almacenamiento bloqueado, enlaces y perfil OK');
