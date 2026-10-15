// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_fietslicht.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.8: fiets- en voetgangerslichten zijn geen kandidaat meer
//  (met schakelaar, fail-open, nooit als enige kandidaat, de tik blijft
//  toegestaan); KLOPTE/BIJNA/FOUT na een wissel gaat naar het licht waarvoor
//  de knoppen verschenen; tMin en pN in de wissellog; de ©-regel in beeld.
//
//  Het vaste stratenplan: x naar het oosten, y naar het noorden, in meters; de
//  auto rijdt noordwaarts. De twee veldgevallen zijn nagebouwd met de afstanden
//  uit de kaart, met eigen nummers en zonder echte plek.
//
//  FL1  de schakelaar, en fail-open: zonder lijst valt niets af
//  FL2  het veldgeval FL2 (STAP 0 van 8 okt): na het passeren van een licht op de
//       hoofdweg wisselde de app naar een fietslicht 6 m verderop, en pas
//       3 s later naar het licht aan de overkant. Met het filter komt het
//       fietslicht nergens; zonder filter (of zonder lijst) wel, zoals toen
//  FL3  nooit uitsluiten als het de enige kandidaat is: per GPS-tik gelijk
//  FL4  zoals in het veldgeval FL4: de app kiest zelf het autolicht; een tik op het
//       fietslicht (dat daar het goede licht was) blijft staan, ook als het slot
//       vervalt
//  FL5  het puur dichtstbijzijnde licht (stilstandscorrectie, snelle route,
//       nadering): zonder fietslicht, behalve als er binnen 400 m niets anders is
//  FL6  de schaduwregel (regelKies)
//  FL7  de lijst ophalen: de vraag (alleen plek en straal), bewaren, een half
//       antwoord (remark), een fout met nieuwe pogingen, hergebruik, en de grootte
//  FL8  KLOPTE/BIJNA/FOUT na een wissel: naar het oude licht, binnen 15 s, met
//       dezelfde poorten; elke druk gelogd met het oude en het nieuwe licht;
//       ook bij 'geen licht', een correctie en een lijstkeuze
//  FL9  de wissellog: tMin en pN
//  FL10 de ©-regel: boven de onderste balk, en hij bedekt niets
//  FL11 regressie: welke functies veranderen, en dat de rest byte-gelijk is
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_fietslicht.js';
//      document.head.appendChild(s);
//      s.onload = () => testFietslicht().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: een rit met de echte onGPS ─────────
// opt: { nodes: [{ id, x, y, f }], lijst (null = geen lijst; anders de f-lichten), uit (schakelaar uit),
//        start, punten: [{ x, y, kmh, tik?, los? }] } — één GPS-tik per punt, 1 s ertussen.
// tik: kies dat licht uit de lijst (selecteerNodeHandmatig) vóór deze GPS-tik; los: het slot vervalt.
async function fietsRitBinnen(opt) {
  const LAT0 = 52.0000, LON0 = 5.0000;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  window.toonToast = () => {};
  if (opt.uit) window.fietsUitAan = () => false;
  fietsLichten = opt.lijst === null ? null : new Set(opt.nodes.filter(n => n.f).map(n => String(n.id)));
  try { for (const k of ['sl_wissellog', 'sl_opslaglog', 'sl_regellog', TIKLOG_SLEUTEL]) localStorage.setItem(k, '[]'); } catch (e) {}
  tikLogArr = null; tikLogStop = false; tikLogVorige = { tak: null, t: 0 }; tikLogLevend = null;
  osmCache = opt.nodes.map(n => ({ id: n.id, naam: String(n.id), ...LL(n.x, n.y) }));
  cacheGeladen = true; cacheBezig = false; cacheCentrum = LL(0, 0);
  eersteGPSVerwerkt = true;
  clusterNodes = new Set();
  const start = opt.start != null ? osmCache.find(n => n.id === opt.start) : null;
  dichtstbijOSM = start ? { ...start, afstand: 100 } : null; vorigOsmId = start ? start.id : null;
  handmatigLockActief = false; stilstandAutoLock = false;
  handmatigGeselecteerdNodeId = null; handmatigGeselecteerdTimestamp = 0;
  stilstandSinds = 0; laatsteNodeCorrectieTijd = 0; laatsteNodeWisselTijd = 0;
  headingBuffer.length = 0;
  hoekStabielReset(); handLockVervalReset(); naderBewijsReset();
  wisselStaat = null; wisselTik = null; a3Reeks = null; a3LosTijd = 0;
  regelReset(); achterReset(); achterLosTijd = 0; geenLichtSinds = 0;
  tikSlotMerk = null; snelReset();
  const rij = [];
  let vorige = null;
  for (const p of opt.punten) {
    klok += 1000;
    if (p.tik != null) selecteerNodeHandmatig(p.tik);
    if (p.los) { handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null; }
    const v = p.kmh / 3.6;
    let h = (vorige && (p.x !== vorige.x || p.y !== vorige.y)) ? (Math.atan2(p.x - vorige.x, p.y - vorige.y) * 180 / Math.PI + 360) % 360 : 1;
    if (Math.round(h) === 0) h = 1;
    const q = LL(p.x, p.y);
    let fout = null;
    try {
      await onGPS({ coords: { latitude: q.lat, longitude: q.lon, speed: v, heading: v > 0 ? h : NaN }, timestamp: klok });
      tikLogWaak();
    } catch (e) { fout = String(e && e.message || e).slice(0, 120); }
    rij.push({ y: Math.round(p.y * 10) / 10, kmh: p.kmh, app: dichtstbijOSM ? dichtstbijOSM.id : null,
               puur: puurDichtsteNodeCache ? puurDichtsteNodeCache.id : null, regel: regelStaat.keuze == null ? null : Number(regelStaat.keuze),
               slot: handmatigLockActief ? 1 : 0, fout });
    vorige = p;
  }
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  return { rij, wissel: lees('sl_wissellog'), op: lees('sl_opslaglog') };
}

