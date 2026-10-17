"""Actualización semestral de oferta y salones (UPIITA), un comando por paso. Guía: docs/ACTUALIZACION-SEMESTRAL.md

Uso:  python tools/semestre.py <comando> [opciones]
  estado        resumen de una pantalla: ciclo del PDF, fecha, cobertura, discrepancias y qué falta
  pdf           lee la página de horarios de la UPIITA, descarga el PDF solo si cambió y genera data/salones_<per>.json
  snippet-saes  genera tmp-horarios/snippet-saes.js para pegarlo en el SAES (navegador integrado, solo lectura)
  aplicar-saes  reconstruye la oferta desde el diff que dejó el snippet (window.SEM), verifica la SHA-256 y la escribe
  cruce         cruza el PDF con la oferta, corre el OCR local si Ollama responde y escribe REVISION-SALONES-<per>.md
  datos         regenera SOLO los datos de SATE (datos/<unidad>/*.json); no toca plantillas, CSS ni JS

Cada comando es idempotente. Sin red salvo www.upiita.ipn.mx (pdf) y el Ollama local (cruce). recursos/ nunca entra al repo.
"""
import argparse
import hashlib
import html as _html
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import semestre_huellas as hu  # noqa: E402

PAGINA = 'https://www.upiita.ipn.mx/estudiantes/horariosnuevo'
HOST_PERMITIDO = 'upiita.ipn.mx'
DATA = ROOT / 'data'
OFERTA = DATA / 'horarios_upiita.json'
TMP = ROOT / 'tmp-horarios'
DIAS_ES = ('Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb')


# ---------------------------------------------------------------- rutas configurables

def dir_recursos(arg=None):
    """Carpeta de PDFs: --recursos, IPNT_RECURSOS o recursos/ipn-tools/horarios-upiita en algún ancestro. Nunca dentro del repo."""
    if arg or os.environ.get('IPNT_RECURSOS'):
        p = Path(arg or os.environ['IPNT_RECURSOS']).resolve()
    else:
        p = next((a / 'recursos/ipn-tools/horarios-upiita' for a in ROOT.parents
                  if (a / 'recursos/ipn-tools/horarios-upiita').is_dir()), None)
        if p is None:
            raise SystemExit('No encuentro recursos/ipn-tools/horarios-upiita; indica --recursos o IPNT_RECURSOS.')
    if p == ROOT or ROOT in p.parents:
        raise SystemExit('La carpeta de recursos no puede estar dentro del repositorio (recursos/ nunca se sube).')
    return p


def dir_estado(arg=None):
    """Carpeta donde se deja REVISION-SALONES-<per>.md: --salida, IPNT_ESTADO o coordinacion-wt/ipt-estado/ipn-tools."""
    if arg or os.environ.get('IPNT_ESTADO'):
        return Path(arg or os.environ['IPNT_ESTADO']).resolve()
    p = next((a / 'coordinacion-wt/ipt-estado/ipn-tools' for a in ROOT.parents
              if (a / 'coordinacion-wt/ipt-estado/ipn-tools').is_dir()), None)
    if p is None:
        raise SystemExit('No encuentro coordinacion-wt/ipt-estado/ipn-tools; indica --salida o IPNT_ESTADO.')
    return p


def _rel(p):
    p = Path(p)
    return p.relative_to(ROOT) if ROOT in p.resolve().parents else p


def leer_json(p):
    return json.loads(Path(p).read_text(encoding='utf-8'))


def escribir_json(p, d, **kw):
    Path(p).write_text(json.dumps(d, ensure_ascii=False, **kw), encoding='utf-8')


# ---------------------------------------------------------------- pdf

