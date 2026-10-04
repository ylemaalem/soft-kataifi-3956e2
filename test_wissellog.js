// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_wissellog.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.36.4: de wissellog (sl_wissellog), alleen meten.
//
//  Elke wissel van het getoonde licht geeft één regel, met de reden en hoe laat
//  hij kwam. De wachter (wisselVoor, wisselTussen, wisselNa) kijkt in onGPS vóór,
//  tijdens en na de beslisketen en beslist zelf niets.
//
//  Het vaste stratenplan: licht A op (0, 0), licht B 150 m noordelijk, en C als
//  tweede mast van het kruispunt van A, 40 m oostelijk. De auto rijdt naar het
//  noorden.
//
//  WL1  geen wissel, geen regel
//  WL2  de acht redenen: vrij, tik100, stil, auto, nadering, correctie, lijst, kaart
//  WL3  een slot dat in de ene tik loslaat en de wissel die pas een tik later komt
//  WL4  de velden: van, naar, d, zk, vb, pl, eta, uit en min
//  WL5  een ring van 60, klein en Latin-1
//  WL6  een vol quotum staakt alleen dit log
//  WL7  de export heeft een eigen bak 'wissel'
//  WL8  de wachter beslist niets: geen toewijzing aan de keuze-toestand
//  WL9  met de echte onGPS: een rit zonder slot (vrij) en een rit met een tik
//       (tik100), en met en zonder wachter dezelfde keuze in elke tik
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_wissellog.js';
//      document.head.appendChild(s);
//      s.onload = () => testWissellog().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
async function wisselRitBinnen(opt) {
  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.zonderWachter) { window.wisselVoor = () => {}; window.wisselTussen = () => {}; window.wisselNa = () => {}; }
  try { localStorage.setItem('sl_wissellog', '[]'); localStorage.setItem('sl_opslaglog', '[]'); } catch (e) {}
  osmCache = opt.nodes.map(n => ({ id: n.id, naam: String(n.id), ...LL(n.x, n.y) }));
  cacheGeladen = true; cacheBezig = false; cacheCentrum = LL(0, 0);
  eersteGPSVerwerkt = true;
  clusterNodes = new Set();
  const start = osmCache.find(n => n.id === opt.start);
  dichtstbijOSM = { ...start, afstand: 150 }; vorigOsmId = start.id;
  handmatigLockActief = false; stilstandAutoLock = false;
  handmatigGeselecteerdNodeId = null; handmatigGeselecteerdTimestamp = 0;
  stilstandSinds = 0; laatsteNodeCorrectieTijd = 0; laatsteNodeWisselTijd = 0;
  headingBuffer.length = 0;
  hoekStabielReset(); handLockVervalReset(); naderBewijsReset();
  if (typeof wisselStaat !== 'undefined') { wisselStaat = null; wisselTik = null; }
  if (opt.tikOpStart) vergrendelNodeHandmatig(start.id, 'beeld');
  const gekozen = [];
  const v = opt.kmh / 3.6;
  for (let y = opt.vanY; y <= opt.totY; y += v) {
    klok += 1000;
    const q = LL(0, y);
    // Koers 1 graad, niet 0: isStoplichtVoorbij leest `!rijrichting` en ziet een koers van precies
    // 0 (pal noord) daardoor als 'geen koers'. Zie het rapport bij V11.36.4.
    await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: 1 }, timestamp: klok });
    gekozen.push(dichtstbijOSM ? dichtstbijOSM.id : null);
  }
  let wissel = [];
  try { wissel = JSON.parse(localStorage.getItem('sl_wissellog')) || []; } catch (e) {}
  return { gekozen, wissel };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testWissellog() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));

  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  const A = { id: 9100001, ...LL(0, 0) }, B = { id: 9100002, ...LL(0, 150) }, C = { id: 9100003, ...LL(40, 0) };
  const toon = (n) => ({ ...n, afstand: 50 });

  const namen = ['dichtstbijOSM', 'huidigePos', 'snelheidKmh', 'handmatigLockActief', 'stilstandAutoLock',
    'handmatigGeselecteerdNodeId', 'handmatigGeselecteerdTimestamp', 'laatsteNodeCorrectieTijd',
    'bboxOverride', 'bboxOverrideTijd', 'bboxOverrideLaatsteMatch', 'wisselStaat', 'wisselTik', 'wisselNaTijd',
    'opslagSchrijf'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
  const bewHeading = headingBuffer.slice();
  const bewNu = Date.now;
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  // Sleutel voor sleutel, niet met clear(): de IndexedDB-spiegel ziet clear() niet, en een sleutel
  // die alleen deze test aanmaakte (sl_wissellog) zou er anders als weesrecord achterblijven.
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };

  let klok = 1790000000000;
  const lees = () => { try { return JSON.parse(localStorage.getItem(WISSELLOG_SLEUTEL)) || []; } catch (e) { return []; } };
  const schoon = (o) => {
    const opt = o || {};
    Date.now = () => klok;
    localStorage.removeItem(WISSELLOG_SLEUTEL); meetRingGestopt.delete(WISSELLOG_SLEUTEL);
    wisselStaat = null; wisselTik = null; wisselNaTijd = 0;
    handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null;
    handmatigGeselecteerdTimestamp = 0; laatsteNodeCorrectieTijd = 0;
    bboxOverride = null; bboxOverrideTijd = 0; bboxOverrideLaatsteMatch = 0;
    snelheidKmh = opt.kmh != null ? opt.kmh : 30;
    headingBuffer.length = 0;
    dichtstbijOSM = toon(A);
  };
  // Eén GPS-tik zoals onGPS hem doet: voor, de keten (hier nagebootst), tussen, de rest, na.
  const tik = (p, keten, naNadering) => {
    klok += 1000; huidigePos = p;
    wisselVoor(p.lat, p.lon);
    if (keten) keten();
    wisselTussen();
    if (naNadering) naNadering();
    wisselNa(p.lat, p.lon);
  };
  const slot = (auto) => { handmatigLockActief = true; stilstandAutoLock = !!auto; handmatigGeselecteerdNodeId = String(A.id); };
  const los = () => { handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null; };
  const naar = (n) => () => { dichtstbijOSM = toon(n); };

  try {
    // ═══ WL1 — geen wissel, geen regel ═════════════════════════
    schoon(); tik(LL(0, -40)); tik(LL(0, -30)); tik(LL(0, -20));
    eis('WL1 drie tikken op hetzelfde licht: geen regel', lees().length === 0, '0', lees().length);

    // ═══ WL2 — de acht redenen ═════════════════════════════════
    const reden = (opzet) => { schoon(opzet.o); if (opzet.voor) opzet.voor(); tik(LL(0, -10)); opzet.dan(); const r = lees(); return r.length === 1 ? r[0].r : r.map(x => x.r).join('+') || 'geen'; };
    const R = {
      vrij: reden({ dan: () => tik(LL(0, 10), naar(B)) }),
      tik100: reden({ voor: () => slot(false), dan: () => tik(LL(0, 110), () => { los(); dichtstbijOSM = toon(B); }) }),
      stil: reden({ o: { kmh: 0 }, voor: () => slot(false), dan: () => tik(LL(0, 5), () => { los(); dichtstbijOSM = toon(C); }) }),
      auto: reden({ voor: () => slot(true), dan: () => tik(LL(0, 10), () => { los(); dichtstbijOSM = toon(B); }) }),
      nadering: reden({ dan: () => tik(LL(0, -5), () => { laatsteNodeCorrectieTijd = Date.now(); dichtstbijOSM = toon(C); }) }),
      correctie: reden({ o: { kmh: 0 }, dan: () => tik(LL(0, -5), null, () => { laatsteNodeCorrectieTijd = Date.now(); dichtstbijOSM = toon(C); slot(true); }) }),
      lijst: reden({ dan: () => { klok += 300; dichtstbijOSM = toon(B); handmatigGeselecteerdTimestamp = Date.now(); slot(false); tik(LL(0, 0)); } }),
      kaart: reden({ dan: () => { klok += 300; dichtstbijOSM = toon(B); tik(LL(0, 0)); } })
    };
    const verwacht2 = 'vrij,tik100,stil,auto,nadering,correctie,lijst,kaart';
    const kreeg2 = Object.entries(R).map(([k, v]) => v === k ? k : k + '=' + v).join(',');
    eis('WL2 de acht redenen, elk één regel', kreeg2 === verwacht2, verwacht2, kreeg2);

    // ═══ WL3 — loslaten in de ene tik, wisselen in de volgende ═
    schoon(); slot(false); tik(LL(0, 90));
    tik(LL(0, 101), () => los());            // het slot laat los, de voorsprongregel houdt A nog
    tik(LL(0, 104));                          // nog steeds A
    tik(LL(0, 108), naar(B));                 // nu pas de wissel
    const r3 = lees();
    eis('WL3a het slot liet los en de wissel kwam twee tikken later: de reden blijft tik100',
        r3.length === 1 && r3[0].r === 'tik100', 'tik100', r3.map(x => x.r).join(',') || 'geen');
    schoon(); slot(false); tik(LL(0, 90));
    tik(LL(0, 101), () => los());
    tik(LL(0, 102), () => slot(false));       // een nieuw slot vóór de wissel
    tik(LL(0, 103), () => { los(); dichtstbijOSM = toon(B); });
    tik(LL(0, 160), naar(A));                 // en een wissel zonder slot
    const r3b = lees().map(x => x.r).join(',');
    eis('WL3b een nieuw slot laat de oude reden vervallen; een wissel daarna zonder slot heet vrij',
        r3b === 'tik100,vrij', 'tik100,vrij', r3b);

    // ═══ WL4 — de velden ═══════════════════════════════════════
    schoon({ kmh: 30 });
    for (let i = 0; i < 3; i++) headingBuffer.push(0);   // rijrichting noord (rechtstreeks: voegHeadingToe zet ook de yaw-toestand)
    tik(LL(0, -50)); tik(LL(0, -20)); tik(LL(0, -4)); tik(LL(0, 10));
    bboxOverride = { cx: 1, cy: 1 }; bboxOverrideTijd = klok - 9000; bboxOverrideLaatsteMatch = klok + 1000 - 3200;
    tik(LL(0, 30), naar(B));
    const w4 = lees()[0] || {};
    eis('WL4a van A naar B, d 150, zk 0', w4.van === A.id && w4.naar === B.id && w4.d === 150 && w4.zk === 0,
        A.id + ' -> ' + B.id + ', 150, 0', `${w4.van} -> ${w4.naar}, ${w4.d}, ${w4.zk}`);
    eis('WL4b vb 30 m voorbij, A recht achter je (|pl| >= 170), eta 14,4 s (120 m bij 30 km/u)',
        w4.vb === 30 && Math.abs(w4.pl) >= 170 && Math.abs(w4.eta - 14.4) < 0.15, '30 / 180 / 14,4', `${w4.vb} / ${w4.pl} / ${w4.eta}`);
    eis('WL4c uit 3,2 s (de lamp was zo lang niet gezien), min 4 m (dichtst bij A)',
        w4.uit === 3.2 && w4.min === 4, '3,2 / 4', `${w4.uit} / ${w4.min}`);
    schoon(); tik(LL(0, -5)); tik(LL(0, -3), naar(C));
    const w4d = lees()[0] || {};
    eis('WL4d een tweede mast van hetzelfde kruispunt (40 m): zk 1, en zonder tik geen uit',
        w4d.zk === 1 && w4d.d === 40 && !('uit' in w4d), 'zk 1, d 40, geen uit', `zk ${w4d.zk}, d ${w4d.d}, uit ${w4d.uit}`);
    schoon({ kmh: 0 }); tik(LL(0, -5)); tik(LL(0, -3), naar(C));
    const w4e = lees()[0] || {};
    eis('WL4e stilstaand: geen eta', !('eta' in w4e) && w4e.kmh === 0, 'geen eta, kmh 0', JSON.stringify(w4e));

    // ═══ WL5 — de ring ═════════════════════════════════════════
    schoon(); tik(LL(0, 0));
    for (let i = 0; i < 70; i++) tik(LL(0, i % 2 ? 0 : 150), naar(i % 2 ? A : B));
    const r5 = lees();
    eis('WL5a 70 wissels: de ring houdt de laatste 60', r5.length === WISSELLOG_MAX && WISSELLOG_MAX === 60, '60', r5.length);
    const lang = Math.max(...r5.map(x => JSON.stringify(x).length));
    const ruw = localStorage.getItem(WISSELLOG_SLEUTEL) || '';
    eis('WL5b elke regel < 160 tekens, alles Latin-1, de hele ring < 9 K',
        lang < 160 && !/[^\x00-\xff]/.test(ruw) && ruw.length < 9000, '< 160, Latin-1, < 9 K', lang + ' / ' + ruw.length);
    eis('WL5c de sleutel is sl_wissellog', WISSELLOG_SLEUTEL === 'sl_wissellog', 'sl_wissellog', WISSELLOG_SLEUTEL);

    // ═══ WL6 — een vol quotum ══════════════════════════════════
    schoon(); tik(LL(0, 0)); tik(LL(0, 10), naar(B));
    opslagSchrijf = () => false;
    let fout6 = null;
    try { tik(LL(0, 160), naar(A)); } catch (e) { fout6 = e; }
    opslagSchrijf = bewaard.opslagSchrijf;
    tik(LL(0, 0), naar(B));
    eis('WL6 een vol quotum: geen fout, de sleutel weg, dit log gestaakt (en blijft dat)',
        fout6 === null && localStorage.getItem(WISSELLOG_SLEUTEL) === null && meetRingGestopt.has(WISSELLOG_SLEUTEL),
        'weg en gestaakt', String(localStorage.getItem(WISSELLOG_SLEUTEL)) + ' / ' + meetRingGestopt.has(WISSELLOG_SLEUTEL));
    meetRingGestopt.delete(WISSELLOG_SLEUTEL);

    // ═══ WL7 — de export ═══════════════════════════════════════
    localStorage.setItem(WISSELLOG_SLEUTEL, JSON.stringify([{ t: 1, proef: 'wissel' }]));
    const blobs = [];
    const bew = { url: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click, alert: window.alert,
                  cs: Object.getOwnPropertyDescriptor(navigator, 'canShare') };
    try {
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:proef'; };
      HTMLAnchorElement.prototype.click = function () {};
      window.alert = () => {};
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
      Date.now = bewNu;
      exporteerMeetdata();
      for (let i = 0; i < 40 && blobs.length < 1; i++) await slaap(50);
    } finally {
      URL.createObjectURL = bew.url; HTMLAnchorElement.prototype.click = bew.klik; window.alert = bew.alert;
      if (bew.cs) Object.defineProperty(navigator, 'canShare', bew.cs); else delete navigator.canShare;
      Date.now = () => klok;
    }
    let meet = null;
    for (const b of blobs) { const j = JSON.parse(await b.text()); if (!Array.isArray(j.sleutels)) meet = j; }
    const w7 = meet && meet.wissel && meet.wissel[WISSELLOG_SLEUTEL];
    eis('WL7 de meetdata-export heeft een bak wissel met sl_wissellog erin',
        Array.isArray(w7) && w7[0] && w7[0].proef === 'wissel', 'wissel / sl_wissellog', meet ? Object.keys(meet.wissel || {}).join(',') || 'leeg' : 'geen export');

    // ═══ WL8 — de wachter beslist niets ════════════════════════
    const wachter = zc(wisselVoor) + zc(wisselTussen) + zc(wisselNa) + zc(wisselLogNoteer);
    eis('WL8a de wachter wijst niets toe aan de keuze-toestand',
        !/\b(dichtstbijOSM|vorigOsmId|handmatigLockActief|handmatigGeselecteerdNodeId|handmatigGeselecteerdTimestamp|stilstandAutoLock|laatsteNodeCorrectieTijd|laatsteNodeWisselTijd|bboxOverride|stickyDetectie|fase)\s*=[^=]/.test(wachter),
        'geen toewijzing', 'ok');
    const g = zc(onGPS);
    const pos8 = ['wisselVoor(lat, lon)', 'checkHandLockVerval(lat, lon)', 'updateDichtbij(lat, lon)', 'checkNaderingsCorrectie(lat, lon)',
                  'wisselTussen()', 'checkNodeCorrectieStilstand(lat, lon)', 'meldNodeVermoeden(lat, lon)', 'wisselNa(lat, lon)'].map(x => g.indexOf(x));
    eis('WL8b in onGPS: wisselVoor vóór het auto-slot en checkHandLockVerval, wisselTussen na de naderingscorrectie, wisselNa na de hele keten',
        pos8.every(p => p > 0) && pos8.every((p, i) => i === 0 || p > pos8[i - 1]) && g.indexOf('wisselVoor(lat, lon)') < g.indexOf('if (!handmatigLockActief && dichtstbijOSM && snelheidKmh < 3'),
        'op volgorde', pos8.join(','));

  } finally {
    Date.now = bewNu;
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    headingBuffer.length = 0; for (const h of bewHeading) headingBuffer.push(h);
    meetRingGestopt.delete(WISSELLOG_SLEUTEL);
    herstel();
  }

  // ═══ WL9 — met de echte onGPS ════════════════════════════════
  const bron = new URL('test_wissellog.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?wissellog=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      const w = f.contentWindow;
      await new Promise((ok, nee) => {
        const sc = w.document.createElement('script');
        sc.src = bron + '?t=' + Date.now(); sc.onload = ok; sc.onerror = () => nee(new Error('laden'));
        w.document.head.appendChild(sc);
      });
      return await w.wisselRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), gekozen: [], wissel: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const nodes = [{ id: 9100001, x: 0, y: 0 }, { id: 9100002, x: 0, y: 150 }];
  const basis = { nodes, start: 9100001, kmh: 30, vanY: -120, totY: 140 };
  const vrij = await rit({ ...basis });
  const vrijZ = await rit({ ...basis, zonderWachter: true });
  const getikt = await rit({ ...basis, tikOpStart: true });
  const getiktZ = await rit({ ...basis, tikOpStart: true, zonderWachter: true });
  const kort = (u) => u.fout ? u.fout : u.wissel.map(x => `${x.r} ${x.van}->${x.naar} vb ${x.vb} pl ${x.pl} min ${x.min}`).join(' ; ') || 'geen regel';
  const w9a = vrij.wissel;
  eis('WL9a rit zonder slot: één regel A->B, reden vrij, A al voorbij (vb < 30, |pl| > 90), A gehaald (min < 10)',
      w9a.length === 1 && w9a[0].r === 'vrij' && w9a[0].van === 9100001 && w9a[0].naar === 9100002
        && w9a[0].vb < 30 && Math.abs(w9a[0].pl) > 90 && w9a[0].min < 10, 'vrij A->B', kort(vrij));
  const w9b = getikt.wissel;
  eis('WL9b rit met een tik op A: één regel A->B, reden tik100, pas na 100 m voorbij',
      w9b.length === 1 && w9b[0].r === 'tik100' && w9b[0].vb > 100, 'tik100, vb > 100', kort(getikt));
  eis('WL9c met en zonder de wachter: in elke tik hetzelfde licht (zonder slot en met een tik)',
      !vrij.fout && !getikt.fout && vrij.gekozen.length > 20 && vrij.gekozen.join() === vrijZ.gekozen.join()
        && getikt.gekozen.join() === getiktZ.gekozen.join() && vrij.gekozen.join() !== getikt.gekozen.join(),
      'gelijk, en de twee ritten verschillen', `vrij ${vrij.gekozen.join() === vrijZ.gekozen.join()}, tik ${getikt.gekozen.join() === getiktZ.gekozen.join()}`);
  eis('WL9d zonder wachter schrijft de rit niets in sl_wissellog', vrijZ.wissel.length === 0 && getiktZ.wissel.length === 0,
      '0 / 0', vrijZ.wissel.length + ' / ' + getiktZ.wissel.length);

  // de spiegel bijwerken voordat de volgende suite hem vergelijkt
  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testWissellog = testWissellog; window.wisselRitBinnen = wisselRitBinnen; }
