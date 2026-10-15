"""SIM1: privacidad, contrato y HTTP exclusivamente en loopback; sin navegador."""
import http.client
import json
from pathlib import Path
import re
import sys
import threading
import unittest
from urllib.parse import urlencode

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from saes_estructuras import Arbol, FIXTURES, generar, indice
from saes_simulado import crear_servidor, P


class Capturas(unittest.TestCase):
    def test_anonimato(self):
        for f in sorted(FIXTURES.glob('*.html')):
            with self.subTest(archivo=f.name):
                text = f.read_text(encoding='utf-8')
                self.assertFalse(set(re.findall(r'(?<!\d)\d{10}(?!\d)', text)) - {'2099000001'})
                self.assertNotRegex(text, re.compile(r'[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]\d', re.I))
                self.assertNotRegex(text, re.compile(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}', re.I))
                self.assertNotRegex(text, r'<script\b')
                self.assertNotRegex(text, r'name="__(?:VIEWSTATE|EVENTVALIDATION)"[^>]*value="(?!FICTICIO")')

    def test_contrato(self):
        actual = generar()
        self.assertEqual(actual, json.loads((FIXTURES / 'estructuras.json').read_text(encoding='utf-8')))
        self.assertEqual(indice(), json.loads((FIXTURES / 'INDICE.json').read_text(encoding='utf-8')))
        self.assertEqual(actual['lector']['boleta'], '2099000001')
        self.assertTrue(actual['lector']['acreditadas'])
        self.assertEqual(actual['lector']['horario_inscrito'], [])  # Captura sin inscripción vigente.
        self.assertTrue(actual['lector']['agenda'])
        for seleccion, datos in actual['consultas'].items():
            if seleccion.endswith('/98'):
                self.assertEqual(datos['error'], 'columnas')  # SAES responde una sola celda colspan=7, sin encabezados.
            else:
                self.assertTrue(datos['filas'])


class Servidor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = crear_servidor(0)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def setUp(self):
        self.cookie = ''

    def pedir(self, ruta, campos=None, cookie=True, host=None):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        headers = {'Cookie': self.cookie} if cookie else {}
        if host:
            headers['Host'] = host
        if campos is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded'
        conn.request('POST' if campos is not None else 'GET', ruta, urlencode(campos) if campos is not None else None, headers)
        response = conn.getresponse()
        status, h, body = response.status, dict(response.getheaders()), response.read().decode('utf-8')
        if h.get('Set-Cookie'):
            self.cookie = h['Set-Cookie'].split(';')[0]
        conn.close()
        return status, h, body

    def post(self, target, **campos):
        return self.pedir('/Academica/Ocupabilidad_grupos.aspx', {'__VIEWSTATE': 'FICTICIO', '__EVENTTARGET': P + target, P + 'rblEsquema': '1', **campos})

    def test_rutas_y_aislamiento(self):
        self.assertEqual(self.server.server_address[0], '127.0.0.1')
        for ruta in {e['ruta'] for e in indice()}:
            status, headers, body = self.pedir(ruta)
            self.assertEqual(status, 200, ruta)
            self.assertIn('HttpOnly; SameSite=Strict', headers['Set-Cookie'])
            self.assertNotRegex(body, r'(?:href|src)="https?://')
            self.assertIn("connect-src 'self'", headers['Content-Security-Policy'])
        self.assertEqual(self.pedir('/no-existe')[0], 404)
        self.assertEqual(self.pedir('/dist/../../AGENTS.md')[0], 404)
        self.assertEqual(self.pedir('/', host='externo.invalid')[0], 403)
        self.assertEqual(self.pedir('/Academica/horarios.aspx', {})[0], 405)

    def test_secuencia_todas_las_carreras(self):
        self.assertEqual(self.post('dpdplan')[0], 409)
        for c, planes in {'B': ['09', '98'], 'E': ['18'], 'M': ['09', '98'], 'S': ['08'], 'T': ['09', '98']}.items():
            self.pedir('/Academica/Ocupabilidad_grupos.aspx')
            self.assertEqual(self.post('rblEsquema$0')[0], 200)
            self.assertEqual(self.post('dpdcarrera', **{P + 'dpdcarrera': c})[0], 200)
            for p in planes:
                status, _, body = self.post('dpdplan', **{P + 'dpdcarrera': c, P + 'dpdplan': p})
                self.assertEqual(status, 200)
                self.assertEqual(Arbol(body).root['tag'], 'document')
                self.assertIn(f'value="{p}"', body)
                if p != '98':
                    self.assertIn('ctl00_mainCopy_GrvOcupabilidad', body)
        self.assertEqual(self.post('dpdplan', **{P + 'dpdcarrera': 'T', P + 'dpdplan': 'inexistente'})[0], 400)

    def test_modos_y_sesion(self):
        self.pedir('/__simulado/vencida')
        status, headers, _ = self.pedir('/Alumnos/boleta/kardex.aspx')
        self.assertEqual(status, 302)
        self.assertEqual(headers['Location'], '/default.aspx')
        self.assertIn('type="password"', self.pedir('/default.aspx')[2])
        # Otra sesión no hereda la caducidad.
        self.assertEqual(self.pedir('/Alumnos/default.aspx', cookie=False)[0], 200)
        self.pedir('/__simulado/columnas')
        self.post('rblEsquema$0')
        body = self.post('dpdcarrera', **{P + 'dpdcarrera': 'B'})[2]
        self.assertIn('Columna simulada', body)
        self.pedir('/__simulado/normal')
        self.assertEqual(self.pedir('/Alumnos/default.aspx')[0], 200)


if __name__ == '__main__':
    unittest.main()
