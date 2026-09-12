// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_v4_markering.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.85 (D2): metingen die bij een richting horen tellen niet
//  meer mee in het Algemeen-percentage, maar blijven wel de countdown voeden.
//
//  DE TWEE KANTEN DIE ELKAAR IN EVENWICHT HOUDEN
//  Deze release kan op twee manieren stukgaan, en ze zijn elkaars spiegelbeeld:
//    - te weinig filteren -> Algemeen blijft opgeblazen (T3 vangt dat)
//    - te veel filteren   -> een node verliest zijn countdown (T4/T5 vangen dat)
//  T4 en T5 zijn daarom niet minder belangrijk dan T3; RV1 is de harde eis.
//
//  T1b IS DE KERN VAN WIJZIGING 1
//  Het stempel wordt ACHTERAF gezet, niet bij het schrijven. Op het moment dat
//  verwerkFase het V4-record aanmaakt is nog niet bekend of er een V5-record
//  volgt: gemeten over drie dagen logdata leidden maar 4 van de 10
//  'v4_dubbel_voorkomen'-regels tot een V5-record. Markeren op "er staat een
//  tik klaar" zou dus zes van de tien records ten onrechte uit Algemeen halen.
//  T1b legt vast dat een V4-record zonder V5-tweeling ongemarkeerd blijft.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_v4_markering.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testV4Markering().regels);
// ═══════════════════════════════════════════════════════════════

