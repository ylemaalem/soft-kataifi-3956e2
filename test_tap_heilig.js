// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tap_heilig.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.20.1, release 2b van het bbox-slot: de getikte box is heilig.
//
//  WAT ER MIS WAS
//  Een tik op het beeld hield 25 seconden. Daarna viel de lock weg en koos de
//  app weer op score — midden in een roodfase, zonder dat er iets veranderd was
//  aan wat de camera zag. En een lamp die zwak gedetecteerd werd (tegenlicht,
//  regen, afstand) sneuvelde al vóór de lock: postprocessYOLO gooit alles onder
//  CONF_DREMPEL (0,10) weg, en die laag wist niet eens dat er getikt was.
//  Younes' woorden bij deze klacht: "Al is de bbox maar 5%."
//
//  H1  de lock verloopt niet meer op een klok vanaf de tik
//  H2  maar wel als de lamp TAP_KWIJT_MS lang onvindbaar is
//  H3  drie loslaatredenen, en geen vierde
//  H4  KERN: 5% binnen de straal komt door, 5% zonder tap niet
//  H5  de straal is begrensd — buiten TAP_ZWAK_STRAAL_PX gelden de vijf filters
//  H6  de ondergrens tegen ontaarde boxen blijft ook binnen de straal
//  H7  REGRESSIE: zonder tap is postprocessYOLO ongewijzigd
//  H8  REGRESSIE: de app zoekt nooit over het hele beeld
//  H9  REGRESSIE: crophint en gate hangen aan hun eigen venster, niet aan de lock
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tap_heilig.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testTapHeilig().regels);
// ═══════════════════════════════════════════════════════════════

