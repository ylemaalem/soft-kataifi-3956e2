// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_kaartbestand.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.20: de kaart uit een eigen bestand (kaart/), Overpass alleen
//  nog als reserve.
//
//  KF1  de constanten en het adres van de bestanden
//  KF2  de afstand zoals Overpass hem meet (10.000 km per 90 graden)
//  KF3  de vakken rond een plek: elk licht binnen 5 km ligt in een gelezen vak
//  KF4  een geknipte kaart is precies het Overpass-antwoord (zelfde elementen,
//       volgorde en vorm), met de datum zonder kloktijd
//  KF5  de verwerking is ongewijzigd: dezelfde lichtenlijst (osmCache) als met
//       hetzelfde antwoord van Overpass
//  KF6  de fietslijst uit het bestand, zonder vraag aan Overpass
//  KF7  een tweede start haalt alleen versie.json, niet de bestanden
//  KF8  storingen (sha256, kapot, lengte, 404, versie.json kapot, worker kapot):
//       terug naar Overpass, met de reden in de log; niets bewaard
//  KF9  een kapotte nieuwe versie: de oude blijft in gebruik
//  KF10 een goede nieuwe versie: na de keuring de actieve; de oude vakken weg
//  KF11 ouderdom: na 45 dagen een logregel, na 180 dagen 'Kaart oud'; nooit geweigerd
//  KF12 de pil en het onderste vak tijdens het ophalen
//  KF13 het inlezen wacht op het model
//  KF14 één kaartverbinding tegelijk (kaartNetRij); ook kaart- en fietsvraag aan Overpass samen
//  KF15 in een iframe (zonder toets) en vóór Start staat het bestand uit: de app vraagt Overpass zoals vroeger
//  KF16 regressie: de vier geraakte functies zonder de V11.37.20-regels byte-gelijk
//       aan V11.37.18; 48 functies ongewijzigd; de merkregels
//  KF17 de bron op de kaartweergave
//  KF18 de leerdata: een kaart uit het bestand raakt dezelfde sleutels als een kaart van Overpass
//  KF19-KF26 de crashbewaking: een poging die stierf (merkteken 'bezig'), de pauze, het
//       verlopen ervan, een goed bestand tijdens de pauze, het wissen na succes, een
//       geweigerd bestand niet steeds opnieuw, de achtergrond, te traag inlezen;
//       KF27 de achtergrond en weer in beeld in het merkteken; KF24b een ontbrekend bestand geeft geen pauze
//  KF28 een database die nooit antwoordt: na 10 s de kaart van Overpass, en de volgende starts niet weer 10 s
//  KF29 een tik op de Kaart-pil tijdens de pauze: de pauze weg, één nieuwe poging, het aantal blijft in de log
//
//  Alle plekken, nummers en namen zijn bedacht: een basispunt (52.0000, 5.0000),
//  lichten 97000xx, wegen 98000xx, punten 97900xx, namen 'Weg A' tot 'Weg E'.
//  De bestanden staan in blob-adressen (kaartBestandUrl vervangen), niet in kaart/.
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_kaartbestand.js';
//      document.head.appendChild(s);
//      s.onload = () => testKaartbestand().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════
// V11.37.21: de regels met dit merkteken weg, zodat de vergelijkingen hieronder de functies van vóór V11.37.21 blijven toetsen (zie test_meetwerk21)
function zonderV113721(s) { return String(s).split('\n').map(terugV113731).map(terugV113726).filter(l => !/V11\.37\.21(?!\d)|V11\.37\.22(?!\d)|V11\.37\.23(?!\d)|V11\.37\.25(?!\d)|V11\.37\.26(?!\d)|V11\.37\.30(?!\d)|V11\.37\.31(?!\d)/.test(l)).join('\n'); }   // V11.37.22: ook de meetregels van V11.37.22 (test_meetwerk22); V11.37.23: idem (test_meetwerk23); V11.37.25: idem (test_plaatsen)   // V11.37.26: idem (test_schaduw_nano), met terugV113726
// V11.37.26: drie regels van laadONNXModel zijn vervangen (de modelnaam komt uit MODEL_PADEN, test_schaduw_nano).
// Die gaan hier terug naar de oude tekst; daarna vallen de regels met merkteken V11.37.26 weg zoals de andere.
// V11.37.31: Nano is het hoofdmodel; deze regels zijn VERVANGEN (niet toegevoegd). Hier gaat precies de oude regel terug,
// zodat de vergelijkingen hieronder de oude functies blijven toetsen. Toegevoegde regels vallen weg via het merkteken V11.37.31.
var TERUG_V113731 = {"  if (totaalMCheck === 0 && (obsNu == null || obsNu < OBS_MINIMUM) && conf != null && conf < hoofdGrens('leer')) {   // V11.37.33: de grens van het geladen model": "  if (totaalMCheck === 0 && (obsNu == null || obsNu < OBS_MINIMUM) && conf != null && conf < 0.20) {", "    if (Array.isArray(detecties) && detecties.some(d => familieScore(d) >= hoofdGrens('sterk'))) minStat.s[b]++;   // V11.37.33: de grens van het geladen model": "    if (Array.isArray(detecties) && detecties.some(d => familieScore(d) >= MINUUT_STERK)) minStat.s[b]++;", "  if (gesmoothedScore >= hoofdGrens('camNode') && snelheidKmh > 5 && huidigePos) {   // V11.37.33: de grens van het geladen model": "  if (gesmoothedScore >= 0.60 && snelheidKmh > 5 && huidigePos) {", "    if (familieScore(bbox) < hoofdGrens('s2Fam')) continue;   // V11.37.33: de grens van het geladen model": "    if (familieScore(bbox) < 0.35) continue;", "    if (kleur && bbox.score >= hoofdGrens('s2Aanwezig')) slaS2Aanwezigheid(match.nodeId, kleur);   // V11.37.33: de grens van het geladen model": "    if (kleur && bbox.score >= 0.50) slaS2Aanwezigheid(match.nodeId, kleur);", "    if (trainframesAan) slaTrainframeOp('s2', bbox.klasse, bbox.cx/YOLO_SIZE, bbox.cy/YOLO_SIZE, bbox.w/YOLO_SIZE, bbox.h/YOLO_SIZE, bbox.score < hoofdGrens('tfTwijfelS2'));   // V11.37.33: de grens van het geladen model": "    if (trainframesAan) slaTrainframeOp('s2', bbox.klasse, bbox.cx/YOLO_SIZE, bbox.cy/YOLO_SIZE, bbox.w/YOLO_SIZE, bbox.h/YOLO_SIZE, bbox.score < 0.55);", "    const _hoogFScore = (aiR.fScore || 0) >= hoofdGrens('fscore');   // V11.37.33: de grens van het geladen model": "    const _hoogFScore = (aiR.fScore || 0) >= FSCORE_OVERRIDE_DREMPEL;", "    if (aiTeller === 1 && trainframesAan && aiR.box && aiR.score < hoofdGrens('s1Twijfel')) {   // V11.37.33: de grens van het geladen model": "    if (aiTeller === 1 && trainframesAan && aiR.box && aiR.score < 0.60) {", "    const wasStabiel = greenConfHistory.length >= 2 && gemGreen > hoofdGrens('groenStabiel');   // V11.37.33: de grens van het geladen model": "    const wasStabiel = greenConfHistory.length >= 2 && gemGreen > GREEN_STABIEL_DREMPEL;", "  if (b.tap) return !(fam >= hoofdTapConf()) ? 'conf_tik' : (b.h < 2 || b.w <= 0) ? 'klein' : 'door';   // V11.37.33: de grens van het geladen model": "  if (b.tap) return !(fam >= TAP_CONF_DREMPEL) ? 'conf_tik' : (b.h < 2 || b.w <= 0) ? 'klein' : 'door';", "  if (!(fam >= hoofdConf())) return 'conf';   // V11.37.33: de grens van het geladen model": "  if (!(fam >= CONF_DREMPEL)) return 'conf';", "    let modelPad = hoofdPaden()[0];   // V11.37.31: Nano eerst (HOOFD_PADEN_NANO), zie het blok V11.37.31": "    let modelPad = './model.onnx';", "      onnxSession = await hoofdSessie(modelPad);   // V11.37.31: één download, de sessie op de hoofdthread pas als er geen worker is": "      onnxSession = await ort.InferenceSession.create(modelPad, { executionProviders:['wasm'], graphOptimizationLevel:'all' });", "      modelPad = hoofdPaden()[1];   // V11.37.31: de reserve uit de lijst": "      modelPad = './model/model.onnx';", "    if (!(modelSoortVan(modelPad) in MODEL_SOORTEN)) throw new Error('hoofdpad ' + modelPad + ': onbekende soort');   // V11.37.31: YOLOv8 of YOLOX; de worker en de nabewerking volgen de soort": "    if (modelSoortVan(modelPad) !== 'yolov8') throw new Error('hoofdpad ' + modelPad + ' is geen YOLOv8-bestand');   // V11.37.26: het hoofdpad leest alleen YOLOv8 (images RGB 0..1, output0)", "    pAI.className='pill-dot g'; pAIT.textContent=hoofdLabel(modelPad);   // V11.37.31: 'Nano' of 'YOLOv8n'": "    pAI.className='pill-dot g'; pAIT.textContent='YOLOv8n';   // V11.37.26: was 'YOLOv8'", "      const modelArrayBuffer = await hoofdBuffer(modelPad);   // V11.37.31: dezelfde download als hoofdSessie, geen tweede": "      const modelArrayBuffer = await fetch(modelPad).then(r=>r.arrayBuffer());", "      const blob = new Blob([hoofdWorkerCode(modelPad)], { type:'application/javascript' });   // V11.37.31: de Nano-worker voor een YOLOX-bestand": "      const blob = new Blob([YOLO_WORKER_CODE], { type:'application/javascript' });", "      if (famScore < hoofdTapConf()) continue;   // V11.37.31: de drempel van het geladen model (Nano 0,03)": "      if (famScore < TAP_CONF_DREMPEL) continue;", "      if (famScore < hoofdConf()) continue;   // V11.37.31: idem (Nano 0,07)": "      if (famScore < CONF_DREMPEL) continue;", "  './model.onnx':            { soort: 'yolov8', naam: 'YOLOv8n',                rol: 'reserve' },   // V11.37.31: was hoofd (zie HOOFD_PADEN_NANO)": "  './model.onnx':            { soort: 'yolov8', naam: 'YOLOv8n',                rol: 'hoofd' },", "  './model/model.onnx':      { soort: 'yolov8', naam: 'YOLOv8n (reservemodel)', rol: 'reserve2' },   // V11.37.31: was reserve (alleen nog na sl_hoofdmodel=yolov8)": "  './model/model.onnx':      { soort: 'yolov8', naam: 'YOLOv8n (reservemodel)', rol: 'reserve' },", "  './model/yolox_nano.onnx': { soort: 'yolox',  naam: 'YOLOX-Nano',             rol: 'hoofd' }   // V11.37.31: was schaduw": "  './model/yolox_nano.onnx': { soort: 'yolox',  naam: 'YOLOX-Nano',             rol: 'schaduw' }"};
function terugV113731(l) { return Object.prototype.hasOwnProperty.call(TERUG_V113731, l) ? TERUG_V113731[l] : l; }
function terugV113726(l) {
  if (!/V11\.37\.26(?!\d)/.test(l)) return l;
  return l.replace(/^(\s*)sModelLabel\.textContent = '🤖 Model laden…';.*$/, "$1sModelLabel.textContent = '🤖 YOLOv8 model laden…';")
          .replace(/^(\s*)sModelLabel\.textContent = `✓ Model klaar: \$\{modelNaamVan\(modelPad\)\} \(\$\{t\}s\)`;.*$/, '$1sModelLabel.textContent = `✓ YOLOv8 klaar (${t}s)`;')
          .replace(/^(\s*)pAI\.className='pill-dot g'; pAIT\.textContent='YOLOv8n';.*$/, "$1pAI.className='pill-dot g'; pAIT.textContent='YOLOv8';");
}

