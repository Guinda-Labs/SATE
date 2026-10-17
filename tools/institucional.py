"""Versión institucional (para hospedar en el servidor de la UPIITA) de las páginas generadas.

La versión que se comparte fuera del servidor oficial no lleva logotipos institucionales.
La versión institucional agrega el encabezado con las firmas Educación (SEP) / IPN y el nombre de la
unidad, según el Manual de Identidad Gráfica IPN 2026 (convivencia SEP/IPN, área de protección,
medida mínima digital de 2 cm) y el Manual de Diseño Web IPN 2025 (título "| IPN").
Los archivos de logotipo NO se incluyen: deben ser los oficiales que entrega la Coordinación de
Imagen Institucional (www.ipn.mx/imageninstitucional/identidad-institucional.html) y la propia unidad.
"""
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "web" / "dist"
# Logo del IPN del encabezado de SATE: la ruta vive solo en data/identidad/logo_ipn.json
LOGO_IPN = json.loads((ROOT / "data" / "identidad" / "logo_ipn.json").read_text(encoding="utf-8"))

HEADER = """<style>
.inst{background:transparent;border:0;border-radius:0;border-bottom:3px solid var(--sate-realce,var(--accent));padding-inline:16px}
.inst-in{max-width:1480px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:12px 28px;padding-block:12px}
.inst-in img{height:80px;width:auto;display:block}
.inst-in .unit img{height:72px}
.inst-in .unit{margin-left:auto}
/* versión del logo según el tema (sistema o selector claro/oscuro de la página) */
.inst .logo-dk{display:none}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .inst .logo-dk{display:block}:root:not([data-theme="light"]) .inst .logo-lt{display:none}}
:root[data-theme="dark"] .inst .logo-dk{display:block}:root[data-theme="dark"] .inst .logo-lt{display:none}
.inst-name{max-width:1480px;margin:0 auto;padding-block:0 10px;font:600 .95rem "Noto Sans",system-ui,sans-serif;color:var(--fg)}
.inst-foot{background:#fff;margin-top:40px;border-top:1px solid var(--line)}
.inst-foot img{display:block;width:min(1100px,100%);height:auto;margin:0 auto}
@media (max-width:640px){.inst-in{flex-wrap:nowrap;gap:10px}.inst-in img{height:76px}.inst-in .unit img{height:44px}.inst-in .unit{margin-left:auto}.inst-name{font-size:.78rem;font-weight:500}}
@media (max-height:520px) and (orientation:landscape){.inst-in{padding-block:6px}.inst-in img{height:76px}.inst-in .unit img{height:44px}.inst-name{display:none}}
</style>
<header class="inst" role="banner">
  <div class="inst-in">
    <span><img class="logo-lt" src="assets/logos/ipn-horizontal-guinda.webp" alt="Instituto Politécnico Nacional. La Técnica al Servicio de la Patria" width="264" height="80"><img class="logo-dk" src="assets/logos/ipn-horizontal-calado.webp" alt="Instituto Politécnico Nacional. La Técnica al Servicio de la Patria" width="264" height="80"></span>
    <a class="unit" href="https://www.upiita.ipn.mx/"><img class="logo-lt" src="assets/logos/upiita-oro.webp" alt="UPIITA, inicio del sitio de la unidad" width="91" height="72"><img class="logo-dk" src="assets/logos/upiita-blanco.webp" alt="UPIITA, inicio del sitio de la unidad" width="91" height="72"></a>
  </div>
  <div class="inst-name">/*__UNIDAD_NOMBRE__*/</div>
</header>"""

FOOTER = """<footer class="inst-foot" role="contentinfo"><img src="assets/logos/pleca-horizontal.webp" alt="Educación, Secretaría de Educación Pública. Instituto Politécnico Nacional" width="1600" height="269" loading="lazy"></footer>"""

