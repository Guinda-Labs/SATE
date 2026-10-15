"""Encuesta de satisfacción de la fase de pruebas (Horarios, todas las unidades).

Se inyecta al final de cada página de Horarios. Aparece sola cuando el alumno ya usó la herramienta (exportó un horario,
generó horarios y los siguió revisando unos minutos, o lleva media hora de uso activo), se puede posponer y deja de aparecer en cuanto se responde. Si al responder
el alumno aún no se inscribe, después del cierre de la reinscripción (o unos días después) se le pregunta solo si se
inscribió con el horario que planeó.

Las respuestas son anónimas y se envían a la hoja de cálculo del responsable mediante Google Apps Script
(tools/encuesta_appscript.gs; guía en docs/ENCUESTA.md). Configuración en data/encuesta.json:
  activa             false la apaga sin quitar el código
  endpoint           URL /exec de la implementación del Apps Script (vacía = la encuesta no aparece)
  cierre             fecha AAAA-MM-DD de cierre de la reinscripción en el SAES (para el seguimiento); null = seguimientoDias
  seguimientoDias    días tras la primera respuesta para el seguimiento si no hay fecha de cierre
La página puede ofrecer `window.ENCUESTA_CTX = () => ({...})` con contexto no identificable (carrera, modo, etc.).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def config():
    try:
        return json.loads((ROOT / "data" / "encuesta.json").read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"activa": False}


CSS = r"""
.enc-dlg{width:min(560px,calc(100vw / var(--ui-zoom,1) - 24px))}
.enc-dlg form{display:flex;flex-direction:column;gap:16px;margin-top:8px}
.enc-dlg .enc-intro{margin:2px 0 0;color:var(--muted);font-size:.92rem}
.enc-dlg fieldset{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;min-width:0}
.enc-dlg legend{font-weight:600;font-size:.95rem;padding:0;margin-bottom:6px}
.enc-dlg legend small{font-weight:400;color:var(--muted)}
.enc-esc{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.enc-esc.n11{grid-template-columns:repeat(11,1fr);gap:4px}
.enc-esc label,.enc-opc label{position:relative}
.enc-esc input,.enc-opc input{position:absolute;opacity:0;inset:0;margin:0;cursor:pointer}
.enc-esc span{display:flex;align-items:center;justify-content:center;min-height:40px;border:1px solid var(--line);border-radius:8px;background:var(--surface);font-weight:600;font-variant-numeric:tabular-nums;cursor:pointer}
.enc-esc.n11 span{min-height:36px;font-size:.85rem}
.enc-esc input:checked+span,.enc-opc input:checked+span{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
.enc-esc input:focus-visible+span,.enc-opc input:focus-visible+span{outline:2px solid var(--accent);outline-offset:2px}
.enc-ext{display:flex;justify-content:space-between;font-size:.78rem;color:var(--muted);margin-top:-2px}
.enc-opc{display:flex;flex-wrap:wrap;gap:6px}
.enc-opc span{display:inline-flex;align-items:center;padding:7px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface);font-size:.86rem;cursor:pointer}
.enc-dlg textarea{width:100%;box-sizing:border-box;min-height:64px;resize:vertical;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);padding:8px 10px;font:inherit;font-size:.9rem}
.enc-dlg .enc-nota{font-size:.8rem;color:var(--muted);margin:0}
.enc-dlg .enc-acc{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}
.enc-dlg .enc-acc .enc-no{margin-right:auto;border:0;background:none;color:var(--muted);text-decoration:underline;cursor:pointer;font-size:.82rem;padding:4px 0}
.enc-dlg .enc-msg{min-height:1.2em;font-size:.86rem;color:var(--muted);margin:0}
.enc-dlg .enc-msg.bad{color:var(--bad,#b42318)}
.enc-dlg .enc-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.enc-apoyo-pie{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);text-align:center}
.enc-gracias{text-align:center;padding:18px 4px 6px}
.enc-gracias b{display:block;font-size:1.15rem;margin-bottom:6px}
.enc-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:999px;padding:4px 12px 4px 8px;font:inherit;font-size:.86rem;font-weight:600;cursor:pointer;white-space:nowrap}
.enc-btn:hover{border-color:var(--accent)}
.enc-btn svg{flex:none;color:var(--accent)}
.enc-btn[hidden]{display:none}
@media (max-width:560px){.enc-btn{width:36px;height:36px;padding:0;justify-content:center}.enc-btn span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}}
.enc-link{border:0;background:none;color:var(--accent);text-decoration:underline;cursor:pointer;font:inherit;padding:0}
@media (max-width:480px){.enc-esc.n11{grid-template-columns:repeat(6,1fr)}}
"""

JS = r"""
(()=>{
const C=/*__ENC_CFG__*/{};
const APOYO=/*__APOYO__*/"";
const K='ipnt.encuesta', DIA=864e5, ahora=()=>Date.now();
const ls={get(){try{return JSON.parse((window.IPNT?.almacen||localStorage).getItem(K))||{}}catch(e){return {}}},set(v){try{(window.IPNT?.almacen||localStorage).setItem(K,JSON.stringify(v))}catch(e){}}};
let E=ls.get();
E.id=E.id||(crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+ahora().toString(36));
E.uso=E.uso||{min:0,ses:0,exp:0,gen:0};E.pos=E.pos||0;E.hasta=E.hasta||0;
try{if(!sessionStorage.getItem(K)){sessionStorage.setItem(K,'1');E.uso.ses++}}catch(e){}
ls.set(E);
const guardar=()=>ls.set(E);
const activa=!!(C.activa&&C.endpoint);
let mostrada=false;   // una vez por visita

/* ---------- cuándo aparece ---------- */
// exportó un horario, generó horarios y siguió revisándolos 3 minutos, o lleva media hora de uso activo
const usoSuficiente=()=>{const u=E.uso;return u.exp>=1||u.genAt!=null&&u.min-u.genAt>=3||u.min>=30};
const fechaSeguimiento=()=>C.cierre?new Date(C.cierre+'T23:59:00').getTime():(E.resp?.t||0)+(C.seguimientoDias||4)*DIA;
function pendiente(){
  if(!activa||E.no||ahora()<E.hasta)return null;
  if(!E.resp)return usoSuficiente()?'completa':null;
  if(E.resp.inscrito==='aun'&&!E.seg&&ahora()>=fechaSeguimiento())return 'seguimiento';
  return null;
}
function intentar(motivo,demora){
  const tipo=pendiente();if(!tipo||mostrada)return;
  if(document.querySelector('dialog[open]'))return;   // no interrumpir otro diálogo
  mostrada=true;setTimeout(()=>{if(document.querySelector('dialog[open]')){mostrada=false;return}abrir(tipo,motivo)},demora||0);
}
// tiempo activo: cuenta medio minuto si la pestaña está visible y hubo interacción reciente
let ultimo=ahora();
['pointerdown','keydown','scroll','touchstart'].forEach(ev=>addEventListener(ev,()=>{ultimo=ahora()},{passive:true}));
setInterval(()=>{if(document.visibilityState==='visible'&&ahora()-ultimo<60e3){E.uso.min+=.5;guardar();intentar('tiempo')}},30e3);

/* ---------- formulario ---------- */
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const escala=(n,etq,ext,extra)=>`<div class="enc-esc${n===11?' n11':''}">${Array.from({length:n},(_,i)=>{const v=n===11?i:i+1;return `<label><input type="radio" name="${etq}" value="${v}"${i===0?' required':''}><span>${v}</span></label>`}).join('')}</div><div class="enc-ext"><span>${ext[0]}</span><span>${ext[1]}</span></div>${extra||''}`;
const opciones=(nombre,tipo,ops,req)=>`<div class="enc-opc">${ops.map(([v,t],i)=>`<label><input type="${tipo}" name="${nombre}" value="${v}"${req&&i===0?' required':''}><span>${esc(t)}</span></label>`).join('')}</div>`;
const INSCRITO=[['igual','Sí, con el horario que planeé'],['parecido','Sí, con uno parecido'],['distinto','Sí, con uno distinto'],['aun','Todavía no']];
const FUNCIONES=[['mapa','Mapa curricular'],['manual','Armar horario a mano'],['generador','Generador automático'],['exportar','Exportar horario'],['estado','Estado académico y simulación'],['metas','Metas de término y promedio'],['estadisticas','Estadísticas'],['equivalencias','Equivalencias']];
function formulario(tipo){
  if(tipo==='comentario') return `
    <fieldset><legend>¿Sobre qué es tu comentario?</legend>${opciones('tema','radio',[['error','Un error o dato incorrecto'],['sugerencia','Una sugerencia'],['otro','Otro']],true)}</fieldset>
    <fieldset><legend>Cuéntanos</legend><textarea name="comentario" maxlength="1000" required placeholder="Qué pasó o qué te gustaría que tuviera"></textarea></fieldset>`;
  if(tipo==='seguimiento') return `
    <fieldset><legend>¿Ya te inscribiste en el SAES?</legend>${opciones('inscrito','radio',[...INSCRITO.slice(0,3),['no','No me inscribí este periodo']],true)}</fieldset>
    <fieldset><legend>¿Qué tan útil fue SATE para llegar a tu cita con el horario listo?</legend>${escala(5,'util_cita',['Nada útil','Muy útil'])}</fieldset>
    <fieldset><legend>¿Algo que quieras agregar? <small>(opcional)</small></legend><textarea name="comentario" maxlength="1000"></textarea></fieldset>`;
  return `
    <fieldset><legend>En general, ¿qué tan satisfecho estás con SATE?</legend>${escala(5,'satisfaccion',['Nada satisfecho','Muy satisfecho'])}</fieldset>
    <fieldset><legend>¿Qué tan útil fue para armar tu horario?</legend>${escala(5,'util_horario',['Nada útil','Muy útil'],`<div class="enc-opc"><label><input type="radio" name="util_horario" value="na"><span>No la usé para eso</span></label></div>`)}</fieldset>
    <fieldset><legend>¿Qué funciones usaste? <small>(elige las que apliquen)</small></legend>${opciones('funciones','checkbox',FUNCIONES)}</fieldset>
    <fieldset><legend>Comparado con como armabas tu horario antes, el tiempo que te tomó fue…</legend>${opciones('tiempo','radio',[['mucho_menor','Mucho menor'],['menor','Menor'],['igual','Igual'],['mayor','Mayor'],['primera','Es mi primera reinscripción']],true)}</fieldset>
    <fieldset><legend>¿Ya te inscribiste en el SAES?</legend>${opciones('inscrito','radio',INSCRITO,true)}</fieldset>
    <fieldset><legend>Del 0 al 10, ¿qué tan probable es que la recomiendes a un compañero?</legend>${escala(11,'recomendacion',['Nada probable','Muy probable'])}</fieldset>
    <fieldset><legend>¿Encontraste algún error o dato incorrecto? <small>(opcional)</small></legend><textarea name="errores" maxlength="1000" placeholder="Por ejemplo: una seriación, un grupo o un promedio que no coincide con el SAES"></textarea></fieldset>
    <fieldset><legend>¿Qué agregarías o mejorarías? <small>(opcional)</small></legend><textarea name="mejoras" maxlength="1000"></textarea></fieldset>`;
}
let dlg=null;
function abrir(tipo,motivo){
  tipo=tipo||(E.resp?'seguimiento':'completa');
  dlg?.remove();
  dlg=document.createElement('dialog');dlg.className='saes-dlg enc-dlg';dlg.setAttribute('aria-labelledby','enc-h');
  const seg=tipo==='seguimiento', com=tipo==='comentario', otra=E.pos>=1&&motivo!=='manual';
  dlg.innerHTML=`<div class="dl-head"><h2 id="enc-h">${com?'Danos tu opinión':seg?'Dos preguntas rápidas':'¿Te está sirviendo SATE?'}</h2><button class="x" type="button" data-enc-cerrar aria-label="Cerrar">×</button></div>
    <p class="enc-intro">${com?'Ya contestaste la encuesta, ¡gracias! Aquí puedes reportar un error o dejarnos una sugerencia cuando quieras.':seg?'Nos ayuda a saber si la herramienta sirvió en tu reinscripción. Son 30 segundos.':'Estamos en fase de pruebas. Tus respuestas, anónimas, nos ayudan a saber si la herramienta te sirve y qué mejorar. Son 2 minutos.'}</p>
    <form novalidate>${formulario(tipo)}
      <div class="enc-hp" aria-hidden="true"><label>No llenar <input name="web" tabindex="-1" autocomplete="off"></label></div>
      <p class="enc-nota">No escribas tu nombre, boleta ni otros datos personales. Más información en el <a href="privacidad.html" target="_blank" rel="noopener">aviso de privacidad</a>.</p>
      <p class="enc-msg" role="status"></p>
      <div class="enc-acc">${otra?'<button type="button" class="enc-no" data-enc-nunca>No volver a preguntar</button>':''}<button type="button" class="btn" data-enc-cerrar>${motivo==='manual'?'Cancelar':'Ahora no'}</button><button type="submit" class="btn primary">Enviar</button></div>
    </form>${APOYO?'<div class="enc-apoyo-pie">'+APOYO+'</div>':''}`;
  document.body.appendChild(dlg);
  dlg.querySelectorAll('[data-enc-cerrar]').forEach(b=>b.addEventListener('click',()=>{posponer();dlg.close()}));
  dlg.addEventListener('cancel',()=>posponer());
  dlg.querySelector('[data-enc-nunca]')?.addEventListener('click',()=>{E.no=ahora();guardar();dlg.close()});
  dlg.querySelector('form').addEventListener('submit',ev=>{ev.preventDefault();enviar(tipo,motivo,ev.currentTarget)});
  dlg.addEventListener('close',()=>{setTimeout(()=>dlg?.remove(),0)});
  dlg.showModal();
}
// lo que se puede responder a voluntad: la encuesta si no se ha contestado, o el seguimiento si se dijo «todavía no»
function manual(){if(!activa)return null;if(!E.resp)return 'completa';return E.resp.inscrito==='aun'&&!E.seg?'seguimiento':'comentario'}
let enviado=false;
function posponer(){if(enviado)return;E.pos++;E.hasta=ahora()+(E.pos<=2?1:3)*DIA;guardar()}

/* ---------- envío ---------- */
function contexto(){
  let c={};try{c=window.ENCUESTA_CTX?.()||{}}catch(e){}
  return {...c,unidad:c.unidad||C.unidad||'',fase:C.fase||'',version:C.version||'',
    movil:matchMedia('(max-width:700px)').matches,minutos:E.uso.min,sesiones:E.uso.ses,exportaciones:E.uso.exp,generaciones:E.uso.gen};
}
async function mandar(datos){
  const body=JSON.stringify(datos);
  try{const r=await fetch(C.endpoint,{method:'POST',body,redirect:'follow'});const j=await r.json();if(!j.ok)throw new Error(j.error||'rechazada');return true}
  catch(e){   // si el navegador no deja leer la respuesta, se envía sin leerla
    if(e instanceof TypeError){try{await fetch(C.endpoint,{method:'POST',body,mode:'no-cors'});return true}catch(e2){}}
    if(String(e.message).match(/rechazada|inválid/i))throw e;
    throw new Error('sin conexión');
  }
}
async function enviar(tipo,motivo,f){
  const msg=f.querySelector('.enc-msg');msg.className='enc-msg';
  const falta=[...f.querySelectorAll('fieldset')].find(fs=>fs.querySelector('input[required]')&&!fs.querySelector('input:checked')||fs.querySelector('textarea[required]')&&!fs.querySelector('textarea').value.trim());
  if(falta){msg.textContent='Falta responder: '+falta.querySelector('legend').firstChild.textContent.trim();msg.classList.add('bad');falta.scrollIntoView({block:'center',behavior:'smooth'});return}
  const fd=new FormData(f), r={};
  for(const [k,v] of fd.entries()){if(k==='funciones')(r[k]=r[k]||[]).push(v);else r[k]=String(v).trim().slice(0,1000)}
  if(r.funciones)r.funciones=r.funciones.join(',');
  const datos={tipo,motivo:motivo||'',id:E.id,respuestas:r,contexto:contexto(),web:r.web||''};delete r.web;
  const b=f.querySelector('[type=submit]');b.disabled=true;msg.textContent='Enviando…';
  try{await mandar(datos)}
  catch(e){b.disabled=false;msg.classList.add('bad');msg.textContent=e.message==='sin conexión'?'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.':'No se pudo registrar la respuesta. Inténtalo más tarde.';return}
  enviado=true;
  if(tipo==='seguimiento')E.seg=ahora();else if(tipo==='completa')E.resp={t:ahora(),inscrito:r.inscrito};
  E.hasta=0;guardar();enlaces();
  dlg.querySelector('.enc-apoyo-pie')?.remove();   // el agradecimiento ya trae el enlace
  f.outerHTML='<div class="enc-gracias"><b>¡Gracias por tu respuesta!</b>'+(r.inscrito==='aun'&&tipo==='completa'?'Cuando cierre la reinscripción te haremos una última pregunta.':'Nos ayuda a mejorar SATE para todo el alumnado.')+APOYO+'</div>';
  // Se conserva el cierre manual para dar tiempo a leer el aviso y usar el enlace.
}

/* ---------- API para la página ---------- */
window.ENCUESTA={
  marcar(ev){if(ev==='exp')E.uso.exp++;else if(ev==='gen'){E.uso.gen++;if(E.uso.genAt==null)E.uso.genAt=E.uso.min}guardar();intentar(ev,1500)},
  abrir(){const t=manual();if(!t)return false;abrir(t,'manual');return true},
  get respondida(){return !!E.resp},
  get activa(){return activa}
};
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-encuesta]');if(!b)return;e.preventDefault();window.ENCUESTA.abrir()});
// botón «Opinar» y enlace del pie: visibles mientras la encuesta esté activa
const enlaces=()=>document.querySelectorAll('[data-encuesta]').forEach(b=>{b.hidden=!activa});
enlaces();
if(activa)setTimeout(()=>intentar('visita'),4000);
})();
"""


def inject(html, unidad=""):
    import contenido
    cfg = config()
    cfg["unidad"] = unidad
    if not cfg.get("activa"):
        cfg["endpoint"] = ""
    js = JS.replace("/*__ENC_CFG__*/{}", json.dumps(cfg, ensure_ascii=False), 1)
    js = js.replace('/*__APOYO__*/""', json.dumps(contenido.html_apoyo(), ensure_ascii=False), 1)
    return html + f"\n<style>{CSS}</style>\n<script>{js}</script>\n"
