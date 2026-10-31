/* Guía politécnica de SATE: portada con apartados y respuestas a las dudas del alumnado.
   Apartados con datos (data/guia/<unidad>.json): «Situación escolar y dictamen», «Trámites y formatos», «Reglamentos» y
   «¿A quién acudo?». «Programas de estudio» es la vista de temarios.js (#/<unidad>/guia/programas).
   A. Funciones puras (búsqueda, fuentes, apartados disponibles): se prueban en Node.
   B. Integración con SATE: portada, preguntas desplegables buscables, reglamentos y a quién acudir. */
(function (raiz) {
  'use strict';

  /* ===================== A. Funciones puras ===================== */
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const terminos = q => norm(q).split(/[^a-z0-9ñ]+/).filter(Boolean);
  const textoDe = p => norm([p.pregunta, p.respuesta, ...(p.pasos || []), ...(p.palabras || [])].join(' '));
  // Preguntas que contienen todas las palabras de la consulta; primero las que coinciden en el título.
  function buscarPreguntas(preguntas, q, apartado) {
    const ts = terminos(q);
    if (!ts.length) return [];
    return (preguntas || [])
      .filter(p => (!apartado || p.apartado === apartado) && ts.every(w => textoDe(p).includes(w)))
      .map(p => ({ p, peso: ts.filter(w => norm(p.pregunta).includes(w)).length }))
      .sort((a, b) => b.peso - a.peso)
      .map(x => x.p);
  }
  // El vocabulario coloquial afecta solo la búsqueda global; el lector conserva su búsqueda literal.
  function palabrasConsulta(q, o) {
    return terminos(q).map(w => o.sinonimos?.[w] || w).filter(w => !(o.ignorar || []).includes(w));
  }
  function buscarSoluciones(d, q) {
    const o = d.orientacion || {}, ts = palabrasConsulta(q, o);
    if (!ts.length) return [];
    const intencion = (o.intenciones || []).find(i => i.terminos.every(w => ts.includes(w)));
    return (d.preguntas || []).map(p => {
      const texto = palabrasConsulta(textoDe(p), o).join(' '), titulo = palabrasConsulta(p.pregunta, o).join(' ');
      const aciertos = ts.filter(w => texto.includes(w));
      return {p, peso: (intencion?.pregunta === p.id ? 100 : aciertos.length < Math.ceil(ts.length * .75) ? 0 : aciertos.length * 3 + ts.filter(w => titulo.includes(w)).length)};
    }).filter(x => x.peso > 0).sort((a,b) => b.peso-a.peso).map(x => x.p);
  }
  function respuestaDirecta(d, q) {
    const o = d.orientacion || {}, ts = [...new Set(palabrasConsulta(q,o).filter(w => !['es','son'].includes(w)))];
    if (!ts.length) return {definiciones:[], pregunta:null};
    const definiciones = Object.entries(d.glosario || {}).filter(([,g]) => {
      const titulo = terminos(g.termino);
      return ts.every(w => titulo.includes(w));
    }).map(([id,g]) => ({id,...g}));
    if (definiciones.length) return {definiciones, pregunta:null};
    const intencion = (o.intenciones || []).find(i => i.terminos.every(w => ts.includes(w)) && ts.every(w => i.terminos.includes(w)));
    const candidatos = (d.preguntas || []).map(p => {
      const titulo = palabrasConsulta(p.pregunta,o), texto = palabrasConsulta(textoVisibleIndice(textoDe(p)),o);
      const aciertos = ts.filter(w => texto.includes(w)).length, cabecera = ts.filter(w => titulo.includes(w)).length;
      const peso = intencion && intencion.pregunta === p.id ? 100 : aciertos === ts.length && cabecera >= Math.ceil(ts.length * .75) ? aciertos * 3 + cabecera * 4 : 0;
      return {p,peso};
    }).filter(x => x.peso >= 7).sort((a,b) => b.peso-a.peso);
    return {definiciones:[], pregunta:candidatos[0]?.p || null};
  }
  function aplicaPregunta(p, s, o) {
    if (!s) return false;
    const regla = o?.aplicabilidad?.[p.id];
    return regla === 'adeudos' ? !!s.adeudos?.length : regla === 'recursamiento' ? s.fis?.some(f => f.veces >= 2) || false : regla === 'desfase' ? s.nDes > 0 : regla === 'dictamen' ? !!s.rd?.n && !s.rd.ok : false;
  }
  function rutaPersonal(s) {
    if (!s) return null;
    if (s.adeudos?.length || s.nDes) return 'irregular';
    if (s.D?.total > 0 && s.D.obt >= s.D.total) return 'salida';
    if (s.D?.obt === 0) return 'nuevo';
    return 'aprovecha';
  }
  // No inferimos un dictamen desde respuestas manuales ni anulamos la excepción transitoria del núcleo.
  function resolverRuta(s, estado) {
    if (estado.motivo === 'pausa') return 'baja-temporal';
    if (estado.dictamen === 'si') return null;
    if (s?.rd?.ok) return 'oportunidades-reprobar';
    if (s?.rd?.n && !s.rd.ok) return 'formato-dictamen';
    // Sin regla general de desfase para el periodo, el estado por materia (desfasada o dos veces cursada) ya exige dictamen.
    if (!s?.rd && (s?.fis||[]).some(f=>f.estado==='desfasada'||f.veces>=2)) return 'formato-dictamen';
    if (estado.motivo === 'ordinario') return 'oportunidades-reprobar';
    return null;
  }
  // Apartados que una unidad puede mostrar: con datos de la Guía o con su vista propia (programas); `pronto` aún no tiene contenido.
  function apartadosDisponibles(guia, unidad) {
    const vistas = (unidad && unidad.vistas || []).map(v => v.id);
    return (guia || []).filter(a => !a.pronto && (!a.capacidad || !!unidad?.[a.capacidad]) && (a.vista ? vistas.includes(a.vista) : !!(unidad && unidad.guiaDatos)));
  }
  // Fuente de una respuesta: {texto, url}. `documentos` se declara una vez y las preguntas lo citan por id.
  function fuente(datos, f, t) {
    const d = datos && datos.documentos && f && datos.documentos[f.doc];
    if (!d) return null;
    return { texto: f.articulo ? t('sate.guia.fuente_articulo', { documento: d.titulo, articulo: f.articulo }) : f.pagina ? t('sate.guia.fuente_pagina', { documento: d.titulo, pagina: f.pagina }) : d.titulo, url: d.url, doc: f.doc, arts: f.arts || [] };
  }
  const enlace = (unidad, apartado, id) => '#/' + unidad + '/guia' + (apartado ? '/' + apartado + (id ? '/' + id : '') : '');
  function marcas(texto) {
    const partes = [], re = /\[\[(a|g):([\w-]+)(?::([\w -]+))?\|([^\]]+)\]\]/g;
    let m, pos = 0;
    while ((m = re.exec(String(texto || '')))) {
      if ((m[1] === 'a') !== !!m[3]) continue;
      partes.push({ texto: texto.slice(pos, m.index) }, { tipo: m[1], clave: m[2], n: m[3], texto: m[4] });
      pos = re.lastIndex;
    }
    partes.push({ texto: String(texto || '').slice(pos) });
    return partes;
  }
  /* ---- Lector de reglamentos: estructura, anclas y relaciones, a partir de data/reglamentos/<id>.json ---- */
  // Ancla citable: art-7 (artículo), art-7.III (fracción), art-7.III.b (inciso). El número puede llevar espacios (1 Bis).
  const anclaArticulo = (n, fr, inciso) => n === 'texto' ? 'texto' : 'art-' + n + (fr ? '.' + fr + (inciso ? '.' + inciso : '') : '');
  const selloReglamento = (titulo, doc) => String(titulo || '').split(/\s+/).filter(p => /^[A-ZÁÉÍÓÚÑ]/.test(p) && !/^(IPN|Instituto|Politécnico|Nacional)$/.test(p)).map(p => p[0]).join('') || doc.toUpperCase();
  function leerAncla(ancla) {
    const m = /^art-([\w -]+?)(?:\.(\w+)(?:\.(\w+))?)?$/.exec(String(ancla || ''));
    return m ? { n: m[1], fr: m[2] || null, inciso: m[3] || null } : null;
  }
  // Árbol de títulos y capítulos según la ubicación de cada artículo; cada nodo guarda los números de artículo que contiene.
  function arbolReglamento(reg) {
    const raizArbol = { titulo: null, hijos: [], articulos: [], orden: [] }, vistos = new Map();
    for (const a of (reg && reg.articulos) || []) {
      let nodo = raizArbol, clave = '';
      for (const u of a.ubicacion || []) {
        clave += '\u0001' + u;
        let hijo = vistos.get(clave);
        if (!hijo) { hijo = { titulo: u, hijos: [], articulos: [], orden: [] }; nodo.hijos.push(hijo); nodo.orden.push({hijo}); vistos.set(clave, hijo); }
        nodo = hijo;
      }
      nodo.articulos.push(a.n);
      nodo.orden.push({n:a.n});
    }
    return raizArbol;
  }
  // El salto explícito prevalece sobre el scroll programático y la hidratación.
  function articuloEnGeometria(filas, borde, fijado) {
    if (fijado != null) return fijado;
    return filas.find(f => f.top >= borde)?.n || filas.at(-1)?.n || null;
  }
  const totalArticulos = nodo => nodo.articulos.length + nodo.hijos.reduce((s, h) => s + totalArticulos(h), 0);
  const numerosNodo = nodo => nodo.orden.flatMap(x => x.hijo ? numerosNodo(x.hijo) : [x.n]);
  function destinoArticulo(reg, consulta) {
    const q = norm(consulta).trim().replace(/^art(?:iculo|\.)?\s*/, '');
    const tr = /^transitorio\s+(\d+|\w+)$/.exec(q);
    if (tr) {
      const a = (reg.transitorios || []).find((x,i) => norm(x.n) === tr[1] || String(i+1) === tr[1]);
      return a ? 'transitorio-' + a.n : null;
    }
    const a = (reg.articulos || []).find(x => norm(x.n).replace(/\s+/g,' ') === q.replace(/\s+/g,' '));
    return a ? anclaArticulo(a.n) : null;
  }
  function etiquetaTitulo(titulo) {
    const texto = titulo.replace(/^(?:t[íi]tulo|cap[íi]tulo|secci[óo]n)\s+(?:(?:d[ée]cim[oa]\s+)?(?:primer[oa]|segund[oa]|tercer[oa]|cuart[oa]|quint[oa]|sext[oa]|s[ée]ptim[oa]|octav[oa]|noven[oa]|d[ée]cim[oa]|[úu]nic[oa])|[IVXLCDM]+|\d+)[.:]?\s*/i, '').trim();
    const normal = texto.toLocaleLowerCase('es').replace(/\bipn\b/g, 'IPN');
    return normal ? normal[0].toLocaleUpperCase('es') + normal.slice(1) : titulo;
  }
  // Respaldo para extracciones antiguas sin clasificación; se compara sin acentos ni mayúsculas.
  function aplicacionTitulo(nodo) {
    if (nodo.aplicacion && nodo.aplicacion !== 'organizacion') return nodo.aplicacion;
    const titulo = norm(etiquetaTitulo(nodo.titulo));
    if (/alumnos|alumnado|estudiantes|aspirantes|becarias|prestadores|ingreso|trayectoria|movilidad|egreso|certificacion|equivalencia|revalidacion|reconsideracion|requisitos|acreditacion|incumplimiento|revocacion|procedimiento disciplinario|examen profesional|expedicion del titulo/.test(titulo)) return 'directo';
    if (/funcion educativa|organos consultivos|modalidades|programas academicos/.test(titulo)) return 'parcial';
    return nodo.aplicacion || 'organizacion';
  }
  // El mapa usa artículos existentes, no la resta de extremos (puede haber artículos Bis).
  function mapaReglamento(reg) {
    return (reg.estructura || []).map(nodo => ({
      titulo: nodo.titulo, etiqueta: etiquetaTitulo(nodo.titulo), aplicacion: aplicacionTitulo(nodo),
      articulos: (reg.articulos || []).filter(a => (a.ubicacion || [])[0] === nodo.titulo).map(a => a.n)
    })).filter(nodo => nodo.articulos.length);
  }
  // Artículos de definiciones («se entenderá por: Término: definición. Otro: …»): un párrafo por término.
  // Regla conservadora: solo tras «por:», con términos que empiezan en mayúscula y no pasan de 80 caracteres sin signos.
  function dividirDefiniciones(texto) {
    const m = /^([\s\S]{0,240}?\bpor:)\s+([\s\S]+)$/.exec(String(texto || ''));
    if (!m) return null;
    const partes = m[2].replace(/([.;])\s+(?=[A-ZÁÉÍÓÚÑ][^.:;•]{0,80}?:\s)/g, '$1\u0001').split('\u0001');
    const definiciones = partes.map(p => /^([A-ZÁÉÍÓÚÑ][^.:;•]{0,79}?):\s+(\S[\s\S]*)$/.exec(p.trim())).map(x => x && { termino: x[1], texto: x[2] });
    return partes.length >= 3 && definiciones.every(Boolean) ? { intro: m[1], definiciones } : null;
  }
  // Un artículo en bloques: texto previo, fracciones (con sus incisos) o definiciones; nada se reescribe, solo se parte.
  function partesArticulo(a) {
    const frs = (a && a.fracciones) || [], texto = String((a && a.texto) || '');
    const inicio = frs.length ? Math.max(...['. ', '.- '].map(sep => texto.indexOf(frs[0].fr + sep + frs[0].texto))) : -1;
    if (inicio >= 0) {
      return { intro: texto.slice(0, inicio).trim(), definiciones: null, fracciones: frs.map(f => {
        const corte = f.incisos && f.incisos.length ? f.texto.indexOf(' ' + f.incisos[0].inciso + ') ') : -1;
        return corte >= 0 ? { fr: f.fr, texto: f.texto.slice(0, corte).trim(), incisos: f.incisos } : { fr: f.fr, texto: f.texto, incisos: [] };
      }) };
    }
    const d = frs.length ? null : dividirDefiniciones(texto);
    return d ? { intro: d.intro, definiciones: d.definiciones, fracciones: [] } : { intro: texto, definiciones: null, fracciones: [] };
  }
  // Parte solo saltos de párrafo existentes y marcadores al inicio de oración; conserva todo el texto.
  function bloquesNormativos(texto) {
    const salida = [];
    const parrafos=String(texto || '').split(/(\n\s*\n+)/);
    for (let i=0;i<parrafos.length;i+=2) {
      const parrafo=parrafos[i], separador=parrafos[i+1]||'';
      const re = /(^\s*|(?<=[.!?;:])\s+)([IVXLCDM]+[.)]|[a-z]\))(\s+)/g;
      let pos = 0, inicioTexto = 0, marca = '', m;
      while ((m = re.exec(parrafo))) {
        const inicio = m.index + m[1].length;
        if (marca) salida.push({ marca, texto: parrafo.slice(inicioTexto, inicio) });
        else if (inicio > pos) salida.push({ marca: '', texto: parrafo.slice(pos, inicio) });
        marca = m[2] + m[3];
        inicioTexto = re.lastIndex;
        pos = re.lastIndex;
      }
      if (pos === 0) salida.push({ marca: '', texto: parrafo });
      else salida.push({ marca, texto: parrafo.slice(inicioTexto) });
      if(separador)salida[salida.length-1].texto+=separador;
    }
    return salida;
  }
  // Artículos que contienen todas las palabras (o cuyo número empieza como lo escrito); primero el número exacto.
  function buscarArticulos(reg, q, maximo) {
    const ts = terminos(q), num = norm(q).trim();
    if (!ts.length) return [];
    const r = [];
    const articulado = reg?.articulos?.length ? reg.articulos : reg?.texto && !reg.sin_texto ? [{n:'texto',texto:reg.texto}] : [];
    for (const a of articulado) {
      const n = norm(a.n), exacto = n === num;
      if (exacto || (/^\d/.test(num) && n.startsWith(num)) || (!/^\d+$/.test(num) && ts.every(w => norm(a.texto + ' ' + (a.ubicacion || []).join(' ')).includes(w)))) r.push({ a, peso: exacto ? 0 : 1 });
    }
    return r.sort((x, y) => x.peso - y.peso).slice(0, maximo || 40).map(x => x.a);
  }
  // Preguntas de la Guía que citan cada artículo (fuente con artículos o marca [[a:doc:n|…]]) y los trámites de SATE a los que remiten.
  const indicesCitas = new WeakMap();
  function citasPorArticulo(d) {
    if (indicesCitas.has(d)) return indicesCitas.get(d);
    const indice = new Map(), marca = /\[\[a:([\w-]+):([\w -]+)\|/g;
    const agregar = (doc, n, p) => { const k = doc + ':' + n, l = indice.get(k) || []; if (!l.includes(p)) l.push(p); indice.set(k, l); };
    for (const p of (d && d.preguntas) || []) {
      for (const f of p.fuentes || []) for (const n of f.arts || []) agregar(f.doc, n, p);
      for (const texto of [p.respuesta, ...(p.pasos || [])]) { marca.lastIndex = 0; let m; while ((m = marca.exec(texto || ''))) agregar(m[1], m[2], p); }
    }
    indicesCitas.set(d, indice);
    return indice;
  }
  function relacionesArticulo(d, doc, n, tramitesUnidad) {
    const preguntas = (d && citasPorArticulo(d).get(doc + ':' + n)) || [], disponibles = tramitesUnidad || [];
    return { preguntas, tramites: [...new Set(preguntas.map(p => p.ventanilla).filter(v => v && disponibles.includes(v)))] };
  }
  raiz.SateGuia = { articuloEnGeometria, norm, terminos, buscarPreguntas, apartadosDisponibles, fuente, enlace, marcas, anclaArticulo, leerAncla, arbolReglamento, partesArticulo, bloquesNormativos, dividirDefiniciones, buscarArticulos, relacionesArticulo, mapaReglamento };
  const nombreMateria = nombre => { const s=String(nombre).toLocaleLowerCase('es'); return s.charAt(0).toLocaleUpperCase('es')+s.slice(1); };
  const textoVisibleIndice = texto => String(texto || '').replace(/\[\[(?:a|g):[\w-]+(?::[\w -]+)?\|([^\]]+)\]\]/g, '$1');
  function puntuarIndice(e, ts, q, orientacion, intencion) {
    if (intencion && e.fuente === 'preguntas' && e.ruta.endsWith('/'+intencion.pregunta)) return 10000;
    const titulo = norm(e.titulo), migas = norm((e.migas || []).join(' ')), frase = norm(q).trim();
    const encabezado = titulo + ' ' + migas;
    const texto = palabrasConsulta([e.titulo, e.texto, ...(e.migas || [])].join(' '), orientacion || {}).join(' ');
    if (!ts.every(w => texto.includes(w))) return 0;
    return (frase && encabezado.includes(frase) ? 10000 : frase && norm(textoVisibleIndice(e.texto)).includes(frase) ? 1000 : 0) + ts.filter(w => titulo.includes(w)).length * 10 + ts.filter(w => migas.includes(w)).length * 3 + ts.length;
  }
  function buscarIndice(entradas, q, opciones = {}) {
    const ts = palabrasConsulta(q, opciones.orientacion || {});
    if (!ts.length) return [];
    const intencion = (opciones.orientacion?.intenciones || []).find(i => i.terminos.every(w => ts.includes(w)));
    return entradas.filter(e => (!opciones.fuente || e.fuente === opciones.fuente) &&
      (!opciones.doc || e.doc === opciones.doc) && (!opciones.carrera || !e.carrera || e.carrera === opciones.carrera) &&
      (!opciones.materia || e.materia === opciones.materia) &&
      (!opciones.apartado || e.ruta.includes('/guia/' + opciones.apartado + '/')))
      .map(e => ({e, peso: puntuarIndice(e, ts, q, opciones.orientacion, intencion)}))
      .filter(x => x.peso).sort((a,b) => b.peso-a.peso).map(x => Object.assign(x.e, {_pesoBusqueda:x.peso}));
  }
  function fragmento(texto, q) {
    texto = textoVisibleIndice(texto);
    const posiciones = terminos(q).map(w => norm(texto).indexOf(w)).filter(i => i >= 0);
    const inicio = Math.max(0, (posiciones.length ? Math.min(...posiciones) : 0) - 65);
    return (inicio ? '…' : '') + texto.slice(inicio, inicio + 220) + (texto.length > inicio + 220 ? '…' : '');
  }
  function expandirIndice(d) {
    const campos = ['titulo','texto','ruta','doc','carrera','carreraNombre','materia','oficial'];
    const valor = v => Array.isArray(v) ? Array.from(d.cadenas[v[0]]).slice(v[1],v[2]).join('') : d.cadenas[v];
    return d.filas.map(f => ({...Object.fromEntries(campos.map((k,i) => [k,valor(f[i])])), migas:f[8].map(i => d.cadenas[i])}));
  }
  Object.assign(raiz.SateGuia, {buscarIndice, fragmento, textoVisibleIndice, expandirIndice, resaltar, partesResaltado, agruparReglamentos, nivelesReglamento});
  const motivoInicial = s => s?.fis?.some(f=>f.veces>=2)?'recursamiento':s?.nDes?'antiguas':s?.adeudos?.length?'ordinario':'';
  Object.assign(raiz.SateGuia, {palabrasConsulta, buscarSoluciones, respuestaDirecta, aplicaPregunta, rutaPersonal, resolverRuta, nombreMateria, motivoInicial});

  const etiquetasInv = ['favor','contra','requisito','plazo'];
  // Recalcula contra los nodos actuales: partir un párrafo o envolver una referencia no desplaza la anotación.
  function segmentosAnotacion(textos,a) {
    if(textos.join('').slice(a.inicio,a.fin)!==a.literal)return null;
    let offset=0, inicio=null, fin=null;
    textos.forEach((texto,i)=>{const limite=offset+texto.length;if(a.inicio>=offset&&a.inicio<limite)inicio=[i,a.inicio-offset];if(a.fin>offset&&a.fin<=limite)fin=[i,a.fin-offset];offset=limite;});
    return inicio&&fin?{inicio,fin}:null;
  }
  // El intercambio no contiene perfil, unidad ni información del SAES. Se reconstruye una lista blanca.
  function validarInvestigacion(d) {
    if (d?.version === 2) {
      if (typeof d.peticion !== 'string' || d.peticion.length > 20000) throw new Error('Petición inválida');
      const base = validarInvestigacion({...d, version:1});
      base.version=2; base.peticion=d.peticion;
      base.marcadores.forEach((m,i)=>{
        const original=d.marcadores[i];
        if (typeof original.nota !== 'string' || original.nota.length>4000 || !tiposNota.includes(original.tipo) || typeof original.inciso !== 'string' || !/^[a-z0-9]*$/i.test(original.inciso) || !(original.huella === '' || /^[a-f0-9]{64}$/.test(original.huella))) throw new Error('Cita inválida');
        if(original.frpos!=null&&(!Number.isSafeInteger(original.frpos)||original.frpos<1||original.frpos>1000))throw new Error('Posición inválida');
        Object.assign(m,{inciso:original.inciso,nota:original.nota,tipo:original.tipo,huella:original.huella,pendienteHuella:original.pendienteHuella===true,...(original.frpos?{frpos:original.frpos}:{})});
      });
      return base;
    }
    const plano = (s,max) => typeof s === 'string' && s.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/.test(s);
    if (!d || d.formato !== 'sate-investigacion' || d.version !== 1 || !plano(d.nombre,120) || !d.nombre.trim() || !['solicitud','queja','propuesta','estudio'].includes(d.proposito) || !plano(d.autor,120) || !Array.isArray(d.etiquetas) || d.etiquetas.length>20 || !d.etiquetas.every(x=>plano(x,40)) || !Array.isArray(d.marcadores) || d.marcadores.length>300) throw new Error('Investigación inválida');
    const marcadores = d.marcadores.map(m => {
      if(!m || !/^[a-z0-9_-]{1,80}$/.test(m.doc) || !plano(m.n,80) || !m.n.trim() || !plano(m.fr,20) || !Array.isArray(m.anotaciones) || m.anotaciones.length>100) throw new Error('Marcador inválido');
      return {doc:m.doc,n:m.n,fr:m.fr,anotaciones:m.anotaciones.map(a=>{
        if(!a || !Number.isSafeInteger(a.inicio) || !Number.isSafeInteger(a.fin) || a.inicio<0 || a.fin<=a.inicio || a.fin>200000 || !plano(a.literal,20000) || a.literal.length!==a.fin-a.inicio || !plano(a.nota,4000) || !etiquetasInv.includes(a.etiqueta)) throw new Error('Anotación inválida');
        return {inicio:a.inicio,fin:a.fin,literal:a.literal,nota:a.nota,etiqueta:a.etiqueta};
      })};
    });
    return {formato:d.formato,version:1,nombre:d.nombre,proposito:d.proposito,autor:d.autor,etiquetas:d.etiquetas.slice(),marcadores};
  }
  function alternarMarcador(p,doc,n,fr='',inciso='',frpos=0) {
    const i=p.marcadores.findIndex(m=>m.doc===doc && m.n===String(n) && m.fr===fr&&(m.inciso||'')===inciso&&(m.frpos||0)===frpos);
    if(i<0) p.marcadores.push({doc,n:String(n),fr,anotaciones:[],...(p.version===2?{inciso,huella:'',nota:'',tipo:'personal',pendienteHuella:true,...(frpos?{frpos}:{})}:{})}); else p.marcadores.splice(i,1);
  }
  const tiposNota = ['personal','hecho','pregunta','verificar'];
  function migrarInvestigacion(d) {
    const p=validarInvestigacion(d);
    if(p.version===2)return p;
    return {...p,version:2,peticion:'',marcadores:p.marcadores.map(m=>({...m,inciso:'',huella:'',nota:'',tipo:'personal',pendienteHuella:true}))};
  }
  // La cita se resuelve siempre desde el dato oficial, nunca desde texto importado.
  function textoCita(reg,m) {
    const a=reg.articulos?.find(a=>String(a.n)===m.n) || (m.n==='texto'?reg:null);
    if(!a)return null;
    if(!m.fr&&!m.inciso)return a.texto;
    const f=m.frpos?a.fracciones?.[m.frpos-1]:a.fracciones?.find(f=>f.fr===m.fr);
    if(f&&f.fr!==m.fr)return null;
    if(!f){
      const bloques=bloquesNormativos(a.texto);
      const fracciones=bloques.map((b,i)=>/^[IVXLCDM]+[.)]/.test(b.marca)?i:-1).filter(i=>i>=0);
      const inicio=m.fr?(m.frpos?fracciones[m.frpos-1]:fracciones.find(i=>bloques[i].marca.replace(/[.)\s]/g,'')===m.fr)):0;
      if(inicio==null)return null;
      if(m.fr&&bloques[inicio].marca.replace(/[.)\s]/g,'')!==m.fr)return null;
      const fin=fracciones.find(i=>i>inicio)??bloques.length;
      const desde=m.inciso?bloques.findIndex((b,i)=>i>=inicio&&i<fin&&b.marca.replace(/[)\s]/g,'')===m.inciso):inicio;
      if(desde<0)return null;
      const hasta=m.inciso?bloques.findIndex((b,i)=>i>desde&&i<fin&&b.marca):fin;
      const limite=hasta<0?fin:hasta;
      return bloques.slice(desde,limite).map((b,i)=>(i?b.marca:'')+b.texto).join('');
    }
    return m.inciso ? f.incisos?.find(i=>i.inciso===m.inciso)?.texto ?? null : f.texto;
  }
  async function huellaCita(texto) {
    const bytes=await raiz.crypto.subtle.digest('SHA-256',new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function revisarInvestigacion(d,cargar,migracion=false) {
    const p=migrarInvestigacion(d);
    for(const m of p.marcadores){
      const texto=textoCita(await cargar(m.doc),m);
      const actual=texto===null?null:await huellaCita(texto);
      if(migracion && !m.huella && actual)m.huella=actual;
      m.pendienteHuella=false;
      m.cambio=!actual || m.huella!==actual;
    }
    return p;
  }
  function moverCita(p,desde,hasta) {
    if(!Number.isInteger(desde)||!Number.isInteger(hasta)||desde<0||hasta<0||desde>=p.marcadores.length||hasta>=p.marcadores.length)return;
    p.marcadores.splice(hasta,0,p.marcadores.splice(desde,1)[0]);
  }
  function editarNota(m,nota,tipo) {
    if(typeof nota!=='string'||nota.length>4000||!tiposNota.includes(tipo))throw new Error('Nota inválida');
    m.nota=nota;m.tipo=tipo;
  }
  async function exportarMarkdownInv(p,cargar,etiqueta,enlace) {
    let md='# '+p.nombre+'\n\n';
    for(const m of p.marcadores){
      const texto=textoCita(await cargar(m.doc),m);
      const estado=texto!==null&&m.huella===await huellaCita(texto)?'sin_cambios':'cambio';
      md+='## '+m.doc.toUpperCase()+' · '+etiqueta('articulo',{n:m.n})+(m.fr?' · '+etiqueta('fraccion',{fr:m.fr}):'')+(m.inciso?' · '+etiqueta('inciso',{inciso:m.inciso}):'')+'\n\n'+etiqueta('oficial')+' · '+etiqueta(estado)+'\n\n'+(texto??etiqueta('no_disponible'))+'\n\n'+etiqueta('huella')+': '+m.huella+'\n\n'+enlace(m)+'\n\n'+etiqueta('propia')+' · '+etiqueta(m.tipo)+'\n\n'+m.nota+'\n\n'+m.anotaciones.map(a=>etiqueta('nota')+' · '+etiqueta(a.etiqueta)+': '+a.nota).join('\n\n')+'\n\n';
    }
    return md+'## '+etiqueta('peticion')+' · '+etiqueta('propia')+'\n\n'+p.peticion;
  }
  Object.assign(raiz.SateGuia,{tiposNota,migrarInvestigacion,textoCita,huellaCita,revisarInvestigacion,moverCita,editarNota,exportarMarkdownInv});
  function fundamentoInv(p, documentos) {
    const grupos = new Map();
    for(const m of p.marcadores) {if(!grupos.has(m.doc)) grupos.set(m.doc,new Set()); grupos.get(m.doc).add(m.n);}
    return Array.from(grupos).sort(([a],[b])=>a.localeCompare(b)).map(([doc,ns])=>({titulo:documentos[doc]?.titulo || doc,numeros:Array.from(ns).sort((a,b)=>a.localeCompare(b,'es',{numeric:true}))}));
  }
  async function codificarInv(p) {
    const bytes = new TextEncoder().encode(JSON.stringify(validarInvestigacion(p)));
    const comprimido = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    return btoa(Array.from(comprimido,x=>String.fromCharCode(x)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  async function enlaceInvestigacion(p,base,ruta) {
    return base.split('#')[0]+ruta+'?inv='+await codificarInv(p);
  }
  function filtrarCitasInv(p,documentos,consulta='',tipo='') {
    const ts=terminos(consulta);
    return p.marcadores.filter(m=>{
      const reg=documentos[m.doc]||{},articulo=reg.articulos?.find(a=>String(a.n)===m.n);
      const texto=norm([m.nota,...m.anotaciones.map(a=>a.nota),articulo?.texto,textoCita(reg,m)].join(' '));
      return (!tipo||m.tipo===tipo)&&ts.every(t=>texto.includes(t));
    });
  }
  const referenciaInv=(m,reg,etiqueta)=>etiqueta('referencia',{n:m.n})+(m.fr?', '+etiqueta('referencia_fraccion',{fr:m.fr}):'')+(m.inciso?', '+etiqueta('inciso',{inciso:m.inciso}):'')+', '+reg.titulo;
  function copiarFundamentoInv(marcadores,documentos,etiqueta,incluirNotas=false) {
    const orden=marcadores.slice().sort((a,b)=>a.doc.localeCompare(b.doc)||a.n.localeCompare(b.n,'es',{numeric:true})||(a.frpos||0)-(b.frpos||0));
    let doc='';
    return orden.map(m=>{
      const reg=documentos[m.doc],texto=textoCita(reg,m);
      const titulo=doc===m.doc?'':reg.titulo+'\n\n';doc=m.doc;
      const notas=[m.nota,...m.anotaciones.map(a=>a.nota)].filter(Boolean);
      return titulo+(texto??etiqueta('no_disponible'))+'\n('+referenciaInv(m,reg,etiqueta)+')'+(incluirNotas&&notas.length?'\n\n'+etiqueta('propia')+': '+notas.join('\n'):'');
    }).join('\n\n');
  }
  const escaparLatexInv=s=>String(s).replace(/[&%$#_{}~^\\]/g,c=>({'~':'\\textasciitilde{}','^':'\\textasciicircum{}','\\':'\\textbackslash{}'}[c]||'\\'+c));
  async function exportarLatexInv(p,cargar,etiqueta) {
    const esc=escaparLatexInv;
    let tex='\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage[spanish]{babel}\n\\begin{document}\n\\section*{'+esc(p.nombre)+'}\n';
    for(const m of p.marcadores){
      const reg=await cargar(m.doc),texto=textoCita(reg,m);
      tex+='\n\\begin{quote}\n'+esc(texto??etiqueta('no_disponible'))+'\n\n'+esc(referenciaInv(m,reg,etiqueta))+'\n\\end{quote}\n';
      const notas=[m.nota,...m.anotaciones.map(a=>a.nota)].filter(Boolean);
      if(notas.length)tex+='\n'+esc(etiqueta('propia'))+': '+notas.map(esc).join('\n\n')+'\n';
    }
    return tex+'\n\\end{document}\n';
  }
  Object.assign(raiz.SateGuia,{enlaceInvestigacion,filtrarCitasInv,copiarFundamentoInv,escaparLatexInv,exportarLatexInv});
  async function decodificarInv(s) {
    if(!/^[\w-]+$/.test(s) || s.length>2000000) throw new Error('Enlace inválido');
    const bytes = Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
    const lector = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate')).getReader();
    let tam=0, partes=[];
    for(;;) {const {done,value}=await lector.read(); if(done) break; tam+=value.length; if(tam>2000000) {await lector.cancel(); throw new Error('Investigación demasiado grande');} partes.push(value);}
    return validarInvestigacion(JSON.parse(await new Blob(partes).text()));
  }
  Object.assign(raiz.SateGuia,{numerosNodo,destinoArticulo,validarInvestigacion,alternarMarcador,fundamentoInv,codificarInv,decodificarInv,segmentosAnotacion});

  if (typeof raiz.SATE === 'undefined' || typeof raiz.SATE_CONFIG === 'undefined' || typeof document === 'undefined') return;

  /* ===================== B. Integración con SATE ===================== */
  const t = (c, v) => SATE.texto(c, v);
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/[^\/]*$/, '');
  const unidad = () => raiz.SATE_UNIDAD;
  const cfg = () => SATE_CONFIG.unidades[unidad()] || {};
  const E = { datos: new Map(), reglamentos: new Map(), partes: new WeakMap(), nombres: new Map() };
  const indicesBusqueda = new Map();
  function cargarBusqueda(archivo) {
    const ruta = 'datos/' + unidad() + '/busqueda/' + archivo;
    if (!indicesBusqueda.has(ruta)) indicesBusqueda.set(ruta, SATE.json(ruta).then(d => archivo === 'indice.json' ? d : expandirIndice(d)).catch(e => {
      indicesBusqueda.delete(ruta); throw e;
    }));
    return indicesBusqueda.get(ruta);
  }
  const bt = (clave, v) => t('sate.guia.busqueda.' + clave, v);
  function parametroGuia(clave) {
    try { return decodeURIComponent((raiz.location.hash.split('?')[1] || '').split('&').find(p => p.startsWith(clave + '='))?.slice(clave.length + 1).replace(/\+/g,' ') || ''); }
    catch(e) { console.warn('SATE: parámetro de Guía inválido', {clave, mensaje:e.message}); return ''; }
  }
  function partesResaltado(texto, q) {
    const rangos = [], ts = terminos(q), posiciones = [];
    let normal = '', original = 0, pos = 0;
    for (const c of texto) {
      const n = norm(c); normal += n;
      for (let i = 0; i < n.length; i++) posiciones.push(original);
      original += c.length;
    }
    while (pos < normal.length) {
      const siguientes = ts.map(w => ({i:normal.indexOf(w, pos), n:w.length})).filter(x => x.i >= 0).sort((a,b) => a.i-b.i);
      const x = siguientes[0];
      if (!x) break;
      const inicioOriginal = posiciones[x.i], finOriginal = posiciones[x.i+x.n] ?? texto.length;
      rangos.push([inicioOriginal,finOriginal]);
      pos = x.i+x.n;
    }
    return rangos;
  }
  function resaltar(texto, q) {
    texto = textoVisibleIndice(texto);
    const nodos = [], rangos = partesResaltado(texto,q);
    let pos = 0;
    for (const [inicio,fin] of rangos) {
      if (inicio > pos) nodos.push(document.createTextNode(texto.slice(pos,inicio)));
      nodos.push(h('mark', {texto:texto.slice(inicio,fin)})); pos=fin;
    }
    if (pos < texto.length) nodos.push(document.createTextNode(texto.slice(pos)));
    return nodos;
  }
  function agruparReglamentos(resultados, q = '', orientacion = {}) {
    const grupos = new Map();
    const ts = palabrasConsulta(q,orientacion);
    for (const e of resultados) { if (!grupos.has(e.doc)) grupos.set(e.doc, []); grupos.get(e.doc).push(e); }
    return [...grupos].map(([doc, entradas]) => {
      const articulos = entradas.filter(e => /\/art-|\/texto(?:\?|$)/.test(e.ruta || '') && ts.every(w => palabrasConsulta(e.texto,orientacion).join(' ').includes(w)));
      const porArticulo = new Map();
      for(const e of articulos){const clave=e.ruta.split('?')[0].split('/art-')[1]?.split('.')[0] || 'texto';if(!porArticulo.has(clave))porArticulo.set(clave,e);}
      return {doc, entradas:articulos.length ? [...porArticulo.values()] : entradas, titulo:entradas[0].titulo,
        articulos:porArticulo.size};
    }).sort((a,b) => Number(b.articulos > 0)-Number(a.articulos > 0) ||
      (a.articulos && b.articulos ? Number(b.doc === 'rge')-Number(a.doc === 'rge') : 0) ||
      b.articulos-a.articulos || Math.max(...b.entradas.map(e=>e._pesoBusqueda||0))-Math.max(...a.entradas.map(e=>e._pesoBusqueda||0)) || b.entradas.length-a.entradas.length);
  }
  function nivelesReglamento(reg) {
    const ubicaciones = (reg?.articulos || []).flatMap(a => a.ubicacion || []);
    const patrones = [/^t[íi]tulo\b/i, /^cap[íi]tulo\b/i, /^secci[óo]n\b/i];
    return ['titulos','capitulos','secciones'].map((nivel,i) => ({nivel,cantidad:new Set(ubicaciones.filter(x => patrones[i].test(x)).map(x => x.trim())).size})).filter(x => x.cantidad);
  }
  function buscadorIndice(op = {}) {
    let version = 0, temporizador, carrera = op.carrera || '', manifiesto;
    const panel = h('div', {'class':'guia-busqueda-unica'});
    const etiqueta = op.nombre ? bt('en', {nombre:op.nombre}) : bt('global');
    const entrada = h('input', {type:'search', id:op.nombre ? null : 'guia-q', 'aria-label':etiqueta, placeholder:op.marcador||bt('marcador')});
    entrada.addEventListener('keydown',async e=>{if(e.key==='Enter' && op.doc){const destino=destinoArticulo(await cargarReglamento(op.doc),entrada.value);if(destino){e.preventDefault();raiz.location.hash=rutaReglamento(op.doc,destino);}}});
    const lista = h('div', {'class':'guia-busqueda-grupos', 'aria-live':'polite'});
    const filtros = h('div', {'class':'guia-chips'});
    const todos = h('a', {href:rutaGuia(), texto:bt('toda')});
    todos.addEventListener('click', () => { todos.setAttribute('href',rutaGuia() + '?q=' + encodeURIComponent(entrada.value)); });
    panel.append(h('label', {}, [h('span', {texto:etiqueta}), h('div', {'class':'guia-busqueda-campo'}, [iconoRuta('buscar'), entrada])]), ...(op.nombre ? [todos] : []), filtros, ...(op.antes ? [op.antes] : []), lista);
    op.alEntrada?.(entrada);
    async function pintar() {
      if (panel.isConnected === false) return;
      const mi = ++version, q = entrada.value.trim(), u = unidad();
      if (!op.nombre && raiz.history?.replaceState) raiz.history.replaceState(null,'',rutaGuia() + (q ? '?q='+encodeURIComponent(q) : ''));
      if (op.destino) op.destino.hidden = !!q;
      lista.replaceChildren();
      Promise.resolve(op.alPintar?.(q)).catch(e=>console.warn('SATE: respuesta directa no disponible',{unidad:u,consulta:q,mensaje:e.message,pila:e.stack}));
      if (!terminos(q).length) return;
      lista.appendChild(h('p', {role:'status', texto:bt('cargando')}));
      try {
        if(op.doc && /^(?:art(?:iculo|\.)?\s*\d|transitorio\s)/i.test(norm(q))) {
          const destino=destinoArticulo(await cargarReglamento(op.doc),q);
          if(destino && mi===version){lista.replaceChildren(h('a',{href:rutaReglamento(op.doc,destino),texto:q}));return;}
        }
        manifiesto = await cargarBusqueda('indice.json');
        if (mi !== version || u !== unidad()) return;
        if (!op.carrera && !filtros.children.length && (!op.fuente || op.fuente === 'programas')) {
          const letra = typeof ALUMNO !== 'undefined' && ALUMNO && typeof carreraPerfil === 'function' ? carreraPerfil(ALUMNO) : null;
          const perfil = Object.keys(manifiesto.carreras).find(k => manifiesto.letras?.[k] === letra), cs = Object.entries(manifiesto.carreras);
          if (!op.carrera && perfil) carrera=perfil;
          const selector = h('select', {'aria-label':bt('carrera')}, [...(perfil ? [h('option', {value:perfil, texto:bt('tu_carrera',{nombre:manifiesto.carreras[perfil]})})] : []), h('option', {value:'', texto:bt('todas')}), ...cs.filter(([id])=>id!==perfil).map(([id,n]) => h('option', {value:id, texto:n}))]);
          selector.value = carrera;
          selector.addEventListener('change', () => { carrera = selector.value; pintar(); });
          filtros.appendChild(h('label', {}, [bt('carrera'), selector]));
        }
        const fuentes = Object.keys(manifiesto.fuentes).filter(f => !op.fuente || f === op.fuente);
        const bloques = await Promise.all(fuentes.map(async fuente => {
          const partes = manifiesto.fuentes[fuente].partes.filter(p => !(fuente === 'reglamentos' && op.doc && p.clave !== op.doc) && !(fuente === 'programas' && carrera && p.clave !== carrera));
          const entradas = (await Promise.all(partes.map(p => cargarBusqueda(p.archivo)))).flat();
          for (const e of entradas) e.fuente=fuente;
          const resultados = buscarIndice(entradas, q, {...op, carrera, orientacion:manifiesto.orientacion});
          return {fuente, resultados};
        }));
        if (mi !== version || u !== unidad()) return;
        lista.replaceChildren();
        let total = 0;
        for (const {fuente, resultados} of bloques) {
          if (!resultados.length) continue;
          total += resultados.length;
          const grupo = h('section', {}, [h('h3', {texto:bt(fuente) + ' · ' + resultados.length})]);
          const nombres = new Map();
          for (const e of resultados) if (e.carrera) {
            const k = norm(e.titulo), cs = nombres.get(k) || new Set(); cs.add(e.carrera); nombres.set(k, cs);
          }
          const fila = (e, agrupada = false) => h('li', {'class':'guia-resultado'}, [
            h('a', {href:e.ruta}, resaltar(agrupada && e.doc ? e.migas.filter(m=>/^Art\. /.test(m)).join(' · ') + (/\/art-[^.]+\./.test(e.ruta) ? bt('fraccion',{fr:e.migas.at(-1)}) : '') || e.titulo : e.titulo,q)),
            ...(e.carrera ? [h('strong', {'class':'guia-carrera', texto:e.carreraNombre}), ...(nombres.get(norm(e.titulo))?.size > 1 ? [h('small', {texto:bt('homonima')})] : [])] : []),
            h('small', {texto:(agrupada && e.doc ? e.migas.filter((m,i) => !(i === 0 && norm(m) === norm(e.titulo))) : e.migas).join(' › ')}),
            h('p', {'data-oficial':e.oficial}, resaltar(fragmento(e.texto,q),q))
          ]);
          const conjuntos = new Map();
          for (const e of resultados) {
            const clave = fuente === 'programas' ? norm(e.titulo) : e.ruta;
            if (!conjuntos.has(clave)) conjuntos.set(clave, []);
            conjuntos.get(clave).push(e);
          }
          const filas = [...conjuntos.values()].map(es => es.length === 1 ? fila(es[0]) : h('li', {'class':'guia-resultados-agrupados'}, [
            h('strong', {texto:es[0].titulo}),
            ...(new Set(es.map(e=>e.carrera)).size > 1 ? [h('small',{texto:bt('homonima')})] : []),
            h('ul', {}, es.map(fila))
          ]));
          if (fuente === 'reglamentos') {
            const docs = agruparReglamentos(resultados,q,manifiesto.orientacion);
            grupo.querySelector('h3').textContent=bt(fuente)+' · '+docs.length;
            grupo.appendChild(h('div', {'class':'guia-reglamentos-resultados'}, docs.map(g => h('section', {'class':'guia-reglamento-resultado'}, [
              h('header', {}, [h('strong', {'class':'guia-sello', texto:selloReglamento(g.titulo,g.doc)}), h('h4', {texto:g.titulo,'data-oficial':g.doc}), h('small',{texto:g.articulos ? bt('articulos_reglamento',{n:g.articulos}) : bt('solo_titulo')})]),
              ...(g.articulos ? [h('ul', {}, g.entradas.slice(0,2).map(e => fila(e,true)))] : []),
              h('a', {href:rutaReglamento(g.doc)+'?q='+encodeURIComponent(q), texto:g.articulos ? bt('ver_reglamento_acotado',{n:g.articulos}) : bt('abrir_reglamento')})
            ]))));
            lista.appendChild(grupo);
            continue;
          }
          grupo.appendChild(h('ul', {}, filas.slice(0, 6)));
          if (filas.length > 6) grupo.appendChild(h('details', {}, [h('summary', {texto:bt('ver', {n:filas.length})}), h('ul', {}, filas.slice(6))]));
          lista.appendChild(grupo);
        }
        if (!total) lista.appendChild(h('p', {role:'status', texto:t('sate.guia.sin_resultados_preguntas')}));
      } catch(e) {
        if (mi !== version) return;
        console.warn('SATE: índice de Guía no disponible', {unidad:u, consulta:q, fuente:op.fuente, mensaje:e.message});
        const reintentar = h('button', {type:'button', texto:t('sate.guia.reintentar')});
        reintentar.addEventListener('click', pintar);
        lista.replaceChildren(h('p', {role:'alert', texto:t('sate.guia.error_datos')}), reintentar);
      }
    }
    entrada.addEventListener('input', () => { ++version; clearTimeout(temporizador); temporizador = setTimeout(pintar, 140); });
    entrada.addEventListener('keydown', e => {
      const enlaces = lista.querySelectorAll('a[href]');
      if (e.key === 'Escape') { entrada.value=''; pintar(); entrada.focus(); e.preventDefault(); }
      else if (e.key === 'ArrowDown' && enlaces.length) { enlaces[0].focus(); e.preventDefault(); }
      else if (e.key === 'Enter' && enlaces.length) { raiz.location.hash=enlaces[0].getAttribute('href'); e.preventDefault(); }
    });
    const q = parametroGuia('q');
    if (q) { entrada.value=q; setTimeout(pintar,0); }
    return panel;
  }
  function h(etiqueta, atributos, hijos) {
    const n = document.createElement(etiqueta);
    for (const k in atributos || {}) {
      const v = atributos[k];
      if (v == null || v === false) continue;
      if (k === 'texto') n.textContent = v; else n.setAttribute(k, v === true ? '' : v);
    }
    for (const x of hijos || []) if (x) n.appendChild(typeof x === 'string' ? document.createTextNode(x) : x);
    const origen = atributos?.['data-oficial'] || (typeof atributos?.texto === 'string' && E.nombres.get(atributos.texto));
    if (origen) SateUI.oficial(n, origen);
    return n;
  }
  function cargarCss() {
    if (!BASE || !document.head) return;
    for (const archivo of ['guia.css', 'actividades.css', 'temarios.css', '../policore/lector.css']) {
      const href = BASE + archivo;
      if ([...document.querySelectorAll('link[data-tmr-css]')].some(l => l.getAttribute('href') === href)) continue;
      document.head.appendChild(h('link', { rel: 'stylesheet', href, 'data-tmr-css': '' }));
    }
  }
  cargarCss();

  function datos(seccion = '') {
    const u = unidad();
    if (seccion) {
      const campos = seccion === 'acudir' ? ['acudir','organigrama'] : seccion === 'actividades' ? ['preguntas','actividades'] : ['preguntas'];
      return Promise.all([datos(), ...campos.map(c => {
        const clave = u + '/' + c;
        if (!E.datos.has(clave)) E.datos.set(clave, (SATE.json ? SATE.json('datos/' + u + '/guia/' + c + '.json') : fetch('datos/' + u + '/guia/' + c + '.json').then(r => {
          if (!r.ok) throw new Error(c + ': HTTP ' + r.status); return r.json();
        })).catch(e => { E.datos.delete(clave); throw e; }));
        return E.datos.get(clave);
      })]).then(([indice, ...fragmentos]) => Object.assign({}, indice, ...fragmentos));
    }
    if (E.datos.has(u)) return E.datos.get(u);
    const promesa = (SATE.json ? SATE.json('datos/' + u + '/guia/indice.json') : fetch('datos/' + u + '/guia/indice.json').then(r => {
      if (!r.ok) throw new Error('datos/' + unidad() + '/guia/indice.json: HTTP ' + r.status);
      return r.json();
    })).then(d => {
      E.nombres.clear();
      for (const a of d.acudir || []) if (a.nombre && a.fuente?.doc && !a.pendiente) E.nombres.set(a.nombre, a.fuente.doc);
      for (const [id, doc] of Object.entries(d.documentos || {})) E.nombres.set(doc.titulo, id);
      return d;
    }).catch(e => { E.datos.delete(u); throw e; });
    E.datos.set(u, promesa);
    return promesa;
  }
  function cargarReglamento(doc) {
    if (!/^[\w-]+$/.test(doc)) return Promise.reject(new Error('Documento inválido: ' + doc));
    if (!E.reglamentos.has(doc)) E.reglamentos.set(doc, (SATE.json ? SATE.json('datos/reglamentos/' + doc + '.json') : fetch('datos/reglamentos/' + doc + '.json').then(r => {
      if (!r.ok) throw new Error('Reglamento ' + doc + ': HTTP ' + r.status);
      return r.json();
    })).then(reg => {
      if (reg.titulo) E.nombres.set(reg.titulo, doc);
      for (const a of reg.articulos || []) for (const titulo of a.ubicacion || []) E.nombres.set(titulo, doc);
      return reg;
    }).catch(e => { E.reglamentos.delete(doc); throw e; }));
    return E.reglamentos.get(doc);
  }
  function botonArticulo(doc, n, texto) {
    const b = h('button', { type: 'button', 'class': 'sate-enlace-reglamento', texto });
    b.addEventListener('click', () => SATE.articulo(doc, n));
    return b;
  }
  function cargarReferencias() {
    if (!E.referencias) E.referencias = (SATE.json ? SATE.json('datos/referencias.json') : fetch('datos/referencias.json').then(r => {
      if (!r.ok) throw new Error('Referencias: HTTP ' + r.status);
      return r.json();
    })).catch(e => {
      E.referencias = null;
      console.warn('SATE: referencias no disponibles', {mensaje:e.message});
      return [];
    });
    return E.referencias.then(rs => { E.enlaces = Array.isArray(rs) ? rs : []; return E.enlaces; });
  }
  function envolverReferencias(nodo, doc, a) {
    const refs = (E.enlaces || []).filter(r => r.doc === doc && r.articulo === String(a.n));
    for (const p of nodo.querySelectorAll('p,dt,dd,.rgl-renglon__texto')) {
      const texto = p.textContent, partes = []; let inicio = 0;
      const origen = a.texto.indexOf(texto);
      const ocurrencias = refs.map(r => ({r, i:Array.from(a.texto).slice(0,r.inicio).join('').length-origen}))
        .filter(x => origen >= 0 && x.i >= 0 && texto.slice(x.i,x.i+x.r.texto.length) === x.r.texto).sort((a,b) => a.i-b.i);
      for (const {r,i} of ocurrencias) {
        if (i < inicio) continue;
        partes.push(document.createTextNode(texto.slice(inicio,i)));
        const b = h('button', {type:'button', 'class':'sate-enlace-reglamento', texto:texto.slice(i,i+r.texto.length)});
        SateUI.oficial(b,doc);
        b.addEventListener('click', () => SATE.articulo(r.destino,r.n,r.fr));
        partes.push(b); inicio = i+r.texto.length;
      }
      if (partes.length) p.replaceChildren(...partes, document.createTextNode(texto.slice(inicio)));
    }
    return nodo;
  }
  function enLinea(texto, d) {
    const partes = marcas(String(texto || '').replace(/\{unidad\}/g, () => cfg().siglas || unidad()));
    return partes.map((p, i) => {
      if (!p.tipo && i && partes[i - 1].tipo === 'a' && p.texto.startsWith(').')) return document.createTextNode(p.texto.slice(2));
      if (p.tipo === 'a') {
        const siguiente = partes[i + 1];
        if (siguiente && !siguiente.tipo && siguiente.texto.startsWith(').')) return h('span', { 'class': 'sate-cita-reglamento' }, [botonArticulo(p.clave, p.n, p.texto), document.createTextNode(').')]);
        return botonArticulo(p.clave, p.n, p.texto);
      }
      if (p.tipo === 'g' && d.glosario?.[p.clave]) {
        const g = d.glosario[p.clave];
        return SateUI.definicion(p.texto, g.termino, g.definicion);
      }
      return document.createTextNode(p.texto);
    });
  }
  function cuerpoArticulo(a, doc, fila, literal = false) {
    const textoEnBloques = texto => bloquesNormativos(texto).map(x => x.marca
      ? h('div', {'class':'rgl-renglon rgl-renglon--marcado '+(/[IVXLCDM]/.test(x.marca[0])?'rgl-renglon--fraccion':'rgl-renglon--inciso'), 'data-oficial':doc}, [
        h('span', {'class':'rgl-renglon__marca', 'data-oficial':doc, texto:x.marca}),
        h('span', {'class':'rgl-renglon__texto', 'data-oficial':doc, texto:x.texto})
      ])
      : h('p', {'class':'guia-articulo-literal', 'data-oficial':doc, texto:x.texto}));
    if(literal) return h('div', {'class':'pc-lector pc-oficial', 'data-oficial':doc}, textoEnBloques(a.texto));
    if (!E.partes.has(a)) E.partes.set(a, partesArticulo(a));
    const p = E.partes.get(a), nodos = [];
    if (p.intro) nodos.push(...textoEnBloques(p.intro));
    if (p.definiciones) nodos.push(h('dl', { 'class': 'rgl-definiciones', 'data-oficial':doc }, p.definiciones.map(x => h('div', {}, [h('dt', { texto: x.termino }), h('dd', { texto: x.texto })]))));
    if (p.fracciones.length) nodos.push(h('ol', { 'class': 'rgl-fracciones' }, p.fracciones.map(f => fila('rgl-fr', f.fr + '.', anclaArticulo(a.n, f.fr), t('sate.guia.rgl_enlace_fraccion', { fr: f.fr }), [
      ...textoEnBloques(f.texto),
      f.incisos.length ? h('ol', { 'class': 'rgl-incisos' }, f.incisos.map(x => fila('rgl-inc', x.inciso + ')', anclaArticulo(a.n, f.fr, x.inciso), t('sate.guia.rgl_enlace_inciso', { inciso: x.inciso }), textoEnBloques(x.texto)))) : null]))));
    const cuerpo = h('div', { 'class': 'rgl-cuerpo pc-lector pc-oficial' }, nodos);
    cuerpo.querySelectorAll('.rgl-fr').forEach((n,i) => {
      n.setAttribute('data-fraccion-pos',i+1);
      if (p.fracciones.filter(f=>f.fr===p.fracciones[i].fr).length > 1) {
        const enlace = n.querySelector('a');
        const href=enlace.getAttribute('href');
        enlace.setAttribute('href',href+(href.includes('?')?'&':'?')+'frpos='+(i+1));
      }
    });
    envolverReferencias(cuerpo, doc, a);
    if(!p.fracciones.length){
      let fr='',pos=0;
      for(const nodo of cuerpo.querySelectorAll('.rgl-renglon--marcado')){
        const marca=nodo.querySelector('.rgl-renglon__marca').textContent.replace(/[.)\s]/g,'');
        const inciso=/^[a-z]$/.test(marca)?marca:'';
        if(!inciso){fr=marca;pos++;}
        nodo.removeAttribute('data-oficial');
        nodo.setAttribute('data-ancla',anclaArticulo(a.n,fr,inciso));
        if(!inciso)nodo.setAttribute('data-fraccion-pos',pos);
        const zona=h('div',{'class':'inv-fraccion'},[botonGuardarInv(doc,a.n,fr,inciso,pos)]);
        nodo.appendChild(zona);
      }
    }
    for(const nodo of cuerpo.querySelectorAll('.rgl-fr,.rgl-inc')){
      const ancla=nodo.getAttribute('data-ancla');
      const cita=leerAncla(ancla);
      if(!cita)continue;
      const frpos=nodo.closest('.rgl-fr')?.getAttribute('data-fraccion-pos');
      const repetida=p.fracciones.filter(f=>f.fr===cita.fr).length>1;
      const zona=h('div',{'class':'inv-fraccion'},[botonGuardarInv(doc,a.n,cita.fr||'',cita.inciso||'',repetida?Number(frpos):0)]);
      Array.from(nodo.children).find(n=>n.tagName==='DIV').appendChild(zona);
    }
    estadoMarcadoresInv();
    return cuerpo;
  }
  SATE.articulo = async function (doc, n, fr) {
    // La lectura literal también funciona desde otra vista si no se pudo cargar la Guía.
    const d = await datos().catch(e => {
      console.warn('SATE: metadatos del artículo no disponibles', { doc, n, mensaje: e.message });
      return {};
    }), meta = d.documentos?.[doc] || {};
    let reg, error;
    try { [reg] = await Promise.all([cargarReglamento(doc), cargarReferencias()]); } catch (e) {
      error = e;
      console.warn('SATE: artículo no disponible', { doc, n, mensaje: e.message });
    }
    const a = !reg?.sin_texto && reg?.articulos?.find(x => String(x.n) === String(n));
    const cuerpo = h('div', { 'class': 'guia-articulo' }, a ? [
      h('p', { texto: (a.ubicacion || []).join(' · ') }),
      cuerpoArticulo(a,doc,null,true)
    ] : [h('p', { role: 'status', texto: t(error ? 'sate.guia.error_articulo' : 'sate.guia.sin_articulo') })]);
    if (a) {
      const literal = cuerpo.querySelector('.guia-articulo-literal');
      const f = a.fracciones?.find(f => f.fr === fr), i = f ? a.texto.indexOf(f.texto) : -1;
      envolverReferencias(cuerpo,doc,a);
      if (i >= 0) literal.replaceChildren(h('span', {'class':'guia-cita-atenuada', texto:a.texto.slice(0,i)}), h('mark', {texto:a.texto.slice(i,i+f.texto.length)}), h('span', {'class':'guia-cita-atenuada', texto:a.texto.slice(i+f.texto.length)}));
      SateUI.oficial(literal,doc);
    }
    if (a && reg.ocr) cuerpo.appendChild(h('p', { 'class': 'guia-aviso-ocr', texto: t('sate.guia.aviso_ocr') }));
    cuerpo.insertBefore(h('strong', {'class':'guia-sello', texto:selloReglamento(reg?.titulo,doc)}), cuerpo.firstChild);
    const leer = h('a', { href: rutaReglamento(doc, anclaArticulo(n,fr)), texto:bt('abrir_reglamento') });
    leer.addEventListener('click', () => SateUI.cerrarModal());
    cuerpo.appendChild(leer);
    if(a)cuerpo.appendChild(botonGuardarInv(doc,n,fr||''));
    const url = reg?.url || meta.url;
    if (url) cuerpo.appendChild(enlaceExterno('', url, t('sate.guia.pdf_oficial')));
    return SateUI.modal(t('sate.guia.articulo_titulo', { n, reglamento: reg?.titulo || meta.titulo || doc }), cuerpo, {lectura:true, flotante:true});
  };
  const apartados = () => apartadosDisponibles(SATE_CONFIG.guia, cfg());
  const infoApartado = id => (SATE_CONFIG.guia || []).find(a => a.id === id);
  const tituloApartado = id => t(infoApartado(id).titulo);
  const rutaGuia = (...p) => enlace(unidad(), ...p);
  const rutaReglamento = (doc, ancla) => rutaGuia('reglamentos', doc) + (ancla ? '/' + encodeURIComponent(ancla) : '');
  const sufijoInvestigacion = () => parametroGuia('inv') ? '?inv='+parametroGuia('inv') : parametroGuia('arts') ? '?arts='+encodeURIComponent(parametroGuia('arts')) : '';
  const fechaRevision = d => { try { return new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { dateStyle: 'long' }); } catch (e) { return d; } };

  function cabecera(migas, titulo, intro) {
    document.title = titulo + ' — ' + t('sate.pestana.guia.titulo');
    const hh = h('h2', { texto: titulo, tabindex: '-1' });
    return { nodo: h('header', { 'class': 'guia-cab' }, [SateUI.migas(migas), hh, intro ? h('p', { 'class': 'tmr-intro', texto: intro }) : null]), titulo: hh };
  }
  const migasBase = () => [{ texto: t('sate.pestana.guia.titulo'), href: rutaGuia() }];
  function enlaceExterno(clase, href, texto) {
    return h('a', { 'class': clase, href, target: '_blank', rel: 'noopener noreferrer', texto: texto + ' ↗' });
  }
  const conteo = (apartado, d) => {
    const a = infoApartado(apartado);
    if (a.datos === 'actividades') return t('sate.guia.actividades_detalle');
    if (a.datos === 'documentos') return t('sate.guia.detalle_documentos', { n: Object.values(d.documentos).filter(x => x.reglamento).length });
    if (a.datos === 'acudir') return t('sate.guia.detalle_instancias', { n: d.acudir.length });
    return t('sate.guia.detalle_preguntas', { n: d.preguntas.filter(p => p.apartado === apartado).length });
  };

  /* ---------- portada ---------- */
  const tx = (k, v) => t('sate.guia.nueva.' + k, v);
  const situacion = () => typeof situacionDatos === 'function' ? situacionDatos() : null;
  const nombreDe = f => nombreMateria(typeof cur==='function'?cur()[f.k]?.[0]||f.k:f.k);
  const vecesDe = f => tx(f.veces===1?'una_vez':'veces',{clave:nombreDe(f),n:f.veces??tx('sin_dato')});
  function motivoMateria(f) {
    return f.veces>=2 ? vecesDe(f) : f.estado==='desfasada' ? tx('materia_desfasada',{materia:nombreDe(f)}) : tx('materia_adeudada',{materia:nombreDe(f)});
  }
  function aplicaDetalle(p,s,d) {
    const regla=d.orientacion.aplicabilidad[p.id];
    const fis=regla==='dictamen'?(s.rd?.des||[]):s.fis||[];
    return fis.filter(f=>regla==='recursamiento'?f.veces>=2:regla==='desfase'?f.estado==='desfasada':true).map(motivoMateria).join(' · ');
  }
  const preguntasRuta = (d, r) => d.preguntas.filter(p => r.preguntas.includes(p.id));
  const enlacePregunta = p => h('a', { href: rutaGuia(p.apartado, p.id), texto: p.pregunta });
  function iconoRuta(id) {
    const caminos = {nuevo:'M3 8l9-5 9 5-9 5-9-5 M7 11v5c3 3 7 3 10 0v-5', irregular:'M4 20h16 M5 16l5-6 4 3 5-8 M15 5h4v4', aprovecha:'M12 3l3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1z', salida:'M5 22V3h13l-3 5 3 5H5'};
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [k,v] of Object.entries({viewBox:'0 0 24 24',width:'24',height:'24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'})) svg.setAttribute(k,v);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', id==='buscar'?'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0':caminos[id]); svg.appendChild(p);
    return svg;
  }
  function tarjetaSolucion(d, p, s, rotulo) {
    const acciones=h('div',{'class':'guia-acciones'}), tramites=cfg().tramites||[];
    const tramite=tramites.includes(p.ventanilla)?p.ventanilla:null;
    if(tramite)acciones.appendChild(SateUI.tarjetaNav({href:'#/'+unidad()+'/tramites/'+tramite,titulo:t('sate.guia.en_ventanilla'),detalle:t('sate.tramite.'+tramite+'.titulo'),compacta:true}));
    else {
      const r=d.orientacion.rutas.find(r=>r.preguntas.includes(p.id));
      if(r)acciones.appendChild(SateUI.tarjetaNav({href:rutaGuia('ruta',r.id),titulo:tx('ver_toca'),detalle:tx(r.id),compacta:true}));
    }
    const area=d.acudir.find(a=>p.acudir?.includes(a.id));
    if(area){const a=SateUI.tarjetaNav({href:rutaGuia('acudir',area.id),titulo:area.nombre,detalle:t('sate.guia.a_quien'),compacta:true});SateUI.oficial(a.querySelector('.sate-tarjeta-nav__titulo'),area.fuente?.doc);acciones.appendChild(a);}
    if(cfg().vistas?.some(v=>v.id==='temarios') && s?.adeudos?.length)acciones.appendChild(SateUI.tarjetaNav({href:rutaGuia('programas'),titulo:tx('temarios'),compacta:true}));
    const formato=p.formato && (p.formato.url||d.documentos[p.formato.doc]?.url);
    return h('article', {'class':'guia-solucion'}, [h('small', {'class':'guia-rotulo',texto:tx(rotulo)}), h('h3', {texto:p.pregunta}),
      aplicaPregunta(p,s,d.orientacion) && aplicaDetalle(p,s,d) ? h('p', {'class':'guia-aplica',texto:aplicaDetalle(p,s,d)}) : null,
      h('p',{'class':'guia-respuesta'},enLinea(p.respuesta,d)),
      (p.pasos||[]).length?h('section',{},[h('h4',{texto:t('sate.guia.que_hacer')}),h('ol',{'class':'guia-pasos'},p.pasos.map(paso=>h('li',{},[h('span',{},enLinea(paso,d))])))]):null,
      formato?enlaceExterno('guia-formato',formato,p.formato.texto||t('sate.guia.formato_titulo')):null,
      acciones,
      h('footer',{'class':'guia-fuentes'},(p.fuentes||[]).map(f=>fuente(d,f,t)).filter(Boolean).map(f=>h('div',{},[enlaceExterno('',f.url,f.texto),...f.arts.map(n=>botonArticulo(f.doc,n,t('sate.guia.articulo_rotulo',{n})))])))]);
  }
  function gruposBusqueda(d, q, preguntas) {
    const o=d.orientacion, ts=palabrasConsulta(q,o), coincide=texto=>ts.some(w=>palabrasConsulta(texto,o).join(' ').includes(w));
    const grupos=[['preguntas',preguntas.slice(0,6).map(enlacePregunta)],
      ['formatos',preguntas.filter(p=>p.formato || cfg().tramites?.includes(p.ventanilla)).slice(0,4).map(p=>h('a',{href:p.ventanilla && cfg().tramites?.includes(p.ventanilla)?'#/'+unidad()+'/tramites/'+p.ventanilla:rutaGuia(p.apartado,p.id),texto:p.formato?.texto || t('sate.tramite.'+p.ventanilla+'.titulo')}))],
      ['reglamento',Object.entries(d.documentos).filter(([,doc])=>doc.reglamento).filter(([id,doc])=>coincide(doc.titulo+' '+doc.resumen)||preguntas.slice(0,3).some(p=>p.fuentes?.some(f=>f.doc===id))).slice(0,4).map(([id,doc])=>h('a',{href:rutaReglamento(id),texto:doc.titulo,'data-oficial':id}))],
      ['areas',d.acudir.filter(a=>coincide(a.nombre+' '+a.para)||preguntas.slice(0,3).some(p=>p.acudir?.includes(a.id))).slice(0,4).map(a=>h('a',{href:rutaGuia('acudir',a.id),texto:a.nombre}))]];
    return h('aside',{'class':'guia-grupos'},grupos.map(([id,links])=>h('section',{},[h('h3',{texto:tx(id)}),h('ul',{},links.length?links.map(a=>h('li',{},[a])):[h('li',{texto:tx('sin_coincidencias')})])])));
  }
  // Portada aprobada (maqueta R15): título, buscador global con ejemplos en voz de alumno, chips y respuesta directa arriba de los grupos.
  function buscadorSoluciones(d, s, destino) {
    const directa=h('div',{'class':'guia-respuesta-directa'});
    let versionDirecta=0;
    const pintarDirecta=async q=>{
      const mi=++versionDirecta, u=unidad();
      if (q.trim()) d = await datos('preguntas');
      if (mi!==versionDirecta || u!==unidad()) return;
      const r=respuestaDirecta(d,q);
      directa.replaceChildren();
      if (!r.definiciones.length) {
        if(r.pregunta)directa.appendChild(tarjetaSolucion(d,r.pregunta,s,'respuesta_directa'));
        return;
      }
      try {
        const secciones=await Promise.all(r.definiciones.map(async g=>{
          const citas=await Promise.all((g.definicionFuentes || [g.fuente]).filter(Boolean).map(async f=>{
            const reg=await cargarReglamento(f.doc);
            return (f.arts || []).flatMap(n=>{
              const a=reg.articulos?.find(a=>String(a.n)===String(n));
              if(!a)return [];
              const p=partesArticulo(a), rotulo=t('sate.guia.fuente_articulo',{documento:reg.titulo,articulo:n});
              const cita=(texto,fr)=>{
                const b=h('button',{type:'button','class':'sate-enlace-reglamento',texto:rotulo+(fr?bt('fraccion',{fr}):'')});
                b.addEventListener('click',()=>SATE.articulo(f.doc,n,fr));
                return h('div',{},[h('blockquote',{'data-oficial':f.doc,texto}),b]);
              };
              if(!a.fracciones?.length)return [cita(a.texto)];
              const completa=h('details',{'class':'guia-definicion-fracciones'},[
                h('summary',{texto:tx('fracciones_completas',{n:a.fracciones.length})}),
                h('div',{},a.fracciones.map(fr=>cita(fr.texto,fr.fr)))
              ]);
              return [cita(p.intro),completa];
            });
          }));
          const areas=(d.acudir || []).filter(a=>(g.acudir || [g.id]).includes(a.id));
          return h('section',{},[h('h4',{texto:g.termino}),h('p',{texto:g.definicion}),...citas.flat(),
            ...areas.map(a=>h('a',{href:rutaGuia('acudir',a.id)},[t('sate.guia.a_quien')+' · ',h('span',{'data-oficial':a.fuente?.doc,texto:a.nombre})]))]);
        }));
        if(mi===versionDirecta && u===unidad() && directa.isConnected!==false)directa.appendChild(h('article',{'class':'guia-definicion'},[h('small',{'class':'guia-rotulo',texto:tx('respuesta_directa')}),h('h3',{texto:bt('que_es')}),...secciones]));
      } catch(e) { console.warn('SATE: definición directa no disponible',{unidad:u,consulta:q,mensaje:e.message}); }
    };
    let entrada=null;
    const chips=h('div',{'class':'guia-chips guia-sugerencias'});
    const sugerencias=s?.adeudos?.length?['reprobe el recurse','ets','baja temporal','servicio social','ingles titulacion']:['baja temporal','servicio social','ingles titulacion','becas','ets'];
    for(const q of sugerencias){const b=h('button',{type:'button',texto:tx('chip_'+q.replaceAll(' ','_'))});b.addEventListener('click',()=>{if(!entrada)return;entrada.value=q;entrada.dispatchEvent(new Event('input'));entrada.focus();});chips.appendChild(b);}
    const panel=buscadorIndice({destino,alPintar:pintarDirecta,antes:h('div',{'class':'guia-hero-extra'},[chips,directa]),marcador:tx('marcador'),alEntrada:e=>{entrada=e;}});
    const cab=h('section',{'class':'guia-hero'},[h('h2',{texto:tx('resolver'),tabindex:'-1'}),panel]);
    return {cab, resultados:h('div')};
  }
  function portadaNueva(raizGuia,d) {
    const s=situacion(), elegida=rutaPersonal(s), contenido=h('div',{'class':'guia-inicio'});
    document.title=t('sate.pestana.guia.titulo')+' — '+(SATE_CONFIG.unidades[unidad()]?.siglas || unidad().toUpperCase());
    const buscador=buscadorSoluciones(d,s,contenido);
    raizGuia.classList.add('guia-nueva');
    raizGuia.appendChild(buscador.cab);raizGuia.appendChild(contenido);
    if(s){
      const proxima=SATE.calendario?.proximos?.(Infinity)?.find(e=>!e.personal) || SATE.calendario?.recorte('guia')?.[0];
      const ets=s.adeudos.length?SATE.calendario?.proximos?.(1,['ets','inscripcion_ets'])?.[0]:null;
      contenido.appendChild(h('section',{'class':'guia-hoy','aria-label':tx('hoy')},[
        h('a',{href:rutaGuia('ruta',elegida),texto:t('sate.puentes.ruta')+' ›'}),
        ets?h('a',{href:'#/'+unidad()+'/calendario',title:ets.titulo},[h('strong',{texto:t('sate.puentes.ets')+' · '}),h('time',{'data-oficial':'calendario',datetime:ets.desde,texto:fechaRevision(ets.desde)}),document.createTextNode(' ›')]):null,
        proxima?h('a',{href:'#/'+unidad()+'/calendario',title:proxima.titulo},[h('strong',{texto:t('sate.puentes.fecha')+' · '}),h('time',{'data-oficial':'calendario',datetime:proxima.desde,texto:fechaRevision(proxima.desde)}),document.createTextNode(' ›')]):null]));
    }
    const rutas=d.orientacion.rutas;
    contenido.appendChild(h('section',{'class':'guia-rutas-seccion'},[h('h3',{texto:tx('empieza')}),h('div',{'class':'guia-rutas'},rutas.map(r=>{
      const ps=preguntasRuta(d,r), formatos=new Set([...r.tramites.filter(id=>cfg().tramites?.includes(id)),...ps.filter(p=>p.formato).map(p=>p.ventanilla||p.formato.ref||p.formato.url||p.id)]), n=ps.filter(p=>aplicaPregunta(p,s,d.orientacion)).length;
      return h('a',{href:rutaGuia('ruta',r.id),'class':'guia-ruta-tarjeta','data-ruta':r.id,'aria-current':elegida===r.id?'true':null},[
        h('div',{'class':'guia-ruta-titulo'},[iconoRuta(r.id),h('h4',{texto:tx(r.id)}),s&&elegida===r.id?h('small',{'class':'guia-aplica',texto:tx('tu_situacion')}):null]),
        h('p',{texto:tx(r.id+'_detalle')}),h('ul',{},[...r.consultas.map(id=>ps.find(p=>p.id===id)).filter(Boolean).slice(0,3).map(p=>h('li',{texto:p.pregunta})),...(r.muestrasActividades||[]).map(c=>h('li',{texto:tx('muestra_'+c)}))]),
        h('small',{texto:tx('conteo',{n:ps.length})+(formatos.size?' · '+tx(formatos.size===1?'un_formato':'n_formatos',{n:formatos.size}):'')+(n?' · '+tx('aplican',{n}):'')+(r.actividades && d.actividades?' · '+t('sate.guia.actividades_resultados',{n:d.actividades.total ?? d.actividades.secciones.reduce((n,s)=>n+s.items.length,0)}):'')})]);
    }))]));
    contenido.appendChild(h('section',{'class':'guia-consulta'},[h('h3',{texto:tx('consulta')}),h('div',{},['reglamentos','acudir','programas','tramites'].filter(id=>apartados().some(a=>a.id===id)).map(id=>h('a',{href:rutaGuia(id)},[h('strong',{texto:id==='tramites'?tx('formatos'):tituloApartado(id)}),h('small',{texto:t(infoApartado(id).descripcion)})])))]));
    return buscador.cab.querySelector('h2');
  }

  function rutaGuiada(raizGuia,d,id) {
    const r=d.orientacion.rutas.find(x=>x.id===id);
    if(!r)return portadaNueva(raizGuia,d);
    raizGuia.classList.add('guia-nueva');
    const s=situacion(), ps=preguntasRuta(d,r), cab=cabecera([...migasBase(),{texto:tx(r.id)}],tx(r.id),tx(r.id+'_detalle'));
    raizGuia.appendChild(cab.nodo);
    if(r.actividades && d.actividades){
      cab.nodo.insertBefore(h('p',{'class':'guia-catalogo-etapa',texto:t('sate.guia.actividades_etapa',{n:r.etapas.join(', ')})}),cab.titulo);
      raizGuia.appendChild(catalogoActividades(d,{categorias:r.actividades,preguntas:ps}));
      return cab.titulo;
    }
    const preguntas=h('div',{'class':'guia-opciones'}), panel=h('section',{'class':'guia-toca','aria-live':'polite','aria-label':tx('lo_toca')}), mas=h('section',{'class':'guia-mas'});
    const fis=s?.fis||[], estado={motivo:motivoInicial(s),materia:(fis.find(f=>f.veces>=2)||fis.find(f=>f.estado==='desfasada')||fis[0])?.k||'',dictamen:'desconocido',tema:ps[0]?.id||''};
    const dibujar=()=>{
      const accion=id==='irregular'?resolverRuta(s,estado):estado.tema;
      const p=ps.find(p=>p.id===accion);
      panel.replaceChildren(h('strong',{'class':'guia-rotulo',texto:tx('lo_toca')}));
      if(p){
        if(estado.consulta==='areas') panel.appendChild(h('ul',{},(p.acudir||[]).map(id=>d.acudir.find(a=>a.id===id)).filter(Boolean).map(a=>h('li',{},[h('a',{href:rutaGuia('acudir',a.id),texto:a.nombre})]))));
        else if(estado.consulta==='reglamento') panel.appendChild(h('ul',{},(p.fuentes||[]).map(f=>fuente(d,f,t)).filter(Boolean).map(f=>h('li',{},[h('a',{href:rutaReglamento(f.doc),texto:f.texto}),...f.arts.map(n=>botonArticulo(f.doc,n,t('sate.guia.articulo_rotulo',{n})))]))));
        else if(accion==='formato-dictamen') {
          panel.appendChild(h('h3',{texto:tx('pedir_dictamen')}));
          for(const f of s.rd?.des||fis.filter(f=>f.estado==='desfasada'||f.veces>=2)) panel.appendChild(h('p',{'class':'guia-motivo',texto:motivoMateria(f)}));
          const area=d.acudir.find(a=>a.id==='gestion_escolar'), filas=h('dl',{'class':'guia-toca-datos'});
          const fila=(etiqueta,nodo)=>filas.appendChild(h('div',{},[h('dt',{texto:etiqueta}),h('dd',{},[nodo])]));
          const fecha=typeof calItems==='function'?calItems()?.items.find(a=>a.para==='dictamen'&&!a.pasada):null;
          fila(tx('fecha_limite'),fecha?h('span',{},[h('span',{'data-oficial':'calendario',texto:fecha.titulo||fecha.texto}),h('time',{'data-oficial':'calendario',datetime:fecha.hasta||fecha.desde,texto:fechaRevision(fecha.hasta||fecha.desde)})]):h('span',{texto:tx('fecha_confirmar')}));
          fila(tx('formato'),cfg().tramites?.includes('dictamen')?h('a',{href:'#/'+unidad()+'/tramites/dictamen',texto:t('sate.tramite.dictamen.titulo')}):h('span',{texto:t('sate.tramite.dictamen.titulo')}));
          fila(tx('entrega'),area?h('a',{href:rutaGuia('acudir',area.id),texto:area.nombre,'data-oficial':area.fuente?.doc}):h('span',{texto:tx('entrega_confirmar')}));
          panel.appendChild(filas);
          if(cfg().tramites?.includes('dictamen'))panel.appendChild(h('a',{'class':'guia-toca-principal',href:'#/'+unidad()+'/tramites/dictamen',texto:tx('llenar_dictamen')}));
          panel.appendChild(enlacePregunta(p));
          if(cfg().vistas?.some(v=>v.id==='temarios'))panel.appendChild(h('a',{href:rutaGuia('programas'),texto:tx('temarios')}));
        } else panel.appendChild(tarjetaSolucion(d,p,s,'orientacion'));
        const calendario=typeof calItems==='function'?calItems():null;
        const fecha=p.ventanilla==='dictamen'?calendario?.items.find(a=>a.para==='dictamen'&&!a.pasada):null;
        if(fecha && accion!=='formato-dictamen')panel.appendChild(h('p',{},[h('strong',{texto:tx('fecha_limite')+' '}),document.createTextNode(fecha.titulo+' · '),h('time',{'data-oficial':'calendario',datetime:fecha.hasta||fecha.desde,texto:fechaRevision(fecha.hasta||fecha.desde)})]));
      } else {panel.appendChild(h('p',{texto:tx('sin_regla')}));panel.appendChild(h('ul',{},ps.filter(p=>['que-es-dictamen','veces-cursar-materia','oportunidades-reprobar','baja-temporal'].includes(p.id)).map(p=>h('li',{},[enlacePregunta(p)]))));}
    };
    function opciones(clave,titulo,items){
      const controles=h('div',{'class':'guia-chips'}), campo=h('fieldset',{},[h('legend',{texto:titulo}),controles]);
      for(const [valor,texto] of items){const b=h('button',{type:'button','aria-pressed':estado[clave]===valor?'true':'false',texto});b.addEventListener('click',()=>{estado[clave]=valor;for(const otro of controles.children)otro.setAttribute('aria-pressed',otro===b?'true':'false');dibujar();console.debug('SATE: orientación de Guía',{ruta:id,campo:clave,opcion:valor,accion:id==='irregular'?resolverRuta(s,estado):estado.tema});});controles.appendChild(b);}
      preguntas.appendChild(campo);
    }
    if(id==='irregular'){
      opciones('motivo',tx('que_paso'),['ordinario','recursamiento','antiguas','pausa'].map(k=>[k,tx(k)]));
      if(fis.length)opciones('materia',tx('que_materia'),fis.map(f=>[f.k,vecesDe(f)]));
      else preguntas.appendChild(h('p',{texto:tx('sin_kardex')}));
      opciones('dictamen',tx('dictamen_vigente'),['si','no','desconocido'].map(k=>[k,tx(k)]));
    } else {
      opciones('tema',tx('que_necesitas'),ps.map(p=>[p.id,p.pregunta]));
      opciones('consulta',tx('que_consultar'),['preguntas','reglamento','areas'].map(k=>[k,tx(k)]));
    }
    raizGuia.appendChild(h('div',{'class':'guia-ruta-panel'},[preguntas,panel]));
    mas.appendChild(h('h3',{texto:tx('mas')}));
    for(const etapa of d.etapas.filter(e=>ps.some(p=>p.etapa===e.id))){const deEtapa=ps.filter(p=>p.etapa===etapa.id);mas.appendChild(h('section',{},[h('h4',{texto:t(etapa.titulo)}),h('ul',{},deEtapa.map(p=>h('li',{},[enlacePregunta(p)])))]));}
    for(const tramite of r.tramites.filter(x=>cfg().tramites?.includes(x)))mas.appendChild(h('a',{href:'#/'+unidad()+'/tramites/'+tramite,texto:t('sate.tramite.'+tramite+'.titulo')}));
    raizGuia.appendChild(mas);dibujar();
    return cab.titulo;
  }
  function buscadorGlobal(d) {
    const lista = h('ul', { 'class': 'guia-resultados', id: 'guia-res', hidden: true });
    const aviso = h('p', { 'class': 'sate-sr', role: 'status', 'aria-live': 'polite' });
    let primero = null;
    const buscar = SateUI.buscador({ etiqueta: t('sate.guia.buscar_guia_etiqueta'), marcador: t('sate.guia.buscar_guia_marcador'), id: 'guia-q', alCambiar: pintar,
      alEnviar: () => { if (primero) raiz.location.hash = primero.getAttribute('href'); } });
    function pintar() {
      const q = buscar.entrada.value;
      primero = null;
      if (!terminos(q).length) { lista.hidden = true; lista.replaceChildren(); aviso.textContent = ''; return; }
      const r = buscarPreguntas(d.preguntas, q);
      lista.hidden = false;
      lista.replaceChildren(...(r.length ? r.slice(0, 8).map(p => {
        const a = h('a', { 'class': 'guia-resultado', href: rutaGuia(p.apartado, p.id) }, [h('span', { texto: p.pregunta }), h('small', { texto: tituloApartado(p.apartado) })]);
        primero ||= a;
        return h('li', {}, [a]);
      }) : [h('li', { 'class': 'guia-vacio', texto: t('sate.guia.sin_resultados_preguntas') })]));
      aviso.textContent = t('sate.guia.resultados_preguntas', { n: r.length });
    }
    return h('section', { 'class': 'guia-buscar', 'aria-label': t('sate.guia.buscar_guia_etiqueta') }, [
      h('label', { 'for': 'guia-q', texto: t('sate.guia.buscar_guia_etiqueta') }), buscar.raiz, aviso, lista]);
  }
  function tarjetasApartados(d) {
    return h('ul', { 'class': 'sate-tarjetas-nav', 'aria-label': t('sate.guia.apartados_etiqueta') }, apartados().map(a => {
      const detalle = a.vista ? t(a.descripcion) : t('sate.guia.tarjeta_detalle', { descripcion: t(a.descripcion), conteo: conteo(a.id, d) });
      return h('li', {}, [SateUI.tarjetaNav({ href: rutaGuia(a.id), titulo: t(a.titulo), detalle, icono: a.icono })]);
    }));
  }
  function seccionProximamente() {
    const resto = (SATE_CONFIG.guia || []).filter(a => a.pronto && a.descripcion && t(a.descripcion).trim());
    if (!resto.length) return null;
    return h('section', { 'class': 'guia-pronto', 'aria-label': t('sate.guia.proximamente') }, [
      h('h3', { texto: t('sate.guia.proximamente') }),
      h('ul', {}, resto.map(a => h('li', {}, [h('span', { 'aria-hidden': 'true', texto: a.icono }), h('span', {}, [h('strong', { texto: t(a.titulo) }), h('small', { texto: t(a.descripcion) })])])))]);
  }
  async function portada(raizGuia) {
    if(cfg().guiaDatos){const d=await datos();if(d.orientacion)return portadaNueva(raizGuia,d);}
    const cab = h('header', { 'class': 'guia-cab' }, [h('h2', { texto: t('sate.pestana.guia.titulo'), tabindex: '-1' }), h('p', { 'class': 'tmr-intro', texto: t('sate.guia.intro') })]);
    raizGuia.appendChild(cab);
    const pronto = seccionProximamente();
    if (!cfg().guiaDatos) {
      // Sin datos de la Guía (otra unidad): solo lo que tenga, como los programas de estudio.
      const lista = apartados();
      raizGuia.appendChild(lista.length
        ? h('ul', { 'class': 'sate-tarjetas-nav', 'aria-label': t('sate.guia.apartados_etiqueta') }, lista.map(a => h('li', {}, [SateUI.tarjetaNav({ href: rutaGuia(a.id), titulo: t(a.titulo), detalle: t(a.descripcion), icono: a.icono })])))
        : h('p', { 'class': 'tmr-vacio', texto: t('sate.guia.sin_datos') }));
      if (pronto) raizGuia.appendChild(pronto);
      return cab.querySelector('h2');
    }
    const d = await datos();
    raizGuia.appendChild(buscadorGlobal(d));
    raizGuia.appendChild(tarjetasApartados(d));
    raizGuia.appendChild(h('p', { 'class': 'tmr-nota', texto: t('sate.guia.nota_fuentes') }));
    if (pronto) raizGuia.appendChild(pronto);
    return cab.querySelector('h2');
  }

  /* ---------- una respuesta ---------- */
  function respuesta(d, p) {
    const acudir = (p.acudir || []).map(id => d.acudir.find(a => a.id === id)).filter(Boolean);
    const formato = p.formato ? (p.formato.url ? p.formato : p.formato.doc ? { texto: p.formato.texto, url: d.documentos[p.formato.doc]?.url } : null) : null;
    const tramite = p.ventanilla && cfg().tramites && cfg().tramites.includes(p.ventanilla) ? p.ventanilla : null;
    const fuentes = (p.fuentes || []).map(f => fuente(d, f, t)).filter(Boolean);
    const partes = [
      h('p', { 'class': 'guia-respuesta' }, enLinea(p.respuesta, d)),
      (p.pasos || []).length ? h('section', { 'class': 'guia-bloque' }, [h('h4', { texto: t('sate.guia.que_hacer') }), h('ol', { 'class': 'guia-pasos' }, p.pasos.map(x => h('li', {}, [h('span', {}, enLinea(x, d))])))]) : null,
      acudir.length ? h('section', { 'class': 'guia-bloque' }, [h('h4', { texto: t('sate.guia.a_quien') }), h('ul', { 'class': 'guia-acudir' }, acudir.map(a => h('li', {}, [h('a', { href: rutaGuia('acudir', a.id), texto: a.nombre })])))]) : null,
      formato && formato.url || tramite ? h('section', { 'class': 'guia-bloque guia-acciones' }, [
        tramite ? SateUI.tarjetaNav({ href: '#/' + unidad() + '/tramites/' + tramite, titulo: t('sate.guia.en_ventanilla'), detalle: t('sate.tramite.' + tramite + '.titulo'), compacta: true }) : null,
        formato && formato.url ? SateUI.tarjetaNav({ href: formato.url, titulo: t('sate.guia.formato_titulo'), detalle: formato.texto, externo: true, compacta: true }) : null]) : null,
      h('footer', { 'class': 'guia-pie' }, [
        h('strong', { texto: t('sate.guia.fuentes_titulo', { n: fuentes.length }) }),
        h('ul', { 'class': 'guia-fuentes' }, fuentes.map(f => h('li', {}, [enlaceExterno('', f.url, f.texto), ...f.arts.map(n => botonArticulo(f.doc, n, t('sate.guia.articulo_rotulo', { n })))]))),
        h('span', { texto: t('sate.guia.revisado', { fecha: fechaRevision(d.revisado) }) })])
    ];
    const frag = document.createDocumentFragment();
    for (const x of partes) if (x) frag.appendChild(x);
    return frag;
  }

  /* ---------- apartado de preguntas ---------- */
  function apartadoPreguntas(raizGuia, d, apartado, abrirId) {
    const todas = d.preguntas.filter(p => p.apartado === apartado);
    const etapas = d.etapas || [];
    const cab = cabecera([...migasBase(), { texto: tituloApartado(apartado) }], tituloApartado(apartado), t('sate.guia.' + apartado + '_intro'));
    let etapa = todas.find(p => p.id === abrirId)?.etapa || etapas[0]?.id, elegido = abrirId;
    const pista = h('ol', { 'class': 'guia-etapas' });
    const panel = h('div', { 'class': 'guia-panel' });
    const buscar = SateUI.buscador({ etiqueta: t('sate.guia.buscar_apartado_etiqueta'), marcador: t('sate.guia.buscar_apartado_marcador'), id: 'guia-qa', alCambiar: () => { elegido = null; pintar(); } });
    function pintar() {
      const consulta = terminos(buscar.entrada.value).length;
      const visibles = consulta ? buscarPreguntas(todas, buscar.entrada.value) : todas.filter(p => !etapas.length || p.etapa === etapa);
      const ancho = raiz.matchMedia('(min-width:900px)').matches;
      if (!visibles.some(p => p.id === elegido)) elegido = ancho ? visibles[0]?.id : null;
      pista.replaceChildren(...etapas.map((e, i) => {
        const habilitada = todas.some(p => p.etapa === e.id);
        const b = h('button', { type: 'button', disabled: !habilitada, 'aria-current': e.id === etapa && !consulta ? 'step' : null, 'aria-label': t(e.titulo), title: t(e.titulo) }, [h('span', { 'class': 'guia-etapa-num', texto: String(i + 1) }), h('span', { 'class': 'guia-etapa-nombre', texto: t(e.titulo) })]);
        b.addEventListener('click', () => { etapa = e.id; elegido = null; buscar.entrada.value = ''; pintar(); pista.querySelector('[aria-current]')?.focus({ preventScroll: true }); });
        return h('li', {}, [b]);
      }));
      const lista = h('ul', { 'class': 'guia-preguntas-etapa' });
      const detalle = h('div', { 'class': 'guia-detalle' });
      for (const p of visibles) {
        const activo = elegido === p.id;
        const b = h('button', { type: 'button', 'class': 'guia-elegir', 'data-pregunta': p.id, 'aria-expanded': String(activo), 'aria-controls': 'respuesta-' + p.id, texto: p.pregunta });
        b.addEventListener('click', () => {
          elegido = activo && !ancho ? null : p.id;
          history.replaceState(null, '', rutaGuia(apartado, elegido));
          pintar();
          panel.querySelector('[data-pregunta="' + p.id + '"]')?.focus({ preventScroll: true });
        });
        const li = h('li', {}, [b]);
        if (activo) {
          document.title = p.pregunta + ' — ' + t('sate.pestana.guia.titulo');
          const contenido = h('article', { id: 'respuesta-' + p.id, 'class': 'guia-detalle' }, [h('h3', { texto: p.pregunta }), respuesta(d, p)]);
          (ancho ? detalle : li).appendChild(contenido);
        } else li.appendChild(h('div', { id: 'respuesta-' + p.id, hidden: true }));
        lista.appendChild(li);
      }
      const tituloEtapa = consulta ? t('sate.guia.buscar_apartado_etiqueta') : t(etapas.find(e => e.id === etapa)?.titulo || 'sate.guia.buscar_apartado_etiqueta');
      const titulo = h('h3', {}, [document.createTextNode(tituloEtapa), document.createTextNode(' · ' + t('sate.guia.detalle_preguntas', { n: visibles.length }))]);
      panel.replaceChildren(h('section', {}, [titulo, lista]), detalle);
    }
    const cambio = () => pintar();
    const mq = raiz.matchMedia('(min-width:900px)');
    mq.addEventListener?.('change', cambio);
    limpiarLector = () => mq.removeEventListener?.('change', cambio);
    raizGuia.append(cab.nodo, h('div', { 'class': 'guia-apartado' }, [buscar.raiz, pista, panel]));
    pintar();
    return { titulo: cab.titulo };
  }

  /* ---------- reglamentos ---------- */
  let limpiarLector = null;
  const apagarLector = () => { if (limpiarLector) { limpiarLector(); limpiarLector = null; } };
  const pantallaChica = () => !!(raiz.matchMedia && raiz.matchMedia('(max-width:768.98px)').matches);
  function copiarEnlace(href) {
    const url = new URL(href, raiz.location.href).href;
    if (raiz.navigator?.clipboard?.writeText) return raiz.navigator.clipboard.writeText(url);
    return Promise.reject(new Error('Sin portapapeles'));
  }
  let investigacionCompartida = null;
  const claveInv = () => 'hu.' + unidad() + '.investigaciones';
  function leerInvestigaciones() {
    if(!raiz.localStorage)return {activa:0,proyectos:[]};
    try {const v=JSON.parse(raiz.localStorage.getItem(claveInv()) || '{"activa":0,"proyectos":[]}'); return {version:2,activa:Math.max(0,Math.min(Number(v.activa)||0,v.proyectos.length-1)),proyectos:v.proyectos.map(migrarInvestigacion)};} catch(e) {console.warn('SATE investigaciones: almacenamiento inválido',e.message); return {activa:0,proyectos:[]};}
  }
  function guardarInvestigaciones(v) {v.version=2; if(raiz.IPNT.set(claveInv(),JSON.stringify(v))===false)throw new Error('Almacenamiento no disponible');}
  const ti = (k,v) => t('sate.guia.inv_'+k,v);
  function botonInv(k,fn) {const b=h('button',{type:'button','class':'btn',texto:ti(k)}); b.addEventListener('click',fn); return b;}
  function botonGuardarInv(doc,n,fr='',inciso='',frpos=0) {
    const b=botonInv('guardar',()=>!investigacionCompartida?guardarArticuloInv(doc,n,fr,inciso,frpos).catch(errorInv):undefined);
    for(const [k,v] of Object.entries({doc,n,fr,inciso,frpos}))b.setAttribute('data-guardar-'+k,v);
    return b;
  }
  function errorInv(e) {
    console.warn('SATE investigación',{unidad:unidad(),ruta:raiz.location.hash,mensaje:e.message});
    const aviso=h('p',{role:'alert',texto:ti('error')});
    (document.querySelector('.rgl-investigacion__cuerpo')||document.getElementById('sate-guia')).appendChild(aviso);
  }
  function estadoMarcadoresInv() {
    const p=investigacionVisible();
    for(const b of document.querySelectorAll('[data-guardar-doc]')){
      const doc=b.getAttribute('data-guardar-doc'),n=b.getAttribute('data-guardar-n'),fr=b.getAttribute('data-guardar-fr'),inciso=b.getAttribute('data-guardar-inciso')||'';
      const frpos=Number(b.getAttribute('data-guardar-frpos'))||0;
      const m=p?.marcadores.find(m=>m.doc===doc&&m.n===n&&m.fr===fr&&(m.inciso||'')===inciso&&(m.frpos||0)===frpos);
      const cantidad=!fr?new Set(p?.marcadores.filter(m=>m.doc===doc&&m.n===n&&m.fr).map(m=>m.fr+':'+(m.frpos||0))||[]).size:0;
      b.hidden=!!investigacionCompartida;b.setAttribute('aria-pressed',String(!!m||!!cantidad));
      b.textContent=cantidad?ti('fracciones_guardadas',{n:cantidad}):ti(m?'guardado':'guardar');
      b.setAttribute('aria-label',b.textContent);b.setAttribute('title',b.textContent);
      const zona=b.closest('.inv-fraccion');
      if(zona){
        const editor=zona.querySelector('.inv-nota');
        // La hidratación de otros artículos no debe quitar el foco ni la selección de escritura.
        if(!investigacionCompartida&&editor&&m&&editor.querySelector('textarea')?.value===m.nota&&editor.getAttribute('data-tipo')===m.tipo)continue;
        editor?.remove();
        if(m)zona.appendChild(investigacionCompartida?notaCompartida(m):editorNota(m,()=>{
          const actual=leerInvestigaciones(),c=actual.proyectos[actual.activa]?.marcadores.find(x=>claveCita(x)===claveCita(m));
          if(c){editarNota(c,m.nota,m.tipo);guardarInvestigaciones(actual);raiz.dispatchEvent(new Event('sate-investigacion-nota'));}
        }));
      }
    }
    for(const estado of document.querySelectorAll('[data-resumen-articulo]')){
      const citas=p?.marcadores.filter(m=>m.doc===estado.getAttribute('data-resumen-doc')&&m.n===estado.getAttribute('data-resumen-articulo'))||[];
      const n=new Set(citas.filter(m=>m.fr).map(m=>m.fr+':'+(m.frpos||0))).size;
      estado.textContent=n?ti('fracciones_guardadas',{n}):citas.length?ti('guardado'):'';
    }
  }
  const claveCita=m=>[m.doc,m.n,m.fr,m.inciso||'',m.frpos||0].join(':');
  function nuevaInv(nombre) {return migrarInvestigacion({formato:'sate-investigacion',version:1,nombre,proposito:'estudio',autor:'',etiquetas:[],marcadores:[]});}
  async function guardarArticuloInv(doc,n,fr='',inciso='',frpos=0) {
    const v=leerInvestigaciones();
    if(!v.proyectos.length){v.proyectos.push(nuevaInv(ti('nombre_inicial')));v.activa=0;}
    const p=v.proyectos[v.activa],m={doc,n:String(n),fr,inciso,anotaciones:[],nota:'',tipo:'personal',huella:'',...(frpos?{frpos}:{})};
    const i=p.marcadores.findIndex(x=>claveCita(x)===claveCita(m));
    if(i>=0)p.marcadores.splice(i,1);
    else {const texto=textoCita(await cargarReglamento(doc),m);if(texto===null)throw new Error('Cita no encontrada: '+claveCita(m));m.huella=await huellaCita(texto);p.marcadores.push(m);}
    guardarInvestigaciones(v);raiz.dispatchEvent(new Event('sate-investigacion'));estadoMarcadoresInv();
  }
  function editorNota(m,guardar,plegable=false) {
    const zona=h('div',{'class':'inv-nota','data-tipo':m.tipo}),grupo=h('div',{'class':'guia-chips',role:'group','aria-label':ti('tipo')});
    for(const tipo of tiposNota){
      const b=botonInv(tipo,()=>{m.tipo=tipo;zona.setAttribute('data-tipo',tipo);for(const x of grupo.children)x.setAttribute('aria-pressed',String(x===b));try{guardar();}catch(e){errorInv(e);}});
      b.setAttribute('aria-pressed',String(m.tipo===tipo));grupo.appendChild(b);
    }
    const entrada=h('textarea',{'aria-label':ti('propia'),maxlength:4000,rows:3});entrada.value=m.nota;
    entrada.addEventListener('input',()=>{m.nota=entrada.value;try{guardar();}catch(e){errorInv(e);}});
    if(plegable){
      const lectura=h('p',{'class':'inv-nota__texto',texto:m.nota||ti('sin_nota')}),etiqueta=h('summary',{texto:ti(m.tipo)});
      const editor=h('details',{'class':'inv-nota__editor'},[etiqueta,grupo,entrada]);
      entrada.addEventListener('input',()=>{lectura.textContent=m.nota||ti('sin_nota');});
      grupo.addEventListener('click',()=>{etiqueta.textContent=ti(m.tipo);});
      zona.append(h('strong',{texto:ti('propia')}),lectura,editor);
    }else zona.append(h('strong',{texto:ti('propia')}),grupo,entrada);
    return zona;
  }
  function campoInv(etiqueta,valor,max,aceptar,cancelar) {
    const caja=h('div',{'class':'inv-campo'}),entrada=h('input',{type:'text',maxlength:max,'aria-label':etiqueta});entrada.value=valor;
    entrada.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();aceptar(entrada.value);}else if(e.key==='Escape'){e.preventDefault();cancelar();}});
    caja.append(entrada,botonInv('aceptar',()=>aceptar(entrada.value)),botonInv('cancelar',cancelar));
    raiz.setTimeout?.(()=>entrada.focus?.(),0);return caja;
  }
  const rotuloCita=m=>m.doc.toUpperCase()+' · '+ti('articulo',{n:m.n})+(m.fr?', '+ti('fraccion',{fr:m.fr}):'')+(m.inciso?', '+ti('inciso',{inciso:m.inciso}):'');
  const notasDe=p=>p.marcadores.reduce((s,m)=>s+(m.nota?1:0)+m.anotaciones.filter(a=>a.nota).length,0);
  function investigacionVisible() {
    if(investigacionCompartida)return investigacionCompartida;
    const v=leerInvestigaciones();return v.proyectos[v.activa];
  }
  function notaCompartida(m) {
    return h('div',{'class':'inv-nota','data-tipo':m.tipo},[h('strong',{texto:ti('propia')+' · '+ti(m.tipo)}),h('p',{texto:m.nota||ti('sin_nota')})]);
  }
  function sinInvestigacionCompartida(ruta) {
    const [base,consulta='']=ruta.split('?'),params=consulta.split('&').filter(p=>{
      const clave=p.slice(0,p.indexOf('=')<0?p.length:p.indexOf('=')).replace(/\+/g,' ');
      try { return !['inv','arts'].includes(decodeURIComponent(clave)); }
      catch(e) { return true; }
    });
    return base+(params.length?'?'+params.join('&'):'');
  }
  function salirInvestigacionCompartida() {
    investigacionCompartida=null;
    regresoInv=sinInvestigacionCompartida(regresoInv);
    raiz.location.hash=sinInvestigacionCompartida(raiz.location.hash);
  }
  let regresoInv='';
  const versionesPanelInv=new WeakMap();
  function menuAccionesInv(acciones) {
    const menu=h('details',{'class':'inv-acciones'}),resumen=h('summary',{'aria-label':ti('acciones_proyecto'),title:ti('acciones_proyecto'),texto:'⋯'});
    menu.append(resumen,h('div',{'class':'inv-menu'},acciones));
    menu.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.open=false;resumen.focus?.();}});
    return menu;
  }
  function documentoInvestigacion(p,documentos,cambios) {
    const doc=h('article',{'class':'inv-documento','aria-label':p.nombre},[h('h2',{texto:p.nombre})]);
    if(p.autor)doc.appendChild(h('p',{texto:p.autor}));
    for(const m of p.marcadores){
      const oficial=textoCita(documentos[m.doc],m),bloque=h('section',{'class':'inv-documento__cita'});
      bloque.append(h('p',{'class':'inv-documento__referencia',texto:rotuloCita(m)+' · '+documentos[m.doc].titulo}),h('blockquote',{'data-oficial':oficial===null?null:m.doc,texto:oficial??ti('no_disponible')}));
      if(cambios.has(m))bloque.appendChild(h('p',{'class':'inv-cambio',texto:ti('cambio')}));
      if(m.nota)bloque.appendChild(h('p',{'class':'inv-documento__nota',texto:ti(m.tipo)+' · '+m.nota}));
      for(const a of m.anotaciones)if(a.nota)bloque.appendChild(h('p',{'class':'inv-documento__nota',texto:ti(a.etiqueta)+' · '+a.nota}));
      doc.appendChild(bloque);
    }
    if(p.peticion)doc.append(h('h3',{texto:ti('peticion')}),h('p',{'class':'inv-peticion',texto:p.peticion}));
    return doc;
  }
  async function panelInvestigacion(contenedor,completa=false,filtro='',busqueda='') {
    const version=(versionesPanelInv.get(contenedor)||0)+1;versionesPanelInv.set(contenedor,version);
    const compartida=!!investigacionCompartida,v=compartida?null:leerInvestigaciones(),p=compartida?investigacionCompartida:v.proyectos[v.activa];
    const repintar=()=>{estadoMarcadoresInv();return panelInvestigacion(contenedor,completa,filtro,busqueda).catch(errorInv);};
    const guardar=()=>{guardarInvestigaciones(v);};
    const avisos=h('div',{'class':'inv-intercambio','aria-live':'polite'});
    const copiar=async(texto)=>{
      avisos.replaceChildren();
      try{
        if(!raiz.navigator?.clipboard?.writeText)throw new Error('Portapapeles no disponible');
        await raiz.navigator.clipboard.writeText(texto);avisos.appendChild(h('p',{role:'status',texto:ti('copiado')}));
      }catch(e){
        if(texto.includes('\n')){avisos.append(h('p',{texto:ti('copiar_manual')}),h('pre',{tabindex:0,texto}));return;}
        const campo=h('input',{type:'text',readonly:true,'aria-label':ti('copiar_manual')});campo.value=texto;
        campo.addEventListener('focus',()=>campo.select?.());avisos.append(h('p',{texto:ti('copiar_manual')}),campo);campo.focus?.();campo.select?.();
      }
    };
    const compartir=async()=>{try{
      const url=await enlaceInvestigacion(p,raiz.location.href,rutaGuia('investigacion'));
      if(url.length>8000){avisos.replaceChildren(h('p',{role:'status',texto:ti('largo')}),botonInv('exportar_archivo',()=>descargarInv('investigacion.json',JSON.stringify(validarInvestigacion(p),null,2),'application/json')));return;}
      await copiar(url);
      if(avisos.querySelector('[role="status"]'))avisos.querySelector('[role="status"]').textContent=ti('enlace_copiado');
    }catch(e){errorInv(e);}};
    contenedor.replaceChildren();
    if(compartida){
      const titulo=h('h3',{'class':'inv-titulo',title:p.nombre,texto:p.nombre});
      const acciones=menuAccionesInv([botonInv('copia',async()=>{try{
        const copia=await revisarInvestigacion(p,cargarReglamento,p.version===1),local=leerInvestigaciones();
        local.proyectos.push(copia);local.activa=local.proyectos.length-1;guardarInvestigaciones(local);
        salirInvestigacionCompartida();await repintar();
      }catch(e){errorInv(e);}}),botonInv('salir',()=>{salirInvestigacionCompartida();repintar();})]);
      contenedor.append(h('div',{'class':'inv-compartida-cab'},[titulo,acciones]),h('p',{'class':'inv-conteo',texto:[p.autor,...p.etiquetas].filter(Boolean).join(' · ')}),h('p',{'class':'inv-conteo',texto:ti('solo_lectura')}));
    }else{
    // Selector de la investigación activa: un control con su nombre y el menú de acciones (sin ventanas nativas).
    const cab=h('nav',{'class':'inv-proyectos','aria-label':ti('proyecto')});
    const zona=h('div',{'class':'inv-cab'}),menu=h('div',{'class':'inv-menu',role:'menu'});
    menu.setAttribute('hidden','');
    const selector=h('button',{type:'button','class':'inv-selector',title:p?p.nombre:ti('nombre_inicial'),'aria-haspopup':'menu','aria-expanded':'false','aria-label':ti('proyecto')+': '+(p?p.nombre:ti('nombre_inicial'))},[h('span',{'class':'inv-selector__nombre',texto:p?p.nombre:ti('nombre_inicial')}),h('span',{'aria-hidden':'true',texto:'▾'})]);
    const abrirMenu=abrir=>{if(abrir)menu.removeAttribute('hidden');else menu.setAttribute('hidden','');selector.setAttribute('aria-expanded',String(abrir));};
    selector.addEventListener('click',()=>abrirMenu(menu.hasAttribute('hidden')));
    cab.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hasAttribute('hidden')){abrirMenu(false);selector.focus?.();}});
    const normal=()=>zona.replaceChildren(selector,menu);
    const mostrar=nodo=>{abrirMenu(false);zona.replaceChildren(nodo);};
    const item=(texto,fn,activo)=>{const b=h('button',{type:'button','class':'inv-menu__item',role:activo===undefined?'menuitem':'menuitemradio',texto});if(activo!==undefined)b.setAttribute('aria-checked',String(activo));b.addEventListener('click',()=>{abrirMenu(false);return fn();});return b;};
    v.proyectos.forEach((x,i)=>menu.appendChild(item(x.nombre,()=>{v.activa=i;guardar();repintar();},i===v.activa)));
    menu.appendChild(h('hr',{'class':'inv-menu__linea'}));
    menu.appendChild(item('+ '+ti('nueva'),()=>{try{v.proyectos.push(nuevaInv(ti('nombre_n',{n:v.proyectos.length+1})));v.activa=v.proyectos.length-1;guardar();repintar();}catch(e){errorInv(e);}}));
    if(p){
      menu.appendChild(item(ti('compartir_enlace'),compartir));
      menu.appendChild(item(ti('renombrar'),()=>mostrar(campoInv(ti('nombre'),p.nombre,120,valor=>{if(!valor.trim())return;try{p.nombre=valor.trim();validarInvestigacion(p);guardar();repintar();}catch(e){errorInv(e);}},()=>{normal();selector.focus?.();}))));
    }
    const archivo=h('input',{type:'file',id:'rgl-importar',hidden:true,accept:'.json,application/json','aria-label':ti('importar')});
    archivo.addEventListener('change',async()=>{try{
      const f=archivo.files[0];if(!f||f.size>2000000)throw new Error('Tamaño inválido');
      const entrada=validarInvestigacion(JSON.parse(await f.text()));
      const importada=await revisarInvestigacion(entrada,cargarReglamento,entrada.version===1);
      const actual=leerInvestigaciones();actual.proyectos.push(importada);actual.activa=actual.proyectos.length-1;guardarInvestigaciones(actual);estadoMarcadoresInv();await repintar();contenedor.appendChild(h('p',{role:'status',texto:ti('importada')}));
    }catch(e){errorInv(e);}});
    menu.appendChild(item(ti('importar_menu'),()=>archivo.click()));
    if(p){
      menu.appendChild(item(ti('borrar_menu'),()=>{
        const aviso=h('div',{'class':'inv-confirmar',role:'alertdialog','aria-label':ti('confirmar')},[h('p',{texto:ti('confirmar')})]),fila=h('div',{'class':'inv-campo'});
        fila.append(botonInv('borrar',()=>{v.proyectos.splice(v.activa,1);v.activa=0;guardar();repintar();}),botonInv('cancelar',()=>{normal();selector.focus?.();}));
        aviso.appendChild(fila);mostrar(aviso);
      }));
    }
    normal();cab.append(zona,h('label',{'class':'sate-sr',for:'rgl-importar',texto:ti('importar')}),archivo);contenedor.appendChild(cab);
    }
    if(!p){contenedor.appendChild(h('p',{texto:ti('vacia')}));return;}
    const principal=h('div',{'class':'inv-contenido'});contenedor.appendChild(principal);
    principal.appendChild(avisos);
    if(completa&&!compartida)principal.appendChild(h('h3',{texto:p.nombre}));
    principal.appendChild(h('p',{'class':'inv-conteo',texto:ti('resumen',{c:p.marcadores.length,n:notasDe(p)})}));
    const documentos={},filas=new Map(),cambios=new Set();
    const buscar=h('input',{type:'search','aria-label':ti('buscar_notas'),placeholder:ti('buscar_notas')}),conteo=h('p',{'class':'inv-conteo',role:'status'});
    buscar.value=busqueda;
    const tipos=h('select',{'aria-label':ti('tipo')},['',...tiposNota].map(x=>h('option',{value:x,selected:x===filtro,texto:ti(x||'todos_tipos')})));
    let visibles=p.marcadores;
    const filtrar=()=>{
      busqueda=buscar.value||'';visibles=filtrarCitasInv(p,documentos,busqueda,filtro);
      for(const [m,fila] of filas)fila.hidden=!visibles.includes(m);
      conteo.textContent=ti('mostrando',{n:visibles.length,m:p.marcadores.length});
    };
    if(completa){
      buscar.addEventListener('input',filtrar);tipos.addEventListener('change',()=>{filtro=tipos.value;filtrar();});
      principal.append(h('div',{'class':'inv-filtros'},[buscar,tipos]),conteo);
    }
    const lista=h('div',{'class':'inv-lista'});principal.appendChild(lista);
    // Solo la migración de un marcador antiguo establece su primera huella.
    for(const m of p.marcadores){
      const reg=await cargarReglamento(m.doc),oficial=textoCita(reg,m),actual=oficial===null?null:await huellaCita(oficial);
      documentos[m.doc]=reg;
      if(versionesPanelInv.get(contenedor)!==version||!contenedor.isConnected)return;
      if(m.pendienteHuella&&actual&&!compartida){
        m.huella=actual;m.pendienteHuella=false;
        const vigente=leerInvestigaciones(),c=vigente.proyectos[v.activa]?.marcadores.find(x=>claveCita(x)===claveCita(m));
        if(c?.pendienteHuella){c.huella=actual;c.pendienteHuella=false;guardarInvestigaciones(vigente);}
      }
      const cambio=!actual||m.huella!==actual;
      if(cambio)cambios.add(m);
      const sufijo=sufijoInvestigacion();
      const enlace=rutaReglamento(m.doc,anclaArticulo(m.n,m.fr,m.inciso))+sufijo+(m.frpos?(sufijo?'&':'?')+'frpos='+m.frpos:'');
      const rotulo=rotuloCita(m);
      const fila=h('article',{'class':completa?'inv-cita':'rgl-investigacion__item'});
      if(completa){
        const cita=h('div',{'class':'inv-oficial'},[h('p',{},[ti('oficial')+' · ',h('a',{href:enlace,texto:rotulo}),' · ',h('span',{'class':cambio?'inv-cambio':'',texto:ti(cambio?'cambio':'sin_cambios')})])]);
        cita.appendChild(h('p',{'class':'pc-oficial','data-oficial':oficial===null?null:m.doc,texto:oficial??ti('no_disponible')}));
        fila.appendChild(cita);
        const notas=compartida?notaCompartida(m):editorNota(m,guardar,true);
        fila.appendChild(notas);
        for(const a of m.anotaciones)notas.appendChild(h('p',{'class':'inv-nota__texto',texto:ti('nota')+' · '+ti(a.etiqueta)+': '+a.nota}));
        if(!compartida){
        const acciones=h('div',{'class':'inv-orden'}),i=p.marcadores.indexOf(m);
        for(const [k,d] of [['subir',-1],['bajar',1]]){const b=botonInv(k,()=>{moverCita(p,i,i+d);guardar();repintar();});b.disabled=i+d<0||i+d>=p.marcadores.length;acciones.appendChild(b);}
        const arrastre=botonInv('ordenar',()=>{});arrastre.draggable=true;
        arrastre.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';});
        fila.addEventListener('dragover',e=>e.preventDefault());fila.addEventListener('drop',e=>{e.preventDefault();const desde=Number(e.dataTransfer.getData('text/plain'));moverCita(p,desde,i);guardar();repintar();});
        acciones.append(arrastre,botonInv('quitar',()=>{p.marcadores.splice(p.marcadores.indexOf(m),1);guardar();repintar();}));
        const simbolos=['↑','↓','⠿','×'];
        Array.from(acciones.children).forEach((b,i)=>{b.setAttribute('aria-label',b.textContent);b.setAttribute('title',b.textContent);b.textContent=simbolos[i];});
        fila.appendChild(acciones);
        }
      }else{
        const quitar=h('button',{type:'button','class':'inv-quitar','aria-label':ti('quitar'),title:ti('quitar'),texto:'✕'});
        quitar.addEventListener('click',()=>{p.marcadores.splice(p.marcadores.indexOf(m),1);guardar();repintar();});
        const nota=m.nota||m.anotaciones.map(a=>a.nota).filter(Boolean).join(' · ');
        fila.append(h('div',{'class':'inv-item__cab'},[h('a',{'class':'inv-ref',href:enlace,title:rotulo,texto:rotulo}),cambio?h('span',{'class':'inv-cambio',texto:ti('cambio')}):null,compartida?null:quitar]),h('p',{'class':nota?'inv-item__nota':'inv-item__nota inv-item__nota--vacia',title:nota,texto:compartida?ti(m.tipo)+' · '+(nota||ti('sin_nota')):nota||ti('sin_nota')}));
      }
      lista.appendChild(fila);
      filas.set(m,fila);
    }
    if(completa){
      const leer=botonInv('leer_documento',()=>{
        const documento=documentoInvestigacion(p,documentos,cambios);
        const barra=h('nav',{'class':'inv-visor-barra','aria-label':ti('leer_documento')},[botonInv('volver_investigacion',repintar),botonInv('imprimir_documento',()=>raiz.print())]);
        contenedor.replaceChildren(barra,documento);
      });
      principal.insertBefore(leer,principal.firstChild);
      filtrar();lista.addEventListener('input',filtrar);lista.addEventListener('change',filtrar);lista.addEventListener('click',filtrar);
      const incluir=h('input',{type:'checkbox'}),acciones=h('div',{'class':'inv-campo'});
      acciones.append(h('label',{},[incluir,ti('incluir_notas')]),botonInv('copiar_fundamento',()=>copiar(copiarFundamentoInv(visibles,documentos,ti,incluir.checked))),botonInv('compartir_enlace',compartir));
      principal.appendChild(acciones);
    }
    if(!p.marcadores.length)lista.appendChild(h('p',{texto:ti('vacia')}));
    if(completa){
      const peticionSeccion=h('details',{'class':'inv-peticion-seccion'},[h('summary',{texto:ti('peticion')})]);
      principal.appendChild(peticionSeccion);
      if(compartida)peticionSeccion.appendChild(h('p',{'class':'inv-peticion',texto:p.peticion}));
      else {
      const peticion=h('textarea',{'aria-label':ti('peticion'),maxlength:20000,rows:2});peticion.value=p.peticion;
      peticion.addEventListener('input',()=>{p.peticion=peticion.value;try{guardar();}catch(e){errorInv(e);}});
      peticionSeccion.appendChild(peticion);
      principal.appendChild(menuAccionesInv([botonInv('json',()=>descargarInv('investigacion.json',JSON.stringify(validarInvestigacion(p),null,2),'application/json')),botonInv('markdown',async()=>{
        try{descargarInv('investigacion.md',await exportarMarkdownInv(p,cargarReglamento,ti,enlaceExportacion),'text/markdown');}catch(e){errorInv(e);}
      }),botonInv('latex',async()=>{try{descargarInv('investigacion.tex',await exportarLatexInv(p,cargarReglamento,ti),'application/x-tex');}catch(e){errorInv(e);}})]));
      }
    }else{
      const abrir=h('a',{'class':'inv-abrir',href:rutaGuia('investigacion')+sufijoInvestigacion(),texto:ti('abrir')});abrir.addEventListener('click',()=>{regresoInv=raiz.location.hash;});principal.appendChild(abrir);
    }
  }
  const enlaceExportacion=m=>raiz.location.href.split('#')[0]+rutaReglamento(m.doc,anclaArticulo(m.n,m.fr,m.inciso))+(m.frpos?'?frpos='+m.frpos:'');
  async function vistaInvestigacion(raizGuia) {
    const titulo=h('h2',{tabindex:-1,texto:ti('panel')});
    const cuerpo=h('div',{'class':'inv-vista'});
    const regreso=sinInvestigacionCompartida(regresoInv||rutaGuia('reglamentos'));
    raizGuia.append(h('header',{'class':'guia-cab'},[h('a',{href:regreso+sufijoInvestigacion().replace('?',regreso.includes('?')?'&':'?'),texto:ti('regresar')}),titulo]),cuerpo);
    await panelInvestigacion(cuerpo,true);return titulo;
  }
  function descargarInv(nombre,texto,tipo) {
    const url=URL.createObjectURL(new Blob([texto],{type:tipo})), a=h('a',{href:url,download:nombre});
    document.body.appendChild(a); a.click(); a.remove(); raiz.setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  // Lector de tres paneles: índice | articulado continuo | trámites y preguntas del artículo actual.
  function montarReglamento(raizGuia, d, reg, doc, ancla) {
    const cab = cabecera([...migasBase(), { texto: tituloApartado('reglamentos'), href: rutaGuia('reglamentos') }, { texto: reg.titulo }], reg.titulo, reg.gaceta);
    cab.nodo.classList.add('rgl-portada');
    const articulos = reg.sin_texto ? [] : reg.articulos || [], transitorios = reg.sin_texto ? [] : reg.transitorios || [];
    const fuenteDoc = reg.url ? h('p', { 'class': 'rgl-fuente' }, [enlaceExterno('', reg.url, t('sate.guia.pdf_oficial'))]) : null;
    const avisoOcr = reg.ocr && !reg.sin_texto ? h('p', { 'class': 'guia-aviso-ocr', texto: t('sate.guia.aviso_ocr') }) : null;
    if (!articulos.length && !transitorios.length) {
      const contextoPlano = h('nav', {'class':'rgl-contexto','aria-label':reg.titulo}, [
        h('strong', {texto:reg.titulo}),
        h('details', {}, [h('summary',{texto:t('sate.guia.rgl_buscar_etiqueta')}),buscadorIndice({fuente:'reglamentos',doc,nombre:reg.titulo})]),
        h('a',{href:rutaGuia('reglamentos'),texto:bt('cambiar')})]);
      // Sin articulado (código, lineamientos escaneados): el texto corrido, sin índice.
      const lineas = !reg.sin_texto && reg.texto ? String(reg.texto).split(/\n+/).filter(Boolean) : [];
      raizGuia.append(cab.nodo, contextoPlano, h('div', { 'class': 'guia-apartado' }, [avisoOcr, lineas.length
        ? h('div', { 'class': 'rgl-cuerpo pc-lector pc-oficial', 'data-ancla': 'texto' }, lineas.map(x => h('p', { texto: x })))
        : h('p', { role: 'status', texto: t('sate.guia.sin_articulo') }), fuenteDoc]));
      return { titulo: cab.titulo };
    }
    const posicion = new Map(articulos.map((a, i) => [a.n, i]));
    const arbol = arbolReglamento(reg), tramites = cfg().tramites || [];
    const grupos = new Map(), enlaces = new Map();     // artículo -> grupos que lo contienen / enlace del índice
    const enlaceAncla = (clase, anclaDe, contenido, extra) => h('a', { 'class': clase, href: rutaReglamento(doc, anclaDe)+sufijoInvestigacion(), 'data-ancla': anclaDe, ...extra }, contenido);
    const chip = (n, ancestros) => {
      const a = enlaceAncla('rgl-art', anclaArticulo(n), t('sate.guia.rgl_art_corto', { n }));
      enlaces.set(n, a);
      grupos.set(n, ancestros);
      return h('li', {}, [a]);
    };
    function nodoArbol(nodo, ancestros) {
      const det = h('details', { 'class': 'rgl-grupo' }), cuerpo = h('div', { 'class': 'rgl-grupo__cuerpo' });
      const propios = [...ancestros, det];
      for (const x of nodo.orden) cuerpo.appendChild(x.hijo ? nodoArbol(x.hijo, propios) : h('ul', {'class':'rgl-arts'}, [chip(x.n, propios)]));
      const ns = numerosNodo(nodo);
      det.append(h('summary', {}, [enlaceAncla('rgl-indice-titulo', anclaArticulo(ns[0]), nodo.titulo, {'data-oficial':doc}), h('small', { texto: t(ns.length === 1 ? 'sate.guia.inv_intervalo_uno' : 'sate.guia.inv_intervalo', {desde:ns[0],hasta:ns[ns.length-1]}) })]), cuerpo);
      return det;
    }
    const arbolNav = h('div', { 'class': 'rgl-arbol' }, arbol.orden.map(x => x.hijo ? nodoArbol(x.hijo, []) : h('ul', {'class':'rgl-arts'}, [chip(x.n,[])])));
    const enlaceTransitorios = transitorios.length ? enlaceAncla('rgl-art rgl-art--ancho', 'transitorios', t('sate.guia.transitorios')) : null;
    if (enlaceTransitorios) arbolNav.appendChild(h('ul', { 'class': 'rgl-arts' }, [h('li', {}, [enlaceTransitorios])]));
    for (const x of transitorios) arbolNav.appendChild(enlaceAncla('rgl-art', 'transitorio-' + x.n, x.n, {'data-oficial':doc}));

    const salto = h('input', {type:'search', placeholder:t('sate.guia.inv_ir'), 'aria-label':t('sate.guia.inv_ir')});
    const saltar = () => { const destino = destinoArticulo(reg,salto.value); if(destino) ir(destino,true); };
    salto.addEventListener('change',saltar);
    salto.addEventListener('keydown',e => {if(e.key === 'Enter') {e.preventDefault(); saltar();}});
    const cuerpoIndice = h('div', { 'class': 'rgl-indice__cuerpo' }, [salto, arbolNav]);
    const resumen = h('span', { 'class': 'rgl-resumen__actual' });
    const contextoActual = h('span', {'class':'rgl-contexto__actual'});
    const resultadosContexto = h('ul', {'class':'rgl-busqueda-contexto__resultados', hidden:true, 'aria-live':'polite'});
    const entradaContexto = h('input', {type:'search', autocomplete:'off', 'aria-label':t('sate.guia.rgl_buscar_etiqueta'), placeholder:t('sate.guia.rgl_buscar_marcador'), 'aria-expanded':'false'});
    const busquedaContexto = h('div', {'class':'rgl-busqueda-contexto'}, [entradaContexto,resultadosContexto]);
    entradaContexto.addEventListener('input',()=>{
      const q=entradaContexto.value.trim(), encontrados=buscarArticulos(reg,q,10);
      resultadosContexto.replaceChildren(...encontrados.map(a=>h('li',{},[h('a',{href:rutaReglamento(doc,anclaArticulo(a.n)), 'data-ancla':anclaArticulo(a.n)},[
        h('strong',{texto:t('sate.guia.rgl_art_corto',{n:a.n})}),h('span',{texto:fragmento(a.texto,q)})
      ])])));
      if(q && !encontrados.length)resultadosContexto.appendChild(h('li',{class:'guia-vacio',texto:t('sate.guia.rgl_resultados',{n:0})}));
      resultadosContexto.hidden=!q;entradaContexto.setAttribute('aria-expanded',String(!!q));
    });
    const contexto = h('nav', {'class':'rgl-contexto', 'aria-label':reg.titulo}, [
      h('div', {'class':'rgl-contexto__titulo'}, [h('strong', {texto:selloReglamento(reg.titulo,doc) + ' · ' + reg.titulo}), contextoActual]),
      busquedaContexto,
      h('a', {'class':'rgl-contexto__cambiar',href:rutaGuia('reglamentos'), texto:bt('cambiar')})
    ]);
    const indice = h('details', { 'class': 'rgl-indice', open: true }, [h('summary', { 'class': 'rgl-resumen' }, [h('span', { texto: t('sate.guia.rgl_indice') }), resumen]), cuerpoIndice]);
    const texto = h('article', { 'class': 'rgl-texto', 'aria-label': reg.titulo });
    const riel = h('aside', { 'class': 'rgl-riel', 'aria-label': t('sate.guia.rgl_contexto') });
    const rejilla = SateUI.lector(indice, texto, riel);
    const investigacion = h('details',{'class':'rgl-investigacion',id:'rgl-investigacion',open:!pantallaChica()},[h('summary',{texto:ti('panel')})]);
    const invCuerpo=h('div',{'class':'rgl-investigacion__cuerpo'}), invContexto=h('button',{type:'button','class':'rgl-investigacion__contexto','aria-controls':'rgl-investigacion','aria-expanded':String(investigacion.open),texto:ti('boton')+' (0)'});
    invContexto.addEventListener('click',()=>{investigacion.open=!investigacion.open;invContexto.setAttribute('aria-expanded',String(investigacion.open));});
    investigacion.addEventListener('toggle',()=>invContexto.setAttribute('aria-expanded',String(investigacion.open)));
    investigacion.appendChild(invCuerpo); contexto.appendChild(invContexto);
    async function pintarInvestigacion() {
      estadoMarcadoresInv();
      await panelInvestigacion(invCuerpo,false);
      const p=investigacionVisible();
      invContexto.textContent=ti(investigacionCompartida?'compartida':'boton')+' ('+(p?.marcadores.length||0)+')';
      pintarAnotaciones();
    }
    function pintarAnotaciones() {
      const p=investigacionVisible();
      for(const n of texto.querySelectorAll('.rgl-notas'))n.remove();
      const rangos=Object.fromEntries(etiquetasInv.map(x=>[x,[]]));
      for(const m of p?.marcadores||[])if(m.doc===doc){const seccion=secciones.get(m.n), cuerpo=seccion?.querySelector('.rgl-cuerpo');if(!cuerpo)continue;
        const nodos=[],walker=document.createTreeWalker?.(cuerpo,4);if(!walker)continue;while(walker.nextNode())if(!walker.currentNode.parentElement?.closest('.inv-fraccion'))nodos.push(walker.currentNode);
        for(const a of m.anotaciones){const posiciones=segmentosAnotacion(nodos.map(n=>n.textContent),a);if(!posiciones)continue;const r=document.createRange();r.setStart(nodos[posiciones.inicio[0]],posiciones.inicio[1]);r.setEnd(nodos[posiciones.fin[0]],posiciones.fin[1]);rangos[a.etiqueta].push(r);seccion.appendChild(h('p',{'class':'rgl-notas',texto:ti(a.etiqueta)+' · '+a.nota}));}
      }
      if(raiz.CSS?.highlights && raiz.Highlight)etiquetasInv.forEach(x=>raiz.CSS.highlights.set('sate-inv-'+x,new raiz.Highlight(...rangos[x])));
    }
    const actualizarInv=()=>{estadoMarcadoresInv();pintarInvestigacion().catch(errorInv);};
    raiz.addEventListener('sate-investigacion',actualizarInv);
    const actualizarNotas=()=>panelInvestigacion(invCuerpo,false).catch(errorInv);
    raiz.addEventListener('sate-investigacion-nota',actualizarNotas);
    const estrecho = () => pantallaChica() || (rejilla.clientWidth > 0 && rejilla.clientWidth <= 672);
    if (fuenteDoc || avisoOcr) cab.nodo.appendChild(h('div', { 'class': 'rgl-datos' }, [fuenteDoc, avisoOcr]));
    const mapa = mapaReglamento(reg);
    const cifras = h('dl', { 'class': 'rgl-cifras' }, [
      ['articulos', articulos.length], ...nivelesReglamento(reg).map(x => [x.nivel,x.cantidad]),
      ['directos', mapa.filter(x => x.aplicacion === 'directo').reduce((s, x) => s + x.articulos.length, 0)]
    ].map(([clave, n]) => h('div', {}, [h('dt', { texto: t('sate.guia.rgl_' + clave) }), h('dd', { texto: String(n) })])));
    const barra = h('div', { 'class': 'rgl-mapa__barra' }, mapa.map(x => {
      const a = enlaceAncla('rgl-mapa__tramo rgl-aplica--' + x.aplicacion, anclaArticulo(x.articulos[0]), [h('span', { 'class': 'rgl-mapa__color' }), h('span', { 'class': 'rgl-mapa__etiqueta', texto: x.etiqueta }), h('span', { 'class': 'rgl-mapa__intervalo', texto: ti(x.articulos.length===1?'intervalo_uno':'intervalo',{desde:x.articulos[0],hasta:x.articulos[x.articulos.length-1]})+' · '+t('sate.guia.rgl_'+x.aplicacion) }), h('span', { 'class': 'rgl-mapa__completo', texto: x.titulo })],
        { title: x.titulo + ' · ' + ti(x.articulos.length===1?'intervalo_uno':'intervalo',{desde:x.articulos[0],hasta:x.articulos[x.articulos.length-1]}), 'aria-label': x.titulo + ' · ' + t('sate.guia.rgl_' + x.aplicacion) });
      return a;
    }));
    const mapaVista = h('section', { 'class': 'rgl-mapa' }, [h('h3', { texto: t('sate.guia.rgl_mapa') }),
      h('ul', { 'class': 'rgl-leyenda' }, ['directo', 'parcial', 'organizacion'].map(x => h('li', { 'class': 'rgl-aplica--' + x, texto: t('sate.guia.rgl_' + x) }))), barra]);
    cab.nodo.appendChild(contexto);
    raizGuia.append(cab.nodo, cifras);
    if (mapa.length) raizGuia.appendChild(mapaVista);
    raizGuia.appendChild(rejilla);

    let actual = null, enlaceActual = '';
    function fila(clase, marca, anclaDe, etiqueta, contenido) {
      return h('li', { 'class': clase, 'data-ancla': anclaDe }, [enlaceAncla('rgl-marca', anclaDe, marca, { 'aria-label': etiqueta }), h('div', {}, contenido)]);
    }
    function pintarRiel(a) {
      const rel = a ? relacionesArticulo(d, doc, a.n, tramites) : { preguntas: [], tramites: [] };
      const bloques = [];
      if (rel.tramites.length) bloques.push(h('section', {}, [h('h4', { texto: t('sate.guia.rgl_tramites') }), h('ul', {}, rel.tramites.map(id => h('li', {}, [h('a', { href: '#/' + unidad() + '/tramites/' + id, texto: t('sate.tramite.' + id + '.titulo') })])))]));
      if (rel.preguntas.length) bloques.push(h('section', {}, [h('h4', { texto: t('sate.guia.rgl_preguntas') }), h('ul', {}, rel.preguntas.map(p => h('li', {}, [h('a', { href: rutaGuia(p.apartado, p.id), texto: p.pregunta })])))]));
      // El riel no se oculta: si cambiara la rejilla al desplazarse, el índice y el texto saltarían.
      riel.replaceChildren(investigacion, h('h3', { texto: t('sate.guia.rgl_contexto') }), ...(bloques.length ? bloques : [h('p', { 'class': 'rgl-riel-vacio', texto: t('sate.guia.rgl_sin_citas') })]));
    }
    function marcarIndice(clave) {
      for (const [n, a] of enlaces) { if (n === clave) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }
      if (enlaceTransitorios) { if (clave === 'transitorios') enlaceTransitorios.setAttribute('aria-current', 'true'); else enlaceTransitorios.removeAttribute('aria-current'); }
      for (const g of grupos.get(clave) || []) g.open = true;
      for (const g of arbolNav.querySelectorAll('.rgl-grupo')) {
        const titulo = g.querySelector('.rgl-indice-titulo');
        if ((grupos.get(clave) || []).includes(g)) titulo.setAttribute('aria-current', 'true');
        else titulo.removeAttribute('aria-current');
      }
      // Con el índice abierto, el artículo actual queda a la vista dentro de su propio desplazamiento.
      const activo = clave === 'transitorios' ? enlaceTransitorios : enlaces.get(clave), r = cuerpoIndice.getBoundingClientRect();
      if (activo && indice.open && r.height) { const a = activo.getBoundingClientRect(); if (a.top < r.top || a.bottom > r.bottom) cuerpoIndice.scrollTop += a.top - r.top - r.height / 3; }
    }
    // El lienzo conserva todo el documento; al navegar solo cambian el índice y las relaciones.
    function pintar(clave) {
      if (clave === 'transitorios') {
        const rotulo = t('sate.guia.transitorios');
        pintarRiel(null);
        resumen.textContent = rotulo;
      } else {
        const i = posicion.get(clave), a = articulos[i];
        pintarRiel(a);
        resumen.textContent = t('sate.guia.rgl_art_corto', { n: a.n });
      }
      marcarIndice(clave);
      actual = clave;
      const a = articulos[posicion.get(clave)];
      contextoActual.textContent = [...(a?.ubicacion || []), a ? t('sate.guia.articulo_rotulo', {n:a.n}) : t('sate.guia.transitorios')].join(' › ');
      document.title = (a ? 'Art. ' + a.n : t('sate.guia.transitorios')) + ' · ' + selloReglamento(reg.titulo,doc) + ' — ' + t('sate.pestana.guia.titulo');
      for (const tramo of barra.children) {
        const grupo = mapa.find(x => x.articulos.includes(clave));
        if (grupo && tramo.getAttribute('data-ancla') === anclaArticulo(grupo.articulos[0])) tramo.setAttribute('aria-current', 'true');
        else tramo.removeAttribute('aria-current');
      }
    }
    const secciones = new Map(), pendientes = new Map();
    const inicial = leerAncla(ancla || ''), centro = posicion.get(inicial?.n) ?? 0;
    function completar(clave) {
      const pendiente = pendientes.get(clave);
      if (!pendiente) return;
      pendientes.delete(clave);
      pendiente();
    }
    function vecindad(clave) {
      const i = posicion.get(clave);
      if (i == null) { completar(clave); return; }
      for (let j = Math.max(0, i - 2); j <= Math.min(articulos.length - 1, i + 3); j++) completar(articulos[j].n);
    }
    let ubicacionAnterior = [], contenedores = [texto];
    for (const a of articulos) {
      const ubicacion = a.ubicacion || [];
      let comun = 0;
      while (comun < ubicacion.length && ubicacion[comun] === ubicacionAnterior[comun]) comun++;
      contenedores = contenedores.slice(0, comun + 1);
      for (let nivel = comun; nivel < ubicacion.length; nivel++) {
        const grupo = h('section', { 'class': 'rgl-seccion rgl-nivel-' + nivel }, [h('h' + Math.min(6, nivel + 3), { 'class': 'rgl-encabezado', texto: ubicacion[nivel] })]);
        contenedores[contenedores.length - 1].appendChild(grupo);
        contenedores.push(grupo);
      }
      const anc = anclaArticulo(a.n);
      const copiarArticulo = h('button', { type: 'button', 'class': 'btn rgl-copiar rgl-icono', 'aria-label':t('sate.guia.rgl_copiar'), title:t('sate.guia.rgl_copiar'), texto: t('sate.guia.rgl_copiar') });
      const estado = h('span', { role: 'status', 'class': 'rgl-copiado' });
      copiarArticulo.addEventListener('click', () => copiarEnlace(rutaReglamento(doc, anc)).then(
        () => { estado.textContent = t('sate.guia.rgl_copiado'); },
        () => { estado.textContent = t('sate.guia.rgl_copiar_error'); }));
      const guardar = botonGuardarInv(doc,a.n);
      guardar.classList.add('inv-guardar-articulo');
      guardar.setAttribute('aria-label',ti('guardar')); guardar.setAttribute('title',ti('guardar'));
      const acciones = h('details',{'class':'rgl-art-acciones',open:!pantallaChica()},[h('summary',{'aria-label':ti('acciones'),title:ti('acciones'),texto:'⋯'}),h('div',{},[copiarArticulo,guardar])]);
      const seccion = h('section', { 'class': 'rgl-articulo', id: 'rgl-' + anc, 'data-articulo': a.n }, [
        h('header', { 'class': 'rgl-cab' }, [h('h4', {}, [enlaceAncla('rgl-cita', anc, t('sate.guia.articulo_rotulo', { n: a.n }))]), acciones, estado]),
        h('p',{'class':'inv-resumen-articulo','data-resumen-doc':doc,'data-resumen-articulo':a.n})]);
      // Reservar altura evita que los títulos posteriores colapsen mientras llega su texto.
      seccion.style.minHeight = Math.max(110, Math.ceil((a.texto || '').length / 80) * 24 + 64) + 'px';
      pendientes.set(a.n, () => { seccion.appendChild(cuerpoArticulo(a,doc,fila)); seccion.style.minHeight = ''; estadoMarcadoresInv(); if(investigacionCompartida || leerInvestigaciones().proyectos.length)pintarAnotaciones(); });
      if (Math.abs(posicion.get(a.n) - centro) <= 3) completar(a.n);
      contenedores[contenedores.length - 1].appendChild(seccion);
      secciones.set(a.n, seccion);
      ubicacionAnterior = ubicacion;
    }
    if (transitorios.length) {
      const seccion = h('section', { 'class': 'rgl-articulo', id: 'rgl-transitorios', 'data-articulo': 'transitorios' }, [
        h('h3', { texto: t('sate.guia.transitorios') }), h('div', { 'class': 'rgl-cuerpo pc-lector pc-oficial', 'data-oficial':doc },
          transitorios.map(x => h('p', { 'data-transitorio':x.n, texto: x.n + '. ' + x.texto })))]);
      texto.appendChild(seccion);
      secciones.set('transitorios', seccion);
    }
    const seleccionBarra=h('div',{'class':'rgl-seleccion',hidden:true,role:'toolbar','aria-label':ti('seleccion')});
    const etiquetaSeleccion=h('select',{'aria-label':ti('etiqueta')},etiquetasInv.map(x=>h('option',{value:x,texto:ti(x)})));
    let seleccionActual=null;
    function capturarSeleccion() {
      const s=raiz.getSelection?.();if(!s?.rangeCount||s.isCollapsed)return;
      const r=s.getRangeAt(0), inicio=r.startContainer.parentElement?.closest('.rgl-cuerpo'), fin=r.endContainer.parentElement?.closest('.rgl-cuerpo');
      if(!inicio || inicio!==fin || !texto.contains(inicio)||r.startContainer.parentElement?.closest('.inv-fraccion')||r.endContainer.parentElement?.closest('.inv-fraccion'))return;
      const previo=document.createRange();previo.selectNodeContents(inicio);previo.setEnd(r.startContainer,r.startOffset);
      const literal=r.toString(), n=inicio.closest('[data-articulo]').getAttribute('data-articulo'), fr=r.startContainer.parentElement?.closest('.rgl-fr')?.getAttribute('data-ancla')?.split('.')[1]||'';
      const copia=previo.cloneContents();for(const propio of copia.querySelectorAll('.inv-fraccion'))propio.remove();
      seleccionActual={n,fr,inicio:copia.textContent.length,fin:copia.textContent.length+literal.length,literal};seleccionBarra.hidden=false;
    }
    function anotar(nota) {
      if(!seleccionActual || investigacionCompartida)return;
      const v=leerInvestigaciones(),p=v.proyectos[v.activa];if(!p){guardarArticuloInv(doc,seleccionActual.n);if(leerInvestigaciones().proyectos.length)anotar(nota);return;}
      let m=p.marcadores.find(x=>x.doc===doc&&x.n===seleccionActual.n&&x.fr===seleccionActual.fr);
      if(!m){m={doc,n:seleccionActual.n,fr:seleccionActual.fr,inciso:'',huella:'',pendienteHuella:true,nota:'',tipo:'personal',anotaciones:[]};p.marcadores.push(m);}
      m.anotaciones.push({inicio:seleccionActual.inicio,fin:seleccionActual.fin,literal:seleccionActual.literal,nota:nota||'',etiqueta:etiquetaSeleccion.value||'favor'});
      validarInvestigacion(p);guardarInvestigaciones(v);seleccionBarra.hidden=true;actualizarInv();
    }
    const elementosBarra=[];
    const restaurarBarra=()=>seleccionBarra.replaceChildren(...elementosBarra);
    elementosBarra.push(etiquetaSeleccion,botonInv('subrayar',()=>anotar('')),botonInv('nota',()=>{seleccionBarra.replaceChildren(campoInv(ti('nota'),'',4000,nota=>{restaurarBarra();anotar(nota);},restaurarBarra));}),botonInv('cita',()=>{if(seleccionActual)raiz.navigator.clipboard.writeText(seleccionActual.literal+' ('+reg.titulo+', art. '+seleccionActual.n+(seleccionActual.fr?', fracc. '+seleccionActual.fr:'')+').');}));
    restaurarBarra();contexto.appendChild(seleccionBarra);texto.addEventListener('mouseup',capturarSeleccion);texto.addEventListener('keyup',capturarSeleccion);texto.addEventListener('touchend',capturarSeleccion);
    actualizarInv();
    // Muestra el artículo o la fracción de un ancla; sin ancla válida, el primer artículo. Devuelve el nodo de la fracción, si hay.
    let anclaFijada = null;
    function ir(anclaDestino, empujar) {
      const p = leerAncla(anclaDestino);
      const tr = anclaDestino?.startsWith('transitorio-') ? Array.from(texto.querySelectorAll('[data-transitorio]')).find(x=>x.getAttribute('data-transitorio')===anclaDestino.slice(12)) : null;
      const clave = (anclaDestino === 'transitorios' || tr) && transitorios.length ? 'transitorios' : p && posicion.has(p.n) ? p.n : articulos.length ? articulos[0].n : 'transitorios';
      const cambio = clave !== actual;
      vecindad(clave);
      if (cambio) pintar(clave);
      const final = p && clave === p.n && p.fr ? anclaArticulo(p.n, p.fr, p.inciso) : tr ? anclaDestino : clave === 'transitorios' ? 'transitorios' : anclaArticulo(clave);
      const fr = final.includes('.') ? Array.from(texto.querySelectorAll('[data-ancla]')).find(x => x.tagName!=='A'&&x.getAttribute('data-ancla') === final) : null;
      for (const x of texto.querySelectorAll('.rgl-activa')) x.classList.remove('rgl-activa');
      (tr || fr || secciones.get(clave))?.classList.add('rgl-activa');
      // La hidratación incremental conserva el destino de ruta aunque el lector visible cambie.
      anclaFijada = secciones.get(clave) || null;
      enlaceActual = rutaReglamento(doc, final) + sufijoInvestigacion();
      if (empujar) {
        try { history[cambio ? 'pushState' : 'replaceState'](null, '', enlaceActual); } catch (e) { /* sin historial */ }
        if (indice.open && estrecho()) indice.open = false;
        (tr || fr || secciones.get(clave))?.scrollIntoView({ block: 'start' });
      }
      return fr;
    }
    raizGuia.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[data-ancla]');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button) return;
      if (/[?&]frpos=/.test(a.getAttribute('href')||'')) return;
      e.preventDefault();
      ir(a.getAttribute('data-ancla'), true);
    });
    const consulta = raiz.matchMedia ? raiz.matchMedia('(max-width:768.98px)') : null;
    let eraEstrecho = null;
    const ajustar = () => {
      const chico = estrecho();
      if (chico !== eraEstrecho) {
        indice.open = !chico;
        for (const acciones of texto.querySelectorAll('.rgl-art-acciones')) acciones.open = !chico;
      }
      eraEstrecho = chico;
      const rielEnIndice = !pantallaChica() && ((rejilla.clientWidth > 0 && rejilla.clientWidth <= 832) ||
        !!raiz.matchMedia?.('(max-width:1024.98px)').matches);
      if (rielEnIndice && riel.parentNode !== cuerpoIndice) cuerpoIndice.insertBefore(riel, arbolNav);
      else if (!rielEnIndice && riel.parentNode !== rejilla) rejilla.appendChild(riel);
      // Los capítulos quedan en el flujo. Solo se reserva la barra global para las anclas.
      const altoContexto = contexto.offsetHeight || 0;
      raizGuia.style.setProperty('--ipn-lector-contexto-alto', altoContexto + 'px');
      const altoBarraFija = parseFloat(raiz.getComputedStyle?.(raizGuia).getPropertyValue('--sate-barra-alto')) || 0;
      const margen=(altoBarraFija + 16) + 'px';
      for (const seccion of texto.querySelectorAll('.rgl-articulo,.rgl-fr,.rgl-inc,.rgl-renglon'))
        if(seccion.style.scrollMarginTop!==margen)seccion.style.scrollMarginTop=margen;
    };
    if (consulta?.addEventListener) consulta.addEventListener('change', ajustar);
    ajustar();
    const observador = raiz.ResizeObserver ? new raiz.ResizeObserver(ajustar) : null;
    observador?.observe(rejilla);
    observador?.observe(contexto);
    raiz.addEventListener('resize', ajustar);
    let cuadro = 0;
    const seguir = () => {
      if (cuadro) return;
      cuadro = raiz.requestAnimationFrame(() => {
        cuadro = 0;
        let borde = contexto.getBoundingClientRect().bottom || 0;
        if (estrecho()) {
          const r = indice.querySelector('summary').getBoundingClientRect();
          if (r.top <= borde && r.bottom > borde) borde = r.bottom;
        }
        for (const barra of texto.querySelectorAll('.rgl-encabezado')) {
          const r = barra.getBoundingClientRect(), estilo = raiz.getComputedStyle?.(barra);
          if (estilo?.position === 'sticky' && r.top <= borde && r.bottom > borde) borde = r.bottom;
        }
        const visible = articuloEnGeometria(Array.from(secciones, ([n, seccion]) => ({n, top:(seccion.querySelector('header') || seccion).getBoundingClientRect().top})), borde, anclaFijada?.getAttribute('data-articulo'));
        if (visible) { vecindad(visible); if (visible !== actual) pintar(visible); }
      });
    };
    raiz.addEventListener('scroll', seguir, { passive: true });
    const soltarAncla = () => { anclaFijada = null; seguir(); };
    raiz.addEventListener('wheel', soltarAncla, { passive: true });
    raiz.addEventListener('touchmove', soltarAncla, { passive: true });
    const soltarBarra = e => { if (e.target === document.documentElement) soltarAncla(); };
    raiz.addEventListener('pointerdown', soltarBarra, { passive: true });
    const soltarAnclaTeclado = e => { if (['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(e.key)) soltarAncla(); };
    raiz.addEventListener('keydown', soltarAnclaTeclado);
    let detenido = false, tarea;
    const enReposo = fn => raiz.requestIdleCallback ? raiz.requestIdleCallback(fn, {timeout:1000}) : raiz.setTimeout(fn, 50);
    function sinSalto(fn) {
      const anclaVista = anclaFijada || secciones.get(actual), antes = anclaVista?.getBoundingClientRect().top;
      fn();
      if (antes != null && raiz.scrollBy) {
        const diferencia = anclaVista.getBoundingClientRect().top - antes;
        if (diferencia) raiz.scrollBy(0, diferencia);
      }
    }
    const completarTodo = () => { for (const clave of pendientes.keys()) completar(clave); };
    const continuar = () => {
      if (detenido) return;
      // Lotes pequeños también en el respaldo, para ceder a navegación y scroll.
      sinSalto(() => { for (const clave of Array.from(pendientes.keys()).slice(0, 6)) completar(clave); });
      if (pendientes.size) tarea = enReposo(continuar);
    };
    const interseccion = raiz.IntersectionObserver ? new raiz.IntersectionObserver(entradas => {
      sinSalto(() => { for (const e of entradas) if (e.isIntersecting) vecindad(e.target.getAttribute('data-articulo')); });
    }, {rootMargin:'800px'}) : null;
    for (const n of secciones.values()) interseccion?.observe(n);
    raiz.addEventListener('beforeprint', completarTodo);
    tarea = enReposo(continuar);
    limpiarLector = () => { raiz.removeEventListener('sate-investigacion-nota',actualizarNotas); raiz.removeEventListener('sate-investigacion',actualizarInv); if(raiz.CSS?.highlights)for(const etiqueta of etiquetasInv)raiz.CSS.highlights.delete('sate-inv-'+etiqueta); detenido = true; if (raiz.cancelIdleCallback) raiz.cancelIdleCallback(tarea); else raiz.clearTimeout(tarea); interseccion?.disconnect(); raiz.removeEventListener('beforeprint', completarTodo); if (consulta?.removeEventListener) consulta.removeEventListener('change', ajustar); observador?.disconnect(); raiz.removeEventListener('resize', ajustar); raiz.removeEventListener('scroll', seguir); raiz.removeEventListener('wheel', soltarAncla); raiz.removeEventListener('touchmove', soltarAncla); raiz.removeEventListener('pointerdown', soltarBarra); raiz.removeEventListener('keydown', soltarAnclaTeclado); raiz.cancelAnimationFrame(cuadro); };
    const qInicial = parametroGuia('q');
    const frpos = parametroGuia('frpos');
    const fr = ir(ancla && ancla !== 'texto' ? ancla : '', false);
    if (qInicial) {
      contexto.querySelector('details').open=true;
    }
    const preciso = /^\d+$/.test(frpos) && secciones.get(actual)?.querySelector('[data-fraccion-pos="'+frpos+'"]');
    if (preciso) {
      fr?.classList.remove('rgl-activa'); preciso.classList.add('rgl-activa');
      const sufijo=sufijoInvestigacion();
      history.replaceState(null,'',rutaReglamento(doc,ancla)+sufijo+(sufijo?'&':'?')+'frpos='+frpos);
    }
    const destino = preciso || (ancla && ancla !== 'texto' ? fr || secciones.get(actual) : null);
    // Salto inmediato: un desplazamiento suave largo lo interrumpe el dibujo por partes y no llega al artículo.
    if (destino) { destino.scrollIntoView({ block: 'start' }); SateUI.revelar(destino); }
    return { titulo: cab.titulo, enDocumento: !!destino };
  }
  async function apartadoReglamentos(raizGuia, d, doc, ancla, vigente) {
    if (doc) {
      const [reg] = await Promise.all([cargarReglamento(doc), cargarReferencias()]);
      if (!vigente()) return {};
      return raiz.SateMedicion ? raiz.SateMedicion.render('reglamento ' + doc, () => montarReglamento(raizGuia, d, reg, doc, ancla)) : montarReglamento(raizGuia, d, reg, doc, ancla);
    }
    const cab = cabecera([...migasBase(), { texto: tituloApartado('reglamentos') }], tituloApartado('reglamentos'), t('sate.guia.reglamentos_intro'));
    const indice = await cargarReglamento('indice');
    const docs = Object.entries(d.documentos).filter(([id, x]) => x.reglamento && indice.some(i => i.id === id)).map(([id, x]) => ({ id, ...x }));
    const registros = [];
    let registrosListos, versionBusqueda = 0;
    async function prepararRegistros() {
      return registrosListos ||= Promise.all(docs.map(x => cargarReglamento(x.id)))
        .then(rs => { registros.push(...rs); }).catch(e => { registrosListos = null; throw e; });
    }
    if (!vigente()) return {};
    const lista = h('ul', { 'class': 'rgl-biblioteca' }, docs.map(x => h('li', {}, [
      h('a', { href: x.soloPdf || indice.find(i => i.id === x.id)?.sin_texto ? x.url : rutaGuia('reglamentos', x.id), 'class': 'rgl-libro' }, [
        h('strong', { 'class': 'rgl-siglas', texto: x.siglas || x.titulo.split(/\s+/).filter(p => /^[A-ZÁÉÍÓÚÑ]/.test(p) && !/^(IPN|Instituto|Politécnico|Nacional)$/.test(p)).map(p => p[0]).join('') }),
        h('h4', { texto: x.titulo }), h('small', { texto: x.gaceta }),
        h('span', { texto: indice.find(i => i.id === x.id)?.articulos ? t('sate.guia.numero_articulos', { n: indice.find(i => i.id === x.id).articulos }) : t(x.soloPdf || indice.find(i => i.id === x.id)?.sin_texto ? 'sate.guia.rgl_solo_pdf' : 'sate.guia.rgl_texto_completo') }),
        x.soloPdf ? h('small', {'class':'rgl-libro__nota',texto:t('sate.guia.rgl_solo_pdf_nota')}) : null])])));
    const resultados = h('ul', { 'class': 'guia-resultados', hidden: true, 'aria-live': 'polite' });
    const pintarResultados = async q => {
      const mi = ++versionBusqueda;
      if (terminos(q).length) await prepararRegistros();
      if (mi !== versionBusqueda || !vigente()) return;
      const encontrados = registros.flatMap(reg => buscarArticulos(reg, q, 4).map(a => ({ reg, a }))).slice(0, 12);
      resultados.hidden = !terminos(q).length;
      resultados.replaceChildren(...encontrados.map(({ reg, a }) => h('li', {}, [h('a', {
        'class': 'guia-resultado', href: rutaReglamento(reg.id, anclaArticulo(a.n))
      }, [h('strong', { texto: reg.titulo + ' · ' + (a.n === 'texto' ? t('sate.guia.rgl_texto_completo') : t('sate.guia.rgl_art_corto', { n: a.n })) }), h('small', { texto: fragmento(a.texto,q) })])])));
      if (!encontrados.length) resultados.appendChild(h('li', { 'class': 'guia-vacio', texto: t('sate.guia.rgl_resultados', { n: 0 }) }));
    };
    const falloBusqueda=e=>console.warn('SATE: búsqueda en reglamentos no disponible',{unidad:unidad(),mensaje:e.message,pila:e.stack});
    const buscar = SateUI.buscador({ etiqueta: t('sate.guia.rgl_buscar_todos'), marcador: t('sate.guia.rgl_buscar_marcador'), alCambiar: q=>pintarResultados(q).catch(falloBusqueda) });
    const sugerencias = h('div', { 'class': 'rgl-sugerencias' }, ['baja', 'recursar', 'plazo'].map(clave => {
      const boton = h('button', { type: 'button', 'class': 'btn', texto: t('sate.guia.rgl_sugerencia_' + clave) });
      boton.addEventListener('click', () => {
        const q = t('sate.guia.rgl_sugerencia_' + clave);
        buscar.raiz.querySelector('input').value = q;
        pintarResultados(q).catch(falloBusqueda);
      });
      return boton;
    }));
    const temasLista = h('div', { 'class': 'rgl-temas__opciones' });
    const temaArticulos = h('div', { 'class': 'rgl-temas__articulos', 'aria-live': 'polite' });
    const temas = [ ['trayectoria', /regular|plazo|trayectoria/], ['oportunidades', /recurs|acredita|ets/], ['carga', /carga|creditos/],
      ['bajas', /baja/], ['dictamen', /dictamen/], ['inconformidad', /inconform|reconsidera|apelacion/] ];
    let versionTema = 0;
    async function elegirTema(clave, patron) {
      const mi = ++versionTema;
      const completo = await datos('preguntas');
      const preguntas = (completo.preguntas || []).filter(p => patron.test(norm([p.pregunta, ...(p.palabras || [])].join(' '))));
      const ids = [...new Set(preguntas.flatMap(p => (p.fuentes || []).map(f => f.doc)))];
      const documentos = await Promise.all(ids.map(cargarReglamento));
      if (mi !== versionTema || !vigente()) return;
      for (const boton of temasLista.children) boton.setAttribute('aria-pressed', String(boton.dataset.tema === clave));
      const citas = new Map();
      for (const p of preguntas) for (const f of p.fuentes || []) for (const n of f.arts || []) {
        const reg = documentos.find(x => x.id === f.doc), a = reg?.articulos?.find(x => x.n === n);
        if (a && !citas.has(f.doc + ':' + n)) citas.set(f.doc + ':' + n, { reg, a, pregunta: p.pregunta });
      }
      temaArticulos.replaceChildren(h('h4', { texto: t('sate.guia.rgl_tema_' + clave) }), h('ul', { 'class': 'rgl-temas__lista' }, [...citas.values()].map(({ reg, a, pregunta }) => h('li', {}, [
        h('a', { href: rutaReglamento(reg.id, anclaArticulo(a.n)), 'class': 'guia-resultado' }, [h('strong', { texto: pregunta }),
          h('small', { texto: reg.titulo + ' · ' + t('sate.guia.rgl_art_corto', { n: a.n }) }), h('span', { texto: a.texto.slice(0, 160) })])]))));
      if (!citas.size) temaArticulos.appendChild(h('p', { texto: t('sate.guia.rgl_resultados', { n: 0 }) }));
    }
    for (const [clave, patron] of temas) {
      const boton = h('button', { type: 'button', 'data-tema': clave, texto: t('sate.guia.rgl_tema_' + clave), 'aria-pressed': 'false' });
      boton.addEventListener('click', () => elegirTema(clave, patron).catch(falloBusqueda));
      temasLista.appendChild(boton);
    }
    const portal = d.documentos.normatividad;
    raizGuia.append(cab.nodo, h('div', { 'class': 'guia-apartado rgl-explorador' }, [buscar.raiz, sugerencias, resultados,
      h('section', {}, [h('h3', { texto: t('sate.guia.rgl_biblioteca') }), lista]),
      h('section', { 'class': 'rgl-temas' }, [h('div', {}, [h('h3', { texto: t('sate.guia.rgl_temas') }), temasLista]), temaArticulos]),
      h('a', { href: rutaGuia('glosario'), texto: t('sate.guia.glosario') }),
      portal ? enlaceExterno('guia-portal sate-enlace', portal.url, t('sate.guia.normatividad_portal')) : null]));
    return { titulo: cab.titulo };
  }
  function apartadoGlosario(raizGuia, d, id) {
    const cab = cabecera([...migasBase(), { texto: t('sate.guia.glosario') }], t('sate.guia.glosario'));
    const lista = h('dl', { 'class': 'guia-glosario' });
    const entradas = Object.values(d.glosario || {}).sort((a, b) => a.termino.localeCompare(b.termino, 'es'));
    function pintar(q) {
      lista.replaceChildren(...entradas.filter(g => norm(g.termino + ' ' + g.definicion).includes(norm(q))).map(g => {
        const f = fuente(d, g.fuente, t);
        const clave = Object.keys(d.glosario).find(k => d.glosario[k] === g);
        return h('div', {'data-glosario':clave}, [h('dt', { texto: g.termino }), h('dd', {}, [h('p', { texto: g.definicion }), f ? enlaceExterno('', f.url, f.texto) : null, ...(f?.arts || []).map(n => botonArticulo(f.doc, n, t('sate.guia.articulo_rotulo', { n })))])]);
      }));
    }
    const buscar = SateUI.buscador({ etiqueta: t('sate.guia.buscar_glosario'), marcador: t('sate.guia.buscar_glosario'), alCambiar: pintar });
    pintar('');
    raizGuia.append(cab.nodo, buscar.raiz, lista);
    return { titulo: cab.titulo, destino:id ? lista.querySelector('[data-glosario="'+id+'"]') : null };
  }
  function apartadoAcudir(raizGuia, d, abrirId) {
    const tx = k => t('sate.guia.r10.' + k);
    const cab = cabecera([...migasBase(), { texto: tituloApartado('acudir') }], tituloApartado('acudir'), t('sate.guia.acudir_intro'));
    const instancias = new Map(d.acudir.map(a => [a.id, a]));
    const nodos = [], org = d.organigrama;
    function agregar(nombre, padre, colegiado) {
      const existente = d.acudir.find(a => a.nombre === nombre);
      const id = existente?.id || org?.ids?.[nombre] || 'org-' + nodos.length;
      const a = existente || { id, nombre, ambito: 'unidad', para: '', fuente: { doc: org.documento } };
      instancias.set(id, a);
      nodos.push({ id, padre, colegiado });
      return id;
    }
    if (org) {
      const r = agregar(org.raiz.nombre, null);
      for (const nombre of org.raiz.colegiados || []) agregar(nombre, r, true);
      for (const nombre of org.raiz.apoyo || []) { const id = agregar(nombre, r); nodos.find(n => n.id === id).apoyo = true; }
      for (const area of org.raiz.areas || []) {
        const id = agregar(area.nombre, r);
        for (const nombre of area.dependencias || []) agregar(nombre, id);
        for (const nombre of area.colegiados || []) agregar(nombre, id, true);
      }
    }
    for (const a of d.estructuraCentral || []) {
      instancias.set(a.id, { ...a, nombre: a.nombreClave ? t(a.nombreClave) : a.nombre, para: a.paraClave ? t(a.paraClave) : a.para });
      nodos.push({ id: a.id, padre: a.depende || null });
    }
    // Las relaciones adicionales se declaran en datos; no se deducen de los nombres.
    for (const a of d.acudir) {
      const padre = a.depende || null;
      const nodo = nodos.find(n => n.id === a.id);
      if (!nodo) nodos.push({ id: a.id, padre });
      else if (padre) nodo.padre = padre;
    }
    let vista = 'directorio', ambito = '', elegido = abrirId || d.acudir[0]?.id;
    const abiertos = new Set();
    const cuerpo = h('div', { 'class': 'guia-directorio' });
    const barra = h('div', { 'class': 'guia-controles' });
    const filtros = h('div', { 'class': 'guia-controles' });
    const resumen = h('p', { role: 'status', 'aria-live': 'polite', 'class': 'guia-resumen' });
    const buscar = SateUI.buscador({ etiqueta: tx('necesidad'), marcador: tx('necesidad'), id: 'guia-necesidad', alCambiar: pintar });
    function seleccionar(a) {
      elegido = a.id;
      document.title = a.nombre + ' — ' + t('sate.pestana.guia.titulo');
      history.replaceState(null, '', rutaGuia('acudir', a.id));
      if (raiz.matchMedia('(max-width:899px)').matches) SateUI.modal(a.nombre, ficha(a));
      else pintar();
    }
    function ficha(a) {
      const f = fuente(d, a.fuente, t), padre = nodos.find(n => n.id === a.id)?.padre;
      const rel = d.preguntas.filter(p => (p.acudir || []).includes(a.id));
      const campo = (titulo, contenido) => h('div', {}, [h('dt', { texto: titulo }), h('dd', {}, contenido)]);
      const cita = ref => {
        const s = fuente(d, ref, t);
        return s ? enlaceExterno('', s.url + (ref.pagina ? '#page=' + ref.pagina : ''), s.texto) : null;
      };
      return h('article', { 'class': 'guia-ficha' }, [h('small', { texto: t('sate.guia.acudir_' + (a.ambito || 'unidad')) }), a.pendiente ? h('strong', { texto: tx('confirmar') }) : null, h('h3', { texto: a.nombre }),
        h('dl', {}, [campo(a.orientacion ? tx('orientacion_propia') : tx('atiende'), [h('p', {}, enLinea(a.orientacion?.texto || a.para || tx('sin_descripcion'), d)),
          ...(a.necesidades || []).map(n => h('p', { texto: t(n.texto) + (n.pendiente ? ' · ' + tx('confirmar') : '') }))]),
          a.objetivo ? campo(tx(a.objetivo.alcance === 'unidad' ? 'objetivo_unidad' : 'objetivo_oficial'), [h('blockquote', { 'class': 'pc-lector pc-oficial', 'data-oficial': a.objetivo.fuente.doc, texto: a.objetivo.texto }), cita(a.objetivo.fuente)]) : null,
          a.funciones?.length ? campo(t('sate.guia.funciones_manual'), [h('ul', { 'class': 'guia-funciones pc-lector pc-oficial', 'data-oficial': a.funciones[0].fuente.doc }, a.funciones.map((x,i) => h('li', { 'data-funcion':i+1, 'data-oficial': x.fuente.doc }, [h('p', { texto: x.texto }), cita(x.fuente)])))]) : null,
          campo(tx('depende'), [instancias.get(padre)?.nombre || a.dependenciaTexto || tx('confirmar'), a.fuenteDependencia ? cita(a.fuenteDependencia) : null]),
          // Sin procedimientos asignados en el manual no se muestra el bloque (la nota queda en los datos).
          a.procedimientos?.length ? campo(tx('procedimientos'), [h('ul', { 'class': 'guia-procedimientos' }, a.procedimientos.map(x => h('li', {}, [h('strong', { 'data-oficial': x.fuente.doc, texto: x.nombre }), h('p', { texto: x.participacion }), cita(x.fuente)]))), h('p', { texto: a.procedimientosNota })]) : null,
          campo(tx('contacto'), enLinea(a.contacto || tx('confirmar'), d)),
          campo(t('sate.guia.fuentes_titulo', { n: f ? 1 : 0 }), [f ? enlaceExterno('', f.url, f.texto) : tx('confirmar'), a.ambito !== 'ipn' && org ? h('p', { texto: tx('fuente_estructura') }) : null]),
          rel.length ? campo(tx('relacionadas'), [h('ul', {}, rel.map(p => h('li', {}, [h('a', { href: rutaGuia(p.apartado, p.id), texto: p.pregunta })])))]) : null])]);
    }
    function pintar() {
      const ts = terminos(buscar.entrada.value);
      const preguntas = ts.length ? buscarPreguntas(d.preguntas, buscar.entrada.value) : [];
      const resultados = [...instancias.values()].filter(a => (vista === 'jerarquia' || a.para) && (!ambito || (a.ambito || 'unidad') === ambito) && (!ts.length || ts.every(w => norm([a.nombre, a.para, ...(a.funciones || []).map(x => x.texto), ...(a.procedimientos || []).map(x => x.nombre), ...(a.palabras || []), ...(a.necesidades || []).flatMap(n => [t(n.texto), ...(n.palabras || [])])].join(' ')).includes(w)) || preguntas.some(p => (p.acudir || []).includes(a.id))));
      const ids = new Set(resultados.map(a => a.id));
      resultados.sort((a, b) => Number(a.ambito === 'ipn') - Number(b.ambito === 'ipn'));
      if (!instancias.has(elegido) || vista === 'directorio' && !ids.has(elegido)) elegido = resultados[0]?.id;
      barra.replaceChildren(...['directorio', 'jerarquia'].map(v => {
        const b = h('button', { type: 'button', 'aria-pressed': String(vista === v), texto: tx(v) });
        b.addEventListener('click', () => { if (v === 'jerarquia' && vista !== v) elegido = nodos.find(n => !n.padre && instancias.get(n.id).ambito !== 'ipn')?.id; vista = v; pintar(); barra.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true }); }); return b;
      }));
      filtros.replaceChildren(...['', 'unidad', 'ipn'].map(v => {
        const b = h('button', { type: 'button', 'aria-pressed': String(ambito === v), texto: v ? t('sate.guia.acudir_' + v) : tx('todo') });
        b.addEventListener('click', () => { ambito = v; pintar(); filtros.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true }); }); return b;
      }));
      function boton(a) {
        const b = h('button', { type: 'button', 'class': 'guia-elegir', 'data-instancia': a.id, 'aria-current': elegido === a.id ? 'true' : null, texto: a.nombre });
        b.addEventListener('click', () => {
          seleccionar(a);
          if (raiz.matchMedia('(min-width:900px)').matches) cuerpo.querySelector('[data-instancia="' + a.id + '"]')?.focus({ preventScroll: true });
        }); return b;
      }
      function nodo(n) {
        const hijos = nodos.filter(x => x.padre === n.id);
        const a = instancias.get(n.id);
        if (ambito && (a.ambito || 'unidad') !== ambito) return null;
        const rama = hijos.map(nodo).filter(Boolean);
        const b = boton(a);
        if (ts.length && ids.has(n.id)) b.classList.add('guia-coincide');
        const caja = h('span', { 'class': 'guia-nodo' + (ts.length && !ids.has(n.id) ? ' guia-nodo--tenue' : '') }, [b,
          n.colegiado || n.apoyo ? h('small', { texto: tx(n.colegiado ? 'colegiado' : 'apoyo') }) : null]);
        if (!rama.length) return h('li', {}, [caja]);
        const resumenRama = h('summary', {}, [caja, h('small', { texto: tx('dependencias').replace('{n}', String(hijos.length)) })]);
        resumenRama.addEventListener('click', e => {
          if (e.target === b) return;
          elegido = a.id;
          for (const actual of cuerpo.querySelectorAll('[data-instancia]')) actual.removeAttribute('aria-current');
          b.setAttribute('aria-current', 'true');
          if (raiz.matchMedia('(max-width:899px)').matches) SateUI.modal(a.nombre, ficha(a));
          else cuerpo.querySelector('.guia-ficha-panel')?.replaceChildren(ficha(a));
        });
        const det = h('details', { open: ts.length > 0 || abiertos.has(n.id) || n.padre === null }, [resumenRama, h('ul', {}, rama)]);
        det.addEventListener('toggle', () => { if (det.open) abiertos.add(n.id); else abiertos.delete(n.id); });
        return h('li', {}, [det]);
      }
      function fila(a) {
        // La ficha conserva el texto completo; el resumen de la lista nunca corta una marca.
        const primera = a.para.match(/^(?:\[\[[\s\S]*?\]\]|[^.!?;])*[.!?;](?=\s|$)/)?.[0] || a.para;
        return h('li', {}, [boton(a), h('small', { texto: t('sate.guia.acudir_' + (a.ambito || 'unidad')) }), h('p', {}, enLinea(primera, d))]);
      }
      const lista = vista === 'directorio' ? h('ul', { 'class': 'guia-directorio-lista' }, resultados.filter(a => a.para).map(fila)) : h('div', { 'class': 'guia-arbol' }, [...['unidad', 'ipn'].filter(v => !ambito || ambito === v).map(v => h('section', {}, [h('h3', { texto: t('sate.guia.acudir_' + v) }), h('ul', {}, nodos.filter(n => !n.padre && (instancias.get(n.id).ambito || 'unidad') === v).map(nodo))])), org ? h('p', { 'class': 'guia-arbol-fuente', texto: tx('fuente_estructura') }) : null]);
      const a = instancias.get(elegido);
      cuerpo.replaceChildren(lista, h('aside', { 'class': 'guia-ficha-panel' }, a ? [ficha(a)] : []));
      resumen.textContent = t(resultados.length ? 'sate.guia.detalle_instancias' : 'sate.guia.sin_resultados_preguntas', { n: resultados.length });
    }
    raizGuia.append(cab.nodo, h('div', { 'class': 'guia-apartado' }, [h('div', { 'class': 'guia-barra' }, [buscar.raiz, barra]), filtros, resumen, cuerpo]));
    pintar();
    if (abrirId && instancias.has(abrirId) && raiz.matchMedia('(max-width:899px)').matches) seleccionar(instancias.get(abrirId));
    return { titulo: cab.titulo };
  }

  async function apartadoAcudirManual(raizGuia, d, abrirId) {
    const tx = k => t('sate.guia.manual.' + k);
    const leer = ruta => SATE.json ? SATE.json('datos/manuales/' + ruta) : fetch('datos/manuales/' + ruta).then(r => {
      if (!r.ok) throw new Error(ruta + ': HTTP ' + r.status);
      return r.json();
    });
    const indice = await leer('indice.json').catch(() => null);
    if (!indice?.unidades?.length) return apartadoAcudir(raizGuia, d, abrirId);
    const cab = cabecera([...migasBase(), {texto: tituloApartado('acudir')}], tituloApartado('acudir'), t('sate.guia.acudir_intro'));
    const unidades = indice.unidades;
    const predeterminado = indice.sate[unidad()] || unidades[0]?.siglas;
    const tipos = [...new Set(unidades.map(u => u.tipo))].sort((a,b) => a.localeCompare(b, 'es'));
    const claveTipo = tipo => ({'nivel medio superior':'tipo_nivel_medio_superior','nivel superior':'tipo_nivel_superior',
      'investigación científica y tecnológica':'tipo_investigacion','vinculación y desarrollo regional':'tipo_vinculacion',
      'órgano de apoyo':'tipo_organos_apoyo','área central':'tipo_areas_centrales','unidad administrativa':'tipo_unidades_administrativas'}[tipo] || 'tipo_otros');
    const selector = h('select', {'class':'guia-manual-selector', 'aria-label':tx('elegir_unidad')}, [
      h('optgroup', {label:tx('general')}, [h('option', {value:'general', texto:tx('general')})]),
      ...tipos.map(tipo => h('optgroup', {label:tx(claveTipo(tipo))}, unidades.filter(u => u.tipo === tipo)
        .sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')).map(u => h('option', {value:u.siglas, texto:u.nombre}))))
    ]);
    selector.value = predeterminado;
    const resumen = h('p', {role:'status', 'aria-live':'polite', 'class':'guia-resumen'});
    const cuerpo = h('div', {'class':'guia-directorio'});
    const barra = h('div', {'class':'guia-manual-barra'}, [h('label', {}, [h('span', {texto:tx('elegir_unidad')}), selector])]);
    let actual = null, seleccionado = null, consulta = '', secuencia = 0;
    const buscar = SateUI.buscador({etiqueta:tx('necesidad'), marcador:tx('necesidad'), id:'guia-necesidad', alCambiar:q => { consulta=q; pintar(); }});
    raizGuia.append(cab.nodo, h('div', {'class':'guia-apartado'}, [barra, buscar.raiz, resumen, cuerpo]));

    function ficha(area) {
      const mapa = new Map(actual.areas.map(a => [a.id,a]));
      const curada = selector.value === predeterminado ? d.acudir.find(a => norm(a.nombre) === norm(area.nombre)) : null;
      const preguntas = curada ? d.preguntas.filter(p => (p.acudir || []).includes(curada.id)) : [];
      const grupo = area.grupo && actual.grupos?.[area.grupo];
      const objetivo = area.objetivo || grupo?.objetivo;
      const funciones = area.funciones.length ? area.funciones : grupo?.funciones || [];
      const doc = selector.value === 'general' ? 'mog' : 'mo';
      const info = selector.value === 'general' ? indice.general : unidades.find(u => u.siglas === selector.value);
      const cita = (tipo, pagina, etiqueta) => h('a', {href:info.pdf[tipo] + (pagina ? '#page=' + pagina : ''), target:'_blank', rel:'noopener noreferrer',
        texto:etiqueta || tx(tipo === 'MP' ? 'cita_mp' : doc === 'mog' ? 'cita_mog' : 'cita_mo').replace('{unidad}',info.nombre).replace('{pagina}',pagina || '')});
      const rangoPaginas = lista => { const ps=lista.map(x=>x.p).filter(Number.isFinite); return ps.length ? Math.min(...ps) === Math.max(...ps) ? String(ps[0]) : Math.min(...ps)+'–'+Math.max(...ps) : ''; };
      const campo = (titulo, nodos) => h('div', {}, [h('dt', {texto:titulo}), h('dd', {}, nodos)]);
      const padre = mapa.get(area.depende_de);
      const dependiente = padre ? h('button', {type:'button', 'class':'guia-elegir', texto:padre.nombre}) : null;
      if (padre) dependiente.addEventListener('click', () => elegir(padre));
      const procedimientos = actual.procedimientos.filter(p => p.area && norm(p.area) === norm(area.nombre));
      return h('article', {'class':'guia-ficha'}, [
        h('h3', {'data-oficial':doc, texto:area.nombre}),
        h('dl', {}, [
          padre ? campo(tx('depende'), [dependiente]) : null,
          curada?.para || curada?.orientacion ? campo(tx('orientacion'), [h('p', {}, enLinea(curada.orientacion?.texto || curada.para, d))]) : null,
          objetivo ? campo(tx('objetivo'), [h('p', {'data-oficial':doc, texto:objetivo.t}), cita('MO', objetivo.p)]) : null,
          funciones.length ? campo(tx('funciones'), [cita('MO', funciones[0].p, tx('cita_bloque_mo').replace('{paginas}', rangoPaginas(funciones))), h('ul', {'class':'guia-funciones'}, funciones.map(f => h('li', {}, [h('p', {'data-oficial':doc, texto:f.t}), cita('MO',f.p, tx('pagina').replace('{pagina}',f.p))])))]) : null,
          procedimientos.length ? campo(tx('procedimientos'), [cita('MP', procedimientos[0].pagina, tx('cita_bloque_mp').replace('{paginas}', rangoPaginas(procedimientos.map(p => ({p:p.pagina}))))), h('ul', {'class':'guia-procedimientos'}, procedimientos.map(p => h('li', {}, [h('strong', {'data-oficial':'mp', texto:p.nombre}), p.objetivo ? h('p', {'data-oficial':'mp', texto:p.objetivo.t}) : null, cita('MP',p.pagina, tx('pagina').replace('{pagina}',p.pagina))])))]) : null,
          preguntas.length ? campo(tx('preguntas'), [h('ul', {}, preguntas.map(p => h('li', {}, [h('a', {href:rutaGuia(p.apartado,p.id), texto:p.pregunta})])))]) : null
        ])
      ]);
    }
    function elegir(area) {
      seleccionado = area.id;
      document.title = area.nombre + ' — ' + t('sate.pestana.guia.titulo');
      if (selector.value === predeterminado) history.replaceState(null, '', rutaGuia('acudir', d.acudir.find(a => norm(a.nombre) === norm(area.nombre))?.id || area.id));
      else history.replaceState(null, '', rutaGuia('acudir'));
      if (raiz.matchMedia('(max-width:899px)').matches) SateUI.modal(area.nombre, ficha(area));
      else pintar();
    }
    function pintar() {
      if (!actual) return;
      const mapa = new Map(actual.areas.map(a => [a.id,a]));
      const palabras = terminos(consulta);
      const coincide = a => palabras.every(w => norm([a.nombre, ...a.funciones.map(f => f.t), ...(actual.grupos?.[a.grupo]?.funciones || []).map(f => f.t)].join(' ')).includes(w));
      const encontrados = palabras.length ? actual.areas.filter(coincide) : actual.areas;
      const visibles = new Set(encontrados.map(a => a.id));
      if (palabras.length) for (const a of encontrados) {
        let padre = a.depende_de;
        while (padre && !visibles.has(padre)) { visibles.add(padre); padre = mapa.get(padre)?.depende_de; }
      }
      const hijos = new Map();
      for (const a of actual.areas) {
        if (!visibles.has(a.id)) continue;
        const padre = mapa.has(a.depende_de) ? a.depende_de : null;
        if (!hijos.has(padre)) hijos.set(padre, []);
        hijos.get(padre).push(a);
      }
      function rama(a) {
        const descendientes = hijos.get(a.id) || [];
        const boton = h('button', {type:'button', 'class':'guia-elegir', 'data-instancia':a.id,
          'aria-current':seleccionado === a.id ? 'true' : null, 'data-oficial':selector.value === 'general' ? 'mog':'mo', texto:a.nombre});
        boton.addEventListener('click', e => { e.preventDefault(); elegir(a); });
        if (!descendientes.length) return h('li', {}, [boton]);
        const profundidad = (() => { let n=a, nivel=0; while (n.depende_de && mapa.has(n.depende_de)) { nivel++; n=mapa.get(n.depende_de); } return nivel; })();
        const mog = selector.value === 'general';
        return h('li', {}, [h('details', {open:palabras.length > 0 || (mog ? profundidad < 2 : profundidad === 0)}, [
          h('summary', {}, [boton]), h('ul', {}, descendientes.map(rama))])]);
      }
      const lista = h('div', {'class':'guia-arbol'}, [h('ul', {}, (hijos.get(null) || []).map(rama))]);
      const area = mapa.get(seleccionado);
      cuerpo.replaceChildren(lista, h('aside', {'class':'guia-ficha-panel'}, area ? [ficha(area)] : []));
      resumen.textContent = t(encontrados.length ? 'sate.guia.detalle_instancias' : 'sate.guia.sin_resultados_preguntas', {n:encontrados.length});
    }
    async function cambiar() {
      const mi = ++secuencia;
      const info = selector.value === 'general' ? indice.general : unidades.find(u => u.siglas === selector.value);
      resumen.textContent = tx('cargando');
      try {
        const datosManual = await leer(info.archivo);
        if (mi !== secuencia) return;
        actual = datosManual;
        seleccionado = selector.value === predeterminado ? datosManual.areas.find(a => norm(a.nombre) === norm(d.acudir.find(x => x.id === abrirId)?.nombre))?.id : null;
        seleccionado ||= datosManual.areas.find(a => !a.depende_de)?.id;
        pintar();
        if (abrirId && seleccionado && raiz.matchMedia('(max-width:899px)').matches && selector.value === predeterminado) elegir(datosManual.areas.find(a => a.id === seleccionado));
      } catch (e) { resumen.textContent = tx('error'); throw e; }
    }
    selector.addEventListener('change', cambiar);
    await cambiar();
    return {titulo:cab.titulo};
  }

  // La portada y las rutas de orientación usan el mismo catálogo filtrado en la compilación.
  function catalogoActividades(d, opciones={}) {
    const zona = raiz.SateActividades.crear(d.actividades, {texto:t, seccion:opciones.categoria,
      actividad:parametroGuia('actividad')});
    const preguntas = h('section', {'class':'act-preguntas'});
    for (const p of opciones.preguntas || []) {
      const b = h('button', {type:'button', 'class':'sate-btn', 'data-pregunta':p.id, texto:p.pregunta});
      b.addEventListener('click', () => SateUI.modal(p.pregunta, respuesta(d,p), {lectura:true, flotante:true, origen:b,
        volver:t('sate.guia.actividades_volver')}));
      preguntas.appendChild(b);
    }
    if (preguntas.childNodes.length) zona.querySelector('.act-panel').appendChild(preguntas);
    return zona;
  }

  function apartadoActividades(raizGuia, d, id) {
    const cab=cabecera([...migasBase(),{texto:tituloApartado('actividades')}],tituloApartado('actividades'),t('sate.guia.actividades_descripcion'));
    const rutas=(d.orientacion?.rutas || []).filter(r=>r.actividades);
    const preguntas=d.preguntas.filter(p=>rutas.some(r=>r.preguntas.includes(p.id)));
    raizGuia.append(cab.nodo,catalogoActividades(d,{categoria:id,preguntas}));
    return {titulo:cab.titulo, destino:raizGuia.querySelector('[data-destino]')};
  }

  /* ---------- pestaña ---------- */
  let token = 0;
  async function mostrar(r) {
    const caja = document.getElementById('sate-guia'), mi = ++token;
    const [apartado, id, ancla] = (r && r.partes) || [];
    document.title = t('sate.pestana.guia.titulo') + ' — SATE';
    apagarLector();
    const raizGuia = h('div', { 'class': 'tmr guia' });
    caja.replaceChildren(raizGuia);
    try {
      const compartido=parametroGuia('inv'),artsCompartidos=parametroGuia('arts');
      investigacionCompartida=null;
      if(compartido){
        const entrada=await decodificarInv(compartido);
        const revisada=await revisarInvestigacion(entrada,cargarReglamento,entrada.version===1);
        if(mi!==token)return;
        investigacionCompartida=revisada;
      }else if(artsCompartidos){
        investigacionCompartida=migrarInvestigacion({formato:'sate-investigacion',version:1,nombre:ti('compartida'),proposito:'estudio',autor:'',etiquetas:[],marcadores:artsCompartidos.split(',').map(x=>{const [doc,n,fr='']=x.split(':');return {doc,n,fr,anotaciones:[]};})});
      }
      let foco;
      if (apartado === 'investigacion' && cfg().guiaDatos) foco=await vistaInvestigacion(raizGuia);
      else if (apartado === 'ruta' && cfg().guiaDatos) foco=rutaGuiada(raizGuia,await datos('actividades'),id);
      else if (!apartado || !(apartado === 'glosario' && cfg().guiaDatos) && !apartados().some(a => a.id === apartado && !a.vista)) foco = await portada(raizGuia);
      else {
        const d = await datos(apartado === 'acudir' ? 'acudir' : apartado === 'actividades' ? 'actividades' : ['reglamentos','glosario'].includes(apartado) ? '' : 'preguntas');
        const a = infoApartado(apartado);
        if (mi !== token) return;
        const x = apartado === 'glosario' ? apartadoGlosario(raizGuia, d, id) : a.datos === 'actividades' ? apartadoActividades(raizGuia, d, id) : a.datos === 'faq' ? apartadoPreguntas(raizGuia, d, apartado, id) : a.datos === 'documentos' ? await apartadoReglamentos(raizGuia, d, id, ancla, () => mi === token) : await apartadoAcudirManual(raizGuia, d, id);
        if (apartado === 'acudir' && id) document.title=(d.acudir.find(a=>a.id===id)?.nombre || tituloApartado(apartado))+' — '+t('sate.pestana.guia.titulo');
        foco = x.titulo;
        if (mi === token && !(apartado === 'reglamentos' && id)) {
          const nombre = foco?.textContent || tituloApartado(apartado);
          const todos = h('a', {href:rutaGuia(), texto:bt('toda')});
          todos.addEventListener('click', () => { todos.setAttribute('href',rutaGuia()+'?q='+encodeURIComponent(raizGuia.querySelector('input[type="search"]')?.value || '')); });
          raizGuia.querySelector('.guia-cab')?.appendChild(h('p', {'class':'guia-busqueda-ambito'}, [bt('en',{nombre}), ' · ', todos]));
        }
        if (mi === token && apartado === 'acudir' && id) {
          const f = parametroGuia('funcion');
          const nodo = f && raizGuia.querySelector('[data-funcion="' + f + '"]');
          if (nodo) { SateUI.revelar(nodo); return; }
        }
        if (mi === token && x.enDocumento) return;
        if (mi === token && x.destino) { SateUI.revelar(x.destino); return; }
      }
      if (mi !== token) return;
      if (foco) foco.focus({ preventScroll: true });
      if (raiz.scrollTo) raiz.scrollTo(0, 0);
    } catch (e) {
      if (mi !== token) return;
      console.warn('SATE: Guía no disponible', { unidad: unidad(), ruta: raiz.location.hash, mensaje: e.message });
      const otra = h('button', { type: 'button', 'class': 'btn', texto: t('sate.guia.reintentar') });
      otra.addEventListener('click', () => mostrar(r));
      raizGuia.replaceChildren(h('p', { 'class': 'tmr-vacio', role: 'alert', texto: t('sate.guia.error_datos') }), otra);
    }
  }
  SATE.guia = { datos, buscador:buscadorIndice, enlace: (...p) => rutaGuia(...p) };
  SATE.pestana('guia', { montar() {}, mostrar(r) { return mostrar(r).catch(e => SATE.error(e)); }, ocultar() { token++; apagarLector(); } });
})(typeof window !== 'undefined' ? window : globalThis);