// ── Draait IN een iframe: KLOPTE/BIJNA/FOUT rond een wissel ──
// opt: { pad: 'wissel'|'geen'|'correctie'|'lijst', mom: 'goed'|'zandloper', aiK, drukken: [{ cat, na (ms na de wissel), eigen? }],
//        normaalEerst? (één gewone FOUT voor het oude licht, om de velden te vergelijken) }
async function fietsBevestigBinnen(opt) {
  const LAT0 = 52.0000, LON0 = 5.0000;
  const mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  let klok = 1790000000000;
  Date.now = () => klok;
  window.downloadOSM = async () => {};
  window.refreshStadIndienNodig = async () => {};
  const toasts = []; window.toonToast = (t) => toasts.push(String(t));
  const leer = [];
  const echtLeer = window.verwerkBevestigLeren;
  window.verwerkBevestigLeren = function (id, cat, mom) { leer.push({ id: String(id), cat, doel: activeCdDoel, max: activeCdMax, toestand: mom && mom.toestand }); return echtLeer.apply(this, arguments); };
  const A = 9810001, B = 9810002;
  for (const k of ['sl_opslaglog', 'sl_bevestig_' + A, 'sl_bevestig_' + B]) opslagVerwijder(k);
  localStorage.setItem('sl_opslaglog', '[]');
  // een leergeheugen voor A, zodat het leren iets te doen heeft
  const mA = []; for (let i = 0; i < 5; i++) mA.push({ duur: 60, tijd: klok - i * 86400000, richting: 0, obs: 60, gewicht: 1, bron: 's1' });
  for (const dd of Object.keys(DD)) localStorage.setItem('sl_v4_' + A + '_' + dd, JSON.stringify(mA));
  osmCache = [{ id: A, naam: 'A', ...LL(0, 300) }, { id: B, naam: 'B', ...LL(0, 10) }];
  cacheGeladen = true; cacheBezig = false; eersteGPSVerwerkt = true; clusterNodes = new Set();
  huidigePos = LL(0, 0); snelheidKmh = 0; headingBuffer.length = 0;
  handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null;
  dichtstbijOSM = { ...osmCache[0], afstand: 300 }; vorigOsmId = A;
  achterReset(); regelReset(); wisselStaat = null; wisselTik = null;
  // de meetcontext van A: groen 3 s geleden, het nulpunt 1 s daarvoor (overschrijding 1 s: KLOPTE)
  // of rood, 5 s na het nulpunt (de zandloper: KLOPTE gedempt)
  const pnu = performance.now();
  if (opt.mom === 'zandloper') { fase = 'rood'; groenStart = null; cdBereikteNul = true; countdownNulTijd = klok - 5000; }
  else { fase = 'groen'; groenStart = pnu - 3000; cdBereikteNul = true; countdownNulTijd = klok - 4000; }
  faseStart = pnu - 50000; laatsteRoodFaseStart = klok - 50000;
  activeCdDoel = 60; activeCdMax = 75; huidigCdBron = 'V4'; huidigCdWaarde = 60;
  aiKleur = opt.aiK || 'groen'; aiTeller = 3;
  const knoppen = () => bevestigWrap.classList.contains('actief');
  const zetKnoppen = (id) => { bevestigActief = true; bevestigVoorNodeId = String(id); bevestigWrap.classList.add('actief'); bevestigGedaanVoorFase = null; };
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
  const uit = { stappen: [] };
  zetKnoppen(A);
  if (opt.normaalEerst) {
    bevestigCountdown('fout');
    uit.normaal = lees('sl_bevestig_' + A).slice(-1)[0] || null;
    opslagVerwijder('sl_bevestig_' + A);
    leer.length = 0;
    zetKnoppen(A);
    klok += 3000;
  }
  const t0 = klok;
  if (opt.pad === 'wissel') updateDichtbij(huidigePos.lat, huidigePos.lon);
  else if (opt.pad === 'geen') geenLichtZetten();
  else if (opt.pad === 'correctie') corrigeerNodeAutomatisch(osmCache[1], 'test');
  else if (opt.pad === 'lijst') selecteerNodeHandmatig(B);
  uit.naWissel = { getoond: dichtstbijOSM ? dichtstbijOSM.id : null, knoppen: knoppen(), actief: bevestigActief, vries: bevestigVries ? bevestigVries.node : null,
                   doel: activeCdDoel, max: activeCdMax };
  for (const d of opt.drukken || []) {
    klok = t0 + d.na;
    if (d.eigen) zetKnoppen(B);
    bevestigCountdown(d.cat);
    uit.stappen.push({ cat: d.cat, knoppen: knoppen(), vries: bevestigVries ? bevestigVries.node : null, doel: activeCdDoel, max: activeCdMax });
  }
  const log = lees('sl_opslaglog').filter(r => /^bevestig/.test(r.reden)).map(r => ({ reden: r.reden, node: r.node, nieuw: r.nieuw, el: r.element, uit: r.poortReden, dur: r.dur }));
  return { ...uit, A, B, log, recA: lees('sl_bevestig_' + A), recB: lees('sl_bevestig_' + B), leer, toasts };
}

// ── Draait IN een iframe: de lijst ophalen met een nep-Overpass ──
// opt: { antwoorden: [ { status, json } ], opslag: object|undefined, kaart: { lat, lon } }
async function fietsHaalBinnen(opt) {
  const vragen = [];
  let n = 0;
  const echtFetch = window.fetch;
  const anders = [];
  window.fetch = async (url, init) => {
    if (String(url) !== OVERPASS_URL) { anders.push(String(url).slice(0, 80)); return echtFetch(url, init); }   // de rest van de app (versie, model) gaat gewoon door
    vragen.push({ url: String(url), body: init && init.body ? decodeURIComponent(String(init.body).replace(/^data=/, '')) : '' });
    const a = opt.antwoorden[Math.min(n++, opt.antwoorden.length - 1)];
    return { ok: a.status === 200, status: a.status, json: async () => a.json };
  };
  const echtST = window.setTimeout;
  window.setTimeout = (f, ms, ...r) => echtST(f, (ms >= 4000 && ms !== 30000) ? 0 : ms, ...r);   // de wachttijden niet echt afwachten
  localStorage.setItem('sl_opslaglog', '[]');
  if (opt.opslag === undefined) localStorage.removeItem(FIETS_SLEUTEL); else localStorage.setItem(FIETS_SLEUTEL, JSON.stringify(opt.opslag));
  try { opslagCache.delete(FIETS_SLEUTEL); } catch (e) {}
  fietsLichten = null; fietsBezig = false; fietsGebieden = null; fietsTimer = null;   // V11.37.12: fietsDoel bestaat niet meer
  localStorage.removeItem(FIETS_POGING_SLEUTEL);   // V11.37.12
  osmCache = [{ id: 9820001, lat: opt.kaart.lat, lon: opt.kaart.lon }];
  dichtstbijOSM = null;
  const direct = fietsLichten;
  fietsNaKaart(opt.kaart.lat, opt.kaart.lon);
  const meteen = fietsLichten ? fietsLichten.size : null;
  for (let i = 0; i < 100 && (fietsBezig || vragen.length < (opt.wachtVragen || 0)); i++) await new Promise(r => echtST(r, 20));
  await new Promise(r => echtST(r, 50));
  window.setTimeout = echtST;
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  return { vragen, anders, direct, meteen, na: fietsLichten ? [...fietsLichten] : null, opslag: lees(FIETS_SLEUTEL), ruw: localStorage.getItem(FIETS_SLEUTEL),
           log: (lees('sl_opslaglog') || []).filter(r => r.reden === 'fietslichten').map(r => r.element + ' ' + r.poortReden) };
}

