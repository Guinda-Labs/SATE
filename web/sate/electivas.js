/* Captura de Electivas: catálogo y cálculo compartidos; estampado oficial sin cambios. */
(function(raiz){
  const R=ElectivasReglas,CARN=R.CARN;
  const leer=k=>{try{return JSON.parse((window.IPNT?.almacen||localStorage).getItem(k)||'null')}catch{return null}};
  const nodo=(t,s,clase)=>{const n=document.createElement(t);if(s!=null)n.textContent=s;if(clase)n.className=clase;return n};
  const boton=(s,fn)=>{const b=nodo('button',s,'sate-btn');b.type='button';b.onclick=fn;return b};
  const compartidos=()=>leer('hu.tramite.datos');
  const identidad=()=>compartidos()?.confirmado?compartidos().datos:null;
  const carrera=()=>{const d=identidad();return Object.keys(CARN).find(k=>k===d?.carrera||R.norm(CARN[k])===R.norm(d?.carrera||''))};
  const alumno=()=>{const a=(window.SATE?.alumno?window.SATE.alumno():(()=>{try{return JSON.parse((window.IPNT?.almacen||localStorage).getItem('saes.alumno')||'null')}catch{return null}})());return a?.upiita_saes===1&&(a.unidad||SATE_CONFIG.unidadPredeterminada)===SATE_UNIDAD?a:null};
  let fuente,recursos,carga;
  async function preparar(){
    if(!carga)carga=(async()=>{
      await SATE.script('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
      await SATE.script('../tramites/pdf-comun.js');await SATE.script('../tramites/pdf-electivas.js');
      const r=await fetch('datos/'+SATE_UNIDAD+'/electivas.json');if(!r.ok)throw new Error('Electivas: HTTP '+r.status);
      recursos=await r.json();const doc=await PDFLib.PDFDocument.create();fuente=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    })().catch(e=>{carga=null;console.error('Electivas: carga fallida',{fase:'plantillas y fuente',error:e.name});throw e});
    return carga;
  }
  function inscrito(a=alumno(),periodo=raiz.SATE_DATA?.calendario?.periodo){
    if(!a)return '';
    if(a.en_curso?.length||a.horario_inscrito?.length)return 'si';
    const indice=p=>{const m=String(p||'').match(/^(?:20)?(\d{2})[\/-]?([12])$/);return m?+m[1]*2+(+m[2]-1):null};
    const actual=indice(periodo);if(actual==null)return '';
    const periodos=[...(a.acreditadas||[]).map(x=>x[2]),...(a.reprobadas_periodo||[]).map(x=>x[1])];
    return periodos.some(p=>{const i=indice(p);return i!=null&&i>=actual-1&&i<=actual})?'si':'';
  }
  function inicial(){return {actividades:[],formulario:{q1:'',q2:'',q3:'',q4:'',q5:inscrito(),confirmada:false,obs:''}}}
  function liberadas(){const a=alumno(),c=carrera();return a?.carrera===c?(a.acreditadas||[]).filter(x=>/^ELECTIVA/i.test(recursos?.curric[c+'|'+x[0]]?.[0]||'')).length:0}
  const totales=d=>R.REQ[carrera()]?R.totals({car:carrera(),acts:d.actividades,f:d.formulario},liberadas):null;
  const observacion=f=>String(f.obs||'').trim().replace(/\s+/g,' ');
  function medir(f){return fuente?PdfTramites.cabe(observacion(f),{font:fuente,ancho:450,size:8,max:4}):{renglones:[],max:4,ok:false}}
  function textoValido(v){try{fuente?.encodeText(String(v??''));return ''}catch{return 'Usa letras y signos que puedan imprimirse en el formato, sin emojis.'}}
  function validarActividad(a){
    const c=R.CATK[a.k];if(!c)return 'Elige una actividad del catálogo.';
    const malo=R.warnOf(a).find(x=>x[0]==='bad');if(malo)return malo[1];
    if(!String(a.desc||'').trim())return 'Escribe el nombre de la actividad o materia.';
    if(c.f.cc){if(![a.ht,a.hp].every(h=>h!==''&&Number.isFinite(+h)&&+h>=0)||+a.ht+(+a.hp)<=0)return 'Escribe las horas teóricas y prácticas por semana.'}
    else if(!Number.isFinite(+a.h)||+a.h<=0)return 'Escribe un número de horas mayor que cero.';
    if(!['constancia','boleta','oficio','otro'].includes(a.ev))return 'Elige la evidencia que entregarás.';
    if(c.f.die){
      const o=a.o||{};if(!o.car||!o.grupo?.trim()||!o.profesor?.trim()||!o.per?.trim()||!o.dep)return 'Completa el grupo, profesor, periodo y departamento de la materia.';
      if(c.f.die==='02'&&o.car!==carrera()||c.f.die==='01'&&o.car===carrera())return 'Elige la carrera que corresponde a esta actividad.';
      if(![3,4.5,6].includes(+o.horario))return 'Elige las horas semanales del horario.';
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.pmail||''))return 'Escribe el correo del profesor.';
      if(+a.h!==R.hourOpt(+o.horario).s)return 'Confirma el horario para actualizar las horas de la materia.';
    }
    for(const v of [...Object.values(a).filter(v=>typeof v!=='object'),...Object.values(a.o||{})]){const e=textoValido(v);if(e)return e}
    return '';
  }
  function validarActividades(acts){
    const d=identidad();if(!d)return 'Guarda tus datos aquí para continuar.';
    for(const k of ['paterno','nombres','boleta','carrera','plan','correo']){const e=SateTramites.validarDatos(k,d[k]||'',true);if(e)return e}
    if(!R.REQ[carrera()])return 'El catálogo vigente cubre Biónica, Mecatrónica y Telemática. Consulta tus créditos con Gestión Escolar.';
    if(!Array.isArray(acts)||!acts.length)return 'Agrega al menos una actividad.';
    for(const a of acts){const e=validarActividad(a);if(e)return e}return '';
  }
  const preguntas=[
    ['q1','¿Te quedaron créditos sobrantes de un trámite anterior?',[['sob','¿Cuántos créditos te quedaron?','number']]],
    ['q2','¿Ya cursaste una optativa como electiva sin registrarla en el SAES?',[['q2p','¿En qué periodos la cursaste?','text']]],
    ['q3','¿Cursaste electivas durante una movilidad académica?',[['q3n','¿Cuántas cursaste?','number'],['q3a','¿Cuántas aprobaste?','number'],['q3r','¿Cuántas reprobaste?','number'],['q3p','¿En qué periodo hiciste la movilidad?','text']]],
    ['q4','¿Ingresaste por cambio de plantel y tienes equivalencias?',[]],
    ['q5','¿Estuviste inscrito este semestre o el anterior?',[]]
  ];
  function validarFormulario(f){
    for(const [k,,campos] of preguntas){
      if(!['si','no'].includes(f[k]))return 'Responde las cinco preguntas.';
      if(f[k]==='si')for(const [id,,tipo] of campos){const v=f[id];if(v==null||String(v).trim()==='')return 'Completa la información de la respuesta Sí.';if(tipo==='number'&&(!Number.isFinite(+v)||+v<0||id!=='sob'&&!Number.isInteger(+v)))return 'Escribe una cantidad válida, sin números negativos.'}
    }
    if(f.q3==='si'&&+f.q3a+(+f.q3r)!==+f.q3n)return 'Las electivas aprobadas y reprobadas deben sumar las que cursaste.';
    if(!f.confirmada)return 'Confirma tu respuesta sobre la inscripción.';
    for(const v of Object.values(f)){const e=textoValido(v);if(e)return e}
    if(!medir(f).ok)return 'Acorta las observaciones: deben caber en cuatro renglones del formato.';return '';
  }
  function importar(viejo){
    const acts=Array.isArray(viejo?.acts)?viejo.acts.filter(a=>R.CATK[a.k]).map(a=>({...a})):[];
    // La página anterior guardaba la solicitud de materia por separado, incluso sin tarjeta.
    if(viejo?.o?.cls&&!acts.some(a=>R.CATK[a.k].f.die))acts.push({k:viejo.o.car===(carrera()||viejo.car)?'II.1.1.2':'I.1.1.1',desc:'',ev:'boleta'});
    for(const a of acts)if(R.CATK[a.k].f.die&&viejo.o?.cls){
      const row=recursos.oferta.find(r=>r[0]+'|'+r[2]+'|'+r[3]===viejo.o.cls);
      if(row){a.desc=row[3];a.o={...viejo.o,grupo:row[2],profesor:row[4],horario:R.hourOpt(row[5]).w};a.h=R.hourOpt(row[5]).s}
    }
    return {actividades:acts,formulario:{...inicial().formulario,...viejo?.f,confirmada:false}};
  }
  function campo(box,texto,valor,cambiar,{tipo='text',opciones,validar=textoValido}={}){
    const l=nodo('label',null,'tramite-campo'),n=nodo(opciones?'select':tipo==='textarea'?'textarea':'input'),error=nodo('small','');
    if(opciones)for(const [v,t] of opciones){const o=nodo('option',t);o.value=v;n.appendChild(o)}else if(tipo!=='textarea')n.type=tipo;
    n.value=valor??'';n.id='electivas-campo-'+(++campo.secuencia);error.id=n.id+'-error';error.setAttribute('aria-live','polite');n.setAttribute('aria-describedby',error.id);
    if(tipo==='number'){n.min=0;n.step='any'}
    n.oninput=()=>cambiar(n.value);n.onchange=()=>cambiar(n.value);
    n.onblur=()=>{cambiar(n.value);const e=validar(n.value);error.textContent=e;n.setAttribute('aria-invalid',String(!!e))};
    l.appendChild(nodo('span',texto));l.appendChild(n);l.appendChild(error);box.appendChild(l);return n;
  }
  campo.secuencia=0;
  function resumen(box,datos){const t=totales(datos);box.textContent=t?`${R.fmt(t.all)} de ${t.r.n*t.r.c} créditos de electivas · ${t.r.lib} electivas ya liberadas según tu SAES`:'Confirma tu carrera aquí para calcular los créditos.'}
  function actividades(box,ctx){
    const d=ctx.datos,acts=d.actividades;
    SateTramites.datosInline(box,()=>{ctx.cambiar();ctx.repintar()});
    const viejo=leer('ue.s');
    if(viejo&&!leer('hu.tramite.electivas.importacion')){
      const invitacion=nodo('section');invitacion.appendChild(nodo('p','Encontramos lo que llenaste en la página de Electivas. Importarlo reemplaza las actividades y respuestas de este borrador; tus datos anteriores se conservan.'));
      const decidir=usar=>{if(usar)Object.assign(d,importar(viejo));IPNT.set('hu.tramite.electivas.importacion',JSON.stringify({ofrecida:true}));ctx.cambiar();ctx.repintar()};
      invitacion.appendChild(boton('Importar lo que llenaste en Electivas',()=>decidir(true)));invitacion.appendChild(boton('Seguir sin importar',()=>decidir(false)));box.appendChild(invitacion);
    }
    const sum=nodo('p',null,'electivas-resumen');sum.setAttribute('aria-live','polite');box.appendChild(sum);resumen(sum,d);
    const resultados=nodo('div');const buscar=campo(box,'Busca una actividad por nombre o clave','',q=>{
      resultados.replaceChildren();for(const c of R.search(q))resultados.appendChild(elegir(c));
    });buscar.type='search';box.appendChild(resultados);
    const agregar=c=>{acts.push({k:c.k,desc:c.f.die?'':c.t,inst:'',folio:'',fecha:'',firma:'',h:'',ht:'',hp:'',ev:'constancia',o:c.f.die?{car:c.f.die==='02'?carrera():'',horario:'',grupo:'',profesor:'',pmail:'',per:'',dep:''}:undefined});ctx.cambiar();ctx.repintar()};
    const elegir=c=>{const b=boton(c.t+(c.f.off?' (ya no se acepta)':''),()=>agregar(c));b.disabled=!!c.f.off;if(c.f.off)b.title=c.cond;return b};
    for(const [e,t] of [...Object.entries(R.EJE),['CC','Cambio de carrera o plantel']]){const cat=nodo('details');cat.appendChild(nodo('summary',t));for(const c of R.CAT.filter(c=>c.eje===e))cat.appendChild(elegir(c));box.appendChild(cat)}
    acts.forEach((a,i)=>{
      const c=R.CATK[a.k],card=nodo('article',null,'electivas-actividad');card.appendChild(nodo('h4',c?.t||'Actividad pendiente'));
      if(!c){card.appendChild(boton('Quitar actividad',()=>{acts.splice(i,1);ctx.cambiar();ctx.repintar()}));box.appendChild(card);return}
      if(c.cond)card.appendChild(nodo('p',c.cond));
      const credito=nodo('p');credito.setAttribute('aria-live','polite');
      const calculo=()=>`${c.f.cc?R.fmt(+a.ht||0)+' + '+R.fmt(+a.hp||0)+' h por semana':R.fmt(R.hoursOf(a))+' h'} = ${R.fmt(R.credOf(a))} créditos${c.f.cap?' · tope de congresos: '+c.f.cap+' h':''}`;
      const actualizar=()=>{credito.textContent=calculo();resumen(sum,d);ctx.cambiar()};
      const editar=(k,v)=>{a[k]=v;actualizar()};
      campo(card,c.f.die?'Materia':'¿Cómo se llama tu actividad?',a.desc,v=>editar('desc',v),{validar:v=>!v.trim()?'Escribe el nombre.':c.f.noIngles&&/ingl[eé]s|english/i.test(v)?'Los cursos de inglés no cuentan porque forman parte del mapa curricular.':textoValido(v)});
      if(c.f.die)optativa(card,a,ctx,actualizar);
      else if(c.f.cc){for(const [k,t] of [['ht','¿Cuántas horas teóricas por semana?'],['hp','¿Cuántas horas prácticas por semana?']])campo(card,t,a[k],v=>editar(k,v),{tipo:'number',validar:v=>v!==''&&Number.isFinite(+v)&&+v>=0?'':'Escribe un número mayor o igual a cero.'})}
      else campo(card,'¿Cuántas horas dice tu constancia?',a.h,v=>editar('h',v),{tipo:'number',validar:v=>Number.isFinite(+v)&&+v>0?'':'Escribe un número mayor que cero.'});
      for(const [k,t] of [['inst','¿Qué institución la emitió?'],['folio','Folio (si tiene)'],['fecha','Fecha de la constancia'],['firma','¿Quién la firma?']])campo(card,t,a[k],v=>editar(k,v));
      const chips=nodo('div',null,'tramite-chips');chips.setAttribute('role','group');chips.setAttribute('aria-label','Evidencia que entregarás para esta actividad');
      for(const [ev,t] of [['constancia','Constancia'],['boleta','Boleta'],['oficio','Oficio'],['otro','Otro']]){
        const b=boton(t,()=>{a.ev=ev;for(const n of chips.children)n.setAttribute('aria-pressed',String(n===b));actualizar()});b.setAttribute('aria-pressed',String(a.ev===ev));chips.appendChild(b);
      }
      card.appendChild(nodo('p','Elige la evidencia que entregarás.'));card.appendChild(chips);card.appendChild(nodo('small','Evidencia requerida: '+c.ev));
      card.appendChild(credito);
      card.appendChild(boton('Quitar actividad',()=>{acts.splice(i,1);ctx.cambiar();ctx.repintar()}));box.appendChild(card);
      credito.textContent=calculo();
    });
  }
  function optativa(card,a,ctx,actualizar){
    const c=R.CATK[a.k],o=a.o||={};
    const editar=(k,v)=>{o[k]=v;if(k==='horario'&&v)a.h=R.hourOpt(+v).s;actualizar()};
    campo(card,'Carrera de la materia',o.car,v=>{editar('car',v);ctx.repintar()},{opciones:[['','Elige la carrera'],...Object.entries(CARN).filter(([k])=>c.f.die==='02'?k===carrera():k!==carrera())]});
    const lista=recursos.oferta.filter(r=>r[0]===o.car&&(c.f.die!=='02'||r[7]==='P'||/ELEGIBLE|OPTATIVA/i.test(r[3])));
    campo(card,'Puedes elegir una materia y grupo de la oferta',o.cls,v=>{
      const r=lista.find(r=>r[0]+'|'+r[2]+'|'+r[3]===v);if(!r)return;
      Object.assign(o,{cls:v,grupo:r[2],profesor:r[4],horario:R.hourOpt(r[5]).w});a.desc=r[3];a.h=R.hourOpt(r[5]).s;actualizar();ctx.repintar();
    },{opciones:[['','Elige o escribe los datos abajo'],...lista.map(r=>[r[0]+'|'+r[2]+'|'+r[3],r[3]+' · '+r[2]])]});
    for(const [k,t] of [['grupo','Grupo'],['profesor','Profesor que reportará la calificación'],['pmail','Correo del profesor'],['per','Periodo en que cursaste o cursarás la materia']])campo(card,t,o[k],v=>editar(k,v),{tipo:k==='pmail'?'email':'text',validar:v=>!v.trim()?'Completa este dato.':k==='pmail'?SateTramites.validarDatos('correo',v,true):textoValido(v)});
    campo(card,'Horario: horas semanales',o.horario,v=>editar('horario',v),{opciones:[['','Elige las horas'],['3','3 horas por semana'],['4.5','4.5 horas por semana'],['6','6 horas por semana (o más)']]});
    campo(card,'Departamento responsable',o.dep,v=>editar('dep',v),{opciones:[['','Elige el departamento'],['TA','Tecnologías Avanzadas'],['ING','Ingeniería'],['CB','Ciencias Básicas'],['FII','Formación Integral e Institucional']]});
  }
  function formulario(box,ctx){
    const f=ctx.datos.formulario;
    box.appendChild(boton('Ninguna de las primeras cuatro me aplica',()=>{for(const [k] of preguntas.slice(0,4))f[k]='no';ctx.cambiar();ctx.repintar()}));
    for(const [k,t,seguimiento] of preguntas){
      const seccion=nodo('section');seccion.appendChild(nodo('h4',t));
      const opciones=nodo('div',null,'tramite-chips');opciones.setAttribute('role','group');opciones.setAttribute('aria-label',t);
      for(const [v,s] of [['si','Sí'],['no','No']]){const b=boton(s,()=>{f[k]=v;if(k==='q5')f.confirmada=false;ctx.cambiar();ctx.repintar()});b.setAttribute('aria-pressed',String(f[k]===v));opciones.appendChild(b)}seccion.appendChild(opciones);
      if(f[k]==='si')for(const [id,t,tipo] of seguimiento)campo(seccion,t,f[id],v=>{f[id]=v;ctx.cambiar()},{tipo,validar:v=>!v.trim()?'Completa esta respuesta.':tipo==='number'&&(!Number.isFinite(+v)||+v<0)?'Escribe una cantidad válida.':textoValido(v)});
      if(k==='q5'){
        if(inscrito())seccion.appendChild(nodo('small','Tu SAES muestra inscripción reciente. Confirma si esta respuesta sigue siendo correcta.'));
        seccion.appendChild(boton(f.confirmada?'Respuesta confirmada':'Confirmar mi respuesta',()=>{if(['si','no'].includes(f.q5)){f.confirmada=true;ctx.cambiar();ctx.repintar()}}));
        if(f.q5==='no'){seccion.appendChild(nodo('p','Necesitas un dictamen que autorice la liberación de electivas.'));const enlace=nodo('a','Ir al trámite de dictamen');enlace.href='#/'+SATE_UNIDAD+'/tramites/dictamen';seccion.appendChild(enlace)}
      }box.appendChild(seccion);
    }
    const contador=nodo('p');contador.setAttribute('aria-live','polite');
    const contar=()=>{const r=medir(f);contador.textContent=`${observacion(f)?r.renglones.length:0} de ${r.max} renglones del formato${r.ok?'':' · Acorta el texto para que quepa.'}`};
    campo(box,'Observaciones (opcional)',f.obs,v=>{f.obs=v;contar();ctx.cambiar()},{tipo:'textarea',validar:()=>validarObservaciones(f)});box.appendChild(contador);contar();
  }
  function validarObservaciones(f){return textoValido(f.obs)||(!medir(f).ok?'Acorta el texto a cuatro renglones.':'')}
  function revisionActividades(acts){
    const d=identidad()||{},filas=Object.entries({Nombre:[d.nombres,d.paterno,d.materno].filter(Boolean).join(' '),Boleta:d.boleta,Carrera:CARN[carrera()]||d.carrera,Plan:d.plan,Correo:d.correo}).map(([texto,valor])=>({texto,valor:valor||''}));
    acts.forEach((a,i)=>{const c=R.CATK[a.k];filas.push({texto:'Actividad '+(i+1),valor:a.desc+' · '+R.fmt(R.credOf(a))+' créditos'});for(const [k,t] of [['inst','Institución'],['folio','Folio'],['fecha','Fecha'],['firma','Firma'],['h','Horas'],['ht','Horas teóricas'],['hp','Horas prácticas'],['ev','Evidencia']])if(a[k])filas.push({texto:t,valor:String(a[k])});if(c?.f.die)for(const [k,t] of [['car','Carrera de la materia'],['grupo','Grupo'],['horario','Horas semanales'],['profesor','Profesor'],['pmail','Correo del profesor'],['per','Periodo'],['dep','Departamento']])filas.push({texto:t,valor:k==='car'?CARN[a.o[k]]:k==='dep'?{TA:'Tecnologías Avanzadas',ING:'Ingeniería',CB:'Ciencias Básicas',FII:'Formación Integral e Institucional'}[a.o[k]]:String(a.o[k]||'')})});return filas;
  }
  function revisionFormulario(f,d){const filas=[];for(const [k,t,campos] of preguntas){filas.push({texto:t,valor:f[k]==='si'?'Sí':'No'});if(f[k]==='si')for(const [id,t] of campos)filas.push({texto:t,valor:String(f[id]||'0')})}filas.push({texto:'Observaciones',valor:f.obs||'Sin observaciones'});const t=totales(d);if(t)filas.push({texto:'Créditos de electivas',valor:R.fmt(t.all)+' de '+t.r.n*t.r.c});return filas}
  async function generar(d){
    await preparar();const error=validarActividades(d.actividades)||validarFormulario(d.formulario);if(error)throw new Error(error);
    const id=identidad(),estado={car:carrera(),d:{ap:[id.paterno,id.materno].filter(Boolean).join(' '),no:id.nombres,bo:id.boleta,co:id.correo},acts:d.actividades,f:{...d.formulario,obs:observacion(d.formulario)}};
    const base={estado,pdfs:recursos.pdfs,oferta:recursos.oferta,catalogo:R.CATK,actividades:d.actividades,fecha:new Date().toISOString()};
    const pdfs=[await PdfElectivas.generar({...base,tipo:'die03'})];
    for(const a of d.actividades.filter(a=>R.CATK[a.k].f.die)){
      const o=a.o,row=[o.car,'',o.grupo,a.desc,o.profesor,+o.horario,'','P'],cls=o.car+'|'+o.grupo+'|'+a.desc;
      pdfs.push(await PdfElectivas.generar({...base,tipo:'optativa',estado:{...estado,o:{...o,cls}},oferta:[row]}));
    }
    return PdfTramites.unir(pdfs);
  }
  const def={id:'electivas',titulo:'Tus electivas',datos:inicial,preparar,descargaTexto:'Descargar mi solicitud (PDF)',archivo:()=>`electivas-${identidad()?.boleta}.pdf`,generar,pasos:[
    {titulo:'Tus actividades',campos:[{id:'actividades',texto:'Actividades',render:actividades,validar:validarActividades,revision:revisionActividades}]},
    {titulo:'Preguntas del formulario',campos:[{id:'formulario',texto:'Formulario',render:formulario,validar:validarFormulario,revision:revisionFormulario}]}
  ]};
  SateTramites.registrar(def);
  raiz.SateElectivas={preparar,inscrito,inicial,importar,validarActividad,validarActividades,validarFormulario,medir,totales,generar,def};
})(globalThis);
