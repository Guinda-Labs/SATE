/* Solo acepta la ventana que abrió la receptora y el SAES configurado para su unidad. */
(()=>{
  const C=window.IPNCupos,cfg=window.CUPOS_CONFIG,u=new URL(location.href).searchParams.get('unidad'),conf=cfg.unidades[u];
  const tx=(k,v={})=>(cfg.textos['sate.cupos.'+k]||k).replace(/\{(\w+)\}/g,(_,n)=>v[n]??'');
  const resumen=document.getElementById('cupos-resumen'),estado=document.getElementById('cupos-nube');
  document.getElementById('cupos-dejar').textContent=tx('dejar_abierta');
  if(!conf){resumen.textContent=tx('error_seleccion');return}
  window.IPNT_UNIDAD=u;
  const origen=new URL(conf.saes).origin,clave=conf.prefijo+'cupos';
  const canal=typeof BroadcastChannel==='function'?new BroadcastChannel('ipnt-cupos'):null;
  let datos=null,conectado=false,cola=Promise.resolve();
  function pintar(){resumen.textContent=datos?tx('ultima',{hora:C.fecha(datos)})+' · '+tx('grupos',{n:datos.filas.length}):tx('esperando')}
  function guardar(d){if(!C.validar(d)||d.unidad!==u)return false;const nueva=C.reciente(datos,d);if(nueva===datos)return false;
    datos=C.limpiar(nueva);IPNT.set(clave,JSON.stringify(datos));canal?.postMessage({tipo:'consulta',unidad:u});pintar();return true}
  function seleccion(){if(!conectado||!window.opener)return;let ctx;try{ctx=JSON.parse(localStorage.getItem(conf.prefijo+'cuposContexto'))}catch(e){}
    if(!ctx||datos&&(ctx.carrera!==datos.carrera||ctx.plan&&ctx.plan!==datos.plan))ctx={grupos:[],oferta:[]};
    window.opener.postMessage({tipo:'ipnt.cupos.seleccion',v:1,...ctx},origen)}
  async function sincronizar(){if(!IPNT.cuenta||IPNT.proveedor!=='ms')return;
    try{const d=await IPNT.cupos(u);guardar(d);if(datos&&C.reciente(d,datos)===datos)await IPNT.cupos(u,datos);estado.textContent=tx('nube_guardada')}
    catch(e){console.warn('SATE Cupos: sincronización OneDrive fallida',{unidad:u,error:e.message});estado.textContent=tx('error_nube')}}
  function nube(){cola=cola.then(sincronizar);return cola}
  window.addEventListener('message',e=>{
    if(!C.origenSaes(e.origin)||e.origin!==origen||e.source!==window.opener)return;
    const d=e.data;if(d?.unidad!==u)return;
    if(d.tipo==='ipnt.cupos.hola'){conectado=true;window.opener.postMessage({tipo:'ipnt.cupos.hola',v:1},origen);seleccion()}
    else if(C.validar(d)){conectado=true;guardar(d);seleccion();nube()}
  });
  window.addEventListener('storage',e=>{if(e.key===conf.prefijo+'cuposContexto')seleccion();if(e.key===clave){try{guardar(JSON.parse(e.newValue))}catch(err){}}});
  window.addEventListener('ipnt-sincronizado',nube);
  window.addEventListener('ipnt-cuenta',nube);
  if(canal)canal.onmessage=e=>{if(e.data?.unidad===u&&e.data.tipo==='contexto')seleccion()};
  try{guardar(JSON.parse(localStorage.getItem(clave)))}catch(e){}
  pintar();nube();
})();
