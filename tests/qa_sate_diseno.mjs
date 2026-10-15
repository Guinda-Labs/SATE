// Diseño §1–§3a: componentes y núcleo en memoria, sin navegador ni red.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=f=>readFileSync(f,'utf8');
const html=leer('web/dist/sate/index.html');
const config=JSON.parse(html.match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
assert.equal(config.textos['sate.pestana.horarios.titulo'],'Horarios de clase');
assert.equal(config.textos['sate.pestana.calendario.titulo'],'Calendario escolar');
assert.equal(config.textos['sate.pestana.horarios.corto'],'Horarios');
assert.equal(config.textos['sate.pestana.calendario.corto'],'Calendario');
assert.match(html,/<html lang="es" data-pestanas="v1">/);
const arranque=leer('web/sate/inicio.js').split('  let api, actual')[0]+'})();';
for(const [search,base,esperada] of [['','v3','v3'],['','v1','v1'],['?pestanas=v1','v3','v1'],['?pestanas=v3','v1','v3'],['?pestanas=v2','v3','v3']]){
  const attrs={'data-pestanas':base};
  vm.runInNewContext(arranque,{SATE_CONFIG:config,URLSearchParams,location:{search},document:{querySelector:()=>({setAttribute(k,v){attrs[k]=v}})}});
  assert.equal(attrs['data-pestanas'],esperada,`Variante ${search} desde ${base}`);
}
let document;
class Nodo{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.eventos={}}
  setAttribute(k,v){this.attrs[k]=String(v);if(k==='data-id')this.dataset.id=v}
  getAttribute(k){return this.attrs[k]??null}removeAttribute(k){delete this.attrs[k]}
  appendChild(n){this.children.push(n);return n}addEventListener(k,f){this.eventos[k]=f}
  focus(){document.activeElement=this}
}
document={createElement:tag=>new Nodo(tag),createTextNode:text=>({textContent:text}),getElementById(){return null},addEventListener(){}};
const c=vm.createContext({document,addEventListener(){}});vm.runInContext('window=globalThis',c);
vm.runInContext(leer('web/dist/sate/componentes.js'),c);
const items=config.unidades.upiita.pestanas.map(id=>({id,texto:config.textos['sate.pestana.'+id+'.titulo'],corto:config.textos['sate.pestana.'+id+'.corto'],grupo:config.unidades.upiita.grupos.findIndex(g=>g.includes(id))}));
let destino;
const tabs=c.SateUI.pestanas({items,activa:'trayectoria',alCambiar:id=>destino=id});
const barra=c.SateUI.barraInferior({items:items.map(it=>({...it,corto:null,texto:it.corto,titulo:it.texto})),activa:'trayectoria',alElegir:id=>destino=id});
for(const [i,b] of tabs.children.entries()){
  assert.equal(b.getAttribute('role'),'tab');assert.equal(b.getAttribute('type'),'button');
  assert.equal(b.getAttribute('data-id'),items[i].id);
  assert.equal(b.children[0].getAttribute('aria-hidden'),'true');
  assert.match(b.children[0].innerHTML,/<svg.*stroke="currentColor"/);
  assert.equal(b.children[1].textContent,items[i].texto);
  assert.equal(b.children[2].textContent,items[i].corto);
  assert.equal(b.getAttribute('aria-label'),items[i].texto);
  assert.equal(barra.children[i].getAttribute('aria-label'),items[i].texto);
  assert.match(barra.children[i].children[0].innerHTML,/<svg/);
}
assert.equal(tabs.children.filter(b=>b.className.includes('sate-grupo-inicio')).length,1);
assert.equal(barra.children.filter(b=>b.className.includes('sate-grupo-inicio')).length,1);
tabs.children[0].eventos.keydown({key:'End',preventDefault(){}});
assert.equal(destino,config.unidades.upiita.pestanas.at(-1));assert.equal(document.activeElement,tabs.children.at(-1));
tabs.children.at(-1).eventos.keydown({key:'ArrowRight',preventDefault(){}});
assert.equal(destino,'trayectoria');assert.equal(document.activeElement,tabs.children[0]);
tabs.children[0].eventos.keydown({key:'ArrowLeft',preventDefault(){}});
assert.equal(destino,config.unidades.upiita.pestanas.at(-1));assert.equal(document.activeElement,tabs.children.at(-1));
tabs.children.at(-1).eventos.keydown({key:'Home',preventDefault(){}});
assert.equal(destino,'trayectoria');assert.equal(document.activeElement,tabs.children[0]);
const mapa=tabs.children.find(b=>b.getAttribute('data-id')==='mapa');
mapa.eventos.click();assert.equal(destino,'mapa');
assert.equal(mapa.getAttribute('aria-selected'),'true');assert.equal(mapa.tabIndex,0);
const horarios=barra.children.find(b=>b.getAttribute('data-id')==='horarios');
horarios.eventos.click();assert.equal(destino,'horarios');
assert.equal(horarios.getAttribute('aria-current'),'page');
assert.deepEqual(config.unidades.upiita.tramites,['dictamen','electivas']);
for(const nav of [tabs,barra])assert.ok(nav.children.some(b=>b.getAttribute('data-id')==='tramites'));
vm.runInContext(leer('web/dist/sate/rutas.js'),c);
for(const hash of ['#/upiita/tramites','#/upiita/tramites/dictamen?origen=viejo']){
  const ruta=c.SateRutas.ruta(hash,'upiita',config.unidades);
  assert.equal(ruta.pestana,'tramites');
  assert.equal(ruta.hash,hash);
}
assert.equal(c.SateRutas.ruta('#/upiita/tramites/ets','upiita',config.unidades),null);
const css=leer('web/sate/componentes.css');
assert.match(css,/\[data-pestanas=v3\] \.sate-pestana__icono\{display:none/);
assert.match(css,/\[data-pestanas\] \.sate-barra \.sate-pestana__icono\{display:inline-flex/);
assert.match(css,/aria-selected=true\]::after.*background:var\(--sate-realce\)/);
assert.match(css,/\.sate-grupo-inicio::before.*width:1px/);
assert.match(css,/\.sate-pestana:focus-visible,\.sate-barra__btn:focus-visible,\.trayectoria-minimapa button:focus-visible/);
assert.ok(css.includes('.trayectoria-resumen{grid-column:1 / -1}'));   // resumen a todo el ancho
assert.ok(css.includes('.trayectoria-minimapa{grid-column:2;grid-row:2 / span 4;align-self:stretch'));   // minimapa a la derecha, misma altura que el contenido
assert.match(css,/@media\(max-width:639px\).*\.trayectoria-minimapa\{grid-column:1;grid-row:2/);
// Contraste de texto AA y de puntos/foco ≥3:1 con los tokens efectivos de ambos temas.
const fuente=leer('web/sate/cascaron.html');
const temas=[...fuente.matchAll(/(?:^:root|:root\[data-theme="dark"\]|:root:not\(\[data-theme="light"\]\))\{([^}]+)\}/gm)].map(m=>Object.fromEntries([...m[1].matchAll(/--([\w-]+):(#[\da-f]+);/g)].map(x=>[x[1],x[2]])));
assert.equal(temas.length,3);
for(const tema of temas)for(const [viejo,nuevo] of Object.entries({bg:'fondo',surface:'superficie',sunken:'hundido',fg:'texto',muted:'tenue',ok:'ok'}))tema[viejo]=tema['ipn-'+nuevo];
const lum=hex=>hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contraste=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
// El catálogo es la única fuente de color; superficies efectivas del cascarón y tokens comunes.
const catalogo=JSON.parse(leer('data/sate.json')).unidades;
for(const [id,cfg] of Object.entries(catalogo))cfg.realce=config.identidadUnidades[id].realce;
assert.equal(fuente.match(/--sate-acento-base:(#[\da-f]+);/)[1],'#750946','Guinda solo como respaldo sin unidad');
const tokens=leer('vendor/ipn-comun/dist/tokens.css');
// Toda la interfaz llega al realce por tokens; el respaldo guinda no puede formar un ciclo.
const declaraciones=s=>Object.fromEntries([...s.matchAll(/(--[\w-]+):\s*([^;\n}]+)/g)].map(m=>[m[1],m[2].trim()]));
const base=declaraciones(fuente.match(/^:root\{([^}]+)\}/m)[1]);
const puente=declaraciones(fuente.match(/:root,:root\[data-theme\],:root:not\(\[data-theme\]\)\{([^}]+)\}/)[1]);
assert.equal(base['--ipn-acento'],'var(--sate-realce)');
assert.equal(base['--ipn-sobre-acento'],'var(--sate-sobre-realce)');
assert.equal(puente['--accent'],'var(--ipn-acento)');
assert.equal(puente['--accent-fg'],'var(--ipn-sobre-acento)');
assert.equal(puente['--accent-strong'],'var(--ipn-acento-fuerte)');
assert.equal(puente['--accent-soft'],'var(--ipn-acento-suave)');
assert.equal(puente['--ipn-cal-academico'],'var(--sate-acento-base)','La categoría académica conserva su color');
assert.match(base['--ipn-acento-fuerte'],/color-mix.*var\(--sate-realce\)/);
assert.match(base['--ipn-acento-suave'],/color-mix.*var\(--sate-realce\)/);
// Pleca institucional, Opinar (componente común), pestaña, segmento, bandeja y botón principal.
assert.match(leer('tools/institucional.py'),/\.inst\{[^}]*border-bottom:3px solid var\(--sate-realce,var\(--accent\)\)/);
assert.match(leer('tools/encuesta.py'),/\.enc-btn svg\{[^}]*color:var\(--accent\)/);
assert.match(fuente,/\.seg button\[aria-pressed="true"\][^{]*\{background:var\(--ipn-acento-suave\);color:var\(--ipn-acento\)/);
assert.match(fuente,/\.plan-resumen span\{[^}]*border-left:4px solid var\(--ipn-acento\)/);
assert.match(fuente,/\.btn.primary\{[^}]*background:var\(--ipn-acento\)[^}]*color:var\(--ipn-sobre-acento\)/);
assert.match(css,/\.sate-pestana\[aria-selected=true\]\{color:var\(--ipn-acento\)/);
assert.match(css,/\.sate-btn--primario\{[^}]*color:var\(--sate-sobre-realce\)/);
assert.match(css,/\.tramite-chips \[aria-pressed=true\]\{[^}]*color:var\(--sate-sobre-realce\)/);
for(const regla of (fuente+css+leer('tools/institucional.py')+leer('tools/skins.py')).matchAll(/([^{}]+)\{([^{}]+)\}/g)){
  const sinRespaldo=regla[2].replace(/--sate-acento-base:#[\da-f]+;/gi,'');
  assert.ok(!/#(?:7a1f45|750946|ec9cbf|5b1237|f7c6db|f7eef2|2e1a24)\b|rgba\((?:117,9,70|236,156,191),/i.test(sinRespaldo),'Guinda fijo fuera del respaldo: '+regla[1]);
}
for(const [i,modo] of ['claro','oscuro'].entries()){
  const tema=temas[i];
  for(const [u,cfg] of Object.entries(catalogo)){
    const colores={...base,...puente,'--sate-realce':cfg.realce[modo]};
    const resolver=k=>colores[k].startsWith('var(')?resolver(colores[k].slice(4,-1)):colores[k];
    assert.equal(resolver('--accent'),cfg.realce[modo],'Los módulos inyectados conservan el realce por el alias');
    assert.equal(resolver('--ipn-acento'),cfg.realce[modo],`${u}/${modo}: botones, Opinar y navegación sin guinda`);
    // La selección con fondo suave conserva texto del realce, en vez del texto sobre fondo sólido.
    const rgb=h=>h.slice(1).match(/../g).map(v=>parseInt(v,16));
    const a=rgb(cfg.realce[modo]),s=rgb(tema.surface);
    const suave='#'+a.map((v,j)=>Math.round(v*.05+s[j]*.95).toString(16).padStart(2,'0')).join('');
    assert.ok(contraste(cfg.realce[modo],suave)>=4.5,`${u}/${modo}: segmento y chip sobre fondo suave`);
  }
  for(const fondo of ['bg','surface']){
    const token=fondo==='bg'?'fondo':'superficie';
    assert.ok(tokens.includes(`--ipn-${token}: ${tema[fondo]};`),'Superficie real compartida: '+token);
    for(const [u,cfg] of Object.entries(catalogo)){
      const ratio=contraste(cfg.realce[modo],tema[fondo]);
      assert.ok(ratio>=4.5,`${u}/${modo}/${token}: texto AA, contraste ${ratio}`);
      assert.ok(ratio>=3,`${u}/${modo}/${token}: elementos gráficos, contraste ${ratio}`);
    }
  }
}
// La exportación reutiliza el catálogo por tema, sin acentos guinda literales en el módulo.
const exportacion=leer('web/sate/exportacion.js');
const paleta=exportacion.slice(exportacion.indexOf('  const DK=EXP.dark'),exportacion.indexOf('  const ownFill='));
for(const [u,cfg] of Object.entries(catalogo))for(const [modo,dark] of [['claro',false],['oscuro',true]]){
  const acc=vm.runInNewContext(paleta+'\nACC',{EXP:{dark},SATE_CONFIG:config,UNIDAD:u,scheduleData:()=>({})});
  assert.equal(acc,cfg.realce[modo],`${u}/${modo}: acento exportado`);
}
// Ejecutar las funciones reales de realce y selector con DOM ficticio, sin red ni navegador.
{
  const inicio=leer('web/sate/inicio.js'), atributos={}, valores={}, botones=[], halos=[];
  let observador, cambioSistema, recargas=0;
  const raiz={getAttribute:k=>atributos[k]??null,style:{setProperty(k,v){valores[k]=v}}};
  const sistema={matches:false,addEventListener(k,f){assert.equal(k,'change');cambioSistema=f}};
  const c=vm.createContext({config:catalogo,SATE_CONFIG:config,u:null,inicial:null,recordada:null,URLSearchParams,
    location:{search:'',hash:'',reload(){recargas++}},document:{documentElement:raiz,querySelectorAll:()=>halos,createElement(tag){const n={dataset:{},style:{setProperty(k,v){this[k]=v}},prepend(){},appendChild(b){if(b.onclick)botones.push(b)}};if(tag==='span')halos.push(n);return n}},
    matchMedia:()=>sistema,MutationObserver:class{constructor(f){observador=f}observe(n,o){assert.equal(n,raiz);assert.equal(o.attributeFilter.join(','),'data-theme,data-tema')}},
    api:null,texto:k=>config.textos[k],SateUI:{modal(){},cerrarModal(){}}});
  vm.runInContext(inicio.slice(inicio.indexOf('  let unidadRealce'),inicio.indexOf('  // plurales ICU')),c);
  assert.equal(valores['--sate-realce'],'var(--sate-acento-base)','Sin unidad: guinda sin ciclo de tokens');
  assert.equal(valores['--sate-sobre-realce'],'var(--sate-sobre-base)');
  function comprobarSobre(u,modo){
    const color=valores['--sate-sobre-realce'],ratio=contraste(color,catalogo[u].realce[modo]);
    assert.ok(ratio>=4.5,`${u}/${modo}: ${color} sobre realce, AA ${ratio}`);
    assert.equal(color,modo==='claro'?'#ffffff':'#18181b');
  }
  const elegir=inicio.slice(inicio.indexOf('  function logoUnidad('),inicio.indexOf('  async function activar('));
  vm.runInContext(elegir+'\nelegirUnidad();',c);
  assert.equal(botones.length,1);assert.equal(botones[0].textContent,'Cambiar de unidad');
  botones[0].onclick();assert.equal(c.location.href,'index.html?sateEntrada=1');
  vm.runInContext('Object.keys(config).forEach(id=>logoUnidad(id,config[id].nombre));',c);
  function comprobarHalos(modo){for(const [i,u] of Object.keys(catalogo).entries())assert.equal(halos[i].style['--halo'],catalogo[u].realce[modo],u+': halo propio '+modo)}
  comprobarHalos('claro');
  for(const [i,u] of Object.keys(catalogo).entries()){
    c.aplicarRealce(u);assert.equal(valores['--sate-realce'],catalogo[u].realce.claro);
    comprobarSobre(u,'claro');
    atributos['data-theme']='dark';observador();assert.equal(valores['--sate-realce'],catalogo[u].realce.oscuro);
    comprobarHalos('oscuro');
    comprobarSobre(u,'oscuro');
    atributos['data-theme']='light';observador();assert.equal(valores['--sate-realce'],catalogo[u].realce.claro);
    comprobarSobre(u,'claro');
    delete atributos['data-theme'];atributos['data-tema']='oscuro';observador();assert.equal(valores['--sate-realce'],catalogo[u].realce.oscuro);
    comprobarSobre(u,'oscuro');
    atributos['data-tema']='claro';observador();assert.equal(valores['--sate-realce'],catalogo[u].realce.claro);
    comprobarSobre(u,'claro');
    delete atributos['data-tema'];sistema.matches=true;cambioSistema();assert.equal(valores['--sate-realce'],catalogo[u].realce.oscuro);
    comprobarSobre(u,'oscuro');
    sistema.matches=false;cambioSistema();assert.equal(valores['--sate-realce'],catalogo[u].realce.claro);
    comprobarHalos('claro');
    comprobarSobre(u,'claro');
  }
  assert.equal(recargas,0,'El cambio vuelve a la entrada mediante navegación');
  c.aplicarRealce(null);atributos['data-theme']='dark';observador();assert.equal(valores['--sate-realce'],'var(--sate-acento-base)');
  assert.equal(valores['--sate-sobre-realce'],'var(--sate-sobre-base)');
  assert.match(css,/\.sate-unidad\{color:var\(--sate-realce\)\}/);
  assert.match(css,/header\.top\{[^}]*border-top:0/);
  assert.match(css,/\.sate-barra__btn\[aria-current=page\]::after\{[^}]*background:var\(--sate-realce\)/);
  console.log('Realce: AA por unidad/superficie/tema, regreso a la entrada, guinda sin unidad y cambios de tema/sistema. OK.');
}
for(const tema of temas)for(const fondo of ['surface','sunken']){
  tema.accent=tema['sate-acento-base'];
  for(const frente of ['fg','muted','accent'])assert.ok(contraste(tema[frente],tema[fondo])>=4.5,`${frente}/${fondo}: AA`);
  for(const frente of ['ok','accent','muted','ipn-reprobada','ipn-desfasada'])assert.ok(contraste(tema[frente],tema[fondo])>=3,`${frente}/${fondo}: puntos y foco`);
}
const nucleo=leer('web/sate/nucleo.js');
const funcion=nucleo.slice(nucleo.indexOf('function minimapaCurricular('),nucleo.indexOf('// modo personal: materias'));
const estados=['done','curso','rest lock','fail','late fail','late'];
const L={w:300,h:60,boxes:estados.map((st,i)=>[i*40,0,30,40,String(i)]).concat([[240,0,30,40,null,'Optativa']]),edges:[],rows:[[1,20]],pitch:60};
let personal=true;
const ctx=vm.createContext({MAP:()=>({layout:L}),isPersonal:()=>personal,slotFill:()=>new Map(),rowBands:()=>[[1,20,0,60]],statusOf:k=>estados[+k],isElec:()=>false,esc:s=>s,
  cur:()=>({'0':['Materia',0,1,'O'],'1':['Otra',0,2,'O']}),SATE:{texto:(k,v)=>config.textos[k].replace(/\{n, plural, one \{([^{}]*)\} other \{([^{}]*)\}\}/,(m,uno,otros)=>(v.n===1?uno:otros).replaceAll('#',String(v.n))).replace('{n}',v.n)}});
ctx.document={addEventListener(){}};ctx.addEventListener=()=>{};
vm.runInContext(leer('web/sate/componentes.js'),ctx);
vm.runInContext(funcion,ctx);
const mini=ctx.minimapaCurricular();
assert.deepEqual(JSON.parse(JSON.stringify(mini.cnt)),{done:1,curso:1,pend:2,fail:1,late:2});
assert.equal((mini.svg.match(/data-estado="late"/g)||[]).length,2,'Desfase tiene prioridad sobre reprobación');
assert.match(mini.svg,/data-estado="fail"[^>]+fill="var\(--ipn-reprobada\)"/);
assert.match(mini.svg,/data-estado="curso"[^>]+fill="var\(--sate-realce\)"/);
assert.match(mini.svg,/data-estado="late"[^>]+fill="var\(--ipn-desfasada\)"/);
assert.match(mini.leyenda,/2 desfasadas/);
assert.match(ctx.minimapaCurricular(null).svg,/<circle/,'También hay minimapa sin trazado PDF');
personal=false;assert.equal(ctx.minimapaCurricular(),null);
assert.ok(!leer('web/sate/mapa.js').includes('function slotFill('),'Optativas se resuelven una sola vez en núcleo');
assert.ok(!leer('web/sate/mapa.js').includes('<circle'),'Mapa reutiliza los puntos del núcleo');
// Horarios: oferta ficticia, controles y persistencia sin navegador ni red.
const hor=leer('web/sate/horarios.js'), shell=leer('web/sate/cascaron.html');
const extra=shell.match(/<details id="f-more">([\s\S]*?)<\/details>/)[1];
for(const id of ['f-hide','f-fit','g-from','g-to','g-avoid','f-done','b-reset'])assert.ok(extra.includes('id="'+id+'"'),id+' dentro de Más filtros');
for(const id of ['f-q','f-turno','f-nivel','f-want'])assert.ok(!extra.includes('id="'+id+'"'),id+' visible');
assert.match(nucleo,/hideDone:store.get\('hideDone',true\)/);
assert.ok(nucleo.includes('IPNT.set(HU+k,JSON.stringify(v))'));
const controles=new Map(), guardado=new Map();
const control=id=>{if(!controles.has(id))controles.set(id,{textContent:'',open:false,addEventListener(tipo,fn){this[tipo]=fn}});return controles.get(id)};
let personalHor=true;
const estado={car:'B',tur:'*',niv:'*',q:'',chips:[],hide:false,hideDone:true,fit:false,gap:null,onlyWant:false,gavoid:[]};
const trayectoria={done:['A'],want:['B']}, oferta=['A','B','C','D'].map((k,i)=>['B','M',1,'DEMO'+i,i,[],[[0,480,540]],4.5,k]);
const traduccion=(k,v={})=>(config.textos[k]||k).replace(/\{(\w+)\}/g,(_,k)=>v[k]??'{'+k+'}');
const hc=vm.createContext({S:estado,GT:{a:'',b:''},$:control,SATE:{texto:traduccion},store:{set:(k,v)=>guardado.set(k,v)},norm:s=>s.toLowerCase(),
  ws:()=>({marks:{}}),tr:()=>trayectoria,plan:()=>({sel:[]}),selected:()=>[],ownAsClasses:()=>[],classes:()=>oferta,
  isPersonal:()=>personalHor,keyOf:c=>c[8],outWin:()=>false,isExcl:()=>false,overlaps:()=>false,name:c=>c[8],profs:()=>'',
  cur:()=>({A:[],B:[],C:[],D:[]}),statusOf:k=>({A:'done',B:'rest',C:'fail',D:'late'}[k]),renderOffer(){}});
vm.runInContext(hor.slice(0,hor.indexOf("$('#offer').addEventListener"))+
  hor.slice(hor.indexOf('function base()'),hor.indexOf('function suggest('))+
  hor.slice(hor.indexOf('function renderMasFiltros()'),hor.indexOf('/* Salones'))+
  hor.match(/const prio=k=>[^\n]+/)[0],hc);
assert.deepEqual(Array.from(hc.filtered(),c=>c[8]),['B','C','D'],'Acreditada oculta por omisión');
estado.hideDone=false;assert.equal(hc.filtered().length,4,'Se pueden consultar las acreditadas');
estado.hideDone=true;personalHor=false;assert.equal(hc.filtered().length,4,'Sin SAES no se ocultan materias');
personalHor=true;estado.onlyWant=true;assert.deepEqual(Array.from(hc.filtered(),c=>c[8]),['B']);estado.onlyWant=false;
assert.deepEqual(vm.runInContext("['A','B','C','D'].map(prio)",hc).join(','),'2,0,1,1','Elegidas, adeudos/desfase, resto');
hc.renderMasFiltros();assert.equal(control('#f-more-title').textContent,'Más filtros (1)');assert.equal(control('#f-more').open,true);
estado.hide=true;hc.renderMasFiltros();assert.equal(control('#f-more-title').textContent,'Más filtros (2)');
estado.hide=false;estado.hideDone=false;control('#f-more').open=false;hc.renderMasFiltros();assert.equal(control('#f-more-title').textContent,'Más filtros');assert.equal(control('#f-more').open,false);
vm.runInContext(hor.match(/\$\('#f-done'\)\.addEventListener[^\n]+/)[0],hc);
control('#f-done').change({target:{checked:true}});assert.equal(guardado.get('hideDone'),true);
control('#f-done').change({target:{checked:false}});assert.equal(guardado.get('hideDone'),false);
for(const clave of [...hor.matchAll(/txH\('([^']+)'/g)].map(m=>m[1]))assert.ok(config.textos['sate.horarios.'+clave],clave+' existe en catálogo');
for(const clave of ['recursar','acreditada','semestre','disponible','curso','desfasada','desfasada_dictamen','desfasada_recursar','generador_vacio','oferta_sin_resultados','profesor_excluido_ayuda','nota_placeholder','solo_opcion']){
  const t=config.textos['sate.horarios.'+clave];assert.ok(t);
  const codigo=hor.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
  assert.ok(!codigo.includes('>'+t+'<'),'Texto visible solo en catálogo: '+clave);
  if(t.includes(' '))assert.ok(!codigo.includes("'"+t+"'"),'Literal solo en catálogo: '+clave);
}
assert.ok(!hor.includes('Mi trayectoria'));
const sinComentarios=hor.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'');
assert.ok(!/aria-label="[A-Za-zÁÉÍÓÚáéíóúñ]/.test(sinComentarios),'Etiquetas accesibles también usan claves');
assert.ok(!/<(?:span|small|p|b|i|button)(?:\s+[\w-]+="[^"]*")*\s*>[A-Za-zÁÉÍÓÚáéíóúñ]/.test(sinComentarios),'Sin texto visible fijo entre etiquetas');
assert.match(hor,/SateUI.ayuda\('sate.horarios.carga_ayuda'/);
const carga=hor.slice(hor.indexOf('  const failS=new Set(tr().fail), ci=cargaInfo(sel.filter'),hor.indexOf("  $('#sel').hidden"));
let ayuda;
hc.SateUI={ayuda:(k,v)=>(ayuda={k,v})};hc.esc=s=>s;hc.fmtCr=String;hc.sel=[];trayectoria.fail=[];
hc.cargaInfo=()=>({L:{min:27,media:40,max:80},ret:4.5,nuevos:0,total:4.5,tope:45,libre:40.5,faltaMin:22.5,aut:45});
control('#load .load-note').appendChild=n=>n;
vm.runInContext(carga,hc);
assert.match(control('#load').innerHTML,/4.5 de 45 créditos · te faltan 22.5 para la carga mínima/);
assert.ok(!control('#load').innerHTML.includes('retenidos por reprobadas'));
assert.equal(ayuda.k,'sate.horarios.carga_ayuda');assert.equal(ayuda.v.ret,'4.5');
console.log('Horarios: filtros agrupados, acreditadas, preferencia recordada, prioridad, carga y textos por clave. OK.');
console.log('Diseño §1–§3a: nombres, variantes/URL, SVG, grupos, teclado, barra móvil, foco, contraste AA y cinco estados compartidos. OK.');

// Una pleca institucional, transparente en ambos temas y ligada al realce de cada unidad.
const institucional=leer('tools/institucional.py').match(/\.inst\{([^}]+)\}/)[1];
assert.match(institucional,/background:transparent/);assert.match(institucional,/border-radius:0/);
assert.equal((institucional.match(/border-bottom:/g)||[]).length,1);
assert.match(institucional,/border:0;border-radius:0;border-bottom:3px solid var\(--sate-realce,var\(--accent\)\)/);
assert.match(css,/header\.top\{border-bottom:0;border-top:0/);
assert.match(css,/\.tramite-acciones\{justify-content:flex-end\}/);
assert.match(css,/\.tramite-campo input:not\(\[type=checkbox\]\),\.tramite-campo select\{min-height:2\.25rem/);
