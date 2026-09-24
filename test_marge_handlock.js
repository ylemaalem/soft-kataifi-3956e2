// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_marge_handlock.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.7, twee wijzigingen die elkaar nodig hebben:
//    1. NODE_CHK_CORRECTIE_MARGE_M van 20 naar 8
//    2. een handmatige nodekeuze vervalt zodra een ander licht aantoonbaar
//       substantieel dichterbij ligt
//
//  WAAROM SAMEN. Zolang de marge op 20 staat, komt een zojuist ontgrendelde
//  hand-lock-node niet voorbij de afstandsroute en verandert er niets op het
//  scherm. Wijziging 2 heeft wijziging 1 nodig om effect te hebben; T4 toetst
//  die koppeling expliciet op het Eendrachtsplein-scenario.
//
//  DE MEETBASIS
//  Export 12 september, 20 afwijkingen: 0 0 0 2 3 4 4 4 6 7 8 8 8 9 11 13 14
//  15 15 38, mediaan 7,5 m. Het natuurlijke gat ligt tussen 4 en 6. Onder de 5
//  gaat het om buurlampen van dezelfde kruising of GPS-ruis; daar corrigeren
//  kost de lopende countdown (corrigeerNodeAutomatisch roept beeindigFase aan).
//
//  T3 IS DE BESCHERMING DIE MOET BLIJVEN
//  Een tap op een licht waar je vervolgens vóór staat mag NOOIT vervallen. De
//  nieuwe voorwaarde kan per constructie alleen vuren als er een aantoonbaar
//  betere kandidaat is — T3 legt dat vast op de 2m- en 4m-episodes uit de
//  analyse.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_marge_handlock.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testMargeHandlock().regels);
// ═══════════════════════════════════════════════════════════════

