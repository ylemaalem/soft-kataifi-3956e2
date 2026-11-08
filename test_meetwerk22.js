// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetwerk22.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.22: alleen meten, geen gedragsverandering.
//
//  MV1  de wachttijd-rekening (m5Rest): mediaan, banden, rest na 10/20/30 s en
//       "nog ~Y s" bij de p90, nagerekend op een kleine emmer
//  MV2  de schaduw route 2 (sl_m5log): alleen bij een rode fase zonder gezien
//       begin; één regel per rode fase, met de echte duur bij groen; een vorige
//       die nooit afsloot krijgt e 'open', groen op een ander licht e 'ander';
//       een bron met een pijl wordt Latin-1 opgeslagen (MV2f)
//  MV3  startCd: met en zonder de schaduw dezelfde countdown op het scherm; de
//       schaduw draagt het getoonde getal; rood naar groen sluit hem af
//  MV4  einde gemist: een rode fase zonder groen krijgt een regel x:'eg' in de
//       passagelog (reden, minstens-duur, begin gezien); bij uitval blijft de
//       schaduw open en wordt de regel h:1 als de fase terugkomt; de leerdata
//       blijft byte-gelijk
//  MV5  de passagelog: kleur bij het eerste zicht en op 50 m, koers, stilstand
//       en wachttijd, het licht ervoor; nooit genaderd = geen regel; een korte
//       wissel naar een buur splitst de passage niet
//  MV6  NIETS VERANDERT: drie ritten met de echte onGPS, met en zonder de
//       passagelog, geven in elke GPS-tik dezelfde keuze en dezelfde logs; de rit
//       schrijft de verwachte passages en de stoplog draagt de twijfelvlag
//  MV7  de twijfelvlag (stopTwijfel): b, w, g en geen
//  MV8  de detlog: cxv, ko en kh
//  MV9  de export heeft de bakken passage en m5
//  MV10 de regels zijn klein; een vol quotum staakt alleen dat log
//  MV11 regressie: zonder de regels met merkteken V11.37.22 zijn de acht
//       geraakte functies byte-gelijk aan V11.37.21 (6b4bcd9), en de leer- en
//       keuzefuncties zijn niet aangeraakt
//  MV12 een fout IN de nieuwe code (een hulpfunctie gooit, of het lezen en
//       schrijven van de nieuwe logs gooit) raakt de countdown, de fase, de
//       leerdata, de metingen en de keuze per GPS-tik niet; de detlog loopt door
//
//  Alle plekken en nummers zijn bedacht: een rechte weg naar het noorden vanaf
//  een basispunt (52.0000, 5.0000), lichten met nummers 96022xx (MV12: verse
//  nummers vanaf 900000000, per run anders, zodat er geen restdata meetelt).
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_meetwerk22.js';
//      document.head.appendChild(s);
//      s.onload = () => testMeetwerk22().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: één scenario met de echte app-functies ──
async function meetwerk22Binnen(soort, opt) {
  opt = opt || {};
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  window.toonToast = () => {};
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  for (const k of [M5_SLEUTEL, PASSAGE_SLEUTEL]) { localStorage.setItem(k, '[]'); meetRingGestopt.delete(k); }
  try { opslagHersynchroniseer([M5_SLEUTEL, PASSAGE_SLEUTEL]); } catch (e) {}
  m5Open = null; passageStaat = { open: new Map(), vorige: null, tVorig: 0 };
  const N = 9602201;
  const emmer = (n, duren, dd) => opslagSchrijf('sl_v4_' + n + '_' + (dd || huidigDDActief()), duren.map((d, i) => ({ duur: d, tijd: Date.now() - 1000 * (i + 1), gewicht: 1 })));
  const kopie = (x) => JSON.parse(JSON.stringify(x));

  if (soort === 'm5') {
    emmer(N, [20, 40, 40, 60], 'dag');
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
    fase = 'rood'; zagRoodOvergang = false; faseStart = performance.now() - 1000; cdWallStart = 111; activeCdDoel = 40;
    m5Start(N, 'dag', null, null, 'V4');
    const open1 = m5Open ? kopie(m5Open.rec) : null, ref1 = m5Open && m5Open.rec;
    m5Start(N, 'dag', null, null, 'V4');
    const zelfde = !!m5Open && m5Open.rec === ref1;
    m5Sluit(33, 'groen');
    const naGroen = lees(M5_SLEUTEL);
    zagRoodOvergang = true; m5Start(N, 'dag', null, null, 'V4');
    const bijZag = m5Open;
    zagRoodOvergang = false; fase = 'groen'; m5Start(N, 'dag', null, null, 'V4');
    const bijGroen = m5Open;
    fase = 'rood'; cdWallStart = 111; m5Start(N, 'dag', null, null, 'V4');
    cdWallStart = 222; m5Start(N, 'dag', null, null, 'V4');
    const naNieuw = lees(M5_SLEUTEL);
    dichtstbijOSM = { id: N + 1, lat: 52, lon: 5, afstand: 30 };
    m5Sluit(30, 'groen');
    const naAnder = lees(M5_SLEUTEL);
    dichtstbijOSM = { id: N + 2, lat: 52, lon: 5, afstand: 30 }; cdWallStart = 333;
    m5Start(N + 2, 'dag', null, null, 'V4');
    m5Sluit(12, 'groen');
    return { open1, zelfde, naGroen, bijZag, bijGroen, naNieuw, naAnder, leeg: lees(M5_SLEUTEL).slice(-1)[0] };
  }

  if (soort === 'startcd') {
    emmer(N, [20, 40, 40, 60]);
    if (opt.zonder) window.m5Start = () => {};
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
    fase = 'rood'; faseStart = performance.now() - 500; zagRoodOvergang = !!opt.zag;
    cdWallStart = null; cdWallNodeId = null; activeCdDoel = 0;
    startCd();
    const scherm = { doel: activeCdDoel, modus: activeCdModus, min: activeCdMin, max: activeCdMax, bron: huidigCdBron,
                     getal: cdPillGetal.textContent, label: cdPillLabel.textContent, actief: cdPill.classList.contains('actief') };
    const m5 = m5Open ? kopie(m5Open.rec) : null;
    let naGroen = null;
    if (opt.groen) {
      faseStart = performance.now() - 25000; faseNodeId = String(N);
      verwerkFase('groen', true, 0.9);
      naGroen = lees(M5_SLEUTEL).slice(-1)[0] || null;
    }
    return { scherm, m5, naGroen };
  }

  if (soort === 'eg') {
    const leer = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^sl_v[45]_/.test(k)) o[k] = localStorage.getItem(k); } return JSON.stringify(o); };
    emmer(N, [20, 40, 40, 60]);
    const leerVoor = leer();
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
    const zetRood = (zag, sec) => { fase = 'rood'; faseStart = performance.now() - sec * 1000; faseNodeId = String(N); zagRoodOvergang = zag; };
    zetRood(true, 12); beeindigFase('wissel');
    const na1 = lees(PASSAGE_SLEUTEL);
    fase = 'groen'; faseStart = performance.now() - 5000; faseNodeId = String(N); beeindigFase('handmatig');
    const na2 = lees(PASSAGE_SLEUTEL);
    zetRood(false, 3); cdWallStart = 444; activeCdDoel = 40; m5Start(N, 'dag', null, null, 'V4');
    zetRood(false, 9); resetNeutraal('dropout');
    const na3 = lees(PASSAGE_SLEUTEL), m5NaUitval = m5Open ? kopie(m5Open.rec) : null, m5LogNaUitval = lees(M5_SLEUTEL).length;
    opslagSchrijf(PASSAGE_SLEUTEL, na3.concat([{ t: Date.now(), x: 'eg', n: N + 7, dd: huidigDDActief(), b: 0, mn: 3, r: 'uitval' }]));   // een ander licht, later
    eindeGemistHersteld(N);
    const na4 = lees(PASSAGE_SLEUTEL);
    zetRood(false, 6); resetNeutraal('dropout');
    const na4a = lees(PASSAGE_SLEUTEL);
    laatsteFase = 'rood'; laatsteFaseStart = performance.now() - 6000; laatsteFaseNodeId = String(N);
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
    verwerkFase('rood', true, 0.9);
    const na4b = lees(PASSAGE_SLEUTEL), fsHersteld = Math.round((performance.now() - faseStart) / 1000);
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
    zetRood(false, 20); beeindigFase('geen');
    const na5 = lees(PASSAGE_SLEUTEL), m5NaWeg = lees(M5_SLEUTEL).slice(-1)[0] || null, m5OpenNaWeg = m5Open;
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
    zetRood(false, 4); resetNeutraal('startscherm');
    const na6 = lees(PASSAGE_SLEUTEL);
    return { na1, na2, na3, na4, na4a, na4b, fsHersteld, na5, na6, m5NaUitval, m5LogNaUitval, m5NaWeg, m5OpenNaWeg, leerGelijk: leer() === leerVoor, dd: huidigDDActief() };
  }

  if (soort === 'passage') {
    const LAT0 = 52.0000, LON0 = 5.0000, mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
    const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
    let klok = 1790000000000;
    Date.now = () => klok;
    window.getSmoothedHeading = () => 0;
    if (opt.vol) { const os = opslagSchrijf; window.opslagSchrijf = (k, v) => (k === PASSAGE_SLEUTEL ? false : os(k, v)); }
    const P = N, Q = N + 1, R = N + 2, S = N + 3, T = N + 4;
    const knoop = { [P]: { id: P, ...LL(0, 0) }, [Q]: { id: Q, ...LL(0, 500) }, [R]: { id: R, ...LL(150, 0) }, [S]: { id: S, ...LL(0, 1000) }, [T]: { id: T, ...LL(60, 1000) } };
    const tik = (y, id, kmh, kleur) => {
      klok += 1000; snelheidKmh = kmh;
      dichtstbijOSM = id ? { ...knoop[id], afstand: 0 } : null;
      if (kleur) { fase = kleur; faseNodeId = String(id); } else { fase = null; faseNodeId = null; }
      const q = LL(0, y); passageTik(q.lat, q.lon);
    };
    for (let y = -120; y <= -20; y += 10) tik(y, P, 36, y >= -80 ? 'groen' : null);
    for (let j = 0; j < 10; j++) tik(-20, P, 0, 'groen');
    for (let j = 0; j < 21; j++) tik(-20, Q, 0, null);
    const naP = lees(PASSAGE_SLEUTEL);
    for (let y = 300; y <= 480; y += 30) tik(y, Q, 36, null);
    for (let j = 0; j < 21; j++) tik(480, null, 36, null);
    const naQ = lees(PASSAGE_SLEUTEL);
    for (let j = 0; j < 3; j++) tik(480, R, 36, null);
    for (let j = 0; j < 21; j++) tik(480, null, 36, null);
    const naR = lees(PASSAGE_SLEUTEL);
    for (let y = 940; y <= 980; y += 10) tik(y, S, 20, null);
    for (let j = 0; j < 3; j++) tik(980, T, 20, null);
    tik(990, S, 20, null);
    for (let j = 0; j < 21; j++) tik(990, null, 20, null);
    const naS = lees(PASSAGE_SLEUTEL);
    return { naP, naQ, naR, naS, gestopt: meetRingGestopt.has(PASSAGE_SLEUTEL), sleutelEr: localStorage.getItem(PASSAGE_SLEUTEL) !== null };
  }
  if (soort === 'pijl') {
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
    fase = 'rood'; zagRoodOvergang = false; faseStart = performance.now() - 1000; cdWallStart = 555; activeCdDoel = 30;
    m5Start(N, 'dag', null, null, 'V5 ' + String.fromCharCode(0x2191));
    m5Sluit(20, 'groen');
    return { rec: lees(M5_SLEUTEL).slice(-1)[0] || null, ruw: localStorage.getItem(M5_SLEUTEL) || '' };
  }

  if (soort === 'gif') return await meetwerk22Gif(opt);
  return null;
}

