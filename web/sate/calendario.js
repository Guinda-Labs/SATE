/* Fechas civiles y selección compartidas por el arco y la cuadrícula. */
(function(){
  const api=SATE.calendario, tx=(k,v)=>SATE.texto('sate.calendario.'+k,v);
  const el=(tag,texto,clase)=>{const n=document.createElement(tag);if(texto!=null)n.textContent=texto;if(clase)n.className=clase;return n};
  const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n};
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const date=s=>new Date(s+'T00:00:00'), numero=s=>Date.parse(s+'T00:00:00Z')/86400000;
  const sumar=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return iso(d)};
  const fecha=s=>date(s).toLocaleDateString('es-MX',{dateStyle:'long'});
  const rango=e=>e.desde===e.hasta?fecha(e.desde):tx('rango',{desde:fecha(e.desde),hasta:fecha(e.hasta)});
  const delDia=(s,eventos)=>eventos.filter(e=>e.desde<=s&&e.hasta>=s);
  const simbolos={triangulo:'▲',triangulo_invertido:'▼',estrella:'★',circulo:'○',rayado:'▨',contorno:'□',discontinuo:'┄',relleno:'■'};
  const seleccion=new Set(api.categorias);
  let mes=null,foco=null,periodo=null,detalleActual=null,panel,ampliar=false;
  let marcas=[],dias=[],hover=null,enfocado=null,redibujarGrafico=null;
  const corto=e=>tx('nombre_'+(e.personal?'cita':e.categoria==='gestion'?(e.para==='cita'||e.para==='sincita'||e.para==='adeudo'?'reinscripcion':e.para==='dictamen'?'dictamen':e.para==='desfasada'||e.para==='transitorio'?'desfasadas':e.titulo.startsWith('Baja')?'bajas':e.titulo.startsWith('Altas')?'altas':e.titulo.startsWith('Cita')?'cita_altas':'citas'):e.categoria==='becas'?(e.titulo.startsWith('Validación')?'becas_validacion':e.titulo.startsWith('Publicación')?'becas_resultados':'becas_solicitud'):e.categoria));
  function boton(texto,accion,id){const b=el('button',texto,'sate-btn');b.type='button';if(id)b.id=id;b.onclick=accion;return b}
  function redibujar(id){mostrar();if(id)document.getElementById(id)?.focus()}
  function destacar(){
    const activo=hover||enfocado;
    const porNodo=new Map();marcas.forEach(({e,nodo})=>{if(!porNodo.has(nodo))porNodo.set(nodo,[]);porNodo.get(nodo).push(e)});
    porNodo.forEach((es,nodo)=>{nodo.setAttribute('aria-pressed',es.some(e=>detalleActual?.eventos.includes(e)));nodo.setAttribute('data-resaltado',es.includes(activo));nodo.setAttribute('data-atenuado',!!activo&&!es.includes(activo))});
    dias.forEach(({s,nodo})=>{const es=activo?[activo]:detalleActual?.eventos||[];nodo.setAttribute('data-seleccionado',es.some(e=>e.desde<=s&&e.hasta>=s))});
  }
  function conectar(nodo,e){
    nodo.setAttribute('data-categoria',e.categoria);nodo.setAttribute('aria-label',e.titulo+'. '+rango(e));nodo.onclick=()=>abrir([e],tx('detalle'));
    nodo.onmouseenter=()=>{hover=e;destacar()};nodo.onmouseleave=()=>{hover=null;destacar()};
    nodo.onfocus=()=>{enfocado=e;destacar()};nodo.onblur=()=>{enfocado=null;destacar()};marcas.push({e,nodo});
  }
  function pintarDetalle(){
    redibujarGrafico?.();
    destacar();panel.replaceChildren();const titulo=el('h3',detalleActual?.titulo||tx('detalle'));titulo.id='cal-detalle-titulo';titulo.tabIndex=-1;panel.appendChild(titulo);
    if(!detalleActual?.eventos.length){panel.appendChild(el('p',tx('sin_eventos')));return}
    detalleActual.eventos.forEach(e=>{const s=el('section',null,'calendario-detalle-evento');s.setAttribute('data-categoria',e.categoria);s.appendChild(el('h4',e.titulo));s.appendChild(el('p',rango(e)));s.appendChild(el('p',tx('periodo_nombre',{periodo:e.periodo})));
      if(e.periodo!==periodo)s.appendChild(boton(tx('ver_periodo',{periodo:e.periodo}),()=>{periodo=e.periodo;redibujar('cal-periodo')}));
      s.appendChild(el('p',tx('audiencia',{audiencia:(e.audiencia||['alumnos']).map(a=>tx('audiencia_'+a)).join(', ')})));
      if(e.para)s.appendChild(el('p',tx('condicion_'+e.para)));if(e.nota||e.texto)s.appendChild(el('p',e.nota||e.texto));
      const fuente=el('details',null,'calendario-fuente');fuente.appendChild(el('summary',tx('fuente_titulo')));fuente.appendChild(el('p',tx('fuente',{fuente:e.fuente})));if(e.url){const a=el('a',tx('consultar_fuente'));a.href=e.url;fuente.appendChild(a)}if(e.fuenteOriginal)fuente.appendChild(el('small',e.fuenteOriginal));s.appendChild(fuente);panel.appendChild(s)});
  }
  function abrir(eventos,titulo){
    detalleActual={eventos,titulo};
    // Mostrar los días del arco elegido, aunque su mes estuviera fuera de pantalla.
    if(eventos.length===1&&!delDia(mes+'-01',eventos).length&&!eventos[0].desde.startsWith(mes)){mes=eventos[0].desde.slice(0,7);foco=eventos[0].desde;mostrar()}else pintarDetalle();
    document.getElementById('cal-detalle-titulo')?.focus({preventScroll:true});
  }
  function meses(desde,hasta){const salida=[];let m=desde.slice(0,7);while(m<=hasta.slice(0,7)){salida.push(m);const d=date(m+'-01');d.setMonth(d.getMonth()+1);m=iso(d).slice(0,7)}return salida}
  function pistas(eventos){const finales=[];return [...eventos].sort((a,b)=>a.desde.localeCompare(b.desde)||b.hasta.localeCompare(a.hasta)).map(e=>{let pista=finales.findIndex(fin=>fin<e.desde);if(pista<0)pista=finales.length;finales[pista]=e.hasta;return {e,pista}})}
  function periodoGrafico(contenido,eventos,desde,hasta){
    const movil=typeof matchMedia==='function'&&matchMedia('(max-width:1023px)').matches;
    const ancho=document.getElementById('sate-calendario').clientWidth||1040,tam=movil?ancho:(ancho-24)/2;
    const grueso=movil?8:12,paso=grueso,total=numero(hasta)-numero(desde)+1,centro=tam/2,exterior=centro-14;
    const categorias=api.categorias.filter(c=>eventos.some(e=>e.categoria===c)),items=[];let usadas=0;
    const anillos=categorias.map(c=>{const propios=pistas(eventos.filter(e=>e.categoria===c&&e.desde!==e.hasta)),n=Math.max(1,...propios.map(i=>i.pista+1)),r=exterior-usadas*paso;
      propios.forEach(i=>items.push({...i,r:r+grueso/2-(i.pista+.5)*grueso/n,grosor:grueso/n,categoria:c}));usadas++;return {c,r,n}});
    const interior=Math.max(12,exterior-usadas*paso-8),ang=s=>Math.PI+(numero(s)-numero(desde))/total*Math.PI;
    const punto=(a,r)=>[centro+Math.cos(a)*r,centro+Math.sin(a)*r];
    const path=(a,b,r)=>{const p=punto(a,r),q=punto(b,r);return `M ${p[0]} ${p[1]} A ${r} ${r} 0 0 1 ${q[0]} ${q[1]}`};
    const dibujo=svg('svg',{class:'calendario-semicirculo','aria-label':tx('grafico_periodo',{periodo}),role:'group','data-grosor':grueso,'data-movil':movil}),defs=svg('defs');dibujo.appendChild(defs);
    anillos.filter(({c})=>items.some(i=>i.categoria===c)).forEach(({c,r,n})=>dibujo.appendChild(svg('path',{d:path(Math.PI,2*Math.PI,r),class:'calendario-anillo-categoria','data-categoria':c,'data-subpistas':n,'stroke-width':grueso})));
    if(eventos.some(e=>e.desde===e.hasta))dibujo.appendChild(svg('path',{d:path(Math.PI,2*Math.PI,interior),class:'calendario-anillo-simbolos'}));
    dibujo.appendChild(svg('path',{d:path(Math.PI,2*Math.PI,exterior+12),class:'calendario-pista'}));
    function linea(a,r1,r2,clase){const p=punto(a,r1),q=punto(a,r2);dibujo.appendChild(svg('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:clase}))}
    if(api.hoy()>=desde&&api.hoy()<=hasta)linea(ang(api.hoy()),12,exterior+12,'calendario-aguja');
    const cajas=[];let arriba=0;
    function reservar(x,y,w,h){
      // Meses, hoy y procesos comparten el mismo margen de separación.
      while(cajas.some(c=>x<c.x+c.w+4&&x+w+4>c.x&&y<c.y+c.h+4&&y+h+4>c.y))y-=h+5;
      cajas.push({x,y,w,h});arriba=Math.min(arriba,y-4);return y;
    }
    for(let s=desde;s<=hasta;s=sumar(s,1)){
      if(date(s).getDay()===1)linea(ang(s),exterior+10,exterior+15,'calendario-tick');
      if(s===desde||s.endsWith('-01')){linea(ang(s),exterior+7,exterior+12,'calendario-tick');const finMes=iso(new Date(date(s).getFullYear(),date(s).getMonth()+1,1)),medio=sumar(s,Math.floor((Math.min(numero(hasta)+1,numero(finMes))-numero(s))/2)),p=punto(ang(medio),exterior+10),nombre=date(s).toLocaleDateString('es-MX',{month:'short'}),w=nombre.length*8+8,x=Math.max(4,Math.min(tam-w-4,p[0]-w/2)),y=reservar(x,p[1]-14,w,18),t=svg('text',{x:x+4,y:y+14,'text-anchor':'start',class:'calendario-svg-mes','data-caja':[x,y,w,18].join(',')});t.textContent=nombre;dibujo.appendChild(t)}
    }
    const pendientes=[],elegido=e=>detalleActual?.eventos.some(v=>v.titulo===e.titulo&&v.desde===e.desde&&v.hasta===e.hasta);
    function marca(e,pista){
      const g=svg('g',{class:'calendario-arco',tabindex:0,role:'button','data-pista':e.categoria+'-'+pista,'data-desde':e.desde,'data-hasta':e.hasta});conectar(g,e);
      const title=svg('title');title.textContent=e.titulo+'. '+rango(e);g.appendChild(title);g.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();g.onclick()}};
      return g;
    }
    items.forEach(({e,pista,r,grosor},i)=>{
      const a=ang(e.desde),b=ang(sumar(e.hasta,1)),nombre=corto(e),g=marca(e,pista);
      const d=path(a,b,r),id='cal-arco-'+i;g.appendChild(svg('path',{d,class:'calendario-trazo','stroke-width':grosor}));defs.appendChild(svg('path',{id,d}));
      // No recortar nombres: una cota por carácter deja margen para la fuente real.
      if(grosor>=12&&nombre.length*6.8+12<=(b-a)*r){
        const t=svg('text',{class:'calendario-arco-nombre',dy:4}),tp=svg('textPath',{href:'#'+id,startOffset:'50%','text-anchor':'middle'});
        tp.textContent=nombre;t.appendChild(tp);g.appendChild(t);
      }else pendientes.push({e,nombre,a:(a+b)/2,r,g});dibujo.appendChild(g);
    });
    const puntuales=eventos.filter(e=>e.desde===e.hasta).sort((a,b)=>a.desde.localeCompare(b.desde)),grupos=[],diametro=movil?16:20;
    puntuales.forEach(e=>{const a=ang(e.desde),ultimo=grupos.at(-1);if(ultimo&&(a-ultimo.a)*interior<diametro*1.2){ultimo.es.push(e);ultimo.a=ultimo.es.reduce((s,v)=>s+ang(v.desde),0)/ultimo.es.length}else grupos.push({a,es:[e]})});
    grupos.forEach(({a,es},i)=>{
      const p=punto(a,interior),g=marca(es[0],'dia-'+i),t=svg('text',{x:p[0],y:p[1]+4,'text-anchor':'middle',class:'calendario-svg-simbolo'});
      es.slice(1).forEach(e=>marcas.push({e,nodo:g}));g.appendChild(svg('circle',{cx:p[0],cy:p[1],r:diametro/2,class:'calendario-punto-fondo'}));
      t.textContent=es.length>1?es.length:simbolos[es[0].simbolo]||'◆';g.appendChild(t);
      if(es.length>1){g.setAttribute('class','calendario-arco calendario-insignia');g.setAttribute('data-cantidad',es.length);g.setAttribute('data-fecha-grupo',es[0].desde);g.setAttribute('aria-label',es.map(e=>e.titulo+'. '+fecha(e.desde)).join('; '));
        g.onclick=()=>{mes=es[0].desde.slice(0,7);foco=es[0].desde;detalleActual={eventos:delDia(foco,eventos),titulo:fecha(foco)};mostrar();dias.find(d=>d.s===foco)?.nodo.focus()};}
      dibujo.appendChild(g);es.forEach(e=>{if(elegido(e))pendientes.push({e,nombre:corto(e),a,r:interior,g})});
    });
    const etiquetas=[];
    pendientes.sort((a,b)=>a.a-b.a).forEach(item=>{if(movil&&!elegido(item.e))return;const anterior=etiquetas.find(v=>v.e.categoria===item.e.categoria&&v.nombre===item.nombre);
      if(anterior){anterior.items.push(item);anterior.a=anterior.items.reduce((s,i)=>s+i.a,0)/anterior.items.length;return}etiquetas.push({...item,items:[item]});});
    if(api.hoy()>=desde&&api.hoy()<=hasta){const a=ang(api.hoy()),p=punto(a,exterior+12),nombre=tx('hoy_fecha',{fecha:date(api.hoy()).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}),w=nombre.length*7;
      const x=Math.max(4,Math.min(tam-w-4,p[0]-w/2)),y=reservar(x,p[1]-26,w,18),t=svg('text',{x,y:y+14,'text-anchor':'start',class:'calendario-svg-hoy','data-caja':[x,y,w,18].join(',')});t.textContent=nombre;dibujo.appendChild(t);}
    etiquetas.forEach(v=>{
      const nombre=v.nombre+(v.items.length>1?' ×'+v.items.length:''),w=nombre.length*7+8,h=18,p=punto(v.a,exterior+44),x=Math.max(4,Math.min(tam-w-4,p[0]-w/2));
      const cercano=Math.max(x,Math.min(x+w,centro));let y=Math.min(p[1]-h,centro-Math.sqrt(Math.max(0,exterior**2-(cercano-centro)**2))-h-20);
      // Subir la caja completa conserva separación y deja la guía unida al arco.
      y=reservar(x,y,w,h);
      const grupo=svg('g',{class:'calendario-etiqueta-exterior','data-caja':[x,y,w,h].join(','),'data-seleccionada':v.items.some(i=>elegido(i.e))});
      v.items.forEach(i=>{const q=punto(i.a,i.r);grupo.appendChild(svg('path',{d:`M ${q[0]} ${q[1]} L ${p[0]} ${p[1]} L ${x+w/2} ${y+h}`,class:'calendario-guia'}))});
      grupo.appendChild(svg('rect',{x,y,width:w,height:h,rx:4,class:'calendario-etiqueta-fondo'}));const t=svg('text',{x:x+4,y:y+13,class:'calendario-etiqueta-nombre'});t.textContent=nombre;grupo.appendChild(t);conectar(grupo,v.e);grupo.setAttribute('role','button');grupo.setAttribute('tabindex',0);grupo.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();grupo.onclick()}};dibujo.appendChild(grupo);
    });
    const titulo=svg('text',{x:centro,y:centro+20,'text-anchor':'middle',class:'calendario-svg-periodo'});titulo.textContent=tx('periodo_nombre',{periodo});dibujo.appendChild(titulo);
    dibujo.setAttribute('viewBox',`-20 ${arriba} ${tam+40} ${centro+28-arriba}`);contenido.appendChild(dibujo);contenido.appendChild(el('p',rango({desde,hasta}),'calendario-rango'));
  }
  function mesGrafico(contenido,eventos,desde,hasta,inicioPeriodo){
    const disponibles=meses(desde,hasta);if(!disponibles.includes(mes))mes=disponibles.includes(api.hoy().slice(0,7))?api.hoy().slice(0,7):inicioPeriodo.slice(0,7);
    const primero=date(mes+'-01'),ultimo=iso(new Date(primero.getFullYear(),primero.getMonth()+1,0)),inicio=sumar(mes+'-01',-primero.getDay()),fin=sumar(ultimo,6-date(ultimo).getDay());
    const nav=el('div',null,'calendario-nav'),titulo=el('h3',tx('titulo_mes',{mes:primero.toLocaleDateString('es-MX',{month:'long'}),anio:primero.getFullYear()}));titulo.id='cal-mes';titulo.setAttribute('aria-live','polite');
    const mover=salto=>{mes=disponibles[disponibles.indexOf(mes)+salto];foco=null;redibujar(salto<0?'cal-anterior':'cal-proximo')};
    const prev=boton('‹',()=>mover(-1),'cal-anterior'),next=boton('›',()=>mover(1),'cal-proximo');prev.setAttribute('aria-label',tx('anterior'));next.setAttribute('aria-label',tx('proximo'));prev.disabled=mes===disponibles[0];next.disabled=mes===disponibles.at(-1);
    const hoy=boton(tx('boton_hoy'),()=>{mes=api.hoy().slice(0,7);foco=api.hoy();redibujar('cal-hoy')},'cal-hoy');hoy.disabled=!disponibles.includes(api.hoy().slice(0,7));nav.appendChild(titulo);nav.appendChild(prev);nav.appendChild(next);nav.appendChild(hoy);contenido.appendChild(nav);
    const grid=el('div',null,'calendario-mes');grid.setAttribute('aria-labelledby','cal-mes');const head=el('div',null,'calendario-dias-semana');['D','L','M','M','J','V','S'].forEach((s,i)=>{const n=el('span',s);n.setAttribute('aria-label',new Date(2026,9,4+i).toLocaleDateString('es-MX',{weekday:'long'}));head.appendChild(n)});grid.appendChild(head);
    if(!foco||foco<inicio||foco>fin)foco=api.hoy()>=inicio&&api.hoy()<=fin?api.hoy():mes+'-01';const botones=[],fechas=el('div',null,'calendario-fechas');
    for(let s=inicio;s<=fin;s=sumar(s,1)){
      const es=delDia(s,eventos),celda=el('div',null,'calendario-celda'),b=boton(null,()=>{foco=s;botones.forEach(n=>n.tabIndex=n===b?0:-1);abrir(es,fecha(s))});b.className='calendario-dia';b.tabIndex=s===foco?0:-1;b.setAttribute('data-fecha',s);b.setAttribute('aria-label',fecha(s)+'. '+(es.length?es.map(e=>e.titulo).join('. '):tx('sin_eventos')));
      if(s===api.hoy())b.setAttribute('aria-current','date');if(!s.startsWith(mes))celda.className+=' calendario-fuera';const relleno=es.find(e=>['inscripcion','ordinaria','extraordinaria','inscripcion_ets','ets','vacaciones','saberes'].includes(e.categoria));if(relleno)b.setAttribute('data-categoria',relleno.categoria);
      b.appendChild(el('span',String(date(s).getDate()),'calendario-numero'));const signos=el('span',null,'calendario-signos');es.forEach(e=>{const n=el('span',simbolos[e.simbolo]||'•','calendario-signo');n.setAttribute('data-categoria',e.categoria);n.setAttribute('data-simbolo',e.simbolo||'relleno');n.setAttribute('aria-hidden','true');n.title=e.titulo;signos.appendChild(n)});
      if(es.some(e=>e.simbolo==='rayado'))b.className+=' calendario-rayado';if(es.some(e=>e.categoria==='suspension'))b.className+=' calendario-suspension';if(es.some(e=>e.categoria==='sindical'))b.className+=' calendario-sindical';b.appendChild(signos);
      b.onkeydown=k=>{const i=botones.indexOf(b),saltos={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7,Home:-date(s).getDay(),End:6-date(s).getDay()};if(k.key in saltos){k.preventDefault();const dest=botones[Math.max(0,Math.min(botones.length-1,i+saltos[k.key]))];botones.forEach(n=>n.tabIndex=-1);dest.tabIndex=0;foco=dest.getAttribute('data-fecha');dest.focus()}};botones.push(b);dias.push({s,nodo:b});celda.appendChild(b);fechas.appendChild(celda);
    }grid.appendChild(fechas);contenido.appendChild(grid);
  }
  function mostrar(){return globalThis.SateMedicion?globalThis.SateMedicion.render('calendario',mostrarVista):mostrarVista()}
  function mostrarVista(){
    const box=document.getElementById('sate-calendario'),eventos=api.eventos(ampliar),opciones=[...new Set(eventos.map(e=>e.periodo))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));box.setAttribute('data-unidad',SATE_UNIDAD);marcas=[];dias=[];hover=null;enfocado=null;redibujarGrafico=null;box.replaceChildren();box.appendChild(el('h2',SATE.texto('sate.pestana.calendario.titulo')));if(!eventos.length){box.appendChild(el('p',tx('sin_eventos')));return}
    const base=typeof SATE_CONFIG==='undefined'?null:SATE_CONFIG.calendarioBase,local=typeof DATA==='undefined'?null:DATA.calendario;
    if(!opciones.includes(periodo)){
      const limites=opciones.map(p=>{const es=eventos.filter(e=>e.periodo===p);return {p,...(local?.periodos?.[p]||base?.periodos[p]||{desde:es.map(e=>e.desde).sort()[0],hasta:es.map(e=>e.hasta).sort().at(-1)})}}).sort((a,b)=>a.desde.localeCompare(b.desde));
      periodo=delDia(api.hoy(),api.eventos()).find(e=>opciones.includes(e.periodo))?.periodo||limites.find(p=>p.desde<=api.hoy()&&p.hasta>=api.hoy())?.p||limites.find(p=>p.desde>api.hoy())?.p||limites.at(-1).p;mes=null;detalleActual=null;
    }
    const solicitado=api.procesoPendiente;if(solicitado){periodo=solicitado.periodo;mes=solicitado.desde.slice(0,7);foco=solicitado.desde;seleccion.add(solicitado.categoria);detalleActual={eventos:[solicitado],titulo:tx('detalle')};api.procesoPendiente=null}
    box.setAttribute('data-calendario-propio',!!(typeof DATA!=='undefined'&&DATA.calendario?.periodosPropios?.includes(periodo)));
    box.appendChild(el('p',tx('instrucciones'),'calendario-intro'));const controles=el('div',null,'calendario-controles'),label=el('label',tx('periodo'),'calendario-selector'),select=el('select');select.id='cal-periodo';select.setAttribute('aria-label',tx('periodo'));opciones.forEach(p=>{const o=el('option',tx('periodo_nombre',{periodo:p}));o.value=p;o.selected=p===periodo;select.appendChild(o)});select.onchange=()=>{periodo=select.value;mes=null;detalleActual=null;redibujar('cal-periodo')};label.appendChild(select);controles.appendChild(label);
    const aud=el('label',null,'calendario-audiencia'),check=el('input');check.id='cal-audiencia';check.type='checkbox';check.checked=ampliar;check.onchange=()=>{ampliar=check.checked;detalleActual=null;redibujar(check.id)};aud.appendChild(check);aud.appendChild(el('span',tx('ampliar_audiencia'),'calendario-audiencia-larga'));aud.appendChild(el('span',tx('ampliar_audiencia_corta'),'calendario-audiencia-corta'));controles.appendChild(aud);box.appendChild(controles);
    const todos=eventos.filter(e=>e.periodo===periodo),mensuales=eventos.filter(e=>seleccion.has(e.categoria)),visibles=mensuales.filter(e=>e.periodo===periodo),filtros=el('details',null,'calendario-filtros');filtros.appendChild(el('summary',tx('filtros')));api.categorias.filter(c=>eventos.some(e=>e.categoria===c)).forEach(c=>{const l=el('label',null,'calendario-filtro'),ch=el('input');ch.type='checkbox';ch.id='cal-filtro-'+c;ch.checked=seleccion.has(c);ch.onchange=()=>{ch.checked?seleccion.add(c):seleccion.delete(c);detalleActual=null;redibujar(ch.id)};l.appendChild(ch);l.appendChild(el('span',tx('categoria_'+c)));filtros.appendChild(l)});box.appendChild(filtros);
    // Ampliar la escala cuando el aviso local desplaza las fechas oficiales.
    const extremos=todos.flatMap(e=>[e.desde,e.hasta]);if(base?.periodos[periodo])extremos.push(base.periodos[periodo].desde,base.periodos[periodo].hasta);extremos.sort();
    // La cuadrícula conserva el horizonte completo aunque cambien el periodo o los filtros.
    const horizonte=eventos.flatMap(e=>[e.desde,e.hasta]);opciones.forEach(p=>{[base?.periodos[p],local?.periodos?.[p]].forEach(limite=>{if(limite)horizonte.push(limite.desde,limite.hasta)})});horizonte.sort();
    const desde=extremos[0],hasta=extremos.at(-1),inicioPeriodo=local?.periodos?.[periodo]?.desde||base?.periodos[periodo]?.desde||desde,layout=el('div',null,'calendario-layout'),izquierda=el('div',null,'calendario-contenido'),derecha=el('div',null,'calendario-cuadricula'),grafico=el('div');panel=el('aside',null,'calendario-detalle');panel.setAttribute('aria-labelledby','cal-detalle-titulo');izquierda.appendChild(grafico);izquierda.appendChild(panel);mesGrafico(derecha,mensuales,horizonte[0],horizonte.at(-1),inicioPeriodo);layout.appendChild(izquierda);layout.appendChild(derecha);box.appendChild(layout);
    redibujarGrafico=()=>{marcas=marcas.filter(m=>m.nodo.className==='calendario-proceso');grafico.replaceChildren();periodoGrafico(grafico,visibles,desde,hasta)};
    const leyenda=el('ul',null,'calendario-categorias');leyenda.setAttribute('aria-label',tx('categorias_presentes'));api.categorias.filter(c=>visibles.some(e=>e.categoria===c)).forEach(c=>{const e=visibles.find(e=>e.categoria===c),li=el('li');li.setAttribute('data-categoria',c);const muestra=el('span',simbolos[e.simbolo]||'■','calendario-muestra');muestra.setAttribute('data-simbolo',e.simbolo||'relleno');muestra.setAttribute('aria-hidden','true');li.appendChild(muestra);li.appendChild(el('span',tx('categoria_'+c)));leyenda.appendChild(li)});box.appendChild(leyenda);
    const lista=el('details',null,'calendario-lista');lista.appendChild(el('summary',tx('ver_lista')));const ul=el('ul',null,'calendario-procesos');[...visibles].sort((a,b)=>a.desde.localeCompare(b.desde)).forEach(e=>{const li=el('li'),b=boton(null,()=>{});b.className='calendario-proceso';conectar(b,e);b.appendChild(el('span',e.titulo));b.appendChild(el('small',rango(e)));li.appendChild(b);ul.appendChild(li)});lista.appendChild(ul);box.appendChild(lista);
    if(!detalleActual){const ordenados=[...visibles].sort((a,b)=>a.desde.localeCompare(b.desde)||a.hasta.localeCompare(b.hasta)),proximo=ordenados.find(e=>e.desde>api.hoy())||ordenados.find(e=>e.hasta>=api.hoy())||ordenados.at(-1);detalleActual={eventos:proximo?[proximo]:[],titulo:tx('detalle')}}
    // La fusión recrea objetos: restaurar la selección por identidad civil.
    detalleActual.eventos=detalleActual.eventos.map(e=>mensuales.find(v=>v.titulo===e.titulo&&v.desde===e.desde&&v.hasta===e.hasta&&v.periodo===e.periodo)).filter(Boolean);pintarDetalle();box.appendChild(el('p',tx('leyenda_periodo'),'calendario-leyenda'));if(solicitado)document.getElementById('cal-detalle-titulo')?.focus();
  }
  SATE.pestana('calendario',{montar(){},mostrar,ocultar(){}});
  if(typeof addEventListener==='function')addEventListener('resize',()=>{if(redibujarGrafico){redibujarGrafico();destacar()}});
})();