def descubrir(html):
    """De la página de horarios: URL del PDF incrustado, texto «Actualizados al …» y ciclo/periodo (de la URL)."""
    m = (re.search(r'<(?:embed|iframe)\b[^>]*?\bsrc\s*=\s*["\']([^"\']+?\.pdf[^"\']*)["\']', html, re.I)
         or re.search(r'<object\b[^>]*?\bdata\s*=\s*["\']([^"\']+?\.pdf[^"\']*)["\']', html, re.I))
    if not m:
        raise SystemExit('La página no trae un PDF incrustado (<embed src="….pdf">): cambió su estructura; revisa a mano.')
    url = urllib.parse.urljoin(PAGINA, _html.unescape(m.group(1)).strip())
    url = urllib.parse.quote(urllib.parse.unquote(url), safe=":/?=&%")
    host = urllib.parse.urlparse(url).hostname or ''
    if not (host == HOST_PERMITIDO or host.endswith('.' + HOST_PERMITIDO)):
        raise SystemExit(f'El PDF apunta a otro sitio ({host}); no se descarga.')
    f = re.search(r'Actualizad[oa]s?\s+al\s+([^<\r\n]{3,80})', html)
    ciclo = re.search(r'/(\d{2})-(\d)/', urllib.parse.unquote(url)) or re.search(r'(\d{4})-(\d)\D*\.pdf', urllib.parse.unquote(url), re.I)
    if not ciclo:
        raise SystemExit('No pude leer el ciclo en la URL del PDF; indica --ciclo 27/1.')
    anio = ciclo.group(1)[-2:]
    return {'url': url, 'actualizado': _html.unescape(f.group(1)).strip() if f else '', 'periodo': f'{anio}/{ciclo.group(2)}',
            'ciclo': f'20{anio}/{ciclo.group(2)}'}


