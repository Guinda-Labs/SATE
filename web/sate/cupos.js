/* Consulta compartida entre pestañas y dispositivos, separada del perfil. */
const CUPOS=(()=>{
  const C=window.IPNCupos,tx=(k,v)=>SATE.texto('sate.cupos.'+k,v);
  let datos=null,omitir=false,version='',ultimoContexto='',eraAntigua=false;
  const canal=typeof BroadcastChannel==='function'?new BroadcastChannel('ipnt-cupos'):null;
  function contexto(){return DATA.opciones_plan?.[S.car]||{carrera:S.car,plan:null}}
  function compatible(){const c=contexto();return datos&&datos.carrera===c.carrera&&(!c.plan||datos.plan===c.plan)}
  function fila(c){return compatible()&&c[0]===S.car?datos.filas.find(f=>f.grupo===c[3]&&f.materia===c[8]):null}
  function insignia(c){const f=fila(c),reducida=document.documentElement?.dataset?.vista==='cupos';return f||reducida?`<span class="cupos-insignia cupos-${!f?'sin-dato':f.disponibles===0?'lleno':C.pocos(f.disponibles)?'pocos':'lugar'}${C.antigua(datos)?' cupos-vieja':''}">${esc(tx(!f?'sin_dato':f.disponibles===0?'lleno':'lugares',{n:f?.disponibles}))}</span>`:''}
  function excluir(c){return omitir&&fila(c)?.disponibles===0}
  function seleccion(){
    const simple=c=>({grupo:c[3],materia:c[8],horas:c[6],nombre:name(c),profesor:profs(c),horario:c[6].map(([d,a,b])=>DAYS[d]+' '+hm(a)+'–'+hm(b)).join(' · ')});
    const tokens={};for(const k of ['texto','superficie','linea','acento'])tokens[k]=getComputedStyle(document.documentElement).getPropertyValue('--ipn-'+k).trim();
    const ctx={...contexto(),periodo:S.per,grupos:selected().map(simple),oferta:classes().filter(c=>c[0]===S.car).map(simple),tokens};
    const s=JSON.stringify(ctx);if(s!==ultimoContexto){ultimoContexto=s;IPNT.set(HU+'cuposContexto',s);canal?.postMessage({tipo:'contexto',unidad:UNIDAD,contexto:ctx});if(window.dispatchEvent)window.dispatchEvent(new Event('sate-cupos-seleccion'))}
  }
  function pintar(){const ayuda=$('#cupos-ayuda'),op=$('#cupos-omitir');if(!ayuda||!op)return;
    const hay=compatible(),vieja=C.antigua(datos),v=hay?datos.hora:'';
    if(v!==version){version=v;omitir=!!hay&&!vieja}if(vieja&&!eraAntigua)omitir=false;eraAntigua=vieja;
    op.disabled=!hay;op.checked=omitir;op.title=vieja?tx('antigua_ayuda'):'';
    $('#cupos-omitir-ayuda').textContent=hay&&vieja?tx('antigua_ayuda'):'';
    const estado=hay?tx('ultima',{hora:C.fecha(datos)})+(vieja?' · '+tx('antigua'):''):'';
    for(const id of ['#cupos-estado','#cupos-estado-horario']){const n=$(id);if(n){n.textContent=estado;n.classList.toggle('cupos-antigua',!!hay&&vieja)}}
    ayuda.textContent=tx('ayuda')+(hay&&vieja?' '+tx('antigua_ayuda'):'');
    const aviso=$('#cupos-llenos');if(aviso){aviso.hidden=!selected().some(c=>fila(c)?.disponibles===0);$('#cupos-llenos-texto').textContent=tx('horario_lleno')}
    for(const n of document.querySelectorAll('[data-cupos-ayuda]'))n.textContent=tx(hay?'actualizar':'consultar');
    seleccion();
  }
  function aceptar(d){if(!C.validar(d)||d.unidad!==UNIDAD)return;const nueva=C.reciente(datos,d);if(nueva===datos)return;datos=C.limpiar(nueva);IPNT.set(HU+'cupos',JSON.stringify(datos));
    if($('#cupos-ayuda')){pintar();if(S.gen){S.gen=generate();renderGen()}renderOffer();renderCal()}}
  function leer(){try{aceptar(JSON.parse((window.IPNT?.almacen||localStorage).getItem(HU+'cupos')))}catch(e){console.warn('SATE Cupos: no se pudo leer la consulta local',e)}}
  async function nube(){if(typeof DEMO!=='undefined'&&DEMO)return;try{aceptar(await IPNT.cupos(UNIDAD))}catch(e){console.warn('SATE Cupos: lectura OneDrive fallida',{unidad:UNIDAD,error:e.message})}}
  window.addEventListener('storage',e=>{if(e.key===HU+'cupos')leer()});
  window.addEventListener('ipnt-sincronizado',nube);
  window.addEventListener('ipnt-cuenta',nube);
  if(canal)canal.onmessage=e=>{if(e.data?.unidad===UNIDAD){if(e.data.tipo==='consulta'&&e.data.datos)aceptar(e.data.datos);else leer()}};
  function montar(){const op=$('#cupos-omitir');if(!op)return;
    op.onchange=()=>{omitir=op.checked;if(S.gen){S.gen=generate();renderGen()}};
    $('#cupos-instalar').textContent=tx('marcador');$('#cupos-omitir-texto').textContent=tx('omitir');
    $('#cupos-alternativas').textContent=tx('alternativas');$('#cupos-alternativas').onclick=()=>{omitir=true;op.checked=true;$('#gen').open=true;S.gen=generate([...new Set(selected().map(c=>c[8]))]);renderGen();$('#cupos-omitir').scrollIntoView({block:'center'})};
    for(const n of document.querySelectorAll('[data-cupos-ayuda]'))n.onclick=()=>{
      const cuerpo=document.createElement('div'),enlace=$('#cupos-instalar').cloneNode(true);enlace.removeAttribute('id');
      const p=document.createElement('p');p.textContent=tx('que_hace');cuerpo.appendChild(p);
      const mismo=document.createElement('p');mismo.textContent=SATE.texto('sate.lector.mismo_marcador');cuerpo.appendChild(mismo);
      const pasos=document.createElement('ol');for(const k of ['paso_instalar','paso_saes','paso_consultar']){const li=document.createElement('li');li.textContent=tx(k);if(k==='paso_instalar')li.appendChild(enlace);pasos.appendChild(li)}cuerpo.appendChild(pasos);
      if(datos){const ultima=document.createElement('p');ultima.textContent=tx('ultima',{hora:C.fecha(datos)});cuerpo.appendChild(ultima)}
      SateUI.modal(tx('consultar'),cuerpo);
    };
    pintar();nube();
  }
  leer();
  setInterval(()=>{if(!document.hidden&&$('#cupos-ayuda')){const antes=omitir;pintar();if(antes!==omitir&&S.gen){S.gen=generate();renderGen()}renderOffer();renderCal()}},60000);
  return {pocos:C.pocos,insignia,excluir,pintar,montar,fila,recibir:aceptar,omitirLlenos(){omitir=true},get datos(){return datos}};
})();
