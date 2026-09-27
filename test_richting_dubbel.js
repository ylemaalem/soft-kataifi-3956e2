// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_richting_dubbel.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.28.0: elke meting telt één keer in een richtingpercentage.
//
//  WAT ER MIS WAS
//  laagMetingen en berekenRichtingPct lazen laadMV5Geclusterd. Die leest een
//  blok van 3x3 emmers: het eigen paar voor 1, de acht buren voor 0,5. Voor een
//  percentage ging dat op twee manieren mis. Twee paren van één regel die
//  binnen 45 graden liggen, lazen elkaar nog eens als buur: elke meting telde
//  1,5 of 2 keer. En een buuremmer van een ANDERE regel telde voor de helft mee.
//
//  HOE DEZE TEST TOT STAND KWAM
//  RD0 is eerst geschreven met de waarden van V11.27.0 en op die ongewijzigde
//  code gedraaid: 8 van 8 groen (4 records/69%, 9 records/81%, 23% en 27%,
//  10 metingen/58%). Na de fix werd diezelfde versie 0 van 8. Hieronder staat
//  RD0 omgedraaid: de juiste waarde, én de eis dat het niet meer de oude is.
//  De oude getallen staan als OUD_* in de code, zodat de omslag leesbaar blijft.
//
//  DE ECHTE GEVALLEN (export van 26 sept 09:07, recordvormen letterlijk,
//  tijden als leeftijd ten opzichte van een bevroren klok — de rekensom hangt
//  alleen van die leeftijd af)
//    RD0b  Surinameplein (297021347), Linksaf: NO_O, O_Z (dag+avond), NO_ZO
//    RD0c  3330495184, twee Rechtsaf-regels in twee naderingen
//    RD0d  4626468927, kruispuntvenster: ZO_ZW met 1 meting naast O_Z met 9
//  De node-brede bonussen zijn hier weggelaten (geen sl_bevestig_, geen
//  gps_tik_score, node niet in osmCache): de toets gaat over de telling.
//
//  WAT ONAANGEROERD MOET BLIJVEN
//  RD10 pint de countdownketen op de bytes van V11.27.0. Die leest
//  laadMV5Geclusterd rechtstreeks en blijft buren lenen — dat is daar bewust.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_richting_dubbel.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRichtingDubbel().regels);
// ═══════════════════════════════════════════════════════════════

