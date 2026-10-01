// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tiklog_budget.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.36.2: het tikoverzicht (sl_tiklog) houdt twee budgetten bij,
//  60 regels voor tik, los en de telling per tik ('tel'), en 40 voor de overige
//  run-regels. Punt 9 uit de opslag-STAP 0 van 30 september: in die export
//  waren 75 van de 100 regels run-regels, en van de rit van 16:28 stond geen
//  enkele tik meer in het log.
//
//  TK1  de budgetten: 60 + 40 = TIKLOG_MAX (100)
//  TK2  elk budget houdt zijn eigen nieuwste regels, in de volgorde van de tijd,
//       ook als de ring samen onder TIKLOG_MAX blijft
//  TK3  het veldgeval: een eerdere rit met vijf tikken blijft zichtbaar naast
//       een rit met twaalf tikken (tot en met V11.36.1: weggedrukt)
//  TK4  een ring uit een eerdere versie komt bij de eerste schrijving op budget
//  TK5  een 'tel'-regel telt als kern en overleeft honderd run-regels
//  TK6  de grootte blijft rond wat de ring al kostte
//  TK7  tikLogBudget is zuiver: schrijft niets, beslist niets, geeft bij een
//       ring binnen budget hetzelfde object terug
//  TK8  ALLEEN METEN: zonder de V11.36.2-regel is tikLogNoteer byte-gelijk aan
//       V11.32.0; de andere tiklogfuncties zijn onaangeroerd
// ═══════════════════════════════════════════════════════════════

