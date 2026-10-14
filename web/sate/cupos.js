/* Datos efímeros de grupo: no pertenecen al perfil ni a su sincronización. */
const CUPOS=(()=>{
  const C=window.IPNCupos, tx=(k,v)=>SATE.texto('sate.cupos.'+k,v);
  let datos=null,puente=null,origen=null,omitir=false,ultimaSeleccion='';
  try{const d=JSON.parse(sessionStorage.getItem(HU+'cupos'));if(C.validar(d)&&d.unidad===UNIDAD)datos=d}catch(e){}
  function contexto(){return DATA.opciones_plan?.[S.car]||{carrera:S.car,plan:null}}
  function fila(c){const ctx=contexto();return datos&&c[0]===S.car&&datos.carrera===ctx.carrera&&(!ctx.plan||datos.plan===ctx.plan)?datos.filas.find(f=>f.grupo===c[3]&&f.materia===c[8]):null}
  function vieja(){return !datos||Date.now()-Date.parse(datos.hora)>600000}
  function insignia(c){const f=fila(c);if(!f)return '';const n=Math.max(0,Math.floor((Date.now()-Date.parse(datos.hora))/60000));
    return `<span class="cupos-insignia${vieja()?' cupos-vieja':''}" title="${esc(new Date(datos.hora).toLocaleTimeString('es-MX'))}">${esc(tx(f.disponibles===0?'lleno':'lugares',{n:f.disponibles}))} · ${esc(tx(vieja()?'sin_actualizar':'hace',{n}))}</span>`}
  function excluir(c){return omitir&&!vieja()&&fila(c)?.disponibles===0}
  function enviarSeleccion(){if(!puente||puente.closed)return;const grupos=selected().map(c=>({grupo:c[3],materia:c[8]})),s=JSON.stringify(grupos);
    if(s!==ultimaSeleccion){puente.postMessage({tipo:'ipnt.cupos.seleccion',v:1,grupos},origen);ultimaSeleccion=s}}
  function pintar(){const ayuda=$('#cupos-ayuda'),op=$('#cupos-omitir');if(!ayuda||!op)return;
    const ctx=contexto(),hay=datos&&!vieja()&&datos.carrera===ctx.carrera&&(!ctx.plan||datos.plan===ctx.plan)&&datos.filas.length>0;
    const cambio=omitir&&!hay;if(!hay)omitir=false;op.disabled=!hay;op.checked=omitir;
    if(cambio&&S.gen){S.gen=generate();renderGen()}
    ayuda.textContent=tx(puente&&!puente.closed?'conectado':'ayuda');enviarSeleccion()}
  function mensaje(e){if(!C.origenSaes(e.origin)||e.source!==window.opener)return;
    const esperado=new URL(SATE_CONFIG.unidades[UNIDAD].saes).hostname.replace(/^www\./,'');
    if(new URL(e.origin).hostname.replace(/^www\./,'')!==esperado)return;
    const d=e.data;if(d?.tipo!=='ipnt.cupos.hola'&&!C.validar(d))return;
    if(d.unidad!==UNIDAD)return;puente=e.source;origen=e.origin;ultimaSeleccion='';
    if(C.validar(d)){datos={tipo:d.tipo,v:1,unidad:d.unidad,carrera:d.carrera,plan:d.plan,hora:d.hora,filas:d.filas.map(({grupo,materia,cupo,inscritos,disponibles})=>({grupo,materia,cupo,inscritos,disponibles}))};
      try{sessionStorage.setItem(HU+'cupos',JSON.stringify(datos))}catch(e){console.warn('SATE Cupos: almacenamiento de sesión no disponible')}
      if($('#cupos-ayuda')){pintar();if(S.gen){S.gen=generate();renderGen()}renderOffer();renderCal()}
    }else pintar();
  }
  window.addEventListener('message',mensaje);
  if(window.opener){try{const ref=new URL(document.referrer);if(C.origenSaes(ref.origin))window.opener.postMessage({tipo:'ipnt.cupos.hola'},ref.origin)}catch(e){}}
  function montar(){const op=$('#cupos-omitir');if(!op)return;op.onchange=()=>{omitir=op.checked;if(S.gen){S.gen=generate();renderGen()}};
    $('#cupos-instalar').textContent=tx('titulo');$('#cupos-omitir-texto').textContent=tx('omitir');pintar()}
  setInterval(()=>{if(!document.hidden&&$('#cupos-ayuda')){pintar();renderOffer();renderCal()}},60000);
  return {insignia,excluir,pintar,montar};
})();
