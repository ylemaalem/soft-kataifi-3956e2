# ═══════════════════════════════════════════════════════════════
#  StoplichtIQ — kaart/maak.py
#  © 2026 StoplichtIQ — Y. Lemaalem
#
#  Maakt de kaartbestanden van de app uit een OSM-uittreksel (.osm.pbf) van
#  Geofabrik, in dezelfde vorm als de antwoorden van Overpass die de app
#  verwerkt (V11.37.20, zie kaartHaalKaart in index.html):
#    lichten.json  alle verkeerslichten (node highway=traffic_signals, zoals
#                  '.tl out body') en de wegen met een naam of maxspeed waar
#                  een licht op ligt (zoals 'way(bn.tl)["name"];
#                  way(bn.tl)["maxspeed"]; out geom'). Alleen de tags die de
#                  app leest; zonder 'bounds' (de app leest die niet).
#    fiets.json    de lichten die op een fiets- of voetpad liggen en op geen
#                  enkele autoweg (zoals de vraag van fietsHaalOp, 'out ids').
#    versie.json   datum, aantallen, groottes en sha256 van beide bestanden.
#  Eén element per regel, op oplopend nummer (zoals Overpass): een verversing
#  verandert dan alleen de regels die in OSM veranderden.
#  De datum van de data staat erin zonder kloktijd (besluit van Younes).
#
#  GEBRUIK (zie LEESMIJ.md)
#    python -m pip install osmium          (pyosmium, vrije software, BSD)
#    python kaart/maak.py <uittreksel.osm.pbf> [uitmap]
#  Zonder uitmap schrijft hij naast dit script. Bestaat er al een versie.json,
#  dan vergelijkt hij de aantallen en stopt hij bij een te grote sprong.
# ═══════════════════════════════════════════════════════════════
import datetime, gzip, hashlib, json, os, sys

import osmium
import osmium.filter as F

FIETS = set('cycleway|footway|path|pedestrian|steps|bridleway'.split('|'))   # = FIETS_WEGEN in index.html
AUTO = set(('motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road|busway'
            '|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link').split('|'))   # = AUTO_WEGEN
NODE_TAGS = ('traffic_signals:sound', 'description')            # wat downloadOSM van een licht leest
WAY_TAGS = ('name', 'maxspeed', 'highway', 'oneway', 'junction')  # wat kiesBesteWeg, kiesMaxspeed en tegenRijrichtingen lezen
MAX_SPRONG_LICHTEN = 0.02   # meer dan 2% meer of minder lichten dan de vorige versie: stoppen en kijken
MAX_SPRONG_WEGEN = 0.03
COPY = 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.'


def datum_van(pbf):
    h = osmium.io.Reader(pbf, osmium.osm.osm_entity_bits.NOTHING).header()
    t = h.get('osmosis_replication_timestamp') or ''
    if len(t) < 10:
        sys.exit('FOUT: het uittreksel heeft geen datum in de kop')
    return t[:10]   # alleen de datum


def lees(pbf):
    lichten = {}
    for n in osmium.FileProcessor(pbf, osmium.osm.NODE).with_filter(F.TagFilter(('highway', 'traffic_signals'))):
        lichten[n.id] = (n.location.x, n.location.y, [(t.k, t.v) for t in n.tags if t.k in NODE_TAGS])
    wegen, op_fiets, op_auto = {}, set(), set()
    for w in osmium.FileProcessor(pbf, osmium.osm.WAY).with_filter(F.KeyFilter('highway')):
        refs = [r.ref for r in w.nodes]
        raak = [r for r in refs if r in lichten]
        if not raak:
            continue
        hw = w.tags.get('highway')
        if hw in FIETS:
            op_fiets.update(raak)
        if hw in AUTO:
            op_auto.update(raak)
        if 'name' in w.tags or 'maxspeed' in w.tags:
            wegen[w.id] = (refs, [(t.k, t.v) for t in w.tags if t.k in WAY_TAGS])
    # ook wegen zonder highway-tag met een naam of maxspeed doen in Overpass mee
    for w in osmium.FileProcessor(pbf, osmium.osm.WAY).with_filter(F.KeyFilter('name', 'maxspeed')):
        if 'highway' in w.tags:
            continue
        refs = [r.ref for r in w.nodes]
        if any(r in lichten for r in refs):
            wegen[w.id] = (refs, [(t.k, t.v) for t in w.tags if t.k in WAY_TAGS])
    nodig = set()
    for refs, _ in wegen.values():
        nodig.update(refs)
    loc = {}
    for n in osmium.FileProcessor(pbf, osmium.osm.NODE).with_filter(F.IdFilter(nodig)):
        loc[n.id] = (n.location.x, n.location.y)
    return lichten, wegen, loc, sorted(op_fiets - op_auto), len(nodig) - len(loc)


