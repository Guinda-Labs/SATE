// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script, runInNewContext} from 'node:vm';
const require = createRequire(import.meta.url);
const {normalizarURL, proximaVerificacion, mezclar, normalizarBusqueda, filtrar, leerHash, escribirHash,
  aceptacionReglas, leerHorario, periodoHorario, emparejarClave, seleccionHorario} = require('../web/sate/grupos.js');
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
const ofertaSate = {asig:['CÁLCULO  VECTORIAL', 'ETICA', 'Cálculo diferencial'], periodos:{
  proximo:[['M',0,0,'3MM1',0], ['M',0,0,'3MM1',1], ['B',0,0,'3BV1',2]], actual:[]}};
assert.equal(emparejarClave('M|3MM1|0', ofertaSate, [{...casillas[0], materia:'CALCULO VECTORIAL'}]), 'a');
assert.equal(emparejarClave('M|3MM1|1', ofertaSate, casillas), 'b');
for (const clave of ['M|3MM1|999', 'M|OTRO|0', 'B|3MM1|0', 'M|3MM1|no', null]) assert.equal(emparejarClave(clave, ofertaSate, casillas), null);
assert.equal(emparejarClave('M|3MM1|0', ofertaSate, casillas, 'actual'), null);
assert.equal(periodoHorario(ofertaSate, '2027/1'), 'proximo');
assert.equal(periodoHorario({periodos:{actual:{id:'27/1'}}}, '2027/1'), 'actual');
const horarioSate = {plan:'A', plans:{A:{sel:[],own:[]}, B:{sel:['M|3MM1|0','M|3MM1|1','B|3BV1|2'],own:[]}}};
assert.deepEqual(seleccionHorario(horarioSate).claves, []);
assert.equal(seleccionHorario(horarioSate).plan, 'A');
assert.equal(seleccionHorario(horarioSate, 'B').claves.length, 3);
const almacen = datos => Object.assign({getItem(k) { return datos[k] ?? null; }}, datos);
const memoriaReglas = datos => ({getItem:k => datos[k] ?? null, setItem(k,v) { datos[k] = v; }});
const datosReglas = {}, sesionReglas = {};
const localReglas = memoriaReglas(datosReglas), respaldoReglas = memoriaReglas(sesionReglas);
const aceptacion = aceptacionReglas(() => localReglas, () => respaldoReglas);
assert.equal(aceptacion.aceptada(), false);
aceptacion.aceptar();
assert.equal(datosReglas['grupos.reglas.v1'], 'aceptado');
assert.equal(aceptacionReglas(() => localReglas, () => respaldoReglas).aceptada(), true);
assert.equal(aceptacionReglas(() => localReglas, () => respaldoReglas, 'v2').aceptada(), false);
const inaccesible = () => { throw Error('almacenamiento deshabilitado'); };
const sinLocal = aceptacionReglas(inaccesible, () => respaldoReglas);
assert.equal(sinLocal.aceptada(), false);
sinLocal.aceptar();
assert.equal(aceptacionReglas(inaccesible, () => respaldoReglas).aceptada(), true, 'Aceptación durante la sesión');
assert.equal(aceptacionReglas(inaccesible, () => memoriaReglas({})).aceptada(), false, 'Nueva sesión requiere aceptar');
const soloLectura = () => ({getItem:() => null, setItem:inaccesible});
const sinEscritura = aceptacionReglas(soloLectura, () => respaldoReglas);
sinEscritura.aceptar();
assert.equal(aceptacionReglas(soloLectura, () => respaldoReglas).aceptada(), true);
const sinAmbos = aceptacionReglas(inaccesible, inaccesible);
assert.equal(sinAmbos.aceptada(), false);
sinAmbos.aceptar();
assert.equal(sinAmbos.aceptada(), true, 'Memoria de la visita si ambos almacenes fallan');
const claveHorario = 'hu.w.proximo', serializado = JSON.stringify(horarioSate);
assert.deepEqual(leerHorario(almacen({'ipnt.persistir':'si',[claveHorario]:serializado}), almacen({}), claveHorario), horarioSate);
assert.deepEqual(leerHorario(almacen({'ipnt.persistir':'no',[claveHorario]:'{}'}), almacen({[claveHorario]:serializado}), claveHorario), horarioSate);
assert.deepEqual(leerHorario(almacen({[claveHorario]:serializado}), almacen({}), claveHorario), horarioSate);
assert.deepEqual(leerHorario(almacen({'ipnt.unidad':'upiita'}), almacen({[claveHorario]:serializado}), claveHorario), horarioSate);
assert.deepEqual(leerHorario(almacen({'saes.alumno':'{}',[claveHorario]:serializado}), almacen({}), claveHorario), horarioSate);
assert.deepEqual(leerHorario(almacen({[claveHorario]:serializado}), almacen({'ipnt.persistir':'no',[claveHorario]:'{}'}), claveHorario), {});
assert.deepEqual(leerHorario({getItem() { throw Error('bloqueado'); }}, almacen({[claveHorario]:serializado}), claveHorario), horarioSate);
assert.equal(leerHorario(almacen({'ipnt.persistir':'si',[claveHorario]:'mal json'}), almacen({}), claveHorario), null);
assert.equal(leerHorario({getItem() { throw Error('bloqueado'); }}, {getItem() { throw Error('bloqueado'); }}, claveHorario), null);
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
  async emitir(k) {
    const evento = {defaultPrevented:false, preventDefault() { this.defaultPrevented = true; }, key:''};
    for (const f of this.events[k] || []) await f(evento);
    if (k === 'cancel' && !evento.defaultPrevented) this.close();
    return evento;
  }
  showModal() { this.open = true; this.aperturas = (this.aperturas || 0) + 1; }
  close() { this.open = false; for (const f of this.events.close || []) f(); }
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
async function iniciarDOM({hash = '', ruta = '/sate/grupos/', sinAlmacenamiento = false, fallaConsulta = false, horarioPersonal = null, fallaOferta = false, persistir = 'si', ofertaDirectorio = null, reglasAceptadas = true} = {}) {
  const nodos = Object.fromEntries(['reglas','reglas-titulo','aceptar-reglas','reglas-guia','abrir-reglas','guia-titulo','guia','abrir-guia','cerrar-guia','tema','carrera','buscar','semestre','nivel-etiqueta','turno','sin','lista','mensaje','prueba','estado','proxima','global','resultados','limpiar','tus-materias'].map(id => [id, new Nodo('div')]));
  nodos['tus-materias'].hidden = true;
  nodos.estado.append(new Nodo('summary'));
  const config = {periodo:'DEMO', zona:'America/Mexico_City', horario, endpoint:'https://script.google.com/demo', motivos:['caido','lleno','equivocado','otro'], enlaces:'/enlaces.json', enlaces_prueba:'/enlaces-prueba.json'};
  const oferta = ofertaDirectorio || {casillas, carreras:{M:'Mecatrónica',B:'Biónica'}, semestrales:[]};
  const datos = {}; runInNewContext(pagina.match(/<script>window.GRUPOS=([\s\S]*?);<\/script>/)[0].replace(/<\/?script>/g,''), {window:datos});
  // Carrera ficticia: verifica que la capacidad funcione sin depender del código de Energía.
  datos.GRUPOS.textos['grupos.carrera.z'] = 'Semestral';
  datos.GRUPOS.textos['grupos.carrera_corta.z'] = 'Semestral';
  const guardado = new Map(), solicitudes = [], copias = [], eventos = {}, temporales = [];
  const datosLocal = {'ipnt.persistir':persistir}, datosSesion = {};
  if (reglasAceptadas) datosLocal['grupos.reglas.v1'] = 'aceptado';
  if (horarioPersonal) (persistir === 'si' ? datosLocal : datosSesion)[claveHorario] = JSON.stringify(horarioPersonal);
  const sesion = almacen(datosSesion);
  const location = {pathname:ruta, search:'', hash, href:'https://ejemplo.test' + ruta + hash};
  const contexto = {GRUPOS:datos.GRUPOS, URL, URLSearchParams, Intl, Date, AbortSignal,
    document:{documentElement:new Nodo('html'), createElement: t => new Nodo(t), createElementNS: (_,t) => new Nodo(t), getElementById: id => nodos[id]},
    location, history:{replaceState(_, __, valor) { location.hash = valor.includes('#') ? '#' + valor.split('#')[1] : ''; }},
    localStorage:{...datosLocal, getItem(k) { if (sinAlmacenamiento) throw Error('almacenamiento'); return guardado.get(k) ?? datosLocal[k] ?? null; }, setItem(k,v) { if (sinAlmacenamiento) throw Error('almacenamiento'); guardado.set(k,v); }},
    sessionStorage:sesion,
    navigator:{clipboard:{writeText: async v => { copias.push(v); }}}, matchMedia:() => ({matches:false}),
    console:{warn() {}}, setInterval() {}, setTimeout(f) { temporales.push(f); return temporales.length; }, clearTimeout() {},
    fetch:async (ruta, opciones) => {
      solicitudes.push({ruta:String(ruta), opciones});
      if (ruta === '../datos/upiita/oferta.json') { if (fallaOferta) throw Error('oferta'); return {ok:true,json:async () => ofertaSate}; }
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
// Directorio por carrera y nivel, con semestres definidos exclusivamente por datos.
const agrupada = await iniciarDOM({ofertaDirectorio:{carreras:{M:'Mecatrónica',B:'Biónica',Z:'Semestral'}, semestrales:['Z'], casillas:[
  ...casillas,
  {id:'f', carrera:'M', nivel:1, turno:'M', grupo:'1MM10', materia:'Demo'},
  {id:'g', carrera:'M', nivel:1, turno:'M', grupo:'1MM2', materia:'Demo'},
  {id:'h', carrera:'M', nivel:1, turno:'M', grupo:'1MM1', materia:'Demo'},
  {id:'i', carrera:'Z', nivel:2, turno:'M', grupo:'2ZM1', materia:'Demo'},
  {id:'j', carrera:'Z', nivel:3, turno:'M', grupo:'3ZM1', materia:'Demo'}
]}});
const directorio = agrupada.nodos;
assert.deepEqual(directorio.lista.querySelectorAll('.grupos-carrera').map(s => s.dataset.carrera), ['M','B','Z']);
const mecanica = directorio.lista.querySelectorAll('.grupos-carrera')[0];
assert.match(mecanica.textContent, /Mecatrónica6 grupos/);
assert.deepEqual(mecanica.querySelectorAll('.grupos-nivel').map(s => s.dataset.nivel), ['1','3','4']);
assert.equal(mecanica.querySelector('.grupos-nivel-etiqueta').textContent, 'Nivel 1');
assert.deepEqual(mecanica.querySelector('.grupos-nivel').querySelectorAll('button.grupo').map(b => b.dataset.grupo), ['1MM1','1MM2','1MM10']);
assert.deepEqual(directorio.lista.querySelectorAll('.grupos-carrera')[2].querySelectorAll('.grupos-nivel-etiqueta').map(n => n.textContent), ['2.º semestre','3.er semestre']);
assert.equal(directorio['nivel-etiqueta'].textContent, 'Nivel / semestre');
assert.deepEqual(directorio.semestre.children.map(o => o.textContent), ['Todos','1','2','3','4']);
await directorio.carrera.querySelectorAll('button').find(b => b.dataset.carrera === 'Z').emitir('click');
assert.equal(directorio.lista.querySelectorAll('h2').length, 0);
assert.deepEqual(directorio.semestre.children.map(o => o.textContent), ['Todos','2.º semestre','3.er semestre']);
directorio.semestre.value = '2'; await directorio.semestre.emitir('change');
await directorio.carrera.querySelectorAll('button').find(b => b.dataset.carrera === 'M').emitir('click');
assert.equal(directorio['nivel-etiqueta'].textContent, 'Nivel');
assert.equal(directorio.semestre.value, '');
assert.deepEqual(directorio.semestre.children.map(o => o.textContent), ['Todos','Nivel 1','Nivel 3','Nivel 4']);
const css = readFileSync(new URL('../web/sate/grupos.css', import.meta.url), 'utf8');
assert.match(css, /@media\(max-width:479px\)\{\.grupos-nivel\{grid-template-columns:minmax\(0,1fr\)/);

const app = await iniciarDOM({hash:'#g=3MM1'});
const n = app.nodos;
assert.ok(!n.guia.open, 'La guía nunca se abre sola');
await n['abrir-guia'].emitir('click');
assert.equal(n.guia.open, true);
await n.guia.emitir('cancel');
assert.equal(n.guia.open, false);
assert.equal(n['abrir-guia'].enfocado, true);
await n['abrir-guia'].emitir('click');
await n['cerrar-guia'].emitir('click');
assert.equal(n.guia.open, false);
const primera = await iniciarDOM({reglasAceptadas:false, hash:'#g=3MM1'});
assert.equal(primera.nodos.reglas.open, true);
assert.equal(primera.nodos['reglas-titulo'].enfocado, true);
assert.ok(!primera.nodos.guia.open);
await primera.nodos.reglas.emitir('cancel');
assert.equal(primera.nodos.reglas.open, true);
assert.equal((await primera.nodos.reglas.emitir('cancel')).defaultPrevented, true);
await primera.nodos['reglas-guia'].emitir('click');
assert.equal(primera.nodos.guia.open, true);
await primera.nodos['cerrar-guia'].emitir('click');
assert.equal(primera.nodos['reglas-titulo'].enfocado, true);
const filaSinAceptar = primera.nodos.lista.querySelectorAll('.materia')[1];
await filaSinAceptar.querySelector('button').emitir('click');
assert.ok(!filaSinAceptar.querySelector('form'), 'Agregar exige aceptar antes de consultar o editar');
await primera.nodos['aceptar-reglas'].emitir('click');
assert.equal(primera.guardado.get('grupos.reglas.v1'), 'aceptado');
assert.equal(primera.nodos.reglas.open, false);
assert.ok(filaSinAceptar.querySelector('form'), 'Continúa la acción pendiente al aceptar');
const reemplazoSinAceptar = await iniciarDOM({reglasAceptadas:false, hash:'#g=3MM1'});
const filaReemplazo = reemplazoSinAceptar.nodos.lista.querySelectorAll('.materia')[0];
await filaReemplazo.querySelectorAll('button').find(b => b.textContent === 'Reemplazar enlace').emitir('click');
assert.ok(!filaReemplazo.querySelector('form'), 'Reemplazar también exige aceptar');
await reemplazoSinAceptar.nodos['aceptar-reglas'].emitir('click');
assert.ok(filaReemplazo.querySelector('form'));
assert.ok(filaReemplazo.querySelector('select'), 'Conserva el motivo requerido del reemplazo');
await primera.nodos['abrir-reglas'].emitir('click');
assert.equal(primera.nodos.reglas.open, true);
const bloqueado = await iniciarDOM({sinAlmacenamiento:true});
assert.equal(bloqueado.nodos.reglas.open, true);
await bloqueado.nodos['aceptar-reglas'].emitir('click');
assert.equal(bloqueado.nodos.reglas.open, false);
assert.ok(!bloqueado.nodos.guia.open);
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
await prueba.nodos['aceptar-reglas'].emitir('click');
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

assert.match(app.nodos['tus-materias'].textContent, /Arma tu horario en SATE/);
const personal = await iniciarDOM({hash:'#g=3MM1', horarioPersonal:horarioSate, persistir:'no'});
const tus = personal.nodos['tus-materias'];
assert.equal(tus.querySelectorAll('.materia').length, 0, 'No sustituir el plan activo vacío');
assert.match(tus.textContent, /0 de 0/);
const selector = tus.querySelector('select'); selector.value = 'B'; await selector.emitir('change');
assert.equal(tus.querySelectorAll('.materia').length, 3);
assert.match(tus.textContent, /1 de 3/);
assert.match(tus.querySelectorAll('.materia')[2].textContent, /3BV1/);
const filaPersonal = tus.querySelectorAll('.materia')[1];
await filaPersonal.querySelector('button').emitir('click');
const urlPersonal = filaPersonal.querySelector('input'); urlPersonal.value = url; await urlPersonal.emitir('input');
await filaPersonal.querySelector('form').emitir('submit');
assert.match(tus.textContent, /2 de 3/);
assert.equal(personal.nodos.lista.querySelectorAll('.materia')[1].querySelector('a').href, url);
await personal.eventos.storage({key:'ipnt.persistir'});
assert.match(tus.textContent, /0 de 0/);
const cambioHorario = {...horarioSate, plan:'B'};
personal.guardado.set('ipnt.persistir', 'si'); personal.guardado.set(claveHorario, JSON.stringify(cambioHorario));
await personal.eventos.storage({key:claveHorario});
assert.equal(tus.querySelectorAll('.materia').length, 3);
const desdeDirectorio = await iniciarDOM({hash:'#g=3MM1', horarioPersonal:cambioHorario});
const filaDirectorio = desdeDirectorio.nodos.lista.querySelectorAll('.materia')[1];
await filaDirectorio.querySelector('button').emitir('click');
const entradaDirectorio = filaDirectorio.querySelector('input'); entradaDirectorio.value = url; await entradaDirectorio.emitir('input');
await filaDirectorio.querySelector('form').emitir('submit');
assert.match(desdeDirectorio.nodos['tus-materias'].textContent, /2 de 3/);
assert.equal(desdeDirectorio.nodos['tus-materias'].querySelectorAll('.materia')[1].querySelector('a').href, url);
const sinOferta = await iniciarDOM({fallaOferta:true, horarioPersonal:cambioHorario});
assert.equal(sinOferta.nodos['tus-materias'].hidden, true);
assert.equal(sinOferta.nodos.lista.querySelectorAll('button.grupo').length, 4);

// Muestra exhaustiva de claves públicas compiladas, sin perfiles de alumnos.
const ofertaReal = JSON.parse(readFileSync(new URL('../web/dist/sate/datos/upiita/oferta.json', import.meta.url), 'utf8'));
const gruposReales = JSON.parse(readFileSync(new URL('../web/dist/sate/grupos/oferta.json', import.meta.url), 'utf8'));
const clavesReales = [...new Set(ofertaReal.periodos.proximo.map(c => c[0] + '|' + c[3] + '|' + c[4]))];
const emparejadas = clavesReales.filter(k => emparejarClave(k, ofertaReal, gruposReales.casillas)).length;
assert.equal(emparejadas, clavesReales.length, `Emparejamiento público: ${emparejadas}/${clavesReales.length}`);
