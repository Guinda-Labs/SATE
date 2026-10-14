/* Fechas civiles y una selección compartida entre el semicírculo, la línea de tiempo, el mes, la agenda y el detalle. */
(function(){
  const api=SATE.calendario,tx=(k,v)=>SATE.texto('sate.calendario.'+k,v);
  const el=(tag,texto,clase)=>{const n=document.createElement(tag);if(texto!=null)n.textContent=texto;if(clase)n.className=clase;return n};
  const svg=(tag,attrs={})=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n};
  const date=s=>new Date(s+'T00:00:00'),numero=s=>Date.parse(s+'T00:00:00Z')/86400000;
  const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const sumar=(s,n)=>{const d=date(s);d.setDate(d.getDate()+n);return iso(d)};
  const fecha=s=>date(s).toLocaleDateString('es-MX',{dateStyle:'long'}),breve=s=>date(s).toLocaleDateString('es-MX',{day:'numeric',month:'short'}).replace('.','');
  const rango=e=>e.desde===e.hasta?fecha(e.desde):tx('rango',{desde:fecha(e.desde),hasta:fecha(e.hasta)});
  const corto=e=>e.desde===e.hasta?breve(e.desde):tx('rango',{desde:breve(e.desde),hasta:breve(e.hasta)});
  const identidad=e=>[e.periodo,e.categoria,e.titulo,e.desde,e.hasta].join('|'),delDia=(s,es)=>es.filter(e=>e.desde<=s&&e.hasta>=s);
  // Teléfono: una sola columna y detalle como hoja inferior.
  const movil=()=>typeof matchMedia==='function'&&matchMedia('(max-width:819px)').matches;
  const simbolos={triangulo:'▲',triangulo_invertido:'▼',estrella:'★',circulo:'○',rayado:'▨',contorno:'□',discontinuo:'┄',relleno:'■'};
  let arribaVisible=true,copiaActiva=false,observador=null,tarjetaMes=null,tarjetaCopia=null,ladoNodo=null;
  let periodo=null,mes=null,foco=null,ampliar=false,verPasados=false,elegidos=new Set(),tituloElegido='',hoja=false,retorno=null;
  let eventos=[],ordenados=[],grupos=[],desde,hasta,limites,box,panel,marcas=[],dias=[],periodosDisponibles=[];
  const seleccionado=e=>elegidos.has(identidad(e)),categoria=e=>tx('categoria_'+e.categoria);
  const meta=e=>SATE_CONFIG.calendarioBase?.vista?.categorias?.[e.categoria]||{};
  // El valor guardado «carriles» corresponde a la vista Detallado; se conserva para no perder la preferencia del alumno.
  const vista=()=>SATE.almacen.get('cal.vista','semicirculo')==='carriles'?'carriles':'semicirculo';
  const pasado=e=>e.hasta<api.hoy(),vigente=e=>e.desde<=api.hoy()&&e.hasta>=api.hoy();
  const idDe=(prefijo,e)=>prefijo+ordenados.indexOf(e);
  function boton(texto,accion,id){const b=el('button',texto,'sate-btn');b.type='button';b.onclick=accion;if(id)b.id=id;return b}
  // Con el mes de abajo activo, el foco se devuelve a su copia.
  const enfocar=id=>((copiaActiva&&document.getElementById(id+'-b'))||document.getElementById(id))?.focus();
  function redibujar(id){mostrar();if(id)enfocar(id)}
  function dias_para(es){const hoy=api.hoy(),futuros=es.filter(e=>e.desde>hoy).map(e=>numero(e.desde));return futuros.length?Math.min(...futuros)-numero(hoy):0}
  function estado(es){const hoy=api.hoy();if(es.every(e=>e.hasta<hoy))return tx('ya_paso');if(es.some(e=>e.desde<=hoy&&e.hasta>=hoy))return tx('ahora');const n=dias_para(es);return n===1?tx('manana'):tx('en_dias',{dias:n})}
  const claseEstado=es=>es.some(vigente)?'ahora':es.every(pasado)?'pasado':dias_para(es)<=7?'pronto':'';
  function agrupar(es){const mapa=new Map();es.forEach(e=>{const clave=e.grupo?'g:'+e.grupo:identidad(e);if(!mapa.has(clave))mapa.set(clave,[]);mapa.get(clave).push(e)});return [...mapa].map(([clave,miembros])=>({clave,miembros,nombre:miembros.length>1?tx('grupo',{nombre:tx('nombre_'+miembros[0].categoria),cantidad:miembros.length}):miembros[0].titulo}))}
  const grupoDe=e=>grupos.find(g=>g.miembros.includes(e));
  function resaltar(){marcas.forEach(({n,es})=>{const on=es.some(seleccionado);n.setAttribute('aria-pressed',on);n.setAttribute('data-seleccionado',on)});dias.forEach(({s,n})=>{const on=eventos.some(e=>seleccionado(e)&&e.desde<=s&&e.hasta>=s);n.setAttribute('data-seleccionado',on);n.setAttribute('aria-pressed',on)})}
  function elegir(es,titulo,origen){
    retorno=origen?.id||null;
    const completos=eventos.filter(e=>es.some(v=>identidad(v)===identidad(e)||v.grupo&&v.grupo===e.grupo));
    elegidos=new Set(completos.map(identidad));tituloElegido=completos.length>1&&completos.every(e=>e.grupo&&e.grupo===completos[0].grupo)?grupos.find(g=>g.miembros.some(e=>identidad(e)===identidad(completos[0])))?.nombre||titulo:titulo;
    hoja=movil()&&completos.length>0;if(es.length&&!es.some(e=>e.desde<=mes+'-31'&&e.hasta>=mes+'-01'))mes=es[0].desde.slice(0,7);mostrar();
    // En teléfono el foco pasa a la hoja; en escritorio vuelve al elemento elegido, que se redibujó.
    if(completos.length&&hoja)document.getElementById('cal-detalle-titulo')?.focus({preventScroll:true});else if(retorno)enfocar(retorno);
  }
  function cerrar(){hoja=false;if(!movil())elegidos.clear();mostrar();enfocar(document.getElementById(retorno)?retorno:'cal-dia-'+api.hoy())}
  function volver(){elegidos.clear();tituloElegido='';hoja=false;mes=api.hoy().slice(0,7);redibujar('cal-dia-'+api.hoy())}
  function conectar(n,es,titulo){n.setAttribute('data-categoria',es[0].categoria);n.setAttribute('aria-label',es.map(e=>tx('evento_aria',{titulo:e.titulo,fechas:rango(e)})).join('; '));n.onclick=()=>elegir(es,titulo,n);if(n.tagName.toLowerCase()==='g'){n.setAttribute('role','button');n.setAttribute('tabindex',0);n.onkeydown=k=>{if(k.key==='Enter'||k.key===' '){k.preventDefault();n.onclick()}}}marcas.push({n,es})}
  function resumen(sinEtiqueta=false){
    const hoy=api.hoy(),actual=eventos.find(e=>e.desde<=hoy&&e.hasta>=hoy),proximo=[...eventos].sort((a,b)=>a.desde.localeCompare(b.desde)).find(e=>e.desde>hoy),dentro=hoy>=limites.desde&&hoy<=limites.hasta;
    const [anio,mitad]=String(periodo||'').split('/'),siguiente=mitad==='1'?anio+'/2':String(Number(anio)+1)+'/1';
    return {actual,proximo,dentro,arriba:tx('hoy_fecha',{fecha:date(hoy).toLocaleDateString('es-MX',{weekday:'short',day:'numeric',month:'short'}).replace('.','')}),
      grande:!eventos.length?tx('vacio'):hoy<limites.desde?tx('faltan_dias',{dias:numero(limites.desde)-numero(hoy)}):hoy>limites.hasta?tx('cerrado'):tx('semana_actual',{semana:Math.floor((numero(hoy)-numero(limites.desde))/7)+1,total:Math.ceil((numero(limites.hasta)-numero(limites.desde)+1)/7)}),
      ahora:!eventos.length?tx('vacio_mensaje'):hoy>limites.hasta?tx('termino',{fecha:breve(limites.hasta)}):hoy<limites.desde?tx('inicia',{fecha:breve(limites.desde)}):actual?tx(sinEtiqueta?'tarjeta_ahora_evento':'ahora_evento',{nombre:actual.titulo}):tx(sinEtiqueta?'tarjeta_ahora_clases':'ahora_clases'),
      sigue:hoy>limites.hasta?tx(periodosDisponibles.includes(siguiente)?'siguiente_publicado':'siguiente_pendiente',{periodo:siguiente}):proximo?tx(sinEtiqueta?'tarjeta_sigue_evento':'sigue_evento',{nombre:proximo.titulo,dias:numero(proximo.desde)-numero(hoy)}):tx('sin_proximo')};
  }
  function meses(a,b){const salida=[];let m=a.slice(0,7);while(m<=b.slice(0,7)){salida.push(m);const d=date(m+'-01');d.setMonth(d.getMonth()+1);m=iso(d).slice(0,7)}return salida}

  /* Renglón superior común: resumen del periodo y mes chico. */
  function chip(e,etiqueta,i,ahora){
    const b=boton(null,()=>{},'cal-chip-'+i);b.className='calendario-ficha'+(ahora?' calendario-ficha-ahora':'');conectar(b,[e],e.titulo);
    const punto=el('span',null,'calendario-ficha-punto');punto.setAttribute('aria-hidden','true');b.appendChild(punto);b.appendChild(el('small',etiqueta));b.appendChild(el('span',e.titulo));return b;
  }
  function bloqueResumen(){
    const r=resumen(),hoy=api.hoy(),tarjeta=el('section',null,'calendario-tarjeta calendario-estado');tarjeta.setAttribute('aria-label',tx('resumen_periodo'));
    const semana=el('div',null,'calendario-semana');semana.appendChild(el('span',r.arriba,'calendario-hoy-fecha'));semana.appendChild(el('strong',r.grande));
    semana.appendChild(el('span',!eventos.length?tx('vacio_mensaje'):hoy<desde?tx('inicia',{fecha:breve(limites.desde)}):hoy>hasta?tx('termino',{fecha:breve(hasta)}):hoy<limites.desde?tx('inicia',{fecha:breve(limites.desde)}):tx('de_clases'),'calendario-semana-sub'));tarjeta.appendChild(semana);
    const avance=el('div',null,'calendario-avance-bloque');
    if(eventos.length){
      const barra=el('div',null,'calendario-barra'),relleno=el('i');relleno.style.width=Math.max(2,Math.min(100,100*(numero(hoy)-numero(desde))/Math.max(1,numero(hasta)-numero(desde))))+'%';barra.setAttribute('aria-hidden','true');barra.appendChild(relleno);avance.appendChild(barra);
      const extremos=el('div',null,'calendario-extremos');[['extremo_inicio',desde],['extremo_fin',hasta]].forEach(([k,s])=>extremos.appendChild(el('span',tx(k,{fecha:breve(s)}))));avance.appendChild(extremos);
    }
    // Fichas: lo que ocurre ahora y las dos fechas siguientes (un grupo cuenta una vez).
    const fichas=el('div',null,'calendario-fichas'),vistos=new Set(),unico=e=>{const k=grupoDe(e)?.clave||identidad(e);if(vistos.has(k))return false;vistos.add(k);return true};
    ordenados.filter(vigente).filter(unico).slice(0,2).forEach(e=>fichas.appendChild(chip(e,tx('ahora'),ordenados.indexOf(e),true)));
    ordenados.filter(e=>e.desde>hoy).filter(unico).slice(0,2).forEach(e=>fichas.appendChild(chip(e,estado([e]),ordenados.indexOf(e),false)));
    avance.appendChild(fichas);tarjeta.appendChild(avance);return tarjeta;
  }
  function bloqueMes(suf=''){
    const disponibles=meses(desde,hasta);if(!disponibles.includes(mes))mes=disponibles.includes(api.hoy().slice(0,7))?api.hoy().slice(0,7):disponibles[0];
    const tarjeta=el('section',null,'calendario-tarjeta calendario-mes-chico'),primero=date(mes+'-01'),ultimo=iso(new Date(primero.getFullYear(),primero.getMonth()+1,0)),inicio=sumar(mes+'-01',-primero.getDay()),fin=sumar(ultimo,6-date(ultimo).getDay());
    const nav=el('div',null,'calendario-nav'),titulo=el('h3',tx('titulo_mes',{mes:primero.toLocaleDateString('es-MX',{month:'long'}),anio:primero.getFullYear()}));titulo.id='cal-mes'+suf;titulo.setAttribute('aria-live','polite');
    const mover=salto=>{mes=disponibles[disponibles.indexOf(mes)+salto];foco=null;redibujar(salto<0?'cal-anterior':'cal-proximo')};
    const prev=boton('‹',()=>mover(-1),'cal-anterior'+suf),next=boton('›',()=>mover(1),'cal-proximo'+suf);prev.setAttribute('aria-label',tx('anterior'));next.setAttribute('aria-label',tx('proximo'));prev.disabled=mes===disponibles[0];next.disabled=mes===disponibles.at(-1);
    nav.appendChild(prev);nav.appendChild(titulo);nav.appendChild(next);tarjeta.appendChild(nav);
    const grid=el('div',null,'calendario-mes');grid.setAttribute('aria-labelledby','cal-mes'+suf);const head=el('div',null,'calendario-dias-semana');for(let i=0;i<7;i++){const d=new Date(2026,9,4+i),n=el('span',d.toLocaleDateString('es-MX',{weekday:'narrow'}));n.setAttribute('aria-label',d.toLocaleDateString('es-MX',{weekday:'long'}));head.appendChild(n)}grid.appendChild(head);
    if(!foco||foco<inicio||foco>fin)foco=api.hoy()>=inicio&&api.hoy()<=fin?api.hoy():mes+'-01';const botones=[],fechas=el('div',null,'calendario-fechas');
    for(let s=inicio;s<=fin;s=sumar(s,1)){const es=delDia(s,eventos),celda=el('div',null,'calendario-celda'),b=boton(null,()=>{foco=s;elegir(es,es.length===1?es[0].titulo:fecha(s),b)});b.className='calendario-dia';b.id='cal-dia-'+s+suf;b.tabIndex=s===foco?0:-1;b.setAttribute('data-fecha',s);b.setAttribute('aria-label',tx('evento_aria',{titulo:fecha(s),fechas:es.length?es.map(e=>tx('evento_aria',{titulo:e.titulo,fechas:rango(e)})).join('; '):tx('sin_eventos')}));
      if(s===api.hoy())b.setAttribute('aria-current','date');if(!s.startsWith(mes))celda.className+=' calendario-fuera';if(es.length)b.setAttribute('data-categoria',(es.find(seleccionado)||es[0]).categoria);b.appendChild(el('span',String(date(s).getDate()),'calendario-numero'));
      const signos=el('span',null,'calendario-signos');[...new Set(es.map(e=>e.categoria))].slice(0,3).forEach(c=>{const n=el('span',null,'calendario-signo');n.setAttribute('data-categoria',c);n.setAttribute('aria-hidden','true');signos.appendChild(n)});b.appendChild(signos);if(es.some(e=>e.categoria==='suspension'))b.className+=' calendario-suspension';else if(es.some(e=>['descanso','feriado'].includes(e.categoria)))b.className+=' calendario-rayado';
      b.onkeydown=k=>{const i=botones.indexOf(b),saltos={ArrowRight:1,ArrowLeft:-1,ArrowDown:7,ArrowUp:-7,Home:-date(s).getDay(),End:6-date(s).getDay()};if(k.key in saltos){k.preventDefault();const dest=botones[Math.max(0,Math.min(botones.length-1,i+saltos[k.key]))];botones.forEach(n=>n.tabIndex=-1);dest.tabIndex=0;foco=dest.getAttribute('data-fecha');dest.focus()}else if(k.key==='PageUp'||k.key==='PageDown'){const salto=k.key==='PageUp'?-1:1;if(disponibles[disponibles.indexOf(mes)+salto]){k.preventDefault();mover(salto);enfocar('cal-dia-'+foco)}}};botones.push(b);dias.push({s,n:b});celda.appendChild(b);fechas.appendChild(celda);
    }grid.appendChild(fechas);tarjeta.appendChild(grid);return tarjeta;
  }

  // Un solo mes chico activo: si el de arriba sale de la vista, aparece su copia sobre el detalle (fija aunque el detalle cambie de altura).
  function aplicarCopia(){
    if(!tarjetaMes||!tarjetaCopia)return;
    const activa=!movil()&&!arribaVisible,id=document.activeElement?.id||'',delMes=/^cal-(dia-|anterior|proximo)/.test(id);
    if(activa!==copiaActiva&&delMes){const destino=activa?(id.endsWith('-b')?null:id+'-b'):(id.endsWith('-b')?id.slice(0,-2):null);if(destino)document.getElementById(destino)?.focus()}
    copiaActiva=activa;tarjetaCopia.hidden=!activa;tarjetaMes.inert=activa;tarjetaMes.setAttribute('aria-hidden',String(activa));tarjetaMes.setAttribute('data-inactivo',String(activa));ladoNodo?.setAttribute('data-copia',String(activa));
  }

  /* Vista Compacto: semicírculo con dos anillos, aguja y centro como etiqueta. */
  function semicirculo(contenido){
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
      const n=svg('g',{class:'calendario-arco','data-desde':e.desde,'data-hasta':e.hasta,'data-pasado':e.hasta<api.hoy(),'data-puntual':!!m.puntual});n.id=idDe('cal-arco-',e);conectar(n,g.miembros,g.nombre);const title=svg('title');title.textContent=e.titulo;n.appendChild(title);
      if(m.puntual){const p=punto(a+.5,284);n.appendChild(svg('circle',{cx:p[0],cy:p[1],r:on?14:11,class:'calendario-punto-fondo'}));const t=svg('text',{x:p[0],y:Number(p[1])+5,'text-anchor':'middle',class:'calendario-svg-simbolo'});t.textContent=simbolos[e.simbolo]||'•';n.appendChild(t)}
      else{const r0=m.anillo==='interior'?188:228,r1=m.anillo==='interior'?220:266;n.appendChild(svg('path',{d:banda(a,b,r0-(on?3:0),r1+(on?3:0)),class:'calendario-trazo',fill:['suspension','descanso','feriado'].includes(e.categoria)?'url(#cal-rayado-'+(e.categoria==='suspension'?'suspension':'descanso')+')':'var(--cal-color)'}))}dibujo.appendChild(n);
    }));
    const hoy=numero(api.hoy())-numero(desde)+.5;if(eventos.length&&hoy>0)dibujo.appendChild(svg('path',{d:arco(0,Math.min(total,hoy),180),class:'calendario-avance'}));
    if(eventos.length&&r.dentro){const p=punto(hoy,176),q=punto(hoy,282);dibujo.appendChild(svg('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],class:'calendario-aguja'}));dibujo.appendChild(svg('circle',{cx:q[0],cy:q[1],r:5,class:'calendario-aguja-punta'}))}
    dibujo.appendChild(svg('line',{x1:70,y1:342,x2:610,y2:342,class:'calendario-tick'}));[[96,desde,'extremo_inicio'],[584,hasta,'extremo_fin']].forEach(([x,s,k])=>{const t=svg('text',{x,y:365,'text-anchor':'middle',class:'calendario-svg-extremo'});t.textContent=eventos.length?tx(k,{fecha:breve(s)}):'';dibujo.appendChild(t)});
    const wrap=el('div',null,'calendario-arco-contenedor');wrap.appendChild(dibujo);encabezado(wrap);contenido.appendChild(wrap);
  }
  function encabezado(contenido){
    const r=resumen(),centro=el('div',null,'calendario-centro');centro.setAttribute('aria-live','polite');const es=eventos.filter(seleccionado);
    centro.appendChild(el('span',es.length?categoria(es[0]):r.arriba,'calendario-centro-etiqueta'));centro.appendChild(el('strong',es.length?tituloElegido:r.grande));const largo=el('div',null,'calendario-centro-largo');largo.appendChild(el('span',es.length?es.map(corto).join(' · '):r.ahora));if(!es.length)largo.appendChild(el('span',r.sigue));centro.appendChild(largo);if(es.length)centro.appendChild(boton(tx('volver_hoy'),volver,'cal-volver'));contenido.appendChild(centro);
  }

  /* Vista Detallado: todo el periodo de un vistazo, una fila por tipo de fecha que tenga eventos. */
  function filasDe(){
    const orden=SATE_CONFIG.calendarioBase?.vista?.filas||[],fila=e=>meta(e).fila||'otros',ids=[...new Set([...orden,...eventos.map(fila),'otros'])];
    return ids.map(id=>({id,evs:ordenados.filter(e=>fila(e)===id)})).filter(f=>f.evs.length);
  }
  function linea(contenido){
    const tarjeta=el('section',null,'calendario-tarjeta calendario-linea-tarjeta'),encabezadoLinea=el('div',null,'calendario-tarjeta-cab'),cab=el('h3',null,'calendario-tarjeta-titulo');cab.id='cal-linea-titulo';cab.appendChild(el('span',tx('linea_titulo')));
    if(eventos.length)cab.appendChild(el('small',tx('linea_ayuda')));encabezadoLinea.appendChild(cab);if(elegidos.size)encabezadoLinea.appendChild(boton(tx('volver_hoy'),volver,'cal-volver'));tarjeta.appendChild(encabezadoLinea);
    if(!eventos.length){tarjeta.appendChild(el('p',tx('vacio_mensaje'),'calendario-vacio'));contenido.appendChild(tarjeta);return}
    const total=numero(hasta)-numero(desde)+1,pos=s=>(numero(s)-numero(desde))/total*100,r=resumen();
    const raiz=el('div',null,'calendario-linea');raiz.setAttribute('role','group');raiz.setAttribute('aria-labelledby',cab.id);raiz.setAttribute('aria-describedby','cal-linea-resumen');
    const sr=el('p',tx('linea_resumen_aria',{periodo,fechas:rango({desde,hasta}),semana:r.grande,ahora:r.ahora,sigue:r.sigue}),'sate-sr');sr.id='cal-linea-resumen';raiz.appendChild(sr);
    const ms=meses(desde,hasta),cabMeses=el('div',null,'calendario-linea-meses');cabMeses.style.gridTemplateColumns=ms.map(m=>{const d=date(m+'-01'),a=Math.max(numero(m+'-01'),numero(desde)),b=Math.min(numero(iso(new Date(d.getFullYear(),d.getMonth()+1,1))),numero(hasta)+1);return (b-a)+'fr'}).join(' ');
    ms.forEach(m=>{const s=el('span',date(m+'-01').toLocaleDateString('es-MX',{month:'short'}).replace('.',''));s.setAttribute('data-mes',m);cabMeses.appendChild(s)});raiz.appendChild(cabMeses);
    const cuerpo=el('div',null,'calendario-linea-cuerpo');
    filasDe().forEach(({id,evs})=>{
      const fila=el('div',null,'calendario-linea-fila');fila.setAttribute('data-fila',id);const etq=el('b',tx('fila_'+id));fila.appendChild(etq);
      const pista=el('div',null,'calendario-linea-pista');
      // Los eventos que se traslapan se apilan en carriles dentro de la misma fila.
      const items=evs.map(e=>{const puntual=!!meta(e).puntual,a=pos(e.desde)+(puntual?50/total:0),ancho=puntual?0:(numero(e.hasta)-numero(e.desde)+1)/total*100;return {e,puntual,a,ancho,fin:puntual?a+1.6:Math.max(a+ancho,a+.9)+.3}}),ocupados=[];
      items.forEach(it=>{let l=ocupados.findIndex(f=>f<=it.a);if(l<0)l=ocupados.length;ocupados[l]=it.fin;it.lane=l});
      const carriles=Math.max(1,ocupados.length);pista.setAttribute('data-carriles',carriles);pista.style.height=carriles===1?'34px':(carriles*26+8)+'px';
      items.forEach(it=>{
        const {e,puntual}=it,top=carriles===1?7:4+it.lane*26,b=boton(null,()=>{},idDe('cal-ev-',e));b.className='calendario-ev';conectar(b,[e],e.titulo);
        b.setAttribute('data-puntual',puntual);b.setAttribute('data-pasado',pasado(e));b.setAttribute('data-rayado',['suspension','descanso','feriado','sindical'].includes(e.categoria));b.setAttribute('data-desde',e.desde);b.setAttribute('data-hasta',e.hasta);b.setAttribute('data-grupo',grupoDe(e)?.clave||'');b.title=e.titulo+' · '+corto(e);
        b.style.left=it.a+'%';b.style.top=top+(puntual?4:0)+'px';if(!puntual)b.style.width=it.ancho+'%';pista.appendChild(b);
        const siguiente=items.filter(o=>o.lane===it.lane&&o.a>it.a)[0],espacio=(siguiente?siguiente.a:100)-it.fin;
        if(espacio>=14){const n=el('span',e.titulo.replace(/ \(registro\)$/,''),'calendario-linea-nombre');n.style.left='calc('+it.fin+'% + 4px)';n.style.top=(top+2)+'px';n.style.width='calc('+(espacio-1)+'% - 8px)';n.setAttribute('aria-hidden','true');pista.appendChild(n)}
      });
      fila.appendChild(pista);cuerpo.appendChild(fila);
    });
    if(r.dentro||api.hoy()>=desde&&api.hoy()<=hasta){const ov=el('div',null,'calendario-linea-hoy-capa'),l=el('div',null,'calendario-linea-hoy');l.style.left=pos(api.hoy())+'%';l.setAttribute('data-etiqueta',tx('linea_hoy'));l.setAttribute('aria-hidden','true');ov.appendChild(l);cuerpo.appendChild(ov)}
    raiz.appendChild(cuerpo);tarjeta.appendChild(raiz);tarjeta.appendChild(el('p',tx('linea_leyenda'),'calendario-linea-leyenda'));contenido.appendChild(tarjeta);
  }

  /* «Lo que viene»: agenda por mes con lo pasado plegado. */
  function agenda(){
    const tarjeta=el('section',null,'calendario-tarjeta calendario-agenda'),pasados=ordenados.filter(pasado),resto=ordenados.filter(e=>!pasado(e));
    const cab=el('h3',null,'calendario-tarjeta-titulo');cab.id='cal-agenda-titulo';cab.appendChild(el('span',tx('agenda_titulo')));cab.appendChild(el('small',tx('agenda_cuantos',{n:resto.length})));tarjeta.appendChild(cab);
    if(!eventos.length){tarjeta.appendChild(el('p',tx('vacio_mensaje'),'calendario-vacio'));return tarjeta}
    if(pasados.length){const b=boton(tx(verPasados?'pasados_ocultar':'pasados_ver',{n:pasados.length}),()=>{verPasados=!verPasados;redibujar('cal-pasados')},'cal-pasados');b.className='calendario-pasados';b.setAttribute('aria-expanded',verPasados);tarjeta.appendChild(b)}
    const lista=verPasados?ordenados:resto,porMes=new Map();lista.forEach(e=>{const m=e.desde.slice(0,7);if(!porMes.has(m))porMes.set(m,[]);porMes.get(m).push(e)});
    if(!lista.length)tarjeta.appendChild(el('p',tx('agenda_vacia'),'calendario-vacio'));
    const cuerpo=el('div',null,'calendario-agenda-lista');
    porMes.forEach((es,m)=>{
      const seccion=el('section',null,'calendario-agenda-mes'),d=date(m+'-01');seccion.setAttribute('data-mes',m);seccion.appendChild(el('h4',tx('titulo_mes',{mes:d.toLocaleDateString('es-MX',{month:'long'}),anio:d.getFullYear()})));
      es.forEach(e=>{
        const b=boton(null,()=>{},idDe('cal-ag-',e));b.className='calendario-item';conectar(b,[e],e.titulo);b.setAttribute('data-estado',claseEstado([e]));
        const f=el('span',null,'calendario-fecha');f.appendChild(el('b',String(date(e.desde).getDate())));f.appendChild(el('small',date(e.desde).toLocaleDateString('es-MX',{weekday:'short'}).replace('.','')));b.appendChild(f);
        const t=el('span',null,'calendario-item-texto');t.appendChild(el('span',e.titulo,'calendario-item-titulo'));const g=grupoDe(e);t.appendChild(el('small',[categoria(e),corto(e)].concat(g.miembros.length>1?[g.nombre]:[]).join(' · ')));b.appendChild(t);
        b.appendChild(el('span',estado([e]),'calendario-pildora'));seccion.appendChild(b);
      });
      cuerpo.appendChild(seccion);
    });
    tarjeta.appendChild(cuerpo);return tarjeta;
  }

  /* Detalle: tarjeta lateral en escritorio y hoja inferior en teléfono. */
  function detalle(){
    const elegidosEv=ordenados.filter(seleccionado),sugerido=ordenados.find(e=>!pasado(e)),es=elegidosEv.length?elegidosEv:(!movil()&&sugerido?[sugerido]:[]);
    panel.hidden=movil()&&(!hoja||!elegidosEv.length);panel.setAttribute('aria-labelledby','cal-detalle-titulo');if(panel.hidden)return;
    if(movil()){panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');const fondo=boton(null,cerrar);fondo.className='calendario-hoja-fondo';fondo.tabIndex=-1;fondo.setAttribute('aria-label',tx('cerrar_detalle'));box.appendChild(fondo)}else panel.setAttribute('aria-live','polite');
    const h=el('h3',elegidosEv.length?tituloElegido:es.length?es[0].titulo:tx('detalle'));h.id='cal-detalle-titulo';h.tabIndex=-1;panel.appendChild(h);if(movil())panel.appendChild(boton(tx('cerrar_detalle'),cerrar,'cal-cerrar'));
    if(!es.length)panel.appendChild(el('p',tx('detalle_vacio'),'calendario-detalle-vacio'));
    es.forEach(e=>{const s=el('section',null,'calendario-detalle-evento');s.setAttribute('data-categoria',e.categoria);s.appendChild(el('small',categoria(e),'calendario-detalle-categoria'));if(es.length>1)s.appendChild(el('h4',e.titulo));s.appendChild(el('p',rango(e)));s.appendChild(el('strong',estado([e]),'calendario-cuenta'));s.appendChild(el('p',tx('audiencia',{audiencia:(e.audiencia||['alumnos']).map(a=>tx('audiencia_'+a)).join(', ')})));if(e.para)s.appendChild(el('p',tx('condicion_'+e.para)));if(e.nota||e.texto)s.appendChild(el('p',e.nota||e.texto));const fuente=el('details',null,'calendario-fuente');fuente.appendChild(el('summary',tx('fuente_titulo')));fuente.appendChild(el('p',tx('fuente',{fuente:e.fuente||''})));if(e.url){const a=el('a',tx('consultar_fuente'));a.href=e.url;fuente.appendChild(a)}if(e.fuenteOriginal)fuente.appendChild(el('small',e.fuenteOriginal));s.appendChild(fuente);panel.appendChild(s)});
    if(elegidosEv.length&&!movil())panel.appendChild(boton(tx('volver_hoy'),volver,'cal-volver-detalle'));
    panel.onkeydown=k=>{if(k.key==='Escape'&&movil()){k.preventDefault();cerrar()}else if(movil()&&k.key==='Tab'){const ns=Array.from(panel.querySelectorAll('button, a[href], summary')),primero=ns[0],ultimo=ns.at(-1);if(k.shiftKey&&(document.activeElement===primero||document.activeElement===h)){k.preventDefault();ultimo?.focus()}else if(!k.shiftKey&&document.activeElement===ultimo){k.preventDefault();primero?.focus()}}};
  }
  function mostrar(){return globalThis.SateMedicion?globalThis.SateMedicion.render('calendario',mostrarVista):mostrarVista()}
  function mostrarVista(){
    box=document.getElementById('sate-calendario');box.replaceChildren();marcas=[];dias=[];const todos=api.eventos(ampliar),base=SATE_CONFIG.calendarioBase,local=(typeof DATA==='undefined'?null:DATA.calendario)||SATE_CONFIG.calendariosUnidad?.[SATE_UNIDAD];
    const opciones=[...new Set([...Object.keys(base?.periodos||{}),...Object.keys(local?.periodos||{}),...todos.map(e=>e.periodo)])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));periodosDisponibles=opciones;
    const limite=p=>local?.periodos?.[p]||base?.periodos?.[p]||{desde:todos.filter(e=>e.periodo===p).map(e=>e.desde).sort()[0],hasta:todos.filter(e=>e.periodo===p).map(e=>e.hasta).sort().at(-1)};
    if(!opciones.includes(periodo)){periodo=opciones.find(p=>limite(p).desde<=api.hoy()&&limite(p).hasta>=api.hoy())||opciones.find(p=>limite(p).desde>api.hoy())||opciones.at(-1);mes=null;elegidos.clear()}
    const solicitado=api.procesoPendiente;if(solicitado){periodo=solicitado.periodo;mes=solicitado.desde.slice(0,7);elegidos=new Set([identidad(solicitado)]);tituloElegido=solicitado.titulo;hoja=movil();api.procesoPendiente=null}
    eventos=todos.filter(e=>e.periodo===periodo);ordenados=[...eventos].sort((a,b)=>a.desde.localeCompare(b.desde)||a.hasta.localeCompare(b.hasta));grupos=agrupar(eventos);limites=limite(periodo);if(!limites.desde)limites={desde:api.hoy(),hasta:api.hoy()};
    // Incluir trámites previos y posteriores sin alterar las semanas del periodo.
    const extremos=[limites.desde,limites.hasta,...eventos.flatMap(e=>[e.desde,e.hasta])].sort();desde=extremos[0];hasta=extremos.at(-1);box.setAttribute('data-estado',!eventos.length?'vacio':api.hoy()<limites.desde?'antes':api.hoy()>limites.hasta?'despues':'durante');box.setAttribute('data-vista',vista());
    const cabecera=el('div',null,'calendario-cabecera');cabecera.appendChild(el('h2',SATE.texto('sate.pestana.calendario.titulo')));const controles=el('div',null,'calendario-controles'),label=el('label',null,'calendario-selector'),icon=svg('svg',{viewBox:'0 0 20 20',width:20,height:20,'aria-hidden':'true'});icon.appendChild(svg('circle',{cx:10,cy:10,r:8,fill:'none',stroke:'currentColor'}));icon.appendChild(svg('path',{d:periodo?.endsWith('/1')?'M2 10a8 8 0 0 0 16 0z':'M2 10a8 8 0 0 1 16 0z',fill:'currentColor'}));label.appendChild(icon);
    const select=el('select');select.id='cal-periodo';select.setAttribute('aria-label',tx('periodo'));opciones.forEach(p=>{const o=el('option',tx('periodo_nombre',{periodo:p}));o.value=p;o.selected=p===periodo;select.appendChild(o)});select.onchange=()=>{periodo=select.value;mes=null;elegidos.clear();hoja=false;verPasados=false;redibujar('cal-periodo')};label.appendChild(select);controles.appendChild(label);
    const selector=el('div',null,'calendario-vistas');selector.setAttribute('role','group');selector.setAttribute('aria-label',tx('vista'));['semicirculo','carriles'].forEach(v=>{const b=boton(tx('vista_'+v),()=>{SATE.almacen.set('cal.vista',v);redibujar('cal-vista-'+v)},'cal-vista-'+v);b.setAttribute('aria-pressed',vista()===v);selector.appendChild(b)});controles.appendChild(selector);cabecera.appendChild(controles);box.appendChild(cabecera);
    const aud=el('label',null,'calendario-audiencia'),check=el('input');check.id='cal-audiencia';check.type='checkbox';check.checked=ampliar;check.onchange=()=>{ampliar=check.checked;redibujar(check.id)};aud.appendChild(check);aud.appendChild(el('span',tx('ampliar_audiencia')));box.appendChild(aud);
    // Acomodo común: arriba resumen y mes; abajo el bloque principal a todo lo ancho; luego agenda y detalle.
    const arriba=el('div',null,'calendario-arriba');tarjetaMes=bloqueMes();arriba.appendChild(bloqueResumen());arriba.appendChild(tarjetaMes);box.appendChild(arriba);
    const principal=el('div',null,'calendario-principal');if(vista()==='carriles')linea(principal);else semicirculo(principal);box.appendChild(principal);
    const abajo=el('div',null,'calendario-abajo');abajo.appendChild(agenda());ladoNodo=el('div',null,'calendario-lado');panel=el('aside',null,'calendario-detalle');tarjetaCopia=bloqueMes('-b');tarjetaCopia.hidden=true;ladoNodo.appendChild(tarjetaCopia);ladoNodo.appendChild(panel);abajo.appendChild(ladoNodo);box.appendChild(abajo);
    detalle();resaltar();observador?.disconnect?.();observador=null;if(typeof IntersectionObserver==='function'){observador=new IntersectionObserver(es=>{const ultimo=es.at(-1);if(ultimo&&ultimo.isIntersecting!==arribaVisible){arribaVisible=ultimo.isIntersecting;aplicarCopia()}},{threshold:0});observador.observe(tarjetaMes)}aplicarCopia();if(solicitado)document.getElementById('cal-detalle-titulo')?.focus();
  }
  SATE.pestana('calendario',{montar(){},mostrar,ocultar(){hoja=false}});
  if(typeof addEventListener==='function')addEventListener('resize',()=>{if(box?.children.length)mostrar()});
})();
