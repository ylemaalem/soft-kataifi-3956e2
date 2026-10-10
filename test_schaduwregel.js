// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_schaduwregel.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.1: de schaduwregel van Younes (sl_regellog), alleen meten.
//
//  De regel: het dichtstbijzijnde licht binnen 400 m, hoogstens 60 graden van de
//  rijrichting, waar je naartoe rijdt; beoordeeld vanaf 5 km/u en alleen op een
//  nieuwe GPS-positie; voorbij na twee nieuwe posities op rij met een stijgende
//  afstand, en dan ook de masten binnen 60 m van dat licht niet meer.
//
//  Het vaste stratenplan: licht A op (0, 100), F 40 m erachter (de overkant van
//  hetzelfde kruispunt), B op (0, 300), Z opzij op (100, 20). De auto rijdt
//  naar het noorden.
//
//  SR1  de keuze: vooruit en dichtstbij; opzij (> 60 graden), achter en verder
//       dan 400 m doen niet mee; een licht waar je van wegrijdt ook niet
//  SR2  voorbij: twee nieuwe posities op rij oplopend; één is niet genoeg; een
//       herhaalde positie telt niet; de overkant (F) valt mee weg; na 150 m vergeten
//  SR3  onder 5 km/u blijft de keuze staan
//  SR4  een afwijking geeft één regel, als hij voorbij is en >= 1,5 s duurde
//  SR5  de stopregel: 100/50/30 m, na 2 s, de route uit de wissellog, het slot;
//       één per stop, en niet zonder licht in de buurt
//  SR6  een ring van 100, klein en Latin-1; een vol quotum staakt alleen dit log
//  SR7  de export heeft een eigen bak 'regel'
//  SR8  met de echte onGPS: een rit met een tik op A, de regel kiest B na het
//       passeren, de app pas later; een stop geeft een stopregel
//  SR9  NIETS VERANDERT: dezelfde ritten met en zonder schaduwregel geven in
//       elke GPS-tik dezelfde keuze, hetzelfde slot en dezelfde wissellog
//  SR10 regressie: onGPS zonder de V11.37.1-regel is byte-gelijk aan V11.37.0
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_schaduwregel.js';
//      document.head.appendChild(s);
//      s.onload = () => testSchaduwregel().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
// opt: { nodes, start, tik, zonderRegel, stukken: [{ vanY, totY, kmh }] }; kmh 0 = stilstaan
async function regelRitBinnen(opt) {
  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.zonderRegel) window.regelTik = () => {};
  if (opt.uitAchter) window.achterAan = () => false;   // V11.37.4
  try { for (const k of ['sl_wissellog', 'sl_opslaglog', 'sl_regellog', TIKLOG_SLEUTEL]) localStorage.setItem(k, '[]'); } catch (e) {}
  tikLogArr = null; tikLogStop = false; tikLogVorige = { tak: null, t: 0 }; tikLogLevend = null;
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
  wisselStaat = null; wisselTik = null; a3Reeks = null; a3LosTijd = 0;
  if (typeof regelReset === 'function') regelReset();
  if (opt.tik) vergrendelNodeHandmatig(start.id, 'beeld');
  const rij = [];
  let laatsteY = null;
  for (const st of opt.stukken) {
    const v = st.kmh / 3.6;
    const van = (laatsteY !== null) ? laatsteY : st.vanY;   // stilstaan en verder rijden vanaf waar je was
    const stappen = st.kmh > 0 ? Math.max(1, Math.floor((st.totY - van) / v)) : st.tikken;
    for (let i = st.kmh > 0 && laatsteY !== null ? 1 : 0; i <= stappen; i++) {
      klok += 1000;
      const y = st.kmh > 0 ? van + i * v : van;
      laatsteY = y;
      const q = LL(0, y);
      // Koers 1 graad, niet 0: zie test_wissellog. Bij stilstand geen koers, zoals iOS.
      await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: v > 0 ? 1 : NaN }, timestamp: klok });
      rij.push({ y: Math.round(y), app: dichtstbijOSM ? dichtstbijOSM.id : null, slot: handmatigLockActief ? 1 : 0, auto: stilstandAutoLock ? 1 : 0,
                 regel: (typeof regelStaat !== 'undefined' && regelStaat) ? regelStaat.keuze : undefined });
    }
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  return { rij, wissel: lees('sl_wissellog'), regellog: lees('sl_regellog'), tik: lees(TIKLOG_SLEUTEL) };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testSchaduwregel() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));

  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  const A = { id: 9400001, ...LL(0, 100) }, F = { id: 9400002, ...LL(0, 140) }, B = { id: 9400003, ...LL(0, 300) },
        Z = { id: 9400004, ...LL(100, 20) }, H = { id: 9400005, ...LL(0, -30) }, V = { id: 9400006, ...LL(0, 450) };

  const namen = ['osmCache', 'dichtstbijOSM', 'snelheidKmh', 'cacheGeladen', 'stilstandSinds', 'handmatigLockActief', 'stilstandAutoLock',
    'regelStaat', 'opslagSchrijf'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
  const bewHeading = headingBuffer.slice();
  const bewNu = Date.now;
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
  let klok = 1790000000000;
  const lees = () => { try { return JSON.parse(localStorage.getItem(REGELLOG_SLEUTEL)) || []; } catch (e) { return []; } };
  const opzet = (nodes) => {
    Date.now = () => klok;
    osmCache = nodes; cacheGeladen = true; dichtstbijOSM = null; stilstandSinds = 0;
    handmatigLockActief = false; stilstandAutoLock = false;
    headingBuffer.length = 0; for (let i = 0; i < 3; i++) headingBuffer.push(0);
    regelReset(); meetRingGestopt.delete(REGELLOG_SLEUTEL);
    localStorage.setItem(REGELLOG_SLEUTEL, '[]'); localStorage.setItem(WISSELLOG_SLEUTEL, '[]');
  };
  // Eén GPS-tik op (x, y) met snelheid kmh; geeft de keuze van de regel.
  const tik = (x, y, kmh, app) => {
    klok += 1000; snelheidKmh = kmh;
    if (kmh < 3) { if (!stilstandSinds) stilstandSinds = klok; } else stilstandSinds = 0;
    if (app !== undefined) dichtstbijOSM = app ? { ...app, afstand: 0 } : null;
    const p = LL(x, y); regelTik(p.lat, p.lon);
    return regelStaat.keuze === null ? '-' : ({ [A.id]: 'A', [F.id]: 'F', [B.id]: 'B', [Z.id]: 'Z', [H.id]: 'H', [V.id]: 'V' })[regelStaat.keuze] || '?';
  };

  try {
    // ═══ SR1 — de keuze ════════════════════════════════════════
    opzet([A, B, Z, H, V]);
    const r1a = [tik(0, 0, 30), tik(0, 10, 30)].join('');
    eis('SR1a vooruit en dichtstbij: A (100 m), niet Z opzij (78 graden), H achter of V (450 m)', r1a === 'AA', 'AA', r1a);
    opzet([B, V]); const r1b = tik(0, 0, 30);
    eis('SR1b verder dan 400 m doet niet mee: B (300 m) wel, V (450 m) niet', r1b === 'B', 'B', r1b);
    opzet([A]); tik(0, 50, 30); const r1c = tik(0, 40, 30);
    eis('SR1c een licht waar je van wegrijdt (achteruit, koers noord) doet niet mee', r1c === '-', '-', r1c);
    opzet([Z]); const r1d = tik(0, 0, 30);
    eis('SR1d alleen een licht opzij (78 graden): geen licht', r1d === '-', '-', r1d);
    eis('SR1e de constanten: 5 km/u, 60 graden, 400 m, 2 posities, 60 m, 150 m, 1,5 s, 2 s, 80 m, ring 100',
        REGEL_MIN_KMH === 5 && REGEL_HOEK === 60 && REGEL_MAX_M === 400 && REGEL_VOORBIJ_N === 2 && REGEL_KRUISPUNT_M === 60
          && REGEL_VERGEET_M === 150 && REGEL_AFW_MIN_MS === 1500 && REGEL_STOP_MS === 2000 && REGEL_STOP_MAX_M === 80 && REGELLOG_MAX === 100,
        '5/60/400/2/60/150/1500/2000/80/100', [REGEL_MIN_KMH, REGEL_HOEK, REGEL_MAX_M, REGEL_VOORBIJ_N, REGEL_KRUISPUNT_M, REGEL_VERGEET_M,
          REGEL_AFW_MIN_MS, REGEL_STOP_MS, REGEL_STOP_MAX_M, REGELLOG_MAX].join('/'));

    // ═══ SR2 — voorbij ═════════════════════════════════════════
    opzet([A, F, B]);
    const r2 = [tik(0, 90, 30), tik(0, 96, 30), tik(0, 101, 30), tik(0, 106, 30)].join('');
    const voorEen = regelStaat.voorbij.length;
    const r2b = tik(0, 112, 30);
    // V11.37.4: de huidige keuze blijft staan zolang hij binnen REGEL_HOUD_M (15 m) staat en niet voorbij is;
    // de regel springt dus niet meer even naar F, de overkant.
    eis('SR2a na één stijging (106 m) is A nog niet voorbij en houdt de regel A vast (6 m, binnen 15 m); na de tweede (112 m) is A voorbij en valt F mee weg: B',
        r2 === 'AAAA' && voorEen === 0 && r2b === 'B' && regelStaat.voorbij.some(v => v.id === String(A.id)),
        'AAAA, dan B', r2 + ', dan ' + r2b + ' (voorbij ' + regelStaat.voorbij.map(v => v.id).join(',') + ')');
    opzet([A, F, B]); tik(0, 96, 30); tik(0, 101, 30); tik(0, 106, 30);
    const herhaal = tik(0, 106, 30);   // dezelfde positie nog een keer
    eis('SR2b een herhaalde, identieke positie telt niet als tweede stijging', herhaal === 'A' && regelStaat.voorbij.length === 0,
        'A, niet voorbij', herhaal + ', voorbij ' + regelStaat.voorbij.length);
    opzet([A, F, B]); for (const y of [96, 101, 106, 112]) tik(0, y, 30);
    const heeftA = () => regelStaat.voorbij.some(v => v.id === String(A.id));
    tik(0, 200, 30); const nogBewaard = heeftA(); tik(0, 260, 30);
    eis('SR2c een gepasseerd licht wordt vergeten zodra de auto er 150 m vanaf is (A op 100 m bewaard, op 160 m weg; F, nu ook voorbij, blijft)',
        nogBewaard && !heeftA() && regelStaat.voorbij.some(v => v.id === String(F.id)),
        'A bewaard, dan weg; F blijft', nogBewaard + ', dan ' + heeftA() + ' / ' + regelStaat.voorbij.map(v => v.id).join(','));

    // ═══ SR3 — stilstand ═══════════════════════════════════════
    opzet([A, B]); tik(0, 0, 30); const voor3 = regelStaat.keuze;
    const r3 = [tik(0, 150, 3), tik(0, 200, 0)].join('');
    eis('SR3 onder 5 km/u blijft de keuze staan, ook als de positie verspringt', r3 === 'AA' && voor3 === String(A.id), 'AA', r3);

    // ═══ SR4 — de afwijking ════════════════════════════════════
    opzet([A, B, Z]);
    tik(0, 0, 30, Z); tik(0, 5, 30, Z); tik(0, 10, 30, Z);   // de app toont Z, de regel kiest A: 2 s
    tik(0, 15, 30, A);                                          // weer gelijk: de afwijking sluit
    const af4 = lees().filter(r => r.s === 'af');
    eis('SR4a een afwijking van 3 s geeft één regel, met begin, duur, beide lichten, afstanden, peilingen en snelheid',
        af4.length === 1 && af4[0].app === Z.id && af4[0].rg === A.id && af4[0].du === 3 && typeof af4[0].dA === 'number'
          && typeof af4[0].dR === 'number' && typeof af4[0].pA === 'number' && af4[0].kmh === 30,
        '1 regel Z>A, 3 s', JSON.stringify(af4));
    opzet([A, B, Z]); tik(0, 0, 30, Z); tik(0, 5, 30, A);
    eis('SR4b een afwijking van 1 s (korter dan 1,5 s) geeft geen regel', lees().length === 0, 'geen', JSON.stringify(lees()));

    // ═══ SR5 — de stopregel ════════════════════════════════════
    const S1 = { id: 9400011, ...LL(0, 20) }, S2 = { id: 9400012, ...LL(5, 12) };
    opzet([S1, S2, B]);
    for (let y = -130; y <= 0; y += 10) tik(0, y, 30, S2);     // de app toont S2, de regel S1 (of S2)
    const tStop = klok + 1000;
    tik(0, 0, 0, S2);                                            // stil: t0
    meetRingSchrijf(WISSELLOG_SLEUTEL, WISSELLOG_MAX, { t: tStop + 1000, van: S2.id, naar: S1.id, r: 'correctie' });
    tik(0, 0, 0, S1);                                            // de app wisselde naar S1, 1 s na het stilvallen
    const stopVoor = lees().filter(r => r.s === 'stop').length;
    tik(0, 0, 0, S1); tik(0, 0, 0, S1);
    const st5 = lees().filter(r => r.s === 'stop');
    const s5 = st5[0] || {};
    eis('SR5a één stopregel, op 2 s: a100/r100, a50/r50, a30/r30, a2/r2, de route (correctie, 1 s na het stilvallen) en het slot',
        stopVoor === 0 && st5.length === 1 && s5.t === tStop && s5.a100 === S2.id && s5.r100 != null && s5.a30 === S2.id
          && s5.a2 === S1.id && s5.rt === 'correctie' && s5.wt === 1 && s5.sl === '-',
        'stop met a100..a2, rt correctie, wt 1', JSON.stringify(s5));
    tik(0, 10, 20, S1); tik(0, 10, 0, S1); tik(0, 10, 0, S1); tik(0, 10, 0, S1);
    eis('SR5b na wegrijden en opnieuw stoppen: een tweede stopregel', lees().filter(r => r.s === 'stop').length === 2,
        '2', String(lees().filter(r => r.s === 'stop').length));
    opzet([B]); for (let y = -50; y <= 0; y += 10) tik(0, y, 30, B); tik(0, 0, 0, B); tik(0, 0, 0, B); tik(0, 0, 0, B); tik(0, 0, 0, B);
    eis('SR5c geen licht binnen 80 m van de stopplek (B op 300 m): geen stopregel (een file)', lees().filter(r => r.s === 'stop').length === 0,
        'geen', JSON.stringify(lees()));

    // ═══ SR6 — de ring ═════════════════════════════════════════
    opzet([A, B, Z]);
    for (let i = 0; i < 110; i++) { tik(0, i, 30, Z); tik(0, i + 0.5, 30, Z); tik(0, i + 1, 30, A); }
    const ring = lees(); const ruw = localStorage.getItem(REGELLOG_SLEUTEL) || '';
    eis('SR6a een ring van hoogstens 100 regels', ring.length === 100, '100', String(ring.length));
    eis('SR6b klein en Latin-1: gemiddeld < 170 tekens per regel, geen teken boven U+00FF',
        ruw.length / ring.length < 170 && !/[^\u0000-ÿ]/.test(ruw), '< 170, Latin-1', (ruw.length / ring.length).toFixed(0));
    opzet([A, B, Z]); const bewSchrijf = opslagSchrijf;
    opslagSchrijf = (k, v) => (k === REGELLOG_SLEUTEL ? false : bewSchrijf(k, v));
    tik(0, 0, 30, Z); tik(0, 5, 30, Z); tik(0, 10, 30, A);
    opslagSchrijf = bewSchrijf;
    eis('SR6c een vol quotum staakt alleen dit log (meetRingGestopt), en wist zijn eigen sleutel',
        meetRingGestopt.has(REGELLOG_SLEUTEL) && localStorage.getItem(REGELLOG_SLEUTEL) === null, 'gestopt, sleutel weg',
        meetRingGestopt.has(REGELLOG_SLEUTEL) + ' / ' + localStorage.getItem(REGELLOG_SLEUTEL));
    meetRingGestopt.delete(REGELLOG_SLEUTEL);

    // ═══ SR7 — de export ═══════════════════════════════════════
    localStorage.setItem(REGELLOG_SLEUTEL, JSON.stringify([{ t: 1, proef: 'regel' }]));
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
    const r7 = meet && meet.regel && meet.regel[REGELLOG_SLEUTEL];
    eis('SR7 de meetdata-export heeft een bak regel met sl_regellog erin',
        Array.isArray(r7) && r7[0] && r7[0].proef === 'regel', 'regel / sl_regellog', meet ? Object.keys(meet.regel || {}).join(',') || 'leeg' : 'geen export');

    // ═══ SR8a — de regel beslist niets ═════════════════════════
    const code = zc(regelTik) + zc(regelKies) + zc(regelAfwSchrijf) + zc(regelNode);
    eis('SR8a de schaduwregel wijst niets toe aan de keuze-toestand',
        !/\b(dichtstbijOSM|vorigOsmId|handmatigLockActief|handmatigGeselecteerdNodeId|handmatigGeselecteerdTimestamp|stilstandAutoLock|stilstandSinds|laatsteNodeCorrectieTijd|laatsteNodeWisselTijd|bboxOverride|stickyDetectie|fase|puurDichtsteNodeCache|osmCache)\s*=[^=]/.test(code),
        'geen toewijzing', 'ok');
  } finally {
    Date.now = bewNu;
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    headingBuffer.length = 0; for (const h of bewHeading) headingBuffer.push(h);
    meetRingGestopt.delete(REGELLOG_SLEUTEL);
    herstel();
  }

  // ═══ SR8 / SR9 — met de echte onGPS ═════════════════════════
  const bron = new URL('test_schaduwregel.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?regel=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.onGPS !== 'function'; poging++) {   // V11.37.14: de app zelf laadde niet (testopstelling): de pagina opnieuw
        if (poging > 3) throw new Error('testopstelling: de app laadde niet in de iframe (3 pogingen)');
        await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; f.src = pagina + '?opnieuw=' + Math.random(); });
      }
      const w = f.contentWindow;
      for (let poging = 1; ; poging++) {   // V11.37.14: een laadfout is de testopstelling, niet de app; zie test_merktekens
        try {
          await new Promise((ok, nee) => {
            const sc = w.document.createElement('script');
            sc.src = bron + '?t=' + Date.now() + '-' + poging; sc.onload = ok; sc.onerror = () => { sc.remove(); nee(new Error('laden')); };
            w.document.head.appendChild(sc);
          });
          break;
        } catch (e) {
          if (poging >= 3) throw new Error('testopstelling: het testscript laadde niet in de iframe (3 pogingen)');
          await new Promise((r) => setTimeout(r, 250 * poging));
        }
      }
      return await w.regelRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], wissel: [], regellog: [], tik: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const nodes = [{ id: 9500001, x: 0, y: 0 }, { id: 9500002, x: 0, y: 150 }];
  const ritTik = { nodes, start: 9500001, tik: true, stukken: [{ vanY: -120, totY: 140, kmh: 30 }] };
  const ritStop = { nodes, start: 9500001, stukken: [{ vanY: -120, totY: -6, kmh: 30 }, { tikken: 5, kmh: 0 }, { totY: 140, kmh: 30 }] };
  // V11.37.4: SR8b vergelijkt de regel met A3, dus met de achter-regel uit; SR8d met hem aan.
  const met = await rit({ ...ritTik, uitAchter: true }), zonder = await rit({ ...ritTik, zonderRegel: true, uitAchter: true });
  const metA = await rit(ritTik);
  const metS = await rit(ritStop), zonderS = await rit({ ...ritStop, zonderRegel: true });
  const eersteB = (r, veld) => { const i = r.rij.findIndex(x => x[veld] === 9500002 || x[veld] === '9500002'); return i < 0 ? null : r.rij[i].y; };
  const afw8 = (met.regellog || []).filter(r => r.s === 'af');
  eis('SR8b met een tik op A: de regel kiest B direct na het passeren van A, de app pas later (A3), en die afwijking staat in het log',
      !met.fout && eersteB(met, 'regel') !== null && eersteB(met, 'app') !== null && eersteB(met, 'regel') < eersteB(met, 'app')
        && afw8.some(r => r.app === 9500001 && r.rg === 9500002),
      'regel eerder dan app, afwijking A>B', met.fout || `regel B op ${eersteB(met, 'regel')} m, app B op ${eersteB(met, 'app')} m, ${afw8.length} afwijking(en)`);
  const afw8d = (metA.regellog || []).filter(r => r.s === 'af');
  eis('SR8d V11.37.4: met de achter-regel aan kiezen de app en de regel B op dezelfde plek, en er is geen afwijking A>B',
      !metA.fout && eersteB(metA, 'regel') !== null && eersteB(metA, 'app') === eersteB(metA, 'regel') && !afw8d.some(r => r.app === 9500001 && r.rg === 9500002),
      'gelijk, geen afwijking', metA.fout || `regel B op ${eersteB(metA, 'regel')} m, app B op ${eersteB(metA, 'app')} m, ${afw8d.length} afwijking(en)`);
  const stop8 = (metS.regellog || []).filter(r => r.s === 'stop');
  eis('SR8c een stop 6 m voor A geeft één stopregel, met A voor de app en de regel na 2 s',
      !metS.fout && stop8.length === 1 && stop8[0].a2 === 9500001 && stop8[0].r2 === 9500001,
      '1 stopregel A/A', metS.fout || JSON.stringify(stop8));
  const zelfde = (p, q) => JSON.stringify(p.rij.map(x => [x.y, x.app, x.slot, x.auto])) === JSON.stringify(q.rij.map(x => [x.y, x.app, x.slot, x.auto]))
    && JSON.stringify(p.wissel.map(x => [x.van, x.naar, x.r])) === JSON.stringify(q.wissel.map(x => [x.van, x.naar, x.r]))
    && JSON.stringify(p.tik.map(x => [x.s, x.reden || x.tak || ''])) === JSON.stringify(q.tik.map(x => [x.s, x.reden || x.tak || '']));
  eis('SR9a NIETS VERANDERT (rit met tik): met en zonder schaduwregel in elke GPS-tik dezelfde keuze, hetzelfde slot, dezelfde wissellog en tiklog',
      !met.fout && !zonder.fout && met.rij.length > 20 && zelfde(met, zonder), 'gelijk', met.fout || zonder.fout || `${met.rij.length} tikken`);
  eis('SR9b NIETS VERANDERT (rit met stop): idem',
      !metS.fout && !zonderS.fout && metS.rij.length > 20 && zelfde(metS, zonderS), 'gelijk', metS.fout || zonderS.fout || `${metS.rij.length} tikken`);

  // ═══ SR10 — regressie ═══════════════════════════════════════
  const NL = String.fromCharCode(10);
  // V11.37.4: vier regels van het V9-blok in onGPS kregen een tak voor 'geen licht'; hier terug
  // naar hun oude vorm, daarna gaat de aanroep van achterTik weg met het filter (zie test_achter).
  const terugV11374 = (s) => s
    .replace('if ((dichtstbijOSM || (achterAan() && v9KandidaatNode !== null)) && cacheGeladen) {   // V11.37.4: een lopende meting loopt ook zonder getoond licht door', 'if (dichtstbijOSM && cacheGeladen) {')
    .replace('const afst = dichtstbijOSM ? dichtstbijOSM.afstand : Infinity;   // V11.37.4', 'const afst = dichtstbijOSM.afstand;')
    .replace('const nodeId = dichtstbijOSM ? String(dichtstbijOSM.id) : null;   // V11.37.4', 'const nodeId = String(dichtstbijOSM.id);')
    .replace('kandidaatPos ?? (dichtstbijOSM ? { lat: dichtstbijOSM.lat, lon: dichtstbijOSM.lon } : { lat, lon }),   // V11.37.4', 'kandidaatPos ?? { lat: dichtstbijOSM.lat, lon: dichtstbijOSM.lon },');
  const zonderV113713 = (s) => String(s).split(NL).filter(l => !/V11\.37\.13(?!\d)/.test(l)).join(NL);   // V11.37.14: R1 en R3 (test_tegenbocht); het oude patroon hieronder slikte die regels stil in
  const zonderV113712 = (s) => zonderV113713(s).split(NL).filter(l => !/V11\.37\.12(?!\d)/.test(l)).join(NL);   // V11.37.14: de rem en de fietsdekking (test_overpass); idem
  const zonderV113711 = (s) => zonderV113712(s).split(NL).filter(l => !/V11\.37\.11(?!\d)/.test(l)).join(NL);   // V11.37.14: de tegenrichting-regel (test_tegenrichting); idem
  const g = terugV11374(zonderV113711(onGPS)).split(NL).filter(l => !/V11\.34\.[2-9](?!\d)|V11\.36\.[14](?!\d)|V11\.37\.[124](?!\d)/.test(l)).join(NL);   // V11.37.2: gedrag, getoetst in test_snelroute SN6b; V11.37.4: test_achter; V11.37.14: zonderV113711
  eis('SR10a onGPS zonder de meetregels (ook de schaduwregel) is byte-gelijk aan V11.37.0 (c767e2a3 / 14333)',
      fnv(g) === 'c767e2a3' && g.length === 14333, 'c767e2a3 / 14333', fnv(g) + ' / ' + g.length);
  const og = zc(onGPS);
  eis('SR10b in onGPS staat de schaduwregel na wisselNa, dus na de hele beslisketen',
      og.indexOf('regelTik(lat, lon)') > og.indexOf('wisselNa(lat, lon)') && og.indexOf('wisselNa(lat, lon)') > 0, 'na wisselNa', 'ok');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testSchaduwregel = testSchaduwregel; window.regelRitBinnen = regelRitBinnen; }
