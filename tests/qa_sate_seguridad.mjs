// Contratos SEG1 con código real, almacenamiento y red ficticios; sin navegador.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(p,'utf8');
const cuenta=leer('tools/cuenta.py').match(/JS = r"""([\s\S]*?)"""/)[1];
function storage(datos={}){
  const s={...datos};
  Object.defineProperties(s,{
    getItem:{value:k=>Object.hasOwn(s,k)?s[k]:null},
    setItem:{value:(k,v)=>{s[k]=String(v)}},removeItem:{value:k=>{delete s[k]}}
  });return s;
}
function entorno(datos={},sesion={}){
  const local=storage(datos),session=storage(sesion),nodos=new Map();let recargas=0;
  const dl={open:false,showModal(){this.open=true},close(){this.open=false},querySelector(){return boton}};
  const boton={},casilla={checked:false};
  nodos.set('ipnt-privacidad',dl);nodos.set('ipnt-privacidad-mantener',casilla);nodos.set('ipnt-privacidad-error',{});
  const c=vm.createContext({console,localStorage:local,sessionStorage:session,document:{readyState:'loading',addEventListener(){},getElementById:k=>nodos.get(k)||null},
    clearTimeout(){},setTimeout(){},location:{reload(){recargas++}},URL,Event,
    msal:{PublicClientApplication:class{
      constructor(o){c.cache=o.cache.cacheLocation}async initialize(){}async handleRedirectPromise(){return null}
      async clearCache(){c.limpiezas=(c.limpiezas||0)+1}
      getActiveAccount(){return null}getAllAccounts(){return []}
    }}});
  vm.runInContext('window=globalThis',c);
  vm.runInContext(cuenta.replace('  return {almacen,','  window.msPrueba=MS;return {almacen,'),c);
  return {c,api:c.IPNT,local,session,dl,casilla,boton,get recargas(){return recargas}};
}
const perfil=JSON.stringify({upiita_saes:1,acreditadas:[],carrera:'ficticia',carrera_nombre:'<img src=x onerror=alert(1)>',leido:'ficticio'});
const nuevo=entorno();nuevo.api.set('hu.tab','mapa');assert.equal(nuevo.dl.open,false,'Cambiar de pestaña no pide guardar datos');nuevo.api.set('saes.alumno',perfil);
assert.equal(nuevo.local.getItem('saes.alumno'),null);assert.equal(nuevo.session.getItem('saes.alumno'),perfil);
assert.equal(nuevo.dl.open,true);assert.equal(nuevo.casilla.checked,false);
nuevo.boton.onclick();assert.equal(nuevo.session.getItem('ipnt.persistir'),'no');
await nuevo.c.msPrueba.listo();assert.equal(nuevo.c.cache,'sessionStorage');
nuevo.api.persistencia(true);assert.equal(nuevo.local.getItem('saes.alumno'),perfil);assert.equal(nuevo.session.getItem('saes.alumno'),null);
const legado=entorno({'saes.alumno':perfil,'hu.plan':'ficticio','msal.token':'ficticio','ajena':'conservar'});
assert.equal(legado.local.getItem('ipnt.persistir'),'si');assert.equal(legado.api.almacen.getItem('saes.alumno'),perfil);
await legado.c.msPrueba.listo();assert.equal(legado.c.cache,'localStorage');
legado.api.persistencia(false);assert.equal(legado.session.getItem('saes.alumno'),perfil);assert.equal(legado.local.getItem('msal.token'),null);
const reabierto=entorno({...legado.local});assert.equal(reabierto.api.almacen.getItem('saes.alumno'),null,'La sesión no sobrevive a cerrar la pestaña');
// Una cuota insuficiente conserva todos los datos de origen y el destino previo.
const cuota=entorno({'saes.alumno':perfil});
Object.defineProperty(cuota.session,'hu.plan',{set(){throw new Error('QuotaExceededError')},configurable:true});
cuota.local.setItem('hu.plan','ficticio');
assert.throws(()=>cuota.api.persistencia(false),/espacio/);assert.equal(cuota.local.getItem('saes.alumno'),perfil);
// Cerrar sesión normal conserva planes; la opción pública purga ambos almacenes.
await legado.api.salir(false);assert.equal(legado.session.getItem('saes.alumno'),perfil);
legado.api.almacen.setItem('ipnt.publica','si');legado.local.setItem('msal.ficticia','token ficticio');
await legado.api.salir(false);
for(const s of [legado.local,legado.session])assert.equal(Object.keys(s).some(k=>/^(hu\.|ue\.|saes\.|ipnt\.|msal\.)|^perfil\.opciones$/.test(k)),false);
assert.equal(legado.local.getItem('ajena'),'conservar');assert.equal(legado.recargas,1);
assert.equal(legado.c.limpiezas,1,'La purga llama también al API de limpieza de MSAL');
let leido=false;
await assert.rejects(nuevo.api.restaurar({size:2*1024*1024+1,text(){leido=true}}),/2 MB/);assert.equal(leido,false);
const valido={ipnt:1,tipo:'perfil',claves:{'hu.ficticio':{v:'importado'}}};
assert.equal(await nuevo.api.restaurar({size:2*1024*1024,text:async()=>JSON.stringify(valido)}),1);
assert.equal(nuevo.api.almacen.getItem('hu.ficticio'),'"importado"');

