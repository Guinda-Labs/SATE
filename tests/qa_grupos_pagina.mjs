// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script, runInNewContext} from 'node:vm';
const require = createRequire(import.meta.url);
const {normalizarURL, proximaVerificacion, mezclar, normalizarBusqueda, filtrar, leerHash, escribirHash} = require('../web/sate/grupos.js');
const {horario} = JSON.parse(readFileSync(new URL('../data/grupos.json', import.meta.url), 'utf8'));
const url = 'https://chat.whatsapp.com/Ab12345678901234567890';
for (const longitud of [20, 24]) assert.equal(normalizarURL('https://chat.whatsapp.com/' + 'a'.repeat(longitud)), 'https://chat.whatsapp.com/' + 'a'.repeat(longitud));
assert.equal(normalizarURL(`  ${url}?mode=share#x `), url);
assert.equal(normalizarURL(url.replace('/Ab', '/invite/Ab')), url.replace('/Ab', '/invite/Ab'));
for (const invalida of ['', 'http://chat.whatsapp.com/Ab12345678901234567890', url + 'AAAAA', url.slice(0,-4), url.replace('chat.whatsapp.com','chat.whatsapp.com.ejemplo.org'), url + '/extra', 'javascript:alert(1)', url.replace('https://','https://usuario@')]) assert.equal(normalizarURL(invalida), null, invalida);
for (const [ahora, siguiente] of [
  ['2026-10-17T10:01:00Z','2026-10-17T10:05:00Z'],
  ['2026-10-17T10:05:00Z','2026-10-17T10:10:00Z'],
  ['2026-10-19T05:59:00Z','2026-10-19T06:00:00Z'],
  ['2026-10-19T06:00:00Z','2026-10-19T07:00:00Z'],
  ['2026-10-25T20:01:00Z','2026-10-25T21:00:00Z'],
  ['2026-10-26T05:59:00Z','2026-10-26T12:00:00Z'],
  ['2026-10-26T06:00:00Z','2026-10-26T12:00:00Z'],
  ['2026-10-26T12:00:00Z','2026-10-27T12:00:00Z'],
  ['2027-01-01T00:00:00Z','2027-01-01T12:00:00Z']
]) assert.equal(proximaVerificacion(horario, new Date(ahora)).toISOString(), new Date(siguiente).toISOString(), ahora);
const dato = {url, desde:'2026-10-17T10:00:00Z', reemplazo:null};
const local = {a:{guardado:1000, enlace:dato}};
assert.equal(mezclar({},local,2000).enlaces.a.url,url);
assert.deepEqual(mezclar({a:dato},local,2000).pendientes,{});
assert.deepEqual(mezclar({},local,86401000).enlaces,{});
assert.deepEqual(mezclar({a:{...dato,desde:'2026-10-17T11:00:00Z'}},local,2000).pendientes,{});
const casillas = [
  {id:'a', carrera:'M', nivel:3, turno:'M', grupo:'3MM1', materia:'CÁLCULO VECTORIAL'},
  {id:'b', carrera:'M', nivel:3, turno:'M', grupo:'3MM1', materia:'ÉTICA'},
  {id:'c', carrera:'B', nivel:3, turno:'V', grupo:'3BV1', materia:'Cálculo diferencial'},
  {id:'d', carrera:'M', nivel:4, turno:'V', grupo:'4MV1', materia:'Ética'},
  {id:'e', carrera:'M', nivel:3, turno:'X', grupo:'3MX1', materia:'Cálculo integral'}
];
const ids = f => filtrar(casillas, {a:dato}, {...leerHash(''), ...f}).map(c => c.id);
assert.equal(normalizarBusqueda('  ÉTICA  '), 'etica');
assert.deepEqual(ids({q:'calculo'}), ['a','c','e']);
assert.deepEqual(ids({q:'ÉtiCA'}), ['b','d']);
assert.deepEqual(ids({q:'3mm1'}), ['a','b']);
assert.deepEqual(ids({c:'M', s:'3', t:'M'}), ['a','b']);
assert.deepEqual(ids({c:'M', s:'3', t:'M', sin:true}), ['b']);
assert.deepEqual(ids({sin:true, q:'calculo'}), ['c','e']);
assert.deepEqual(ids({c:'M', s:'3', t:'X', q:'cálculo'}), ['e']);
assert.deepEqual(ids({c:'B', s:'4'}), []);
assert.deepEqual(ids({sin:true}), ['b','c','d','e']);
const filtros = {...leerHash(''), c:'M',s:'3',t:'M',q:'cálculo & ética',sin:true,g:'3MM1'};
assert.deepEqual(leerHash(escribirHash(filtros)), filtros);
assert.equal(escribirHash(leerHash('')), '');
assert.equal(escribirHash({g:'3MM1'}), '#g=3MM1');
assert.equal(escribirHash({c:'M',s:'3',t:'M',q:'calculo'}), '#c=M&s=3&t=M&q=calculo');
assert.equal(leerHash('#g=3mm1').g, '3MM1');
assert.deepEqual(leerHash('#s=99&t=invalido&sin=0&desconocido=1'), leerHash(''));
assert.deepEqual(leerHash('#q=%C3%89tica+profesional').q, 'Ética profesional');
const pagina = readFileSync(new URL('../web/dist/sate/grupos/index.html', import.meta.url), 'utf8');
for (const bloque of pagina.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new Script(bloque[1]);

// Integración sin navegador ni red: eventos, render, persistencia y contrato de escritura.
class Nodo {
  constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.dataset = {}; this.events = {}; this.value = ''; this.hidden = false; this.className = ''; this.checked = false; }
  set textContent(v) { this.children = []; this.texto = String(v); }
  get textContent() { return (this.texto || '') + this.children.map(c => c.textContent).join(''); }
  append(...nodos) { for (const n of nodos) { n.parent = this; this.children.push(n); } }
  prepend(n) { n.parent = this; this.children.unshift(n); }
  replaceChildren(...n) { this.texto = ''; this.children = []; this.append(...n); }
  setAttribute(k,v) { this.attributes[k] = String(v); }
  addEventListener(k,v) { (this.events[k] ||= []).push(v); }
  async emitir(k) { for (const f of this.events[k] || []) await f({preventDefault() {}, key:''}); }
  querySelectorAll(selector) {
    const [tag, clase] = selector.split('.');
    return this.children.flatMap(c => [...((!tag || c.tagName === tag) && (!clase || c.className.split(' ').includes(clase)) ? [c] : []), ...c.querySelectorAll(selector)]);
  }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  remove() { this.parent.children = this.parent.children.filter(c => c !== this); }
  focus() { this.enfocado = true; }
  get classList() { return {add: c => { this.className += ' ' + c; }, remove: c => { this.className = this.className.split(' ').filter(v => v !== c).join(' '); }}; }
}
const fuente = readFileSync(new URL('../web/sate/grupos.js', import.meta.url), 'utf8');
async function iniciarDOM({hash = '', ruta = '/sate/grupos/', sinAlmacenamiento = false, fallaConsulta = false} = {}) {
  const nodos = Object.fromEntries(['carrera','buscar','semestre','turno','sin','lista','mensaje','prueba','estado','proxima','global','resultados','limpiar'].map(id => [id, new Nodo('div')]));
  nodos.estado.append(new Nodo('summary'));
  const config = {periodo:'DEMO', zona:'America/Mexico_City', horario, endpoint:'https://script.google.com/demo', motivos:['caido','lleno','equivocado','otro'], enlaces:'/enlaces.json', enlaces_prueba:'/enlaces-prueba.json'};
  const oferta = {casillas, carreras:{M:'Mecatrónica',B:'Biónica'}};
  const datos = {}; runInNewContext(pagina.match(/<script>window.GRUPOS=([\s\S]*?);<\/script>/)[0].replace(/<\/?script>/g,''), {window:datos});
  const guardado = new Map(), solicitudes = [], copias = [], eventos = {}, temporales = [];
  const location = {pathname:ruta, search:'', hash, href:'https://ejemplo.test' + ruta + hash};
  const contexto = {GRUPOS:datos.GRUPOS, URL, URLSearchParams, Intl, Date, AbortSignal,
    document:{createElement: t => new Nodo(t), createElementNS: (_,t) => new Nodo(t), getElementById: id => nodos[id]},
    location, history:{replaceState(_, __, valor) { location.hash = valor.includes('#') ? '#' + valor.split('#')[1] : ''; }},
    localStorage:{getItem(k) { if (sinAlmacenamiento) throw Error('almacenamiento'); return guardado.get(k) || null; }, setItem(k,v) { if (sinAlmacenamiento) throw Error('almacenamiento'); guardado.set(k,v); }},
    navigator:{clipboard:{writeText: async v => { copias.push(v); }}}, matchMedia:() => ({matches:false}),
    console:{warn() {}}, setInterval() {}, setTimeout(f) { temporales.push(f); return temporales.length; }, clearTimeout() {},
    fetch:async (ruta, opciones) => {
      solicitudes.push({ruta:String(ruta), opciones});
      if (String(ruta).startsWith('https://script.google.com')) {
        if (!opciones.method && fallaConsulta) throw Error('sin red');
        return {ok:true, json:async () => opciones.method ? {ok:true, estado:'guardado', enlace:dato} : {ok:true,enlace:null}};
      }
      return {ok:true,json:async () => ruta === 'config.json' ? config : ruta === 'oferta.json' ? oferta : {periodo:'DEMO', enlaces:{a:dato}, cambio:dato.desde}};
    }};
  contexto.window = {addEventListener:(k,f) => { eventos[k] = f; }};
  runInNewContext(fuente, contexto);
  await new Promise(setImmediate);
  return {nodos, location, guardado, solicitudes, copias, eventos, temporales};
}
const app = await iniciarDOM({hash:'#g=3MM1'});
const n = app.nodos;
assert.equal(n.lista.querySelectorAll('.grupos-panel').length, 1);
assert.equal(n.lista.querySelectorAll('.materia').length, 2);
assert.equal(n.lista.querySelectorAll('button.grupo')[0].dataset.grupo, '3MM1');
assert.match(n.global.textContent, /1 de 5/);
await n.lista.querySelectorAll('.grupos-panel')[0].querySelector('button').emitir('click');
assert.equal(app.copias[0], 'https://ejemplo.test/sate/grupos/#g=3MM1');
n.buscar.value = 'etica'; await n.buscar.emitir('input');
assert.equal(n.resultados.textContent, '2 grupos · 2 materias');
await n.carrera.querySelectorAll('button').find(b => b.dataset.carrera === 'M').emitir('click');
n.semestre.value = '3'; await n.semestre.emitir('change');
n.turno.value = 'M'; await n.turno.emitir('change');
assert.equal(n.lista.querySelectorAll('.materia').length, 1);
assert.equal(n.resultados.textContent, '1 grupo · 1 materia');
assert.equal(leerHash(app.location.hash).c, 'M');
assert.equal(leerHash(app.location.hash).s, '3');
assert.equal(leerHash(app.location.hash).t, 'M');
assert.ok(app.guardado.has('ipnt.grupos.real.filtros'));
await n.limpiar.emitir('click');
assert.equal(n.buscar.value, ''); assert.equal(n.limpiar.hidden, true);
assert.equal(n.lista.querySelectorAll('button.grupo').length, 4);
app.location.hash = '#g=3BV1'; app.eventos.hashchange();
assert.equal(n.lista.querySelectorAll('.materia').length, 1);
assert.equal(n.lista.querySelectorAll('.grupos-panel').length, 1);
const prueba = await iniciarDOM({hash:'#g=3MM1', ruta:'/prueba/sate/grupos/', sinAlmacenamiento:true, fallaConsulta:true});
const materia = prueba.nodos.lista.querySelectorAll('.materia')[1];
await materia.querySelector('button').emitir('click');
assert.ok(materia.querySelector('form'), 'La consulta fallida conserva el formulario');
assert.equal(prueba.nodos.prueba.hidden, false);
assert.match(prueba.solicitudes.find(s => s.ruta.includes('accion=consultar')).ruta, /modo=prueba/);
const entrada = materia.querySelector('input'); entrada.value = url; await entrada.emitir('input');
await materia.querySelector('form').emitir('submit');
const escritura = prueba.solicitudes.find(s => s.opciones?.method === 'POST');
assert.equal(escritura.opciones.headers['Content-Type'], 'text/plain');
assert.deepEqual(JSON.parse(escritura.opciones.body), {accion:'agregar',modo:'prueba',id:'b',url,web:''});
assert.equal(prueba.nodos.mensaje.textContent, 'Enlace guardado');
assert.equal(prueba.nodos.mensaje.hidden, false);
assert.ok(materia.className.includes('guardada'));
assert.equal(materia.querySelector('a').href, url);
