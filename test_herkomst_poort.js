// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_herkomst_poort.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.10: een automatisch herstelde richting mag de countdown nog
//  sturen, maar schrijft geen V5-meting meer weg. Alleen een echte tik doet dat.
//
//  WAT ER MIS WAS
//  v9PreSelectieAfrij werd gevuld door tikRichting (een mens duwt) én door
//  activeerPersistenteRichting (de app herstelt een eerder opgeslagen richting).
//  Het schrijfpad kende alleen de waarde. Daardoor schreef elk bezoek aan een
//  kruispunt met een opgeslagen richting een nieuwe meting weg, en schreef een
//  tik op ALGEMEEN de oude richting alsnog weg.
//
//  T1 EN T2 ZIJN LETTERLIJK DE TWEE REPRODUCTIES UIT HET ONDERZOEKSRAPPORT.
//  Vóór de reparatie gaven ze allebei een V5-record; nu geen van beide.
//
//  T3 IS DE REGRESSIEWACHT DIE HET ZWAARST WEEGT: een echte tik moet nog gewoon
//  schrijven. Een reparatie die alle metingen tegenhoudt, repareert niets.
//
//  T4 BEWAAKT OPTIE B: lezen mag, schrijven niet. kiesCountdownBron geeft voor
//  een herstelde richting exact hetzelfde als voorheen.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_herkomst_poort.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testHerkomstPoort().regels);
// ═══════════════════════════════════════════════════════════════

