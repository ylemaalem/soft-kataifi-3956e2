// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetregels.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.34.2: de app meet zichzelf. Stap 1 uit de efficiëntie-STAP 0
//  van 28 september (camcap, de minuutstatistiek met rAF-Hz en afstandsband,
//  gegate pogingen tellen in plaats van elk wegschrijven) en de modelregel
//  (welk bestand, met hash, zodat een stille terugval zichtbaar wordt).
//
//  ML1  camcap: wat de camera levert, zonder deviceId/groupId, klein, een ring
//  ML2  modellog: pad, bytes, de eerste 16 tekens van de SHA-256, de terugval
//  ML3  laadONNXModel legt de terugval vast, en logt vóór de overdracht
//  ML4  de minuutstatistiek: banden, gemiddelden, rAF-Hz, een gat, een lege minuut
//  ML5  een vol quotum staakt alleen dat log
//  ML6  de drie logs reizen mee in de meetdata-export
//  ML7  ALLEEN METEN: zonder de V11.34.2-regels zijn de geraakte functies
//       byte-gelijk aan V11.34.1, en de beslissende functies zijn onaangeroerd
//  (De gegate pogingen zelf staan in test_gate T9.)
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_meetregels.js';
//      document.head.appendChild(s);
//      s.onload = () => testMeetregels().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testMeetregels() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  // V11.36.1: ook de Safari-meetregels (merkteken V11.36.1) gaan eruit.
  const zonderMeet = (f) => String(f).split('\n').filter(l => !/V11\.34\.[2-9]|V11\.36\.1/.test(l)).join('\n');
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };

  const sleutels = [CAMCAP_SLEUTEL, MODELLOG_SLEUTEL, MINUUTLOG_SLEUTEL];
  const bewaardLs = {}; for (const k of sleutels) bewaardLs[k] = localStorage.getItem(k);
  const bewaard = { minStat, dichtstbijOSM, frameT, snelheidKmh, nu: Date.now, schrijf: opslagSchrijf };
  const leeg = () => { for (const k of sleutels) localStorage.removeItem(k); meetRingGestopt.clear(); };

  try {
    // ═══ ML1 — camcap ══════════════════════════════════════════
    leeg();
    const nepTrack = {
      getSettings: () => ({ width: 2160, height: 3840, frameRate: 30, facingMode: 'environment', deviceId: 'GEHEIM-1', groupId: 'GEHEIM-2' }),
      getCapabilities: () => ({ frameRate: { min: 1, max: 60 }, zoom: { min: 1, max: 10 }, torch: true, deviceId: 'GEHEIM-1' }),
      getConstraints: () => ({ facingMode: { exact: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } })
    };
    camcapNoteer(nepTrack);
    const c1 = lees(CAMCAP_SLEUTEL);
    const r1 = c1[0] || {};
    eis('ML1a één regel met wat de camera levert: 2160x3840 op 30 fps, de mogelijkheden en de wensen',
        c1.length === 1 && r1.set && r1.set.frameRate === 30 && r1.set.width === 2160 && r1.cap && r1.cap.zoom
          && r1.con && r1.con.width && r1.con.width.ideal === 3840,
        '1 regel, fps 30, zoom, ideal 3840', JSON.stringify(r1).slice(0, 160));
    eis('ML1b geen deviceId of groupId, wel versie, schermmaat en standalone',
        !/GEHEIM/.test(JSON.stringify(c1)) && r1.ver === String(APP_VERSIE).split(' ')[0]
          && Array.isArray(r1.scherm) && r1.scherm.length === 5 && (r1.sa === 0 || r1.sa === 1),
        'schoon, ver, scherm[5], sa 0/1', r1.ver + ' / ' + JSON.stringify(r1.scherm) + ' / ' + r1.sa);
    for (let i = 0; i < 6; i++) camcapNoteer(nepTrack);
    eis('ML1c een ring van ' + CAMCAP_MAX, lees(CAMCAP_SLEUTEL).length === CAMCAP_MAX, CAMCAP_MAX, lees(CAMCAP_SLEUTEL).length);
    const groot = {}; for (let i = 0; i < 150; i++) groot['eigenschap' + i] = { min: i, max: i + 100 };
    leeg();
    camcapNoteer({ getSettings: nepTrack.getSettings, getCapabilities: () => groot, getConstraints: nepTrack.getConstraints });
    const rg = lees(CAMCAP_SLEUTEL)[0] || {};
    eis('ML1d te groot: de wensen eruit, van de mogelijkheden alleen de namen; de instellingen blijven',
        !('con' in rg) && Array.isArray(rg.cap) && rg.cap.length === 150 && rg.set && rg.set.frameRate === 30,
        'geen con, cap = 150 namen, set heel', ('con' in rg) + ' / ' + (Array.isArray(rg.cap) ? rg.cap.length : typeof rg.cap));
    leeg();
    let crash = null;
    try { camcapNoteer(null); } catch (e) { crash = e.message; }
    const rn = lees(CAMCAP_SLEUTEL)[0] || {};
    eis('ML1e zonder track geen crash: een regel met lege velden', crash === null && rn.set === null && rn.cap === null,
        'geen crash, set/cap null', crash || JSON.stringify(rn).slice(0, 80));

    // ═══ ML2 — modellog ════════════════════════════════════════
    leeg();
    const inhoud = new TextEncoder().encode('StoplichtIQ-proefmodel');
    const buf = inhoud.buffer.slice(0);
    const verwacht = [...new Uint8Array(await crypto.subtle.digest('SHA-256', inhoud))].slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0')).join('');
    await modelLogNoteer('./model.onnx', buf, null);
    const m1 = lees(MODELLOG_SLEUTEL)[0] || {};
    eis('ML2a pad, bytes en de eerste 16 tekens van de SHA-256',
        m1.pad === './model.onnx' && m1.bytes === inhoud.byteLength && m1.sha === verwacht && m1.terug === 0 && !('fout' in m1),
        './model.onnx, ' + inhoud.byteLength + ', ' + verwacht, m1.pad + ', ' + m1.bytes + ', ' + m1.sha);
    eis('ML2b de buffer zelf blijft heel: de worker krijgt hem daarna nog', buf.byteLength === inhoud.byteLength,
        inhoud.byteLength, buf.byteLength);
    const lang = 'x'.repeat(200);
    await modelLogNoteer('./model/model.onnx', buf, lang);
    const m2 = lees(MODELLOG_SLEUTEL).slice(-1)[0] || {};
    eis('ML2c de terugval: terug 1, de fout van de eerste poging, ingekort tot 80 tekens',
        m2.pad === './model/model.onnx' && m2.terug === 1 && m2.fout === lang.slice(0, 80),
        'terug 1, fout 80', m2.terug + ', ' + (m2.fout || '').length);
    await modelLogNoteer(null, null, 'niets gevonden');
    const m3 = lees(MODELLOG_SLEUTEL).slice(-1)[0] || {};
    eis('ML2d model niet gevonden: een regel zonder pad, bytes of hash, met de fout',
        m3.pad === null && !('bytes' in m3) && !('sha' in m3) && m3.fout === 'niets gevonden',
        'pad null, fout', JSON.stringify(m3).slice(0, 100));
    // Zoals in laadONNXModel: meteen na de aanroep gaat de buffer naar de worker
    // en is hij leeg. De hash moet toch van de echte inhoud zijn.
    const buf2 = inhoud.buffer.slice(0);
    const belofte = modelLogNoteer('./model.onnx', buf2, null);
    const kanaal = new MessageChannel(); kanaal.port1.postMessage(buf2, [buf2]); kanaal.port1.close(); kanaal.port2.close();
    await belofte;
    const m4 = lees(MODELLOG_SLEUTEL).slice(-1)[0] || {};
    eis('ML2f de hash klopt ook als de buffer direct daarna is overgedragen (en leeg is)',
        buf2.byteLength === 0 && m4.sha === verwacht && m4.bytes === inhoud.byteLength,
        'leeg, ' + verwacht, buf2.byteLength + ', ' + m4.sha);
    for (let i = 0; i < 12; i++) await modelLogNoteer('./model.onnx', null, null);
    eis('ML2e een ring van ' + MODELLOG_MAX, lees(MODELLOG_SLEUTEL).length === MODELLOG_MAX, MODELLOG_MAX, lees(MODELLOG_SLEUTEL).length);

    // ═══ ML3 — laadONNXModel ═══════════════════════════════════
    const lm = zc(laadONNXModel);
    const iE1 = lm.indexOf('catch(e1)'), iTerug = lm.indexOf('modelTerugvalFout =');
    const iLog = lm.indexOf('modelLogNoteer(modelPad, modelArrayBuffer, modelTerugvalFout)');
    const iPost = lm.indexOf("postMessage({ type:'initialiseer'");
    eis('ML3a de fout van de eerste laadpoging wordt onthouden, in catch(e1)',
        iE1 > 0 && iTerug > iE1 && iTerug < iE1 + 200, 'in catch(e1)', iE1 + ' / ' + iTerug);
    eis('ML3b het model wordt gelogd vóór de overdracht aan de worker (die maakt de buffer leeg)',
        iLog > 0 && iPost > iLog, 'eerst loggen', iLog + ' < ' + iPost);
    eis('ML3c ook "Model niet gevonden" laat een regel achter',
        /Model niet gevonden[\s\S]*modelLogNoteer\(null, null,/.test(lm), 'aanwezig', 'gelezen');
    // De aanroepen zelf: zonder camera draait er in een test geen echte run, dus
    // hier op de bron. Elk van de drie telpunten staat NA de verwerking.
    eis('ML3d de worker-uitslag telt mee, na _verwerkWorkerResultaat',
        /_verwerkWorkerResultaat\(detecties\);\s*minStatRun\(inferentieTijd, detecties\);/.test(lm), 'aanwezig', 'gelezen');
    const va = zc(voerAIUit);
    eis('ML3e de synchrone terugval telt ook mee, en de voorbewerking wordt om preprocessVoorYOLO heen gemeten',
        /_verwerkWorkerResultaat\(detecties\);\s*minStatRun\(inferentieTijd, detecties\);/.test(va)
          && /const tPre = performance\.now\(\);\s*const inputTensor = preprocessVoorYOLO\(\);\s*minStatPre\(performance\.now\(\) - tPre\);/.test(va),
        'aanwezig', 'gelezen');
    eis('ML3f startApp legt de camera vast direct nadat de track er is',
        /cameraTrack = stream\.getVideoTracks\(\)\[0\] \|\| null;\s*try \{ camcapNoteer\(cameraTrack\); \} catch \(_\) \{\}/.test(zc(startApp)),
        'aanwezig', 'gelezen');

    // ═══ ML4 — de minuutstatistiek ═════════════════════════════
    leeg();
    let klok = 1900000000000;
    Date.now = () => klok;
    minStat = null;
    const zet = (afst) => { dichtstbijOSM = afst == null ? null : { id: 880001, afstand: afst, lat: 52, lon: 5 }; };
    const det = (score) => { const alle = new Array(NC).fill(0.001); alle[0] = score;
                             return { klasse: 0, score, alleScores: alle, cx: 300, cy: 200, w: 12, h: 30 }; };
    frameT = 1000; snelheidKmh = 30;
    zet(50);  minStatRun(300, [det(0.6)]);                       // band 0, sterk
    klok += 10000; frameT += 280; zet(200); minStatRun(320, []); minStatPre(40);   // band 1
    klok += 5000;  frameT += 140; zet(300); minStatGegate(); minStatGegate(); minStatGegate();   // band 2
    klok += 5000;  frameT += 140; zet(null); minStatRun(310, [det(0.34)]);          // geen node, niet sterk
    klok += 5000;  frameT += 140; zet(500); minStatRun(330, [det(0.35)]);           // band 3, precies sterk
    for (const [dt, df] of [[9000, 252], [10000, 280], [10000, 280]]) {             // meetmomenten zonder run
      klok += dt; frameT += df; minStatPre(40);
    }
    eis('ML4a binnen de minuut wordt er niets geschreven', lees(MINUUTLOG_SLEUTEL).length === 0, 0, lees(MINUUTLOG_SLEUTEL).length);
    klok += 7000; frameT += 196; zet(50); minStatRun(300, []);      // 61 s na de start: minuut 1 dicht
    const mn = lees(MINUUTLOG_SLEUTEL);
    const mr = mn[0] || {};
    eis('ML4b na een volle minuut één regel: runs, inferentie, voorbewerking, snelheid',
        mn.length === 1 && mr.n === 4 && mr.inf === 315 && mr.pre === 40 && mr.kmh === 30 && mr.ms === 61000,
        'n 4, inf 315, pre 40, kmh 30, ms 61000', `n ${mr.n}, inf ${mr.inf}, pre ${mr.pre}, kmh ${mr.kmh}, ms ${mr.ms}`);
    eis('ML4c per band: runs, sterke detecties (>= 0,35) en gegate pogingen',
        JSON.stringify(mr.r) === '[1,1,0,1,1]' && JSON.stringify(mr.s) === '[1,0,0,1,0]' && JSON.stringify(mr.g) === '[0,0,3,0,0]',
        'r [1,1,0,1,1], s [1,0,0,1,0], g [0,0,3,0,0]', JSON.stringify(mr.r) + ' ' + JSON.stringify(mr.s) + ' ' + JSON.stringify(mr.g));
    eis('ML4d rAF-Hz = frames / seconden: 1708 in 61 s is 28,0', mr.hz === 28, 28, mr.hz);
    klok += 4000; frameT += 112; zet(60); minStatRun(300, []);        // minuut 2 loopt: 2 runs, 4 s
    klok += 25000; frameT += 0;  zet(60); minStatRun(300, []);        // gat van 25 s: minuut 2 dicht op het laatste moment
    const m2r = lees(MINUUTLOG_SLEUTEL)[1] || {};
    eis('ML4e een gat van meer dan 10 s sluit de minuut op het laatste meetmoment: de Hz zakt niet door stilte',
        m2r.n === 2 && m2r.ms === 4000 && m2r.hz === 28, 'n 2, ms 4000, hz 28', `n ${m2r.n}, ms ${m2r.ms}, hz ${m2r.hz}`);
    minStat = null; minStatNieuw(klok); klok += 70000; frameT += 1960;
    minStatSluit(klok, frameT);
    eis('ML4f een minuut zonder run en zonder poging wordt niet geschreven', lees(MINUUTLOG_SLEUTEL).length === 2, 2, lees(MINUUTLOG_SLEUTEL).length);
    for (let i = 0; i < MINUUTLOG_MAX + 5; i++) meetRingSchrijf(MINUUTLOG_SLEUTEL, MINUUTLOG_MAX, { t: i });
    const vol = lees(MINUUTLOG_SLEUTEL);
    eis('ML4g een ring van ' + MINUUTLOG_MAX, vol.length === MINUUTLOG_MAX && vol[vol.length - 1].t === MINUUTLOG_MAX + 4,
        MINUUTLOG_MAX + ', laatste ' + (MINUUTLOG_MAX + 4), vol.length + ', laatste ' + (vol.length ? vol[vol.length - 1].t : '-'));
    eis('ML4h de banden: 130 m hoort bij band 1, 129 bij 0, 250 bij 2, 400 bij 3, geen node bij 4',
        minBand(129) === 0 && minBand(130) === 1 && minBand(250) === 2 && minBand(400) === 3 && minBand(null) === 4 && minBand(NaN) === 4,
        '0/1/2/3/4', [minBand(129), minBand(130), minBand(250), minBand(400), minBand(null)].join('/'));
    Date.now = bewaard.nu;

    // ═══ ML5 — een vol quotum ══════════════════════════════════
    leeg();
    meetRingSchrijf(MINUUTLOG_SLEUTEL, MINUUTLOG_MAX, { t: 1 });
    opslagSchrijf = () => false;
    meetRingSchrijf(MINUUTLOG_SLEUTEL, MINUUTLOG_MAX, { t: 2 });
    opslagSchrijf = bewaard.schrijf;
    meetRingSchrijf(MINUUTLOG_SLEUTEL, MINUUTLOG_MAX, { t: 3 });
    meetRingSchrijf(CAMCAP_SLEUTEL, CAMCAP_MAX, { t: 4 });
    eis('ML5 een vol quotum staakt dat ene log voor de sessie en wist zijn sleutel; de andere logs gaan door',
        localStorage.getItem(MINUUTLOG_SLEUTEL) === null && meetRingGestopt.has(MINUUTLOG_SLEUTEL) && lees(CAMCAP_SLEUTEL).length === 1,
        'minuutlog weg en gestaakt, camcap 1', localStorage.getItem(MINUUTLOG_SLEUTEL) + ' / ' + lees(CAMCAP_SLEUTEL).length);

    // ═══ ML6 — de export ═══════════════════════════════════════
    leeg();
    localStorage.setItem(CAMCAP_SLEUTEL, JSON.stringify([{ t: 1, proef: 'cam' }]));
    localStorage.setItem(MODELLOG_SLEUTEL, JSON.stringify([{ t: 2, proef: 'model' }]));
    localStorage.setItem(MINUUTLOG_SLEUTEL, JSON.stringify([{ t: 3, proef: 'minuut' }]));
    const blobs = [];
    const bew = { url: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click, alert: window.alert,
                  cs: Object.getOwnPropertyDescriptor(navigator, 'canShare') };
    const schaduw = localStorage.getItem('sl_schaduwlog');
    try {
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:proef'; };
      HTMLAnchorElement.prototype.click = function () {};
      window.alert = () => {};
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
      exporteerMeetdata();
      for (let i = 0; i < 40 && blobs.length < 2; i++) await slaap(50);
    } finally {
      URL.createObjectURL = bew.url; HTMLAnchorElement.prototype.click = bew.klik; window.alert = bew.alert;
      if (bew.cs) Object.defineProperty(navigator, 'canShare', bew.cs); else delete navigator.canShare;
      if (schaduw !== null) localStorage.setItem('sl_schaduwlog', schaduw);
    }
    let meet = null;
    for (const b of blobs) { const j = JSON.parse(await b.text()); if (!Array.isArray(j.sleutels)) meet = j; }
    const pr = (bak, k) => meet && meet[bak] && Array.isArray(meet[bak][k]) && meet[bak][k][0] && meet[bak][k][0].proef;
    eis('ML6 de meetdata-export draagt camcap, model en minuut',
        pr('camcap', CAMCAP_SLEUTEL) === 'cam' && pr('model', MODELLOG_SLEUTEL) === 'model' && pr('minuut', MINUUTLOG_SLEUTEL) === 'minuut',
        'cam / model / minuut', meet ? [pr('camcap', CAMCAP_SLEUTEL), pr('model', MODELLOG_SLEUTEL), pr('minuut', MINUUTLOG_SLEUTEL)].join(' / ') : 'geen export');

    // ═══ ML7 — alleen meten ════════════════════════════════════
    // De vijf functies die V11.34.2 raakt, zijn zonder de gemarkeerde regels
    // byte-gelijk aan V11.34.1 (4093429). slaKanslozeRunOver niet: die schrijft
    // niet meer, en dat toetst test_gate T9.
    const V1134_1 = { laadONNXModel: ['68bca74a', 3813], voerAIUit: ['3ca5a888', 2330], detLogSchrijf: ['113e60c6', 2607],
                      startApp: ['f6f7a306', 4498], exporteerMeetdata: ['ef1e19bb', 7864] };
    const afw = Object.entries(V1134_1).filter(([n, [h, l]]) => { const s = zonderMeet(eval(n)); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
    eis('ML7a zonder de V11.34.2-regels zijn de vijf geraakte functies byte-gelijk aan V11.34.1',
        afw.length === 0, 'geen afwijking', afw.join(', ') || 'geen');
    const ONGEMOEID = { selecteerBesteDetectie: ['79a403fa', 14376], postprocessYOLO: ['42b30c6', 4725],
      _verwerkWorkerResultaatKern: ['23a782f3', 6144], _verwerkWorkerResultaat: ['16e601a6', 201],
      verwerkDetecties: ['caa90b0a', 8724], preprocessVoorYOLO: ['f379eecc', 2733], runIsKansloos: ['d631b73b', 1660],
      lus: ['251a0dd1', 3167], onGPS: ['58346b1c', 14246] };
    const af2 = Object.entries(ONGEMOEID).filter(([n, [h, l]]) => { const s = String(eval(n)); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
    eis('ML7b de keuze, de run, de poort, de lus en de GPS: negen functies byte-gelijk aan V11.34.1',
        af2.length === 0, 'geen afwijking', af2.join(', ') || 'geen');
    const meetBron = zc(camcapNoteer) + zc(modelLogNoteer) + zc(minStatRun) + zc(minStatPre) + zc(minStatGegate)
                   + zc(minStatSluit) + zc(minStatZeker) + zc(meetRingSchrijf);
    eis('ML7c de meetfuncties schrijven geen toestand waar een keuze op leunt',
        !/\b(fase|aiTeller|dichtstbijOSM|bboxOverride|stickyDetectie|handmatigLockActief|cropHintPositie|cropAlternatieTeller|gemiddeldeInferentieTijd|aiBezig)\s*=[^=]/.test(meetBron),
        'geen toewijzing', 'ok');
  } catch (e) {
    eis('geen crash', false, 'geen', String(e && e.stack || e).slice(0, 300));
  } finally {
    Date.now = bewaard.nu; opslagSchrijf = bewaard.schrijf;
    minStat = null; dichtstbijOSM = bewaard.dichtstbijOSM; frameT = bewaard.frameT; snelheidKmh = bewaard.snelheidKmh;
    meetRingGestopt.clear();
    for (const k of sleutels) { if (bewaardLs[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, bewaardLs[k]); }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testMeetregels = testMeetregels;
