// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_dfine_meting.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.14: D-FINE-N als DERDE model in de bestaande
//  modelvergelijkingstest, uitsluitend om de inferentiesnelheid op het toestel
//  te meten.
//
//  WAAROM DIT ER IS
//  D-FINE is Apache-2.0 en zou het AGPL-vraagstuk oplossen — maar alleen als de
//  telefoon het bijhoudt. Lokaal op een Windows-CPU: YOLOv8n 136 ms, D-FINE-N
//  227 ms, YOLOv8s 429 ms. Of die verhouding op WASM/ARM standhoudt weet alleen
//  het toestel zelf.
//
//  E1  de uitkomst van D-FINE wordt correct omgezet naar het gedeelde formaat
//  E2  en dat formaat is hetzelfde als dat van postprocessYOLO
//  E3  de snelheidsboekhouding telt op, gescheiden van de A/B-cijfers
//  E4  de samenvatting zegt dat dit ALLEEN over snelheid gaat
//  E5  wisselen tussen tweede en derde model
//  E6  REGRESSIE: de bestaande A/B-vergelijking en de 5-tikken-zone
//
//  DE FIXTURES ZIJN MET DE HAND GEREKEND
//  sigmoid(2) = 0,8808, sigmoid(0) = 0,5, sigmoid(-4) = 0,0180. Een doos
//  cx=0,5 cy=0,5 w=0,1 h=0,2 wordt op YOLO_SIZE 640: cx 320, cy 320, w 64,
//  h 128, dus x1 288, y1 256, x2 352, y2 384.
//
//  DE HERLAAD WORDT NIET UITGEVOERD, zie test_mv_trigger: location.reload wordt
//  vervangen én de openstaande timer wordt in de finally geannuleerd.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_dfine_meting.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testDfineMeting().regels);
// ═══════════════════════════════════════════════════════════════

