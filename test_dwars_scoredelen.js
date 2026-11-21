// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_dwars_scoredelen.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.38.9 (alleen meten): de onderdelen van de score in de dwarslog.
//  Elke dwarslog-regel krijgt ze (getoond licht) en bij een andere schaduwkeuze
//  zs (schaduwlicht) = [z, na, nh, rv, c, bc, lb, p], zonder positie.
//
//  SD1  dwarsScoreDelen: z is gelijk aan vindDichtbijScore (3 decimalen) over een raster
//       van snelheid, koers, afstand, bbox-teller, vorigeDetectie en sl_pos; >400 m null
//  SD2  de onderdelen kloppen: na = 1/(af/100+1), rv 0-180, p = 1 met sl_pos, nulls stilstaand,
//       en z = na*0,5 + nh*0,35 + c*0,15 + bc*0,01 + lb
//  SD3  dwarsTik: begin-regel met ze en zs, eind-regel met alleen ze; rijen van 8; geen positie
//  SD4  puur: dwarsScoreDelen schrijft geen opslag en verandert de s2-teller niet
//  SD5  de bron: de regel staat na het opruimen en vóór meetRingSchrijf; de score zelf is ongewijzigd
//
//  DRAAIEN: zoals de andere toetsen; testDwarsScoreDelen().
// ═══════════════════════════════════════════════════════════════
function testDwarsScoreDelen() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const kort = (x) => { try { return JSON.stringify(x).slice(0, 300); } catch (e) { return String(x); } };
  const A = 9608811, B = 9608812, C = 9608813;
  const P = { lat: 52.0, lon: 5.0 };
  const plek = (n, o) => ({ lat: 52.0 + n / 111320, lon: 5.0 + o / (111320 * Math.cos(52 * Math.PI / 180)) });
  const weg = (hw, graden, id, pl) => {
    const d = 20 / 111320, r = graden * Math.PI / 180, cl = Math.cos(pl.lat * Math.PI / 180);
    const a = { lat: pl.lat - d * Math.cos(r), lon: pl.lon - d * Math.sin(r) / cl };
    const b = { lat: pl.lat + d * Math.cos(r), lon: pl.lon + d * Math.sin(r) / cl };
    return { tags: { highway: hw }, nodes: [1, id, 2], geometry: [a, { lat: pl.lat, lon: pl.lon }, b] };
  };
  const ids = [A, B, C].map(String);
  const bew = { osmCache, dichtstbijOSM, snelheidKmh, tegenKoersTik, tegenKoersTikT, huidigeRichting, handmatigLockActief,
                stilstandAutoLock, handmatigGeselecteerdNodeId, tegenHandId, cacheGeladen, fietsLichten, achterStaat, vorigeDetectie,
                headingBuffer: headingBuffer.slice(), dwarsStaat, log: localStorage.getItem(DWARSLOG_SLEUTEL), uitT: new Map(dwarsUitT),
                teller: ids.map(i => [i, s2BboxTeller.has(i), s2BboxTeller.get(i)]),
                pos: ids.map(i => [i, localStorage.getItem('sl_pos_' + i)]) };
  const dlog = () => { try { return JSON.parse(localStorage.getItem(DWARSLOG_SLEUTEL) || '[]'); } catch (e) { return []; } };
  const zet = (kmh, k) => { snelheidKmh = kmh; tegenKoersTik = k; tegenKoersTikT = Date.now(); huidigeRichting = k == null ? 0 : k; };
  const r3 = (x) => Math.round(x * 1000) / 1000;
  try {
    // SD1
    let n1 = 0, mis1 = [];
    const plekken = [[60, 0], [150, 20], [30, -40], [250, 5], [5, 2], [120, 90]];
    for (const kmh of [0, 3, 20, 40]) for (const hd of [0, 45, 170, 300]) for (const [pn, po] of plekken)
      for (const tel of [0, 2, 9]) for (const vd of [null, { cx: 100, cy: 300 }]) for (const metPos of [false, true]) {
        const pl = plek(pn, po), sl = { id: A, lat: pl.lat, lon: pl.lon };
        snelheidKmh = kmh; vorigeDetectie = vd;
        if (tel) s2BboxTeller.set(String(A), tel); else s2BboxTeller.delete(String(A));
        if (metPos) { const q = plek(pn + 7, po - 3); localStorage.setItem('sl_pos_' + A, JSON.stringify({ lat: q.lat, lon: q.lon })); }
        else localStorage.removeItem('sl_pos_' + A);
        const echt = vindDichtbijScore(P.lat, P.lon, hd, sl), d = dwarsScoreDelen(P.lat, P.lon, hd, sl);
        n1++;
        if (!echt || !d || d[0] !== r3(echt.score) || d.length !== 8) mis1.push({ kmh, hd, pn, po, tel, vd: !!vd, metPos, echt: echt && echt.score, d });
      }
    localStorage.removeItem('sl_pos_' + A);
    const ver = plek(401, 0);
    const okVer = vindDichtbijScore(P.lat, P.lon, 0, { id: A, lat: ver.lat, lon: ver.lon }) === null
      && dwarsScoreDelen(P.lat, P.lon, 0, { id: A, lat: ver.lat, lon: ver.lon }) === null;
    eis('SD1 dwarsScoreDelen z = vindDichtbijScore op ' + n1 + ' gevallen; boven 400 m null', mis1.length === 0 && okVer && n1 === 1152,
      '0 verschillen', kort({ n1, mis: mis1.length, eerste: mis1[0], okVer }));
    // SD2
    snelheidKmh = 40; vorigeDetectie = null; s2BboxTeller.set(String(A), 2);
    const p2 = plek(100, 10), s2 = { id: A, lat: p2.lat, lon: p2.lon };
    const d2 = dwarsScoreDelen(P.lat, P.lon, 0, s2);
    const af2 = afstand(P.lat, P.lon, p2.lat, p2.lon);
    const som = d2[1] * 0.5 + d2[2] * 0.35 + d2[4] * 0.15 + d2[5] * 0.01 + d2[6];
    localStorage.setItem('sl_pos_' + A, JSON.stringify({ lat: p2.lat, lon: p2.lon }));
    const d2p = dwarsScoreDelen(P.lat, P.lon, 0, s2);
    localStorage.removeItem('sl_pos_' + A);
    snelheidKmh = 3; const d2s = dwarsScoreDelen(P.lat, P.lon, 0, s2);
    const ok2 = d2[1] === r3(1 / (af2 / 100 + 1)) && d2[3] >= 0 && d2[3] <= 180 && d2[4] === 0.4 && d2[7] === 0 && d2p[7] === 1
      && Math.abs(som - d2[0]) < 0.004 && d2s[2] === null && d2s[3] === null && d2s[5] === null && d2s[6] === null && d2s[4] === 0.4
      && d2[6] >= 0 && d2[6] <= 0.15 && d2[5] >= 0 && d2[5] <= 1;
    eis('SD2 na, rv, c, p, nulls stilstaand en de som van de delen', ok2, 'zie test', kort({ d2, d2p, d2s, som }));
    // SD3
    s2BboxTeller.delete(String(A)); s2BboxTeller.delete(String(B));
    const pA = plek(60, 0), pB = plek(150, 0);
    const lA = { id: A, lat: pA.lat, lon: pA.lon, dwarsWegen: dwarsWegRichtingen(A, [weg('primary', 90, A, pA)]) };
    const lB = { id: B, lat: pB.lat, lon: pB.lon, dwarsWegen: dwarsWegRichtingen(B, [weg('primary', 0, B, pB)]) };
    osmCache = [lA, lB]; cacheGeladen = true; fietsLichten = null; achterReset();
    handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null; tegenHandId = null;
    headingBuffer.length = 0; headingBuffer.push(0, 0, 0);
    dwarsStaat = { e: null, s: null, vr: null }; dwarsUitT.clear();
    localStorage.setItem(DWARSLOG_SLEUTEL, '[]');
    zet(40, 0);
    dichtstbijOSM = { ...lA, afstand: 60 }; dwarsTik(P.lat, P.lon);
    dichtstbijOSM = { ...lB, afstand: 150 }; dwarsTik(P.lat, P.lon);
    const L = dlog();
    const tekst = JSON.stringify(L);
    const geenPos = !/52\.0|"lat"|"lon"|5\.000/.test(tekst);
    const r0 = L[0] || {}, r1 = L[1] || {};
    const zA = dwarsScoreDelen(P.lat, P.lon, 0, lA), zB = dwarsScoreDelen(P.lat, P.lon, 0, lB);
    const ok3 = L.length === 2 && r0.e === A && r0.s === B && kort(r0.ze) === kort(zA) && kort(r0.zs) === kort(zB)
      && r1.e === B && r1.s === B && kort(r1.ze) === kort(zB) && !('zs' in r1) && r0.ze.length === 8 && geenPos;
    eis('SD3 dwarsTik: begin met ze+zs, einde met alleen ze, rijen van 8, geen positie', ok3, '2 regels', kort(L));
    // SD4
    s2BboxTeller.set(String(C), 1);
    const sleutels = () => Object.keys(localStorage).sort().map(k => k + '=' + (localStorage.getItem(k) || '').length).join('|');
    const voor = sleutels(), st = s2BboxTeller.size, tC = s2BboxTeller.get(String(C));
    let tSchrijf = 0;
    const tZet = s2BboxTeller.set, tWis = s2BboxTeller.delete, tLeeg = s2BboxTeller.clear;
    s2BboxTeller.set = function (...a) { tSchrijf++; return tZet.apply(this, a); };
    s2BboxTeller.delete = function (...a) { tSchrijf++; return tWis.apply(this, a); };
    s2BboxTeller.clear = function (...a) { tSchrijf++; return tLeeg.apply(this, a); };
    try { for (let i = 0; i < 5; i++) { dwarsScoreDelen(P.lat, P.lon, 10, lA); dwarsScoreVelden(P.lat, P.lon, 10, lA, lB, true); } }
    finally { delete s2BboxTeller.set; delete s2BboxTeller.delete; delete s2BboxTeller.clear; }
    eis('SD4 dwarsScoreDelen en dwarsScoreVelden schrijven niets', sleutels() === voor && tSchrijf === 0 && s2BboxTeller.size === st && s2BboxTeller.get(String(C)) === tC,
      'gelijk', kort({ st, tSchrijf }));
    // SD5
    const dt = String(dwarsTik);
    const iDel = dt.indexOf('for (const x of Object.keys(rec))'), iAs = dt.indexOf('Object.assign(rec, dwarsScoreVelden(lat, lon, huidigeRichting, echt, u.s, sId !== eId));'),
          iRing = dt.indexOf('meetRingSchrijf(DWARSLOG_SLEUTEL, DWARSLOG_MAX, rec);');
    const schoon = !/V11\.38\.9(?!\d)|ScoreDelen|ScoreVelden/.test(String(vindDichtbijScore)) && !/V11\.38\.9(?!\d)|ScoreDelen/.test(String(vindDichtbij))
      && !/ScoreDelen|ScoreVelden/.test(String(dwarsSchaduwKies));
    eis('SD5 de regel staat na het opruimen en vóór meetRingSchrijf; vindDichtbij, de score en de schaduwkeuze zonder de delen',
      iDel > 0 && iAs > iDel && iRing > iAs && schoon, 'op zijn plek', kort({ iDel, iAs, iRing, schoon }));
  } catch (e) {
    eis('SD crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    osmCache = bew.osmCache; dichtstbijOSM = bew.dichtstbijOSM; snelheidKmh = bew.snelheidKmh; tegenKoersTik = bew.tegenKoersTik;
    tegenKoersTikT = bew.tegenKoersTikT; huidigeRichting = bew.huidigeRichting; handmatigLockActief = bew.handmatigLockActief;
    stilstandAutoLock = bew.stilstandAutoLock; handmatigGeselecteerdNodeId = bew.handmatigGeselecteerdNodeId; tegenHandId = bew.tegenHandId;
    cacheGeladen = bew.cacheGeladen; fietsLichten = bew.fietsLichten; achterStaat = bew.achterStaat; dwarsStaat = bew.dwarsStaat;
    vorigeDetectie = bew.vorigeDetectie;
    headingBuffer.length = 0; headingBuffer.push(...bew.headingBuffer);
    dwarsUitT.clear(); for (const [k, v] of bew.uitT) dwarsUitT.set(k, v);
    for (const [i, had, v] of bew.teller) { if (had) s2BboxTeller.set(i, v); else s2BboxTeller.delete(i); }
    for (const [i, v] of bew.pos) { try { if (v === null) localStorage.removeItem('sl_pos_' + i); else localStorage.setItem('sl_pos_' + i, v); } catch (e) {} }
    try { if (bew.log === null) localStorage.removeItem(DWARSLOG_SLEUTEL); else localStorage.setItem(DWARSLOG_SLEUTEL, bew.log); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testDwarsScoreDelen = testDwarsScoreDelen;
