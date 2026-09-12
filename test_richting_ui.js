// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_richting_ui.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.83 (richting release C1): het scherm beweegt mee met de
//  gekozen richting, en een geleende countdown krijgt een eerlijk label.
//
//  WAT HIER BEWAAKT WORDT
//  Vóór deze release toonde de leerkaart altijd de V4-cijfers, ook nadat er op
//  'Rechtsaf' getikt was. Het percentage en de seconden per dagdeel stonden dus
//  op de cyclus van het RONDE licht terwijl het scherm een pijlrichting
//  markeerde. Nu volgt de leerkaart een expliciete `getoondeLaag`.
//
//  DE VALKUIL DIE T1 EN T3 VASTZETTEN
//  bijwerkLeerkaart berekent het percentage bovenaan én SCHRIJFT HET ONDERAAN
//  OPNIEUW (de dagdeel-tak en de globale tak). Wie alleen de kop aanpast bouwt
//  een release die niets doet: het zichtbare getal komt uit de staart. Deze
//  tests lezen daarom de DOM en niet de helper — een test op laagLeerPct alleen
//  had die fout laten passeren.
//
//  RV5, EN WAT V11.18.2 ERAAN VERANDERDE
//  Percentage en countdown mochten uit VERSCHILLENDE bronnen komen: een laag
//  percentage (de richting kent het licht nog niet) naast een geleend getal uit
//  Algemeen. T3 en T6 legden dat paar samen vast, want los gelezen ziet het
//  eruit als een fout.
//  Sinds V11.18.2 geldt dat nog maar voor één geval: een richting met NUL eigen
//  metingen. Zodra er één meting staat, stuurt de richting zelf en zit het
//  voorbehoud in de MODUS (CD_GESCHAT) in plaats van in een bronverschil. T6
//  toetst nu die nieuwe situatie; T6f houdt de geleende tak zelf gedekt.
//
//  DE FIXTURE, EN WAAROM DE BUCKETS ZO GEKOZEN ZIJN
//  laadMV5Geclusterd leest naast de gevraagde emmer ook de twee BUURBUCKETS
//  (afgerondNaar45). Een tweede sleutel op een naburige windrichting zou dus
//  ongemerkt meetellen en de drempeltoets vervalsen. Daarom staat de tweede
//  aanrijrichting op Z: vier posities van N vandaan, buiten elk cluster.
//    aanrij N (koers 0)  +  afrij W  ->  rijdersPijlLabel = 'Rechtsaf'
//    rechtdoor-default vanaf koers 0 is afrij Z — een lege emmer, zodat stap 2
//    van kiesCountdownBron gegarandeerd niet meevuurt.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_richting_ui.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRichtingUi().regels);
// ═══════════════════════════════════════════════════════════════

