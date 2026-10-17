# 1. Encabezado compartido

`tools/encabezado.py:encabezado_sate` genera el marcado único. SATE lo inserta en
`<!--__SATE_ENCABEZADO__-->`; `tools/build_sate.py` copia `web/sate/encabezado.css` al dist.
Las páginas hermanas cargan ese mismo CSS después de los estilos comunes, sin copiar marcado ni reglas.

| Parámetro | Contrato |
|---|---|
| `textos` | Diccionario plano de `contenido.objeto_t()`; textos de interfaz del TOML. |
| `unidad` | `None`: identidad dinámica de SATE. Diccionario: `siglas`, `leyenda` y `logo` opcionales, con la forma de `data/sate.json`. |
| `contexto` | `True`: selector de carrera; `False`: sin selector; cadena: HTML local confiable. La etiqueta de fase se conserva. |
| `acciones` | `True`: ganchos SAES, cuenta, tema y Opinar; `False`: solo logo; cadena: acciones locales con nombre accesible. |
| `pestanas`, `activa` | Lista `{id, href, texto}` y el id actual. Vacía: ranura para el router de SATE. |
| `recursos` | Prefijo relativo al dist raíz para imágenes, por defecto `../`. |
| `avisos` | Reserva la ranura de avisos globales; por defecto `True`. |

Las cadenas HTML son fragmentos del compilador, nunca datos del alumnado. Los textos, atributos y enlaces de las
pestañas se escapan. Las pestañas solo aceptan destinos relativos del sitio.

# 2. Ejemplo para el directorio de grupos

Ejemplo para **generar** `web/dist/sate/grupos/index.html` desde su rama, sin cargar `nucleo.js` ni `inicio.js`:

```python
import json
from pathlib import Path
from contenido import objeto_t
from encabezado import encabezado_sate, pestanas_encabezado

textos = objeto_t()
config = json.loads(Path('data/sate.json').read_text(encoding='utf-8'))
unidad = dict(config['unidades']['upiita'], siglas='UPIITA')
pestanas = pestanas_encabezado(config, 'upiita', textos, inicio='../index.html')
# Solo el ejemplo añade Grupos; no activa la capacidad en producción.
pestanas.append(dict(id='grupos', href='./', texto=textos['sate.pestana.grupos.titulo']))
encabezado = encabezado_sate(
    textos=textos, unidad=unidad, contexto=False, acciones=False,
    pestanas=pestanas, activa='grupos', recursos='../../', avisos=False)
# En la plantilla: tokens y estilos comunes, después ../encabezado.css.
# El encabezado y el contenido comparten un <div class="sate-contenedor">.
html = '<link rel="stylesheet" href="../encabezado.css">'
html += '<div class="sate-contenedor">' + encabezado + '<main>...</main></div>'
```

El ejemplo supone tokens, fuentes, tema y documento HTML cargados por la plantilla común. No necesita JS sin
acciones. Con acciones se incluye un script pequeño para abrir el menú nativo en escritorio y cerrarlo en móvil;
requiere la misma política de scripts en línea de SATE. `acciones=True` requiere los inyectores `skins`, `cuenta`,
`saes` y `encuesta` como en `build_sate.py`; no duplicar sus botones.

Para activar Grupos posteriormente: añadir `{"id":"grupos","href":"grupos/","externa":true}` a `vistas` de la
unidad. `habilitada:false` la apaga. `pestanasOcultas` también la oculta. Los títulos están en
`sate.pestana.grupos.titulo` y `.corto`. El enlace se resuelve desde `sate/`; desde una página más profunda hay que
ajustar ese `href` en los datos que recibe el componente. El router no trata una vista externa como módulo.

# 3. Escalones y verificación

| Ancho | Disposición |
|---|---|
| ≥1200 | Marca, contexto y acciones en tres columnas; contenido limitado a `--ipn-contenido-ancho` (1480 px). |
| 768–1199 | Mismos ejes; acciones en iconos con nombre accesible; nombre completo adaptable dentro de la marca. |
| <768 | Marca y menú en icono; carrera y fase debajo; navegación adaptable de SATE o enlaces desplazables de la hermana. |

El menú reserva espacio al abrirse para no tapar carrera ni pestañas. Logos claro/oscuro conservan las variantes.
El contenedor común usa `--ipn-contenido-margen`; no añadir otro padding al encabezado.
Pruebas: `tests/test_encabezado.py`, `tests/qa_sate_encabezado.mjs` y `tests/qa_sate_diseno.mjs`.
Pendiente: revisión visual del orquestador a 1920, 1440, 1024, 768, 375 y 320 px en ambos temas; sin puntaje visual
antes/después, porque este encargo no dispone de navegador.
