# SPDX-License-Identifier: MIT
"""Imágenes de vista previa de enlaces (1200x630) para cada página de data/vista_previa.json.

Sin navegador: Pillow + Noto Sans (variable) del sistema, solo lectura. Salida: docs/marca/og/<imagen>.png.
No regenera si la huella (JSON + periodo + este script + ícono) no cambió.
"""
import hashlib
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FUENTE = pathlib.Path(r"C:\Windows\Fonts\NotoSansSC-VF.ttf")
ICONO = ROOT / "docs/marca/ipn-tools-icono-512.png"
SALIDA = ROOT / "docs/marca/og"
ANCHO, ALTO, MARGEN = 1200, 630, 80
CREMA, SUAVE, ROSA = (250, 246, 243), (228, 214, 220), (243, 198, 216)


def datos():
    cfg = json.loads((ROOT / "data/vista_previa.json").read_text(encoding="utf-8"))
    periodo = json.loads((ROOT / "data/grupos.json").read_text(encoding="utf-8"))["periodo"]
    return cfg, periodo


def huella(cfg, periodo):
    h = hashlib.sha256()
    for parte in (json.dumps(cfg, sort_keys=True, ensure_ascii=False), periodo,
                  pathlib.Path(__file__).read_bytes(), ICONO.read_bytes()):
        h.update(parte if isinstance(parte, bytes) else parte.encode("utf-8"))
    return h.hexdigest()


def fuente(tam, peso):
    if not FUENTE.is_file():
        sys.exit(f"Falta la fuente {FUENTE} (Noto Sans SC variable de Windows); no se pueden generar las imágenes.")
    f = ImageFont.truetype(str(FUENTE), tam)
    f.set_variation_by_name(peso)
    return f


def fondo():
    y, x = np.mgrid[0:ALTO, 0:ANCHO].astype(np.float32)
    d = np.hypot(x - ANCHO * .86, y - ALTO * .40) / (ANCHO * .74)   # 0 en el centro del resplandor, 1 en el borde
    puntos = [(0, (122, 30, 72)), (.36 / .74, (74, 20, 48)), (1, (30, 20, 24))]
    d = np.clip(d, 0, 1)
    canales = []
    for c in range(3):
        canales.append(np.interp(d, [p[0] for p in puntos], [p[1][c] for p in puntos]))
    return Image.fromarray(np.stack(canales, -1).astype(np.uint8), "RGB")


def envolver(texto, f, ancho):
    lineas, actual = [], ""
    for palabra in texto.split():
        prueba = (actual + " " + palabra).strip()
        if f.getlength(prueba) <= ancho or not actual:
            actual = prueba
        else:
            lineas.append(actual)
            actual = palabra
    return lineas + [actual]


def ajustar(texto, peso, tam, minimo, ancho, max_lineas):
    """Mayor cuerpo (hasta tam) con el que el texto cabe en max_lineas."""
    while tam >= minimo:
        f = fuente(tam, peso)
        lineas = envolver(texto, f, ancho)
        if len(lineas) <= max_lineas:
            return f, lineas
        tam -= 2
    sys.exit(f"No cabe «{texto}» en {max_lineas} líneas")


def pieza(p, periodo):
    img = fondo()
    dib = ImageDraw.Draw(img)
    ancho = ANCHO - 2 * MARGEN
    # marca: ícono + nombre
    lado = 88
    ico = Image.open(ICONO).convert("RGBA").resize((lado, lado), Image.LANCZOS)
    img.paste(ico, (MARGEN - 12, MARGEN), ico)   # el ícono trae ~12 px de aire transparente
    f_marca = fuente(54, "Bold")
    dib.text((MARGEN + lado - 4, MARGEN + lado // 2), p.get("marca", "SATE"), font=f_marca, fill=CREMA, anchor="lm")
    # titular y subtítulo, centrados en la franja entre marca y pie
    f_tit, tit = ajustar(p["titular"], "Black", 84, 56, ancho * .86, 2)
    f_sub, sub = ajustar(p["subtitulo"], "Medium", 32, 26, ancho * .80, 2)
    alto_tit = len(tit) * int(f_tit.size * 1.12)
    alto_sub = len(sub) * int(f_sub.size * 1.4)
    bloque = alto_tit + 22 + alto_sub
    zona_ini, zona_fin = MARGEN + lado + 24, ALTO - MARGEN - 36
    y = zona_ini + (zona_fin - zona_ini - bloque) // 2
    for linea in tit:
        dib.text((MARGEN, y), linea, font=f_tit, fill=CREMA, anchor="la")
        y += int(f_tit.size * 1.12)
    y += 22
    for linea in sub:
        dib.text((MARGEN, y), linea, font=f_sub, fill=SUAVE, anchor="la")
        y += int(f_sub.size * 1.4)
    # pie: «por GuindaLabs» a la izquierda (solo si la marca es SATE), unidad y periodo a la derecha
    f_pie = fuente(26, "Bold")
    base = ALTO - MARGEN
    if p.get("marca", "SATE") != "GuindaLabs":
        dib.text((MARGEN, base), "por GuindaLabs", font=fuente(26, "Medium"), fill=(214, 180, 196), anchor="ls")
    dib.text((ANCHO - MARGEN, base), p["pie"].replace("{periodo}", periodo), font=f_pie, fill=ROSA, anchor="rs")
    return img


def main(forzar=False):
    cfg, periodo = datos()
    SALIDA.mkdir(parents=True, exist_ok=True)
    archivo_huella = SALIDA / ".huella"
    nombres = sorted({p["imagen"] for p in cfg["paginas"].values()})
    nueva = huella(cfg, periodo)
    if (not forzar and archivo_huella.is_file() and archivo_huella.read_text().strip() == nueva
            and all((SALIDA / n).is_file() for n in nombres)):
        print("og_imagenes: sin cambios")
        return
    hechas = set()
    for p in cfg["paginas"].values():
        if p["imagen"] in hechas:
            continue
        pieza(p, periodo).save(SALIDA / p["imagen"], optimize=True)
        hechas.add(p["imagen"])
    archivo_huella.write_text(nueva, encoding="utf-8")
    print("og_imagenes:", len(hechas), "imágenes en", SALIDA)


if __name__ == "__main__":
    main("--forzar" in sys.argv)
