// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_maxspeed.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.88 (GLOSA release A): de wettelijke maximumsnelheid wordt
//  per node ingelezen en bewaard. Geen advies, geen UI, geen GLOSA.
//
//  T5 IS DE BELANGRIJKSTE TOETS
//  De enige plek waar deze release iets bestaands kan breken is de straatnaam.
//  Het Overpass-filter is verruimd, dus er komen nu naamloze wegen binnen die
//  er eerder niet waren. Zou kiesBesteWeg er één van kiezen, dan zou een
//  kruispunt zijn naam verliezen. T5 zet precies dat geval op: een node met
//  zowel een benoemde als een naamloze weg, waarbij de NAAMLOZE beter is
//  uitgelijnd met de rijrichting — dus de weg die een naïeve implementatie
//  zou kiezen.
//
//  WAAROM DE TWEE SELECTIES GESCHEIDEN ZIJN
//  kiesBesteWeg beantwoordt "hoe heet deze weg" en negeert naamloze wegen.
//  kiesMaxspeed beantwoordt "hoe hard mag ik hier" en kijkt naar alle wegen.
//  T5 en T2 samen leggen vast dat die scheiding werkt: dezelfde fixture geeft
//  de benoemde straat én de limiet van de naamloze weg.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_maxspeed.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testMaxspeed().regels);
// ═══════════════════════════════════════════════════════════════

