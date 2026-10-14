"""Convierte la copia de silver-vs.github.io/upiita en dirección heredada que manda a GuindaLabs.

Uso: python tools/legado_silver.py <clon de Silver-VS.github.io> <web/dist compilado para GuindaLabs>

- Cada página HTML de upiita/ se reemplaza por una página que redirige a la misma ruta en guinda-labs.github.io
  (conservando ?consulta y #fragmento). Si el navegador tiene datos guardados de IPN-tools/SATE, primero ofrece
  llevarlos a la nueva dirección (pestaña a pestaña con postMessage; nada pasa por un servidor ni por la URL).
- Los marcadores ya instalados cargan lector.js, captura.js y cupos.js desde la dirección anterior: se sustituyen por
  los de la compilación de GuindaLabs, que ya abren la nueva dirección.
"""
import pathlib, shutil, sys

NUEVO = 'https://guinda-labs.github.io/'
MARCADORES = ('lector.js', 'captura.js', 'cupos.js')

PLANTILLA = r'''<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<link rel="canonical" href="__DESTINO__">
<title>SATE se mudó · GuindaLabs</title>
<style>
:root{--fondo:#fafafa;--texto:#18181b;--tenue:#71717a;--linea:#e4e4e7;--acento:#7a1f45;--sobre:#fff}
@media (prefers-color-scheme:dark){:root{--fondo:#18181b;--texto:#fafafa;--tenue:#a1a1aa;--linea:#3f3f46;--acento:#f0a3c4;--sobre:#18181b}}
body{margin:0;background:var(--fondo);color:var(--texto);font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{max-width:480px;border:1px solid var(--linea);border-radius:16px;padding:24px}
h1{font-size:1.25rem;margin:0 0 8px}p{color:var(--tenue);margin:8px 0}
button{font:inherit;border:0;border-radius:999px;padding:10px 18px;background:var(--acento);color:var(--sobre);cursor:pointer;font-weight:600}
a{color:var(--acento)}
</style>
</head>
<body>
<main hidden id="aviso">
  <h1>IPN-tools ahora es SATE en GuindaLabs</h1>
  <p>La herramienta cambió de dirección. Tienes datos guardados en este navegador (tus horarios, tu mapa y lo que leíste del SAES); llévalos a la nueva dirección con un clic.</p>
  <p><button type="button" id="llevar">Llevar mis datos y continuar</button></p>
  <p id="estado" role="status" aria-live="polite"></p>
  <p><a id="sin" href="__DESTINO__">Continuar sin mis datos</a></p>
</main>
<noscript><p><a href="__DESTINO__">Ir a la nueva dirección</a></p></noscript>
<script>
(function(){
  'use strict';
  const NUEVO='__NUEVO__', RUTA='__RUTA__', PREFIJOS=['hu.','ue.','saes.','ipnt.'];
  const resto=location.search+location.hash, destino=NUEVO+RUTA+resto;
  document.getElementById('sin').href=destino;
  let claves=[];
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(PREFIJOS.some(p=>k.startsWith(p)))claves.push(k)}}catch(e){}
  let migrado=false;try{migrado=!!localStorage.getItem('ipnt.migrado.guinda')}catch(e){}
  if(!claves.length||migrado){location.replace(destino);return}
  document.getElementById('aviso').hidden=false;
  const estado=document.getElementById('estado');
  document.getElementById('llevar').onclick=()=>{
    const origen=new URL(NUEVO).origin;
    const w=window.open(NUEVO+'migrar.html?destino='+encodeURIComponent(RUTA+resto),'_blank');
    if(!w){estado.textContent='El navegador bloqueó la nueva pestaña. Permítela y vuelve a pulsar el botón.';return}
    estado.textContent='Abriendo la nueva dirección…';
    window.addEventListener('message',e=>{
      if(e.origin!==origen||e.source!==w)return;
      if(e.data&&e.data.tipo==='ipnt.migrar.listo'){
        const datos={};for(const k of claves){try{datos[k]=localStorage.getItem(k)}catch(x){}}
        w.postMessage({tipo:'ipnt.migrar.datos',v:1,datos},origen);
      }
      if(e.data&&e.data.tipo==='ipnt.migrar.hecho'){
        try{localStorage.setItem('ipnt.migrado.guinda',new Date().toISOString())}catch(x){}
        estado.textContent='Listo. Tus datos ya están en la nueva dirección; puedes cerrar esta pestaña.';
      }
    });
  };
})();
</script>
</body>
</html>
'''


def main(clon, dist):
    upiita = pathlib.Path(clon) / 'upiita'
    dist = pathlib.Path(dist)
    paginas = sorted(upiita.rglob('*.html'))
    for p in paginas:
        ruta = p.relative_to(upiita).as_posix()
        if ruta == 'index.html':
            ruta = ''
        destino = NUEVO + ruta
        html = PLANTILLA.replace('__NUEVO__', NUEVO).replace('__RUTA__', ruta).replace('__DESTINO__', destino)
        p.write_text(html, encoding='utf-8')
    for m in MARCADORES:
        if (dist / m).exists():
            shutil.copy(dist / m, upiita / m)
    print(f'{len(paginas)} páginas redirigen a {NUEVO}; marcadores sustituidos: {", ".join(m for m in MARCADORES if (dist / m).exists())}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
