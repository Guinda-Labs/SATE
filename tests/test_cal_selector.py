"""La cuadrícula de Mi horario (.cal) no debe ser alcanzada por el aviso de reinscripción (drawCals)."""
import pathlib
import re
import unittest

RAIZ = pathlib.Path(__file__).resolve().parents[1]


class TestSelectorCalendario(unittest.TestCase):
    def test_sin_selector_generico_cal(self):
        for js in (RAIZ / 'web/sate').glob('*.js'):
            texto = js.read_text(encoding='utf-8')
            self.assertIsNone(re.search(r"querySelectorAll\(\s*['\"]\.cal['\"]\s*\)", texto), js.name)


if __name__ == '__main__':
    unittest.main()
