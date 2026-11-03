"""Vista previa de enlaces (Open Graph y Twitter): título, descripción e imagen que muestran Facebook, WhatsApp,
Telegram, etc. al compartir una página del sitio.

Los textos viven en data/vista_previa.json (clave = ruta publicada); las imágenes 1200x630 las genera
tools/og_imagenes.py en docs/marca/og/ y el build las copia a assets/og/. Las redes piden la dirección absoluta de la
imagen, que se arma con UPIITA_SITE (p. ej. https://guinda-labs.github.io/).
"""
import html as H
import json
import os
import pathlib
import re
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
_CFG = json.loads((ROOT / "data/vista_previa.json").read_text(encoding="utf-8"))
PAGINAS = _CFG["paginas"]
NOINDEX = '<meta name="robots" content="noindex">'


def ruta(nombre):
    """'index' -> 'index.html'; 'sate/index' -> 'sate/index.html'; 'horarios-upiita.html' queda igual."""
    return nombre if nombre.endswith(".html") else nombre + ".html"


def copiar_imagenes(dist, raiz=ROOT):
    """Copia docs/marca/og/*.png a <dist>/assets/og/ (si existen)."""
    origen = pathlib.Path(raiz) / "docs/marca/og"
    if not origen.is_dir():
        return
    destino = pathlib.Path(dist) / "assets/og"
    destino.mkdir(parents=True, exist_ok=True)
    for f in origen.glob("*.png"):
        shutil.copy(f, destino / f.name)


def sin_indexar(html):
    """Para páginas que no se comparten (auth, migrar, revisión): robots noindex, una sola vez."""
    if 'name="robots"' in html:
        return html
    return html.replace("</title>", "</title>\n" + NOINDEX, 1)


def aplicar(html, nombre, site=None):
    """Agrega (o reemplaza) las etiquetas de vista previa justo después de <title>."""
    clave = ruta(nombre)
    if clave not in PAGINAS:
        return html
    site = os.environ.get("UPIITA_SITE", "") if site is None else site
    p = PAGINAS[clave]
    titulo, desc = p["titulo"], p["descripcion"]
    url = site + ("" if clave == "index.html" else clave) if site else ""
    img = site + "assets/og/" + p["imagen"] if site else "assets/og/" + p["imagen"]
    e = lambda s: H.escape(s, quote=True)
    tags = [f'<meta name="description" content="{e(desc)}">',
            '<meta property="og:type" content="website">',
            f'<meta property="og:site_name" content="{"GuindaLabs" if clave == "index.html" else _CFG["sitio"]}">',
            '<meta property="og:locale" content="es_MX">',
            f'<meta property="og:title" content="{e(titulo)}">', f'<meta property="og:description" content="{e(desc)}">',
            # WhatsApp y Facebook: imagen 1200×630 (1.91:1), PNG < 600 KB, con tipo y URL segura explícitos.
            f'<meta property="og:image" content="{e(img)}">', f'<meta property="og:image:secure_url" content="{e(img)}">',
            '<meta property="og:image:type" content="image/png">', '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            f'<meta property="og:image:alt" content="{e(p["alt"])}">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{e(titulo)}">', f'<meta name="twitter:description" content="{e(desc)}">',
            f'<meta name="twitter:image" content="{e(img)}">']
    if url:
        tags.insert(4, f'<meta property="og:url" content="{e(url)}">')
    # sin duplicados: se quitan las que ya existieran
    html = re.sub(r'\s*<meta (?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>', "", html)
    return html.replace("</title>", "</title>\n" + "\n".join(tags), 1)
