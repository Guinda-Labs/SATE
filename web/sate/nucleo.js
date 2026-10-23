const DATA=window.SATE_DATA;
const UNIDAD=DATA.unidad||window.SATE_UNIDAD;window.IPNT_UNIDAD=UNIDAD;
const CAPACIDADES=window.SATE_CONFIG?.unidades?.[UNIDAD]||{};
const PLAN_DOS_PERIODOS=window.SATE_CONFIG?.unidades?.[UNIDAD]?.planDosPeriodos===true;
const planPasos=()=>PLAN_DOS_PERIODOS?[0,1]:[0];
const DAYS=['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'], DAYN=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
/* Dispositivo: tocar selecciona; las materias del otro periodo abren sus acciones explícitas.
   En teléfono vertical la trayectoria se muestra en lista y el horario como agenda por día (el usuario puede cambiarlo). */
const MQ_PHONE=matchMedia('(max-width: 639px)'), MQ_NOHOVER=matchMedia('(hover: none)');
let PT=MQ_NOHOVER.matches?'touch':'mouse';
document.addEventListener('pointerdown',e=>{PT=e.pointerType||'mouse'},true);
const tactil=()=>PT!=='mouse';
const TURNOS={M:'Matutino',V:'Vespertino'};
const TIPO={O:'Obligatoria',P:'Optativa',T:'Taller'};
// Carga en créditos confirmada en SAES (Cita de reinscripción). Las demás carreras se agregan cuando se capturen.
const CARGA=CAPACIDADES.carga||{};
const LETRAS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const START=7*60, END=22*60, SLOT=30, SLOTPX=22, BLOCK=90;  // una clase dura 1:30
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm=s=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
const hm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
const toMin=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
const pretty=t=>{const l=String(t).toLowerCase().replace(/\b(i{1,3}|iv|vi{0,3}|ix|x)\b/g,m=>m.toUpperCase());return l.charAt(0).toUpperCase()+l.slice(1)};
const fmtCr=n=>Number.isInteger(+n)?String(+n):(+n).toFixed(2).replace(/0$/,'');
function textoCreditos(k,valor,detalle=false){
  const d=cur()[k]?.[4]||{}, cr=(d.cr_calculado?'≈ ':'')+fmtCr(valor??d.cr??cur()[k]?.[1]??0);
  return detalle&&d.satca!=null?SATE.texto('sate.creditos.detalle',{cr,satca:fmtCr(d.satca)}):cr+' '+SATE.texto('sate.creditos.rotulo');
}
function ayudaCreditos(k){
  return `<span data-ayuda-creditos="${cur()[k]?.[4]?.cr_calculado?'calculado':'escala'}"></span>`;
}
function montarAyudasCreditos(){
  document.querySelectorAll('[data-ayuda-creditos]').forEach(n=>{
    if(n.dataset.montada)return;
    n.dataset.montada='1';
    n.appendChild(SateUI.ayuda('sate.creditos.contexto',{
      escala:SATE.texto('sate.creditos.escala')+(n.dataset.ayudaCreditos==='calculado'?'. '+SATE.texto('sate.creditos.calculado'):''),
      explicacion:SATE.texto('sate.creditos.ayuda')
    }));
  });
}
/*__CUENTA_JS__*/
// modo demostración: perfil ficticio solo en esta pestaña; no toca los datos reales ni la cuenta (enlace «…#demo»)
if(location.hash==='#demo'){try{sessionStorage.setItem('ipnt.demo',UNIDAD)}catch(e){}history.replaceState(null,'',location.pathname+location.search)}
const DEMO=(()=>{try{return sessionStorage.getItem('ipnt.demo')===UNIDAD}catch(e){return false}})();
const HU=DEMO?'hu.demo.'+UNIDAD+'.':UNIDAD==='upiita'?'hu.':'hu.'+UNIDAD+'.';
const ALM=DEMO?sessionStorage:(window.IPNT?.almacen||localStorage);
const store={get(k,d){try{const v=ALM.getItem(HU+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){if(DEMO){try{ALM.setItem(HU+k,JSON.stringify(v))}catch(e){}}else IPNT.set(HU+k,JSON.stringify(v))}};   // IPNT: perfil sincronizable (tools/cuenta.py)

const S={tab:store.get('tab','tray'),per:store.get('per','proximo'),car:store.get('car','B'),tur:store.get('tur','*'),niv:store.get('niv','*'),q:'',view:store.get('view','materia'),
  hide:store.get('hide',false),hideDone:store.get('hideDone',true),fit:false,gap:null,onlyWant:store.get('onlyWant',true),weekend:store.get('weekend',false),chips:[],hover:null,acIdx:-1,acItems:[],ownDays:[],
  mode:'want',zoom:null,mapHover:null,gt:'*',gpref:[],gavoid:store.get('excl',[]),gen:null};
if(!DATA.carreras[S.car]) S.car=Object.keys(DATA.carreras)[0];
S.expand=new Set();S.mview=store.get('mview',null);S.cview=store.get('cview',null);S.mapFocus=false;S.lfocus=null;
// vista por defecto según el dispositivo; la elección explícita del usuario se recuerda
const mview=()=>S.mview||(MQ_PHONE.matches?'lista':'mapa'), cview=()=>S.cview||(MQ_PHONE.matches?'dia':'semana');

/* ---------- estado guardado ---------- */
const W={};
for(const p of ['proximo','actual']){
  W[p]=store.get('w.'+p,{plan:'A',plans:{A:{sel:store.get('sel.'+p,[])||[],own:[]}},marks:{}});
}
// horarios dinámicos: se empieza con A y el alumno agrega los que quiera; los vacíos heredados (B, C) se descartan
for(const p in W){const w=W[p];Object.keys(w.plans).forEach(k=>{const x=w.plans[k];if(k!=='A'&&k!==w.plan&&!x.sel.length&&!(x.own||[]).length)delete w.plans[k]});
  if(!w.plans[w.plan])w.plan=Object.keys(w.plans)[0]||'A';if(!w.plans.A&&!Object.keys(w.plans).length)w.plans.A={sel:[],own:[]}}
const ws=()=>W[S.per], plan=()=>ws().plans[ws().plan];
const planIds=()=>Object.keys(ws().plans).sort((a,b)=>a.length-b.length||a.localeCompare(b));
// siguiente letra después de la última existente (A, B, C… Z, AA, AB…); nunca reutiliza ni sobrescribe un horario
const planNum=id=>[...id].reduce((n,ch)=>n*26+LETRAS.indexOf(ch)+1,0);
const nextPlan=()=>{let n=Math.max(0,...planIds().map(planNum))+1, id='';while(n>0){n--;id=LETRAS[n%26]+id;n=Math.floor(n/26)}return id};
const save=()=>store.set('w.'+S.per,ws());
// storage no se dispara en la pestaña que escribe; las otras recargan el mismo periodo.
window.addEventListener('storage',e=>{
  if(DEMO||!['actual','proximo'].some(p=>e.key===HU+'w.'+p))return;
  const p=e.key.slice((HU+'w.').length),w=store.get('w.'+p,null);
  if(!w?.plans?.[w.plan]||!Array.isArray(w.plans[w.plan].sel))return;
  W[p]=w;
  if(p===S.per&&typeof renderCal==='function'){renderPlans();renderOffer();renderCal()}
});
/*__SAES_JS__*/
// v1: solo se eligen materias para explorar. v2: el alumno pega sus datos del SAES (Lector IPN-tools) y se activa la vista personal.
let ALUMNO=DEMO?null:SAES.load();   // en modo demostración se genera después de conocer las funciones del mapa
// El perfil conserva los ids del SAES; la vista distingue los planes que reutilizan claves.
const carreraPerfil=d=>d?(Object.entries(DATA.opciones_plan||{}).find(([,v])=>v.carrera===d.carrera&&v.plan===d.plan)?.[0]||
  (Object.values(DATA.opciones_plan||{}).some(v=>v.carrera===d.carrera)?null:d.carrera)):null;
IPNT.set('ipnt.unidad',UNIDAD)   // horarios.html e inicio: abrir directo esta unidad
const isPersonal=()=>!!ALUMNO&&carreraPerfil(ALUMNO)===S.car;
const T={}; // por carrera: elegidas y, con datos del SAES, acreditadas y reprobadas
/* Simulación de fin de semestre (solo exploración, nunca toca los datos del SAES):
   las materias en curso se dan por aprobadas, salvo las que el alumno marque como reprobadas. */
const SIM=Object.assign({on:false,fail:[],res:{},rec:{}},store.get('sim',{}));   // res: {clave:{ok,cal}}; rec: {clave:{forma,cal}}
(SIM.fail||[]).forEach(k=>{SIM.res[k]=SIM.res[k]||{ok:false}});SIM.fail=[];   // versión anterior: solo lista de reprobadas
// cada bloque puede mostrar la simulación o los datos reales por separado; sin elección propia, sigue el interruptor general
const SIMBLK=store.get('simBlk',{});
const usaSim=blk=>SIMBLK[blk]??SIM.on;
// calcula fn con la simulación encendida o apagada solo durante ese cálculo (la caché de la trayectoria se rehace)
const conSim=(on,fn)=>{if(on===SIM.on)return fn();const prev=SIM.on;SIM.on=on;for(const k in T)delete T[k];
  try{return fn()}finally{SIM.on=prev;for(const k in T)delete T[k]}};
// materias de este plan equivalentes a una clave de otra carrera o plan, según la tabla de Equivalencias del SAES
const eqvPlan=k=>{const c=cur(),out=new Set();(DATA.equiv?.rel||[]).forEach(([o,ko,,d,kd])=>{if(ko===k&&d===S.car&&c[kd])out.add(kd);if(kd===k&&o===S.car&&c[ko])out.add(ko)});return [...out]};
let PLAN_PASO=0, PLAN_CACHE=null;
S.planPaso=0;
const trayectoriaBase=()=>{
  if(!T[S.car]){
    const t=store.get('t.'+S.car,{want:[]}), me=isPersonal();
    const done0=me?[...new Set((ALUMNO.acreditadas||[]).filter(a=>a&&a[1]!=null&&String(a[1]).trim()!==''&&Number.isFinite(+a[1])&&+a[1]>=6&&+a[1]<=10).map(a=>a[0]))]:[];
    const enc=me?((ALUMNO.en_curso||[]).length?ALUMNO.en_curso:(ALUMNO.horario_inscrito||[]).map(h=>h[1])):[];
    // inscrita de otra carrera o plan con equivalencia registrada (tabla del SAES): cuenta como su materia de este plan
    const encEqv=enc.filter(k=>!cur()[k]).flatMap(eqvPlan);
    const enCurso=[...new Set([...enc,...encEqv])].filter(k=>cur()[k]&&!done0.includes(k));
    const pendRep=me?[...new Set([...(ALUMNO.reprobadas_periodo||[]).map(r=>r[0]),...Object.keys(cur()).filter(k=>(ALUMNO.reprobadas||[]).some(r=>norm(r[0])===norm(cur()[k][0])))])]
      .filter(k=>cur()[k]&&!done0.includes(k)&&!enCurso.includes(k)):[];
    const sim=me&&SIM.on&&(enCurso.length>0||pendRep.length>0);
    const simOk=sim?enCurso.filter(k=>SIM.res[k]?.ok!==false):[], simFail=sim?enCurso.filter(k=>SIM.res[k]?.ok===false):[];
    const simRec=sim?pendRep.filter(k=>SIM.rec[k]?.forma):[];   // reprobadas que se simulan acreditadas (ETS, recurse, extraordinario)
    const done=[...done0,...simOk,...simRec], doneS=new Set(done);
    // reprobadas: con periodo (Estado general del SAES) o, en datos viejos, solo por nombre (Cita)
    const failP={}, veces={};
    if(me)(ALUMNO.reprobadas_periodo||[]).forEach(([k,p,v])=>{if(!cur()[k]||doneS.has(k))return;const i=perIdx(p);if(!(k in failP)||(i!=null&&i<failP[k]))failP[k]=i;veces[k]=v});
    const names=me?new Set((ALUMNO.reprobadas||[]).map(r=>norm(r[0]))):new Set();
    Object.keys(cur()).forEach(k=>{if(names.has(norm(cur()[k][0]))&&!doneS.has(k)&&!(k in failP))failP[k]=null});
    // reprobada en la simulación: cuenta desde el periodo que se cursa ahora
    const pm=perMeta();simFail.forEach(k=>{if(failP[k]==null)failP[k]=pm!=null?pm-1:null;veces[k]=(veces[k]||0)+1});
    const curso=sim?[]:enCurso;
    const desfS=me?(ALUMNO.desfasadas_saes||[]).map(r=>r[0]).filter(k=>cur()[k]&&!doneS.has(k)):[];
    // desfasada oficial (más de 2 periodos reprobada): sin ella el SAES no permite reinscribirse -> obligatoria
    const pmeta=perMeta(), oblig=[...new Set([...Object.keys(failP).filter(k=>failP[k]!=null&&pmeta!=null&&pmeta>failP[k]+2),...desfS])].filter(k=>!curso.includes(k));
    const periodo=planClave(0), wantPorPeriodo=t.wantPorPeriodo||{};
    T[S.car]={want:[...new Set([...(wantPorPeriodo[periodo]||t.want||[]),...oblig])].filter(k=>cur()[k]&&!isElec(k)),wantPorPeriodo,oblig,desfS,done,fail:Object.keys(failP),failP,veces,curso,enCurso,encEqv,pendRep,sim,simOk,simRec,cursados:me?ALUMNO.avance?.cursados??null:null};
  }
  return T[S.car];
};
// El escenario anual se limita a los cálculos del mapa; Horarios siempre usa N.
function planInicio(){return perMetaBase()??perIdx(DATA.calendario?.periodo)}
function planClave(paso){const p=planInicio();return p==null?(paso?'siguiente':'proximo'):perName(p+paso)}
function planEtiqueta(paso){const p=planInicio();return p==null?SATE.texto('sate.planeacion.'+(paso?'periodo_siguiente':'periodo_proximo')):perName(p+paso)}
function conPlan(fn,paso=S.planPaso){const previo=PLAN_PASO;PLAN_PASO=PLAN_DOS_PERIODOS?paso:0;try{return fn()}finally{PLAN_PASO=previo}}
const tr=()=>{
  const previo=PLAN_PASO;PLAN_PASO=0;let base;
  try{base=trayectoriaBase()}finally{PLAN_PASO=previo}
  if(!PLAN_PASO)return base;
  if(PLAN_CACHE?.base===base)return PLAN_CACHE.t;
  const done=[...new Set([...base.done,...base.want])], ya=new Set(done);
  const fail=base.fail.filter(k=>!ya.has(k)), meta=planInicio();
  const oblig=[...new Set([...base.oblig,...fail.filter(k=>base.failP[k]!=null&&meta!=null&&meta+1>base.failP[k]+2)])].filter(k=>!ya.has(k)&&!base.curso.includes(k));
  const want=[...new Set([...(base.wantPorPeriodo[planClave(1)]||base.wantPorPeriodo.siguiente||[]),...oblig])]
    .filter(k=>cur()[k]&&!isElec(k)&&!ya.has(k));
  const t={...base,want,done,fail,oblig,desfS:base.desfS.filter(k=>!ya.has(k)),
    failP:Object.fromEntries(Object.entries(base.failP).filter(([k])=>!ya.has(k))),
    curso:base.curso.filter(k=>!ya.has(k)),cursados:base.cursados==null?null:base.cursados+1};
  PLAN_CACHE={base,t};return t;
};
// Cada vista conserva su selección; la segunda supone acreditadas las materias de la primera.
function planElegidas(){return new Set(planPasos().flatMap(p=>conPlan(()=>tr().want,p)))}
function planAsignado(k){return conPlan(()=>tr().want.includes(k),0)?0:PLAN_DOS_PERIODOS&&conPlan(()=>tr().want.includes(k),1)?1:null}
/* "dd/mm/aaaa hh:mm:ss p. m." del SAES → ¿la cita (fin) ya pasó? */
/* recordatorio para volver a usar el Lector: los datos son una copia del SAES y no se actualizan solos */
function avisoActualizar(A){
  const leido=new Date(A?.leido);if(isNaN(leido))return '';
  const m=String(A?.cita?.inicio||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/), cita=m?new Date(+m[3],+m[2]-1,+m[1]):null;
  if(cita&&citaPasada(A)&&leido<cita)return SATE.texto('sate.situacion.actualizar_cita');
  // citas del nuevo periodo publicadas (calendario de Gestión Escolar) después de la última lectura
  const pub=DATA.calendario?.citas?new Date(DATA.calendario.citas+'T00:00:00'):null;
  if(pub&&Date.now()>=pub&&leido<pub)return SATE.texto('sate.situacion.actualizar_publicacion',{periodo:DATA.calendario.periodo||'',fecha:pub.toLocaleDateString('es-MX',{day:'numeric',month:'long'})});
  const dias=Math.floor((Date.now()-leido)/864e5);
  if(dias>=21)return SATE.texto('sate.situacion.actualizar_antiguedad',{dias});
  return '';
}
const citaPasada=A=>{const m=String(A?.cita?.fin||A?.cita?.inicio||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return !!m&&new Date(+m[3],+m[2]-1,+m[1]+1)<new Date()};
/* ---------- periodos escolares ("25/2" o "20252") como índice consecutivo ---------- */
const perIdx=p=>{const m=String(p??'').trim().match(/^(?:20)?(\d{2})\/?([12])$/);return m?(+m[1])*2+(+m[2]-1):null};
const perName=i=>i==null?'—':`${Math.floor(i/2)}/${i%2+1}`;
// periodo al que corresponde una cita: en ene–may se inscribe el /2; en jun–oct, el /1 del año siguiente
const perDeFecha=s=>{const m=String(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(!m)return null;const mo=+m[2],y=+m[3]%100;return mo<=5?y*2+1:mo<=10?(y+1)*2:(y+1)*2+1};
/* Agenda escolar del SAES ([evento, inicio, fin], «INICIO DE SEMESTRE 27-1»): el periodo que sigue es el próximo inicio
   de semestre después de la lectura; durante las tres semanas de altas y bajas aún cuenta el que acaba de iniciar. */
function perAgenda(A){
  const ev=(A?.agenda||[]).map(r=>{const m=String(r?.[0]||'').match(/INICIO DE SEMESTRE\s+(\d{2})\s*[-\/]\s*([12])/i),d=new Date(String(r?.[1]||'')+'T00:00:00');
    return m&&!isNaN(d)?{p:+m[1]*2+(+m[2]-1),d}:null}).filter(Boolean).sort((a,b)=>a.d-b.d);
  if(!ev.length)return null;
  const l=new Date(A.leido), ref=(isNaN(l)?Date.now():+l)-21*864e5, prox=ev.find(x=>x.d>ref);
  return prox?prox.p:ev[ev.length-1].p+1;
}
/* periodo para el que se planea: el de la cita vigente, o el siguiente al que se cursa ahora */
function perMetaBase(){
  const A=ALUMNO;if(!A)return null;
  const c=perDeFecha(A.cita?.inicio);
  const seen=[...(A.acreditadas||[]).map(a=>perIdx(a[2])),...(A.reprobadas_periodo||[]).map(r=>perIdx(r[1]))].filter(x=>x!=null);
  let t=c==null?null:(citaPasada(A)?c+1:c);
  if(seen.length){const min=Math.max(...seen)+((A.en_curso||[]).length?2:1);if(t==null||t<min)t=min}
  // sin materias del último periodo en el kárdex (actas cerradas sin aprobadas) el kárdex se queda un periodo atrás:
  // manda el próximo inicio de semestre de la Agenda escolar del SAES; con datos sin agenda, el calendario de Gestión Escolar
  const pa=perAgenda(A)??perIdx(DATA.calendario?.periodo);if(pa!=null&&(t==null||t<pa))t=pa;
  return t;
}
function perMeta(){const p=perMetaBase();return p==null?null:p+PLAN_PASO}
/* Desfase OFICIAL (regla del SAES): una reprobada se desfasa cuando pasan más de 2 periodos sin acreditarla.
   El "atraso" respecto al semestre propuesto solo aplica a planes por semestre (Energía); en los planes 2009
   (por niveles) el orden de la trayectoria es una recomendación y llevar otro orden no es desfase. */
const SEMESTRAL=()=>MAP()?.modelo==='semestral'||(CAPACIDADES.carrerasSemestrales||[]).includes(S.car);
const DESFASE_SEM={has:()=>SEMESTRAL()};   // compatibilidad con los usos anteriores
/* Modelo por semestres: no se pueden inscribir materias de más de un año (dos semestres) adelante del semestre de
   referencia, que es el más bajo con materias obligatorias pendientes (sin acreditar ni en curso). */
function semRef(){
  if(!SEMESTRAL()||!isPersonal())return null;
  const t=tr(),hecho=new Set([...t.done,...t.curso]),sp=semOf();let m=null;
  Object.entries(cur()).forEach(([k,v])=>{if(v[3]!=='O'||isElec(k)||hecho.has(k))return;const x=sp[k];if(x!=null&&(m==null||x<m))m=x});
  return m;
}
/* Calendario de Gestión Escolar: Ventanilla y modal de Situación comparten render y selección. */
// Las fechas civiles se comparan como ISO para evitar cambios de día por zona horaria.
SATE.calendario={
  categorias:['inscripcion','ordinaria','extraordinaria','inscripcion_ets','ets','vacaciones','saberes','descanso','sindical','suspension','reanudacion','inicio','inicio_nms','fin','politecnico','induccion','induccion_nms','nivelacion','planeacion','posgrado','grado_posgrado','academico','gestion','becas','servicios','tt','feriado'],
  hoy(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')},
  cita(){
    if(typeof isPersonal!=='function'||!isPersonal())return null;
    const iso=s=>{const m=String(s||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):null}, desde=iso(ALUMNO.cita?.inicio);
    return desde?{desde,hasta:iso(ALUMNO.cita.fin)||desde,titulo:SATE.texto('sate.calendario.tu_cita'),categoria:'gestion',periodo:perName(perDeFecha(ALUMNO.cita.inicio)),fuente:SATE.texto('sate.calendario.fuente_saes'),nota:ALUMNO.cita.inicio,personal:true}:null;
  },
  fusion(base,unidad){
    const locales=[...(unidad?.actividades||[]),...(unidad?.eventos||[])].map(e=>({...e,hasta:e.hasta||e.desde,periodo:e.periodo||unidad.periodo,audiencia:e.audiencia||['alumnos'],fuente:e.fuente||unidad.fuente,origen:'unidad'}));
    // Un calendario propio sustituye sus periodos completos; los avisos aislados conservan la base restante.
    const clave=e=>[e.categoria,e.periodo,[...(e.audiencia||['alumnos'])].sort().join(','),['descanso','sindical','politecnico'].includes(e.categoria)?e.desde:''].join('|');
    const reemplazos=new Set(locales.filter(e=>e.reemplaza).map(clave));
    return [...(base?.eventos||[]).filter(e=>!unidad?.periodosPropios?.includes(e.periodo)&&!reemplazos.has(clave(e))).map(e=>({...e,fuente:base.fuente,url:base.url,origen:'ipn'})),...locales];
  },
  filtrarAudiencia(eventos,ampliar=false,alumno=null){
    const nuevo=!alumno||!Number(alumno.avance?.cursados)||Number(alumno.avance.cursados)<=1;
    return eventos.filter(e=>(e.audiencia||['alumnos']).some(a=>a==='alumnos'||a==='nuevo_ingreso'&&nuevo||ampliar&&['docentes','posgrado','nms'].includes(a)));
  },
  eventos(ampliar=false){
    const base=typeof SATE_CONFIG==='undefined'?null:SATE_CONFIG.calendarioBase;
    const c=(typeof DATA==='undefined'?null:DATA.calendario)||(typeof SATE_CONFIG==='undefined'?null:SATE_CONFIG.calendariosUnidad?.[SATE_UNIDAD]);
    const alumno=typeof ALUMNO!=='undefined'?ALUMNO:SATE.alumno?.(), cita=this.cita();
    return this.filtrarAudiencia([...this.fusion(base,c),...(cita?[cita]:[])],ampliar,alumno);
  },
  proximos(n=5,categorias=this.categorias){const hoy=this.hoy();return this.eventos().filter(a=>a.hasta>=hoy&&categorias.includes(a.categoria)).sort((a,b)=>a.desde.localeCompare(b.desde)||a.hasta.localeCompare(b.hasta)).slice(0,Math.max(0,n))},
  recorte(pestana){
    if(SATE_CONFIG.unidades[SATE_UNIDAD].generica||!SATE_CONFIG.unidades[SATE_UNIDAD].pestanas.includes('calendario')||!['horarios','mapa','trayectoria'].includes(pestana))return [];
    const todos=this.proximos(Infinity,pestana==='trayectoria'?this.categorias:['gestion','academico','inscripcion','inicio','ets','inscripcion_ets']);
    const adeudos=pestana==='mapa'&&isPersonal()&&conSim(false,()=>tr().fail.length>0);
    return todos.filter(e=>pestana==='trayectoria'||(pestana==='horarios'?(e.personal||/citas publicadas|inscripci[oó]n/i.test(e.titulo)&&!['ets','inscripcion_ets'].includes(e.categoria)&&!/ETS/i.test(e.titulo)):(/^Inicio del periodo/i.test(e.titulo)||adeudos&&(['ets','inscripcion_ets'].includes(e.categoria)||/ETS/i.test(e.titulo))))).slice(0,2);
  },
  abrirProceso(evento){this.procesoPendiente=evento;SATE.ir('calendario')},
  pintarRecorte(pestana){
    if(SATE_CONFIG.unidades[SATE_UNIDAD].generica)return;
    // Mi trayectoria reutiliza el próximo proceso dentro de su resumen personal.
    const panel=document.getElementById(pestana==='horarios'?'v-hor':pestana==='mapa'?'v-tray':'sate-trayectoria');
    if(!panel||!['horarios','mapa','trayectoria'].includes(pestana))return;
    Array.from(panel.children).find(n=>n.className==='sate-recorte-calendario')?.remove();
    if(pestana==='trayectoria'&&isPersonal())return;
    const recorte=SateUI.recorteCalendario(this.recorte(pestana));
    if(recorte)panel.insertBefore(recorte,panel.firstChild);
  }
};
let CALAP=null, CALSEL=null;
function renderCalendario(rd,nDes){
  const des=nDes>0;
  CALAP={todos:true,adeudo:isPersonal()&&conSim(false,()=>tr().fail.length>0),cita:!des,sincita:des,desfasada:des,dictamen:!!rd?.n&&!rd.ok,transitorio:!!rd?.ok};
  drawCals();
}
function calItems(){
  const C=DATA.calendario;if(!C?.actividades?.length)return null;
  if(isPersonal()&&perMeta()!=null&&perIdx(C.periodo)!==perMeta())return null;
  const hoy=new Date();hoy.setHours(0,0,0,0);const d=x=>new Date(x+'T00:00:00'), ap=isPersonal()?CALAP:null;
  const items=C.actividades.map((a,i)=>({...a,i,ini:d(a.desde),fin:d(a.hasta||a.desde),si:ap?!!ap[a.para]:false}));
  if(items.every(a=>a.fin<hoy-7*864e5))return null;   // una semana después de la última actividad deja de mostrarse
  items.forEach(a=>{a.pasada=a.fin<hoy;a.hoy=a.ini<=hoy&&hoy<=a.fin;a.hoyD=hoy});
  return {C,items};
}
// Solo el aviso de reinscripción usa .cal-reinscripcion; las cuadrículas de horario (.cal) no son suyas.
function drawCals(){
  const R=calItems(), f=(x,o)=>x.toLocaleDateString('es-MX',o).replace('.','');
  document.querySelectorAll('.cal-reinscripcion').forEach(el=>{
    el.hidden=!R;if(!R){el.innerHTML='';return}
    const {C,items}=R, pers=isPersonal()&&!!CALAP, completo=el.classList.contains('cal-completo'), mio=pers&&!completo&&store.get('calVer','mio')==='mio';
    let vis=mio?items.filter(a=>a.si):items;if(!vis.length)vis=items;
    const prox=vis.find(a=>!a.pasada), sel=vis.find(a=>a.i===CALSEL)||prox||vis[vis.length-1];
    const ct=(k,v)=>SATE.texto('sate.calendario.'+k,v);
    const rango=a=>a.hasta?ct('rango',{desde:a.ini.getDate(),hasta:f(a.fin,{day:'numeric',month:'long'})}):f(a.ini,{day:'numeric',month:'long'});
    el.innerHTML=`<div class="cal-head"><h3>${esc(ct('reinscripcion',{periodo:C.periodo}))} <small>${esc(ct('gestion'))}</small></h3>`+
      (pers&&!completo?`<div class="seg sm" role="group" aria-label="${esc(ct('actividades'))}"><button type="button" data-calver="mio" aria-pressed="${mio}">${esc(ct('aplica'))}</button><button type="button" data-calver="todo" aria-pressed="${!mio}">${esc(ct('todas'))}</button></div>`:'')+`</div>`+
      `<div class="cal-strip">${vis.map(a=>`<button type="button" class="cal-c${a.pasada?' pasada':''}${a.si&&a.para!=='todos'?' aplica':''}${a===prox?' prox':''}" data-calc="${a.i}" aria-pressed="${a===sel}">`+
        `<span class="cal-d"><b>${a.ini.getDate()}</b><span>${f(a.ini,{month:'short'})}${a.hasta?` – ${a.fin.getDate()}${a.fin.getMonth()!==a.ini.getMonth()?' '+f(a.fin,{month:'short'}):''}`:''}</span></span>`+
        `<span class="cal-w">${a.hoy?(!a.hasta?ct('hoy'):+a.fin===+a.hoyD?ct('ultimo'):ct('en_curso',{dia:f(a.fin,{weekday:'long'})})):a.hasta?ct('entre_dias',{desde:f(a.ini,{weekday:'long'}),hasta:f(a.fin,{weekday:'long'})}):f(a.ini,{weekday:'long'})}</span>`+
        `<span class="cal-t">${esc(a.titulo||a.texto)}</span><span class="cal-l ${a.donde==='saes'?'saes':''}">${ct(a.donde==='saes'?'saes':'ventanillas')}</span>`+
        `${a===prox?`<i class="cal-b">${esc(ct('siguiente'))}</i>`:a.si&&a.para!=='todos'&&!a.pasada?`<i class="cal-b si">${esc(ct('te_aplica'))}</i>`:''}</button>`).join('')}</div>`+
      (sel?`<p class="cal-det"><b>${rango(sel)} · ${esc(sel.titulo||'')}.</b> ${esc(sel.texto)}</p>`:'')+
      `<p class="est-note">${esc([...(C.notas||[]),C.fuente?ct('fuente',{fuente:C.fuente}):''].filter(Boolean).join(' '))}</p>`;
    if(CALSEL==null){const st=el.querySelector('.cal-strip'),pc=el.querySelector('.cal-c.prox');if(st&&pc)st.scrollLeft=Math.max(0,pc.offsetLeft-8)}
  });
}
document.addEventListener('click',e=>{const v=e.target.closest('[data-calver-ver]');if(!v)return;
  CALSEL=+v.dataset.calverVer;drawCals();if(!document.querySelector(`.cal [data-calc="${CALSEL}"]`)){store.set('calVer','todo');drawCals()}   // la actividad no está en «Lo que me aplica»
  const c=[...document.querySelectorAll('.cal-reinscripcion')].find(x=>x.offsetParent);const card=c?.querySelector(`[data-calc="${CALSEL}"]`);
  if(c){c.scrollIntoView({behavior:'smooth',block:'start'});if(card)c.querySelector('.cal-strip').scrollLeft=Math.max(0,card.offsetLeft-8)}});
document.addEventListener('click',e=>{const b=e.target.closest('[data-calc],[data-calver]');if(!b)return;
  if(b.dataset.calver){store.set('calVer',b.dataset.calver);CALSEL=null}else CALSEL=+b.dataset.calc;
  const sc=[...document.querySelectorAll('.cal-strip')].map(x=>x.scrollLeft);drawCals();document.querySelectorAll('.cal-strip').forEach((x,i)=>x.scrollLeft=sc[i]||0)});
function failInfo(k){
  const t=tr(); if(!(k in t.failP)) return null;
  const idx=t.failP[k], meta=perMeta(), limite=idx==null?null:idx+2;
  const estado=idx==null||meta==null?'sinperiodo':meta>limite?'desfasada':meta===limite?'riesgo':'reciente';
  return {k,idx,limite,estado,veces:t.veces[k]??null,curso:t.curso.includes(k)};
}
/* Desfase en el periodo que se planea, según el calendario de Gestión Escolar (data/calendario.json → transitorio):
   - 'oficio': primer periodo de desfase (cursada por primera vez en los R.periodosAtras periodos anteriores); Gestión
     Escolar lo autoriza sin dictamen. Con R.maxDesfasadas o menos, todas así, se recursan e inscriben otras sin rebasar
     la carga media más los créditos de la materia con más créditos del plan.
   - 'dictamen': desfase más antiguo; se solicita dictamen a la Comisión de Situación Escolar.
   - 'agotada': ya se cursó dos veces; no puede recursarse sin dictamen. */
function reglaDesfase(){
  const C=DATA.calendario, R=C?.transitorio, meta=perMeta();
  if(!R||!isPersonal()||meta==null||perIdx(C.periodo)!==meta)return null;
  const des=tr().fail.map(failInfo).filter(f=>f&&f.estado==='desfasada'&&!f.curso), por={};
  des.forEach(f=>por[f.k]=(f.veces??0)>=2?'agotada':f.idx!=null&&f.idx>=meta-R.periodosAtras?'oficio':'dictamen');
  const ok=des.length>0&&des.length<=R.maxDesfasadas&&des.every(f=>por[f.k]==='oficio');
  const L=cargaDe(), mx=Math.max(0,...Object.entries(cur()).filter(([k])=>!isElec(k)).map(([,v])=>+v[1]||0));
  return {R,des,por,ok,n:des.length,mx,tope:ok&&L?.media!=null?L.media+mx:null};
}
/* Una sola proyección de las reglas existentes para tarjetas y calendario.
   Situación usa datos reales, aunque el alumno tenga una simulación activa en Mapa. */
function situacionDatos(){return conPlan(()=>conSim(false,()=>{
  if(!isPersonal())return null;
  const fis=tr().fail.map(failInfo).sort((a,b)=>(a.idx??99)-(b.idx??99));
  const dS=(tr().desfS||[]).filter(k=>!fis.some(f=>f.k===k));
  const nDes=fis.filter(f=>f.estado==='desfasada').length+dS.length;
  const rd=reglaDesfase(), D=statsDatos();
  return {fis,dS,nDes,rd,D,meta:perMeta(),aut:rd?.tope??SAES.autorizada(ALUMNO),
    adeudos:[...new Set([...tr().fail,...dS])],ret:retenidos()};
}),0)}
const cargaDe=()=>isPersonal()&&ALUMNO.carga?.media?{min:ALUMNO.carga.min,media:ALUMNO.carga.media,max:ALUMNO.carga.max}:CARGA[S.car];
/* Carga en créditos (Reglamento General de Estudios, art. 52):
   - Las reprobadas pendientes retienen sus créditos de forma permanente hasta acreditarse; inscribirlas no suma de nuevo.
   - Carga total = créditos retenidos + créditos de las materias nuevas (no reprobadas).
   - Regular: entre la carga mínima y la máxima (fracción I). Con adeudos: al menos la mínima y sin rebasar la media
     (fracción II), salvo que el SAES indique otra carga autorizada: esta ya incluye los créditos retenidos, por lo
     que los créditos nuevos permitidos son la autorizada menos los retenidos. */
const retenidos=()=>isPersonal()?tr().fail.filter(k=>cur()[k]).reduce((s,k)=>s+cur()[k][1],0):0;
function cargaInfo(nuevos){
  const L=cargaDe();if(!L)return null;
  const ret=retenidos(), aut=isPersonal()?SAES.autorizada(ALUMNO):null, adeudo=ret>0, rd=isPersonal()?reglaDesfase():null, regla=rd?.tope!=null?rd:null;
  const tope=regla?regla.tope:aut!=null?aut:(adeudo?L.media:L.max), libre=Math.max(0,tope-ret);   // tope total y créditos nuevos permitidos
  const total=ret+(nuevos||0);
  return {L,ret,aut,regla,adeudo,libre,tope,total,nuevos:nuevos||0,faltaMin:Math.max(0,L.min-total)};
}
const saveT=()=>{
  const t=tr(), base=conPlan(()=>tr(),0), anterior=store.get('t.'+S.car,{});
  const wantPorPeriodo={...base.wantPorPeriodo,[planClave(0)]:[...base.want],[planClave(PLAN_PASO)]:[...t.want]};
  if(PLAN_DOS_PERIODOS&&!PLAN_PASO)wantPorPeriodo[planClave(1)]=(wantPorPeriodo[planClave(1)]||wantPorPeriodo.siguiente||[]).filter(k=>!base.want.includes(k));
  // Conservar campos desconocidos y el espejo legado de N para lectores ipnt 1.
  store.set('t.'+S.car,{...anterior,want:[...base.want],wantPorPeriodo});
  for(const k in T)delete T[k];PLAN_CACHE=null;
};

/* ---------- oferta ---------- */
// clase: [carrera,turno,nivel,grupo,asig,[prof],[[dia,ini,fin]],creditos,clave,tipo]
const keyOf=c=>c[0]+'|'+c[3]+'|'+c[4];
const name=c=>DATA.asig[c[4]];
const profs=c=>c[5].map(i=>DATA.prof[i]).join(' / ');
const hue=c=>(c[4]*137.508)%360;
const classes=()=>DATA.periodos[S.per];
let KEYMAP={};
function actualizarOferta(){for(const p in DATA.periodos){const m=new Map();DATA.periodos[p].forEach(c=>m.set(keyOf(c),c));KEYMAP[p]=m}}
actualizarOferta();
const byKey=k=>KEYMAP[S.per].get(k);
const selected=()=>plan().sel.map(byKey).filter(Boolean);
const ownAsClasses=()=>plan().own.map((o,i)=>o.oculto?null:{own:true,i,n:o.n,tipo:o.tipo,h:o.d.map(d=>[d,o.a,o.b])}).filter(Boolean);
const ownVis=()=>plan().own.filter(o=>!o.oculto);
const slots=x=>x.own?x.h:x[6];
const offeredClaves=()=>new Set(classes().filter(c=>c[0]===S.car).map(c=>c[8]));

function overlaps(a,b){for(const x of slots(a))for(const y of slots(b))if(x[0]===y[0]&&x[1]<y[2]&&y[1]<x[2])return true;return false}
function pattern(c){
  if(!c[6].length) return ['Sin horario en SAES'];
  const g={};c[6].forEach(([d,a,b])=>{const k=hm(a)+'–'+hm(b);(g[k]=g[k]||[]).push(DAYS[d])});
  return Object.entries(g).map(([t,ds])=>ds.join(' ')+'  '+t);
}

/* =========================================================
   TRAYECTORIA
   ========================================================= */
const MAP=()=>DATA.mapas[S.car];
const cur=()=>MAP().cur;                       // clave -> [nombre, créditos TEPIC, nivel, tipo, {cr, satca?, cr_calculado?}]
function prereqs(){                             // clave -> [claves requisito directas]: tutorías + flechas de la trayectoria
  if(MAP().req) return MAP().req;
  const L=MAP().layout, out={};
  if(!L) return out;
  L.edges.forEach(([s,d])=>{const a=L.boxes[s][4], b=L.boxes[d][4];if(a&&b)(out[b]=out[b]||[]).push(a)});
  return out;
}
function dependents(){const out={};Object.entries(prereqs()).forEach(([b,as])=>as.forEach(a=>(out[a]=out[a]||[]).push(b)));return out}
function semOf(){                               // clave -> semestre propuesto
  const L=MAP().layout, out={};
  if(L) L.boxes.forEach(b=>{if(b[4]&&!(b[4] in out))out[b[4]]=b[6]});
  else Object.entries(cur()).forEach(([k,v])=>out[k]=v[2]);
  return out;
}
function levelStats(){
  const done=new Set(tr().done), by={};
  Object.entries(cur()).forEach(([k,[n,cr,niv,t]])=>{if(t!=='O'||/^ELECTIVA/.test(n))return;const s=by[niv]||(by[niv]={tot:0,ok:0});s.tot++;if(done.has(k))s.ok++});
  return by;
}
function levelOpen(niv){                        // ¿cumple la seriación recomendada para cursar ese nivel?
  const r=MAP().reglas[niv];if(!r) return {ok:true,miss:[]};
  const st=levelStats(), miss=[];
  Object.entries(r).forEach(([k,f])=>{const s=st[k];if(s&&s.ok/s.tot<f-1e-9)miss.push(`N${esc(k)} ${Math.round(f*100)} %`)});
  return {ok:!miss.length,miss};
}
// periodo escolar que se planea = "Periodos escolares que cursaste" (Cita del SAES) + 1. En los planes por niveles
// es el conteo de periodos inscritos, no el semestre de las materias.
function semNow(){const c=tr().cursados;return c==null?null:c+1}
function ancestors(keys){const pre=prereqs(),out=new Set(),walk=k=>(pre[k]||[]).forEach(x=>{if(!out.has(x)){out.add(x);walk(x)}});keys.forEach(walk);return out}
function statusOf(k){
  if(!isPersonal()&&!PLAN_PASO) return 'rest';
  const done=new Set(tr().done);
  if(done.has(k)) return 'done';
  // en curso primero: si recursa una reprobada este semestre, se planea suponiendo que la acredita (no se vuelve a proponer)
  if(tr().curso.includes(k)) return 'curso';
  const fi=failInfo(k);
  if(fi) return fi.estado==='desfasada'?'late fail':'fail';
  if((tr().desfS||[]).includes(k)) return 'late';   // desfasada según el SAES (plan por semestres)
  // las materias en curso cuentan como requisito cumplido (se planea suponiendo que se acreditan)
  const req=(prereqs()[k]||[]).filter(x=>!done.has(x)&&!tr().curso.includes(x));
  // solo la seriación directa bloquea: el plan es flexible y la oferta varía, así que si ya acreditaste los requisitos
  // puedes cursar la materia aunque sea de otro semestre. La seriación por nivel queda como recomendación (inspector).
  const lock=req.length>0;
  const sn=semNow(), sp=semOf()[k];
  let st='rest';
  // Con datos del SAES manda su lista de desfasadas (ya aplicada arriba con desfS): una materia de un semestre anterior
  // que no se ha cursado va atrasada respecto al plan, no desfasada (el SAES no siempre la marca así).
  const saesDesfase=isPersonal()&&!!ALUMNO&&('desfasadas_saes' in ALUMNO||!!ALUMNO.desfase_saes);
  if(sn&&sp){if(sp<sn)st=DESFASE_SEM.has(S.car)&&!saesDesfase?'late':'prev';else if(sp===sn)st='now'}
  const r=semRef(), far=r!=null&&sp!=null&&sp>r+2;   // fuera de la ventana de un año
  return st+(lock?' lock':'')+(far?' far':'');
}
// Las electivas se acreditan por horas de actividades (DIE-03, Electivas de la unidad), nunca con un grupo del horario:
// no se eligen para cursar, no suman créditos a la selección ni se sugieren.
function isElec(k){return /^ELECTIVA/i.test(cur()[k]?.[0]||'')}
/* Perfil ficticio para conocer la herramienta sin datos del SAES: a partir del mapa de la carrera elegida, ~45 % de las
   obligatorias acreditadas (con algunos extraordinarios y ETS), una reprobada pendiente y cinco materias en curso. */
function perfilDemo(){
  const car=S.car, m=DATA.mapas?.[car];if(!m)return null;
  const op=DATA.opciones_plan?.[car]||{carrera:car,plan:null}, c=m.cur;
  const ob=Object.keys(c).filter(k=>c[k][3]==='O'&&!isElec(k)&&c[k][1]>0).sort((a,b)=>c[a][2]-c[b][2]||a.localeCompare(b));
  const acr=ob.slice(0,Math.round(ob.length*.45)), resto=ob.slice(acr.length), nper=Math.max(1,Math.ceil(acr.length/6));   // ~6 materias por periodo
  const base=perIdx('26/1')-nper+1, cal=[9,8,10,8,9,7,9,8,10,6,9,8];
  const acreditadas=acr.map((k,i)=>[k,cal[i%cal.length],perName(base+Math.floor(i/6)),i%11===5?'EXT':i%13===7?'ETS':'ORD']);
  const rep=resto[0], enCurso=resto.slice(1,6), obt=acr.reduce((t,k)=>t+c[k][1],0), total=ob.reduce((t,k)=>t+c[k][1],0);
  const prom=acreditadas.reduce((t,a)=>t+a[1],0)/Math.max(1,acreditadas.length);
  return {upiita_saes:1,demo:true,unidad:UNIDAD,leido:new Date().toISOString(),boleta:'0000000000',nombre:'ALUMNO DE DEMOSTRACIÓN',
    carrera:op.carrera,carrera_nombre:DATA.carreras[car],plan:op.plan,promedio:+(prom-.2).toFixed(2),acreditadas,en_curso:enCurso,
    horario_inscrito:[],reprobadas:[],reprobadas_periodo:rep?[[rep,perName(base+nper-1),1]]:[],
    avance:{obtenidos:obt,faltan:total-obt,cursados:nper+1,autorizada:`MÁXIMA (${fmtCr(Math.round(total/8))} CREDITOS)`},
    carga:{total,min:Math.round(total/12),max:Math.round(total/8)},cita:{}};
}
if(DEMO){
  ALUMNO=perfilDemo();
  document.body.insertAdjacentHTML('afterbegin',`<div class="demo-bar" role="status"><b>Modo demostración</b><span>Ves los datos de un alumno ficticio; nada se guarda en tu cuenta ni en tus datos del SAES.</span><button class="btn" type="button" id="demo-salir">Salir del modo demostración</button></div>`);
  $('#demo-salir').addEventListener('click',()=>{try{sessionStorage.removeItem('ipnt.demo')}catch(e){}location.reload()});
}
function available(k){const s=statusOf(k);return !isElec(k)&&!tr().done.includes(k)&&!tr().curso.includes(k)&&!s.startsWith('done')&&!s.startsWith('curso')&&!s.includes('lock')&&!s.includes('far')}

/* data/sugerencias.json: una materia con «antesDe» se sugiere hasta tener acreditadas o en curso las demás que pide
   esa otra materia (p. ej., Investigación y desarrollo de proyectos, el periodo previo a Metodología de la investigación) */
function aunNo(k){
  const r=DATA.sugerencias?.[S.car]?.[k];if(!r?.antesDe||!isPersonal())return false;
  const hecho=new Set([...tr().done,...tr().curso]);
  return (prereqs()[r.antesDe]||[]).some(x=>x!==k&&cur()[x]&&!hecho.has(x));
}
function suggestions(){
  // prioridad: desfasadas, reprobadas, atrasadas; después todo lo que ya puedes cursar (de cualquier semestre),
  // primero las que desbloquean más materias y luego por semestre propuesto
  const sp=semOf(), off=offeredClaves(), rank={late:0,fail:1,prev:2,now:3,rest:3};
  const dep=dependents(), memo={}, unlocks=k=>memo[k]??(memo[k]=(()=>{const seen=new Set(),walk=x=>(dep[x]||[]).forEach(y=>{if(!seen.has(y)){seen.add(y);walk(y)}});walk(k);return seen.size})());
  const ci=cargaInfo(0), failS=new Set(tr().fail), cost=k=>failS.has(k)?0:cur()[k][1];
  // meta de créditos nuevos: con adeudos, lo autorizado además de los retenidos; regular, la carga media
  const target=ci?(ci.adeudo?ci.libre:Math.min(ci.libre,ci.L.media)):40;
  const pre=prereqs(), hecho=new Set([...tr().done,...tr().curso]);
  const sigue=k=>cur()[k][3]==='P'&&(pre[k]||[]).some(x=>hecho.has(x)&&cur()[x]?.[3]==='P');   // optativa: continuación de su línea
  const cands=Object.keys(cur()).filter(k=>available(k)&&(PLAN_PASO||off.has(k))&&(cur()[k][3]==='O'||sigue(k))&&!aunNo(k))
    .sort((a,b)=>{const ra=rank[statusOf(a).split(' ')[0]], rb=rank[statusOf(b).split(' ')[0]];
      return ra-rb||(ra===3?unlocks(b)-unlocks(a):0)||(sp[a]||99)-(sp[b]||99)||cur()[a][2]-cur()[b][2]});
  const out=[], oq=optCupo(), tomadas={};let cr=0;
  for(const k of cands){if(cr+cost(k)>target+0.01)continue;
    const nv=nivOpt(k,oq);if(nv){if((tomadas[nv]||0)>=oq[nv].libre)continue;tomadas[nv]=(tomadas[nv]||0)+1}   // el espacio del nivel ya está cubierto
    out.push(k);cr+=cost(k)}
  return {list:out,cr,target,cands,ret:ci?.ret||0};
}

let ZOOM=null, MAPSC=1;   // MAPSC: escala con la que se dibujó el mapa por última vez
/* Bandas de semestre: el centro de cada fila es la mediana de sus bloques (las etiquetas del PDF pueden estar
   corridas) y cada banda llega a la mitad del espacio con la vecina, así ningún bloque se ve en la fila de al lado. */
function rowBands(L){return SateUI.bandasMapa(L)}
/* Espacios de optativas del mapa: se llenan con las optativas acreditadas, en curso o elegidas (primero las del
   mismo semestre; si no coincide, en el siguiente espacio libre). Un espacio unido por flecha a otro ya ocupado
   toma la continuación de esa línea (optativa de 6.º -> 7.º) o la sugiere. */
function slotFill(L,want){
  const out=new Map(), c=cur(), t=isPersonal()?tr():{done:[],curso:[]};
  const rank=k=>t.done.includes(k)?0:t.curso.includes(k)?1:want.has(k)?2:9;
  const cands=Object.keys(c).filter(k=>c[k][3]==='P'&&!isElec(k)&&rank(k)<9).sort((a,b)=>rank(a)-rank(b)||c[a][2]-c[b][2]);
  const slots=L.boxes.map((b,i)=>[i,b]).filter(([,b])=>!b[4]&&/^optativa/i.test(b[5])).sort((a,b)=>a[1][6]-b[1][6]||a[1][0]-b[1][0]);
  const used=new Set(), dep=dependents(), next=i=>L.edges.filter(e=>e[0]===i).map(e=>e[1]);
  const put=(i,k)=>{out.set(i,{k});used.add(k)};
  // el espacio con nivel conocido (b[7]) solo lo cubre una optativa de ese nivel; N espacios del nivel, N optativas
  for(const [i,b] of slots){if(out.has(i))continue;const k=cands.find(k=>!used.has(k)&&c[k][2]===(b[7]||b[6]));if(k)put(i,k)}
  for(const [i,b] of slots){if(out.has(i)||b[7])continue;const k=cands.find(k=>!used.has(k));if(k)put(i,k)}
  // continuación de la línea en el espacio siguiente (flecha entre espacios)
  for(const [i] of slots){const f=out.get(i);if(!f?.k)continue;
    for(const j of next(i)){const sig=(dep[f.k]||[]).find(x=>c[x]?.[3]==='P');if(!sig)continue;
      if(L.boxes[j][7]&&c[sig][2]!==L.boxes[j][7])continue;
      const cur_=out.get(j);if(cur_?.k===sig)continue;
      if(!cur_||cur_.sigue){if(rank(sig)<9){if(cur_?.k)used.delete(cur_.k);put(j,sig)}else if(!cur_)out.set(j,{sigue:sig})}}}
  return out;
}
/* Una sola representación para Mapa y el presente. La prioridad de desfase evita
   que «late fail» se cuente como una reprobada ordinaria. */
function minimapaCurricular(L=MAP().layout,FILL,op={}){
  return SateUI.minimapaCurricular({isPersonal,cur,slotFill,isElec,statusOf,esc,SATE},L,FILL,op);
}
// modo personal: materias que puedes cursar el siguiente periodo (verde) y las sugeridas para tu carga (contorno)
let MARK={avail:new Set(),sug:new Set()};
let SHOWSUG=store.get('verSug',false);   // apagadas por defecto: el alumno las activa a propósito
// planes por niveles (según el modelo del plan): las filas del mapa son niveles, no semestres
const porNiveles=()=>MAP().modelo==='niveles';
// vista del mapa con datos del SAES: 'todo' (mapa completo), 'pend' (pendientes, por defecto) o 'sigue' (recomendaciones)
const mapVista=()=>store.get('mapVista',store.get('mapFull',false)?'todo':'pend');
// trazo ortogonal con esquinas redondeadas (mapas por áreas: cada flecha lleva su propia pista)
function rutaRedonda(P,r=7){
  let d=`M${P[0][0]} ${P[0][1]}`;
  for(let i=1;i<P.length-1;i++){const [a,b,c]=[P[i-1],P[i],P[i+1]];
    const l1=Math.hypot(b[0]-a[0],b[1]-a[1]),l2=Math.hypot(c[0]-b[0],c[1]-b[1]),k=Math.min(r,l1/2,l2/2);
    if(k<.5){d+=` L${b[0]} ${b[1]}`;continue}
    const p=[b[0]+(a[0]-b[0])*k/l1,b[1]+(a[1]-b[1])*k/l1],q=[b[0]+(c[0]-b[0])*k/l2,b[1]+(c[1]-b[1])*k/l2];
    d+=` L${+p[0].toFixed(1)} ${+p[1].toFixed(1)} Q${b[0]} ${b[1]} ${+q[0].toFixed(1)} ${+q[1].toFixed(1)}`}
  const z=P.at(-1);return d+` L${z[0]} ${z[1]}`;
}
/* Cupo de optativas por nivel (planes cuyo mapa indica el nivel de cada espacio): {nivel:{total,hechas,libre}}.
   «hechas» son las acreditadas o en curso; «libre» = espacios del nivel aún sin cubrir. null si el plan no lo indica. */
function optCupo(){
  const L=MAP().layout;if(!L)return null;
  const q={}, c=cur(), t=isPersonal()?tr():{done:[],curso:[]};
  L.boxes.forEach(b=>{if(!b[4]&&/^optativa/i.test(b[5])&&b[7]>0)(q[b[7]]=q[b[7]]||{total:0,hechas:0}).total++});
  if(!Object.keys(q).length)return null;
  new Set([...t.done,...t.curso]).forEach(k=>{if(c[k]?.[3]==='P'&&!isElec(k)&&q[c[k][2]])q[c[k][2]].hechas++});
  Object.values(q).forEach(v=>v.libre=Math.max(0,v.total-v.hechas));
  return q;
}
// nivel de una optativa con espacios por nivel (o 0 si no aplica)
const nivOpt=(k,q)=>{const v=cur()[k];return q&&v&&v[3]==='P'&&!isElec(k)&&q[v[2]]?v[2]:0};
// ¿las materias `ks` caben en los espacios libres de optativa de su nivel? Devuelve los niveles que se pasan: {nivel:{n,libre}}
function optExceso(ks,q){
  if(!q)return {};
  const n={};ks.forEach(k=>{const v=nivOpt(k,q);if(v)n[v]=(n[v]||0)+1});
  const out={};Object.keys(n).forEach(v=>{if(n[v]>q[v].libre)out[v]={n:n[v],libre:q[v].libre,total:q[v].total}});
  return out;
}
let AVISO_T=0;
function avisoOpt(msg){
  let el=document.getElementById('opt-aviso');
  if(!el){el=document.createElement('p');el.id='opt-aviso';el.className='opt-aviso';el.setAttribute('role','status');document.body.appendChild(el)}
  el.textContent=msg;el.hidden=false;clearTimeout(AVISO_T);AVISO_T=setTimeout(()=>{el.hidden=true},7000);
}
// texto breve cuando una optativa elegida no cubre un espacio (el alumno puede cursarla igual, como materia extra)
function avisoOptativa(k,otras){
  const q=optCupo(),v=nivOpt(k,q);if(!v)return;
  const t=q[v], dup=otras.filter(x=>x!==k&&nivOpt(x,q)===v).length;
  if(dup+1<=t.libre)return;
  avisoOpt(t.libre<=0?`El plan pide ${t.total===1?'una optativa':t.total+' optativas'} de nivel ${v} y ya ${t.total===1?'cubriste ese espacio':'cubriste esos espacios'}: ${pretty(cur()[k][0])} no cubre otro espacio, solo suma como materia adicional.`:
    `El plan solo deja ${t.libre===1?'un espacio libre':t.libre+' espacios libres'} de optativa de nivel ${v}: con ${pretty(cur()[k][0])} ya elegiste más de las que cubren ese nivel; las demás no cubren espacio.`);
}
function boxHtml(...args){
  return SateUI.cajaMateria({cur,statusOf,planAsignado,isElec,MARK,S,fmtCr,textoCreditos,porNiveles,esc,SATE,PLAN_DOS_PERIODOS,planEtiqueta},...args);
}

function inspParts(k){
  const c=cur(), [n,cr,niv]=c[k], pre=(prereqs()[k]||[]).filter(x=>c[x]), post=(dependents()[k]||[]).filter(x=>c[x]);
  const all=ancestors([k]), sem=semOf()[k], off=offeredClaves().has(k);
  const nm=x=>esc(pretty(c[x][0]));
  const meta=`${esc(textoCreditos(k,cr,true))} ${ayudaCreditos(k)} · nivel ${niv}${sem&&!porNiveles()?' · semestre propuesto '+sem:''}`;
  const l1=`<b>${esc(n)}</b> <span class="mono">${esc(k)}</span><span class="insp-meta">${meta}</span>`;
  // con datos del SAES: su estado y qué le falta (en lugar de marcarlo en el mapa)
  let st='';
  if(PLAN_DOS_PERIODOS&&PLAN_PASO===1&&planAsignado(k)===0)st=`Planeada en ${esc(planEtiqueta(0))}. Se supone acreditada para planear ${esc(planEtiqueta(1))}.`;
  else if(isPersonal()){const s0=statusOf(k),dn=new Set([...tr().done,...tr().curso]);
    const miss=pre.filter(x=>!dn.has(x)), lv=levelOpen(niv);
    st=s0==='done'?'Ya la acreditaste.':s0==='curso'?'La estás cursando.':s0.includes('fail')?'<b>Por recursar.</b>':
      s0.includes('lock')?`<b>Aún no puedes cursarla:</b> te falta ${miss.map(nm).join(', ')}.`:
      `<b>Puedes cursarla.</b>${lv.ok?'':` Seriación recomendada por nivel: ${lv.miss.join(', ')}.`}`}
  if(isElec(k))return {l1,l2:(st?`<p class="insp-st">${st}</p>`:'')+`<p>${SATE.texto(CAPACIDADES.electivas?.texto||'sate.electivas.acreditacion_consulta',{enlace:'#/'+UNIDAD+'/tramites/'+CAPACIDADES.electivas?.tramite})}</p>`};
  const l2=(st?`<p class="insp-st">${st}</p>`:'')+
    `<p><span class="tag-rel pre">Antes</span><b>Requisitos:</b> ${pre.length?pre.map(nm).join(', '):'ninguno registrado'}${all.size>pre.length?` <span class="muted">(${all.size} materias en toda su cadena)</span>`:''}</p>`+
    `<p><span class="tag-rel post">Después</span><b>Es requisito de:</b> ${post.length?post.map(nm).join(', '):'ninguna materia'}</p>`+
    (off?'':'<p class="muted"><i>Sin grupos en el periodo consultado.</i></p>');
  return {l1,l2};
}
/* Materias del horario inscrito que no son de este plan (movilidad/flexibilidad académica, cambio de carrera u otra carrera de la
   unidad): se muestran como equivalencia y, si la tabla del SAES la registra, con la materia de tu plan que les
   corresponde. No se cuentan en el avance ni en la simulación hasta que el SAES las reconozca en tu plan. */
function renderEqvHorario(A){
  const c=cur(), box=$('#est-eqv');
  const H=(A.horario_inscrito||[]).filter(h=>h&&h[1]&&!c[h[1]]);
  const ext=[...new Map(H.map(h=>[h[1],h])).values()];
  box.hidden=!ext.length;if(!ext.length){box.innerHTML='';return}
  const eq=eqvPlan;
  box.innerHTML=`<h3>Equivalencias en tu horario ${info('Materias inscritas de otra carrera o plan (por ejemplo, por movilidad/flexibilidad académica o cambio de carrera). En el mapa y en la simulación cuentan como su materia equivalente de tu plan; en tus créditos oficiales, cuando el SAES las reconozca. Correspondencia según la tabla de Equivalencias del SAES.')}</h3><div class="eqv-fichas">`+
    ext.map(h=>{const m=eq(h[1]);return `<span class="eqv-f${m.length?'':' sin'}" title="${esc(pretty(h[2]||h[1]))} ${esc(h[1])}${h[0]?' · grupo '+esc(h[0]):''}"><b>${esc(pretty(h[2]||h[1]))}</b> <span class="mono">${esc(h[1])}</span><i aria-hidden="true">→</i>${m.length?m.map(k=>`<b>${esc(pretty(c[k][0]))}</b> <span class="mono">${esc(k)}</span>`).join(' o '):'<em>sin equivalencia registrada</em>'}</span>`}).join('')+'</div>';
}
function planAcciones(k){
  const paso=planAsignado(k), base=conPlan(()=>tr(),0);
  if(isElec(k)||base.done.includes(k)||base.curso.includes(k))return '';
  const ob=paso!=null&&conPlan(()=>tr().oblig.includes(k),paso);
  const boton=(clave,texto,atributos='')=>`<button class="btn primary" type="button" data-${clave}="${esc(k)}"${atributos}>${esc(texto)}</button>`;
  if(paso==null)return boton('fwant',`Agregar a ${planEtiqueta(S.planPaso)}`);
  return (ob?'':boton('unwant',`Quitar de ${planEtiqueta(paso)}`,` data-plan-quitar="${paso}"`))+
    (ob&&paso===0?'':boton('fmover',`Mover a ${planEtiqueta(1-paso)}`));
}
function renderInsp(){
  const k=S.mapHover, c=cur(), el=$('#insp');
  el.classList.toggle('act',!!(S.mapFocus&&k&&c[k]));
  el.hidden=!k||!c[k];
  if(el.hidden){el.innerHTML='';return}
  const {l1,l2}=inspParts(k), w=planAsignado(k)===S.planPaso, ob=tr().oblig.includes(k), done=statusOf(k)==='done';
  el.innerHTML=`<div class="insp-t">${l1}</div><div class="insp-b">${l2}</div>`+(S.mapFocus?`<div class="insp-act">${PLAN_DOS_PERIODOS?planAcciones(k):ob||done||isElec(k)?'':`<button class="btn primary" type="button" data-fwant="${esc(k)}">${w?'Quitar de mi plan':'Quiero cursarla'}</button>`}<button class="btn" type="button" data-fclose="1">Cerrar</button></div>`:'');
  montarAyudasCreditos();
}
function leyendaMapa(completa=false){
  const tx=k=>esc(SATE.texto('sate.planeacion.'+k));
  const estados=[['avail','estado_disponible'],['want','estado_elegida'],['fail','estado_recurse'],['done','estado_acreditada'],['curso','estado_curso']]
    .map(([cl,k])=>`<span><i class="l-${cl}"></i>${tx(k)}</span>`).join('');
  if(!completa)return estados;
  const nivs=[...new Set(Object.values(cur()).map(v=>v[2]))].sort((a,b)=>a-b);
  return estados+`<span class="lg-niv">${nivs.map(n=>`<span><i class="l-niv" style="background:var(--n${n})"></i>${esc(SATE.texto('sate.planeacion.nivel',{n}))}</span>`).join(' ')}</span>`+
    `<span><i class="l-req"></i>${tx('estado_requisito')}</span><span><i class="l-slot"></i>${tx('estado_libre')}</span><span><i class="l-late"></i>${tx('estado_desfase')}</span>`;
}
function renderLegend(){$('#legend').innerHTML=leyendaMapa()}
function renderSide(){const r=conSim(usaSim('sugg'),()=>conPlan(renderSide0));montarAyudasCreditos();return r}
const AREA_COLORES=['#8a98c7','#a76987','#577d63','#4d6f8d','#c9a36a','#721e45'];
function requisitosElegidos(want){
  const c=cur(), done=new Set(tr().done), pedidos=new Map(), acreditados=new Set(), materias=new Set();
  // Conserva la seriación transitiva del mapa; cada requisito compartido ocupa una sola fila.
  want.forEach(m=>ancestors([m]).forEach(k=>{
    if(!c[k]||k===m)return;
    if(done.has(k)){acreditados.add(k);return}
    if(!pedidos.has(k))pedidos.set(k,[]);
    pedidos.get(k).push(m);materias.add(m);
  }));
  return {pedidos,acreditados:acreditados.size,materias:materias.size};
}
function requisitosHtml(want){
  const {pedidos,acreditados,materias}=requisitosElegidos(want), c=cur(), cats=catDe(), grupos=new Map();
  const tx=(k,v)=>SATE.texto('sate.planeacion.'+k,v);
  if(!pedidos.size)return `<p class="muted">${esc(tx('requisitos_sin_pendientes'))}</p>`;
  pedidos.forEach((piden,k)=>{const area=cats[k]||tx('requisitos_sin_area');if(!grupos.has(area))grupos.set(area,[]);grupos.get(area).push([k,piden])});
  const cols=MAP().layout?.cols||[];
  return `<details class="chosen-requisitos"><summary><span>${esc(tx('requisitos_resumen',{n:pedidos.size,m:materias}))}</span><span class="req-ver">${esc(tx('requisitos_ver'))}</span></summary>`+
    `<table class="req-tabla"><thead><tr><th scope="col">${esc(tx('requisitos_materia'))}</th><th scope="col">${esc(tx('requisitos_pide'))}</th></tr></thead>`+
    [...grupos].sort(([a],[b])=>a.localeCompare(b,'es')).map(([area,filas])=>{
      const i=cols.findIndex(([n])=>n.split(' · ').includes(area)), color=AREA_COLORES[Math.max(0,i)%AREA_COLORES.length];
      return `<tbody><tr class="req-area"><th colspan="2" scope="colgroup" style="--area:${color}">${esc(area)}</th></tr>`+
        filas.sort(([a],[b])=>c[a][0].localeCompare(c[b][0],'es')).map(([k,piden])=>`<tr class="req-fila" tabindex="0" data-req="${esc(k)}" data-piden="${esc(piden.join(' '))}"><th scope="row"><span class="grp">${esc(k)}</span> ${esc(pretty(c[k][0]))}${want.includes(k)?` <small class="req-elegido">${esc(tx('requisitos_elegido'))}</small>`:''}</th><td><span class="req-etiqueta">${esc(tx('requisitos_pide'))}: </span>${piden.map(m=>esc(pretty(c[m][0]))).join('; ')}</td></tr>`).join('')+'</tbody>';
    }).join('')+'</table>'+(acreditados?`<p class="muted req-acreditados">${esc(tx('requisitos_acreditados',{n:acreditados}))}</p>`:'')+'</details>';
}
function renderSide0(){
  if(S.reqHover){S.reqHover=null;S.mapHover=null;S.mapFocus=false;resaltarMapa()}
  const c=cur(), want=tr().want.filter(k=>c[k]), credWant=want.reduce((s,k)=>s+c[k][1],0), off=offeredClaves();
  const tx=(k,v)=>SATE.texto('sate.planeacion.'+k,v);
  $('#plan-panel').setAttribute('aria-label',tx('titulo'));$('#map-ayuda').textContent='ⓘ '+tx('leer_mapa');$('#plan-periodos').setAttribute('aria-label',tx('periodos'));
  if(!PLAN_DOS_PERIODOS)S.planPaso=0;
  $('#plan-opciones').hidden=!PLAN_DOS_PERIODOS;
  document.querySelectorAll('[data-plan-paso]').forEach(b=>{b.hidden=!PLAN_DOS_PERIODOS;const paso=+b.dataset.planPaso;b.textContent=planEtiqueta(paso);b.setAttribute('aria-pressed',String(paso===S.planPaso))});
  $('#plan-supuesto').hidden=PLAN_PASO!==1;$('#plan-supuesto').setAttribute('aria-label',tx('supuesto_titulo',{periodo:planEtiqueta(1)}));
  const etiqueta=(id,largo,corto)=>{$(id).innerHTML=`<span class="sate-texto-largo">${esc(largo)}</span><span class="sate-texto-corto">${esc(corto)}</span>`};
  etiqueta('#plan-simular',tx('simular'),tx('simular_corto'));$('#h-chosen').textContent=tx('elegidas');
  const menu=$('#plan-menu');
  if(menu.dataset.telefono!==String(MQ_PHONE.matches)){menu.dataset.telefono=String(MQ_PHONE.matches);menu.open=!MQ_PHONE.matches}
  menu.querySelector('summary').textContent='⋯';menu.querySelector('summary').setAttribute('aria-label',tx('acciones'));
  $('#b-sugg').textContent=tx('agregar');$('#b-go').hidden=false;
  const periodoConocido=planInicio()!=null;
  etiqueta('#b-go',tx(periodoConocido?'horarios':'horarios_neutro',{periodo:planEtiqueta(0)}),tx('horarios_corto'));etiqueta('#b-none',tx(periodoConocido?'quitar_activo':'quitar_corto',{periodo:planEtiqueta(PLAN_PASO)}),tx('quitar_corto'));
  if(PLAN_DOS_PERIODOS)etiqueta('#b-go',tx('horarios',{periodo:planEtiqueta(0)}),`Horarios de ${planEtiqueta(0)}`);
  $('#plan-activo').hidden=$('#plan-leyenda').hidden=true;
  $('#plan-periodos').hidden=!PLAN_DOS_PERIODOS;$('#plan-vista-etiqueta').hidden=!PLAN_DOS_PERIODOS;
  $('#chosen').classList.toggle('un-periodo',!PLAN_DOS_PERIODOS);
  for(const id of ['#plan-simular','#b-go','#b-none'])$(id).disabled=!want.length;
  if(PLAN_DOS_PERIODOS)$('#b-go').disabled=!conPlan(()=>tr().want.length,0);
  $('#plan-deshacer').textContent=tx('deshacer');
  if(PLAN_UNDO&&(PLAN_UNDO.car!==S.car||PLAN_UNDO.clave!==planClave(0)))PLAN_UNDO=null;
  $('#plan-deshacer').hidden=!PLAN_UNDO;
  $('#plan-activo').textContent='';$('#plan-leyenda').innerHTML='';
  const nuevos=want.filter(k=>!tr().fail.includes(k)).reduce((s,k)=>s+c[k][1],0), ci=cargaInfo(nuevos);
  $('#plan-resumen').innerHTML=planPasos().map(paso=>conPlan(()=>{
    const t=tr(), elegidas=t.want.filter(k=>c[k]), cr=elegidas.reduce((s,k)=>s+c[k][1],0);
    const carga=cargaInfo(elegidas.filter(k=>!t.fail.includes(k)).reduce((s,k)=>s+c[k][1],0));
    const v={periodo:planEtiqueta(paso),n:elegidas.length,creditos:fmtCr(cr),tope:carga?fmtCr(carga.tope):''};
    if(PLAN_DOS_PERIODOS)return `<span class="plan-${paso+1}${paso===S.planPaso?' plan-vista':''}"${paso===S.planPaso?' aria-current="true"':''}>${esc(planEtiqueta(paso))}: ${elegidas.length} ${elegidas.length===1?'materia':'materias'} · ${fmtCr(cr)} cr</span>`;
    return `<span class="plan-${paso+1} sate-texto-largo">${esc(elegidas.length?tx(carga?'bandeja':'bandeja_sin_tope',v):tx('bandeja_vacia',v))}</span>`+
      (paso===PLAN_PASO?`<span class="sate-texto-corto">${esc(elegidas.length?tx(carga?'bandeja_corta':'bandeja_corta_sin_tope',v):tx('bandeja_corta_vacia'))}</span>`:'');
  },paso)).join('');
  $('#plan-carga').innerHTML=ayudaCreditos()+esc(ci?tx('carga',{creditos:fmtCr(ci.total),tope:fmtCr(ci.tope),retenidos:fmtCr(ci.ret)}):tx('sin_carga',{creditos:fmtCr(credWant)}));
  $('#chosen-help').textContent=want.length?tx('cuenta',{n:want.length,creditos:fmtCr(credWant)}):tx('vacio');
  $('#chosen').innerHTML=planPasos().map(paso=>conPlan(()=>{
    const t=tr(), elegidas=t.want.filter(k=>c[k]), cr=elegidas.reduce((s,k)=>s+c[k][1],0);
    const nuevos=elegidas.filter(k=>!t.fail.includes(k)).reduce((s,k)=>s+c[k][1],0), carga=cargaInfo(nuevos);
    const cuenta=carga?tx('resumen',{n:elegidas.length,creditos:fmtCr(cr),tope:fmtCr(carga.tope)}):tx('cuenta',{n:elegidas.length,creditos:fmtCr(cr)});
    return `<section class="plan-grupo plan-${paso+1}" aria-labelledby="plan-grupo-${paso}"><h4 id="plan-grupo-${paso}">${esc(tx('periodo_elegido',{periodo:planEtiqueta(paso)}))}</h4><p>${esc(cuenta)}</p><p>${esc(carga?tx('carga',{creditos:fmtCr(carga.total),tope:fmtCr(carga.tope),retenidos:fmtCr(carga.ret)}):tx('sin_carga',{creditos:fmtCr(cr)}))}</p><div class="wchips">`+
      elegidas.sort((a,b)=>(semOf()[a]||99)-(semOf()[b]||99)).map(k=>`<span class="wchip"><span class="grp">${esc(k)}</span>${esc(pretty(c[k][0]))}${off.has(k)?'':' <small>'+esc(tx('sin_grupos'))+'</small>'}${t.oblig.includes(k)?'<span class="tag bad">'+esc(tx('obligatoria'))+'</span>':`<button class="x" data-unwant="${esc(k)}" data-plan-quitar="${paso}" aria-label="${esc(tx('quitar',{materia:c[k][0],periodo:planEtiqueta(paso)}))}">×</button>`}</span>`).join('')+
      (!elegidas.length?`<p>${esc(tx('vacio'))}</p>`:'')+`</div></section>`;
  },paso)).join('');
  $('#chosen-req').innerHTML=requisitosHtml(want);
  $('#h-sugg').innerHTML=esc(tx('sugeridas',{periodo:planEtiqueta(PLAN_PASO)}))+' '+simTag('sugg');
  const propuestas=suggestions();
  const yaElegidas=new Set(tr().want);   // las sugeridas que ya están en el plan del periodo activo llevan ✓
  $('#sugg').innerHTML=propuestas.list.map(k=>`<label${yaElegidas.has(k)?' class="ya"':''}><span class="grp">${esc(k)}</span><span>${esc(pretty(c[k][0]))}${yaElegidas.has(k)?' <span class="ya-marca" aria-label="ya elegida">✓</span>':''}</span><span class="cr">${esc(textoCreditos(k,c[k][1]))} ${ayudaCreditos(k)}</span></label>`).join('')+`<small>${esc(tx('meta',{creditos:fmtCr(propuestas.cr),meta:fmtCr(propuestas.target),retenidos:fmtCr(propuestas.ret)}))}</small>`;
  document.querySelectorAll('[data-personal]').forEach(e=>e.hidden=!isPersonal());
  if(isPersonal()){
    const situacion=situacionDatos();
    renderCalendario(situacion.rd,situacion.nDes);
    const st=levelStats(), R=MAP().reglas;
    // por nivel: avance (barra de ancho fijo) y, debajo, el porcentaje recomendado de niveles previos frente al tuyo
    const pct=k=>st[k]?Math.round(st[k].ok/st[k].tot*100):0;
    $('#lvls').innerHTML=`<p class="lvl-intro">Avance por nivel y porcentaje recomendado de los niveles previos para cursar cada uno.</p>`+
      Object.keys(st).sort((a,b)=>a-b).map(n=>{const s=st[n], rq=Object.entries(R[n]||{});
      const req=rq.length?`<div class="lvl-req">Para cursarlo se recomienda: ${rq.map(([k,f])=>{const ok=pct(k)>=Math.round(f*100);
          return `<span class="${ok?'ok':'warn'}">${ok?'✓':'·'} Nivel ${esc(k)} al ${Math.round(f*100)} %${ok?'':` (llevas ${pct(k)} %)`}</span>`}).join(' ')}</div>`:'';
      return `<div class="lvl"><div class="lvl-top"><b>Nivel ${n}</b><span class="minibar"><i style="width:${s.ok/s.tot*100}%;background:var(--n${n})"></i></span><span class="lvl-num">${s.ok} de ${s.tot}</span></div>${req}</div>`}).join('');
  }
  renderLegend();renderLineas();
}
function renderLineas(){
  const ls=MAP().lineas, c=cur(), done=new Set(tr().done), want=new Set(tr().want), off=offeredClaves();
  if(!ls.length){$('#lineas').innerHTML='<p class="muted">Sin líneas de especialización registradas para esta carrera.</p>';return}
  const L=MAP().layout, slots=L?L.boxes.filter(b=>/^optativa/i.test(b[5])).length:0;
  const AREA=AREA_COLORES, areas=[...new Set(ls.map(l=>l.area))];
  // una optativa puede tener varias claves (una por semestre): se agrupan por nombre
  const group=l=>{const by=new Map();l.claves.forEach(k=>{if(!c[k])return;const n=c[k][0].toUpperCase();const g=by.get(n)||{n,keys:[],niv:c[k][2],cr:c[k][1],done:false,off:false,want:false};g.keys.push(k);g.done||=done.has(k);g.off||=off.has(k);g.want||=want.has(k);g.niv=Math.min(g.niv,c[k][2]);by.set(n,g)});return [...by.values()]};
  const gs=ls.map(group), score=gs.map(g=>g.filter(x=>x.done||x.want).length), best=Math.max(...score);
  const head=`<div class="ol-head"><p>${slots?`El plan de estudios contempla <b>${slots} optativas</b>, señaladas en el mapa con espacios punteados.`:'Las optativas son de libre elección.'} Las líneas de especialización son orientativas y pueden combinarse según la oferta.</p>
    <div class="legend"><span><i class="l-want"></i>Elegida</span><span><i class="ol-l-on"></i>Con grupos este periodo</span><span><i class="ol-l-off"></i>Sin grupos este periodo</span></div></div>`;
  $('#lineas').innerHTML=head+'<div class="ol-grid">'+ls.map((l,i)=>{
    const g=gs[i], color=AREA[areas.indexOf(l.area)%AREA.length], nOff=g.filter(x=>x.off&&!x.done).length, nWant=g.filter(x=>x.want).length;
    const byNiv={};g.forEach(x=>(byNiv[x.niv]=byNiv[x.niv]||[]).push(x));
    const rows=Object.keys(byNiv).sort((a,b)=>a-b).map(n=>`<div class="ol-row"><span class="ol-niv">Nivel ${n}</span><div class="ol-boxes">${byNiv[n].map(x=>{
      const k=x.keys.find(k=>off.has(k))||x.keys[0];
      return `<button class="obox${x.want?' want':''}${x.done?' done':''}${x.off?'':' offno'}" data-obox="${esc(k)}" aria-pressed="${x.want}" title="${esc(x.n)} · ${esc(textoCreditos(k,x.cr,true))}${x.off?'':' · sin grupos este periodo'}">${esc(x.n.replace(/\s*\(([^()]*)\)$/,(m,g)=>norm(g)===norm(l.linea)?'':m).toLowerCase())}</button>`}).join('')}</div></div>`).join('');
    return `<article class="ol-card" style="--area:${color}">
      <header><span class="ol-area">${esc(l.area)}</span><h4>${esc(l.linea!==l.area?l.linea:l.area)}</h4>
        <span class="ol-stat">${nOff} de ${g.length} con grupos${nWant?` · <b>${nWant} elegida${nWant>1?'s':''}</b>`:''}${best>0&&score[i]===best?' · <span class="tag good">línea con mayor avance</span>':''}</span></header>
      ${rows}</article>`}).join('')+'</div>';
}
/* =========================================================
   HORARIO
   ========================================================= */
/* ---------- render general ---------- */
const hasOffer=p=>(DATA.periodos[p]||[]).length>0;
function renderTop(){
  renderSimGlobal();
  if(!hasOffer(S.per)&&hasOffer('actual'))S.per='actual';
  document.querySelectorAll('[data-per]').forEach(b=>{const ok=hasOffer(b.dataset.per);b.disabled=!ok;b.title=ok?'':'El SAES aún no publica la oferta de este periodo'});
  document.querySelectorAll('[data-per]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.per===S.per));
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===S.tab));

  
  const cars=Object.entries(DATA.carreras).filter(([k])=>DATA.mapas[k]);
  if(!cars.some(([k])=>k===S.car)) S.car=cars[0][0];
  $('#f-carrera').innerHTML=cars.map(([k,v])=>`<option value="${esc(k)}"${k===S.car?' selected':''}>${esc(v)}</option>`).join('');
  const f=new Date(DATA.capturado).toLocaleString('es-MX',{dateStyle:'long',timeStyle:'short'});
  const n=new Set(classes().filter(c=>c[0]===S.car).map(c=>c[3])).size;
  $('#notice').innerHTML=`<span>Captura del SAES: <b>${esc(f)}</b></span><span><b>${n}</b> grupos de esta carrera</span>`+
    (!hasOffer('proximo')?'<span>El SAES aún no publica la oferta del próximo periodo; se muestra el periodo actual.</span>':S.per==='proximo'?'<span>La oferta del próximo periodo está en captura y puede estar incompleta.</span>':'')+
    (n===0?'<span class="bad">Esta carrera no tiene grupos publicados en este periodo.</span>':'')+(DATA.salones?.fuente==='saes'?'<span>Salones según el SAES.</span>':(DATA.salones?.periodos?.[S.per]||(S.per==='actual'&&DATA.salones))?`<span>Salones según el horario por aula de la unidad (ciclo ${esc((DATA.salones.periodos?.[S.per]||DATA.salones).periodo)}).</span>`:'<span>Salones aún sin asignar para este periodo.</span>');
}
/* Vista en lista (teléfono): materias por semestre propuesto con su estado y un botón para agregarlas */
/* ---------- estadísticas del kárdex (solo con datos del SAES; se calculan en el navegador) ----------
   Gráficas con Observable Plot (D3), que se carga solo al abrir esta sección. */
const notaValida=v=>v==null||String(v).trim()===''||!Number.isFinite(+v)||+v<6||+v>10?null:+v;
const FORMAS={ORD:'Ordinario',REC:'Recurse',ETS:'ETS',EXT:'Extraordinario',EQV:'Equivalencia',REV:'Revalidación',DIC:'Dictamen'};
function catDe(){                                // clave -> categoría (columna del mapa)
  const L=MAP().layout,out={};if(!L?.cols?.length)return out;
  if(L.cat)return {...L.cat};   // mapas por áreas: la columna puede agrupar áreas pequeñas; se usa el área de cada materia
  L.boxes.forEach(([x,y,w,h,k])=>{if(!k)return;const cx=x+w/2,c=L.cols.find(([n,a,b])=>cx>=a&&cx<b);if(c)out[k]=c[0]});
  return out;
}
/* kárdex con la simulación: materias en curso aprobadas y reprobadas acreditadas, con su calificación simulada,
   en el periodo que se cursa (el anterior al que se planea). Quinto campo = simulada. */
function simKardex(){
  const A=ALUMNO, base=[...new Map((A.acreditadas||[]).filter(a=>a&&notaValida(a[1])!=null).map(a=>[a[0],a])).values()];
  if(!isPersonal()||!tr().sim)return base;
  const pm=perMeta(), p=pm!=null?perName(pm-1):null, rep=new Set((A.reprobadas_periodo||[]).map(r=>r[0])), done=new Set(base.map(a=>a[0]));
  const add=[...tr().simOk.map(k=>[k,SIM.res[k]?.cal??8,p,rep.has(k)?'REC':'ORD',1]),...tr().simRec.map(k=>[k,SIM.rec[k]?.cal??7,p,SIM.rec[k]?.forma,1])];
  return [...base,...add.filter(a=>{if(done.has(a[0])||notaValida(a[1])==null)return false;done.add(a[0]);return true})];
}
// Sin el denominador oficial no es posible reconstruir el promedio del SAES desde sus acreditaciones.
function promEstimado(){return ALUMNO?.promedio??null}
/* Promedio oficial (el del SAES): promedio de todo lo que aparece en el kárdex, aprobadas y reprobadas.
   Exacto: si el marcador SATE trajo los renglones reprobados del kárdex (kardex_reprobadas) y su promedio junto con las aprobadas
   coincide con el promedio oficial, se suman las materias simuladas (aprobadas con su calificación, reprobadas con
   REPROB_CAL). Estimado: con datos de una versión anterior del marcador SATE se deduce cuántas reprobadas pesan suponiendo REPROB_CAL.
   Devuelve null si no se puede calcular. */
const REPROB_CAL=5;
function promOficialSim(){
  const A=ALUMNO, P=+A?.promedio;if(!tr().sim||A?.promedio==null||!Number.isFinite(P))return null;
  const base=simKardex().filter(a=>!a[4]&&notaValida(a[1])!=null);
  const nuevas=simKardex().filter(a=>a[4]).map(a=>notaValida(a[1])).filter(v=>v!=null);
  const reprobCal=tr().enCurso.filter(k=>SIM.res[k]?.ok===false).map(k=>{const v=+SIM.res[k].calR;return Number.isFinite(v)&&v>=0&&v<6?v:REPROB_CAL});
  const k=nuevas.length+reprobCal.length;if(!k)return null;
  const extra=nuevas.reduce((t,x)=>t+x,0)+reprobCal.reduce((t,x)=>t+x,0);
  const rep=(A.kardex_reprobadas||[]).map(r=>+r?.[1]).filter(v=>Number.isFinite(v)&&v>=0&&v<6);
  if(Array.isArray(A.kardex_reprobadas)){
    const todas=[...base.map(a=>notaValida(a[1])),...rep], n=todas.length, S=todas.reduce((t,x)=>t+x,0);
    if(n&&Math.abs(S/n-P)<=0.011)return {antes:P,despues:(S+extra)/(n+k),exacto:true};
  }
  if(!base.length)return null;
  const n=base.length, S=base.reduce((t,a)=>t+notaValida(a[1]),0);
  if(P>S/n+1e-6||P<=REPROB_CAL)return null;   // un promedio oficial mayor al de aprobadas no admite esta estimación
  const nf=(S-P*n)/(P-REPROB_CAL), W=n+nf;
  return {antes:P,despues:(P*W+extra)/(W+k),exacto:false,reprobadasEstimadas:nf};
}
const creditoValido=v=>v==null||String(v).trim()===''||!Number.isFinite(+v)||+v<0?null:+v;
// Con cargaCalculada la duración capturada no concuerda con las cargas: usar una referencia explícita, no un plazo reglamentario.
function plazoReferencia(A){
  const c=A.carga||{}, calculado=CAPACIDADES.cargaCalculada===true&&c.total>0&&c.min>0;
  return {dur:calculado?null:c.duracion,max:calculado?Math.ceil(c.total/c.min):c.duracion_max,calculado};
}
function proyeccionCreditos(D){
  const ultimo=D.curva.at(-1), inicio=D.meta??(ultimo?.per+1);
  if(!Number.isFinite(inicio)||D.fin==null||!(D.total>0)||D.obt==null||!(D.ritmo>0)||D.fin<inicio||D.obt>=D.total)return [];
  const puntos=[{per:inicio-1,acum:D.obt}];
  for(let per=inicio;per<=D.fin;per++){
    puntos.push({per,acum:Math.min(D.total,D.obt+D.ritmo*(per-inicio+1))});
    if(puntos.at(-1).acum>=D.total)break;
  }
  return puntos;
}
const ST_DIAG=new Set();
function statsDatos(){
  const c=cur(), A=ALUMNO, cat=catDe();
  const rows=simKardex().map(a=>{const f=String(a[3]||'').trim().toUpperCase();
    return {clave:a[0],nombre:pretty(c[a[0]]?.[0]||a[0]),cal:notaValida(a[1]),per:perIdx(a[2]),codigo:f,
      forma:FORMAS[f]||'No identificada',eqv:['EQV','REV','DIC'].includes(f),sim:!!a[4],cat:cat[a[0]]||'Sin categoría',cr:creditoValido(c[a[0]]?.[1])}});
  const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
  const sumCr=rs=>rs.every(r=>r.cr!=null)?rs.reduce((s,r)=>s+r.cr,0):null;
  const reales=rows.filter(r=>!r.sim), reg=rows.filter(r=>!r.eqv&&r.per!=null);
  const pers=[...new Set(reg.map(r=>r.per))].sort((a,b)=>a-b);
  const porPer=pers.map(p=>{const rs=reg.filter(r=>r.per===p),v=rs.map(r=>r.cal);return {per:p,lbl:perName(p),prom:mean(v),min:Math.min(...v),max:Math.max(...v),n:v.length,cr:sumCr(rs),sim:rs.some(r=>r.sim)}});
  // Solo una confirmación explícita puede distinguir cero acreditaciones de un periodo sin información.
  (A.periodos_confirmados||[]).filter(p=>p.completo===true&&creditoValido(p.creditos)===0&&perIdx(p.periodo)!=null).forEach(p=>{
    const per=perIdx(p.periodo);if(!porPer.some(d=>d.per===per))porPer.push({per,lbl:perName(per),prom:null,min:null,max:null,n:0,cr:0,sim:false});
  });porPer.sort((a,b)=>a.per-b.per);
  const eqv=rows.filter(r=>r.eqv), crEqv=sumCr(eqv), crHist=sumCr(reales);
  const total=creditoValido(A.carga?.total), oficial=creditoValido(A.avance?.obtenidos), faltan=creditoValido(A.avance?.faltan);
  const baseObt=oficial??(reales.length?crHist:null), simCr=sumCr(rows.filter(r=>r.sim));
  // materias inscritas de otro plan: se explican como equivalencias en Estado general y no suman créditos aquí
  const cursoDesconocido=[...new Set(A.en_curso??(A.horario_inscrito||[]).map(h=>h[1]))].filter(k=>!c[k]).length;
  const saldoInconsistente=total!=null&&oficial!=null&&faltan!=null&&Math.abs(total-oficial-faltan)>.01;
  const excesoSim=simCr!=null&&faltan!=null&&simCr>faltan+.01;
  const obt=baseObt!=null&&simCr!=null&&!excesoSim?baseObt+simCr:null;
  const baseFalta=faltan??(total!=null&&baseObt!=null?Math.max(0,total-baseObt):null);
  const falta=baseFalta!=null&&simCr!=null&&!saldoInconsistente&&!excesoSim?Math.max(0,baseFalta-simCr):null;
  const diferencia=oficial!=null&&crHist!=null?oficial-crHist:null;
  const sinPeriodo=reales.filter(r=>!r.eqv&&r.per==null).length, desconocidas=rows.filter(r=>r.cr==null).length;
  const curvaCompleta=crEqv!=null&&sinPeriodo===0&&!desconocidas&&(diferencia==null||Math.abs(diferencia)<.01)&&!saldoInconsistente&&!excesoSim;
  let acum=crEqv;const curva=curvaCompleta?porPer.map(d=>({...d,acum:(acum+=d.cr)})):[];
  const cal=rows.map(r=>r.cal).sort((a,b)=>a-b), media=mean(cal), mediana=cal.length?(cal[(cal.length-1)>>1]+cal[cal.length>>1])/2:null;
  const sd=cal.length>1?Math.sqrt(cal.reduce((s,x)=>s+(x-media)**2,0)/(cal.length-1)):null;
  const pm=perMeta(), actual=pm!=null?pm-1:null;
  const historicos=porPer.filter(d=>!d.sim&&(actual==null||d.per<actual));
  const ultimos=historicos.slice(-3), ritmo=ultimos.length&&ultimos.every(d=>d.cr!=null)?mean(ultimos.map(d=>d.cr)):null;
  const huecos=historicos.length?historicos.at(-1).per-historicos[0].per+1-historicos.length:0;
  const ultimo=porPer.at(-1)?.per, meta=tr().sim?pm:actual!=null?Math.max(actual,(ultimo??actual-1)+1):ultimo!=null?ultimo+1:null;
  const nper=falta===0?0:ritmo>0&&falta!=null?Math.ceil(falta/ritmo):null, fin=nper>0&&meta!=null?meta+nper-1:null;
  const formas=rows.filter(r=>!r.eqv&&['ORD','EXT','ETS','REC'].includes(r.codigo));
  const avisos=[];
  if(desconocidas)avisos.push(`${desconocidas} materias aprobadas no tienen créditos registrados en este plan (pueden ser de otro plan o de una equivalencia); por eso no se dibuja tu avance por periodo.`);
  if(diferencia!=null&&Math.abs(diferencia)>.01)avisos.push(`Los créditos de tu kárdex difieren en ${fmtCr(Math.abs(diferencia))} de los que reporta el SAES; esa diferencia no se asigna a ningún periodo.`);
  if(sinPeriodo)avisos.push(`${sinPeriodo} materias aprobadas no indican en qué periodo se acreditaron, así que tu avance por periodo está incompleto.`);
  if(saldoInconsistente)avisos.push('Los créditos obtenidos y faltantes que reporta el SAES no suman el total del plan. Actualiza tus datos del SAES antes de calcular fechas.');
  if(excesoSim)avisos.push('La simulación suma más créditos de los que te faltan; revisa que tus materias correspondan a este plan.');
  if(huecos)avisos.push(`${huecos} periodos no tienen información en tu kárdex; no se toman como periodos sin materias aprobadas.`);
  if(A.reprobadas_periodo==null)avisos.push('No se pudo leer tu «Estado general» del SAES, así que no se puede confirmar si tienes materias reprobadas pendientes.');
  if(A.en_curso==null)avisos.push('No se pudo leer tu horario inscrito del SAES.');
  const duplicadas=(A.acreditadas||[]).filter(a=>a&&notaValida(a[1])!=null).length-reales.length;
  if(duplicadas)avisos.push(`${duplicadas} materias aparecen repetidas en tu kárdex; se cuentan una sola vez.`);
  if(avisos.length){const diag={unidad:UNIDAD,carrera:S.car,desconocidas,cursoDesconocido,sinPeriodo,huecos,duplicadas,saldoInconsistente,excesoSim};
    const key=JSON.stringify(diag);if(!ST_DIAG.has(key)){ST_DIAG.add(key);console.warn('Analítica: cobertura incompleta',diag)}}
  return {rows,reg,porPer,curva,crEqv,media,mediana,sd,ritmo,total,obt,falta,nper,meta,fin,mean,oficial,simCr,avisos,actual,simulado:tr().sim,
    ritmoN:ultimos.length,ritmoParcial:!historicos.length||huecos>0||!A.periodos_confirmados?.length,
    // aclaración visible del ritmo: solo cuando hay periodos sin materias aprobadas en el kárdex (no se cuentan como cero)
    ritmoNota:huecos>0?`no incluye ${huecos} ${huecos>1?'periodos':'periodo'} en ${huecos>1?'los':'el'} que tu kárdex no registra materias aprobadas`:'',
    ord:formas.length?formas.filter(r=>r.codigo==='ORD').length/formas.length:null,formasN:formas.length,
    formasExcluidas:rows.length-formas.length,
    delta:porPer.length>1&&porPer.at(-1).prom!=null&&porPer.at(-2).prom!=null?porPer.at(-1).prom-porPer.at(-2).prom:null};
}
function metaCreditos(D,H,incluyeActual){
  const periodos=+H, valida=String(H??'').trim()!==''&&Number.isSafeInteger(periodos)&&periodos>0;
  const autorizada=creditoValido(SAES.autorizada(ALUMNO)), min=creditoValido(ALUMNO.carga?.min);
  const inicio=D.meta==null?null:D.meta+(!incluyeActual&&!D.simulado&&D.meta===D.actual?1:0);
  if(!valida)return {valida:false};
  if(D.falta==null)return {valida:true,pendientes:null};
  const necesarios=D.falta/periodos;
  return {valida:true,pendientes:D.falta,necesarios,periodos,inicio,
    fin:D.falta===0||inicio==null?null:inicio+periodos-1,autorizada,min,
    diferencia:D.ritmo>0?necesarios/D.ritmo-1:null,
    supera:autorizada!=null&&necesarios>autorizada+.01,
    bajoMin:min!=null&&D.falta>0&&necesarios<min-.01};
}
const info=t=>`<span class="info" tabindex="0" role="img" aria-label="${esc(t)}" data-tip="${esc(t)}">ⓘ</span>`;
/* Promedio meta: con qué promedio deberías salir de tus materias en curso (y del resto de la carrera) para llegar al
   promedio que quieres. Se calcula sobre el promedio sin reprobadas (exacto con tu kárdex); el oficial también cuenta
   reprobadas que el SAES no detalla, así que para subirlo puede hacer falta más. */
function promMeta(D,T){
  const reales=D.rows.filter(r=>!r.sim), n=reales.length, suma=reales.reduce((t,r)=>t+r.cal,0);
  const k=tr().enCurso.length, c=cur(), hechas=new Set([...tr().done,...tr().enCurso]);
  const R=Object.keys(c).filter(x=>!hechas.has(x)&&!isElec(x)&&c[x][3]==='O'&&c[x][1]>0).length+k;   // obligatorias que te faltan (sin las opciones de optativas), más las en curso
  const nec=m=>m>0?(T*(n+m)-suma)/m:null;
  return {n,actual:n?suma/n:null,k,R,periodo:nec(k),carrera:nec(R),max:k?(suma+10*k)/(n+k):null};
}
// calificaciones enteras (6–10) que, repartidas en `ks`, promedian al menos x
function pmReparto(ks,x){let falta=Math.max(6*ks.length,Math.min(10*ks.length,Math.ceil(x*ks.length-1e-9)));const out={};
  ks.forEach((k,i)=>{const cal=Math.max(6,Math.min(10,Math.ceil(falta/(ks.length-i))));out[k]=cal;falta-=cal});return out}
// combinación que el alumno arma para sus materias inscritas (se guarda por carrera)
function pmCombinacion(M){const ec=tr().enCurso, g=store.get('pmCal.'+S.car,{}), base=pmReparto(ec,M.periodo!=null&&M.periodo<=10?Math.max(6,M.periodo):10);
  return Object.fromEntries(ec.map(k=>[k,g[k]>=6&&g[k]<=10?g[k]:base[k]]))}
function renderStats(){
  if(SATE.actual?.pestana==='trayectoria')return SATE.modulos.trayectoria?.mostrar();
}

/* ---------- análisis descriptivo: hechos y antecedentes, sin pronosticar notas ---------- */
function analisis(){
  const c=cur(), pre=prereqs(), t=tr(), cat=catDe(), done=new Set(t.done), nm=k=>pretty(c[k]?.[0]||k);
  const K=simKardex().filter(a=>notaValida(a[1])!=null), cal=new Map(K.map(a=>[a[0],notaValida(a[1])]));
  const pend=Object.keys(c).filter(k=>!done.has(k)&&!isElec(k)&&(c[k][3]==='O'||c[k][3]==='P'));
  const depend=dependents(), want=new Set(t.want), fail=new Set(t.fail);
  const cuidar=pend.filter(k=>fail.has(k)||want.has(k)).map(k=>{
    const motivos=[];
    if(fail.has(k))motivos.push('Está reprobada: debes acreditarla');
    const req=(pre[k]||[]).filter(x=>!done.has(x));
    if(req.length)motivos.push('Antes conviene aprobar: '+req.map(nm).join(', '));
    const desbloquea=(depend[k]||[]).filter(x=>!done.has(x)&&c[x]);
    if(desbloquea.length)motivos.push('Es requisito de: '+desbloquea.map(nm).join(', '));
    return {k,motivos};
  }).filter(r=>r.motivos.length);
  // El promedio de una línea procede únicamente de sus materias propias acreditadas.
  const lineas=(MAP().lineas||[]).map(l=>{
    const claves=[...new Set(l.claves||[])].filter(k=>cal.has(k));
    return {nombre:l.linea!==l.area?l.linea:l.area,claves,n:claves.length,
      prom:claves.length?claves.reduce((s,k)=>s+cal.get(k),0)/claves.length:null,
      total:new Set(l.claves||[]).size,sim:K.some(a=>claves.includes(a[0])&&a[4])};
  }).filter(l=>l.n>0);
  const memo={}, visitando=new Set();let ciclo=false;
  const largo=k=>{
    if(visitando.has(k)){ciclo=true;return []}
    if(memo[k])return memo[k];visitando.add(k);
    let cola=[];
    for(const x of (depend[k]||[]).filter(x=>!done.has(x)&&c[x]?.[3]==='O')){
      const v=largo(x);if(v.length>cola.length)cola=v;
    }
    visitando.delete(k);return memo[k]=[k,...cola];
  };
  let cadena=[];
  pend.filter(k=>c[k][3]==='O').forEach(k=>{const v=largo(k);if(v.length>cadena.length)cadena=v});
  if(ciclo)cadena=[];
  const pp={};K.forEach(a=>{
    const f=String(a[3]||'').trim().toUpperCase(),i=perIdx(a[2]);
    if(['EQV','REV','DIC'].includes(f)||i==null)return;
    const o=pp[i]||(pp[i]={cr:0,v:[],completo:true});
    const cr=c[a[0]]?.[1];if(cr==null||!Number.isFinite(+cr))o.completo=false;else o.cr+=+cr;
    o.v.push(notaValida(a[1]));
  });
  const carga=Object.entries(pp).filter(([,o])=>o.completo).map(([i,o])=>({per:+i,lbl:perName(+i),cr:o.cr,prom:o.v.reduce((s,v)=>s+v,0)/o.v.length,n:o.v.length})).sort((a,b)=>a.per-b.per);
  return {cuidar,lineas,cadena,ciclo,carga,nm};
}
function renderTray(){
  renderSimGlobal();
  if(SATE.actual?.pestana==='trayectoria'){renderStats();return}
  if(SATE.modulos.mapa){renderMap();conSim(usaSim('mapa'),()=>conPlan(renderList))}renderSide();
}
function renderHor(){cancelarGeneracion();if(isPersonal())renderEqvHorario(ALUMNO);else $('#est-eqv').hidden=true;renderHFilters();renderOffer();renderPlans();renderCal();renderOwnForm();renderGen();renderEquiv();montarAyudasCreditos()}
/* Equivalencias con otras carreras de la misma unidad (tabla «Equivalencia de Materias» del SAES): solo consulta.
   Cada unidad decide cómo aplicarlas; no cambian el avance, la seriación ni el generador de horarios. */
function renderEquiv(){
  const E=DATA.equiv, box=$('#equiv');box.hidden=!E;if(!E||!box.open)return;
  const c=cur(), nombre=(car,k)=>pretty(DATA.mapas?.[car]?.cur?.[k]?.[0]||(classes().find(x=>x[0]===car&&x[8]===k)?DATA.asig[classes().find(x=>x[0]===car&&x[8]===k)[4]]:k));
  const base=[...new Set([...tr().want,...tr().fail,...plan().sel.map(x=>byKey(x)?.[8]).filter(Boolean)])].filter(k=>c[k]);
  const fecha=new Date(E.consultado+'T12:00').toLocaleDateString('es-MX',{day:'numeric',month:'long',year:'numeric'});
  let html=`<p class="eq-intro">Según la tabla de Equivalencias del SAES (consultada el ${fecha}), algunas materias de tu plan tienen equivalencia con materias de otras carreras de tu unidad académica. Cada unidad decide cómo aplicarlas: normalmente se inscriben <b>al final del proceso de reinscripción</b>, con los lugares que quedan libres después de que se inscriben los alumnos de esa carrera. <b>Confírmalo con Gestión Escolar antes de inscribirlas.</b></p>`;
  if(!base.length){$('#equiv-body').innerHTML=html+'<p class="muted">Elige materias en «Mi trayectoria» o agrega grupos a tu horario para ver sus equivalencias.</p>';return}
  const flecha={ida:'→',vuelta:'←',ambas:'↔'};
  const filas=base.map(k=>{
    const m=new Map();
    E.rel.forEach(([o,ko,eo,d,kd,ed])=>{
      let otro=null,dir=null,esp=null;
      if(o===S.car&&ko===k){otro=[d,kd];dir='ida';esp=ed}else if(d===S.car&&kd===k){otro=[o,ko];dir='vuelta';esp=eo}
      if(!otro)return;const id=otro.join('|'), prev=m.get(id);
      m.set(id,{car:otro[0],k:otro[1],esp,dir:prev&&prev.dir!==dir?'ambas':dir});
    });
    if(!m.size)return '';
    const items=[...m.values()].sort((a,b)=>a.car.localeCompare(b.car)).map(x=>{
      const gs=classes().filter(g=>g[0]===x.car&&g[8]===x.k);
      const mult=E.multiples.find(([o,ko,d])=>o===S.car&&ko===k&&d===x.car);
      return `<li><span class="eq-dir" title="Dirección como aparece en la tabla del SAES">${flecha[x.dir]}</span><div><b>${esc(nombre(x.car,x.k))}</b> <span class="mono">${esc(x.k)}</span>`+
        `<small>${esc(DATA.carreras[x.car]||x.car)}${x.esp&&x.esp!=='0'?` · especialidad ${esc(x.esp)}`:''}</small>`+
        (mult?`<small class="warn">El SAES muestra varias materias equivalentes en esta carrera (${mult[3].map(esc).join(', ')}); puede requerir acreditarlas juntas.</small>`:'')+
        `<small>${gs.length?gs.map(g=>`<span class="eq-g">${esc(g[3])}: ${g[6].map(([d,a,b])=>`${DAYS[d]} ${hm(a)}–${hm(b)}`).join(', ')}</span>`).join(''):'Sin grupos en el periodo consultado'}</small></div></li>`}).join('');
    return `<section class="eq-m"><h4>${esc(pretty(c[k][0]))} <span class="mono">${esc(k)}</span></h4><ul class="eq-list">${items}</ul></section>`;
  }).join('');
  html+=filas||'<p class="muted">Las materias que elegiste no tienen equivalencias registradas con otras carreras en esta tabla.</p>';
  html+=`<p class="muted eq-leyenda">↔ en ambos sentidos · → de tu materia a la otra · ← de la otra materia a la tuya, como aparece en la tabla del SAES.</p>`;
  $('#equiv-body').innerHTML=html;
}
function render(){return SATE.repintar()}
// perfil del SAES de otra carrera: se avisa y se ofrece volver; nada del perfil se aplica aquí
function renderAviso(){SAES.mismatch(S.car,k=>DATA.carreras[k],c=>{if(!DATA.carreras[c])return;S.car=c;store.set('car',c);S.chips=[];S.gen=null;ZOOM=null;render()},carreraPerfil)}
function refresh(){save();renderOffer();renderPlans();renderCal();if((S.gen||typeof generacion!=='undefined'&&generacion)&&typeof iniciarGeneracion==='function')iniciarGeneracion()}
function addClass(c){const pl=plan();pl.sel=pl.sel.filter(x=>byKey(x)?.[4]!==c[4]);pl.sel.push(keyOf(c))}
function toggle(k){const pl=plan(),i=pl.sel.indexOf(k);if(i>=0)pl.sel.splice(i,1);else{const c=byKey(k);addClass(c);
    avisoOptativa(c[8],pl.sel.map(x=>byKey(x)?.[8]).filter(Boolean));
    // desde "llenar hueco": la materia pasa a las elegidas (para poder cambiar de grupo) y se suelta el hueco
    if(S.gap||S.fit){if(cur()[c[8]]&&!tr().want.includes(c[8])){tr().want.push(c[8]);saveT()}S.gap=null;renderActive()}}
  refresh()}
let PLAN_UNDO=null, PLAN_UNDO_TIMER=null;
function planOlvidar(){PLAN_UNDO=null;clearTimeout(PLAN_UNDO_TIMER);$('#plan-deshacer').hidden=true}
function planRecordar(k,agregada){
  const base=conPlan(()=>tr(),0);
  PLAN_UNDO={car:S.car,clave:planClave(0),sim:usaSim('sugg'),want:[...base.want],wantPorPeriodo:structuredClone(base.wantPorPeriodo)};
  clearTimeout(PLAN_UNDO_TIMER);
  PLAN_UNDO_TIMER=setTimeout(()=>{PLAN_UNDO=null;$('#plan-deshacer').hidden=true},6000);
  $('#plan-anuncio').textContent=SATE.texto('sate.planeacion.'+(agregada?'agregada':'quitada'),{materia:pretty(cur()[k][0]),periodo:planEtiqueta(PLAN_PASO)});
  console.debug('SATE: selección en mapa',{unidad:UNIDAD,carrera:S.car,periodo:planEtiqueta(PLAN_PASO),clave:k,accion:agregada?'agregar':'quitar',dosPeriodos:PLAN_DOS_PERIODOS});
}
$('#plan-deshacer').addEventListener('click',()=>{
  const previo=PLAN_UNDO;if(!previo)return;
  planOlvidar();
  if(previo.car===S.car&&previo.clave===planClave(0))conSim(previo.sim,()=>conPlan(()=>{
    const base=tr();base.want=previo.want;base.wantPorPeriodo=previo.wantPorPeriodo;saveT();
    $('#plan-anuncio').textContent=SATE.texto('sate.planeacion.deshecho');
  },0));
  renderTray();
});
function toggleBox(k){return conSim(usaSim('sugg'),()=>conPlan(()=>toggleBox0(k)))}
function toggleBox0(k,mover=false){
  if(isElec(k)){S.mapHover=k;S.mapFocus=true;resaltarMapa();if(mview()==='lista'){S.lfocus=k;renderList()}return}   // se explica en el inspector
  const paso=PLAN_PASO, base=conPlan(()=>tr(),0), otro=planAsignado(k);
  if(PLAN_DOS_PERIODOS&&otro!=null&&otro!==paso&&!mover){S.mapHover=k;S.mapFocus=true;S.lfocus=k;resaltarMapa();conPlan(renderList);return}
  if(mover&&(!PLAN_DOS_PERIODOS||otro==null||otro===paso))return;
  if(PLAN_DOS_PERIODOS){S.mapHover=k;S.mapFocus=true}
  // Una obligatoria no puede quitarse ni posponerse a un periodo posterior; sí adelantarse (N+1 → N), que evita el desfase.
  if(otro!=null&&conPlan(()=>tr().oblig.includes(k),otro)&&!(otro===1&&paso===0)){$('#insp').innerHTML=`<span>${esc(cur()[k][0])}: ${esc(SATE.texto('sate.planeacion.obligatoria'))}</span>`;return}
  // Consultar el estado real de N permite mover una materia que N+1 proyecta acreditada.
  if(otro==null&&(base.done.includes(k)||base.curso.includes(k)))return;
  planRecordar(k,otro!==paso);
  if(mover){$('#plan-anuncio').textContent=`${pretty(cur()[k][0])} movida de ${planEtiqueta(otro)} a ${planEtiqueta(paso)}.`;console.debug('SATE: mover materia',{unidad:UNIDAD,carrera:S.car,clave:k,origen:planEtiqueta(otro),destino:planEtiqueta(paso),antes:{primero:[...base.want],segundo:conPlan(()=>[...tr().want],1)}})}
  if(!PLAN_DOS_PERIODOS){
    base.want=base.want.filter(x=>x!==k);if(otro!==paso)base.want.push(k);
    if(otro!==paso)avisoOptativa(k,base.want);
    conPlan(saveT,0);renderTray();return;
  }
  const siguientes=conPlan(()=>[...tr().want],1).filter(x=>x!==k);
  base.want=base.want.filter(x=>x!==k);
  if(otro!==paso){if(paso) siguientes.push(k);else base.want.push(k)}
  base.wantPorPeriodo={...base.wantPorPeriodo,[planClave(1)]:siguientes};PLAN_CACHE=null;
  if(otro!==paso)avisoOptativa(k,paso?siguientes:base.want);
  conPlan(saveT,0);renderTray()}


/* ---------- eventos ---------- */

document.addEventListener('click',e=>{
  const li=e.target.closest('#ac li');if(li){pick(+li.dataset.i);return}
  // táctil: un toque fuera del mapa y del inspector retira el enfoque
  if((S.mapFocus||S.reqHover)&&!e.target.closest('#map,#insp,#lineas,#chosen-req')){S.mapFocus=false;S.mapHover=null;S.reqHover=null;resaltarMapa()}
  const requisito=e.target.closest('[data-req]');
  if(requisito){S.mapHover=requisito.dataset.req;S.reqHover=requisito.dataset.piden.split(' ');S.mapFocus=true;resaltarMapa();return}
  const bx=e.target.closest('[data-box]');if(bx){S.reqHover=null;toggleBox(bx.dataset.box);return}
  const ob=e.target.closest('[data-obox]');if(ob){S.reqHover=null;toggleBox(ob.dataset.obox);return}
  // táctil: tocar un grupo de la oferta muestra (o retira) su vista previa en el horario
  const op=e.target.closest('#offer .opt');if(op&&tactil()&&!e.target.closest('button,input,a,label,select,textarea,summary')){S.hover=S.hover===op.dataset.k?null:op.dataset.k;renderCal();return}
  const t=e.target.closest('button');if(!t)return;
  const d=t.dataset;
  if(d.expand!==undefined){const k=+d.expand;S.expand.has(k)?S.expand.delete(k):S.expand.add(k);renderOffer();return}
  if(d.lfocus){S.lfocus=S.lfocus===d.lfocus?null:d.lfocus;conSim(usaSim('mapa'),()=>conPlan(renderList));return}
  if(d.lwant){toggleBox(d.lwant);return}
  if(d.fwant){toggleBox(d.fwant);return}
  if(d.fmover){const otro=planAsignado(d.fmover);if(otro!=null)conSim(usaSim('sugg'),()=>conPlan(()=>toggleBox0(d.fmover,true),1-otro));return}
  if(d.fclose){S.mapFocus=false;S.mapHover=null;S.reqHover=null;resaltarMapa();return}
  if(d.mview){S.mview=d.mview;store.set('mview',S.mview);renderTray();return}
  if(d.cview){S.cview=d.cview;store.set('cview',S.cview);renderCal();return}
  if(t.id==='b-filt'){const f=t.closest('.filters');f.classList.toggle('open');t.setAttribute('aria-expanded',String(f.classList.contains('open')));return}
  if(t.id==='b-mobnote'){store.set('mobnote',1);$('#mobnote').hidden=true;return}
  if(d.tab){SATE.ir(d.tab==='hor'?'horarios':'mapa')}
  else if(d.per){S.per=d.per;store.set('per',S.per);S.hover=null;S.chips=[];S.gen=null;render()}
  else if(d.unwant){conSim(usaSim('sugg'),()=>conPlan(()=>toggleBox0(d.unwant),+d.planQuitar))}
  else if(d.zoom!==undefined){const L=MAP().layout, base=$('#map').offsetWidth/(L?.w||$('#map').offsetWidth);ZOOM=d.zoom==='0'?null:Math.min(2,Math.max(.4,(ZOOM??base)*(d.zoom==='1'?1.2:1/1.2)));renderMap()}
  else if(d.view){S.view=d.view;store.set('view',S.view);renderHFilters();renderOffer()}
  else if(d.tur){S.tur=d.tur;store.set('tur',S.tur);renderHFilters();renderOffer()}
  else if(d.niv){S.niv=d.niv==='*'?'*':+d.niv;store.set('niv',S.niv);renderHFilters();renderOffer()}
  else if(d.ungap){S.gap=null;renderActive();renderOffer();renderCal()}
  else if(d.unchip){if(d.unchip==='all')S.chips=[];else S.chips.splice(+d.unchip,1);renderActive();renderOffer()}
  else if(d.toggle){S.hover=null;toggle(d.toggle)}
  else if(d.mark){const m=ws().marks;const c=m[d.k]||{};if(c.s===d.mark){delete c.s;if(!c.n)delete m[d.k];else m[d.k]=c}else m[d.k]={...c,s:d.mark};save();renderOffer();const n=document.querySelector(`[data-note="${CSS.escape(d.k)}"]`);if(n&&m[d.k]?.s)n.focus()}
  else if(d.group){filtered().filter(c=>c[3]===d.group).forEach(addClass);refresh()}
  else if(d.plan){ws().plan=d.plan;S.hover=null;refresh()}
  else if(d.newplan){const id=nextPlan();ws().plans[id]={sel:[],own:[]};ws().plan=id;S.hover=null;refresh()}
  else if(d.delplan){const id=d.delplan;if(t.dataset.confirm!=='1'){t.dataset.confirm='1';t.textContent='¿Eliminar?';t.classList.add('warn');setTimeout(()=>{if(t.isConnected){t.dataset.confirm='';t.textContent='×';t.classList.remove('warn')}},3000);return}
    delete ws().plans[id];ws().plan=planIds()[0];S.hover=null;refresh()}
  else if('dup' in d){const id=nextPlan();ws().plans[id]=JSON.parse(JSON.stringify(plan()));ws().plan=id;refresh()}
  else if(d.unown){eliminarPropia(+d.unown)}
  else if(d.oday){const i=+d.oday;S.ownDays=S.ownDays.includes(i)?S.ownDays.filter(x=>x!==i):[...S.ownDays,i];renderOwnForm()}
  else if(d.gt){S.gt=d.gt;renderHFilters()}
  else if(d.ungp){S.gpref.splice(+d.ungp,1);renderGPrefs()}
  else if(d.unga){S.gavoid.splice(+d.unga,1);store.set('excl',S.gavoid);renderActive();renderOffer()}
  else if(d.useg!==undefined){const r=S.gen.top[+d.useg], to=d.to==='+'?nextPlan():d.to;ws().plans[to]=ws().plans[to]||{sel:[],own:JSON.parse(JSON.stringify(plan().own))};ws().plans[to].sel=r.cs.map(keyOf);ws().plan=to;refresh();renderGen()}
  else if(d.peekg!==undefined){const r=S.gen.top[+d.peekg];S.hover=null;const keep=plan().sel;plan().sel=r.cs.map(keyOf);renderCal();plan().sel=keep;$('#stats').insertAdjacentHTML('afterbegin','<span class="warn">Vista previa, no guardada.</span>')}
});
document.addEventListener('keydown',e=>{const bx=e.target.closest?.('[data-box]');if(bx&&(e.key==='Enter'||e.key===' ')){e.preventDefault();const k=bx.dataset.box;toggleBox(k);document.querySelector(`[data-box="${CSS.escape(k)}"]`)?.focus()}});
document.addEventListener('change',e=>{if(e.target.dataset.note){const k=e.target.dataset.note,m=ws().marks;m[k]={...(m[k]||{}),n:e.target.value.trim()};save()}});
$('#chosen-req').addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const fila=e.target.closest('[data-req]');if(fila){S.mapHover=fila.dataset.req;S.reqHover=fila.dataset.piden.split(' ');S.mapFocus=false;pedirResalte()}});
$('#chosen-req').addEventListener('focusin',e=>{const fila=e.target.closest('[data-req]');if(fila){S.mapHover=fila.dataset.req;S.reqHover=fila.dataset.piden.split(' ');S.mapFocus=false;pedirResalte()}});
const salirRequisitos=()=>{if(S.reqHover&&!S.mapFocus){S.mapHover=null;S.reqHover=null;pedirResalte()}};
$('#chosen-req').addEventListener('toggle',e=>{if(!e.target.open&&S.reqHover){S.mapFocus=false;salirRequisitos()}},true);
$('#chosen-req').addEventListener('pointerleave',salirRequisitos);
$('#chosen-req').addEventListener('focusout',e=>{if(!e.relatedTarget?.closest('[data-req]'))salirRequisitos()});
$('#map').addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const b=e.target.closest('[data-box]');const k=b?b.dataset.box:null;if(k!==S.mapHover||S.reqHover){S.reqHover=null;S.mapHover=k;pedirResalte()}});
$('#lineas').addEventListener('pointerover',e=>{if(e.pointerType!=='mouse')return;const b=e.target.closest('[data-obox]');const k=b?b.dataset.obox:null;if(k!==S.mapHover||S.reqHover){S.reqHover=null;S.mapHover=k;pedirResalte()}});
$('#lineas').addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&S.mapHover&&!S.mapFocus){S.mapHover=null;pedirResalte()}});
$('#map').addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&S.mapHover&&!S.mapFocus){S.mapHover=null;pedirResalte()}});
/* globo de ayuda inmediato (el «title» nativo tarda ~1 s): un solo elemento fijo, colocado junto al ⓘ sin salirse de la
   pantalla ni quedar recortado por recuadros con overflow; cursor, teclado y toque */
