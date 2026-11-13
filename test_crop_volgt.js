// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_crop_volgt.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Toets bij V11.37.35: de crop volgt de geselecteerde lamp (opdracht punt 10).
//  Een nagespeelde nadering van 120 naar 15 m in 60 runs van 250 ms (15 s) op
//  een staand beeld van 2160 x 3840. Jouw lamp schuift in beeld omhoog
//  (y 1500 -> 320) en naar rechts, en wordt groter (h 30 -> 178). Een buurlicht
//  staat 500 px rechts, met een HOGERE score (0,95 tegen 0,35).
//  Elke run gaat door de echte preprocessVoorYOLO (crop, elke vijfde run
//  volbeeld, onder 15 m geen crop) en de echte selecteerBesteDetectie. Het model
//  wordt nagebootst: een lamp wordt "gezien" als zijn hele box binnen het beeld
//  van die run valt en minstens MIN_H_PX hoog is; met de hoogtegrens van
//  postprocessYOLO (MAX_Y_RATIO, behalve in de tikzone).
//
//  CV1  na een tik:   0 wissels, nooit langer dan 0,5 s bevroren, box op jouw lamp
//  CV2  auto-slot:    idem
//  CV3  de groene cropgrens staat alleen in de debugweergave
//
//  DRAAIEN: zie test_bbox_autoslot.js (testserver.py, script laden, testCropVolgt()).
// ═══════════════════════════════════════════════════════════════

