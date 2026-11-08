// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nano_grenzen.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.33: de vaste scoregrenzen volgen het geladen hoofdmodel.
//
//  NG1  de tabel: de YOLOv8-waarden zijn de oude, Nano zoals gemeten, en
//       zonder geladen model gelden de YOLOv8-waarden
//  NG2  de leerpoort van slaOp (eerste meting van een nieuw licht)
//  NG3  de minuutstatistiek 'sterk'
//  NG4  groen-instort: 'was stabiel'
//  NG5  de afkeurreden van de detlog volgt de basisdrempels van het model
//  NG6  bronregels: elke grens loopt via hoofdGrens, geen vaste waarde meer
//
//  DRAAIEN: zoals de andere toetsen; testNanoGrenzen().
// ═══════════════════════════════════════════════════════════════
async function testNanoGrenzen() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const N = 9603301, soortBew = hoofdSoort, misBew = window.logOpslagMis;
  const met = (soort, f) => { hoofdSoort = soort; try { return f(); } finally { hoofdSoort = soortBew; } };
  const weg = () => Object.keys(localStorage).filter(k => k.indexOf(String(N)) >= 0).forEach(k => localStorage.removeItem(k));
  try {
    // ═══ NG1 ═══
    const v8 = { leer: 0.20, s2Fam: 0.35, sterk: 0.35, fscore: 0.35, groenStabiel: 0.40, s2Aanwezig: 0.50, tfTwijfelS2: 0.55, s1Twijfel: 0.60, camNode: 0.60 };
    const nano = { leer: 0.07, s2Fam: 0.15, sterk: 0.15, fscore: 0.15, groenStabiel: 0.10, s2Aanwezig: 0.70, tfTwijfelS2: 0.75, s1Twijfel: 0.75, camNode: 0.75 };
    const namen = Object.keys(v8);
    eis('NG1a YOLOv8 houdt de oude grenzen', namen.every(k => met('yolov8', () => hoofdGrens(k)) === v8[k]), kort(v8), kort(namen.map(k => met('yolov8', () => hoofdGrens(k)))));
    eis('NG1b Nano krijgt de gemeten grenzen', namen.every(k => met('yolox', () => hoofdGrens(k)) === nano[k]), kort(nano), kort(namen.map(k => met('yolox', () => hoofdGrens(k)))));
    eis('NG1c zonder geladen model gelden de YOLOv8-waarden', namen.every(k => met(null, () => hoofdGrens(k)) === v8[k]), 'YOLOv8', kort(namen.map(k => met(null, () => hoofdGrens(k)))));
    eis('NG1d de tabel is volledig (9 grenzen)', Object.keys(SCORE_GRENS).length === 9 && Object.keys(SCORE_GRENS).every(k => k in v8), '9', Object.keys(SCORE_GRENS).length);

    // ═══ NG2 ═══
    const mis = []; window.logOpslagMis = (r) => { mis.push(r); };
    const leer = (soort, conf) => { mis.length = 0; weg(); met(soort, () => slaOp(N, 'rechtdoor', 30, conf, true)); return mis.includes('nieuw_lage_conf'); };
    const bewFs = faseStart; faseStart = null;
    eis('NG2a YOLOv8: 0,10 is te laag voor een nieuw licht', leer('yolov8', 0.10) === true, 'geweigerd', kort(mis));
    eis('NG2b Nano: 0,10 mag (grens 0,07)', leer('yolox', 0.10) === false, 'niet geweigerd', kort(mis));
    eis('NG2c Nano: 0,05 is te laag', leer('yolox', 0.05) === true, 'geweigerd', kort(mis));
    faseStart = bewFs; window.logOpslagMis = misBew; weg();

    // ═══ NG3 ═══
    const bewMin = minStat; const det = [{ klasse: 0, score: 0.2, alleScores: [0.2, 0, 0, 0] }];
    const sterk = (soort) => { minStat = null; met(soort, () => minStatRun(100, det)); const s = minStat ? Object.values(minStat.s).reduce((a, b) => a + b, 0) : -1; return s; };
    eis('NG3a YOLOv8: 0,20 telt niet als sterk', sterk('yolov8') === 0, 0, sterk('yolov8'));
    eis('NG3b Nano: 0,20 telt als sterk', sterk('yolox') === 1, 1, sterk('yolox'));
    minStat = bewMin;

    // ═══ NG4 ═══
    const bewG = { h: greenConfHistory, t: oranjeCollapseTrigger, tijd: oranjeCollapseTijd, b: oranjeCollapseBuffer, tf: trainframesAan, of: orangeFocusActief, n: orangeFramesTeller };
    trainframesAan = true; orangeFocusActief = true; orangeFramesTeller = 0;   // de functie werkt alleen tijdens het verzamelen van trainframes
    const stabiel = (soort) => { greenConfHistory = [0.2, 0.2]; oranjeCollapseTrigger = false; met(soort, () => verwerkGreenCollapse([], 0.2)); const u = oranjeCollapseTrigger; oranjeCollapseTrigger = false; return u; };
    eis('NG4a YOLOv8: groen gemiddeld 0,20 was niet stabiel', stabiel('yolov8') === false, false, stabiel('yolov8'));
    eis('NG4b Nano: groen gemiddeld 0,20 was stabiel (grens 0,10)', stabiel('yolox') === true, true, stabiel('yolox'));
    trainframesAan = bewG.tf; orangeFocusActief = bewG.of; orangeFramesTeller = bewG.n; greenConfHistory = bewG.h; oranjeCollapseTrigger = bewG.t; oranjeCollapseTijd = bewG.tijd; oranjeCollapseBuffer = bewG.b;

    // ═══ NG5 ═══
    const b = { tap: false, cy: 100, maxY: 0.75, h: 20, w: 10 }, bt = { tap: true, cy: 100, maxY: 0.75, h: 20, w: 10 };
    eis('NG5a detlog buiten de tikzone: 0,08 is voor YOLOv8 conf, voor Nano niet', met('yolov8', () => detLogAfwijsFilter(b, 0.08)) === 'conf' && met('yolox', () => detLogAfwijsFilter(b, 0.08)) !== 'conf', 'conf / anders', [met('yolov8', () => detLogAfwijsFilter(b, 0.08)), met('yolox', () => detLogAfwijsFilter(b, 0.08))].join(' / '));
    eis('NG5b detlog in de tikzone: 0,035 is voor YOLOv8 conf_tik, voor Nano niet', met('yolov8', () => detLogAfwijsFilter(bt, 0.035)) === 'conf_tik' && met('yolox', () => detLogAfwijsFilter(bt, 0.035)) !== 'conf_tik', 'conf_tik / anders', [met('yolov8', () => detLogAfwijsFilter(bt, 0.035)), met('yolox', () => detLogAfwijsFilter(bt, 0.035))].join(' / '));

    // ═══ NG6 ═══
    const bron = (await (await fetch('index.html', { cache: 'no-store' })).text()).split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
    const oud = [/familieScore\(bbox\) < 0\.35/, /bbox\.score >= 0\.50/, /bbox\.score < 0\.55/, /aiR\.score < 0\.60/, /gesmoothedScore >= 0\.60/, /conf < 0\.20/, />= FSCORE_OVERRIDE_DREMPEL/, /> GREEN_STABIEL_DREMPEL/, /familieScore\(d\) >= MINUUT_STERK/];
    const over = oud.filter(r => r.test(bron)).map(String);
    eis('NG6a geen vaste modelgrens meer in de code', over.length === 0, 'geen', kort(over));
    const aanroep = namen.filter(k => bron.indexOf("hoofdGrens('" + k + "')") >= 0);
    eis('NG6b alle 9 grenzen worden gebruikt', aanroep.length === 9, 9, kort(aanroep));
  } catch (e) {
    eis('NG crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    hoofdSoort = soortBew; window.logOpslagMis = misBew; weg();
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}
