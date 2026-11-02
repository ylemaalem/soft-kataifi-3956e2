# kaart/maak_plaatsen.py — de plaats (woonplaats) van elk licht in kaart/lichten.json
# © 2026 StoplichtIQ — Y. Lemaalem
#
# Gebruik:
#   python kaart/maak_plaatsen.py <woonplaatsen.json> <gemeenten.json> [kaart/lichten.json]
#
# De twee invoerbestanden zijn antwoorden van Overpass (out geom) op:
#   [out:json][timeout:600];area["ISO3166-1"="NL"]["admin_level"="2"]->.nl;
#   relation["boundary"="administrative"]["admin_level"="10"](area.nl);out geom;
# en hetzelfde met admin_level 8 (de gemeenten). Nodig: python -m pip install shapely
#
# Per licht: de woonplaats (admin_level 10) waarin het ligt, anders de gemeente
# (admin_level 8), anders geen (-1; dat zijn lichten net over de grens of op zee).
# Van een naam met ';' (twee talen) blijft het eerste deel.
#
# Uitvoer kaart/plaatsen.json:
#   v       vorm (1)
#   datum   de datum van de grenzen (timestamp_osm_base, zonder kloktijd)
#   kaart   de eerste 16 tekens van de sha256 van de lichten.json waarvoor dit geldt
#   lichten het aantal lichten
#   namen   de plaatsnamen, op alfabet
#   d       de lichtnummers op volgorde, als verschil met het vorige (het eerste is het nummer zelf)
#   p       per licht de plaats als index in namen, of -1
# Het script schrijft ook de sha256 en de grootte, voor PLAATSEN_SHA256 en
# PLAATSEN_BYTES in index.html.
import hashlib, json, sys
from shapely.geometry import LineString, Point
from shapely.ops import polygonize, unary_union
from shapely.validation import make_valid
from shapely import STRtree


def vlakken(pad):
    o = json.load(open(pad, encoding='utf-8'))
    uit = []
    for r in o['elements']:
        if r.get('type') != 'relation':
            continue
        lijn = {'outer': [], 'inner': []}
        for m in r.get('members', []):
            if m.get('type') == 'way' and m.get('geometry'):
                pts = [(p['lon'], p['lat']) for p in m['geometry'] if p]
                if len(pts) >= 2:
                    lijn['inner' if m.get('role') == 'inner' else 'outer'].append(LineString(pts))
        if not lijn['outer']:
            continue
        g = unary_union(list(polygonize(unary_union(lijn['outer']))))
        if lijn['inner']:
            b = unary_union(list(polygonize(unary_union(lijn['inner']))))
            if not b.is_empty:
                g = g.difference(b)
        naam = (r.get('tags', {}).get('name') or '').split(';')[0].strip()
        if not g.is_empty and naam:
            uit.append((naam, make_valid(g)))
    return uit, o['osm3s']['timestamp_osm_base'][:10]


def plaats_per_licht(lichten, lagen):
    pts = [Point(e['lon'], e['lat']) for e in lichten]
    uit = [None] * len(lichten)
    for laag in lagen:   # eerst de woonplaatsen, dan de gemeenten voor wat overblijft
        geoms = [g for _, g in laag]
        open_ = [i for i in range(len(lichten)) if uit[i] is None]
        if not open_:
            break
        pi, gi = STRtree(geoms).query([pts[i] for i in open_], predicate='intersects')
        kies = {}
        for a, b in zip(pi, gi):
            i = open_[a]
            if i not in kies or geoms[b].area < geoms[kies[i]].area:   # op een grens: het kleinste vlak
                kies[i] = b
        for i, b in kies.items():
            uit[i] = laag[b][0]
    return uit


def main():
    wp, gm = sys.argv[1], sys.argv[2]
    kpad = sys.argv[3] if len(sys.argv) > 3 else 'kaart/lichten.json'
    kbytes = open(kpad, 'rb').read()
    lichten = sorted((e for e in json.loads(kbytes.decode('utf-8'))['elements'] if e.get('type') == 'node'), key=lambda e: e['id'])
    laagW, datum = vlakken(wp)
    laagG, _ = vlakken(gm)
    per = plaats_per_licht(lichten, [laagW, laagG])
    namen = sorted({x for x in per if x})
    idx = {n: i for i, n in enumerate(namen)}
    d, vorig = [], 0
    for e in lichten:
        d.append(e['id'] - vorig); vorig = e['id']
    uit = {'v': 1, 'datum': datum, 'kaart': hashlib.sha256(kbytes).hexdigest()[:16], 'lichten': len(lichten),
           'namen': namen, 'd': d, 'p': [idx[x] if x else -1 for x in per]}
    tekst = json.dumps(uit, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    open('kaart/plaatsen.json', 'wb').write(tekst)
    print('lichten', len(lichten), 'plaatsen', len(namen), 'zonder plaats', sum(1 for x in per if not x))
    print('PLAATSEN_SHA256', hashlib.sha256(tekst).hexdigest())
    print('PLAATSEN_BYTES', len(tekst))


if __name__ == '__main__':
    main()
