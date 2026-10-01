// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tik_wint.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.33.0: de tik wint, of de app toont niets. Plus V11.34.0: de
//  tik klopt ook aan de rand (TW10).
//
//  YOUNES' TWEE EISEN (27 september 2026):
//   1. een tik weegt zwaarder dan de automatische keuze; wegspringen naar een
//      ander licht mag alleen als er bij het getikte licht niets te zien is;
//   2. is er niets te zien, dan géén box — niet overspringen — tot de volgende
//      tik. Zijn keuze voor dat moment: een klein zoekringetje, geen kleur,
//      geen fase, geen meting.
//
//  Het vaste beeld: 1080 x 1920, crop 0,6 om (540, 500), zoals test_tiklog.
//  A op camerapixel (590, 450), B op (500, 440). De identiteitsstraal is
//  80 x 1080 x 0,6 / 640 = 81 camerapixels; op volbeeld is dat 27 YOLO-px.
//
//  TW1  F1: de tik landt waar je vinger landde
//  TW2  F2: de tik-positie reist in camerapixels mee
//  TW3  F3: na een tik kiest de tik-tak nooit een ander licht
//  TW4  F4: een uitval, een verouderde fase of groen wissen de tik niet meer
//  TW5  F5: ook na TAP_KWIJT_MS zonder match geen vrije keuze
//  TW6  F6: de zwakke zone hangt aan de identiteitsstraal
//  TW7  het zoekringetje, en de indicator op de goede plek
//  TW8  leeg is echt leeg: geen fase, geen meting
//  TW9  REGRESSIE: zonder tik en in het auto-slot verandert niets
//  TW10 V11.34.0 (M6): de tik klopt ook aan de rand. Het canvas staat op
//       object-fit: cover, dus op het scherm valt links en rechts een strook
//       van het beeld weg. De tik rekent daar nu mee (schermNaarCamera).
//
//  DE TIK-HELPER (tikOp) tikt sinds V11.34.0 waar de lamp OP HET SCHERM staat,
//  met dezelfde cover-regel als de browser. Tot en met V11.33.0 rekende hij met
//  dezelfde uitgerekte formule als de app. Daardoor kon geen enkele toets de
//  randfout zien: de helper maakte de fout van de handler precies ongedaan.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tik_wint.js';
//      document.head.appendChild(s);
//      s.onload = () => testTikWint().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testTikWint() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const r1 = (x) => Math.round(x * 10) / 10;

  const VW = 1080, VH = 1920;
  const CROP = { x: 216, y: 176, w: 648, h: 648 };
  const S_CROP = 640 / 648;
  const S_VOL = 640 / 1920, PAD_VOL = (640 - Math.round(VW * S_VOL)) / 2;
  const ST_CROP = { s: S_CROP, px: 0, py: 0, x: CROP.x, y: CROP.y };
  const naarCrop = (x, y) => ({ cx: (x - CROP.x) * S_CROP, cy: (y - CROP.y) * S_CROP });
  const naarVol  = (x, y) => ({ cx: x * S_VOL + PAD_VOL, cy: y * S_VOL });
  const A = { x: 590, y: 450 }, B = { x: 500, y: 440 };
  const STRAAL_CAM = 80 * 1080 * 0.6 / 640;   // 81

  const det = (p, klasse = 0, score = 0.6, w = 14, h = 40) => {
    const alle = new Array(NC).fill(0.001); alle[klasse] = score;
    return { klasse, score, alleScores: alle, cx: p.cx, cy: p.cy, w, h,
             x1: p.cx - w / 2, y1: p.cy - h / 2, x2: p.cx + w / 2, y2: p.cy + h / 2 };
  };
  const zetCrop = () => { lbScale = S_CROP; lbPadX = 0; lbPadY = 0; cropRegio = { ...CROP }; };
  const zetVol  = () => { lbScale = S_VOL; lbPadX = PAD_VOL; lbPadY = 0; cropRegio = null; };

  const namen = ['bboxOverride', 'bboxOverrideTijd', 'bboxOverrideCamX', 'bboxOverrideCamY',
    'bboxOverrideMatchTeller', 'bboxOverrideLaatsteMatch', 'stickyDetectie', 'stickyMissTeller',
    'tapSeedDetectie', 'bboxSlot', 'vorigeDetectie', 'dichtstbijOSM', 'huidigePos', 'snelheidKmh',
    'bboxAnchorCx', 'bboxAnchorCy', 'bboxAnchorTijd', 'vergrendeldNodeId', 'voorkeursBboxCx',
    'voorkeursBboxCy', 'voorkeursBboxRuns', 'voorkeursBboxTijd', 'voorkeursBboxStart',
    'cropHintPositie', 'cropHintTeller', 'cropAlternatieTeller', 'lbScale', 'lbPadX', 'lbPadY',
    'cropRegio', 'laatsteDetecties', 'laatsteDetectiesStelsel', 'zoomVergrendeld',
    'cameraTapMarker', 'tikLogArr', 'tikLogStop', 'tikLogVorige', 'autoSlotUitdager',
    'tikLogLevend', 'yawRateDps', 'yawVorigeT', 'laatsteAI', 'nieuwAIResultaat', 'fase', 'aiTeller'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
  const cw = canvas.width, ch = canvas.height;
  const lsTik = localStorage.getItem(TIKLOG_SLEUTEL);
  const vidW = Object.getOwnPropertyDescriptor(video, 'videoWidth');
  const vidH = Object.getOwnPropertyDescriptor(video, 'videoHeight');
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
    dichtstbijOSM = opt.afst != null ? { id: 860551, afstand: opt.afst, lat: 52.0, lon: 4.7 } : null;
    huidigePos = { lat: 52.0, lon: 4.7 }; snelheidKmh = 0;
    voorkeursBboxCx = null; voorkeursBboxCy = null;
    voorkeursBboxRuns = 0; voorkeursBboxTijd = 0; voorkeursBboxStart = 0;
    cropHintPositie = null; cropHintTeller = 0; bboxSlot = 'vrij';
    yawRateDps = 0; yawVorigeT = 0;
  };
  // Een levende tik met sticky op camerapositie p, in het huidige stelsel.
  const tikMetSticky = (p) => {
    bboxOverrideCamX = p.x; bboxOverrideCamY = p.y;
    const q = tikNaarYolo(p.x, p.y);
    bboxOverride = { cx: q.cx, cy: q.cy };
    bboxOverrideTijd = Date.now(); bboxOverrideLaatsteMatch = Date.now();
    stickyDetectie = { cx: q.cx, cy: q.cy, camX: p.x, camY: p.y, camH: 40 / lbScale, camAfst: null,
                       familie: 'rood', hoogte: 40, klasse: 0, tijd: Date.now(), bron: 'tik' };
  };
  // Waar staat camerapunt p op het scherm? Dezelfde regel als object-fit: cover
  // (één schaal, de grootste, gecentreerd), hier los van de app uitgeschreven.
  const opScherm = (p) => {
    const cssW = canvas.offsetWidth, cssH = canvas.offsetHeight;
    const s = Math.max(cssW / canvas.width, cssH / canvas.height);
    return { x: (cssW - canvas.width * s) / 2 + p.x * s, y: (cssH - canvas.height * s) / 2 + p.y * s };
  };
  const tikOp = (p) => {
    const r = canvas.getBoundingClientRect(), q = opScherm(p);
    const kx = r.width / canvas.offsetWidth, ky = r.height / canvas.offsetHeight;   // de zoom
    // Hele schermpixels, zoals een echte klik: Chromium kapt clientX en clientY
    // van een MouseEvent af op gehele getallen.
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX: Math.round(r.left + q.x * kx), clientY: Math.round(r.top + q.y * ky), bubbles: true }));
  };
  const dicht = (a, b, tol = 2) => Math.abs(a - b) <= tol;

  try {
    canvas.width = VW; canvas.height = VH;
    metBeeld();
    if (!eis('TW0 vooraf: nep-beeld 1080x1920 en een zichtbaar canvas',
             video.videoWidth === VW && canvas.offsetWidth > 0, '1080 + zichtbaar', video.videoWidth + ' / ' + canvas.offsetWidth)) {
      const g = regels.filter(r => r.uitslag === 'GEFAALD').length;
      return { geslaagd: regels.length - g, gefaald: g, regels };
    }
    eis('TW0b de identiteitsstraal: 81 camerapixels, in crop 80 YOLO-px, op volbeeld 27',
        dicht(tikStraalCam(), STRAAL_CAM, 0.01) && (zetCrop(), dicht(tikStraalYolo(), 80, 0.01))
          && (zetVol(), dicht(tikStraalYolo(), 27, 0.01)),
        '81 / 80 / 27', r1(tikStraalCam()) + ' / ' + (zetCrop(), r1(tikStraalYolo())) + ' / ' + (zetVol(), r1(tikStraalYolo())));

    // ═══ TW1 — F1: DE TIK LANDT WAAR JE VINGER LANDDE ═══════
    // a. A niet gedetecteerd, B wel, 91 camerapixels verderop: geen snap naar B.
    schoon(); leegTik(); zetCrop();
    laatsteDetecties = [det(naarCrop(B.x, B.y))]; laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    eis('TW1a een tik op A (niet gedetecteerd) vergrendelt op de tikplek, niet op buur B',
        !!bboxOverride && dicht(bboxOverrideCamX, A.x) && dicht(bboxOverrideCamY, A.y) && stickyDetectie === null,
        'lock op (590, 450), nog geen sticky',
        bboxOverride ? r1(bboxOverrideCamX) + ', ' + r1(bboxOverrideCamY) + ' sticky=' + !!stickyDetectie : 'geen lock');
    let r = selecteerBesteDetectie([det(naarCrop(B.x, B.y))]);
    eis('TW1b ... en de volgende run neemt B niet: niets tonen, verder zoeken',
        r.s1 === null && r.afwijsReden === 'tik_zoekt', 'null + tik_zoekt', (r.s1 ? 'box' : 'null') + ' + ' + r.afwijsReden);
    r = selecteerBesteDetectie([det(naarCrop(B.x, B.y)), det(naarCrop(A.x + 8, A.y + 5), 0, 0.3)]);
    eis('TW1c zodra A verschijnt, is het A — en dat wordt zijn identiteit',
        !!r.s1 && dicht(r.s1.cx, naarCrop(A.x + 8, A.y + 5).cx) && stickyDetectie && stickyDetectie.bron === 'tik',
        'A + sticky bron tik', (r.s1 ? r1(r.s1.cx) : 'geen') + ' + ' + (stickyDetectie && stickyDetectie.bron));
    // b. de coördinatenval: detecties uit een crop-run, lopende run volbeeld
    schoon(); leegTik(); zetVol();
    laatsteDetecties = [det(naarCrop(A.x, A.y)), det(naarCrop(B.x, B.y))]; laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    eis('TW1d een tik precies op A landt op A, ook als crop en volbeeld door elkaar lopen',
        !!stickyDetectie && dicht(stickyDetectie.camX, A.x) && dicht(stickyDetectie.camY, A.y) && stickyDetectie.bron === 'tik',
        'sticky op A (590, 450)', stickyDetectie ? r1(stickyDetectie.camX) + ', ' + r1(stickyDetectie.camY) : 'geen');
    r = selecteerBesteDetectie([det(naarVol(A.x, A.y)), det(naarVol(B.x, B.y))]);
    eis('TW1e ... en de volgende volbeeldrun kiest A', !!r.s1 && dicht(r.s1.cx, naarVol(A.x, A.y).cx, 0.5),
        'A ' + r1(naarVol(A.x, A.y).cx), r.s1 ? r1(r.s1.cx) : 'geen');
    let tk = tiklog().filter(x => x.s === 'tik').pop();
    eis('TW1f de tik-regel: gesnapt, rand 0, geen verkeerde keuze, ander stelsel gezien',
        tk && tk.snap === 1 && tk.rand === 0 && tk.mis === 0 && tk.st === 1,
        'snap 1 / rand 0 / mis 0 / st 1', tk && `snap ${tk.snap} / rand ${tk.rand} / mis ${tk.mis} / st ${tk.st}`);
    // c. wie op B tikt, krijgt B
    schoon(); leegTik(); zetCrop();
    laatsteDetecties = [det(naarCrop(A.x, A.y)), det(naarCrop(B.x, B.y))]; laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp({ x: B.x + 3, y: B.y + 10 });
    eis('TW1g een tik op de box van B kiest B: de tik van de gebruiker is de wet',
        !!stickyDetectie && dicht(stickyDetectie.camX, B.x), 'sticky op B (500)', stickyDetectie ? r1(stickyDetectie.camX) : 'geen');
    // d. vlak naast een box: binnen de halve straal telt, erbuiten niet
    schoon(); zetCrop();
    laatsteDetecties = [det(naarCrop(A.x, A.y))]; laatsteDetectiesStelsel = { ...ST_CROP };
    const halfBreed = 7 / S_CROP;   // halve boxbreedte in camerapixels
    tikOp({ x: A.x + halfBreed + STRAAL_CAM / 2 - 3, y: A.y });
    const binnen = !!stickyDetectie;
    schoon(); zetCrop();
    laatsteDetecties = [det(naarCrop(A.x, A.y))]; laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp({ x: A.x + halfBreed + STRAAL_CAM / 2 + 3, y: A.y });
    const buiten = !!stickyDetectie;
    eis('TW1h naast de box: tot een halve identiteitsstraal (~40 camerapixels) is het die lamp, verder niet',
        binnen === true && buiten === false, 'binnen ja, buiten nee', `binnen ${binnen}, buiten ${buiten}`);
    // e. geen enkele detectie
    schoon(); zetCrop(); laatsteDetecties = []; laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    eis('TW1i zonder detecties: lock op de plek, crop-hint erop',
        !!bboxOverride && dicht(bboxOverrideCamX, A.x) && !!cropHintPositie && dicht(cropHintPositie.x, A.x),
        'lock + crop-hint op A', bboxOverride ? 'lock, hint ' + (cropHintPositie ? r1(cropHintPositie.x) : '-') : 'geen');
    eis('TW1j de seed bestaat niet meer: de handler zet hem op null', tapSeedDetectie === null, 'null', JSON.stringify(tapSeedDetectie));

    // ═══ TW2 — F2: DE TIK REIST IN CAMERAPIXELS ═════════════
    schoon(); zetCrop(); laatsteDetecties = []; laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    const inCrop = { ...bboxOverride };
    zetVol();
    const p2 = tikPositieYolo();
    eis('TW2a in een volbeeldrun staat de tik op zijn volbeeld-plek, niet op de oude crop-coördinaten',
        dicht(p2.cx, naarVol(A.x, A.y).cx, 0.5) && dicht(p2.cy, naarVol(A.x, A.y).cy, 0.5) && !dicht(p2.cx, inCrop.cx, 5),
        r1(naarVol(A.x, A.y).cx) + ', ' + r1(naarVol(A.x, A.y).cy), r1(p2.cx) + ', ' + r1(p2.cy) + ' (crop was ' + r1(inCrop.cx) + ')');
    // De sticky draagt nog de YOLO-coördinaten van een crop-run; de lopende run
    // is volbeeld. De zwakke zone moet op de volbeeld-plek liggen.
    schoon(); zetCrop(); tikMetSticky(A); zetVol();
    const z2 = tapZwakPositie();
    eis('TW2b de zwakke zone volgt de sticky, geprojecteerd in DEZE run (niet zijn oude crop-cx)',
        dicht(z2.cx, naarVol(A.x, A.y).cx, 0.5) && !dicht(z2.cx, naarCrop(A.x, A.y).cx, 5),
        r1(naarVol(A.x, A.y).cx) + ' (crop was ' + r1(naarCrop(A.x, A.y).cx) + ')', r1(z2.cx));

    // ═══ TW3 — F3: NOOIT EEN ANDER LICHT ════════════════════
    // a. onder 15 m, A mist, B op 310 camerapixels: geen overname meer
    schoon({ afst: 10 }); leegTik(); zetVol(); tikMetSticky(A);
    r = selecteerBesteDetectie([det(naarVol(900, 450))]);
    eis('TW3a onder 15 m: A mist, B op 310 camerapixels — niets tonen, geen overname',
        r.s1 === null && r.afwijsReden === 'tik_leeg' && dicht(stickyDetectie.camX, A.x),
        'null + tik_leeg, sticky blijft op A', (r.s1 ? 'box' : 'null') + ' + ' + r.afwijsReden + ', sticky ' + r1(stickyDetectie.camX));
    // b. op volbeeld: 200 camerapixels is geen match meer (was 67 < 80 YOLO-px)
    schoon({ afst: 40 }); zetVol(); tikMetSticky(A);
    r = selecteerBesteDetectie([det(naarVol(A.x + 200, A.y))]);
    eis('TW3b op volbeeld is 200 camerapixels naast A geen match meer', r.s1 === null && r.afwijsReden === 'tik_leeg',
        'null + tik_leeg', (r.s1 ? 'box' : 'null') + ' + ' + r.afwijsReden);
    // c. maar gewoon trillen wel
    schoon({ afst: 40 }); zetVol(); tikMetSticky(A);
    r = selecteerBesteDetectie([det(naarVol(A.x + 20, A.y - 10))]);
    eis('TW3c 22 camerapixels trillen blijft A', !!r.s1 && r.afwijsReden === 'ok' && bboxSlot === 'tap',
        'match + tap', (r.s1 ? 'match' : 'geen') + ' + ' + r.afwijsReden + ' + ' + bboxSlot);
    // d. in een crop verandert de straal niet
    zetCrop();
    const cropStraal = tikStraalYolo();
    lbScale = 640 / (1080 * 0.4);   // crop 0,4 (boven 70 m)
    const crop4 = tikStraalYolo();
    eis('TW3d in een crop van 0,6 en van 0,4 blijft de straal 80 YOLO-px, zoals voor V11.33.0',
        dicht(cropStraal, 80, 0.01) && dicht(crop4, 80, 0.01), '80 / 80', r1(cropStraal) + ' / ' + r1(crop4));
    // e. vijf missers met draaien: de sticky loopt niet weg
    schoon({ afst: 40 }); zetVol(); tikMetSticky(A);
    yawRateDps = 12; yawVorigeT = Date.now();
    stickyDetectie.tijd = Date.now() - 1500;
    for (let i = 0; i < 5; i++) selecteerBesteDetectie([det(naarVol(900, 450))]);
    eis('TW3e vijf missers tijdens het draaien: de sticky blijft op zijn laatste plek (geen optelsom)',
        dicht(stickyDetectie.camX, A.x, 0.01) && dicht(stickyDetectie.camY, A.y, 0.01),
        '590, 450', r1(stickyDetectie.camX) + ', ' + r1(stickyDetectie.camY));
    yawRateDps = 0; yawVorigeT = 0;
    // f. na lang niets komt A terug: dan is het weer A
    r = selecteerBesteDetectie([det(naarVol(900, 450)), det(naarVol(A.x + 5, A.y))]);
    eis('TW3f na de missers komt A terug, en de app pakt A', !!r.s1 && dicht(r.s1.cx, naarVol(A.x + 5, A.y).cx, 0.5),
        'A', r.s1 ? r1(r.s1.cx) : 'geen');
    eis('TW3g de overname-routes en hun constanten bestaan niet meer',
        typeof STICKY_DICHTBIJ_M === 'undefined' && typeof STICKY_STERK_M === 'undefined'
          && !/sticky_overname|radius_cap/.test(zc(selecteerBesteDetectie)),
        'weg', typeof STICKY_DICHTBIJ_M + ' / ' + typeof STICKY_STERK_M);

    // ═══ TW4 — F4: UITVAL, VEROUDERING EN GROEN ═════════════
    for (const reden of ['dropout', 'stale']) {
      schoon({ afst: 12 }); leegTik(); zetVol(); tikMetSticky(A);
      resetNeutraal(reden);
      const rn = tiklog().filter(x => x.s === 'run').pop();
      eis('TW4 resetNeutraal(' + reden + ') laat de tik en zijn sticky staan, en logt dat',
          bboxOverride !== null && stickyDetectie && stickyDetectie.bron === 'tik'
            && tiklog().every(x => x.s !== 'los') && rn && rn.tak === 'reset_' + reden,
          'tik + sticky staan, run reset_' + reden,
          'override=' + (bboxOverride !== null) + ', sticky=' + !!stickyDetectie + ', ' + JSON.stringify(rn));
    }
    schoon({ afst: 12 }); leegTik(); zetVol(); tikMetSticky(A);
    resetNeutraal('startscherm');
    eis('TW4c het startscherm wist de tik wel, met een los-regel',
        bboxOverride === null && stickyDetectie === null && tiklog().some(x => x.s === 'los' && x.reden === 'reset_startscherm'),
        'weg + los', 'override=' + JSON.stringify(bboxOverride));
    schoon(); zetVol(); tikMetSticky(A);
    resetNeutraal();
    eis('TW4d een reset zonder reden wist de tik ook (alleen uitval en veroudering houden hem)',
        bboxOverride === null, 'weg', JSON.stringify(bboxOverride));
    schoon(); zetVol();
    stickyDetectie = { cx: 1, cy: 1, familie: 'rood', hoogte: 40, klasse: 0, tijd: Date.now(), bron: 'auto' };
    resetNeutraal('dropout');
    eis('TW4e zonder tik wist een uitval het auto-slot zoals voorheen', stickyDetectie === null, 'null', JSON.stringify(stickyDetectie));
    const groen = zc(verwerkFase);
    eis('TW4f groen wist de sticky alleen zonder tik',
        /if \(bboxOverride === null\) \{ stickyDetectie = null; stickyMissTeller = 0; \}/.test(groen)
          && !/\n\s*stickyDetectie = null; stickyMissTeller = 0;/.test(groen.slice(groen.indexOf("if (nieuw === 'groen')"), groen.indexOf("if (nieuw === 'groen')") + 3000)),
        'voorwaardelijk', 'ok');
    eis('TW4g node-wissel, correctie en GPS-voorbij wissen de tik nog steeds',
        /bboxOverride = null/.test(zc(updateDichtbij)) && /bboxOverride = null/.test(zc(corrigeerNodeAutomatisch))
          && /tikLogLos\('voorbij'\);\s*bboxOverride = null/.test(zc(onGPS)),
        'alle drie', 'ok');

    // ═══ TW5 — F5: GEEN KLOK ═══════════════════════════════
    schoon({ afst: 20 }); zetVol(); tikMetSticky(A);
    bboxOverrideTijd = Date.now() - 600000; bboxOverrideLaatsteMatch = Date.now() - 600000;
    eis('TW5a tien minuten niets gezien: de tik leeft', tapLockLeeft() === true, 'true', String(tapLockLeeft()));
    r = selecteerBesteDetectie([det({ cx: 320, cy: 200 }, 0, 0.95, 20, 60)]);   // sterk, midden in beeld
    eis('TW5b ... en een sterke lamp midden in beeld wordt niet gekozen — de scorelus draait niet eens',
        r.s1 === null && bboxOverride !== null && voorkeursBboxCx === null && autoSlotActief() === false,
        'null, tik staat, geen voorkeur, geen auto-slot',
        (r.s1 ? 'box' : 'null') + ', voorkeur ' + voorkeursBboxCx + ', auto ' + autoSlotActief());
    eis('TW5c tapLockLeeft kent geen klok meer', !/TAP_KWIJT_MS|Date\.now/.test(zc(tapLockLeeft)), 'geen klok', zc(tapLockLeeft).replace(/\s+/g, ' '));

    // ═══ TW6 — F6: DE ZWAKKE ZONE ══════════════════════════
    const tensor = (ankers) => {
      const n = ankers.length, t = new Float32Array((4 + NC) * n);
      ankers.forEach((a, i) => { t[i] = a.cx; t[n + i] = a.cy; t[2 * n + i] = a.w; t[3 * n + i] = a.h; t[(4 + (a.klasse || 0)) * n + i] = a.score; });
      return { data: t, dims: [1, 4 + NC, n] };
    };
    const door = (ankers) => { const { data, dims } = tensor(ankers); return postprocessYOLO(data, dims).map(d => r1(d.cx)); };
    schoon({ afst: 20 }); zetVol(); tikMetSticky(A);
    const zA = naarVol(A.x + 15, A.y), zB = naarVol(A.x + 200, A.y);
    const uit6 = door([{ cx: zA.cx, cy: zA.cy, w: 6, h: 14, score: 0.05 }, { cx: zB.cx, cy: zB.cy, w: 6, h: 14, score: 0.05 }]);
    eis('TW6a een zwakke 5% op A (15 camerapixels) komt door, een zwakke 5% op 200 camerapixels niet',
        uit6.length === 1 && dicht(uit6[0], r1(zA.cx), 0.2), '1: ' + r1(zA.cx), JSON.stringify(uit6));
    eis('TW6b de oude straal van 100 YOLO-px bestaat niet meer', typeof TAP_ZWAK_STRAAL_PX === 'undefined',
        'undefined', typeof TAP_ZWAK_STRAAL_PX);

    // ═══ TW7 — HET ZOEKRINGETJE ════════════════════════════
    const bogen = [], strepen = [];
    const oArc = octx.arc, oStroke = octx.stroke;
    try {
      octx.arc = function (x, y, rr, a0, a1) { bogen.push({ x, y, rr }); return oArc.call(this, x, y, rr, a0, a1); };
      octx.stroke = function () { strepen.push(String(this.strokeStyle)); return oStroke.call(this); };
      schoon({ afst: 20 }); zetVol(); tikMetSticky(A); aiTeller = 0;
      bogen.length = 0; strepen.length = 0;
      tekenOverlay(null);
      const ring = bogen.find(b => dicht(b.x, A.x, 0.5) && dicht(b.y, A.y, 0.5));
      eis('TW7a zonder box: een ringetje precies op jouw lamp, klein (2% van de beeldbreedte)',
          !!ring && dicht(ring.rr, VW * TIK_ZOEKRING_FRACTIE, 0.5), 'r ' + VW * TIK_ZOEKRING_FRACTIE + ' op (590, 450)',
          ring ? 'r ' + r1(ring.rr) : JSON.stringify(bogen.slice(0, 3)));
      eis('TW7b wit, geen fasekleur, en geen amberen TAP-indicator',
          strepen.some(s => /rgba\(255, ?255, ?255/.test(s)) && !strepen.some(s => /251, ?191, ?36/.test(s))
            && !strepen.some(s => /#FF3030|#34C759|#FF9F0A/i.test(s)),
          'wit, geen amber, geen rood/groen/oranje', strepen.join(' | '));
      bboxOverrideLaatsteMatch = Date.now() - (TAP_KWIJT_MS + 1000); bboxOverrideTijd = bboxOverrideLaatsteMatch;
      strepen.length = 0; tekenOverlay(null);
      eis('TW7c na TAP_KWIJT_MS zonder match wordt het ringetje vager', strepen.some(s => /255, ?255, ?255, ?0\.4\)/.test(s)),
          'alpha 0,40', strepen.join(' | '));
      // met een box: geen ringetje, en de indicator staat op de camerapositie —
      // ook als bboxOverride nog in het crop-stelsel van het tikmoment staat
      schoon({ afst: 20 }); zetCrop(); tikMetSticky(A); zetVol(); aiTeller = 0;
      bogen.length = 0; strepen.length = 0;
      tekenOverlay({ x: A.x - 10, y: A.y - 20, w: 20, h: 40, kleur: 'rood', klasse: 0 }, 0.6, false);
      eis('TW7d met een box: geen wit ringetje, de amberen indicator staat op jouw lamp',
          !strepen.some(s => /rgba\(255, ?255, ?255/.test(s)) && bogen.some(b => dicht(b.x, A.x, 0.5) && dicht(b.y, A.y, 0.5) && b.rr === 28),
          'amber op (590, 450)', JSON.stringify(bogen.map(b => [r1(b.x), r1(b.y), b.rr])));
      schoon(); bogen.length = 0; strepen.length = 0;
      tekenOverlay(null);
      eis('TW7e zonder tik ook geen ringetje', !strepen.some(s => /rgba\(255, ?255, ?255/.test(s)), 'geen', strepen.join(' | '));
    } finally { octx.arc = oArc; octx.stroke = oStroke; }

    // ═══ TW8 — LEEG IS LEEG ════════════════════════════════
    schoon({ afst: 12 }); zetVol(); tikMetSticky(A);
    fase = null; laatsteAI = { kleur: 'rood' }; nieuwAIResultaat = false;
    try { _verwerkWorkerResultaatKern([det(naarVol(900, 450), 1, 0.9)]); } catch (e) {}
    eis('TW8 A weg, een groene buur in beeld: geen laatsteAI, dus geen fase en geen meting',
        laatsteAI === null && fase === null && nieuwAIResultaat === true, 'laatsteAI null, fase null',
        'laatsteAI=' + JSON.stringify(laatsteAI) + ', fase=' + fase);

    // ═══ TW9 — REGRESSIE ═══════════════════════════════════
    schoon({ afst: 40 }); zetVol();
    r = selecteerBesteDetectie([det({ cx: 320, cy: 200 }, 0, 0.8), det({ cx: 560, cy: 210 }, 0, 0.8)]);
    eis('TW9a zonder tik kiest de scorelus zoals altijd: de middelste lamp, slot vrij',
        !!r.s1 && r.s1.cx === 320 && bboxSlot === 'vrij', '320 + vrij', (r.s1 ? r.s1.cx : 'geen') + ' + ' + bboxSlot);
    const ss = String(stickySlotMatch)
      .replace('function stickySlotMatch(bruikbaar, straal = STICKY_MATCH_PX) {   // V11.33.0: de tik-tak geeft tikStraalYolo()', 'function stickySlotMatch(bruikbaar) {')
      .replace('if (afst < straal) {', 'if (afst < STICKY_MATCH_PX) {');
    eis('TW9b stickySlotMatch zonder straal-argument is byte-gelijk aan V11.32.0 — het auto-slot verandert niet',
        fnv(ss) === 'da7996b1' && ss.length === 2016, 'da7996b1 / 2016', fnv(ss) + ' / ' + ss.length);
    const autoAanroep = zc(selecteerBesteDetectie).match(/if \(autoSlotActief\(\)\)[\s\S]{0,200}stickySlotMatch\(([^)]*)\)/);
    eis('TW9c het auto-slot roept stickySlotMatch aan zonder straal', !!autoAanroep && autoAanroep[1].trim() === 'bruikbaar',
        'bruikbaar', autoAanroep ? autoAanroep[1] : 'niet gevonden');
    const ONGEWIJZIGD = {   // V11.32.0 (fase_d), volledige tekst
      _verwerkWorkerResultaatKern: ['23a782f3', 6144], verwerkDetecties: ['caa90b0a', 8724],
      naarStartscherm: ['6fcbf8b7', 415], updateDichtbij: ['e82d3c0', 11914],
      corrigeerNodeAutomatisch: ['afe7b427', 4118], onGPS: ['58346b1c', 14246], lus: ['251a0dd1', 3167],
      exporteerMeetdata: ['ef1e19bb', 7864], stickyVoorspel: ['f5cc4e22', 1864], stickyNeemOver: ['c06db2ce', 386],
      autoSlotZet: ['4e12277f', 313], preprocessVoorYOLO: ['f379eecc', 2733], runIsKansloos: ['d631b73b', 1660],
      tikLogNoteer: ['d9f96f8', 1154], tikLogWaak: ['25490478', 714]
    };
    // V11.34.2: exporteerMeetdata kreeg drie meetbakken erbij (camcap, model,
    // minuut). Meetregels vanaf V11.34.2 dragen hun versie als merkteken op de
    // regel zelf; zonder die regels moet de functie nog steeds byte-gelijk zijn.
    // V11.36.1: ook de Safari-meetregels in exporteerMeetdata (merkteken V11.36.1), en
    // V11.36.2: de budgetregel in tikLogNoteer (merkteken V11.36.2).
    const zonderMeet = (s) => s.split('\n').filter(l => !/V11\.34\.[2-9]|V11\.36\.[12]/.test(l)).join('\n');
    const anders = Object.entries(ONGEWIJZIGD).filter(([n, [h, l]]) => fnv(zonderMeet(String(eval(n)))) !== h || zonderMeet(String(eval(n))).length !== l).map(x => x[0]);
    eis('TW9d vijftien functies die V11.33.0 niet raakt, zijn byte-gelijk aan V11.32.0 (NB14 inbegrepen)',
        anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');

    // ═══ TW10 — V11.34.0: DE TIK KLOPT OOK AAN DE RAND ═════
    // Een vaste schermmaat, zodat het runnervenster niet uitmaakt: 393x852
    // CSS-px, het scherm van de iPhone 15 Pro. Dat is dezelfde geometrie als de
    // proefpagina van 27 september: daar stond een lamp op camera-x 300 op de
    // schermafdruk op CSS-x 90,0. De oude omrekening maakte daar 247,3 van.
    const oudeStijl = canvas.getAttribute('style');
    const zetScherm = (w, h) => { canvas.style.width = w + 'px'; canvas.style.height = h + 'px'; };
    const heeftFn = typeof schermNaarCamera === 'function';
    const naarCam = (x, y) => heeftFn ? schermNaarCamera(x, y) : { x: NaN, y: NaN };
    const txt = (c) => c ? r1(c.x) + ', ' + r1(c.y) : 'null';
    try {
      canvas.style.transform = ''; canvas.style.objectFit = '';
      canvas.width = VW; canvas.height = VH; zetScherm(393, 852);
      const cs = getComputedStyle(canvas), co = getComputedStyle(overlCanvas);
      eis('TW10a beide canvassen staan op object-fit: cover, gecentreerd: de aanname van schermNaarCamera',
          cs.objectFit === 'cover' && cs.objectPosition === '50% 50%' && co.objectFit === 'cover' && co.objectPosition === '50% 50%',
          'cover / 50% 50% (twee keer)', cs.objectFit + ' / ' + cs.objectPosition + ' | ' + co.objectFit + ' / ' + co.objectPosition);
      eis('TW10a2 schermNaarCamera bestaat', heeftFn, 'functie', typeof schermNaarCamera);
      let c = naarCam(90, 426);
      eis('TW10b de gemeten lamp: CSS-x 90,0 is camera-x 300 (de oude omrekening gaf 247,3)',
          dicht(c.x, 300, 0.01) && dicht(c.y, 960, 0.01), '300, 960', txt(c));
      const links = naarCam(0, 0), rechts = naarCam(393, 852), mid = naarCam(196.5, 426);
      eis('TW10c midden blijft midden; links en rechts valt 97,2 camerapixels weg (9,0%), boven en onder niets',
          dicht(mid.x, 540, 0.01) && dicht(mid.y, 960, 0.01) && dicht(links.x, 97.18, 0.01) && dicht(rechts.x, 982.82, 0.01)
            && dicht(links.y, 0, 0.01) && dicht(rechts.y, 1920, 0.01),
          '540, 960 / 97,2, 0 / 982,8, 1920', txt(mid) + ' / ' + txt(links) + ' / ' + txt(rechts));
      // het echte beeld van het toestel (detlog 26 sept), op beide kandidaat-viewports
      canvas.width = 2160; canvas.height = 3840;
      zetScherm(393, 793); const s793 = naarCam(0, 0);
      zetScherm(393, 852); const s852 = naarCam(0, 0);
      eis('TW10d het echte beeld 2160x3840: per kant valt 128,5 px weg op 393x793 en 194,4 px op 393x852',
          dicht(s793.x, 128.47, 0.05) && dicht(s852.x, 194.37, 0.05), '128,5 / 194,4', r1(s793.x) + ' / ' + r1(s852.x));
      // liggend: dan valt er boven en onder een strook weg
      canvas.width = 1920; canvas.height = 1080; zetScherm(852, 393);
      c = naarCam(426, 90);
      eis('TW10e liggend (1920x1080 op 852x393): de verticale as wordt gecorrigeerd, de horizontale niet',
          dicht(c.x, 960, 0.01) && dicht(c.y, 300, 0.01), '960, 300', txt(c));
      canvas.width = VW; canvas.height = VH; zetScherm(393, 852);
      // de andere object-fit-waarden: de functie volgt de CSS
      canvas.style.objectFit = 'fill';
      const fill = naarCam(90, 100);   // niet het midden: daar geven alle regels hetzelfde
      canvas.style.objectFit = 'contain';
      const cont = naarCam(196.5, 100), balk = naarCam(0, 0);
      canvas.style.objectFit = '';
      eis('TW10f fill rekent per as (de oude formule, daar was hij goed); contain gebruikt de kleinste schaal, en een tik in de balk klemt op de rand',
          dicht(fill.x, 247.33, 0.01) && dicht(fill.y, 225.35, 0.01)
            && dicht(cont.x, 540, 0.01) && dicht(cont.y, 64.12, 0.01) && dicht(balk.x, 0, 0.01) && dicht(balk.y, 0, 0.01),
          'fill 247,3, 225,4 / contain 540, 64,1 / balk 0, 0', txt(fill) + ' / ' + txt(cont) + ' / ' + txt(balk));

      // de echte handler, met zoom: de lamp op camera-x 300 staat bij scale(1,5)
      // op scherm-x 196,5 + (90 - 196,5) x 1,5 = 36,75. Een klik valt op een heel
      // schermpixel (37); wat daar hoort, rekent deze toets los van de app uit.
      schoon(); leegTik(); zetCrop(); laatsteDetecties = []; laatsteDetectiesStelsel = { ...ST_CROP };
      canvas.style.transform = 'scale(1.5)'; canvas.style.transformOrigin = 'center center';
      const rz = canvas.getBoundingClientRect();
      const kx10 = Math.round(rz.left + 90 * 1.5), ky10 = Math.round(rz.top + 426 * 1.5);
      const verwX = ((kx10 - rz.left) / 1.5 + 43.125) / 0.44375, verwY = ((ky10 - rz.top) / 1.5) / 0.44375;
      canvas.dispatchEvent(new MouseEvent('click', { clientX: kx10, clientY: ky10, bubbles: true }));
      canvas.style.transform = '';
      eis('TW10g de handler met zoom 1,5: een tik op de lamp bij de rand vergrendelt op camera-x ~300',
          !!bboxOverride && dicht(bboxOverrideCamX, verwX, 0.05) && dicht(bboxOverrideCamY, verwY, 0.05) && dicht(verwX, 300, 1),
          r1(verwX) + ', ' + r1(verwY), bboxOverride ? r1(bboxOverrideCamX) + ', ' + r1(bboxOverrideCamY) : 'geen lock');

      // de klacht zelf: A op driekwart van de beeldbreedte, buur B 95 camerapixels
      // verder naar de rand (buiten de identiteitsstraal van 81, dus alleen M6
      // speelt). Tot en met V11.33.0 kwam de tik op 869 uit: B's box lag dan
      // dichterbij (rand 15) dan die van A (rand 38), en F1 koos B.
      const A3 = { x: 810, y: 450 }, B3 = { x: 905, y: 450 };
      schoon(); leegTik(); zetVol();
      laatsteDetecties = [det(naarVol(A3.x, A3.y)), det(naarVol(B3.x, B3.y), 1, 0.8)];
      laatsteDetectiesStelsel = { s: S_VOL, px: PAD_VOL, py: 0, x: 0, y: 0 };
      tikOp(A3);
      eis('TW10h een tik op lamp A bij de rand kiest A, niet de buur aan de randkant',
          !!stickyDetectie && stickyDetectie.bron === 'tik' && dicht(stickyDetectie.camX, A3.x, 1),
          'sticky op A (810)', stickyDetectie ? r1(stickyDetectie.camX) + ' (' + stickyDetectie.bron + ')' : 'geen sticky');
      r = selecteerBesteDetectie([det(naarVol(A3.x, A3.y)), det(naarVol(B3.x, B3.y), 1, 0.8)]);
      eis('TW10i ... en de volgende run toont A', !!r.s1 && dicht(r.s1.cx, naarVol(A3.x, A3.y).cx, 0.5),
          'A ' + r1(naarVol(A3.x, A3.y).cx), r.s1 ? r1(r.s1.cx) : 'geen');

      // een canvas zonder maat (verborgen): niets vergrendelen, geen NaN
      schoon(); zetCrop(); laatsteDetecties = [];
      const markerVoor = cameraTapMarker;
      canvas.style.display = 'none';
      canvas.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true }));
      canvas.style.display = '';
      eis('TW10j een tik op een canvas zonder schermmaat doet niets (geen lock op NaN)',
          bboxOverride === null && cameraTapMarker === markerVoor, 'geen lock',
          'override=' + JSON.stringify(bboxOverride));

      const src = await fetch('/index.html?' + Date.now()).then(x => x.text()).catch(() => '');
      const i10 = src.indexOf("canvas.addEventListener('click', (e) => {");
      const handler = i10 >= 0 ? src.slice(i10, src.indexOf('\n});', i10) + 4) : '';
      eis('TW10k de handler rekent via schermNaarCamera, niet meer uitgerekt (normX * canvas.width)',
          /schermNaarCamera\(tapCssX, tapCssY\)/.test(zc(handler)) && !/normX \* canvas\.width/.test(zc(handler)),
          'via schermNaarCamera', handler ? 'gelezen' : 'niet gelezen');
    } finally {
      if (oudeStijl === null) canvas.removeAttribute('style'); else canvas.setAttribute('style', oudeStijl);
    }

  } finally {
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    zonderBeeld();
    if (vidW) Object.defineProperty(video, 'videoWidth', vidW);
    if (vidH) Object.defineProperty(video, 'videoHeight', vidH);
    canvas.width = cw; canvas.height = ch;
    if (lsTik === null) localStorage.removeItem(TIKLOG_SLEUTEL); else localStorage.setItem(TIKLOG_SLEUTEL, lsTik);
    tikLogArr = null;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
