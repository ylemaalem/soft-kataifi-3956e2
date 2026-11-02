// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetwerk23.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.23 (pakket A): veiligheid en eerlijkheid op het scherm, minder
//  plaatsdata naar buiten, en twee meetvelden. Geen invloed op de keuze van het
//  licht, de countdown, de metingen of de percentages.
//
//  MA1  een straatnaam met HTML of een ' in de radarlijst en het stadsfilter
//       wordt tekst, geen code; de knop filtert op de echte naam
//  MA2  de modelmelding: het gewone model (groen), de stille terugval op het
//       reservemodel (oranje, ook op de pil), en een echte fout met de reden
//  MA3  de bron 'V5 ' + pijl komt Latin-1 in sl_schaduwlog, sl_herzieninglog en
//       sl_bevestig_ (gewoon en via de bevriesregel); huidigCdBron blijft gelijk
//  MA4  terug bij hetzelfde licht: de eerdere regel x:'eg' r:'wissel' krijgt h:1,
//       andere regels niet; updateDichtbij roept het aan in het herstelblok
//  MA5  Nominatim: geen vraag meer met de plek van een licht; de plaatsnaamvraag
//       krijgt de positie op 0,01 graad
//  MA6  GLOSA (staat uit): nooit versnellen, nooit boven de limiet, zonder
//       limiet geen advies
//  MA7  zh: een rode fase met gezien begin, een blinde periode, het herstel:
//       de vlag blijft nee (pakket B verandert dat), maar de passage, de m5-regel
//       en een eventuele regel x:'eg' dragen zh:1; zonder blinde periode of
//       zonder gezien begin geen zh; met en zonder de haken dezelfde fase,
//       countdown, metingen en leerdata
//  MA8  d1 en dr: de afstand bij de eerste kleur en het eerste rood, in de
//       passage, de m5-regel en de regel x:'eg'
//  MA9  een vol quotum of een fout in de nieuwe code staakt alleen sl_passagelog
//  MA10 de nieuwe velden zijn klein
//  MA11 regressie: zonder de regels met merkteken V11.37.23 zijn de geraakte
//       functies byte-gelijk aan V11.37.22 (34ff4e5); twee regels zijn vervangen
//       (het stadsfilter en de plaatsnaamvraag) en daar is de oude regel weg;
//       zestien functies voor leren, countdown en lichtkeuze zijn niet aangeraakt
//
//  Alle plekken en nummers zijn bedacht: een basispunt (52.0000, 5.0000) en
//  verse lichtnummers vanaf 930000000, per run anders.
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_meetwerk23.js';
//      document.head.appendChild(s);
//      s.onload = () => testMeetwerk23().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: één scenario met de echte app-functies ──
async function meetwerk23Binnen(soort, opt) {
  opt = opt || {};
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const kopie = (x) => (x === undefined ? null : JSON.parse(JSON.stringify(x)));
  const PIJL = 'V5 ' + String.fromCharCode(0x2191), BS = String.fromCharCode(92);
  window.toonToast = () => {};
  window.downloadOSM = async () => {};
  for (const k of [M5_SLEUTEL, PASSAGE_SLEUTEL]) { localStorage.setItem(k, '[]'); meetRingGestopt.delete(k); }
  try { opslagHersynchroniseer([M5_SLEUTEL, PASSAGE_SLEUTEL]); } catch (e) {}
  m5Open = null; passageStaat = { open: new Map(), vorige: null, tVorig: 0 }; zhVoorReset = null; zhFase = null;
  const N = opt.N || 930000001;
  const emmer = (n, duren, dd) => opslagSchrijf('sl_v4_' + n + '_' + (dd || huidigDDActief()), duren.map((d, i) => ({ duur: d, tijd: Date.now() - 1000 * (i + 1), gewicht: 1 })));
  const latin1 = (s) => ![...String(s)].some(c => c.charCodeAt(0) > 255);

  if (soort === 'xss') {
    window.__xss = 0;
    const kwaad = '<img src=x onerror="window.__xss=1">';
    radarSheetNodes = [{ id: N, naam: kwaad, afst: 50, kleur: '#fff' }, { id: N + 1, naam: null, afst: 80, kleur: '#fff' }];
    renderRadarSheetNodeLijst();
    const c = document.getElementById('radar-sheet-nodes');
    await new Promise(r => setTimeout(r, 50));
    const radar = { img: c ? c.querySelectorAll('img').length : -1, tekst: c ? c.textContent : '', xss: window.__xss };
    window.alert = () => {};
    const steden = [String.fromCharCode(39) + 's-Testdorp', "x');window.__xss=2;('", 'Gewoon'];
    steden.forEach((s, i) => { localStorage.setItem('sl_richting_' + (N + 10 + i), JSON.stringify({ laatste_update: Date.now() - i, rijrichtingen: {} })); localStorage.setItem('sl_naam_' + (N + 10 + i), 'Weg ' + i + ', ' + s); });
    try { opslagHersynchroniseer(steden.map((s, i) => 'sl_richting_' + (N + 10 + i)).concat(steden.map((s, i) => 'sl_naam_' + (N + 10 + i)))); } catch (e) {}
    let fout = null, filters = [];
    try {
      toonV9Richtingen();
      for (const b of document.querySelectorAll('#v9-filter .filter-btn')) {
        if (!b.dataset || b.dataset.f === undefined) continue;
        v9ModalFilter = 'alle';
        try { b.click(); } catch (e) {}
        filters.push([b.dataset.f, v9ModalFilter]);
      }
    } catch (e) { fout = String(e); }
    await new Promise(r => setTimeout(r, 50));
    return { radar, filters, fout, xss: window.__xss, steden };
  }

  if (soort === 'model') {
    for (let i = 0; i < 150 && !modelGeladen && !/niet|Model laadde/.test(sModelLabel.textContent); i++) await new Promise(r => setTimeout(r, 100));
    window.fetch = async () => { throw new Error('geen netwerk in de toets'); };
    const uit = {};
    for (const stand of ['gewoon', 'reserve', 'kapot']) {
      modelTerugvalFout = null;
      ort.InferenceSession.create = async (pad) => {
        if (stand === 'kapot') throw new Error('proef: geheugen op');
        if (stand === 'reserve' && pad === './model.onnx') throw new Error('proef: niet gevonden');
        return { run: async () => ({}) };
      };
      await laadONNXModel();
      uit[stand] = { label: sModelLabel.textContent, kleur: sModelLabel.style.color, pil: pAIT.textContent, dot: pAI.className };
    }
    return uit;
  }

  if (soort === 'pijl') {
    const uit = {};
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 12 };
    huidigCdBron = PIJL;
    schaduwLogStop = false;
    schaduwSnapshot = { nodeId: String(N), dd: huidigDDActief(), geb: 40, bron: PIJL, b4: 40, s: null, n: 4, ns: 0, zag: false };
    schaduwLogSluit(30);
    const sch = lees('sl_schaduwlog'); uit.schaduw = sch.length ? sch[sch.length - 1].bron : null; uit.schaduwRuw = latin1(localStorage.getItem('sl_schaduwlog'));
    herzieningLogStop = false;
    cdHerzieningSnapshot = { nodeId: String(N), dd: huidigDDActief(), bron: PIJL, doelOud: 40, nBoven: 1, nTotaal: 4 }; herzTel = null;
    herzieningLogSluit(30, 'groen');
    const hz = lees('sl_herzieninglog'); uit.herz = hz.length ? hz[hz.length - 1].bron : null; uit.herzRuw = latin1(localStorage.getItem('sl_herzieninglog'));
    const opzet = (id) => {
      localStorage.removeItem('sl_bevestig_' + id);
      dichtstbijOSM = { id, lat: 52, lon: 5, afstand: 12, naam: 'TEST' };
      cdWallStart = null; cdWallNodeId = null; huidigCdBron = PIJL; huidigCdWaarde = 40;
      schaduwWaarden = { m1: null, m2: null, m3: null, m4: null }; schaduwCountdownNul = { m1: null, m2: null, m3: null, m4: null };
      laatsteRoodFaseStart = Date.now() - 60000; bevestigGedaanVoorFase = null;
      activeCdDoel = 40; activeCdModus = CD_GESCHAT; activeCdMin = null; activeCdMax = null;
      snelheidKmh = 0; aiKleur = 'groen';
      fase = 'groen'; cdBereikteNul = true; groenStart = performance.now(); countdownNulTijd = Date.now() - 15000; cdStart = null;
      bevestigActief = true; bevestigVoorNodeId = String(id); bevestigWrap.classList.add('actief'); bevInertStaat = '';
      bevestigVries = null; bevestigVriesNa = null;
    };
    opzet(N + 1); bevestigCountdown('klopte');
    const b1 = lees('sl_bevestig_' + (N + 1)); uit.bevestig = b1.length ? b1[b1.length - 1].bron : null; uit.bevestigRuw = latin1(localStorage.getItem('sl_bevestig_' + (N + 1)) || '');
    opzet(N + 2); bevestigBevries({ id: N + 3 }, 'wissel');
    uit.vriesGeheugen = bevestigVries ? bevestigVries.bron : null;
    bevestigActief = false; dichtstbijOSM = { id: N + 3, lat: 52, lon: 5, afstand: 40 };
    bevestigCountdown('fout');
    const b2 = lees('sl_bevestig_' + (N + 2)); uit.bevries = b2.length ? b2[b2.length - 1].bron : null; uit.bevriesRuw = latin1(localStorage.getItem('sl_bevestig_' + (N + 2)) || '');
    uit.cdBron = huidigCdBron;
    uit.verwacht = 'V5 ' + BS + 'u2191';
    return uit;
  }

  if (soort === 'terug') {
    const nu = Date.now();
    const ring = [
      { t: nu - 60000, x: 'eg', n: N, dd: 'dag', b: 0, mn: 9, r: 'wissel' },
      { t: nu - 20000, x: 'eg', n: N, dd: 'dag', b: 1, mn: 12, r: 'wissel' },
      { t: nu - 19000, x: 'eg', n: N + 1, dd: 'dag', b: 0, mn: 3, r: 'wissel' },
      { t: nu - 18000, x: 'eg', n: N, dd: 'dag', b: 0, mn: 4, r: 'uitval' }
    ];
    opslagSchrijf(PASSAGE_SLEUTEL, ring);
    eindeGemistTerug(N, 21000);
    const na1 = lees(PASSAGE_SLEUTEL).map(x => x.h || 0);
    eindeGemistTerug(N, 21000);
    const na2 = lees(PASSAGE_SLEUTEL).map(x => x.h || 0);
    opslagSchrijf(PASSAGE_SLEUTEL, ring.map(x => Object.assign({}, x, { h: undefined })));
    eindeGemistTerug(N, 5000);
    const na3 = lees(PASSAGE_SLEUTEL).map(x => x.h || 0);
    const bron = String(updateDichtbij);
    const i = bron.indexOf('delete nodeSessionData[terugkeerId];');
    const naDelete = i >= 0 ? bron.slice(i, i + 200) : '';
    return { na1, na2, na3, aanroep: /eindeGemistTerug\(terugkeerId, ouderdom\)/.test(naDelete) };
  }

  if (soort === 'nomi') {
    const urls = [];
    window.fetch = async (u) => { urls.push(String(u)); return { ok: true, json: async () => ({ address: { city: 'Testplaats', road: 'Testweg' } }) }; };
    const posVoor = huidigePos;
    huidigePos = { lat: 52.0001, lon: 5.0001 };
    const cacheVoor = osmCache;
    osmCache = [{ id: N, lat: 52.0002, lon: 5.0002, naam: 'x', straat: null }, { id: N + 1, lat: 52.0003, lon: 5.0003, naam: 'y', straat: null }];
    await haalStraatnamenOp();
    const naLicht = urls.filter(u => /nominatim/.test(u)).length;
    stadLaatstRefreshed = 0;
    await refreshStadIndienNodig(52.123456, 5.987654);
    osmCache = cacheVoor; huidigePos = posVoor;
    return { naLicht, urls, cache: localStorage.getItem('sl_stad_cache') };
  }

  if (soort === 'glosa') {
    window.berekenLeerPct = () => 80; window.isEenRichtingNode = () => true;
    window.berekenVRIScore = () => ({ totaalMetingen: 0, score: 100 }); window.zoekS2BevestigingScore = () => 0;
    const g = (kmh, max) => {
      fase = 'rood'; dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 150, maxspeed: max };
      snelheidKmh = kmh; activeCdDoel = 30; cdStart = performance.now() - 10000;   // nog ~20 s, 150 m: 27 km/u
      return berekenGlosa();
    };
    return { gewoon: g(40, 50), versnel: g(20, 50), zonderLimiet: g(40, null), limietOnbekend: g(40, undefined), bovenLimiet: g(40, 25), uit: GLOSA_ACTIEF };
  }

  if (soort === 'zh') {
    if (opt.zonder) { window.zhNoteerReset = () => {}; window.zhBijHerstel = () => {}; window.egAanvul = () => {}; window.m5Aanvul = () => {}; }
    emmer(N, [20, 40, 40, 60]);
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
    passageStaat.open.set(N, { t: Date.now() - 20000, n: N, lat: 52, lon: 5, ma: 12, w: 4, laatst: Date.now(), c1: 'g', d1: 140, c50: 'r', dr: 90 });
    fase = 'rood'; faseStart = performance.now() - 8000; faseNodeId = String(N); zagRoodOvergang = !!opt.zagVoor;
    cdWallStart = 700; activeCdDoel = 40;
    if (opt.blind !== false) {
      laatsteFase = fase; laatsteFaseStart = faseStart; laatsteFaseNodeId = String(N);
      resetNeutraal('dropout');
      dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 30 };
      verwerkFase('rood', true, 0.9);
    }
    const naHerstel = { fase, zag: zagRoodOvergang, node: faseNodeId, m5: m5Open ? kopie(m5Open.rec) : null, pzh: (passageStaat.open.get(N) || {}).zh || 0 };
    if (opt.eind === 'eg') { beeindigFase('geen'); }
    else verwerkFase('groen', true, 0.9);
    const m5 = lees(M5_SLEUTEL);
    const p = passageStaat.open.get(N);
    if (p) { passageStaat.open.delete(N); passageSchrijf(p); }
    const pas = lees(PASSAGE_SLEUTEL);
    let daarna = null;
    if (opt.daarna) {   // een volgende rode fase bij hetzelfde licht erft zh niet
      fase = 'rood'; faseStart = performance.now() - 3000; faseNodeId = String(N); zagRoodOvergang = false; cdWallStart = 701; activeCdDoel = 40;
      m5Start(N, huidigDDActief(), null, null, 'V4'); m5Sluit(20, 'groen');
      daarna = lees(M5_SLEUTEL).slice(-1)[0] || null;
    }
    const leer = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.includes(String(N)) && /^sl_(v4|v5|passief|klok|s2|bevestig|richting|neutraal)_/.test(k)) leer[k] = localStorage.getItem(k); }
    return { naHerstel, m5, pas, leer, daarna, cd: { doel: activeCdDoel, modus: activeCdModus, bron: huidigCdBron } };
  }

  if (soort === 'dr') {
    const LAT0 = 52.0000, mLat = 111320;
    const plek = (m) => LAT0 - m / mLat;
    dichtstbijOSM = { id: N, lat: LAT0, lon: 5, afstand: 150 };
    snelheidKmh = 30;
    fase = 'groen'; faseNodeId = String(N); faseStart = performance.now();
    passageTik(plek(150), 5);
    fase = 'rood'; faseStart = performance.now(); zagRoodOvergang = false;
    passageTik(plek(100), 5);
    passageTik(plek(60), 5);
    const p = kopie(passageStaat.open.get(N));
    cdWallStart = 900; activeCdDoel = 40;
    emmer(N, [20, 40, 40, 60], 'dag');
    m5Start(N, 'dag', null, null, 'V4');
    m5Sluit(30, 'groen');
    const m5 = lees(M5_SLEUTEL).slice(-1)[0] || null;
    fase = 'rood'; faseStart = performance.now() - 10000; faseNodeId = String(N);
    eindeGemistLog('geen');
    const eg = lees(PASSAGE_SLEUTEL).slice(-1)[0] || null;
    const q = passageStaat.open.get(N); passageStaat.open.delete(N); q.ma = 10; passageSchrijf(q);
    const pas = lees(PASSAGE_SLEUTEL).slice(-1)[0] || null;
    return { p, m5, eg, pas };
  }

  if (soort === 'vol') {
    const uit = {};
    opslagSchrijf(PASSAGE_SLEUTEL, [{ t: Date.now(), x: 'eg', n: N, dd: 'dag', b: 0, mn: 5, r: 'wissel' }]);
    passageStaat.open.set(N, { t: Date.now(), n: N, lat: 52, lon: 5, ma: 50, w: 0, laatst: Date.now(), d1: 120 });
    const os = opslagSchrijf;
    window.opslagSchrijf = (k, v) => (k === PASSAGE_SLEUTEL ? false : os(k, v));
    let ontsnapt = null;
    try { egAanvul(N); } catch (e) { ontsnapt = String(e); }
    uit.egAanvul = { ontsnapt, gestopt: meetRingGestopt.has(PASSAGE_SLEUTEL), weg: localStorage.getItem(PASSAGE_SLEUTEL) === null };
    window.opslagSchrijf = os;
    meetRingGestopt.delete(PASSAGE_SLEUTEL); opslagSchrijf(PASSAGE_SLEUTEL, [{ t: Date.now(), x: 'eg', n: N, dd: 'dag', b: 0, mn: 5, r: 'wissel' }]);
    window.opslagSchrijf = (k, v) => (k === PASSAGE_SLEUTEL ? false : os(k, v));
    ontsnapt = null;
    try { eindeGemistTerug(N, 10000); } catch (e) { ontsnapt = String(e); }
    uit.terug = { ontsnapt, gestopt: meetRingGestopt.has(PASSAGE_SLEUTEL) };
    window.opslagSchrijf = os;
    // een fout IN de hulpfuncties: m5Sluit en eindeGemistLog lopen door
    meetRingGestopt.delete(PASSAGE_SLEUTEL); meetRingGestopt.delete(M5_SLEUTEL);
    localStorage.setItem(PASSAGE_SLEUTEL, '[]'); localStorage.setItem(M5_SLEUTEL, '[]');
    try { opslagHersynchroniseer([M5_SLEUTEL, PASSAGE_SLEUTEL]); } catch (e) {}
    window.m5Aanvul = () => { throw new Error('gif'); }; window.egAanvul = () => { throw new Error('gif'); };
    dichtstbijOSM = { id: N, lat: 52, lon: 5, afstand: 20 };
    fase = 'rood'; zagRoodOvergang = false; faseStart = performance.now() - 9000; faseNodeId = String(N); cdWallStart = 901; activeCdDoel = 40;
    emmer(N, [20, 40], 'dag');
    m5Start(N, 'dag', null, null, 'V4');
    ontsnapt = null;
    try { m5Sluit(25, 'groen'); eindeGemistLog('geen'); } catch (e) { ontsnapt = String(e); }
    uit.gif = { ontsnapt, m5: lees(M5_SLEUTEL).length, eg: lees(PASSAGE_SLEUTEL).length };
    return uit;
  }
  return { fout: 'onbekend scenario ' + soort };
}

