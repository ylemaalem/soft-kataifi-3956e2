// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_node_vermoeden.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.12: de app waarschuwt zichtbaar zodra een ander stoplicht
//  aantoonbaar dichterbij ligt dan de actieve keuze — ook tijdens een
//  handmatige vergrendeling.
//
//  WAAROM DEZE LAAG BESTAAT
//  De bestaande twijfel-markering eist 25 m verschil; de elf gemeten episodes
//  van 12 september hebben een mediaan van 7,5 m. Eén van de twintig
//  afwijkingen haalde die drempel. En na een echte tap zweeg de app volledig.
//  Deze laag verandert niets aan de keuze — ze vertelt alleen wat de app ziet.
//
//  V1  TRIGGER 1 (afstand): >= 8 m verschil bij stilstand, in alle drie de
//      lock-toestanden
//  V2  TRIGGER 2 (hoek): het gemeten 0-meter-geval, in alle drie de
//      lock-toestanden — dit is de tak die de open auto-lock-episodes dekt
//  V3  de markering gaat aan en weer uit, en de toast draagt het juiste getal
//  V4  throttle: één melding per episode, herhaling pas na 60 s
//  V5  cluster: geen tweede toast over hetzelfde fysieke kruispunt
//  V6  is de melding opgevolgd? ('vermoeden_gevolgd')
//  V7  REGRESSIE: geen letter aan de keuze, de hysterese, de correctiemarge,
//      de vervalregels of het bestaande twijfel-veld
//
//  DE TWEE FIXTURES, DOORGEREKEND
//  afstand: actieve node 30 m pal noord, andere 18 m pal oost -> verschil 12.
//           Het verschil is >5, dus de hoekroute weigert per constructie
//           ('afst_ongelijk') en wat vuurt kan alleen trigger 1 zijn.
//  hoek:    beide nodes op 22 m, de actieve 49 graden uit de rijrichting, de
//           andere 17 — het geval uit de export van 3 september (r6303).
//           Verschil 0, dus trigger 1 kan per constructie niet vuren en wat
//           meldt kan alleen de hoekroute zijn.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_node_vermoeden.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testNodeVermoeden().regels);
// ═══════════════════════════════════════════════════════════════