const TIP=(()=>{const d=document.createElement('div');d.className='tip-flot';d.setAttribute('role','tooltip');d.hidden=true;document.documentElement.appendChild(d);return d})();   // fuera del <body>: no hereda su «zoom» (--ui-zoom)
let tipDe=null;
let tipT=0;
function tipMuestra(el){tipDe=el;tipT=performance.now();TIP.textContent=el.dataset.tip;TIP.hidden=false;
  const r=el.getBoundingClientRect(),w=TIP.offsetWidth,h=TIP.offsetHeight,m=8;
  let x=Math.min(Math.max(m,r.left+r.width/2-w/2),innerWidth-w-m), y=r.bottom+6;
  if(y+h>innerHeight-m)y=r.top-h-6;
  TIP.style.left=x+'px';TIP.style.top=Math.max(m,y)+'px'}
function tipOculta(){tipDe=null;TIP.hidden=true}
document.addEventListener('pointerover',e=>{const el=e.target.closest?.('[data-tip]');if(el&&e.pointerType==='mouse')tipMuestra(el)});
document.addEventListener('pointerout',e=>{const el=e.target.closest?.('[data-tip]');if(el&&e.pointerType==='mouse'&&!el.contains(e.relatedTarget))tipOculta()});
document.addEventListener('focusin',e=>{const el=e.target.closest?.('[data-tip]');if(el)tipMuestra(el)});
document.addEventListener('focusout',e=>{if(e.target.closest?.('[data-tip]'))tipOculta()});
document.addEventListener('click',e=>{const el=e.target.closest?.('[data-tip]');if(el){e.preventDefault();if(MQ_PHONE.matches){tipOculta();SateUI.modal('Ayuda',el.dataset.tip,{pequeno:true});return}if(tipDe===el&&performance.now()-tipT>400)tipOculta();else tipMuestra(el)}else if(tipDe)tipOculta()},true);
addEventListener('scroll',()=>{if(tipDe)tipOculta()},{passive:true,capture:true});
$('#mapvista').addEventListener('click',e=>{const b=e.target.closest('[data-vista]');if(!b)return;store.set('mapVista',b.dataset.vista);
  if(b.dataset.vista==='sigue'&&!SHOWSUG){SHOWSUG=true;store.set('verSug',true)}renderMap()});
