"""Segunda lectura opcional, exclusivamente con Ollama local. No se ejecuta durante el build.

Uso: python tools/salones_ocr.py [--periodo 27/1] [--todo] [--pdf ruta.pdf]
"""
import argparse
import base64
from collections import Counter
import io
import json
from pathlib import Path
import re
import urllib.error
import urllib.request

import pdfplumber
import salones

ROOT = Path(__file__).resolve().parents[1]
URL = 'http://127.0.0.1:11434/api/chat'


def lectura(texto):
    texto = texto.split('```', 1)[0].strip()
    lineas = [s.strip() for s in texto.splitlines() if s.strip()]
    for i, linea in enumerate(lineas):
        tokens = linea.split()
        grupos = [t for t in tokens if salones.GRUPO.fullmatch(t)
                  or t in ('CURSO', 'RECUPERACION', 'RECUPERACON', 'SEMINARIO')]
        if len(grupos) == 1:
            materia = ' '.join(lineas[:i] + [' '.join(t for t in tokens if t != grupos[0])]).strip()
            return texto, {'grupo': grupos[0], 'materia': materia, 'profesor': ' '.join(lineas[i + 1:])}
    return texto, None


def clasificar(ocr, pdf, saes):
    if ocr is None or not ocr['materia']:
        return 'dudoso'
    if any(salones.norm(ocr[k]) != salones.norm(pdf[k]) for k in ('grupo', 'materia', 'profesor')):
        return 'parser'
    if saes and any(salones.norm(ocr[k]) != salones.norm(s[k])
                    for s in saes for k in ('grupo', 'materia', 'profesor')):
        return 'cambio'
    return 'dudoso'


def reconocer(page, bbox, opener):
    imagen = page.crop(bbox).to_image(resolution=250).original
    png = io.BytesIO()
    imagen.save(png, format='PNG')
    payload = {'model': 'glm-ocr:latest', 'messages': [{'role': 'user', 'content': 'Text Recognition:',
               'images': [base64.b64encode(png.getvalue()).decode('ascii')]}], 'stream': False,
               'options': {'temperature': 0, 'num_predict': 80, 'repeat_penalty': 1.15}}
    req = urllib.request.Request(URL, data=json.dumps(payload).encode('utf-8'),
                                 headers={'Content-Type': 'application/json'})
    with opener.open(req, timeout=180) as response:
        return json.load(response)['message']['content']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--periodo', default='27/1')
    parser.add_argument('--todo', action='store_true')
    parser.add_argument('--pdf', type=Path)
    args = parser.parse_args()
    slug = args.periodo.replace('/', '-')
    try:
        data = json.loads((ROOT / f'data/salones_{slug}.json').read_text(encoding='utf-8'))
        cruce = json.loads((ROOT / f'tmp-horarios/cruce-{slug}.json').read_text(encoding='utf-8'))
        path = args.pdf or Path(data['fuente'])
        if not path.is_absolute():
            path = ROOT / path
        if not path.is_file():
            print('PDF local no disponible; indica su ruta con --pdf. No se descargará.')
            return 1
        targets, resultados = {}, []
        for n, disc in enumerate(cruce['discrepancias']):
            if not disc['pdf']:
                resultados.append({'discrepancia': n, 'saes': disc['saes'], 'clasificacion': 'dudoso',
                                   'motivo': 'No hay celda PDF para ese grupo, día y hora.'})
            for c in disc['pdf']:
                targets.setdefault(c['indice'], []).append(disc['saes'])
        for clases in cruce['pdf_sin_pareja'].values():
            for c in clases:
                targets.setdefault(c['indice'], [])
        if args.todo:
            for i in range(len(data['clases'])):
                targets.setdefault(i, [])
        # Ignora proxies del entorno y rechaza redirecciones para garantizar solo loopback.
        class SinRedireccion(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, req, fp, code, msg, headers, newurl):
                raise urllib.error.URLError('Ollama intentó redirigir la solicitud local')
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), SinRedireccion())
        with pdfplumber.open(path) as pdf:
            for i, saes in sorted(targets.items()):
                c = data['clases'][i]
                if not c.get('pagina') or not c.get('bbox'):
                    resultados.append({'indice': i, 'clasificacion': 'dudoso', 'motivo': 'Falta pagina/bbox.'})
                    continue
                texto, ocr = lectura(reconocer(pdf.pages[c['pagina'] - 1], c['bbox'], opener))
                resultados.append({'indice': i, 'pdf': c, 'saes': saes, 'texto': texto, 'ocr': ocr,
                                   'clasificacion': clasificar(ocr, c, saes)})
                print(f"Celda {i}, página {c['pagina']}: {resultados[-1]['clasificacion']}", flush=True)
        dst = ROOT / f'tmp-horarios/ocr-{slug}.json'
        dst.write_text(json.dumps({'periodo': args.periodo, 'modelo': 'glm-ocr:latest',
                                  'resultados': resultados}, ensure_ascii=False, indent=2), encoding='utf-8')
        print(dict(Counter(r['clasificacion'] for r in resultados)), dst.relative_to(ROOT))
        return 0
    except (urllib.error.URLError, TimeoutError, ConnectionError) as exc:
        print(f'Ollama local no responde o rechazó la solicitud ({URL}): {exc}. Revisa Ollama y glm-ocr:latest.')
    except (OSError, ValueError, KeyError) as exc:
        print(f'No se pudo completar el OCR local: {exc}')
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
