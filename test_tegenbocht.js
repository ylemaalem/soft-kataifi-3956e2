// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tegenbocht.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.13: het licht voor de tegenrichting ook in de bocht en bij
//  kruipen.
//    R1  een getoond tegenlicht dat de app zelf koos, valt toch af (en krijgt
//        geen voorsprong van de hysterese); een getikt of uit de lijst gekozen
//        licht blijft.
//    R3  de regel geldt vanaf 5 km/u, maar onder 10 km/u alleen met de koers
//        van deze GPS-tik (een geldige koers, niet ouder dan TEGEN_VERS_MS).
//  Zelfde veiligheden als V11.37.11: schakelaar, fail-open, nooit als enige
//  kandidaat, getikt of uit de lijst blijft.
//
//  Het stratenplan: x naar het oosten, y naar het noorden, in meters, met eigen
//  nummers en zonder echte plek. M = veldgeval M (STAP 0 van 10 okt), nagebouwd
//  met de afstanden en rijrichtingen uit de kaart en de route uit de logregels
//  (nadering op koers 344, stilstand, langs het licht, bocht naar rechts tot
//  koers 75, kruipen op 5 km/u). r = de rijrichtingen van de eenrichtingswegen
//  door het licht; f = fietslicht.
//
//  TB1  de schakelaars en de constanten
//  TB2  R1 per licht: zelf gekozen valt af, getikt blijft, het onthouden nummer
//  TB3  R3 per koers: 4,9 / 5 / 9,9 / 10 km/u, de koers van deze tik, een oude
//       koers, een ongeldige koers, de bewaarde koers
//  TB4  R3 via onGPS en via de kaartvraag tussen twee tikken
//  TB5  veldgeval M: van 28 naar hoogstens 4 tikken, en wat er overblijft
//  TB6  de vier veldgevallen A tot D (test_tegenrichting TR6), aan en uit
//  TB7  R1 in een rit: getikt, op het beeld getikt, zelf gekozen, enige kandidaat
//  TB8  R3 in een rit: kruipen op 7 km/u, op 4 km/u, zonder koers
//  TB9  de logregel tegen_uit met de reden w
//  TB11 regressie: welke functies veranderen, en dat de rest byte-gelijk is
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tegenbocht.js';
//      document.head.appendChild(s);
//      s.onload = () => testTegenbocht().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
// opt: { nodes: [{ id, x, y, f, r }], start, uit (de hele tegenrichting-regel uit), r13uit (alleen R1 en R3 uit),
//        punten: [{ x, y, kmh, koers?, tik?, beeld?, los?, kaart? }] } — één GPS-tik per punt, 1 s ertussen.
// tik: kies dit licht uit de lijst; beeld: tik op het beeld (het getoonde licht); los: het slot vervalt;
// kaart: geen GPS-tik maar, zoveel ms na de vorige tik, de kaartvraag die updateDichtbij aanroept.
async function tegenBochtRitBinnen(opt) {
  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.uit) window.tegenUitAan = () => false;
  if (opt.r13uit) window.tegenR13Aan = () => false;
  fietsLichten = opt.lijst === null ? null : new Set(opt.nodes.filter(n => n.f).map(n => String(n.id)));
  try { for (const k of ['sl_wissellog', 'sl_opslaglog', 'sl_regellog', TIKLOG_SLEUTEL]) localStorage.setItem(k, '[]'); } catch (e) {}
  tikLogArr = null; tikLogStop = false; tikLogVorige = { tak: null, t: 0 }; tikLogLevend = null;
  osmCache = opt.nodes.map(n => ({ id: n.id, naam: String(n.id), ...LL(n.x, n.y), eenrichting: n.r || null }));
  cacheGeladen = true; cacheBezig = false; cacheCentrum = LL(0, 0);
  eersteGPSVerwerkt = true;
  clusterNodes = new Set();
  const start = opt.start != null ? osmCache.find(n => n.id === opt.start) : null;
  dichtstbijOSM = start ? { ...start, afstand: 100 } : null; vorigOsmId = start ? start.id : null;
  handmatigLockActief = false; stilstandAutoLock = false;
  handmatigGeselecteerdNodeId = null; handmatigGeselecteerdTimestamp = 0;
  stilstandSinds = 0; laatsteNodeCorrectieTijd = 0; laatsteNodeWisselTijd = 0;
  headingBuffer.length = 0;
  hoekStabielReset(); handLockVervalReset(); naderBewijsReset();
  wisselStaat = null; wisselTik = null; a3Reeks = null; a3LosTijd = 0;
  regelReset(); achterReset(); achterLosTijd = 0; geenLichtSinds = 0;
  tikSlotMerk = null; snelReset();
  tegenKoersTik = null; tegenKoersTikT = 0; tegenHandId = null; tegenLogLaatst.clear();
  const rij = [];
  let vorige = null;
  for (const p of opt.punten) {
    const q = LL(p.x, p.y);
    let fout = null;
    if (p.kaart) {
      klok += p.kaart;
      try { updateDichtbij(q.lat, q.lon); } catch (e) { fout = String(e && e.message || e).slice(0, 120); }
    } else {
      klok += 1000;
      if (p.tik != null) selecteerNodeHandmatig(p.tik);
      if (p.beeld && dichtstbijOSM) vergrendelNodeHandmatig(dichtstbijOSM.id, 'beeld');
      if (p.los) { handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null; }
      const v = p.kmh / 3.6;
      let h = (vorige && (p.x !== vorige.x || p.y !== vorige.y)) ? (Math.atan2(p.x - vorige.x, p.y - vorige.y) * 180 / Math.PI + 360) % 360 : 1;
      if (Math.round(h) === 0) h = 1;
      const koers = ('koers' in p) ? p.koers : (v > 0 ? h : NaN);
      try {
        await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: koers }, timestamp: klok });
        tikLogWaak();
      } catch (e) { fout = String(e && e.message || e).slice(0, 120); }
      vorige = p;
    }
    rij.push({ y: Math.round(p.y * 10) / 10, x: Math.round(p.x * 10) / 10, kmh: p.kmh, app: dichtstbijOSM ? dichtstbijOSM.id : null,
               puur: puurDichtsteNodeCache ? puurDichtsteNodeCache.id : null, regel: regelStaat.keuze == null ? null : Number(regelStaat.keuze),
               slot: handmatigLockActief ? 1 : 0, koers: tegenKoers(), tik: tegenKoersTik, hand: tegenHandId, fout });
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  return { rij, op: lees('sl_opslaglog') };
}