$('#minimap').addEventListener('click',()=>{store.set('mapVista',mapVista()==='todo'?'sigue':'todo');renderMap();$('#mapwrap').scrollIntoView({block:'nearest'})});
$('#f-carrera').addEventListener('change',e=>{S.car=e.target.value;store.set('car',S.car);S.chips=[];S.gen=null;ZOOM=null;if(DEMO){ALUMNO=perfilDemo();for(const k in T)delete T[k]}render()});
$('#b-all').addEventListener('click',()=>{planOlvidar();conSim(usaSim('sugg'),()=>conPlan(()=>{const off=offeredClaves();tr().want=[...new Set([...tr().want,...Object.keys(cur()).filter(k=>available(k)&&(PLAN_PASO||off.has(k)))])];saveT()}));renderTray()});
$('#b-sugg').addEventListener('click',()=>{planOlvidar();conSim(usaSim('sugg'),()=>conPlan(()=>{tr().want=[...new Set([...tr().want,...suggestions().list])];saveT()}));renderTray()});
$('#sug-on').addEventListener('change',e=>{SHOWSUG=e.target.checked;store.set('verSug',SHOWSUG);
  if(SHOWSUG)store.set('mapVista','sigue');else if(mapVista()==='sigue')store.set('mapVista','pend');renderMap()});
