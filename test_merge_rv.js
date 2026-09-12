// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_merge_rv.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.91: samenvoegen met Algemeen laat de metingen weer
//  meetellen.
//
//  WAT ER MIS WAS
//  mergeRichtingen verwijderde de V5-bron met de aantekening "verliesloos,
//  metingen staan al in V4". Dat klopte toen V11.16.2 het bouwde. Sinds D2
//  (V11.17.85) dragen die V4-kopieën rv:1, en de drie plekken die het
//  Algemeen-percentage berekenen slaan rv===1 over. Na een samenvoeging telden
//  die metingen dus nergens meer: niet in de richting (V5 weg), niet in
//  Algemeen (rv:1 overgeslagen).
//
//  T1 IS DE KERN, MAAR T2 IS DE GEVAARLIJKSTE
//  Te weinig ontstempelen laat metingen in het niemandsland staan — dat is de
//  bug. Te véél ontstempelen haalt het stempel van een ANDERE richting weg, en
//  die meting telt dan in twee categorieën tegelijk. T2 en T5 bewaken die kant.
//
//  WAAROM ER TWEE KOPPELINGEN ZIJN
//  Sinds deze release schrijft het stempel de richting erbij (rvK), dus een
//  record wijst zelf aan waar het bij hoort. Records die tussen D2 en nu
//  gestempeld zijn hebben dat niet; daarvoor is er een terugval op de duur, die
//  alleen toeslaat als het antwoord eenduidig is. T3 en T4 toetsen die twee
//  paden apart, T6 dat de terugval zich inhoudt bij twijfel.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_merge_rv.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testMergeRv().regels);
// ═══════════════════════════════════════════════════════════════