// La función vulnerable real escapa nombre y carrera consultada antes del sink.
const saes=leer('tools/saes.py').match(/const SAES=\{[\s\S]*?\n\};/)[0];
const aviso={};
const x=vm.createContext({document:{getElementById:()=>aviso},localStorage:storage({'saes.alumno':perfil}),
  esc:s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))});
vm.runInContext('window=globalThis;'+saes+';SAES.mismatch("otra",()=>"<img src=x onerror=alert(1)>",()=>{})',x);
assert.doesNotMatch(aviso.innerHTML,/<img\b/i);assert.match(aviso.innerHTML,/&lt;img/i);
vm.runInContext('SAES.mismatch("otra",()=>"",()=>{})',x);
assert.doesNotMatch(aviso.innerHTML,/<img\b/i);assert.match(aviso.innerHTML,/&lt;img/i,'carrera_nombre de un perfil importado');
assert.doesNotMatch(leer('tools/lector_saes.js'),/innerHTML|insertAdjacentHTML/);
assert.match(leer('tools/sate_saes.js'),/el\('saludo'\).textContent/);

let recibir;const estado={},mensajes=[],origen='https://silver-vs.github.io';
const opener={postMessage:d=>mensajes.push(d)},local=storage();
vm.runInNewContext(leer('web/migrar.html').match(/\/\* Recibe,[\s\S]*?(?=<\/script>)/)[0],{
  window:{opener,addEventListener:(k,f)=>recibir=f},document:{getElementById:id=>id==='estado'?estado:{}},
  localStorage:local,location:{search:'',replace(){}},URLSearchParams,setTimeout(){},console
});
recibir({origin:origen,source:opener,data:{tipo:'ipnt.migrar.datos',v:1,datos:{'hu.grande':'x'.repeat(500001),'hu.limite':'x'.repeat(500000),'ue.siguiente':'correcto'}}});
assert.equal(local.getItem('hu.grande'),null);assert.equal(local.getItem('hu.limite').length,500000);
assert.equal(local.getItem('ue.siguiente'),'correcto');assert.equal(mensajes.at(-1).omitidos,1);assert.match(estado.textContent,/omitidos/);

for(const archivo of ['web/sate/cascaron.html','web/sate/cupos.html','web/index.html','web/migrar.html','web/horarios.template.html',
  'web/dist/sate/index.html','web/dist/sate/cupos.html','web/dist/index.html','web/dist/migrar.html',
  ...['upiita','escom','upibi'].map(u=>'web/dist/horarios-'+u+'.html')]){
  const html=leer(archivo);assert.match(html,/<meta http-equiv="Content-Security-Policy"/i,archivo);
  assert.match(html,/object-src 'none'/);assert.match(html,/base-uri 'self'/);assert.match(html,/strict-origin-when-cross-origin/);
  const defensa=html.match(/<script>(if\(window.top!==window.self\)[\s\S]*?)<\/script>/)[1];
  for(const propio of [false,true]){
    const raiz={style:{setProperty(){}}},self={};
    vm.runInNewContext(defensa,{window:{self,top:{get location(){if(!propio)throw new Error('SecurityError');return {origin:'https://sate.test'}}}},location:{origin:'https://sate.test'},document:{documentElement:raiz}});
    assert.equal(!!raiz.hidden,!propio);
  }
}
// Los exportadores reales fijan SRI en el elemento que se entrega al DOM.
for(const [funcion,global] of [['loadExcelJS','ExcelJS'],['loadPdfLib','PDFLib']]){
  let script;const c=vm.createContext({document:{createElement:()=>({}),head:{appendChild(s){script=s;s.onload()}}}});
  vm.runInContext('window=globalThis;'+leer('web/sate/exportacion.js').match(new RegExp('async function '+funcion+'\\(\\)[^\\n]+'))[0],c);
  await c[funcion]();assert.match(script.integrity,/^sha512-/);assert.equal(script.crossOrigin,'anonymous');
}
const captura=leer('tools/captura_saes.js');
const consulta=captura.slice(captura.indexOf('  var consultar ='),captura.indexOf('  var post ='));
for(const codigo of [200,429,503,'lenta','abortada']){
  const pausas=[];let reloj=0,abortar;
  const c=vm.createContext({AbortController,Date:{now:()=>reloj},Math,sleep:async n=>pausas.push(n),setTimeout:f=>{abortar=f},clearTimeout(){},
    fetch:async(url,o)=>{if(codigo==='abortada'){abortar();throw new Error('AbortError')}
      return {ok:codigo===200||codigo==='lenta',status:codigo,url,text:async()=>{if(codigo==='lenta')reloj=10001;return 'ficticio'}}}});
  vm.runInContext(consulta,c);
  if(codigo===200)assert.equal((await c.consultar('/ficticio',{})).texto,'ficticio');
  else await assert.rejects(c.consultar('/ficticio',{}),/detenida/);
  assert.ok(pausas[0]>=600&&pausas[0]<=1000);
}
console.log('OK SEG1: XSS, migración, respaldo, persistencia, MSAL, purga, CSP, marcos, SRI y ritmo de captura.');
