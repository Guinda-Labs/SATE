"""Actualización semestral (tools/semestre.py): reconstrucción por huellas, PDF sin cambios y datos sin tocar páginas.

Todo con datos sintéticos; no abre navegadores, no entra al SAES y no usa red.
"""
import copy
import hashlib
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import semestre
import semestre_huellas as hu

NODE = shutil.which('node') or (r'D:\Tools\nodejs\node.exe' if Path(r'D:\Tools\nodejs\node.exe').exists() else None)
SAL = 'Sal\ufffdn'   # así llega la clave del SAES con la codificación rota


def fila(grupo, materia, lun='', mar='', nivel=1, carrera='B'):
    return {'carrera': carrera, 'plan': '09', 'turno': 'M', 'nivel': nivel, 'Grupo': grupo, 'Asignatura': materia,
            'Profesor': 'PROFESOR DE PRUEBA', 'Edificio': 'X', SAL: 'X', 'Lun': lun, 'Mar': mar, 'Mie': '', 'Jue': '',
            'Vie': '', 'Sab': ''}


def base_sintetica(n=8):
    return [fila(f'1BM{i}', f'MATERIA {i}', lun=f'0{7 + i % 3}:00-0{8 + i % 3}:30', nivel=1 + i % 2) for i in range(n)]


def diff_de(base, nuevas_filas, claves_base='proximo'):
    """Lo que haría el snippet: huellas de la base y de la captura -> fuera, nuevas (índice final, valores), SHA."""
    hb = [hu.huella(hu.linea(f)) for f in base]
    hn = [hu.huella(hu.linea(f)) for f in nuevas_filas]
    fuera, nuevas = hu.diferencia(hb, hn)
    return {'n': len(nuevas_filas), 'sha': hu.sha_lineas([hu.linea(f) for f in nuevas_filas]), 'base': claves_base,
            'coincide': (len(hn) - len(nuevas)) / max(len(hn), len(hb), 1), 'fuera': fuera,
            'nuevas': [[i, hu.valores(nuevas_filas[i])] for i in nuevas]}


class Reconstruccion(unittest.TestCase):
    def test_nuevas_retiradas_y_orden(self):
        base = base_sintetica()
        captura = copy.deepcopy(base)
        del captura[2]                                                   # fila retirada
        captura.insert(0, fila('9ZZ1', 'NUEVA AL INICIO', lun='07:00-08:30'))   # nueva al inicio
        captura.insert(5, fila('9ZZ2', 'NUEVA AL MEDIO', mar='10:00-11:30'))    # nueva en medio
        captura.append(fila('9ZZ3', 'NUEVA AL FINAL'))                           # nueva al final
        captura[3]['Profesor'] = 'OTRO PROFESOR'                                 # fila modificada = retirada + nueva
        lista = diff_de(base, captura)
        self.assertEqual(len(lista['nuevas']), 3 + 1)
        self.assertLess(len(json.dumps(lista)), len(json.dumps(captura)))      # viaja menos que la lista entera
        filas = hu.reconstruir(base, lista)
        self.assertEqual([hu.linea(f) for f in filas], [hu.linea(f) for f in captura])
        self.assertIsInstance(filas[0]['nivel'], int)
        self.assertEqual(list(filas[0]), list(base[0]))                        # mismas claves y orden (incluida la rota)

    def test_fila_reordenada_viaja_como_nueva_y_se_reconstruye(self):
        base = base_sintetica()
        captura = copy.deepcopy(base)
        captura[1], captura[6] = captura[6], captura[1]
        filas = hu.reconstruir(base, diff_de(base, captura))
        self.assertEqual([hu.linea(f) for f in filas], [hu.linea(f) for f in captura])

    def test_duplicados(self):
        base = base_sintetica(4) + base_sintetica(4)
        captura = copy.deepcopy(base)
        del captura[1]
        captura.append(copy.deepcopy(captura[0]))
        filas = hu.reconstruir(base, diff_de(base, captura))
        self.assertEqual([hu.linea(f) for f in filas], [hu.linea(f) for f in captura])

    def test_aleatorio(self):
        rnd = random.Random(7)
        for _ in range(40):
            base = base_sintetica(rnd.randint(0, 12))
            captura = [copy.deepcopy(f) for f in base if rnd.random() > 0.2]
            for k in range(rnd.randint(0, 4)):
                captura.insert(rnd.randint(0, len(captura)), fila(f'8XX{k}', f'ALEATORIA {rnd.random()}'))
            if rnd.random() < 0.3:
                rnd.shuffle(captura)
            filas = hu.reconstruir(base, diff_de(base, captura))
            self.assertEqual([hu.linea(f) for f in filas], [hu.linea(f) for f in captura])

    def test_sha_incorrecta_no_escribe_nada(self):
        base = base_sintetica()
        captura = copy.deepcopy(base)
        captura.append(fila('9ZZ1', 'NUEVA'))
        lista = diff_de(base, captura)
        lista['sha'] = '0' * 64
        oferta = {'capturado': 'x', 'carreras': {}, 'actual': [], 'proximo': base}
        original = copy.deepcopy(oferta)
        with self.assertRaises(hu.ErrorSemestre):
            hu.aplicar(oferta, {'version': 1, 'listas': {'proximo': lista}})
        self.assertEqual(oferta, original)
        # y una fila nueva alterada en tránsito tampoco pasa la verificación
        lista = diff_de(base, captura)
        lista['nuevas'][0][1][5] = 'ALTERADA'
        with self.assertRaises(hu.ErrorSemestre):
            hu.reconstruir(base, lista)

    def test_base_distinta_a_la_del_snippet(self):
        base = base_sintetica()
        captura = base[:-1]
        lista = diff_de(base, captura)
        with self.assertRaises(hu.ErrorSemestre):
            hu.reconstruir(base[:3], lista)   # la oferta guardada cambió desde que se generó el snippet


