"""Importa transcripciones verificadas de manuales oficiales para SATE.

Uso: python tools/importar_manuales.py [directorio manuales-pipeline]
"""
import json
import logging
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGEN = Path('D:/Documents/Development/UPIITA_DEV/coordinacion-wt/ipt-estado/ipn-tools/manuales-pipeline')
DESTINO = ROOT / 'data/manuales'
LOG = logging.getLogger('manuales')
TIPOS = {'NS': 'nivel superior', 'NMS': 'nivel medio superior',
         'ICT': 'investigación científica y tecnológica', 'VDR': 'vinculación y desarrollo regional',
         'OA': 'órgano de apoyo', 'TA': 'área central', 'UA': 'unidad administrativa',
         'GENERAL': 'estructura general'}


def texto(valor):
    return re.sub(r'\s+', ' ', valor or '').strip()


def nombre_visible(valor):
    # La transcripción oficial permanece en nombre_oficial; el selector usa una forma limpia.
    return re.sub(r'\s*\.\s*(?=\()', ' ', texto(valor)).rstrip('.').strip()


def bloque(valor):
    if not isinstance(valor, dict) or valor.get('verificado') is False or not valor.get('texto'):
        return None
    return {'t': texto(valor['texto']), 'p': valor.get('pagina')}


def areas_mo(datos):
    resultado = []
    for area in datos.get('areas', []):
        if area.get('verificado') is False or area.get('nombre_verificado') is False:
            continue
        objetivo = bloque(area.get('objetivo'))
        funciones = [b for f in area.get('funciones', []) if (b := bloque(f))]
        resultado.append({'id': area.get('id') or area.get('clave'), 'nombre': texto(area['nombre']),
                          'nivel': area.get('nivel'), 'depende_de': area.get('depende_de'),
                          'pagina': area.get('pagina') or area.get('pagina_estructura'),
                          'objetivo': objetivo, 'funciones': funciones})
    return resultado


def procedimientos_mp(datos):
    return [{'clave': p.get('codigo'), 'nombre': texto(p['nombre']),
             'objetivo': bloque(p.get('objetivo')), 'pagina': p.get('pagina'),
             'area': p.get('area') or p.get('area_responsable')}
            for p in datos.get('procedimientos', [])
            if p.get('verificado') is not False and p.get('nombre')]


def escribir(ruta, datos):
    contenido = json.dumps(datos, ensure_ascii=False, separators=(',', ':')) + '\n'
    if not ruta.exists() or ruta.read_text(encoding='utf-8') != contenido:
        ruta.write_text(contenido, encoding='utf-8')


def importar(origen=ORIGEN):
    inventario = json.loads((origen / 'inventario.json').read_text(encoding='utf-8'))
    catalogo = {}
    for item in inventario:
        if item.get('presente') and item.get('tipo') in ('MO', 'MP'):
            entrada = catalogo.setdefault(item['siglas'], {'siglas': item['siglas'], 'nombre': nombre_visible(item['unidad']),
                                                              'nombre_oficial': texto(item['unidad']),
                                                              'tipo': TIPOS[item['categoria']], 'pdf': {}})
            entrada['pdf'][item['tipo']] = item['url']
    DESTINO.mkdir(parents=True, exist_ok=True)
    indice = {'unidades': [], 'general': None, 'sate': {'upiita': 'UPIITA', 'escom': 'ESCOM', 'upibi': 'UPIBI'}}
    for siglas, info in sorted(catalogo.items()):
        carpeta = origen / 'salida-r28' / siglas
        mo = json.loads((carpeta / 'MO.json').read_text(encoding='utf-8')) if (carpeta / 'MO.json').exists() else {}
        mp = json.loads((carpeta / 'MP.json').read_text(encoding='utf-8')) if (carpeta / 'MP.json').exists() else {}
        if siglas == 'IPN':
            continue
        if not mo and not mp:
            continue
        areas = areas_mo(mo)
        ids = {a['id'] for a in areas}
        for a in areas:
            if a['depende_de'] not in ids:
                a['depende_de'] = None
        procedimientos = procedimientos_mp(mp)
        escribir(DESTINO / (siglas + '.json'), {'areas': areas, 'procedimientos': procedimientos})
        info['archivo'] = siglas + '.json'
        info['fecha'] = texto(mo.get('fecha', {}).get('texto')) if isinstance(mo.get('fecha'), dict) else None
        info['conteos'] = {'areas': len(areas), 'funciones': sum(len(a['funciones']) for a in areas),
                           'procedimientos': len(procedimientos)}
        indice['unidades'].append(info)
    mog = json.loads((origen / 'salida-r28/IPN/MOG.json').read_text(encoding='utf-8'))
    grupos = {g['id']: {'objetivo': bloque(g.get('objetivo')),
                        'funciones': [b for f in g.get('funciones', []) if (b := bloque(f))]}
              for g in mog['grupos']}
    areas = areas_mo(mog)
    originales = {a.get('id') or a.get('clave'): a for a in mog['areas']}
    for area in areas:
        original = originales[area['id']]
        if original.get('grupo') in grupos:
            area['grupo'] = original['grupo']
        area['en_estructura'] = original.get('en_estructura', True)
        if not area['en_estructura']:
            area['depende_de'] = None
    ids = {a['id'] for a in areas}
    for area in areas:
        if area['depende_de'] not in ids:
            area['depende_de'] = None
    escribir(DESTINO / 'IPN-general.json', {'areas': areas, 'grupos': grupos, 'procedimientos': []})
    general = catalogo['IPN']
    general.update({'archivo': 'IPN-general.json', 'fecha': texto(mog['metadatos']['fecha']['texto']),
                    'conteos': {'areas': len(areas), 'funciones': sum(len(a['funciones']) for a in areas)
                                + sum(len(g['funciones']) for g in grupos.values()), 'procedimientos': 0}})
    indice['general'] = general
    escribir(DESTINO / 'indice.json', indice)
    inventario_oficial = ROOT / 'data/texto_oficial.json'
    registro = json.loads(inventario_oficial.read_text(encoding='utf-8'))
    for info in [*indice['unidades'], indice['general']]:
        registro['archivos']['data/manuales/' + info['archivo']] = {
            'oficial': True,
            'fuente': {'documento': 'Manual de Organización' if info is not general else 'Manual de Organización General del IPN',
                       'url': info['pdf'].get('MO'), 'localizador': 'página física en cada objetivo, función o procedimiento'},
            'campos': ['/areas/*/nombre', '/areas/*/objetivo/t', '/areas/*/funciones/*/t',
                       '/procedimientos/*/nombre', '/procedimientos/*/objetivo/t',
                       '/grupos/*/objetivo/t', '/grupos/*/funciones/*/t']}
    contenido_registro = json.dumps(registro, ensure_ascii=False, indent=2) + '\n'
    if inventario_oficial.read_text(encoding='utf-8') != contenido_registro:
        inventario_oficial.write_text(contenido_registro, encoding='utf-8')
    archivos = list(DESTINO.glob('*.json'))
    LOG.info('%d unidades; %d archivos; %d bytes; mayor: %s (%d bytes)', len(indice['unidades']),
             len(archivos), sum(p.stat().st_size for p in archivos),
             max(archivos, key=lambda p: p.stat().st_size).name,
             max(p.stat().st_size for p in archivos))
    return indice


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
    importar(Path(sys.argv[1]) if len(sys.argv) > 1 else ORIGEN)