function testMergeRv() {
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
  const NODE = 996001;
  const DD_NU = huidigDDActief();
  const nu = Date.now();

  const bewaard = {
    nodeInfoNodeId, mergeModusAan, mergeSelectie: [...mergeSelectie],
    mergeUndoBuffer, nodeInfoChipLaatsteNode
  };

  // Een V4-record zoals slaOpIntern het schrijft, met optionele rv/rvK.
  const v4 = (duur, offsetU, extra = {}) => ({
    duur, tijd: nu - offsetU * 3600000, richting: 0, obs: duur,
    gewicht: 1, bron: 's1', ...extra
  });
  // Een V5-record zoals slaOpV5 het schrijft.
  const v5 = (duur, offsetU) => ({ duur, tijd: nu - offsetU * 3600000, gewicht: 1, bron: 'tik' });

  const leesV4 = (dd) => { try { return JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + dd)) || []; }
                           catch (e) { return []; } };
  const logRegels = (reden) => { try {
    return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === reden);
  } catch (e) { return []; } };
  const wis = () => {
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, null);
    // Eerst een momentopname van de sleutels, dan pas wissen. localStorage.key(i)
    // leest een LIVE index: verwijder je tijdens de lus, dan schuift alles op en
    // sla je de helft over. Met twee V5-sleutels op deze node bleef er daardoor
    // eentje staan, en die lekte in een latere toets mee — hij viel pas op toen
    // de klok in een ander dagdeel stond en de overblijvende sleutel toevallig
    // wél meetelde. Gemeten: test_richting_pct T6b gaf 76% waar 67% hoorde.
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
    }
    zetLS('sl_opslaglog', null);
    mergeUndoBuffer = null; mergeModusAan = false; mergeSelectie = [];
    nodeInfoNodeId = String(NODE);
  };

  try {
    // ══ T1 — DE KERN: exact herstel via rvK ═══════════════════
    wis();
    // Twee getikte metingen op N>W, met hun V4-tweelingen (rv + rvK).
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3), v5(35, 1)]));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      v4(38, 3, { rv: 1, rvK: 'N_W' }),
      v4(35, 1, { rv: 1, rvK: 'N_W' }),
      v4(52, 5)                                   // gewone Algemeen-meting, geen rv
    ]));
    const pctVoor = berekenLeerPct(NODE);
    mergeRichtingen(NODE, { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN');
    const naV4 = leesV4(DD_NU);
    eis('T1 de V5-bron is verwijderd',
        localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) === null,
        'weg', localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) === null ? 'weg' : 'staat er nog');
    eis('T1b de twee bijbehorende V4-records dragen geen rv meer',
        naV4.filter(x => x.rv === 1).length === 0 && naV4.length === 3,
        '0 gestempeld van 3', naV4.filter(x => x.rv === 1).length + ' gestempeld van ' + naV4.length);
    eis('T1c en ook geen rvK-restant',
        naV4.every(x => x.rvK === undefined), 'geen rvK',
        naV4.filter(x => x.rvK !== undefined).length + ' met rvK');
    const pctNa = berekenLeerPct(NODE);
    eis('T1d het Algemeen-percentage telt ze weer mee en is dus GESTEGEN',
        pctNa > pctVoor, 'hoger dan ' + pctVoor + '%', pctVoor + '% -> ' + pctNa + '%');

    // ══ T2 — EEN ANDERE RICHTING BLIJFT ONGEMOEID ═════════════
    wis();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3)]));
    zetLS('sl_v5_' + NODE + '_Z_O_' + DD_NU, JSON.stringify([v5(41, 2)]));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      v4(38, 3, { rv: 1, rvK: 'N_W' }),           // hoort bij de samengevoegde richting
      v4(41, 2, { rv: 1, rvK: 'Z_O' })            // hoort bij een ANDERE richting
    ]));
    mergeRichtingen(NODE, { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN');
    const naT2 = leesV4(DD_NU);
    const nwRec = naT2.find(x => Math.round(x.duur) === 38);
    const zoRec = naT2.find(x => Math.round(x.duur) === 41);
    eis('T2 het record van de samengevoegde richting is ontstempeld',
        nwRec && nwRec.rv === undefined, 'geen rv', nwRec ? String(nwRec.rv) : 'ONTBREEKT');
    eis('T2b het record van de ANDERE richting houdt zijn stempel',
        zoRec && zoRec.rv === 1 && zoRec.rvK === 'Z_O',
        'rv=1, rvK=Z_O', zoRec ? ('rv=' + zoRec.rv + ', rvK=' + zoRec.rvK) : 'ONTBREEKT');
    eis('T2c en de V5-emmer van die andere richting staat er nog',
        localStorage.getItem('sl_v5_' + NODE + '_Z_O_' + DD_NU) !== null,
        'intact', 'intact');

    // ══ T3 — OUDE DATA ZONDER rv BLIJFT ONGEWIJZIGD ═══════════
    wis();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3)]));
    const oudeSet = [v4(38, 3, { rv: 1, rvK: 'N_W' }), v4(60, 8), v4(45, 9)];
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(oudeSet));
    mergeRichtingen(NODE, { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN');
    const naT3 = leesV4(DD_NU);
    const onaangeraakt = naT3.filter(x => Math.round(x.duur) === 60 || Math.round(x.duur) === 45);
    eis('T3 records zonder rv-veld blijven letterlijk ongewijzigd',
        onaangeraakt.length === 2
        && onaangeraakt.every(x => x.rv === undefined && x.rvK === undefined
                                && x.gewicht === 1 && x.bron === 's1'),
        '2 records, geen velden aangeraakt',
        JSON.stringify(onaangeraakt.map(x => ({ duur: x.duur, rv: x.rv }))));

    // ══ T4 — DE TERUGVAL OP DUUR (records zonder rvK) ═════════
    wis();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(33, 4)]));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      v4(33, 4, { rv: 1 }),                       // gestempeld tussen D2 en nu: GEEN rvK
      v4(70, 6)
    ]));
    mergeRichtingen(NODE, { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN');
    const naT4 = leesV4(DD_NU);
    const t4rec = naT4.find(x => Math.round(x.duur) === 33);
    eis('T4 een record zonder rvK wordt op duur teruggevonden en ontstempeld',
        t4rec && t4rec.rv === undefined, 'geen rv', t4rec ? String(t4rec.rv) : 'ONTBREEKT');
    const t4log = logRegels('merge_rv_hersteld');
    eis('T4b en het meetpunt scheidt exact van terugval',
        t4log.length === 1 && t4log[0].rvHer === 1 && t4log[0].rvExact === 0,
        'rvHer=1, rvExact=0',
        t4log.length ? ('rvHer=' + t4log[0].rvHer + ', rvExact=' + t4log[0].rvExact) : 'GEEN REGEL');

    // ══ T5 — DE TERUGVAL HOUDT ZICH IN BIJ TWIJFEL ════════════
    // Twee gestempelde records zonder rvK met DEZELFDE duur: niet te zeggen
    // welke bij deze richting hoort. Dan wordt er niets aangeraakt.
    wis();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(40, 4)]));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      v4(40, 4, { rv: 1 }),
      v4(40, 7, { rv: 1 })
    ]));
    mergeRichtingen(NODE, { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN');
    const naT5 = leesV4(DD_NU);
    eis('T5 bij twee even goede kandidaten wordt er NIETS ontstempeld',
        naT5.filter(x => x.rv === 1).length === 2,
        'beide blijven gestempeld', naT5.filter(x => x.rv === 1).length + ' gestempeld');
    const t5log = logRegels('merge_rv_hersteld');
    eis('T5b en dat wordt als onbeslist gemeld, niet stilzwijgend overgeslagen',
        t5log.length === 1 && t5log[0].rvOnb === 1 && t5log[0].rvHer === 0,
        'rvOnb=1, rvHer=0',
        t5log.length ? ('rvOnb=' + t5log[0].rvOnb + ', rvHer=' + t5log[0].rvHer) : 'GEEN REGEL');

    // ══ T6 — IDEMPOTENT ═══════════════════════════════════════
    wis();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3)]));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(38, 3, { rv: 1, rvK: 'N_W' })]));
    const eerste = herstelRvVoorMerge(NODE, { aanrij: 'N', afrij: 'W' }, [v5(38, 3)]);
    const tweede = herstelRvVoorMerge(NODE, { aanrij: 'N', afrij: 'W' }, [v5(38, 3)]);
    eis('T6 een tweede aanroep herstelt niets meer en geeft geen fout',
        eerste.totaal === 1 && tweede.totaal === 0 && tweede.onbeslist === 0,
        'eerst 1, daarna 0', 'eerst ' + eerste.totaal + ', daarna ' + tweede.totaal);
    eis('T6b en het record blijft ontstempeld',
        leesV4(DD_NU).every(x => x.rv === undefined), 'geen rv', 'geen rv');

    // ══ T7 — DAGDEELOVERGANG: de tweeling in een ander dagdeel ═
    // slaOp schrijft bij een dagdeelovergang naar TWEE emmers terwijl V5 er
    // maar één kent. Beide V4-kopieën dragen dan rvK en moeten mee.
    wis();
    const anderDd = Object.keys(DD).find(d => d !== DD_NU);
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3)]));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(38, 3, { rv: 1, rvK: 'N_W' })]));
    zetLS('sl_v4_' + NODE + '_' + anderDd, JSON.stringify([v4(38, 3, { rv: 1, rvK: 'N_W' })]));
    mergeRichtingen(NODE, { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN');
    eis('T7 een tweeling in een ANDER dagdeel wordt ook ontstempeld',
        leesV4(DD_NU).every(x => x.rv === undefined)
        && leesV4(anderDd).every(x => x.rv === undefined),
        'beide dagdelen schoon',
        DD_NU + ': ' + leesV4(DD_NU).filter(x => x.rv === 1).length
          + ', ' + anderDd + ': ' + leesV4(anderDd).filter(x => x.rv === 1).length);

    // ══ T8 — RICHTING NAAR RICHTING IS ONGEWIJZIGD ════════════
    wis();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3)]));
    zetLS('sl_v5_' + NODE + '_Z_O_' + DD_NU, JSON.stringify([v5(41, 2)]));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      v4(38, 3, { rv: 1, rvK: 'N_W' }),
      v4(41, 2, { rv: 1, rvK: 'Z_O' })
    ]));
    mergeRichtingen(NODE, { aanrij: 'N', afrij: 'W' }, { aanrij: 'Z', afrij: 'O' });
    const naT8 = leesV4(DD_NU);
    eis('T8 bij richting-naar-richting blijft ELK stempel staan',
        naT8.filter(x => x.rv === 1).length === 2,
        'beide gestempeld', naT8.filter(x => x.rv === 1).length + ' gestempeld');
    eis('T8b de V5-emmers zijn samengevoegd zoals voorheen',
        localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) === null
        && (JSON.parse(localStorage.getItem('sl_v5_' + NODE + '_Z_O_' + DD_NU)) || []).length === 2,
        'bron weg, doel 2 metingen',
        'doel ' + ((JSON.parse(localStorage.getItem('sl_v5_' + NODE + '_Z_O_' + DD_NU)) || []).length));
    eis('T8c en er wordt geen merge_rv_hersteld gelogd op dat pad',
        logRegels('merge_rv_hersteld').length === 0, '0 regels',
        logRegels('merge_rv_hersteld').length + ' regels');

    // ══ T9 — ONGEDAAN MAKEN ZET OOK HET STEMPEL TERUG ═════════
    wis();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(38, 3)]));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(38, 3, { rv: 1, rvK: 'N_W' })]));
    mergeRichtingen(NODE, { aanrij: 'N', afrij: 'W' }, 'ALGEMEEN');
    eis('T9a na de merge is het stempel weg',
        leesV4(DD_NU).every(x => x.rv === undefined), 'geen rv', 'geen rv');
    mergeUndoUitvoeren();
    const naUndo = leesV4(DD_NU);
    eis('T9 ongedaan maken zet zowel de V5-bron als het rv-stempel terug',
        localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) !== null
        && naUndo.length === 1 && naUndo[0].rv === 1 && naUndo[0].rvK === 'N_W',
        'V5 terug, rv=1 terug',
        'V5 ' + (localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) !== null ? 'terug' : 'WEG')
          + ', rv=' + (naUndo[0] && naUndo[0].rv));

    // ══ T10 — HET STEMPEL SCHRIJFT DE RICHTING ERBIJ ══════════
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T10 stempelV4Richtingverwant legt de richting vast in rvK',
        /paarKey/.test(zc(stempelV4Richtingverwant)) && /rec\.rvK = paarKey/.test(zc(stempelV4Richtingverwant)),
        'rvK wordt gezet', 'gezet');
    // V11.18.5: deze toets pinde de letterlijke aanroeptekst
    //   stempelV4Richtingverwant(v9KandidaatNode, teStempelen,
    //                            aanrijRichting + '_' + afrijRichting)
    // Sinds V11.18.5 zijn er TWEE schrijvers: de vroege poort bij groen
    // (schrijfV5DirectBijGroen) en deze late keten. De late geeft nu
    // `v9KandidaatV5Paar || (aanrijRichting + '_' + afrijRichting)` mee, zodat
    // het stempel naar de emmer wijst die WERKELIJK geschreven is — valt
    // v9PreSelectieAfrij tussen groen en de passage weg, dan zou de oude tekst
    // een rvK van de GPS-richting stempelen en wijst herstelRvVoorMerge later
    // naar een emmer die niet bestaat.
    //
    // Wat bewaakt moet blijven is de EIS, niet de formulering: elke schrijver
    // geeft een paarsleutel mee, en die is van de vorm aanrij_afrij. Dat de
    // vroege poort dat ook werkelijk doet, toetst test_tik_direct T7b op data.
    const stempelAanroepen = (f) =>
      (zc(f).match(/stempelV4Richtingverwant\([^)]*\)/g) || []);
    const laat = stempelAanroepen(voerV9DelayedWriteUit);
    const vroeg = stempelAanroepen(schrijfV5DirectBijGroen);
    eis('T10b beide schrijvers geven een paarsleutel mee aan het stempel',
        laat.length === 1 && vroeg.length === 1
          && /aanrijRichting \+ '_' \+ afrijRichting/.test(laat[0])
          && /paar/.test(vroeg[0]),
        'late keten en vroege poort allebei met paarKey',
        'laat: ' + laat.length + ', vroeg: ' + vroeg.length);
    eis('T10d de late keten geeft voorrang aan de sleutel van de vroege poort',
        /v9KandidaatV5Paar \|\|/.test(laat[0]),
        'v9KandidaatV5Paar eerst', laat[0] || 'geen aanroep');
    eis('T10c herstelRvVoorMerge gebruikt GEEN tijdsvenster als criterium',
        !/tijd/.test(zc(herstelRvVoorMerge).replace(/bronMetingen|v5\.tijd/g, '')),
        'geen venster op tijd', 'alleen rvK en duur');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    nodeInfoNodeId = bewaard.nodeInfoNodeId;
    mergeModusAan = bewaard.mergeModusAan;
    mergeSelectie = bewaard.mergeSelectie;
    mergeUndoBuffer = bewaard.mergeUndoBuffer;
    nodeInfoChipLaatsteNode = bewaard.nodeInfoChipLaatsteNode;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testMergeRv = testMergeRv;
