// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_richtingtik.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.3: een richtingtik gaat altijd naar het licht waar de box nu
//  op staat (het getoonde licht, dichtstbijOSM).
//
//  Het veldgeval RT: de knoppen verschenen voor licht A,
//  en Younes koos daarna uit de lijst licht B; zijn
//  richtingtik ging toch naar A.
//
//  RT1  het veldgeval: de tik gaat naar B; A blijft onaangeroerd; het
//       richtingslot staat op B; de logregel zegt B, met nieuw = A
//  RT2  knoppen en getoond licht gelijk: alles zoals vroeger, geen 'nieuw'
//  RT3  geen licht getoond: de oude bron (de knoppen) geldt nog
//  RT4  alle drie de ingangen (vraag, toevoeg, rij) gaan naar het getoonde licht
//  RT5  de koppeling aan een uitgestelde V5-schrijving werkt voor het getoonde licht
//  RT6  regressie: alleen tikRichting is veranderd; de lichtkeuze (vijftien
//       functies, onGPS inbegrepen) is byte-gelijk aan V11.37.2
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_richtingtik.js';
//      document.head.appendChild(s);
//      s.onload = () => testRichtingtik().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════
// V11.37.21: de regels met dit merkteken weg, zodat de vergelijkingen hieronder de functies van vóór V11.37.21 blijven toetsen (zie test_meetwerk21)
function zonderV113721(s) { return String(s).split('\n').map(terugV113731).map(terugV113726).filter(l => !/V11\.37\.21(?!\d)|V11\.37\.22(?!\d)|V11\.37\.23(?!\d)|V11\.37\.25(?!\d)|V11\.37\.26(?!\d)|V11\.37\.30(?!\d)|V11\.37\.31(?!\d)|V11\.37\.34(?!\d)/.test(l)).join('\n'); }   // V11.37.22: ook de meetregels van V11.37.22 (test_meetwerk22); V11.37.23: idem (test_meetwerk23); V11.37.25: idem (test_plaatsen)   // V11.37.26: idem (test_schaduw_nano), met terugV113726
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

