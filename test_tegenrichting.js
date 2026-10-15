// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tegenrichting.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.11: lichten voor de tegenrichting zijn geen kandidaat meer.
//  Een licht valt af als elke autoweg erdoor eenrichting is en die weg meer
//  dan 135 graden tegen de gemeten koers in loopt, bij minstens 10 km/u. Een
//  onbekende koers telt nooit. Eén schakelaar, fail-open, nooit als enige
//  kandidaat, het getoonde licht blijft, tik en lijst blijven toegestaan.
//
//  Het vaste stratenplan: x naar het oosten, y naar het noorden, in meters; de
//  auto rijdt noordwaarts. De vier veldgevallen A tot D zijn nagebouwd met
//  de afstanden en hoeken uit de kaart (gedraaid naar noordwaarts), met eigen
//  nummers en zonder echte plek. r = de rijrichtingen van de eenrichtingswegen
//  door het licht, zoals de app ze uit de kaartvraag haalt; f = fietslicht.
//
//  TR1  de schakelaar, fail-open, het getoonde licht
//  TR2  een onbekende koers telt nooit (geen koers, NaN, negatief, stilstand,
//       de bewaarde koers van vóór een stilstand), en de snelheidsgrens
//  TR3  de grens van 135 graden, en 'elke weg'
//  TR4  tegenRijrichtingen: oneway yes/-1, rotonde, snelweg, twee richtingen,
//       geen autoweg, de vorm van de weg
//  TR5  downloadOSM vult 'eenrichting' uit de kaartvraag, zonder extra vraag
//  TR6  de vier veldgevallen A, B, C en D
//  TR7  nooit als enige kandidaat: per GPS-tik gelijk aan de schakelaar uit
//  TR8  een getikt licht voor de tegenrichting blijft staan, ook als het slot
//       vervalt
//  TR9  het puur dichtstbijzijnde licht en de schaduwregel
//  TR10 de logregel tegen_uit
//  TR11 regressie: welke functies veranderen, en dat de rest byte-gelijk is
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tegenrichting.js';
//      document.head.appendChild(s);
//      s.onload = () => testTegenrichting().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
// opt: { nodes: [{ id, x, y, f, r }], lijst (null = geen fietslijst), uit (de tegenrichting-regel uit), start,
//        punten: [{ x, y, kmh, tik?, los?, koers? }] } — één GPS-tik per punt, 1 s ertussen.
// koers: wat de GPS als koers meegeeft (standaard de richting van het vorige punt naar dit punt, NaN bij stilstand).
async function tegenRitBinnen(opt) {
  const LAT0 = 52.0000, LON0 = 5.0000;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.uit) window.tegenUitAan = () => false;
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
  tegenKoersTik = null; tegenLogLaatst.clear();
  const rij = [];
  let vorige = null;
  for (const p of opt.punten) {
    klok += 1000;
    if (p.tik != null) selecteerNodeHandmatig(p.tik);
    if (p.los) { handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null; }
    const v = p.kmh / 3.6;
    let h = (vorige && (p.x !== vorige.x || p.y !== vorige.y)) ? (Math.atan2(p.x - vorige.x, p.y - vorige.y) * 180 / Math.PI + 360) % 360 : 1;
    if (Math.round(h) === 0) h = 1;
    const koers = ('koers' in p) ? p.koers : (v > 0 ? h : NaN);
    const q = LL(p.x, p.y);
    let fout = null;
    try {
      await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: koers }, timestamp: klok });
      tikLogWaak();
    } catch (e) { fout = String(e && e.message || e).slice(0, 120); }
    rij.push({ y: Math.round(p.y * 10) / 10, x: Math.round(p.x * 10) / 10, kmh: p.kmh, app: dichtstbijOSM ? dichtstbijOSM.id : null,
               puur: puurDichtsteNodeCache ? puurDichtsteNodeCache.id : null, regel: regelStaat.keuze == null ? null : Number(regelStaat.keuze),
               slot: handmatigLockActief ? 1 : 0, koers: tegenKoers(), fout });
    vorige = p;
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  return { rij, wissel: lees('sl_wissellog'), op: lees('sl_opslaglog') };
}

