// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_startlog.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.17: de startlog (sl_startlog), alleen meten. Per app-start
//  de tijd tot camera, video, GPS-watch, model, eerste GPS-tik, eerste kaart en
//  eerste licht, de mislukte kaartvragen met status, de GPS-fouten met code en
//  het uit beeld gaan; en een regel bij elk gat van meer dan 30 s zonder run
//  terwijl de pagina in beeld is.
//
//  SL1  een start met de echte startApp: c, p, w op volgorde; p wacht op video.play
//  SL2  GPS: de eerste tik (g, ga), daarna niet meer; de foutroute telt (gf, gc)
//       en zet de pil nog steeds oranje
//  SL3  de kaart: 504 en een afgebroken vraag geteld met status; de eerste kaart
//       (k1, kn) en het eerste licht (l), dat daarna niet meer verschuift
//  SL4  een gat: na 30 s zonder run een gatregel met de stand van model, worker,
//       camera, kaart en GPS; dicht bij de volgende run, met de duur
//  SL5  uit beeld: geen gat, wel geteld (vc, hm); een open gat sluit bij het weggaan
//  SL6  met en zonder de meting doet de start precies hetzelfde (pil, kaart, licht,
//       rem, kaartvragen, watch, opslaglog)
//  SL7  een ring van 40, klein en Latin-1; een vol quotum staakt alleen dit log
//  SL8  de meetdata-export heeft een eigen bak 'start'
//  SL9  de meting beslist niets: geen toewijzing aan de app-toestand, alleen
//       lees- en schrijffuncties van het log
//  SL10 regressie: de zeven geraakte functies zonder de V11.37.17-regels zijn
//       byte-gelijk aan V11.37.15; in de bron staat V11.37.17 buiten het
//       commentaar alleen in die regels
//
//  Alle plekken en nummers zijn bedacht: een basispunt (52.0000, 5.0000),
//  lichten met nummers 96100xx.
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_startlog.js';
//      document.head.appendChild(s);
//      s.onload = () => testStartlog().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════
// V11.37.21: de regels met dit merkteken weg, zodat de vergelijkingen hieronder de functies van vóór V11.37.21 blijven toetsen (zie test_meetwerk21)
// V11.37.27: in laadONNXModel is de haak van de modelvergelijking ingekort tot de stand nano (de standen v8n, dfine,
// ort130 en webgpu zijn weg). Hier gaat precies de oude tekst terug, zodat de vergelijking hieronder de oude functie blijft toetsen.
var HAAK_NIEUW_V113727 = "              if (MODELVGL_MODEL === 'nano') {   // V11.37.27: alleen nog de stand nano (v8n, dfine, ort130 en webgpu zijn weg)\n                try { nanoNaHoofd(msg.frameId, inferentieTijd, detecties); } catch (_) {}   // V11.37.26: eigen try (de buitenste blijft), zie het blok NANO-SCHADUW\n              }   // V11.37.27";
var HAAK_OUD_V113727 = "              // V11.18.14: in de D-FINE-modus komt er nooit een B-resultaat om\n              // aan te koppelen. vglOpenA zou dan elke frame een regel erbij\n              // krijgen en nooit een terug - een lek dat een uur rijden niet\n              // overleeft. Daarom in die modus alleen de tijd, geen paring.\n              if (MODELVGL_MODEL === 'dfine') {\n                vglNoteerHoofdInDfine(inferentieTijd);\n              } else if (MODELVGL_MODEL === 'nano') {   // V11.37.26\n                try { nanoNaHoofd(msg.frameId, inferentieTijd, detecties); } catch (_) {}   // V11.37.26: eigen try (de buitenste blijft), zie het blok NANO-SCHADUW\n              } else {\n                const _b = vglBeste(detecties);\n                vglOpenA.set(msg.frameId, { ms: inferentieTijd, kl: _b.kl, cf: _b.cf, n: _b.n });\n                vglKoppel(msg.frameId);\n              }";
function terugV113727(s) { return String(s).split(HAAK_NIEUW_V113727).join(HAAK_OUD_V113727).split('\n').filter(l => !/\/\/ V11\.37\.27(?!\d): alleen meten/.test(l)).join('\n'); }   // V11.37.27: en de regels die alleen meten (startlog wk/d1, test_startlog SL15) weg
function zonderV113721(s) { return String(terugV113727(s)).split('\n').map(terugV113731).map(terugV113726).filter(l => !/V11\.37\.21(?!\d)|V11\.37\.22(?!\d)|V11\.37\.23(?!\d)|V11\.37\.25(?!\d)|V11\.37\.26(?!\d)|V11\.37\.30(?!\d)|V11\.37\.31(?!\d)|V11\.37\.34(?!\d)|V11\.37\.35(?!\d)|V11\.37\.36(?!\d)|V11\.37\.37(?!\d)/.test(l)).join('\n'); }   // V11.37.22: ook de meetregels van V11.37.22 (test_meetwerk22); V11.37.23: idem (test_meetwerk23); V11.37.25: idem (test_plaatsen)   // V11.37.26: idem (test_schaduw_nano), met terugV113726   // V11.37.27: eerst terugV113727
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