// ── Draait IN een iframe: R1 en R3 per licht en per koers ────
async function tegenBochtEenheidBinnen() {
  const u = {};
  let klok = 1790000000000;
  Date.now = () => klok;
  const T = { id: 2, lat: 52, lon: 5, eenrichting: [180] }, M = { id: 3, lat: 52, lon: 5, eenrichting: [0] };
  const zet = (koers, kmh, getoond, oud = 0) => { tegenKoersTik = koers; snelheidKmh = kmh; dichtstbijOSM = getoond || null; tegenKoersTikT = klok - oud; };
  // R1
  zet(0, 40, T); tegenHandId = null; u.r1Zelf = tegenSluitUit(T); u.r1IsTegen = tegenIsTegen(T);
  tegenHandId = '2'; u.r1Hand = tegenSluitUit(T);
  tegenHandId = '9'; u.r1AnderHand = tegenSluitUit(T);
  tegenHandId = null; zet(0, 40, M); u.r1Mee = tegenSluitUit(M);
  zet(0, 40, M); u.r1NietGetoond = tegenSluitUit(T);
  zet(null, 40, T); u.r1GeenKoers = tegenSluitUit(T);
  zet(0, 40, { ...T, eenrichting: null }); u.r1FailOpen = tegenSluitUit({ ...T, eenrichting: null });
  // het onthouden nummer
  tegenHandId = '5'; dichtstbijOSM = { id: 5 }; tegenTikNoteer(); u.noteerZelfde = tegenHandId;
  dichtstbijOSM = { id: 6 }; tegenTikNoteer(); u.noteerAnder = tegenHandId;
  tegenHandId = '5'; dichtstbijOSM = null; tegenTikNoteer(); u.noteerGeen = tegenHandId;
  u.noteerTijd = tegenKoersTikT === klok;
  try { tegenHandId = null; vergrendelNodeHandmatig(7, 'beeld'); u.vergrendelBeeld = tegenHandId;
        vergrendelNodeHandmatig('8', 'lijst'); u.vergrendelLijst = tegenHandId; } catch (e) { u.vergrendelFout = String(e && e.message || e).slice(0, 120); }
  handmatigLockActief = false; handmatigGeselecteerdNodeId = null; tegenHandId = null;
  // R3
  const k = (kmh, oud = 0, koers = 90) => { zet(koers, kmh, null, oud); return tegenKoers(); };
  u.r3 = [k(4.9), k(5), k(7), k(9.9), k(10), k(40)];
  u.r3Oud = [k(7, TEGEN_VERS_MS), k(7, TEGEN_VERS_MS + 1), k(9.9, 5000), k(10, 5000), k(40, 60000)];
  u.r3Ongeldig = [k(7, 0, null), k(7, 0, NaN), k(7, 0, -1)];
  huidigeRichting = 90; headingBuffer.length = 0; headingBuffer.push(90, 90, 90);
  u.r3Bewaard = k(7, 0, null);
  zet(0, 7, null); u.r3Sluit = tegenSluitUit(T);
  // de reden
  zet(0, 40, T); u.reden = [tegenReden(T), tegenReden(M)];
  zet(0, 7, T); u.reden.push(tegenReden(T), tegenReden(M));
  // de schakelaars
  const r13 = window.tegenR13Aan, hoofd = window.tegenUitAan;
  window.tegenR13Aan = () => false;
  zet(0, 40, T); tegenHandId = null; u.uitR1 = tegenSluitUit(T); u.uitR3 = k(7); u.uitBasis = k(10);
  window.tegenR13Aan = r13; window.tegenUitAan = () => false;
  u.hoofdUit = tegenR13Aan(); zet(0, 40, T); u.hoofdR1 = tegenSluitUit(T); u.hoofdR3 = k(7);
  window.tegenUitAan = hoofd;
  u.aan = tegenR13Aan();
  return u;
}