function testHerkomstPoort() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const A = 888101, B = 888102;
  const DD = huidigDDActief();

  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos, huidigeRichting, snelheidKmh,
    v9KandidaatNode, v9KandidaatDuur, v9KandidaatDagdeel, v9KandidaatZagOvergang,
    v9KandidaatV4Geschreven, v9KandidaatV4Stempels, v9KandidaatV5Geschreven,
    v9KandidaatV5Paar, v9DelayedWriteActief, v9PassageStartTijd, afrijHeadingBuffer,
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij, preZet, preWis,
    richtingLockKeuze, richtingLockNodeId, richtingLockBron, richtingGedruktVoorNode,
    richtingKnoppenNodeId, getoondeLaag, huidigBevestigdOsmNodeId
  };
  const bewaardLS = new Map();
  const merkLS = () => {
    for (const k of Object.keys(localStorage)) {
      if ((k.includes(String(A)) || k.includes(String(B))) && !bewaardLS.has(k)) {
        bewaardLS.set(k, localStorage.getItem(k));
      }
    }
  };
  const wis = () => {
    for (const k of Object.keys(localStorage)) {
      if (k.includes(String(A)) || k.includes(String(B))) localStorage.removeItem(k);
    }
  };
  const v5van = (n) => Object.keys(localStorage).filter(k => k.startsWith('sl_v5_' + n + '_'));

  // Een node voor rood, koers noord, candidate vastgeklikt, geen lock.
  const opzet = (node, opgeslagen) => {
    wis();
    if (opgeslagen) {
      localStorage.setItem('sl_richting_' + node, JSON.stringify({
        tikrichting: opgeslagen, tik_bevestigingen: 3, headings: [0, 1, 2],
        laatste_update: Date.now(), bevestigingen: 3 }));
    }
    huidigePos = { lat: 52.0, lon: 4.7 }; huidigeRichting = 0; snelheidKmh = 0;
    osmCache = [{ id: node, lat: 52.0, lon: 4.7, naam: 'N' + node, afstand: 10 }];
    dichtstbijOSM = { ...osmCache[0] };
    richtingKnoppenNodeId = String(node);
    huidigBevestigdOsmNodeId = String(node);
    v9AanrijSnelheidHeading = 0; v9AanrijHeading = 0;
    v9KandidaatNode = String(node); v9KandidaatDuur = null; v9KandidaatDagdeel = DD;
    v9KandidaatZagOvergang = null; v9KandidaatV4Geschreven = false;
    v9KandidaatV4Stempels = []; v9KandidaatV5Geschreven = false; v9KandidaatV5Paar = null;
    v9DelayedWriteActief = false; v9PassageStartTijd = null; afrijHeadingBuffer = [];
    v9PreSelectieAfrij = null; preZet = null; preWis = null;
    richtingLockKeuze = null; richtingLockNodeId = null; richtingLockBron = null;
    richtingGedruktVoorNode = null; getoondeLaag = null;
  };

  merkLS();
  try {
    // ═══ T1 — REPRODUCTIE 1: DE ALGEMEEN-TIK ═════════════════
    // ── V11.18.18: HET HERSTELPAD BESTAAT NIET MEER ─────────
    // T1a eiste dat de app de oude richting zelf terugzette. Sinds rond licht de
    // vaste standaard is, gebeurt dat niet meer — de toets eist nu het
    // omgekeerde. Het SCENARIO van deze test blijft wel bestaan: de gebruiker
    // tikt zelf een richting en zegt daarna "rond licht". Dat is precies waar
    // V11.18.10 voor gebouwd is, dus de pre-selectie wordt hier met een echte
    // tik gezet in plaats van door de app.
    opzet(A, 'rechtdoor');
    toonRichtingKnoppen(String(A));
    eis('T1a vooraf: de app herstelt de oude richting NIET meer',
        v9PreSelectieAfrij === null && richtingLockBron === null,
        'pre null, bron null', 'pre ' + v9PreSelectieAfrij + ', bron ' + richtingLockBron);
    richtingKnoppenNodeId = String(A);
    tikRichting('rechtdoor', 'vraag');               // nu tikt de gebruiker zelf
    eis('T1a2 en een echte tik zet hem wel, met herkomst tik',
        v9PreSelectieAfrij === 'Z' && richtingLockBron === 'tik',
        "pre 'Z', bron 'tik'", 'pre ' + v9PreSelectieAfrij + ', bron ' + richtingLockBron);
    kiesLaagAlgemeen();                              // de gebruiker zegt: rond licht
    eis('T1b de Algemeen-tik wist de pre-selectie',
        v9PreSelectieAfrij === null, 'null', String(v9PreSelectieAfrij));
    eis('T1c en ook preZet van deze node, zodat de terugval niets redt',
        preZet === null || preZet.node !== String(A), 'geen preZet voor A',
        JSON.stringify(preZet));
    const g1 = schrijfV5DirectBijGroen(String(A), 40, DD, 10, []);
    eis('T1 na een Algemeen-tik wordt er GEEN richting-meting weggeschreven',
        g1 === false && v5van(A).length === 0,
        'false, 0 V5-records', g1 + ', ' + v5van(A).join(','));
    // ook de late keten niet
    v9KandidaatDuur = 40; v9DelayedWriteActief = true; v9PassageStartTijd = Date.now();
    voerV9DelayedWriteUit(180, 'test', '-', false);
    eis('T1d ook de late keten schrijft na de Algemeen-tik niets',
        v5van(A).length === 0, '0 V5-records', v5van(A).join(',') || '0');

    // ═══ T2 — REPRODUCTIE 2: GEEN TIK, OUDE RICHTING BIJ B ═══
    opzet(B, 'links');
    toonRichtingKnoppen(String(B));
    eis('T2a vooraf: B krijgt zijn oude richting NIET meer terug (V11.18.18)',
        v9PreSelectieAfrij === null && richtingLockBron === null,
        'pre null, bron null', 'pre ' + v9PreSelectieAfrij + ', bron ' + richtingLockBron);
    const g2 = schrijfV5DirectBijGroen(String(B), 45, DD, 12, []);
    eis('T2 zonder tik wordt bij B GEEN meting weggeschreven',
        g2 === false && v5van(B).length === 0,
        'false, 0 V5-records', g2 + ', ' + v5van(B).join(','));
    v9KandidaatDuur = 45; v9DelayedWriteActief = true; v9PassageStartTijd = Date.now();
    voerV9DelayedWriteUit(90, 'test', '-', false);
    eis('T2b ook de late keten schrijft bij B niets',
        v5van(B).length === 0, '0 V5-records', v5van(B).join(',') || '0');
    // V11.18.18: een herstelde pre-selectie ontstaat niet meer vanzelf, dus
    // zetten we hem hier met de hand — de poort moet hem blijven weigeren.
    eis('T2c bepaalGetikteAfrij weigert een herstelde richting',
        (opzet(B, 'links'), v9PreSelectieAfrij = 'O',
         markeerPreZet(String(B), 'O', 'hersteld'),
         bepaalGetikteAfrij(String(B), 0)) === null,
        'null', 'afgewezen');

    // ═══ T3 — EEN ECHTE TIK SCHRIJFT NOG GEWOON ══════════════
    opzet(A, null);
    tikRichting('rechts');                           // een mens duwt
    eis('T3a vooraf: de tik zet bron "tik" op deze node',
        richtingLockBron === 'tik' && richtingLockNodeId === String(A)
          && preZet && preZet.bron === 'tik',
        "bron 'tik', node A, preZet 'tik'",
        richtingLockBron + ', ' + richtingLockNodeId + ', ' + (preZet && preZet.bron));
    const g3 = schrijfV5DirectBijGroen(String(A), 40, DD, 10, []);
    eis('T3 een echte tik schrijft nog steeds een V5-meting',
        g3 === true && v5van(A).length === 1,
        'true, 1 V5-record', g3 + ', ' + v5van(A).join(','));
    eis('T3b en het record draagt bron "tik"',
        (JSON.parse(localStorage.getItem(v5van(A)[0]) || '[]')[0] || {}).bron === 'tik',
        "bron 'tik'", String((JSON.parse(localStorage.getItem(v5van(A)[0]) || '[]')[0] || {}).bron));

    // Een tik die zijn lock door afstand kwijt is, mag nog via preZet worden
    // gered — dat is precies waarvoor de terugval van V11.17.56 R5 bestaat.
    opzet(A, 'rechts');
    tikRichting('rechts');
    wisRichtingLock();                               // >60m en >5 km/u
    v9PreSelectieAfrij = null;                       // resetRijrichtingState
    const gered = bepaalGetikteAfrij(String(A), 0);
    eis('T3c een echte tik met gewiste lock wordt nog via preZet gered',
        gered && gered.afrij === 'W' && gered.bron === 'teruggehaald',
        "W via 'teruggehaald'", JSON.stringify(gered));

    // ═══ T4 — OPTIE B IS VERVALLEN MET V11.18.18 ════════════
    // ── DEZE TOETS STAAT OM, EN DAT IS DE KERN VAN DIE RELEASE ──
    // V11.18.10 koos bewust optie B: een herstelde richting mocht de countdown
    // nog sturen, maar niets meer wegschrijven. Die tussenvorm is met V11.18.18
    // opgeheven — rond licht is de standaard, dus een richting die de app zelf
    // invulde stuurt ook het scherm niet meer. Schrijven én tonen volgen nu
    // dezelfde herkomst, en dat was precies de inconsistentie die overbleef.
    opzet(A, 'rechts');
    localStorage.setItem('sl_v5_' + A + '_N_W_' + DD, JSON.stringify(
      [{ duur: 28, tijd: Date.now(), gewicht: 1, bron: 'tik' }]));
    localStorage.setItem('sl_v4_' + A + '_' + DD, JSON.stringify(
      [{ duur: 60, tijd: Date.now(), gewicht: 1, obs: 60, bron: 's1' }]));
    toonRichtingKnoppen(String(A));                  // zet niets meer terug
    // de pre-selectie met de hand op 'hersteld', zoals die vroeger ontstond
    v9PreSelectieAfrij = 'W';
    markeerPreZet(String(A), 'W', 'hersteld');
    const cd = kiesCountdownBron(String(A), DD, 'N', v9PreSelectieAfrij);
    eis('T4 een herstelde richting stuurt de countdown NIET meer — het ronde ' +
        'licht (60s) wint van de richting (28s)',
        cd && cd.v5 === false && Math.round(cd.gem) === 60,
        'rond licht, 60s', cd ? (cd.bron + ', ' + Math.round(cd.gem) + 's') : 'null');
    eis('T4b en schrijft er evenmin een nieuwe meting bij',
        schrijfV5DirectBijGroen(String(A), 31, DD, 10, []) === false
          && JSON.parse(localStorage.getItem('sl_v5_' + A + '_N_W_' + DD)).length === 1,
        'nog steeds 1 record',
        JSON.parse(localStorage.getItem('sl_v5_' + A + '_N_W_' + DD)).length + ' records');
    // En de spiegel: dezelfde richting, nu wél door de gebruiker getikt. Dan
    // stuurt hij de countdown en mag er ook geschreven worden — de twee rechten
    // lopen sinds V11.18.18 op dezelfde herkomst.
    richtingKnoppenNodeId = String(A);
    tikRichting('rechts', 'vraag');
    const cdTik = kiesCountdownBron(String(A), DD, 'N', v9PreSelectieAfrij);
    eis('T4c met een ECHTE tik stuurt dezelfde richting de countdown wel',
        cdTik && cdTik.v5 === true && Math.round(cdTik.gem) === 28,
        "'V5 W', 28s", cdTik ? (cdTik.bron + ', ' + Math.round(cdTik.gem) + 's') : 'null');

    // ═══ T5 — ALGEMEEN, DAN TOCH EEN RICHTING ════════════════
    opzet(A, null);
    kiesLaagAlgemeen();
    tikRichting('links');
    eis('T5 een verse tik na Algemeen vult de pre-selectie gewoon opnieuw',
        v9PreSelectieAfrij === 'O' && richtingLockBron === 'tik' && richtingLockKeuze === 'links',
        "pre 'O', 'tik', 'links'",
        v9PreSelectieAfrij + ', ' + richtingLockBron + ', ' + richtingLockKeuze);
    const g5 = schrijfV5DirectBijGroen(String(A), 40, DD, 10, []);
    eis('T5b en die tik schrijft normaal',
        g5 === true && v5van(A).length === 1, 'true, 1 record', g5 + ', ' + v5van(A).length);

    // ═══ T6 — DE NODE-TOETS ══════════════════════════════════
    // Een echte tik op A mag geen herkomst leveren voor B.
    opzet(A, null);
    tikRichting('rechts');                           // lock en preZet op A
    eis('T6 een tik op A geldt niet als tik op B',
        tikHerkomstEcht(String(A)) === true && tikHerkomstEcht(String(B)) === false,
        'A ja, B nee',
        'A ' + tikHerkomstEcht(String(A)) + ', B ' + tikHerkomstEcht(String(B)));
    v9KandidaatNode = String(B);                     // de kandidaat verschuift
    const g6 = schrijfV5DirectBijGroen(String(B), 40, DD, 10, []);
    eis('T6b en schrijft dus niets bij B, ook al staat de pre-selectie nog',
        g6 === false && v5van(B).length === 0,
        'false, 0 records bij B', g6 + ', ' + v5van(B).length);

    // ═══ T7 — V11.18.1 MEET DEZELFDE POORT ═══════════════════
    opzet(B, 'links');
    toonRichtingKnoppen(String(B));
    const zl = v5ZouLukken(String(B), 40);
    eis('T7 v5ZouLukken telt een herstelde richting niet als bruikbaar',
        zl.ok === false && zl.reden === 'v5_geen_tik',
        "ok false, 'v5_geen_tik'", zl.ok + ', ' + zl.reden);

  } finally {
    wis();
    for (const [k, v] of bewaardLS) { if (v !== null) localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos; huidigeRichting = bewaard.huidigeRichting;
    snelheidKmh = bewaard.snelheidKmh;
    v9KandidaatNode = bewaard.v9KandidaatNode; v9KandidaatDuur = bewaard.v9KandidaatDuur;
    v9KandidaatDagdeel = bewaard.v9KandidaatDagdeel;
    v9KandidaatZagOvergang = bewaard.v9KandidaatZagOvergang;
    v9KandidaatV4Geschreven = bewaard.v9KandidaatV4Geschreven;
    v9KandidaatV4Stempels = bewaard.v9KandidaatV4Stempels;
    v9KandidaatV5Geschreven = bewaard.v9KandidaatV5Geschreven;
    v9KandidaatV5Paar = bewaard.v9KandidaatV5Paar;
    v9DelayedWriteActief = bewaard.v9DelayedWriteActief;
    v9PassageStartTijd = bewaard.v9PassageStartTijd;
    afrijHeadingBuffer = bewaard.afrijHeadingBuffer;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij; preZet = bewaard.preZet;
    preWis = bewaard.preWis;
    richtingLockKeuze = bewaard.richtingLockKeuze; richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingLockBron = bewaard.richtingLockBron;
    richtingGedruktVoorNode = bewaard.richtingGedruktVoorNode;
    richtingKnoppenNodeId = bewaard.richtingKnoppenNodeId;
    getoondeLaag = bewaard.getoondeLaag;
    huidigBevestigdOsmNodeId = bewaard.huidigBevestigdOsmNodeId;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testHerkomstPoort = testHerkomstPoort;
