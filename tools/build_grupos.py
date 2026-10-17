# SPDX-License-Identifier: MIT
"""Directorio estático; enlaces*.json pertenece exclusivamente a la Action."""
import html
import json
import pathlib
import re
import shutil
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
    from encabezado import encabezado_sate, pestanas_encabezado
    etiquetas = contenido.objeto_t()
    unidad_enc = dict(capacidades, siglas='UPIITA')
    pestanas = pestanas_encabezado(sate, 'upiita', etiquetas, inicio='../index.html')
    pestanas.append(dict(id='grupos', href='./', texto=textos['grupos.pagina.pestana']))
    guia = ('<button id="abrir-guia" class="sate-btn-barra" type="button" aria-haspopup="dialog" aria-controls="guia" '
            'aria-label="{{grupos.guia.boton}}" title="{{grupos.guia.boton}}">'
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">'
            '<path d="M12 5C9 3 5 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/></svg>'
            '<span>{{grupos.guia.boton}}</span></button>')
    # Mismo componente que SATE: marca | (sin selector de carrera) | acciones y logo de la unidad.
    encabezado = encabezado_sate(textos=etiquetas, unidad=unidad_enc, contexto=False,
                                 acciones=guia + '<!--__THEME_BTN__-->', pestanas=pestanas,
                                 activa='grupos', recursos='../../', avisos=False)
    pagina = pagina.replace('<!--__GRUPOS_ENCABEZADO__-->', encabezado)
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
    from institucional import ROOT as RAIZ_IDENTIDAD
    from PIL import Image
    logos = destino.parents[1] / "assets/logos"
    logos.mkdir(parents=True, exist_ok=True)
    # El original horizontal reserva el primer 26 % al escudo, con su área de protección.
    # Generar la pieza aquí evita depender de archivos de otra rama o recortar con CSS.
    for version in ("guinda", "calado"):
        with Image.open(RAIZ_IDENTIDAD / f"data/identidad/originales/ipn-horizontal-{version}.png") as imagen:
            imagen.crop((0, 0, round(imagen.width * .26), imagen.height)).save(
                logos / f"ipn-isologo-{version}.webp", lossless=True)
    import vista_previa   # etiquetas Open Graph/Twitter y su imagen (assets/og/grupos.png)
    pagina = vista_previa.aplicar(pagina, "sate/grupos/index.html")
    vista_previa.copiar_imagenes(destino.parents[1], ROOT)
    (destino / "index.html").write_text(pagina, encoding="utf-8")
    (destino / "grupos.js").write_text((ROOT / "web/sate/grupos.js").read_text(encoding="utf-8"), encoding="utf-8")
    shutil.copy(ROOT / "web/sate/encabezado.css", destino.parent / "encabezado.css")
    (destino / "grupos.css").write_text((ROOT / "web/sate/grupos.css").read_text(encoding="utf-8"), encoding="utf-8")
