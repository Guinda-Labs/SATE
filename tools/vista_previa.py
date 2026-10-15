"""Vista previa de enlaces (Open Graph y Twitter): título, descripción e imagen que muestran Facebook, WhatsApp,
Telegram, etc. al compartir una página del sitio.

La imagen es docs/marca/ipn-tools-og.png (1200x630; fuente en docs/marca/ipn-tools-og.html). Las redes piden la
dirección absoluta de la imagen, que se arma con UPIITA_SITE (p. ej. https://silver-vs.github.io/upiita/). Si el sitio
se aloja en otro dominio (servidor del IPN), basta compilar con esa dirección.
"""
import html as H
import os
import re

DESC_HORARIOS = ("Arma tu horario sin traslapes y planea tu trayectoria en la {u}-IPN: mapa curricular con seriación, "
                 "avance, metas y estadísticas con tus datos del SAES. Libre acceso y sin contraseñas.")
PAGINAS = {
    "index": ("GuindaLabs · Herramientas de libre acceso para el alumnado del IPN",
              "Arma tu horario y planea tu trayectoria escolar: mapa curricular, avance, metas y horario sin traslapes, "
              "con tus datos del SAES. UPIITA, ESCOM y UPIBI."),
    "horarios": ("Horarios · SATE",
                 "Elige tu unidad académica para armar tu horario y planear tu trayectoria con SATE."),
    "horarios-upiita": ("Horarios UPIITA · SATE", DESC_HORARIOS.format(u="UPIITA")),
    "horarios-escom": ("Horarios ESCOM · SATE", DESC_HORARIOS.format(u="ESCOM")),
    "horarios-upibi": ("Horarios UPIBI · SATE", DESC_HORARIOS.format(u="UPIBI")),
    "electivas": ("Electivas UPIITA · SATE",
                  "Actividades acreditables y formatos DIE-03 para la liberación de electivas en la UPIITA-IPN."),
}
IMAGEN = "assets/icono/ipn-tools-og.png"


def aplicar(html, nombre, site=None):
    """Agrega (o reemplaza) las etiquetas de vista previa justo después de <title>."""
    if nombre not in PAGINAS:
        return html
    site = os.environ.get("UPIITA_SITE", "") if site is None else site
    titulo, desc = PAGINAS[nombre]
    url = site + ("" if nombre == "index" else f"{nombre}.html") if site else ""
    img = site + IMAGEN if site else IMAGEN
    e = lambda s: H.escape(s, quote=True)
    tags = [f'<meta name="description" content="{e(desc)}">',
            '<meta property="og:type" content="website">', '<meta property="og:site_name" content="SATE">',
            '<meta property="og:locale" content="es_MX">',
            f'<meta property="og:title" content="{e(titulo)}">', f'<meta property="og:description" content="{e(desc)}">',
            f'<meta property="og:image" content="{e(img)}">', '<meta property="og:image:width" content="1200">',
            '<meta property="og:image:height" content="630">',
            '<meta property="og:image:alt" content="SATE: arma tu horario y planea tu trayectoria">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{e(titulo)}">', f'<meta name="twitter:description" content="{e(desc)}">',
            f'<meta name="twitter:image" content="{e(img)}">']
    if url:
        tags.insert(4, f'<meta property="og:url" content="{e(url)}">')
    # sin duplicados: se quitan las que ya existieran
    html = re.sub(r'\s*<meta (?:name="description"|property="og:[^"]+"|name="twitter:[^"]+")[^>]*>', "", html)
    return html.replace("</title>", "</title>\n" + "\n".join(tags), 1)