function testCropVolgt() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const namen = ['bboxOverride', 'bboxOverrideTijd', 'bboxOverrideLaatsteMatch', 'bboxOverrideMatchTeller', 'bboxOverrideCamX',
    'bboxOverrideCamY', 'stickyDetectie', 'stickyMissTeller', 'tapSeedDetectie', 'autoSlotUitdager', 'bboxSlot', 'vorigeDetectie',
    'dichtstbijOSM', 'huidigePos', 'snelheidKmh', 'bboxAnchorCx', 'bboxAnchorCy', 'bboxAnchorTijd', 'vergrendeldNodeId',
    'voorkeursBboxCx', 'voorkeursBboxCy', 'voorkeursBboxRuns', 'voorkeursBboxTijd', 'voorkeursBboxStart', 'lbScale', 'lbPadX',
    'lbPadY', 'cropRegio', 'cropAlternatieTeller', 'huidigeCropRatio', 'cropHintPositie', 'cropHintTeller', 'laatsteCropRegio',
    'tikLogArr', 'tikLogStop', 'tikLogVorige', 'tikLogLevend', 'tikTel'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
  const hb = [...headingBuffer];
  const tiklog = localStorage.getItem(TIKLOG_SLEUTEL);
  const echtNu = Date.now;
  let klok = echtNu.call(Date);
  Date.now = () => klok;
  const VW = 2160, VH = 3840, N = 60, DT = 250;
  Object.defineProperty(video, 'videoWidth', { value: VW, configurable: true });
  Object.defineProperty(video, 'videoHeight', { value: VH, configurable: true });
  tikLogStop = true;

  const lamp = (i) => { const h = 30 + i * 2.5; return { x: 1080 + i * 8, y: 1500 - i * 20, h, w: h * 0.4 }; };
  const buur = (i) => { const a = lamp(i); return { x: a.x + 500, y: a.y + 30, h: a.h, w: a.w }; };
  const naarDet = (L, score) => {
    const s = lbScale, ox = cropRegio ? cropRegio.x : 0, oy = cropRegio ? cropRegio.y : 0;
    const bw = cropRegio ? cropRegio.w : VW, bh = cropRegio ? cropRegio.h : VH;
    if (L.x - L.w / 2 < ox || L.x + L.w / 2 > ox + bw || L.y - L.h / 2 < oy || L.y + L.h / 2 > oy + bh) return null;   // buiten het beeld van deze run
    const cx = (L.x - ox) * s + lbPadX, cy = (L.y - oy) * s + lbPadY, w = L.w * s, h = L.h * s;
    if (h < MIN_H_PX) return null;
    const tz = tapZwakPositie();
    const inTik = tz && Math.hypot(cx - tz.cx, cy - tz.cy) <= tikStraalYolo();
    const maxY = (snelheidKmh < 15) ? 0.85 : MAX_Y_RATIO;
    if (!inTik && cy / YOLO_SIZE > maxY) return null;   // postprocessYOLO: onder de horizon van deze run
    const a = new Array(NC).fill(0.001); a[0] = score;
    return { klasse: 0, score, alleScores: a, cx, cy, w, h, x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 };
  };
  const ankerBij = (s1) => {   // zoals de app na een gekozen s1 (W5-anker)
    const ncx = Math.max(0.05, Math.min(0.95, ((s1.cx - lbPadX) / lbScale + (cropRegio ? cropRegio.x : 0)) / VW));
    const ncy = Math.max(0.05, Math.min(0.95, ((s1.cy - lbPadY) / lbScale + (cropRegio ? cropRegio.y : 0)) / VH));
    if (bboxAnchorCx === null) { bboxAnchorCx = ncx; bboxAnchorCy = ncy; }
    else { bboxAnchorCx = BBOX_ANCHOR_EXP * bboxAnchorCx + (1 - BBOX_ANCHOR_EXP) * ncx; bboxAnchorCy = BBOX_ANCHOR_EXP * bboxAnchorCy + (1 - BBOX_ANCHOR_EXP) * ncy; }
    bboxAnchorTijd = Date.now();
  };
  const opzet = () => {
    bboxOverride = null; bboxOverrideTijd = 0; bboxOverrideLaatsteMatch = 0; bboxOverrideMatchTeller = 0;
    bboxOverrideCamX = null; bboxOverrideCamY = null; stickyDetectie = null; stickyMissTeller = 0; tapSeedDetectie = null;
    autoSlotReset(); vorigeDetectie = null; vergrendeldNodeId = null;
    bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
    huidigePos = { lat: 52.0, lon: 5.0 }; dichtstbijOSM = { id: 1, afstand: 120, lat: 52.001, lon: 5.0 };
    snelheidKmh = 25; headingBuffer.length = 0;
    voorkeursBboxCx = null; voorkeursBboxCy = null; voorkeursBboxRuns = 0; voorkeursBboxTijd = 0; voorkeursBboxStart = 0;
    cropAlternatieTeller = 0; huidigeCropRatio = null; cropHintPositie = null; cropHintTeller = 0; cropRegio = null;
  };
  let dbg = [];
  const run = (i) => {
    klok += DT;
    dichtstbijOSM = { ...dichtstbijOSM, afstand: 120 - i * (105 / (N - 1)) };
    try { preprocessVoorYOLO(); } catch (e) { /* tekenen of ort.Tensor kan in de toets ontbreken; crop en schaal staan dan al */ }
    const dets = [naarDet(buur(i), 0.95), naarDet(lamp(i), 0.35)].filter(Boolean).sort((a, b) => b.score - a.score);
    const r = selecteerBesteDetectie(dets);
    if (r.s1) ankerBij(r.s1);
    const c1 = r.s1 ? stickyCam(r.s1) : null, st = stickyDetectie;
    if (i < 6) dbg.push(i + ': crop ' + (cropRegio ? [cropRegio.x, cropRegio.y, cropRegio.w].join('/') : '-') + ' L ' + Math.round(lamp(i).x) + '/' + Math.round(lamp(i).y)
      + ' st ' + (st ? Math.round(st.camX) + '/' + Math.round(st.camY) : '-') + ' dets ' + dets.map(d => Math.round(d.cx) + '/' + Math.round(d.cy)).join(' ') + ' s1 ' + (c1 ? Math.round(c1.camX) + '/' + Math.round(c1.camY) : '-') + ' ' + r.afwijsReden);
    return { r, crop: !!cropRegio, cam: c1 };
  };
  const meet = (rijen) => {
    let wissels = 0, langst = 0, reeks = 0, fout = 0, gezien = 0, cropRuns = 0, ver = 0, spoor = '';
    rijen.forEach(({ r, crop, i, cam }) => {
      if (crop) cropRuns++;
      spoor += !r.s1 ? (crop ? '.' : ':') : '';
      if (!r.s1) { reeks++; langst = Math.max(langst, reeks); return; }
      reeks = 0;
      const c = cam, L = lamp(i), Bu = buur(i);
      if (Math.hypot(c.camX - Bu.x, c.camY - Bu.y) < Math.hypot(c.camX - L.x, c.camY - L.y)) { wissels++; spoor += crop ? 'B' : 'b'; return; }
      spoor += crop ? 'A' : 'a';
      gezien++;
      const a = Math.hypot(c.camX - L.x, c.camY - L.y); if (a > L.h / 2) fout++; ver = Math.max(ver, a);
    });
    return { wissels, bevrorenMs: langst * DT, gezien, fout, cropRuns, ver: Math.round(ver), spoor };
  };

  try {
    // ═══ CV1 — na een tik ═══
    opzet();
    const rij1 = [];
    { const L = lamp(0); tikZet({ det: { klasse: 0 }, camX: L.x, camY: L.y, camH: L.h }, L.x, L.y);
      cropHintPositie = { x: L.x, y: L.y }; cropHintTeller = 10; cropAlternatieTeller = 1; }   // zoals de tik-handler
    for (let i = 0; i < N; i++) rij1.push({ ...run(i), i });
    const m1 = meet(rij1);
    eis('CV1a tik: 0 wissels naar het buurlicht (hogere score) over 60 runs', m1.wissels === 0, '0', m1.wissels + ' | spoor ' + m1.spoor + ' | ' + dbg.join(' ; ')); dbg = [];
    eis('CV1b tik: nooit langer dan 0,5 s zonder box (bevroren)', m1.bevrorenMs <= 500, '<= 500 ms', m1.bevrorenMs + ' ms');
    eis('CV1c tik: de box volgt de lamp (afwijking <= halve lamphoogte in elke run met box)', m1.fout === 0 && m1.gezien >= 50,
        '0 afwijkingen, >= 50 runs met box', 'afwijkend ' + m1.fout + ', runs met box ' + m1.gezien + ', crop-runs ' + m1.cropRuns + ', max ' + m1.ver + ' px');

    // ═══ CV2 — auto-slot ═══
    opzet();
    const rij2 = [];
    { const eerst = run(0); rij2.push({ ...eerst, i: 0 });
      // De lamp is in run 0 gekozen (in welk stelsel ook): het slot gaat op zijn plek in dit stelsel.
      const L = lamp(0), sc = lbScale, ox = cropRegio ? cropRegio.x : 0, oy = cropRegio ? cropRegio.y : 0;
      const cx = (L.x - ox) * sc + lbPadX, cy = (L.y - oy) * sc + lbPadY, w = L.w * sc, h = L.h * sc;
      const a = new Array(NC).fill(0.001); a[0] = 0.35;
      autoSlotZet({ klasse: 0, score: 0.35, alleScores: a, cx, cy, w, h, x1: cx - w / 2, y1: cy - h / 2, x2: cx + w / 2, y2: cy + h / 2 }); }
    for (let i = 1; i < N; i++) rij2.push({ ...run(i), i });
    const m2 = meet(rij2);
    eis('CV2a auto-slot: 0 wissels naar het buurlicht (hogere score)', m2.wissels === 0, '0', String(m2.wissels));
    eis('CV2b auto-slot: nooit langer dan 0,5 s zonder box', m2.bevrorenMs <= 500, '<= 500 ms', m2.bevrorenMs + ' ms | spoor ' + m2.spoor);
    eis('CV2c auto-slot: de box volgt de lamp', m2.fout === 0 && m2.gezien >= 50, '0 afwijkingen, >= 50 runs met box',
        'afwijkend ' + m2.fout + ', runs met box ' + m2.gezien + ', crop-runs ' + m2.cropRuns + ', max ' + m2.ver + ' px');

    // ═══ CV3 — de groene lijn alleen in debug ═══
    const src = String(tekenOverlay);
    eis('CV3 de groene cropgrens en het kruis staan alleen in de debugweergave',
        typeof debugWeergaveAan === 'function' && (src.match(/cropHintTeller > 0 && debugWeergaveAan\(\)/g) || []).length === 2,
        '2 voorwaarden debugWeergaveAan()', String((src.match(/cropHintTeller > 0 && debugWeergaveAan\(\)/g) || []).length));
  } catch (e) {
    eis('CV crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    Date.now = echtNu;
    delete video.videoWidth; delete video.videoHeight;
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    headingBuffer.length = 0; hb.forEach(h => headingBuffer.push(h));
    try { if (tiklog === null) localStorage.removeItem(TIKLOG_SLEUTEL); else localStorage.setItem(TIKLOG_SLEUTEL, tiklog); } catch (e) {}
  }
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testCropVolgt = testCropVolgt;
