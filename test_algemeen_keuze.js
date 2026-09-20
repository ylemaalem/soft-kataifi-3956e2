// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_algemeen_keuze.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.93 (richting release 2): Algemeen krijgt zijn eigen waarde
//  in richtingLockKeuze in plaats van "geen van de drie richtingen" te zijn.
//
//  WAT HIER BEWAAKT WORDT
//  Twee symptomen met één bron. De koppel-chip in de Algemeen-regel bood
//  'zelfde als →?' aan zodra er een richting-lock stond — ook een lock die
//  activeerPersistenteRichting zonder tik had teruggezet. En de
//  afstandsindicator bleef een richtingpijl tonen nadat je op Algemeen drukte,
//  omdat hij op precies één plek verborgen werd (resetRijrichtingState) en die
//  bij een node-wissel draait, niet bij een categoriewissel.
//
//  DE TWEEDE AS IS DE ECHTE VALKUIL
//  richtingLockKeuze wordt óók gelezen als "waar rijd ik heen": de
//  enkelricht-ontkapping (r3410), de bbox-bonus (r6482), de pijl in de
//  countdown-pill, de richtingknoppen, de tekortmelding en de GPS-keten. Op die
//  as bestaat Algemeen niet. rijrichting() projecteert de keuze daarop weg.
//  T7 en T8 zetten vast dat die projectie klopt in beide richtingen — te ruim
//  en een node zou 'algemeen' als rijrichting behandelen, te streng en de drie
//  echte richtingen zouden hun gedrag verliezen.
//
//  DE KOPPELING IS EEN ANDER MECHANISME
//  sl_enkelricht_ ("Algemeen is hier hetzelfde licht als rechtsaf") staat los
//  van deze keuze en moest ongemoeid blijven. T9 en T10 bewaken dat: een
//  bestaande koppeling blijft zichtbaar en opzegbaar terwijl Algemeen actief
//  is, en het aanbod om te koppelen verdwijnt alleen als aanbod.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_algemeen_keuze.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testAlgemeenKeuze().regels);
// ═══════════════════════════════════════════════════════════════