// simulación de fin de semestre: recalcula mapa, sugerencias, créditos y desfase
/* etiqueta en los bloques que cambian con la simulación de fin de semestre: alterna entre la simulación y los datos
   reales sin perder de vista el bloque (comparación rápida) */
const simTag=blk=>{if(!isPersonal())return '';const hay=SIM.on||Object.keys(SIM.res).length||Object.keys(SIM.rec).length;
  if(!hay||!conSim(false,()=>tr().enCurso.length||tr().pendRep.length))return '';
  return usaSim(blk)?`<button type="button" class="tag sim sim-tgl" data-simtgl="${blk}" title="Este bloque muestra tu simulación de fin de semestre. Pulsa para ver tus datos reales solo aquí.">Simulación ⇄</button>`
    :`<button type="button" class="tag sim-off sim-tgl" data-simtgl="${blk}" title="Este bloque muestra tus datos reales. Pulsa para ver tu simulación solo aquí.">Datos reales ⇄</button>`};
const simSave=()=>{store.set('sim',SIM);for(const k in T)delete T[k];SATE.repintar()};
const simTodos=()=>{for(const k in SIMBLK)delete SIMBLK[k];store.set('simBlk',SIMBLK)};
// interruptor desde cualquier bloque: conserva la posición del bloque en pantalla
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-simtgl]');if(!b)return;
  const blk=b.dataset.simtgl, y0=b.getBoundingClientRect().top;SIMBLK[blk]=!usaSim(blk);store.set('simBlk',SIMBLK);
  renderSimGlobal();
  if(blk==='mapa')renderMap();else if(blk==='sugg')renderSide();else renderStats();
  const fija=()=>{const n=document.querySelector(`[data-simtgl="${blk}"]`);if(n)window.scrollBy(0,n.getBoundingClientRect().top-y0)};
  requestAnimationFrame(fija);setTimeout(fija,450);setTimeout(fija,1200)});
