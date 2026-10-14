"""Contratos de partición de datos y build compatible, sin navegador."""
import pathlib
import functools
import http.server
import json
import re
import sys
import threading
import subprocess
import unittest
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))


class SateBuild(unittest.TestCase):
    def test_cupos(self):
        """Consulta ficticia de ocupabilidad y puente de solo lectura, sin navegador ni red."""
        resultado = subprocess.run([r'D:\Tools\nodejs\node.exe', 'tests/qa_sate_cupos.mjs'], cwd=ROOT,
                                   capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_creditos_por_escala(self):
        from build_sate import creditos_materia
        self.assertEqual(creditos_materia('B', '09', 'B101', '7.50', '3', '1.5'),
                         {'cr': 7.5, 'satca': 4.76})
        self.assertEqual(creditos_materia('C', '09', 'C101', '4.39', '27', '54'),
                         {'cr': 6.0, 'satca': 4.39, 'cr_calculado': True})
        self.assertAlmostEqual(creditos_materia('C', '09', 'C102', '4.45', '32', '49')['cr'], 113 / 18)
        self.assertEqual(creditos_materia('S', '08', 'S950', '20', '0', '20')['cr'], 20)
        self.assertEqual(creditos_materia('C', '09', 'C407', '0', '0', '480'), {'cr': 0})
        self.assertEqual(creditos_materia('B', '06', 'B107', '3', '0', '3')['cr'], 3)

    def test_diccionario_identidad_y_realces(self):
        from realce_unidades import SUPERFICIES, contraste, dominante, insignia_rgb, proponer
        def sin_duplicados(pares):
            resultado = {}
            for clave, valor in pares:
                self.assertNotIn(clave, resultado, f'Clave duplicada: {clave}')
                resultado[clave] = valor
            return resultado
        unidades = json.loads((ROOT / 'data/unidades_identidad.json').read_text(encoding='utf-8'),
                              object_pairs_hook=sin_duplicados)['unidades']
        self.assertEqual(len(unidades), 31)
        self.assertEqual(len({c['siglas'] for c in unidades.values()}), len(unidades))
        aliases = [a for c in unidades.values() for a in c.get('alias', [])]
        self.assertEqual(len(aliases), len(set(aliases)))
        self.assertFalse(set(aliases) & unidades.keys())
        for unidad, identidad in unidades.items():
            with self.subTest(unidad=unidad):
                self.assertTrue(identidad['siglas'])
                if 'sitio' in identidad:
                    self.assertRegex(identidad['sitio'], r'^https://[a-z0-9.-]+\.ipn\.mx/')
                if 'logo' not in identidad:
                    continue
                ruta = ROOT / 'web/dist/assets/logos/unidades' / (identidad['logo'] + '.webp')
                # El realce sale de la insignia (color más representativo del escudo) ajustada a AA.
                self.assertRegex(identidad.get('insignia', ''), r'^#[0-9a-f]{6}$')
                self.assertEqual(proponer(insignia_rgb(identidad)), identidad['realce'])
                for modo, fondos in SUPERFICIES.items():
                    for fondo in fondos:
                        self.assertGreaterEqual(contraste(identidad['realce'][modo], fondo), 4.5)

    def test_nombres_centralizados_y_bienvenida(self):
        import cuenta
        identidad = cuenta.identidades()
        for u in cuenta.config()['unidades']:
            self.assertEqual(u['nombre'], identidad[u['id']]['nombre'])
            self.assertEqual(u['siglas'], identidad[u['id']]['siglas'])
        self.assertEqual(identidad['encb']['nombre'], 'Escuela Nacional de Ciencias Biológicas')
        portada = (ROOT / 'web/dist/index.html').read_text(encoding='utf-8')
        sate = (ROOT / 'web/dist/sate/index.html').read_text(encoding='utf-8')
        config = json.loads(re.search(r'window.SATE_CONFIG=(.*?);</script>', sate, re.S)[1])
        for u in cuenta.config()['unidades']:
            self.assertIn(u['nombre'], portada)
            self.assertEqual(config['unidades'][u['id']]['nombre'], u['nombre'])
            self.assertEqual(config['unidades'][u['id']]['realce'], identidad[u['id']]['realce'])

    def test_unidad_generica_y_lector(self):
        resultado = subprocess.run([r'D:\Tools\nodejs\node.exe', 'tests/qa_sate_generico.mjs'], cwd=ROOT,
                                   capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_ventanilla_y_pdf(self):
        for archivo in ('qa_sate_ventanilla.mjs', 'qa_sate_pdf.mjs', 'qa_sate_electivas.mjs'):
            with self.subTest(archivo=archivo):
                resultado = subprocess.run([r'D:\Tools\nodejs\node.exe', 'tests/' + archivo], cwd=ROOT,
                                           capture_output=True, text=True, encoding='utf-8')
                self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_recortes_del_calendario(self):
        """API, filtros y clic al proceso con DOM en memoria y datos ficticios."""
        resultado = subprocess.run(
            [r'D:\Tools\nodejs\node.exe', 'tests/qa_sate_calendario.mjs'], cwd=ROOT,
            capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_mi_semana(self):
        """Rutina opcional y los tres modos reales del generador, sin red ni navegador."""
        resultado = subprocess.run(
            [r'D:\Tools\nodejs\node.exe', 'tests/qa_sate_semana.mjs'], cwd=ROOT,
            capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_primera_visita_sin_datos(self):
        """Salidas, ayuda recordada y pegado con permisos o respaldo manual."""
        resultado = subprocess.run(
            [r'D:\Tools\nodejs\node.exe', 'tests/qa_sate_primera_visita.mjs'], cwd=ROOT,
            capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_entrada_y_unidad_del_saes(self):
        """Entrada completa, prioridades y pegado del Lector con DOM en memoria."""
        resultado = subprocess.run(
            [r'D:\Tools\nodejs\node.exe', 'tests/qa_sate_entrada.mjs'], cwd=ROOT,
            capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_planeacion_un_periodo_y_anual(self):
        """Perfiles ficticios y DOM local: conserva datos, selección, carga y oferta."""
        resultado = subprocess.run(
            [r'D:\Tools\nodejs\node.exe', 'tests/qa_sate_cargas.mjs'], cwd=ROOT,
            capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_avisos_por_pestana(self):
        resultado = subprocess.run(
            [r'D:\Tools\nodejs\node.exe', 'tests/qa_sate_situacion.mjs'], cwd=ROOT,
            capture_output=True, text=True, encoding='utf-8')
        self.assertEqual(resultado.returncode, 0, resultado.stdout + resultado.stderr)

    def test_particion_conserva_campos_e_indices(self):
        from build_sate import separar_datos
        data = {'mapas': {'DEMO': {'cur': {}}}, 'periodos': {'actual': [[0, 1, 2]]},
                'asig': ['Materia ficticia'], 'prof': ['Docente ficticio'],
                'calendario': {'periodo': '27/1'}, 'equiv': {'rel': [['a', 'b']]}}
        nucleo, oferta, tramites = separar_datos(data)
        self.assertEqual(data, {**nucleo, **oferta, **tramites})
        self.assertNotIn('periodos', nucleo)
        self.assertEqual(nucleo['calendario'], tramites['calendario'])
        self.assertIs(data['periodos'], oferta['periodos'])

    def test_redireccion_no_embebe_datos_academicos(self):
        from build_sate import redireccion
        html = redireccion('upibi')
        self.assertNotIn('const DATA=', html)
        self.assertIn('location.search,location.hash', html)
        self.assertIn('sate/index.html', html)

    def test_recursos_publicados_por_http(self):
        """Resuelve las rutas como http.server --directory web, sin navegador."""
        class Servidor(http.server.SimpleHTTPRequestHandler):
            def log_message(self, formato, *args):
                pass

        handler = functools.partial(Servidor, directory=str(ROOT / 'web'))
        with http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler) as servidor:
            hilo = threading.Thread(target=servidor.serve_forever, daemon=True)
            hilo.start()
            try:
                base = f'http://127.0.0.1:{servidor.server_port}/dist/sate/'
                with urllib.request.urlopen(base + 'index.html') as respuesta:
                    html = respuesta.read().decode('utf-8')
                rutas = set(re.findall(r'(?:src|href)="([^"#]+)"', html))
                rutas = {r for r in rutas if not re.match(r'[a-z]+:', r)}
                rutas.update(('nucleo.js', 'situacion.js', 'desempeno.js', 'mapa.js',
                              'horarios.js', 'exportacion.js', 'saes-dialogo.js', 'tramites.js',
                              '../tramites/pdf-comun.js', '../tramites/pdf-dictamen.js', '../tramites/pdf-electivas.js'))
                config = json.loads(re.search(r'window.SATE_CONFIG=(.*?);</script>', html, re.S)[1])
                for unidad, cfg in config['unidades'].items():
                    rutas.update(f'datos/{unidad}/{nombre}.json' for nombre in ('nucleo', 'oferta'))
                    rutas.update('../' + cfg['logo'][tema] for tema in ('claro', 'oscuro') if 'logo' in cfg)
                for ruta in sorted(rutas):
                    with self.subTest(ruta=ruta):
                        with urllib.request.urlopen(base + ruta) as respuesta:
                            self.assertEqual(respuesta.status, 200, ruta)
            finally:
                servidor.shutdown()
                hilo.join()


if __name__ == '__main__':
    unittest.main()
