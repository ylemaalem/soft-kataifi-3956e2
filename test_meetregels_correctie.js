// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meetregels_correctie.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.34.3: de meetregels uit de STAP 0's over de trage correctie en
//  het 47%-geval, en het veld appVersie in alle acht exports. Alleen meten en
//  labelen; geen keuze verandert.
//
//  MC1  nadering_leeg: waarom het bewijs leeg was bij stilstand (tik, lijst,
//       paar, marge, koers, zelfde; 'nul' en 'nooit'), één regel per episode,
//       alleen waar de route iets had kunnen doen
//  MC2  richting_tik draagt het percentage van de getikte rij (rPct)
//  MC3  v5_vroeg_geschreven draagt het nieuwe percentage van die rij
//  MC4  appVersie in alle acht exports; de bestaande versievelden blijven
//  MC5  ALLEEN METEN: zonder de V11.34.3-regels zijn de elf geraakte functies
//       byte-gelijk aan V11.34.1
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_meetregels_correctie.js';
//      document.head.appendChild(s);
//      s.onload = () => testMeetregelsCorrectie().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testMeetregelsCorrectie() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const zonderMeet = (f) => String(f).split('\n').filter(l => !/V11\.34\.[3-9]/.test(l)).join('\n');

  // De opslag van deze pagina gaat sleutel voor sleutel terug.
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  const namen = ['dichtstbijOSM', 'puurDichtsteNodeCache', 'huidigePos', 'snelheidKmh', 'stilstandSinds', 'naderBewijs',
    'naderLeeg', 'naderLeegSleutel', 'naderLeegTijd', 'handmatigLockActief', 'handmatigGeselecteerdNodeId',
    'handmatigGeselecteerdTimestamp', 'stilstandAutoLock', 'laatsteNodeCorrectieTijd', 'richtingKnoppenNodeId',
    'huidigBevestigdOsmNodeId', 'richtingLockNodeId', 'richtingLockKeuze', 'richtingLockBron', 'richtingTikTijd',
    'richtingTikElement', 'richtingGedruktVoorNode', 'v9PreSelectieAfrij', 'v9AanrijHeading', 'v9AanrijSnelheidHeading',
    'preZet', 'getoondeLaag', 'v9KandidaatZagOvergang', 'osmCache', 'clusterNodes'];
  const bewaard = {}; for (const n of namen) bewaard[n] = eval(n);
  const bewaardNu = Date.now;
  const log = () => { try { return JSON.parse(localStorage.getItem('sl_opslaglog')) || []; } catch (e) { return []; } };
  const regelsVan = (r) => log().filter(x => x.reden === r);

  // Twee lichten 12 m uit elkaar op één lijn: W (getoond) op 22 m, C op 10 m.
  const LAT0 = 52.1, LON0 = 5.1, mLat = 111320, mLon = 111320 * Math.cos(LAT0 * Math.PI / 180);
  const LL = (x, y) => ({ lat: LAT0 + y / mLat, lon: LON0 + x / mLon });
  const W = { id: 9770001, naam: 'MC W', ...LL(0, 22) }, C = { id: 9770002, naam: 'MC C', ...LL(0, 10) };
  const X = { id: 9770003, naam: 'MC X', ...LL(40, 0) };
  const P = LL(0, 0);

  const zetStil = (o) => {
    const opt = o || {};
    osmCache = [W, C, X];
    huidigePos = { lat: P.lat, lon: P.lon };
    dichtstbijOSM = { ...(opt.W || W), afstand: afstand(P.lat, P.lon, (opt.W || W).lat, (opt.W || W).lon) };
    puurDichtsteNodeCache = { ...(opt.C || C), afstand: afstand(P.lat, P.lon, (opt.C || C).lat, (opt.C || C).lon) };
    snelheidKmh = opt.kmh != null ? opt.kmh : 0;
    stilstandSinds = opt.stilMs === null ? 0 : Date.now() - (opt.stilMs != null ? opt.stilMs : 2000);
    handmatigLockActief = false; stilstandAutoLock = false; handmatigGeselecteerdNodeId = null;
    laatsteNodeCorrectieTijd = 0; naderLeegSleutel = null; naderLeegTijd = 0;
  };
  const bewijs = (n) => ({ gekozen: String(W.id), kandidaat: { id: String(C.id), lat: C.lat, lon: C.lon },
    n, dwarsSom: 0, voorAf: 9, laatsteKoers: 5, laatsteVolT: Date.now(), weg: 0, vorigeT: Date.now(), vorigeV: 0,
    minAf: 10, gestegen: false });

  try {
    localStorage.setItem('sl_opslaglog', '[]');

    // ═══ MC1 — nadering_leeg ══════════════════════════════════
    zetStil(); naderLeeg = null; naderBewijs = bewijs(4);
    vergrendelNodeHandmatig(W.id, 'beeld');           // V11.34.3: wist nog (dat is A1, V11.36.0)
    zetStil();
    checkNaderingsCorrectie(P.lat, P.lon);
    const l1 = regelsVan('nadering_leeg');
    const r1 = l1[0] || {};
    eis('MC1a stilstand, 12 m verschil, bewijs gewist door een tik op het beeld: één regel met reden en stand',
        l1.length === 1 && r1.poortReden === 'tik' && r1.hoekN === 4 && r1.afwM === 12 && r1.node === String(W.id)
          && r1.resetAf === 10 && typeof r1.resetNa === 'number' && r1.resetNa >= 0 && r1.resetNa < 5 && r1.dur === 2,
        'tik, hoekN 4, afwM 12, resetAf 10, dur 2',
        `${r1.poortReden}, hoekN ${r1.hoekN}, afwM ${r1.afwM}, resetAf ${r1.resetAf}, resetNa ${r1.resetNa}, dur ${r1.dur}`);
    eis('MC1b de keuze verandert niet: W blijft getoond, geen correctie',
        String(dichtstbijOSM.id) === String(W.id) && regelsVan('nadering_correctie').length === 0 && regelsVan('node_auto_correctie').length === 0,
        'W, geen correctie', String(dichtstbijOSM.id));
    checkNaderingsCorrectie(P.lat, P.lon); checkNaderingsCorrectie(P.lat, P.lon);
    eis('MC1c één regel per episode', regelsVan('nadering_leeg').length === 1, 1, regelsVan('nadering_leeg').length);
    eis('MC1d een gewone logregel draagt de nieuwe velden niet',
        log().filter(x => x.reden !== 'nadering_leeg').every(x => !('resetAf' in x) && !('resetNa' in x) && !('rPct' in x)),
        'schoon', log().filter(x => x.reden !== 'nadering_leeg').map(x => x.reden).join(','));

    localStorage.setItem('sl_opslaglog', '[]');
    zetStil(); naderLeeg = null; naderBewijs = bewijs(2);
    vergrendelNodeHandmatig(W.id, 'lijst');
    zetStil(); checkNaderingsCorrectie(P.lat, P.lon);
    eis('MC1e een lijstkeuze heet "lijst"', (regelsVan('nadering_leeg')[0] || {}).poortReden === 'lijst', 'lijst',
        (regelsVan('nadering_leeg')[0] || {}).poortReden);

    localStorage.setItem('sl_opslaglog', '[]');
    zetStil(); naderBewijs = bewijs(0); checkNaderingsCorrectie(P.lat, P.lon);
    const rn = regelsVan('nadering_leeg')[0] || {};
    eis('MC1f er liep een verzameling, maar niets telde: "nul", hoekN 0, zonder reset-velden',
        rn.poortReden === 'nul' && rn.hoekN === 0 && !('resetAf' in rn) && !('resetNa' in rn), 'nul, 0', JSON.stringify([rn.poortReden, rn.hoekN]));

    localStorage.setItem('sl_opslaglog', '[]');
    zetStil(); naderBewijs = null;
    naderLeeg = { reden: 'marge', gekozen: String(X.id), kandidaat: { id: String(C.id), lat: C.lat, lon: C.lon }, n: 3, af: 30, t: Date.now() };
    checkNaderingsCorrectie(P.lat, P.lon);
    eis('MC1g de laatste nulling hoorde bij een ander paar: "nooit"',
        (regelsVan('nadering_leeg')[0] || {}).poortReden === 'nooit', 'nooit', (regelsVan('nadering_leeg')[0] || {}).poortReden);

    const geen = (o, naam) => {
      localStorage.setItem('sl_opslaglog', '[]'); zetStil(o); naderBewijs = null; checkNaderingsCorrectie(P.lat, P.lon);
      return regelsVan('nadering_leeg').length === 0;
    };
    eis('MC1h geen regel rijdend, vóór 1 s stilstand, onder 8 m verschil, of op het juiste licht',
        geen({ kmh: 10 }) && geen({ stilMs: 500 }) && geen({ stilMs: null })
          && geen({ W: { id: 9770004, ...LL(0, 16) } }) && geen({ W: C }),
        'nergens een regel', 'ok');

    // De redenen uit verzamelNaderingsBewijs, rijdend.
    const rijd = (o) => {
      zetStil({ kmh: 20, stilMs: null, ...o }); naderLeeg = null; naderBewijs = bewijs(3);
      verzamelNaderingsBewijs(P.lat, P.lon);
      return naderLeeg ? naderLeeg.reden + '/' + naderLeeg.n : 'geen';
    };
    const redenen = [rijd({ W: X }), rijd({ W: C }), rijd({ W: { id: W.id, naam: 'MC W', ...LL(0, 14) } })];
    eis('MC1i verzamelNaderingsBewijs noemt paar, zelfde en marge, met de stand van het bewijs',
        redenen.join(',') === 'paar/3,zelfde/3,marge/3', 'paar/3,zelfde/3,marge/3', redenen.join(','));
    eis('MC1j ... en koers staat er ook bij', /naderBewijsReset\('koers'\)/.test(zc(verzamelNaderingsBewijs)), 'aanwezig', 'gelezen');

    // ═══ MC2 — rPct in richting_tik ═══════════════════════════
    localStorage.setItem('sl_opslaglog', '[]');
    const NODE = 9770010;
    const nu = Date.now();
    localStorage.setItem(`sl_v5_${NODE}_W_N_avond`, JSON.stringify([
      { duur: 30, tijd: nu - 5 * 86400000, gewicht: 1, bron: 'tik', tb: 1, zo: 0 },
      { duur: 34, tijd: nu - 40 * 86400000, gewicht: 1, bron: 'tik', zo: 0 }]));
    osmCache = [{ id: NODE, naam: 'MC rij', ...LL(0, 12) }];
    dichtstbijOSM = { ...osmCache[0], afstand: 12 };
    huidigBevestigdOsmNodeId = String(NODE); richtingKnoppenNodeId = null;
    v9AanrijHeading = null; v9AanrijSnelheidHeading = null; v9PreSelectieAfrij = null; preZet = null;
    richtingBlokVerborgen = false;
    renderRichtingBlok(dichtstbijOSM);
    const idx = laatsteRichtingRijen.findIndex(r => (r.paren || []).some(p => p.aanrij === 'W' && p.afrij === 'N'));
    const verwacht = richtingLeerPct(laagMetingen(String(NODE), { paren: (laatsteRichtingRijen[idx] || {}).paren || [] }), String(NODE));
    kiesLaagRichting(idx);
    const t1 = regelsVan('richting_tik').slice(-1)[0] || {};
    eis('MC2a een tik op een rij: richting_tik draagt het percentage dat die rij toonde',
        idx >= 0 && verwacht > 0 && t1.rPct === verwacht && t1.element === 'rij', 'rPct ' + verwacht,
        'idx ' + idx + ', rPct ' + t1.rPct + ', element ' + t1.element);
    eis('MC2b dat is hetzelfde getal als richtingRijPct voor dat paar', richtingRijPct(NODE, 'W', 'N') === verwacht,
        verwacht, richtingRijPct(NODE, 'W', 'N'));
    v9AanrijHeading = null; v9AanrijSnelheidHeading = null;
    tikRichting('links', 'vraag');
    const t2 = regelsVan('richting_tik').slice(-1)[0] || {};
    eis('MC2c zonder aanrij geen percentage: geen veld', t2.element === 'vraag' && !('rPct' in t2), 'geen rPct', JSON.stringify(t2.rPct));
    v9AanrijSnelheidHeading = 270;   // W, dus links = N
    tikRichting('links', 'vraag');
    const t3 = regelsVan('richting_tik').slice(-1)[0] || {};
    tikRichting('rechts', 'vraag');
    const t4 = regelsVan('richting_tik').slice(-1)[0] || {};
    eis('MC2d met aanrij: het percentage van de rij van dat paar, en 0 voor een richting zonder data',
        t3.rPct === verwacht && t4.rPct === 0, verwacht + ' en 0', t3.rPct + ' en ' + t4.rPct);

    // ═══ MC3 — rPct in v5_vroeg_geschreven ════════════════════
    localStorage.setItem('sl_opslaglog', '[]');
    v9AanrijSnelheidHeading = 270; huidigePos = { lat: osmCache[0].lat, lon: osmCache[0].lon - 12 / mLon };
    tikRichting('links', 'vraag');
    const voor = richtingRijPct(NODE, 'W', 'N');
    v9KandidaatZagOvergang = false;
    const ok = schrijfV5DirectBijGroen(String(NODE), 26, 'avond', 12, []);
    const na = richtingRijPct(NODE, 'W', 'N');
    const v5 = regelsVan('v5_vroeg_geschreven').slice(-1)[0] || {};
    eis('MC3 v5_vroeg_geschreven draagt het NIEUWE percentage van de rij, en dat is hoger dan ervoor',
        ok === true && v5.rPct === na && na > voor, 'rPct ' + na + ' > ' + voor, `ok ${ok}, rPct ${v5.rPct}, voor ${voor}, na ${na}`);

    // ═══ MC4 — appVersie ══════════════════════════════════════
    const kort = String(APP_VERSIE).split(' ')[0];
    const exp8 = { exporteerMeetdata: "versie:'V11.17.57'", exporteerData: "versie:'11.4.4'", exporteerTrainframes: "versie:'8.5'",
                   exporteerConfLog: "versie: '11.15.10-debug'", exporteerZichtLog: "versie: 'V11.17.34-meetinstrument'",
                   exporteerHerzieningLog: "versie: 'V11.17.57-herziening'", exporteerDetLog: "versie: 'V11.17.46-meetinstrument'" };
    const mis = Object.entries(exp8).filter(([n, v]) => { const s = String(eval(n));
      return s.indexOf(v) < 0 || !/appVersie(:| =) appVersieKort\(\)/.test(s); }).map(x => x[0]);
    const opslagBron = String(exporteerMeetdata);
    eis('MC4a alle acht exports krijgen appVersie, en hun eigen versieveld blijft staan',
        mis.length === 0 && opslagBron.indexOf("versie:'V11.17.15'") >= 0
          && (opslagBron.match(/appVersie(:| =) appVersieKort\(\)/g) || []).length === 2,
        '8 exports, versies ongewijzigd', mis.join(', ') || 'alle acht');
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
    const js = []; for (const b of blobs) js.push(JSON.parse(await b.text()));
    const meet = js.find(j => !Array.isArray(j.sleutels)), opsl = js.find(j => Array.isArray(j.sleutels));
    eis('MC4b in het bestand: meetdata en opslag dragen appVersie ' + kort + ', naast hun oude versie',
        !!meet && !!opsl && meet.appVersie === kort && opsl.appVersie === kort && meet.versie === 'V11.17.57' && opsl.versie === 'V11.17.15',
        kort + ' / ' + kort, (meet ? meet.appVersie + ' ' + meet.versie : '-') + ' / ' + (opsl ? opsl.appVersie + ' ' + opsl.versie : '-'));

    // ═══ MC5 — alleen meten ═══════════════════════════════════
    // Zonder de gemarkeerde regels, en met de drie meegegeven waarden weer weg,
    // zijn de geraakte functies byte-gelijk aan V11.34.1 (4093429).
    const norm = (n) => zonderMeet(eval(n))
      .replace(/naderBewijsReset\('[a-z]+'\)/g, 'naderBewijsReset()')
      .replace(', rijPct = null)', ')').replace("'rij', rijPct)", "'rij')")
      .replace('element: richtingTikElement, rPct }', 'element: richtingTikElement }')
      .replace('v5Reden: tik.bron, rPct }', 'v5Reden: tik.bron }');
    const V1134_1 = { verzamelNaderingsBewijs: ['676603d', 3498], checkNaderingsCorrectie: ['c0518fc8', 3364],
      vergrendelNodeHandmatig: ['59bd19e1', 1006], tikRichting: ['46018e5', 3399], kiesLaagRichting: ['a54c371e', 325],
      schrijfV5DirectBijGroen: ['39231693', 1752], logOpslagMis: ['8349c424', 14867], exporteerData: ['98e982aa', 2442],
      exporteerTrainframes: ['f14cc38', 2858], exporteerConfLog: ['c676834b', 2627], exporteerZichtLog: ['c832f61e', 2550],
      exporteerHerzieningLog: ['d695ac8a', 2239], exporteerDetLog: ['81778b21', 2537] };
    const afw = Object.entries(V1134_1).filter(([n, [h, l]]) => { const s = norm(n); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
    eis('MC5a zonder de meetregels zijn de dertien geraakte functies byte-gelijk aan V11.34.1',
        afw.length === 0, 'geen afwijking', afw.join(', ') || 'geen');
    eis('MC5b de nieuwe meetfuncties schrijven geen toestand waar een keuze op leunt',
        !/\b(dichtstbijOSM|naderBewijs|handmatigLockActief|stilstandAutoLock|vorigOsmId|laatsteNodeCorrectieTijd|richtingLockKeuze|v9PreSelectieAfrij)\s*=[^=]/
          .test(zc(naderLeegMerk) + zc(naderLeegMeet) + zc(richtingRijPct)),
        'geen toewijzing', 'ok');
  } catch (e) {
    eis('geen crash', false, 'geen', String(e && e.stack || e).slice(0, 300));
  } finally {
    Date.now = bewaardNu;
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    try {
      const nu2 = []; for (let i = 0; i < localStorage.length; i++) nu2.push(localStorage.key(i));
      for (const k of nu2) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testMeetregelsCorrectie = testMeetregelsCorrectie;
