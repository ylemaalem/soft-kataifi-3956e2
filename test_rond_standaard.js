// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_rond_standaard.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.18: rond licht is voortaan altijd de actieve standaard.
//  Een eerder getikte richting wordt niet meer automatisch teruggezet; alleen
//  een tik in DEZE sessie maakt een richting actief.
//
//  S1  een opgeslagen richting stuurt de countdown NIET meer — en het gedrag is
//      exact gelijk aan dat van een kruispunt zonder enige opgeslagen richting
//  S2  een echte tik werkt onveranderd: countdown, herkomst, schrijfrecht
//  S3  de keuzeknoppen komen terug op een bekend kruispunt
//  S4  de richting-rijen blijven zichtbaar met hun eigen cijfers
//  S5  de koppel-chip bestaat nergens meer; de ✕ en het paneel-pad blijven
//  S6  REGRESSIE: dagdeel-lening, snelle tik-opslag en de schrijfpoort van
//      V11.18.10 zijn niet geraakt
//
//  DE KERN IN ÉÉN ZIN: de poort in stap 1 van kiesCountdownBron eist nu
//  tikHerkomstEcht — dezelfde vraag die V11.18.10 al stelde vóór het
//  WEGSCHRIJVEN, nu ook vóór het TONEN.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_rond_standaard.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRondStandaard().regels);
// ═══════════════════════════════════════════════════════════════

