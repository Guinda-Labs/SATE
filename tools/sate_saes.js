/* Entrada única. Las acciones conservan sus implementaciones independientes. */
(()=>{
  const textos=__CUPOS_TEXTOS__,tx=k=>textos['sate.cupos.'+k]||k;
  window.IPNTSate=accion=>{
    document.getElementById('ipnt-sate-menu')?.remove();
    if(accion==='lector'){/*__SATE_LECTOR__*/return}
    if(accion==='cupos'){/*__SATE_CUPOS__*/return}
    const menu=document.createElement('section');menu.id='ipnt-sate-menu';
    menu.setAttribute('aria-label',tx('marcador'));
    menu.innerHTML=`<style>
      #ipnt-sate-menu,#ipnt-sate-menu *{all:revert;box-sizing:border-box;font:inherit;color:inherit}
      #ipnt-sate-menu{--ipn-linea:#ded8dc;--ipn-superficie:#fff;--ipn-texto:#29252b;--ipn-acento:#71334c;color-scheme:light dark;position:fixed;z-index:2147483647;right:12px;bottom:12px;width:352px;padding:16px;border:1px solid var(--ipn-linea);border-radius:16px;background:var(--ipn-superficie);color:var(--ipn-texto);box-shadow:0 8px 32px #0003;font:15px/1.5 system-ui;display:grid;gap:8px;max-width:calc(100vw - 24px);max-height:calc(100dvh - 24px);overflow:auto}
      @media(prefers-color-scheme:dark){#ipnt-sate-menu{--ipn-texto:#eee8eb;--ipn-superficie:#211e22;--ipn-linea:#61565e;--ipn-acento:#efb7ce}}
      #ipnt-sate-menu header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:700}
      #ipnt-sate-menu button{display:block;min-height:48px;padding:8px 16px;border:1px solid var(--ipn-linea);border-radius:8px;background:var(--ipn-superficie);cursor:pointer;text-align:center}
      #ipnt-sate-menu button[data-action="lector"]{background:var(--ipn-acento);color:var(--ipn-superficie);border-color:transparent}
      #ipnt-sate-menu header button{border:0;font-size:24px;min-width:44px;padding:0}
      #ipnt-sate-menu fieldset{display:grid;grid-template-columns:1fr 1fr;gap:0;border:0;border-top:1px solid var(--ipn-linea);padding:16px 0 0;margin:8px 0 0;min-width:0}
      #ipnt-sate-menu legend{grid-column:1/-1;width:100%;font-size:13px;margin-bottom:8px}
      #ipnt-sate-menu fieldset button{flex:1;font-size:13px;padding:8px;border:0;border-radius:8px}
      #ipnt-sate-menu button[aria-pressed="true"]{background:var(--ipn-acento);color:var(--ipn-superficie);font-weight:600}
      #ipnt-sate-menu :focus-visible{outline:3px solid var(--ipn-acento);outline-offset:2px}
    </style><header><span>${tx('marcador')}</span><button type="button" aria-label="${tx('cerrar')}" data-close>×</button></header>`;
    menu.querySelector('[data-close]').onclick=()=>menu.remove();
    for(const [id,clave] of [['lector','traer'],['cupos','consultar']]){
      const b=document.createElement('button');b.type='button';b.textContent=tx(clave);
      b.setAttribute('data-action',id);
      b.onclick=()=>window.IPNTSate(id);menu.appendChild(b);
    }
    const modos=document.createElement('fieldset');modos.innerHTML=`<legend>${tx('ver_cupos')}</legend>`;menu.appendChild(modos);
    let activo=window.matchMedia?.('(min-width: 900px) and (pointer: fine)').matches?'ventana':'saes';
    try{const m=localStorage.getItem('ipnt.cupos.modo');if(['saes','ventana'].includes(m))activo=m}catch(e){}
    for(const modo of ['saes','ventana']){
      const b=document.createElement('button');b.type='button';b.textContent=tx('modo_'+modo);
      b.setAttribute('aria-pressed',String(modo===activo));
      b.onclick=()=>{try{localStorage.setItem('ipnt.cupos.modo',modo)}catch(e){}menu.remove();if(window.IPNCuposCambiarModo)window.IPNCuposCambiarModo(modo);else window.IPNTSate('cupos')};modos.appendChild(b);
    }
    menu.onkeydown=e=>{if(e.key==='Escape')menu.remove()};document.body.appendChild(menu);menu.querySelector('button').focus();
  };
  window.IPNTSate(window.IPNTSateAccion);delete window.IPNTSateAccion;
})();
