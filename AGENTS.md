# Instrucciones para agentes de IA (IPN-tools)

Lee este archivo completo antes de cambiar algo. Varios agentes (Claude, ChatGPT/Codex) trabajan en este
repositorio en momentos distintos; el dueño es Víctor Serrano (Silver-VS), alumno de Ingeniería Biónica de la
UPIITA-IPN. Comunícate con él en **español**.

## Qué es

Herramientas web estáticas de libre acceso para el alumnado del IPN (sin servidor ni base de datos):

- **Horarios** (`web/horarios.template.html`): mapa curricular, trayectoria con datos del SAES, minimapa de avance,
  simulación de fin de semestre, estadísticas y análisis, oferta del SAES y armado/generación de horarios.
  Unidades: UPIITA (`horarios-upiita.html`), ESCOM (`horarios-escom.html`, `UNIDAD=escom`) y UPIBI (`horarios-upibi.html`,
  `UNIDAD=upibi`). `horarios.html` es un selector: redirige a la unidad recordada (`ipnt.unidad`) o deja elegirla.
  La página de inicio (`web/index.html`) agrupa las herramientas por unidad académica.
- **Electivas** (`web/sate/electivas.js`): DIE-03 por modalidad y formulario (solo UPIITA).
- **Lector** (`tools/lector_saes.js`): marcador que lee el SAES del alumno (solo lectura) en cualquier unidad.
- **Capturador** (`tools/captura_saes.js`): oferta y mapa curricular del SAES de cualquier unidad.
- **Cuenta** (`tools/cuenta.py`): perfil `ipnt` 1 (docs/FORMATO-PERFIL.md) sincronizado en el OneDrive
  del propio alumno (Google solo para migrar datos antiguos, GOOG1); respaldo en archivo; bienvenida por unidad.

Sitio en vivo: https://silver-vs.github.io/upiita/ (se publica desde el repositorio `Silver-VS/Silver-VS.github.io`).

## Reglas (no negociables)

1. **Trabaja en una rama** (`codex/<tema>`), nunca directo en `main`. **No publiques** al sitio ni ejecutes
   `tools/publicar.sh`, no crees etiquetas ni releases: el dueño o Claude revisan y publican.
2. **Datos personales:** nunca escribas en el repositorio, en `web/` ni en `docs/` datos reales de alumnos (boletas,
   nombres, kárdex). Si el dueño te pasa datos para probar, úsalos solo en memoria o en el navegador y no los
   guardes. Para pruebas usa el perfil ficticio de `web/revision.html` (`DEMO`) o crea uno ficticio.
3. **SAES:** solo lectura. Nunca automatices inscripciones, trámites ni envíos. No pidas ni uses contraseñas.
4. **Logos institucionales:** solo en la versión publicada (`web/dist`, encabezado de `tools/institucional.py`).
5. **Archivos ignorados** (`.gitignore`): `programas/`, `ESCOM/`, `UPIBI/`, `docs/presentacion/`,
   `docs/consulta-carga.md`, `docs/propuesta-planeacion-anual.md`, salidas `web/*.html` y `web/dist/`. No los subas.
6. Redacción en español, profesional; términos del IPN («unidad académica», «alumnado», «UPIITA-IPN»).

## Una sola implementación

Los componentes, el diseño y la lógica de SATE son comunes a todas las unidades académicas.
Una función nueva se activa mediante una capacidad en datos, nunca con `if (unidad === …)`.
Los textos se consultan por clave; no se duplican componentes para cambiar información de una escuela.

| Ruta | Responsabilidad |
|---|---|
| `web/sate/` | Implementación, componentes y diseño comunes |
| `data/sate.json` | Unidad predeterminada, pestañas, trámites y capacidades: carga, carrerasSemestrales, electivas (texto y trámite), cargaCalculada, planDosPeriodos y miSemana |
| `data/unidades/<u>/` | Oferta, planes, mapas y configuración de cada unidad |
| `data/calendario*.json` | Calendarios institucionales y actividades locales |
| `data/unidades_identidad.json` | Identidad, nombres, logos y colores por unidad |
| `data/gestion_escolar/` | Formatos y recursos de trámites |
| `contenido/textos/es.toml` | Textos por clave, incluidos los referidos desde capacidades |

Excepción de compatibilidad: `nucleo.js` conserva el literal de UPIITA únicamente en la
elección del prefijo histórico `hu.`; las otras unidades usan `hu.<unidad>.`.
El campo `upiita_saes` pertenece al formato compartido del Lector, no es un id de unidad.
`tests/qa_sate_arquitectura.mjs` impide introducir ids de unidad en JS y el cascarón de SATE,
con una lista blanca que permite solamente la expresión exacta del prefijo histórico.

## Compilar y probar

```bash
export UPIITA_SITE=https://silver-vs.github.io/upiita/
python tools/build_horarios.py              # UPIITA -> web/dist/horarios-upiita.html (+ horarios.html, index, legales, íconos)
UNIDAD=escom python tools/build_horarios.py # ESCOM  -> web/dist/horarios-escom.html
python -m http.server 8080 --directory web  # http://localhost:8080/dist/index.html
```

