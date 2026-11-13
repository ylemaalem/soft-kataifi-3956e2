// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_slot_blijft.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Toets bij V11.37.35: geselecteerd = blijven (opdracht punt 7).
//  Nagespeelde frames, met een nepklok (Date.now) van 250 ms per run, zodat
//  tijdsregels (de oude uitdager van 1,5 s, de oude 5,3 s) echt meedoen.
//
//  SB1  auto-slot: twee lichten naast elkaar, het geselecteerde scoort lager
//       dan het andere (pal in het midden, 0,95 tegen 0,30): 40 runs, 0 wissels
//  SB2  auto-slot: het geselecteerde licht valt 1, 2 en 3 s weg (4, 8, 12 runs)
//       en komt terug; het andere licht blijft zichtbaar: 0 wissels
//  SB3  auto-slot: de buur staat BINNEN de zoekstraal (60 px); jouw lamp valt
//       2 s weg: de buur wordt niet genomen (het burengeheugen)
//  SB4  tik: dezelfde drie situaties na een tik
//  SB5  loslaten: alleen bij een tik of een ander kruispunt, met een regel in
//       sl_conflog; binnen hetzelfde kruispunt blijft de selectie
//  SB6  vastgezet in de code: geen uitdager meer, geen tijdsgrens, groen en
//       uitval wissen het auto-slot niet, elke loslaatplek schrijft een regel
//
//  DRAAIEN: zie test_bbox_autoslot.js (testserver.py, script laden, testSlotBlijft()).
// ═══════════════════════════════════════════════════════════════