function testAlgemeenKeuze() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };

  const bewaard = {
    dichtstbijOSM, getoondeLaag, getoondDagdeel, richtingBlokVerborgen,
    richtingLockKeuze, richtingLockNodeId, richtingKnoppenNodeId,
    richtingGedruktVoorNode, v9AanrijHeading, v9AanrijSnelheidHeading,
    v9PreSelectieAfrij, richtingTekort, huidigCdBron,
    indicHtml: (document.getElementById('v9-richting-indicator') || {}).innerHTML,
    indicDisp: (document.getElementById('v9-richting-indicator') || {}).style
                 ? document.getElementById('v9-richting-indicator').style.display : null,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML
  };

  const nu = Date.now();
  const NODE = 991201;
  const DD_NU = huidigDDActief();
  // obs === duur en gewicht 1 laat vlakGewichtVoor de vlakke weging kiezen —
  // hetzelfde pad als een echte s1-meting.
  const recs = (n, duur) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ duur, tijd: nu - i * 60000, gewicht: 1, obs: duur, bron: 's1' });
    return a;
  };

  const indic  = () => document.getElementById('v9-richting-indicator');
  const zicht  = () => indic().style.display !== 'none';
  const rijen  = () => [...document.querySelectorAll('#richting-blok-body .rb-rij')];
  const algRij = () => rijen().find(r => r.getAttribute('data-key') === 'ALG');
  const algTxt = () => { const r = algRij(); return r ? r.querySelector('.rb-label').textContent.trim() : null; };
  const chip   = () => { const r = algRij(); return r ? r.querySelector('.rb-koppel') : null; };
  const chipTxt = () => { const c = chip(); return c ? c.textContent.trim() : null; };

  try {
    // ══ FIXTURE ═══════════════════════════════════════════════
    // Algemeen heeft data (heeftAlg waar, dus de ALG-rij wordt getekend) en één
    // richting N>W met eigen metingen, zodat er ook een richtingrij staat om
    // tussen te wisselen.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(recs(8, 60)));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(recs(6, 24)));
    zetLS('sl_richting_' + NODE, JSON.stringify({
      headings: [0, 2, 1, 3, 0, 1, 2, 1], laatste_update: nu, bevestigingen: 8 }));
    zetLS('sl_neutraal_'   + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);

    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'Testkruising' };
    getoondDagdeel = null;
    richtingBlokVerborgen = false;
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0;
    huidigCdBron = null;

    // V11.17.96: de herkomst hoort bij de keuze. Een opzet die hem niet zet
    // zou de chip nooit meer laten verschijnen en elke chip-toets vals-positief
    // groen maken.
    const opnieuw = (keuze, bron = 'tik') => {
      getoondeLaag = null;
      richtingLockKeuze = keuze;
      richtingLockBron = (keuze === null) ? null : bron;
      richtingLockNodeId = (keuze === null) ? null : String(NODE);
      richtingGedruktVoorNode = null;
      bijwerkLeerkaart(dichtstbijOSM);
    };

    // ══ T1 — OP ALGEMEEN DRUKKEN IS EEN KEUZE ═════════════════
    opnieuw('rechts');
    kiesLaagAlgemeen();
    eis('T1 kiesLaagAlgemeen zet richtingLockKeuze op algemeen',
        richtingLockKeuze === 'algemeen', "'algemeen'", String(richtingLockKeuze));
    eis('T1b en zet de lock op de node waar je staat',
        richtingLockNodeId === String(NODE), String(NODE), String(richtingLockNodeId));
    eis('T1c de getoonde laag gaat mee terug naar Algemeen',
        getoondeLaag === null, 'null', JSON.stringify(getoondeLaag));

    // ══ T2 — HET KOPPELAANBOD BESTAAT NIET MEER ═══════════════
    // ── V11.18.18: DEZE HELE GROEP IS OMGEDRAAID ────────────
    // T2 eiste dat de ronde-lichtregel na een richting-tik de koppeling AANBOOD
    // ('zelfde als →?'). Met rond licht als vaste standaard is die vraag
    // vervallen: het ronde licht is een eigen categorie, geen kandidaat om in
    // een richting op te gaan. Het aanbod is verwijderd, dus de toetsen eisen nu
    // het omgekeerde. Losmaken van een BESTAANDE koppeling blijft (T9c2).
    opnieuw('rechts');
    eis('T2 een richting-lock levert geen koppelaanbod meer op',
        chip() === null, 'geen chip', String(chipTxt()));
    kiesLaagAlgemeen();
    eis('T2b en na Algemeen evenmin',
        chip() === null, 'geen chip', String(chipTxt()));

    // De app zet een eerder getikte richting sinds V11.18.18 ook niet meer zelf
    // terug: een bekend kruispunt begint op rond licht, met de keuzeknoppen.
    opnieuw(null);
    toonRichtingKnoppen(String(NODE));
    bijwerkLeerkaart(dichtstbijOSM);
    eis('T2c een bekend kruispunt activeert uit zichzelf geen richting meer',
        richtingLockBron === null && richtingLockKeuze === null,
        'geen lock', richtingLockBron + ' / ' + richtingLockKeuze);
    eis('T2c2 en de indicator toont dus het ronde teken, niet een richting',
        indic().textContent.indexOf('rechtsaf') < 0,
        'geen richting in de indicator', indic().textContent);
    kiesLaagAlgemeen();
    eis('T2d na een Algemeen-keuze staat er ook geen chip',
        chip() === null && richtingLockKeuze === 'algemeen',
        'geen chip, keuze algemeen',
        (chip() ? 'chip: ' + chipTxt() : 'geen chip') + ', keuze ' + richtingLockKeuze);

    // ══ T3 — DE AFSTANDSINDICATOR ═════════════════════════════
    // V11.17.96: de pijl verdwijnt niet meer bij Algemeen — hij WISSELT. Algemeen
    // is een van de vier gelijkwaardige categorieën en hoort dus net zo zichtbaar
    // te zijn als de andere drie; een lege indicator zou hem weer tot restwaarde
    // maken. Wat weg moet is de RICHTING-tekst, niet de indicator zelf.
    // V11.18.18: via een ECHTE tik — het herstelpad bestaat niet meer.
    opnieuw(null);
    richtingKnoppenNodeId = String(NODE);
    tikRichting('rechts', 'vraag');
    eis('T3 de pijl staat in beeld na een richting',
        zicht() && indic().textContent.indexOf('rechtsaf') >= 0,
        'zichtbaar, rechtsaf', zicht() ? indic().textContent : 'verborgen');
    kiesLaagAlgemeen();
    eis('T3b bij Algemeen verdwijnt de richting-tekst volledig',
        indic().textContent.indexOf('rechtsaf') < 0
        && indic().textContent.indexOf('linksaf') < 0
        && indic().textContent.indexOf('rechtdoor') < 0,
        'geen richting meer', indic().textContent);
    eis('T3b2 en Algemeen toont zijn eigen teken in plaats van niets',
        zicht() && indic().textContent.indexOf('⬤') >= 0
        && indic().textContent.indexOf('ronde licht') >= 0,
        'zichtbaar, ⬤ het ronde licht',
        zicht() ? indic().textContent : 'VERBORGEN');

    // Ook vanuit een echte tik, niet alleen de persistente route.
    opnieuw(null);
    richtingKnoppenNodeId = String(NODE);
    tikRichting('links');
    eis('T3c ook een getikte richting zet de pijl aan',
        zicht() && indic().textContent.indexOf('linksaf') >= 0,
        'zichtbaar, linksaf', zicht() ? indic().textContent : 'verborgen');
    kiesLaagAlgemeen();
    eis('T3d en Algemeen vervangt hem door het ronde teken',
        zicht() && indic().textContent.indexOf('linksaf') < 0
        && indic().textContent.indexOf('⬤') >= 0,
        '⬤ zonder linksaf', indic().textContent);

    // ══ T4 — HEEN EN WEER ═════════════════════════════════════
    opnieuw('rechts');
    kiesLaagAlgemeen();
    const naAlg = { k: richtingLockKeuze, chip: chip() === null, pijl: !zicht() };
    richtingKnoppenNodeId = String(NODE);
    richtingGedruktVoorNode = null;
    tikRichting('rechts');
    bijwerkLeerkaart(dichtstbijOSM);
    eis('T4 van Algemeen terug naar een richting werkt',
        richtingLockKeuze === 'rechts' && zicht(),
        "'rechts', pijl zichtbaar", richtingLockKeuze + ', pijl ' + indic().style.display);
    eis('T4b en er komt geen koppelaanbod terug (V11.18.18)',
        chip() === null, 'geen chip', String(chipTxt()));
    kiesLaagAlgemeen();
    eis('T4c en weer naar Algemeen geeft dezelfde uitkomst als de eerste keer',
        richtingLockKeuze === naAlg.k && (chip() === null) === naAlg.chip && (!zicht()) === naAlg.pijl,
        'identiek aan de eerste wissel',
        richtingLockKeuze + ', chip ' + (chip() === null) + ', pijl-uit ' + !zicht());

    // ══ T5 — DE DRIE RICHTINGEN ONGEWIJZIGD ═══════════════════
    let regressieOk = true, detail = [];
    for (const r of ['links', 'rechtdoor', 'rechts']) {
      opnieuw(r);
      const c = chipTxt();
      if (c !== null) { regressieOk = false; detail.push(r + ': ' + c); }
    }
    eis('T5 geen van de drie richtingen levert nog een koppelaanbod op',
        regressieOk, '3x geen chip', detail.length ? detail.join(' | ') : '3x geen chip');
    opnieuw(null);
    eis('T5b zonder keuze staat er geen chip — ongewijzigd gedrag',
        chip() === null, 'geen chip', String(chipTxt()));

    // ══ T6 — DE STANDAARDWAARDE BLIJFT null ═══════════════════
    // Een node waar nog nooit iets is gekozen mag niet doen alsof Algemeen
    // gekozen is: de logvelden zouden dan op elke regel 'algemeen' schrijven en
    // 'niets aangeraakt' zou onzichtbaar worden.
    opnieuw(null);
    eis('T6 zonder keuze is richtingLockKeuze null en niet algemeen',
        richtingLockKeuze === null, 'null', String(richtingLockKeuze));
    eis('T6b en de pijl staat dan ook niet aan',
        !zicht(), 'verborgen', indic().style.display);
    eis('T6c een onbekende waarde valt niet terug op een verzonnen rechtdoor',
        (updateAfrijRichtingUI(null, String(NODE)), !zicht()),
        'verborgen', indic().textContent);

    // ══ T7 — DE PROJECTIE OP DE RIJRICHTING-AS ════════════════
    const proj = {};
    for (const v of ['links', 'rechtdoor', 'rechts', 'algemeen', null]) {
      richtingLockKeuze = v;
      proj[String(v)] = rijrichting();
    }
    eis('T7 de drie richtingen komen ongewijzigd door de projectie',
        proj.links === 'links' && proj.rechtdoor === 'rechtdoor' && proj.rechts === 'rechts',
        'links/rechtdoor/rechts', JSON.stringify(proj));
    eis('T7b algemeen is geen rijrichting en wordt null',
        proj.algemeen === null, 'null', String(proj.algemeen));
    eis('T7c en null blijft null',
        proj['null'] === null, 'null', String(proj['null']));

    // ══ T8 — WAT DE RIJRICHTING-AS ERVAN MERKT ════════════════
    // rijrichtingMatchScore is de bbox-bonus. Onder Algemeen mag hij geen
    // richting claimen; onder een echte richting moet hij precies doen wat hij
    // altijd deed.
    richtingLockKeuze = 'rechts';
    const bonusRechts = rijrichtingMatchScore(0.8, rijrichting());
    richtingLockKeuze = 'algemeen';
    const bonusAlg = rijrichtingMatchScore(0.8, rijrichting());
    eis('T8 de bbox-bonus werkt onverminderd voor een echte richting',
        bonusRechts === 0.20, '0.20', String(bonusRechts));
    eis('T8b en claimt niets onder Algemeen',
        bonusAlg === 0, '0', String(bonusAlg));

    // De richtingknoppen: een Algemeen-keuze mag ze niet blokkeren zoals een
    // richting-lock dat doet.
    richtingLockNodeId = String(NODE);
    richtingLockKeuze = 'rechts';
    const blokRichting = (richtingLockNodeId === String(NODE) && rijrichting()) ? true : false;
    richtingLockKeuze = 'algemeen';
    const blokAlg = (richtingLockNodeId === String(NODE) && rijrichting()) ? true : false;
    eis('T8c een richting-lock blijft de knoppen onderdrukken',
        blokRichting === true, 'true', String(blokRichting));
    eis('T8d een Algemeen-keuze doet dat niet',
        blokAlg === false, 'false', String(blokAlg));

    // ══ T9 — sl_enkelricht_ ONGEMOEID ═════════════════════════
    // De koppeling zelf: opslaan, lezen, wissen. Geen enkele van deze drie
    // raakt richtingLockKeuze aan en omgekeerd.
    zetLS('sl_enkelricht_' + NODE, null);
    zetEnkelRicht(String(NODE), 'rechts');
    eis('T9 zetEnkelRicht schrijft en laadEnkelRicht leest, zoals altijd',
        laadEnkelRicht(String(NODE)) === 'rechts', "'rechts'", String(laadEnkelRicht(String(NODE))));
    richtingLockKeuze = 'algemeen';
    eis('T9b de koppeling overleeft een Algemeen-keuze',
        laadEnkelRicht(String(NODE)) === 'rechts', "'rechts'", String(laadEnkelRicht(String(NODE))));
    opnieuw('algemeen');
    eis('T9c de rij draagt nu de RICHTING als naam, niet het woord Algemeen',
        algTxt() !== null && algTxt().indexOf('Rechtsaf') === 0
        && algTxt().indexOf('Rond licht') < 0,
        "'Rechtsaf ✕'", String(algTxt()));
    eis('T9c2 en de losmaak-knop blijft bereikbaar',
        chipTxt() === '✕', "'✕'", String(chipTxt()));
    wisEnkelRicht(String(NODE));
    eis('T9d wisEnkelRicht haalt hem weg zoals voorheen',
        laadEnkelRicht(String(NODE)) === null, 'null', String(laadEnkelRicht(String(NODE))));

    // ══ T10 — KOPPELEN GAAT NU VIA HET PANEEL ═════════════════
    // V11.18.18: koppelEnkelRicht was de klikafhandeling van de verwijderde chip
    // en is met hem verdwenen. Koppelen gebeurt sindsdien uitsluitend bewust,
    // vanuit het node-info-paneel, met een EXPLICIETE richting in plaats van
    // "de richting die nu toevallig actief is".
    zetLS('sl_enkelricht_' + NODE, null);
    eis('T10 het oude, impliciete koppelpad bestaat niet meer',
        typeof koppelEnkelRicht === 'undefined', 'weg', typeof koppelEnkelRicht);
    koppelVanuitPaneel(String(NODE), 'onzin');
    eis('T10b een onbekende richting schrijft niets',
        laadEnkelRicht(String(NODE)) === null, 'null', String(laadEnkelRicht(String(NODE))));
    koppelVanuitPaneel(String(NODE), 'rechtdoor');
    eis('T10c met een echte richting koppelt het paneel wel',
        laadEnkelRicht(String(NODE)) === 'rechtdoor',
        "'rechtdoor'", String(laadEnkelRicht(String(NODE))));

    // ══ T11 — DE ONTKAPPING VOLGT DEZELFDE REGEL ══════════════
    // De enkelricht-ontkapping (r3410) vergelijkt de markering met de rijrichting.
    // Onder Algemeen is er geen rijrichting, dus valt hij terug op de veilige,
    // gecapte klasse in plaats van zekerheid te claimen die er niet is.
    zetEnkelRicht(String(NODE), 'rechts');
    richtingLockKeuze = 'rechts';
    const matchRechts = (laadEnkelRicht(String(NODE)) === rijrichting());
    richtingLockKeuze = 'algemeen';
    const matchAlg = (laadEnkelRicht(String(NODE)) === rijrichting());
    eis('T11 de markering matcht de rijrichting waarvoor hij gezet is',
        matchRechts === true, 'true', String(matchRechts));
    eis('T11b en matcht niet onder Algemeen — geen ongegronde ontkapping',
        matchAlg === false, 'false', String(matchAlg));

    // ══ T11 — DE KEUZE IS NODE-GEBONDEN (het 158 m-beeld) ═════
    // De wisregel bij een node-wissel eist `lockAf > 60 && snelheidKmh > 5`.
    // Sta je stil voor rood, dan wordt de lock NIET gewist en reist de richting
    // van het vorige kruispunt mee. De weergave moet dat zelf opvangen.
    const NODE_B = 991202;
    // T10b liet een koppeling op NODE achter; die zou hier de erMark-tak laten
    // vuren en elke chip-toets een losmaak-kruisje geven in plaats van het aanbod.
    zetLS('sl_enkelricht_' + NODE, null);
    zetLS('sl_v4_' + NODE_B + '_' + DD_NU, JSON.stringify(recs(8, 60)));
    zetLS('sl_richting_' + NODE_B, JSON.stringify({
      headings: [0, 2, 1, 3, 0, 1, 2, 1], laatste_update: nu, bevestigingen: 8 }));
    zetLS('sl_neutraal_' + NODE_B, null);
    zetLS('sl_enkelricht_' + NODE_B, null);

    richtingLockNodeId = String(NODE);
    richtingLockKeuze = 'rechts';
    richtingLockBron = 'tik';
    eis('T11 lockGeldigVoor geeft de keuze voor de eigen node',
        lockGeldigVoor(String(NODE)) === 'rechts', "'rechts'",
        String(lockGeldigVoor(String(NODE))));
    eis('T11b en niets voor een ANDERE node',
        lockGeldigVoor(String(NODE_B)) === null, 'null',
        String(lockGeldigVoor(String(NODE_B))));
    eis('T11c ook de rijrichting-projectie is node-gebonden',
        rijrichtingVoor(String(NODE)) === 'rechts' && rijrichtingVoor(String(NODE_B)) === null,
        "'rechts' / null",
        rijrichtingVoor(String(NODE)) + ' / ' + rijrichtingVoor(String(NODE_B)));
    eis('T11d en een ontbrekende node geeft nooit een keuze terug',
        lockGeldigVoor(null) === null && lockGeldigVoor(undefined) === null,
        'null', lockGeldigVoor(null) + ' / ' + lockGeldigVoor(undefined));

    // Renderplek 1 — V11.18.18: de chip bestaat niet meer, dus staat hij op
    // geen van beide kruispunten. De node-gebondenheid zelf is hierboven
    // getoetst met rijrichtingVoor (T11c/T11d) en hieronder met de indicator.
    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'A' };
    getoondeLaag = null; bijwerkLeerkaart(dichtstbijOSM);
    const chipOpA = chipTxt();
    dichtstbijOSM = { id: NODE_B, lat: 52.0, lon: 4.7, afstand: 158, naam: 'B' };
    getoondeLaag = null; bijwerkLeerkaart(dichtstbijOSM);
    eis('T11e er is nergens meer een koppelvraag — niet op A en niet op B',
        chipOpA === null && chip() === null,
        'geen chip op A en geen op B',
        'A: ' + chipOpA + ' | B: ' + chipTxt());
    // Renderplek 2 — de indicator: hetzelfde.
    eis('T11f en de pijl van A staat niet bij B in beeld',
        !zicht(), 'verborgen', indic().textContent);
    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'A' };
    bijwerkLeerkaart(dichtstbijOSM);
    eis('T11g terug bij A staat hij er weer — de lock is niet gewist, alleen niet getoond',
        zicht() && richtingLockKeuze === 'rechts',
        'zichtbaar, lock intact',
        (zicht() ? 'zichtbaar' : 'verborgen') + ', lock ' + richtingLockKeuze);

    // ══ T12 — GEEN CHIP, ONGEACHT DE HERKOMST ═════════════════
    // V11.18.18: dit onderscheid (wel een chip bij een tik, geen bij een
    // herstel) was de reparatie van V11.17.96. Nu het aanbod zelf weg is, geldt
    // voor beide herkomsten hetzelfde: geen chip.
    opnieuw('rechts', 'tik');
    const chipTik = chipTxt();
    opnieuw('rechts', 'hersteld');
    eis('T12 een tik geeft evenmin een chip als een herstel',
        chipTik === null && chip() === null,
        'beide geen chip', 'tik: ' + chipTik + ' | hersteld: ' + chipTxt());
    eis('T12b de indicator volgt nog wel gewoon de lock',
        zicht() && indic().textContent.indexOf('rechtsaf') >= 0,
        'zichtbaar bij een gezette lock', zicht() ? indic().textContent : 'verborgen');
    wisRichtingLock();
    eis('T12c wisRichtingLock laat geen herkomst achter',
        richtingLockKeuze === null && richtingLockNodeId === null && richtingLockBron === null,
        'alle drie null',
        [richtingLockKeuze, richtingLockNodeId, richtingLockBron].join(' / '));

    // ══ T13 — HET WOORD ALGEMEEN VERDWIJNT VOLLEDIG ═══════════
    zetLS('sl_enkelricht_' + NODE, null);
    eis('T13 zonder koppeling heet de ronde categorie Rond licht (V11.18.11)',
        algemeenLabel(String(NODE)).tekst === 'Rond licht'
        && algemeenLabel(String(NODE)).pijl === '⬤'
        && algemeenLabel(String(NODE)).gekoppeld === false,
        'Rond licht, niet gekoppeld',
        JSON.stringify(algemeenLabel(String(NODE))));
    zetEnkelRicht(String(NODE), 'rechts');
    eis('T13b met koppeling heet hij naar de richting',
        algemeenLabel(String(NODE)).tekst === 'Rechtsaf'
        && algemeenLabel(String(NODE)).pijl === '→'
        && algemeenLabel(String(NODE)).gekoppeld === true,
        'Rechtsaf, gekoppeld',
        JSON.stringify(algemeenLabel(String(NODE))));

    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'A' };
    opnieuw('algemeen');
    eis('T13c in het rijblok staat Rond licht (of het oude Algemeen) nergens meer',
        document.getElementById('richting-blok-body').textContent.indexOf('Rond licht') < 0
        && document.getElementById('richting-blok-body').textContent.indexOf('Algemeen') < 0,
        'geen Rond licht',
        document.getElementById('richting-blok-body').textContent.slice(0, 80));
    nodeInfoNodeId = String(NODE);
    renderNodeInfo(String(NODE));
    const infoTxt = document.getElementById('node-info-body').textContent;
    eis('T13d ook in het node-info-paneel niet — rij noch koppelstrip',
        infoTxt.indexOf('Rond licht') < 0 && infoTxt.indexOf('Algemeen') < 0
        && infoTxt.indexOf('Rechtsaf') >= 0,
        'geen Rond licht, wel Rechtsaf', infoTxt.slice(0, 120));
    eis('T13e en de gedeelde labelhelper geeft de richting door aan elke aanroeper',
        rijdersPijlLabel('ALG', 'ALG', String(NODE)).tekst === 'Rechtsaf'
        && rijdersPijlLabel('ALG', 'ALG').tekst === 'Rond licht',
        'met node Rechtsaf, zonder node Rond licht',
        rijdersPijlLabel('ALG', 'ALG', String(NODE)).tekst + ' / ' + rijdersPijlLabel('ALG', 'ALG').tekst);
    eis('T13f de indicator toont bij Algemeen de richting in plaats van het ronde teken',
        zicht() && indic().textContent.indexOf('rechtsaf') >= 0,
        'voor rechtsaf', indic().textContent);
    wisEnkelRicht(String(NODE));
    opnieuw('algemeen');
    eis('T13g losmaken brengt de naam Rond licht terug',
        document.getElementById('richting-blok-body').textContent.indexOf('Rond licht') >= 0
        && algemeenLabel(String(NODE)).gekoppeld === false,
        'Rond licht terug',
        document.getElementById('richting-blok-body').textContent.slice(0, 60));

    // ══ T14 — DE WISREGEL ZELF IS NIET AANGERAAKT ═════════════
    // De node-wisselregel dient de countdown-continuiteit. A2 repareert de
    // WEERGAVE en mag die regel niet verkorten.
    const bronNW = String(updateDichtbij).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T14 de wisvoorwaarde bij een node-wissel staat er ongewijzigd',
        /lockAf > 60 && snelheidKmh > 5/.test(bronNW),
        'lockAf > 60 && snelheidKmh > 5',
        /lockAf > 60/.test(bronNW) ? 'aanwezig' : 'NIET GEVONDEN');

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
    richtingGedruktVoorNode = bewaard.richtingGedruktVoorNode;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    richtingTekort = bewaard.richtingTekort;
    huidigCdBron = bewaard.huidigCdBron;
    // De indicator terug op wat er stond: tikRichting en de nieuwe
    // Algemeen-tak schrijven allebei in dit element, dus een achtergebleven
    // pijl zou in het echte scherm blijven hangen na een testrun.
    const el = document.getElementById('v9-richting-indicator');
    if (el) { el.innerHTML = bewaard.indicHtml; el.style.display = bewaard.indicDisp; }
    const blok = document.getElementById('richting-blok-body');
    if (blok && bewaard.blokHtml != null) blok.innerHTML = bewaard.blokHtml;
    // tikRichting plant een verbergRichtingKnoppen op 1200ms; die zou na de
    // suite alsnog vuren. Nu meteen, zodat er geen losse timer overblijft.
    try { verbergRichtingKnoppen(); } catch (e) {}
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testAlgemeenKeuze = testAlgemeenKeuze;