function testNodeVermoeden() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const LAT = 52.0, LON = 4.7;
  const GEK = 771001, DIC = 771002;

  // meters -> graden, op 52 graden noorderbreedte
  const naarPunt = (peiling, meters) => {
    const rad = peiling * Math.PI / 180;
    return {
      lat: LAT + (meters * Math.cos(rad)) / 111320,
      lon: LON + (meters * Math.sin(rad)) / (111320 * Math.cos(LAT * Math.PI / 180))
    };
  };

  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos, huidigeRichting, snelheidKmh,
    stilstandSinds, handmatigLockActief, stilstandAutoLock,
    handmatigGeselecteerdNodeId, handmatigGeselecteerdTimestamp,
    puurDichtsteNodeCache, dichtstbijOSMTwijfel, nodeVermoedenActief,
    vermoedenSleutel, vermoedenTijd, vermoedenHoekSleutel, vermoedenHoekTeller,
    vermoedenLaatste, hoekStabielSleutel, hoekStabielTeller, peilingWeigerReden,
    clusterNodes: new Set(clusterNodes), headingBuffer: [...headingBuffer],
    vorigOsmId, activeCdDoel, activeCdModus, fase, faseBevestigd, faseStart, cdStart,
    richtingBlokVerborgen, nodeCorrWeiger,
    twijfelKlasse: kNaam ? kNaam.classList.contains('twijfel') : false,
    toastTxt: (document.getElementById('leer-toast') || {}).textContent,
    toastCls: document.getElementById('leer-toast')
      ? document.getElementById('leer-toast').className : ''
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
  const toast = () => document.getElementById('leer-toast');
  const gemarkeerd = () => !!(kNaam && kNaam.classList.contains('twijfel'));

  // gekozenPeiling/gekozenAf = de ACTIEVE node, dicht* = de werkelijk dichtste
  const opzet = (gekozenPeiling, gekozenAf, dichtPeiling, dichtAf, lock) => {
    zetLS('sl_opslaglog', '[]');
    const g = naarPunt(gekozenPeiling, gekozenAf), d = naarPunt(dichtPeiling, dichtAf);
    huidigePos = { lat: LAT, lon: LON };
    huidigeRichting = 0;
    headingBuffer.length = 0; headingBuffer.push(0, 0, 0);
    osmCache = [{ id: GEK, lat: g.lat, lon: g.lon, naam: 'Gekozen' },
                { id: DIC, lat: d.lat, lon: d.lon, naam: 'Dichterbij' }];
    dichtstbijOSM = { ...osmCache[0], afstand: afstand(LAT, LON, g.lat, g.lon) };
    puurDichtsteNodeCache = { ...osmCache[1], afstand: afstand(LAT, LON, d.lat, d.lon) };
    snelheidKmh = 0;
    stilstandSinds = Date.now() - 10000;
    handmatigLockActief = (lock === 'hand' || lock === 'auto');
    stilstandAutoLock   = (lock === 'auto');
    handmatigGeselecteerdNodeId = handmatigLockActief ? String(GEK) : null;
    handmatigGeselecteerdTimestamp = Date.now();
    dichtstbijOSMTwijfel = false;
    nodeVermoedenActief = false;
    vermoedenSleutel = null; vermoedenTijd = 0;
    vermoedenHoekReset(); vermoedenLaatste = null;
    hoekStabielSleutel = null; hoekStabielTeller = 0;
    clusterNodes = new Set();
    if (kNaam) kNaam.classList.remove('twijfel');
    if (toast()) { toast().textContent = ''; toast().className = ''; }
  };
  // De hoekroute eist NODE_HOEK_STABIEL_N (3) bevestigingen op rij.
  const ticks = (n) => { for (let i = 0; i < n; i++) meldNodeVermoeden(LAT, LON); };

  try {
    // ═══ V1 — TRIGGER 1: AFSTANDSBEWIJS ══════════════════════
    opzet(0, 30, 90, 18, 'vrij');
    eis('V1a vooraf: de fixture geeft ~12 m verschil en is te ongelijk voor de hoekroute',
        Math.round(dichtstbijOSM.afstand - puurDichtsteNodeCache.afstand) === 12
          && Math.abs(dichtstbijOSM.afstand - puurDichtsteNodeCache.afstand) > NODE_HOEK_GELIJK_M,
        '12 m, > 5 m',
        Math.round(dichtstbijOSM.afstand) + ' vs ' + Math.round(puurDichtsteNodeCache.afstand));
    meldNodeVermoeden(LAT, LON);
    let r = laatste('node_vermoeden');
    eis('V1 zonder lock meldt de app een node die 12 m dichterbij ligt',
        !!r && r.vermRoute === 'afstand' && r.afwM === 12 && r.node === String(GEK)
          && r.hand === false && r.autoLock === false,
        "afstand, 12, geen lock", r ? [r.vermRoute, r.afwM, r.hand, r.autoLock].join(', ') : 'geen regel');

    opzet(0, 30, 90, 18, 'hand');
    meldNodeVermoeden(LAT, LON);
    r = laatste('node_vermoeden');
    eis('V1b OOK tijdens een echte handmatige tap — de beleidswijziging',
        !!r && r.vermRoute === 'afstand' && r.hand === true && r.autoLock === false,
        'melding, hand=1 auto=0', r ? [r.vermRoute, r.hand, r.autoLock].join(', ') : 'GEEN MELDING');

    opzet(0, 30, 90, 18, 'auto');
    meldNodeVermoeden(LAT, LON);
    r = laatste('node_vermoeden');
    eis('V1c en tijdens de stilstand-auto-lock',
        !!r && r.vermRoute === 'afstand' && r.hand === true && r.autoLock === true,
        'melding, hand=1 auto=1', r ? [r.vermRoute, r.hand, r.autoLock].join(', ') : 'GEEN MELDING');

    // de poorten van trigger 1
    opzet(0, 30, 90, 24, 'vrij');       // verschil 6 < 8
    meldNodeVermoeden(LAT, LON);
    eis('V1d onder de 8 m zwijgt de app — buurlampen van dezelfde kruising',
        regelsVan('node_vermoeden').length === 0 && !gemarkeerd(),
        '0 regels, geen markering',
        regelsVan('node_vermoeden').length + ' regels, markering=' + gemarkeerd());

    opzet(0, 30, 90, 18, 'vrij');
    snelheidKmh = 6;                    // boven NODE_HOEK_KMH
    meldNodeVermoeden(LAT, LON);
    eis('V1e rijdend meldt hij niets — daar kun je toch niets mee',
        regelsVan('node_vermoeden').length === 0, '0 regels',
        String(regelsVan('node_vermoeden').length));

    opzet(0, 30, 90, 18, 'vrij');
    stilstandSinds = Date.now() - 1000;  // korter dan 3 s
    meldNodeVermoeden(LAT, LON);
    eis('V1f en pas na 3 seconden stilstand',
        regelsVan('node_vermoeden').length === 0, '0 regels',
        String(regelsVan('node_vermoeden').length));

    opzet(0, 30, 0, 30, 'vrij');
    puurDichtsteNodeCache = { ...osmCache[0], afstand: dichtstbijOSM.afstand };
    meldNodeVermoeden(LAT, LON);
    eis('V1g staat de goede node al actief, dan is er niets te melden',
        regelsVan('node_vermoeden').length === 0 && !gemarkeerd(),
        '0 regels, geen markering',
        regelsVan('node_vermoeden').length + ' regels, markering=' + gemarkeerd());

    // ═══ V2 — TRIGGER 2: HOEKBEWIJS BIJ 0 METER ══════════════
    opzet(49, 22, 17, 22, 'vrij');
    eis('V2a vooraf: het gemeten geval — beide 22 m, verschil 0, 32 graden voordeel',
        Math.round(dichtstbijOSM.afstand - puurDichtsteNodeCache.afstand) === 0
          && Math.abs(peilingTovRijrichting(huidigePos, dichtstbijOSM, 0))
             - Math.abs(peilingTovRijrichting(huidigePos, puurDichtsteNodeCache, 0)) >= NODE_HOEK_VOORDEEL_GRAD,
        '0 m, >= 25 graden',
        Math.round(dichtstbijOSM.afstand) + 'm/' + Math.round(puurDichtsteNodeCache.afstand) + 'm, '
          + peilingTovRijrichting(huidigePos, dichtstbijOSM, 0) + ' vs '
          + peilingTovRijrichting(huidigePos, puurDichtsteNodeCache, 0) + ' graden');
    meldNodeVermoeden(LAT, LON);
    eis('V2b één tick is niet genoeg — drie op rij, net als de correctie',
        regelsVan('node_vermoeden').length === 0, '0 regels',
        String(regelsVan('node_vermoeden').length));
    ticks(2);
    r = laatste('node_vermoeden');
    eis('V2 na drie ticks meldt de app het 0-meter-geval dat geen afstandsdrempel ooit ziet',
        !!r && r.vermRoute === 'hoek' && r.afwM === 0
          && r.hand === false && r.autoLock === false,
        'hoek, 0, geen lock', r ? [r.vermRoute, r.afwM, r.hand, r.autoLock].join(', ') : 'GEEN MELDING');

    opzet(49, 22, 17, 22, 'hand');
    ticks(3);
    r = laatste('node_vermoeden');
    eis('V2c hetzelfde geval tijdens een handmatige tap',
        !!r && r.vermRoute === 'hoek' && r.hand === true && r.autoLock === false,
        'hoek, hand=1 auto=0', r ? [r.vermRoute, r.hand, r.autoLock].join(', ') : 'GEEN MELDING');

    opzet(49, 22, 17, 22, 'auto');
    ticks(3);
    r = laatste('node_vermoeden');
    eis('V2d en tijdens de auto-lock — de twee open episodes van 12 september',
        !!r && r.vermRoute === 'hoek' && r.hand === true && r.autoLock === true,
        'hoek, hand=1 auto=1', r ? [r.vermRoute, r.hand, r.autoLock].join(', ') : 'GEEN MELDING');

    opzet(30, 22, 17, 22, 'vrij');      // 13 graden voordeel, te weinig
    ticks(3);
    eis('V2e een klein hoekverschil is ruis en meldt niets',
        regelsVan('node_vermoeden').length === 0, '0 regels',
        String(regelsVan('node_vermoeden').length));

    opzet(49, 10, 17, 10, 'vrij');      // beide onder 12 m
    ticks(3);
    eis('V2f vlak voor de lampen is de peiling ruis — geen melding',
        regelsVan('node_vermoeden').length === 0, '0 regels',
        String(regelsVan('node_vermoeden').length));

    // ═══ V3 — MARKERING EN TOAST ═════════════════════════════
    opzet(0, 30, 90, 18, 'vrij');
    meldNodeVermoeden(LAT, LON);
    eis('V3 de bestaande oranje markering gaat aan',
        gemarkeerd(), 'klasse twijfel', String(gemarkeerd()));
    eis('V3b de toast noemt het exacte verschil en is de waarschuwingsvariant',
        toast().textContent === '⚠ Ander stoplicht ligt 12m dichterbij — tik op de naam'
          && toast().classList.contains('waarschuwing') && toast().classList.contains('zichtbaar'),
        '⚠ … 12m dichterbij …', toast().textContent + ' | ' + toast().className);
    // Het bewijs valt weg. De node moet echt VERHUIZEN: meldNodeVermoeden
    // rekent de afstanden vers uit lat/lon, net als checkHandLockVerval, dus
    // alleen het veld .afstand aanpassen verandert niets.
    const dichtbij28 = naarPunt(90, 28);
    puurDichtsteNodeCache = { id: DIC, lat: dichtbij28.lat, lon: dichtbij28.lon,
                              naam: 'Dichterbij', afstand: 28 };
    meldNodeVermoeden(LAT, LON);
    eis('V3c zodra het bewijs wegvalt gaat de markering weer uit',
        !gemarkeerd(), 'geen klasse', String(gemarkeerd()));

    opzet(49, 22, 17, 22, 'vrij');
    ticks(3);
    eis('V3d de hoekmelding zegt niet "0m dichterbij" maar wat er werkelijk aan de hand is',
        toast().textContent === '⚠ Ander stoplicht staat rechter vooruit — tik op de naam',
        '⚠ … staat rechter vooruit …', toast().textContent);

    // ═══ V4 — ÉÉN MELDING PER EPISODE ════════════════════════
    opzet(0, 30, 90, 18, 'vrij');
    ticks(5);
    eis('V4 vijf ticks met dezelfde afwijking geven één melding',
        regelsVan('node_vermoeden').length === 1, '1',
        String(regelsVan('node_vermoeden').length));
    eis('V4b maar de markering blijft al die tijd staan',
        gemarkeerd(), 'klasse twijfel', String(gemarkeerd()));
    vermoedenTijd = Date.now() - 61000;   // een minuut verder
    meldNodeVermoeden(LAT, LON);
    eis('V4c na 60 seconden meldt hij opnieuw',
        regelsVan('node_vermoeden').length === 2, '2',
        String(regelsVan('node_vermoeden').length));
    vermoedenTijd = Date.now() - 30000;   // korter dan de termijn
    meldNodeVermoeden(LAT, LON);
    eis('V4d na 30 seconden nog niet',
        regelsVan('node_vermoeden').length === 2, '2',
        String(regelsVan('node_vermoeden').length));

    // ═══ V5 — CLUSTER ════════════════════════════════════════
    opzet(0, 30, 90, 18, 'vrij');
    clusterNodes = new Set([String(GEK)]);
    meldNodeVermoeden(LAT, LON);
    r = laatste('node_vermoeden');
    eis('V5 op een cluster-node verschijnt geen tweede toast',
        toast().textContent === '' && !toast().classList.contains('zichtbaar'),
        'geen toast', toast().textContent || '(leeg)');
    eis('V5b maar de markering en de logregel blijven — anders valt die groep uit de meting',
        gemarkeerd() && !!r && r.vermCluster === 1,
        'markering + vermCluster=1',
        gemarkeerd() + ', vermCluster=' + (r ? r.vermCluster : 'geen regel'));

    // ═══ V6 — IS DE MELDING OPGEVOLGD? ═══════════════════════
    opzet(0, 30, 90, 18, 'vrij');
    meldNodeVermoeden(LAT, LON);
    eis('V6a de melding onthoudt welke node ze aanwees',
        !!vermoedenLaatste && vermoedenLaatste.node === String(DIC),
        String(DIC), vermoedenLaatste ? vermoedenLaatste.node : 'niets onthouden');
    try { selecteerNodeHandmatig(String(DIC)); } catch (e) { /* zie V6b */ }
    r = laatste('vermoeden_gevolgd');
    eis('V6 tikt de gebruiker daarna die node aan, dan legt de app dat vast',
        !!r && r.node === String(DIC) && typeof r.dur === 'number',
        'regel met node en dur', r ? (r.node + ', ' + r.dur + 's') : 'geen regel');

    zetLS('sl_opslaglog', '[]');
    vermoedenLaatste = { node: String(DIC), tijd: Date.now() - 300000 };   // 5 min oud
    try { selecteerNodeHandmatig(String(DIC)); } catch (e) {}
    eis('V6c een tap lang na de melding telt niet meer als gevolg',
        regelsVan('vermoeden_gevolgd').length === 0, '0 regels',
        String(regelsVan('vermoeden_gevolgd').length));

    // ═══ V7 — REGRESSIE ══════════════════════════════════════
    eis('V7 NODE_CHK_DELTA_M staat nog op 25 — het bestaande twijfel-veld verandert niet',
        NODE_CHK_DELTA_M === 25 && NODE_CHK_STANDSTILL_MAX_M === 40,
        '25 / 40', NODE_CHK_DELTA_M + ' / ' + NODE_CHK_STANDSTILL_MAX_M);

    opzet(0, 30, 90, 18, 'hand');
    meldNodeVermoeden(LAT, LON);
    r = laatste('node_vermoeden');
    eis('V7b en de logregel draagt twijfel=false: het oude signaal is niet meegegroeid',
        dichtstbijOSMTwijfel === false && !!r && r.twijfel === false,
        'false / false', dichtstbijOSMTwijfel + ' / ' + (r ? r.twijfel : 'geen regel'));
    eis('V7c de keuze en de lock zijn onaangeroerd',
        String(dichtstbijOSM.id) === String(GEK) && handmatigLockActief === true
          && stilstandAutoLock === false
          && String(handmatigGeselecteerdNodeId) === String(GEK),
        'node GEK, hand-lock intact',
        dichtstbijOSM.id + ', hand=' + handmatigLockActief + ', auto=' + stilstandAutoLock);

    opzet(49, 22, 17, 22, 'auto');
    hoekStabielSleutel = 'iets'; hoekStabielTeller = 0;
    ticks(3);
    eis('V7d de stabiliteitsteller van de correctie telt niet mee met deze laag',
        hoekStabielTeller === 0 && hoekStabielSleutel === 'iets'
          && vermoedenHoekTeller === 3,
        'correctie 0, eigen teller 3',
        'correctie=' + hoekStabielTeller + ', eigen=' + vermoedenHoekTeller);

    peilingWeigerReden = 'gemarkeerd';
    meldNodeVermoeden(LAT, LON);
    eis('V7e en peilingWeigerReden blijft staan zoals de correctie hem achterliet',
        peilingWeigerReden === 'gemarkeerd', 'gemarkeerd', String(peilingWeigerReden));

    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('V7f de correctie- en vervalregels lezen deze laag niet',
        !/nodeVermoedenActief|vermoedenHoek|vermoedenSleutel|meldNodeVermoeden/
          .test(zc(checkNodeCorrectieStilstand) + zc(checkHandLockVerval)
                + zc(berekenNodeChkTwijfel) + zc(vindDichtbij)),
        'niet gelezen', 'schoon');
    eis('V7g en de melding zelf kiest, corrigeert en vergrendelt niets',
        !/vindDichtbij|corrigeerNodeAutomatisch|handmatigLockActief\s*=|stilstandAutoLock\s*=|dichtstbijOSM\s*=|beeindigFase/
          .test(zc(meldNodeVermoeden)),
        'geen enkele schrijfactie', 'schoon');

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos; huidigeRichting = bewaard.huidigeRichting;
    snelheidKmh = bewaard.snelheidKmh; stilstandSinds = bewaard.stilstandSinds;
    handmatigLockActief = bewaard.handmatigLockActief; stilstandAutoLock = bewaard.stilstandAutoLock;
    handmatigGeselecteerdNodeId = bewaard.handmatigGeselecteerdNodeId;
    handmatigGeselecteerdTimestamp = bewaard.handmatigGeselecteerdTimestamp;
    puurDichtsteNodeCache = bewaard.puurDichtsteNodeCache;
    dichtstbijOSMTwijfel = bewaard.dichtstbijOSMTwijfel;
    nodeVermoedenActief = bewaard.nodeVermoedenActief;
    vermoedenSleutel = bewaard.vermoedenSleutel; vermoedenTijd = bewaard.vermoedenTijd;
    vermoedenHoekSleutel = bewaard.vermoedenHoekSleutel; vermoedenHoekTeller = bewaard.vermoedenHoekTeller;
    vermoedenLaatste = bewaard.vermoedenLaatste;
    hoekStabielSleutel = bewaard.hoekStabielSleutel; hoekStabielTeller = bewaard.hoekStabielTeller;
    peilingWeigerReden = bewaard.peilingWeigerReden;
    clusterNodes = bewaard.clusterNodes;
    headingBuffer.length = 0; bewaard.headingBuffer.forEach(h => headingBuffer.push(h));
    vorigOsmId = bewaard.vorigOsmId; activeCdDoel = bewaard.activeCdDoel;
    activeCdModus = bewaard.activeCdModus; fase = bewaard.fase;
    faseBevestigd = bewaard.faseBevestigd; faseStart = bewaard.faseStart; cdStart = bewaard.cdStart;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    nodeCorrWeiger = bewaard.nodeCorrWeiger;
    if (kNaam) kNaam.classList.toggle('twijfel', bewaard.twijfelKlasse);
    if (leerToastTimer) clearTimeout(leerToastTimer);
    const t = document.getElementById('leer-toast');
    if (t) { t.textContent = bewaard.toastTxt; t.className = bewaard.toastCls; }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testNodeVermoeden = testNodeVermoeden;
