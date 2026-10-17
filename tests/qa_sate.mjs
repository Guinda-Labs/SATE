// Pruebas sin navegador: contratos de rutas, redirecciones y parseo de salidas.
import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const leer = p => readFileSync(p,'utf8');
const config = JSON.parse(leer('data/sate.json')).unidades;
const context = vm.createContext({URLSearchParams});
vm.runInContext(leer('web/sate/rutas.js'),context);
const {ruta,redireccion} = context.SateRutas;
let pruebas = 0;
for (const u of Object.keys(config)) {
  assert.deepEqual(config[u].grupos.flat(),config[u].pestanas,'Orden y grupos del catálogo');
  for (const p of config[u].pestanas) {
    const h = '#/'+u+'/'+p;
    assert.equal(ruta(h,'upiita',config).hash,h); pruebas++;
    assert.equal(ruta('#/'+p,u,config).unidad,u); pruebas++;
  }
  for (const h of ['#demo','#code=abc&state=def','#error=denied','#dark','','#foo']) {
    assert.equal(ruta(h,u,config),null); pruebas++;
    const target = redireccion(u,'?materia=B211&valor=a%20b',h);
    assert.ok(target.startsWith('sate/index.html?materia=B211&valor=a%20b'));
    assert.ok(target.endsWith(h || '#/'+u+'/mapa')); pruebas++;
  }
  assert.equal(redireccion(u,'?x=1','#/horarios'),'sate/index.html?x=1#/'+u+'/horarios'); pruebas++;
  assert.equal(ruta('#/'+u+'/mapa/extra',u,config),null); pruebas++;
}
for(const u of Object.keys(config))for(const anterior of ['situacion','desempeno']){assert.equal(ruta('#/'+u+'/'+anterior+'?x=1','upiita',config).hash,'#/'+u+'/trayectoria?x=1');pruebas++}
assert.equal(ruta('#/upibi/tramites','upiita',config).hash,'#/upibi/trayectoria');
assert.equal(ruta('#/upiita/tramites/electivas?desde=mapa','upiita',config).hash,'#/upiita/tramites/electivas?desde=mapa');
assert.equal(ruta('#/upiita/tramites/inventado','upiita',config),null);
assert.equal(redireccion(null,'?x=1','#demo'),'sate/index.html?x=1#demo');
pruebas += 5;

function archivos(dir) {
  return readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()?archivos(path.join(dir,e.name)):[path.join(dir,e.name)]);
}
let scripts = 0;
for (const f of archivos('web/dist').filter(f=>f.endsWith('.html'))) {
  const html = leer(f);
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (/\bsrc\s*=|application\/(?:ld\+)?json/i.test(m[1])) continue;
    assert.ok(!/\btype\s*=\s*["']module/.test(m[1]),'Se requiere añadir verificación de ES modules: '+f);
    new vm.Script(m[2],{filename:f}); scripts++;
  }
}
for (const f of archivos('web/sate').filter(f=>f.endsWith('.js')).concat(archivos('web/dist/sate').filter(f=>f.endsWith('.js')))) {
  new vm.Script(leer(f),{filename:f}); scripts++;
}
// Parsear también el ámbito global conjunto detecta declaraciones duplicadas entre módulos.
new vm.Script(['nucleo.js','calendario.js','situacion.js','mapa.js','horarios.js','desempeno.js','exportacion.js'].map(n=>leer('web/dist/sate/'+n)).join('\n'));
const inicial = leer('web/dist/sate/index.html');
assert.ok(!inicial.includes('class="ipnt-home"'));   // SATE no enlaza a la portada del proyecto
assert.ok(!inicial.includes('id="saes-dlg"'));
assert.ok(!inicial.includes('id="exp-dlg"'));
assert.ok(!inicial.includes('id="f-q"'));
assert.ok(inicial.includes('src="../assets/logos/ipn-horizontal-guinda.webp"'));
assert.ok(leer('web/dist/sate/saes-dialogo.js').includes('id=\\"saes-dlg\\"'));
assert.ok(leer('web/dist/sate/exportacion.js').includes('id=\\"exp-dlg\\"'));
assert.ok(leer('web/dist/sate/horarios.js').includes('id=\\"f-q\\"'));
pruebas += 8;
for (const unidad of Object.keys(config)) {
  const f = 'web/dist/horarios-'+unidad+'.html'; let destino;
  const c = vm.createContext({URLSearchParams,location:{search:'?demo=1',hash:'#code=x',replace:u=>destino=u}});
  // Las redirecciones de HEAD incluyen la protección contra marcos ajenos.
  vm.runInContext('window=globalThis; window.top=window.self=window;',c);
  for (const m of leer(f).matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) vm.runInContext(m[1],c);
  assert.equal(destino,'sate/index.html?demo=1&sateUnidad='+unidad+'#code=x'); pruebas++;
}
const comunes = ['index.html','nucleo.js','inicio.js','rutas.js','componentes.js','situacion.js'];
const base = comunes.reduce((s,n)=>s+statSync('web/dist/sate/'+n).size,0);
const medidas = {};
for (const u of Object.keys(config)) {
  const nucleo=statSync('web/dist/sate/datos/'+u+'/nucleo.json').size;
  const oferta=statSync('web/dist/sate/datos/'+u+'/oferta.json').size;
  medidas[u]={cascaronNucleo:base+nucleo,vistaInicial:base+nucleo+oferta+statSync('web/dist/sate/mapa.js').size,
    horarios:base+nucleo+oferta+statSync('web/dist/sate/horarios.js').size,
    trayectoria:base+nucleo+statSync('web/dist/sate/desempeno.js').size,
    ventanilla:config[u].pestanas.includes('tramites')?base+nucleo+statSync('web/dist/sate/datos/'+u+'/tramites.json').size:null,presupuesto:160000,
    pendientes:{html:statSync('web/dist/sate/index.html').size,nucleoJS:statSync('web/dist/sate/nucleo.js').size,datosNucleo:nucleo,oferta}};
}
console.log(JSON.stringify({pruebas,scripts,bytes:medidas},null,2));
