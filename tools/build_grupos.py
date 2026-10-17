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
    capacidades = json.loads((ROOT / "data/sate.json").read_text(encoding="utf-8"))["unidades"]["upiita"]
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
    pagina = re.sub(r"\{\{(grupos\.[a-z0-9_.]+)\}\}",
                    lambda m: html.escape(textos[m[1]].replace("{periodo}", periodo)), pagina)
    nombres = {c["materia"]: re.sub(r"\b(i{1,3}|iv|v|vi{1,3}|ix|x)\b", lambda m: m[0].upper(),
                                   acentuar_nombre(c["materia"]).capitalize()) for c in casillas.values()}
    datos = json.dumps(dict(textos=textos, nombres=nombres), ensure_ascii=False).replace("<", "\\u003c")
    pagina = pagina.replace("/*__GRUPOS__*/", "window.GRUPOS=" + datos + ";")
    css = (ROOT / "vendor/ipn-comun/dist/tokens.css").read_text(encoding="utf-8")
    pagina = pagina.replace("/*__TOKENS__*/", css)
    from institucional import HEADER
    # La firma es la misma de SATE; las imágenes solo se insertan en dist.
    cabecera = HEADER.split("</style>", 1)[1]
    cabecera = re.sub(r'<div class="inst-name">.*?</div>', '', cabecera)
    cabecera = cabecera.replace('src="assets/', 'src="../../assets/')
    cabecera = cabecera.replace('</header>', '<a class="grupos-volver" href="../index.html#/upiita">'
                                + html.escape(textos['grupos.pagina.volver']) + '</a></header>')
    pagina = pagina.replace('<!--__GRUPOS_IDENTIDAD__-->', cabecera)
    (destino / "index.html").write_text(pagina, encoding="utf-8")
    (destino / "grupos.js").write_text((ROOT / "web/sate/grupos.js").read_text(encoding="utf-8"), encoding="utf-8")
    (destino / "grupos.css").write_text((ROOT / "web/sate/grupos.css").read_text(encoding="utf-8"), encoding="utf-8")