async function testMeetwerk23() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const NL = String.fromCharCode(10), BS = String.fromCharCode(92);
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
  const basis = 930000000 + Math.floor(Math.random() * 1e6) * 100;
  let volg = 0;
  const vers = () => basis + 100 * (volg++);

  // ── een scenario in een eigen iframe (de app daar is wegwerp) ──
  const pagina = location.pathname;
  const bron23 = new URL('test_meetwerk23.js', location.href).href;
  const inFrame = async (doe) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?meetwerk23=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.onGPS !== 'function'; poging++) {
        if (poging > 3) throw new Error('testopstelling: de app laadde niet in de iframe (3 pogingen)');
        await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; f.src = pagina + '?opnieuw=' + Math.random(); });
      }
      const w = f.contentWindow;
      const bron = bron23;
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

  // ═══ MA1 — straatnamen ═══════════════════════════════════════
  const x1 = await inFrame((w) => w.meetwerk23Binnen('xss', { N: vers() }));
  eis('MA1a een straatnaam met HTML in de radarlijst wordt tekst: geen img, geen code, de naam staat er leesbaar',
      !x1.fout && x1.radar.img === 0 && x1.radar.xss === 0 && x1.radar.tekst.indexOf('<img') >= 0, 'tekst, 0 img, geen code', kort(x1.radar || x1));
  const f1 = (x1.filters || []);
  eis('MA1b het stadsfilter: elke stadsknop filtert op precies de naam, ook met een apostrof en met een vergiftigde naam; die draait geen code',
      !x1.fout && f1.length === 3 && f1.every(([d, v]) => d === v) && x1.steden.every(s => f1.some(([d]) => d === s)) && x1.xss === 0,
      '3 knoppen, filter = naam, geen code', kort({ f1, xss: x1.xss, fout: x1.fout }));

  // ═══ MA2 — de modelmelding ═══════════════════════════════════
  const m2 = await inFrame((w) => w.meetwerk23Binnen('model', {}));
  eis('MA2a het gewone model: groen "klaar", de pil YOLOv8',
      !m2.fout && /YOLOv8 klaar/.test(m2.gewoon.label) && m2.gewoon.pil === 'YOLOv8' && /groen/.test(m2.gewoon.kleur), 'klaar, YOLOv8', kort(m2.gewoon || m2));
  eis('MA2b de terugval op het reservemodel is te zien: oranje melding en de pil "Reserve"',
      !m2.fout && /Reservemodel geladen/.test(m2.reserve.label) && /oranje/.test(m2.reserve.kleur) && m2.reserve.pil === 'Reserve' && /pill-dot o/.test(m2.reserve.dot),
      'Reservemodel, oranje, Reserve', kort(m2.reserve || m2));
  eis('MA2c een echte fout noemt de reden in plaats van altijd "niet gevonden"',
      !m2.fout && /Model laadde niet: proef: geheugen op/.test(m2.kapot.label), 'de reden', kort(m2.kapot || m2));

  // ═══ MA3 — de pijl Latin-1 ═══════════════════════════════════
  const p3 = await inFrame((w) => w.meetwerk23Binnen('pijl', { N: vers() }));
  const V = 'V5 ' + BS + 'u2191';
  eis('MA3a sl_schaduwlog en sl_herzieninglog: de bron staat als tekst ' + V + ', geen teken boven U+00FF',
      !p3.fout && p3.schaduw === V && p3.schaduwRuw && p3.herz === V && p3.herzRuw, V, kort(p3));
  eis('MA3b sl_bevestig_: ook via de gewone knop en via de bevriesregel na een wissel',
      !p3.fout && p3.bevestig === V && p3.bevestigRuw && p3.bevries === V && p3.bevriesRuw, V, kort(p3));
  eis('MA3c in het geheugen blijft de bron gewoon de pijl (de countdown en de bevriesregel lezen hem zo)',
      !p3.fout && p3.cdBron === 'V5 ' + String.fromCharCode(0x2191) && p3.vriesGeheugen === 'V5 ' + String.fromCharCode(0x2191), 'pijl', kort({ cd: p3.cdBron, vries: p3.vriesGeheugen }));

  // ═══ MA4 — terug bij hetzelfde licht ═════════════════════════
  const t4 = await inFrame((w) => w.meetwerk23Binnen('terug', { N: vers() }));
  eis('MA4a alleen de laatste wissel-regel van dit licht binnen de terugkeertijd krijgt h:1 (niet een oudere, niet een ander licht, niet een uitval)',
      !t4.fout && JSON.stringify(t4.na1) === '[0,1,0,0]', '[0,1,0,0]', kort(t4));
  eis('MA4b een tweede keer verandert niets, en buiten de terugkeertijd ook niet',
      !t4.fout && JSON.stringify(t4.na2) === '[0,1,0,0]' && JSON.stringify(t4.na3) === '[0,0,0,0]', '[0,1,0,0] en [0,0,0,0]', kort(t4));
  eis('MA4c updateDichtbij roept het aan in het herstelblok, direct na het opruimen van de sessie', !t4.fout && t4.aanroep === true, 'ja', kort(t4));

  // ═══ MA5 — Nominatim ═════════════════════════════════════════
  const n5 = await inFrame((w) => w.meetwerk23Binnen('nomi', { N: vers() }));
  eis('MA5a geen vraag meer met de plek van een licht', !n5.fout && n5.naLicht === 0, '0', kort(n5));
  eis('MA5b sinds V11.37.25 ook geen plaatsnaamvraag meer met je positie (NOMINATIM_STAD_AAN); de afronding op 0,01 graad blijft staan voor als hij weer aan gaat',   // V11.37.25: was de vraag met de afgeronde positie, zie test_plaatsen
      !n5.fout && (n5.urls || []).filter(u => /nominatim/.test(u)).length === 0 && stadAfgerond(52.123456) === '52.12' && stadAfgerond(5.987654) === '5.99', 'geen vraag; 52.12 en 5.99', kort((n5.urls || []).filter(u => /nominatim/.test(u))));

  // ═══ MA6 — GLOSA ═════════════════════════════════════════════
  const g6 = await inFrame((w) => w.meetwerk23Binnen('glosa', { N: vers() }));
  eis('MA6 GLOSA blijft uit; het advies (27 km/u) alleen als dat niet sneller is dan je rijdt en niet boven een bekende limiet',
      !g6.fout && g6.uit === false && g6.gewoon === 27 && g6.versnel === null && g6.zonderLimiet === null && g6.limietOnbekend === null && g6.bovenLimiet === null,
      'uit, 27, null, null, null, null', kort(g6));

  // ═══ MA7 — zh ════════════════════════════════════════════════
  const TIJDVELD = ['zh', 'pzh', 't', 'tijd', 'ts', 'laatste_update', 'sinds', 'laatst', 'opgeslagenOp'];
  const norm = (x) => {
    if (typeof x === 'string' && /^[\[{]/.test(x)) { try { return norm(JSON.parse(x)); } catch (e) { return x; } }
    if (Array.isArray(x)) return x.map(norm);
    if (x && typeof x === 'object') { const nieuw = ('nm' in x || x.x === 'eg') ? ['d1', 'dr'] : ['dr']; return Object.fromEntries(Object.keys(x).sort().filter(q => !TIJDVELD.includes(q) && !nieuw.includes(q)).map(q => [q, norm(x[q])])); }   // d1/dr zijn nieuw (MA8); de passage had d1 al
    return x;
  };
  const zonderVeld = (x) => JSON.stringify(norm(x));
  const zh = {}, zhN = {};
  for (const [naam, opt] of [['gezien', { zagVoor: true, daarna: true }], ['gemist', { zagVoor: false }], ['zonderBlind', { zagVoor: true, blind: false }], ['eg', { zagVoor: true, eind: 'eg' }]]) {
    for (const zonder of [false, true]) {
      const N7 = vers();
      const r = await inFrame((w) => w.meetwerk23Binnen('zh', Object.assign({ N: N7, zonder }, opt)));
      zh[naam + (zonder ? '_zonder' : '')] = r; zhN[naam + (zonder ? '_zonder' : '')] = N7;
    }
  }
  const G = zh.gezien, Gm5 = (G.m5 || []).slice(-1)[0] || {}, Gpas = (G.pas || []).filter(x => !x.x).slice(-1)[0] || {};
  eis('MA7a gezien begin, blinde periode, herstel: de vlag blijft nee (pakket A verandert hem niet), de passage en de m5-regel dragen zh:1',
      !G.fout && G.naHerstel.zag === false && G.naHerstel.pzh === 1 && Gm5.zh === 1 && Gpas.zh === 1,
      'zag nee, zh 1 en 1', kort({ zag: G.naHerstel && G.naHerstel.zag, m5: Gm5, pas: Gpas, fout: G.fout }));
  const E = zh.eg, Eeg = (E.pas || []).filter(x => x.x === 'eg').slice(-1)[0] || {};
  eis('MA7b eindigt die fase zonder groen, dan draagt de regel x:\'eg\' zh:1, met d1 en dr',
      !E.fout && Eeg.zh === 1 && Eeg.d1 === 140 && Eeg.dr === 90, 'zh 1, d1 140, dr 90', kort(Eeg));
  eis('MA7e een volgende rode fase bij hetzelfde licht (nieuw begin) krijgt geen zh',
      !G.fout && !!G.daarna && G.daarna.zh === undefined && G.daarna.e === 'groen', 'geen zh', kort(G.daarna));
  const zonderZh = (k) => !zh[k].fout && JSON.stringify(zh[k]).indexOf('"zh"') < 0 && zh[k].naHerstel.pzh === 0;
  eis('MA7c zonder gezien begin, of zonder blinde periode: nergens zh',
      zonderZh('gemist') && zonderZh('zonderBlind'), 'geen zh', kort({ gemist: zh.gemist.m5, zb: zh.zonderBlind.m5 }));
  const tekst7 = (k) => zonderVeld(zh[k]).split(String(zhN[k])).join('N');
  const gelijk7 = ['gezien', 'gemist', 'zonderBlind', 'eg'].filter(k => !!zh[k].fout || tekst7(k) !== tekst7(k + '_zonder'));
  eis('MA7d met en zonder de nieuwe haken: dezelfde fase en vlag na het herstel, dezelfde countdown, metingen en leerdata (op zh na)',
      gelijk7.length === 0 && Object.keys(G.leer || {}).length >= 1, 'gelijk', gelijk7.map(k => { const a = tekst7(k), b = tekst7(k + '_zonder'); let i = 0; while (i < a.length && a[i] === b[i]) i++; return k + ' @' + i + ' ' + a.slice(Math.max(0, i - 60), i + 60) + ' <> ' + b.slice(Math.max(0, i - 60), i + 60); }).join(' || ') || ('gelijk, ' + Object.keys(G.leer || {}).length + ' sleutels'));

  // ═══ MA8 — d1 en dr ══════════════════════════════════════════
  const d8 = await inFrame((w) => w.meetwerk23Binnen('dr', { N: vers() }));
  eis('MA8a de passage onthoudt de eerste kleur (groen op 150 m) en het eerste rood (100 m)',
      !d8.fout && d8.p && d8.p.c1 === 'g' && d8.p.d1 === 150 && d8.p.dr === 100, 'g 150, rood 100', kort(d8.p || d8));
  eis('MA8b de m5-regel, de regel x:\'eg\' en de passage dragen d1 150 en dr 100 (de passage had d1 al)',
      !d8.fout && d8.m5 && d8.m5.d1 === 150 && d8.m5.dr === 100 && d8.eg && d8.eg.x === 'eg' && d8.eg.d1 === 150 && d8.eg.dr === 100 && d8.pas && d8.pas.d1 === 150 && d8.pas.dr === 100 && d8.pas.zh === undefined,
      '150/100 driemaal', kort({ m5: d8.m5, eg: d8.eg, pas: d8.pas }));

  // ═══ MA9 — vol en fout ═══════════════════════════════════════
  const v9 = await inFrame((w) => w.meetwerk23Binnen('vol', { N: vers() }));
  eis('MA9a een vol quotum bij het aanvullen of bij terug-bij-hetzelfde-licht: alleen sl_passagelog stopt en is weg, geen fout naar buiten',
      !v9.fout && v9.egAanvul.ontsnapt === null && v9.egAanvul.gestopt && v9.egAanvul.weg && v9.terug.ontsnapt === null && v9.terug.gestopt,
      'gestopt, weg, geen fout', kort(v9));
  eis('MA9b een fout in m5Aanvul of egAanvul: de m5-regel en de regel x:\'eg\' worden toch geschreven, niets ontsnapt',
      !v9.fout && v9.gif.ontsnapt === null && v9.gif.m5 === 1 && v9.gif.eg === 1, '1 en 1', kort(v9.gif || v9));

  // ═══ MA10 — klein ════════════════════════════════════════════
  const extra = (o, velden) => JSON.stringify(o).length - JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k]) => !velden.includes(k)))).length;
  const e10 = [extra(Gm5, ['zh', 'd1', 'dr']), extra(Gpas, ['zh', 'dr']), extra(Eeg, ['zh', 'd1', 'dr'])];
  eis('MA10 de nieuwe velden kosten per regel hooguit 26 tekens (m5: zh+d1+dr, passage: zh+dr, eg: zh+d1+dr)',
      !G.fout && e10.every(x => x > 0 && x <= 26), '<= 26', e10.join(' / '));

  // ═══ MA11 — regressie ════════════════════════════════════════
  // Gemeten in de bron van V11.37.22 (34ff4e5) in een eigen headless Chrome, niet afgeleid uit deze versie.
  const V113722 = { schaduwLogSluit: ['ecec51c5', 1838], herzieningLogSluit: ['e2933258', 4059], passageTik: ['6a149b73', 1360], passageSchrijf: ['582f3b00', 584],
    eindeGemistLog: ['8563cad5', 595], m5Sluit: ['23ca1ffd', 583], laadONNXModel: ['42393b17', 4644], resetNeutraal: ['d640674', 3685], verwerkFase: ['318bb458', 12835],
    bevestigNaWisselPad: ['bcc5d149', 2858], bevestigCountdown: ['47fa9a6b', 16337], berekenGlosa: ['a8049ae0', 1549], haalStraatnamenOp: ['2a318437', 1102],
    updateDichtbij: ['cbf57ede', 12709], renderRadarSheetNodeLijst: ['76755bea', 1113] };
  // Twee regels zijn vervangen: daar is de vingerafdruk die van V11.37.22 zonder de oude regel.
  const VERVANGEN = { toonV9Richtingen: ['31a5c83', 1639], refreshStadIndienNodig: ['dc5c1dee', 981] };
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.23(?!\d)/.test(l)).length;
  const telVerwacht = { laadONNXModel: 3, berekenGlosa: 2, schaduwLogSluit: 1, herzieningLogSluit: 1, passageTik: 1, passageSchrijf: 1, eindeGemistLog: 1, m5Sluit: 1,
    resetNeutraal: 1, verwerkFase: 1, bevestigNaWisselPad: 1, bevestigCountdown: 1, haalStraatnamenOp: 1, toonV9Richtingen: 1, refreshStadIndienNodig: 1, updateDichtbij: 1, renderRadarSheetNodeLijst: 1 };
  const telAf = Object.entries(telVerwacht).filter(([n, m]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('MA11a zeventien functies krijgen regels met merkteken V11.37.23: laadONNXModel 3, berekenGlosa 2, de andere 1',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const zonder23 = (f) => String(f).split(NL).filter(l => !/V11\.37\.23(?!\d)|V11\.37\.25(?!\d)/.test(l)).join(NL);   // V11.37.25: ook de regels van V11.37.25 (test_plaatsen)
  const anders = Object.entries(Object.assign({}, V113722, VERVANGEN)).filter(([n, [h, l]]) => { const s = zonder23(window[n]); return fnv(s) !== h || s.length !== l; })
    .map(([n]) => n + ' ' + fnv(zonder23(window[n])) + '/' + zonder23(window[n]).length);
  eis('MA11b zonder die regels zijn ze byte-gelijk aan V11.37.22 (vijftien alleen toegevoegd; bij het stadsfilter en de plaatsnaamvraag is precies de oude regel vervangen)',
      anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const ONGEMOEID = { startCd: ['4c0000d7', 7397], m5Start: ['be850b01', 1370], eindeGemistHersteld: ['e82722ce', 690], slaOp: ['411179eb', 3252], slaOpIntern: ['c284229a', 2342],
    slaPassiefMeting: ['eac878bc', 1945], kiesCountdownBron: ['8e69db98', 12851], gewGem: ['eb1936ea', 1025], vindDichtbij: ['d32386d8', 4753], meetRingSchrijf: ['60245787', 420],
    stopLogAf: ['21c4b6e6', 928], beeindigFase: ['8234b742', 1404], onGPS: ['454f7f25', 15761], berekenLeerPct: ['5d38efe9', 986], verwerkBevestigLeren: ['9163848', 8583], exporteerMeetdata: ['64c15a78', 10084] };
  const anders2 = Object.entries(ONGEMOEID).filter(([n, [h, l]]) => fnv(String(window[n])) !== h || String(window[n]).length !== l).map(x => x[0]);
  eis('MA11c zestien functies voor het leren, de countdown, de lichtkeuze en de export zijn helemaal niet aangeraakt', anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');
  let code = [];
  try {
    const html = await (await fetch(new URL('index.html', location.href).href + '?t=' + Date.now())).text();
    code = html.split(NL).filter(l => /V11\.37\.23(?!\d)/.test(l) && !/^\s*\/\//.test(l));
  } catch (e) { code = ['fout: ' + e]; }
  eis('MA11d in de bron staat V11.37.23 buiten het commentaar alleen in die twintig regels in de zeventien functies (het blok zelf heeft een eigen kop; de versieregel heet sinds V11.37.25 anders)',
      code.length === 20 && code.filter(l => /^const APP_VERSIE/.test(l)).length === 0,   // V11.37.25: de versieregel heet anders
      '20 regels', code.length + ': ' + code.map(l => l.trim().slice(0, 30)).join(' | '));

  herstel();
  try { opslagHersynchroniseer(Object.keys(snap)); } catch (e) {}
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testMeetwerk23 = testMeetwerk23; window.meetwerk23Binnen = meetwerk23Binnen; }
