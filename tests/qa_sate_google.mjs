// GOOG1: Google ya no inicia sesión; solo migra datos hacia Microsoft. Código real de tools/cuenta.py con red y navegador ficticios.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const fuente=readFileSync('tools/cuenta.py','utf8');
const js=fuente.match(/JS = r"""([\s\S]*?)"""/)[1];
const py=c=>execFileSync('python',['-c',"import sys,json;sys.path.insert(0,'tools');import cuenta;"+c],{encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
const cfg=JSON.parse(py('print(json.dumps(cuenta.config(),ensure_ascii=False))'));
const ui=py("print(cuenta.inject('<!--__CUENTA_BTN__-->'))");

// 1. El diálogo no ofrece Google y no quedan avisos de «fase de prueba».
assert.equal(cfg.googleSoloMigracion,true);assert.equal('googlePrueba' in cfg,false);assert.equal('contacto' in cfg,false);
assert.doesNotMatch(ui,/Continuar con Google|ipnt-glogin|ipnt-h-go|fase de prueba|ipnt-contacto|%%/);
assert.match(ui,/ipnt-mig-link/);assert.match(ui,/Pásalos a Microsoft/);assert.match(ui,/Traer mis datos de Google/);assert.match(ui,/Continuar con Microsoft/);
// 2. La interfaz de Google no contiene ninguna escritura.
const go=js.slice(js.indexOf('// Google Drive SOLO PARA MIGRAR'),js.indexOf('const PROV='));
assert.doesNotMatch(go,/POST|PUT|PATCH|DELETE|upload|subir/);
assert.match(js,/const PROV=\{ms:MS\}/);

function storage(datos={}){
  const s={...datos};
  Object.defineProperties(s,{getItem:{value:k=>Object.hasOwn(s,k)?s[k]:null},setItem:{value:(k,v)=>{s[k]=String(v)}},removeItem:{value:k=>{delete s[k]}}});
  return s;
}
function entorno(config,sesion={}){
  const local=storage(),session=storage({'ipnt.persistir':'no',...sesion}),nodos=new Map(),llamadas=[];let recargas=0,revocaciones=0,extra=0;
  const nodo=id=>{if(!nodos.has(id)){const n={id,hidden:false,disabled:false,className:'',textContent:'',innerHTML:'',checked:false,handlers:{},style:{},dataset:{},
    classList:{toggle(){},add(){},remove(){}},addEventListener(t,f){n.handlers[t]=f},querySelector:()=>nodo(id+'>q'),lastChild:{textContent:''},
    appendChild(){},close(){},showModal(){},setAttribute(){},removeAttribute(){}};nodos.set(id,n)}return nodos.get(id)};
  const respuesta=(cuerpo,status=200)=>({ok:status<400,status,json:async()=>cuerpo});
  const perfil={ipnt:1,tipo:'perfil',claves:{'hu.nube':{t:5,v:'desde google'}},borrados:{}};
  const fetch=async(u,o={})=>{
    llamadas.push({u,m:o.method||'GET',b:o.body});
    if(u.includes('/oauth2/v3/userinfo'))return respuesta({name:'Ana Ficticia',email:'ana@ejemplo.invalid'});
    if(u.includes('googleapis.com/drive/v3/files?'))return respuesta({files:[{id:'f1',version:'3'}]});
    if(u.includes('googleapis.com/drive/v3/files/f1'))return respuesta(perfil);
    if(u.includes('graph.microsoft.com')&&(o.method||'GET')==='GET')return respuesta({},404);
    if(u.includes('graph.microsoft.com'))return respuesta({});
    throw new Error('Red inesperada: '+u);
  };
  const c=vm.createContext({console,localStorage:local,sessionStorage:session,fetch,URL,Event,
    document:{readyState:'complete',addEventListener(){},getElementById:nodo,querySelectorAll:()=>[],body:{appendChild(){}}},
    clearTimeout(){},setTimeout:(f,ms)=>{if(ms===0)f();return 1},location:{reload(){recargas++},origin:'http://localhost',pathname:'/x',href:'http://localhost/x',hash:'',search:''},
    msal:{InteractionRequiredAuthError:class extends Error{},PublicClientApplication:class{
      async initialize(){}async handleRedirectPromise(){return null}async clearCache(){}getActiveAccount(){return null}getAllAccounts(){return []}setActiveAccount(){}
      async loginPopup(){return {account:{name:'Ana Ficticia',username:'ana@ejemplo.invalid'}}}async acquireTokenSilent(){return {accessToken:'ficticio'}}}}});
  vm.runInContext('window=globalThis;window.dispatchEvent=()=>{};',c);
  c.google={accounts:{oauth2:{
    initTokenClient:()=>({requestAccessToken(){this.callback({access_token:'tok-ficticio',expires_in:3600})}}),
    hasGrantedAllScopes:()=>true,revoke(){revocaciones++}}}};
  vm.runInContext(js.replace('/*__IPNT_CFG__*/{}',JSON.stringify(config)),c);
  return {c,api:c.IPNT,local,session,nodo,llamadas,get recargas(){return recargas},get revocaciones(){return revocaciones}};
}
const espera=()=>new Promise(r=>setImmediate(r));

// 3. Sesión de Google recordada: no sincroniza, muestra la migración.
const vieja=entorno(cfg,{'ipnt.prov':'google','ipnt.cuenta':'ana@ejemplo.invalid','ipnt.gacc':JSON.stringify({name:'Ana',username:'ana@ejemplo.invalid'})});
await espera();
assert.equal(vieja.api.cuenta,null,'La sesión de Google no se restaura como cuenta');
assert.equal(vieja.api.proveedor,null);
assert.equal(vieja.llamadas.length,0,'Sin red al abrir con sesión de Google');
assert.equal(vieja.nodo('ipnt-mig-panel').hidden,false);assert.equal(vieja.nodo('ipnt-mig-aviso').hidden,false);
assert.equal(vieja.nodo('ipnt-mig-link').hidden,false);
vieja.api.set('hu.ficticio','local');await espera();assert.equal(vieja.llamadas.length,0,'No hay sincronización automática con Google');

// 4. Migración completa: leer de Google (solo GET), guardar aquí, continuar con Microsoft.
await vieja.nodo('ipnt-mig-1').handlers.click();await espera();
assert.ok(vieja.llamadas.length>=3);
assert.ok(vieja.llamadas.every(l=>l.m==='GET'),'Todas las llamadas a Google son de lectura');
assert.ok(vieja.llamadas.every(l=>!/upload/.test(l.u)));
assert.equal(vieja.session.getItem('ipnt.mig'),'datos');assert.equal(vieja.session.getItem('hu.nube'),'"desde google"');assert.equal(vieja.session.getItem('hu.ficticio'),'local','Lo más reciente de este navegador se conserva');
assert.equal(vieja.session.getItem('ipnt.prov'),null);assert.equal(vieja.session.getItem('ipnt.gacc'),null);assert.equal(vieja.session.getItem('ipnt.gtok'),null);
assert.equal(vieja.revocaciones,1,'El permiso de lectura se revoca al terminar');
assert.equal(vieja.nodo('ipnt-mig-3').disabled,false);assert.equal(vieja.nodo('ipnt-mig-1').disabled,true);
const antesMS=vieja.llamadas.length;
await vieja.nodo('ipnt-mig-3').handlers.click();await espera();
const ms=vieja.llamadas.slice(antesMS);
assert.ok(ms.length>0&&ms.every(l=>/graph\.microsoft\.com/.test(l.u)),'Tras el paso 3 solo se habla con Microsoft');
const subida=ms.find(l=>l.m==='PUT');assert.ok(subida);assert.match(subida.b,/desde google/);
assert.equal(vieja.api.proveedor,'ms');assert.equal(vieja.session.getItem('ipnt.prov'),'ms');
assert.equal(vieja.session.getItem('ipnt.mig'),'fin');assert.equal(vieja.nodo('ipnt-mig-fin').hidden,false);
assert.equal(vieja.llamadas.filter(l=>/googleapis\.com\/upload|\/upload\//.test(l.u)).length,0);
vieja.nodo('ipnt-mig-x').handlers.click();assert.equal(vieja.session.getItem('ipnt.mig'),null);assert.equal(vieja.nodo('ipnt-mig-panel').hidden,true);

// 5. El enlace discreto abre el panel sin sesión de Google; sin la capacidad, no aparece nada y Microsoft sigue igual.
const limpio=entorno(cfg);await espera();
assert.equal(limpio.nodo('ipnt-mig-panel').hidden,true);assert.equal(limpio.nodo('ipnt-mig-link').hidden,false);
limpio.nodo('ipnt-mig-link').handlers.click();assert.equal(limpio.nodo('ipnt-mig-panel').hidden,false);assert.equal(limpio.nodo('ipnt-mig-aviso').hidden,true);
const sinGoogle=entorno({...cfg,googleSoloMigracion:false,googleClientId:''},{'ipnt.prov':'google'});await espera();
assert.equal(sinGoogle.nodo('ipnt-mig-panel').hidden,true);assert.equal(sinGoogle.nodo('ipnt-mig-link').hidden,true);
sinGoogle.api.set('hu.ficticio','x');assert.equal(sinGoogle.session.getItem('hu.ficticio'),'x');   // solo local sigue funcionando
await sinGoogle.nodo('ipnt-login').handlers.click();await espera();
assert.equal(sinGoogle.api.proveedor,'ms');assert.ok(sinGoogle.llamadas.every(l=>/graph\.microsoft\.com/.test(l.u)));

// 6. Perfil inexistente en Drive: aviso y nada cambia.
const vacio=entorno(cfg);vacio.c.fetch=async u=>u.includes('/files?')?{ok:true,status:200,json:async()=>({files:[]})}:{ok:true,status:200,json:async()=>({name:'A',email:'a@ejemplo.invalid'})};
await vacio.nodo('ipnt-mig-1').handlers.click();await espera();
assert.equal(vacio.session.getItem('ipnt.mig'),null);assert.match(vacio.nodo('ipnt-mig-msg').textContent,/No encontramos/);
console.log('qa_sate_google: ok');
