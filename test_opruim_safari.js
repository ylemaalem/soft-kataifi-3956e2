// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_opruim_safari.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.10: de opruimrem telt zoals Safari (ontwerp van 4 okt).
//
//  OS1  de constanten: grens 85% van 5 MiB (4.352 KiB), marge, de schakelaar
//       van migratieSlPos, en de ring van S2
//  OS2  opruimNodig: boven de grens ja; ver eronder nee zonder exacte telling;
//       in de marge de exacte telling (met brede tekens)
//  OS3  checkLocalStorageRuimte op de echte opslag: 4,01 MiB in UTF-16 (2,1
//       miljoen tekens) laat de rem NIET meer vuren; boven de grens wel; een
//       breed teken telt dubbel, zoals in Safari
//  OS4  migratieSlPos schrijft geen kopieën meer
//  OS5  opruimPosV2: de kopieën één keer weg, eigen posities blijven, vlag,
//       logregel; een tweede keer niets
//  OS6  S2: één record per passage van 30 s, en een ring van 5
//  OS7  het dashboard toont de opslag zoals Safari telt
//  OS8  regressie: welke functies veranderen, en dat de rest byte-gelijk is
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_opruim_safari.js';
//      document.head.appendChild(s);
//      s.onload = () => testOpruimSafari().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testOpruimSafari() {
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
      opslagHersynchroniseer(Object.keys(snap).concat(nu));
    } catch (e) {}
  };
  const bewaard = { opruimGrens: window.opruimGrens, berekenSafariOpslag: window.berekenSafariOpslag, now: Date.now, osmCache, opruimGelogdDezeSessie };
  const grofNu = () => { let g = 0; for (const k of opslagSleutels('')) g += k.length + (opslagLeesRuw(k) || '').length; return g; };
  const zet = (k, v) => { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); opslagHersynchroniseer([k]); };
  const weg = (k) => { localStorage.removeItem(k); opslagHersynchroniseer([k]); };
  const GETUIGE = 'sl_pos_9940001';
  const getuige = () => zet(GETUIGE, { lat: 52.1, lon: 5.3, bron: 'osm', tijd: 1 });
  const staat = () => localStorage.getItem(GETUIGE) !== null;
  const log = () => { try { return JSON.parse(localStorage.getItem('sl_opslaglog')) || []; } catch (e) { return []; } };

  try {
    // ═══ OS1 — de constanten ══════════════════════════════════
    eis('OS1 de grens is 85% van de 5 MiB van Safari (4.456.448 bytes = 4.352 KiB), marge 256 KiB; migratieSlPos uit; S2 30 s en 5',
        OPRUIM_GRENS_SAFARI === 4456448 && OPRUIM_GRENS_SAFARI === Math.round(0.85 * SAFARI_QUOTUM_BYTES) && opruimGrens() === OPRUIM_GRENS_SAFARI
          && OPRUIM_MARGE_SAFARI === 262144 && POS_MIGRATIE_AAN === false && S2_PASSAGE_MS === 30000 && S2_RING === 5,
        '4456448 / 262144 / uit / 30000 / 5', [OPRUIM_GRENS_SAFARI, OPRUIM_MARGE_SAFARI, POS_MIGRATIE_AAN, S2_PASSAGE_MS, S2_RING].join(' / '));

    // ═══ OS2 — opruimNodig ════════════════════════════════════
    let geteld = 0, sfKb = 0;
    window.berekenSafariOpslag = () => { geteld++; return { kb: sfKb, pct: 0, n16: 0 }; };
    window.opruimGrens = () => 1000000;
    const a = opruimNodig(1000000), b = geteld;
    const c = opruimNodig(1000000 - 262144 - 1), d = geteld;
    sfKb = 1000000 / 1024 + 1; const e = opruimNodig(900000), f = geteld;
    sfKb = 1000000 / 1024 - 1; const g = opruimNodig(900000), h = geteld;
    window.berekenSafariOpslag = bewaard.berekenSafariOpslag; window.opruimGrens = bewaard.opruimGrens;
    eis('OS2a op de grens: ja, zonder exacte telling', a === true && b === 0, 'ja, 0 tellingen', a + ', ' + b);
    eis('OS2b meer dan de marge eronder: nee, zonder exacte telling', c === false && d === 0, 'nee, 0', c + ', ' + d);
    eis('OS2c in de marge: de exacte telling beslist (erboven ja, eronder nee)', e === true && f === 1 && g === false && h === 2, 'ja, nee, 2 tellingen', [e, g, h].join(', '));

    // ═══ OS3 — de rem op de echte opslag ══════════════════════
    zet('sl_opslaglog', '[]'); weg('sl_opruimstat');
    getuige();
    zet('or_ballast', 'x'.repeat(2100000));   // 4,01 MiB in UTF-16: hier vuurde de oude rem
    opruimGelogdDezeSessie = false;
    checkLocalStorageRuimte();
    eis('OS3a 2,1 miljoen tekens (4,01 MiB in UTF-16, boven de oude grens van 4,0): de rem vuurt NIET meer (de getuige, een sl_pos_-kopie, staat er nog)',
        staat() && localStorage.getItem('sl_opruimstat') === null, 'getuige staat, geen teller', (staat() ? 'staat' : 'WEG') + ', teller ' + (localStorage.getItem('sl_opruimstat') ? 'ja' : 'nee'));
    const G = grofNu();
    window.opruimGrens = () => G - 10;
    checkLocalStorageRuimte();
    const vuurt = !staat();
    getuige();
    window.opruimGrens = () => G + 200000;   // binnen de marge: de exacte telling beslist, en die ligt eronder
    checkLocalStorageRuimte();
    const nietBoven = staat();
    eis('OS3b met een grens net onder de opslag vuurt hij (getuige weg), met een grens erboven niet',
        vuurt && nietBoven, 'vuurt, vuurt niet', (vuurt ? 'vuurt' : 'VUURT NIET') + ', ' + (nietBoven ? 'vuurt niet' : 'VUURT'));
    const st = (() => { try { return JSON.parse(localStorage.getItem('sl_opruimstat')); } catch (x) { return null; } })();
    eis('OS3c de teller zegt hoe Safari telde (kbSafari) naast de oude telling (kbVoor in UTF-16)',
        st && st.vuringen === 1 && typeof st.kbSafari === 'number' && st.kbSafari < st.kbVoor, '1 vuring, kbSafari < kbVoor', st ? `vuringen ${st.vuringen}, kbSafari ${st.kbSafari}, kbVoor ${st.kbVoor}` : 'geen teller');
    // een breed teken: Safari telt de hele waarde dubbel, grof niet
    weg('or_ballast');
    zet('or_breed', '’' + 'y'.repeat(200000));
    const G2 = grofNu();
    window.opruimGrens = () => G2 + 100;   // grof net eronder, binnen de marge; Safari er ruim boven
    getuige();
    checkLocalStorageRuimte();
    eis('OS3d een waarde met een breed teken (’) telt in Safari dubbel: grof net onder de grens, en toch vuurt hij (de exacte telling)',
        !staat(), 'vuurt', staat() ? 'VUURT NIET' : 'vuurt');
    weg('or_breed');
    // de grove telling telt de sleutelnamen mee (zonder exacte telling, die hier niets geeft)
    getuige();
    const G3 = grofNu();
    window.opruimGrens = () => G3;
    window.berekenSafariOpslag = () => null;
    checkLocalStorageRuimte();
    window.berekenSafariOpslag = bewaard.berekenSafariOpslag;
    eis('OS3e de grove telling is naam plus waarde: precies op de grens vuurt hij, ook zonder exacte telling',
        !staat(), 'vuurt', staat() ? 'VUURT NIET' : 'vuurt');
    window.opruimGrens = bewaard.opruimGrens;

    // ═══ OS4 — migratieSlPos ═════════════════════════════════
    const ids = [9940011, 9940012, 9940013];
    for (const id of ids) weg('sl_pos_' + id);
    osmCache = ids.map((id, i) => ({ id, lat: 52 + i / 1000, lon: 5 }));
    migratieSlPos();
    eis('OS4 migratieSlPos schrijft geen kopieën meer (3 lichten zonder sl_pos_, daarna nog steeds 0)',
        ids.every(id => localStorage.getItem('sl_pos_' + id) === null), '0', String(ids.filter(id => localStorage.getItem('sl_pos_' + id) !== null).length));
    osmCache = bewaard.osmCache;

    // ═══ OS5 — opruimPosV2 ═══════════════════════════════════
    weg('sl_posv2'); zet('sl_opslaglog', '[]');
    for (const k of opslagSleutels('sl_pos_')) weg(k);
    for (const id of ids) zet('sl_pos_' + id, { lat: 52, lon: 5, bron: 'osm', tijd: 1 });
    zet('sl_pos_9940020', { lat: 52.001, lon: 5.002 });   // eigen positie (uit slaOp), zonder bron
    opruimPosV2();
    const pv = log().filter(r => r.reden === 'pos_v2');
    eis('OS5a de drie kopieën weg, de eigen positie blijft, vlag gezet, één logregel met posWeg 3 en de opslag voor en na',
        ids.every(id => localStorage.getItem('sl_pos_' + id) === null) && localStorage.getItem('sl_pos_9940020') !== null && localStorage.getItem('sl_posv2') === 'done'
          && pv.length === 1 && pv[0].opruim && pv[0].opruim.posWeg === 3 && typeof pv[0].opruim.kbSafariVoor === 'number' && pv[0].opruim.kbSafariNa <= pv[0].opruim.kbSafariVoor,
        '3 weg, eigen blijft, done, posWeg 3', JSON.stringify(pv.map(r => r.opruim)) + ' / eigen ' + (localStorage.getItem('sl_pos_9940020') ? 'staat' : 'WEG'));
    for (const id of ids) zet('sl_pos_' + id, { lat: 52, lon: 5, bron: 'osm', tijd: 1 });
    opruimPosV2();
    eis('OS5c bij het opstarten van deze pagina is hij al gedraaid (de vlag stond er vóór deze suite)', snap['sl_posv2'] === 'done',
        'done', String(snap['sl_posv2']));
    eis('OS5b een tweede keer doet hij niets (de vlag)', ids.every(id => localStorage.getItem('sl_pos_' + id) !== null) && log().filter(r => r.reden === 'pos_v2').length === 1,
        'kopieën staan, 1 regel', String(log().filter(r => r.reden === 'pos_v2').length));

    // ═══ OS6 — S2 ═══════════════════════════════════════════
    const S2N = 9940030, S2K = 'sl_s2_' + S2N;
    weg(S2K);
    let klok = 1790000000000;
    Date.now = () => klok;
    slaS2Aanwezigheid(S2N, 'rood'); klok += 800; slaS2Aanwezigheid(S2N, 'rood'); klok += 20000; slaS2Aanwezigheid(S2N, 'groen');
    const n1 = (JSON.parse(localStorage.getItem(S2K)) || []).length;
    klok += 10000; slaS2Aanwezigheid(S2N, 'rood');
    const n2 = (JSON.parse(localStorage.getItem(S2K)) || []).length;
    eis('OS6a binnen 30 s na het vorige record: niets erbij (3 aanroepen in 21 s: 1 record); na 31 s wel (2)', n1 === 1 && n2 === 2, '1, 2', n1 + ', ' + n2);
    for (let i = 0; i < 6; i++) { klok += 31000; slaS2Aanwezigheid(S2N, 'rood'); }
    const ring = JSON.parse(localStorage.getItem(S2K)) || [];
    eis('OS6b na 8 passages: de 5 nieuwste', ring.length === 5 && Math.min(...ring.map(r => r.tijd)) === klok - 4 * 31000, '5, de nieuwste', ring.length + ' records');
    Date.now = bewaard.now;
    weg(S2K);

    // ═══ OS7 — het dashboard ═════════════════════════════════
    // Zonder één geleerd kruispunt stopt laadDashboard vóór de opslagregel.
    zet('sl_v4_9940040_' + huidigDDActief(), [{ duur: 60, tijd: Date.now(), richting: 0, obs: 60, gewicht: 1, bron: 's1' }]);
    try { laadDashboard(); } catch (x) {}
    const tekst = (document.getElementById('ds-opslag') || {}).textContent || '';
    const sf = berekenSafariOpslag();
    eis('OS7 het dashboard toont de Safari-telling: "<kb>KB / 5120KB (<pct>%)"',
        !!sf && tekst === `${Math.round(sf.kb)}KB / 5120KB (${Math.round(sf.pct)}%)`, `${sf ? Math.round(sf.kb) : '?'}KB / 5120KB (...)`, tekst);
  } finally {
    window.opruimGrens = bewaard.opruimGrens; window.berekenSafariOpslag = bewaard.berekenSafariOpslag; Date.now = bewaard.now;
    osmCache = bewaard.osmCache; opruimGelogdDezeSessie = bewaard.opruimGelogdDezeSessie;
    herstel();
  }

  // ═══ OS8 — regressie ══════════════════════════════════════
  const terug = (s) => String(s)
    .replace("    for (const key of opslagSleutels('')) { const ruw = opslagLeesRuw(key) || ''; totaal += ruw.length * 2; grof += key.length + ruw.length; }   // V11.37.10: dezelfde lus, twee tellingen", "    for (const key of opslagSleutels('')) totaal += (opslagLeesRuw(key) || '').length * 2;")
    .replace("    if (opruimNodig(grof)) {   // V11.37.10: was totaal/(1024*1024) > 4.0, zie opruimNodig", "    if (totaal/(1024*1024) > 4.0) {")
    .replace("  if (m.length > S2_RING) { m.sort((a,b)=>gew(b.tijd)-gew(a.tijd)); m=m.slice(0,S2_RING); }   // V11.37.10: was MAX_S2_METINGEN (20)", "  if (m.length > MAX_S2_METINGEN) { m.sort((a,b)=>gew(b.tijd)-gew(a.tijd)); m=m.slice(0,MAX_S2_METINGEN); }")
    .replace("  if (opslagEl) { const sf = berekenSafariOpslag(); opslagEl.textContent = sf ? `${Math.round(sf.kb)}KB / 5120KB (${Math.round(sf.pct)}%)` : `${berekenLocalStorageKB()}KB / ~5000KB`; }   // V11.37.10: zoals Safari telt, zie opruimNodig", "  if (opslagEl) opslagEl.textContent = `${berekenLocalStorageKB()}KB / ~5000KB`;")
    .split(NL).filter(l => !/V11\.37\.10(?!\d)/.test(l)).join(NL);
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.10(?!\d)/.test(l)).length;
  const V11379 = { checkLocalStorageRuimte: ['1e4f9875', 707, 3], migratieSlPos: ['cd9d2a68', 333, 1], slaS2Aanwezigheid: ['d3039cc2', 475, 2], laadDashboard: ['e286b7dd', 8693, 1] };
  const telAf = Object.entries(V11379).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('OS8a vier functies veranderen, alleen met regels met merkteken V11.37.10', telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V11379).filter(([n, [h, l]]) => { const s = terug(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('OS8b met die regels terug (vier waren een andere regel, de rest is nieuw) byte-gelijk aan V11.37.9', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const zonderV113718 = (s) => String(s).replace('const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud', 'const d = await r.json();').replace('setTimeout(() => { if (!cacheBezig && huidigePos && kaartNodig(huidigePos.lat, huidigePos.lon)) downloadOSM(huidigePos.lat, huidigePos.lon); }, 30000);   // V11.37.18: alleen zonder lopende vraag en als er nog een kaart nodig is (stond: cacheBezig=false en altijd downloadOSM, ook naast een lopende vraag), zie kaartNodig', 'setTimeout(() => { cacheBezig=false; if(huidigePos)downloadOSM(huidigePos.lat,huidigePos.lon); }, 30000);').split('\n').filter(l => !/V11\.37\.18(?!\d)/.test(l)).join('\n');   // V11.37.18: de bewaarde kaart, C5 en C7 (test_kaartbewaar); hier terug
  const zonderV113717 = (s) => zonderV113718(s).split('\n').filter(l => !/V11\.37\.17(?!\d)/.test(l)).join('\n');   // V11.37.17: de startlog (test_startlog); hier terug
  const zonderV113715 = (s) => zonderV113717(s).split('\n').filter(l => !/V11\.37\.15(?!\d)/.test(l)).join('\n');   // V11.37.15: de koersmeting (test_koerslog); hier terug
  const zonderV113713 = (s) => zonderV113715(s).split('\n').filter(l => !/V11\.37\.13(?!\d)/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12(?!\d)/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11(?!\d)/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const ONGEWIJZIGD = { trimDiagnostiekV1: ['a4df7e2b', 693], voerOpruimPassenUit: ['b5221ec9', 5515], logOpruiming: ['e2c2508', 3108], berekenSafariOpslag: ['f3e8d002', 1245],
    ruimRedundantePosCache: ['ec31b124', 380], berekenLocalStorageKB: ['8fd8ab6c', 193], ruimOpslagNuOp: ['4dbcfffc', 3289], slaOpIntern: ['c284229a', 2342],
    vindDichtbij: ['d444ee3', 3717], vindDichtbijScore: ['bc9b7937', 2105], updateDichtbij: ['7b7fce62', 12303], onGPS: ['d99821b8', 15000], downloadOSM: ['261d2457', 4158],   // V11.37.18: downloadOSM met twee commentaarregels zonder plaatsnaam (was 82a16b3c/4147), zie test_kaartbewaar KB12
    renderRichtingBlok: ['173947bd', 18753], opslagOverzicht: ['5ff742b9', 1762], verwerkS2: ['d60b1d38', 1964], bevestigCountdown: ['8457401d', 16073] };
  const anders2 = Object.entries(ONGEWIJZIGD).filter(([n, [h, l]]) => { const s = zonderV113711(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('OS8c zeventien functies die V11.37.10 niet raakt (de passen, de teller, de Safari-meting, de knop, het leren, de lichtkeuze, de kaart): byte-gelijk aan V11.37.9',
      anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testOpruimSafari = testOpruimSafari;
