// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_schermzoom.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.7: de schermzoom zonder slot, 1,0x tot en met 30 m, rechtlijnig naar
//  3,0x op 110 m, en een plafond uit de laatst gekozen box (de lamp blijft op het scherm).
//
//  SZ1  de constanten
//  SZ2  de basis uit de afstand: 1,0x tot en met 30 m, 2,0x op 70 m, 3,0x vanaf 110 m,
//       zonder licht/ongeldig 1,0x, bij bboxDichtbij 1,0x
//  SZ3  geen slot: zoomslot dicht op 2,98x en toch naar 1,0x op 10 m
//  SZ4  vloeiend: van 3,0x naar 1,0x zonder sprong en zonder overschieten
//  SZ5  het plafond: lamp in het midden geen beperking, lamp bij de bovenrand laag, buiten
//       beeld nooit onder 1,0x, ouder dan 3 s geen plafond
//  SZ6  een stap met een lamp bij de bovenrand op 80 m: doel = plafond, zd en zp in de detlog
//  SZ7  het plafond blijft 3 s na het wegvallen van de lamp, daarna weer de basis
//  SZ8  de schermzoom raakt het slot, de oude zoom, aiTeller en de stoplichtpositie niet
//  SZ10 het plafond op een staand scherm met de volle hoogte: marge en halve box tellen mee
//  SZ9  de bron: de lus rekent de oude zoom ongewijzigd door, de CSS komt uit schermZoom;
//       de twee koppelingen (aiTeller-reset, GPS-voorbij) lezen nog hun oude vlaggen
//
//  DRAAIEN: zoals de andere toetsen; testSchermzoom().
// ═══════════════════════════════════════════════════════════════
function testSchermzoom() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const r2 = (v) => Math.round(v * 100) / 100;
  const bew = { zoom: schermZoom, pl: schermPlafond, lamp: schermLamp, basis: schermBasis, doel: zoomDoelLaatst,
                ai: laatsteAI, dicht: bboxDichtbij, verg: zoomVergrendeld, vniv: vergrendeldZoomNiveau,
                hz: huidigeZoom, trans: zoomTransitieActief, pos: huidigActiefStoplichtPositie, tel: aiTeller,
                cw: canvas.width, ch: canvas.height };
  try {
    laatsteAI = null; schermLamp = null; bboxDichtbij = false;
    canvas.width = 2160; canvas.height = 3840;

    eis('SZ1 de constanten: 1,0x tot 30 m, 3,0x op 110 m, demping 0,12, marge 3%, plafond houdt 3 s',
        SCHERM_ZOOM_1X_M === 30 && SCHERM_ZOOM_MAX_M === 110 && SCHERM_ZOOM_MAX === 3.0 && SCHERM_ZOOM_DEMPING === 0.12
          && SCHERM_PLAFOND_MARGE === 0.03 && SCHERM_PLAFOND_HOUD_MS === 3000,
        '30/110/3/0.12/0.03/3000',
        [SCHERM_ZOOM_1X_M, SCHERM_ZOOM_MAX_M, SCHERM_ZOOM_MAX, SCHERM_ZOOM_DEMPING, SCHERM_PLAFOND_MARGE, SCHERM_PLAFOND_HOUD_MS].join('/'));

    const b = [0, 6, 30, 31, 50, 70, 100, 110, 400, 999, null, NaN, -5].map(a => r2(schermZoomBasis(a)));
    bboxDichtbij = true; const bd = schermZoomBasis(90); bboxDichtbij = false;
    eis('SZ2 de basis: 1,0x op 0, 6 en 30 m, net boven 30 m iets meer, 1,5x op 50 m, 2,0x op 70 m, 3,0x vanaf 110 m; ongeldig 1,0x; bboxDichtbij 1,0x',
        b[0] === 1 && b[1] === 1 && b[2] === 1 && b[3] > 1 && b[3] < 1.05 && b[4] === 1.5 && b[5] === 2 && b[6] === 2.75
          && b[7] === 3 && b[8] === 3 && b[9] === 3 && b[10] === 1 && b[11] === 1 && b[12] === 1 && bd === 1,
        '1,1,1,>1,1.5,2,2.75,3,3,3,1,1,1 en 1', b.join(',') + ' en ' + bd);

    zoomVergrendeld = true; vergrendeldZoomNiveau = 2.98; schermZoom = 2.98;
    let t = 1000000; for (let i = 0; i < 120; i++) schermZoomStap(10, t += 16);
    eis('SZ3 geen slot: het zoomslot staat dicht op 2,98x, toch gaat het scherm op 10 m naar 1,0x',
        schermZoom === 1 && zoomVergrendeld === true && vergrendeldZoomNiveau === 2.98, 'zm 1, slot onaangeroerd', [schermZoom, zoomVergrendeld, vergrendeldZoomNiveau].join('/'));

    schermZoom = 3.0; const reeks = [];
    for (let i = 0; i < 90; i++) { schermZoomStap(110 - i * (85 / 90), t += 33); reeks.push(schermZoom); }   // 110 m -> 25 m in 3 s
    let grootste = 0, omhoog = 0;
    for (let i = 1; i < reeks.length; i++) { grootste = Math.max(grootste, Math.abs(reeks[i] - reeks[i - 1])); if (reeks[i] > reeks[i - 1] + 1e-9) omhoog++; }
    eis('SZ4 vloeiend: van 3,0x op 110 m naar 25 m, elke stap kleiner dan 0,1x, nooit terug omhoog, onder 1,0x komt hij niet',
        grootste < 0.1 && omhoog === 0 && Math.min(...reeks) >= 1, 'stap <0,1, 0 keer omhoog, >=1', r2(grootste) + ' / ' + omhoog + ' / ' + r2(Math.min(...reeks)));

    const nu = 5000000, zb = schermZichtbaar();
    const midden = schermPlafondUitLamp({ cx: 1080, cy: 1920, w: 40, h: 80, t: nu }, nu);
    const boven = schermPlafondUitLamp({ cx: 1080, cy: 384, w: 40, h: 80, t: nu }, nu);   // 10% van de hoogte
    const verwachtBoven = Math.max(1, Math.min(3, (zb.fy / 2) / (0.4 + 80 / (2 * 3840) + 0.03)));
    const buiten = schermPlafondUitLamp({ cx: 5, cy: 5, w: 40, h: 80, t: nu }, nu);
    const oud = schermPlafondUitLamp({ cx: 1080, cy: 384, w: 40, h: 80, t: nu - 3001 }, nu);
    eis('SZ5 het plafond: lamp in het midden 3,0x (geen beperking), bij 10% van de bovenrand ' + r2(verwachtBoven) + 'x, in de hoek 1,0x, ouder dan 3 s geen plafond',
        midden === 3 && Math.abs(boven - verwachtBoven) < 1e-9 && boven < 1.3 && buiten === 1 && oud === null,
        '3 / ' + r2(verwachtBoven) + ' / 1 / null', [midden, boven === null ? null : r2(boven), buiten, oud].join(' / '));

    schermZoom = 2.25; schermLamp = null;
    laatsteAI = { kleur: 'groen', box: { x: 1060, y: 344, w: 40, h: 80 } };   // midden op 384 (10%)
    const doel6 = schermZoomStap(80, t += 16);
    const velden = detLogZoomVelden();
    eis('SZ6 op 80 m (basis 2,25x) met de lamp bij de bovenrand: het doel is het plafond, zd en zp staan in de detlog',
        Math.abs(doel6 - verwachtBoven) < 1e-9 && schermBasis === 2.25 && velden.zd === r2(verwachtBoven) && velden.zp === r2(verwachtBoven) && schermLamp && schermLamp.cy === 384,
        'doel ' + r2(verwachtBoven) + ', zd=zp', JSON.stringify({ doel: r2(doel6), basis: schermBasis, velden }));

    laatsteAI = null; const t7 = t;
    const nog = schermZoomStap(80, t7 + 2900);
    const weer = schermZoomStap(80, t7 + 3100);
    eis('SZ7 de lamp valt weg: na 2,9 s nog het plafond, na 3,1 s weer de basis 2,25x (zonder zp)',
        Math.abs(nog - verwachtBoven) < 1e-9 && weer === 2.25 && schermPlafond === null && detLogZoomVelden().zp === undefined,
        'plafond, dan 2,25', [r2(nog), weer, schermPlafond].join(' / '));

    zoomVergrendeld = true; vergrendeldZoomNiveau = 2.5; huidigeZoom = 2.4; zoomTransitieActief = true;
    const ap = { lat: 52.0000, lon: 5.0000 }; huidigActiefStoplichtPositie = ap; aiTeller = 2;
    laatsteAI = { kleur: 'rood', box: { x: 100, y: 100, w: 30, h: 60 } };
    for (let i = 0; i < 30; i++) schermZoomStap(i * 5, t += 16);
    eis('SZ8 de schermzoom raakt niets anders: zoomslot, slotniveau, de oude zoom, zoomTransitieActief, aiTeller en de stoplichtpositie blijven gelijk',
        zoomVergrendeld === true && vergrendeldZoomNiveau === 2.5 && huidigeZoom === 2.4 && zoomTransitieActief === true
          && huidigActiefStoplichtPositie === ap && aiTeller === 2,
        'alles gelijk', JSON.stringify({ zoomVergrendeld, vergrendeldZoomNiveau, huidigeZoom, zoomTransitieActief, aiTeller }));

    const src = String(lus);
    const oudeRegels = ["const doelZoom = zoomVergrendeld ? vergrendeldZoomNiveau : berekenDoelZoom(gecorrigeerdeAfstand);",
                        "huidigeZoom += (doelZoom-huidigeZoom) * 0.12;",
                        "zoomTransitieActief = Math.abs(huidigeZoom-doelZoom) > 0.005;"];
    const i9 = src.indexOf(oudeRegels[2]), j9 = src.indexOf('schermZoomStap(ruwAfstand, Date.now());');
    const tussen9 = (i9 >= 0 && j9 > i9) ? src.slice(i9 + oudeRegels[2].length, j9).trim() : null;
    const fns = [schermZoomBasis, schermZichtbaar, schermPlafondUitLamp, schermZoomStap].map(String).join('\n');
    const vd = String(verwerkDetecties), og = String(onGPS);
    eis('SZ9 de bron: de oude zoom rekent ongewijzigd door, direct daarna schermZoomStap, de CSS uit schermZoom; de schermzoom leest geen slot; aiTeller-reset en GPS-voorbij lezen hun oude vlag',
        oudeRegels.every(r => src.indexOf(r) >= 0) && tussen9 === '' && src.indexOf('scale(${schermZoom.toFixed(2)})') >= 0
          && src.indexOf('scale(${huidigeZoom') < 0 && !/zoomVergrendeld|vergrendeldZoomNiveau/.test(fns)
          && vd.indexOf('if (!zoomTransitieActief) { aiTeller=0;') >= 0 && og.indexOf('if (zoomVergrendeld && huidigActiefStoplichtPositie &&') >= 0,
        'alles aanwezig', JSON.stringify({ tussen9, css: src.indexOf('scale(${schermZoom.toFixed(2)})') >= 0 }));
    const echtZicht = schermZichtbaar;
    try {
      schermZichtbaar = () => ({ fx: 1, fy: 1 });   // een staand scherm dat de hele hoogte toont
      const p10 = schermPlafondUitLamp({ cx: 1080, cy: 1152, w: 40, h: 80, t: nu }, nu);   // 30% van de hoogte
      const v10 = 0.5 / (0.2 + 80 / (2 * 3840) + 0.03);
      eis('SZ10 met de volle hoogte op het scherm: lamp op 30% van de hoogte geeft ' + r2(v10) + 'x (halve box en 3% marge meegeteld)',
          Math.abs(p10 - v10) < 1e-9, r2(v10), p10 === null ? null : r2(p10));
    } finally { schermZichtbaar = echtZicht; }
  } finally {
    schermZoom = bew.zoom; schermPlafond = bew.pl; schermLamp = bew.lamp; schermBasis = bew.basis; zoomDoelLaatst = bew.doel;
    laatsteAI = bew.ai; bboxDichtbij = bew.dicht; zoomVergrendeld = bew.verg; vergrendeldZoomNiveau = bew.vniv;
    huidigeZoom = bew.hz; zoomTransitieActief = bew.trans; huidigActiefStoplichtPositie = bew.pos; aiTeller = bew.tel;
    if (canvas.width !== bew.cw) canvas.width = bew.cw;
    if (canvas.height !== bew.ch) canvas.height = bew.ch;
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testSchermzoom = testSchermzoom;
