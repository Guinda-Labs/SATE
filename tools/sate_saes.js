/* Ventana común del marcador; extracción y cupos conservan sus implementaciones. */
(()=>{
  const textos=__CUPOS_TEXTOS__,tx=k=>textos['sate.cupos.'+k]||k;
  function leer(){/*__SATE_LECTOR__*/}
  function cupos(){/*__SATE_CUPOS__*/}
  window.IPNTSate=accion=>{
    window.IPNCuposCerrar?.();document.getElementById('ipnt-sate')?.remove();
    const host=document.createElement('div');host.id='ipnt-sate';
    const raiz=host.attachShadow({mode:'open'});
    const box=document.createElement('section');box.id='ipnt-sate';box.tabIndex=-1;
    box.setAttribute('role','dialog');box.setAttribute('aria-labelledby','ipnt-sate-titulo');
    box.innerHTML=`<style>
      #ipnt-sate,#ipnt-sate *{all:revert;box-sizing:border-box;font:inherit;color:inherit}
      :host{all:initial;--ipn-linea:#ded8dc;--ipn-superficie:#fff;--ipn-texto:#29252b;--ipn-acento:#71334c;color-scheme:light dark;position:fixed;z-index:2147483647}
      #ipnt-sate{position:fixed;right:16px;top:16px;width:560px;max-width:calc(100vw - 32px);max-height:calc(100dvh - 32px);overflow:auto;padding:16px;border:1px solid var(--ipn-linea);border-radius:12px;background:var(--ipn-superficie);color:var(--ipn-texto);box-shadow:0 8px 32px #0003;font:15px/1.5 system-ui;overflow-wrap:anywhere}
      @media(prefers-color-scheme:dark){:host{--ipn-texto:#eee8eb;--ipn-superficie:#211e22;--ipn-linea:#61565e;--ipn-acento:#efb7ce}}
      #ipnt-sate [hidden]{display:none!important}
      #ipnt-sate .sate-cabecera{display:flex;align-items:center;justify-content:space-between;gap:8px}
      #ipnt-sate h2{font-size:18px;font-weight:650;margin:0}
      #ipnt-sate p{margin:8px 0}#ipnt-sate small{display:block;font-size:12px;opacity:.8}
      #ipnt-sate button{min-height:44px;border:1px solid var(--ipn-linea);border-radius:12px;padding:8px 12px;background:var(--ipn-superficie);cursor:pointer}
      #ipnt-sate [data-s="cerrar"]{border:0;font-size:24px;width:44px;padding:0}
      #ipnt-sate .sate-funciones{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:16px 0}
      #ipnt-sate .sate-funciones button{text-align:left;display:grid;grid-template-columns:24px minmax(0,1fr);gap:4px 8px;padding:12px}
      #ipnt-sate .sate-funciones strong{font-weight:650}#ipnt-sate .sate-funciones small{grid-column:2}
      #ipnt-sate .sate-funciones .primario{background:var(--ipn-acento);color:var(--ipn-superficie);border-color:transparent}
      #ipnt-sate fieldset{display:flex;flex-wrap:wrap;gap:8px;min-width:0;border:0;margin:8px 0;padding:0;font-size:12px}
      #ipnt-sate legend{font-size:12px}#ipnt-sate [aria-pressed="true"]{border-color:var(--ipn-acento);font-weight:650}
      #ipnt-sate :focus-visible{outline:3px solid var(--ipn-acento);outline-offset:2px}
      @media(max-width:599px){#ipnt-sate .sate-funciones{grid-template-columns:minmax(0,1fr)}}
    </style><div class="sate-cabecera"><h2 id="ipnt-sate-titulo"></h2><button type="button" data-s="cerrar">×</button></div>
    <div data-s="inicio"><p data-s="saludo"></p><p data-s="estado" role="status"></p><small data-s="privacidad"></small><div class="sate-funciones" data-s="funciones"></div><p data-s="mensaje" role="status" aria-live="polite"></p></div>
    <div data-s="cupos" hidden><button type="button" data-s="volver"></button><fieldset data-s="modos"><legend></legend></fieldset><div data-s="panel"></div></div>`;
    const el=k=>box.querySelector('[data-s="'+k+'"]');
    let datos=null,url='',vista=accion==='cupos';
    const unidad=location.hostname.match(/saes\.([a-z0-9-]+)\.ipn\.mx$/i)?.[1]||'';
    box.querySelector('h2').textContent=tx('ventana_titulo').replace('{unidad}',unidad.toUpperCase());
    el('cerrar').setAttribute('aria-label',tx('cerrar'));el('privacidad').textContent=tx('ventana_privacidad');el('estado').textContent=tx('ventana_leyendo');
    el('volver').textContent=tx('ventana_volver');el('modos').querySelector('legend').textContent=tx('ver_cupos');
    function cerrar(){window.IPNCuposCerrar?.();host.remove()}
    el('cerrar').onclick=cerrar;box.onkeydown=e=>{if(e.key==='Escape')cerrar()};
    function mostrar(){el('inicio').hidden=vista;el('cupos').hidden=!vista}
    function consultar(){vista=true;mostrar();window.IPNTSateContenedor=el('panel');cupos();modos();el('volver').focus()}
    el('volver').onclick=()=>{window.IPNCuposCerrar?.();vista=false;mostrar();el('funciones').querySelector('button')?.focus()};
    function modos(){
      let modo=window.matchMedia?.('(min-width: 900px) and (pointer: fine)').matches?'ventana':'saes';
      try{const m=localStorage.getItem('ipnt.cupos.modo');if(['saes','ventana'].includes(m))modo=m}catch(e){}
      for(const b of el('modos').querySelectorAll('button'))b.remove();
      for(const m of ['saes','ventana']){const b=document.createElement('button');b.type='button';b.textContent=tx('modo_'+m);b.setAttribute('aria-pressed',String(m===modo));
        b.onclick=()=>{try{localStorage.setItem('ipnt.cupos.modo',m)}catch(e){}window.IPNCuposCambiarModo?.(m);for(const n of el('modos').querySelectorAll('button'))n.setAttribute('aria-pressed',String(n===b))};el('modos').appendChild(b)}
    }
    async function copiar(){
      const json=JSON.stringify(datos);
      try{await navigator.clipboard.writeText(json)}catch(e){const t=document.createElement('textarea');t.value=json;t.readOnly=true;t.style.cssText='position:fixed;width:1px;height:1px;opacity:0';box.appendChild(t);let ok=false;try{t.select();ok=document.execCommand('copy')}catch(e){}finally{t.remove()}if(!ok){el('mensaje').textContent=tx('ventana_error_copia');return}}
      el('mensaje').textContent=tx('ventana_copiado');
    }
    const funciones=[
      {id:'copiar',icono:'⧉',texto:'ventana_copiar',accion:copiar,requiereDatos:true},
      {id:'abrir',icono:'↗',texto:'ventana_abrir',accion:()=>{if(url)window.open(url,'_blank','noopener')}},
      {id:'cupos',icono:'▦',texto:'consultar',accion:consultar}
    ];
    function botones(){el('funciones').replaceChildren();for(const f of funciones){if(f.requiereDatos&&!datos)continue;const b=document.createElement('button');b.type='button';b.setAttribute('data-funcion',f.id);if(f.id==='copiar')b.className='primario';
      const icono=document.createElement('span');icono.textContent=f.icono;icono.setAttribute('aria-hidden','true');const titulo=document.createElement('strong');titulo.textContent=tx(f.texto);const detalle=document.createElement('small');detalle.textContent=tx('ventana_'+f.id+'_detalle');b.appendChild(icono);b.appendChild(titulo);b.appendChild(detalle);b.onclick=f.accion;el('funciones').appendChild(b)}}
    // El lector captura este receptor antes de esperar la red; una respuesta tardía no afecta otra instancia.
    window.IPNTSateResultado=(d,tool,sig)=>{
      datos=d;url=tool;if(sig)box.querySelector('h2').textContent=tx('ventana_titulo').replace('{unidad}',sig);
      const nombre=String(d?.nombre||'').trim();el('saludo').textContent=nombre?tx('ventana_saludo').replace('{nombre}',nombre.split(/\s+/)[0]):'';
      el('estado').textContent=d===undefined?tx('ventana_leyendo'):d?tx('ventana_listos').replace('{boleta}',d.boleta||tx('ventana_sin_boleta')):tx('ventana_sin_datos');botones();
    };
    raiz.appendChild(box);document.body.appendChild(host);botones();mostrar();box.focus();if(vista)consultar();leer();
  };
  window.IPNTSate(window.IPNTSateAccion);delete window.IPNTSateAccion;
})();
