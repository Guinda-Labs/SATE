"""SAES local de solo lectura. Nunca conecta con servicios externos."""
import argparse
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import logging
import mimetypes
import re
import secrets
from urllib.parse import parse_qs, urlsplit

from saes_estructuras import FIXTURES, ROOT, RUTAS

LOG = logging.getLogger('saes.simulado')
P = 'ctl00$mainCopy$'
OCUPABILIDAD = '/academica/ocupabilidad_grupos.aspx'


class Simulado(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        # No registrar cabeceras, cookies ni cuerpos: basta ruta, estado y selección ficticia.
        LOG.info('%s %s', self.command, fmt % args)

    def responder(self, status, body='', tipo='text/html; charset=utf-8', headers=None):
        data = body.encode('utf-8') if isinstance(body, str) else body
        self.send_response(status)
        self.send_header('Content-Type', tipo)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; form-action 'self'; base-uri 'self'")
        self.send_header('Referrer-Policy', 'no-referrer')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def sesion(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get('Cookie', ''))
        except Exception:
            pass
        token = cookies['saes_sim'].value if 'saes_sim' in cookies else ''
        if token not in self.server.sesiones:
            token = secrets.token_hex(16)
            self.server.sesiones[token] = {'modo': self.server.modo, 'etapa': 'GET', 'carrera': '', 'plan': ''}
        return token, self.server.sesiones[token]

    def do_GET(self):
        self.procesar({})

    def do_POST(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return self.responder(400, 'Longitud inválida')
        if not 0 <= length <= 32768:
            return self.responder(413, 'Solicitud demasiado grande')
        if self.headers.get_content_type() != 'application/x-www-form-urlencoded':
            return self.responder(415, 'Solo formularios locales')
        self.procesar({k: v[-1] for k, v in parse_qs(self.rfile.read(length).decode('utf-8'), keep_blank_values=True).items()})

    def procesar(self, campos):
        host = self.headers.get('Host', '').split(':')[0]
        if host not in {'127.0.0.1', 'localhost', 'saes-upiita.localhost'}:
            return self.responder(403, 'Host local requerido')
        ruta = urlsplit(self.path).path
        if ruta.startswith('/dist/') or ruta == '/qa-saes-simulado.html':
            if self.command != 'GET':
                return self.responder(405)
            archivo = (ROOT / 'web' / ruta.lstrip('/')).resolve()
            if not archivo.is_relative_to(ROOT / 'web') or not archivo.is_file():
                return self.responder(404, 'Compila primero con SATE_QA=1')
            return self.responder(200, archivo.read_bytes(), (mimetypes.guess_type(archivo)[0] or 'application/octet-stream') + '; charset=utf-8')
        token, sesion = self.sesion()
        headers = {'Set-Cookie': f'saes_sim={token}; HttpOnly; SameSite=Strict; Path=/'}
        if ruta.startswith('/__simulado/'):
            modo = ruta.rsplit('/', 1)[-1]
            if modo not in {'normal', 'columnas', 'vencida'}:
                return self.responder(404)
            sesion.update(modo=modo, etapa='GET', carrera='', plan='')
            return self.responder(303, headers={**headers, 'Location': '/Alumnos/default.aspx'})
        if ruta.lower() == '/default.aspx':
            return self.responder(200, '<h1>Sesión simulada vencida</h1><input type="password" disabled><p>No introduzcas contraseñas.</p><a href="/__simulado/normal">Restablecer sesión ficticia</a>', headers=headers)
        if sesion['modo'] == 'vencida':
            return self.responder(302, headers={**headers, 'Location': '/default.aspx'})
        rutas = {r.lower(): n + '.html' for n, r in RUTAS.items()}
        nombre = rutas.get(ruta.lower())
        if ruta == '/':
            return self.responder(303, headers={**headers, 'Location': '/qa-saes-simulado.html'})
        if ruta.lower() == OCUPABILIDAD:
            nombre = 'ocupabilidad_get.html'
            if self.command == 'GET':
                sesion.update(etapa='GET', carrera='', plan='')
            else:
                target = campos.get('__EVENTTARGET', '')
                if campos.get('__VIEWSTATE') != 'FICTICIO':
                    return self.responder(400, 'ViewState ficticio requerido', headers=headers)
                if target == P + 'rblEsquema$0' and campos.get(P + 'rblEsquema') == '1':
                    sesion.update(etapa='periodo', carrera='B', plan='09')
                    nombre = 'ocupabilidad_periodo_actual.html'
                elif target in {P + 'dpdcarrera', P + 'dpdplan'} and sesion['etapa'] != 'GET':
                    carrera = campos.get(P + 'dpdcarrera', '')
                    planes = {'B': ['09', '98'], 'E': ['18'], 'M': ['09', '98'], 'S': ['08'], 'T': ['09', '98']}
                    if carrera not in planes:
                        return self.responder(400, 'Carrera no capturada', headers=headers)
                    if target == P + 'dpdplan' and carrera != sesion['carrera']:
                        return self.responder(409, 'Selecciona primero la carrera', headers=headers)
                    plan = planes[carrera][0] if target == P + 'dpdcarrera' else campos.get(P + 'dpdplan', '')
                    if plan not in planes[carrera]:
                        return self.responder(400, 'Plan no capturado', headers=headers)
                    sesion.update(etapa='carrera' if target.endswith('dpdcarrera') else 'plan', carrera=carrera, plan=plan)
                    nombre = f'ocupabilidad_carrera_{carrera}_plan_{plan}.html'
                else:
                    return self.responder(409, 'Secuencia requerida: periodo → carrera → plan', headers=headers)
                LOG.info('ocupabilidad etapa=%s carrera=%s plan=%s modo=%s', sesion['etapa'], sesion['carrera'], sesion['plan'], sesion['modo'])
        elif self.command == 'POST':
            return self.responder(405, 'No hay captura POST para esta página', headers=headers)
        if not nombre:
            return self.responder(404, 'Ruta no capturada', headers=headers)
        html = (FIXTURES / nombre).read_text(encoding='utf-8')
        # Las capturas permanecen intactas en disco. Quitar recursos y acciones evita salir del entorno local.
        html = re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.I | re.S)
        html = re.sub(r'\s(?:onclick|onchange)="[^"]*"', '', html, flags=re.I)
        html = re.sub(r'(href|src)="(?:https?:)?//[^"]*"', r'\1="#"', html, flags=re.I)
        html = re.sub(r'href="javascript:[^"]*"', 'href="#"', html, flags=re.I)
        if sesion['modo'] == 'columnas' and ruta.lower() == OCUPABILIDAD:
            html = html.replace('Nombre de la Materia', 'Columna simulada').replace('Nombre de la materia', 'Columna simulada')
        return self.responder(200, html, headers=headers)


def crear_servidor(puerto=8765, modo='normal'):
    servidor = ThreadingHTTPServer(('127.0.0.1', puerto), Simulado)
    servidor.sesiones = {}
    servidor.modo = modo
    return servidor


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--puerto', type=int, default=8765)
    parser.add_argument('--modo', choices=['normal', 'columnas', 'vencida'], default='normal')
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    with crear_servidor(args.puerto, args.modo) as servidor:
        LOG.info('SAES ficticio: http://saes-upiita.localhost:%s/qa-saes-simulado.html modo=%s', servidor.server_port, args.modo)
        try:
            servidor.serve_forever()
        except KeyboardInterrupt:
            LOG.info('Servidor detenido')


if __name__ == '__main__':
    main()
