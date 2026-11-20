// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_kortrood_log.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.37.41: een "volledig" rood (de overgang gezien) korter dan
//  10 s geeft één regel in sl_conflog, met de kleur ervoor, het licht, de
//  gevolgde lamp, de snelheid en de tijd. Alleen meten: wat er in de emmer
//  wordt opgeslagen, verandert niet.
//
//  KR1  volledig rood van 6 s via slaOp: één regel kr 1 met t, duur, vk, node, box, kmh
//  KR2  volledig rood van 12 s: geen regel
//  KR3  resttijd (overgang niet gezien) van 6 s, en onbekend: geen regel
//  KR4  de emmer krijgt precies dezelfde records als zonder de logregel
//  KR5  de ring blijft 50, en een kapotte opslag geeft geen fout
//
//  DRAAIEN: zoals de andere toetsen; testKortroodLog().
// ═══════════════════════════════════════════════════════════════
function testKortroodLog() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const N = 9604101;
  const weg = () => Object.keys(localStorage).filter(k => k.indexOf(String(N)) >= 0).forEach(k => localStorage.removeItem(k));
  const bewLog = localStorage.getItem('sl_conflog'), bewMem = klasseVerdelingLog.length;
  const bewFs = faseStart, bewVk = vorigeFaseVoorRood, bewKmh = snelheidKmh, bewSt = stickyDetectie, bewKr = window.kortRoodLog;
  const log = () => { try { return JSON.parse(localStorage.getItem('sl_conflog') || '[]'); } catch (e) { return []; } };
  const nieuw = (voor) => log().slice(voor).filter(r => r && r.kr === 1);
  try {
    faseStart = null; vorigeFaseVoorRood = 'groen'; snelheidKmh = 14.4;
    stickyDetectie = { cx: 321.4, cy: 118.6, klasse: 'rood', bron: 'auto', tijd: Date.now() };
    weg(); localStorage.setItem('sl_conflog', '[]');
    slaOp(N, 'rechtdoor', 6, null, true, null, null, true);
    const r1 = nieuw(0);
    eis('KR1 volledig rood van 6 s: één regel met kleur ervoor, licht, lamp, snelheid en tijd',
      r1.length === 1 && r1[0].duur === 6 && r1[0].vk === 'groen' && r1[0].node === String(N) && r1[0].kmh === 14
        && r1[0].box === '321,119,auto,rood' && Math.abs(r1[0].t - Date.now()) < 5000,
      '1 regel, 6 s, groen, 14 km/u', kort(r1));
    localStorage.setItem('sl_conflog', '[]');
    slaOp(N, 'rechtdoor', 12, null, true, null, null, true);
    eis('KR2 volledig rood van 12 s: geen regel', nieuw(0).length === 0, '0', kort(log()));
    slaOp(N, 'rechtdoor', 6, null, true, null, null, false);
    slaOp(N, 'rechtdoor', 6, null, true, null, null, null);
    eis('KR3 resttijd en onbekend van 6 s: geen regel', nieuw(0).length === 0, '0', kort(log()));
    // KR4: dezelfde schrijving met en zonder de logregel
    const emmer = () => Object.keys(localStorage).filter(k => k.indexOf(String(N)) >= 0 && /^sl_v[34]_/.test(k)).sort()
      .map(k => k + '=' + kort((JSON.parse(localStorage.getItem(k)) || []).map(x => Object.assign({}, x, { tijd: 0 }))));
    weg(); slaOp(N, 'rechtdoor', 6, null, true, null, null, true); const met = emmer();
    weg(); window.kortRoodLog = () => false; slaOp(N, 'rechtdoor', 6, null, true, null, null, true); const zonder = emmer(); window.kortRoodLog = bewKr;
    eis('KR4 de emmer krijgt dezelfde records als zonder de logregel', met.length > 0 && met.join('|') === zonder.join('|'), kort(zonder), kort(met));
    const so = String(slaOp).split('\n').filter(l => /V11\.37\.41(?!\d)|V11\.38\.3(?!\d)/.test(l));
    eis('KR4b slaOp kreeg alleen de ene aanroep erbij', so.length === 1 && /kortRoodLog\(osmId, duur, zagOvergang\)/.test(so[0]), '1 regel', kort(so));
    // KR5
    localStorage.setItem('sl_conflog', JSON.stringify(Array.from({ length: 50 }, (_, i) => ({ t: i }))));
    kortRoodLog(N, 5, true);
    const l5 = log();
    const okRing = l5.length === 50 && l5[49].kr === 1 && l5[0].t === 1;
    localStorage.setItem('sl_conflog', '{kapot');
    let fout = null; try { kortRoodLog(N, 5, true); } catch (e) { fout = e; }
    eis('KR5 de ring blijft 50 en een kapotte opslag geeft geen fout', okRing && fout === null && log().length === 1, '50, geen fout', kort({ n: l5.length, fout: String(fout) }));
  } catch (e) {
    eis('KR crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    window.kortRoodLog = bewKr; faseStart = bewFs; vorigeFaseVoorRood = bewVk; snelheidKmh = bewKmh; stickyDetectie = bewSt;
    weg();
    try { if (bewLog === null) localStorage.removeItem('sl_conflog'); else localStorage.setItem('sl_conflog', bewLog); } catch (e) {}
    klasseVerdelingLog.length = Math.min(klasseVerdelingLog.length, bewMem);
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testKortroodLog = testKortroodLog;
