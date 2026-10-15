/* Entrada única. Las acciones conservan sus implementaciones independientes. */
(()=>{
  const textos=__CUPOS_TEXTOS__,tx=k=>textos['sate.cupos.'+k]||k;
  window.IPNTSate=accion=>{
    document.getElementById('ipnt-sate-menu')?.remove();
    if(accion==='lector'){/*__SATE_LECTOR__*/return}
    if(accion==='cupos'){/*__SATE_CUPOS__*/return}
    const menu=document.createElement('section');menu.id='ipnt-sate-menu';
    menu.setAttribute('aria-label',tx('marcador'));
    menu.style.cssText='position:fixed;z-index:2147483647;right:12px;bottom:12px;padding:12px;border:1px solid var(--ipn-linea,#888);border-radius:12px;background:var(--ipn-superficie,Canvas);color:var(--ipn-texto,CanvasText);box-shadow:0 4px 20px #0003;font:14px system-ui;display:grid;gap:8px;box-sizing:border-box;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto';
    for(const [id,clave] of [['lector','traer'],['cupos','consultar'],['cerrar','cerrar_menu']]){
      const b=document.createElement('button');b.type='button';b.textContent=tx(clave);
      b.style.cssText='font:inherit;min-height:44px;padding:10px;border:1px solid var(--ipn-linea,#888);border-radius:8px;background:inherit;color:inherit;cursor:pointer';
      b.onclick=()=>id==='cerrar'?menu.remove():window.IPNTSate(id);menu.appendChild(b);
    }
    for(const modo of ['saes','ventana']){
      const b=document.createElement('button');b.type='button';b.textContent=tx('modo_'+modo);
      b.style.cssText='font:inherit;min-height:44px;padding:10px;border:1px solid var(--ipn-linea,#888);border-radius:8px;background:inherit;color:inherit;cursor:pointer';
      b.onclick=()=>{try{localStorage.setItem('ipnt.cupos.modo',modo)}catch(e){}menu.remove();if(window.IPNCuposCambiarModo)window.IPNCuposCambiarModo(modo);else window.IPNTSate('cupos')};menu.appendChild(b);
    }
    menu.onkeydown=e=>{if(e.key==='Escape')menu.remove()};document.body.appendChild(menu);menu.querySelector('button').focus();
  };
  window.IPNTSate(window.IPNTSateAccion);delete window.IPNTSateAccion;
})();
