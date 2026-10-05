// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tik_vast.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.36.3: de tik houdt vast.
//
//  DE KLACHT (3 oktober 2026, 13:32, Schipholweg 3909607095, stilstaand op
//  68 m). Twee rode lichten, tik op het rechter. ~2 s later keek de app naar
//  het linker en bleef daar, ook toen het rechter groen werd. Younes: "Het
//  maakt niet uit welke kleur, als hij maar mijn tik vasthoudt."
//
//  DE OORZAAK (detlog in de meetdata-export). In de volbeeld-run van 13:32:31.6
//  lag de dichtstbijzijnde detectie 17 YOLO-px (~100 camerapixels) van de
//  sticky: jouw lamp ontbrak. Het buurlicht kwam met 6% door de tik-zone, lag
//  binnen tikStraalYolo() (27 YOLO-px in volbeeld) en werd jouw lamp.
//
//  Het vaste beeld hier is dat van de iPhone: 2160 x 3840, een crop van 0,6
//  (1296 px) om jouw lamp, en een volbeeldrun op 640/3840. Jouw lamp A staat op
//  camerapixel (1000, 1800), de buur B 100 px links. A is in de crop 24 YOLO-px
//  hoog (~48 camerapixels), zoals op 3 oktober. De gewone straal is 162
//  camerapixels; de vaste straal 0,37 x 162 = ~60.
//
//  TV0  vooraf: het beeld, de twee stralen
//  TV1  Schipholweg nagespeeld: V11.36.2 neemt de buur, V11.36.3 toont niets
//       en houdt jouw lamp vast; de meetregel 'weiger' en v/vs/vd
//  TV2  stilstand in de crop: 45 px schudden houdt, 70 px is een lege run
//  TV3  dichtbij (6 m, alles volbeeld): de straal groeit mee met de lamp
//  TV4  kleurwissel: jouw lamp wordt groen naast een rode buur op 40 px
//  TV5  rijdend in de crop verandert er niets (zelfde keuzes als V11.36.2)
//  TV6  rijdend in een volbeeld-run: ook daar geen buur meer
//  TV7  de snelheidsgrens en de toets zonder beeld
//  TV8  zonder identiteit (naast een box getikt) verandert er niets
//  TV9  de meetregel beslist niets en schrijft geen tik-toestand
//  TV10 REGRESSIE: stickySlotMatch en het auto-slot zijn byte-gelijk, en
//       selecteerBesteDetectie zonder de V11.36.3-regels is V11.34.1
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tik_vast.js';
//      document.head.appendChild(s);
//      s.onload = () => testTikVast().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testTikVast() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const r1 = (x) => Math.round(x * 10) / 10;

  const VW = 2160, VH = 3840;
  const A = { x: 1000, y: 1800 }, B = { x: 900, y: 1800 };
  const ZIJDE = 0.6 * VW;                                   // 1296
  const CROP = { x: A.x - ZIJDE / 2, y: A.y - ZIJDE / 2, w: ZIJDE, h: ZIJDE };
  const S_CROP = 640 / ZIJDE;
  const S_VOL = 640 / VH, PAD_VOL = (640 - Math.round(VW * S_VOL)) / 2;
  const naarCrop = (p) => ({ cx: (p.x - CROP.x) * S_CROP, cy: (p.y - CROP.y) * S_CROP });
  const naarVol  = (p) => ({ cx: p.x * S_VOL + PAD_VOL, cy: p.y * S_VOL });
  const plus = (p, dx, dy = 0) => ({ x: p.x + dx, y: p.y + dy });
  const H_CROP = 24, H_VOL = 9;                            // hoogtes zoals op 3 oktober
  const STRAAL_CAM = 80 * VW * 0.6 / 640;                   // 162

  const det = (p, klasse = 0, score = 0.35, h = H_CROP, w = 9) => {
    const alle = new Array(NC).fill(0.001); alle[klasse] = score;
    return { klasse, score, alleScores: alle, cx: p.cx, cy: p.cy, w, h,
             x1: p.cx - w / 2, y1: p.cy - h / 2, x2: p.cx + w / 2, y2: p.cy + h / 2 };
  };
  const zetCrop = () => { lbScale = S_CROP; lbPadX = 0; lbPadY = 0; cropRegio = { ...CROP }; };
  const zetVol  = () => { lbScale = S_VOL; lbPadX = PAD_VOL; lbPadY = 0; cropRegio = null; };
  const crop = (p, klasse, score, h) => { zetCrop(); return det(naarCrop(p), klasse, score, h === undefined ? H_CROP : h); };
  const vol  = (p, klasse, score, h) => { zetVol(); return det(naarVol(p), klasse, score, h === undefined ? H_VOL : h); };

  const namen = ['bboxOverride', 'bboxOverrideTijd', 'bboxOverrideCamX', 'bboxOverrideCamY',
    'bboxOverrideMatchTeller', 'bboxOverrideLaatsteMatch', 'stickyDetectie', 'stickyMissTeller',
    'tapSeedDetectie', 'bboxSlot', 'vorigeDetectie', 'dichtstbijOSM', 'huidigePos', 'snelheidKmh',
    'bboxAnchorCx', 'bboxAnchorCy', 'bboxAnchorTijd', 'vergrendeldNodeId', 'voorkeursBboxCx',
    'voorkeursBboxCy', 'voorkeursBboxRuns', 'voorkeursBboxTijd', 'voorkeursBboxStart',
    'cropHintPositie', 'cropHintTeller', 'cropAlternatieTeller', 'lbScale', 'lbPadX', 'lbPadY',
    'cropRegio', 'laatsteDetecties', 'laatsteDetectiesStelsel', 'zoomVergrendeld',
    'tikLogArr', 'tikLogStop', 'tikLogVorige', 'autoSlotUitdager', 'tikLogLevend', 'tikTel',
    'yawRateDps', 'yawVorigeT', 'detLogStickyDx'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
  const lsTik = localStorage.getItem(TIKLOG_SLEUTEL);
  const metBeeld = () => {
    Object.defineProperty(video, 'videoWidth', { get: () => VW, configurable: true });
    Object.defineProperty(video, 'videoHeight', { get: () => VH, configurable: true });
  };
  const zonderBeeld = () => { delete video.videoWidth; delete video.videoHeight; };
  const tiklog = () => { try { return JSON.parse(localStorage.getItem(TIKLOG_SLEUTEL)) || []; } catch (e) { return []; } };
  const leegTik = () => { tikLogArr = []; tikLogStop = false; tikLogVorige = { tak: null, t: 0 }; localStorage.setItem(TIKLOG_SLEUTEL, '[]'); };
  const schoon = (o) => {
    const opt = o || {};
    bboxOverride = null; bboxOverrideTijd = 0; bboxOverrideLaatsteMatch = 0;
    bboxOverrideCamX = null; bboxOverrideCamY = null; bboxOverrideMatchTeller = 0;
    stickyDetectie = null; stickyMissTeller = 0; tapSeedDetectie = null; autoSlotUitdager = null;
    vorigeDetectie = null; vergrendeldNodeId = null; zoomVergrendeld = false;
    bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
    dichtstbijOSM = { id: 3909607095, afstand: opt.afst != null ? opt.afst : 68, lat: 52.3, lon: 4.75 };
    huidigePos = { lat: 52.3, lon: 4.75 }; snelheidKmh = opt.kmh != null ? opt.kmh : 0;
    voorkeursBboxCx = null; voorkeursBboxCy = null;
    voorkeursBboxRuns = 0; voorkeursBboxTijd = 0; voorkeursBboxStart = 0;
    cropHintPositie = null; cropHintTeller = 0; bboxSlot = 'vrij';
    yawRateDps = 0; yawVorigeT = 0; tikTel = null;
  };
  // Een tik op camerapunt p, via de echte tikZet, met jouw lamp als keuze.
  // camH zoals tikKiesDetectie hem zou geven: de boxhoogte in camerapixels.
  const tik = (p, hCam) => {
    zetCrop();
    const d = det(naarCrop(p));
    tikZet({ det: d, camX: p.x, camY: p.y, camH: hCam === undefined ? H_CROP / S_CROP : hCam }, p.x, p.y);
  };
  const run = (dets) => {
    const r = selecteerBesteDetectie(dets);
    return { r, s1: r.s1, x: stickyDetectie ? stickyDetectie.camX : null };
  };
  const wie = (r, kandidaten) => {
    if (!r.s1) return '-';
    for (const [naam, p] of kandidaten) if (Math.hypot(r.s1.cx - p.cx, r.s1.cy - p.cy) < 0.5) return naam;
    return '?';
  };
  // Het gedrag van V11.36.2: de gewone straal en stickySlotMatch, met straffen.
  const alsV11362 = (f) => {
    const bv = tikStraalVast, bm = tikSlotMatch;
    tikStraalVast = tikStraalYolo; tikSlotMatch = stickySlotMatch;
    try { return f(); } finally { tikStraalVast = bv; tikSlotMatch = bm; }
  };

  try {
    metBeeld();

    // ═══ TV0 — vooraf ══════════════════════════════════════════
    schoon(); zetCrop();
    const rCrop = tikStraalYolo(); zetVol(); const rVol = tikStraalYolo();
    eis('TV0 vooraf: beeld 2160x3840, gewone straal 162 camerapixels = 80 YOLO-px in de crop, 27 in volbeeld',
        Math.abs(tikStraalCam() - STRAAL_CAM) < 0.01 && Math.abs(rCrop - 80) < 0.1 && Math.abs(rVol - 27) < 0.1,
        '162 / 80 / 27', r1(tikStraalCam()) + ' / ' + r1(rCrop) + ' / ' + r1(rVol));

    // ═══ TV1 — Schipholweg nagespeeld ══════════════════════════
    // Crop, crop, dan de volbeeld-run waarin A ontbreekt en B met 6% binnen de
    // straal staat, dan weer de crop met A en B, en tot slot A groen.
    const reeks1 = () => {
      schoon({ afst: 68, kmh: 0 }); leegTik(); tik(A);
      const k = (dets) => dets.map(([n, d]) => [n, d]);
      const uit = [], xs = [];
      let d;
      d = [['A', crop(A)], ['B', crop(B)]];               uit.push(wie(run(d.map(x => x[1])), k(d))); xs.push(r1(stickyDetectie.camX));
      d = [['A', crop(A)], ['B', crop(B)]];               uit.push(wie(run(d.map(x => x[1])), k(d))); xs.push(r1(stickyDetectie.camX));
      d = [['B', vol(B, 0, 0.06)]];                       uit.push(wie(run(d.map(x => x[1])), k(d))); xs.push(r1(stickyDetectie.camX));
      d = [['A', crop(A)], ['B', crop(B)]];               uit.push(wie(run(d.map(x => x[1])), k(d))); xs.push(r1(stickyDetectie.camX));
      d = [['A', crop(A, 1, 0.35)], ['B', crop(B)]];      uit.push(wie(run(d.map(x => x[1])), k(d))); xs.push(r1(stickyDetectie.camX));
      return { wie: uit.join(','), x: xs.join(',') };
    };
    const oud1 = alsV11362(reeks1);
    eis('TV1a V11.36.2 (ter vergelijking): in de volbeeld-run neemt hij B, en blijft daarna bij B, ook als A groen is',
        oud1.wie === 'A,A,B,B,B', 'A,A,B,B,B', oud1.wie);
    const nieuw1 = reeks1();
    eis('TV1b V11.36.3: in de volbeeld-run niets, daarna weer A, ook als A groen is',
        nieuw1.wie === 'A,A,-,A,A', 'A,A,-,A,A', nieuw1.wie);
    eis('TV1c de plek van jouw lamp blijft in de lege run staan (camX 1000)',
        nieuw1.x === '1000,1000,1000,1000,1000', '1000 x5', nieuw1.x);
    tikTelAf();
    const tel1 = tiklog().filter(r => r.s === 'run' && r.tak === 'tel');
    const w1 = tiklog().filter(r => r.s === 'run' && r.tak === 'weiger');
    eis('TV1d de tel-regel: m 4, l 1, v 1, vs 1, vd 100',
        tel1.length === 1 && tel1[0].m === 4 && tel1[0].l === 1 && tel1[0].v === 1 && tel1[0].vs === 1 && tel1[0].vd === 100,
        '4/1/1/1/100', tel1.map(r => `${r.m}/${r.l}/${r.v}/${r.vs}/${r.vd}`).join(' ; ') || 'geen');
    eis('TV1e een regel weiger: a 100, f 6, r 60, n 1, skip 1, kmh 0',
        w1.length === 1 && w1[0].a === 100 && w1[0].f === 6 && w1[0].r === 60 && w1[0].n === 1 && w1[0].skip === 1 && w1[0].kmh === 0,
        '100/6/60/1/1/0', w1.map(r => `${r.a}/${r.f}/${r.r}/${r.n}/${r.skip}/${r.kmh}`).join(' ; ') || 'geen');
    eis('TV1f de regels zijn klein (< 100 tekens), alleen Latin-1, en weiger telt als ruis',
        [...tel1, ...w1].every(r => JSON.stringify(r).length < 100 && !/[^\x00-\xff]/.test(JSON.stringify(r)))
          && w1.length === 1 && !tikLogIsKern(w1[0]) && tikLogIsKern(tel1[0]),
        'klein, Latin-1, ruis', [...tel1, ...w1].map(r => JSON.stringify(r).length).join(' / '));
    // tweemaal geweigerd: v telt door, maar één weiger-regel per tik
    schoon({ afst: 68, kmh: 0 }); leegTik(); tik(A);
    run([vol(B, 0, 0.06)]); run([vol(B, 0, 0.06)]); run([crop(A)]); run([vol(plus(A, -80), 0, 0.2)]);
    tikTelAf();
    const tel1g = tiklog().filter(r => r.tak === 'tel'), w1g = tiklog().filter(r => r.tak === 'weiger');
    eis('TV1g drie weigeringen: v 3, vs 3, vd 80, en toch maar één weiger-regel',
        tel1g.length === 1 && tel1g[0].v === 3 && tel1g[0].vs === 3 && tel1g[0].vd === 80 && w1g.length === 1,
        '3/3/80, 1 regel', tel1g.map(r => `${r.v}/${r.vs}/${r.vd}`).join(' ; ') + ', ' + w1g.length + ' regel(s)');
    // een tik zonder weigering: v 0, geen vs en vd
    schoon({ afst: 68, kmh: 0 }); leegTik(); tik(A);
    run([crop(A), crop(B)]); tikTelAf();
    const tel1h = tiklog().filter(r => r.tak === 'tel');
    eis('TV1h zonder weigering: v 0, en vs en vd staan er niet in',
        tel1h.length === 1 && tel1h[0].v === 0 && !('vs' in tel1h[0]) && !('vd' in tel1h[0]),
        'v 0, zonder vs/vd', tel1h.map(r => JSON.stringify(r)).join(' ; '));

    // ═══ TV2 — stilstand in de crop ════════════════════════════
    schoon({ afst: 68, kmh: 0 }); tik(A);
    const t2a = run([crop(plus(A, 45))]);
    schoon({ afst: 68, kmh: 0 }); tik(A);
    const t2b = run([crop(plus(A, 70))]);
    eis('TV2a stilstaand houdt 45 px schudden (de grootste eigen afwijking in de exports)',
        !!t2a.s1 && Math.abs(t2a.x - 1045) < 1, 'match, camX 1045', t2a.s1 ? r1(t2a.x) : t2a.r.afwijsReden);
    eis('TV2b stilstaand is 70 px een lege run: de tik blijft op 1000, er komt geen andere lamp',
        !t2b.s1 && t2b.r.afwijsReden === 'tik_leeg' && Math.abs(t2b.x - 1000) < 1, 'tik_leeg, camX 1000',
        (t2b.s1 ? 'match ' + r1(t2b.x) : t2b.r.afwijsReden + ' ' + r1(t2b.x)));
    zetCrop();
    eis('TV2c de vaste straal op 68 m is ~60 camerapixels (lamp 48 px hoog: 0,75 x 48 = 36, dus de ondergrens)',
        Math.abs(tikStraalVast() / S_CROP - 0.37 * STRAAL_CAM) < 0.5, r1(0.37 * STRAAL_CAM), r1(tikStraalVast() / S_CROP));

    // ═══ TV3 — dichtbij: de straal groeit mee met de lamp ══════
    // Op 6 m is elke run volbeeld; de lamp is 47 YOLO-px hoog (282 camerapixels).
    // Op 30 september 20:22 verschoof hij daar 69-84 px per run.
    schoon({ afst: 6, kmh: 0 }); zetVol();
    tikZet({ det: det(naarVol(A), 0, 0.6, 47), camX: A.x, camY: A.y, camH: 47 / S_VOL }, A.x, A.y);
    const r3 = tikStraalVast() / S_VOL;
    const t3 = run([vol(plus(A, 80, 0), 0, 0.6, 47)]);
    eis('TV3a dichtbij is de vaste straal de gewone (162): 0,75 x 282 = 211, maar nooit meer dan de gewone straal',
        Math.abs(r3 - STRAAL_CAM) < 0.5, '162', r1(r3));
    eis('TV3b en 80 px verschuiving van jouw eigen grote lamp blijft een match',
        !!t3.s1 && Math.abs(t3.x - 1080) < 1, 'match, camX 1080', t3.s1 ? r1(t3.x) : t3.r.afwijsReden);

    // ═══ TV4 — kleurwissel naast een rode buur ═════════════════
    // C hangt 40 px naast A: binnen de vaste straal. A wordt groen, C blijft rood.
    const C = plus(A, -40);
    const reeks4 = () => {
      schoon({ afst: 68, kmh: 0 }); tik(A);
      const d = [['A', crop(plus(A, 5), 1, 0.35)], ['C', crop(C)]];
      return wie(run(d.map(x => x[1])), d);
    };
    const oud4 = alsV11362(reeks4), nieuw4 = reeks4();
    eis('TV4a V11.36.2 (ter vergelijking): de kleurstraf geeft de rode buur de voorkeur',
        oud4 === 'C', 'C', oud4);
    eis('TV4b V11.36.3: jouw lamp blijft jouw lamp, groen of niet', nieuw4 === 'A', 'A', nieuw4);

    // ═══ TV5 — rijdend in de crop: zoals V11.36.2 ══════════════
    // Zelfde klasse en hoogte overal, dus de straffen spelen niet: de keuzes
    // moeten gelijk zijn aan V11.36.2. Ook de bekende rest: mist A, dan neemt
    // de tik-tak rijdend in de crop nog een detectie op 120 px (V11.38.0).
    const reeks5 = () => {
      schoon({ afst: 120, kmh: 30 }); tik(A);
      const uit = [];
      for (const p of [A, plus(A, 20), plus(A, 130), plus(A, 140), plus(A, 330)]) {
        const t = run([crop(p)]); uit.push(t.s1 ? r1(t.x) : t.r.afwijsReden);
      }
      return uit.join(',');
    };
    const oud5 = alsV11362(reeks5), nieuw5 = reeks5();
    eis('TV5 rijdend in de crop: dezelfde keuzes en dezelfde plek als V11.36.2',
        oud5 === nieuw5 && nieuw5 === '1000,1020,1130,1140,tik_leeg', '1000,1020,1130,1140,tik_leeg', 'oud ' + oud5 + ' | nieuw ' + nieuw5);

    // ═══ TV6 — rijdend, volbeeld-run ═══════════════════════════
    const reeks6 = () => {
      schoon({ afst: 120, kmh: 30 }); tik(A);
      const d = [['B', vol(B, 0, 0.2)]];
      return wie(run(d.map(x => x[1])), d);
    };
    const oud6 = alsV11362(reeks6), nieuw6 = reeks6();
    eis('TV6 rijdend in een volbeeld-run: V11.36.2 nam de buur op 100 px, V11.36.3 toont niets',
        oud6 === 'B' && nieuw6 === '-', 'oud B, nieuw -', 'oud ' + oud6 + ', nieuw ' + nieuw6);

    // ═══ TV7 — snelheidsgrens, en zonder beeld ═════════════════
    schoon({ afst: 68, kmh: 4.9 }); tik(A); zetCrop();
    const r7a = tikStraalVast();
    schoon({ afst: 68, kmh: 5 }); tik(A); zetCrop();
    const r7b = tikStraalVast();
    eis('TV7a onder 5 km/u de vaste straal, vanaf 5 km/u in de crop de gewone',
        r7a < tikStraalYolo() - 1 && Math.abs(r7b - tikStraalYolo()) < 1e-9, '~30 / 80 YOLO-px', r1(r7a) + ' / ' + r1(r7b));
    schoon({ afst: 68, kmh: 0 }); tik(A); zetCrop(); zonderBeeld();
    const r7c = tikStraalVast(), r7d = tikStraalYolo();
    metBeeld();
    eis('TV7b zonder beeld (een test zonder video) is de vaste straal gelijk aan de gewone',
        r7c === r7d, String(r7d), String(r7c));

    // ═══ TV8 — zonder identiteit verandert er niets ════════════
    // Naast elke box getikt: de tik-tak zoekt rond de tikplek met de gewone straal.
    const reeks8 = () => {
      schoon({ afst: 68, kmh: 0 }); zetCrop(); tikZet(null, A.x, A.y);
      const t = run([crop(B)]);
      return t.s1 ? 'eerst ' + r1(t.x) : t.r.afwijsReden;
    };
    const oud8 = alsV11362(reeks8), nieuw8 = reeks8();
    eis('TV8 zonder identiteit (tik naast een box): dezelfde eerste match als V11.36.2',
        oud8 === nieuw8 && nieuw8 === 'eerst 900', 'eerst 900', 'oud ' + oud8 + ' | nieuw ' + nieuw8);

    // ═══ TV9 — de meetregel beslist niets ══════════════════════
    const reeks9 = () => {
      schoon({ afst: 68, kmh: 0 }); tik(A);
      const uit = [];
      // Elke run wordt pas vlak voor zijn beurt opgebouwd: crop() en vol() zetten
      // het stelsel van DIE run.
      for (const maak of [() => [crop(A), crop(B)], () => [vol(B, 0, 0.06)], () => [crop(B)], () => [crop(A)],
                          () => [vol(plus(A, 70))], () => [vol(A)]]) {
        const t = run(maak()); uit.push((t.s1 ? r1(t.x) : t.r.afwijsReden) + ':' + r1(stickyDetectie.camX));
      }
      return uit.join(',');
    };
    const met9 = reeks9();
    tikTelAf();
    const v9 = tiklog().filter(r => r.tak === 'tel').map(r => r.v).join(',');
    const bw = tikWeiger; let zonder9;
    try { tikWeiger = () => {}; zonder9 = reeks9(); } finally { tikWeiger = bw; }
    eis('TV9a zes runs geven met en zonder de meetregel dezelfde keuze en dezelfde plek',
        met9 === zonder9 && met9 === '1000:1000,tik_leeg:1000,tik_leeg:1000,1000:1000,tik_leeg:1000,1000:1000',
        '1000:1000,tik_leeg:1000,tik_leeg:1000,1000:1000,tik_leeg:1000,1000:1000', met9 === zonder9 ? met9 : met9 + ' || ' + zonder9);
    eis('TV9c ... en in die reeks weigerde de meetregel drie keer (v 3)', v9.split(',').pop() === '3', '3', v9);
    eis('TV9b tikWeiger schrijft geen tik-toestand',
        !/(bboxOverride|stickyDetectie|tapSeedDetectie|bboxSlot|stickyMissTeller|bboxOverrideLaatsteMatch)\s*=[^=]/.test(zc(tikWeiger)),
        'geen toewijzing', 'ok');

    // ═══ TV10 — regressie ══════════════════════════════════════
    const ssm = String(stickySlotMatch);
    eis('TV10a stickySlotMatch is byte-gelijk aan V11.36.2 (het auto-slot gebruikt hem)',
        fnv(ssm) === '7d812b24' && ssm.length === 2081, '7d812b24 / 2081', fnv(ssm) + ' / ' + ssm.length);
    const sbd = String(selecteerBesteDetectie);
    const aanroepen = (zc(selecteerBesteDetectie).match(/stickySlotMatch\(/g) || []).length;
    const auto = zc(selecteerBesteDetectie).match(/if \(autoSlotActief\(\)\)[\s\S]{0,200}stickySlotMatch\(([^)]*)\)/);
    eis('TV10b het auto-slot roept nog steeds stickySlotMatch(bruikbaar) aan, en de tik-tak niet meer',
        aanroepen === 1 && !!auto && auto[1].trim() === 'bruikbaar' && (zc(selecteerBesteDetectie).match(/tikSlotMatch\(/g) || []).length === 1,
        '1x stickySlotMatch (auto-slot), 1x tikSlotMatch', aanroepen + 'x / ' + (auto ? auto[1] : 'geen'));
    const terug = sbd.split('\n').filter(l => !/V11\.36\.3/.test(l)).join('\n')
      .replace('const winner = tikSlotMatch(bruikbaar, straalVast);', 'const winner = stickySlotMatch(bruikbaar, straal);');
    eis('TV10c selecteerBesteDetectie zonder de V11.36.3-regels is byte-gelijk aan V11.34.1',
        fnv(terug) === '79a403fa' && terug.length === 14376, '79a403fa / 14376', fnv(terug) + ' / ' + terug.length);
    const ONGEMOEID = { stickyVoorspel: ['f5cc4e22', 1864], stickyProjecteer: ['67c1517b', 312], stickyNeemOver: ['c06db2ce', 386],
      autoSlotZet: ['4e12277f', 313], autoSlotActief: ['f6d9de74', 134], autoSlotUitdagerRijp: ['e5affee2', 413],
      postprocessYOLO: ['42b30c6', 4725], tapZwakPositie: ['49f903a8', 295], tikStraalYolo: ['7014cad2', 165],
      tikStraalCam: ['83ae570a', 208], tikTelRun: ['3475f84', 550], preprocessVoorYOLO: ['f379eecc', 2733] };
    // V11.37.5: postprocessYOLO kreeg vijf regels met merkteken (de beste kandidaat voor de detlog, zie test_knoppen).
    const afw = Object.entries(ONGEMOEID).filter(([n, [h, l]]) => { const s = String(eval(n)).split('\n').filter(l => !/V11\.37\.5/.test(l)).join('\n'); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
    eis('TV10d twaalf functies rond de keuze zijn byte-gelijk aan V11.36.2 (voorspelling, auto-slot, tik-zone, run)',
        afw.length === 0, 'geen afwijking', afw.join(', ') || 'geen');

  } finally {
    zonderBeeld();
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    if (lsTik === null) localStorage.removeItem(TIKLOG_SLEUTEL); else localStorage.setItem(TIKLOG_SLEUTEL, lsTik);
    tikLogArr = null;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testTikVast = testTikVast;
