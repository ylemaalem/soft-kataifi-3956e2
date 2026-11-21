// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetregel_zoom.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.6 (alleen meten): de detlog krijgt de schermzoom (zm), het zoomdoel
//  (zd), het zoomslot (zs) en het lampslot (ls), en schrijft rijdend ook onder 20 m
//  (dicht:1, hooguit één regel per 400 ms).
//
//  MZ1  de constanten: 400 ms rijdend, 2 s stil, grens 20 m
//  MZ2  rijdend op 5 m: één regel met dicht:1 en de zoomvelden; binnen 400 ms geen tweede
//  MZ3  stilstaand op 5 m: zoals sinds V11.37.5 één per 2 s, stil:1 en geen dicht
//  MZ4  op 50 m een gewone regel (geen dicht) mét de zoomvelden; boven 400 m niets
//  MZ5  zs en ls: zoomslot dicht/open, tik, auto-slot, geen slot
//  MZ6  geen positie in de regel
//  MZ7  detLogZoomVelden verandert niets aan zoom, slot of selectie
//  MZ8  de bron: zd komt sinds V11.38.7 uit schermZoomStap; de oude zoomregels in lus ongewijzigd
//
//  DRAAIEN: zoals de andere toetsen; testMeetregelZoom().
// ═══════════════════════════════════════════════════════════════
function testMeetregelZoom() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const bew = { log: localStorage.getItem('sl_detlog'), arr: detLogArr, stilL: detLogStilLaatst, dichtL: detLogDichtLaatst,
                afst: detLogAfst, kmh: snelheidKmh, osm: dichtstbijOSM, zoom: huidigeZoom, sz: schermZoom, doel: zoomDoelLaatst,
                verg: zoomVergrendeld, bbox: bboxOverride, sticky: stickyDetectie, stop: detLogStop };
  const det = () => { try { return JSON.parse(localStorage.getItem('sl_detlog')) || []; } catch (e) { return []; } };
  const leeg = () => { localStorage.setItem('sl_detlog', '[]'); detLogArr = null; detLogStilLaatst = 0; detLogDichtLaatst = 0; };
  try {
    detLogStop = false;
    dichtstbijOSM = { id: 9604301, lat: 52.0000, lon: 5.0000, afstand: 5 };
    huidigeZoom = 1.26; schermZoom = 1.26; zoomDoelLaatst = 1.26; zoomVergrendeld = true; bboxOverride = null; stickyDetectie = null;

    eis('MZ1 de constanten: rijdend hooguit één regel per 400 ms, stil één per 2 s, de grens blijft 20 m',
        DETLOG_DICHT_MS === 400 && DETLOG_STIL_MS === 2000 && DETLOG_MIN_M === 20 && DETLOG_STIL_KMH === 3,
        '400/2000/20/3', [DETLOG_DICHT_MS, DETLOG_STIL_MS, DETLOG_MIN_M, DETLOG_STIL_KMH].join('/'));

    leeg(); snelheidKmh = 20; detLogAfst = 5;
    detLogSchrijf(); const a1 = det();
    detLogSchrijf(); const a2 = det();
    detLogDichtLaatst -= DETLOG_DICHT_MS; detLogSchrijf(); const a3 = det();
    eis('MZ2 rijdend op 5 m: een regel met dicht 1, zm 1,26, zd 1,26 en zs 1; binnen 400 ms geen tweede, daarna wel',
        a1.length === 1 && a1[0].dicht === 1 && a1[0].stil === undefined && a1[0].zm === 1.26 && a1[0].zd === 1.26 && a1[0].zs === 1
          && a1[0].afst === 5 && a2.length === 1 && a3.length === 2,
        '1, 1, 2 regels', JSON.stringify({ n: [a1.length, a2.length, a3.length], r: a1[0] }));

    leeg(); snelheidKmh = 0; detLogAfst = 5;
    detLogSchrijf(); const s1 = det();
    detLogSchrijf(); const s2 = det();
    eis('MZ3 stilstaand op 5 m: zoals sinds V11.37.5 een regel met stil 1 (geen dicht), binnen 2 s geen tweede',
        s1.length === 1 && s1[0].stil === 1 && s1[0].dicht === undefined && s1[0].zm === 1.26 && s2.length === 1,
        '1 regel stil, geen dicht', JSON.stringify(s1[0]));

    leeg(); snelheidKmh = 30; detLogAfst = 50; zoomVergrendeld = false; huidigeZoom = 2.98; schermZoom = 2.98; zoomDoelLaatst = 2;
    detLogSchrijf(); const g1 = det();
    detLogAfst = 450; detLogSchrijf(); const g2 = det();
    eis('MZ4 op 50 m een gewone regel (geen dicht, geen stil) met zm 2,98, zd 2 en zs 0; op 450 m niets',
        g1.length === 1 && g1[0].dicht === undefined && g1[0].stil === undefined && g1[0].zm === 2.98 && g1[0].zd === 2 && g1[0].zs === 0 && g2.length === 1,
        '1 gewone regel, daarna niets erbij', JSON.stringify({ n: [g1.length, g2.length], r: g1[0] }));

    const v = [];
    zoomVergrendeld = true; bboxOverride = null; stickyDetectie = null; v.push(detLogZoomVelden());
    zoomVergrendeld = false; bboxOverride = { x: 1 }; v.push(detLogZoomVelden());
    bboxOverride = null; stickyDetectie = { bron: 'auto', cx: 1, cy: 1 }; v.push(detLogZoomVelden());
    stickyDetectie = { bron: 'tik', cx: 1, cy: 1 }; v.push(detLogZoomVelden());
    eis('MZ5 zs 1/0 volgt het zoomslot; ls t bij een tik, a bij het auto-slot, weggelaten zonder slot',
        v[0].zs === 1 && v[0].ls === undefined && v[1].zs === 0 && v[1].ls === 't' && v[2].ls === 'a' && v[3].ls === undefined,
        '1-, 0t, a, -', JSON.stringify(v));

    const sleutels = new Set(); for (const r of [...a1, ...s1, ...g1]) Object.keys(r).forEach(k => sleutels.add(k));
    eis('MZ6 geen positie in de regels (geen lat, lon of iets dergelijks)',
        !['lat', 'lon', 'la', 'lo', 'lng', 'pos'].some(k => sleutels.has(k)), 'geen positievelden', [...sleutels].join(','));

    huidigeZoom = 1.7; zoomVergrendeld = true; const bb = { x: 3 }; bboxOverride = bb; const st = { bron: 'auto', cx: 2, cy: 2 }; stickyDetectie = st;
    const voor = JSON.stringify({ huidigeZoom, schermZoom, zoomVergrendeld, vergrendeldZoomNiveau, bboxOverride, stickyDetectie, zoomDoelLaatst });
    detLogZoomVelden(); detLogZoomVelden();
    const na = JSON.stringify({ huidigeZoom, schermZoom, zoomVergrendeld, vergrendeldZoomNiveau, bboxOverride, stickyDetectie, zoomDoelLaatst });
    eis('MZ7 detLogZoomVelden verandert niets: zoom, zoomslot, tik en auto-slot blijven gelijk',
        voor === na && bboxOverride === bb && stickyDetectie === st, 'gelijk', voor + ' | ' + na);

    // V11.38.7: zd komt sinds deze versie uit schermZoomStap (het doel van wat je ziet), niet meer uit lus.
    const src = String(lus), stap = String(schermZoomStap);
    const doelRegel = "const doelZoom = zoomVergrendeld ? vergrendeldZoomNiveau : berekenDoelZoom(gecorrigeerdeAfstand);";
    eis('MZ8 zd komt uit schermZoomStap (V11.38.7); in lus geen zoomDoelLaatst meer en de oude zoomregels ongewijzigd',
        stap.indexOf('zoomDoelLaatst = doel;') >= 0 && src.indexOf('zoomDoelLaatst') < 0
          && src.indexOf("huidigeZoom += (doelZoom-huidigeZoom) * 0.12;") >= 0 && src.indexOf(doelRegel) >= 0,
        'zd uit schermZoomStap; rest gelijk', JSON.stringify({ stap: stap.indexOf('zoomDoelLaatst = doel;') >= 0, lus: src.indexOf('zoomDoelLaatst') }));
  } finally {
    if (bew.log === null) localStorage.removeItem('sl_detlog'); else localStorage.setItem('sl_detlog', bew.log);
    detLogArr = bew.arr; detLogStilLaatst = bew.stilL; detLogDichtLaatst = bew.dichtL; detLogAfst = bew.afst; snelheidKmh = bew.kmh;
    dichtstbijOSM = bew.osm; huidigeZoom = bew.zoom; schermZoom = bew.sz; zoomDoelLaatst = bew.doel; zoomVergrendeld = bew.verg;
    bboxOverride = bew.bbox; stickyDetectie = bew.sticky; detLogStop = bew.stop;
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testMeetregelZoom = testMeetregelZoom;