const KF_IDB = 'StoplichtIQ_Kaartbestand';
const KF_COPY = 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.';

// De bedachte data: lichten rond 52.0000 / 5.0000, binnen en buiten 5 km, over vakgrenzen heen.
function kfBasis() {
  const L = (id, lat, lon, tags) => ({ type: 'node', id, lat, lon, ...(tags ? { tags } : {}) });
  const W = (id, pts, tags) => ({ type: 'way', id, nodes: pts.map(p => p[0]), geometry: pts.map(p => ({ lat: p[1], lon: p[2] })), tags });
  const lichten = [
    L(9700001, 52.0005, 5.0000), L(9700002, 52.0010, 5.0010, { 'traffic_signals:sound': 'yes' }), L(9700003, 52.0300, 5.0000),
    L(9700004, 52.0440, 5.0000), L(9700005, 52.0460, 5.0000), L(9700006, 51.9600, 5.0000, { description: 'IVRI proef' }),
    L(9700007, 52.0000, 5.0700), L(9700008, 52.0000, 5.0750), L(9700009, 52.0050, 4.9200), L(9700010, 52.0020, 4.9500),
    L(9700011, 52.5000, 5.5000), L(9700012, 51.9990, 4.9990)];
  const wegen = [
    W(9800001, [[9790001, 51.9990, 5.0000], [9700001, 52.0005, 5.0000], [9790002, 52.0020, 5.0000]], { highway: 'secondary', name: 'Weg A', maxspeed: '50', oneway: 'yes' }),
    W(9800002, [[9700003, 52.0300, 5.0000], [9790003, 52.0370, 5.0000], [9700004, 52.0440, 5.0000]], { highway: 'primary', name: 'Weg B' }),
    W(9800003, [[9700005, 52.0460, 5.0000], [9790004, 52.0480, 5.0000]], { highway: 'tertiary', name: 'Weg C' }),
    W(9800004, [[9700009, 52.0050, 4.9200], [9790005, 52.0035, 4.9350], [9700010, 52.0020, 4.9500]], { highway: 'secondary', maxspeed: '70' }),
    W(9800005, [[9700011, 52.5000, 5.5000], [9790006, 52.5010, 5.5000]], { highway: 'secondary', name: 'Weg D' }),
    W(9800006, [[9790007, 52.0005, 5.0020], [9700002, 52.0010, 5.0010]], { highway: 'cycleway', name: 'Weg E' }),
    W(9800007, [[9700012, 51.9990, 4.9990], [9790008, 51.9980, 4.9980]], { highway: 'roundabout_test', junction: 'roundabout', name: 'Weg A' })];
  return { lichten, wegen, fiets: [9700002, 9700008, 9700010] };   // 9700008 ligt net buiten 5 km
}

// Een bestand in de vorm van kaart/maak.py: kop, één element per regel, slot.
function kfTekst(datum, elementen) {
  return '{"version":0.6,"generator":"StoplichtIQ kaartbestand","osm3s":{"timestamp_osm_base":"' + datum + '","copyright":"' + KF_COPY + '"},"elements":[\n'
    + elementen.map(e => JSON.stringify(e)).join(',\n') + '\n]}\n';
}

async function kfSha(tekst) {
  const b = new TextEncoder().encode(tekst);
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), x => x.toString(16).padStart(2, '0')).join('');
}

// De drie bestanden (tekst) voor een datum; bewerk(lichtenTekst) maakt er desgewenst een kapotte van (de sha256 klopt dan wel).
async function kfBestanden(datum, bewerk) {
  const b = kfBasis();
  let lichten = kfTekst(datum, [...b.lichten].sort((x, y) => x.id - y.id).concat([...b.wegen].sort((x, y) => x.id - y.id)));
  if (bewerk) lichten = bewerk(lichten);
  const fiets = kfTekst(datum, b.fiets.map(id => ({ type: 'node', id })));
  const n = (s) => new TextEncoder().encode(s).length;
  const versie = { v: 1, datum, lichten: b.lichten.length, wegen: b.wegen.length, fiets: b.fiets.length,
    bytes: { lichten: n(lichten), fiets: n(fiets) }, gzip: { lichten: Math.round(n(lichten) / 4), fiets: Math.round(n(fiets) / 4) },
    sha256: { lichten: await kfSha(lichten), fiets: await kfSha(fiets) } };
  return { 'lichten.json': lichten, 'fiets.json': fiets, 'versie.json': JSON.stringify(versie), versie };
}

// Wat Overpass op de vraag van downloadOSM zou antwoorden: lichten binnen 5 km (zijn afstand), de wegen erdoor, beide op nummer.
function kfOverpassAntwoord(lat, lon, datum) {
  const R = 10 * 1000 * 1000 / Math.acos(0), r = Math.PI / 180;
  const af = (a, b, c, d) => 2 * R * Math.asin(Math.min(1, Math.sqrt(Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2)));
  const b = kfBasis();
  const n = b.lichten.filter(e => af(lat, lon, e.lat, e.lon) <= 5000).sort((x, y) => x.id - y.id);
  const ids = new Set(n.map(e => e.id));
  const w = b.wegen.filter(x => x.nodes.some(id => ids.has(id))).sort((x, y) => x.id - y.id);
  return { version: 0.6, generator: 'StoplichtIQ kaartbestand', osm3s: { timestamp_osm_base: datum, copyright: KF_COPY }, elements: JSON.parse(JSON.stringify(n.concat(w))) };
}

function kfIdbWeg(naam) {
  return new Promise((klaar) => { try { const q = indexedDB.deleteDatabase(naam); q.onsuccess = q.onerror = q.onblocked = () => klaar(); } catch (e) { klaar(); } });
}

// De records in meta (actief: alleen sleutel en datum; bezig; pauze), en ze zetten (null = weg).
function kfMetaLees() {
  return new Promise((klaar) => { const q = indexedDB.open(KF_IDB, 1);
    q.onupgradeneeded = (e) => { const db = e.target.result; for (const s of ['vak', 'meta']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); };
    q.onerror = () => klaar({ fout: 'open' });
    q.onsuccess = () => { const db = q.result; try { const tx = db.transaction('meta', 'readonly'), st = tx.objectStore('meta');
      const a = st.get('actief'), b = st.get('bezig'), p = st.get('pauze');
      tx.oncomplete = () => { db.close(); klaar({ actief: a.result ? { sleutel: a.result.sleutel, datum: a.result.datum } : null, bezig: b.result || null, pauze: p.result || null }); };
      tx.onerror = () => { db.close(); klaar({ fout: 'tx' }); }; } catch (e) { db.close(); klaar({ fout: String(e) }); } }; });
}
function kfMetaZet(rec) {
  return new Promise((klaar) => { const q = indexedDB.open(KF_IDB, 1);
    q.onupgradeneeded = (e) => { const db = e.target.result; for (const s of ['vak', 'meta']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); };
    q.onerror = () => klaar(false);
    q.onsuccess = () => { const db = q.result; const tx = db.transaction('meta', 'readwrite'), st = tx.objectStore('meta');
      for (const [k, v] of Object.entries(rec)) { if (v === null) st.delete(k); else st.put(v, k); }
      tx.oncomplete = () => { db.close(); klaar(true); }; tx.onerror = () => { db.close(); klaar(false); }; }; });
}

