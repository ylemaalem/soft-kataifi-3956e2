// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nano_wachter.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.34: de wachter op de hoofd-worker en de reserveketen.
//
//  NW1  een worker die nooit meldt: na 20 s gestopt, hoofdthread neemt over,
//       regel in sl_modellog, melding in beeld, de hoofdthread rekent weer
//  NW2  een worker die een fout geeft: 'init' laadt het volgende pad, een crash
//       (onerror) valt weg zonder melding, een gewone fout laat de wachter staan
//  NW3  een worker die laat "klaar" meldt: vóór 20 s blijft hij; ná 20 s
//       verandert een laat bericht niets meer
//  NW4  de reserveketen: Nano, ./model.onnx, ./model/model.onnx, en daarna een
//       echte foutmelding
//
//  DRAAIEN: zoals de andere toetsen; testNanoWachter().
// ═══════════════════════════════════════════════════════════════
async function testNanoWachter() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const bew = { soort: hoofdSoort, poging: hoofdPoging, item: localStorage.getItem('sl_hoofdmodel'), fetch: window.fetch, Worker: window.Worker, st: window.setTimeout, ct: window.clearTimeout,
                yw: yoloWorker, wk: workerKlaar, mg: modelGeladen, os: onnxSession, tf: modelTerugvalFout, lab: sModelLabel.textContent, kl: sModelLabel.style.color, pc: pAI.className, pt: pAIT.textContent,
                toast: window.toonToast, ml: localStorage.getItem(MODELLOG_SLEUTEL), buf: new Map(hoofdBuffers), laad: window.laadONNXModel };
  let timers = [], toast = [], nieuw = [], weigerPad = () => false;
  const tik = 90000000;
  const opzet = () => {
    timers = []; toast = []; nieuw = []; hoofdBuffers.clear(); hoofdPoging = 0; modelTerugvalFout = null; yoloWorker = null; workerKlaar = false; localStorage.removeItem('sl_hoofdmodel');
    window.Worker = function () { const w = { berichten: [], dood: false, postMessage(m) { this.berichten.push(m.type); }, terminate() { this.dood = true; } }; nieuw.push(w); return w; };
    window.fetch = async (pad) => { if (weigerPad(String(pad))) return { ok: false, status: 404 }; return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4000) }; };
    window.setTimeout = function (f, ms) { if (ms === HOOFD_WORKER_WACHT_MS) { const t = { id: tik + timers.length, f, weg: false }; timers.push(t); return t.id; } return bew.st.apply(window, arguments); };
    window.clearTimeout = function (id) { const t = timers.find(x => x.id === id); if (t) { t.weg = true; return; } return bew.ct.apply(window, arguments); };
    window.toonToast = (t) => { toast.push(t); };
  };
  const vuur = () => { const t = timers.filter(x => !x.weg).pop(); if (t) { t.weg = true; t.f(); } return !!t; };
  const open = () => timers.filter(x => !x.weg).length;
  const log = () => { try { return JSON.parse(localStorage.getItem(MODELLOG_SLEUTEL) || '[]').filter(r => r.terug === 1).pop() || {}; } catch (e) { return {}; } };
  const wacht = (ms) => new Promise(r => bew.st.call(window, r, ms));
  try {
    eis('NW0 de wachttijd is 20 s', HOOFD_WORKER_WACHT_MS === 20000, 20000, HOOFD_WORKER_WACHT_MS);
    // ═══ NW1 ═══
    opzet(); await laadONNXModel();
    const w1 = nieuw[0];
    eis('NW1a de worker start, de wachter loopt (precies één)', !!w1 && yoloWorker === w1 && workerKlaar === false && open() === 1 && w1.berichten[0] === 'initialiseer', 'worker, 1 wachter', [!!w1, open()].join(', '));
    vuur(); await wacht(30);
    eis('NW1b na 20 s: worker gestopt, geen worker meer, de sessie blijft', w1.dood === true && yoloWorker === null && workerKlaar === false && !!onnxSession && onnxSession.uitgesteld === true, 'gestopt', [w1.dood, yoloWorker, workerKlaar].join(', '));
    eis('NW1c melding in beeld: label oranje, pil oranje met waarschuwing, toast', /zonder worker/.test(sModelLabel.textContent) && /oranje/.test(sModelLabel.style.color) && pAI.className === 'pill-dot o' && /Nano/.test(pAIT.textContent) && /⚠/.test(pAIT.textContent) && toast.length === 1, 'melding', kort([sModelLabel.textContent, pAI.className, pAIT.textContent, toast]));
    const r1 = log();
    eis('NW1d regel in sl_modellog: pad, terug 1, de reden', r1.pad === './model/yolox_nano.onnx' && r1.terug === 1 && /20 s/.test(r1.fout || ''), 'pad, 1, reden', kort(r1));
    let runs = 0;
    onnxSession.run = async () => { runs++; return { output0: { data: new Float32Array(8), dims: [1, 8, 1] } }; };
    modelGeladen = true; aiBezig = false;
    const pre = window.preprocessVoorYOLO, kans = window.runIsKansloos, rs = Object.getOwnPropertyDescriptor(video, 'readyState'), verw = window._verwerkWorkerResultaat;
    window.preprocessVoorYOLO = () => ({}); window.runIsKansloos = () => false; window._verwerkWorkerResultaat = () => {};
    Object.defineProperty(video, 'readyState', { configurable: true, get: () => 4 });
    try { await voerAIUit(); } finally { window.preprocessVoorYOLO = pre; window.runIsKansloos = kans; window._verwerkWorkerResultaat = verw; if (rs) Object.defineProperty(video, 'readyState', rs); else delete video.readyState; }
    eis('NW1e daarna rekent de hoofdthread-route (één run, aiBezig vrij)', runs === 1 && aiBezig === false, '1, vrij', runs + ', ' + aiBezig);

    // ═══ NW2 ═══
    opzet(); await laadONNXModel();
    const w2 = nieuw[0];
    let herlaad = 0; const laadBew = window.laadONNXModel; window.laadONNXModel = async () => { herlaad++; };
    w2.onmessage({ data: { type: 'fout', bericht: 'init: geen YOLOX-bestand' } });
    window.laadONNXModel = laadBew;
    vuur(); await wacht(10);
    eis('NW2a een init-fout: worker weg, het volgende pad, en de oude wachter doet niets (geen melding)', w2.dood === true && herlaad === 1 && hoofdPoging === 1 && toast.length === 0, '1 herlaad, geen melding', [herlaad, hoofdPoging, toast.length].join(', '));
    opzet(); await laadONNXModel();
    const w3 = nieuw[0]; w3.onerror(); vuur(); await wacht(10);
    eis('NW2b een crash (onerror): worker weg, de wachter meldt niets', yoloWorker === null && toast.length === 0 && w3.dood === false, 'geen melding', [yoloWorker, toast.length].join(', '));
    opzet(); await laadONNXModel();
    const w4 = nieuw[0]; w4.onmessage({ data: { type: 'fout', bericht: 'run: iets' } });
    const blijft = yoloWorker === w4 && open() === 1; vuur(); await wacht(10);
    eis('NW2c een gewone fout vóór "klaar": de worker blijft nog; na 20 s neemt de wachter het over', blijft && w4.dood === true && yoloWorker === null && toast.length === 1, 'blijft, dan gestopt', [blijft, w4.dood, toast.length].join(', '));

    // ═══ NW3 ═══
    opzet(); await laadONNXModel();
    const w5 = nieuw[0]; w5.onmessage({ data: { type: 'klaar' } });
    eis('NW3a "klaar" vóór 20 s: de wachter is weg, de worker blijft, geen melding', open() === 0 && workerKlaar === true && yoloWorker === w5 && w5.dood === false && toast.length === 0 && !/zonder worker/.test(sModelLabel.textContent), 'klaar', [open(), workerKlaar, toast.length].join(', '));
    opzet(); await laadONNXModel();
    const w6 = nieuw[0]; vuur(); await wacht(10);
    const pog = hoofdPoging; let her2 = 0; const laadB2 = window.laadONNXModel; window.laadONNXModel = async () => { her2++; };
    w6.onmessage({ data: { type: 'klaar' } }); w6.onmessage({ data: { type: 'fout', bericht: 'init: te laat' } });
    window.laadONNXModel = laadB2;
    eis('NW3b "klaar" of een fout ná 20 s: niets verandert (geen worker terug, geen volgend pad)', workerKlaar === false && yoloWorker === null && hoofdPoging === pog && her2 === 0, 'niets', [workerKlaar, yoloWorker, hoofdPoging, her2].join(', '));

    // ═══ NW4 ═══
    const keten = async (weiger) => { opzet(); weigerPad = weiger; onnxSession = null; await laadONNXModel(); const u = { pad: onnxSession && onnxSession.pad, soort: hoofdSoort, label: sModelLabel.textContent, pil: pAIT.textContent, reserve: modelTerugvalFout }; weigerPad = () => false; return u; };
    const k0 = await keten(() => false);
    eis('NW4a niets stuk: Nano', k0.pad === './model/yolox_nano.onnx' && k0.soort === 'yolox' && k0.pil === 'Nano' && !k0.reserve, 'nano', kort(k0));
    const k1 = await keten(p => /yolox_nano/.test(p));
    eis('NW4b Nano niet te halen: ./model.onnx, zichtbaar als reserve', k1.pad === './model.onnx' && k1.soort === 'yolov8' && k1.pil === 'Reserve' && /Reservemodel/.test(k1.label), 'model.onnx', kort(k1));
    const k2 = await keten(p => p !== './model/model.onnx');
    eis('NW4c ook ./model.onnx niet: ./model/model.onnx', k2.pad === './model/model.onnx' && k2.soort === 'yolov8' && k2.pil === 'Reserve', 'model/model.onnx', kort(k2));
    const k3 = await keten(() => true);
    eis('NW4d niets te halen: een echte foutmelding, geen sessie', !k3.pad && /Model laadde niet/.test(k3.label), 'fout', kort(k3));
    hoofdPoging = 0; const lijst = hoofdPaden().join(',');
    localStorage.setItem('sl_hoofdmodel', 'yolov8'); const lijst8 = hoofdPaden().join(','); localStorage.removeItem('sl_hoofdmodel');
    eis('NW4e de lijst: drie stappen; de terugzetkeuze sl_hoofdmodel is ongewijzigd', lijst === './model/yolox_nano.onnx,./model.onnx,./model/model.onnx' && lijst8 === './model.onnx,./model/model.onnx', '3 / 2', lijst + ' | ' + lijst8);
  } catch (e) {
    eis('NW crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    hoofdWachterStop();
    window.fetch = bew.fetch; window.Worker = bew.Worker; window.setTimeout = bew.st; window.clearTimeout = bew.ct; window.toonToast = bew.toast; window.laadONNXModel = bew.laad;
    hoofdSoort = bew.soort; hoofdPoging = bew.poging; yoloWorker = bew.yw; workerKlaar = bew.wk; modelGeladen = bew.mg; onnxSession = bew.os; modelTerugvalFout = bew.tf;
    sModelLabel.textContent = bew.lab; sModelLabel.style.color = bew.kl; pAI.className = bew.pc; pAIT.textContent = bew.pt; aiBezig = false;
    hoofdBuffers.clear(); for (const [k, v] of bew.buf) hoofdBuffers.set(k, v);
    if (bew.item === null) localStorage.removeItem('sl_hoofdmodel'); else localStorage.setItem('sl_hoofdmodel', bew.item);
    if (bew.ml === null) localStorage.removeItem(MODELLOG_SLEUTEL); else localStorage.setItem(MODELLOG_SLEUTEL, bew.ml);
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}