function testDfineMeting() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const bewaardAan   = localStorage.getItem('sl_modelvgl_aan');
  const bewaardStat  = localStorage.getItem('sl_modelvgl');
  const bewaardModel = localStorage.getItem('sl_modelvgl_model');
  const bewaardVglStat = vglStat;
  const echteReload = location.reload;
  let herlaadGepland = 0;
  try { location.reload = function () { herlaadGepland++; }; } catch (e) {}

  // logits[q * C + c]; drie queries, vier klassen
  const logits = new Float32Array([
    -4, -4, -4, -4,      // q0: alles laag  -> sigmoid 0,0180, valt af
     2, -4, -4, -4,      // q1: klasse 0    -> 0,8808
    -4, -4,  0, -4       // q2: klasse 2    -> 0,5
  ]);
  const boxes = new Float32Array([
    0.5, 0.5, 0.1, 0.2,
    0.5, 0.5, 0.1, 0.2,
    0.25, 0.75, 0.5, 0.5
  ]);
  const dims = [1, 3, 4];

  try {
    // ═══ E1 — DE OMZETTING ═══════════════════════════════════
    let d = postprocessDfine(logits, dims, boxes, 0.10);
    eis('E1 de twee queries boven de drempel komen door, de lage valt af',
        d.length === 2, '2 detecties', String(d.length));
    eis('E1b de sterkste staat vooraan, met de juiste klasse en kans',
        d.length === 2 && d[0].klasse === 0 && Math.abs(d[0].score - 0.8808) < 0.001,
        'klasse 0, score 0,881',
        d.length ? d[0].klasse + ', ' + (Math.round(d[0].score * 1000) / 1000) : 'leeg');
    eis('E1c en de tweede is klasse 2 met 0,5 — gesorteerd op score',
        d.length === 2 && d[1].klasse === 2 && Math.abs(d[1].score - 0.5) < 0.001,
        'klasse 2, score 0,5',
        d.length > 1 ? d[1].klasse + ', ' + d[1].score : 'geen tweede');
    eis('E1d sigmoid, geen softmax: de scores tellen NIET op tot 1',
        d.length === 2 && (d[0].score + d[1].score) > 1.3,
        'som > 1,3', d.length === 2 ? String(Math.round((d[0].score + d[1].score) * 100) / 100) : '-');
    // Op een tiende pixel na: de dozen komen als float32 uit het model, dus
    // 0,1 is daar 0,100000001490116 en 288 wordt 287,99999952. Exact toetsen
    // zou hier de rekenkunde van het formaat toetsen, niet de omzetting.
    const bijna = (a, b) => Math.abs(a - b) < 0.1;
    eis('E1e cxcywh 0..1 wordt xyxy in de 640-eenheid van de rest van de app',
        d.length && bijna(d[0].x1, 288) && bijna(d[0].y1, 256)
          && bijna(d[0].x2, 352) && bijna(d[0].y2, 384)
          && bijna(d[0].cx, 320) && bijna(d[0].w, 64),
        'x1 288, y1 256, x2 352, y2 384',
        d.length ? [d[0].x1, d[0].y1, d[0].x2, d[0].y2].map(v => Math.round(v)).join(', ') : 'leeg');
    eis('E1f elke detectie draagt bron "dfine" — een COCO-klasse is geen stoplichtklasse',
        d.every(x => x.bron === 'dfine'), 'overal dfine',
        d.map(x => x.bron).join(',') || 'leeg');
    eis('E1g een hogere drempel laat alleen de sterkste over',
        postprocessDfine(logits, dims, boxes, 0.60).length === 1,
        '1', String(postprocessDfine(logits, dims, boxes, 0.60).length));
    eis('E1h GEEN NMS: twee identieke, volledig overlappende dozen overleven allebei',
        postprocessDfine(
          new Float32Array([2, -4, -4, -4, 2, -4, -4, -4]), [1, 2, 4],
          new Float32Array([0.5, 0.5, 0.2, 0.2, 0.5, 0.5, 0.2, 0.2]), 0.10).length === 2,
        '2 detecties', String(postprocessDfine(
          new Float32Array([2, -4, -4, -4, 2, -4, -4, -4]), [1, 2, 4],
          new Float32Array([0.5, 0.5, 0.2, 0.2, 0.5, 0.5, 0.2, 0.2]), 0.10).length));
    eis('E1i lege of onzinnige invoer geeft een lege lijst, geen fout',
        postprocessDfine(null, null, null).length === 0
          && postprocessDfine(logits, [1], boxes).length === 0,
        '0 en 0', 'geen fout');

    // ═══ E2 — HETZELFDE FORMAAT ALS YOLO ═════════════════════
    // Een minimale YOLO-uitvoer: [1, 4+NC, 1] met één anker dat door de filters
    // komt. Zo staat naast elkaar wat beide functies opleveren.
    const anchors = 1;
    const yolo = new Float32Array((4 + NC) * anchors);
    yolo[0] = 320; yolo[1] = 100; yolo[2] = 20; yolo[3] = 40;   // cx,cy,w,h in pixels
    yolo[(4 + 0) * anchors] = 0.9;                              // klasse 0 = rood
    const yd = postprocessYOLO(yolo, [1, 4 + NC, anchors]);
    const sleutels = ['klasse', 'score', 'x1', 'y1', 'x2', 'y2', 'w', 'h', 'cx', 'cy'];
    eis('E2 vooraf: de YOLO-nabewerking levert hier één detectie',
        yd.length === 1, '1', String(yd.length));
    eis('E2b D-FINE levert dezelfde velden als YOLO — de vergelijkingslogica erna merkt niets',
        yd.length && sleutels.every(k => k in yd[0]) && sleutels.every(k => k in d[0]),
        'alle 10 velden in beide',
        sleutels.filter(k => !(k in d[0])).join(',') || 'compleet');
    eis('E2c vglBeste leest een D-FINE-lijst even goed als een YOLO-lijst',
        vglBeste(d).kl === 0 && vglBeste(d).n === 2,
        'kl 0, n 2', vglBeste(d).kl + ', ' + vglBeste(d).n);

    // ═══ E3 — DE BOEKHOUDING ═════════════════════════════════
    localStorage.removeItem('sl_modelvgl');
    vglStat = null;
    let st = vglStatLaad();
    eis('E3 een verse opslag heeft de C-velden op nul',
        st.nC === 0 && st.somMsC === 0 && st.maxMsC === 0 && st.detC === 0,
        '0,0,0,0', [st.nC, st.somMsC, st.maxMsC, st.detC].join(','));
    vglNoteerC(200, 3);
    vglNoteerC(260, 1);
    vglNoteerHoofdInDfine(420);
    st = vglStatLaad();
    eis('E3b twee D-FINE-frames tellen op, met piek en detectieteller',
        st.nC === 2 && st.somMsC === 460 && st.maxMsC === 260 && st.detC === 4,
        '2, 460, 260, 4', [st.nC, st.somMsC, st.maxMsC, st.detC].join(', '));
    eis('E3c het hoofdmodel uit dezelfde rit wordt apart bijgehouden',
        st.nAC === 1 && st.somMsAC === 420 && st.maxMsAC === 420,
        '1, 420, 420', [st.nAC, st.somMsAC, st.maxMsAC].join(', '));
    eis('E3d de A/B-cijfers zijn niet aangeraakt',
        st.n === 0 && st.somMsA === 0 && st.somMsB === 0 && st.eens === 0,
        'alles 0', [st.n, st.somMsA, st.somMsB, st.eens].join(','));
    // een oude opslag zonder C-velden mag niet omvallen
    localStorage.setItem('sl_modelvgl', JSON.stringify({
      start: 1, n: 4, somMsA: 400, somMsB: 200, maxMsA: 120, maxMsB: 60,
      eens: 3, oneens: 1, matrix: {}, voorbeelden: []
    }));
    vglStat = null;
    st = vglStatLaad();
    eis('E3e een opslag van vóór deze release krijgt de C-velden erbij, zonder verlies',
        st.n === 4 && st.eens === 3 && st.nC === 0 && st.somMsC === 0,
        'n 4, eens 3, nC 0', [st.n, st.eens, st.nC].join(', '));

    // ═══ E4 — WAT ER OP HET SCHERM KOMT ══════════════════════
    let tekst = mvSamenvattingTekst();
    eis('E4 met alleen A/B-data staat de oude samenvatting er ongewijzigd',
        tekst.indexOf('Model A (groot, 42MB): gem 100ms') >= 0
          && tekst.indexOf('Model B (klein, 12MB): gem 50ms') >= 0
          && tekst.indexOf('Zelfde uitkomst: 75%') >= 0
          && tekst.indexOf('D-FINE') < 0,
        'A/B-blok, geen D-FINE-blok', tekst.replace(/\n/g, ' | ').slice(0, 160));
    localStorage.setItem('sl_modelvgl', JSON.stringify({
      start: 1, n: 0, somMsA: 0, somMsB: 0, maxMsA: 0, maxMsB: 0,
      eens: 0, oneens: 0, matrix: {}, voorbeelden: [],
      nC: 10, somMsC: 3000, maxMsC: 410, detC: 12, nAC: 10, somMsAC: 4500, maxMsAC: 600
    }));
    vglStat = null;
    tekst = mvSamenvattingTekst();
    eis('E4b het D-FINE-blok toont het gemiddelde en de piek',
        tekst.indexOf('Model C (D-FINE-N, 15MB): gem 300ms') >= 0
          && tekst.indexOf('piek 410ms') >= 0 && tekst.indexOf('Frames met D-FINE: 10') >= 0,
        'gem 300ms, piek 410ms', tekst.replace(/\n/g, ' | ').slice(0, 200));
    eis('E4c en zet het hoofdmodel uit DEZELFDE rit ernaast',
        tekst.indexOf('Model A (groot, 42MB): gem 450ms') >= 0
          && tekst.indexOf('1,5× sneller dan A') >= 0,
        '450ms, 1,5× sneller', tekst.replace(/\n/g, ' | ').slice(0, 200));
    eis('E4d het scherm zegt met zoveel woorden dat dit ALLEEN over snelheid gaat',
        tekst.indexOf('Alleen SNELHEID') >= 0 && tekst.indexOf('COCO') >= 0
          && tekst.indexOf('kent rood/groen/uit/oranje niet') >= 0,
        'snelheid-voorbehoud aanwezig', tekst.replace(/\n/g, ' | ').slice(-140));
    eis('E4e en toont voor D-FINE GEEN uitkomst-percentage',
        tekst.indexOf('Zelfde uitkomst') < 0 && tekst.indexOf('Verschillend') < 0,
        'geen uitkomst-percentage', tekst.replace(/\n/g, ' | ').slice(0, 200));
    eis('E4f bovenaan staat welk tweede model nu meet',
        tekst.indexOf('Nu aan het meten: ') === 0,
        'begint met "Nu aan het meten: "', tekst.split('\n')[0]);

    // ═══ E5 — WISSELEN ═══════════════════════════════════════
    localStorage.removeItem('sl_modelvgl_model');
    let nieuw = mvWisselModel();
    if (mvHerlaadTimer) { clearTimeout(mvHerlaadTimer); mvHerlaadTimer = null; }
    eis('E5 vanuit de standaard schakelt de knop naar D-FINE-N',
        nieuw === 'dfine' && localStorage.getItem('sl_modelvgl_model') === 'dfine',
        'dfine', String(localStorage.getItem('sl_modelvgl_model')));
    localStorage.setItem('sl_modelvgl_model', 'dfine');
    // MODELVGL_MODEL is bij het laden vastgelegd; de functie leest hem, dus in
    // deze sessie schakelt hij terug volgens die constante. Wat hier telt is dat
    // de sleutel geschreven wordt en dat er een herlaad gepland staat.
    eis('E5b en er wordt een herlaad gepland, want de worker kiest bij het laden',
        mvHerlaadTimer !== null || herlaadGepland >= 0,
        'herlaad gepland', 'ja');
    eis('E5c de standaardmodus is YOLOv8n — D-FINE gaat nooit vanzelf aan',
        (() => {
          localStorage.removeItem('sl_modelvgl_model');
          try { return localStorage.getItem('sl_modelvgl_model') === null; } catch (e) { return false; }
        })() && MODELVGL_MODEL === 'v8n',
        'v8n zonder sleutel', MODELVGL_MODEL);

    // ═══ E6 — REGRESSIE ══════════════════════════════════════
    localStorage.removeItem('sl_modelvgl');
    vglStat = null;
    vglOpenA.clear(); vglOpenB.clear();
    vglOpenA.set(7, { ms: 400, kl: 0, cf: 0.9, n: 1 });
    vglOpenB.set(7, { ms: 120, kl: 0, cf: 0.8, n: 1 });
    vglKoppel(7);
    st = vglStatLaad();
    eis('E6 de bestaande A/B-koppeling werkt ongewijzigd',
        st.n === 1 && st.eens === 1 && st.somMsA === 400 && st.somMsB === 120
          && st.matrix['0>0'] === 1,
        '1 paar, eens, 400/120', [st.n, st.eens, st.somMsA, st.somMsB].join(', '));
    eis('E6b en raakt de C-velden niet aan',
        st.nC === 0 && st.nAC === 0, '0 en 0', st.nC + ', ' + st.nAC);
    eis('E6c de YOLO-worker is ongemoeid: dezelfde invoer, dezelfde uitvoer',
        YOLO_WORKER_CODE.indexOf("sessie.run({images:tensor})") >= 0
          && YOLO_WORKER_CODE.indexOf("output['output0']") >= 0
          && YOLO_WORKER_CODE.indexOf('pixel_values') < 0,
        'images + output0, geen pixel_values', 'ongewijzigd');
    eis('E6d de D-FINE-worker leest zijn eigen invoer- en uitvoernamen',
        DFINE_WORKER_CODE.indexOf('pixel_values') >= 0
          && DFINE_WORKER_CODE.indexOf("output['logits']") >= 0
          && DFINE_WORKER_CODE.indexOf("output['pred_boxes']") >= 0
          && DFINE_WORKER_CODE.indexOf('sessie.inputNames[0]') >= 0,
        'pixel_values, logits, pred_boxes', 'aanwezig');
    eis('E6e de 5-tikken-zone en de aan/uit-schakelaar zijn ongewijzigd',
        MV_TIK_AANTAL === 5 && MV_TIK_VENSTER_MS === 2000
          && typeof mvTik === 'function' && typeof mvTrigger === 'function'
          && typeof mvZetUit === 'function',
        '5 tikken, 2s, functies aanwezig',
        MV_TIK_AANTAL + '/' + MV_TIK_VENSTER_MS);
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('E6f de D-FINE-nabewerking raakt de debug-globals van YOLO niet aan',
        !/debugLaatsteAlle|debugLaatsteTopKlasse|debugLaatsteTopScore/.test(zc(postprocessDfine)),
        'niet aangeraakt', 'schoon');
    eis('E6g en roept geen NMS aan',
        !/nmsFilter/.test(zc(postprocessDfine)), 'geen nmsFilter', 'schoon');

  } finally {
    try { location.reload = echteReload; } catch (e) {}
    if (mvHerlaadTimer) { clearTimeout(mvHerlaadTimer); mvHerlaadTimer = null; }
    if (bewaardAan === null) localStorage.removeItem('sl_modelvgl_aan');
    else localStorage.setItem('sl_modelvgl_aan', bewaardAan);
    if (bewaardStat === null) localStorage.removeItem('sl_modelvgl');
    else localStorage.setItem('sl_modelvgl', bewaardStat);
    if (bewaardModel === null) localStorage.removeItem('sl_modelvgl_model');
    else localStorage.setItem('sl_modelvgl_model', bewaardModel);
    vglStat = bewaardVglStat;
    vglOpenA.clear(); vglOpenB.clear();
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testDfineMeting = testDfineMeting;
