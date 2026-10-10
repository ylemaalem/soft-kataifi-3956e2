// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_achter.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.4: de achter-regel. Een gepasseerd licht gaat los, met en
//  zonder tik- of lijstslot; een licht achter je wordt geen nieuwe keuze; verder
//  dan 400 m toont de app geen licht.
//
//  Het vaste stratenplan: x naar het oosten, y naar het noorden, in meters; de
//  auto rijdt (meestal) noordwaarts over x = 0.
//
//  AR1  de constanten, en de voorbij-toets zelf (voorbijStap), stap voor stap
//  AR2  het veldgeval van 4 oktober (19:13:53 en 19:34:20): een tik zet een licht
//       vast dat al achter de auto ligt; los na twee GPS-tikken, niet na 100 m
//  AR3  zonder slot: een gepasseerd licht gaat los, ook als de voorsprongregel het
//       nog vast wilde houden
//  AR4  geen licht: na het laatste licht, na een herstart met alleen een licht
//       achter je (3 okt 12:32, 200-382 m), en verder dan 400 m bij stilstand
//  AR5  de bocht: een goed licht blijft staan (30 sept 16:54: 10 m opzij op 98
//       graden vlak voor de stop; een koers die achterloopt; Dodeweg 27 sept:
//       stilstand met een oude koers)
//  AR6  PER GPS-TIK: in elke rit met de regel aan en uit, waar verschilt de keuze?
//       Alleen waar het licht van 'uit' achter de auto ligt of verder dan 400 m
//  AR7  waar de regel niets mag veranderen, is elke tik gelijk
//  AR8  een lopende meting (de uitgestelde V5/V4-schrijving) loopt ook zonder
//       getoond licht door
//  AR9  de schaduwregel: de slimmere mastregel (Energieweg) en het vasthouden
//       (Markerkant)
//  AR10 de eenmalige reparatie van 4065739949 (optie b)
//  AR11 regressie: welke functies veranderen, en dat de rest byte-gelijk is
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_achter.js';
//      document.head.appendChild(s);
//      s.onload = () => testAchter().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
// opt: { nodes: [{ id, x, y }], start, slot: 'tik'|'lijst'|null, lamp, lampZiet, koersen, uitAchter, v9: { node, duur },
//        punten: [{ x, y, kmh, h? }] } — één GPS-tik per punt, 1 s ertussen; h = koers (anders uit de beweging)
async function achterRitBinnen(opt) {
  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.uitAchter) window.achterAan = () => false;
  const schrijf = [];
  if (opt.v9) {
    const echt = window.voerV9DelayedWriteUit;
    window.voerV9DelayedWriteUit = function (...a) { schrijf.push({ t: klok, licht: dichtstbijOSM ? dichtstbijOSM.id : null, reden: a[1] }); return echt.apply(this, a); };
  }
  try { for (const k of ['sl_wissellog', 'sl_opslaglog', 'sl_regellog', TIKLOG_SLEUTEL]) localStorage.setItem(k, '[]'); } catch (e) {}
  tikLogArr = null; tikLogStop = false; tikLogVorige = { tak: null, t: 0 }; tikLogLevend = null;
  osmCache = opt.nodes.map(n => ({ id: n.id, naam: String(n.id), ...LL(n.x, n.y) }));
  cacheGeladen = true; cacheBezig = false; cacheCentrum = LL(0, 0);
  eersteGPSVerwerkt = true;
  clusterNodes = new Set();
  const start = opt.start != null ? osmCache.find(n => n.id === opt.start) : null;
  dichtstbijOSM = start ? { ...start, afstand: 150 } : null; vorigOsmId = start ? start.id : null;
  handmatigLockActief = false; stilstandAutoLock = false;
  handmatigGeselecteerdNodeId = null; handmatigGeselecteerdTimestamp = 0;
  stilstandSinds = 0; laatsteNodeCorrectieTijd = 0; laatsteNodeWisselTijd = 0;
  headingBuffer.length = 0;
  if (opt.koersen) for (const h of opt.koersen) headingBuffer.push(h);
  hoekStabielReset(); handLockVervalReset(); naderBewijsReset();
  wisselStaat = null; wisselTik = null; a3Reeks = null; a3LosTijd = 0;
  regelReset(); achterReset(); achterLosTijd = 0; geenLichtSinds = 0;
  tikSlotMerk = null; snelReset();
  if (opt.slot === 'tik') vergrendelNodeHandmatig(start.id, 'beeld');
  else if (opt.slot === 'lijst') vergrendelNodeHandmatig(start.id, 'lijst');
  if (opt.lamp) { tikZet(null, 1000, 800); bboxOverrideLaatsteMatch = klok - 5000; }
  if (opt.v9) {
    v9KandidaatNode = String(opt.v9.node); v9KandidaatDuur = opt.v9.duur; v9DelayedWriteActief = false;
    v9AanrijHeading = 1; v9AanrijSnelheidHeading = 1; v9LaatstLageSnelheid = 0;
  }
  const rij = [];
  let vorige = null;
  for (const p of opt.punten) {
    klok += 1000;
    const v = p.kmh / 3.6;
    let h = p.h;
    if (h == null) h = (vorige && (p.x !== vorige.x || p.y !== vorige.y)) ? (Math.atan2(p.x - vorige.x, p.y - vorige.y) * 180 / Math.PI + 360) % 360 : 1;
    if (Math.round(h) === 0) h = 1;   // een koers van precies 0 is voor isStoplichtVoorbij 'geen koers'
    const q = LL(p.x, p.y);
    if (opt.lampZiet && bboxOverride !== null) bboxOverrideLaatsteMatch = klok;   // de lamp blijft in beeld
    let fout = null;
    try {
      await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: v > 0 ? h : NaN }, timestamp: klok });
      tikLogWaak();
    } catch (e) { fout = String(e && e.message || e).slice(0, 120); }
    const app = dichtstbijOSM ? dichtstbijOSM.id : null;
    rij.push({ x: p.x, y: Math.round(p.y * 10) / 10, kmh: p.kmh, app, slot: handmatigLockActief ? 1 : 0, lamp: bboxOverride !== null ? 1 : 0,
               naam: kNaam.textContent, leer: leerNaam.textContent, fase, fout,
               peil: dichtstbijOSM ? peilingTovRijrichting(q, dichtstbijOSM, h) : null,
               af: dichtstbijOSM ? Math.round(afstand(q.lat, q.lon, dichtstbijOSM.lat, dichtstbijOSM.lon)) : null });
    vorige = p;
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  return { rij, wissel: lees('sl_wissellog'), tik: lees(TIKLOG_SLEUTEL), op: lees('sl_opslaglog').map(r => r.reden), schrijf,
           v9: { kand: v9KandidaatNode, dw: v9DelayedWriteActief } };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testAchter() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const NL = String.fromCharCode(10);
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  // Sleutel voor sleutel, niet met clear(): de IndexedDB-spiegel ziet clear() niet.
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };

  // ═══ AR1 — de constanten en de voorbij-toets ═══════════════
  eis('AR1a de constanten: aan, 5 km/u, 2 posities, samen 5 m, 90 graden, 400 m',
      ACHTER_ACTIEF === true && ACHTER_MIN_KMH === 5 && ACHTER_STIJG_N === 2 && ACHTER_STIJG_M === 5 && ACHTER_HOEK === 90 && ACHTER_MAX_M === 400
        && achterAan() === true,
      'aan/5/2/5/90/400', [ACHTER_ACTIEF, ACHTER_MIN_KMH, ACHTER_STIJG_N, ACHTER_STIJG_M, ACHTER_HOEK, ACHTER_MAX_M].join('/'));
  const reeks = (ds) => { let r; const uit = []; for (const d of ds) { r = voorbijStap(r, d); uit.push(r.voorbij ? 'V' : '.'); } return uit.join(''); };
  eis('AR1b voorbij na twee stijgingen op rij die samen minstens 5 m zijn (10, 4, 1, 6, 12)', reeks([10, 4, 1, 6, 12]) === '....V', '....V', reeks([10, 4, 1, 6, 12]));
  eis('AR1c twee kleine stijgingen (samen 2 m) zijn niet genoeg; een derde die het samen 6 m maakt wel', reeks([10, 11, 12]) === '...' && reeks([10, 11, 12, 16]) === '...V',
      '... en ...V', reeks([10, 11, 12]) + ' en ' + reeks([10, 11, 12, 16]));
  eis('AR1d een gelijke of dalende afstand begint de telling opnieuw', reeks([10, 13, 13, 16]) === '....' && reeks([10, 13, 12, 16]) === '....',
      '.... en ....', reeks([10, 13, 13, 16]) + ' en ' + reeks([10, 13, 12, 16]));
  eis('AR1e rijd je er weer naartoe (twee keer dalend, samen 5 m), dan is het licht niet meer voorbij', reeks([10, 13, 18, 20, 17, 13]) === '..VVV.',
      '..VVV.', reeks([10, 13, 18, 20, 17, 13]));
  eis('AR1f de schaduwregel gebruikt dezelfde toets (voorbijStap in regelKies)', /voorbijStap\(/.test(zc(regelKies)) && /voorbijStap\(/.test(zc(achterTik)),
      'beide', 'ok');

  // ═══ ritten ════════════════════════════════════════════════
  const bron = new URL('test_achter.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?achter=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      const w = f.contentWindow;
      await new Promise((ok, nee) => {
        const sc = w.document.createElement('script');
        sc.src = bron + '?t=' + Date.now(); sc.onload = ok; sc.onerror = () => nee(new Error('laden'));
        w.document.head.appendChild(sc);
      });
      return await w.achterRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], wissel: [], tik: [], op: [], schrijf: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const lijn = (vanY, totY, kmh, x = 0) => { const p = [], v = kmh / 3.6; for (let y = vanY; y <= totY + 1e-9; y += v) p.push({ x, y, kmh }); return p; };
  const fouten = (r) => r.fout || (r.rij.find(x => x.fout) || {}).fout || null;
  const eersteNaar = (r, id) => r.rij.find(x => x.app === id) || null;
  const A = 9700001, B = 9700002, Z = 9700003, H = 9700004, M = 9700005, D = 9700006, E = 9700007;

  // ═══ AR2 — het veldgeval: een tik zet een licht achter je vast ═════
  // De app toont A, dat al 70 m achter de auto ligt; een tik op het beeld zet A vast. B ligt 180 m vooruit. De getikte
  // lamp blijft in beeld (het is de lamp van het volgende kruispunt), dus A3 wacht.
  const ar2 = { nodes: [{ id: A, x: 0, y: 0 }, { id: B, x: 0, y: 250 }], start: A, slot: 'tik', lamp: true, lampZiet: true, punten: lijn(70, 200, 50) };
  const met2 = await rit(ar2), zonder2 = await rit({ ...ar2, uitAchter: true });
  const b2 = eersteNaar(met2, B) || {}, b2z = eersteNaar(zonder2, B) || {};
  eis('AR2a met de regel: het slot op het licht achter je gaat los na twee GPS-tikken (op ~98 m van A, 2 s), en meteen staat B er',
      !fouten(met2) && b2.y !== undefined && b2.y <= 70 + 2 * 50 / 3.6 + 0.5 && b2.slot === 0, 'binnen 2 tikken, B',
      fouten(met2) || `B vanaf y=${b2.y}, slot ${b2.slot}`);
  eis('AR2b zonder de regel duurt het langer (A3 wacht op de lamp, de vervalroute op 100 m)',
      !fouten(zonder2) && (b2z.y === undefined || b2z.y > b2.y), 'later', fouten(zonder2) || `zonder: B vanaf y=${b2z.y}`);
  eis('AR2c de tiklog zegt los: achter, en de wissellog A->B met reden achter',
      met2.tik.filter(r => r.s === 'los').map(r => r.reden).join('+') === 'achter' && met2.wissel.length === 1 && met2.wissel[0].r === 'achter'
        && met2.wissel[0].van === A && met2.wissel[0].naar === B && met2.wissel[0].ac === 1,
      'los achter; wissel achter, ac 1', met2.tik.filter(r => r.s === 'los').map(r => r.reden).join('+') + '; ' + met2.wissel.map(x => `${x.van}>${x.naar} ${x.r} ac ${x.ac}`).join(' ; '));

  // ═══ AR3 — zonder slot ═════════════════════════════════════
  // A op 0; het volgende licht B pas op 600 m. Zonder ander licht binnen 400 m wint A (achter je) de puntentelling,
  // zoals in de 14 episodes zonder slot. Met een ander licht dichtbij wint dat al op punten (dat verandert niet).
  const ar3 = { nodes: [{ id: A, x: 0, y: 0 }, { id: B, x: 0, y: 600 }], start: A, punten: lijn(-60, 260, 36) };
  const met3 = await rit(ar3), zonder3 = await rit({ ...ar3, uitAchter: true });
  const los3 = met3.rij.findIndex(x => x.app !== A), los3z = zonder3.rij.findIndex(x => x.app !== A);
  eis('AR3a zonder slot: met de regel gaat A los na twee tikken met oplopende afstand (< 30 m voorbij), reden achter, en tot B binnen 400 m is: geen licht',
      !fouten(met3) && los3 >= 0 && met3.rij[los3].y > 0 && met3.rij[los3].y < 30 && met3.wissel.some(w => w.van === A && w.r === 'achter'),
      '< 30 m, achter', fouten(met3) || `los op y=${(met3.rij[los3] || {}).y}, ${met3.wissel.map(w => w.r).join('+')}`);
  eis('AR3b zonder de regel blijft A (achter je) staan tot B binnen 400 m komt: bijna 200 m',
      !fouten(zonder3) && los3z > los3 && zonder3.rij[los3z].y >= 190 && zonder3.rij[los3z].app === B, 'A tot ~200 m, dan B',
      `zonder: los op y=${los3z < 0 ? 'nooit' : zonder3.rij[los3z].y}, dan ${los3z < 0 ? '-' : zonder3.rij[los3z].app}`);

  // c. De voorsprongregel: A 8 m opzij gepasseerd; het enige andere licht, B, ligt ver opzij (370 m, 77 graden) en
  //    scoort zo zwak dat de voorsprongregel A zou vasthouden. Een gepasseerd licht krijgt geen voorsprong.
  const ar3c = { nodes: [{ id: A, x: 8, y: 0 }, { id: B, x: 360, y: 100 }], start: A, punten: lijn(-40, 60, 36) };
  const met3c = await rit(ar3c), zonder3c = await rit({ ...ar3c, uitAchter: true });
  const b3c = eersteNaar(met3c, B) || {}, b3cz = eersteNaar(zonder3c, B) || {};
  eis('AR3c een gepasseerd licht krijgt geen voorsprong: zodra A voorbij is (y = 20), staat B er, reden achter; zonder de regel houdt de voorsprongregel A vast',
      !fouten(met3c) && b3c.y === 20 && met3c.wissel.some(w => w.van === A && w.naar === B && w.r === 'achter') && (b3cz.y === undefined || b3cz.y > 20),
      'B op y=20, achter; zonder: later', fouten(met3c) || `B vanaf y=${b3c.y}, ${met3c.wissel.map(w => `${w.van}>${w.naar} ${w.r}`).join(' ; ')}; zonder: ${b3cz.y === undefined ? 'nooit' : 'y=' + b3cz.y}`);

  // ═══ AR4 — geen licht ══════════════════════════════════════
  // a. Na het laatste licht: A op 0, Z pas op 700 m. Rijd door tot y = 360.
  const ar4 = { nodes: [{ id: A, x: 0, y: 0 }, { id: Z, x: 0, y: 700 }], start: A, punten: lijn(-60, 360, 50) };
  const met4 = await rit(ar4), zonder4 = await rit({ ...ar4, uitAchter: true });
  const geen4 = met4.rij.find(x => x.app === null) || {};
  eis('AR4a na het passeren van het laatste licht: geen licht, met de tekst "Geen stoplicht binnen 400 m"; zonder de regel blijft er een licht staan',
      !fouten(met4) && geen4.y > 0 && geen4.y < 30 && geen4.naam === 'Geen stoplicht binnen 400 m' && geen4.leer === 'Geen stoplicht in de buurt'
        && zonder4.rij.every(x => x.app !== null),
      'geen licht < 30 m na A', fouten(met4) || `geen vanaf y=${geen4.y}, '${geen4.naam}'; zonder: ${zonder4.rij.filter(x => x.app === null).length} tikken zonder licht`);
  const z4 = eersteNaar(met4, Z) || {};
  eis('AR4b Z verschijnt pas binnen 400 m, en de wissellog zegt A->0 (achter) en 0->Z (gevonden)',
      z4.y !== undefined && 700 - z4.y <= 400 && 700 - z4.y > 390 - 14
        && met4.wissel.some(w => w.van === A && w.naar === 0 && w.r === 'achter') && met4.wissel.some(w => w.van === 0 && w.naar === Z && w.r === 'gevonden'),
      'Z op <= 400 m; A->0 achter, 0->Z gevonden', `Z vanaf ${z4.y !== undefined ? 700 - z4.y : '-'} m; ${met4.wissel.map(w => `${w.van}>${w.naar} ${w.r}`).join(' ; ')}`);
  eis('AR4c zonder licht loopt elke GPS-tik foutloos, en de fase is leeg', met4.rij.filter(x => x.app === null).every(x => !x.fout && x.fase === null),
      'geen fouten', fouten(met4) || 'ok');
  // b. 3 oktober 12:32: herstart bij 104 km/u, alleen H achter de auto (200 m) en Z op 900 m vooruit.
  const ar4b = { nodes: [{ id: H, x: 0, y: -200 }, { id: Z, x: 0, y: 900 }], start: null, punten: lijn(0, 200, 104) };
  const met4b = await rit(ar4b), zonder4b = await rit({ ...ar4b, uitAchter: true });
  eis('AR4d herstart met alleen een licht achter je (200 m): de regel kiest het nooit, en niets op 900 m; zonder de regel wel',
      !fouten(met4b) && met4b.rij.every(x => x.app === null) && zonder4b.rij.some(x => x.app === H),
      'geen licht; zonder: H', fouten(met4b) || `met: ${[...new Set(met4b.rij.map(x => x.app))].join(',')}; zonder: ${[...new Set(zonder4b.rij.map(x => x.app))].join(',')}`);
  // c. Stilstand, het enige licht op 450 m: geen licht (de terugvalgrens geldt ook bij stilstand).
  const ar4c = { nodes: [{ id: Z, x: 0, y: 450 }], start: null, punten: [{ x: 0, y: 0, kmh: 0 }, { x: 0, y: 0, kmh: 0 }, { x: 0, y: 0, kmh: 0 }] };
  const met4c = await rit(ar4c), zonder4c = await rit({ ...ar4c, uitAchter: true });
  eis('AR4e stilstaand met alleen een licht op 450 m: geen licht; zonder de regel toont de terugval het wel',
      !fouten(met4c) && met4c.rij.every(x => x.app === null) && zonder4c.rij.every(x => x.app === Z),
      'geen; zonder: Z', `${met4c.rij.map(x => x.app).join(',')} / ${zonder4c.rij.map(x => x.app).join(',')}`);

  // ═══ AR5 — de bocht ════════════════════════════════════════
  // a. Markerkant (30 sept 16:54): M 10 m opzij; de auto remt af en stopt 3 m voorbij (98 graden).
  const rem = [...lijn(-80, -14, 36), { x: 0, y: -8, kmh: 22 }, { x: 0, y: -3, kmh: 14 }, { x: 0, y: 0, kmh: 8 }, { x: 0, y: 2, kmh: 5 }, { x: 0, y: 3, kmh: 2 },
               { x: 0, y: 3, kmh: 0 }, { x: 0, y: 3, kmh: 0 }, { x: 0, y: 3, kmh: 0 }];
  const ar5 = { nodes: [{ id: M, x: 10, y: 0 }, { id: B, x: 0, y: 300 }], start: M, punten: rem };
  const met5 = await rit(ar5);
  const laatste5 = met5.rij[met5.rij.length - 1] || {};
  eis('AR5a een licht 10 m opzij blijft staan tot en met de stop op 98 graden (de afstand liep geen 5 m op)',
      !fouten(met5) && met5.rij.every(x => x.app === M) && Math.abs(laatste5.peil) > 90,
      'M in elke tik', fouten(met5) || met5.rij.map(x => x.app === M ? 'M' : String(x.app)).join(''));
  // b. Een koers die achterloopt: L recht vooruit op 100 m, maar de GPS-koers wijst twee tikken lang naar het zuiden.
  const pb = lijn(0, 40, 36).map((p, i) => (i === 2 || i === 3) ? { ...p, h: 180 } : p);
  const ar5b = { nodes: [{ id: E, x: 0, y: 100 }, { id: H, x: 0, y: -60 }], start: E, punten: pb };
  const met5b = await rit(ar5b);
  eis('AR5b met een koers die even 180 graden verkeerd staat, blijft het licht vooruit staan, en het licht achter je komt er niet tussen',
      !fouten(met5b) && met5b.rij.every(x => x.app === E), 'E in elke tik', fouten(met5b) || met5b.rij.map(x => String(x.app).slice(-1)).join(''));
  // c. Dodeweg (27 sept 15:05): stilstand met een oude koers (66 graden); D ligt op -134 graden en 16 m, E 40 m vooruit.
  const rad = Math.PI / 180, pk = (gr, m) => ({ x: Math.round(Math.sin(gr * rad) * m * 10) / 10, y: Math.round(Math.cos(gr * rad) * m * 10) / 10 });
  const ar5c = { nodes: [{ id: D, ...pk(66 - 134, 16) }, { id: E, ...pk(66, 40) }], start: null, koersen: [66, 66, 66],
                 punten: [{ x: 0, y: 0, kmh: 0 }, { x: 0, y: 0, kmh: 0 }, { x: 0, y: 0, kmh: 0 }] };
  const met5c = await rit(ar5c), zonder5c = await rit({ ...ar5c, uitAchter: true });
  eis('AR5c stilstaand met een oude koers telt de hoek niet: het licht op -134 graden en 16 m wordt gekozen, net als zonder de regel',
      !fouten(met5c) && met5c.rij.every(x => x.app === D) && JSON.stringify(met5c.rij.map(x => x.app)) === JSON.stringify(zonder5c.rij.map(x => x.app)),
      'D, gelijk', `${met5c.rij.map(x => x.app).join(',')} / ${zonder5c.rij.map(x => x.app).join(',')}`);

  // ═══ AR6 — per GPS-tik: waar verschilt de keuze? ═══════════
  // Elke rit met de regel aan en uit. Een verschil mag alleen in een tik waarin het licht van 'uit' achter de auto
  // ligt (meer dan 90 graden) of verder dan 400 m weg is.
  const ritten6 = [
    ['tik, doorrijden (AR2)', ar2], ['zonder slot, voorsprong (AR3)', ar3], ['geen licht (AR4a)', ar4], ['herstart, licht achter (AR4d)', ar4b],
    ['lijstkeuze, doorrijden', { nodes: [{ id: A, x: 0, y: 0 }, { id: B, x: 0, y: 150 }], start: A, slot: 'lijst', punten: lijn(-120, 140, 30) }],
    ['kruispunt met overkant', { nodes: [{ id: A, x: 0, y: 0 }, { id: H, x: 8, y: 25 }, { id: B, x: 0, y: 200 }], start: A, punten: lijn(-80, 160, 36) }],
    ['bocht naar rechts', { nodes: [{ id: A, x: 0, y: 0 }, { id: B, x: 150, y: 20 }],
       start: A, punten: [...lijn(-60, 0, 30), ...[10, 20, 30, 40, 50, 60, 70, 80, 90].map(x => ({ x, y: 10, kmh: 30 }))] }]
  ];
  const verschillen = [];
  let tikkenTotaal = 0, tikkenAnders = 0, onterecht = 0;
  // De voorbij-toets van de app (voorbijStap) over de posities van de rit, voor licht id, tot en met tik i.
  const LAT0 = 52.1550, LON0 = 5.3870, mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const voorbijTot = (opt, id, i) => { const n = opt.nodes.find(x => x.id === id); if (!n) return false; let r, vorige = null;
    for (let j = 0; j <= i; j++) { const p = opt.punten[j]; if (!(p.kmh >= ACHTER_MIN_KMH)) continue; if (vorige && vorige.x === p.x && vorige.y === p.y) continue;
      vorige = p; r = voorbijStap(r, afstand(LAT0 + p.y / mLat, LON0 + p.x / mLon, LAT0 + n.y / mLat, LON0 + n.x / mLon)); }
    return !!(r && r.voorbij); };
  for (const [naam, opt] of ritten6) {
    const met = await rit(opt), zonder = await rit({ ...opt, uitAchter: true });
    const n = Math.min(met.rij.length, zonder.rij.length);
    let anders = 0, fout = 0; const waar = [];
    for (let i = 0; i < n; i++) {
      tikkenTotaal++;
      if (met.rij[i].app === zonder.rij[i].app) continue;
      anders++; tikkenAnders++;
      const z = zonder.rij[i];
      const terecht = z.app !== null && (voorbijTot(opt, z.app, i) || (z.peil !== null && Math.abs(z.peil) > 90) || z.af > 400);
      if (!terecht) { fout++; onterecht++; }
      if (waar.length < 4) waar.push(`y=${z.y}: uit ${z.app} (${z.af} m, ${z.peil} gr) / aan ${met.rij[i].app}`);
    }
    verschillen.push(`${naam}: ${anders} van ${n} tikken anders${fout ? ', ' + fout + ' ONTERECHT' : ''}${waar.length ? ' — ' + waar.join('; ') : ''}`);
  }
  eis('AR6 per GPS-tik: de keuze verschilt alleen waar het licht van "uit" gepasseerd is (de voorbij-toets), achter de auto ligt of verder dan 400 m',
      onterecht === 0 && tikkenAnders > 0, '0 onterecht', `${tikkenAnders} van ${tikkenTotaal} tikken anders, ${onterecht} onterecht | ` + verschillen.join(' | '));

  // ═══ AR7 — waar de regel niets mag veranderen ══════════════
  const zelfde = (p, q) => JSON.stringify(p.rij.map(x => [x.y, x.app, x.slot, x.lamp])) === JSON.stringify(q.rij.map(x => [x.y, x.app, x.slot, x.lamp]))
    && JSON.stringify(p.wissel.map(x => [x.van, x.naar])) === JSON.stringify(q.wissel.map(x => [x.van, x.naar]));
  const stilAan = [...lijn(-100, -4, 36), ...Array(8).fill({ x: 0, y: -4, kmh: 0 })];
  const gevallen7 = [
    ['naderen en stoppen voor het licht', { nodes: [{ id: A, x: 0, y: 0 }, { id: B, x: 0, y: 200 }], start: A, punten: stilAan }],
    ['naderen met een tik en stoppen', { nodes: [{ id: A, x: 0, y: 0 }, { id: B, x: 0, y: 200 }], start: A, slot: 'tik', lamp: true, punten: stilAan }],
    ['twee lichten vooruit, het dichtere wint vóór het passeren', { nodes: [{ id: A, x: 0, y: 120 }, { id: B, x: 3, y: 60 }], start: A, punten: lijn(-100, 40, 36) }],
    ['kruipen onder 5 km/u langs het licht', { nodes: [{ id: A, x: 0, y: 0 }, { id: B, x: 0, y: 200 }], start: A,
       punten: [...lijn(-30, -2, 18), ...[0, 1, 2, 3, 4, 5, 6].map(y => ({ x: 0, y, kmh: 3 }))] }],
    ['stilstand met een lijstkeuze', { nodes: [{ id: A, x: 0, y: 0 }, { id: B, x: 5, y: 3 }], start: B, slot: 'lijst', punten: Array(6).fill({ x: 0, y: -2, kmh: 0 }) }]
  ];
  for (const [naam, opt] of gevallen7) {
    const met = await rit(opt), zonder = await rit({ ...opt, uitAchter: true });
    eis('AR7 ' + naam + ': met en zonder de regel in elke GPS-tik dezelfde keuze, hetzelfde slot, dezelfde lamp en dezelfde wissels',
        !fouten(met) && !fouten(zonder) && met.rij.length > 4 && zelfde(met, zonder),
        'gelijk', fouten(met) || fouten(zonder) || met.rij.map((x, i) => x.app === (zonder.rij[i] || {}).app ? '=' : 'x').join(''));
  }

  // ═══ AR8 — de lopende meting zonder getoond licht ═══════════
  // A had een rood van 20 s (v9KandidaatDuur); na A komt geen licht binnen 400 m. De uitgestelde schrijving moet doorlopen.
  const ar8 = { nodes: [{ id: A, x: 0, y: 0 }, { id: Z, x: 0, y: 900 }], start: A, v9: { node: A, duur: 20 }, punten: lijn(-30, 200, 36) };
  const met8 = await rit(ar8), zonder8 = await rit({ ...ar8, uitAchter: true });
  eis('AR8 de uitgestelde schrijving voor A gebeurt ook als er geen licht meer getoond wordt, met dezelfde reden en hooguit twee GPS-tikken na die zonder de regel',
      !fouten(met8) && met8.schrijf.length === 1 && met8.schrijf[0].licht === null && zonder8.schrijf.length === 1
        && met8.schrijf[0].reden === zonder8.schrijf[0].reden && Math.abs(met8.schrijf[0].t - zonder8.schrijf[0].t) <= 2000 && met8.v9.kand === null,
      '1 schrijving, zonder licht, zelfde tik', fouten(met8) || JSON.stringify({ met: met8.schrijf, zonder: zonder8.schrijf, kand: met8.v9.kand }));

  // ═══ AR9 — de schaduwregel: mastregel en vasthouden ═════════
  {
    const LAT0 = 52.20, LON0 = 5.40, mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
    const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
    const bew = { osmCache, cacheGeladen, dichtstbijOSM, stilstandSinds, snelheidKmh, handmatigLockActief, stilstandAutoLock, nu: Date.now };
    const bewKoers = headingBuffer.slice();
    let klok = 1790000000000;
    try {
      Date.now = () => klok;
      const opzet = (nodes) => { osmCache = nodes; cacheGeladen = true; dichtstbijOSM = null; stilstandSinds = 0; handmatigLockActief = false; stilstandAutoLock = false;
        headingBuffer.length = 0; for (let i = 0; i < 3; i++) headingBuffer.push(1); regelReset(); meetRingGestopt.delete(REGELLOG_SLEUTEL); localStorage.setItem(REGELLOG_SLEUTEL, '[]'); };
      const tikR = (x, y, kmh) => { klok += 1000; snelheidKmh = kmh; if (kmh < 3) { if (!stilstandSinds) stilstandSinds = klok; } else stilstandSinds = 0;
        const p = LL(x, y); regelTik(p.lat, p.lon); return regelStaat.keuze; };
      // Energieweg: P gepasseerd, de volgende stopstreep N 59 m verder op dezelfde weg, verder niets.
      const P = { id: 9800001, ...LL(0, 0) }, N = { id: 9800002, ...LL(0, 59) };
      opzet([P, N]);
      const keuzes = []; for (let y = -40; y <= 50; y += 6) keuzes.push([y, tikR(0, y, 22)]);
      const opN = keuzes.filter(([y, k]) => k === String(N.id)).map(([y]) => y);
      eis('AR9a Energieweg: na het passeren van P kiest de regel de stopstreep 59 m verder zodra je het kruispunt over bent (vanaf ~30 m na P), niet pas bij aankomst',
          opN.length > 0 && opN[0] >= 26 && opN[0] <= 38 && keuzes.filter(([y]) => y >= opN[0]).every(([y, k]) => k === String(N.id)),
          'N vanaf ~30 m', keuzes.map(([y, k]) => `${y}:${k === String(P.id) ? 'P' : k === String(N.id) ? 'N' : '-'}`).join(' '));
      // De overkant van hetzelfde kruispunt (25 m na P) wordt tijdens het oversteken nog steeds overgeslagen.
      const F = { id: 9800003, ...LL(4, 25) };
      opzet([P, F, N]);
      const k2 = []; for (let y = -40; y <= 20; y += 6) k2.push([y, tikR(0, y, 22)]);
      eis('AR9b de overkant van hetzelfde kruispunt (25 m na P) slaat de regel tijdens het oversteken nog steeds over',
          !k2.some(([y, k]) => y > 0 && k === String(F.id)), 'F niet na P', k2.map(([y, k]) => `${y}:${k === String(P.id) ? 'P' : k === String(F.id) ? 'F' : k === String(N.id) ? 'N' : '-'}`).join(' '));
      // Markerkant: M 10 m opzij, de auto stopt 3 m voorbij (98 graden): de regel houdt M vast.
      const Mk = { id: 9800004, ...LL(10, 0) };
      opzet([Mk]);
      const k3 = []; for (const [y, kmh] of [[-60, 30], [-50, 30], [-40, 30], [-30, 30], [-20, 30], [-12, 25], [-6, 20], [-2, 14], [1, 8], [3, 5]]) k3.push(tikR(0, y, kmh));
      eis('AR9c Markerkant: de regel houdt het licht 10 m opzij vast tot de stop, ook voorbij 60 en 90 graden', k3.slice(1).every(k => k === String(Mk.id)),
          'M in elke tik', k3.map(k => k === String(Mk.id) ? 'M' : (k || '-')).join(''));
      eis('AR9d de nieuwe constanten van de schaduwregel: 30 m oversteken, 90 graden en 15 m vasthouden', REGEL_OVERSTEEK_M === 30 && REGEL_HOUD_HOEK === 90 && REGEL_HOUD_M === 15,
          '30/90/15', [REGEL_OVERSTEEK_M, REGEL_HOUD_HOEK, REGEL_HOUD_M].join('/'));
    } finally {
      osmCache = bew.osmCache; cacheGeladen = bew.cacheGeladen; dichtstbijOSM = bew.dichtstbijOSM; stilstandSinds = bew.stilstandSinds; snelheidKmh = bew.snelheidKmh;
      handmatigLockActief = bew.handmatigLockActief; stilstandAutoLock = bew.stilstandAutoLock; Date.now = bew.nu;
      headingBuffer.length = 0; for (const h of bewKoers) headingBuffer.push(h);
      regelReset(); herstel();
    }
  }

  // ═══ AR10 — de reparatie van 4065739949 ════════════════════
  {
    const S = 'sl_richting_4065739949', T = 1791134938561;
    const rec = (over) => ({ cx_zones: [], headings: [214, 216], bevestigingen: 18, laatste_update: T, tikrichting: 'links', tik_bevestigingen: 3, tik_cx_zone: 'links', ...over });
    const lees = () => { try { return JSON.parse(localStorage.getItem(S)); } catch (e) { return null; } };
    const logRep = () => { try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === 'reparatie_richting'); } catch (e) { return []; } };
    try {
      localStorage.setItem('sl_opslaglog', '[]');
      opslagSchrijf(S, rec({}));
      const r1 = reparatieRichting4065739949(), na = lees();
      eis('AR10a met de vingerafdruk (19:28:58,561): tikrichting rechts, 1 bevestiging, zone rechts; de rest en laatste_update blijven',
          r1 === true && na.tikrichting === 'rechts' && na.tik_bevestigingen === 1 && na.tik_cx_zone === 'rechts' && na.laatste_update === T
            && na.bevestigingen === 18 && JSON.stringify(na.headings) === '[214,216]',
          'rechts/1/rechts', JSON.stringify(na));
      eis('AR10b één logregel reparatie_richting, met wat er stond', logRep().length === 1 && logRep()[0].element === 'links/3 -> rechts/1',
          '1 regel, links/3 -> rechts/1', JSON.stringify(logRep()));
      const r2 = reparatieRichting4065739949();
      eis('AR10c een tweede keer doet niets (geen schrijving, geen tweede logregel)', r2 === false && logRep().length === 1, 'niets', String(r2) + ' / ' + logRep().length);
      opslagSchrijf(S, rec({ laatste_update: T + 1 }));
      const r3 = reparatieRichting4065739949(), na3 = lees();
      eis('AR10d een andere laatste_update (een tik of rit van later): niets verandert', r3 === false && na3.tikrichting === 'links' && na3.tik_bevestigingen === 3,
          'links/3', JSON.stringify({ r3, tik: na3.tikrichting, n: na3.tik_bevestigingen }));
      localStorage.removeItem(S);
      eis('AR10e zonder record doet hij niets', reparatieRichting4065739949() === false && localStorage.getItem(S) === null, 'niets', String(localStorage.getItem(S)));
      let bronTekst = '';
      try { bronTekst = await (await fetch(location.pathname + '?bron=' + Date.now())).text(); } catch (e) {}
      eis('AR10f hij draait bij het opstarten, direct na de andere eenmalige migraties', bronTekst.includes('migratieRvWezen();        // V11.17.92: eenmalig, zie daar' + NL + 'reparatieRichting4065739949();'),
          'na migratieRvWezen', !bronTekst ? 'bron niet geladen' : bronTekst.includes('reparatieRichting4065739949();') ? 'gevonden' : 'niet gevonden');
    } finally { herstel(); }
  }

  // ═══ AR11 — regressie ══════════════════════════════════════
  const zonder374 = (s) => s.split(NL).filter(l => !/V11\.37\.4/.test(l)).join(NL);
  const zonderV113713 = (s) => String(s).split('\n').filter(l => !/V11\.37\.13/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const terugV11378 = (s) => zonderV113711(s).replace("      if (wisselStaat.min === null || af < wisselStaat.min) { wisselStaat.min = af; wisselStaat.minT = Date.now(); }   // V11.37.8: en wanneer (tMin)", "      if (wisselStaat.min === null || af < wisselStaat.min) wisselStaat.min = af;").replace("  if (!dichtstbijOSM) { logOpslagMis('bevestig_geen_licht', { element: categorie }); return; }   // V11.37.8: niet meer stil", "  if (!dichtstbijOSM) return;").split('\n').filter(l => !/V11\.37\.8/.test(l)).join('\n');   // V11.37.8: het fietsfilter en de bevroren knoppen (test_fietslicht); hier terug
  const terugV11374 = (s) => s
    .replace('if ((dichtstbijOSM || (achterAan() && v9KandidaatNode !== null)) && cacheGeladen) {   // V11.37.4: een lopende meting loopt ook zonder getoond licht door', 'if (dichtstbijOSM && cacheGeladen) {')
    .replace('const afst = dichtstbijOSM ? dichtstbijOSM.afstand : Infinity;   // V11.37.4', 'const afst = dichtstbijOSM.afstand;')
    .replace('const nodeId = dichtstbijOSM ? String(dichtstbijOSM.id) : null;   // V11.37.4', 'const nodeId = String(dichtstbijOSM.id);')
    .replace('kandidaatPos ?? (dichtstbijOSM ? { lat: dichtstbijOSM.lat, lon: dichtstbijOSM.lon } : { lat, lon }),   // V11.37.4', 'kandidaatPos ?? { lat: dichtstbijOSM.lat, lon: dichtstbijOSM.lon },');
  const merk = (f) => (String(f).match(/V11\.37\.4/g) || []).length;
  eis('AR11a vindDichtbij: drie regels met merkteken; zonder die regels byte-gelijk aan V11.37.3 (2db98dab / 2954)',
      merk(vindDichtbij) === 3 && fnv(zonder374(terugV11378(vindDichtbij))) === '2db98dab' && zonder374(terugV11378(vindDichtbij)).length === 2954,
      '3 regels, 2db98dab / 2954', merk(vindDichtbij) + ' regels, ' + fnv(zonder374(terugV11378(vindDichtbij))) + ' / ' + zonder374(terugV11378(vindDichtbij)).length);
  eis('AR11b updateDichtbij: één regel met merkteken; zonder die regel byte-gelijk aan V11.37.3 (e82d3c0 / 11914)',
      merk(updateDichtbij) === 1 && fnv(zonder374(terugV11378(updateDichtbij))) === 'e82d3c0' && zonder374(terugV11378(updateDichtbij)).length === 11914,
      '1 regel, e82d3c0 / 11914', merk(updateDichtbij) + ' regel(s), ' + fnv(zonder374(terugV11378(updateDichtbij))) + ' / ' + zonder374(terugV11378(updateDichtbij)).length);
  const og = zonder374(terugV11374(zonderV113711(onGPS)));
  eis('AR11c onGPS: vijf regels met merkteken (de aanroep en vier V9-regels); met die vier terug en de aanroep weg byte-gelijk aan V11.37.3 (e1da9bf9 / 14694)',
      merk(onGPS) === 5 && fnv(og) === 'e1da9bf9' && og.length === 14694, '5 regels, e1da9bf9 / 14694', merk(onGPS) + ' regels, ' + fnv(og) + ' / ' + og.length);
  const V11373 = { vindDichtbijScore: ['bc9b7937', 2105], checkHandLockVerval: ['2df4f7ed', 5513], checkNodeCorrectieStilstand: ['8c801fd8', 4751],
    corrigeerNodeAutomatisch: ['afe7b427', 4118], checkNaderingsCorrectie: ['6aeb87b3', 3595], verzamelNaderingsBewijs: ['3d6ad85f', 3526],
    checkHandLockPassage: ['7f001264', 1768], checkTikSlotSnel: ['d3a8edbe', 2071], regelTik: ['9c1b361b', 3087], vergrendelNodeHandmatig: ['9a007b96', 2295],
    selecteerNodeHandmatig: ['5275f4dd', 2379], tikRichting: ['9e40a595', 4410], isStoplichtVoorbij: ['38a0d2ed', 338] };
  // V11.37.5: tikRichting kreeg twee meetregels met merkteken (zie test_knoppen); zonder die regels gelijk.
  const anders11 = Object.entries(V11373).filter(([n, [h, l]]) => { const s = terugV11378(window[n]).split(NL).filter(l => !/V11\.37\.5/.test(l)).join(NL); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('AR11d dertien keuzefuncties die V11.37.4 niet raakt (de puntentelling, de drie loslaatroutes, de correcties, de snelle route, de tik): byte-gelijk',
      anders11.length === 0, 'geen afwijking', anders11.join(', ') || 'geen');
  const z = zc(onGPS);
  const p11 = ['checkHandLockPassage(lat, lon)', 'achterTik(lat, lon)', 'updateDichtbij(lat, lon)'].map(x => z.indexOf(x));
  eis('AR11e in onGPS: de achter-regel direct na A3 en vóór updateDichtbij', p11.every(x => x > 0) && p11[0] < p11[1] && p11[1] < p11[2], 'op volgorde', p11.join(','));
  eis('AR11f veranderd en benoemd: vindDichtbij, updateDichtbij en onGPS (de keuze); regelKies (de schaduwregel, AR9); wisselLogNoteer, wisselVoor en wisselNa (de wissellog)',
      fnv(String(regelKies)) !== 'fd57785d' && /achterLosTijd/.test(zc(wisselNa)) && /if \(!oud && !nieuw\) return;/.test(String(wisselLogNoteer)) && /wisselStaat && !id/.test(zc(wisselVoor)),
      'zeven functies', 'ok');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testAchter = testAchter; window.achterRitBinnen = achterRitBinnen; }
