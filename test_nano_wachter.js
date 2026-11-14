// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nano_wachter.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.36 (was V11.37.34): Nano is het enige model. Start het niet,
//  dan de eerlijke faalmelding: korte tekst, een herlaadknop, een regel in
//  sl_modellog. Geen ander model, geen stille hoofdthread, geen lader die
//  blijft draaien.
//
//  NW1  een worker die nooit meldt: na 20 s gestopt, de faalmelding, regel in
//       sl_modellog, en daarna rekent er NIETS (ook niet de hoofdthread)
//  NW2  een worker die een fout geeft: 'init' = de faalmelding (geen volgend
//       pad); een crash vóór "klaar" = de faalmelding; een crash ná "klaar" =
//       geen melding, wel een regel; een gewone fout laat de wachter staan
//  NW3  een worker die "klaar" meldt: vóór 20 s blijft hij; ná 20 s verandert
//       een laat bericht niets meer
//  NW4  Nano niet te halen: de faalmelding, en de app vraagt geen ander bestand
//  NW5  de knop "Herladen" herlaadt; de melding staat er één keer
//  NW6  vastgezet in de code: geen YOLOv8n meer
//
//  DRAAIEN: zoals de andere toetsen; testNanoWachter().
// ═══════════════════════════════════════════════════════════════
async function testNanoWachter() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const bew = { soort: hoofdSoort, poging: hoofdPoging, fetch: window.fetch, Worker: window.Worker, st: window.setTimeout, ct: window.clearTimeout,
                yw: yoloWorker, wk: workerKlaar, mg: modelGeladen, os: onnxSession, tf: modelTerugvalFout, lab: sModelLabel.textContent, kl: sModelLabel.style.color, pc: pAI.className, pt: pAIT.textContent,
                toast: window.toonToast, ml: localStorage.getItem(MODELLOG_SLEUTEL), buf: new Map(hoofdBuffers), laad: window.laadONNXModel, faalt: modelFaalt, herlaad: window.modelFaalHerlaad };
  let timers = [], toast = [], nieuw = [], gevraagd = [], weigerPad = () => false;
  const tik = 90000000;
  const melding = () => document.getElementById('model-faal');
  const opzet = () => {
    timers = []; toast = []; nieuw = []; gevraagd = []; hoofdBuffers.clear(); hoofdPoging = 0; modelTerugvalFout = null; yoloWorker = null; workerKlaar = false;
    modelFaalt = false; const m = melding(); if (m) m.remove();
    window.Worker = function () { const w = { berichten: [], dood: false, postMessage(m) { this.berichten.push(m.type); }, terminate() { this.dood = true; } }; nieuw.push(w); return w; };
    window.fetch = async (pad) => { gevraagd.push(String(pad)); if (weigerPad(String(pad))) return { ok: false, status: 404 }; return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(4000) }; };
    window.setTimeout = function (f, ms) { if (ms === HOOFD_WORKER_WACHT_MS) { const t = { id: tik + timers.length, f, weg: false }; timers.push(t); return t.id; } return bew.st.apply(window, arguments); };
    window.clearTimeout = function (id) { const t = timers.find(x => x.id === id); if (t) { t.weg = true; return; } return bew.ct.apply(window, arguments); };
    window.toonToast = (t) => { toast.push(t); };
  };
  const vuur = () => { const t = timers.filter(x => !x.weg).pop(); if (t) { t.weg = true; t.f(); } return !!t; };
  const open = () => timers.filter(x => !x.weg).length;
  const log = () => { try { return JSON.parse(localStorage.getItem(MODELLOG_SLEUTEL) || '[]').filter(r => r.terug === 1).pop() || {}; } catch (e) { return {}; } };
  const wacht = (ms) => new Promise(r => bew.st.call(window, r, ms));
  const faalZichtbaar = () => { const m = melding(); return !!m && m.textContent.includes('Detectie kon niet starten. Herlaad de app.') && !!m.querySelector('button') && m.querySelector('button').textContent === 'Herladen'; };
  try {
    eis('NW0 de wachttijd is 20 s', HOOFD_WORKER_WACHT_MS === 20000, 20000, HOOFD_WORKER_WACHT_MS);
    // ═══ NW1 ═══
    opzet(); await laadONNXModel();
    const w1 = nieuw[0];
    eis('NW1a de worker start, de wachter loopt (precies één), nog geen melding', !!w1 && yoloWorker === w1 && workerKlaar === false && open() === 1 && w1.berichten[0] === 'initialiseer' && !melding(), 'worker, 1 wachter', [!!w1, open(), !!melding()].join(', '));
    vuur(); await wacht(30);
    eis('NW1b na 20 s: worker gestopt, geen sessie, geen model geladen', w1.dood === true && yoloWorker === null && workerKlaar === false && onnxSession === null && modelGeladen === false, 'gestopt, niets', [w1.dood, yoloWorker, onnxSession, modelGeladen].join(', '));
    eis('NW1c de faalmelding: tekst, knop Herladen, label en pil oranje, geen "zonder worker"', faalZichtbaar() && /Detectie kon niet starten/.test(sModelLabel.textContent) && pAI.className === 'pill-dot o' && pAIT.textContent === 'Geen detectie' && !/zonder worker/.test(sModelLabel.textContent), 'melding', kort([melding() && melding().textContent, sModelLabel.textContent, pAIT.textContent]));
    const r1 = log();
    eis('NW1d regel in sl_modellog: pad Nano, terug 1, "faal: ... 20 s"', r1.pad === './model/yolox_nano.onnx' && r1.terug === 1 && /^faal: .*20 s/.test(r1.fout || ''), 'faal-regel', kort(r1));
    let gerekend = false;
    const pre = window.preprocessVoorYOLO; window.preprocessVoorYOLO = () => { gerekend = true; return {}; };
    try { await voerAIUit(); } finally { window.preprocessVoorYOLO = pre; }
    eis('NW1e daarna rekent er niets (geen stille hoofdthread)', gerekend === false && aiBezig === false, 'niets', String(gerekend));

    // ═══ NW2 ═══
    opzet(); await laadONNXModel();
    const w2 = nieuw[0];
    let herlaad = 0; const laadBew = window.laadONNXModel; window.laadONNXModel = async () => { herlaad++; };
    w2.onmessage({ data: { type: 'fout', bericht: 'init: geen YOLOX-bestand' } });
    window.laadONNXModel = laadBew;
    eis('NW2a een init-fout: worker weg, GEEN volgend pad, de faalmelding met de reden in de log', w2.dood === true && herlaad === 0 && hoofdPoging === 0 && faalZichtbaar() && open() === 0 && /^faal: init: geen YOLOX/.test(log().fout || ''), 'faal, geen herlaad', [w2.dood, herlaad, hoofdPoging, open(), log().fout].join(', '));
    opzet(); await laadONNXModel();
    const w3 = nieuw[0]; w3.onerror(); await wacht(10);
    eis('NW2b een crash vóór "klaar": de faalmelding, de wachter weg', yoloWorker === null && faalZichtbaar() && open() === 0 && /^faal: worker-fout/.test(log().fout || ''), 'faal', [yoloWorker, open(), log().fout].join(', '));
    opzet(); await laadONNXModel();
    const w3b = nieuw[0]; w3b.onmessage({ data: { type: 'klaar' } }); w3b.onerror(); await wacht(10);
    eis('NW2c een crash ná "klaar" (tijdens het rijden): geen faalmelding, wel een regel; Nano blijft (hoofdthread)', yoloWorker === null && !melding() && !!onnxSession && /worker viel weg/.test(log().fout || ''), 'regel, geen melding', [!!melding(), !!onnxSession, log().fout].join(', '));
    opzet(); await laadONNXModel();
    const w4 = nieuw[0]; w4.onmessage({ data: { type: 'fout', bericht: 'run: iets' } });
    const blijft = yoloWorker === w4 && open() === 1 && !melding(); vuur(); await wacht(10);
    eis('NW2d een gewone fout vóór "klaar": de worker blijft nog; na 20 s de faalmelding', blijft && w4.dood === true && yoloWorker === null && faalZichtbaar(), 'blijft, dan faal', [blijft, w4.dood, !!melding()].join(', '));

    // ═══ NW3 ═══
    opzet(); await laadONNXModel();
    const w5 = nieuw[0]; w5.onmessage({ data: { type: 'klaar' } });
    eis('NW3a "klaar" vóór 20 s: de wachter is weg, de worker blijft, geen melding', open() === 0 && workerKlaar === true && yoloWorker === w5 && w5.dood === false && !melding() && pAIT.textContent === 'Nano', 'klaar', [open(), workerKlaar, !!melding(), pAIT.textContent].join(', '));
    opzet(); await laadONNXModel();
    const w6 = nieuw[0]; vuur(); await wacht(10);
    w6.onmessage({ data: { type: 'klaar' } }); w6.onmessage({ data: { type: 'fout', bericht: 'init: te laat' } });
    eis('NW3b "klaar" of een fout ná 20 s: niets verandert (geen worker terug, de melding blijft één keer)', workerKlaar === false && yoloWorker === null && document.querySelectorAll('#model-faal').length === 1, 'niets', [workerKlaar, yoloWorker, document.querySelectorAll('#model-faal').length].join(', '));

    // ═══ NW4 ═══
    opzet(); weigerPad = () => true; onnxSession = null; await laadONNXModel(); weigerPad = () => false;
    eis('NW4a Nano niet te halen: de faalmelding, geen sessie, geen worker', faalZichtbaar() && onnxSession === null && nieuw.length === 0 && /^faal: HTTP 404/.test(log().fout || ''), 'faal', kort([!!melding(), onnxSession, nieuw.length, log().fout]));
    eis('NW4b de app vroeg alleen ./model/yolox_nano.onnx (geen YOLOv8n-bestand)', gevraagd.length === 1 && gevraagd[0] === './model/yolox_nano.onnx', 'alleen Nano', gevraagd.join(','));
    opzet(); await laadONNXModel();
    eis('NW4c niets stuk: Nano, pil "Nano", geen melding', !!onnxSession && onnxSession.pad === './model/yolox_nano.onnx' && hoofdSoort === 'yolox' && pAIT.textContent === 'Nano' && !melding(), 'nano', kort([onnxSession && onnxSession.pad, hoofdSoort, pAIT.textContent]));

    // ═══ NW5 ═══
    opzet(); let herladen = 0; window.modelFaalHerlaad = () => { herladen++; };
    modelFaal('toets'); modelFaal('toets twee keer');
    const knop = document.getElementById('model-faal-herlaad'); if (knop) knop.click();
    eis('NW5a de knop Herladen herlaadt (één klik, één herlaad); de melding staat er één keer', herladen === 1 && document.querySelectorAll('#model-faal').length === 1, '1, 1', [herladen, document.querySelectorAll('#model-faal').length].join(', '));
    const r5 = knop ? knop.getBoundingClientRect() : { height: 0 };
    eis('NW5b de knop is minstens 44 px hoog', knop && parseFloat(knop.style.minHeight) >= 44, '>= 44', knop && knop.style.minHeight);

    // ═══ NW6 ═══
    const bron = document.documentElement.innerHTML;
    eis('NW6a geen YOLOv8n meer: alleen Nano in de paden en soorten', hoofdPaden().join(',') === './model/yolox_nano.onnx' && Object.keys(MODEL_PADEN).join(',') === './model/yolox_nano.onnx' && Object.keys(MODEL_SOORTEN).join(',') === 'yolox', 'alleen Nano', hoofdPaden().join(',') + ' | ' + Object.keys(MODEL_SOORTEN).join(','));
    eis('NW6b geen stille terugzetkeuze (sl_hoofdmodel) en geen YOLOv8-worker meer', typeof HOOFD_PADEN_V8 === 'undefined' && typeof YOLO_WORKER_CODE === 'undefined' && !/getItem\('sl_hoofdmodel'\)/.test(String(hoofdPaden)), 'weg', [typeof HOOFD_PADEN_V8, typeof YOLO_WORKER_CODE].join(', '));
  } catch (e) {
    eis('NW crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    hoofdWachterStop();
    window.fetch = bew.fetch; window.Worker = bew.Worker; window.setTimeout = bew.st; window.clearTimeout = bew.ct; window.toonToast = bew.toast; window.laadONNXModel = bew.laad; window.modelFaalHerlaad = bew.herlaad;
    hoofdSoort = bew.soort; hoofdPoging = bew.poging; yoloWorker = bew.yw; workerKlaar = bew.wk; modelGeladen = bew.mg; onnxSession = bew.os; modelTerugvalFout = bew.tf; modelFaalt = bew.faalt;
    sModelLabel.textContent = bew.lab; sModelLabel.style.color = bew.kl; pAI.className = bew.pc; pAIT.textContent = bew.pt; aiBezig = false;
    { const m = document.getElementById('model-faal'); if (m) m.remove(); }
    hoofdBuffers.clear(); for (const [k, v] of bew.buf) hoofdBuffers.set(k, v);
    if (bew.ml === null) localStorage.removeItem(MODELLOG_SLEUTEL); else localStorage.setItem(MODELLOG_SLEUTEL, bew.ml);
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}
