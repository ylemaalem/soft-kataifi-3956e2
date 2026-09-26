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
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_motorproef.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testMotorproef().regels);
// ═══════════════════════════════════════════════════════════════

function testMotorproef() {
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
    zet('sl_modelvgl', null);
    vglStat = null;
    vglNoteerMotor('webgpu', 'webgpu', 1);
    let st = vglStatLaad();
    eis('M6a de provider wordt vastgelegd', st.motorProvider === 'webgpu', 'webgpu', st.motorProvider);
    eis('M6a2 en de motor komt van de aanroeper, niet van de sessiemodus',
        st.motor === 'webgpu' && MODELVGL_MODEL !== 'webgpu',
        'webgpu terwijl de sessie v8n is', st.motor + ' / sessie ' + MODELVGL_MODEL);
    eis('M6b ... net als het aantal threads', st.motorThreads === 1, 1, st.motorThreads);
    st.n = 437;                      // alsof er 437 frames gelukt waren
    vglNoteerMotorFout('webgpu', 'Device lost');
    st = vglStatLaad();
    eis('M6c de fout wordt vastgelegd', st.motorFout === 'Device lost', 'Device lost', st.motorFout);
    eis('M6d ... mét het aantal frames dat wél lukte', st.motorFoutBijFrame === 437,
        437, st.motorFoutBijFrame);
    vglNoteerMotorFout('webgpu', 'tweede fout');
    st = vglStatLaad();
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

  } finally {
    for (const [k, v] of origineel) {
      try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
      catch (e) {}
    }
    vglStat = bewaardStat;
    if (typeof mvHerlaadTimer !== 'undefined' && mvHerlaadTimer) {
      clearTimeout(mvHerlaadTimer); mvHerlaadTimer = bewaardTimer;
    }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
