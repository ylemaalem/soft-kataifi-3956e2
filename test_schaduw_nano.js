// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_schaduw_nano.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.26: YOLOX-Nano als schaduw naast het huidige model.
//
//  N1  KERN: met en zonder Nano dezelfde uitkomst. Twee verse iframes draaien
//      hetzelfde scenario (twee bedachte lichten: groen-rood-groen met gezien
//      begin, daarna rood zonder gezien begin met stilstand en wegrijden), met
//      een vaste klok. Vergeleken: elke sleutel die het scenario schreef
//      (leerdata, klok, richting, detlog, passagelog, m5, opslaglog ...), op
//      sl_nano_* en sl_modelvgl na, en de toestand: fase, countdown, gekozen
//      box, sticky, m5, detLogBest. Vier varianten met Nano: B voor A, B na A,
//      een fout in de Nano-code, en een vol quotum voor de Nano-sleutels.
//      N1f (aanvulling): in de BRON staat elke aanroep van een nano*-functie
//      vanuit het hoofdpad (laadONNXModel, voerAIUit, vglKoppel en
//      vglStartSchaduw, dat synchroon binnen de try van laadONNXModel loopt)
//      in een eigen try. N1g: de ECHTE onmessage van de hoofdworker met een
//      nanoNaHoofd die gooit: niets ontsnapt, aiBezig gaat uit, de verwerking
//      en de telling draaien. N1h: startVglWorker met een nanoBegin die gooit:
//      niets ontsnapt naar laadONNXModel, het hoofdmodel blijft staan.
//  V11.37.27: alleen nog de stand nano. N2a/N2b (vglPostprocessVeilig), N4c, N6h en
//      N10c zijn daarop aangepast. Nieuw: N13 een oude stand (ort130) start niets en
//      zegt het; N14 een nagespeelde rit van 10 minuten: elke Nano-sleutel en
//      sl_modelvgl minder dan 2 schrijfacties per minuut, s en v als teller per episode.
//      N15 pagehide alleen (zonder verbergen) schrijft de open episode, de open reeks,
//      sl_nano_meta en sl_modelvgl; verbergen zonder nieuwe frames schrijft niets; een rit
//      met elke ~2 minuten verbergen blijft onder 2 schrijfacties per minuut per sleutel.
//  N12 nanoBegin zet de visibilitychange-luisteraar één keer, ook bij een
//      tweede start
//  N2 de reparatie: vglPostprocessVeilig zet detLogBest terug; postprocessNano
//      raakt debugLaatste* en detLogBest niet, en geeft met de drempels en de
//      toestand van het hoofdpad precies wat postprocessYOLO geeft (300 keer)
//  N3  de drempels: losse instellingen sl_nano_conf (0,07) en sl_nano_tapconf
//      (0,03), onzin valt terug op de standaard, en ze werken
//  N4  KERN: elk modelpad met zijn eigen soort. Alle .onnx-paden in index.html
//      staan in MODEL_PADEN; vglPlan geeft per stand de juiste worker; een
//      YOLOv8-bestand krijgt nooit de Nano-worker, ook niet in de motorproef
//  N5  de workers zelf, in een zandbak met een nep-ORT: de Nano-worker weigert
//      een YOLOv8-bestand, voert BGR 0..255 en zet (1,N,9) om naar (1,8,N) met
//      object x klasse; de YOLO-worker geeft op een YOLOX-bestand een fout
//  N6  starten en stoppen (nep-fetch, nep-worker): het pad, de worker, geen
//      terugval, en wat er in beeld komt; met de schakelaar uit niets
//  N7  het oordeel per episode (nanoEpEvalueer) op bedachte frames: K1-K7
//  N8  de ringen: grootte per regel, maximum, ASCII, en een vol quotum: de
//      schaduw stopt, er gaat niets weg, de app merkt het niet
//  N9  de referentieplek per frame: tik, dan de box van de app, dan de laatste
//      plek (2 s); een lamp elders telt als K7
//  N10 de teksten: 'Model laden', de modelnaam uit de tabel, 'B = ...' per
//      stand, de tussenstand zonder oordeel, versie en copyright
//  N11 ECHT: in een iframe met de schakelaar aan en de stand nano laadt de
//      echte worker het echte bestand; een getekende rode lamp komt terug als
//      rood op de goede plek; het merkteken zegt 'TEST · Nano'
//
//  Alle plekken en nummers zijn bedacht: een basispunt (52.0000, 5.0000),
//  lichtnummers vanaf 930000000, een vaste nepklok.
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_schaduw_nano.js';
//      document.head.appendChild(s);
//      s.onload = () => testSchaduwNano().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe ──
async function schaduwNanoBinnen(soort, opt) {
  opt = opt || {};
  window.toonToast = () => {};
  for (let i = 0; i < 150 && !modelGeladen && !/niet|Model laadde/.test(sModelLabel.textContent); i++) await new Promise(r => setTimeout(r, 100));

  if (soort === 'echt') {
    // De schakelaar staat aan (door de ouder gezet vóór het laden): de app
    // heeft zelf startVglWorker gedraaid. Wachten tot de Nano-worker klaar is.
    for (let i = 0; i < 400 && !(vglWorker && vglWorkerKlaar) && nanoStaat.label !== 'Nano uit'; i++) await new Promise(r => setTimeout(r, 100));
    const uit = { aan: MODELVGL_AAN, model: MODELVGL_MODEL, klaar: !!(vglWorker && vglWorkerKlaar), label: nanoStaat.label,
                  badge: (document.querySelector('#d-test .mv-test-badge') || {}).textContent || null,
                  versieBadge: (document.querySelector('#s-versie .mv-test-badge') || {}).textContent || null };
    if (!uit.klaar) return uit;
    const c = document.createElement('canvas'); c.width = 640; c.height = 640; const x = c.getContext('2d');
    x.fillStyle = 'rgb(114,114,114)'; x.fillRect(0, 0, 640, 640); x.fillStyle = '#222'; x.fillRect(300, 200, 40, 100);
    x.fillStyle = 'rgb(255,30,30)'; x.beginPath(); x.arc(320, 220, 14, 0, 7); x.fill();
    x.fillStyle = '#333'; x.beginPath(); x.arc(320, 280, 14, 0, 7); x.fill();
    const id = x.getImageData(0, 0, 640, 640).data, S = 640 * 640, f = new Float32Array(3 * S);
    for (let i = 0; i < S; i++) { f[i] = id[i * 4] / 255; f[S + i] = id[i * 4 + 1] / 255; f[2 * S + i] = id[i * 4 + 2] / 255; }
    lbScale = 1; lbPadX = 0; lbPadY = 0; cropRegio = null;
    const fid = 777001;
    vglNaarB.add(fid); nanoNoteerContext(fid); vglBezig = true; vglStartTijd = Date.now();
    vglWorker.postMessage({ type: 'inferentie', pixelData: f, breedte: 640, hoogte: 640, frameId: fid }, [f.buffer]);
    for (let i = 0; i < 300 && !vglOpenB.has(fid); i++) await new Promise(r => setTimeout(r, 100));
    const b = vglOpenB.get(fid);
    uit.b = b ? { ms: b.ms, kl: b.kl, dets: b.nano.dets.map(d => ({ k: d.k, s: Math.round(d.s * 1000) / 1000, cx: Math.round(d.cx), cy: Math.round(d.cy), w: Math.round(d.w), h: Math.round(d.h) })), lu: b.nano.lu } : null;
    uit.detLogBestOnaangeroerd = (detLogBest === null);

    // N1g: de ECHTE onmessage van de hoofdworker, met een nanoNaHoofd die gooit.
    const ankerA = (kl, s, cx, cy, w, h) => { const d = new Float32Array(8 * 8400); const i = 4000; d[i] = cx; d[8400 + i] = cy; d[2 * 8400 + i] = w; d[3 * 8400 + i] = h; d[(4 + kl) * 8400 + i] = s; return d; };
    const echtNa = window.nanoNaHoofd, echtVerw = window._verwerkWorkerResultaat, echtMin = window.minStatRun;
    const hoofd = async (gooi) => {
      const r = { gooi, nanoAangeroepen: 0, verwerkt: 0, geteld: 0, ontsnapt: null };
      window.nanoNaHoofd = function () { r.nanoAangeroepen++; if (gooi) throw new Error('nep: fout in nanoNaHoofd'); return echtNa.apply(this, arguments); };
      window._verwerkWorkerResultaat = function () { r.verwerkt++; return echtVerw.apply(this, arguments); };
      window.minStatRun = function () { r.geteld++; return echtMin.apply(this, arguments); };
      try {
        aiBezig = true; yoloWorker._startTijd = Date.now();
        const fid = aiVangnetGrens + 5000 + (gooi ? 1 : 2);
        try { yoloWorker.onmessage({ data: { type: 'resultaat', data: ankerA(0, 0.85, 320, 200, 20, 48), dims: [1, 8, 8400], frameId: fid } }); }
        catch (e) { r.ontsnapt = String((e && e.message) || e); }
        r.aiBezig = aiBezig; r.workerKlaar = workerKlaar; r.yoloWorker = !!yoloWorker; r.openA = vglOpenA.has(fid);
      } finally {
        window.nanoNaHoofd = echtNa; window._verwerkWorkerResultaat = echtVerw; window.minStatRun = echtMin;
      }
      return r;
    };
    uit.hoofdGooit = await hoofd(true);
    uit.hoofdGewoon = await hoofd(false);

    // N1h: startVglWorker (zoals aan het eind van laadONNXModel) met een nanoBegin die gooit.
    const echtBegin = window.nanoBegin;
    const h = { ontsnapt: null };
    window.nanoBegin = () => { throw new Error('nep: fout in nanoBegin'); };
    try {
      vglLegStil();
      try { startVglWorker(); } catch (e) { h.ontsnapt = String((e && e.message) || e); }
      h.label = nanoStaat.label; h.gestopt = nanoStaat.gestopt; h.schaduw = !!vglWorker;
      h.yoloWorker = !!yoloWorker; h.workerKlaar = workerKlaar;
    } finally { window.nanoBegin = echtBegin; }
    uit.beginGooit = h;
    return uit;
  }

  if (soort === 'oud') {   // V11.37.27: N13
    await new Promise(r => setTimeout(r, 1500));
    return { model: MODELVGL_MODEL, oud: MODELVGL_OUDE_STAND, aan: MODELVGL_AAN, worker: !!vglWorker, actief: nanoStaat.actief,
             geladen: performance.getEntriesByType('resource').map(e => e.name).filter(n => /model\/(yolox_nano|model|dfine-n)\.onnx/.test(n)),
             badge: (document.querySelector('#d-test .mv-test-badge') || {}).textContent || null,
             versieBadge: (document.querySelector('#s-versie .mv-test-badge') || {}).textContent || null,
             tekst: mvSamenvattingTekst(), console: modelVergelijking(), meta: localStorage.getItem('sl_nano_meta') };
  }

  if (soort === 'rit10') {   // V11.37.27: N14, 1500 frames van 0,4 s langs 10 bedachte lichten
    const echtNow = Date.now, echtPerf = performance.now.bind(performance);
    let T = 1000000000000 + 10 * 3600e3, P = 500000;
    lusGeneratie++;
    Date.now = () => T; performance.now = () => P;
    const LAT = 52.0, LON = 5.0;
    const anker = (kl, s, cx, cy, w, h) => { const d = new Float32Array(8 * 8400); const i = 4000; d[i] = cx; d[8400 + i] = cy; d[2 * 8400 + i] = w; d[3 * 8400 + i] = h; d[(4 + kl) * 8400 + i] = s; return d; };
    const plan = [];
    for (let l = 0; l < 10; l++) {
      for (let i = 0; i < 20; i++) plan.push([opt.N + l, l, 'g', 30, 150 - i * 4]);
      for (let i = 0; i < 60; i++) plan.push([opt.N + l, l, 'r', i < 5 ? 10 : 0, i < 5 ? 70 - i * 10 : 20]);
      for (let i = 0; i < 30; i++) plan.push([opt.N + l, l, 'g', i < 4 ? 0 : 15 + i, Math.max(1, 20 - i)]);
      for (let i = 0; i < 40; i++) plan.push([null, l, null, 40, null]);
    }
    const tel = {}; const echtSet = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { const x = String(k); if (x.startsWith('sl_nano_') || x === 'sl_modelvgl') tel[x] = (tel[x] || 0) + 1; return echtSet.call(this, k, v); };
    let fout = null;
    try {
      nanoBegin();
      plan.forEach(([licht, l, kleur, kmh, af], f) => {
        T += 400; P += 400; snelheidKmh = kmh;
        if (licht == null) { if (dichtstbijOSM) { dichtstbijOSM = null; passageTik(LAT + 0.01 * l + 0.002, LON); } passageTik(LAT + 0.01 * l + 0.003 + f * 1e-6, LON); tickCd(); return; }
        const lat = LAT + 0.01 * l;
        dichtstbijOSM = { id: licht, lat, lon: LON, afstand: Math.max(1, af), naam: 'TEST' };
        passageTik(lat - Math.max(1, af) / 111320, LON);
        detLogAfst = Math.max(1, af); detLogSkip = false; detLogRatio = null;
        const kl = kleur === 'r' ? 0 : 1, fid = 300000 + f;
        try { vglNaarB.add(fid); nanoNoteerContext(fid); } catch (_) {}
        const bKl = (f % 7 === 3) ? 1 - kl : kl;
        const B = (f % 9 === 4) ? new Float32Array(8 * 8400) : anker(bKl, 0.6, 321, 201, 19, 47);
        if (f % 11 === 5) { B[5000] = 100; B[8400 + 5000] = 100; B[2 * 8400 + 5000] = 12; B[3 * 8400 + 5000] = 30; B[4 * 8400 + 5000] = 0.5; }
        const dets = postprocessYOLO(anker(kl, 0.85, 320, 200, 20, 48), [1, 8, 8400]);
        _verwerkWorkerResultaat(dets);
        try { nanoNaHoofd(fid, 300, dets); } catch (_) {}
        try { nanoSchaduwResultaat({ frameId: fid, data: B, dims: [1, 8, 8400], lu: 40 }, 120); } catch (_) {}
        verwerkDetecties(); tickCd();
      });
      T += 30000; P += 30000; dichtstbijOSM = null;
      try { nanoEpSluit(); nanoVsSchrijf(); nanoBewaarSamen(true); } catch (_) {}
    } catch (e) { fout = String((e && e.stack) || e).slice(0, 300); }
    finally { Storage.prototype.setItem = echtSet; Date.now = echtNow; performance.now = echtPerf; }
    const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    return { fout, minuten: (plan.length * 0.4 + 30) / 60, tel, ep: lees(NANO_EP_SLEUTEL), vs: lees(NANO_VS_SLEUTEL), meta: lees(NANO_META_SLEUTEL), vgl: lees('sl_modelvgl') };
  }

  if (soort === 'bergop') {   // V11.37.27: N15, wegschrijven bij pagehide en visibilitychange
    const echtNow = Date.now, echtPerf = performance.now.bind(performance);
    let T = 1000000000000 + 10 * 3600e3, P = 500000;
    lusGeneratie++;
    Date.now = () => T; performance.now = () => P;
    const LAT = 52.0, LON = 5.0;
    const anker = (kl, s, cx, cy, w, h) => { const d = new Float32Array(8 * 8400); const i = 4000; d[i] = cx; d[8400 + i] = cy; d[2 * 8400 + i] = w; d[3 * 8400 + i] = h; d[(4 + kl) * 8400 + i] = s; return d; };
    let f = 0;
    const frame = (licht, l, kleur, kmh, af) => {
      T += 400; P += 400; f++; snelheidKmh = kmh;
      if (licht == null) { if (dichtstbijOSM) { dichtstbijOSM = null; passageTik(LAT + 0.01 * l + 0.002, LON); } passageTik(LAT + 0.01 * l + 0.003 + f * 1e-6, LON); tickCd(); return; }
      const lat = LAT + 0.01 * l;
      dichtstbijOSM = { id: licht, lat, lon: LON, afstand: Math.max(1, af), naam: 'TEST' };
      passageTik(lat - Math.max(1, af) / 111320, LON);
      detLogAfst = Math.max(1, af); detLogSkip = false; detLogRatio = null;
      const kl = kleur === 'r' ? 0 : 1, fid = 400000 + f;
      try { vglNaarB.add(fid); nanoNoteerContext(fid); } catch (_) {}
      const bKl = (f % 7 === 3) ? 1 - kl : kl;
      const B = (f % 9 === 4) ? new Float32Array(8 * 8400) : anker(bKl, 0.6, 321, 201, 19, 47);
      const dets = postprocessYOLO(anker(kl, 0.85, 320, 200, 20, 48), [1, 8, 8400]);
      _verwerkWorkerResultaat(dets);
      try { nanoNaHoofd(fid, 300, dets); } catch (_) {}
      try { nanoSchaduwResultaat({ frameId: fid, data: B, dims: [1, 8, 8400], lu: 40 }, 120); } catch (_) {}
      verwerkDetecties(); tickCd();
    };
    const licht = (N, l) => {   // één licht: 20 groen, 60 rood, 30 groen, 40 zonder licht (56 s)
      for (let i = 0; i < 20; i++) frame(N + l, l, 'g', 30, 150 - i * 4);
      for (let i = 0; i < 60; i++) frame(N + l, l, 'r', i < 5 ? 10 : 0, i < 5 ? 70 - i * 10 : 20);
      for (let i = 0; i < 30; i++) frame(N + l, l, 'g', i < 4 ? 0 : 15 + i, Math.max(1, 20 - i));
      for (let i = 0; i < 40; i++) frame(null, l, null, 40, null);
    };
    const zicht = (verborgen) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => verborgen ? 'hidden' : 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    const tel = {}; const echtSet = Storage.prototype.setItem;
    const nul = () => { for (const k in tel) delete tel[k]; };
    Storage.prototype.setItem = function (k, v) { const x = String(k); if (x.startsWith('sl_nano_') || x === 'sl_modelvgl') tel[x] = (tel[x] || 0) + 1; return echtSet.call(this, k, v); };
    const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
    const foto = () => ({ ep: lees(NANO_EP_SLEUTEL), vs: lees(NANO_VS_SLEUTEL), meta: localStorage.getItem(NANO_META_SLEUTEL), vgl: lees('sl_modelvgl') });
    const uit = { fout: null };
    try {
      nanoBegin();
      // A: midden in een episode (licht 0, groen en 30 frames rood), dan alleen pagehide
      for (let i = 0; i < 20; i++) frame(opt.N, 0, 'g', 30, 150 - i * 4);
      for (let i = 0; i < 30; i++) frame(opt.N, 0, 'r', i < 5 ? 10 : 0, i < 5 ? 70 - i * 10 : 20);
      const v = foto();
      uit.voor = { ep: (v.ep || []).length, vs: (v.vs || []).length, vglN: v.vgl && v.vgl.perModus && v.vgl.perModus.nano ? v.vgl.perModus.nano.n : 0,
                   geheugenN: vglStat.perModus.nano.n, epOpen: nanoEp ? nanoEp.fr.length : 0, run: !!nanoStaat.vsRun, buf: nanoStaat.vsBuf.length };
      nul();
      window.dispatchEvent(new Event('pagehide'));
      const n = foto();
      uit.na = { tel: { ...tel }, ep: (n.ep || []).length, epN: n.ep && n.ep.length ? n.ep[n.ep.length - 1].n : null,
                 vsSomN: (n.vs || []).reduce((a, r) => a + (r.n || 0), 0), vs: (n.vs || []).length,
                 vglN: n.vgl && n.vgl.perModus && n.vgl.perModus.nano ? n.vgl.perModus.nano.n : 0, geheugenN: vglStat.perModus.nano.n,
                 metaGelijk: n.meta === JSON.stringify(nanoMetaCache), epOpen: !!nanoEp, run: !!nanoStaat.vsRun, buf: nanoStaat.vsBuf.length };
      // B: 10 keer verbergen en terug zonder nieuwe frames (binnen een minuut)
      nul();
      for (let i = 0; i < 10; i++) { zicht(true); zicht(false); T += 5000; P += 5000; }
      uit.leeg = { ...tel };
      // C: een rit van 10 lichten (~9,3 min) met elke 2 lichten (~2 min) een keer verbergen en terug
      nul(); const t0 = T;
      for (let l = 1; l <= 10; l++) { licht(opt.N, l); if (l % 2 === 0) { zicht(true); zicht(false); } }
      uit.rit = { tel: { ...tel }, minuten: (T - t0) / 60000 };
    } catch (e) { uit.fout = String((e && e.stack) || e).slice(0, 300); }
    finally { Storage.prototype.setItem = echtSet; Date.now = echtNow; performance.now = echtPerf; try { delete document.visibilityState; } catch (_) {} }
    return uit;
  }

  if (soort === 'id') {
    // ── het scenario: twee bedachte lichten, vaste klok, de echte app-functies ──
    const echtNow = Date.now, echtPerf = performance.now.bind(performance);
    let T = 1000000000000 + 10 * 3600e3, P = 500000;
    lusGeneratie++;   // de animatielus stopt: niets anders draait tussendoor
    Date.now = () => T; performance.now = () => P;
    const N1 = opt.N, N2 = opt.N + 1, LAT = 52.0, LON = 5.0;
    const voor = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); voor[k] = localStorage.getItem(k); }
    // leerdata voor licht 2, zodat m5 bij een rood zonder gezien begin start
    localStorage.setItem('sl_v4_' + N2 + '_' + huidigDDActief(), JSON.stringify([30, 40, 45, 50, 60].map((d, i) => ({ duur: d, tijd: T - 86400000 * (i + 1), gewicht: 1 }))));
    try { opslagHersynchroniseer(['sl_v4_' + N2 + '_' + huidigDDActief()]); } catch (e) {}
    const anker = (kl, s, cx, cy, w, h) => { const d = new Float32Array(8 * 8400); const i = 4000; d[i] = cx; d[8400 + i] = cy; d[2 * 8400 + i] = w; d[3 * 8400 + i] = h; d[(4 + kl) * 8400 + i] = s; return d; };
    const plan = [];
    for (let i = 0; i < 10; i++) plan.push([N1, 'g', 30, 120 - i * 8]);
    for (let i = 0; i < 45; i++) plan.push([N1, 'r', i < 5 ? 10 : 0, 40 - Math.min(i, 5) * 4]);
    for (let i = 0; i < 20; i++) plan.push([N1, 'g', i < 4 ? 0 : 15, 20 - i]);
    for (let i = 0; i < 8; i++) plan.push([N2, 'r', 25, 90 - i * 9]);
    for (let i = 0; i < 40; i++) plan.push([N2, 'r', 0, 15]);
    for (let i = 0; i < 15; i++) plan.push([N2, 'g', i < 3 ? 0 : 12 + i, 15 - i]);
    if (opt.vol) {
      const os = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('sl_nano_')) throw new DOMException('nep', 'QuotaExceededError'); return os.call(this, k, v); };
    }
    if (opt.fout) {
      window.nanoFrame = () => { throw new Error('nep: fout in nanoFrame'); };
      window.nanoSchaduwResultaat = () => { throw new Error('nep: fout in nanoSchaduwResultaat'); };
      window.nanoNaHoofd = () => { throw new Error('nep: fout in nanoNaHoofd'); };
    }
    let fout = null;
    try {
      if (opt.met) nanoBegin();
      plan.forEach(([licht, kleur, kmh, af], f) => {
        T += 400; P += 400;
        snelheidKmh = kmh;
        dichtstbijOSM = { id: licht, lat: LAT + (licht === N2 ? 0.01 : 0), lon: LON, afstand: Math.max(1, af), naam: 'TEST' };
        passageTik(dichtstbijOSM.lat - Math.max(1, af) / 111320, LON);
        detLogAfst = Math.max(1, af); detLogSkip = false; detLogRatio = null;
        const kl = kleur === 'r' ? 0 : 1;
        const A = anker(kl, 0.85, 320, 200, 20, 48);
        const fid = 100000 + f;
        // zoals voerAIUit: alleen met de schakelaar aan
        if (opt.met) { try { vglNaarB.add(fid); nanoNoteerContext(fid); } catch (_) {} }
        const bKl = (f % 7 === 3) ? 1 - kl : kl;
        const B = (f % 9 === 4) ? new Float32Array(8 * 8400) : anker(bKl, 0.6, 321, 201, 19, 47);
        if (f % 11 === 5) { B[5000] = 100; B[8400 + 5000] = 100; B[2 * 8400 + 5000] = 12; B[3 * 8400 + 5000] = 30; B[4 * 8400 + 5000] = 0.5; }
        // zoals de onmessage van de schaduwworker: in een try
        const doeB = () => { try { nanoSchaduwResultaat({ frameId: fid, data: B, dims: [1, 8, 8400], lu: 40 }, 120); } catch (_) {} };
        if (opt.met && opt.volgorde === 'BA') doeB();
        // zoals de onmessage van de hoofdworker
        const dets = postprocessYOLO(A, [1, 8, 8400]);
        _verwerkWorkerResultaat(dets);
        if (opt.met) { try { nanoNaHoofd(fid, 300, dets); } catch (_) {} }
        if (opt.met && opt.volgorde === 'AB') doeB();
        verwerkDetecties(); tickCd();
      });
      // licht 2 achter je laten: de passage sluit
      T += 30000; P += 30000; dichtstbijOSM = null; snelheidKmh = 40;
      passageTik(LAT + 0.02, LON); passageTik(LAT + 0.03, LON);
      if (opt.met) { try { nanoEpSluit(); nanoVsSchrijf(); nanoMetaBewaar(); } catch (_) {} }
    } catch (e) { fout = String((e && e.stack) || e).slice(0, 300); }
    const na = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); na[k] = localStorage.getItem(k); }
    const delta = {};
    for (const k of new Set([...Object.keys(voor), ...Object.keys(na)])) if (voor[k] !== na[k]) delta[k] = (na[k] === undefined ? null : na[k]);
    const g = { fase, faseNodeId, faseStart, aiKleur, aiTeller, laatsteAI, stickyDetectie, bboxOverride, activeCdDoel, cdStart, cdWallStart,
                huidigCdBron, huidigCdWaarde, activeCdModus, activeCdMin, activeCdMax, detLogBest, debugLaatsteAlle, debugLaatsteTopKlasse, debugLaatsteTopScore,
                debugWaarden, huidigBevestigdOsmNodeId, zagRoodOvergang, laatsteDetecties, m5: m5Open ? m5Open.rec : null,
                passage: [...passageStaat.open.entries()], passageVorige: passageStaat.vorige, gemiddeldeInferentieTijd, aiBezig };
    const uit = { fout, delta, g: JSON.parse(JSON.stringify(g)),
                  nano: { ep: delta[NANO_EP_SLEUTEL] ? JSON.parse(delta[NANO_EP_SLEUTEL]) : null, vs: delta[NANO_VS_SLEUTEL] ? JSON.parse(delta[NANO_VS_SLEUTEL]) : null,
                          staat: { actief: nanoStaat.actief, vol: nanoStaat.vol, label: nanoStaat.label, gestopt: nanoStaat.gestopt } } };
    Date.now = echtNow; performance.now = echtPerf;
    return uit;
  }
  return { fout: 'onbekend scenario ' + soort };
}