def g(v):
    # vaste komma (1e7) naar tekst zoals Overpass (7 decimalen), zonder nullen achteraan: JSON.parse geeft hetzelfde getal
    s = ('-' if v < 0 else '') + str(abs(v) // 10**7) + '.' + str(abs(v) % 10**7).rjust(7, '0')
    s = s.rstrip('0')
    return s[:-1] if s.endswith('.') else s


def esc(s):
    return json.dumps(s, ensure_ascii=False)


def tagtekst(tags):
    return '{' + ','.join(esc(k) + ':' + esc(v) for k, v in tags) + '}' if tags else None


def kop(datum):
    return '{"version":0.6,"generator":"StoplichtIQ kaartbestand","osm3s":{"timestamp_osm_base":"%s","copyright":"%s"},"elements":[\n' % (datum, COPY)


def main():
    if len(sys.argv) < 2:
        sys.exit('gebruik: python kaart/maak.py <uittreksel.osm.pbf> [uitmap]')
    pbf = sys.argv[1]
    uit = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
    datum = datum_van(pbf)
    lichten, wegen, loc, fiets, mist = lees(pbf)
    if mist:
        sys.exit('FOUT: %d punten van wegen ontbreken in het uittreksel' % mist)
    regels = []
    for i in sorted(lichten):
        x, y, tags = lichten[i]
        t = tagtekst(tags)
        regels.append('{"type":"node","id":%d,"lat":%s,"lon":%s%s}' % (i, g(y), g(x), (',"tags":' + t) if t else ''))
    for i in sorted(wegen):
        refs, tags = wegen[i]
        geo = ','.join('{"lat":%s,"lon":%s}' % (g(loc[r][1]), g(loc[r][0])) for r in refs)
        t = tagtekst(tags)
        regels.append('{"type":"way","id":%d,"nodes":[%s],"geometry":[%s]%s}' % (i, ','.join(map(str, refs)), geo, (',"tags":' + t) if t else ''))
    lt = (kop(datum) + ',\n'.join(regels) + '\n]}\n').encode('utf-8')
    ft = (kop(datum) + ',\n'.join('{"type":"node","id":%d}' % i for i in fiets) + '\n]}\n').encode('utf-8')
    for data in (lt, ft):
        json.loads(data)   # moet geldige JSON zijn
    versie = {'v': 1, 'datum': datum, 'lichten': len(lichten), 'wegen': len(wegen), 'fiets': len(fiets),
              'bytes': {'lichten': len(lt), 'fiets': len(ft)},
              'gzip': {'lichten': len(gzip.compress(lt, 6)), 'fiets': len(gzip.compress(ft, 6))},
              'sha256': {'lichten': hashlib.sha256(lt).hexdigest(), 'fiets': hashlib.sha256(ft).hexdigest()}}
    vorig_pad = os.path.join(uit, 'versie.json')
    if os.path.exists(vorig_pad):
        vorig = json.load(open(vorig_pad, encoding='utf-8'))
        for k, grens in (('lichten', MAX_SPRONG_LICHTEN), ('wegen', MAX_SPRONG_WEGEN)):
            a, b = vorig.get(k), versie[k]
            if a and abs(b - a) / a > grens:
                sys.exit('STOP: %s van %d naar %d (meer dan %d%%); eerst uitzoeken' % (k, a, b, round(grens * 100)))
        print('vorige versie: datum %s, lichten %d, wegen %d, fiets %d' % (vorig.get('datum'), vorig.get('lichten', 0), vorig.get('wegen', 0), vorig.get('fiets', 0)))
    os.makedirs(uit, exist_ok=True)
    for naam, data in (('lichten.json', lt), ('fiets.json', ft)):
        tmp = os.path.join(uit, naam + '.tmp')
        open(tmp, 'wb').write(data)
        os.replace(tmp, os.path.join(uit, naam))
    tmp = os.path.join(uit, 'versie.json.tmp')
    open(tmp, 'w', encoding='utf-8', newline='\n').write(json.dumps(versie, indent=1) + '\n')
    os.replace(tmp, vorig_pad)
    print(json.dumps(versie, indent=1))


if __name__ == '__main__':
    main()
