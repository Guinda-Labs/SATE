"""Conexión con el SAES (v2) sin servidores: marcador "SATE" + carga por pegado en las páginas.

- bookmarklet(tool_url): convierte tools/lector_saes.js en un enlace javascript: (solo lectura en el SAES).
- JS/CSS/HTML comunes que se inyectan en las plantillas:
    /*__SAES_JS__*/        objeto SAES: guardar/leer/borrar los datos del alumno (solo en este navegador)
    <!--__SAES_CARD__-->   botón "Traer mis datos del SAES" + ventana con instrucciones y área para pegar
                           (la ventana es un <dialog>: no ocupa lugar en la página ni la desplaza)
    Cualquier elemento con [data-saes-open] también abre la ventana.
"""
import pathlib, re, urllib.parse, json, html, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "tools" / "lector_saes.js"
SAES_URL = "https://www.saes.upiita.ipn.mx/"


def lector_js(tool_url=""):
    """Código del SATE sin comentarios (para el marcador completo o para publicarlo como lector.js)."""
    js = SRC.read_text(encoding="utf-8")
    js = re.sub(r"/\*.*?\*/", "", js, flags=re.S)          # el código no usa comentarios de línea
    js = "\n".join(l.strip() for l in js.splitlines() if l.strip())
    # versión = huella del código del marcador SATE: cambia solo cuando cambia el marcador SATE (se cruza con git log del archivo)
    import hashlib
    ver = hashlib.sha1(SRC.read_bytes().replace(b"\r\n", b"\n")).hexdigest()[:7]
    unidades = json.loads((ROOT / 'data/sate.json').read_text(encoding='utf-8'))['unidades']
    from cuenta import identidades
    nombres = {alias: c['siglas'] for u, c in identidades().items() for alias in [u, *c.get('alias', [])]}
    return (js.replace("__TOOL_URL__", tool_url).replace("__LECTOR_VERSION__", ver)
            .replace('__LECTOR_UNIDADES__', json.dumps(list(unidades)))
            .replace('__LECTOR_NOMBRES__', json.dumps(nombres, ensure_ascii=False)))


def bookmarklet(tool_url=""):
    import contenido
    textos = {k: v for k, v in contenido.objeto_t().items() if k.startswith('sate.cupos.')}
    cupos = (ROOT / 'tools/cupos_saes.js').read_text(encoding='utf-8')
    url = tool_url.rsplit('/', 1)[0] + '/sate/index.html?vista=cupos' if tool_url else ''
    cupos = cupos.replace("'__CUPOS_URL__'", json.dumps(url)).replace('__CUPOS_TEXTOS__', json.dumps(textos, ensure_ascii=False))
    js = (ROOT / 'tools/sate_saes.js').read_text(encoding='utf-8')
    js = js.replace('__CUPOS_TEXTOS__', json.dumps(textos, ensure_ascii=False))
    js = js.replace('/*__SATE_LECTOR__*/', lector_js(tool_url)).replace('/*__SATE_CUPOS__*/', cupos)
    return "javascript:" + urllib.parse.quote(js, safe="")


def loader(base):
    """Marcador corto que descarga sate.js vigente; también funciona en Chrome para Android."""
    return ("javascript:(function(){var s=document.createElement('script');"
            "s.src='" + base + "sate.js?v='+Date.now();document.head.appendChild(s)})()")


def origen_qa(js):
    """Transformación exclusiva de artefactos qa-*. Nunca se aplica al marcador publicado."""
    js = re.sub(r"var TOOL = '[^']*';", "var TOOL = location.origin + '/dist/qa-sate/index.html';", js)
    js = js.replace("const origenSaes=o=>", "const origenSaes=o=>/^http:\\/\\/saes-upiita\\.localhost:\\d+$/.test(o)||")
    js = js.replace("var UM = location.hostname.match(/(?:^|\\.)saes\\.([a-z0-9-]+)\\.ipn\\.mx$/i);",
                    "var UM = location.hostname === 'saes-upiita.localhost' && location.protocol === 'http:' ? ['', 'upiita'] : location.hostname.match(/(?:^|\\.)saes\\.([a-z0-9-]+)\\.ipn\\.mx$/i);")
    js = js.replace("location.hostname.match(/saes\\.([a-z0-9]+)\\.ipn\\.mx$/)[1]", "(location.hostname==='saes-upiita.localhost'?'upiita':location.hostname.match(/saes\\.([a-z0-9]+)\\.ipn\\.mx$/)[1])")
    js = js.replace("location.hostname.match(/saes\\.([a-z0-9-]+)\\.ipn\\.mx$/i)?.[1]||''", "(location.hostname==='saes-upiita.localhost'?'upiita':location.hostname.match(/saes\\.([a-z0-9-]+)\\.ipn\\.mx$/i)?.[1]||'')")
    return js


