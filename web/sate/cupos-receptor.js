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
  let hasta=0,notificacion=false,avisos=0;
  const permitir=document.getElementById('cupos-permitir'),aviso=document.getElementById('cupos-aviso');
  permitir.textContent=tx('permitir');
  function permiso(){const p=typeof Notification==='function'?Notification.permission:'denied';
    permitir.hidden=!notificacion||Date.now()>=hasta||p!=='default';
    if(notificacion&&p!=='default'){aviso.textContent=tx(p==='granted'?'permiso_listo':'permiso_panel');window.opener?.postMessage({tipo:'ipnt.cupos.permiso',v:1,permiso:p},origen)}
  }
  permitir.onclick=async()=>{if(!notificacion||Date.now()>=hasta)return;try{if(typeof Notification==='function')await Notification.requestPermission();permiso()}
    catch(e){console.warn('SATE Cupos: permiso de notificación fallido',e);aviso.textContent=tx('permiso_panel')}};
  function alertar(antes,d){if(Date.now()>=hasta)return;let ctx;
    try{ctx=JSON.parse(localStorage.getItem(conf.prefijo+'cuposContexto'))}catch(e){}
    if(!ctx||ctx.carrera!==d.carrera||ctx.plan&&ctx.plan!==d.plan||!Array.isArray(ctx.grupos))return;
    const cambios=C.cambios(antes,d,ctx.grupos);if(!cambios.length)return;
    avisos+=cambios.length;document.title=tx('titulo_avisos',{n:avisos});aviso.textContent=cambios.map(f=>tx('aviso',{...f,n:f.disponibles})).join(' · ');
    if(!notificacion||typeof Notification!=='function'||Notification.permission!=='granted')return;
    for(const f of cambios)try{const n=new Notification(tx('titulo'),{body:tx('aviso',{...f,n:f.disponibles}),tag:u+'|'+C.clave(f)});
      n.onclick=()=>{try{if(window.opener&&!window.opener.closed)window.opener.focus();else window.focus()}catch(e){window.focus()}n.close()};
    }catch(e){console.warn('SATE Cupos: notificación no disponible',{unidad:u,error:e.message});aviso.textContent=tx('permiso_panel')}
  }
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
    else if(d.tipo==='ipnt.cupos.avisos'&&d.v===1&&Number.isFinite(d.hasta)&&typeof d.notificacion==='boolean'){
      hasta=Math.min(d.hasta,Date.now()+30*60000);notificacion=d.notificacion;permiso()}
    else if(C.validar(d)){conectado=true;const antes=datos;if(guardar(d))alertar(antes,d);seleccion();nube()}
  });
  window.addEventListener('storage',e=>{if(e.key===conf.prefijo+'cuposContexto')seleccion();if(e.key===clave){try{guardar(JSON.parse(e.newValue))}catch(err){}}});
  window.addEventListener('ipnt-sincronizado',nube);
  window.addEventListener('ipnt-cuenta',nube);
  if(canal)canal.onmessage=e=>{if(e.data?.unidad===u&&e.data.tipo==='contexto')seleccion()};
  try{guardar(JSON.parse(localStorage.getItem(clave)))}catch(e){}
  pintar();nube();
})();
