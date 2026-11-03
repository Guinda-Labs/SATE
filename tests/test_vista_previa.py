# SPDX-License-Identifier: MIT
"""Vista previa de enlaces: etiquetas en las páginas compiladas, imágenes 1200x630 y descripciones breves."""
import json
import pathlib
import re
import sys

import pytest
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import vista_previa

DIST = ROOT / "web/dist"
SITIO = "https://guinda-labs.github.io/"
PAGINAS = vista_previa.PAGINAS


@pytest.mark.parametrize("ruta", sorted(PAGINAS))
def test_datos_e_imagen(ruta):
    p = PAGINAS[ruta]
    assert len(p["descripcion"]) <= 160
    assert len(p["titular"].split()) <= 6
    with Image.open(ROOT / "docs/marca/og" / p["imagen"]) as im:
        assert im.size == (1200, 630)


def test_aplicar_absoluta_y_sin_duplicados():
    base = '<title>x</title><meta name="description" content="viejo"><meta property="og:title" content="viejo">'
    out = vista_previa.aplicar(base, "sate/grupos/index", SITIO)
    assert out.count('property="og:title"') == 1 and "viejo" not in out
    assert f'content="{SITIO}assets/og/grupos.png"' in out
    assert 'content="summary_large_image"' in out
    assert vista_previa.aplicar(base, "auth", SITIO) == base


def test_marca_sate_salvo_portada():
    assert 'og:site_name" content="SATE"' in vista_previa.aplicar("<title>x</title>", "sate/grupos/index", SITIO)
    assert 'og:site_name" content="GuindaLabs"' in vista_previa.aplicar("<title>x</title>", "index", SITIO)


@pytest.mark.skipif(not (DIST / "index.html").is_file(), reason="compila antes con UPIITA_SITE")
@pytest.mark.parametrize("ruta", sorted(PAGINAS))
def test_paginas_compiladas(ruta):
    archivo = DIST / ruta
    if not archivo.is_file():
        pytest.skip("página no compilada en esta unidad")
    html = archivo.read_text(encoding="utf-8")
    assert re.search(r'property="og:title" content="[^"]+"', html)
    img = re.search(r'property="og:image" content="([^"]+)"', html)[1]
    assert img.startswith("https://") and img.endswith("/assets/og/" + PAGINAS[ruta]["imagen"])
    assert 'name="twitter:card" content="summary_large_image"' in html
    assert (DIST / "assets/og" / PAGINAS[ruta]["imagen"]).is_file()


@pytest.mark.skipif(not (DIST / "index.html").is_file(), reason="compila antes con UPIITA_SITE")
@pytest.mark.parametrize("ruta", ["auth.html", "migrar.html", "revision.html"])
def test_privadas_sin_og_y_noindex(ruta):
    html = (DIST / ruta).read_text(encoding="utf-8")
    assert "og:title" not in html and '<meta name="robots" content="noindex">' in html