JS = r"""
/* ---------- datos del SAES (v2): solo en este navegador ---------- */
const SAES={
  KEY:'saes.alumno',
  U(){return window.IPNT_UNIDAD||'upiita'},   // unidad de la página; los datos sin unidad son de la UPIITA (versiones anteriores)
  load(){try{const v=JSON.parse((window.IPNT?.almacen||localStorage).getItem(this.KEY)||'null');return v&&v.upiita_saes===1&&(v.unidad||'upiita')===this.U()?v:null}catch(e){return null}},
  save(d){if(window.IPNT)IPNT.set(this.KEY,JSON.stringify(d));else try{(window.IPNT?.almacen||localStorage).setItem(this.KEY,JSON.stringify(d))}catch(e){}},
  clear(){try{(window.IPNT?.almacen||localStorage).removeItem(this.KEY)}catch(e){}if(window.IPNT)IPNT.borrar(this.KEY)},
  parse(t){try{const d=JSON.parse(String(t||'').trim());if(d&&d.upiita_saes===1&&Array.isArray(d.acreditadas))return d}catch(e){}return null},
  autorizada(d){const s=String(d?.avance?.autorizada||'');   // «MEDIA-REPROBADAS = 40.00 - 22.50 CREDITOS»: el tope total es la media (incluye las reprobadas)
    const m=s.match(/=\s*(\d+(?:\.\d+)?)\s*-\s*\d/)||s.match(/(\d+(?:\.\d+)?)\s*CR/i)||s.match(/(\d+(?:\.\d+)?)/);return m?+m[1]:null},
  open(){const dl=document.getElementById('saes-dlg');if(!dl)return;if(dl.showModal&&!dl.open)dl.showModal();else dl.setAttribute('open','')},
  close(){const dl=document.getElementById('saes-dlg');if(!dl)return;if(dl.close)dl.close();else dl.removeAttribute('open')},
  /* conecta el botón y la ventana: abrir, arrastrar el marcador, copiar su código y pegar los datos */
  wire(onLoad){
    const dl=document.getElementById('saes-dlg');if(!dl)return;
    const paste=dl.querySelector('#saes-paste'), msg=dl.querySelector('#saes-msg');
    dl.querySelector('#saes-bm')?.addEventListener('click',e=>e.preventDefault());
    // delegado: también funciona con botones que se agregan después (p. ej. el recordatorio de Estado general)
    document.addEventListener('click',e=>{if(!e.target.closest?.('[data-saes-open]'))return;e.preventDefault();SAES.open()});
    dl.querySelector('#saes-x').addEventListener('click',()=>SAES.close());
    dl.addEventListener('click',e=>{if(e.target===dl)SAES.close()});   // clic fuera de la ventana
    const take=async t=>{const d=SAES.parse(t);if(!d){msg.innerHTML='<span class="bad">El contenido no corresponde al marcador SATE. Ejecuta el marcador en el SAES y selecciona «Copiar mis datos».</span>';return}
      if(globalThis.IPNT?.privacidad)await globalThis.IPNT.privacidad();
      // Datos de otra unidad: se guardan y se abre el SATE de esa unidad (cualquier unidad tiene SATE).
      const suya=String(d.unidad||'upiita');
      if(suya!==SAES.U()&&/^[a-z0-9-]+$/.test(suya)){SAES.save(d);paste.value='';
        msg.textContent='Tus datos son del SAES de '+suya.toUpperCase()+'. Abriendo SATE de '+suya.toUpperCase()+'…';
        setTimeout(()=>{location.href=(globalThis.SATE?'index.html':'sate/index.html')+'?sateUnidad='+suya},900);return}
      const aceptar=()=>{SAES.save(d);paste.value='';msg.textContent='Datos del SAES cargados.';onLoad(d);setTimeout(()=>SAES.close(),900)};
      if(globalThis.SATE){
        try{await SATE.script('tramites.js');SateTramites.confirmarSaes(d,msg,aceptar)}
        catch(e){console.error('Lector: confirmación no disponible',{fase:'identidad',error:e.name});msg.textContent='No se pudieron guardar tus datos. Intenta de nuevo.'}
      }else aceptar();
    };
    paste.addEventListener('paste',e=>{e.preventDefault();return take(e.clipboardData.getData('text'))});
    paste.addEventListener('input',()=>{if(paste.value.trim().startsWith('{'))return take(paste.value)});
    dl.querySelector('#saes-paste-clip').addEventListener('click',async e=>{
      const boton=e.currentTarget;
      let texto;
      try{
        if(!navigator.clipboard?.readText)throw new Error('clipboard-unavailable');
        texto=await navigator.clipboard.readText();
      }catch(err){
        // El permiso depende del navegador: conservar siempre el pegado manual.
        msg.textContent=boton.dataset.fallback;paste.focus();return;
      }
      return take(texto);
    });
    // copiar el código: portapapeles moderno, luego execCommand; si ambos fallan, queda seleccionado para copiarlo a mano
    dl.querySelector('#saes-copybm').addEventListener('click',async e=>{const b=e.currentTarget,box=dl.querySelector('#saes-bmcode'),m=dl.querySelector('#saes-copymsg');
      let ok=false;try{await navigator.clipboard.writeText(box.value);ok=true}catch(err){}
      if(!ok){box.focus();box.select();box.setSelectionRange(0,box.value.length);try{ok=document.execCommand('copy')}catch(err){}}
      b.textContent=ok?'Copiado ✓':'Copiar';m.textContent=ok?'Código copiado. Pégalo como dirección (URL) del marcador.':'El navegador no permitió copiar: el código ya está seleccionado; mantén presionado y elige «Copiar».';
      if(ok)setTimeout(()=>{b.textContent='Copiar'},2500)});
    dl.querySelector('#saes-again').addEventListener('click',()=>{dl.querySelector('#saes-steps').hidden=false});
    dl.querySelector('#saes-install').addEventListener('click',()=>{dl.querySelector('#saes-manual').open=true});
    dl.querySelector('#saes-clear').addEventListener('click',e=>{
      if(!e.target.dataset.confirm){e.target.dataset.confirm='1';e.target.textContent='Confirmar: borrar mis datos';setTimeout(()=>{delete e.target.dataset.confirm;e.target.textContent='Borrar mis datos'},4000);return}
      SAES.clear();msg.textContent='Tus datos del SAES se borraron de este navegador.';onLoad(null)});
  },
  /* aviso cuando se explora una carrera distinta a la del perfil cargado: nada del perfil se aplica ni se modifica */
  mismatch(car,nameOf,onBack,carOf=d=>d?.carrera){
    const el=document.getElementById('saes-mismatch');if(!el)return;
    const d=SAES.load(), cap=s=>String(s||'').toLowerCase().replace(/(^|\s)(\S)/g,(m,a,b)=>a+b.toUpperCase()).replace(/\b(En|De|Y)\b/g,w=>w.toLowerCase()).replace(/^Ingenieria\b/,'Ingeniería');
    let hid=null;try{hid=(window.IPNT?.almacen||localStorage).getItem('saes.aviso')}catch(e){}
    if(!d||!d.carrera||carOf(d)===car||hid===d.leido){el.hidden=true;return}
    const mine=esc(cap(nameOf(carOf(d))||d.carrera_nombre)), here=esc(cap(nameOf(car)));
    el.innerHTML=`<p><b>Consultando ${here||'otra carrera'}.</b> Tus datos del SAES corresponden a ${mine}; el avance y las sugerencias no se aplican en esta carrera.</p>`+
      `<div class="mm-act"><button class="btn" type="button" data-mm="back">Volver a ${mine}</button><button class="btn" type="button" data-mm="load">Usar datos de otra sesión</button><button class="x" type="button" data-mm="hide" aria-label="Ocultar este aviso" title="Ocultar este aviso">×</button></div>`;
    el.hidden=false;
    el.onclick=e=>{const a=e.target.closest('[data-mm]')?.dataset.mm;if(!a)return;
      if(a==='back')onBack(carOf(d));else if(a==='load')SAES.open();
      else{try{(window.IPNT?.almacen||localStorage).setItem('saes.aviso',d.leido)}catch(err){}el.hidden=true}};
  },
  status(d){
    const st=document.getElementById('saes-status'), btn=document.getElementById('saes-open');
    if(btn){btn.classList.toggle('on',!!d);btn.querySelector('span').textContent='Traer mis datos del SAES';
      btn.title=d?'Datos del SAES cargados. Selecciona para actualizarlos o eliminarlos.':'Incorpora tu avance desde el SAES (opcional)'}
    if(!st)return;
    st.hidden=!d;document.getElementById('saes-steps').hidden=!!d;document.getElementById('saes-clear').hidden=!d;
    // El recordatorio arriba solo ayuda cuando la copia tiene más de 30 días.
    const antiguo=!!d&&Date.now()-new Date(d.leido).getTime()>30*24*60*60*1000;
    document.getElementById('saes-stale').hidden=!antiguo;
    const aviso=document.getElementById('saes-reminder');if(aviso)aviso.hidden=antiguo;
    if(!d)return;
    const f=new Date(d.leido).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
    st.querySelector('#saes-who').textContent=`${d.carrera_nombre||''} · boleta ${d.boleta||'—'} · leídos el ${f}`;
  }
};
"""

