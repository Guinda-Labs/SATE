/* Huellas y diferencia de listas de oferta (puro). Lo comparten el snippet que se pega en el SAES
 * (tools/semestre.py snippet-saes) y las pruebas con node; la contraparte en Python está en semestre_huellas.py. */
function semValores(r) {
  var sal = Object.keys(r).filter(function (k) { return /^Sal/.test(k); })[0];
  return [r.carrera, r.plan, r.turno, r.nivel, r.Grupo, r.Asignatura, r.Profesor, r.Edificio, r[sal],
          r.Lun, r.Mar, r.Mie, r.Jue, r.Vie, r.Sab].map(function (v) { return v == null ? '' : String(v).trim(); });
}
async function semSha(texto, completa) {
  var b = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))), h = '';
  b.forEach(function (x) { h += ('0' + x.toString(16)).slice(-2); });
  return completa ? h : h.slice(0, 12);
}
/* base y nuevos: listas de huellas. Cada fila nueva toma la fila de la base más cercana hacia adelante (orden estable);
 * lo que no se puede emparejar en ese orden viaja como «nueva» y su pareja de la base como «fuera». */
function semDiferencia(base, nuevos) {
  var mapa = Object.create(null), usados = Object.create(null), ultimo = -1, nuevas = [], fuera = [];
  base.forEach(function (h, i) { (mapa[h] = mapa[h] || []).push(i); });
  nuevos.forEach(function (h, i) {
    var l = mapa[h];
    while (l && l.length && l[0] <= ultimo) l.shift();
    if (l && l.length) { ultimo = l.shift(); usados[ultimo] = 1; } else nuevas.push(i);
  });
  base.forEach(function (h, i) { if (!usados[i]) fuera.push(i); });
  return { fuera: fuera, nuevas: nuevas };
}
