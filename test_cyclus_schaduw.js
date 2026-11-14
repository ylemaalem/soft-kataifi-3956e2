// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_cyclus_schaduw.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.37: de hele cyclus als schaduw (alleen rekenen en loggen).
//  Beslisregel vooraf: kladmap/s_cyclus/beslisregel_14nov.txt.
//
//  CS1  begin van rood bekend (de app zag zelf oranje -> rood op deze node):
//       g 2, nieuw = geleerde rooddauer min de tijd sinds het begin
//  CS2  begin onbekend (aankomst tijdens rood): g 1, nieuw = huidig
//  CS3  overgang gezien op een ANDERE node: g 1 (begin onbekend voor deze node)
//  CS4  de regel in sl_schaduwlog: g, hu, nw, wr; de oude velden ongewijzigd
//  CS5  niets in beeld verandert: activeCdDoel, cdStart, de pil en de m-velden
//  CS6  zonder geleerde rooddauer: nieuw = huidig, ook bij g 2
//  CS7  de regel wordt hoogstens ~40 tekens langer (opslag)
//
//  DRAAIEN: zoals de andere toetsen; testCyclusSchaduw().
// ═══════════════════════════════════════════════════════════════
function testCyclusSchaduw() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const bew = { osm: dichtstbijOSM, fase, faseStart, faseNodeId, zag: zagRoodOvergang, cdStart, doel: activeCdDoel, bron: huidigCdBron,
                snap: schaduwSnapshot, stop: schaduwLogStop, log: localStorage.getItem('sl_schaduwlog'), laadM: window.laadM, gewGem: window.gewGem,
                pil: cdPillGetal.textContent };
  const NEP = [];
  const lees = () => { try { return JSON.parse(localStorage.getItem('sl_schaduwlog') || '[]'); } catch (e) { return []; } };
  const zet = (o) => {
    dichtstbijOSM = { id: 9700001, lat: 52.0, lon: 5.0, afstand: 20 };
    fase = 'rood'; faseNodeId = o.faseNode != null ? o.faseNode : '9700001'; zagRoodOvergang = o.zag;
    const p = performance.now();
    faseStart = p - o.sindsBegin * 1000; cdStart = p - o.sindsCd * 1000; activeCdDoel = o.doel; huidigCdBron = 'V4';
    schaduwLogStop = false;
    window.laadM = () => NEP;
    window.gewGem = (m) => (m === NEP ? o.geleerd : bew.gewGem(m));
  };
  try {
    // ═══ CS1 ═══
    zet({ zag: true, sindsBegin: 6, sindsCd: 6, doel: 40, geleerd: 50 });
    const voorDoel = activeCdDoel, voorCd = cdStart, voorPil = cdPillGetal.textContent;
    maakSchaduwSnapshot();
    const c1 = schaduwSnapshot && schaduwSnapshot.cy;
    eis('CS1 begin bekend: g 2, huidig = 40 - 6 = 34, nieuw = 50 - 6 = 44', !!c1 && c1.g === 2 && Math.round(c1.hu) === 34 && Math.round(c1.nw) === 44, 'g 2, 34, 44', kort(c1));
    // ═══ CS5 ═══
    eis('CS5 niets in beeld verandert: activeCdDoel, cdStart en de pil blijven gelijk', activeCdDoel === voorDoel && cdStart === voorCd && cdPillGetal.textContent === voorPil, 'gelijk', '');
    const bron = String(cyclusSchaduwZet) + String(cyclusSchaduwSluit);
    eis('CS5 de twee functies schrijven niets dat de countdown of het scherm gebruikt (alleen snap.cy en de logregel)',
        !/activeCd\w*\s*=|cdStart\s*=|cdPill|textContent|innerHTML|slaOp\(|opslagSchrijf|localStorage/.test(bron), 'alleen lezen', '');
    // ═══ CS4 ═══
    const n0 = lees().length;
    schaduwSnapshot.cy.p -= 12000;   // 12 s later wordt het groen
    schaduwLogSluit(30);
    const L = lees(), r = L[L.length - 1] || {};
    eis('CS4 de regel heeft g, hu, nw en wr (werkelijke rest 12 s), en de oude velden staan er nog', (L.length === n0 + 1 || L.length === MAX_SCHADUWLOG) && r.g === 2 && r.hu === 34 && r.nw === 44 && r.wr === 12 && r.werk === 30 && r.geb === 40 && r.zag === 1,
        'g 2, hu 34, nw 44, wr 12', kort(r));
    // ═══ CS2 ═══
    zet({ zag: false, sindsBegin: 3, sindsCd: 3, doel: 40, geleerd: 50 });
    maakSchaduwSnapshot();
    const c2 = schaduwSnapshot && schaduwSnapshot.cy;
    eis('CS2 begin onbekend (aankomst tijdens rood): g 1, nieuw = huidig', !!c2 && c2.g === 1 && c2.nw === c2.hu && Math.round(c2.hu) === 37, 'g 1, nw = hu = 37', kort(c2));
    // ═══ CS3 ═══
    zet({ zag: true, faseNode: '9700002', sindsBegin: 3, sindsCd: 3, doel: 40, geleerd: 50 });
    maakSchaduwSnapshot();
    const c3 = schaduwSnapshot && schaduwSnapshot.cy;
    eis('CS3 overgang gezien op een andere node: g 1', !!c3 && c3.g === 1 && c3.nw === c3.hu, 'g 1', kort(c3));
    // ═══ CS6 ═══
    zet({ zag: true, sindsBegin: 2, sindsCd: 2, doel: 40, geleerd: 0 });
    maakSchaduwSnapshot();
    const c6 = schaduwSnapshot && schaduwSnapshot.cy;
    eis('CS6 geen geleerde rooddauer: g 2, maar nieuw = huidig', !!c6 && c6.g === 2 && c6.nw === c6.hu, 'nw = hu', kort(c6));
    // nooit negatief
    zet({ zag: true, sindsBegin: 90, sindsCd: 90, doel: 40, geleerd: 50 });
    maakSchaduwSnapshot();
    const c6b = schaduwSnapshot && schaduwSnapshot.cy;
    eis('CS6b na de verwachte duur: huidig en nieuw 0, nooit negatief', !!c6b && c6b.hu === 0 && c6b.nw === 0, '0, 0', kort(c6b));
    // ═══ CS7 ═══
    const zonder = Object.assign({}, r); delete zonder.g; delete zonder.hu; delete zonder.nw; delete zonder.wr;
    const extra = JSON.stringify(r).length - JSON.stringify(zonder).length;
    eis('CS7 de regel wordt hoogstens 40 tekens langer (200 regels = hoogstens 8 KB eenmalig)', extra > 0 && extra <= 40, '<= 40', extra);
  } catch (e) {
    eis('CS crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    dichtstbijOSM = bew.osm; fase = bew.fase; faseStart = bew.faseStart; faseNodeId = bew.faseNodeId; zagRoodOvergang = bew.zag;
    cdStart = bew.cdStart; activeCdDoel = bew.doel; huidigCdBron = bew.bron; schaduwSnapshot = bew.snap; schaduwLogStop = bew.stop;
    window.laadM = bew.laadM; window.gewGem = bew.gewGem; cdPillGetal.textContent = bew.pil;
    try { if (bew.log === null) localStorage.removeItem('sl_schaduwlog'); else localStorage.setItem('sl_schaduwlog', bew.log); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testCyclusSchaduw = testCyclusSchaduw;