const STARTLOG_WATCH_NU = "    navigator.geolocation.watchPosition(onGPS, (e)=>{ pGPS.className='pill-dot o'; startLogGpsFout(e); }, { enableHighAccuracy:true, maximumAge:5000, timeout:12000 });   // V11.37.17: de fout ook tellen";
const STARTLOG_WATCH_OUD = "    navigator.geolocation.watchPosition(onGPS, ()=>{ pGPS.className='pill-dot o'; }, { enableHighAccuracy:true, maximumAge:5000, timeout:12000 });";

// ── Draait IN een iframe: een start met de echte startApp ─────
// opt: { zonderMeting, playMs }
// V11.37.27: SL15, in een iframe. De echte onmessage van de hoofdworker en de echte voerAIUit
// (met de worker even weg: de synchrone terugval), met en zonder de meting wk/d1.
async function startlogModelBinnen(opt) {   // V11.37.27
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 200 && !(modelGeladen && yoloWorker && workerKlaar); i++) await slaap(100);
  if (!(modelGeladen && yoloWorker && workerKlaar)) return { fout: 'model of worker niet klaar' };
  const uit = { fout: null };
  const anker = (kl, sc, cx, cy, w, h) => { const d = new Float32Array(8 * 8400); const i = 4000; d[i] = cx; d[8400 + i] = cy; d[2 * 8400 + i] = w; d[3 * 8400 + i] = h; d[(4 + kl) * 8400 + i] = sc; return d; };
  try {
    localStorage.setItem('sl_startlog', '[]');
    if (opt.gooit) { window.startLogDetectie = () => { throw new Error('nep'); }; window.startLogWorkerKlaar = () => { throw new Error('nep'); }; }
    if (opt.zonderStart) startMeet = null; else startLogNieuw();
    if (opt.klaarNaStart) yoloWorker.onmessage({ data: { type: 'klaar' } });
    const viaWorker = () => { aiBezig = true; yoloWorker._startTijd = Date.now(); yoloWorker.onmessage({ data: { type: 'resultaat', data: anker(0, 0.85, 320, 200, 20, 48), dims: [1, 8, 8400], frameId: 1 } }); return JSON.stringify(laatsteDetecties); };
    const viaHoofd = async () => {
      const bw = yoloWorker, bk = workerKlaar, bs = onnxSession, bkans = window.runIsKansloos, bpre = window.preprocessVoorYOLO;
      Object.defineProperty(video, 'readyState', { configurable: true, get: () => 4 });
      window.runIsKansloos = () => false; window.preprocessVoorYOLO = () => ({});
      yoloWorker = null; workerKlaar = false; aiBezig = false;
      onnxSession = { run: async () => ({ output0: { data: anker(1, 0.8, 300, 210, 22, 50), dims: [1, 8, 8400] } }) };
      try { await voerAIUit(); return JSON.stringify(laatsteDetecties); }
      finally { yoloWorker = bw; workerKlaar = bk; onnxSession = bs; window.runIsKansloos = bkans; window.preprocessVoorYOLO = bpre; delete video.readyState; }
    };
    if (opt.hoofdEerst) { uit.h = await viaHoofd(); uit.w = viaWorker(); } else { uit.w = viaWorker(); uit.h = await viaHoofd(); }
    uit.start = startMeet ? { wk: startMeet.wk, wl: startMeet.wl, d1: startMeet.d1, dr: startMeet.dr, m: startMeet.m } : null;
    const r = JSON.parse(localStorage.getItem('sl_startlog') || '[]'); uit.regel = r[r.length - 1] || null;
  } catch (e) { uit.fout = String((e && e.stack) || e).slice(0, 300); }
  return uit;
}