Comprobación mínima tras cada cambio: compila sin errores, los `<script>` de `web/dist/*.html` se parsean
(p. ej. `node -e "new Function(src)"` por bloque) y la página carga sin errores en consola. Prueba con y sin datos
del SAES (perfil ficticio en `localStorage['saes.alumno']`), en la UPIITA y en la ESCOM, y a ancho de teléfono.

Cuidado al editar con scripts de Python: secuencias como `\b`, `\1` dentro de cadenas normales se convierten en
caracteres de control; usa cadenas crudas (`r"..."`) o el editor.

## Mapa del código

| Ruta | Contenido |
|---|---|
| `web/horarios.template.html` | Toda la lógica de Horarios (HTML+CSS+JS en un archivo). Datos inyectados en `const DATA=` |
| `tools/build_horarios.py` | Compila Horarios; `UNIDAD` elige `data/unidades/<u>/`; `layout_de` (trazado del PDF) y `layout_por_areas` (columnas por categoría, un renglón por semestre, flechas con pistas propias y reducción transitiva; prueba en `tests/test_rutas_mapa.py`) |
| `tools/semestre.py` | Actualización semestral de oferta y salones (pdf, snippet-saes, aplicar-saes, cruce, datos, estado); guía en `docs/ACTUALIZACION-SEMESTRAL.md`. `build_horarios.py --solo-datos` regenera solo `datos/<unidad>/*.json` |
| `tools/cuenta.py`, `tools/saes.py`, `tools/skins.py`, `tools/institucional.py` | Módulos inyectados (cuenta, Lector, tema, encabezado) |
| `data/` | UPIITA: oferta, mapa curricular, trayectorias, seriación, especialidades, salones, formatos DIE |
| `data/categorias.json` | Catálogo común de categorías (áreas de conocimiento) para todas las carreras |
| `data/unidades/escom/` | ESCOM: oferta, mapa curricular, trayectorias extraídas, `areas_<c>.json`, `optativas.json` |
| `data/unidades/upibi/` | UPIBI: oferta y mapa del SAES, 6 trayectorias por carrera/plan, áreas y optativas; contexto en `docs/handoff-upibi/` |
| `tools/extract_mapa*.py`, `tools/categorias_escom.py`, `tools/optativas_escom.py` | Extracción de PDFs y clasificación |
| `docs/` | ESTADO, AUTOHOSPEDAJE, FORMATO-PERFIL, CUENTA-ENTRA/GOOGLE, SAES-UNIDADES, CATEGORIAS-ESCOM, ANALISIS-ACADEMICO |

Almacenamiento del navegador: claves `hu.*` (UPIITA), `hu.<unidad>.*` (otras), `ue.*` (Electivas),
`saes.alumno` (datos del Lector, con campo `unidad`), `ipnt.*` (cuenta). Toda escritura pasa por `IPNT.set`.

## Estado (2026-10-03) y pendientes

Publicado: v1.2.0 + cambios posteriores (categorías, minimapa y enfoque, estadísticas con Observable Plot,
simulación ampliada, análisis) + rama `codex/upibi` (UPIBI, analítica etapas A–C, meta de créditos, nuevo trazado de
flechas en mapas por áreas). Pendientes, en orden sugerido:

1. **UPIBI:** integrada y publicada (2026-10-03). Pendientes en `docs/handoff-upibi/HANDOFF-CLAUDE-UPIBI.md`:
   equivalencias entre planes (sin integrar), etapa D de analítica, discrepancias PDF/SAES (B706) y aclaraciones
   institucionales (E739/F101, duración normativa).
2. **IIA y LCD (ESCOM):** confirmar si las filas de sus tablas de optativas son seriaciones 6.º → 7.º; si sí,
   agregarlas en `tools/optativas_escom.py` (`req`).
3. **Propuestas de `docs/ANALISIS-ACADEMICO.md`:** probabilidad de desfase, comparar escenarios de simulación,
   carga recomendada por periodo, alerta de baja por tiempo.
4. **Revisión de categorías** de `docs/CATEGORIAS-ESCOM.md` con academias.
5. Cuentas: avisos controlados por `data/cuenta.json` (`institucionalPendiente`); cambiar a
   `false` cuando TI del IPN autorice la app. Google está retirado: `googleSoloMigracion` (docs/CUENTA-GOOGLE.md).

Al terminar un trabajo: commits pequeños y descriptivos en tu rama, `git push`, y un resumen para el dueño con
qué cambió, cómo se probó y qué falta. No modifiques `/upiita` del repositorio del sitio.

### Pruebas aleatorias de perfiles (fuzz)

`python -m unittest tests.test_fuzz_perfiles` (≈3 min, requiere Chrome y haber compilado las tres unidades) genera
perfiles ficticios con trayectorias raras (cambio de carrera con revalidaciones altas, electivas revalidadas que suman
créditos, reprobadas y recursamientos, historias largas, datos sucios, primer ingreso, egresado) y revisa invariantes en
estadísticas, sugerencias y generador. Ajustes: `FUZZ_N`, `FUZZ_SEMILLAS`. Una falla se reproduce abriendo
`web/dist/qa-fuzz-<unidad>.html?n=<N>&semilla=<S>` (los `qa-*` no se publican). Si agregas una regla de negocio, agrega
su invariante en `tests/fuzz/fuzz_perfiles.js`.
