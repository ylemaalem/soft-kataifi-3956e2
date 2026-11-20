// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetregel_c4.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.3: meetregel C4 "tikloos detecteren". Alleen meten: extra
//  velden in sl_detlog en sl_passagelog, niets beslist er iets mee.
//
//  MC1  een gewone detlog-regel (50 m, rijdend) heeft de b-velden in camerapixels,
//       het midden van de gekozen box, ta/sa/dr/rt/ep
//  MC2  met een tik: ta 1 en de tikdrempel; zonder gekozen box geen cx/cy; hele beeld rt 'h'
//  MC3  het automatische slot: sa 1
//  MC4  stilstand: stil 1 en bx..bh in camerapixels (niet meer in YOLO-pixels)
//  MC5  geen kandidaat: bf 'geen' en geen score
//  MC6  passage: eerste box zonder tik, tikken met de afstand, eerste box na de tik
//  MC7  een passage die niet genaderd werd, geeft haar tik niet door aan de volgende
//  MC8  een passage zonder tik en zonder box heeft geen nieuwe velden
//  MC9  de echte tikLogTik telt de tik mee
//  MC10 de nieuwe velden staan in de Meetdata-export (MC10b: en in de Backup)
//  MC11 BYTE-GELIJK: 31 beslissende functies zijn ongewijzigd t.o.v. V11.38.2, en
//       detLogSchrijf, passageSchrijf en tikLogTik zonder de V11.38.3-regels ook
//  MC12 de meetfuncties lezen alleen: de beslissende toestand verandert niet
//  MC13 grootte: een volle detlog-regel blijft onder 420 tekens
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_meetregel_c4.js';
//      document.head.appendChild(s);
//      s.onload = () => testMeetregelC4().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════
async function testMeetregelC4() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const N = 990000000 + Math.floor(Math.random() * 999999);   // een vers licht-id per ronde
  const bew = {
    det: localStorage.getItem('sl_detlog'), pas: localStorage.getItem(PASSAGE_SLEUTEL), tik: localStorage.getItem(TIKLOG_SLEUTEL),
    detLogArr, detLogStop, detLogStilLaatst, detLogBest, debugLaatsteAlle, laatsteDetectiesStelsel, laatsteAI, bboxOverride, stickyDetectie,
    detLogRatio, detLogAfst, snelheidKmh, dichtstbijOSM, hoofdSoort, tikLogArr, tikLogStop, nu: Date.now, gestopt: meetRingGestopt.has(PASSAGE_SLEUTEL),
    vorige: passageStaat.vorige
  };
  const zetBasis = () => {
    localStorage.setItem('sl_detlog', '[]'); detLogArr = null; detLogStop = false; detLogStilLaatst = 0;
    hoofdSoort = 'yolox'; debugLaatsteAlle = null;
    laatsteDetectiesStelsel = { s: 0.5, px: 0, py: 80, x: 1000, y: 500 };
    detLogBest = { s: 0.05, k: 0, cx: 330, cy: 200, w: 10, h: 24, maxY: 0.75, tap: false };
    laatsteAI = { kleur: 'rood', box: { x: 1600, y: 900, w: 20, h: 48, kleur: 'rood', klasse: 0 } };
    bboxOverride = null; stickyDetectie = null; detLogRatio = 0.4;
    dichtstbijOSM = { id: N, lat: 52.0, lon: 5.0, afstand: 50 };
    detLogAfst = 50; snelheidKmh = 30;
    passageC4.clear();
  };
  try {
    // ═══ MC1 — een gewone regel ═══════════════════════════════
    zetBasis(); detLogSchrijf();
    const r1 = lees('sl_detlog')[0] || {};
    eis('MC1 gewone regel op 50 m: b-velden in camerapixels, midden van de gekozen box, ta 0, sa 0, dr 0,07 (Nano), rt u, ep w',
      r1.bs === 0.05 && r1.bk === 0 && r1.bfam === 0.05 && r1.bf === 'conf' && r1.bt === 0
        && r1.bx === 1660 && r1.by === 740 && r1.bw === 20 && r1.bh === 48 && r1.cx === 1610 && r1.cy === 924
        && r1.ta === 0 && r1.sa === 0 && r1.dr === 0.07 && r1.rt === 'u' && r1.ep === 'w' && r1.stil === undefined && r1.afst === 50,
      'bx 1660 by 740 bw 20 bh 48 cx 1610 cy 924', JSON.stringify(r1));
    const e1 = passageC4.get(N) || {};
    eis('MC1b dezelfde run zet de eerste box zonder tik voor dit licht (b0 op 50 m)', e1.b0a === 50 && e1.b0t > 0 && e1.b1t === undefined, 'b0a 50', JSON.stringify(e1));

    // ═══ MC2 — met een tik, zonder gekozen box, hele beeld ══════
    zetBasis(); bboxOverride = { cx: 330, cy: 200 }; laatsteAI = null; detLogRatio = null;
    detLogBest = { s: 0.05, k: 0, cx: 330, cy: 200, w: 10, h: 24, maxY: 0.75, tap: true };
    detLogSchrijf();
    const r2 = lees('sl_detlog')[0] || {};
    eis('MC2 met een tik: ta 1, dr 0,03, bt 1, bf door (boven de tikdrempel); geen cx/cy zonder box; rt h',
      r2.ta === 1 && r2.dr === 0.03 && r2.bt === 1 && r2.bf === 'door' && r2.cx === undefined && r2.cy === undefined && r2.rt === 'h',
      'ta 1 dr 0.03 rt h', JSON.stringify(r2));

    // ═══ MC3 — het automatische slot ═══════════════════════════
    zetBasis(); stickyDetectie = { bron: 'auto', cx: 330, cy: 200 };
    detLogSchrijf();
    const r3 = lees('sl_detlog')[0] || {};
    eis('MC3 automatisch slot: sa 1, ta 0', r3.sa === 1 && r3.ta === 0, 'sa 1', JSON.stringify({ sa: r3.sa, ta: r3.ta }));

    // ═══ MC4 — stilstand: camerapixels ═══════════════════════
    zetBasis(); detLogAfst = 5; snelheidKmh = 0; dichtstbijOSM = { id: N, lat: 52.0, lon: 5.0, afstand: 5 };
    detLogSchrijf();
    const r4 = lees('sl_detlog')[0] || {};
    eis('MC4 stilstand: stil 1, bx..bh in camerapixels (1660/740/20/48), ep w',
      r4.stil === 1 && r4.bx === 1660 && r4.by === 740 && r4.bw === 20 && r4.bh === 48 && r4.ep === 'w', 'stil 1, camerapixels', JSON.stringify(r4));

    // ═══ MC5 — geen kandidaat ═══════════════════════════════
    zetBasis(); detLogBest = null; laatsteAI = null;
    detLogSchrijf();
    const r5 = lees('sl_detlog')[0] || {};
    eis('MC5 geen kandidaat: bf geen, geen bs/bx/cx', r5.bf === 'geen' && r5.bs === undefined && r5.bx === undefined && r5.cx === undefined && r5.ep === 'w',
      'bf geen', JSON.stringify(r5));

    // ═══ MC6 — passage met box, tik, box ═══════════════════════
    passageC4.clear(); meetRingGestopt.delete(PASSAGE_SLEUTEL); localStorage.setItem(PASSAGE_SLEUTEL, '[]');
    let klok = 1800000000000; Date.now = () => klok;
    bboxOverride = null; laatsteAI = { box: { x: 1, y: 1, w: 2, h: 2 } };
    dichtstbijOSM = { id: N, lat: 52.0, lon: 5.0, afstand: 120 };
    const tStart = klok - 4000;
    passageBoxRun();                                  // eerste box zonder tik op 120 m, 4 s na het begin
    klok += 1000; dichtstbijOSM.afstand = 110; passageBoxRun();   // tweede box: verandert niets
    klok += 2000; dichtstbijOSM.afstand = 80; passageMerkTik();   // tik op 80 m
    bboxOverride = { cx: 1, cy: 1 };
    klok += 1000; dichtstbijOSM.afstand = 70; passageBoxRun();    // eerste box na de tik op 70 m, 8 s na het begin
    klok += 1000; passageMerkTik();                                // tweede tik
    passageSchrijf({ t: tStart, n: N, lat: 52.0, lon: 5.0, ma: 10, w: 0, laatst: klok, c1: 'r', d1: 60 });
    const p6 = lees(PASSAGE_SLEUTEL).slice(-1)[0] || {};
    eis('MC6 passage: tk 2, tka 80, b0a 120 op 4 s, b1a 70 op 8 s; de oude velden blijven',
      p6.n === N && p6.tk === 2 && p6.tka === 80 && p6.b0a === 120 && p6.b0s === 4 && p6.b1a === 70 && p6.b1s === 8 && p6.d1 === 60 && p6.c1 === 'r'
        && p6.lat === undefined && p6.lon === undefined && !passageC4.has(N),
      'tk 2 tka 80 b0 120/4 b1 70/8, geen positie', JSON.stringify(p6));

    // ═══ MC7 — niet genaderd: niets doorgeven ═══════════════════
    passageC4.clear(); bboxOverride = null; laatsteAI = null; dichtstbijOSM = { id: N, lat: 52.0, lon: 5.0, afstand: 90 };
    passageMerkTik();
    const voor7 = lees(PASSAGE_SLEUTEL).length;
    passageSchrijf({ t: klok, n: N, lat: 52.0, lon: 5.0, ma: 60, w: 0, laatst: klok });
    const na7a = lees(PASSAGE_SLEUTEL).length, weg7 = !passageC4.has(N);
    klok += 5000; passageSchrijf({ t: klok, n: N, lat: 52.0, lon: 5.0, ma: 10, w: 0, laatst: klok });
    const p7 = lees(PASSAGE_SLEUTEL).slice(-1)[0] || {};
    eis('MC7 een passage die niet genaderd werd: geen regel, haar tik vervalt, de volgende passage heeft geen tk',
      na7a === voor7 && weg7 && p7.tk === undefined && p7.tka === undefined, 'geen tk', JSON.stringify({ voor7, na7a, weg7, p7 }));

    // ═══ MC8 — zonder tik en zonder box ═════════════════════════
    passageC4.clear(); klok += 5000;
    passageSchrijf({ t: klok, n: N + 1, lat: 52.0, lon: 5.0, ma: 10, w: 0, laatst: klok });
    const p8 = lees(PASSAGE_SLEUTEL).slice(-1)[0] || {};
    eis('MC8 zonder tik en box: geen van de nieuwe velden', ['tk', 'tka', 'b0a', 'b0s', 'b1a', 'b1s'].every(k => p8[k] === undefined),
      'geen nieuwe velden', JSON.stringify(p8));
    Date.now = bew.nu;

    // ═══ MC9 — de echte tikLogTik ═══════════════════════════════
    passageC4.clear(); dichtstbijOSM = { id: N, lat: 52.0, lon: 5.0, afstand: 64 };
    try { tikLogTik(100, 100, false, null, null); } catch (e) {}
    const e9 = passageC4.get(N) || {};
    eis('MC9 tikLogTik telt de tik mee voor het getoonde licht, met de afstand', e9.tk === 1 && e9.tka === 64, 'tk 1 tka 64', JSON.stringify(e9));

    // ═══ MC10 — in de export ═══════════════════════════════════
    zetBasis(); detLogSchrijf();
    localStorage.setItem(PASSAGE_SLEUTEL, JSON.stringify([p6]));
    const dl = {}; const klik = HTMLAnchorElement.prototype.click, deel = Object.getOwnPropertyDescriptor(navigator, 'share');
    HTMLAnchorElement.prototype.click = function () { if (this.download) { const n = this.download; fetch(this.href).then(r => r.text()).then(x => { dl[n] = x; }); return; } return klik.call(this); };
    try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) {}
    const alert0 = window.alert; window.alert = () => {};
    let ex = null;
    try {
      (exporteerMeetdata.sliqOrig || exporteerMeetdata)();   // de functie zelf, zonder de beheer-schil (SLIQ_POORT is bevroren)
      for (let i = 0; i < 40 && !Object.keys(dl).some(n => n.includes('meetdata')); i++) await slaap(50);
      const naam = Object.keys(dl).find(n => n.includes('meetdata'));
      ex = naam ? JSON.parse(dl[naam]) : null;
    } finally {
      HTMLAnchorElement.prototype.click = klik; window.alert = alert0;
      try { if (deel) Object.defineProperty(navigator, 'share', deel); else delete navigator.share; } catch (e) {}
    }
    const xd = ex && ex.det && ex.det.sl_detlog && ex.det.sl_detlog[0], xp = ex && ex.passage && ex.passage[PASSAGE_SLEUTEL] && ex.passage[PASSAGE_SLEUTEL][0];
    eis('MC10 de Meetdata-export bevat de nieuwe detlog- en passagevelden, en de versie V11.38.3',
      !!xd && xd.ep === 'w' && xd.bx === 1660 && xd.cx === 1610 && !!xp && xp.tk === 2 && xp.b1a === 70 && /^V11\.38\.([3-9]|\d\d)(?!\d)/.test(ex.appVersie || '')   /* V11.38.4: V11.38.3 of later */,
      'ep, bx, cx, tk, b1a', JSON.stringify({ xd, xp, v: ex && ex.appVersie }));
    const bk = verzamelBackupData(), bd = (bk.sl_detlog || [])[0] || {}, bp = (bk.sl_passagelog || [])[0] || {};
    eis('MC10b de Backup bevat dezelfde velden', bd.ep === 'w' && bd.bx === 1660 && bp.tk === 2 && bp.b1a === 70, 'ep, bx, tk, b1a', JSON.stringify({ bd, bp }));

    // ═══ MC11 — byte-gelijk aan V11.38.2 ═══════════════════════
    const V11382 = {"postprocessYOLO":["d75a1e7c",5410],"selecteerBesteDetectie":["80841f8c",15084],"_verwerkWorkerResultaatKern":["b7c52393",6208],"_verwerkWorkerResultaat":["16e601a6",201],"nmsFilter":["60d0b197",416],"tapZwakPositie":["49f903a8",295],"tapLockLeeft":["edc39a25",104],"autoSlotActief":["f6d9de74",134],"autoSlotZet":["b132d1e2",381],"autoSlotUitdagerRijp":["60c2dce5",540],"slotCropPositie":["e501ae7",231],"slotBurenBij":["3e0a5a21",882],"hoofdConf":["895272ce",82],"hoofdTapConf":["7d04ece0",92],"runIsKansloos":["d631b73b",1660],"slaKanslozeRunOver":["57f1b46",408],"berekenCropRegio":["ca7bd568",3709],"preprocessVoorYOLO":["1f7ec00d",3139],"voerAIUit":["3b2ef19d",3075],"tikKiesDetectie":["9990bf6b",905],"detLogAfwijsFilter":["851d7f93",522],"detLogBestVelden":["75440359",456],"passageTik":["8bcd3b99",1501],"verwerkDetecties":["319a4ea6",8916],"tekenOverlay":["8306f61f",7250],"vergrendelNodeHandmatig":["be9c18a0",2371],"tikNaarYolo":["f464af55",186],"famSom":["b5135afe",422],"familieScore":["76a7732e",315],"eindeGemistLog":["e64f66dd",701],"tikLogNoteer":["171c833e",1235]};
    const anders = Object.entries(V11382).filter(([n, [h, l]]) => { const s = String(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
    eis('MC11a de 31 beslissende functies (selectie, slot, drempels, filters, crop, poort, tik) zijn byte-gelijk aan V11.38.2',
      anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
    const zonder = (f) => String(f).split('\n').filter(l => !/V11\.38\.3(?!\d)|V11\.38\.4(?!\d)/.test(l)).join('\n');
    const HAAK = { detLogSchrijf: ['c614b2be', 4119], passageSchrijf: ['19666aaa', 696], tikLogTik: ['a0583a9c', 1522] };
    const anders2 = Object.entries(HAAK).filter(([n, [h, l]]) => { const s = zonder(window[n]); return fnv(s) !== h || s.length !== l; }).map(([n]) => n + ' ' + fnv(zonder(window[n])) + '/' + zonder(window[n]).length);
    const tel = { detLogSchrijf: 2, passageSchrijf: 2, tikLogTik: 1 };
    const telAnders = Object.entries(tel).filter(([n, k]) => String(window[n]).split('\n').filter(l => /V11\.38\.3(?!\d)/.test(l)).length !== k).map(x => x[0]);
    eis('MC11b detLogSchrijf, passageSchrijf en tikLogTik zonder de V11.38.3-regels zijn byte-gelijk aan V11.38.2 (2, 2 en 1 regel toegevoegd)',
      anders2.length === 0 && telAnders.length === 0, 'geen afwijking', (anders2.concat(telAnders)).join(', ') || 'geen');

    // ═══ MC12 — alleen lezen ═══════════════════════════════════
    zetBasis(); bboxOverride = { cx: 330, cy: 200 }; stickyDetectie = { bron: 'tap', cx: 330, cy: 200 };
    const foto = () => JSON.stringify({ laatsteAI, bboxOverride, stickyDetectie, bboxSlot, detLogBest, laatsteDetectiesStelsel, cropRegio, dichtstbijOSM, fase, faseNodeId,
      hoofdSoort, bboxAnchorCx, bboxAnchorCy, detLogRatio, snelheidKmh, huidigBevestigdOsmNodeId, open: [...passageStaat.open.keys()], c: [NANO_CONF, NANO_TAPCONF, CONF_DREMPEL, TAP_CONF_DREMPEL] });
    const f0 = foto();
    for (let i = 0; i < 5; i++) { detLogC4Velden(laatsteDetectiesStelsel); passageBoxRun(); passageAfstNu(); passageC4Velden({ n: N, t: 0 }); }
    eis('MC12 de meetfuncties veranderen niets aan de beslissende toestand (box, tik, slot, crop, licht, fase, drempels)', foto() === f0, 'gelijk', foto() === f0 ? 'gelijk' : 'anders');

    // ═══ MC13 — grootte ══════════════════════════════════════
    zetBasis(); detLogSchrijf();
    const r13 = lees('sl_detlog')[0] || {};
    const lengte = JSON.stringify(r13).length;
    eis('MC13 een volle detlog-regel blijft onder 420 tekens', lengte < 420, '< 420', lengte);
  } finally {
    Date.now = bew.nu;
    const zet = (k, v) => { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); };
    zet('sl_detlog', bew.det); zet(PASSAGE_SLEUTEL, bew.pas); zet(TIKLOG_SLEUTEL, bew.tik);
    detLogArr = bew.detLogArr; detLogStop = bew.detLogStop; detLogStilLaatst = bew.detLogStilLaatst; detLogBest = bew.detLogBest;
    debugLaatsteAlle = bew.debugLaatsteAlle; laatsteDetectiesStelsel = bew.laatsteDetectiesStelsel; laatsteAI = bew.laatsteAI;
    bboxOverride = bew.bboxOverride; stickyDetectie = bew.stickyDetectie; detLogRatio = bew.detLogRatio; detLogAfst = bew.detLogAfst;
    snelheidKmh = bew.snelheidKmh; dichtstbijOSM = bew.dichtstbijOSM; hoofdSoort = bew.hoofdSoort; tikLogArr = bew.tikLogArr; tikLogStop = bew.tikLogStop;
    if (bew.gestopt) meetRingGestopt.add(PASSAGE_SLEUTEL); else meetRingGestopt.delete(PASSAGE_SLEUTEL);
    passageStaat.vorige = bew.vorige;
    passageC4.clear();
  }
  const gefaald = regels.filter(r => r.uitslag !== 'OK').length;
  return { regels, geslaagd: regels.length - gefaald, gefaald };
}
if (typeof window !== 'undefined') window.testMeetregelC4 = testMeetregelC4;