// ── Draait IN een iframe: downloadOSM met een nagebootste kaartvraag ──
async function tegenKaartBinnen(opt) {
  const vragen = [];
  window.fetch = async (url, init) => {
    vragen.push({ url: String(url), body: init && init.body ? decodeURIComponent(String(init.body).replace(/^data=/, '')) : '' });
    if (String(url).indexOf('nominatim') >= 0) return { ok: true, status: 200, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => opt.antwoord };
  };
  window.fietsNaKaart = () => {};   // de fietslijst heeft zijn eigen toets (test_fietslicht FL7)
  window.haalStraatnamenOp = async () => {};
  window.updateDichtbij = () => {};
  cacheBezig = false; cacheGeladen = false; osmCache = [];
  await downloadOSM(52.0, 5.0);
  return { vragen, cache: osmCache.map(s => ({ id: s.id, eenrichting: s.eenrichting })) };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testTegenrichting() {
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
  const bron = new URL('test_tegenrichting.js', location.href).href;
  const pagina = location.pathname;
  const inFrame = async (functie, opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?tegen=' + Math.random();
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
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], wissel: [], op: [], vragen: [], cache: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const rit = (opt) => inFrame('tegenRitBinnen', opt);
  const lijn = (vanY, totY, kmh, x = 0) => { const p = [], v = kmh / 3.6; for (let y = vanY; y <= totY + 1e-9; y += v) p.push({ x, y, kmh }); return p; };
  const fouten = (r) => r.fout || (r.rij.find(x => x.fout) || {}).fout || null;
  const keten = (r) => { const k = []; for (const x of r.rij) if (!k.length || k[k.length - 1] !== x.app) k.push(x.app); return k; };
  const verschil = (a, b, veld = 'app') => a.rij.filter((x, i) => !b.rij[i] || b.rij[i][veld] !== x[veld]).length;
  const knopen = (rijen) => rijen.map(([id, x, y, f, r]) => ({ id, x, y, f, r }));

  // De onderdelen draaien hieronder op de testpagina zelf; wat daar verandert, gaat terug.
  const bew = { dichtstbijOSM, tegenKoersTik, snelheidKmh, huidigeRichting };
  const zet = (koers, kmh, getoond) => { tegenKoersTik = koers; snelheidKmh = kmh; dichtstbijOSM = getoond || null; };
  try {
    // ═══ TR1 — de schakelaar, fail-open, het getoonde licht ═════
    eis('TR1a de schakelaar staat aan (TEGEN_UIT_ACTIEF), en alles loopt via tegenUitAan()',
        TEGEN_UIT_ACTIEF === true && tegenUitAan() === true && /tegenUitAan\(\)/.test(String(tegenIsTegen)) && /tegenIsTegen\(sl\)/.test(String(tegenSluitUit)),
        'aan', String(TEGEN_UIT_ACTIEF));
    zet(0, 40, null);
    eis('TR1b zonder eenrichting (null, leeg of ontbrekend) valt niets af (fail-open)',
        tegenSluitUit({ id: 1, eenrichting: null }) === false && tegenSluitUit({ id: 1, eenrichting: [] }) === false && tegenSluitUit({ id: 1 }) === false,
        'false / false / false', [tegenSluitUit({ id: 1, eenrichting: null }), tegenSluitUit({ id: 1, eenrichting: [] }), tegenSluitUit({ id: 1 })].join(' / '));
    const tegen = tegenSluitUit({ id: 2, eenrichting: [180] }), mee = tegenSluitUit({ id: 3, eenrichting: [0] });
    zet(0, 40, { id: 2, lat: 0, lon: 0 });
    const handBew = tegenHandId; tegenHandId = '2';   // V11.37.13: alleen een getoond licht dat Younes koos blijft altijd (R1, test_tegenbocht)
    const getoond = tegenSluitUit({ id: 2, eenrichting: [180] });
    tegenHandId = handBew;   // V11.37.13
    eis('TR1c koers 0 bij 40 km/u: een licht op een weg naar 180 valt af, een licht op een weg naar 0 niet, en het getoonde licht dat Younes koos nooit',   // V11.37.13: 'dat Younes koos'
        tegen === true && mee === false && getoond === false, 'true / false / false', [tegen, mee, getoond].join(' / '));
    const isGetoond = tegenIsTegen({ id: 2, eenrichting: [180] });
    eis('TR1d het getoonde licht blijft, maar telt niet als ánder autolicht: tegenIsTegen zegt ook daar ja (zie TR7)',
        isGetoond === true, 'true', String(isGetoond));

    // ═══ TR2 — een onbekende koers telt nooit ═════════════════
    zet(null, 40, null);
    const geenKoers = tegenSluitUit({ id: 2, eenrichting: [180] });
    huidigeRichting = 0;   // de bewaarde koers van vóór een stilstand
    const bewaard = tegenSluitUit({ id: 2, eenrichting: [180] });
    eis('TR2a zonder gemeten koers in deze tik valt niets af, ook niet als huidigeRichting nog een oude koers bewaart',
        geenKoers === false && bewaard === false && tegenKoers() === null, 'false / false', geenKoers + ' / ' + bewaard);
    zet(0, 9.9, null); const traag = tegenSluitUit({ id: 2, eenrichting: [180] });
    zet(0, 10, null); const grens = tegenSluitUit({ id: 2, eenrichting: [180] });
    zet(0, 0, null); const stil = tegenSluitUit({ id: 2, eenrichting: [180] });
    eis('TR2b onder 10 km/u (9,9 en stilstand) niet, vanaf 10 km/u wel', traag === false && grens === true && stil === false,
        'false / true / false', [traag, grens, stil].join(' / '));
    // De koers zoals onGPS hem zet, één GPS-tik per geval (in een iframe, met de echte onGPS).
    const kn = knopen([[9820901, 0, 300, 0, [0]]]);
    const tik = (koers, kmh) => ({ x: 0, y: 0, kmh, koers });
    const kr = await rit({ nodes: kn, punten: [tik(NaN, 40), tik(null, 40), tik(-1, 40), tik(0, 40), tik(90, 40), tik(90, 5), tik(undefined, 40)] });
    const ks = kr.rij.map(x => x.koers);
    eis('TR2c via onGPS: koers NaN, null, -1 en ontbrekend tellen niet; 0 (gemeten noord) en 90 wel; 90 bij 5 km/u sinds V11.37.13 ook (R3, test_tegenbocht)',   // V11.37.13
        !fouten(kr) && ks[0] === null && ks[1] === null && ks[2] === null && ks[3] === 0 && ks[4] === 90 && ks[5] === 90 && ks[6] === null,   // V11.37.13: ks[5] 90
        'null null null 0 90 90 null', fouten(kr) || ks.map(String).join(' '));   // V11.37.13

    // ═══ TR3 — de grens van 135 graden ═══════════════════════
    zet(0, 40, null);
    const g = (r) => tegenSluitUit({ id: 5, eenrichting: r });
    eis('TR3a precies 135 graden valt niet af, 136 wel (TEGEN_HOEK = 135)', TEGEN_HOEK === 135 && g([135]) === false && g([136]) === true && g([225]) === false && g([224]) === true,
        '135: nee, 136: ja, 225: nee, 224: ja', [g([135]), g([136]), g([225]), g([224])].join(' / '));
    eis('TR3b elke weg moet tegen de koers in lopen: [180, 90] niet, [170, 200] wel', g([180, 90]) === false && g([170, 200]) === true,
        'false / true', g([180, 90]) + ' / ' + g([170, 200]));
    zet(350, 40, null);
    eis('TR3c rond noord: koers 350 en een weg naar 170 (180 graden) valt af, een weg naar 10 (20 graden) niet',
        g([170]) === true && g([10]) === false, 'true / false', g([170]) + ' / ' + g([10]));
  } finally {
    dichtstbijOSM = bew.dichtstbijOSM; tegenKoersTik = bew.tegenKoersTik; snelheidKmh = bew.snelheidKmh; huidigeRichting = bew.huidigeRichting;
  }

  // ═══ TR4 — tegenRijrichtingen ══════════════════════════════
  // Een weg langs de y-as (noordwaarts), het licht in het midden (node 2).
  const w = (tags, nodes = [1, 2, 3], geo = [{ lat: 52.0, lon: 5 }, { lat: 52.001, lon: 5 }, { lat: 52.002, lon: 5 }]) => ({ nodes, geometry: geo, tags });
  const oost = [{ lat: 52, lon: 5.000 }, { lat: 52, lon: 5.001 }, { lat: 52, lon: 5.002 }];
  const gev = [
    ['oneway yes', [w({ highway: 'secondary', oneway: 'yes' })], [0]],
    ['oneway -1', [w({ highway: 'secondary', oneway: '-1' })], [180]],
    ['oneway 1 en true', [w({ highway: 'primary', oneway: '1' }), w({ highway: 'primary', oneway: 'true' }, [1, 2, 3], oost)], [0, 90]],
    ['rotonde zonder oneway', [w({ highway: 'tertiary', junction: 'roundabout' })], [0]],
    ['snelweg zonder oneway', [w({ highway: 'motorway' })], [0]],
    ['rotonde met oneway=no', [w({ highway: 'tertiary', junction: 'roundabout', oneway: 'no' })], null],
    ['reversible', [w({ highway: 'secondary', oneway: 'reversible' })], null],
    ['tweerichtingsweg', [w({ highway: 'residential' })], null],
    ['eenrichting plus tweerichting', [w({ highway: 'secondary', oneway: 'yes' }), w({ highway: 'residential' }, [1, 2, 3], oost)], null],
    ['fietspad met naam telt niet mee', [w({ highway: 'secondary', oneway: 'yes' }), w({ highway: 'cycleway', name: 'X' }, [1, 2, 3], oost)], [0]],
    ['alleen een fietspad', [w({ highway: 'cycleway', oneway: 'yes' })], null],
    ['geen wegen', [], null],
    ['vorm klopt niet met de knopen', [w({ highway: 'secondary', oneway: 'yes' }, [1, 2, 3], [{ lat: 52, lon: 5 }])], null],
    ['licht als eerste knoop', [w({ highway: 'secondary', oneway: 'yes' }, [2, 3, 4])], [0]],
  ];
  const tr4 = gev.map(([naam, wegen, verwacht]) => { const k = tegenRijrichtingen(2, wegen); return [naam, JSON.stringify(k) === JSON.stringify(verwacht), JSON.stringify(k)]; });
  eis('TR4 tegenRijrichtingen in veertien gevallen (oneway yes/-1/1/true, rotonde, snelweg, oneway=no, reversible, twee richtingen, fietspad, de vorm)',
      tr4.every(x => x[1]), 'alle veertien goed', tr4.filter(x => !x[1]).map(x => x[0] + ': ' + x[2]).join(' | ') || 'alle veertien goed');

  // ═══ TR5 — downloadOSM vult 'eenrichting' ══════════════════
  const antwoord = { elements: [
    { type: 'node', id: 11, lat: 52.0, lon: 5.0, tags: { highway: 'traffic_signals' } },
    { type: 'node', id: 12, lat: 52.001, lon: 5.0, tags: { highway: 'traffic_signals' } },
    { type: 'node', id: 13, lat: 52.002, lon: 5.0, tags: { highway: 'traffic_signals' } },
    { type: 'way', id: 101, nodes: [10, 11, 14], geometry: [{ lat: 51.999, lon: 5 }, { lat: 52.0, lon: 5 }, { lat: 52.0005, lon: 5 }], tags: { highway: 'secondary', oneway: 'yes', name: 'Ring' } },
    { type: 'way', id: 102, nodes: [15, 12, 16], geometry: [{ lat: 52.0015, lon: 5 }, { lat: 52.001, lon: 5 }, { lat: 52.0005, lon: 5 }], tags: { highway: 'secondary', oneway: 'yes', name: 'Ring' } },
    { type: 'way', id: 103, nodes: [17, 13, 18], geometry: [{ lat: 52.0015, lon: 5 }, { lat: 52.002, lon: 5 }, { lat: 52.0025, lon: 5 }], tags: { highway: 'residential', name: 'Laan' } },
  ] };
  const kaart = await inFrame('tegenKaartBinnen', { antwoord });
  const ce = Object.fromEntries((kaart.cache || []).map(c => [c.id, c.eenrichting]));
  const overpass = (kaart.vragen || []).filter(v => v.url === OVERPASS_URL);
  eis('TR5a downloadOSM: het licht op de noordwaartse rijbaan krijgt [0], dat op de zuidwaartse [180], dat op de tweerichtingsweg null',
      !kaart.fout && JSON.stringify(ce[11]) === '[0]' && JSON.stringify(ce[12]) === '[180]' && ce[13] === null,
      '[0] / [180] / null', kaart.fout || [ce[11], ce[12], ce[13]].map(x => JSON.stringify(x)).join(' / '));
  eis('TR5b geen extra vraag: één vraag naar Overpass, dezelfde als vóór V11.37.11 (de wegen met naam of maxspeed, met hun vorm)',
      overpass.length === 1 && /\(way\(bn\.tl\)\["name"\];way\(bn\.tl\)\["maxspeed"\];\);out geom;$/.test(overpass[0].body),
      '1 vraag, ongewijzigd', overpass.length + ' | ' + (overpass[0] ? overpass[0].body.slice(-80) : ''));

  // ═══ TR6 — de vier veldgevallen A tot D ══════════════════
  // [id, x, y, f, r]. VAN = het licht dat de app vlak daarvoor toonde, TEGEN = het licht voor de tegenrichting waar de app
  // toen naartoe wisselde. De plek van de auto op het moment van die wissel is (0, 0); de koers noordwaarts.
  const VELD = {
    'A rechtdoor': { van: 9821007, tegen: 9821012, nodes: knopen([[9821001, -6.1, -161.8, 0, [9]], [9821002, 7.8, -147, 1, null], [9821003, 17.9, -138.5, 0, null], [9821004, -16.7, -122.3, 1, null], [9821005, 4.5, -122.2, 1, null], [9821006, -13, -113.5, 0, [180]], [9821007, -2, -5.7, 0, [2]], [9821008, -17.7, 2.2, 1, null], [9821009, -29.1, 17.2, 0, null], [9821010, -22.4, 30.6, 1, null], [9821011, 3.6, 32.9, 1, null], [9821012, -15, 40, 0, [181]], [9821013, -1.3, 266.9, 0, [19]], [9821014, -11.8, 280.1, 1, null], [9821015, 22.5, 298, 1, null], [9821016, -11.8, 306.1, 0, null], [9821017, -1.7, 311.5, 1, null], [9821018, 13.3, 315, 0, [220]], [9821019, 24.5, 317.4, 0, [183]]]) },
    'B wissel in de bocht': { van: 9822015, tegen: 9822021, pad: [...lijn(-170, -25, 30).map(p => ({ x: -p.y, y: -33, kmh: 30 })), { x: 12, y: -31, kmh: 20 }, { x: 4, y: -25, kmh: 20 }, ...lijn(-18, 330, 36)], nodes: knopen([[9822001, -325.8, -202.8, 0, [4]], [9822002, -342.6, -193.2, 1, null], [9822003, -316.2, -187.8, 1, null], [9822004, -309.9, -182.4, 0, null], [9822005, -347.9, -181.5, 0, null], [9822006, -342.7, -176.4, 1, null], [9822007, -320.5, -173.3, 1, null], [9822008, -334.1, -164.9, 0, [192]], [9822009, -8.5, -63.1, 0, null], [9822010, -320.7, -58.7, 0, [11]], [9822011, -332.9, -49.1, 1, null], [9822012, -310.4, -46.9, 1, null], [9822013, -35.1, -43.9, 0, [90]], [9822014, -346.2, -42.6, 0, [91]], [9822015, 21.2, -31.5, 0, [272]], [9822016, -300, -26.8, 0, [275]], [9822017, -336.3, -23.3, 1, null], [9822018, -312.4, -20.2, 1, null], [9822019, -22.8, -19.7, 1, null], [9822020, -325.2, -10.9, 0, [183]], [9822021, -13.9, -10, 0, [184]], [9822022, -315.4, 202, 0, [2]], [9822023, -313.1, 205.9, 1, null], [9822024, -323.8, 206.2, 1, null], [9822025, -321.2, 210.3, 0, [182]]]) },
    'C enige kandidaat vooruit': { van: 9823013, tegen: 9823026, nodes: knopen([[9823001, -4.5, -245.4, 0, [165]], [9823002, -0.7, -235.2, 0, [162]], [9823003, 79.7, -223.4, 0, [289]], [9823004, 78.5, -216.9, 1, null], [9823005, 59.2, -211.2, 0, [306,310,340]], [9823006, -25.5, -199.9, 1, null], [9823007, 1.4, -195.7, 0, [234]], [9823008, 35, -192.5, 0, [289]], [9823009, -22.5, -188.3, 0, [172]], [9823010, 25.4, -178.6, 0, [310]], [9823011, 22.8, -169.5, 1, null], [9823012, 17.9, -165.6, 1, null], [9823013, 0, -58, 0, [0]], [9823014, 10.5, -48.9, 1, null], [9823015, -28.5, -45.4, 1, null], [9823016, 4.2, -40.2, 1, null], [9823017, -356.8, -38.1, 1, null], [9823018, -38.5, -36.6, 1, null], [9823019, -42.6, -31.8, 0, [89]], [9823020, -359.6, -31.4, 0, null], [9823021, -347.3, -31.4, 0, null], [9823022, -356.9, -25.4, 1, null], [9823023, 4.3, -18.8, 1, null], [9823024, -38.5, -18.7, 1, null], [9823025, -30, -10.3, 1, null], [9823026, -22.4, -9, 0, [179]]]) },
    'D rechtdoor': { van: 9824007, tegen: 9824012, nodes: knopen([[9824001, 3.5, -160.3, 0, [1]], [9824002, -15.1, -153.2, 1, null], [9824003, 10.8, -151, 1, null], [9824004, 17.5, -137.5, 0, null], [9824005, 6.2, -122.6, 1, null], [9824006, -9.6, -114.6, 0, [182]], [9824007, 1.5, -6.8, 0, [0]], [9824008, -16.1, 1.9, 1, null], [9824009, 5.2, 2, 1, null], [9824010, -29.4, 18.2, 0, null], [9824011, -19.4, 26.7, 1, null], [9824012, -5.5, 41.5, 0, [189]], [9824013, 59.7, 240.6, 0, [20]], [9824014, 73.9, 253.4, 1, null], [9824015, 44.7, 254.8, 1, null], [9824016, 37.4, 260.3, 1, null], [9824017, 86.4, 264.1, 0, [287]], [9824018, 39.8, 268, 0, [114]], [9824019, 47.2, 269.7, 0, [209]], [9824020, 79.3, 275.2, 1, null], [9824021, 66.7, 289.3, 0, [204]]]) },
  };
  const hoekT = (v, k) => Math.abs(((v - k) % 360 + 540) % 360 - 180);
  const isTegen = (n) => !!n && Array.isArray(n.r) && n.r.length > 0 && n.r.every(v => hoekT(v, 0) > 135);   // de koers is overal noordwaarts
  const pad = (c) => c.pad || lijn(-200, 330, 36);
  const tr6 = {};
  for (const [naam, c] of Object.entries(VELD)) {
    const opt = { nodes: c.nodes, start: c.van, punten: pad(c) };
    const met = await rit(opt), uit = await rit({ ...opt, uit: true });
    const tegenIds = new Set(c.nodes.filter(isTegen).map(n => n.id));
    const tel = (r, veld, ids) => r.rij.filter(x => ids.has(x[veld]) && x.kmh >= 10).length;
    tr6[naam.slice(0, 1)] = { naam, c, met, uit, tegenIds, km: keten(met), ku: keten(uit),
      t: { met: tel(met, 'app', new Set([c.tegen])), uit: tel(uit, 'app', new Set([c.tegen])) },
      alle: { met: tel(met, 'app', tegenIds), uit: tel(uit, 'app', tegenIds), puurMet: tel(met, 'puur', tegenIds), puurUit: tel(uit, 'puur', tegenIds),
              regelMet: tel(met, 'regel', tegenIds), regelUit: tel(uit, 'regel', tegenIds) },
      log: met.op.filter(r => r.reden === 'tegen_uit') };
  }
  const uitleg = (t) => `met ${t.t.met}, zonder ${t.t.uit} (alle tegenlichten: ${t.alle.met} / ${t.alle.uit}) | met: ${t.km.join(' > ')} | zonder: ${t.ku.join(' > ')}`;
  for (const k of ['A', 'D']) {
    const t = tr6[k];
    eis(`TR6${k} ${t.naam}: met de regel komt dat licht voor de tegenrichting niet in beeld zolang je rijdt; zonder de regel wel, zoals toen`,
        !fouten(t.met) && !fouten(t.uit) && t.t.met === 0 && t.t.uit > 0,
        'met: 0 tikken, zonder: > 0', fouten(t.met) || fouten(t.uit) || uitleg(t));
  }
  {
    // B: de app laat het oude licht los midden in de bocht naar rechts. De koers wijst dan nog 90 tot 135 graden
    // naast de weg van het tegenlicht, dus de regel geldt nog niet; daarna is het het getoonde licht, en dat blijft.
    const t = tr6.B, i = t.met.rij.findIndex(x => x.app === t.c.tegen);
    const r0 = i >= 0 ? t.met.rij[i] : null, nT = t.c.nodes.find(n => n.id === t.c.tegen);
    const h0 = r0 && r0.koers != null ? Math.round(Math.min(...nT.r.map(v => hoekT(v, r0.koers)))) : null;
    const daarna = i >= 0 && t.met.rij.slice(i + 1).every((x, j) => x.app !== t.c.tegen || t.met.rij[i + j].app === t.c.tegen);
    eis('TR6B veldgeval B: de wissel valt midden in de bocht, waar de koers nog binnen 135 graden van de weg ligt; daarna blijft het als getoond licht staan; met de regel niet langer dan zonder',
        !fouten(t.met) && !fouten(t.uit) && h0 !== null && h0 <= 135 && daarna && t.t.met <= t.t.uit,
        'hoek <= 135 bij de wissel, daarna getoond, met <= zonder', fouten(t.met) || fouten(t.uit) || `hoek ${h0} bij koers ${r0 && Math.round(r0.koers)} | ` + uitleg(t));
  }
  {
    // C: vooruit ligt binnen 400 m geen ander autolicht (het volgende lag toen 463 m verder), dus doet het tegenlicht
    // mee: nooit uitsluiten als het de enige kandidaat is. Met de regel wel korter dan zonder.
    const t = tr6.C;
    const enige = t.met.rij.filter(x => x.app === t.c.tegen && x.kmh >= 10).every(x => !t.c.nodes.some(n => !n.f && !isTegen(n) && n.y > x.y
      && Math.hypot(n.x - x.x, n.y - x.y) <= 400));
    eis('TR6C veldgeval C: het tegenlicht komt alleen in beeld als er vooruit binnen 400 m geen ander autolicht is, en korter dan zonder de regel',
        !fouten(t.met) && !fouten(t.uit) && enige && t.t.met < t.t.uit, 'alleen als enige, met < zonder', fouten(t.met) || fouten(t.uit) || `enige: ${enige} | ` + uitleg(t));
  }
  // Elke GPS-tik waarop met de regel tóch een licht voor de tegenrichting in beeld is, valt onder een van de veiligheden:
  // (a) vooruit binnen 400 m is er geen ander autolicht (nooit als enige kandidaat), (b) het was al het getoonde licht,
  // (c) de koers lag binnen 135 graden van de weg (in een bocht).
  const onverklaard = [];
  for (const t of Object.values(tr6)) t.met.rij.forEach((x, i) => {
    if (!t.tegenIds.has(x.app) || x.kmh < 10) return;
    const n = t.c.nodes.find(q => q.id === x.app), vorig = i > 0 ? t.met.rij[i - 1].app : null;
    const enige = !t.c.nodes.some(q => !q.f && !isTegen(q) && q.y > x.y && Math.hypot(q.x - x.x, q.y - x.y) <= 400);
    const bocht = x.koers != null && Math.min(...n.r.map(v => hoekT(v, x.koers))) <= 135;
    if (!(enige || vorig === x.app || bocht)) onverklaard.push(t.naam.slice(0, 1) + '@' + x.y + ':' + x.app);
  });
  const nTegen = Object.values(tr6).reduce((s, t) => s + t.alle.met, 0);
  eis('TR6F met de regel: elke tik met een licht voor de tegenrichting valt onder een veiligheid (enige kandidaat, al getoond, of bocht)',
      onverklaard.length === 0, '0 onverklaard', nTegen + ' tikken, onverklaard: ' + (onverklaard.join(', ') || 'geen'));
  const logs = Object.values(tr6).flatMap(t => t.log.map(r => ({ r, t })));
  const vals = logs.filter(({ r, t }) => !t.tegenIds.has(Number(r.node)) || !(r.tegen && r.tegen.h > 135) || Number(r.node) === t.c.van);
  eis('TR6E geen goed licht valt af: in de vier ritten sluit de regel alleen lichten uit die echt tegen de koers in staan (meer dan 135 graden), nooit het licht dat de app vlak daarvoor toonde',
      logs.length > 0 && vals.length === 0, 'alle uitsluitingen tegenlichten', logs.length + ' uitsluitingen, ' + vals.length + ' fout: ' + vals.map(x => x.r.node).join(','));

  // ═══ TR7 — nooit als enige kandidaat ═══════════════════════
  // Binnen 400 m alleen twee lichten voor de tegenrichting en een fietslicht; het volgende autolicht ligt op 900 m, en de rit stopt op 250 m.
  const tr7n = knopen([[9825001, -15, 60, 0, [180]], [9825002, 5, 100, 1, null], [9825003, -15, 200, 0, [178]], [9825004, 0, 900, 0, [0]]]);
  const tr7 = { nodes: tr7n, punten: lijn(-100, 250, 36) };
  const m7 = await rit(tr7), u7 = await rit({ ...tr7, uit: true });
  eis('TR7 alleen lichten voor de tegenrichting binnen 400 m: per GPS-tik gelijk aan de schakelaar uit (app, puur, regel)',
      !fouten(m7) && !fouten(u7) && verschil(m7, u7) === 0 && verschil(m7, u7, 'puur') === 0 && verschil(m7, u7, 'regel') === 0 && m7.rij.some(x => x.app === 9825001),
      '0 verschillen, en het tegenlicht in beeld', fouten(m7) || fouten(u7) || [verschil(m7, u7), verschil(m7, u7, 'puur'), verschil(m7, u7, 'regel')].join(' / ') + ' | ' + keten(m7).join(' > '));

  // ═══ TR8 — een getikt licht voor de tegenrichting blijft ══════
  const tr8n = knopen([[9826001, -15, 60, 0, [180]], [9826002, 0, 150, 0, [0]], [9826003, 3, 400, 0, [0]]]);
  const p8 = lijn(-100, 40, 36); p8[3] = { ...p8[3], tik: 9826001 }; p8[10] = { ...p8[10], los: true };
  const m8 = await rit({ nodes: tr8n, punten: p8 });
  eis('TR8 Younes tikt het licht voor de tegenrichting: het blijft staan, ook na het vervallen van het slot, bij 36 km/u',
      !fouten(m8) && m8.rij.slice(3).every(x => x.app === 9826001) && m8.rij[3].slot === 1 && m8.rij[10].slot === 0 && m8.rij.slice(0, 3).every(x => x.app !== 9826001),
      'vanaf de tik elke tik 9826001', fouten(m8) || keten(m8).join(' > ') + ' | slot ' + m8.rij.map(x => x.slot).join(''));

  // ═══ TR9 — het puur dichtstbijzijnde licht en de schaduwregel ══
  const tA = tr6.A, tD = tr6.D;
  eis('TR9a puur dichtstbij en de schaduwregel: met de regel nooit een licht voor de tegenrichting zolang je rijdt (veldgevallen A en D, twee ritten)',
      tA.alle.puurMet === 0 && tA.alle.regelMet === 0 && tD.alle.puurMet === 0 && tD.alle.regelMet === 0,
      '0 / 0 / 0 / 0', [tA.alle.puurMet, tA.alle.regelMet, tD.alle.puurMet, tD.alle.regelMet].join(' / '));
  eis('TR9b zonder de regel wel (zelfde ritten): het verschil komt van de regel',
      tA.alle.puurUit + tA.alle.regelUit + tD.alle.puurUit + tD.alle.regelUit > 0,
      '> 0', [tA.alle.puurUit, tA.alle.regelUit, tD.alle.puurUit, tD.alle.regelUit].join(' / '));

  // ═══ TR10 — de logregel tegen_uit ══════════════════════════
  const eerste = tA.log.find(r => r.element === 'vind');
  eis('TR10a tegen_uit legt vast: het uitgesloten licht, waar (vind/puur/regel), wat er in de plaats kwam, de koers, de rijrichting en de hoek, het getoonde licht en de peiling',
      !!eerste && tA.tegenIds.has(Number(eerste.node)) && !!eerste.tegen && eerste.tegen.k === 1 && Array.isArray(eerste.tegen.r) && eerste.tegen.h > 135
        && eerste.nieuw != null && eerste.gt != null && typeof eerste.peilGek === 'number',
      'node, element vind, nieuw, tegen {k, r, h}, gt, peilGek', JSON.stringify(eerste ? { node: eerste.node, element: eerste.element, nieuw: eerste.nieuw, tegen: eerste.tegen, gt: eerste.gt, peilGek: eerste.peilGek } : null));
  const per = {}; let dubbel = 0;
  for (const { r } of logs) { const k = r.node + ':' + r.element + ':' + ((r.tegen && r.tegen.w) || ''); if (per[k] != null && r.t - per[k] < TEGEN_LOG_MS) dubbel++; per[k] = r.t; }   // V11.37.13: per reden (test_tegenbocht TB9)
  eis('TR10b hoogstens één regel per licht, plek en reden per 30 s; de drie plekken (vind, puur, regel) komen voor',   // V11.37.13: 'en reden' dubbel === 0 && ['vind', 'puur', 'regel'].every(e => logs.some(x => x.r.element === e)),
      '0 dubbel, vind + puur + regel', dubbel + ' dubbel; plekken ' + [...new Set(logs.map(x => x.r.element))].join(','));
  const geenLog7 = m7.op.filter(r => r.reden === 'tegen_uit').length;
  eis('TR10c als de regel de keuze niet verandert (alleen tegenlichten), komt er geen regel', geenLog7 === 0, '0', String(geenLog7));

  // ═══ TR11 — regressie ══════════════════════════════════════
  const zonder = (s) => String(s).split(NL).filter(l => !/V11\.37\.11(?!\d)|V11\.37\.12(?!\d)|V11\.37\.13(?!\d)|V11\.37\.15(?!\d)|V11\.37\.17(?!\d)/.test(l)).join(NL);   // V11.37.17: ook de startlog (test_startlog); V11.37.12: die regels ook (test_overpass); V11.37.13 ook (test_tegenbocht); V11.37.15 ook (test_koerslog)
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.11(?!\d)/.test(l)).length;
  const V113710 = { vindDichtbij: ['d444ee3', 3717, 4], updateDichtbij: ['7b7fce62', 12303, 1], regelKies: ['cd458100', 2307, 5], onGPS: ['d99821b8', 15000, 1],
    downloadOSM: ['82a16b3c', 4147, 1], logOpslagMis: ['e93caaaf', 16068, 1] };
  const telAf = Object.entries(V113710).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('TR11a zes functies veranderen, alleen met regels met merkteken V11.37.11 (vier in vindDichtbij, vijf in regelKies, één in de rest)',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V113710).filter(([n, [h, l]]) => { const s = zonder(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('TR11b zonder die regels (alle zijn nieuw) byte-gelijk aan V11.37.10', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  // V11.37.12 schrijft fietsHaalOp en fietsNaKaart opnieuw (test_overpass); die staan hier niet meer.
  const ONGEWIJZIGD = { vindDichtbijScore: ['bc9b7937', 2105], achterSluitUit: ['6b7a87d8', 383], fietsSluitUit: ['ec1d273c', 170], fietsPuurDichtst: ['2a9b09f8', 418],
    fietsTerug: ['6f950997', 372], checkNodeCorrectieStilstand: ['8c801fd8', 4751],
    selecteerNodeHandmatig: ['8c3e7846', 2480], corrigeerNodeAutomatisch: ['17ca8090', 4208], geenLichtZetten: ['5c1824fd', 1675], achterTik: ['e9e105a3', 1583],
    checkHandLockVerval: ['2df4f7ed', 5513], checkHandLockPassage: ['7f001264', 1768], checkTikSlotSnel: ['d3a8edbe', 2071], verzamelNaderingsBewijs: ['3d6ad85f', 3526],
    checkNaderingsCorrectie: ['6aeb87b3', 3595], regelTik: ['9c1b361b', 3087], peilingDuidelijkBeter: ['a1d2a5c1', 1471], berekenLateraleOffset: ['189b7879', 328],
    wisselLogNoteer: ['9c1383d4', 1904], bevestigCountdown: ['8457401d', 16073], slaOpIntern: ['c284229a', 2342], tikRichting: ['b44110d5', 4619] };
  const anders2 = Object.entries(ONGEWIJZIGD).filter(([n, [h, l]]) => { const s = String(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('TR11c tweeëntwintig functies die V11.37.11 niet raakt (de puntentelling, de achter-regel, het fietsfilter, de correcties, de tik, de loslaatroutes, de wissellog, het leren): byte-gelijk aan V11.37.10',
      anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  herstel();
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') {
  window.testTegenrichting = testTegenrichting; window.tegenRitBinnen = tegenRitBinnen; window.tegenKaartBinnen = tegenKaartBinnen;
}
