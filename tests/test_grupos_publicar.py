import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import parse_qs, urlsplit

import pytest


RUTA = Path(__file__).resolve().parents[1] / "tools/grupos_sitio/.github/grupos/publicar.py"
SPEC = importlib.util.spec_from_file_location("grupos_publicar", RUTA)
p = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(p)
ID = "1BM3|MATERIA FICTICIA"
URL = "https://chat.whatsapp.com/" + "A" * 22
FECHA = "2026-10-17T12:00:00Z"
HORARIO = [
    {"hasta": "2026-10-20T06:00:00Z", "cada_min": 5},
    {"hasta": "2026-10-27T06:00:00Z", "cada_min": 60},
    {"hasta": None, "cada_min": 1440, "hora_utc": 12},
]


@pytest.fixture
def tmp_path():
    # El entorno restringe los temporales globales; los ficticios viven en el checkout.
    with TemporaryDirectory(prefix=".grupos-test-", dir=Path(__file__).resolve().parents[1]) as carpeta:
        yield Path(carpeta)


def entrada(url=URL):
    return {"url": url, "desde": FECHA, "reemplazo": None}


@pytest.mark.parametrize("instante,esperado", [
    ("2026-10-19T23:59:00Z", True),
    ("2026-10-20T06:00:00Z", True),
    ("2026-10-20T06:09:59Z", True),
    ("2026-10-20T06:10:00Z", False),
    ("2026-10-27T06:00:00Z", False),
    ("2026-10-27T12:00:00Z", True),
    ("2026-10-27T12:09:59Z", True),
    ("2026-10-27T12:10:00Z", False),
    ("2026-10-28T13:00:00Z", False),
])
def test_compuerta(instante, esperado):
    assert p.toca(HORARIO, p.fecha(instante), "schedule") is esperado
    assert p.toca(HORARIO, p.fecha(instante), "workflow_dispatch") is True


@pytest.mark.parametrize("url", [URL, URL + "?mode=ac_t#otro", " \n" + URL + " ",
                                  URL.replace("com/", "com/invite/")])
def test_normalizacion(url):
    assert p.normalizar_url(url) == url.strip().split("?")[0]


@pytest.mark.parametrize("url", [URL.replace("https", "http"), URL + "/", URL + "A" * 5,
                                  URL.replace("chat.whatsapp.com", "chat.whatsapp.com.ejemplo"),
                                  URL[:-5], URL.replace("A", "_"), None])
def test_url_invalida(url):
    with pytest.raises(ValueError):
        p.normalizar_url(url)


def test_validacion(capsys):
    mapa = {ID: entrada(URL + "?x=1"), "ajeno": entrada(), "mala": entrada("https://ejemplo.org")}
    assert p.validar(mapa, {ID, "mala"}, "") == {ID: entrada()}
    assert capsys.readouterr().out.count("descartada") == 2
    for desde in ["ayer", "2026-02-30T00:00:00Z", "2026-10-17", "2026-10-17T12:00:00-06:00"]:
        assert p.validar({ID: {**entrada(), "desde": desde}}, {ID}, "") == {}
    assert p.validar({ID: {**entrada(), "reemplazo": {"motivo": "spam", "fecha": FECHA}}}, {ID}, "") == {}
    reemplazo = {"motivo": "lleno", "fecha": FECHA}
    assert p.validar({ID: {**entrada(), "reemplazo": reemplazo}}, {ID}, "")[ID]["reemplazo"] == reemplazo


@pytest.fixture
def sitio(tmp_path, monkeypatch):
    carpeta = tmp_path / "sate/grupos"
    carpeta.mkdir(parents=True)
    (carpeta / "config.json").write_text(json.dumps({"endpoint": "https://ejemplo.test/exec", "horario": HORARIO}), encoding="utf-8")
    (carpeta / "oferta.json").write_text(json.dumps({"periodo": "2027/1", "casillas": [{"id": ID}]}), encoding="utf-8")
    monkeypatch.setenv("GRUPOS_CLAVE", "secreto-ficticio")
    return tmp_path, carpeta


def simular(monkeypatch, respuestas):
    peticiones = []

    class Respuesta:
        def __init__(self, datos):
            self.datos = datos

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def read(self):
            return json.dumps(self.datos).encode("utf-8")

    def abrir(url, timeout):
        query = parse_qs(urlsplit(url).query, keep_blank_values=True)
        peticiones.append(query)
        datos = respuestas[query["modo"][0]]
        if isinstance(datos, Exception):
            raise datos
        return Respuesta(datos)

    monkeypatch.setattr(p, "urlopen", abrir)
    return peticiones


def test_sin_cambios_sin_escritura(sitio, monkeypatch):
    raiz, carpeta = sitio
    llamadas = simular(monkeypatch, {"": {ID: entrada(URL + "?x=1")}, "prueba": {}})
    ahora = datetime(2026, 10, 17, 12, tzinfo=timezone.utc)
    p.publicar(raiz, ahora, "workflow_dispatch")
    rutas = [carpeta / n for n in ["enlaces.json", "enlaces-prueba.json"]]
    previos = [(r.read_bytes(), r.stat().st_mtime_ns) for r in rutas]

    def prohibido(*args, **kwargs):
        pytest.fail("No debe escribir si no cambió el mapa")

    monkeypatch.setattr(Path, "write_text", prohibido)
    p.publicar(raiz, p.fecha("2026-10-18T12:00:00Z"), "workflow_dispatch")
    assert [(r.read_bytes(), r.stat().st_mtime_ns) for r in rutas] == previos
    assert llamadas[0]["clave"] == ["secreto-ficticio"]
    assert llamadas[0]["accion"] == ["exportar"]
    assert [c["modo"][0] for c in llamadas] == ["", "prueba", "", "prueba"]


def test_falla_segundo_endpoint_no_toca_archivos(sitio, monkeypatch, capsys):
    raiz, carpeta = sitio
    ruta = carpeta / "enlaces.json"
    ruta.write_text('{"periodo":"2027/1","cambio":"antes","enlaces":{}}', encoding="utf-8")
    antes = ruta.read_bytes()
    simular(monkeypatch, {"": {ID: entrada()}, "prueba": OSError("https://exec?clave=secreto-ficticio")})
    with pytest.raises(ValueError, match="modo prueba") as exc:
        p.publicar(raiz, p.fecha(FECHA), "workflow_dispatch")
    assert "secreto-ficticio" not in str(exc.value)
    assert "secreto-ficticio" not in capsys.readouterr().out
    assert ruta.read_bytes() == antes
    assert not (carpeta / "enlaces-prueba.json").exists()


def test_salta_sin_red(sitio, monkeypatch):
    raiz, _ = sitio
    monkeypatch.setattr(p, "urlopen", lambda *a, **k: pytest.fail("No debe acceder a red"))
    assert p.publicar(raiz, p.fecha("2026-10-28T13:00:00Z"), "schedule") == 0


def test_faltan_archivos(tmp_path):
    assert p.publicar(tmp_path) == 0
