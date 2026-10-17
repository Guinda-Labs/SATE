// SPDX-License-Identifier: MIT
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const require = createRequire(import.meta.url);
const {normalizarURL, proximaVerificacion, mezclar} = require('../web/sate/grupos.js');
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
const pagina = readFileSync(new URL('../web/dist/sate/grupos/index.html', import.meta.url), 'utf8');
for (const bloque of pagina.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new Script(bloque[1]);
