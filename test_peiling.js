// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_peiling.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.76: de twee nieuwe logvelden-helpers.
//
//  WAAROM DIT BESTAND BESTAAT
//  Deze release voegt alleen diagnostiek toe, maar diagnostiek die fout meet is
//  erger dan geen diagnostiek — er komt een vervolgbeslissing over de
//  scorefunctie op te rusten. Twee dingen moeten daarom vastliggen:
//
//  T3 is de belangrijkste. index.html bevat TWEE peilingsformules: de correcte
//  sferische (vindDichtbijScore r8188, checkNodeCorrectieStilstand) en een
//  vereenvoudigde in isStoplichtVoorbij die de cos(breedtegraad)-correctie op de
//  lengtecomponent mist. Op 52° NB scheelt dat tot ~13°. peilingTovRijrichting
//  MOET de eerste volgen; T3 zet een node op exact 45° en laat de test omvallen
//  zodra iemand de goedkope variant kopieert.
//
//  T7/T8 bewaken de memo van dichtstbijzijndeBuur. Die memo is per osmCache
//  geldig; wordt hij niet gewist bij een nieuwe kaartdownload, dan draagt het
//  log stilletjes buurafstanden van een vorige stad mee.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_peiling.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testPeiling().regels);
// ═══════════════════════════════════════════════════════════════

