// Fixture inventado, DOM en memoria, fetch y reloj falsos. No abre navegadores ni usa red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(p,'utf8'), fuente=leer('tools/cupos_saes.js');
const c=vm.createContext({URL,URLSearchParams,Date});
vm.runInContext(fuente.split('/*__CUPOS_PANEL__*/')[0],c);
const C=c.IPNCupos, fixture=leer('tests/fixtures/ocupabilidad_ficticio.html');
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
assert.equal(C.tarjetas(payload,seleccion,oferta)[0].alternativas[0].choque,true);
assert.equal(C.tarjetas(payload,seleccion,[{...oferta[0],horas:[[0,660,720]]}])[0].alternativas[0].choque,false);
assert.equal(C.tarjetas(payload,seleccion,[])[0].alternativas[0].choque,null);
assert.equal(C.validar({...payload,filas:[null]}),false);
assert.equal(C.limpiar({...payload,identidad:'dato inventado'}).identidad,undefined);
// Receptora real: almacenamiento, BroadcastChannel y OneDrive doble, en las tres unidades.
for(const unidad of ['upiita','escom','upibi']){
  const prefix=unidad==='upiita'?'hu.':'hu.'+unidad+'.',origin=new URL(config.unidades[unidad].saes).origin;
  const eventos={},storage=new Map(),difundidos=[],enviados=[],graph=[],nodos=new Map();
  const nodo=id=>{if(!nodos.has(id))nodos.set(id,{textContent:'',classList:{toggle(){}},focus(){},scrollIntoView(){}});return nodos.get(id)};
  const opener={postMessage:(d,o)=>enviados.push({d,o})};let sesion=false,nube=null;
  const ipnt={get cuenta(){return sesion?{}:null},get proveedor(){return sesion?'ms':null},set:(k,v)=>storage.set(k,v),cupos:async(u,d)=>{graph.push({u,d});if(d)nube=d;return nube}};
  const ctx=vm.createContext({URL,URLSearchParams,Date:class extends Date{static now(){return t}},console,location:{href:'https://sate.test/sate/cupos.html?unidad='+unidad},
    CUPOS_CONFIG:{textos:config.textos,unidades:{[unidad]:{saes:config.unidades[unidad].saes,prefijo:prefix}}},
    document:{getElementById:nodo},localStorage:{getItem:k=>storage.get(k)},IPNT:ipnt,BroadcastChannel:class{constructor(n){assert.equal(n,'ipnt-cupos')}postMessage(d){difundidos.push(d)}}});
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
  assert.equal(graph.length,0);assert.match(nodo('cupos-resumen').textContent,/Última consulta:.*3 grupos/);
  assert.ok(enviados.every(e=>e.o===origin));assert.equal(enviados[0].d.grupos.length,2);
  const antes=enviados.length;eventos.storage({key:prefix+'cuposContexto'});assert.equal(enviados.length,antes+1);
  sesion=true;await eventos['ipnt-sincronizado']();
  assert.equal(graph.filter(x=>x.d).length,1);assert.equal(nube.unidad,unidad);
  nube={...d,hora:new Date(t+1000).toISOString()};await eventos['ipnt-sincronizado']();
  assert.equal(JSON.parse(storage.get(prefix+'cupos')).hora,nube.hora);
  // Horarios real: elige la más reciente, avisa a 61 min y conserva la consulta al recargar.
  const handlers={};let renders=0;
  Object.assign(ctx,{UNIDAD:unidad,HU:prefix,DATA:{opciones_plan:{B:{carrera:'B',plan:'09'}}},S:{car:'B',gen:null},
    SATE:{texto:(k,v={})=>(config.textos[k]||k).replace(/\{(\w+)\}/g,(_,n)=>v[n]??'')},
    document:{hidden:false,documentElement:{},querySelectorAll:()=>[]},getComputedStyle:()=>({getPropertyValue:()=>''}),
    setInterval(){},selected:()=>[['B','M',1,'1BM4',0,[],[[0,540,600]],4,'B105']],classes:()=>[],
    $:nodo,esc:String,renderOffer:()=>renders++,renderCal(){},renderGen(){}});
  ctx.addEventListener=(k,f)=>handlers[k]=f;
  vm.runInContext(leer('web/sate/cupos.js')+';globalThis.cupos=CUPOS',ctx);
  ctx.cupos.montar();await new Promise(ok=>setImmediate(ok));
  assert.match(nodo('#cupos-estado').textContent,/Última consulta:/);assert.equal(nodo('#cupos-omitir').checked,true);
  nube={...d,hora:new Date(t+2000).toISOString()};await handlers['ipnt-sincronizado']();
  assert.equal(JSON.parse(storage.get(prefix+'cupos')).hora,nube.hora);
  const guardada=nube.hora;nube=d;await handlers['ipnt-sincronizado']();assert.equal(JSON.parse(storage.get(prefix+'cupos')).hora,guardada);
  const grupo=ctx.selected()[0];assert.equal(ctx.cupos.excluir(grupo),true);assert.match(ctx.cupos.insignia(grupo),/Lleno/);
  t+=61*60000;ctx.cupos.pintar();assert.match(nodo('#cupos-estado').textContent,/Consulta antigua/);
  assert.equal(nodo('#cupos-omitir').checked,false);assert.equal(ctx.cupos.excluir(grupo),false);
  assert.match(nodo('#cupos-ayuda').textContent,/más de una hora/);
  assert.match(nodo('#cupos-omitir-ayuda').textContent,/más de una hora/);
  ctx.S.car='E';ctx.cupos.pintar();assert.equal(nodo('#cupos-estado').textContent,'Consultar cupos');assert.equal(nodo('#cupos-omitir').disabled,true);
  t-=61*60000;
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
  cur:()=>({B105:true}),optCupo:()=>({}),optExceso:()=>({}),generateBank:s=>s,CUPOS:{excluir:()=>true},txH:k=>k});
