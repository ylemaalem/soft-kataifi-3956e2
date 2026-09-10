// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_algemeen_keuze.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.93 (richting release 2): Algemeen krijgt zijn eigen waarde
//  in richtingLockKeuze in plaats van "geen van de drie richtingen" te zijn.
//
//  WAT HIER BEWAAKT WORDT
//  Twee symptomen met één bron. De koppel-chip in de Algemeen-regel bood
//  'zelfde als →?' aan zodra er een richting-lock stond — ook een lock die
//  activeerPersistenteRichting zonder tik had teruggezet. En de
//  afstandsindicator bleef een richtingpijl tonen nadat je op Algemeen drukte,
//  omdat hij op precies één plek verborgen werd (resetRijrichtingState) en die
//  bij een node-wissel draait, niet bij een categoriewissel.
//
//  DE TWEEDE AS IS DE ECHTE VALKUIL
//  richtingLockKeuze wordt óók gelezen als "waar rijd ik heen": de
//  enkelricht-ontkapping (r3410), de bbox-bonus (r6482), de pijl in de
//  countdown-pill, de richtingknoppen, de tekortmelding en de GPS-keten. Op die
//  as bestaat Algemeen niet. rijrichting() projecteert de keuze daarop weg.
//  T7 en T8 zetten vast dat die projectie klopt in beide richtingen — te ruim
//  en een node zou 'algemeen' als rijrichting behandelen, te streng en de drie
//  echte richtingen zouden hun gedrag verliezen.
//
//  DE KOPPELING IS EEN ANDER MECHANISME
//  sl_enkelricht_ ("Algemeen is hier hetzelfde licht als rechtsaf") staat los
//  van deze keuze en moest ongemoeid blijven. T9 en T10 bewaken dat: een
//  bestaande koppeling blijft zichtbaar en opzegbaar terwijl Algemeen actief
//  is, en het aanbod om te koppelen verdwijnt alleen als aanbod.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_algemeen_keuze.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testAlgemeenKeuze().regels);
// ═══════════════════════════════════════════════════════════════

