// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetwerk21.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.21: meten en dataveiligheid.
//
//  MW1  samenvoegen met Algemeen gooit nooit een unieke meting weg: een
//       V5-meting zonder V4-tweeling gaat eerst als kopie (bron merge_v5) naar
//       V4; met een tweeling (duur binnen 1 s, tijd binnen 25 s, eerst het
//       eigen dagdeel, dan de andere)
//       verandert V4 niet; een vol quotum draait alles terug
//  MW2  de stoplog: een eigen ring met positie, kandidaten op 100/50/30 m en bij
//       stilstand, de kale score-keuze, het slot, en bij het wegrijden het licht
//       en de meting; een volle ring houdt er 60; een vol quotum staakt alleen
//       dit log
//  MW3  NIETS VERANDERT: dezelfde ritten met de echte onGPS, met en zonder de
//       stoplog, geven in elke GPS-tik dezelfde keuze, hetzelfde slot en
//       dezelfde wissel-, regel-, tik- en opslaglog
//  MW4  de detlog: zonder crop (onder 15 m) geen oude ratio, wel een reden
//  MW5  de teller van weggegooide KLOPTE- en BIJNA-tikken
//  MW6  de badge: 'N metingen' (alleen duur > 0, geen bevestig-correctie),
//       'Gezien, nog niet geleerd', 'Nieuw'; en hij past op 320 px
//  MW7  de export heeft de bakken 'stop' en 'inert'
//  MW8  regressie: zonder de regels met merkteken V11.37.21 zijn de acht
//       geraakte functies byte-gelijk aan V11.37.20
//
//  Alle plekken en nummers zijn bedacht: een rechte weg naar het noorden vanaf
//  een basispunt (52.0000, 5.0000), lichten met nummers 96021xx.
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_meetwerk21.js';
//      document.head.appendChild(s);
//      s.onload = () => testMeetwerk21().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
// opt: { nodes, start, tik, zonderStop, okBij, vul, vol, punten: [{ x, y, kmh, koers }] }; kmh 0 = stilstaan
async function meetwerkRitBinnen(opt) {
  const LAT0 = 52.0000, LON0 = 5.0000;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.zonderStop) window.stopLogTik = () => {};
  if (opt.vol) { const os = opslagSchrijf; window.opslagSchrijf = (k, v) => (k === STOPLOG_SLEUTEL ? false : os(k, v)); }
  if (opt.volBijAf) { const os = opslagSchrijf; window.opslagSchrijf = (k, v) => ((k === STOPLOG_SLEUTEL && Array.isArray(v) && v.length && v[v.length - 1].e !== undefined) ? false : os(k, v)); }   // alleen de aanvulling bij het wegrijden mislukt
  if (opt.fiets) fietsLichten = new Set(opt.fiets.map(String));
  try { for (const k of ['sl_wissellog', 'sl_opslaglog', 'sl_regellog', TIKLOG_SLEUTEL, STOPLOG_SLEUTEL]) localStorage.setItem(k, '[]'); } catch (e) {}
  if (opt.vul) localStorage.setItem(STOPLOG_SLEUTEL, JSON.stringify(Array.from({ length: opt.vul }, (_, i) => ({ t: i, oud: 1 }))));
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
  stopStaat = { pos: null, spoor: [], stop: null };
  if (opt.tik) vergrendelNodeHandmatig(start.id, 'beeld');
  const rij = [];
  for (let i = 0; i < opt.punten.length; i++) {
    const p = opt.punten[i];
    klok += 1000;
    const q = LL(p.x, p.y);
    if (opt.okBij === i) logOpslagMis('ok', { node: String(opt.okNode || opt.start), dur: 33 });
    if (opt.vreemdBij === i) { const ring = JSON.parse(localStorage.getItem(STOPLOG_SLEUTEL) || '[]'); ring.push({ t: 1, vreemd: 1 }); localStorage.setItem(STOPLOG_SLEUTEL, JSON.stringify(ring)); }
    if (opt.tikBij === i) { const ring = JSON.parse(localStorage.getItem(TIKLOG_SLEUTEL) || '[]'); ring.push({ t: klok, s: 'tik', node: String(opt.tikNode) }); localStorage.setItem(TIKLOG_SLEUTEL, JSON.stringify(ring)); }
    await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: p.kmh / 3.6, heading: p.koers === undefined ? NaN : p.koers, accuracy: 5 }, timestamp: klok });
    rij.push({ y: Math.round(p.y), app: dichtstbijOSM ? dichtstbijOSM.id : null, slot: handmatigLockActief ? 1 : 0, auto: stilstandAutoLock ? 1 : 0,
               regel: (typeof regelStaat !== 'undefined' && regelStaat) ? regelStaat.keuze : undefined });
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  return { rij, wissel: lees('sl_wissellog'), regellog: lees('sl_regellog'), tik: lees(TIKLOG_SLEUTEL), opslag: lees('sl_opslaglog'),
           stop: lees(STOPLOG_SLEUTEL), gestopt: meetRingGestopt.has(STOPLOG_SLEUTEL), sleutelEr: localStorage.getItem(STOPLOG_SLEUTEL) !== null };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testMeetwerk21() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const NL = String.fromCharCode(10);
  const kort = (x) => JSON.stringify(x).slice(0, 220);

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
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const zet = (k, v) => { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); };
  const bewNu = Date.now;

  // ═══ MW1 — samenvoegen bewaart elke meting ═══════════════════
  const N1 = 9602101, T0 = 1790000000000;
  const bew1 = { nodeInfoNodeId, mergeUndoBuffer, mergeModusAan, mergeSelectie, toast: window.toonToast };
  const v4 = (dd) => lees('sl_v4_' + N1 + '_' + dd) || [];
  const v5k = 'sl_v5_' + N1 + '_N_W_dag';
  // Eén samenvoeging van richting N>W met Algemeen, op een schone node.
  const voeg = (v4dag, v5dag, v4avond) => {
    for (const d of Object.keys(DD)) { zet('sl_v4_' + N1 + '_' + d, null); zet('sl_v5_' + N1 + '_N_W_' + d, null); }
    zet('sl_v4_' + N1 + '_dag', v4dag);
    if (v4avond) zet('sl_v4_' + N1 + '_avond', v4avond);
    zet(v5k, v5dag);
    zet('sl_opslaglog', []);
    nodeInfoNodeId = String(N1);
    mergeRichtingen(String(N1), { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN');
    const kopie = (lees('sl_opslaglog') || []).filter(r => r.reden === 'merge_v5_kopie');
    return { v5: localStorage.getItem(v5k), dag: v4('dag'), avond: v4('avond'), kopie };
  };
  try {
    window.toonToast = () => {};
    const basis = [{ duur: 40, tijd: T0 - 900000, gewicht: 1 }, { duur: 22, tijd: T0 - 800000, gewicht: 1 }];
    // a: met een tweeling (zelfde duur, 5 s eerder in V4)
    let r = voeg([...basis, { duur: 30, tijd: T0 - 5000, gewicht: 1, rv: 1 }], [{ duur: 30, tijd: T0, gewicht: 1, bron: 'tik' }]);
    eis('MW1a met een tweeling in V4 (zelfde duur, 5 s eerder): de V5-emmer weg, V4 niet langer, geen kopie en geen logregel',
        r.v5 === null && r.dag.length === 3 && !r.dag.some(m => m.bron === 'merge_v5') && r.kopie.length === 0,
        'V5 weg, V4 3, 0 kopieën', 'V5 ' + (r.v5 === null ? 'weg' : 'er') + ', V4 ' + r.dag.length + ', kopie-regels ' + r.kopie.length);
    // b: zonder tweeling: eerst een kopie, met de velden en het merkteken
    r = voeg([...basis], [{ duur: 85, tijd: T0, gewicht: 1, bron: 'tik', zo: 0 }]);
    const k = r.dag.find(m => m.bron === 'merge_v5');
    eis('MW1b zonder tweeling: de meting staat daarna in V4 (duur, tijd, gewicht, zo, bron merge_v5) en de V5-emmer is weg; één logregel merge_v5_kopie met n 1 (een aantal) en dur leeg',
        r.v5 === null && r.dag.length === 3 && !!k && k.duur === 85 && k.tijd === T0 && k.gewicht === 1 && k.zo === 0
          && r.kopie.length === 1 && r.kopie[0].n === 1 && r.kopie[0].dur == null && String(r.kopie[0].node) === String(N1),
        'V4 3 met de kopie', 'V4 ' + r.dag.length + ' ' + kort(k) + ' log ' + kort(r.kopie));
    // c: de grenzen van de tweeling
    const grens = (d4, dt) => voeg([...basis, { duur: d4, tijd: T0 - dt, gewicht: 1 }], [{ duur: 30, tijd: T0, gewicht: 1 }]).dag.length;
    const c1 = grens(31, 20000), c2 = grens(32, 1000), c3 = grens(30, 26000), c4 = grens(30, -25000), c5 = grens(30, -26000);
    eis('MW1c tweeling = duur binnen 1 s en tijd binnen 25 s, voor en na: 31 s op 20 s geen kopie; 32 s, of 26 s ervoor, of 26 s erna wel; 25 s erna geen',
        c1 === 3 && c2 === 4 && c3 === 4 && c4 === 3 && c5 === 4, '3 / 4 / 4 / 3 / 4', [c1, c2, c3, c4, c5].join(' / '));
    // d: een tweeling in een ander dagdeel telt ook
    r = voeg([...basis], [{ duur: 30, tijd: T0, gewicht: 1 }], [{ duur: 30, tijd: T0 - 3000, gewicht: 1 }]);
    eis('MW1d een tweeling in een ander dagdeel (avond) telt ook: geen kopie in dag',
        r.v5 === null && r.dag.length === 2 && r.avond.length === 1 && r.kopie.length === 0, 'dag 2, avond 1', 'dag ' + r.dag.length + ', avond ' + r.avond.length);
    // e: gemengd: drie metingen, één met tweeling
    r = voeg([...basis, { duur: 30, tijd: T0 - 2000, gewicht: 1 }],
             [{ duur: 30, tijd: T0, gewicht: 1 }, { duur: 55, tijd: T0 - 3600000, gewicht: 1 }, { duur: 12, tijd: T0 - 7200000, gewicht: 0.6, zo: 1 }]);
    eis('MW1e drie V5-metingen, één met tweeling: precies twee kopieën (55 s en 12 s, zo 1 mee), logregel n 2',
        r.dag.length === 5 && r.dag.filter(m => m.bron === 'merge_v5').map(m => m.duur).sort().join(',') === '12,55'
          && r.dag.find(m => m.duur === 12).zo === 1 && r.dag.find(m => m.duur === 12).gewicht === 0.6 && r.kopie.length === 1 && r.kopie[0].n === 2,
        'V4 5', 'V4 ' + r.dag.length + ' ' + kort(r.dag.filter(m => m.bron === 'merge_v5')));
    // f: een vol quotum bij de kopie: alles terug, de V5-meting bestaat nog
    const bewSet = Storage.prototype.setItem;
    const v4dagK = 'sl_v4_' + N1 + '_dag';
    let r6;
    Storage.prototype.setItem = function (kk, vv) {
      if (kk === v4dagK && String(vv).includes('merge_v5')) { const e = new Error('vol'); e.name = 'QuotaExceededError'; throw e; }
      return bewSet.call(this, kk, vv);
    };
    try { r6 = voeg([...basis], [{ duur: 85, tijd: T0, gewicht: 1 }]); } finally { Storage.prototype.setItem = bewSet; }
    eis('MW1f lukt de kopie niet (vol quotum), dan blijft de V5-meting staan en V4 ongewijzigd (rollback)',
        r6.v5 !== null && JSON.parse(r6.v5).length === 1 && r6.dag.length === 2 && !r6.dag.some(m => m.bron === 'merge_v5'),
        'V5 er, V4 2', 'V5 ' + (r6.v5 === null ? 'weg' : 'er') + ', V4 ' + r6.dag.length);
    // g: de mutatietoets uit de opdracht: dezelfde meting, eerst met en dan zonder tweeling
    const met = voeg([...basis, { duur: 47, tijd: T0 - 4000, gewicht: 1 }], [{ duur: 47, tijd: T0, gewicht: 1 }]);
    const zonder = voeg([...basis], [{ duur: 47, tijd: T0, gewicht: 1 }]);
    eis('MW1g haal de tweeling weg: de meting moet blijven bestaan (met tweeling 1x 47 s in V4, zonder tweeling ook 1x, als kopie)',
        met.dag.filter(m => m.duur === 47).length === 1 && zonder.dag.filter(m => m.duur === 47).length === 1 && zonder.dag.some(m => m.bron === 'merge_v5'),
        '1 en 1', met.dag.filter(m => m.duur === 47).length + ' en ' + zonder.dag.filter(m => m.duur === 47).length);
    eis('MW1h mergeHeeftTweeling: een record zonder duur telt als bewaard (er valt niets te kopiëren), en een lege V4 is geen tweeling',
        mergeHeeftTweeling(String(N1), { tijd: T0 }) === true && (() => { for (const d of Object.keys(DD)) zet('sl_v4_' + N1 + '_' + d, null); return mergeHeeftTweeling(String(N1), { duur: 20, tijd: T0 }) === false; })(),
        'true / false', 'zie functie');
    // i: een vaste cyclus van 50 s: de vorige rode fasen (zelfde duur, 50 en 100 s eerder) zijn GEEN tweeling
    r = voeg([...basis, { duur: 30, tijd: T0 - 100000, gewicht: 1 }, { duur: 30, tijd: T0 - 50000, gewicht: 1 }], [{ duur: 30, tijd: T0, gewicht: 1 }]);
    eis('MW1i vaste cyclus 50 s: de vorige rode fase (30 s, 50 s eerder) is geen tweeling, dus de 30 s-meting komt als kopie in V4 (met 60 s ging hij verloren)',
        r.v5 === null && r.dag.length === 5 && r.dag.filter(m => m.bron === 'merge_v5' && m.duur === 30 && m.tijd === T0).length === 1,
        'V4 5 met de kopie', 'V4 ' + r.dag.length + ' ' + kort(r.dag.filter(m => m.bron === 'merge_v5')));
    // j: eerst het eigen dagdeel; een tweeling over de dagdeelgrens (ander dagdeel, binnen 25 s) telt nog
    for (const d of Object.keys(DD)) zet('sl_v4_' + N1 + '_' + d, null);
    zet('sl_v4_' + N1 + '_dag', [{ duur: 30, tijd: T0 - 4000, gewicht: 1 }]);
    zet('sl_v4_' + N1 + '_avond', [{ duur: 30, tijd: T0 - 3000, gewicht: 1 }]);
    const bewGet = Storage.prototype.getItem, gelezen = [];
    Storage.prototype.getItem = function (kk) { if (String(kk).startsWith('sl_v4_' + N1 + '_')) gelezen.push(kk); return bewGet.call(this, kk); };
    let j1, j2;
    try { j1 = mergeHeeftTweeling(String(N1), { duur: 30, tijd: T0 }, 'avond'); } finally { Storage.prototype.getItem = bewGet; }
    zet('sl_v4_' + N1 + '_avond', null);
    zet('sl_v4_' + N1 + '_ochtend', [{ duur: 30, tijd: T0 - 20000, gewicht: 1 }]);
    zet('sl_v4_' + N1 + '_dag', null);
    j2 = mergeHeeftTweeling(String(N1), { duur: 30, tijd: T0 }, 'dag');
    eis('MW1j de zoektocht begint in het eigen dagdeel (avond eerst gelezen, en daar meteen gevonden); een tweeling in een ander dagdeel binnen 25 s (dagdeelgrens) telt ook',
        j1 === true && gelezen[0] === 'sl_v4_' + N1 + '_avond' && gelezen.length === 1 && j2 === true,
        'true, eerst avond, 1 sleutel / true', j1 + ', ' + gelezen.join(' ') + ' / ' + j2);
    // k: A2 — de kopie heeft geen richtingveld; de lezers rekenen er gewoon mee
    r = voeg([...basis], [{ duur: 85, tijd: T0, gewicht: 1, zo: 0 }]);
    const kk2 = r.dag.find(m => m.bron === 'merge_v5');
    const dek = berekenDekkingScore(String(N1)), pct = berekenLeerPct(String(N1)), gg = gewGem(laadM(String(N1), 'dag'));
    const modus = bepaalCdModus(gg, laadM(String(N1), 'dag'));
    eis('MW1k de kopie heeft geen veld richting, en dekking, leerpercentage, gewGem en de modus rekenen er zonder NaN mee (gewGem van 40/22/85 = 40)',
        !!kk2 && !('richting' in kk2) && Number.isFinite(dek) && Number.isFinite(pct) && gg === 40 && !!modus && typeof modus.modus === 'string',
        'geen richting, eindige getallen, 40', kort({ richting: kk2 && kk2.richting, dek, pct, gg, modus: modus && modus.modus }));
    // l: A3 — rollback-bewijs: twee dagdelen, de tweede kopie mislukt; ALLE sleutels van de node zijn daarna byte-gelijk
    const allesVan = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const kx = localStorage.key(i); if (kx.includes('_' + N1 + '_') || kx.endsWith('_' + N1)) o[kx] = localStorage.getItem(kx); } return o; };
    for (const d of Object.keys(DD)) { zet('sl_v4_' + N1 + '_' + d, null); zet('sl_v5_' + N1 + '_N_W_' + d, null); }
    zet('sl_v4_' + N1 + '_dag', [...basis, { duur: 30, tijd: T0 - 5000, gewicht: 1, rv: 1, rvK: 'N_W' }]);
    zet('sl_v4_' + N1 + '_avond', [{ duur: 50, tijd: T0 - 5000000, gewicht: 1 }]);
    zet('sl_v5_' + N1 + '_N_W_dag', [{ duur: 30, tijd: T0, gewicht: 1 }, { duur: 77, tijd: T0 - 600000, gewicht: 1 }]);
    zet('sl_v5_' + N1 + '_N_W_avond', [{ duur: 66, tijd: T0 - 4000000, gewicht: 1 }]);
    const voor = allesVan();
    const v4avK = 'sl_v4_' + N1 + '_avond';
    Storage.prototype.setItem = function (kk, vv) {
      if (kk === v4avK && String(vv).includes('merge_v5')) { const e = new Error('vol'); e.name = 'QuotaExceededError'; throw e; }
      return bewSet.call(this, kk, vv);
    };
    nodeInfoNodeId = String(N1);
    try { mergeRichtingen(String(N1), { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN'); } finally { Storage.prototype.setItem = bewSet; }
    const na = allesVan();
    const verschil = [...new Set([...Object.keys(voor), ...Object.keys(na)])].filter(kx => voor[kx] !== na[kx]);
    eis('MW1l rollback-bewijs: de kopie in dag lukte en de V5-dagemmer was al weg, de kopie in avond faalt: daarna is elke sleutel van de node byte-gelijk aan vooraf (ook het rv-stempel en beide V5-emmers), en er staat geen undo klaar',
        verschil.length === 0 && Object.keys(voor).length >= 4 && mergeUndoBuffer === null,
        '0 verschillen', verschil.length + ' verschillen: ' + verschil.join(' ') + ', undo ' + (mergeUndoBuffer === null ? 'leeg' : 'gezet'));
  } catch (e) {
    eis('MW1 crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    nodeInfoNodeId = bew1.nodeInfoNodeId; mergeUndoBuffer = bew1.mergeUndoBuffer; mergeModusAan = bew1.mergeModusAan; mergeSelectie = bew1.mergeSelectie;
    window.toonToast = bew1.toast;
    herstel();
    try { opslagHersynchroniseer(Object.keys(snap)); } catch (e) {}
  }

  // ═══ MW4 — de detlog zonder crop ═════════════════════════════
  const bew4 = { cropAlternatieTeller, huidigeCropRatio, dichtstbijOSM, snelheidKmh, detLogArr, detLogStop, detLogStilLaatst, cropHintPositie, cropHintTeller, bboxAnchorCx };
  const vidW = Object.getOwnPropertyDescriptor(video, 'videoWidth'), vidH = Object.getOwnPropertyDescriptor(video, 'videoHeight');
  try {
    Object.defineProperty(video, 'videoWidth', { value: 2160, configurable: true });
    Object.defineProperty(video, 'videoHeight', { value: 3840, configurable: true });
    cropHintPositie = null; cropHintTeller = 0; bboxAnchorCx = null;
    const run = (afst, skip) => {
      dichtstbijOSM = { id: 9602141, lat: 52, lon: 5, afstand: afst };
      huidigeCropRatio = 0.567;
      cropAlternatieTeller = skip ? 4 : 0;
      try { preprocessVoorYOLO(); } catch (e) { /* het tekenen of ort.Tensor kan hier ontbreken; de detlog-velden staan dan al */ }
      return { ratio: detLogRatio, gc: detLogGeenCrop, skip: detLogSkip };
    };
    const a = run(10, false), b = run(30, false), c = run(10, true);
    eis('MW4a onder 15 m (geen crop): geen oude ratio maar null, met reden dichtbij',
        a.ratio === null && a.gc === 'dichtbij' && a.skip === false, 'null / dichtbij', kort(a));
    eis('MW4b op 30 m (wel crop): de ratio zoals voorheen, geen reden', b.ratio !== null && b.ratio > 0 && b.gc === null, 'ratio / null', kort(b));
    eis('MW4c een volbeeld-run: ratio null zoals voorheen, en geen reden (skip zegt het al)', c.ratio === null && c.gc === null && c.skip === true, 'null / null / skip', kort(c));
    localStorage.removeItem('sl_detlog'); detLogArr = null; detLogStop = false; detLogStilLaatst = 0;
    run(10, false); snelheidKmh = 0; detLogSchrijf();
    const rec = (lees('sl_detlog') || []).slice(-1)[0] || null;
    eis('MW4d de detlog-regel van een stilstand onder 15 m: ratio null, verg 1, gc dichtbij',
        !!rec && rec.ratio === null && rec.verg === 1 && rec.gc === 'dichtbij' && rec.stil === 1, 'ratio null, gc dichtbij', kort(rec));
    run(30, false); snelheidKmh = 30; detLogSchrijf();
    const rec2 = (lees('sl_detlog') || []).slice(-1)[0] || null;
    eis('MW4e een gewone run op 30 m draagt geen gc', !!rec2 && !('gc' in rec2) && rec2.ratio > 0, 'geen gc', kort(rec2));
  } catch (e) {
    eis('MW4 crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    if (vidW) Object.defineProperty(video, 'videoWidth', vidW); else delete video.videoWidth;
    if (vidH) Object.defineProperty(video, 'videoHeight', vidH); else delete video.videoHeight;
    cropAlternatieTeller = bew4.cropAlternatieTeller; huidigeCropRatio = bew4.huidigeCropRatio; dichtstbijOSM = bew4.dichtstbijOSM;
    snelheidKmh = bew4.snelheidKmh; detLogArr = bew4.detLogArr; detLogStop = bew4.detLogStop; detLogStilLaatst = bew4.detLogStilLaatst;
    cropHintPositie = bew4.cropHintPositie; cropHintTeller = bew4.cropHintTeller; bboxAnchorCx = bew4.bboxAnchorCx;
    herstel();
  }

  // ═══ MW5 — de teller van weggegooide tikken ══════════════════
  const A5 = 9602151;
  const bew5 = {
    dichtstbijOSM, fase, faseStart, cdStart, groenStart, countdownNulTijd,
    cdBereikteNul, activeCdDoel, activeCdModus, activeCdMin, activeCdMax,
    bevestigActief, bevestigVoorNodeId, bevInertStaat, aiKleur, snelheidKmh,
    laatsteRoodFaseStart, bevestigGedaanVoorFase, huidigCdBron, huidigCdWaarde,
    cdWallStart, cdWallNodeId, schaduwWaarden, schaduwCountdownNul, wrapClass: bevestigWrap.className
  };
  const opzet5 = (overschrMs, aiK) => {
    zet('sl_bevestig_' + A5, null);
    dichtstbijOSM = { id: A5, lat: 52, lon: 5, afstand: 12, naam: 'TEST-' + A5 };
    cdWallStart = null; cdWallNodeId = null;
    huidigCdBron = 'V4'; huidigCdWaarde = 40;
    schaduwWaarden = { m1: null, m2: null, m3: null, m4: null };
    schaduwCountdownNul = { m1: null, m2: null, m3: null, m4: null };
    laatsteRoodFaseStart = Date.now() - 60000;
    bevestigGedaanVoorFase = null;
    activeCdDoel = 40; activeCdModus = CD_GESCHAT; activeCdMin = null; activeCdMax = null;
    snelheidKmh = 0; aiKleur = aiK;
    fase = 'groen'; cdBereikteNul = true; groenStart = performance.now();
    countdownNulTijd = Date.now() - overschrMs; cdStart = null;
    bevestigActief = true; bevestigVoorNodeId = String(A5);
    bevestigWrap.classList.add('actief'); bevInertStaat = '';
  };
  try {
    zet(INERT_SLEUTEL, null);
    const store = () => lees('sl_bevestig_' + A5) || [];
    opzet5(15000, 'rood'); bevestigCountdown('klopte'); const s1 = store().length;
    opzet5(15000, 'rood'); bevestigCountdown('klopte');
    opzet5(15000, 'rood'); bevestigCountdown('bijna'); const s2 = store().length;
    opzet5(15000, 'groen'); bevestigCountdown('klopte'); const s3 = store().length;
    opzet5(15000, 'groen'); bevestigCountdown('bijna'); const s4 = store().length;
    opzet5(15000, 'rood'); bevestigCountdown('fout'); const s5 = store().length;
    const t = lees(INERT_SLEUTEL);
    eis('MW5a weggegooide KLOPTE- en BIJNA-tikken tellen (klopte 2, bijna 1); de vroeg doorgelaten (camera ziet groen) apart (1 en 1); FOUT telt niet',
        !!t && t.klopte === 2 && t.bijna === 1 && t.klopteVroeg === 1 && t.bijnaVroeg === 1 && typeof t.sinds === 'number' && typeof t.laatst === 'number',
        '2/1/1/1', kort(t));
    eis('MW5b de knoppen doen wat ze deden: weggegooid schrijft niets, vroeg en FOUT schrijven wel', s1 === 0 && s2 === 0 && s3 === 1 && s4 === 1 && s5 === 1,
        '0 0 1 1 1', [s1, s2, s3, s4, s5].join(' '));
    zet(INERT_SLEUTEL, 'kapot'); bevestigInertTel('klopte');
    eis('MW5c een onleesbare teller begint opnieuw, zonder fout', (lees(INERT_SLEUTEL) || {}).klopte === 1, 'klopte 1', kort(lees(INERT_SLEUTEL)));
    eis('MW5d de teller staat NIET onder sl_bevestig_ (dat voorvoegsel is van de bevestigingen per licht)', !INERT_SLEUTEL.startsWith('sl_bevestig_'), 'ander voorvoegsel', INERT_SLEUTEL);
  } catch (e) {
    eis('MW5 crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    dichtstbijOSM = bew5.dichtstbijOSM; fase = bew5.fase; faseStart = bew5.faseStart; cdStart = bew5.cdStart;
    groenStart = bew5.groenStart; countdownNulTijd = bew5.countdownNulTijd; cdBereikteNul = bew5.cdBereikteNul;
    activeCdDoel = bew5.activeCdDoel; activeCdModus = bew5.activeCdModus; activeCdMin = bew5.activeCdMin; activeCdMax = bew5.activeCdMax;
    bevestigActief = bew5.bevestigActief; bevestigVoorNodeId = bew5.bevestigVoorNodeId; bevInertStaat = bew5.bevInertStaat;
    aiKleur = bew5.aiKleur; snelheidKmh = bew5.snelheidKmh; laatsteRoodFaseStart = bew5.laatsteRoodFaseStart;
    bevestigGedaanVoorFase = bew5.bevestigGedaanVoorFase; huidigCdBron = bew5.huidigCdBron; huidigCdWaarde = bew5.huidigCdWaarde;
    cdWallStart = bew5.cdWallStart; cdWallNodeId = bew5.cdWallNodeId; schaduwWaarden = bew5.schaduwWaarden;
    schaduwCountdownNul = bew5.schaduwCountdownNul; bevestigWrap.className = bew5.wrapClass;
    herstel();
  }

  // ═══ MW6 — de badge ══════════════════════════════════════════
  const N6 = 9602161;
  try {
    const leeg = () => { for (const d of Object.keys(DD)) { zet('sl_v4_' + N6 + '_' + d, null); zet('sl_v4_' + N6 + '_' + d + '_groen', null); }
      zet('sl_klok_' + N6, null); zet('sl_s2_' + N6, null);
      for (const k of Object.keys(localStorage)) if (k.startsWith('sl_v5_' + N6 + '_')) localStorage.removeItem(k); };
    const T = (dd = 'dag') => leerBadgeTekst(String(N6), dd);
    leeg(); const t1 = T();
    leeg(); zet('sl_klok_' + N6, [{ t: T0, type: 'groen', dd: 'dag' }]); const t2 = T();
    leeg(); zet('sl_s2_' + N6, [{ duur: 0, tijd: T0, bron: 's2' }]); const t3 = T();
    leeg(); zet('sl_v4_' + N6 + '_avond', [{ duur: 0, tijd: T0, s2: true, gewicht: 0.3 }, { duur: 0, tijd: T0 - 1000, s2: true }]); const t4 = T();
    leeg(); zet('sl_v4_' + N6 + '_dag_groen', [{ duur: 12, tijd: T0 }]); const t5 = T();
    leeg(); zet('sl_v4_' + N6 + '_dag', [{ duur: 31, tijd: T0 }, { duur: 0, tijd: T0 - 5 }, { duur: 50, tijd: T0 - 9, bron: 'bevestig_fout', gewicht: 0.2 }]);
            zet('sl_v4_' + N6 + '_avond', [{ duur: 44, tijd: T0 - 99 }, { duur: 18, tijd: T0 - 98 }]); const t6 = T();
    leeg(); zet('sl_v4_' + N6 + '_dag', [{ duur: 31, tijd: T0 }]); const t7 = T();
    leeg(); zet('sl_v5_' + N6 + '_N_W_dag', [{ duur: 31, tijd: T0 }, { duur: 33, tijd: T0 - 1 }]); const t8 = T();
    leeg(); zet('sl_v4_' + N6 + '_dag', [{ duur: 31, tijd: T0 }]); zet('sl_v5_' + N6 + '_N_W_dag', [{ duur: 31, tijd: T0 }]); const t9 = T();
    leeg(); zet('sl_v4_' + N6 + '_dag', [{ duur: 50, tijd: T0, bron: 'bevestig_fout' }]); const t10 = T();
    eis('MW6a niets bekend: Nieuw', t1.tekst === 'Nieuw' && !t1.bekend, 'Nieuw', kort(t1));
    eis('MW6b alleen een klokmoment, een S2-moment, nul-records of een groenfase: Gezien, nog niet geleerd (vier keer)',
        [t2, t3, t4, t5].every(x => x.tekst === 'Gezien, nog niet geleerd' && !x.bekend), '4x gezien', [t2, t3, t4, t5].map(x => x.tekst).join(' | '));
    eis('MW6c alleen echte metingen tellen: 31 + 44 + 18 = 3 metingen (niet de nul en niet de bevestig-correctie); 1 meting enkelvoud',
        t6.tekst === '3 metingen' && t6.bekend && t7.tekst === '1 meting', '3 metingen / 1 meting', t6.tekst + ' / ' + t7.tekst);
    eis('MW6d alleen richtingmetingen (V5) in dit dagdeel: V9: 2x; met beide: 1 meting · V9: 1x; alleen een bevestig-correctie: gezien',
        t8.tekst === 'V9: 2x' && t8.bekend && t9.tekst === '1 meting · V9: 1x' && t10.tekst === 'Gezien, nog niet geleerd', 'zoals beschreven', [t8.tekst, t9.tekst, t10.tekst].join(' | '));
    // bijwerkLeerkaart zet de nieuwe tekst op de badge
    const bewB = { tekst: leerBadge.textContent, klasse: leerBadge.className };
    leeg(); zet('sl_v4_' + N6 + '_avond', [{ duur: 0, tijd: T0, s2: true }]);
    try { bijwerkLeerkaart({ id: N6, naam: 'TEST', lat: 52, lon: 5, afstand: 50 }); } catch (e) {}
    const naB = { tekst: leerBadge.textContent, klasse: leerBadge.className };
    leeg(); zet('sl_v4_' + N6 + '_dag', [{ duur: 31, tijd: T0 }, { duur: 29, tijd: T0 - 1 }]);
    try { bijwerkLeerkaart({ id: N6, naam: 'TEST', lat: 52, lon: 5, afstand: 50 }); } catch (e) {}
    const naC = { tekst: leerBadge.textContent, klasse: leerBadge.className };
    leerBadge.textContent = bewB.tekst; leerBadge.className = bewB.klasse;
    eis('MW6e bijwerkLeerkaart zet de nieuwe tekst: nul-records = Gezien, nog niet geleerd (grijs); twee metingen = 2 metingen (groen)',
        naB.tekst === 'Gezien, nog niet geleerd' && !/bekend/.test(naB.klasse) && naC.tekst === '2 metingen' && /bekend/.test(naC.klasse),
        'zoals beschreven', kort([naB, naC]));
    // Past de langste tekst op 320 px? De kaart is 320 - 2x14 marge - 2x14 binnen - 2 rand = 262 px breed;
    // de naam ernaast mag inkrimpen (ellipsis), maar moet minstens ~100 px houden.
    const meet = (tekst) => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;white-space:nowrap;font-size:9px;padding:2px 8px;border-radius:8px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;border:1px solid transparent;font-family:' + getComputedStyle(document.body).fontFamily;
      d.textContent = tekst; document.body.appendChild(d);
      const w = d.getBoundingClientRect().width; d.remove(); return Math.ceil(w);
    };
    const breed = { nieuw: meet('Nieuw'), gezien: meet('Gezien, nog niet geleerd'), m: meet('48 metingen · V9: 12x'), oud: meet('48x gezien · V9: 12x') };
    eis('MW6f de langste nieuwe teksten passen naast de naam op 320 px (badge hoogstens 160 px van de 262 px)',
        breed.gezien <= 160 && breed.m <= 160, '<= 160 px', kort(breed));
  } catch (e) {
    eis('MW6 crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally { herstel(); }

  // ═══ MW7 — de export ═════════════════════════════════════════
  const ex = String(exporteerMeetdata);
  eis('MW7 de meetdata-export heeft de bakken stop en inert, gevuld uit sl_stoplog en sl_inertteller',
      /uit\.stop = \{\}; uit\.inert = \{\};/.test(ex) && /key === STOPLOG_SLEUTEL\)\s+doel = uit\.stop;/.test(ex) && /key === INERT_SLEUTEL\)\s+doel = uit\.inert;/.test(ex)
        && STOPLOG_SLEUTEL === 'sl_stoplog' && INERT_SLEUTEL === 'sl_inertteller' && exportSleutelMee(STOPLOG_SLEUTEL) && exportSleutelMee(INERT_SLEUTEL),
      'twee bakken, ook in de backup', 'zie bron');

  // ═══ MW2/MW3 — de stoplog met de echte onGPS ════════════════
  const bron = new URL('test_meetwerk21.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?meetwerk=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.onGPS !== 'function'; poging++) {   // V11.37.14: de app zelf laadde niet (testopstelling): de pagina opnieuw
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
      return await w.meetwerkRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], wissel: [], regellog: [], tik: [], opslag: [], stop: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  // Een weg naar het noorden. A recht vooruit op 100 m, M een tweede mast van hetzelfde kruispunt 9 m opzij,
  // Z opzij, B verder, F een fietslicht vlak voor de stopplek (3 m): het dichtstbij, maar nooit de kale keuze.
  // C ligt 150 m terug: de app staat er eerst op, rijdt erlangs en wisselt dan naar A (een wissel in de wissellog);
  // op de plek 100 m vóór de stop ligt C op 130 m, verder dan A, en valt dus buiten de drie.
  const A = 9602101 + 100, M = A + 1, Z = A + 2, B = A + 3, F = A + 4, C = A + 5;
  const nodes = [{ id: A, x: 0, y: 100 }, { id: M, x: -9, y: 106 }, { id: Z, x: 60, y: 30 }, { id: B, x: 0, y: 320 }, { id: F, x: 2, y: 91 }, { id: C, x: 0, y: -150 }];
  const punten = (stopY) => {
    const p = []; let y = -170;
    while (y < stopY) { p.push({ x: 0, y, kmh: 36, koers: 0 }); y += 10; }
    for (let j = 0; j < 8; j++) p.push({ x: 0, y: stopY, kmh: 0 });   // 8 s stil
    y = stopY;
    while (y < 380) { y += 10; p.push({ x: 0, y, kmh: 36, koers: 0 }); }
    return p;
  };
  const ritten = [
    ['vrij, stop voor A', { nodes, start: C, fiets: [F], punten: punten(88), okBij: 34, okNode: A, tikBij: 20, tikNode: A }],
    ['met tik op A', { nodes, start: A, fiets: [F], tik: true, punten: punten(88) }],
    ['zonder stop', { nodes, start: A, fiets: [F], punten: (() => { const p = []; for (let y = -170; y < 380; y += 10) p.push({ x: 0, y, kmh: 36, koers: 0 }); return p; })() }],
  ];
  const keuze = (r) => JSON.stringify(r.rij.map(x => [x.y, x.app, x.slot, x.auto, x.regel]));
  const logs = (r) => JSON.stringify([r.wissel.map(x => [x.t, x.van, x.naar, x.r, x.kmh, x.pl]), r.tik.map(x => [x.s, x.reden || x.tak || '']),
    r.regellog, r.opslag.map(x => [x.reden, x.node])]);
  let alles = true, fouten = [], uit3 = [];
  const metR = {};
  for (const [naam, opt] of ritten) {
    const met = await rit(opt), zonder = await rit({ ...opt, zonderStop: true });
    metR[naam] = met;
    if (met.fout || zonder.fout) { fouten.push(naam + ': ' + (met.fout || zonder.fout)); alles = false; continue; }
    const gelijk = keuze(met) === keuze(zonder) && logs(met) === logs(zonder);
    alles = alles && gelijk && met.rij.length > 40;
    uit3.push(naam + ': ' + met.rij.length + ' tikken, ' + met.wissel.length + ' wissels, ' + met.stop.length + ' stopregels, zonder ' + zonder.stop.length + ', ' + (gelijk ? 'gelijk' : 'ANDERS'));
  }
  eis('MW3a NIETS VERANDERT: drie ritten (vrij met een stop, met een tik, zonder stop) geven met en zonder de stoplog in elke GPS-tik dezelfde keuze, hetzelfde slot, dezelfde schaduwregel en dezelfde wissel-, tik-, regel- en opslaglog',
      alles && fouten.length === 0, 'gelijk', fouten.join(' | ') || uit3.join('; '));
  const s = (metR['vrij, stop voor A'] && metR['vrij, stop voor A'].stop) || [];
  const r0 = s[0] || {};
  const ids = (c) => Array.isArray(c) ? c.map(x => x[0]) : [];
  eis('MW2a één stop geeft één regel in sl_stoplog, met de stopplek op 5 decimalen en de koers',
      s.length === 1 && typeof r0.la === 'number' && typeof r0.lo === 'number' && Math.abs(r0.la - (52 + 88 / 111320)) < 0.00002 && Math.abs(r0.lo - 5) < 0.00002
        && String(r0.la).split('.')[1].length <= 5 && r0.k === 0 && typeof r0.t === 'number',
      '1 regel, la/lo, k 0', kort(s));
  // De stop staat op y = 88; het spoor heeft plekken om de 10 m, dus de plek 100 m terug is y = -20 (A op 120 m), 50 m terug y = 30
  // (A op 70 m) en 30 m terug y = 50 (A op 50 m). De lijst staat op afstand: op 100 en 50 m is Z (opzij) dichterbij dan A.
  const rijVan = (c, id) => (Array.isArray(c) ? c.find(x => x[0] === id) : null);
  const ok2 = (c, d) => { const x = rijVan(c, A); return !!x && Math.abs(x[1] - d) <= 2 && Math.abs(x[2]) <= 1; };
  const opAfstand = (c) => Array.isArray(c) && c.every((x, i) => i === 0 || x[1] >= c[i - 1][1]);
  // Binnen 150 m van de plek 100 m terug liggen Z (78), F (111), A (120) en M (126): de lijst houdt de drie dichtste.
  eis('MW2b kandidaten op 100, 50, 30 m en bij stilstand, dichtstbij eerst, precies 3: [id, afstand, peiling, merk]; A recht vooruit op 120, 70, 50 en 12 m; Z opzij (peiling 50 graden en meer); M valt op 100 m af; bij stilstand F (merk f), A, M',
      ok2(r0.c100, 120) && ok2(r0.c50, 70) && ok2(r0.c30, 50) && ok2(r0.c0, 12) && ids(r0.c0).join() === [F, A, M].join() && r0.c0[0][3] === 'f'
        && [r0.c100, r0.c50, r0.c30, r0.c0].every(c => opAfstand(c) && c.length === 3) && !rijVan(r0.c100, M)
        && rijVan(r0.c100, Z) && Math.abs(rijVan(r0.c100, Z)[2]) >= 50,
      'A 120/70/50/12, Z opzij, F A M', kort([r0.c100, r0.c50, r0.c30, r0.c0]));
  eis('MW2c bij stilstand ook de score (x 100; F het hoogst, het dichtstbij), en z = de kale score-keuze zonder fietslicht (A); app en regel op 100/50/30 m en na 2 s',
      Array.isArray(r0.c0) && r0.c0[0].length === 5 && typeof r0.c0[0][4] === 'number' && r0.c0[0][4] > r0.c0[1][4] && r0.z === A
        && r0.a100 === A && r0.a2 === A && r0.r2 === A && 'r100' in r0 && 'a50' in r0 && 'a30' in r0,
      'score, z A', kort({ c0: r0.c0, z: r0.z, a2: r0.a2, r2: r0.r2 }));
  eis('MW2d bij het wegrijden aangevuld: e (het licht toen), du (stopduur, ~8 s) en de meting tijdens de stop (m A, md 33)',
      r0.e === A && r0.du >= 6 && r0.du <= 12 && r0.m === A && r0.md === 33, 'e A, du ~8, m A, md 33', kort({ e: r0.e, du: r0.du, m: r0.m, md: r0.md }));
  eis('MW2k de laatste wissel naar het getoonde licht (de app stond op C en wisselde na het passeren naar A, ruim voor de stop: wt negatief) en de laatste tik (6 s voor de stop, op A)',
      typeof r0.wr === 'string' && r0.wr.length > 0 && typeof r0.wt === 'number' && r0.wt < -10 && r0.tn === A && r0.tk >= 5 && r0.tk <= 7,
      'wr, wt < -10, tk ~6, tn A', kort({ wr: r0.wr, wt: r0.wt, tk: r0.tk, tn: r0.tn, w: ((metR['vrij, stop voor A'] || {}).wissel || []).map(x => [x.van, x.naar, x.r]) }));
  eis('MW2e zonder slot staat sl op -, met een tik op hand; een rit zonder stop schrijft niets',
      r0.sl === '-' && ((metR['met tik op A'] || {}).stop || [])[0] && metR['met tik op A'].stop[0].sl === 'hand' && ((metR['zonder stop'] || {}).stop || []).length === 0,
      '- / hand / 0', kort([r0.sl, ((metR['met tik op A'] || {}).stop || [])[0], ((metR['zonder stop'] || {}).stop || []).length]));
  const vol = await rit({ ...ritten[0][1], vul: 60 });
  eis('MW2f een volle ring (60) houdt er 60: de oudste eruit, de nieuwe stop achteraan',
      !vol.fout && vol.stop.length === 60 && vol.stop[59].la !== undefined && vol.stop[0].t === 1, '60, nieuwe achteraan', vol.fout || (vol.stop.length + ' ' + kort(vol.stop[59])));
  const quota = await rit({ ...ritten[0][1], vol: true });
  eis('MW2g een vol quotum staakt alleen de stoplog (sleutel weg, gestopt), de keuze en de andere logs lopen door',
      !quota.fout && quota.gestopt && !quota.sleutelEr && keuze(quota) === keuze(metR['vrij, stop voor A']) && quota.regellog.length > 0,
      'gestopt, rest gelijk', quota.fout || kort({ g: quota.gestopt, er: quota.sleutelEr, regel: quota.regellog.length }));
  const afVol = await rit({ ...ritten[0][1], volBijAf: true });
  eis('MW2i mislukt alleen de aanvulling bij het wegrijden (vol quotum), dan staakt de stoplog (sleutel weg) en loopt de rest door',
      !afVol.fout && afVol.gestopt && !afVol.sleutelEr && keuze(afVol) === keuze(metR['vrij, stop voor A']),
      'gestopt', afVol.fout || kort({ g: afVol.gestopt, er: afVol.sleutelEr }));
  const ver = await rit({ nodes: nodes.filter(n => n.id !== C), start: A, fiets: [F], punten: (() => { const p = []; for (let y = -170; y < -150; y += 10) p.push({ x: 0, y, kmh: 36, koers: 0 });
    for (let j = 0; j < 8; j++) p.push({ x: 0, y: -150, kmh: 0 }); for (let y = -140; y < 380; y += 10) p.push({ x: 0, y, kmh: 36, koers: 0 }); return p; })() });
  eis('MW2j een stop zonder licht binnen 80 m (A op 250 m) schrijft niets', !ver.fout && ver.stop.length === 0, '0', ver.fout || String(ver.stop.length));
  const kortStil = await rit({ nodes, start: A, fiets: [F], punten: (() => { const p = []; for (let y = -170; y < 88; y += 10) p.push({ x: 0, y, kmh: 36, koers: 0 });
    p.push({ x: 0, y: 88, kmh: 0 }); for (let y = 98; y < 380; y += 10) p.push({ x: 0, y, kmh: 36, koers: 0 }); return p; })() });
  eis('MW2l een stilstand van 1 s (korter dan REGEL_STOP_MS) is geen stop: niets geschreven', !kortStil.fout && kortStil.stop.length === 0, '0', kortStil.fout || String(kortStil.stop.length));
  const vreemd = await rit({ ...ritten[0][1], vreemdBij: 30 });
  const vr = vreemd.stop || [];
  eis('MW2m staat er tijdens de stop een andere regel achteraan de ring, dan raakt de aanvulling bij het wegrijden die niet (alleen de eigen stop, op tijd t)',
      !vreemd.fout && vr.length === 2 && vr[1].vreemd === 1 && !('e' in vr[1]) && !('du' in vr[1]) && vr[0].la !== undefined && !('e' in vr[0]),
      'vreemde regel ongemoeid', vreemd.fout || kort(vr));
  const grootte = new TextEncoder().encode(JSON.stringify(r0)).length;
  eis('MW2h één stopregel is klein (hoogstens 900 bytes), dus de ring van 60 blijft onder ~54 KB', grootte <= 900, '<= 900 B', grootte + ' B');

  // ═══ MW8 — regressie ═════════════════════════════════════════
  const V113720 = {
    mergeRichtingen: ['3db111bf', 7634], preprocessVoorYOLO: ['f379eecc', 2733], detLogSchrijf: ['83e7c261', 3366],
    bevestigCountdown: ['8457401d', 16073], exporteerMeetdata: ['594f2f13', 9482], bijwerkLeerkaart: ['8344c773', 8107], onGPS: ['9c40a4a2', 15631],
    logOpslagMis: ['6d7fd828', 16172] };
  // Gemeten in de bron van V11.37.20 (54b6afa) in een eigen headless Chrome, niet afgeleid uit deze versie.
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.21(?!\d)/.test(l)).length;
  const telVerwacht = { mergeRichtingen: 1, preprocessVoorYOLO: 2, detLogSchrijf: 1, bevestigCountdown: 4, exporteerMeetdata: 3, bijwerkLeerkaart: 3, onGPS: 1, logOpslagMis: 1 };
  const telAf = Object.entries(telVerwacht).filter(([n, m]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('MW8a acht functies krijgen regels met merkteken V11.37.21: bevestigCountdown 4, exporteerMeetdata 3, bijwerkLeerkaart 3, preprocessVoorYOLO 2, de andere 1',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V113720).filter(([n, [h, l]]) => { const s = zonderV113721(window[n]); return fnv(s) !== h || s.length !== l; })
    .map(([n]) => n + ' ' + fnv(zonderV113721(window[n])) + '/' + zonderV113721(window[n]).length);
  eis('MW8b zonder die regels zijn ze byte-gelijk aan V11.37.20 (alles is toegevoegd, niets gewijzigd)', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  let code = [];
  try {
    const html = await (await fetch(new URL('index.html', location.href).href + '?t=' + Date.now())).text();
    code = html.split(NL).filter(l => /V11\.37\.21(?!\d)/.test(l) && !/^\s*\/\//.test(l));
  } catch (e) { code = ['fout: ' + e]; }
  eis('MW8c in de bron staat V11.37.21 buiten het commentaar alleen in de versie, die zestien regels in de acht functies, de declaratie van detLogGeenCrop en de regel in het merge-blok niet (dat heeft zijn eigen kop)',
      code.filter(l => !/^const APP_VERSIE = /.test(l)).length === 17 && code.filter(l => /^let detLogGeenCrop/.test(l)).length === 1,   // V11.37.22: de versieregel telt niet mee, die gaat met elke release mee
      '17 regels naast de versie', code.length + ': ' + code.map(l => l.trim().slice(0, 30)).join(' | '));

  Date.now = bewNu;
  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

// V11.37.21: dezelfde helper als in de andere toetsen; hier voor MW8
function zonderV113721(s) { return String(s).split('\n').map(terugV113731).map(terugV113726).filter(l => !/V11\.37\.21(?!\d)|V11\.37\.22(?!\d)|V11\.37\.23(?!\d)|V11\.37\.25(?!\d)|V11\.37\.26(?!\d)|V11\.37\.30(?!\d)|V11\.37\.31(?!\d)/.test(l)).join('\n'); }   // V11.37.22: ook de meetregels van V11.37.22 (test_meetwerk22); V11.37.23: idem (test_meetwerk23); V11.37.25: idem (test_plaatsen)   // V11.37.26: idem (test_schaduw_nano), met terugV113726
// V11.37.26: drie regels van laadONNXModel zijn vervangen (de modelnaam komt uit MODEL_PADEN, test_schaduw_nano).
// Die gaan hier terug naar de oude tekst; daarna vallen de regels met merkteken V11.37.26 weg zoals de andere.
// V11.37.31: Nano is het hoofdmodel; deze regels zijn VERVANGEN (niet toegevoegd). Hier gaat precies de oude regel terug,
// zodat de vergelijkingen hieronder de oude functies blijven toetsen. Toegevoegde regels vallen weg via het merkteken V11.37.31.
var TERUG_V113731 = {"  if (totaalMCheck === 0 && (obsNu == null || obsNu < OBS_MINIMUM) && conf != null && conf < hoofdGrens('leer')) {   // V11.37.33: de grens van het geladen model": "  if (totaalMCheck === 0 && (obsNu == null || obsNu < OBS_MINIMUM) && conf != null && conf < 0.20) {", "    if (Array.isArray(detecties) && detecties.some(d => familieScore(d) >= hoofdGrens('sterk'))) minStat.s[b]++;   // V11.37.33: de grens van het geladen model": "    if (Array.isArray(detecties) && detecties.some(d => familieScore(d) >= MINUUT_STERK)) minStat.s[b]++;", "  if (gesmoothedScore >= hoofdGrens('camNode') && snelheidKmh > 5 && huidigePos) {   // V11.37.33: de grens van het geladen model": "  if (gesmoothedScore >= 0.60 && snelheidKmh > 5 && huidigePos) {", "    if (familieScore(bbox) < hoofdGrens('s2Fam')) continue;   // V11.37.33: de grens van het geladen model": "    if (familieScore(bbox) < 0.35) continue;", "    if (kleur && bbox.score >= hoofdGrens('s2Aanwezig')) slaS2Aanwezigheid(match.nodeId, kleur);   // V11.37.33: de grens van het geladen model": "    if (kleur && bbox.score >= 0.50) slaS2Aanwezigheid(match.nodeId, kleur);", "    if (trainframesAan) slaTrainframeOp('s2', bbox.klasse, bbox.cx/YOLO_SIZE, bbox.cy/YOLO_SIZE, bbox.w/YOLO_SIZE, bbox.h/YOLO_SIZE, bbox.score < hoofdGrens('tfTwijfelS2'));   // V11.37.33: de grens van het geladen model": "    if (trainframesAan) slaTrainframeOp('s2', bbox.klasse, bbox.cx/YOLO_SIZE, bbox.cy/YOLO_SIZE, bbox.w/YOLO_SIZE, bbox.h/YOLO_SIZE, bbox.score < 0.55);", "    const _hoogFScore = (aiR.fScore || 0) >= hoofdGrens('fscore');   // V11.37.33: de grens van het geladen model": "    const _hoogFScore = (aiR.fScore || 0) >= FSCORE_OVERRIDE_DREMPEL;", "    if (aiTeller === 1 && trainframesAan && aiR.box && aiR.score < hoofdGrens('s1Twijfel')) {   // V11.37.33: de grens van het geladen model": "    if (aiTeller === 1 && trainframesAan && aiR.box && aiR.score < 0.60) {", "    const wasStabiel = greenConfHistory.length >= 2 && gemGreen > hoofdGrens('groenStabiel');   // V11.37.33: de grens van het geladen model": "    const wasStabiel = greenConfHistory.length >= 2 && gemGreen > GREEN_STABIEL_DREMPEL;", "  if (b.tap) return !(fam >= hoofdTapConf()) ? 'conf_tik' : (b.h < 2 || b.w <= 0) ? 'klein' : 'door';   // V11.37.33: de grens van het geladen model": "  if (b.tap) return !(fam >= TAP_CONF_DREMPEL) ? 'conf_tik' : (b.h < 2 || b.w <= 0) ? 'klein' : 'door';", "  if (!(fam >= hoofdConf())) return 'conf';   // V11.37.33: de grens van het geladen model": "  if (!(fam >= CONF_DREMPEL)) return 'conf';", "    let modelPad = hoofdPaden()[0];   // V11.37.31: Nano eerst (HOOFD_PADEN_NANO), zie het blok V11.37.31": "    let modelPad = './model.onnx';", "      onnxSession = await hoofdSessie(modelPad);   // V11.37.31: één download, de sessie op de hoofdthread pas als er geen worker is": "      onnxSession = await ort.InferenceSession.create(modelPad, { executionProviders:['wasm'], graphOptimizationLevel:'all' });", "      modelPad = hoofdPaden()[1];   // V11.37.31: de reserve uit de lijst": "      modelPad = './model/model.onnx';", "    if (!(modelSoortVan(modelPad) in MODEL_SOORTEN)) throw new Error('hoofdpad ' + modelPad + ': onbekende soort');   // V11.37.31: YOLOv8 of YOLOX; de worker en de nabewerking volgen de soort": "    if (modelSoortVan(modelPad) !== 'yolov8') throw new Error('hoofdpad ' + modelPad + ' is geen YOLOv8-bestand');   // V11.37.26: het hoofdpad leest alleen YOLOv8 (images RGB 0..1, output0)", "    pAI.className='pill-dot g'; pAIT.textContent=hoofdLabel(modelPad);   // V11.37.31: 'Nano' of 'YOLOv8n'": "    pAI.className='pill-dot g'; pAIT.textContent='YOLOv8n';   // V11.37.26: was 'YOLOv8'", "      const modelArrayBuffer = await hoofdBuffer(modelPad);   // V11.37.31: dezelfde download als hoofdSessie, geen tweede": "      const modelArrayBuffer = await fetch(modelPad).then(r=>r.arrayBuffer());", "      const blob = new Blob([hoofdWorkerCode(modelPad)], { type:'application/javascript' });   // V11.37.31: de Nano-worker voor een YOLOX-bestand": "      const blob = new Blob([YOLO_WORKER_CODE], { type:'application/javascript' });", "      if (famScore < hoofdTapConf()) continue;   // V11.37.31: de drempel van het geladen model (Nano 0,03)": "      if (famScore < TAP_CONF_DREMPEL) continue;", "      if (famScore < hoofdConf()) continue;   // V11.37.31: idem (Nano 0,07)": "      if (famScore < CONF_DREMPEL) continue;", "  './model.onnx':            { soort: 'yolov8', naam: 'YOLOv8n',                rol: 'reserve' },   // V11.37.31: was hoofd (zie HOOFD_PADEN_NANO)": "  './model.onnx':            { soort: 'yolov8', naam: 'YOLOv8n',                rol: 'hoofd' },", "  './model/model.onnx':      { soort: 'yolov8', naam: 'YOLOv8n (reservemodel)', rol: 'reserve2' },   // V11.37.31: was reserve (alleen nog na sl_hoofdmodel=yolov8)": "  './model/model.onnx':      { soort: 'yolov8', naam: 'YOLOv8n (reservemodel)', rol: 'reserve' },", "  './model/yolox_nano.onnx': { soort: 'yolox',  naam: 'YOLOX-Nano',             rol: 'hoofd' }   // V11.37.31: was schaduw": "  './model/yolox_nano.onnx': { soort: 'yolox',  naam: 'YOLOX-Nano',             rol: 'schaduw' }"};
function terugV113731(l) { return Object.prototype.hasOwnProperty.call(TERUG_V113731, l) ? TERUG_V113731[l] : l; }
function terugV113726(l) {
  if (!/V11\.37\.26(?!\d)/.test(l)) return l;
  return l.replace(/^(\s*)sModelLabel\.textContent = '🤖 Model laden…';.*$/, "$1sModelLabel.textContent = '🤖 YOLOv8 model laden…';")
          .replace(/^(\s*)sModelLabel\.textContent = `✓ Model klaar: \$\{modelNaamVan\(modelPad\)\} \(\$\{t\}s\)`;.*$/, '$1sModelLabel.textContent = `✓ YOLOv8 klaar (${t}s)`;')
          .replace(/^(\s*)pAI\.className='pill-dot g'; pAIT\.textContent='YOLOv8n';.*$/, "$1pAI.className='pill-dot g'; pAIT.textContent='YOLOv8';");
}

if (typeof window !== 'undefined') { window.testMeetwerk21 = testMeetwerk21; window.meetwerkRitBinnen = meetwerkRitBinnen; }
