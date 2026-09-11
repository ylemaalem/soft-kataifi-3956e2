// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_algemeen_eigen_data.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.94 (richting release 3): de Algemeen-regel verschijnt alleen
//  nog als er metingen zijn die NIET richting-verwant zijn.
//
//  WAT HIER BEWAAKT WORDT
//  D2 (V11.17.85) zette het filter alleen om het PERCENTAGE heen. Het aantal,
//  de cyclustijd en de vraag óf de regel bestaat lazen de volle set. Op een
//  splinternieuw stoplicht waar meteen een richting werd getikt stond daardoor
//  een Algemeen-regel met '1 meting' en een cyclustijd op 0% — één meting die
//  tegelijk in twee categorieën op het scherm stond.
//
//  DRIE PLEKKEN, ÉÉN FOUT
//  Het rijblok (renderRichtingBlok), de dagdeelstrip (laagDagdeelCijfers) en de
//  Algemeen-rij in het node-info-paneel deelden dezelfde omissie. T1-T4 dekken
//  het rijblok, T5 de dagdeelstrip, T7 het paneel.
//
//  DE RIJ IN HET PANEEL MAG NIET VERDWIJNEN
//  Die rij is het DOEL van een samenvoeging: klikMergeRij('ALG') is de enige
//  manier om een richting bij Algemeen te voegen. T7c legt vast dat hij blijft
//  staan ook als er niets van Algemeen over is — anders zou deze release
//  release 1 (V11.17.91) ongedaan maken.
//
//  GEEN TERUGWERKENDE SPRONG
//  rv wordt pas sinds D2 geschreven; oudere records dragen het veld niet en
//  glippen door het filter. T3 zet vast dat een node met alleen oude data geen
//  procent verschuift — anders zou deze release bestaande kruispunten leeg
//  trekken in plaats van nieuwe eerlijk te tonen.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_algemeen_eigen_data.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testAlgemeenEigenData().regels);
// ═══════════════════════════════════════════════════════════════

