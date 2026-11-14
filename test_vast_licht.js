// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_vast_licht.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.37.38: vast licht als schaduw (alleen rekenen en loggen).
//  Beslisregel vooraf: kladmap/s_cyclus/beslisregel_vast_licht.txt.
//
//  VL1  3 volledige roodfasen binnen 2 s (15, 16, 15): vast, M = 15, nieuw = M min de verstreken tijd
//  VL2  spreiding 3 s (15, 16, 18): niet vast, nieuw = huidig
//  VL3  alleen volledige metingen tellen: resttijden (zo 0), bevestig-records, s2-markeringen (duur 0)
//       tellen niet; een oud record met gewicht 1,5 (zonder zo) telt wel
//  VL4  alleen de nieuwste 3 tellen: een oude afwijkende meting houdt de status niet tegen
//  VL5  PROGRAMMAWISSEL: 15, 15, 15 is vast; na 35 direct niet meer; na 36 niet; na 34 weer vast met M = 35
//  VL5b een afwijking van precies 3 s (15, 15, 15, 18) beeindigt de status ook (de vooraf vastgelegde, strengere kant)
//  VL6  de regel in sl_schaduwlog: v, vn (en vm bij vast); de oude velden en g/hu/nw/wr blijven
//  VL7  niets in beeld verandert, en de functies schrijven niets
//  VL8  nooit negatief; zonder volledige metingen geen vm in de regel
//  VL9  de regel wordt hoogstens 25 tekens langer (opslag)
//
//  DRAAIEN: zoals de andere toetsen; testVastLicht().
// ═══════════════════════════════════════════════════════════════
function testVastLicht() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const bew = { osm: dichtstbijOSM, fase, faseStart, faseNodeId, zag: zagRoodOvergang, cdStart, doel: activeCdDoel, bron: huidigCdBron,
                snap: schaduwSnapshot, stop: schaduwLogStop, log: localStorage.getItem('sl_schaduwlog'), laadM: window.laadM,
                pil: cdPillGetal.textContent };
  let NEP = [];
  const T0 = Date.now() - 864e5;
  // volledige rood-metingen, oudste eerst; de nieuwste krijgt de hoogste tijd
  const vol = (duren, extra) => duren.map((d, i) => Object.assign({ duur: d, tijd: T0 + i * 60000, gewicht: 0.5, bron: 's1', zo: 1 }, extra || {}));
  const lees = () => { try { return JSON.parse(localStorage.getItem('sl_schaduwlog') || '[]'); } catch (e) { return []; } };
  const zet = (o) => {
    dichtstbijOSM = { id: 9700001, lat: 52.0, lon: 5.0, afstand: 20 };
    fase = 'rood'; faseNodeId = '9700001'; zagRoodOvergang = false;
    const p = performance.now();
    faseStart = p - o.sinds * 1000; cdStart = p - o.sinds * 1000; activeCdDoel = o.doel; huidigCdBron = 'V4';
    schaduwSnapshot = null; schaduwLogStop = false;
    NEP = o.m;
    window.laadM = () => NEP.slice().sort((a, b) => b.tijd - a.tijd);
  };
  const vl = () => { maakSchaduwSnapshot(); return schaduwSnapshot && schaduwSnapshot.vl; };
  try {
    // ═══ VL1 ═══
    zet({ sinds: 4, doel: 30, m: vol([15, 16, 15]) });
    const voorDoel = activeCdDoel, voorCd = cdStart, voorPil = cdPillGetal.textContent;
    const a = vl();
    eis('VL1 15, 16, 15: vast, M = 15, nieuw = 15 - 4 = 11 (huidig 30 - 4 = 26)', !!a && a.v === 1 && a.m === 15 && Math.round(a.vn) === 11, 'v 1, M 15, vn 11', kort(a));
    // ═══ VL7 ═══
    eis('VL7 niets in beeld verandert: activeCdDoel, cdStart en de pil blijven gelijk', activeCdDoel === voorDoel && cdStart === voorCd && cdPillGetal.textContent === voorPil, 'gelijk', '');
    const bron = String(vastLichtStatus) + String(vastLichtZet) + String(vastLichtSluit);
    eis('VL7 de drie functies schrijven niets dat de countdown, het scherm of de opslag gebruikt',
        !/activeCd\w*\s*=|cdStart\s*=|cdPill|textContent|innerHTML|slaOp|opslagSchrijf|localStorage/.test(bron), 'alleen lezen', '');
    // ═══ VL6 ═══
    const n0 = lees().length;
    schaduwSnapshot.cy.p -= 12000;   // 12 s later wordt het groen
    schaduwLogSluit(30);
    const L = lees(), r = L[L.length - 1] || {};
    eis('VL6 de regel heeft v 1, vm 15, vn 11, en hu/wr en de oude velden staan er nog',
        (L.length === n0 + 1 || L.length === MAX_SCHADUWLOG) && r.v === 1 && r.vm === 15 && r.vn === 11 && r.hu === 26 && r.wr === 12 && r.werk === 30 && r.geb === 30 && r.g === 1,
        'v 1, vm 15, vn 11, hu 26, wr 12', kort(r));
    // ═══ VL9 ═══
    const zonder = Object.assign({}, r); delete zonder.v; delete zonder.vn; delete zonder.vm;
    const extra = JSON.stringify(r).length - JSON.stringify(zonder).length;
    eis('VL9 de regel wordt hoogstens 25 tekens langer (200 regels = hoogstens 5 KB eenmalig)', extra > 0 && extra <= 25, '<= 25', extra);
    // ═══ VL2 ═══
    zet({ sinds: 4, doel: 30, m: vol([15, 16, 18]) });
    const b = vl();
    eis('VL2 15, 16, 18 (spreiding 3 s): niet vast, nieuw = huidig', !!b && b.v === 0 && b.m === null && Math.round(b.vn) === 26, 'v 0, vn = hu = 26', kort(b));
    // ═══ VL3 ═══
    const ruis = [
      { duur: 15, tijd: T0 + 10 * 60000, gewicht: 0.5, bron: 's1', zo: 0 },          // resttijd
      { duur: 15, tijd: T0 + 11 * 60000, gewicht: 0.3, bron: 'bevestig_bijna' },      // bevestig
      { duur: 0, tijd: T0 + 12 * 60000, gewicht: 0.3, kleur: 'rood', s2: true },     // s2-markering
      { duur: 15, tijd: T0 + 13 * 60000, gewicht: 0.5, bron: 's1' }                   // zonder zo, geen 1,5: onbekend
    ];
    zet({ sinds: 2, doel: 30, m: vol([15, 15]).concat(ruis) });
    const c = vl();
    eis('VL3a 2 volledige + resttijd, bevestig, s2 en onbekend: niet vast (die tellen niet)', !!c && c.v === 0, 'v 0', kort(c));
    zet({ sinds: 2, doel: 30, m: vol([15, 15]).concat(ruis, [{ duur: 16, tijd: T0 + 14 * 60000, gewicht: 1.5 }]) });
    const c2 = vl();
    eis('VL3b met een oud record met gewicht 1,5 (zonder zo) erbij: wel vast, M = 15', !!c2 && c2.v === 1 && c2.m === 15, 'v 1, M 15', kort(c2));
    // ═══ VL4 ═══
    zet({ sinds: 2, doel: 30, m: vol([50, 15, 15, 15]) });
    const d = vl();
    eis('VL4 50 (oud), dan 15, 15, 15: vast met M = 15 (alleen de nieuwste 3)', !!d && d.v === 1 && d.m === 15, 'v 1, M 15', kort(d));
    // ═══ VL5: programmawissel ═══
    const reeks = [15, 15, 15, 35, 36, 34];
    const stand = [];
    for (let i = 3; i <= reeks.length; i++) { zet({ sinds: 0, doel: 30, m: vol(reeks.slice(0, i)) }); const s = vl(); stand.push(s ? s.v + '/' + s.m : 'x'); }
    eis('VL5 programmawissel 15, 15, 15 -> 35, 36, 34: vast(15), DIRECT los na 35, los na 36, weer vast(35) na 34',
        stand.join(' ') === '1/15 0/null 0/null 1/35', '1/15 0/null 0/null 1/35', stand.join(' '));
    zet({ sinds: 0, doel: 30, m: vol([15, 15, 15, 35]) });
    const e = vl();
    eis('VL5a na de eerste afwijkende meting geldt weer de huidige methode (nieuw = huidig)', !!e && e.v === 0 && Math.round(e.vn) === 30, 'v 0, vn 30', kort(e));
    zet({ sinds: 0, doel: 30, m: vol([15, 15, 15, 18]) });
    const f = vl();
    eis('VL5b 15, 15, 15, 18 (precies 3 s): ook niet vast, de strengere kant uit de beslisregel', !!f && f.v === 0, 'v 0', kort(f));
    // ═══ VL8 ═══
    zet({ sinds: 40, doel: 30, m: vol([15, 15, 16]) });
    const g = vl();
    eis('VL8a na de verwachte duur: nieuw 0, nooit negatief', !!g && g.v === 1 && g.vn === 0, 'vn 0', kort(g));
    zet({ sinds: 3, doel: 30, m: [] });
    const h = vl();
    schaduwSnapshot.cy.p -= 20000;
    schaduwLogSluit(23);
    const L2 = lees(), r2 = L2[L2.length - 1] || {};
    eis('VL8b zonder volledige metingen: v 0, vn = hu, geen vm in de regel', !!h && h.v === 0 && r2.v === 0 && r2.vn === r2.hu && !('vm' in r2), 'v 0, vn = hu, geen vm', kort(r2));
  } catch (e) {
    eis('VL crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    dichtstbijOSM = bew.osm; fase = bew.fase; faseStart = bew.faseStart; faseNodeId = bew.faseNodeId; zagRoodOvergang = bew.zag;
    cdStart = bew.cdStart; activeCdDoel = bew.doel; huidigCdBron = bew.bron; schaduwSnapshot = bew.snap; schaduwLogStop = bew.stop;
    window.laadM = bew.laadM; cdPillGetal.textContent = bew.pil;
    try { if (bew.log === null) localStorage.removeItem('sl_schaduwlog'); else localStorage.setItem('sl_schaduwlog', bew.log); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testVastLicht = testVastLicht;
