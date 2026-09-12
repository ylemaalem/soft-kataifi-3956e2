// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_richting_pct.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.84 (D1): een richting wordt gescoord als een stoplicht.
//
//  WAT HIER BEWAAKT WORDT
//  Tot deze release scoorde een richting via een trapfunctie op het kale
//  aantal met plafond 60, terwijl een node de logaritmische observatiescore
//  kreeg met plafond 95. Dezelfde metingen gaven 6% tegen 25% bij n=1 en 35%
//  tegen 95% bij n=8. Het architectuurprincipe — elke richting is een eigen
//  stoplicht — stond dus niet in de formule.
//
//  DE VALKUIL DIE T1 VASTZET
//  berekenObsScore kan NIET rechtstreeks op een V5-record. Die draagt geen
//  `obs` en geen `tier`, dus vlakGewichtVoor valt uit en het rauwe `gewicht`
//  wordt gebruikt — en dat is een AFSTANDSgewicht (1,0 dichtbij / 0,6 ver),
//  geen observatiegewicht. Zonder normalisatie naar OBS_VLAK komt n=1 op 42%
//  in plaats van 25%. T1 toetst de gelijkwaardigheid daarom op het GETAL, niet
//  op "roept dezelfde functie aan".
//
//  T5 EN T6 ZIJN EEN PAAR
//  laagLeerPct moet poolen, en hij moet ALLE paren van de samengevatte regel
//  poolen (V11.17.81 vat meerdere V5-sleutels samen in één regel). Los van
//  elkaar dekken ze de fout niet: poolen over één paar is nog steeds te laag.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_richting_pct.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRichtingPct().regels);
// ═══════════════════════════════════════════════════════════════

