"""Publica únicamente cambios del mapa curado; no registra URLs con secretos."""

import json
import os
from pathlib import Path
import re
import sys
from datetime import datetime, timezone
from urllib.parse import urlencode, urlsplit, urlunsplit
from urllib.request import urlopen


URL = re.compile(r"https://chat\.whatsapp\.com/(invite/)?[A-Za-z0-9]{20,24}\Z")
ISO = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)\Z")
MOTIVOS = {"caido", "lleno", "equivocado", "otro"}


def fecha(valor):
    if not isinstance(valor, str) or not ISO.fullmatch(valor):
        raise ValueError("Fecha ISO UTC inválida")
    return datetime.fromisoformat(valor.replace("Z", "+00:00"))


def normalizar_url(valor):
    if not isinstance(valor, str):
        raise ValueError("URL inválida")
    valor = re.split(r"[?#]", "".join(valor.split()), maxsplit=1)[0]
    if not URL.fullmatch(valor):
        raise ValueError("URL inválida")
    return valor


def toca(horario, ahora, evento):
    if evento != "schedule":
        return True
    for fase in horario:
        if fase["hasta"] is not None and ahora >= fecha(fase["hasta"]):
            continue
        cada = fase["cada_min"]
        if cada == 5:
            return True
        if cada == 60:
            return ahora.minute < 10
        if cada == 1440:
            return ahora.hour == fase["hora_utc"] and ahora.minute < 10
        raise ValueError("Frecuencia de horario inválida")
    return False


def validar(mapa, ids, modo):
    if not isinstance(mapa, dict) or mapa.get("ok") is False:
        raise ValueError("Exportación inválida")
    resultado = {}
    for id_, entrada in mapa.items():
        try:
            if id_ not in ids or not isinstance(entrada, dict):
                raise ValueError("Casilla inválida")
            url = normalizar_url(entrada["url"])
            fecha(entrada["desde"])
            reemplazo = entrada["reemplazo"]
            if reemplazo is not None:
                if not isinstance(reemplazo, dict) or reemplazo["motivo"] not in MOTIVOS:
                    raise ValueError("Motivo inválido")
                fecha(reemplazo["fecha"])
                reemplazo = {"motivo": reemplazo["motivo"], "fecha": reemplazo["fecha"]}
            resultado[id_] = {"url": url, "desde": entrada["desde"], "reemplazo": reemplazo}
        except (ValueError, KeyError, TypeError):
            # No se imprime la entrada: podría contener texto ajeno o secretos.
            print(f"Aviso: entrada inválida descartada en modo {modo or 'real'}.")
    return resultado


def exportar(endpoint, clave, modo):
    partes = urlsplit(endpoint)
    if partes.scheme != "https" or not partes.netloc:
        raise ValueError("Endpoint HTTPS inválido")
    consulta = urlencode({"accion": "exportar", "modo": modo, "clave": clave})
    url = urlunsplit((partes.scheme, partes.netloc, partes.path,
                     partes.query + "&" + consulta if partes.query else consulta, ""))
    try:
        with urlopen(url, timeout=45) as respuesta:
            return json.load(respuesta)
    except Exception:
        # Las excepciones HTTP pueden incluir la URL y CLAVE_EXPORT.
        raise ValueError(f"No se pudo exportar el modo {modo or 'real'}.") from None


def publicar(raiz=Path("."), ahora=None, evento=None):
    carpeta = Path(raiz) / "sate" / "grupos"
    if not (carpeta / "config.json").is_file() or not (carpeta / "oferta.json").is_file():
        print("Aviso: faltan config.json u oferta.json; sin publicación.")
        return 0
    ahora = ahora or datetime.now(timezone.utc)
    config = json.loads((carpeta / "config.json").read_text(encoding="utf-8"))
    if not toca(config["horario"], ahora, evento or os.environ.get("GITHUB_EVENT_NAME", "workflow_dispatch")):
        print("Horario: no toca verificar en esta ejecución.")
        return 0
    oferta = json.loads((carpeta / "oferta.json").read_text(encoding="utf-8"))
    ids = {c["id"] for c in oferta["casillas"]}
    clave = os.environ.get("GRUPOS_CLAVE")
    if not clave:
        print("Aviso: falta el secreto GRUPOS_CLAVE; sin publicación.")
        return 0
    cambios = []
    # Se consultan ambos modos antes de tocar archivos: una falla no deja una publicación parcial.
    for modo, nombre in [("", "enlaces.json"), ("prueba", "enlaces-prueba.json")]:
        mapa = validar(exportar(config["endpoint"], clave, modo), ids, modo)
        ruta = carpeta / nombre
        previo = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None
        if previo is not None and previo.get("enlaces") == mapa and previo.get("periodo") == oferta["periodo"]:
            print(f"{nombre}: sin cambios.")
            continue
        datos = {"periodo": oferta["periodo"], "cambio": ahora.isoformat().replace("+00:00", "Z"), "enlaces": mapa}
        cambios.append((ruta, json.dumps(datos, ensure_ascii=False, indent=2) + "\n"))
    for ruta, contenido in cambios:
        temporal = ruta.with_suffix(".json.tmp")
        try:
            temporal.write_text(contenido, encoding="utf-8")
            temporal.replace(ruta)
        finally:
            temporal.unlink(missing_ok=True)
        print(f"{ruta.name}: actualizado ({len(json.loads(contenido)['enlaces'])} enlaces).")
    return 0


def main():
    try:
        return publicar()
    except Exception:
        print("Error: no se pudo publicar grupos; revise configuración, secreto y endpoint.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
