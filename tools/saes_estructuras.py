"""Contrato de capturas anónimas; ejecuta los parsers de producción con Node, sin navegador."""
import argparse
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / 'tests/fixtures/saes/upiita/2026-10-14'
RUTAS = {
    'alumnos_default': '/Alumnos/default.aspx',
    'kardex': '/Alumnos/boleta/kardex.aspx',
    'estado_alumno': '/Alumnos/boleta/Estado_Alumno.aspx',
    'horario_alumno': '/Alumnos/Informacion_semestral/Horario_Alumno.aspx',
    'calificaciones_sem': '/Alumnos/Informacion_semestral/calificaciones_sem.aspx',
    'fichas_reinscripcion': '/Alumnos/Reinscripciones/fichas_reinscripcion.aspx',
    'respuesta_dictamen': '/Alumnos/Dictamenes/respuesta_dictamen.aspx',
    'agenda_escolar': '/Academica/agenda_escolar.aspx',
    'mapa_curricular': '/Academica/mapa_curricular.aspx',
    'horarios_oferta': '/Academica/horarios.aspx',
}


class Arbol(HTMLParser):
    """Solo etiquetas, atributos y texto. No ejecuta scripts ni carga recursos."""
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = {'tag': 'document', 'attrs': {}, 'nodes': []}
        self.stack = [self.root]
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        node = {'tag': tag, 'attrs': dict(attrs), 'nodes': []}
        self.stack[-1]['nodes'].append(node)
        if tag not in self.VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i]['tag'] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1]['nodes'].append(data)


def indice():
    out = []
    prefijo = 'ctl00$mainCopy$'
    for f in sorted(FIXTURES.glob('*.html')):
        campos = {}
        metodo = 'GET'
        ruta = RUTAS.get(f.stem, '/Academica/Ocupabilidad_grupos.aspx')
        if f.stem.startswith('ocupabilidad_') and f.stem != 'ocupabilidad_get':
            metodo = 'POST'
            campos = {'__EVENTTARGET': prefijo + 'rblEsquema$0', prefijo + 'rblEsquema': '1'}
            if '_carrera_' in f.stem:
                _, seleccion = f.stem.split('_carrera_')
                carrera, plan = seleccion.split('_plan_')
                campos.update({'__EVENTTARGET': prefijo + 'dpdplan', prefijo + 'dpdcarrera': carrera, prefijo + 'dpdplan': plan})
        procedencia = ('Directorio funcional inferido y action del formulario; falta manifiesto de URL absoluta original'
                       if f.stem in {'calificaciones_sem', 'respuesta_dictamen'} else 'Ruta de solicitud del marcador o navegación capturada')
        secuencia = []
        if metodo == 'POST':
            secuencia = [prefijo + 'rblEsquema$0']
            if '_carrera_' in f.stem:
                secuencia += [prefijo + 'dpdcarrera', prefijo + 'dpdplan']
        out.append({'archivo': f.name, 'ruta': ruta, 'metodo': metodo, 'campos': campos,
                    'secuencia': secuencia, 'procedencia_ruta': procedencia,
                    'captura': '2026-10-14', 'nota': 'Estado final capturado; ViewState y validación ficticios. No reproduce tokens del servidor.'})
    return out


def generar():
    import saes
    payload = {'documentos': {f.name: Arbol(f.read_text(encoding='utf-8')).root for f in sorted(FIXTURES.glob('*.html'))},
               'rutas': {ruta.lower(): nombre + '.html' for nombre, ruta in RUTAS.items()},
               'lector': saes.lector_js(''), 'indice': indice()}
    node = os.environ.get('NODE', r'D:\Tools\nodejs\node.exe' if sys.platform == 'win32' else 'node')
    result = subprocess.run([node, str(ROOT / 'tests/saes_parsers.mjs')], input=json.dumps(payload),
                            text=True, encoding='utf-8', capture_output=True, cwd=ROOT, check=True)
    return json.loads(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--actualizar', action='store_true', help='Actualiza explícitamente las estructuras y el índice revisables')
    args = parser.parse_args()
    actual = generar()
    if args.actualizar:
        for nombre, datos in [('estructuras.json', actual), ('INDICE.json', indice())]:
            (FIXTURES / nombre).write_text(json.dumps(datos, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print('Índice y estructuras actualizados con los parsers vigentes.')
    else:
        esperado = json.loads((FIXTURES / 'estructuras.json').read_text(encoding='utf-8'))
        if actual != esperado:
            raise SystemExit('Contrato SAES cambió. Revisa el parser y ejecuta --actualizar solo si el cambio es intencional.')
        print('Contrato SAES sin cambios.')


if __name__ == '__main__':
    main()
