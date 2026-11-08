// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nano_hoofd.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.31: YOLOX-Nano (eigen-2 last) is het hoofdmodel.
//
//  NH1  de volgorde van de paden, en de stille terugzetkeuze sl_hoofdmodel
//  NH2  één download per pad; de sessie op de hoofdthread is uitgesteld
//       (geen InferenceSession tot de eerste run zonder worker)
//  NH3  de uitgestelde sessie rekent op de hoofdthread hetzelfde als de worker
//       (zelfde pixels, zelfde detecties na postprocessYOLO)
//  NH4  een laadfout in de Nano-worker ('init: ...') laadt het volgende pad
//  NH5  de drempels volgen het geladen model (Nano 0,07/0,03; YOLOv8 0,10/0,04)
//  NH6  de Nano-schaduw start niet als het hoofdmodel al Nano is
//  NH7  zolang de worker laadt, rekent voerAIUit niet op de hoofdthread
//  NH8  de app laadde in deze pagina Nano als hoofd: label, pil, sessie, worker
//
//  DRAAIEN: zoals de andere toetsen; testNanoHoofd().
// ═══════════════════════════════════════════════════════════════
async function testNanoHoofd() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const bew = { soort: hoofdSoort, poging: hoofdPoging, item: localStorage.getItem('sl_hoofdmodel'), fetch: window.fetch, create: ort.InferenceSession.create,
                laad: window.laadONNXModel, yw: yoloWorker, wk: workerKlaar, mg: modelGeladen, os: onnxSession, tf: modelTerugvalFout };
  try {
    // ═══ NH8 (eerst: de toestand die de app zelf opbouwde) ═══
    const t0 = Date.now();
    while (!(workerKlaar && yoloWorker) && Date.now() - t0 < 30000) await new Promise(r => setTimeout(r, 200));
    eis('NH8 de app laadde Nano als hoofd: soort yolox, pad yolox_nano.onnx, uitgestelde sessie, worker klaar, pil "Nano", label zonder "Reserve"',
        hoofdSoort === 'yolox' && onnxSession && onnxSession.pad === './model/yolox_nano.onnx' && onnxSession.uitgesteld === true && workerKlaar === true
          && pAIT.textContent === 'Nano' && /YOLOX-Nano/.test(sModelLabel.textContent) && !/Reserve/.test(sModelLabel.textContent),
        'yolox, nano, uitgesteld, klaar, Nano', [hoofdSoort, onnxSession && onnxSession.pad, workerKlaar, pAIT.textContent, sModelLabel.textContent].join(' | '));

    // ═══ NH1 ═══
    hoofdPoging = 0; localStorage.removeItem('sl_hoofdmodel');
    const a = hoofdPaden().join(',');
    localStorage.setItem('sl_hoofdmodel', 'yolov8'); const b = hoofdPaden().join(',');
    localStorage.removeItem('sl_hoofdmodel'); hoofdPoging = 1; const c = hoofdPaden().join(','); hoofdPoging = 0;
    eis('NH1 volgorde: Nano dan YOLOv8n; met sl_hoofdmodel=yolov8 de oude volgorde; na een laadfout het volgende pad',
        a === './model/yolox_nano.onnx,./model.onnx,./model/model.onnx' && b === './model.onnx,./model/model.onnx' && c === './model.onnx,./model/model.onnx'
          && MODEL_PADEN['./model/yolox_nano.onnx'].rol === 'hoofd' && MODEL_PADEN['./model.onnx'].rol === 'reserve',
        'nano,v8,oud | v8,oud | v8,oud', [a, b, c].join(' | '));

    // ═══ NH2 ═══
    const gehaald = []; let sessies = 0;
    window.fetch = function (u) { gehaald.push(String(u)); return bew.fetch.apply(this, arguments); };
    ort.InferenceSession.create = function () { sessies++; return bew.create.apply(this, arguments); };
    hoofdBuffers.delete('./model/yolox_nano.onnx');
    const s1 = await hoofdSessie('./model/yolox_nano.onnx');
    const k1 = await hoofdBuffer('./model/yolox_nano.onnx'); const k2 = await hoofdBuffer('./model/yolox_nano.onnx');
    eis('NH2a één download voor sessie en twee worker-kopieën, en nog geen InferenceSession',
        gehaald.filter(u => /yolox_nano\.onnx/.test(u)).length === 1 && sessies === 0 && s1.uitgesteld === true && k1 !== k2 && k1.byteLength === k2.byteLength && k1.byteLength > 3e6,
        '1 download, 0 sessies', gehaald.length + ' downloads, ' + sessies + ' sessies, ' + k1.byteLength + ' B');
    let gooit = null;
    try { await hoofdSessie('./model/bestaat_niet.onnx'); } catch (e) { gooit = String(e.message || e); }
    eis('NH2b een pad dat niet in MODEL_PADEN staat of niet te halen is, gooit (dan het volgende pad, zoals vroeger)', !!gooit, 'gooit', gooit || 'gooide niet');

    // ═══ NH3 ═══
    const px = new Float32Array(3 * 640 * 640);
    for (let y = 0; y < 640; y++) for (let x = 0; x < 640; x++) { const i = y * 640 + x; px[i] = 0.3 + 0.2 * Math.sin(x / 40); px[409600 + i] = 0.35; px[819200 + i] = 0.4 + 0.1 * Math.cos(y / 30); }
    for (let y = 200; y < 300; y++) for (let x = 300; x < 340; x++) { const i = y * 640 + x; px[i] = 0.1; px[409600 + i] = 0.1; px[819200 + i] = 0.1; }
    for (let y = 215; y < 245; y++) for (let x = 308; x < 332; x++) { const i = y * 640 + x; px[i] = 1; px[409600 + i] = 0.15; px[819200 + i] = 0.1; }
    const uitH = await s1.run({ images: new ort.Tensor('float32', new Float32Array(px), [1, 3, 640, 640]) });
    eis('NH3a de eerste run zonder worker maakt de sessie (1) en geeft output0 (1, 8, 8400)', sessies === 1 && uitH.output0 && uitH.output0.dims.join(',') === '1,8,8400',
        '1 sessie, 1,8,8400', sessies + ', ' + (uitH.output0 ? uitH.output0.dims.join(',') : 'geen'));
    const w = new Worker(URL.createObjectURL(new Blob([NANO_WORKER_CODE], { type: 'application/javascript' })));
    await new Promise((ok, f) => { w.onmessage = (e) => e.data.type === 'klaar' ? ok() : f(new Error(e.data.bericht)); w.postMessage({ type: 'initialiseer', modelBuffer: k1 }, [k1]); });
    const mW = await new Promise((ok) => { w.onmessage = (e) => ok(e.data); const k = new Float32Array(px); w.postMessage({ type: 'inferentie', pixelData: k, breedte: 640, hoogte: 640, frameId: 1 }, [k.buffer]); });
    w.terminate();
    hoofdSoort = 'yolox';
    const dH = postprocessYOLO(uitH.output0.data, uitH.output0.dims), dW = postprocessYOLO(mW.data, mW.dims);
    let maxd = 0; for (let i = 0; i < uitH.output0.data.length; i++) maxd = Math.max(maxd, Math.abs(uitH.output0.data[i] - mW.data[i]));
    eis('NH3b hoofdthread en worker: dezelfde uitvoer (verschil < 1e-4) en dezelfde detecties', maxd < 1e-4 && dH.length === dW.length && dH.every((d, i) => d.klasse === dW[i].klasse && Math.abs(d.cx - dW[i].cx) < 0.01),
        'gelijk', 'max verschil ' + maxd + ', ' + dH.length + ' tegen ' + dW.length + ' detecties');

    // ═══ NH4 ═══
    let herlaad = 0; window.laadONNXModel = async () => { herlaad++; };
    hoofdPoging = 0; workerKlaar = false; yoloWorker = { terminate() {} }; modelTerugvalFout = null;
    const neeKlaar = hoofdInitFout({ type: 'fout', bericht: 'gewone fout tijdens een run' });
    const ja = hoofdInitFout({ type: 'fout', bericht: 'init: geen YOLOX-bestand (invoer x; uitvoer y)' });
    const poging1 = hoofdPoging;
    hoofdPoging = 2;   // V11.37.34: de derde stap is de laatste
    const nogEens = hoofdInitFout({ type: 'fout', bericht: 'init: weer' });
    eis('NH4 alleen een init-fout van de worker vóór "klaar" laadt het volgende pad (één keer; na het laatste pad niet meer)',
        neeKlaar === false && ja === true && herlaad === 1 && poging1 === 1 && nogEens === false && /^init/.test(modelTerugvalFout) && yoloWorker === null && modelGeladen === false,
        'false, true, 1, 1, false', [neeKlaar, ja, herlaad, poging1, nogEens, modelTerugvalFout].join(', '));
    hoofdPoging = 0;

    // ═══ NH5 ═══
    hoofdSoort = 'yolox'; const nx = [hoofdConf(), hoofdTapConf()];
    hoofdSoort = 'yolov8'; const v8 = [hoofdConf(), hoofdTapConf()];
    eis('NH5 drempels per model: Nano 0,07/0,03 (NANO_CONF/NANO_TAPCONF), YOLOv8 0,10/0,04 (CONF_DREMPEL/TAP_CONF_DREMPEL)',
        nx[0] === NANO_CONF && nx[1] === NANO_TAPCONF && v8[0] === CONF_DREMPEL && v8[1] === TAP_CONF_DREMPEL && NANO_CONF === 0.07 && CONF_DREMPEL === 0.10,
        '0.07/0.03 en 0.1/0.04', nx.join('/') + ' en ' + v8.join('/'));

    // ═══ NH6 ═══
    hoofdSoort = 'yolox'; let fout6 = null; try { vglPlan('nano'); } catch (e) { fout6 = String(e.message); }
    hoofdSoort = 'yolov8'; let fout6b = null; try { vglPlan('nano'); } catch (e) { fout6b = String(e.message); }
    eis('NH6 de Nano-schaduw start niet met Nano als hoofd (vglPlan gooit), wel met YOLOv8 als hoofd', !!fout6 && /al Nano/.test(fout6) && fout6b === null,
        'gooit / niet', (fout6 || 'geen fout') + ' / ' + (fout6b || 'geen fout'));

    // ═══ NH7 ═══
    let runs = 0;
    onnxSession = { uitgesteld: true, pad: 'x', run: async () => { runs++; return { output0: { data: new Float32Array(8), dims: [1, 8, 1] } }; } };
    yoloWorker = { postMessage() {}, terminate() {} }; workerKlaar = false; modelGeladen = true; aiBezig = false;
    const pre = window.preprocessVoorYOLO, kans = window.runIsKansloos, rs = Object.getOwnPropertyDescriptor(video, 'readyState');
    window.preprocessVoorYOLO = () => ({}); window.runIsKansloos = () => false;
    Object.defineProperty(video, 'readyState', { configurable: true, get: () => 4 });
    try { await voerAIUit(); } finally {
      window.preprocessVoorYOLO = pre; window.runIsKansloos = kans;
      if (rs) Object.defineProperty(video, 'readyState', rs); else delete video.readyState;
    }
    eis('NH7 worker bestaat maar laadt nog: voerAIUit rekent niet op de hoofdthread, en aiBezig is weer vrij', runs === 0 && aiBezig === false, '0 runs, vrij', runs + ' runs, aiBezig ' + aiBezig);
  } catch (e) {
    eis('NH crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    window.fetch = bew.fetch; ort.InferenceSession.create = bew.create; window.laadONNXModel = bew.laad;
    hoofdSoort = bew.soort; hoofdPoging = bew.poging; yoloWorker = bew.yw; workerKlaar = bew.wk; modelGeladen = bew.mg; onnxSession = bew.os; modelTerugvalFout = bew.tf;
    if (bew.item === null) localStorage.removeItem('sl_hoofdmodel'); else localStorage.setItem('sl_hoofdmodel', bew.item);
    aiBezig = false;
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}
