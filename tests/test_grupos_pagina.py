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
    for nombre in ("grupos.json", "horarios_upiita.json"):
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
    assert all("Ingeniería" in nombre and not any(c in nombre for c in ("Ã", "\ufffd", "\udc8d")) for nombre in oferta["carreras"].values())
    assert all(set(c) == {"id", "carrera", "grupo", "materia", "turno", "nivel"} for c in oferta["casillas"])
    assert all(c["turno"] in {"M", "V", "X"} and 1 <= c["nivel"] <= 9 for c in oferta["casillas"])
    assert (salida / "config.json").read_text(encoding="utf-8") == (ROOT / "data/grupos.json").read_text(encoding="utf-8")
    assert not list(salida.glob("enlaces*.json"))


def test_build_completo_y_textos(tmp_path, monkeypatch):
    # Compilación aislada: no altera los datos de publicación ni necesita una API activa.
    monkeypatch.setattr(build_grupos, "ROOT", tmp_path)
    for nombre in ("data/grupos.json", "data/horarios_upiita.json", "web/sate/grupos.html", "web/sate/grupos.js", "web/sate/grupos.css", "vendor/ipn-comun/dist/tokens.css"):
        destino = tmp_path / nombre
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_text((ROOT / nombre).read_text(encoding="utf-8"), encoding="utf-8")
    build_grupos.generar()
    salida = tmp_path / "web/dist/sate/grupos"
    assert {p.name for p in salida.iterdir()} == {"index.html", "grupos.js", "grupos.css", "oferta.json", "config.json"}
    js = (salida / "grupos.js").read_text(encoding="utf-8")
    html = (salida / "index.html").read_text(encoding="utf-8")
    claves = set(re.findall(r"['\"](grupos\.[a-z0-9_.]+)['\"]", js))
    claves -= {"grupos.lista.semestre_", "grupos.carrera.", "grupos.carrera_corta."}
    assert claves and claves <= contenido.objeto_t().keys()
    assert "{{grupos." not in html and "/*__GRUPOS__*/" not in html
    assert "https://script.googleusercontent.com" in html
    assert 'class="inst"' in html and 'src="../../assets/logos/ipn-horizontal-guinda.webp"' in html
    assert 'src="../../assets/logos/upiita-oro.webp"' in html and "Volver a SATE" in html
    assert "<!--__GRUPOS_IDENTIDAD__-->" not in html
    assert all(f'id="{control}"' in html for control in ("semestre", "turno", "sin", "limpiar", "resultados"))
    assert 'role="switch"' in html and 'aria-live="polite"' in html
    assert html.count('<details><summary>') == 2
    for nivel in range(1, 10):
        assert f"grupos.lista.semestre_{nivel}" in contenido.objeto_t()
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
