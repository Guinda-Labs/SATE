// CUP9: DOM y portapapeles en memoria. No abre navegadores ni consulta servicios.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const leer=p=>readFileSync(p,'utf8');
const config=JSON.parse(leer('web/dist/sate/index.html').match(/window.SATE_CONFIG=([\s\S]*?);<\/script>/)[1]);
class Nodo{
  constructor(tag){this.tag=tag;this.hijos=[];this.attrs={};this.style={cssText:'',setProperty(){}};this.textContent=''}
  setAttribute(k,v){this.attrs[k]=v}
  appendChild(n){n.padre=this;this.hijos.push(n);return n}
  replaceChildren(){this.hijos=[]}
  remove(){if(this.padre)this.padre.hijos=this.padre.hijos.filter(n=>n!==this)}
  focus(){this.enfocado=true}
  attachShadow(){return this.shadowRoot=new Nodo('shadow')}
  select(){this.seleccionado=true}
  querySelectorAll(s){const pred=n=>s==='button'?n.tag==='button':s==='h2'?n.tag==='h2':s==='legend'?n.tag==='legend':s.startsWith('#')?n.id===s.slice(1):n.attrs[s.match(/^\[([^=]+)/)?.[1]]===s.match(/="([^"]+)"/)?.[1];const out=[];for(const n of this.hijos){if(pred(n))out.push(n);out.push(...n.querySelectorAll(s))}return out}
  querySelector(s){return this.querySelectorAll(s)[0]||null}
  set innerHTML(html){
    this.html=html;this.hijos=[];
    // Solo el cascarón estático del componente. Los botones se crean con DOM real de producción.
    const pila=[this];
    for(const m of html.replace(/<style>[\s\S]*?<\/style>/g,'').matchAll(/<(\/?)([\w-]+)([^>]*)>/g)){
      if(m[1]){pila.pop();continue}
      const n=new Nodo(m[2]);for(const a of m[3].matchAll(/([\w-]+)="([^"]*)"/g)){n.setAttribute(a[1],a[2]);if(a[1]==='id')n.id=a[2]}
      n.hidden=/\bhidden\b/.test(m[3]);pila.at(-1).appendChild(n);pila.push(n);
    }
  }
  get innerHTML(){return this.html||''}
}
const body=new Nodo('body'),preferencias=new Map();let copiado,lecturas=0,montajes=0,cierres=0,modo='saes',abiertas=[];
const perfil={upiita_saes:1,unidad:'demo',boleta:'2099000001',nombre:'Alex Ejemplo Ficticio',promedio:8.5,avance:{obtenidos:120},acreditadas:[['B101',8,'26/1','ORD']]};
const c=vm.createContext({console,location:{hostname:'saes.demo.ipn.mx'},navigator:{clipboard:{async writeText(s){copiado=s}}},
  document:{body,createElement:tag=>new Nodo(tag),getElementById:id=>body.querySelector('#'+id),execCommand:()=>true},
  localStorage:{getItem:k=>preferencias.get(k),setItem:(k,v)=>preferencias.set(k,v)},matchMedia:()=>({matches:false})});
c.window=c;c.open=(...args)=>abiertas.push(args);
c.leerFicticio=()=>{lecturas++;c.IPNTSateResultado(c.perfil,'https://sate.invalid/','DEMO')};c.perfil=perfil;
c.montarFicticio=()=>{montajes++;assert.equal(c.IPNTSateContenedor,el('panel'));delete c.IPNTSateContenedor;c.IPNCuposCerrar=()=>{cierres++;delete c.IPNCuposCerrar};c.IPNCuposCambiarModo=m=>modo=m};
const fuente=leer('tools/sate_saes.js').replace('__CUPOS_TEXTOS__',JSON.stringify(config.textos)).replace('/*__SATE_LECTOR__*/','window.leerFicticio();').replace('/*__SATE_CUPOS__*/','window.montarFicticio();');
const box=()=>body.querySelector('#ipnt-sate').shadowRoot.querySelector('#ipnt-sate'),el=k=>box().querySelector('[data-s="'+k+'"]'),funciones=()=>el('funciones').hijos;
vm.runInContext(fuente,c);
assert.equal(body.hijos.length,1);assert.equal(lecturas,1);assert.equal(el('saludo').textContent,'Hola, Alex');
assert.equal(el('estado').textContent,'Boleta 2099000001 · tus datos del SAES están listos');
assert.deepEqual(funciones().map(n=>n.attrs['data-funcion']),['copiar','abrir','cupos']);
assert.doesNotMatch(box().innerHTML,/<table|Promedio|Créditos|ipnt-sate-menu/);
await funciones()[0].onclick();assert.equal(copiado,JSON.stringify(perfil));assert.deepEqual(JSON.parse(copiado),perfil);
assert.match(el('mensaje').textContent,/Copiado.*Ctrl\+V.*Pegar/);
funciones()[1].onclick();assert.equal(abiertas[0][0],'https://sate.invalid/');
funciones()[2].onclick();assert.equal(body.hijos.length,1);assert.equal(montajes,1);assert.equal(el('inicio').hidden,true);assert.equal(el('cupos').hidden,false);
el('modos').querySelectorAll('button')[1].onclick();assert.equal(modo,'ventana');assert.equal(preferencias.get('ipnt.cupos.modo'),'ventana');
el('volver').onclick();assert.equal(cierres,1);assert.equal(el('inicio').hidden,false);assert.equal(el('cupos').hidden,true);assert.equal(lecturas,1);
for(const nombre of ['', '   ']){c.perfil={...perfil,nombre};c.IPNTSate();assert.equal(body.hijos.length,1);assert.equal(el('saludo').textContent,'');assert.match(el('estado').textContent,/2099000001/)}
c.perfil=null;c.IPNTSate();assert.equal(el('saludo').textContent,'');assert.match(el('estado').textContent,/No se encontraron datos/);assert.deepEqual(funciones().map(n=>n.attrs['data-funcion']),['abrir','cupos']);
funciones()[0].onclick();assert.equal(abiertas.length,2);funciones()[1].onclick();el('volver').onclick();assert.equal(el('inicio').hidden,false);
c.IPNTSateAccion='cupos';vm.runInContext(fuente,c);assert.equal(body.hijos.length,1);assert.equal(el('cupos').hidden,false);
assert.match(leer('web/dist/cupos.js'),/IPNTSateAccion="cupos"/);assert.match(leer('web/dist/lector.js'),/IPNTSateAccion="lector"/);
box().onkeydown({key:'Escape'});assert.equal(body.hijos.length,0);
// Copia alternativa: el texto mantiene el mismo JSON y no confirma un fallo.
c.perfil=perfil;c.IPNTSate();c.navigator.clipboard.writeText=async()=>{throw Error('Portapapeles ficticio no disponible')};
let alternativo;c.document.execCommand=()=>{alternativo=box().hijos.at(-1).value;return true};await funciones()[0].onclick();assert.equal(alternativo,JSON.stringify(perfil));
c.document.execCommand=()=>false;await funciones()[0].onclick();assert.match(el('mensaje').textContent,/No se pudieron copiar/);
c.document.execCommand=()=>{throw Error('Copia alternativa ficticia bloqueada')};await funciones()[0].onclick();assert.match(el('mensaje').textContent,/No se pudieron copiar/);
assert.match(fuente,/repeat\(2,minmax\(0,1fr\)\)/);assert.match(fuente,/@media\(max-width:599px\)/);assert.match(fuente,/border-radius:12px/);assert.match(fuente,/prefers-color-scheme:dark/);
const revision=leer('web/qa-cupos-hoja.html');assert.match(revision,/Ventana del marcador/);assert.match(revision,/revision_sin_nombre/);assert.match(revision,/revision_sin_datos/);
console.log('CUP9: ventana única, saludo, funciones, cupos, vuelta, entradas compatibles y copia JSON verificados.');
