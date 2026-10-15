"""Cuenta institucional y persistencia del perfil (formato `ipnt` 1, ver docs/FORMATO-PERFIL.md).

- Respaldo en archivo (*.ipnt.json): descargar y restaurar, sin iniciar sesión.
- Sincronización con la cuenta @alumno.ipn.mx: MSAL.js (Microsoft Entra ID, tenant del IPN) y la carpeta de
  la aplicación en el OneDrive del alumno (permiso Files.ReadWrite.AppFolder). Sin servidor propio.

Configuración: data/cuenta.json {"clientId": "...", "tenant": "..."}; la variable IPNT_CLIENT_ID la sustituye.
Sin clientId, el inicio de sesión aparece como «próximamente» y el respaldo en archivo sigue funcionando.
"""
import json
import os
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
IPN_TENANT = "f94bf4d9-8097-4794-adf6-a5466ca28563"
# unidades que ofrece la bienvenida (data/cuenta.json "unidades" la sustituye); "url" para las publicadas en otro sitio
UNIDADES = [
    {"id": "upiita", "disponible": True},
    {"id": "escom", "disponible": False},
]   # login.microsoftonline.com/alumno.ipn.mx (también ipn.mx)
MSAL = ("https://cdn.jsdelivr.net/npm/@azure/msal-browser@4.30.0/lib/msal-browser.min.js",
        "sha384-RGxxfG5yRS8DLU7ZJ8OoLhbV/BsJFHyPuMVHrTLbpj3t5Z15LnviJmaznKY/a7LZ")


def identidades():
    return json.loads((ROOT / 'data/unidades_identidad.json').read_text(encoding='utf-8'))['unidades']


def config():
    f = ROOT / "data" / "cuenta.json"
    c = json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}
    identidad = identidades()
    unidades = [{**u, 'siglas': identidad[u['id']]['siglas'],
                 'nombre': identidad[u['id']].get('nombre', identidad[u['id']]['siglas'])}
                for u in c.get('unidades', UNIDADES)]
    v = (ROOT / "VERSION").read_text(encoding="utf-8").strip() if (ROOT / "VERSION").exists() else ""
    return {"clientId": os.environ.get("IPNT_CLIENT_ID", c.get("clientId", "")), "tenant": c.get("tenant", IPN_TENANT),
            "googleClientId": os.environ.get("IPNT_GOOGLE_CLIENT_ID", c.get("googleClientId", "")),
            "unidades": unidades,
            "googlePrueba": c.get("googlePrueba", False), "contacto": c.get("contacto", ""),
            "institucionalPendiente": c.get("institucionalPendiente", False),
            "version": v, "unidad": c.get("unidad", "upiita"), "msal": MSAL[0], "sri": MSAL[1]}