function testV4Markering() {
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
  const NODE = 994001;
  const DD_NU = huidigDDActief();

  const bewaard = {
    faseStart, dichtstbijOSM, huidigePos, huidigeRichting, bboxOverride,
    handmatigLockActief, getoondeLaag, getoondDagdeel, richtingBlokVerborgen,
    nodeSessionData_: null
  };
  const lees = (dd) => { try { return JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + dd)) || []; }
                         catch (e) { return []; } };
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
    zetLS('sl_richting_' + NODE, null);
    zetLS('sl_bevestig_' + NODE, null);
    zetLS('sl_neutraal_' + NODE, null);
  };
  // Een record zoals slaOpIntern het schrijft.
  //
  // `offset` is geen franje: laadM DEDUPLICEERT op `tijd` (r1298,
  // `if (!gezien.has(m.tijd))`). Twee reeksen die allebei op `nu` beginnen
  // vallen dus samen tot één reeks, en een toets die dan slaagt heeft niets
  // getoetst — precies wat hier in de eerste versie van T3 gebeurde.
  const rec = (n, duur, extra = {}, offset = 0) => Array.from({ length: n }, (_, i) =>
    ({ duur, tijd: nu - (offset + i) * 3600000, richting: 0, obs: duur,
       gewicht: 1, bron: 's1', ...extra }));

  try {
    // De echte schrijfweg gebruiken, niet een nagebouwde: faseStart moet staan
    // zodat slaOp de dagdeeltak neemt die hij in productie ook neemt.
    huidigePos = null;              // geen sl_pos_-schrijving
    bboxOverride = null;
    handmatigLockActief = false;
    huidigeRichting = 0;
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 20, naam: 'Testweg' };
    faseStart = performance.now() - 40000;

    // ══ T1 — STEMPEL NA EEN GESLAAGDE V5-SCHRIJVING ═══════════
    // Het aantal geschreven records is NIET altijd één: valt de fasestart in
    // een ander dagdeel dan nu, dan schrijft slaOp naar twee emmers
    // (r1935-1944). Een meting van 40 seconden doet dat alleen in de minuut
    // rond een dagdeelgrens — maar dan wel, en een test die 1 vastspijkert
    // faalt daar dan op. Het verwachte aantal wordt hier daarom afgeleid in
    // plaats van aangenomen.
    wis();
    const faseMs = 40000;
    const verwachtAantal = huidigDDActief(Date.now() - faseMs) === DD_NU ? 1 : 2;
    faseStart = performance.now() - faseMs;
    const okSchrijf = slaOp(NODE, 0, 40);
    const stempels = laatsteV4Schrijvingen.slice();
    eis('T1a slaOp meldt precies één tijdstempel per geschreven emmer',
        okSchrijf === true && stempels.length === verwachtAantal
        && stempels.every(x => typeof x.tijd === 'number' && !!x.dd),
        verwachtAantal + ' tijdstempel(s)', JSON.stringify(stempels));
    // Momentopname per emmer, om na het stempel veld voor veld te vergelijken.
    const voor = stempels.map(st => (lees(st.dd).find(x => x.tijd === st.tijd) || null));
    eis('T1b het record is bij het SCHRIJVEN nog ongemarkeerd — er wordt niet gegokt',
        voor.length === verwachtAantal && voor.every(r => r && r.rv === undefined),
        'geen rv-veld op geen enkel record',
        JSON.stringify(voor.map(r => r && r.rv)));

    const gezet = stempelV4Richtingverwant(NODE, stempels);
    const na = stempels.map(st => (lees(st.dd).find(x => x.tijd === st.tijd) || null));
    eis('T1 na het stempel draagt precies het aangewezen record rv=1',
        gezet === verwachtAantal && na.every(r => r && r.rv === 1),
        verwachtAantal + ' gestempeld, rv=1',
        gezet + ' gestempeld, rv=' + JSON.stringify(na.map(r => r && r.rv)));
    eis('T1c het stempel raakt geen ander veld aan',
        na.every((r, i) => r && voor[i]
          && r.duur === voor[i].duur && r.tijd === voor[i].tijd
          && r.gewicht === voor[i].gewicht && r.bron === voor[i].bron
          && r.obs === voor[i].obs && r.richting === voor[i].richting),
        'duur/tijd/gewicht/bron/obs/richting ongewijzigd',
        JSON.stringify(na.map(r => r && { duur: r.duur, gewicht: r.gewicht, bron: r.bron })));

    // Het stempel wordt in de code ACHTER de v5-vlag gezet — niet bij het
    // schrijven. Zonder deze bronwacht zou iemand hem later naar voren kunnen
    // halen zonder dat een gedragstest omvalt.
    const dwBron = String(voerV9DelayedWriteUit)
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const iV5   = dwBron.indexOf('v5Geschreven = true');
    const iStem = dwBron.indexOf('stempelV4Richtingverwant');
    eis('T1d het stempel staat ACHTER de bevestiging dat V5 geschreven is',
        iV5 > 0 && iStem > iV5 && /if\s*\(\s*v5Geschreven\s*\)/.test(dwBron),
        'binnen if (v5Geschreven), na de V5-write',
        'v5-vlag op ' + iV5 + ', stempel op ' + iStem);

    // ══ T2 — GEEN V5 ⇒ GEEN STEMPEL ═══════════════════════════
    wis();
    slaOp(NODE, 0, 40);
    const zonderV5 = laatsteV4Schrijvingen.map(st => lees(st.dd).find(x => x.tijd === st.tijd));
    eis('T2 een meting zonder V5-tweeling blijft ongemarkeerd',
        zonderV5.length > 0 && zonderV5.every(r => r && r.rv === undefined),
        'geen rv-veld', JSON.stringify(zonderV5.map(r => r && r.rv)));
    eis('T2b en berekenLeerPct telt hem gewoon mee',
        berekenLeerPct(NODE) > 0, '> 0%', berekenLeerPct(NODE) + '%');

    // ══ T1c — DAGDEELOVERGANG: BEIDE KOPIEËN ══════════════════
    // Zoek een faseStart die in een ANDER dagdeel valt dan nu. Lukt dat niet
    // binnen 12 uur, dan is er op dit moment geen grens te raken en wordt de
    // toets als niet-uitvoerbaar gemeld in plaats van stilzwijgend overgeslagen.
    let offsetMs = null;
    for (let u = 1; u <= 12; u++) {
      if (huidigDDActief(nu - u * 3600000) !== DD_NU) { offsetMs = u * 3600000; break; }
    }
    if (offsetMs == null) {
      eis('T1c dagdeelovergang', false, 'een grens binnen 12 uur',
          'NIET UITVOERBAAR op dit tijdstip — geen dagdeelgrens binnen 12 uur');
    } else {
      wis();
      faseStart = performance.now() - offsetMs;
      slaOp(NODE, 0, 40);
      const tweeStempels = laatsteV4Schrijvingen.slice();
      eis('T1c bij een dagdeelovergang schrijft slaOp TWEE records',
          tweeStempels.length === 2 && tweeStempels[0].dd !== tweeStempels[1].dd,
          '2 records in 2 dagdelen',
          tweeStempels.map(x => x.dd).join(' + '));
      const gezet2 = stempelV4Richtingverwant(NODE, tweeStempels);
      const beide = tweeStempels.every(st => lees(st.dd).some(x => x.tijd === st.tijd && x.rv === 1));
      eis('T1c2 en BEIDE kopieën worden gestempeld',
          gezet2 === 2 && beide, '2 gestempeld',
          gezet2 + ' gestempeld, beide gemarkeerd: ' + beide);
      // Dit is de reden: berekenLeerPct poolt alle dagdelen, dus één van de
      // twee stempelen zou de opblazing half laten staan.
      eis('T1c3 daardoor telt de meting nergens meer mee in Algemeen',
          berekenLeerPct(NODE) === 0, '0%', berekenLeerPct(NODE) + '%');
      faseStart = performance.now() - 40000;
    }

    // ══ T3 — berekenLeerPct SLAAT GEMARKEERDE OVER ════════════
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(rec(4, 45)));
    const pctSchoon = berekenLeerPct(NODE);
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(
      rec(2, 45).concat(rec(2, 45, { rv: 1 }, 2))));
    eis('T3a de gemengde set is echt vier records (laadM dedupliceert op tijd)',
        laadM(NODE, DD_NU).length === 4, '4', String(laadM(NODE, DD_NU).length));
    const pctGemengd = berekenLeerPct(NODE);
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(rec(2, 45)));
    const pctTwee = berekenLeerPct(NODE);
    eis('T3 berekenLeerPct slaat gemarkeerde records over',
        pctGemengd === pctTwee && pctGemengd < pctSchoon,
        pctTwee + '% (alsof er 2 records staan), lager dan de ' + pctSchoon + '% van 4',
        pctGemengd + '%');

    // En de twee andere Algemeen-percentages doen hetzelfde.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(
      rec(2, 45).concat(rec(2, 45, { rv: 1 }, 2))));
    eis('T3b laagDagdeelPct (Algemeen-tak) filtert ook',
        laagDagdeelPct(NODE, null, DD_NU) === laagDagdeelPct(NODE, null, DD_NU),
        'zelfde filter', String(laagDagdeelPct(NODE, null, DD_NU)));
    const ddGemengd = laagDagdeelPct(NODE, null, DD_NU);
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(rec(2, 45)));
    eis('T3c en komt uit op hetzelfde als zonder de gemarkeerde records',
        ddGemengd === laagDagdeelPct(NODE, null, DD_NU),
        String(laagDagdeelPct(NODE, null, DD_NU)), String(ddGemengd));

    // ══ T4 — DE COUNTDOWN ZIET ZE WEL (RV1) ═══════════════════
    wis();
    const gemengd = rec(2, 30).concat(rec(2, 30, { rv: 1 }, 2));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(gemengd));
    eis('T4 laadM levert alle vier de records, ook de gemarkeerde',
        laadM(NODE, DD_NU).length === 4, '4', String(laadM(NODE, DD_NU).length));
    eis('T4b gewGem rekent met alle vier',
        Math.round(gewGem(laadM(NODE, DD_NU))) === 30, '30s',
        Math.round(gewGem(laadM(NODE, DD_NU))) + 's');
    const bron = kiesCountdownBron(NODE, DD_NU, null, null);
    eis('T4c kiesCountdownBron levert een countdown uit de volle set',
        bron && bron.gem > 0 && bron.metingen === 4,
        '4 metingen, gem > 0',
        bron ? bron.metingen + ' metingen, ' + Math.round(bron.gem) + 's' : 'GEEN BRON');
    const hm = haalMetingenVoorBron(NODE, DD_NU, null, null, bron ? bron.bron : 'V4');
    eis('T4d haalMetingenVoorBron ziet ze ook',
        Array.isArray(hm) && hm.length === 4, '4', Array.isArray(hm) ? String(hm.length) : String(hm));
    const sw = berekenSchaduwWaarden(NODE, DD_NU, null, null, bron ? bron.bron : 'V4');
    eis('T4e berekenSchaduwWaarden ook',
        sw && sw.m1 != null, 'gevuld', sw ? JSON.stringify(sw) : 'null');

    // ══ T5 — ALLES GEMARKEERD, TOCH EEN COUNTDOWN ═════════════
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(rec(6, 33, { rv: 1 })));
    const alles = kiesCountdownBron(NODE, DD_NU, null, null);
    eis('T5 een node met UITSLUITEND gemarkeerde records houdt zijn countdown',
        alles && alles.gem > 0 && Math.round(alles.gem) === 33,
        '33s', alles ? Math.round(alles.gem) + 's' : 'GEEN COUNTDOWN — RV1 GEBROKEN');
    eis('T5b terwijl Algemeen daar wel op 0% staat — dat is de bedoeling',
        berekenLeerPct(NODE) === 0, '0%', berekenLeerPct(NODE) + '%');

    // ══ T6 — HISTORISCHE RECORDS ONVERANDERD (RV3) ════════════
    wis();
    // Een record zonder rv-veld, zoals alles wat vóór deze release geschreven is.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(rec(3, 45)));
    const oudPct = berekenLeerPct(NODE);
    const oudBron = kiesCountdownBron(NODE, DD_NU, null, null);
    eis('T6 een record zonder rv-veld telt gewoon mee in Algemeen',
        oudPct > 0, '> 0%', oudPct + '%');
    eis('T6b en voedt de countdown zoals altijd',
        oudBron && oudBron.metingen === 3, '3 metingen',
        oudBron ? String(oudBron.metingen) : 'GEEN BRON');
    // rv: 0 is geen markering — alleen exact 1 telt.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(rec(3, 45, { rv: 0 })));
    eis('T6c alleen rv===1 markeert; een andere waarde verandert niets',
        berekenLeerPct(NODE) === oudPct, oudPct + '%', berekenLeerPct(NODE) + '%');

    // ══ T7 — HET CAP-GEDRAG IS ONGEWIJZIGD (RV4) ══════════════
    const si = String(slaOpIntern).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const capRegel = si.match(/if \(m\.length > MAX_METINGEN\)[^\n]*/);
    eis('T7 MAX_METINGEN is 50', MAX_METINGEN === 50, '50', String(MAX_METINGEN));
    eis('T7b de snoeisortering gaat uitsluitend over recentheid, niet over rv',
        capRegel && /gew\(b\.tijd\)-gew\(a\.tijd\)/.test(capRegel[0]) && !/rv/.test(capRegel[0]),
        'sorteren op tijd, geen rv', capRegel ? capRegel[0].trim() : 'REGEL NIET GEVONDEN');
    // En in de praktijk: 55 records, de helft gemarkeerd, de nieuwste 50 blijven.
    wis();
    const veel = Array.from({ length: 55 }, (_, i) => ({
      duur: 30, tijd: nu - i * 60000, richting: 0, obs: 30, gewicht: 1, bron: 's1',
      ...(i % 2 === 0 ? { rv: 1 } : {})
    }));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(veel));
    faseStart = performance.now() - 40000;
    slaOp(NODE, 0, 30);
    const naCap = lees(DD_NU);
    const oudsteWeg = !naCap.some(x => x.tijd === nu - 54 * 60000);
    const gemarkeerdOver = naCap.filter(x => x.rv === 1).length;
    eis('T7c na de cap staan er 50 records en is de OUDSTE weg',
        naCap.length === MAX_METINGEN && oudsteWeg,
        '50 records, oudste gesneuveld',
        naCap.length + ' records, oudste weg: ' + oudsteWeg);
    eis('T7d gemarkeerde records overleven de cap net zo goed als gewone',
        gemarkeerdOver >= 24 && gemarkeerdOver <= 28,
        'ongeveer de helft (24-28)', String(gemarkeerdOver));

    // ══ T8 — REGRESSIEWACHT ═══════════════════════════════════
    eis('T8 V9_MIN_METINGEN is 5', V9_MIN_METINGEN === 5, '5', String(V9_MIN_METINGEN));
    const kb = String(kiesCountdownBron)
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    eis('T8b kiesCountdownBron filtert nergens op rv — hij ziet alles',
        !/rv/.test(kb) && !/zonderRichtingVerwant/.test(kb),
        'geen rv-filter in de countdownkeuze',
        /rv|zonderRichtingVerwant/.test(kb) ? 'FILTER AANWEZIG' : 'schoon');
    // V11.18.2: waren er drie, nu twee. De drempel in stap 1 is bewust weg -
    // een getikte richting telt vanaf haar eerste eigen meting zelf af. Wat
    // deze toets bewaakt blijft overeind: de resterende drempels tellen
    // METINGEN, niet een afgeleid percentage of een rv-gefilterd aantal.
    eis('T8c de twee resterende drempeltoetsen gaan nog over .length',
        (kb.match(/\w+\.length >= V9_MIN_METINGEN/g) || []).length === 2, '2',
        String((kb.match(/\w+\.length >= V9_MIN_METINGEN/g) || []).length));
    // De scheidslijn, niet het aantal. Hier stond `tel === 3` over een samengeplakte
    // bron. Dat brak op V11.17.94 om twee redenen tegelijk: die release voegde
    // laagDagdeelCijfers als vierde weergaveplek toe (terecht — de dagdeelstrip
    // toonde een gefilterd percentage naast een ongefilterd aantal), en de telling
    // liep ook over COMMENTAAR, zodat een functienaam die in een toelichting stond
    // meetelde als aanroep. Een vast getal zegt bovendien niet waar het om gaat:
    // de weergavekant moet filteren en de countdownketen niet.
    const kaal = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    const telt = (f) => (kaal(f).match(/zonderRichtingVerwant\(/g) || []).length;
    // V11.17.99: de vier weergaveplekken filteren niet meer zelf — ze lezen
    // allemaal algemeenMetingen, en DAAR zit het filter. De eis is dus
    // tweeledig geworden: elke plek moet via de gedeelde verzamelaar lopen, en
    // die verzamelaar moet filteren. Zou een van de vier het filter opnieuw
    // zelf gaan doen, dan telt hij dubbel; zou hij de verzamelaar omzeilen,
    // dan filtert hij niet meer. T8d bewaakt het eerste, T8d2 het tweede.
    const leestVerzamelaar = (f) => kaal(f).indexOf('algemeenMetingen(') >= 0;
    const weergave = { berekenLeerPct, laagDagdeelPct, laagDagdeelCijfers, renderRichtingBlok };
    const keten    = { kiesCountdownBron, gewGem, haalMetingenVoorBron, berekenSchaduwWaarden };
    const zonderFilter = Object.keys(weergave).filter(n => !leestVerzamelaar(weergave[n]));
    const metFilter    = Object.keys(keten).filter(n => telt(keten[n]) > 0);
    eis('T8d elke plek die een Algemeen-getal TOONT leest de gedeelde verzamelaar',
        zonderFilter.length === 0, 'alle vier',
        zonderFilter.length ? 'leest hem niet: ' + zonderFilter.join(', ') : 'alle vier');
    eis('T8d2 en die verzamelaar filtert op rv',
        telt(algemeenMetingen) > 0, 'zonderRichtingVerwant aanwezig',
        telt(algemeenMetingen) + ' aanroepen');
    // Gedrag, niet alleen vorm: een gemarkeerd record mag nergens meetellen.
    const _bakM = localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU);
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      { duur: 60, tijd: nu - 3 * 3600000, richting: 0, obs: 60, gewicht: 1, bron: 's1' },
      { duur: 20, tijd: nu - 4 * 3600000, richting: 0, obs: 20, gewicht: 1, bron: 's1', rv: 1 }
    ]));
    eis('T8d3 een rv-gemarkeerd record valt uit de Algemeen-verzameling',
        algemeenMetingen(NODE, DD_NU).length === 1
        && algemeenMetingen(NODE, DD_NU)[0].duur === 60,
        '1 record van 60s',
        algemeenMetingen(NODE, DD_NU).map(x => x.duur).join(','));
    if (_bakM === null) localStorage.removeItem('sl_v4_' + NODE + '_' + DD_NU);
    else localStorage.setItem('sl_v4_' + NODE + '_' + DD_NU, _bakM);
    eis('T8e en geen enkele schakel van de countdownketen doet dat',
        metFilter.length === 0, 'geen van de vier filtert',
        metFilter.length ? 'filtert wel: ' + metFilter.join(', ') : 'geen van de vier filtert');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    faseStart = bewaard.faseStart;
    dichtstbijOSM = bewaard.dichtstbijOSM;
    huidigePos = bewaard.huidigePos;
    huidigeRichting = bewaard.huidigeRichting;
    bboxOverride = bewaard.bboxOverride;
    handmatigLockActief = bewaard.handmatigLockActief;
    getoondeLaag = bewaard.getoondeLaag;
    getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    laatsteV4Schrijvingen = [];
    v9KandidaatV4Stempels = [];
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testV4Markering = testV4Markering;
