// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetvelden_v11384.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.4 (alleen meten):
//  zv  groen of oranje gezien vóór een blinde periode op hetzelfde licht, daarna rood
//      zonder de vlag: het V4-record en de m5-regel krijgen zv:1 en zg (de onderbreking, s).
//  weg een rode fase die door de minimumduur niet wordt opgeslagen: één regel in sl_wegroodlog.
//
//  MV1  uitval na groen, rood op hetzelfde licht: V4-record zo:0 + zv:1 + zg
//  MV2  geen zv bij: andere reden (wissel), rood vóór de uitval, ander licht, gat > 120 s,
//       vlag al gezien, en een volgende rode fase
//  MV3  m5Aanvul zet zv/zg alleen in de fase waarbij hij hoort
//  MV4  de emmer krijgt dezelfde records als zonder zv (op zv/zg na), zo blijft gelijk
//  MV5  slaOp weigert 3,5 s (onder de 4 s): één regel p:'s', dezelfde weigering, emmer leeg
//  MV6  wegRoodLog: velden, geen positie, geen dubbele regel, ring 200, kapotte opslag
//  MV7  de bron: de vlag-regel ongewijzigd; zvBijNieuwRood staat direct ná de vlag en vóór
//       `fase = nieuw`; zvZetStart na het continuïteitsherstel
//  MV8  de Meetdata-export neemt sl_wegroodlog mee onder `weg`
//  MV9  resetNeutraal noteert de stand vóór de blinde periode (zvNoteerReset) vóór het wissen
//
//  DRAAIEN: zoals de andere toetsen; testMeetveldenV11384().
// ═══════════════════════════════════════════════════════════════
function testMeetveldenV11384() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const N = 9604201, N2 = 9604202;
  const weg = () => Object.keys(localStorage).filter(k => k.indexOf(String(N)) >= 0 || k.indexOf(String(N2)) >= 0).forEach(k => localStorage.removeItem(k));
  const bew = { fase, faseStart, faseNodeId, ldt: laatsteDetectieTijd, zag: zagRoodOvergang, vk: vorigeFaseVoorRood,
                lgn: laatsteGroenNode, lgd: laatsteGroenDuur, zvv: zvVoorReset, zvf: zvFase, wl: wegRoodLaatst,
                log: localStorage.getItem(WEGROOD_SLEUTEL), aanvul: window.zvAanvul };
  const emmerRecs = () => { const uit = []; for (const dd of Object.keys(DD)) for (const r of (laadM(N, dd) || [])) uit.push(r); return uit; };
  const wegLog = () => { try { return JSON.parse(localStorage.getItem(WEGROOD_SLEUTEL) || '[]'); } catch (e) { return []; } };
  // Een uitval na `vorige` op licht `n`, `gatS` seconden geleden gezien; dan een nieuwe rode fase op `rood`.
  const scenario = (vorige, n, gatS, rood, reden, zag) => {
    fase = vorige; faseNodeId = n; laatsteDetectieTijd = Date.now() - gatS * 1000;
    zvNoteerReset(reden || 'dropout');
    fase = null; faseStart = null;
    zvBijNieuwRood(rood, null, !!zag);
    fase = 'rood'; faseStart = performance.now() - 20000; faseNodeId = rood;
    zvZetStart();
  };
  try {
    weg(); wegRoodLaatst = null;
    // MV1
    scenario('groen', N, 4, N);
    slaOp(N, 'rechtdoor', 20, null, true, null, null, false);
    const r1 = emmerRecs();
    eis('MV1 uitval na groen, rood op hetzelfde licht: het V4-record krijgt zo:0, zv:1 en zg',
      r1.length === 1 && r1[0].zo === 0 && r1[0].zv === 1 && r1[0].zg === 4, 'zo 0, zv 1, zg 4', kort(r1));
    // MV2
    const geenZv = [];
    for (const [naam, args] of [['wissel', ['groen', N, 4, N, 'wissel']], ['rood vooraf', ['rood', N, 4, N]],
                                ['ander licht', ['groen', N2, 4, N]], ['gat 121 s', ['oranje', N, 121, N]], ['vlag gezien', ['groen', N, 4, N, 'dropout', true]]]) {
      weg(); scenario(...args);
      slaOp(N, 'rechtdoor', 20, null, true, null, null, false);
      const r = emmerRecs();
      if (!(r.length === 1 && r[0].zv === undefined && r[0].zg === undefined)) geenZv.push(naam + ':' + kort(r));
    }
    weg(); scenario('oranje', N, 2, N);
    const okOranje = zvActief(N);
    faseStart = performance.now();   // een volgende rode fase (een andere faseStart)
    slaOp(N, 'rechtdoor', 20, null, true, null, null, false);
    const r2 = emmerRecs();
    eis('MV2 geen zv bij wissel, rood vooraf, ander licht, gat > 120 s, vlag gezien, of een volgende fase; wel na oranje',
      geenZv.length === 0 && okOranje && r2.length === 1 && r2[0].zv === undefined, 'geen zv', kort({ geenZv, okOranje, r2 }));
    // MV3
    scenario('groen', N, 7, N);
    const m = {}; m5Aanvul(m, N); const m2 = {}; m5Aanvul(m2, N2);
    eis('MV3 m5Aanvul zet zv/zg alleen bij het licht van de fase', m.zv === 1 && m.zg === 7 && m2.zv === undefined, 'zv 1 zg 7, ander licht niets', kort({ m, m2 }));
    // MV4
    const zonderTijd = (rs) => rs.map(x => { const o = Object.assign({}, x, { tijd: 0 }); delete o.zv; delete o.zg; return kort(o); }).join('|');
    weg(); scenario('groen', N, 3, N); slaOp(N, 'rechtdoor', 25, null, true, null, null, false); const met = emmerRecs();
    weg(); scenario('groen', N, 3, N); window.zvAanvul = () => {}; slaOp(N, 'rechtdoor', 25, null, true, null, null, false); window.zvAanvul = bew.aanvul; const zonder = emmerRecs();
    eis('MV4 de emmer krijgt dezelfde records als zonder zv (op zv/zg na); zo blijft 0',
      met.length === 1 && met[0].zv === 1 && zonder.length === 1 && zonder[0].zv === undefined && zonderTijd(met) === zonderTijd(zonder) && met[0].zo === 0,
      kort(zonder), kort(met));
    // MV5
    weg(); localStorage.setItem(WEGROOD_SLEUTEL, '[]'); wegRoodLaatst = null;
    vorigeFaseVoorRood = 'groen'; zagRoodOvergang = true; laatsteGroenNode = N; laatsteGroenDuur = 12.4;
    const uit5 = slaOp(N, 'rechtdoor', 3.5, null, true, null, null, true);
    const l5 = wegLog();
    eis('MV5 slaOp weigert 3,5 s zoals voorheen (false, emmer leeg) en schrijft één regel p:s',
      uit5 === false && emmerRecs().length === 0 && l5.length === 1 && l5[0].p === 's' && l5[0].d === 3.5 && l5[0].vk === 'g' && l5[0].bg === 1 && l5[0].gl === 12 && l5[0].n === N && l5[0].nw === undefined,
      'false, 0, 1 regel', kort({ uit5, l5 }));
    // MV6
    localStorage.setItem(WEGROOD_SLEUTEL, '[]'); wegRoodLaatst = null;
    vorigeFaseVoorRood = null; zagRoodOvergang = false; laatsteGroenNode = null; laatsteGroenDuur = 0;
    scenario('oranje', N, 3, N);
    wegRoodLog('f', N, 5.04, 'groen');
    wegRoodLog('f', N, 5.04, 'groen');   // dubbel: niet nog een keer
    const l6 = wegLog(), r6 = l6[0] || {};
    const sleutels = Object.keys(r6).sort().join(',');
    const ok6 = l6.length === 1 && r6.p === 'f' && r6.d === 5 && r6.vk === '-' && r6.bg === 0 && r6.gl === 0 && r6.nw === 'g' && r6.zv === 1 && r6.zg === 3
      && typeof r6.dd === 'string' && !/lat|lon|pos/i.test(sleutels);
    localStorage.setItem(WEGROOD_SLEUTEL, JSON.stringify(Array.from({ length: WEGROOD_MAX }, (_, i) => ({ t: i }))));
    wegRoodLog('f', N2, 6, 'groen');
    const l6b = wegLog();
    const okRing = l6b.length === WEGROOD_MAX && l6b[0].t === 1 && l6b[WEGROOD_MAX - 1].n === N2;
    localStorage.setItem(WEGROOD_SLEUTEL, '{kapot'); let fout = null;
    try { wegRoodLog('f', N, 7, 'groen'); } catch (e) { fout = e; }
    eis('MV6 wegRoodLog: velden, geen positie, geen dubbele regel, ring ' + WEGROOD_MAX + ', kapotte opslag zonder fout',
      ok6 && okRing && fout === null && wegLog().length === 1, sleutels, kort({ l6, n: l6b.length, fout: String(fout) }));
    // MV7
    const vf = String(verwerkFase);
    const iVlag = vf.indexOf("zagRoodOvergang = ((fase === 'groen' || fase === 'oranje') && faseNodeId === nodeId);");
    const iZv = vf.indexOf('zvBijNieuwRood(nodeId, fase, zagRoodOvergang)'), iFase = vf.indexOf('fase = nieuw; faseStart = nu;');
    const iHerstel = vf.indexOf('zhBijHerstel(laatsteFaseNodeId)'), iStart = vf.indexOf('zvZetStart()');
    const iWeg = vf.indexOf("wegRoodLog('f', nodeId, dur, nieuw)");
    const mv = vf.split('\n').filter(l => /V11\.38\.4(?!\d)/.test(l));
    eis('MV7 de vlag-regel ongewijzigd; zv na de vlag en vóór fase = nieuw; zvZetStart na het herstel; 3 regels V11.38.4',
      iVlag > 0 && iZv > iVlag && iFase > iZv && iStart > iHerstel && iWeg > 0 && iWeg < iZv && mv.length === 3,
      'volgorde vlag < zv < fase, herstel < start', kort({ iVlag, iZv, iFase, iHerstel, iStart, iWeg, n: mv.length }));
    // MV8
    const bron = String(exporteerMeetdata);
    eis('MV8 de Meetdata-export neemt sl_wegroodlog mee onder weg',
      /uit\.weg = \{\}/.test(bron) && /key === WEGROOD_SLEUTEL\)\s+doel = uit\.weg/.test(bron) && WEGROOD_SLEUTEL === 'sl_wegroodlog', 'uit.weg', kort(bron.length));
    // MV9
    const rn = String(resetNeutraal);
    const iZh = rn.indexOf('zhNoteerReset(reden)'), iZvR = rn.search(/^\s*zvNoteerReset\(reden\);/m), iWis = rn.indexOf('fase = null; faseStart = null;');
    eis('MV9 resetNeutraal roept zvNoteerReset(reden) aan, na zh en vóór het wissen van de fase',
      iZh > 0 && iZvR > iZh && iWis > iZvR, 'zh < zv < wissen', kort({ iZh, iZvR, iWis }));
  } catch (e) {
    eis('MV crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    window.zvAanvul = bew.aanvul;
    fase = bew.fase; faseStart = bew.faseStart; faseNodeId = bew.faseNodeId; laatsteDetectieTijd = bew.ldt; zagRoodOvergang = bew.zag;
    vorigeFaseVoorRood = bew.vk; laatsteGroenNode = bew.lgn; laatsteGroenDuur = bew.lgd; zvVoorReset = bew.zvv; zvFase = bew.zvf; wegRoodLaatst = bew.wl;
    weg();
    try { if (bew.log === null) localStorage.removeItem(WEGROOD_SLEUTEL); else localStorage.setItem(WEGROOD_SLEUTEL, bew.log); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testMeetveldenV11384 = testMeetveldenV11384;