// ── MV12: draait IN een iframe. Dezelfde scenario's met de nieuwe haken uit ('zonder'),
// met een fout binnen de nieuwe code ('gifA': m5Rest, passageKleur en stopTwijfel gooien)
// of met een fout bij het lezen en schrijven van de nieuwe logs ('gifB'). ──
async function meetwerk22Gif(opt) {
  const stand = opt.stand, N = opt.N;
  window.__gifTel = 0;
  const gooi = (wat) => () => { window.__gifTel++; throw new Error('gif ' + wat); };
  if (stand === 'zonder') {
    window.m5Start = () => {}; window.m5Sluit = () => {}; window.eindeGemistLog = () => {};
    window.eindeGemistHersteld = () => {}; window.passageTik = () => {}; window.stopTwijfel = () => null;
  } else if (stand === 'gifA') {
    window.m5Rest = gooi('m5Rest'); window.passageKleur = gooi('passageKleur'); window.stopTwijfel = gooi('stopTwijfel');
  } else if (stand === 'gifB') {
    const nieuw = new Set([M5_SLEUTEL, PASSAGE_SLEUTEL]);
    const mrs = meetRingSchrijf, ol = opslagLees, os = opslagSchrijf;
    window.meetRingSchrijf = (k, m, r) => { if (nieuw.has(k)) { window.__gifTel++; throw new Error('gif ' + k); } return mrs(k, m, r); };
    window.opslagLees = (k, d) => { if (nieuw.has(k)) { window.__gifTel++; throw new Error('gif ' + k); } return ol(k, d); };
    window.opslagSchrijf = (k, v) => { if (nieuw.has(k)) { window.__gifTel++; throw new Error('gif ' + k); } return os(k, v); };
  }
  if (opt.scen === 'rit') {
    const r = await meetwerkRitBinnen(opt.rit);
    return { gifTel: window.__gifTel,
      kern: { keuze: r.rij.map(x => [x.y, x.app, x.slot, x.auto, x.regel]),
              logs: [(r.wissel || []).map(x => [x.t, x.van, x.naar, x.r, x.kmh, x.pl]), (r.tik || []).map(x => [x.s, x.reden || x.tak || '']), r.regellog, (r.opslag || []).map(x => [x.reden, x.node])],
              stop: (r.stop || []).map(x => { const y = Object.assign({}, x); delete y.tw; return y; }) } };
  }
  let klok = 1790000000000, pn = 5000000;
  Date.now = () => klok;
  performance.now = () => pn;
  if (opt.scen === 'det') {
    detLogStop = false; detLogArr = null; localStorage.setItem('sl_detlog', '[]');
    detLogAfst = 50; snelheidKmh = 30; detLogBest = { cx: 320 };
    const voor = laatsteDetectiesStelsel;
    laatsteDetectiesStelsel = { get s() { window.__gifTel++; throw new Error('gif stelsel'); }, px: 0, py: 0, x: 0, y: 0 };
    let ontsnapt = null;
    try { detLogSchrijf(); } catch (e) { ontsnapt = String(e && e.message || e); }
    const naGif = JSON.parse(localStorage.getItem('sl_detlog') || '[]').length;
    laatsteDetectiesStelsel = voor;
    try { detLogSchrijf(); } catch (e) { ontsnapt = ontsnapt || String(e && e.message || e); }
    return { ontsnapt, naGif, naGewoon: JSON.parse(localStorage.getItem('sl_detlog') || '[]').length, gestopt: detLogStop, gifTel: window.__gifTel };
  }
  const dd = huidigDDActief();
  opslagSchrijf('sl_v4_' + N + '_' + dd, [20, 40, 40, 60].map((d, i) => ({ duur: d, tijd: klok - 1000 * (i + 1), gewicht: 1 })));
  const staat = () => ({ fase, fs: faseStart === null ? null : Math.round(pn - faseStart), node: faseNodeId, bev: faseBevestigd, zag: zagRoodOvergang,
    lf: laatsteFase, lfs: laatsteFaseStart === null ? null : Math.round(pn - laatsteFaseStart), lfn: laatsteFaseNodeId,
    doel: activeCdDoel, modus: activeCdModus, min: activeCdMin, max: activeCdMax, bron: huidigCdBron, cdWall: cdWallStart, cdNode: cdWallNodeId,
    getal: cdPillGetal.textContent, label: cdPillLabel.textContent, actief: cdPill.classList.contains('actief') });
  const stappen = [];
  const stap = (naam, fn) => { let fout = null; try { fn(); } catch (e) { fout = String(e && e.message || e); } stappen.push({ naam, fout, staat: staat() }); };
  const licht = () => { dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 }; };
  const rood = (zag, sec) => { licht(); fase = 'rood'; faseStart = pn - sec * 1000; faseNodeId = String(N); zagRoodOvergang = zag; };
  if (opt.scen === 'cd') {
    rood(false, 0.5); cdWallStart = null; cdWallNodeId = null; activeCdDoel = 0;
    stap('startCd', () => startCd());
    klok += 25000; pn += 25000;
    stap('rood naar groen (meting)', () => verwerkFase('groen', true, 0.9));
    klok += 2000; pn += 2000;
    stap('groen', () => verwerkFase('groen', true, 0.9));
  }
  if (opt.scen === 'eg') {
    rood(true, 12); stap('beeindigFase wissel', () => beeindigFase('wissel'));
    rood(false, 3); cdWallStart = 444; activeCdDoel = 40;
    stap('startCd zonder gezien begin', () => startCd());
    klok += 6000; pn += 6000;
    stap('resetNeutraal uitval', () => resetNeutraal('dropout'));
    laatsteFase = 'rood'; laatsteFaseStart = pn - 6000; laatsteFaseNodeId = String(N); licht();
    stap('verwerkFase rood (terugkeer)', () => verwerkFase('rood', true, 0.9));
    klok += 20000; pn += 20000;
    stap('rood naar groen (meting)', () => verwerkFase('groen', true, 0.9));
    rood(false, 20); stap('beeindigFase geen', () => beeindigFase('geen'));
    rood(false, 4); stap('resetNeutraal startscherm', () => resetNeutraal('startscherm'));
  }
  const leer = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^sl_(v4|v5|v10|passief|klok|s2|bevestig|richting|enkelricht|neutraal)_/.test(k) && k.includes(String(N))) leer[k] = localStorage.getItem(k); }
  let opslag = [];
  try { opslag = (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(x => String(x.node) === String(N)).map(x => [x.reden, x.node, x.dur]); } catch (e) { opslag = 'onleesbaar'; }
  return { gifTel: window.__gifTel, kern: { stappen, leer, opslag } };
}

