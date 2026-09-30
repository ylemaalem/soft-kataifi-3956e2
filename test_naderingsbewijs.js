// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_naderingsbewijs.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.27.0: bewijs verzamelen tijdens het naderen, en bij V11.36.0
//  (A1: een tik op het beeld wist dat bewijs niet meer; A2: de getikte lamp
//  overleeft de correctie).
//
//  WAT ER GEMETEN IS. Op 25 en 26 september stond de app 10 keer bij
//  stilstand op het verkeerde licht, alle 10 na een tik op het camerabeeld
//  tijdens het naderen. Bij een licht op 6-27 m herstelde de app na 5-6 s; op
//  het Bentinckplein (licht op 1-3 m, peiling -131 graden) nooit.
//
//  HOE DEZE SUITE WERKT. Elk scenario draait in een VERSE iframe van de app en
//  rijdt de echte onGPS, tik voor tik, met een nepklok. Het remprofiel is
//  natuurkundig consistent (positie = integraal van de snelheid), anders zou de
//  afgelegde-weg-toets niets toetsen. downloadOSM, refreshStadIndienNodig en
//  toonToast worden in die iframe stilgelegd; de localStorage van deze pagina
//  gaat na elk scenario exact terug.
//
//  Coördinaten in meters ten opzichte van het stoppunt (0,0), noord = +y, de
//  auto rijdt noordwaarts.
//
//  NB1   Bentinckplein: licht op 1,5 m onder -132 graden, tik tijdens naderen
//          a  vooraf, oude routes: binnen 30 s GEEN wissel (de blokkade)
//          b  nieuw: wissel binnen 2 s, niet vóór 1 s, route 'dichtbij'
//          c  'Terug' zet het oude licht vast en de app blijft daar
//          d  met ruis (1 m rijdend, 3 m stil): >= 18 van 20 binnen 2 s
//  NB2   Stadsring (4 m, -30 graden): binnen 2 s; oude routes 5 s
//  NB3   patroon 25 sept (15 m, +4 graden): binnen 2 s via 'ver'; oud 5 s
//  NB4   gepasseerd voetgangerslicht P, app toont kruispuntlicht J
//          a  stop bij J: geen wissel (maar er WAS bewijs voor P)
//          b  stop 6 m voorbij P: geen wissel
//          c  stop 3,5 m voorbij P: geen wissel, en wel door 'voorbij_weg'
//          d  als b, maar iOS meldt de halve snelheid: 'voorbij_afstand' vangt
//             wat 'voorbij_weg' mist
//          e  6 m voorbij P, P 16 m vóór J: het bewijs is al onderweg weg
//          f  b met ruis, 10 keer: nooit een wissel naar P
//        RESTZONE, bewust niet getoetst als goedgekeurd gedrag: stop je 0-3 m
//        ná P terwijl P >= 8 m dichterbij ligt dan J, dan kan de route naar P
//        wisselen. Dat is met telefoon-GPS niet te onderscheiden van het
//        Bentinckplein, en door Younes aanvaard (27 sept). Het vangnet is 'Terug'.
//  NB5   Hospitaaldreef, masten opzij: 95 graden (12,5 m), 97 graden (10 m),
//        144 graden (13 m), en een kruisend licht op 6 m. Nooit een wissel;
//        97 graden en 6 m worden geweigerd op 'dwars'. Plus 6 m met ruis, 10 keer.
//  NB6   V11.36.0 A1: een late tik op het beeld (op 8 m) wist het bewijs niet
//        meer: wissel binnen 2 s. Tot en met V11.34.3 toetste NB6 het omgekeerde.
//  NB6b  een late keuze uit de lijst laat 2 telbare tikken over: te weinig
//  NB6c  een late keuze uit de lijst wist het bewijs wel: het oude gedrag
//  NB7   GPS-sprongen: a  één sprong tijdens het naderen telt hoogstens één keer
//                      b  een sprong op het beslismoment wordt geweigerd op
//                         'koers' en gooit het bewijs niet weg
//                      c  idem, met de marge onder 8 m: geweigerd op 'marge'
//  NB8   marge 6 m: nooit bewijs, nooit een wissel
//  NB9   tijd sinds een vorige correctie (< 10 s): geweigerd op 'bounce'
//  NB10  oud bewijs: wie pas na 15 s mag beslissen, beslist niet meer
//  NB11  geen koers bekend: geen bewijs, oude route na 3 s
//  NB12  zonder tik, hysterese houdt het verkeerde licht (14 m tegen 3 m):
//        binnen 2 s; oud 3 s
//  NB13  twee masten op 3 m van elkaar wisselen elkaar af: het bewijs telt door
//  NB15  het veld van 27 sept 23:48: zes tikken tot vlak voor de stop.
//          a  met de oude tik: wissel na 5 s of later (in het veld: 6 s)
//          b  V11.36.0: wissel binnen 2 s via de nadering
//  NB16  V11.36.0 A2: de getikte lamp overleeft de correctie
//          a  hetzelfde object, de sticky, de seed, de plek
//          b  zonder tik: niets anders dan vroeger
//          c  alles wat aan de tik hangt (voor: bboxOverride), ook wat later komt
//          d  de oude routes laten de lamp nog los (gepind)
//  NB14  REGRESSIE: checkHandLockVerval en checkNodeCorrectieStilstand zijn
//        byte-gelijk aan V11.26.0, de volgorde in onGPS klopt, en geen
//        bestaande logregel is breder geworden. NB14c (V11.36.0): een tik op het
//        beeld laat het bewijs staan, een lijstkeuze wist het
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_naderingsbewijs.js';
//      document.head.appendChild(s);
//      s.onload = () => testNaderingsbewijs().then(u => console.table(u.regels));
//    (async: elk scenario laadt een eigen iframe; duurt zo'n halve minuut)
// ═══════════════════════════════════════════════════════════════