// ── Draait op de testpagina ──────────────────────────────────
async function testFietslicht() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
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
  const bron = new URL('test_fietslicht.js', location.href).href;
  const pagina = location.pathname;
  const inFrame = async (functie, opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?fiets=' + Math.random();
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
      return JSON.parse(JSON.stringify(await w[functie](opt)));
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), rij: [], wissel: [], op: [], log: [], stappen: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const rit = (opt) => inFrame('fietsRitBinnen', opt);
  const lijn = (vanY, totY, kmh, x = 0) => { const p = [], v = kmh / 3.6; for (let y = vanY; y <= totY + 1e-9; y += v) p.push({ x, y, kmh }); return p; };
  const fouten = (r) => r.fout || (r.rij.find(x => x.fout) || {}).fout || null;
  const keten = (r) => { const k = []; for (const x of r.rij) if (!k.length || k[k.length - 1] !== x.app) k.push(x.app); return k; };
  const verschil = (a, b, veld = 'app') => a.rij.filter((x, i) => !b.rij[i] || b.rij[i][veld] !== x[veld]).length;

  // ═══ FL1 — de schakelaar en fail-open ══════════════════════
  const bewaarLijst = fietsLichten;
  try {
    eis('FL1a de schakelaar staat aan (FIETS_UIT_ACTIEF), en alles loopt via fietsUitAan()',
        FIETS_UIT_ACTIEF === true && fietsUitAan() === true && /fietsUitAan\(\)/.test(String(fietsSluitUit)) && /fietsUitAan\(\)/.test(String(regelKies)),
        'aan', String(FIETS_UIT_ACTIEF));
    fietsLichten = null;
    eis('FL1b zonder lijst valt niets af (fail-open)', fietsSluitUit({ id: 1 }) === false && isFietsLicht(1) === false, 'false', String(fietsSluitUit({ id: 1 })));
    fietsLichten = new Set(['1']);
    const bewaarG = dichtstbijOSM;
    dichtstbijOSM = null;
    const met = fietsSluitUit({ id: 1 }), ander = fietsSluitUit({ id: 2 });
    dichtstbijOSM = { id: 1, lat: 0, lon: 0 };
    const getoond = fietsSluitUit({ id: 1 });
    dichtstbijOSM = bewaarG;
    eis('FL1c met lijst valt een fietslicht af, een ander licht niet, en het getoonde licht nooit', met === true && ander === false && getoond === false,
        'true / false / false', [met, ander, getoond].join(' / '));
  } finally { fietsLichten = bewaarLijst; }
  eis('FL1d de wegsoorten: fietspad, voetpad, pad, voetgangersgebied, trap, ruiterpad; tegenover alle autowegen (ook service en busbaan)',
      FIETS_WEGEN === 'cycleway|footway|path|pedestrian|steps|bridleway'
        && ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'road', 'busway', 'primary_link'].every(w => AUTO_WEGEN.split('|').includes(w)),
      'zes / zestien', FIETS_WEGEN + ' / ' + AUTO_WEGEN.split('|').length);

  // ═══ FL2 — het veldgeval, nagebouwd ═══════════════════════
  // De afstanden uit de kaart, gedraaid naar 'noordwaarts'. S1 is het licht dat de app toonde (op de hoofdweg), F1 het
  // fietslicht 39 m verder waar de app naartoe wisselde, S2 het licht aan de overkant (47 m), daarna de volgende
  // kruising op ~280 m. f: 1 = alleen op een fiets- of voetpad.
  const S1 = 9800001, F1 = 9800004, S2 = 9800006;
  const veld = [
    [S1, 0, 0, 0], [9800002, -15.8, 7.9, 1], [9800003, -27.2, 22.9, 0], [9800005, -20.5, 36.4, 1], [F1, 5.5, 38.6, 1], [S2, -13.1, 45.7, 0],
    [9800007, -11.1, -107.9, 0], [9800008, 6.5, -116.6, 1], [9800009, -14.8, -116.8, 1], [9800010, 19.8, -133, 0], [9800011, 9.8, -141.5, 1], [9800012, -4.1, -156.3, 0],
    [9800013, 0.7, 272.9, 0], [9800014, -9.8, 286.1, 1], [9800015, 24.5, 304, 1], [9800016, -9.8, 312.1, 0], [9800017, 0.3, 317.5, 1], [9800018, 15.3, 321, 0], [9800019, 26.5, 323.4, 0]
  ].map(([id, x, y, f]) => ({ id, x, y, f }));
  const fietsIds = new Set(veld.filter(n => n.f).map(n => n.id));
  const pad2 = lijn(-90, -1, 30, 2).concat(lijn(0, 120, 38, 2)).concat(lijn(130, 330, 43, 2));
  const fl2 = { nodes: veld, start: S1, punten: pad2 };
  const met2 = await rit(fl2), uit2 = await rit({ ...fl2, uit: true }), geen2 = await rit({ ...fl2, lijst: null });
  const k2 = keten(met2), k2u = keten(uit2);
  eis('FL2a zonder filter (schakelaar uit) wisselt de app na S1 naar het fietslicht F1, zoals in het veldgeval',
      !fouten(uit2) && k2u.indexOf(S1) >= 0 && k2u[k2u.indexOf(S1) + 1] === F1, 'S1 -> F1', fouten(uit2) || k2u.join(' > '));
  eis('FL2b met het filter komt geen enkel fietslicht in beeld, en na S1 komt geen fietslicht',
      !fouten(met2) && met2.rij.every(x => !fietsIds.has(x.app)) && k2[k2.indexOf(S1) + 1] !== undefined && !fietsIds.has(k2[k2.indexOf(S1) + 1]),
      'geen fietslicht', fouten(met2) || k2.join(' > '));
  const losY = (r) => { const i = r.rij.findIndex((x, j) => j > 0 && r.rij[j - 1].app === S1 && x.app !== S1); return i < 0 ? null : r.rij[i].y; };
  eis('FL2c even veel wissels; waar zonder filter een fietslicht stond, staat nu een autolicht, en verder is de keten gelijk',
      k2.length === k2u.length && k2.every((id, i) => fietsIds.has(k2u[i]) ? !fietsIds.has(id) : id === k2u[i]),
      'zelfde lengte, fiets -> auto', 'met: ' + k2.join(' > ') + ' | zonder: ' + k2u.join(' > ') + ' | S1 los op y=' + losY(met2) + ' (zonder filter y=' + losY(uit2) + ')');
  eis('FL2d zonder lijst (fail-open) is elke GPS-tik gelijk aan de rit met de schakelaar uit',
      !fouten(geen2) && verschil(geen2, uit2) === 0 && verschil(geen2, uit2, 'puur') === 0 && verschil(geen2, uit2, 'regel') === 0, '0 verschillen',
      fouten(geen2) || verschil(geen2, uit2) + ' / ' + verschil(geen2, uit2, 'puur') + ' / ' + verschil(geen2, uit2, 'regel'));
  const wl2 = met2.wissel.filter(w => w.van === S1);
  eis('FL2e de wissellog met filter: S1 gaat naar een autolicht', wl2.length >= 1 && !fietsIds.has(wl2[0].naar), 'naar een autolicht',
      met2.wissel.map(w => `${w.van}>${w.naar} ${w.r}`).join(' ; '));

  // ═══ FL3 — de enige kandidaat ═════════════════════════════
  // Alleen fiets- en voetgangerslichten binnen 400 m (het volgende autolicht ligt op 700 m).
  const fl3 = { nodes: [{ id: 9800101, x: 3, y: 60, f: 1 }, { id: 9800102, x: -6, y: 90, f: 1 }, { id: 9800103, x: 0, y: 700, f: 0 }], punten: lijn(0, 150, 30).concat([{ x: 0, y: 150, kmh: 0 }, { x: 0, y: 150, kmh: 0 }]) };
  const met3 = await rit(fl3), uit3 = await rit({ ...fl3, uit: true });
  eis('FL3a alleen fietslichten binnen 400 m: per GPS-tik precies dezelfde keuze als zonder filter (en er wordt wel een licht getoond)',
      !fouten(met3) && verschil(met3, uit3) === 0 && met3.rij.some(x => x.app === 9800101), '0 verschillen, fietslicht getoond',
      fouten(met3) || verschil(met3, uit3) + ' verschillen; ' + keten(met3).join(' > '));
  eis('FL3b ook het puur dichtstbijzijnde licht en de schaduwregel zijn per tik gelijk',
      verschil(met3, uit3, 'puur') === 0 && verschil(met3, uit3, 'regel') === 0, '0 / 0', verschil(met3, uit3, 'puur') + ' / ' + verschil(met3, uit3, 'regel'));

  // ═══ FL4 — het veldgeval ════════════════════════════
  // Op 60 m voor de stopplek: het autolicht C op 18 m, de fietslichten F2 en F op 23 en 24 m. Younes tikte F (dat was
  // daar het goede licht). De auto stopt hier en blijft staan.
  const C = 9800201, F2 = 9800202, F = 9800203;
  const fl4nodes = [{ id: C, x: 3.7, y: 17.6, f: 0 }, { id: F2, x: 7.4, y: 22, f: 1 }, { id: F, x: -7.9, y: 22.8, f: 1 },
                    { id: 9800204, x: 11.7, y: 103.6, f: 0 }, { id: 9800205, x: 24.4, y: 107.4, f: 1 }, { id: 9800206, x: 2.4, y: 134.3, f: 0 }];
  const stil = (n) => Array.from({ length: n }, () => ({ x: 0, y: 0, kmh: 0 }));
  const aan4 = lijn(-80, -20, 30).concat([{ x: 0, y: -12, kmh: 20 }, { x: 0, y: -6, kmh: 12 }, { x: 0, y: -2, kmh: 5 }]).concat(stil(4));
  const fl4 = { nodes: fl4nodes, punten: aan4 };
  const met4 = await rit(fl4), uit4 = await rit({ ...fl4, uit: true });
  eis('FL4a de nadering: de app kiest zelf het autolicht C, met en zonder filter; per GPS-tik gelijk',
      !fouten(met4) && verschil(met4, uit4) === 0 && met4.rij[met4.rij.length - 1].app === C, '0 verschillen, C',
      fouten(met4) || verschil(met4, uit4) + ' verschillen; ' + keten(met4).join(' > ') + ' / zonder: ' + keten(uit4).join(' > '));
  // Na de tik: vier tikken stil (met slot), dan vervalt het slot en rijdt de auto stapvoets verder (6 km/u, geen
  // stilstandslot): dan kiest vindDichtbij weer, met F als getoond licht.
  const kruip = [1.7, 3.3, 5, 6.7].map(y => ({ x: 0, y, kmh: 6 }));
  const tik4 = aan4.concat([{ x: 0, y: 0, kmh: 0, tik: F }]).concat(stil(4)).concat([{ x: 0, y: 0.5, kmh: 6, los: true }]).concat(kruip);
  const t4 = await rit({ ...fl4, punten: tik4 }), t4u = await rit({ ...fl4, punten: tik4, uit: true });
  const naTik = t4.rij.slice(aan4.length), naLos = t4.rij.slice(aan4.length + 5);
  const toon = (r) => r.map(x => x.app + (x.slot ? '🔒' : '')).join(' ');
  eis('FL4b een lijstkeuze (tik) op het fietslicht F werkt met het filter aan: F wordt getoond, met slot, zolang het slot staat',
      !fouten(t4) && naTik.slice(0, 5).every(x => x.app === F && x.slot === 1), 'F🔒 x5', fouten(t4) || toon(naTik));
  eis('FL4c na de tik verandert het filter niets: per GPS-tik gelijk aan de rit zonder filter, ook nadat het slot vervalt en de auto weer rijdt',
      !fouten(t4u) && verschil(t4, t4u) === 0 && naLos.length === 5 && naLos.every(x => x.slot === 0),
      '0 verschillen, zonder slot', verschil(t4, t4u) + ' verschillen; met: ' + toon(naTik) + ' | zonder: ' + toon(t4u.rij.slice(aan4.length)));
  eis('FL4d direct na het vervallen van het slot staat F er nog (het getoonde licht doet mee; het filter haalt het niet weg)',
      naLos[0] && naLos[0].app === F, 'F', toon(naLos));

  // ═══ FL5 — het puur dichtstbijzijnde licht ═════════════════
  const fl5 = { nodes: [{ id: 9800301, x: 3, y: 8, f: 1 }, { id: 9800302, x: -4, y: 25, f: 0 }], punten: lijn(-30, 0, 20).concat(stil(3)) };
  const met5 = await rit(fl5), uit5 = await rit({ ...fl5, uit: true });
  const l5 = met5.rij[met5.rij.length - 1], l5u = uit5.rij[uit5.rij.length - 1];
  eis('FL5a stilstaand, fietslicht op 9 m, autolicht op 25 m: het puur dichtstbijzijnde licht is het autolicht (zonder filter: het fietslicht)',
      !fouten(met5) && l5.puur === 9800302 && l5u.puur === 9800301, '9800302 / 9800301', fouten(met5) || l5.puur + ' / ' + l5u.puur);
  const fl5b = { nodes: [{ id: 9800301, x: 3, y: 8, f: 1 }, { id: 9800302, x: -4, y: 450, f: 0 }], punten: lijn(-30, 0, 20).concat(stil(3)) };
  const met5b = await rit(fl5b);
  eis('FL5b ligt het autolicht verder dan 400 m, dan blijft het fietslicht het puur dichtstbijzijnde (nooit als enige kandidaat)',
      !fouten(met5b) && met5b.rij[met5b.rij.length - 1].puur === 9800301, '9800301', fouten(met5b) || String(met5b.rij[met5b.rij.length - 1].puur));
  eis('FL5c fietsPuurDichtst geeft het licht terug dat hij kreeg als dat geen fietslicht is (geen tweede rondgang)',
      /if \(!p \|\| !fietsSluitUit\(p\)\) return p;/.test(String(fietsPuurDichtst)), 'eerste regel', 'ok');

  // ═══ FL6 — de schaduwregel ════════════════════════════════
  {
    const bewaar = { osmCache, regelStaat, fietsLichten };
    try {
      const LAT0 = 52.0000, LON0 = 5.0000, mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
      const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
      const kies = (nodes, lijst) => { osmCache = nodes.map(n => ({ id: n.id, ...LL(n.x, n.y) })); fietsLichten = lijst; regelReset(); const p = LL(0, 0); return regelKies(p.lat, p.lon, 0); };
      const n6 = [{ id: 9800401, x: 2, y: 30 }, { id: 9800402, x: -2, y: 55 }];
      const a = kies(n6, new Set(['9800401'])), b = kies(n6, null), c = kies([{ id: 9800401, x: 2, y: 30 }], new Set(['9800401']));
      eis('FL6 de schaduwregel slaat het fietslicht over (30 m) en kiest het autolicht (55 m); zonder lijst het fietslicht; is het de enige, dan het fietslicht',
          a === '9800402' && b === '9800401' && c === '9800401', '9800402 / 9800401 / 9800401', [a, b, c].join(' / '));
    } finally { osmCache = bewaar.osmCache; regelStaat = bewaar.regelStaat; fietsLichten = bewaar.fietsLichten; }
  }

  // ═══ FL7 — de lijst ophalen ═══════════════════════════════
  const K = { lat: 52.0011, lon: 5.0008 };
  const ids7 = Array.from({ length: 346 }, (_, i) => 3300000000 + i * 7919);
  const goed = { status: 200, json: { elements: ids7.map(id => ({ type: 'node', id })) } };
  const h1 = await inFrame('fietsHaalBinnen', { kaart: K, antwoorden: [goed] });
  const vraag = h1.vragen[0] || { body: '', url: '' };
  eis('FL7a de vraag: naar dezelfde Overpass als de kaart, met dezelfde plek en straal, en zonder één licht- of routenummer',
      h1.vragen.length === 1 && vraag.url === OVERPASS_URL && vraag.body.includes(`(around:${OSM_RADIUS},${K.lat},${K.lon})`)
        && !/\b\d{6,}\b/.test(vraag.body.replace(`${K.lat}`, '').replace(`${K.lon}`, '')) && /\.alleen out ids;$/.test(vraag.body),
      'één vraag, plek + straal, geen nummers', h1.fout || (h1.vragen.length + ' vraag: ' + vraag.body.slice(0, 160)));
  // V11.37.12: bewaard als één gebied in { v: 2, gebieden } (tot vier gebieden, test_overpass OV7).
  const g1 = h1.opslag && h1.opslag.v === 2 && Array.isArray(h1.opslag.gebieden) ? h1.opslag.gebieden[0] : null;
  eis('FL7b het antwoord wordt bewaard (sl_fietslichten) en meteen gebruikt; de logregel zegt ok n=346',
      !!g1 && h1.opslag.gebieden.length === 1 && g1.ids.length === 346 && g1.lat === K.lat && g1.r === OSM_RADIUS && h1.na && h1.na.length === 346
        && h1.log.length === 1 && h1.log[0] === 'ok n=346 p=0', 'bewaard, 346, ok', h1.fout || ((g1 ? g1.ids.length : 'geen') + ' / ' + h1.log.join(' | ')));
  const kb = h1.ruw ? h1.ruw.length : 0;
  eis('FL7c de grootte voor 346 lichten (zoals gebied G1): onder de 5 KB tekst (in de app-telling, 2 bytes per teken: onder de 10 KB)',
      kb > 3000 && kb < 5000, '3-5 KB', (kb / 1000).toFixed(1) + ' KB tekst');
  const h2 = await inFrame('fietsHaalBinnen', { kaart: K, antwoorden: [{ status: 200, json: { remark: 'runtime error: Query timed out', elements: [{ type: 'node', id: 3300000000 }] } }, goed], wachtVragen: 2 });
  eis('FL7d een half antwoord (status 200 met een remark) wordt niet bewaard; de volgende poging wel',
      h2.vragen.length === 2 && /^fout remark w=\d+ p=0$/.test(h2.log[0]) && h2.log[1] === 'ok n=346 p=1' && h2.opslag && h2.opslag.gebieden[0].ids.length === 346,   // V11.37.12: w = de wachttijd in s
      'fout remark, dan ok', h2.fout || h2.log.join(' | '));
  // V11.37.12: vijf pogingen per gebied per dag (na 5 s, 1, 5, 15 en 60 min; de wachttijden zijn hier ingekort).
  const h3 = await inFrame('fietsHaalBinnen', { kaart: K, antwoorden: [{ status: 504, json: null }], wachtVragen: 5 });
  eis('FL7e steeds 504: vijf pogingen en dan stoppen; niets bewaard, geen lijst (alles werkt zoals voorheen)',
      h3.vragen.length === 5 && h3.log.length === 5 && h3.log.slice(0, 4).every((l, i) => new RegExp('^fout http 504 w=\\d+ p=' + i + '$').test(l)) && h3.log[4] === 'fout http 504 p=4'
        && h3.opslag === null && h3.na === null,
      '5 pogingen, geen lijst', h3.fout || (h3.vragen.length + ': ' + h3.log.join(',')));
  const vers = { v: 1, t: 1790000000000, lat: K.lat, lon: K.lon, r: OSM_RADIUS, ids: [11, 12, 13] };
  const nuT = Date.now();
  const h4 = await inFrame('fietsHaalBinnen', { kaart: K, opslag: { ...vers, t: nuT - 86400000 }, antwoorden: [goed] });
  eis('FL7f een bewaarde lijst van gisteren, hier: meteen gebruikt, geen nieuwe vraag',
      h4.meteen === 3 && h4.vragen.length === 0, '3 lichten, 0 vragen', h4.fout || (h4.meteen + ' lichten, ' + h4.vragen.length + ' vragen'));
  // V11.37.12: een gebied dekt tot 4,6 km (FIETS_ZELFDE_M), dus nu 5 km verder; het oude gebied blijft erbij (tot vier).
  const h5 = await inFrame('fietsHaalBinnen', { kaart: { lat: K.lat + 0.045, lon: K.lon }, opslag: { ...vers, t: nuT - 86400000 }, antwoorden: [goed] });
  const h6 = await inFrame('fietsHaalBinnen', { kaart: K, opslag: { ...vers, t: nuT - 31 * 86400000 }, antwoorden: [goed] });
  eis('FL7g 5 km verder: de oude lijst geldt meteen, er komt één nieuwe vraag en beide gebieden tellen (3 + 346); 31 dagen oud: één vraag die hem vervangt',
      h5.meteen === 3 && h5.vragen.length === 1 && h5.na.length === 349 && h6.meteen === 3 && h6.vragen.length === 1 && h6.na.length === 346,
      '3, 1 vraag, 349; 3, 1 vraag, 346', [h5.meteen, h5.vragen.length, h5.na && h5.na.length, h6.meteen, h6.vragen.length, h6.na && h6.na.length].join(',')
        + ' | ' + h5.vragen.map(v => v.body.slice(60, 120)).join(' ; '));
  const h7 = await inFrame('fietsHaalBinnen', { kaart: K, opslag: { v: 2, ids: 'kapot' }, antwoorden: [{ status: 504, json: null }], wachtVragen: 3 });
  eis('FL7h een kapotte bewaarde lijst wordt genegeerd (geen lijst, niets uitgesloten)', h7.meteen === null && h7.na === null, 'geen lijst', String(h7.meteen) + ' / ' + String(h7.na));

  // ═══ FL8 — KLOPTE/BIJNA/FOUT na een wissel ════════════════
  const bv = (opt) => inFrame('fietsBevestigBinnen', opt);
  const b1 = await bv({ pad: 'wissel', normaalEerst: true, drukken: [{ cat: 'klopte', na: 4000 }] });
  const r1 = b1.recA[b1.recA.length - 1] || {};
  eis('FL8a na een wissel (A -> B) blijven de knoppen staan, bevroren voor A',
      !b1.fout && b1.naWissel.getoond === b1.B && b1.naWissel.knoppen && !b1.naWissel.actief && b1.naWissel.vries === String(b1.A),
      'B getoond, knoppen, bevroren A', b1.fout || JSON.stringify(b1.naWissel));
  eis('FL8b KLOPTE 4 s na de wissel komt bij A (met nw 4 s en naar B), niet bij B; de knoppen gaan weg',
      b1.recA.length === 1 && r1.categorie === 'klopte' && r1.nw === 4 && r1.naar === String(b1.B) && r1.toestand === 'groen-na-nul' && b1.recB.length === 0 && !b1.stappen[0].knoppen,
      'A: klopte, nw 4, naar B; B: niets', JSON.stringify({ a: b1.recA.map(r => r.categorie + ' nw ' + r.nw + ' naar ' + r.naar + ' ' + r.toestand), b: b1.recB.length, knoppen: b1.stappen[0] && b1.stappen[0].knoppen }));
  const velden = (r) => Object.keys(r || {}).sort().join(',');
  eis('FL8c het record heeft dezelfde velden als een gewone druk, plus nw en naar',
      b1.normaal && velden(r1) === velden({ ...b1.normaal, nw: 0, naar: 0 }), 'gelijk + nw, naar', velden(r1) + ' | ' + velden(b1.normaal));
  eis('FL8d het leren gaat naar A, met de band van A (60/75), en daarna staan de waarden van B er weer',
      b1.leer.length === 1 && b1.leer[0].id === String(b1.A) && b1.leer[0].cat === 'klopte' && b1.leer[0].doel === 60 && b1.leer[0].max === 75
        && b1.stappen[0].doel === b1.naWissel.doel && b1.stappen[0].max === b1.naWissel.max,
      'A, 60/75, terug', JSON.stringify({ leer: b1.leer, na: [b1.stappen[0] && b1.stappen[0].doel, b1.stappen[0] && b1.stappen[0].max], wissel: [b1.naWissel.doel, b1.naWissel.max] }));
  const lg1 = b1.log.filter(r => r.reden === 'bevestig_na_wissel');
  eis('FL8e de druk staat in de log met het oude en het nieuwe licht: bevestig_na_wissel A -> B, klopte, opgeslagen, 4000 ms (en bevestig_bevroren)',
      lg1.length === 1 && lg1[0].node === String(b1.A) && lg1[0].nieuw === String(b1.B) && lg1[0].el === 'klopte' && lg1[0].uit === 'opgeslagen' && lg1[0].dur === 4000
        && b1.log.some(r => r.reden === 'bevestig_bevroren' && r.node === String(b1.A) && r.nieuw === String(b1.B) && r.el === 'wissel'),
      'na_wissel A>B klopte opgeslagen 4000', JSON.stringify(b1.log));
  const b2 = await bv({ pad: 'wissel', drukken: [{ cat: 'fout', na: 16000 }] });
  eis('FL8f na 15 s telt een druk niet meer: niets bij A, niets bij B, logregel te_laat',
      !b2.fout && b2.recA.length === 0 && b2.recB.length === 0 && b2.log.some(r => r.reden === 'bevestig_na_wissel' && r.uit === 'te_laat'),
      'niets, te_laat', b2.fout || JSON.stringify(b2.log));
  const b3 = await bv({ pad: 'wissel', drukken: [{ cat: 'fout', na: 3000, eigen: true }] });
  eis('FL8g heeft B al eigen knoppen, dan is de druk voor B (gewoon pad), en de log zegt nieuw_licht',
      !b3.fout && b3.recA.length === 0 && b3.recB.length === 1 && b3.log.some(r => r.reden === 'bevestig_na_wissel' && r.uit === 'nieuw_licht' && r.node === String(b3.A) && r.nieuw === String(b3.B)),
      'B, nieuw_licht', b3.fout || JSON.stringify({ a: b3.recA.length, b: b3.recB.length, log: b3.log }));
  const b4 = await bv({ pad: 'geen', drukken: [{ cat: 'fout', na: 2000 }, { cat: 'bijna', na: 9000 }] });
  eis('FL8h bij geen licht: de knoppen blijven, FOUT gaat naar A met naar = geen, en een tweede druk daarna komt niet meer bij A (stil maar gelogd: bevestig_geen_licht)',
      !b4.fout && b4.naWissel.getoond === null && b4.naWissel.knoppen && b4.recA.length === 1 && b4.recA[0].naar === 'geen'
        && b4.log.some(r => r.reden === 'bevestig_na_wissel' && r.nieuw === 'geen' && r.uit === 'opgeslagen')
        && b4.log.some(r => r.reden === 'bevestig_geen_licht' && r.el === 'bijna'),
      'A met naar geen; daarna bevestig_geen_licht', b4.fout || JSON.stringify({ a: b4.recA.map(r => r.categorie + ' ' + r.naar), log: b4.log.map(r => r.reden + ' ' + (r.uit || r.el)) }));
  const b5 = await bv({ pad: 'correctie', drukken: [{ cat: 'fout', na: 1000 }] });
  const b6 = await bv({ pad: 'lijst', drukken: [{ cat: 'fout', na: 1000 }] });
  eis('FL8i ook na een automatische correctie en na een lijstkeuze gaat de druk naar A (was: weg, of bevestig_node_gewisseld)',
      !b5.fout && !b6.fout && b5.recA.length === 1 && b5.recB.length === 0 && b6.recA.length === 1 && b6.recB.length === 0
        && !b6.log.some(r => r.reden === 'bevestig_node_gewisseld'),
      'A, A', JSON.stringify({ corr: [b5.recA.length, b5.recB.length], lijst: [b6.recA.length, b6.recB.length], log6: b6.log.map(r => r.reden) }));
  const b7 = await bv({ pad: 'wissel', mom: 'zandloper', aiK: 'rood', drukken: [{ cat: 'klopte', na: 1000 }, { cat: 'fout', na: 3000 }] });
  eis('FL8j dezelfde poorten als altijd, op het bevroren moment: KLOPTE in de zandloper telt niet (inert, knoppen blijven), FOUT daarna wel',
      !b7.fout && b7.recA.length === 1 && b7.recA[0].categorie === 'fout' && b7.stappen[0].knoppen
        && b7.log.some(r => r.reden === 'bevestig_na_wissel' && r.el === 'klopte' && r.uit === 'inert'),
      'inert, dan fout bij A', b7.fout || JSON.stringify({ a: b7.recA.map(r => r.categorie), log: b7.log.map(r => r.reden + ' ' + r.el + ' ' + r.uit) }));
  const b8 = await bv({ pad: 'wissel', drukken: [{ cat: 'fout', na: 1000 }, { cat: 'fout', na: 1500 }] });
  eis('FL8k een dubbele tik (0,5 s later): de tweede komt niet bij A en ook niet bij B, logregel dubbel',
      !b8.fout && b8.recA.length === 1 && b8.recB.length === 0 && b8.log.some(r => r.reden === 'bevestig_na_wissel' && r.uit === 'dubbel'),
      'A 1, B 0, dubbel', b8.fout || JSON.stringify({ a: b8.recA.length, b: b8.recB.length, log: b8.log.map(r => r.reden + ' ' + r.uit) }));

  // ═══ FL9 — de wissellog: tMin en pN ═══════════════════════
  const fl9 = { nodes: [{ id: 9800501, x: 3, y: 60, f: 0 }, { id: 9800502, x: -1, y: 300, f: 0 }], start: 9800501, punten: lijn(0, 160, 36) };
  const r9 = await rit(fl9);
  const w9 = r9.wissel.find(w => w.van === 9800501 && w.naar === 9800502);
  eis('FL9a bij de wissel A -> B: tMin = seconden tussen het dichtstbijzijnde punt van A en de wissel (1-5 s), pN = B recht vooruit (|pN| <= 5)',
      !fouten(r9) && w9 && typeof w9.tMin === 'number' && w9.tMin >= 1 && w9.tMin <= 5 && typeof w9.pN === 'number' && Math.abs(w9.pN) <= 5 && w9.min <= 4,
      'tMin 1-5, pN ~0, min <= 4', fouten(r9) || JSON.stringify(w9 || r9.wissel));
  const w9g = r9.wissel.find(w => w.naar === 0);
  eis('FL9b naar geen licht heeft geen pN', !w9g || w9g.pN === undefined, 'geen pN', JSON.stringify(w9g || 'geen wissel naar 0'));

  // ═══ FL10 — de ©-regel ════════════════════════════════════
  {
    const f = document.getElementById('footer-copyright'), balk = document.getElementById('bodem-balk'), knop = document.getElementById('dashboard-knop'), dbg = document.getElementById('debug');
    const s = f ? getComputedStyle(f) : null;
    eis('FL10a de footer: dezelfde tekst, laag 41 boven de balk (40), duidelijker (0,4)',
        !!f && f.textContent.trim() === '© 2026 StoplichtIQ — Y. Lemaalem' && Number(s.zIndex) > Number(getComputedStyle(balk).zIndex) && /0\.4\)/.test(s.color) && s.pointerEvents === 'none',
        'tekst, 41 > 40, 0.4, klikt niet', f ? [f.textContent.trim(), s.zIndex, getComputedStyle(balk).zIndex, s.color, s.pointerEvents].join(' | ') : 'geen footer');
    if (f) {
      const r = document.createRange(); r.selectNodeContents(f); const t = r.getBoundingClientRect();
      const k = knop.getBoundingClientRect(), d = dbg.getBoundingClientRect();
      const raakt = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      // In de testronde staat de app achter het startscherm; de maten van de balk gelden toch. Naast de echte breedte
      // ook gerekend op een iPhone (390 px): de tekst staat in het midden van 0..(390 - right), de knop begint op
      // 390 - 10 (rand van de balk) - zijn breedte.
      const W = 390, tr = (W - parseFloat(s.right)) / 2 + t.width / 2, kl = W - 10 - k.width;
      eis('FL10b de tekst bedekt de dashboardknop niet (hier en op 390 px breed) en staat onder de debugregel',
          t.width > 0 && !raakt(t, k) && t.top >= d.bottom - 0.5 && tr <= kl,
          'vrij', `tekst ${Math.round(t.left)}-${Math.round(t.right)} x ${Math.round(t.top)}-${Math.round(t.bottom)}, knop vanaf ${Math.round(k.left)}, debug tot ${Math.round(d.bottom)}; op 390 px: tekst tot ${Math.round(tr)}, knop vanaf ${Math.round(kl)}`);
    }
  }

  // ═══ FL11 — regressie ══════════════════════════════════════
  const zonderV113718 = (s) => String(s).replace('const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud', 'const d = await r.json();').split('\n').filter(l => !/V11\.37\.18(?!\d)/.test(l)).join('\n');   // V11.37.18: de bewaarde kaart, C5 en C7 (test_kaartbewaar); hier terug
  const zonderV113717 = (s) => zonderV113718(s).split('\n').filter(l => !/V11\.37\.17(?!\d)/.test(l)).join('\n');   // V11.37.17: de startlog (test_startlog); hier terug
  const zonderV113715 = (s) => zonderV113717(s).split('\n').filter(l => !/V11\.37\.15(?!\d)/.test(l)).join('\n');   // V11.37.15: de koersmeting (test_koerslog); hier terug
  const zonderV113713 = (s) => zonderV113715(s).split('\n').filter(l => !/V11\.37\.13(?!\d)/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12(?!\d)/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11(?!\d)/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const terug = (s) => zonderV113711(s)
    .replace("      if (wisselStaat.min === null || af < wisselStaat.min) { wisselStaat.min = af; wisselStaat.minT = Date.now(); }   // V11.37.8: en wanneer (tMin)", "      if (wisselStaat.min === null || af < wisselStaat.min) wisselStaat.min = af;")
    .replace("  if (!dichtstbijOSM) { logOpslagMis('bevestig_geen_licht', { element: categorie }); return; }   // V11.37.8: niet meer stil", "  if (!dichtstbijOSM) return;")
    .split(NL).filter(l => !/V11\.37\.8(?!\d)/.test(l)).join(NL);
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.8(?!\d)/.test(l)).length;
  const V11377 = { vindDichtbij: ['55d1f775', 3320, 3], updateDichtbij: ['42aee748', 12051, 3], regelKies: ['d8d1f767', 1993, 3], wisselLogNoteer: ['c0611735', 1672, 2],
    wisselNa: ['3f24e1b0', 2527, 1], bevestigCountdown: ['3bfe5b10', 15882, 2], geenLichtZetten: ['b480c850', 1591, 2], corrigeerNodeAutomatisch: ['afe7b427', 4118, 2],
    selecteerNodeHandmatig: ['5275f4dd', 2379, 1], resetNeutraal: ['32f7f3fd', 3510, 1], downloadOSM: ['4711f7f3', 4043, 1] };
  const telAf = Object.entries(V11377).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('FL11a elf functies veranderen, alleen met regels met merkteken V11.37.8 (drie in vindDichtbij, updateDichtbij en regelKies; twee of één in de rest)',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V11377).filter(([n, [h, l]]) => { const s = terug(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('FL11b met die regels terug (twee waren een andere regel, de rest is nieuw) zijn ze byte-gelijk aan V11.37.7',
      anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const ONGEWIJZIGD = { onGPS: ['d99821b8', 15000], vindDichtbijScore: ['bc9b7937', 2105], achterTik: ['e9e105a3', 1583], achterSluitUit: ['6b7a87d8', 383],
    checkHandLockVerval: ['2df4f7ed', 5513], checkHandLockPassage: ['7f001264', 1768], checkNodeCorrectieStilstand: ['8c801fd8', 4751], checkTikSlotSnel: ['d3a8edbe', 2071],
    verzamelNaderingsBewijs: ['3d6ad85f', 3526], checkNaderingsCorrectie: ['6aeb87b3', 3595], regelTik: ['9c1b361b', 3087], vergrendelNodeHandmatig: ['9a007b96', 2295],
    tikRichting: ['b44110d5', 4619], isGetoondLicht: ['36a3cc63', 126], tickCd: ['b9fe419c', 25016], verwerkBevestigLeren: ['9163848', 8583],
    meetBevestigMoment: ['1174330f', 4946], updateBevestigKnopStaat: ['d82919e1', 1359], bevestigMarkerSleutel: ['d404cc32', 157], wisselVoor: ['b58f23a8', 937],
    koppelBboxAanNode: ['bb6c053d', 1563], vindOsmMatchOpRichting: ['51d96aa', 661] };
  const anders2 = Object.entries(ONGEWIJZIGD).filter(([n, [h, l]]) => { const s = zonderV113711(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('FL11c tweeëntwintig functies die V11.37.8 niet raakt (onGPS, de puntentelling, de loslaatroutes, de correcties, de tik, tickCd, het leren, de knopstaat, het koppelen aan een lamp): byte-gelijk aan V11.37.7',
      anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  herstel();
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') {
  window.testFietslicht = testFietslicht; window.fietsRitBinnen = fietsRitBinnen;
  window.fietsBevestigBinnen = fietsBevestigBinnen; window.fietsHaalBinnen = fietsHaalBinnen;
}