async function testMeetwerk22() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const NL = String.fromCharCode(10);
  const kort = (x) => JSON.stringify(x).slice(0, 260);
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };

  // ── een scenario in een eigen iframe (de app daar is wegwerp) ──
  const pagina = location.pathname;
  const bron22 = new URL('test_meetwerk22.js', location.href).href, bron21 = new URL('test_meetwerk21.js', location.href).href;
  const inFrame = async (doe) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?meetwerk22=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.onGPS !== 'function'; poging++) {
        if (poging > 3) throw new Error('testopstelling: de app laadde niet in de iframe (3 pogingen)');
        await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; f.src = pagina + '?opnieuw=' + Math.random(); });
      }
      const w = f.contentWindow;
      let bron = bron21;   // eerst de rit-helper van test_meetwerk21, dan dit script
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
      bron = bron22;
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
      return await doe(w);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300) };
    } finally {
      f.remove();
      herstel();
    }
  };

  // ═══ MV1 — de wachttijd-rekening ═════════════════════════════
  try {
    const p = [20, 40, 40, 60].map(d => ({ d, w: 1 }));
    const r = (x, q) => m5Rest(p, x, q);
    const een = [{ d: 60, w: 1 }];
    eis('MV1a emmer 20/40/40/60: mediane wachttijd 20 s, p25-p75 10-33, p10-p90 4-44 (G(x) = som max(0, d-x) / som d)',
        r(0, 0.5) === 20 && r(0, 0.25) === 10 && r(0, 0.75) === 33 && r(0, 0.10) === 4 && r(0, 0.90) === 44,
        '20 / 10-33 / 4-44', [r(0, 0.5), r(0, 0.25), r(0, 0.75), r(0, 0.10), r(0, 0.90)].join(' '));
    eis('MV1b na 10, 20 en 30 s wachten nog 17, 13 en 8 s; bij de p90 (44 s) zou "nog ~Y s" 8 s zeggen',
        r(10, 0.5) === 17 && r(20, 0.5) === 13 && r(30, 0.5) === 8 && r(44, 0.5) === 8, '17 / 13 / 8 / 8', [r(10, 0.5), r(20, 0.5), r(30, 0.5), r(44, 0.5)].join(' '));
    eis('MV1c één meting van 60 s: mediane wachttijd 30 s (de helft), en wie al 60 s wacht krijgt geen getal (null)',
        m5Rest(een, 0, 0.5) === 30 && m5Rest(een, 60, 0.5) === null && m5Rest([], 0, 0.5) === null, '30 / null / null',
        [m5Rest(een, 0, 0.5), m5Rest(een, 60, 0.5), m5Rest([], 0, 0.5)].join(' '));
  } catch (e) { eis('MV1 crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300)); }

  // ═══ MV2 — de schaduw route 2 ════════════════════════════════
  const m5 = await inFrame((w) => w.meetwerk22Binnen('m5'));
  if (m5.fout) eis('MV2 testopstelling', false, 'geen fout', m5.fout);
  else {
    const o = m5.open1 || {}, g = (m5.naGroen || []).slice(-1)[0] || {};
    eis('MV2a bij een rode fase zonder gezien begin een open schaduw met bron, aantal, het getoonde getal en de rekening van MV1 (q 20, b50 10-33, b80 4-44, c10/c20/c30 17/13/8, ov [44, 8])',
        o.n === 9602201 && o.b === 'V4' && o.nm === 4 && o.g === 40 && o.q === 20 && kort(o.b50) === '[10,33]' && kort(o.b80) === '[4,44]'
          && o.c10 === 17 && o.c20 === 13 && o.c30 === 8 && kort(o.ov) === '[44,8]' && o.vs === 1 && o.dd === 'dag',
        'zie verwacht', kort(o));
    eis('MV2b dezelfde rode fase (zelfde start) twee keer: één open schaduw; bij groen één regel met de echte duur (w 33, e groen)',
        m5.zelfde && m5.naGroen.length === 1 && g.w === 33 && g.e === 'groen' && g.q === 20, '1 regel, w 33', kort(m5.naGroen));
    eis('MV2c met gezien begin (route 1) of buiten rood: geen schaduw', m5.bijZag === null && m5.bijGroen === null, 'null / null', kort([m5.bijZag, m5.bijGroen]));
    const nieuw = m5.naNieuw || [], ander = (m5.naAnder || []).slice(-1)[0] || {};
    eis('MV2d een nieuwe rode fase terwijl de vorige nog open stond: de vorige als e open (zonder w); groen op een ander licht: e ander (zonder w)',
        nieuw.length === 2 && nieuw[1].e === 'open' && !('w' in nieuw[1]) && ander.e === 'ander' && !('w' in ander),
        'open / ander', kort([nieuw[1], ander]));
    eis('MV2e een licht zonder metingen: wel een regel (nm 0, zonder q), met de echte duur', !!m5.leeg && m5.leeg.nm === 0 && !('q' in m5.leeg) && m5.leeg.w === 12,
        'nm 0, w 12', kort(m5.leeg));
  }

  // ═══ MV2f — geen teken boven U+00FF in de schaduw ═════════════
  const pijl = await inFrame((w) => w.meetwerk22Binnen('pijl'));
  const BS = String.fromCharCode(92);
  eis('MV2f een bron met een pijl (V5 en U+2191) gaat via latin1Veilig de schaduw in: geen teken boven U+00FF in sl_m5log, anders telt Safari de hele sleutel dubbel',
      !pijl.fout && !!pijl.rec && pijl.rec.b === 'V5 ' + BS + 'u2191' && pijl.rec.w === 20 && pijl.ruw.length > 0 && ![...pijl.ruw].some(c => c.charCodeAt(0) > 255),
      'V5 ' + BS + 'u2191, alles Latin-1', pijl.fout || kort(pijl.rec));

  // ═══ MV3 — startCd: het scherm verandert niet ════════════════
  const met = await inFrame((w) => w.meetwerk22Binnen('startcd', { groen: true }));
  const zonder = await inFrame((w) => w.meetwerk22Binnen('startcd', { zonder: true }));
  const zag = await inFrame((w) => w.meetwerk22Binnen('startcd', { zag: true }));
  if (met.fout || zonder.fout || zag.fout) eis('MV3 testopstelling', false, 'geen fout', met.fout || zonder.fout || zag.fout);
  else {
    eis('MV3a NIETS VERANDERT op het scherm: met en zonder de schaduw hetzelfde doel, dezelfde modus, band, bron en pill',
        kort(met.scherm) === kort(zonder.scherm) && met.scherm.doel > 0 && met.scherm.actief === true, 'gelijk', kort([met.scherm, zonder.scherm]));
    eis('MV3b startCd opent de schaduw met het getoonde getal; met gezien begin niet',
        !!met.m5 && met.m5.g === Math.round(met.scherm.doel) && met.m5.n === 9602201 && zonder.m5 === null && zag.m5 === null,
        'g = doel / null / null', kort([met.m5 && met.m5.g, met.scherm.doel, zonder.m5, zag.m5]));
    eis('MV3c rood naar groen in verwerkFase sluit de schaduw met de echte duur (~25 s)', !!met.naGroen && met.naGroen.e === 'groen' && met.naGroen.w >= 24 && met.naGroen.w <= 26,
        'e groen, w 25', kort(met.naGroen));
  }

  // ═══ MV4 — einde gemist ══════════════════════════════════════
  const eg = await inFrame((w) => w.meetwerk22Binnen('eg'));
  if (eg.fout) eis('MV4 testopstelling', false, 'geen fout', eg.fout);
  else {
    const a = (eg.na1 || []).slice(-1)[0] || {};
    eis('MV4a beeindigFase tijdens rood: een regel x:eg met licht, dagdeel, begin gezien (b 1), minstens-duur (mn 12) en reden wissel',
        eg.na1.length === 1 && a.x === 'eg' && a.n === 9602201 && a.b === 1 && a.mn === 12 && a.r === 'wissel' && a.dd === eg.dd,
        'eg, b 1, mn 12, wissel', kort(a));
    eis('MV4b beeindigFase tijdens groen: geen regel', eg.na2.length === 1, '1 (geen nieuwe)', String(eg.na2.length));
    const u = (eg.na3 || []).slice(-1)[0] || {}, h = (eg.na4 || []).slice(-1)[0] || {};
    eis('MV4c resetNeutraal bij uitval: reden uitval (b 0, mn 9); de schaduw blijft open met u 1 en schrijft nog niets',
        eg.na3.length === 2 && u.r === 'uitval' && u.b === 0 && u.mn === 9 && !!eg.m5NaUitval && eg.m5NaUitval.u === 1 && eg.m5LogNaUitval === 0,
        'uitval, u 1, m5 leeg', kort([u, eg.m5NaUitval, eg.m5LogNaUitval]));
    const h7 = (eg.na4 || []).find(x => x.n === 9602208) || {}, hN = (eg.na4 || []).find(x => x.n === 9602201 && x.r === 'uitval') || {};
    eis('MV4d komt de fase terug (continuïteit), dan krijgt de uitval-regel van DAT licht h 1, niet die van een ander licht die later in de ring staat',
        eg.na4.length === 3 && hN.h === 1 && h7.r === 'uitval' && !('h' in h7), 'eigen h 1, ander niet', kort([hN, h7]));
    const u2 = (eg.na4a || []).slice(-1)[0] || {}, h2 = (eg.na4b || []).slice(-1)[0] || {};
    eis('MV4h de echte route: uitval (regel zonder h), daarna ziet verwerkFase binnen 30 s weer rood op hetzelfde licht (continuïteit, de fase loopt door vanaf de oude start): dan h 1',
        eg.na4a.length === 4 && u2.r === 'uitval' && !('h' in u2) && eg.na4b.length === 4 && h2.h === 1 && eg.fsHersteld >= 5,
        'zonder h, dan h 1', kort([u2, h2, eg.fsHersteld]));
    const wg = (eg.na5 || []).slice(-1)[0] || {}, st = (eg.na6 || []).slice(-1)[0] || {};
    eis('MV4e geen licht meer: reden weg, en de open schaduw sluit met e weg en de minstens-duur (geen w); het startscherm: reden start',
        wg.r === 'weg' && wg.mn === 20 && !!eg.m5NaWeg && eg.m5NaWeg.e === 'weg' && eg.m5NaWeg.mn === 20 && !('w' in eg.m5NaWeg) && eg.m5OpenNaWeg === null && st.r === 'start',
        'weg / weg mn 20 / start', kort([wg, eg.m5NaWeg, st]));
    eis('MV4f de leerdata (alle sl_v4_- en sl_v5_-sleutels) is na al die eindes byte-gelijk', eg.leerGelijk === true, 'gelijk', String(eg.leerGelijk));
    eis('MV4g de redenen: dropout/stale uitval, wissel, handmatig/correctie hand, geen weg, startscherm start',
        kort(EG_REDEN) === kort({ dropout: 'uitval', stale: 'uitval', wissel: 'wissel', handmatig: 'hand', correctie: 'hand', geen: 'weg', startscherm: 'start' }), 'zie verwacht', kort(EG_REDEN));
  }

  // ═══ MV5 — de passagelog ═════════════════════════════════════
  const pas = await inFrame((w) => w.meetwerk22Binnen('passage'));
  if (pas.fout) eis('MV5 testopstelling', false, 'geen fout', pas.fout);
  else {
    const p = (pas.naP || [])[0] || {};
    eis('MV5a een passage: groen voor het eerst gezien op 80 m (c1 g, d1 80), groen op 50 m, koers 0, 10 s stil binnen 60 m (s 1, w 10), dichtst 20 m',
        pas.naP.length === 1 && p.n === 9602201 && p.c1 === 'g' && p.d1 === 80 && p.c50 === 'g' && p.k === 0 && p.s === 1 && p.w === 10 && p.ma === 20 && !('v' in p),
        'zie verwacht', kort(pas.naP));
    const q = (pas.naQ || [])[1] || {};
    eis('MV5b de volgende passage noemt het licht ervoor (v) en de tijd ertussen (vt); zonder camera geen eerste-zichtkleur en op 50 m een streepje; niet stil: s 0',
        pas.naQ.length === 2 && q.n === 9602202 && q.v === 9602201 && typeof q.vt === 'number' && !('c1' in q) && q.c50 === '-' && q.s === 0,
        'v P, c50 -', kort(q));
    eis('MV5c een licht dat alleen op 150 m getoond werd (nooit binnen 40 m): geen regel', pas.naR.length === 2, '2 (geen nieuwe)', String(pas.naR.length));
    const s = (pas.naS || []).filter(x => x.n === 9602204), t = (pas.naS || []).filter(x => x.n === 9602205);
    eis('MV5d drie tikken een buur getoond midden in de nadering (het licht al op 20 m): één passage voor het licht, geen voor de buur (die kwam niet binnen 40 m)',
        s.length === 1 && t.length === 0, '1 / 0', s.length + ' / ' + t.length);
  }

  // ═══ MV6 — ritten met de echte onGPS ═════════════════════════
  const rit = (opt, zonderPassage) => inFrame(async (w) => {
    if (zonderPassage) w.passageTik = () => {};
    w.localStorage.setItem('sl_passagelog', '[]');
    const r = await w.meetwerkRitBinnen(opt);
    r.passage = JSON.parse(w.localStorage.getItem('sl_passagelog') || '[]');
    return r;
  });
  const A = 9602210, M = A + 1, Z = A + 2, B = A + 3, F = A + 4, C = A + 5;
  const nodes = [{ id: A, x: 0, y: 100 }, { id: M, x: -9, y: 106 }, { id: Z, x: 60, y: 30 }, { id: B, x: 0, y: 320 }, { id: F, x: 2, y: 91 }, { id: C, x: 0, y: -150 }];
  const punten = (stopY) => {
    const p = []; let y = -170;
    while (y < stopY) { p.push({ x: 0, y, kmh: 36, koers: 0 }); y += 10; }
    for (let j = 0; j < 8; j++) p.push({ x: 0, y: stopY, kmh: 0 });
    y = stopY;
    while (y < 600) { y += 10; p.push({ x: 0, y, kmh: 36, koers: 0 }); }
    return p;
  };
  const ritten = [
    ['vrij, stop voor A', { nodes, start: C, fiets: [F], punten: punten(88) }],
    ['met tik op A', { nodes, start: A, fiets: [F], tik: true, punten: punten(88) }],
    ['zonder stop', { nodes, start: A, fiets: [F], punten: (() => { const p = []; for (let y = -170; y < 600; y += 10) p.push({ x: 0, y, kmh: 36, koers: 0 }); return p; })() }],
  ];
  const keuze = (r) => JSON.stringify((r.rij || []).map(x => [x.y, x.app, x.slot, x.auto, x.regel]));
  const logs = (r) => JSON.stringify([(r.wissel || []).map(x => [x.t, x.van, x.naar, x.r, x.kmh, x.pl]), (r.tik || []).map(x => [x.s, x.reden || x.tak || '']),
    r.regellog, (r.opslag || []).map(x => [x.reden, x.node]), r.stop]);
  let alles = true; const uit6 = [], metR = {};
  for (const [naam, opt] of ritten) {
    const m = await rit(opt, false), z = await rit(opt, true);
    metR[naam] = m;
    if (m.fout || z.fout) { uit6.push(naam + ': ' + (m.fout || z.fout)); alles = false; continue; }
    const gelijk = keuze(m) === keuze(z) && logs(m) === logs(z);
    alles = alles && gelijk && m.rij.length > 60 && z.passage.length === 0;
    uit6.push(naam + ': ' + m.rij.length + ' tikken, ' + m.passage.length + ' passages, ' + (gelijk ? 'gelijk' : 'ANDERS'));
  }
  eis('MV6a NIETS VERANDERT: drie ritten geven met en zonder de passagelog in elke GPS-tik dezelfde keuze, hetzelfde slot, dezelfde schaduwregel en dezelfde wissel-, tik-, regel-, opslag- en stoplog',
      alles, 'gelijk', uit6.join('; '));
  const vrij = (metR['vrij, stop voor A'] || {}).passage || [];
  const pa = vrij.find(x => x.n === A) || {}, pc = vrij.find(x => x.n === C) || {};
  eis('MV6b de rit met een stop voor A: een passage voor C (de start) en voor A, met A stil (s 1, w ~8) en C als licht ervoor',
      !!pc.n && !!pa.n && pa.s === 1 && pa.w >= 6 && pa.w <= 10 && pa.v === C && pa.k === 0 && pa.ma <= 15,
      'C en A, A s 1', kort(vrij));
  const stop = ((metR['vrij, stop voor A'] || {}).stop || [])[0] || {};
  eis('MV6c de stoplog draagt de twijfelvlag: de lichten van de rit liggen op geen weg met een naam (w)', stop.tw === 'w', 'w', kort({ tw: stop.tw }));

  // ═══ MV7 — de twijfelvlag ════════════════════════════════════
  const bewCache = osmCache;
  try {
    const LAT0 = 52.0000, LON0 = 5.0000, mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
    const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
    const stopPos = LL(0, -20), a = { id: 9602230, straat: 'Weg', ...LL(0, 0) };
    const tw = (lijst) => { osmCache = lijst; return stopTwijfel(9602230, stopPos.lat, stopPos.lon); };
    const alleen = tw([a]);
    const buurRecht = tw([a, { id: 9602231, straat: 'Weg', ...LL(6, 0) }]);       // 6 m opzij: vanaf 20 m terug 17 graden
    const buurOpzij = tw([a, { id: 9602231, straat: 'Weg', ...LL(9, 3) }]);       // 9,5 m van A, peiling 24 graden? zie hieronder
    const buurWijd = tw([a, { id: 9602231, straat: 'Weg', ...LL(0, 11) }]);       // 11 m recht erachter: zelfde peiling, maar buiten 10 m
    const zonderWeg = tw([{ ...a, straat: null, maxspeed: null }]);
    const alleenMax = tw([{ ...a, straat: null, maxspeed: 50 }]);
    const keten = tw([a, ...[1, 2, 3, 4].map(i => ({ id: 9602231 + i, straat: 'Weg', ...LL(0, 28 * i) }))]);
    const kortKeten = tw([a, ...[1, 2, 3].map(i => ({ id: 9602231 + i, straat: 'Weg', ...LL(0, 28 * i) }))]);
    eis('MV7a één licht met een straat: geen twijfel (null)', alleen === null, 'null', String(alleen));
    eis('MV7b een buur binnen 10 m die vanaf de stopplek binnen 25 graden ligt: b; een buur net buiten 10 m: niets',
        buurRecht === 'b' && buurWijd === null, 'b / null', kort([buurRecht, buurOpzij, buurWijd]));
    eis('MV7c een licht zonder straat en zonder maxspeed: w; met alleen een maxspeed: geen w', zonderWeg === 'w' && alleenMax === null, 'w / null', kort([zonderWeg, alleenMax]));
    eis('MV7d lichten om de 28 m geketend over 112 m: g; over 84 m niet', keten === 'g' && kortKeten === null, 'g / null', kort([keten, kortKeten]));
  } catch (e) {
    eis('MV7 crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally { osmCache = bewCache; }

  // ═══ MV8 — de detlog ═════════════════════════════════════════
  const bew8 = { dichtstbijOSM, snelheidKmh, detLogArr, detLogStop, detLogStilLaatst, detLogBest, laatsteDetectiesStelsel, huidigePos, detLogAfst, detLogRatio, detLogGeenCrop, kop: window.getSmoothedHeading };
  const vidW = Object.getOwnPropertyDescriptor(video, 'videoWidth'), vidH = Object.getOwnPropertyDescriptor(video, 'videoHeight');
  try {
    Object.defineProperty(video, 'videoWidth', { value: 2160, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 3840, configurable: true });
    localStorage.removeItem('sl_detlog'); detLogArr = null; detLogStop = false; detLogStilLaatst = 0;
    huidigePos = { lat: 52, lon: 5 };
    dichtstbijOSM = { id: 9602241, lat: 52 + 30 / 111320, lon: 5, afstand: 30 };
    detLogAfst = 30; detLogRatio = 0.5; detLogGeenCrop = null; snelheidKmh = 30;
    window.getSmoothedHeading = () => 10;
    detLogBest = { s: 0.8, k: 0, cx: 320, cy: 100, w: 20, h: 40 };
    laatsteDetectiesStelsel = { s: 0.5, px: 0, py: 80, x: 540, y: 1000 };
    detLogSchrijf();
    const r1 = (lees('sl_detlog') || []).slice(-1)[0] || null;
    detLogBest = null; window.getSmoothedHeading = () => null;
    detLogSchrijf();
    const r2 = (lees('sl_detlog') || []).slice(-1)[0] || null;
    eis('MV8a de detlog krijgt het midden van de beste box als fractie van de videobreedte (cxv 0,546: (320/0,5 + 540) / 2160), de koers (ko 10) en de kaarthoek (kh -10: het licht ligt recht noord)',
        !!r1 && r1.cxv === 0.546 && r1.ko === 10 && r1.kh === -10, 'cxv 0.546, ko 10, kh -10', kort(r1));
    eis('MV8b zonder beste box en zonder koers: geen cxv, ko of kh (de rest van de regel zoals voorheen)',
        !!r2 && !('cxv' in r2) && !('ko' in r2) && !('kh' in r2) && r2.afst === 30, 'geen nieuwe velden', kort(r2));
  } catch (e) {
    eis('MV8 crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    if (vidW) Object.defineProperty(video, 'videoWidth', vidW); else delete video.videoWidth;
    if (vidH) Object.defineProperty(video, 'videoHeight', vidH); else delete video.videoHeight;
    dichtstbijOSM = bew8.dichtstbijOSM; snelheidKmh = bew8.snelheidKmh; detLogArr = bew8.detLogArr; detLogStop = bew8.detLogStop;
    detLogStilLaatst = bew8.detLogStilLaatst; detLogBest = bew8.detLogBest; laatsteDetectiesStelsel = bew8.laatsteDetectiesStelsel;
    huidigePos = bew8.huidigePos; detLogAfst = bew8.detLogAfst; detLogRatio = bew8.detLogRatio; detLogGeenCrop = bew8.detLogGeenCrop;
    window.getSmoothedHeading = bew8.kop;
    herstel();
  }

  // ═══ MV9 — de export ═════════════════════════════════════════
  const ex = String(exporteerMeetdata);
  eis('MV9 de meetdata-export heeft de bakken passage en m5, gevuld uit sl_passagelog en sl_m5log, en beide gaan mee in de backup',
      /uit\.passage = \{\}; uit\.m5 = \{\};/.test(ex) && /key === PASSAGE_SLEUTEL\)\s+doel = uit\.passage;/.test(ex) && /key === M5_SLEUTEL\)\s+doel = uit\.m5;/.test(ex)
        && PASSAGE_SLEUTEL === 'sl_passagelog' && M5_SLEUTEL === 'sl_m5log' && exportSleutelMee(PASSAGE_SLEUTEL) && exportSleutelMee(M5_SLEUTEL),
      'twee bakken, ook in de backup', 'zie bron');

  // ═══ MV10 — grootte en een vol quotum ════════════════════════
  const bytes = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
  const mReg = (m5.naGroen || [])[0] || {}, pReg = ((pas.naP || [])[0]) || {}, eReg = ((eg.na1 || [])[0]) || {};
  eis('MV10a de regels zijn klein: schaduw hoogstens 300 bytes, passage 160, einde-gemist 120 (ringen van 150 en 300: samen onder ~70 KB)',
      bytes(mReg) <= 300 && bytes(pReg) <= 160 && bytes(eReg) <= 120 && M5_MAX === 150 && PASSAGE_MAX === 300,
      '<= 300 / 160 / 120', bytes(mReg) + ' / ' + bytes(pReg) + ' / ' + bytes(eReg));
  const vol = await inFrame((w) => w.meetwerk22Binnen('passage', { vol: true }));
  eis('MV10b een vol quotum bij de passagelog: alleen dat log stopt (sleutel weg); de passage-rekening crasht niet',
      !vol.fout && vol.gestopt === true && vol.sleutelEr === false, 'gestopt, weg', vol.fout || kort({ g: vol.gestopt, er: vol.sleutelEr }));

  // ═══ MV12 — een fout in de nieuwe code raakt niets ═══════════
  // Elke stand in een eigen iframe met een vers licht (geen restdata); vergeleken met de
  // stand 'zonder' (de haken uit = V11.37.21) via JSON met gesorteerde sleutels.
  const canon = (x) => JSON.stringify(x, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.fromEntries(Object.keys(v).sort().map(q => [q, v[q]])) : v);
  const basis12 = 900000000 + Math.floor(Math.random() * 1e6) * 100;
  const STANDEN12 = ['zonder', 'gifA', 'gifB'];
  const uit12 = {}, tel12 = {}, fout12 = [];
  for (const scen of ['cd', 'eg', 'rit']) {
    uit12[scen] = {}; tel12[scen] = {};
    for (const stand of STANDEN12) {
      const N12 = basis12 + 10 * STANDEN12.indexOf(stand) + (scen === 'eg' ? 1000 : 0);
      const opt12 = { stand, scen, N: N12, rit: scen === 'rit' ? ritten[0][1] : null };
      const r = await inFrame((w) => w.meetwerk22Binnen('gif', opt12));
      if (r.fout) { fout12.push(scen + '/' + stand + ': ' + r.fout); continue; }
      uit12[scen][stand] = canon(r.kern).split(String(N12)).join('N');
      tel12[scen][stand] = r.gifTel;
      for (const s of (r.kern.stappen || [])) if (s.fout) fout12.push(scen + '/' + stand + ' ' + s.naam + ': ' + s.fout);
    }
  }
  const gelijk12 = (scen) => !!uit12[scen].zonder && STANDEN12.every(s => uit12[scen][s] === uit12[scen].zonder);
  eis('MV12a een fout binnen de nieuwe code (m5Rest, passageKleur, stopTwijfel) of bij het lezen en schrijven van sl_m5log en sl_passagelog: de countdown (doel, modus, band, bron, pill), de fase na elke stap, de leerdata en de metingen blijven gelijk aan zonder de haken',
      fout12.length === 0 && gelijk12('cd') && gelijk12('eg') && tel12.cd.gifA >= 1 && tel12.cd.gifB >= 1 && tel12.eg.gifA >= 1 && tel12.eg.gifB >= 4,
      'gelijk, en de fouten zijn echt gegooid', kort({ fout12, tel: [tel12.cd, tel12.eg], gelijk: [gelijk12('cd'), gelijk12('eg')] }));
  eis('MV12b dezelfde fouten in een rit met de echte onGPS (stop voor een licht): in elke GPS-tik dezelfde keuze, hetzelfde slot en dezelfde wissel-, tik-, regel-, opslag- en stoplog',
      gelijk12('rit') && tel12.rit.gifA >= 10 && tel12.rit.gifB >= 1, 'gelijk', kort({ tel: tel12.rit, gelijk: gelijk12('rit') }));
  const det12 = await inFrame((w) => w.meetwerk22Binnen('gif', { stand: 'met', scen: 'det', N: basis12 + 5000 }));
  eis('MV12c een fout in de nieuwe detlog-velden ontsnapt niet: alleen die ene detlogregel valt weg, het log loopt door',
      !det12.fout && det12.ontsnapt === null && det12.naGif === 0 && det12.naGewoon === 1 && det12.gestopt === false && det12.gifTel === 1,
      'geen fout, 0 dan 1', kort(det12));

  // ═══ MV11 — regressie ════════════════════════════════════════
  const V113721 = { startCd: ['490b39a0', 7140], verwerkFase: ['6a38a072', 12634], beeindigFase: ['7dc8111e', 1286], resetNeutraal: ['7eea8c30', 3601],
    onGPS: ['cbd2a89c', 15696], stopLogTik: ['30d3cdff', 3528], detLogSchrijf: ['9f1497e0', 3508], exporteerMeetdata: ['a5ffd57a', 9797] };
  // Gemeten in de bron van V11.37.21 (6b4bcd9) in een eigen headless Chrome, niet afgeleid uit deze versie.
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.22(?!\d)/.test(l)).length;
  const telVerwacht = { startCd: 2, verwerkFase: 2, beeindigFase: 1, resetNeutraal: 1, onGPS: 1, stopLogTik: 1, detLogSchrijf: 4, exporteerMeetdata: 3 };
  const telAf = Object.entries(telVerwacht).filter(([n, m]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('MV11a acht functies krijgen regels met merkteken V11.37.22: detLogSchrijf 4, exporteerMeetdata 3, startCd en verwerkFase 2, de andere 1',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const zonder22 = (f) => String(f).split(NL).filter(l => !/V11\.37\.22(?!\d)|V11\.37\.23(?!\d)|V11\.37\.26(?!\d)|V11\.37\.30(?!\d)|V11\.37\.31(?!\d)|V11\.37\.34(?!\d)/.test(l)).join(NL);   // V11.37.23: ook de regels van V11.37.23 (test_meetwerk23); V11.37.26: idem (test_schaduw_nano)
  const anders = Object.entries(V113721).filter(([n, [h, l]]) => { const s = zonder22(window[n]); return fnv(s) !== h || s.length !== l; })
    .map(([n]) => n + ' ' + fnv(zonder22(window[n])) + '/' + zonder22(window[n]).length);
  eis('MV11b zonder die regels zijn ze byte-gelijk aan V11.37.21 (alles is toegevoegd, niets gewijzigd)', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const ONGEMOEID = { berekenSchaduwWaarden: ['dfd1c572', 1799], kiesCountdownBron: ['8e69db98', 12851], slaOp: ['411179eb', 3252], slaOpIntern: ['c284229a', 2342],
    slaOpV5: ['3b4df08', 1650], schrijfV5DirectBijGroen: ['78222c0c', 1872], gewGem: ['eb1936ea', 1025], bepaalCdModus: ['261892b5', 3388],
    vindDichtbij: ['d32386d8', 4753], updateDichtbij: ['cbf57ede', 12709], slaPassiefMeting: ['eac878bc', 1945], meetRingSchrijf: ['60245787', 420], stopLogAf: ['21c4b6e6', 928] };
  const terug33 = (l) => l.replace(/conf < hoofdGrens\('leer'\)\) \{   \/\/ V11.37.33(?!d): de grens van het geladen model$/, 'conf < 0.20) {');   // V11.37.33: de vervangen regel in slaOp terug
  const zonder23 = (f) => String(f).split(NL).map(terug33).filter(l => !/V11\.37\.23(?!\d)/.test(l)).join(NL);   // V11.37.23: updateDichtbij kreeg één regel (test_meetwerk23)
  const anders2 = Object.entries(ONGEMOEID).filter(([n, [h, l]]) => fnv(zonder23(window[n])) !== h || zonder23(window[n]).length !== l).map(x => x[0]);
  eis('MV11c dertien functies voor het leren, de countdown en de lichtkeuze zijn niet aangeraakt (op de regel van V11.37.23 in updateDichtbij na, zie test_meetwerk23)', anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');
  let code = [];
  try {
    const html = await (await fetch(new URL('index.html', location.href).href + '?t=' + Date.now())).text();
    code = html.split(NL).filter(l => /V11\.37\.22(?!\d)/.test(l) && !/^\s*\/\//.test(l));
  } catch (e) { code = ['fout: ' + e]; }
  eis('MV11d in de bron staat V11.37.22 buiten het commentaar alleen in die vijftien regels in de acht functies (het blok zelf heeft een eigen kop; de versieregel heet sinds V11.37.23 anders)',
      code.length === 15 && code.filter(l => /^const APP_VERSIE/.test(l)).length === 0,
      '15 regels', code.length + ': ' + code.map(l => l.trim().slice(0, 30)).join(' | '));

  herstel();
  try { opslagHersynchroniseer(Object.keys(snap)); } catch (e) {}
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testMeetwerk22 = testMeetwerk22; window.meetwerk22Binnen = meetwerk22Binnen; }
