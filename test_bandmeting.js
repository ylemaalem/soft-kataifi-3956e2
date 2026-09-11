// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_bandmeting.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.0 (Countdown Release B, variant A): KLOPTE en BIJNA lichten
//  op binnen een VAST venster rond het verwachte nulpunt — ±2s en ±10s —
//  ongeacht hoe breed of smal de voorspellingsband is.
//
//  VARIANT A, EN WAAROM DAT VERSCHIL ERTOE DOET
//  Het oude ontwerp mat de afwijking tot de band [cdMin, cdMax]. Bij een band
//  van ±8s zou KLOPTE dan twintig seconden fel staan in plaats van vier. Op de
//  export van 28 augustus is de mediane band 5s en de p90 21s, dus dat venster
//  zou per kruispunt van 4 tot 46 seconden variëren zonder dat de gebruiker
//  ziet waarom. T4 en T4b zijn de scherpste toetsen daarop: valt een van die
//  twee, dan is variant B teruggeslopen.
//
//  T4b IS EEN ECHT, GEFOTOGRAFEERD GEVAL
//  Hogeweg Amersfoort, 11 september 2026: de pill toonde '~39s ±46' en de
//  BIJNA-knop stond fel. Negenendertig seconden ligt ver buiten ±10s, dus die
//  knop hoorde grijs te zijn. Dat scenario staat hier letterlijk in.
//
//  DE INVARIANT
//  KLOPTE en BIJNA mogen nooit tegelijk fel zijn. Sinds deze release volgt dat
//  uit de wiskunde — de banden |afw| <= 2000 en |afw| <= 10000 zijn disjunct
//  gemaakt door de volgorde — in plaats van uit de volgorde van twee losse
//  poorten. T6 loopt daarvoor een heel venster af, seconde voor seconde.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_bandmeting.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testBandmeting().regels);
// ═══════════════════════════════════════════════════════════════

