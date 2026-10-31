"""Invariantes de los manuales publicados."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARPETA = ROOT / 'data/manuales'
ORIGEN = Path('D:/Documents/Development/UPIITA_DEV/coordinacion-wt/ipt-estado/ipn-tools/manuales-pipeline/salida-r28')
sys.path.insert(0, str(ROOT / 'tools'))
from importar_manuales import nombre_visible


class PruebasIndice(unittest.TestCase):
    def test_nombres_de_selector_sin_puntuacion_final(self):
        self.assertEqual(nombre_visible('Unidad Profesional Interdisciplinaria en Ingeniería y Tecnologías Avanzadas. (UPIITA)'),
                         'Unidad Profesional Interdisciplinaria en Ingeniería y Tecnologías Avanzadas (UPIITA)')
        self.assertEqual(nombre_visible('Dirección General.'), 'Dirección General')

    def test_todas_las_unidades_tienen_tipo_conocido(self):
        tipos = {'nivel superior', 'nivel medio superior', 'investigación científica y tecnológica',
                 'vinculación y desarrollo regional', 'órgano de apoyo', 'área central', 'unidad administrativa'}
        inventario = json.loads((CARPETA / 'indice.json').read_text(encoding='utf-8'))
        self.assertTrue(inventario['unidades'])
        for unidad in inventario['unidades']:
            with self.subTest(siglas=unidad['siglas']):
                self.assertIn(unidad.get('tipo'), tipos)
                self.assertTrue(unidad.get('nombre'))
                self.assertFalse(unidad['nombre'].endswith('.'))
                self.assertTrue(unidad.get('nombre_oficial'))


class ManualesTest(unittest.TestCase):
    def test_indice_y_dependencias(self):
        indice = json.loads((CARPETA / 'indice.json').read_text(encoding='utf-8'))
        self.assertEqual(len(indice['unidades']), 129)
        for entrada in [*indice['unidades'], indice['general']]:
            with self.subTest(siglas=entrada['siglas']):
                datos = json.loads((CARPETA / entrada['archivo']).read_text(encoding='utf-8'))
                ids = {a['id'] for a in datos['areas']}
                self.assertEqual(len(ids), len(datos['areas']))
                for area in datos['areas']:
                    self.assertTrue(area['nombre'])
                    self.assertTrue(area['depende_de'] is None or area['depende_de'] in ids)
                    for funcion in area['funciones']:
                        self.assertTrue(funcion['t'])
                        self.assertIsInstance(funcion['p'], int)
                for grupo in datos.get('grupos', {}).values():
                    for funcion in grupo['funciones']:
                        self.assertIsInstance(funcion['p'], int)
                fuente = ORIGEN / entrada['siglas'] / ('MOG.json' if entrada is indice['general'] else 'MO.json')
                if fuente.exists():
                    original = json.loads(fuente.read_text(encoding='utf-8'))
                    nombres = {' '.join(a['nombre'].split()) for a in original.get('areas', [])
                               if a.get('verificado') is not False and a.get('nombre_verificado') is not False}
                    self.assertTrue({a['nombre'] for a in datos['areas']} <= nombres)

    def test_referencias_conocidas(self):
        upiita = json.loads((CARPETA / 'UPIITA.json').read_text(encoding='utf-8'))
        self.assertEqual(len(upiita['areas']), 26)
        mog = json.loads((CARPETA / 'IPN-general.json').read_text(encoding='utf-8'))
        self.assertEqual(next(a for a in mog['areas'] if a['id'] == 'O3A000')['depende_de'], 'O20000')
        for area in mog['areas']:
            if area.get('grupo'):
                self.assertIn(area['grupo'], mog['grupos'])
            if area.get('en_estructura') is False:
                self.assertIsNone(area['depende_de'])


if __name__ == '__main__':
    unittest.main()
