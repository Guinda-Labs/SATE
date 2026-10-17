/* Captura de HORARIOS del SAES (solo lectura) con diferencia contra la oferta guardada.
 * Generado por: python tools/semestre.py snippet-saes   (no editar a mano: las marcas /*__SEM_…__*/ las llena el generador).
 * Se pega en el navegador integrado, en una pestaña del SAES con sesión iniciada. Deja el resultado en window.SEM:
 *   {version, capturado, fuente, carreras, listas:{actual|proximo:{n, sha, base, coincide, fuera:[índices], nuevas:[[índice, valores]]}}}
 * y no descarga archivos. Después: python tools/semestre.py aplicar-saes <diff.json>. */
(async function () {
  if (!/(^|\.)saes\.[a-z0-9-]+\.ipn\.mx$/i.test(location.hostname)) {
    alert('Abre este código dentro del SAES de tu unidad académica con la sesión iniciada.');
    return;
  }
  var SEM_BASE = /*__SEM_BASE__*/ null;
  var PERS_SAES = /*__SEM_PERS__*/ ['optActual', 'optProximo'];
  /*__SEM_DIFF__*/
  var old = document.getElementById('captura-saes'); if (old) old.remove();
  var box = document.createElement('div');
  box.id = 'captura-saes';
  box.style.cssText = 'position:fixed;z-index:2147483647;right:16px;top:16px;width:min(420px,calc(100vw - 32px));background:#fff;color:#18181b;border:1px solid #d9d9de;border-radius:12px;font:14px/1.5 system-ui,sans-serif;padding:16px';
  box.innerHTML = '<b>Actualización de la oferta (solo lectura)</b><p id="cs-msg" style="margin:6px 0 0">Iniciando…</p>';
  document.body.appendChild(box);
  var msg = function (t) { box.querySelector('#cs-msg').textContent = t; };
  window.SEM = null;
  /*__SEM_CAPTURA_BASE__*/
  var now = new Date().toISOString(), host = location.hostname.replace(/^www\./, '');
  try {
    /*__SEM_CAPTURA_HORARIOS__*/
    var listas = {};
    for (var semK of ['actual', 'proximo']) {
      var filas = out[semK];
      if (!filas.length) { listas[semK] = { n: 0 }; continue; }
      var vals = filas.map(semValores), lineas = vals.map(function (v) { return v.join('|'); }), hs = [];
      for (var semL of lineas) hs.push(await semSha(semL));
      var mejor = null;
      for (var semB of ['actual', 'proximo']) {
        var df = semDiferencia((SEM_BASE && SEM_BASE[semB]) || [], hs);
        var coin = (hs.length - df.nuevas.length) / Math.max(hs.length, ((SEM_BASE && SEM_BASE[semB]) || []).length, 1);
        if (!mejor || coin > mejor.coincide) mejor = { base: semB, coincide: coin, df: df };
      }
      listas[semK] = { n: filas.length, sha: await semSha(lineas.join('\n'), true), base: mejor.base,
        coincide: Math.round(mejor.coincide * 10000) / 10000, fuera: mejor.df.fuera,
        nuevas: mejor.df.nuevas.map(function (i) { return [i, vals[i]]; }) };
    }
    window.SEM = { version: 1, capturado: now, fuente: out.fuente, carreras: out.carreras, listas: listas };
    msg(['actual', 'proximo'].map(function (k) { var l = listas[k]; return k + ': ' + (l.n ? l.n + ' filas (+' + l.nuevas.length + ' / −' + l.fuera.length + ' vs ' + l.base + ')' : 'vacío'); }).join(' · ') + '. Resultado en window.SEM.');
  } catch (e) {
    msg('No se pudo completar: ' + (e.message || e));
  }
})();
