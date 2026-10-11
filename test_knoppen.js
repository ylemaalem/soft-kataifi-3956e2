// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_knoppen.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.5: de richtingknoppen volgen het getoonde licht, en vier
//  meetregels. Niets aan de lichtkeuze verandert.
//
//  KM1  de knoppen na groen, heropenRichtingKeuze, en de tag- en VRI-knop horen
//       bij het licht dat de app NU toont
//  KM2  een richtingtik die niets doet, laat een regel richting_tik_leeg achter:
//       geen_licht, geen_rij, en het vangnet geen_effect; een gewone tik niet
//  KM3  de detlog bij stilstand onder 20 m: hooguit één regel per 2 s, met de
//       beste kandidaat en het filter dat hem afwees; dat filter zegt hetzelfde
//       als postprocessYOLO
//  KM4  logOpslagMis: gaat de regel over een ander licht dan het getoonde, dan
//       staan gt (het getoonde) en afN (de afstand tot node) erbij; afst houdt
//       zijn betekenis
//  KM5  het zichtlog-label: een fase die beeindigFase beëindigde heet
//       'einde-<reden>' (lijstkeuze: 'einde-handmatig'), niet 'reset-stale'
//  KM6  regressie: de lichtkeuze is byte-gelijk aan V11.37.4; de veranderde
//       functies dragen het merkteken
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_knoppen.js';
//      document.head.appendChild(s);
//      s.onload = () => testKnoppen().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testKnoppen() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const NL = String.fromCharCode(10);
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
  const opslag = () => { try { return JSON.parse(localStorage.getItem('sl_opslaglog')) || []; } catch (e) { return []; } };
  const namen = ['dichtstbijOSM', 'osmCache', 'huidigePos', 'richtingKnoppenNodeId', 'huidigBevestigdOsmNodeId', 'richtingLockNodeId', 'richtingLockKeuze',
    'richtingLockBron', 'richtingGedruktVoorNode', 'v9PreSelectieAfrij', 'v9AanrijHeading', 'v9AanrijSnelheidHeading', 'v9DelayedWriteActief', 'v9KandidaatNode',
    'preZet', 'bevestigActief', 'fase', 'faseStart', 'snelheidKmh', 'detLogAfst', 'detLogArr', 'detLogStilLaatst', 'detLogBest', 'debugLaatsteAlle',
    'faseEindeReden', 'faseEindeTijd', 'geenTeller', 'vriSuggestieActief', 'toonRichtingKnoppen'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
  const A = { id: 9900001, lat: 52.1716, lon: 5.4120, naam: 'A' }, B = { id: 9900002, lat: 52.1719, lon: 5.4127, naam: 'B' };

  try {
    // ═══ KM1 — het getoonde licht ═══════════════════════════════
    const vd = zc(verwerkDetecties);
    eis('KM1a de knoppen 3 s na groen gaan open voor het licht dat de app dan toont, niet voor huidigBevestigdOsmNodeId',
        vd.includes('if (snelheidKmh <= 30 && dichtstbijOSM) toonRichtingKnoppen(String(dichtstbijOSM.id));')
          && !vd.includes('if (snelheidKmh <= 30) toonRichtingKnoppen(huidigBevestigdOsmNodeId);'),
        'het getoonde licht', 'ok');
    const geopend = [];
    toonRichtingKnoppen = (id) => { geopend.push(String(id)); };
    osmCache = [A, B]; dichtstbijOSM = { ...B, afstand: 5 };
    richtingLockNodeId = String(A.id); richtingKnoppenNodeId = String(A.id); huidigBevestigdOsmNodeId = String(A.id);
    heropenRichtingKeuze();
    eis('KM1b heropenRichtingKeuze opent de knoppen voor het getoonde licht B, ook als het slot en de knoppen nog bij A horen',
        geopend.length === 1 && geopend[0] === String(B.id), 'B', geopend.join(',') || 'niets');
    toonRichtingKnoppen = bewaard.toonRichtingKnoppen;
    const btn = document.getElementById('sl-tag-btn'), ov = document.getElementById('sl-tag-overlay');
    if (btn && ov) {
      verbergTagUI(); vriSuggestieActief = false;
      dichtstbijOSM = { ...A, afstand: 5 };
      toonTagKnop(String(A.id));
      const zichtbaar = btn.style.display === 'block';
      dichtstbijOSM = { ...B, afstand: 5 };   // een wissel terwijl de knop nog staat
      btn.onclick();
      const naWissel = { btn: btn.style.display, ov: ov.style.display };
      dichtstbijOSM = { ...A, afstand: 5 };
      toonTagKnop(String(A.id)); btn.onclick();
      const zelfde = ov.style.display;
      verbergTagUI();
      eis('KM1c de tag-knop: na een wissel opent een tik geen tag-venster voor het oude licht (de knop verdwijnt); op hetzelfde licht wel',
          zichtbaar && naWissel.btn === 'none' && naWissel.ov === 'none' && zelfde === 'block', 'weg, en op A open', JSON.stringify({ zichtbaar, naWissel, zelfde }));
    } else {
      eis('KM1c de tag-knop staat in de pagina', false, 'sl-tag-btn en sl-tag-overlay', 'niet gevonden');
    }
    eis('KM1d de VRI-knop toetst eerst of zijn licht nog getoond wordt', /if \(!isGetoondLicht\(nodeId\)\)/.test(zc(checkVRISuggestie)),
        'isGetoondLicht', 'ok');
    eis('KM1e isGetoondLicht: alleen het licht dat de app toont', isGetoondLicht(String(A.id)) === true && isGetoondLicht(String(B.id)) === false
          && (() => { const d = dichtstbijOSM; dichtstbijOSM = null; const r = isGetoondLicht(String(A.id)); dichtstbijOSM = d; return r === false; })(),
        'A ja, B nee, zonder licht nee', 'ok');

    // ═══ KM2 — een richtingtik die niets doet ════════════════════
    localStorage.setItem('sl_opslaglog', '[]');
    dichtstbijOSM = null; richtingKnoppenNodeId = null; huidigBevestigdOsmNodeId = null;
    tikRichting('links', 'toevoeg');
    const l2a = opslag().filter(r => r.reden === 'richting_tik_leeg');
    eis('KM2a geen licht en geen knoppen: tikRichting schrijft niets, maar laat richting_tik_leeg achter (geen_licht, toevoeg)',
        l2a.length === 1 && l2a[0].poortReden === 'geen_licht' && l2a[0].element === 'toevoeg' && !opslag().some(r => r.reden === 'richting_tik'),
        '1 regel geen_licht/toevoeg', JSON.stringify(l2a.map(r => [r.poortReden, r.element])));
    localStorage.setItem('sl_opslaglog', '[]');
    kiesLaagRichting(9999);
    const l2b = opslag().filter(r => r.reden === 'richting_tik_leeg');
    eis('KM2b een rij die er niet meer is: richting_tik_leeg (geen_rij, rij)', l2b.length === 1 && l2b[0].poortReden === 'geen_rij' && l2b[0].element === 'rij',
        '1 regel geen_rij/rij', JSON.stringify(l2b.map(r => [r.poortReden, r.element])));
    // het vangnet: een vinger op de knop, en de klik komt niet aan
    localStorage.setItem('sl_opslaglog', '[]');
    const knop = document.createElement('button');
    knop.setAttribute('onclick', "tikRichting('links','toevoeg')");
    knop.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(knop);
    try {
      await slaap(10);   // niet in dezelfde milliseconde als de regel van KM2b (het vangnet telt die als 'al gemeten')
      knop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await slaap(RICHTING_TIK_WACHT_MS + 150);
      const l2c = opslag().filter(r => r.reden === 'richting_tik_leeg');
      eis('KM2c het vangnet: een vinger op een richtingknop zonder tikRichting binnen 500 ms geeft richting_tik_leeg (geen_effect, toevoeg)',
          l2c.length === 1 && l2c[0].poortReden === 'geen_effect' && l2c[0].element === 'toevoeg', '1 regel geen_effect', JSON.stringify(l2c.map(r => [r.poortReden, r.element])));
      // nu komt de klik wel aan, op het getoonde licht A
      localStorage.setItem('sl_opslaglog', '[]');
      osmCache = [A, B]; dichtstbijOSM = { ...A, afstand: 5 };
      localStorage.removeItem('sl_richting_' + A.id);
      knop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      tikRichting('links', 'toevoeg');
      await slaap(RICHTING_TIK_WACHT_MS + 150);
      const o2 = opslag();
      eis('KM2d een gewone richtingtik: één richting_tik, geen richting_tik_leeg (het vangnet zwijgt)',
          o2.filter(r => r.reden === 'richting_tik').length === 1 && !o2.some(r => r.reden === 'richting_tik_leeg'),
          'richting_tik, geen leeg', o2.map(r => r.reden).join(',') || 'niets');
    } finally { knop.remove(); localStorage.removeItem('sl_richting_' + A.id); }
    eis('KM2e de knoppen in het blok (toevoeg, rij) en de vraagknoppen vallen onder het vangnet; de Rond-licht-rij niet',
        document.querySelector ? (() => { const t = document.createElement('div'); t.innerHTML = '<div onclick="kiesLaagAlgemeen()"><span>x</span></div>';
          return t.firstChild.closest('[onclick*="tikRichting"],[onclick*="kiesLaagRichting"]') === null; })() : false, 'Rond licht niet', 'ok');

    // ═══ KM3 — de detlog bij stilstand vlak bij het licht ═════════
    const det = () => { try { return JSON.parse(localStorage.getItem('sl_detlog')) || []; } catch (e) { return []; } };
    localStorage.setItem('sl_detlog', '[]'); detLogArr = null; detLogStilLaatst = 0;
    dichtstbijOSM = { ...A, afstand: 5 };
    detLogBest = { s: 0.07, k: 0, cx: 500, cy: 200, w: 20, h: 40, maxY: 0.85, tap: false }; debugLaatsteAlle = null;
    snelheidKmh = 0; detLogAfst = 5;
    detLogSchrijf();
    const d1 = det();
    detLogSchrijf();   // meteen nog een keer: niet binnen 2 s
    const d2 = det();
    detLogStilLaatst -= DETLOG_STIL_MS;
    detLogSchrijf();
    const d3 = det();
    eis('KM3a stilstaand op 5 m: een regel met stil 1, de beste kandidaat (score 0,07) en het filter conf; binnen 2 s geen tweede, daarna wel',
        d1.length === 1 && d1[0].stil === 1 && d1[0].afst === 5 && d1[0].bs === 0.07 && d1[0].bf === 'conf' && d2.length === 1 && d3.length === 2,
        '1, 1, 2 regels; conf', JSON.stringify({ n: [d1.length, d2.length, d3.length], r: d1[0] }));
    localStorage.setItem('sl_detlog', '[]'); detLogArr = null; detLogStilLaatst = 0;
    snelheidKmh = 20; detLogAfst = 5; detLogSchrijf();
    const d4 = det();
    snelheidKmh = 20; detLogAfst = 50; detLogSchrijf();
    const d5 = det();
    eis('KM3b rijdend onder 20 m schrijft de detlog niets (zoals altijd); op 50 m een gewone regel zonder de nieuwe velden',
        d4.length === 0 && d5.length === 1 && d5[0].stil === undefined && d5[0].bf === undefined, '0, dan 1 gewone', JSON.stringify(d5));
    // Het filter zegt hetzelfde als postprocessYOLO: één anker per geval, klasse 0 (rood).
    const anker = (cx, cy, w, h, s) => { const d = new Float32Array(4 + NC); d[0] = cx; d[1] = cy; d[2] = w; d[3] = h; d[4] = s; return d; };
    snelheidKmh = 30;   // maxY = MAX_Y_RATIO
    const bbox = bboxOverride; bboxOverride = null;
    const gevallen = [['conf', anker(320, 200, 20, 40, 0.06)], ['laag', anker(320, 0.9 * YOLO_SIZE, 20, 40, 0.5)], ['klein', anker(320, 200, 4, 3, 0.5)],
                      ['breed', anker(320, 200, 0.7 * YOLO_SIZE, 300, 0.5)], ['plat', anker(320, 200, 60, 20, 0.5)], ['door', anker(320, 200, 20, 40, 0.5)]];
    const uit = [];
    for (const [verwacht, data] of gevallen) {
      const dets = postprocessYOLO(data, [1, 4 + NC, 1]);
      const fam = (KLASSE_MAP[detLogBest.k] && Array.isArray(debugLaatsteAlle)) ? famSom(debugLaatsteAlle, KLASSE_MAP[detLogBest.k], detLogBest.s) : detLogBest.s;
      const f = detLogAfwijsFilter(detLogBest, fam);
      uit.push({ verwacht, f, door: dets.length });
    }
    bboxOverride = bbox;
    eis('KM3c het filter van de detlog zegt hetzelfde als postprocessYOLO: conf, laag, klein, breed en plat afgewezen, door doorgelaten',
        uit.every(x => x.f === x.verwacht && (x.verwacht === 'door' ? x.door === 1 : x.door === 0)), 'zes keer gelijk', JSON.stringify(uit));
    postprocessYOLO(new Float32Array(4 + NC), [1, 4 + NC, 1]);
    eis('KM3d zonder enig anker boven nul is er geen beste kandidaat: bf geen', detLogBest === null && detLogBestVelden().bf === 'geen', 'geen', JSON.stringify(detLogBestVelden()));
    eis('KM3e de constanten: onder 3 km/u, hooguit één regel per 2 s', DETLOG_STIL_KMH === 3 && DETLOG_STIL_MS === 2000 && DETLOG_MIN_M === 20,
        '3/2000/20', [DETLOG_STIL_KMH, DETLOG_STIL_MS, DETLOG_MIN_M].join('/'));

    // ═══ KM4 — logOpslagMis: welk licht hoort bij afst ═══════════
    localStorage.setItem('sl_opslaglog', '[]');
    osmCache = [A, B]; huidigePos = { lat: 52.1700, lon: 5.4100 };
    dichtstbijOSM = { ...B, afstand: 123 };
    logOpslagMis('kandidaat_verlaten', { node: String(A.id) });
    logOpslagMis('te_kort', { node: String(B.id), dur: 3 });
    const o4 = opslag();
    const afA = Math.round(afstand(huidigePos.lat, huidigePos.lon, A.lat, A.lon));
    eis('KM4a een regel over A terwijl B getoond wordt: node A, afst blijft die van B (123), gt = B, afN = de afstand tot A',
        o4[0] && o4[0].node === String(A.id) && o4[0].afst === 123 && o4[0].gt === String(B.id) && o4[0].afN === afA,
        `A, 123, gt B, afN ${afA}`, JSON.stringify(o4[0] && { node: o4[0].node, afst: o4[0].afst, gt: o4[0].gt, afN: o4[0].afN }));
    eis('KM4b een regel over het getoonde licht krijgt de nieuwe velden niet', o4[1] && o4[1].gt === undefined && o4[1].afN === undefined,
        'geen gt/afN', JSON.stringify(o4[1] && { gt: o4[1].gt, afN: o4[1].afN }));

    // ═══ KM5 — het zichtlog-label ════════════════════════════════
    geenTeller = 0;
    beeindigFase('handmatig');
    const lbl1 = zichtOorzaak('NEUTRAAL', Date.now());
    faseEindeTijd = Date.now() - 2000;
    const lbl2 = zichtOorzaak('NEUTRAAL', Date.now());
    eis('KM5a een fase beëindigd door een lijstkeuze heet einde-handmatig; 2 s later weer zoals vroeger (reset-stale)', lbl1 === 'einde-handmatig' && lbl2 === 'reset-stale',
        'einde-handmatig, reset-stale', lbl1 + ', ' + lbl2);
    eis('KM5b selecteerNodeHandmatig beëindigt de fase met de reden handmatig', /beeindigFase\('handmatig'\)/.test(zc(selecteerNodeHandmatig)), 'ja', 'ok');
  } finally {
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    herstel();
  }

  // ═══ KM6 — regressie ═══════════════════════════════════════
  const V11374 = { vindDichtbij: ['55d1f775', 3320], updateDichtbij: ['42aee748', 12051], onGPS: ['d99821b8', 15000], regelKies: ['d8d1f767', 1993],
    achterTik: ['e9e105a3', 1583], achterSluitUit: ['6b7a87d8', 383], voorbijStap: ['fe074cf3', 540], geenLichtZetten: ['b480c850', 1591],
    checkHandLockVerval: ['2df4f7ed', 5513], checkHandLockPassage: ['7f001264', 1768], checkNodeCorrectieStilstand: ['8c801fd8', 4751],
    corrigeerNodeAutomatisch: ['afe7b427', 4118], checkTikSlotSnel: ['d3a8edbe', 2071], vindDichtbijScore: ['bc9b7937', 2105],
    selecteerNodeHandmatig: ['5275f4dd', 2379], vergrendelNodeHandmatig: ['9a007b96', 2295], regelTik: ['9c1b361b', 3087], wisselNa: ['3f24e1b0', 2527] };
  const zonderV113715 = (s) => String(s).split('\n').filter(l => !/V11\.37\.15(?!\d)/.test(l)).join('\n');   // V11.37.15: de koersmeting (test_koerslog); hier terug
  const zonderV113713 = (s) => zonderV113715(s).split('\n').filter(l => !/V11\.37\.13(?!\d)/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12(?!\d)/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11(?!\d)/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const terugV11378 = (s) => zonderV113711(s).replace("      if (wisselStaat.min === null || af < wisselStaat.min) { wisselStaat.min = af; wisselStaat.minT = Date.now(); }   // V11.37.8: en wanneer (tMin)", "      if (wisselStaat.min === null || af < wisselStaat.min) wisselStaat.min = af;").replace("  if (!dichtstbijOSM) { logOpslagMis('bevestig_geen_licht', { element: categorie }); return; }   // V11.37.8: niet meer stil", "  if (!dichtstbijOSM) return;").split('\n').filter(l => !/V11\.37\.8(?!\d)/.test(l)).join('\n');   // V11.37.8: het fietsfilter en de bevroren knoppen (test_fietslicht); hier terug
  const anders = Object.entries(V11374).filter(([n, [h, l]]) => { const s = terugV11378(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('KM6a de lichtkeuze is onaangeroerd: achttien functies (onGPS, NB14, de achter-regel, de schaduwregel, de wissellog) byte-gelijk aan V11.37.4',
      anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const merk = (f) => (String(f).match(/V11\.37\.5(?!\d)/g) || []).length;
  const telling = { tikRichting: merk(tikRichting), kiesLaagRichting: merk(kiesLaagRichting), verwerkDetecties: merk(verwerkDetecties),
    heropenRichtingKeuze: merk(heropenRichtingKeuze), toonTagKnop: merk(toonTagKnop), checkVRISuggestie: merk(checkVRISuggestie),
    detLogSchrijf: merk(detLogSchrijf), postprocessYOLO: merk(postprocessYOLO), logOpslagMis: merk(logOpslagMis), beeindigFase: merk(beeindigFase), zichtOorzaak: merk(zichtOorzaak) };
  const verwacht = { tikRichting: 2, kiesLaagRichting: 1, verwerkDetecties: 1, heropenRichtingKeuze: 2, toonTagKnop: 1, checkVRISuggestie: 3,
    detLogSchrijf: 4, postprocessYOLO: 5, logOpslagMis: 6, beeindigFase: 1, zichtOorzaak: 2 };
  eis('KM6b de elf veranderde functies dragen het merkteken V11.37.5 op elke veranderde regel', JSON.stringify(telling) === JSON.stringify(verwacht),
      JSON.stringify(verwacht), JSON.stringify(telling));

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testKnoppen = testKnoppen;