function testMaxspeed() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  // Een weg zoals Overpass hem levert: tags + geometry (twee punten volstaan
  // voor de hoekbepaling in kiesBesteWeg).
  const weg = (tags, vanLat, vanLon, naarLat, naarLon) => ({
    type: 'way', id: Math.floor(Math.random() * 1e9), tags,
    geometry: [{ lat: vanLat, lon: vanLon }, { lat: naarLat, lon: naarLon }]
  });
  // Noord-zuid en oost-west, zodat de rijrichting er echt toe doet.
  const NOORD = (tags) => weg(tags, 52.150, 5.400, 52.152, 5.400);
  const OOST  = (tags) => weg(tags, 52.150, 5.400, 52.150, 5.403);

  const bewaard = { huidigeRichting };

  try {
    // ══ T1 — één weg met maxspeed=50 ══════════════════════════
    eis('T1 één weg met maxspeed=50 geeft 50',
        kiesMaxspeed([NOORD({ name: 'A-straat', maxspeed: '50', highway: 'primary' })]) === 50,
        '50', String(kiesMaxspeed([NOORD({ name: 'A-straat', maxspeed: '50' })])));

    // ══ T2 — twee wegen, de laagste wint ══════════════════════
    const tweeWegen = [
      NOORD({ name: 'A-straat', maxspeed: '50', highway: 'primary' }),
      OOST({ maxspeed: '30', highway: 'residential' })          // naamloos
    ];
    eis('T2 twee wegen (50 en 30) geven 30 — de laagste wint',
        kiesMaxspeed(tweeWegen) === 30, '30', String(kiesMaxspeed(tweeWegen)));
    // Het gemeten praktijkgeval: een oprit van 130 door een stedelijk kruispunt.
    const opritGeval = [
      NOORD({ name: 'Stadsweg', maxspeed: '50', highway: 'secondary' }),
      OOST({ maxspeed: '130', highway: 'motorway_link' })
    ];
    eis('T2b een motorway_link van 130 verhoogt een stedelijke node niet',
        kiesMaxspeed(opritGeval) === 50, '50', String(kiesMaxspeed(opritGeval)));

    // ══ T3 — geen tag ⇒ null, nooit een standaardwaarde (RV3) ══
    eis('T3 een weg zonder maxspeed-tag geeft null',
        kiesMaxspeed([NOORD({ name: 'A-straat', highway: 'residential' })]) === null,
        'null', String(kiesMaxspeed([NOORD({ name: 'A-straat' })])));
    eis('T3b een lege wegenlijst geeft null',
        kiesMaxspeed([]) === null && kiesMaxspeed(null) === null,
        'null', String(kiesMaxspeed([])) + ' / ' + String(kiesMaxspeed(null)));
    // RV3 in de bron: nergens een cijfer als terugval.
    const bronMs = String(kiesMaxspeed)
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T3c de helper kent geen standaardwaarde — hij geeft null of een gemeten getal',
        /return laagste;/.test(bronMs) && !/\?\?\s*\d/.test(bronMs) && !/\|\|\s*\d\d/.test(bronMs),
        'geen verzonnen terugval', 'schoon');

    // ══ T4 — tekstvarianten worden null ═══════════════════════
    const varianten = ['NL:urban', 'walk', 'none', 'signals', '50 mph', 'RO:urban', '', ' '];
    const doorgelaten = varianten.filter(v =>
      kiesMaxspeed([NOORD({ name: 'X', maxspeed: v })]) !== null);
    eis('T4 tekstvarianten worden null, niet geraden',
        doorgelaten.length === 0, 'alle acht null',
        doorgelaten.length ? ('doorgelaten: ' + doorgelaten.join(', ')) : 'alle acht null');
    // En waarden buiten het wettelijke bereik ook.
    const buitenBereik = ['0', '3', '200', '999'].filter(v =>
      kiesMaxspeed([NOORD({ name: 'X', maxspeed: v })]) !== null);
    eis('T4b waarden buiten 5-130 tellen niet mee (tagfout)',
        buitenBereik.length === 0, 'alle vier null',
        buitenBereik.length ? buitenBereik.join(', ') : 'alle vier null');
    // Een numerieke waarde met spaties eromheen wordt WEL gelezen.
    eis('T4c " 50 " met spaties wordt gewoon 50',
        kiesMaxspeed([NOORD({ name: 'X', maxspeed: ' 50 ' })]) === 50,
        '50', String(kiesMaxspeed([NOORD({ name: 'X', maxspeed: ' 50 ' })])));

    // ══ T5 — DE STRAATNAAM BLIJFT (RV2) ═══════════════════════
    // De naamloze weg loopt oost-west en is dus PERFECT uitgelijnd met een
    // rijrichting van 90°; de benoemde weg staat er haaks op. Wie naïef op
    // uitlijning zou selecteren, kiest hier de naamloze — en verliest de naam.
    const gemengd = [
      NOORD({ name: 'Blekerssingel', maxspeed: '50', highway: 'secondary' }),
      OOST({ maxspeed: '30', highway: 'service' })              // naamloos, beter uitgelijnd
    ];
    huidigeRichting = 90;
    const gekozen = kiesBesteWeg(gemengd, 90);
    eis('T5 kiesBesteWeg kiest de BENOEMDE weg, ook al ligt de naamloze beter',
        gekozen && gekozen.tags && gekozen.tags.name === 'Blekerssingel',
        'Blekerssingel',
        gekozen ? (gekozen.tags.name || '(naamloos!)') : 'null');
    eis('T5b en de limiet komt intussen wél van de naamloze weg',
        kiesMaxspeed(gemengd) === 30, '30', String(kiesMaxspeed(gemengd)));
    // Ook zonder heading, waar kiesBesteWeg zijn eerste terugval gebruikt.
    const zonderHeading = kiesBesteWeg(gemengd, null);
    eis('T5c zonder rijrichting kiest hij nog steeds de benoemde weg',
        zonderHeading && zonderHeading.tags.name === 'Blekerssingel',
        'Blekerssingel',
        zonderHeading ? (zonderHeading.tags.name || '(naamloos!)') : 'null');
    // En een node met UITSLUITEND naamloze wegen krijgt geen naam, maar wel
    // een limiet — precies de categorie die het oude filter helemaal miste.
    const alleenNaamloos = [OOST({ maxspeed: '70', highway: 'motorway_link' })];
    eis('T5d een node met alleen naamloze wegen: geen straatnaam, wel een limiet',
        kiesBesteWeg(alleenNaamloos, 90) === null && kiesMaxspeed(alleenNaamloos) === 70,
        'naam null, limiet 70',
        'naam ' + String(kiesBesteWeg(alleenNaamloos, 90))
          + ', limiet ' + String(kiesMaxspeed(alleenNaamloos)));

    // ══ T6 — de dekkingsteller ════════════════════════════════
    // De teller in downloadOSM telt één op per node met een limiet. Hier
    // nagerekend op dezelfde manier, zodat de rekenwijze vastligt.
    const fixture = [
      [NOORD({ name: 'A', maxspeed: '50' })],                    // gedekt
      [NOORD({ name: 'B' })],                                    // geen tag
      [NOORD({ name: 'C', maxspeed: 'NL:urban' })],              // tekstvariant
      [NOORD({ name: 'D', maxspeed: '30' }), OOST({ maxspeed: '50' })],  // gedekt, 30
      []                                                          // geen wegen
    ];
    let gedekt = 0;
    for (const ws of fixture) if (kiesMaxspeed(ws) != null) gedekt++;
    eis('T6 de dekkingsteller telt 2 van 5 op deze fixture',
        gedekt === 2, '2 van 5', gedekt + ' van ' + fixture.length);
    const bronDl = String(downloadOSM)
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T6b downloadOSM logt de dekking bij elke kaartdownload',
        /msGedekt\+\+/.test(bronDl)
        && /logOpslagMis\('maxspeed_dekking'/.test(bronDl)
        && /msTotaal: nodes\.length/.test(bronDl),
        'teller + logregel aanwezig', 'aanwezig');
    eis('T6c de logvelden msGedekt/msTotaal staan in logOpslagMis',
        /msGedekt:/.test(String(logOpslagMis)) && /msTotaal:/.test(String(logOpslagMis)),
        'beide velden', 'aanwezig');

    // ══ T7 — GLOSA blijft uit (RV4) ═══════════════════════════
    eis('T7 GLOSA_ACTIEF is nog steeds false',
        GLOSA_ACTIEF === false, 'false', String(GLOSA_ACTIEF));
    eis('T7b de GLOSA-aanroep in tickCd staat nog achter die vlag',
        /if \(GLOSA_ACTIEF\) updateGlosa\(\)/.test(String(tickCd)),
        'if (GLOSA_ACTIEF) updateGlosa()', 'ongewijzigd');
    eis('T7c berekenGlosa leest de nieuwe maxspeed (nog) niet — dit is release A',
        !/maxspeed/.test(String(berekenGlosa)),
        'geen maxspeed in berekenGlosa', 'geen advieslogica toegevoegd');

    // ══ T8 — kiesBesteWeg is niet gewijzigd ═══════════════════
    const bronKbw = String(kiesBesteWeg)
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T8 kiesBesteWeg slaat naamloze wegen nog steeds over',
        /!weg\.tags\?\.name/.test(bronKbw), 'de naam-poort staat er nog', 'ongewijzigd');
    eis('T8b en beide terugvallen zoeken nog steeds een benoemde weg',
        (bronKbw.match(/wegen\.find\(w=>w\.tags&&w\.tags\.name\)/g) || []).length === 2,
        '2 naam-terugvallen',
        String((bronKbw.match(/wegen\.find\(w=>w\.tags&&w\.tags\.name\)/g) || []).length));
    eis('T8c kiesBesteWeg kent maxspeed niet — de twee selecties zijn gescheiden',
        !/maxspeed/.test(bronKbw), 'geen maxspeed in kiesBesteWeg', 'gescheiden');
    // De query haalt beide verzamelingen op, in één unieblok.
    eis('T8d de query gebruikt het unieblok, niet twee losse out geom',
        /\(way\(bn\.tl\)\["name"\];way\(bn\.tl\)\["maxspeed"\];\);out geom;/.test(bronDl)
        && (bronDl.match(/out geom;/g) || []).length === 1,
        'één unieblok, één out geom',
        (bronDl.match(/out geom;/g) || []).length + 'x out geom');

  } finally {
    huidigeRichting = bewaard.huidigeRichting;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testMaxspeed = testMaxspeed;
