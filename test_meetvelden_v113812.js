// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetvelden_v113812.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.12 (alleen meten): zh en zu in het V4-record.
//  Een rode fase wordt na een blinde periode bij hetzelfde licht hersteld:
//  zh:1 als het begin vóór de blinde periode gezien was, zu = de blinde tijd (s).
//
//  MZ1  begin gezien, uitval 6 s, herstel: V4-record zo:0, zh:1, zu:6
//  MZ2  begin niet gezien: zu:6, geen zh
//  MZ3  geen zh/zu bij: reden wissel, ander licht, groen vóór de uitval, gat > 30 s,
//       en een volgende rode fase
//  MZ4  twee uitvallen in dezelfde fase (4 s en 3 s): zu:7, zh:1
//  MZ5  de emmer krijgt dezelfde records als zonder de nieuwe velden (op zh/zu na):
//       zo, duur, gewicht en obs gelijk
//  MZ6  een bevestig-record krijgt geen zh/zu
//  MZ7  de bron: zuBijHerstel vóór de zh-voorwaarde; de nieuwe regel in slaOpIntern
//       direct na de zv-regel; de zv-regel en de vlag-regel ongewijzigd
//  MZ8  m5Aanvul zet geen zu (zh in m5 blijft zoals in V11.37.23); geen positie in het record
//
//  DRAAIEN: zoals de andere toetsen; testMeetveldenV113812().
// ═══════════════════════════════════════════════════════════════
function testMeetveldenV113812() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const N = 9604301, N2 = 9604302;
  const weg = () => Object.keys(localStorage).filter(k => k.indexOf(String(N)) >= 0 || k.indexOf(String(N2)) >= 0).forEach(k => localStorage.removeItem(k));
  const bew = { fase, faseStart, faseNodeId, ldt: laatsteDetectieTijd, zag: zagRoodOvergang,
                zhv: zhVoorReset, zhf: zhFase, zuf: zuFase, zvv: zvVoorReset, zvf: zvFase, aanvul: window.zhV4Aanvul };
  const emmerRecs = () => { const uit = []; for (const dd of Object.keys(DD)) for (const r of (laadM(N, dd) || [])) uit.push(r); return uit; };
  let start = 0;
  // Een rode fase op `n` (begin gezien of niet), een blinde periode van `gatS` s met `reden`,
  // dan het herstel op `herstel` (dezelfde faseStart, de vlag nee, zoals de continuïteit doet).
  const begin = (vorige, n, zag) => {
    zvVoorReset = null; zvFase = null; zhVoorReset = null; zhFase = null; zuFase = null;
    start = performance.now() - 20000;
    fase = vorige; faseNodeId = n; faseStart = start; zagRoodOvergang = !!zag;
  };
  const uitval = (gatS, reden) => {
    laatsteDetectieTijd = Date.now() - gatS * 1000;
    zhNoteerReset(reden || 'dropout');
    fase = null; faseStart = null;
  };
  const herstel = (n) => {
    fase = 'rood'; faseStart = start; faseNodeId = n; zagRoodOvergang = false;
    zhBijHerstel(n);
  };
  const meting = () => { slaOp(N, 'rechtdoor', 20, null, true, null, null, false); return emmerRecs(); };
  try {
    // MZ1
    weg(); begin('rood', N, true); uitval(6); herstel(N);
    const r1 = meting();
    eis('MZ1 begin gezien, uitval 6 s, herstel: het V4-record krijgt zo:0, zh:1 en zu:6',
      r1.length === 1 && r1[0].zo === 0 && r1[0].zh === 1 && r1[0].zu === 6 && r1[0].bron === 's1', 'zo 0, zh 1, zu 6', kort(r1));
    // MZ2
    weg(); begin('rood', N, false); uitval(6); herstel(N);
    const r2 = meting();
    eis('MZ2 begin niet gezien: zu:6, geen zh',
      r2.length === 1 && r2[0].zu === 6 && r2[0].zh === undefined && r2[0].zo === 0, 'zu 6, geen zh', kort(r2));
    // MZ3
    const geen = [];
    for (const [naam, f] of [
      ['wissel', () => { begin('rood', N, true); uitval(5, 'wissel'); herstel(N); }],
      ['ander licht', () => { begin('rood', N2, true); uitval(5); herstel(N); }],
      ['groen vooraf', () => { begin('groen', N, true); uitval(5); herstel(N); }],
      ['gat 31 s', () => { begin('rood', N, true); uitval(31); herstel(N); }],
      ['volgende fase', () => { begin('rood', N, true); uitval(5); herstel(N); faseStart = performance.now(); }]]) {
      weg(); f();
      const r = meting();
      const zhVerwacht = naam === 'gat 31 s';   // zh kent geen gatgrens (V11.37.23); alleen zu niet
      if (!(r.length === 1 && r[0].zu === undefined && (zhVerwacht ? r[0].zh === 1 : r[0].zh === undefined))) geen.push(naam + ':' + kort(r));
    }
    eis('MZ3 geen zu bij wissel, ander licht, groen vooraf, gat > 30 s of een volgende fase (en geen zh, behalve bij het lange gat)',
      geen.length === 0, 'geen', kort(geen));
    // MZ4
    weg(); begin('rood', N, true); uitval(4); herstel(N); uitval(3); herstel(N);
    const r4 = meting();
    eis('MZ4 twee uitvallen in dezelfde fase (4 s en 3 s): zu:7, zh:1',
      r4.length === 1 && r4[0].zu === 7 && r4[0].zh === 1, 'zu 7, zh 1', kort(r4));
    // MZ5
    const zonderTijd = (rs) => rs.map(x => { const o = Object.assign({}, x, { tijd: 0 }); delete o.zh; delete o.zu; return kort(o); }).join('|');
    weg(); begin('rood', N, true); uitval(6); herstel(N); const met = meting();
    weg(); begin('rood', N, true); uitval(6); herstel(N); window.zhV4Aanvul = () => {}; const zonder = meting(); window.zhV4Aanvul = bew.aanvul;
    eis('MZ5 de emmer krijgt dezelfde records als zonder zh/zu (op zh/zu na): zo, duur, gewicht en obs gelijk',
      met.length === 1 && met[0].zh === 1 && met[0].zu === 6 && zonder.length === 1 && zonder[0].zh === undefined && zonder[0].zu === undefined && zonderTijd(met) === zonderTijd(zonder),
      kort(zonder), kort(met));
    // MZ6
    weg(); begin('rood', N, true); uitval(6); herstel(N);
    slaOpIntern(N, 0, 20, null, 'dag', 'bevestig');
    const r6 = emmerRecs();
    eis('MZ6 een bevestig-record krijgt geen zh/zu',
      r6.length === 1 && r6[0].bron === 'bevestig' && r6[0].zh === undefined && r6[0].zu === undefined, 'geen zh/zu', kort(r6));
    // MZ7
    const hb = String(zhBijHerstel), si = String(slaOpIntern), vf = String(verwerkFase);
    const iZu = hb.indexOf('zuBijHerstel(n, v.t)'), iVw = hb.indexOf("if (!v || v.n !== n || v.fase !== 'rood' || !v.zag || zagRoodOvergang) return;");
    const iZv = si.indexOf("if (bron === 's1') { try { zvAanvul(entry, osmId); } catch (_) {} }"), iZh = si.indexOf("if (bron === 's1') { try { zhV4Aanvul(entry, osmId); } catch (_) {} }");
    const iPush = si.indexOf('m.push(entry);');
    const vlag = vf.indexOf("zagRoodOvergang = ((fase === 'groen' || fase === 'oranje') && faseNodeId === nodeId);") > 0;
    eis('MZ7 zuBijHerstel vóór de zh-voorwaarde; de zh/zu-regel na de zv-regel en vóór m.push; de vlag-regel ongewijzigd',
      iZu > 0 && iVw > iZu && iZv > 0 && iZh > iZv && iPush > iZh && vlag, 'volgorde klopt', kort({ iZu, iVw, iZv, iZh, iPush, vlag }));
    // MZ8
    weg(); begin('rood', N, true); uitval(6); herstel(N);
    const m5 = {}; m5Aanvul(m5, N);
    const r8 = meting(), sleutels = Object.keys(r8[0] || {}).sort().join(',');
    eis('MZ8 m5Aanvul zet zh maar geen zu; het V4-record bevat geen positie',
      m5.zh === 1 && m5.zu === undefined && r8.length === 1 && !/lat|lon|pos/i.test(sleutels), 'm5 zh 1 zonder zu; geen positie', kort({ m5, sleutels }));
  } catch (e) {
    eis('MZ crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    window.zhV4Aanvul = bew.aanvul;
    fase = bew.fase; faseStart = bew.faseStart; faseNodeId = bew.faseNodeId; laatsteDetectieTijd = bew.ldt; zagRoodOvergang = bew.zag;
    zhVoorReset = bew.zhv; zhFase = bew.zhf; zuFase = bew.zuf; zvVoorReset = bew.zvv; zvFase = bew.zvf;
    weg();
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testMeetveldenV113812 = testMeetveldenV113812;
