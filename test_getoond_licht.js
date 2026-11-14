// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_getoond_licht.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.7: Meetdata wist het schaduwlog niet meer, en de radar en
//  de debugregel volgen het licht dat de app toont (dichtstbijOSM), niet het
//  licht van de laatste fase (huidigBevestigdOsmNodeId).
//
//  GL1  per route (delen lukt, delen mislukt en dan downloaden, alleen
//       downloaden): het schaduwlog staat er na de export nog, en zit in het
//       bestand
//  GL2  de radar: na een wissel van A naar B pulseert B; zonder getoond licht
//       pulseert niets; zonder wissel blijft het zoals het was
//  GL3  de debugregel: de tag van het getoonde licht, niet die van het oude
//  GL4  regressie: de drie functies zijn met hun ene regel terug byte-gelijk
//       aan V11.37.6, en de lichtkeuze is byte-gelijk aan V11.37.6
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_getoond_licht.js';
//      document.head.appendChild(s);
//      s.onload = () => testGetoondLicht().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════
// V11.37.21: de regels met dit merkteken weg, zodat de vergelijkingen hieronder de functies van vóór V11.37.21 blijven toetsen (zie test_meetwerk21)
function zonderV113721(s) { return String(s).split('\n').map(terugV113731).map(terugV113726).filter(l => !/V11\.37\.21(?!\d)|V11\.37\.22(?!\d)|V11\.37\.23(?!\d)|V11\.37\.25(?!\d)|V11\.37\.26(?!\d)|V11\.37\.30(?!\d)|V11\.37\.31(?!\d)|V11\.37\.34(?!\d)|V11\.37\.35(?!\d)|V11\.37\.36(?!\d)|V11\.37\.37(?!\d)|V11\.37\.38(?!\d)/.test(l)).join('\n'); }   // V11.37.22: ook de meetregels van V11.37.22 (test_meetwerk22); V11.37.23: idem (test_meetwerk23); V11.37.25: idem (test_plaatsen)   // V11.37.26: idem (test_schaduw_nano), met terugV113726
// V11.37.26: drie regels van laadONNXModel zijn vervangen (de modelnaam komt uit MODEL_PADEN, test_schaduw_nano).
// Die gaan hier terug naar de oude tekst; daarna vallen de regels met merkteken V11.37.26 weg zoals de andere.
// V11.37.31: Nano is het hoofdmodel; deze regels zijn VERVANGEN (niet toegevoegd). Hier gaat precies de oude regel terug,
// zodat de vergelijkingen hieronder de oude functies blijven toetsen. Toegevoegde regels vallen weg via het merkteken V11.37.31.
var TERUG_V113731 = {"      try { onnxSession = await hoofdSessie(modelPad); } catch (e2) { modelPad = hoofdPaden()[2]; if (!modelPad) throw e2; onnxSession = await hoofdSessie(modelPad); }   // V11.37.34: de reserveketen tot en met de derde stap": "      onnxSession = await ort.InferenceSession.create(modelPad, { executionProviders:['wasm'], graphOptimizationLevel:'all' });", "  if (totaalMCheck === 0 && (obsNu == null || obsNu < OBS_MINIMUM) && conf != null && conf < hoofdGrens('leer')) {   // V11.37.33: de grens van het geladen model": "  if (totaalMCheck === 0 && (obsNu == null || obsNu < OBS_MINIMUM) && conf != null && conf < 0.20) {", "    if (Array.isArray(detecties) && detecties.some(d => familieScore(d) >= hoofdGrens('sterk'))) minStat.s[b]++;   // V11.37.33: de grens van het geladen model": "    if (Array.isArray(detecties) && detecties.some(d => familieScore(d) >= MINUUT_STERK)) minStat.s[b]++;", "  if (gesmoothedScore >= hoofdGrens('camNode') && snelheidKmh > 5 && huidigePos) {   // V11.37.33: de grens van het geladen model": "  if (gesmoothedScore >= 0.60 && snelheidKmh > 5 && huidigePos) {", "    if (familieScore(bbox) < hoofdGrens('s2Fam')) continue;   // V11.37.33: de grens van het geladen model": "    if (familieScore(bbox) < 0.35) continue;", "    if (kleur && bbox.score >= hoofdGrens('s2Aanwezig')) slaS2Aanwezigheid(match.nodeId, kleur);   // V11.37.33: de grens van het geladen model": "    if (kleur && bbox.score >= 0.50) slaS2Aanwezigheid(match.nodeId, kleur);", "    if (trainframesAan) slaTrainframeOp('s2', bbox.klasse, bbox.cx/YOLO_SIZE, bbox.cy/YOLO_SIZE, bbox.w/YOLO_SIZE, bbox.h/YOLO_SIZE, bbox.score < hoofdGrens('tfTwijfelS2'));   // V11.37.33: de grens van het geladen model": "    if (trainframesAan) slaTrainframeOp('s2', bbox.klasse, bbox.cx/YOLO_SIZE, bbox.cy/YOLO_SIZE, bbox.w/YOLO_SIZE, bbox.h/YOLO_SIZE, bbox.score < 0.55);", "    const _hoogFScore = (aiR.fScore || 0) >= hoofdGrens('fscore');   // V11.37.33: de grens van het geladen model": "    const _hoogFScore = (aiR.fScore || 0) >= FSCORE_OVERRIDE_DREMPEL;", "    if (aiTeller === 1 && trainframesAan && aiR.box && aiR.score < hoofdGrens('s1Twijfel')) {   // V11.37.33: de grens van het geladen model": "    if (aiTeller === 1 && trainframesAan && aiR.box && aiR.score < 0.60) {", "    const wasStabiel = greenConfHistory.length >= 2 && gemGreen > hoofdGrens('groenStabiel');   // V11.37.33: de grens van het geladen model": "    const wasStabiel = greenConfHistory.length >= 2 && gemGreen > GREEN_STABIEL_DREMPEL;", "  if (b.tap) return !(fam >= hoofdTapConf()) ? 'conf_tik' : (b.h < 2 || b.w <= 0) ? 'klein' : 'door';   // V11.37.33: de grens van het geladen model": "  if (b.tap) return !(fam >= TAP_CONF_DREMPEL) ? 'conf_tik' : (b.h < 2 || b.w <= 0) ? 'klein' : 'door';", "  if (!(fam >= hoofdConf())) return 'conf';   // V11.37.33: de grens van het geladen model": "  if (!(fam >= CONF_DREMPEL)) return 'conf';", "    let modelPad = hoofdPaden()[0];   // V11.37.31: Nano eerst (HOOFD_PADEN_NANO), zie het blok V11.37.31": "    let modelPad = './model.onnx';", "      onnxSession = await hoofdSessie(modelPad);   // V11.37.31: één download, de sessie op de hoofdthread pas als er geen worker is": "      onnxSession = await ort.InferenceSession.create(modelPad, { executionProviders:['wasm'], graphOptimizationLevel:'all' });", "      modelPad = hoofdPaden()[1];   // V11.37.31: de reserve uit de lijst": "      modelPad = './model/model.onnx';", "    if (!(modelSoortVan(modelPad) in MODEL_SOORTEN)) throw new Error('hoofdpad ' + modelPad + ': onbekende soort');   // V11.37.31: YOLOv8 of YOLOX; de worker en de nabewerking volgen de soort": "    if (modelSoortVan(modelPad) !== 'yolov8') throw new Error('hoofdpad ' + modelPad + ' is geen YOLOv8-bestand');   // V11.37.26: het hoofdpad leest alleen YOLOv8 (images RGB 0..1, output0)", "    pAI.className='pill-dot g'; pAIT.textContent=hoofdLabel(modelPad);   // V11.37.31: 'Nano' of 'YOLOv8n'": "    pAI.className='pill-dot g'; pAIT.textContent='YOLOv8n';   // V11.37.26: was 'YOLOv8'", "      const modelArrayBuffer = await hoofdBuffer(modelPad);   // V11.37.31: dezelfde download als hoofdSessie, geen tweede": "      const modelArrayBuffer = await fetch(modelPad).then(r=>r.arrayBuffer());", "      const blob = new Blob([hoofdWorkerCode(modelPad)], { type:'application/javascript' });   // V11.37.31: de Nano-worker voor een YOLOX-bestand": "      const blob = new Blob([YOLO_WORKER_CODE], { type:'application/javascript' });", "      if (famScore < hoofdTapConf()) continue;   // V11.37.31: de drempel van het geladen model (Nano 0,03)": "      if (famScore < TAP_CONF_DREMPEL) continue;", "      if (famScore < hoofdConf()) continue;   // V11.37.31: idem (Nano 0,07)": "      if (famScore < CONF_DREMPEL) continue;", "  './model.onnx':            { soort: 'yolov8', naam: 'YOLOv8n',                rol: 'reserve' },   // V11.37.31: was hoofd (zie HOOFD_PADEN_NANO)": "  './model.onnx':            { soort: 'yolov8', naam: 'YOLOv8n',                rol: 'hoofd' },", "  './model/model.onnx':      { soort: 'yolov8', naam: 'YOLOv8n (reservemodel)', rol: 'reserve2' },   // V11.37.31: was reserve (alleen nog na sl_hoofdmodel=yolov8)": "  './model/model.onnx':      { soort: 'yolov8', naam: 'YOLOv8n (reservemodel)', rol: 'reserve' },", "  './model/yolox_nano.onnx': { soort: 'yolox',  naam: 'YOLOX-Nano',             rol: 'hoofd' }   // V11.37.31: was schaduw": "  './model/yolox_nano.onnx': { soort: 'yolox',  naam: 'YOLOX-Nano',             rol: 'schaduw' }"};
function terugV113731(l) { return Object.prototype.hasOwnProperty.call(TERUG_V113731, l) ? TERUG_V113731[l] : l; }
function terugV113726(l) {
  if (!/V11\.37\.26(?!\d)/.test(l)) return l;
  return l.replace(/^(\s*)sModelLabel\.textContent = '🤖 Model laden…';.*$/, "$1sModelLabel.textContent = '🤖 YOLOv8 model laden…';")
          .replace(/^(\s*)sModelLabel\.textContent = `✓ Model klaar: \$\{modelNaamVan\(modelPad\)\} \(\$\{t\}s\)`;.*$/, '$1sModelLabel.textContent = `✓ YOLOv8 klaar (${t}s)`;')
          .replace(/^(\s*)pAI\.className='pill-dot g'; pAIT\.textContent='YOLOv8n';.*$/, "$1pAI.className='pill-dot g'; pAIT.textContent='YOLOv8';");
}