async function startRitBinnen(opt) {
  if (opt.model) return await startlogModelBinnen(opt);   // V11.37.27: SL15
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const uit = { watch: 0, vragen: 0, fout: null };
  if (opt.zonderMeting) {
    for (const n of ['startLogNieuw', 'startLogMijl', 'startLogGps', 'startLogGpsFout', 'startLogKaartFout', 'startLogKijk']) window[n] = () => {};
  }
  try {
    for (const k of ['sl_startlog', 'sl_opslaglog']) localStorage.setItem(k, '[]');
    const nep = document.createElement('canvas'); nep.width = 32; nep.height = 32; nep.getContext('2d').fillRect(0, 0, 32, 32);
    const stroom = nep.captureStream(5);
    navigator.mediaDevices.getUserMedia = async () => stroom;
    video.play = () => new Promise(r => setTimeout(r, opt.playMs));
    let ok = null, fout = null;
    navigator.geolocation.watchPosition = (a, b) => { uit.watch++; ok = a; fout = b; return 1; };
    let modus = '504';
    window.fetch = async (url, o) => {
      if (String(url) !== OVERPASS_URL) throw new TypeError('geen netwerk in de proef');
      uit.vragen++;
      if (modus === '504') return new Response('druk', { status: 504 });
      if (modus === 'af') throw new DOMException('afgebroken', 'AbortError');
      return new Response(JSON.stringify({ elements: [
        { type: 'node', id: 9610001, lat: 52.0005, lon: 5.0000, tags: { highway: 'traffic_signals' } },
        { type: 'node', id: 9610002, lat: 52.0300, lon: 5.0000, tags: { highway: 'traffic_signals' } }] }), { status: 200 });
    };
    window.refreshStadIndienNodig = async () => {};
    window.toonToast = () => {};
    // de start
    await startApp();
    clearInterval(cameraWatchdogInterval); lusGeneratie++;            // de lus en de waakhond weer stil
    if (startTimer) clearInterval(startTimer);                        // de kijker van de startlog: hier met de hand
    // GPS: een fout, dan de eerste tik (die vraagt de kaart: 504)
    fout({ code: 3, message: 'Timeout expired' });
    uit.pilNaFout = pGPS.className;
    const pos = (lat, lon) => ({ coords: { latitude: lat, longitude: lon, accuracy: 14.4, heading: 0, speed: 5 }, timestamp: Date.now() });
    await ok(pos(52.0000, 5.0000)); await slaap(50);
    // nog een vraag die afbreekt (de rem eerst eraf, zoals na de wachttijd)
    modus = 'af'; kaartRem.nietVoor = 0; cacheBezig = false; await downloadOSM(52.0000, 5.0000);
    // dan een gelukte kaart met een licht vlak voor je
    modus = 'ok'; kaartRem.nietVoor = 0; cacheBezig = false; await downloadOSM(52.0000, 5.0000); await slaap(50);
    uit.lNaKaart = startMeet ? startMeet.l : null;                    // het eerste licht, vóór de volgende tik
    await ok(pos(52.0001, 5.0000)); await slaap(50);
    // een gat: 31 s geen run, dan weer een run
    startLaatsteRun = Date.now() - 31000; startLogKijk();
    uit.gatOpen = (JSON.parse(localStorage.getItem('sl_startlog')) || []).filter(r => r.k === 'g').map(r => ({ ...r }));
    minStatZeker(); startLogKijk();
    // uit beeld: een open gat sluit, geen nieuw gat zolang de pagina weg is
    await slaap(5);   // anders kan dit tweede gat dezelfde t krijgen als het eerste (zelfde ms), en dan is het voor startLogSchrijf dezelfde regel; in de app kan dat niet: een volgend gat begint na de run die het vorige sloot
    startLaatsteRun = Date.now() - 31000; startLogKijk();
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    startLaatsteRun = Date.now() - 60000; startLogKijk();
    await slaap(30);
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    startLogKijk();
    uit.ring = JSON.parse(localStorage.getItem('sl_startlog')) || [];
    uit.toestand = { pil: pGPS.className, osm: pOSM.className + '|' + pOSMT.textContent, n: osmCache.length, geladen: cacheGeladen, licht: dichtstbijOSM ? dichtstbijOSM.id : null,
                     rem: kaartRem.n, opslag: (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).map(r => r.type + ':' + JSON.stringify(r.data || r.d || null)).join(';') };
  } catch (e) { uit.fout = String((e && e.stack) || e).slice(0, 300); }
  return uit;
}

