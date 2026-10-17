"""Huellas, diferencia y reconstrucción de la oferta del SAES (puro, sin red ni archivos).

Contraparte en Python de tools/semestre_diff.js. Una fila se resume en una línea
«carrera|plan|turno|nivel|Grupo|Asignatura|Profesor|Edificio|Salón|Lun|…|Sab»; su huella son los 12 primeros hex de
la SHA-256 de esa línea. Del navegador solo viajan las filas nuevas (con su índice final) y los índices retirados de la
base; aquí se reconstruye la lista y se verifica la SHA-256 del texto completo (líneas unidas con un salto de línea).
"""
import hashlib
import re

DIAS = ('Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab')
CAMPOS = ('carrera', 'plan', 'turno', 'nivel', 'Grupo', 'Asignatura', 'Profesor', 'Edificio', 'Salón') + DIAS
UMBRAL_COINCIDENCIA = 0.5
CLAVES = ('actual', 'proximo')


class ErrorSemestre(ValueError):
    """Dato inconsistente: no se escribe nada."""


def clave_salon(fila):
    # El SAES publica «Salón» con una codificación que a veces llega rota («Sal�n»): se busca por el prefijo.
    return next((k for k in fila if re.match(r'^Sal', k)), 'Salón')


def valores(fila):
    sal = clave_salon(fila)
    base = [fila.get(k) for k in ('carrera', 'plan', 'turno', 'nivel', 'Grupo', 'Asignatura', 'Profesor', 'Edificio')]
    dias = [fila.get(sal)] + [fila.get(k) for k in DIAS]
    return ['' if v is None else str(v).strip() for v in base + dias]


def linea(fila):
    return '|'.join(valores(fila))


def huella(texto, completa=False):
    h = hashlib.sha256(texto.encode('utf-8')).hexdigest()
    return h if completa else h[:12]


def sha_lineas(lineas):
    return huella('\n'.join(lineas), completa=True)


def diferencia(base, nuevos):
    """base, nuevos: listas de huellas. Devuelve (fuera, nuevas): índices de la base retirados e índices de `nuevos` sin pareja."""
    mapa, usados, ultimo, nuevas = {}, set(), -1, []
    for i, h in enumerate(base):
        mapa.setdefault(h, []).append(i)
    for i, h in enumerate(nuevos):
        cola = mapa.get(h) or []
        while cola and cola[0] <= ultimo:
            cola.pop(0)
        if cola:
            ultimo = cola.pop(0)
            usados.add(ultimo)
        else:
            nuevas.append(i)
    return [i for i in range(len(base)) if i not in usados], nuevas


def fila_desde_valores(vals, plantilla):
    """Arma un dict de fila con las mismas claves (y orden) que `plantilla`; `nivel` vuelve a ser entero."""
    if len(vals) != len(CAMPOS):
        raise ErrorSemestre(f'Una fila nueva trae {len(vals)} campos y se esperaban {len(CAMPOS)}.')
    claves = list(plantilla.keys()) if plantilla else ['carrera', 'plan', 'turno', 'nivel', 'Grupo', 'Asignatura',
                                                       'Profesor', 'Edificio', 'Salón', *DIAS]
    sal = clave_salon(dict.fromkeys(claves))
    destino = {'carrera': 0, 'plan': 1, 'turno': 2, 'nivel': 3, 'Grupo': 4, 'Asignatura': 5, 'Profesor': 6,
               'Edificio': 7, sal: 8, **{d: 9 + i for i, d in enumerate(DIAS)}}
    fila = {k: vals[destino[k]] for k in claves if k in destino}
    if isinstance(fila.get('nivel'), str) and fila['nivel'].isdigit():
        fila['nivel'] = int(fila['nivel'])
    return fila