vm.runInContext(horarios.slice(horarios.indexOf('function generate('),horarios.indexOf('function generateBank(')),generador);
assert.equal(generador.generate()[0].opts.length,0);generador.CUPOS.excluir=()=>false;assert.equal(generador.generate()[0].opts.length,1);
generador.tr=()=>({want:[],oblig:[],done:[],curso:[]});assert.equal(generador.generate(['B105'])[0].opts.length,1);
// Panel real, sin navegador: solo el botón consulta, con un mínimo de 60 s.
let panelMessage,peticionesPanel=0,tiempo=Date.now(),intervalos=[];
const nodes=new Map(),node=k=>{if(!nodes.has(k))nodes.set(k,{value:'',innerHTML:'',style:{setProperty(){}}});return nodes.get(k)};
const panel={setAttribute(){},focus(){},addEventListener(){},querySelector:s=>node(s),style:{setProperty(){}},remove(){}};
const receptor={closed:false,postMessage(){}};
// DOM acotado a las filas del fixture para probar la tabla original y su restauración.
const rows=documento(fixture).querySelector('#ctl00_mainCopy_GrvOcupabilidad').querySelectorAll('tr');
const padre={appendChild(r){rows.splice(rows.indexOf(r),1);rows.push(r)}};
for(const r of rows){r.parentNode=padre;r.hidden=false;r.marcas=new Set();r.classList={toggle(k,on){on?r.marcas.add(k):r.marcas.delete(k)},remove:k=>r.marcas.delete(k)};
  for(const c of r.children){c.innerHTML=c.textContent;Object.defineProperty(c,'textContent',{get(){return String(this.innerHTML).replace(/<[^>]*>/g,'')},set(v){this.innerHTML=String(v)}})}}
const tabla={querySelectorAll:()=>rows};
const mc=vm.createContext({URL,URLSearchParams,Date:class extends Date{static now(){return tiempo}},console,
  location:{origin:new URL(url).origin,hostname:new URL(url).hostname},
  document:{getElementById:id=>id==='ctl00_mainCopy_GrvOcupabilidad'?tabla:null,querySelectorAll:()=>[],createElement:k=>k==='style'?{remove(){}}:panel,head:{appendChild(){}},body:{appendChild(){}},querySelector:()=>null},
  setInterval:f=>{intervalos.push(f);return 1},clearInterval(){},alert(){},DOMParser:class{parseFromString(s){return documento(s)}}});