// ── Draait IN een iframe: een rit met het eigen bestand (of zonder) ──
// opt.bestanden: { 'versie.json', 'lichten.json', 'fiets.json' } als tekst; null = een adres dat 404 geeft.
// opt.overpass: 'ok' (antwoord opt.ovKaart) of '502'. opt.stappen: [lat, lon] = GPS-tik, 'fiets' = fietsHaalOp, 'knip', 'pil:...'.
async function kaartBestandRitBinnen(opt) {
  const uit = { vragen: {}, overpass: 0, overpassFiets: 0, maxTegelijk: 0, stappen: [], fotos: {} };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const t0 = Date.now();
  const echtFetch = window.fetch.bind(window);
  const urls = {};
  for (const [naam, tekst] of Object.entries(opt.bestanden || {})) {
    urls[naam] = tekst === null ? new URL('kaart_bestaat_niet_' + Math.random().toString(36).slice(2) + '.json', location.href).href
      : URL.createObjectURL(new Blob([tekst], { type: 'application/json' }));
  }
  window.kaartBestandUrl = (naam) => { uit.vragen[naam] = (uit.vragen[naam] || 0) + 1; return urls[naam] || new URL('kaart_bestaat_niet.json', location.href).href; };
  if (opt.aan !== 'standaard') window.kaartBestandAan = () => true;
  window.kaartModelRust = () => opt.modelRustNa == null || Date.now() - t0 >= opt.modelRustNa;
  if (opt.werkerKapot) window.kaartBestandWerker = function () { self.onmessage = function () { throw new Error('de worker is kapot'); }; };
  // de crashbewaking: een worker die het inlezen nooit afmaakt (de pagina sterft dan tijdens het inlezen, zie 'sterf')
  if (opt.leesHangt) { const orig = String(window.kaartBestandWerker);
    window.kaartBestandWerker = new Function('(' + orig + ')(); const o = self.onmessage; self.onmessage = (ev) => { if (ev && ev.data && ev.data.type === "verwerk") return; return o(ev); };'); }
  // inlezen dat te lang duurt: de grens van de vraag 'verwerk' op opt.leesMaxMs; opt.achtergrond: de app ging intussen naar de achtergrond
  if (opt.leesMaxMs) { const vr = window.kaartBestandWerkerVraag; window.kaartBestandWerkerVraag = (w, b, v, ms) => {
    if (b && b.type === 'verwerk') { if (opt.achtergrond && kaartBestandMerk) kaartBestandMerk.ooit = true; return vr(w, b, v, opt.leesMaxMs); } return vr(w, b, v, ms); }; }
  const fasen = []; { const mz = window.kaartBestandMerkZet; window.kaartBestandMerkZet = (f, v) => { fasen.push(f); return mz(f, v); }; }
  if (opt.startlog) startMeet = { k: 's', t: Date.now() };
  uit.dbOpen = 0; { const io = window.kaartBestandIdbOpen; const na = opt.dbHangt ? 0 : opt.dbHangtNa != null ? opt.dbHangtNa : Infinity;   // de database antwoordt nooit (dbHangt), of pas na dbHangtNa keer openen niet meer
    window.kaartBestandIdbOpen = () => { uit.dbOpen++; return uit.dbOpen > na ? new Promise(() => {}) : opt.dbTraagMs ? slaap(opt.dbTraagMs).then(io) : io(); }; }   // dbTraagMs: de database antwoordt wel, maar pas na zoveel ms
  if (opt.geenAfloop) window.kaartBestandAfloop = async () => { kaartBestandMerk = null; };   // de pagina stierf net na de transactie van de nieuwe versie
  let zicht = null;   // de achtergrond nabootsen (KF27): visibilityState pas vervangen als een stap erom vraagt
  const zet = (z) => { if (zicht === null) { try { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => zicht }); } catch (e) {} } zicht = z; document.dispatchEvent(new Event('visibilitychange')); };
  window.refreshStadIndienNodig = async () => {};
  window.haalStraatnamenOp = async () => {};
  uit.toasts = []; window.toonToast = (s) => { uit.toasts.push(String(s)); };   // de meldingen bewaren (KF29)
  let open = 0;
  window.fetch = async (url, init) => {
    if (String(url) !== OVERPASS_URL) return echtFetch(url, init);
    const body = init && init.body ? decodeURIComponent(String(init.body).replace(/^data=/, '')) : '';
    const fiets = /\.alleen out ids;$/.test(body);
    if (fiets) uit.overpassFiets++; else { uit.overpass++; if (uit.pilBijOverpass == null) uit.pilBijOverpass = pOSMT.textContent; }
    open++; uit.maxTegelijk = Math.max(uit.maxTegelijk, open);
    try {
      await slaap(opt.ovMs || 5);
      if (fiets) return new Response(JSON.stringify({ elements: (opt.ovFiets || []).map(id => ({ type: 'node', id })) }), { status: 200 });
      if (opt.overpass === '502') return new Response('<h1>502</h1>', { status: 502 });
      return new Response(JSON.stringify(opt.ovKaart || { elements: [] }), { status: 200 });
    } finally { open--; }
  };
  const pos = (lat, lon) => ({ coords: { latitude: lat, longitude: lon, accuracy: 9, heading: null, speed: 0 }, timestamp: Date.now() });
  const rust = async () => { for (let i = 0; i < 400 && (cacheBezig || kaartBestandHaalP || kaartNetOpen > 0 || fietsBezig); i++) await slaap(25); await slaap(30); };
  const foto = () => ({ pil: pOSMT.textContent, pk: pOSM.className, vak: kNaam.textContent, n: osmCache.length, ids: osmCache.map(s => s.id).join(','), bron: kaartBron,
    meta: kaartBestand ? { sleutel: kaartBestand.sleutel, datum: kaartBestand.datum, lichten: kaartBestand.lichten, vakken: kaartBestand.vakken.length } : null });
  const lsVoor = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); lsVoor[k] = localStorage.getItem(k); }
  try {
    for (const stap of (opt.stappen || [])) {
      if (Array.isArray(stap)) { await onGPS(pos(stap[0], stap[1])); await rust(); uit.stappen.push(foto()); }
      else if (stap === 'tegelijk') { const a = downloadOSM(52.0000, 5.0000), b = fietsHaalOp(52.0000, 5.0000); await Promise.all([a, b]); await rust(); }
      else if (stap === 'opnieuw') { kaartRem.nietVoor = 0; await downloadOSM(52.0000, 5.0000); await rust(); }
      else if (stap === 'fiets') { await fietsHaalOp(52.0000, 5.0000); await rust(); uit.fiets = fietsLichten ? [...fietsLichten].sort() : null; }
      else if (stap === 'knip') { uit.knip = await kaartBestandKnip(52.0000, 5.0000); }
      else if (stap === 'cache') { uit.osmCache = JSON.parse(JSON.stringify(osmCache)); }
      else if (stap === 'achtergrond') { for (let i = 0; i < 400 && kaartBestandHaalP; i++) await slaap(25); await slaap(30); uit.fotos.achtergrond = foto(); }
      else if (stap === 'idb') {
        uit.idb = await new Promise((klaar) => { const q = indexedDB.open(KAART_BESTAND_IDB); q.onerror = () => klaar({ fout: 'open' });
          q.onsuccess = () => { const db = q.result; try { const k = db.transaction('vak', 'readonly').objectStore('vak').getAllKeys();
            k.onsuccess = () => { db.close(); const per = {}; for (const x of k.result || []) { const s = String(x).split(':')[0]; per[s] = (per[s] || 0) + 1; } klaar(per); };
            k.onerror = () => { db.close(); klaar({ fout: 'keys' }); }; } catch (e) { db.close(); klaar({ fout: String(e) }); } }; });
      }
      else if (stap === 'meta') { uit.metaRec = await kfMetaLees(); }
      else if (typeof stap === 'object' && stap.zet) { await kfMetaZet(stap.zet); }
      else if (stap === 'sterf' || (typeof stap === 'object' && stap.sterf)) {
        // de pagina sterft tijdens het inlezen: de kaartvraag loopt, het merkteken staat op 'lees', en dan houdt de rit op (de iframe gaat weg);
        // stap.sterf 'verborgen': eerst naar de achtergrond; 'terug': naar de achtergrond en weer in beeld
        onGPS(pos(52.0000, 5.0000));
        for (let i = 0; i < 400; i++) { const r = await kfMetaLees(); if (r.bezig && r.bezig.fase === 'lees') { uit.sterf = r.bezig; break; } await slaap(25); }
        const wacht = async (v) => { for (let i = 0; i < 200; i++) { const r = await kfMetaLees(); if (r.bezig && r.bezig.verborgen === v) return r.bezig; await slaap(25); } return null; };
        if (stap.sterf === 'verborgen' || stap.sterf === 'terug') { zet('hidden'); uit.zicht = [await wacht(true)]; }
        if (stap.sterf === 'terug') { zet('visible'); uit.zicht.push(await wacht(false)); }
        break;
      }
      else if (stap === 'haalInPauze') {
        // de bewaking in kaartBestandHaal zelf: in een pauze haalt ook een directe vraag niets op
        const oud = kaartBestandPauze; kaartBestandPauze = { n: 1, p: 1, tot: Date.now() + 3600000, reden: 'proef', t: Date.now() };
        const v = JSON.parse(opt.bestanden['versie.json']);
        uit.haalInPauze = { terug: await kaartBestandHaal(v, true), lichten: uit.vragen['lichten.json'] || 0 };
        kaartBestandPauze = oud;
      }
      else if (typeof stap === 'object' && stap.ls) { for (const [k, v] of Object.entries(stap.ls)) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } }   // de omwikkeling van localStorage werkt de cache van de app zelf bij
      else if (typeof stap === 'object' && stap.wacht) { await slaap(stap.wacht); }
      else if (stap === 'tik') { kaartPilTik(); await slaap(50); await rust(); uit.tikken = (uit.tikken || []).concat([foto()]); }
      else if (stap === 'haalKapot') {
        // na een geslaagde poging in dezelfde start een kapotte (andere) versie op de achtergrond: de pauze telt vanaf nul
        const v = JSON.parse(opt.bestanden['versie.json']); v.sha256 = { ...v.sha256, lichten: v.sha256.lichten.replace(/^./, c => c === 'a' ? 'b' : 'a') };
        uit.haalKapot = await kaartBestandHaal(v, false);
      }
      else if (stap === 'merkTijd') {
        // de grens van een schrijfactie in meta: een database die niet opengaat, houdt het ophalen niet op
        const oud = window.kaartBestandIdbOpen; window.kaartBestandIdbOpen = () => new Promise(() => {});
        const t1 = Date.now(); let r = null;
        try { r = await Promise.race([kaartBestandMetaDoe(() => {}).then(() => 'klaar'), slaap(8000).then(() => 'hangt na 8 s')]); } catch (e) { r = String(e && e.message); }   // zonder grens zou de toets anders zelf blijven hangen
        window.kaartBestandIdbOpen = oud;
        uit.merkTijd = { r, ms: Date.now() - t1 };
      }
      else if (typeof stap === 'object' && stap.pil) {
        // de pil en het onderste vak bij een gegeven toestand (zonder kaart: het onderste vak toont dan de tekst)
        osmCache = []; cacheGeladen = false; dichtstbijOSM = null; cacheBezig = true; kaartIsBewaard = !!stap.bewaard; kaartFout = null;
        kaartBestandVoortgang = stap.voortgang; pOSMT.textContent = 'laden';
        kaartWeergaveBij();
        uit.fotos[stap.pil] = { pil: pOSMT.textContent, pk: pOSM.className, vak: kNaam.textContent, leer: leerNaam.textContent };
        cacheBezig = false; kaartBestandVoortgang = null; kaartIsBewaard = false;
      }
    }
    uit.log = (JSON.parse(localStorage.getItem('sl_opslaglog') || '[]') || []).filter(r => r.reden === 'kaart_bestand').map(r => r.element + ': ' + r.poortReden);
    uit.fasen = fasen;
    uit.dbMerk = JSON.parse(localStorage.getItem('sl_kaartdb') || 'null');
    if (opt.startlog && startMeet) { uit.startlog = {}; for (const k of ['kbx', 'kbn', 'kbp', 'kbv', 'kbf', 'kbr']) if (startMeet[k] != null) uit.startlog[k] = startMeet[k]; }
    uit.eind = foto();
    uit.aan = kaartBestandAan();
    if (opt.aan === 'standaard') { const sch = document.getElementById('startscherm'); if (sch) sch.classList.add('weg'); uit.aanNaStart = kaartBestandAan(); }
    uit.lsAnders = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (lsVoor[k] !== localStorage.getItem(k) && !/^sl_model(log|vgl)$/.test(k)) uit.lsAnders.push(k); }   // het logboek van het model komt wanneer het model in de iframe klaar is, los van de kaart (KF18)
    uit.lsAnders.sort();
  } catch (e) { uit.fout = String((e && e.stack) || e).slice(0, 400); }
  for (const u of Object.values(urls)) { try { URL.revokeObjectURL(u); } catch (e) {} }
  uit.duur = Date.now() - t0;
  return uit;
}

// ── Draait op de testpagina ──────────────────────────────────
// V11.37.23: een rit in een iframe opent daar de IndexedDB-spiegel en schrijft er (onder meer sl_camcap en
// sl_wissellog). Haalde de toets die sleutels daarna uit localStorage, dan bleven ze als wees in de spiegel
// staan, en faalde test_idb_spiegel (C2c, C3c, C9a) als hij ná deze toets draaide. Dit ruimt alleen wezen op
// (in de spiegel, niet in localStorage), en alleen als de spiegel-database al bestaat.
async function idbWeesWeg23() {
  try {
    await new Promise((r) => setTimeout(r, 600));   // een laatste bundel uit de iframe (IDB_FLUSH_MS)
    if (typeof indexedDB === 'undefined' || typeof indexedDB.databases !== 'function') return -1;
    const lijst = await indexedDB.databases();
    if (!lijst.some((d) => d.name === IDB_NAAM)) return 0;
    const db = await new Promise((ok, nee) => { const r = indexedDB.open(IDB_NAAM); r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error); });
    try {
      if (!db.objectStoreNames.contains(IDB_STORE)) return 0;
      const sleutels = await new Promise((ok, nee) => { const r = db.transaction(IDB_STORE).objectStore(IDB_STORE).getAllKeys(); r.onsuccess = () => ok(r.result); r.onerror = () => nee(r.error); });
      const wees = sleutels.filter((k) => typeof k === 'string' && localStorage.getItem(k) === null);
      if (wees.length) await new Promise((ok, nee) => { const tx = db.transaction(IDB_STORE, 'readwrite'); for (const k of wees) tx.objectStore(IDB_STORE).delete(k); tx.oncomplete = ok; tx.onerror = () => nee(tx.error); });
      return wees.length;
    } finally { db.close(); }
  } catch (e) { return -1; }
}