async function testGetoondLicht() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  // Sleutel voor sleutel, niet met clear(): de IndexedDB-spiegel ziet clear() niet.
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) opslagVerwijder(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };
  const A = '9990000001', B = '9990000002';

  // ═══ GL1 — het schaduwlog na Meetdata ══════════════════════
  const bewaar = { alert: window.alert, maak: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click,
                   share: Object.getOwnPropertyDescriptor(navigator, 'share'), canShare: Object.getOwnPropertyDescriptor(navigator, 'canShare') };
  let bestanden = [], meldingen = [];
  const routes = {
    'delen lukt': () => { Object.defineProperty(navigator, 'share', { value: (d) => { bestanden.push(...d.files); return Promise.resolve(); }, configurable: true });
                          Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true }); },
    'delen mislukt, dan downloaden': () => { Object.defineProperty(navigator, 'share', { value: () => Promise.reject(new Error('mislukt')), configurable: true });
                          Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true }); },
    'alleen downloaden': () => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
                          Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); }
  };
  try {
    window.alert = (m) => { meldingen.push(String(m)); };
    URL.createObjectURL = (b) => { bestanden.push(b); return 'blob:test'; };
    HTMLAnchorElement.prototype.click = function () {};
    for (const [route, zet] of Object.entries(routes)) {
      zet(); bestanden = []; meldingen = [];
      const rijen = [0, 1, 2].map(i => ({ t: 1790000000000 + i, node: A, route }));
      localStorage.setItem('sl_schaduwlog', JSON.stringify(rijen));
      const voor = localStorage.getItem('sl_schaduwlog');
      exporteerMeetdata();
      for (let i = 0; i < 60 && !(meldingen.length && bestanden.length >= 2); i++) await slaap(50);   // delen: twee bestanden; downloaden: twee blobs
      let meet = null;
      for (const b of bestanden) { try { const j = JSON.parse(await b.text()); if (!Array.isArray(j.sleutels)) meet = j; } catch (e) {} }
      const inBestand = meet && meet.schaduw && Array.isArray(meet.schaduw.sl_schaduwlog) ? meet.schaduw.sl_schaduwlog.length : null;
      const na = localStorage.getItem('sl_schaduwlog');
      eis('GL1 ' + route + ': na de Meetdata-export staat het schaduwlog er nog (3 regels), en het zit in het bestand',
          na === voor && inBestand === 3 && meldingen.length > 0,
          'bewaard, 3 in het bestand', (na === voor ? 'bewaard' : 'WEG') + ', ' + inBestand + ' in het bestand, melding: ' + (meldingen.join(' / ') || 'geen'));
    }
  } finally {
    window.alert = bewaar.alert; URL.createObjectURL = bewaar.maak; HTMLAnchorElement.prototype.click = bewaar.klik;
    if (bewaar.share) Object.defineProperty(navigator, 'share', bewaar.share); else delete navigator.share;
    if (bewaar.canShare) Object.defineProperty(navigator, 'canShare', bewaar.canShare); else delete navigator.canShare;
    const b = document.getElementById('export-meetdata-btn'); if (b) b.disabled = false;
    herstel();
  }

  // ═══ GL2 — de radar ════════════════════════════════════════
  const st = { d: dichtstbijOSM, h: huidigBevestigdOsmNodeId, cache: osmCache, pos: huidigePos, zoom: radarZoomAfstand, nodes: radarSheetNodes };
  const sheet = document.getElementById('radar-sheet');
  const sheetStijl = sheet ? { display: sheet.style.display, transform: sheet.style.transform } : null;
  const P = { lat: 52.30, lon: 4.80 };
  const knoop = (id, m) => ({ id: Number(id), lat: P.lat + m / 111320, lon: P.lon, naam: 'proef ' + id.slice(-1) });
  const actief = () => { radarSheetNodes = []; tekenRadarSheet(); return radarSheetNodes.filter(n => n.r === 9).map(n => n.id).join(',') || 'geen'; };
  let r2a, r2b, r2c, getekend;
  try {
    if (sheet) { sheet.style.display = 'block'; sheet.style.transform = 'translateY(0)'; }
    osmCache = [knoop(A, 15), knoop(B, 30)]; huidigePos = { ...P }; radarZoomAfstand = 50;
    dichtstbijOSM = { ...knoop(B, 30), afstand: 30 }; huidigBevestigdOsmNodeId = A;   // na een wissel van A naar B
    r2a = actief(); getekend = radarSheetNodes.length;
    dichtstbijOSM = null; huidigBevestigdOsmNodeId = A;                                 // geen licht binnen 400 m
    r2b = actief();
    dichtstbijOSM = { ...knoop(A, 15), afstand: 15 }; huidigBevestigdOsmNodeId = A;   // geen wissel
    r2c = actief();
  } finally {
    dichtstbijOSM = st.d; huidigBevestigdOsmNodeId = st.h; osmCache = st.cache; huidigePos = st.pos; radarZoomAfstand = st.zoom; radarSheetNodes = st.nodes;
    if (sheet) { sheet.style.display = sheetStijl.display; sheet.style.transform = sheetStijl.transform; }
  }
  eis('GL2a na een wissel van A naar B pulseert op de radar B, het getoonde licht (en beide lichten staan erop)', r2a === B && getekend === 2, 'B, 2 lichten', r2a + ', ' + getekend + ' lichten');
  eis('GL2b zonder getoond licht pulseert er niets, ook al is A het licht van de laatste fase', r2b === 'geen', 'geen', r2b);
  eis('GL2c zonder wissel pulseert A, zoals voorheen', r2c === A, 'A', r2c);

  // ═══ GL3 — de debugregel ═══════════════════════════════════
  const dSt = { d: dichtstbijOSM, h: huidigBevestigdOsmNodeId, tekst: dOSM.textContent };
  let r3a, r3b, r3c;
  try {
    opslagSchrijf('sl_tag_' + A, { type: 'oudlicht', tijdstip: 1, versie: 1 });
    opslagSchrijf('sl_tag_' + B, { type: 'nieuwlicht', tijdstip: 1, versie: 1 });
    dichtstbijOSM = { ...knoop(B, 30), afstand: 30 }; huidigBevestigdOsmNodeId = A;
    updateDebugOverlay(); r3a = dOSM.textContent;
    dichtstbijOSM = null; updateDebugOverlay(); r3b = dOSM.textContent;
    dichtstbijOSM = { ...knoop(A, 15), afstand: 15 }; updateDebugOverlay(); r3c = dOSM.textContent;
  } finally {
    dichtstbijOSM = dSt.d; huidigBevestigdOsmNodeId = dSt.h; dOSM.textContent = dSt.tekst;
    herstel();
  }
  eis('GL3a na een wissel van A naar B toont de debugregel de tag van B', /tag:nieuwlicht/.test(r3a) && !/oudlicht/.test(r3a), 'tag:nieuwlicht', r3a);
  eis('GL3b zonder getoond licht staat er geen tag', !/tag:/.test(r3b), 'geen tag', r3b);
  eis('GL3c zonder wissel de tag van A, zoals voorheen', /tag:oudlicht/.test(r3c), 'tag:oudlicht', r3c);

  // ═══ GL4 — regressie ═══════════════════════════════════════
  const terug = {
    exporteerMeetdata: (s) => s.split('\n').filter(l => !/V11\.37\.15(?!\d)|V11\.37\.17(?!\d)/.test(l)).join('\n').replace("  const naExport = () => {};   // V11.37.7: het schaduwlog niet meer wissen; het is een ring (MAX_SCHADUWLOG)",   // V11.37.15: eerst de koersbak eruit (test_koerslog)
                                        "  const naExport = () => { try { localStorage.removeItem('sl_schaduwlog'); } catch(_) {} };"),
    tekenRadarSheet: (s) => s.replace("  const activeNodeId = dichtstbijOSM ? String(dichtstbijOSM.id) : null;   // V11.37.7: het getoonde licht, zie boven updateDebugOverlay",
                                      "  const activeNodeId = (typeof huidigBevestigdOsmNodeId !== 'undefined' && huidigBevestigdOsmNodeId)\n    ? String(huidigBevestigdOsmNodeId)\n    : (dichtstbijOSM ? String(dichtstbijOSM.id) : null);"),
    updateDebugOverlay: (s) => s.replace("  const tag = dichtstbijOSM ? laadStoplichtTag(String(dichtstbijOSM.id)) : null;   // V11.37.7: het getoonde licht, zie hierboven",
                                         "  const tag = huidigBevestigdOsmNodeId ? laadStoplichtTag(huidigBevestigdOsmNodeId) : null;")
  };
  const V11376 = { exporteerMeetdata: ['71d08542', 9147], tekenRadarSheet: ['aec656b5', 5759], updateDebugOverlay: ['c6db2f01', 1018] };
  const veranderd = Object.entries(V11376).filter(([n, [h, l]]) => { const s = String(window[n]); return s.split('\n').filter(r => /V11\.37\.7(?!\d)/.test(r)).length !== 1; }).map(x => x[0]);
  eis('GL4a in elk van de drie functies staat precies één regel met merkteken V11.37.7', veranderd.length === 0, 'drie keer één', veranderd.join(', ') || 'drie keer één');
  const anders3 = Object.entries(V11376).filter(([n, [h, l]]) => { const s = terug[n](zonderV113721(window[n])); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('GL4b met die ene regel terug zijn exporteerMeetdata, tekenRadarSheet en updateDebugOverlay byte-gelijk aan V11.37.6', anders3.length === 0, 'geen afwijking', anders3.join(', ') || 'geen');
  const nogOud = ['tekenRadarSheet', 'updateDebugOverlay'].filter(n => /huidigBevestigdOsmNodeId/.test(String(window[n])));
  eis('GL4c de radar en de debugregel lezen huidigBevestigdOsmNodeId niet meer', nogOud.length === 0, 'geen', nogOud.join(', ') || 'geen');
  const KEUZE = { vindDichtbij: ['55d1f775', 3320], updateDichtbij: ['42aee748', 12051], onGPS: ['d99821b8', 15000], regelKies: ['d8d1f767', 1993],
    achterTik: ['e9e105a3', 1583], checkHandLockVerval: ['2df4f7ed', 5513], checkHandLockPassage: ['7f001264', 1768], checkNodeCorrectieStilstand: ['8c801fd8', 4751],
    corrigeerNodeAutomatisch: ['afe7b427', 4118], checkTikSlotSnel: ['d3a8edbe', 2071], vindDichtbijScore: ['bc9b7937', 2105],
    isGetoondLicht: ['36a3cc63', 126], tikRichting: ['b44110d5', 4619], heropenRichtingKeuze: ['d2442860', 386] };
  const zonderV113718 = (s) => String(s).replace('const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud', 'const d = await r.json();').split('\n').filter(l => !/V11\.37\.18(?!\d)/.test(l)).join('\n');   // V11.37.18: de bewaarde kaart, C5 en C7 (test_kaartbewaar); hier terug
  const zonderV113717 = (s) => zonderV113718(s).split('\n').filter(l => !/V11\.37\.17(?!\d)/.test(l)).join('\n');   // V11.37.17: de startlog (test_startlog); hier terug
  const zonderV113715 = (s) => zonderV113717(s).split('\n').filter(l => !/V11\.37\.15(?!\d)/.test(l)).join('\n');   // V11.37.15: de koersmeting (test_koerslog); hier terug
  const zonderV113713 = (s) => zonderV113715(s).split('\n').filter(l => !/V11\.37\.13(?!\d)/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12(?!\d)/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11(?!\d)/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const terugV11378 = (s) => zonderV113711(s).replace("      if (wisselStaat.min === null || af < wisselStaat.min) { wisselStaat.min = af; wisselStaat.minT = Date.now(); }   // V11.37.8: en wanneer (tMin)", "      if (wisselStaat.min === null || af < wisselStaat.min) wisselStaat.min = af;").replace("  if (!dichtstbijOSM) { logOpslagMis('bevestig_geen_licht', { element: categorie }); return; }   // V11.37.8: niet meer stil", "  if (!dichtstbijOSM) return;").split('\n').filter(l => !/V11\.37\.8(?!\d)/.test(l)).join('\n');   // V11.37.8: het fietsfilter en de bevroren knoppen (test_fietslicht); hier terug
  const anders = Object.entries(KEUZE).filter(([n, [h, l]]) => { const s = terugV11378(zonderV113721(window[n])); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('GL4d de lichtkeuze en de knoppen zijn byte-gelijk aan V11.37.6 (veertien functies, onGPS en NB14 inbegrepen)', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testGetoondLicht = testGetoondLicht;