class Destinos(unittest.TestCase):
    def lista(self, base, coincide, n=10):
        return {'n': n, 'base': base, 'coincide': coincide}

    def test_la_oferta_conserva_su_identidad(self):
        # el SAES pasó 27/1 a «actual»: coincide con lo guardado en «proximo»
        d = hu.decidir_destinos({'actual': self.lista('proximo', 0.98), 'proximo': {'n': 0}})
        self.assertEqual(d, {'proximo': 'actual'})

    def test_dos_listas_cruzadas(self):
        d = hu.decidir_destinos({'actual': self.lista('proximo', 0.9), 'proximo': self.lista('actual', 0.2)})
        self.assertEqual(d, {'proximo': 'actual', 'actual': 'proximo'})   # la poco parecida ocupa la clave libre

    def test_periodo_nuevo_ocupa_su_clave_o_la_libre(self):
        d = hu.decidir_destinos({'actual': self.lista('actual', 0.97), 'proximo': self.lista('proximo', 0.1)})
        self.assertEqual(d, {'actual': 'actual', 'proximo': 'proximo'})

    def test_mapa_manual_manda(self):
        d = hu.decidir_destinos({'actual': self.lista('proximo', 0.98)}, {'actual': 'actual'})
        self.assertEqual(d, {'actual': 'actual'})

    def test_aplicar_a_oferta_y_sin_vaciar(self):
        base = base_sintetica()
        captura = base[:-1] + [fila('9ZZ1', 'NUEVA')]
        oferta = {'capturado': 'viejo', 'carreras': {'B': 'X'}, 'actual': base_sintetica(2), 'proximo': base}
        nueva, informe = hu.aplicar(oferta, {'version': 1, 'capturado': 'nuevo', 'carreras': {'B': 'BIO'},
                                             'listas': {'actual': diff_de(base, captura), 'proximo': {'n': 0}}})
        self.assertEqual(nueva['actual'], base_sintetica(2))        # la clave sin captura no se toca
        self.assertEqual([hu.linea(f) for f in nueva['proximo']], [hu.linea(f) for f in captura])
        self.assertEqual((nueva['capturado'], nueva['carreras']['B']), ('nuevo', 'BIO'))
        self.assertTrue(any('vacía' in l for l in informe))