$('#b-none').addEventListener('click',()=>{planOlvidar();conSim(usaSim('sugg'),()=>conPlan(()=>{tr().want=[...tr().oblig];saveT()}));renderTray()});
document.querySelectorAll('[data-plan-paso]').forEach(b=>b.addEventListener('click',()=>{S.planPaso=PLAN_DOS_PERIODOS?+b.dataset.planPaso:0;S.mapHover=null;S.mapFocus=false;renderTray()}));
$('#map-simbologia').addEventListener('click',()=>{
  const leyenda=document.createElement('div');leyenda.className='legend';leyenda.innerHTML=leyendaMapa(true);
  SateUI.modal(SATE.texto('sate.horarios.simbologia'),leyenda,{pequeno:true});
});
$('#map-ayuda').addEventListener('click',()=>{
  const cuerpo=document.createElement('div'), intro=document.createElement('p'), notas=document.createElement('ul');
  intro.textContent=PLAN_DOS_PERIODOS?`Elige el periodo que quieres planear. Toca una materia para agregarla o quitarla de ${planEtiqueta(S.planPaso)}. Las del otro periodo abren el inspector; usa «Mover a» para cambiarlas.`:SATE.texto('sate.planeacion.'+(tactil()?'explorar_tactil':'explorar_cursor'));
  const leyenda=document.createElement('div');leyenda.className='legend';leyenda.innerHTML=leyendaMapa(true);
  notas.innerHTML=$('#mapnote').innerHTML;cuerpo.appendChild(intro);cuerpo.appendChild(leyenda);cuerpo.appendChild(notas);
  SateUI.modal(SATE.texto('sate.planeacion.leer_mapa'),cuerpo);
});
$('#plan-supuesto').addEventListener('click',()=>SateUI.modal(SATE.texto('sate.planeacion.supuesto_titulo',{periodo:planEtiqueta(1)}),SATE.texto('sate.planeacion.supuesto'),{pequeno:true}));
$('#plan-simular').addEventListener('click',()=>{SATE.simAbrir=true;SATE.ir('trayectoria')});
$('#plan-menu').addEventListener('click',e=>{if(MQ_PHONE.matches&&e.target.closest('button'))$('#plan-menu').open=false});
$('#plan-menu').addEventListener('keydown',e=>{if(MQ_PHONE.matches&&e.key==='Escape'){$('#plan-menu').open=false;$('#plan-menu').querySelector('summary').focus()}});
$('#b-go').addEventListener('click',()=>{S.onlyWant=true;store.set('onlyWant',true);SATE.ir('horarios');window.scrollTo({top:0})});
(()=>{
  const wrap=$('#mapwrap'), map=$('#map'), areas=$('#areas'), HEAD=30, GAIN=1.8, ZMAX=2.5;
  const fit=()=>{const L=MAP().layout;return L?(wrap.clientWidth-2)/L.w:.6};   // escala de «mapa completo»
  const clampZ=z=>Math.min(ZMAX,Math.max(Math.min(.4,fit()),z)), dist=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
  const rel=(x,y)=>{const r=wrap.getBoundingClientRect();return[x-r.left,y-r.top]};
  // redibuja a la escala z manteniendo fijo el punto (cx,cy) del contenedor
  const commit=(z,cx,cy)=>{const old=MAPSC;if(Math.abs(z-old)<.004)return;
    const x=(wrap.scrollLeft+cx)/old, y=(wrap.scrollTop+cy-HEAD)/old;
    ZOOM=z;renderMap();wrap.scrollLeft=x*MAPSC-cx;wrap.scrollTop=y*MAPSC-cy+HEAD};
  let pinch=null;
  const reset=()=>{map.style.transform=areas.style.transform='';map.style.transformOrigin=areas.style.transformOrigin=''};
  const end=()=>{if(!pinch)return;const p=pinch;pinch=null;reset();commit(p.z,p.cx,p.cy)};
  wrap.addEventListener('touchstart',e=>{
    if(e.touches.length!==2){if(e.touches.length>2)end();return}
    const [a,b]=e.touches, [cx,cy]=rel((a.clientX+b.clientX)/2,(a.clientY+b.clientY)/2);
    pinch={d:dist(a,b)||1,z0:MAPSC,z:MAPSC,cx,cy};
    const ox=wrap.scrollLeft+cx, oy=wrap.scrollTop+cy-HEAD;
    map.style.transformOrigin=`${ox}px ${oy}px`;areas.style.transformOrigin=`${ox}px 0`;
  },{passive:true});
  wrap.addEventListener('touchmove',e=>{
    if(!pinch||e.touches.length!==2)return;
    if(e.cancelable)e.preventDefault();
    const [a,b]=e.touches;
    pinch.z=clampZ(pinch.z0*Math.pow(dist(a,b)/pinch.d,GAIN));
    const k=pinch.z/pinch.z0;map.style.transform=`scale(${k})`;areas.style.transform=`scaleX(${k})`;
  },{passive:false});
  wrap.addEventListener('touchend',e=>{if(e.touches.length<2)end()});
  wrap.addEventListener('touchcancel',end);               // si el navegador interrumpe el gesto, se conserva el zoom alcanzado
  ['gesturestart','gesturechange'].forEach(t=>wrap.addEventListener(t,e=>e.preventDefault()));   // Safari (iOS)
  let raf=0,pend=null;
  wrap.addEventListener('wheel',e=>{if(!e.ctrlKey)return;e.preventDefault();const [cx,cy]=rel(e.clientX,e.clientY);
    pend={z:clampZ((pend?.z??MAPSC)*Math.exp(-e.deltaY/200)),cx,cy};
    if(!raf)raf=requestAnimationFrame(()=>{raf=0;const p=pend;pend=null;commit(p.z,p.cx,p.cy)})},{passive:false});
})();
let rt;window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{if(SATE.modulos.mapa&&S.tab==='tray'&&ZOOM==null)renderMap()},150)});
$('#foot-info').textContent=SATE.texto('sate.pie')+' ';
{const b=document.createElement('button');b.type='button';b.className='enc-link';b.dataset.encuesta='';b.textContent='Dar mi opinión sobre SATE';$('#foot').appendChild(b)}
// contexto anónimo para la encuesta (tools/encuesta.py): sin nombre, boleta ni calificaciones
window.ENCUESTA_CTX=()=>({carrera:S.car,demo:DEMO,conDatos:isPersonal(),elegidas:tr().want.length,enHorario:selected().length,
  lector:DEMO||!ALUMNO?'':ALUMNO.lector||'anterior',datosDias:ALUMNO?.leido&&!DEMO?Math.floor((Date.now()-new Date(ALUMNO.leido))/864e5):null});
