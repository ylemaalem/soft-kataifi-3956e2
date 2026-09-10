// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_rv_wezen.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.92: de eenmalige reparatie van rv-gemarkeerde metingen die
//  tussen D2 (V11.17.85, 8 september) en release 1 (V11.17.91) in het
//  niemandsland vielen — hun V5-tweeling werd bij een samenvoeging met
//  Algemeen weggegooid, maar het V4-record hield zijn rv-stempel en telde
//  daardoor in GEEN van de vier categorieën meer mee.
//
//  DEZE SUITE RAAKT DE HELE OPSLAG
//  migratieRvWezen scant ALLE sl_v4_-sleutels, niet alleen die van een
//  testnode. De opzet hieronder maakt daarom eerst een momentopname van elke
//  emmer die een rv:1-record bevat, plus de migratievlag en het opslaglog, en
//  zet die in het finally-blok exact terug. Zonder dat zou het draaien van
//  deze suite echte leerdata kunnen aanpassen.
//
//  WAAR HET OM DRAAIT
//  Het wees-criterium moet twee kanten op kloppen. Te ruim, en een meting die
//  nog bij een bestaande richting hoort verliest zijn stempel en telt dan in
//  TWEE categorieën mee — erger dan de bug zelf. Te streng, en de wezen
//  blijven staan. T2, T3 en T5 bewaken de eerste kant, T1 de tweede.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_rv_wezen.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRvWezen().regels);
// ═══════════════════════════════════════════════════════════════