@unittest.skipUnless(NODE, 'node no disponible')
class ContraparteJS(unittest.TestCase):
    def test_diferencia_y_sha_iguales_en_node_y_python(self):
        rnd = random.Random(3)
        casos = []
        for _ in range(30):
            base = base_sintetica(rnd.randint(0, 12))
            captura = [copy.deepcopy(f) for f in base if rnd.random() > 0.25]
            for k in range(rnd.randint(0, 4)):
                captura.insert(rnd.randint(0, len(captura)), fila(f'8XX{k}', f'ALEATORIA {rnd.random()}'))
            if rnd.random() < 0.3:
                rnd.shuffle(captura)
            casos.append((base, captura))
        script = (ROOT / 'tools/semestre_diff.js').read_text(encoding='utf-8') + """
const casos = JSON.parse(require('fs').readFileSync(0, 'utf8'));
(async () => {
  const salida = [];
  for (const [base, captura] of casos) {
    const hb = [], hn = [];
    for (const f of base) hb.push(await semSha(semValores(f).join('|')));
    for (const f of captura) hn.push(await semSha(semValores(f).join('|')));
    const d = semDiferencia(hb, hn);
    salida.push({fuera: d.fuera, nuevas: d.nuevas, sha: await semSha(captura.map(f => semValores(f).join('|')).join('\\n'), true), hb, hn});
  }
  console.log(JSON.stringify(salida));
})();
"""
        r = subprocess.run([NODE, '-e', script], input=json.dumps(casos), capture_output=True, text=True, encoding='utf-8', timeout=60)
        self.assertEqual(r.returncode, 0, r.stderr)
        for (base, captura), js in zip(casos, json.loads(r.stdout)):
            self.assertEqual(js['hb'], [hu.huella(hu.linea(f)) for f in base])
            fuera, nuevas = hu.diferencia(js['hb'], js['hn'])
            self.assertEqual((js['fuera'], js['nuevas']), (fuera, nuevas))
            self.assertEqual(js['sha'], hu.sha_lineas([hu.linea(f) for f in captura]))

    def test_snippet_generado_es_js_valido_y_trae_la_base(self):
        oferta = {'actual': base_sintetica(3), 'proximo': base_sintetica(5)}
        js = semestre.generar_snippet(oferta, ('optProximo',))
        self.assertNotIn('/*__SEM_', js)
        self.assertIn('["optProximo"]', js)
        self.assertIn(hu.huella(hu.linea(oferta['proximo'][4])), js)
        self.assertNotIn('PROFESOR DE PRUEBA', js)                  # solo huellas, no datos de la oferta
        with tempfile.TemporaryDirectory() as t:
            f = Path(t) / 's.js'
            f.write_text(js, encoding='utf-8')
            r = subprocess.run([NODE, '-e', "new Function(require('fs').readFileSync(process.argv[1],'utf8'))", str(f)],
                               capture_output=True, text=True, encoding='utf-8')
            self.assertEqual(r.returncode, 0, r.stderr)


PAGINA = ('<html><body><div class ="embed-container"><embed src="/adjuntos/Horarios/99-9/HORARIOS 2099-9v1.pdf" '
          'style="width:100%"/></div><p><span>Actualizados al 1 de enero del 2099, 10:00 hrs.</span></p></body></html>')


