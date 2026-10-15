"""Pruebas de tools/contenido.py (validador de textos TOML y data/sate.json)."""
import json, pathlib, re, sys, tempfile, unittest
from unittest.mock import patch

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))
import contenido  # noqa: E402
import encuesta  # noqa: E402


def validar_texto(toml, extra=None):
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        (d / "es.toml").write_text('version = "2026.10.1"\n' + toml, encoding="utf-8")
        for nombre, t in (extra or {}).items():
            (d / nombre).write_text('version = "2026.10.1"\n' + t, encoding="utf-8")
        return contenido.validar(d, sate=None)


class TestContenido(unittest.TestCase):
    def test_nombres_visibles_compilados(self):
        dist = pathlib.Path(__file__).resolve().parent.parent / 'web' / 'dist'
        archivos = sorted(p for p in dist.rglob('*') if p.suffix in ('.html', '.js'))
        self.assertTrue(archivos, 'Compila las tres unidades antes de revisar los textos visibles')
        for path in archivos:
            with self.subTest(archivo=str(path.relative_to(dist))):
                texto = re.sub(r'<!--[\s\S]*?-->', '', path.read_text(encoding='utf-8'))
                texto = re.sub(r'/\*[\s\S]*?\*/', '', texto)
                texto = re.sub(r'(?m)^\s*//[^\n]*|(?<=\s)//[^\n]*', '', texto)
                # Compatibilidad: repositorios, rutas, archivos y metadato del perfil ipnt 1.
                texto = re.sub(r'''https?://[^\s<>"']+|\bipn-tools-(?:icono|og|respaldo)[^\s<>"']*|app:\s*'IPN-tools' ''', '', texto, flags=re.X)
                antiguos = re.findall(r'(?i).{0,60}(?:IPN[- ]tools|\bel lector\b).{0,60}', texto)
                self.assertEqual(antiguos, [], 'Textos visibles antiguos: ' + repr(antiguos))

    def test_mismo_marcador_en_ambas_instrucciones(self):
        import saes
        textos = contenido.objeto_t()
        clave = 'sate.lector.mismo_marcador'
        self.assertEqual(textos[clave], 'Es el mismo marcador SATE que usas para traer tus datos del SAES; si ya lo tienes, no necesitas agregarlo otra vez.')
        self.assertIn(textos[clave], saes.card('javascript:void(0)', 'horarios'))
        raiz = pathlib.Path(__file__).resolve().parent.parent
        self.assertIn("SATE.texto('" + clave + "')", (raiz / 'web/sate/cupos.js').read_text(encoding='utf-8'))
        self.assertEqual(textos['sate.cupos.traer'], 'Traer mis datos del SAES')

    def test_los_textos_reales_son_validos(self):
        self.assertEqual(contenido.validar(), [])

    def test_sate_json_y_toml_coinciden(self):
        t = contenido.objeto_t()
        self.assertEqual(t["sate.siglas"], "SATE")
        self.assertIn("{unidad}", t["sate.leyenda.prueba"])
        self.assertTrue(contenido.js().startswith("/* GENERADO"))

    def test_apoyo_lee_datos_y_escapa_atributos_y_textos(self):
        with tempfile.TemporaryDirectory() as d:
            raiz = pathlib.Path(d)
            (raiz / "data").mkdir()
            url = 'https://example.invalid/?a=1&b="dos"'
            (raiz / "data" / "cuenta.json").write_text(json.dumps({"donativos": url}), encoding="utf-8")
            textos = {"proyecto.apoyo.enlace": "Apoya <el proyecto>", "proyecto.apoyo.ayuda": "Gratis & voluntario"}
            with patch.object(contenido, "ROOT", raiz), patch.object(contenido, "objeto_t", return_value=textos):
                fragmento = contenido.html_apoyo()
        self.assertIn('href="https://example.invalid/?a=1&amp;b=&quot;dos&quot;"', fragmento)
        self.assertIn('target="_blank" rel="noopener"', fragmento)
        self.assertIn("Apoya &lt;el proyecto&gt;", fragmento)
        self.assertIn("Gratis &amp; voluntario", fragmento)
        self.assertNotIn("<iframe", fragmento)

    def test_apoyo_compartido_en_pagina_y_encuesta(self):
        fragmento = contenido.html_apoyo()
        pagina = contenido.inject_apoyo('<style>/*__APOYO_CSS__*/</style><!--__APOYO__-->')
        self.assertIn(fragmento, pagina)
        self.assertIn(contenido.APOYO_CSS, pagina)
        with patch.object(encuesta, "config", return_value={"activa": False}):
            salida = encuesta.inject(pagina, "escom")
        self.assertIn('const APOYO=' + json.dumps(fragmento, ensure_ascii=False) + ';', salida)
        self.assertNotIn('/*__APOYO__*/', salida)
        self.assertIn("+APOYO+'</div>'", salida)

    def test_clave_duplicada(self):
        e = validar_texto('[a]\nx = "uno"\n[a]\ny = "dos"\n')
        self.assertTrue(any("TOML" in m for m in e), e)

    def test_variable_posicional_o_mal_formada(self):
        self.assertTrue(validar_texto('a = "Hola {0}"\n'))
        self.assertTrue(validar_texto('a = "Hola {nombre"\n'))
        self.assertTrue(validar_texto('a = "Hola nombre}"\n'))

    def test_variable_valida_y_plural(self):
        self.assertEqual(validar_texto('a = "Hola {nombre}"\nb = "{n, plural, one {# error} other {# errores}}"\n'), [])
        self.assertTrue(validar_texto('b = "{n, plural, one {# error}}"\n'))

    def test_acento_perdido(self):
        self.assertTrue(validar_texto('a = "Situaci?n escolar"\n'))
        self.assertEqual(validar_texto('a = "¿Cuál es tu unidad?"\n'), [])

    def test_clave_invalida_y_html(self):
        self.assertTrue(validar_texto('"Mala-Clave" = "x"\n'))
        self.assertTrue(validar_texto('a = "<script>x</script>"\n'))
        self.assertEqual(validar_texto('a = "<b>Ojo</b> con <a href=\\"#\\">esto</a>"\n'), [])

    def test_variables_distintas_entre_idiomas(self):
        e = validar_texto('a = "Hola {x}"\n', {"en.toml": 'a = "Hello {y}"\n'})
        self.assertTrue(any("distintas" in m for m in e), e)
        self.assertEqual(validar_texto('a = "Hola {x}"\n', {"en.toml": 'a = "Hello {x}"\n'}), [])

    def test_sate_json_exige_claves(self):
        errores = []
        contenido.validar_sate({"sate.leyenda.prueba"}, errores)
        self.assertTrue(any("sate.pestana.mapa.titulo" in m for m in errores))


if __name__ == "__main__":
    unittest.main()
