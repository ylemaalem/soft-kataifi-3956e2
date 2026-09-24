// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_bbox_autoslot.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.21.0, release 2c van het bbox-slot: het slot zonder tap.
//  Dit is de reparatie van klacht 1 — de box springt tussen lampen.
//
//  DE OORZAAK
//  De app had geen identiteit voor "welke lamp volg ik", alleen een score die
//  elke run opnieuw bepaalt welke box het beste OOG. centerScore weegt 80,
//  trackScore — de enige continuïteit — 60. Rijd je een kruising op of maak je
//  een bocht, dan schuift jouw lamp uit het midden en wint de buurlamp.
//
//  DE VALKUIL DIE NIET HERHAALD MAG WORDEN
//  V11.10.0 had hier een echt slot (LOCK 1). Dat is in V11.15.3 uitgezet omdat
//  het een NIEUWE TAP blokkeerde. Daarom woont dit slot in stickyDetectie zelf:
//  elke plek die dat object nult — de tap-handler, de node-wissel, GPS-voorbij,
//  de volledige reset — ruimt het slot vanzelf op. A5 bewaakt dat.
//
//  A1  het slot gaat dicht op de maat die V11.20.0 al bouwde
//  A2  KERN: één frame met een hoger scorende buurbox neemt het slot niet over
//  A3  KERN: ≥40% hoger gedurende ≥1,5 s wint het slot wél over
//  A4  is de lamp weg, dan valt het slot — maar pas na STICKY_MISS_MS
//  A5  het slot wijkt voor een tap en voor een node-wissel
//  A6  de vastgehouden box overleeft de harde filters van de scorelus
//  A7  REGRESSIE: de gedeelde matchkern gedraagt zich als voorheen
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_bbox_autoslot.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testBboxAutoslot().regels);
// ═══════════════════════════════════════════════════════════════