function testMargeHandlock() {
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

  const GEKOZEN = 999701;   // de vergrendelde / actieve node
  const CLOSEST = 999702;   // de werkelijk dichtstbijzijnde

  const bewaard = {
    dichtstbijOSM, puurDichtsteNodeCache, osmCache, huidigePos, huidigeRichting,
    snelheidKmh, stilstandSinds, laatsteNodeCorrectieTijd,
    handmatigLockActief, stilstandAutoLock, handmatigGeselecteerdNodeId,
    headingBufferInhoud: headingBuffer.slice(),
    hoekStabielSleutel, hoekStabielTeller, nodeCorrWeiger,
    vorigOsmId, dichtstbijOSMTwijfel, laatsteNodeWisselTijd
  };

  const logRegels = (reden) => {
    try {
      return (JSON.parse(localStorage.getItem('sl_opslaglog')) || [])
        .filter(r => r && r.reden === reden);
    } catch (e) { return []; }
  };

  // Twee nodes pal noord van de waarnemer, op instelbare afstand en hoek.
  const mPerGraadLat = 111320;
  const nodeOp = (id, af, hoekGr) => {
    const h = (hoekGr || 0) * Math.PI / 180;
    return {
      id, naam: 'Test ' + id,
      lat: 52.0 + (af * Math.cos(h)) / mPerGraadLat,
      lon: 4.7 + (af * Math.sin(h)) / (mPerGraadLat * Math.cos(52.0 * Math.PI / 180)),
      afstand: af
    };
  };

  const opzet = (o) => {
    const opt = o || {};
    huidigePos = { lat: 52.0, lon: 4.7 };
    huidigeRichting = 0;
    const g = nodeOp(GEKOZEN, opt.gekozenAf != null ? opt.gekozenAf : 46,
                     opt.gekozenHoek != null ? opt.gekozenHoek : 0);
    const c = nodeOp(CLOSEST, opt.closestAf != null ? opt.closestAf : 8,
                     opt.closestHoek != null ? opt.closestHoek : 48);
    osmCache = [g, c];
    dichtstbijOSM = { ...g };
    puurDichtsteNodeCache = opt.geenClosest ? null : { ...c };
    vorigOsmId = GEKOZEN;
    dichtstbijOSMTwijfel = false;
    snelheidKmh = opt.kmh != null ? opt.kmh : 0;
    stilstandSinds = opt.stilstandSinds !== undefined ? opt.stilstandSinds : (Date.now() - 10000);
    laatsteNodeCorrectieTijd = Date.now() - 60000;
    laatsteNodeWisselTijd = Date.now() - 60000;
    handmatigLockActief = opt.hand !== undefined ? opt.hand : true;
    stilstandAutoLock   = opt.autoLock !== undefined ? opt.autoLock : false;
    handmatigGeselecteerdNodeId = opt.lockNode !== undefined ? opt.lockNode : String(GEKOZEN);
    // headingBuffer bevat KALE GRADEN, geen objecten (r10736). Met objecten
    // geeft getSmoothedHeading NaN in plaats van null, en dan glipt elke
    // heading-poort er ongemerkt doorheen: NaN > 60 is false.
    headingBuffer.length = 0;
    headingBuffer.push(opt.heading != null ? opt.heading : 0);
    hoekStabielSleutel = null; hoekStabielTeller = 0;
    nodeCorrWeiger = null;
  };

  try {
    // ═══ T1 — DE MARGE STAAT OP 8 ════════════════════════════
    eis('T1 NODE_CHK_CORRECTIE_MARGE_M is 8',
        NODE_CHK_CORRECTIE_MARGE_M === 8, '8', String(NODE_CHK_CORRECTIE_MARGE_M));
    eis('T1b alle andere vangnetten staan onaangeroerd',
        NODE_CHK_STANDSTILL_KMH === 3 && NODE_CHK_STANDSTILL_DUUR_MS === 3000
          && NODE_WISSEL_MIN_INTERVAL_MS === 10000 && NODE_HOEK_GELIJK_M === 5
          && NODE_HOEK_MIN_AFSTAND_M === 12 && NODE_HOEK_VOORDEEL_GRAD === 25
          && NODE_HOEK_STABIEL_N === 3 && NODE_CHK_HEADING_MAX_GRAD === 60,
        'stilstand 3/3000, bounce 10000, hoek 5/12/25/3, heading 60',
        [NODE_CHK_STANDSTILL_KMH, NODE_CHK_STANDSTILL_DUUR_MS,
         NODE_WISSEL_MIN_INTERVAL_MS, NODE_HOEK_GELIJK_M, NODE_HOEK_MIN_AFSTAND_M,
         NODE_HOEK_VOORDEEL_GRAD, NODE_HOEK_STABIEL_N,
         NODE_CHK_HEADING_MAX_GRAD].join(', '));

    // ═══ T2 — DE EPISODES UIT DE ANALYSE, ÉÉN VOOR ÉÉN ═══════
    // Geen lock, stilstaand: de afstandsroute beslist. Alles vanaf 8 m wordt
    // gecorrigeerd, alles daaronder blijft staan.
    const corrigeert = (afw) => {
      opzet({ hand: false, autoLock: false, gekozenAf: 40, closestAf: 40 - afw,
              closestHoek: 60 });
      checkNodeCorrectieStilstand(huidigePos.lat, huidigePos.lon);
      return String(dichtstbijOSM.id) === String(CLOSEST);
    };
    const welGecorrigeerd = [8, 9, 11, 13, 14, 15, 38].filter(corrigeert);
    const nietGecorrigeerd = [2, 3, 4, 6, 7].filter(a => !corrigeert(a));
    eis('T2 de episodes vanaf 8 m worden nu gecorrigeerd',
        welGecorrigeerd.length === 7,
        '8, 9, 11, 13, 14, 15, 38', welGecorrigeerd.join(', ') || 'geen');
    eis('T2b en de episodes onder de 8 m blijven bewust staan',
        nietGecorrigeerd.length === 5,
        '2, 3, 4, 6, 7 blijven staan', nietGecorrigeerd.join(', ') || 'geen');
    // De grens zelf: 8 haalt het (>=), 7 niet. Zelfde operator als r14893.
    eis('T2c de grens ligt op >= 8, net als de bestaande vergelijking',
        corrigeert(8) === true && corrigeert(7) === false,
        '8 wel, 7 niet',
        '8: ' + corrigeert(8) + ', 7: ' + corrigeert(7));

    // ═══ T3 — DE BESCHERMING BLIJFT: KLEINE AFWIJKING ════════
    // De hand-lock-episodes van 2 en 4 meter uit de analyse: buurlampen van
    // dezelfde kruising. Die mogen niet vervallen en niet corrigeren.
    for (const afw of [2, 4]) {
      opzet({ gekozenAf: 40, closestAf: 40 - afw, closestHoek: 60 });
      checkHandLockVerval(huidigePos.lat, huidigePos.lon);
      eis('T3 een hand-lock met ' + afw + 'm afwijking blijft intact',
          handmatigLockActief === true
            && handmatigGeselecteerdNodeId === String(GEKOZEN),
          'lock blijft staan',
          'hand=' + handmatigLockActief + ', node=' + handmatigGeselecteerdNodeId);
    }
    // en de vergrendelde node die zelf de dichtstbijzijnde is: per constructie niets
    opzet({ gekozenAf: 10, closestAf: 10 });
    puurDichtsteNodeCache = { ...dichtstbijOSM };
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T3b staat de vergrendelde node zelf het dichtst bij, dan verandert er niets',
        handmatigLockActief === true,
        'lock blijft staan', 'hand=' + handmatigLockActief);

    // ═══ T4 — HET EENDRACHTSPLEIN-SCENARIO, END TO END ═══════
    // afwM 38: vergrendeld op 46 m, het echte licht op 8 m. Eerst vervalt de
    // lock, daarna corrigeert de bestaande route naar de juiste node.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 46, closestAf: 8, closestHoek: 48 });
    eis('T4 vooraf: de lock staat en de foute node is actief',
        handmatigLockActief === true && String(dichtstbijOSM.id) === String(GEKOZEN),
        'lock aan, node ' + GEKOZEN,
        'hand=' + handmatigLockActief + ', node=' + dichtstbijOSM.id);
    // V11.18.17: één fix is niet meer genoeg. De eerste twee tikken laten de
    // tap staan; pas de derde bevestiging laat hem vallen. Dat is het hele punt
    // van die release — een geldige tap mag niet op GPS-ruis sneuvelen — en het
    // verandert niets aan de UITKOMST van dit scenario, alleen aan de snelheid
    // waarmee hij bereikt wordt.
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T4b1 na één fix staat de lock er nog — bescherming tegen een uitschieter',
        handmatigLockActief === true,
        'true', String(handmatigLockActief));
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T4b de lock vervalt omdat een ander licht aantoonbaar dichterbij ligt',
        handmatigLockActief === false,
        'false', String(handmatigLockActief));
    eis('T4c alle drie de vlaggen zijn gewist, net als bij de auto-unlock',
        handmatigLockActief === false && stilstandAutoLock === false
          && handmatigGeselecteerdNodeId === null,
        'hand=false, auto=false, nodeId=null',
        [handmatigLockActief, stilstandAutoLock, handmatigGeselecteerdNodeId].join(', '));
    eis('T4d en het verval is in het log terug te vinden, met het aantal ' +
        'bevestigingen erbij (V11.18.17)',
        logRegels('handlock_vervallen').length === 1
          && logRegels('handlock_vervallen')[0].afwM === 38
          && logRegels('handlock_vervallen')[0].hoekN === HANDTAP_VERVAL_STABIEL_N,
        '1 regel, afwM 38, 3 bevestigingen',
        logRegels('handlock_vervallen').length + ' regels, afwM '
          + (logRegels('handlock_vervallen')[0] || {}).afwM + ', n '
          + (logRegels('handlock_vervallen')[0] || {}).hoekN);
    // en nu doet de bestaande correctieroute de rest — dit is de koppeling
    // tussen de twee wijzigingen.
    checkNodeCorrectieStilstand(huidigePos.lat, huidigePos.lon);
    eis('T4e daarna corrigeert de app naar het werkelijk dichtstbijzijnde licht',
        String(dichtstbijOSM.id) === String(CLOSEST),
        String(CLOSEST), String(dichtstbijOSM.id));

    // ── DIT GEVAL IS TWEE KEER OMGEDRAAID, EN DAT HOORT ZO ──
    // © 2026 StoplichtIQ — Y. Lemaalem
    //
    // V11.18.7 liet een hand-lock bij 12 m vervallen. V11.18.17 draaide dat om:
    // een tap kreeg een eigen, ruimere marge van 20 m, omdat een menselijke
    // keuze niet op stadsruis hoort te sneuvelen. V11.19.0 draait het terug
    // naar 8 — niet omdat die redenering fout was, maar omdat ze een gat open
    // liet van 8 tot 20 meter, precies waar de tweede mast van dezelfde
    // kruising staat. Daar corrigeerde niets meer zodra er getikt was
    // (Landdroststraat, 24 september, afwM=9).
    //
    // De bescherming die V11.18.17 wilde, zit er nog steeds — maar nu in de
    // KOERS en in de teller, niet in de afstand. Vandaar de twee toetsen
    // hieronder: dezelfde 12 meter valt anders uit al naar gelang de mast
    // vóór je of naast je staat.
    opzet({ gekozenAf: 40, closestAf: 28, closestHoek: 60 });   // koers 0, 60 graden: net binnen
    for (let i = 0; i < 5; i++) checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T4f bij 12 m vervalt een tap nu wél als de mast vóór je ligt — het gat ' +
        'van 8 tot 20 meter is dicht (V11.19.0)',
        handmatigLockActief === false && handmatigGeselecteerdNodeId === null,
        'lock los',
        'hand=' + handmatigLockActief + ', node=' + handmatigGeselecteerdNodeId);
    // en het Hospitaaldreef-geval: even dichtbij, maar naast de auto
    opzet({ gekozenAf: 40, closestAf: 28, closestHoek: 95 });
    for (let i = 0; i < 5; i++) checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T4g dezelfde 12 m laat de tap staan als de mast 95 graden opzij ligt ' +
        '— het gemeten Hospitaaldreef-geval',
        handmatigLockActief === true && handLockVervalTeller === 0,
        'lock blijft, teller 0',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);

    // ═══ T5 — HET WEGRIJ-SCENARIO BLIJFT BESTAAN ════════════
    // >100 m, voorbij, >5 km/u — de route van V10.0.3, onaangeroerd.
    //
    // HEADING 10 EN NIET 0. isStoplichtVoorbij begint met `if (!rijrichting)
    // return false` (r10756), en 0 is falsy — een koers pal noord telt daar dus
    // als 'richting onbekend' en maakt deze route onbereikbaar. Dat is bestaand
    // gedrag van de app, geen fixture-truc; de node ligt hier op 190 graden
    // zodat hij t.o.v. koers 10 nog steeds pal achter de bestuurder staat.
    opzet({ gekozenAf: 150, gekozenHoek: 190, closestAf: 149, closestHoek: 190,
            kmh: 30, stilstandSinds: 0, heading: 10 });
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T5 wegrijden voorbij de node laat de lock nog steeds vervallen',
        handmatigLockActief === false,
        'false', String(handmatigLockActief));
    // maar NIET als je er nog niet voorbij bent
    opzet({ gekozenAf: 150, gekozenHoek: 10, closestAf: 149, closestHoek: 10,
            kmh: 30, stilstandSinds: 0, heading: 10 });
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T5b maar niet zolang de node nog vóór je ligt',
        handmatigLockActief === true,
        'true', String(handmatigLockActief));

    // ═══ T6 — DE STILSTANDSEISEN VAN DE NIEUWE ROUTE ════════
    opzet({ kmh: 4 });                       // boven de stilstandsdrempel
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T6 rijdend (4 km/u) vervalt de lock niet via de nieuwe route',
        handmatigLockActief === true, 'true', String(handmatigLockActief));
    opzet({ stilstandSinds: Date.now() });   // nog geen 3 seconden stil
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T6b nog te kort stil: de lock blijft staan',
        handmatigLockActief === true, 'true', String(handmatigLockActief));
    opzet({ geenClosest: true });            // geen closest bekend
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T6c zonder bekende dichtstbijzijnde node gebeurt er niets',
        handmatigLockActief === true, 'true', String(handmatigLockActief));

    // ═══ T7 — DE AUTO-LOCK BLIJFT BUITEN SCHOT ══════════════
    // Zelfde 38m-stand, maar dan als auto-lock. Die groep wacht op het
    // poortReden-getal uit V11.18.6 en mag hier niet meeveranderen.
    opzet({ hand: true, autoLock: true, gekozenAf: 46, closestAf: 8, closestHoek: 48 });
    checkHandLockVerval(huidigePos.lat, huidigePos.lon);
    eis('T7 een AUTO-lock wordt door de nieuwe vervalregel niet geraakt',
        handmatigLockActief === true && stilstandAutoLock === true,
        'beide nog true',
        'hand=' + handmatigLockActief + ', auto=' + stilstandAutoLock);
    // poort 5 blokkeert nog steeds de echte tap, ongewijzigd
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T7b poort 5 van checkNodeCorrectieStilstand is ongewijzigd',
        /handmatigLockActief && !stilstandAutoLock/.test(zc(checkNodeCorrectieStilstand)),
        'poort 5 staat er nog', 'aanwezig');

    // ═══ T8 — REGRESSIE OP DE OVERIGE VANGNETTEN ════════════
    // bounce-guard
    opzet({ hand: false, autoLock: false, gekozenAf: 46, closestAf: 8, closestHoek: 48 });
    laatsteNodeCorrectieTijd = Date.now();
    checkNodeCorrectieStilstand(huidigePos.lat, huidigePos.lon);
    eis('T8 de bounce-guard blokkeert nog steeds kort na een correctie',
        String(dichtstbijOSM.id) === String(GEKOZEN),
        'niet gecorrigeerd', String(dichtstbijOSM.id));
    // stilstandsduur
    opzet({ hand: false, autoLock: false, gekozenAf: 46, closestAf: 8,
            closestHoek: 48, stilstandSinds: Date.now() });
    checkNodeCorrectieStilstand(huidigePos.lat, huidigePos.lon);
    eis('T8b de stilstandsduur-eis blokkeert nog steeds',
        String(dichtstbijOSM.id) === String(GEKOZEN),
        'niet gecorrigeerd', String(dichtstbijOSM.id));
    // heading-poort: closest ver buiten de 60 graden
    opzet({ hand: false, autoLock: false, gekozenAf: 46, closestAf: 8, closestHoek: 150 });
    checkNodeCorrectieStilstand(huidigePos.lat, huidigePos.lon);
    eis('T8c de heading-poort blokkeert nog steeds boven 60 graden',
        String(dichtstbijOSM.id) === String(GEKOZEN),
        'niet gecorrigeerd', String(dichtstbijOSM.id));

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    puurDichtsteNodeCache = bewaard.puurDichtsteNodeCache;
    osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos;
    huidigeRichting = bewaard.huidigeRichting;
    snelheidKmh = bewaard.snelheidKmh;
    stilstandSinds = bewaard.stilstandSinds;
    laatsteNodeCorrectieTijd = bewaard.laatsteNodeCorrectieTijd;
    laatsteNodeWisselTijd = bewaard.laatsteNodeWisselTijd;
    handmatigLockActief = bewaard.handmatigLockActief;
    stilstandAutoLock = bewaard.stilstandAutoLock;
    handmatigGeselecteerdNodeId = bewaard.handmatigGeselecteerdNodeId;
    headingBuffer.length = 0;
    for (const h of bewaard.headingBufferInhoud) headingBuffer.push(h);
    hoekStabielSleutel = bewaard.hoekStabielSleutel;
    hoekStabielTeller = bewaard.hoekStabielTeller;
    nodeCorrWeiger = bewaard.nodeCorrWeiger;
    vorigOsmId = bewaard.vorigOsmId;
    dichtstbijOSMTwijfel = bewaard.dichtstbijOSMTwijfel;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testMargeHandlock = testMargeHandlock;
