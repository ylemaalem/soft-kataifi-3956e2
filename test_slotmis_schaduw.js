// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_slotmis_schaduw.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.10 (alleen meten): de schaduw voor het slot dat zijn lamp kwijt is.
//
//  SM1  slotMisPlek: de plek schuift omhoog met de elevatie; portaal verder dan paal; zonder anker null
//  SM2  slotMisStraal: 80 px op 15 m en verder, 3x (240 px) op 5 m en dichter
//  SM3  episode: ok-run zet het anker, drie missers met de lamp hoger in beeld -> één regel met
//       r=3, de paal-schaduw vindt hem 3x (kleur r), het slot niet; geen positie in de regel
//  SM4  einde van een episode: 'los' (slot weg), 'node' (ander licht), 'gat' (30 s geen run)
//  SM5  pv: de schaduw vindt een andere kleur dan de app toont; een bekende buur telt niet
//  SM6  puur: slotMisTik verandert het slot, de tik, de fase, de uitsnede en de andere opslag niet,
//       en selecteerBesteDetectie geeft met en zonder de schaduw hetzelfde
//  SM7  de bron: één aanroep direct na selecteerBesteDetectie; export; selectie, slot, filters,
//       fase en countdown byte-gelijk aan V11.38.9 (vingerafdrukken)
//
//  DRAAIEN: zoals de andere toetsen; testSlotMisSchaduw().
// ═══════════════════════════════════════════════════════════════
function testSlotMisSchaduw() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 400); } catch (e) { return String(x); } };
  const fnv = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const NL = String.fromCharCode(10);
  const N1 = 9608821, N2 = 9608822;
  const bew = { stickyDetectie, bboxOverride, dichtstbijOSM, fase, cropRegio, lbScale, lbPadX, lbPadY,
                staat: slotMisStaat, anker: slotMisAnker, log: localStorage.getItem(SLOTMIS_SLEUTEL) };
  const vwEigen = Object.getOwnPropertyDescriptor(video, 'videoWidth'), vhEigen = Object.getOwnPropertyDescriptor(video, 'videoHeight');
  const slog = () => { try { return JSON.parse(localStorage.getItem(SLOTMIS_SLEUTEL) || '[]'); } catch (e) { return []; } };
  const f = 1080 / Math.tan(35 * Math.PI / 180);   // CAMERA_FOV 70 op 2160 breed
  try {
    Object.defineProperty(video, 'videoWidth', { value: 2160, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 3840, configurable: true });
    cropRegio = null; lbScale = 640 / 3840; lbPadX = (640 - 2160 * lbScale) / 2; lbPadY = 0;
    const cam2yolo = (camX, camY) => ({ cx: camX * lbScale + lbPadX, cy: camY * lbScale + lbPadY });
    // SM1
    const anker = { camX: 1080, camY: 1500, camH: 200, d: 20, t: Date.now() };
    const pP = slotMisPlek(anker, 5, SLOTMIS_PAAL_M), pQ = slotMisPlek(anker, 5, SLOTMIS_PORTAAL_M), p0 = slotMisPlek(anker, 25, SLOTMIS_PAAL_M);
    const verwP = 1500 - f * (3.5 - 1.3) * (1 / 5 - 1 / 20), verwQ = 1500 - f * (6.5 - 1.3) * (1 / 5 - 1 / 20);
    const ok1 = Math.abs(pP.cy - cam2yolo(1080, verwP).cy) < 0.01 && Math.abs(pQ.cy - cam2yolo(1080, verwQ).cy) < 0.01
      && pQ.cy < pP.cy && Math.abs(p0.cy - cam2yolo(1080, 1500).cy) < 0.01 && Math.abs(pP.cx - cam2yolo(1080, 1500).cx) < 0.01
      && slotMisPlek(null, 5, 3.5) === null;
    eis('SM1 slotMisPlek: omhoog met de elevatie, portaal verder, verder weg geen schuif, zonder anker null', ok1, 'zie test', kort({ pP, pQ, p0 }));
    // SM2
    const ok2 = slotMisStraal(15) === 80 && slotMisStraal(30) === 80 && slotMisStraal(5) === 240 && slotMisStraal(2) === 240
      && Math.abs(slotMisStraal(10) - 120) < 1e-9 && slotMisStraal(null) === 80;
    eis('SM2 slotMisStraal: 80 tot 15 m, 120 op 10 m, 240 op 5 m en dichter', ok2, '80 80 240 240 120 80',
      kort([slotMisStraal(15), slotMisStraal(30), slotMisStraal(5), slotMisStraal(2), slotMisStraal(10), slotMisStraal(null)]));
    // SM3: het slot staat op camY 1500 (20 m); de lamp staat nu op de paal-plek van 5 m
    localStorage.setItem(SLOTMIS_SLEUTEL, '[]'); slotMisStaat = null; slotMisAnker = null;
    bboxOverride = null; fase = 'rood';
    const ankerDet = { ...cam2yolo(1080, 1500), w: 20, h: 33, klasse: 0, score: 0.9 };
    stickyDetectie = { cx: ankerDet.cx, cy: ankerDet.cy, hoogte: 33, klasse: 0, familie: 'rood', tijd: Date.now(), bron: 'auto',
                       camX: 1080, camY: 1500, camH: 200, camAfst: 20, buren: [] };
    dichtstbijOSM = { id: N1, afstand: 20 };
    slotMisTik([ankerDet], 'ok');
    const lamp5 = { ...cam2yolo(1080, verwP), w: 40, h: 70, klasse: 0, score: 0.9 };
    for (const a of [6, 5, 5]) { dichtstbijOSM = { id: N1, afstand: a }; slotMisTik([lamp5], 'autoslot_miss'); }
    const voor3 = slog().length;
    dichtstbijOSM = { id: N1, afstand: 4 }; slotMisTik([lamp5], 'ok');
    const L3 = slog(), r3 = L3[0] || {};
    const tekst = JSON.stringify(L3);
    const ok3 = voor3 === 0 && L3.length === 1 && r3.n === N1 && r3.k === 'a' && r3.r === 3 && r3.a0 === 6 && r3.a1 === 5 && r3.e === 'ok'
      && r3.p === 3 && r3.pk.r === 3 && r3.f === 'r' && r3.pv === 0 && r3.s.length === 3 && r3.s[1][4] === 'r' && r3.s[1][1] > 80
      && r3.s[1][2] === 70 && r3.s[0][7] === 0 && r3.s[0][8] === 'r' && !/"lat"|"lon"|52\.|5\.0/.test(tekst);
    eis('SM3 episode: r=3, paal vindt de lamp 3x, het slot niet (d>80), einde ok, geen positie', ok3, '1 regel', kort(L3));
    // SM4
    localStorage.setItem(SLOTMIS_SLEUTEL, '[]'); slotMisStaat = null;
    dichtstbijOSM = { id: N1, afstand: 8 }; slotMisTik([lamp5], 'autoslot_miss');
    const sdBew = stickyDetectie; stickyDetectie = null; slotMisTik([lamp5], 'leeg'); stickyDetectie = sdBew;
    slotMisTik([lamp5], 'autoslot_miss'); dichtstbijOSM = { id: N2, afstand: 8 }; slotMisTik([lamp5], 'autoslot_miss');
    slotMisStaat.t1 -= 31000; slotMisTik([lamp5], 'autoslot_miss');
    const e4 = slog().map(r => r.e);
    eis('SM4 einde: los, node, gat', kort(e4) === '["los","node","gat"]', '["los","node","gat"]', kort(e4));
    // SM5: app rood, de schaduw ziet groen op de paal-plek; een buur op de portaal-plek telt niet
    localStorage.setItem(SLOTMIS_SLEUTEL, '[]'); slotMisStaat = null; dichtstbijOSM = { id: N1, afstand: 5 };
    const groen5 = { ...lamp5, klasse: 1 };
    const buurQ = { ...cam2yolo(1080, verwQ), w: 40, h: 70, klasse: 0, score: 0.8 };
    stickyDetectie = { ...sdBew, buren: [{ dx: 0, dy: verwQ - 1500, t: Date.now() }] };
    dichtstbijOSM = { id: N1, afstand: 20 }; slotMisTik([ankerDet], 'ok');   // het anker opnieuw (SM4 liet het slot los)
    localStorage.setItem(SLOTMIS_SLEUTEL, '[]'); dichtstbijOSM = { id: N1, afstand: 5 };
    slotMisTik([groen5, buurQ], 'autoslot_miss'); slotMisTik([groen5], 'ok');
    const r5 = slog()[0] || {};
    eis('SM5 pv telt een andere kleur dan de app; een bekende buur vindt de schaduw niet',
      r5.pv === 1 && r5.pk.g === 1 && r5.s[0][4] === 'g' && r5.s[0][5] !== 'r', 'pv 1, portaal niet de buur', kort(r5));
    stickyDetectie = sdBew;
    // SM6
    const anders = () => Object.keys(localStorage).filter(k => k !== SLOTMIS_SLEUTEL).sort().map(k => k + '=' + (localStorage.getItem(k) || '').length).join('|');
    const voor = anders(), sdTekst = JSON.stringify(stickyDetectie), bo = bboxOverride, fa = fase, cr = cropRegio, ls = lbScale;
    for (const r of ['autoslot_miss', 'autoslot_miss', 'ok', 'tik_leeg', 'weg']) slotMisTik([lamp5, groen5], r);
    const ok6a = anders() === voor && JSON.stringify(stickyDetectie) === sdTekst && bboxOverride === bo && fase === fa && cropRegio === cr && lbScale === ls;
    // selecteerBesteDetectie twee keer met dezelfde stand: één keer met de schaduw ertussen
    const sel = () => { stickyDetectie = JSON.parse(sdTekst); return selecteerBesteDetectie([lamp5, groen5]); };
    const u1 = sel();
    const u2 = sel(); const s1 = JSON.stringify(stickyDetectie);
    slotMisTik([lamp5, groen5], u2.afwijsReden); const s2 = JSON.stringify(stickyDetectie);
    stickyDetectie = JSON.parse(sdTekst); stickyDetectie.cy -= 400;   // het slot zoekt ver weg: een echte misser
    const u3 = sel(); const s3 = JSON.stringify(stickyDetectie);
    slotMisTik([lamp5, groen5], u3.afwijsReden); const s4 = JSON.stringify(stickyDetectie);
    const ok6b = u1.afwijsReden === u2.afwijsReden && (u1.s1 && u1.s1.cy) === (u2.s1 && u2.s1.cy) && s1 === s2 && s3 === s4;
    eis('SM6 puur: slot, tik, fase, uitsnede en andere opslag gelijk; selectie met en zonder schaduw gelijk', ok6a && ok6b,
      'gelijk', kort({ ok6a, ok6b, r1: u1.afwijsReden, r2: u2.afwijsReden }));
    // SM7
    const kern = String(_verwerkWorkerResultaatKern);
    const iSel = kern.indexOf('const { s1:beste, s2Rest, afwijsReden } = selecteerBesteDetectie(detecties);');
    const iMis = kern.indexOf('slotMisTik(detecties, afwijsReden);');
    const tussen = kern.slice(iSel, iMis).split(NL).length;
    const ex = String(exporteerMeetdata);
    const PIN = {
      selecteerBesteDetectie: '80841f8c', stickySlotMatch: '6ac2af1a', tikSlotMatch: 'd42b2f71', stickyVoorspel: 'f5cc4e22', stickyProjecteer: '67c1517b',
      stickyNeemOver: 'c06db2ce', stickyCam: '53d4530d', slotBovengrens: '39e18403', slotIsBuur: '406728eb', slotZonderBuur: '7b0d97c9', tikStraalVast: 'db6f2bb0',
      tikStraalYolo: '7014cad2', autoSlotZet: 'b132d1e2', autoSlotActief: 'f6d9de74', autoSlotUitdagerRijp: '60c2dce5', berekenCropRegio: 'ca7bd568',
      faseMagOfficieelWorden: '8e6db571', tolerantieVerlopen: 'f8ff54c3', verwerkDetecties: '319a4ea6', verwerkS2: '6c7c8546', verwerkFase: '5335de24',
      updateUI: '3170b33d', kiesCountdownBron: '95562985', bevestigCountdown: 'a41caa7e', _verwerkWorkerResultaatKern: 'b7c52393'
    };
    const zonder = (t) => String(t).split(NL).filter(l => !/V11\.38\.10(?!\d)/.test(l)).join(NL);
    const af = {};
    for (const n of Object.keys(PIN)) af[n] = fnv(zonder(window[n]));
    const mis7 = Object.keys(PIN).filter(n => af[n] !== PIN[n]);
    const ok7 = iSel > 0 && iMis > iSel && tussen === 2 && /uit\.slotmis = \{\}/.test(ex) && /key === SLOTMIS_SLEUTEL\)\s+doel = uit\.slotmis/.test(ex)
      && SLOTMIS_SLEUTEL === 'sl_slotmislog' && mis7.length === 0;
    eis('SM7 aanroep direct na selecteerBesteDetectie; export; ' + Object.keys(PIN).length + ' functies byte-gelijk aan V11.38.9', ok7,
      'alles gelijk', kort({ iSel, iMis, tussen, mis7, af }));
  } catch (e) {
    eis('SM crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    try { if (vwEigen) Object.defineProperty(video, 'videoWidth', vwEigen); else delete video.videoWidth; } catch (e) {}
    try { if (vhEigen) Object.defineProperty(video, 'videoHeight', vhEigen); else delete video.videoHeight; } catch (e) {}
    stickyDetectie = bew.stickyDetectie; bboxOverride = bew.bboxOverride; dichtstbijOSM = bew.dichtstbijOSM; fase = bew.fase;
    cropRegio = bew.cropRegio; lbScale = bew.lbScale; lbPadX = bew.lbPadX; lbPadY = bew.lbPadY;
    slotMisStaat = bew.staat; slotMisAnker = bew.anker;
    try { if (bew.log === null) localStorage.removeItem(SLOTMIS_SLEUTEL); else localStorage.setItem(SLOTMIS_SLEUTEL, bew.log); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testSlotMisSchaduw = testSlotMisSchaduw;
