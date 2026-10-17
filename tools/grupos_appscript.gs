/** SATE · Directorio de WhatsApp. Instalación: grupos_appscript.md. */
const COLUMNAS = ['fecha', 'tipo', 'id', 'url', 'anterior', 'motivo', 'detalle', 'ocultar'];
const MOTIVOS = ['caido', 'lleno', 'equivocado', 'otro'];

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function error_(estado, mensaje) { return json_({ ok: false, estado, mensaje }); }
function modo_(m) {
  if (m !== undefined && m !== '' && m !== 'prueba') throw new Error('modo');
  return m === 'prueba' ? 'Prueba' : 'Enlaces';
}
function url_(v) {
  if (typeof v !== 'string') return null;
  const u = v.replace(/\s/g, '').split(/[?#]/)[0];
  return /^https:\/\/chat\.whatsapp\.com\/(invite\/)?[A-Za-z0-9]{20,24}$/.test(u) ? u : null;
}
function hoja_(nombre) {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  let h = libro.getSheetByName(nombre);
  if (!h) h = libro.insertSheet(nombre);
  if (h.getLastRow() === 0) {
    h.appendRow(COLUMNAS);
    h.setFrozenRows(1);
  }
  return h;
}
function filas_(h) { return h.getDataRange().getValues().slice(1); }
function guardarCache_(k, v, segundos) {
  // La caché es prescindible; una oferta grande puede exceder su límite por entrada.
  try { CacheService.getScriptCache().put(k, JSON.stringify(v), segundos); }
  catch (_) { console.warn('Caché omitida: ' + k); }
}
function oferta_() {
  const cache = CacheService.getScriptCache(), previo = cache.get('oferta');
  if (previo) return JSON.parse(previo);
  const sitio = PropertiesService.getScriptProperties().getProperty('SITIO') || 'https://guinda-labs.github.io';
  const r = UrlFetchApp.fetch(sitio.replace(/\/$/, '') + '/sate/grupos/oferta.json', { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('oferta');
  const d = JSON.parse(r.getContentText());
  if (!Array.isArray(d.casillas)) throw new Error('oferta');
  const ids = d.casillas.map(c => c.id);
  guardarCache_('oferta', ids, 21600);
  return ids;
}
function curar_(filas) {
  const mapa = Object.create(null);
  filas.slice().sort((a, b) => new Date(a[0]) - new Date(b[0])).forEach(f => {
    const [fecha, tipo, id, raw, anterior, motivo, , ocultar] = f;
    if (ocultar === true || /^(true|verdadero|sí|si|1)$/i.test(String(ocultar))) return;
    const url = url_(raw), ms = new Date(fecha).getTime();
    if (!url || !isFinite(ms)) return;
    const desde = new Date(ms).toISOString(), vigente = mapa[id];
    if (tipo === 'agregar' && !vigente) mapa[id] = { url, desde, reemplazo: null };
    if (tipo === 'reemplazar' && vigente && anterior === vigente.url && MOTIVOS.indexOf(motivo) >= 0)
      mapa[id] = { url, desde, reemplazo: { motivo, fecha: desde } };
  });
  return mapa;
}
function doGet(e) {
  try {
    const d = (e && e.parameter) || {}, nombre = modo_(d.modo);
    if (d.accion !== 'consultar' && d.accion !== 'exportar') return error_('invalido', 'Acción inválida.');
    if (d.accion === 'exportar') {
      const clave = PropertiesService.getScriptProperties().getProperty('CLAVE_EXPORT');
      if (!clave || d.clave !== clave) return error_('invalido', 'Acceso denegado.');
    } else if (oferta_().indexOf(d.id) < 0) return error_('invalido', 'Casilla inválida.');
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const cache = CacheService.getScriptCache(), k = 'mapa_' + nombre, previo = cache.get(k);
      const mapa = previo ? JSON.parse(previo) : curar_(filas_(hoja_(nombre)));
      if (!previo) guardarCache_(k, mapa, 60);
      return json_(d.accion === 'exportar' ? mapa : { ok: true, enlace: mapa[d.id] || null });
    } finally { lock.releaseLock(); }
  } catch (_) {
    console.error('grupos: consulta no completada');
    return error_('invalido', 'No se pudo consultar.');
  }
}
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.web) return json_({ ok: true, estado: 'guardado' });
    const nombre = modo_(d.modo), url = url_(d.url);
    if (!url || ['agregar', 'reemplazar'].indexOf(d.accion) < 0 || oferta_().indexOf(d.id) < 0)
      return error_('invalido', 'Enlace o casilla inválidos.');
    const detalle = d.detalle === undefined ? '' : d.detalle;
    if (d.accion === 'reemplazar' && (MOTIVOS.indexOf(d.motivo) < 0 || !url_(d.anterior) ||
        typeof detalle !== 'string' || detalle.length > 140 || /[\r\n\u2028\u2029]/.test(detalle) ||
        (d.motivo === 'otro' && !detalle.trim()))) return error_('invalido', 'Motivo o detalle inválidos.');
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let respuesta;
    try {
      const props = PropertiesService.getScriptProperties();
      if (props.getProperty('ESCRITURA') === 'cerrada') return error_('cerrado', 'La escritura está cerrada.');
      // No se usa la caché para decidir: otro envío pudo ganar mientras esperábamos.
      const h = hoja_(nombre), filas = filas_(h), mapa = curar_(filas), vigente = mapa[d.id] || null;
      if (d.accion === 'agregar' && vigente) return json_({ ok: true, estado: 'existe', enlace: vigente });
      if (d.accion === 'reemplazar' && (!vigente || url_(d.anterior) !== vigente.url))
        return json_({ ok: true, estado: 'cambio', enlace: vigente });
      const ahora = new Date().toISOString(), dia = ahora.slice(0, 10);
      if (d.accion === 'reemplazar' && filas.filter(f => f[1] === 'reemplazar' && f[2] === d.id &&
          isFinite(new Date(f[0]).getTime()) && new Date(f[0]).toISOString().slice(0, 10) === dia).length >= 6)
        return error_('limite', 'Máximo de seis reemplazos al día.');
      const cache = CacheService.getScriptCache(), k = 'minuto_' + ahora.slice(0, 16), n = Number(cache.get(k) || 0);
      if (n >= 30) return error_('limite', 'Demasiados envíos. Intenta en un minuto.');
      cache.put(k, String(n + 1), 120);
      // El apóstrofo impide interpretar el detalle libre como fórmula de Sheets.
      const seguro = /^[=+\-@]/.test(detalle) ? "'" + detalle : detalle;
      h.appendRow([ahora, d.accion, d.id, url, vigente ? vigente.url : '',
        d.accion === 'reemplazar' ? d.motivo : '', d.accion === 'reemplazar' ? seguro : '', false]);
      cache.remove('mapa_' + nombre);
      respuesta = { ok: true, estado: 'guardado', enlace: { url, desde: ahora,
        reemplazo: d.accion === 'reemplazar' ? { motivo: d.motivo, fecha: ahora } : null } };
      console.log('grupos: guardado modo=' + nombre + ' tipo=' + d.accion);
    } finally { lock.releaseLock(); }
    // Una falla de GitHub no debe convertir un guardado confirmado en error.
    try { despachar(); } catch (_) { console.error('grupos: despacho pendiente; respaldo por horario'); }
    return json_(respuesta);
  } catch (_) {
    console.error('grupos: escritura no completada');
    return error_('invalido', 'No se pudo guardar.');
  }
}
function configurar() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    hoja_('Enlaces'); hoja_('Prueba');
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('CLAVE_EXPORT'))
      props.setProperty('CLAVE_EXPORT', Utilities.getUuid() + Utilities.getUuid());
    Logger.log('CLAVE_EXPORT: ' + props.getProperty('CLAVE_EXPORT'));
  } finally { lock.releaseLock(); }
}
function despachar() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'despachar')
      .forEach(t => ScriptApp.deleteTrigger(t));
    const p = PropertiesService.getScriptProperties(), token = p.getProperty('GH_TOKEN');
    if (!token) return;
    const ahora = Date.now(), ultimo = Number(p.getProperty('ULTIMO_DESPACHO') || 0), espera = 360000 - (ahora - ultimo);
    if (espera > 0) {
      ScriptApp.newTrigger('despachar').timeBased().after(Math.max(1000, espera)).create();
      return;
    }
    // Cuenta también los intentos fallidos para no golpear GitHub repetidamente.
    p.setProperty('ULTIMO_DESPACHO', String(ahora));
    const repo = p.getProperty('GH_REPO') || 'Guinda-Labs/guinda-labs.github.io';
    const workflow = p.getProperty('GH_WORKFLOW') || 'grupos.yml';
    try {
      const r = UrlFetchApp.fetch('https://api.github.com/repos/' + repo + '/actions/workflows/' + workflow + '/dispatches', {
        method: 'post', contentType: 'application/json', payload: JSON.stringify({ ref: 'main' }),
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' }, muteHttpExceptions: true
      });
      const codigo = r.getResponseCode();
      console.log('grupos: despacho HTTP ' + codigo);
      if (codigo < 200 || codigo >= 300) ScriptApp.newTrigger('despachar').timeBased().after(360000).create();
    } catch (_) {
      console.error('grupos: GitHub no respondió; reintento en seis minutos');
      ScriptApp.newTrigger('despachar').timeBased().after(360000).create();
    }
  } finally { lock.releaseLock(); }
}
