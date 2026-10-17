import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const fuente = readFileSync(new URL('../tools/grupos_appscript.gs', import.meta.url), 'utf8');
const ID = '1BM3|MATERIA FICTICIA';
const url = n => 'https://chat.whatsapp.com/' + String(n).padStart(22, 'A');

function entorno() {
  const hojas = new Map(), cache = new Map(), props = new Map(), triggers = [], fetches = [];
  let candado = false, alEsperar = null;
  const lock = {
    waitLock(ms) { assert.equal(ms, 10000); assert.equal(candado, false); candado = true; if (alEsperar) { const f = alEsperar; alEsperar = null; f(); } },
    releaseLock() { assert.equal(candado, true); candado = false; }
  };
  const libro = {
    getSheetByName: nombre => hojas.get(nombre),
    insertSheet(nombre) {
      assert.ok(candado);
      const filas = [];
      const h = { filas, getLastRow: () => filas.length,
        appendRow(f) { assert.ok(candado); filas.push([...f]); },
        setFrozenRows() {}, getDataRange: () => ({ getValues: () => filas.map(f => [...f]) }) };
      hojas.set(nombre, h);
      return h;
    }
  };
  const contexto = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    SpreadsheetApp: { getActiveSpreadsheet: () => libro },
    LockService: { getScriptLock: () => lock },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) || null,
      put(k, v, ttl) { assert.ok(ttl > 0); cache.set(k, v); }, remove: k => cache.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.get(k) || null,
      setProperty(k, v) { assert.ok(candado); props.set(k, v); } }) },
    Utilities: { getUuid: () => 'uuid-ficticio' }, Logger: { log() {} },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: contenido => ({
      setMimeType() { return this; }, getContent: () => contenido }) },
    UrlFetchApp: { fetch(endpoint, opciones) {
      fetches.push([endpoint, opciones]);
      if (endpoint.endsWith('/oferta.json')) return { getResponseCode: () => 200,
        getContentText: () => JSON.stringify({ casillas: [{ id: ID }] }) };
      assert.ok(candado);
      return { getResponseCode: () => 204 };
    } },
    ScriptApp: { getProjectTriggers: () => [...triggers],
      deleteTrigger(t) { assert.ok(candado); triggers.splice(triggers.indexOf(t), 1); },
      newTrigger(nombre) { assert.ok(candado); const t = { getHandlerFunction: () => nombre, timeBased() { return this; },
        after(ms) { this.ms = ms; return this; }, create() { triggers.push(this); return this; } }; return t; } }
  });
  vm.runInContext(fuente, contexto);
  const post = d => JSON.parse(contexto.doPost({ postData: { contents: JSON.stringify({ accion: 'agregar', id: ID, url: url(1), web: '', ...d }) } }).getContent());
  const get = d => JSON.parse(contexto.doGet({ parameter: { accion: 'consultar', id: ID, ...d } }).getContent());
  return { contexto, hojas, cache, props, triggers, fetches, post, get, esperar(f) { alEsperar = f; } };
}

function probar() {
  const e = entorno();
  e.contexto.configurar();
  assert.ok(e.hojas.has('Enlaces') && e.hojas.has('Prueba'));
  assert.ok(e.props.get('CLAVE_EXPORT'));
  assert.equal(e.post().estado, 'guardado');
  const segundo = e.post({ url: url(2) });
  assert.equal(segundo.estado, 'existe');
  assert.equal(segundo.enlace.url, url(1));
  assert.equal(e.hojas.get('Enlaces').filas.length, 2);
  assert.equal(e.post({ accion: 'reemplazar', anterior: url(1), url: url(2), motivo: 'lleno' }).estado, 'guardado');
  const viejo = e.post({ accion: 'reemplazar', anterior: url(1), url: url(3), motivo: 'caido' });
  assert.equal(viejo.estado, 'cambio');
  assert.equal(viejo.enlace.url, url(2));
  assert.equal(e.post({ accion: 'reemplazar', anterior: url(2), motivo: 'spam' }).estado, 'invalido');
  for (const detalle of ['', 'x'.repeat(141), 'a\nb'])
    assert.equal(e.post({ accion: 'reemplazar', anterior: url(2), motivo: 'otro', detalle }).estado, 'invalido');
  e.props.set('ESCRITURA', 'cerrada');
  assert.equal(e.post().estado, 'cerrado');
  const cantidad = e.hojas.get('Enlaces').filas.length;
  assert.deepEqual(e.post({ web: 'robot' }), { ok: true, estado: 'guardado' });
  assert.equal(e.hojas.get('Enlaces').filas.length, cantidad);
  e.props.delete('ESCRITURA');
  e.hojas.get('Enlaces').filas[2][7] = true;
  assert.equal(e.get().enlace.url, url(1));
  assert.equal(e.get({ accion: 'exportar', clave: 'incorrecta' }).ok, false);
  const exportado = e.get({ accion: 'exportar', clave: e.props.get('CLAVE_EXPORT') });
  assert.equal(exportado[ID].url, url(1));
  assert.equal(e.post({ modo: 'prueba', url: '  ' + url(4) + '?x=1#otro' }).enlace.url, url(4));
  assert.equal(e.post({ id: 'ajeno' }).estado, 'invalido');
  assert.equal(e.post({ url: url(1).replace('https', 'http') }).estado, 'invalido');
  assert.equal(e.post({ modo: 'otro' }).estado, 'invalido');

  // Simula un envío ganador mientras la petición espera el candado, con caché vieja.
  const carrera = entorno();
  carrera.contexto.configurar();
  carrera.get();
  carrera.esperar(() => carrera.hojas.get('Enlaces').filas.push([
    new Date().toISOString(), 'agregar', ID, url(7), '', '', '', false
  ]));
  assert.equal(carrera.post().enlace.url, url(7));
  assert.equal(carrera.hojas.get('Enlaces').filas.length, 2);

  const cuotas = entorno();
  cuotas.post();
  for (let i = 1; i <= 6; i++)
    assert.equal(cuotas.post({ accion: 'reemplazar', anterior: url(i), url: url(i + 1), motivo: 'caido' }).estado, 'guardado');
  assert.equal(cuotas.post({ accion: 'reemplazar', anterior: url(7), url: url(8), motivo: 'caido' }).estado, 'limite');
  cuotas.cache.set('minuto_' + new Date().toISOString().slice(0, 16), '30');
  assert.equal(cuotas.post({ modo: 'prueba' }).estado, 'limite');

  const despacho = entorno();
  despacho.props.set('GH_TOKEN', 'token-ficticio');
  despacho.post();
  assert.equal(despacho.fetches.filter(([u]) => u.includes('api.github.com')).length, 1);
  despacho.contexto.despachar();
  despacho.contexto.despachar();
  assert.equal(despacho.triggers.length, 1);
  assert.equal(despacho.triggers[0].getHandlerFunction(), 'despachar');
  despacho.props.set('ULTIMO_DESPACHO', '0');
  despacho.contexto.despachar();
  assert.equal(despacho.triggers.length, 0);
  assert.equal(despacho.fetches.filter(([u]) => u.includes('api.github.com')).length, 2);
}

try { probar(); }
catch (err) { console.error(err.stack.split('\n').slice(0, 8).join('\n')); process.exitCode = 1; }
