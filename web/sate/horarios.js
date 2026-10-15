const txH=(clave,vars)=>SATE.texto('sate.horarios.'+clave,vars);
if(typeof CUPOS!=='undefined')CUPOS.montar();
$('#offer').addEventListener('click',e=>{
  if(e.target.closest('[data-oferta-mapa]'))SATE.ir('mapa');
  if(e.target.closest('[data-oferta-toda]')){S.onlyWant=false;store.set('onlyWant',false);renderHFilters();renderOffer()}
});
$('#f-hide').addEventListener('change',e=>{S.hide=e.target.checked;store.set('hide',S.hide);renderOffer()});
$('#f-done').addEventListener('change',e=>{S.hideDone=e.target.checked;store.set('hideDone',S.hideDone);renderOffer()});
$('#f-fit').addEventListener('change',e=>{S.fit=e.target.checked;renderOffer()});
$('#f-want').addEventListener('change',e=>{S.onlyWant=e.target.checked;store.set('onlyWant',S.onlyWant);renderOffer()});
$('#f-weekend').addEventListener('change',e=>{S.weekend=e.target.checked;store.set('weekend',S.weekend);renderCal()});
$('#f-q').addEventListener('input',e=>{S.q=e.target.value;S.acIdx=-1;renderAC();renderOffer()});
$('#f-q').addEventListener('keydown',e=>{
  const n=S.acItems.length;
  if(e.key==='ArrowDown'&&n){e.preventDefault();S.acIdx=(S.acIdx+1)%n;renderAC()}
  else if(e.key==='ArrowUp'&&n){e.preventDefault();S.acIdx=(S.acIdx-1+n)%n;renderAC()}
  else if(e.key==='Enter'&&n){e.preventDefault();pick(S.acIdx<0?0:S.acIdx)}
  else if(e.key==='Escape'){S.acIdx=-1;$('#ac').hidden=true;$('#f-q').setAttribute('aria-expanded','false')}
  else if(e.key==='Backspace'&&!e.target.value&&S.chips.length){S.chips.pop();renderActive();renderOffer()}
});
$('#f-q').addEventListener('blur',()=>setTimeout(()=>{$('#ac').hidden=true;$('#f-q').setAttribute('aria-expanded','false')},150));
$('#f-q').addEventListener('focus',()=>{if(S.q)renderAC()});
for(const [id,list] of [['#g-pref','gpref'],['#g-avoid','gavoid']]){
  const add=el=>{const v=el.value.trim();if(v&&!S[list].includes(v)){S[list].push(v);
    if(list==='gavoid'){store.set('excl',S.gavoid);renderActive();renderOffer()}else renderGPrefs()}el.value=''};
  $(id).addEventListener('change',e=>add(e.target));
  // al elegir una opción del autocompletado se agrega de inmediato (sin Enter): el texto coincide con un profesor de la lista
  $(id).addEventListener('input',e=>{const v=e.target.value.trim();if(v&&[...$('#proflist').options].some(o=>o.value===v))add(e.target)});
}
// horario en la escuela y descansos (se vuelven a generar las opciones si ya había resultados)
const gtChanged=()=>{gtSave();renderOffer();if(S.gen||generacion)iniciarGeneracion()};
$('#g-from').addEventListener('change',e=>{GT.a=e.target.value;gtChanged()});
$('#g-to').addEventListener('change',e=>{GT.b=e.target.value;gtChanged()});
$('#b-reset').addEventListener('click',()=>{
  Object.assign(S,{tur:'*',niv:'*',q:'',chips:[],hide:false,hideDone:true,fit:false,gap:null,onlyWant:true,gavoid:[],gt:'*',gpref:[],gen:null});S.expand=new Set();
  ws().marks={};save();   // también quita las marcas «Sí / Quizá / No» (y sus notas) del periodo consultado
  ['tur','niv'].forEach(k=>store.set(k,'*'));store.set('hide',false);store.set('hideDone',true);store.set('onlyWant',true);store.set('excl',[]);
  Object.assign(GT,{a:'',b:'',breaks:[],days:'',n:'',src:''});gtSave();$('#f-q').value='';$('#g-avoid').value='';$('#g-pref').value='';
  if($('#gen'))$('#gen').open=false;renderGTime();render()});
$('#g-src').addEventListener('click',e=>{const b=e.target.closest('[data-gsrc]');if(!b)return;GT.src=b.dataset.gsrc;renderGTime();gtChanged()});
$('#g-n').addEventListener('click',e=>{const b=e.target.closest('[data-gn]');if(!b)return;GT.n=b.dataset.gn;renderGTime();gtChanged()});
$('#g-days').addEventListener('click',e=>{const b=e.target.closest('[data-gdays]');if(!b)return;GT.days=b.dataset.gdays;renderGTime();gtChanged()});
$('#gbreaks').addEventListener('click',e=>{
  if(e.target.id==='b-addbrk'){GT.breaks.push({d:30,a:'13:00',b:'15:00'});renderGTime();gtChanged()}
  else if(e.target.dataset.unbrk){GT.breaks.splice(+e.target.dataset.unbrk,1);renderGTime();gtChanged()}
  else if(e.target.dataset.bday){const b=GT.breaks[+e.target.closest('[data-brk]').dataset.brk],v=e.target.dataset.bday;
    if(v==='all')b.days=[];else{const d=+v,ds=new Set(b.days||[]);ds.has(d)?ds.delete(d):ds.add(d);b.days=[...ds].sort()}
    renderGTime();gtChanged()}});
$('#gbreaks').addEventListener('change',e=>{const r=e.target.closest('[data-brk]'),f=e.target.dataset.f;if(!r||!f)return;GT.breaks[+r.dataset.brk][f]=e.target.value;gtChanged()});
$('#b-gen').addEventListener('click',iniciarGeneracion);
$('#b-gen-clear').addEventListener('click',()=>{cancelarGeneracion();S.gen=null;renderGen();renderCal();$('#gen-status').textContent='';$('#b-gen').focus()});
// Un cambio de contexto invalida el cálculo antes de que otro lote lea preferencias nuevas.
document.addEventListener('change',()=>cancelarGeneracion(),true);
document.addEventListener('input',()=>cancelarGeneracion(),true);
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(b&&b.id!=='b-gen')cancelarGeneracion();
},true);
$('#b-horario').addEventListener('click',()=>{
  const dlg=$('#horario-compacto');
  // Mover la vista real conserva la selección, los eventos y la vista previa sin duplicar ids.
  for(const s of ['.calwrap','#agenda'])$('#horario-compacto-cuerpo').appendChild($(s));
  dlg.showModal();
});
$('#horario-compacto-cerrar').addEventListener('click',()=>$('#horario-compacto').close());
$('#horario-compacto').addEventListener('close',()=>{
  for(const s of ['.calwrap','#agenda'])$('.planner').insertBefore($(s),$('.planner .summary'));
  $('#b-horario').focus();
});
$('#offer').addEventListener('pointerover',e=>{if(e.pointerType!=='mouse'||e.target.closest('.note'))return;const o=e.target.closest('.opt');const k=o?o.dataset.k:null;if(k!==S.hover){S.hover=k;renderCal()}});
$('#offer').addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&S.hover){S.hover=null;renderCal()}});
for(const id of ['#cal','#agenda'])$(id).addEventListener('keydown',bloquePropioEvento);
$('#agenda').addEventListener('click',bloquePropioEvento);
$('#cal').addEventListener('click',e=>{
  if(bloquePropioEvento(e))return;
  // clic en un hueco vacío: filtra la oferta a lo que cabe en ese bloque (otro clic en el mismo hueco lo quita)
  const g=e.target.closest('.gapcell');
  if(g){const [d,a]=g.dataset.gap.split('|').map(Number);S.gap=S.gap&&S.gap.d===d&&S.gap.a===a?null:{d,a,b:a+BLOCK};
    renderActive();renderOffer();renderCal();if(S.gap)$('#h-offer').scrollIntoView({block:'start',behavior:'smooth'});return}
  const b=e.target.closest('.blk[data-k]:not(.ghost)');if(!b)return;const o=document.querySelector(`.opt[data-k="${CSS.escape(b.dataset.k)}"]`);if(o)o.scrollIntoView({block:'center',behavior:'smooth'})});
$('#own-f').addEventListener('submit',e=>{
  e.preventDefault();const n=$('#own-n').value.trim(),a=toMin($('#own-a').value),b=toMin($('#own-b').value);
  const oculto=SEMANA_ACTIVA&&$('#semana-oculta').checked,hsTxt=oculto?$('#semana-hs').value:'',hs=hsTxt!==''?parseFloat(hsTxt):null;
  const conHoras=oculto&&hs!=null;
  const msg=conHoras?(hs>0&&hs<=168?'':txH('semana_horas_invalidas')):!S.ownDays.length?txH('actividad_dias'):b<=a?txH('actividad_horas'):'';
  if(!n||msg){$('#own-n').setCustomValidity(msg);$('#own-n').reportValidity();$('#own-n').setCustomValidity('');return}
  plan().own.push(conHoras?{n,d:[],a:0,b:0,hs,oculto:true,tipo:$('#semana-tipo').value}:{n,d:[...S.ownDays].sort(),a,b,...(SEMANA_ACTIVA?{tipo:$('#semana-tipo').value}:{}),...(oculto?{oculto:true}:{})});
  if(!conHoras&&S.ownDays.some(d=>d>=5)){S.weekend=true;store.set('weekend',true);$('#f-weekend').checked=true}
  $('#own-n').value='';S.ownDays=[];if(SEMANA_ACTIVA){$('#semana-oculta').checked=false;$('#semana-hs').value='';$('#semana-hs-campo').hidden=true}renderOwnForm();refresh();
});
$('#b-saeshor').addEventListener('click',()=>loadInscrito());
$('#b-clear').addEventListener('click',()=>{plan().sel=[];plan().own=[];$('#copybox').hidden=true;refresh()});