README = """# Logotipos oficiales

| Archivo | Fuente |
|---|---|
| `ipn-horizontal-guinda.webp`, `ipn-horizontal-calado.webp` | Coordinación de Imagen Institucional, carpeta "Logotipo IPN / Logo Horizontal" (convertidos de PNG a WebP) |
| `pleca-horizontal.webp` | CII, "Plecas SEP IPN / PNG Sin leyenda PEF" (Plecas 2026 V.0.4-02) |
| `upiita-oro.webp`, `upiita-blanco.webp`, `upiita-gris.webp`, `upiita-negro.webp` | upiita.ipn.mx/transparencia/logotipo-institucional (convertidos a WebP) |
| `upiita-30-color.webp`, `upiita-30-blanco.webp` | CII, logos de 30 aniversario de la UPIITA (uso temporal, con vigencia) |

Originales (PNG/PDF/AI) en `data/identidad/originales/`, fuera de lo que se publica.

Reglas del Manual de Identidad Gráfica IPN 2026:
- Solo colores oficiales; sin degradados, sombras, contornos ni transparencias. No deformar.
- Medida mínima digital del escudo: 2 cm. Respetar área de protección y la convivencia Educación (SEP) | IPN.
- Toda inserción con imagen institucional requiere visto bueno del Departamento de Diseño de la
  Coordinación de Imagen Institucional (oficio del director, asunto "Solicitud de Visto bueno", correspondenciacii@ipn.mx).
"""


# enlace a la página principal del sitio (solo en la versión publicada; la compartida no tiene a dónde volver)
HOME = """<a class="ipnt-home" href="./" title="Ir a la página principal de GuindaLabs"><img src="assets/icono/ipn-tools-icono-120.png" alt="" width="22" height="22"><span>GuindaLabs</span><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
<style>.ipnt-home{display:inline-flex;align-items:center;gap:6px;margin:0 0 6px;padding:2px 8px 2px 2px;border-radius:999px;color:var(--muted);font-size:.86rem;font-weight:600;text-decoration:none}
.ipnt-home:hover{color:var(--accent);background:var(--surface)}.ipnt-home img{border-radius:6px}</style>"""


def write_dist(name, html, title_suffix=" | UPIITA IPN", unidad=None):
    """Escribe web/dist/<name>.html con el encabezado institucional y el título del sitio."""
    DIST.mkdir(parents=True, exist_ok=True)
    logos = DIST / "assets" / "logos"
    logos.mkdir(parents=True, exist_ok=True)
    (logos / "README.md").write_text(README, encoding="utf-8")
    head = HEADER
    if unidad and unidad.get("id", "upiita") != "upiita":
        # otra unidad: escudo del IPN y nombre de la unidad (sin el logotipo de la UPIITA)
        head = re.sub(r'\s*<a class="unit".*?</a>', "", head, flags=re.S)
    from cuenta import identidades
    identidad = identidades().get((unidad or {}).get('id', 'upiita'), {})
    head = head.replace('/*__UNIDAD_NOMBRE__*/', identidad.get('nombre', (unidad or {}).get('nombre', identidad.get('siglas', ''))))
    html = html.replace("<!--__INST_HEADER__-->", head, 1)
    html = html.replace("<!--__IPNT_HOME__-->", HOME, 1)   # regreso a la página principal de GuindaLabs
    # pleca SEP | IPN al pie: retirada a petición del equipo (2026-10-01); FOOTER se conserva por si se vuelve a requerir
    # "Horarios UPIITA" -> "Horarios | UPIITA IPN" (manual web: nombre de la marca al final del título)
    sig = re.escape((unidad or {}).get("siglas", "UPIITA"))
    html = re.sub(r"<title>([^<]+)</title>", lambda m: f"<title>{re.sub(r'\s*' + sig + '$', '', m.group(1))}{title_suffix}</title>", html, count=1)
    if not html.lstrip().lower().startswith("<!doctype"):
        # las plantillas omiten <html>/<head>/<body> (el navegador los infiere); aquí se fija idioma y viewport
        html = '<!doctype html>\n<html lang="es">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n' + html
    html = html.replace("</title>", '</title>\n<link rel="icon" href="assets/icono/favicon.ico">', 1)   # ícono de la app (docs/marca)
    from vista_previa import aplicar   # vista previa al compartir el enlace (Open Graph)
    html = aplicar(html, name)
    out = DIST / f"{name}.html"
    out.write_text(html, encoding="utf-8")
    return out
