// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tiklog.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.32.0 (de tik laat een spoor na, een meetlaag) en V11.33.0
//  (de tik wint, of de app toont niets).
//
//  DE KLACHT. Tik op A en de box springt naar buurlicht B. Tik op B en hij
//  springt terug naar A. In de STAP 0 van 27 september zijn vijf mechanismen
//  gevonden, en uit de exports was niet te zien welk het was: nergens stond
//  waar de box stond.
//
//  TL0  KERN, OMGEDRAAID. In V11.32.0 legden deze toetsen het OUDE gedrag vast
//       (M1-M5 uit de STAP 0), en daar waren ze groen. Sinds V11.33.0 staat
//       dezelfde opzet er met het tegenovergestelde oordeel. De V11.32.0-versie
//       van dit bestand faalt op V11.33.0 precies op deze toetsen.
//       a  M1  tik op een lamp die het model niet ziet: niet de buur, de plek
//       b  M2  crop en volbeeld door elkaar: een tik op A blijft A
//       c  M3  onder 15 m: A mist, dan niets tonen, geen overname
//       d  M4  resetNeutraal bij een uitval laat de tik staan
//       e  M5  groen wist de tik-sticky niet meer (op de bron)
//       f  M5  de eerste match zoekt rond de tik in DIT stelsel: A
//       g  M3  op volbeeld is de straal niet meer drie keer zo ruim
//  TL1  de tik-regel: pad, keuze, echte afstand, verkeerde keuze, stelsel, en
//       sinds V11.34.0 de viewport (sw/sh) en de ware coördinaat aan de rand
//  TL2  de run-regels: overname, sprong, eerste match, dubbel onderdrukt
//  TL3  de los-regels: elke reden, en niets als er geen tik was. De node-wissel
//       en de correctie meldt een wachter, want die twee functies pint NB14.
//  TL4  de ring, en een vol quotum staakt het log zonder de app te raken
//  TL5  de tiklog reist mee in de meetdata-export
//  TL6  de logfuncties beslissen niets en zijn in V11.33.0 onaangeroerd. Dat
//       V11.32.0 zelf niets aan het gedrag veranderde, bewees de V11.32.0-versie
//       van deze toets (elf functies en de handler byte-gelijk aan V11.31.0).
//  TL7  laatsteDetectiesStelsel volgt de run die de detecties opleverde
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tiklog.js';
//      document.head.appendChild(s);
//      s.onload = () => testTiklog().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testTiklog() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const r1 = (x) => Math.round(x * 10) / 10;

  // ── Het vaste beeld: 1080 x 1920, crop 0,6 om (540, 500) ──
  const VW = 1080, VH = 1920;
  const CROP = { x: 216, y: 176, w: 648, h: 648 };
  const S_CROP = 640 / 648;
  const S_VOL = 640 / 1920, PAD_VOL = (640 - Math.round(VW * S_VOL)) / 2;   // 140
  const ST_CROP = { s: S_CROP, px: 0, py: 0, x: CROP.x, y: CROP.y };
  const naarCrop = (x, y) => ({ cx: (x - CROP.x) * S_CROP, cy: (y - CROP.y) * S_CROP });
  const naarVol  = (x, y) => ({ cx: x * S_VOL + PAD_VOL, cy: y * S_VOL });
  const A = { x: 590, y: 450 }, B = { x: 500, y: 440 };

  const det = (p, klasse = 0, score = 0.6, w = 14, h = 40) => {
    const alle = new Array(NC).fill(0.001); alle[klasse] = score;
    return { klasse, score, alleScores: alle, cx: p.cx, cy: p.cy, w, h,
             x1: p.cx - w / 2, y1: p.cy - h / 2, x2: p.cx + w / 2, y2: p.cy + h / 2 };
  };
  const zetCrop = () => { lbScale = S_CROP; lbPadX = 0; lbPadY = 0; cropRegio = { ...CROP }; };
  const zetVol  = () => { lbScale = S_VOL; lbPadX = PAD_VOL; lbPadY = 0; cropRegio = null; };
  // V11.33.0: de identiteitsstraal hangt aan de beeldmaat. Zonder beeld (een
  // testpagina) valt hij terug op de oude straal; TL0g zet daarom een nep-beeld.
  const metBeeld = () => {
    Object.defineProperty(video, 'videoWidth', { get: () => VW, configurable: true });
    Object.defineProperty(video, 'videoHeight', { get: () => VH, configurable: true });
  };
  const zonderBeeld = () => { delete video.videoWidth; delete video.videoHeight; };

  // ── Alles wat deze suite aanraakt, en weer terugzet ───────
  const namen = ['bboxOverride', 'bboxOverrideTijd', 'bboxOverrideCamX', 'bboxOverrideCamY',
    'bboxOverrideMatchTeller', 'bboxOverrideLaatsteMatch', 'stickyDetectie', 'stickyMissTeller',
    'tapSeedDetectie', 'bboxSlot', 'vorigeDetectie', 'dichtstbijOSM', 'huidigePos', 'snelheidKmh',
    'bboxAnchorCx', 'bboxAnchorCy', 'bboxAnchorTijd', 'vergrendeldNodeId', 'voorkeursBboxCx',
    'voorkeursBboxCy', 'voorkeursBboxRuns', 'voorkeursBboxTijd', 'voorkeursBboxStart',
    'cropHintPositie', 'cropHintTeller', 'cropAlternatieTeller', 'lbScale', 'lbPadX', 'lbPadY',
    'cropRegio', 'laatsteDetecties', 'laatsteDetectiesStelsel', 'zoomVergrendeld',
    'cameraTapMarker', 'tikLogArr', 'tikLogStop', 'tikLogVorige', 'autoSlotUitdager',
    'tikLogLevend', 'laatsteNodeWisselTijd', 'laatsteNodeCorrectieTijd'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
  const cw = canvas.width, ch = canvas.height;
  const lsTik = localStorage.getItem(TIKLOG_SLEUTEL);

  const leegTik = () => { tikLogArr = []; tikLogStop = false; tikLogVorige = { tak: null, t: 0 };
                          localStorage.setItem(TIKLOG_SLEUTEL, '[]'); };
  const tiklog = () => { try { return JSON.parse(localStorage.getItem(TIKLOG_SLEUTEL)) || []; } catch (e) { return []; } };
  const regelsVan = (s) => tiklog().filter(r => r.s === s);

  const schoon = (o) => {
    const opt = o || {};
    bboxOverride = opt.tap !== undefined ? opt.tap : null;
    bboxOverrideTijd = Date.now(); bboxOverrideLaatsteMatch = Date.now();
    bboxOverrideCamX = opt.camX != null ? opt.camX : null;
    bboxOverrideCamY = opt.camY != null ? opt.camY : null;
    bboxOverrideMatchTeller = opt.matches != null ? opt.matches : 0;
    stickyDetectie = opt.sticky !== undefined ? opt.sticky : null;
    stickyMissTeller = 0; tapSeedDetectie = null; autoSlotUitdager = null;
    vorigeDetectie = null; vergrendeldNodeId = null; zoomVergrendeld = false;
    bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
    dichtstbijOSM = opt.afst != null ? { id: 860541, afstand: opt.afst, lat: 52.0, lon: 4.7 } : null;
    huidigePos = { lat: 52.0, lon: 4.7 };
    snelheidKmh = 0;
    voorkeursBboxCx = null; voorkeursBboxCy = null;
    voorkeursBboxRuns = 0; voorkeursBboxTijd = 0; voorkeursBboxStart = 0;
    cropHintPositie = null; cropHintTeller = 0;
    bboxSlot = 'vrij';
  };
  // Een sticky op camerapositie p, geprojecteerd in het huidige stelsel.
  const stickyOp = (p, h = 40) => {
    const c = { cx: (p.x - (cropRegio ? cropRegio.x : 0)) * lbScale + lbPadX,
                cy: (p.y - (cropRegio ? cropRegio.y : 0)) * lbScale + lbPadY };
    return { cx: c.cx, cy: c.cy, camX: p.x, camY: p.y, camH: h / lbScale, camAfst: null,
             familie: 'rood', hoogte: h, klasse: 0, tijd: Date.now() };
  };
  // Een echte tik op het canvas, op camerapositie p: daar waar p OP HET SCHERM
  // staat. Het canvas staat op object-fit: cover (één schaal, de grootste,
  // gecentreerd). V11.34.0: tot dan rekende deze helper uitgerekt, net als de
  // app, en maakte hij de randfout van de handler precies ongedaan.
  const tikOp = (p) => {
    const r = canvas.getBoundingClientRect();
    const cssW = canvas.offsetWidth, cssH = canvas.offsetHeight;
    const s = Math.max(cssW / canvas.width, cssH / canvas.height);
    const qx = (cssW - canvas.width * s) / 2 + p.x * s, qy = (cssH - canvas.height * s) / 2 + p.y * s;
    // Hele schermpixels, zoals een echte klik: Chromium kapt clientX en clientY
    // van een MouseEvent af op gehele getallen.
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX: Math.round(r.left + qx * (r.width / cssW)), clientY: Math.round(r.top + qy * (r.height / cssH)), bubbles: true }));
  };

  try {
    canvas.width = VW; canvas.height = VH;
    if (!eis('TL0 vooraf: het canvas is zichtbaar, dus een tik is te simuleren',
             canvas.offsetWidth > 0 && canvas.offsetHeight > 0, '> 0', canvas.offsetWidth + 'x' + canvas.offsetHeight)) {
      const g = regels.filter(r => r.uitslag === 'GEFAALD').length;
      return { geslaagd: regels.length - g, gefaald: g, regels };
    }

    // ═══ TL0a — M1: de handler pakt de buur ═════════════════
    // A staat niet in de detecties (te zwak), B wel. Stelsels kloppen.
    schoon(); leegTik(); zetCrop();
    const bCrop = naarCrop(B.x, B.y);
    laatsteDetecties = [det(bCrop)];
    laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    const aCropTik = naarCrop(A.x, A.y);
    eis('TL0a M1 omgedraaid: een tik op A, die niet gedetecteerd is, vergrendelt op A, niet op buur B',
        !!bboxOverride && Math.abs(bboxOverride.cx - aCropTik.cx) < 1 && Math.abs(bboxOverrideCamX - A.x) < 2
          && stickyDetectie === null,
        'lock op A (' + r1(aCropTik.cx) + '), geen sticky',
        bboxOverride ? r1(bboxOverride.cx) + ', cam ' + r1(bboxOverrideCamX) + ', sticky ' + !!stickyDetectie : 'geen lock');
    let tk = regelsVan('tik').pop();
    eis('TL1a de tik-regel: pad A, niet gesnapt, de buur lag ~91 camerapixels verderop',
        tk && tk.pad === 'A' && tk.snap === 0 && tk.dMin >= 88 && tk.dMin <= 93 && tk.n === 1 && tk.st === 0,
        'A / 0 / dMin ~91 / n 1 / st 0', tk && `${tk.pad} / ${tk.snap} / ${tk.dMin} / n ${tk.n} / st ${tk.st}`);
    eis('TL1b de tikplek staat er in camerapixels bij (op één schermpixel na)',
        tk && Math.abs(tk.cx - A.x) <= 2 && Math.abs(tk.cy - A.y) <= 2,
        A.x + ', ' + A.y, tk && tk.cx + ', ' + tk.cy);

    // ═══ TL0b — M2: de coördinatenval ═══════════════════════
    // De detecties komen uit een CROP-run, de lopende run is VOLBEELD. Een tik
    // precies op A wordt met het volbeeld-stelsel omgerekend en landt op B.
    schoon(); leegTik(); zetVol();
    const aCrop = naarCrop(A.x, A.y);
    laatsteDetecties = [det(aCrop), det(bCrop)];
    laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    const aVol = naarVol(A.x, A.y);
    eis('TL0b M2 omgedraaid: een tik precies op A blijft A, ook als crop en volbeeld door elkaar lopen',
        !!bboxOverride && Math.abs(bboxOverride.cx - aVol.cx) < 1 && !!stickyDetectie && Math.abs(stickyDetectie.camX - A.x) < 2,
        'lock en sticky op A (' + r1(aVol.cx) + ')', bboxOverride ? r1(bboxOverride.cx) + ', sticky ' + (stickyDetectie ? r1(stickyDetectie.camX) : '-') : 'geen lock');
    tk = regelsVan('tik').pop();
    eis('TL1c de tik-regel: ander stelsel gezien, en toch de goede keuze, op de box zelf',
        tk && tk.st === 1 && tk.mis === 0 && tk.dMin <= 1 && tk.vol === 1 && tk.snap === 1 && tk.rand === 0,
        'st 1 / mis 0 / dMin 0 / vol 1 / snap 1 / rand 0', tk && `st ${tk.st} / mis ${tk.mis} / dMin ${tk.dMin} / vol ${tk.vol} / snap ${tk.snap} / rand ${tk.rand}`);
    eis('TL1d V11.34.0: de tik-regel legt de viewport vast (sw/sh), zodat de weggevallen strook uit de export te halen is',
        tk && tk.sw === canvas.offsetWidth && tk.sh === canvas.offsetHeight && tk.sw > 0,
        canvas.offsetWidth + ' x ' + canvas.offsetHeight, tk && tk.sw + ' x ' + tk.sh);
    // Het iPhone-scherm (393x852 CSS-px) en een lamp op camera-x 300: die staat
    // op het scherm op CSS-x 90,0. Tot en met V11.33.0 kwam daar 247 in het log.
    const stijl1 = canvas.getAttribute('style');
    try {
      canvas.style.width = '393px'; canvas.style.height = '852px'; canvas.style.transform = '';
      schoon(); leegTik(); zetCrop(); laatsteDetecties = []; laatsteDetectiesStelsel = { ...ST_CROP };
      tikOp({ x: 300, y: 960 });   // op het scherm precies (90, 426): hele pixels
      tk = regelsVan('tik').pop();
      eis('TL1e V11.34.0: bij de schermrand staat de ware cameracoördinaat in het log (300, niet 247), met 393 x 852',
          tk && tk.cx === 300 && tk.cy === 960 && tk.sw === 393 && tk.sh === 852,
          '300, 960 / 393 x 852', tk && `${tk.cx}, ${tk.cy} / ${tk.sw} x ${tk.sh}`);
    } finally {
      if (stijl1 === null) canvas.removeAttribute('style'); else canvas.setAttribute('style', stijl1);
    }

    // ═══ TL0c — M3: overname onder 15 m, zonder straal ══════
    schoon({ afst: 10 }); leegTik(); zetVol();
    bboxOverride = { cx: 0, cy: 0 }; bboxOverrideCamX = A.x; bboxOverrideCamY = A.y;
    stickyDetectie = stickyOp(A);
    const ver = naarVol(900, 450);                // 310 camerapixels van A
    const rc = selecteerBesteDetectie([det(ver)]);
    eis('TL0c M3 omgedraaid: onder 15 m, A mist, een lamp op 310 camerapixels — niets tonen, geen overname',
        rc.s1 === null && rc.afwijsReden === 'tik_leeg' && Math.abs(stickyDetectie.camX - A.x) < 0.01,
        'null + tik_leeg, sticky op A', (rc.s1 ? r1(rc.s1.cx) : 'null') + ' + ' + rc.afwijsReden);
    let rn = regelsVan('run');
    eis('TL2a de run-regel zegt: leeg, met het aantal kandidaten in beeld',
        rn.length === 1 && rn[0].tak === 'leeg' && rn[0].n === 1 && rn[0].skip === 1,
        'leeg, n 1, skip 1', JSON.stringify(rn));

    // ═══ TL0g — M3: op volbeeld is de straal drie keer zo ruim ═
    // Dezelfde verschuiving van 200 camerapixels: op volbeeld een geldige
    // match (67 YOLO-px < 80), in de crop niet (197 YOLO-px).
    metBeeld();
    let rg;
    const opzij = { x: A.x + 200, y: A.y };
    try {
      schoon({ afst: 40 }); leegTik(); zetVol();
      bboxOverride = { cx: 0, cy: 0 }; bboxOverrideCamX = A.x; bboxOverrideCamY = A.y;
      stickyDetectie = stickyOp(A);
      rg = selecteerBesteDetectie([det(naarVol(opzij.x, opzij.y))]);
    } finally { zonderBeeld(); }
    eis('TL0g M3 omgedraaid: op volbeeld is 200 camerapixels naast A geen match meer',
        !rg.s1 && rg.afwijsReden === 'tik_leeg', 'geen + tik_leeg',
        (rg.s1 ? 'match' : 'geen') + ' + ' + rg.afwijsReden);
    // een sprong BINNEN de straal (70 camerapixels in de crop) wordt nog gelogd
    schoon({ afst: 40 }); leegTik(); zetCrop();
    bboxOverride = { cx: 0, cy: 0 }; bboxOverrideCamX = A.x; bboxOverrideCamY = A.y;
    stickyDetectie = stickyOp(A);
    selecteerBesteDetectie([det(naarCrop(A.x + 70, A.y))]);
    rn = regelsVan('run');
    eis('TL2b een verschuiving van 70 camerapixels binnen de straal heet in de log een sprong',
        rn.length && rn[rn.length - 1].tak === 'sprong' && rn[rn.length - 1].sprong >= 68 && rn[rn.length - 1].sprong <= 72,
        'sprong ~70', JSON.stringify(rn.slice(-1)));
    schoon({ afst: 40 }); zetCrop();
    bboxOverride = { cx: 0, cy: 0 }; bboxOverrideCamX = A.x; bboxOverrideCamY = A.y;
    stickyDetectie = stickyOp(A);
    const rg2 = selecteerBesteDetectie([det(naarCrop(opzij.x, opzij.y))]);
    eis('TL0g2 ... en in de crop evenmin',
        !rg2.s1 && rg2.afwijsReden === 'tik_leeg', 'geen + tik_leeg',
        (rg2.s1 ? 'match' : 'geen') + ' + ' + rg2.afwijsReden);

    // ═══ TL0d — M4: resetNeutraal wist de tik ═══════════════
    schoon({ tap: { cx: 300, cy: 200 }, camX: A.x, camY: A.y, afst: 12 }); leegTik();
    stickyDetectie = { cx: 300, cy: 200, familie: 'rood', hoogte: 40, klasse: 0, tijd: Date.now() };
    resetNeutraal('dropout');
    eis('TL0d M4 omgedraaid: resetNeutraal bij een uitval laat de tik en zijn sticky staan',
        bboxOverride !== null && stickyDetectie !== null, 'tik staat', 'bboxOverride=' + JSON.stringify(bboxOverride));
    let los = regelsVan('los').pop();
    rn = regelsVan('run');
    eis('TL3a geen los-regel, wel een run-regel reset_dropout',
        !los && rn.length && rn[rn.length - 1].tak === 'reset_dropout', 'geen los, run reset_dropout',
        JSON.stringify(los) + ' / ' + JSON.stringify(rn.slice(-1)));

    // ═══ TL0e — M5: groen wist de tik-sticky (op de bron) ═══
    const fase5 = zc(verwerkFase);
    const groenBlok = fase5.slice(fase5.indexOf("if (nieuw === 'groen') {"), fase5.indexOf("if (nieuw === 'groen') {") + 2200);
    eis('TL0e M5 omgedraaid: in de groene tak wist alleen een sticky zonder tik',
        /if \(bboxOverride === null\)\s*\{\s*stickyDetectie = null/.test(groenBlok)
          && !/\n\s*stickyDetectie = null; stickyMissTeller = 0;/.test(groenBlok),
        'voorwaardelijk', /if \(bboxOverride === null\)/.test(groenBlok) ? 'voorwaardelijk' : 'onvoorwaardelijk');
    eis('TL3b de groen_sticky-logregel is weg: dat gebeurt niet meer',
        !/groen_sticky/.test(String(verwerkFase)), 'weg', 'ok');

    // ═══ TL0f — M5: closest op de oude YOLO-positie ═════════
    // Getikt op A in een crop-run; bboxOverride staat in die YOLO-ruimte. Nu
    // volbeeld, sticky weg (groen). B ligt dichter bij die OUDE positie.
    schoon({ tap: { ...aCrop }, camX: A.x, camY: A.y, afst: 20 }); leegTik(); zetVol();
    const bLaag = naarVol(560, 780);
    const rf = selecteerBesteDetectie([det(naarVol(A.x, A.y)), det(bLaag)]);
    eis('TL0f M5 omgedraaid: de eerste match zoekt rond de tik in DIT stelsel, en vindt A',
        !!rf.s1 && Math.abs(rf.s1.cx - naarVol(A.x, A.y).cx) < 0.5, 'A ' + r1(naarVol(A.x, A.y).cx), rf.s1 ? r1(rf.s1.cx) : 'geen');
    rn = regelsVan('run');
    eis('TL2c de log zegt: eerste match, op de tik zelf',
        rn.length && rn[rn.length - 1].tak === 'eerst' && rn[rn.length - 1].dCam <= 2,
        'eerst, ~0', JSON.stringify(rn.slice(-1)));

    // ═══ TL2 — dubbele run-regels ═══════════════════════════
    leegTik();
    tikLogRun('mis1', {}); tikLogRun('mis1', {}); tikLogRun('over_c', {});
    eis('TL2d dezelfde tak binnen TIKLOG_HERHAAL_MS komt er één keer in',
        regelsVan('run').map(r => r.tak).join(',') === 'mis1,over_c', 'mis1,over_c', regelsVan('run').map(r => r.tak).join(','));

    // ═══ TL3 — los: de andere redenen en de stilte ══════════
    leegTik(); schoon();
    tikLogLos('node');
    eis('TL3c geen tik, geen los-regel', regelsVan('los').length === 0, 0, regelsVan('los').length);
    eis('TL3d de reset-aanroepen dragen hun reden',
        /resetNeutraal\('dropout'\)/.test(zc(verwerkDetecties)) && /resetNeutraal\('stale'\)/.test(zc(lus))
          && /resetNeutraal\('startscherm'\)/.test(zc(naarStartscherm)),
        'dropout / stale / startscherm', 'ok');
    eis('TL3e GPS-voorbij logt vlak vóór het de tik wist',
        /tikLogLos\('voorbij'\);\s*bboxOverride = null/.test(zc(onGPS)), 'aanwezig', 'ok');
    // De node-wissel en de correctie staan vast (NB14). Die meldt de wachter.
    laatsteNodeWisselTijd = 0; laatsteNodeCorrectieTijd = 0;   // geen restant van een vorige toets
    leegTik(); schoon({ tap: { cx: 1, cy: 1 }, afst: 30 });
    tikLogWaak();                                     // de tik leeft: gewapend
    bboxOverride = null; bboxOverrideTijd = 0;        // zoals updateDichtbij doet
    laatsteNodeWisselTijd = Date.now();
    tikLogWaak();
    los = regelsVan('los').pop();
    eis('TL3h de wachter ziet een ongemelde node-wissel: los node, met de oude node',
        los && los.reden === 'node' && los.van === '860541' && los.duur >= 0, 'node / 860541',
        JSON.stringify(los));
    leegTik(); schoon({ tap: { cx: 1, cy: 1 }, afst: 30 });
    tikLogWaak();
    bboxOverride = null;
    laatsteNodeWisselTijd = Date.now(); laatsteNodeCorrectieTijd = Date.now();   // zoals corrigeerNodeAutomatisch
    tikLogWaak();
    los = regelsVan('los').pop();
    eis('TL3i ... en een automatische correctie als correctie', los && los.reden === 'correctie',
        'correctie', JSON.stringify(los));
    leegTik(); schoon({ tap: { cx: 1, cy: 1 }, afst: 30 });
    tikLogWaak();
    tikLogLos('reset_proef'); bboxOverride = null;
    tikLogWaak(); tikLogWaak();
    eis('TL3j een gemelde los wordt niet nog eens door de wachter gemeld',
        regelsVan('los').map(r => r.reden).join(',') === 'reset_proef', 'reset_proef',
        regelsVan('los').map(r => r.reden).join(','));
    // Een node-wissel en meteen een nieuwe tik, nog vóór er een run was: de
    // tik moet eerst de ongemelde wissel melden, anders is die regel weg.
    laatsteNodeWisselTijd = 0; laatsteNodeCorrectieTijd = 0;
    leegTik(); schoon({ tap: { cx: 1, cy: 1 }, camX: 10, camY: 10 }); zetCrop();
    tikLogWaak();
    bboxOverride = null; bboxOverrideTijd = 0; laatsteNodeWisselTijd = Date.now();
    laatsteDetecties = []; laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    eis('TL3l een tik vlak na een ongemelde wissel meldt eerst die wissel',
        tiklog().map(r => r.s === 'los' ? 'los:' + r.reden : r.s).join(',') === 'los:node,tik',
        'los:node,tik', tiklog().map(r => r.s === 'los' ? 'los:' + r.reden : r.s).join(','));
    const NB14 = [['checkHandLockVerval', '2df4f7ed', 5513], ['checkNodeCorrectieStilstand', '8c801fd8', 4751],
                  ['corrigeerNodeAutomatisch', 'afe7b427', 4118], ['updateDichtbij', 'e82d3c0', 11914],
                  ['vindDichtbij', '2db98dab', 2954]];
    const nbAnders = NB14.filter(([n, h, l]) => fnv(String(eval(n))) !== h || String(eval(n)).length !== l).map(x => x[0]);
    eis('TL3k de vijf NB14-functies van V11.27.0 zijn onaangeroerd', nbAnders.length === 0,
        'geen afwijking', nbAnders.join(', ') || 'geen');
    schoon({ tap: { cx: 1, cy: 1 } }); leegTik();
    bboxOverrideLaatsteMatch = Date.now() - (TAP_KWIJT_MS + 500);
    bboxOverrideTijd = Date.now() - (TAP_KWIJT_MS + 500);
    const r3f = selecteerBesteDetectie([det({ cx: 320, cy: 200 })]);
    los = regelsVan('los').pop();
    eis('TL3f na TAP_KWIJT_MS zonder match: geen los, de tik zoekt verder',
        !los && bboxOverride !== null && r3f.s1 === null && r3f.afwijsReden === 'tik_zoekt',
        'geen los, tik_zoekt', JSON.stringify(los) + ' / ' + r3f.afwijsReden);
    schoon({ tap: { cx: 1, cy: 1 }, camX: 10, camY: 10 }); leegTik(); zetCrop();
    laatsteDetecties = []; laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    eis('TL3g een nieuwe tik over een levende heen: eerst los nieuw, dan de tik',
        tiklog().map(r => r.s === 'los' ? 'los:' + r.reden : r.s).join(',') === 'los:nieuw,tik',
        'los:nieuw,tik', tiklog().map(r => r.s === 'los' ? 'los:' + r.reden : r.s).join(','));

    // ═══ TL4 — de ring en een vol quotum ════════════════════
    leegTik();
    for (let i = 0; i < TIKLOG_MAX + 7; i++) tikLogNoteer('run', { tak: 'x' + i });
    const ring = tiklog();
    const achter = ring.length ? ring[ring.length - 1].tak : '-';
    eis('TL4a de ring houdt TIKLOG_MAX regels, de nieuwste achteraan',
        ring.length === TIKLOG_MAX && achter === 'x' + (TIKLOG_MAX + 6),
        TIKLOG_MAX, ring.length + ' / ' + achter);
    eis('TL4b TIKLOG_MAX is 100 en een run-regel blijft onder de 90 tekens',
        TIKLOG_MAX === 100 && JSON.stringify({ t: Date.now(), s: 'run', tak: 'over_c', skip: 1, dCam: 310, sprong: 310 }).length < 90,
        '100 / < 90', TIKLOG_MAX);
    const origSet = Storage.prototype.setItem;
    let fout4 = null;
    try {
      Storage.prototype.setItem = function (k, v) {
        if (k === TIKLOG_SLEUTEL) throw new DOMException('vol', 'QuotaExceededError');
        return origSet.call(this, k, v);
      };
      tikLogNoteer('run', { tak: 'vol' });
    } catch (e) { fout4 = e; } finally { Storage.prototype.setItem = origSet; }
    eis('TL4c een vol quotum gooit niet en staakt het log voor deze sessie',
        fout4 === null && tikLogStop === true && localStorage.getItem(TIKLOG_SLEUTEL) === null,
        'geen fout, gestaakt, sleutel weg', `${fout4 && fout4.name} / ${tikLogStop} / ${localStorage.getItem(TIKLOG_SLEUTEL) === null}`);
    tikLogNoteer('run', { tak: 'na' });
    eis('TL4d ... en schrijft daarna niets meer', localStorage.getItem(TIKLOG_SLEUTEL) === null, 'null', localStorage.getItem(TIKLOG_SLEUTEL));
    tikLogStop = false;

    // ═══ TL5 — de export ════════════════════════════════════
    leegTik(); schoon({ tap: { cx: 1, cy: 1 } }); tikLogLos('proef');
    const blobs = [];
    const bew = { url: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click, alert: window.alert,
                  cs: Object.getOwnPropertyDescriptor(navigator, 'canShare') };
    const schaduw = localStorage.getItem('sl_schaduwlog');
    try {
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:proef'; };
      HTMLAnchorElement.prototype.click = function () {};
      window.alert = () => {};
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
      exporteerMeetdata();
      for (let i = 0; i < 40 && blobs.length < 2; i++) await slaap(50);
    } finally {
      URL.createObjectURL = bew.url; HTMLAnchorElement.prototype.click = bew.klik; window.alert = bew.alert;
      if (bew.cs) Object.defineProperty(navigator, 'canShare', bew.cs); else delete navigator.canShare;
      if (schaduw !== null) localStorage.setItem('sl_schaduwlog', schaduw);
    }
    let meet = null;
    for (const b of blobs) { const j = JSON.parse(await b.text()); if (!Array.isArray(j.sleutels)) meet = j; }
    eis('TL5 de meetdata-export bevat uit.tik met sl_tiklog',
        !!meet && meet.tik && Array.isArray(meet.tik[TIKLOG_SLEUTEL]) && meet.tik[TIKLOG_SLEUTEL].some(r => r.reden === 'proef'),
        'tik.sl_tiklog met de proefregel', meet ? Object.keys(meet.tik || {}).join(',') : 'geen export');

    // ═══ TL6 — de logfuncties ═════════════════════════════
    // Onaangeroerd door V11.33.0 (gemeten op fase_d, V11.32.0).
    const LOG = { tikLogNoteer: ['d9f96f8', 1154], tikLogWaak: ['25490478', 714], tikLogRun: ['2f4dd880', 262],
                  tikLogLos: ['790260fe', 342], tikLogSprong: ['7eebe753', 303], tikLogAfstTotTik: ['712b95b9', 190],
                  tikLogStelselNu: ['4a961775', 154], tikLogDetCam: ['4cc27fb2', 204] };
    const logAnders = Object.entries(LOG).filter(([n, [h, l]]) => fnv(String(eval(n))) !== h || String(eval(n)).length !== l).map(x => x[0]);
    eis('TL6a acht logfuncties zijn byte-gelijk aan V11.32.0', logAnders.length === 0, 'geen afwijking', logAnders.join(', ') || 'geen');
    let handler = null;
    try {
      const src = await (await fetch('/index.html?' + Date.now())).text();
      const i6 = src.indexOf("canvas.addEventListener('click', (e) => {");
      handler = src.slice(i6, src.indexOf('\n});', i6) + 4);
    } catch (e) {}
    eis('TL6b de handler logt de keuze die hij maakte: de detectie en de rand-afstand',
        !!handler && /tikLogTik\(videoX, videoY, heeftActieveBbox, keuze \? keuze\.det : null, keuze \? keuze\.rand : null\)/.test(handler),
        'aanwezig', handler ? 'gelezen' : 'niet gelezen');
    eis('TL6c ... vóór hij de lock zet (tikZet), zodat een vorige tik nog als los meetelt',
        !!handler && handler.indexOf('tikLogTik(') < handler.indexOf('tikZet('), 'eerst loggen', 'ok');
    eis('TL6d de logfuncties beslissen niets: ze schrijven geen tik-toestand',
        !/(bboxOverride|stickyDetectie|tapSeedDetectie|bboxSlot)\s*=[^=]/.test(
          zc(tikLogNoteer) + zc(tikLogRun) + zc(tikLogLos) + zc(tikLogTik) + zc(tikLogSprong) + zc(tikLogAfstTotTik)),
        'geen toewijzing', 'ok');

    // ═══ TL7 — het stelsel van de run ═══════════════════════
    zetCrop();
    laatsteDetectiesStelsel = null;
    const bewAi = { laatsteAI, nieuwAIResultaat, debugWaardenAi: debugWaarden.ai };
    try { _verwerkWorkerResultaatKern([]); } catch (e) {}
    laatsteAI = bewAi.laatsteAI; nieuwAIResultaat = bewAi.nieuwAIResultaat; debugWaarden.ai = bewAi.debugWaardenAi;
    eis('TL7 een verwerkte run legt zijn eigen stelsel vast',
        !!laatsteDetectiesStelsel && Math.abs(laatsteDetectiesStelsel.s - S_CROP) < 1e-9
          && laatsteDetectiesStelsel.x === CROP.x && laatsteDetectiesStelsel.y === CROP.y,
        'crop 0,988 @ 216,176', JSON.stringify(laatsteDetectiesStelsel));
    // ... en elke run kijkt of een tik ongemeld verdween
    laatsteNodeWisselTijd = 0; laatsteNodeCorrectieTijd = 0;
    leegTik(); schoon({ tap: { cx: 1, cy: 1 }, afst: 30 });
    try { _verwerkWorkerResultaatKern([]); } catch (e) {}          // wapent
    bboxOverride = null; laatsteNodeWisselTijd = Date.now();
    try { _verwerkWorkerResultaatKern([]); } catch (e) {}          // ziet hem weg
    laatsteAI = bewAi.laatsteAI; nieuwAIResultaat = bewAi.nieuwAIResultaat; debugWaarden.ai = bewAi.debugWaardenAi;
    eis('TL7b een gewone run meldt een tik die via een node-wissel verdween',
        regelsVan('los').map(r => r.reden).join(',') === 'node', 'node', regelsVan('los').map(r => r.reden).join(','));

  } finally {
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    canvas.width = cw; canvas.height = ch;
    if (lsTik === null) localStorage.removeItem(TIKLOG_SLEUTEL); else localStorage.setItem(TIKLOG_SLEUTEL, lsTik);
    tikLogArr = null;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
