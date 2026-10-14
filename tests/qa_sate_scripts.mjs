// Verifica cada bloque clásico generado y los módulos SATE sin ejecutar código ni abrir navegador.
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const archivos=readdirSync('web/dist').filter(f=>/^horarios-.*\.html$/.test(f)).map(f=>'web/dist/'+f);
archivos.push('web/dist/sate/index.html');
archivos.push('web/dist/sate/cupos.html');
let bloques=0;
for(const f of archivos){
  for(const m of readFileSync(f,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
    if(/\bsrc\s*=/.test(m[1])||/type="application\//.test(m[1]))continue;
    assert.doesNotThrow(()=>new Function(m[2]),f+' bloque '+(++bloques));
  }
}
for(const f of readdirSync('web/dist/sate').filter(f=>f.endsWith('.js')))
  assert.doesNotThrow(()=>new Function(readFileSync('web/dist/sate/'+f,'utf8')),f);
const lector=readFileSync('web/dist/lector.js','utf8');
assert.doesNotThrow(()=>new Function(lector),'lector.js');
assert.doesNotMatch(lector,/__LECTOR_|__TOOL_URL__/);
const version=createHash('sha1').update(readFileSync('tools/lector_saes.js','utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,7);
assert.ok(lector.includes("lector: '"+version+"'"),'Versión del Lector generada desde la huella vigente');
console.log(archivos.length+' HTML: '+bloques+' bloques; módulos SATE y Lector parseados con new Function.');
