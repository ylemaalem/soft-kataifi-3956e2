// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_motorproef.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.25.0: de schaduw kan op een andere motor draaien.
//
//  WAT DIT IS. Het vergelijkings-instrument achter de vijf tikken kreeg twee
//  standen erbij. De schaduwworker draait dan HETZELFDE model als het hoofdpad,
//  maar op een andere bibliotheek of een andere provider:
//
//      ort130   ONNX Runtime 1.30.0, provider wasm
//      webgpu   ONNX Runtime 1.30.0, provider webgpu
//
//  WAT DIT NIET IS. Een overstap. Het hoofdpad blijft onaangeroerd op 1.17.1
//  met wasm; YOLO_WORKER_CODE verandert geen letter. Crasht de schaduw, dan
//  crasht de schaduw — de countdown loopt door. Daarom is dit te meten in het
//  verkeer zonder iets op het spel te zetten.
//
//  WAAROM DE SCHADUW NIET TERUGVALT. Er wordt precies één provider gevraagd.
//  Zou hij bij een fout op wasm terugvallen, dan meet je wasm tegen wasm en
//  concludeer je dat WebGPU "even snel" is. M4 bewaakt dat.
//
//  M1  de vier modi bestaan, en de standaard is en blijft v8n
//  M2  de knop loopt de reeks rond, te beginnen met v8n → dfine
//  M3  de motorworker vraagt precies één provider en de juiste bundel
//  M4  KERN: geen terugval in de workercode — één provider, of niets
//  M5  KERN: het hoofdpad is onaangeroerd (YOLO_WORKER_CODE byte-identiek)
//  M6  wat er misging wordt vastgelegd, inclusief bij hoeveel frames
//  M7  de samenvatting noemt de motor, de provider en de fout
//
//  V11.26.0 — EEN EMMER PER STAND. Tot hier schreven v8n, ort130 en webgpu
//  in dezelfde velden, en las motorFoutBijFrame een n af die over alle
//  standen en ritten doorliep. Nu:
//
//  M8   wisselen wist niets: de cijfers van stand X blijven in perModus.X
//  M9   KERN: v8n, ort130 en webgpu schrijven in VERSCHILLENDE emmers
//  M10  motorFoutBijFrame telt per stand, vanaf 0 — niet de cumulatieve n
//  M11  de drie wezenpaden roepen terminate() aan (gespioneerde nep-worker)
//  M12  vglOpenA blijft begrensd: 200 hoofdframes zonder B laten hem niet groeien
//  M13  het overzicht: geen 42MB, geen versnelling in v8n, de B/A-regel staat erin
//  M14  de oude platte opslag gaat één keer het archief in, met label
//
//  M10–M12 draaien de ECHTE workerhandler, met een nep-Worker en een nep-fetch
//  op de plek van de echte. Geen ORT nodig: wat getoetst wordt is wat er met
//  de berichten gebeurt, niet wat de motor rekent.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_motorproef.js';
//      document.head.appendChild(s);
//      s.onload = () => testMotorproef().then(u => console.table(u.regels));
//    (async sinds V11.26.0: M10–M12 wachten op de fetch-keten)
// ═══════════════════════════════════════════════════════════════