CSS = r"""
.saes-tactil{display:none}
@media(hover:none){.saes-arrastre{display:none}.saes-tactil{display:block}}
.saes-videos{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:12px 0 2px;font-size:.88rem}
.saes-vid{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;text-decoration:none;color:var(--fg);font-weight:600;background:var(--surface)}
.saes-vid:hover{border-color:var(--accent)}
.saes-vlist{color:var(--accent);font-weight:600;margin-left:4px}
.saes-vid svg{color:var(--accent)}
.saes-vid.rec{border-color:var(--accent);background:var(--accent-soft,var(--surface));color:var(--accent)}
.saes-open{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}
.saes-open::before{content:"";width:9px;height:9px;border-radius:50%;border:2px solid currentColor;flex:none}
.saes-open.on::before{background:var(--ok);border-color:var(--ok)}
.saes-dlg{width:min(600px,calc(100vw / var(--ui-zoom,1) - 32px));max-height:calc(100vh / var(--ui-zoom,1) - 48px);overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--fg);padding:20px 22px;box-shadow:0 24px 60px -16px rgba(0,0,0,.45)}
.saes-dlg::backdrop{background:rgba(20,12,16,.45)}
.saes-dlg h2{margin:0;font-size:1.25rem}
.saes-dlg .dl-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px}
.saes-dlg .x{border:0;background:none;font-size:1.5rem;line-height:1;cursor:pointer;color:var(--muted);padding:2px 6px}
.saes-dlg ol{margin:10px 0;padding-left:1.3rem;display:flex;flex-direction:column;gap:12px;font-size:.92rem}
.saes-dlg li>p{margin:4px 0}
.saes-dlg details{margin-top:6px;font-size:.86rem;border-left:3px solid var(--line);padding:2px 0 2px 10px}
.saes-dlg summary{cursor:pointer;color:var(--accent);font-weight:600}
.saes-dlg details ul{margin:6px 0;padding-left:1.1rem;display:flex;flex-direction:column;gap:4px}
.saes-dlg kbd{font-family:var(--f-mono,ui-monospace,monospace);font-size:.8em;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:0 4px;background:var(--bg)}
.saes-bm{display:inline-flex;align-items:center;gap:6px;background:var(--accent);color:var(--accent-fg);border-radius:999px;padding:5px 14px;font-weight:600;text-decoration:none;cursor:grab}
.saes-paste{width:100%;min-height:2.8rem;resize:none;font-size:.9rem}
.saes-note{font-size:.8rem;color:var(--muted)}
.saes-code{display:flex;gap:8px;align-items:stretch;margin:6px 0 4px}
.saes-code textarea{flex:1;min-width:0;font:12px/1.4 ui-monospace,Consolas,monospace;resize:vertical;word-break:break-all}
.saes-mm[hidden]{display:none}
.saes-mm{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:12px;padding:10px 12px 10px 14px;border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:var(--r);background:var(--surface);font-size:.88rem}
.saes-mm p{margin:0;flex:1 1 360px;min-width:0}
.saes-mm .mm-act{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.saes-mm .x{border:0;background:none;font-size:1.3rem;line-height:1;cursor:pointer;color:var(--muted);padding:2px 6px}
#saes-msg .ok{color:var(--ok);font-weight:600} #saes-msg .bad{color:var(--bad);font-weight:600}
"""