JS = r"""
/* ---------- perfil IPN-tools: respaldo y sincronización con la cuenta institucional (tools/cuenta.py) ---------- */
var IPNT=window.IPNT=(()=>{
  const CFG=/*__IPNT_CFG__*/{}, FILE='perfil.ipnt.json', MS_SCOPES=['Files.ReadWrite.AppFolder'],
    GO_SCOPES='openid email profile https://www.googleapis.com/auth/drive.appdata';
  // qué se guarda: todo lo de Horarios (hu.) y Electivas (ue.), menos el estado de pantalla de cada dispositivo
  const SYNC=/^(hu\.|ue\.)|^saes\.alumno$|^perfil\.opciones$/, LOCAL=/^hu\.(?:[a-z]+\.)?(tab|per|tur|niv|view|mview|cview|mobnote|cupos|cuposContexto)$/;
  const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(e){return false}},
    del(k){try{localStorage.removeItem(k)}catch(e){}},keys(){try{return Object.keys(localStorage)}catch(e){return[]}},
    obj(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')||d}catch(e){return d}},put(k,o){try{localStorage.setItem(k,JSON.stringify(o))}catch(e){}}};
  const opt=()=>ls.obj('perfil.opciones',null)||ls.obj('ipnt.opt',{saes:false});   // ipnt.opt: versión anterior (solo local)
  if(!ls.get('perfil.opciones')&&ls.get('ipnt.opt')) ls.set('perfil.opciones',ls.get('ipnt.opt'));   // migración de la casilla local
  const sincroniza=k=>SYNC.test(k)&&!LOCAL.test(k)&&(k!=='saes.alumno'||opt().saes);
  const parse=s=>{try{return JSON.parse(s)}catch(e){return s}};
  let timer=null, busy=null, prov=null, cuenta=null, st={fase:'',ultimo:ls.get('ipnt.last'),error:''};

  /* ---- documento ---- */
  function documento(base){
    const t=ls.obj('ipnt.t',{}), b=ls.obj('ipnt.b',{}), claves={}, borrados={};
    // lo que este navegador no maneja (p. ej. datos del SAES sin autorización) se conserva tal como estaba
    if(base) for(const [k,e] of Object.entries(base.claves||{})) if(SYNC.test(k)&&!LOCAL.test(k)&&!sincroniza(k)) claves[k]=e;
    for(const k of ls.keys()) if(sincroniza(k)) claves[k]={t:t[k]||0,v:parse(ls.get(k))};
    for(const [k,v] of Object.entries(b)) if(sincroniza(k)&&!(k in claves)) borrados[k]=v;
    if(base) for(const [k,v] of Object.entries(base.borrados||{})) if(!(k in claves)&&!(k in borrados)) borrados[k]=v;
    return {ipnt:1,tipo:'perfil',app:'IPN-tools',version:CFG.version||'',unidad:CFG.unidad||'',guardado:new Date().toISOString(),claves,borrados};
  }
  function validar(d){
    if(!d||typeof d!=='object'||d.tipo!=='perfil'||typeof d.claves!=='object') throw new Error('El archivo no es un perfil de SATE.');
    if(!(d.ipnt>=1)) throw new Error('El archivo no es un perfil de SATE.');
    if(d.ipnt>1) throw new Error('El perfil se guardó con una versión más nueva de la herramienta. Actualiza la página.');
    return d;
  }
  // fusión clave por clave: gana la marca de tiempo más reciente; devuelve cuántas claves cambiaron aquí.
  // nubeGana (al iniciar sesión): lo guardado en la cuenta sustituye lo que había en el navegador; lo que solo
  // existe en el navegador se conserva y se sube.
  function fusionar(d,nubeGana){
    const t=ls.obj('ipnt.t',{}), b=ls.obj('ipnt.b',{});let n=0;
    // perfiles guardados antes de que la casilla se sincronizara: si la nube trae datos del SAES, el alumno ya lo autorizó
    if(d.claves?.['saes.alumno']&&!d.claves['perfil.opciones']&&!ls.get('perfil.opciones')){ls.set('perfil.opciones',JSON.stringify({saes:true}));t['perfil.opciones']=0}
    const es=Object.entries(d.claves||{}).sort(([a],[c])=>(c==='perfil.opciones')-(a==='perfil.opciones'));
    for(const [k,e] of es){
      if(!sincroniza(k)||!e) continue;
      const mia=t[k]??b[k]??null, hay=ls.get(k)!=null;
      if(nubeGana||(e.t||0)>(mia||0)||(!hay&&mia==null)){const v=JSON.stringify(e.v);if(ls.get(k)!==v){ls.set(k,v);n++}t[k]=e.t||0;delete b[k]}
    }
    for(const [k,bt] of Object.entries(d.borrados||{})){
      if(!sincroniza(k)) continue;
      if((nubeGana||bt>(t[k]||0))&&ls.get(k)!=null){ls.del(k);n++;b[k]=bt;delete t[k]}
    }
    ls.put('ipnt.t',t);ls.put('ipnt.b',b);return n;
  }
  const firma=d=>JSON.stringify([Object.entries(d.claves||{}).map(([k,e])=>[k,e.t]).sort(),Object.entries(d.borrados||{}).sort()]);

  /* ---- registro de cambios (lo llaman las páginas al guardar) ---- */
  function touch(k){if(!sincroniza(k))return;const t=ls.obj('ipnt.t',{}),b=ls.obj('ipnt.b',{});t[k]=Date.now();delete b[k];ls.put('ipnt.t',t);ls.put('ipnt.b',b);programar()}
  // escritura de las páginas: solo cuenta como cambio si el valor es distinto (volver a guardar lo mismo no gana la fusión)
  function set(k,v){const antes=ls.get(k);if(!ls.set(k,v))return;if(antes!==v)touch(k)}
  function borrar(k){if(!sincroniza(k))return;const t=ls.obj('ipnt.t',{}),b=ls.obj('ipnt.b',{});delete t[k];b[k]=Date.now();ls.put('ipnt.t',t);ls.put('ipnt.b',b);programar()}
  function programar(){if(!cuenta)return;clearTimeout(timer);timer=setTimeout(()=>{timer=null;sincronizar('auto')},3000)}

  /* ---- proveedores: misma interfaz (disponible, listo, recuperar, entrar, bajar, subir, salir) ---- */
  const cargar=(src,attrs={})=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;Object.assign(s,attrs);
    s.onload=ok;s.onerror=()=>no(new Error('No se pudo cargar el inicio de sesión. Revisa tu conexión.'));document.head.appendChild(s)});
  const expirada=()=>{const e=new Error('Tu sesión expiró. Vuelve a conectar tu cuenta.');e.expirada=true;return e};
  async function con(tok,url,o={}){return fetch(url,{...o,headers:{...(o.headers||{}),Authorization:'Bearer '+await tok()}})}
  // Archivo independiente del perfil: no contiene identidad ni trayectoria del alumno.
  async function cupos(unidad,datos){
    if(!cuenta||prov?.id!=='ms')return null;
    if(!/^[a-z0-9]+$/.test(unidad))throw new Error('Unidad de cupos inválida.');
    const url='https://graph.microsoft.com/v1.0/me/drive/special/approot:/cupos-'+unidad+'.json';
    const o=datos?{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)}:{};
    const r=await con(MS.tok,datos?url+':/content':url,o);
    if(!datos&&r.status===404)return null;
    if(!r.ok)throw new Error('OneDrive respondió '+r.status+' al '+(datos?'guardar':'leer')+' cupos de '+unidad+'.');
    if(datos)return datos;
    // Igual que el perfil: la URL de descarga evita redirecciones CORS con Authorization.
    const it=await r.json(),c=it['@microsoft.graph.downloadUrl']?await fetch(it['@microsoft.graph.downloadUrl']):await con(MS.tok,url+':/content');
    if(!c.ok)throw new Error('OneDrive respondió '+c.status+' al descargar cupos de '+unidad+'.');
    return await c.json();
  }

  // Microsoft Entra ID + OneDrive (carpeta de la aplicación: Aplicaciones › IPN-tools)
  const MS={id:'ms',nube:'OneDrive',pca:null,acc:null,
    disponible:()=>!!CFG.clientId,
    async listo(){
      if(this.pca) return;
      if(!window.msal) await cargar(CFG.msal,{integrity:CFG.sri,crossOrigin:'anonymous'});
      const pca=new msal.PublicClientApplication({auth:{clientId:CFG.clientId,authority:'https://login.microsoftonline.com/'+CFG.tenant,
        redirectUri:location.origin+location.pathname,navigateToLoginRequestUrl:false},cache:{cacheLocation:'localStorage'}});
      await pca.initialize();
      const r=await pca.handleRedirectPromise().catch(e=>{st.error=texto(e);return null});
      this.acc=r?.account||pca.getActiveAccount()||pca.getAllAccounts()[0]||null;
      if(this.acc) pca.setActiveAccount(this.acc);
      this.pca=pca;
    },
    async recuperar(){await this.listo();return this.acc?{name:this.acc.name||'',username:this.acc.username}:null},
    async entrar(){
      await this.listo();
      let r;
      try{r=await this.pca.loginPopup({scopes:MS_SCOPES,prompt:'select_account',redirectUri:new URL('auth.html',location.href).href})}
      catch(e){ // ventanas emergentes bloqueadas (frecuente en teléfonos): inicio de sesión en la misma pestaña
        if(/popup_window_error|empty_window_error|block/i.test(String(e?.errorCode||e?.message))){ls.set('ipnt.prov','ms');await this.pca.loginRedirect({scopes:MS_SCOPES,prompt:'select_account'});return null}
        throw e}
      this.acc=r.account;this.pca.setActiveAccount(this.acc);
      return {name:this.acc.name||'',username:this.acc.username};
    },
    tok:async()=>{try{return (await MS.pca.acquireTokenSilent({scopes:MS_SCOPES,account:MS.acc})).accessToken}
      catch(e){if(e instanceof msal.InteractionRequiredAuthError)throw expirada();throw e}},
    G:'https://graph.microsoft.com/v1.0/me/drive/special/approot:/'+FILE,
    async bajar(){
      const r=await con(this.tok,this.G);
      if(r.status===404) return {doc:null,ver:null};
      if(!r.ok) throw new Error('OneDrive respondió '+r.status+' al leer tu perfil.');
      const it=await r.json(), c=it['@microsoft.graph.downloadUrl']?await fetch(it['@microsoft.graph.downloadUrl']):await con(this.tok,this.G+':/content');
      return {doc:validar(await c.json()),ver:it.eTag};
    },
    async subir(d,ver){
      const r=await con(this.tok,this.G+':/content',{method:'PUT',headers:{'Content-Type':'application/json',...(ver?{'If-Match':ver}:{'If-None-Match':'*'})},body:JSON.stringify(d)});
      if(r.status===412||r.status===409) return null;   // otro dispositivo escribió antes: se vuelve a fusionar
      if(!r.ok) throw new Error('OneDrive respondió '+r.status+' al guardar tu perfil.');
      return true;
    },
    async salir(){try{if(this.pca&&this.acc)await this.pca.clearCache({account:this.acc})}catch(e){}this.acc=null}
  };

  // Google + Google Drive (espacio privado de la aplicación, appDataFolder: no aparece entre los archivos del alumno).
  // Sin servidor, Google entrega tokens de 1 hora sin renovación automática: al vencer se pide «Volver a conectar».
  const GO={id:'google',nube:'Google Drive',tc:null,fid:null,
    disponible:()=>!!CFG.googleClientId,
    async listo(){
      if(!window.google?.accounts?.oauth2) await cargar('https://accounts.google.com/gsi/client');
      if(!this.tc) this.tc=google.accounts.oauth2.initTokenClient({client_id:CFG.googleClientId,scope:GO_SCOPES,callback:()=>{}});
    },
    pedir(prompt){return new Promise((ok,no)=>{
      this.tc.callback=r=>r.error?no(new Error(r.error_description||r.error)):ok(r);
      this.tc.error_callback=e=>no(new Error(e?.type==='popup_closed'?'user_cancelled':e?.type==='popup_failed_to_open'?'popup_window_error':(e?.message||e?.type||'error')));
      const acc=ls.obj('ipnt.gacc',null);
      this.tc.requestAccessToken({prompt,...(acc?.username?{login_hint:acc.username}:{})});
    })},
    async recuperar(){const a=ls.obj('ipnt.gacc',null);return a?{name:a.name,username:a.username}:null},
    async entrar(){
      await this.listo();
      const r=await this.pedir(ls.obj('ipnt.gacc',null)?'':'select_account');
      if(!google.accounts.oauth2.hasGrantedAllScopes(r,'https://www.googleapis.com/auth/drive.appdata'))
        throw new Error('Para guardar tus datos, autoriza el acceso al espacio de la aplicación en Google Drive.');
      ls.put('ipnt.gtok',{v:r.access_token,exp:Date.now()+(+r.expires_in||3600)*1000-60000});
      const u=await (await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+r.access_token}})).json();
      const a={name:u.name||'',username:u.email||''};ls.put('ipnt.gacc',a);return a;
    },
    tok:async()=>{const t=ls.obj('ipnt.gtok',null);if(t&&t.exp>Date.now())return t.v;throw expirada()},
    D:'https://www.googleapis.com/drive/v3/files', U:'https://www.googleapis.com/upload/drive/v3/files',
    async buscar(){
      const q=encodeURIComponent(`name='${FILE}' and trashed=false`);
      const r=await con(this.tok,`${this.D}?spaces=appDataFolder&q=${q}&fields=files(id,version)&orderBy=modifiedTime%20desc&pageSize=1`);
      if(r.status===401) throw expirada();
      if(!r.ok) throw new Error('Google Drive respondió '+r.status+' al leer tu perfil.');
      return (await r.json()).files?.[0]||null;
    },
    async bajar(){
      const f=await this.buscar();if(!f){this.fid=null;return {doc:null,ver:null}}
      this.fid=f.id;
      const c=await con(this.tok,`${this.D}/${f.id}?alt=media`);
      if(!c.ok) throw new Error('Google Drive respondió '+c.status+' al leer tu perfil.');
      return {doc:validar(await c.json()),ver:f.version};
    },
    async subir(d,ver){
      const body=JSON.stringify(d);
      if(!this.fid){
        if(await this.buscar()) return null;   // otro dispositivo lo creó mientras tanto: se vuelve a fusionar
        const b='ipnt'+Math.random().toString(36).slice(2), meta={name:FILE,parents:['appDataFolder'],mimeType:'application/json'};
        const r=await con(this.tok,`${this.U}?uploadType=multipart&fields=id`,{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+b},
          body:`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`});
        if(!r.ok) throw new Error('Google Drive respondió '+r.status+' al guardar tu perfil.');
        this.fid=(await r.json()).id;return true;
      }
      // Drive no admite escritura condicional: se comprueba la versión justo antes de escribir
      const m=await con(this.tok,`${this.D}/${this.fid}?fields=version`);
      if(m.ok&&ver&&(await m.json()).version!==ver) return null;
      const r=await con(this.tok,`${this.U}/${this.fid}?uploadType=media`,{method:'PATCH',headers:{'Content-Type':'application/json'},body});
      if(!r.ok) throw new Error('Google Drive respondió '+r.status+' al guardar tu perfil.');
      return true;
    },
    async salir(){const t=ls.obj('ipnt.gtok',null);try{if(t&&window.google?.accounts?.oauth2)google.accounts.oauth2.revoke(t.v,()=>{})}catch(e){}
      ls.del('ipnt.gtok');ls.del('ipnt.gacc');this.fid=null}
  };
  const PROV={ms:MS,google:GO};

  /* modo: 'login' (gana la nube y se recarga), 'abrir' y 'volver' (al abrir la página o regresar a la pestaña: se
     recarga si llegaron cambios de otro dispositivo), 'auto' (tras un cambio propio: solo se avisa) */

  /* ---- al iniciar sesión: si la cuenta y el navegador tienen datos distintos, el alumno elige ---- */
  const ETQ=k=>/^hu\.(?:[a-z]+\.)?w\./.test(k)?'planes de horario y marcas':/^hu\.(?:[a-z]+\.)?t\./.test(k)?'materias elegidas en el mapa':/^ue\./.test(k)?'actividades de Electivas':
    k==='saes.alumno'?'datos del SAES':'preferencias y filtros';
  function diferencias(d){
    const out=new Set();
    for(const [k,e] of Object.entries(d.claves||{})){
      if(!sincroniza(k)||!e||k==='perfil.opciones') continue;
      const v=ls.get(k);if(v!=null&&v!==JSON.stringify(e.v)) out.add(ETQ(k));
    }
    return [...out];
  }
  function elegir(d,dif){return new Promise(ok=>{
    const dl=$i('ipnt-conf');if(!dl){ok('nube');return}
    const n=Object.keys(d.claves||{}).filter(k=>sincroniza(k)).length;
    $i('ipnt-conf-txt').innerHTML=`Tu cuenta ya tiene datos guardados${d.guardado?' (última vez: <b>'+esc(hora(d.guardado))+'</b>)':''}, `+
      `y este navegador tiene datos distintos en: <b>${dif.map(esc).join(', ')}</b>.`;
    const fin=r=>{dl.onclick=null;if(dl.close)dl.close();else dl.removeAttribute('open');ok(r)};
    dl.onclick=e=>{const b=e.target.closest('[data-conf]');if(b)fin(b.dataset.conf)};
    dl.oncancel=e=>e.preventDefault();   // hay que elegir una opción
    if(dl.showModal)dl.showModal();else dl.setAttribute('open','');
  })}
  // «conservar lo de este navegador»: sus valores se marcan como los más recientes y ganan la fusión
  function ganaLocal(){const t=ls.obj('ipnt.t',{}),b=ls.obj('ipnt.b',{}),ahora=Date.now();
    for(const k of ls.keys()) if(sincroniza(k)){t[k]=ahora;delete b[k]}
    ls.put('ipnt.t',t);ls.put('ipnt.b',b)}

  function sincronizar(modo){
    if(!cuenta||!prov) return Promise.resolve(0);
    if(busy){programar();return busy}
    st.fase='sync';st.error='';pintar();
    busy=(async()=>{
      let cambios=0;
      for(let i=0;i<3;i++){
        const {doc,ver}=await prov.bajar();
        let nube=modo==='login'&&i===0;
        if(doc&&nube){const dif=diferencias(doc);if(dif.length&&(await elegir(doc,dif))==='local'){ganaLocal();nube=false}}
        if(doc) cambios+=fusionar(doc,nube);
        const mio=documento(doc);
        if(doc&&firma(doc)===firma(mio)) return cambios;
        if(await prov.subir(mio,ver)) return cambios;
      }
      throw new Error('No se pudo guardar: otro dispositivo está escribiendo al mismo tiempo. Intenta de nuevo.');
    })().then(n=>{
      window.dispatchEvent(new Event('ipnt-sincronizado'));
      st.fase='ok';st.ultimo=new Date().toISOString();ls.set('ipnt.last',st.ultimo);
      if(n>0){
        // la página lee sus datos al cargar: se recarga para mostrarlos (sin repetir en menos de 15 s, para no ciclar)
        let ult=0;try{ult=+sessionStorage.getItem('ipnt.recarga')||0}catch(e){}
        if(modo!=='auto'&&Date.now()-ult>15000){try{sessionStorage.setItem('ipnt.recarga',String(Date.now()))}catch(e){}location.reload();return n}
        st.fase='cambios';
      }
      return n;
    }).catch(e=>{st.fase=e?.expirada?'expirada':'error';st.error=texto(e);return 0}).finally(()=>{busy=null;pintar()});
    return busy;
  }
  const texto=e=>{const m=String(e?.errorMessage||e?.message||e||'');
    if(/AADSTS65001|AADSTS90094|consent/i.test(m)) return 'Las cuentas institucionales del IPN aún no están disponibles: la aplicación está en proceso de autorización. Puedes usar una cuenta personal de Microsoft o tu cuenta de Google.';
    if(/user_cancelled|cancel|access_denied/i.test(m)) return 'Inicio de sesión cancelado.';
    if(/popup_window_error/i.test(m)) return 'El navegador bloqueó la ventana de inicio de sesión. Permite las ventanas emergentes para este sitio.';
    return m.split('\n')[0].slice(0,220)};
  async function entrar(id){
    const p=PROV[id];if(!p)return;
    st.error='';st.fase='login';st.prov=id;pintar();
    try{
      const a=await p.entrar();if(!a)return;   // redirección en curso
      if(prov&&prov!==p) await prov.salir();
      prov=p;cuenta=a;ls.set('ipnt.prov',id);ls.set('ipnt.cuenta',a.username);
      window.dispatchEvent(new Event('ipnt-cuenta'));
      await sincronizar('login');
    }catch(e){st.fase='error';st.error=texto(e);
      if(id==='google'&&CFG.googlePrueba&&/cancelado|access_denied/i.test(st.error+String(e?.message)))
        st.error='No se completó el inicio de sesión con Google. Durante la fase de prueba solo pueden acceder las cuentas registradas'+(CFG.contacto?`; para solicitar acceso, escribe a ${CFG.contacto}.`:'.');
      pintar()}
  }
  async function salir(borrarLocal){
    if(prov) await prov.salir();
    prov=null;cuenta=null;['ipnt.cuenta','ipnt.prov','ipnt.last'].forEach(k=>ls.del(k));st={fase:'',ultimo:null,error:''};
    if(borrarLocal){for(const k of ls.keys())if(/^(hu\.|ue\.|saes\.|ipnt\.)/.test(k))ls.del(k);location.reload();return}
    pintar();
  }

  /* ---- respaldo en archivo ---- */
  function descargar(){
    const d=documento(null), a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(d,null,1)],{type:'application/json'}));
    a.download='ipn-tools-respaldo-'+new Date().toISOString().slice(0,10)+'.ipnt.json';
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
  }
  async function restaurar(file){
    const d=validar(JSON.parse(await file.text())), ahora=Date.now(), t=ls.obj('ipnt.t',{});let n=0;
    const b=ls.obj('ipnt.b',{});
    for(const [k,e] of Object.entries(d.claves)) if(SYNC.test(k)&&!LOCAL.test(k)&&e){ls.set(k,JSON.stringify(e.v));t[k]=ahora;delete b[k];n++}
    ls.put('ipnt.t',t);ls.put('ipnt.b',b);
    if(cuenta) await sincronizar('auto');
    return n;
  }

  /* ---- interfaz ---- */
  const $i=id=>document.getElementById(id);
  const hora=iso=>{if(!iso)return'';const d=new Date(iso);return d.toLocaleDateString('es-MX',{day:'numeric',month:'short'})+' '+d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})};
  function pintar(){
    const btn=$i('ipnt-open'), dl=$i('ipnt-dlg');if(!btn||!dl)return;
    const on=!!cuenta, nom=on?(cuenta.name||cuenta.username):'', nube=prov?.nube||'la nube';
    btn.classList.toggle('on',on);btn.classList.toggle('warn',st.fase==='error'||st.fase==='expirada'||st.fase==='cambios');
    btn.querySelector('span').textContent=on?(nom.split(/\s+/)[0]||'Mi cuenta'):'Iniciar sesión';
    btn.title=on?`Sesión: ${cuenta.username}`:'Inicia sesión para guardar tus datos en tu nube';
    $i('ipnt-out').hidden=on;$i('ipnt-in').hidden=!on;
    $i('ipnt-login').disabled=!MS.disponible()||st.fase==='login';$i('ipnt-glogin').disabled=!GO.disponible()||st.fase==='login';
    $i('ipnt-glogin').hidden=!GO.disponible();$i('ipnt-gnote').hidden=!GO.disponible();
    document.querySelectorAll('.ipnt-prueba:not(.ipnt-msprueba)').forEach(n=>n.hidden=!(GO.disponible()&&CFG.googlePrueba));
    document.querySelectorAll('.ipnt-msprueba').forEach(n=>n.hidden=!(MS.disponible()&&CFG.institucionalPendiente));
    document.querySelectorAll('.ipnt-contacto').forEach(n=>{if(!n.firstChild&&CFG.contacto){const a=document.createElement('a');a.href='mailto:'+CFG.contacto;a.textContent=CFG.contacto;n.appendChild(a)}});
    $i('ipnt-soon').hidden=MS.disponible()||GO.disponible();
    if(on){$i('ipnt-who').textContent=nom+(cuenta.name?` · ${cuenta.username}`:'');$i('ipnt-where').textContent=nube}
    const s=$i('ipnt-state'), f=st.fase;
    s.className='ipnt-state '+(f==='error'||f==='expirada'?'bad':f==='cambios'?'warn':f==='ok'?'ok':'');
    s.innerHTML=f==='sync'?'Sincronizando…':f==='login'?`Abriendo el inicio de sesión de ${st.prov==='google'?'Google':'Microsoft'}…`:
      f==='cambios'?'Se recibieron cambios de otro dispositivo. <button class="link" type="button" data-ipnt-reload>Recargar para verlos</button>':
      f==='error'||f==='expirada'?esc(st.error):on&&st.ultimo?`Guardado en tu ${nube} · `+hora(st.ultimo):on?'Conectado.':'';
    if(!on&&st.error&&f!=='sync'){s.className='ipnt-state bad';s.textContent=st.error}
    $i('ipnt-saes').checked=!!opt().saes;
    $i('ipnt-relogin').hidden=f!=='expirada';
    $i('ipnt-relogin').textContent=prov?.id==='google'?'Volver a conectar con Google':'Volver a iniciar sesión';
  }
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function wire(){
    const dl=$i('ipnt-dlg'), btn=$i('ipnt-open');if(!dl||!btn)return;
    // las bibliotecas se cargan al abrir el diálogo: así el clic en «Continuar con…» puede abrir la ventana emergente
    const abrir=()=>{if(dl.showModal&&!dl.open)dl.showModal();else dl.setAttribute('open','');
      if(MS.disponible())MS.listo().catch(()=>{});if(GO.disponible())GO.listo().catch(()=>{});pintar()};
    const cerrar=()=>{if(dl.close)dl.close();else dl.removeAttribute('open')};
    btn.addEventListener('click',abrir);$i('ipnt-x').addEventListener('click',cerrar);dl.addEventListener('click',e=>{if(e.target===dl)cerrar()});
    $i('ipnt-login').addEventListener('click',()=>entrar('ms'));$i('ipnt-glogin').addEventListener('click',()=>entrar('google'));
    $i('ipnt-relogin').addEventListener('click',()=>entrar(prov?.id||ls.get('ipnt.prov')||'ms'));
    $i('ipnt-sync').addEventListener('click',()=>sincronizar('volver'));
    $i('ipnt-logout').addEventListener('click',()=>salir(false));
    $i('ipnt-wipe').addEventListener('click',()=>{const c=$i('ipnt-wipe-ok');c.hidden=!c.hidden});
    $i('ipnt-wipe-yes').addEventListener('click',()=>salir(true));
    $i('ipnt-saes').addEventListener('change',e=>{const o={...opt(),saes:e.target.checked};set('perfil.opciones',JSON.stringify(o));if(o.saes&&ls.get('saes.alumno'))touch('saes.alumno')});
    $i('ipnt-down').addEventListener('click',descargar);
    $i('ipnt-file').addEventListener('change',async e=>{const f=e.target.files[0],m=$i('ipnt-filemsg');if(!f)return;
      try{const n=await restaurar(f);m.className='ipnt-state ok';m.textContent=`Respaldo restaurado (${n} elementos). Recargando…`;setTimeout(()=>location.reload(),900)}
      catch(err){m.className='ipnt-state bad';m.textContent=texto(err)}e.target.value=''});
    dl.addEventListener('click',e=>{if(e.target.closest('[data-ipnt-reload]'))location.reload()});
    // al volver a la pestaña se traen los cambios de otros dispositivos; al salir se guarda lo pendiente
    document.addEventListener('visibilitychange',()=>{if(!cuenta||st.fase==='expirada')return;
      if(document.visibilityState==='hidden'){if(timer){clearTimeout(timer);timer=null;sincronizar('auto')}}
      else if(!timer&&(!st.ultimo||Date.now()-new Date(st.ultimo)>20000))sincronizar('volver')});
    pintar();
    // sesión guardada (o regreso del inicio de sesión de Microsoft en la misma pestaña)
    const id=ls.get('ipnt.prov')||(ls.get('ipnt.cuenta')||/[#&?](code|error)=/.test(location.hash+location.search)?'ms':null), p=PROV[id];
    if(p&&p.disponible()) p.recuperar().then(a=>{
      if(!a){if(st.error)st.fase='error';pintar();return}
      const recien=!ls.get('ipnt.cuenta');   // regreso del inicio de sesión en la misma pestaña (Microsoft en teléfono)
      prov=p;cuenta=a;ls.set('ipnt.prov',id);ls.set('ipnt.cuenta',a.username);window.dispatchEvent(new Event('ipnt-cuenta'));pintar();sincronizar(recien?'login':'abrir');
    }).catch(e=>{st.fase='error';st.error=texto(e);pintar()});
  }
  /* ---- bienvenida: primera visita (sin carrera, planes, marcas, actividades ni sesión en este navegador) ---- */
  // por unidad: la UPIITA usa hu./ue.; otras unidades, hu.<unidad>. (mismo sitio, datos separados)
  const UNI=CFG.unidad||'upiita', BKEY=UNI==='upiita'?'ipnt.bienvenida':'ipnt.bienvenida.'+UNI;
  const OTRAS=new RegExp('^hu[.]('+((CFG.unidades||[]).map(u=>u.id).filter(x=>x&&x!=='upiita').join('|')||'-')+')[.]');
  const propia=k=>UNI==='upiita'?/^(hu\.|ue\.)/.test(k)&&!OTRAS.test(k):k.startsWith('hu.'+UNI+'.');
  const NUEVO=!ls.get(BKEY)&&!ls.get('ipnt.cuenta')&&!ls.keys().some(k=>propia(k)&&!LOCAL.test(k));
  function bienvenida(o){
    const dl=$i('ipnt-hola'), sel=document.querySelector(o.select);
    if(!dl||!sel||(!NUEVO&&!o.force)) return;
    $i('ipnt-hola-h').textContent=o.force?'Cambiar unidad académica':'Bienvenida';
    $i('ipnt-h-lead').textContent=o.force?'Elige la unidad académica que quieres consultar.':'Selecciona tu unidad y programa académico.';
    const UN=CFG.unidades||[], cars=[...sel.options].map(op=>[op.value,op.textContent.trim()]).filter(c=>c[0]);
    let uni=(CFG.unidades||[]).length>1?null:CFG.unidad;   // con varias unidades, el programa se elige después de la unidad
    const listo=()=>{ls.set(BKEY,'1');if(dl.close)dl.close();else dl.removeAttribute('open')};
    const pintarH=()=>{
      $i('ipnt-h-uni').hidden=UN.length<2;
      if(UN.length<2)$i('ipnt-h-lead').textContent='Selecciona tu programa académico.';
      $i('ipnt-h-unis').innerHTML=UN.map(u=>`<button type="button" class="ipnt-uni" data-uni="${esc(u.id)}" aria-pressed="${u.id===uni}"><b>${esc(u.siglas)}</b><small>${esc(u.nombre)}</small>${u.disponible?'':'<em>En preparación</em>'}</button>`).join('');
      const u=UN.find(x=>x.id===uni)||{};
      $i('ipnt-h-cars').hidden=!uni;
      $i('ipnt-h-cars').innerHTML=!uni?'':u.id===CFG.unidad?
        `<h3>${UN.length>1?'2. ':''}Elige tu programa académico</h3><div class="ipnt-cars">${cars.map(([k,v])=>`<button type="button" class="btn" data-car="${esc(k)}">${esc(v)}</button>`).join('')}</div>`:
        u.url?`<h3>${UN.length>1?'2. ':''}Continúa en la herramienta de tu unidad</h3><p><a class="btn primary" href="${esc(u.url)}">Ir a Horarios ${esc(u.siglas)}</a></p>`:
        `<p class="saes-note">La versión para ${esc(u.siglas||'tu unidad')} se está preparando con alumnos de la unidad. Mientras tanto puedes explorar la de la ${esc((UN.find(x=>x.id===CFG.unidad)||{}).siglas||'')}.</p>`;
      $i('ipnt-h-yo').hidden=!cuenta;
      if(cuenta)$i('ipnt-h-yo').textContent=`Sesión iniciada: ${cuenta.name||cuenta.username}. Si ya tenías datos guardados, la página se actualizará sola; si no, elige tu unidad y programa académico.`;
      $i('ipnt-h-ms').hidden=!MS.disponible();$i('ipnt-h-go').hidden=!GO.disponible();pintar();
      $i('ipnt-h-login').hidden=!!cuenta||!(MS.disponible()||GO.disponible());
    };
    // Reabrir el selector reemplaza sus manejadores para evitar cambios duplicados.
    dl.onclick=async e=>{
      const b=e.target.closest('button');if(!b)return;
      if(b.dataset.uni){uni=b.dataset.uni;pintarH();$i('ipnt-h-cars').scrollIntoView?.({block:'nearest',behavior:'smooth'});return}
      if(b.dataset.car){sel.value=b.dataset.car;sel.dispatchEvent(new Event('change',{bubbles:true}));listo();return}
      if(b.dataset.prov){
        const m=$i('ipnt-h-msg');m.className='ipnt-state';m.textContent='Abriendo el inicio de sesión…';
        await entrar(b.dataset.prov);
        if(cuenta){m.textContent='';ls.set(BKEY,'1')}else{m.className='ipnt-state bad';m.textContent=st.error||''}
        pintarH();return}
      if(b.hasAttribute('data-hola-x'))listo();
    };
    dl.oncancel=()=>ls.set(BKEY,'1');   // Esc: no se vuelve a mostrar
    if(MS.disponible())MS.listo().catch(()=>{});if(GO.disponible())GO.listo().catch(()=>{});   // listas para el clic
    pintarH();
    if(dl.showModal)dl.showModal();else dl.setAttribute('open','');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else setTimeout(wire,0);
  return {bienvenida,diferencias,elegir,set,touch,borrar,documento,fusionar,validar,sincronizar,descargar,restaurar,cupos,get cuenta(){return cuenta},get proveedor(){return prov?.id||null}};
})();
"""