def reconstruir(base, lista):
    """base: filas guardadas; lista: {n, sha, fuera, nuevas:[[índice, valores]]}. Devuelve las filas nuevas verificadas."""
    fuera = set(lista.get('fuera', []))
    if any(not (0 <= i < len(base)) for i in fuera):
        raise ErrorSemestre('El diff retira filas que la base no tiene: ¿cambió la oferta guardada desde que se generó el snippet?')
    conservadas = [f for i, f in enumerate(base) if i not in fuera]
    nuevas = {int(i): v for i, v in lista.get('nuevas', [])}
    n = lista['n']
    plantilla = base[0] if base else None
    filas = []
    for pos in range(n):
        if pos in nuevas:
            filas.append(fila_desde_valores(nuevas[pos], plantilla))
        elif conservadas:
            filas.append(conservadas.pop(0))
        else:
            raise ErrorSemestre('El diff no alcanza para reconstruir la lista (faltan filas).')
    if conservadas or any(i >= n for i in nuevas):
        raise ErrorSemestre('El diff sobra filas: el índice de alguna fila nueva o la cuenta no cuadran.')
    sha = sha_lineas([linea(f) for f in filas])
    if sha != lista.get('sha'):
        raise ErrorSemestre('La SHA-256 de la lista reconstruida no coincide con la del navegador; no se escribió nada. '
                            '¿Cambió data/horarios_upiita.json después de generar el snippet?')
    return filas


def decidir_destinos(listas, mapa=None):
    """Elige a qué clave guardada va cada lista capturada. Devuelve {destino: lista}.

    Regla: la oferta conserva su identidad aunque el SAES cambie «actual»/«próximo» al iniciar el semestre. Una lista
    capturada va a la clave guardada con la que más coincide (>= 50 %); la que no coincide con ninguna es un periodo
    nuevo y ocupa la clave libre (la suya por nombre, si está libre). `mapa` {lista: destino} manda sobre todo."""
    vivas = {k: l for k, l in listas.items() if l.get('n')}
    asignado = {}
    for k, destino in (mapa or {}).items():
        if k in vivas:
            asignado[destino] = k
    resto = {k: l for k, l in vivas.items() if k not in asignado.values()}
    for k, l in sorted(resto.items(), key=lambda kv: -kv[1].get('coincide', 0)):
        if l.get('coincide', 0) >= UMBRAL_COINCIDENCIA and l.get('base') in CLAVES and l['base'] not in asignado:
            asignado[l['base']] = k
    libres = [c for c in CLAVES if c not in asignado]
    for k in sorted(k for k in vivas if k not in asignado.values()):
        if not libres:
            raise ErrorSemestre('No hay clave libre para la lista «%s»; indica --mapa.' % k)
        destino = k if k in libres else libres[0]
        libres.remove(destino)
        asignado[destino] = k
    return asignado


def aplicar(oferta, diff, mapa=None):
    """Devuelve (oferta nueva, informe). No modifica `oferta`; lanza ErrorSemestre sin efectos si algo no cuadra."""
    if diff.get('version') != 1 or 'listas' not in diff:
        raise ErrorSemestre('El archivo no es un diff de snippet-saes (versión 1).')
    listas = diff['listas']
    destinos = decidir_destinos(listas, mapa)
    nueva = dict(oferta)
    informe = []
    for destino, k in destinos.items():
        l = listas[k]
        if l.get('base') not in CLAVES:
            raise ErrorSemestre('La lista «%s» no indica su base.' % k)
        filas = reconstruir(oferta.get(l['base'], []), l)
        antes = len(oferta.get(destino, []))
        nueva[destino] = filas
        informe.append(f"{destino} <- SAES «{k}»: {antes} -> {len(filas)} filas "
                       f"(+{len(l['nuevas'])} nuevas, -{len(l['fuera'])} retiradas; base {l['base']}, coincidencia {l.get('coincide', 0):.1%})")
    for k, l in listas.items():
        if not l.get('n'):
            informe.append(f'SAES «{k}»: vacía (sin oferta publicada); se conserva lo guardado.')
    if diff.get('carreras'):
        nueva['carreras'] = {**oferta.get('carreras', {}), **diff['carreras']}
    if diff.get('capturado'):
        nueva['capturado'] = diff['capturado']
    return nueva, informe