# videos de YouTube con el uso del marcador SATE por dispositivo (canal del proyecto)
VIDEOS = [("pc", "Computadora", "https://youtu.be/YQPi4SeE-qc"),
          ("ios", "iPhone o iPad", "https://youtube.com/shorts/gLHEFATT9tA"),
          ("android", "Android", "https://youtu.be/eoJX2uPvyqU")]
VIDEOS_LISTA = "https://www.youtube.com/playlist?list=PLPZJV048DlEY"


def card(bm_href, page="horarios", short="", u=None):
    import contenido
    textos = contenido.objeto_t()
    # en el sitio publicado, el código para teléfono es el marcador corto (descarga lector.js)
    code_text = html.escape(short or bm_href)
    copy_note = " (versión corta: descarga el marcador SATE desde este sitio)" if short else ""
    version = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")   # para saber si el navegador ya cargó la última versión
    demo = ('<button class="link demo-open" type="button" data-demo-open title="Perfil de un alumno ficticio: '
            'conoce la herramienta sin usar tus datos del SAES">Probar con datos de ejemplo</button>') if page == "horarios" else ""
    # los datos son una copia del SAES en el momento de la lectura: no se actualizan solos
    recordatorio = 'Tus datos no se actualizan solos: vuelve a cargarlos tras inscribirte o al recibir calificaciones.'
    aviso = f'<p class="saes-note" id="saes-reminder" style="margin:10px 0 0">{recordatorio}</p>' if page == "horarios" else ""
    play = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>'
    videos = "".join(f'<a class="saes-vid" data-dev="{d}" href="{u}" target="_blank" rel="noopener">{play}{t}</a>' for d, t, u in VIDEOS)
    out = f"""<button class="btn saes-open" id="saes-open" type="button" data-saes-open aria-haspopup="dialog"><span>Traer mis datos del SAES</span></button>{demo}
<dialog class="saes-dlg" id="saes-dlg" aria-labelledby="saes-h">
  <div class="dl-head"><h2 id="saes-h">Traer mis datos del SAES</h2><button class="x" id="saes-x" type="button" aria-label="Cerrar">×</button></div>
  <p style="margin:0;font-size:.92rem">Trae tu avance del SAES en 3 pasos. Solo se lee; nada se envía a ningún servidor.</p>
  <p class="saes-note">{html.escape(textos['sate.lector.mismo_marcador'])}</p>
  <p class="saes-note" id="saes-stale" style="margin:6px 0 0" hidden>{recordatorio}</p>
  <div id="saes-status" hidden><p style="margin:10px 0 0;font-size:.92rem"><b>Datos del SAES cargados.</b> <span class="muted" id="saes-who"></span></p>
    <p class="saes-note" style="margin:4px 0 0">{html.escape(textos['sate.cupos.paso_datos'])}</p>
    <p class="saes-note" style="margin:4px 0 0"><button class="link" id="saes-again" type="button">Ver los pasos de nuevo</button></p></div>
  <details><summary>¿Prefieres verlo? Video paso a paso</summary><div class="saes-videos" id="saes-videos">{videos}<a class="saes-vlist" href="{VIDEOS_LISTA}" target="_blank" rel="noopener">Ver todos</a></div></details>
  <div id="saes-steps">
    <ol>
      <li><p class="saes-arrastre"><b>Arrastra a tu barra de marcadores:</b> <a class="saes-bm" id="saes-bm" href="{bm_href}" draggable="true">{html.escape(textos['sate.cupos.marcador'])}</a></p>
        <p class="saes-tactil"><b>{html.escape(textos['sate.cupos.guardar'])}</b> <button class="link" id="saes-install" type="button">{html.escape(textos['sate.lector.tactil'])}</button></p>
        <details><summary>¿Qué es un marcador? ¿Cómo muestro la barra?</summary>
        <p>Un marcador es un favorito guardado en tu navegador. El marcador SATE lee tu SAES y sirve para todas las unidades del IPN; guárdalo solo una vez.</p><ul>
          <li><b>Chrome, Edge, Brave u Opera:</b> pulsa <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> (en Mac, <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>).</li>
          <li><b>Firefox:</b> clic derecho en la barra superior › Barra de marcadores › Mostrar siempre.</li>
          <li><b>Safari:</b> menú Visualización › Mostrar barra de favoritos (<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>).</li>
        </ul></details>
        <details id="saes-manual"><summary>Instalación manual o en teléfono</summary>
          <ol>
            <li>Copia el código del marcador{copy_note}:
              <div class="saes-code"><textarea id="saes-bmcode" readonly rows="3" aria-label="Código del marcador" onfocus="this.select()">{code_text}</textarea>
                <button class="btn primary" id="saes-copybm" type="button">Copiar</button></div>
              <small class="saes-note" id="saes-copymsg" aria-live="polite">Si el botón no copia, mantén presionado el recuadro y elige «Seleccionar todo» y después «Copiar».</small></li>
            <li>Guarda cualquier página como marcador (<kbd>Ctrl</kbd>+<kbd>D</kbd> o la estrella de la barra de direcciones).</li>
            <li>Edita el marcador: asigna el nombre <b>{html.escape(textos['sate.cupos.marcador'])}</b> y sustituye la <b>dirección (URL)</b> por el código copiado.</li>
          </ol>
          <p><b>Cómo usarlo según el navegador del teléfono:</b></p>
          <ul>
            <li><b>Firefox (Android, iPhone o iPad):</b> con el SAES abierto, abre tus marcadores y elige <b>{html.escape(textos['sate.cupos.marcador'])}</b>.</li>
            <li><b>Safari (iPhone o iPad):</b> en cualquier página, toca <b>Compartir</b> › <b>Agregar marcador</b> y guárdalo con el nombre <b>{html.escape(textos['sate.cupos.marcador'])}</b>. Abre <b>Marcadores</b> › <b>Editar</b>, toca ese marcador y sustituye su dirección por el código copiado. Con el SAES abierto, toca la barra de direcciones y elige <b>{html.escape(textos['sate.cupos.marcador'])}</b> en la sección de marcadores (aparece como guardado recientemente).</li>
            <li><b>Chrome (Android):</b> abrirlo desde la lista de marcadores no funciona. Con el SAES abierto, toca la barra de direcciones, escribe <b>{html.escape(textos['sate.cupos.marcador'])}</b> y elige el marcador en las sugerencias.</li>
            <li><b>Chrome (iPhone o iPad):</b> guarda cualquier página como marcador, edítalo con el nombre <b>{html.escape(textos['sate.cupos.marcador'])}</b> y sustituye su dirección por el código copiado. Con el SAES abierto, ejecuta el marcador.</li>
          </ul></details></li>
      <li><a href="{SAES_URL}" target="_blank" rel="noopener">Entra al SAES</a>, {html.escape(textos['sate.cupos.paso_datos'])}</li>
    </ol>
  </div>
  <ol start="3"><li><b>Pega aquí</b> <button class="btn primary" id="saes-paste-clip" type="button" data-fallback="{html.escape(textos['sate.lector.pegado_manual'], quote=True)}">{html.escape(textos['sate.lector.pegar'])}</button></li></ol>
  <textarea class="saes-paste" id="saes-paste" placeholder="Pega aquí tus datos del SAES (Ctrl+V)" aria-label="Pegar datos del SAES"></textarea>
  <div class="actions" style="display:flex;gap:8px;align-items:center;margin-top:8px"><div id="saes-msg" aria-live="polite" style="flex:1;min-width:0;font-size:.86rem"></div><button class="btn" id="saes-clear" type="button" style="margin-left:auto" hidden>Borrar mis datos</button></div>
  {aviso}
  <p class="saes-note" style="margin:6px 0 0">Versión de la página: {version}</p>
</dialog>
<script>(()=>{{const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||/Macintosh/.test(ua)&&navigator.maxTouchPoints>1,d=ios?'ios':/Android/.test(ua)?'android':'pc';
document.querySelector('#saes-videos [data-dev="'+d+'"]')?.classList.add('rec')}})()</script>"""
    if u and u.get("id", "upiita") != "upiita":   # otra unidad: nombre del marcador y dirección de su SAES
        out = out.replace(SAES_URL, u.get("saes", SAES_URL)) \
                 .replace("saes.upiita.ipn.mx", u.get("saes", SAES_URL).split("//")[-1].strip("/").replace("www.", ""))
    return out


def inject(html, page, tool_url="", u=None):
    bm = bookmarklet(tool_url)
    short = loader(tool_url.rsplit("/", 1)[0] + "/") if tool_url.startswith("https://") and "claude.ai" not in tool_url else ""
    html = html.replace("/*__SAES_JS__*/", JS, 1).replace("/*__SAES_CSS__*/", CSS, 1)
    # en el sitio publicado, el botón para arrastrar también es el marcador corto: descarga la versión vigente del marcador SATE
    # cada vez, así las mejoras llegan sin volver a guardar el marcador (el completo queda para versiones sin sitio)
    return html.replace("<!--__SAES_CARD__-->", card(short or bm, page, short, u), 1)