function testRvWezen() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const NODE = 997001, NODE_B = 997002;
  const DD_NU = huidigDDActief();
  const nu = Date.now();
  const echteSetItem = Storage.prototype.setItem;

  // ── momentopname van ALLES wat de migratie zou kunnen raken ──
  const snapshot = new Map();
  const bewaar = (k) => { if (!snapshot.has(k)) snapshot.set(k, localStorage.getItem(k)); };
  for (const k of Object.keys(localStorage)) {
    if (!/^sl_v4_.+_(ochtend|dag|avond|nacht)$/.test(k)) continue;
    let a; try { a = JSON.parse(localStorage.getItem(k)); } catch (e) { continue; }
    if (Array.isArray(a) && a.some(x => x && x.rv === 1)) bewaar(k);
  }
  bewaar('sl_rvwees_v1');
  bewaar('sl_opslaglog');

  const zet = (k, v) => { bewaar(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); };

  // Elk record een EIGEN tijdstempel: laadM ontdubbelt op `tijd`, dus records
  // met dezelfde tijd worden nooit alle twee gelezen (die val kostte in
  // test_v4_markering een vals-positieve T3).
  const v4 = (duur, uurGeleden, extra = {}) => ({
    duur, tijd: nu - uurGeleden * 3600000, richting: 0, obs: duur,
    gewicht: 1, bron: 's1', ...extra
  });
  const v5 = (duur, uurGeleden) => ({ duur, tijd: nu - uurGeleden * 3600000, gewicht: 1, bron: 'tik' });

  const lees = (node, dd) => {
    try { return JSON.parse(localStorage.getItem('sl_v4_' + node + '_' + dd)) || []; }
    catch (e) { return []; }
  };
  const logRegels = (reden) => {
    try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === reden); }
    catch (e) { return []; }
  };
  const telAlgemeen = (node) => {
    let n = 0;
    for (const d of Object.keys(DD)) n += zonderRichtingVerwant(laadM(node, d)).length;
    return n;
  };
  const opnieuw = () => { zet('sl_rvwees_v1', null); zet('sl_opslaglog', null); };
  const wisTest = () => {
    for (const d of Object.keys(DD)) {
      zet('sl_v4_' + NODE + '_' + d, null);
      zet('sl_v4_' + NODE_B + '_' + d, null);
    }
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_v5_' + NODE + '_') || k.startsWith('sl_v5_' + NODE_B + '_')) zet(k, null);
    }
  };

  try {
    // ══ T1 — DE WEES WORDT HERSTELD ═══════════════════════════
    // rv:1, geen rvK, en op deze node staat GEEN V5-record meer met die duur.
    wisTest(); opnieuw();
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      v4(38, 3, { rv: 1 }),   // wees: samengevoegd tussen D2 en release 1
      v4(52, 5)               // gewone Algemeen-meting
    ]));
    const telVoor = telAlgemeen(NODE), pctVoor = berekenLeerPct(NODE);
    migratieRvWezen();
    const naT1 = lees(NODE, DD_NU);
    eis('T1 een wees verliest zijn rv-stempel',
        naT1.length === 2 && naT1.every(x => x.rv === undefined),
        '2 records, geen rv', naT1.filter(x => x.rv === 1).length + ' nog gestempeld');
    eis('T1b en telt daardoor weer mee bij Algemeen',
        telAlgemeen(NODE) === telVoor + 1 && berekenLeerPct(NODE) > pctVoor,
        (telVoor + 1) + ' metingen, pct boven ' + pctVoor,
        telAlgemeen(NODE) + ' metingen, pct ' + berekenLeerPct(NODE));
    eis('T1c alle overige velden van dat record zijn onaangeroerd',
        naT1[0].duur === 38 && naT1[0].obs === 38 && naT1[0].gewicht === 1
        && naT1[0].bron === 's1' && naT1[0].richting === 0
        && naT1[0].tijd === nu - 3 * 3600000,
        'duur/obs/gewicht/bron/richting/tijd gelijk',
        JSON.stringify({ duur: naT1[0].duur, obs: naT1[0].obs,
                         gewicht: naT1[0].gewicht, bron: naT1[0].bron }));
    eis('T1d de volgorde en het aantal records in de emmer wijzigen niet',
        naT1.length === 2 && naT1[0].duur === 38 && naT1[1].duur === 52,
        '[38, 52]', '[' + naT1.map(x => x.duur).join(', ') + ']');

    // ══ T2 — NOG EEN GELDIGE V5-EMMER: NIET AANRAKEN ══════════
    // De duur staat nog in V5 op deze node, dus het record kan dáár bij horen.
    // Bij die twijfel blijft hij met rust — hetzelfde inhouden als release 1.
    wisTest(); opnieuw();
    zet('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3)]));
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(38, 3, { rv: 1 })]));
    migratieRvWezen();
    eis('T2 een record waarvan de duur nog in V5 staat blijft gestempeld',
        lees(NODE, DD_NU)[0].rv === 1, 'rv=1', String(lees(NODE, DD_NU)[0].rv));
    const t2 = logRegels('rv_wezen_geteld')[0];
    eis('T2b en wordt als nog-gekoppeld gemeld, niet als wees',
        t2 && t2.rvHer === 0 && t2.rvOnb === 1, 'rvHer=0, rvOnb=1',
        t2 ? ('rvHer=' + t2.rvHer + ', rvOnb=' + t2.rvOnb) : 'GEEN REGEL');

    // De V5-emmer mag in een ANDER dagdeel of onder een ANDERE richting staan:
    // de koppeling is per node, niet per emmer.
    wisTest(); opnieuw();
    const anderDd = Object.keys(DD).find(d => d !== DD_NU);
    zet('sl_v5_' + NODE + '_Z_O_' + anderDd, JSON.stringify([v5(38, 9)]));
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(38, 3, { rv: 1 })]));
    migratieRvWezen();
    eis('T2c ook een V5-record in een ander dagdeel of andere richting telt als koppeling',
        lees(NODE, DD_NU)[0].rv === 1, 'rv=1', String(lees(NODE, DD_NU)[0].rv));

    // ══ T3 — rvK: NIET VAN ONS ════════════════════════════════
    // Records met rvK zijn ná release 1 gestempeld; herstelRvVoorMerge handelt
    // die bij een samenvoeging exact af. De migratie blijft eraf, ook als er
    // geen V5-emmer meer is.
    wisTest(); opnieuw();
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(38, 3, { rv: 1, rvK: 'N_W' })]));
    migratieRvWezen();
    const naT3 = lees(NODE, DD_NU);
    eis('T3 een record met rvK blijft volledig ongemoeid',
        naT3[0].rv === 1 && naT3[0].rvK === 'N_W',
        'rv=1, rvK=N_W', 'rv=' + naT3[0].rv + ', rvK=' + naT3[0].rvK);
    const t3 = logRegels('rv_wezen_geteld')[0];
    eis('T3b en wordt apart geteld, niet als wees',
        t3 && t3.rvExact === 1 && t3.rvHer === 0, 'rvExact=1, rvHer=0',
        t3 ? ('rvExact=' + t3.rvExact + ', rvHer=' + t3.rvHer) : 'GEEN REGEL');

    // ══ T4 — DATA ZONDER rv BLIJFT ONGEWIJZIGD ════════════════
    wisTest(); opnieuw();
    const oud = [v4(60, 8), v4(45, 9), v4(30, 12)];
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(oud));
    const pctOud = berekenLeerPct(NODE);
    migratieRvWezen();
    eis('T4 records zonder rv-veld worden niet aangeraakt',
        localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) === JSON.stringify(oud)
        && berekenLeerPct(NODE) === pctOud,
        'byte-identiek, percentage gelijk',
        berekenLeerPct(NODE) === pctOud ? 'ongewijzigd' : 'percentage veranderd');
    eis('T4b en er wordt geen herstelregel gelogd als er niets te doen is',
        logRegels('rv_wezen_hersteld').length === 0,
        '0 regels', logRegels('rv_wezen_hersteld').length + ' regels');

    // ══ T5 — PER NODE BEOORDEELD, NIET GLOBAAL ════════════════
    // Node A heeft geen V5-emmer meer (wees), node B nog wel (geen wees). De
    // duur is op beide 38: werd de koppeling globaal gezocht in plaats van per
    // node, dan zou A ten onrechte blijven staan.
    wisTest(); opnieuw();
    zet('sl_v4_' + NODE + '_' + DD_NU,   JSON.stringify([v4(38, 3, { rv: 1 })]));
    zet('sl_v4_' + NODE_B + '_' + DD_NU, JSON.stringify([v4(38, 3, { rv: 1 })]));
    zet('sl_v5_' + NODE_B + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3)]));
    migratieRvWezen();
    eis('T5 de node zonder V5 wordt hersteld, de node met V5 niet',
        lees(NODE, DD_NU)[0].rv === undefined && lees(NODE_B, DD_NU)[0].rv === 1,
        'A hersteld, B gestempeld',
        'A rv=' + lees(NODE, DD_NU)[0].rv + ', B rv=' + lees(NODE_B, DD_NU)[0].rv);
    const t5 = logRegels('rv_wezen_geteld')[0];
    eis('T5b de telling klopt: 1 wees, 1 nog-gekoppeld',
        t5 && t5.rvHer === 1 && t5.rvOnb === 1, 'rvHer=1, rvOnb=1',
        t5 ? ('rvHer=' + t5.rvHer + ', rvOnb=' + t5.rvOnb) : 'GEEN REGEL');
    const t5h = logRegels('rv_wezen_hersteld')[0];
    eis('T5c en de herstelregel meldt hetzelfde aantal',
        t5h && t5h.rvHer === 1, 'rvHer=1', t5h ? ('rvHer=' + t5h.rvHer) : 'GEEN REGEL');

    // ══ T6 — EENMALIG: DE VLAG HOUDT HEM TEGEN ════════════════
    wisTest(); opnieuw();
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(38, 3, { rv: 1 })]));
    migratieRvWezen();
    eis('T6 de eerste keer herstelt hij en zet de vlag',
        lees(NODE, DD_NU)[0].rv === undefined && localStorage.getItem('sl_rvwees_v1') === 'done',
        'hersteld, vlag done',
        'rv=' + lees(NODE, DD_NU)[0].rv + ', vlag=' + localStorage.getItem('sl_rvwees_v1'));

    // Een NIEUW gestempeld record wordt niet meer aangeraakt zolang de vlag
    // staat — dit is een eenmalige reparatie, geen doorlopend mechanisme.
    zet('sl_opslaglog', null);
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(41, 2, { rv: 1 })]));
    migratieRvWezen();
    eis('T6b met de vlag gezet doet een tweede aanroep helemaal niets',
        lees(NODE, DD_NU)[0].rv === 1 && logRegels('rv_wezen_geteld').length === 0,
        'rv=1, geen nieuwe telling',
        'rv=' + lees(NODE, DD_NU)[0].rv + ', ' + logRegels('rv_wezen_geteld').length + ' tellingen');

    // En zonder vlag is hij idempotent: op al herstelde data vindt hij niets.
    opnieuw();
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(38, 3)]));
    migratieRvWezen();
    eis('T6c op al herstelde data vindt hij niets en verandert hij niets',
        lees(NODE, DD_NU)[0].rv === undefined
        && (logRegels('rv_wezen_geteld')[0] || {}).rvHer === 0,
        '0 wezen', String((logRegels('rv_wezen_geteld')[0] || {}).rvHer));

    // ══ T7 — EEN MISLUKTE SCHRIJFACTIE SLUIT DE DEUR NIET ═════
    // De opslag kan vol zitten. Dan moet de telling er tóch al staan (pas 1
    // logt vóór pas 2 schrijft) en moet de vlag ONgezet blijven, zodat de
    // volgende start het opnieuw probeert. Hieronder laat ik alleen de
    // schrijfactie op de V4-emmer falen; het log blijft gewoon werken.
    wisTest(); opnieuw();
    const stukKey = 'sl_v4_' + NODE + '_' + DD_NU;
    zet(stukKey, JSON.stringify([v4(38, 3, { rv: 1 })]));
    Storage.prototype.setItem = function (k, v) {
      if (k === stukKey) throw new Error('QuotaExceededError (nagebootst)');
      return echteSetItem.call(this, k, v);
    };
    try { migratieRvWezen(); } finally { Storage.prototype.setItem = echteSetItem; }
    const t7 = logRegels('rv_wezen_geteld')[0];
    eis('T7 de telling staat er ook als het schrijven mislukt',
        t7 && t7.rvHer === 1, 'rvHer=1',
        t7 ? ('rvHer=' + t7.rvHer) : 'GEEN REGEL - telling kwam na het schrijven');
    eis('T7b de vlag blijft ongezet, dus de volgende start probeert het opnieuw',
        localStorage.getItem('sl_rvwees_v1') !== 'done',
        'geen done', String(localStorage.getItem('sl_rvwees_v1')));
    eis('T7c het record houdt zijn stempel; er gaat niets half verloren',
        lees(NODE, DD_NU).length === 1 && lees(NODE, DD_NU)[0].rv === 1
        && lees(NODE, DD_NU)[0].duur === 38,
        '1 record, rv=1, duur=38', JSON.stringify(lees(NODE, DD_NU)));
    eis('T7d en er wordt geen herstel gemeld dat niet gebeurd is',
        logRegels('rv_wezen_hersteld').length === 0,
        '0 herstelregels', logRegels('rv_wezen_hersteld').length + ' regels');

    // ══ T8 — VREEMDE VORMEN LATEN DE MIGRATIE NIET STRUIKELEN ══
    wisTest(); opnieuw();
    zet('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      null,                              // gat in de rij
      v4(38, 3, { rv: 1 }),              // echte wees
      { rv: 1, tijd: nu - 4 * 3600000 }, // rv zonder duur: vorm onbekend
      v4(52, 5)
    ]));
    zet('sl_v5_' + NODE + '_N_W_' + DD_NU, 'dit is geen json');
    let stuk = false;
    try { migratieRvWezen(); } catch (e) { stuk = true; }
    const naT8 = lees(NODE, DD_NU);
    eis('T8 kapotte JSON en lege plekken breken de migratie niet',
        !stuk && naT8.length === 4 && naT8[0] === null,
        'geen fout, 4 posities', stuk ? 'wierp een fout' : (naT8.length + ' posities'));
    eis('T8b de wees is hersteld, het record zonder duur blijft gestempeld',
        naT8[1].rv === undefined && naT8[2].rv === 1,
        'wees hersteld, duurloze met rust',
        'wees rv=' + naT8[1].rv + ', duurloze rv=' + naT8[2].rv);
    const t8 = logRegels('rv_wezen_geteld')[0];
    eis('T8c het duurloze record telt als onbeslist, niet als wees',
        t8 && t8.rvHer === 1 && t8.rvOnb === 1, 'rvHer=1, rvOnb=1',
        t8 ? ('rvHer=' + t8.rvHer + ', rvOnb=' + t8.rvOnb) : 'GEEN REGEL');

  } finally {
    Storage.prototype.setItem = echteSetItem;
    for (const [k, v] of snapshot) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRvWezen = testRvWezen;