async function testSchaduwNano() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
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
  const pagina = location.pathname;
  const bron = new URL('test_schaduw_nano.js', location.href).href;
  const inFrame = async (doe, voorLaden) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    try {
      if (voorLaden) voorLaden();
      f.src = pagina + '?schaduwnano=' + Math.random();
      document.body.appendChild(f);
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.onGPS !== 'function'; poging++) {
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
      return await doe(w);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300) };
    } finally {
      try { if (f.contentWindow && f.contentWindow.vglLegStil) f.contentWindow.vglLegStil(); } catch (e) {}
      f.remove();
      herstel();
    }
  };
  const zonderNano = (delta) => { const o = {}; for (const k of Object.keys(delta).sort()) if (!k.startsWith('sl_nano_') && k !== 'sl_modelvgl') o[k] = delta[k]; return o; };
  const verschil = (a, b) => {
    const uit = [];
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) uit.push(k);
    return uit;
  };

  // bewaar de staat van deze pagina die de toetsen hieronder aanraken
  const bewaard = { nanoStaat: JSON.parse(JSON.stringify(nanoStaat)), nanoEp, nanoMetaCache, vglWorker, vglWorkerKlaar, vglBezig, vglFouten,
                    detLogBest, dA: debugLaatsteAlle, dK: debugLaatsteTopKlasse, dS: debugLaatsteTopScore, pad: Object.assign({}, VGL_MODUS_PAD),
                    lbScale, lbPadX, lbPadY, cropRegio, vglStat };   // vglStat: de cache van sl_modelvgl (anders leest test_mv_trigger T4b daarna de cache)
  const echtFetch = window.fetch, echtWorker = window.Worker, echtURL = URL.createObjectURL;

  try {
    // ═══ N1 — met en zonder Nano dezelfde uitkomst ═══
    const N = vers();
    const X = await inFrame((w) => w.schaduwNanoBinnen('id', { N, met: false }));
    const varianten = [['B voor A', { volgorde: 'BA' }], ['B na A', { volgorde: 'AB' }],
                       ['een fout in de Nano-code', { volgorde: 'BA', fout: true }], ['vol quotum voor sl_nano_', { volgorde: 'AB', vol: true }]];
    const leerKeys = X.delta ? Object.keys(X.delta).filter(k => /^sl_(v4|v5|klok|richting|v10|s2|bevestig|passief)_/.test(k)) : [];
    eis('N1a het scenario zonder Nano draait en schrijft echte leerdata, detlog, passagelog en m5',
        !X.fout && leerKeys.length >= 3 && X.delta['sl_detlog'] && X.delta['sl_passagelog'] && X.delta['sl_m5log'] && X.g.fase !== undefined,
        'leerdata + detlog + passage + m5', kort({ fout: X.fout, leer: leerKeys, sleutels: X.delta && Object.keys(X.delta), m5: X.g && X.g.m5 }));
    for (const [naam, o] of varianten) {
      const Y = await inFrame((w) => w.schaduwNanoBinnen('id', Object.assign({ N, met: true }, o)));
      const dX = zonderNano(X.delta || {}), dY = zonderNano(Y.delta || {});
      const vs = verschil(dX, dY), vg = verschil(X.g || {}, Y.g || {});
      eis('N1b ' + naam + ': dezelfde opslag (elke sleutel die het scenario schreef, op sl_nano_* en sl_modelvgl na)',
          !Y.fout && vs.length === 0 && Object.keys(dX).length === Object.keys(dY).length, '0 verschillen', kort({ fout: Y.fout, verschillen: vs, n: [Object.keys(dX).length, Object.keys(dY).length] }));
      eis('N1c ' + naam + ': dezelfde toestand (fase, countdown, gekozen box, sticky, m5, detLogBest, passages)',
          vg.length === 0, '0 verschillen', kort(vg));
      if (!o.fout && !o.vol) {
        eis('N1d ' + naam + ': de schaduw deed echt iets (episodes en verschilregels in de eigen ringen)',
            Y.nano.ep && Y.nano.ep.length >= 2 && Y.nano.vs && Y.nano.vs.length >= 5, '>=2 episodes, >=5 verschilregels',
            kort({ ep: Y.nano.ep && Y.nano.ep.length, vs: Y.nano.vs && Y.nano.vs.length, ep0: Y.nano.ep && Y.nano.ep[0] }));
      }
      if (o.vol) {
        eis('N1e vol quotum: de schaduw stopt zichzelf en zegt het', Y.nano.staat.vol && !Y.nano.staat.actief && Y.nano.staat.label === 'Nano uit'
            && /opslag vol/.test(Y.nano.staat.gestopt || ''), 'gestopt: opslag vol', kort(Y.nano.staat));
      }
    }

    // N1f — de bron: elke aanroep van een nano*-functie vanuit het hoofdpad staat in een eigen try
    {
      const per = {}, zonder = [];
      for (const [naam, fn, min] of [['laadONNXModel', laadONNXModel, 1], ['voerAIUit', voerAIUit, 1], ['vglKoppel', vglKoppel, 1], ['vglStartSchaduw', vglStartSchaduw, 7]]) {
        let n = 0;
        for (const regel of String(fn).split('\n')) {
          const re = /\bnano[A-Z]\w*\(/g; let m;
          while ((m = re.exec(regel))) {
            n++;
            if (!/try \{[^{}]*$/.test(regel.slice(0, m.index))) zonder.push(naam + ': ' + regel.trim().slice(0, 90));
          }
        }
        per[naam] = n;
        if (n < min) zonder.push(naam + ': maar ' + n + ' aanroepen gevonden (verwacht >= ' + min + ')');
      }
      eis('N1f elke aanroep van een nano*-functie vanuit het hoofdpad staat in de bron in een eigen try', zonder.length === 0, '0 zonder try', kort({ zonder, per }));
    }

    // ═══ N12 — één visibilitychange-luisteraar, ook bij een tweede start ═══
    {
      const echtAdd = document.addEventListener; let zicht = 0;
      document.addEventListener = function (type) { if (type === 'visibilitychange') zicht++; return echtAdd.apply(this, arguments); };
      const toast = window.toonToast; window.toonToast = () => {};
      try {
        nanoZichtGezet = false;
        nanoBegin(); nanoStop('toets'); nanoBegin(); nanoStop('toets');
      } finally { document.addEventListener = echtAdd; window.toonToast = toast; nanoZichtGezet = true; }
      eis('N12 nanoBegin twee keer: de visibilitychange-luisteraar staat er één keer', zicht === 1, '1', zicht);
    }

    // ═══ N2 — de reparatie: detLogBest ═══
    const anker = (kl, s, cx, cy, w, h, i = 4000) => { const d = new Float32Array(8 * 8400); d[i] = cx; d[8400 + i] = cy; d[2 * 8400 + i] = w; d[3 * 8400 + i] = h; d[(4 + kl) * 8400 + i] = s; return d; };
    const merk = { s: 0.123, k: 0, cx: 1, cy: 2, w: 3, h: 4, maxY: 0.75, tap: false };
    detLogBest = merk; debugLaatsteAlle = ['m']; debugLaatsteTopKlasse = 9; debugLaatsteTopScore = 0.5;
    // V11.37.27: vglPostprocessVeilig is weg (de B van de schaduw gaat alleen nog door postprocessNano)
    eis('N2a vglPostprocessVeilig is weg: geen YOLOv8-schaduw meer die detLogBest kan overschrijven (V11.37.27)', typeof window.vglPostprocessVeilig === 'undefined', 'weg', typeof window.vglPostprocessVeilig);
    const d3 = postprocessNano(anker(0, 0.9, 300, 200, 20, 40), [1, 8, 8400], { conf: 0.07, tapConf: 0.03, tap: null, straal: 80, kmh: 30 });
    eis('N2b postprocessNano laat de drie debug-globals staan', debugLaatsteTopKlasse === 9 && debugLaatsteTopScore === 0.5 && debugLaatsteAlle[0] === 'm', '9 / 0,5', kort([debugLaatsteTopKlasse, debugLaatsteTopScore]));
    eis('N2c postprocessNano schrijft niets naar detLogBest of debugLaatste*', detLogBest === merk && debugLaatsteTopKlasse === 9 && d3.length === 1 && d3[0].klasse === 0,
        'onaangeroerd, 1 rode box', kort({ d3: d3.length, k: debugLaatsteTopKlasse }));
    postprocessYOLO(anker(0, 0.9, 300, 200, 20, 40), [1, 8, 8400]);
    eis('N2d postprocessYOLO van het hoofdpad schrijft detLogBest wel, zoals altijd', detLogBest !== merk && detLogBest && detLogBest.k === 0 && debugLaatsteTopKlasse === 0, 'nieuw, klasse 0', kort(detLogBest));
    // N2e: de kopie is gelijk aan het origineel. Willekeurige ankers (ook klasse uit, te laag, te plat, te breed,
    // in en buiten de tikzone, bijna gelijke boxen voor de NMS), met en zonder tik, bij 5 en 40 km/u.
    const bewaarTik = { bo: bboxOverride, bx: bboxOverrideCamX, by: bboxOverrideCamY, st: stickyDetectie, kmh: snelheidKmh };
    let zaad = 20261104, afw = [], vergeleken = 0, metDets = 0;
    const rnd = () => { zaad = (zaad * 1103515245 + 12345) % 2147483648; return zaad / 2147483648; };
    try {
      for (let ronde = 0; ronde < 300; ronde++) {
        const NA = 60, d = new Float32Array(8 * NA);
        for (let a = 0; a < NA; a++) {
          const cx = 100 + rnd() * 440, cy = 50 + rnd() * 560, w = 2 + rnd() * (rnd() < 0.1 ? 400 : 40), h = 1 + rnd() * 90;
          d[a] = cx; d[NA + a] = cy; d[2 * NA + a] = w; d[3 * NA + a] = h;
          for (let c = 0; c < 4; c++) d[(4 + c) * NA + a] = rnd() < 0.5 ? rnd() * 0.2 : rnd();
          if (a % 7 === 0 && a > 0) { for (let q = 0; q < 4; q++) d[q * NA + a] = d[q * NA + a - 1] + rnd() * 3; }
        }
        bboxOverride = (ronde % 2) ? { cx: 300, cy: 250 } : null; bboxOverrideCamX = null; bboxOverrideCamY = null; stickyDetectie = null;
        snelheidKmh = (ronde % 3) ? 40 : 5;
        const optHoofd = { conf: CONF_DREMPEL, tapConf: TAP_CONF_DREMPEL, tap: tapZwakPositie(), straal: tikStraalYolo(), kmh: snelheidKmh };
        const vA = postprocessYOLO(d, [1, 8, NA]), vB = postprocessNano(d, [1, 8, NA], optHoofd);
        vergeleken++; if (vA.length) metDets++;
        if (JSON.stringify(vA) !== JSON.stringify(vB)) afw.push(ronde);
      }
    } finally {
      bboxOverride = bewaarTik.bo; bboxOverrideCamX = bewaarTik.bx; bboxOverrideCamY = bewaarTik.by; stickyDetectie = bewaarTik.st; snelheidKmh = bewaarTik.kmh;
    }
    eis('N2e KERN: postprocessNano met de drempels en de toestand van het hoofdpad = postprocessYOLO (300 willekeurige uitvoeren, met en zonder tik)',
        afw.length === 0 && vergeleken === 300 && metDets >= 200, '0 afwijkingen', kort({ afw: afw.slice(0, 10), vergeleken, metDets }));

    // ═══ N3 — de drempels ═══
    const lees = (v) => { const o = localStorage.getItem('sl_nano_proefsleutel'); if (v === null) localStorage.removeItem('sl_nano_proefsleutel'); else localStorage.setItem('sl_nano_proefsleutel', v); const r = nanoDrempelLees('sl_nano_proefsleutel', 0.07); if (o === null) localStorage.removeItem('sl_nano_proefsleutel'); else localStorage.setItem('sl_nano_proefsleutel', o); return r; };
    eis('N3a standaard 0,07 en 0,03 (zonder instelling)', NANO_CONF_STANDAARD === 0.07 && NANO_TAPCONF_STANDAARD === 0.03, '0,07 / 0,03', NANO_CONF_STANDAARD + ' / ' + NANO_TAPCONF_STANDAARD);
    eis('N3b een instelling wordt gelezen; onzin, 0, 1 of negatief valt terug', lees('0.05') === 0.05 && lees('abc') === 0.07 && lees('0') === 0.07 && lees('1') === 0.07 && lees('-0.2') === 0.07 && lees(null) === 0.07,
        '0,05 en vijf keer 0,07', [lees('0.05'), lees('abc'), lees('0'), lees('1'), lees('-0.2'), lees(null)].join(' '));
    const drempelOpt = (tap) => ({ conf: 0.07, tapConf: 0.03, tap, straal: 80, kmh: 30 });
    eis('N3c conf 0,07: 0,08 komt door, 0,06 niet (buiten de tikstraal)',
        postprocessNano(anker(0, 0.08, 300, 200, 20, 40), [1, 8, 8400], drempelOpt(null)).length === 1
        && postprocessNano(anker(0, 0.06, 300, 200, 20, 40), [1, 8, 8400], drempelOpt(null)).length === 0, '1 / 0', '');
    eis('N3d tikdrempel 0,03: binnen de tikstraal komt 0,04 door, 0,02 niet; buiten de straal geldt 0,07',
        postprocessNano(anker(0, 0.04, 300, 200, 20, 40), [1, 8, 8400], drempelOpt({ cx: 305, cy: 205 })).length === 1
        && postprocessNano(anker(0, 0.02, 300, 200, 20, 40), [1, 8, 8400], drempelOpt({ cx: 305, cy: 205 })).length === 0
        && postprocessNano(anker(0, 0.04, 300, 200, 20, 40), [1, 8, 8400], drempelOpt({ cx: 500, cy: 500 })).length === 0, '1 / 0 / 0', '');
    eis('N3e het hoofdmodel houdt zijn eigen drempel 0,10: 0,08 komt daar niet door',
        postprocessYOLO(anker(0, 0.08, 300, 200, 20, 40), [1, 8, 8400]).length === 0 && CONF_DREMPEL === 0.10, '0', '');
    detLogBest = bewaard.detLogBest; debugLaatsteAlle = bewaard.dA; debugLaatsteTopKlasse = bewaard.dK; debugLaatsteTopScore = bewaard.dS;

    // ═══ N4 — elk modelpad met zijn eigen soort ═══
    const html = await echtFetch.call(window, pagina + '?bron=' + Math.random()).then(r => r.text());
    const paden = [...new Set([...html.matchAll(/['"`](\.\/[A-Za-z0-9_\/.-]+\.onnx)['"`]/g)].map(m => m[1]))];
    const onbekend = paden.filter(p => !MODEL_PADEN[p]);
    eis('N4a elk .onnx-pad in index.html staat in MODEL_PADEN (een nieuw pad zonder soort laat deze toets falen)',
        paden.length >= 3 && onbekend.length === 0, '0 onbekend', kort({ paden, onbekend }));
    eis('N4b het hoofdpad en zijn terugval zijn allebei YOLOv8; laadONNXModel controleert dat',
        modelSoortVan('./model.onnx') === 'yolov8' && modelSoortVan('./model/model.onnx') === 'yolov8'
        && /modelSoortVan\(modelPad\) !== 'yolov8'/.test(String(laadONNXModel)), 'yolov8 + controle', '');
    const plannen = {};
    for (const m of MODELVGL_MODI) { try { const p = vglPlan(m); plannen[m] = p.soort + '/' + p.worker; } catch (e) { plannen[m] = 'FOUT ' + e.message; } }
    eis('N4c alleen nog de stand nano, met de Nano-worker (V11.37.27)',
        MODELVGL_MODI.length === 1 && plannen.nano === 'yolox/nano' && !MODEL_PADEN['./model/dfine-n.onnx'] && !MODEL_SOORTEN.dfine,
        'nano: yolox/nano', kort(plannen));
    const gooit = (f) => { try { f(); return null; } catch (e) { return e.message; } };
    const vergif = (wijz) => Object.assign({}, VGL_MODUS_PAD, wijz);
    const g1 = gooit(() => vglPlan('nano', null, vergif({ nano: './model/model.onnx' })));
    const g2 = gooit(() => vglPlan('ort130', null, vergif({ ort130: './model/yolox_nano.onnx' })));
    const g3 = gooit(() => vglPlan('webgpu', null, vergif({ webgpu: './model/yolox_nano.onnx' })));
    const g4 = gooit(() => vglPlan('v8n', null, vergif({ v8n: './model/yolox_nano.onnx' })));
    const g5 = gooit(() => vglPlan('nano', null, vergif({ nano: './model/nieuw.onnx' })));
    const g6 = gooit(() => vglPlan('nano', { './model/yolox_nano.onnx': { soort: 'yolov8', naam: 'x' } }));
    eis('N4d KERN: een YOLOv8-bestand krijgt nooit de Nano-worker en een YOLOX-bestand nooit een YOLOv8-worker, ook niet in de motorproef; een onbekend pad start niet',
        !!(g1 && g2 && g3 && g4 && g5 && g6), 'zes keer een fout', kort([g1, g2, g3, g4, g5, g6]));
    const hoofdWorkerZelfde = YOLO_WORKER_CODE.indexOf("output['output0']") > 0 && YOLO_WORKER_CODE.indexOf('sessie.run({images:tensor})') > 0;
    eis('N4e het hoofdpad zelf is onaangeroerd: YOLO_WORKER_CODE leest images en output0, kent geen Nano', hoofdWorkerZelfde && YOLO_WORKER_CODE.indexOf('255') < 0, 'ongewijzigd', '');
    eis('N4f de Nano-worker vraagt precies één provider en valt nergens op terug', /executionProviders:\['wasm'\]/.test(NANO_WORKER_CODE) && (NANO_WORKER_CODE.match(/executionProviders/g) || []).length === 1, 'wasm', '');

    // ═══ N5 — de workers in een zandbak ═══
    const zandbak = (code, sessie) => {
      const berichten = [];
      const self = { postMessage: (m) => berichten.push(m) };
      const ort = {
        env: { wasm: {} },
        Tensor: function (type, data, dims) { this.type = type; this.data = data; this.dims = dims; },
        InferenceSession: { create: async () => sessie }
      };
      new Function('self', 'ort', 'importScripts', code)(self, ort, () => {});
      return { self, berichten };
    };
    const wacht = () => new Promise(r => setTimeout(r, 0));
    // a. een YOLOv8-bestand in de Nano-worker
    const z1 = zandbak(NANO_WORKER_CODE, { inputNames: ['images'], outputNames: ['output0'], run: async () => { throw new Error('mag niet draaien'); } });
    z1.self.onmessage({ data: { type: 'initialiseer', modelBuffer: new ArrayBuffer(4) } }); await wacht(); await wacht();
    z1.self.onmessage({ data: { type: 'inferentie', pixelData: new Float32Array(12), breedte: 2, hoogte: 2, frameId: 5 } }); await wacht(); await wacht();
    eis('N5a de Nano-worker weigert een YOLOv8-bestand bij het laden, en draait daarna niets',
        z1.berichten.length === 2 && z1.berichten[0].type === 'fout' && /^init: geen YOLOX-bestand/.test(z1.berichten[0].bericht) && z1.berichten[1].type === 'fout' && /niet klaar/.test(z1.berichten[1].bericht),
        'init-fout, daarna sessie niet klaar', kort(z1.berichten));
    // b. de goede soort: invoer BGR 0..255, uitvoer (1,8,N) met object x klasse
    let gevoerd = null;
    const Nk = 3, y = new Float32Array(Nk * 9);
    for (let a = 0; a < Nk; a++) for (let c = 0; c < 9; c++) y[a * 9 + c] = (a + 1) * 10 + c;
    for (let a = 0; a < Nk; a++) { y[a * 9 + 4] = 0.5; y[a * 9 + 5] = 0.2; y[a * 9 + 6] = 0.4; y[a * 9 + 7] = 0.6; y[a * 9 + 8] = 0.8; }
    const z2 = zandbak(NANO_WORKER_CODE, { inputNames: ['images'], outputNames: ['output'], run: async (feeds) => { gevoerd = feeds; return { output: { data: y, dims: [1, Nk, 9] } }; } });
    z2.self.onmessage({ data: { type: 'initialiseer', modelBuffer: new ArrayBuffer(4) } }); await wacht(); await wacht();
    const px = new Float32Array([0.1, 0.2, 0.3, 0.4, /*G*/ 0.5, 0.6, 0.7, 0.8, /*B*/ 0.9, 1.0, 0.0, 0.25]);
    z2.self.onmessage({ data: { type: 'inferentie', pixelData: px, breedte: 2, hoogte: 2, frameId: 6 } }); await wacht(); await wacht(); await wacht();
    const res = z2.berichten.find(b => b.type === 'resultaat');
    const t = gevoerd && gevoerd.images;
    const bgrGoed = t && Math.abs(t.data[0] - 229.5) < 1e-3 && Math.abs(t.data[3] - 63.75) < 1e-3 && Math.abs(t.data[4] - 127.5) < 1e-3 && Math.abs(t.data[8] - 25.5) < 1e-3 && Math.abs(t.data[11] - 102) < 1e-3;
    eis('N5b de Nano-worker voert BGR 0..255 (kanaal 0 = blauw x 255)', z2.berichten[0].type === 'klaar' && bgrGoed && JSON.stringify(t.dims) === '[1,3,2,2]',
        'B,G,R x 255', kort(t && Array.from(t.data)));
    const omzetGoed = res && JSON.stringify(res.dims) === '[1,8,3]' && res.data[0] === 10 && res.data[3] === 11 && res.data[6] === 12 && res.data[9] === 13
      && Math.abs(res.data[4 * 3 + 0] - 0.1) < 1e-6 && Math.abs(res.data[5 * 3 + 1] - 0.2) < 1e-6 && Math.abs(res.data[7 * 3 + 2] - 0.4) < 1e-6;
    eis('N5c ... en zet (1,N,9) om naar (1,8,N): cx,cy,w,h en score = object x klasse', omzetGoed, 'dims [1,8,3], 0,5x0,2=0,1 ...', kort(res && { dims: res.dims, d: Array.from(res.data) }));
    eis('N5d ... met de helderheid erbij (lu, 0..255)', res && typeof res.lu === 'number' && res.lu >= 0 && res.lu <= 255, '0..255', res && res.lu);
    const z3 = zandbak(NANO_WORKER_CODE, { inputNames: ['images'], outputNames: ['output'], run: async () => ({ output: { data: new Float32Array(8 * 10), dims: [1, 8, 10] } }) });
    z3.self.onmessage({ data: { type: 'initialiseer', modelBuffer: new ArrayBuffer(4) } }); await wacht(); await wacht();
    z3.self.onmessage({ data: { type: 'inferentie', pixelData: new Float32Array(12), breedte: 2, hoogte: 2, frameId: 7 } }); await wacht(); await wacht(); await wacht();
    eis('N5e een uitvoer van de verkeerde vorm wordt een fout, geen resultaat', z3.berichten.some(b => b.type === 'fout' && /^vorm/.test(b.bericht)) && !z3.berichten.some(b => b.type === 'resultaat'), 'vorm-fout', kort(z3.berichten));
    const z4 = zandbak(YOLO_WORKER_CODE, { inputNames: ['images'], outputNames: ['output'], run: async () => ({ output: { data: new Float32Array(9), dims: [1, 1, 9] } }) });
    z4.self.onmessage({ data: { type: 'initialiseer', modelBuffer: new ArrayBuffer(4) } }); await wacht(); await wacht();
    z4.self.onmessage({ data: { type: 'inferentie', pixelData: new Float32Array(12), breedte: 2, hoogte: 2, frameId: 8 } }); await wacht(); await wacht(); await wacht();
    eis('N5f de YOLO-worker van het hoofdpad geeft op een YOLOX-bestand een fout, geen resultaat', z4.berichten.some(b => b.type === 'fout') && !z4.berichten.some(b => b.type === 'resultaat'), 'fout', kort(z4.berichten));

    // ═══ N6 — starten en stoppen ═══
    const nepWorkers = [], blobs = [], fetches = [];
    let fetchAntwoord = 'ok';
    function NepWorker(url) { this.url = url; this.berichten = []; this.gestopt = 0; nepWorkers.push(this); }
    NepWorker.prototype.postMessage = function (m) { this.berichten.push(m && m.type); };
    NepWorker.prototype.terminate = function () { this.gestopt++; };
    window.Worker = NepWorker;
    URL.createObjectURL = function (b) { blobs.push(b); return echtURL.call(URL, b); };
    window.fetch = function (url, ...rest) {
      if (/\.onnx$/.test(String(url))) {
        fetches.push(String(url));
        if (fetchAntwoord === '404') return Promise.resolve({ ok: false, status: 404, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) });
        return Promise.resolve({ ok: true, status: 200, arrayBuffer: () => Promise.resolve(new ArrayBuffer(16)) });
      }
      return echtFetch.apply(window, [url, ...rest]);
    };
    const rust = () => new Promise(r => setTimeout(r, 0));
    if (!MODELVGL_AAN) {
      startVglWorker(); await rust(); await rust();
      eis('N6a met de schakelaar uit haalt de app geen model op en start geen schaduw', fetches.length === 0 && nepWorkers.length === 0, '0 fetches, 0 workers', kort(fetches));
    } else {
      eis('N6a (overgeslagen: in deze browser staat de schakelaar aan)', true, '-', 'sl_modelvgl_aan=1');
    }
    nanoMetaCache = null;
    vglStartSchaduw('nano'); await rust(); await rust(); await rust();
    const w6 = nepWorkers[nepWorkers.length - 1];
    const tekst6 = blobs.length ? await blobs[blobs.length - 1].text() : '';
    eis('N6b de stand nano haalt model/yolox_nano.onnx op en start de Nano-worker', fetches[fetches.length - 1] === './model/yolox_nano.onnx' && tekst6 === NANO_WORKER_CODE && w6 && w6.berichten[0] === 'initialiseer',
        'yolox_nano.onnx + NANO_WORKER_CODE', kort({ fetches, worker: tekst6.slice(0, 60) }));
    eis('N6c tijdens het laden zegt het merkteken "Nano laadt"', nanoStaat.label === 'Nano laadt' && nanoStaat.actief, 'Nano laadt', nanoStaat.label);
    w6.onmessage({ data: { type: 'fout', bericht: 'init: geen YOLOX-bestand (invoer images; uitvoer output0)' } });
    eis('N6d een init-fout: de schaduw stopt meteen (geen vijf pogingen, geen ander bestand), de worker wordt beëindigd, en het staat in beeld',
        vglWorker === null && w6.gestopt === 1 && !nanoStaat.actief && nanoStaat.label === 'Nano uit' && /geen YOLOX/.test(nanoStaat.gestopt) && fetches.length === 1,
        'uit, terminate, 1 fetch', kort({ label: nanoStaat.label, gestopt: nanoStaat.gestopt, fetches: fetches.length }));
    const mvTekst = mvSamenvattingTekst();
    eis('N6e ... ook in het overzicht van de vijf tikken', /Nano-schaduw UIT: init: geen YOLOX/.test(mvTekst), 'Nano-schaduw UIT', kort(mvTekst.split('\n').filter(r => /Nano/.test(r))));
    fetchAntwoord = '404';
    vglStartSchaduw('nano'); await rust(); await rust(); await rust();
    eis('N6f bestand laadt niet (404): uit, met de reden, en geen terugval op een ander bestand', !nanoStaat.actief && /404/.test(nanoStaat.gestopt || '') && fetches.length === 2 && fetches.every(f => f === './model/yolox_nano.onnx'),
        'uit (404)', kort({ gestopt: nanoStaat.gestopt, fetches }));
    fetchAntwoord = 'ok';
    VGL_MODUS_PAD.nano = './model/model.onnx';
    const voorW = nepWorkers.length, voorF = fetches.length;
    vglStartSchaduw('nano'); await rust(); await rust();
    eis('N6g een tabelfout (nano wijst naar een YOLOv8-bestand): niets opgehaald, geen worker, uit met de reden', fetches.length === voorF && nepWorkers.length === voorW && /plan: stand nano vraagt een YOLOX/.test(nanoStaat.gestopt || ''),
        'niets gestart', kort(nanoStaat.gestopt));
    VGL_MODUS_PAD.nano = bewaard.pad.nano;
    vglStartSchaduw('ort130'); await rust(); await rust();
    eis('N6h een oude stand (ort130) heeft geen pad meer: niets opgehaald, geen worker (V11.37.27)', fetches.length === voorF && nepWorkers.length === voorW, 'niets gestart', kort(fetches.slice(voorF)));
    window.Worker = echtWorker; window.fetch = echtFetch; URL.createObjectURL = echtURL;

    // ═══ N7 — het oordeel per episode ═══
    const fr = [];
    // K1: doorrijden, passage bij i=15
    for (let i = 0; i < 20; i++) fr.push({ t: i * 400, af: Math.abs(i - 15) * 5 + 2, v: 40, f: null, a: 'g', b: i === 13 ? '-' : i === 14 ? 'r' : 'g', r: 1, oa: 0, ob: 0 });
    const e1 = nanoEpEvalueer({ fr, lu: 0, nlu: 0, nacht: 0 });
    eis('N7a K1: de laatste 3 s voor de passage, boven 15 km/u: 8 frames, huidig 0 fout, Nano 2 (gemist en rood)', JSON.stringify(e1.k1) === '[8,0,2]' && e1.ma === 2 && !e1.k2 && !e1.k3,
        '[8,0,2]', kort(e1));
    const g2f = [];
    const A = (i) => (i === 12 ? '-' : i < 25 ? 'r' : 'g');
    const B = (i) => (i < 2 ? '-' : i === 10 ? 'g' : i < 27 ? 'r' : 'g');
    for (let i = 0; i <= 30; i++) {
      const stil = i >= 5 && i <= 29;
      g2f.push({ t: i * 400, af: i < 5 ? 40 - i * 5 : 10, v: i < 5 ? 20 : stil ? 0 : 10, f: i < 5 ? null : i < 25 ? 'r' : 'g',
                 a: A(i), b: B(i), r: i === 2 ? 0 : 1, oa: (i === 6 || i === 7) ? 1 : 0, ob: (i === 6 || i === 8 || i === 9) ? 1 : 0 });
    }
    const e2 = nanoEpEvalueer({ fr: g2f, lu: 31 * 40, nlu: 31, nacht: 0 });
    eis('N7b K2: stilstand zonder de laatste 3 s voor het wegrijden: 18 frames, huidig 1 (gemist), Nano 1 (groen)', JSON.stringify(e2.k2) === '[18,1,1]', '[18,1,1]', kort(e2.k2));
    eis('N7c K3: blijvend groen 2,0 s (huidig) en 1,2 s (Nano) voor het wegrijden; een losse groene flits telt niet', JSON.stringify(e2.k3) === '[2,1.2]', '[2,1.2]', kort(e2.k3));
    eis('N7d K1 telt niet als je gestopt bent; de stilstand duurt 10 s', !e2.k1 && e2.s === 10, 'geen k1, s=10', kort({ k1: e2.k1, s: e2.s }));
    eis('N7e K4: eerste zicht huidig op 40 m, Nano op 25 m, 1,2 s later', JSON.stringify(e2.k4) === '[40,25,1.2]', '[40,25,1.2]', kort(e2.k4));
    eis('N7f K5: de groene flits van 0,4 s is één flikker bij Nano, nul bij huidig', JSON.stringify(e2.k5) === '[0,1]', '[0,1]', kort(e2.k5));
    eis('N7g K6 (partijdig): tegen de bevestigde fase 26 frames, huidig 0, Nano 3', JSON.stringify(e2.k6) === '[26,0,3]', '[26,0,3]', kort(e2.k6));
    eis('N7h K7: lampen buiten het gevolgde licht: huidig 2 frames, Nano 3; n0 = 1 frame zonder referentie; donker bij helderheid 40', JSON.stringify(e2.k7) === '[2,3]' && e2.n0 === 1 && e2.dk === 1 && e2.lu === 40,
        'k7 [2,3], n0 1, dk 1', kort({ k7: e2.k7, n0: e2.n0, dk: e2.dk, lu: e2.lu }));

    // ═══ N8 — de ringen ═══
    const ascii = (s) => ![...String(s)].some(c => c.charCodeAt(0) > 127);
    const epRec = Object.assign({}, e2, { d: 12, e: 345, ns: 14, nv: 3 });   // V11.37.27: ns, nv
    const vsRec = { d: 12, e: 345, ts: 123.4, x: 'k', a: 'r', b: 'g', sa: 0.85, sb: 0.61, oa: 0, ob: 1, r: 'a', v: 35, af: 120, n: 3 };   // V11.37.27: n
    const kb = (x) => JSON.stringify(x).length;
    eis('N8a een episode is ~0,2 KB en een verschilregel ~0,1 KB; ring vol: <= 160 KB samen', kb(epRec) <= 260 && kb(vsRec) <= 130 && (kb(epRec) * NANO_EP_MAX + kb(vsRec) * NANO_VS_MAX) <= 160 * 1024,
        '<=260 B, <=130 B', kb(epRec) + ' B, ' + kb(vsRec) + ' B, vol ' + Math.round((kb(epRec) * NANO_EP_MAX + kb(vsRec) * NANO_VS_MAX) / 1024) + ' KB');
    eis('N8b alles ASCII, geen lichtnummer, geen coördinaat, geen klok', ascii(JSON.stringify(epRec)) && ascii(JSON.stringify(vsRec))
        && Object.keys(epRec).every(k => ['n', 'n0', 'ma', 's', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'lu', 'dk', 'd', 'e', 'ns', 'nv'].includes(k))
        && Object.keys(vsRec).every(k => ['d', 'e', 'ts', 'x', 'a', 'b', 'sa', 'sb', 'oa', 'ob', 'r', 'v', 'af', 'n'].includes(k)), 'ASCII, alleen toegestane velden', kort(Object.keys(epRec)));
    nanoStaat.vol = false; nanoStaat.actief = true;
    const oudEp = localStorage.getItem(NANO_EP_SLEUTEL);
    localStorage.setItem(NANO_EP_SLEUTEL, '[]');
    const veel = []; for (let i = 0; i < NANO_EP_MAX + 10; i++) veel.push({ n: i });
    nanoRingSchrijf(NANO_EP_SLEUTEL, NANO_EP_MAX, veel);
    const ring = JSON.parse(localStorage.getItem(NANO_EP_SLEUTEL));
    eis('N8c de ring houdt de nieuwste ' + NANO_EP_MAX, ring.length === NANO_EP_MAX && ring[0].n === 10 && ring[ring.length - 1].n === NANO_EP_MAX + 9, NANO_EP_MAX + ', vanaf 10', ring.length + ', vanaf ' + ring[0].n);
    const sleutelsVoor = localStorage.length, quotaVoor = opslagQuotaFouten, opslaglogVoor = localStorage.getItem('sl_opslaglog'), ringVoor = localStorage.getItem(NANO_EP_SLEUTEL);
    const os = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('sl_nano_')) throw new DOMException('nep', 'QuotaExceededError'); return os.call(this, k, v); };
    let r8;
    try { r8 = nanoRingSchrijf(NANO_EP_SLEUTEL, NANO_EP_MAX, [{ n: -1 }]); } finally { Storage.prototype.setItem = os; }
    eis('N8d vol quotum: de schrijving faalt, de schaduw stopt en zegt "opslag vol"', r8 === false && nanoStaat.vol && !nanoStaat.actief && nanoStaat.label === 'Nano uit' && /opslag vol/.test(nanoStaat.gestopt), 'uit: opslag vol', kort({ r8, label: nanoStaat.label, g: nanoStaat.gestopt }));
    eis('N8e ... er gaat niets weg (ook niet uit de eigen ring), en de app merkt het niet (opslagteller en sl_opslaglog gelijk)',
        localStorage.length === sleutelsVoor && localStorage.getItem(NANO_EP_SLEUTEL) === ringVoor && opslagQuotaFouten === quotaVoor && localStorage.getItem('sl_opslaglog') === opslaglogVoor,
        'gelijk', kort({ sleutels: [sleutelsVoor, localStorage.length], quota: [quotaVoor, opslagQuotaFouten] }));
    if (oudEp === null) localStorage.removeItem(NANO_EP_SLEUTEL); else localStorage.setItem(NANO_EP_SLEUTEL, oudEp);

    // ═══ N9 — de referentieplek ═══
    nanoStaat = { actief: true, vol: false, gestopt: null, label: 'Nano', min: null, vsBuf: [] };
    nanoEp = null; nanoMetaCache = { v: 1, dag: 1, dagSleutel: -1, ep: 0, vs: 0, min: [] };
    const ctx = (o) => Object.assign({ t: 1000, tap: null, straal: 40, kmh: 20, sc: 0.5, px: 0, py: 80, kx: 100, ky: 0, licht: 'L', af: 50, fase: null, dd: 'dag' }, o);
    const det = (cx, cy, k, s) => ({ cx, cy, w: 10, h: 24, k, s });
    const paarAB = (fid, c, aDets, app, bDets) => {
      nanoCtx.set(fid, c);
      nanoFrame(fid, { nano: { dets: aDets, app } }, { nano: { dets: bDets, lu: 100 } });
      return nanoEp.fr[nanoEp.fr.length - 1];
    };
    // app-box in camerapixels (x 600..620, y 240..288) -> YOLO: x = (600-100)*0,5 = 250 .. 260, y = 240*0,5+80 = 200 .. 224
    const f1 = paarAB(1, ctx({ t: 1000 }), [det(255, 212, 0, 0.8)], { x: 600, y: 240, w: 20, h: 48 }, [det(256, 213, 0, 0.6), det(400, 100, 1, 0.5)]);
    eis('N9a de box van de app is de referentie (omgerekend uit camerapixels); beide zien rood; de groene lamp elders ziet alleen Nano (K7)', f1.a === 'r' && f1.b === 'r' && f1.r === 1 && f1.oa === 0 && f1.ob === 1, 'r/r, ob 1', kort(f1));
    const f2 = paarAB(2, ctx({ t: 1400 }), [], null, [det(257, 214, 0, 0.5)]);
    eis('N9b het huidige model mist, Nano ziet de lamp op de vastgehouden plek: gemist telt voor huidig', f2.a === '-' && f2.b === 'r' && f2.r === 1, '-/r', kort(f2));
    const f3 = paarAB(3, ctx({ t: 5000 }), [], null, [det(257, 214, 0, 0.5)]);
    eis('N9c na meer dan 2 s zonder zicht is er geen referentie meer: het frame telt niet (r 0)', f3.r === 0 && f3.a === '-' && f3.b === '-', 'r 0', kort(f3));
    const f4 = paarAB(4, ctx({ t: 5400, tap: { cx: 400, cy: 100 } }), [det(255, 212, 0, 0.8)], { x: 600, y: 240, w: 20, h: 48 }, [det(400, 101, 1, 0.5)]);
    eis('N9d een tik gaat voor de box van de app: de getikte lamp is groen (Nano), het huidige model zag hem niet', f4.a === '-' && f4.b === 'g' && f4.oa === 1, '-/g', kort(f4));
    nanoCtx.clear(); nanoEp = null; nanoStaat.vsBuf = [];

    // ═══ N10 — de teksten ═══
    eis('N10a het startscherm zegt "Model laden", niet meer "YOLOv8 model laden"', /id="s-model-label">🤖 Model laden…</.test(html) && html.indexOf('YOLOv8 model laden') < 0 && html.indexOf('✓ YOLOv8 klaar') < 0, 'Model laden', '');
    eis('N10b de naam na het laden komt uit de tabel', modelNaamVan('./model.onnx') === 'YOLOv8n' && /Model klaar: \$\{modelNaamVan\(modelPad\)\}/.test(String(laadONNXModel)), 'YOLOv8n', modelNaamVan('./model.onnx'));
    const sam = mvSamenvattingTekst();
    eis('N10c het overzicht noemt A en B; geen andere stand meer (V11.37.27)', /A = hoofdpad \(YOLOv8n\)/.test(sam) && /\nB = YOLOX-Nano/.test(sam) && !/D-FINE|ORT 1\.30|WebGPU|reservemodel/.test(sam), 'A = hoofdpad, B = YOLOX-Nano', kort(sam.split('\n').filter(r => /^[AB] = /.test(r))));
    eis('N10d de Nano-tussenstand geeft geen oordeel', /Tussenstand, GEEN oordeel/.test(sam) && !/GOED|TWIJFEL|\bAF\b/.test(sam), 'geen oordeel', '');
    eis('N10e versie V11.37.27 en de copyright blijft staan', /^V11\.37\.27(?!\d)/.test(APP_VERSIE) && (document.getElementById('s-copyright') || {}).textContent === '© 2026 StoplichtIQ — Y. Lemaalem', 'V11.37.27 + ©', APP_VERSIE.slice(0, 40));
    eis('N10f de meetdata-export neemt sl_nano_* en sl_modelvgl mee', /key\.startsWith\('sl_nano_'\) \|\| key === 'sl_modelvgl'\) doel = uit\.nano/.test(html), 'uit.nano', '');

    // ═══ N11 — ECHT: de schakelaar aan, de echte worker, het echte bestand ═══
    const E = await inFrame((w) => w.schaduwNanoBinnen('echt', {}), () => { localStorage.setItem('sl_modelvgl_aan', '1'); localStorage.setItem('sl_modelvgl_model', 'nano'); });
    eis('N11a met de schakelaar aan en de stand nano start de echte Nano-worker en zegt dat in beeld', E.aan === true && E.model === 'nano' && E.klaar && E.label === 'Nano' && E.badge === 'TEST · Nano' && E.versieBadge === 'TEST · Nano',
        'klaar, TEST · Nano', kort(E));
    const rood = E.b && E.b.dets.find(d => d.k === 0 && Math.abs(d.cx - 320) < 15 && Math.abs(d.cy - 250) < 20);
    eis('N11b de getekende rode lamp (kast 40x100 op 320/250) komt terug als rood op de goede plek', !!rood, 'rood bij 320/250', kort(E.b));
    eis('N11c de schaduw liet detLogBest van het hoofdmodel onaangeroerd', E.detLogBestOnaangeroerd === true, 'null', kort(E.detLogBestOnaangeroerd));
    const HG = E.hoofdGooit || {}, HW = E.hoofdGewoon || {}, BG = E.beginGooit || {};
    eis('N1g de echte onmessage van de hoofdworker: een fout in nanoNaHoofd ontsnapt niet, aiBezig gaat uit, de verwerking en de telling draaien',
        HG.nanoAangeroepen === 1 && HG.ontsnapt === null && HG.aiBezig === false && HG.verwerkt === 1 && HG.geteld === 1 && HG.yoloWorker && HG.workerKlaar,
        'aangeroepen 1, ontsnapt null, aiBezig false, verwerkt 1, geteld 1', kort(HG));
    eis('N1g2 en zonder fout precies hetzelfde hoofdpad (controle dat de toets de echte route neemt)',
        HW.nanoAangeroepen === 1 && HW.ontsnapt === null && HW.aiBezig === false && HW.verwerkt === 1 && HW.geteld === 1, 'idem', kort(HW));
    eis('N1h startVglWorker met een nanoBegin die gooit: niets ontsnapt naar laadONNXModel, het hoofdmodel blijft, de schaduw staat uit en zegt het',
        BG.ontsnapt === null && BG.yoloWorker === true && BG.workerKlaar === true && BG.schaduw === false && BG.label === 'Nano uit' && /^begin: nep/.test(BG.gestopt || ''),
        'ontsnapt null, hoofdmodel staat, Nano uit (begin: ...)', kort(BG));

    // ═══ N13 — V11.37.27: een oude stand doet niets ═══
    const O = await inFrame((w) => w.schaduwNanoBinnen('oud', {}), () => { localStorage.setItem('sl_modelvgl_aan', '1'); localStorage.setItem('sl_modelvgl_model', 'ort130'); });
    eis('N13a schakelaar aan met de oude stand ort130: geen schaduw, geen terugval op v8n of Nano, niets opgehaald',
        !O.fout && O.aan === true && O.model === null && O.oud === 'ort130' && O.worker === false && O.actief === false && O.geladen.length === 0,
        'model null, geen worker, 0 bestanden', kort(O));
    eis('N13b het merkteken en het overzicht zeggen het, met de uitweg', O.badge === 'TEST · oude stand' && O.versieBadge === 'TEST · oude stand'
        && /Oude stand "ort130" gevonden/.test(O.tekst || '') && /Zet uit/.test(O.tekst || '') && /oude stand ort130/.test(O.console || ''),
        'TEST · oude stand + uitleg', kort({ b: O.badge, t: (O.tekst || '').split('\n').slice(0, 4) }));
    eis('N13c en de oude stand schrijft niets: geen sl_nano_meta', O.meta === null, 'null', kort(O.meta));

    // ═══ N14 — V11.37.27: een nagespeelde rit van 10 minuten, schrijffrequentie ═══
    const R = await inFrame((w) => w.schaduwNanoBinnen('rit10', { N: vers() }));
    const perMin = {}; for (const k of [NANO_EP_SLEUTEL, NANO_VS_SLEUTEL, NANO_META_SLEUTEL, 'sl_modelvgl']) perMin[k] = R.tel ? Math.round(10 * (R.tel[k] || 0) / R.minuten) / 10 : null;
    eis('N14a de rit draait: 10 episodes, paren in de emmer nano', !R.fout && R.ep && R.ep.length === 10 && R.vgl && R.vgl.perModus && R.vgl.perModus.nano.n > 1000,
        '10 episodes, >1000 paren', kort({ fout: R.fout, ep: R.ep && R.ep.length, n: R.vgl && R.vgl.perModus && R.vgl.perModus.nano.n }));
    eis('N14b KERN: sl_nano_ep, sl_nano_vs, sl_nano_meta en sl_modelvgl elk minder dan 2 schrijfacties per minuut',
        Object.values(perMin).every(x => x !== null && x < 2), '< 2 per minuut', kort({ perMin, tel: R.tel, minuten: R.minuten }));
    eis('N14c s en v zijn een teller per episode (ns, nv); de regels in sl_nano_vs zijn alleen m en k, met een aantal frames n',
        R.ep && R.ep.every(e => typeof e.ns === 'number' && typeof e.nv === 'number') && R.ep.some(e => e.ns > 0)
        && R.vs && R.vs.length > 0 && R.vs.every(v => (v.x === 'm' || v.x === 'k') && v.n >= 1),
        'ns/nv per episode; alleen m/k met n', kort({ ep0: R.ep && R.ep[0], vs0: R.vs && R.vs.slice(0, 2) }));

    // ═══ N15 — V11.37.27: wegschrijven bij pagehide en visibilitychange ═══
    const W = await inFrame((w) => w.schaduwNanoBinnen('bergop', { N: vers() }));
    eis('N15a vóór pagehide: een open episode, vs-regels alleen in het geheugen en paren die nog niet in sl_modelvgl staan',
        !W.fout && W.voor && W.voor.epOpen === 50 && (W.voor.run || W.voor.buf > 0) && W.voor.ep === 0 && W.voor.vs === 0 && W.voor.vglN < W.voor.geheugenN,
        'episode 50 frames open, vs alleen in geheugen, opslag achter', kort({ fout: W.fout, voor: W.voor }));
    eis('N15b alleen pagehide (zonder verbergen): de episode, de reeks, sl_nano_meta en sl_modelvgl staan in de opslag',
        W.na && W.na.ep === 1 && W.na.epN === 50 && W.na.vs > 0 && W.na.run === false && W.na.buf === 0 && W.na.epOpen === false
        && W.na.vglN === W.na.geheugenN && W.na.metaGelijk === true,
        'ep 1 (50 frames), reeks weg, buffer leeg, vgl = geheugen, meta = geheugen', kort(W.na));
    eis('N15c pagehide schrijft elke sleutel hoogstens één keer', W.na && Object.values(W.na.tel).every(x => x <= 1)
        && W.na.tel[NANO_EP_SLEUTEL] === 1 && W.na.tel['sl_modelvgl'] === 1, '<= 1 per sleutel', kort(W.na && W.na.tel));
    eis('N15d 10 keer verbergen en terug zonder nieuwe frames: 0 schrijfacties', W.leeg && Object.keys(W.leeg).length === 0, '{}', kort(W.leeg));
    {
      const pm = {}; for (const k of [NANO_EP_SLEUTEL, NANO_VS_SLEUTEL, NANO_META_SLEUTEL, 'sl_modelvgl']) pm[k] = W.rit ? Math.round(10 * (W.rit.tel[k] || 0) / W.rit.minuten) / 10 : null;
      eis('N15e rit van ~9 minuten met elke ~2 minuten verbergen: elke Nano-sleutel minder dan 2 schrijfacties per minuut',
          W.rit && Object.values(pm).every(x => x !== null && x < 2), '< 2 per minuut', kort({ pm, tel: W.rit && W.rit.tel, min: W.rit && W.rit.minuten }));
    }
  } catch (e) {
    eis('onverwachte fout in de toets', false, 'geen', String((e && e.stack) || e).slice(0, 300));
  } finally {
    window.Worker = echtWorker; window.fetch = echtFetch; URL.createObjectURL = echtURL;
    Object.assign(VGL_MODUS_PAD, bewaard.pad);
    nanoStaat = bewaard.nanoStaat; nanoEp = bewaard.nanoEp; nanoMetaCache = bewaard.nanoMetaCache;
    vglWorker = bewaard.vglWorker; vglWorkerKlaar = bewaard.vglWorkerKlaar; vglBezig = bewaard.vglBezig; vglFouten = bewaard.vglFouten;
    detLogBest = bewaard.detLogBest; debugLaatsteAlle = bewaard.dA; debugLaatsteTopKlasse = bewaard.dK; debugLaatsteTopScore = bewaard.dS;
    lbScale = bewaard.lbScale; lbPadX = bewaard.lbPadX; lbPadY = bewaard.lbPadY; cropRegio = bewaard.cropRegio;
    vglStat = bewaard.vglStat;
    nanoCtx.clear(); vglOpenA.clear(); vglOpenB.clear(); vglNaarB.clear();
    herstel();
  }
  const gefaald = regels.filter(r => r.uitslag !== 'OK').length;
  return { regels, gefaald, geslaagd: regels.length - gefaald };
}
if (typeof window !== 'undefined') window.testSchaduwNano = testSchaduwNano;