async function testMotorproef() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  const origineel = new Map();
  const zet = (k, v) => {
    if (!origineel.has(k)) origineel.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };
  const bewaardStat = vglStat;
  const bewaardTimer = (typeof mvHerlaadTimer !== 'undefined') ? mvHerlaadTimer : null;
  const bewaardVgl = { worker: vglWorker, klaar: vglWorkerKlaar, bezig: vglBezig,
                       fouten: vglFouten, frames: vglFramesDezeStand, start: vglStartTijd };

  // ── de nep-worker en de nep-fetch (M10–M12) ─────────────────
  // Alleen de modelbestanden van de schaduw worden onderschept; elke andere
  // fetch van de app gaat gewoon door naar de echte.
  const echteWorker = window.Worker, echteFetch = window.fetch;
  const nepWorkers = [];
  let gooiBijInit = false, fetchGooitMeteen = false;
  function NepWorker(url) { this.url = url; this.berichten = []; this.gestopt = 0; nepWorkers.push(this); }
  NepWorker.prototype.postMessage = function (m) {
    if (gooiBijInit && m && m.type === 'initialiseer') throw new Error('DataCloneError (nep)');
    this.berichten.push(m && m.type);
  };
  NepWorker.prototype.terminate = function () { this.gestopt++; };
  const nepFetch = function (url, ...rest) {
    if (/model\/(model|dfine-n)\.onnx$/.test(String(url))) {
      if (fetchGooitMeteen) throw new Error('synchroon (nep)');
      return Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
    }
    return echteFetch.apply(window, [url, ...rest]);
  };
  const rust = () => new Promise(r => setTimeout(r, 0));
  const startNep = async (modus) => {
    const voor = nepWorkers.length;
    vglStartSchaduw(modus);
    await rust();
    return nepWorkers.length > voor ? nepWorkers[nepWorkers.length - 1] : null;
  };
  const stuur = (w, data) => w.onmessage({ data });
  const leegYolo = () => ({ data: new Float32Array(8 * 8400), dims: [1, 8, 8400] });
  // Het blok onder een kop in het overzicht, tot de volgende lege regel.
  const blok = (tekst, kop) => {
    const i = tekst.indexOf(kop); if (i < 0) return null;
    const na = tekst.slice(i).split('\n').slice(1).join('\n');
    const j = na.indexOf('\n\n');
    return j < 0 ? na : na.slice(0, j);
  };
  const paar = (f, modus, msA, msB, klA = 0, klB = 0) => {
    vglOpenA.set(f, { ms: msA, kl: klA, cf: 0.9, n: 1 });
    vglOpenB.set(f, { ms: msB, kl: klB, cf: 0.8, n: 1, modus });
    vglKoppel(f);
  };
  const leegOpen = () => { vglOpenA.clear(); vglOpenB.clear(); vglNaarB.clear(); };

  try {
    // ── M1: de modi ──────────────────────────────────────────
    eis('M1a er zijn vier modi', Array.isArray(MODELVGL_MODI) && MODELVGL_MODI.length === 4,
        4, MODELVGL_MODI && MODELVGL_MODI.length);
    eis('M1b in de juiste volgorde',
        JSON.stringify(MODELVGL_MODI) === JSON.stringify(['v8n', 'dfine', 'ort130', 'webgpu']),
        "['v8n','dfine','ort130','webgpu']", JSON.stringify(MODELVGL_MODI));
    eis('M1c v8n staat vooraan, dus dat blijft de standaard',
        MODELVGL_MODI[0] === 'v8n', 'v8n', MODELVGL_MODI[0]);
    zet('sl_modelvgl_model', null);
    eis('M1d zonder sleutel is de modus v8n', MODELVGL_MODEL === 'v8n', 'v8n', MODELVGL_MODEL);
    // een onzinwaarde mag nooit een motorproef aanzetten
    const leesModus = (v) => {
      zet('sl_modelvgl_model', v);
      return MODELVGL_MODI.indexOf(localStorage.getItem('sl_modelvgl_model')) > 0
        ? localStorage.getItem('sl_modelvgl_model') : 'v8n';
    };
    eis('M1e een onbekende waarde valt terug op v8n', leesModus('raketaandrijving') === 'v8n',
        'v8n', leesModus('raketaandrijving'));
    eis('M1f webgpu wordt wél herkend', leesModus('webgpu') === 'webgpu', 'webgpu', leesModus('webgpu'));
    zet('sl_modelvgl_model', null);

    // ── M2: de knop loopt rond ───────────────────────────────
    // mvWisselModel leest MODELVGL_MODEL (vastgelegd bij het laden), dus de
    // volledige rondgang toetsen we op de reeks zelf — dat is wat de knop doet.
    const volgende = (m) => {
      const i = MODELVGL_MODI.indexOf(m);
      return MODELVGL_MODI[((i < 0 ? 0 : i) + 1) % MODELVGL_MODI.length];
    };
    eis('M2a v8n → dfine (zoals voorheen)', volgende('v8n') === 'dfine', 'dfine', volgende('v8n'));
    eis('M2b dfine → ort130', volgende('dfine') === 'ort130', 'ort130', volgende('dfine'));
    eis('M2c ort130 → webgpu', volgende('ort130') === 'webgpu', 'webgpu', volgende('ort130'));
    eis('M2d webgpu → v8n (rond)', volgende('webgpu') === 'v8n', 'v8n', volgende('webgpu'));
    const echt = mvWisselModel();
    if (typeof mvHerlaadTimer !== 'undefined' && mvHerlaadTimer) {
      clearTimeout(mvHerlaadTimer); mvHerlaadTimer = null;
    }
    origineel.set('sl_modelvgl_model', origineel.has('sl_modelvgl_model') ? origineel.get('sl_modelvgl_model') : null);
    eis('M2e de knop zelf schakelt vanuit de standaard naar dfine', echt === 'dfine', 'dfine', echt);
    eis('M2f elke modus heeft een leesbare naam',
        MODELVGL_MODI.every(m => typeof mvModusNaam(m) === 'string' && mvModusNaam(m).length > 2),
        'vier namen', MODELVGL_MODI.map(mvModusNaam).join(' | '));

    // ── M3: de motorworker ───────────────────────────────────
    eis('M3a beide motoren zijn gedefinieerd',
        !!VGL_MOTOREN.ort130 && !!VGL_MOTOREN.webgpu, 'ort130 + webgpu',
        Object.keys(VGL_MOTOREN).join(','));
    eis('M3b ort130 vraagt wasm',
        JSON.stringify(VGL_MOTOREN.ort130.providers) === '["wasm"]',
        '["wasm"]', JSON.stringify(VGL_MOTOREN.ort130.providers));
    eis('M3c webgpu vraagt webgpu',
        JSON.stringify(VGL_MOTOREN.webgpu.providers) === '["webgpu"]',
        '["webgpu"]', JSON.stringify(VGL_MOTOREN.webgpu.providers));
    eis('M3d ort130 gebruikt de wasm-only bundel (kleinste download)',
        VGL_MOTOREN.ort130.bundel.endsWith('ort.wasm.min.js'),
        'ort.wasm.min.js', VGL_MOTOREN.ort130.bundel.split('/').pop());
    eis('M3e webgpu gebruikt de bundel die WebGPU bevat',
        VGL_MOTOREN.webgpu.bundel.endsWith('ort.min.js'),
        'ort.min.js', VGL_MOTOREN.webgpu.bundel.split('/').pop());
    eis('M3f beide wijzen naar dezelfde ORT-versie',
        VGL_MOTOREN.ort130.paden === VGL_MOTOREN.webgpu.paden
          && /1\.30\.0/.test(VGL_MOTOREN.ort130.paden),
        '1.30.0', VGL_MOTOREN.ort130.paden);

    const bronW = vglProviderWorkerBron(VGL_MOTOREN.webgpu.bundel,
                                        VGL_MOTOREN.webgpu.paden,
                                        VGL_MOTOREN.webgpu.providers);
    eis('M3g de workercode draait hetzelfde model-invoerveld als het hoofdpad',
        bronW.indexOf('sessie.run({images:tensor})') >= 0
          && bronW.indexOf("output['output0']") >= 0,
        'images + output0', 'aanwezig');
    eis('M3h ... en meldt terug welke provider het geworden is',
        bronW.indexOf("type:'klaar'") >= 0 && bronW.indexOf('provider:') >= 0,
        'provider in het klaar-bericht', bronW.indexOf('provider:') >= 0);

    // ── M4: KERN — geen terugval ─────────────────────────────
    eis('M4a de workercode vraagt precies ÉÉN provider',
        bronW.indexOf('["webgpu"]') >= 0 && bronW.indexOf('wasm"]') < 0,
        'alleen webgpu', (bronW.match(/executionProviders:\[[^\]]*\]/) || ['?'])[0]);
    eis('M4b een mislukte init meldt zich als fout, en doet niets anders',
        bronW.indexOf("type:'fout',bericht:'init: '") >= 0,
        'init-fout wordt gemeld', bronW.indexOf("bericht:'init: '") >= 0);
    eis('M4c de motorkeuze zit niet in het hoofdpad',
        zc(YOLO_WORKER_CODE).indexOf('webgpu') < 0,
        'geen webgpu in YOLO_WORKER_CODE', zc(YOLO_WORKER_CODE).indexOf('webgpu'));

    // ── M5: KERN — het hoofdpad is onaangeroerd ──────────────
    eis('M5a YOLO_WORKER_CODE draait nog op 1.17.1',
        YOLO_WORKER_CODE.indexOf('onnxruntime-web@1.17.1') >= 0,
        '1.17.1', (YOLO_WORKER_CODE.match(/onnxruntime-web@[\d.]+/) || ['?'])[0]);
    eis('M5b ... met de wasm-provider',
        YOLO_WORKER_CODE.indexOf("executionProviders:['wasm']") >= 0,
        "['wasm']", 'aanwezig');
    eis('M5c ... en met dezelfde invoer en uitvoer als altijd',
        YOLO_WORKER_CODE.indexOf('sessie.run({images:tensor})') >= 0
          && YOLO_WORKER_CODE.indexOf("output['output0']") >= 0
          && YOLO_WORKER_CODE.indexOf('pixel_values') < 0,
        'images + output0, geen pixel_values', 'ongewijzigd');
    eis('M5d de hoofdthread-sessie staat ook nog op wasm',
        zc(laadONNXModel).indexOf("executionProviders:['wasm']") >= 0
          && zc(laadONNXModel).indexOf('webgpu') < 0,
        "['wasm'], geen webgpu", 'ongewijzigd');

    // ── M6: vastleggen wat er gebeurde ───────────────────────
    // V11.26.0: in de emmer van de stand, en de framestand is die van DEZE
    // stand (vglFramesDezeStand), niet meer st.n — zie M10.
    zet('sl_modelvgl', null);
    vglStat = null;
    vglNoteerMotor('webgpu', 'webgpu', 1);
    let st = vglStatLaad().perModus.webgpu;
    eis('M6a de provider wordt vastgelegd', st.motorProvider === 'webgpu', 'webgpu', st.motorProvider);
    eis('M6a2 en de motor komt van de aanroeper, niet van de sessiemodus',
        st.motor === 'webgpu' && MODELVGL_MODEL !== 'webgpu',
        'webgpu terwijl de sessie v8n is', st.motor + ' / sessie ' + MODELVGL_MODEL);
    eis('M6b ... net als het aantal threads', st.motorThreads === 1, 1, st.motorThreads);
    vglFramesDezeStand = 437;        // alsof de schaduw in deze stand 437 frames haalde
    vglNoteerMotorFout('webgpu', 'Device lost');
    st = vglStatLaad().perModus.webgpu;
    eis('M6c de fout wordt vastgelegd', st.motorFout === 'Device lost', 'Device lost', st.motorFout);
    eis('M6d ... mét het aantal frames dat wél lukte', st.motorFoutBijFrame === 437,
        437, st.motorFoutBijFrame);
    vglNoteerMotorFout('webgpu', 'tweede fout');
    st = vglStatLaad().perModus.webgpu;
    eis('M6e alleen de EERSTE reden blijft staan', st.motorFout === 'Device lost',
        'Device lost', st.motorFout);
    eis('M6f maar de teller loopt door', st.motorFouten === 2, 2, st.motorFouten);

    // ── M7: de samenvatting ──────────────────────────────────
    const tekst = mvSamenvattingTekst();
    eis('M7a de samenvatting begint nog steeds met "Nu aan het meten: "',
        tekst.indexOf('Nu aan het meten: ') === 0,
        'begint zo', tekst.split('\n')[0]);
    eis('M7b en noemt de provider en de fout',
        tekst.indexOf('webgpu') >= 0 && tekst.indexOf('Device lost') >= 0
          && tekst.indexOf('437') >= 0,
        'provider, fout, frames', tekst.replace(/\n/g, ' | ').slice(0, 170));

    // ── M8: wisselen wist niets ──────────────────────────────
    zet('sl_modelvgl', null); vglStat = null; leegOpen();
    for (let i = 0; i < 10; i++) paar(1000 + i, 'ort130', 500, 450);
    const ortVoor = JSON.stringify(vglStatLaad().perModus.ort130);
    eis('M8a de ort130-cijfers staan in perModus.ort130',
        vglStatLaad().perModus.ort130.n === 10 && vglStatLaad().perModus.ort130.somMsB === 4500,
        'n 10, somMsB 4500',
        vglStatLaad().perModus.ort130.n + ', ' + vglStatLaad().perModus.ort130.somMsB);
    const opslagVoor = localStorage.getItem('sl_modelvgl');
    mvWisselModel();
    if (typeof mvHerlaadTimer !== 'undefined' && mvHerlaadTimer) {
      clearTimeout(mvHerlaadTimer); mvHerlaadTimer = null;
    }
    eis('M8b de standknop schrijft de resultaten niet',
        localStorage.getItem('sl_modelvgl') === opslagVoor
          && !/sl_modelvgl'/.test(zc(mvWisselModel)),
        'sl_modelvgl ongewijzigd', localStorage.getItem('sl_modelvgl') === opslagVoor);
    vglStat = null;                                      // wat een herlaad doet
    eis('M8c na de herlaad staan ze er nog, veld voor veld',
        JSON.stringify(vglStatLaad().perModus.ort130) === ortVoor,
        'gelijk', JSON.stringify(vglStatLaad().perModus.ort130).slice(0, 80));
    paar(1100, 'webgpu', 500, 300);
    vglNoteerMotor('webgpu', 'webgpu', 1);
    vglNoteerMotorFout('webgpu', 'Device lost');
    eis('M8d meten in een andere stand laat ort130 staan, ook motor en fout',
        JSON.stringify(vglStatLaad().perModus.ort130) === ortVoor,
        'gelijk', JSON.stringify(vglStatLaad().perModus.ort130).slice(0, 80));

    // ── M9: KERN — elke stand zijn eigen emmer ───────────────
    // Dit is de toets die V11.25.0 rood zou maken: daar kwamen alle drie deze
    // paren in dezelfde somMsB terecht.
    zet('sl_modelvgl', null); vglStat = null; leegOpen();
    paar(1, 'v8n', 500, 100);
    paar(2, 'ort130', 500, 200);
    paar(3, 'webgpu', 500, 300, 0, 1);
    let pm = vglStatLaad().perModus;
    eis('M9a v8n, ort130 en webgpu hebben elk precies hun eigen paar',
        pm.v8n.n === 1 && pm.v8n.somMsB === 100 && pm.ort130.n === 1 && pm.ort130.somMsB === 200
          && pm.webgpu.n === 1 && pm.webgpu.somMsB === 300,
        '1/100, 1/200, 1/300',
        [pm.v8n, pm.ort130, pm.webgpu].map(e => e.n + '/' + e.somMsB).join(', '));
    paar(4, 'ort130', 700, 250);
    pm = vglStatLaad().perModus;
    eis('M9b een ort130-frame laat de somMsB van v8n en webgpu ongemoeid',
        pm.v8n.somMsB === 100 && pm.webgpu.somMsB === 300 && pm.ort130.somMsB === 450 && pm.ort130.n === 2,
        'v8n 100, webgpu 300, ort130 450',
        pm.v8n.somMsB + ', ' + pm.webgpu.somMsB + ', ' + pm.ort130.somMsB);
    eis('M9c ... en elke emmer houdt zijn eigen A, uit dezelfde rit als zijn B',
        pm.ort130.somMsA === 1200 && pm.v8n.somMsA === 500 && pm.webgpu.somMsA === 500,
        'ort130 1200, v8n 500, webgpu 500',
        pm.ort130.somMsA + ', ' + pm.v8n.somMsA + ', ' + pm.webgpu.somMsA);
    eis('M9d eens, oneens en de matrix zijn ook per stand',
        pm.webgpu.oneens === 1 && pm.v8n.oneens === 0 && pm.ort130.oneens === 0
          && pm.webgpu.matrix['0>1'] === 1 && !pm.v8n.matrix['0>1'],
        'alleen webgpu oneens', [pm.v8n.oneens, pm.ort130.oneens, pm.webgpu.oneens].join(','));
    vglOpenA.set(5, { ms: 500, kl: 0, cf: 0.9, n: 1 });
    vglOpenB.set(5, { ms: 50, kl: 0, cf: 0.8, n: 1 });   // zonder modus
    vglKoppel(5);
    pm = vglStatLaad().perModus;
    eis('M9e een B zonder modus valt in de stand van deze sessie, niet in een motoremmer',
        pm[MODELVGL_MODEL].n === 2 && pm.ort130.n === 2 && pm.webgpu.n === 1,
        MODELVGL_MODEL + ' 2, ort130 2, webgpu 1',
        [pm.v8n.n, pm.ort130.n, pm.webgpu.n].join(', '));
    vglNoteerC(700, 2); vglNoteerHoofdInDfine(500);
    pm = vglStatLaad().perModus;
    eis('M9f D-FINE telt alleen in de dfine-emmer',
        pm.dfine.nC === 1 && pm.dfine.nAC === 1 && pm.dfine.n === 0 && pm.v8n.n === 2,
        'dfine nC 1, nAC 1', pm.dfine.nC + ', ' + pm.dfine.nAC + ', v8n ' + pm.v8n.n);

    // ── M10: motorFoutBijFrame telt per stand, vanaf 0 ───────
    window.Worker = NepWorker; window.fetch = nepFetch;
    // zoals op de telefoon: een lange v8n-geschiedenis, en een eerdere ort130-rit
    zet('sl_modelvgl', JSON.stringify({ schema: 2, perModus: {
      v8n:    { n: 10780, somMsA: 10780 * 600, somMsB: 10780 * 590, eens: 10000, oneens: 780 },
      ort130: { n: 50, somMsA: 50 * 600, somMsB: 50 * 640, eens: 50, oneens: 0 } } }));
    vglStat = null; leegOpen();
    let w = await startNep('ort130');
    eis('M10 vooraf: de stand start een worker en stuurt hem het model',
        !!w && w.berichten[0] === 'initialiseer', 'initialiseer', w ? w.berichten.join(',') : 'geen worker');
    stuur(w, { type: 'klaar', provider: 'wasm', threads: 1 });
    eis('M10a bij het begin van de stand staat de teller op nul',
        vglFramesDezeStand === 0, 0, vglFramesDezeStand);
    for (const f of [11, 12, 13]) {
      vglNaarB.add(f);                                           // zoals voerAIUit doet
      if (f !== 13) vglOpenA.set(f, { ms: 600, kl: -1, cf: 0, n: 0 });   // 13: A nog onderweg
      vglStartTijd = Date.now() - 620;
      stuur(w, Object.assign({ type: 'resultaat', frameId: f }, leegYolo()));
    }
    stuur(w, { type: 'fout', bericht: 'Device lost', frameId: 14 });
    pm = vglStatLaad().perModus;
    eis('M10b motorFoutBijFrame is het aantal frames van DEZE stand',
        pm.ort130.motorFoutBijFrame === 3, 3, pm.ort130.motorFoutBijFrame);
    eis('M10c ... en niet de cumulatieve n — niet die van v8n, niet die van de emmer zelf',
        pm.ort130.motorFoutBijFrame !== 10780 && pm.ort130.n === 52,
        'niet 10780, niet 52', pm.ort130.motorFoutBijFrame + ' (emmer n ' + pm.ort130.n + ')');
    eis('M10d de paren van deze stand kwamen in ort130; v8n bleef staan',
        pm.ort130.n === 52 && pm.v8n.n === 10780 && pm.ort130.motorProvider === 'wasm',
        'ort130 52, v8n 10780', pm.ort130.n + ', ' + pm.v8n.n);
    vglLegStil();                                                // wat een herlaad doet
    w = await startNep('webgpu');
    stuur(w, { type: 'fout', bericht: 'init: no available backend found. ERR: [wasm] RangeError: Out of memory' });
    pm = vglStatLaad().perModus;
    eis('M10e een init-fout staat op 0 frames — daar viel hij ook',
        pm.webgpu.motorFoutBijFrame === 0 && /^init: /.test(pm.webgpu.motorFout),
        0, pm.webgpu.motorFoutBijFrame + ' / ' + pm.webgpu.motorFout);
    const t10 = mvSamenvattingTekst();
    eis('M10f het overzicht zegt NIET GESTART bij webgpu, en "na 3 frames" bij ort130',
        /NIET GESTART: init: /.test(blok(t10, '── ORT 1.30 (WebGPU)') || '')
          && /eerste fout na 3 frames: Device lost/.test(blok(t10, '── ORT 1.30 (WASM)') || '')
          && !/NIET GESTART/.test(blok(t10, '── ORT 1.30 (WASM)') || '')
          && t10.indexOf('10780 frames') < 0,
        'NIET GESTART / na 3 frames', t10.replace(/\n/g, ' | ').slice(0, 400));

    // ── M11: de wezenpaden roepen terminate() aan ────────────
    vglLegStil();
    w = await startNep('ort130');
    w.onerror();
    eis('M11a onerror stopt de worker en laat geen verwijzing achter',
        w.gestopt === 1 && vglWorker === null && vglWorkerKlaar === false,
        'terminate 1x, vglWorker null', 'terminate ' + w.gestopt + 'x, ' + vglWorker);
    gooiBijInit = true;
    w = await startNep('ort130');
    gooiBijInit = false;
    eis('M11b de .catch van de fetch-keten stopt een worker die al bestond',
        !!w && w.gestopt === 1 && vglWorker === null,
        'terminate 1x', w ? 'terminate ' + w.gestopt + 'x, ' + vglWorker : 'geen worker');
    const oud = new NepWorker('oud');
    vglWorker = oud; vglWorkerKlaar = true;
    fetchGooitMeteen = true;
    vglStartSchaduw('ort130');
    fetchGooitMeteen = false;
    eis('M11c de buitenste catch stopt een worker van eerder in plaats van hem wees te maken',
        oud.gestopt === 1 && vglWorker === null && vglWorkerKlaar === false,
        'terminate 1x', 'terminate ' + oud.gestopt + 'x, ' + vglWorker);
    w = await startNep('ort130');
    stuur(w, { type: 'klaar', provider: 'wasm', threads: 1 });
    for (let i = 0; i < 5; i++) stuur(w, { type: 'fout', bericht: 'run ' + i, frameId: 100 + i });
    eis('M11d het pad dat het al goed deed — vijf fouten — doet het nog',
        w.gestopt === 1 && vglWorker === null, 'terminate 1x', 'terminate ' + w.gestopt + 'x');
    eis('M11e in de bron zet geen enkel pad vglWorker nog zelf op null',
        !/vglWorker\s*=\s*null/.test(zc(vglStartSchaduw))
          && /vglWorker\s*=\s*null/.test(zc(vglLegStil)) && /\.terminate\(\)/.test(zc(vglLegStil)),
        'alleen via vglLegStil', (zc(vglStartSchaduw).match(/vglWorker\s*=\s*null/g) || []).length + 'x los');

    // ── M12: vglOpenA blijft begrensd ────────────────────────
    vglLegStil(); zet('sl_modelvgl', null); vglStat = null;
    for (let i = 0; i < 200; i++) {
      vglOpenA.set(5000 + i, { ms: 600, kl: 0, cf: 0.9, n: 1 });
      vglKoppel(5000 + i);
    }
    eis('M12a 200 hoofdframes terwijl de schaduw niet draait: vglOpenA blijft leeg',
        vglOpenA.size === 0, 0, vglOpenA.size);
    for (let i = 0; i < 200; i++) {
      vglNaarB.add(6000 + i);
      vglOpenA.set(6000 + i, { ms: 600, kl: 0, cf: 0.9, n: 1 });
      vglKoppel(6000 + i);
    }
    eis('M12b 200 frames naar een schaduw die nooit antwoordt: begrensd op VGL_OPEN_MAX',
        vglOpenA.size <= VGL_OPEN_MAX && vglNaarB.size <= VGL_OPEN_MAX && VGL_OPEN_MAX < 200,
        '≤ ' + VGL_OPEN_MAX, vglOpenA.size + ' / ' + vglNaarB.size);
    leegOpen();
    const aa = { ms: 600, kl: 0, cf: 0.9, n: 1 }, bb = { ms: 580, kl: 0, cf: 0.8, n: 1, modus: 'v8n' };
    vglNaarB.add(7001); vglOpenA.set(7001, aa); vglKoppel(7001);          // A eerst
    const wachtA = vglOpenA.has(7001);
    vglOpenB.set(7001, bb); vglKoppel(7001);
    vglNaarB.add(7002); vglOpenB.set(7002, bb); vglKoppel(7002);          // B eerst
    const wachtB = vglOpenB.has(7002);
    vglOpenA.set(7002, aa); vglKoppel(7002);
    eis('M12c een A die op zijn B wacht blijft staan, en omgekeerd',
        wachtA && wachtB, 'allebei', wachtA + ', ' + wachtB);
    eis('M12d beide volgordes worden een paar, en daarna staat er niets meer open',
        vglStatLaad().perModus.v8n.n === 2 && vglOpenA.size === 0 && vglOpenB.size === 0 && vglNaarB.size === 0,
        'n 2, alles leeg',
        vglStatLaad().perModus.v8n.n + ' / ' + [vglOpenA.size, vglOpenB.size, vglNaarB.size].join(','));
    w = await startNep('v8n');
    stuur(w, { type: 'klaar' });
    vglNaarB.add(7003); vglOpenA.set(7003, aa); vglKoppel(7003);
    stuur(w, { type: 'fout', bericht: 'run mislukt', frameId: 7003 });
    eis('M12e een fout van de schaduw voor een frame ruimt de A van dat frame op',
        !vglOpenA.has(7003) && !vglNaarB.has(7003), 'weg', vglOpenA.has(7003) + ', ' + vglNaarB.has(7003));
    vglLegStil();
    w = await startNep('dfine');
    stuur(w, { type: 'klaar' });
    for (let i = 0; i < 30; i++) {
      vglNaarB.add(8000 + i);
      vglStartTijd = Date.now() - 300;
      stuur(w, { type: 'resultaat', frameId: 8000 + i, logits: new Float32Array(300 * 80).fill(-9),
                 logitsDims: [1, 300, 80], boxes: new Float32Array(300 * 4) });
    }
    eis('M12f in de stand dfine, die niet paart, blijft vglNaarB toch leeg',
        vglNaarB.size === 0 && vglStatLaad().perModus.dfine.nC === 30,
        '0, nC 30', vglNaarB.size + ', nC ' + vglStatLaad().perModus.dfine.nC);
    eis('M12g de bron: het hoofdpad koppelt direct na het zetten, voerAIUit noteert wat naar B ging',
        /vglOpenA\.set\(msg\.frameId[^;]*;\s*vglKoppel\(msg\.frameId\)/.test(zc(laadONNXModel))
          && /vglWorker\.postMessage\([\s\S]*?\);\s*vglNaarB\.add\(frameT\)/.test(zc(voerAIUit)),
        'allebei', 'aanwezig');
    vglLegStil();
    window.Worker = echteWorker; window.fetch = echteFetch;

    // ── M13: wat het overzicht zegt ──────────────────────────
    zet('sl_modelvgl', JSON.stringify({ schema: 2, perModus: {
      v8n:    { n: 100, somMsA: 100 * 600, somMsB: 100 * 612, eens: 97, oneens: 3,
                voorV1126: { label: 'gemengd, vóór V11.26', n: 10780 } },
      ort130: { n: 40, somMsA: 40 * 620, somMsB: 40 * 700, eens: 39, oneens: 1,
                motor: 'ort130', motorProvider: 'wasm', motorThreads: 1 } } }));
    vglStat = null;
    const t13 = mvSamenvattingTekst();
    eis('M13a het overzicht noemt nergens meer een model van 42 MB',
        !/42[,.\d]*\s*MB/i.test(t13), 'geen 42MB', (t13.match(/42[,.\d]*\s*MB/i) || ['schoon'])[0]);
    const b8 = blok(t13, '── YOLOv8n') || '';
    eis('M13b de stand v8n noemt geen versnelling tussen twee modellen van gelijke grootte',
        !/sneller|versnelling|×/i.test(b8) && !/Sneller/.test(t13),
        'geen versnelling', b8.replace(/\n/g, ' | '));
    eis('M13c ... maar toont B/A en noemt zich de controle',
        b8.indexOf('B/A: 1,02') >= 0 && b8.indexOf('Controle') >= 0,
        'B/A 1,02 + Controle', b8.replace(/\n/g, ' | '));
    eis('M13d de vaste regel staat erin: alleen B/A, nooit ruwe ms',
        /VASTE REGEL: vergelijk standen alleen\nop B\/A, nooit op ruwe ms/.test(t13),
        'regel aanwezig', t13.split('\n').slice(2, 5).join(' | '));
    const koppen = MODELVGL_MODI.map(m => t13.indexOf('── ' + mvModusNaam(m)));
    eis('M13e alle vier de standen staan eronder, in de volgorde van de knop',
        koppen.every(i => i > 0) && koppen.every((x, i) => i === 0 || x > koppen[i - 1]),
        'vier koppen op volgorde', koppen.join(','));
    eis('M13f een lege stand zegt "— nog niet gemeten —"',
        blok(t13, '── D-FINE-N') === '— nog niet gemeten —'
          && blok(t13, '── ORT 1.30 (WebGPU)') === '— nog niet gemeten —'
          && (blok(t13, '── ORT 1.30 (WASM)') || '').indexOf('B/A: 1,13') >= 0,
        'dfine + webgpu leeg, ort130 1,13',
        [blok(t13, '── D-FINE-N'), blok(t13, '── ORT 1.30 (WebGPU)')].join(' / '));
    eis('M13g het archief staat eronder, met zijn label, en telt niet mee',
        t13.indexOf('Archief (gemengd, vóór V11.26):') >= 0 && t13.indexOf('telt niet mee') >= 0,
        'archiefblok', t13.slice(t13.indexOf('Archief')).replace(/\n/g, ' | '));
    vglStat = null;
    const c13 = modelVergelijking();
    eis('M13h de console-samenvatting volgt dezelfde regels',
        !/42[,.\d]*\s*MB|versnelling/i.test(c13) && /alleen op B\/A, nooit op ruwe ms/.test(c13)
          && /v8n\s*: 100 paren/.test(c13) && /archief : 10780 paren/.test(c13),
        'per stand, met regel', c13.replace(/\n/g, ' | ').slice(0, 200));
    // Vier standen onder elkaar zijn hoger dan een telefoonscherm. Zonder
    // scrollende overlay viel de bovenkant weg en waren de knoppen — ook
    // "Zet uit" — onbereikbaar.
    mvToonOverlay();
    const ovl = document.getElementById('mv-overlay'), kaart = document.getElementById('mv-kaart');
    ovl.scrollTop = 0;
    const bovenkant = kaart.getBoundingClientRect().top;
    eis('M13i het langere overzicht blijft bereikbaar: de overlay scrollt en de kaart begint in beeld',
        getComputedStyle(ovl).overflowY === 'auto' && bovenkant >= 0,
        'overflow auto, top ≥ 0', getComputedStyle(ovl).overflowY + ', top ' + Math.round(bovenkant));
    mvSluit();

    // ── M14: de oude platte opslag, één keer ─────────────────
    // Precies de vorm die op de telefoon staat: 10.780 paren van drie motoren
    // door elkaar, en een motorFoutBijFrame die die 10.780 napraat.
    const plat = { start: 1, n: 10780, somMsA: 10780 * 610, somMsB: 10780 * 540, maxMsA: 1400, maxMsB: 1300,
      eens: 10000, oneens: 780, matrix: { '0>0': 9000 }, voorbeelden: [{ f: 1 }],
      nC: 120, somMsC: 120 * 700, maxMsC: 1100, detC: 40, nAC: 300, somMsAC: 300 * 560, maxMsAC: 900,
      motor: 'webgpu', motorFouten: 2, motorFoutBijFrame: 10780,
      motorFout: 'init: no available backend found. ERR: [wasm] RangeError: Out of memory' };
    zet('sl_modelvgl', JSON.stringify(plat)); vglStat = null;
    const tPlat = mvSamenvattingTekst();
    eis('M14a het overzicht op oude data schrijft niets naar de opslag',
        localStorage.getItem('sl_modelvgl') === JSON.stringify(plat), 'ongewijzigd', 'ok');
    eis('M14b ... toont "10780 frames" nergens meer, en de vier standen zijn leeg',
        tPlat.indexOf('10780 frames') < 0 && blok(tPlat, '── YOLOv8n') === '— nog niet gemeten —'
          && tPlat.indexOf('10780 paren en 120 D-FINE-frames') >= 0,
        'alleen in het archief', tPlat.replace(/\n/g, ' | ').slice(-200));
    vglStatLaad();
    const om = JSON.parse(localStorage.getItem('sl_modelvgl'));
    eis('M14c het laden zet de opslag één keer om, en legt dat meteen vast',
        om.schema === 2 && !!om.perModus && om.n === undefined && om.nC === undefined,
        'schema 2, geen platte velden', Object.keys(om).join(','));
    // Zet de omzetting niet door, dan moeten de toetsen hieronder ROOD worden,
    // niet de hele suite laten omvallen — vandaar de lege vervangers.
    if (!om.perModus) om.perModus = {};
    for (const m of MODELVGL_MODI) if (!om.perModus[m]) om.perModus[m] = {};
    const ar = om.perModus.v8n.voorV1126 || {};
    eis('M14d alles staat ongewijzigd in het archief, met het label "gemengd, vóór V11.26"',
        Object.keys(plat).every(k => JSON.stringify(ar[k]) === JSON.stringify(plat[k]))
          && ar.label === 'gemengd, vóór V11.26',
        'alle ' + Object.keys(plat).length + ' velden + label',
        Object.keys(plat).filter(k => JSON.stringify(ar[k]) !== JSON.stringify(plat[k])).join(',') || ar.label);
    eis('M14e ook de D-FINE-velden: hun A wisselde op 19 sept van model',
        ar.nC === 120 && ar.nAC === 300 && om.perModus.dfine.nC === 0 && om.perModus.dfine.nAC === 0,
        'archief 120/300, emmer 0/0', ar.nC + '/' + ar.nAC + ', ' + om.perModus.dfine.nC);
    eis('M14f alle vier de emmers beginnen op nul, zonder geërfde fout',
        MODELVGL_MODI.every(m => om.perModus[m].n === 0 && om.perModus[m].motorFout === null
                                 && om.perModus[m].motorFoutBijFrame === null),
        'n 0, geen fout', MODELVGL_MODI.map(m => om.perModus[m].n + '/' + om.perModus[m].motorFout).join(', '));
    vglStat = null;
    const m2 = vglStatLaad();
    eis('M14g een tweede keer laden zet niets opnieuw om',
        m2.perModus.v8n.voorV1126.n === 10780 && !m2.perModus.v8n.voorV1126.perModus
          && !m2.perModus.v8n.voorV1126.voorV1126
          && localStorage.getItem('sl_modelvgl') === JSON.stringify(om),
        'één archief, opslag gelijk', 'archief n ' + m2.perModus.v8n.voorV1126.n);
    leegOpen();
    paar(9001, 'v8n', 600, 590);
    const na14 = vglStatLaad().perModus.v8n;
    eis('M14h nieuwe v8n-paren tellen vanaf nul en raken het archief niet',
        na14.n === 1 && na14.somMsB === 590 && na14.voorV1126.n === 10780
          && na14.voorV1126.somMsB === 10780 * 540,
        'n 1; archief 10780', na14.n + '; archief ' + na14.voorV1126.n);
    zet('sl_modelvgl', JSON.stringify({ start: 1, n: 0, somMsA: 0, somMsB: 0, eens: 0, oneens: 0,
                                        matrix: {}, voorbeelden: [] }));
    vglStat = null;
    eis('M14i een lege oude opslag levert geen leeg archief op',
        !vglStatLaad().perModus.v8n.voorV1126, 'geen archief', String(!!vglStatLaad().perModus.v8n.voorV1126));

  } finally {
    window.Worker = echteWorker; window.fetch = echteFetch;
    if (vglWorker instanceof NepWorker) vglLegStil();
    for (const [k, v] of origineel) {
      try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
      catch (e) {}
    }
    vglStat = bewaardStat;
    vglWorker = bewaardVgl.worker; vglWorkerKlaar = bewaardVgl.klaar; vglBezig = bewaardVgl.bezig;
    vglFouten = bewaardVgl.fouten; vglFramesDezeStand = bewaardVgl.frames; vglStartTijd = bewaardVgl.start;
    vglOpenA.clear(); vglOpenB.clear(); vglNaarB.clear();
    if (typeof mvHerlaadTimer !== 'undefined' && mvHerlaadTimer) {
      clearTimeout(mvHerlaadTimer); mvHerlaadTimer = bewaardTimer;
    }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
