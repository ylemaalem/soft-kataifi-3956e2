// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_passage.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.0: A3, het slot van een tik of lijstkeuze laat los zodra het
//  hele kruispunt 30 m voorbij is, in plaats van pas na 100 m.
//
//  Het vaste stratenplan: licht A op (0, 0), het volgende licht B 150 m
//  noordelijk. Waar nodig een tweede mast F van het kruispunt van A, 50 m
//  noordelijk (aan de overkant). De auto rijdt naar het noorden.
//
//  PS1  de beslissing (a3Beoordeel), voorwaarde voor voorwaarde
//  PS2  checkHandLockPassage met nagebootste GPS-tikken: 0-29 m nooit, een
//       GPS-sprong nooit, de lamp nog in beeld nooit, een mast aan de overkant
//       nooit, een bocht wel, een lijstslot als een tikslot, het stilstandslot
//       nooit, en wat er bij het loslaten gebeurt
//  PS3  met de echte onGPS: loslaten op ~47 m en in dezelfde tik het volgende
//       licht, één tiklog-regel 'passage', en de wissellog
//  PS9  REGRESSIE: onGPS zonder de A3-regel en de meetregels is V11.34.1, en de
//       vastgepinde loslaatfuncties zijn onaangeroerd
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_passage.js';
//      document.head.appendChild(s);
//      s.onload = () => testPassage().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
async function passageRitBinnen(opt) {
  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  try { localStorage.setItem('sl_wissellog', '[]'); localStorage.setItem('sl_opslaglog', '[]'); localStorage.setItem(TIKLOG_SLEUTEL, '[]'); } catch (e) {}
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
  vergrendelNodeHandmatig(start.id, opt.soort || 'beeld');
  if (opt.lamp) {
    // een getikte lamp, zoals de handler hem zet, die al een tijd niet meer gezien is
    tikZet(null, 1000, 800);
    stickyDetectie = { cx: 320, cy: 240, camX: 1000, camY: 800, camH: 40, bron: 'tik', tijd: klok, klasse: 0, familie: 'rood' };
    bboxOverrideLaatsteMatch = klok - (opt.lampWegMs || 0);
  }
  const rij = [];
  const v = opt.kmh / 3.6;
  for (let y = opt.vanY; y <= opt.totY; y += v) {
    klok += 1000;
    if (opt.lamp && opt.lampZichtbaarTot != null && y <= opt.lampZichtbaarTot) bboxOverrideLaatsteMatch = klok;
    const q = LL(0, y);
    await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: 1 }, timestamp: klok });
    tikLogWaak();   // zoals elke camerarun: de wachter van de tiklog
    rij.push({ y: Math.round(y * 10) / 10, gekozen: dichtstbijOSM ? dichtstbijOSM.id : null, slot: handmatigLockActief ? 1 : 0,
               tik: bboxOverride !== null ? 1 : 0 });
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  return { rij, tik: lees(TIKLOG_SLEUTEL), wissel: lees('sl_wissellog') };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testPassage() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));

  // ═══ PS1 — de beslissing ═════════════════════════════════════
  const T = (o) => ({ slot: true, id: 'A', afst: 35, achter: true, kmh: 30, lampWegMs: null, ...o });
  const twee = (a, b) => { const r1 = a3Beoordeel(a, null); const r2 = a3Beoordeel(b, r1.reeks); return [r1.los, r2.los]; };
  const p1a = [0, 10, 20, 29.9].map(af => twee(T({ afst: af }), T({ afst: af + 0.05 }))[1]);
  eis('PS1a onder 30 m nooit, ook niet na twee tikken (0, 10, 20, 29,9 m)', p1a.every(x => x === false), 'nooit', p1a.join(','));
  eis('PS1b één tik is niet genoeg; de tweede met een grotere afstand wel',
      twee(T({ afst: 31 }), T({ afst: 39 })).join(',') === 'false,true', 'false,true', twee(T({ afst: 31 }), T({ afst: 39 })).join(','));
  eis('PS1c een afstand die niet groeit (GPS-ruis terug) begint opnieuw',
      twee(T({ afst: 39 }), T({ afst: 39 })).join(',') === 'false,false' && twee(T({ afst: 39 }), T({ afst: 38 })).join(',') === 'false,false',
      'false,false / false,false', twee(T({ afst: 39 }), T({ afst: 39 })).join(',') + ' / ' + twee(T({ afst: 39 }), T({ afst: 38 })).join(','));
  eis('PS1d onder 10 km/u nooit, vanaf 10 wel',
      twee(T({ kmh: 9.9 }), T({ kmh: 9.9, afst: 40 }))[1] === false && twee(T({ kmh: 10 }), T({ kmh: 10, afst: 40 }))[1] === true, 'nee / ja', 'ok');
  eis('PS1e een lamp die korter dan 2 s weg is houdt vast; 2 s of geen tik op de lamp laat los',
      twee(T({ lampWegMs: 1999 }), T({ lampWegMs: 2999, afst: 40 }))[1] === false
        && twee(T({ lampWegMs: 2000 }), T({ lampWegMs: 3000, afst: 40 }))[1] === true
        && twee(T({ lampWegMs: null }), T({ lampWegMs: null, afst: 40 }))[1] === true, 'nee / ja / ja', 'ok');
  eis('PS1f niet achter je, geen slot, of een ander licht in de tweede tik: niet los',
      twee(T({ achter: false }), T({ achter: false, afst: 40 }))[1] === false && twee(T({ slot: false }), T({ slot: false, afst: 40 }))[1] === false
        && twee(T({ id: 'A' }), T({ id: 'X', afst: 40 }))[1] === false, 'nee / nee / nee', 'ok');
  eis('PS1g de constanten: 30 m, 10 km/u, 2 tikken, 2 s, 60 m, en A3 staat aan',
      A3_AFSTAND_M === 30 && A3_MIN_KMH === 10 && A3_TIKKEN === 2 && A3_LAMP_WEG_MS === 2000 && A3_KRUISPUNT_M === 60 && A3_ACTIEF === true,
      '30/10/2/2000/60/aan', [A3_AFSTAND_M, A3_MIN_KMH, A3_TIKKEN, A3_LAMP_WEG_MS, A3_KRUISPUNT_M, A3_ACTIEF].join('/'));
  eis('PS1h a3Beoordeel is puur: geen toewijzing aan de app-toestand',
      !/\b(handmatigLockActief|handmatigGeselecteerdNodeId|stilstandAutoLock|bboxOverride|stickyDetectie|a3Reeks|a3LosTijd|dichtstbijOSM)\s*=[^=]/.test(zc(a3Beoordeel)),
      'puur', 'ok');

  // ═══ PS2 — checkHandLockPassage met nagebootste tikken ═══════
  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  const namen = ['osmCache', 'handmatigLockActief', 'handmatigGeselecteerdNodeId', 'handmatigGeselecteerdTimestamp', 'stilstandAutoLock',
    'snelheidKmh', 'bboxOverride', 'bboxOverrideTijd', 'bboxOverrideLaatsteMatch', 'bboxOverrideCamX', 'bboxOverrideCamY',
    'bboxOverrideMatchTeller', 'stickyDetectie', 'stickyMissTeller', 'tapSeedDetectie', 'a3Reeks', 'a3LosTijd',
    'tikLogArr', 'tikLogStop', 'tikLogVorige', 'tikLogLevend', 'dichtstbijOSM'];
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
  const A = { id: 9200001, naam: 'A', ...LL(0, 0) }, B = { id: 9200002, naam: 'B', ...LL(0, 150) }, F = { id: 9200003, naam: 'F', ...LL(0, 50) };
  const opzet = (o) => {
    const opt = o || {};
    Date.now = () => klok;
    osmCache = opt.nodes || [A, B];
    handmatigLockActief = true; stilstandAutoLock = !!opt.auto; handmatigGeselecteerdNodeId = String(A.id);
    bboxOverride = null; bboxOverrideTijd = 0; bboxOverrideLaatsteMatch = 0; stickyDetectie = null; tapSeedDetectie = null;
    a3Reeks = null; a3LosTijd = 0;
    headingBuffer.length = 0; for (let i = 0; i < 3; i++) headingBuffer.push(opt.koers != null ? opt.koers : 0);
    tikLogArr = []; tikLogStop = false; tikLogVorige = { tak: null, t: 0 }; tikLogLevend = null;
    localStorage.setItem(TIKLOG_SLEUTEL, '[]');
  };
  // Eén tik op (x, y). Geeft 1 als het slot daarna los is.
  const stap = (x, y, kmh, koers) => {
    klok += 1000; snelheidKmh = kmh;
    if (koers != null) { headingBuffer.length = 0; for (let i = 0; i < 3; i++) headingBuffer.push(koers); }
    const p = LL(x, y); checkHandLockPassage(p.lat, p.lon);
    return handmatigLockActief ? 0 : 1;
  };
  const reeks = (punten, kmh) => punten.map(([x, y, k]) => stap(x, y, kmh, k)).join('');

  try {
    opzet(); const p2a = reeks([[0, 10], [0, 20], [0, 29.9], [0, 29.95]], 30);
    opzet(); const p2a2 = reeks([[0, 40], [0, 50], [0, 60]], 0);
    eis('PS2a 0-29 m voorbij nooit; stilstaand (0 km/u) op 40-60 m ook niet', p2a === '0000' && p2a2 === '000', '0000 / 000', p2a + ' / ' + p2a2);
    opzet(); const p2b = reeks([[0, 10], [0, 60], [0, 12], [0, 14]], 30);
    eis('PS2b één GPS-sprong (10 -> 60 -> 12 m) laat nooit los', p2b === '0000', '0000', p2b);
    opzet(); bboxOverride = { cx: 1, cy: 1 }; bboxOverrideTijd = klok;
    const zicht = () => { bboxOverrideLaatsteMatch = klok + 1000 - 500; };   // gezien, een halve seconde geleden
    const p2c = [[0, 35], [0, 45], [0, 55]].map(([x, y]) => { zicht(); return stap(x, y, 30); }).join('');
    eis('PS2c de getikte lamp nog in beeld (0,5 s geleden gezien): nooit los', p2c === '000', '000', p2c);
    const p2c2 = reeks([[0, 65], [0, 75], [0, 85]], 30);   // nu 1,5 / 2,5 / 3,5 s niet gezien
    const losTik = JSON.parse(localStorage.getItem(TIKLOG_SLEUTEL) || '[]').filter(r => r.s === 'los');
    eis('PS2d de lamp 2 s uit beeld (vanaf de tweede tik): los op de tik daarna, met één tiklog-regel los/passage, en de tik en sticky weg',
        p2c2 === '001' && losTik.length === 1 && losTik[0].reden === 'passage' && bboxOverride === null && stickyDetectie === null && tapSeedDetectie === null,
        '001, 1 x passage, tik weg', p2c2 + ', ' + losTik.map(r => r.reden).join('+') + ', tik ' + (bboxOverride === null ? 'weg' : 'staat'));
    opzet({ nodes: [A, B, F] }); const p2e = reeks([[0, 35], [0, 45], [0, 55], [0, 65]], 30);
    eis('PS2e een mast van hetzelfde kruispunt aan de overkant (F, 50 m): pas los als ook F voorbij is',
        p2e === '0001', '0001', p2e);
    opzet(); const p2f = reeks([[0, 5, 0], [10, 12, 90], [25, 14, 90], [40, 15, 90], [55, 15, 90]], 30);
    eis('PS2f een bocht rechtsaf vlak na het licht: los zodra A 30 m achter je ligt, op de tweede tik',
        p2f === '00001' || p2f === '00011', '0000 dan 1', p2f);
    opzet(); const p2g = reeks([[0, 35], [0, 45]], 30);   // geen tik op de lamp: een lijstkeuze
    eis('PS2g een lijstslot (zonder tik op de lamp) laat net zo los als een tikslot', p2g === '01', '01', p2g);
    opzet({ auto: true }); const p2h = reeks([[0, 35], [0, 45], [0, 55]], 30);
    eis('PS2h het stilstandslot laat A3 met rust (dat gaat los boven 8 km/u, elders)', p2h === '000' && handmatigLockActief === true,
        '000, slot staat', p2h + ', slot ' + handmatigLockActief);
    opzet(); stap(0, 35, 30); const tVoor = klok; stap(0, 45, 30);
    eis('PS2i bij het loslaten: de drie slotvelden uit, a3LosTijd gezet, de reeks leeg',
        handmatigLockActief === false && handmatigGeselecteerdNodeId === null && stilstandAutoLock === false && a3LosTijd > tVoor && a3Reeks === null,
        'uit / gezet / leeg', `${handmatigLockActief}/${handmatigGeselecteerdNodeId}/${a3LosTijd > tVoor}/${a3Reeks}`);
    opzet(); const p2j = reeks([[0, 35], [0, 45]], 30);
    eis('PS2j een koers van precies 0 (pal noord) werkt: A3 gebruikt isStoplichtVoorbij niet',
        p2j === '01' && !/isStoplichtVoorbij\(/.test(zc(checkHandLockPassage)) && /if \(!A3_ACTIEF\) return;/.test(zc(checkHandLockPassage)),
        '01, eigen peiling, schakelaar bovenaan', p2j);
  } finally {
    Date.now = bewNu;
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    headingBuffer.length = 0; for (const h of bewHeading) headingBuffer.push(h);
    herstel();
  }

  // ═══ PS3 — met de echte onGPS ══════════════════════════════════
  const bron = new URL('test_passage.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?passage=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      const w = f.contentWindow;
      await new Promise((ok, nee) => {
        const sc = w.document.createElement('script');
        sc.src = bron + '?t=' + Date.now(); sc.onload = ok; sc.onerror = () => nee(new Error('laden'));
        w.document.head.appendChild(sc);
      });
      return await w.passageRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], tik: [], wissel: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const nodes = [{ id: 9200001, x: 0, y: 0 }, { id: 9200002, x: 0, y: 150 }];
  const basis = { nodes, start: 9200001, kmh: 30, vanY: -120, totY: 140 };
  const tik = await rit({ ...basis, lamp: true, lampWegMs: 5000, lampZichtbaarTot: -10 });
  const lijst = await rit({ ...basis, soort: 'lijst' });
  const losIdx = tik.rij.findIndex(r => r.slot === 0);
  const losRij = tik.rij[losIdx] || {};
  eis('PS3a met een tik: los op ~47 m (twee tikken vanaf 30 m), en in DEZELFDE tik het volgende licht',
      !tik.fout && losRij.y >= 30 && losRij.y < 60 && losRij.gekozen === 9200002 && tik.rij[losIdx - 1].gekozen === 9200001,
      'los tussen 30 en 60 m, meteen B', tik.fout || `los op ${losRij.y} m, gekozen ${losRij.gekozen}`);
  const losRegels = tik.tik.filter(r => r.s === 'los');
  eis('PS3b de tiklog: precies één los-regel, reden passage (geen tweede via de wachter)',
      losRegels.length === 1 && losRegels[0].reden === 'passage', '1 x passage', losRegels.map(r => r.reden).join('+') || 'geen');
  const w3 = tik.wissel;
  eis('PS3c de wissellog: één regel A->B, reden passage, a3 1',
      w3.length === 1 && w3[0].r === 'passage' && w3[0].a3 === 1 && w3[0].van === 9200001 && w3[0].naar === 9200002,
      'passage, a3 1', w3.map(x => `${x.r} a3 ${x.a3} vb ${x.vb}`).join(' ; ') || 'geen');
  const losL = lijst.rij.findIndex(r => r.slot === 0);
  eis('PS3d een lijstkeuze laat op dezelfde plek los als een tik',
      !lijst.fout && losL === losIdx && lijst.rij[losL].gekozen === 9200002, 'zelfde tik', `tik ${losIdx}, lijst ${losL}`);
  const lampLang = await rit({ ...basis, lamp: true, lampWegMs: 0, lampZichtbaarTot: 60 });
  const losLang = lampLang.rij.findIndex(r => r.slot === 0);
  eis('PS3e blijft de getikte lamp tot 60 m in beeld, dan laat A3 pas los als hij 2 s weg is (na 60 m)',
      !lampLang.fout && losLang > losIdx && lampLang.rij[losLang].y > 60, 'later dan 60 m', lampLang.fout || `los op ${(lampLang.rij[losLang] || {}).y} m`);

  // ═══ PS9 — regressie ═════════════════════════════════════════
  const NL = String.fromCharCode(10);
  const g = String(onGPS).split(NL).filter(l => !/V11\.36\.4|V11\.37\.[01]/.test(l)).join(NL);
  eis('PS9a onGPS zonder de A3-regel en de meetregels is byte-gelijk aan V11.34.1',
      fnv(g) === '58346b1c' && g.length === 14246, '58346b1c / 14246', fnv(g) + ' / ' + g.length);
  const vast = String(isStoplichtVoorbij);
  eis('PS9b isStoplichtVoorbij is onaangeroerd (vijf aanroepers; A3 gebruikt hem niet)',
      fnv(vast) === '38a0d2ed' && vast.length === 338, '38a0d2ed / 338', fnv(vast) + ' / ' + vast.length);
  const og = zc(onGPS);
  eis('PS9c in onGPS staat A3 direct na checkHandLockVerval en vóór updateDichtbij',
      og.indexOf('checkHandLockVerval(lat, lon)') > 0 && og.indexOf('checkHandLockPassage(lat, lon)') > og.indexOf('checkHandLockVerval(lat, lon)')
        && og.indexOf('checkHandLockPassage(lat, lon)') < og.indexOf('updateDichtbij(lat, lon)'), 'op volgorde', 'ok');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testPassage = testPassage; window.passageRitBinnen = passageRitBinnen; }