$('#equiv').addEventListener('toggle',renderEquiv);
function base(){return classes().filter(c=>c[0]===S.car&&(S.tur==='*'||c[1]===S.tur)&&(S.niv==='*'||c[2]===S.niv))}
function filtered(){
  const q=norm(S.q.trim()), marks=ws().marks, want=new Set(tr().want);
  const m=S.chips.filter(x=>x.t==='m').map(x=>x.v), p=S.chips.filter(x=>x.t==='p').map(x=>x.v), g=S.chips.filter(x=>x.t==='g').map(x=>x.v);
  // llenar huecos: en toda la carrera, sin lo ya elegido/acreditado, sin choques y (si hay hueco) con clase en ese bloque
  const hunt=S.fit||!!S.gap, sel=selected(), own=ownAsClasses(), have=new Set(sel.map(c=>c[4])), done=new Set(isPersonal()?tr().done:[]);
  const fits=c=>c[6].length&&!have.has(c[4])&&!done.has(c[8])&&![...sel,...own].some(x=>overlaps(x,c))&&
    (!S.gap||c[6].some(([d,a,b])=>d===S.gap.d&&a<S.gap.b&&S.gap.a<b));
  const mine=new Set(plan().sel);
  return base().filter(c=>(mine.has(keyOf(c))||!outWin(c))&&(!S.hide||mine.has(keyOf(c))||!isExcl(c))&&(hunt?fits(c):(!S.onlyWant||want.has(c[8])))&&(!m.length||m.includes(c[4]))&&(!p.length||c[5].some(i=>p.includes(i)))&&(!g.length||g.includes(c[3]))&&
    (!S.hideDone||!done.has(c[8]))&&(!S.hide||marks[keyOf(c)]?.s!=='no'||plan().sel.includes(keyOf(c)))&&
    (!q||norm(name(c)+' '+c[8]+' '+profs(c)+' '+c[3]).includes(q)));
}
function suggest(q){
  q=norm(q.trim());if(!q)return[];
  const cs=classes().filter(c=>c[0]===S.car), out=[], seen=new Set();
  const hit=s=>norm(s).includes(q);
  const push=(t,v,label,right)=>{const k=t+v;if(seen.has(k)||S.chips.some(x=>x.t===t&&x.v===v))return;seen.add(k);out.push({t,v,label,right})};
  cs.forEach(c=>{if(hit(name(c))||hit(c[8]))push('m',c[4],name(c),`${c[8]} · ${esc(textoCreditos(c[8],c[7]))}`)});
  cs.forEach(c=>c[5].forEach(i=>{if(hit(DATA.prof[i]))push('p',i,DATA.prof[i],'')}));
  cs.forEach(c=>{if(hit(c[3]))push('g',c[3],c[3],TURNOS[c[1]]||'')});
  const rank=x=>(norm(x.label).startsWith(q)?0:1);
  return out.sort((a,b)=>rank(a)-rank(b)||'mpg'.indexOf(a.t)-'mpg'.indexOf(b.t)).slice(0,10);
}
function hl(s,q){const i=norm(s).indexOf(norm(q.trim()));return i<0?esc(s):esc(s.slice(0,i))+'<mark>'+esc(s.slice(i,i+q.trim().length))+'</mark>'+esc(s.slice(i+q.trim().length))}
function renderAC(){
  const ac=$('#ac'), inp=$('#f-q');
  S.acItems=suggest(S.q);
  if(!S.acItems.length){ac.hidden=true;inp.setAttribute('aria-expanded','false');inp.removeAttribute('aria-activedescendant');return}
  const K={m:txH('materia'),p:txH('profesor'),g:txH('grupo')};
  ac.innerHTML=S.acItems.map((x,i)=>`<li id="ac-${i}" role="option" data-i="${i}" aria-selected="${i===S.acIdx}"><span class="k">${K[x.t]}</span><span>${hl(x.label,S.q)}</span><span class="r">${esc(x.right)}</span></li>`).join('');
  ac.hidden=false;inp.setAttribute('aria-expanded','true');
  if(S.acIdx>=0)inp.setAttribute('aria-activedescendant','ac-'+S.acIdx);else inp.removeAttribute('aria-activedescendant');
}
function pick(i){const x=S.acItems[i];if(!x)return;S.chips.push({t:x.t,v:x.v});S.q='';$('#f-q').value='';S.acIdx=-1;renderAC();renderActive();renderOffer()}
function renderActive(){
  const K={m:txH('tipo_materia'),p:txH('tipo_profesor'),g:txH('tipo_grupo')};
  const lab=x=>x.t==='m'?DATA.asig[x.v]:x.t==='p'?DATA.prof[x.v]:x.v;
  $('#active').innerHTML=S.chips.map((x,i)=>`<span class="pill"><i>${K[x.t]}</i>${esc(lab(x))}<button data-unchip="${i}" aria-label="${esc(txH('quitar_filtro',{nombre:lab(x)}))}">×</button></span>`).join('')+
    (S.chips.length>1?`<button class="link" data-unchip="all">${esc(txH('quitar_todos'))}</button>`:'')+
    S.gavoid.map((p,i)=>`<span class="pill"><i>${esc(txH('excluir'))}</i>${esc(p)}<button data-unga="${i}" aria-label="${esc(txH('quitar',{nombre:p}))}">×</button></span>`).join('')+
    (S.gap?`<span class="pill gap"><i>${esc(txH('hueco'))}</i>${DAYS[S.gap.d]} ${hm(S.gap.a)}–${hm(S.gap.b)}<button data-ungap="1" aria-label="${esc(txH('quitar_hueco'))}">×</button></span>`:'');
}
function renderHFilters(){
  document.querySelectorAll('#v-hor [data-htexto]').forEach(el=>el.textContent=txH(el.dataset.htexto));
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===S.view));
  document.querySelectorAll('[data-gt]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.gt===S.gt));
  $('#f-hide').checked=S.hide;$('#f-done').checked=S.hideDone;$('#f-done').disabled=!isPersonal();$('#f-fit').checked=S.fit;$('#f-weekend').checked=S.weekend;
  const n=tr().want.length;$('#f-want').checked=S.onlyWant;$('#f-want').disabled=false;
  $('#f-want-l').textContent=n?txH('elegidas',{n}):SATE.texto('sate.planeacion.filtro_elegidas');
  const mine=classes().filter(c=>c[0]===S.car);
  const turs=[...new Set(mine.map(c=>c[1]))].sort();
  if(S.tur!=='*'&&!turs.includes(S.tur)) S.tur='*';
  $('#f-turno').innerHTML=[['*',txH('todos')],...turs.map(t=>[t,TURNOS[t]||t])].map(([v,l])=>`<button class="chip" data-tur="${v}" aria-pressed="${v===S.tur}">${l}</button>`).join('');
  const nivs=[...new Set(mine.map(c=>c[2]))].sort((a,b)=>a-b);
  if(S.niv!=='*'&&!nivs.includes(S.niv)) S.niv='*';
  $('#f-nivel').innerHTML=[['*',txH('todos')],...nivs.map(n=>[n,n])].map(([v,l])=>`<button class="chip" data-niv="${v}" aria-pressed="${v===S.niv}">${l}</button>`).join('');
  $('#proflist').innerHTML=[...new Set(mine.flatMap(c=>c[5]))].map(i=>`<option value="${esc(DATA.prof[i])}">`).join('');
  renderActive();renderGPrefs();
}
function renderMasFiltros(){
  const n=[S.hide,S.fit,!!(GT.a||GT.b),S.gavoid.length>0,S.hideDone&&isPersonal()].filter(Boolean).length;
  $('#f-more-title').textContent=txH(n?'mas_filtros_activos':'mas_filtros',{n});
  if(n)$('#f-more').open=true;
}
/* Salones (índice 10, paralelo a los bloques; solo periodo actual, del PDF de horarios por aula de la unidad) */
const shortRoom=r=>String(r||'').replace(/^Aula\s+/,'');
const roomAt=(c,d,a)=>{const i=(c[6]||[]).findIndex(x=>x[0]===d&&x[1]===a);return i>=0&&c[10]?c[10][i]||'':''};
function roomsTxt(c){if(!c[10]||!c[10].some(Boolean))return '';const by=new Map();
  c[6].forEach((b,i)=>{const r=c[10][i];if(!r)return;const ds=by.get(r)||[];if(!ds.includes(b[0]))ds.push(b[0]);by.set(r,ds)});
  return [...by].map(([r,ds])=>`${esc(shortRoom(r))}${by.size>1?` (${ds.sort((x,y)=>x-y).map(d=>DAYS[d]).join(', ')})`:''}`).join(' · ')}
/* Líneas de especialización de una optativa (por clave o por nombre, ya que una optativa puede tener varias claves) */
function lineasDe(k){const c=cur(), n=c[k]?.[0]?.toUpperCase();if(!n)return[];
  return (MAP().lineas||[]).filter(l=>l.claves.some(x=>x===k||c[x]?.[0]?.toUpperCase()===n)).map(l=>l.linea!==l.area?l.linea:l.area)}
