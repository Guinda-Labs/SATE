"""Audita los bloques SAES contra el PDF, sin modificar la oferta ni sus salones."""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import salones

ROOT = Path(__file__).resolve().parents[1]
DIAS = ('Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab')


def traslapa(a, b, c, d):
    return bool(a and b and c and d and max(salones._mins(a), salones._mins(c))
                < min(salones._mins(b), salones._mins(d)))


def bloques(rows):
    for row in rows:
        for dia, key in enumerate(DIAS):
            for inicio, fin in re.findall(r'(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})', row.get(key, '')):
                yield {'grupo': row['Grupo'], 'materia': row['Asignatura'],
                       'profesor': row.get('Profesor', ''), 'dia': dia, 'inicio': inicio, 'fin': fin}


def cruzar(data, rows):
    idx = defaultdict(list)
    for i, clase in enumerate(data['clases']):
        idx[(clase['grupo'], clase['dia'])].append((i, clase))
    usados, discrepancias = set(), []
    total = ok = 0
    for bloque in bloques(rows):
        total += 1
        candidatos = [(i, c) for i, c in idx[(bloque['grupo'], bloque['dia'])]
                      if traslapa(bloque['inicio'], bloque['fin'], c['inicio'], c['fin'])]
        parejas = [(i, c) for i, c in candidatos if salones._sim(bloque['materia'], c['materia']) >= 0.5]
        if parejas:
            ok += 1
            usados.update(i for i, _ in parejas)
        else:
            discrepancias.append({'saes': bloque, 'pdf': [dict(c, indice=i) for i, c in candidatos]})
    sin_pareja = defaultdict(list)
    for i, c in enumerate(data['clases']):
        if i not in usados:
            sin_pareja[c['grupo']].append(dict(c, indice=i))
    grupos_saes = {r['Grupo'] for r in rows}
    # El prefijo 1 también se usa en planes anteriores: solo es una señal, no una confirmación.
    esperables = {}
    for grupo in sin_pareja:
        causas = []
        if grupo.startswith('1') and grupo not in grupos_saes:
            causas.append('primer semestre (posible)')
        if re.match(r'^\dS[MV]', grupo):
            causas.append('ISISA')
        if causas:
            esperables[grupo] = causas
    return {'periodo': data['periodo'], 'fuente_pdf': data['fuente'],
            'bloques_saes': total, 'coincidentes': ok, 'cobertura': ok / total if total else 0,
            'discrepancias': discrepancias, 'pdf_sin_pareja': dict(sorted(sin_pareja.items())),
            'esperables': esperables}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--periodo', default='27/1')
    parser.add_argument('--oferta-periodo', choices=('actual', 'proximo'),
                        help='Si se omite, infiere la oferta por la mayor cobertura (SAES no guarda ciclos).')
    args = parser.parse_args()
    slug = args.periodo.replace('/', '-')
    src = next(p for p in (ROOT / 'data/horarios_saes.json', ROOT / 'data/horarios_upiita.json') if p.exists())
    data = json.loads((ROOT / f'data/salones_{slug}.json').read_text(encoding='utf-8'))
    oferta = json.loads(src.read_text(encoding='utf-8'))
    cruces = {per: cruzar(data, oferta[per]) for per in ('actual', 'proximo')}
    per = args.oferta_periodo or max(cruces, key=lambda k: cruces[k]['cobertura'])
    result = cruces[per]
    result.update(fuente_saes=str(src.relative_to(ROOT)), oferta_periodo=per,
                  oferta_inferida=args.oferta_periodo is None)
    dst = ROOT / f'tmp-horarios/cruce-{slug}.json'
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"{args.periodo} / {per}: {result['coincidentes']}/{result['bloques_saes']} bloques ({result['cobertura']:.1%})")
    print(f"SAES sin pareja: {len(result['discrepancias'])}; PDF sin pareja: {sum(map(len, result['pdf_sin_pareja'].values()))}")
    print(f"Grupos PDF sin pareja: {len(result['pdf_sin_pareja'])}; esperables: {len(result['esperables'])}")
    print(dst.relative_to(ROOT))


if __name__ == '__main__':
    main()
