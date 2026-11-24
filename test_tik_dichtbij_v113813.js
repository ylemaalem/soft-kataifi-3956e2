// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tik_dichtbij_v113813.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.13: de tik houdt dichtbij zijn lamp vast, plus twee meetregels.
//
//  TD1  buiten de regel is de straal die van V11.38.12: verder dan 10 m, met uitsnede,
//       zonder tik, zonder lamphoogte; dan ook geen meetstand
//  TD2  tot 10 m, hele beeld, met tik: straal 0,75 x lamphoogte (45 px), de box op 35 px
//       wordt gevonden (V11.38.12: 27 px, gemist); hooguit 80 px
//  TD3  een bekende buur op 35 px wordt niet overgenomen (tik_leeg)
//  TD4  meetregel sl_tikdichtlog: overname + 3 runs = 'b'; overname + verloren run = 'w';
//       verloren run met d/lamphoogte; een regel per nadering, einde 'node'; geen positie
//  TD5  meetregel sl_autoslotlog: het auto-slot gaat dicht in selecteerBesteDetectie (r, ms);
//       een tik via tikZet op een andere lamp = 'a', dezelfde = 'z', na 10 s '-'
//  TD6  selectie, slot, fase, leren, countdown en tik byte-gelijk aan V11.38.12
//       (vingerafdrukken zonder de regels V11.38.13)
//  TD7  export: uit.tikdicht en uit.autoslot; de sleutels; de schakelaar staat aan
//
//  DRAAIEN: zoals de andere toetsen; testTikDichtbijV113813().
// ═══════════════════════════════════════════════════════════════
function testTikDichtbijV113813() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 400); } catch (e) { return String(x); } };
  const fnv = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const NL = String.fromCharCode(10);
  const N1 = 9613801, N2 = 9613802;
  const opslag = {}; for (const k of Object.keys(localStorage)) opslag[k] = localStorage.getItem(k);
  const bew = { stickyDetectie, stickyMissTeller, bboxOverride, bboxOverrideTijd, bboxOverrideCamX, bboxOverrideCamY, bboxOverrideMatchTeller,
                dichtstbijOSM, fase, cropRegio, lbScale, lbPadX, lbPadY, snelheidKmh, bboxSlot, vorigeDetectie,
                vbx: voorkeursBboxCx, vby: voorkeursBboxCy, vbr: voorkeursBboxRuns, vbt: voorkeursBboxTijd, vbs: voorkeursBboxStart,
                tds: tikDichtStaat, tdr: tikDichtbijRun, aso: autoSlotLogOpen };
  const vwEigen = Object.getOwnPropertyDescriptor(video, 'videoWidth'), vhEigen = Object.getOwnPropertyDescriptor(video, 'videoHeight');
  const log = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  try {
    Object.defineProperty(video, 'videoWidth', { value: 2160, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 3840, configurable: true });
    const heelBeeld = () => { cropRegio = null; lbScale = 640 / 3840; lbPadX = (640 - 2160 * lbScale) / 2; lbPadY = 0; };
    heelBeeld();
    const y = (camX, camY) => ({ cx: camX * lbScale + lbPadX, cy: camY * lbScale + lbPadY });
    snelheidKmh = 20; fase = 'groen';
    // De tik op een lamp van 360 camerapixels hoog (60 modelpixels), op 8 m.
    const zetTik = (afst, camH, buren) => {
      bboxOverride = { ...y(1080, 1500) }; bboxOverrideTijd = Date.now(); bboxOverrideCamX = 1080; bboxOverrideCamY = 1500; bboxOverrideMatchTeller = 0;
      stickyDetectie = { ...y(1080, 1500), camX: 1080, camY: 1500, camH, camAfst: afst, hoogte: camH * lbScale, klasse: 1, familie: 'groen',
                         tijd: Date.now() + 5000, sinds: Date.now(), bron: 'tik', buren: buren || [] };
      stickyMissTeller = 0;
      dichtstbijOSM = { id: N1, afstand: afst };
    };
    const box = (dyYolo, h, klasse) => { const p = y(1080, 1500); return { cx: p.cx, cy: p.cy + dyYolo, w: h / 2, h, klasse: klasse === undefined ? 1 : klasse, score: 0.8 }; };
    // De straal van V11.38.12, letterlijk nagerekend.
    const oudeStraal = () => {
      const gewoon = tikStraalYolo();
      const stil = typeof snelheidKmh === 'number' && !isNaN(snelheidKmh) && snelheidKmh < TIK_VAST_STIL_KMH;
      if (!stil && cropRegio) return gewoon;
      const cam = tikStraalCam();
      const camH = (stickyDetectie && stickyDetectie.camH > 0) ? stickyDetectie.camH : 0;
      return Math.min(gewoon, Math.max(cam * TIK_VAST_MIN_FRACTIE, camH * TIK_VAST_FACTOR) * lbScale);
    };
    // TD1
    const td1 = [];
    zetTik(12, 360); td1.push(['12 m', tikStraalVast(), oudeStraal(), tikDichtbijRun]);
    zetTik(8, 360); cropRegio = { x: 540, y: 1000, w: 1080, h: 1080 }; lbScale = 640 / 1080; lbPadX = 0; lbPadY = 0;
    td1.push(['uitsnede', tikStraalVast(), oudeStraal(), tikDichtbijRun]);
    snelheidKmh = 2; td1.push(['uitsnede stil', tikStraalVast(), oudeStraal(), tikDichtbijRun]); snelheidKmh = 20;
    heelBeeld(); zetTik(8, 360); bboxOverride = null; td1.push(['zonder tik', tikStraalVast(), oudeStraal(), tikDichtbijRun]);
    zetTik(8, 0); td1.push(['zonder lamphoogte', tikStraalVast(), oudeStraal(), tikDichtbijRun]);
    zetTik(8, 360); dichtstbijOSM = null; td1.push(['zonder licht', tikStraalVast(), oudeStraal(), tikDichtbijRun]);
    const ok1 = td1.every(r => Math.abs(r[1] - r[2]) < 1e-9 && r[3] === null) && Math.abs(td1[0][1] - 27) < 0.01;
    eis('TD1 buiten de regel (12 m, uitsnede, stil met uitsnede, geen tik, geen lamphoogte, geen licht): straal = V11.38.12, geen meetstand',
      ok1, 'gelijk', kort(td1.map(r => [r[0], Math.round(r[1] * 100) / 100, Math.round(r[2] * 100) / 100, r[3]])));
    // TD2
    heelBeeld(); zetTik(8, 360);
    const s2 = tikStraalVast(), o2 = oudeStraal();
    zetTik(8, 360); const u2 = selecteerBesteDetectie([box(35, 62)]);
    zetTik(8, 900); const s2b = tikStraalVast();
    zetTik(10, 360); const s2c = tikStraalVast();
    eis('TD2 tot 10 m, hele beeld, tik: straal 45 px (0,75 x 60), box op 35 px gevonden (oud 27 px), hooguit 80; ook op precies 10 m',
      Math.abs(s2 - 45) < 0.01 && Math.abs(o2 - 27) < 0.01 && u2.afwijsReden === 'ok' && !!u2.s1 && Math.abs(u2.s1.h - 62) < 1e-9
        && s2b === 80 && Math.abs(s2c - 45) < 0.01,
      '45, 27, ok, 80, 45', kort({ s2, o2, r: u2.afwijsReden, s2b, s2c }));
    // TD3
    zetTik(8, 360, [{ dx: 0, dy: 35 / lbScale, t: Date.now() }]);
    const u3 = selecteerBesteDetectie([box(35, 62)]);
    eis('TD3 een bekende buur op 35 px wordt niet overgenomen', u3.afwijsReden === 'tik_leeg' && !u3.s1, 'tik_leeg', kort({ r: u3.afwijsReden }));
    // TD4
    localStorage.setItem(TIKDICHT_SLEUTEL, '[]'); tikDichtStaat = null;
    zetTik(8, 360);
    selecteerBesteDetectie([box(35, 60)]);                                     // overname
    for (let i = 0; i < 3; i++) selecteerBesteDetectie([box(35, 60)]);         // dezelfde plek: binnen de oude straal
    const naB = JSON.parse(JSON.stringify(tikDichtStaat || {}));
    selecteerBesteDetectie([box(35 + 30, 60)]);                                // weer een overname (30 px, oud 27)
    selecteerBesteDetectie([box(35 + 30 + 200, 60)]);                          // verloren: 200 px
    dichtstbijOSM = { id: N2, afstand: 8 }; slotMeetTik();                    // ander licht: de regel sluit
    const L4 = log(TIKDICHT_SLEUTEL), r4 = L4[0] || {};
    const tekst4 = JSON.stringify(L4);
    const ok4 = naB.no === 1 && naB.nb === 1 && naB.nm === 3 && L4.length === 1 && r4.n === N1 && r4.e === 'node' && r4.r === 6
      && r4.no === 2 && r4.nm === 3 && r4.nv === 1 && r4.nb === 1 && r4.nw === 1
      && r4.o.length === 2 && r4.o[0][0] === 8 && r4.o[0][1] === 35 && r4.o[0][2] === 60 && r4.o[0][3] === 'g' && r4.o[0][4] === 'g'
      && r4.o[0][5] === 45 && r4.o[0][6] === 27 && r4.o[0][7] === 'b' && r4.o[1][1] === 30 && r4.o[1][7] === 'w'
      && r4.v.length === 1 && r4.v[0][1] === 200 && r4.v[0][2] === 60 && Math.abs(r4.v[0][3] - 3.33) < 0.006 && r4.v[0][4] === 45
      && !/"lat"|"lon"|"pos"/.test(tekst4);
    eis('TD4 sl_tikdichtlog: overname b, overname w, verloren run met d/lamphoogte 3,33, einde node, geen positie', ok4, 'zie test', kort({ naB, L4 }));
    // TD5
    localStorage.setItem(AUTOSLOTLOG_SLEUTEL, '[]'); autoSlotLogOpen = null;
    heelBeeld(); bboxOverride = null; stickyDetectie = null; dichtstbijOSM = { id: N1, afstand: 90 };
    const b5 = box(0, 20, 0);
    voorkeursBboxCx = b5.cx; voorkeursBboxCy = b5.cy; voorkeursBboxRuns = 3; voorkeursBboxTijd = Date.now(); voorkeursBboxStart = Date.now() - 4000;
    selecteerBesteDetectie([b5]);
    const open5 = autoSlotLogOpen ? { ...autoSlotLogOpen } : null;
    const dicht5 = !!stickyDetectie && stickyDetectie.bron === 'auto';
    tikZet(null, 1080 + 500, 1500);                                            // een tik 500 cam-px verderop
    const a5 = log(AUTOSLOTLOG_SLEUTEL);
    bboxOverride = null; stickyDetectie = null;
    autoSlotLogZet(b5); stickyDetectie = { camX: 1080, camY: 1500 }; autoSlotLogOpen.x = 1080; autoSlotLogOpen.y = 1500;
    tikZet(null, 1080 + 50, 1500);                                             // dezelfde lamp
    bboxOverride = null; stickyDetectie = null;
    autoSlotLogZet(b5); autoSlotLogOpen.t -= 11000; slotMeetTik();            // geen tik binnen 10 s
    const L5 = log(AUTOSLOTLOG_SLEUTEL);
    const ok5 = dicht5 && open5 && open5.r === 3 && open5.ms >= 3900 && open5.ms < 6000 && open5.a === 90 && open5.c === 0 && open5.k === 'r' && open5.h === 20
      && a5.length === 1 && a5[0].tk === 'a' && a5[0].d === 500 && L5.length === 3 && L5[1].tk === 'z' && L5[1].d === 50 && L5[2].tk === '-' && L5[2].ts === null
      && !/"x"|"y"|"lat"|"lon"/.test(JSON.stringify(L5));
    eis('TD5 sl_autoslotlog: dicht na 3 runs en ~4 s; tik op andere lamp a, dezelfde z, geen tik -; geen positie', ok5, 'a z -', kort({ open5, L5 }));
    // TD6
    const PIN = {
      selecteerBesteDetectie: '80841f8c', tikStraalVast: 'db6f2bb0', tikStraalYolo: '7014cad2', tikStraalCam: '83ae570a', tikSlotMatch: 'd42b2f71', tikZet: '86bbb9ec', tikWeiger: '63e0c4bb',
      stickySlotMatch: '6ac2af1a', stickyVoorspel: 'f5cc4e22', stickyProjecteer: '67c1517b', stickyNeemOver: 'c06db2ce', stickyCam: '53d4530d', slotIsBuur: '406728eb', slotZonderBuur: '7b0d97c9',
      slotBovengrens: '39e18403', autoSlotZet: 'b132d1e2', autoSlotActief: 'f6d9de74', voorkeurIsRijp: '3e7bba4d', berekenCropRegio: 'ca7bd568', slotMisTik: 'eef7c2e6',
      verwerkFase: '5335de24', faseMagOfficieelWorden: '8e6db571', tolerantieVerlopen: 'f8ff54c3', verwerkS2: '6c7c8546', updateUI: '3170b33d', kiesCountdownBron: '95562985',
      bevestigCountdown: 'a41caa7e', slaOp: 'ac8cb808', slaOpIntern: '1da5de11', verwerkDetecties: '319a4ea6', _verwerkWorkerResultaatKern: '51c71503'
    };
    const zonder = (t) => String(t).split(NL).filter(l => !/V11\.38\.13(?!\d)/.test(l)).join(NL);
    const af = {};
    for (const n of Object.keys(PIN)) af[n] = (typeof window[n] === 'function') ? fnv(zonder(window[n])) : 'ONTBREEKT';
    const mis6 = Object.keys(PIN).filter(n => af[n] !== PIN[n]);
    eis('TD6 ' + Object.keys(PIN).length + ' functies byte-gelijk aan V11.38.12 (zonder de regels V11.38.13)', mis6.length === 0, 'alles gelijk', kort({ mis6, af }));
    // TD7
    const ex = String(exporteerMeetdata), sv = String(tikStraalVast), kern = String(_verwerkWorkerResultaatKern);
    const ok7 = /uit\.tikdicht = \{\}; uit\.autoslot = \{\}/.test(ex) && /key === TIKDICHT_SLEUTEL\)\s+doel = uit\.tikdicht/.test(ex)
      && /key === AUTOSLOTLOG_SLEUTEL\)\s+doel = uit\.autoslot/.test(ex)
      && TIKDICHT_SLEUTEL === 'sl_tikdichtlog' && AUTOSLOTLOG_SLEUTEL === 'sl_autoslotlog' && TIKDICHT_MAX === 40 && AUTOSLOTLOG_MAX === 40
      && TIK_DICHTBIJ === true && TIK_DICHTBIJ_M === 10 && /^\s*if \(!TIK_DICHTBIJ \|\| bboxOverride === null \|\| cropRegio/m.test(String(tikDichtbijStraal))
      && sv.indexOf('tikDichtbijStraal(vast)') > 0 && sv.indexOf('tikDichtbijStraal(vast)') < sv.indexOf('return Math.min(gewoon, vast * lbScale);')
      && kern.indexOf('slotMeetTik();') > kern.indexOf('slotMisTik(detecties, afwijsReden);');
    eis('TD7 export, sleutels, ring 40, schakelaar aan, de regel staat voor de oude return', ok7, 'zie test', '');
  } catch (e) {
    eis('TD crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    try { if (vwEigen) Object.defineProperty(video, 'videoWidth', vwEigen); else delete video.videoWidth; } catch (e) {}
    try { if (vhEigen) Object.defineProperty(video, 'videoHeight', vhEigen); else delete video.videoHeight; } catch (e) {}
    stickyDetectie = bew.stickyDetectie; stickyMissTeller = bew.stickyMissTeller; bboxOverride = bew.bboxOverride; bboxOverrideTijd = bew.bboxOverrideTijd;
    bboxOverrideCamX = bew.bboxOverrideCamX; bboxOverrideCamY = bew.bboxOverrideCamY; bboxOverrideMatchTeller = bew.bboxOverrideMatchTeller;
    dichtstbijOSM = bew.dichtstbijOSM; fase = bew.fase; cropRegio = bew.cropRegio; lbScale = bew.lbScale; lbPadX = bew.lbPadX; lbPadY = bew.lbPadY;
    snelheidKmh = bew.snelheidKmh; bboxSlot = bew.bboxSlot; vorigeDetectie = bew.vorigeDetectie;
    voorkeursBboxCx = bew.vbx; voorkeursBboxCy = bew.vby; voorkeursBboxRuns = bew.vbr; voorkeursBboxTijd = bew.vbt; voorkeursBboxStart = bew.vbs;
    tikDichtStaat = bew.tds; tikDichtbijRun = bew.tdr; autoSlotLogOpen = bew.aso;
    try { for (const k of Object.keys(localStorage)) if (!(k in opslag)) localStorage.removeItem(k); for (const k of Object.keys(opslag)) localStorage.setItem(k, opslag[k]); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testTikDichtbijV113813 = testTikDichtbijV113813;