mc.window=mc;mc.open=(u,n,o)=>{assert.match(u,/cupos.html\?unidad=upiita/);assert.equal(n,'sate-cupos');assert.equal(o,'width=420,height=560');return receptor};
mc.addEventListener=(k,f)=>panelMessage=f;mc.removeEventListener=()=>{};
mc.fetch=async(u,o)=>{peticionesPanel++;return {ok:true,url,text:async()=>fixture}};
vm.runInContext(fuente.replace("'__CUPOS_URL__'",JSON.stringify('https://sate.test/sate/cupos.html')).replace('__CUPOS_TEXTOS__',JSON.stringify(config.textos)),mc);
assert.equal(peticionesPanel,0);for(const f of intervalos)f();assert.equal(peticionesPanel,0);
node('[data-c="filtro"]').value='';node('[data-c="nivel"]').value='';
await node('[data-c="actualizar"]').onclick();assert.equal(peticionesPanel,3);
await node('[data-c="actualizar"]').onclick();assert.equal(peticionesPanel,3);assert.match(node('[data-c="estado"]').textContent,/60 s/);
tiempo+=60000;await node('[data-c="actualizar"]').onclick();assert.equal(peticionesPanel,6);
panelMessage({origin:'https://evil.test',source:receptor,data:{get tipo(){throw Error('origen ajeno')}}});
panelMessage({origin:'https://sate.test',source:receptor,data:{tipo:'ipnt.cupos.seleccion',v:1,grupos:seleccion,oferta}});
assert.match(node('[data-c="tabla"]').innerHTML,/Tu grupo/);assert.match(node('[data-c="tabla"]').innerHTML,/ipnt-cupo-barra/);
assert.match(node('[data-c="tarjetas"]').innerHTML,/Tu horario/);assert.match(node('[data-c="tarjetas"]').innerHTML,/Choca con tu horario/);
assert.match(node('[data-c="tabla"]').innerHTML,/1BM3/);assert.match(node('[data-c="tabla"]').innerHTML,/=/);
assert.equal(rows[1].children[0].textContent,'2BM1');assert.ok(rows[1].marcas.has('ipnt-elegido'));
assert.equal(rows[2].children[0].textContent,'1BM4');assert.match(rows[2].children[6].innerHTML,/Lleno.*Tu grupo.*ipnt-cupo-barra/);
node('[data-c="filtro"]').value='B205';node('[data-c="filtro"]').oninput();
assert.equal(rows.filter(r=>!r.hidden).length,2);
node('[data-c="cerrar"]').onclick();assert.equal(rows[1].children[0].textContent,'1BM3');assert.equal(rows[1].children[6].innerHTML,'39');
assert.ok(rows.every(r=>!r.hidden&&!r.marcas.size));
vm.runInContext(fuente.replace("'__CUPOS_URL__'",JSON.stringify('https://sate.test/sate/cupos.html')).replace('__CUPOS_TEXTOS__',JSON.stringify(config.textos)),mc);
await node('[data-c="actualizar"]').onclick();assert.equal(peticionesPanel,6);
assert.doesNotMatch(fuente,/data-c="auto"|reloj\(|consultar:actualizar/);
assert.doesNotMatch(fuente+leer('web/sate/cupos-receptor.js'),/postMessage\([^\n]*['"]\*['"]/);
for(const p of ['web/dist/cupos.js','web/dist/sate/cupos.js','web/dist/sate/cupos-receptor.js'])assert.doesNotThrow(()=>new Function(leer(p)));
assert.doesNotMatch(leer('web/dist/cupos.js'),/__CUPOS_URL__|__CUPOS_TEXTOS__/);
console.log('OK CUP2: WebForms, receptora, orígenes, difusión, Graph doble, antigüedad, tabla y tarjetas con choques');