function testRichtingPct() {
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
  const NODE = 992001;
  const DD_NU = huidigDDActief();

  // Een V4-meting zoals slaOpIntern hem schrijft: obs === duur en bron 's1',
  // zodat vlakGewichtVoor het vlakke OBS_VLAK toekent — het pad dat een echte
  // s1-meting ook loopt.
  const v4rec = (n, duur = 45) => Array.from({ length: n }, (_, i) =>
    ({ duur, tijd: nu - i * 3600000, richting: 0, obs: duur, gewicht: 1, bron: 's1' }));
  // Een V5-meting zoals slaOpV5 hem schrijft: GEEN obs, GEEN tier.
  const v5rec = (n, gewicht = V9_GEWICHT_DICHTBIJ, duur = 45) =>
    Array.from({ length: n }, (_, i) =>
      ({ duur, tijd: nu - i * 3600000, gewicht, bron: 'tik' }));

  const bewaard = {
    dichtstbijOSM, getoondeLaag, getoondDagdeel, richtingBlokVerborgen,
    v9AanrijHeading, v9AanrijSnelheidHeading,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML
  };
  const wisNode = () => {
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
    zetLS('sl_enkelricht_' + NODE, null);
  };

  try {
    // ══ T1 — DE KERNTEST: GELIJKWAARDIGHEID ═══════════════════
    // Dezelfde n metingen, één keer als node-emmer en één keer als
    // richting-emmer. Het percentage moet gelijk zijn — de node zonder
    // bonussen, want die horen bij de plek en niet bij de bocht.
    const afwijkingen = [];
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 12, 20, 40]) {
      wisNode();
      zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(v4rec(n)));
      const alsNode = berekenLeerPct(NODE);          // geen bonussen: geen sl_bevestig_, geen sl_richting_
      wisNode();
      zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(n)));
      const alsRichting = berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct;
      if (alsNode !== alsRichting) afwijkingen.push('n=' + n + ': node ' + alsNode + ' vs richting ' + alsRichting);
    }
    eis('T1 dezelfde metingen geven hetzelfde percentage als node en als richting',
        afwijkingen.length === 0, 'geen enkele afwijking',
        afwijkingen.length ? afwijkingen.join(' | ') : 'gelijk voor n=1..40');

    // Het bewijs dat de normalisatie nodig was: RAUW scoren wijkt wél af.
    wisNode();
    const rauw = berekenObsScore(v5rec(1));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(1)));
    eis('T1b zonder gewichtsnormalisatie zou het te hoog uitkomen (waarom T1 nodig is)',
        rauw > berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct,
        'rauw hoger dan genormaliseerd',
        'rauw ' + rauw + '% tegen genormaliseerd ' + berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct + '%');

    // ══ T2 — n=1 OP EEN LEGE EMMER ════════════════════════════
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(1)));
    const p1 = berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct;
    eis('T2 één verse meting geeft ~25% (was 6% onder de oude trap)',
        p1 >= 23 && p1 <= 27, '23-27%', p1 + '%');
    // En de verre variant houdt haar korting.
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(1, V9_GEWICHT_VER)));
    const p1ver = berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct;
    eis('T2b een VERRE meting (gewicht 0,6) telt lichter, niet gelijk',
        p1ver < p1 && p1ver > 0, 'lager dan ' + p1 + '%', p1ver + '%');

    // ══ T3 — DE DODE ZONE IS WEG (RV4) ════════════════════════
    const trap = [];
    for (const n of [3, 4, 5, 6, 7]) {
      wisNode();
      zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(n)));
      trap.push(berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct);
    }
    eis('T3 n=3 t/m n=7 geven vijf VERSCHILLENDE waarden (RV4)',
        new Set(trap).size === 5, '5 verschillende', trap.join(', '));
    eis('T3b en ze lopen op',
        trap.every((v, i) => i === 0 || v > trap[i - 1]), 'monotoon stijgend', trap.join(' < '));

    // ══ T4 — DE CAP IS 95, NIET 60 ════════════════════════════
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(40)));
    const pMax = berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct;
    eis('T4 het plafond is 95, niet 60', pMax === 95, '95', String(pMax));

    // ══ T5 — laagLeerPct POOLT OVER DAGDELEN ══════════════════
    wisNode();
    for (const d of Object.keys(DD)) zetLS('sl_v5_' + NODE + '_N_W_' + d, JSON.stringify(v5rec(1)));
    const laag1 = { node: String(NODE), key: 'k', paren: [{ aanrij: 'N', afrij: 'W' }], richt: 'rechts' };
    const gepooldOverDD = laagLeerPct(NODE, laag1);
    // Referentie: dezelfde vier metingen in ÉÉN emmer.
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(4)));
    const inEenEmmer = berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct;
    eis('T5 vier dagdelen met elk 1 meting = één emmer met 4 metingen',
        gepooldOverDD === inEenEmmer,
        inEenEmmer + '% (gepoold)', gepooldOverDD + '%');
    eis('T5b en dat is niet het gemiddelde van vier losse percentages',
        gepooldOverDD > p1, 'hoger dan de ' + p1 + '% van n=1', gepooldOverDD + '%');

    // ══ T6 — laagLeerPct NEEMT ALLE PAREN MEE ═════════════════
    // Twee V5-sleutels die V11.17.81 tot één regel samenvat.
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(2)));
    zetLS('sl_v5_' + NODE + '_Z_O_' + DD_NU, JSON.stringify(v5rec(2)));
    const laag2 = { node: String(NODE), key: 'k',
                    paren: [{ aanrij: 'N', afrij: 'W' }, { aanrij: 'Z', afrij: 'O' }], richt: 'rechts' };
    const beidePaar = laagLeerPct(NODE, laag2);
    const eenPaar   = laagLeerPct(NODE, { node: String(NODE), key: 'k', paren: [{ aanrij: 'N', afrij: 'W' }] });
    eis('T6 alle paren van de samengevatte regel tellen mee',
        beidePaar > eenPaar, 'hoger dan de ' + eenPaar + '% van één paar', beidePaar + '%');
    // Vier metingen verdeeld over twee paren == vier in één emmer.
    eis('T6b twee paren van 2 geven hetzelfde als één emmer van 4',
        beidePaar === inEenEmmer, inEenEmmer + '%', beidePaar + '%');

    // ══ T7 — DE NODE-BONUSSEN LEKKEN NIET NAAR DE RICHTING ════
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(2)));
    const zonderBonus = berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct;
    // Zet alle drie de bonusbronnen op scherp.
    zetLS('sl_bevestig_' + NODE, JSON.stringify(
      Array.from({ length: 8 }, () => ({ categorie: 'klopte', tijd: nu }))));
    zetLS('sl_richting_' + NODE, JSON.stringify({ gps_tik_score: 1.0, headings: [], laatste_update: nu }));
    const metBonus = berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct;
    eis('T7 de node-bonussen veranderen het richting-percentage niet',
        metBonus === zonderBonus, zonderBonus + '%', metBonus + '%');
    const bronRP = String(berekenRichtingPct) + String(richtingLeerPct);
    eis('T7b en de bronnen ervan worden nergens aangeroepen',
        !/zoekS2BevestigingScore|berekenBevestigScore|gps_tik_score/.test(bronRP),
        'geen bonusaanroep', 'schoon');

    // ══ T8 — berekenLeerPct HOUDT ZIJN VORM ═══════════════════
    // V11.17.85: deze wacht toetste de inleesregel LETTERLIJK. D2 wikkelt daar
    // met opzet een filter omheen (zonderRichtingVerwant), dus de letterlijke
    // toets sloeg terecht aan. Wat D1 wilde bewaken is niet de tekst maar de
    // VORM: het node-percentage blijft over alle vier de dagdelen lezen en
    // blijft de drie bonussen optellen. Dat is wat hier nu staat.
    // V11.17.99: de inleesregel is verhuisd naar algemeenMetingen, zodat vier
    // plekken dezelfde bron delen. De VORM die D1 wilde bewaken is daarmee niet
    // veranderd — het node-percentage leest nog steeds alle vier de dagdelen —
    // maar een letterlijke toets op de lus kijkt nu naar de verkeerde functie.
    // Daarom hier het gedrag: vier dagdelen met elk één meting moeten samen
    // meer opleveren dan één dagdeel met één meting, en de aanroep moet via de
    // gedeelde verzamelaar lopen.
    const bl = String(berekenLeerPct).replace(/\s+/g, ' ');
    eis('T8 berekenLeerPct leest via de gedeelde verzamelaar',
        /algemeenMetingen\(osmId\)/.test(bl),
        'algemeenMetingen(osmId)', bl.slice(0, 120));
    wisNode();
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, JSON.stringify(v4rec(1)));
    const vierDd = berekenLeerPct(NODE);
    wisNode();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(v4rec(1)));
    const eenDd = berekenLeerPct(NODE);
    eis('T8a2 en telt daarbij ALLE vier de dagdelen mee',
        vierDd > eenDd && eenDd > 0,
        'vier dagdelen hoger dan een', eenDd + '% -> ' + vierDd + '%');
    eis('T8b en telt nog steeds de drie bonussen op bij obsPct',
        /Math\.min\(95, obsPct \+ s2Bonus \+ gpsTikBonus \+ bevestigBonus\)/.test(bl),
        'slotregel ongewijzigd',
        /obsPct \+ s2Bonus \+ gpsTikBonus \+ bevestigBonus/.test(bl) ? 'ongewijzigd' : 'GEWIJZIGD');

    // ══ T9 — V9_MIN_METINGEN TOETST OP LENGTE (RV2) ═══════════
    eis('T9 V9_MIN_METINGEN is 5', V9_MIN_METINGEN === 5, '5', String(V9_MIN_METINGEN));
    const kb = String(kiesCountdownBron)
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const toetsen = kb.match(/\w+\.length >= V9_MIN_METINGEN/g) || [];
    // RV2 GAAT OVER DE MAATSTAF, NIET OVER HET AANTAL. De eis is dat een
    // drempel in kiesCountdownBron telt hoeveel metingen er ZIJN, en nooit
    // hoeveel procent geleerd is - een percentage is afgeleid en zou de
    // countdownkeuze aan de weergavekant knopen. Dat blijft ongewijzigd.
    // Het AANTAL toetsen ging van drie naar twee: V11.18.2 haalde de drempel
    // uit stap 1, zodat een getikte richting vanaf haar eerste eigen meting
    // zelf aftelt in plaats van het Algemeen-gemiddelde te tonen. Stap 2 en 3
    // houden hun drempel van 5.
    eis('T9b de twee resterende drempeltoetsen gaan over .length, niet over een percentage',
        toetsen.length === 2, '2 lengte-toetsen', toetsen.join(' | ') || 'GEEN');
    eis('T9c kiesCountdownBron raakt het richting-percentage niet aan',
        !/berekenRichtingPct|richtingLeerPct|laagLeerPct/.test(kb),
        'geen percentage-aanroep', 'schoon');

    // ══ T10 — LEEG BLIJFT null ════════════════════════════════
    wisNode();
    eis('T10 een lege richting-emmer geeft null, niet 0%',
        berekenRichtingPct(NODE, 'N', 'W', DD_NU) === null, 'null',
        String(berekenRichtingPct(NODE, 'N', 'W', DD_NU)));
    eis('T10b maar laagLeerPct op een lege laag geeft 0 (de balk moet een getal hebben)',
        laagLeerPct(NODE, laag1) === 0, '0', String(laagLeerPct(NODE, laag1)));
    eis('T10c en laagDagdeelPct geeft null voor een leeg dagdeel',
        laagDagdeelPct(NODE, laag1, DD_NU) === null, 'null',
        String(laagDagdeelPct(NODE, laag1, DD_NU)));

    // ══ T11 — DE BALK EN DE REGEL BLIJVEN GELIJK ══════════════
    // Dezelfde koppeling die test_richting_ui T2c bewaakt, hier op een regel
    // die TWEE V5-sleutels samenvat — het geval waarin de oude middeling en de
    // nieuwe pooling het verst uit elkaar lopen.
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_NW_' + DD_NU, JSON.stringify(v5rec(1)));
    zetLS('sl_v5_' + NODE + '_NO_W_' + DD_NU, JSON.stringify(v5rec(1)));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(v4rec(3)));
    zetLS('sl_richting_' + NODE, JSON.stringify({
      headings: [0, 2, 1, 3, 0, 1, 2, 1], laatste_update: nu, bevestigingen: 8 }));
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 20, naam: 'Testweg' };
    richtingBlokVerborgen = false; getoondDagdeel = null;
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0;
    getoondeLaag = null;
    bijwerkLeerkaart(dichtstbijOSM);
    const rijen = [...document.querySelectorAll('#richting-blok-body .rb-rij')];
    const richtRij = rijen.find(r => !r.querySelector('.rb-label').textContent.trim().startsWith('Algemeen'));
    eis('T11 er staat een samengevatte richtingregel', !!richtRij, 'een richtingregel',
        rijen.map(r => r.querySelector('.rb-label').textContent.trim()).join(' | '));
    if (richtRij) {
      const regelPct = richtRij.querySelector('.rb-pct').textContent.trim();
      richtRij.onclick();
      const balkPct = document.getElementById('leer-pct-getal').textContent;
      eis('T11b de balk bovenaan is gelijk aan het getal op de regel',
          balkPct === regelPct, regelPct, balkPct);
      eis('T11c en dat getal poolt beide sleutels (hoger dan één meting alleen)',
          parseInt(regelPct, 10) > p1, 'hoger dan ' + p1 + '%', regelPct);
    }

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    getoondeLaag = bewaard.getoondeLaag;
    getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    const b = document.getElementById('richting-blok-body');
    if (b && bewaard.blokHtml != null) b.innerHTML = bewaard.blokHtml;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRichtingPct = testRichtingPct;