// V11.37.18: een gelukte kaart wordt bewaard (StoplichtIQ_Kaart, zie test_kaartbewaar), en de
// volgende rit zou hem bij de eerste GPS-tik neerzetten. Daarom begint elke rit zonder, en zet
// de toets het oude record na afloop terug.
function startlogKaartDb(werk) {
  return new Promise((ok) => {
    let v;
    try { v = indexedDB.open('StoplichtIQ_Kaart', 1); } catch (e) { ok(undefined); return; }
    v.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains('kaart')) db.createObjectStore('kaart'); };
    v.onerror = () => ok(undefined);
    v.onsuccess = (e) => {
      const db = e.target.result;
      try {
        const tx = db.transaction('kaart', 'readwrite'), st = tx.objectStore('kaart');
        let uit;
        const vraag = werk(st);
        if (vraag) vraag.onsuccess = () => { uit = vraag.result; };
        tx.oncomplete = () => { db.close(); ok(uit); };
        tx.onerror = tx.onabort = () => { db.close(); ok(undefined); };
      } catch (e) { db.close(); ok(undefined); }
    };
  });
}
const startlogZonderKaart = () => startlogKaartDb((st) => { st.delete('laatste'); return null; });

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

async function testStartlog() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen: String(gekregen) });
    return gelukt;
  };
  const NL = '\n';
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const bewaardLs = localStorage.getItem(STARTLOG_SLEUTEL);
  const herstel = () => { if (bewaardLs === null) localStorage.removeItem(STARTLOG_SLEUTEL); else localStorage.setItem(STARTLOG_SLEUTEL, bewaardLs); meetRingGestopt.delete(STARTLOG_SLEUTEL); };
  const kaartVoor = await startlogKaartDb((st) => st.get('laatste'));   // V11.37.18: na afloop terug, zie startlogKaartDb

  // ═══ SL1-SL6 — met de echte startApp, in een iframe ════════════
  const bron = new URL('test_startlog.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?start=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.startApp !== 'function'; poging++) {
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
      await startlogZonderKaart();   // V11.37.18: zonder bewaarde kaart, zie test_kaartbewaar
      return await w.startRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), ring: [], toestand: {} };
    } finally {
      f.remove();
      herstel();
    }
  };
  try {
    const met = await rit({ playMs: 400 });
    const zonder = await rit({ playMs: 400, zonderMeting: true });
    eis('SL0 de proef liep zonder fout (met en zonder meting)', !met.fout && !zonder.fout, 'geen fout', (met.fout || '') + ' | ' + (zonder.fout || ''));
    const s = (met.ring || []).find(r => r.k === 's') || {};
    eis('SL1a één startregel met de appversie', (met.ring || []).filter(r => r.k === 's').length === 1 && s.v === appVersieKort(), '1 regel, ' + appVersieKort(), JSON.stringify(s).slice(0, 200));
    eis('SL1b camera, video en watch op volgorde; de watch wacht op video.play (400 ms)', s.c >= 0 && s.p >= 350 && s.p >= s.c && s.w >= s.p,
        'c <= p, p >= 350, w >= p', 'c ' + s.c + ', p ' + s.p + ', w ' + s.w);
    eis('SL1c het model: m = 0 als het al klaar was, anders de tijd tot klaar met de laadduur (ml), of nog leeg', ('m' in s) ? (s.m === 0 || (s.m > 0 && s.ml > 0)) : true,
        'm 0, of m > 0 met ml, of afwezig', 'm ' + s.m + ', ml ' + s.ml);
    eis('SL2a de eerste GPS-tik: g en de nauwkeurigheid (14,4 -> 14)', s.g >= s.w && s.ga === 14, 'g >= w, ga 14', 'g ' + s.g + ', ga ' + s.ga);
    eis('SL2b de foutroute telt (gf 1, gc 3) en zet de pil nog steeds oranje', s.gf === 1 && s.gc === 3 && / o\b/.test(met.pilNaFout || ''),
        'gf 1, gc 3, pill-dot o', 'gf ' + s.gf + ', gc ' + s.gc + ', ' + met.pilNaFout);
    eis('SL3a mislukte kaartvragen met status: 504, dan afgebroken', s.of === 2 && JSON.stringify(s.os) === '[504,"tijd"]', 'of 2, os [504,"tijd"]', 'of ' + s.of + ', os ' + JSON.stringify(s.os));
    eis('SL3b de eerste kaart (k1) met het aantal lichten, en het eerste licht in bereik (l)', s.k1 >= s.g && s.kn === 2 && s.l >= s.k1,
        'k1 >= g, kn 2, l >= k1', 'k1 ' + s.k1 + ', kn ' + s.kn + ', l ' + s.l);
    eis('SL3c een mijlpaal blijft het eerste moment: een latere GPS-tik met een licht in bereik verandert l niet', met.lNaKaart != null && s.l === met.lNaKaart,
        'l gelijk aan l na de kaart', 'l ' + s.l + ', na de kaart ' + met.lNaKaart);
    const g0 = (met.gatOpen || [])[0] || {};
    eis('SL4a na 31 s zonder run een gatregel met de stand', (met.gatOpen || []).length === 1 && g0.d >= 31000 && g0.r !== undefined && 'tr' in g0 && 'rf' in g0 && 'gt' in g0,
        '1 gat, d >= 31000, met r, tr, rf, gt', JSON.stringify(g0).slice(0, 220));
    const gaten = (met.ring || []).filter(r => r.k === 'g');
    eis('SL4b het gat sluit bij de volgende run, met de duur (31 s)', gaten.length >= 1 && gaten[0].d >= 31000 && gaten[0].d < 33000 && !gaten[0].vb,
        'd ~31000, geen vb', JSON.stringify(gaten[0] || {}).slice(0, 120));
    eis('SL5a uit beeld: het open gat sluit (vb 1), en zolang de pagina weg is komt er geen nieuw gat', gaten.length === 2 && gaten[1].vb === 1,
        '2 gaten, het tweede vb 1', gaten.length + ' gaten, ' + JSON.stringify(gaten[1] || {}).slice(0, 80));
    eis('SL5b uit en in beeld geteld (vc 2) met de tijd uit beeld (hm > 0); terug in beeld geen gat', s.vc === 2 && s.hm > 0 && gaten.length === 2,
        'vc 2, hm > 0', 'vc ' + s.vc + ', hm ' + s.hm);
    const zt = zonder.toestand || {}, mt = met.toestand || {};
    const velden = ['pil', 'osm', 'n', 'geladen', 'licht', 'rem', 'opslag'];
    const afw = velden.filter(k => JSON.stringify(zt[k]) !== JSON.stringify(mt[k]));
    eis('SL6a met en zonder de meting dezelfde start: pil, kaart, licht, rem en opslaglog', afw.length === 0 && mt.n === 2 && mt.licht === 9610001,
        'gelijk, 2 lichten, licht 9610001', afw.length ? afw.map(k => k + ': ' + JSON.stringify(mt[k]).slice(0, 40) + ' / ' + JSON.stringify(zt[k]).slice(0, 40)).join('; ') : 'gelijk, licht ' + mt.licht);
    eis('SL6b met en zonder: evenveel kaartvragen en één watch', met.vragen === zonder.vragen && met.watch === 1 && zonder.watch === 1,
        'gelijk, 1 watch', met.vragen + '/' + zonder.vragen + ' vragen, ' + met.watch + '/' + zonder.watch + ' watch');
    eis('SL6c zonder meting komt er niets in sl_startlog', (zonder.ring || []).length === 0, '0 regels', (zonder.ring || []).length);

    // ═══ SL7 — de ring ═════════════════════════════════════════
    localStorage.setItem(STARTLOG_SLEUTEL, '[]'); meetRingGestopt.delete(STARTLOG_SLEUTEL);
    const volle = (i) => ({ k: 's', t: 1790000000000 + i * 600000, v: 'V11.37.17', c: 812, p: 930, w: 951, m: 0, ml: 2104, g: 4210 + i, ga: 12,
      k1: 16020, kn: 212, l: 30400, of: 2, os: [504, 504], gf: 1, gc: 3, vc: 2, hm: 3012 });
    for (let i = 0; i < 45; i++) startLogSchrijf(volle(i));
    startLogSchrijf({ ...volle(44), g: 9999 });
    const ringS = JSON.parse(localStorage.getItem(STARTLOG_SLEUTEL)) || [], ruwS = localStorage.getItem(STARTLOG_SLEUTEL) || '';
    eis('SL7a een ring van hoogstens 40 regels; een regel met dezelfde soort en t wordt bijgewerkt, niet verdubbeld',
        ringS.length === 40 && ringS[39].g === 9999 && ringS[39].m === 0 && ringS.filter(r => r.t === volle(44).t).length === 1, '40, laatste bijgewerkt, m 0 bewaard', ringS.length + ', g ' + (ringS[39] || {}).g + ', m ' + (ringS[39] || {}).m);
    for (let i = 0; i < 20; i++) startLogSchrijf({ k: 'g', t: 1790000000000 + i * 600000 + 5000, d: 45012, mg: true, wo: true, wk: true, ai: true, am: 44980, r: 4, pa: false,
      tr: 'live', mu: false, rf: 18, kl: false, kb: null, gt: 1020 });
    const ruwM = localStorage.getItem(STARTLOG_SLEUTEL) || '';
    eis('SL7b klein en Latin-1: een volle ring met alleen volle startregels < 8 K tekens, met de helft gatregels < 6,5 K (gemeten)',
        ruwS.length < 8000 && ruwM.length < 6500 && !/[^\x00-ÿ]/.test(ruwS + ruwM), '< 8 K en < 6,5 K, Latin-1',
        (ruwS.length / 40).toFixed(1) + ' tekens per startregel: ' + (ruwS.length / 1024).toFixed(1) + ' K; gemengd ' + (ruwM.length / 1024).toFixed(1) + ' K');
    const bewSchrijf = opslagSchrijf;
    opslagSchrijf = (k, v) => (k === STARTLOG_SLEUTEL ? false : bewSchrijf(k, v));
    startLogSchrijf({ k: 's', t: 1, v: 'x' });
    opslagSchrijf = bewSchrijf;
    eis('SL7c een vol quotum staakt alleen dit log (meetRingGestopt), en wist zijn eigen sleutel',
        meetRingGestopt.has(STARTLOG_SLEUTEL) && localStorage.getItem(STARTLOG_SLEUTEL) === null && !meetRingGestopt.has(MINUUTLOG_SLEUTEL), 'gestopt, sleutel weg',
        meetRingGestopt.has(STARTLOG_SLEUTEL) + ' / ' + localStorage.getItem(STARTLOG_SLEUTEL));
    meetRingGestopt.delete(STARTLOG_SLEUTEL);

    // ═══ SL8 — de export ═══════════════════════════════════════
    localStorage.setItem(STARTLOG_SLEUTEL, JSON.stringify([{ k: 's', t: 1, proef: 'start' }]));
    const blobs = [];
    const bew = { url: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click, alert: window.alert, cs: Object.getOwnPropertyDescriptor(navigator, 'canShare') };
    try {
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:proef'; };
      HTMLAnchorElement.prototype.click = function () {};
      window.alert = () => {};
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
      exporteerMeetdata();
      for (let i = 0; i < 40 && blobs.length < 1; i++) await slaap(50);
    } finally {
      URL.createObjectURL = bew.url; HTMLAnchorElement.prototype.click = bew.klik; window.alert = bew.alert;
      if (bew.cs) Object.defineProperty(navigator, 'canShare', bew.cs); else delete navigator.canShare;
    }
    let meet = null;
    for (const b of blobs) { const j = JSON.parse(await b.text()); if (!Array.isArray(j.sleutels)) meet = j; }
    const r8 = meet && meet.start && meet.start[STARTLOG_SLEUTEL];
    eis('SL8 de meetdata-export heeft een bak start met sl_startlog erin', Array.isArray(r8) && r8[0] && r8[0].proef === 'start',
        'start / sl_startlog', meet ? Object.keys(meet.start || {}).join(',') || 'leeg' : 'geen export');

    // ═══ SL9 — de meting beslist niets ═════════════════════════
    const nieuw = [startLogSchrijf, startLogNieuw, startLogMijl, startLogGps, startLogGpsFout, startLogKaartFout, startLogKijk];
    const code = nieuw.map(zc).join(NL);
    const toegewezen = (code.match(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*(\+\+|--|[-+*/]?=)(?!=)/g) || []).map(x => x.replace(/\s*(\+\+|--|[-+*/]?=)$/, ''));
    const eigen = ['startMeet', 'startGat', 'startGatU', 'startLaatsteRun', 'startLaatsteGps', 'startVerborgenT', 'startTimer', 'schoon', 'arr', 'i', 'nu', 'v', 'k', 'acc', 's', 'tr', 'kl'];
    const vreemd1 = [...new Set(toegewezen)].filter(x => !eigen.includes(x));
    eis('SL9a de meting wijst alleen haar eigen variabelen toe (geen app-toestand)', vreemd1.length === 0, 'alleen eigen', vreemd1.join(', ') || 'alleen eigen');
    const roept = (code.match(/\b[a-zA-Z_$][\w$]*\s*\(/g) || []).map(x => x.replace(/\s*\($/, '')).filter(x => !['if', 'for', 'function', 'catch', 'return', 'while'].includes(x));
    const mag = ['startLogSchrijf', 'startLogNieuw', 'startLogMijl', 'startLogGps', 'startLogGpsFout', 'startLogKaartFout', 'startLogKijk', 'has', 'keys', 'isArray', 'slice', 'opslagLees', 'opslagSchrijf', 'Error', 'add', 'removeItem', 'now', 'appVersieKort',
                 'setInterval', 'assign', 'isFinite', 'round', 'push', 'runIsKansloos'];
    const vreemd2 = [...new Set(roept)].filter(x => !mag.includes(x));
    eis('SL9b de meting roept alleen het log, de opslag en runIsKansloos (alleen lezen) aan', vreemd2.length === 0, 'alleen die', vreemd2.join(', ') || 'alleen die');
    eis('SL9c runIsKansloos wijst niets toe', !/(?<![=!<>])=(?!=)|\+\+|--/.test(zc(runIsKansloos).replace(/const afst = /, '')), 'alleen lezen', 'ok');
  } finally {
    herstel();
  }

  // ═══ SL15 — V11.37.27: wk en d1, alleen meten ══════════════════
  {
    const A = await rit({ model: 1 });
    const B = await rit({ model: 1, hoofdEerst: 1 });
    const C = await rit({ model: 1, zonderStart: 1 });
    const D = await rit({ model: 1, gooit: 1 });
    const E = await rit({ model: 1, klaarNaStart: 1 });
    eis('SL15a de vijf proeven liepen, en elke route gaf een detectie', [A, B, C, D, E].every(x => !x.fout && x.w && x.w !== '[]' && x.h && x.h !== '[]'),
        'geen fout, detecties', [A, B, C, D, E].map(x => x.fout || 'ok').join(' | '));
    eis('SL15b worker al klaar bij de start: wk = 0 met wl, d1 met route w', A.start && A.start.wk === 0 && A.start.wl > 0 && A.start.d1 >= 0 && A.start.dr === 'w'
        && A.regel && A.regel.wk === 0 && A.regel.dr === 'w', 'wk 0, dr w (ook in sl_startlog)', JSON.stringify(A.start));
    eis('SL15c eerst de hoofdthread: route h; het tweede resultaat overschrijft d1 niet', B.start && B.start.dr === 'h' && B.regel && B.regel.dr === 'h', 'dr h', JSON.stringify(B.start));
    eis('SL15d worker klaar na de start: wk is de tijd sinds de start (niet 0 als vervanger)', E.start && typeof E.start.wk === 'number' && E.start.wl > 0 && E.start.dr === 'w', 'wk >= 0, wl, dr w', JSON.stringify(E.start));
    eis('SL15e KERN: de detecties zijn byte-gelijk met meting, zonder start (startMeet leeg) en met een meting die gooit (beide routes)',
        A.w === C.w && A.w === D.w && A.w === E.w && A.h === C.h && A.h === D.h && A.h === E.h && B.w === A.w && B.h === A.h,
        'gelijk', JSON.stringify({ w: [A.w, C.w, D.w].map(x => (x || '').length), h: [A.h, C.h, D.h].map(x => (x || '').length) }));
    eis('SL15f zonder start en met een meting die gooit: geen startregel met wk/d1', !C.start && D.start && D.start.d1 == null && D.start.wk == null, 'leeg', JSON.stringify([C.start, D.start]));
    const bronWorker = String(laadONNXModel), bronHoofd = String(voerAIUit);
    eis('SL15g in de bron: beide aanroepen na _verwerkWorkerResultaat en minStatRun, elk in een eigen try',
        bronWorker.indexOf("try { startLogDetectie('w'); } catch (_) {}") > bronWorker.indexOf('minStatRun(inferentieTijd, detecties)')
        && bronHoofd.indexOf("try { startLogDetectie('h'); } catch (_) {}") > bronHoofd.indexOf('minStatRun(inferentieTijd, detecties)')
        && bronWorker.indexOf('try { startLogWorkerKlaar(); } catch (_) {}') > bronWorker.indexOf('workerKlaar = true;'), 'ja', 'zie bron');
  }

  // ═══ SL10 — regressie ═══════════════════════════════════════
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.17(?!\d)/.test(l)).length;
  const DL20_NIEUW = "    const d = await kaartHaalKaart(lat, lon, q);   // V11.37.20: eerst het eigen bestand (kaart/), anders de zeven regels die hier stonden (nu in kaartVraagOverpass), zie kaartHaalKaart";   // V11.37.20
  const DL20_OUD = ['    const ctrl = new AbortController();', '    const t = setTimeout(()=>ctrl.abort(), 25000);',   // V11.37.20: de zeven regels die er tot V11.37.19 stonden
    "    const r = await fetch(OVERPASS_URL, { method:'POST', body:`data=${encodeURIComponent(q)}`, signal:ctrl.signal });", '    clearTimeout(t);',   // V11.37.20
    "    if (!r.ok) kaartRem.fout = { status: r.status, ra: (r.headers && typeof r.headers.get === 'function') ? r.headers.get('Retry-After') : null };   // V11.37.12",   // V11.37.20
    '    if (!r.ok) throw new Error(`HTTP ${r.status}`);', '    const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud'].join(NL);   // V11.37.20
  const zonderV113720 = (s) => String(s).replace(DL20_NIEUW, DL20_OUD);   // V11.37.20: het eigen kaartbestand (test_kaartbestand); hier de oude zeven regels terug
  const zonderV113718 = (s) => zonderV113720(s).replace('const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud', 'const d = await r.json();').replace('setTimeout(() => { if (!cacheBezig && huidigePos && kaartNodig(huidigePos.lat, huidigePos.lon)) downloadOSM(huidigePos.lat, huidigePos.lon); }, 30000);   // V11.37.18: alleen zonder lopende vraag en als er nog een kaart nodig is (stond: cacheBezig=false en altijd downloadOSM, ook naast een lopende vraag), zie kaartNodig', 'setTimeout(() => { cacheBezig=false; if(huidigePos)downloadOSM(huidigePos.lat,huidigePos.lon); }, 30000);').split(NL).filter(l => !/V11\.37\.18(?!\d)/.test(l)).join(NL);   // V11.37.18: de bewaarde kaart, C5 en C7 (test_kaartbewaar); hier terug   // V11.37.20: eerst zonderV113720
  const zonderV113717 = (s) => zonderV113718(s).replace(STARTLOG_WATCH_NU, STARTLOG_WATCH_OUD).split(NL).filter(l => !/V11\.37\.17(?!\d)/.test(l)).join(NL);
  const V113715 = { startApp: ['7f067c8a', 4583, 5], onGPS: ['b8aa01fe', 15469, 1], downloadOSM: ['b47c263f', 4666, 3], updateDichtbij: ['67e9f3ec', 12423, 1],   // V11.37.18: downloadOSM met twee commentaarregels zonder plaatsnaam (was e89feb02/4655), zie test_kaartbewaar KB12
                    laadONNXModel: ['68b764e9', 4402, 1], minStatZeker: ['17831b15', 292, 1], exporteerMeetdata: ['c7a3b47a', 9327, 2] };
  const telAf = Object.entries(V113715).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('SL10a zeven functies krijgen regels met merkteken V11.37.17: startApp 5, downloadOSM 3, exporteerMeetdata 2, de andere 1',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  // V11.37.36: laadONNXModel is bewust herschreven (geen reservemodel meer), zie test_nano_wachter.
  const anders = Object.entries(V113715).filter(([n]) => n !== 'laadONNXModel').filter(([n, [h, l]]) => { const s = zonderV113717(zonderV113721(window[n])); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('SL10b zonder die regels (en met de oude foutroute van de watch) byte-gelijk aan V11.37.15', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  let code10 = [];
  try {
    const html = await (await fetch(new URL('index.html', location.href).href + '?t=' + Date.now())).text();
    code10 = html.split(NL).filter(l => /V11\.37\.17(?!\d)/.test(l) && !/^\s*\/\//.test(l)).map(l => l.trim());
  } catch (e) { code10 = ['fout: ' + e]; }
  eis('SL10c in de bron staat V11.37.17 buiten het commentaar alleen in de 14 regels in die zeven functies, en hooguit in de versieregel (die draagt nu een later nummer)',
      code10.filter(l => !/^const APP_VERSIE = /.test(l)).length === 14 && code10.length <= 15, '14 regels (+ de versie)', code10.length + ': ' + code10.map(l => l.slice(0, 30)).join(' | '));   // V11.37.18: de versieregel mag een later nummer dragen
  const sa = zc(startApp);
  const iW = sa.indexOf("startLogMijl('w')"), iWatch = sa.indexOf('navigator.geolocation.watchPosition'), iP = sa.indexOf("startLogMijl('p')"), iPlay = sa.indexOf('await video.play()');
  eis('SL10d in startApp: de start eerst, p direct na video.play, w direct vóór de watch (de volgorde van de app blijft)',
      sa.indexOf('startLogNieuw()') < sa.indexOf('await startOpslagBoot()') && iP > iPlay && iW < iWatch && iW > iP && iWatch - iW < 80, 'op volgorde', 'p ' + iP + ', w ' + iW + ', watch ' + iWatch);
  const dl = zc(downloadOSM);
  eis('SL10e in downloadOSM: de fout geteld vóór kaartRemNa (die kaartRem.fout leegmaakt)', dl.indexOf('startLogKaartFout(') > 0 && dl.indexOf('startLogKaartFout(') < dl.indexOf('kaartRemNa()'),
      'vóór', 'positie ' + dl.indexOf('startLogKaartFout(') + ' / ' + dl.indexOf('kaartRemNa()'));

  await startlogKaartDb((st) => { if (kaartVoor === undefined) st.delete('laatste'); else st.put(kaartVoor, 'laatste'); return null; });   // V11.37.18
  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  await idbWeesWeg23();   // V11.37.23: wezen van de iframe-ritten uit de spiegel, zie idbWeesWeg23
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testStartlog = testStartlog; window.startRitBinnen = startRitBinnen; }
