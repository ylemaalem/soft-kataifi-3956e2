// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_koerslog.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.15: de koers bij kruipen (sl_koerslog), alleen meten.
//
//  Bij 3 tot 10 km/u één regel per GPS-tik: de koers van de tik (k), de gladde
//  koers (kg), de koers uit de plekken (kp: de peiling vanaf de jongste eerdere
//  plek die minstens 5 m terug ligt, hoogstens 20 s oud), die verplaatsing (kd)
//  en haar leeftijd (ka), het verschil (dk) en of dat meer dan 15 graden is (vs).
//
//  KL1  de constanten
//  KL2  alleen bij 3 tot 10 km/u een regel, maar het spoor groeit bij elke snelheid
//  KL3  kp, kd, ka, dk en vs, met de grens van 15 graden
//  KL4  geen kp zolang de auto nog geen 5 m reed, of als die plek te oud is
//  KL5  een tik zonder koers, of met een negatieve koers
//  KL6  een herhaalde plek: hz, en het spoor groeit niet
//  KL7  een ring van 150, klein en Latin-1; een vol quotum staakt alleen dit log
//  KL8  de export heeft een eigen bak 'koers'
//  KL9  NIETS VERANDERT: dezelfde ritten met de echte onGPS, met en zonder deze
//       meting, geven in elke GPS-tik dezelfde keuze, hetzelfde slot en dezelfde
//       logs; en de meting schreef echt
//  KL10 de meting wijst niets toe aan de keuze-toestand
//  KL11 regressie: onGPS en exporteerMeetdata zonder de V11.37.15-regels zijn
//       byte-gelijk aan V11.37.13, en alleen die twee functies kregen zo'n regel
//
//  Alle plekken en nummers zijn bedacht: een rechte weg naar het noorden vanaf
//  een basispunt (52.0000, 5.0000), lichten met nummers 96000xx.
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_koerslog.js';
//      document.head.appendChild(s);
//      s.onload = () => testKoerslog().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
// opt: { nodes, start, tik, zonderMeting, punten: [{ x, y, kmh, koers }] }; kmh 0 = stilstaan, koers leeg = geen koers
async function koersRitBinnen(opt) {
  const LAT0 = 52.0000, LON0 = 5.0000;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.zonderMeting) window.koersLogTik = () => {};
  try { for (const k of ['sl_wissellog', 'sl_opslaglog', 'sl_regellog', 'sl_koerslog', TIKLOG_SLEUTEL]) localStorage.setItem(k, '[]'); } catch (e) {}
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
  for (const p of opt.punten) {
    klok += 1000;
    const q = LL(p.x, p.y);
    await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: p.kmh / 3.6, heading: p.koers === undefined ? NaN : p.koers, accuracy: 5 }, timestamp: klok });
    rij.push({ y: Math.round(p.y), app: dichtstbijOSM ? dichtstbijOSM.id : null, slot: handmatigLockActief ? 1 : 0, auto: stilstandAutoLock ? 1 : 0,
               regel: (typeof regelStaat !== 'undefined' && regelStaat) ? regelStaat.keuze : undefined });
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  return { rij, wissel: lees('sl_wissellog'), regellog: lees('sl_regellog'), tik: lees(TIKLOG_SLEUTEL), opslag: lees('sl_opslaglog'), koers: lees('sl_koerslog') };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testKoerslog() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const NL = String.fromCharCode(10);

  const LAT0 = 52.0000, LON0 = 5.0000;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });

  const namen = ['koersSpoor', 'snelheidKmh', 'opslagSchrijf'];
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
  const lees = () => { try { return JSON.parse(localStorage.getItem(KOERSLOG_SLEUTEL)) || []; } catch (e) { return []; } };
  const opzet = () => {
    Date.now = () => klok;
    koersSpoor = []; headingBuffer.length = 0;
    meetRingGestopt.delete(KOERSLOG_SLEUTEL);
    localStorage.setItem(KOERSLOG_SLEUTEL, '[]');
  };
  // Eén GPS-tik op (x, y) met snelheid kmh en koers k (undefined = geen koers); geeft de nieuwe regel, of null.
  const tik = (x, y, kmh, k, ms = 1000) => {
    klok += ms; snelheidKmh = kmh;
    const p = LL(x, y), voor = lees().length;
    if (typeof k === 'number' && !isNaN(k)) { headingBuffer.push(k); if (headingBuffer.length > 3) headingBuffer.shift(); }
    koersLogTik({ coords: { latitude: p.lat, longitude: p.lon, speed: kmh / 3.6, heading: k === undefined ? NaN : k, accuracy: 4.6 } });
    const ring = lees();
    return ring.length > voor ? ring[ring.length - 1] : null;
  };
  const stap = 5 / 3.6;   // 5 km/u: 1,39 m per tik van 1 s

  try {
    // ═══ KL1 — de constanten ═══════════════════════════════════
    eis('KL1 de constanten: 3 tot 10 km/u, 5 m, 20 s, 40 plekken, 15 graden, ring 150, sleutel sl_koerslog',
        KOERSLOG_MIN_KMH === 3 && KOERSLOG_MAX_KMH === 10 && KOERSLOG_PLEK_M === 5 && KOERSLOG_SPOOR_MS === 20000 && KOERSLOG_SPOOR_N === 40
          && KOERSLOG_VERSCHIL === 15 && KOERSLOG_MAX === 150 && KOERSLOG_SLEUTEL === 'sl_koerslog',
        '3/10/5/20000/40/15/150/sl_koerslog', [KOERSLOG_MIN_KMH, KOERSLOG_MAX_KMH, KOERSLOG_PLEK_M, KOERSLOG_SPOOR_MS, KOERSLOG_SPOOR_N,
          KOERSLOG_VERSCHIL, KOERSLOG_MAX, KOERSLOG_SLEUTEL].join('/'));

    // ═══ KL2 — de snelheidsband ════════════════════════════════
    opzet();
    const band = [[2.9, 0], [3, 3], [5, 6], [9.9, 9], [10, 12], [30, 20]].map(([v, y]) => tik(0, y, v, 0) ? 'ja' : 'nee').join(',');
    eis('KL2a alleen bij 3 tot 10 km/u een regel: 2,9 nee; 3, 5 en 9,9 ja; 10 en 30 nee', band === 'nee,ja,ja,ja,nee,nee',
        'nee,ja,ja,ja,nee,nee', band);
    opzet();
    tik(0, 0, 30, 0); tik(0, 8, 30, 0); tik(0, 16, 30, 0);   // te snel voor een regel, wel in het spoor
    const r2 = tik(0, 17, 5, 0);
    eis('KL2b het spoor groeit ook boven 10 km/u: de eerste tik bij 5 km/u heeft meteen een kp (vanaf 8 m terug, 9 m)',
        koersSpoor.length === 4 && r2 && r2.kp === 0 && r2.kd === 9 && r2.ka === 2 && r2.v === 5,
        '4 plekken, kp 0, kd 9, ka 2', koersSpoor.length + ' plekken, ' + JSON.stringify(r2));

    // ═══ KL3 — kp, kd, ka, dk, vs ══════════════════════════════
    opzet();
    const r3 = [];
    for (let i = 0; i <= 5; i++) r3.push(tik(0, i * stap, 5, 20));
    const e3 = r3[4];   // 4 tikken: 5,56 m, de eerste plek die 5 m terug ligt
    eis('KL3a noordwaarts met 5 km/u en een GPS-koers van 20: na 4 tikken kp 0, kd 6, ka 4, dk 20, vs 1 (meer dan 15)',
        !r3[3].kp && e3 && e3.k === 20 && e3.kp === 0 && e3.kd === 6 && e3.ka === 4 && e3.dk === 20 && e3.vs === 1 && e3.kg === 20 && e3.acc === 5,
        'k 20, kp 0, kd 6, ka 4, dk 20, vs 1', JSON.stringify(e3));
    eis('KL3b daarna steeds de jongste plek die 5 m terug ligt: tik 5 gebruikt de plek van tik 1 (5,56 m, 4 s)',
        r3[5] && r3[5].kd === 6 && r3[5].ka === 4, 'kd 6, ka 4', JSON.stringify(r3[5]));
    const grens = (k) => { opzet(); let r = null; for (let i = 0; i <= 4; i++) r = tik(0, i * stap, 5, k); return r ? r.dk + '/' + r.vs : 'geen'; };
    const g3 = [15, 16, 345, 344, 180].map(grens).join(' ');
    eis('KL3c de grens: 15 graden telt als gelijk, 16 niet; links net zo (345 = -15, 344 = -16); recht tegengesteld is 180',
        g3 === '15/0 16/1 -15/0 -16/1 180/1', '15/0 16/1 -15/0 -16/1 180/1', g3);
    opzet(); let r3d = null;
    for (let i = 0; i <= 4; i++) r3d = tik(i * stap, 0, 5, 90);
    eis('KL3d oostwaarts: kp 90, dk 0, vs 0', r3d && r3d.kp === 90 && r3d.dk === 0 && r3d.vs === 0, 'kp 90, dk 0', JSON.stringify(r3d));

    // ═══ KL4 — geen kp ═════════════════════════════════════════
    opzet();
    const r4 = [tik(0, 0, 5, 0), tik(0, stap, 5, 0), tik(0, 2 * stap, 5, 0)];
    eis('KL4a zolang de auto nog geen 5 m reed: geen kp, geen dk, geen vs (wel k en v)',
        r4.every(r => r && !('kp' in r) && !('dk' in r) && !('vs' in r) && r.k === 0 && r.v === 5), 'zonder kp', JSON.stringify(r4[2]));
    opzet();
    tik(0, 0, 5, 0); tik(0, 0, 2, 0, 25000);   // 25 s stil op dezelfde plek: die plek is daarna te oud
    const r4b = tik(0, 6, 5, 0);
    eis('KL4b een plek ouder dan 20 s telt niet: na 25 s stilstand geen kp, ook al ligt de oude plek 6 m terug',
        r4b && !('kp' in r4b), 'geen kp', JSON.stringify(r4b));

    // ═══ KL5 — geen of een ongeldige koers ═════════════════════
    opzet();
    for (let i = 0; i < 4; i++) tik(0, i * stap, 5, 0);
    const r5a = tik(0, 4 * stap, 5, undefined);
    eis('KL5a een tik zonder koers: geen k, geen dk, geen vs, wel kp en kg (de gladde koers van de vorige tikken)',
        r5a && !('k' in r5a) && !('dk' in r5a) && !('vs' in r5a) && r5a.kp === 0 && r5a.kg === 0, 'zonder k', JSON.stringify(r5a));
    const r5b = tik(0, 5 * stap, 5, -1);
    eis('KL5b een negatieve koers blijft staan als k, maar geeft geen dk en geen vs', r5b && r5b.k === -1 && !('dk' in r5b) && !('vs' in r5b),
        'k -1, zonder dk', JSON.stringify(r5b));
    opzet(); let r5c = null;
    for (let i = 0; i <= 4; i++) r5c = tik(0, i * stap, 5, 359.7);
    eis('KL5c 359,7 graden wordt 0, niet 360', r5c && r5c.k === 0 && r5c.dk === 0, 'k 0', JSON.stringify(r5c));

    // ═══ KL6 — een herhaalde plek ══════════════════════════════
    opzet();
    tik(0, 0, 5, 0); tik(0, stap, 5, 0);
    const n6 = koersSpoor.length;
    const r6 = tik(0, stap, 5, 0);
    eis('KL6 dezelfde plek als de vorige tik: hz 1, en het spoor groeit niet', r6 && r6.hz === 1 && koersSpoor.length === n6,
        'hz 1, ' + n6 + ' plekken', JSON.stringify(r6) + ', ' + koersSpoor.length + ' plekken');

    // ═══ KL7 — de ring ═════════════════════════════════════════
    opzet();
    const ruis = [0, 12, -15, 20, -8, 18, -20, 5, -3, 9];
    for (let i = 0; i < 200; i++) tik(0.3 * Math.sin(i / 5), i * 1.9, 3.1 + (i % 7), (360 + ruis[i % 10] + 1) % 360);
    const ring = lees(); const ruw = localStorage.getItem(KOERSLOG_SLEUTEL) || '';
    eis('KL7a een ring van hoogstens 150 regels', ring.length === 150, '150', String(ring.length));
    const perRegel = ruw.length / ring.length;
    eis('KL7b klein en Latin-1: gemiddeld < 110 tekens per regel, geen teken boven U+00FF (een volle ring, gemeten)',
        perRegel < 110 && !/[^\u0000-ÿ]/.test(ruw), '< 110, Latin-1',
        perRegel.toFixed(1) + ' tekens per regel, ' + (ruw.length / 1024).toFixed(1) + ' K voor 150 regels');
    opzet(); const bewSchrijf = opslagSchrijf;
    opslagSchrijf = (k, v) => (k === KOERSLOG_SLEUTEL ? false : bewSchrijf(k, v));
    tik(0, 0, 5, 0); tik(0, stap, 5, 0);
    opslagSchrijf = bewSchrijf;
    eis('KL7c een vol quotum staakt alleen dit log (meetRingGestopt), en wist zijn eigen sleutel',
        meetRingGestopt.has(KOERSLOG_SLEUTEL) && localStorage.getItem(KOERSLOG_SLEUTEL) === null, 'gestopt, sleutel weg',
        meetRingGestopt.has(KOERSLOG_SLEUTEL) + ' / ' + localStorage.getItem(KOERSLOG_SLEUTEL));
    meetRingGestopt.delete(KOERSLOG_SLEUTEL);

    // ═══ KL8 — de export ═══════════════════════════════════════
    localStorage.setItem(KOERSLOG_SLEUTEL, JSON.stringify([{ t: 1, proef: 'koers' }]));
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
    const r8 = meet && meet.koers && meet.koers[KOERSLOG_SLEUTEL];
    eis('KL8 de meetdata-export heeft een bak koers met sl_koerslog erin',
        Array.isArray(r8) && r8[0] && r8[0].proef === 'koers', 'koers / sl_koerslog', meet ? Object.keys(meet.koers || {}).join(',') || 'leeg' : 'geen export');

    // ═══ KL10 — de meting beslist niets ════════════════════════
    const code = zc(koersLogTik);
    eis('KL10a de meting wijst niets toe aan de keuze-toestand of aan de koers van de app',
        !/\b(dichtstbijOSM|vorigOsmId|handmatigLockActief|handmatigGeselecteerdNodeId|handmatigGeselecteerdTimestamp|stilstandAutoLock|stilstandSinds|laatsteNodeCorrectieTijd|laatsteNodeWisselTijd|bboxOverride|stickyDetectie|fase|puurDichtsteNodeCache|osmCache|huidigeRichting|huidigePos|snelheidKmh|tegenKoersTik|headingBuffer)\s*=[^=]/.test(code)
          && !/headingBuffer\s*\.\s*(push|shift|pop|splice|unshift)|headingBuffer\.length\s*=/.test(code),
        'geen toewijzing', 'ok');
    const roept = (code.match(/\b[a-zA-Z_$][\w$]*\s*\(/g) || []).map(x => x.replace(/\s*\($/, ''))
      .filter(x => !['if', 'for', 'function', 'catch', 'return'].includes(x));
    const mag = ['koersLogTik', 'afstand', 'peilingNaar', 'push', 'shift', 'now', 'heel', 'graad', 'isFinite', 'round', 'abs', 'keys', 'getSmoothedHeading', 'meetRingSchrijf'];
    const vreemd = [...new Set(roept)].filter(x => !mag.includes(x));
    eis('KL10b de meting roept alleen rekenfuncties, getSmoothedHeading en meetRingSchrijf aan', vreemd.length === 0, 'alleen die', vreemd.join(', ') || 'alleen die');
  } finally {
    Date.now = bewNu;
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    headingBuffer.length = 0; for (const h of bewHeading) headingBuffer.push(h);
    meetRingGestopt.delete(KOERSLOG_SLEUTEL);
    herstel();
  }

  // ═══ KL9 — met de echte onGPS ═══════════════════════════════
  const bron = new URL('test_koerslog.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?koers=' + Math.random();
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
      return await w.koersRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], wissel: [], regellog: [], tik: [], opslag: [], koers: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  // Een weg naar het noorden. A recht vooruit, M een tweede mast van hetzelfde kruispunt, Z opzij, B verder, H achter.
  const nodes = [{ id: 9600001, x: 0, y: 60 }, { id: 9600002, x: -9, y: 72 }, { id: 9600003, x: 26, y: 40 },
                 { id: 9600004, x: 0, y: 210 }, { id: 9600005, x: 0, y: -45 }];
  const ruis9 = [0, 14, -18, 20, -9, 17, -20, 6, -12, 19, -4, 11];
  const punten = (stop) => {
    const p = []; let y = -160, i = 0, gestopt = !stop;
    while (y < -70) { p.push({ x: 0, y, kmh: 30, koers: 1 }); y += 30 / 3.6; }
    while (y < 150) {
      const kmh = 3 + (i % 7) + (i % 3) * 0.5, n = ruis9[i % ruis9.length];
      p.push({ x: 0.4 * Math.sin(i / 3), y, kmh, koers: (361 + n) % 360 });
      if (!gestopt && y > 50) { for (let j = 0; j < 7; j++) p.push({ x: 0, y, kmh: 0 }); gestopt = true; }   // 7 s stil, vlak voor A
      y += kmh / 3.6; i++;
    }
    while (y < 260) { p.push({ x: 0, y, kmh: 30, koers: 1 }); y += 30 / 3.6; }
    return p;
  };
  const ritten = [
    ['kruipen', { nodes, start: 9600001, punten: punten(false) }],
    ['kruipen met tik', { nodes, start: 9600001, tik: true, punten: punten(false) }],
    ['kruipen met stop', { nodes, start: 9600001, punten: punten(true) }],
  ];
  const rij = (r) => JSON.stringify(r.rij.map(x => [x.y, x.app, x.slot, x.auto, x.regel]));
  const logs = (r) => JSON.stringify([r.wissel.map(x => [x.t, x.van, x.naar, x.r, x.kmh, x.pl]), r.tik.map(x => [x.s, x.reden || x.tak || '']),
    r.regellog, r.opslag.map(x => [x.reden, x.node])]);
  const uit9 = [];
  let allesGelijk = true, metSchreef = true, zonderLeeg = true, wissels = 0, fouten = [];
  for (const [naam, opt] of ritten) {
    const met = await rit(opt), zonder = await rit({ ...opt, zonderMeting: true });
    if (met.fout || zonder.fout) { fouten.push(naam + ': ' + (met.fout || zonder.fout)); allesGelijk = false; continue; }
    const gelijk = rij(met) === rij(zonder) && logs(met) === logs(zonder);
    allesGelijk = allesGelijk && gelijk && met.rij.length > 40;
    metSchreef = metSchreef && met.koers.length > 20;
    zonderLeeg = zonderLeeg && zonder.koers.length === 0;
    wissels += met.wissel.length;
    uit9.push(naam + ': ' + met.rij.length + ' tikken, ' + met.wissel.length + ' wissels, ' + met.koers.length + ' koersregels, ' + (gelijk ? 'gelijk' : 'ANDERS'));
  }
  eis('KL9a NIETS VERANDERT: drie ritten (kruipen met koersruis tot 20 graden, met een tik, met een stop) geven met en zonder de meting in elke GPS-tik dezelfde keuze, hetzelfde slot, dezelfde schaduwregel en dezelfde wissel-, tik-, regel- en opslaglog',
      allesGelijk && fouten.length === 0, 'gelijk', fouten.join(' | ') || uit9.join('; '));
  eis('KL9b de meting schreef echt (meer dan 20 regels per rit), en zonder haar bleef sl_koerslog leeg', metSchreef && zonderLeeg && fouten.length === 0,
      'geschreven / leeg', fouten.length ? 'fout' : uit9.join('; '));
  eis('KL9c de ritten raken de keuze: er is minstens één wissel van het getoonde licht (anders bewijst KL9a weinig)', wissels > 0, '> 0', String(wissels));

  // ═══ KL11 — regressie ═══════════════════════════════════════
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.15(?!\d)/.test(l)).length;
  const zonderV113718 = (s) => String(s).replace('const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud', 'const d = await r.json();').split(NL).filter(l => !/V11\.37\.18(?!\d)/.test(l)).join(NL);   // V11.37.18: de bewaarde kaart, C5 en C7 (test_kaartbewaar); hier terug
  const zonderV113717 = (s) => zonderV113718(s).split(NL).filter(l => !/V11\.37\.17(?!\d)/.test(l)).join(NL);   // V11.37.17: de startlog (test_startlog); hier terug
  const zonderV113715 = (s) => zonderV113717(s).split(NL).filter(l => !/V11\.37\.15(?!\d)/.test(l)).join(NL);
  const V113713 = { onGPS: ['ef388897', 15408, 1], exporteerMeetdata: ['db5a2894', 9165, 2] };
  const telAf = Object.entries(V113713).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('KL11a twee functies krijgen regels met merkteken V11.37.15: één in onGPS (de aanroep), twee in exporteerMeetdata (de bak)',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V113713).filter(([n, [h, l]]) => { const s = zonderV113715(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('KL11b zonder die regels (alle drie nieuw) byte-gelijk aan V11.37.13', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  // In de bron van de app: buiten het commentaar staat V11.37.15 alleen in de versie, de bak (twee regels) en de aanroep.
  let code11 = [];
  try {
    const html = await (await fetch(new URL('index.html', location.href).href + '?t=' + Date.now())).text();
    code11 = html.split(NL).filter(l => /V11\.37\.15(?!\d)/.test(l) && !/^\s*\/\//.test(l)).map(l => l.trim());
  } catch (e) { code11 = ['fout: ' + e]; }
  const verwacht11 = [/^const APP_VERSIE = 'V11\.37\.15(?!\d) — /, /^uit\.koers = \{\};\s+\/\/ V11\.37\.15(?!\d): /, /^else if \(key === KOERSLOG_SLEUTEL\)\s+doel = uit\.koers;\s+\/\/ V11\.37\.15(?!\d): /,
    /^koersLogTik\(pos\);\s+\/\/ V11\.37\.15(?!\d): meetregel, beslist niets$/];
  // V11.37.17: de versieregel draagt sinds V11.37.17 een later nummer (test_startlog); de drie regels van de meting blijven
  const versie11 = code11.filter(l => /^const APP_VERSIE/.test(l));
  const past11 = code11.length - versie11.length === 3 && versie11.length <= 1 && versie11.every(l => verwacht11[0].test(l))
    && verwacht11.slice(1).every(re => code11.filter(l => re.test(l)).length === 1);
  eis('KL11c in de bron staat V11.37.15 buiten het commentaar alleen in de bak (twee regels), de aanroep en (tot een latere versie) de versieregel; geen andere functie kreeg er een',
      past11, '3 regels (+ de versie)', code11.length + ': ' + code11.map(l => l.slice(0, 40)).join(' | '));
  const og = zc(onGPS), iK = og.indexOf('koersLogTik(pos)');
  eis('KL11d in onGPS staat de meting na de koers en de snelheid, vóór de beslisketen (wisselVoor, het slot, updateDichtbij)',
      iK > og.indexOf('voegHeadingToe(pos.coords.heading)') && iK > og.indexOf('snelheidKmh = snelheidMs * 3.6') && og.indexOf('snelheidKmh = snelheidMs * 3.6') > 0
        && iK < og.indexOf('wisselVoor(lat, lon)') && iK < og.indexOf('checkHandLockVerval(lat, lon)') && iK < og.indexOf('updateDichtbij(lat, lon)'),
      'op volgorde', 'positie ' + iK);

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testKoerslog = testKoerslog; window.koersRitBinnen = koersRitBinnen; }