CSS = r"""
.ipnt-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:999px;padding:4px 12px 4px 6px;font:inherit;font-size:.86rem;font-weight:600;cursor:pointer;white-space:nowrap;position:relative}
.ipnt-btn:hover{border-color:var(--accent)}
.ipnt-btn svg{flex:none;color:var(--muted)}
.ipnt-btn.on svg{color:var(--ok)}
.ipnt-btn.warn::after{content:"";position:absolute;top:1px;right:1px;width:8px;height:8px;border-radius:50%;background:var(--warn)}
@media (max-width:600px){.ipnt-btn span{display:none}.ipnt-btn{padding:4px 6px}}
.ipnt-dlg h3{margin:16px 0 6px;font-size:1rem}
.ipnt-dlg .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ipnt-dlg .chk{display:flex;gap:8px;align-items:flex-start;font-size:.9rem;margin-top:10px}
.ipnt-dlg .chk input{margin-top:3px}
.ipnt-state{font-size:.88rem;min-height:1.3em;margin:8px 0 0}
.ipnt-state.ok{color:var(--ok)} .ipnt-state.bad{color:var(--bad)} .ipnt-state.warn{color:var(--warn)}
.ipnt-file{position:relative;overflow:hidden}
.ipnt-file input{position:absolute;inset:0;opacity:0;cursor:pointer}
.ipnt-ms{display:inline-flex;align-items:center;gap:8px}
.ipnt-dlg button:disabled{opacity:.5;cursor:not-allowed}
.ipnt-conf-op{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:10px}
.ipnt-conf-op .btn{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:10px 14px;border-radius:10px;height:auto;white-space:normal}
.ipnt-conf-op small{font-weight:400;font-size:.8rem;color:inherit;opacity:.85}
.ipnt-prueba{margin:10px 0 0;font-size:.84rem;padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
.ipnt-hola{width:min(640px,calc(100vw / var(--ui-zoom,1) - 32px));max-height:calc(100dvh - 24px);overflow:auto}
.ipnt-hola .lead{margin:0;font-size:.95rem;color:var(--muted)}
.ipnt-unis{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.ipnt-uni{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;border:1px solid var(--line);background:var(--surface);color:var(--fg);border-radius:10px;padding:10px 12px;font:inherit;cursor:pointer}
.ipnt-uni b{font-size:1rem} .ipnt-uni small{color:var(--muted);font-size:.78rem;line-height:1.3}
.ipnt-uni em{font-style:normal;font-size:.72rem;font-weight:600;color:var(--warn)}
.ipnt-uni[aria-pressed="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.ipnt-cars{display:flex;flex-wrap:wrap;gap:8px}
.ipnt-hola .alt{margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}
"""

