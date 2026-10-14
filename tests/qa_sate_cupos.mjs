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
let ahora=0,oculta=false,consultas=0,fin=0;
const reloj=C.reloj({ahora:()=>ahora,oculta:()=>oculta,consultar:()=>consultas++,fin:()=>fin++});
reloj.activar();ahora=59999;reloj.tick();assert.equal(consultas,0);ahora=60000;reloj.tick();assert.equal(consultas,1);
ahora=119999;reloj.tick();assert.equal(consultas,1);oculta=true;ahora=180000;reloj.tick();assert.equal(consultas,1);
oculta=false;reloj.tick();assert.equal(consultas,2);reloj.tick();assert.equal(consultas,2);
ahora=1800000;oculta=true;reloj.tick();assert.equal(fin,1);ahora+=60000;oculta=false;reloj.tick();assert.equal(consultas,2);
reloj.activar();ahora+=60000;reloj.tick();assert.equal(consultas,3);reloj.desactivar();ahora+=60000;reloj.tick();assert.equal(consultas,3);
const url='https://www.saes.upiita.ipn.mx/Academica/Ocupabilidad_grupos.aspx',peticiones=[];
function conSeleccion(carrera,plan){return fixture.replace('value="B" selected','value="B"'+(carrera==='B'?' selected':'')).replace('value="E">','value="E"'+(carrera==='E'?' selected':'')+'>').replace('value="09" selected','value="09"'+(plan==='09'?' selected':'')).replace('value="98">','value="98"'+(plan==='98'?' selected':'')+'>')}
let car='B',pl='09';
const pedir=async(u,o)=>{assert.equal(u,url);peticiones.push(o);if(o.body){const b=new URLSearchParams(o.body);assert.equal(b.get('ctl00$mainCopy$rblEsquema'),'1');assert.equal(b.get('__VIEWSTATE'),'estado-ficticio');assert.equal(b.get('__EVENTVALIDATION'),'validacion-ficticia');const target=b.get('__EVENTTARGET');if(target.endsWith('dpdcarrera'))car=b.get(target);if(target.endsWith('dpdplan'))pl=b.get(target)}return {ok:true,url,text:async()=>conSeleccion(car,pl)}};
const r=await C.consultar({fetch:pedir,parser:documento,url,carrera:'E',plan:'98',opciones(){}});
assert.equal(r.carrera,'E');assert.equal(r.plan,'98');assert.deepEqual(peticiones.map(p=>p.method),['GET','POST','POST']);
assert.ok(peticiones.every(p=>p.credentials==='same-origin'&&p.cache==='no-store'&&p.redirect==='manual'));
await C.consultar({fetch:pedir,parser:documento,url,carrera:'E',plan:'98',opciones(){}});assert.equal(peticiones.at(-1).method,'GET');
await assert.rejects(C.consultar({fetch:async()=>({ok:true,url:'https://www.saes.upiita.ipn.mx/Login.aspx',text:async()=>fixture}),parser:documento,url,opciones(){}}),/sesion/);
await assert.rejects(C.consultar({fetch:async()=>({type:'opaqueredirect',status:0}),parser:documento,url,opciones(){}}),/sesion/);
await assert.rejects(C.consultar({fetch:pedir,parser:documento,url,carrera:'E',plan:'invalido',opciones(){}}),/plan/);
await assert.rejects(C.consultar({fetch:async()=>({ok:true,url,text:async()=>'<input type="password" name="clave">'}),parser:documento,url,opciones(){}}),/sesion/);
let periodoLlamadas=0;
await C.consultar({fetch:async(u,o)=>{periodoLlamadas++;if(o.body)assert.equal(new URLSearchParams(o.body).get('__EVENTTARGET'),'ctl00$mainCopy$rblEsquema');return {ok:true,url,text:async()=>periodoLlamadas===1?fixture.replace('value="1" checked','value="1"').replace('value="3">','value="3" checked>'):fixture}},parser:documento,url,opciones(){}});
assert.equal(periodoLlamadas,2);
let filtroLlamadas=0;
await C.consultar({fetch:async(u,o)=>{filtroLlamadas++;if(o.body)assert.equal(new URLSearchParams(o.body).has('ctl00$mainCopy$Chkgrupo'),false);return {ok:true,url,text:async()=>filtroLlamadas===1?fixture.replace('<form>','<form><input type="checkbox" name="ctl00$mainCopy$Chkgrupo" value="on" checked>'):fixture}},parser:documento,url,opciones(){}});
assert.equal(filtroLlamadas,2);
// Receptor real en cada unidad: origen, ventana, unidad, contexto, sessionStorage e insignias.
const config=JSON.parse(leer('web/dist/sate/index.html').match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
const horarios=leer('web/sate/horarios.js');
for(const unidad of ['upiita','escom','upibi']){
  let t=Date.now(),onmessage,escrituras=0,pintados=0;const enviados=[],nodos=new Map();
  const nodo=id=>{if(!nodos.has(id))nodos.set(id,{checked:false,disabled:true,textContent:''});return nodos.get(id)};
  const opener={postMessage:(d,o)=>enviados.push({d,o})};
  const storage=new Map(),grupo=['B','M',1,'1BM4',0,[],[[0,540,600]],4,'B105'];
  const ctx=vm.createContext({URL,URLSearchParams,Date:class extends Date{static now(){return t}},UNIDAD:unidad,HU:unidad==='upiita'?'hu.':'hu.'+unidad+'.',DATA:{opciones_plan:{B:{carrera:'B',plan:'09'}}},S:{car:'B',gen:null},SATE_CONFIG:config,
    SATE:{texto:(k,v={})=>(config.textos[k]||k).replace(/\{(\w+)\}/g,(_,n)=>v[n]??'')},
    document:{referrer:'',hidden:false},sessionStorage:{getItem:k=>storage.get(k),setItem(k,v){storage.set(k,v);escrituras++}},
    setInterval(){},selected:()=>[grupo],$:nodo,esc:String,renderOffer:()=>pintados++,renderCal(){},renderGen(){},console});
  ctx.window=ctx;ctx.opener=opener;ctx.addEventListener=(k,f)=>{if(k==='message')onmessage=f};
  vm.runInContext(fuente.split('/*__CUPOS_PANEL__*/')[0]+leer('web/sate/cupos.js')+';globalThis.cupos=CUPOS',ctx);
  const payload={tipo:'ipnt.cupos.datos',v:1,unidad,carrera:'B',plan:'09',hora:new Date(t).toISOString(),filas};
  const origin=new URL(config.unidades[unidad].saes).origin;
  onmessage({origin:'https://evil.test',source:opener,data:payload});assert.equal(escrituras,0);
  onmessage({origin,source:{},data:payload});assert.equal(escrituras,0);
  onmessage({origin,source:opener,data:{...payload,unidad:'otra'}});assert.equal(escrituras,0);
  onmessage({origin,source:opener,data:{...payload,filas:[{...filas[0],cupo:-1}]}});assert.equal(escrituras,0);
  onmessage({origin,source:opener,data:payload});assert.equal(escrituras,1);assert.equal(pintados,1);
  assert.ok(storage.has(ctx.HU+'cupos'));assert.ok(enviados.every(e=>e.o===origin));assert.equal(enviados[0].d.tipo,'ipnt.cupos.seleccion');
  ctx.cupos.montar();assert.match(ctx.cupos.insignia(grupo),/Lleno/);assert.equal(nodo('#cupos-omitir').disabled,false);
  nodo('#cupos-omitir').checked=true;nodo('#cupos-omitir').onchange();assert.ok(ctx.cupos.excluir(grupo));
  assert.match(ctx.cupos.insignia([...grupo.slice(0,3),'1BM3',...grupo.slice(4)]),/39 lugares/);
  t+=600001;ctx.cupos.pintar();assert.match(ctx.cupos.insignia(grupo),/cupos-vieja.*sin actualizar/);assert.equal(nodo('#cupos-omitir').disabled,true);assert.equal(ctx.cupos.excluir(grupo),false);
  ctx.S.car='E';assert.equal(ctx.cupos.insignia(grupo),'');
  ctx.S.car='B';onmessage({origin,source:opener,data:{...payload,plan:'98'}});assert.equal(ctx.cupos.insignia(grupo),'');assert.equal(nodo('#cupos-omitir').disabled,true);
  // Generador real: el filtro también opera sobre las obligatorias y todas las elegidas.
  const gc=vm.createContext({S:{car:'B',chips:[],onlyWant:true,gpref:[],gavoid:[],gt:'*'},GT:{src:'todo',n:'auto',a:'',b:''},
    classes:()=>[grupo],tr:()=>({want:['B105'],oblig:['B105'],done:[],curso:[]}),ws:()=>({marks:{}}),norm:String,ownAsClasses:()=>[],keyOf:g=>g[3],DATA:{prof:[]},tmin:()=>null,overlaps:()=>false,
    cur:()=>({B105:true}),optCupo:()=>({}),optExceso:()=>({}),generateBank:s=>s,CUPOS:{excluir:()=>true},txH:k=>k});
  vm.runInContext(horarios.slice(horarios.indexOf('function generate()'),horarios.indexOf('function generateBank(')),gc);
  assert.equal(gc.generate()[0].opts.length,0);
  gc.CUPOS.excluir=()=>false;assert.equal(gc.generate()[0].opts.length,1);
}
// Panel real: mensajes de otro origen se ignoran antes de interpretar la selección.
let panelMessage;const nodes=new Map();const node=k=>{if(!nodes.has(k))nodes.set(k,{value:'',innerHTML:'',checked:false});return nodes.get(k)};
const panel={setAttribute(){},focus(){},addEventListener(){},querySelector:s=>node(s),remove(){}};
const winSate={closed:false,postMessage(){},focus(){}};
const mc=vm.createContext({URL,URLSearchParams,Date,console,location:{origin:new URL(url).origin,hostname:new URL(url).hostname},document:{getElementById:()=>null,createElement:()=>panel,body:{appendChild(){}},querySelector:()=>null},setInterval:()=>1,clearInterval(){},alert(){}});
mc.window=mc;mc.fetch=()=>{throw Error('red prohibida en esta prueba')};mc.open=()=>winSate;mc.addEventListener=(k,f)=>{panelMessage=f};mc.removeEventListener=()=>{};
vm.runInContext(fuente.replace("'__CUPOS_URL__'",JSON.stringify('https://silver-vs.github.io/upiita/sate/index.html')).replace('__CUPOS_TEXTOS__',JSON.stringify(config.textos)),mc);
node('[data-c="sate"]').onclick();
const venenoso={tipo:'ipnt.cupos.seleccion',v:1,get grupos(){throw Error('no debe leer mensajes ajenos')}};
assert.doesNotThrow(()=>panelMessage({origin:'https://evil.test',source:winSate,data:venenoso}));
assert.doesNotThrow(()=>panelMessage({origin:'https://silver-vs.github.io',source:{},data:venenoso}));
let consultasPanel=0;
mc.DOMParser=class{parseFromString(s){return documento(s)}};
mc.fetch=async(u,o)=>{consultasPanel++;assert.equal(u,url);assert.equal(o.method,'GET');return {ok:true,url,text:async()=>fixture}};
await node('[data-c="actualizar"]').onclick();await node('[data-c="actualizar"]').onclick();assert.equal(consultasPanel,2);
assert.match(node('[data-c="tabla"]').innerHTML,/1BM3/);
panelMessage({origin:'https://silver-vs.github.io',source:winSate,data:{tipo:'ipnt.cupos.seleccion',v:1,grupos:[{grupo:'1BM4',materia:'B105'}]}});
assert.match(node('[data-c="tabla"]').innerHTML,/1BM4/);assert.doesNotMatch(node('[data-c="tabla"]').innerHTML,/1BM3/);
assert.match(horarios,/CUPOS.insignia\(c\)/);assert.match(horarios,/CUPOS.insignia\(b.c\)/);
assert.doesNotMatch(fuente+leer('web/sate/cupos.js'),/postMessage\([^\n]*['"]\*['"]/);
assert.doesNotThrow(()=>new Function(leer('web/dist/cupos.js')));
assert.doesNotMatch(leer('web/dist/cupos.js'),/__CUPOS_URL__|__CUPOS_TEXTOS__/);
console.log('OK Cupos: fixture, WebForms GET/POST, orígenes y ventanas, reloj, sesión, insignias y generador en tres unidades');