class PdfSinCambios(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.addCleanup(self.t.cleanup)
        self.dir = Path(self.t.name)
        (self.dir / 'recursos').mkdir()
        (self.dir / 'datos').mkdir()
        (self.dir / 'pagina.html').write_text(PAGINA, encoding='utf-8')
        self.descargas = []

    def abrir(self, url):
        self.descargas.append(url)
        return b'%PDF-1.4 contenido sintetico'

    def generar(self, src, per=None, fuente=None, actualizado=None):
        data = {'fuente': fuente, 'periodo': per, 'ciclo': '2099/9', 'aulas': ['A'], 'clases': [], 'actualizado': actualizado}
        dst = semestre.DATA / f"salones_{per.replace('/', '-')}.json"
        dst.write_text(json.dumps(data), encoding='utf-8')
        return dst, data

    def correr(self, *extra):
        args = semestre.argparse.Namespace(recursos=str(self.dir / 'recursos'), html=str(self.dir / 'pagina.html'), dry=False,
                                           forzar=False, archivo=None)
        for k, v in zip(extra[::2], extra[1::2]):
            setattr(args, k, v)
        with patch.object(semestre, 'DATA', self.dir / 'datos'), patch('salones.generar', self.generar):
            return semestre.cmd_pdf(args, abrir=self.abrir)

    def test_descubrir(self):
        info = semestre.descubrir(PAGINA)
        self.assertEqual((info['periodo'], info['ciclo']), ('99/9', '2099/9'))
        self.assertEqual(info['actualizado'], '1 de enero del 2099, 10:00 hrs.')
        self.assertTrue(info['url'].startswith('https://www.upiita.ipn.mx/adjuntos/Horarios/99-9/'))
        with self.assertRaises(SystemExit):
            semestre.descubrir(PAGINA.replace('/adjuntos/', 'https://otro.example.com/adjuntos/'))
        with self.assertRaises(SystemExit):
            semestre.descubrir('<html>sin pdf</html>')

    def test_segunda_corrida_no_descarga_ni_regenera(self):
        self.assertEqual(self.correr(), 0)
        self.assertEqual(len(self.descargas), 1)
        guardado = self.dir / 'recursos/2099-9/HORARIOS-2099-9v1.pdf'
        self.assertTrue(guardado.is_file())
        sal = self.dir / 'datos/salones_99-9.json'
        antes = sal.stat().st_mtime_ns
        self.assertEqual(self.correr(), 0)
        self.assertEqual(len(self.descargas), 1)                   # no volvió a bajar nada
        self.assertEqual(sal.stat().st_mtime_ns, antes)            # ni regeneró salones

    def test_cambio_de_fecha_con_mismo_pdf_no_regenera(self):
        self.correr()
        (self.dir / 'pagina.html').write_text(PAGINA.replace('1 de enero', '2 de enero'), encoding='utf-8')
        sal = self.dir / 'datos/salones_99-9.json'
        antes = sal.stat().st_mtime_ns
        self.correr()
        self.assertEqual(len(self.descargas), 2)                   # hubo que bajarlo para comparar la SHA-256
        self.assertEqual(sal.stat().st_mtime_ns, antes)
        self.assertEqual(json.loads((self.dir / 'recursos/2099-9/estado.json').read_text())['actualizado'], '2 de enero del 2099, 10:00 hrs.')

    def test_pdf_distinto_conserva_la_version_anterior(self):
        self.correr()
        (self.dir / 'pagina.html').write_text(PAGINA.replace('1 de enero', '3 de enero'), encoding='utf-8')
        self.abrir = lambda url: b'%PDF-1.4 otro contenido'
        self.correr()
        pdfs = sorted(p.name for p in (self.dir / 'recursos/2099-9').glob('*.pdf'))
        self.assertEqual(len(pdfs), 2, pdfs)

    def test_simulacro_y_recursos_dentro_del_repo(self):
        self.assertEqual(self.correr('dry', True), 0)
        self.assertEqual(self.descargas, [])
        self.assertFalse(any((self.dir / 'recursos').iterdir()))
        with self.assertRaises(SystemExit):
            semestre.dir_recursos(str(ROOT / 'recursos'))


class Revision(unittest.TestCase):
    def test_md(self):
        s = {'grupo': '1BM1', 'materia': 'CALCULO', 'profesor': 'P', 'dia': 2, 'inicio': '07:00', 'fin': '08:30'}
        cruce = {'coincidentes': 9, 'bloques_saes': 10, 'cobertura': 0.9, 'oferta_periodo': 'proximo',
                 'discrepancias': [{'saes': s, 'pdf': []}],
                 'pdf_sin_pareja': {'1BM1': [], '9XX1': [{'materia': 'Algo', 'aula': 'A1'}]}, 'esperables': {'1BM1': ['primer semestre (posible)']}}
        md = semestre.revision_md(cruce, None, {'fuente': 'https://x/y.pdf', 'actualizado': 'hoy'}, '27/1', saes_info='SAES prueba')
        self.assertIn('| 1BM1 | CALCULO | Mié 07:00–08:30 | — |', md)
        self.assertIn('9XX1', md)
        self.assertIn('No se corrió el OCR local', md)


class DatosSinPaginas(unittest.TestCase):
    def snapshot(self):
        base = ROOT / 'web'
        out = {}
        for p in sorted(base.rglob('*')):
            rel = p.relative_to(base).as_posix()
            if p.is_file() and '/datos/' not in rel and not rel.startswith(('dist/qa', 'qa-')):
                out[rel] = hashlib.sha256(p.read_bytes()).hexdigest()
        return out

    def test_solo_datos_no_toca_paginas_ni_js_ni_css(self):
        fuente = (ROOT / 'tools/build_sate.py').read_text(encoding='utf-8')
        self.assertIn('def escribir_datos', fuente)
        self.assertRegex(fuente, r'def escribir_sate\(data\):[\s\S]*?escribir_datos\(data\)')   # una sola lógica de datos
        antes = self.snapshot()
        r = subprocess.run([sys.executable, str(ROOT / 'tools/build_horarios.py'), '--solo-datos'], cwd=ROOT,
                           env=dict(os.environ, UNIDAD='upiita'), capture_output=True, text=True, encoding='utf-8', timeout=300)
        self.assertEqual(r.returncode, 0, r.stderr[-500:])
        self.assertEqual(self.snapshot(), antes)
        datos = ROOT / 'web/dist/sate/datos/upiita'
        for nombre in ('nucleo.json', 'oferta.json', 'tramites.json', 'electivas.json'):
            self.assertTrue((datos / nombre).is_file(), nombre)


if __name__ == '__main__':
    unittest.main()
