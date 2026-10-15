(function(raiz){
// «(excepto inglés)» es parte del nombre del catálogo; solo cuenta como inglés si lo menciona fuera de esa aclaración.
const mencionIngles=t=>/ingl[eé]s|english/i.test(String(t||'').replace(/\(\s*excepto\s+ingl[eé]s\s*\)/ig,''));
const CARN={B:'Ingeniería Biónica',M:'Ingeniería Mecatrónica',T:'Ingeniería Telemática',E:'Ingeniería en Energía',S:'Ing. en Sistemas Automotrices'};
const REQ={B:{n:4,c:5},T:{n:4,c:5},M:{n:3,c:7}};
const MOD={D:{n:'Docencia',h:16},C:{n:'Trabajo de campo supervisado',h:50},I:{n:'Actividades independientes',h:20}};
const EJE={I:'Inquietudes vocacionales propias',II:'Énfasis en la profesión',III:'Complementarias a la formación'};
// Catálogo: clave del instructivo, modalidad, título, palabras clave, evidencia, requisitos/condiciones y estado vigente (26-2)
const CAT=[
 ['I.1.1.1','D','Materia de otra carrera de la UPIITA cursada como electiva','otra carrera optativa elegible materia die-01 sin registro saes','Calificación reportada por el profesor (formato DIE-01 entregado al inicio del semestre en que la cursaste)','Se tramita con el DIE-01 en los primeros 10 días hábiles del semestre; se libera el semestre siguiente. Máximo 7 solicitudes.',{die:'01'}],
 ['I.1.1.2','D','Curso en otra escuela del IPN (UPIBI, ESIME, ESCOM…)','otra escuela unidad academica ipn upibi esime escom esiqie curso materia movilidad interna','Constancia o boleta con calificación y horas','Requiere visto bueno del tutor y del jefe del Departamento de Tecnologías Avanzadas en la 5.ª–7.ª semana del semestre previo.'],
 ['I.1.2','D','Materias en movilidad nacional o internacional','movilidad intercambio extranjero universidad convenio ecoes cca-07','Oficio de equivalencias de la DAE (original y copia)','Si aún no tienes tu equivalencia, espera a tenerla. Si reprobaste una electiva en movilidad puedes liberarla con otras actividades.'],
 ['I.1.3.1','D','Curso de software ofertado en la UPIITA','software programa informatico solidworks matlab labview curso externo upiita','Constancia con acreditación y total de horas',''],
 ['I.1.3.2','D','Curso de software en institución con validez oficial (RVOE)','software programa informatico curso unam esime ipn rvoe validez oficial linea online coursera','Constancia con acreditación y total de horas','Válido presencial o en línea si la institución tiene validez oficial.'],
 ['I.1.3.3','D','Curso de software en institución sin validez oficial','software curso sin validez oficial facilitador certificado academia evaluacion','Constancia con horas y temario','La academia aplica una evaluación de los temas; entrégalo entre la 1.ª y 4.ª semana del semestre.'],
 ['I.1.3.4','D','Certificación de un programa informático','certificacion software solidworks cswa autodesk cisco microsoft oracle','Constancia de la certificación','La academia determina las horas equivalentes según el nivel; entrégalo entre la 1.ª y 4.ª semana.'],
 ['I.1.4.1','D','Idioma extranjero en el CENLEX (excepto inglés)','idioma lengua cenlex aleman frances japones italiano ruso portugues chino coreano','Constancia del CENLEX con acreditación y horas','El inglés no cuenta porque es parte del mapa curricular.',{noIngles:1}],
 ['I.1.4.2','D','Idioma extranjero en otra institución (excepto inglés)','idioma lengua aleman frances japones italiano chino coreano escuela externa instituto goethe alianza francesa','Constancia del CENLEX con el nivel y su equivalencia en horas','Debes presentar examen de colocación en el CENLEX para obtener la constancia.',{noIngles:1}],
 ['I.1.4.3','D','Certificación internacional de idioma (excepto inglés)','certificacion idioma delf dele goethe jlpt celi hsk','Constancia del CENLEX con la equivalencia en horas','',{noIngles:1}],
 ['I.2.1','C','Verano de investigación DELFIN','delfin verano investigacion pacifico','—','Desde 26-2 no cuenta: las actividades con retribución económica no se aceptan.',{off:1}],
 ['I.2.2','C','Proyecto de investigación SIP','proyecto investigacion sip beifi pifi laboratorio investigador','Constancia del director con horas y constancia oficial del proyecto y periodo','Si recibiste beca o pago por participar (BEIFI, becario), desde 26-2 no cuenta.'],
 ['I.2.3','C','Modelo científico, físico o matemático','modelo matematico fisico cientifico simulacion investigacion','Constancia del docente con horas y memoria con su visto bueno','No debe estar registrado en la SIP ni ser parte de una materia.'],
 ['I.2.4','C','Trabajo de investigación independiente','investigacion independiente cinvestav laboratorio','Constancia del docente con horas y memoria con su visto bueno','No debe ser parte de una materia.'],
 ['I.3.1','I','Incubación o preincubación de empresa','incubadora emprendimiento empresa startup preincubacion polo','Constancia del centro de incubación con horas',''],
 ['II.1.1.1','D','Optativa adicional inscrita en el SAES','optativa adicional saes inscrita extra','Boleta que muestre que cubriste tus optativas obligatorias más la adicional','Es forzoso aprobarla; puede aplicar el artículo 98 del reglamento.'],
 ['II.1.1.2','D','Optativa o elegible de tu carrera cursada sin registro en el SAES','optativa elegible misma carrera die-02 sin registro saes','Calificación reportada por el profesor (formato DIE-02 entregado al inicio del semestre en que la cursaste)','Se tramita con el DIE-02 en los primeros 10 días hábiles; se libera el semestre siguiente.',{die:'02'}],
 ['II.1.2','D','Optativa en otra carrera, escuela o institución','optativa otra escuela institucion','Igual que I.1.1.2 o I.1.2 según el caso',''],
 ['II.1.3','D','Curso, seminario o diplomado de tu disciplina','curso diplomado seminario taller tecnico en linea online presencial uam unam certificacion','Constancia con duración y acreditación','Puede ser presencial o en línea, dentro o fuera del IPN, si la institución tiene validez oficial.'],
 ['II.2.1','C','Prácticas profesionales o estancia en empresa','practicas profesionales estancia empresa trabajo hospital industria internship','Constancia de la empresa con actividades y duración, e informe','Si fueron pagadas, desde 26-2 no cuentan (retribución económica).'],
 ['II.2.2','C','Asesoría a una organización con un docente','asesoria organizacion mejora proceso','Informe con visto bueno del docente y constancia de la organización con horas','Requiere tener aprobados los tres primeros niveles.'],
 ['II.2.3','C','Consultoría a una organización con un docente','consultoria empresa problema','Informe con visto bueno del docente y constancia de la organización con horas','Requiere estar cursando materias del nivel IV.'],
 ['II.2.4.1','C','Simulador organizado por una institución','simulador negocios competencia simulacion','Constancia con la etapa alcanzada y las horas',''],
 ['II.2.4.2','C','Simulador con un docente o facilitador','simulador simulacion numerica docente','Constancia del docente con horas y reporte con su visto bueno',''],
 ['II.3.1','I','Concurso nacional o internacional de tu área','concurso competencia robotica hackathon torneo premio lugar','Evidencia del lugar obtenido y constancia de participación','Solo cuenta si quedaste en los 3 primeros lugares nacionales o en los 5 primeros internacionales.'],
 ['II.3.2','I','Asistencia a congreso de tu área','congreso conferencia simposio cite foro jornadas','Constancia de asistencia con la duración','Máximo 40 horas por congreso.',{cap:40}],
 ['III.1.1','D','Taller o curso artístico o cultural con evaluación','taller curso arte cultura musica danza pintura teatro fotografia','Constancia de acreditación y horas','Debe estar avalado por la Secretaría de Cultura, la SEP o un organismo estatal de cultura.'],
 ['III.2.1','C','Servicio comunitario','servicio comunitario voluntariado reforestacion ayuda','Constancia del organismo con horas e informe del servicio',''],
 ['III.2.2','C','Programa de beneficio social con convenio IPN','beneficio social ecologico reciclaje comunidad salud equidad','Constancia con horas e informe',''],
 ['III.2.3','C','Práctica deportiva (selecciones o ligas oficiales)','deporte futbol basquet voleibol natacion atletismo seleccion entrenamiento gimnasio taekwondo box','Constancia o reconocimiento con la actividad y las horas','Las actividades deportivas dentro del IPN cuentan: 50 horas equivalen a 1 crédito.'],
 ['III.2.4','C','Juegos deportivos interpolitécnicos','interpolitecnicos juegos deportivos ajedrez competencia ipn','Evidencia del lugar y constancia de participación','Solo si quedaste en los 3 primeros lugares.'],
 ['III.2.5','C','Presentación de obra cultural','obra presentacion danza teatro concierto','Evidencia de la presentación','Servicios Estudiantiles define las horas; tarda unos 15 días hábiles.'],
 ['III.2.6','C','Club de arte en la UPIITA (libro, cine, video)','club cine libro video lectura arte','Constancia del docente con horas e informe',''],
 ['III.2.7','C','Alumno asesor en el programa de tutorías','asesor tutorias asesorias companeros pit','Constancia del área de tutorías con horas e informe','No debe contar como servicio social.'],
 ['III.2.8','C','Apoyo en eventos de la UPIITA','apoyo evento logistica expo trabajos terminales staff organizacion','Constancia del departamento con horas e informe',''],
 ['III.2.9','C','Participación artística o cultural','cultura arte coro danza grupo artistico','Constancia o reconocimiento con horas','Avalado por la Secretaría de Cultura, la SEP u organismo estatal.'],
 ['III.3.1','I','Exposición de arte nacional o internacional','exposicion arte obra alebrijes','Constancia con el tiempo de creación y evidencia de la exposición',''],
 ['III.3.2','I','Competencia interinstitucional representando al IPN','competencia interinstitucional seleccion ipn regional nacional universiada','Evidencia del lugar y constancia de participación','Solo si quedaste en los 4 primeros lugares.'],
 ['III.3.3','I','Competencia deportiva internacional','competencia deportiva internacional centroamericanos panamericanos','Constancia de un organismo nacional del deporte con el tiempo de preparación',''],
 ['CC','D','Materia no equivalente por cambio de carrera o plantel','cambio de carrera plantel equivalencia no equivalente','Copia de la boleta de la unidad de procedencia y de la equivalencia de la DAE','Créditos = (horas teóricas + prácticas) × 18 ÷ 16.',{cc:1}],
].map(([k,m,t,kw,ev,cond,f])=>({k,m,t,kw,ev,cond,f:f||{},eje:k.split('.')[0]}));
const CATK=Object.fromEntries(CAT.map(a=>[a.k,a]));

const norm=s=>String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const floor2=x=>Math.floor(x*100+1e-6)/100;
const fmt=x=>(+x).toFixed(2).replace(/\.?0+$/,'');
function hoursOf(a){const c=CATK[a.k];let h=+a.h||0;if(c?.f.cap)h=Math.min(h,c.f.cap);return h}
function credOf(a){const c=CATK[a.k];if(!c)return 0;if(c.f.cc)return floor2(((+a.ht||0)+(+a.hp||0))*18/16);return floor2(hoursOf(a)/MOD[c.m].h)}
function warnOf(a){
  const c=CATK[a.k], w=[];
  if(c.f.off) w.push(['bad','Esta actividad ya no se acepta desde 26-2 (tiene retribución económica). No se incluirá en tus formatos.']);
  if(c.f.noIngles&&mencionIngles(a.desc)) w.push(['bad','Los cursos de inglés no cuentan: el inglés es parte del mapa curricular.']);
  if(c.f.cap&&(+a.h||0)>c.f.cap) w.push(['warn',`Se toman como máximo ${c.f.cap} horas por congreso; registra cada congreso por separado.`]);
  if(!c.f.cc&&!(+a.h)) w.push(['warn','Escribe el número de horas que indica tu constancia.']);
  return w;
}
const valid=a=>!CATK[a.k].f.off&&!warnOf(a).some(w=>w[0]==='bad');

/* ---------- búsqueda ---------- */
function search(q){
  const t=norm(q).split(/\s+/).filter(Boolean);if(!t.length)return[];
  return CAT.map(a=>{const hay=norm(a.k+' '+a.t+' '+a.kw);const s=t.reduce((n,w)=>n+(hay.includes(w)?(norm(a.t).includes(w)?3:1):0),0);return {a,s}})
    .filter(x=>x.s>0).sort((x,y)=>y.s-x.s||(x.a.f.off?1:0)-(y.a.f.off?1:0)).slice(0,8).map(x=>x.a);
}
function hourOpt(h){const o=[{w:3,s:54,c:'3.37'},{w:4.5,s:81,c:'5.06'},{w:6,s:108,c:'6.75'}];return o.reduce((b,x)=>Math.abs(x.w-Math.min(h,6))<Math.abs(b.w-Math.min(h,6))?x:b)}
function totals(S,liberadas=()=>0){
  const ok=S.acts.filter(valid);
  const cr=ok.reduce((s,a)=>s+credOf(a),0), sob=S.f.q1==='si'?(+S.f.sob||0):0;
  const r0=REQ[S.car], lib=Math.min(r0.n,liberadas()), r={n:r0.n-lib,c:r0.c,lib,n0:r0.n}, all=floor2(cr+sob);
  return {ok,cr:floor2(cr),sob,all,r,cubre:Math.min(r.n,Math.floor(all/r.c+1e-9)),rest:floor2(all-Math.min(r.n,Math.floor(all/r.c+1e-9))*r.c)};
}

raiz.ElectivasReglas={CARN,REQ,MOD,EJE,CAT,CATK,norm,floor2,fmt,hoursOf,credOf,warnOf,valid,search,hourOpt,totals};
})(globalThis);
