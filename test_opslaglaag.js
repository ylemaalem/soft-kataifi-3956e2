// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_opslaglaag.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.21 — opslag fase 2: de cache-laag.
//
//  WAT DEZE RELEASE IS. Een refactor, geen gedragswijziging. Alle lees- en
//  schrijfpaden van de kern-helpers lopen voortaan door drie functies
//  (opslagLees, opslagSchrijf, opslagVerwijder) in plaats van rechtstreeks
//  langs localStorage. localStorage blijft de bron van de waarheid; wat
//  erbij komt is een in-memory Map die bij het opstarten gevuld wordt.
//
//  WAAROM DAT NODIG IS. Fase 3 vervangt localStorage door IndexedDB, en dat
//  is ASYNCHROON. Deze app leest synchroon, midden in een countdown-tick.
//  De enige manier waarop dat kan blijven werken is: alles bij het opstarten
//  in het geheugen, en de synchrone lezingen daaruit bedienen. Deze release
//  legt dat pad aan en bewijst dat het niets verandert.
//
//  L1  opslagLees geeft hetzelfde als een rechtstreekse JSON.parse
//  L2  ... en de afgesproken terugval bij een ontbrekende of kapotte sleutel
//  L3  ... en geeft ELKE KEER EEN VERS OBJECT — de aliasing-val
//  L4  opslagLeesRuw geeft de ruwe string, ook als die geen JSON is
//  S1  opslagSchrijf persisteert naar localStorage en meldt succes
//  S2  opslagSchrijfRuw schrijft een kale string zonder JSON-omweg
//  S3  opslagVerwijder haalt de sleutel uit cache en opslag
//  Q1  een quota-fout verdwijnt NIET stil: false, een console-regel, een log
//  Q2  ... en de waarde blijft deze sessie leesbaar uit de cache
//  Q3  ... en de boot overschrijft zo'n niet-opgeslagen waarde niet
//  Q4  ... en vanaf de derde fout krijgt de gebruiker het te zien
//  B1  de boot vult de cache met alles wat er staat
//  B2  ... is idempotent: tweemaal starten geeft dezelfde belofte
//  B3  startApp wacht aantoonbaar op de boot
//  H1  de helpers zijn ONGEWIJZIGD van signatuur en uitkomst
//  H2  de schrijfhelpers persisteren echt (rondgang schrijven → lezen)
//  R1  REGRESSIE: een rechtstreekse localStorage-schrijving blijft zichtbaar
//  R2  REGRESSIE: een volledige rit — meten, tikken, bevestigen
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_opslaglaag.js';
//      document.head.appendChild(s);
//      s.onload = () => testOpslaglaag().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testOpslaglaag() {
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

  const nu = Date.now();
  const NODE = 996101;
  const DD_NU = huidigDDActief();
  const K = 'sl_test_opslaglaag_' + NODE;

  // De echte setItem, zodat Q1 hem tijdelijk kan vervangen door een weigeraar.
  const echteSetItem = Storage.prototype.setItem;
  const bewaardToast = (typeof toonToast === 'function') ? toonToast : null;

  const opruimen = () => {
    for (const k of [K, K + '_b', K + '_c']) { zetLS(k, null); opslagCache.delete(k); }
    // ── V11.18.22: ÉÉN VEEG OP NODE-ID IN PLAATS VAN EEN PREFIXLIJST ──
    // © 2026 StoplichtIQ — Y. Lemaalem
    //
    // De handmatige lijst die hier stond miste `_bezoek` (en `_groen`). Omdat
    // updateBezoekPerFase OPTELT, stond de teller bij een tweede run in dezelfde
    // browser op 2, bij een derde op 3 — en dan faalden H1b en H2, terwijl er
    // aan de opslaglaag niets mankeerde. De eerste run in een verse browser was
    // groen, dus de fout bleef bij de release van V11.18.21 onopgemerkt.
    //
    // Een veeg op node-id kan die fout niet meer maken: komt er later een
    // sleutelgroep bij, dan valt die vanzelf binnen de veeg. zetLS onthoudt elke
    // oorspronkelijke waarde, dus de finally zet alles terug zoals het stond.
    for (const k of Object.keys(localStorage)) {
      if (k.indexOf(String(NODE)) !== -1) { zetLS(k, null); opslagCache.delete(k); }
    }
  };

  try {
    // ══ L1 — DEZELFDE UITKOMST ALS EEN RECHTSTREEKSE PARSE ════
    opruimen();
    const waarde = [{ duur: 45, tijd: nu, gewicht: 1, bron: 's1' }, { duur: 30, tijd: nu - 1 }];
    zetLS(K, JSON.stringify(waarde));
    opslagCache.delete(K);
    eis('L1 opslagLees geeft hetzelfde als JSON.parse(localStorage.getItem(...))',
        JSON.stringify(opslagLees(K)) === JSON.stringify(JSON.parse(localStorage.getItem(K))),
        JSON.stringify(waarde), JSON.stringify(opslagLees(K)));

    // ══ L2 — DE TERUGVAL ══════════════════════════════════════
    opruimen();
    eis('L2 een ontbrekende sleutel geeft de meegegeven terugval',
        opslagLees(K) === null && JSON.stringify(opslagLees(K, [])) === '[]'
          && opslagLees(K, 'x') === 'x',
        'null / [] / x',
        String(opslagLees(K)) + ' / ' + JSON.stringify(opslagLees(K, [])) + ' / ' + opslagLees(K, 'x'));
    zetLS(K, '{dit is geen json');
    opslagCache.delete(K);
    eis('L2b en kapotte JSON ook — zonder te gooien',
        opslagLees(K, 'terugval') === 'terugval', 'terugval', String(opslagLees(K, 'terugval')));

    // ══ L3 — DE ALIASING-VAL ══════════════════════════════════
    // Dit is de reden dat de Map RUWE strings bewaart en geen geparsede
    // objecten. slaOpIntern pusht in wat laadM teruggaf, laadMV5 sorteert
    // zijn eigen resultaat, stempelV4Richtingverwant zet rec.rv = 1. Zou de
    // cache hetzelfde object blijven uitdelen, dan landde zo'n mutatie stil
    // in de cache en zag de volgende lezer hem VOORDAT er iets geschreven is.
    opruimen();
    zetLS(K, JSON.stringify([{ duur: 45, tijd: nu }]));
    const eerste = opslagLees(K);
    const tweede = opslagLees(K);
    eerste.push({ duur: 99, tijd: nu + 1 });
    eerste[0].duur = 1;
    const derde = opslagLees(K);
    eis('L3 elke lezing geeft een EIGEN object, geen gedeelde verwijzing',
        eerste !== tweede && tweede.length === 1 && derde.length === 1 && derde[0].duur === 45,
        'muteren raakt geen andere lezing',
        'tweede n=' + tweede.length + ' derde.duur=' + derde[0].duur);
    eis('L3b en de echte helpers erven die eigenschap — laadM levert vers werk',
        (() => { zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([{ duur: 40, tijd: nu, gewicht: 1, bron: 's1' }]));
                 const a = laadM(NODE, DD_NU); a.push({ duur: 1, tijd: 1 });
                 return laadM(NODE, DD_NU).length === 1; })(),
        '1 meting', String(laadM(NODE, DD_NU).length));

    // ══ L4 — RUWE STRINGS ═════════════════════════════════════
    opruimen();
    zetLS(K, 'rechtdoor');            // zoals sl_enkelricht_
    opslagCache.delete(K);
    eis('L4 opslagLeesRuw geeft een kale string terug, geen JSON-omweg',
        opslagLeesRuw(K) === 'rechtdoor' && opslagLees(K, 'tv') === 'tv',
        'rechtdoor / terugval bij opslagLees',
        String(opslagLeesRuw(K)) + ' / ' + String(opslagLees(K, 'tv')));

    // ══ S1/S2/S3 — SCHRIJVEN ══════════════════════════════════
    opruimen();
    const ok1 = opslagSchrijf(K, { a: 1, b: [2, 3] });
    eis('S1 opslagSchrijf persisteert naar localStorage en meldt succes',
        ok1 === true && localStorage.getItem(K) === JSON.stringify({ a: 1, b: [2, 3] }),
        'true + in localStorage', ok1 + ' / ' + String(localStorage.getItem(K)));
    const ok2 = opslagSchrijfRuw(K + '_b', 'kale-string');
    eis('S2 opslagSchrijfRuw schrijft zonder JSON-omweg',
        ok2 === true && localStorage.getItem(K + '_b') === 'kale-string',
        'true + kale-string', ok2 + ' / ' + String(localStorage.getItem(K + '_b')));
    opslagVerwijder(K);
    eis('S3 opslagVerwijder haalt de sleutel uit opslag EN uit de cache',
        localStorage.getItem(K) === null && !opslagCache.has(K),
        'weg uit beide',
        (localStorage.getItem(K) === null ? 'opslag weg' : 'opslag STAAT')
          + ', ' + (opslagCache.has(K) ? 'cache STAAT' : 'cache weg'));

    // ══ Q1..Q4 — DE STILLE MISLUKKING IS WEG ══════════════════
    // Van de 55 setItem-aanroepen stonden er 40 in een lege catch. Een vol
    // quotum zag je dus alleen aan data die er achteraf niet bleek te staan.
    opruimen();
    const consoleWaarschuwingen = [];
    const echteWarn = console.warn;
    console.warn = (...a) => { consoleWaarschuwingen.push(a.join(' ')); };
    const toasts = [];
    if (bewaardToast) window.toonToast = (t) => { toasts.push(t); };
    const foutenVoor = opslagQuotaFouten;
    opslagQuotaGemeld = false;
    zetLS('sl_opslaglog', '[]');
    // Een setItem die weigert, precies zoals een vol quotum doet.
    Storage.prototype.setItem = function (k, v) {
      if (String(k).startsWith(K)) { const e = new Error('vol'); e.name = 'QuotaExceededError'; throw e; }
      return echteSetItem.call(this, k, v);
    };
    let res1, res2, res3;
    try {
      res1 = opslagSchrijf(K, { nieuw: 1 });
      res2 = opslagSchrijf(K + '_b', { nieuw: 2 });
      res3 = opslagSchrijf(K + '_c', { nieuw: 3 });
    } finally {
      Storage.prototype.setItem = echteSetItem;
      console.warn = echteWarn;
      if (bewaardToast) window.toonToast = bewaardToast;
    }
    eis('Q1 een mislukte schrijving geeft false in plaats van stil te slagen',
        res1 === false && res2 === false && res3 === false,
        '3x false', [res1, res2, res3].join(', '));
    eis('Q1b en laat een console-waarschuwing achter',
        consoleWaarschuwingen.filter(w => w.includes('OPSLAG-VOL')).length === 3,
        '3 waarschuwingen',
        consoleWaarschuwingen.filter(w => w.includes('OPSLAG-VOL')).length + ' waarschuwingen');
    eis('Q1c en een regel in het opslaglog',
        (opslagLees('sl_opslaglog', []) || []).filter(r => r.reden === 'opslag_vol').length === 3,
        '3 opslag_vol-regels',
        (opslagLees('sl_opslaglog', []) || []).filter(r => r.reden === 'opslag_vol').length + ' regels');
    eis('Q2 de waarde blijft deze sessie leesbaar uit de cache',
        JSON.stringify(opslagLees(K)) === JSON.stringify({ nieuw: 1 })
          && localStorage.getItem(K) === null,
        'cache heeft hem, localStorage niet',
        JSON.stringify(opslagLees(K)) + ' / opslag=' + String(localStorage.getItem(K)));
    // Q3: de boot mag zo'n waarde niet terugdraaien naar wat er in opslag staat.
    await vulOpslagCache();
    eis('Q3 de boot overschrijft een niet-opgeslagen waarde niet',
        JSON.stringify(opslagLees(K)) === JSON.stringify({ nieuw: 1 }),
        '{"nieuw":1}', JSON.stringify(opslagLees(K)));
    eis('Q4 vanaf de derde fout krijgt de gebruiker een melding',
        toasts.length === 1 && /vol/i.test(toasts[0]),
        '1 toast met "vol"', toasts.length + ' toast(s): ' + (toasts[0] || '-'));
    eis('Q4b en de teller staat op drie fouten meer dan ervoor',
        opslagQuotaFouten - foutenVoor === 3, '+3', '+' + (opslagQuotaFouten - foutenVoor));
    for (const k of [K, K + '_b', K + '_c']) opslagCache.delete(k);

    // ══ B1..B3 — DE OPSTARTFASE ═══════════════════════════════
    opruimen();
    zetLS(K, JSON.stringify({ x: 1 }));
    opslagCache.clear();
    const boot = await vulOpslagCache();
    eis('B1 de boot vult de cache met alle sleutels die er staan',
        boot.sleutels === localStorage.length && opslagCache.has(K)
          && opslagCache.get(K).ruw === JSON.stringify({ x: 1 }),
        localStorage.length + ' sleutels, ' + K + ' erin',
        boot.sleutels + ' sleutels, ' + (opslagCache.has(K) ? 'erin' : 'ONTBREEKT'));
    eis('B1b en rapporteert hoe lang dat duurde',
        typeof boot.ms === 'number' && boot.ms >= 0 && opslagBootMs === boot.ms,
        'een getal in ms', String(boot.ms));
    const b1 = startOpslagBoot(), b2 = startOpslagBoot();
    eis('B2 startOpslagBoot is idempotent — dezelfde belofte, geen tweede ronde',
        b1 === b2, 'dezelfde belofte', b1 === b2 ? 'gelijk' : 'TWEE BELOFTES');
    await b1;
    eis('B3 startApp wacht aantoonbaar op de boot voordat de camera aangaat',
        /await startOpslagBoot\(\)/.test(String(startApp))
          && String(startApp).indexOf('startOpslagBoot')
             < String(startApp).indexOf('getUserMedia'),
        'await vóór getUserMedia',
        /await startOpslagBoot\(\)/.test(String(startApp)) ? 'aanwezig en vóór' : 'ONTBREEKT');

    // ══ H1 — DE HELPERS ZIJN NIET VAN VORM VERANDERD ══════════
    // De hele belofte van deze release: de rest van de app hoeft niets te
    // weten. Dus dezelfde argumenten, dezelfde soort uitkomst.
    opruimen();
    const vorm = [
      ['laadM', laadM.length, 2], ['laadGroenM', laadGroenM.length, 2],
      ['laadMV5', laadMV5.length, 4], ['laadRichtingData', laadRichtingData.length, 1],
      ['laadEnkelRicht', laadEnkelRicht.length, 1], ['isNodeNeutraal', isNodeNeutraal.length, 1],
      ['laadBezoekPerFase', laadBezoekPerFase.length, 2], ['laadStoplichtTag', laadStoplichtTag.length, 1],
      ['slaOpV5', slaOpV5.length, 6], ['slaKlokMoment', slaKlokMoment.length, 2],
      ['slaS2Aanwezigheid', slaS2Aanwezigheid.length, 2], ['slaRichtingOp', slaRichtingOp.length, 3]
    ];
    const vormFout = vorm.filter(([n, a, v]) => a !== v).map(([n, a, v]) => n + ': ' + a + ' i.p.v. ' + v);
    eis('H1 elke omgezette helper heeft nog exact dezelfde argumenten',
        vormFout.length === 0, '12 helpers ongewijzigd',
        vormFout.length ? vormFout.join(' | ') : 'alle 12 ongewijzigd');
    eis('H1b en een lege node geeft nog steeds de afgesproken lege waarden',
        Array.isArray(laadM(NODE, DD_NU)) && laadM(NODE, DD_NU).length === 0
          && Array.isArray(laadGroenM(NODE, DD_NU)) && laadMV5(NODE, 'N', 'W', DD_NU).length === 0
          && laadRichtingData(NODE) === null && laadEnkelRicht(NODE) === null
          && isNodeNeutraal(NODE) === false && laadStoplichtTag(NODE) === null
          && JSON.stringify(laadBezoekPerFase(NODE, DD_NU)) === '{"groen":0,"oranje":0,"rood":0}',
        '[] / [] / [] / null / null / false / null / nullen',
        'zoals verwacht');

    // ══ H2 — DE RONDGANG: SCHRIJVEN EN TERUGLEZEN ═════════════
    opruimen();
    slaOpV5(NODE, 'N', 'W', DD_NU, 42, V9_GEWICHT_DICHTBIJ, null, 'tik', true);
    slaKlokMoment && (dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 10, naam: 'T' });
    slaS2Aanwezigheid(NODE, 'rood');
    slaRichtingOp(NODE, 0.5, 90);
    slaStoplichtTagOp(NODE, 'normaal');
    updateBezoekPerFase(NODE, 'rood');   // (osmId, faseNaam) - dagdeel bepaalt hij zelf
    const rond = {
      v5: laadMV5(NODE, 'N', 'W', DD_NU).length,
      v5tb: (laadMV5(NODE, 'N', 'W', DD_NU)[0] || {}).tb,
      s2: (opslagLees('sl_s2_' + NODE, []) || []).length,
      richting: (laadRichtingData(NODE) || {}).bevestigingen,
      tag: (laadStoplichtTag(NODE) || {}).type,
      bezoek: laadBezoekPerFase(NODE, DD_NU).rood
    };
    eis('H2 schrijven en meteen teruglezen levert op wat erin ging',
        rond.v5 === 1 && rond.v5tb === 1 && rond.s2 === 1 && rond.richting === 1
          && rond.tag === 'normaal' && rond.bezoek === 1,
        'v5 1 (tb 1), s2 1, richting 1, tag normaal, bezoek 1',
        JSON.stringify(rond));
    eis('H2b en het staat ECHT in localStorage, niet alleen in de cache',
        localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) !== null
          && localStorage.getItem('sl_tag_' + NODE) !== null,
        'beide sleutels in localStorage',
        (localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) ? 'v5 ja' : 'v5 NEE')
          + ', ' + (localStorage.getItem('sl_tag_' + NODE) ? 'tag ja' : 'tag NEE'));

    // ══ R1 — REGRESSIE: DIRECTE SCHRIJVINGEN BLIJVEN ZICHTBAAR ═
    // 101 functies in deze app raken localStorage aan; de migraties, de
    // opruimpassen, de exports en de merge-routines lopen bewust nog niet
    // door deze laag. En de 48 testsuites zetten hun fixtures er rechtstreeks
    // in. Zolang OPSLAG_MEELEZEN aanstaat is localStorage de waarheid en kan
    // geen van die plekken de cache uit de pas laten lopen. Dit is de toets
    // die dat vastlegt — en die in fase 3 bewust zal moeten omvallen.
    opruimen();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([{ duur: 10, tijd: nu, gewicht: 1, bron: 's1' }]));
    const na1 = laadM(NODE, DD_NU).length;
    localStorage.setItem('sl_v4_' + NODE + '_' + DD_NU,
      JSON.stringify([{ duur: 10, tijd: nu, gewicht: 1, bron: 's1' },
                      { duur: 20, tijd: nu - 1, gewicht: 1, bron: 's1' }]));
    const na2 = laadM(NODE, DD_NU).length;
    eis('R1 een rechtstreekse localStorage-schrijving wordt meteen gezien',
        na1 === 1 && na2 === 2, '1 dan 2 metingen', na1 + ' dan ' + na2);
    eis('R1b en dat is precies wat OPSLAG_MEELEZEN garandeert',
        OPSLAG_MEELEZEN === true, 'true (fase 2)', String(OPSLAG_MEELEZEN));

    // ══ R2 — REGRESSIE: EEN HELE RIT ══════════════════════════
    // Meten, richting tikken, bevestigen — en dan moeten de vier getallen
    // die de gebruiker ziet kloppen.
    opruimen();
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 15, naam: 'Testweg' };
    for (let i = 0; i < 3; i++) slaOp(NODE, 0, 40 + i, null, true, null, null, true);
    slaOpV5(NODE, 'N', 'W', DD_NU, 41, V9_GEWICHT_DICHTBIJ, true, 'tik', true);
    slaOpV5(NODE, 'N', 'W', DD_NU, 43, V9_GEWICHT_DICHTBIJ, true, 'tik', true);
    const rit = {
      v4: laadM(NODE, DD_NU).length,
      cyclus: gewGem(laadM(NODE, DD_NU)),
      leerPct: berekenLeerPct(NODE),
      v5: laadMV5(NODE, 'N', 'W', DD_NU).length,
      richtPct: (berekenRichtingPct(NODE, 'N', 'W', DD_NU) || {}).pct
    };
    eis('R2 een rit levert metingen, een cyclustijd en een leerpercentage op',
        rit.v4 === 3 && rit.cyclus > 0 && rit.leerPct > 0 && rit.v5 === 2 && rit.richtPct > 0,
        '3 V4, cyclus > 0, pct > 0, 2 V5, richtpct > 0', JSON.stringify(rit));
    eis('R2b en het staat allemaal persistent in localStorage',
        localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) !== null
          && JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU)).length === 3,
        '3 V4-records op schijf',
        String((JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) || '[]')).length));

  } finally {
    Storage.prototype.setItem = echteSetItem;
    if (bewaardToast) window.toonToast = bewaardToast;
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
      opslagCache.delete(k);
    }
    dichtstbijOSM = null;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testOpslaglaag = testOpslaglaag;
