/* Captura de Dictamen; el estampado oficial pertenece exclusivamente a PdfDictamen. */
(function(raiz){
  const el=(tag,texto)=>{const n=document.createElement(tag);if(texto!=null)n.textContent=texto;return n};
  const leer=k=>{try{return JSON.parse((window.IPNT?.almacen||localStorage).getItem(k)||'null')}catch{return null}};
  const periodo=p=>{const m=String(p||'').match(/^(?:20)?(\d{2})\/?([12])$/);return m?m[1]+'/'+m[2]:''};
  // Todo texto visible sale de contenido/textos/es.toml (sección [dictamen]).
  const tx=(k,v={})=>((typeof SATE_DATA!=='undefined'?SATE_DATA.dictamen?.textos:null)?.['dictamen.'+k]||k).replace(/\{(\w+)\}/g,(_,n)=>v[n]??'');
  // Los anexos viven solo en memoria de esta página: nunca en localStorage, en la nube ni en un servidor.
  const memoria=new Map(),LIMITE={cantidad:10,archivoMb:15,totalMb:40};let consecutivo=0;
  function sugerir(s){
    if(s?.riesgoBajaDefinitiva||s?.revocacion)return {tipo:'externo',motivo:tx('sugerencia_externo')};
    if(s?.nDes)return {tipo:'interno',motivo:tx('sugerencia_interno')};
    return {tipo:'',motivo:tx('sugerencia_ninguna')};
  }
  function pendientes(a,catalogo,situacion){
    const delNucleo=Array.isArray(situacion?.adeudos),aprobadas=new Set(delNucleo?[]:(a.acreditadas||[]).filter(r=>+r[1]>=6&&+r[1]<=10).map(r=>r[0])),filas=new Map();
    const plan=String(a.plan||'').replace(/^20(\d{2})$/,'$1').replace(/^1998$/,'98');
    // En la página real el núcleo ya resuelve nombres, acreditación y simulación.
    const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
    const antiguas=delNucleo?[]:Object.entries(catalogo).filter(([k,[n]])=>k.startsWith(`${a.carrera}|${plan}|`)&&(a.reprobadas||[]).some(r=>norm(r[0])===norm(n))).map(([k])=>[k.split('|')[2]]);
    const fuentes=delNucleo?situacion.adeudos.map(k=>[k]):[...a.reprobadas_periodo||[],...a.desfasadas_saes||[],...a.kardex_reprobadas||[],...antiguas];
    for(const r of fuentes){
      if(!r||aprobadas.has(r[0]))continue;
      // Sin plan en los datos (p. ej. el perfil de demostración) se usa la clave de la carrera si es única.
      const llave=`${a.carrera}|${plan}|${r[0]}`,alternas=plan?[]:Object.keys(catalogo).filter(k=>k.startsWith(`${a.carrera}|`)&&k.endsWith(`|${r[0]}`));
      const [nombre,nivel]=catalogo[llave]||(alternas.length===1?catalogo[alternas[0]]:null)||[];
      if(!nombre)continue;
      const hist=[...new Set([...(a.kardex_reprobadas||[]).filter(h=>h[0]===r[0]).map(h=>periodo(h[2])),...[...a.reprobadas_periodo||[],...a.desfasadas_saes||[]].filter(h=>h[0]===r[0]).map(h=>periodo(h[1]))].filter(Boolean))].sort();
      filas.set(r[0],{clave:r[0],nombre,nivel,cursada:hist[0]||'',recursada:hist.slice(1).join(', ')});
    }
    return [...filas.values()];
  }
  function ingreso(a){return [...new Set([...(a.acreditadas||[]).map(r=>periodo(r[2])),...(a.kardex_reprobadas||[]).map(r=>periodo(r[2])),...(a.reprobadas_periodo||[]).map(r=>periodo(r[1]))].filter(Boolean))].sort()[0]||''}
  function carta(d){
    const compromiso=String(d.compromiso||'').trim();
    return ['Por medio de la presente expongo los motivos de mi solicitud de dictamen.',String(d.paso||'').trim(),String(d.acciones||'').trim(),compromiso?(/^Me comprometo\b/i.test(compromiso)?compromiso:'Me comprometo a '+compromiso):''].filter(Boolean).join('\n\n');
  }
  // La petición propuesta se arma con las materias y los periodos reales del kárdex; sin materias no hay texto.
  const enumerar=l=>l.length>1?l.slice(0,-1).join(', ')+' '+tx('pet_y')+' '+l.at(-1):l[0]||'';
  const detalle=(r,conPeriodos)=>{const p=conPeriodos?[r.cursada&&tx('pet_cursada',{periodo:r.cursada}),r.recursada&&tx('pet_recursada',{periodo:r.recursada})].filter(Boolean):[];return r.nombre+(p.length?` (${p.join('; ')})`:'')};
  function plantilla(tipo,periodo,filas,opcion='inscribir',conPeriodos=true){
    if(!filas?.length)return '';
    const nombres=filas.map(r=>detalle(r,conPeriodos)),unidades=tx(nombres.length===1?'pet_una':'pet_varias',{lista:enumerar(nombres)});
    if(opcion==='tiempo')return tx('pet_tiempo',{unidades});
    return tx(tipo==='externo'?'pet_externo':'pet_inscribir',{periodo,unidades});
  }
  let carga,font;
  async function cargar(){
    if(!carga)carga=(async()=>{
      await SATE.script('https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js');
      await SATE.script('../tramites/pdf-comun.js');await SATE.script('../tramites/pdf-dictamen.js');
      const doc=await PDFLib.PDFDocument.create();font=await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    })().catch(e=>{carga=null;console.error('Dictamen: carga de PDF fallida',{etapa:'biblioteca',error:e.name});throw e});
    return carga;
  }
  function medir(texto,tipo){return PdfTramites.cabe(texto,{font,ancho:tipo==='externo'?491:514,size:tipo==='externo'?7:10,max:tipo==='externo'?4:5})}
  // Si el texto con periodos no cabe en el recuadro del formato, se propone sin ellos.
  function propuesta(d,opcion='inscribir'){
    const t=plantilla(d.tipo,d.periodo,d.filas,opcion);
    return t&&font&&!medir(t,d.tipo).ok?plantilla(d.tipo,d.periodo,d.filas,opcion,false):t;
  }
  function opciones(id,texto,items,{multiple=false,sensible=false,visible,requerido=false,ayuda}={}){
    return {id,texto,sensible,visible,requerido,resumen:v=>(Array.isArray(v)?v:[v]).map(k=>items.find(i=>i[0]===k)?.[1]||'').filter(Boolean).join(', '),
      pintar(box,ctx){
        const f=el('fieldset');f.className='dictamen-opciones'+(id==='tipo'?' dictamen-tipos':'');f.appendChild(el('legend',texto));if(ayuda)f.appendChild(el('p',ayuda));
        items.forEach(([valor,etiqueta,ayudaOpcion])=>{const l=el('label'),n=el('input');n.type=multiple?'checkbox':'radio';n.name='dictamen-'+id;n.value=valor;n.checked=multiple?(ctx.datos[id]||[]).includes(valor):ctx.datos[id]===valor;
          n.onchange=()=>{const actual=ctx.datos[id]||[];ctx.cambiar(multiple?(n.checked?[...actual,valor]:actual.filter(k=>k!==valor)):valor,!multiple)};
          l.appendChild(n);const contenido=el('span',etiqueta);if(ayudaOpcion){contenido.appendChild(el('br'));contenido.appendChild(el('small',ayudaOpcion))}l.appendChild(contenido);f.appendChild(l)});box.appendChild(f);
      }};
  }
  function definir(){
    const base=SATE_DATA.dictamen,a=(window.SATE?.alumno?window.SATE.alumno():(()=>{try{return JSON.parse((window.IPNT?.almacen||localStorage).getItem('saes.alumno')||'null')}catch{return null}})()),alumno=a?.upiita_saes===1&&(a.unidad||SATE_CONFIG.unidadPredeterminada)===SATE_UNIDAD?a:{};
    const compartido=()=>{const v=leer('hu.tramite.datos');return v?.confirmado?v.datos:null};
    const datos=compartido()||{},catalogo=base.materias;
    const carrera=Object.entries(SATE_DATA.carreras||{}).find(([k,n])=>k===datos.carrera||n===datos.carrera)?.[0]||alumno.carrera;
    const plan=String(datos.plan||alumno.plan||'').replace(/^20(\d{2})$/,'$1').replace(/^1998$/,'98');
    const materias=Object.entries(catalogo).filter(([k])=>k.startsWith(`${carrera}|${plan}|`)).map(([k,[nombre,nivel]])=>({clave:k.split('|')[2],nombre,nivel,cursada:'',recursada:''}));
    const situacion=typeof situacionDatos==='function'?situacionDatos():null,pre=pendientes(alumno,catalogo,situacion),sugerencia=sugerir(situacion);
    let inicializado=false;
    const interno=d=>d.tipo==='interno',externo=d=>d.tipo==='externo';
    const texto=tx;
    const camposSituacion=[
      opciones('anteriores','¿Has tenido dictámenes antes?',[['Sí','Sí'],['No','No']],{visible:interno,requerido:true}),
      {id:'oficios',texto:'Número(s) de oficio',visible:d=>interno(d)&&d.anteriores==='Sí',requerido:true},
      {id:'ingreso',texto:'Ciclo de ingreso al IPN',visible:interno,requerido:true,ayuda:'Confírmalo: es el primer periodo de tu kárdex',validar:v=>!periodo(v)?'Escribe el ciclo como YY/P, por ejemplo 24/1.':''},
      ...[['nacimiento','Fecha de nacimiento','date'],['civil','Estado civil'],['domicilio','Domicilio'],['ingreso_ext','Ciclo de ingreso al nivel superior'],['ultimo','Último semestre inscrito'],['dictamen_fecha','Fecha del último dictamen','date'],['otras_situacion','Otra situación escolar'],['otras_causas','Otra causa']].map(([id,texto,tipo])=>({id,texto,tipo,sensible:true,visible:externo})),
      opciones('organo','¿Quién emitió tu último dictamen?',[['ctce','Comisión de Situación Escolar de tu unidad'],['cgc','Consejo General Consultivo']],{sensible:true,visible:externo}),
      opciones('situacion','Situación escolar actual',[['s1','Tengo materias desfasadas'],['s2','No solicité reinscripción el periodo anterior'],['s3','Solicito reconocer calificaciones aprobadas'],['s4','Necesito más tiempo para concluir mis estudios'],['s5','No cumplí un dictamen anterior'],['s6','Otra situación']],{multiple:true,sensible:true,visible:externo}),
      opciones('causas','¿Qué causó esta situación?',[['salud','Salud'],['economica','Dificultades económicas'],['familiar','Situación familiar'],['legal','Situación legal'],['laboral','Trabajo'],['administrativa','Trámites administrativos'],['otras','Otra causa']],{multiple:true,sensible:true,visible:externo}),
      ...[['dependientes','¿Tu pareja depende económicamente de ti?'],['hijos','¿Tienes hijos menores que dependan de ti?']].map(([id,t])=>opciones(id,t,[['si','Sí'],['no','No'],['no_contestar','Prefiero no contestar']],{sensible:true,visible:externo})),
      opciones('embarazo','Embarazo',[['propio','Estoy embarazada'],['pareja','Mi pareja está embarazada'],['no_contestar','Prefiero no contestar']],{sensible:true,visible:externo}),
      opciones('anexos','Documentos que anexas',[['boleta_global','Boleta global'],['probatorios','Documentos que respaldan mis motivos'],['carta_anexo','Carta de motivos'],['otros_anexos','Otros documentos'],['dictamenes','Dictámenes anteriores'],['bajas','Documentos de baja']],{multiple:true,sensible:true,visible:externo})
    ];
    const tipo={id:'tipo',texto:tx('tipo_leyenda'),requerido:true,resumen:v=>v?tx('tipo_'+v):'',
      pintar(box,ctx){
        const f=el('fieldset');f.className='dictamen-opciones dictamen-tipos';f.appendChild(el('legend',tx('tipo_leyenda')));
        f.appendChild(el('p',sugerencia.motivo+' '+tx('tipo_duda')));
        for(const k of ['interno','externo']){
          const grupo=el('div'),l=el('label'),n=el('input'),texto=el('span');grupo.className='dictamen-tipo';
          n.type='radio';n.name='dictamen-tipo';n.value=k;n.checked=ctx.datos.tipo===k;n.onchange=()=>ctx.cambiar(k,true);
          texto.appendChild(el('strong',tx('tipo_'+k)));texto.appendChild(el('br'));texto.appendChild(el('small',tx('tipo_'+k+'_para')));
          l.appendChild(n);l.appendChild(texto);grupo.appendChild(l);
          const ul=el('ul');ul.className='dictamen-situaciones';
          for(const m of base.motivos[k]){
            const li=el('li'),a=el('a',tx('fundamento'));li.appendChild(el('span',tx('motivo_'+m.id)));
            const fund=el('small',tx('fund_'+m.id)+' · ');a.href=base.motivos.documentos[m.doc];a.target='_blank';a.rel='noopener';a.setAttribute('aria-label',tx('fundamento_abre',{fundamento:tx('fund_'+m.id)}));
            fund.appendChild(a);li.appendChild(fund);ul.appendChild(li);
          }
          grupo.appendChild(ul);f.appendChild(grupo);
        }
        f.appendChild(el('p',tx('tipo_nota')));box.appendChild(f);
      }};
    tipo.validar=v=>v==='interno'&&!['09','2009','98','1998'].includes(String(compartido()?.plan))?'El formato interno solo contempla los planes 1998 y 2009. Consulta Gestión Escolar para confirmar el formato que corresponde a tu plan.':'';
    const filas={id:'filas',texto:'Tus materias',resumen:v=>(v||[]).map(r=>`${r.nombre} · nivel ${r.nivel} · cursada ${r.cursada||'sin dato'} · recursada ${r.recursada||'sin dato'}`).join('; '),validar:v=>!Array.isArray(v)||v.length>8?'Selecciona como máximo 8 materias.':!v.length?'Selecciona al menos una materia.':'',
      pintar(box,ctx){
        const contador=el('p',`${ctx.datos.filas.length} de 8 renglones del formato`),aviso=el('p',pre.length>8?'Tu historial tiene más de 8 materias pendientes. Seleccionamos las primeras 8; revisa cuáles incluir y consulta Gestión Escolar para las restantes.':'');aviso.setAttribute('role','status');box.appendChild(contador);
        const lista=el('div');lista.className='dictamen-opciones';box.appendChild(lista);
        const lq=el('label'),q=el('input');lq.className='tramite-campo';lq.appendChild(el('span','Agregar otra materia del plan'));q.type='search';q.setAttribute('aria-label','Agregar otra materia del plan');q.placeholder='Escribe el nombre o la clave';lq.appendChild(q);box.appendChild(lq);
        const resultados=el('div');resultados.className='dictamen-opciones';box.appendChild(resultados);box.appendChild(aviso);
        const agregadas=new Map(ctx.datos.filas.map(r=>[r.clave,r]));
        function pintar(){lista.replaceChildren();resultados.replaceChildren();const todas=new Map([...pre,...agregadas.values(),...ctx.datos.filas].map(r=>[r.clave,r]));
          const busqueda=q.value.trim().toLocaleLowerCase(),otras=busqueda?materias.filter(r=>!todas.has(r.clave)&&(r.nombre+' '+r.clave).toLocaleLowerCase().includes(busqueda)).slice(0,8):[];
          for(const r of [...todas.values(),...otras]){
            const marcada=ctx.datos.filas.some(f=>f.clave===r.clave);
            const l=el('label'),n=el('input');n.type='checkbox';n.checked=marcada;
            n.onchange=()=>{if(n.checked&&ctx.datos.filas.length>=8){n.checked=false;aviso.textContent='El formato tiene 8 renglones. Quita una materia antes de agregar otra.';return}
              if(n.checked){agregadas.set(r.clave,r);q.value=''}
              ctx.cambiar(n.checked?[...ctx.datos.filas,r]:ctx.datos.filas.filter(f=>f.clave!==r.clave));contador.textContent=`${ctx.datos.filas.length} de 8 renglones del formato`;aviso.textContent='';pintar()};
            l.appendChild(n);l.appendChild(el('span',`${r.nombre} · nivel ${r.nivel} · cursada ${r.cursada||'sin dato'} · recursada ${r.recursada||'sin dato'}`));(todas.has(r.clave)?lista:resultados).appendChild(l);
          }}q.oninput=pintar;pintar();
      }};
    const peticion={id:'peticion',texto:'Tu petición',requerido:true,sensible:true,validar:(v,d)=>!font?tx('medidor_cargando'):!medir(v,d.tipo).ok?tx('peticion_acortar'):'',
      pintar(box,ctx){
        const d=ctx.datos,origen=()=>d.peticion_origen||'detectado',detectado=origen()==='detectado',max=d.tipo==='externo'?4:5;
        const f=el('fieldset');f.className='dictamen-opciones';f.appendChild(el('legend',tx('peticion_leyenda')));
        for(const [valor,etiqueta] of [['detectado',tx('peticion_detectado')],['otro',tx('peticion_otro')]]){
          const l=el('label'),r=el('input');r.type='radio';r.name='dictamen-peticion-origen';r.value=valor;r.checked=origen()===valor;
          r.onchange=()=>{d.peticion_origen=valor;
            if(valor==='detectado'){d.peticion=propuesta(d);d.propuesta=d.peticion}else if(d.peticion===d.propuesta)d.peticion='';
            ctx.cambiar(d.peticion,true)};
          l.appendChild(r);l.appendChild(el('span',etiqueta));f.appendChild(l);
        }
        box.appendChild(f);box.appendChild(el('p',tx(detectado?'peticion_detectado_ayuda':'peticion_otro_ayuda')));
        const l=el('label'),n=el('textarea'),contador=el('p');l.className='tramite-campo';l.appendChild(el('span',tx('peticion_etiqueta')));n.value=d.peticion;l.appendChild(n);box.appendChild(l);box.appendChild(contador);contador.setAttribute('aria-live','polite');
        const actualizar=()=>{if(!font){contador.textContent=tx('medidor_cargando');return}const r=medir(n.value,d.tipo);contador.textContent=tx(r.ok?'renglones':'renglones_acortar',{n:r.renglones.length,max})};
        n.oninput=()=>{ctx.cambiar(n.value);actualizar()};
        if(detectado)for(const [op,t] of [['inscribir','peticion_proponer_inscribir'],['tiempo','peticion_proponer_tiempo']]){const b=el('button',tx(t));b.type='button';b.className='sate-btn';b.onclick=()=>{n.value=propuesta(d,op);d.propuesta=n.value;ctx.cambiar(n.value);actualizar()};box.appendChild(b)}
        actualizar();cargar().then(actualizar).catch(()=>{contador.textContent=tx('medidor_error')});
      }};
    const guias=[['paso','¿Qué pasó?','Durante el periodo … '],['acciones','¿Qué has hecho para regularizarte?','Para regularizarme, he … '],['compromiso','¿Qué te comprometes a hacer?','Me comprometo a … ']].map(([id,texto,placeholder])=>({id,texto,sensible:true,pintar(box,ctx){
      const l=el('label'),n=el('textarea');l.className='tramite-campo';l.appendChild(el('span',texto));n.value=ctx.datos[id];n.placeholder=placeholder;l.appendChild(n);box.appendChild(l);
      n.oninput=()=>{const anterior=carta(ctx.datos);ctx.cambiar(n.value);
        if(!ctx.datos.motivos||ctx.datos.motivos===anterior){ctx.datos.motivos=carta(ctx.datos);const vista=box.querySelector('#dictamen-motivos');if(vista)vista.value=ctx.datos.motivos}
      };
    }}));
    const motivos={id:'motivos',texto:'Vista previa editable de tu carta de motivos',tipo:'textarea',sensible:true,requerido:true,ayuda:'Sugerimos una página. La carta puede ocupar varias páginas.',pintar(box,ctx){
      const b=el('button','Armar la carta con mis respuestas');b.type='button';b.className='sate-btn';const l=el('label'),n=el('textarea');n.id='dictamen-motivos';l.className='tramite-campo';l.appendChild(el('span',motivos.texto));n.value=ctx.datos.motivos;l.appendChild(n);box.appendChild(el('p',motivos.ayuda));box.appendChild(b);box.appendChild(l);
      b.onclick=()=>{n.value=carta(ctx.datos);ctx.cambiar(n.value)};n.oninput=()=>ctx.cambiar(n.value);
    }};
    const adjuntos={id:'adjuntos',texto:tx('anexos_titulo'),sensible:true,
      resumen:v=>Array.isArray(v)&&v.length?v.map(a=>a.nombre).join(', '):tx('anexos_ninguno'),
      pintar(box,ctx){
        const lista=()=>Array.isArray(ctx.datos.adjuntos)?ctx.datos.adjuntos:[];
        const sec=el('section'),entrada=el('input'),etiqueta=el('label'),estado=el('p',''),vacio=el('p',''),ol=el('ol');let origen=null;
        sec.className='dictamen-anexos';sec.appendChild(el('h4',tx('anexos_titulo')));sec.appendChild(el('p',tx('anexos_ayuda')));sec.appendChild(el('p',tx('anexos_privacidad')));
        etiqueta.className='tramite-campo';etiqueta.appendChild(el('span',tx('anexos_agregar')));entrada.type='file';entrada.multiple=true;entrada.accept='application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';etiqueta.appendChild(entrada);
        estado.setAttribute('role','status');sec.appendChild(etiqueta);sec.appendChild(estado);sec.appendChild(vacio);sec.appendChild(el('p',tx('anexos_mover')));sec.appendChild(ol);
        const mover=(de,a)=>{if(a<0||a>=lista().length||de===a)return;const nuevo=[...lista()],[x]=nuevo.splice(de,1);nuevo.splice(a,0,x);ctx.cambiar(nuevo);pintarLista()};
        function pintarLista(){
          ol.replaceChildren();vacio.textContent=lista().length?'':tx('anexos_vacio');
          lista().forEach((a,i)=>{
            const li=el('li');li.draggable=true;
            li.ondragstart=e=>{origen=i;try{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',String(i))}catch{}};
            li.ondragover=e=>e.preventDefault();li.ondrop=e=>{e.preventDefault();if(origen!=null)mover(origen,i);origen=null};
            li.appendChild(el('span',`${i+1}. ${a.nombre} · ${a.tipo==='pdf'?tx('anexos_paginas',{n:a.paginas}):tx('anexos_imagen')}`));
            for(const [clave,accion,apagado] of [['anexos_subir',()=>mover(i,i-1),i===0],['anexos_bajar',()=>mover(i,i+1),i===lista().length-1],['anexos_quitar',()=>{memoria.delete(a.id);ctx.cambiar(lista().filter(x=>x.id!==a.id));pintarLista()},false]]){
              const b=el('button',tx(clave));b.type='button';b.className='sate-btn';b.setAttribute('aria-label',tx(clave)+': '+a.nombre);b.disabled=apagado;b.onclick=accion;li.appendChild(b);
            }
            ol.appendChild(li);
          });
        }
        entrada.onchange=async()=>{
          const avisos=[];
          try{await cargar()}catch{estado.textContent=tx('biblioteca');return}
          for(const f of Array.from(entrada.files||[])){
            const actuales=lista(),total=actuales.reduce((suma,a)=>suma+a.peso,0);
            if(actuales.length>=LIMITE.cantidad||total+f.size>LIMITE.totalMb*1048576){avisos.push(tx('anexos_error_total',{n:LIMITE.cantidad,mb:LIMITE.totalMb}));break}
            if(f.size>LIMITE.archivoMb*1048576){avisos.push(tx('anexos_error_tamano',{nombre:f.name,mb:LIMITE.archivoMb}));continue}
            let bytes;try{bytes=new Uint8Array(await f.arrayBuffer())}catch{avisos.push(tx('anexos_error_leer',{nombre:f.name}));continue}
            const tipo=PdfTramites.tipoArchivo(bytes);if(!tipo){avisos.push(tx('anexos_error_tipo',{nombre:f.name}));continue}
            let paginas=0;try{if(tipo==='pdf')paginas=await PdfTramites.paginas(bytes)}catch{avisos.push(tx('anexos_error_leer',{nombre:f.name}));continue}
            const id='anexo'+(++consecutivo);memoria.set(id,bytes);
            ctx.cambiar([...lista(),{id,nombre:f.name,tipo:tipo==='pdf'?'pdf':'imagen',paginas,peso:f.size}]);
          }
          entrada.value='';estado.textContent=avisos.join(' ');pintarLista();
        };
        box.appendChild(sec);pintarLista();
      }};
    // Los motivos también pueden contener salud, familia o trabajo: jamás se guardan.
    const valores=d=>({...compartido(),...d,unidad:SATE_CONFIG.unidades[SATE_UNIDAD].siglas+'-IPN',fecha:new Date().toLocaleDateString('en-CA'),oficios:d.anteriores==='Sí'?d.oficios:'',...Object.fromEntries(['dependientes','hijos','embarazo','organo'].map(k=>[k,typeof d[k]==='string'&&d[k]?[d[k]]:[]])),...Object.fromEntries(['situacion','causas','anexos'].map(k=>[k,Array.isArray(d[k])?d[k]:[]]))});
    // Qué falta para ver o generar el formato; nunca se genera una hoja en blanco.
    function faltante(d,final=false){
      const f=[];
      if(!compartido())f.push(tx('falta_datos'));
      if(!d.tipo)f.push(tx('falta_tipo'));
      if(!Array.isArray(d.filas)||!d.filas.length)f.push(tx('falta_materias'));
      if(!periodo(d.periodo))f.push(tx('falta_periodo'));
      if(final){const t=String(d.peticion||'').trim();if(!t||(font&&d.tipo&&!medir(t,d.tipo).ok))f.push(tx('falta_peticion'))}
      return f.length?tx('falta',{lista:f.join(', ')}):'';
    }
    function bytesAnexos(lista){return (Array.isArray(lista)?lista:[]).map(a=>{const b=memoria.get(a.id);if(!b)throw new Error('anexo_perdido');return b})}
    async function generar(d,preview=false){
      await cargar();if(!d.tipo)throw new Error(tx('falta_error'));
      if(!preview&&(!compartido()||!medir(d.peticion,d.tipo).ok||d.filas.length>8))throw new Error('Respuestas incompletas');
      const v=valores(d);if(preview){if(!medir(v.peticion,v.tipo).ok)v.peticion='';v.filas=v.filas.slice(0,8)}
      let etapa='formato';
      try{
        const formato=await PdfDictamen.generar({tipo:d.tipo,valores:v,pdfs:base.pdfs,texto});etapa='carta';
        const carta=await PdfDictamen.generar({tipo:'carta',valores:{...v,motivos:v.motivos||''},pdfs:base.pdfs,texto});etapa='unión de formatos';
        etapa='anexos';const anexos=preview?[]:await PdfTramites.anexosAPdf(bytesAnexos(d.adjuntos));etapa='unión de formatos';
        return await PdfTramites.unir([formato,carta,...anexos]);
      }catch(e){
        // La etapa y las cantidades permiten localizar la falla sin revelar las respuestas.
        console.error('Dictamen: generación fallida',{etapa,tipo:d.tipo,preview,materias:v.filas.length,renglones:medir(v.peticion,d.tipo).renglones.length,error:e.name});throw e;
      }
    }
    return {id:'dictamen',titulo:'Solicitud de dictamen',datos:{tipo:sugerencia.tipo,filas:pre.slice(0,8),ingreso:ingreso(alumno),periodo:periodo(alumno.periodo_actual||alumno.periodo||SATE_DATA.calendario?.periodo)},
      pasos:[{titulo:'¿Qué necesitas?',campos:[{id:'datos',texto:'Tus datos',resumen:()=>Object.values(compartido()||{}).filter(Boolean).join(' · '),validar:()=>!compartido()?'Guarda tus datos aquí para continuar.':['paterno','nombres','boleta','carrera','plan','correo'].map(k=>SateTramites.validarDatos(k,compartido()[k]||'',true)).find(Boolean)||'',pintar(box,ctx){SateTramites.datosInline(box,()=>{ctx.cambiar();ctx.repintar()},['celular','telefono'])}},tipo]},
        {titulo:'Tus materias',campos:[filas,{id:'periodo',texto:'Periodo que solicitas',requerido:true,validar:v=>!periodo(v)?'Escribe el periodo como YY/P, por ejemplo 27/1.':''}]},
        {titulo:'Tu situación',ayuda:d=>d.tipo==='externo'?'Estos datos no se guardan; si recargas la página tendrás que volver a llenarlos':'Revisa tus dictámenes anteriores y el ciclo en que ingresaste al IPN.',campos:camposSituacion},{titulo:'Tu petición y tus motivos',ayuda:'Las respuestas guía y la carta de motivos se mantienen solo en memoria.',campos:[peticion,{id:'propuesta',visible:()=>false},{id:'peticion_origen',visible:()=>false},...guias,motivos,adjuntos]}],
      preparar(d,p){if(!inicializado){if(!d.ultimo)d.ultimo=alumno.ultimo_semestre||'';inicializado=true}if(p===3){if(!d.peticion_origen)d.peticion_origen=d.filas?.length?'detectado':'otro';if(d.peticion_origen==='detectado'&&(!d.peticion||d.peticion===d.propuesta)){d.peticion=propuesta(d);d.propuesta=d.peticion}}},
      revisar(box){box.appendChild(el('p','Estos datos no se guardan; si recargas la página tendrás que volver a llenarlos'))},
      volver:true,faltante,confirmacion:'Confirmo que la información es verdadera',descargaTexto:'Descargar mi solicitud (PDF)',archivo:d=>`dictamen-${d.tipo}-${compartido()?.boleta||''}.pdf`,generar:d=>generar(d),previsualizar:d=>generar(d,true)};
  }
  raiz.SateDictamen={definir,sugerir,pendientes,plantilla,medir,cargar};
  SateTramites.registrar(definir,'dictamen');
})(globalThis);