function testAlgemeenEigenData() {
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
    richtingLockKeuze, richtingLockNodeId, richtingKnoppenNodeId,
    richtingGedruktVoorNode, v9AanrijHeading, v9AanrijSnelheidHeading,
    v9PreSelectieAfrij, huidigCdBron, nodeInfoNodeId, mergeModusAan, mergeSelectie,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML,
    infoHtml: (document.getElementById('node-info-body') || {}).innerHTML,
    indicDisp: (document.getElementById('v9-richting-indicator') || {}).style
                 ? document.getElementById('v9-richting-indicator').style.display : null
  };

  const nu = Date.now();
  const DD_NU = huidigDDActief();
  const NODE = 992301;

  // Elk record een eigen tijdstempel: laadM ontdubbelt op `tijd`.
  const v4 = (duur, uurGeleden, extra = {}) => ({
    duur, tijd: nu - uurGeleden * 3600000, richting: 0, obs: duur,
    gewicht: 1, bron: 's1', ...extra
  });
  const gemerkt = (duur, u) => v4(duur, u, { rv: 1 });

  const rijen  = () => [...document.querySelectorAll('#richting-blok-body .rb-rij')];
  const algRij = () => rijen().find(r => r.querySelector('.rb-label').textContent.trim().startsWith('Algemeen'));
  const algPct = () => { const r = algRij(); return r ? r.querySelector('.rb-pct').textContent.trim() : null; };
  const algCyc = () => { const r = algRij(); return r ? r.querySelector('.rb-cyc').textContent.trim() : null; };
  const ddCnt  = (d) => document.getElementById('dc-' + d).textContent;
  const ddVal  = (d) => document.getElementById('dv-' + d).textContent;
  const blokTxt = () => document.getElementById('richting-blok-body').textContent;
  const infoAlg = () => document.querySelector('#node-info-body .ni-rij-algemeen');

  // Eén opzet: schrijf de V4-emmer, zet de node, teken opnieuw.
  const zetNode = (records, v5 = null) => {
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, null);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
    }
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(records));
    if (v5) zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5));
    getoondeLaag = null;
    bijwerkLeerkaart(dichtstbijOSM);
  };

  try {
    // ══ FIXTURE ═══════════════════════════════════════════════
    zetLS('sl_richting_' + NODE, JSON.stringify({
      headings: [0, 2, 1, 3, 0, 1, 2, 1], laatste_update: nu, bevestigingen: 8 }));
    zetLS('sl_neutraal_'   + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);
    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'Testkruising' };
    getoondDagdeel = null;
    richtingBlokVerborgen = false;
    richtingLockKeuze = null; richtingLockNodeId = null;
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0;
    v9PreSelectieAfrij = null; huidigCdBron = null;
    mergeModusAan = false; mergeSelectie = [];

    // ══ T1 — ALLES GETIKT: GEEN ALGEMEEN-REGEL ════════════════
    // Het scenario uit de melding: gloednieuw stoplicht, meteen een richting
    // getikt. De enige meting hoort bij die richting.
    zetNode([gemerkt(38, 2)], [v4(38, 2)]);
    eis('T1 een node waar élke meting richting-verwant is toont geen Algemeen-regel',
        algRij() === undefined, 'geen ALG-rij',
        algRij() ? ('ALG-rij met ' + algPct() + ' / ' + algCyc()) : 'geen ALG-rij');
    eis('T1b en er blijft geen lege rest achter: geen "0 metingen", geen loze rij',
        blokTxt().indexOf('Algemeen') < 0 && blokTxt().indexOf('0 meting') < 0,
        'geen Algemeen-tekst', blokTxt().slice(0, 60));
    eis('T1c de dagdeelstrip telt Algemeen ook op nul',
        ddCnt(DD_NU) === '0x' && ddVal(DD_NU) === '—',
        "'0x' en '—'", ddCnt(DD_NU) + ' / ' + ddVal(DD_NU));

    // Meerdere gemarkeerde metingen, verspreid over dagdelen: nog steeds niets.
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, JSON.stringify([gemerkt(40, 3)]));
    getoondeLaag = null; bijwerkLeerkaart(dichtstbijOSM);
    eis('T1d ook over alle vier de dagdelen samen blijft de regel weg',
        algRij() === undefined, 'geen ALG-rij', algRij() ? 'ALG-rij aanwezig' : 'geen ALG-rij');

    // ══ T2 — GEMENGD: REGEL BLIJFT, CIJFERS KLOPPEN ═══════════
    // 2 eigen metingen van 60s + 3 richting-verwante van 20s. Telt de volle set
    // mee, dan zakt de cyclustijd naar 36s en staat er 5x; op de gefilterde set
    // hoort er 60s en 2x te staan.
    zetNode([v4(60, 4), v4(60, 5), gemerkt(20, 6), gemerkt(20, 7), gemerkt(20, 8)],
            [v4(20, 6), v4(20, 7), v4(20, 8)]);
    eis('T2 bij gemengde data blijft de Algemeen-regel staan',
        algRij() !== undefined, 'ALG-rij aanwezig', algRij() ? 'aanwezig' : 'weg');
    eis('T2b het aantal telt alleen de eigen metingen',
        ddCnt(DD_NU) === '2x', "'2x' (niet 5x)", ddCnt(DD_NU));
    eis('T2c de cyclustijd komt uit de eigen metingen, niet uit het mengsel',
        algCyc() === '60s' && ddVal(DD_NU) === '60s',
        "'60s' (niet 36s)", algCyc() + ' / ' + ddVal(DD_NU));
    // Het percentage van de regel moet gelijk zijn aan wat berekenLeerPct zegt —
    // die filtert sinds D2 al, dus de twee hoorden altijd al te matchen.
    eis('T2d het percentage van de regel is dat van de gefilterde set',
        algPct() === berekenLeerPct(NODE) + '%',
        berekenLeerPct(NODE) + '%', String(algPct()));

    // ══ T3 — OUDE DATA: GEEN TERUGWERKENDE SPRONG ═════════════
    // Records van vóór D2 dragen geen rv-veld. zonderRichtingVerwant toetst op
    // === 1, dus undefined glipt door — en er mag niets veranderen.
    const oud = [v4(55, 4), v4(58, 5), v4(52, 6), v4(60, 7)];
    zetNode(oud);
    const pctOud = algPct(), cycOud = algCyc(), cntOud = ddCnt(DD_NU);
    eis('T3 een node met alleen oude metingen houdt zijn Algemeen-regel',
        algRij() !== undefined, 'ALG-rij aanwezig', algRij() ? 'aanwezig' : 'weg');
    eis('T3b met alle vier de metingen geteld',
        cntOud === '4x', "'4x'", String(cntOud));
    eis('T3c en het filter laat elk van die records door',
        zonderRichtingVerwant(oud).length === 4, '4', String(zonderRichtingVerwant(oud).length));
    // Expliciet: rv:0 en rv:undefined zijn geen markering, alleen rv===1.
    eis('T3d alleen rv === 1 telt als richting-verwant',
        zonderRichtingVerwant([v4(1, 1), v4(2, 2, { rv: 0 }), v4(3, 3, { rv: '1' }),
                               v4(4, 4, { rv: 1 })]).length === 3,
        '3 van de 4 blijven',
        String(zonderRichtingVerwant([v4(1, 1), v4(2, 2, { rv: 0 }),
                                      v4(3, 3, { rv: '1' }), v4(4, 4, { rv: 1 })]).length));

    // ══ T4 — DE GRENS ═════════════════════════════════════════
    // Precies één ongemarkeerde meting is genoeg om de regel te laten bestaan.
    zetNode([gemerkt(20, 2), gemerkt(20, 3), v4(60, 4)]);
    eis('T4 één eigen meting tussen gemarkeerde houdt de regel in leven',
        algRij() !== undefined && ddCnt(DD_NU) === '1x',
        'ALG-rij, 1x', (algRij() ? 'rij, ' : 'geen rij, ') + ddCnt(DD_NU));
    zetNode([gemerkt(20, 2), gemerkt(20, 3), gemerkt(60, 4)]);
    eis('T4b haal die ene weg en de regel verdwijnt',
        algRij() === undefined, 'geen ALG-rij', algRij() ? 'ALG-rij aanwezig' : 'geen ALG-rij');

    // ══ T5 — DE DAGDEELSTRIP IS CONSISTENT ════════════════════
    // laagDagdeelCijfers en laagDagdeelPct lezen dezelfde emmer; ze hoorden
    // hetzelfde antwoord te geven en deden dat sinds D2 niet meer.
    zetNode([v4(60, 4), v4(60, 5), gemerkt(20, 6), gemerkt(20, 7)]);
    const c = laagDagdeelCijfers(NODE, null, DD_NU);
    const pDd = laagDagdeelPct(NODE, null, DD_NU);
    eis('T5 laagDagdeelCijfers telt de gefilterde set',
        c.n === 2 && c.m.length === 2, 'n=2', 'n=' + c.n + ', m=' + c.m.length);
    eis('T5b en levert de cyclustijd van diezelfde set',
        Math.round(c.gem) === 60, '60', String(Math.round(c.gem)));
    eis('T5c percentage en aantal komen nu uit dezelfde verzameling',
        pDd !== null && pDd > 0 && c.n > 0, 'beide gevuld', 'pct ' + pDd + ', n ' + c.n);
    // Een dagdeel waarin alles gemarkeerd is: leeg, en dat moet ook zo heten.
    zetNode([gemerkt(20, 6), gemerkt(20, 7)]);
    const cLeeg = laagDagdeelCijfers(NODE, null, DD_NU);
    eis('T5d een volledig gemarkeerd dagdeel telt als leeg, niet als nul-procent-data',
        cLeeg.n === 0 && cLeeg.gem === null && laagDagdeelPct(NODE, null, DD_NU) === null,
        'n=0, gem null, pct null',
        'n=' + cLeeg.n + ', gem ' + cLeeg.gem + ', pct ' + laagDagdeelPct(NODE, null, DD_NU));

    // ══ T6 — SAMENLOOP MET RELEASE 2 ══════════════════════════
    // Nieuw sinds V11.17.93: de keuze kan op 'algemeen' staan terwijl er geen
    // Algemeen-regel meer is. Dat mag niet klappen en moet een leesbaar scherm
    // opleveren.
    zetNode([gemerkt(38, 2)], [v4(38, 2)]);
    let stuk = false;
    try {
      richtingLockNodeId = String(NODE);
      richtingLockKeuze = 'algemeen';
      bijwerkLeerkaart(dichtstbijOSM);
    } catch (e) { stuk = true; }
    eis('T6 keuze algemeen zonder Algemeen-regel geeft geen fout',
        !stuk, 'geen fout', stuk ? 'wierp een fout' : 'geen fout');
    eis('T6b er komt geen regel terug en dus ook geen koppel-chip',
        algRij() === undefined && document.querySelector('#richting-blok-body .rb-koppel') === null,
        'geen rij, geen chip',
        (algRij() ? 'rij ' : 'geen rij ') + (document.querySelector('#richting-blok-body .rb-koppel') ? '+ chip' : '+ geen chip'));
    eis('T6c het scherm toont een eerlijk Algemeen-cijfer: nul',
        document.getElementById('leer-pct-getal').textContent === '0%',
        "'0%'", document.getElementById('leer-pct-getal').textContent);
    eis('T6d en het blok is niet leeg — de richting zelf staat er nog',
        rijen().length > 0 || blokTxt().indexOf('Rechtsaf') >= 0,
        'minstens één regel', rijen().length + ' regels: ' + blokTxt().slice(0, 50));

    // ══ T7 — HET NODE-INFO-PANEEL ═════════════════════════════
    zetNode([v4(60, 4), v4(60, 5), gemerkt(20, 6), gemerkt(20, 7), gemerkt(20, 8)]);
    renderNodeInfo(String(NODE));
    const rijInfo = infoAlg();
    eis('T7 de Algemeen-rij in het paneel bestaat bij gemengde data',
        rijInfo !== null, 'rij aanwezig', rijInfo ? 'aanwezig' : 'weg');
    eis('T7b en toont het gefilterde aantal',
        rijInfo && rijInfo.textContent.indexOf('(2×)') >= 0,
        '(2×)', rijInfo ? rijInfo.textContent.trim() : '—');
    // De rij is het merge-DOEL; hij mag nooit verdwijnen zolang de node V4 heeft.
    zetNode([gemerkt(20, 6), gemerkt(20, 7)]);
    renderNodeInfo(String(NODE));
    const rijLeeg = infoAlg();
    eis('T7c de rij blijft staan als er niets van Algemeen over is — hij is het samenvoegdoel',
        rijLeeg !== null && rijLeeg.getAttribute('data-key') === 'ALG',
        'rij met data-key ALG', rijLeeg ? rijLeeg.getAttribute('data-key') : 'rij weg');
    eis('T7d en zegt dan eerlijk dat er niets is, in plaats van een vals percentage',
        rijLeeg && rijLeeg.textContent.indexOf('nog geen eigen metingen') >= 0
        && rijLeeg.textContent.indexOf('%') < 0,
        'tekst zonder percentage', rijLeeg ? rijLeeg.textContent.trim() : '—');
    // Een node zonder enige V4-data houdt geen Algemeen-rij — ongewijzigd.
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, null);
    renderNodeInfo(String(NODE));
    eis('T7e een node zonder V4-data heeft nog steeds geen Algemeen-rij',
        infoAlg() === null, 'geen rij', infoAlg() ? 'rij aanwezig' : 'geen rij');

    // ══ T8 — DE COUNTDOWN BLIJFT ALLES ZIEN ═══════════════════
    // D2's kern: richting-verwante metingen tellen niet mee in het PERCENTAGE
    // maar voeden de countdown wél. Deze release mag daar niet aan komen.
    zetNode([v4(60, 4), gemerkt(20, 6), gemerkt(20, 7), gemerkt(20, 8)]);
    const volle = laadM(NODE, DD_NU);
    eis('T8 laadM levert nog steeds de volle set aan de countdownkant',
        volle.length === 4, '4 records', volle.length + ' records');
    eis('T8b en het gewogen gemiddelde daarvan is dus niet dat van Algemeen alleen',
        Math.round(gewGem(volle)) !== 60 && gewGem(volle) > 0,
        'mengsel, niet 60s', Math.round(gewGem(volle)) + 's');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    getoondeLaag = bewaard.getoondeLaag;
    getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingKnoppenNodeId = bewaard.richtingKnoppenNodeId;
    richtingGedruktVoorNode = bewaard.richtingGedruktVoorNode;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    huidigCdBron = bewaard.huidigCdBron;
    nodeInfoNodeId = bewaard.nodeInfoNodeId;
    mergeModusAan = bewaard.mergeModusAan;
    mergeSelectie = bewaard.mergeSelectie;
    const blok = document.getElementById('richting-blok-body');
    if (blok && bewaard.blokHtml != null) blok.innerHTML = bewaard.blokHtml;
    const info = document.getElementById('node-info-body');
    if (info && bewaard.infoHtml != null) info.innerHTML = bewaard.infoHtml;
    const ind = document.getElementById('v9-richting-indicator');
    if (ind) ind.style.display = bewaard.indicDisp;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testAlgemeenEigenData = testAlgemeenEigenData;