function testRichtingDubbel() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };
  const bewaard = {
    dichtstbijOSM, getoondeLaag, getoondDagdeel, richtingBlokVerborgen,
    v9AanrijHeading, v9AanrijSnelheidHeading, mergeModusAan, mergeSelectie,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML,
    niHtml: (document.getElementById('node-info-body') || {}).innerHTML
  };
  const echtNu = Date.now;
  const NU = echtNu();
  const NODE = 992101;

  // De waarden van V11.27.0, zoals RD0 ze op de ongewijzigde code vastlegde.
  const OUD_RD0A_POOL = 4, OUD_RD0A_PCT = 69;
  const OUD_RD0B_POOL = 9, OUD_RD0B_PCT = 81;
  const OUD_RD0C_NW = 23, OUD_RD0C_NONW = 27;
  const OUD_RD0D_N = 10, OUD_RD0D_PCT = 58;

  // Dezelfde vingerafdruk als NB14: FNV-1a over String(fn).
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

  const wisNode = () => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_v5_' + NODE + '_') || k.startsWith('sl_v4_' + NODE + '_')) zetLS(k, null);
    }
    for (const p of ['sl_richting_', 'sl_bevestig_', 'sl_neutraal_', 'sl_enkelricht_']) zetLS(p + NODE, null);
  };
  const metTijd = (recs) => recs.map(r => { const { ageMs, ...rest } = r; return { ...rest, tijd: NU - ageMs }; });
  const zetEmmer = (paar, dd, recs) =>
    zetLS('sl_v5_' + NODE + '_' + paar + '_' + dd, JSON.stringify(metTijd(recs)));
  // Metingen zoals slaOpV5 ze schrijft. `start` houdt tijden per emmer uniek.
  const recs = (n, start = 0, tb = true) => Array.from({ length: n }, (_, i) =>
    ({ duur: 45, ageMs: (start + i) * 3600000, gewicht: 1, bron: 'tik', ...(tb ? { tb: 1 } : {}) }));
  const laag = (...paren) => ({ node: String(NODE), key: 'k',
    paren: paren.map(p => ({ aanrij: p.split('_')[0], afrij: p.split('_')[1] })) });
  // De verzamelaar van V11.27.0, letterlijk. Alleen voor RD7: op data zonder
  // buuremmers moet de nieuwe exact hetzelfde geven als de oude.
  const oudeLaagMetingen = (nodeId, l, dd = null) => {
    let m = [];
    const dagdelen = dd ? [dd] : Object.keys(DD);
    for (const p of (l.paren || []))
      for (const d of dagdelen)
        m = m.concat(laadMV5Geclusterd(nodeId, p.aanrij, p.afrij, d));
    return m;
  };
  const surinameplein = () => {
    zetEmmer('NO_O', 'dag',  [{ duur: 21, gewicht: 1, conv: 'onzeker', ageMs: 4210392787 }]);
    zetEmmer('NO_ZO', 'dag', [{ duur: 13, gewicht: 1, bron: 'tik', zo: 0, ageMs: 1359262795 }]);
    zetEmmer('O_Z', 'avond', [{ duur: 22, gewicht: 1, bron: 'tik', zo: 1, ageMs: 1011307148 }]);
    zetEmmer('O_Z', 'dag',   [{ duur: 22, gewicht: 1, ageMs: 4649091805 }]);
  };
  const venster4626 = () => {
    zetEmmer('ZO_ZW', 'dag', [{ duur: 87, gewicht: 1, bron: 'tik', zo: 0, ageMs: 776546242 }]);
    zetEmmer('O_Z', 'dag', [
      { duur: 47, gewicht: 1, bron: 'merge_alg', ageMs: 4999394364 },
      { duur: 15, gewicht: 0.53, bron: 'merge_alg', ageMs: 5260343830 },
      { duur: 47, gewicht: 1, bron: 'merge_alg', ageMs: 6388515326 },
      { duur: 107, gewicht: 0.2, bron: 'merge_alg', ageMs: 6388517947 },
      { duur: 74, gewicht: 0.09, bron: 'merge_alg', ageMs: 9152420790 },
      { duur: 74, gewicht: 1, bron: 'merge_alg', ageMs: 9152424683 },
      { duur: 51, gewicht: 0.4, bron: 'merge_alg', ageMs: 12266264540 },
      { duur: 66, gewicht: 1, bron: 'merge_alg', ageMs: 12266264542 },
      { duur: 78, gewicht: 1, bron: 'tik', zo: 0, tb: 1, ageMs: 249090985 }]);
  };

  try {
    Date.now = () => NU;

    // ══ RD0a — TWEE BUURPAREN IN ÉÉN REGEL ════════════════════
    // N_W en NO_NW zijn allebei Rechtsaf en liggen in elkaars 3x3-blok.
    wisNode();
    zetEmmer('N_W', 'dag', recs(1, 0));
    zetEmmer('NO_NW', 'dag', recs(1, 1));
    const l2 = laag('N_W', 'NO_NW');
    const pool2 = laagMetingen(NODE, l2).length, pct2 = laagLeerPct(NODE, l2);
    eis('RD0a de pool bevat 2 records voor 2 metingen (was ' + OUD_RD0A_POOL + ')',
        pool2 === 2 && pool2 !== OUD_RD0A_POOL, '2', String(pool2));
    eis('RD0a2 en de regel toont 53% (was ' + OUD_RD0A_PCT + '%)',
        pct2 === 53 && pct2 !== OUD_RD0A_PCT, '53', String(pct2));

    // ══ RD0b — SURINAMEPLEIN, DRIE PAREN ══════════════════════
    wisNode();
    surinameplein();
    const lS = laag('NO_O', 'O_Z', 'NO_ZO');
    const poolS = laagMetingen(NODE, lS).length, pctS = laagLeerPct(NODE, lS);
    eis('RD0b Surinameplein: 4 metingen staan 4 keer in de pool (was ' + OUD_RD0B_POOL + ')',
        poolS === 4 && poolS !== OUD_RD0B_POOL, '4', String(poolS));
    eis('RD0b2 en de regel toont 60% (was ' + OUD_RD0B_PCT + '%)',
        pctS === 60 && pctS !== OUD_RD0B_PCT, '60', String(pctS));

    // ══ RD0c — GEEN LEENVERKEER TUSSEN REGELS ═════════════════
    wisNode();
    zetEmmer('N_W', 'avond',   [{ duur: 9, gewicht: 0.6, bron: 'tik', zo: 0, ageMs: 2133338810 }]);
    zetEmmer('NO_NW', 'avond', [{ duur: 31, gewicht: 1, zo: 0, ageMs: 2813229802 }]);
    const cA = laagLeerPct(NODE, laag('N_W')), cB = laagLeerPct(NODE, laag('NO_NW'));
    eis('RD0c de N_W-regel telt alleen zijn eigen meting: 14% (was ' + OUD_RD0C_NW + '%)',
        cA === 14 && cA !== OUD_RD0C_NW, '14', String(cA));
    eis('RD0c2 de NO_NW-regel ook: 21% (was ' + OUD_RD0C_NONW + '%)',
        cB === 21 && cB !== OUD_RD0C_NONW, '21', String(cB));

    // ══ RD0d — HET KRUISPUNTVENSTER (B2) ══════════════════════
    wisNode();
    venster4626();
    const d = berekenRichtingPct(NODE, 'ZO', 'ZW', 'dag');
    eis('RD0d een emmer met 1 meting meldt 1 meting (was ' + OUD_RD0D_N + ')',
        !!d && d.metingen === 1 && d.metingen !== OUD_RD0D_N, '1', String(d && d.metingen));
    eis('RD0d2 en 24% (was ' + OUD_RD0D_PCT + '%)',
        !!d && d.pct === 24 && d.pct !== OUD_RD0D_PCT, '24', String(d && d.pct));
    const dO = berekenRichtingPct(NODE, 'O', 'Z', 'dag');
    eis('RD0d3 de buuremmer O_Z telt ook alleen zijn eigen 9',
        !!dO && dO.metingen === 9, '9', String(dO && dO.metingen));

    // ══ RD5 — DE INVARIANT: TWEE PAREN = ÉÉN EMMER ════════════
    // Dezelfde records, één keer over twee buurparen verdeeld en één keer in
    // één emmer. Dat moet hetzelfde percentage geven, getikt en ongetikt.
    const rd5fout = [];
    for (const tb of [true, false]) for (const n of [1, 2, 3, 4]) {
      wisNode();
      const a = recs(n, 0, tb), b = recs(n, n, tb);
      zetEmmer('N_W', 'dag', a); zetEmmer('NO_NW', 'dag', b);
      const twee = laagLeerPct(NODE, laag('N_W', 'NO_NW'));
      wisNode();
      zetEmmer('N_W', 'dag', a.concat(b));
      const een = laagLeerPct(NODE, laag('N_W'));
      if (twee !== een) rd5fout.push((tb ? 'getikt' : 'ongetikt') + ' n=' + n + ': ' + twee + ' tegen ' + een);
    }
    eis('RD5 twee buurparen van n = één emmer van 2n (n=1..4, getikt en ongetikt)',
        rd5fout.length === 0, 'overal gelijk', rd5fout.join(' | ') || 'gelijk');
    // Drie paren die allemaal elkaars buur zijn: N_W, NO_NW en N_NW.
    wisNode();
    const r1 = recs(1, 0), r2 = recs(1, 1), r3 = recs(1, 2);
    zetEmmer('N_W', 'dag', r1); zetEmmer('NO_NW', 'dag', r2); zetEmmer('N_NW', 'dag', r3);
    const drie = laagLeerPct(NODE, laag('N_W', 'NO_NW', 'N_NW'));
    const drieN = laagMetingen(NODE, laag('N_W', 'NO_NW', 'N_NW')).length;
    wisNode();
    zetEmmer('N_W', 'dag', r1.concat(r2, r3));
    const drieEen = laagLeerPct(NODE, laag('N_W'));
    eis('RD5b drie onderling naburige paren = één emmer met dezelfde drie',
        drie === drieEen && drieN === 3, drieEen + '% uit 3 records', drie + '% uit ' + drieN);
    wisNode();
    zetEmmer('N_W', 'dag', recs(2));
    eis('RD5c een paar dat twee keer in de regel staat, telt één keer',
        laagMetingen(NODE, laag('N_W', 'N_W')).length === 2, '2', String(laagMetingen(NODE, laag('N_W', 'N_W')).length));

    // ══ RD6 — EEN ANDERE REGEL RAAKT DEZE NIET ═══════════════
    // NO_W is Rechtdoor (andere bocht), NO_NW een Rechtsaf die elders kan
    // vallen. Beide liggen in het 3x3-blok van N_W.
    wisNode();
    zetEmmer('N_W', 'dag', recs(2));
    const vooraf = laagLeerPct(NODE, laag('N_W')), voorafK = berekenRichtingPct(NODE, 'N', 'W', 'dag');
    zetEmmer('NO_W', 'dag', recs(3, 10));
    zetEmmer('NO_NW', 'dag', recs(3, 20));
    zetEmmer('N_NW', 'avond', recs(2, 30));
    const achteraf = laagLeerPct(NODE, laag('N_W')), achterafK = berekenRichtingPct(NODE, 'N', 'W', 'dag');
    eis('RD6 metingen in buuremmers veranderen de regel niet',
        achteraf === vooraf, vooraf + '%', achteraf + '%');
    eis('RD6b en ook de emmer in het kruispuntvenster niet (percentage en aantal)',
        achterafK.pct === voorafK.pct && achterafK.metingen === voorafK.metingen,
        voorafK.pct + '% (' + voorafK.metingen + 'x)', achterafK.pct + '% (' + achterafK.metingen + 'x)');

    // ══ RD7 — ZONDER BUREN IS ER NIETS VERANDERD ═════════════
    // Op data zonder buuremmers moet de nieuwe verzamelaar exact de oude zijn.
    const rd7fout = [];
    for (const n of [1, 2, 3, 5, 8]) {
      wisNode();
      zetEmmer('N_W', 'dag', recs(n, 0, n % 2 === 0));
      zetEmmer('N_W', 'avond', recs(1, 50, false));
      zetEmmer('Z_O', 'nacht', recs(n, 60));        // 180 graden verderop: geen buur
      const l = laag('N_W', 'Z_O');
      const nieuw = richtingLeerPct(laagMetingen(NODE, l), NODE);
      const oud = richtingLeerPct(oudeLaagMetingen(NODE, l), NODE);
      const kNieuw = berekenRichtingPct(NODE, 'N', 'W', 'dag');
      const kOud = richtingLeerPct(laadMV5Geclusterd(NODE, 'N', 'W', 'dag'), NODE);
      if (nieuw !== oud) rd7fout.push('regel n=' + n + ': ' + nieuw + ' tegen ' + oud);
      if (kNieuw.pct !== kOud) rd7fout.push('venster n=' + n + ': ' + kNieuw.pct + ' tegen ' + kOud);
      if (laagMetingen(NODE, l).length !== oudeLaagMetingen(NODE, l).length) rd7fout.push('aantal n=' + n);
    }
    eis('RD7 zonder buuremmers geeft V11.28.0 exact het getal van V11.27.0',
        rd7fout.length === 0, 'gelijk', rd7fout.join(' | ') || 'gelijk voor n=1,2,3,5,8');

    // ══ RD8 — DE DAGDEELCHIPS ═════════════════════════════════
    wisNode();
    const dagA = recs(2, 0), avA = recs(1, 5), dagB = recs(1, 9);
    zetEmmer('N_W', 'dag', dagA); zetEmmer('N_W', 'avond', avA); zetEmmer('NO_NW', 'dag', dagB);
    const lD = laag('N_W', 'NO_NW');
    const chip = laagDagdeelCijfers(NODE, lD, 'dag');
    const eigenDag = metTijd(dagA.concat(dagB));
    eis('RD8 de dagdeelchip telt het echte aantal (3, niet 6)',
        chip.n === 3, '3', String(chip.n));
    eis('RD8b en het chippercentage komt uit precies die drie',
        laagDagdeelPct(NODE, lD, 'dag') === richtingLeerPct(eigenDag, NODE),
        String(richtingLeerPct(eigenDag, NODE)), String(laagDagdeelPct(NODE, lD, 'dag')));
    eis('RD8c een dagdeel zonder eigen emmer blijft leeg (null), ook met een buur ernaast',
        laagDagdeelPct(NODE, laag('NO_NW'), 'avond') === null, 'null',
        String(laagDagdeelPct(NODE, laag('NO_NW'), 'avond')));

    // ══ RD9 — ALLEEN LEZEN ════════════════════════════════════
    wisNode();
    surinameplein();
    venster4626();
    const snap = () => { const o = {}; for (const k of Object.keys(localStorage)) o[k] = localStorage.getItem(k); return JSON.stringify(o); };
    const voor = snap();
    laagMetingen(NODE, lS); laagLeerPct(NODE, lS);
    for (const dd of Object.keys(DD)) { laagDagdeelCijfers(NODE, lS, dd); laagDagdeelPct(NODE, lS, dd); }
    berekenRichtingPct(NODE, 'ZO', 'ZW', 'dag'); verzamelV5Richtingen(NODE);
    eis('RD9 de rekenfuncties schrijven niets naar localStorage', snap() === voor,
        'identiek', snap() === voor ? 'identiek' : 'GEWIJZIGD');

    // ══ RD10 — DE COUNTDOWN IS NIET AANGERAAKT ═══════════════
    // Bytes van V11.27.0. Deze keten leest laadMV5Geclusterd rechtstreeks en
    // hoort buren te blijven lenen.
    const pin = {
      laadMV5Geclusterd: ['36b22cc6', 461], kiesCountdownBron: ['8e69db98', 12851],
      metDagdeelLening: ['cd42751e', 510], berekenSchaduwWaarden: ['dfd1c572', 1799],
      bepaalRichtingTekort: ['1f0ad938', 665], laadMV5: ['f817ac38', 434],
      richtingLeerPct: ['e4a7222', 925], v5NaarV4Vorm: ['4b36964', 241]
    };
    for (const [naam, [h, len]] of Object.entries(pin)) {
      const src = String(window[naam]);
      eis('RD10 ' + naam + ' is byte-gelijk aan V11.27.0', fnv(src) === h && src.length === len,
          h + ' / ' + len, fnv(src) + ' / ' + src.length);
    }
    wisNode();
    zetEmmer('N_W', 'dag', recs(1));
    zetEmmer('NO_NW', 'dag', recs(4, 10));
    eis('RD10b laadMV5Geclusterd leent nog steeds van de buren (1 eigen + 4 buur = 5)',
        laadMV5Geclusterd(NODE, 'N', 'W', 'dag').length === 5, '5',
        String(laadMV5Geclusterd(NODE, 'N', 'W', 'dag').length));

    // ══ RD11 — OP HET SCHERM: REGEL = BALK = 53% ══════════════
    wisNode();
    zetEmmer('N_W', 'dag', recs(1, 0));
    zetEmmer('NO_NW', 'dag', recs(1, 1));
    zetLS('sl_v4_' + NODE + '_dag', JSON.stringify([{ duur: 45, tijd: NU, richting: 0, obs: 45, gewicht: 1, bron: 's1' }]));
    zetLS('sl_richting_' + NODE, JSON.stringify({ headings: [15, 18, 20, 22, 25, 20, 19, 21], laatste_update: NU, bevestigingen: 8 }));
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 20, naam: 'Testweg' };
    richtingBlokVerborgen = false; getoondDagdeel = null; getoondeLaag = null;
    v9AanrijHeading = 20; v9AanrijSnelheidHeading = 20;
    bijwerkLeerkaart(dichtstbijOSM);
    const rijen = [...document.querySelectorAll('#richting-blok-body .rb-rij')];
    const richt = rijen.filter(r => !r.querySelector('.rb-label').textContent.trim().startsWith('Rond licht'));
    eis('RD11 de twee buurparen staan samen op ÉÉN regel',
        richt.length === 1, '1 regel', richt.length + ': ' + richt.map(r => r.querySelector('.rb-label').textContent.trim()).join(' | '));
    if (richt.length) {
      const regelPct = richt[0].querySelector('.rb-pct').textContent.trim();
      richt[0].onclick();
      const balkPct = document.getElementById('leer-pct-getal').textContent.trim();
      eis('RD11b die regel toont 53% (was ' + OUD_RD0A_PCT + '%)', regelPct === '53%', '53%', regelPct);
      eis('RD11c en de balk bovenaan hetzelfde', balkPct === regelPct, regelPct, balkPct);
    }
    getoondeLaag = null;

    // ══ RD12 — OP HET SCHERM: HET KRUISPUNTVENSTER (B2) ═══════
    wisNode();
    venster4626();
    mergeModusAan = false; mergeSelectie = [];
    renderNodeInfo(NODE);
    const niRij = document.querySelector('#node-info-body .ni-rij[data-aanrij="ZO"][data-afrij="ZW"]');
    const niTekst = niRij ? niRij.querySelector('.ni-rij-dds').textContent.replace(/\s+/g, ' ').trim() : '';
    eis('RD12 het venster toont de ZO_ZW-emmer als 1 meting, niet ' + OUD_RD0D_N,
        /\(1×\)/.test(niTekst) && /Σ1×/.test(niTekst), '(1×) … Σ1×', niTekst || 'geen rij');
    eis('RD12b met 24% in plaats van ' + OUD_RD0D_PCT + '%', /24%/.test(niTekst), '24%', niTekst || 'geen rij');
  } finally {
    Date.now = echtNu;
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    try { opslagHersynchroniseer([...bewaardLS.keys()]); } catch (_) {}
    dichtstbijOSM = bewaard.dichtstbijOSM;
    getoondeLaag = bewaard.getoondeLaag;
    getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    mergeModusAan = bewaard.mergeModusAan;
    mergeSelectie = bewaard.mergeSelectie;
    const b = document.getElementById('richting-blok-body');
    if (b && bewaard.blokHtml != null) b.innerHTML = bewaard.blokHtml;
    const ni = document.getElementById('node-info-body');
    if (ni && bewaard.niHtml != null) ni.innerHTML = bewaard.niHtml;
  }
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}