def _abrir(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (IPN-tools semestre.py; lectura)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def cmd_pdf(args, abrir=_abrir):
    """Idempotente: si URL y «Actualizados al» coinciden con lo guardado y el archivo existe, no descarga nada."""
    if args.html:
        pagina = Path(args.html).read_text(encoding='utf-8', errors='replace')
    else:
        pagina = abrir(PAGINA).decode('utf-8', 'replace')
    info = descubrir(pagina)
    base = dir_recursos(args.recursos)
    carpeta = base / f"20{info['periodo'].split('/')[0]}-{info['periodo'].split('/')[1]}"
    marca = carpeta / 'estado.json'
    previo = leer_json(marca) if marca.exists() else {}
    nombre = Path(urllib.parse.unquote(urllib.parse.urlparse(info['url']).path)).name.replace(' ', '-')
    destino = carpeta / nombre
    salones = DATA / f"salones_{info['periodo'].replace('/', '-')}.json"
    print(f"PDF {info['ciclo']}: {nombre} · {info['actualizado'] or 'sin fecha en la página'}")
    mismo = (previo.get('url') == info['url'] and previo.get('actualizado') == info['actualizado']
             and (carpeta / previo.get('archivo', '')).is_file() and not args.forzar)
    if mismo and salones.exists():
        print('Sin cambios: misma URL y misma fecha; no se descargó ni se regeneró nada.')
        return 0
    if args.dry:
        print('Simulacro: ' + ('habría que descargar y regenerar.' if not mismo else 'habría que regenerar salones.'))
        return 0
    carpeta.mkdir(parents=True, exist_ok=True)
    if mismo:
        pdf_bytes = (carpeta / previo['archivo']).read_bytes()
        destino = carpeta / previo['archivo']
    else:
        pdf_bytes = Path(args.archivo).read_bytes() if args.archivo else abrir(info['url'])
        if not pdf_bytes.startswith(b'%PDF'):
            raise SystemExit('Lo descargado no es un PDF; no se guardó.')
        sha = hashlib.sha256(pdf_bytes).hexdigest()
        if previo.get('sha256') == sha and (carpeta / previo.get('archivo', '')).is_file() and not args.forzar:
            previo.update(actualizado=info['actualizado'], url=info['url'])
            escribir_json(marca, previo, indent=1)
            print('Misma SHA-256 que lo guardado (solo cambió la fecha de la página); no se regeneró nada.')
            return 0
        if destino.exists() and hashlib.sha256(destino.read_bytes()).hexdigest() != sha:
            destino = carpeta / f'{destino.stem}-{sha[:8]}.pdf'   # nunca se pisa una versión anterior
        destino.write_bytes(pdf_bytes)
        print(f'{"Tomado del archivo local" if args.archivo else "Descargado"}: {destino.name} ({len(pdf_bytes) // 1024} KB, SHA-256 {sha[:12]})')
    sha = hashlib.sha256(pdf_bytes).hexdigest()
    import salones
    dst, data = salones.generar(destino, info['periodo'], fuente=info['url'], actualizado=info['actualizado'])
    data['pdf_sha256'] = sha
    escribir_json(dst, data, indent=1)
    escribir_json(marca, {'url': info['url'], 'actualizado': info['actualizado'], 'sha256': sha, 'archivo': destino.name,
                          'ciclo': info['ciclo'], 'periodo': info['periodo']}, indent=1)
    print(f"{_rel(dst)}: {len(data['aulas'])} aulas, {len(data['clases'])} clases")
    print('Siguiente: snippet-saes -> aplicar-saes -> cruce -> datos.')
    return 0


# ---------------------------------------------------------------- snippet-saes / aplicar-saes

def _entre(texto, ini, fin):
    i, j = texto.index(ini), texto.index(fin)
    return texto[i + len(ini):j]


def generar_snippet(oferta, pers=('optActual', 'optProximo')):
    captura = (ROOT / 'tools/captura_saes.js').read_text(encoding='utf-8')
    plantilla = (ROOT / 'tools/semestre_saes.js').read_text(encoding='utf-8')
    base = {k: [hu.huella(hu.linea(f)) for f in oferta.get(k, [])] for k in hu.CLAVES}
    reemplazos = {
        '/*__SEM_BASE__*/ null': json.dumps(base, separators=(',', ':')),
        "/*__SEM_PERS__*/ ['optActual', 'optProximo']": json.dumps(list(pers)),
        '/*__SEM_DIFF__*/': (ROOT / 'tools/semestre_diff.js').read_text(encoding='utf-8'),
        '/*__SEM_CAPTURA_BASE__*/': _entre(captura, '/*__CAPTURA_BASE__*/', '/*__CAPTURA_BASE_FIN__*/'),
        '/*__SEM_CAPTURA_HORARIOS__*/': _entre(captura, '/*__CAPTURA_HORARIOS__*/', '/*__CAPTURA_HORARIOS_FIN__*/'),
    }
    for marca, texto in reemplazos.items():
        if marca not in plantilla:
            raise SystemExit(f'La plantilla del snippet perdió la marca {marca}.')
        plantilla = plantilla.replace(marca, texto)
    return plantilla


def cmd_snippet(args):
    pers = {'ambos': ('optActual', 'optProximo'), 'actual': ('optActual',), 'proximo': ('optProximo',)}[args.saes]
    js = generar_snippet(leer_json(OFERTA), pers)
    TMP.mkdir(exist_ok=True)
    dst = TMP / 'snippet-saes.js'
    dst.write_text(js, encoding='utf-8')
    print(f'{_rel(dst)} ({len(js) // 1024} KB, periodos SAES: {args.saes}).')
    print('Pégalo en el navegador integrado, en una pestaña del SAES con sesión; al terminar lee JSON.stringify(window.SEM),')
    print('guárdalo como tmp-horarios/diff.json y corre: python tools/semestre.py aplicar-saes tmp-horarios/diff.json')
    return 0


def _mapa(texto):
    """«actual:proximo,proximo:actual» -> {lista del SAES: clave guardada}."""
    if not texto:
        return None
    try:
        pares = dict(p.split(':') for p in texto.split(','))
    except ValueError:
        raise SystemExit('--mapa va como lista:destino separados por coma, p. ej. actual:proximo')
    if any(k not in hu.CLAVES or v not in hu.CLAVES for k, v in pares.items()):
        raise SystemExit('--mapa solo admite «actual» y «proximo».')
    return pares


def cmd_aplicar(args):
    diff = leer_json(args.diff)
    oferta = leer_json(OFERTA)
    try:
        nueva, informe = hu.aplicar(oferta, diff, _mapa(args.mapa))
    except hu.ErrorSemestre as e:
        print('ERROR:', e)
        return 1
    for l in informe:
        print(l)
    if args.dry:
        print('Simulacro: no se escribió nada.')
        return 0
    if nueva == oferta:
        print('Sin cambios respecto a lo guardado.')
        return 0
    escribir_json(OFERTA, nueva)
    print(f'{_rel(OFERTA)} actualizado ({nueva.get("capturado")}). Siguiente: cruce -> datos.')
    return 0


# ---------------------------------------------------------------- cruce + REVISION

def _hhmm(t):
    return t or '--:--'


def _bloques_texto(bloques):
    return ', '.join(f"{DIAS_ES[b['dia']]} {_hhmm(b['inicio'])}–{_hhmm(b['fin'])}" for b in bloques)


def _cel(s):
    return str(s).replace('|', '/').replace('\n', ' ')


def revision_md(cruce, ocr, data, periodo, pdf_info=None, saes_info=''):
    """Texto de REVISION-SALONES-<per>.md (formato del de 27/1). `ocr` puede ser None."""
    from collections import OrderedDict
    L = [f'# Salones {_per_largo(periodo)}: lo que no cuadró (para revisión del dueño)', '']
    fuente = data.get('fuente', '')
    fecha = data.get('actualizado') or (pdf_info or {}).get('actualizado', '')
    L.append(f'PDF: {fuente}' + (f' ({fecha})' if fecha else '') + f'. Oferta: {saes_info or cruce.get("fuente_saes", "")}'
             f' (clave «{cruce.get("oferta_periodo")}»).')
    L.append(f"Cuadran {cruce['coincidentes']} de {cruce['bloques_saes']} bloques del SAES ({cruce['cobertura']:.1%}); "
             'esos ya tienen salón en el sitio.')
    L.append('Lo de abajo NO se publicó con salón. Marca cada punto: «PDF» (el PDF tiene razón), «SAES» o «ignorar».')
    L.append('')
    L.append('## 1. Bloques del SAES sin celda en el PDF (quedan sin salón)')
    L.append('')
    L.append('| Grupo | Materia (SAES) | Días y hora | Lo que tiene el PDF en ese grupo/día/hora |')
    L.append('|---|---|---|---|')
    grupos = OrderedDict()
    for d in cruce['discrepancias']:
        s = d['saes']
        g = grupos.setdefault((s['grupo'], s['materia']), {'b': [], 'pdf': OrderedDict()})
        g['b'].append(s)
        for c in d['pdf']:
            g['pdf'][(c['materia'], c['aula'])] = None
    for (grupo, materia), g in grupos.items():
        pdf = '; '.join(f'{m} ({a})' for m, a in g['pdf']) or '—'
        L.append(f'| {grupo} | {_cel(materia)} | {_bloques_texto(g["b"])} | {_cel(pdf)} |')
    if not grupos:
        L.append('| — | — | — | — |')
    L.append('')
    if ocr:
        cambios = [r for r in ocr['resultados'] if r.get('clasificacion') == 'cambio']
        parser = [r for r in ocr['resultados'] if r.get('clasificacion') == 'parser']
        L.append('## 2. Celdas donde glm-ocr confirma el PDF y difiere del SAES («cambio»)')
        L.append('')
        L.append('| Aula | Grupo | Día y hora | PDF | SAES |')
        L.append('|---|---|---|---|---|')
        for r in cambios:
            c = r['pdf']
            s = r['saes'][0] if r.get('saes') else {}
            L.append(f"| {c['aula']} | {c['grupo']} | {DIAS_ES[c['dia']]} {_hhmm(c['inicio'])}–{_hhmm(c['fin'])} | "
                     f"{_cel((r.get('ocr') or {}).get('materia', ''))} | {_cel(s.get('materia', ''))} |")
        if not cambios:
            L.append('| — | — | — | — | — |')
        L += ['', '## 3. Celdas que el lector del PDF leyó mal («parser», según glm-ocr)', '',
              'Celdas con dos clases que se fusionan en una. Se corrigen en el lector; no requieren tu decisión.', '',
              '| Aula | Día y hora | Lectura del OCR |', '|---|---|---|']
        for r in parser:
            c = r['pdf']
            L.append(f"| {c['aula']} | {DIAS_ES[c['dia']]} {_hhmm(c['inicio'])}–{_hhmm(c['fin'])} | {_cel(r.get('texto', ''))[:120]} |")
        if not parser:
            L.append('| — | — | — |')
        L.append('')
    else:
        L += ['## 2–3. Segunda lectura (OCR)', '', 'No se corrió el OCR local (Ollama no respondió o se omitió con --sin-ocr).', '']
    esperables = cruce.get('esperables', {})
    resto = {g: c for g, c in cruce['pdf_sin_pareja'].items() if g not in esperables}
    L += ['## 4. Grupos del PDF que no existen en el SAES', '',
          f'Esperables y omitidos ({len(esperables)}): primer semestre (nuevo ingreso, no está en la oferta de reinscripción) e ISISA.',
          '', '| Grupo | Materias en el PDF |', '|---|---|']
    for g, cs in resto.items():
        mats = '; '.join(dict.fromkeys(c['materia'] for c in cs))
        L.append(f'| {g} | {_cel(mats)[:160]} |')
    if not resto:
        L.append('| — | — |')
    L.append('')
    return '\n'.join(L)


def _per_largo(per):
    a, b = per.split('/')
    return f'20{a}/{b}'


def ollama_responde():
    """Solo loopback, sin proxies ni redirecciones."""
    try:
        op = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        with op.open('http://127.0.0.1:11434/api/tags', timeout=3) as r:
            return r.status == 200
    except Exception:
        return False


def _pdf_local(periodo, recursos_arg):
    marca = dir_recursos(recursos_arg) / f"20{periodo.split('/')[0]}-{periodo.split('/')[1]}" / 'estado.json'
    if marca.exists():
        e = leer_json(marca)
        p = marca.parent / e.get('archivo', '')
        if p.is_file():
            return p
    return None


def cmd_cruce(args):
    args.periodo = args.periodo or periodo_vigente()
    slug = args.periodo.replace('/', '-')
    ruta = DATA / f'salones_{slug}.json'
    if not ruta.exists():
        print(f'Falta {_rel(ruta)}: corre antes «pdf».')
        return 1
    r = subprocess.run([sys.executable, str(ROOT / 'tools/salones_cruce.py'), '--periodo', args.periodo,
                        *(['--oferta-periodo', args.oferta] if args.oferta else [])], cwd=ROOT, text=True, capture_output=True)
    print(r.stdout.strip())
    if r.returncode:
        print(r.stderr.strip()[-400:])
        return 1
    ocr = None
    if args.sin_ocr:
        print('OCR omitido (--sin-ocr).')
    else:
        pdf = _pdf_local(args.periodo, args.recursos)
        if not pdf:
            print('OCR omitido: no hay PDF local (corre «pdf»).')
        elif not ollama_responde():
            print('OCR omitido: Ollama no responde en 127.0.0.1:11434; el reporte sale sin las secciones 2–3.')
        else:
            o = subprocess.run([sys.executable, str(ROOT / 'tools/salones_ocr.py'), '--periodo', args.periodo, '--pdf', str(pdf)],
                               cwd=ROOT, text=True, capture_output=True)
            print((o.stdout.strip().splitlines() or ['OCR sin salida'])[-1])
            f = TMP / f'ocr-{slug}.json'
            if o.returncode == 0 and f.exists():
                ocr = leer_json(f)
    cruce = leer_json(TMP / f'cruce-{slug}.json')
    data = leer_json(ruta)
    captura = leer_json(OFERTA).get('capturado', '')
    md = revision_md(cruce, ocr, data, args.periodo, saes_info=f'SAES capturado {_sello(captura)} UTC')
    dst = dir_estado(args.salida) / f'REVISION-SALONES-{slug}.md'
    dst.write_text(md, encoding='utf-8')
    print(f'{dst}: {len(cruce["discrepancias"])} bloques sin pareja.')
    return 0


# ---------------------------------------------------------------- datos / estado

def periodo_vigente():
    """El periodo más reciente con data/salones_<aa>-<n>.json."""
    ps = sorted(p.stem.split('_', 1)[1] for p in DATA.glob('salones_*.json'))
    if not ps:
        raise SystemExit('No hay data/salones_*.json; corre «pdf» o indica --periodo.')
    return ps[-1].replace('-', '/')


def unidades():
    base = ROOT / 'data' / 'unidades'
    return ['upiita'] + sorted(p.name for p in base.iterdir() if p.is_dir()) if base.is_dir() else ['upiita']


def cmd_datos(args):
    ok = 0
    for u in ([args.unidad] if args.unidad else unidades()):
        env = dict(os.environ, UNIDAD=u)
        r = subprocess.run([sys.executable, str(ROOT / 'tools/build_horarios.py'), '--solo-datos'], cwd=ROOT, env=env,
                           text=True, capture_output=True)
        ultimo = (r.stdout.strip().splitlines() or [''])[-1]
        print(f'{u}: ' + (ultimo if r.returncode == 0 else 'ERROR ' + (r.stderr.strip().splitlines() or ['?'])[-1]))
        ok += r.returncode == 0
    print('Datos en web/dist/sate/datos/<unidad>/ (páginas, JS y CSS intactos). Para ver qué subir: docs/ACTUALIZACION-SEMESTRAL.md')
    return 0 if ok else 1


def cmd_estado(args):
    import salones_cruce
    L = []
    marcas = sorted((dir_recursos(args.recursos)).glob('*/estado.json')) if _recursos_ok(args.recursos) else []
    for m in marcas[-1:]:
        e = leer_json(m)
        L.append(f"PDF: {e.get('ciclo')} · {e.get('archivo')} · «{e.get('actualizado') or 's/f'}» · SHA {e.get('sha256', '')[:10]}")
    if not marcas:
        L.append('PDF: sin descargar (corre «pdf»).')
    sal = sorted(DATA.glob('salones_*.json'))
    falta = [] if marcas else ['el PDF no está registrado en recursos (corre «pdf»)']
    oferta = leer_json(OFERTA)
    L.append(f"Oferta SAES: capturada {oferta.get('capturado')} · actual {len(oferta.get('actual', []))} · próximo {len(oferta.get('proximo', []))} filas")
    for p in sal[-1:]:
        d = leer_json(p)
        L.append(f"Salones: {p.name} · ciclo {d.get('ciclo')} · {len(d['aulas'])} aulas · {len(d['clases'])} clases")
        cr = {k: salones_cruce.cruzar(d, oferta[k]) for k in hu.CLAVES if oferta.get(k)}
        mejor = max(cr, key=lambda k: cr[k]['cobertura'])
        c = cr[mejor]
        L.append(f"Cruce: clave «{mejor}» {c['coincidentes']}/{c['bloques_saes']} bloques ({c['cobertura']:.1%}) · "
                 f"SAES sin pareja {len(c['discrepancias'])} · PDF sin pareja {sum(map(len, c['pdf_sin_pareja'].values()))} "
                 f"(esperables {len(c['esperables'])} grupos)")
        if c['cobertura'] < 0.7:
            falta.append('la cobertura es < 70 %: el sitio NO asigna salones (¿PDF u oferta de otro periodo?)')
        if marcas and leer_json(marcas[-1]).get('sha256') != d.get('pdf_sha256'):
            falta.append('el PDF guardado no es el que generó salones_*.json (corre «pdf --forzar»)')
        slug = d['periodo'].replace('/', '-')
        try:
            rev = dir_estado(args.salida) / f'REVISION-SALONES-{slug}.md'
        except SystemExit:
            rev = None
        if not rev or not rev.exists():
            falta.append('no hay REVISION-SALONES (corre «cruce»)')
        elif _sello(oferta.get('capturado', '')) not in rev.read_text(encoding='utf-8'):
            falta.append('REVISION-SALONES es anterior a la última captura del SAES (corre «cruce»)')
    if not sal:
        falta.append('no hay data/salones_*.json (corre «pdf»)')
    L.append('Falta: ' + ('; '.join(falta) if falta else 'nada; solo «datos», compilar y publicar con aviso al dueño.'))
    print('\n'.join(L))
    return 0


def _sello(iso):
    """'2026-10-17T03:09:06.318Z' -> '2026-10-17 03:09' (como se anota en REVISION-SALONES)."""
    return iso[:16].replace('T', ' ')


def _recursos_ok(arg):
    try:
        dir_recursos(arg)
        return True
    except SystemExit:
        return False


# ---------------------------------------------------------------- CLI

def main(argv=None):
    for flujo in (sys.stdout, sys.stderr):
        flujo.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest='cmd', required=True)
    comunes = argparse.ArgumentParser(add_help=False)
    comunes.add_argument('--recursos', help='carpeta de PDFs (por omisión recursos/ipn-tools/horarios-upiita o IPNT_RECURSOS)')
    comunes.add_argument('--salida', help='carpeta del REVISION-SALONES (por omisión coordinacion-wt/ipt-estado/ipn-tools o IPNT_ESTADO)')
    p = sub.add_parser('estado', parents=[comunes], help=cmd_estado.__doc__ or 'resumen')
    p.set_defaults(f=cmd_estado)
    p = sub.add_parser('pdf', parents=[comunes], help='descarga el PDF solo si cambió y genera salones')
    p.add_argument('--dry', action='store_true', help='solo informa; no descarga ni escribe')
    p.add_argument('--forzar', action='store_true', help='descarga y regenera aunque no haya cambios')
    p.add_argument('--html', help='leer la página desde un archivo local (pruebas)')
    p.add_argument('--archivo', help='usar este PDF ya descargado en vez de bajarlo (se registra igual)')
    p.set_defaults(f=cmd_pdf)
    p = sub.add_parser('snippet-saes', parents=[comunes], help='genera el JS para pegar en el SAES')
    p.add_argument('--saes', choices=('ambos', 'actual', 'proximo'), default='ambos', help='qué periodo(s) del SAES capturar')
    p.set_defaults(f=cmd_snippet)
    p = sub.add_parser('aplicar-saes', parents=[comunes], help='reconstruye la oferta desde el diff')
    p.add_argument('diff')
    p.add_argument('--mapa', help='lista:destino, p. ej. actual:proximo (manda sobre la regla automática)')
    p.add_argument('--dry', action='store_true')
    p.set_defaults(f=cmd_aplicar)
    p = sub.add_parser('cruce', parents=[comunes], help='cruce, OCR opcional y REVISION-SALONES')
    p.add_argument('--periodo', help='p. ej. 27/1 (por omisión el más reciente de data/salones_*.json)')
    p.add_argument('--oferta', choices=('actual', 'proximo'), help='clave de la oferta (por omisión se infiere)')
    p.add_argument('--sin-ocr', action='store_true')
    p.set_defaults(f=cmd_cruce)
    p = sub.add_parser('datos', parents=[comunes], help='regenera solo los datos de SATE')
    p.add_argument('--unidad', help='una sola unidad (por omisión todas)')
    p.set_defaults(f=cmd_datos)
    args = ap.parse_args(argv)
    return args.f(args)


if __name__ == '__main__':
    raise SystemExit(main())