async function testTiklogBudget() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const ring = () => { try { return JSON.parse(localStorage.getItem(TIKLOG_SLEUTEL)) || []; } catch (e) { return []; } };
  const bew = { ls: localStorage.getItem(TIKLOG_SLEUTEL), arr: tikLogArr, stop: tikLogStop, vorige: tikLogVorige,
                dicht: dichtstbijOSM, kmh: snelheidKmh, nu: Date.now };
  const leeg = () => { localStorage.removeItem(TIKLOG_SLEUTEL); tikLogArr = null; tikLogStop = false; tikLogVorige = { tak: null, t: 0 }; };
  let klok = 1790800000000;

  // Eén tik zoals het veld hem schrijft: tik, de run-regels, los, en de telling.
  const tik = (rit, i, runs) => {
    tikLogNoteer('tik', { pad: 'A', cx: 1000 + i, cy: 900, n: 2, snap: 1, rand: 40, dCam: 12, dMin: 12, mis: 0, st: 0, vol: 0, sw: 393, sh: 852, rit, i });
    for (let r = 0; r < runs; r++) tikLogNoteer('run', { tak: r % 2 ? 'sprong' : 'leeg', skip: 0, sprong: 80, dCam: 30, rit, i });
    tikLogNoteer('los', { reden: 'nieuw', duur: 5000, gezien: 300, rit, i });
    tikLogNoteer('run', { tak: 'tel', m: 10, l: 5, z: 0, k: 1, d2: 90, rit, i });
  };

  try {
    Date.now = () => (klok += 1000);
    dichtstbijOSM = null; snelheidKmh = 0;

    // ═══ TK1 — de budgetten ═════════════════════════════════
    eis('TK1 kern 60 en ruis 40, samen TIKLOG_MAX',
        TIKLOG_KERN_MAX === 60 && TIKLOG_RUIS_MAX === 40 && TIKLOG_KERN_MAX + TIKLOG_RUIS_MAX === TIKLOG_MAX && TIKLOG_MAX === 100,
        '60 + 40 = 100', `${TIKLOG_KERN_MAX} + ${TIKLOG_RUIS_MAX} = ${TIKLOG_MAX}`);

    // ═══ TK2 — elk budget zijn eigen nieuwste ═══════════════
    leeg();
    for (let i = 0; i < 70; i++) tikLogNoteer('tik', { pad: 'A', n: i });
    for (let i = 0; i < 50; i++) tikLogNoteer('run', { tak: 'leeg', n: i });
    const r2 = ring();
    const k2 = r2.filter(tikLogIsKern), z2 = r2.filter(r => !tikLogIsKern(r));
    eis('TK2a 60 tikken en 40 run-regels, de oudste van elk weg',
        k2.length === 60 && z2.length === 40 && k2[0].n === 10 && z2[0].n === 10 && k2[59].n === 69 && z2[39].n === 49,
        '60 (10-69) / 40 (10-49)', `${k2.length} (${k2[0] && k2[0].n}-${k2[59] && k2[59].n}) / ${z2.length} (${z2[0] && z2[0].n}-${z2[39] && z2[39].n})`);
    eis('TK2b de volgorde is die van de tijd', r2.every((r, i) => i === 0 || r.t > r2[i - 1].t), 'oplopend', 'ok');

    // Een vol kernbudget begrenst zichzelf, ook als de ring samen onder de
    // TIKLOG_MAX blijft (de oude grens van 100 grijpt dan niet in).
    leeg();
    for (let i = 0; i < 80; i++) tikLogNoteer('tik', { pad: 'A', n: i });
    for (let i = 0; i < 5; i++) tikLogNoteer('run', { tak: 'leeg', n: i });
    const r2c = ring(), k2c = r2c.filter(tikLogIsKern);
    eis('TK2c 80 tikken en 5 run-regels: 60 tikken (de nieuwste) en 5 run-regels, samen 65',
        k2c.length === 60 && r2c.length === 65 && k2c[0].n === 20 && k2c[59].n === 79,
        '60 (20-79) + 5 = 65', `${k2c.length} (${k2c[0] && k2c[0].n}-${k2c[59] && k2c[59].n}) + ${r2c.length - k2c.length} = ${r2c.length}`);

    // ═══ TK3 — het veldgeval van 30 september ═══════════════
    // Eerst een rit met vijf tikken van vier run-regels, dan de rit van 18:21
    // met twaalf tikken en 1 tot 12 run-regels per tik (gemeten).
    leeg();
    const RIT2 = [4, 5, 1, 5, 6, 12, 4, 4, 2, 8, 1, 2];
    for (let i = 0; i < 5; i++) tik(1, i, 4);
    for (let i = 0; i < RIT2.length; i++) tik(2, i, RIT2[i]);
    const r3 = ring();
    const rit1 = r3.filter(r => r.s === 'tik' && r.rit === 1).length, rit2 = r3.filter(r => r.s === 'tik' && r.rit === 2).length;
    // Wat de ring van V11.36.1 had gehouden: de laatste 100 regels van dezelfde reeks.
    const reeks = [];
    const neem = (s, v) => reeks.push(Object.assign({ s }, v));
    for (let i = 0; i < 5; i++) { neem('tik', { rit: 1 }); for (let r = 0; r < 4; r++) neem('run', { tak: 'leeg', rit: 1 }); neem('los', { rit: 1 }); neem('run', { tak: 'tel', rit: 1 }); }
    for (let i = 0; i < RIT2.length; i++) { neem('tik', { rit: 2 }); for (let r = 0; r < RIT2[i]; r++) neem('run', { tak: 'leeg', rit: 2 }); neem('los', { rit: 2 }); neem('run', { tak: 'tel', rit: 2 }); }
    const oudRit1 = reeks.slice(-100).filter(r => r.s === 'tik' && r.rit === 1).length;
    eis('TK3a alle vijf tikken van de eerdere rit blijven zichtbaar, naast alle twaalf van de latere',
        rit1 === 5 && rit2 === 12 && oudRit1 < 5, `5 + 12 (V11.36.1: ${oudRit1} + 12)`, `${rit1} + ${rit2}`);
    eis('TK3b ... met bij elke tik zijn los- en tel-regel', r3.filter(r => r.s === 'los').length === 17 && r3.filter(r => r.tak === 'tel').length === 17,
        '17 los, 17 tel', `${r3.filter(r => r.s === 'los').length} los, ${r3.filter(r => r.tak === 'tel').length} tel`);
    eis('TK3c en de run-regels houden hun budget van 40, de nieuwste', r3.filter(r => !tikLogIsKern(r)).length === 40
          && r3.filter(r => !tikLogIsKern(r)).every(r => r.rit === 2),
        '40, allemaal van de laatste rit', String(r3.filter(r => !tikLogIsKern(r)).length));

    // ═══ TK4 — een ring uit een eerdere versie ══════════════
    leeg();
    localStorage.setItem(TIKLOG_SLEUTEL, JSON.stringify(Array.from({ length: 100 }, (_, i) => ({ t: 1790700000000 + i, s: 'run', tak: 'leeg', n: i }))));
    tikLogNoteer('tik', { pad: 'B', n: 999 });
    const r4 = ring();
    eis('TK4 een oude ring van 100 run-regels: na één tik 40 run-regels (de nieuwste) en de tik',
        r4.length === 41 && r4[0].n === 60 && r4[39].n === 99 && r4[40].s === 'tik',
        '41: 60-99 en de tik', `${r4.length}: ${r4[0] && r4[0].n}-${r4[39] && r4[39].n}, ${r4[40] && r4[40].s}`);

    // ═══ TK5 — een 'tel'-regel is kern ══════════════════════
    leeg();
    tikLogNoteer('run', { tak: 'tel', m: 3, l: 1, z: 0, k: 0 });
    for (let i = 0; i < 100; i++) tikLogNoteer('run', { tak: 'sprong', n: i });
    const r5 = ring();
    eis('TK5 de telling overleeft honderd run-regels', r5.length === 41 && r5.some(r => r.tak === 'tel' && r.m === 3),
        '41, tel staat er', `${r5.length}, ${r5.some(r => r.tak === 'tel') ? 'tel staat er' : 'tel WEG'}`);

    // ═══ TK6 — de grootte ═══════════════════════════════════
    leeg();
    for (let i = 0; i < 30; i++) tik(3, i, 3);
    const r6 = ring(), lengte6 = (localStorage.getItem(TIKLOG_SLEUTEL) || '').length;
    eis('TK6 beide budgetten vol met veldregels: onder de 12.000 tekens (op 30 september 8.476)',
        r6.length === 100 && lengte6 < 12000, '100 regels, < 12000', `${r6.length} regels, ${lengte6} tekens`);

    // ═══ TK7 — tikLogBudget is zuiver ═══════════════════════
    const binnen = [{ s: 'tik' }, { s: 'run', tak: 'leeg' }];
    const orig = Storage.prototype.setItem; let schrijf = 0;
    Storage.prototype.setItem = function (k, v) { schrijf++; return orig.call(this, k, v); };
    let uit7, uit7b;
    try {
      uit7 = tikLogBudget(binnen);
      uit7b = tikLogBudget(Array.from({ length: 50 }, () => ({ s: 'run', tak: 'x' })));
    } finally { Storage.prototype.setItem = orig; }
    eis('TK7a binnen budget: hetzelfde object terug; erboven: een kortere kopie; nooit een schrijving',
        uit7 === binnen && uit7b.length === 40 && schrijf === 0, 'zelfde / 40 / 0', `${uit7 === binnen} / ${uit7b.length} / ${schrijf}`);
    eis('TK7b tikLogBudget en tikLogIsKern raken geen tik-toestand',
        !/(bboxOverride|stickyDetectie|tapSeedDetectie|bboxSlot|tikLogArr|tikLogStop)\s*=[^=]/.test(zc(tikLogBudget) + zc(tikLogIsKern)),
        'geen toewijzing', 'ok');
    eis('TK7c een regel zonder soort of van een onbekend type telt als ruis, niet als kern',
        !tikLogIsKern(null) && !tikLogIsKern({}) && !tikLogIsKern({ s: 'run', tak: 'leeg' }) && tikLogIsKern({ s: 'run', tak: 'tel' }),
        'ruis', 'ok');

    // ═══ TK8 — alleen meten ═════════════════════════════════
    const zonder = String(tikLogNoteer).split('\n').filter(l => !/V11\.36\.2/.test(l)).join('\n');
    eis('TK8a tikLogNoteer zonder de budgetregel is byte-gelijk aan V11.32.0',
        fnv(zonder) === 'd9f96f8' && zonder.length === 1154, 'd9f96f8 / 1154', fnv(zonder) + ' / ' + zonder.length);
    const VAST = { tikLogRun: ['2f4dd880', 262], tikLogLos: ['790260fe', 342], tikLogTik: ['a0583a9c', 1522], tikTelAf: ['46e5462b', 216],
                   tikTelRun: ['3475f84', 550], tikLogWaak: ['25490478', 714], tikLogSprong: ['7eebe753', 303] };
    const afw = Object.entries(VAST).filter(([n, [h, l]]) => fnv(String(eval(n))) !== h || String(eval(n)).length !== l).map(x => x[0]);
    eis('TK8b de andere zeven tiklogfuncties zijn onaangeroerd', afw.length === 0, 'geen afwijking', afw.join(', ') || 'geen');
    eis('TK8c de budgetregel staat tussen push en de oude grens, die als vangnet blijft',
        /tikLogArr\.push\(rec\);\s*\n\s*tikLogArr = tikLogBudget\(tikLogArr\);[^\n]*\n\s*if \(tikLogArr\.length > TIKLOG_MAX\)/.test(String(tikLogNoteer)),
        'push, budget, grens', 'ok');

  } finally {
    Date.now = bew.nu;
    if (bew.ls === null) localStorage.removeItem(TIKLOG_SLEUTEL); else localStorage.setItem(TIKLOG_SLEUTEL, bew.ls);
    tikLogArr = bew.arr; tikLogStop = bew.stop; tikLogVorige = bew.vorige; dichtstbijOSM = bew.dicht; snelheidKmh = bew.kmh;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testTiklogBudget = testTiklogBudget;