function testTapHeilig() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  const bewaard = {
    bboxOverride, bboxOverrideTijd, bboxOverrideCamX, bboxOverrideCamY,
    bboxOverrideMatchTeller, bboxOverrideLaatsteMatch,
    stickyDetectie, stickyMissTeller, tapSeedDetectie, bboxSlot,
    vorigeDetectie, dichtstbijOSM, huidigePos, snelheidKmh,
    bboxAnchorCx, bboxAnchorCy, bboxAnchorTijd, vergrendeldNodeId,
    voorkeursBboxCx, voorkeursBboxCy, voorkeursBboxRuns, voorkeursBboxTijd,
    voorkeursBboxStart, cropHintPositie, cropHintTeller, cropAlternatieTeller
  };

  // Een detectie zoals postprocessYOLO hem oplevert.
  const det = (cx, cy, klasse = 0, score = 0.8, w = 20, h = 50) => {
    const alle = new Array(NC).fill(0.001);
    alle[klasse] = score;
    return { klasse, score, alleScores: alle, cx, cy, w, h,
             x1: cx - w/2, y1: cy - h/2, x2: cx + w/2, y2: cy + h/2 };
  };

  // Een ruwe YOLO-tensor: [1, 4+NC, ankers], gelezen als out[k*ankers + i].
  // Zo test H4 de FILTERLAAG zelf, niet een nagebouwde versie ervan.
  const tensor = (ankers) => {
    const t = new Float32Array((4 + NC) * ankers.length);
    ankers.forEach((a, i) => {
      const n = ankers.length;
      t[0*n + i] = a.cx; t[1*n + i] = a.cy; t[2*n + i] = a.w; t[3*n + i] = a.h;
      t[(4 + (a.klasse != null ? a.klasse : 0)) * n + i] = a.score;
    });
    return { data: t, dims: [1, 4 + NC, ankers.length] };
  };
  const doorFilter = (ankers) => {
    const { data, dims } = tensor(ankers);
    return postprocessYOLO(data, dims).map(d => ({ cx: d.cx, score: +d.score.toFixed(3) }));
  };

  const opzet = (o) => {
    const opt = o || {};
    bboxOverride = opt.tap !== undefined ? opt.tap : null;
    bboxOverrideTijd = opt.tapTijd != null ? opt.tapTijd : Date.now();
    bboxOverrideLaatsteMatch = opt.gezien != null ? opt.gezien : 0;
    bboxOverrideCamX = null; bboxOverrideCamY = null;
    bboxOverrideMatchTeller = opt.matches != null ? opt.matches : 0;
    stickyDetectie = opt.sticky !== undefined ? opt.sticky : null;
    stickyMissTeller = 0; tapSeedDetectie = null;
    vorigeDetectie = null; vergrendeldNodeId = null;
    bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
    dichtstbijOSM = { id: 1, afstand: 40, lat: 52.0, lon: 4.7 };
    huidigePos = { lat: 52.0, lon: 4.7 };
    snelheidKmh = opt.kmh != null ? opt.kmh : 0;   // <15 zet dynamischMaxY op 0,85
    voorkeursBboxCx = null; voorkeursBboxCy = null;
    voorkeursBboxRuns = 0; voorkeursBboxTijd = 0; voorkeursBboxStart = 0;
    bboxSlot = 'onbekend';
  };

  try {
    const nu = Date.now();

    // ═══ H1 — GEEN KLOK VANAF DE TIK ═════════════════════════
    // Veertig seconden na de tik, maar één seconde geleden nog gezien. Onder de
    // oude regel was deze lock vijftien seconden eerder al weggevallen.
    opzet({ tap: { cx: 320, cy: 200 }, tapTijd: nu - 40000, gezien: nu - 1000, matches: 3 });
    const r1 = selecteerBesteDetectie([det(322, 202), det(500, 210)]);
    eis('H1 veertig seconden na de tik volgt de app nog steeds jóuw lamp',
        !!r1.s1 && r1.s1.cx === 322 && bboxSlot === 'tap' && bboxOverride !== null,
        '322 + tap + lock staat', (r1.s1 ? r1.s1.cx : 'geen') + ' + ' + bboxSlot);
    eis('H1b en de kwijt-klok is bijgewerkt door deze geslaagde match',
        Math.abs(bboxOverrideLaatsteMatch - Date.now()) < 200,
        'zojuist', (Date.now() - bboxOverrideLaatsteMatch) + ' ms geleden');
    // en dat blijft zo, hoe oud de tik ook wordt
    opzet({ tap: { cx: 320, cy: 200 }, tapTijd: nu - 600000, gezien: nu - 500, matches: 9 });
    eis('H1c ook tien minuten voor rood blijft de lock staan',
        tapLockLeeft() === true, 'true', String(tapLockLeeft()));

    // ═══ H2 — WÉL LOSLATEN ALS DE LAMP WEG IS ═════════════════
    opzet({ tap: { cx: 320, cy: 200 }, tapTijd: nu - 60000,
            gezien: nu - (TAP_KWIJT_MS + 1000), matches: 3 });
    eis('H2 vooraf: de lock geldt als kwijt',
        tapLockLeeft() === false, 'false', String(tapLockLeeft()));
    const r2 = selecteerBesteDetectie([det(500, 210)]);
    eis('H2b de lock wordt losgelaten en de app kiest weer vrij',
        bboxOverride === null && stickyDetectie === null
          && bboxSlot === 'vrij' && !!r2.s1,
        'lock weg, slot vrij',
        'override=' + bboxOverride + ', slot=' + bboxSlot);
    // de grens zelf
    const leeft = (sinds) => { opzet({ tap: { cx: 320, cy: 200 }, tapTijd: nu - 60000, gezien: Date.now() - sinds }); return tapLockLeeft(); };
    eis('H2c net binnen TAP_KWIJT_MS leeft hij, net erbuiten niet',
        leeft(TAP_KWIJT_MS - 500) === true && leeft(TAP_KWIJT_MS + 500) === false,
        'true / false', leeft(TAP_KWIJT_MS - 500) + ' / ' + leeft(TAP_KWIJT_MS + 500));

    // ═══ H3 — DRIE REDENEN, GEEN VIERDE ══════════════════════
    // (a) een nieuwe tik: verse bboxOverrideTijd wint van een oude matchtijd,
    //     zodat de vorige tap de nieuwe niet meteen dood verklaart.
    opzet({ tap: { cx: 100, cy: 100 }, tapTijd: nu - (TAP_KWIJT_MS + 5000),
            gezien: nu - (TAP_KWIJT_MS + 5000) });
    eis('H3 vooraf: de oude tap is kwijt',
        tapLockLeeft() === false, 'false', String(tapLockLeeft()));
    bboxOverride = { cx: 400, cy: 300 }; bboxOverrideTijd = Date.now();
    eis('H3a (a) een nieuwe tik leeft meteen, ondanks de oude matchtijd',
        tapLockLeeft() === true, 'true', String(tapLockLeeft()));
    // (b) een ander kruispunt — de drie bestaande wis-plekken
    eis('H3b (b) de node-wissel en de automatische correctie wissen de tap nog steeds',
        /bboxOverride = null/.test(zc(updateDichtbij))
          && /bboxOverride = null/.test(zc(corrigeerNodeAutomatisch)),
        'beide wissen', 'updateDichtbij: '
          + /bboxOverride = null/.test(zc(updateDichtbij)) + ', corrigeer: '
          + /bboxOverride = null/.test(zc(corrigeerNodeAutomatisch)));
    // (c) is H2. En er is geen vierde: de oude klok staat niet meer in de bron.
    eis('H3c (c) en er is geen vierde reden — selecteerBesteDetectie kent geen ' +
        'klok vanaf de tik meer',
        !/bboxOverrideTijd\s*>\s*TAP/.test(zc(selecteerBesteDetectie))
          && /tapLockLeeft\(\)/.test(zc(selecteerBesteDetectie)),
        'alleen tapLockLeeft', 'ok');

    // ═══ H4 — DE KERN: 5% BINNEN DE STRAAL ═══════════════════
    // Twee ankers: een sterke in het midden, een zwakke van 5% ernaast.
    const ankers = [
      { cx: 320, cy: 200, w: 20, h: 50, klasse: 0, score: 0.80 },
      { cx: 360, cy: 220, w: 18, h: 45, klasse: 0, score: 0.05 }
    ];
    opzet();   // geen tap
    const zonder = doorFilter(ankers);
    eis('H4 vooraf: zonder tap wordt de 5%-detectie weggefilterd',
        zonder.length === 1 && zonder[0].cx === 320,
        '1 detectie (320)', JSON.stringify(zonder));
    opzet({ tap: { cx: 360, cy: 220 }, tapTijd: Date.now() });
    const metTap = doorFilter(ankers);
    eis('H4b met een tik op die lamp komt de 5%-detectie er wél doorheen',
        metTap.length === 2 && metTap.some(d => d.cx === 360 && d.score === 0.05),
        '2 detecties, waaronder 360 op 0,05', JSON.stringify(metTap));
    // en de sticky gaat voor op de tik-positie: die is elke run bijgewerkt
    opzet({ tap: { cx: 100, cy: 100 }, tapTijd: Date.now(),
            sticky: { cx: 360, cy: 220, familie: 'rood', hoogte: 45, klasse: 0, tijd: Date.now() } });
    const viaSticky = doorFilter(ankers);
    eis('H4c de straal volgt de sticky, niet de bevroren tik-positie',
        viaSticky.some(d => d.cx === 360 && d.score === 0.05),
        '360 komt door', JSON.stringify(viaSticky));
    // een dode lock verruimt niets
    opzet({ tap: { cx: 360, cy: 220 }, tapTijd: nu - 60000, gezien: nu - 60000 });
    eis('H4d een kwijtgeraakte lock verruimt niets meer',
        tapZwakPositie() === null && doorFilter(ankers).length === 1,
        'null + 1 detectie',
        tapZwakPositie() + ' + ' + doorFilter(ankers).length);

    // ═══ H5 — DE STRAAL IS BEGRENSD ══════════════════════════
    const zwakOp = (dx) => {
      opzet({ tap: { cx: 320, cy: 200 }, tapTijd: Date.now() });
      return doorFilter([{ cx: 320 + dx, cy: 200, w: 18, h: 45, klasse: 0, score: 0.05 }]).length;
    };
    eis('H5 binnen TAP_ZWAK_STRAAL_PX komt de zwakke detectie door',
        zwakOp(TAP_ZWAK_STRAAL_PX - 5) === 1, '1', String(zwakOp(TAP_ZWAK_STRAAL_PX - 5)));
    eis('H5b erbuiten niet — daar raadt de app nog steeds en gelden de vijf filters',
        zwakOp(TAP_ZWAK_STRAAL_PX + 5) === 0, '0', String(zwakOp(TAP_ZWAK_STRAAL_PX + 5)));
    // de vier geometrische filters gelden binnen de straal ook niet
    opzet({ tap: { cx: 320, cy: 560 }, tapTijd: Date.now(), kmh: 50 });
    eis('H5c binnen de straal vervalt ook de horizonfilter — jouw lamp mag ' +
        'laag in beeld staan',
        doorFilter([{ cx: 320, cy: 560, w: 20, h: 50, klasse: 0, score: 0.5 }]).length === 1,
        '1', String(doorFilter([{ cx: 320, cy: 560, w: 20, h: 50, klasse: 0, score: 0.5 }]).length));
    opzet({ kmh: 50 });
    eis('H5d en zonder tap wordt diezelfde lage detectie gewoon geweigerd',
        doorFilter([{ cx: 320, cy: 560, w: 20, h: 50, klasse: 0, score: 0.5 }]).length === 0,
        '0', String(doorFilter([{ cx: 320, cy: 560, w: 20, h: 50, klasse: 0, score: 0.5 }]).length));

    // ═══ H6 — DE ONDERGRENS BLIJFT ═══════════════════════════
    // Een box van één pixel hoog of zonder breedte is geen slecht zichtbare
    // lamp maar een rekenfout, en breekt verderop de hoogte- en
    // breedteverhoudingen.
    opzet({ tap: { cx: 320, cy: 200 }, tapTijd: Date.now() });
    eis('H6 een box van 1 px hoog komt ook binnen de straal niet door',
        doorFilter([{ cx: 320, cy: 200, w: 10, h: 1, klasse: 0, score: 0.5 }]).length === 0,
        '0', String(doorFilter([{ cx: 320, cy: 200, w: 10, h: 1, klasse: 0, score: 0.5 }]).length));
    eis('H6b en een box zonder breedte evenmin',
        doorFilter([{ cx: 320, cy: 200, w: 0, h: 40, klasse: 0, score: 0.5 }]).length === 0,
        '0', String(doorFilter([{ cx: 320, cy: 200, w: 0, h: 40, klasse: 0, score: 0.5 }]).length));
    eis('H6c maar 3 px hoog — onder MIN_H_PX — mag wél, want dat is een lamp ver weg',
        doorFilter([{ cx: 320, cy: 200, w: 3, h: 3, klasse: 0, score: 0.5 }]).length === 1,
        '1', String(doorFilter([{ cx: 320, cy: 200, w: 3, h: 3, klasse: 0, score: 0.5 }]).length));

    // ═══ H7 — REGRESSIE: ZONDER TAP NIETS VERANDERD ══════════
    opzet();
    eis('H7 de vijf drempels staan onaangeroerd',
        CONF_DREMPEL === 0.10 && MAX_Y_RATIO === 0.75 && MIN_H_PX === 5
          && MAX_BOX_W_RATIO === 0.65 && MAX_WH_RATIO === 2.5,
        '0.10 / 0.75 / 5 / 0.65 / 2.5',
        [CONF_DREMPEL, MAX_Y_RATIO, MIN_H_PX, MAX_BOX_W_RATIO, MAX_WH_RATIO].join(' / '));
    const zonderTapGevallen = [
      { naam: 'te vaag',  a: { cx: 320, cy: 200, w: 20, h: 50, klasse: 0, score: 0.05 } },
      { naam: 'te laag',  a: { cx: 320, cy: 560, w: 20, h: 50, klasse: 0, score: 0.5 } },
      { naam: 'te klein', a: { cx: 320, cy: 200, w: 4,  h: 4,  klasse: 0, score: 0.5 } },
      { naam: 'te breed', a: { cx: 320, cy: 200, w: 500, h: 300, klasse: 0, score: 0.5 } },
      { naam: 'te plat',  a: { cx: 320, cy: 200, w: 60, h: 10, klasse: 0, score: 0.5 } }
    ];
    opzet({ kmh: 50 });
    const nogGeweigerd = zonderTapGevallen.filter(g => doorFilter([g.a]).length === 0);
    eis('H7b en alle vijf de gevallen worden zonder tap nog steeds geweigerd',
        nogGeweigerd.length === 5, '5 van 5',
        nogGeweigerd.map(g => g.naam).join(', ') || 'geen');

    // ═══ H8 — NOOIT OVER HET HELE BEELD ══════════════════════
    // Na de eerste geslaagde match is de blinde closest-fallback afgekapt op
    // 180 px. Een detectie aan de andere kant van het beeld wordt dus nooit
    // geadopteerd, ook niet als het de enige is.
    opzet({ tap: { cx: 100, cy: 100 }, tapTijd: Date.now(), gezien: Date.now(), matches: 4 });
    const r8 = selecteerBesteDetectie([det(600, 120)]);
    eis('H8 een detectie ver buiten bereik wordt niet geadopteerd',
        r8.s1 === null && r8.afwijsReden === 'radius_cap',
        'null + radius_cap', (r8.s1 ? 'een box' : 'null') + ' + ' + r8.afwijsReden);
    eis('H8b en de lock blijft daarbij gewoon staan — niets gevonden is niet ' +
        'hetzelfde als kwijt',
        bboxOverride !== null && tapLockLeeft() === true,
        'lock staat', 'override=' + (bboxOverride !== null) + ', leeft=' + tapLockLeeft());

    // ═══ H9 — REGRESSIE: CROPHINT EN GATE ════════════════════
    eis('H9 het crophint-venster houdt zijn 25 s, los van de lock',
        TAP_CROPHINT_MS === 25000 && TAP_KWIJT_MS === 20000,
        '25000 en 20000', TAP_CROPHINT_MS + ' en ' + TAP_KWIJT_MS);
    eis('H9b de oude naam bestaat niet meer — geen plek kan er nog stilletjes ' +
        'op leunen',
        typeof TAP_FORCE_TIMEOUT === 'undefined', 'undefined', typeof TAP_FORCE_TIMEOUT);
    eis('H9c preprocessVoorYOLO en de kansloos-gate lezen het hint-venster, ' +
        'niet de lock',
        /TAP_CROPHINT_MS/.test(zc(preprocessVoorYOLO))
          && /TAP_CROPHINT_MS/.test(zc(runIsKansloos))
          && !/tapLockLeeft/.test(zc(runIsKansloos)),
        'beide op TAP_CROPHINT_MS', 'ok');

  } finally {
    bboxOverride = bewaard.bboxOverride; bboxOverrideTijd = bewaard.bboxOverrideTijd;
    bboxOverrideCamX = bewaard.bboxOverrideCamX; bboxOverrideCamY = bewaard.bboxOverrideCamY;
    bboxOverrideMatchTeller = bewaard.bboxOverrideMatchTeller;
    bboxOverrideLaatsteMatch = bewaard.bboxOverrideLaatsteMatch;
    stickyDetectie = bewaard.stickyDetectie; stickyMissTeller = bewaard.stickyMissTeller;
    tapSeedDetectie = bewaard.tapSeedDetectie; bboxSlot = bewaard.bboxSlot;
    vorigeDetectie = bewaard.vorigeDetectie; dichtstbijOSM = bewaard.dichtstbijOSM;
    huidigePos = bewaard.huidigePos; snelheidKmh = bewaard.snelheidKmh;
    bboxAnchorCx = bewaard.bboxAnchorCx; bboxAnchorCy = bewaard.bboxAnchorCy;
    bboxAnchorTijd = bewaard.bboxAnchorTijd; vergrendeldNodeId = bewaard.vergrendeldNodeId;
    voorkeursBboxCx = bewaard.voorkeursBboxCx; voorkeursBboxCy = bewaard.voorkeursBboxCy;
    voorkeursBboxRuns = bewaard.voorkeursBboxRuns; voorkeursBboxTijd = bewaard.voorkeursBboxTijd;
    voorkeursBboxStart = bewaard.voorkeursBboxStart;
    cropHintPositie = bewaard.cropHintPositie; cropHintTeller = bewaard.cropHintTeller;
    cropAlternatieTeller = bewaard.cropAlternatieTeller;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testTapHeilig = testTapHeilig;