function testPeiling() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const LAT = 52.0, LON = 5.0;
  const pos = { lat: LAT, lon: LON };
  // meters -> graden op deze breedte
  const M_LAT = 1 / 111320;
  const M_LON = 1 / (111320 * Math.cos(LAT * Math.PI / 180));
  const nodeOp = (noord, oost, id) => ({ id: id || 'X', lat: LAT + noord * M_LAT, lon: LON + oost * M_LON });

  const bewaardCache = osmCache;
  const bewaardMemo  = buurNodeMemo;
  const bewaardPos   = huidigePos;
  const bewaardRicht = huidigeRichting;
  const bewaardDicht = dichtstbijOSM;
  const bewaardPuur  = puurDichtsteNodeCache;
  const bewaardLog   = localStorage.getItem('sl_opslaglog');

  try {
    // ══ T1/T2 — de gesigneerde conventie ═══════════════════════
    // 0 = recht vooruit, + = rechts, - = links, ±180 = pal achter.
    const noord = nodeOp(100, 0);
    eis('T1 node recht vooruit bij heading N -> 0 graden',
        peilingTovRijrichting(pos, noord, 0) === 0,
        '0', String(peilingTovRijrichting(pos, noord, 0)));
    eis('T1b dezelfde node bij heading O ligt LINKS -> -90',
        peilingTovRijrichting(pos, noord, 90) === -90,
        '-90', String(peilingTovRijrichting(pos, noord, 90)));
    eis('T1c bij heading W ligt hij RECHTS -> +90',
        peilingTovRijrichting(pos, noord, 270) === 90,
        '90', String(peilingTovRijrichting(pos, noord, 270)));
    const achter = Math.abs(peilingTovRijrichting(pos, noord, 180));
    eis('T2 node pal achter -> ±180 (dit is het teken dat "gepasseerd" betekent)',
        achter === 180, '180', String(peilingTovRijrichting(pos, noord, 180)));

    const oost = nodeOp(0, 100);
    eis('T2b node pal rechts bij heading N -> +90',
        peilingTovRijrichting(pos, oost, 0) === 90,
        '90', String(peilingTovRijrichting(pos, oost, 0)));

    // ══ T3 — DE cos(breedtegraad)-CORRECTIE ════════════════════
    // Node op exact gelijke afstand noord en oost in METERS: ware peiling 45°.
    // De vereenvoudigde formule uit isStoplichtVoorbij rekent atan2 op GRADEN
    // en komt op 52° NB uit rond 58°.
    const noordoost = nodeOp(100, 100);
    const p45 = peilingTovRijrichting(pos, noordoost, 0);
    const naief = Math.round(Math.atan2(noordoost.lon - LON, noordoost.lat - LAT) * 180 / Math.PI);
    eis('T3 45-graden-node levert ~45, niet de naieve ~58',
        Math.abs(p45 - 45) <= 1,
        '45 (±1)', p45 + '   [naieve formule zou ' + naief + ' geven]');
    eis('T3b de naieve formule wijkt hier ook echt af — anders toetst T3 niets',
        Math.abs(naief - 45) > 10,
        'naief >10 graden ernaast', 'naief = ' + naief);

    // ══ T4 — guards ════════════════════════════════════════════
    eis('T4 zonder heading geen verzonnen peiling',
        peilingTovRijrichting(pos, noord, null) === null,
        'null', String(peilingTovRijrichting(pos, noord, null)));
    eis('T4b zonder node null',
        peilingTovRijrichting(pos, null, 0) === null,
        'null', String(peilingTovRijrichting(pos, null, 0)));
    eis('T4c node zonder lat/lon null (niet NaN)',
        peilingTovRijrichting(pos, { id: 'leeg' }, 0) === null,
        'null', String(peilingTovRijrichting(pos, { id: 'leeg' }, 0)));

    // ══ T5-T8 — dichtstbijzijndeBuur ═══════════════════════════
    const A = nodeOp(0, 0, '900001');
    const B = nodeOp(12, 0, '900002');    // 12m van A
    const C = nodeOp(0, 40, '900003');    // 40m van A
    osmCache = [A, B, C];
    buurNodeMemo = new Map();

    const bA = dichtstbijzijndeBuur(A);
    eis('T5 dichtstbijzijnde buur van A is B op ~12m',
        bA && bA.id === '900002' && Math.abs(bA.af - 12) < 1,
        'B op 12m', bA ? (bA.id + ' op ' + bA.af.toFixed(1) + 'm') : 'null');
    eis('T5b een node telt zichzelf niet mee als buur',
        bA && bA.id !== '900001', 'niet 900001', bA ? bA.id : 'null');
    // Vanuit C is A (40m) net iets dichterbij dan B (hypot(12,40) = 41,8m).
    // Dat kleine verschil is bewust: het toetst dat de lus het echte minimum
    // pakt en niet de eerste de beste kandidaat uit osmCache.
    const bC = dichtstbijzijndeBuur(C);
    eis('T5c vanuit C wint A (40m) nipt van B (41,8m) — echt minimum, niet de eerste',
        bC && bC.id === '900001' && Math.abs(bC.af - 40) < 1,
        'A op 40m (B ligt op ' + Math.hypot(12, 40).toFixed(1) + 'm)',
        bC ? (bC.id + ' op ' + bC.af.toFixed(1) + 'm') : 'null');

    eis('T6 losse node zonder buren -> null, geen Infinity',
        (() => { osmCache = [A]; buurNodeMemo = new Map();
                 const r = dichtstbijzijndeBuur(A); return r === null; })(),
        'null', String(dichtstbijzijndeBuur(A)));

    // ══ T7/T8 — de memo ════════════════════════════════════════
    osmCache = [A, B, C];
    buurNodeMemo = new Map();
    const eerste = dichtstbijzijndeBuur(A);
    const tweede = dichtstbijzijndeBuur(A);
    eis('T7 tweede aanroep komt uit de memo (zelfde object, geen herberekening)',
        eerste === tweede && buurNodeMemo.size === 1,
        'identiek object, memo-omvang 1',
        (eerste === tweede) + ', memo=' + buurNodeMemo.size);

    // Nieuwe kaart: B ligt er niet meer in. Zonder wissen blijft de memo 12m
    // beweren terwijl de echte buur nu 40m weg is.
    osmCache = [A, C];
    const zonderWissen = dichtstbijzijndeBuur(A);
    buurNodeMemo.clear();
    const naWissen = dichtstbijzijndeBuur(A);
    eis('T8 memo wissen is noodzakelijk: zonder wissen blijft de oude buur staan',
        Math.abs(zonderWissen.af - 12) < 1 && Math.abs(naWissen.af - 40) < 1,
        'zonder wissen 12m, na wissen 40m',
        'zonder=' + zonderWissen.af.toFixed(1) + 'm, na=' + naWissen.af.toFixed(1) + 'm');

    // ══ T9-T11 — de velden landen echt in het log ══════════════
    osmCache = [A, B, C];
    buurNodeMemo = new Map();
    localStorage.removeItem('sl_opslaglog');
    huidigePos = pos;
    huidigeRichting = 0;
    dichtstbijOSM = { ...A, afstand: 0 };
    puurDichtsteNodeCache = { ...B, afstand: 12 };
    logOpslagMis('ok', {});
    let rec = null;
    try { rec = (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).slice(-1)[0] || null; } catch (e) {}

    eis('T9 alle zeven nieuwe velden staan in het record',
        rec && ['hdg','peilGek','peilDicht','closestId','buurAf','buurNode','alt20']
          .every(k => k in rec),
        'hdg, peilGek, peilDicht, closestId, buurAf, buurNode, alt20',
        rec ? Object.keys(rec).filter(k => ['hdg','peilGek','peilDicht','closestId','buurAf','buurNode','alt20'].includes(k)).join(',') : 'GEEN RECORD');
    eis('T9b closestId noemt nu WELKE node de dichtstbijzijnde was',
        rec && rec.closestId === '900002' && rec.closestAf === 12,
        "closestId '900002', closestAf 12",
        rec ? (rec.closestId + ' / ' + rec.closestAf) : '-');
    eis('T9c de peiling naar de dichtstbijzijnde (12m noord, heading N) is 0',
        rec && rec.peilDicht === 0, '0', rec ? String(rec.peilDicht) : '-');
    eis('T10 buurafstand en alt20 beschrijven de GEKOZEN node',
        rec && rec.buurNode === '900002' && rec.buurAf === 12 && rec.alt20 === true,
        "buurNode '900002', buurAf 12, alt20 true",
        rec ? (rec.buurNode + ' / ' + rec.buurAf + ' / ' + rec.alt20) : '-');

    // alt20 moet ook FALSE kunnen worden — anders is het veld waardeloos
    osmCache = [A, C];
    buurNodeMemo = new Map();
    dichtstbijOSM = { ...A, afstand: 0 };
    logOpslagMis('ok', {});
    let rec2 = null;
    try { rec2 = (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).slice(-1)[0] || null; } catch (e) {}
    eis('T10b met de buur op 40m wordt alt20 false',
        rec2 && rec2.alt20 === false && rec2.buurAf === 40,
        'alt20 false, buurAf 40',
        rec2 ? (rec2.alt20 + ' / ' + rec2.buurAf) : '-');

    // ══ T11 — bestaande velden ongemoeid ═══════════════════════
    eis('T11 de bestaande velden staan er nog steeds allemaal in',
        rec && ['t','reden','node','naam','afst','closestAf','dur','kmh','dd',
                'twijfel','hand','autoLock','dw','tik','lockNode','pre','nieuw',
                'aanrij','afrij'].every(k => k in rec),
        'alle 19 bestaande velden',
        rec ? ['t','reden','node','naam','afst','closestAf','dur','kmh','dd','twijfel','hand','autoLock','dw','tik','lockNode','pre','nieuw','aanrij','afrij'].filter(k => !(k in rec)).join(',') || 'compleet' : '-');
    eis('T11b naam wordt nog steeds uit osmCache gehaald (logNode-refactor intact)',
        rec && rec.node === '900001',
        "node '900001'", rec ? String(rec.node) : '-');

  } finally {
    osmCache = bewaardCache;
    buurNodeMemo = bewaardMemo;
    huidigePos = bewaardPos;
    huidigeRichting = bewaardRicht;
    dichtstbijOSM = bewaardDicht;
    puurDichtsteNodeCache = bewaardPuur;
    if (bewaardLog === null) localStorage.removeItem('sl_opslaglog');
    else localStorage.setItem('sl_opslaglog', bewaardLog);
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testPeiling = testPeiling;
