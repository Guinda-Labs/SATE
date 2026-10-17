/* Capturador de la oferta del SAES (cualquier unidad académica del IPN).
 *
 * Se ejecuta dentro del SAES con la sesión iniciada (como marcador o pegado en la consola del navegador).
 * Solo lectura: recorre Académica › Horarios de clase (periodo actual y próximo) y Académica › Mapa curricular
 * reproduciendo los mismos filtros que la página (carrera, plan, turno, nivel). No inscribe ni modifica nada.
 *
 * Resultado: dos archivos para data/ del repositorio:
 *   horarios_saes.json        {fuente, capturado, carreras, actual:[...], proximo:[...]}
 *   mapa_curricular_saes.json {fuente, capturado, cols, rows:[[carrera, plan, nivel, clave, nombre, tipo, créditos, ht, hp]]}
 * Después: python tools/build_horarios.py  (ver docs/AUTOHOSPEDAJE.md).
 */
(async function () {
  if (!/(^|\.)saes\.[a-z0-9-]+\.ipn\.mx$/i.test(location.hostname)) {
    alert('Abre este marcador dentro del SAES de tu unidad académica (saes.<unidad>.ipn.mx) con tu sesión iniciada.');
    return;
  }
  var old = document.getElementById('captura-saes'); if (old) old.remove();
  var box = document.createElement('div');
  box.id = 'captura-saes';
  box.style.cssText = 'position:fixed;z-index:2147483647;right:16px;top:16px;width:min(420px,calc(100vw - 32px));background:#fff;color:#18181b;border:1px solid #d9d9de;border-radius:12px;box-shadow:0 18px 50px -12px rgba(0,0,0,.35);font:14px/1.5 system-ui,sans-serif;padding:16px';
  box.innerHTML = '<b style="font-size:16px">Capturador de la oferta del SAES</b><p id="cs-msg" style="margin:6px 0 0;color:#52525b">Iniciando…</p>';
  document.body.appendChild(box);
  var msg = function (t) { box.querySelector('#cs-msg').textContent = t; };
  /*__CAPTURA_BASE__*/
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var parse = function (h) { return new DOMParser().parseFromString(h, 'text/html'); };
  var P = 'ctl00$mainCopy$', F = P + 'Filtro$';
  var opts = function (d, n) { return Array.prototype.map.call(d.querySelectorAll('select[name="' + n + '"] option'), function (o) { return o.value; }); };
  // El límite incluye la lectura del cuerpo; no se reintenta un servidor saturado.
  var consultar = async function (url, opciones) {
    await sleep(600 + Math.random() * 400);
    var control = new AbortController(), inicio = Date.now();
    var limite = setTimeout(function () { control.abort(); }, 10000);
    try {
      var r = await fetch(url, Object.assign({}, opciones, { signal: control.signal }));
      if (r.status === 429 || r.status === 503) throw new Error('Captura detenida: el SAES respondió HTTP ' + r.status + '. Intenta en otro momento.');
      if (!r.ok) throw new Error('Captura detenida: HTTP ' + r.status + '.');
      var texto = await r.text();
      if (Date.now() - inicio > 10000) throw new Error('Captura detenida: el SAES tardó más de 10 segundos.');
      return { url: r.url, texto: texto };
    } catch (e) {
      if (control.signal.aborted) throw new Error('Captura detenida: el SAES tardó más de 10 segundos.');
      throw e;
    } finally { clearTimeout(limite); }
  };
  var post = async function (url, doc, target, ov) {
    var fd = new FormData(doc.forms[0]);
    fd.delete(P + 'cmdVisalizar');
    fd.set('__EVENTTARGET', target); fd.set('__EVENTARGUMENT', '');
    for (var k in ov) fd.set(k, ov[k]);
    var r = await consultar(url, { method: 'POST', body: new URLSearchParams(fd), credentials: 'same-origin' });
    if (/default\.aspx/i.test(r.url)) throw new Error('La sesión del SAES expiró. Inicia sesión y vuelve a ejecutar el capturador.');
    return parse(r.texto);
  };
  var cellsOf = function (row) { return Array.prototype.map.call(row.cells, function (c) { return c.textContent.replace(/ /g, ' ').trim(); }); };
  // Parsers puros: el contrato local ejecuta este mismo bloque sin red.
  /*__CAPTURA_PARSERS__*/
  var parsearOferta = function (d, contexto) {
    var g = d.querySelector('table[id$="dbgHorarios"]');
    if (!g || g.rows.length < 2) return [];
    var hd = cellsOf(g.rows[0]);
    return Array.prototype.slice.call(g.rows, 1).map(function (r) {
      var row = Object.assign({}, contexto), v = cellsOf(r);
      hd.forEach(function (h, i) { row[h] = v[i]; });
      return row;
    });
  };
  var parsearMapa = function (d, cm, pm, nm) {
    var gm = d.querySelector('table[id$="GridView1"]');
    if (!gm || gm.rows.length < 2) return [];
    var hm = cellsOf(gm.rows[0]), col = function (re) { return hm.findIndex(function (h) { return re.test(h); }); };
    var indices = [/periodo|nivel/i, /clave/i, /nombre/i, /tipo/i, /cr[eé]dito/i, /teor/i, /pr[aá]ctica/i].map(col);
    return Array.prototype.slice.call(gm.rows, 1).map(function (r) {
      var v = cellsOf(r), at = function (i) { return i >= 0 ? v[i] || '' : ''; };
      return [cm, pm, indices[0] >= 0 ? at(indices[0]) : nm].concat(indices.slice(1).map(at));
    }).filter(function (r) { return r[3]; });
  };
  /*__CAPTURA_PARSERS_FIN__*/
  /*__CAPTURA_BASE_FIN__*/
  var now = new Date().toISOString(), host = location.hostname.replace(/^www\./, '');
  var PERS_SAES = ['optActual', 'optProximo'];
  try {
    /*__CAPTURA_HORARIOS__*/
    /* ---------- horarios de clase ---------- */
    var H = '/Academica/horarios.aspx', out = { fuente: host + H, capturado: now, carreras: {}, actual: [], proximo: [] }, n = 0;
    var d0 = parse((await consultar(H, { credentials: 'same-origin' })).texto);
    if (!d0.querySelector('[name="' + F + 'cboCarrera"]')) throw new Error('No se encontró la página de horarios; verifica que tu sesión esté iniciada.');
    for (var per of PERS_SAES) {
      var key = per === 'optActual' ? 'actual' : 'proximo', ov = {}; ov[P + 'GroupPeriodoEscolar'] = per;
      var d = await post(H, d0, P + per, ov);
      Array.prototype.forEach.call(d.querySelectorAll('select[name="' + F + 'cboCarrera"] option'), function (o) { out.carreras[o.value] = o.text.trim(); });
      for (var c of opts(d, F + 'cboCarrera')) {
        var o1 = {}; o1[F + 'cboCarrera'] = c; d = await post(H, d, F + 'cboCarrera', o1);
        for (var p of opts(d, F + 'cboPlanEstud')) {
          var o2 = {}; o2[F + 'cboPlanEstud'] = p; d = await post(H, d, F + 'cboPlanEstud', o2);
          for (var t of opts(d, F + 'cboTurno')) {
            if (t === 'X') continue;
            var o3 = {}; o3[F + 'cboTurno'] = t; d = await post(H, d, F + 'cboTurno', o3);
            for (var nv of opts(d, F + 'lsNoPeriodos')) {
              var o4 = {}; o4[F + 'lsNoPeriodos'] = nv; d = await post(H, d, F + 'lsNoPeriodos', o4);
              out[key].push.apply(out[key], parsearOferta(d, { carrera: c, plan: p, turno: t, nivel: +nv }));
              msg('Horarios (' + (key === 'actual' ? 'periodo actual' : 'próximo periodo') + '): carrera ' + c + ', plan ' + p + ', turno ' + t + ', nivel ' + nv + ' · ' + (++n) + ' consultas');
            }
          }
        }
      }
    }
    /*__CAPTURA_HORARIOS_FIN__*/
    /* ---------- mapa curricular (créditos, claves y tipo de cada materia) ---------- */
    var M = '/Academica/mapa_curricular.aspx', mapa = { fuente: host + M, capturado: now, cols: ['carrera', 'plan', 'nivel', 'clave', 'nombre', 'tipo', 'creditos', 'horas_teoria', 'horas_practica'], rows: [] };
    try {
      var dm = parse((await consultar(M, { credentials: 'same-origin' })).texto);
      for (var cm of opts(dm, F + 'cboCarrera')) {
        var q1 = {}; q1[F + 'cboCarrera'] = cm; dm = await post(M, dm, F + 'cboCarrera', q1);
        for (var pm of opts(dm, F + 'cboPlanEstud')) {
          var q2 = {}; q2[F + 'cboPlanEstud'] = pm; dm = await post(M, dm, F + 'cboPlanEstud', q2);
          for (var nm of opts(dm, F + 'lsNoPeriodos')) {
            var q3 = {}; q3[F + 'lsNoPeriodos'] = nm; dm = await post(M, dm, F + 'lsNoPeriodos', q3);
            mapa.rows.push.apply(mapa.rows, parsearMapa(dm, cm, pm, nm));
            msg('Mapa curricular: carrera ' + cm + ', plan ' + pm + ', nivel ' + nm + ' · ' + (++n) + ' consultas');
          }
        }
      }
    } catch (e) { throw e; }
    /* ---------- descarga ---------- */
    var link = function (name, obj) {
      var url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
      return '<a href="' + url + '" download="' + name + '" style="display:inline-block;margin:8px 8px 0 0;padding:6px 12px;border-radius:8px;background:#750946;color:#fff;text-decoration:none;font-weight:600">' + name + '</a>';
    };
    window.CAPTURA_SAES = { horarios: out, mapa: mapa };
    box.innerHTML = '<b style="font-size:16px">Capturador de la oferta del SAES</b>' +
      '<p style="margin:6px 0 0">' + Object.keys(out.carreras).length + ' carreras · ' + out.actual.length + ' clases en el periodo actual · ' + out.proximo.length + ' en el próximo · ' + mapa.rows.length + ' materias en el mapa curricular.</p>' +
      '<p style="margin:6px 0 0;color:#52525b">Descarga los dos archivos y colócalos en la carpeta <code>data/</code> del repositorio.</p>' +
      link('horarios_saes.json', out) + link('mapa_curricular_saes.json', mapa) +
      '<p style="margin:10px 0 0"><button type="button" id="cs-x" style="border:1px solid #d9d9de;background:#fff;border-radius:8px;padding:4px 10px;cursor:pointer">Cerrar</button></p>';
    box.querySelector('#cs-x').onclick = function () { box.remove(); };
  } catch (e) {
    msg('No se pudo completar la captura: ' + (e.message || e));
  }
})();
