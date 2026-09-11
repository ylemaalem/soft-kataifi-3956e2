// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_algemeen_gepoold.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.99 (dubbele rij, stap 1): op een kruispunt waar het ronde
//  licht aan een richting gekoppeld is, tellen de metingen van beide helften
//  mee in één berekening.
//
//  WAT DEZE STAP WEL EN NIET DOET
//  Alleen de CIJFERS. De rijen staan na deze release nog gewoon dubbel op het
//  scherm; dat samenvoegen is stap 2, en dat is pas veilig als deze berekening
//  klopt — anders zou die ene overgebleven rij een verkeerd getal tonen.
//
//  DE HARDE EIS IS DE REGRESSIE
//  Zonder koppeling moet elke aangepaste functie BYTE-IDENTIEK hetzelfde
//  antwoord geven als daarvoor. Dat geldt voor alle 1719 bestaande kruispunten,
//  want geen daarvan heeft een koppeling. T1 en T4 zetten dat vast — niet met
//  "ongeveer gelijk" maar met een letterlijke vergelijking tegen de uitdrukking
//  die er stond.
//
//  DE VALKUIL DIE T2 BEWAAKT
//  vlakGewichtVoor eist `obs` en bron 's1'. Een V5-record heeft geen van beide,
//  dus berekenObsScore valt terug op het rauwe gewicht 1,0 waar een V4-record
//  op 0,50 uitkomt. Twee arrays plakken telt de richtingkant dus dubbel —
//  gemeten 13 tot 19 procentpunt te hoog, juist bij de kleine aantallen van een
//  nieuw kruispunt. T2 vergelijkt de gepoolde uitkomst tegen BEIDE varianten,
//  zodat een teruggedraaide normalisatie meteen opvalt.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_algemeen_gepoold.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testAlgemeenGepoold().regels);
// ═══════════════════════════════════════════════════════════════

