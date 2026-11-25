// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_aankomstkleur_v113814.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.14: de kleur bij aankomst in de doorrijlog (veld ka), alleen meten.
//  Testcoördinaten rond 52.0000/5.0000; de auto rijdt naar het noorden. Lichten A, B en C
//  zijn neutrale testnummers.
//
//  AK1  de constanten en de schakelaar (staat aan)
//  AK2  drie doorritten: A met groen 12 s (gezien) op 30 m, rood 3 s met countdown op 15 m,
//       rood vastgehouden op 5 m = "g12dr3cr3v"; B terwijl de app de kleur van A toont = geen
//       veld; C alleen tot 20 m, kleur zonder fase (eerste detectie, oranje 2 s) = "o2d.."
//  AK3  de bestaande velden (t, n, c, ma, dd, s, wg, v, va, vt) zijn er nog en ka is het enige
//       nieuwe veld; geen positie in de regel
//  AK4  52 functies (selectie, slot, fase, countdown, leren, upload-voorbereiding, doorrijlog)
//       byte-gelijk aan V11.38.13, zonder de regels V11.38.14
//  AK5  de app toont geen voorspelde kleur: alleen updateUI, updateUIKleur, resetUIKleur en
//       resetNeutraal zetten de lampkleur; updateUI komt alleen uit verwerkFase, verwerkFase
//       alleen uit verwerkDetecties met aiR.kleur; updateUIKleur alleen met aiR.kleur,
//       faseBevestigd of savedFaseBevestigd; faseBevestigd krijgt alleen een detectiekleur,
//       een herstelde kleur, 'rood' (herstel na uitval) of null. Dus de bronnen d, v en c dekken alles.
//  AK6  opslag: 500 regels met het langste veld ("r99cr99cr99c") kosten hooguit 10 KB extra
//
//  DRAAIEN: zoals de andere toetsen; testAankomstkleurV113814().
// ═══════════════════════════════════════════════════════════════
function testAankomstkleurV113814() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 400); } catch (e) { return String(x); } };
  const fnv = (t) => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const NL = String.fromCharCode(10);
  const A = 9614001, B = 9614002, C = 9614003;
  const LAT0 = 52.0000, LON0 = 5.0000, mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  const opslag = localStorage.getItem(DOOR_SLEUTEL);
  const bew = { osmCache, dichtstbijOSM, fase, faseNodeId, faseStart, geenTeller, aiKleur, aiTellerStart, cdStart, activeCdDoel, snelheidKmh,
                doorStaat, lamp: faseLamp.className, gestopt: meetRingGestopt.has(DOOR_SLEUTEL) };
  try {
    // AK1
    eis('AK1 schakelaar en constanten', AANKOMSTKLEUR_LOG === true && JSON.stringify(AANKOMST_M) === '[30,15,5]' && AANKOMST_FA_MAX === 99 && DOOR_MAX === 500,
        'aan, [30,15,5], 99, 500', kort({ AANKOMSTKLEUR_LOG, AANKOMST_M, AANKOMST_FA_MAX, DOOR_MAX }));

    // AK2: drie doorritten met doorTik (dezelfde functie als in de rit), zonder koers (snelheid 0).
    try { localStorage.removeItem(DOOR_SLEUTEL); } catch (e) {}
    meetRingGestopt.delete(DOOR_SLEUTEL);
    doorStaat = { open: new Map(), buf: [], vorige: null, laatsteSchrijf: Date.now(), tVorig: 0, n: 0, geschreven: 0 };
    snelheidKmh = 0;
    const toon = (kleur, opt) => {   // de toestand van het scherm en de fase
      faseLamp.className = kleur || '';
      fase = opt.fase === undefined ? null : opt.fase; faseNodeId = opt.node === undefined ? null : opt.node;
      faseStart = opt.leeftijd === undefined ? null : performance.now() - opt.leeftijd * 1000;
      aiKleur = opt.ai === undefined ? null : opt.ai; aiTellerStart = opt.aiLeeftijd === undefined ? 0 : Date.now() - opt.aiLeeftijd * 1000;
      geenTeller = opt.geen || 0; cdStart = opt.cd ? performance.now() : null; activeCdDoel = opt.cd ? 40 : 0;
    };
    const rit = (licht, yLicht, stappen) => {   // stappen: [[y, toestand-functie of null], ...]
      osmCache = [{ id: licht, naam: 'L', ...LL(0, yLicht) }];
      dichtstbijOSM = { id: licht, afstand: 999 };
      for (const [y, zet] of stappen) { if (zet) zet(); dichtstbijOSM.afstand = Math.abs(yLicht - y); const q = LL(0, y); doorTik(q.lat, q.lon); }
    };
    // Rit A: licht op y=100.
    rit(A, 100, [
      [40, () => toon('groen', { fase: 'groen', node: A, leeftijd: 12, ai: 'groen' })],   // 60 m
      [70, null],                                                                          // 30 m: g12d
      [85, () => toon('rood', { fase: 'rood', node: A, leeftijd: 3, ai: 'rood', cd: true })],  // 15 m: r3c
      [92, null],                                                                          // 8 m: nog r3c (de grens is 5 m, niet 10)
      [95, () => toon('rood', { fase: 'rood', node: A, leeftijd: 3, ai: 'rood', geen: 3 })],   // 5 m: r3v
      [100, null], [130, null], [160, null], [200, null]]);
    // Rit B: licht op y=400; de app toont de kleur van A (fase-node A).
    rit(B, 400, [[340, () => toon('groen', { fase: 'groen', node: A, leeftijd: 20, ai: 'groen' })], [370, null], [385, null], [395, null], [400, null], [440, null], [480, null]]);
    // Rit C: licht op x=20 (zijkant), de auto komt tot 20 m; kleur zonder fase (eerste detectie).
    osmCache = [{ id: C, naam: 'L', ...LL(20, 700) }];
    dichtstbijOSM = { id: C, afstand: 999 };
    toon('oranje', { ai: 'oranje', aiLeeftijd: 2 });
    for (const y of [640, 670, 685, 700, 715, 740, 790]) { const q = LL(0, y); doorTik(q.lat, q.lon); }
    for (const [id, p] of doorStaat.open) { doorStaat.open.delete(id); doorSluit(p); }
    doorBergOp();
    let log = []; try { log = JSON.parse(localStorage.getItem(DOOR_SLEUTEL)) || []; } catch (e) {}
    const per = (n) => log.find(r => r.n === n) || null;
    const a = per(A), b = per(B), c = per(C);
    eis('AK2a rit A: ka = g12dr3cr3v', !!a && a.ka === 'g12dr3cr3v', 'g12dr3cr3v', kort(a));
    eis('AK2b rit B: kleur van een ander licht = geen veld ka', !!b && b.ka === undefined && b.c === '-', 'regel zonder ka', kort(b));
    eis('AK2c rit C: alleen 30 m bereikt, kleur zonder fase = o2d..', !!c && c.ka === 'o2d..' && c.ma === 20, 'o2d.., ma 20', kort(c));
    eis('AK2d drie regels', log.length === 3, 3, log.length);
    toon('rood', { fase: 'rood', node: A, leeftijd: 150, ai: 'rood', cd: true }); dichtstbijOSM = { id: A, afstand: 3 };
    const lang = aankomstKleurNu(A);
    eis('AK2e een kleur van 150 s staat als 99 (twee cijfers)', lang === 'r99c', 'r99c', lang);
    // AK3
    const toegestaan = new Set(['t', 'n', 'c', 'ma', 'dd', 's', 'wg', 'v', 'va', 'vt', 'ka']);
    const vreemd = log.flatMap(r => Object.keys(r).filter(k => !toegestaan.has(k)));
    const ok3 = !!a && a.c === 'g' && a.ma === 0 && typeof a.t === 'number' && typeof a.dd === 'string' && vreemd.length === 0 && !/lat|lon/.test(JSON.stringify(log));
    eis('AK3 bestaande velden ongewijzigd, ka het enige nieuwe veld, geen positie', ok3, 'c g, ma 0, geen andere velden', kort({ a, vreemd }));

    // AK4: vingerafdrukken van V11.38.13 (kladmap/v113814/pins_v113813.json), zonder de regels V11.38.14.
    const PIN = {
      selecteerBesteDetectie: '96e20295', tikStraalVast: 'ebd6e223', tikStraalYolo: '7014cad2', tikStraalCam: '83ae570a', tikSlotMatch: 'd42b2f71', tikZet: '541de6e2',
      tikWeiger: '63e0c4bb', stickySlotMatch: '6ac2af1a', stickyVoorspel: 'f5cc4e22', stickyProjecteer: '67c1517b', stickyNeemOver: 'c06db2ce', stickyCam: '53d4530d',
      slotIsBuur: '406728eb', slotZonderBuur: '7b0d97c9', slotBovengrens: '39e18403', autoSlotZet: 'b132d1e2', autoSlotActief: 'f6d9de74', voorkeurIsRijp: '3e7bba4d',
      berekenCropRegio: 'ca7bd568', slotMisTik: 'eef7c2e6', verwerkFase: '5335de24', faseMagOfficieelWorden: '8e6db571', tolerantieVerlopen: 'f8ff54c3', verwerkS2: '6c7c8546',
      updateUI: '3170b33d', kiesCountdownBron: '95562985', bevestigCountdown: 'a41caa7e', slaOp: 'ac8cb808', slaOpIntern: '1da5de11', verwerkDetecties: '319a4ea6',
      _verwerkWorkerResultaatKern: '489edded', tikDichtbijStraal: '5d5202cc', tikDichtbijNa: '69e7961b', slotMeetTik: '766a9009', autoSlotLogZet: 'a0362b98', autoSlotLogTik: '725bb9d2',
      doorTik: '5a6d18a1', doorSluit: '1063f5a5', doorSchrijf: 'b670ff76', doorBergOp: 'b10d1865', passageKleur: 'e33849c1', passageTik: '8bcd3b99',
      passageSchrijf: '85a60e62', startCd: '5b67624c', stopCd: 'a8e347f0', updateUIKleur: 'f090d8b5', resetUIKleur: '5445c75d', resetNeutraal: '72d9e050',
      beeindigFase: '8234b742', onGPS: 'ae3dee31', meetRingSchrijf: '60245787', exporteerMeetdata: '23f027ff',
    };
    const zonder = (t) => String(t).split(NL).filter(l => !/V11\.38\.14(?!\d)/.test(l)).join(NL);
    const af = {};
    for (const n of Object.keys(PIN)) af[n] = (typeof window[n] === 'function') ? fnv(zonder(window[n])) : 'ONTBREEKT';
    const mis4 = Object.keys(PIN).filter(n => af[n] !== PIN[n]);
    eis('AK4 ' + Object.keys(PIN).length + ' functies byte-gelijk aan V11.38.13 (zonder de regels V11.38.14)', mis4.length === 0, 'alles gelijk', kort({ mis4: mis4.map(n => n + '=' + af[n]) }));
    const tik = String(doorTik), sluit = String(doorSluit);
    eis('AK4b de twee haken staan op hun plek', /p\.c = c;\s*\n\s*aankomstKleurTik\(p, id, d\);/.test(tik) && /if \(s > 0\) rec\.s = s;\s*\n\s*aankomstKleurVeld\(p, rec\);/.test(sluit), 'na p.c en na s', '');

    // AK5: geen voorspelde kleur.
    const bron = (n) => (typeof window[n] === 'function') ? String(window[n]) : '';
    // Alleen functies uit de app zelf (niet uit de toetsen): hun tekst staat letterlijk in een inline script van de pagina.
    const appTekst = [...document.scripts].filter(x => !x.src).map(x => x.textContent).join(NL);
    const fns = Object.keys(window).filter(n => { try { return typeof window[n] === 'function' && /^function /.test(String(window[n])) && appTekst.includes(String(window[n])); } catch (e) { return false; } });
    const zonderCommentaar = (t) => t.split(NL).map(l => l.replace(/\/\/.*$/, '')).join(NL);
    const zetLamp = fns.filter(n => /faseLamp\.className\s*=[^=]/.test(zonderCommentaar(bron(n)))).sort();
    const roeptUpdateUI = fns.filter(n => n !== 'updateUI' && /\bupdateUI\(/.test(zonderCommentaar(bron(n)))).sort();
    const roeptVerwerkFase = fns.filter(n => n !== 'verwerkFase' && /\bverwerkFase\(/.test(zonderCommentaar(bron(n)))).sort();
    const argUIK = [...zonderCommentaar(bron('verwerkDetecties')).matchAll(/updateUIKleur\(([^,]+),/g)].map(m => m[1].trim());
    const roeptUIK = fns.filter(n => n !== 'updateUIKleur' && /\bupdateUIKleur\(/.test(zonderCommentaar(bron(n)))).sort();
    const fbRechts = [...new Set(fns.flatMap(n => [...zonderCommentaar(bron(n)).matchAll(/\bfaseBevestigd\s*=\s*([^=;][^;]*);/g)].map(m => m[1].trim())))].sort();
    const ok5 = JSON.stringify(zetLamp) === JSON.stringify(['resetNeutraal', 'resetUIKleur', 'updateUI', 'updateUIKleur'])
      && JSON.stringify(roeptUpdateUI) === JSON.stringify(['verwerkFase'])
      && JSON.stringify(roeptVerwerkFase) === JSON.stringify(['verwerkDetecties']) && /verwerkFase\(aiR\.kleur,/.test(bron('verwerkDetecties'))
      && JSON.stringify(roeptUIK) === JSON.stringify(['verwerkDetecties'])
      && argUIK.every(x => ['aiR.kleur', 'faseBevestigd', 'savedFaseBevestigd'].includes(x)) && argUIK.length === 3
      && fbRechts.every(x => ['aiR.kleur', 'savedFaseBevestigd', 'nieuw', "'rood'", 'null'].includes(x.replace(/\s*\/\/.*$/, '')));
    eis('AK5 de lampkleur komt alleen uit een detectie of een vastgehouden detectie (geen voorspelling)', ok5,
        'lamp: 4 functies; updateUI <- verwerkFase <- verwerkDetecties(aiR.kleur)', kort({ zetLamp, roeptUpdateUI, roeptVerwerkFase, roeptUIK, argUIK, fbRechts }));

    // AK6: opslag.
    const regel = { t: 1790000000000, n: 1234567890, c: 'g', ma: 12, dd: 'avond', s: 5, wg: 1, v: 1234567891, va: 224, vt: 23 };
    const zonderKa = JSON.stringify(Array.from({ length: 500 }, () => regel)).length;
    const metKa = JSON.stringify(Array.from({ length: 500 }, () => ({ ...regel, ka: 'r99cr99cr99c' }))).length;
    const extraKB = (metKa - zonderKa) / 1024;
    eis('AK6 500 regels met het langste veld: hooguit 10 KB extra', extraKB <= 10, '<= 10 KB', extraKB.toFixed(2) + ' KB');
  } catch (e) {
    eis('AK crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    osmCache = bew.osmCache; dichtstbijOSM = bew.dichtstbijOSM; fase = bew.fase; faseNodeId = bew.faseNodeId; faseStart = bew.faseStart;
    geenTeller = bew.geenTeller; aiKleur = bew.aiKleur; aiTellerStart = bew.aiTellerStart; cdStart = bew.cdStart; activeCdDoel = bew.activeCdDoel;
    snelheidKmh = bew.snelheidKmh; doorStaat = bew.doorStaat; faseLamp.className = bew.lamp;
    if (!bew.gestopt) meetRingGestopt.delete(DOOR_SLEUTEL);
    try { if (opslag === null) localStorage.removeItem(DOOR_SLEUTEL); else localStorage.setItem(DOOR_SLEUTEL, opslag); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}
window.testAankomstkleurV113814 = testAankomstkleurV113814;