UI = """<button class="ipnt-btn" id="ipnt-open" type="button" aria-haspopup="dialog" title="Inicia sesión para guardar tus datos en tu nube">
<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4.5 20c1.2-3.6 4-5.4 7.5-5.4s6.3 1.8 7.5 5.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Iniciar sesión</span></button>
<dialog class="saes-dlg ipnt-dlg" id="ipnt-dlg" aria-labelledby="ipnt-h">
  <div class="dl-head"><h2 id="ipnt-h">Tu cuenta y tus datos</h2><button class="x" id="ipnt-x" type="button" aria-label="Cerrar">×</button></div>
  <div id="ipnt-out">
    <p style="margin:0;font-size:.92rem">Sin sesión, tus planes, marcas y actividades se guardan solo en este navegador. Inicia sesión para conservarlos en tu propia nube y usarlos en cualquier dispositivo.</p>
    <div class="row" style="margin-top:12px"><button class="btn primary ipnt-ms" id="ipnt-login" type="button">
      <svg viewBox="0 0 21 21" width="16" height="16" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>
      Continuar con Microsoft</button>
      <button class="btn ipnt-ms" id="ipnt-glogin" type="button" hidden>
      <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true"><path fill="#ea4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285f4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z"/><path fill="#fbbc05" d="M10.6 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.2z"/><path fill="#34a853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>
      Continuar con Google</button></div>
    <p class="saes-note" style="margin:8px 0 0">Microsoft: se guarda en tu OneDrive.<span id="ipnt-gnote" hidden> Google: se guarda en el espacio privado de la aplicación en tu Google Drive.</span></p>
    <p class="ipnt-prueba ipnt-msprueba" hidden><b>Cuentas institucionales en proceso de autorización.</b> El acceso con @alumno.ipn.mx e @ipn.mx estará disponible cuando la aplicación sea autorizada por el área de cómputo del IPN. Mientras tanto, puedes usar una cuenta personal de Microsoft (Outlook o Hotmail) o tu cuenta de Google.</p><p class="ipnt-prueba"  hidden><b>Acceso con Google en fase de prueba.</b> Durante esta etapa, el inicio de sesión con Google está disponible solo para las cuentas registradas como usuarios de prueba. Para solicitar acceso, escribe a <span class="ipnt-contacto"></span> desde la cuenta de Google que deseas usar.</p>
    <p class="saes-note" id="ipnt-soon" style="margin:8px 0 0">El inicio de sesión estará disponible próximamente. Mientras tanto, usa el respaldo en archivo.</p>
  </div>
  <div id="ipnt-in" hidden>
    <p style="margin:0;font-size:.92rem"><b id="ipnt-who"></b></p>
    <div class="row" style="margin-top:10px"><button class="btn" id="ipnt-sync" type="button">Sincronizar ahora</button><button class="btn primary" id="ipnt-relogin" type="button" hidden>Volver a iniciar sesión</button><button class="btn" id="ipnt-logout" type="button">Cerrar sesión</button><button class="link" id="ipnt-wipe" type="button">Cerrar sesión y borrar mis datos de este navegador</button></div>
    <div class="row" id="ipnt-wipe-ok" hidden style="margin-top:8px;font-size:.88rem">¿Borrar de este navegador tus planes, marcas, actividades y datos del SAES? Tu copia en <span id="ipnt-where">la nube</span> se conserva. <button class="btn" id="ipnt-wipe-yes" type="button">Sí, borrar</button></div>
    <label class="chk"><input type="checkbox" id="ipnt-saes"><span>Guardar también mis datos del SAES (kárdex, estado general y cita) en mi nube.</span></label>
  </div>
  <p class="ipnt-state" id="ipnt-state" aria-live="polite"></p>
  <h3>Respaldo en archivo</h3>
  <p class="saes-note" style="margin:0 0 8px">Descarga tus datos para guardarlos o pasarlos a otro navegador. Restaurar reemplaza los datos de este navegador por los del archivo.</p>
  <div class="row"><button class="btn" id="ipnt-down" type="button">Descargar respaldo</button><label class="btn ipnt-file">Restaurar desde archivo<input type="file" id="ipnt-file" accept=".json,application/json"></label></div>
  <p class="ipnt-state" id="ipnt-filemsg" aria-live="polite"></p>
  <p class="saes-note" style="margin:14px 0 0">Tus datos se guardan en tu propia nube: en OneDrive, en la <b>carpeta de la aplicación</b>; en Google Drive, en un espacio privado de la aplicación que no aparece entre tus archivos. La herramienta solo tiene acceso a ese espacio. No hay servidor intermedio: nadie más puede consultarlos. <a href="privacidad.html" target="_blank" rel="noopener">Aviso de privacidad</a> · <a href="condiciones.html" target="_blank" rel="noopener">Condiciones de uso</a></p>
</dialog>
<dialog class="saes-dlg ipnt-dlg" id="ipnt-conf" aria-labelledby="ipnt-conf-h">
  <div class="dl-head"><h2 id="ipnt-conf-h">Ya hay datos en tu cuenta</h2></div>
  <p id="ipnt-conf-txt" style="margin:0;font-size:.95rem"></p>
  <p style="margin:10px 0 0;font-size:.92rem">¿Cuáles quieres conservar?</p>
  <div class="ipnt-conf-op">
    <button class="btn primary" type="button" data-conf="nube"><b>Usar los datos de mi cuenta</b><small>Reemplazan lo que hay en este navegador.</small></button>
    <button class="btn" type="button" data-conf="local"><b>Conservar los de este navegador</b><small>Reemplazan lo guardado en tu cuenta.</small></button>
  </div>
  <p class="saes-note" style="margin:10px 0 0">En ambos casos se suma lo que solo exista de un lado (por ejemplo, tus actividades de Electivas si aquí no las tienes).</p>
</dialog>
<dialog class="saes-dlg ipnt-dlg ipnt-hola" id="ipnt-hola" aria-labelledby="ipnt-hola-h">
  <div class="dl-head"><h2 id="ipnt-hola-h">Bienvenida</h2><button class="x" type="button" data-hola-x aria-label="Cerrar">×</button></div>
  <p class="lead" id="ipnt-h-lead">Selecciona tu unidad y programa académico.</p>
  <div id="ipnt-h-uni"><h3>1. Elige tu unidad académica</h3>
  <div class="ipnt-unis" id="ipnt-h-unis"></div></div>
  <div id="ipnt-h-cars"></div>
  <div class="alt">
    <div id="ipnt-h-login"><p style="margin:0 0 8px;font-size:.92rem">¿Ya la usaste en otro dispositivo? Inicia sesión y se cargan tus datos.</p>
      <div class="row"><button class="btn ipnt-ms" id="ipnt-h-ms" type="button" data-prov="ms"><svg viewBox="0 0 21 21" width="16" height="16" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#00a4ef" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>Continuar con Microsoft</button>
      <button class="btn ipnt-ms" id="ipnt-h-go" type="button" data-prov="google"><svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true"><path fill="#ea4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285f4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z"/><path fill="#fbbc05" d="M10.6 28.5c-.5-1.4-.8-2.9-.8-4.5s.3-3.1.8-4.5l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.2z"/><path fill="#34a853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.3 2.3-6.2 0-11.5-4.1-13.4-9.8l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/></svg>Continuar con Google</button></div><p class="ipnt-prueba ipnt-msprueba" hidden><b>Cuentas institucionales en proceso de autorización.</b> El acceso con @alumno.ipn.mx e @ipn.mx estará disponible cuando la aplicación sea autorizada por el área de cómputo del IPN. Mientras tanto, puedes usar una cuenta personal de Microsoft (Outlook o Hotmail) o tu cuenta de Google.</p><p class="ipnt-prueba"  hidden><b>Acceso con Google en fase de prueba.</b> Durante esta etapa, el inicio de sesión con Google está disponible solo para las cuentas registradas como usuarios de prueba. Para solicitar acceso, escribe a <span class="ipnt-contacto"></span> desde la cuenta de Google que deseas usar.</p></div>
    <p id="ipnt-h-yo" hidden style="margin:0;font-size:.92rem"></p>
    <p class="ipnt-state" id="ipnt-h-msg" aria-live="polite"></p>
    <p style="margin:6px 0 0"><button class="link" type="button" data-hola-x>Explorar sin elegir</button></p>
  </div>
</dialog>"""

AUTH = """<!doctype html><html lang="es"><meta charset="utf-8"><title>Iniciando sesión…</title>
<body style="font:16px system-ui,sans-serif;padding:24px;color:#52525b">Iniciando sesión…</body></html>
"""


def inject(html, unidad=None):
    cfg = config()
    if unidad:
        cfg["unidad"] = unidad
    js = JS.replace("/*__IPNT_CFG__*/{}", json.dumps(cfg), 1)
    html = html.replace("/*__CUENTA_JS__*/", js, 1).replace("/*__CUENTA_CSS__*/", CSS, 1)
    return html.replace("<!--__CUENTA_BTN__-->", UI, 1)