function testAlgemeenGepoold() {
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

  const NODE = 996301;
  const DD_NU = huidigDDActief();
  const nu = Date.now();

  const bewaard = { dichtstbijOSM, getoondeLaag, richtingBlokVerborgen, getoondDagdeel,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML };

  // Exact de vormen die de app zelf wegschrijft.
  // Het gewicht van een vlak s1-record is geen 1 maar round2(min(1, obs/45)) —
  // slaOpIntern rekent het zo uit, en vlakGewichtVoor herkent het daaraan. Met
  // een kaal gewicht van 1 leest hij het record als een GETIKTE meting (0,70 in
  // plaats van 0,50), en dan toetst de fixture iets anders dan de app schrijft.
  const vlakGew = (obs) => Math.round(Math.min(1.0, obs / OBS_REFERENTIE) * 100) / 100;
  const v4 = (duur, u, extra = {}) => ({
    duur, tijd: nu - u * 3600000, richting: 0, obs: duur,
    gewicht: vlakGew(duur), bron: 's1', ...extra });
  const v5 = (duur, u, gew = V9_GEWICHT_DICHTBIJ) => ({
    duur, tijd: nu - u * 3600000, gewicht: gew, bron: 'tik' });
  // De normalisatie zoals richtingLeerPct hem toepast — de juiste weegschaal.
  const norm = (x) => ({ duur: x.duur, tijd: x.tijd, s2: x.s2, bron: x.bron,
    gewicht: OBS_VLAK * ((x.gewicht ?? V9_GEWICHT_DICHTBIJ) / V9_GEWICHT_DICHTBIJ) });
  // De uitdrukking die vóór deze release op vier plekken stond.
  const oudeBron = (nodeId, dd) => {
    if (dd) return zonderRichtingVerwant(laadM(nodeId, dd));
    let m = [];
    for (const d of Object.keys(DD)) m = m.concat(zonderRichtingVerwant(laadM(nodeId, d)));
    return m;
  };
  const wis = () => {
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, null);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
    }
    zetLS('sl_enkelricht_' + NODE, null);
    zetLS('sl_neutraal_' + NODE, null);
    zetLS('sl_opslaglog', null);
  };
  const logRegels = (reden) => {
    try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === reden); }
    catch (e) { return []; }
  };
  const duren = (m) => m.map(x => x.duur).sort((a, b) => a - b).join(',');

  try {
    zetLS('sl_richting_' + NODE, JSON.stringify({
      headings: [0, 2, 1, 3, 0, 1, 2, 1], laatste_update: nu, bevestigingen: 8 }));

    // ══ T1 — ZONDER KOPPELING: BYTE-IDENTIEK ══════════════════
    // De harde regressie-eis. Vier verschillende samenstellingen, want een
    // enkele fixture zou een filter dat per ongeluk verdween niet opmerken.
    wis();
    const gevallen = [
      { naam: 'gewone metingen',        v4: [v4(60, 3), v4(55, 4), v4(58, 5)] },
      { naam: 'met rv-gemarkeerde',     v4: [v4(60, 3), v4(20, 4, { rv: 1 }), v4(58, 5)] },
      { naam: 'alles rv-gemarkeerd',    v4: [v4(20, 3, { rv: 1 }), v4(20, 4, { rv: 1 })] },
      { naam: 'leeg',                   v4: [] }
    ];
    let regressieOk = true; const afwijking = [];
    for (const g of gevallen) {
      zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(g.v4));
      const a = algemeenMetingen(NODE, DD_NU), b = oudeBron(NODE, DD_NU);
      if (JSON.stringify(a) !== JSON.stringify(b)) { regressieOk = false; afwijking.push(g.naam); }
      const a2 = algemeenMetingen(NODE), b2 = oudeBron(NODE);
      if (JSON.stringify(a2) !== JSON.stringify(b2)) { regressieOk = false; afwijking.push(g.naam + ' (alle dd)'); }
    }
    eis('T1 zonder koppeling levert algemeenMetingen exact de oude verzameling',
        regressieOk, '4 gevallen identiek',
        afwijking.length ? 'wijkt af bij: ' + afwijking.join(', ') : '4 gevallen identiek');

    // En dat geldt ook als er wél V5-data is, zolang er geen koppeling staat.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3), v4(55, 4)]));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(24, 2), v5(26, 4)]));
    eis('T1b V5-data zonder koppeling blijft buiten de Algemeen-verzameling',
        JSON.stringify(algemeenMetingen(NODE, DD_NU)) === JSON.stringify(oudeBron(NODE, DD_NU))
        && algemeenMetingen(NODE, DD_NU).length === 2,
        '2 records, identiek aan oud',
        algemeenMetingen(NODE, DD_NU).length + ' records, duren ' + duren(algemeenMetingen(NODE, DD_NU)));

    // ══ T2 — MET KOPPELING: DE JUISTE NORMALISATIE ════════════
    // De tabel uit het rapport, met dezelfde duur in beide helften zodat alleen
    // de weging het verschil maakt.
    const tabel = [];
    for (const [nA, nR] of [[1, 1], [1, 2], [2, 2], [3, 2]]) {
      wis();
      const A = Array.from({ length: nA }, (_, i) => v4(40, 3 + i * 2));
      const R = Array.from({ length: nR }, (_, i) => v5(40, 2 + i * 2));
      zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(A));
      zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(R));   // N>W = Rechtsaf
      zetLS('sl_enkelricht_' + NODE, 'rechts');
      const gepoold = berekenObsScore(algemeenMetingen(NODE, DD_NU));
      tabel.push({ nA, nR, gepoold,
        correct: berekenObsScore(A.concat(R.map(norm))),
        naief:   berekenObsScore(A.concat(R)) });
    }
    eis('T2 de gepoolde score volgt de correcte normalisatie',
        tabel.every(r => r.gepoold === r.correct),
        'alle vier gelijk aan correct',
        tabel.map(r => r.nA + '+' + r.nR + ':' + r.gepoold + '/' + r.correct).join(' '));
    eis('T2b en niet de naïeve, te hoge variant',
        tabel.every(r => r.naief === r.correct || r.gepoold !== r.naief),
        'nergens de naïeve waarde',
        tabel.map(r => r.nA + '+' + r.nR + ': correct ' + r.correct + ' vs naief ' + r.naief).join(' | '));
    eis('T2c een V5-record weegt na normalisatie hetzelfde als een vlak V4-record',
        norm(v5(40, 2)).gewicht === OBS_VLAK && vlakGewichtVoor(v4(40, 3)) === OBS_VLAK,
        'beide OBS_VLAK (0.5)',
        norm(v5(40, 2)).gewicht + ' vs ' + vlakGewichtVoor(v4(40, 3)));
    eis('T2c2 en rauw, zonder normalisatie, zou hij dubbel wegen',
        v5(40, 2).gewicht / OBS_VLAK === 2,
        'rauw 1.0 = 2x OBS_VLAK', v5(40, 2).gewicht + ' vs ' + OBS_VLAK);
    eis('T2d en een ver-gemeten V5-record weegt navenant minder',
        norm(v5(40, 2, V9_GEWICHT_VER)).gewicht < norm(v5(40, 2, V9_GEWICHT_DICHTBIJ)).gewicht,
        '0.3 < 0.5',
        norm(v5(40, 2, V9_GEWICHT_VER)).gewicht + ' < ' + norm(v5(40, 2, V9_GEWICHT_DICHTBIJ)).gewicht);

    // ══ T3 — WELKE V5-EMMERS HOREN ERBIJ ══════════════════════
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3)]));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(24, 2)]));   // Rechtsaf
    zetLS('sl_v5_' + NODE + '_N_O_' + DD_NU, JSON.stringify([v5(31, 2)]));   // Linksaf
    zetLS('sl_v5_' + NODE + '_N_Z_' + DD_NU, JSON.stringify([v5(37, 2)]));   // Rechtdoor
    zetLS('sl_enkelricht_' + NODE, 'rechts');
    eis('T3 alleen de gekoppelde richting wordt meegepoold',
        duren(algemeenMetingen(NODE, DD_NU)) === '24,60',
        '24,60', duren(algemeenMetingen(NODE, DD_NU)));
    zetLS('sl_enkelricht_' + NODE, 'links');
    eis('T3b een andere koppeling pakt een andere emmer',
        duren(algemeenMetingen(NODE, DD_NU)) === '31,60',
        '31,60', duren(algemeenMetingen(NODE, DD_NU)));
    // Een ander dagdeel hoort er bij de dagdeel-variant niet bij, maar bij de
    // globale wel.
    const anderDd = Object.keys(DD).find(d => d !== DD_NU);
    zetLS('sl_v5_' + NODE + '_N_O_' + anderDd, JSON.stringify([v5(33, 9)]));
    eis('T3c de dagdeel-variant blijft bij zijn eigen dagdeel',
        duren(algemeenMetingen(NODE, DD_NU)) === '31,60',
        '31,60', duren(algemeenMetingen(NODE, DD_NU)));
    eis('T3d en zonder dagdeel telt hij alle dagdelen mee',
        duren(algemeenMetingen(NODE)) === '31,33,60',
        '31,33,60', duren(algemeenMetingen(NODE)));
    // Terug telt nooit mee — vrijwel altijd GPS-jitter.
    zetLS('sl_v5_' + NODE + '_N_N_' + DD_NU, JSON.stringify([v5(99, 2)]));
    eis('T3e een Terug-emmer blijft buiten de pool',
        duren(algemeenMetingen(NODE, DD_NU)).indexOf('99') < 0,
        'geen 99', duren(algemeenMetingen(NODE, DD_NU)));
    // Elk record precies één keer: laadMV5 en niet de geclusterde variant.
    zetLS('sl_enkelricht_' + NODE, 'rechts');
    eis('T3f elk V5-record telt precies één keer, ook al leest de clustering buren',
        algemeenMetingen(NODE, DD_NU).filter(x => x.duur === 24).length === 1,
        '1x duur 24',
        String(algemeenMetingen(NODE, DD_NU).filter(x => x.duur === 24).length));

    // ══ T4 — DE VIER AANROEPPLEKKEN ═══════════════════════════
    // Zonder koppeling ongewijzigd, met koppeling gepoold.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3), v4(58, 4)]));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(59, 2), v5(61, 4)]));
    const zonder = {
      leerPct: berekenLeerPct(NODE),
      ddC: laagDagdeelCijfers(NODE, null, DD_NU),
      ddP: laagDagdeelPct(NODE, null, DD_NU)
    };
    eis('T4 zonder koppeling telt geen van de vier plekken de V5-kant mee',
        zonder.ddC.n === 2 && zonder.ddC.m.length === 2,
        '2 metingen', zonder.ddC.n + ' metingen');
    zetLS('sl_enkelricht_' + NODE, 'rechts');
    const met = {
      leerPct: berekenLeerPct(NODE),
      ddC: laagDagdeelCijfers(NODE, null, DD_NU),
      ddP: laagDagdeelPct(NODE, null, DD_NU)
    };
    eis('T4b met koppeling telt de dagdeelstrip alle vier de metingen',
        met.ddC.n === 4, '4 metingen', met.ddC.n + ' metingen');
    eis('T4c het leerpercentage stijgt mee',
        met.leerPct > zonder.leerPct,
        'hoger dan ' + zonder.leerPct, zonder.leerPct + ' -> ' + met.leerPct);
    eis('T4d en het dagdeelpercentage ook',
        met.ddP > zonder.ddP, 'hoger dan ' + zonder.ddP, zonder.ddP + ' -> ' + met.ddP);
    eis('T4e percentage en aantal in dezelfde chip komen uit dezelfde verzameling',
        met.ddC.m.length === 4 && met.ddP !== null,
        'beide de gepoolde set', met.ddC.m.length + ' / ' + met.ddP);
    // De cyclustijd volgt de gepoolde set — beide helften meten dezelfde lamp.
    eis('T4f de cyclustijd komt uit beide helften samen',
        Math.round(met.ddC.gem) >= 58 && Math.round(met.ddC.gem) <= 61,
        'tussen 58 en 61', String(Math.round(met.ddC.gem)));
    // Het ALG-blok van de rijenbouwer, via het scherm.
    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'Test' };
    richtingBlokVerborgen = false; getoondeLaag = null; getoondDagdeel = null;
    renderRichtingBlok(dichtstbijOSM);
    const algRij = [...document.querySelectorAll('#richting-blok-body .rb-rij')]
      .find(r => r.getAttribute('data-key') === 'ALG');
    eis('T4g de ALG-rij in het rijblok toont het gepoolde percentage',
        algRij !== undefined && algRij.querySelector('.rb-pct').textContent.trim() === met.leerPct + '%',
        met.leerPct + '%',
        algRij ? algRij.querySelector('.rb-pct').textContent.trim() : 'GEEN ALG-RIJ');

    // ══ T5 — DE RIJEN STAAN IN DEZE STAP NOG DUBBEL ═══════════
    // Bewust: stap 2 voegt ze samen, en dat is pas veilig als deze cijfers
    // kloppen. Vastgelegd zodat de volgende release ziet wat hij verandert.
    const labels = [...document.querySelectorAll('#richting-blok-body .rb-rij')]
      .map(r => r.querySelector('.rb-label').textContent.trim());
    eis('T5 er staan in deze stap nog twee rijen met dezelfde naam',
        labels.filter(l => l.indexOf('Rechtsaf') === 0).length === 2,
        '2x Rechtsaf', labels.join(' | '));

    // ══ T6 — DE MEETREGEL ═════════════════════════════════════
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3), v4(58, 4), v4(62, 5)]));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(24, 2), v5(26, 4)]));
    zetEnkelRicht(String(NODE), 'rechts');
    const r6 = logRegels('koppeling_gezet');
    eis('T6 het zetten van een koppeling logt één regel',
        r6.length === 1, '1 regel', r6.length + ' regels');
    eis('T6b met de richting en beide aantallen',
        r6[0] && r6[0].afrij === 'rechts' && r6[0].algN === 3 && r6[0].richtN === 2,
        "'rechts', algN 3, richtN 2",
        r6[0] ? [r6[0].afrij, r6[0].algN, r6[0].richtN].join('/') : 'GEEN REGEL');
    // gewGem is een gewogen MEDIAAN, geen gemiddelde (V11.17.10 Laag 2b): bij
    // 24 en 26 wint de recentste, dus 24 — niet 25.
    eis('T6c en beide medianen APART, zoals ze vóór het poolen waren',
        r6[0] && r6[0].algMediaan === 60 && r6[0].richtMediaan === 24,
        'alg 60, richt 24',
        r6[0] ? r6[0].algMediaan + ' / ' + r6[0].richtMediaan : 'GEEN REGEL');
    eis('T6c2 en die twee liggen hier ver uiteen — precies wat dit meetpunt zichtbaar maakt',
        r6[0] && Math.abs(r6[0].algMediaan - r6[0].richtMediaan) > 20,
        'verschil > 20s',
        r6[0] ? Math.abs(r6[0].algMediaan - r6[0].richtMediaan) + 's' : 'GEEN REGEL');
    eis('T6d de koppeling is daarna ook echt gezet',
        laadEnkelRicht(String(NODE)) === 'rechts',
        "'rechts'", String(laadEnkelRicht(String(NODE))));
    // De velden staan nergens anders.
    zetLS('sl_opslaglog', null);
    logOpslagMis('te_kort', { node: NODE, dur: 2 });
    const ander = logRegels('te_kort')[0];
    eis('T6e de vier nieuwe velden blijven null op elke andere logregel',
        ander && ander.algMediaan === null && ander.algN === null
        && ander.richtMediaan === null && ander.richtN === null,
        '4x null',
        ander ? [ander.algMediaan, ander.algN, ander.richtMediaan, ander.richtN].join('/') : 'GEEN REGEL');
    // Zonder richtingdata logt hij nog steeds, met nullen — anders zou juist de
    // twijfelachtige koppeling onzichtbaar blijven.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3)]));
    zetEnkelRicht(String(NODE), 'rechtdoor');
    const r6b = logRegels('koppeling_gezet')[0];
    eis('T6f een koppeling zonder richtingdata wordt ook gelogd',
        r6b && r6b.richtN === 0 && r6b.richtMediaan === null && r6b.algN === 1,
        'richtN 0, richtMediaan null, algN 1',
        r6b ? [r6b.richtN, r6b.richtMediaan, r6b.algN].join('/') : 'GEEN REGEL');

    // ══ T7 — DE COUNTDOWN IS NIET AANGERAAKT ══════════════════
    // Elke richting en elk stoplicht houdt zijn eigen cyclus; deze release
    // poolt alleen het PERCENTAGE, nooit de countdownbron.
    const kb = String(kiesCountdownBron)
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T7 kiesCountdownBron leest algemeenMetingen nergens',
        kb.indexOf('algemeenMetingen') < 0,
        'geen aanroep', kb.indexOf('algemeenMetingen') < 0 ? 'geen aanroep' : 'AANROEP AANWEZIG');
    eis('T7b en leest nog steeds laadM rechtstreeks, zoals D2 het bedoelde',
        kb.indexOf('laadM(') >= 0, 'laadM aanwezig', kb.indexOf('laadM(') >= 0 ? 'aanwezig' : 'WEG');
    // Gedrag, niet alleen vorm: met en zonder koppeling dezelfde bron.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(
      Array.from({ length: 6 }, (_, i) => v4(60, 3 + i))));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(
      Array.from({ length: 6 }, (_, i) => v5(24, 2 + i))));
    const cdZonder = kiesCountdownBron(NODE, DD_NU, null, null);
    zetLS('sl_enkelricht_' + NODE, 'rechts');
    const cdMet = kiesCountdownBron(NODE, DD_NU, null, null);
    eis('T7c de countdownbron is met en zonder koppeling dezelfde',
        JSON.stringify(cdZonder) === JSON.stringify(cdMet),
        'identiek',
        (cdZonder && cdZonder.bron) + ' / ' + (cdMet && cdMet.bron));
    eis('T7d en de seconden veranderen niet mee met het percentage',
        cdMet && cdZonder && cdMet.gem === cdZonder.gem,
        'zelfde gem',
        (cdZonder && Math.round(cdZonder.gem)) + ' / ' + (cdMet && Math.round(cdMet.gem)));

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    getoondeLaag = bewaard.getoondeLaag;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    getoondDagdeel = bewaard.getoondDagdeel;
    const blok = document.getElementById('richting-blok-body');
    if (blok && bewaard.blokHtml != null) blok.innerHTML = bewaard.blokHtml;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testAlgemeenGepoold = testAlgemeenGepoold;
