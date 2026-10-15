/* Pruebas aleatorias de perfiles académicos (fuzz) para Horarios.
 *
 * Se inyecta al final de una página compilada (web/dist/qa-fuzz-<unidad>.html, ver tests/test_fuzz_perfiles.py) y usa
 * sus funciones reales. Genera perfiles ficticios con trayectorias raras, reproducibles por semilla, y revisa
 * invariantes que nunca deben romperse. El resultado se escribe en <pre id="fuzz-resultado"> como JSON.
 *
 * Escenarios: regular, huecos y adelantos sin seriación, cambio de carrera (revalidaciones de semestres altos, claves de
 * otros planes, electivas revalidadas que suman créditos sin materia en el kárdex), muchas reprobadas y desfases,
 * recursamientos, historias largas con periodos faltantes, datos sucios (calificaciones inválidas, duplicados, nulos),
 * primer ingreso y egresado. Cada perfil se prueba con y sin simulación, y con exclusiones de profesores y franja horaria.
 * Todos los nombres y boletas son ficticios.
 */
(async function () {
  const P = new URLSearchParams(location.search);
  const N = +(P.get('n') || window.FUZZ_N || 120), SEMILLA = +(P.get('semilla') || window.FUZZ_SEMILLA || 1);
  const out = { unidad: UNIDAD, n: N, semilla: SEMILLA, casos: 0, fallas: [], escenarios: {},
    cobertura: { personal: 0, conFin: 0, conSugerencias: 0, horariosGenerados: 0, conReprobadas: 0, conEnCurso: 0, simulacion: 0 } };

  // PRNG reproducible (mulberry32)
  let st = SEMILLA >>> 0;
  const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1)), pick = a => a[Math.floor(rnd() * a.length)], chance = p => rnd() < p;
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  const carreras = Object.keys(DATA.mapas || {});
  for(const car of carreras){
    const c=DATA.mapas[car].cur;
    for(const [k,v] of Object.entries(c)){
      const d=v[4];
      if(d&&(d.cr!==v[1]||d.cr_calculado&&(!Number.isFinite(d.satca)||!(d.cr>0))))
        out.fallas.push({regla:'créditos en escala TEPIC y SATCA conservado',car,k,datos:d});
    }
  }
  const cal = () => pick([10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 6]);
  const ESCENARIOS = ['regular', 'huecos', 'cambio_carrera', 'electivas_revalidadas', 'muchas_reprobadas', 'recursamiento',
    'historia_larga', 'datos_sucios', 'primer_ingreso', 'egresado', 'mezcla'];

  function perfil(esc) {
    const car = pick(carreras), m = DATA.mapas[car], c = m.cur;
    const op = DATA.opciones_plan?.[car] || { carrera: car, plan: null };
    const ob = Object.keys(c).filter(k => c[k][3] === 'O' && !isElec(k) && c[k][1] > 0).sort((a, b) => c[a][2] - c[b][2] || a.localeCompare(b));
    const todas = Object.keys(c);
    const total = ob.reduce((t, k) => t + c[k][1], 0);
    let acr = [], rep = [], enc = [], extraCr = 0, desfS = [];
    const actual = perIdx('26/2') ?? perIdx('26/1');
    let nper = ri(1, 12);
    const per = i => perName(actual - nper + 1 + i);
    const forma = () => pick(['ORD', 'ORD', 'ORD', 'ORD', 'EXT', 'ETS', 'REC']);
    const avanza = (lista, desde = 0) => lista.forEach((k, i) => acr.push([k, cal(), per(Math.min(nper - 1, desde + Math.floor(i / ri(4, 7)))), forma()]));

    if (esc === 'regular') { avanza(ob.slice(0, Math.round(ob.length * rnd() * .9))); }
    if (esc === 'huecos') { avanza(shuffle(ob).slice(0, ri(0, ob.length))); }   // adelantos sin respetar seriación
    if (esc === 'cambio_carrera') {
      // revalidaciones de semestres altos al inicio y claves que no existen en este plan
      shuffle(ob).slice(0, ri(3, Math.min(25, ob.length))).forEach(k => acr.push([k, cal(), per(0), pick(['EQV', 'REV', 'DIC'])]));
      for (let i = 0; i < ri(0, 6); i++) acr.push(['X' + ri(100, 999), cal(), per(0), pick(['EQV', 'REV'])]);
      avanza(ob.filter(k => !acr.some(a => a[0] === k)).slice(0, ri(0, 20)), 1);
    }
    if (esc === 'electivas_revalidadas') {
      avanza(ob.slice(0, Math.round(ob.length * rnd() * .7)));
      extraCr = pick([10, 20, 20, 30]);   // electivas completas revalidadas: créditos sin materia en el kárdex
    }
    if (esc === 'muchas_reprobadas' || esc === 'recursamiento' || esc === 'mezcla') {
      avanza(ob.slice(0, Math.round(ob.length * rnd() * .6)));
      const pend = ob.filter(k => !acr.some(a => a[0] === k));
      shuffle(pend).slice(0, ri(1, 6)).forEach(k => rep.push([k, per(ri(0, nper - 1)), ri(1, 4)]));
      if (chance(.4)) desfS = rep.slice(0, ri(1, rep.length)).map(r => [r[0]]);
    }
    if (esc === 'historia_larga') { nper = ri(12, 20); avanza(ob.slice(0, Math.round(ob.length * (.5 + rnd() * .5)))); acr = acr.filter(() => chance(.85)); }
    if (esc === 'datos_sucios') {
      avanza(ob.slice(0, ri(0, ob.length)));
      for (let i = 0; i < ri(1, 8); i++) acr.push([pick(todas), pick([null, '', 'NP', 5, 11, '9', 'AC', 10, -1]), pick([null, '', '2024-2', '20241', per(0), 'xx']), pick([null, '', 'ORD', '???', 'EQV'])]);
      if (acr.length) acr.push(acr[0], acr[0]);   // duplicados
    }
    if (esc === 'egresado') { avanza(ob); }
    // optativas: a veces acreditadas (varias del mismo nivel) o en curso, para probar el cupo por nivel
    const opt = shuffle(todas.filter(k => c[k][3] === 'P' && !isElec(k)));
    if (esc !== 'primer_ingreso' && chance(.6)) opt.slice(0, ri(1, 5)).forEach(k => { if (!acr.some(a => a[0] === k)) acr.push([k, cal(), per(0), 'ORD']) });
    const optEnc = chance(.3) ? opt.slice(5, 5 + ri(1, 3)).filter(k => !acr.some(a => a[0] === k)) : [];
    // en curso: siguientes materias pendientes; a veces incluye un recursamiento o una materia ya acreditada (inconsistencia)
    const pend = ob.filter(k => !acr.some(a => a[0] === k));
    if (esc !== 'egresado') enc = pend.slice(0, ri(0, 7));
    enc.push(...optEnc);
    if (esc === 'recursamiento' && rep.length) enc.push(...rep.slice(0, ri(1, rep.length)).map(r => r[0]));
    if (chance(.1) && acr.length) enc.push(acr[0][0]);
    if (chance(.1)) enc.push('Y' + ri(100, 999));
    const obt = acr.filter(a => c[a[0]] && notaValida(a[1]) != null).reduce((t, a) => t + c[a[0]][1], 0) + extraCr;
    const prom = acr.map(a => notaValida(a[1])).filter(v => v != null);
    const cursados = Math.max(1, nper + (chance(.3) ? ri(-1, 3) : 0));
    const p = {
      upiita_saes: 1, unidad: UNIDAD, leido: new Date(Date.now() - ri(0, 120) * 864e5).toISOString(), boleta: '0000000000', nombre: 'ALUMNO FICTICIO',
      carrera: op.carrera, carrera_nombre: DATA.carreras[car], plan: op.plan,
      promedio: chance(.1) ? null : prom.length ? +(prom.reduce((t, v) => t + v, 0) / prom.length - rnd() * .5).toFixed(2) : null,
      acreditadas: acr, en_curso: chance(.05) ? null : [...new Set(enc)], horario_inscrito: [],
      reprobadas: rep.map(r => [c[r[0]]?.[0] || r[0]]), reprobadas_periodo: chance(.05) ? null : rep,
      desfasadas_saes: desfS.length ? desfS : chance(.5) ? [] : null,
      avance: chance(.05) ? null : { obtenidos: obt, faltan: chance(.1) ? ri(-20, 0) : Math.max(0, total - obt), cursados,
        autorizada: chance(.15) ? null : `MÁXIMA (${fmtCr(pick([0, Math.round(total / 12), Math.round(total / 8), Math.round(total / 6)]))} CREDITOS)` },
      carga: chance(.05) ? null : { total, min: Math.round(total / 12), max: Math.round(total / 8) },
      cita: chance(.3) ? {} : { inicio: pick(['', '07/10/2026 10:00', '14/10/2026 18:30', '01/01/2020 08:00', 'basura']), fin: null },
    };
    if (chance(.5)) p.kardex_reprobadas = rep.map(r => [r[0], pick([5, 4, 3, 0, 5]), r[1], 'ORD']);   // renglones reprobados del kárdex (Lector nuevo)
    if (esc === 'primer_ingreso') Object.assign(p, { acreditadas: [], reprobadas_periodo: [], reprobadas: [], en_curso: ob.slice(0, 6), avance: { obtenidos: 0, faltan: total, cursados: 1, autorizada: null } });
    p._extra = extraCr;   // créditos de electivas revalidadas (solo para las pruebas comparativas)
    return { p, car };
  }

  const malo = v => typeof v === 'number' && !Number.isFinite(v);
  const textoMalo = t => /\bNaN\b|undefined|\[object Object\]|Infinity/.test(t);
  function revisar(nombre, fn, ctx) {
    try { const r = fn(); if (r !== true && r) out.fallas.push({ caso: ctx, prueba: nombre, detalle: String(r).slice(0, 300) }); }
    catch (e) { out.fallas.push({ caso: ctx, prueba: nombre, error: String(e && e.stack || e).slice(0, 400) }); }
  }
  const solapa = (a, b) => a[6].some(([d, x, y]) => b[6].some(([e, u, v]) => d === e && x < v && u < y));

  const espera = () => new Promise(r => setTimeout(r, 0));
  for (let i = 0; i < N; i++) {
    const esc = ESCENARIOS[i % ESCENARIOS.length];
    const { p, car } = perfil(esc);
    const ctx = { i, esc, car, semilla: SEMILLA };
    out.escenarios[esc] = (out.escenarios[esc] || 0) + 1;
    S.car = car; ALUMNO = p; for (const k in T) delete T[k];
    SIM.on = chance(.3); SIM.res = {}; SIM.rec = {};
    (p.en_curso || []).forEach(k => { if (chance(.4)) SIM.res[k] = { ok: chance(.5), cal: cal() } });
    S.gavoid = chance(.3) ? shuffle(DATA.prof || []).slice(0, ri(1, 4)) : [];
    Object.assign(GT, { a: chance(.2) ? pick(['08:00', '10:00']) : '', b: chance(.2) ? pick(['15:00', '20:00']) : '', n: '', src: chance(.5) ? 'todo' : '' });

    if (!globalThis.FUZZ_SIN_DOM) revisar('render', () => { render(); return true }, ctx);
    const cob = out.cobertura; if (isPersonal()) cob.personal++; else out.fallas.push({ caso: ctx, prueba: 'perfil personal', detalle: 'el perfil no se reconoce como del alumno (isPersonal=false)' });
    try { if (statsDatos().fin != null) cob.conFin++; if (suggestions().list.length) cob.conSugerencias++; if (tr().fail.length) cob.conReprobadas++; if (tr().curso.length) cob.conEnCurso++; if (tr().sim) cob.simulacion++; } catch (e) {}
    if (!globalThis.FUZZ_SIN_DOM) revisar('estado general sin NaN/undefined', () => { const t = ($('#status')?.innerText || '') + ($('#desf')?.innerText || '') + ($('#est-act')?.innerText || ''); return textoMalo(t) && 'texto: ' + t.match(/.{0,40}(NaN|undefined|Infinity|\[object Object\]).{0,40}/)?.[0] }, ctx);
    revisar('trayectoria coherente', () => {
      const t = tr(), done = new Set(t.done);
      if (t.curso.some(k => done.has(k))) return 'una materia acreditada aparece en curso';
      if (t.fail.some(k => done.has(k))) return 'una materia acreditada aparece como reprobada';
      if (t.oblig.some(k => t.curso.includes(k))) return 'una materia en curso aparece como obligatoria';
      return true;
    }, ctx);
    revisar('situación real independiente de simulación', () => {
      const on=SIM.on, d=situacionDatos();
      if(SIM.on!==on)return 'Situación cambió la simulación';
      if(d.D.simulado)return 'Situación muestra créditos simulados';
      if(new Set(d.adeudos).size!==d.adeudos.length)return 'adeudos duplicados';
      if(d.nDes!==d.fis.filter(f=>f.estado==='desfasada').length+d.dS.length)return 'desfase incoherente';
      return conSim(false,()=>d.adeudos.some(k=>tr().done.includes(k))?'un adeudo ya está acreditado':true);
    }, ctx);
    revisar('estadísticas', () => {
      const d = statsDatos();
      for (const k of ['obt', 'falta', 'nper', 'fin', 'media', 'ritmo', 'total', 'mediana', 'sd'])
        if (malo(d[k])) return `${k} = ${d[k]}`;
      if (d.obt != null && d.obt < 0) return 'créditos obtenidos negativos';
      if (d.falta != null && d.falta < 0) return 'créditos faltantes negativos: ' + d.falta;
      if (d.nper != null && (d.nper < 0 || !Number.isInteger(d.nper))) return 'periodos restantes inválidos: ' + d.nper;
      if (d.fin != null && d.meta != null && d.fin < d.meta) return `termina (${d.fin}) antes del periodo que planea (${d.meta})`;
      if (d.media != null && (d.media < 6 || d.media > 10)) return 'promedio fuera de 6–10: ' + d.media;
      return true;
    }, ctx);
    // comparativas: el ritmo sale de lo cursado por periodo; las revalidaciones solo reducen lo que falta
    const sinSim = () => { const on = SIM.on; SIM.on = false; for (const k in T) delete T[k]; return () => { SIM.on = on; for (const k in T) delete T[k]; }; };
    const coherente = p.avance && p.carga && p.avance.faltan >= 0 && Math.abs(p.carga.total - p.avance.obtenidos - p.avance.faltan) < .01;
    if (esc === 'electivas_revalidadas' && p._extra && coherente) revisar('electivas revalidadas: predicción', () => {
      const vuelve = sinSim(); try {
        const d1 = statsDatos(); const a0 = ALUMNO;
        ALUMNO = { ...a0, avance: { ...a0.avance, obtenidos: a0.avance.obtenidos - p._extra, faltan: a0.avance.faltan + p._extra } };
        for (const k in T) delete T[k]; const d0 = statsDatos(); ALUMNO = a0;
        if (d1.ritmo !== d0.ritmo) return `el ritmo cambia con las electivas revalidadas (${d0.ritmo} → ${d1.ritmo})`;
        if (d1.falta != null && d0.falta != null && Math.abs(d0.falta - d1.falta - p._extra) > .01) return `faltan ${d0.falta} → ${d1.falta}; se esperaba restar ${p._extra}`;
        if (d1.nper != null && d0.nper != null && d1.nper > d0.nper) return `con más créditos revalidados termina más tarde (${d0.nper} → ${d1.nper} periodos)`;
        return true;
      } finally { vuelve(); }
    }, ctx);
    if (esc === 'cambio_carrera') revisar('cambio de carrera: ritmo sin revalidaciones', () => {
      const vuelve = sinSim(); try {
        const d1 = statsDatos(), a0 = ALUMNO;
        ALUMNO = { ...a0, acreditadas: a0.acreditadas.filter(a => !['EQV', 'REV', 'DIC'].includes(a[3])) };
        for (const k in T) delete T[k]; const d0 = statsDatos(); ALUMNO = a0;
        return d1.ritmo === d0.ritmo || `las revalidaciones cambian el ritmo (${d0.ritmo} → ${d1.ritmo})`;
      } finally { vuelve(); }
    }, ctx);
    revisar('promedio oficial simulado', () => { const po = promOficialSim(); if (!po) return true;
      if (!Number.isFinite(po.despues) || po.despues < -1e-9 || po.despues > 10 + 1e-9) return 'fuera de rango: ' + po.despues;
      if (!po.exacto && !(po.reprobadasEstimadas >= 0)) return 'reprobadas estimadas negativas: ' + po.reprobadasEstimadas; return true }, ctx);
    revisar('promedio meta', () => { const m = promMeta(statsDatos(), 8.5); for (const k in m) if (malo(m[k])) return `${k} = ${m[k]}`; return true }, ctx);
    revisar('sugerencias', () => {
      const s = suggestions(), t = tr(), ya = new Set([...t.done, ...t.curso]);
      if (new Set(s.list).size !== s.list.length) return 'sugerencias duplicadas';
      const mal = s.list.filter(k => ya.has(k)); if (mal.length) return 'sugiere acreditadas o en curso: ' + mal.join(',');
      if (s.cr > s.target + 0.01 && s.list.length > 1) return `rebasa la meta de créditos (${s.cr} > ${s.target})`;
      if (malo(s.cr) || malo(s.target)) return 'créditos no numéricos';
      return true;
    }, ctx);
    revisar('planeación N+1 sin materias de N ni acreditadas', () => {
      // Las unidades con planeación de un periodo no tienen un contexto N+1.
      if(!PLAN_DOS_PERIODOS)return true;
      return conPlan(() => {
        const base=tr(), original=base.want, clave=planClave(1), futuro=base.wantPorPeriodo[clave];
        base.want=[...new Set([...base.want,...suggestions().list.slice(0,2)])];
        const anteriores=[...base.want], done=[...base.done];
        // Datos guardados deliberadamente solapados: la lectura debe excluirlos.
        base.wantPorPeriodo[clave]=[...anteriores,...done,...Object.keys(cur()).slice(0,12)];PLAN_CACHE=null;
        try{return conPlan(() => {
          const t=tr(), ya=new Set([...anteriores,...done]);
          const mal=[...t.want,...suggestions().list].filter(k=>ya.has(k));
          return !mal.length || 'N+1 incluye materias de N o acreditadas: '+mal.join(',');
        },1)}finally{base.want=original;if(futuro===undefined)delete base.wantPorPeriodo[clave];else base.wantPorPeriodo[clave]=futuro;PLAN_CACHE=null}
      },0);
    }, ctx);
    // optativas por nivel (mapas que indican el nivel de cada espacio): una acreditada o en curso cubre el espacio de su nivel
    revisar('espacios de optativa por nivel', () => {
      const q = optCupo(), L = MAP().layout; if (!q || !L) return true;
      const F = slotFill(L, new Set()), cub = {}, t = tr(), c = cur();
      for (const [i, f] of F) { if (!f.k) continue; const nv = L.boxes[i][7]; if (nv && c[f.k][2] !== nv) return `la optativa ${f.k} (nivel ${c[f.k][2]}) cubre un espacio de nivel ${nv}`; cub[nv] = (cub[nv] || 0) + 1 }
      for (const nv in q) {
        if ((cub[nv] || 0) !== Math.min(q[nv].total, q[nv].hechas)) return `nivel ${nv}: ${q[nv].hechas} optativas hechas o en curso, ${q[nv].total} espacios, pero ${cub[nv] || 0} cubiertos`;
        if (q[nv].libre !== q[nv].total - Math.min(q[nv].total, q[nv].hechas)) return `nivel ${nv}: cupo libre incoherente`;
      }
      const ex = optExceso(suggestions().list, q); if (Object.keys(ex).length) return 'sugiere más optativas de un nivel que espacios libres: ' + JSON.stringify(ex);
      return true;
    }, ctx);
    revisar('aviso de actualizar', () => typeof avisoActualizar(ALUMNO) === 'string' || 'no devuelve texto', ctx);
    revisar('oferta sin acreditadas con el filtro activo', () => {
      const anterior=S.hideDone;S.hideDone=true;
      try{const done=new Set(tr().done), mal=filtered().filter(c=>done.has(c[8]));return !mal.length||'oferta incluye acreditadas: '+mal.map(c=>c[8]).join(',')}
      finally{S.hideDone=anterior}
    }, ctx);
    // generador: materias elegidas = sugeridas + algunas al azar (incluye a veces acreditadas o en curso a propósito)
    revisar('reemplazos de cupos elegibles y sin choques con el resto', () => {
      if(!window.SateCuposVista||typeof CUPOS==='undefined')return true;
      for(const anterior of selected())for(const a of SateCuposVista.otras(anterior)){
        const c=a.c,resto=selected().filter(x=>keyOf(x)!==keyOf(anterior));
        if(c[0]!==S.car||!cur()[c[8]]||!available(c[8]))return 'reemplazo fuera del plan o no cursable: '+c[8];
        if(!(CUPOS.fila(c)?.disponibles>0))return 'reemplazo sin lugar: '+keyOf(c);
        if(!c[6].length||[...resto,...ownAsClasses()].some(x=>!slots(x).length||overlaps(x,c)))return 'reemplazo sin horario verificable o con choque: '+keyOf(c);
      }
      return true;
    }, ctx);
    const t = tr(); t.want = [...new Set([...suggestions().list, ...shuffle(Object.keys(cur())).slice(0, ri(0, 4))])].filter(k => !isElec(k));
    for (const n of ['', 'auto', String(ri(2, 5))]) {
      revisar('generador ' + (n || 'todas'), () => {
        GT.n = n; const g = generate(); if (g.msg) return true; if (g.top?.length) out.cobertura.horariosGenerados++;
        const ya = new Set([...tr().done, ...tr().curso]), avoid = S.gavoid.map(norm);
        for (const o of g.top || []) {
          const cs = o.cs;
          if(typeof semanaOk==='function'&&!semanaOk(cs))return 'horario incompatible con Mi semana';
          if(typeof presupuestoSemana==='function'){
            const p=presupuestoSemana(cs),s=Object.values(p.horas).reduce((a,b)=>a+b,0);
            if(Math.abs(s-Math.max(168,p.total))>0.001)return 'presupuesto semanal no conserva las horas';
          }
          if (new Set(cs.map(c => c[8])).size !== cs.length) return 'una materia repetida en un horario';
          for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) if (solapa(cs[a], cs[b])) return 'traslape entre ' + cs[a][8] + ' y ' + cs[b][8];
          const x = cs.find(c => ya.has(c[8])); if (x) return 'propone acreditada o en curso: ' + x[8];
          const e = cs.find(c => c[5].some(i => avoid.some(q => norm(DATA.prof[i]).includes(q)))); if (e) return 'usa un profesor excluido en ' + e[8];
          const f = cs.find(c => c[0] !== S.car); if (f) return 'grupo de otra carrera: ' + f[0];
          const ex = optExceso(cs.map(c => c[8]), optCupo()); if (Object.keys(ex).length) return 'más optativas de un nivel que espacios libres: ' + JSON.stringify(ex);
        }
        return true;
      }, { ...ctx, modo: n || 'todas' });
    }
    out.casos++;
    if (i % 10 === 9) await espera();
  }
  S.gavoid = []; SIM.on = false;
  const pre = document.createElement('pre'); pre.id = 'fuzz-resultado'; pre.textContent = JSON.stringify(out); document.body.appendChild(pre);
  document.title = 'FUZZ:' + out.casos + ':' + out.fallas.length;
})();
