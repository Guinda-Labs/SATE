"""Encabezado compartido de SATE y páginas hermanas, sin depender de Horarios."""
from html import escape
from urllib.parse import urlsplit

from institucional import LOGO_IPN


def enlace_local(href):
    """Las capacidades enlazan páginas del sitio, nunca código ni destinos ajenos."""
    url = urlsplit(href)
    if not href or url.scheme or url.netloc or href.startswith(('/', '\\')) or '\\' in href:
        raise ValueError(f'Enlace de encabezado no local: {href!r}')
    return href


def pestanas_encabezado(config, unidad, textos, inicio='index.html'):
    """Pestañas internas y vistas externas habilitadas, en el orden de los datos."""
    enlace_local(inicio)
    cfg = config['unidades'][unidad]
    ocultas = config.get('pestanasOcultas', [])
    items = [dict(id=p, href=f'{inicio}#/{unidad}/{p}', texto=textos[f'sate.pestana.{p}.titulo'])
             for p in cfg['pestanas'] if p not in ocultas]
    for vista in cfg.get('vistas', []):
        if vista.get('externa') and vista.get('habilitada', True) and vista['id'] not in ocultas:
            items.append(dict(id=vista['id'], href=enlace_local(vista['href']),
                              texto=textos[f'sate.pestana.{vista["id"]}.titulo']))
    return items


def encabezado_sate(*, textos, unidad=None, contexto=True, acciones=True,
                    pestanas=(), activa=None, recursos='../', avisos=True):
    """HTML único. True usa los ganchos de SATE; False omite; str es HTML local confiable.

    unidad=None reserva identidad dinámica; un dict usa siglas/nombre/logo de datos.
    recursos es el prefijo relativo al dist raíz. Las pestañas son {id, href, texto}.
    """
    t = lambda clave: escape(textos[clave], quote=True)
    def imagen(clase, ruta, alt, ancho, alto):
        return (f'<img class="{clase}" src="{escape(recursos + ruta, quote=True)}" '
                f'alt="{escape(alt, quote=True)}" width="{ancho}" height="{alto}">')
    ipn = '<span class="sate-logo-ipn">' + ''.join(
        imagen(clase, LOGO_IPN[tema], LOGO_IPN['alt'], LOGO_IPN['ancho'], LOGO_IPN['alto'])
        for tema, clase in [('claro', 'logo-lt'), ('oscuro', 'logo-dk')]) + '</span>'
    if unidad is None:
        siglas = (f'<button class="sate-unidad-btn" id="b-unidad" type="button" aria-haspopup="dialog" '
                  f'aria-label="{t("sate.encabezado.unidad")}" title="{t("sate.encabezado.unidad")}" hidden></button>')
    else:
        siglas = escape(unidad['siglas'])
    leyenda = '<span id="sate-leyenda"></span>'
    if unidad and unidad.get('leyenda'):
        ayuda = textos['sate.leyenda.' + unidad['leyenda']].replace('{unidad}', unidad['siglas'])
        leyenda = f'<span id="sate-leyenda" title="{escape(ayuda, quote=True)}">{t("sate.encabezado.prueba")}</span>'
    if contexto is True:
        contexto = f'<label class="field"><span class="sate-sr">{t("sate.encabezado.carrera")}</span><select id="f-carrera"></select></label>'
    contexto = f'<div class="sate-contexto"><div class="sate-controles">{contexto or ""}</div>{leyenda}</div>'
    if acciones is True:
        acciones = ('<!--__SAES_CARD__--><!--__CUENTA_BTN__--><!--__THEME_BTN__-->'
                    f'<button class="enc-btn sate-opinar" type="button" data-encuesta hidden aria-label="{t("sate.encabezado.opinar")}" title="{t("sate.encabezado.opinar_titulo")}">'
                    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
                    f'<span>{t("sate.encabezado.opinar")}</span></button>')
    logo = ''
    if unidad and unidad.get('logo'):
        d = unidad['logo']
        logo = f'<a class="unit" href="{escape(d["enlace"], quote=True)}">' + ''.join(
            imagen(clase, d[tema], d['alt'], 91, 72)
            for tema, clase in [('claro', 'logo-lt'), ('oscuro', 'logo-dk')]) + '</a>'
    logo = f'<span id="sate-logo-unidad" class="sate-logo-slot">{logo}</span>'
    if acciones:
        lado = (f'<div class="sate-lado"><details class="sate-menu" open><summary aria-label="{t("sate.encabezado.acciones")}">'
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></summary>'
                f'<div class="header-actions">{acciones}{logo}</div></details></div>')
    else:
        lado = f'<div class="sate-lado"><div class="header-actions">{logo}</div></div>'
    enlaces = []
    for p in pestanas:
        actual = ' aria-current="page"' if p['id'] == activa else ''
        enlaces.append(f'<a class="sate-pestana" href="{escape(enlace_local(p["href"]), quote=True)}"{actual}>{escape(p["texto"])}</a>')
    navegacion = ('<div class="sate-enlaces">' + ''.join(enlaces) + '</div>') if enlaces else ''
    html = (f'<header class="top sate-encabezado"><div class="sate-marca">{ipn}<div class="brand">'
            f'<h1 id="sate-titulo">{t("sate.siglas")} {siglas}</h1><p id="sate-nombre">{t("sate.nombre")}</p></div></div>'
            f'{contexto}{lado}<nav class="sate-navegacion" aria-label="{t("sate.encabezado.navegacion")}"><div id="sate-tabs">{navegacion}</div><button id="t-tray" hidden></button></nav>'
            + ('<div class="sate-fila-avisos"><div id="sate-avisos-globales"></div></div>' if avisos else '') + '</header>')
    if acciones:
        # El menú nativo conserva teclado/estado; solo cambia su apertura entre escalones.
        html += """<script>(()=>{const h=document.currentScript.previousElementSibling,m=h.querySelector('.sate-menu'),q=matchMedia('(max-width:767px)');const adaptar=()=>{m.open=!q.matches};adaptar();q.addEventListener('change',adaptar);h.addEventListener('keydown',e=>{if(e.key==='Escape'&&q.matches){m.open=false;m.querySelector('summary').focus()}})})();</script>"""
    return html