function testRichtingUi() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  // ── fixture-gereedschap ─────────────────────────────────────
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };
  const nu = Date.now();
  // obs === duur en gewicht 1 laat vlakGewichtVoor de vlakke weging kiezen —
  // hetzelfde pad als een echte s1-meting.
  const recs = (n, duur) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ duur, tijd: nu - i * 60000, gewicht: 1, obs: duur, bron: 's1' });
    return a;
  };

  const bewaard = {
    dichtstbijOSM, getoondeLaag, getoondDagdeel, richtingBlokVerborgen,
    richtingLockKeuze, richtingLockNodeId, richtingKnoppenNodeId,
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij,
    huidigCdBron, fase, cdStart, activeCdDoel, activeCdModus, activeCdMin,
    richtingTekort, osmVoorspellingActief, cdBereikteNul, countdownNulTijd,
    // De opzet van T7/T8c roept tickCd aan, en die zet sinds V11.17.78 de
    // bevestigbalk aan zodra er een countdown loopt. Zonder herstel blijft die
    // balk 'actief' achter en start de eerstvolgende klassewissel elders een
    // filter/box-shadow-overgang die in een verborgen paneel niet doorloopt —
    // test_knopkleur T8/T9b/T10/T12b lezen precies die overgangswaarden en
    // vielen daardoor om. Gemeten: dezelfde 15 bestaande suites geven op
    // V11.17.82 en op V11.17.83 identiek 306 OK; alleen met deze suite ervoor
    // vielen er 4 om. Het was dus een spoor van DEZE testopzet, geen regressie
    // in de app — en het herstel hieronder haalt dat spoor weg.
    bevestigActief, bevInertStaat, wrapClass: bevestigWrap.className,
    knopK: bevKlopteBtn.className, knopB: bevBijnaBtn.className, knopF: bevFoutBtn.className,
    groenStart, cdWallStart, cdWallNodeId,
    cdCondSleutel, cdCondTab, cdCondDoel, cdWeergaveNulTijd, cdLaatstGetoond, herzTel,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML,
    leerNaamTxt: (document.getElementById('leer-naam') || {}).textContent,
    pctTxt: (document.getElementById('leer-pct-getal') || {}).textContent
  };

  // De fixture staat in het dagdeel dat NU actief is, zodat kiesCountdownBron
  // en de leerkaart dezelfde emmer lezen zonder de klok te vervalsen.
  const DD_NU = huidigDDActief();

  // NODE_EIGEN: de richting N>W heeft 6 eigen metingen en stuurt dus zelf.
  // NODE_LEEN: dezelfde richting heeft er 1. Tot V11.18.1 leende die daarom uit
  // Algemeen; sinds V11.18.2 stuurt ook die zelf (zie T6).
  const NODE_EIGEN = 990101;
  const NODE_LEEN  = 990102;

  const pct0  = () => document.getElementById('leer-pct-getal').textContent;
  const naam0 = () => document.getElementById('leer-naam').textContent;
  const chip  = (d) => ({
    val: document.getElementById('dv-' + d).textContent,
    cnt: document.getElementById('dc-' + d).textContent
  });
  const rijen    = () => [...document.querySelectorAll('#richting-blok-body .rb-rij')];
  const rijLabel = (r) => r.querySelector('.rb-label').textContent.trim();
  const isAlg    = (r) => rijLabel(r).startsWith('Algemeen');

  try {
    // ══ FIXTURE ═══════════════════════════════════════════════
    zetLS('sl_v4_' + NODE_EIGEN + '_' + DD_NU, JSON.stringify(recs(8, 60)));
    zetLS('sl_v4_' + NODE_LEEN  + '_' + DD_NU, JSON.stringify(recs(8, 60)));
    zetLS('sl_v5_' + NODE_EIGEN + '_N_W_' + DD_NU, JSON.stringify(recs(6, 24)));
    zetLS('sl_v5_' + NODE_EIGEN + '_Z_N_' + DD_NU, JSON.stringify(recs(1, 90)));
    zetLS('sl_v5_' + NODE_LEEN  + '_N_W_' + DD_NU, JSON.stringify(recs(1, 24)));
    zetLS('sl_v5_' + NODE_LEEN  + '_Z_N_' + DD_NU, JSON.stringify(recs(1, 90)));
    // Koersen rond 0 graden: één herkende nadering, zodat het richtingblok
    // filtert zoals in de praktijk en de Z-sleutel buiten beeld blijft.
    const koersen = JSON.stringify({
      headings: [0, 2, 1, 3, 0, 1, 2, 1], laatste_update: nu, bevestigingen: 8
    });
    zetLS('sl_richting_' + NODE_EIGEN, koersen);
    zetLS('sl_richting_' + NODE_LEEN,  koersen);
    zetLS('sl_neutraal_'   + NODE_EIGEN, null);
    zetLS('sl_neutraal_'   + NODE_LEEN,  null);
    zetLS('sl_enkelricht_' + NODE_EIGEN, null);
    zetLS('sl_enkelricht_' + NODE_LEEN,  null);

    getoondDagdeel = null;          // de tak die in de praktijk draait
    richtingBlokVerborgen = false;
    fase = 'groen';                 // houdt pasBronAanBinnenLopendeCd buiten beeld
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0;   // koers noord
    richtingLockKeuze = null; richtingLockNodeId = null;

    const v4n = laadM(NODE_EIGEN, DD_NU).length;
    const v4gem = Math.round(gewGem(laadM(NODE_EIGEN, DD_NU)));

    // ══ T1 — ALGEMEEN: percentage en dagdeel-seconden uit V4 ══
    getoondeLaag = null;
    dichtstbijOSM = { id: NODE_EIGEN, lat: 52, lon: 5, afstand: 20, naam: 'Teststraat 1' };
    richtingKnoppenNodeId = String(NODE_EIGEN);
    bijwerkLeerkaart(dichtstbijOSM);

    const algPctTxt = pct0();
    const algChip   = chip(DD_NU);
    eis('T1 Algemeen: het percentage is het V4-percentage',
        algPctTxt === berekenLeerPct(NODE_EIGEN) + '%',
        berekenLeerPct(NODE_EIGEN) + '%', algPctTxt);
    eis('T1b Algemeen: de dagdeel-chip toont de V4-seconden en het V4-aantal',
        algChip.val === v4gem + 's' && algChip.cnt === v4n + 'x',
        v4gem + 's / ' + v4n + 'x', algChip.val + ' / ' + algChip.cnt);

    // ══ T2 — RICHTING MET EIGEN DATA ══════════════════════════
    // Aanklikken zoals de gebruiker: via de gerenderde rij, niet via de helper.
    let rs = rijen();
    let iRicht = rs.findIndex(r => !isAlg(r));
    eis('T2a er staat een richtingregel om aan te tikken, en die heet Rechtsaf',
        iRicht >= 0 && rijLabel(rs[iRicht]) === 'Rechtsaf',
        'Rechtsaf', rs.map(rijLabel).join(' | '));
    rs[iRicht].onclick();                    // == kiesLaagRichting(idx)

    const rPctTxt = pct0();
    const rChip   = chip(DD_NU);
    const v5m     = laadMV5Geclusterd(NODE_EIGEN, 'N', 'W', DD_NU);
    const v5gem   = Math.round(gewGem(v5m));
    eis('T2 richting met eigen data: de dagdeel-seconden komen uit de V5-emmer',
        rChip.val === v5gem + 's' && rChip.cnt === v5m.length + 'x',
        v5gem + 's / ' + v5m.length + 'x (V5), niet ' + algChip.val + ' / ' + algChip.cnt,
        rChip.val + ' / ' + rChip.cnt);
    eis('T2b en het percentage is NIET meer het V4-percentage',
        rPctTxt !== algPctTxt, 'anders dan ' + algPctTxt, rPctTxt);
    // De balk bovenaan en het getal op de regel moeten hetzelfde zeggen; anders
    // spreekt het scherm zichzelf tegen over dezelfde emmer.
    rs = rijen();
    const regelPct = rs[rs.findIndex(r => !isAlg(r))].querySelector('.rb-pct').textContent.trim();
    eis('T2c de balk bovenaan en het getal op de regel zeggen hetzelfde',
        rPctTxt === regelPct, regelPct, rPctTxt);

    // ══ T4 — STRAATNAAM EN NODE-ID BLIJVEN (RV4) ══════════════
    eis('T4 de straatnaam verandert niet mee met de richtingselectie',
        naam0() === 'Teststraat 1', 'Teststraat 1', naam0());
    eis('T4b de getoonde laag hoort bij dezelfde node-id',
        getoondeLaag && String(getoondeLaag.node) === String(NODE_EIGEN),
        String(NODE_EIGEN), getoondeLaag ? String(getoondeLaag.node) : 'geen laag');

    // ══ T5 — DE MARKERING ═════════════════════════════════════
    let actief = rijen().filter(r => r.classList.contains('actief')).map(rijLabel);
    eis('T5 precies één regel is gemarkeerd, en dat is de aangetikte richting',
        actief.length === 1 && actief[0] === 'Rechtsaf',
        '1x Rechtsaf gemarkeerd', actief.length + ': [' + actief.join(' | ') + ']');

    rs = rijen();
    const iAlg = rs.findIndex(isAlg);
    eis('T5b er is een Algemeen-regel om naar terug te keren',
        iAlg >= 0, 'Algemeen-regel aanwezig', rs.map(rijLabel).join(' | '));
    // De Algemeen-regel mag GEEN rijrichting kiezen — dat was de oude fout
    // (onclick="tikRichting('rechtdoor')" selecteerde stilletjes rechtdoor).
    eis('T5c de Algemeen-regel zet geen rijrichting',
        !/tikRichting/.test(rs[iAlg].getAttribute('onclick') || ''),
        'geen tikRichting in de Algemeen-regel', rs[iAlg].getAttribute('onclick'));
    rs[iAlg].onclick();                      // == kiesLaagAlgemeen()
    actief = rijen().filter(r => r.classList.contains('actief')).map(rijLabel);
    eis('T5d na terugkeer verspringt de markering naar Algemeen',
        actief.length === 1 && actief[0].startsWith('Algemeen'),
        '1x Algemeen gemarkeerd', actief.length + ': [' + actief.join(' | ') + ']');
    eis('T5e en het percentage staat weer op het V4-getal',
        pct0() === algPctTxt, algPctTxt, pct0());

    // ══ T3 — RICHTING ZONDER EIGEN DATA (RV5) ═════════════════
    getoondeLaag = null;
    dichtstbijOSM = { id: NODE_LEEN, lat: 52, lon: 5, afstand: 20, naam: 'Teststraat 2' };
    richtingKnoppenNodeId = String(NODE_LEEN);
    bijwerkLeerkaart(dichtstbijOSM);
    const leenAlgPct = pct0();
    const leenV4Pct  = berekenLeerPct(NODE_LEEN);

    rs = rijen();
    iRicht = rs.findIndex(r => !isAlg(r));
    eis('T3a de richting zonder eigen data staat wel in de lijst',
        iRicht >= 0 && rijLabel(rs[iRicht]) === 'Rechtsaf',
        'Rechtsaf', rs.map(rijLabel).join(' | '));
    rs[iRicht].onclick();

    const leenPctTxt = pct0();
    const leenPctNum = parseInt(leenPctTxt, 10);
    // V11.17.84: deze toets luidde '<= 10%'. Dat was de 6% van de oude
    // trapfunctie, en daarmee legde de test de bug vast die D1 juist opheft:
    // één meting is nu 25%, net als bij een node. De BEDOELING blijft
    // ongewijzigd — het getal moet uit de EIGEN emmer van de richting komen en
    // niet uit V4 — dus toetsen we dat nu direct op de bron in plaats van op
    // een bovengrens die aan de oude schaal hing.
    const eigenPct = berekenRichtingPct(NODE_LEEN, 'N', 'W', DD_NU);
    const leenLaag = !isNaN(leenPctNum) && leenPctNum <= leenV4Pct - 40;
    eis('T3 richting zonder eigen data: het percentage is NIET het V4-percentage',
        leenPctTxt !== leenAlgPct,
        'anders dan het Algemeen-getal ' + leenAlgPct, leenPctTxt);
    eis('T3b het komt uit de eigen V5-emmer van deze richting',
        eigenPct && leenPctNum === eigenPct.pct,
        (eigenPct ? eigenPct.pct : '?') + '% uit de V5-emmer', leenPctTxt);
    eis('T3c en dat ligt ruim onder de ' + leenV4Pct + '% van V4 (één meting tegen '
        + laadM(NODE_LEEN, DD_NU).length + ')',
        leenLaag, 'minstens 40 pp lager dan V4', leenPctTxt);
    eis('T3d en de dagdeel-chip telt 1 eigen meting, niet de ' + v4n + ' van Algemeen',
        chip(DD_NU).cnt === '1x', '1x', chip(DD_NU).cnt);

    // ══ T6 — ÉÉN EIGEN METING STUURT NU ZELF ══════════════════
    // V11.18.2 HEEFT DEZE DRIE OMGEDRAAID, EN DAT IS DE HELE RELEASE.
    // NODE_LEEN is letterlijk het gemelde geval: rechtsaf is één keer gemeten
    // op 24s, terwijl Algemeen op 60s staat omdat rechtdoor de lange cyclus
    // heeft. Tot V11.18.1 viel deze richting door naar stap 4 en kreeg de
    // gebruiker die 60s te zien — "rechtsaf krijgt dus eigenlijk verkeerde
    // countdown, want die is op algemeen gebaseerd." Stap 1 telt nu vanaf de
    // eerste eigen meting, dus hier staat voortaan 24s.
    //
    // De naam NODE_LEEN klopt daarmee niet meer helemaal: de emmer is niet
    // leeg, hij haalde alleen de oude drempel niet. Bewust niet hernoemd —
    // die naam loopt door de halve suite en de fixture zelf is ongewijzigd.
    // T6f hieronder dekt het geval waar de naam wél op slaat.
    const v4LeenGem = Math.round(gewGem(laadM(NODE_LEEN, DD_NU)));
    const bronLeen  = kiesCountdownBron(NODE_LEEN, DD_NU, 'N', 'W');
    eis('T6 richting met één eigen meting stuurt zelf (V11.18.2)',
        bronLeen && bronLeen.bron === 'V5 W' && bronLeen.v5 === true,
        'V5 W', bronLeen ? bronLeen.bron : 'geen bron');
    eis('T6b en het getal is de eigen 24s, niet de ' + v4LeenGem + 's van Algemeen',
        bronLeen && Math.round(bronLeen.gem) === 24
          && Math.round(bronLeen.gem) !== v4LeenGem,
        '24s (eigen), niet ' + v4LeenGem + 's',
        bronLeen ? Math.round(bronLeen.gem) + 's' : 'niets');
    // RV5 IS HIER OPGEHEVEN. Percentage en countdown kwamen bewust uit
    // verschillende bronnen zolang de countdown geleend was: "ik weet nog niets
    // van deze richting, maar ik toon je voorlopig het algemene getal." Nu ze
    // allebei uit de eigen emmer komen, hoort het voorbehoud in de MODUS te
    // zitten en niet meer in een bronverschil — en dat doet het ook: één meting
    // geeft CD_GESCHAT, precies zoals een gloednieuw kruispunt.
    eis('T6c percentage en countdown komen nu uit dezelfde emmer, met het ' +
        'voorbehoud in de modus',
        leenLaag && bronLeen && bronLeen.modus === CD_GESCHAT
          && bronLeen.cdMin === null && bronLeen.cdMax === null,
        'laag richting-percentage naast een eigen ' + CD_GESCHAT + '-countdown',
        leenPctTxt + ' / ' + (bronLeen ? bronLeen.bron + ' / ' + bronLeen.modus : '—'));
    // Het nieuwe label moet in ELKE bronschakelaar staan, anders vallen de
    // conditionele tabel en de schaduwmeting stil voor juist deze nodes.
    const hm = haalMetingenVoorBron(NODE_LEEN, DD_NU, 'N', 'W', 'v4_geen_richtingdata');
    eis('T6d haalMetingenVoorBron kent het geleende label (anders geen conditionele tabel)',
        Array.isArray(hm) && hm.length === v4n, v4n + ' V4-metingen',
        Array.isArray(hm) ? hm.length + ' metingen' : String(hm));
    const sw = berekenSchaduwWaarden(NODE_LEEN, DD_NU, 'N', 'W', 'v4_geen_richtingdata');
    eis('T6e berekenSchaduwWaarden kent het geleende label ook',
        sw && sw.m1 != null, 'schaduwwaarden gevuld', sw ? JSON.stringify(sw) : 'null');

    // ── T6f — HET GELEENDE LABEL BESTAAT NOG, MAAR PAS BIJ NUL ──
    // V11.18.2 verplaatst de grens van 'minder dan vijf metingen' naar 'geen
    // enkele meting'. Het label van V11.17.83 blijft dus bereikbaar en moet dat
    // ook: een richting waar nog nóóit iets gemeten is moet zijn countdown niet
    // verliezen (RV1). Dat is precies de toestand die stap 2 van dit plan later
    // aanpakt; tot dan hoort deze tak gewoon te werken.
    //
    // DE TWEEDE AANRIJRICHTING MOET BLIJVEN STAAN. Het geleende label zit in de
    // else van isEenRichtingNode: een node met maar één bekende aanrijrichting
    // krijgt gewoon 'V4'. Haal je hier alleen de N_W-sleutel weg, dan houdt
    // NODE_LEEN nog één bucket (Z) over, valt hij in de enkelrichting-tak en
    // meet deze test het verkeerde label. Daarom komt er een derde bucket bij
    // op aanrij O — vier posities van N vandaan, dus buiten het cluster dat
    // laadMV5Geclusterd voor (N, W) leest, en met één meting te weinig om stap
    // 3 te halen.
    const bewaardNW = localStorage.getItem('sl_v5_' + NODE_LEEN + '_N_W_' + DD_NU);
    localStorage.removeItem('sl_v5_' + NODE_LEEN + '_N_W_' + DD_NU);
    zetLS('sl_v5_' + NODE_LEEN + '_O_Z_' + DD_NU, JSON.stringify(recs(1, 90)));
    const bronNul = kiesCountdownBron(NODE_LEEN, DD_NU, 'N', 'W');
    localStorage.setItem('sl_v5_' + NODE_LEEN + '_N_W_' + DD_NU, bewaardNW);
    localStorage.removeItem('sl_v5_' + NODE_LEEN + '_O_Z_' + DD_NU);
    eis('T6f een richting met NUL eigen metingen leent nog steeds uit Algemeen',
        bronNul && bronNul.bron === 'v4_geen_richtingdata'
          && Math.round(bronNul.gem) === v4LeenGem,
        'v4_geen_richtingdata, ' + v4LeenGem + 's',
        bronNul ? (bronNul.bron + ', ' + Math.round(bronNul.gem) + 's') : 'geen bron');
    eis('T6g en die geleende bron draagt nog steeds geen V5-voorvoegsel (RV3)',
        bronNul && !String(bronNul.bron).startsWith('V5') && bronNul.v5 === false,
        'geen V5-label', bronNul ? bronNul.bron : 'geen bron');

    // ══ T8 — RICHTING DIE DE DREMPEL WEL HAALT ════════════════
    const bronEigen = kiesCountdownBron(NODE_EIGEN, DD_NU, 'N', 'W');
    eis('T8 richting met >= V9_MIN_METINGEN krijgt de eigen V5-bron',
        bronEigen && bronEigen.bron === 'V5 W' && bronEigen.v5 === true,
        'V5 W', bronEigen ? bronEigen.bron : 'geen bron');
    eis('T8b en dat getal is de eigen cyclus, niet die van Algemeen',
        bronEigen && Math.round(bronEigen.gem) === 24,
        '24s (eigen), niet ' + v4gem + 's (Algemeen)',
        bronEigen ? Math.round(bronEigen.gem) + 's' : '—');

    // ══ T7 + T8c — DE PIJL (RV3) ══════════════════════════════
    // De poort zit in tickCd, dus we toetsen hem via het werkelijke getal in de
    // pill — dezelfde opzet als test_richting T11-T13b.
    const heeftPijl = t => ['←', '↑', '→'].some(p => t.startsWith(p));
    const opzet = bron => {
      fase = 'rood'; activeCdDoel = 40; activeCdModus = CD_GESCHAT; activeCdMin = null;
      osmVoorspellingActief = false;
      dichtstbijOSM = { id: NODE_LEEN, lat: 52, lon: 5, afstand: 30, naam: 'Teststraat 2' };
      cdWallStart = Date.now(); cdCondSleutel = null; cdCondTab = null;
      cdCondDoel = null; cdWeergaveNulTijd = null; cdLaatstGetoond = null;
      herzTel = null; cdBereikteNul = false; countdownNulTijd = null;
      richtingTekort = null;                 // suffix uit beeld houden
      v9PreSelectieAfrij = 'W';
      richtingLockKeuze = 'rechts';          // de tik IS gedaan
      huidigCdBron = bron;
      cdStart = performance.now() - 15000;
      tickCd();
      return document.getElementById('cd-pill-getal').textContent;
    };
    const tLeen = opzet('v4_geen_richtingdata');
    eis('T7 GEEN richtingspijl bij een geleende countdown, ook al is er getikt',
        !heeftPijl(tLeen) && richtingLockKeuze === 'rechts',
        'geen pijl, terwijl de tik wel staat', tLeen);
    // Structureel en niet alleen op dit ene label: de poort laat uitsluitend
    // bronnen door die met 'V5' beginnen, dus het label mag dat nooit doen.
    eis('T7b het geleende label begint per constructie niet met "V5"',
        !'v4_geen_richtingdata'.startsWith('V5'),
        'geen V5-voorvoegsel', 'v4_geen_richtingdata');
    const tEigen = opzet('V5 W');
    eis('T8c bij de eigen V5-bron verschijnt de pijl wél',
        heeftPijl(tEigen), 'begint met een pijl', tEigen);

    // ══ T9 — GEEN NODE VERLIEST ZIJN COUNTDOWN (RV1) ══════════
    // Over de echte store: elke (node, dagdeel) die vóór deze release een
    // countdown had, heeft er nog steeds een. Deze release verandert in stap 4
    // alleen het LABEL, niet gem4 — T9 toetst dat op data in plaats van op de
    // redenering. Gecapt op 120 emmers omdat kiesCountdownBron per aanroep twee
    // volledige localStorage-scans doet.
    (function () {
      const CAP = 120;
      let getoetst = 0, zonder = 0, leenZonderTik = 0, voorbeeld = null;
      const gezien = new Set();
      for (let i = 0; i < localStorage.length && getoetst < CAP; i++) {
        const k = localStorage.key(i);
        const m = k && k.match(/^sl_v4_(.+)_(ochtend|dag|avond|nacht)$/);
        if (!m) continue;
        const sleutel = m[1] + '|' + m[2];
        if (gezien.has(sleutel)) continue;
        gezien.add(sleutel);
        if (!gewGem(laadM(m[1], m[2]))) continue;   // had ook vóór deze release niets
        getoetst++;
        const b = kiesCountdownBron(m[1], m[2], 'N', 'W');
        if (!b || !(b.gem > 0)) { zonder++; if (!voorbeeld) voorbeeld = sleutel; }
        // Zonder richtingkeuze is er niets te lenen — het label mag dan niet
        // opduiken, anders zou hij ook op ongetikte nodes gaan staan.
        const bz = kiesCountdownBron(m[1], m[2], null, null);
        if (bz && bz.bron === 'v4_geen_richtingdata') leenZonderTik++;
      }
      eis('T9 geen enkele emmer met V4-data verliest zijn countdown (RV1)',
          getoetst > 0 && zonder === 0,
          getoetst + ' emmers, 0 zonder countdown',
          getoetst + ' emmers, ' + zonder + ' zonder countdown'
            + (voorbeeld ? ' (bv. ' + voorbeeld + ')' : ''));
      eis('T9b zonder richtingkeuze verschijnt het geleende label nooit',
          leenZonderTik === 0, '0', String(leenZonderTik));
    })();

    // ══ T10 — REGRESSIEWACHT OP VOLGORDE EN DREMPELS ══════════
    eis('T10 V9_MIN_METINGEN is nog steeds 5',
        V9_MIN_METINGEN === 5, '5', String(V9_MIN_METINGEN));
    const zonderCommentaar = (b) => b
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const kb = zonderCommentaar(String(kiesCountdownBron));
    const iS1 = kb.indexOf('V5 ${preSelectieAfrij}');
    const iS2 = kb.indexOf('V5 ↑');
    const iS3 = kb.indexOf("'V5 alle'");
    const iS4 = kb.indexOf('v4_geen_richtingdata');
    eis('T10b de volgorde stap 1 -> 2 -> 3 -> 4 is ongewijzigd',
        iS1 > 0 && iS1 < iS2 && iS2 < iS3 && iS3 < iS4,
        'oplopende posities', [iS1, iS2, iS3, iS4].join(' < '));
    // Twee drempeltoetsen: stap 2 (rechtdoor-default) en stap 3 (alle V5
    // samen). Dit stond op DRIE, één per V5-stap, met de opmerking "een vierde
    // zou betekenen dat er stiekem een drempel bij is gekomen; twee dat er een
    // weg is." Er IS er een weg, en bewust: V11.18.2 haalde de drempel uit stap
    // 1 zodat een getikte richting vanaf haar eerste eigen meting zelf aftelt.
    // De bewaking zelf blijft nuttig — nu op twee, zodat een volgende sluipende
    // verschuiving nog steeds opvalt.
    eis('T10c er zijn nog precies 2 toetsen op V9_MIN_METINGEN (stap 2 en 3)',
        (kb.match(/V9_MIN_METINGEN/g) || []).length === 2, '2',
        String((kb.match(/V9_MIN_METINGEN/g) || []).length));
    const sc = zonderCommentaar(String(startCd));
    eis('T10d startCd telt de geleende countdowns (de teller die C2 stuurt)',
        /v4_geen_richtingdata/.test(sc) && /cd_geleend/.test(sc),
        "logOpslagMis('cd_geleend', ...)",
        /cd_geleend/.test(sc) ? 'teller aanwezig' : 'TELLER ONTBREEKT');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    getoondeLaag = bewaard.getoondeLaag;
    getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingKnoppenNodeId = bewaard.richtingKnoppenNodeId;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    huidigCdBron = bewaard.huidigCdBron;
    fase = bewaard.fase; cdStart = bewaard.cdStart;
    activeCdDoel = bewaard.activeCdDoel; activeCdModus = bewaard.activeCdModus;
    activeCdMin = bewaard.activeCdMin;
    richtingTekort = bewaard.richtingTekort;
    osmVoorspellingActief = bewaard.osmVoorspellingActief;
    cdBereikteNul = bewaard.cdBereikteNul;
    countdownNulTijd = bewaard.countdownNulTijd;
    groenStart = bewaard.groenStart;
    cdWallStart = bewaard.cdWallStart; cdWallNodeId = bewaard.cdWallNodeId;
    cdCondSleutel = bewaard.cdCondSleutel; cdCondTab = bewaard.cdCondTab;
    cdCondDoel = bewaard.cdCondDoel; cdWeergaveNulTijd = bewaard.cdWeergaveNulTijd;
    cdLaatstGetoond = bewaard.cdLaatstGetoond; herzTel = bewaard.herzTel;
    // De bevestigbalk terug op de klassen die er stonden, en de memo op de
    // bewaarde waarde — niet op '' — zodat een volgende updateBevestigKnopStaat
    // dezelfde beslissing neemt als voor deze suite.
    bevestigActief = bewaard.bevestigActief;
    bevestigWrap.className = bewaard.wrapClass;
    bevKlopteBtn.className = bewaard.knopK;
    bevBijnaBtn.className  = bewaard.knopB;
    bevFoutBtn.className   = bewaard.knopF;
    bevInertStaat = bewaard.bevInertStaat;
    const b = document.getElementById('richting-blok-body');
    if (b && bewaard.blokHtml != null) b.innerHTML = bewaard.blokHtml;
    const ln = document.getElementById('leer-naam');
    if (ln && bewaard.leerNaamTxt != null) ln.textContent = bewaard.leerNaamTxt;
    const lp = document.getElementById('leer-pct-getal');
    if (lp && bewaard.pctTxt != null) lp.textContent = bewaard.pctTxt;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRichtingUi = testRichtingUi;
