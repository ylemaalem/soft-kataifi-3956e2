// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_plaatsen.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.25: de plaats in de naam van een licht komt uit
//  kaart/plaatsen.json (waar het licht ligt), niet uit huidigeStad (waar je
//  bent); Nominatim krijgt geen enkele vraag meer.
//
//  PL1  plaatsenLees en plaatsVoorLicht: een licht met plaats, zonder plaats
//       (-1), en een onbekend licht; een kapot bestand wordt geweigerd
//  PL2  plaatsZetOpCache: "Straat, Plaats", "Onbekende weg, Plaats", alleen de
//       straat of de coördinaten; huidigeStad doet niet meer mee
//  PL3  vindNaamVoorId schrijft een naam zonder plaats niet over een opgeslagen
//       naam in sl_naam_, een naam met plaats wel
//  PL4  geen vraag aan Nominatim: niet per licht, niet voor de plaats van waar je
//       bent; sl_stad_cache wordt niet meer geschreven
//  PL5  laden: van het net (sha256 en lengte gecontroleerd), daarna uit de eigen
//       IndexedDB; een fout bestand wordt geweigerd (geen plaats, een logregel);
//       de kaart die er al staat krijgt na het laden de plaatsen
//  PL6  het echte bestand: dezelfde lichten als kaart/lichten.json (aantal en
//       sha256), de sha256 en lengte van PLAATSEN_SHA256 en PLAATSEN_BYTES
//  PL7  alleen in het bovenste venster na Start (niet in een iframe of op het
//       startscherm)
//  PL9  de plaatsen worden toegepast: op de bewaarde kaart (echt gedrag) en in
//       downloadOSM direct na het maken van osmCache (in de code)
//  PL8  regressie: zonder de regels met merkteken V11.37.25 zijn downloadOSM,
//       kaartBewaardZet, vindNaamVoorId en refreshStadIndienNodig byte-gelijk
//       aan V11.37.23; twintig functies rond de kaart, de namen, de lichtkeuze
//       en het leren zijn niet aangeraakt
//
//  Alle plekken, namen en nummers in de toets zelf zijn bedacht (basispunt
//  52.0000, 5.0000; lichtnummers vanaf 950000000). PL5 en PL6 lezen het echte
//  bestand, maar noemen geen nummer of naam eruit.
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_plaatsen.js';
//      document.head.appendChild(s);
//      s.onload = () => testPlaatsen().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testPlaatsen() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const NL = String.fromCharCode(10);
  const kort = (x) => JSON.stringify(x).slice(0, 300);
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };
  const weg = (naam) => new Promise((k) => { try { const r = indexedDB.deleteDatabase(naam); r.onsuccess = r.onerror = r.onblocked = () => k(); } catch (e) { k(); } });
  const bewaard = { osmCache, dichtstbijOSM, huidigeStad, plaatsenData, plaatsenBelofte, plaatsenStand, fetch: window.fetch, stadLaatstRefreshed, huidigePos };
  const N = 950000000 + Math.floor(Math.random() * 1e6);
  const tekstVan = (lichten, namen) => {   // lichten: [[id, index]] op volgorde
    let vorig = 0; const d = [], p = [];
    for (const [id, x] of lichten) { d.push(id - vorig); vorig = id; p.push(x); }
    return JSON.stringify({ v: 1, datum: '2000-01-01', kaart: '0', lichten: lichten.length, namen, d, p });
  };

  try {
    // ═══ PL1 ═══════════════════════════════════════════════════
    plaatsenData = plaatsenLees(tekstVan([[N, 1], [N + 5, -1], [N + 9, 0]], ['Aplaats', 'Bplaats']));
    eis('PL1a een licht met plaats, zonder plaats (-1) en een onbekend licht',
        plaatsVoorLicht(N) === 'Bplaats' && plaatsVoorLicht(String(N + 9)) === 'Aplaats' && plaatsVoorLicht(N + 5) === null && plaatsVoorLicht(N + 1) === null && plaatsVoorLicht('x') === null,
        'Bplaats, Aplaats, null, null, null', [plaatsVoorLicht(N), plaatsVoorLicht(N + 9), plaatsVoorLicht(N + 5), plaatsVoorLicht(N + 1)].join(','));
    const kapot = [
      '{"v":2,"lichten":0,"namen":[],"d":[],"p":[]}',
      tekstVan([[N, 3]], ['A']),
      JSON.stringify({ v: 1, lichten: 2, namen: ['A'], d: [N, 0], p: [0, 0] }),
      JSON.stringify({ v: 1, lichten: 2, namen: ['A'], d: [N], p: [0] }),
      'geen json'
    ];
    const geweigerd = kapot.filter((t) => { try { plaatsenLees(t); return false; } catch (e) { return true; } }).length;
    eis('PL1b een kapot bestand wordt geweigerd (vorm, index, volgorde, aantal, geen JSON)', geweigerd === kapot.length, kapot.length, geweigerd);

    // ═══ PL2 ═══════════════════════════════════════════════════
    huidigeStad = 'Fouteplaats';
    const lijst = [
      { id: N, lat: 52.0001, lon: 5.0001, straat: 'Testweg', naam: 'Testweg, Fouteplaats', stad: 'Fouteplaats' },
      { id: N + 9, lat: 52.0002, lon: 5.0002, straat: null, naam: 'Onbekende weg, Fouteplaats', stad: 'Fouteplaats' },
      { id: N + 5, lat: 52.0003, lon: 5.0003, straat: 'Tweedeweg', naam: 'Tweedeweg, Fouteplaats', stad: 'Fouteplaats' },
      { id: N + 1, lat: 52.0004, lon: 5.0004, straat: null, naam: 'x', stad: 'Fouteplaats' }
    ];
    plaatsZetOpCache(lijst);
    eis('PL2 de plaats van het licht, niet huidigeStad; zonder plaats alleen de straat of de coördinaten',
        lijst[0].naam === 'Testweg, Bplaats' && lijst[0].stad === 'Bplaats' && lijst[1].naam === 'Onbekende weg, Aplaats'
          && lijst[2].naam === 'Tweedeweg' && lijst[2].stad === null && lijst[3].naam === '52.0004, 5.0004' && lijst[3].stad === null,
        'Testweg, Bplaats | Onbekende weg, Aplaats | Tweedeweg | 52.0004, 5.0004', lijst.map(x => x.naam).join(' | '));

    // ═══ PL3 ═══════════════════════════════════════════════════
    osmCache = lijst;
    localStorage.setItem('sl_naam_' + (N + 5), 'Tweedeweg, Oudeplaats');
    localStorage.removeItem('sl_naam_' + N);
    const t3a = vindNaamVoorId(N + 5), t3b = vindNaamVoorId(N);
    eis('PL3 een naam zonder plaats overschrijft sl_naam_ niet (en wordt wel getoond); een naam met plaats wordt geschreven',
        localStorage.getItem('sl_naam_' + (N + 5)) === 'Tweedeweg, Oudeplaats' && t3a === 'Tweedeweg' && localStorage.getItem('sl_naam_' + N) === 'Testweg, Bplaats' && t3b === 'Testweg, Bplaats',
        'blijft, Tweedeweg, geschreven', kort({ a: localStorage.getItem('sl_naam_' + (N + 5)), t3a, b: localStorage.getItem('sl_naam_' + N), t3b }));
    localStorage.removeItem('sl_naam_' + N); localStorage.removeItem('sl_naam_' + (N + 5));

    // ═══ PL4 ═══════════════════════════════════════════════════
    const urls = [];
    window.fetch = async (u) => { urls.push(String(u)); return { ok: true, json: async () => ({ address: { city: 'Netplaats', road: 'Netweg' } }) }; };
    const stadVoor = localStorage.getItem('sl_stad_cache');
    huidigePos = { lat: 52.0001, lon: 5.0001 };
    osmCache = [{ id: N + 20, lat: 52.0002, lon: 5.0002, naam: 'y', straat: null }];
    await haalStraatnamenOp();
    stadLaatstRefreshed = 0;
    await refreshStadIndienNodig(52.0001, 5.0001);
    stadLaatstRefreshed = 0;
    await refreshStadIndienNodig(52.5001, 5.5001);
    window.fetch = bewaard.fetch;
    eis('PL4 geen enkele vraag aan Nominatim (per licht en voor je positie); sl_stad_cache en huidigeStad blijven zoals ze waren',
        urls.filter(u => /nominatim/i.test(u)).length === 0 && localStorage.getItem('sl_stad_cache') === stadVoor && huidigeStad === 'Fouteplaats',
        '0 vragen, ongewijzigd', kort({ urls, stad: huidigeStad }));

    // ═══ PL5 ═══════════════════════════════════════════════════
    await weg(PLAATSEN_IDB);
    const echt = await (await bewaard.fetch.call(window, new URL('kaart/plaatsen.json', location.href).href + '?t=' + Date.now())).text();
    const eo = JSON.parse(echt);
    let id5 = null, plaats5 = null, v = 0;   // het eerste licht met een plaats (uit het bestand, niet uit de toets)
    for (let i = 0; i < eo.d.length; i++) { v += eo.d[i]; if (eo.p[i] >= 0) { id5 = v; plaats5 = eo.namen[eo.p[i]]; break; } }
    plaatsenData = null; plaatsenStand = null; dichtstbijOSM = null;
    osmCache = [{ id: id5, lat: 52.0001, lon: 5.0001, straat: 'Testweg', naam: 'Testweg, Fouteplaats', stad: 'Fouteplaats' }];
    let haal = 0;
    window.fetch = async (u, o) => { haal++; return bewaard.fetch.call(window, u, o); };
    await plaatsenLaad();
    const s1 = plaatsenStand, n1 = osmCache[0].naam, haal1 = haal;
    plaatsenData = null; plaatsenStand = null;
    await plaatsenLaad();
    const s2 = plaatsenStand, haal2 = haal;
    window.fetch = bewaard.fetch;
    eis('PL5a eerst van het net, dan uit de eigen IndexedDB (geen tweede download)', s1 === 'net' && s2 === 'idb' && haal1 === 1 && haal2 === 1 && !!plaatsenData, 'net, idb, 1 download', kort({ s1, s2, haal1, haal2 }));
    eis('PL5b de kaart die er al staat krijgt na het laden de plaats van het licht', n1 === 'Testweg, ' + plaats5 && osmCache[0].stad === plaats5, 'Testweg, <plaats uit het bestand>', n1 === 'Testweg, ' + plaats5 ? 'zo' : n1);
    // Fout bestand: een andere inhoud met dezelfde lengte, en een kortere
    await weg(PLAATSEN_IDB);
    const fouten = [];
    for (const vals of [echt.replace('"v":1', '"v":7'), echt.slice(0, -10)]) {
      plaatsenData = null; plaatsenStand = null;
      osmCache = [{ id: id5, lat: 52.0001, lon: 5.0001, straat: 'Testweg', naam: 'Testweg, Fouteplaats', stad: 'Fouteplaats' }];
      window.fetch = async () => new Response(vals, { status: 200 });
      await plaatsenLaad();
      fouten.push(plaatsenStand + ' / ' + (plaatsenData === null) + ' / ' + osmCache[0].naam);
    }
    window.fetch = async () => new Response('x', { status: 404 });
    plaatsenData = null; plaatsenStand = null;
    await plaatsenLaad();
    fouten.push(plaatsenStand + ' / ' + (plaatsenData === null));
    window.fetch = bewaard.fetch;
    eis('PL5c een fout bestand wordt geweigerd (sha256, lengte, 404): geen plaats en geen gok',
        fouten[0] === 'fout sha / true / Testweg, Fouteplaats' && fouten[1] === 'fout lengte / true / Testweg, Fouteplaats' && fouten[2] === 'fout http 404 / true',
        'fout sha, fout lengte, fout http 404', kort(fouten));
    let log = [];
    try { log = (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r && (r.r === 'plaatsen' || r.reden === 'plaatsen' || r.type === 'plaatsen' || JSON.stringify(r).includes('"plaatsen"'))); } catch (e) {}
    eis('PL5d elke poging laat een logregel na; de stand en de duur noemen geen plek', log.length >= 5 && log.every(r => !/5[12]\.\d{3}|lat|lon/.test(JSON.stringify(r))), '>= 5 regels zonder plek', log.length + ' ' + kort(log.slice(-2)));
    await weg(PLAATSEN_IDB);

    // ═══ PL6 ═══════════════════════════════════════════════════
    const versie = await (await fetch(new URL('kaart/versie.json', location.href).href + '?t=' + Date.now())).json();
    const buf = new TextEncoder().encode(echt);
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(b => b.toString(16).padStart(2, '0')).join('');
    eis('PL6 het bestand hoort bij kaart/lichten.json (aantal en sha256) en past bij PLAATSEN_SHA256 en PLAATSEN_BYTES',
        eo.lichten === versie.lichten && eo.kaart === versie.sha256.lichten.slice(0, 16) && h === PLAATSEN_SHA256 && buf.length === PLAATSEN_BYTES && eo.namen.length > 500,
        'gelijk', kort({ lichten: [eo.lichten, versie.lichten], kaart: eo.kaart === versie.sha256.lichten.slice(0, 16), sha: h === PLAATSEN_SHA256, bytes: [buf.length, PLAATSEN_BYTES] }));

    // ═══ PL7 ═══════════════════════════════════════════════════
    const sch = document.getElementById('startscherm');
    const hadWeg = !!sch && sch.classList.contains('weg');
    if (sch) sch.classList.remove('weg');
    const op = plaatsenMag();
    if (sch) sch.classList.add('weg');
    const na = plaatsenMag();
    if (sch && !hadWeg) sch.classList.remove('weg');
    const inFrame = /window\.top === window/.test(String(plaatsenMag)) ? false : 'geen bovenste-venster-voorwaarde';   // in een iframe is window.top een ander venster
    eis('PL7 alleen in het bovenste venster na Start: niet op het startscherm, niet in een iframe', op === false && na === true && inFrame === false, 'nee, ja, nee', kort({ op, na, inFrame }));

    // ═══ PL9 ═══════════════════════════════════════════════════
    plaatsenData = plaatsenLees(tekstVan([[N, 1], [N + 9, 0]], ['Aplaats', 'Bplaats']));
    const g9 = { cacheCentrum, cacheGeladen, kaartIsBewaard, kaartBewaardStand, berekenClusterNodes: window.berekenClusterNodes, fietsNaKaart: window.fietsNaKaart,
                 logOpslagMis: window.logOpslagMis, startLogMijl: window.startLogMijl, kaartWeergaveBij: window.kaartWeergaveBij };
    window.berekenClusterNodes = () => {}; window.fietsNaKaart = () => {}; window.logOpslagMis = () => {}; window.startLogMijl = () => {}; window.kaartWeergaveBij = () => {};
    let bw = null;
    try {
      kaartBewaardZet({ t: Date.now(), lat: 52, lon: 5, lichten: [{ id: N, lat: 52.0001, lon: 5.0001, straat: 'Testweg', naam: 'Testweg, Fouteplaats', stad: 'Fouteplaats' },
        { id: N + 9, lat: 52.0002, lon: 5.0002, straat: null, naam: 'Onbekende weg, Fouteplaats', stad: 'Fouteplaats' }] }, 52, 5, 10);
      bw = osmCache.map(x => x.naam).join(' | ');
    } catch (e) { bw = 'fout ' + e; }
    finally {
      Object.assign(window, { berekenClusterNodes: g9.berekenClusterNodes, fietsNaKaart: g9.fietsNaKaart, logOpslagMis: g9.logOpslagMis, startLogMijl: g9.startLogMijl, kaartWeergaveBij: g9.kaartWeergaveBij });
      cacheCentrum = g9.cacheCentrum; cacheGeladen = g9.cacheGeladen; kaartIsBewaard = g9.kaartIsBewaard; kaartBewaardStand = g9.kaartBewaardStand;
    }
    eis('PL9a de bewaarde kaart krijgt de plaats van het licht, niet de opgeslagen plaats', bw === 'Testweg, Bplaats | Onbekende weg, Aplaats', 'Testweg, Bplaats | Onbekende weg, Aplaats', bw);
    const code9 = String(downloadOSM).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    const iMap = code9.indexOf('osmCache = nodes.map('), iZet = code9.indexOf('plaatsZetOpCache(osmCache)'), iBewaar = code9.indexOf('kaartNaDownload(');
    eis('PL9b downloadOSM roept plaatsZetOpCache aan na het maken van osmCache en vóór het bewaren', iMap > 0 && iZet > iMap && iBewaar > iZet && code9.split('plaatsZetOpCache(').length === 2,
        'na de map, vóór kaartNaDownload, één keer', kort({ iMap, iZet, iBewaar }));

    // ═══ PL8 ═══════════════════════════════════════════════════
    // Gemeten in de bron van V11.37.23 (a8a8fa6) in een eigen headless Chrome, niet afgeleid uit deze versie.
    const V113723 = { geraakt: { downloadOSM: ['8d85b686', 5297], kaartBewaardZet: ['37f122a5', 539], vindNaamVoorId: ['fb79c497', 797], refreshStadIndienNodig: ['8c90a4b5', 1249] },
      ongemoeid: { kiesBesteWeg: ['724fc2d7', 650], kaartKeur: ['c783f42d', 1313], kaartBewaar: ['aac30b1e', 1063], kaartNaDownload: ['54dc4432', 269], kaartNodig: ['71ae6aa9', 166],
        updateDichtbij: ['4bca6fd4', 12847], vindDichtbij: ['d32386d8', 4753], onGPS: ['454f7f25', 15761], toonV9Richtingen: ['af05f130', 1926], renderRadarSheetNodeLijst: ['34b1c257', 1309],
        haalStraatnamenOp: ['366a2c5a', 1250], herstelOpslagGlobals: ['85be2216', 239], kiesCountdownBron: ['8e69db98', 12851], slaOp: ['411179eb', 3252], slaOpIntern: ['c284229a', 2342],
        gewGem: ['eb1936ea', 1025], startCd: ['4c0000d7', 7397], exporteerMeetdata: ['64c15a78', 10084], kaartHaalKaart: ['a16f2e6e', 415], kaartBestandKnip: ['2a73781', 912] } };
    const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.25(?!\d)/.test(l)).length;
    const telAf = Object.keys(V113723.geraakt).filter(n => merk(window[n]) !== 1).map(n => n + ' ' + merk(window[n]));
    eis('PL8a vier functies krijgen elk één regel met merkteken V11.37.25', telAf.length === 0, 'precies één', telAf.join(', ') || 'precies één');
    const zonder25 = (f) => String(f).split(NL).filter(l => !/V11\.37\.25(?!\d)/.test(l)).join(NL);
    const anders = Object.entries(V113723.geraakt).filter(([n, [hh, l]]) => fnv(zonder25(window[n])) !== hh || zonder25(window[n]).length !== l).map(([n]) => n + ' ' + fnv(zonder25(window[n])) + '/' + zonder25(window[n]).length);
    eis('PL8b zonder die regels zijn ze byte-gelijk aan V11.37.23 (alles is toegevoegd)', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
    const terug33 = (l) => l.replace(/conf < hoofdGrens\('leer'\)\) \{   \/\/ V11.37.33(?!d): de grens van het geladen model$/, 'conf < 0.20) {');   // V11.37.33: de vervangen regel in slaOp terug
    const zonder26 = (f) => String(f).split(NL).map(terug33).filter(l => !/V11\.37\.26(?!\d)|V11\.37\.30(?!\d)|V11\.37\.31(?!\d)|V11\.37\.34(?!\d)|V11\.37\.35(?!\d)|V11\.37\.36(?!\d)|V11\.37\.37(?!\d)|V11\.37\.38(?!\d)/.test(l)).join(NL);   // V11.37.26: twee regels in exporteerMeetdata (test_schaduw_nano)
    const anders2 = Object.entries(V113723.ongemoeid).filter(([n, [hh, l]]) => typeof window[n] !== 'function' || fnv(zonder26(window[n])) !== hh || zonder26(window[n]).length !== l).map(x => x[0]);
    eis('PL8c twintig functies rond de kaart, de namen, de lichtkeuze en het leren zijn niet aangeraakt', anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');
  } catch (e) {
    eis('PL de toets zelf', false, 'geen fout', String((e && e.stack) || e).slice(0, 300));
  } finally {
    window.fetch = bewaard.fetch;
    osmCache = bewaard.osmCache; dichtstbijOSM = bewaard.dichtstbijOSM; huidigeStad = bewaard.huidigeStad;
    plaatsenData = bewaard.plaatsenData; plaatsenBelofte = bewaard.plaatsenBelofte; plaatsenStand = bewaard.plaatsenStand;
    stadLaatstRefreshed = bewaard.stadLaatstRefreshed; huidigePos = bewaard.huidigePos;
    herstel();
    try { opslagHersynchroniseer(Object.keys(snap).concat(['sl_opslaglog'])); } catch (e) {}
  }
  const gefaald = regels.filter(x => x.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testPlaatsen = testPlaatsen; }