function testBboxAutoslot() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  const bewaard = {
    bboxOverride, bboxOverrideTijd, bboxOverrideLaatsteMatch, bboxOverrideMatchTeller,
    bboxOverrideCamX, bboxOverrideCamY,
    stickyDetectie, stickyMissTeller, tapSeedDetectie, autoSlotUitdager, bboxSlot,
    vorigeDetectie, dichtstbijOSM, huidigePos, snelheidKmh,
    bboxAnchorCx, bboxAnchorCy, bboxAnchorTijd, vergrendeldNodeId,
    voorkeursBboxCx, voorkeursBboxCy, voorkeursBboxRuns, voorkeursBboxTijd, voorkeursBboxStart,
    lbScale, lbPadX, lbPadY, cropRegio, headingBuffer: [...headingBuffer]
  };

  const det = (cx, cy, klasse = 0, score = 0.8, w = 20, h = 50) => {
    const a = new Array(NC).fill(0.001);
    a[klasse] = score;
    return { klasse, score, alleScores: a, cx, cy, w, h,
             x1: cx - w/2, y1: cy - h/2, x2: cx + w/2, y2: cy + h/2 };
  };

  // Schone stand. `vRijp` zet meteen een rijpe voorkeur op (cx, cy) neer, zodat
  // het slot bij de eerstvolgende run dichtgaat — anders zou elke toets 3,2
  // seconden moeten wachten.
  const opzet = (o) => {
    const opt = o || {};
    const nu = Date.now();
    bboxOverride = null; bboxOverrideTijd = 0; bboxOverrideLaatsteMatch = 0;
    bboxOverrideMatchTeller = 0; bboxOverrideCamX = null; bboxOverrideCamY = null;
    stickyDetectie = null; stickyMissTeller = 0; tapSeedDetectie = null;
    autoSlotReset();
    vorigeDetectie = null; vergrendeldNodeId = null;
    bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
    dichtstbijOSM = { id: 1, afstand: 40, lat: 52.0, lon: 4.7 };
    huidigePos = { lat: 52.0, lon: 4.7 };
    snelheidKmh = 0;
    lbScale = 1; lbPadX = 0; lbPadY = 0; cropRegio = null;
    headingBuffer.length = 0;
    if (opt.vRijp) {
      voorkeursBboxCx = opt.vRijp[0]; voorkeursBboxCy = opt.vRijp[1];
      voorkeursBboxRuns = 5; voorkeursBboxStart = nu - 5000; voorkeursBboxTijd = nu;
    } else {
      voorkeursBboxCx = null; voorkeursBboxCy = null;
      voorkeursBboxRuns = 0; voorkeursBboxTijd = 0; voorkeursBboxStart = 0;
    }
    bboxSlot = 'onbekend';
  };

  // DE FIXTURE, DOORGEREKEND. Alle detecties zijn verder gelijk, dus alleen de
  // centrering en de rijbaanpenalty verschillen:
  //   cx 320  pal in het midden        centerScore 80,0   penalty 1,00
  //   cx 430  34% uit het midden       centerScore 52,5   penalty 1,00
  //   cx 560  75% uit het midden       centerScore 20,0   penalty 0,25
  // De verhouding 320:430 is ongeveer 1,29 — BEWUST onder
  // AUTOSLOT_UITDAGER_FACTOR (1,40). Een box die alleen wat minder centraal
  // staat is geen overtuigende uitdager; dat is precies het springen waar deze
  // release vanaf wil. 320:560 ligt daar ver boven, want daar komt de
  // rijbaanpenalty bij — een lamp in een andere rijbaan.
  const MIDDEN = 320, ZIJ = 430, ANDERE_RIJBAAN = 560;

  // De uitdagersklok terugzetten zonder om te vallen als er geen uitdager is.
  // Een kale toewijzing zou bij een mutatietest een TypeError geven in plaats
  // van een nette GEFAALD-regel, en dan meet de mutatie niets.
  const klokTerug = (ms) => {
    if (!autoSlotUitdager) return false;
    autoSlotUitdager.sinds = Date.now() - ms;
    return true;
  };

  const slotOpZetten = (cx, cy) => {
    opzet({ vRijp: [cx, cy] });
    const r = selecteerBesteDetectie([det(cx, cy)]);
    return r;
  };

  try {
    // ═══ A1 — HET SLOT GAAT DICHT ════════════════════════════
    const rA = slotOpZetten(ANDERE_RIJBAAN, 210);
    eis('A1 een rijpe voorkeur sluit het slot op die box',
        !!rA.s1 && autoSlotActief() && stickyDetectie.bron === 'auto'
          && bboxSlot === 'vast',
        'slot dicht, bron auto',
        'actief=' + autoSlotActief() + ', bron=' + (stickyDetectie && stickyDetectie.bron));
    eis('A1b de maat is die van V11.20.0 — voorkeurIsRijp, geen nieuw getal',
        /voorkeurIsRijp\(\)/.test(zc(selecteerBesteDetectie))
          && VOORKEUR_MIN_RUNS === 3 && VOORKEUR_MIN_MS === 3200,
        '3 runs en 3200 ms', VOORKEUR_MIN_RUNS + ' / ' + VOORKEUR_MIN_MS);
    // zonder rijpe voorkeur blijft het slot open
    opzet();
    selecteerBesteDetectie([det(MIDDEN, 200)]);
    eis('A1c zonder rijpe voorkeur blijft de app vrij zoeken',
        autoSlotActief() === false && bboxSlot === 'vrij',
        'geen slot, vrij', autoSlotActief() + ', ' + bboxSlot);

    // ═══ A2 — ÉÉN FRAME NEEMT HET SLOT NIET OVER ═══════════════
    // Dit is het gedrag waar klacht 1 om draait.
    slotOpZetten(ANDERE_RIJBAAN, 210);
    const r2a = selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    eis('A2 een buurbox die pal in het midden staat en hóóg scoort, wint het ' +
        'slot niet in één frame',
        !!r2a.s1 && r2a.s1.cx === ANDERE_RIJBAAN,
        String(ANDERE_RIJBAAN), r2a.s1 ? String(r2a.s1.cx) : 'geen');
    eis('A2b maar de uitdager wordt wél genoteerd — de klok loopt',
        !!autoSlotUitdager && autoSlotUitdager.cx === MIDDEN,
        'uitdager op ' + MIDDEN,
        autoSlotUitdager ? String(autoSlotUitdager.cx) : 'geen');
    // vijf runs binnen hetzelfde ogenblik: nog steeds te kort
    let r2b;
    for (let i = 0; i < 5; i++) r2b = selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    eis('A2c ook vijf runs in hetzelfde ogenblik zijn niet genoeg — de eis is ' +
        'tijd, geen aantal',
        !!r2b.s1 && r2b.s1.cx === ANDERE_RIJBAAN,
        String(ANDERE_RIJBAAN), r2b.s1 ? String(r2b.s1.cx) : 'geen');
    // een box die alleen wat minder centraal staat, daagt niet eens uit
    slotOpZetten(ZIJ, 210);
    selecteerBesteDetectie([det(ZIJ, 210), det(MIDDEN, 200)]);
    eis('A2d een buurbox die maar 29% hoger scoort daagt niet uit — onder ' +
        'AUTOSLOT_UITDAGER_FACTOR',
        autoSlotUitdager === null, 'geen uitdager',
        autoSlotUitdager ? 'wel: ' + autoSlotUitdager.cx : 'geen');

    // ═══ A3 — OVERTUIGEND ÉN LANGDURIG WINT WÉL ════════════════
    slotOpZetten(ANDERE_RIJBAAN, 210);
    selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    klokTerug(AUTOSLOT_UITDAGER_MS + 100);
    const r3 = selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    eis('A3 na AUTOSLOT_UITDAGER_MS wint de uitdager het slot alsnog over',
        !!r3.s1 && r3.s1.cx === MIDDEN
          && stickyDetectie && Math.round(stickyDetectie.cx) === MIDDEN,
        String(MIDDEN) + ' + slot verhuisd',
        (r3.s1 ? r3.s1.cx : 'geen') + ' + slot op '
          + (stickyDetectie ? Math.round(stickyDetectie.cx) : 'weg'));
    eis('A3b en de uitdagersklok staat daarna weer op nul',
        autoSlotUitdager === null, 'null',
        autoSlotUitdager ? 'loopt nog' : 'null');
    // net te kort telt niet
    slotOpZetten(ANDERE_RIJBAAN, 210);
    selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    klokTerug(AUTOSLOT_UITDAGER_MS - 300);
    const r3c = selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    eis('A3c net onder de tijdsgrens houdt het slot nog vast',
        !!r3c.s1 && r3c.s1.cx === ANDERE_RIJBAAN,
        String(ANDERE_RIJBAAN), r3c.s1 ? String(r3c.s1.cx) : 'geen');
    // een onderbreking nult de klok: één run zonder uitdager en opnieuw beginnen
    slotOpZetten(ANDERE_RIJBAAN, 210);
    selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    klokTerug(AUTOSLOT_UITDAGER_MS - 200);
    selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210)]);            // uitdager weg
    const onderbroken = autoSlotUitdager;
    const r3d = selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    eis('A3d een onderbreking nult de klok — aaneengesloten betekent ook echt ' +
        'aaneengesloten',
        onderbroken === null && !!r3d.s1 && r3d.s1.cx === ANDERE_RIJBAAN,
        'klok genuld, slot houdt vast',
        'na onderbreking=' + onderbroken + ', gekozen=' + (r3d.s1 ? r3d.s1.cx : 'geen'));
    // een uitdager die wegspringt is een andere box en begint opnieuw
    slotOpZetten(ANDERE_RIJBAAN, 210);
    selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    klokTerug(AUTOSLOT_UITDAGER_MS + 500);
    // 230 en niet 120: het moet een box zijn die nog steeds overtuigend beter
    // scoort (anders vervalt hij als uitdager en zegt de toets niets over
    // SPRINGEN), én meer dan STICKY_MATCH_PX van de vorige uitdager af staat
    // (anders geldt hij als dezelfde box). |230-320| = 90 px, en 230 ligt met
    // 28% uit het midden nog binnen de rijbaanpenalty-grens.
    const r3e = selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(230, 200)]);
    eis('A3e springt de uitdager naar een andere plek, dan is het een andere ' +
        'box en begint de klok opnieuw',
        !!r3e.s1 && r3e.s1.cx === ANDERE_RIJBAAN
          && !!autoSlotUitdager && (Date.now() - autoSlotUitdager.sinds) < 200,
        'slot houdt vast, klok vers',
        (r3e.s1 ? r3e.s1.cx : 'geen') + ', klok '
          + (autoSlotUitdager ? (Date.now() - autoSlotUitdager.sinds) + ' ms' : 'weg'));

    // ═══ A4 — DE LAMP IS WEG ═════════════════════════════════
    slotOpZetten(ANDERE_RIJBAAN, 210);
    const r4 = selecteerBesteDetectie([det(100, 150)]);   // ver buiten de matchradius
    eis('A4 niets binnen bereik geeft geen box — het tolerantiepad houdt de ' +
        'vorige nog even vast',
        r4.s1 === null && r4.afwijsReden === 'autoslot_miss',
        'null + autoslot_miss',
        (r4.s1 ? 'een box' : 'null') + ' + ' + r4.afwijsReden);
    eis('A4b en het slot staat er nog — niets gevonden is niet hetzelfde als kwijt',
        autoSlotActief() === true, 'true', String(autoSlotActief()));
    stickyDetectie.tijd = Date.now() - (STICKY_MISS_MS + 500);
    const r4c = selecteerBesteDetectie([det(100, 150)]);
    eis('A4c pas na STICKY_MISS_MS laat het slot los en kiest de app weer vrij',
        autoSlotActief() === false && !!r4c.s1 && r4c.s1.cx === 100,
        'slot los, box 100',
        'actief=' + autoSlotActief() + ', gekozen=' + (r4c.s1 ? r4c.s1.cx : 'geen'));
    eis('A4d dat is hetzelfde getal als stickyMagLosgelaten gebruikt — geen ' +
        'tweede drempel voor dezelfde vraag',
        /STICKY_MISS_MS/.test(zc(selecteerBesteDetectie))
          && /STICKY_MISS_MS/.test(zc(stickyMagLosgelaten)),
        'beide op STICKY_MISS_MS', 'ok');

    // ═══ A5 — HET SLOT WIJKT ═════════════════════════════════
    // DIT IS DE FOUT VAN V11.15.3. LOCK 1 is destijds uitgezet omdat hij een
    // nieuwe tap blokkeerde; dat mag hier niet opnieuw gebeuren.
    slotOpZetten(ANDERE_RIJBAAN, 210);
    eis('A5 vooraf: het slot staat dicht',
        autoSlotActief() === true, 'true', String(autoSlotActief()));
    bboxOverride = { cx: MIDDEN, cy: 200 }; bboxOverrideTijd = Date.now();
    eis('A5a zodra er een tap ligt, telt het auto-slot niet meer mee',
        autoSlotActief() === false, 'false', String(autoSlotActief()));
    const r5 = selecteerBesteDetectie([det(ANDERE_RIJBAAN, 210), det(MIDDEN, 200)]);
    eis('A5b en de tap wint: de app volgt de getikte box',
        !!r5.s1 && r5.s1.cx === MIDDEN && bboxSlot === 'tap',
        String(MIDDEN) + ' + tap', (r5.s1 ? r5.s1.cx : 'geen') + ' + ' + bboxSlot);
    // structureel: de drie tap-handlers en de node-wissel nullen stickyDetectie
    eis('A5c de tap-handler wist de sticky, dus ook dit slot — daarom woont het ' +
        'in dat object en niet in een eigen variabele',
        /stickyDetectie\s*=\s*null/.test(zc(updateDichtbij))
          && /stickyDetectie\s*=\s*null/.test(zc(corrigeerNodeAutomatisch)),
        'node-wissel en auto-correctie wissen beide', 'ok');
    eis('A5d en het slot leest die ene vlag, geen eigen kopie',
        /stickyDetectie\.bron === 'auto'/.test(zc(autoSlotActief)),
        'bron in stickyDetectie', 'ok');

    // ═══ A6 — DE HARDE FILTERS DUWEN HEM NIET WEG ════════════
    // Toen het slot dichtging was de box goed genoeg. Één frame waarin hij net
    // te breed uitvalt is geen reden om hem kwijt te raken — dezelfde redenering
    // als V11.20.1 voor de getikte box.
    slotOpZetten(MIDDEN, 200);
    const teBreed = det(MIDDEN, 200, 0, 0.8, 500, 60);   // w/640 = 0,78 > MAX_BOX_W_RATIO
    const r6 = selecteerBesteDetectie([teBreed, det(ZIJ, 210)]);
    eis('A6 een vastgehouden box die één frame door een hard filter zou vallen, ' +
        'blijft toch gevolgd',
        !!r6.s1 && r6.s1.cx === MIDDEN && r6.s1.w === 500,
        'de brede box', r6.s1 ? (r6.s1.cx + '/' + r6.s1.w) : 'geen');
    eis('A6b zonder slot valt diezelfde box gewoon weg',
        (() => { opzet(); const r = selecteerBesteDetectie([det(MIDDEN, 200, 0, 0.8, 500, 60), det(ZIJ, 210)]);
                 return !!r.s1 && r.s1.cx === ZIJ; })(),
        String(ZIJ), 'ok');

    // ═══ A7 — REGRESSIE ══════════════════════════════════════
    eis('A7 de matchkern staat nog maar op één plek',
        typeof stickySlotMatch === 'function'
          && /stickySlotMatch\(bruikbaar\)/.test(zc(selecteerBesteDetectie))
          && (zc(selecteerBesteDetectie).match(/STICKY_KLASSE_PENALTY_PX/g) || []).length === 1,
        'één gedeelde kern',
        'penalty-verwijzingen in selecteerBesteDetectie: '
          + (zc(selecteerBesteDetectie).match(/STICKY_KLASSE_PENALTY_PX/g) || []).length);
    eis('A7b de matchradius en de twee penalties zijn ongewijzigd',
        STICKY_MATCH_PX === 80 && STICKY_KLASSE_PENALTY_PX === 30
          && STICKY_HOOGTE_TOLERANTIE === 0.40 && STICKY_HERSTEL_PX === 100,
        '80 / 30 / 0,40 / 100',
        [STICKY_MATCH_PX, STICKY_KLASSE_PENALTY_PX, STICKY_HOOGTE_TOLERANTIE, STICKY_HERSTEL_PX].join(' / '));
    eis('A7c de scoreformule is onaangeroerd',
        /\(1-horAfwijking\) \* 80/.test(zc(selecteerBesteDetectie))
          && /\* 60;/.test(zc(selecteerBesteDetectie))
          && /det\.score \* 25/.test(zc(selecteerBesteDetectie)),
        '80 / 60 / 25', 'ok');
    // de gedeelde kern respecteert de radius
    opzet();
    stickyDetectie = { cx: 320, cy: 200, camX: 320, camY: 200, camH: 50, camAfst: 40,
                       familie: 'rood', hoogte: 50, klasse: 0, tijd: Date.now(), bron: 'auto' };
    eis('A7d stickySlotMatch pakt niets buiten STICKY_MATCH_PX',
        stickySlotMatch([det(320 + STICKY_MATCH_PX + 10, 200)]) === null,
        'null', String(stickySlotMatch([det(320 + STICKY_MATCH_PX + 10, 200)])));
    const w = stickySlotMatch([det(340, 205), det(325, 202)]);
    eis('A7e en kiest binnen de radius de dichtstbijzijnde',
        !!w && w.det.cx === 325, '325', w ? String(w.det.cx) : 'null');
    // 330 is groen (andere familie): 10 px + 30 strafpunten = 40.
    // 345 is rood (zelfde familie): 25 px, geen straf. Dus 345 wint.
    const wPen = stickySlotMatch([det(330, 200, 1), det(345, 200, 0)]);
    eis('A7f een andere kleurfamilie krijgt 30 strafpunten en verliest van een ' +
        'box die verder weg staat maar wél klopt',
        !!wPen && wPen.det.cx === 345 && wPen.penKlasse !== true,
        '345 zonder penalty', wPen ? (wPen.det.cx + ', pen=' + wPen.penKlasse) : 'null');

  } finally {
    bboxOverride = bewaard.bboxOverride; bboxOverrideTijd = bewaard.bboxOverrideTijd;
    bboxOverrideLaatsteMatch = bewaard.bboxOverrideLaatsteMatch;
    bboxOverrideMatchTeller = bewaard.bboxOverrideMatchTeller;
    bboxOverrideCamX = bewaard.bboxOverrideCamX; bboxOverrideCamY = bewaard.bboxOverrideCamY;
    stickyDetectie = bewaard.stickyDetectie; stickyMissTeller = bewaard.stickyMissTeller;
    tapSeedDetectie = bewaard.tapSeedDetectie; autoSlotUitdager = bewaard.autoSlotUitdager;
    bboxSlot = bewaard.bboxSlot; vorigeDetectie = bewaard.vorigeDetectie;
    dichtstbijOSM = bewaard.dichtstbijOSM; huidigePos = bewaard.huidigePos;
    snelheidKmh = bewaard.snelheidKmh;
    bboxAnchorCx = bewaard.bboxAnchorCx; bboxAnchorCy = bewaard.bboxAnchorCy;
    bboxAnchorTijd = bewaard.bboxAnchorTijd; vergrendeldNodeId = bewaard.vergrendeldNodeId;
    voorkeursBboxCx = bewaard.voorkeursBboxCx; voorkeursBboxCy = bewaard.voorkeursBboxCy;
    voorkeursBboxRuns = bewaard.voorkeursBboxRuns; voorkeursBboxTijd = bewaard.voorkeursBboxTijd;
    voorkeursBboxStart = bewaard.voorkeursBboxStart;
    lbScale = bewaard.lbScale; lbPadX = bewaard.lbPadX; lbPadY = bewaard.lbPadY;
    cropRegio = bewaard.cropRegio;
    headingBuffer.length = 0; bewaard.headingBuffer.forEach(h => headingBuffer.push(h));
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testBboxAutoslot = testBboxAutoslot;