function testAlgemeenKeuze() {
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
    v9PreSelectieAfrij, richtingTekort, huidigCdBron,
    indicHtml: (document.getElementById('v9-richting-indicator') || {}).innerHTML,
    indicDisp: (document.getElementById('v9-richting-indicator') || {}).style
                 ? document.getElementById('v9-richting-indicator').style.display : null,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML
  };

  const nu = Date.now();
  const NODE = 991201;
  const DD_NU = huidigDDActief();
  // obs === duur en gewicht 1 laat vlakGewichtVoor de vlakke weging kiezen —
  // hetzelfde pad als een echte s1-meting.
  const recs = (n, duur) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ duur, tijd: nu - i * 60000, gewicht: 1, obs: duur, bron: 's1' });
    return a;
  };

  const indic  = () => document.getElementById('v9-richting-indicator');
  const zicht  = () => indic().style.display !== 'none';
  const rijen  = () => [...document.querySelectorAll('#richting-blok-body .rb-rij')];
  const algRij = () => rijen().find(r => r.querySelector('.rb-label').textContent.trim().startsWith('Algemeen'));
  const chip   = () => { const r = algRij(); return r ? r.querySelector('.rb-koppel') : null; };
  const chipTxt = () => { const c = chip(); return c ? c.textContent.trim() : null; };

  try {
    // ══ FIXTURE ═══════════════════════════════════════════════
    // Algemeen heeft data (heeftAlg waar, dus de ALG-rij wordt getekend) en één
    // richting N>W met eigen metingen, zodat er ook een richtingrij staat om
    // tussen te wisselen.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(recs(8, 60)));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(recs(6, 24)));
    zetLS('sl_richting_' + NODE, JSON.stringify({
      headings: [0, 2, 1, 3, 0, 1, 2, 1], laatste_update: nu, bevestigingen: 8 }));
    zetLS('sl_neutraal_'   + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);

    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'Testkruising' };
    getoondDagdeel = null;
    richtingBlokVerborgen = false;
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0;
    huidigCdBron = null;

    const opnieuw = (keuze) => {
      getoondeLaag = null;
      richtingLockKeuze = keuze;
      richtingLockNodeId = (keuze === null) ? null : String(NODE);
      richtingGedruktVoorNode = null;
      bijwerkLeerkaart(dichtstbijOSM);
    };

    // ══ T1 — OP ALGEMEEN DRUKKEN IS EEN KEUZE ═════════════════
    opnieuw('rechts');
    kiesLaagAlgemeen();
    eis('T1 kiesLaagAlgemeen zet richtingLockKeuze op algemeen',
        richtingLockKeuze === 'algemeen', "'algemeen'", String(richtingLockKeuze));
    eis('T1b en zet de lock op de node waar je staat',
        richtingLockNodeId === String(NODE), String(NODE), String(richtingLockNodeId));
    eis('T1c de getoonde laag gaat mee terug naar Algemeen',
        getoondeLaag === null, 'null', JSON.stringify(getoondeLaag));

    // ══ T2 — DE KOPPEL-CHIP ═══════════════════════════════════
    opnieuw('rechts');
    eis('T2 met een richting-lock biedt de Algemeen-regel de koppeling aan',
        chipTxt() !== null && chipTxt().indexOf('zelfde als') === 0,
        "'zelfde als →?'", String(chipTxt()));
    kiesLaagAlgemeen();
    eis('T2b na Algemeen verdwijnt dat aanbod',
        chip() === null, 'geen chip', String(chipTxt()));

    // De ECHTE aanleiding: de lock die zonder tik werd teruggezet.
    opnieuw(null);
    activeerPersistenteRichting(String(NODE), 'rechts');
    bijwerkLeerkaart(dichtstbijOSM);
    eis('T2c ook een lock uit activeerPersistenteRichting toont het aanbod nog',
        chipTxt() !== null && chipTxt().indexOf('zelfde als') === 0,
        "'zelfde als →?'", String(chipTxt()));
    kiesLaagAlgemeen();
    eis('T2d en verdwijnt zodra de gebruiker Algemeen kiest',
        chip() === null && richtingLockKeuze === 'algemeen',
        'geen chip, keuze algemeen',
        (chip() ? 'chip: ' + chipTxt() : 'geen chip') + ', keuze ' + richtingLockKeuze);

    // ══ T3 — DE AFSTANDSINDICATOR ═════════════════════════════
    // Precies het scenario van de gebruiker: rechtsaf-pijl staat in beeld,
    // Algemeen indrukken, pijl weg.
    opnieuw(null);
    activeerPersistenteRichting(String(NODE), 'rechts');
    eis('T3 de pijl staat in beeld na een richting',
        zicht() && indic().textContent.indexOf('rechtsaf') >= 0,
        'zichtbaar, rechtsaf', zicht() ? indic().textContent : 'verborgen');
    kiesLaagAlgemeen();
    eis('T3b en verdwijnt zodra Algemeen wordt ingedrukt',
        !zicht(), 'verborgen', indic().style.display);

    // Ook vanuit een echte tik, niet alleen de persistente route.
    opnieuw(null);
    richtingKnoppenNodeId = String(NODE);
    tikRichting('links');
    eis('T3c ook een getikte richting zet de pijl aan',
        zicht(), 'zichtbaar', indic().style.display);
    kiesLaagAlgemeen();
    eis('T3d en Algemeen zet hem weer uit',
        !zicht(), 'verborgen', indic().style.display);

    // ══ T4 — HEEN EN WEER ═════════════════════════════════════
    opnieuw('rechts');
    kiesLaagAlgemeen();
    const naAlg = { k: richtingLockKeuze, chip: chip() === null, pijl: !zicht() };
    richtingKnoppenNodeId = String(NODE);
    richtingGedruktVoorNode = null;
    tikRichting('rechts');
    bijwerkLeerkaart(dichtstbijOSM);
    eis('T4 van Algemeen terug naar een richting werkt',
        richtingLockKeuze === 'rechts' && zicht(),
        "'rechts', pijl zichtbaar", richtingLockKeuze + ', pijl ' + indic().style.display);
    eis('T4b en het koppelaanbod komt terug',
        chipTxt() !== null && chipTxt().indexOf('zelfde als') === 0,
        "'zelfde als →?'", String(chipTxt()));
    kiesLaagAlgemeen();
    eis('T4c en weer naar Algemeen geeft dezelfde uitkomst als de eerste keer',
        richtingLockKeuze === naAlg.k && (chip() === null) === naAlg.chip && (!zicht()) === naAlg.pijl,
        'identiek aan de eerste wissel',
        richtingLockKeuze + ', chip ' + (chip() === null) + ', pijl-uit ' + !zicht());

    // ══ T5 — DE DRIE RICHTINGEN ONGEWIJZIGD ═══════════════════
    let regressieOk = true, detail = [];
    for (const r of ['links', 'rechtdoor', 'rechts']) {
      opnieuw(r);
      const c = chipTxt();
      const goed = c !== null && c.indexOf('zelfde als') === 0;
      if (!goed) { regressieOk = false; detail.push(r + ': ' + c); }
    }
    eis('T5 alle drie de richtingen tonen het koppelaanbod zoals voorheen',
        regressieOk, '3x aanbod', detail.length ? detail.join(' | ') : '3x aanbod');
    opnieuw(null);
    eis('T5b zonder keuze staat er geen chip — ongewijzigd gedrag',
        chip() === null, 'geen chip', String(chipTxt()));

    // ══ T6 — DE STANDAARDWAARDE BLIJFT null ═══════════════════
    // Een node waar nog nooit iets is gekozen mag niet doen alsof Algemeen
    // gekozen is: de logvelden zouden dan op elke regel 'algemeen' schrijven en
    // 'niets aangeraakt' zou onzichtbaar worden.
    opnieuw(null);
    eis('T6 zonder keuze is richtingLockKeuze null en niet algemeen',
        richtingLockKeuze === null, 'null', String(richtingLockKeuze));
    eis('T6b en de pijl staat dan ook niet aan',
        !zicht(), 'verborgen', indic().style.display);

    // ══ T7 — DE PROJECTIE OP DE RIJRICHTING-AS ════════════════
    const proj = {};
    for (const v of ['links', 'rechtdoor', 'rechts', 'algemeen', null]) {
      richtingLockKeuze = v;
      proj[String(v)] = rijrichting();
    }
    eis('T7 de drie richtingen komen ongewijzigd door de projectie',
        proj.links === 'links' && proj.rechtdoor === 'rechtdoor' && proj.rechts === 'rechts',
        'links/rechtdoor/rechts', JSON.stringify(proj));
    eis('T7b algemeen is geen rijrichting en wordt null',
        proj.algemeen === null, 'null', String(proj.algemeen));
    eis('T7c en null blijft null',
        proj['null'] === null, 'null', String(proj['null']));

    // ══ T8 — WAT DE RIJRICHTING-AS ERVAN MERKT ════════════════
    // rijrichtingMatchScore is de bbox-bonus. Onder Algemeen mag hij geen
    // richting claimen; onder een echte richting moet hij precies doen wat hij
    // altijd deed.
    richtingLockKeuze = 'rechts';
    const bonusRechts = rijrichtingMatchScore(0.8, rijrichting());
    richtingLockKeuze = 'algemeen';
    const bonusAlg = rijrichtingMatchScore(0.8, rijrichting());
    eis('T8 de bbox-bonus werkt onverminderd voor een echte richting',
        bonusRechts === 0.20, '0.20', String(bonusRechts));
    eis('T8b en claimt niets onder Algemeen',
        bonusAlg === 0, '0', String(bonusAlg));

    // De richtingknoppen: een Algemeen-keuze mag ze niet blokkeren zoals een
    // richting-lock dat doet.
    richtingLockNodeId = String(NODE);
    richtingLockKeuze = 'rechts';
    const blokRichting = (richtingLockNodeId === String(NODE) && rijrichting()) ? true : false;
    richtingLockKeuze = 'algemeen';
    const blokAlg = (richtingLockNodeId === String(NODE) && rijrichting()) ? true : false;
    eis('T8c een richting-lock blijft de knoppen onderdrukken',
        blokRichting === true, 'true', String(blokRichting));
    eis('T8d een Algemeen-keuze doet dat niet',
        blokAlg === false, 'false', String(blokAlg));

    // ══ T9 — sl_enkelricht_ ONGEMOEID ═════════════════════════
    // De koppeling zelf: opslaan, lezen, wissen. Geen enkele van deze drie
    // raakt richtingLockKeuze aan en omgekeerd.
    zetLS('sl_enkelricht_' + NODE, null);
    zetEnkelRicht(String(NODE), 'rechts');
    eis('T9 zetEnkelRicht schrijft en laadEnkelRicht leest, zoals altijd',
        laadEnkelRicht(String(NODE)) === 'rechts', "'rechts'", String(laadEnkelRicht(String(NODE))));
    richtingLockKeuze = 'algemeen';
    eis('T9b de koppeling overleeft een Algemeen-keuze',
        laadEnkelRicht(String(NODE)) === 'rechts', "'rechts'", String(laadEnkelRicht(String(NODE))));
    opnieuw('algemeen');
    eis('T9c en blijft zichtbaar én opzegbaar in de Algemeen-regel',
        chipTxt() !== null && chipTxt().indexOf('=') === 0,
        "'= → ✕'", String(chipTxt()));
    wisEnkelRicht(String(NODE));
    eis('T9d wisEnkelRicht haalt hem weg zoals voorheen',
        laadEnkelRicht(String(NODE)) === null, 'null', String(laadEnkelRicht(String(NODE))));

    // ══ T10 — KOPPELEN VANUIT ALGEMEEN IS EEN NO-OP ═══════════
    // koppelEnkelRicht koppelt "de huidige actieve rijrichting". Die is er niet
    // onder Algemeen, dus er mag niets geschreven worden — geen halve markering.
    zetLS('sl_enkelricht_' + NODE, null);
    richtingLockKeuze = 'algemeen';
    koppelEnkelRicht(String(NODE));
    eis('T10 koppelen zonder rijrichting schrijft niets',
        laadEnkelRicht(String(NODE)) === null, 'null', String(laadEnkelRicht(String(NODE))));
    richtingLockKeuze = 'rechtdoor';
    koppelEnkelRicht(String(NODE));
    eis('T10b met een echte rijrichting koppelt hij wel — ongewijzigd',
        laadEnkelRicht(String(NODE)) === 'rechtdoor',
        "'rechtdoor'", String(laadEnkelRicht(String(NODE))));

    // ══ T11 — DE ONTKAPPING VOLGT DEZELFDE REGEL ══════════════
    // De enkelricht-ontkapping (r3410) vergelijkt de markering met de rijrichting.
    // Onder Algemeen is er geen rijrichting, dus valt hij terug op de veilige,
    // gecapte klasse in plaats van zekerheid te claimen die er niet is.
    zetEnkelRicht(String(NODE), 'rechts');
    richtingLockKeuze = 'rechts';
    const matchRechts = (laadEnkelRicht(String(NODE)) === rijrichting());
    richtingLockKeuze = 'algemeen';
    const matchAlg = (laadEnkelRicht(String(NODE)) === rijrichting());
    eis('T11 de markering matcht de rijrichting waarvoor hij gezet is',
        matchRechts === true, 'true', String(matchRechts));
    eis('T11b en matcht niet onder Algemeen — geen ongegronde ontkapping',
        matchAlg === false, 'false', String(matchAlg));

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
    richtingTekort = bewaard.richtingTekort;
    huidigCdBron = bewaard.huidigCdBron;
    // De indicator terug op wat er stond: tikRichting en de nieuwe
    // Algemeen-tak schrijven allebei in dit element, dus een achtergebleven
    // pijl zou in het echte scherm blijven hangen na een testrun.
    const el = document.getElementById('v9-richting-indicator');
    if (el) { el.innerHTML = bewaard.indicHtml; el.style.display = bewaard.indicDisp; }
    const blok = document.getElementById('richting-blok-body');
    if (blok && bewaard.blokHtml != null) blok.innerHTML = bewaard.blokHtml;
    // tikRichting plant een verbergRichtingKnoppen op 1200ms; die zou na de
    // suite alsnog vuren. Nu meteen, zodat er geen losse timer overblijft.
    try { verbergRichtingKnoppen(); } catch (e) {}
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testAlgemeenKeuze = testAlgemeenKeuze;
