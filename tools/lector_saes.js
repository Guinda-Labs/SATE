/* Lector IPN-tools (marcador / bookmarklet): uno solo para todas las unidades; detecta la unidad por la dirección del SAES.
   Se ejecuta dentro del SAES de cualquier unidad (saes.<unidad>.ipn.mx) con la sesión del alumno ya iniciada.
   Los ids cambian entre unidades (UPIITA: ctl00_mainCopy_…, ESCOM: mainCopy_…): se buscan por terminación.
   Solo LEE páginas (GET): Kárdex, Cita, Estado General, Horario y Agenda. No envía datos a ningún servidor:
   arma un resumen, lo muestra en pantalla y lo copia al portapapeles cuando el alumno lo pide,
   para pegarlo en Horarios UPIITA o Electivas UPIITA.
   tools/saes.py lo convierte en un enlace javascript: y sustituye __TOOL_URL__. */
(async function () {
  var TOOL = '__TOOL_URL__';
  var resultado = window.IPNTSateResultado;
  if (typeof resultadoSate === 'function') resultado = resultadoSate;
  var UM = location.hostname.match(/(?:^|\.)saes\.([a-z0-9-]+)\.ipn\.mx$/i);
  if (!UM) {
    resultado(null, TOOL, '');
    return;
  }
  var UNIDAD = UM[1].toLowerCase();
  var SIG = __LECTOR_NOMBRES__[UNIDAD] || UNIDAD.toUpperCase();
  if (TOOL) TOOL = TOOL.replace(/horarios(-[a-z]+)?\.html$/, __LECTOR_UNIDADES__.includes(UNIDAD) ? 'horarios-' + UNIDAD + '.html' : 'sate/index.html?sateUnidad=' + UNIDAD);
  // claves: letra + 3 dígitos (B101) o con letras (optativas de la ESCOM); siempre con al menos un dígito
  var CLAVE = /^(?=[A-Z0-9]*\d)[A-Z][A-Z0-9]{2,6}$/i;
  var byId = function (d, id) { return d.querySelector('[id$="mainCopy_' + id + '"]'); };
  var clean = function (s) { return String(s || '').replace(/\s+/g, ' ').trim(); };
  var num = function (s) { var m = clean(s).replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : null; };
  var getRaw = async function (path) {
    var r = await fetch(path, { credentials: 'same-origin' });
    return new DOMParser().parseFromString(await r.text(), 'text/html');
  };
  var get = async function (path) {
    var d = await getRaw(path);
    if (!byId(d, 'Lbl_Nombre') && !d.querySelector('[id*="Lbl_Kardex"]')) throw new Error('sesion');
    return d;
  };
  /* tablas de la cita: renglón de encabezados seguido de renglón de valores */
  var pairs = function (d) {
    var out = {};
    d.querySelectorAll('table').forEach(function (t) {
      var rows = Array.prototype.slice.call(t.rows);
      for (var i = 0; i < rows.length - 1; i++) {
        var h = Array.prototype.map.call(rows[i].cells, function (c) { return clean(c.textContent); });
        var v = Array.prototype.map.call(rows[i + 1].cells, function (c) { return clean(c.textContent); });
        if (h.length > 1 && h.length === v.length && h.every(function (x) { return /[a-z]/i.test(x) && !/^\d/.test(x); })) {
          h.forEach(function (k, j) { if (!(k in out)) out[k] = v[j]; });
        }
      }
    });
    return out;
  };
  var pick = function (o, re) { for (var k in o) if (re.test(k)) return o[k]; return null; };
  /* renglones "ETIQUETA: | valor" (boleta, nombre) */
  var label = function (d, re) {
    var cells = d.querySelectorAll('td');
    for (var i = 0; i < cells.length - 1; i++) if (re.test(clean(cells[i].textContent))) return clean(cells[i + 1].textContent) || null;
    return null;
  };

  resultado(undefined, TOOL, SIG);
  try {
    var cita = await get('/Alumnos/Reinscripciones/fichas_reinscripcion.aspx');
    var kx = await get('/Alumnos/boleta/kardex.aspx');
    var gen = clean((byId(cita, 'Lbl_General') || {}).textContent);
    var p = pairs(cita);
    var acred = [], kxRep = [], materias = {}, creditosMaterias = {};
    var materia = function (k, n, s) {
      if (!CLAVE.test(k || '')) return;
      k = k.toUpperCase();
      var anterior = materias[k] || [k, null];
      materias[k] = [clean(n) || anterior[0], s > 0 ? s : anterior[1]];
    };
    var semestreTitulo = function (s) {
      s = clean(s).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      var m = s.match(/^(?:(?:SEMESTRE|NIVEL)\s*:?)?\s*(\d{1,2})[º°.o]?(?:\s*(?:SEMESTRE|NIVEL))?$/);
      if (m) return +m[1] || null;
      var ordinales = ['PRIMER','SEGUNDO','TERCER','CUARTO','QUINTO','SEXTO','SEPTIMO','OCTAVO','NOVENO','DECIMO','UNDECIMO','DUODECIMO'];
      m = s.match(/^(\w+)\s+(?:SEMESTRE|NIVEL)$/);
      var ordinal = m ? m[1].replace(/^PRIMERO$/, 'PRIMER').replace(/^TERCERO$/, 'TERCER') : '';
      return ordinales.indexOf(ordinal) >= 0 ? ordinales.indexOf(ordinal) + 1 : null;
    };
    var ordenTabla = 0;
    kx.querySelectorAll('[id*="Lbl_Kardex"] table').forEach(function (tabla) {
      var filas = Array.prototype.slice.call(tabla.rows).filter(function (tr) { return tr.closest('table') === tabla; });
      if (!filas.some(function (tr) { return tr.cells.length >= 6 && CLAVE.test(clean(tr.cells[0].textContent)); })) return;
      ordenTabla++;
      var titulo = tabla.caption ? semestreTitulo(tabla.caption.textContent) : null;
      filas.forEach(function (tr) { titulo = semestreTitulo(tr.textContent) || titulo; });
      var previo = tabla.previousElementSibling;
      while (previo && !clean(previo.textContent)) previo = previo.previousElementSibling;
      if (!titulo && previo && previo.tagName !== 'TABLE') titulo = semestreTitulo(previo.textContent);
      var semestre = titulo || ordenTabla;
      // Algunas unidades informan créditos; solo se leen si el encabezado identifica la columna.
      var columnaCreditos = -1;
      var columnasKardex = {cal: 5, periodo: 3, forma: 4};
      filas.forEach(function (tr) {
        Array.prototype.forEach.call(tr.cells, function (celda, i) {
          if (/^cr[eé]ditos$/i.test(clean(celda.textContent))) columnaCreditos = i;
          if (/^calificaci[oó]n$/i.test(clean(celda.textContent))) columnasKardex.cal = i;
          if (/^periodo$/i.test(clean(celda.textContent))) columnasKardex.periodo = i;
          if (/^forma\s+eval/i.test(clean(celda.textContent))) columnasKardex.forma = i;
        });
      });
      filas.forEach(function (tr) {
        var c = Array.prototype.map.call(tr.cells, function (x) { return clean(x.textContent); });
        if (c.length >= 6 && CLAVE.test(c[0])) {
          materia(c[0], c[1], semestre);
          var creditos = columnaCreditos >= 0 ? num(c[columnaCreditos]) : null;
          if (creditos !== null && creditos >= 0) creditosMaterias[c[0].toUpperCase()] = creditos;
          var cal = num(c[columnasKardex.cal]);
          if (cal !== null && cal >= 6) acred.push([c[0].toUpperCase(), cal, c[columnasKardex.periodo], c[columnasKardex.forma]]);
          else if (cal !== null && cal >= 0) kxRep.push([c[0].toUpperCase(), cal, c[columnasKardex.periodo], c[columnasKardex.forma]]);   // reprobadas que aparecen en el kárdex (cuentan en el promedio oficial)
        }
      });
    });
    /* materias reprobadas listadas en la cita (Descripción | créditos) */
    var repro = [];
    cita.querySelectorAll('table').forEach(function (t) {
      var rows = Array.prototype.slice.call(t.rows), on = false;
      rows.forEach(function (r) {
        var c = Array.prototype.map.call(r.cells, function (x) { return clean(x.textContent); });
        if (/^descripci/i.test(c[0] || '')) { on = true; return; }
        if (on && c.length >= 2 && !/total/i.test(c[0]) && num(c[1]) !== null) repro.push([c[0], num(c[1])]);
      });
    });
    /* opcionales: Estado General e Inscripción actual (materias en curso).
       Estado General tiene secciones con su título (MATERIAS REPROBADAS, NO CURSADAS, DESFASADAS) seguidas de su tabla;
       las no cursadas y desfasadas aparecen en los planes por semestre (ESCOM). Renglón: No_Periodo | clave | nombre | periodo | veces */
    var estado = [], curso = [], horario = [], secc = { reprobadas: [], no_cursadas: [], desfasadas: [] };
    try {
      var est = await getRaw('/Alumnos/boleta/Estado_Alumno.aspx'), sec = 'reprobadas';
      est.querySelectorAll('[id*="mainCopy_"]').forEach(function (el) {
        var t = clean(el.value || (el.tagName === 'TABLE' ? '' : el.textContent));
        if (el.tagName !== 'TABLE' && !el.closest('[id*="GV_"]') && !el.querySelector('table') && /^MATERIAS\s/i.test(t)) { sec = /NO CURSADAS/i.test(t) ? 'no_cursadas' : /DESFASADAS/i.test(t) ? 'desfasadas' : 'reprobadas'; return; }
        if (el.tagName !== 'TABLE' || !/GV_/i.test(el.id)) return;
        var dest = /Reprobadas/i.test(el.id) ? 'reprobadas' : sec;   // UPIITA: GV_Reprobadas
        Array.prototype.slice.call(el.rows, 1).forEach(function (r) {
          var c = Array.prototype.map.call(r.cells, function (x) { return clean(x.textContent); });
          if (CLAVE.test(c[1] || '')) {
            secc[dest].push([c[1].toUpperCase(), c[3] || null, num(c[4]), num(c[0])]);
            materia(c[1], c[2], num(c[0]));
          }
        });
      });
      estado = secc.reprobadas.map(function (r) { return r.slice(0, 3); });
    } catch (e) { estado = null; secc = null; }
    try {
      var hor = await getRaw('/Alumnos/Informacion_semestral/Horario_Alumno.aspx');
      hor.querySelectorAll('[id*="GV_Horario"] [id*="Lbl_Materia"]').forEach(function (s) {
        var m = clean(s.textContent).match(/^((?=[A-Z0-9]*\d)[A-Z][A-Z0-9]{2,6})\b/i);
        if (m) { curso.push(m[1].toUpperCase()); materia(m[1], clean(s.textContent).slice(m[0].length).replace(/^\s*-\s*/, ''), null); }
      });
      /* horario inscrito completo: [grupo, clave, materia, profesores, [[día, inicio, fin], ...]] (minutos desde 0:00) */
      var gvh = byId(hor, 'GV_Horario');
      if (gvh && gvh.rows.length > 1) {
        var DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        var hdr = Array.prototype.map.call(gvh.rows[0].cells, function (c) { return clean(c.textContent).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); });
        var mins = function (t) { var x = t.split(':'); return +x[0] * 60 + +x[1]; };
        Array.prototype.slice.call(gvh.rows, 1).forEach(function (r) {
          var c = Array.prototype.map.call(r.cells, function (x) { return clean(x.textContent); });
          var m = (c[1] || '').match(/^((?=[A-Z0-9]*\d)[A-Z][A-Z0-9]{2,6})\s*-\s*(.*)$/i);
          if (!m) return;
          materia(m[1], m[2], null);
          if (curso.indexOf(m[1].toUpperCase()) < 0) curso.push(m[1].toUpperCase());
          var ses = [];
          hdr.forEach(function (h, i) {
            var d = DIAS.indexOf(h), t = (c[i] || '').match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
            if (d >= 0 && t) ses.push([d, mins(t[1]), mins(t[2])]);
          });
          horario.push([c[0], m[1].toUpperCase(), m[2], c[2] || '', ses]);
        });
      }
    } catch (e) { curso = null; horario = null; }
    /* opcional: Agenda escolar (inicio y fin de cada semestre); fechas «Oct 19 2026» -> «2026-10-19» */
    var agenda = [];
    try {
      var MES = { ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4, jun: 5, jul: 6, ago: 7, aug: 7, sep: 8, oct: 9, nov: 10, dic: 11, dec: 11 };
      var fecha = function (s) {
        var m = clean(s).toLowerCase().match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/);
        return m && MES[m[1]] != null ? m[3] + '-' + String(MES[m[1]] + 1).padStart(2, '0') + '-' + String(+m[2]).padStart(2, '0') : null;
      };
      var ag = byId(await getRaw('/Academica/agenda_escolar.aspx'), 'GVAgenda');
      if (ag) Array.prototype.slice.call(ag.rows, 1).forEach(function (r) {
        var c = Array.prototype.map.call(r.cells, function (x) { return clean(x.textContent); });
        if (c[0]) agenda.push([c[0], fecha(c[1]), fecha(c[2])]);
      });
    } catch (e) { agenda = null; }
    var freq = {}; acred.forEach(function (a) { freq[a[0][0]] = (freq[a[0][0]] || 0) + 1; });
    var claveCar = Object.keys(freq).sort(function (a, b) { return freq[b] - freq[a]; })[0] || null;
    var data = {
      upiita_saes: 1,
      unidad: UNIDAD,
      materias: materias,
      leido: new Date().toISOString(),
      boleta: (gen.match(/BOLETA:\s*(\d{10})/i) || [])[1] || ((label(cita, /^BOLETA:?$/i) || '').match(/\d{10}/) || [])[0] || null,
      nombre: (gen.match(/NOMBRE:\s*(.+?)\s*(CARRERA|PLAN|$)/i) || [])[1] || label(cita, /^NOMBRE:?$/i) || clean((byId(cita, 'Lbl_Nombre') || {}).textContent),
      carrera: claveCar,
      carrera_nombre: clean((cita.querySelector('[id$="mainCopy_DpdCarrera"] option:checked') || {}).textContent),
      plan: (cita.querySelector('[id$="mainCopy_dpdPlanEstudios"] option:checked') || {}).value || null,
      // el promedio aparece en la cita de reinscripción; si no está publicada, se busca en el kárdex («PROMEDIO: 8.14»)
      promedio: num(pick(p, /^promedio/i)) ?? num(label(kx, /^promedio/i)) ??
        num(((clean(kx.body ? kx.body.textContent : kx.textContent) || '').match(/PROMEDIO(?:\s+GENERAL)?\s*:?\s*(\d{1,2}(?:\.\d{1,2})?)/i) || [])[1]),
      reprobadas_num: num(pick(p, /reprobadas$/i)),
      cita: { inicio: pick(p, /fecha inscrip/i), fin: pick(p, /caducidad/i) },
      carga: {
        total: num(pick(p, /^total de creditos$/i)), max: num(pick(p, /m.xima de creditos/i)),
        media: num(pick(p, /media de creditos/i)), min: num(pick(p, /m.nima de creditos/i)),
        duracion: num(pick(p, /duraci.n de la carrera en/i)), duracion_max: num(pick(p, /duraci.n m.xima/i))
      },
      avance: {
        obtenidos: num(pick(p, /has obtenido/i)), faltan: num(pick(p, /te faltan/i)),
        cursados: num(pick(p, /que cursaste/i)), disponibles: num(pick(p, /disponibles/i)),
        autorizada: pick(p, /carga autorizada/i)
      },
      reprobadas: repro,
      desfase_saes: pick(p, /reprobadas de \d/i),
      reprobadas_periodo: estado,
      /* planes por semestre: lo que el propio SAES calcula ([clave, periodo, veces, semestre]) */
      no_cursadas: secc ? secc.no_cursadas : null,
      desfasadas_saes: secc ? secc.desfasadas : null,
      en_curso: curso,
      horario_inscrito: horario,
      acreditadas: acred,
      creditos_materias: creditosMaterias,
      kardex_reprobadas: kxRep,
      agenda: agenda,   /* [evento, inicio, fin] de la Agenda escolar: de aquí sale el periodo que sigue */
      lector: '__LECTOR_VERSION__'   /* versión del marcador SATE (huella del código), para atribuir errores a una versión */
    };
    resultado(data, TOOL, SIG);
  } catch (e) {
    console.warn('SATE: lectura no disponible', {unidad: UNIDAD, codigo: e.message === 'sesion' ? 'sesion' : 'lectura'});
    resultado(null, TOOL, SIG);
  }
})();