// Een nadering met constante snelheid, gelijkmatig remmen, eventueel kruipen,
// en stilstand. Positie en snelheid zijn één integraal, bemonsterd per tik.
// Eindigt op (x, stopY): scenario's leggen hun nodes rond het stoppunt.
function naderProfiel(o) {
  const a = o.a || 1.5, dt = 0.01, tik = (o.tikMs || 1000) / 1000;
  const v0 = o.v0Kmh / 3.6, vk = (o.kruipKmh || 0) / 3.6, Tk = vk > 0 ? (o.kruipS || 0) : 0;
  const remweg = (v0 * v0 - vk * vk) / (2 * a) + vk * Tk + vk * vk / (2 * a);
  const T0 = Math.max(0, ((o.vanAfstand || 150) - remweg) / v0);
  const Tb1 = (v0 - vk) / a, Tb2 = vk / a;
  const vAt = (t) => t < T0 ? v0
    : t < T0 + Tb1 ? v0 - a * (t - T0)
    : t < T0 + Tb1 + Tk ? vk
    : Math.max(0, vk - a * (t - T0 - Tb1 - Tk));
  const Teind = T0 + Tb1 + Tk + Tb2 + (o.stilS != null ? o.stilS : 20);
  const ruw = [];
  let y = 0, t = 0, volgende = 0;
  while (t <= Teind + 1e-9) {
    if (t >= volgende - 1e-9) { ruw.push({ y, kmh: vAt(t) * 3.6 }); volgende += tik; }
    y += dt * (vAt(t) + vAt(t + dt)) / 2;
    t += dt;
  }
  const yEind = ruw[ruw.length - 1].y;
  return ruw.map(p => ({ x: o.x || 0, y: p.y - yEind + (o.stopY || 0),
                         kmh: Math.round(p.kmh * 1000) / 1000 }));
}

