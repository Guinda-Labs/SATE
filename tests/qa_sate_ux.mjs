// UX1: contratos de diseño y regresiones con código real; sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const leer=p=>readFileSync(p,'utf8');
const shell=leer('web/sate/cascaron.html'),css=leer('web/sate/componentes.css');
const core=leer('web/sate/nucleo.js'),hor=leer('web/sate/horarios.js');
const config=JSON.parse(leer('web/dist/sate/index.html').match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);

// Umbrales sin diferencias entre CSS y JS; CSS no admite var() en @media.
assert.match(shell,/--ipn-quiebre-movil:640px/);
assert.match(shell,/--ipn-quiebre-escritorio:1024px/);
for(const src of [shell,css,core,leer('web/sate/calendario.js'),leer('web/sate/inicio.js')])
  assert.doesNotMatch(src,/\((?:max|min)-width:\s*(?:480|520|600|720|768|819|900|980|1100)px\)/);
const vistas=core.match(/const mview=\(\)=>[^;]+;/)[0];
for(const ancho of [375,414,639,640,768,1024,1440])for(const elegida of [null,'mapa','lista']){
  const c={S:{mview:elegida,cview:null},MQ_PHONE:{matches:ancho<640}};
  vm.runInNewContext(vistas+'globalThis.resultado=[mview(),cview()];',c);
  assert.equal(c.resultado[0],elegida||(ancho<640?'lista':'mapa'),`Vista guardada a ${ancho}px`);
  assert.equal(c.resultado[1],ancho<640?'dia':'semana');
}
// El diálogo fuerza agenda en teléfono sin sobrescribir la elección persistida.
const cv=hor.match(/const cv=([^;]+);document.querySelectorAll\('\[data-cview\]'/)[1];
for(const ancho of [375,414,768,1024,1440])for(const open of [false,true]){
  const obtenido=vm.runInNewContext(cv,{reducida:false,MQ_PHONE:{matches:ancho<640},$:()=>({open}),cview:()=> 'semana'});
  assert.equal(obtenido,open&&ancho<640?'dia':'semana');
}

assert.match(css,/@media\(hover:none\)\{\s*:is\(button,[^}]+\{min-height:44px!important\}/);
assert.match(css,/:is\(\.x,[^}]+\{min-width:44px!important;min-height:44px!important\}/);
assert.match(css,/\.marks button\{min-height:36px\}/);
assert.match(css,/\.sate-recorte-calendario\{[^}]*min-height:44px/);
assert.match(css,/\.sate-aviso:has\(\.sate-aviso__x\)\{padding-right:calc\(44px \+ var\(--ipn-esp-3\)\)\}/);
assert.match(css,/#v-tray \.plan-bandeja\{bottom:calc\(var\(--ipn-barra-alto\)/);
assert.match(shell,/\.horario-flotante\{display:block;position:static/);
assert.ok(shell.indexOf('id="b-horario"')<shell.indexOf('<div class="hlayout">'),'Acceso al horario antes de recorrer la oferta');
assert.match(css,/\.tramite-datos:focus-within \.tramite-acciones\{position:static/);
assert.match(css,/\.gbrk-horas\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(hor,/class="gbrk-horas"><label class="field"/);
const piso=css.slice(css.lastIndexOf('@media(max-width:639px){'));
for(const selector of ['.cal-b','.k-regla em','.ticks','.an-tag','.marks button','.dpill','.blk','#map-ayuda'])
  assert.ok(piso.includes(selector),selector+': piso tipográfico en teléfono');
assert.match(piso,/font-size:\.75rem!important/);
assert.match(css,/\.info:focus-visible\{outline:2px solid var\(--sate-realce\)/);
assert.match(shell,/id="map-simbologia"[^>]*data-htexto="simbologia"/);
assert.match(core,/\$\('#map-simbologia'\).addEventListener\('click'/);
assert.match(leer('web/sate/calendario.js'),/for\(const e of evs\).*e.titulo\+' · '\+corto\(e\)/);

for(const m of shell.matchAll(/<button\b([^>]*\bdata-g(?:t|src|days|n)="[^"]*"[^>]*)>/g))
  assert.match(m[1],/aria-pressed="(?:true|false)"/,'Estado inicial del segmento');
assert.equal(config.textos['sate.ventanilla.apellidos_aviso'],'Tus apellidos deben coincidir con los del SAES.');
assert.match(leer('web/sate/tramites.js'),/tx\('apellidos_aviso'\)/);
assert.match(leer('web/sate/situacion.js'),/config\(\).tramites.includes\(principal.tramite\)\?'que_hacer':'ver_detalles'/);
assert.equal(config.textos['sate.planeacion.elegidas'],'Unidades de aprendizaje que quieres cursar');
assert.match(leer('web/index.html'),/--ipn-radio:0.75rem;--r:var\(--ipn-radio\)/);
assert.match(leer('tools/sate_saes.js'),/@media\(prefers-color-scheme:dark\)/,'CUP9 ya proporciona el tema oscuro');
const dlg=leer('tools/cuenta.py').split('id="ipnt-privacidad"')[1].split('</dialog>')[0];
assert.equal((dlg.match(/<p(?: |\>)/g)||[]).length,2,'Una explicación y una región de error vacía');
assert.match(dlg,/sin marcar la casilla, se borran al cerrar esta pestaña/);
assert.match(css,/#ipnt-privacidad\[open\]\{[^}]*gap:var\(--ipn-esp-4\)/);

// Integridad de las bibliotecas publicadas y sus licencias, sin descargar nada.
const bibliotecas=[...leer('web/sate/desempeno.js').matchAll(/\['\.\.\/assets\/vendor\/([^']+)','([^']+)'\]/g)].map(m=>[m[1],m[2]]);
assert.equal(bibliotecas.length,2);
for(const [archivo,sri] of bibliotecas){
  const original=readFileSync('web/assets/vendor/'+archivo),publicado=readFileSync('web/dist/assets/vendor/'+archivo);
  assert.deepEqual(publicado,original);
  assert.equal('sha384-'+createHash('sha384').update(publicado).digest('base64'),sri);
  assert.doesNotThrow(()=>new Function(publicado.toString('utf8')));
}
for(const f of ['D3-LICENSE','Plot-LICENSE'])assert.match(leer('web/dist/assets/vendor/'+f),/Copyright/);
assert.doesNotMatch(leer('web/sate/desempeno.js'),/https:\/\/cdn/);
console.log('UX1: umbrales y preferencias en 7 anchos, agenda temporal, contratos táctiles/tipográficos, diálogo, trámites, licencias y SRI locales. OK; sin renderizado visual.');
