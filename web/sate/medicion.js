/* Diagnóstico voluntario: solo metadatos de rendimiento, nunca contenido del perfil. */
(function () {
  if (!new URLSearchParams(location.search).has('medir')) return;
  const p = globalThis.performance, datos = {version:1, pinturas:{}, tareasLargas:[], interacciones:[], renders:[], rutas:[], generaciones:[], errores:[]};
  const limite = 500;
  const agregar = (lista, valor) => { lista.push(valor); if (lista.length>limite) lista.shift(); };
  function observar(tipo, recibir, opciones={}) {
    try {
      if (typeof PerformanceObserver !== 'function') return;
      const o = new PerformanceObserver(lista => lista.getEntries().forEach(recibir));
      o.observe({type:tipo, buffered:true, ...opciones});
    } catch { /* Una API no soportada no debe impedir usar SATE. */ }
  }
  observar('paint', e => { if(e.name==='first-contentful-paint')datos.pinturas.fcp=e.startTime; });
  observar('largest-contentful-paint', e => { datos.pinturas.lcp=e.startTime; });
  observar('longtask', e => agregar(datos.tareasLargas,{inicio:e.startTime,ms:e.duration}));
  observar('event', e => {
    const objetivo=e.target?.closest?.('#b-gen,[data-id]');
    if (!objetivo || !e.interactionId) return;
    agregar(datos.interacciones,{id:e.interactionId,accion:objetivo.id==='b-gen'?'generar':'pestana',ms:e.duration,inicio:e.startTime});
  }, {durationThreshold:16});
  let secuencia=0;
  function iniciar(tipo, nombre) {
    const id='sate-medicion-'+(++secuencia), inicio=p?.now?.()??0;
    try { p?.mark?.(id); } catch {}
    return {id,inicio,tipo,nombre};
  }
  function terminar(m, extra={}) {
    if (!m) return;
    const ms=(p?.now?.()??0)-m.inicio;
    try { p?.mark?.(m.id+'-fin'); p?.measure?.('sate:'+m.tipo+':'+m.nombre,m.id,m.id+'-fin');
      p?.clearMarks?.(m.id); p?.clearMarks?.(m.id+'-fin'); p?.clearMeasures?.('sate:'+m.tipo+':'+m.nombre); } catch {}
    const lista=m.tipo==='ruta'?datos.rutas:m.tipo==='generacion'?datos.generaciones:datos.renders;
    agregar(lista,{nombre:m.nombre,inicio:m.inicio,ms,...extra});
    actualizar();
  }
  function render(nombre, fn) {
    const m=iniciar('render',nombre);
    try {
      const r=fn();
      if(r?.then)return r.then(v=>{terminar(m);return v},e=>{terminar(m,{error:true});throw e});
      terminar(m);return r;
    } catch(e) {terminar(m,{error:true});throw e;}
  }
  const entradas=tipo => {try{return p?.getEntriesByType?.(tipo)||[]}catch{return[]}};
  function almacenamiento() {
    const bytes={hu:0,ue:0,saes:0,ipnt:0,otros:0};
    try {
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i), prefijo=k.split('.')[0];
        // Solo se conservan tamaños agregados; no se exportan claves ni valores.
        bytes[Object.hasOwn(bytes,prefijo)?prefijo:'otros']+=2*(k.length+(localStorage.getItem(k)||'').length);
      }
      return {bytesUTF16:bytes};
    }catch{return {disponible:false}}
  }
  let memoriaEspecifica=null, memoriaPendiente=null;
  function contarDOM(){
    const elementos=document.getElementsByTagName('*').length;
    if(!document.createTreeWalker)return {nodos:elementos,elementos,soloElementos:true};
    const arbol=document.createTreeWalker(document,0xFFFFFFFF);let nodos=1;
    while(arbol.nextNode())nodos++;
    return {nodos,elementos};
  }
  async function medirMemoria() {
    if(!p?.measureUserAgentSpecificMemory)return null;
    if(!memoriaPendiente)memoriaPendiente=Promise.resolve().then(()=>p.measureUserAgentSpecificMemory()).then(r=>{
      // El desglose puede contener URLs: exportar únicamente el total.
      memoriaEspecifica={bytes:r.bytes};return memoriaEspecifica;
    }).catch(e=>{memoriaEspecifica={noDisponible:e.name};return memoriaEspecifica}).finally(()=>{memoriaPendiente=null});
    return memoriaPendiente;
  }
  function resultados() {
    const recursos=entradas('resource').map(e=>{
      let archivo;try{const u=new URL(e.name,location.href);archivo=u.origin+u.pathname}catch{archivo='recurso'}
      return {archivo,tipo:e.initiatorType,transferidos:e.transferSize,codificados:e.encodedBodySize,decodificados:e.decodedBodySize,ms:e.duration};
    });
    const n=entradas('navigation')[0], memoria=p?.memory;
    const scripts=Array.from(document.scripts||[]).map(s=>{
      const u=s.src?new URL(s.src,location.href):null, recurso=u?recursos.findLast(r=>r.archivo===u.origin+u.pathname):null;
      return {archivo:u?u.origin+u.pathname:null,bytesInline:u?0:new TextEncoder().encode(s.textContent||'').length,transferidos:recurso?.transferidos??null,decodificados:recurso?.decodificados??null};
    });
    return {...datos,carga:{navegacion:n?{tipo:n.type,ms:n.duration,domInteractivo:n.domInteractive,domListo:n.domContentLoadedEventEnd,carga:n.loadEventEnd,transferidos:n.transferSize,codificados:n.encodedBodySize,decodificados:n.decodedBodySize}:null,recursos,scripts,cantidadScripts:scripts.length},
      inpAproximado:{ms:Math.max(0,...datos.interacciones.map(e=>e.ms)),criterio:'Máximo observado en pestañas y generación; no es el INP oficial.'},
      memoria:{heap:memoria?{usados:memoria.usedJSHeapSize,total:memoria.totalJSHeapSize,limite:memoria.jsHeapSizeLimit}:null,agente:memoriaEspecifica},
      dom:contarDOM(),almacenamiento:almacenamiento(),
      dispositivo:{nucleos:navigator.hardwareConcurrency??null,gb:navigator.deviceMemory??null,red:navigator.connection?.effectiveType??null,saveData:navigator.connection?.saveData??null,ancho:globalThis.innerWidth??null,alto:globalThis.innerHeight??null,dpr:globalThis.devicePixelRatio??null,movimientoReducido:typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)').matches:null}};
  }
  const panel=document.createElement('details'), titulo=document.createElement('summary'), resumen=document.createElement('p'), boton=document.createElement('button');
  const tx=(k,v)=>SATE.texto('sate.medicion.'+k,v);
  panel.id='sate-panel-medicion';panel.style.cssText='position:fixed;right:12px;bottom:80px;z-index:1100;max-width:min(340px,90vw);padding:10px;border:1px solid var(--ipn-linea);border-radius:12px;background:var(--ipn-superficie);color:var(--ipn-texto);font-size:12px';
  titulo.textContent=tx('titulo');boton.type='button';boton.className='btn';boton.textContent=tx('copiar');resumen.setAttribute('role','status');
  panel.append(titulo,resumen,boton);document.body.appendChild(panel);
  function actualizar(){resumen.textContent=tx('resumen',{fcp:datos.pinturas.fcp?.toFixed(1)??'?',render:datos.renders.at(-1)?.ms.toFixed(1)??'?',generacion:datos.generaciones.at(-1)?.ms.toFixed(1)??'?',nodos:document.getElementsByTagName('*').length,tareas:datos.tareasLargas.length})}
  panel.ontoggle=actualizar;
  boton.onclick=async()=>{try{await medirMemoria();await navigator.clipboard.writeText(JSON.stringify(resultados(),null,2));resumen.textContent=tx('copiado')}catch(e){resumen.textContent=tx('error_copia');console.error('SATE: copia de medición fallida',{error:e.name})}};
  function instrumentar(){
    for(const nombre of ['renderHor','renderMap','renderStatsVista']){
      const fn=window[nombre];
      if(typeof fn!=='function'||fn.medido)continue;
      const envuelta=function(...args){return render(nombre,()=>fn.apply(this,args))};
      envuelta.medido=true;window[nombre]=envuelta;
    }
  }
  window.SateMedicion={iniciar,terminar,render,resultados,medirMemoria,instrumentar};
  actualizar();
})();
