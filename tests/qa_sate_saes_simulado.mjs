// SIM1: separación QA/publicación y errores de parsers, sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
// El build normal retira QA; esta prueba solicita explícitamente su copia aislada.
execFileSync(process.env.PYTHON || 'python',['tools/build_sate.py'],{
  env:{...process.env,UNIDAD:'upiita',SATE_QA:'1'},stdio:'pipe'
});
const leer=p=>readFileSync(p,'utf8');
const normal=leer('web/dist/sate.js'),qa=leer('web/dist/qa-sate.js');
for(const [src,esQA] of [[normal,false],[qa,true]]){
  assert.doesNotThrow(()=>new Function(src));
  const common=src.slice(src.indexOf('(function(raiz)'),src.indexOf('/*__CUPOS_PANEL__*/'));
  const ctx=vm.createContext({URL,URLSearchParams,console});vm.runInContext(common,ctx);
  const C=ctx.IPNCupos;
  assert.equal(C.origenSaes('http://saes-upiita.localhost:8765'),esQA);
  for(const origen of ['http://127.0.0.1:8765','http://localhost:8765','http://saes-upiita.localhost.evil:8765','https://saes-upiita.localhost:8765','http://saes-escom.localhost:8765'])assert.equal(C.origenSaes(origen),false,origen);
  assert.equal(C.origenSaes('https://saes.upiita.ipn.mx'),true);
  assert.equal(C.origenSaes('https://www.saes.escom.ipn.mx'),true);
  assert.throws(()=>C.parsear({querySelector:()=>({})}),/sesion/);
  assert.throws(()=>C.parsear({querySelector:s=>s.includes('password')?null:{querySelectorAll:()=>[{children:[{textContent:'Columna simulada'}]}]}}),/columnas/);
  if(!esQA){
    assert.doesNotMatch(src,/saes-upiita\.localhost|qa-sate/);
    let resultado='sin llamada',peticiones=0;
    const lector=src.match(/\(async function \(\) \{[\s\S]*?\n\}\)\(\);/)[0];
    const c=vm.createContext({location:{hostname:'saes-upiita.localhost',protocol:'http:'},window:{IPNTSateResultado:d=>resultado=d},fetch:()=>{peticiones++;throw Error('Red no permitida')}});
    await vm.runInContext(lector,c);assert.equal(resultado,null);assert.equal(peticiones,0);
  }
}
assert.match(qa,/location.origin\+"\/dist\/qa-sate\/index.html\?vista=cupos"/);
assert.match(qa,/var TOOL = location.origin \+ '\/dist\/qa-sate\/index.html';/);
assert.match(leer('web/dist/qa-sate/cupos-vista.js'),/saes:location.origin/);
assert.doesNotMatch(leer('web/dist/sate/cupos-vista.js'),/saes:location.origin/);
assert.match(leer('web/qa-saes-simulado.html'),/draggable="true"/);
// Oferta/mapa GET están vacíos: ejercitar también filas sintéticas para proteger las asignaciones.
const captura=leer('tools/captura_saes.js'),ctx=vm.createContext({});
vm.runInContext(captura.slice(captura.indexOf('  var cellsOf'),captura.indexOf('  var now =')),ctx);
const doc=filas=>({querySelector:()=>({rows:filas.map(f=>({cells:f.map(textContent=>({textContent}))}))})});
assert.deepEqual(JSON.parse(JSON.stringify(ctx.parsearOferta(doc([['Grupo','Materia'],['1BM1','B101']]),{carrera:'B',plan:'09',turno:'M',nivel:1}))),[{carrera:'B',plan:'09',turno:'M',nivel:1,Grupo:'1BM1',Materia:'B101'}]);
assert.deepEqual(JSON.parse(JSON.stringify(ctx.parsearMapa(doc([['Créditos','Nombre','Clave','Tipo','Horas práctica','Nivel','Horas teoría'],['4.5','Materia ficticia','X101','OBL','2','3','1']]),'X','99','1'))),[['X','99','3','X101','Materia ficticia','OBL','4.5','1','2']]);
console.log('SIM1: origen local exclusivo de QA; publicación lo rechaza; sesión y columnas verificadas.');
