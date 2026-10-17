# SPDX-License-Identifier: MIT
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import build_grupos
import contenido


def test_oferta_y_config(tmp_path, monkeypatch):
    monkeypatch.setattr(build_grupos, "ROOT", tmp_path)
    (tmp_path / "data").mkdir()
    for nombre in ("grupos.json", "horarios_upiita.json", "sate.json"):
        (tmp_path / "data" / nombre).write_text((ROOT / "data" / nombre).read_text(encoding="utf-8"), encoding="utf-8")
    build_grupos.generar(solo_datos=True)
    salida = tmp_path / "web/dist/sate/grupos"
    oferta = json.loads((salida / "oferta.json").read_text(encoding="utf-8"))
    original = json.loads((ROOT / "data/horarios_upiita.json").read_text(encoding="utf-8"))
    esperadas = {r["Grupo"] + "|" + r["Asignatura"] for r in original["proximo"]}
    ids = [r["id"] for r in oferta["casillas"]]
    assert len(ids) > 600
    assert len(ids) == len(set(ids))
    assert set(ids) == esperadas
    assert oferta["carreras"] == build_grupos.CARRERAS
    sate = json.loads((ROOT / "data/sate.json").read_text(encoding="utf-8"))
    assert oferta["semestrales"] == sate["unidades"]["upiita"]["carrerasSemestrales"]
    assert all("Ingeniería" in nombre and not any(c in nombre for c in ("Ã", "\ufffd", "\udc8d")) for nombre in oferta["carreras"].values())
    assert all(set(c) == {"id", "carrera", "grupo", "materia", "turno", "nivel"} for c in oferta["casillas"])
    assert all(c["turno"] in {"M", "V", "X"} and 1 <= c["nivel"] <= 9 for c in oferta["casillas"])
    assert (salida / "config.json").read_text(encoding="utf-8") == (ROOT / "data/grupos.json").read_text(encoding="utf-8")
    assert not list(salida.glob("enlaces*.json"))


def test_build_completo_y_textos(tmp_path, monkeypatch):
    # Compilación aislada: no altera los datos de publicación ni necesita una API activa.
    monkeypatch.setattr(build_grupos, "ROOT", tmp_path)
    for nombre in ("data/grupos.json", "data/horarios_upiita.json", "data/sate.json", "web/sate/cascaron.html", "web/sate/grupos.html", "web/sate/grupos.js", "web/sate/grupos.css", "vendor/ipn-comun/dist/tokens.css"):
        destino = tmp_path / nombre
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text((ROOT / nombre).read_text(encoding="utf-8"), encoding="utf-8")
    build_grupos.generar()
    salida = tmp_path / "web/dist/sate/grupos"
    assert {p.name for p in salida.iterdir()} == {"index.html", "grupos.js", "grupos.css", "oferta.json", "config.json"}
    js = (salida / "grupos.js").read_text(encoding="utf-8")
    html = (salida / "index.html").read_text(encoding="utf-8")
    claves = set(re.findall(r"['\"](grupos\.[a-z0-9_.]+)['\"]", js))
    claves -= {"grupos.carrera.", "grupos.carrera_corta."}
    assert claves and claves <= contenido.objeto_t().keys()
    assert "{{grupos." not in html and "/*__GRUPOS__*/" not in html
    assert "https://script.googleusercontent.com" in html
    assert 'class="top grupos-encabezado wrap"' in html and 'src="../../assets/logos/ipn-isologo-guinda.webp"' in html
    assert 'src="../../assets/logos/ipn-isologo-calado.webp"' in html
    assert 'SATE UPIITA' in html and 'Sistema de Apoyo a la Trayectoria Escolar' in html
    assert '<dialog id="guia" class="sate-modal" aria-labelledby="guia-titulo">' in html
    assert html.count('<article>') == 6
    encabezado = html.split('<header')[1].split('</header>')[0]
    assert encabezado.count('id="abrir-guia"') == 1
    assert 'aria-label="Guía" title="Guía"' in encabezado
    assert 'id="reglas" class="sate-modal sate-modal--pequeno"' in html
    assert 'id="reglas-titulo" class="sate-modal__titulo" tabindex="-1" autofocus' in html
    assert 'De acuerdo' in html and 'Ver la guía' in html
    dialogs = re.findall(r'<dialog\b[^>]*>.*?</dialog>', html, re.S)
    assert len(dialogs) == 2
    assert all(d.count('Solo grupos de materias de la UPIITA.') == 1 for d in dialogs)
    import skins
    assert skins.THEME_BTN in html and skins.EARLY in html and skins.CSS in html
    assert 'ipnt.grupos.tema' not in js
    sate = json.loads((ROOT / 'data/sate.json').read_text(encoding='utf-8'))
    for pestana in sate['unidades']['upiita']['pestanas']:
        assert f'href="../index.html#/upiita/{pestana}"' in encabezado
    assert 'aria-current="page" aria-selected="true">Grupos' in encabezado
    assert 'UPIITA · Oferta ' in html
    assert (tmp_path / 'web/dist/assets/logos/ipn-isologo-guinda.webp').is_file()
    assert (tmp_path / 'web/dist/assets/logos/ipn-isologo-calado.webp').is_file()
    assert 'src="../../assets/logos/upiita-oro.webp"' in html
    assert "<!--__GRUPOS_IDENTIDAD__-->" not in html
    assert all(f'id="{control}"' in html for control in ("semestre", "turno", "sin", "limpiar", "resultados"))
    assert 'role="switch"' in html and 'aria-live="polite"' in html
    assert html.count('<details><summary>') == 0
    assert 'Cómo funciona' not in html.split('<footer>')[1].split('</footer>')[0]
    plantilla = (ROOT / 'web/sate/grupos.html').read_text(encoding='utf-8')
    assert set(re.findall(r'\{\{(grupos\.[a-z0-9_.]+)\}\}', plantilla)) <= contenido.objeto_t().keys()
    assert contenido.objeto_t()["grupos.lista.nivel"] == "Nivel {n}"
    assert contenido.objeto_t()["grupos.lista.semestre"] == "{n}.{ordinal} semestre"
    for carrera in build_grupos.CARRERAS:
        assert f"grupos.carrera.{carrera.lower()}" in contenido.objeto_t()
        assert f"grupos.carrera_corta.{carrera.lower()}" in contenido.objeto_t()
    assert not list((ROOT / "web/dist/sate/grupos").glob("enlaces*.json"))


def test_diseno_con_tokens_y_escala():
    css = (ROOT / "web/sate/grupos.css").read_text(encoding="utf-8")
    assert "prefers-reduced-motion:reduce" in css
    assert "overflow-wrap:anywhere" not in css
    assert set(re.findall(r"font-size:var\(--ipn-tamano-([a-z]+)\)", css)) <= {"xs", "s", "m", "l", "xl"}
    assert not re.search(r"#[0-9a-fA-F]{3,8}\b|var\(--(?!ipn-)", css)
    assert "min-height:44px" in css and "focus-visible" in css
