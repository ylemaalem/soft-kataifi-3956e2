// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_snelroute.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.2: de snelle stilstandroute voor een tikslot.
//
//  Het veldgeval (4 oktober 12:06, Amersfoort), recht noord gedraaid: je stopt
//  op (0, 0); Schuilenburgerweg C staat 5 m recht vooruit, Ringweg-Randenbroek W
//  23 m schuin rechts (52 graden). Tijdens het aanrijden tikte Younes op het
//  beeld terwijl de app W toonde.
//
//  SN1  de constanten, en het merkteken staat in de tik-handler direct na het
//       vastzetten van de node
//  SN2  het veldgeval: wissel naar C op de derde stilstaande GPS-tik (2 s), de
//       getikte lamp blijft, het slot wordt het stilstandslot op C, één regel
//       snel_correctie, wissellog-reden 'snel'
//  SN3  zonder de route: de vervalroute, pas na ~6 s, en de lamp weg
//  SN4  met de naderingsroute aan: die beslist eerst (1 s), deze route doet niets
//  SN5  NIETS ANDERS VERANDERT: in acht gevallen waarin de route niet mag
//       ingrijpen (lijstkeuze, tik en daarna lijstkeuze, stilstandslot, doorrijden, licht verder dan 30 m,
//       marge onder 8 m, koers boven 60 graden, kort na een vorige correctie) is
//       elke GPS-tik met en zonder de route gelijk
//  SN6  regressie: de vijf vastgepinde functies (NB14) zijn byte-gelijk; onGPS
//       zonder de V11.37.2-regel is gelijk aan V11.37.1; de plek in onGPS
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_snelroute.js';
//      document.head.appendChild(s);
//      s.onload = () => testSnelroute().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
// opt: { nodes, start, slot: 'tik'|'lijst'|'auto'|null, lamp, uitSnel, uitNadering,
//        stukken: [{ vanY, totY, kmh } | { tikken, kmh: 0 }] }
async function snelRitBinnen(opt) {
  const LAT0 = 52.1550, LON0 = 5.3870;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  const toasts = [];
  window.toonToast = (tekst, knop) => { toasts.push({ tekst, knop: knop && knop.label }); };
  if (opt.uitSnel) window.checkTikSlotSnel = () => {};
  if (opt.uitNadering) window.checkNaderingsCorrectie = () => {};
  try { for (const k of ['sl_wissellog', 'sl_opslaglog', 'sl_regellog', TIKLOG_SLEUTEL]) localStorage.setItem(k, '[]'); } catch (e) {}
  tikLogArr = null; tikLogStop = false; tikLogVorige = { tak: null, t: 0 }; tikLogLevend = null;
  osmCache = opt.nodes.map(n => ({ id: n.id, naam: String(n.id), ...LL(n.x, n.y) }));
  cacheGeladen = true; cacheBezig = false; cacheCentrum = LL(0, 0);
  eersteGPSVerwerkt = true;
  clusterNodes = new Set();
  const start = osmCache.find(n => n.id === opt.start);
  dichtstbijOSM = { ...start, afstand: 150 }; vorigOsmId = start.id;
  handmatigLockActief = false; stilstandAutoLock = false;
  handmatigGeselecteerdNodeId = null; handmatigGeselecteerdTimestamp = 0;
  stilstandSinds = 0; laatsteNodeCorrectieTijd = 0; laatsteNodeWisselTijd = 0;
  headingBuffer.length = 0;
  hoekStabielReset(); handLockVervalReset(); naderBewijsReset();
  wisselStaat = null; wisselTik = null; a3Reeks = null; a3LosTijd = 0;
  if (typeof regelReset === 'function') regelReset();
  tikSlotMerk = null; snelReset();
  if (opt.slot === 'tik') {
    // precies wat de tik-handler doet (SN1 toetst dat die regel daar staat)
    vergrendelNodeHandmatig(start.id, 'beeld');
    tikSlotMerk = { id: String(start.id), ts: handmatigGeselecteerdTimestamp };
  } else if (opt.slot === 'tik+lijst') {
    // eerst een tik, daarna een keuze uit de lijst op hetzelfde licht: de mens heeft gekozen
    vergrendelNodeHandmatig(start.id, 'beeld');
    tikSlotMerk = { id: String(start.id), ts: handmatigGeselecteerdTimestamp };
    klok += 500;
    vergrendelNodeHandmatig(start.id, 'lijst');
  } else if (opt.slot === 'lijst') {
    vergrendelNodeHandmatig(start.id, 'lijst');
  } else if (opt.slot === 'auto') {
    handmatigGeselecteerdNodeId = String(start.id); handmatigLockActief = true; stilstandAutoLock = true;
  }
  if (opt.lamp) {
    tikZet(null, 1000, 800);
    stickyDetectie = { cx: 320, cy: 240, camX: 1000, camY: 800, camH: 40, bron: 'tik', tijd: klok, klasse: 0, familie: 'rood' };
    bboxOverrideLaatsteMatch = klok;
  }
  if (opt.recenteCorrectie) laatsteNodeCorrectieTijd = klok;   // een correctie vlak voor de rit
  const t0 = klok, rij = [];
  let laatsteY = null;
  for (const st of opt.stukken) {
    const v = st.kmh / 3.6;
    const van = (laatsteY !== null) ? laatsteY : st.vanY;
    const stappen = st.kmh > 0 ? Math.max(1, Math.floor((st.totY - van) / v)) : st.tikken;
    for (let i = st.kmh > 0 && laatsteY !== null ? 1 : 0; i <= stappen; i++) {
      klok += 1000;
      const y = st.kmh > 0 ? van + i * v : van;
      laatsteY = y;
      if (opt.lamp) bboxOverrideLaatsteMatch = klok;   // de lamp blijft in beeld
      const q = LL(0, y);
      await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: v > 0 ? 1 : NaN }, timestamp: klok });
      rij.push({ s: Math.round((klok - t0) / 1000), y: Math.round(y), kmh: st.kmh, stil: stilstandSinds ? Math.round((klok - stilstandSinds) / 1000) : null,
                 app: dichtstbijOSM ? dichtstbijOSM.id : null, slot: handmatigLockActief ? 1 : 0, auto: stilstandAutoLock ? 1 : 0,
                 lamp: bboxOverride !== null ? 1 : 0 });
    }
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const op = lees('sl_opslaglog').filter(r => /snel_correctie|handlock_vervallen|node_auto_correctie|nadering_correctie/.test(r.reden))
    .map(r => ({ reden: r.reden, node: r.node, nieuw: r.nieuw, dur: r.dur, hoekN: r.hoekN, afwM: r.afwM }));
  return { rij, wissel: lees('sl_wissellog'), op, toasts, tik: lees(TIKLOG_SLEUTEL) };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testSnelroute() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };

  // ═══ SN1 — constanten en het merkteken ═════════════════════
  eis('SN1a de constanten: aan, 1 s, 30 m, 2 tikken; de poorten zijn die van de vervalroute (8 m, 60 graden, 3 km/u, 10 s)',
      SNEL_ACTIEF === true && SNEL_STIL_MS === 1000 && SNEL_MAX_M === 30 && SNEL_STABIEL_N === 2 && NODE_CHK_CORRECTIE_MARGE_M === 8
        && NODE_CHK_HEADING_MAX_GRAD === 60 && NODE_CHK_STANDSTILL_KMH === 3 && NODE_WISSEL_MIN_INTERVAL_MS === 10000,
      'aan/1000/30/2/8/60/3/10000', [SNEL_ACTIEF, SNEL_STIL_MS, SNEL_MAX_M, SNEL_STABIEL_N, NODE_CHK_CORRECTIE_MARGE_M, NODE_CHK_HEADING_MAX_GRAD,
        NODE_CHK_STANDSTILL_KMH, NODE_WISSEL_MIN_INTERVAL_MS].join('/'));
  let bronTekst = '';
  try { bronTekst = await (await fetch(location.pathname + '?bron=' + Date.now())).text(); } catch (e) {}
  const NL = String.fromCharCode(10);
  const bronRegels = bronTekst.split(NL);
  const iVast = bronRegels.findIndex(l => l.includes("if (dichtstbijOSM) vergrendelNodeHandmatig(dichtstbijOSM.id, 'beeld');"));
  eis('SN1b in de tik-handler staat het merkteken direct na het vastzetten van de node, met dezelfde node en tijd',
      iVast > 0 && bronRegels[iVast + 1].includes('if (dichtstbijOSM) tikSlotMerk = { id: String(dichtstbijOSM.id), ts: handmatigGeselecteerdTimestamp };'),
      'regel erna', iVast > 0 ? bronRegels[iVast + 1].trim().slice(0, 90) : 'tik-handler niet gevonden');
  eis('SN1c het merkteken wordt alleen gezet in de tik-handler en bij de wissel gewist; een lijstkeuze of een ander slot maakt het ongeldig',
      (bronTekst.match(/tikSlotMerk = \{/g) || []).length === 1 && /tikSlotMerk\.ts/.test(zc(tikSlotLeeft)) && /stilstandAutoLock/.test(zc(tikSlotLeeft)),
      '1 plek, met tijd en slot', String((bronTekst.match(/tikSlotMerk = \{/g) || []).length));

  // ═══ ritten ════════════════════════════════════════════════
  const bron = new URL('test_snelroute.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?snel=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      const w = f.contentWindow;
      await new Promise((ok, nee) => {
        const sc = w.document.createElement('script');
        sc.src = bron + '?t=' + Date.now(); sc.onload = ok; sc.onerror = () => nee(new Error('laden'));
        w.document.head.appendChild(sc);
      });
      return await w.snelRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], wissel: [], op: [], toasts: [], tik: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const C = 9600001, W = 9600002;
  // Het veldgeval: C 5 m recht vooruit, W 23 m schuin rechts (52 graden). Stop op (0, 0).
  const veld = [{ id: C, x: 0, y: 5 }, { id: W, x: 18, y: 14 }];
  // 36 km/u = 10 m per GPS-tik: de nadering eindigt precies op (0, 0), zodat de afstanden en hoeken hierboven kloppen.
  const aanrij = [{ vanY: -80, totY: 0, kmh: 36 }, { tikken: 9, kmh: 0 }];
  const wisselTik = (r, naar) => { const i = r.rij.findIndex(x => x.app === naar); return i < 0 ? null : r.rij[i]; };

  // ═══ SN2 — het veldgeval ═══════════════════════════════════
  // De naderingsroute weigerde in het veld (voorbij_weg, 12:06:48); hier staat zij uit, zodat alleen deze route beslist.
  const sn2 = await rit({ nodes: veld, start: W, slot: 'tik', lamp: true, uitNadering: true, stukken: aanrij });
  const w2 = wisselTik(sn2, C) || {};
  eis('SN2a wissel naar C op de derde stilstaande GPS-tik: 2 s na het stilvallen (de vervalroute deed er 6,0 over)',
      !sn2.fout && w2.stil === 2 && w2.kmh === 0, '2 s', sn2.fout || `na ${w2.stil} s stilstand`);
  eis('SN2b de getikte lamp blijft, en het slot wordt het stilstandslot op C',
      w2.lamp === 1 && w2.slot === 1 && w2.auto === 1, 'lamp, stilstandslot', `lamp ${w2.lamp}, slot ${w2.slot}, auto ${w2.auto}`);
  const op2 = sn2.op.filter(r => r.reden === 'snel_correctie');
  eis('SN2c één regel snel_correctie (W -> C, 2 bevestigingen, 2 s, 18 m marge) en een melding met Terug; geen vervalroute',
      op2.length === 1 && op2[0].node === String(W) && op2[0].nieuw === String(C) && op2[0].hoekN === 2 && op2[0].dur === 2
        && sn2.toasts.some(t => t.knop === 'Terug') && !sn2.op.some(r => r.reden === 'handlock_vervallen'),
      '1 regel, Terug, geen verval', JSON.stringify(sn2.op) + ' ' + JSON.stringify(sn2.toasts));
  eis('SN2d de wissellog noemt de reden snel', sn2.wissel.some(r => r.van === W && r.naar === C && r.r === 'snel'),
      'snel', sn2.wissel.map(r => `${r.van}>${r.naar} ${r.r}`).join(' ; ') || 'geen');

  // ═══ SN3 — zonder de route: de vervalroute ══════════════════
  const sn3 = await rit({ nodes: veld, start: W, slot: 'tik', lamp: true, uitNadering: true, uitSnel: true, stukken: aanrij });
  const w3 = wisselTik(sn3, C) || {};
  eis('SN3 zonder deze route wisselt de vervalroute pas na 5-6 s, en dan is de getikte lamp weg (zo was het tot nu)',
      !sn3.fout && w3.stil >= 5 && w3.stil <= 6 && w3.lamp === 0 && sn3.op.some(r => r.reden === 'handlock_vervallen'),
      '5-6 s, lamp weg', sn3.fout || `na ${w3.stil} s, lamp ${w3.lamp}`);

  // ═══ SN4 — met de naderingsroute aan ════════════════════════
  const sn4 = await rit({ nodes: veld, start: W, slot: 'tik', lamp: true, stukken: aanrij });
  const w4 = wisselTik(sn4, C) || {};
  eis('SN4 met de naderingsroute aan beslist die eerst (1 s, reden nadering); deze route schrijft niets',
      !sn4.fout && w4.stil === 1 && sn4.op.some(r => r.reden === 'nadering_correctie') && !sn4.op.some(r => r.reden === 'snel_correctie')
        && sn4.wissel.some(r => r.naar === C && r.r === 'nadering'),
      '1 s, nadering', sn4.fout || `na ${w4.stil} s, ${sn4.op.map(r => r.reden).join('+')}`);

  // ═══ SN5 — niets anders verandert ═══════════════════════════
  const zelfde = (p, q) => JSON.stringify(p.rij) === JSON.stringify(q.rij)
    && JSON.stringify(p.wissel.map(x => [x.van, x.naar, x.r])) === JSON.stringify(q.wissel.map(x => [x.van, x.naar, x.r]))
    && JSON.stringify(p.op) === JSON.stringify(q.op);
  const gevallen = [
    ['lijstkeuze', { nodes: veld, start: W, slot: 'lijst', uitNadering: true, stukken: aanrij }],
    ['tik en daarna een lijstkeuze op hetzelfde licht', { nodes: veld, start: W, slot: 'tik+lijst', uitNadering: true, stukken: aanrij }],
    ['stilstandslot', { nodes: veld, start: W, slot: 'auto', uitNadering: true, stukken: aanrij }],
    ['doorrijden', { nodes: veld, start: W, slot: 'tik', uitNadering: true, stukken: [{ vanY: -80, totY: 120, kmh: 34 }] }],
    ['licht op 32 m', { nodes: [{ id: C, x: 0, y: 32 }, { id: W, x: 0, y: 45 }], start: W, slot: 'tik', uitNadering: true, stukken: aanrij }],
    ['marge 6 m', { nodes: [{ id: C, x: 0, y: 10 }, { id: W, x: 3, y: 16 }], start: W, slot: 'tik', uitNadering: true, stukken: aanrij }],
    ['koers 68 graden', { nodes: [{ id: C, x: 20, y: 8 }, { id: W, x: 0, y: 40 }], start: W, slot: 'tik', uitNadering: true, stukken: aanrij }],
    ['kort na een correctie (10 s)', { nodes: veld, start: W, slot: 'tik', uitNadering: true, recenteCorrectie: true,
      stukken: [{ vanY: -30, totY: 0, kmh: 36 }, { tikken: 9, kmh: 0 }] }]
  ];
  for (const [naam, opt] of gevallen) {
    const met = await rit(opt), zonder = await rit({ ...opt, uitSnel: true });
    eis('SN5 ' + naam + ': met en zonder de route in elke GPS-tik dezelfde keuze, hetzelfde slot, dezelfde lamp en dezelfde logregels',
        !met.fout && !zonder.fout && met.rij.length > 5 && zelfde(met, zonder) && !met.op.some(r => r.reden === 'snel_correctie'),
        'gelijk', met.fout || zonder.fout || `${met.rij.length} tikken, wissels ${met.wissel.map(x => x.r).join('+') || 'geen'}`);
  }

  // ═══ SN6 — regressie ════════════════════════════════════════
  const refs = [['checkHandLockVerval', '2df4f7ed', 5513], ['checkNodeCorrectieStilstand', '8c801fd8', 4751],
                ['corrigeerNodeAutomatisch', 'afe7b427', 4118], ['updateDichtbij', 'e82d3c0', 11914], ['vindDichtbij', '2db98dab', 2954]];
  // V11.37.4: zonder de regels met merkteken (de achter-regel, zie test_achter).
  const zonderV113713 = (s) => String(s).split('\n').filter(l => !/V11\.37\.13/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const terugV11378 = (s) => zonderV113711(s).replace("      if (wisselStaat.min === null || af < wisselStaat.min) { wisselStaat.min = af; wisselStaat.minT = Date.now(); }   // V11.37.8: en wanneer (tMin)", "      if (wisselStaat.min === null || af < wisselStaat.min) wisselStaat.min = af;").replace("  if (!dichtstbijOSM) { logOpslagMis('bevestig_geen_licht', { element: categorie }); return; }   // V11.37.8: niet meer stil", "  if (!dichtstbijOSM) return;").split('\n').filter(l => !/V11\.37\.8/.test(l)).join('\n');   // V11.37.8: het fietsfilter en de bevroren knoppen (test_fietslicht); hier terug
  const anders = refs.filter(([n, h, l]) => { const s = terugV11378(window[n]).split(NL).filter(l => !/V11\.37\.4/.test(l)).join(NL); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('SN6a de vijf vastgepinde functies (NB14) zijn byte-gelijk', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  // V11.37.4: vier regels van het V9-blok in onGPS kregen een tak voor 'geen licht'; hier terug
  // naar hun oude vorm, daarna gaat de aanroep van achterTik weg met het filter (zie test_achter).
  const terugV11374 = (s) => s
    .replace('if ((dichtstbijOSM || (achterAan() && v9KandidaatNode !== null)) && cacheGeladen) {   // V11.37.4: een lopende meting loopt ook zonder getoond licht door', 'if (dichtstbijOSM && cacheGeladen) {')
    .replace('const afst = dichtstbijOSM ? dichtstbijOSM.afstand : Infinity;   // V11.37.4', 'const afst = dichtstbijOSM.afstand;')
    .replace('const nodeId = dichtstbijOSM ? String(dichtstbijOSM.id) : null;   // V11.37.4', 'const nodeId = String(dichtstbijOSM.id);')
    .replace('kandidaatPos ?? (dichtstbijOSM ? { lat: dichtstbijOSM.lat, lon: dichtstbijOSM.lon } : { lat, lon }),   // V11.37.4', 'kandidaatPos ?? { lat: dichtstbijOSM.lat, lon: dichtstbijOSM.lon },');
  const g = terugV11374(String(onGPS)).split(NL).filter(l => !/V11\.34\.[2-9]|V11\.36\.[14]|V11\.37\.[124]/.test(l)).join(NL);
  eis('SN6b onGPS zonder de V11.37.2-regel (en de meetregels) is byte-gelijk aan V11.37.0 (c767e2a3 / 14333)',
      fnv(g) === 'c767e2a3' && g.length === 14333, 'c767e2a3 / 14333', fnv(g) + ' / ' + g.length);
  const og = zc(onGPS);
  const p = ['checkNaderingsCorrectie(lat, lon)', 'wisselTussen()', 'checkTikSlotSnel(lat, lon)', 'checkNodeCorrectieStilstand(lat, lon)'].map(x => og.indexOf(x));
  eis('SN6c in onGPS: na de naderingscorrectie en haar wissellog-merk, vóór de oude hercontrole', p.every(x => x > 0) && p.every((x, i) => i === 0 || x > p[i - 1]),
      'op volgorde', p.join(','));

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testSnelroute = testSnelroute; window.snelRitBinnen = snelRitBinnen; }
