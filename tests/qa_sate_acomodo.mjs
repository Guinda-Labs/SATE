// Contrato de DOM/CSS generado, sin navegador ni red.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('web/dist/sate/index.html','utf8');
const controles=html.split('<div class="maptools">')[1].split('<div class="legend"')[0];
const derecha=controles.split('<div class="maptools-derecha">')[1];
assert.ok(derecha,'REV1: bloque derecho dentro de controles');
assert.ok(derecha.indexOf('id="plan-opciones"')<derecha.indexOf('id="map-ayuda"'),'Selector arriba de ayuda');
for(const id of ['plan-opciones','plan-periodos','map-ayuda'])assert.equal([...html.matchAll(new RegExp('id="'+id+'"','g'))].length,1,'ID único: '+id);
assert.match(html,/\.maptools-derecha\{[^}]*margin-left:auto;[^}]*flex-direction:column;[^}]*align-items:flex-end;[^}]*min-width:0;max-width:100%/);
assert.match(html,/@media\(max-width:639px\)\{\.maptools-derecha\{flex-basis:100%\}\}/,'375 px: bloque en renglón propio');
assert.match(html,/#plan-opciones\{[^}]*white-space:nowrap/,'Selector sin cortes');
assert.match(html,/#map-ayuda\{white-space:nowrap\}/,'Ayuda sin cortes');
console.log('REV1: contrato de selector/ayuda, alineación derecha y renglones responsivos a 375 px. Sin navegador; no mide el desborde real.');
