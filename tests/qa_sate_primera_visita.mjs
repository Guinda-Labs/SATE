// Primera visita: código generado y callbacks reales, sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=f=>readFileSync(f,'utf8');
const html=leer('web/dist/sate/index.html');
const config=JSON.parse(html.match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
const texto=k=>{assert.ok(config.textos[k],k);return config.textos[k]};
const vacio=html.slice(html.indexOf('id="desempeno-vacio"'),html.indexOf('<details class="sate-desp" id="desempeno-simulacion"'));
assert.equal((vacio.match(/<button/g)||[]).length,2);
assert.match(vacio,/class="btn primary"[^>]*id="desempeno-lector"/);
assert.match(vacio,/id="desempeno-explorar"/);
assert.doesNotMatch(vacio,/onclick=/);
assert.equal(texto('sate.planeacion.oferta_vacia'),'Aún no eliges materias en el Mapa curricular. Elígelas allá o consulta toda la oferta.');
assert.match(texto('sate.trayectoria.sin_datos'),/SATE.*sin datos puedes explorar el mapa y armar tu horario/);
const nodos=new Map();
const nodo=id=>{if(!nodos.has(id))nodos.set(id,{eventos:{},addEventListener(k,f){this.eventos[k]=f}});return nodos.get(id)};
const desempe=leer('web/dist/sate/desempeno.js');
const montar=desempe.slice(desempe.indexOf('  montar(){')+11,desempe.indexOf('\n  },',desempe.indexOf('  montar(){')));
let destino,abierto=false;
vm.runInNewContext(montar,{$:nodo,prepararSeccion(){},SAES:{open(){abierto=true}},SATE:{texto,ir:id=>destino=id}});
assert.equal(nodo('#desempeno-lector').textContent,'Traer mis datos del SAES');
assert.equal(nodo('#desempeno-explorar').textContent,'Explorar el mapa');
nodo('#desempeno-lector').eventos.click();assert.equal(abierto,true);
nodo('#desempeno-explorar').eventos.click();assert.equal(destino,'mapa');
const fuenteMapa=leer('web/dist/sate/mapa.js');
const ayuda=fuenteMapa.slice(fuenteMapa.indexOf('function renderAyudaPrimeraVisita'),fuenteMapa.indexOf("SATE.pestana('mapa'"));
const box={replaceChildren(){this.aviso=null},appendChild(n){this.aviso=n}};
const guardado=new Map();let aviso;
const c=vm.createContext({$:()=>box,ALUMNO:null,SATE:{texto},SateUI:{aviso(o){aviso=o;return o}},
  store:{get:(k,d)=>guardado.get(k)??d,set:(k,v)=>guardado.set(k,v)}});
vm.runInContext(ayuda,c);
c.renderAyudaPrimeraVisita();assert.equal(box.hidden,false);assert.equal(aviso.descartable,true);
assert.equal(aviso.titulo,'Toca o haz clic en las materias que quieres cursar; luego arma tu horario en Horarios de clase.');
aviso.alDescartar();assert.equal(box.hidden,true);c.renderAyudaPrimeraVisita();assert.equal(box.aviso,null);
guardado.clear();c.ALUMNO={leido:'2026-10-07'};c.renderAyudaPrimeraVisita();assert.equal(box.hidden,true);
c.ALUMNO=null;c.renderAyudaPrimeraVisita();assert.equal(box.hidden,false);
const saes=leer('web/dist/sate/nucleo.js').match(/const SAES=\{[\s\S]*?\n\};/)[0];
assert.match(leer('web/dist/sate/saes-dialogo.js'),/id=\\"saes-paste-clip\\"/);
assert.match(html,/@media\(hover:none\)\{\.saes-arrastre\{display:none\}\.saes-tactil\{display:block\}/);
let dialogo;
vm.runInNewContext(leer('web/dist/sate/saes-dialogo.js'),{
  document:{body:{insertAdjacentHTML(pos,texto){assert.equal(pos,'beforeend');dialogo=texto}},querySelector(){return null}},
  navigator:{userAgent:'Android',maxTouchPoints:1}
});
assert.match(dialogo,/<h2 id="saes-h">Traer mis datos del SAES<\/h2>/);
assert.ok(dialogo.includes('Trae tu avance del SAES en 3 pasos. Solo se lee; nada se envía a ningún servidor.'));
assert.doesNotMatch(dialogo,/saes-aviso/);
assert.doesNotMatch(dialogo,/<details[^>]*\bopen\b/,'Las ayudas y los videos empiezan cerrados');
assert.match(dialogo,/<details><summary>¿Prefieres verlo\? Video paso a paso<\/summary>/);
for(const dispositivo of ['pc','ios','android'])assert.ok(dialogo.includes('data-dev="'+dispositivo+'"'));
assert.match(dialogo,/<ol start="3"><li><b>Pega aquí<\/b> <button[^>]*id="saes-paste-clip"[^>]*>Pegar datos copiados<\/button><\/li><\/ol>/);
assert.ok(dialogo.indexOf('id="saes-reminder"')>dialogo.indexOf('id="saes-paste"'),'Recordatorio discreto al final');
for(const modo of ['ok','ausente','denegado','invalido','sin-contrato','otra-unidad']){
  const elementos=new Map();let cargado,guardadoSaes,cierres=0;
  const n=id=>{if(!elementos.has(id))elementos.set(id,{value:'',dataset:{fallback:texto('sate.lector.pegado_manual')},eventos:{},addEventListener(k,f){this.eventos[k]=f},focus(){this.enfocado=true}});return elementos.get(id)};
  const dl={querySelector:n,addEventListener(){}};
  const datos={upiita_saes:1,acreditadas:[],unidad:modo==='otra-unidad'?'escom':'upiita',leido:'2026-10-07'};
  const clipboard=modo==='ausente'?undefined:{readText:async()=>{if(modo==='denegado')throw new Error('NotAllowedError');return modo==='invalido'?'invalido':modo==='sin-contrato'?'{}':JSON.stringify(datos)}};
  const ctx=vm.createContext({document:{getElementById:()=>dl,addEventListener(){}},navigator:{clipboard},matchMedia:()=>({matches:true}),setTimeout(f){cierres++}});
  vm.runInContext(saes+'\nglobalThis.saes=SAES;',ctx);
  ctx.saes.U=()=> 'upiita';
  ctx.saes.save=d=>guardadoSaes=d;ctx.saes.status=()=>{};
  ctx.saes.wire(d=>cargado=d);
  assert.notEqual(n('#saes-manual').open,true,'También en teléfono, el detalle empieza cerrado');
  n('#saes-install').eventos.click();assert.equal(n('#saes-manual').open,true);
  await n('#saes-paste-clip').eventos.click({currentTarget:n('#saes-paste-clip')});
  if(modo==='ok'){assert.equal(cargado.unidad,'upiita');assert.equal(guardadoSaes,cargado);assert.equal(cierres,1)}
  else if(modo==='otra-unidad'){assert.equal(cargado,undefined,'no se aplica en esta unidad');assert.equal(guardadoSaes.unidad,'escom','se guarda para abrir su SATE');assert.equal(cierres,1,'programa la apertura del SATE de su unidad')}
  else {assert.equal(cargado,undefined);assert.equal(guardadoSaes,undefined)}
  if(modo==='ausente'||modo==='denegado'){
    assert.equal(n('#saes-paste').enfocado,true);assert.equal(n('#saes-msg').textContent,texto('sate.lector.pegado_manual'));
    n('#saes-paste').eventos.paste({preventDefault(){},clipboardData:{getData:()=>JSON.stringify(datos)}});
    assert.equal(cargado.unidad,'upiita');
  }
}
// Estado real con lecturas ficticias: límite estricto, fecha ausente y limpieza.
const estados=new Map();
const estado=id=>{if(!estados.has(id))estados.set(id,{querySelector:estado});return estados.get(id)};
const ahora=Date.parse('2026-10-07T12:00:00Z');
const ctxEstado=vm.createContext({document:{getElementById:id=>['saes-open','sate-saes-indicador'].includes(id)?null:estado(id)},Date:class extends Date{static now(){return ahora}}});
vm.runInContext(saes+'\nglobalThis.saes=SAES;',ctxEstado);
for(const dias of [0,30,30.01,31]){
  ctxEstado.saes.status({leido:new Date(ahora-dias*86400000).toISOString(),carrera_nombre:'Carrera ficticia',boleta:'DEMO'});
  assert.equal(estado('saes-stale').hidden,dias<=30,'Recordatorio arriba: '+dias+' días');
  assert.equal(estado('saes-reminder').hidden,dias>30,'Sin duplicar el recordatorio');
  assert.equal(estado('saes-steps').hidden,true);
}
for(const datos of [{leido:'fecha inválida'},{},null]){
  ctxEstado.saes.status(datos);
  assert.equal(estado('saes-stale').hidden,true);
  assert.equal(estado('saes-reminder').hidden,false);
}
assert.equal(estado('saes-steps').hidden,false);
console.log('Primera visita: salidas, ayuda persistente y portapapeles con respaldo OK');