function optRow(c,sel,inGroup){
  const k=keyOf(c), on=plan().sel.includes(k), mk=ws().marks[k]||{};
  const clash=[...sel,...ownAsClasses()].filter(s=>(s.own||keyOf(s)!==k)&&overlaps(s,c));
  const same=sel.find(s=>s[4]===c[4]&&keyOf(s)!==k);
  let tags=typeof CUPOS!=='undefined'?CUPOS.insignia(c):'';
  if(!on&&clash.length) tags+=`<span class="tag bad">${esc(txH('choca',{nombre:clash.map(s=>s.own?s.n:s[3]+' '+name(s).toLowerCase()).join(', ')}))}</span>`;
  if(!on&&same) tags+=`<span class="tag soft">${esc(txH('reemplaza',{grupo:same[3]}))}</span>`;
  const who=inGroup?`<b>${esc(name(c))}</b> <small>${c[8]} · ${esc(textoCreditos(c[8],c[7]))}</small><br>${esc(profs(c))}`:esc(profs(c));
  if(isExcl(c)) tags+=`<span class="tag soft">${esc(txH('profesor_excluido'))}</span>`;
  return `<div class="opt${mk.s==='no'||isExcl(c)?' no':''}" data-k="${k}"><span class="grp">${inGroup?'':c[3]}</span><span class="who">${who}</span>
    <div class="right"><button class="add" data-toggle="${k}" aria-pressed="${on}">${esc(txH(on?'quitar_opcion':'agregar'))}</button>
      <span class="marks" role="group" aria-label="${esc(txH('marcar'))}"${isExcl(c)?` title="${esc(txH('profesor_excluido_ayuda'))}"`:''}>${[['si',txH('si')],['quiza',txH('quiza')],['no',txH('no')]].map(([m,l])=>isExcl(c)?`<button disabled data-m="${m}" aria-pressed="${m==='no'}">${l}</button>`:`<button data-mark="${m}" data-m="${m}" data-k="${k}" aria-pressed="${mk.s===m}">${l}</button>`).join('')}</span></div>
    <span class="when">${pattern(c).map(p=>`<span>${p}</span>`).join('')}${roomsTxt(c)?`<span class="room">${esc(txH('salon'))} ${roomsTxt(c)}</span>`:''}</span>
    ${tags?`<span class="tags">${tags}</span>`:''}
    ${mk.s?`<input class="note" type="text" data-note="${k}" value="${esc(mk.n||'')}" placeholder="${esc(txH('nota_placeholder'))}" aria-label="${esc(txH('nota'))}">`:''}</div>`;
}
/* filtros globales: profesores excluidos (cuentan como "No") y horario en la escuela (de … a …) */
const isExcl=c=>{const ex=S.gavoid.map(norm);return ex.length>0&&c[5].some(i=>ex.some(p=>norm(DATA.prof[i]).includes(p)))};
const outWin=c=>{const ga=tmin(GT.a),gb=tmin(GT.b);return c[6].some(([d,a,b])=>(ga!=null&&a<ga)||(gb!=null&&b>gb))};
// Las elegidas encabezan la oferta; después vienen los adeudos y el desfase.
const prio=k=>{if(tr().want.includes(k))return 0;if(!isPersonal()||!cur()[k])return 2;const st=statusOf(k);return st.startsWith('late')||st.startsWith('fail')?1:2};
/* ---------- generador de horarios ---------- */
/* horario en la escuela y descansos: preferencias del alumno para el generador (se guardan en este navegador) */
const GT=Object.assign({a:'',b:'',breaks:[],days:'',n:'',src:''},store.get('gtime',{}));
const daysOf=cs=>[...new Set(cs.flatMap(c=>c[6].map(x=>x[0])))].sort((a,b)=>a-b);
const tmin=t=>{const m=String(t||'').match(/^(\d{1,2}):(\d{2})/);return m?+m[1]*60+ +m[2]:null}; // '' -> null
const gtSave=()=>store.set('gtime',GT);
const SEMANA_ACTIVA=window.SATE_CONFIG?.unidades?.[UNIDAD]?.miSemana===true;
const MS=store.get('miSemana',{})||{};
const semanaValor=k=>SEMANA_ACTIVA?Math.max(0,Number(MS[k])||0):0;
const SEMANA_ETQ={comidaA:'comida_desde',comidaB:'comida_hasta'};
const semanaCampos=[['trabajo','number',168],['ida','number',1440],['vuelta','number',1440],['sueno','number',24],['estudio','number',168],['antes','time'],['dias','number',7],['comidaA','time'],['comidaB','time']];
function montarSemana(){
  if(!SEMANA_ACTIVA)return;
  $('#mi-semana').hidden=false;
  const principales=['ida','vuelta','antes','dias'];
  for(const [id,campos] of [['principales',semanaCampos.filter(c=>principales.includes(c[0]))],['secundarios',semanaCampos.filter(c=>!principales.includes(c[0]))]]){
    $(`#semana-${id}`).innerHTML=campos.map(([k,t,max])=>`<label class="field"><span>${esc(txH(`semana_${SEMANA_ETQ[k]||k}`))}</span><input id="semana-${k}" data-semana="${k}" type="${t}"${max?` min="${k==='dias'?1:0}" max="${max}" step="${k==='dias'?'1':'0.5'}"`:''} value="${esc(MS[k]??'')}"></label>`).join('');
  }
  // Se mueve el formulario existente: conserva días, calendario y persistencia por versión.
  $('#semana-form').appendChild($('#ownform'));
  $('#ownform summary').textContent=txH('semana_agregar');
  $('#ownform summary').appendChild(SateUI.ayuda('sate.horarios.semana_trabajo_ayuda'));
  $('#semana-borrar-ayuda').appendChild(SateUI.ayuda('sate.horarios.semana_borrado_ayuda'));
  $('#mi-semana').addEventListener('toggle',resumenSemana);
  resumenSemana();
  $('#own-n').placeholder='';$('#own-a').value='';$('#own-b').value='';
  $('#own-f').insertAdjacentHTML('afterbegin',`<p class="semana-ayuda-corta">${esc(txH('semana_agregar_ayuda'))}</p><label class="field"><span>${esc(txH('semana_tipo'))}</span><select id="semana-tipo"><option value="trabajo">${esc(txH('semana_trabajo_bloque'))}</option><option value="otras">${esc(txH('semana_otras'))}</option></select></label>`);
  $('#own-f').insertAdjacentHTML('beforeend',`<label class="check"><input type="checkbox" id="semana-oculta"> ${esc(txH('semana_solo_horas'))}</label><label class="field" id="semana-hs-campo" hidden><span>${esc(txH('semana_horas_semana'))}</span><input type="number" id="semana-hs" min="0" max="168" step="0.5"><small>${esc(txH('semana_horas_semana_ayuda'))}</small></label>`);
  $('#own-f').addEventListener('change',e=>{
    if(e.target?.id!=='semana-oculta')return;
    const solo=$('#semana-oculta').checked;$('#semana-hs-campo').hidden=!solo;
    if(!solo)$('#semana-hs').value='';
  });
  $('#semana-bloques').addEventListener('click',e=>{
    const ed=e.target.closest?.('[data-own-ed]'),el=e.target.closest?.('[data-own-del]');
    if(ed)abrirFichaPropia(+ed.dataset.ownEd);else if(el)eliminarPropia(+el.dataset.ownDel);
  });
  $('#own-deshacer-b').addEventListener('click',deshacerPropia);
  $('#semana-campos').addEventListener('change',e=>{
    const k=e.target.dataset.semana;if(!k||!e.target.checkValidity())return;
    const a=k==='comidaA'?e.target.value:MS.comidaA,b=k==='comidaB'?e.target.value:MS.comidaB;
    if(a&&b&&tmin(b)<=tmin(a)){e.target.setCustomValidity(txH('actividad_horas'));e.target.reportValidity();e.target.setCustomValidity('');e.target.value=MS[k]||'';return}
    MS[k]=e.target.value;store.set('miSemana',MS);semanaCambiar();
  });
  $('#semana-borrar').addEventListener('click',()=>{
    for(const k of Object.keys(MS))delete MS[k];store.set('miSemana',MS);
    // Solo los bloques de rutina nuevos; los extracurriculares anteriores y el SAES se conservan.
    for(const p of Object.values(ws().plans))p.own=p.own.filter(o=>!o.tipo);
    document.querySelectorAll('[data-semana]').forEach(el=>el.value='');refresh();semanaCambiar();
  });
}
function resumenSemana(){
  const partes=[txH('semana_titulo')];
  if(!$('#mi-semana').open){
    if(semanaValor('dias'))partes.push(txH('semana_resumen_dias',{n:fmtCr(semanaValor('dias'))}));
    const traslado=semanaValor('ida')+semanaValor('vuelta');
    if(traslado)partes.push(txH('semana_resumen_traslado',{n:fmtCr(traslado/60)}));
    if(MS.antes)partes.push(txH('semana_resumen_antes',{hora:MS.antes.replace(/^0/,'')}));
    for(const k of ['sueno','estudio','trabajo'])if(semanaValor(k))partes.push(txH(`semana_resumen_${k}`,{n:fmtCr(semanaValor(k))}));
    if(MS.comidaA||MS.comidaB)partes.push(txH('semana_resumen_comida',{desde:MS.comidaA||'',hasta:MS.comidaB||''}));
    const bloques=plan().own.filter(o=>!o.saes).length;
    if(bloques)partes.push(txH(bloques===1?'semana_resumen_bloque':'semana_resumen_bloques',{n:bloques}));
  }
  $('#semana-resumen').textContent=partes.join(' · ');
}
function semanaCambiar(){renderCal();if(S.gen||generacion)iniciarGeneracion()}
function semanaTraslados(cs){
  const clases=cs.flatMap(c=>c[6]||[]).concat(plan().own.filter(o=>o.saes).flatMap(o=>o.d.map(d=>[d,o.a,o.b])));
  return [...new Set(clases.map(b=>b[0]))].flatMap(d=>{
    const bs=clases.filter(b=>b[0]===d),a=Math.min(...bs.map(b=>b[1])),b=Math.max(...bs.map(b=>b[2]));
    return [[d,a-semanaValor('ida'),a],[d,b,b+semanaValor('vuelta')]].filter(x=>x[2]>x[1]);
  });
}
function semanaOk(cs){
  if(!SEMANA_ACTIVA)return true;
  const clases=cs.flatMap(c=>c[6]||[]).concat(plan().own.filter(o=>o.saes).flatMap(o=>o.d.map(d=>[d,o.a,o.b])));
  if(semanaValor('dias')&&new Set(clases.map(b=>b[0])).size>semanaValor('dias'))return false;
  const antes=tmin(MS.antes);if(antes!=null&&clases.some(b=>b[1]<antes))return false;
  const viaje=semanaTraslados(cs),propios=plan().own.filter(o=>!o.saes&&!o.oculto).flatMap(o=>o.d.map(d=>[d,o.a,o.b]));
  if(viaje.some(([d,a,b])=>a<0||b>1440||propios.some(([e,x,y])=>d===e&&a<y&&x<b)))return false;
  const a=tmin(MS.comidaA),b=tmin(MS.comidaB);
  // Como los descansos, el rango registrado se reserva completo, sin relajación automática.
  const dias=new Set(clases.map(x=>x[0]));
  return a==null||b==null||![...clases,...viaje,...propios].some(x=>dias.has(x[0])&&x[1]<b&&a<x[2]);
}
function semanaPena(cs){return SEMANA_ACTIVA&&(semanaValor('ida')>=60||semanaValor('vuelta')>=60)?new Set(semanaTraslados(cs).map(x=>x[0])).size*12:0}
function presupuestoSemana(cs){
  const horas={sueno:semanaValor('sueno')*7,clases:0,traslados:0,trabajo:0,otras:0,estudio:semanaValor('estudio'),libre:0},ocupado=new Set();
  // Unión de minutos: clases, traslados, trabajo y otras nunca descuentan el mismo minuto dos veces.
  const sumar=(k,bs)=>{for(const [d,a,b] of bs)for(let m=Math.max(0,Math.floor(a));m<Math.min(1440,Math.ceil(b));m++){
    const t=d*1440+m;if(!ocupado.has(t)){ocupado.add(t);horas[k]+=1/60}
  }};
  const propios=plan().own;
  sumar('clases',cs.flatMap(c=>c[6]||[]).concat(propios.filter(o=>o.saes).flatMap(o=>o.d.map(d=>[d,o.a,o.b]))));
  sumar('traslados',semanaTraslados(cs));
  for(const k of ['trabajo','otras'])sumar(k,propios.filter(o=>!o.saes&&!o.oculto&&(k==='trabajo'?o.tipo==='trabajo':o.tipo!=='trabajo')).flatMap(o=>o.d.map(d=>[d,o.a,o.b])));
  for(const o of propios)if(o.oculto&&!o.saes)horas[o.tipo==='trabajo'?'trabajo':'otras']+=horasPropia(o);
  if(!propios.some(o=>o.tipo==='trabajo'))horas.trabajo=semanaValor('trabajo');
  const total=Object.values(horas).reduce((a,b)=>a+b,0);horas.libre=Math.max(0,168-total);
  return {horas,total,disponible:168-total+horas.estudio,exceso:Math.max(0,total-168)};
}
/* ---------- actividades fijas propias: ficha, edición, eliminación con deshacer ---------- */
const horasPropia=o=>o.hs!=null?Number(o.hs)||0:(o.d||[]).length*(o.b-o.a)/60;
let OWN_UNDO=null,OWN_UNDO_T=null;
function validarPropia(v){
  if(!v.n)return txH('actividad_nombre');
  if(v.oculto&&v.hs!=null)return v.hs>0&&v.hs<=168?'':txH('semana_horas_invalidas');
  if(!v.d.length)return txH('actividad_dias');
  return v.b<=v.a?txH('actividad_horas'):'';
}
function guardarPropia(i,v){
  const o=plan().own[i];if(!o||o.saes)return '';
  const err=validarPropia(v);if(err)return err;
  const nuevo={...o,n:v.n,d:v.oculto&&v.hs!=null?[]:[...v.d].sort(),a:v.oculto&&v.hs!=null?0:v.a,b:v.oculto&&v.hs!=null?0:v.b};
  if(SEMANA_ACTIVA){nuevo.tipo=v.tipo;if(v.oculto)nuevo.oculto=true;else delete nuevo.oculto;if(v.oculto&&v.hs!=null)nuevo.hs=v.hs;else delete nuevo.hs}
  plan().own[i]=nuevo;
  if(nuevo.d.some(d=>d>=5)){S.weekend=true;store.set('weekend',true);$('#f-weekend').checked=true}
  refresh();return '';
}
function olvidarDeshacerPropia(){OWN_UNDO=null;clearTimeout(OWN_UNDO_T);$('#own-deshacer').hidden=true}
function eliminarPropia(i){
  const lista=plan().own,o=lista[i];if(!o)return;
  lista.splice(i,1);
  OWN_UNDO={plan:ws().plan,i,item:o};clearTimeout(OWN_UNDO_T);
  OWN_UNDO_T=setTimeout(olvidarDeshacerPropia,10000);
  $('#own-deshacer-txt').textContent=txH('semana_eliminada',{nombre:o.n});$('#own-deshacer').hidden=false;
  refresh();
}
function deshacerPropia(){
  const u=OWN_UNDO;if(!u)return;
  const pl=ws().plans[u.plan];olvidarDeshacerPropia();if(!pl)return;
  pl.own.splice(Math.min(u.i,pl.own.length),0,u.item);
  $('#own-deshacer-txt').textContent=txH('semana_restaurada',{nombre:u.item.n});$('#own-deshacer').hidden=false;
  OWN_UNDO_T=setTimeout(()=>{$('#own-deshacer').hidden=true},4000);
  refresh();
}
function confirmarEliminarPropia(i){
  const o=plan().own[i];if(!o)return;
  SateUI.modal(txH('semana_eliminar'),txH('semana_confirmar_eliminar',{nombre:o.n}),{pequeno:true,acciones:[
    {texto:txH('semana_eliminar'),primaria:true,onclick:()=>eliminarPropia(i)},{texto:txH('semana_cancelar')}]});
}
function abrirFichaPropia(i){
  const o=plan().own[i];if(!o||o.saes)return;
  let dias=[...(o.d||[])];const solo=!!o.oculto,conHoras=solo&&o.hs!=null;
  const f=document.createElement('form');f.className='semana-ficha';
  f.innerHTML=`<label class="field"><span>${esc(txH('semana_nombre'))}</span><input type="text" id="ficha-n" required></label>`+
    (SEMANA_ACTIVA?`<label class="field"><span>${esc(txH('semana_tipo'))}</span><select id="ficha-tipo"><option value="trabajo">${esc(txH('semana_trabajo_bloque'))}</option><option value="otras">${esc(txH('semana_otras'))}</option></select></label>`:'')+
    `<div class="field"><span>${esc(txH('semana_dias_ficha'))}</span><div class="daypick" id="ficha-dias"></div></div>`+
    `<label class="field"><span>${esc(txH('semana_de'))}</span><input type="time" id="ficha-a" step="1800"></label><label class="field"><span>${esc(txH('semana_a'))}</span><input type="time" id="ficha-b" step="1800"></label>`+
    (SEMANA_ACTIVA?`<label class="check"><input type="checkbox" id="ficha-mostrar"> ${esc(txH('semana_mostrar'))}</label><label class="field"><span>${esc(txH('semana_horas_semana'))}</span><input type="number" id="ficha-hs" min="0" max="168" step="0.5"></label>`:'')+
    `<p class="err" id="ficha-err" role="alert"></p>`;
  const q=s=>f.querySelector(s),pintar=()=>{q('#ficha-dias').innerHTML=DAYS.map((d,k)=>`<button type="button" class="chip" data-fd="${k}" aria-pressed="${dias.includes(k)}">${d}</button>`).join('')};
  const hhmm=m=>String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
  q('#ficha-n').value=o.n;
  q('#ficha-a').value=conHoras?'':hhmm(o.a);q('#ficha-b').value=conHoras?'':hhmm(o.b);
  if(SEMANA_ACTIVA){q('#ficha-tipo').value=o.tipo==='trabajo'?'trabajo':'otras';q('#ficha-mostrar').checked=!solo;q('#ficha-hs').value=conHoras?o.hs:''}
  pintar();
  q('#ficha-dias').addEventListener('click',e=>{const b=e.target.closest?.('[data-fd]');if(!b)return;const k=+b.dataset.fd;dias=dias.includes(k)?dias.filter(x=>x!==k):[...dias,k];pintar()});
  f.addEventListener('submit',e=>{e.preventDefault();guardar()});
  const leer=()=>{
    const oculto=SEMANA_ACTIVA&&!q('#ficha-mostrar').checked,hsTxt=SEMANA_ACTIVA?q('#ficha-hs').value:'';
    const hs=oculto&&hsTxt!==''?parseFloat(hsTxt):null;
    return {n:q('#ficha-n').value.trim(),tipo:SEMANA_ACTIVA?q('#ficha-tipo').value:o.tipo,d:dias,a:tmin(q('#ficha-a').value)??0,b:tmin(q('#ficha-b').value)??0,oculto,hs};
  };
  let m=null;
  const guardar=()=>{const err=guardarPropia(i,leer());if(err){q('#ficha-err').textContent=err;return}m?.cerrar()};
  m=SateUI.modal(txH('semana_ficha_titulo'),f,{acciones:[
    {texto:txH('semana_guardar'),primaria:true,cierra:false,onclick:guardar},
    {texto:txH('semana_eliminar'),cierra:false,onclick:()=>{m?.cerrar();eliminarPropia(i)}},
    {texto:txH('semana_cancelar')}]});
  return m;
}
function bloquePropioEvento(e){
  const b=e.target.closest?.('[data-own]');if(!b)return false;
  const i=+b.dataset.own;
  if(e.type==='click'||e.key==='Enter'||e.key===' '){e.preventDefault?.();abrirFichaPropia(i);return true}
  if(e.key==='Delete'||e.key==='Supr'){e.preventDefault?.();confirmarEliminarPropia(i);return true}
  return false;
}
function renderSemana(){
  if(!SEMANA_ACTIVA)return;
  resumenSemana();
  $('#semana-bloques').innerHTML=plan().own.map((o,i)=>o.saes?'':`<p class="semana-item"><b>${esc(o.n)}</b> · ${o.oculto&&o.hs!=null?'':o.d.map(d=>DAYS[d]).join(' ')+' '+hm(o.a)+'–'+hm(o.b)+' · '}${esc(txH('semana_lista_horas',{n:fmtCr(horasPropia(o))}))} · ${esc(txH(o.oculto?'semana_lista_oculta':'semana_lista_visible'))} <span class="semana-acc"><button type="button" class="btn" data-own-ed="${i}" aria-label="${esc(txH('semana_editar_nombre',{nombre:o.n}))}">${esc(txH('semana_editar'))}</button> <button type="button" class="btn" data-own-del="${i}" aria-label="${esc(txH('semana_eliminar_nombre',{nombre:o.n}))}">${esc(txH('semana_eliminar'))}</button></span></p>`).join('');
  const cs=selected(),presupuesto=$('#semana-presupuesto');
  presupuesto.hidden=!semanaCampos.some(([k])=>MS[k]!=null&&MS[k]!=='')&&!plan().own.length&&!cs.length;
  if(presupuesto.hidden){presupuesto.innerHTML='';return}
  const p=presupuestoSemana(cs),avisos=[];
  if(p.exceso>0.01)avisos.push(txH('semana_exceso',{n:fmtCr(p.exceso)}));
  if(p.disponible<p.horas.estudio)avisos.push(txH('semana_sin_estudio'));
  if(p.horas.trabajo>15&&p.horas.clases>=25)avisos.push(txH('semana_carga_aviso'));
  if(p.horas.traslados>10)avisos.push(txH('semana_traslado_aviso'));
  if(semanaValor('ida')>60&&cs.some(c=>c[6].some(b=>b[1]<480)))avisos.push(txH('semana_temprano_aviso'));
  if(!semanaOk(cs))avisos.push(txH('semana_conflicto'));
  if(cs.length&&!qualityOf(cs).comida)avisos.push(txH('semana_comida_aviso'));
  const partes=Object.entries(p.horas),cifra=([k,v])=>txH(`semana_categoria_${k}`)+': '+fmtCr(v)+' h';
  const descripcion=[['libre',p.horas.libre],...partes.filter(([k,v])=>k!=='libre'&&v>0)].map(cifra).join(' · ');
  presupuesto.innerHTML=`<p id="semana-presupuesto-titulo">${esc(txH('semana_presupuesto'))}</p><div class="semana-barra" role="img" aria-label="${esc(descripcion)}">${partes.map(([k,v],i)=>`<span class="semana-parte semana-parte-${i}" style="width:${v/168*100}%"></span>`).join('')}</div><p>${esc(descripcion)}</p>${avisos.map(t=>`<p>${esc(t)}</p>`).join('')}`;
  $('#semana-presupuesto-titulo').appendChild(SateUI.ayuda('sate.horarios.semana_supuestos'));
}
function renderGTime(){
  $('#g-from').value=GT.a;$('#g-to').value=GT.b;
  document.querySelectorAll('[data-gdays]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gdays===String(GT.days||''))));
  document.querySelectorAll('[data-gsrc]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gsrc===String(GT.src||''))));
  document.querySelectorAll('[data-gn]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.gn===String(GT.n||''))));
  $('#gbreaks').innerHTML=GT.breaks.map((b,i)=>`<div class="gbrk" data-brk="${i}">${esc(txH('descanso_al_menos'))}<select data-f="d" aria-label="${esc(txH('descanso_duracion'))}">${[30,60,90,120].map(m=>`<option value="${m}"${+b.d===m?' selected':''}>${({30:txH('minutos_30'),60:txH('hora_1'),90:txH('hora_media'),120:txH('horas_2')})[m]}</option>`).join('')}</select>${esc(txH('descanso_entre'))}<input type="time" step="1800" data-f="a" value="${b.a}" aria-label="${esc(txH('desde'))}"> ${esc(txH('y'))} <input type="time" step="1800" data-f="b" value="${b.b}" aria-label="${esc(txH('hasta'))}"><span class="brkdays" role="group" aria-label="${esc(txH('descanso_dias'))}"><button type="button" class="chip" data-bday="all" aria-pressed="${!(b.days||[]).length}">${esc(txH('todos_dias'))}</button>${DAYS.slice(0,6).map((n,d)=>`<button type="button" class="chip" data-bday="${d}" aria-pressed="${(b.days||[]).includes(d)}">${n}</button>`).join('')}</span><button type="button" class="x" data-unbrk="${i}" aria-label="${esc(txH('quitar_descanso'))}">×</button></div>`).join('')+
    `<button type="button" class="link" id="b-addbrk">${esc(txH('agregar_descanso'))}</button>`;
}
// ¿cada día con clases deja un hueco de al menos d minutos dentro de [a,b]?
function breaksOk(cs){
  const brk=GT.breaks.map(b=>({d:+b.d,a:tmin(b.a),b:tmin(b.b),days:b.days||[]})).filter(b=>b.a!=null&&b.b!=null&&b.b-b.a>=b.d);
  if(!brk.length) return true;
  const days=new Set(cs.flatMap(c=>c[6].map(x=>x[0])));
  for(const d of days){
    const busy=cs.flatMap(c=>c[6].filter(x=>x[0]===d).map(x=>[x[1],x[2]])).sort((x,y)=>x[0]-y[0]);
    for(const b of brk){if(b.days.length&&!b.days.includes(d))continue;  // descanso solo en ciertos días
      let t=b.a,gap=0;
      for(const [x,y] of busy){if(y<=b.a||x>=b.b)continue;gap=Math.max(gap,Math.max(b.a,x)-t);t=Math.max(t,Math.min(y,b.b))}
      gap=Math.max(gap,b.b-t);if(gap<b.d)return false}
  }
  return true;
}
function renderGPrefs(){
  $('#gprefs').innerHTML=S.gpref.map((p,i)=>`<span class="pill"><i>${esc(txH('priorizar'))}</i>${esc(p)}<button data-ungp="${i}" aria-label="${esc(txH('quitar',{nombre:p}))}">×</button></span>`).join('');
}
let generacion=null;
const GEN_MS=3000, GEN_NODOS=250000;
function presupuestoGenerador(dispositivo=typeof navigator==='undefined'?{}:navigator){
  const bajo=(dispositivo.hardwareConcurrency>0&&dispositivo.hardwareConcurrency<=4)||(dispositivo.deviceMemory>0&&dispositivo.deviceMemory<=4)||dispositivo.connection?.saveData;
  const alto=dispositivo.hardwareConcurrency>=8&&dispositivo.deviceMemory>=8;
  // Señales ausentes: conservar el presupuesto histórico; no adivinar la RAM.
  const medio=!bajo&&!alto&&(dispositivo.hardwareConcurrency>0||dispositivo.deviceMemory>0);
  return {clase:bajo?'baja':medio?'media':'alta',ms:GEN_MS,nodos:bajo?60000:medio?140000:GEN_NODOS};
}
function cancelarGeneracion(){
  if(!generacion)return;
  generacion.cancelada=true;generacion=null;
  $('#b-gen').textContent=txH('generar');$('#b-gen').disabled=false;
  $('#genres').removeAttribute('aria-busy');$('#gen-status').textContent='';
}
function* pasoGen(run){
  // También cuentan las ramas rechazadas por carga u optativas: antes escapaban del límite.
  if(++run.nodes%128===0)yield;
  const presupuesto=run.presupuesto||(run.presupuesto=presupuestoGenerador());
  if(run.nodes>presupuesto.nodos||performance.now()-run.start>=presupuesto.ms)run.limited=true;
}
async function iniciarGeneracion(){
  cancelarGeneracion();
  const run={start:performance.now(),nodes:0,limited:false,cancelada:false,presupuesto:presupuestoGenerador()};generacion=run;
  const medida=window.SateMedicion?.iniciar('generacion',GT.n==='auto'?'automatico':'todas');
  const boton=$('#b-gen');
  try{
    S.gen=null;renderGen();boton.disabled=false;boton.textContent=txH('generar_reiniciar');
    $('#genres').setAttribute('aria-busy','true');$('#gen-status').textContent=txH('generando');
    const iter=generarPasos(run);
    let next;
    do{
      await new Promise(resolve=>setTimeout(resolve,0));
      if(run.cancelada)return;
      // Varios pasos por cuadro reducen el coste de los temporizadores sin bloquear la interacción.
      const hasta=performance.now()+12;
      do{next=iter.next()}while(!next.done&&performance.now()<hasta);
    }while(!next.done);
    if(run.cancelada)return;
    S.gen=next.value;run.resultado=next.value;renderGen();
    $('#gen-status').textContent=S.gen.trunc?txH(run.limited&&run.presupuesto.clase==='baja'?'generador_limite_modesto':'generador_limite'):'';
    window.ENCUESTA?.marcar('gen');
  }catch(error){
    run.error=error.name;
    if(!run.cancelada){S.gen=null;$('#genres').innerHTML='';$('#b-gen-clear').hidden=true;$('#gen-status').textContent=txH('generador_error');
      console.error('Generador de horarios: fallo', {error,nodos:run.nodes,ms:performance.now()-run.start,periodo:S.per,carrera:S.car})}
  }finally{
    window.SateMedicion?.terminar(medida,{pasos:run.nodes,trunco:!!run.resultado?.trunc,cancelada:run.cancelada,error:run.error||null,opciones:run.resultado?.top?.length||0,presupuesto:run.presupuesto});
    if(generacion===run){generacion=null;boton.disabled=false;boton.textContent=txH('generar');$('#genres').removeAttribute('aria-busy')}
  }
}
// La API síncrona se conserva para las invariantes del motor; consume el mismo algoritmo.
function generate(materias,rescate=false){const iter=generarPasos({start:performance.now(),nodes:0,limited:false},materias,rescate);let r;do{r=iter.next()}while(!r.done);return r.value}
function* generarPasos(run,materias,rescate=false){
  // materias y grupos: los mismos que muestra la oferta con sus filtros (turno, nivel, búsqueda, materia, profesor, grupo,
  // «solo las elegidas», horario en la escuela, excluidos). «Solo lo que cabe» y la búsqueda de huecos no aplican aquí.
  const todo=Array.isArray(materias)||GT.src==='todo';   // Las alternativas abarcan los grupos de las materias del horario armado.
  const pool=todo?classes().filter(c=>c[0]===S.car):(()=>{const f=S.fit,g=S.gap;S.fit=false;S.gap=null;try{return filtered()}finally{S.fit=f;S.gap=g}})();
  let want=Array.isArray(materias)?materias.slice():todo?(tr().want.length?tr().want.slice():[...new Set(S.chips.filter(x=>x.t==='m').map(x=>classes().find(c=>c[4]===x.v)?.[8]).filter(Boolean))]):[...new Set(pool.map(c=>c[8]))];
  if(!todo&&!S.onlyWant&&!S.chips.some(x=>x.t==='m')&&tr().want.length){const w=new Set(tr().want);want=want.filter(k=>w.has(k))}   // sin filtro de materias: las elegidas
  // El rescate conserva exactamente las materias del horario, incluidas las inscritas.
  if(!rescate){tr().oblig.forEach(k=>{if(!want.includes(k))want.unshift(k)});
    const ya=new Set([...tr().done,...tr().curso]);want=want.filter(k=>!ya.has(k))}
  const marks=ws().marks, own=ownAsClasses();
  const pref=S.gpref.map(norm), avoid=S.gavoid.map(norm);
  const pscore=c=>c[5].reduce((s,i)=>s+(pref.some(p=>norm(DATA.prof[i]).includes(p))?4:0),0);
  const bad=c=>(typeof CUPOS!=='undefined'&&CUPOS.excluir(c))||marks[keyOf(c)]?.s==='no'||c[5].some(i=>avoid.some(p=>norm(DATA.prof[i]).includes(p)))||(S.gt!=='*'&&c[1]!==S.gt)||own.some(o=>overlaps(o,c))||outside(c);
  const ga=tmin(GT.a), gb=tmin(GT.b);
  function outside(c){return c[6].some(([d,a,b])=>(ga!=null&&a<ga)||(gb!=null&&b>gb))}
  const inPool=new Set(pool.map(keyOf));
  const subj=want.map(k=>{const all=classes().filter(c=>c[0]===S.car&&c[8]===k&&!bad(c)), f=all.filter(c=>inPool.has(keyOf(c)));
    return {k,must:tr().oblig.includes(k),opts:f.length||!tr().oblig.includes(k)?f:all}}).filter(s=>cur()[s.k]||s.opts.length);
  if(!subj.length) return {msg:txH('generador_vacio')};
  // optativas por nivel: una opción no lleva más optativas de un nivel que espacios libres tenga el plan en ese nivel
  const oq=optCupo(), oex=optExceso(subj.map(s=>s.k),oq);
  const conAviso=r=>{if(Object.keys(oex).length)r.optExceso=oex;return r};
  if(GT.n==='auto') return conAviso(yield* generateBank(subj,'auto',{marks,pscore,oq,run}));
  const N=+GT.n||0;
  if(N&&N<subj.length) return conAviso(yield* generateBank(subj,N,{marks,pscore,oq,run}));
  subj.sort((a,b)=>a.opts.length-b.opts.length);
  const res=[];let minDays=Infinity;const maxD=+GT.days||0;
  const pick=[];
  const score=()=>{
    const cs=pick.filter(Boolean);let s=cs.length*100;
    cs.forEach(c=>{const m=marks[keyOf(c)]?.s;s+=m==='si'?6:m==='quiza'?2:0;s+=pscore(c)});
    if($('#g-compact').checked){for(let d=0;d<6;d++){const b=cs.flatMap(c=>c[6].filter(x=>x[0]===d)).sort((x,y)=>x[1]-y[1]);if(b.length)s-=2;for(let i=1;i<b.length;i++)s-=Math.max(0,b[i][1]-b[i-1][2])/30}}
    return s-semanaPena(cs);
  };
  const rec=function*(i){
    yield* pasoGen(run);if(run.limited)return;
    if(i===subj.length){const cs=pick.filter(Boolean);if(!cs.length||!breaksOk(cs)||!semanaOk(cs))return;
      const nd=daysOf(cs).length;
      // mínimo de días posible llevando todas las materias que tienen grupos (antes de aplicar el límite)
      if(subj.every((x,j)=>pick[j]||!x.opts.length))minDays=Math.min(minDays,nd);
      if(maxD&&nd>maxD)return;
      res.push({cs:cs.slice(),s:score(),miss:subj.filter((x,j)=>!pick[j]).map(x=>x.k),days:daysOf(cs)});return}
    const nv=nivOpt(subj[i].k,oq), llena=nv&&pick.slice(0,i).filter((p,j)=>p&&nivOpt(subj[j].k,oq)===nv).length>=oq[nv].libre;   // espacio del nivel ya cubierto
    if(!llena)for(const c of subj[i].opts){yield* pasoGen(run);if(run.limited)break;if(pick.some(p=>p&&overlaps(p,c)))continue;pick[i]=c;yield* rec(i+1)}
    if(!run.limited&&(!subj[i].must||!subj[i].opts.length)){pick[i]=null;yield* rec(i+1)}   // una obligatoria con grupos no se puede omitir
  };
  yield* rec(0);
  const seen=new Set();
  const top=res.sort((a,b)=>b.s-a.s).filter(r=>{const k=r.cs.map(keyOf).sort().join();if(seen.has(k))return false;seen.add(k);return true}).slice(0,6);
  return conAviso({top,subj,trunc:run.limited,minDays:minDays===Infinity?null:minDays,maxD});
}
/* Banco de materias: horarios con exactamente N materias tomadas de las seleccionadas. Recorre subconjuntos en orden
   de prioridad (obligatoria por desfase siempre incluida; luego reprobadas, atrasadas, sugeridas y marcadas «Sí»),
   descarta los que exceden la carga permitida y, para cada subconjunto, busca la mejor combinación de grupos.
   Se muestran opciones con materias distintas (la mejor de cada subconjunto). */
/* Calidad de un horario (modo Automático). Criterios basados en recomendaciones sobre sueño, atención y descanso:
   permanencia diaria ≤ 8 h (ideal ≤ 6.5 h), a lo sumo 3 clases (4.5 h) seguidas, espacio de ≥ 1 h para comer entre
   12:00 y 16:30 si el día cruza el mediodía, pocas horas libres largas, evitar entrar a las 7:00 y salir después de las
   19:00 el mismo día, y repartir las clases entre los días. Devuelve {ok, pen, span, comida}. */
function qualityOf(cs){
  let pen=0, ok=true, span=0, comida=true;const per=[];
  for(let d=0;d<6;d++){
    const b=cs.flatMap(c=>c[6].filter(x=>x[0]===d)).sort((x,y)=>x[1]-y[1]);if(!b.length)continue;
    const a0=b[0][1], z=Math.max(...b.map(x=>x[2]));span=Math.max(span,z-a0);per.push(b.length);
    if(z-a0>480)ok=false; else if(z-a0>390)pen+=(z-a0-390)/30*2;
    let run=b[0][2]-b[0][1], meal=false;
    for(let i=1;i<b.length;i++){const g=b[i][1]-Math.max(...b.slice(0,i).map(x=>x[2]));
      if(g>=30){run=0;if(g>90)pen+=(g-90)/30*3;
        const ga=Math.max(...b.slice(0,i).map(x=>x[2])), gb=b[i][1];if(Math.min(gb,990)-Math.max(ga,720)>=60)meal=true}
      run+=b[i][2]-b[i][1];if(run>270)ok=false;else if(run>180)pen+=4}
    if(a0<780&&z>900&&!meal){ok=false;comida=false}
    if(a0<=420&&z>=1140)pen+=8;
  }
  if(per.length>1){const m=per.reduce((x,y)=>x+y,0)/per.length;pen+=per.reduce((x,y)=>x+(y-m)**2,0)/per.length*2}
  return {ok,pen,span,comida};
}
function* generateBank(subj,N,{marks,pscore,oq,run}){
  const auto=N==='auto';
  const maxD=+GT.days||0, ci=cargaInfo(0), failS=new Set(tr().fail), sugS=new Set(MARK.sug);
  const cost=k=>failS.has(k)?0:(cur()[k]?.[1]||0);
  const prio=k=>{const st=statusOf(k);return (st==='late fail'?50:st==='fail'?35:st.startsWith('late')||st.startsWith('prev')?20:0)+(sugS.has(k)?10:0)};
  // en Automático las reprobadas también son fijas: no suman créditos nuevos (ya están retenidos) y conviene acreditarlas pronto
  const fixed=x=>x.must||(auto&&statusOf(x.k).includes('fail'));
  const must=subj.filter(x=>fixed(x)&&x.opts.length), free=subj.filter(x=>!fixed(x)&&x.opts.length)
    .sort((a,b)=>prio(b.k)-prio(a.k)||a.opts.length-b.opts.length);
  const nuevosDe=set=>set.reduce((s,x)=>s+cost(x.k),0);
  // meta de créditos nuevos en modo Automático: carga media (con adeudos, sin rebasar lo permitido además de los retenidos)
  const meta=ci?(ci.adeudo?Math.max(0,Math.min(ci.L.media,ci.tope)-ci.ret):ci.L.media):40;
  const sizes=auto?[3,4,5,6,7,8].filter(n=>n>=must.length&&n<=must.length+free.length):[N];
  if(!sizes.length||sizes[0]-must.length<0) return {top:[],subj,bank:{N,M:subj.length},msg:null,trunc:false,minDays:null,maxD};
  const res=[];let subsets=0,trunc=false;const CAP=auto?160:400;
  const score=cs=>{let s=0;cs.forEach(c=>{const m=marks[keyOf(c)]?.s;s+=m==='si'?6:m==='quiza'?2:0;s+=pscore(c)+prio(c[8])});
    if($('#g-compact').checked){for(let d=0;d<6;d++){const b=cs.flatMap(c=>c[6].filter(x=>x[0]===d)).sort((x,y)=>x[1]-y[1]);if(b.length)s-=2;for(let i=1;i<b.length;i++)s-=Math.max(0,b[i][1]-b[i-1][2])/30}}
    return s-semanaPena(cs)};
  // mejor combinación de grupos para un subconjunto fijo de materias
  const bestFor=function*(set){const ord=set.slice().sort((a,b)=>a.opts.length-b.opts.length), pick=[];let best=null,nodes=0;
    const rec=function*(i){yield* pasoGen(run);if(run.limited)return;if(++nodes>4000){trunc=true;return}
      if(i===ord.length){if(!breaksOk(pick)||!semanaOk(pick))return;const days=daysOf(pick);if(maxD&&days.length>maxD)return;
        let s, q=null;
        if(auto){q=qualityOf(pick);if(!q.ok&&estricto)return;
          // la cantidad la decide la meta de créditos: la prioridad cuenta como promedio, no como suma
          const m=pick.reduce((t,c)=>{const mk=marks[keyOf(c)]?.s;return t+(mk==='si'?6:mk==='quiza'?2:0)+pscore(c)},0);
          s=m+pick.reduce((t,c)=>t+prio(c[8]),0)/pick.length*2-q.pen*4-(q.ok?0:200)-semanaPena(pick)}
        else s=score(pick);
        if(!best||s>best.s)best={cs:pick.slice(),s,days,miss:[],q};return}
      for(const c of ord[i].opts){yield* pasoGen(run);if(run.limited)break;if(pick.some(p=>overlaps(p,c)))continue;pick.push(c);yield* rec(i+1);pick.pop()}};
    yield* rec(0);return best};
  // subconjuntos de tamaño need en orden de prioridad (combinaciones lexicográficas sobre la lista ordenada)
  // si ninguna combinación cumple los criterios de un horario saludable (p. ej. por profesores excluidos), se muestran
  // las más cercanas en lugar de no mostrar nada
  let estricto=true;
  const chosen=[];let need=0;
  const walk=function*(start){yield* pasoGen(run);if(run.limited)return;if(subsets>=CAP){trunc=true;return}
    if(chosen.length===need){const set=[...must,...chosen], nuevos=nuevosDe(set);
      if(Object.keys(optExceso(set.map(x=>x.k),oq)).length)return;   // más optativas de un nivel que espacios libres
      if(ci&&ci.ret+nuevos>ci.tope+0.01)return;
      if(auto&&(nuevos>meta+7.5||(ci&&ci.ret+nuevos<ci.L.min-0.01&&set.length<must.length+free.length)))return;   // cerca de la meta y ${esc(txH('descanso_al_menos'))}la mínima
      subsets++;const b=yield* bestFor(set);if(b){if(auto)b.s-=(nuevos<meta?(meta-nuevos)*8:(nuevos-meta)*3);res.push(b)}return}
    for(let i=start;i<=free.length-(need-chosen.length);i++){chosen.push(free[i]);yield* walk(i+1);chosen.pop();if(run.limited)return;if(subsets>=CAP){trunc=true;return}}};
  for(const n of sizes){if(run.limited)break;need=n-must.length;subsets=0;yield* walk(0)}
  if(auto&&!res.length&&!run.limited){estricto=false;for(const n of sizes){if(run.limited)break;need=n-must.length;subsets=0;yield* walk(0)}}
  const top=res.sort((a,b)=>b.s-a.s).slice(0,6);
  const best=top.length?Math.max(...top.map(r=>nuevosDe(r.cs.map(c=>({k:c[8]}))))):0;
  return {top,subj,bank:{N,M:subj.length,tope:ci?.tope??null,auto,meta,best,relajado:auto&&!estricto&&top.length>0},trunc:trunc||run.limited,minDays:null,maxD};
}
function renderGen(){
  const g=S.gen;
  $('#b-gen-clear').hidden=!g?.top?.length;
  if(!g){$('#genres').innerHTML='';return}
  if(g.msg){$('#genres').innerHTML=`<p class="empty">${g.msg}</p>`;return}
  const dmsg=g.bank?.auto?`<p class="gdays-msg">${txH('generador_auto',{n:g.bank.M,meta:fmtCr(g.bank.meta),tope:g.bank.tope!=null?txH('generador_tope',{n:fmtCr(g.bank.tope)}):''})}</p>${g.bank.relajado?`<p class="gdays-msg warn">${esc(txH('generador_relajado'))}</p>`:''}${g.top.length&&g.bank.best<g.bank.meta-4.5?`<p class="gdays-msg warn">${txH('generador_carga_menor',{n:fmtCr(g.bank.best)})}</p>`:''}`:g.bank?`<p class="gdays-msg">${txH('generador_numero',{n:g.bank.N,total:g.bank.M,tope:g.bank.tope!=null?txH('generador_carga_tope',{n:fmtCr(g.bank.tope)}):''})}</p>`:g.minDays!=null?`<p class="gdays-msg${g.maxD&&g.minDays>g.maxD?' warn':''}">${txH('generador_dias',{n:g.minDays})}${g.maxD&&g.minDays>g.maxD?' '+esc(txH('generador_dias_imposible',{n:g.maxD})):g.maxD?' '+esc(txH('generador_dias_posible',{n:g.maxD})):''}</p>`:'';
  const oex=g.optExceso?Object.entries(g.optExceso).map(([v,x])=>x.libre<=0?txH('optativas_cubiertas',{n:x.total,nivel:v}):txH('optativas_libres',{n:x.libre,nivel:v,elegidas:x.n})):[];
  const oexMsg=oex.length?`<p class="gdays-msg warn">${esc(txH('optativas_aviso',{detalle:oex.join('; ')}))}</p>`:'';
  const none=g.subj.filter(s=>!s.opts.length).map(s=>s.k), mustNone=g.subj.filter(s=>s.must&&!s.opts.length).map(s=>s.k);
  const must=g.subj.filter(s=>s.must&&s.opts.length).map(s=>s.k);
  const omsg=(mustNone.length?`<p class="gdays-msg warn">${txH('obligatoria_sin_grupos',{nombre:mustNone.map(k=>esc(pretty(cur()[k][0]))).join(', ')})}</p>`:'')+
    (must.length?`<p class="gdays-msg">${txH('obligatoria_incluida',{nombre:must.map(k=>esc(pretty(cur()[k][0]))).join(', ')})}</p>`:'');
  if(!g.top.length){$('#genres').innerHTML=dmsg+omsg+oexMsg+`<p class="empty">${esc(txH(g.trunc?'generador_limite':'generador_sin_resultados'))}</p>`;return}
  $('#genres').innerHTML=dmsg+omsg+oexMsg+
    (none.length?`<small class="warn">${esc(txH('sin_grupos',{nombre:none.map(k=>cur()[k]?.[0]||k).join(', ')}))}</small>`:'')+
    g.top.map((r,i)=>{const cr=r.cs.reduce((s,c)=>s+c[7],0);
      return `<div class="gen"><div><b>${esc(txH('opcion',{n:i+1}))}</b> · ${esc(txH('cantidad_materias',{n:r.cs.length}))} · ${fmtCr(cr)} créditos · ${esc(txH('cantidad_dias',{n:r.days.length}))}: ${r.days.map(d=>DAYS[d]).join(' ')}${r.q?' · '+esc(txH('jornada_comida',{n:(r.q.span/60).toFixed(1).replace('.0','')})):''}${r.miss.length?` · <span class="warn">${esc(txH('sin_materias',{n:r.miss.length,nombre:r.miss.map(k=>pretty(cur()[k]?.[0]||k)).join(', ')}))}</span>`:''}<div class="ls">${r.cs.map(c=>`<span class="grp">${c[3]}</span> ${esc(pretty(name(c)))}`).join(' · ')}</div></div>
        <div class="acts"><button class="btn" data-useg="${i}" data-to="${ws().plan}">${esc(txH('usar',{version:ws().plan}))}</button><button class="btn" data-useg="${i}" data-to="+">${esc(txH('usar_nuevo'))}</button><button class="btn" data-peekg="${i}">${esc(txH('ver'))}</button></div></div>`}).join('')+
    (g.trunc?`<small>${esc(txH(g.bank?'busqueda_prioridad':'busqueda_limitada'))}</small>`:'');
}


function renderOffer(){
  if(typeof CUPOS!=='undefined')CUPOS.pintar();
  renderMasFiltros();
  if(S.onlyWant&&!tr().want.length){
    $('#offer-count').textContent='';
    $('#offer').innerHTML=`<div class="empty"><p>${esc(SATE.texto('sate.planeacion.oferta_vacia'))}</p><div class="actions"><button class="btn primary" type="button" data-oferta-mapa>${esc(SATE.texto('sate.planeacion.elegir_mapa'))}</button><button class="btn" type="button" data-oferta-toda>${esc(SATE.texto('sate.planeacion.oferta_toda'))}</button></div></div>`;return;
  }
  const list=filtered(), sel=selected();
  let html='';
  if(S.view==='materia'){
    const g=new Map();list.forEach(c=>{(g.get(c[4])||g.set(c[4],[]).get(c[4])).push(c)});
    const items=[...g.values()].sort((a,b)=>prio(a[0][8])-prio(b[0][8])||a[0][2]-b[0][2]||name(a[0]).localeCompare(name(b[0])));
    html=items.map(cs=>{cs.sort((a,b)=>a[3].localeCompare(b[3],'es',{numeric:true}));const c=cs[0];
      const st=cur()[c[8]]?statusOf(c[8]).split(' ')[0]:'';
      const fl=cur()[c[8]]&&statusOf(c[8]).includes('fail');
      const etiqueta=st==='late'?(fl?(['agotada','dictamen'].includes(reglaDesfase()?.por[c[8]])?'desfasada_dictamen':'desfasada_recursar'):'desfasada'):st==='fail'?'recursar':st==='now'?'semestre':st==='curso'?'curso':st==='done'?'acreditada':(isPersonal()&&cur()[c[8]]&&available(c[8]))?'disponible':'';
      const badge=etiqueta?`<span class="tag ${['late','fail'].includes(st)?'bad':st==='now'||etiqueta==='disponible'?'good':'soft'}">${esc(txH(etiqueta))}</span> `:'';
      return `<article class="subj"><header><h3>${badge}${esc(name(c))}</h3><span class="meta">${c[8]} · ${esc(textoCreditos(c[8],c[7],true))} ${ayudaCreditos(c[8])} · ${esc(txH('nivel',{n:c[2]}))}${c[9]&&c[9]!=='O'?' · '+TIPO[c[9]]:''}</span>${lineasDe(c[8]).length?`<span class="lineas">${lineasDe(c[8]).map(l=>`<span class="tag lin" title="${esc(txH('linea'))}">${esc(l)}</span>`).join('')}</span>`:''}</header>${(()=>{
        // con una opción marcada «Sí», la materia se colapsa a esa(s) opción(es) (y la que esté en el horario)
        const mk=ws().marks, keep=cs.filter(x=>mk[keyOf(x)]?.s==='si'||plan().sel.includes(keyOf(x)));
        const col=keep.length&&keep.some(x=>mk[keyOf(x)]?.s==='si')&&keep.length<cs.length, open=S.expand.has(c[4]);
        const rows=(col&&!open?keep:cs).map(x=>optRow(x,sel,false)).join('');
        return rows+(col?`<button type="button" class="link more" data-expand="${c[4]}">${esc(open?txH('solo_opcion'):txH('mas_opciones',{n:cs.length-keep.length}))}</button>`:'')})()}</article>`}).join('');
    $('#offer-count').textContent=txH('cuenta_materias',{n:g.size,opciones:list.length});
  }else{
    const g=new Map();list.forEach(c=>{(g.get(c[3])||g.set(c[3],[]).get(c[3])).push(c)});
    const gp=cs=>Math.min(...cs.map(c=>prio(c[8])));
    const items=[...g.entries()].sort((a,b)=>gp(a[1])-gp(b[1])||a[0].localeCompare(b[0],'es',{numeric:true}));
    html=items.map(([grp,cs])=>`<article class="subj"><header><h3 class="grp">${grp}</h3><span class="meta">${fmtCr(cs.reduce((s,c)=>s+c[7],0))} créditos ${ayudaCreditos()} <button class="link" data-group="${grp}">${esc(txH('agregar_grupo'))}</button></span></header>${cs.map(c=>optRow(c,sel,true)).join('')}</article>`).join('');
    $('#offer-count').textContent=txH('cuenta_grupos',{n:g.size,materias:list.length});
  }
  $('#offer').innerHTML=html||`<p class="empty">${esc(txH('oferta_sin_resultados'))}</p>`;
  montarAyudasCreditos();
}
/* horario inscrito (leído del SAES con el Lector): se carga en la versión seleccionada para exportarlo o compararlo */
function loadInscrito(){
  const H=(isPersonal()&&ALUMNO.horario_inscrito)||[];if(!H.length)return;
  const find=(per,g,k)=>(DATA.periodos[per]||[]).find(c=>c[0]===S.car&&c[3]===g&&c[8]===k);
  // periodo de la oferta con más coincidencias (grupo + clave)
  const per=['proximo','actual'].filter(hasOffer).sort((a,b)=>H.filter(h=>find(b,h[0],h[1])).length-H.filter(h=>find(a,h[0],h[1])).length)[0]||S.per;
  if(per!==S.per){S.per=per;store.set('per',per)}
  const pl=plan();pl.sel=[];pl.own=pl.own.filter(o=>!o.saes);let sinOferta=0;
  H.forEach(([g,k,n,pf,ses])=>{const c=find(per,g,k);if(c){pl.sel.push(keyOf(c));return}
    // sin coincidencia en la oferta capturada: se agrega con las horas del SAES
    sinOferta++;const by={};ses.forEach(([d,a,b])=>{(by[a+'-'+b]=by[a+'-'+b]||{a,b,d:[]}).d.push(d)});
    Object.values(by).forEach(x=>pl.own.push({n:`${pretty(n)} (${g})`,d:x.d.sort(),a:x.a,b:x.b,saes:true}))});
  render();
  $('#exp-msg').textContent=txH('inscrito_cargado',{version:ws().plan,periodo:txH(per==='proximo'?'periodo_proximo':'periodo_actual')})+
    (sinOferta?' '+txH('inscrito_sin_oferta',{n:sinOferta}):'');
}
function renderPlans(){
  $('#b-saeshor').hidden=!(isPersonal()&&ALUMNO.horario_inscrito?.length);
  const ids=planIds();
  $('#plans').innerHTML=`<span class="lbl" style="margin-right:4px">${esc(txH('version'))}</span>`+ids.map(p=>{const pl=ws().plans[p];const cr=pl.sel.map(byKey).filter(Boolean).reduce((s,c)=>s+c[7],0);
    return `<span class="plan-tab"><button class="chip" data-plan="${p}" aria-pressed="${ws().plan===p}">${esc(txH('horario',{version:p}))}<small>${pl.sel.length?fmtCr(cr)+' créditos':esc(txH('vacio'))}</small></button>${ids.length>1&&ws().plan===p?`<button class="x" data-delplan="${p}" aria-label="${esc(txH('eliminar_horario',{version:p}))}" title="${esc(txH('eliminar_horario',{version:p}))}">×</button>`:''}</span>`}).join('')+
    `<button class="chip plan-new" data-newplan="1" title="${esc(txH('nuevo_ayuda'))}">${esc(txH('nuevo'))}</button><button class="link" data-dup style="margin-left:8px">${esc(txH('duplicar',{version:ws().plan}))}</button>`;
}
function agendaHorario(items,soloLectura=false){const by={};items.forEach(b=>(by[b.d]=by[b.d]||[]).push(b));
  return Object.keys(by).length?Object.keys(by).sort((a,b)=>a-b).map(d=>`<section class="ag-day"><h4>${DAYN[d]}</h4>`+by[d].sort((x,y)=>x.a-y.a).map(b=>b.c.own?
      `<div class="ag-it own${b.clash?' clash':''}"${!soloLectura&&b.c.i!=null?` data-own="${b.c.i}" tabindex="0" role="button" aria-label="${esc(txH('semana_abrir_bloque',{nombre:b.c.n}))}"`:''}><span class="t">${hm(b.a)}–${hm(b.b)}</span><span><b>${esc(b.c.n)}</b><small>${esc(txH('actividad'))}${b.clash?' · '+esc(txH('traslape')):''}</small></span></div>`:
      `<div class="ag-it${b.clash?' clash':''}${b.ghost?' ghost':''}" style="--h:${hue(b.c)}"><span class="t">${hm(b.a)}–${hm(b.b)}</span><span><b>${esc(name(b.c))}</b><small>${b.c[3]}${roomAt(b.c,b.d,b.a)?' · '+esc(roomAt(b.c,b.d,b.a)):''} · ${esc(profs(b.c))}${b.ghost?' · '+esc(txH('vista_previa')):''}${b.clash?' · '+esc(txH('traslape')):''}</small>${typeof CUPOS!=='undefined'?CUPOS.insignia(b.c):''}</span></div>`).join('')+'</section>').join(''):
      `<p class="ag-empty">${esc(txH('horario_vacio'))}</p>`;
}
function renderCal(){
  if(typeof CUPOS!=='undefined')CUPOS.pintar();
  renderSemana();
  const sel=selected(), own=ownAsClasses();
  const ghost=S.hover&&!plan().sel.includes(S.hover)?byKey(S.hover):null;
  const viajes=SEMANA_ACTIVA?semanaTraslados(sel).map(([d,a,b])=>({own:true,n:txH('semana_categoria_traslados'),h:[[d,Math.max(0,a),Math.min(1440,b)]]})):[];
  const all=[...sel,...own,...viajes,...(ghost?[ghost]:[])];
  const reducida=document.documentElement.dataset.vista==='cupos';
  const items=SateUI.cuadriculaHorario(all,{S,slots,START,BLOCK,SLOT,SLOTPX,$,DAYS,hm,esc,txH,hue,keyOf,name,profs,roomAt,ghost,soloLectura:reducida,insignia:reducida?CUPOS.insignia:null});
  if(typeof CUPOS!=='undefined')for(const b of document.querySelectorAll('#cal .blk[data-k]')){const c=byKey(b.dataset.k);if(c)b.insertAdjacentHTML('beforeend',CUPOS.insignia(c))}
  const cv=reducida&&MQ_PHONE.matches?'dia':cview();document.querySelectorAll('[data-cview]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.cview===cv)));
  $('.calwrap').hidden=cv==='dia';$('#agenda').hidden=cv!=='dia';
  if(cv==='dia')$('#agenda').innerHTML=agendaHorario(items,reducida);
  const cr=sel.reduce((s,c)=>s+c[7],0);
  const mins=sel.reduce((s,c)=>s+c[6].reduce((t,b)=>t+b[2]-b[1],0),0);
  const both=[...sel,...own];let clashes=0;
  for(let i=0;i<both.length;i++)for(let j=i+1;j<both.length;j++)if(overlaps(both[i],both[j]))clashes++;
  const noSched=sel.filter(c=>!c[6].length).length;
  $('#stats').innerHTML=sel.length||own.length?`<span><b>${fmtCr(cr)}</b> ${esc(txH('creditos_horario'))} ${ayudaCreditos()}</span><span>${txH('materias_horario',{n:sel.length})}</span><span><b>${(mins/60).toFixed(1)}</b> ${esc(txH('horas_semana'))}</span>`+
    (clashes?`<span class="bad">${esc(txH('traslapes',{n:clashes}))}</span>`:`<span>${esc(txH('sin_traslapes'))}</span>`)+(noSched?`<span>${esc(txH('sin_horario',{n:noSched}))}</span>`:'')+
    (()=>{const have=new Set(sel.map(c=>c[8])),miss=tr().oblig.filter(k=>!have.has(k));return miss.length?`<span class="bad">${esc(txH('falta_obligatoria',{nombre:miss.map(k=>pretty(cur()[k][0])).join(', ')}))}</span>`:''})():
    `<span>${esc(txH('horario_inicio'))} ${esc(txH(tactil()?'previa_tactil':'previa_cursor'))}</span>`;
  const failS=new Set(tr().fail), ci=cargaInfo(sel.filter(c=>!failS.has(c[8])).reduce((s,c)=>s+c[7],0));
  if(ci&&(sel.length||ci.ret)){
    const L=ci.L, t=ci.total, top=Math.max(L.max,t,ci.tope)*1.05, pct=v=>Math.min(100,v/top*100);
    const tag=t<L.min?txH('carga_menor'):t>ci.tope+0.01?(ci.aut!=null||ci.regla?txH('carga_excede'):ci.adeudo?txH('carga_excede_media'):txH('carga_mayor')):t<=L.media?txH('carga_min_media'):txH('carga_media_max');
    const bad=t<L.min||t>ci.tope+0.01;
    $('#load').innerHTML=`<span class="lbl${bad?' bad':''}">${esc(txH('carga_total',{n:fmtCr(t),estado:tag}))}</span><div class="bar">${ci.ret?`<div class="fill ret" style="width:${pct(ci.ret)}%"></div>`:''}<div class="fill" style="left:${pct(ci.ret)}%;width:${Math.max(0,pct(t)-pct(ci.ret))}%"></div>${['min','media','max'].map(k=>`<div class="tick" style="left:${pct(L[k])}%"></div>`).join('')}${ci.tope!==L.max&&ci.tope!==L.media?`<div class="tick tope" style="left:${pct(ci.tope)}%"></div>`:''}</div>
      ${(()=>{   // etiquetas de la barra de carga: si dos quedan cerca, la segunda baja a otro renglón
        const et=[['min',txH('minima')],['media',txH('media')],['max',txH('maxima')]].map(([k,l])=>({p:pct(L[k]),t:`${l} ${L[k]}`,c:''}));
        if(ci.tope!==L.max&&ci.tope!==L.media)et.push({p:pct(ci.tope),t:txH('carga_autorizada',{n:fmtCr(ci.tope)}),c:'bad'});
        et.sort((x,y)=>x.p-y.p);let fila=0;et.forEach((e,i)=>{e.f=i&&e.p-et[i-1].p<14&&et[i-1].f===0?1:0});fila=Math.max(0,...et.map(e=>e.f));
        return `<div class="ticks${fila?' dos':''}">${et.map(e=>`<span class="${e.c}${e.f?' f2':''}" style="left:${e.p}%">${e.t}</span>`).join('')}</div>`})()}`+
      `<p class="load-note"><span>${esc(txH('carga_resumen',{n:fmtCr(t),max:fmtCr(ci.tope)}))}${ci.faltaMin?esc(txH('carga_falta',{f:fmtCr(ci.faltaMin)})):''}</span></p>`;
    if(ci.ret)$('#load .load-note').appendChild(SateUI.ayuda('sate.horarios.carga_ayuda',{ret:fmtCr(ci.ret),nuevos:fmtCr(ci.nuevos),libre:fmtCr(ci.libre),tope:fmtCr(ci.tope)}));
  }else $('#load').innerHTML='';
  $('#sel').hidden=!both.length;
  $('#sel').innerHTML=sel.map(c=>`<div><span class="sw" style="--h:${hue(c)}"></span><span class="grp">${c[3]}</span><span>${esc(pretty(name(c)))}<br><small>${esc(profs(c))}</small>${typeof CUPOS!=='undefined'?CUPOS.insignia(c):''}</span><span class="cr">${esc(textoCreditos(c[8],c[7]))} ${ayudaCreditos(c[8])}</span><button class="x" data-toggle="${keyOf(c)}" aria-label="${esc(txH('quitar',{nombre:name(c)}))}">×</button></div>`).join('')+
    own.map(o=>{const r=plan().own[o.i];return `<div><span class="sw own"></span><span class="grp">${esc(txH('extra'))}</span><span>${esc(o.n)}<br><small>${r.d.map(d=>DAYS[d]).join(' ')} ${hm(r.a)}–${hm(r.b)}</small></span><span></span><button class="x" data-unown="${o.i}" aria-label="${esc(txH('quitar',{nombre:o.n}))}">×</button></div>`}).join('');
  montarAyudasCreditos();
  window.SateCuposVista?.pintar();
}
function renderOwnForm(){$('#own-d').innerHTML=DAYS.map((d,i)=>`<button type="button" class="chip" data-oday="${i}" aria-pressed="${S.ownDays.includes(i)}">${d}</button>`).join('')}

/* Zoom del mapa con pellizco (dos dedos) y con el trackpad o Ctrl + rueda, centrado en el punto del gesto.
   Durante el pellizco solo se escala con CSS (instantáneo, sigue a los dedos); al soltar se redibuja una vez a la
   escala final. La respuesta es proporcional y amplificada (exponente GAIN): un pellizco amplio acerca mucho más que
   uno pequeño. Usa el mismo ZOOM que los botones +/−; desplazar con un dedo sigue siendo nativo. */

SATE.pestana('horarios',{montar(){montarSemana();drawCals();renderGTime()},mostrar(){renderHor()},ocultar(){cancelarGeneracion();if($('#horario-compacto').open)$('#horario-compacto').close();S.hover=null}});

$('#b-export').addEventListener('click', async () => {
  try { await SATE.script('exportacion.js'); abrirExportacion(); }
  catch (e) { SATE.error(e); }
});
