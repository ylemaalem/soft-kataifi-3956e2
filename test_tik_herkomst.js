// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tik_herkomst.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.11, deel 1: elke richting-tik legt vast welk element werd
//  aangeraakt, en elke logregel draagt de herkomst van de lock.
//
//  WAAROM DEZE METING BESTAAT
//  De koppel-chip ('zelfde als →?') verschijnt alleen na tikRichting. De
//  gebruiker ziet hem op momenten dat hij zegt niet getikt te hebben. Twee
//  verklaringen passen op de code — een verse (mis)tik, of een oude tik die
//  bleef hangen — en de export kon ze niet scheiden. Deze meting kan dat wel.
//
//  T1  de drie ingangen loggen elk hun eigen element
//  T2  lockBron en tikLeeft staan op elke logregel
//  T3  de chip zelf logt één keer per getoonde chip, niet per tekenronde
//  T4  REGRESSIE: geen enkele vergrendel- of schrijfregel veranderde
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tik_herkomst.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testTikHerkomst().regels);
// ═══════════════════════════════════════════════════════════════

function testTikHerkomst() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const NODE = 888201;
  const DD = huidigDDActief();

  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos, huidigeRichting, snelheidKmh, fase,
    richtingKnoppenNodeId, huidigBevestigdOsmNodeId, richtingGedruktVoorNode,
    richtingLockKeuze, richtingLockNodeId, richtingLockBron,
    richtingTikTijd, richtingTikElement,
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij, preZet, preWis,
    getoondeLaag, getoondDagdeel, richtingBlokVerborgen, laatsteRichtingRijen,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML
  };
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };
  const regelsVan = (reden) => {
    try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r && r.reden === reden); }
    catch (e) { return []; }
  };
  const laatste = (reden) => { const r = regelsVan(reden); return r.length ? r[r.length - 1] : null; };

  const nu = Date.now();
  const opzet = () => {
    zetLS('sl_opslaglog', '[]');
    zetLS('sl_richting_' + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);
    zetLS('sl_neutraal_' + NODE, null);
    for (const k of Object.keys(localStorage)) if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
    // V4-data zodat het rijblok een ronde-lichtregel en toevoegknoppen tekent
    zetLS('sl_v4_' + NODE + '_' + DD, JSON.stringify(
      [0, 1, 2].map(i => ({ duur: 40, tijd: nu - i * 60000, gewicht: 1, obs: 40, bron: 's1' }))));
    huidigePos = { lat: 52.0, lon: 4.7 }; huidigeRichting = 0; snelheidKmh = 0; fase = null;
    osmCache = [{ id: NODE, lat: 52.0, lon: 4.7, naam: 'Tikstraat', afstand: 10 }];
    dichtstbijOSM = { ...osmCache[0] };
    richtingKnoppenNodeId = String(NODE); huidigBevestigdOsmNodeId = String(NODE);
    richtingGedruktVoorNode = null;
    richtingLockKeuze = null; richtingLockNodeId = null; richtingLockBron = null;
    richtingTikTijd = 0; richtingTikElement = null;
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0; v9PreSelectieAfrij = null;
    preZet = null; preWis = null;
    getoondeLaag = null; getoondDagdeel = null; richtingBlokVerborgen = false;
  };

  try {
    // ═══ T1 — DE DRIE INGANGEN ═══════════════════════════════
    opzet();
    tikRichting('links', 'vraag');
    let r = laatste('richting_tik');
    eis('T1 de "Welke kant ga jij op?"-knop logt element "vraag"',
        r && r.element === 'vraag' && r.node === String(NODE) && r.tik === 'links',
        "vraag, node, links", r ? (r.element + ', ' + r.node + ', ' + r.tik) : 'geen regel');
    eis('T1a de regel draagt lockBron "tik" en een verse tikLeeft',
        r && r.lockBron === 'tik' && typeof r.tikLeeft === 'number' && r.tikLeeft < 1000,
        "'tik', < 1s", r ? (r.lockBron + ', ' + r.tikLeeft) : 'geen regel');

    // de toevoegknop, via een ECHTE klik op de gerenderde knop
    opzet();
    renderRichtingBlok(dichtstbijOSM);
    const tv = [...document.querySelectorAll('#richting-blok-body .rb-tv-btn')]
      .find(b => b.textContent.includes('Rechtsaf'));
    eis('T1b vooraf: er staat een toevoegknop Rechtsaf in het rijblok',
        !!tv, 'knop aanwezig', tv ? 'aanwezig' : 'ONTBREEKT');
    if (tv) tv.click();
    r = laatste('richting_tik');
    eis('T1c een klik op de toevoegknop logt element "toevoeg"',
        r && r.element === 'toevoeg' && r.tik === 'rechts',
        "toevoeg, rechts", r ? (r.element + ', ' + r.tik) : 'geen regel');

    // een bestaande richting-rij
    opzet();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD, JSON.stringify([{ duur: 28, tijd: nu, gewicht: 1, bron: 'tik' }]));
    zetLS('sl_richting_' + NODE, JSON.stringify({ headings: [0, 1, 2, 1, 0], laatste_update: nu, bevestigingen: 5 }));
    renderRichtingBlok(dichtstbijOSM);
    const rijIdx = laatsteRichtingRijen.findIndex(x => x.richt === 'rechts');
    eis('T1d vooraf: er staat een richting-rij Rechtsaf',
        rijIdx >= 0, 'rij aanwezig', String(rijIdx));
    if (rijIdx >= 0) kiesLaagRichting(rijIdx);
    r = laatste('richting_tik');
    eis('T1e een tik op een richting-rij logt element "rij"',
        r && r.element === 'rij' && r.tik === 'rechts',
        "rij, rechts", r ? (r.element + ', ' + r.tik) : 'geen regel');

    // een ongelabelde aanroep valt op
    opzet();
    tikRichting('rechtdoor');
    r = laatste('richting_tik');
    eis('T1f een aanroep zonder element logt "onbekend"',
        r && r.element === 'onbekend', 'onbekend', r ? String(r.element) : 'geen regel');

    // ═══ T2 — LOCKBRON EN TIKLEEFT OP ELKE REGEL ═════════════
    opzet();
    zetLS('sl_richting_' + NODE, JSON.stringify({ tikrichting: 'links', tik_bevestigingen: 3,
      headings: [0], laatste_update: nu, bevestigingen: 3 }));
    toonRichtingKnoppen(String(NODE));
    // V11.18.18: de app zet een opgeslagen richting niet meer zelf terug, dus
    // deze toestand ontstaat nergens meer vanzelf. Het LOGVELD moet hem wel
    // blijven kunnen dragen — een export van vóór die release bevat hem — dus
    // wordt hij hier met de hand gezet.
    richtingLockNodeId = String(NODE);
    richtingLockKeuze = 'links';
    richtingLockBron = 'hersteld';
    logOpslagMis('kandidaat_verlaten', { node: String(NODE) });
    r = laatste('kandidaat_verlaten');
    eis('T2 een lock met herkomst "hersteld" komt zo in elke logregel terecht',
        r && r.lockBron === 'hersteld' && r.tikLeeft === null,
        "'hersteld', tikLeeft null", r ? (r.lockBron + ', ' + r.tikLeeft) : 'geen regel');

    opzet();
    tikRichting('rechts', 'vraag');
    richtingTikTijd = Date.now() - 1800000;               // de tik is een half uur oud
    logOpslagMis('kandidaat_verlaten', { node: String(NODE) });
    r = laatste('kandidaat_verlaten');
    eis('T2b een blijvende tik is aan tikLeeft te herkennen',
        r && r.lockBron === 'tik' && r.tikLeeft >= 1799000,
        "'tik', ~1.800.000 ms", r ? (r.lockBron + ', ' + r.tikLeeft) : 'geen regel');

    opzet();
    logOpslagMis('kandidaat_verlaten', { node: String(NODE) });
    r = laatste('kandidaat_verlaten');
    eis('T2c zonder lock zijn lockBron, tikLeeft en element null',
        r && r.lockBron === null && r.tikLeeft === null && r.element === null,
        'null, null, null', r ? [r.lockBron, r.tikLeeft, r.element].join(', ') : 'geen regel');

    // ═══ T3 — DE CHIP BESTAAT NIET MEER ══════════════════════
    // ── V11.18.18: OMGEDRAAID, EN DAT IS DE BEDOELING ───────
    // T3 t/m T3d maten hoe vaak de koppel-chip werd getoond en gelogd. Dat was
    // een MEETrelease: de vraag was of een gemelde chip van een verse of een
    // oude tik kwam. Die vraag is vervallen doordat het aanbod zelf verdwenen
    // is — rond licht is een eigen categorie geworden. Wat blijft is de eis dat
    // hij nergens meer opduikt, in geen van de scenario's die hem vroeger gaven.
    opzet();
    tikRichting('rechts', 'toevoeg');
    renderRichtingBlok(dichtstbijOSM);
    renderRichtingBlok(dichtstbijOSM);
    eis('T3 na een tik staat er geen koppelaanbod meer in het rijblok',
        document.querySelector('#richting-blok-body .rb-koppel') === null,
        'geen chip', 'geen chip');
    eis('T3b en er wordt ook niets meer over gelogd',
        regelsVan('koppelchip_getoond').length === 0,
        '0 regels', String(regelsVan('koppelchip_getoond').length));
    tikRichting('links', 'vraag');
    richtingTikTijd += 1;
    renderRichtingBlok(dichtstbijOSM);
    eis('T3c ook niet na een tweede, verse tik',
        document.querySelector('#richting-blok-body .rb-koppel') === null
          && regelsVan('koppelchip_getoond').length === 0,
        'geen chip, 0 regels', String(regelsVan('koppelchip_getoond').length));

    // en een opgeslagen richting wordt sinds V11.18.18 niet meer teruggezet
    opzet();
    zetLS('sl_richting_' + NODE, JSON.stringify({ tikrichting: 'links', tik_bevestigingen: 3,
      headings: [0], laatste_update: nu, bevestigingen: 3 }));
    toonRichtingKnoppen(String(NODE));
    renderRichtingBlok(dichtstbijOSM);
    eis('T3d een bekend kruispunt activeert niets uit zichzelf',
        richtingLockBron === null && v9PreSelectieAfrij === null
          && document.querySelector('#richting-blok-body .rb-koppel') === null,
        'geen lock, geen chip',
        [richtingLockBron, v9PreSelectieAfrij].join(', '));

    // ═══ T4 — REGRESSIE: NIETS AAN HET GEDRAG ════════════════
    opzet();
    tikRichting('rechts', 'vraag');
    eis('T4 tikRichting zet lock, bron en pre-selectie precies als voorheen',
        richtingLockKeuze === 'rechts' && richtingLockNodeId === String(NODE)
          && richtingLockBron === 'tik' && v9PreSelectieAfrij === 'W'
          && richtingGedruktVoorNode === String(NODE),
        "rechts, node, tik, W", [richtingLockKeuze, richtingLockNodeId, richtingLockBron,
          v9PreSelectieAfrij].join(', '));
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T4b wisRichtingLock, lockGeldigVoor en rijrichtingVoor lezen de meetregisters niet',
        !/richtingTikTijd|richtingTikElement/.test(zc(wisRichtingLock) + zc(lockGeldigVoor) + zc(rijrichtingVoor)),
        'niet gelezen', 'schoon');
    eis('T4c de schrijfpoort van V11.18.10 leest ze evenmin',
        !/richtingTikTijd|richtingTikElement/.test(zc(tikHerkomstEcht) + zc(bepaalGetikteAfrij)),
        'niet gelezen', 'schoon');

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos; huidigeRichting = bewaard.huidigeRichting;
    snelheidKmh = bewaard.snelheidKmh; fase = bewaard.fase;
    richtingKnoppenNodeId = bewaard.richtingKnoppenNodeId;
    huidigBevestigdOsmNodeId = bewaard.huidigBevestigdOsmNodeId;
    richtingGedruktVoorNode = bewaard.richtingGedruktVoorNode;
    richtingLockKeuze = bewaard.richtingLockKeuze; richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingLockBron = bewaard.richtingLockBron;
    richtingTikTijd = bewaard.richtingTikTijd; richtingTikElement = bewaard.richtingTikElement;
    v9AanrijHeading = bewaard.v9AanrijHeading; v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij; preZet = bewaard.preZet; preWis = bewaard.preWis;
    getoondeLaag = bewaard.getoondeLaag; getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    laatsteRichtingRijen = bewaard.laatsteRichtingRijen;
    const bb = document.getElementById('richting-blok-body');
    if (bb) bb.innerHTML = bewaard.blokHtml;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testTikHerkomst = testTikHerkomst;