async function testKaartbestand() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const NL = String.fromCharCode(10);
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };
  const bron = new URL('test_kaartbestand.js', location.href).href;
  const pagina = location.pathname;
  // Elke rit in een eigen iframe; schoon: eerst de eigen database en de bewaarde kaart weg. Na elke rit de opslag terug.
  const rit = async (opt, schoon) => {
    if (schoon !== false) { await kfIdbWeg(KF_IDB); await kfIdbWeg('StoplichtIQ_Kaart'); }
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?kaartbestand=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.onGPS !== 'function'; poging++) {   // de app zelf laadde niet (testopstelling): de pagina opnieuw
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
      return JSON.parse(JSON.stringify(await Promise.race([w.kaartBestandRitBinnen(opt), slaap(90000).then(() => { throw new Error('de rit hing (90 s)'); })])));   // een hang wordt een rode controle, geen hangende toets
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), vragen: {}, stappen: [], fotos: {}, log: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const kort = (o) => JSON.stringify(o || null).slice(0, 220);
  const DATUM = '2026-10-01';
  const goed = await kfBestanden(DATUM);
  const P0 = [52.0000, 5.0000];

  try {
    // ═══ KF1 — de constanten ═════════════════════════════════════
    const adres = kaartBestandUrl('lichten.json', 'abc');
    eis('KF1 de straal van Overpass (6.366.198 m), vakken van 0,1 x 0,15 graad, 45 en 180 dagen, 3 pogingen, 20 s stil, 180 s in totaal; de bestanden in kaart/ naast de app',
        Math.round(KAART_BESTAND_R) === 6366198 && KAART_VAK_LAT === 0.1 && KAART_VAK_LON === 0.15 && KAART_BESTAND_LOG_DAGEN === 45 && KAART_BESTAND_OUD_DAGEN === 180
          && KAART_BESTAND_POGINGEN === 3 && KAART_BESTAND_STIL_MS === 20000 && KAART_BESTAND_MAX_MS === 180000 && KAART_BESTAND_IDB === KF_IDB
          && adres === new URL('kaart/lichten.json?v=abc', location.href).href,
        'zo', [Math.round(KAART_BESTAND_R), KAART_VAK_LAT, KAART_VAK_LON, KAART_BESTAND_LOG_DAGEN, KAART_BESTAND_OUD_DAGEN, KAART_BESTAND_POGINGEN, adres].join(' | '));

    // ═══ KF2 — de afstand zoals Overpass ══════════════════════════
    const r = Math.PI / 180, ovAf = (a, b, c, d) => Math.acos(Math.min(1, Math.sin(a * r) * Math.sin(c * r) + Math.cos(a * r) * Math.cos(c * r) * Math.cos((d - b) * r))) * (10 * 1000 * 1000 / Math.acos(0));
    const paren = [[52, 5, 52.044, 5], [52, 5, 52, 5.07], [52.37, 4.89, 52.09, 5.12], [51.5, 3.6, 53.4, 7.2], [52, 5, 51.96, 5]];
    const afw = paren.map(([a, b, c, d]) => Math.abs(kaartBestandAfstand(a, b, c, d) - ovAf(a, b, c, d)));
    const verh = kaartBestandAfstand(52, 5, 52.044, 5) / afstand(52, 5, 52.044, 5);
    eis('KF2 kaartBestandAfstand = de formule van Overpass (verschil < 1 mm op vijf paren); afstand() rekent met 6.371 km (verhouding 0,99925)',
        afw.every(x => x < 0.001) && Math.abs(verh - 6366197.7 / 6371000) < 1e-6, '< 1 mm', afw.map(x => x.toExponential(1)).join(' ') + ' | ' + verh.toFixed(6));

    // ═══ KF3 — de vakken rond een plek ════════════════════════════
    {
      const m = { vakLat: KAART_VAK_LAT, vakLon: KAART_VAK_LON, vakken: [] };
      const pts = [];
      for (let la = 50.7; la <= 53.6; la += 0.013) for (let lo = 3.3; lo <= 7.3; lo += 0.019) pts.push([Math.round(la * 1e7) / 1e7, Math.round(lo * 1e7) / 1e7]);
      const vakVan = (la, lo) => Math.floor(la / m.vakLat) + '_' + Math.floor(lo / m.vakLon);
      m.vakken = [...new Set(pts.map(p => vakVan(p[0], p[1])))];
      let mis = 0, maxV = 0, n = 0;
      for (let i = 0; i < 300; i++) {
        const la = 50.75 + ((i * 7919) % 2800) / 1000, lo = 3.4 + ((i * 104729) % 3800) / 1000;
        const v = new Set(kaartBestandVakkenRond(m, la, lo)); maxV = Math.max(maxV, v.size);
        for (const p of pts) if (kaartBestandAfstand(la, lo, p[0], p[1]) <= OSM_RADIUS) { n++; if (!v.has(vakVan(p[0], p[1]))) mis++; }
      }
      eis('KF3 300 plekken over heel Nederland: elk punt binnen 5 km ligt in een vak dat gelezen wordt; hoogstens 6 vakken per kaart', mis === 0 && maxV <= 6 && n > 1000,
          '0 gemist, <= 6', mis + ' gemist van ' + n + ', max ' + maxV + ' vakken');
    }

    // ═══ KF4 — de geknipte kaart = het Overpass-antwoord ═══════════
    const r4 = await rit({ bestanden: goed, overpass: '502', stappen: [P0, 'knip', 'cache', 'fiets', 'idb'] });
    const ref = kfOverpassAntwoord(52.0000, 5.0000, DATUM);
    eis('KF4a de kaart komt uit het bestand (Overpass 0 keer gevraagd, al geeft hij 502); 8 lichten binnen 5 km',
        !r4.fout && r4.eind && r4.eind.bron === 'bestand' && r4.overpass === 0 && r4.eind.n === 8 && r4.eind.pil === 'Kaart',
        'bestand, 0, 8, Kaart', r4.fout || kort(r4.eind) + ' overpass ' + r4.overpass);
    eis('KF4b knippen geeft precies wat Overpass zou geven: dezelfde elementen in dezelfde volgorde (lichten, dan wegen, op nummer), dezelfde velden; de datum zonder kloktijd',
        !r4.fout && JSON.stringify(r4.knip) === JSON.stringify(ref) && /^\d{4}-\d{2}-\d{2}$/.test(r4.knip.osm3s.timestamp_osm_base),
        'gelijk', r4.fout || (JSON.stringify(r4.knip) === JSON.stringify(ref) ? 'gelijk' : kort(r4.knip).slice(0, 200)));
    eis('KF4c alles bewaard in vakken met de sleutel van deze versie (de 12 lichten liggen in meerdere vakken)',
        !r4.fout && r4.eind.meta && r4.eind.meta.lichten === 12 && r4.eind.meta.datum === DATUM && r4.idb && r4.idb[r4.eind.meta.sleutel] === r4.eind.meta.vakken && r4.eind.meta.vakken >= 4,
        'meta + vakken', r4.fout || kort(r4.eind.meta) + ' ' + kort(r4.idb));

    // ═══ KF5 — de verwerking is ongewijzigd ═══════════════════════
    const ref5 = kfOverpassAntwoord(52.0000, 5.0000, DATUM);
    const r5 = await rit({ aan: 'standaard', overpass: 'ok', ovKaart: ref5, stappen: [P0, 'cache'] });
    eis('KF5 dezelfde lichtenlijst (osmCache, alle velden) uit het bestand als uit hetzelfde antwoord van Overpass',
        !r4.fout && !r5.fout && r5.eind.bron === 'overpass' && JSON.stringify(r4.osmCache) === JSON.stringify(r5.osmCache) && r4.osmCache.length === 8,
        'gelijk (8 lichten)', r4.fout || r5.fout || (JSON.stringify(r4.osmCache) === JSON.stringify(r5.osmCache) ? 'gelijk' : kort(r4.osmCache) + ' <> ' + kort(r5.osmCache)));

    // ═══ KF6 — de fietslijst ═══════════════════════════════════════
    eis('KF6 de fietslijst uit het bestand: de twee fietslichten binnen 5 km (het derde ligt erbuiten), geen fietsvraag aan Overpass',
        !r4.fout && JSON.stringify(r4.fiets) === JSON.stringify(['9700002', '9700010']) && r4.overpassFiets === 0, '9700002, 9700010; 0',
        r4.fout || kort(r4.fiets) + ' | overpass ' + r4.overpassFiets);

    // ═══ KF7 — de tweede start ════════════════════════════════════
    const r7a = await rit({ bestanden: goed, overpass: '502', stappen: [P0] });
    const r7b = await rit({ bestanden: goed, overpass: '502', stappen: [P0] }, false);
    eis('KF7 eerste start: versie.json, lichten.json en fiets.json elk één keer; tweede start: alleen versie.json, de kaart uit de telefoon',
        !r7a.fout && !r7b.fout && r7a.vragen['versie.json'] === 1 && r7a.vragen['lichten.json'] === 1 && r7a.vragen['fiets.json'] === 1
          && r7b.vragen['versie.json'] === 1 && !r7b.vragen['lichten.json'] && !r7b.vragen['fiets.json'] && r7b.eind.bron === 'bestand' && r7b.eind.n === 8 && r7b.overpass === 0,
        '1/1/1, dan 1/0/0', r7a.fout || r7b.fout || kort(r7a.vragen) + ' | ' + kort(r7b.vragen) + ' ' + r7b.eind.bron);

    // ═══ KF8 — storingen: terug naar Overpass ══════════════════════
    const ovRef = { elements: [{ type: 'node', id: 9610001, lat: 52.0005, lon: 5.0000, tags: { highway: 'traffic_signals' } }, { type: 'node', id: 9610003, lat: 52.0010, lon: 5.0010 }] };
    const kapotGeo = (t) => t.replace('{"lat":52.037,"lon":5},', '');   // één punt te weinig in de vorm van een weg
    const v8 = async (wat) => {
      if (wat === 'sha') { const g = await kfBestanden(DATUM); const v = { ...g.versie, sha256: { ...g.versie.sha256, lichten: g.versie.sha256.lichten.replace(/^./, c => c === 'a' ? 'b' : 'a') } }; return { ...g, 'versie.json': JSON.stringify(v) }; }
      if (wat === 'kapot') return kfBestanden(DATUM, kapotGeo);
      if (wat === 'lengte') { const g = await kfBestanden(DATUM); const v = { ...g.versie, bytes: { ...g.versie.bytes, lichten: g.versie.bytes.lichten + 10 } }; return { ...g, 'versie.json': JSON.stringify(v) }; }
      if (wat === '404') { const g = await kfBestanden(DATUM); return { ...g, 'lichten.json': null }; }
      if (wat === 'versie') { const g = await kfBestanden(DATUM); return { ...g, 'versie.json': '{"v":1,"datum":"kapot"}' }; }
      if (wat === 'aantal') { const g = await kfBestanden(DATUM); const v = { ...g.versie, lichten: g.versie.lichten + 1 }; return { ...g, 'versie.json': JSON.stringify(v) }; }
      return kfBestanden(DATUM);
    };
    // [geval, reden, hoe vaak lichten.json in vier kaartvragen]: een fout in het bestand zelf: één keer; een netwerkfout: KAART_BESTAND_POGINGEN keer
    const gevallen = [['sha', /^haal:sha$/, 1], ['kapot', /^haal:vorm weg$/, 1], ['lengte', /^haal:net kort$/, 3], ['404', /^haal:http 404$/, 1], ['versie', /^versie:vorm$/, 0], ['aantal', /^haal:aantal$/, 1], ['werker', /^haal:werker$/, 1]];
    const r8 = [];
    for (const [wat, reden, keer] of gevallen) {
      const rr = await rit({ bestanden: await v8(wat), overpass: 'ok', ovKaart: ovRef, werkerKapot: wat === 'werker', stappen: [P0, 'opnieuw', 'opnieuw', 'opnieuw'] });
      const fout = (rr.log || []).filter(x => /^fout: /.test(x)).map(x => x.slice(6));
      r8.push({ wat, ok: !rr.fout && rr.eind.bron === 'overpass' && rr.eind.ids === '9610001,9610003' && rr.eind.pil === 'Kaart' && !rr.eind.meta && fout.length >= 1 && reden.test(fout[0])
        && (rr.vragen['lichten.json'] || 0) === keer && rr.pilBijOverpass === 'laden',
        wat2: rr.fout || (rr.eind.bron + ' ' + rr.eind.ids + ' ' + rr.eind.pil + ' | ' + fout[0] + ' | lichten ' + (rr.vragen['lichten.json'] || 0) + ' | pil bij Overpass ' + rr.pilBijOverpass) });
    }
    eis('KF8 sha256 fout, kapotte regel, te kort, 404, kapotte versie.json, verkeerd aantal, kapotte worker: elk de kaart van Overpass (pil Kaart; tijdens die vraag laden), de juiste reden in de log, niets bewaard; in vier kaartvragen een fout in het bestand één keer opgehaald, een netwerkfout drie keer',
        r8.every(x => x.ok), 'zeven keer zo', r8.map(x => (x.ok ? '' : 'FOUT ') + x.wat + ': ' + x.wat2).join(' || '));

    // ═══ KF9 — een kapotte nieuwe versie ═══════════════════════════
    const nieuwKapot = await kfBestanden('2026-10-08', kapotGeo);
    const r9a = await rit({ bestanden: goed, overpass: '502', stappen: [P0] });
    const r9b = await rit({ bestanden: nieuwKapot, overpass: '502', stappen: [P0, 'achtergrond'] }, false);
    const r9c = await rit({ bestanden: nieuwKapot, overpass: '502', stappen: [P0, 'achtergrond'] }, false);
    eis('KF9 een kapotte nieuwe versie: de oude blijft in gebruik (zelfde sleutel, kaart uit het bestand), de weigering staat in de log; de volgende start nog steeds de oude',
        !r9a.fout && !r9b.fout && !r9c.fout && r9b.eind.bron === 'bestand' && (r9b.fotos.achtergrond.meta || {}).sleutel === (r9a.eind.meta || {}).sleutel
          && r9b.log.some(x => /^fout: nieuw:vorm weg/.test(x)) && (r9c.fotos.achtergrond.meta || {}).sleutel === (r9a.eind.meta || {}).sleutel && r9b.overpass + r9c.overpass === 0,
        'oude sleutel blijft', r9a.fout || r9b.fout || r9c.fout || [(r9a.eind.meta || {}).sleutel, (r9b.fotos.achtergrond.meta || {}).sleutel, (r9c.fotos.achtergrond.meta || {}).sleutel].join(' / ') + ' | ' + r9b.log.join(' ; '));

    // ═══ KF10 — een goede nieuwe versie ════════════════════════════
    const nieuwGoed = await kfBestanden('2026-10-08');
    const r10a = await rit({ bestanden: goed, overpass: '502', stappen: [P0] });
    const r10b = await rit({ bestanden: nieuwGoed, overpass: '502', stappen: [P0, 'achtergrond', 'idb'] }, false);
    const r10c = await rit({ bestanden: nieuwGoed, overpass: '502', stappen: [P0, 'idb'] }, false);
    eis('KF10 een goede nieuwe versie: deze start de oude kaart, op de achtergrond de nieuwe (actief na de keuring); de volgende start alleen nog de vakken van de nieuwe, en niets opgehaald',
        !r10a.fout && !r10b.fout && !r10c.fout && r10b.eind.bron === 'bestand' && (r10b.fotos.achtergrond.meta || {}).datum === '2026-10-08' && (r10b.fotos.achtergrond.meta || {}).sleutel !== (r10a.eind.meta || {}).sleutel
          && Object.keys(r10b.idb).length === 2 && Object.keys(r10c.idb).length === 1 && r10c.idb[(r10b.fotos.achtergrond.meta || {}).sleutel] > 0 && !r10c.vragen['lichten.json'],
        'nieuw actief, oude vakken weg', r10a.fout || r10b.fout || r10c.fout || kort(r10b.fotos.achtergrond.meta) + ' | ' + kort(r10b.idb) + ' -> ' + kort(r10c.idb));

    // ═══ KF11 — ouderdom ════════════════════════════════════════
    const dagenGeleden = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
    const r11 = [];
    for (const [d, pil, log] of [[200, 'Kaart oud', true], [50, 'Kaart', true], [10, 'Kaart', false]]) {
      const rr = await rit({ bestanden: await kfBestanden(dagenGeleden(d)), overpass: '502', stappen: [P0] });
      r11.push({ d, ok: !rr.fout && rr.eind.bron === 'bestand' && rr.eind.n === 8 && rr.eind.pil === pil && (rr.log || []).some(x => /^oud: dagen=/.test(x)) === log
        && (pil !== 'Kaart oud' || / o$/.test(rr.eind.pk)), wat: rr.fout || rr.eind.pil + ' ' + rr.eind.pk + ' | ' + (rr.log || []).filter(x => /^oud/.test(x)).join(' ') });
    }
    eis('KF11 200 dagen oud: toch de kaart, de pil zegt Kaart oud (oranje); 50 dagen: Kaart, wel een logregel; 10 dagen: geen logregel',
        r11.every(x => x.ok), 'zo', r11.map(x => x.d + ' d: ' + x.wat).join(' || '));

    // ═══ KF12 — de pil en het onderste vak tijdens het ophalen ════
    const r12 = await rit({ aan: 'standaard', overpass: '502', stappen: [{ pil: 'voortgang', voortgang: { pct: 48, mb: 4.41 } }, { pil: 'klaarzetten', voortgang: { klaarzetten: true, mb: 4.41 } },
      { pil: 'bewaard', bewaard: true, voortgang: { pct: 48, mb: 4.41 } }] });
    const f12 = r12.fotos || {};
    eis('KF12 tijdens het ophalen: pil Kaart 48% (oranje), onderin Kaart 48% van 4,4 MB; daarna laden en Kaart klaarzetten…; met een bewaarde kaart blijft de pil Bewaard',
        !r12.fout && (f12.voortgang || {}).pil === 'Kaart 48%' && / o$/.test((f12.voortgang || {}).pk) && (f12.voortgang || {}).vak === 'Kaart 48% van 4,4 MB'
          && (f12.klaarzetten || {}).pil === 'laden' && (f12.klaarzetten || {}).vak === 'Kaart klaarzetten…' && (f12.bewaard || {}).pil === 'Bewaard',
        'zo', r12.fout || kort(f12));

    // ═══ KF13 — het inlezen wacht op het model ═════════════════════
    const r13 = await rit({ bestanden: goed, overpass: '502', modelRustNa: 1500, stappen: [P0] });
    const k13 = (r13.log || []).find(x => /^klaar: /.test(x)) || '';
    eis('KF13 het model rust pas na 1,5 s: het inlezen wacht (wacht=1s of 2s in de log), daarna de kaart uit het bestand',
        !r13.fout && /wacht=(1|2)s/.test(k13) && r13.eind.bron === 'bestand' && r13.duur >= 1400, 'wacht >= 1 s', r13.fout || k13 + ' | ' + r13.duur + ' ms');

    // ═══ KF14 — één kaartverbinding tegelijk ═══════════════════════
    {
      let open = 0, max = 0; const volg = []; let sync = false;
      const taak = (naam, ms, faal) => async () => { open++; max = Math.max(max, open); volg.push(naam + '+'); await slaap(ms); volg.push(naam + '-'); open--; if (faal) throw new Error('faal'); return naam; };
      const p1 = kaartNetRij('a', () => { sync = true; return taak('a', 40)(); });
      const directSync = sync;
      const p2 = kaartNetRij('b', taak('b', 10, true));
      const p3 = kaartNetRij('c', taak('c', 10));
      const res = await Promise.allSettled([p1, p2, p3]);
      eis('KF14 niets bezig: de taak start meteen (in dezelfde tik); daarna in volgorde, nooit twee tegelijk; een fout houdt de rij niet op',
          directSync && max === 1 && volg.join(' ') === 'a+ a- b+ b- c+ c-' && res[1].status === 'rejected' && res[2].value === 'c' && kaartNetOpen === 0,
          'a, b, c na elkaar', [directSync, max, volg.join(' '), res.map(x => x.status).join(',')].join(' | '));
    }

    const r14 = await rit({ aan: 'standaard', overpass: 'ok', ovKaart: ovRef, ovMs: 300, ovFiets: [9610003], stappen: ['tegelijk'] });
    eis('KF14b een kaartvraag en een fietsvraag aan Overpass tegelijk gestart: Overpass ziet ze na elkaar (nooit twee open), en beide komen aan',
        !r14.fout && r14.maxTegelijk === 1 && r14.overpass === 1 && r14.overpassFiets === 1 && r14.eind.n === 2, '1 tegelijk, 1 + 1',
        r14.fout || 'max ' + r14.maxTegelijk + ', kaart ' + r14.overpass + ', fiets ' + r14.overpassFiets + ', lichten ' + r14.eind.n);

    // ═══ KF15 — in een iframe zonder toets: uit ════════════════════
    const r15 = await rit({ aan: 'standaard', bestanden: goed, overpass: 'ok', ovKaart: ovRef, stappen: [P0] });
    eis('KF15 in een iframe staat het bestand uit (kaartBestandAan onwaar, ook als het startscherm weg is): geen versie.json, de kaart van Overpass zoals vóór V11.37.20',
        !r15.fout && r15.aan === false && r15.aanNaStart === false && !r15.vragen['versie.json'] && r15.overpass === 1 && r15.eind.bron === 'overpass' && r15.eind.ids === '9610001,9610003',
        'uit, Overpass', r15.fout || r15.aan + '/' + r15.aanNaStart + ' ' + kort(r15.vragen) + ' ' + r15.eind.bron);
    const sch15 = document.getElementById('startscherm');
    eis('KF15b bovenaan maar vóór Start (het startscherm staat er, zoals op de pagina van een testronde) staat het bestand ook uit',
        !!sch15 && !sch15.classList.contains('weg') && window.top === window && kaartBestandAan() === false, 'uit', String(!!sch15 && sch15.classList.contains('weg')) + ' ' + kaartBestandAan());

    // ═══ KF18 — de leerdata ═══════════════════════════════════════
    {
      const sleutels = async (opt) => { const rr = await rit({ ...opt, stappen: [P0, 'fiets', 'cache'] }); return rr; };
      const a = await sleutels({ bestanden: goed, overpass: '502' });
      const b = await sleutels({ aan: 'standaard', overpass: 'ok', ovKaart: kfOverpassAntwoord(52.0000, 5.0000, DATUM), ovFiets: [9700002, 9700010] });
      eis('KF18 een kaart uit het bestand en dezelfde kaart van Overpass geven dezelfde lichtenlijst en dezelfde fietslijst, en veranderen dezelfde sleutels in localStorage (het bestand zelf staat alleen in zijn eigen IndexedDB)',
          !a.fout && !b.fout && JSON.stringify(a.osmCache) === JSON.stringify(b.osmCache) && JSON.stringify(a.fiets) === JSON.stringify(b.fiets) && JSON.stringify(a.lsAnders) === JSON.stringify(b.lsAnders),
          'gelijk', a.fout || b.fout || kort(a.fiets) + ' / ' + kort(b.fiets) + ' | sleutels ' + kort(a.lsAnders) + ' / ' + kort(b.lsAnders));
    }

    // ═══ KF19-KF26 — de crashbewaking ═════════════════════════════
    const UUR = 3600000, DAG = 24 * UUR;
    const pz = (r) => (r && r.metaRec && r.metaRec.pauze) || {};
    const rond = (ms) => Math.round(ms / UUR);
    {
      const reeks = []; let p = null;
      for (let i = 0; i < 6; i++) { p = kaartBestandPauzeNa('x', p, false); reeks.push(Math.round((p.tot - p.t) / DAG)); }
      const vrij = kaartBestandPauzeNa('x', null, true);
      const oud = kaartBestandPauze;
      kaartBestandPauze = { n: 1, p: 1, tot: Date.now() + 40 * DAG, reden: 'x', t: Date.now() }; const klokTerug = kaartBestandPauzeActief();
      kaartBestandPauze = { n: 1, p: 1, tot: Date.now() + DAG, reden: 'x', t: Date.now() }; const actief = kaartBestandPauzeActief();
      kaartBestandPauze = oud;
      eis('KF19 de pauze: 24 uur, dan keer 3 tot hoogstens 30 dagen (1, 3, 9, 27, 30, 30); een eerste onderbreking geeft geen pauze; een pauze verder dan 30 dagen weg (klok terug) telt niet; het merkteken schrijven hoogstens 5 s',
          KAART_BESTAND_PAUZE_MS === DAG && KAART_BESTAND_PAUZE_MAX_MS === 30 * DAG && KAART_BESTAND_MERK_MS === 5000 && reeks.join(',') === '1,3,9,27,30,30'
            && vrij.tot === 0 && vrij.n === 1 && vrij.p === 0 && actief === true && klokTerug === false,
          '1,3,9,27,30,30', reeks.join(',') + ' | vrij ' + JSON.stringify({ n: vrij.n, p: vrij.p, tot: vrij.tot }) + ' | actief ' + actief + ', klok terug ' + klokTerug);
    }

    // KF20: de pagina sterft tijdens het inlezen; de volgende start: Overpass, niets opgehaald, de reden in log en startlog, een pauze van 24 uur
    const r20a = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, leesHangt: true, stappen: ['sterf'] });
    const r20b = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, startlog: true, stappen: [P0, 'opnieuw', 'meta'] }, false);
    const p20 = pz(r20b);
    eis('KF20 de pagina stierf tijdens het inlezen (merkteken op lees); de volgende start: de kaart van Overpass, geen versie.json en geen download (ook niet bij een tweede kaartvraag), logregel stierf, startlog kbx/kbn/kbp/kbv, pauze 24 uur, merkteken weg',
        !r20a.fout && !r20b.fout && (r20a.sterf || {}).fase === 'lees' && r20a.fasen.join(',') === 'haal,wacht,lees'
          && r20b.eind.bron === 'overpass' && r20b.eind.ids === '9610001,9610003' && !r20b.vragen['versie.json'] && !r20b.vragen['lichten.json'] && !r20b.vragen['fiets.json'] && !r20b.eind.meta
          && r20b.log.some(x => /^stierf: eerdere poging stierf fase=lees n=1 pauze=24u$/.test(x))
          && r20b.startlog.kbx === 'eerdere poging stierf' && r20b.startlog.kbn === 1 && r20b.startlog.kbp === 24 && r20b.startlog.kbv === 'pauze' && r20b.startlog.kbf == null
          && p20.n === 1 && p20.p === 1 && rond(p20.tot - p20.t) === 24 && !r20b.metaRec.bezig,
        'Overpass, 0 downloads, stierf, pauze 24 u', r20a.fout || r20b.fout || kort(r20a.sterf) + ' ' + r20a.fasen + ' | ' + r20b.eind.bron + ' ' + kort(r20b.vragen) + ' | ' + r20b.log.join(' ; ') + ' | ' + kort(r20b.startlog) + ' | ' + kort(r20b.metaRec));

    // KF21: de pauze verloopt: één nieuwe poging; lukt die, dan is de pauze weg; mislukt die weer, dan 72 uur
    const verlopen = { n: 1, p: 1, tot: Date.now() - 60000, reden: 'eerdere poging stierf', t: Date.now() - DAG - 60000 };
    const r21a = await rit({ bestanden: goed, overpass: '502', startlog: true, stappen: [{ zet: { pauze: verlopen } }, P0, 'meta'] });
    const r21b = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, leesHangt: true, stappen: [{ zet: { pauze: verlopen } }, 'sterf'] });
    const r21c = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, stappen: [P0, 'meta'] }, false);
    const p21 = pz(r21c);
    eis('KF21 de pauze is verlopen: één nieuwe poging (versie.json en de bestanden), gelukt: de kaart uit het bestand en de pauze weg (startlog nog kbx/kbn, geen kbp); stierf die poging weer: de volgende start een pauze van 72 uur (n=2) en niets opgehaald',
        !r21a.fout && !r21b.fout && !r21c.fout && r21a.eind.bron === 'bestand' && r21a.vragen['lichten.json'] === 1 && !r21a.metaRec.pauze && !r21a.metaRec.bezig
          && r21a.startlog.kbx === 'eerdere poging stierf' && r21a.startlog.kbn === 1 && r21a.startlog.kbp == null && r21a.startlog.kbv === 'geen'
          && (r21b.sterf || {}).fase === 'lees' && p21.n === 2 && p21.p === 2 && rond(p21.tot - p21.t) === 72 && r21c.eind.bron === 'overpass' && !r21c.vragen['lichten.json'] && !r21c.vragen['versie.json']
          && r21c.log.some(x => /^stierf: eerdere poging stierf fase=lees n=2 pauze=72u$/.test(x)),
        'nieuwe poging; daarna 72 u', r21a.fout || r21b.fout || r21c.fout || r21a.eind.bron + ' ' + kort(r21a.vragen) + ' ' + kort(r21a.metaRec) + ' ' + kort(r21a.startlog) + ' | ' + kort(p21) + ' ' + r21c.log.join(' ; '));

    // KF22: een goed bestand blijft in gebruik tijdens de pauze (ook als de server een nieuwe versie heeft)
    const r22a = await rit({ bestanden: goed, overpass: '502', stappen: [P0] });
    const actiefPauze = { n: 1, p: 1, tot: Date.now() + DAG, reden: 'eerdere poging stierf', t: Date.now() };
    const r22b = await rit({ bestanden: nieuwGoed, overpass: '502', startlog: true, stappen: [{ zet: { pauze: actiefPauze } }, P0, 'achtergrond', 'opnieuw', 'meta'] }, false);
    eis('KF22 tijdens de pauze blijft het goede bestand in gebruik: de kaart uit de telefoon (oude sleutel), Overpass 0 keer, geen versie.json, de nieuwe versie niet opgehaald; logregel pauze',
        !r22a.fout && !r22b.fout && r22b.eind.bron === 'bestand' && r22b.eind.n === 8 && (r22b.eind.meta || {}).sleutel === (r22a.eind.meta || {}).sleutel && r22b.overpass === 0
          && !r22b.vragen['versie.json'] && !r22b.vragen['lichten.json'] && r22b.log.some(x => /^pauze: nog 2[34]u n=1 eerdere poging stierf$/.test(x)) && r22b.startlog.kbv === 'pauze' && pz(r22b).tot === actiefPauze.tot,
        'bestand, 0, 0', r22a.fout || r22b.fout || r22b.eind.bron + ' ' + kort(r22b.eind.meta) + ' ' + kort(r22b.vragen) + ' | ' + r22b.log.join(' ; ') + ' | ' + kort(r22b.startlog));

    // KF23: een gewone geslaagde start wist het merkteken (en een verlopen pauze); de fasen haal, wacht, lees
    const r23 = await rit({ bestanden: goed, overpass: '502', stappen: [{ zet: { pauze: { ...verlopen, n: 3, p: 3 } } }, P0, 'meta'] });
    eis('KF23 een geslaagde start: het merkteken stond er tijdens haal, wacht en lees, en is daarna weg, net als de (verlopen) pauze; de kaart uit het bestand',
        !r23.fout && r23.eind.bron === 'bestand' && r23.fasen.join(',') === 'haal,wacht,lees' && r23.metaRec && !r23.metaRec.bezig && !r23.metaRec.pauze && !!r23.metaRec.actief,
        'weg', r23.fout || r23.fasen.join(',') + ' | ' + kort(r23.metaRec));

    // KF23c: na een geslaagde poging begint de telling opnieuw, ook in het geheugen van deze start
    const r23c = await rit({ bestanden: goed, overpass: '502', stappen: [{ zet: { pauze: { ...verlopen, n: 3, p: 3 } } }, P0, 'haalKapot', 'meta'] });
    eis('KF23c na een geslaagde poging (na drie mislukte op rij) en daarna in dezelfde start een kapotte nieuwe versie: de pauze begint weer bij 24 uur (n=1), niet bij 27 dagen',
        !r23c.fout && r23c.eind.bron === 'bestand' && r23c.haalKapot === false && pz(r23c).n === 1 && pz(r23c).p === 1 && rond(pz(r23c).tot - pz(r23c).t) === 24 && pz(r23c).reden === 'geweigerd: sha',
        'n=1, 24 u', r23c.fout || r23c.haalKapot + ' ' + kort(r23c.metaRec));

    // KF22b/KF23b/KF19b: de bewaking in kaartBestandHaal; het wissen in de transactie van de versie; de grens van 5 s
    const r22c = await rit({ bestanden: goed, overpass: '502', stappen: ['haalInPauze'] });
    eis('KF22b in een pauze geeft kaartBestandHaal meteen onwaar, zonder iets op te halen (ook bij een directe vraag)',
        !r22c.fout && r22c.haalInPauze && r22c.haalInPauze.terug === false && r22c.haalInPauze.lichten === 0, 'onwaar, 0', r22c.fout || kort(r22c.haalInPauze));
    const r23b = await rit({ bestanden: goed, overpass: '502', geenAfloop: true, stappen: [{ zet: { pauze: { ...verlopen } } }, P0, 'meta'] });
    eis('KF23b het merkteken en de pauze gaan weg in dezelfde transactie als de nieuwe versie (ook als de pagina daarna sterft vóór de rest van de afloop)',
        !r23b.fout && r23b.eind.bron === 'bestand' && r23b.metaRec && !r23b.metaRec.bezig && !r23b.metaRec.pauze && !!r23b.metaRec.actief, 'weg', r23b.fout || kort(r23b.metaRec));
    const r19b = await rit({ bestanden: goed, overpass: '502', stappen: ['merkTijd'] });
    eis('KF19b een schrijfactie in de eigen database die niet afkomt, stopt na 5 s (merk tijd): het ophalen blijft niet hangen',
        !r19b.fout && r19b.merkTijd && r19b.merkTijd.r === 'merk tijd' && r19b.merkTijd.ms >= 4900 && r19b.merkTijd.ms < 7000, 'merk tijd na ~5 s', r19b.fout || kort(r19b.merkTijd));

    // KF24: een geweigerd bestand (sha256) wordt niet bij elke start opnieuw opgehaald
    const sha24 = await v8('sha');
    const r24a = await rit({ bestanden: sha24, overpass: 'ok', ovKaart: ovRef, startlog: true, stappen: [P0, 'meta'] });
    const r24b = await rit({ bestanden: sha24, overpass: 'ok', ovKaart: ovRef, stappen: [P0, 'opnieuw'] }, false);
    eis('KF24 een geweigerd bestand (sha256): een pauze van 24 uur (kbx geweigerd: sha); de volgende start geen versie.json en geen download, de kaart van Overpass',
        !r24a.fout && !r24b.fout && r24a.vragen['lichten.json'] === 1 && pz(r24a).reden === 'geweigerd: sha' && rond(pz(r24a).tot - pz(r24a).t) === 24 && r24a.startlog.kbx === 'geweigerd: sha' && r24a.startlog.kbp === 24
          && !r24a.metaRec.bezig && !r24b.vragen['versie.json'] && !r24b.vragen['lichten.json'] && r24b.eind.bron === 'overpass',
        'pauze; 0 downloads', r24a.fout || r24b.fout || kort(r24a.vragen) + ' ' + kort(r24a.metaRec) + ' ' + kort(r24a.startlog) + ' | ' + kort(r24b.vragen) + ' ' + r24b.eind.bron);

    // KF24b: een ontbrekend bestand (404) geeft geen pauze: er is niets opgehaald; is het er bij de volgende start wel, dan meteen
    const r24c = await rit({ bestanden: await v8('404'), overpass: 'ok', ovKaart: ovRef, stappen: [P0, 'meta'] });
    const r24d = await rit({ bestanden: goed, overpass: '502', stappen: [P0, 'meta'] }, false);
    eis('KF24b een ontbrekend bestand (404): de kaart van Overpass maar geen pauze (er is niets opgehaald); staat het bestand er bij de volgende start, dan meteen de kaart uit het bestand',
        !r24c.fout && !r24d.fout && r24c.eind.bron === 'overpass' && !r24c.metaRec.pauze && !r24c.metaRec.bezig && r24d.vragen['versie.json'] === 1 && r24d.vragen['lichten.json'] === 1 && r24d.eind.bron === 'bestand',
        'geen pauze; daarna het bestand', r24c.fout || r24d.fout || r24c.eind.bron + ' ' + kort(r24c.metaRec) + ' | ' + kort(r24d.vragen) + ' ' + r24d.eind.bron);

    // KF25: de app ging tijdens de poging naar de achtergrond: de eerste keer geen pauze, twee keer op rij wel
    const bezigV = { id: 'proef', t: Date.now() - 60000, versie: 'x', fase: 'lees', verborgen: true };
    const r25a = await rit({ bestanden: goed, overpass: '502', stappen: [{ zet: { bezig: bezigV } }, P0, 'meta'] });
    const r25b = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, stappen: [{ zet: { bezig: bezigV, pauze: { n: 1, p: 0, tot: 0, reden: 'eerdere poging onderbroken', t: Date.now() - 60000 } } }, P0, 'meta'] });
    eis('KF25 achtergrond: na één onderbroken poging meteen een nieuwe (kaart uit het bestand, logregel onderbroken, daarna geen pauze meer); twee keer op rij: een pauze van 24 uur en de kaart van Overpass',
        !r25a.fout && !r25b.fout && r25a.eind.bron === 'bestand' && r25a.vragen['lichten.json'] === 1 && r25a.log.some(x => /^onderbroken: eerdere poging onderbroken fase=lees n=1 pauze=0u$/.test(x)) && !r25a.metaRec.pauze
          && r25b.eind.bron === 'overpass' && !r25b.vragen['lichten.json'] && pz(r25b).n === 2 && pz(r25b).p === 1 && rond(pz(r25b).tot - pz(r25b).t) === 24,
        'eerst vrij, dan 24 u', r25a.fout || r25b.fout || r25a.eind.bron + ' ' + r25a.log.join(' ; ') + ' ' + kort(r25a.metaRec) + ' | ' + r25b.eind.bron + ' ' + kort(pz(r25b)));

    // KF26: inlezen dat in beeld te lang duurt: een pauze; op de achtergrond: geen pauze (dan telt de tijd niet)
    const r26a = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, leesHangt: true, leesMaxMs: 300, stappen: [P0, 'meta'] });
    const r26b = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, leesHangt: true, leesMaxMs: 300, achtergrond: true, stappen: [P0, 'meta'] });
    eis('KF26 inlezen dat in beeld langer duurt dan de grens: de kaart van Overpass en een pauze (geweigerd: werker tijd); ging de app intussen naar de achtergrond: geen pauze, en het merkteken is in beide gevallen weg',
        !r26a.fout && !r26b.fout && r26a.eind.bron === 'overpass' && pz(r26a).reden === 'geweigerd: werker tijd' && !r26a.metaRec.bezig
          && r26b.eind.bron === 'overpass' && !r26b.metaRec.pauze && !r26b.metaRec.bezig,
        'pauze; geen pauze', r26a.fout || r26b.fout || kort(r26a.metaRec) + ' | ' + kort(r26b.metaRec) + ' | ' + r26a.log.slice(-1) + ' / ' + r26b.log.slice(-1));

    // KF27: de achtergrond en weer in beeld staan in het merkteken; wat telt is de stand op het moment van wegvallen
    const r27a = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, leesHangt: true, stappen: [{ sterf: 'verborgen' }] });
    const r27b = await rit({ bestanden: goed, overpass: '502', stappen: [P0, 'meta'] }, false);
    const r27c = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, leesHangt: true, stappen: [{ sterf: 'terug' }] });
    const r27d = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, stappen: [P0, 'meta'] }, false);
    eis('KF27 naar de achtergrond tijdens het inlezen: het merkteken krijgt verborgen; viel de app zo weg, dan de volgende start onderbroken en meteen een nieuwe poging; weer in beeld en dan weggevallen: stierf en een pauze',
        !r27a.fout && !r27b.fout && !r27c.fout && !r27d.fout && ((r27a.zicht || [])[0] || {}).verborgen === true && r27b.log.some(x => /^onderbroken: eerdere poging onderbroken fase=lees n=1 pauze=0u$/.test(x)) && r27b.eind.bron === 'bestand'
          && ((r27c.zicht || [])[1] || {}).verborgen === false && r27d.log.some(x => /^stierf: eerdere poging stierf fase=lees n=1 pauze=24u$/.test(x)) && r27d.eind.bron === 'overpass',
        'onderbroken; stierf', r27a.fout || r27b.fout || r27c.fout || r27d.fout || kort(r27a.zicht) + ' ' + r27b.log.join(' ; ') + ' | ' + kort(r27c.zicht) + ' ' + r27d.log.join(' ; '));

    // KF28: een database die nooit antwoordt
    const r28a = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, dbHangt: true, startlog: true, stappen: [P0, 'opnieuw', 'fiets'] });
    eis('KF28 de database antwoordt nooit: na 10 s de kaart van Overpass (één vraag, nooit twee open), logreden db-timeout (n=1, pauze 24 u), merkteken in localStorage; een tweede kaartvraag en de fietsvraag wachten niet opnieuw (de database één keer geopend)',
        !r28a.fout && r28a.eind.bron === 'overpass' && r28a.eind.ids === '9610001,9610003' && r28a.maxTegelijk === 1 && r28a.duur >= 10000 && r28a.duur < 16000 && r28a.dbOpen === 1
          && r28a.log.some(x => /^db: db-timeout n=1 pauze=24u$/.test(x)) && r28a.startlog.kbx === 'db-timeout' && r28a.startlog.kbn === 1 && r28a.startlog.kbp === 24 && /^db:db-timeout$/.test(r28a.startlog.kbf)
          && r28a.dbMerk && r28a.dbMerk.n === 1 && !r28a.vragen['lichten.json'],
        'na 10 s Overpass', r28a.fout || r28a.eind.bron + ' ' + r28a.duur + ' ms, open ' + r28a.dbOpen + ', max ' + r28a.maxTegelijk + ' | ' + r28a.log.join(' ; ') + ' | ' + kort(r28a.startlog) + ' ' + kort(r28a.dbMerk));
    const hang1 = { t: Date.now() - 60000, n: 1 };
    const r28b = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, dbHangt: true, startlog: true, stappen: [{ ls: { sl_kaartdb: hang1 } }, P0] });
    eis('KF28b de volgende start (merkteken van een hangende database, 24 uur nog niet om): de database niet aangeraakt, geen versie.json, meteen de kaart van Overpass (niet 10 s), logregel pauze db-timeout',
        !r28b.fout && r28b.eind.bron === 'overpass' && r28b.dbOpen === 0 && !r28b.vragen['versie.json'] && r28b.duur < 5000 && r28b.log.some(x => /^pauze: db-timeout nog 2[34]u n=1$/.test(x)) && r28b.startlog.kbv === 'pauze' && r28b.startlog.kbx === 'db-timeout',
        'meteen Overpass', r28b.fout || r28b.eind.bron + ' ' + r28b.duur + ' ms, open ' + r28b.dbOpen + ' | ' + r28b.log.join(' ; ') + ' | ' + kort(r28b.startlog));
    const r28c = await rit({ bestanden: goed, overpass: '502', stappen: [{ ls: { sl_kaartdb: { t: Date.now() - 25 * UUR, n: 1 } } }, P0] });
    const r28d = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, dbHangt: true, stappen: [{ ls: { sl_kaartdb: { t: Date.now() - 25 * UUR, n: 1 } } }, P0] });
    eis('KF28c na de pauze één nieuwe poging: antwoordt de database weer, dan de kaart uit het bestand en het merkteken weg; hangt hij weer, dan n=2 (72 uur)',
        !r28c.fout && !r28d.fout && r28c.eind.bron === 'bestand' && r28c.dbMerk === null && r28d.eind.bron === 'overpass' && r28d.dbMerk && r28d.dbMerk.n === 2 && r28d.log.some(x => /^db: db-timeout n=2 pauze=72u$/.test(x)),
        'weg; n=2', r28c.fout || r28d.fout || r28c.eind.bron + ' ' + kort(r28c.dbMerk) + ' | ' + r28d.eind.bron + ' ' + kort(r28d.dbMerk) + ' ' + r28d.log.join(' ; '));

    // KF28d: een goed bestand in de telefoon, de database hangt pas bij het lezen van de vakken
    const r28e = await rit({ bestanden: goed, overpass: '502', stappen: [P0] });
    const r28f = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, ovFiets: [9610003], dbHangtNa: 1, stappen: [P0, 'fiets'] }, false);
    eis('KF28d de database hangt pas bij het lezen van de vakken: na 10 s de kaart van Overpass; de fietsvraag daarna wacht niet opnieuw 10 s (de database deze start uit, twee keer geopend)',
        !r28e.fout && !r28f.fout && r28e.eind.bron === 'bestand' && r28f.eind.bron === 'overpass' && r28f.dbOpen === 2 && r28f.duur >= 10000 && r28f.duur < 16000 && r28f.overpassFiets === 1 && r28f.log.some(x => /^db: db-timeout n=1/.test(x)),
        'na 10 s Overpass, fiets meteen', r28e.fout || r28f.fout || r28f.eind.bron + ' ' + r28f.duur + ' ms, open ' + r28f.dbOpen + ', fiets ' + r28f.overpassFiets + ' | ' + r28f.log.join(' ; '));

    const r28g = await rit({ bestanden: goed, overpass: '502', stappen: [P0] });
    const r28h = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, ovFiets: [9610003], dbTraagMs: 11000, stappen: [P0, { wacht: 2500 }, 'fiets'] }, false);
    eis('KF28e de database is traag (antwoordt na 11 s): na 10 s de kaart van Overpass; daarna blijft de database deze start uit, ook als hij alsnog antwoordt (de fietsvraag wacht niet opnieuw, één keer geopend)',
        !r28g.fout && !r28h.fout && r28h.eind.bron === 'overpass' && r28h.dbOpen === 1 && r28h.overpassFiets === 1 && r28h.duur < 16000,
        'fiets meteen', r28g.fout || r28h.fout || r28h.eind.bron + ' ' + r28h.duur + ' ms, open ' + r28h.dbOpen + ', fiets ' + r28h.overpassFiets + ' | ' + r28h.log.join(' ; '));

    // KF29: een tik op de Kaart-pil tijdens de pauze
    const pauze29 = { n: 2, p: 2, tot: Date.now() + 3 * DAG, reden: 'eerdere poging stierf', t: Date.now() };
    const r29 = await rit({ bestanden: goed, overpass: 'ok', ovKaart: ovRef, stappen: [{ zet: { pauze: pauze29 } }, P0, 'tik', 'meta'] });
    const t29 = r29.tikken || [];
    eis('KF29 tijdens de pauze (kaart van Overpass): een tik heft de pauze op en doet één nieuwe poging: de kaart uit het bestand, de bestaande melding Kaart wordt opnieuw opgehaald, logregel opgeheven met n=2 (het aantal blijft zichtbaar)',
        !r29.fout && r29.stappen[0].bron === 'overpass' && t29.length === 1 && t29[0].bron === 'bestand' && r29.toasts[0] === 'Kaart wordt opnieuw opgehaald'
          && r29.vragen['lichten.json'] === 1 && r29.log.some(x => /^pauze: opgeheven door tik n=2$/.test(x)) && !r29.metaRec.pauze,
        'opgeheven, één poging', r29.fout || (r29.stappen[0] || {}).bron + ' -> ' + t29.map(x => x.bron).join(',') + ' | ' + kort(r29.toasts) + ' | lichten ' + r29.vragen['lichten.json'] + ' | ' + r29.log.join(' ; ') + ' | ' + kort(r29.metaRec));
    const r29b = await rit({ bestanden: await v8('sha'), overpass: 'ok', ovKaart: ovRef, stappen: [{ zet: { pauze: pauze29 } }, P0, 'tik', 'tik', 'meta'] });
    eis('KF29b mislukt de poging na de tik weer (sha256): een nieuwe, langere pauze (n=3, 9 dagen); een tweede tik binnen een minuut: de bestaande melding Opnieuw kan over …, en niets opgehaald (geen lus door herhaald tikken)',
        !r29b.fout && r29b.vragen['lichten.json'] === 1 && r29b.toasts[0] === 'Kaart wordt opnieuw opgehaald' && /^Opnieuw kan over /.test(r29b.toasts[1] || '')
          && pz(r29b).n === 3 && pz(r29b).p === 3 && Math.round((pz(r29b).tot - pz(r29b).t) / DAG) === 9 && r29b.eind.bron === 'overpass',
        'n=3, tweede tik niets', r29b.fout || kort(r29b.toasts) + ' | lichten ' + r29b.vragen['lichten.json'] + ' | ' + kort(r29b.metaRec) + ' ' + r29b.eind.bron);

    const r29c = await rit({ bestanden: await v8('sha'), overpass: 'ok', ovKaart: ovRef, stappen: [P0, 'tik', 'meta'] });
    eis('KF29c een pauze door een weigering in dezelfde start: een tik doet toch één nieuwe poging (lichten.json twee keer) en daarna een langere pauze (n=2)',
        !r29c.fout && r29c.vragen['lichten.json'] === 2 && r29c.toasts[0] === 'Kaart wordt opnieuw opgehaald' && pz(r29c).n === 2 && pz(r29c).p === 2,
        'twee keer, n=2', r29c.fout || 'lichten ' + r29c.vragen['lichten.json'] + ' | ' + kort(r29c.toasts) + ' | ' + kort(r29c.metaRec));

    // ═══ KF16 — regressie ═══════════════════════════════════════
    const DL20_NIEUW = "    const d = await kaartHaalKaart(lat, lon, q);   // V11.37.20: eerst het eigen bestand (kaart/), anders de zeven regels die hier stonden (nu in kaartVraagOverpass), zie kaartHaalKaart";
    const DL_OUD = ['    const ctrl = new AbortController();', '    const t = setTimeout(()=>ctrl.abort(), 25000);',
      "    const r = await fetch(OVERPASS_URL, { method:'POST', body:`data=${encodeURIComponent(q)}`, signal:ctrl.signal });", '    clearTimeout(t);',
      "    if (!r.ok) kaartRem.fout = { status: r.status, ra: (r.headers && typeof r.headers.get === 'function') ? r.headers.get('Retry-After') : null };   // V11.37.12",
      '    if (!r.ok) throw new Error(`HTTP ${r.status}`);', '    const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud'].join(NL);
    const ATTR_NIEUW = "      attribution: '© <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\" rel=\"noopener\">OpenStreetMap-bijdragers</a> (<a href=\"https://opendatacommons.org/licenses/odbl/\" target=\"_blank\" rel=\"noopener\">ODbL</a>)'   // V11.37.20: de bron en de licentie, zoals de OSMF-richtlijnen vragen (osmfoundation.org/wiki/Licence/Attribution_Guidelines)";
    const zonderV113720 = (s) => String(s).replace(DL20_NIEUW, DL_OUD).replace(ATTR_NIEUW, "      attribution: '© OpenStreetMap'").split(NL).filter(l => !/V11\.37\.20(?!\d)|V11\.37\.25(?!\d)/.test(l)).join(NL);   // V11.37.25: ook de regel van V11.37.25 in downloadOSM (test_plaatsen)
    const V113718 = { downloadOSM: ['59824e76', 5692], kaartWeergaveBij: ['ee5e6148', 1602], fietsHaalOp: ['855f1423', 2068], openKaartOverlay: ['4d296210', 3765] };
    const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.20(?!\d)/.test(l)).length;
    const MERK = { downloadOSM: 1, kaartWeergaveBij: 3, fietsHaalOp: 3, openKaartOverlay: 1 };
    const telAf = Object.entries(MERK).filter(([n, m]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
    eis('KF16a vier functies krijgen regels met merkteken V11.37.20: downloadOSM 1, kaartWeergaveBij 3, fietsHaalOp 3, openKaartOverlay 1', telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
    const anders = Object.entries(V113718).filter(([n, [h, l]]) => { const s = zonderV113720(window[n]); return fnv(s) !== h || s.length !== l; }).map(([n]) => n + ' ' + fnv(zonderV113720(window[n])) + '/' + zonderV113720(window[n]).length);
    eis('KF16b zonder die regels (en met de zeven oude regels en de oude bronregel terug) byte-gelijk aan V11.37.18', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
    const ONGEWIJZIGD = { kaartRemNa: ['7bcfcc97', 567], kaartLeesInhoud: ['205518d9', 518], kaartFoutReden: ['821ff4cd', 230], kaartFoutNoteer: ['b0fb37e5', 99],
      kaartPilTik: ['99d7651c', 924], kaartZelfOpnieuw: ['a9736b11', 725], kaartNodig: ['71ae6aa9', 166], kaartKlokTik: ['865695f4', 77], kaartBewaar: ['aac30b1e', 1063],
      kaartKeur: ['c783f42d', 1313], kaartNaDownload: ['54dc4432', 269], kaartBewaardTik: ['479952c2', 496], kaartBewaardZet: ['37f122a5', 539], kaartBewaardLaad: ['e23cf72d', 902],
      kaartIdbOpen: ['94d3d90e', 498], startLogKaartFout: ['e9d0c340', 331], overpassRetryAfter: ['4e9804b8', 244], onGPS: ['9c40a4a2', 15631], updateDichtbij: ['cbf57ede', 12709],
      logOpslagMis: ['6d7fd828', 16172], startApp: ['7d034c90', 4902], kiesBesteWeg: ['724fc2d7', 650], kiesMaxspeed: ['a7b6bce7', 461], tegenRijrichtingen: ['54bb2b55', 1112],
      peilingNaar: ['64ce3937', 609], berekenClusterNodes: ['3c2246d1', 1361], migratieSlPos: ['2f5621af', 396], haalStraatnamenOp: ['2a318437', 1102],
      refreshStadIndienNodig: ['a5c82101', 1145], vindDichtbij: ['d32386d8', 4753], fietsSluitUit: ['ec1d273c', 170], fietsTerug: ['6f950997', 372], fietsPuurDichtst: ['2a9b09f8', 418],
      fietsLees: ['3decdc6d', 314], fietsLaad: ['c920654a', 154], fietsGedekt: ['f6776294', 196], fietsBewaar: ['2879ff66', 358], fietsDekking: ['ef0400e2', 402],
      fietsNaKaart: ['76a98f2c', 137], fietsPlan: ['3889ea07', 214], fietsWacht: ['398bd178', 277], fietsPoging: ['69721b85', 208], fietsPogingSchrijf: ['59a8b634', 233],
      fietsPogingen: ['410660e5', 214], afstand: ['c006e195', 264], startLogSchrijf: ['5d6078c', 942], startLogMijl: ['67b9f11f', 246], kaartKlok: ['20547389', 142] };
    const zonderCb = (f) => String(f).split(NL).filter(l => !/crashbewaking/.test(l)).join(NL);   // kaartPilTik kreeg twee regels met merkteken crashbewaking (de pauze opheffen)
    // V11.37.23: in refreshStadIndienNodig is één regel vervangen (de positie afgerond, zie test_meetwerk23); hier de oude regel terug
    const terugV113723 = (f) => String(f).replace("const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${stadAfgerond(lat)}&lon=${stadAfgerond(lon)}&zoom=10&format=json`, { headers:{'User-Agent':'StoplichtIQ/8.8'} });   // V11.37.23: de positie afgerond op 0,01 graad (~1 km), zie stadAfgerond", "const r = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&zoom=10&format=json`, { headers:{'User-Agent':'StoplichtIQ/8.8'} });");
    const anders2 = Object.entries(ONGEWIJZIGD).filter(([n, [h, l]]) => { const s = zonderCb(zonderV113721(terugV113723(window[n]))); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
    eis('KF16e kaartPilTik: precies twee regels met merkteken crashbewaking (de rest byte-gelijk, zie KF16c); de andere 47 functies hebben er geen',
        String(kaartPilTik).split(NL).filter(l => /crashbewaking/.test(l)).length === 2 && Object.keys(ONGEWIJZIGD).filter(n => n !== 'kaartPilTik' && /crashbewaking/.test(String(window[n]))).length === 0, '2 en 0', String(String(kaartPilTik).split(NL).filter(l => /crashbewaking/.test(l)).length));
    eis('KF16c 48 functies rond de kaart, de lichtkeuze, de fietslijst en de startlog zijn byte-gelijk aan V11.37.18', anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');
    const ov7 = String(kaartVraagOverpass);
    eis('KF16d de zeven oude regels staan nu in kaartVraagOverpass (de laatste geeft de inhoud terug)',
        DL_OUD.split(NL).slice(0, 6).every(l => ov7.includes(l)) && ov7.includes('    return kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens'), 'zo', ov7.slice(0, 160));

    // ═══ KF17 — de bron op de kaartweergave ═══════════════════════
    const okv = String(openKaartOverlay);
    eis('KF17 de kaartweergave noemt © OpenStreetMap-bijdragers (link naar osm.org/copyright) en ODbL (link naar de licentie)',
        okv.includes('href="https://www.openstreetmap.org/copyright"') && okv.includes('>OpenStreetMap-bijdragers</a>') && okv.includes('href="https://opendatacommons.org/licenses/odbl/"') && okv.includes('>ODbL</a>)'),
        'zo', (okv.match(/attribution: [^\n]*/) || [''])[0].slice(0, 200));
  } catch (e) {
    eis('KF de toets zelf', false, 'geen fout', String((e && e.stack) || e).slice(0, 300));
  } finally {
    await kfIdbWeg(KF_IDB); await kfIdbWeg('StoplichtIQ_Kaart');
    try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
    await slaap(50);
    herstel();
  }
  await idbWeesWeg23();   // V11.37.23: wezen van de iframe-ritten uit de spiegel, zie idbWeesWeg23
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') {
  window.testKaartbestand = testKaartbestand; window.kaartBestandRitBinnen = kaartBestandRitBinnen;
}