function testRondStandaard() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const NODE = 773001;
  const NU = huidigDDActief();
  const nu = Date.now();
  const AANRIJ = 'N', AFRIJ = 'W';          // rechtsaf vanuit het noorden

  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos, huidigeRichting, snelheidKmh,
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij,
    richtingLockNodeId, richtingLockKeuze, richtingLockBron,
    richtingGedruktVoorNode, richtingKnoppenNodeId, preZet, preWis,
    getoondeLaag, getoondDagdeel, richtingBlokVerborgen, bevestigActief,
    richtingTikTijd, richtingTikElement,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML,
    knoppenDisplay: (document.getElementById('richting-knoppen') || {}).style
      ? document.getElementById('richting-knoppen').style.display : null
  };
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };

  let tikker = 0;
  const mk = (n, duur) => Array.from({ length: n }, () => ({
    duur, tijd: nu - (++tikker) * 60000, gewicht: 1, bron: 'tik'
  }));
  const zetV5 = (aanrij, afrij, dd, n, duur) =>
    zetLS(`sl_v5_${NODE}_${aanrij}_${afrij}_${dd}`, n ? JSON.stringify(mk(n, duur)) : null);
  const zetV4 = (dd, n, duur) =>
    zetLS(`sl_v4_${NODE}_${dd}`, n ? JSON.stringify(mk(n, duur).map(x => ({ ...x, richting: 0, bron: 's1' }))) : null);
  // de opgeslagen richting zoals de app die zelf wegschrijft
  const zetOpgeslagenRichting = (richting) =>
    zetLS(`sl_richting_${NODE}`, JSON.stringify({
      cx_zones: [{ zone: 'links', count: 0 }, { zone: 'midden', count: 0 }, { zone: 'rechts', count: 3 }],
      headings: [], laatste_update: nu, bevestigingen: 3,
      tikrichting: richting, tik_bevestigingen: 3
    }));

  const wis = () => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(`sl_v5_${NODE}_`) || k.startsWith(`sl_v4_${NODE}_`)) zetLS(k, null);
    }
    zetLS(`sl_richting_${NODE}`, null);
    zetLS(`sl_neutraal_${NODE}`, null);
    zetLS(`sl_enkelricht_${NODE}`, null);
    zetLS(`sl_bevestig_${NODE}`, null);
    wisRichtingLock();
    v9PreSelectieAfrij = null; preZet = null; preWis = null;
    richtingGedruktVoorNode = null;
    getoondeLaag = null; getoondDagdeel = null;
  };

  const bron = () => kiesCountdownBron(String(NODE), NU, AANRIJ, v9PreSelectieAfrij);
  const chipInBlok = () => {
    const b = document.getElementById('richting-blok-body');
    return b ? b.querySelector('.rb-koppel') : null;
  };

  try {
    huidigePos = { lat: 52.0, lon: 4.7 };
    huidigeRichting = 0; snelheidKmh = 0;
    osmCache = [{ id: NODE, lat: 52.0, lon: 4.7, naam: 'Teststraat' }];
    dichtstbijOSM = { ...osmCache[0], afstand: 15 };
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0;
    richtingBlokVerborgen = false; bevestigActief = false;

    // ═══ S1 — EEN OPGESLAGEN RICHTING STUURT NIETS MEER ══════
    wis();
    zetOpgeslagenRichting('rechts');
    zetV5(AANRIJ, AFRIJ, NU, 4, 25);     // de richting weet iets: 25s
    zetV4(NU, 6, 60);                    // het ronde licht weet meer: 60s
    // de app zou vroeger hier zelf de richting terugzetten; nu niet meer
    toonRichtingKnoppen(String(NODE));
    eis('S1 de app zet een eerder getikte richting niet meer zelf terug',
        richtingLockKeuze === null && richtingLockBron === null
          && v9PreSelectieAfrij === null,
        'geen lock, geen pre-selectie',
        [richtingLockKeuze, richtingLockBron, v9PreSelectieAfrij].join(', '));
    let r = bron();
    eis('S1b de countdown komt van het ronde licht (60s), niet van de richting (25s)',
        !!r && Math.round(r.gem) === 60 && r.v5 === false,
        '60s, geen V5', r ? Math.round(r.gem) + 's, v5=' + r.v5 : 'geen bron');

    // en nu exact hetzelfde kruispunt ZONDER opgeslagen richting
    const metRichting = JSON.stringify({ gem: Math.round(r.gem), bron: r.bron, v5: r.v5 });
    zetLS(`sl_richting_${NODE}`, null);
    wisRichtingLock(); v9PreSelectieAfrij = null; preZet = null;
    r = bron();
    eis('S1c het gedrag is identiek aan een kruispunt dat nooit een richting zag',
        JSON.stringify({ gem: Math.round(r.gem), bron: r.bron, v5: r.v5 }) === metRichting,
        metRichting, JSON.stringify({ gem: Math.round(r.gem), bron: r.bron, v5: r.v5 }));

    // ook als de pre-selectie via een herstelpad tóch gevuld zou raken:
    wis();
    zetOpgeslagenRichting('rechts');
    zetV5(AANRIJ, AFRIJ, NU, 4, 25);
    zetV4(NU, 6, 60);
    v9PreSelectieAfrij = AFRIJ;
    markeerPreZet(String(NODE), AFRIJ, 'hersteld');
    r = bron();
    eis('S1d een pre-selectie met herkomst "hersteld" wordt genegeerd',
        !!r && Math.round(r.gem) === 60 && r.v5 === false,
        '60s, geen V5', r ? Math.round(r.gem) + 's, v5=' + r.v5 : 'geen bron');
    eis('S1e en de poort die dat doet is dezelfde als die van V11.18.10',
        tikHerkomstEcht(String(NODE)) === false,
        'false', String(tikHerkomstEcht(String(NODE))));

    // ═══ S2 — EEN ECHTE TIK WERKT ONVERANDERD ════════════════
    wis();
    zetOpgeslagenRichting('rechts');
    zetV5(AANRIJ, AFRIJ, NU, 4, 25);
    zetV4(NU, 6, 60);
    richtingKnoppenNodeId = String(NODE);
    tikRichting('rechts', 'vraag');
    eis('S2 een tik zet de lock met herkomst "tik"',
        richtingLockKeuze === 'rechts' && richtingLockBron === 'tik'
          && String(richtingLockNodeId) === String(NODE),
        "rechts / tik / " + NODE,
        [richtingLockKeuze, richtingLockBron, richtingLockNodeId].join(' / '));
    eis('S2b en de herkomstpoort staat daarmee open',
        tikHerkomstEcht(String(NODE)) === true, 'true',
        String(tikHerkomstEcht(String(NODE))));
    r = bron();
    eis('S2c de countdown komt nu wél van de richting (25s)',
        !!r && Math.round(r.gem) === 25 && r.v5 === true
          && r.bron === 'V5 ' + v9PreSelectieAfrij,
        '25s uit de richting-emmer',
        r ? Math.round(r.gem) + 's, ' + r.bron : 'geen bron');
    eis('S2d en het schrijfrecht van V11.18.10 volgt dezelfde herkomst',
        !!bepaalGetikteAfrij(String(NODE), AANRIJ),
        'schrijven toegestaan', String(!!bepaalGetikteAfrij(String(NODE), AANRIJ)));

    // ═══ S3 — DE KEUZEKNOPPEN KOMEN TERUG ════════════════════
    wis();
    zetOpgeslagenRichting('rechts');
    zetV5(AANRIJ, AFRIJ, NU, 4, 25);
    zetV5('O', 'N', NU, 2, 30);          // tweede aanrij: de keuze is zinvol
    const knoppen = document.getElementById('richting-knoppen');
    if (knoppen) knoppen.style.display = 'none';
    toonRichtingKnoppen(String(NODE));
    eis('S3 op een bekend kruispunt verschijnen de keuzeknoppen weer',
        !!knoppen && knoppen.style.display === 'flex'
          && richtingKnoppenNodeId === String(NODE),
        'zichtbaar', knoppen ? knoppen.style.display : 'geen element');
    eis('S3b en er is niets stilletjes geactiveerd',
        richtingLockBron === null && v9PreSelectieAfrij === null,
        'geen lock, geen pre-selectie',
        [richtingLockBron, v9PreSelectieAfrij].join(', '));

    // ═══ S4 — DE RIJ BLIJFT ZICHTBAAR ════════════════════════
    wis();
    zetOpgeslagenRichting('rechts');
    zetV5(AANRIJ, AFRIJ, NU, 4, 25);
    zetV4(NU, 6, 60);
    renderRichtingBlok(dichtstbijOSM);
    const blok = document.getElementById('richting-blok-body');
    const rijen = blok ? blok.querySelectorAll('.rb-rij') : [];
    const algRij = blok ? blok.querySelector('.rb-rij[data-key="ALG"]') : null;
    eis('S4 de richting staat nog gewoon als rij in het blok',
        rijen.length >= 2, '2 of meer rijen', String(rijen.length));
    eis('S4b en het ronde licht is de actieve rij',
        !!algRij && algRij.className.indexOf('actief') >= 0,
        'ALG actief', algRij ? algRij.className : 'geen ALG-rij');

    // ═══ S5 — DE CHIP IS WEG ═════════════════════════════════
    eis('S5 zonder tik staat er geen koppel-chip',
        chipInBlok() === null, 'geen chip',
        chipInBlok() ? chipInBlok().textContent : 'geen chip');
    richtingKnoppenNodeId = String(NODE);
    tikRichting('rechts', 'vraag');
    renderRichtingBlok(dichtstbijOSM);
    eis('S5b en NA een tik — het geval waarover drie keer geklaagd is — ook niet',
        chipInBlok() === null, 'geen chip',
        chipInBlok() ? chipInBlok().textContent : 'geen chip');
    // Op de FUNCTIE toetsen en niet op het hele script: de toelichting bij de
    // verwijdering noemt de oude chiptekst letterlijk, en die mag er staan.
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('S5c het aanbod bestaat nergens meer in de code',
        typeof koppelEnkelRicht === 'undefined'
          && !/zelfde als/.test(zc(renderRichtingBlok))
          && !/koppelchip_getoond/.test(zc(renderRichtingBlok)),
        'geen chip, geen chiplog', 'weg');

    // de ✕ van een bestaande koppeling blijft
    zetLS(`sl_enkelricht_${NODE}`, 'rechts');
    renderRichtingBlok(dichtstbijOSM);
    const kruis = chipInBlok();
    eis('S5d een BESTAANDE koppeling houdt zijn ✕ om los te maken',
        !!kruis && kruis.textContent === '✕'
          && kruis.className.indexOf('gekoppeld') >= 0,
        '✕', kruis ? kruis.textContent : 'geen ✕');
    verwijderEnkelRicht(String(NODE));
    eis('S5e en die ✕ maakt de koppeling daadwerkelijk los',
        laadEnkelRicht(String(NODE)) == null, 'geen koppeling',
        String(laadEnkelRicht(String(NODE))));
    // en koppelen via het paneel werkt nog
    koppelVanuitPaneel(String(NODE), 'rechts');
    eis('S5f koppelen kan nog steeds bewust, via het node-info-paneel',
        laadEnkelRicht(String(NODE)) === 'rechts', 'rechts',
        String(laadEnkelRicht(String(NODE))));
    zetLS(`sl_enkelricht_${NODE}`, null);

    // ═══ S6 — REGRESSIE ══════════════════════════════════════
    wis();
    zetOpgeslagenRichting('rechts');
    zetV5(AANRIJ, AFRIJ, NU, 1, 30);
    const ANDER_DD = Object.keys(DD).find(d => d !== NU);
    zetV5(AANRIJ, AFRIJ, ANDER_DD, 12, 62);
    richtingKnoppenNodeId = String(NODE);
    tikRichting('rechts', 'vraag');
    r = bron();
    eis('S6 de dagdeel-lening van V11.18.13 werkt onveranderd na een tik',
        !!r && r.ddGeleend === true && r.metingen === 13,
        'geleend, 13 metingen',
        r ? [r.ddGeleend, r.metingen].join(', ') : 'geen bron');
    eis('S6b de schrijfpoort van V11.18.10 staat er nog, op dezelfde plek',
        /tikHerkomstEcht\(nodeId\)/.test(String(bepaalGetikteAfrij))
          && /tikHerkomstEcht\(nodeId\)/.test(String(kiesCountdownBron)),
        'in beide functies', 'aanwezig');
    eis('S6c markeerPreZet normaliseert nog steeds naar tik of hersteld',
        (markeerPreZet(String(NODE), AFRIJ, 'tik'), preZet.bron === 'tik')
          && (markeerPreZet(String(NODE), AFRIJ, 'wat dan ook'), preZet.bron === 'hersteld'),
        'tik / hersteld', preZet.bron);
    eis('S6d activeerPersistenteRichting bestaat niet meer',
        typeof activeerPersistenteRichting === 'undefined',
        'weg', typeof activeerPersistenteRichting);

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos; huidigeRichting = bewaard.huidigeRichting;
    snelheidKmh = bewaard.snelheidKmh;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockBron = bewaard.richtingLockBron;
    richtingGedruktVoorNode = bewaard.richtingGedruktVoorNode;
    richtingKnoppenNodeId = bewaard.richtingKnoppenNodeId;
    preZet = bewaard.preZet; preWis = bewaard.preWis;
    getoondeLaag = bewaard.getoondeLaag; getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    bevestigActief = bewaard.bevestigActief;
    richtingTikTijd = bewaard.richtingTikTijd;
    richtingTikElement = bewaard.richtingTikElement;
    const b = document.getElementById('richting-blok-body');
    if (b) b.innerHTML = bewaard.blokHtml;
    const k = document.getElementById('richting-knoppen');
    if (k && bewaard.knoppenDisplay !== null) k.style.display = bewaard.knoppenDisplay;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRondStandaard = testRondStandaard;
