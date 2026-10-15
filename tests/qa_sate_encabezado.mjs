// Contratos e interacción del encabezado generado, sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync, readdirSync} from 'node:fs';
const leer = f => readFileSync(f, 'utf8');
const html = leer('web/dist/sate/index.html');
const config = JSON.parse(html.match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
const texto = (k,v={}) => config.textos[k].replace(/\{(\w+)\}/g,(_,n)=>v[n]??'{'+n+'}');
const encabezado = html.slice(html.indexOf('<header class="top">'), html.indexOf('</header>', html.indexOf('<header class="top">')));
assert.match(encabezado, /id="b-unidad"[^>]*aria-label="Cambiar unidad académica"[^>]*>▾<\/button>/);
assert.match(encabezado, /<span id="sate-leyenda"><\/span>/);
assert.match(encabezado, /class="sate-navegacion"[\s\S]*id="sate-tabs"[\s\S]*class="sate-controles"/);
assert.match(encabezado, /<label class="field"><span class="sate-sr">Carrera<\/span><select id="f-carrera">/);
assert.equal((html.match(/id="f-carrera"/g) || []).length, 1);
assert.equal((html.match(/id="saes-open"/g) || []).length, 1);
const fila = encabezado.slice(encabezado.indexOf('class="sate-fila-avisos"'),encabezado.indexOf('class="sate-navegacion"'));
assert.match(fila,/id="sate-avisos-globales"[\s\S]*id="saes-open"[^>]*data-saes-open[\s\S]*Traer mis datos del SAES[\s\S]*id="sate-saes-indicador"[^>]*role="status"[^>]*aria-label="Sin datos del SAES: puedes usar el mapa y los horarios"/);
assert.ok(!encabezado.slice(encabezado.indexOf('class="sate-navegacion"')).includes('saes-open'));
assert.ok(!html.includes('sate-datos-menu'));
for (const archivo of ['index.html','nucleo.js','inicio.js','mapa.js','situacion.js','desempeno.js','saes-dialogo.js']) {
  const fuente=leer('web/dist/sate/'+archivo);
  assert.ok(!/Probar con datos de ejemplo|prueba con datos de ejemplo|data-demo-open|desempeno-demo/.test(fuente),archivo+' sin acceso visible a demo');
}
assert.ok(!Object.keys(config.textos).some(k=>/sate\.(encabezado\.(datos|datos_movil|datos_acciones|demo|datos_cargados|datos_opcionales)|situacion\.probar_demo|desempeno\.demo)$/.test(k)));
assert.ok(!encabezado.includes('Tu avance (opcional)'));
assert.ok(!encabezado.includes('<hr'));
assert.ok(!html.includes('/*__SATE_'));
const inicio = leer('web/sate/inicio.js');
// Identidad publicada y comportamiento real del arranque, con DOM local en memoria.
assert.deepEqual(config.identidadUnidades, JSON.parse(leer('data/unidades_identidad.json')).unidades);
assert.equal(config.identidadUnidades.escom.logo,'escom-saes');
assert.equal(config.identidadUnidades.upibi.logo,'upibi-saes');
assert.equal(config.textos['sate.pestana.trayectoria.titulo'],'Tu perfil');
assert.equal(config.textos['sate.pestana.trayectoria.corto'],'Perfil');
assert.match(leer('web/sate/componentes.js'),/trayectoria: '<circle cx="12" cy="8" r="4"\/>/);
for (const [unidad,generica] of [['upiita'],['escom'],['upibi'],['encb'],['esimez'],['desconocida'],['enba'],['escom',true]]) {
  const valores={}, atributos={}, titulo={replaceChildren(...n){this.children=n}};
  const halos=[];
  const documento={querySelector:()=>null,getElementById:()=>titulo,
    querySelectorAll:()=>halos,
    documentElement:{getAttribute:k=>atributos[k],style:{setProperty(k,v){valores[k]=v}}},
    createElement:tag=>{const n={tag,dataset:{},style:{setProperty(k,v){this[k]=v}},children:[],prepend(n){this.children.unshift(n)},appendChild(n){this.children.push(n)}};if(tag==='span')halos.push(n);return n}};
  let selector;
  const configuracion=structuredClone(config);
  if(generica)delete configuracion.unidades[unidad];
  const c=vm.createContext({SATE_CONFIG:configuracion,SateRutas:{ruta:()=>({unidad})},
    URLSearchParams,localStorage:{getItem:()=>null},location:{hash:'#/'+unidad+'/mapa',search:''},window:{},
    document:documento,texto,SateUI:{modal(t,n){selector=n}}});
  vm.runInContext(inicio.slice(0,inicio.indexOf('  // plurales ICU'))+'\nglobalThis.aplicarRealce=aplicarRealce;globalThis.colorHalo=colorHalo;})();',c);
  vm.runInContext('const config=SATE_CONFIG.unidades,u=window.SATE_UNIDAD,cfg=config[u];let api;',c);
  vm.runInContext(inicio.slice(inicio.indexOf('  function logoUnidad('),inicio.indexOf('  async function activar(')),c);
  vm.runInContext(inicio.slice(inicio.indexOf('  const siglasUnidad'),inicio.indexOf('  if (cfg.leyenda)')),c);
  const nombre={textContent:''};
  documento.querySelector=s=>s==='.inst-name'?nombre:null;
  vm.runInContext(inicio.slice(inicio.indexOf('  const nombreUnidad'),inicio.indexOf('  if (cfg.logo)')),c);
  assert.equal(nombre.textContent,config.identidadUnidades[unidad]?.nombre||c.SATE_CONFIG.unidades[unidad].siglas);
  if(unidad==='encb')assert.equal(nombre.textContent,'Escuela Nacional de Ciencias Biológicas');
  const halo=titulo.children[0],img=halo.children[0];
  assert.equal(halo.tag,'span');assert.equal(halo.className,'sate-logo-halo');
  assert.equal(img.tag,'img');assert.equal(img.className,'sate-logo-unidad');
  assert.equal(img.src,'../assets/logos/unidades/'+(config.identidadUnidades[unidad]?.logo||'ipn')+'.webp');
  assert.equal(img.alt,c.SATE_CONFIG.unidades[unidad].nombre);
  assert.equal(titulo.children[1],'SATE ');assert.equal(titulo.children[2].textContent,c.SATE_CONFIG.unidades[unidad].siglas);
  img.onerror();assert.equal(img.hidden,true,unidad+': imagen fallida oculta');assert.equal(halo.hidden,true);
  const realce=config.unidades[unidad]?.realce||config.identidadUnidades[unidad]?.realce;
  assert.equal(valores['--sate-realce'],realce?.claro||'var(--sate-acento-base)',unidad+': tema claro');
  assert.equal(halo.style['--halo'],realce?.claro||'var(--sate-acento-base)');
  atributos['data-theme']='dark';
  c.aplicarRealce(unidad);
  assert.equal(valores['--sate-realce'],realce?.oscuro||'var(--sate-acento-base)',unidad+': tema oscuro');
  assert.equal(halo.style['--halo'],realce?.oscuro||'var(--sate-acento-base)');
  vm.runInContext('elegirUnidad();',c);
  assert.equal(selector.children.length,1);
  assert.equal(selector.children[0].textContent,'Cambiar de unidad');
  selector.children[0].onclick();assert.equal(c.location.href,'index.html?sateEntrada=1');
  atributos['data-theme']='light';c.aplicarRealce(unidad);
  assert.equal(halo.style['--halo'],realce?.claro||'var(--sate-acento-base)');
}
const estilosIdentidad=leer('web/sate/componentes.css');
assert.match(estilosIdentidad,/\.sate-logo-unidad\{[^}]*max-height:36px;[^}]*width:auto;height:auto;[^}]*object-fit:contain;/);
assert.doesNotMatch(estilosIdentidad,/\.sate-logo-unidad\{[^}]*background:#fff/);   // sin ficha blanca: halo del color de la unidad (dueño)
assert.match(estilosIdentidad,/\.sate-logo-halo img\{filter:drop-shadow\(0 0 9px [^}]*var\(--halo\)[^}]*drop-shadow\(0 0 18px [^}]*var\(--halo\)/);   // opción B del dueño: contorno amplio y tenue
assert.match(estilosIdentidad,/\.sate-logo-halo\{[^}]*position:relative;display:inline-grid;place-items:center;[^}]*isolation:isolate;overflow:visible/);
assert.match(estilosIdentidad,/\.sate-logo-halo::before\{content:none\}/);
assert.doesNotMatch(estilosIdentidad,/\.sate-logo-unidad\{[^}]*radial-gradient/);   // el degradado se veía dentro del logo (dueño)
assert.match(estilosIdentidad,/\.sate-selector-unidad \.sate-logo-unidad\{max-height:24px;max-width:24px\}/);
assert.match(estilosIdentidad,/@media\(max-width:720px\)\{\s*#sate-titulo \.sate-logo-unidad\{max-height:28px\}/);
const interaccion = inicio.slice(inicio.indexOf('  if (cfg.leyenda) {'), inicio.indexOf('  const nombreUnidad'));
for (const unidad of Object.keys(config.unidades)) {
  const boton = {setAttribute(k,v){this[k]=v}};
  const ayuda = {querySelector:()=>boton};
  const leyenda = {appendChild(n){this.ayuda=n}};
  let clave, variables;
  const c = {cfg:config.unidades[unidad], texto, document:{getElementById:()=>leyenda},
    SateUI:{ayuda(k,v){clave=k;variables=v;return ayuda}}};
  vm.runInNewContext(interaccion,c);
  if (c.cfg.leyenda) {
    assert.equal(clave,'sate.leyenda.'+c.cfg.leyenda);
    assert.equal(variables.unidad,c.cfg.siglas);
    assert.equal(leyenda.ayuda,ayuda);
    assert.equal(boton.textContent,texto('sate.encabezado.prueba'));
    assert.equal(boton['aria-label'],boton.textContent);
  } else assert.equal(leyenda.ayuda,undefined);
}
// Ejecutar el estado real: leer, reemplazar y borrar; el perfil ficticio no es una lectura SAES.
const saes = leer('web/dist/sate/nucleo.js').match(/const SAES=\{[\s\S]*?\n\};/)[0];
const span={}, corto={}, clases={}, btn={querySelector:s=>s==='.sate-texto-corto'?corto:span};
const indicador={classList:{toggle(k,v){clases[k]=v}},setAttribute(k,v){this[k]=v}};
const c=vm.createContext({SATE:{texto},document:{getElementById:id=>id==='saes-open'?btn:id==='sate-saes-indicador'?indicador:null}});
vm.runInContext(saes+'\nglobalThis.estado=SAES.status;',c);
for (const datos of [null,{leido:'2026-10-07T12:00:00Z'},{leido:'2026-10-08T15:00:00Z'},null,{demo:true,leido:'2026-10-07T12:00:00Z'}]) {
  const usando=!!datos&&!datos.demo;
  c.estado(datos);assert.equal(clases.on,usando);assert.equal(span.textContent,'Traer mis datos del SAES');
  assert.equal(corto.textContent,'Traer datos');
  const esperado=usando?texto('sate.encabezado.usando_datos',{fecha:new Date(datos.leido).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'})}):texto('sate.encabezado.sin_datos');
  assert.equal(indicador.title,esperado);assert.equal(indicador['aria-label'],esperado);
}
const core=leer('web/dist/sate/nucleo.js');
assert.match(core,/if\(location.hash==='#demo'\)/);
assert.match(core,/Modo demostración[\s\S]*Salir del modo demostración/);
assert.match(core,/sessionStorage.removeItem\('ipnt.demo'\)/);
const css=leer('web/sate/componentes.css');
assert.match(fila,/class="sate-texto-corto">Traer datos/,'H: etiqueta móvil inicial en catálogo');
assert.match(css,/@media\(max-width:720px\)\{[\s\S]*\.sate-fila-avisos\{flex-wrap:nowrap;overflow-x:auto/,'F: avisos y SAES en una fila desplazable');
assert.match(css,/#sate-avisos-globales \.sate-chips\{flex-wrap:nowrap/);
assert.match(css,/header\.top\{border-bottom:0/);
assert.match(css,/\.bar-top\{border-bottom:0/);
assert.match(css,/\.sate-navegacion\{display:flex;align-items:center/);
assert.match(css,/@media\(max-width:720px\)\{[\s\S]*\.sate-controles\{flex:1;width:100%\}/);
assert.match(css,/\.sate-datos\{[^}]*margin-left:auto/);
assert.match(css,/:is\(#sate-tabs,\.sate-medicion\) \.sate-pestana__texto\{white-space:nowrap;overflow-wrap:normal\}/);
assert.match(css,/data-controles-separados=true\]>#sate-tabs\{flex-basis:100%\}/);
assert.match(css,/body\.sate-flotante \.sate-barra\{display:flex\}/);
assert.match(css,/\.sate-barra__btn \.sate-pestana__texto\{white-space:nowrap;overflow-wrap:normal\}/);
assert.match(css,/#sate-saes-indicador::before\{[^}]*border:2px solid var\(--ipn-tenue\)/);
assert.match(css,/#sate-saes-indicador.on::before\{background:var\(--ipn-ok\);border-color:var\(--ipn-ok\)/);
assert.match(css,/\.sate-datos \.saes-open::before\{content:none\}/);
assert.match(css,/\.sate-datos \.btn[^}]*\):focus-visible\{outline:2px solid var\(--sate-realce\)/);
// Ejecutar el adaptador real con geometría controlada, sin navegador ni red.
{
const adaptador = inicio.slice(inicio.indexOf('  function adaptarPestanas()'),inicio.indexOf('  function elegirUnidad()'));
let ancho = 1000, completo = 600, corto = 400, medicion, frame, frames = 0, observador, mutacion, fuentes;
const boton = {dataset:{id:'mapa'},focus(){doc.activeElement=this}};
const inferior = {dataset:{id:'mapa'},focus(){doc.activeElement=this}};
const tabs = {dataset:{},cloneNode(){return {dataset:{},removeAttribute(){},querySelectorAll(){return []},
  getBoundingClientRect(){return {width:this.scrollWidth+2}},
  get scrollWidth(){return this.dataset.escalon==='corto'?corto:completo},offsetWidth:2,clientWidth:0}},
  contains(n){return n===boton},querySelector(){return boton}};
const controles = {cloneNode(){return {removeAttribute(){},querySelectorAll(){return []},getBoundingClientRect(){return {width:240}}}}};
const nav = {dataset:{},get clientWidth(){return ancho},querySelector(){return controles},appendChild(n){medicion=n}};
const contenedor = {closest(){return nav}};
const clases = {};
const doc = {activeElement:null,getElementById(){return contenedor},
  createElement(){return {setAttribute(){},replaceChildren(...n){this.children=n}}},
  body:{classList:{toggle(k,v){clases[k]=v}}},documentElement:{},
  fonts:{ready:{then(f){fuentes=f}},addEventListener(){}}};
vm.runInNewContext(adaptador+'\nadaptarPestanas();', {tabs,barra:{contains(n){return n===inferior},querySelector(){return inferior}},
  document:doc,getComputedStyle(){return {paddingLeft:'0px',paddingRight:'0px',columnGap:'12px'}},
  requestAnimationFrame(f){frame=f;frames++},addEventListener(){},matchMedia(){return {matches:false}},
  ResizeObserver:class {constructor(f){observador=f}observe(n){assert.equal(n,nav)}},
  MutationObserver:class {constructor(f){mutacion=f}observe(){}}});
function comprobar(w, escalon, separado) {
  ancho=w;observador();const f=frame;frame=null;f();
  assert.equal(tabs.dataset.escalon,escalon,`ancho disponible ${w}`);
  assert.equal(nav.dataset.controlesSeparados,String(separado));
  assert.equal(clases['sate-flotante'],escalon==='flotante');
}
// Límites exactos, reducción, recuperación desde barra oculta y ráfagas del observador.
for (const [w,e,s] of [[854,'completo',false],[853,'completo',true],[602,'completo',true],
  [601,'corto',true],[402,'corto',true],[401,'flotante',true],[1000,'completo',false]]) comprobar(w,e,s);
doc.activeElement=boton;comprobar(300,'flotante',true);assert.equal(doc.activeElement,inferior);
comprobar(1000,'completo',false);assert.equal(doc.activeElement,boton);
const antes=frames;observador();observador();mutacion();fuentes();assert.equal(frames,antes+1);frame();
// Una nueva fuente o idioma puede cambiar los anchos incluso sin cambiar el contenedor.
completo=1100;corto=1050;fuentes();frame();assert.equal(tabs.dataset.escalon,'flotante');
completo=600;corto=400;mutacion();frame();assert.equal(tabs.dataset.escalon,'completo');
assert.equal(medicion.inert,true);
}
let bloques = 0;
const paginas = [...readdirSync('web/dist').filter(f=>/^horarios-.*\.html$/.test(f)).map(f=>'web/dist/'+f), ...readdirSync('web/dist/sate').filter(f=>f.endsWith('.html')).map(f=>'web/dist/sate/'+f)];
for (const archivo of paginas) for (const m of leer(archivo).matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
  if (/\bsrc\s*=|application\/(?:ld\+)?json/i.test(m[1])) continue;
  try { new Function(m[2]); bloques++; } catch (e) { throw new Error(archivo+': '+e.message); }
}
console.log(`Parseo con new Function: ${paginas.length} HTML, ${bloques} bloques. OK.`);
console.log('Encabezado: contratos e integración del adaptador, límites, recuperación, foco, fuentes y agrupación por frame. OK.');
