# SPDX-License-Identifier: MIT
"""Directorio estático; enlaces*.json pertenece exclusivamente a la Action."""
import html
import json
import pathlib
import re
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
CARRERAS = {"B": "Ingeniería Biónica", "E": "Ingeniería en Energía",
            "M": "Ingeniería Mecatrónica", "S": "Ingeniería en Sistemas Automotrices",
            "T": "Ingeniería Telemática"}


def generar(solo_datos=False):
    import contenido
    from acentos import acentuar_nombre
    destino = ROOT / "web/dist/sate/grupos"
    destino.mkdir(parents=True, exist_ok=True)
    config = (ROOT / "data/grupos.json").read_text(encoding="utf-8")
    periodo = json.loads(config)["periodo"]
    fuente = json.loads((ROOT / "data/horarios_upiita.json").read_text(encoding="utf-8"))
    sate = json.loads((ROOT / "data/sate.json").read_text(encoding="utf-8"))
    capacidades = sate["unidades"]["upiita"]
    casillas = {}
    for fila in fuente["proximo"]:
        ident = fila["Grupo"] + "|" + fila["Asignatura"]
        casillas.setdefault(ident, dict(id=ident, carrera=fila["carrera"], grupo=fila["Grupo"],
                                       materia=fila["Asignatura"], turno=fila["turno"], nivel=int(fila["nivel"])))
    oferta = dict(periodo=periodo, generado=datetime.now(timezone.utc).isoformat(),
                  carreras={c: CARRERAS[c] for c in fuente["carreras"]},
                  semestrales=capacidades["carrerasSemestrales"],
                  casillas=sorted(casillas.values(), key=lambda c: (c["nivel"], c["grupo"], c["materia"])))
    (destino / "config.json").write_text(config, encoding="utf-8")
    (destino / "oferta.json").write_text(json.dumps(oferta, ensure_ascii=False), encoding="utf-8")
    if solo_datos:
        return
    textos = {k: v for k, v in contenido.objeto_t().items() if k.startswith("grupos.")}
    pagina = (ROOT / "web/sate/grupos.html").read_text(encoding="utf-8")
    reglas = '<ul>' + ''.join('<li>{{grupos.reglas.' + k + '}}</li>'
                              for k in ('clases', 'funcionan', 'dominio', 'abuso')) + '</ul>'
    pagina = pagina.replace('<!--__GRUPOS_REGLAS__-->', reglas)
    etiquetas = contenido.objeto_t()
    pestanas = []
    for p in capacidades['pestanas']:
        if p in sate.get('pestanasOcultas', []):
            continue
        pestanas.append('<a class="sate-pestana" href="../index.html#/upiita/' + p + '">'
                        + html.escape(etiquetas['sate.pestana.' + p + '.titulo']) + '</a>')
    pestanas.append('<a class="sate-pestana" href="./" aria-current="page" aria-selected="true">'
                    + html.escape(textos['grupos.pagina.pestana']) + '</a>')
    pagina = pagina.replace('<!--__GRUPOS_PESTANAS__-->', '<div class="sate-pestanas">' + ''.join(pestanas) + '</div>')
    pagina = re.sub(r"\{\{(grupos\.[a-z0-9_.]+)\}\}",
                    lambda m: html.escape(textos[m[1]].replace("{periodo}", periodo)), pagina)
    nombres = {c["materia"]: re.sub(r"\b(i{1,3}|iv|v|vi{1,3}|ix|x)\b", lambda m: m[0].upper(),
                                   acentuar_nombre(c["materia"]).capitalize()) for c in casillas.values()}
    datos = json.dumps(dict(textos=textos, nombres=nombres), ensure_ascii=False).replace("<", "\\u003c")
    pagina = pagina.replace("/*__GRUPOS__*/", "window.GRUPOS=" + datos + ";")
    # Compartir el cascarón evita que la paleta, tipografía y controles diverjan de SATE.
    import comun, skins
    cascaron = (ROOT / 'web/sate/cascaron.html').read_text(encoding='utf-8')
    css = re.search(r'<style>(.*?)</style>', cascaron, re.S)[1]
    css = css.replace('/*__COMPONENTES_CSS__*/', '')
    pagina = pagina.replace('/*__SATE_ESTILO__*/', css)
    pagina = skins.inject(comun.inyectar(pagina))
    from institucional import HEADER, ROOT as RAIZ_IDENTIDAD
    from PIL import Image
    logos = destino.parents[1] / "assets/logos"
    logos.mkdir(parents=True, exist_ok=True)
    # El original horizontal reserva el primer 26 % al escudo, con su área de protección.
    # Generar la pieza aquí evita depender de archivos de otra rama o recortar con CSS.
    for version in ("guinda", "calado"):
        with Image.open(RAIZ_IDENTIDAD / f"data/identidad/originales/ipn-horizontal-{version}.png") as imagen:
            imagen.crop((0, 0, round(imagen.width * .26), imagen.height)).save(
                logos / f"ipn-isologo-{version}.webp", lossless=True)
    ipn = ('<span class="grupos-logo-ipn">'
           '<img class="logo-lt" src="../../assets/logos/ipn-isologo-guinda.webp" alt="Instituto Politécnico Nacional">'
           '<img class="logo-dk" src="../../assets/logos/ipn-isologo-calado.webp" alt="Instituto Politécnico Nacional"></span>')
    unidad = re.search(r'<a class="unit".*?</a>', HEADER, re.S)[0].replace('src="assets/', 'src="../../assets/')
    pagina = pagina.replace('<!--__GRUPOS_IPN__-->', ipn).replace('<!--__GRUPOS_UPIITA__-->', unidad)
    (destino / "index.html").write_text(pagina, encoding="utf-8")
    (destino / "grupos.js").write_text((ROOT / "web/sate/grupos.js").read_text(encoding="utf-8"), encoding="utf-8")
    (destino / "grupos.css").write_text((ROOT / "web/sate/grupos.css").read_text(encoding="utf-8"), encoding="utf-8")