if(ALUMNO&&DATA.mapas[carreraPerfil(ALUMNO)])S.car=carreraPerfil(ALUMNO);
const mobNote=()=>{$('#mobnote').hidden=true};
mobNote();MQ_PHONE.addEventListener('change',()=>{mobNote();render()});
$('#b-unidad').addEventListener('click',()=>SATE.elegirUnidad());   // primera visita: unidad, carrera o inicio de sesión
SAES.status(ALUMNO);
SAES.wire(d=>{ALUMNO=d;for(const k in T)delete T[k];if(d&&DATA.mapas[carreraPerfil(d)]){S.car=carreraPerfil(d);store.set('car',S.car)}S.tab='tray';render();SAES.status(d)});

// Alumno activo (respeta el modo demostración): lo usan los trámites de Ventanilla.
SATE.alumno=()=>ALUMNO;
SATE.nucleoListo({store,personal:()=>!!ALUMNO,renderTop,renderAviso,renderTray,renderHor,estado:S,ofertaLista:actualizarOferta}).catch(SATE.error);

// El chip global también contempla las comparaciones activadas por bloque.
function renderSimGlobal(){
  const chip=$('#sate-simulacion');
  chip.hidden=!isPersonal()||!(SIM.on||Object.values(SIMBLK).some(Boolean));
  $('#sate-simulacion-texto').textContent=SATE.texto('sate.desempeno.sim_activa');
  $('#sate-simulacion-quitar').textContent=SATE.texto('sate.desempeno.quitar');
}
$('#sate-simulacion-quitar').addEventListener('click',()=>{SIM.on=false;simTodos();simSave()});