// ── Draait IN de iframe: deelt de globals van die app-instantie ──
async function naderRitBinnen(opt) {
  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let s = opt.seed || 1;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
  const T0 = 1790000000000;
  let klok = T0;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  const toasts = [];
  window.toonToast = (tekst, actie) => {
    toasts.push({ t: klok, tekst: String(tekst), label: (actie && actie.label) || null,
                  fn: (actie && actie.fn) || null });
  };
  if (opt.zonderNieuweRoute) {
    window.verzamelNaderingsBewijs = () => {};
    window.checkNaderingsCorrectie = () => {};
  }
  // V11.36.0: het gedrag van vóór A1 nabootsen, ter vergelijking in NB15 —
  // toen wiste ook een tik op het beeld het naderingsbewijs.
  if (opt.oudeTik) {
    const echt = vergrendelNodeHandmatig;
    window.vergrendelNodeHandmatig = function (nodeId, element) {
      const r = echt(nodeId, element); if (element === 'beeld') naderBewijsReset(); return r; };
  }
  let lampVoor = null, lampNamen = [];
  try { localStorage.setItem('sl_opslaglog', '[]'); } catch (e) {}

  osmCache = opt.nodes.map(n => ({ id: n.id, naam: n.naam || String(n.id), ...LL(n.x, n.y) }));
  cacheGeladen = true; cacheBezig = false; cacheCentrum = LL(0, 0);
  eersteGPSVerwerkt = true;
  clusterNodes = new Set();
  const start = osmCache.find(n => n.id === opt.gekozen);
  dichtstbijOSM = { ...start, afstand: 150 }; vorigOsmId = start.id;
  handmatigLockActief = false; stilstandAutoLock = false;
  handmatigGeselecteerdNodeId = null; handmatigGeselecteerdTimestamp = 0;
  stilstandSinds = 0; laatsteNodeCorrectieTijd = 0; laatsteNodeWisselTijd = 0;
  headingBuffer.length = 0;
  hoekStabielReset(); handLockVervalReset(); naderBewijsReset();

  const rij = [];
  let tStil = null, wisselT = null, terugGedrukt = null;
  for (let i = 0; i < opt.profiel.length; i++) {
    klok += (opt.tikMs || 1000);
    const p = opt.profiel[i];
    const stil = p.kmh < 1;
    const ruis = stil ? (opt.ruisStil || 0) : (opt.ruisRij || 0);
    let x = p.x + ((opt.weven && !stil) ? (i % 2 ? opt.weven : -opt.weven) : 0) + ruis * gauss();
    let y = p.y + ruis * gauss();
    for (const sp of (opt.sprongen || [])) if (sp.i === i) { x += sp.dx || 0; y += sp.dy || 0; }
    if (opt.tapBijI === i || (opt.tapBijIs && opt.tapBijIs.includes(i))) vergrendelNodeHandmatig(dichtstbijOSM.id, 'beeld');
    if (opt.lijstBijI === i) vergrendelNodeHandmatig(dichtstbijOSM.id, 'lijst');
    if (opt.lampBijI === i) {
      // V11.36.0 A2: een getikte lamp, zoals de handler hem zet (tikZet), met
      // een sticky en een tapSeed. Elke toestand die in de bron als
      // `let X = null; // { voor: bboxOverride ...` staat, hoort bij deze tik en
      // moet de correctie overleven — ook een die er later bij komt.
      tikZet(null, 1000, 800);
      stickyDetectie = { cx: 320, cy: 240, camX: 1000, camY: 800, camH: 40, bron: 'tik', tijd: klok, klasse: 0, familie: 'rood' };
      stickyMissTeller = 1; tapSeedDetectie = { cx: 320, cy: 240, familie: 'rood', tijd: klok };
      const src = [...document.scripts].map(sc => sc.textContent).join(String.fromCharCode(10));
      lampNamen = [...src.matchAll(/^let (\w+) = null;[ \t]*\/\/[ \t]*\{ voor: bboxOverride\b/gm)].map(m => m[1]);
      for (const n of lampNamen) if (eval(n) == null) eval(n + ' = { voor: bboxOverride, merk: n }');
      lampVoor = { o: bboxOverride, s: stickyDetectie, t: tapSeedDetectie, cx: bboxOverrideCamX, cy: bboxOverrideCamY,
                   m: stickyMissTeller, refs: Object.fromEntries(lampNamen.map(n => [n, eval(n)])) };
    }
    // Declaratief, en dus IN deze iframe uitgevoerd: een callback uit de
    // testpagina zou de globals van die pagina zetten, niet van deze.
    if (opt.correctieTijdBijI === i) laatsteNodeCorrectieTijd = klok + opt.correctieTijdDelta;
    const kmh = p.kmh * ((opt.factorVanafI != null && i >= opt.factorVanafI) ? opt.snelheidFactor : 1);
    const q = LL(x, y);
    await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: kmh / 3.6,
                            heading: (opt.geenKoers || p.kmh < 1) ? NaN : 0 },
                  timestamp: klok });
    if (tStil === null && kmh < 3) tStil = klok;
    const gekozen = dichtstbijOSM ? dichtstbijOSM.id : null;
    rij.push({ i, kmh, t: tStil === null ? null : (klok - tStil) / 1000, gekozen,
               lock: handmatigLockActief ? (stilstandAutoLock ? 'auto' : 'tap') : '-',
               n: naderBewijs ? naderBewijs.n : 0 });
    if (opt.doel != null && wisselT === null && gekozen === opt.doel) wisselT = klok;
    if (opt.terugNaS != null && wisselT !== null && terugGedrukt === null
        && klok - wisselT >= opt.terugNaS * 1000) {
      const tt = [...toasts].reverse().find(x => x.label === 'Terug');
      terugGedrukt = tt ? (tt.fn() === true) : 'geen toast';
    }
  }
  let logs = [];
  try { logs = JSON.parse(localStorage.getItem('sl_opslaglog')) || []; } catch (e) {}
  const rel = (t) => (tStil === null ? null : (t - tStil) / 1000);
  const lamp = lampVoor ? {
    object: bboxOverride === lampVoor.o, sticky: stickyDetectie === lampVoor.s, seed: tapSeedDetectie === lampVoor.t,
    cam: bboxOverrideCamX === lampVoor.cx && bboxOverrideCamY === lampVoor.cy, miss: stickyMissTeller === lampVoor.m,
    namen: lampNamen,
    refs: lampNamen.map(n => ({ n, zelfde: eval(n) === lampVoor.refs[n], voor: !!eval(n) && eval(n).voor === bboxOverride }))
  } : { geenTik: bboxOverride === null && stickyDetectie === null };
  return {
    rij, terugGedrukt, lamp,
    logs: logs.filter(r => r.t >= T0).map(r => ({ ...r, ts: rel(r.t) })),
    toasts: toasts.map(x => ({ ts: rel(x.t), tekst: x.tekst, label: x.label }))
  };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testNaderingsbewijs() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

  // De opslag van deze pagina, exact terug na elk scenario.
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  const herstel = () => {
    try { localStorage.clear(); for (const k in snap) localStorage.setItem(k, snap[k]); } catch (e) {}
  };
  const bron = new URL('test_naderingsbewijs.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?naderingsbewijs=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      const w = f.contentWindow;
      await new Promise((ok, nee) => {
        const sc = w.document.createElement('script');
        sc.src = bron + '?t=' + Date.now(); sc.onload = ok; sc.onerror = () => nee(new Error('laden'));
        w.document.head.appendChild(sc);
      });
      return await w.naderRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], logs: [], toasts: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const wissel = (u, id) => { const r = u.rij.find(x => x.gekozen === id); return r ? r.t : null; };
  const blijft = (u, id) => u.rij.every(x => x.gekozen === id);
  const log = (u, reden) => u.logs.filter(r => r.reden === reden);
  const maxN = (u) => Math.max(0, ...u.rij.map(r => r.n));
  const iBij = (prof, node, af) => prof.findIndex(p => Math.hypot(node.x - p.x, node.y - p.y) <= af);
  const iStil = (prof) => prof.findIndex(p => p.kmh < 3);
  const kort = (u) => u.fout ? u.fout
    : u.rij.filter(r => r.t != null).slice(0, 6).map(r => `t${r.t}:${r.gekozen}/${r.lock}/n${r.n}`).join(' ');

  try {
    // ═══ NB1 — HET BENTINCKPLEIN ═════════════════════════════
    // Gelogd op 26 sept 14:04: getoond 28 m onder -70 graden, het juiste licht
    // op 1-3 m onder -131/-132 graden. Hier: C op 1,5 m, 1,1 m links en 1 m
    // ACHTER de telefoon — precies wat een peiling van -132 graden betekent.
    const B = { W: { id: 7001, naam: 'Bentinckplein W', x: -26.3, y: 9.6 },
                C: { id: 7002, naam: 'Bentinckplein C', x: -1.1, y: -1.0 } };
    const pB = naderProfiel({ vanAfstand: 135, v0Kmh: 42, a: 1.5, stilS: 30 });
    const optB = { nodes: [B.W, B.C], gekozen: 7001, doel: 7002, profiel: pB, tapBijI: iBij(pB, B.W, 116) };
    const peil = Math.round(Math.atan2(B.C.x, B.C.y) * 180 / Math.PI);
    eis('NB1 vooraf: het juiste licht ligt onder dezelfde peiling als gelogd (-132)',
        peil === -132, -132, peil);

    const b0 = await rit({ ...optB, zonderNieuweRoute: true });
    eis('NB1a de oude routes wisselen binnen 30 s NIET — de blokkade is nagebootst',
        !b0.fout && blijft(b0, 7001) && log(b0, 'handlock_vervallen').length === 0,
        'blijft op W, geen verval', kort(b0));

    const b1 = await rit({ ...optB, terugNaS: 2 });
    const tb1 = wissel(b1, 7002);
    eis('NB1b met naderingsbewijs: wissel naar het juiste licht binnen 2 s',
        tb1 != null && tb1 <= 2, '<= 2 s', tb1);
    eis('NB1b2 ... maar niet vóór 1 s: één losse tik onder 3 km/u beslist niets',
        tb1 != null && tb1 >= 1, '>= 1 s', tb1);
    const nc = log(b1, 'nadering_correctie')[0] || {};
    eis('NB1b3 via de route "dichtbij", met het bewijs in het log',
        nc.vermRoute === 'dichtbij' && nc.hoekN >= 3 && nc.dwarsM <= 4 && nc.voorbijM <= 3
          && String(nc.nieuw) === '7002',
        'dichtbij, n>=3, dwars<=4, voorbij<=3',
        JSON.stringify({ r: nc.vermRoute, n: nc.hoekN, d: nc.dwarsM, v: nc.voorbijM }));
    const hv = log(b1, 'handlock_vervallen')[0] || {};
    eis('NB1b4 de tik-lock gaat eerst los, herkenbaar als vermRoute "nadering"',
        hv.vermRoute === 'nadering' && String(hv.node) === '7001', 'nadering', hv.vermRoute);
    const toast = b1.toasts.find(x => x.label === 'Terug');
    eis('NB1b5 er verschijnt een melding met de knop "Terug"',
        !!toast && /Gewisseld naar licht op \d+ m/.test(toast.tekst), 'Terug-melding',
        toast ? toast.tekst : 'geen');
    const naTerug = b1.rij.filter(r => r.t != null && r.t > tb1 + 2);   // de druk-tik zelf niet
    eis('NB1c "Terug" zet het oude licht vast als keuze van de mens, en de app blijft daar',
        b1.terugGedrukt === true && naTerug.length > 10
          && naTerug.every(r => r.gekozen === 7001 && r.lock === 'tap')
          && log(b1, 'nadering_teruggedraaid').length === 1,
        'terug op W, tap-lock, blijft', b1.terugGedrukt + ' / '
          + [...new Set(naTerug.map(r => r.gekozen + r.lock))].join(','));

    let binnen2 = 0; const ts = [];
    for (let seed = 1; seed <= 20; seed++) {
      const u = await rit({ ...optB, ruisRij: 1, ruisStil: 3, seed: seed * 7919 });
      const t = wissel(u, 7002); ts.push(t); if (t != null && t <= 2) binnen2++;
    }
    eis('NB1d met GPS-ruis (1 m rijdend, 3 m stil): minstens 18 van 20 binnen 2 s',
        binnen2 >= 18, '>= 18', binnen2 + ' — ' + ts.join(','));

    // ═══ NB2 — STADSRING (26 sept 11:04) ═════════════════════
    const S = { W: { id: 7101, x: 9.4, y: 21.0 }, C: { id: 7102, x: -2.0, y: 3.46 } };
    const pS = naderProfiel({ vanAfstand: 125, v0Kmh: 37, a: 1.5, stilS: 20 });
    const optS = { nodes: [S.W, S.C], gekozen: 7101, doel: 7102, profiel: pS, tapBijI: iBij(pS, S.W, 120) };
    const s0 = await rit({ ...optS, zonderNieuweRoute: true });
    const s1 = await rit(optS);
    eis('NB2 licht op 4 m onder -30 graden: binnen 2 s (oud: ' + wissel(s0, 7102) + ' s)',
        wissel(s1, 7102) != null && wissel(s1, 7102) <= 2 && wissel(s0, 7102) >= 3,
        'nieuw <= 2, oud >= 3', wissel(s1, 7102) + ' / ' + wissel(s0, 7102));

    // ═══ NB3 — HET PATROON VAN 25 SEPT (20:13) ═══════════════
    const P3 = { W: { id: 7201, x: -26.4, y: 21.4 }, C: { id: 7202, x: 1.05, y: 14.96 } };
    const p3 = naderProfiel({ vanAfstand: 120, v0Kmh: 38, a: 1.5, stilS: 20 });
    const opt3 = { nodes: [P3.W, P3.C], gekozen: 7201, doel: 7202, profiel: p3, tapBijI: iBij(p3, P3.W, 114) };
    const t30 = await rit({ ...opt3, zonderNieuweRoute: true });
    const t31 = await rit(opt3);
    eis('NB3 licht op 15 m: binnen 2 s via "ver" (oud: ' + wissel(t30, 7202) + ' s)',
        wissel(t31, 7202) != null && wissel(t31, 7202) <= 2 && wissel(t30, 7202) >= 3
          && (log(t31, 'nadering_correctie')[0] || {}).vermRoute === 'ver',
        'nieuw <= 2 via ver, oud >= 3', wissel(t31, 7202) + ' / ' + wissel(t30, 7202));

    // ═══ NB4 — HET GEPASSEERDE VOETGANGERSLICHT ══════════════
    // De app toont J (terecht), P ligt op je pad ervoor. Geen tik: de score
    // houdt J vast, en tijdens het naderen ontstaat er bewijs voor "P ligt
    // dichterbij en vóór je". Dat bewijs mag bij stilstand niet naar P leiden.
    const pP = naderProfiel({ vanAfstand: 120, v0Kmh: 35, a: 1.5, stilS: 20 });
    // J is vastgetikt. Zonder lock wisselt de OUDE score bij stilstand al naar
    // P zodra die 1,20x beter scoort (bij 3,5 m tegen 26,5 m is dat zo) — dat
    // is bestaand gedrag en niet wat hier getoetst wordt. Met de lock kan alleen
    // de nieuwe route J loslaten, en daar gaat het om.
    const voet = (py, jy) => {
      const Jn = { id: 7301, naam: 'J', x: 1.0, y: jy };
      return { nodes: [Jn, { id: 7302, naam: 'P', x: 1.0, y: py }], gekozen: 7301, profiel: pP,
               tapBijI: iBij(pP, Jn, 110) };
    };
    const u4a = await rit(voet(-29, 1));
    eis('NB4a stop bij J: J blijft, al WAS er onderweg bewijs voor P',
        blijft(u4a, 7301) && maxN(u4a) >= 3 && log(u4a, 'nadering_correctie').length === 0,
        'J blijft, n>=3 onderweg', 'n max ' + maxN(u4a) + ', ' + kort(u4a));
    const u4b = await rit(voet(-6, 24));
    const r4b = (log(u4b, 'nadering_geweigerd')[0] || {}).poortReden;
    eis('NB4b stop 6 m voorbij P: geen wissel, geweigerd als voorbij',
        blijft(u4b, 7301) && /^voorbij_/.test(r4b || ''), 'voorbij_*', r4b);
    const u4c = await rit(voet(-3.5, 26.5));
    const r4c = (log(u4c, 'nadering_geweigerd')[0] || {}).poortReden;
    eis('NB4c stop 3,5 m voorbij P: geen wissel, en de afgelegde weg ziet het',
        blijft(u4c, 7301) && r4c === 'voorbij_weg', 'voorbij_weg', r4c);
    const i4d = pP.findIndex(p => p.y >= -20);
    const u4d = await rit({ ...voet(-6, 24), snelheidFactor: 0.5, factorVanafI: i4d });
    const r4d = (log(u4d, 'nadering_geweigerd')[0] || {}).poortReden;
    eis('NB4d iOS meldt de halve snelheid: de afstandsstijging vangt wat de weg mist',
        blijft(u4d, 7301) && r4d === 'voorbij_afstand', 'voorbij_afstand', r4d);
    // Hier gooit de verzamelaar het bewijs al tijdens het rijden weg, zodra de
    // marge onder 8 m zakt: bij stilstand valt er dan niets meer te weigeren.
    // De marge op het beslismoment zelf toetst NB7c.
    const u4e = await rit(voet(-6, 10));
    const r4e = (log(u4e, 'nadering_geweigerd')[0] || {}).poortReden || null;
    eis('NB4e 6 m voorbij P, P 16 m vóór J: geen wissel — het bewijs is al weg of de marge weigert',
        blijft(u4e, 7301) && (r4e === null || r4e === 'marge')
          && (u4e.rij.find(r => r.t === 0) || {}).n === 0,
        'geen wissel, n 0 bij stilstand', (r4e || 'geen weigering') + ', n ' + (u4e.rij.find(r => r.t === 0) || {}).n);
    let naarP = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const u = await rit({ ...voet(-6, 24), ruisRij: 1, ruisStil: 3, seed: seed * 104729 });
      if (!blijft(u, 7301)) naarP++;
    }
    eis('NB4f b met ruis, 10 keer: nooit een wissel naar het gepasseerde licht',
        naarP === 0, 0, naarP);

    // ═══ NB5 — MASTEN OPZIJ (HOSPITAALDREEF) ═════════════════
    const pH = naderProfiel({ vanAfstand: 100, v0Kmh: 40, a: 1.5, stilS: 20 });
    const opzij = (x, y) => {
      const W = { id: 7401, x: 0, y: 45 };
      return { nodes: [W, { id: 7402, x, y }], gekozen: 7401, profiel: pH, tapBijI: iBij(pH, W, 130) };
    };
    const gevallen = [
      ['95 graden op 12,5 m', 12.45, -1.09, null],
      ['97 graden op 10 m',    9.93, -1.22, 'dwars'],
      ['144 graden op 13 m',   7.64, -10.52, null],
      ['kruisend licht 6 m opzij', 6.0, 0.0, 'dwars']
    ];
    for (const [naam, x, y, reden] of gevallen) {
      const u = await rit(opzij(x, y));
      const r = (log(u, 'nadering_geweigerd')[0] || {}).poortReden || null;
      eis('NB5 ' + naam + ': nooit een wissel' + (reden ? ', geweigerd op "' + reden + '"' : ''),
          blijft(u, 7401) && (reden ? r === reden : (r === null || r === 'koers' || r === 'dwars')),
          reden || 'geen wissel', (r || 'geen weigering') + ', n max ' + maxN(u));
    }
    let naarOpzij = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const u = await rit({ ...opzij(6.0, 0.0), ruisRij: 1, ruisStil: 3, seed: seed * 1299709 });
      if (!blijft(u, 7401)) naarOpzij++;
    }
    eis('NB5b het kruisende licht met ruis, 10 keer: nooit een wissel', naarOpzij === 0, 0, naarOpzij);

    // ═══ NB6 — EEN LATE TIK ══════════════════════════════════
    // V11.36.0 A1: tot en met V11.34.3 stond hier "een tik op 8 m wist het
    // bewijs, en daarna geldt het oude gedrag". Precies dat gedrag maakte V11.27.0
    // in het veld onbruikbaar: op 27 september tikte Younes tot 24 m bij 3 km/u,
    // en nam de route in negen uur log nul keer een beslissing (zie NB15). Een tik
    // op het BEELD zegt welke lamp, niet welk kruispunt; het bewijs blijft staan.
    // Een keuze uit de LIJST zegt wel welk kruispunt, en wist het nog steeds (NB6c).
    const L = { W: { id: 7501, x: 0.5, y: 14 }, C: { id: 7502, x: -1.1, y: -1.0 } };
    const pL = naderProfiel({ vanAfstand: 130, v0Kmh: 40, a: 1.5, stilS: 20 });
    const iLaat = pL.findIndex(p => Math.hypot(L.C.x - p.x, L.C.y - p.y) <= 8 && p.kmh >= 3);
    const u6 = await rit({ nodes: [L.W, L.C], gekozen: 7501, doel: 7502, profiel: pL, tapBijI: iLaat });
    const voor = u6.rij.slice(0, iLaat), naTik = u6.rij[iLaat] || {};
    const t6 = wissel(u6, 7502);
    eis('NB6 V11.36.0: een tik op het beeld op 8 m wist het bewijs NIET meer: wissel binnen 2 s',
        Math.max(0, ...voor.map(r => r.n)) >= 3 && naTik.n >= 3 && t6 != null && t6 <= 2
          && log(u6, 'nadering_correctie').length === 1,
        'n>=3 vóór en na, wissel <= 2 s', 'vóór ' + Math.max(0, ...voor.map(r => r.n)) + ', na ' + naTik.n + ', wissel ' + t6);
    const u6c = await rit({ nodes: [L.W, L.C], gekozen: 7501, profiel: pL, lijstBijI: iLaat });
    const naLijst = u6c.rij[iLaat] || {};
    eis('NB6c een keuze uit de lijst op 8 m wist het bewijs wél, en daarna geldt het oude gedrag',
        naLijst.n === 0 && blijft(u6c, 7501) && log(u6c, 'nadering_correctie').length === 0,
        'n 0 na de keuze, W blijft', 'na ' + naLijst.n + ', ' + kort(u6c));

    // NB6b: een keuze uit de lijst zo laat dat er daarna precies TWEE telbare
    // tikken overblijven (C op 12-60 m, rijdend). Twee keer ja is geen bewijs: de
    // route moet weigeren op 'te_weinig'. Zonder deze toets bleef de eis van drie
    // tikken ongetest — elk ander scenario haalde er vijf of meer, en mutatie
    // M16 (één tik genoeg) overleefde daardoor eerst. De plek volgt uit het
    // profiel zelf, zodat de bemonstering hem niet ongemerkt naar 0 of 3 schuift.
    // V11.36.0: tot V11.34.3 was dit een tik op het beeld; die wist het bewijs niet
    // meer (A1). Een lijstkeuze wel, dus die maakt dezelfde situatie.
    const telbaar = (j) => { const p = pB[j], d = Math.hypot(B.C.x - p.x, B.C.y - p.y);
                             return p.kmh >= 3 && d >= 12 && d <= 60; };
    let iTwee = -1;
    for (let i = pB.length - 1; i >= 0 && iTwee < 0; i--) {
      let c = 0; for (let j = i; j < pB.length; j++) if (telbaar(j)) c++;
      if (c === 2) iTwee = i;
    }
    const u6b = await rit({ ...optB, tapBijI: undefined, lijstBijI: iTwee });
    const r6b = (log(u6b, 'nadering_geweigerd')[0] || {});
    eis('NB6b na een late lijstkeuze zijn er maar 2 telbare tikken: geweigerd op "te_weinig", geen wissel',
        blijft(u6b, 7001) && r6b.poortReden === 'te_weinig' && r6b.hoekN >= 1 && r6b.hoekN < 3,
        'te_weinig, n 1-2', (r6b.poortReden || 'geen') + ', n ' + r6b.hoekN);

    // ═══ NB7 — GPS-SPRONGEN ══════════════════════════════════
    // a: de app staat terecht op J (getikt); één sprong tijdens het naderen laat
    //    K even dichterbij en vóór je lijken.
    const pJ = naderProfiel({ vanAfstand: 140, v0Kmh: 40, a: 1.5, stilS: 20 });
    const J = { id: 7601, x: 1, y: 1 }, K = { id: 7602, x: 20, y: 0 };
    const iSp = pJ.findIndex(p => p.y >= -12);
    const u7 = await rit({ nodes: [J, K], gekozen: 7601, profiel: pJ, tapBijI: iBij(pJ, J, 100),
                           sprongen: [{ i: iSp, dx: 18 }] });
    eis('NB7a één sprong tijdens het naderen telt hoogstens één keer, en wisselt niets',
        blijft(u7, 7601) && maxN(u7) <= 1, 'J blijft, n <= 1', 'n max ' + maxN(u7));
    // b: een sprong van 30 m opzij precies op het beslismoment (NB3-opzet).
    const iBes = iStil(p3) + 1;
    const u7b = await rit({ ...opt3, sprongen: [{ i: iBes, dx: 30 }] });
    const r7b = log(u7b, 'nadering_geweigerd')[0] || {};
    const t7b = wissel(u7b, 7202);
    eis('NB7b een sprong op het beslismoment wordt geweigerd op "koers" ...',
        r7b.poortReden === 'koers' && (u7b.rij[iBes] || {}).gekozen === 7201,
        'koers, nog op W', (r7b.poortReden || 'geen') + ', t ' + t7b);
    eis('NB7b2 ... en gooit het bewijs niet weg: de tik erna wisselt alsnog',
        t7b != null && t7b <= 2.5, '<= 2,5 s', t7b);

    // c: een sprong op het beslismoment waardoor het juiste licht nog wél het
    //    dichtstbij is, maar minder dan 8 m: geweigerd op 'marge', de tik erna wisselt.
    const u7c = await rit({ ...opt3, sprongen: [{ i: iBes, dx: -12, dy: 12 }] });
    const r7c = log(u7c, 'nadering_geweigerd')[0] || {};
    eis('NB7c een sprong die de marge onder 8 m drukt: geweigerd op "marge", daarna alsnog',
        r7c.poortReden === 'marge' && (u7c.rij[iBes] || {}).gekozen === 7201
          && wissel(u7c, 7202) != null && wissel(u7c, 7202) <= 2.5,
        'marge, dan <= 2,5 s', (r7c.poortReden || 'geen') + ', t ' + wissel(u7c, 7202));

    // ═══ NB8 — MARGE 6 M ═════════════════════════════════════
    const M = { W: { id: 7701, x: 0.5, y: 9.5 }, C: { id: 7702, x: -1.1, y: 3.5 } };
    const u8 = await rit({ nodes: [M.W, M.C], gekozen: 7701, profiel: pL, tapBijI: iBij(pL, M.W, 116) });
    eis('NB8 licht 6 m dichterbij: nooit bewijs, nooit een wissel',
        blijft(u8, 7701) && maxN(u8) === 0, 'n 0, W blijft', 'n max ' + maxN(u8));

    // ═══ NB12 — ZONDER TIK: 14 M TEGEN 3 M ═══════════════════
    const H = { W: { id: 7801, x: 0.5, y: 14 }, C: { id: 7802, x: 0.5, y: 3 } };
    const pHy = naderProfiel({ vanAfstand: 130, v0Kmh: 35, a: 1.5, stilS: 20 });
    const optH = { nodes: [H.W, H.C], gekozen: 7801, doel: 7802, profiel: pHy };
    const h0 = await rit({ ...optH, zonderNieuweRoute: true });
    const h1 = await rit(optH);
    eis('NB12 geen tik, de hysterese houdt 14 m vast: binnen 2 s (oud: ' + wissel(h0, 7802) + ' s)',
        wissel(h1, 7802) != null && wissel(h1, 7802) <= 2 && wissel(h0, 7802) >= 3,
        'nieuw <= 2, oud >= 3', wissel(h1, 7802) + ' / ' + wissel(h0, 7802));

    // ═══ NB9 — BOUNCE ════════════════════════════════════════
    const iH = iStil(pHy);
    const u9 = await rit({ ...optH, correctieTijdBijI: iH, correctieTijdDelta: -2000 });
    const t9 = wissel(u9, 7802);
    eis('NB9 een correctie 2 s geleden: geweigerd op "bounce", geen wissel binnen 7 s',
        (log(u9, 'nadering_geweigerd')[0] || {}).poortReden === 'bounce' && (t9 == null || t9 > 7),
        'bounce, > 7 s', ((log(u9, 'nadering_geweigerd')[0] || {}).poortReden || 'geen') + ', t ' + t9);

    // ═══ NB10 — OUD BEWIJS ═══════════════════════════════════
    // Bentinckplein-opzet (de oude routes kunnen daar niets), en een wachttijd
    // die kunstmatig tot ~18 s na stilstand loopt. Dan is het bewijs > 15 s oud.
    const iB = iStil(pB);
    const u10 = await rit({ ...optB, correctieTijdBijI: iB, correctieTijdDelta: 8000 });
    eis('NB10 wie pas na 15 s mag beslissen, beslist niet meer: geen wissel',
        blijft(u10, 7001), 'W blijft', kort(u10));

    // ═══ NB11 — GEEN KOERS BEKEND ════════════════════════════
    const u11 = await rit({ ...optH, geenKoers: true });
    const t11 = wissel(u11, 7802);
    eis('NB11 zonder koers geen bewijs; de oude route wisselt na 3 s, zoals altijd',
        maxN(u11) === 0 && log(u11, 'nadering_correctie').length === 0 && t11 != null && t11 >= 2.5,
        'n 0, oud na ~3 s', 'n max ' + maxN(u11) + ', t ' + t11);

    // ═══ NB13 — TWEE MASTEN, OM DE BEURT DE DICHTSTBIJZIJNDE ═
    const C1 = { id: 7901, x: -1.5, y: -1.0 }, C2 = { id: 7902, x: 1.5, y: -1.0 }, W13 = { id: 7903, x: 0.5, y: 20 };
    const pC = naderProfiel({ vanAfstand: 120, v0Kmh: 40, a: 1.5, stilS: 20 });
    const u13 = await rit({ nodes: [W13, C1, C2], gekozen: 7903, profiel: pC, weven: 0.6,
                            tapBijI: iBij(pC, W13, 116) });
    const t13 = u13.rij.find(r => r.gekozen !== 7903);
    eis('NB13 twee masten 3 m uit elkaar wisselen elkaar af: het bewijs telt door, wissel binnen 2 s',
        maxN(u13) >= 3 && t13 && t13.t != null && t13.t <= 2, 'n>=3, <= 2 s',
        'n max ' + maxN(u13) + ', ' + (t13 ? t13.gekozen + ' op ' + t13.t : 'geen wissel'));

    // ═══ NB15 — HET VELD: 27 SEPTEMBER 23:48 ══════════════════
    // Zoals gemeten: de app toonde W (vastgezet door een tik op het beeld op
    // 236 m), het juiste licht C lag recht vooruit, 10 m dichterbij bij de stop.
    // Younes tikte zes keer, de laatste keer vlak voor stilstand (24 m, 3 km/u).
    // Om 23:48:55 wisselde de app, 6 s na de stop, via de oude route.
    const F = { W: { id: 8101, naam: 'veld W', x: -14, y: 24 }, C: { id: 8102, naam: 'veld C', x: 0, y: 14 } };
    const pF = naderProfiel({ vanAfstand: 250, v0Kmh: 47, a: 2.5, stilS: 20 });
    const dC = (p) => Math.hypot(F.C.x - p.x, F.C.y - p.y);
    const iEerst = (af) => pF.findIndex(p => dC(p) <= af);
    const iLaatst = pF.reduce((acc, p, i) => (p.kmh >= 1 ? i : acc), -1);   // de laatste rollende tik
    const tikken = [0, iEerst(184), iEerst(157), iEerst(104), iEerst(68), iLaatst];
    const optF = { nodes: [F.W, F.C], gekozen: 8101, doel: 8102, profiel: pF, tapBijIs: tikken };
    const u15 = await rit(optF);
    const u15o = await rit({ ...optF, oudeTik: true });
    const t15 = wissel(u15, 8102), t15o = wissel(u15o, 8102);
    eis('NB15a vooraf, met de tik van vóór A1 (die het bewijs wiste): wissel pas na 5 s of later, zoals in het veld (6 s)',
        t15o != null && t15o >= 4.5 && log(u15o, 'nadering_correctie').length === 0,
        '>= 5 s, zonder nadering_correctie', 'wissel ' + t15o + ', ' + kort(u15o));
    eis('NB15b V11.36.0: zes tikken tot vlak voor de stop, en toch wissel binnen 2 s via de nadering',
        t15 != null && t15 <= 2 && log(u15, 'nadering_correctie').length === 1 && maxN(u15) >= 3,
        '<= 2 s, n >= 3', 'wissel ' + t15 + ', n max ' + maxN(u15) + ', ' + kort(u15));

    // ═══ NB16 — A2: DE GETIKTE LAMP OVERLEEFT DE CORRECTIE ═══════
    const u16 = await rit({ ...optF, lampBijI: iLaatst });
    const L16 = u16.lamp || {};
    eis('NB16a A2: na de wissel is de getikte lamp dezelfde — hetzelfde object, de sticky, de seed, de plek, de misser-teller',
        wissel(u16, 8102) != null && wissel(u16, 8102) <= 2 && L16.object === true && L16.sticky === true
          && L16.seed === true && L16.cam === true && L16.miss === true,
        'wissel <= 2 s, alles gelijk', 'wissel ' + wissel(u16, 8102) + ', ' + JSON.stringify(L16).slice(0, 160));
    eis('NB16b zonder getikte lamp verandert er niets: na de wissel is er geen tik, zoals altijd',
        !!u15.lamp && u15.lamp.geenTik === true, 'geen tik', JSON.stringify(u15.lamp));
    eis('NB16c elke toestand die aan de tik hangt (let X = null; // { voor: bboxOverride ...) overleeft de wissel — '
          + 'nu de telling (tikTel), straks ook de buren van V11.35.0 (tikBuren)',
        Array.isArray(L16.namen) && L16.namen.includes('tikTel') && L16.refs.length === L16.namen.length
          && L16.refs.every(r => r.zelfde && r.voor),
        'tikTel en alles wat erbij komt', JSON.stringify(L16.refs || []));
    const u16d = await rit({ ...optF, lampBijI: iLaatst, oudeTik: true });
    eis('NB16d de twee oude routes laten de lamp nog wel los (ze zijn gepind, NB14); na A1 komen ze hier niet meer aan de beurt',
        wissel(u16d, 8102) >= 4.5 && !!u16d.lamp && u16d.lamp.object === false,
        'oude route, lamp los', 'wissel ' + wissel(u16d, 8102) + ', object ' + (u16d.lamp && u16d.lamp.object));

    // ═══ NB14 — REGRESSIE ════════════════════════════════════
    // De twee bestaande routes, byte voor byte gelijk aan V11.26.0.
    const refs = [['checkHandLockVerval', '2df4f7ed', 5513], ['checkNodeCorrectieStilstand', '8c801fd8', 4751],
                  ['corrigeerNodeAutomatisch', 'afe7b427', 4118], ['updateDichtbij', 'e82d3c0', 11914],
                  ['vindDichtbij', '2db98dab', 2954]];
    for (const [naam, h, len] of refs) {
      const src = String(window[naam]);
      eis('NB14 ' + naam + ' is byte-gelijk aan V11.26.0', fnv(src) === h && src.length === len,
          h + ' / ' + len, fnv(src) + ' / ' + src.length);
    }
    const g = zc(onGPS);
    const pos = ['updateDichtbij(lat, lon)', 'verzamelNaderingsBewijs(lat, lon)',
                 'checkNaderingsCorrectie(lat, lon)', 'checkNodeCorrectieStilstand(lat, lon)'].map(x => g.indexOf(x));
    eis('NB14b onGPS: updateDichtbij -> bewijs -> beslissing -> de bestaande hercontrole',
        pos.every(p => p > 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), 'op volgorde', pos.join(','));
    // V11.36.0 A1: tot en met V11.34.3 stond hier "een tik (vergrendelNodeHandmatig)
    // wist het naderingsbewijs", op de bron. Nu op het gedrag, en per soort tik.
    const bew14 = { nb: naderBewijs, h: handmatigLockActief, id: handmatigGeselecteerdNodeId,
                    ts: handmatigGeselecteerdTimestamp, a: stilstandAutoLock, ls: localStorage.getItem('sl_opslaglog') };
    const nep14 = () => ({ gekozen: '1', kandidaat: { id: '2', lat: 52, lon: 5 }, n: 3 });
    naderBewijs = nep14(); vergrendelNodeHandmatig(1, 'beeld'); const naBeeld = naderBewijs;
    naderBewijs = nep14(); vergrendelNodeHandmatig(1, 'lijst'); const naLijst14 = naderBewijs;
    naderBewijs = bew14.nb; handmatigLockActief = bew14.h; handmatigGeselecteerdNodeId = bew14.id;
    handmatigGeselecteerdTimestamp = bew14.ts; stilstandAutoLock = bew14.a;
    if (bew14.ls === null) localStorage.removeItem('sl_opslaglog'); else localStorage.setItem('sl_opslaglog', bew14.ls);
    eis('NB14c V11.36.0: een tik op het beeld laat het naderingsbewijs staan, een keuze uit de lijst wist het',
        !!naBeeld && naBeeld.n === 3 && naLijst14 === null, 'beeld: n 3, lijst: leeg',
        'beeld ' + (naBeeld ? 'n ' + naBeeld.n : 'leeg') + ', lijst ' + (naLijst14 ? 'n ' + naLijst14.n : 'leeg'));
    const bewaardLog = localStorage.getItem('sl_opslaglog');
    logOpslagMis('te_kort', { node: 1, dur: 2 });
    let laatste = {};
    try { const a = JSON.parse(localStorage.getItem('sl_opslaglog')); laatste = a[a.length - 1] || {}; } catch (e) {}
    if (bewaardLog === null) localStorage.removeItem('sl_opslaglog'); else localStorage.setItem('sl_opslaglog', bewaardLog);
    eis('NB14d een gewone logregel draagt de nieuwe velden niet: niets is breder geworden',
        laatste.reden === 'te_kort' && !('dwarsM' in laatste) && !('voorbijM' in laatste),
        'geen dwarsM/voorbijM', Object.keys(laatste).filter(k => /dwars|voorbij/.test(k)).join(',') || 'schoon');
    eis('NB14e de nieuwe getallen hergebruiken de bestaande waar dat hetzelfde betekent',
        NODE_NADER_STABIEL_N === HANDTAP_VERVAL_STABIEL_N && NODE_NADER_STIL_MS === 1000
          && NODE_NADER_DWARS_M === 4 && NODE_NADER_VOORBIJ_M === 3 && NODE_NADER_GELDIG_MS === 15000 && NODE_NADER_ROL_KMH === 1
          && /CLUSTER_AFSTAND_M/.test(zc(verzamelNaderingsBewijs))
          && /NODE_HOEK_MIN_AFSTAND_M/.test(zc(checkNaderingsCorrectie)),
        '3 / 1000 / 4 / 3 / 15000', [NODE_NADER_STABIEL_N, NODE_NADER_STIL_MS, NODE_NADER_DWARS_M,
                                      NODE_NADER_VOORBIJ_M, NODE_NADER_GELDIG_MS].join(' / '));
  } finally {
    herstel();
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
