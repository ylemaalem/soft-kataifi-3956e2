// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tiklog.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.32.0: de tik laat een spoor na. Een meetlaag, geen
//  gedragswijziging.
//
//  DE KLACHT. Tik op A en de box springt naar buurlicht B. Tik op B en hij
//  springt terug naar A. In de STAP 0 van 27 september zijn vijf mechanismen
//  gevonden, en uit de exports was niet te zien welk het was: nergens stond
//  waar de box stond.
//
//  TL0  KERN: het HUIDIGE gedrag vastgelegd, vóór de reparatie. Deze toetsen
//       slaan in V11.33.0 bewust om. Ze bewijzen dat de mechanismen echt zijn.
//       a  M1  tik op een lamp die het model niet ziet: de handler pakt de buur
//       b  M2  crop en volbeeld door elkaar: een tik precies op A landt op B
//       c  M3  onder 15 m pakt de overname na één misser de buur, zonder straal
//       d  M4  resetNeutraal wist de tik bij een uitval
//       e  M5  groen wist de tik-sticky (op de bron: verwerkFase speelt geluid)
//       f  M5  daarna wint wat het dichtst bij de oude YOLO-positie ligt
//       g  M3  op volbeeld is de sticky-straal drie keer zo ruim
//  TL1  de tik-regel: pad, keuze, echte afstand, verkeerde keuze, stelsel
//  TL2  de run-regels: overname, sprong, eerste match, dubbel onderdrukt
//  TL3  de los-regels: elke reden, en niets als er geen tik was. De node-wissel
//       en de correctie meldt een wachter, want die twee functies pint NB14.
//  TL4  de ring, en een vol quotum staakt het log zonder de app te raken
//  TL5  de tiklog reist mee in de meetdata-export
//  TL6  KERN: geen gedragswijziging — twaalf functies zijn zonder de
//       V11.32.0-regels byte-gelijk aan V11.31.0, de handler inbegrepen
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
  // Een echte tik op het canvas, op camerapositie p.
  const tikOp = (p) => {
    const r = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('click', {
      clientX: r.left + (p.x / canvas.width) * r.width,
      clientY: r.top + (p.y / canvas.height) * r.height, bubbles: true }));
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
    eis('TL0a M1: een tik op A, die niet gedetecteerd is, zet de lock op buur B',
        !!bboxOverride && Math.abs(bboxOverride.cx - bCrop.cx) < 0.5 && Math.abs(bboxOverride.cy - bCrop.cy) < 0.5,
        'lock op B (' + r1(bCrop.cx) + ', ' + r1(bCrop.cy) + ')',
        bboxOverride ? r1(bboxOverride.cx) + ', ' + r1(bboxOverride.cy) : 'geen lock');
    let tk = regelsVan('tik').pop();
    eis('TL1a de tik-regel: pad A, gesnapt, op ~91 camerapixels van je vinger',
        tk && tk.pad === 'A' && tk.snap === 1 && tk.dCam >= 88 && tk.dCam <= 93 && tk.n === 1 && tk.st === 0,
        'A / 1 / ~91 / n 1 / st 0', tk && `${tk.pad} / ${tk.snap} / ${tk.dCam} / n ${tk.n} / st ${tk.st}`);
    eis('TL1b de tikplek staat er in camerapixels bij', tk && tk.cx === A.x && tk.cy === A.y,
        A.x + ', ' + A.y, tk && tk.cx + ', ' + tk.cy);

    // ═══ TL0b — M2: de coördinatenval ═══════════════════════
    // De detecties komen uit een CROP-run, de lopende run is VOLBEELD. Een tik
    // precies op A wordt met het volbeeld-stelsel omgerekend en landt op B.
    schoon(); leegTik(); zetVol();
    const aCrop = naarCrop(A.x, A.y);
    laatsteDetecties = [det(aCrop), det(bCrop)];
    laatsteDetectiesStelsel = { ...ST_CROP };
    tikOp(A);
    eis('TL0b M2: een tik precies op A landt op B als crop en volbeeld door elkaar lopen',
        !!bboxOverride && Math.abs(bboxOverride.cx - bCrop.cx) < 0.5,
        'lock op B (' + r1(bCrop.cx) + ')', bboxOverride ? r1(bboxOverride.cx) : 'geen lock');
    tk = regelsVan('tik').pop();
    eis('TL1c de tik-regel ziet het: ander stelsel, verkeerde keuze, echte afstand tot A ~0',
        tk && tk.st === 1 && tk.mis === 1 && tk.dMin <= 1 && tk.vol === 1 && tk.dCam >= 88,
        'st 1 / mis 1 / dMin 0 / vol 1', tk && `st ${tk.st} / mis ${tk.mis} / dMin ${tk.dMin} / vol ${tk.vol} / dCam ${tk.dCam}`);

    // ═══ TL0c — M3: overname onder 15 m, zonder straal ══════
    schoon({ afst: 10 }); leegTik(); zetVol();
    bboxOverride = { cx: 0, cy: 0 }; bboxOverrideCamX = A.x; bboxOverrideCamY = A.y;
    stickyDetectie = stickyOp(A);
    const ver = naarVol(900, 450);                // 310 camerapixels van A
    const rc = selecteerBesteDetectie([det(ver)]);
    eis('TL0c M3: onder 15 m pakt de overname na één misser een lamp op 310 camerapixels',
        !!rc.s1 && Math.abs(rc.s1.cx - ver.cx) < 0.5 && rc.afwijsReden === 'sticky_overname_dichtbij',
        'B + sticky_overname_dichtbij', (rc.s1 ? r1(rc.s1.cx) : 'geen') + ' + ' + rc.afwijsReden);
    let rn = regelsVan('run');
    eis('TL2a de run-regels: eerst de misser, dan de overname, met afstand tot de tik',
        rn.length >= 2 && rn[rn.length - 2].tak === 'mis1' && rn[rn.length - 1].tak === 'over_c'
          && rn[rn.length - 1].dCam >= 305 && rn[rn.length - 1].dCam <= 315 && rn[rn.length - 1].skip === 1,
        'mis1, over_c, dCam ~310, skip 1', JSON.stringify(rn.slice(-2)));

    // ═══ TL0g — M3: op volbeeld is de straal drie keer zo ruim ═
    // Dezelfde verschuiving van 200 camerapixels: op volbeeld een geldige
    // match (67 YOLO-px < 80), in de crop niet (197 YOLO-px).
    schoon({ afst: 40 }); leegTik(); zetVol();
    bboxOverride = { cx: 0, cy: 0 }; bboxOverrideCamX = A.x; bboxOverrideCamY = A.y;
    stickyDetectie = stickyOp(A);
    const opzij = { x: A.x + 200, y: A.y };
    const rg = selecteerBesteDetectie([det(naarVol(opzij.x, opzij.y))]);
    eis('TL0g M3: op volbeeld verhuist de sticky 200 camerapixels, naar een andere lamp',
        !!rg.s1 && rg.afwijsReden === 'ok' && bboxSlot === 'tap',
        'match + tap-slotje', (rg.s1 ? 'match' : 'geen') + ' + ' + rg.afwijsReden + ' + ' + bboxSlot);
    rn = regelsVan('run');
    eis('TL2b en dat heet in de log een sprong van ~200 camerapixels',
        rn.length && rn[rn.length - 1].tak === 'sprong' && rn[rn.length - 1].sprong >= 195 && rn[rn.length - 1].sprong <= 205,
        'sprong ~200', JSON.stringify(rn.slice(-1)));
    schoon({ afst: 40 }); zetCrop();
    bboxOverride = { cx: 0, cy: 0 }; bboxOverrideCamX = A.x; bboxOverrideCamY = A.y;
    stickyDetectie = stickyOp(A);
    const rg2 = selecteerBesteDetectie([det(naarCrop(opzij.x, opzij.y))]);
    eis('TL0g2 ... terwijl dezelfde 200 camerapixels in de crop géén match zijn',
        !rg2.s1 && rg2.afwijsReden === 'sticky_miss', 'geen + sticky_miss',
        (rg2.s1 ? 'match' : 'geen') + ' + ' + rg2.afwijsReden);

    // ═══ TL0d — M4: resetNeutraal wist de tik ═══════════════
    schoon({ tap: { cx: 300, cy: 200 }, camX: A.x, camY: A.y, afst: 12 }); leegTik();
    stickyDetectie = { cx: 300, cy: 200, familie: 'rood', hoogte: 40, klasse: 0, tijd: Date.now() };
    resetNeutraal('dropout');
    eis('TL0d M4: resetNeutraal wist de levende tik bij een uitval',
        bboxOverride === null && stickyDetectie === null, 'tik weg', 'bboxOverride=' + JSON.stringify(bboxOverride));
    let los = regelsVan('los').pop();
    eis('TL3a de los-regel noemt de reden en de duur', los && los.reden === 'reset_dropout' && los.duur >= 0 && los.node === '860541',
        'reset_dropout, duur, node', JSON.stringify(los));

    // ═══ TL0e — M5: groen wist de tik-sticky (op de bron) ═══
    const fase5 = zc(verwerkFase);
    const groenBlok = fase5.slice(fase5.indexOf("if (nieuw === 'groen') {"), fase5.indexOf("if (nieuw === 'groen') {") + 2200);
    eis('TL0e M5: in de groene tak staat een onvoorwaardelijke stickyDetectie = null',
        /\n\s*stickyDetectie = null; stickyMissTeller = 0;/.test(groenBlok)
          && !/if \(bboxOverride === null\)\s*\{?\s*stickyDetectie = null/.test(groenBlok),
        'onvoorwaardelijk', /if \(bboxOverride === null\)/.test(groenBlok) ? 'voorwaardelijk' : 'onvoorwaardelijk');
    eis('TL3b en de tiklog meldt het, alleen als er een tik leeft',
        /bboxOverride !== null && stickyDetectie\) tikLogRun\('groen_sticky'/.test(String(verwerkFase)),
        'aanwezig', 'ok');

    // ═══ TL0f — M5: closest op de oude YOLO-positie ═════════
    // Getikt op A in een crop-run; bboxOverride staat in die YOLO-ruimte. Nu
    // volbeeld, sticky weg (groen). B ligt dichter bij die OUDE positie.
    schoon({ tap: { ...aCrop }, camX: A.x, camY: A.y, afst: 20 }); leegTik(); zetVol();
    const bLaag = naarVol(560, 780);
    const rf = selecteerBesteDetectie([det(naarVol(A.x, A.y)), det(bLaag)]);
    eis('TL0f M5: de eerste match na een verloren sticky kiest B, die dicht bij de oude YOLO-positie ligt',
        !!rf.s1 && Math.abs(rf.s1.cx - bLaag.cx) < 0.5, 'B', rf.s1 ? r1(rf.s1.cx) : 'geen');
    rn = regelsVan('run');
    eis('TL2c de log zegt: eerste match, op ~331 camerapixels van de tik',
        rn.length && rn[rn.length - 1].tak === 'eerst' && rn[rn.length - 1].dCam >= 325 && rn[rn.length - 1].dCam <= 335,
        'eerst, ~331', JSON.stringify(rn.slice(-1)));

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
    selecteerBesteDetectie([det({ cx: 320, cy: 200 })]);
    los = regelsVan('los').pop();
    eis('TL3f na TAP_KWIJT_MS zonder match: los-regel kwijt', los && los.reden === 'kwijt' && los.gezien >= TAP_KWIJT_MS,
        'kwijt, gezien > 20000', JSON.stringify(los));
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

    // ═══ TL6 — geen gedragswijziging ════════════════════════
    // V11.31.0-vingerafdrukken (fase_c, gemeten met scratchpad/vgl_fn.js).
    const V1131 = {
      _verwerkWorkerResultaatKern: ['82b0bdd1', 5976], selecteerBesteDetectie: ['99ca03f6', 23733],
      resetNeutraal: ['6151984b', 2858], verwerkFase: ['e63ae990', 12374],
      verwerkDetecties: ['33ab2523', 8715], naarStartscherm: ['6ec33ce9', 402],
      updateDichtbij: ['e82d3c0', 11914], corrigeerNodeAutomatisch: ['afe7b427', 4118],
      onGPS: ['ece04644', 14206], lus: ['fd02fb0', 3160], exporteerMeetdata: ['fd647e17', 7686]
    };
    const zonder = (s) => s.split('\n').filter(l => !l.includes('V11.32.0')).join('\n')
      .replace(/resetNeutraal\('[a-z]+'\)/g, 'resetNeutraal()').replace('function resetNeutraal(reden) {', 'function resetNeutraal() {');
    const afwijkend = [];
    for (const [naam, [h, len]] of Object.entries(V1131)) {
      const z = zonder(String(eval(naam)));
      if (fnv(z) !== h || z.length !== len) afwijkend.push(naam + ' ' + fnv(z) + '/' + z.length);
    }
    eis('TL6a elf functies zijn zonder de V11.32.0-regels byte-gelijk aan V11.31.0',
        afwijkend.length === 0, 'geen afwijking', afwijkend.join('; ') || 'geen');
    let handler = null;
    try {
      const src = await (await fetch('/index.html?' + Date.now())).text();
      const i = src.indexOf("canvas.addEventListener('click', (e) => {");
      handler = src.slice(i, src.indexOf('\n});', i) + 4);
    } catch (e) {}
    const hz = handler ? zonder(handler) : '';
    eis('TL6b de tik-handler is zonder de V11.32.0-regel byte-gelijk aan V11.31.0',
        !!handler && fnv(hz) === '9c1fd772' && hz.length === 8320, '9c1fd772 / 8320', handler ? fnv(hz) + ' / ' + hz.length : 'niet gelezen');
    eis('TL6c de handler kreeg precies één regel: de tiklog-aanroep',
        !!handler && handler.split('\n').filter(l => l.includes('V11.32.0')).length === 1
          && /tikLogTik\(videoX, videoY, heeftActieveBbox, dichtstbij, minAfst\)/.test(handler),
        '1 regel', handler ? handler.split('\n').filter(l => l.includes('V11.32.0')).length : '-');
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
