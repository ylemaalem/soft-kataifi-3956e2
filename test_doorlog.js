// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_doorlog.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.30: de doorrijlog (sl_doorlog), alleen meten.
//
//  Het vaste stratenplan (testcoördinaten rond 52.0000/5.0000, de auto rijdt
//  naar het noorden): licht A op 150 m met een tweede mast A2 van hetzelfde
//  kruispunt 15 m verder; licht B op 450 m; licht C op 750 m; een licht H
//  50 m ACHTER het startpunt; een fietslicht F naast A.
//
//  DL1  de constanten
//  DL2  een rit: A op groen doorgereden (kleur gezien), A2 niet gezien, bij B
//       gestopt op rood en binnen 10 s na groen weggereden, C doorgereden zonder
//       kleur; H (achter) en F (fiets) staan er niet in; v/va/vt wijzen naar
//       het vorige KRUISPUNT (A2 telt niet als vorig kruispunt voor B)
//  DL3  te laat weggereden (> 10 s na groen): wg 0
//  DL4  schrijven: hoogstens eens per minuut tijdens de rit, de rest bij
//       verbergen; ring van 500; grootte van 500 regels in KB
//  DL5  volle opslag: alleen de doorrijlog stopt en wordt gewist
//  DL6  de log beslist niets: zonder doorTik dezelfde rit, hetzelfde getoonde
//       licht, dezelfde fase
//
//  DRAAIEN: zoals de andere toetsen (testserver.py, dan in de console laden en
//  testDoorlog() aanroepen).
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
async function doorRitBinnen(opt) {
  const LAT0 = 52.0000, LON0 = 5.0000;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.zonderDoor) window.doorTik = () => {};
  try { localStorage.removeItem(DOOR_SLEUTEL); } catch (e) {}
  doorStaat = { open: new Map(), buf: [], vorige: null, laatsteSchrijf: klok, tVorig: 0, n: 0, geschreven: 0 };
  meetRingGestopt.delete(DOOR_SLEUTEL);
  const schrijf = [];
  if (opt.telSchrijf) {
    const echt = window.opslagSchrijf;
    window.opslagSchrijf = function (k, v) { if (k === DOOR_SLEUTEL) { schrijf.push(klok); if (opt.vol) throw new Error('QuotaExceededError'); } return echt.apply(this, arguments); };
  }
  osmCache = opt.nodes.map(n => ({ id: n.id, naam: String(n.id), ...LL(n.x, n.y) }));
  fietsLichten = new Set((opt.fiets || []).map(String));
  cacheGeladen = true; cacheBezig = false; cacheCentrum = LL(0, 0);
  eersteGPSVerwerkt = true;
  clusterNodes = new Set();
  dichtstbijOSM = null; vorigOsmId = null;
  handmatigLockActief = false; stilstandAutoLock = false;
  headingBuffer.length = 0;
  fase = null; faseNodeId = null; faseStart = null;
  const rij = [];
  let vorige = null;
  for (const p of opt.punten) {
    klok += 1000;
    if (p.fase !== undefined) { fase = p.fase ? p.fase.f : null; faseNodeId = p.fase ? p.fase.n : null; faseStart = performance.now(); }
    const v = p.kmh / 3.6;
    let h = (vorige && (p.x !== vorige.x || p.y !== vorige.y)) ? (Math.atan2(p.x - vorige.x, p.y - vorige.y) * 180 / Math.PI + 360) % 360 : 1;
    if (Math.round(h) === 0) h = 1;
    const q = LL(p.x, p.y);
    let fout = null;
    try { await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: v > 0 ? h : NaN }, timestamp: klok }); }
    catch (e) { fout = String(e && e.message || e).slice(0, 120); }
    rij.push({ y: Math.round(p.y), app: dichtstbijOSM ? dichtstbijOSM.id : null, fout });
    vorige = p;
  }
  const voorBerg = (() => { try { return JSON.parse(localStorage.getItem(DOOR_SLEUTEL)) || []; } catch (e) { return []; } })().length;
  if (!opt.geenBerg) doorBergOp();
  let log = null; try { log = JSON.parse(localStorage.getItem(DOOR_SLEUTEL)); } catch (e) {}
  return { rij, log, voorBerg, schrijf, gestopt: meetRingGestopt.has(DOOR_SLEUTEL), duurS: opt.punten.length, n: doorStaat.n };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testDoorlog() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };

  // ═══ DL1 ═══
  eis('DL1 de constanten: 500 regels, open 80 m, passage 40 m, weg +20 m, 60 graden, stil 60 m, groenbegin 10 s, kruispunt 60 m, schrijven 60 s',
      DOOR_MAX === 500 && DOOR_OPEN_M === 80 && DOOR_NADER_M === 40 && DOOR_WEG_M === 20 && DOOR_HOEK === 60 && DOOR_STIL_M === 60
        && DOOR_WG_MS === 10000 && DOOR_KRUIS_M === 60 && DOOR_SCHRIJF_MS === 60000 && DOOR_SLEUTEL === 'sl_doorlog',
      '500/80/40/20/60/60/10000/60/60000', [DOOR_MAX, DOOR_OPEN_M, DOOR_NADER_M, DOOR_WEG_M, DOOR_HOEK, DOOR_STIL_M, DOOR_WG_MS, DOOR_KRUIS_M, DOOR_SCHRIJF_MS].join('/'));

  const bron = new URL('test_doorlog.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?door=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.onGPS !== 'function'; poging++) {
        if (poging > 3) throw new Error('testopstelling: de app laadde niet in de iframe (3 pogingen)');
        await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; f.src = pagina + '?opnieuw=' + Math.random(); });
      }
      const w = f.contentWindow;
      for (let poging = 1; ; poging++) {
        try {
          await new Promise((ok, nee) => { const sc = w.document.createElement('script'); sc.src = bron + '?t=' + Date.now() + '-' + poging; sc.onload = ok; sc.onerror = () => { sc.remove(); nee(new Error('laden')); }; w.document.head.appendChild(sc); });
          break;
        } catch (e) { if (poging >= 3) throw new Error('testopstelling: het testscript laadde niet in de iframe (3 pogingen)'); await new Promise((r) => setTimeout(r, 250 * poging)); }
      }
      return await w.doorRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], log: null, schrijf: [] };
    } finally { f.remove(); herstel(); }
  };
  const A = 9800001, A2 = 9800002, B = 9800003, C = 9800004, H = 9800005, F = 9800006;
  const nodes = [{ id: A, x: 0, y: 150 }, { id: A2, x: 6, y: 165 }, { id: B, x: 0, y: 450 }, { id: C, x: 0, y: 750 }, { id: H, x: 0, y: -50 }, { id: F, x: 4, y: 150 }];
  // de rit: 0 -> 430 m met 54 km/u (15 m/s), A groen gezien vanaf 100 m; stil bij B (430 m) 20 s op rood, dan groen, na wegrijden 3 s; door C
  const maakRit = (wachtNaGroen) => {
    const p = [];
    for (let y = 0; y <= 420; y += 15) p.push({ x: 0, y, kmh: 54, fase: y === 60 ? { f: 'groen', n: A } : (y === 210 ? null : undefined) });
    p.push({ x: 0, y: 428, kmh: 5, fase: { f: 'rood', n: B } });
    for (let i = 0; i < 20; i++) p.push({ x: 0, y: 430, kmh: 0 });
    p.push({ x: 0, y: 430, kmh: 0, fase: { f: 'groen', n: B } });
    for (let i = 0; i < wachtNaGroen; i++) p.push({ x: 0, y: 430, kmh: 0 });
    for (let y = 436; y <= 900; y += 15) p.push({ x: 0, y, kmh: 54, fase: y === 481 ? null : undefined });
    return p;
  };
  const r2 = await rit({ nodes, fiets: [F], punten: maakRit(2), telSchrijf: true });
  const L2 = r2.log || [];
  const per = (id) => L2.find(x => x.n === id) || null;
  const fout2 = r2.fout || (r2.rij.find(x => x.fout) || {}).fout;
  eis('DL2a de rit draait zonder fout en de log heeft precies A, A2, B en C (H ligt achter, F is een fietslicht)',
      !fout2 && L2.map(x => x.n).join(',') === [A, A2, B, C].join(','), [A, A2, B, C].join(','), fout2 || L2.map(x => x.n).join(','));
  const a = per(A) || {}, a2 = per(A2) || {}, b = per(B) || {}, c = per(C) || {};
  eis('DL2b A: groen gezien (c g), doorgereden (geen s, geen wg), kleinste afstand < 10 m', a.c === 'g' && a.s === undefined && a.wg === undefined && a.ma <= 10,
      'g, geen s/wg, ma<=10', JSON.stringify(a));
  eis('DL2c A2 (tweede mast, niet gevolgd): c "-" (niet gezien)', a2.c === '-', '-', JSON.stringify(a2));
  eis('DL2d B: rood bij aankomst, ~21 s stil, weggereden binnen 10 s na groen (wg 1)', b.c === 'r' && b.s >= 19 && b.s <= 24 && b.wg === 1,
      'r, s 19-24, wg 1', JSON.stringify(b));
  eis('DL2e B: het vorige kruispunt is A (niet A2, dat 15 m verder bij hetzelfde kruispunt staat), afstand ~300 m',
      b.v === A && b.va >= 290 && b.va <= 310 && b.vt > 15, 'v A, va ~300, vt > 15', JSON.stringify({ v: b.v, va: b.va, vt: b.vt }));
  eis('DL2f C: niet gezien (c "-"), vorige B op ~300 m', c.c === '-' && c.v === B && c.va >= 290 && c.va <= 310 && c.wg === undefined,
      '-, v B', JSON.stringify(c));
  eis('DL2g elke regel heeft t, n, c, ma en dd; geen coördinaten in de regels', L2.every(x => x.t > 0 && x.n > 0 && typeof x.c === 'string' && x.ma >= 0 && typeof x.dd === 'string' && x.lat === undefined && x.lon === undefined),
      'ja', JSON.stringify(L2[0]));

  // ═══ DL3 ═══
  const r3 = await rit({ nodes, fiets: [F], punten: maakRit(15) });
  const b3 = (r3.log || []).find(x => x.n === B) || {};
  eis('DL3 15 s na groen pas weggereden: wg 0', b3.wg === 0 && b3.c === 'r', 'wg 0', JSON.stringify(b3));

  // ═══ DL4 ═══
  const perMin = r2.schrijf.length / (r2.duurS / 60);
  eis('DL4a tijdens de rit hoogstens eens per minuut naar de opslag (plus eenmaal bij verbergen)',
      r2.schrijf.length >= 1 && r2.schrijf.every((t, i) => i === 0 || t - r2.schrijf[i - 1] >= 60000 || i === r2.schrijf.length - 1) && perMin < 2,
      '< 2 per minuut', `${r2.schrijf.length} keer in ${r2.duurS} s (${perMin.toFixed(2)}/min)`);
  // ring en grootte: 520 regels zoals in een echte rit
  const proef = [];
  for (let i = 0; i < 520; i++) proef.push({ t: 1790000000000 + i * 40000, n: 1000000000 + i * 7919, c: ['r', 'g', '-', '-', 'o'][i % 5], ma: 5 + (i % 30), dd: ['ochtend', 'dag', 'avond', 'nacht'][i % 4], ...(i % 3 === 0 ? { s: 25 + (i % 40), wg: i % 2 } : {}), v: 1000000000 + (i - 1) * 7919, va: 150 + (i % 250), vt: 12 + (i % 80) });
  let ring = null;
  try {
    localStorage.setItem(DOOR_SLEUTEL, JSON.stringify(proef.slice(0, 480)));
    doorStaat.buf = proef.slice(480); meetRingGestopt.delete(DOOR_SLEUTEL);
    doorSchrijf();
    ring = JSON.parse(localStorage.getItem(DOOR_SLEUTEL));
  } catch (e) { ring = null; }
  const kb = ring ? new Blob([JSON.stringify(ring)]).size / 1024 : NaN;
  eis('DL4b de ring houdt de nieuwste 500 regels', !!ring && ring.length === 500 && ring[499].t === proef[519].t && ring[0].t === proef[20].t, '500, nieuwste', ring ? ring.length : 'geen');
  eis('DL4c 500 regels zijn kleiner dan 60 KB (gemeten, UTF-8)', kb > 0 && kb < 60, '< 60 KB', kb.toFixed(1) + ' KB');
  herstel();

  // ═══ DL5 ═══
  const r5 = await rit({ nodes, fiets: [F], punten: maakRit(2), telSchrijf: true, vol: true });
  eis('DL5 volle opslag: de doorrijlog stopt en staat niet in de opslag; de rit loopt zonder fout door',
      !r5.fout && !r5.rij.some(x => x.fout) && r5.gestopt === true && r5.log === null, 'gestopt, weg', JSON.stringify({ gestopt: r5.gestopt, log: r5.log, fout: r5.fout }));

  // ═══ DL6 ═══
  const r6 = await rit({ nodes, fiets: [F], punten: maakRit(2), zonderDoor: true });
  const zelfde = r6.rij.length === r2.rij.length && r6.rij.every((x, i) => x.app === r2.rij[i].app);
  eis('DL6 zonder doorTik: hetzelfde getoonde licht bij elke GPS-tik (de log beslist niets)', !r6.fout && zelfde, 'gelijk',
      zelfde ? 'gelijk' : JSON.stringify(r6.rij.map(x => x.app)).slice(0, 200));

  herstel();
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}
