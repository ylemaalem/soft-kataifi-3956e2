// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_bbox_slot.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.20.0, release 2a van het bbox-slot: het meetinstrument.
//  Deze release verandert NIET welke box gekozen wordt. Ze maakt zichtbaar
//  of de box wordt vastgehouden of elke run opnieuw wordt gekozen, en ze
//  geeft de vijfde vasthoudregel de tijdgenoot die de andere vier in
//  V11.18.17 kregen.
//
//  WAAROM DIT EERST KOMT
//  Klacht 1 is "de box springt tussen lampen". De app had geen enkele manier
//  om te zeggen of ze iets vasthield: selecteerBesteDetectie geeft een
//  afwijsReden terug die zegt waarom iets AFVIEL, niet welke tak WON — 'ok'
//  komt uit vier verschillende takken. Zonder dat onderscheid is niet te meten
//  of het echte slot (release 2c) iets doet.
//
//  B1  de drie randstijlen, en dat ze uit elkaar te houden zijn
//  B2  VOORKEUR_MIN_MS volgt de rekenwijze van V11.18.17
//  B3  voorkeurIsRijp eist runs ÉN tijd — de strengste wint
//  B4  een verse keuze meldt 'vrij'
//  B5  een rijpe voorkeur binnen de straal meldt 'vast'
//  B6  een actieve tap meldt 'tap'
//  B7  het slot wordt gelezen VÓÓR de voorkeur wordt bijgewerkt
//  B8  een run zonder box laat het vorige slot staan
//  B9  tekenOverlay past de stijl daadwerkelijk toe
//  B10 REGRESSIE: de scoreformule, de filters en de bonus zijn ongewijzigd
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_bbox_slot.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testBboxSlot().regels);
// ═══════════════════════════════════════════════════════════════

