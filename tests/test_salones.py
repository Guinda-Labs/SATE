"""Extracción por celdas y cruce reproducible, sin OCR ni navegador."""
import copy
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import salones
import salones_cruce
import salones_ocr

PDF = ROOT / 'tmp-horarios/HORARIOS-2027-1v3.pdf'


class Salones(unittest.TestCase):
    @unittest.skipUnless(PDF.exists(), 'PDF local opcional no disponible')
    def test_paginas_especiales_y_cursos_sin_docente(self):
        import pdfplumber
        with pdfplumber.open(PDF) as pdf:
            for numero, nombre in ((32, 'CIM'), (72, 'Trabajo Terminal de Telemática'),
                                   (61, 'Sala de Cómputo IV'), (67, 'Sala de Cómputo X')):
                with self.subTest(pagina=numero):
                    ciclo, aula, clases = salones.parse_page(pdf.pages[numero - 1])
                    self.assertEqual(ciclo, '2027/1')
                    self.assertEqual(aula, nombre)
                    self.assertTrue(clases)
                    for c in clases:
                        self.assertTrue(c['materia'], c)
                        self.assertEqual(c['pagina'], numero)
                        x0, top, x1, bottom = c['bbox']
                        self.assertLess(x0, x1)
                        self.assertLess(top, bottom)
                        texto = pdf.pages[numero - 1].crop(c['bbox']).extract_text()
                        self.assertIn(c['grupo'], texto)
                    if numero in (61, 67):
                        cursos = [c for c in clases if c['grupo'] == 'CURSO']
                        self.assertTrue(cursos)
                        self.assertTrue(all(not c['profesor'] for c in cursos))

    def test_cruce_sintetico(self):
        c = {'grupo': '2BM1', 'dia': 0, 'inicio': '07:00', 'fin': '08:30',
             'materia': 'Matemáticas aplicadas', 'profesor': 'Docente ficticio', 'aula': 'Aula DEMO',
             'pagina': 1, 'bbox': [0, 0, 100, 50]}
        data = {'periodo': '27/1', 'fuente': 'ficticio.pdf', 'clases': [c,
                dict(c, inicio='08:30', fin='10:00'), dict(c, grupo='1SM1')]}
        rows = [{'Grupo': '2BM1', 'Asignatura': 'MATEMATICAS APLICADAS', 'Lun': '08:00-08:30'},
                {'Grupo': '2BM1', 'Asignatura': 'Química', 'Lun': '07:00-08:30'},
                {'Grupo': '2BM1', 'Asignatura': 'MATEMATICAS APLICADAS', 'Lun': '10:00-11:30'}]
        r = salones_cruce.cruzar(data, rows)
        self.assertEqual((r['coincidentes'], r['bloques_saes'], r['cobertura']), (1, 3, 1 / 3))
        self.assertEqual(len(r['discrepancias'][0]['pdf']), 1)
        self.assertEqual(r['discrepancias'][1]['pdf'], [])
        self.assertEqual(len(r['pdf_sin_pareja']['2BM1']), 1)
        self.assertIn('ISISA', r['esperables']['1SM1'])
        self.assertEqual(json.loads(json.dumps(r)), r)

    def test_celda_combinada_grupo_en_materia_y_profesor_multilinea(self):
        words = [{'text': texto, 'top': top, 'x0': x}
                 for texto, top, x in [('Materia', 12, 2), ('ficticia', 12, 20), ('2BM1', 12, 40),
                                       ('Docente', 22, 2), ('ficticio', 32, 2)]]
        clases = salones._parse_cell(words, 0, 0, 100, 10, 50, [(10, 30), (30, 50)],
                                    {0: 420, 1: 510}, 3)
        self.assertEqual(len(clases), 1)
        self.assertEqual(clases[0]['materia'], 'Materia ficticia')
        self.assertEqual(clases[0]['profesor'], 'Docente ficticio')
        self.assertEqual((clases[0]['inicio'], clases[0]['fin']), ('07:00', '10:00'))
        self.assertEqual(clases[0]['bbox'], [0, 10, 100, 50])

    def test_periodos_y_asignacion_idempotente(self):
        clase = lambda grupo: ['B', 'M', 1, grupo, 0, [0], [[0, 420, 510]], 0, 'DEMO', 'O']
        periodos = {'actual': [clase('2BM1')], 'proximo': [clase('3BM1')]}
        datos = lambda per, grupo, aula: {'periodo': per, 'clases': [{'grupo': grupo, 'aula': aula,
                   'dia': 0, 'inicio': '07:00', 'fin': '08:30', 'materia': 'Materia ficticia'}]}
        archivos = [('viejo.json', datos('26/2', '2BM1', 'DEMO 1')),
                    ('nuevo.json', datos('27/1', '3BM1', 'DEMO 2'))]
        with patch('builtins.print'):
            meta = salones.aplicar_periodos(periodos, ['Materia ficticia'], archivos)
            anterior = copy.deepcopy(periodos)
            salones.aplicar_periodos(periodos, ['Materia ficticia'], archivos[::-1])
        self.assertEqual(meta['actual']['periodo'], '26/2')
        self.assertEqual(meta['proximo']['periodo'], '27/1')
        self.assertEqual(periodos, anterior)
        self.assertEqual(periodos['proximo'][0][10], ['DEMO 2'])

    def test_ocr_sin_servicio(self):
        texto, ocr = salones_ocr.lectura('Materia ficticia\n2BM1\nDocente ficticio\n```repetición')
        self.assertNotIn('```', texto)
        self.assertEqual(salones_ocr.clasificar(ocr, ocr, [dict(ocr, materia='Otra')]), 'cambio')
        self.assertEqual(salones_ocr.clasificar(ocr, dict(ocr, grupo='3BM1'), []), 'parser')
        self.assertEqual(salones_ocr.clasificar(None, ocr, []), 'dudoso')


if __name__ == '__main__':
    unittest.main()