async function testRichtingtik() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));

  const A = { id: 9990003001, lat: 52.0016, lon: 5.0020, naam: 'A' }, B = { id: 9990003002, lat: 52.0019, lon: 5.0027, naam: 'B' };
  const namen = ['dichtstbijOSM', 'osmCache', 'richtingKnoppenNodeId', 'huidigBevestigdOsmNodeId', 'richtingLockNodeId', 'richtingLockKeuze',
    'richtingLockBron', 'richtingGedruktVoorNode', 'richtingTikTijd', 'richtingTikElement', 'v9PreSelectieAfrij', 'v9AanrijHeading',
    'v9AanrijSnelheidHeading', 'v9DelayedWriteActief', 'v9KandidaatNode', 'preZet', 'preWis', 'bevestigActief', 'fase'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
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
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const opzet = (knoppen, getoond) => {
    osmCache = [A, B];
    dichtstbijOSM = getoond ? { ...getoond, afstand: 5 } : null;
    richtingKnoppenNodeId = knoppen ? String(knoppen.id) : null; huidigBevestigdOsmNodeId = null;
    richtingLockNodeId = null; richtingLockKeuze = null; richtingLockBron = null; richtingGedruktVoorNode = null;
    v9PreSelectieAfrij = null; v9AanrijHeading = null; v9AanrijSnelheidHeading = null; v9DelayedWriteActief = false; v9KandidaatNode = null;
    bevestigActief = false; fase = null;
    for (const n of [A, B]) localStorage.removeItem('sl_richting_' + n.id);
    localStorage.setItem('sl_opslaglog', '[]');
  };
  const regel = () => (lees('sl_opslaglog') || []).filter(r => r.reden === 'richting_tik').pop() || {};

  try {
    // ═══ RT1 — het veldgeval ═══════════════════════════════════
    opzet(A, B);
    tikRichting('rechts', 'toevoeg');
    const rA = lees('sl_richting_' + A.id), rB = lees('sl_richting_' + B.id), r1 = regel();
    eis('RT1a de richtingtik gaat naar het getoonde licht B, niet naar A van de knoppen',
        rB && rB.tikrichting === 'rechts' && rA === null, 'B rechts, A leeg', JSON.stringify({ A: rA && rA.tikrichting, B: rB && rB.tikrichting }));
    eis('RT1b het richtingslot staat op B', richtingLockNodeId === String(B.id) && richtingLockKeuze === 'rechts' && richtingLockBron === 'tik',
        'B / rechts / tik', `${richtingLockNodeId} / ${richtingLockKeuze} / ${richtingLockBron}`);
    eis('RT1c de logregel zegt B, met nieuw = A (waar de tik vroeger heen ging)',
        r1.node === String(B.id) && r1.nieuw === String(A.id) && r1.element === 'toevoeg', 'B, nieuw A, toevoeg', JSON.stringify({ node: r1.node, nieuw: r1.nieuw, el: r1.element }));

    // ═══ RT2 — knoppen en getoond licht gelijk ═════════════════
    opzet(B, B); tikRichting('links', 'vraag'); const r2 = regel();
    eis('RT2 knoppen en getoond licht gelijk: tik op B, geen veld nieuw',
        (lees('sl_richting_' + B.id) || {}).tikrichting === 'links' && r2.node === String(B.id) && r2.nieuw === null,
        'B, nieuw leeg', JSON.stringify({ node: r2.node, nieuw: r2.nieuw }));

    // ═══ RT3 — geen licht getoond ══════════════════════════════
    opzet(A, null); tikRichting('rechtdoor', 'vraag'); const r3 = regel();
    eis('RT3 zonder getoond licht geldt de oude bron nog: de tik gaat naar A van de knoppen',
        (lees('sl_richting_' + A.id) || {}).tikrichting === 'rechtdoor' && richtingLockNodeId === String(A.id) && r3.node === String(A.id),
        'A', JSON.stringify({ node: r3.node, lock: richtingLockNodeId }));

    // ═══ RT4 — de drie ingangen ════════════════════════════════
    const r4 = [];
    for (const el of ['vraag', 'toevoeg', 'rij']) { opzet(A, B); tikRichting('links', el); r4.push(regel().node === String(B.id) && lees('sl_richting_' + A.id) === null); }
    eis('RT4 vraag, toevoeg en rij gaan alle drie naar het getoonde licht', r4.every(Boolean), 'ja ja ja', r4.join(' '));

    // ═══ RT5 — de koppeling aan de uitgestelde V5-schrijving ═══
    opzet(A, B); v9DelayedWriteActief = true; v9KandidaatNode = String(B.id); v9AanrijHeading = 0;
    tikRichting('links', 'vraag');
    eis('RT5 een tik tijdens de uitgestelde V5-schrijving van B koppelt aan B (vroeger niet, want hij ging naar A)',
        v9PreSelectieAfrij !== null && preZet && preZet.node === String(B.id), 'pre-selectie op B',
        JSON.stringify({ pre: v9PreSelectieAfrij, node: preZet && preZet.node }));
  } finally {
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    herstel();
  }

  // ═══ RT6 — regressie ════════════════════════════════════════
  // Gemeten op V11.37.2 (f4f6018); deze release raakt ze niet aan.
  const V11372 = { vindDichtbij: ['2db98dab', 2954], vindDichtbijScore: ['bc9b7937', 2105], updateDichtbij: ['e82d3c0', 11914],
    checkHandLockVerval: ['2df4f7ed', 5513], checkNodeCorrectieStilstand: ['8c801fd8', 4751], corrigeerNodeAutomatisch: ['afe7b427', 4118],
    checkNaderingsCorrectie: ['6aeb87b3', 3595], verzamelNaderingsBewijs: ['3d6ad85f', 3526], checkHandLockPassage: ['7f001264', 1768],
    checkTikSlotSnel: ['d3a8edbe', 2071], regelTik: ['9c1b361b', 3087], onGPS: ['e1da9bf9', 14694],   // regelKies: V11.37.4 herschreven, zie test_achter
    vergrendelNodeHandmatig: ['9a007b96', 2295], selecteerNodeHandmatig: ['5275f4dd', 2379] };
  const NL = String.fromCharCode(10);
  // V11.37.4: vier regels van het V9-blok in onGPS kregen een tak voor 'geen licht'; hier terug
  // naar hun oude vorm, daarna gaat de aanroep van achterTik weg met het filter (zie test_achter).
  const terugV11374 = (s) => s
    .replace('if ((dichtstbijOSM || (achterAan() && v9KandidaatNode !== null)) && cacheGeladen) {   // V11.37.4: een lopende meting loopt ook zonder getoond licht door', 'if (dichtstbijOSM && cacheGeladen) {')
    .replace('const afst = dichtstbijOSM ? dichtstbijOSM.afstand : Infinity;   // V11.37.4', 'const afst = dichtstbijOSM.afstand;')
    .replace('const nodeId = dichtstbijOSM ? String(dichtstbijOSM.id) : null;   // V11.37.4', 'const nodeId = String(dichtstbijOSM.id);')
    .replace('kandidaatPos ?? (dichtstbijOSM ? { lat: dichtstbijOSM.lat, lon: dichtstbijOSM.lon } : { lat, lon }),   // V11.37.4', 'kandidaatPos ?? { lat: dichtstbijOSM.lat, lon: dichtstbijOSM.lon },');
  // V11.37.4: zonder de regels met merkteken (de achter-regel, zie test_achter); onGPS met zijn vier V9-regels terug.
  const zonderV113718 = (s) => String(s).replace('const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud', 'const d = await r.json();').split('\n').filter(l => !/V11\.37\.18(?!\d)/.test(l)).join('\n');   // V11.37.18: de bewaarde kaart, C5 en C7 (test_kaartbewaar); hier terug
  const zonderV113717 = (s) => zonderV113718(s).split('\n').filter(l => !/V11\.37\.17(?!\d)/.test(l)).join('\n');   // V11.37.17: de startlog (test_startlog); hier terug
  const zonderV113715 = (s) => zonderV113717(s).split('\n').filter(l => !/V11\.37\.15(?!\d)/.test(l)).join('\n');   // V11.37.15: de koersmeting (test_koerslog); hier terug
  const zonderV113713 = (s) => zonderV113715(s).split('\n').filter(l => !/V11\.37\.13(?!\d)/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12(?!\d)/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11(?!\d)/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const terugV11378 = (s) => zonderV113711(s).replace("      if (wisselStaat.min === null || af < wisselStaat.min) { wisselStaat.min = af; wisselStaat.minT = Date.now(); }   // V11.37.8: en wanneer (tMin)", "      if (wisselStaat.min === null || af < wisselStaat.min) wisselStaat.min = af;").replace("  if (!dichtstbijOSM) { logOpslagMis('bevestig_geen_licht', { element: categorie }); return; }   // V11.37.8: niet meer stil", "  if (!dichtstbijOSM) return;").split('\n').filter(l => !/V11\.37\.8(?!\d)/.test(l)).join('\n');   // V11.37.8: het fietsfilter en de bevroren knoppen (test_fietslicht); hier terug
  const anders = Object.entries(V11372).filter(([n, [h, l]]) => { const s = terugV11374(terugV11378(zonderV113721(window[n]))).split(NL).filter(l => !/V11\.37\.4(?!\d)/.test(l)).join(NL); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('RT6a de lichtkeuze is onaangeroerd door V11.37.3: veertien functies (onGPS en NB14 inbegrepen, zonder de V11.37.4-regels) byte-gelijk aan V11.37.2',
      anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const t = String(tikRichting);
  eis('RT6b in tikRichting zijn alleen het doel en het logveld veranderd: drie regels met merkteken V11.37.3',
      (t.match(/V11\.37\.3(?!\d)/g) || []).length === 3 && t.includes('const nodeId = (dichtstbijOSM ? String(dichtstbijOSM.id) : null) || oudDoel;'),
      '3 regels', String((t.match(/V11\.37\.3(?!\d)/g) || []).length));

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRichtingtik = testRichtingtik;
