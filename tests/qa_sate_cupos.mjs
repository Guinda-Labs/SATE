// Fixture inventado, DOM en memoria, fetch y reloj falsos. No abre navegadores ni usa red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(p,'utf8'), fuente=leer('tools/cupos_saes.js');
const c=vm.createContext({URL,URLSearchParams,Date});
vm.runInContext(fuente.split('/*__CUPOS_PANEL__*/')[0],c);
const C=c.IPNCupos, fixture=leer('tests/fixtures/ocupabilidad_ficticio.html');
const propias=[{materia:'M214',grupo:'2BM3'}],base=n=>({carrera:'B',plan:'09',filas:[{...propias[0],disponibles:n}]});
for(const [a,b,esperado] of [[0,2,1],[4,0,1],[5,3,1],[3,2,1],[2,2,0],[4,5,0],[0,4,1],[2,4,0]]){
  assert.equal(C.cambios(base(a),base(b),propias).length,esperado,`${a} → ${b}`);
  assert.equal(C.cambios(base(a),base(b),[]).length,0);
}
assert.equal(C.cambios(null,base(2),propias).length,0);
assert.equal(C.cambios(base(0),{...base(2),plan:'otro'},propias).length,0);
// Adaptador acotado al HTML de este fixture, sin sustituir el parser de producción.
function documento(html){
  const attrs=s=>Object.fromEntries([...s.matchAll(/([\w$]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const inputs=[...html.matchAll(/<input\b([^>]*)>/g)].map(m=>({...attrs(m[1]),checked:/\bchecked\b/.test(m[1])}));
  const selects=[...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].map(m=>{
    const options=[...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(o=>({...attrs(o[1]),textContent:o[2],selected:/\bselected\b/.test(o[1])}));
    return {...attrs(m[1]),options,value:(options.find(o=>o.selected)||options[0]).value};
  });
  const table=html.match(/<table id="ctl00_mainCopy_GrvOcupabilidad">([\s\S]*?)<\/table>/);
  const rows=table?[...table[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m=>({children:[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x=>({textContent:x[1]}))})):[];
  return {querySelector(sel){
    if(sel==='input[type="password"]')return inputs.find(i=>i.type==='password');
    if(sel==='#ctl00_mainCopy_GrvOcupabilidad')return table?{querySelectorAll:()=>rows}:null;
    const name=sel.match(/\[name="([^"]+)"\]/)?.[1];
    if(sel.includes(':checked'))return inputs.find(i=>i.name===name&&(!sel.includes('[value="1"]')||i.value==='1')&&i.checked);
    return selects.find(s=>s.name===name);
  },querySelectorAll(sel){return [...inputs.filter(i=>i.type==='hidden'||sel.includes('checkbox')&&i.type==='checkbox'&&i.checked),...selects]}};
}
const filas=C.parsear(documento(fixture));
assert.equal(filas.length,3);assert.equal(filas[0].disponibles,39);assert.equal(filas[1].disponibles,0);
assert.equal(filas[2].cupo,35);assert.equal(filas[0].materia,'B105');
for(const [html,error] of [[fixture.replace(/<tr><td>[\s\S]*?<\/table>/,'</table>'),'vacia'],[fixture.replace('Disponibles</th>','Libres</th>'),'columnas'],[fixture.replace('<td>39</td>','<td>39x</td>'),'numeros'],['<input type="password" name="clave">','sesion'],['<html></html>','vacia'],[fixture.replace('<td>39</td>',''),'columnas']])assert.throws(()=>C.parsear(documento(html)),new RegExp(error));
for(const o of ['https://saes.upiita.ipn.mx','https://www.saes.escom.ipn.mx'])assert.ok(C.origenSaes(o));
for(const o of ['http://saes.upiita.ipn.mx','https://saes.upiita.ipn.mx.evil.test','https://saes.upiita.ipn.mx:444','https://evil.test','null'])assert.equal(C.origenSaes(o),false);
assert.ok(C.origenSate('https://silver-vs.github.io','https://silver-vs.github.io/upiita/sate/index.html'));
assert.equal(C.origenSate('https://evil.test','https://silver-vs.github.io/upiita/sate/index.html'),false);
assert.equal(C.origenSate('https://silver-vs.github.io',''),false);
const url='https://www.saes.upiita.ipn.mx/Academica/Ocupabilidad_grupos.aspx',peticiones=[];
function conSeleccion(carrera,plan){return fixture.replace('value="B" selected','value="B"'+(carrera==='B'?' selected':'')).replace('value="E">','value="E"'+(carrera==='E'?' selected':'')+'>').replace('value="09" selected','value="09"'+(plan==='09'?' selected':'')).replace('value="98">','value="98"'+(plan==='98'?' selected':'')+'>')}
let car='B',pl='09';
const pedir=async(u,o)=>{assert.equal(u,url);peticiones.push(o);if(o.body){const b=new URLSearchParams(o.body);assert.equal(b.get('ctl00$mainCopy$rblEsquema'),'1');assert.equal(b.get('__VIEWSTATE'),'estado-ficticio');assert.equal(b.get('__EVENTVALIDATION'),'validacion-ficticia');const target=b.get('__EVENTTARGET');if(target.endsWith('dpdcarrera'))car=b.get(target);if(target.endsWith('dpdplan'))pl=b.get(target)}return {ok:true,url,text:async()=>conSeleccion(car,pl)}};
const r=await C.consultar({fetch:pedir,parser:documento,url,carrera:'E',plan:'98',opciones(){}});
assert.equal(r.carrera,'E');assert.equal(r.plan,'98');assert.deepEqual(peticiones.map(p=>p.method),['GET','POST','POST','POST']);
assert.ok(peticiones.every(p=>p.credentials==='same-origin'&&p.cache==='no-store'&&p.redirect==='manual'));
await C.consultar({fetch:pedir,parser:documento,url,carrera:'E',plan:'98',opciones(){}});assert.equal(peticiones.at(-1).method,'POST');
await assert.rejects(C.consultar({fetch:async()=>({ok:true,url:'https://www.saes.upiita.ipn.mx/Login.aspx',text:async()=>fixture}),parser:documento,url,opciones(){}}),/sesion/);
await assert.rejects(C.consultar({fetch:async()=>({type:'opaqueredirect',status:0}),parser:documento,url,opciones(){}}),/sesion/);
await assert.rejects(C.consultar({fetch:pedir,parser:documento,url,carrera:'E',plan:'invalido',opciones(){}}),/plan/);
// SAES real: la primera carga (GET) no trae carrera ni plan; aparecen tras elegir el periodo actual (sesión real, 2026-10-14).
{const sinSelects=fixture.replace(/<select name="ctl00\$mainCopy\$dpdcarrera">[\s\S]*?<\/select>/,'').replace(/<select name="ctl00\$mainCopy\$dpdplan">[\s\S]*?<\/select>/,'');
 assert.ok(!sinSelects.includes('dpdcarrera'));car='B';pl='09';
 const real=async(u,o)=>o.method==='GET'?{ok:true,status:200,url,text:async()=>sinSelects}:pedir(u,o);
 const r2=await C.consultar({fetch:real,parser:documento,url,carrera:'E',plan:'98',opciones(){}});assert.equal(r2.carrera,'E');assert.ok(r2.filas.length>0)}
await assert.rejects(C.consultar({fetch:async()=>({ok:true,url,text:async()=>'<input type="password" name="clave">'}),parser:documento,url,opciones(){}}),/sesion/);
let periodoLlamadas=0;
await C.consultar({fetch:async(u,o)=>{periodoLlamadas++;if(o.body&&periodoLlamadas===2)assert.equal(new URLSearchParams(o.body).get('__EVENTTARGET'),'ctl00$mainCopy$rblEsquema$0');return {ok:true,url,text:async()=>periodoLlamadas===1?fixture.replace('value="1" checked','value="1"').replace('value="3">','value="3" checked>'):fixture}},parser:documento,url,opciones(){}});
assert.equal(periodoLlamadas,3);
let filtroLlamadas=0;
await C.consultar({fetch:async(u,o)=>{filtroLlamadas++;if(o.body)assert.equal(new URLSearchParams(o.body).has('ctl00$mainCopy$Chkgrupo'),false);return {ok:true,url,text:async()=>filtroLlamadas===1?fixture.replace('<form>','<form><input type="checkbox" name="ctl00$mainCopy$Chkgrupo" value="on" checked>'):fixture}},parser:documento,url,opciones(){}});
assert.equal(filtroLlamadas,3);

const config=JSON.parse(leer('web/dist/sate/index.html').match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
const comun=fuente.split('/*__CUPOS_PANEL__*/')[0];
let t=Date.now();
const payload={tipo:'ipnt.cupos.datos',v:1,unidad:'upiita',carrera:'B',plan:'09',hora:new Date(t).toISOString(),filas};
const siguiente={...payload,hora:new Date(t+1000).toISOString()};
assert.equal(C.reciente(payload,siguiente),siguiente);assert.equal(C.reciente(siguiente,payload),siguiente);
assert.equal(C.reciente(payload,{...siguiente,filas:[{cupo:-1}]}),payload);
const seleccion=[{grupo:'1BM4',materia:'B105',horas:[[0,540,600]]},{grupo:'2BM1',materia:'B205',horas:[[0,600,660]]}];
const oferta=[{grupo:'1BM3',materia:'B105',horas:[[0,630,690]]}];
const nombreLargo='Materia ficticia con un nombre académico extraordinariamente largo para comprobar el ajuste de la tarjeta';
seleccion[0].nombre=nombreLargo;seleccion[0].profesor='Docente ficticio';seleccion[0].horario='Lun 09:00–10:00';
assert.equal(C.tarjetas(payload,seleccion,oferta)[0].alternativas[0].choque,true);
assert.equal(C.tarjetas(payload,seleccion,[{...oferta[0],horas:[[0,660,720]]}])[0].alternativas[0].choque,false);
assert.equal(C.tarjetas(payload,seleccion,[])[0].alternativas[0].choque,null);
assert.equal(C.validar({...payload,filas:[null]}),false);
assert.equal(C.limpiar({...payload,identidad:'dato inventado'}).identidad,undefined);
// Receptora real: almacenamiento, BroadcastChannel y OneDrive doble, en las tres unidades.
for(const unidad of ['upiita','escom','upibi']){
  const prefix=unidad==='upiita'?'hu.':'hu.'+unidad+'.',origin=new URL(config.unidades[unidad].saes).origin;
  const eventos={},storage=new Map(),difundidos=[],enviados=[],graph=[],nodos=new Map(),modales=[];
  const nuevo=tag=>({tagName:tag?.toUpperCase(),hijos:[],appendChild(n){this.hijos.push(n)},closest(){return this},removeAttribute(){},cloneNode(){return nuevo(this.tagName)}});
  const nodo=id=>{if(!nodos.has(id))nodos.set(id,{...nuevo(),value:'',checked:true,innerHTML:'',querySelector:nodo,textContent:'',classList:{toggle(){}},focus(){},scrollIntoView(){throw Error('Cupos no debe desplazar la página')}});return nodos.get(id)};
  const opener={postMessage:(d,o)=>enviados.push({d,o})};let sesion=false,nube=null;
  const ipnt={get cuenta(){return sesion?{}:null},get proveedor(){return sesion?'ms':null},set:(k,v)=>storage.set(k,v),cupos:async(u,d)=>{graph.push({u,d});if(d)nube=d;return nube}};
  const ctx=vm.createContext({URL,URLSearchParams,Date:class extends Date{static now(){return t}},console,location:{href:'https://sate.test/sate/cupos.html?unidad='+unidad},
    CUPOS_CONFIG:{textos:config.textos,unidades:{[unidad]:{saes:config.unidades[unidad].saes,prefijo:prefix}}},
    fetch:async ruta=>({ok:true,json:async()=>ruta.endsWith('nucleo.json')?{opciones_plan:{B:{carrera:'B',plan:'09'}}}:{asig:['Oferta ficticia'],prof:['Docente de oferta'],periodos:{actual:[['B','M',1,'1BM3',0,[0],[[0,630,690]],4,'B105']]}}}),
    SateUI:{usarTextos(){},modal:(...args)=>modales.push(args)},document:{getElementById:nodo},localStorage:{getItem:k=>storage.get(k)},IPNT:ipnt,BroadcastChannel:class{constructor(n){assert.equal(n,'ipnt-cupos')}postMessage(d){difundidos.push(d)}}});
  ctx.window=ctx;ctx.opener=opener;ctx.addEventListener=(k,f)=>eventos[k]=f;
  vm.runInContext(comun+leer('web/sate/cupos-receptor.js'),ctx);
  const d={...payload,unidad};
  const mensaje=(origin,source,data)=>eventos.message({origin,source,data});
  const veneno={get unidad(){throw Error('No interpretar origen ajeno')}};
  mensaje('https://evil.test',opener,veneno);mensaje(origin,{},veneno);
  assert.equal(storage.size,0);assert.equal(graph.length,0);
  mensaje(origin,opener,{...d,filas:[{...filas[0],cupo:-1}]});assert.equal(storage.size,0);
  storage.set(prefix+'cuposContexto',JSON.stringify({carrera:'B',plan:'09',grupos:seleccion,oferta}));
  mensaje(origin,opener,d);await new Promise(ok=>setImmediate(ok));
  assert.equal(JSON.parse(storage.get(prefix+'cupos')).hora,d.hora);assert.equal(difundidos.length,1);
  assert.equal(graph.length,0);assert.match(nodo('cupos-resumen').textContent,/Última consulta:.*conectado al SAES/);
  assert.match(nodo('cupos-tabla').innerHTML,/<table/);
  assert.match(nodo('cupos-tabla').innerHTML,/Docente ficticio/);
  assert.ok(nodo('cupos-tabla').innerHTML.includes(nombreLargo));
  nodo('cupos-tabla').onclick({target:{closest:()=>({dataset:{grupo:'1BM4|B105'}})}});
  assert.match(modales.at(-1)[1],/Docente ficticio.*09:00/);
  nodo('[data-r="filtro"]').value='B205';nodo('[data-r="filtro"]').oninput();assert.doesNotMatch(nodo('cupos-tabla').innerHTML,/1BM3/);
  nodo('[data-r="filtro"]').value='';nodo('[data-r="filtro"]').oninput();
  mensaje(origin,opener,{tipo:'ipnt.cupos.ritmo',v:1,unidad,n:1,busy:false});assert.equal(nodo('[data-r="consultar"]').textContent,'Consultar en 1 segundo');
  assert.ok(enviados.every(e=>e.o===origin));assert.equal(enviados[0].d.grupos.length,2);
  const antes=enviados.length;eventos.storage({key:prefix+'cuposContexto'});assert.equal(enviados.length,antes+1);
  sesion=true;await eventos['ipnt-sincronizado']();
  assert.equal(graph.filter(x=>x.d).length,1);assert.equal(nube.unidad,unidad);
  nube={...d,hora:new Date(t+1000).toISOString()};await eventos['ipnt-sincronizado']();
  assert.equal(JSON.parse(storage.get(prefix+'cupos')).hora,nube.hora);
  // Horarios real: elige la más reciente, avisa a 61 min y conserva la consulta al recargar.
  const handlers={};let renders=0;
  Object.assign(ctx,{UNIDAD:unidad,HU:prefix,DATA:{opciones_plan:{B:{carrera:'B',plan:'09'}}},S:{car:'B',gen:null},
    SATE:{texto:(k,v={})=>k==='sate.lector.mismo_marcador'?config.textos[k]:C.texto(config.textos,k.replace('sate.cupos.',''),v)},name:c=>c[8],profs:()=>'',DAYS:['Lun'],hm:String,
    document:{hidden:false,documentElement:{},createElement:nuevo,querySelectorAll:()=>[nodo('ayuda-cupos')]},getComputedStyle:()=>({getPropertyValue:()=>''}),
    setInterval(){},selected:()=>[['B','M',1,'1BM4',0,[],[[0,540,600]],4,'B105']],classes:()=>[],
    $:nodo,esc:String,renderOffer:()=>renders++,renderCal(){},renderGen(){}});
  ctx.addEventListener=(k,f)=>handlers[k]=f;
  vm.runInContext(leer('web/sate/cupos.js')+';globalThis.cupos=CUPOS',ctx);
  ctx.cupos.montar();await new Promise(ok=>setImmediate(ok));
  nodo('ayuda-cupos').onclick();assert.equal(modales.at(-1)[0],'Consultar cupos');
  const cuerpo=modales.at(-1)[1];
  assert.equal(cuerpo.hijos.find(n=>n.tagName==='OL').hijos.length,3);
  assert.equal(cuerpo.hijos[1].textContent,config.textos['sate.lector.mismo_marcador']);
  assert.match(nodo('#cupos-estado').textContent,/Última consulta:/);assert.equal(nodo('#cupos-omitir').checked,true);
  nube={...d,hora:new Date(t+2000).toISOString()};await handlers['ipnt-sincronizado']();
  assert.equal(JSON.parse(storage.get(prefix+'cupos')).hora,nube.hora);
  const guardada=nube.hora;nube=d;await handlers['ipnt-sincronizado']();assert.equal(JSON.parse(storage.get(prefix+'cupos')).hora,guardada);
  const grupo=ctx.selected()[0];assert.equal(ctx.cupos.excluir(grupo),true);assert.match(ctx.cupos.insignia(grupo),/Sin lugares/);
  t+=61*60000;ctx.cupos.pintar();assert.match(nodo('#cupos-estado').textContent,/Consulta antigua/);
  assert.equal(nodo('#cupos-omitir').checked,false);assert.equal(ctx.cupos.excluir(grupo),false);
  assert.match(nodo('#cupos-ayuda').textContent,/más de una hora/);
  assert.match(nodo('#cupos-omitir-ayuda').textContent,/más de una hora/);
  ctx.S.car='E';ctx.cupos.pintar();assert.equal(nodo('#cupos-estado').textContent,'');assert.equal(nodo('#cupos-omitir').disabled,true);
  t-=61*60000;
  // Notificaciones con doble, sin navegador: el permiso exige clic en SATE.
  const notificaciones=[];let solicitudes=0,enfoques=0,audios=0,tonos=0;
  ctx.AudioContext=class{constructor(){audios++;this.state='running';this.currentTime=0}resume(){return Promise.resolve()}createOscillator(){tonos++;return {frequency:{},connect(){},start(){},stop(){}}}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}};
  assert.equal(audios,0);nodo('[data-r="sonido"]').checked=true;nodo('[data-r="sonido"]').onchange();assert.equal(audios,1);
  storage.set(prefix+'cuposContexto',JSON.stringify({carrera:'B',plan:'09',grupos:seleccion,oferta}));
  ctx.document={getElementById:nodo};
  ctx.Notification=class{static permission='default';static async requestPermission(){solicitudes++;return this.permission='granted'}
    constructor(t,o){this.t=t;this.o=o;notificaciones.push(this)}close(){}};
  ctx.focus=()=>enfoques++;
  mensaje(origin,opener,{tipo:'ipnt.cupos.avisos',v:1,unidad,hasta:t+1800000,notificacion:true});
  assert.equal(solicitudes,0);assert.equal(nodo('cupos-permitir').hidden,false);
  const cambio={...d,hora:new Date(t+3000).toISOString(),filas:d.filas.map(f=>({...f,disponibles:2}))};
  mensaje(origin,opener,cambio);assert.equal(notificaciones.length,0);
  assert.equal(tonos,1);
  await nodo('cupos-permitir').onclick();assert.equal(solicitudes,1);
  const lleno={...cambio,hora:new Date(t+4000).toISOString(),filas:cambio.filas.map(f=>({...f,disponibles:0}))};
  mensaje(origin,opener,lleno);assert.equal(notificaciones.length,2);
  assert.equal(tonos,2);
  mensaje(origin,opener,lleno);assert.equal(notificaciones.length,2);
  assert.equal(tonos,2);
  notificaciones[0].onclick();assert.equal(enfoques,1);
  ctx.Notification.permission='denied';
  const libre={...cambio,hora:new Date(t+5000).toISOString()};mensaje(origin,opener,libre);assert.equal(notificaciones.length,2);
  ctx.Notification.permission='granted';mensaje(origin,opener,{tipo:'ipnt.cupos.avisos',v:1,unidad,hasta:0,notificacion:true});
  mensaje(origin,opener,{...lleno,hora:new Date(t+6000).toISOString()});assert.equal(notificaciones.length,2);
  storage.delete(prefix+'cuposContexto');storage.set('saes.alumno',JSON.stringify({unidad,carrera:'B',plan:'09'}));
  eventos.storage({key:prefix+'cuposContexto'});
  assert.equal(enviados.at(-1).d.carrera,'B');assert.equal(enviados.at(-1).d.plan,'09');
  assert.match(nodo('cupos-tabla').innerHTML,/Docente de oferta/);
}
// Cliente de cuenta real con fetch doble: no crea otra instancia MSAL.
const cuenta=leer('tools/cuenta.py'),api=cuenta.slice(cuenta.indexOf('  async function con('),cuenta.indexOf('  // Microsoft Entra'));
let llamadas=[];
const gc=vm.createContext({cuenta:null,prov:null,MS:{tok:async()=>'ficticio'},fetch:async(u,o)=>{llamadas.push({u,o});return {ok:true,status:200,json:async()=>payload}}});
vm.runInContext(api+';globalThis.api=cupos',gc);
assert.equal(await gc.api('upiita'),null);assert.equal(llamadas.length,0);
gc.cuenta={};gc.prov={id:'google'};await gc.api('upiita',payload);assert.equal(llamadas.length,0);
gc.prov={id:'ms'};await gc.api('upiita',payload);await gc.api('upiita');
assert.match(llamadas[0].u,/approot:\/cupos-upiita\.json:\/content$/);assert.equal(llamadas[0].o.method,'PUT');
assert.equal(llamadas[0].o.headers.Authorization,'Bearer ficticio');assert.equal(llamadas[1].o.method,undefined);
llamadas=[];gc.fetch=async(u,o)=>{llamadas.push({u,o});return {ok:true,status:200,json:async()=>u.endsWith('.json')?{'@microsoft.graph.downloadUrl':'https://descarga.invalid/cupos-ficticios'}:payload}};
assert.equal((await gc.api('upiita')).hora,payload.hora);assert.equal(llamadas.length,2);
assert.equal(llamadas[1].u,'https://descarga.invalid/cupos-ficticios');assert.equal(llamadas[1].o,undefined);
assert.match(cuenta,/mobnote\|cupos\|cuposContexto/);
gc.fetch=async()=>({ok:false,status:404});assert.equal(await gc.api('upiita'),null);
gc.fetch=async()=>({ok:false,status:503});await assert.rejects(gc.api('upiita',payload),/503.*guardar.*upiita/);
// El generador real aplica el filtro también sobre las obligatorias.
const horarios=leer('web/sate/horarios.js'),grupo=['B','M',1,'1BM4',0,[],[[0,540,600]],4,'B105'];
const generador=vm.createContext({S:{car:'B',chips:[],onlyWant:true,gpref:[],gavoid:[],gt:'*'},GT:{src:'todo',n:'auto',a:'',b:''},
  classes:()=>[grupo],tr:()=>({want:['B105'],oblig:['B105'],done:[],curso:[]}),ws:()=>({marks:{}}),norm:String,ownAsClasses:()=>[],keyOf:g=>g[3],DATA:{prof:[]},tmin:()=>null,overlaps:()=>false,
  cur:()=>({B105:true}),optCupo:()=>({}),optExceso:()=>({}),CUPOS:{excluir:()=>true},txH:k=>k,performance});
vm.runInContext('function* generateBank(s){return s}',generador);  // doble: el banco real es un generador por pasos
vm.runInContext(horarios.slice(horarios.indexOf('function* pasoGen('),horarios.indexOf('function* generateBank(')),generador);
assert.equal(generador.generate()[0].opts.length,0);generador.CUPOS.excluir=()=>false;assert.equal(generador.generate()[0].opts.length,1);
generador.tr=()=>({want:[],oblig:[],done:[],curso:[]});assert.equal(generador.generate(['B105'])[0].opts.length,1);
// Textos de cupos y entradas antiguas; sin navegador ni red.
assert.equal(C.texto(config.textos,'lugares',{n:1}),'1 lugar');
assert.equal(C.texto(config.textos,'lugares',{n:2}),'2 lugares');
assert.equal(C.texto(config.textos,'lugares',{n:0}),'Sin lugares');
assert.match(C.texto(config.textos,'aviso',{n:1,materia:'B105',grupo:'1BM3'}),/1 lugar$/);
for(const archivo of ['lector','cupos'])assert.match(leer('web/dist/'+archivo+'.js'),/sate\.js\?v=/);
// Barra real ejecutada desde Inicio.aspx, sin selects ni tabla en la página visible.
let panelMessage,peticionesPanel=0,tiempo=Date.now(),intervalos=[],visibilidad,aperturas=0;
const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,{value:'',innerHTML:'',style:{setProperty(){}}});return nodes.get(k)};
const atributos={};const panel={setAttribute(k,v){atributos[k]=v},focus(){},addEventListener(){},querySelector:s=>node(s),style:{setProperty(){}},remove(){}};
const sesionPanel=new Map(),preferenciaPanel=new Map();let anchoFino=true;
let receptor={closed:false,postMessage(){}};
const mc=vm.createContext({URL,URLSearchParams,Date:class extends Date{static now(){return tiempo}},console,
  matchMedia:q=>{assert.equal(q,'(min-width: 900px) and (pointer: fine)');return {matches:anchoFino}},
  localStorage:{getItem:k=>preferenciaPanel.get(k),setItem:(k,v)=>preferenciaPanel.set(k,v)},sessionStorage:{getItem:k=>sesionPanel.get(k),setItem:(k,v)=>sesionPanel.set(k,v)},
  location:{origin:new URL(url).origin,hostname:new URL(url).hostname,pathname:'/Inicio.aspx'},
  document:{hidden:false,addEventListener:(k,f)=>{visibilidad=f},removeEventListener(){},getElementById:()=>null,createElement:k=>k==='style'?{remove(){}}:panel,head:{appendChild(){}},body:{appendChild(){}},querySelector:()=>null},
  setInterval:(f,ms)=>{assert.equal(ms,1000);intervalos.push(f);return intervalos.length},clearInterval(){},DOMParser:class{parseFromString(s){return documento(s)}}});
mc.window=mc;mc.open=(u,n,o)=>{aperturas++;assert.match(u,/cupos.html\?unidad=upiita/);assert.equal(n,'sate-cupos');return receptor};
mc.addEventListener=(k,f)=>panelMessage=f;mc.removeEventListener=()=>{};
let panelCar='B',panelPlan='09';
mc.fetch=async(u,o)=>{assert.equal(u,url);peticionesPanel++;if(o.body){const b=new URLSearchParams(o.body),target=b.get('__EVENTTARGET');if(target.endsWith('dpdcarrera'))panelCar=b.get(target);if(target.endsWith('dpdplan'))panelPlan=b.get(target)}return {ok:true,url,text:async()=>conSeleccion(panelCar,panelPlan)}};
const ejecutar=()=>vm.runInContext(fuente.replace("'__CUPOS_URL__'",JSON.stringify('https://sate.test/sate/cupos.html')).replace('__CUPOS_TEXTOS__',JSON.stringify(config.textos)),mc);
const esperar=async()=>{for(let i=0;i<40;i++)await Promise.resolve()};
const mensaje=d=>panelMessage({origin:'https://sate.test',source:receptor,data:d});
ejecutar();assert.equal(peticionesPanel,0);assert.equal(aperturas,1);
assert.equal(atributos['data-modo'],'ventana');assert.equal(node('[data-c="hoja"]').hidden,false);
mensaje({tipo:'ipnt.cupos.hola'});mensaje({tipo:'ipnt.cupos.seleccion',v:1,carrera:'B',plan:'09',grupos:seleccion});await esperar();
assert.equal(peticionesPanel,3);assert.match(node('[data-c="estado"]').textContent,/conectado a SATE/);
await node('[data-c="actualizar"]').onclick();assert.equal(peticionesPanel,3);
assert.match(node('[data-c="actualizar"]').textContent,/15 segundos/);
tiempo+=14000;await intervalos[0]();assert.match(node('[data-c="actualizar"]').textContent,/1 segundo$/);
tiempo+=1000;await intervalos[0]();assert.equal(node('[data-c="actualizar"]').disabled,false);
await node('[data-c="actualizar"]').onclick();assert.equal(peticionesPanel,6);
panelMessage({origin:'https://evil.test',source:receptor,data:{get tipo(){throw Error('origen ajeno')}}});
receptor.closed=true;await intervalos[0]();assert.match(node('[data-c="estado"]').textContent,/Ventana de SATE cerrada/);
assert.equal(node('[data-c="abrir"]').hidden,false);assert.equal(aperturas,1);
await node('[data-c="actualizar"]').onclick();assert.equal(aperturas,1);assert.equal(peticionesPanel,6);
receptor={closed:false,postMessage(){}};node('[data-c="abrir"]').onclick();assert.equal(aperturas,2);mensaje({tipo:'ipnt.cupos.hola'});
node('[data-c="auto"]').checked=true;node('[data-c="auto"]').onchange();
const pulso=intervalos[0];tiempo+=59999;await pulso();assert.equal(peticionesPanel,6);
mc.document.hidden=true;tiempo++;await visibilidad();await pulso();assert.equal(peticionesPanel,6);
assert.match(node('[data-c="automatico"]').textContent,/pausa/);
mc.document.hidden=false;await visibilidad();await esperar();assert.equal(peticionesPanel,9);
tiempo+=30*60000;await pulso();assert.equal(node('[data-c="auto"]').checked,false);assert.equal(node('[data-c="seguir"]').hidden,false);
const fin=peticionesPanel;await pulso();assert.equal(peticionesPanel,fin);
node('[data-c="seguir"]').onclick();await esperar();assert.equal(peticionesPanel,fin+3);
tiempo+=15000;mensaje({tipo:'ipnt.cupos.consultar',v:1,carrera:'E',plan:'98'});await esperar();assert.equal(panelCar,'E');assert.equal(panelPlan,'98');
mensaje({tipo:'ipnt.cupos.seleccion',v:1,carrera:'B',plan:'09',grupos:seleccion});
tiempo+=15000;await node('[data-c="actualizar"]').onclick();assert.equal(panelCar,'E');assert.equal(panelPlan,'98');
node('[data-c="cerrar"]').onclick();
// Reapertura de marcador conserva el mínimo manual, y bloqueo se explica sin alert().
mc.open=()=>null;ejecutar();assert.match(node('[data-c="estado"]').textContent,/permite las ventanas emergentes/);
assert.equal(node('[data-c="abrir"]').hidden,false);
node('[data-c="cerrar"]').onclick();
// CUP6: teléfono y tableta táctil, contexto de sesión, detalle de un solo envío.
anchoFino=false;tiempo+=60000;nodes.clear();let enviadosMovil=[],vibraciones=0;
mc.navigator={vibrate:()=>vibraciones++};mc.open=()=>{aperturas++;return receptor={closed:false,postMessage:d=>enviadosMovil.push(d)}};
const abiertas=aperturas;ejecutar();await esperar();
assert.equal(atributos['data-modo'],'saes');assert.equal(aperturas,abiertas);assert.equal(node('[data-c="hoja"]').hidden,false);
assert.match(node('[data-c="grupos"]').innerHTML,/Tus grupos/);
assert.match(node('[data-c="otros"]').innerHTML,/Otros con lugar.*1BM3/);assert.match(node('[data-c="ultima"]').textContent,/Última consulta:/);
node('[data-c="detalle"]').onclick();assert.equal(aperturas,abiertas+1);
assert.equal(enviadosMovil.filter(d=>d.tipo==='ipnt.cupos.datos').length,0);
mensaje({tipo:'ipnt.cupos.hola'});mensaje({tipo:'ipnt.cupos.hola'});
assert.equal(enviadosMovil.filter(d=>d.tipo==='ipnt.cupos.datos').length,1);
let permisosMovil=0;mc.Notification=class{static permission='default';static async requestPermission(){permisosMovil++;this.permission='granted'}};
await node('[data-c="permitir"]').onclick();assert.equal(permisosMovil,1);assert.equal(node('[data-c="permitir"]').hidden,true);
delete mc.Notification;
node('[data-c="plegar"]').onclick();assert.equal(node('[data-c="hoja"]').hidden,true);
assert.equal(atributos['data-plegada'],'true');assert.equal(node('[data-c="cabecera"]').hidden,true);
assert.match(node('[data-c="resumen"]').textContent,/Cupos · .* · \d+ de tus grupos con lugar/);
node('[data-c="filtro"]').value='B205';node('[data-c="filtro"]').oninput();assert.equal(node('[data-c="hoja"]').hidden,true);
assert.doesNotMatch(node('[data-c="tabla"]').innerHTML,/1BM3/);
node('[data-c="auto"]').checked=true;node('[data-c="auto"]').onchange();const movilAntes=peticionesPanel;
mc.document.hidden=true;tiempo+=60000;await visibilidad();await esperar();assert.equal(peticionesPanel,movilAntes);
mc.document.hidden=false;await visibilidad();await esperar();assert.equal(peticionesPanel,movilAntes+3);
assert.equal(enviadosMovil.filter(d=>d.tipo==='ipnt.cupos.datos').length,1);
// Cambios de cupos sobre grupos elegidos: resaltado, título y vibración.
mc.fetch=async()=>({ok:true,url,text:async()=>fixture.replace('<td>0</td></tr>','<td>2</td></tr>')});
tiempo+=60000;await visibilidad();await esperar();assert.ok(vibraciones>0);assert.match(mc.document.title,/Cupos/);assert.ok(node('[data-c="aviso"]').textContent);
mc.IPNCuposCambiarModo('ventana');assert.equal(atributos['data-modo'],'ventana');assert.equal(aperturas,abiertas+2);
node('[data-c="cerrar"]').onclick();
// Preferencia manual prevalece sobre el dispositivo; sin contexto ofrece tabla y sincronización.
preferenciaPanel.set('ipnt.cupos.modo','saes');sesionPanel.clear();anchoFino=true;tiempo+=60000;ejecutar();await esperar();
assert.equal(atributos['data-modo'],'saes');assert.match(node('[data-c="sincronizar"]').textContent,/Abre SATE una vez/);assert.match(node('[data-c="tabla"]').innerHTML,/<table/);
node('[data-c="cerrar"]').onclick();
// Capacidad de notificación: registro existente, constructor ausente o no utilizable.
// La revisión usa los componentes reales con datos inyectados y jamás consulta, incluso en un origen SAES.
const peticionesRevision=peticionesPanel,aperturasRevision=aperturas;
mc.IPNCuposMontar({datos:{...payload,carrera:'B',plan:'09',filas},seleccion:{carrera:'B',plan:'09',grupos:filas},plegada:true,opciones:{carrera:[{valor:'B',texto:'Carrera ficticia'}],plan:[{valor:'09',texto:'Plan ficticio'}]}});
assert.match(node('[data-c="resumen"]').textContent,/2 de tus grupos con lugar/);
await node('[data-c="actualizar"]').onclick();node('[data-c="detalle"]').onclick();
assert.equal(peticionesPanel,peticionesRevision);assert.equal(aperturas,aperturasRevision);
node('[data-c="plegar"]').onclick();assert.equal(node('[data-c="hoja"]').hidden,false);
node('[data-c="plegar"]').onpointerdown({clientY:0});node('[data-c="plegar"]').onpointerup({clientY:60});
node('[data-c="plegar"]').onclick();assert.equal(node('[data-c="hoja"]').hidden,true);
node('[data-c="plegar"]').onclick();assert.equal(node('[data-c="hoja"]').hidden,false);
node('[data-c="cerrar"]').onclick();
const revision=leer('web/qa-cupos-hoja.html');
// CUP9: el mismo panel se monta en la raíz aislada de la ventana, con su CSS y limpieza.
let panelIntegrado,estiloIntegrado;
mc.IPNTSateContenedor={appendChild:p=>{panelIntegrado=p},getRootNode:()=>({appendChild:e=>{estiloIntegrado=e}})};
mc.IPNCuposMontar({datos:{...payload,carrera:'B',plan:'09',filas},seleccion:null,opciones:{carrera:[],plan:[]}});
assert.equal(panelIntegrado,panel);assert.match(estiloIntegrado.textContent,/#ipnt-sate #ipnt-cupos\{position:static/);
assert.equal(peticionesPanel,peticionesRevision);assert.equal(aperturas,aperturasRevision);
assert.equal(mc.IPNTSateContenedor,undefined);assert.equal(typeof mc.IPNCuposCerrar,'function');
mc.IPNCuposCerrar();assert.equal(mc.IPNCuposCerrar,undefined);assert.equal(mc.IPNCuposCambiarModo,undefined);
assert.doesNotMatch(revision,/__REVISION_|__CUPOS_URL__|__CUPOS_TEXTOS__|<script[^>]*src=/);
assert.match(revision,/connect-src 'none'/);
for(const bloque of revision.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new Function(bloque[1]));
let persistentes=0,directas=0;
c.Notification=class{static permission='granted';constructor(){directas++}};
c.navigator={serviceWorker:{getRegistration:async()=>({}),ready:Promise.resolve({showNotification:async()=>persistentes++})}};
C.notificar('Cupos',{});await esperar();assert.equal(persistentes,1);assert.equal(directas,0);
c.navigator={};C.notificar('Cupos',{});assert.equal(directas,1);
delete c.Notification;assert.doesNotThrow(()=>C.notificar('Cupos',{}));
c.Notification=class{static permission='granted';constructor(){throw Error('No admite constructor')}};assert.doesNotThrow(()=>C.notificar('Cupos',{}));
// Contratos estáticos para 375 px. El DOM en memoria no mide layout ni orientación.
assert.match(fuente,/width:calc\(100% - 16px\)/);assert.match(fuente,/minmax\(0,1fr\) 7rem/);
assert.match(fuente,/max-width:100%;overflow:auto/);assert.match(fuente,/prefers-color-scheme:dark/);
assert.match(fuente,/max-height:calc\(100dvh - 16px\)/);assert.match(fuente,/min-height:44px/);
const htmlCupos=leer('web/sate/cupos.html');assert.match(htmlCupos,/location.replace\(destino.href\)/);assert.match(htmlCupos,/destino.hash=location.hash/);assert.match(htmlCupos,/searchParams.set\('vista','cupos'\)/);
assert.doesNotMatch(fuente,/alert\(|ipnt-elegido|originales/);
assert.doesNotMatch(fuente+leer('web/sate/cupos-receptor.js'),/postMessage\([^\n]*['"]\*['"]/);
for(const p of ['web/dist/sate.js','web/dist/lector.js','web/dist/cupos.js','web/dist/sate/cupos.js','web/dist/sate/cupos-receptor.js'])assert.doesNotThrow(()=>new Function(leer(p)));
assert.doesNotMatch(leer('web/dist/sate.js'),/__CUPOS_URL__|__CUPOS_TEXTOS__|__SATE_LECTOR__|__SATE_CUPOS__/);
console.log('Cupos: resumen plegado, revisión sin red, compatibilidad y contratos CSS a 375 px. Sin navegador ni red.');