// ── Draait op de testpagina ──────────────────────────────────
async function testTegenbocht() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
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
  const bron = new URL('test_tegenbocht.js', location.href).href;
  const pagina = location.pathname;
  const inFrame = async (functie, opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?bocht=' + Math.random();
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
      return JSON.parse(JSON.stringify(await w[functie](opt)));
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], op: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const rit = (opt) => inFrame('tegenBochtRitBinnen', opt);
  const lijn = (vanY, totY, kmh, x = 0) => { const p = [], v = kmh / 3.6; for (let y = vanY; y <= totY + 1e-9; y += v) p.push({ x, y, kmh }); return p; };
  const fouten = (r) => r.fout || (r.rij.find(x => x.fout) || {}).fout || null;
  const keten = (r) => { const k = []; for (const x of r.rij) { const l = k[k.length - 1]; if (l && l[0] === x.app) l[1]++; else k.push([x.app, 1]); } return k.map(([a, n]) => a + '(' + n + ')'); };
  const verschil = (a, b, veld = 'app') => a.rij.filter((x, i) => !b.rij[i] || b.rij[i][veld] !== x[veld]).length;
  const alleVerschil = (a, b) => verschil(a, b) + verschil(a, b, 'puur') + verschil(a, b, 'regel');
  const knopen = (rijen) => rijen.map(([id, x, y, f, r]) => ({ id, x, y, f, r }));
  const hoekT = (v, k) => Math.abs(((v - k) % 360 + 540) % 360 - 180);
  const tegenBij = (n, k) => !!n && Array.isArray(n.r) && n.r.length > 0 && k != null && n.r.every(v => hoekT(v, k) > 135);
  const pad = (rijen) => rijen.map(([x, y, kmh]) => ({ x, y, kmh }));
  const tegenUit = (r) => r.op.filter(x => x.reden === 'tegen_uit');

  // ═══ TB1-TB3 — de schakelaars, R1 en R3 per licht ════════════
  const u = await inFrame('tegenBochtEenheidBinnen', {});
  eis('TB1a de schakelaar TEGEN_R13_ACTIEF staat aan; R1 en R3 lopen via tegenR13Aan(), en die via tegenUitAan() (de schakelaar van V11.37.11)',
      !u.fout && TEGEN_R13_ACTIEF === true && u.aan === true && /TEGEN_R13_ACTIEF && tegenUitAan\(\)/.test(String(tegenR13Aan))
        && /tegenR13Aan\(\)/.test(String(tegenR1)) && /tegenR13Aan\(\)/.test(String(tegenR3)),
      'aan, en beide via de schakelaar', u.fout || String(u.aan));
  eis('TB1b de grenzen: TEGEN_R3_KMH 5, TEGEN_MIN_KMH 10 (ongewijzigd), TEGEN_VERS_MS 1500, TEGEN_HOEK 135 (ongewijzigd)',
      TEGEN_R3_KMH === 5 && TEGEN_MIN_KMH === 10 && TEGEN_VERS_MS === 1500 && TEGEN_HOEK === 135,
      '5 / 10 / 1500 / 135', [TEGEN_R3_KMH, TEGEN_MIN_KMH, TEGEN_VERS_MS, TEGEN_HOEK].join(' / '));
  eis('TB1c R1 en R3 uit (tegenR13Aan): het getoonde zelf gekozen tegenlicht blijft, 7 km/u telt niet, 10 km/u wel, precies als V11.37.11',
      u.uitR1 === false && u.uitR3 === null && u.uitBasis === 90, 'false / null / 90', [u.uitR1, u.uitR3, u.uitBasis].join(' / '));
  eis('TB1d de schakelaar van V11.37.11 uit: dan ook R1 en R3 uit', u.hoofdUit === false && u.hoofdR1 === false && u.hoofdR3 === null,
      'false / false / null', [u.hoofdUit, u.hoofdR1, u.hoofdR3].join(' / '));
  eis('TB2a R1: koers 0 bij 40 km/u, het getoonde licht op een weg naar 180 dat de app zelf koos, valt af; tegenIsTegen zegt ja',
      u.r1Zelf === true && u.r1IsTegen === true, 'true / true', u.r1Zelf + ' / ' + u.r1IsTegen);
  eis('TB2b R1: hetzelfde licht, getikt of uit de lijst gekozen (tegenHandId), blijft; een ander getikt nummer helpt niet',
      u.r1Hand === false && u.r1AnderHand === true, 'false / true', u.r1Hand + ' / ' + u.r1AnderHand);
  eis('TB2c R1 raakt alleen een tegenlicht: een getoond licht op een weg naar 0 blijft; zonder koers en zonder eenrichting (fail-open) valt niets af; een niet-getoond tegenlicht valt af zoals in V11.37.11',
      u.r1Mee === false && u.r1GeenKoers === false && u.r1FailOpen === false && u.r1NietGetoond === true,
      'false / false / false / true', [u.r1Mee, u.r1GeenKoers, u.r1FailOpen, u.r1NietGetoond].join(' / '));
  eis('TB2d het onthouden nummer: blijft zolang de app dat licht toont, vervalt bij een ander licht of geen licht; tegenTikNoteer zet de tijd',
      u.noteerZelfde === '5' && u.noteerAnder === null && u.noteerGeen === null && u.noteerTijd === true,
      "'5' / null / null / true", [u.noteerZelfde, u.noteerAnder, u.noteerGeen, u.noteerTijd].join(' / '));
  eis('TB2e een tik op het beeld en een keuze uit de lijst (vergrendelNodeHandmatig) onthouden het nummer, als tekst',
      !u.vergrendelFout && u.vergrendelBeeld === '7' && u.vergrendelLijst === '8', "'7' / '8'", u.vergrendelFout || u.vergrendelBeeld + ' / ' + u.vergrendelLijst);
  eis('TB3a R3: met de koers van deze tik telt 4,9 km/u niet, 5, 7 en 9,9 km/u wel, en 10 en 40 km/u zoals altijd',
      JSON.stringify(u.r3) === '[null,90,90,90,90,90]', '[null,90,90,90,90,90]', JSON.stringify(u.r3));
  eis('TB3b R3: een koers van 1500 ms oud telt nog, van 1501 ms niet meer, onder 10 km/u; vanaf 10 km/u verandert niets (ook 5 en 60 s oud)',
      JSON.stringify(u.r3Oud) === '[90,null,null,90,90]', '[90,null,null,90,90]', JSON.stringify(u.r3Oud));
  eis('TB3c R3: zonder geldige koers in deze tik (null, NaN, -1) niet, ook niet als huidigeRichting en de gladde koers nog 90 bewaren',
      JSON.stringify(u.r3Ongeldig) === '[null,null,null]' && u.r3Bewaard === null, '[null,null,null] / null', JSON.stringify(u.r3Ongeldig) + ' / ' + u.r3Bewaard);
  eis('TB3d R3: koers 0 bij 7 km/u, een licht op een weg naar 180 valt af', u.r3Sluit === true, 'true', String(u.r3Sluit));
  eis("TB3e de reden: het getoonde licht bij 40 km/u R1, een ander licht geen; bij 7 km/u R1R3 en R3",
      JSON.stringify(u.reden) === '["R1",null,"R1R3","R3"]', '["R1",null,"R1R3","R3"]', JSON.stringify(u.reden));

  // ═══ TB4 — R3 via onGPS en via de kaartvraag ═══════════════
  const kn4 = knopen([[9828001, 0, 300, 0, [0]]]);
  const t4 = (koers, kmh) => ({ x: 0, y: 0, kmh, koers });
  const r4 = await rit({ nodes: kn4, punten: [t4(90, 4.9), t4(90, 5), t4(90, 9.9), t4(NaN, 7), t4(null, 7), t4(-1, 7), t4(undefined, 7), t4(90, 7),
    { x: 0, y: 0, kmh: 7, kaart: 1000 }, t4(90, 7), { x: 0, y: 0, kmh: 7, kaart: 2000 }, t4(90, 12), { x: 0, y: 0, kmh: 12, kaart: 2000 }] });
  const k4 = r4.rij.map(x => x.koers);
  eis('TB4a via onGPS: 4,9 km/u niet, 5 en 9,9 wel; bij 7 km/u tellen NaN, null, -1 en ontbrekend niet, 90 wel',
      !fouten(r4) && JSON.stringify(k4.slice(0, 8)) === '[null,90,90,null,null,null,null,90]', '[null,90,90,null,null,null,null,90]', fouten(r4) || JSON.stringify(k4.slice(0, 8)));
  eis('TB4b de kaartvraag tussen twee tikken: 1 s na de tik telt de koers nog, 2 s erna niet meer onder 10 km/u; bij 12 km/u wel (zoals V11.37.11)',
      !fouten(r4) && k4[8] === 90 && k4[10] === null && k4[12] === 90, '90 / null / 90', fouten(r4) || [k4[8], k4[10], k4[12]].join(' / '));

  // ═══ TB5 — veldgeval M ══════════════════════════════════
  // 9827001 = het licht waar Younes stilstond; 9827003 = het licht dat de app vóór de bocht koos (toen een dwarslicht, na de
  // bocht tegen de koers in); 9827024 = het tweede tegenlicht (kruipen); 9827023 = het licht op die weg in de goede richting.
  const MERC = {
    nodes: knopen([[9827001, 0, 0, 0, [344]], [9827002, -39.3, 18.5, 0, null], [9827003, 9.6, 40, 0, [256]], [9827004, -2.4, 45.6, 1, null], [9827005, -29.2, 49.8, 0, [162]], [9827006, -245.8, 268.3, 0, null], [9827007, -252.9, 272.6, 1, null], [9827008, -270.1, 277.1, 0, [76]], [9827009, -240.5, 281.2, 1, null], [9827010, -266.2, 296.1, 1, null], [9827011, -236.7, 296.8, 0, [264]], [9827012, -250.3, 301.4, 1, null], [9827013, -256.8, 304.7, 0, null], [9827014, -94.8, 307, 0, [347]], [9827015, -117.1, 310.6, 1, null], [9827016, -131.5, 316.8, 0, [83]], [9827017, -92.3, 320.8, 1, null], [9827018, -126.2, 331.3, 1, null], [9827019, -87.4, 335.9, 0, [255]], [9827020, -102.7, 342.6, 1, null], [9827021, -124.1, 346, 0, [163]], [9827022, 122.5, 391.3, 1, null], [9827023, 118, 392.4, 0, [74]], [9827024, 124.1, 400.5, 0, [254]], [9827025, 119.5, 401.7, 1, null]]),
    pad: pad([[44.1, -153.8, 25], [42.2, -147.1, 25], [40.2, -140.3, 25], [38.3, -133.6, 25], [36.4, -126.9, 25], [34.5, -120.2, 25], [32.5, -113.4, 25], [30.6, -106.7, 25], [28.7, -100, 25], [26.7, -93.2, 25], [24.8, -86.5, 25], [22.9, -79.8, 25], [20.9, -73.1, 25], [19, -66.3, 25], [17.1, -59.6, 25], [15.2, -52.9, 25], [13.2, -46.1, 25], [11.3, -39.4, 25], [9.4, -32.7, 25], [7.4, -26, 25], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [6.6, -23.1, 0], [5.5, -19.2, 8], [3.9, -13.5, 8], [1.9, -6.7, 8], [-0.3, 1, 11], [-1.9, 6.7, 11], [-3.3, 15.6, 14], [-2, 18.9, 13], [1.5, 23.5, 16], [7.5, 27, 20], [14.5, 28.8, 22], [23.4, 29.9, 22], [29.3, 31.5, 22], [34.7, 32.9, 20], [38.7, 34, 15], [41.4, 34.7, 10], [43.5, 35.3, 8], [45.1, 35.7, 6], [46.5, 36.1, 5], [47.8, 36.4, 5], [49.2, 36.8, 5], [50.5, 37.2, 5], [52.6, 37.7, 8], [55.9, 38.6, 12], [59.9, 39.7, 15], [65, 41, 19], [70.1, 42.4, 19], [75.2, 43.8, 19], [80.6, 45.2, 20], [86.2, 46.7, 21], [91.8, 48.2, 21], [97.5, 49.7, 21], [102.8, 51.2, 20], [106.8, 52.3, 15], [109.5, 53, 10], [110.9, 53.3, 5], [111.7, 53.6, 3]]),
  };
  const mOpt = { nodes: MERC.nodes, punten: MERC.pad, start: 9827001 };
  const mAan = await rit(mOpt), mUit = await rit({ ...mOpt, r13uit: true });
  // Tegen ten opzichte van de weg ná de bocht (koers 75): de lichten op de rijbanen naar het westen.
  const mTegen = new Set(MERC.nodes.filter(n => tegenBij(n, 75)).map(n => n.id));
  const iBocht = MERC.pad.findIndex(p => p.x === 23.4 && p.y === 29.9);   // de bocht af, koers ~75
  const tel = (r, van = 0) => r.rij.slice(van).filter(x => mTegen.has(x.app)).length;
  const mUitleg = `aan: ${keten(mAan).join(' > ')} | uit: ${keten(mUit).join(' > ')}`;
  eis('TB5a veldgeval M met R1 en R3 uit: zoals V11.37.12 28 tikken met een licht voor de tegenrichting in beeld (8 van 9827003, 20 van 9827024)',
      !fouten(mUit) && tel(mUit) === 28 && mUit.rij.filter(x => x.app === 9827003).length === 8 && mUit.rij.filter(x => x.app === 9827024).length === 20,
      '28 (8 + 20)', fouten(mUit) || tel(mUit) + ' | ' + mUitleg);
  eis('TB5b veldgeval M met R1 en R3 aan: hoogstens 4 tikken, en vanaf de bocht geen enkele meer; 9827024 komt niet meer in beeld',
      !fouten(mAan) && tel(mAan) <= 4 && tel(mAan, iBocht) === 0 && !mAan.rij.some(x => x.app === 9827024),
      '<= 4, na de bocht 0', fouten(mAan) || tel(mAan) + ' / ' + tel(mAan, iBocht) + ' | ' + mUitleg);
  // Wat overblijft: vóór de bocht, toen het licht bij de koers van die tik nog geen tegenlicht was (dwars).
  const mRest = mAan.rij.map((x, i) => ({ x, i })).filter(({ x }) => mTegen.has(x.app));
  const mRestDwars = mRest.filter(({ x, i }) => i < iBocht && !tegenBij(MERC.nodes.find(n => n.id === x.app), x.tik));
  eis('TB5c de tikken die overblijven vallen vóór de bocht, toen het licht bij de koers van die tik nog dwars stond (de regel kon nog niets zien)',
      mRest.length === mRestDwars.length, 'alle vóór de bocht en dwars', mRest.map(({ x, i }) => i + ':' + x.app + '@' + (x.tik == null ? '-' : Math.round(x.tik))).join(', ') || 'geen');
  const mLog = tegenUit(mAan);
  eis('TB5d de logregel noemt de reden: R1 (het getoonde licht valt af in de bocht) en R3 (kruipen onder 10 km/u)',
      mLog.some(r => r.tegen && /R1/.test(r.tegen.w || '')) && mLog.some(r => r.tegen && /R3/.test(r.tegen.w || '')),
      'R1 en R3', mLog.map(r => r.node + ':' + r.element + ':' + (r.tegen && r.tegen.w)).join(', '));
  // Zonder eenrichting (alle wegen in twee richtingen) is er niets te doen: per tik gelijk.
  const mTwee = { ...mOpt, nodes: MERC.nodes.map(n => ({ ...n, r: null })) };
  const mTweeAan = await rit(mTwee), mTweeUit = await rit({ ...mTwee, r13uit: true });
  eis('TB5e (de rest verandert niet) dezelfde rit zonder eenrichtingswegen: per GPS-tik gelijk aan R1 en R3 uit (app, puur, regel)',
      !fouten(mTweeAan) && !fouten(mTweeUit) && alleVerschil(mTweeAan, mTweeUit) === 0, '0 verschillen', fouten(mTweeAan) || fouten(mTweeUit) || String(alleVerschil(mTweeAan, mTweeUit)));

  // ═══ TB6 — de vier veldgevallen A tot D ═══════════════════
  // Dezelfde opstellingen als test_tegenrichting TR6 (daar uitgelegd); de koers is overal noordwaarts behalve in de bocht van B.
  const VELD = {
    'A rechtdoor': { van: 9821007, tegen: 9821012, nodes: knopen([[9821001, -6.1, -161.8, 0, [9]], [9821002, 7.8, -147, 1, null], [9821003, 17.9, -138.5, 0, null], [9821004, -16.7, -122.3, 1, null], [9821005, 4.5, -122.2, 1, null], [9821006, -13, -113.5, 0, [180]], [9821007, -2, -5.7, 0, [2]], [9821008, -17.7, 2.2, 1, null], [9821009, -29.1, 17.2, 0, null], [9821010, -22.4, 30.6, 1, null], [9821011, 3.6, 32.9, 1, null], [9821012, -15, 40, 0, [181]], [9821013, -1.3, 266.9, 0, [19]], [9821014, -11.8, 280.1, 1, null], [9821015, 22.5, 298, 1, null], [9821016, -11.8, 306.1, 0, null], [9821017, -1.7, 311.5, 1, null], [9821018, 13.3, 315, 0, [220]], [9821019, 24.5, 317.4, 0, [183]]]) },
    'B wissel in de bocht': { van: 9822015, tegen: 9822021, pad: [...lijn(-170, -25, 30).map(p => ({ x: -p.y, y: -33, kmh: 30 })), { x: 12, y: -31, kmh: 20 }, { x: 4, y: -25, kmh: 20 }, ...lijn(-18, 330, 36)], nodes: knopen([[9822001, -325.8, -202.8, 0, [4]], [9822002, -342.6, -193.2, 1, null], [9822003, -316.2, -187.8, 1, null], [9822004, -309.9, -182.4, 0, null], [9822005, -347.9, -181.5, 0, null], [9822006, -342.7, -176.4, 1, null], [9822007, -320.5, -173.3, 1, null], [9822008, -334.1, -164.9, 0, [192]], [9822009, -8.5, -63.1, 0, null], [9822010, -320.7, -58.7, 0, [11]], [9822011, -332.9, -49.1, 1, null], [9822012, -310.4, -46.9, 1, null], [9822013, -35.1, -43.9, 0, [90]], [9822014, -346.2, -42.6, 0, [91]], [9822015, 21.2, -31.5, 0, [272]], [9822016, -300, -26.8, 0, [275]], [9822017, -336.3, -23.3, 1, null], [9822018, -312.4, -20.2, 1, null], [9822019, -22.8, -19.7, 1, null], [9822020, -325.2, -10.9, 0, [183]], [9822021, -13.9, -10, 0, [184]], [9822022, -315.4, 202, 0, [2]], [9822023, -313.1, 205.9, 1, null], [9822024, -323.8, 206.2, 1, null], [9822025, -321.2, 210.3, 0, [182]]]) },
    'C enige kandidaat vooruit': { van: 9823013, tegen: 9823026, nodes: knopen([[9823001, -4.5, -245.4, 0, [165]], [9823002, -0.7, -235.2, 0, [162]], [9823003, 79.7, -223.4, 0, [289]], [9823004, 78.5, -216.9, 1, null], [9823005, 59.2, -211.2, 0, [306,310,340]], [9823006, -25.5, -199.9, 1, null], [9823007, 1.4, -195.7, 0, [234]], [9823008, 35, -192.5, 0, [289]], [9823009, -22.5, -188.3, 0, [172]], [9823010, 25.4, -178.6, 0, [310]], [9823011, 22.8, -169.5, 1, null], [9823012, 17.9, -165.6, 1, null], [9823013, 0, -58, 0, [0]], [9823014, 10.5, -48.9, 1, null], [9823015, -28.5, -45.4, 1, null], [9823016, 4.2, -40.2, 1, null], [9823017, -356.8, -38.1, 1, null], [9823018, -38.5, -36.6, 1, null], [9823019, -42.6, -31.8, 0, [89]], [9823020, -359.6, -31.4, 0, null], [9823021, -347.3, -31.4, 0, null], [9823022, -356.9, -25.4, 1, null], [9823023, 4.3, -18.8, 1, null], [9823024, -38.5, -18.7, 1, null], [9823025, -30, -10.3, 1, null], [9823026, -22.4, -9, 0, [179]]]) },
    'D rechtdoor': { van: 9824007, tegen: 9824012, nodes: knopen([[9824001, 3.5, -160.3, 0, [1]], [9824002, -15.1, -153.2, 1, null], [9824003, 10.8, -151, 1, null], [9824004, 17.5, -137.5, 0, null], [9824005, 6.2, -122.6, 1, null], [9824006, -9.6, -114.6, 0, [182]], [9824007, 1.5, -6.8, 0, [0]], [9824008, -16.1, 1.9, 1, null], [9824009, 5.2, 2, 1, null], [9824010, -29.4, 18.2, 0, null], [9824011, -19.4, 26.7, 1, null], [9824012, -5.5, 41.5, 0, [189]], [9824013, 59.7, 240.6, 0, [20]], [9824014, 73.9, 253.4, 1, null], [9824015, 44.7, 254.8, 1, null], [9824016, 37.4, 260.3, 1, null], [9824017, 86.4, 264.1, 0, [287]], [9824018, 39.8, 268, 0, [114]], [9824019, 47.2, 269.7, 0, [209]], [9824020, 79.3, 275.2, 1, null], [9824021, 66.7, 289.3, 0, [204]]]) },
  };
  const veld = {};
  for (const [naam, c] of Object.entries(VELD)) {
    const opt = { nodes: c.nodes, start: c.van, punten: c.pad || lijn(-200, 330, 36) };
    const aan = await rit(opt), uit = await rit({ ...opt, r13uit: true });
    veld[naam.slice(0, 1)] = { naam, c, aan, uit, nAan: aan.rij.filter(x => x.app === c.tegen).length, nUit: uit.rij.filter(x => x.app === c.tegen).length };
  }
  const vUitleg = (v) => `${v.naam}: aan ${v.nAan}, uit ${v.nUit}, verschil ${alleVerschil(v.aan, v.uit)} | aan: ${keten(v.aan).join(' > ')} | uit: ${keten(v.uit).join(' > ')}`;
  const vFout = Object.values(veld).map(v => fouten(v.aan) || fouten(v.uit)).find(Boolean);
  eis('TB6a A en D (36 km/u rechtdoor): per GPS-tik gelijk aan R1 en R3 uit (app, puur, regel)',
      !vFout && ['A', 'D'].every(k => alleVerschil(veld[k].aan, veld[k].uit) === 0), '0 verschillen', vFout || ['A', 'D'].map(k => vUitleg(veld[k])).join(' || '));
  // C: het tegenlicht is daar alleen in beeld als enige kandidaat vooruit; dat blijft. R1 haalt het wel uit het puur
  // dichtstbijzijnde licht en de schaduwregel zodra daar binnen 400 m een ander autolicht is (die kijken niet alleen vooruit).
  const vC = veld.C, cTeg = vC.c.tegen;
  const cAnders = ['puur', 'regel'].flatMap(v => vC.aan.rij.map((x, i) => ({ v, i, a: x[v], u: vC.uit.rij[i] && vC.uit.rij[i][v] })).filter(d => d.a !== d.u));
  eis('TB6c C (het tegenlicht als enige kandidaat vooruit): de getoonde keuze per GPS-tik gelijk; puur en schaduwregel verschillen alleen waar ze zonder R1 het tegenlicht hadden',
      !vFout && verschil(vC.aan, vC.uit) === 0 && cAnders.every(d => d.u === cTeg && d.a !== cTeg), 'app gelijk, de rest alleen minder tegenlicht',
      vFout || cAnders.map(d => d.v + '@' + d.i + ':' + d.u + '->' + d.a).join(', ') + ' | ' + vUitleg(vC));
  eis('TB6b B (de oude nabouw van veldgeval M, wissel in de bocht): met R1 korter met het tegenlicht in beeld dan zonder',
      !vFout && veld.B.nAan < veld.B.nUit, 'aan < uit', vFout || vUitleg(veld.B));

  // ═══ TB7 — R1 in een rit ══════════════════════════════════
  // Een licht voor de tegenrichting linksvoor (-15, 60), een licht vooruit in de goede richting (0, 150), en nog een (3, 400).
  const kn7 = knopen([[9829001, -15, 60, 0, [180]], [9829002, 0, 150, 0, [0]], [9829003, 3, 400, 0, [0]]]);
  const p7 = lijn(-100, 40, 36);
  const lijst7 = p7.map((p, i) => (i === 3 ? { ...p, tik: 9829001 } : i === 10 ? { ...p, los: true } : p));
  const r7a = await rit({ nodes: kn7, punten: lijst7 });
  eis('TB7a Younes kiest het tegenlicht uit de lijst: het blijft staan, ook na het vervallen van het slot, bij 36 km/u (R1 laat het staan)',
      !fouten(r7a) && r7a.rij.slice(3).every(x => x.app === 9829001) && r7a.rij[10].slot === 0 && r7a.rij.slice(3).every(x => x.hand === '9829001'),
      'vanaf de keuze elke tik 9829001', fouten(r7a) || keten(r7a).join(' > '));
  const beeld7 = p7.map((p, i) => (i === 0 ? { ...p, beeld: true } : i === 6 ? { ...p, los: true } : p));
  const r7b = await rit({ nodes: kn7, punten: beeld7, start: 9829001 });
  eis('TB7b de app toont het tegenlicht en Younes tikt erop in het beeld: het blijft staan, ook na het vervallen van het slot',
      !fouten(r7b) && r7b.rij.every(x => x.app === 9829001) && r7b.rij[6].slot === 0, 'elke tik 9829001', fouten(r7b) || keten(r7b).join(' > '));
  const r7c = await rit({ nodes: kn7, punten: p7, start: 9829001 }), r7cU = await rit({ nodes: kn7, punten: p7, start: 9829001, r13uit: true });
  eis('TB7c de app toonde het tegenlicht zelf: met R1 valt het bij de eerste tik met koers af en komt 9829002; met R1 uit blijft het (zoals V11.37.12)',
      !fouten(r7c) && !fouten(r7cU) && r7c.rij.every(x => x.app !== 9829001) && r7c.rij[0].app === 9829002 && r7cU.rij[0].app === 9829001,
      'aan: nooit 9829001; uit: eerst 9829001', fouten(r7c) || fouten(r7cU) || 'aan: ' + keten(r7c).join(' > ') + ' | uit: ' + keten(r7cU).join(' > '));
  // Nooit als enige kandidaat: binnen 400 m alleen tegenlichten en een fietslicht; het volgende autolicht ligt op 900 m.
  const kn7d = knopen([[9829101, -15, 60, 0, [180]], [9829102, 5, 100, 1, null], [9829103, -15, 200, 0, [178]], [9829104, 0, 900, 0, [0]]]);
  const r7d = await rit({ nodes: kn7d, punten: lijn(-100, 250, 36), start: 9829101 }), r7dU = await rit({ nodes: kn7d, punten: lijn(-100, 250, 36), start: 9829101, r13uit: true });
  eis('TB7d nooit als enige kandidaat: alleen tegenlichten binnen 400 m, de app toont er een zelf: per GPS-tik gelijk aan R1 uit (app, puur, regel)',
      !fouten(r7d) && !fouten(r7dU) && alleVerschil(r7d, r7dU) === 0 && r7d.rij.some(x => x.app === 9829101), '0 verschillen, het tegenlicht in beeld',
      fouten(r7d) || fouten(r7dU) || alleVerschil(r7d, r7dU) + ' | ' + keten(r7d).join(' > '));

  // ═══ TB8 — R3 in een rit ══════════════════════════════════
  // Kruipen naar het noorden langs een tegenlicht (-15, 30); het licht in de goede richting ligt op (0, 150).
  const kn8 = knopen([[9829201, -15, 30, 0, [180]], [9829202, 0, 150, 0, [0]]]);
  const k8 = (kmh, koers) => lijn(-40, 40, kmh).map(p => (koers === undefined ? p : { ...p, koers }));
  const r8a = await rit({ nodes: kn8, punten: k8(7) }), r8aU = await rit({ nodes: kn8, punten: k8(7), r13uit: true });
  const n8 = (r) => r.rij.filter(x => x.app === 9829201).length;
  eis('TB8a kruipen op 7 km/u: met R3 komt het tegenlicht niet in beeld, met R3 uit wel (zoals V11.37.12)',
      !fouten(r8a) && !fouten(r8aU) && n8(r8a) === 0 && n8(r8aU) > 0, 'aan 0, uit > 0', fouten(r8a) || fouten(r8aU) || n8(r8a) + ' / ' + n8(r8aU) + ' | ' + keten(r8a).join(' > ') + ' | ' + keten(r8aU).join(' > '));
  const r8b = await rit({ nodes: kn8, punten: k8(4) }), r8bU = await rit({ nodes: kn8, punten: k8(4), r13uit: true });
  eis('TB8b kruipen op 4 km/u: de regel geldt niet, per GPS-tik gelijk aan R3 uit',
      !fouten(r8b) && !fouten(r8bU) && alleVerschil(r8b, r8bU) === 0, '0 verschillen', fouten(r8b) || fouten(r8bU) || String(alleVerschil(r8b, r8bU)));
  const r8c = await rit({ nodes: kn8, punten: k8(7, null) }), r8cU = await rit({ nodes: kn8, punten: k8(7, null), r13uit: true });
  eis('TB8c kruipen op 7 km/u zonder koers in de tikken (zoals iOS bij lage snelheid kan doen): per GPS-tik gelijk aan R3 uit; de bewaarde koers telt niet',
      !fouten(r8c) && !fouten(r8cU) && alleVerschil(r8c, r8cU) === 0 && r8c.rij.every(x => x.koers === null), '0 verschillen, koers steeds null',
      fouten(r8c) || fouten(r8cU) || String(alleVerschil(r8c, r8cU)));

  // ═══ TB9 — de logregel tegen_uit ═══════════════════════════
  const aanRitten = [['M', mAan], ['7c', r7c], ['8a', r8a], ...Object.entries(veld).map(([k, v]) => [k, v.aan])];
  const log9 = aanRitten.flatMap(([n, r]) => tegenUit(r).map(e => ({ n, e, r })));
  const vals9 = log9.filter(({ e, r }) => {
    const w = (e.tegen && e.tegen.w) || '';
    return (/R3/.test(w) !== (e.kmh < 10));
  });
  eis('TB9a elke tegen_uit draagt R3 precies als het onder 10 km/u was',
      log9.length > 0 && vals9.length === 0, '0 fout', log9.length + ' regels, fout: ' + vals9.map(({ n, e }) => n + ':' + e.node + ':' + e.kmh + ':' + (e.tegen && e.tegen.w)).join(', '));
  const r1log = tegenUit(r7c).filter(e => e.tegen && e.tegen.w === 'R1');
  eis("TB9b het zelf gekozen getoonde tegenlicht dat afvalt: tegen_uit met w 'R1', element vind, node 9829001, nieuw 9829002",
      r1log.some(e => Number(e.node) === 9829001 && e.element === 'vind' && Number(e.nieuw) === 9829002),
      'R1 vind 9829001 -> 9829002', tegenUit(r7c).map(e => e.node + ':' + e.element + ':' + e.nieuw + ':' + (e.tegen && e.tegen.w)).join(', ') || 'geen');
  const basis = ['A', 'D'].flatMap(k => tegenUit(veld[k].aan));
  eis('TB9c de regel van V11.37.11 (36 km/u, een niet-getoond licht): geen w, zoals voorheen',
      basis.length > 0 && basis.every(e => e.tegen && !('w' in e.tegen)), 'geen w', basis.length + ' regels, met w: ' + basis.filter(e => e.tegen && 'w' in e.tegen).length);
  const per9 = {}; let dubbel9 = 0;
  for (const { n, e } of log9) { const k = n + ':' + e.node + ':' + e.element + ':' + ((e.tegen && e.tegen.w) || ''); if (per9[k] != null && e.t - per9[k] < TEGEN_LOG_MS) dubbel9++; per9[k] = e.t; }
  const naast = mLog.filter(e => e.tegen && e.tegen.w).filter(e => mLog.some(b => b !== e && b.node === e.node && b.element === e.element && b.tegen && !b.tegen.w && Math.abs(e.t - b.t) < TEGEN_LOG_MS));
  eis('TB9d hoogstens één regel per licht, plek en reden per 30 s; een uitsluiting door R1 of R3 valt niet weg achter een eerdere van de oude regel (veldgeval M)',
      dubbel9 === 0 && naast.length > 0, '0 dubbel, en R1/R3 naast de oude regel', dubbel9 + ' dubbel; naast elkaar: ' + naast.map(e => e.node + ':' + e.element + ':' + e.tegen.w).join(', '));
  // Het getoonde tegenlicht (-15, 30) scoort lager dan het licht vooruit (0, 45), maar zonder R1 houdt de hysterese het vast.
  // Dan komt de logregel alleen van de R1-regel vóór de hysterese in vindDichtbij.
  const kn9 = knopen([[9830001, -15, 30, 0, [180]], [9830002, 0, 45, 0, [0]]]);
  const o9 = { nodes: kn9, punten: lijn(-40, 25, 36), start: 9830001 };
  const r9 = await rit(o9), r9U = await rit({ ...o9, r13uit: true });
  const h9 = tegenUit(r9).filter(e => Number(e.node) === 9830001 && e.element === 'vind' && e.tegen && e.tegen.w === 'R1');
  eis("TB9e alleen de hysterese hield het tegenlicht vast: met R1 meteen 9830002 en een tegen_uit 'vind' met w R1; met R1 uit eerst nog 9830001 (zoals V11.37.12)",
      !fouten(r9) && !fouten(r9U) && r9.rij[0].app === 9830002 && r9U.rij[0].app === 9830001 && h9.length === 1 && Number(h9[0].nieuw) === 9830002,
      'aan 9830002 + 1 regel R1; uit 9830001', fouten(r9) || fouten(r9U) || 'aan: ' + keten(r9).join(' > ') + ' | uit: ' + keten(r9U).join(' > ') + ' | ' + tegenUit(r9).map(e => e.node + ':' + e.element + ':' + (e.tegen && e.tegen.w)).join(', '));

  // ═══ TB11 — regressie ══════════════════════════════════════
  // De twee gewijzigde regels in tegenLog (de sleutel van de 30 s-grens en de logregel), terug zoals in V11.37.12.
  const H13 = "               h: k == null ? null : Math.round(Math.min(...sl.eenrichting.map(r => tegenHoekVerschil(r, k)))), ...(w ? { w } : {}) } });   // V11.37.13: met de reden w";
  const S13 = "    const sleutel = bron + ':' + sl.id + (w ? ':' + w : ''), nu = Date.now();   // V11.37.13: per reden een eigen regel";
  const S12 = "    const sleutel = bron + ':' + sl.id, nu = Date.now();";
  const H12 = "               h: k == null ? null : Math.round(Math.min(...sl.eenrichting.map(r => tegenHoekVerschil(r, k)))) } });";
  const zonder = (s) => String(s).replace(S13, S12).replace(H13, H12).split(NL).filter(l => !/V11\.37\.13(?!\d)/.test(l)).join(NL);
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.13(?!\d)/.test(l)).length;
  const V113712 = { vindDichtbij: ['f8fd9aa9', 4395, 1], tegenKoers: ['67e36df', 149, 1], tegenSluitUit: ['efd9cae3', 142, 1], tegenLog: ['75f6b5b4', 569, 3],
    onGPS: ['48a5f9c7', 15309, 1], vergrendelNodeHandmatig: ['9a007b96', 2295, 1] };
  const telAf = Object.entries(V113712).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('TB11a zes functies veranderen, alleen met regels met merkteken V11.37.13 (één in vindDichtbij, tegenKoers, tegenSluitUit, onGPS en vergrendelNodeHandmatig; drie in tegenLog, waarvan twee gewijzigd)',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V113712).filter(([n, [h, l]]) => { const s = zonder(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('TB11b zonder die regels (en met de twee regels van tegenLog terug) byte-gelijk aan V11.37.12', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const ONGEWIJZIGD = { updateDichtbij: ['67e9f3ec', 12423], regelKies: ['80ca7466', 2976], logOpslagMis: ['6d7fd828', 16172],
    tegenIsTegen: ['a03bdbeb', 263], tegenRijrichtingen: ['54bb2b55', 1112], tegenPuurDichtst: ['3c123d89', 515],
    fietsSluitUit: ['ec1d273c', 170], isFietsLicht: ['89f184ad', 98], fietsPuurDichtst: ['2a9b09f8', 418], fietsTerug: ['6f950997', 372],
    vindDichtbijScore: ['bc9b7937', 2105], achterSluitUit: ['6b7a87d8', 383], checkNodeCorrectieStilstand: ['8c801fd8', 4751],
    selecteerNodeHandmatig: ['8c3e7846', 2480], corrigeerNodeAutomatisch: ['17ca8090', 4208], checkHandLockVerval: ['2df4f7ed', 5513],
    checkHandLockPassage: ['7f001264', 1768], checkTikSlotSnel: ['d3a8edbe', 2071], checkNaderingsCorrectie: ['6aeb87b3', 3595], geenLichtZetten: ['5c1824fd', 1675],
    achterTik: ['e9e105a3', 1583], regelTik: ['9c1b361b', 3087], downloadOSM: ['e89feb02', 4655] };
  const anders2 = Object.entries(ONGEWIJZIGD).filter(([n, [h, l]]) => { const s = String(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('TB11c drieëntwintig functies die V11.37.13 niet raakt (de puntentelling, het puur dichtstbijzijnde licht, de schaduwregel, het fietsfilter, de tegenrichting-regel zelf, de correcties, de loslaatroutes, de lijst, de kaart, het log): byte-gelijk aan V11.37.12',
      anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  herstel();
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') {
  window.testTegenbocht = testTegenbocht; window.tegenBochtRitBinnen = tegenBochtRitBinnen; window.tegenBochtEenheidBinnen = tegenBochtEenheidBinnen;
}