function testBandmeting() {
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

  const NODE = 997301;
  const DD_NU = huidigDDActief();
  const nu = Date.now();

  const bewaard = {
    fase, faseNodeId, groenStart, cdStart, cdWallStart, cdWallNodeId,
    activeCdDoel, activeCdModus, activeCdMin, activeCdMax,
    cdBereikteNul, countdownNulTijd, cdWeergaveNulTijd, dichtstbijOSM,
    bevestigActief, bevInertStaat, wrapClass: bevestigWrap.className,
    knopK: bevKlopteBtn.className, knopB: bevBijnaBtn.className, knopF: bevFoutBtn.className
  };

  // Een moment met een gegeven toestand en venster-afwijking, zonder de klok te
  // vervalsen: meetBevestigMoment leest globals, dus die zetten we. Voor de
  // rode toestanden is dat exact wat de app zelf doet.
  const roodOp = (afwMs) => {
    fase = 'rood'; groenStart = null;
    activeCdDoel = 40; activeCdModus = CD_ZEKER; activeCdMin = null; activeCdMax = null;
    dichtstbijOSM = { id: NODE, lat: 52, lon: 4.7, afstand: 20, naam: 'T' };
    if (afwMs < 0) {
      // nog voor nul: restMs = -afw, dus de klok staat op doel - (-afw)/1000
      cdBereikteNul = false; countdownNulTijd = null;
      cdStart = performance.now() - (activeCdDoel * 1000 + afwMs);
    } else {
      // voorbij nul: overschrMs = nu - countdownNulTijd
      cdBereikteNul = true; countdownNulTijd = Date.now() - afwMs;
      cdStart = performance.now() - activeCdDoel * 1000 - afwMs;
    }
    return meetBevestigMoment();
  };
  // Groen dat te vroeg viel: afwijkingMs komt uit verwachtNulWand/groenWandTijd.
  const groenVoorNul = (afwMs) => {
    fase = 'groen';
    activeCdDoel = 40; activeCdModus = CD_ZEKER; activeCdMin = null; activeCdMax = null;
    dichtstbijOSM = { id: NODE, lat: 52, lon: 4.7, afstand: 20, naam: 'T' };
    cdBereikteNul = false; countdownNulTijd = null; cdStart = null;
    cdWallNodeId = String(NODE);
    // groen viel afwMs vóór het verwachte nul -> cdWallStart zo kiezen dat
    // verwachtNulWand precies dat oplevert
    const groenWand = Date.now();
    cdWallStart = groenWand - afwMs - activeCdDoel * 1000;
    groenStart = performance.now();
    return meetBevestigMoment();
  };
  const groenNaNul = (afwMs) => {
    fase = 'groen';
    activeCdDoel = 40; activeCdModus = CD_ZEKER; activeCdMin = null; activeCdMax = null;
    dichtstbijOSM = { id: NODE, lat: 52, lon: 4.7, afstand: 20, naam: 'T' };
    cdBereikteNul = true; countdownNulTijd = Date.now() - afwMs;
    cdWallNodeId = String(NODE); cdWallStart = Date.now() - activeCdDoel * 1000 - afwMs;
    groenStart = performance.now();
    return meetBevestigMoment();
  };
  const staat = (m) => ({
    indeling: bevestigIndeling(m),
    klopteFel: !klopteIsNoOp(m),
    bijnaFel:  !bijnaIsNoOp(m)
  });

  try {
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({
        duur: 40, tijd: nu - i * 3600000, richting: 0, obs: 40,
        gewicht: 0.89, bron: 's1' }))));
    zetLS('sl_neutraal_' + NODE, null);

    // ══ T12 — DE GRENZEN ZIJN NIET VERSCHOVEN ═════════════════
    eis('T12 BEV_GOED_MAX_MS is nog 2000 en BEV_BIJNA_MAX_MS nog 10000',
        BEV_GOED_MAX_MS === 2000 && BEV_BIJNA_MAX_MS === 10000,
        '2000 / 10000', BEV_GOED_MAX_MS + ' / ' + BEV_BIJNA_MAX_MS);

    // ══ T1 — KLOPTE-VENSTER: −2s TOT +2s ══════════════════════
    const binnen = [-2000, -1500, -500, 0, 500, 1500, 2000];
    const misK = [];
    for (const a of binnen) {
      const s1 = staat(a < 0 ? roodOp(a) : (a === 0 ? roodOp(0) : roodOp(a)));
      if (!(s1.klopteFel && !s1.bijnaFel)) misK.push(a + 'ms: ' + JSON.stringify(s1));
    }
    eis('T1 tussen -2s en +2s is KLOPTE fel en BIJNA grijs',
        misK.length === 0, '7 momenten goed',
        misK.length ? misK.join(' | ') : '7 momenten goed');
    // Ook als groen al gevallen is, aan beide kanten.
    const gv = staat(groenVoorNul(-1200));
    const gn = staat(groenNaNul(1200));
    eis('T1b ook bij groen dat 1,2s te vroeg viel',
        gv.klopteFel && !gv.bijnaFel, 'KLOPTE fel', JSON.stringify(gv));
    eis('T1c en bij groen dat 1,2s te laat viel',
        gn.klopteFel && !gn.bijnaFel, 'KLOPTE fel', JSON.stringify(gn));

    // ══ T2 — BIJNA-VENSTER: −10..−2 EN +2..+10 ════════════════
    const bijnaZone = [-10000, -8000, -5000, -2001, 2001, 5000, 8000, 10000];
    const misB = [];
    for (const a of bijnaZone) {
      const s2 = staat(roodOp(a));
      if (!(s2.bijnaFel && !s2.klopteFel)) misB.push(a + 'ms: ' + JSON.stringify(s2));
    }
    eis('T2 tussen -10s en -2s en tussen +2s en +10s is BIJNA fel en KLOPTE grijs',
        misB.length === 0, '8 momenten goed',
        misB.length ? misB.join(' | ') : '8 momenten goed');

    // ══ T3 — BUITEN ±10s: BEIDE GRIJS ═════════════════════════
    const buiten = [-30000, -12000, -10001, 10001, 12000, 30000];
    const misU = [];
    for (const a of buiten) {
      const s3 = staat(roodOp(a));
      if (s3.klopteFel || s3.bijnaFel || s3.indeling !== 'fout') {
        misU.push(a + 'ms: ' + JSON.stringify(s3));
      }
    }
    eis('T3 buiten ±10s zijn beide grijs en luidt de indeling fout',
        misU.length === 0, '6 momenten grijs',
        misU.length ? misU.join(' | ') : '6 momenten grijs');

    // ══ T4 — EEN BREDE BAND VERANDERT HET VENSTER NIET ════════
    // Het scenario uit de herziening: cdMin = gem-8, cdMax = gem+8. Variant B
    // zou KLOPTE hier 20 seconden lang fel zetten; variant A houdt het op 4.
    const metBand = (afwMs, bandS) => {
      const m = roodOp(afwMs);
      activeCdModus = CD_VAAG;
      activeCdMin = activeCdDoel - bandS;
      activeCdMax = activeCdDoel + bandS;
      return staat(m);
    };
    const b8 = [-9000, -3000, -1000, 1000, 3000, 9000].map(a => ({ a, s: metBand(a, 8) }));
    eis('T4 met een band van ±8s blijft KLOPTE beperkt tot -2..+2',
        b8.filter(x => x.s.klopteFel).map(x => x.a).join(',') === '-1000,1000',
        'alleen -1000 en 1000',
        b8.filter(x => x.s.klopteFel).map(x => x.a).join(',') || 'geen enkele');
    eis('T4b en de band-momenten daarbuiten vallen netjes op BIJNA',
        b8.filter(x => x.s.bijnaFel).map(x => x.a).join(',') === '-9000,-3000,3000,9000',
        '-9000,-3000,3000,9000',
        b8.filter(x => x.s.bijnaFel).map(x => x.a).join(',') || 'geen enkele');

    // ══ T4c — HET GEFOTOGRAFEERDE GEVAL: ~39s ±46 ═════════════
    // Hogeweg Amersfoort, 11 september 2026. Negenendertig seconden voor nul,
    // met een band van 46 seconden. De BIJNA-knop stond toen fel; dat hoort niet.
    const hoge = (restS) => {
      fase = 'rood'; groenStart = null;
      dichtstbijOSM = { id: NODE, lat: 52, lon: 4.7, afstand: 20, naam: 'Hogeweg' };
      activeCdDoel = 39 + 0;             // de pill telde af naar 39s
      activeCdModus = CD_VAAG;
      activeCdMin = Math.max(1, activeCdDoel - 46);
      activeCdMax = activeCdDoel + 46;
      cdBereikteNul = false; countdownNulTijd = null;
      cdStart = performance.now() - (activeCdDoel - restS) * 1000;
      return staat(meetBevestigMoment());
    };
    const h39 = hoge(39);
    eis('T4c bij ~39s ±46 op 39 seconden voor nul is BIJNA GRIJS',
        !h39.bijnaFel && !h39.klopteFel && h39.indeling === 'fout',
        'beide grijs, fout', JSON.stringify(h39));
    const h11 = hoge(11), h9 = hoge(9), h1 = hoge(1);
    eis('T4c2 op 11 seconden nog steeds grijs',
        !h11.bijnaFel, 'grijs', JSON.stringify(h11));
    eis('T4c3 op 9 seconden wordt BIJNA fel — de band blijft even breed',
        h9.bijnaFel && !h9.klopteFel, 'BIJNA fel', JSON.stringify(h9));
    eis('T4c4 en op 1 seconde neemt KLOPTE het over',
        h1.klopteFel && !h1.bijnaFel, 'KLOPTE fel', JSON.stringify(h1));
    eis('T4c5 de band was al die tijd 46s breed — hij stuurt het venster niet',
        Math.round(cdBandBreedteS()) === 46, '46', String(Math.round(cdBandBreedteS())));

    // ══ T5 — DE GRENSWAARDEN EXACT ════════════════════════════
    const grens = {};
    for (const a of [-10001, -10000, -2001, -2000, 2000, 2001, 10000, 10001]) {
      grens[a] = bevestigIndeling(roodOp(a));
    }
    eis('T5 exact ±2000ms telt nog als goed, ±2001 als bijna',
        grens[-2000] === 'goed' && grens[2000] === 'goed'
        && grens[-2001] === 'bijna' && grens[2001] === 'bijna',
        'goed/goed/bijna/bijna',
        [grens[-2000], grens[2000], grens[-2001], grens[2001]].join('/'));
    eis('T5b exact ±10000ms telt nog als bijna, ±10001 als fout',
        grens[-10000] === 'bijna' && grens[10000] === 'bijna'
        && grens[-10001] === 'fout' && grens[10001] === 'fout',
        'bijna/bijna/fout/fout',
        [grens[-10000], grens[10000], grens[-10001], grens[10001]].join('/'));

    // ══ T6 — NOOIT TEGELIJK FEL (RV3) ═════════════════════════
    // Een heel venster aflopen in stappen van 250ms, plus de vier toestanden.
    let tegelijk = 0, eersteFout = null;
    for (let a = -15000; a <= 15000; a += 250) {
      const s6 = staat(roodOp(a));
      if (s6.klopteFel && s6.bijnaFel) { tegelijk++; if (eersteFout === null) eersteFout = a; }
    }
    eis('T6 KLOPTE en BIJNA staan nergens tegelijk fel',
        tegelijk === 0, '0 momenten',
        tegelijk ? tegelijk + ' momenten, eerste op ' + eersteFout + 'ms' : '0 momenten');
    const gGv = staat(groenVoorNul(-5000)), gGn = staat(groenNaNul(5000));
    eis('T6b ook niet in de twee groen-toestanden',
        !(gGv.klopteFel && gGv.bijnaFel) && !(gGn.klopteFel && gGn.bijnaFel),
        'nergens tegelijk',
        JSON.stringify(gGv) + ' / ' + JSON.stringify(gGn));
    // De invariant volgt uit disjuncte banden, niet uit volgorde.
    eis('T6c de twee banden sluiten elkaar per constructie uit',
        BEV_GOED_MAX_MS < BEV_BIJNA_MAX_MS,
        '2000 < 10000', BEV_GOED_MAX_MS + ' < ' + BEV_BIJNA_MAX_MS);

    // ══ T7 — FOUT IS NOOIT GEDEMPT (RV4) ══════════════════════
    bevestigActief = true;
    let foutGedempt = 0;
    for (const a of [-30000, -5000, -1000, 0, 1000, 5000, 30000]) {
      roodOp(a);
      updateBevestigKnopStaat();
      if (bevFoutBtn.classList.contains('inert')) foutGedempt++;
    }
    eis('T7 FOUT blijft in elke toestand beschikbaar',
        foutGedempt === 0, '0 keer gedempt', foutGedempt + ' keer gedempt');

    // ══ T10 — GEEN BAND, GEEN NaN ═════════════════════════════
    // Buiten CD_VAAG zijn cdMin/cdMax null. Als getal behandeld geeft dat NaN,
    // en `NaN <= 2000` is false — een knop die stilzwijgend nooit meer oplicht.
    activeCdMin = null; activeCdMax = null; activeCdModus = CD_GESCHAT;
    const zonderBand = staat(roodOp(-1000));
    eis('T10 zonder band werkt het venster gewoon',
        zonderBand.klopteFel && zonderBand.indeling === 'goed',
        'KLOPTE fel', JSON.stringify(zonderBand));
    eis('T10b cdBandBreedteS geeft 0 en geen NaN',
        cdBandBreedteS() === 0, '0', String(cdBandBreedteS()));
    activeCdMax = 'onzin';
    eis('T10c en ook op een onzinnige waarde blijft hij 0',
        cdBandBreedteS() === 0, '0', String(cdBandBreedteS()));

    // ══ T9 — HET KLOPTE-GEWICHT (WIJZIGING 6) ═════════════════
    eis('T9 bij band 0 is het gewicht exact 0,4 — ongewijzigd gedrag',
        klopteGewicht(0) === 0.4 && klopteGewicht(null) === 0.4
        && klopteGewicht(undefined) === 0.4,
        '3x 0.4',
        [klopteGewicht(0), klopteGewicht(null), klopteGewicht(undefined)].join('/'));
    const reeks = [0, 3, 5, 10, 21, 46, 128].map(b => klopteGewicht(b));
    let monotoon = true;
    for (let i = 1; i < reeks.length; i++) if (reeks[i] > reeks[i - 1]) monotoon = false;
    eis('T9b het gewicht daalt monotoon met de bandbreedte',
        monotoon, 'monotoon dalend',
        reeks.map((g, i) => [0, 3, 5, 10, 21, 46, 128][i] + 's:' + g.toFixed(3)).join(' '));
    eis('T9c tien seconden band halveert het gewicht',
        Math.abs(klopteGewicht(10) - 0.2) < 0.0001, '0.20', klopteGewicht(10).toFixed(3));
    eis('T9d en het zakt nooit onder de ondergrens',
        reeks.every(g => g >= KLOPTE_GEWICHT_MIN) && klopteGewicht(100000) === KLOPTE_GEWICHT_MIN,
        '>= ' + KLOPTE_GEWICHT_MIN, Math.min(...reeks).toFixed(3));
    eis('T9e een brede band weegt aantoonbaar minder dan een smalle',
        klopteGewicht(46) < klopteGewicht(5) && klopteGewicht(5) < klopteGewicht(0),
        '46s < 5s < 0s',
        [klopteGewicht(46), klopteGewicht(5), klopteGewicht(0)].map(x => x.toFixed(3)).join(' < '));

    // ══ T8 — DE FOUT-TAK KENT TWEE RICHTINGEN (WIJZIGING 5) ═══
    const leesV4 = () => { try { return JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU)) || []; } catch (e) { return []; } };
    const basis = Array.from({ length: 8 }, (_, i) => ({
      duur: 40, tijd: nu - i * 3600000, richting: 0, obs: 40, gewicht: 0.89, bron: 's1' }));
    const foutMet = (afwMs) => {
      zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(basis));
      verwerkBevestigLeren(NODE, 'fout', { toestand: 'groen-na-nul', vensterAfwMs: afwMs });
      return leesV4().filter(x => x.bron === 'bevestig_fout').map(x => x.duur);
    };
    const teLaat = foutMet(20000), teVroeg = foutMet(-20000);
    eis('T8 een te laat gevallen groen rekt de schatting op',
        teLaat.length === 1 && teLaat[0] === Math.round(40 * 1.6),
        String(Math.round(40 * 1.6)), teLaat.join(','));
    eis('T8b een te vroeg gevallen groen kort hem in',
        teVroeg.length === 1 && teVroeg[0] === Math.round(40 / 1.6),
        String(Math.round(40 / 1.6)), teVroeg.join(','));
    const onbekend = foutMet(null);
    eis('T8c bij een onbekend teken blijft het oude gedrag staan',
        onbekend.length === 1 && onbekend[0] === Math.round(40 * 1.6),
        String(Math.round(40 * 1.6)), onbekend.join(','));
    // De klem werkt aan beide kanten: 4s / 1,6 = 2,5s valt onder de 5.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(
      Array.from({ length: 6 }, (_, i) => ({
        duur: 6, tijd: nu - i * 3600000, richting: 0, obs: 6, gewicht: 0.13, bron: 's1' }))));
    zetLS('sl_opslaglog', null);
    verwerkBevestigLeren(NODE, 'fout', { toestand: 'groen-na-nul', vensterAfwMs: -20000 });
    const geklemd = leesV4().filter(x => x.bron === 'bevestig_fout');
    let grensLog = [];
    try { grensLog = (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === 'bevestig_fout_grens'); } catch (e) {}
    eis('T8d de klem werkt ook op de krimpkant',
        geklemd.length === 0 && grensLog.length === 1,
        'niets geschreven, wel gelogd',
        geklemd.length + ' records, ' + grensLog.length + ' grenslogs');

    // ══ T11 — DE POORT OP DE KLOPTE-TAK (WIJZIGING 7) ═════════
    // Gekozen optie: alleen schrijven als groen daadwerkelijk gevallen is.
    const klopteMet = (mom) => {
      zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(basis));
      zetLS('sl_opslaglog', null);
      activeCdMin = null; activeCdMax = null; activeCdDoel = 40;
      verwerkBevestigLeren(NODE, 'klopte', mom);
      const rec = leesV4().filter(x => x.bron === 'bevestig_klopte');
      let log = [];
      try { log = (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === 'klopte_onbewezen'); } catch (e) {}
      return { records: rec.length, gewicht: rec.length ? rec[0].gewicht : null, onbewezen: log.length };
    };
    const voorNul = klopteMet({ toestand: 'rood-voor-nul', vensterAfwMs: -1500 });
    eis('T11 een KLOPTE in het venster vóór nul schrijft NIETS naar het leergeheugen',
        voorNul.records === 0, '0 records', voorNul.records + ' records');
    eis('T11b maar wordt wel geteld, zodat het meetbaar blijft',
        voorNul.onbewezen === 1, '1 logregel', voorNul.onbewezen + ' logregels');
    const naNul = klopteMet({ toestand: 'groen-na-nul', vensterAfwMs: 1500 });
    eis('T11c zodra groen gevallen is schrijft hij wel',
        naNul.records === 1, '1 record', naNul.records + ' records');
    const vroegGroen = klopteMet({ toestand: 'groen-voor-nul', vensterAfwMs: -1500 });
    eis('T11d ook als groen net vóór het nulpunt viel — dat is net zo goed bewezen',
        vroegGroen.records === 1, '1 record', vroegGroen.records + ' records');
    const zandloper = klopteMet({ toestand: 'rood-na-nul', vensterAfwMs: 1500 });
    eis('T11e en tijdens de zandloper, waar groen nog niet viel, schrijft hij niet',
        zandloper.records === 0 && zandloper.onbewezen === 1,
        '0 records, 1 log', zandloper.records + ' records, ' + zandloper.onbewezen + ' logs');
    // Het gewicht dat hij dan schrijft volgt de band.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(basis));
    activeCdDoel = 40; activeCdMin = 40 - 30; activeCdMax = 40 + 30;
    verwerkBevestigLeren(NODE, 'klopte', { toestand: 'groen-na-nul', vensterAfwMs: 500 });
    const breedRec = leesV4().filter(x => x.bron === 'bevestig_klopte');
    eis('T11f en dat gewicht volgt de bandbreedte (wijziging 6 in de praktijk)',
        breedRec.length === 1 && Math.abs(breedRec[0].gewicht - klopteGewicht(30)) < 0.011,
        klopteGewicht(30).toFixed(2), breedRec.length ? String(breedRec[0].gewicht) : 'GEEN RECORD');

    // ══ T13 — DE BIJNA-CORRECTIE GAAT NU TWEE KANTEN OP ═══════
    const bijnaMet = (afwMs, toestand) => {
      zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(basis));
      verwerkBevestigLeren(NODE, 'bijna', { toestand, vensterAfwMs: afwMs });
      return leesV4().filter(x => x.bron === 'bevestig_bijna').map(x => x.duur);
    };
    eis('T13 een BIJNA op groen dat 6s te laat viel stelt naar boven bij',
        bijnaMet(6000, 'groen-na-nul').join(',') === '46', '46',
        bijnaMet(6000, 'groen-na-nul').join(','));
    eis('T13b en op groen dat 6s te vroeg viel naar beneden',
        bijnaMet(-6000, 'groen-voor-nul').join(',') === '34', '34',
        bijnaMet(-6000, 'groen-voor-nul').join(','));
    eis('T13c in een rode toestand corrigeert hij niet — daar is niets bewezen',
        bijnaMet(6000, 'rood-na-nul').length === 0, '0 records',
        String(bijnaMet(6000, 'rood-na-nul').length));

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    fase = bewaard.fase; faseNodeId = bewaard.faseNodeId; groenStart = bewaard.groenStart;
    cdStart = bewaard.cdStart; cdWallStart = bewaard.cdWallStart;
    cdWallNodeId = bewaard.cdWallNodeId;
    activeCdDoel = bewaard.activeCdDoel; activeCdModus = bewaard.activeCdModus;
    activeCdMin = bewaard.activeCdMin; activeCdMax = bewaard.activeCdMax;
    cdBereikteNul = bewaard.cdBereikteNul; countdownNulTijd = bewaard.countdownNulTijd;
    cdWeergaveNulTijd = bewaard.cdWeergaveNulTijd; dichtstbijOSM = bewaard.dichtstbijOSM;
    // De bevestigbalk terug: updateBevestigKnopStaat hierboven zet klassen, en
    // een achtergebleven overgang laat test_knopkleur omvallen (zie
    // test_richting_ui en test_cd_continuiteit, die dezelfde val raakten).
    bevestigActief = bewaard.bevestigActief;
    bevInertStaat = bewaard.bevInertStaat;
    bevestigWrap.className = bewaard.wrapClass;
    bevKlopteBtn.className = bewaard.knopK;
    bevBijnaBtn.className  = bewaard.knopB;
    bevFoutBtn.className   = bewaard.knopF;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testBandmeting = testBandmeting;