function testBboxSlot() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  const bewaard = {
    bboxOverride, bboxOverrideTijd, bboxOverrideCamX, bboxOverrideCamY,
    bboxOverrideMatchTeller, stickyDetectie, stickyMissTeller, tapSeedDetectie,
    vorigeDetectie, dichtstbijOSM, huidigePos, snelheidKmh,
    bboxAnchorCx, bboxAnchorCy, bboxAnchorTijd, vergrendeldNodeId,
    voorkeursBboxCx, voorkeursBboxCy, voorkeursBboxRuns, voorkeursBboxTijd,
    voorkeursBboxStart, bboxSlot,
    cropHintPositie, cropHintTeller, cameraTapMarker, cropRegio,
    overlB: overlCanvas.width, overlH: overlCanvas.height,
    canvasB: canvas.width, canvasH: canvas.height
  };

  // Een detectie zoals postprocessYOLO hem oplevert. NC=4, KLASSE_MAP is
  // {0:rood, 1:groen, 3:oranje}; klasse 2 ('uit') komt hier nooit langs.
  const det = (cx, cy, klasse = 0, score = 0.8, w = 20, h = 50) => {
    const alle = new Array(NC).fill(0.01);
    alle[klasse] = score;
    return { klasse, score, alleScores: alle, cx, cy, w, h,
             x1: cx - w/2, y1: cy - h/2, x2: cx + w/2, y2: cy + h/2 };
  };

  // Schone uitgangsstand: geen tap, geen anchor, geen voorkeur, geen vorige box.
  const opzet = (o) => {
    const opt = o || {};
    bboxOverride = null; bboxOverrideTijd = 0;
    bboxOverrideCamX = null; bboxOverrideCamY = null; bboxOverrideMatchTeller = 0;
    stickyDetectie = null; stickyMissTeller = 0; tapSeedDetectie = null;
    vorigeDetectie = null; vergrendeldNodeId = null;
    bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
    dichtstbijOSM = { id: 1, afstand: 40, lat: 52.0, lon: 4.7 };
    huidigePos = { lat: 52.0, lon: 4.7 };
    snelheidKmh = opt.kmh != null ? opt.kmh : 0;
    voorkeursBboxCx = opt.vCx != null ? opt.vCx : null;
    voorkeursBboxCy = opt.vCy != null ? opt.vCy : null;
    voorkeursBboxRuns = opt.vRuns != null ? opt.vRuns : 0;
    voorkeursBboxTijd = opt.vTijd != null ? opt.vTijd : 0;
    voorkeursBboxStart = opt.vStart != null ? opt.vStart : 0;
    bboxSlot = 'onbekend';   // zodat elke toets bewijst dat er GEZET is
  };

  try {
    // ═══ B1 — DE DRIE RANDSTIJLEN ════════════════════════════
    const sTap = bboxRandStijl('tap'), sVast = bboxRandStijl('vast'), sVrij = bboxRandStijl('vrij');
    eis('B1 alleen de getikte box krijgt een slotje',
        sTap.slotje === true && sVast.slotje === false && sVrij.slotje === false,
        'tap wel, rest niet',
        [sTap.slotje, sVast.slotje, sVrij.slotje].join(', '));
    eis('B1b alleen de vrij zoekende box is gestreept — dat leest als "kan springen"',
        sVrij.streep.length > 0 && sTap.streep.length === 0 && sVast.streep.length === 0,
        'alleen vrij gestreept',
        JSON.stringify([sTap.streep, sVast.streep, sVrij.streep]));
    eis('B1c de drie lijndiktes lopen af van vast naar los, en zijn alle drie anders',
        sTap.lijn > sVast.lijn && sVast.lijn > sVrij.lijn,
        'tap > vast > vrij', [sTap.lijn, sVast.lijn, sVrij.lijn].join(' > '));
    eis('B1d een onbekende waarde valt terug op "vrij" — nooit stilletjes op vast',
        JSON.stringify(bboxRandStijl('zomaar iets')) === JSON.stringify(sVrij),
        'zelfde als vrij', JSON.stringify(bboxRandStijl('zomaar iets')));

    // ═══ B2 — DE REKENWIJZE VAN V11.18.17 ════════════════════
    eis('B2 VOORKEUR_MIN_MS is VOORKEUR_MIN_RUNS × 1066 ms, net als de vier uit V11.18.17',
        VOORKEUR_MIN_MS === 3200 && VOORKEUR_MIN_RUNS * 1066 === 3198,
        '3200 (3 × 1066)', String(VOORKEUR_MIN_MS));
    eis('B2b en hij staat naast de andere vier, niet in plaats van',
        AI_BEZINK_MS === 2100 && AI_BEZINK_ONVERWACHT_MS === 3200
          && TOLERANTIE_MS === 5300 && STICKY_MISS_MS === 5300,
        '2100, 3200, 5300, 5300',
        [AI_BEZINK_MS, AI_BEZINK_ONVERWACHT_MS, TOLERANTIE_MS, STICKY_MISS_MS].join(', '));

    // ═══ B3 — RUNS ÉN TIJD ═══════════════════════════════════
    const nu = Date.now();
    const rijp = (runs, sindsStart, sindsGezien) => {
      opzet({ vCx: 320, vCy: 200, vRuns: runs,
              vStart: nu - sindsStart, vTijd: nu - sindsGezien });
      return voorkeurIsRijp(nu);
    };
    // DIT IS DE KERN. Bij het snelle model (~415 ms/run) zijn drie runs binnen
    // 1,3 s voorbij. Met alleen de runs-eis stond de voorkeur dan al open.
    eis('B3 vier runs binnen een seconde is nog niet rijp — de klok wint',
        rijp(4, 900, 0) === false, 'false', String(rijp(4, 900, 0)));
    eis('B3b en ruim de tijd met te weinig runs ook niet — de runs winnen',
        rijp(2, 6000, 0) === false, 'false', String(rijp(2, 6000, 0)));
    eis('B3c allebei gehaald: rijp',
        rijp(3, 3200, 0) === true, 'true', String(rijp(3, 3200, 0)));
    eis('B3d maar een voorkeur die 8 s niet bevestigd is, vervalt — ' +
        'VOORKEUR_TIMEOUT_MS blijft los van de rijping',
        rijp(9, 20000, 9000) === false, 'false', String(rijp(9, 20000, 9000)));
    opzet();
    eis('B3e zonder voorkeur is er niets te rijpen',
        voorkeurIsRijp() === false, 'false', String(voorkeurIsRijp()));

    // ═══ B4 — EEN VERSE KEUZE IS 'vrij' ══════════════════════
    opzet();
    const r4 = selecteerBesteDetectie([det(320, 200), det(430, 210)]);
    eis('B4 de eerste keuze meldt "vrij" — er is nog niets om vast te houden',
        bboxSlot === 'vrij' && !!r4.s1, 'vrij + een box',
        bboxSlot + ', box=' + (!!r4.s1));
    // en vier runs op rij maken hem nog steeds niet vast: de klok staat stil
    let r4b;
    for (let i = 0; i < 4; i++) r4b = selecteerBesteDetectie([det(320, 200), det(430, 210)]);
    eis('B4b vier runs in hetzelfde ogenblik blijven "vrij" — precies wat de ' +
        'tijdgenoot moet doen',
        bboxSlot === 'vrij' && voorkeursBboxRuns >= VOORKEUR_MIN_RUNS,
        'vrij, ondanks ' + voorkeursBboxRuns + ' runs', bboxSlot);

    // ═══ B5 — EEN RIJPE VOORKEUR IS 'vast' ═══════════════════
    opzet({ vCx: 320, vCy: 200, vRuns: 5, vStart: nu - 5000, vTijd: nu });
    selecteerBesteDetectie([det(320, 200), det(430, 210)]);
    eis('B5 een rijpe voorkeur waar de winnaar binnen valt, meldt "vast"',
        bboxSlot === 'vast', 'vast', bboxSlot);
    // buiten de straal telt de voorkeur niet mee, ook al is hij rijp
    opzet({ vCx: 60, vCy: 200, vRuns: 5, vStart: nu - 5000, vTijd: nu });
    selecteerBesteDetectie([det(320, 200)]);
    eis('B5b ligt de winnaar buiten VOORKEUR_RADIUS_PX, dan is het gewoon "vrij"',
        bboxSlot === 'vrij', 'vrij', bboxSlot);

    // ═══ B6 — EEN ACTIEVE TAP IS 'tap' ═══════════════════════
    opzet();
    bboxOverride = { cx: 320, cy: 200 };
    bboxOverrideTijd = Date.now();
    const r6 = selecteerBesteDetectie([det(320, 200), det(430, 210)]);
    eis('B6 met een actieve tap meldt de app "tap"',
        bboxSlot === 'tap' && !!r6.s1, 'tap + een box',
        bboxSlot + ', box=' + (!!r6.s1));
    // en de vervolgrun loopt door de sticky-tak, die hetzelfde moet melden
    const r6b = selecteerBesteDetectie([det(325, 205), det(430, 210)]);
    eis('B6b ook de sticky-vervolgrun meldt "tap"',
        bboxSlot === 'tap' && !!r6b.s1, 'tap', bboxSlot);

    // ═══ B7 — DE VOLGORDE: LEZEN VÓÓR BIJWERKEN ═══════════════
    // Het bijwerkblok schuift de voorkeur naar de winnaar: de afstand wordt 0
    // en de teller loopt op. Zou het slot DÁÁRNA bepaald worden, dan stond er
    // altijd 'vast' en mat de toets zichzelf.
    opzet({ vCx: 60, vCy: 200, vRuns: 9, vStart: nu - 9000, vTijd: nu });
    selecteerBesteDetectie([det(320, 200)]);
    eis('B7 een rijpe voorkeur 260 px verderop levert "vrij", niet "vast"',
        bboxSlot === 'vrij', 'vrij (anders wordt na het bijwerken gemeten)', bboxSlot);
    eis('B7b en de voorkeur is daarna wel verhuisd, met de teller op 1',
        voorkeursBboxCx === 320 && voorkeursBboxRuns === 1,
        'cx 320, runs 1', voorkeursBboxCx + ', ' + voorkeursBboxRuns);
    eis('B7c de starttijd van de reeks is meeverzet — anders zou de nieuwe ' +
        'reeks de rijpheid van de oude erven',
        Math.abs(voorkeursBboxStart - voorkeursBboxTijd) < 50,
        'start ≈ tijd', (voorkeursBboxStart - voorkeursBboxTijd) + ' ms verschil');

    // ═══ B8 — GEEN BOX LAAT HET SLOT STAAN ═══════════════════
    opzet();
    bboxOverride = { cx: 320, cy: 200 };
    bboxOverrideTijd = Date.now();
    selecteerBesteDetectie([det(320, 200)]);          // -> 'tap'
    const voorLeeg = bboxSlot;
    const rLeeg = selecteerBesteDetectie([]);          // niets gezien
    eis('B8 een run zonder detecties laat het vorige slot staan — het ' +
        'tolerantiepad houdt die box immers nog vast',
        rLeeg.s1 === null && bboxSlot === voorLeeg && voorLeeg === 'tap',
        'tap blijft staan', 'voor=' + voorLeeg + ', na=' + bboxSlot);

    // ═══ B9 — tekenOverlay PAST DE STIJL TOE ═════════════════
    canvas.width = 640; canvas.height = 360;
    overlCanvas.width = 640; overlCanvas.height = 360;
    cropHintPositie = null; cropHintTeller = 0; cameraTapMarker = null; cropRegio = null;
    bboxAnchorCx = null; bboxOverride = null;
    const spionage = () => {
      const opgenomen = { dash: [], lijn: [], teksten: [] };
      const orig = { setLineDash: octx.setLineDash, fillText: octx.fillText };
      octx.setLineDash = function (d) { opgenomen.dash.push(Array.isArray(d) ? d.slice() : d); };
      octx.fillText = function (t, x, y) { opgenomen.teksten.push(String(t)); };
      // lineWidth is een property, geen methode: vastleggen op het moment van stroke
      const origStroke = octx.stroke;
      octx.stroke = function () { opgenomen.lijn.push(octx.lineWidth); };
      const herstel = () => {
        octx.setLineDash = orig.setLineDash; octx.fillText = orig.fillText; octx.stroke = origStroke;
        delete octx.setLineDash; delete octx.fillText; delete octx.stroke;
      };
      return { opgenomen, herstel };
    };
    const tekenMet = (slot) => {
      bboxSlot = slot;
      const sp = spionage();
      try { tekenOverlay({ x: 200, y: 100, w: 40, h: 80, kleur: 'rood', klasse: 0 }, 0.8, false); }
      finally { sp.herstel(); }
      return sp.opgenomen;
    };
    const oTap = tekenMet('tap'), oVast = tekenMet('vast'), oVrij = tekenMet('vrij');
    eis('B9 de lijndikte op het scherm volgt het slot',
        oTap.lijn.includes(sTap.lijn) && oVast.lijn.includes(sVast.lijn)
          && oVrij.lijn.includes(sVrij.lijn),
        [sTap.lijn, sVast.lijn, sVrij.lijn].join('/'),
        [oTap.lijn.join(','), oVast.lijn.join(','), oVrij.lijn.join(',')].join(' | '));
    eis('B9b de vrije box wordt gestreept getekend, de andere twee niet',
        oVrij.dash.some(d => Array.isArray(d) && d.length === sVrij.streep.length
                             && d[0] === sVrij.streep[0])
          && !oTap.dash.some(d => Array.isArray(d) && d.length > 0 && d[0] === sVrij.streep[0]),
        'alleen vrij gestreept',
        JSON.stringify([oTap.dash, oVrij.dash]));
    eis('B9c en het streeppatroon wordt na de box weer uitgezet — anders ' +
        'streept de volgende tekening mee',
        oVrij.dash.length >= 2
          && Array.isArray(oVrij.dash[oVrij.dash.length - 1])
          && oVrij.dash[oVrij.dash.length - 1].length === 0,
        'laatste setLineDash is leeg', JSON.stringify(oVrij.dash));
    const slotTeken = '🔒';
    eis('B9d het slotje verschijnt alleen bij een getikte box',
        oTap.teksten.some(t => t.indexOf(slotTeken) !== -1)
          && !oVast.teksten.some(t => t.indexOf(slotTeken) !== -1)
          && !oVrij.teksten.some(t => t.indexOf(slotTeken) !== -1),
        'alleen bij tap',
        JSON.stringify([oTap.teksten, oVast.teksten, oVrij.teksten]));
    eis('B9e en precies één keer — de oude tekstsuffix is weg',
        oTap.teksten.filter(t => t.indexOf(slotTeken) !== -1).length === 1,
        '1 slotje', String(oTap.teksten.filter(t => t.indexOf(slotTeken) !== -1).length));

    // B9f leest de PIXELS, niet de aanroepen. B9b bewijst alleen dat
    // setLineDash de juiste waarde kreeg; of er daarna ook werkelijk een
    // onderbroken lijn op het canvas staat, is een andere vraag — een verkeerd
    // geplaatste setLineDash([]) of een save/restore ertussen zou het stil
    // ongedaan maken. Gemeten op de bovenrand van de linker hoekhaak:
    // box.x 90 min mg 8 = x1 82, hl = min(w,h) x 0,35 + 8 = 29 px lang.
    // Drempel 180 op de alfa, zodat de gloed (shadowBlur 12) niet meetelt.
    const randPatroon = (slot) => {
      octx.clearRect(0, 0, overlCanvas.width, overlCanvas.height);
      bboxSlot = slot;
      tekenOverlay({ x: 90, y: 110, w: 60, h: 110, kleur: 'rood', klasse: 0 }, 0.87, false);
      const d = octx.getImageData(82, 102, 29, 1).data;
      let p = '';
      for (let i = 0; i < 29; i++) p += d[i * 4 + 3] > 180 ? '#' : '.';
      return p;
    };
    const pTap = randPatroon('tap'), pVast = randPatroon('vast'), pVrij = randPatroon('vrij');
    eis('B9f op het canvas zelf: tap en vast zijn doorlopend',
        pTap.indexOf('.') === -1 && pVast.indexOf('.') === -1,
        'geen onderbrekingen', pTap + ' | ' + pVast);
    eis('B9g en de vrije box staat er werkelijk gestreept op — gemeten in pixels',
        pVrij.indexOf('.') !== -1 && pVrij.indexOf('#') !== -1,
        'afwisselend', pVrij);

    // ═══ B10 — REGRESSIE ═════════════════════════════════════
    const bron = zc(selecteerBesteDetectie);
    eis('B10 de scoreformule is ongewijzigd: centrering 80, tracking 60, de rest 25',
        /\(1-horAfwijking\) \* 80/.test(bron) && /\* 60;/.test(bron)
          && /det\.score \* 25/.test(bron),
        '80 / 60 / 25', 'ok');
    eis('B10b de harde filters in de scoretak staan er nog',
        /det\.w < 4 \|\| det\.h < 4/.test(bron) && /MAX_Y_RATIO/.test(bron)
          && /MAX_BOX_W_RATIO/.test(bron) && /S1_EDGE_MIN/.test(bron),
        'vier filters', 'ok');
    eis('B10c postprocessYOLO is niet aangeraakt',
        CONF_DREMPEL === 0.10 && MAX_Y_RATIO === 0.75 && MIN_H_PX === 5
          && MAX_BOX_W_RATIO === 0.65 && MAX_WH_RATIO === 2.5,
        '0.10 / 0.75 / 5 / 0.65 / 2.5',
        [CONF_DREMPEL, MAX_Y_RATIO, MIN_H_PX, MAX_BOX_W_RATIO, MAX_WH_RATIO].join(' / '));
    // V11.20.1 heeft de 25 s gesplitst: het crophint-venster houdt die waarde,
    // de lock verloopt sindsdien op TAP_KWIJT_MS vanaf de laatste waarneming.
    // De uitgebreide toetsing staat in test_tap_heilig.js; hier alleen dat deze
    // release er niet stilletjes iets aan verandert.
    eis('B10d het crophint-venster staat nog op 25 s en de kwijt-klok op 20 s',
        TAP_CROPHINT_MS === 25000 && TAP_KWIJT_MS === 20000
          && typeof TAP_FORCE_TIMEOUT === 'undefined',
        '25000 / 20000 / oude naam weg',
        TAP_CROPHINT_MS + ' / ' + TAP_KWIJT_MS + ' / ' + typeof TAP_FORCE_TIMEOUT);
    // De bonus zelf moet nog landen, en dat is nauwkeurig werk: de voorkeur moet
    // ver genoeg van de middenbox liggen dat ALLEEN de zijbox hem krijgt.
    // Doorgerekend op deze fixture (alle andere termen gelijk):
    //   cx 320  centerScore 80,0  — pal in het midden
    //   cx 410  centerScore 57,5  — 22,5 achterstand, afstand tot 320 is 90,6 px
    //   cx 430  centerScore 52,5  — 27,5 achterstand, afstand tot 320 is 110,5 px
    // Beide liggen buiten VOORKEUR_RADIUS_PX (80) van de middenbox, dus die
    // krijgt de bonus niet. Met 22,5 < 25 wint de voorkeur; met 27,5 > 25 niet.
    // Dat is precies de bedoelde verhouding: een duwtje, geen grendel.
    opzet({ vCx: 410, vCy: 210, vRuns: 5, vStart: nu - 5000, vTijd: nu });
    const rB = selecteerBesteDetectie([det(320, 200, 0, 0.30), det(410, 210, 0, 0.30)]);
    eis('B10e en VOORKEUR_SCORE_BONUS werkt nog: bij 22,5 punten achterstand ' +
        'wint de rijpe voorkeur van het midden',
        !!rB.s1 && rB.s1.cx === 410 && bboxSlot === 'vast',
        '410 + vast', (rB.s1 ? rB.s1.cx : 'geen') + ' + ' + bboxSlot);
    opzet({ vCx: 430, vCy: 210, vRuns: 5, vStart: nu - 5000, vTijd: nu });
    const rB2 = selecteerBesteDetectie([det(320, 200, 0, 0.30), det(430, 210, 0, 0.30)]);
    eis('B10f maar bij 27,5 punten wint het midden — 25 punten is een duwtje, ' +
        'geen grendel, en dat is waarom release 2c nog moet komen',
        !!rB2.s1 && rB2.s1.cx === 320 && bboxSlot === 'vrij',
        '320 + vrij', (rB2.s1 ? rB2.s1.cx : 'geen') + ' + ' + bboxSlot);

  } finally {
    bboxOverride = bewaard.bboxOverride; bboxOverrideTijd = bewaard.bboxOverrideTijd;
    bboxOverrideCamX = bewaard.bboxOverrideCamX; bboxOverrideCamY = bewaard.bboxOverrideCamY;
    bboxOverrideMatchTeller = bewaard.bboxOverrideMatchTeller;
    stickyDetectie = bewaard.stickyDetectie; stickyMissTeller = bewaard.stickyMissTeller;
    tapSeedDetectie = bewaard.tapSeedDetectie; vorigeDetectie = bewaard.vorigeDetectie;
    dichtstbijOSM = bewaard.dichtstbijOSM; huidigePos = bewaard.huidigePos;
    snelheidKmh = bewaard.snelheidKmh;
    bboxAnchorCx = bewaard.bboxAnchorCx; bboxAnchorCy = bewaard.bboxAnchorCy;
    bboxAnchorTijd = bewaard.bboxAnchorTijd; vergrendeldNodeId = bewaard.vergrendeldNodeId;
    voorkeursBboxCx = bewaard.voorkeursBboxCx; voorkeursBboxCy = bewaard.voorkeursBboxCy;
    voorkeursBboxRuns = bewaard.voorkeursBboxRuns; voorkeursBboxTijd = bewaard.voorkeursBboxTijd;
    voorkeursBboxStart = bewaard.voorkeursBboxStart; bboxSlot = bewaard.bboxSlot;
    cropHintPositie = bewaard.cropHintPositie; cropHintTeller = bewaard.cropHintTeller;
    cameraTapMarker = bewaard.cameraTapMarker; cropRegio = bewaard.cropRegio;
    overlCanvas.width = bewaard.overlB; overlCanvas.height = bewaard.overlH;
    canvas.width = bewaard.canvasB; canvas.height = bewaard.canvasH;
    try { octx.clearRect(0, 0, overlCanvas.width, overlCanvas.height); } catch (e) {}
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testBboxSlot = testBboxSlot;
