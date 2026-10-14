/* Fechas civiles y una selección compartida entre arco, mes y lista. */
(function(){
  const api=SATE.calendario,tx=(k,v)=>SATE.texto('sate.calendario.'+k,v);
  const el=(tag,texto,clase)=>{const n=document.createElement(tag);if(texto!=null)n.textContent=texto;if(clase)n.className=clase;return n};
  const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n};
  const date=s=>new Date(s+'T00:00:00'),numero=s=>Date.parse(s+'T00:00:00Z')/86400000;
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const sumar=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return iso(d)};
  const fecha=s=>date(s).toLocaleDateString('es-MX',{dateStyle:'long'}),breve=s=>date(s).toLocaleDateString('es-MX',{day:'numeric',month:'short'});
  const rango=e=>e.desde===e.hasta?fecha(e.desde):tx('rango',{desde:fecha(e.desde),hasta:fecha(e.hasta)});
  const identidad=e=>[e.periodo,e.categoria,e.titulo,e.desde,e.hasta].join('|'),delDia=(s,es)=>es.filter(e=>e.desde<=s&&e.hasta>=s);
  const movil=()=>typeof matchMedia==='function'&&matchMedia('(max-width:1023px)').matches;
  const simbolos={triangulo:'▲',triangulo_invertido:'▼',estrella:'★',circulo:'○',rayado:'▨',contorno:'□',discontinuo:'┄',relleno:'■'};
  let periodo=null,mes=null,foco=null,ampliar=false,elegidos=new Set(),tituloElegido='',hoja=false,retorno=null;
  let eventos=[],grupos=[],desde,hasta,limites,box,panel,marcas=[],dias=[],periodosDisponibles=[];
  const seleccionado=e=>elegidos.has(identidad(e)),categoria=e=>tx('categoria_'+e.categoria);
  const meta=e=>SATE_CONFIG.calendarioBase?.vista?.categorias?.[e.categoria]||{};
  function boton(texto,accion,id){const b=el('button',texto,'sate-btn');b.type='button';b.onclick=accion;if(id)b.id=id;return b}
  function redibujar(id){mostrar();if(id)document.getElementById(id)?.focus()}
  function estado(es){return es.every(e=>e.hasta<api.hoy())?tx('ya_paso'):es.some(e=>e.desde<=api.hoy()&&e.hasta>=api.hoy())?tx('ahora'):tx('en_dias',{dias:Math.max(0,Math.min(...es.map(e=>numero(e.desde)))-numero(api.hoy()))})}
  function agrupar(es){const mapa=new Map();es.forEach(e=>{const clave=e.grupo?'g:'+e.grupo:identidad(e);if(!mapa.has(clave))mapa.set(clave,[]);mapa.get(clave).push(e)});return [...mapa].map(([clave,miembros])=>({clave,miembros,nombre:miembros.length>1?tx('grupo',{nombre:tx('nombre_'+miembros[0].categoria),cantidad:miembros.length}):miembros[0].titulo}))}
  function resaltar(){marcas.forEach(({n,es})=>{const on=es.some(seleccionado);n.setAttribute('aria-pressed',on);n.setAttribute('data-seleccionado',on)});dias.forEach(({s,n})=>{const on=eventos.some(e=>seleccionado(e)&&e.desde<=s&&e.hasta>=s);n.setAttribute('data-seleccionado',on);n.setAttribute('aria-pressed',on)})}
  function elegir(es,titulo,origen){
    retorno=origen?.id||origen?.getAttribute('data-fecha')||null;
    const completos=eventos.filter(e=>es.some(v=>identidad(v)===identidad(e)||v.grupo&&v.grupo===e.grupo));
    elegidos=new Set(completos.map(identidad));tituloElegido=completos.length>1&&completos.every(e=>e.grupo&&e.grupo===completos[0].grupo)?grupos.find(g=>g.miembros.some(e=>identidad(e)===identidad(completos[0])))?.nombre||titulo:titulo;
    hoja=movil()&&completos.length>0;if(es.length&&!es.some(e=>e.desde<=mes+'-31'&&e.hasta>=mes+'-01'))mes=es[0].desde.slice(0,7);mostrar();
    const destino=completos.length?document.getElementById('cal-detalle-titulo'):dias.find(d=>d.s===retorno)?.n;destino?.focus({preventScroll:true});
  }
  function cerrar(){hoja=false;if(!movil())elegidos.clear();mostrar();const n=document.getElementById(retorno)||dias.find(d=>d.s===retorno)?.n;(n||document.getElementById('cal-hoy'))?.focus()}
  function volver(){elegidos.clear();tituloElegido='';hoja=false;mes=api.hoy().slice(0,7);redibujar('cal-hoy')}
  function conectar(n,es,titulo){n.setAttribute('data-categoria',es[0].categoria);n.setAttribute('aria-label',es.map(e=>tx('evento_aria',{titulo:e.titulo,fechas:rango(e)})).join('; '));n.onclick=()=>elegir(es,titulo,n);marcas.push({n,es})}
  function resumen(sinEtiqueta=false){
    const hoy=api.hoy(),actual=eventos.find(e=>e.desde<=hoy&&e.hasta>=hoy),proximo=[...eventos].sort((a,b)=>a.desde.localeCompare(b.desde)).find(e=>e.desde>hoy),dentro=hoy>=limites.desde&&hoy<=limites.hasta;
    const [anio,mitad]=String(periodo||'').split('/'),siguiente=mitad==='1'?anio+'/2':String(Number(anio)+1)+'/1';
    return {actual,proximo,dentro,arriba:tx('hoy_fecha',{fecha:date(hoy).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'})}),
      grande:!eventos.length?tx('vacio'):hoy<limites.desde?tx('faltan_dias',{dias:numero(limites.desde)-numero(hoy)}):hoy>limites.hasta?tx('cerrado'):tx('semana_actual',{semana:Math.floor((numero(hoy)-numero(limites.desde))/7)+1,total:Math.ceil((numero(limites.hasta)-numero(limites.desde)+1)/7)}),
      ahora:!eventos.length?tx('vacio_mensaje'):hoy>limites.hasta?tx('termino',{fecha:breve(limites.hasta)}):hoy<limites.desde?tx('inicia',{fecha:breve(limites.desde)}):actual?tx(sinEtiqueta?'tarjeta_ahora_evento':'ahora_evento',{nombre:actual.titulo}):tx(sinEtiqueta?'tarjeta_ahora_clases':'ahora_clases'),
      sigue:hoy>limites.hasta?tx(periodosDisponibles.includes(siguiente)?'siguiente_publicado':'siguiente_pendiente',{periodo:siguiente}):proximo?tx(sinEtiqueta?'tarjeta_sigue_evento':'sigue_evento',{nombre:proximo.titulo,dias:numero(proximo.desde)-numero(hoy)}):tx('sin_proximo')};
  }
  function meses(a,b){const salida=[];let m=a.slice(0,7);while(m<=b.slice(0,7)){salida.push(m);const d=date(m+'-01');d.setMonth(d.getMonth()+1);m=iso(d).slice(0,7)}return salida}
  function grafico(contenido){
    const r=resumen(),total=numero(hasta)-numero(desde)+1,ang=i=>Math.PI+Math.PI*i/total;
    const punto=(i,rad)=>[340+rad*Math.cos(ang(i)),342+rad*Math.sin(ang(i))].map(v=>v.toFixed(2));
    const banda=(a,b,r0,r1)=>{const p=punto(a,r1),q=punto(b,r1),v=punto(b,r0),w=punto(a,r0);return `M${p.join(' ')}A${r1} ${r1} 0 0 1 ${q.join(' ')}L${v.join(' ')}A${r0} ${r0} 0 0 0 ${w.join(' ')}Z`};
    const arco=(a,b,rad)=>`M${punto(a,rad).join(' ')}A${rad} ${rad} 0 0 1 ${punto(b,rad).join(' ')}`;
    const dibujo=svg('svg',{viewBox:'0 0 680 372',class:'calendario-semicirculo',role:'img','aria-label':tx('resumen_aria',{periodo,fechas:rango({desde,hasta}),semana:r.grande,ahora:r.ahora,sigue:r.sigue})});
    const defs=svg('defs');['suspension','descanso'].forEach(c=>{const p=svg('pattern',{id:'cal-rayado-'+c,width:7,height:7,patternUnits:'userSpaceOnUse',patternTransform:'rotate(45)'});p.appendChild(svg('rect',{width:7,height:7,class:'calendario-patron-fondo'}));p.appendChild(svg('rect',{width:2,height:7,class:'calendario-patron-linea','data-categoria':c}));defs.appendChild(p)});dibujo.appendChild(defs);
    [[228,266],[188,220]].forEach(([a,b],i)=>dibujo.appendChild(svg('path',{d:banda(0,total,a,b),class:'calendario-pista','data-anillo':i})));
    for(const m of meses(desde,hasta)){const a=Math.max(0,numero(m+'-01')-numero(desde)),d=date(m+'-01'),fin=iso(new Date(d.getFullYear(),d.getMonth()+1,1)),b=Math.min(total,numero(fin)-numero(desde));
      if(a>0){const p=punto(a,184),q=punto(a,270);dibujo.appendChild(svg('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:'calendario-tick'}))}
      if(r.dentro&&m===api.hoy().slice(0,7))continue;const medio=(a+b)/2,p=punto(medio,308),co=Math.cos(ang(medio)),t=svg('text',{x:p[0],y:p[1],'text-anchor':co<-.35?'end':co>.35?'start':'middle',class:'calendario-svg-mes','data-mes':m});t.textContent=d.toLocaleDateString('es-MX',{month:'short'});dibujo.appendChild(t);
    }
    grupos.forEach(g=>g.miembros.forEach(e=>{const on=seleccionado(e),a=numero(e.desde)-numero(desde),b=Math.min(total,Math.max(numero(e.hasta)-numero(desde)+1,a+1.4)),m=meta(e);
      const n=svg('g',{class:'calendario-arco','data-desde':e.desde,'data-hasta':e.hasta,'data-pasado':e.hasta<api.hoy(),'data-puntual':!!m.puntual});conectar(n,g.miembros,g.nombre);const title=svg('title');title.textContent=e.titulo;n.appendChild(title);
      if(m.puntual){const p=punto(a+.5,284);n.appendChild(svg('circle',{cx:p[0],cy:p[1],r:on?14:11,class:'calendario-punto-fondo'}));const t=svg('text',{x:p[0],y:Number(p[1])+5,'text-anchor':'middle',class:'calendario-svg-simbolo'});t.textContent=simbolos[e.simbolo]||'•';n.appendChild(t)}
      else{const r0=m.anillo==='interior'?188:228,r1=m.anillo==='interior'?220:266;n.appendChild(svg('path',{d:banda(a,b,r0-(on?3:0),r1+(on?3:0)),class:'calendario-trazo',fill:['suspension','descanso','feriado'].includes(e.categoria)?'url(#cal-rayado-'+(e.categoria==='suspension'?'suspension':'descanso')+')':'var(--cal-color)'}))}dibujo.appendChild(n);
    }));
    const hoy=numero(api.hoy())-numero(desde)+.5;if(eventos.length&&hoy>0)dibujo.appendChild(svg('path',{d:arco(0,Math.min(total,hoy),180),class:'calendario-avance'}));
    if(eventos.length&&r.dentro){const p=punto(hoy,176),q=punto(hoy,282);dibujo.appendChild(svg('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:'calendario-aguja'}));dibujo.appendChild(svg('circle',{cx:q[0],cy:q[1],r:5,class:'calendario-aguja-punta'}))}
    dibujo.appendChild(svg('line',{x1:70,y1:342,x2:610,y2:342,class:'calendario-tick'}));[[96,desde,'extremo_inicio'],[584,hasta,'extremo_fin']].forEach(([x,s,k])=>{const t=svg('text',{x,y:365,'text-anchor':'middle',class:'calendario-svg-extremo'});t.textContent=eventos.length?tx(k,{fecha:breve(s)}):'';dibujo.appendChild(t)});
    const wrap=el('div',null,'calendario-arco-contenedor');wrap.appendChild(dibujo);const centro=el('div',null,'calendario-centro');centro.setAttribute('aria-live','polite');const es=eventos.filter(seleccionado);
    centro.appendChild(el('span',es.length?categoria(es[0]):r.arriba,'calendario-centro-etiqueta'));centro.appendChild(el('strong',es.length?tituloElegido:r.grande));const largo=el('div',null,'calendario-centro-largo');largo.appendChild(el('span',es.length?es.map(e=>e.desde===e.hasta?breve(e.desde):tx('rango',{desde:breve(e.desde),hasta:breve(e.hasta)})).join(' · '):r.ahora));if(!es.length)largo.appendChild(el('span',r.sigue));centro.appendChild(largo);if(es.length)centro.appendChild(boton(tx('volver_hoy'),volver,'cal-volver'));wrap.appendChild(centro);contenido.appendChild(wrap);
    const t=resumen(true),tarjeta=el('div',null,'calendario-resumen');[[t.actual,'ahora',t.ahora],[t.proximo,'sigue',t.sigue]].forEach(([e,k,texto])=>{const b=boton(null,()=>{});b.className='calendario-resumen-fila';b.appendChild(el('small',tx(k)));b.appendChild(el('span',texto));if(e)conectar(b,[e],e.titulo);else b.disabled=true;tarjeta.appendChild(b)});contenido.appendChild(tarjeta);
  }
  function mesGrafico(contenido){
    const disponibles=meses(desde,hasta);if(!disponibles.includes(mes))mes=disponibles.includes(api.hoy().slice(0,7))?api.hoy().slice(0,7):disponibles[0];
    const primero=date(mes+'-01'),ultimo=iso(new Date(primero.getFullYear(),primero.getMonth()+1,0)),inicio=sumar(mes+'-01',-primero.getDay()),fin=sumar(ultimo,6-date(ultimo).getDay());
    const nav=el('div',null,'calendario-nav'),titulo=el('h3',tx('titulo_mes',{mes:primero.toLocaleDateString('es-MX',{month:'long'}),anio:primero.getFullYear()}));titulo.id='cal-mes';titulo.setAttribute('aria-live','polite');
    const mover=salto=>{mes=disponibles[disponibles.indexOf(mes)+salto];foco=null;redibujar(salto<0?'cal-anterior':'cal-proximo')};
    const prev=boton('‹',()=>mover(-1),'cal-anterior'),next=boton('›',()=>mover(1),'cal-proximo');prev.setAttribute('aria-label',tx('anterior'));next.setAttribute('aria-label',tx('proximo'));prev.disabled=mes===disponibles[0];next.disabled=mes===disponibles.at(-1);
    const hoy=boton(tx('boton_hoy'),volver,'cal-hoy');hoy.disabled=!disponibles.includes(api.hoy().slice(0,7));nav.appendChild(titulo);nav.appendChild(prev);nav.appendChild(next);nav.appendChild(hoy);contenido.appendChild(nav);
    const grid=el('div',null,'calendario-mes');grid.setAttribute('aria-labelledby','cal-mes');const head=el('div',null,'calendario-dias-semana');for(let i=0;i<7;i++){const d=new Date(2026,9,4+i),n=el('span',d.toLocaleDateString('es-MX',{weekday:'narrow'}));n.setAttribute('aria-label',d.toLocaleDateString('es-MX',{weekday:'long'}));head.appendChild(n)}grid.appendChild(head);
    if(!foco||foco<inicio||foco>fin)foco=api.hoy()>=inicio&&api.hoy()<=fin?api.hoy():mes+'-01';const botones=[],fechas=el('div',null,'calendario-fechas');
    for(let s=inicio;s<=fin;s=sumar(s,1)){const es=delDia(s,eventos),celda=el('div',null,'calendario-celda'),b=boton(null,()=>{foco=s;elegir(es,es.length===1?es[0].titulo:fecha(s),b)});b.className='calendario-dia';b.tabIndex=s===foco?0:-1;b.setAttribute('data-fecha',s);b.setAttribute('aria-label',tx('evento_aria',{titulo:fecha(s),fechas:es.length?es.map(e=>tx('evento_aria',{titulo:e.titulo,fechas:rango(e)})).join('; '):tx('sin_eventos')}));
      if(s===api.hoy())b.setAttribute('aria-current','date');if(!s.startsWith(mes))celda.className+=' calendario-fuera';if(es.length)b.setAttribute('data-categoria',es[0].categoria);b.appendChild(el('span',String(date(s).getDate()),'calendario-numero'));
      const signos=el('span',null,'calendario-signos');es.forEach(e=>{const n=el('span',simbolos[e.simbolo]||'•','calendario-signo');n.setAttribute('data-categoria',e.categoria);n.setAttribute('data-simbolo',e.simbolo||'relleno');n.setAttribute('aria-hidden','true');signos.appendChild(n)});b.appendChild(signos);if(es.some(e=>e.categoria==='suspension'))b.className+=' calendario-suspension';else if(es.some(e=>['descanso','feriado'].includes(e.categoria)))b.className+=' calendario-rayado';
      b.onkeydown=k=>{const i=botones.indexOf(b),saltos={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7,Home:-date(s).getDay(),End:6-date(s).getDay()};if(k.key in saltos){k.preventDefault();const dest=botones[Math.max(0,Math.min(botones.length-1,i+saltos[k.key]))];botones.forEach(n=>n.tabIndex=-1);dest.tabIndex=0;foco=dest.getAttribute('data-fecha');dest.focus()}else if(k.key==='PageUp'||k.key==='PageDown'){const salto=k.key==='PageUp'?-1:1;if(disponibles[disponibles.indexOf(mes)+salto]){k.preventDefault();mover(salto);dias.find(d=>d.n.tabIndex===0)?.n.focus()}}};botones.push(b);dias.push({s,n:b});celda.appendChild(b);fechas.appendChild(celda);
    }grid.appendChild(fechas);contenido.appendChild(grid);
    const leyenda=el('ul',null,'calendario-categorias');leyenda.setAttribute('aria-label',tx('categorias_presentes'));api.categorias.filter(c=>eventos.some(e=>e.categoria===c&&e.desde<=ultimo&&e.hasta>=mes+'-01')).forEach(c=>{const li=el('li');li.setAttribute('data-categoria',c);li.appendChild(el('span',null,'calendario-muestra'));li.appendChild(el('span',categoria({categoria:c})));leyenda.appendChild(li)});contenido.appendChild(leyenda);
  }
  function detalle(){
    const es=eventos.filter(seleccionado);panel.hidden=!es.length||movil()&&!hoja;panel.setAttribute('aria-labelledby','cal-detalle-titulo');if(panel.hidden)return;
    if(movil()){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');const fondo=boton(null,cerrar);fondo.className='calendario-hoja-fondo';fondo.tabIndex=-1;fondo.setAttribute('aria-label',tx('cerrar_detalle'));box.appendChild(fondo)}
    const h=el('h3',tituloElegido);h.id='cal-detalle-titulo';h.tabIndex=-1;panel.appendChild(h);panel.appendChild(boton(tx('cerrar_detalle'),cerrar,'cal-cerrar'));
    es.forEach(e=>{const s=el('section',null,'calendario-detalle-evento');s.setAttribute('data-categoria',e.categoria);s.appendChild(el('h4',e.titulo));s.appendChild(el('p',rango(e)));s.appendChild(el('small',estado([e])));s.appendChild(el('p',tx('audiencia',{audiencia:(e.audiencia||['alumnos']).map(a=>tx('audiencia_'+a)).join(', ')})));if(e.para)s.appendChild(el('p',tx('condicion_'+e.para)));if(e.nota||e.texto)s.appendChild(el('p',e.nota||e.texto));const fuente=el('details',null,'calendario-fuente');fuente.appendChild(el('summary',tx('fuente_titulo')));fuente.appendChild(el('p',tx('fuente',{fuente:e.fuente||''})));if(e.url){const a=el('a',tx('consultar_fuente'));a.href=e.url;fuente.appendChild(a)}if(e.fuenteOriginal)fuente.appendChild(el('small',e.fuenteOriginal));s.appendChild(fuente);panel.appendChild(s)});
    panel.onkeydown=k=>{if(k.key==='Escape'){k.preventDefault();cerrar()}else if(movil()&&k.key==='Tab'){const ns=Array.from(panel.querySelectorAll('button, a[href], summary')),primero=ns[0],ultimo=ns.at(-1);if(k.shiftKey&&(document.activeElement===primero||document.activeElement===h)){k.preventDefault();ultimo?.focus()}else if(!k.shiftKey&&document.activeElement===ultimo){k.preventDefault();primero?.focus()}}};
  }
  function mostrar(){return globalThis.SateMedicion?globalThis.SateMedicion.render('calendario',mostrarVista):mostrarVista()}
  function mostrarVista(){
    box=document.getElementById('sate-calendario');box.replaceChildren();marcas=[];dias=[];const todos=api.eventos(ampliar),base=SATE_CONFIG.calendarioBase,local=(typeof DATA==='undefined'?null:DATA.calendario)||SATE_CONFIG.calendariosUnidad?.[SATE_UNIDAD];
    const opciones=[...new Set([...Object.keys(base?.periodos||{}),...Object.keys(local?.periodos||{}),...todos.map(e=>e.periodo)])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));periodosDisponibles=opciones;
    const limite=p=>local?.periodos?.[p]||base?.periodos?.[p]||{desde:todos.filter(e=>e.periodo===p).map(e=>e.desde).sort()[0],hasta:todos.filter(e=>e.periodo===p).map(e=>e.hasta).sort().at(-1)};
    if(!opciones.includes(periodo)){periodo=opciones.find(p=>limite(p).desde<=api.hoy()&&limite(p).hasta>=api.hoy())||opciones.find(p=>limite(p).desde>api.hoy())||opciones.at(-1);mes=null;elegidos.clear()}
    const solicitado=api.procesoPendiente;if(solicitado){periodo=solicitado.periodo;mes=solicitado.desde.slice(0,7);elegidos=new Set([identidad(solicitado)]);tituloElegido=solicitado.titulo;hoja=movil();api.procesoPendiente=null}
    eventos=todos.filter(e=>e.periodo===periodo);grupos=agrupar(eventos);limites=limite(periodo);if(!limites.desde)limites={desde:api.hoy(),hasta:api.hoy()};
    // Incluir trámites previos y posteriores sin alterar las semanas del periodo.
    const extremos=[limites.desde,limites.hasta,...eventos.flatMap(e=>[e.desde,e.hasta])].sort();desde=extremos[0];hasta=extremos.at(-1);box.setAttribute('data-estado',!eventos.length?'vacio':api.hoy()<limites.desde?'antes':api.hoy()>limites.hasta?'despues':'durante');
    const cabecera=el('div',null,'calendario-cabecera');cabecera.appendChild(el('h2',SATE.texto('sate.pestana.calendario.titulo')));const label=el('label',null,'calendario-selector'),icon=svg('svg',{viewBox:'0 0 20 20',width:20,height:20,'aria-hidden':'true'});icon.appendChild(svg('circle',{cx:10,cy:10,r:8,fill:'none',stroke:'currentColor'}));icon.appendChild(svg('path',{d:periodo?.endsWith('/1')?'M2 10a8 8 0 0 0 16 0z':'M2 10a8 8 0 0 1 16 0z',fill:'currentColor'}));label.appendChild(icon);
    const select=el('select');select.id='cal-periodo';select.setAttribute('aria-label',tx('periodo'));opciones.forEach(p=>{const o=el('option',tx('periodo_nombre',{periodo:p}));o.value=p;o.selected=p===periodo;select.appendChild(o)});select.onchange=()=>{periodo=select.value;mes=null;elegidos.clear();hoja=false;redibujar('cal-periodo')};label.appendChild(select);cabecera.appendChild(label);box.appendChild(cabecera);
    const aud=el('label',null,'calendario-audiencia'),check=el('input');check.id='cal-audiencia';check.type='checkbox';check.checked=ampliar;check.onchange=()=>{ampliar=check.checked;redibujar(check.id)};aud.appendChild(check);aud.appendChild(el('span',tx('ampliar_audiencia')));box.appendChild(aud);
    const layout=el('div',null,'calendario-layout'),izquierda=el('div',null,'calendario-contenido'),derecha=el('div',null,'calendario-cuadricula');grafico(izquierda);mesGrafico(derecha);layout.appendChild(izquierda);layout.appendChild(derecha);box.appendChild(layout);
    const lista=el('section',null,'calendario-lista');lista.appendChild(el('h3',tx('todo_periodo')));['exterior','interior','puntual'].forEach(anillo=>{const propios=grupos.filter(g=>{const m=meta(g.miembros[0]);return (m.puntual?'puntual':m.anillo||'exterior')===anillo});if(!propios.length)return;const bloque=el('div',null,'calendario-grupo-anillo');bloque.appendChild(el('h4',tx('anillo_'+anillo)));propios.forEach((g,i)=>{const b=boton(null,()=>{});b.id='cal-grupo-'+anillo+'-'+i;b.className='calendario-proceso';b.setAttribute('data-grupo',g.clave);conectar(b,g.miembros,g.nombre);b.appendChild(el('span',g.nombre));b.appendChild(el('small',estado(g.miembros)));bloque.appendChild(b)});lista.appendChild(bloque)});
    izquierda.appendChild(lista);
    panel=el('aside',null,'calendario-detalle');box.appendChild(panel);detalle();resaltar();if(solicitado)document.getElementById('cal-detalle-titulo')?.focus();
  }
  SATE.pestana('calendario',{montar(){},mostrar,ocultar(){hoja=false}});
  if(typeof addEventListener==='function')addEventListener('resize',()=>{if(box?.children.length)mostrar()});
})();
