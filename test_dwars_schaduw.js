// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_dwars_schaduw.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.8 (alleen meten): de dwarsregel als schaduw.
//  Een licht is dwars als elke autoweg erdoor meer dan DWARS_HOEK (80) graden
//  ongericht van de koers afwijkt; de schaduw rekent uit wat de app zonder
//  dwarse lichten zou tonen en schrijft alleen sl_dwarslog en dw/dh in de wissellog.
//
//  DS1  dwarsWegRichtingen: richting per autoweg (0-179), null zonder vorm of zonder autoweg
//  DS2  dwarsIsDwars: alle wegen > 80 (ongericht); 80 precies is niet dwars; onbekend nooit
//  DS3  dwarsKoers: alleen een gemeten koers uit de tik en vanaf 10 km/u
//  DS4  dwarsSchaduwKies: dwars licht -> het volgende licht; getikt blijft; nooit als enige; geen koers
//  DS5  dwarsSchaduwKies: de eigen voorsprong houdt de vorige schaduwkeuze binnen 150 m
//  DS6  dwarsTik: één regel bij het begin, niets bij dezelfde stand, één bij het einde; geen positie
//  DS7  dwarsTikNoteer: tik op een licht dat de schaduw uitsloot (binnen 30 s), anders niets
//  DS8  dwarsWisselVelden en wisselLogNoteer: dw/dh op de wissel
//  DS9  puur: dwarsTik verandert het getoonde licht, het slot en de andere opslag niet
//  DS10 de bron: de aanroepen staan op hun plek, vindDichtbij en de score zijn ongewijzigd,
//       de export neemt sl_dwarslog mee, de kaart en de bewaarde kaart krijgen dwarsWegen
//
//  DRAAIEN: zoals de andere toetsen; testDwarsSchaduw().
// ═══════════════════════════════════════════════════════════════
function testDwarsSchaduw() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const A = 9608801, B = 9608802, C = 9608803;
  const P = { lat: 52.0, lon: 5.0 };
  const noord = (m) => ({ lat: 52.0 + m / 111320, lon: 5.0 });
  const weg = (hw, graden, id, plek) => {   // een weg door `plek` in richting `graden`
    const d = 20 / 111320, r = graden * Math.PI / 180, cl = Math.cos(plek.lat * Math.PI / 180);
    const a = { lat: plek.lat - d * Math.cos(r), lon: plek.lon - d * Math.sin(r) / cl };
    const b = { lat: plek.lat + d * Math.cos(r), lon: plek.lon + d * Math.sin(r) / cl };
    return { tags: { highway: hw }, nodes: [1, id, 2], geometry: [a, { lat: plek.lat, lon: plek.lon }, b] };
  };
  const bew = { osmCache, dichtstbijOSM, snelheidKmh, tegenKoersTik, tegenKoersTikT, huidigeRichting, handmatigLockActief,
                stilstandAutoLock, handmatigGeselecteerdNodeId, tegenHandId, cacheGeladen, fietsLichten, achterStaat,
                headingBuffer: headingBuffer.slice(), dwarsStaat, log: localStorage.getItem(DWARSLOG_SLEUTEL),
                wl: localStorage.getItem(WISSELLOG_SLEUTEL), uitT: new Map(dwarsUitT) };
  const dlog = () => { try { return JSON.parse(localStorage.getItem(DWARSLOG_SLEUTEL) || '[]'); } catch (e) { return []; } };
  const zet = (kmh, k) => { snelheidKmh = kmh; tegenKoersTik = k; tegenKoersTikT = Date.now(); huidigeRichting = k == null ? 0 : k; };
  // A 60 m vóór je op een dwarse weg (90), B 150 m vóór je op een weg in je richting (0)
  const pA = noord(60), pB = noord(150), pC = noord(120);
  const lA = { id: A, lat: pA.lat, lon: pA.lon, dwarsWegen: dwarsWegRichtingen(A, [weg('primary', 90, A, pA)]) };
  const lB = { id: B, lat: pB.lat, lon: pB.lon, dwarsWegen: dwarsWegRichtingen(B, [weg('primary', 0, B, pB)]) };
  const lC = { id: C, lat: pC.lat, lon: pC.lon, dwarsWegen: dwarsWegRichtingen(C, [weg('secondary', 5, C, pC)]) };
  const begin = (cache) => {
    osmCache = cache; cacheGeladen = true; fietsLichten = null; achterReset();
    handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null; tegenHandId = null;
    headingBuffer.length = 0; headingBuffer.push(0, 0, 0);
    dwarsStaat = { e: null, s: null, vr: null }; dwarsUitT.clear();
    localStorage.setItem(DWARSLOG_SLEUTEL, '[]');
    zet(40, 0);
  };
  try {
    // DS1
    const r1 = dwarsWegRichtingen(A, [weg('primary', 90, A, pA)]);
    const r1b = dwarsWegRichtingen(A, [weg('primary', 270, A, pA), weg('trunk_link', 30, A, pA)]);
    const zonderVorm = weg('primary', 0, A, pA); zonderVorm.geometry = zonderVorm.geometry.slice(0, 2);
    const r1c = dwarsWegRichtingen(A, [weg('primary', 0, A, pA), zonderVorm]);
    const r1d = dwarsWegRichtingen(A, [weg('cycleway', 90, A, pA)]);
    const r1e = dwarsWegRichtingen(A, []);
    eis('DS1 dwarsWegRichtingen: [90], [90,30], null zonder vorm, null zonder autoweg',
      kort(r1) === '[90]' && kort(r1b) === '[90,30]' && r1c === null && r1d === null && r1e === null, '[90] [90,30] null null null', kort({ r1, r1b, r1c, r1d, r1e }));
    // DS2
    const sl = (w) => ({ id: A, dwarsWegen: w });
    const ok2 = dwarsIsDwars(sl([149]), 61) && !dwarsIsDwars(sl([70]), 61) && !dwarsIsDwars(sl([141]), 61)
      && dwarsIsDwars(sl([142]), 61) && !dwarsIsDwars(sl([149, 30]), 61) && dwarsIsDwars(sl([149, 150]), 61)
      && !dwarsIsDwars(sl(null), 61) && !dwarsIsDwars(sl([]), 61) && !dwarsIsDwars(sl([149]), null)
      && dwarsMinHoek(sl([149]), 61) === 88 && dwarsMinHoek(sl([0]), 179) === 1;
    eis('DS2 dwarsIsDwars: 88 ja, 9 nee, 80 nee, 81 ja, één weg in je richting nee, onbekend nooit',
      ok2, 'zie test', kort({ a: dwarsMinHoek(sl([149]), 61), b: dwarsMinHoek(sl([141]), 61), c: dwarsMinHoek(sl([0]), 179) }));
    // DS3
    zet(9.9, 50); const k1 = dwarsKoers(); zet(10, 50); const k2 = dwarsKoers();
    zet(40, null); const k3 = dwarsKoers(); zet(40, -1); const k4 = dwarsKoers(); zet(40, NaN); const k5 = dwarsKoers();
    eis('DS3 dwarsKoers: null onder 10 km/u, zonder koers, bij -1 en NaN; 50 vanaf 10 km/u',
      k1 === null && k2 === 50 && k3 === null && k4 === null && k5 === null, 'null 50 null null null', kort({ k1, k2, k3, k4, k5 }));
    // DS4
    begin([lA, lB]);
    const echtA = { ...lA, afstand: 60 };
    const u1 = dwarsSchaduwKies(P.lat, P.lon, 0, echtA, 0);
    tegenHandId = String(A); const u2 = dwarsSchaduwKies(P.lat, P.lon, 0, echtA, 0); tegenHandId = null;
    handmatigLockActief = true; handmatigGeselecteerdNodeId = String(A); const u2b = dwarsSchaduwKies(P.lat, P.lon, 0, echtA, 0);
    handmatigLockActief = false; handmatigGeselecteerdNodeId = null;
    begin([lA]); const u3 = dwarsSchaduwKies(P.lat, P.lon, 0, echtA, 0);
    begin([lA, lB]); const u4 = dwarsSchaduwKies(P.lat, P.lon, 0, echtA, null);
    const u5 = dwarsSchaduwKies(P.lat, P.lon, 0, { ...lB, afstand: 150 }, 0);
    eis('DS4 dwars licht -> B; getikt of uit de lijst blijft A; alleen A: A met enig; zonder koers A; B niet dwars: B',
      u1.s && u1.s.id === B && !u1.vr && u2.s.id === A && u2b.s.id === A && u3.s.id === A && u3.vr === 'enig' && u4.s.id === A && u5.s.id === B,
      'B A A A/enig A B', kort({ u1: u1.s && u1.s.id, u2: u2.s.id, u2b: u2b.s.id, u3: [u3.s.id, u3.vr], u4: u4.s.id, u5: u5.s.id }));
    // DS5: C (120 m, iets beter) tegen de vorige schaduwkeuze B (150 m)
    begin([lA, lB, lC]);
    const vrij = dwarsSchaduwKies(P.lat, P.lon, 0, echtA, 0);
    const lB3 = { ...lB, lat: noord(160).lat };
    begin([lA, lB3, lC]); dwarsStaat = { e: String(A), s: String(B), vr: null };
    const hou = dwarsSchaduwKies(P.lat, P.lon, 0, echtA, 0);
    const lB2 = { ...lB, lat: noord(149).lat };
    begin([lA, lB2, lC]); dwarsStaat = { e: String(A), s: String(B), vr: null };
    const hou2 = dwarsSchaduwKies(P.lat, P.lon, 0, echtA, 0);
    eis('DS5 zonder vorige keuze C; vorige keuze B binnen 150 m blijft; op 160 m niet meer',
      vrij.s.id === C && hou2.s.id === B && hou.s.id === C, 'C B C', kort({ vrij: vrij.s.id, hou2: hou2.s.id, hou: hou.s.id }));
    // DS6
    begin([lA, lB]);
    dichtstbijOSM = { ...lB, afstand: 150 }; dwarsTik(P.lat, P.lon);   // eens: niets
    const n0 = dlog().length;
    dichtstbijOSM = echtA; dwarsTik(P.lat, P.lon);   // begin
    dwarsTik(P.lat, P.lon);   // dezelfde stand
    const l6 = dlog();
    dichtstbijOSM = { ...lB, afstand: 150 }; dwarsTik(P.lat, P.lon);   // einde
    dwarsTik(P.lat, P.lon);
    const l6b = dlog(), r6 = l6[0] || {}, e6 = l6b[1] || {};
    const sleutels = Object.keys(r6).sort().join(',');
    eis('DS6 geen regel als de schaduw het eens is; één bij het begin (e A, s B, h 90, k 0, ae 60, as 150), geen bij dezelfde stand, één bij het einde; geen positie',
      n0 === 0 && l6.length === 1 && r6.e === A && r6.s === B && r6.h === 90 && r6.k === 0 && r6.kmh === 40 && r6.ae === 60 && r6.as === 150
        && l6b.length === 2 && e6.e === B && e6.s === B && !/lat|lon|pos/i.test(sleutels + ',' + Object.keys(e6).join(',')),
      '0, 1, 2', kort({ n0, l6, l6b }));
    // DS7
    begin([lA, lB]);
    dichtstbijOSM = echtA; dwarsTik(P.lat, P.lon);
    dwarsTikNoteer(B); const n7a = dlog().length;
    dwarsTikNoteer(A); const l7 = dlog(), t7 = l7[l7.length - 1] || {};
    dwarsUitT.set(String(A), Date.now() - 31000); dwarsTikNoteer(A); const n7c = dlog().length;
    eis('DS7 tik op B (niet uitgesloten) niets; tik op A schrijft tik:1; na 31 s niets',
      n7a === 1 && l7.length === 2 && t7.e === A && t7.tik === 1 && typeof t7.sd === 'number' && n7c === 2, '1 2 2', kort({ n7a, l7, n7c }));
    // DS8
    begin([lA, lB]);
    const w1 = dwarsWisselVelden(echtA), w2 = dwarsWisselVelden({ ...lB }), w3 = dwarsWisselVelden({ id: A });
    zet(5, 0); const w4 = dwarsWisselVelden(echtA); zet(40, 0);
    localStorage.setItem(WISSELLOG_SLEUTEL, '[]');
    wisselLogNoteer({ id: B, lat: pB.lat, lon: pB.lon }, echtA, 'vrij', null, P.lat, P.lon);
    const wl = (() => { try { return JSON.parse(localStorage.getItem(WISSELLOG_SLEUTEL) || '[]'); } catch (e) { return []; } })();
    const wr = wl[0] || {};
    eis('DS8 dw/dh: A dw 1 dh 90, B dw 0 dh 0, zonder wegen of onder 10 km/u leeg; de wissel krijgt dw 1 dh 90',
      kort(w1) === '{"dw":1,"dh":90}' && kort(w2) === '{"dw":0,"dh":0}' && kort(w3) === '{}' && kort(w4) === '{}'
        && wl.length === 1 && wr.dw === 1 && wr.dh === 90 && wr.naar === A && wr.r === 'vrij',
      'zie test', kort({ w1, w2, w3, w4, wr }));
    // DS9
    begin([lA, lB]);
    const anders = () => Object.keys(localStorage).filter(k => k !== DWARSLOG_SLEUTEL).sort().map(k => k + '=' + (localStorage.getItem(k) || '').length).join('|');
    dichtstbijOSM = echtA; handmatigLockActief = false;
    const voor = anders(), getoond = dichtstbijOSM, slot = handmatigLockActief, st2 = s2BboxTeller.size;
    for (let i = 0; i < 5; i++) dwarsTik(P.lat, P.lon);
    eis('DS9 dwarsTik verandert het getoonde licht, het slot, de s2-teller en de andere opslag niet',
      dichtstbijOSM === getoond && handmatigLockActief === slot && s2BboxTeller.size === st2 && anders() === voor, 'gelijk', kort({ n: dlog().length }));
    // DS10
    const og = String(onGPS), vg = String(vergrendelNodeHandmatig), wn = String(wisselLogNoteer), ex = String(exporteerMeetdata);
    const iW = og.indexOf('wisselNa(lat, lon);'), iD = og.indexOf('dwarsTik(lat, lon);'), iR = og.indexOf('regelTik(lat, lon);');
    const iH = vg.indexOf('tegenHandId = n;'), iN = vg.indexOf('dwarsTikNoteer(n);');
    const bron = document.documentElement.innerHTML;
    const okKaart = bron.indexOf('for (const sl of osmCache) sl.dwarsWegen = dwarsWegRichtingen(sl.id, nodeWegen.get(sl.id));') > 0
      && /rec\.lichten\.forEach\(\(l, i\) => \{ const w = osmCache\[i\] && osmCache\[i\]\.dwarsWegen;/.test(String(kaartBewaar));
    const schoon = !/V11\.38\.8(?!\d)|dwars/.test(String(vindDichtbij)) && !/V11\.38\.8(?!\d)|dwars/.test(String(vindDichtbijScore))
      && !/dwars/.test(String(tegenSluitUit)) && !/dwars/.test(String(updateDichtbij));
    eis('DS10 dwarsTik direct na wisselNa en vóór regelTik; dwarsTikNoteer na tegenHandId; wissellog en export; kaart en bewaarde kaart; vindDichtbij, de score, tegenSluitUit en updateDichtbij zonder dwars',
      iW > 0 && iD > iW && iR > iD && iH > 0 && iN > iH && /\.\.\.dwarsWisselVelden\(nieuw\)/.test(wn)
        && /uit\.dwars = \{\}/.test(ex) && /key === DWARSLOG_SLEUTEL\)\s+doel = uit\.dwars/.test(ex) && DWARSLOG_SLEUTEL === 'sl_dwarslog'
        && okKaart && schoon && DWARS_HOEK === 80 && DWARS_MIN_KMH === 10,
      'alles op zijn plek', kort({ iW, iD, iR, iH, iN, okKaart, schoon }));
  } catch (e) {
    eis('DS crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    osmCache = bew.osmCache; dichtstbijOSM = bew.dichtstbijOSM; snelheidKmh = bew.snelheidKmh; tegenKoersTik = bew.tegenKoersTik;
    tegenKoersTikT = bew.tegenKoersTikT; huidigeRichting = bew.huidigeRichting; handmatigLockActief = bew.handmatigLockActief;
    stilstandAutoLock = bew.stilstandAutoLock; handmatigGeselecteerdNodeId = bew.handmatigGeselecteerdNodeId; tegenHandId = bew.tegenHandId;
    cacheGeladen = bew.cacheGeladen; fietsLichten = bew.fietsLichten; achterStaat = bew.achterStaat; dwarsStaat = bew.dwarsStaat;
    headingBuffer.length = 0; headingBuffer.push(...bew.headingBuffer);
    dwarsUitT.clear(); for (const [k, v] of bew.uitT) dwarsUitT.set(k, v);
    try { if (bew.log === null) localStorage.removeItem(DWARSLOG_SLEUTEL); else localStorage.setItem(DWARSLOG_SLEUTEL, bew.log); } catch (e) {}
    try { if (bew.wl === null) localStorage.removeItem(WISSELLOG_SLEUTEL); else localStorage.setItem(WISSELLOG_SLEUTEL, bew.wl); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testDwarsSchaduw = testDwarsSchaduw;