function testSlotBlijft() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const bewaard = {
    bboxOverride, bboxOverrideTijd, bboxOverrideLaatsteMatch, bboxOverrideMatchTeller,
    bboxOverrideCamX, bboxOverrideCamY, stickyDetectie, stickyMissTeller, tapSeedDetectie,
    autoSlotUitdager, bboxSlot, vorigeDetectie, dichtstbijOSM, huidigePos, snelheidKmh,
    bboxAnchorCx, bboxAnchorCy, bboxAnchorTijd, vergrendeldNodeId,
    voorkeursBboxCx, voorkeursBboxCy, voorkeursBboxRuns, voorkeursBboxTijd, voorkeursBboxStart,
    lbScale, lbPadX, lbPadY, cropRegio, headingBuffer: [...headingBuffer],
    klv: klasseVerdelingLog.slice(), conflog: localStorage.getItem('sl_conflog'),
    tikLogArr, tikLogStop, tikLogVorige, tikLogLevend, tikTel, tiklog: localStorage.getItem(TIKLOG_SLEUTEL)
  };
  tikLogStop = true;   // de tiklog schrijft niets tijdens deze toets
  const echtNu = Date.now;
  let klok = echtNu.call(Date);
  Date.now = () => klok;
  const DT = 250;

  const det = (cx, cy, score = 0.8, klasse = 0, w = 16, h = 40) => {
    const a = new Array(NC).fill(0.001); a[klasse] = score;
    return { klasse, score, alleScores: a, cx, cy, w, h, x1: cx - w/2, y1: cy - h/2, x2: cx + w/2, y2: cy + h/2 };
  };
  const opzet = () => {
    bboxOverride = null; bboxOverrideTijd = 0; bboxOverrideLaatsteMatch = 0; bboxOverrideMatchTeller = 0;
    bboxOverrideCamX = null; bboxOverrideCamY = null;
    stickyDetectie = null; stickyMissTeller = 0; tapSeedDetectie = null; autoSlotReset();
    vorigeDetectie = null; vergrendeldNodeId = null;
    bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
    dichtstbijOSM = { id: 1, afstand: 60, lat: 52.0, lon: 5.0 };
    huidigePos = { lat: 52.0, lon: 5.0 };
    snelheidKmh = 20;
    lbScale = 1; lbPadX = 0; lbPadY = 0; cropRegio = null;
    headingBuffer.length = 0;
    voorkeursBboxCx = null; voorkeursBboxCy = null; voorkeursBboxRuns = 0; voorkeursBboxTijd = 0; voorkeursBboxStart = 0;
    bboxSlot = 'onbekend';
  };
  // Eén run: de detecties gaan door selecteerBesteDetectie; de klok loopt DT door.
  // Telt een wissel als s1 er is en NIET jouw lamp is (te herkennen aan cx).
  const speel = (frames, eigenCx) => {
    let wissels = 0, metEigen = 0, leeg = 0; const s1s = [];
    for (const f of frames) {
      klok += DT;
      const r = selecteerBesteDetectie(f);
      const cx = r.s1 ? Math.round(r.s1.cx) : null;
      s1s.push(cx);
      if (r.s1 && Math.abs(r.s1.cx - eigenCx) > 5) wissels++;
      if (r.s1 && Math.abs(r.s1.cx - eigenCx) <= 5) metEigen++;
      if (!r.s1) leeg++;
    }
    return { wissels, metEigen, leeg, s1s };
  };
  const rij = (n, maak) => Array.from({ length: n }, (_, i) => maak(i));
  const A = 430, B_VER = 320, B_DICHT = 490, Y = 200;   // A = jouw lamp; B pal in het midden (hoge score) of 60 px ernaast

  try {
    // ═══ SB1 — auto-slot, het andere licht scoort hoger ═══
    opzet(); autoSlotZet(det(A, Y, 0.30));
    const s1 = speel(rij(40, () => [det(B_VER, Y, 0.95), det(A, Y, 0.30)]), A);
    eis('SB1 auto-slot: 40 runs (10 s), andere lamp scoort hoger en staat in het midden: 0 wissels',
        s1.wissels === 0 && s1.metEigen === 40, '0 wissels, 40x jouw lamp',
        s1.wissels + ' wissels, ' + s1.metEigen + 'x jouw lamp; s1 ' + s1.s1s.slice(0, 12).join(','));

    // ═══ SB2 — auto-slot, jouw lamp valt 1-3 s weg ═══
    for (const weg of [4, 8, 12]) {
      opzet(); autoSlotZet(det(A, Y, 0.30));
      const fr = [...rij(6, () => [det(B_VER, Y, 0.95), det(A, Y, 0.30)]),
                  ...rij(weg, () => [det(B_VER, Y, 0.95)]),
                  ...rij(6, () => [det(B_VER, Y, 0.95), det(A, Y, 0.30)])];
      const s = speel(fr, A);
      const terug = s.s1s.slice(-6).every(x => x === A);
      eis('SB2 auto-slot: jouw lamp ' + (weg * DT / 1000) + ' s weg en terug: 0 wissels, daarna weer jouw lamp',
          s.wissels === 0 && terug, '0 wissels, terug op ' + A, s.wissels + ' wissels; s1 ' + s.s1s.join(','));
    }

    // ═══ SB3 — auto-slot, de buur staat binnen de straal ═══
    opzet(); autoSlotZet(det(A, Y, 0.30));
    const fr3 = [...rij(6, () => [det(B_DICHT, Y, 0.95), det(A, Y, 0.30)]),
                 ...rij(8, () => [det(B_DICHT, Y, 0.95)]),
                 ...rij(6, () => [det(B_DICHT, Y, 0.95), det(A, Y, 0.30)])];
    const s3 = speel(fr3, A);
    eis('SB3 auto-slot: buur op 60 px (binnen de straal van ' + STICKY_MATCH_PX + '), jouw lamp 2 s weg: 0 wissels',
        s3.wissels === 0 && s3.s1s.slice(-6).every(x => x === A), '0 wissels', s3.wissels + ' wissels; s1 ' + s3.s1s.join(','));

    // ═══ SB4 — dezelfde drie na een tik ═══
    const tik = (cx) => { opzet(); const d = det(cx, Y, 0.30); tikZet({ det: d, camX: cx, camY: Y, camH: d.h }, cx, Y); };
    tik(A);
    const t1 = speel(rij(40, () => [det(B_VER, Y, 0.95), det(A, Y, 0.30)]), A);
    eis('SB4a tik: 40 runs, andere lamp scoort hoger: 0 wissels', t1.wissels === 0 && t1.metEigen === 40,
        '0 wissels', t1.wissels + ' wissels, ' + t1.metEigen + 'x jouw lamp');
    for (const weg of [4, 8, 12]) {
      tik(A);
      const s = speel([...rij(6, () => [det(B_VER, Y, 0.95), det(A, Y, 0.30)]), ...rij(weg, () => [det(B_VER, Y, 0.95)]),
                       ...rij(6, () => [det(B_VER, Y, 0.95), det(A, Y, 0.30)])], A);
      eis('SB4b tik: jouw lamp ' + (weg * DT / 1000) + ' s weg en terug: 0 wissels', s.wissels === 0 && s.s1s.slice(-6).every(x => x === A),
          '0 wissels', s.wissels + ' wissels; s1 ' + s.s1s.join(','));
    }
    tik(A);
    const t3 = speel([...rij(6, () => [det(B_DICHT, Y, 0.95), det(A, Y, 0.30)]), ...rij(8, () => [det(B_DICHT, Y, 0.95)]),
                      ...rij(6, () => [det(B_DICHT, Y, 0.95), det(A, Y, 0.30)])], A);
    eis('SB4c tik: buur op 60 px binnen de straal, jouw lamp 2 s weg: 0 wissels',
        t3.wissels === 0 && t3.s1s.slice(-6).every(x => x === A), '0 wissels', t3.wissels + ' wissels; s1 ' + t3.s1s.join(','));
    // Een buur die je nooit naast jouw lamp zag, is niet als buur bekend: zonder
    // die kennis kan positie alleen hem niet onderscheiden (vastgelegd, geen eis
    // die het gedrag mooier maakt dan het is).
    tik(A);
    const t4 = speel([...rij(8, () => [det(B_DICHT, Y, 0.95)])], A);
    eis('SB4d (grens, gedocumenteerd) tik: een buur binnen de straal die nooit naast jouw lamp gezien is, wordt genomen',
        t4.wissels > 0, '> 0 (bekende beperking)', t4.wissels + ' wissels');

    // ═══ SB5 — loslaten en de los-regel ═══
    opzet(); autoSlotZet(det(A, Y, 0.30));
    const voor = (JSON.parse(localStorage.getItem('sl_conflog') || '[]')).length;
    slotLosLog('voorbij');
    const cl = JSON.parse(localStorage.getItem('sl_conflog') || '[]');
    const laatst = cl[cl.length - 1] || {};
    eis('SB5a een loslating schrijft { t, los, bron, duur } in sl_conflog',
        laatst.los === 'voorbij' && laatst.bron === 'auto' && typeof laatst.t === 'number' && (cl.length === voor + 1 || cl.length === 50),
        'los voorbij, bron auto', JSON.stringify(laatst));
    opzet();
    const n0 = (JSON.parse(localStorage.getItem('sl_conflog') || '[]')).length;
    slotLosLog('voorbij');
    eis('SB5b zonder selectie geen los-regel', (JSON.parse(localStorage.getItem('sl_conflog') || '[]')).length === n0, 'geen regel erbij', 'ok');
    opzet(); autoSlotZet(det(A, Y, 0.30));
    const oud = { lat: 52.0, lon: 5.0 }, dichtbij = { lat: 52.0002, lon: 5.0 }, ver = { lat: 52.002, lon: 5.0 };
    eis('SB5c node-wissel binnen hetzelfde kruispunt (~22 m): de selectie blijft', slotBlijftBijWissel(oud, dichtbij) === true, 'true', String(slotBlijftBijWissel(oud, dichtbij)));
    eis('SB5d node-wissel naar een ander kruispunt (~222 m): de selectie gaat los', slotBlijftBijWissel(oud, ver) === false, 'false', String(slotBlijftBijWissel(oud, ver)));
    // een tik neemt het auto-slot over (b)
    opzet(); autoSlotZet(det(A, Y, 0.30));
    tikZet({ det: det(B_VER, Y, 0.95), camX: B_VER, camY: Y, camH: 40 }, B_VER, Y);
    const nT = speel([[det(B_VER, Y, 0.95), det(A, Y, 0.30)]], B_VER);
    eis('SB5e een tik op een ander licht wint direct (b)', nT.metEigen === 1 && stickyDetectie && stickyDetectie.bron === 'tik',
        'getikte lamp, bron tik', nT.s1s.join(',') + ' bron ' + (stickyDetectie && stickyDetectie.bron));

    // ═══ SB6 — vastgezet in de code ═══
    const sel = zc(selecteerBesteDetectie);
    eis('SB6a de score beslist niet meer over het auto-slot: geen uitdager, geen tijdsgrens',
        SLOT_BLIJFT === true && /if \(SLOT_BLIJFT\) \{ autoSlotUitdager = null; return false; \}/.test(zc(autoSlotUitdagerRijp))
          && /if \(SLOT_BLIJFT\) \{ stickyMissTeller\+\+; return \{ s1: null/.test(sel), 'uitdager altijd nee; mis = vasthouden', 'ok');
    eis('SB6b groen wist het auto-slot niet (verwerkFase)', /if \(slotAuto35\) stickyDetectie = slotAuto35;/.test(zc(verwerkFase)), 'herstel na de wis', 'ok');
    eis('SB6c uitval (dropout/stale) wist het auto-slot niet (resetNeutraal)', /if \(slotAuto35\) stickyDetectie = slotAuto35;/.test(zc(resetNeutraal)), 'herstel na de wis', 'ok');
    const plekken = [[updateDichtbij, 'slotBewaar(slotOud35'], [corrigeerNodeAutomatisch, 'slotBewaar(oude'], [checkHandLockPassage, "slotLosLog('passage')"],
                     [achterTik, "slotLosLog('achter')"], [geenLichtZetten, "slotLosLog('geen_licht')"], [onGPS, "slotLosLog('voorbij')"]];
    const mist = plekken.filter(([f, r]) => !zc(f).includes(r)).map(([f]) => f.name);
    eis('SB6d elke loslaatplek schrijft een los-regel (de node-wissels via slotBewaar)', mist.length === 0, 'alle 6', mist.join(',') || 'alle 6');
    eis('SB6e de tik-tak en het auto-slot weigeren bekende buren', /slotZonderBuur\(/.test(zc(tikSlotMatch)) && /slotIsBuur\(/.test(zc(stickySlotMatch)),
        'tikSlotMatch en stickySlotMatch', 'ok');
  } catch (e) {
    eis('SB crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    Date.now = echtNu;
    bboxOverride = bewaard.bboxOverride; bboxOverrideTijd = bewaard.bboxOverrideTijd;
    bboxOverrideLaatsteMatch = bewaard.bboxOverrideLaatsteMatch; bboxOverrideMatchTeller = bewaard.bboxOverrideMatchTeller;
    bboxOverrideCamX = bewaard.bboxOverrideCamX; bboxOverrideCamY = bewaard.bboxOverrideCamY;
    stickyDetectie = bewaard.stickyDetectie; stickyMissTeller = bewaard.stickyMissTeller;
    tapSeedDetectie = bewaard.tapSeedDetectie; autoSlotUitdager = bewaard.autoSlotUitdager;
    bboxSlot = bewaard.bboxSlot; vorigeDetectie = bewaard.vorigeDetectie;
    dichtstbijOSM = bewaard.dichtstbijOSM; huidigePos = bewaard.huidigePos; snelheidKmh = bewaard.snelheidKmh;
    bboxAnchorCx = bewaard.bboxAnchorCx; bboxAnchorCy = bewaard.bboxAnchorCy; bboxAnchorTijd = bewaard.bboxAnchorTijd;
    vergrendeldNodeId = bewaard.vergrendeldNodeId;
    voorkeursBboxCx = bewaard.voorkeursBboxCx; voorkeursBboxCy = bewaard.voorkeursBboxCy; voorkeursBboxRuns = bewaard.voorkeursBboxRuns;
    voorkeursBboxTijd = bewaard.voorkeursBboxTijd; voorkeursBboxStart = bewaard.voorkeursBboxStart;
    lbScale = bewaard.lbScale; lbPadX = bewaard.lbPadX; lbPadY = bewaard.lbPadY; cropRegio = bewaard.cropRegio;
    headingBuffer.length = 0; bewaard.headingBuffer.forEach(h => headingBuffer.push(h));
    klasseVerdelingLog = bewaard.klv;
    tikLogArr = bewaard.tikLogArr; tikLogStop = bewaard.tikLogStop; tikLogVorige = bewaard.tikLogVorige; tikLogLevend = bewaard.tikLogLevend; tikTel = bewaard.tikTel;
    try { if (bewaard.tiklog === null) localStorage.removeItem(TIKLOG_SLEUTEL); else localStorage.setItem(TIKLOG_SLEUTEL, bewaard.tiklog); } catch (e) {}
    try { if (bewaard.conflog === null) localStorage.removeItem('sl_conflog'); else localStorage.setItem('sl_conflog', bewaard.conflog); } catch (e) {}
  }
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testSlotBlijft = testSlotBlijft;
