// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tapvast.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.17, de veiligheidsrelease. Drie onderdelen, één doel:
//  de app mag niet spontaan naar een ander stoplicht springen terwijl de
//  gebruiker voor rood staat.
//
//  A  een tik op het stoplicht IN HET CAMERABEELD zet ook de node vast
//     (deed hij niet: die tik stuurde alleen welk vakje gevolgd werd)
//  B  een handmatige tap vervalt niet meer op één GPS-fix
//     (was: 8 m verschil op één tik en de tap was weg)
//  C  de bezinktijd van de fase-machine staat in seconden, niet in runs
//     (was: gekoppeld aan de modelsnelheid, dus sinds V11.18.16 door drie)
//
//  WAT DEZE TEST BEWUST NIET DEKT: de kleurdrempel. Die blijft waar hij stond;
//  een zwak vakje mag een positie aanwijzen, geen kleur claimen.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tapvast.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testTapVast().regels);
// ═══════════════════════════════════════════════════════════════

function testTapVast() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const LAT = 52.0, LON = 4.7;
  const GEKOZEN = 881001, ANDER = 881002;

  const naarPunt = (peiling, meters) => {
    const r = peiling * Math.PI / 180;
    return { lat: LAT + (meters * Math.cos(r)) / 111320,
             lon: LON + (meters * Math.sin(r)) / (111320 * Math.cos(LAT * Math.PI / 180)) };
  };

  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos, snelheidKmh, stilstandSinds,
    handmatigLockActief, stilstandAutoLock, handmatigGeselecteerdNodeId,
    handmatigGeselecteerdTimestamp, puurDichtsteNodeCache,
    handLockVervalSleutel, handLockVervalTeller,
    aiTeller, aiKleur, aiTellerStart, laatsteDetectieTijd, aiMissRuns,
    hogeFScoreRuns, fase, stickyDetectie, stickyMissTeller, volgordeKennisResetTijd,
    bboxOverride, bboxOverrideTijd, cropHintPositie, cropHintTeller,
    cropAlternatieTeller, cropRegio, lbScale, lbPadX, lbPadY,
    canvasB: canvas.width, canvasH: canvas.height,
    headingBuffer: [...headingBuffer], laatsteDetecties
  };
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };
  const logRegels = (reden) => {
    try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r && r.reden === reden); }
    catch (e) { return []; }
  };

  // Vergrendeld op GEKOZEN, stilstaand, met ANDER op `afwijking` meter dichterbij.
  //
  // ── V11.19.0: DE PEILING VAN `ANDER` STAAT NU EXPLICIET ────
  // © 2026 StoplichtIQ — Y. Lemaalem
  //
  // Deze fixture zette ANDER onveranderlijk op peiling 90 terwijl de koers op
  // 10 stond: een koersverschil van 80 graden. Zolang checkHandLockVerval geen
  // koerstoets had, maakte dat niets uit en las niemand het. Sinds V11.19.0
  // blokkeert de koerstoets die geometrie volledig, en dan zou elke B-toets
  // hieronder groen blijven om een reden die niets met zijn naam te maken heeft.
  //
  // Standaard is nu 10 graden — gelijk aan de koers, dus pal vooruit. Dat is het
  // gewone geval: je staat voor een kruising en de andere mast hoort bij
  // dezelfde kruising. De 90-gradengeometrie is niet verdwenen maar verhuisd
  // naar B5b, waar ze test wat ze hoort te testen: een mast naast je laat een
  // tap staan.
  const opzet = (gekozenAf, closestAf, opt = {}) => {
    zetLS('sl_opslaglog', '[]');
    const g = naarPunt(0, gekozenAf);
    const a = naarPunt(opt.closestHoek != null ? opt.closestHoek : 10, closestAf);
    huidigePos = { lat: LAT, lon: LON };
    osmCache = [{ id: GEKOZEN, lat: g.lat, lon: g.lon, naam: 'Gekozen' },
                { id: ANDER, lat: a.lat, lon: a.lon, naam: 'Ander' }];
    dichtstbijOSM = { ...osmCache[0], afstand: gekozenAf };
    puurDichtsteNodeCache = { ...osmCache[1], afstand: closestAf };
    snelheidKmh = opt.kmh != null ? opt.kmh : 0;
    stilstandSinds = opt.stilstandSinds !== undefined ? opt.stilstandSinds : Date.now() - 10000;
    handmatigGeselecteerdNodeId = String(GEKOZEN);
    handmatigGeselecteerdTimestamp = Date.now();
    handmatigLockActief = true;
    stilstandAutoLock = !!opt.autoLock;
    handLockVervalReset();
    headingBuffer.length = 0; headingBuffer.push(opt.heading != null ? opt.heading : 10);
  };
  const tik = (n) => { for (let i = 0; i < n; i++) checkHandLockVerval(LAT, LON); };
  // Broncode zonder commentaar, voor de structuurtoetsen. (Het blok verderop
  // definieert een eigen `zc`; deze staat hier omdat B1b hem al nodig heeft.)
  const zcF = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  try {
    // ═══ A — DE TIK OP HET BEELD ═════════════════════════════
    zetLS('sl_opslaglog', '[]');
    huidigePos = { lat: LAT, lon: LON };
    osmCache = [{ id: GEKOZEN, lat: LAT, lon: LON, naam: 'Gekozen' }];
    dichtstbijOSM = { ...osmCache[0], afstand: 20 };
    handmatigLockActief = false; stilstandAutoLock = false;
    handmatigGeselecteerdNodeId = null;
    canvas.width = 640; canvas.height = 360;
    lbScale = 1; lbPadX = 0; lbPadY = 0; cropRegio = null;
    laatsteDetecties = [];
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 12, clientY: 12, bubbles: true }));
    eis('A1 een tik op het stoplicht in beeld zet nu de node-lock',
        handmatigLockActief === true
          && String(handmatigGeselecteerdNodeId) === String(GEKOZEN),
        'lock aan op ' + GEKOZEN,
        'hand=' + handmatigLockActief + ', node=' + handmatigGeselecteerdNodeId);
    eis('A1b en telt als ECHTE tap, niet als auto-lock',
        stilstandAutoLock === false, 'false', String(stilstandAutoLock));
    eis('A1c de tik staat in het log, met vermelding dat hij uit het beeld kwam',
        logRegels('node_vergrendeld').length === 1
          && logRegels('node_vergrendeld')[0].element === 'beeld'
          && logRegels('node_vergrendeld')[0].node === String(GEKOZEN),
        "1 regel, element 'beeld'",
        JSON.stringify(logRegels('node_vergrendeld').map(r => r.element)));
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 20, clientY: 20, bubbles: true }));
    eis('A1d nog een tik op dezelfde node logt niet opnieuw — geen logvervuiling',
        logRegels('node_vergrendeld').length === 1 && handmatigLockActief === true,
        '1 regel', String(logRegels('node_vergrendeld').length));

    // de tap is nu "echt", dus de automatische correctie laat hem met rust
    opzet(46, 8);
    stilstandAutoLock = false;
    checkNodeCorrectieStilstand(LAT, LON);
    eis('A2 een tik uit het beeld beschermt tegen de automatische correctie (poort 5)',
        String(dichtstbijOSM.id) === String(GEKOZEN)
          && nodeCorrWeiger && nodeCorrWeiger.poort === 'handtap',
        'node ongewijzigd, poort handtap',
        dichtstbijOSM.id + ', poort=' + (nodeCorrWeiger || {}).poort);

    handmatigLockActief = false; handmatigGeselecteerdNodeId = null;
    dichtstbijOSM = null;
    canvas.dispatchEvent(new MouseEvent('click', { clientX: 12, clientY: 12, bubbles: true }));
    eis('A3 zonder bekend kruispunt valt er niets te vergrendelen, en dat crasht niet',
        handmatigLockActief === false, 'geen lock', String(handmatigLockActief));

    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('A4 de correctielijst gebruikt dezelfde ene vergrendel-functie',
        /vergrendelNodeHandmatig\(nodeId, 'lijst'\)/.test(zc(selecteerNodeHandmatig))
          && !/handmatigLockActief\s*=\s*true/.test(zc(selecteerNodeHandmatig)),
        'één gedeelde functie', 'ok');

    // ═══ B — DE TAP OVERLEEFT GPS-RUIS ═══════════════════════
    // V11.19.0 HEEFT DEZE TOETS OMGEDRAAID, EN DAT IS DE BEDOELING.
    // V11.18.17 gaf een tap een RUIMERE marge (20) dan een automatische gok
    // (8), omdat een menselijke keuze meer bewijs verdient voordat ze opzij
    // gaat. Dat klopte, maar het liet een gat open van 8 tot 20 meter — precies
    // de afstand tussen twee masten op één kruising, waar niets meer corrigeert
    // zodra er getikt is. Het bewijs daarvoor staat in de meting van 24
    // september (Landdroststraat, afwM=9).
    //
    // De extra bescherming zit nu in de KOERS in plaats van in de afstand: een
    // tap mag alleen vervallen richting een mast die ook vóór je ligt, dezelfde
    // eis die poort 8 aan de automatische correctie stelt. Daarmee is het
    // weggooien van een tap precies zo streng als een correctie, en is een
    // ruimere afstandsmarge niet langer nodig.
    eis('B1 een tap vervalt nu bij dezelfde afstand als een gok, maar met een ' +
        'koerstoets erbij (V11.19.0)',
        HANDTAP_VERVAL_MARGE_M === 8 && NODE_CHK_CORRECTIE_MARGE_M === 8
          && HANDTAP_VERVAL_STABIEL_N === 3 && NODE_CHK_HEADING_MAX_GRAD === 60,
        '8 en 8, 3 tikken, 60 graden',
        [HANDTAP_VERVAL_MARGE_M, NODE_CHK_CORRECTIE_MARGE_M,
         HANDTAP_VERVAL_STABIEL_N, NODE_CHK_HEADING_MAX_GRAD].join(', '));
    eis('B1b en beide poorten rekenen uit dezelfde bron, zodat ze niet uit ' +
        'elkaar kunnen groeien',
        typeof koersAfwijkingNaar === 'function'
          && /koersAfwijkingNaar/.test(zcF(checkHandLockVerval))
          && /koersAfwijkingNaar/.test(zcF(checkNodeCorrectieStilstand)),
        '\u00e9\u00e9n gedeelde functie, twee aanroepers',
        'checkHandLockVerval: ' + /koersAfwijkingNaar/.test(zcF(checkHandLockVerval))
          + ', checkNodeCorrectieStilstand: ' + /koersAfwijkingNaar/.test(zcF(checkNodeCorrectieStilstand)));

    opzet(40, 15);          // 25 m verschil: ruim boven de drempel
    tik(1);
    eis('B2 één GPS-fix met 25 m afwijking laat de tap NIET vervallen — dit was de bug',
        handmatigLockActief === true && handLockVervalTeller === 1,
        'lock blijft, teller 1',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);
    tik(1);
    eis('B2b na twee tikken ook nog niet',
        handmatigLockActief === true && handLockVervalTeller === 2,
        'lock blijft, teller 2',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);
    tik(1);
    eis('B3 pas de derde bevestiging laat hem vervallen — de bescherming van ' +
        'V11.18.7 blijft dus bestaan, alleen trager',
        handmatigLockActief === false && handmatigGeselecteerdNodeId === null
          && stilstandAutoLock === false,
        'lock los, alle vlaggen gewist',
        [handmatigLockActief, handmatigGeselecteerdNodeId, stilstandAutoLock].join(', '));
    eis('B3b met het aantal bevestigingen in het log, en sinds V11.19.0 ook het ' +
        'gemeten koersverschil',
        logRegels('handlock_vervallen').length === 1
          && logRegels('handlock_vervallen')[0].afwM === 25
          && logRegels('handlock_vervallen')[0].hoekN === 3
          && logRegels('handlock_vervallen')[0].hoekVoordeel === 0,
        'afwM 25, 3 bevestigingen, koersverschil 0',
        JSON.stringify(logRegels('handlock_vervallen')
          .map(r => [r.afwM, r.hoekN, r.hoekVoordeel])));

    // tegenspraak tussendoor: de teller begint opnieuw
    opzet(40, 15);
    tik(2);
    // De node moet echt verhuizen: checkHandLockVerval rekent de afstand vers
    // uit lat/lon, dus alleen het veld .afstand aanpassen verandert niets.
    // V11.19.0: peiling 10 in plaats van 90, gelijk aan de koers. Anders zou de
    // koerstoets de tegenspraak leveren en niet de afstand, en meet B4 iets
    // anders dan zijn naam zegt.
    const ver = naarPunt(10, 39);
    puurDichtsteNodeCache = { id: ANDER, lat: ver.lat, lon: ver.lon, afstand: 39 };
    tik(1);
    const naTegenspraak = handLockVervalTeller;
    const dichtbij = naarPunt(10, 15);
    puurDichtsteNodeCache = { id: ANDER, lat: dichtbij.lat, lon: dichtbij.lon, afstand: 15 };
    tik(2);
    eis('B4 een tik zonder bewijs nult de teller — twee plus twee is geen drie',
        naTegenspraak === 0 && handmatigLockActief === true,
        'teller 0, lock blijft',
        'naTegenspraak=' + naTegenspraak + ', hand=' + handmatigLockActief);

    // ── B5: HET GAT VAN 8 TOT 20 METER, DE KERN VAN V11.19.0 ──
    // Tot deze release stond hier dat tien meter een tap NÓÓIT liet vervallen.
    // Dat was de bug: precies in die band ligt de tweede mast van dezelfde
    // kruising, en daar corrigeerde niets meer zodra er getikt was.
    zetLS('sl_opslaglog', '[]');
    opzet(40, 30);          // 10 m verschil, mast recht vooruit
    tik(2);
    eis('B5 tien meter laat de tap na twee tikken nog staan — ruisbescherming ' +
        'blijft',
        handmatigLockActief === true && handLockVervalTeller === 2,
        'lock blijft, teller 2',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);
    tik(1);
    eis('B5a en vervalt bij de derde bevestiging — het gat van 8 tot 20 meter ' +
        'is dicht (V11.19.0)',
        handmatigLockActief === false && handmatigGeselecteerdNodeId === null,
        'lock los',
        'hand=' + handmatigLockActief + ', node=' + handmatigGeselecteerdNodeId);

    // Dezelfde tien meter, maar de mast staat naast je: dan blijft de tap staan.
    // Dit is de geometrie die deze fixture vroeger onbedoeld overal gebruikte,
    // nu op de plek waar ze thuishoort.
    opzet(40, 30, { closestHoek: 90 });   // koers 10, peiling 90 -> 80 graden
    tik(5);
    eis('B5b maar een mast 80 graden opzij laat de tap staan, ook na vijf tikken',
        handmatigLockActief === true && handLockVervalTeller === 0,
        'lock blijft, teller 0',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);

    opzet(46, 8);           // het gemeten Eendrachtsplein-geval: 38 m
    tik(3);
    eis('B6 het gemeten geval van 12 september (38 m) vervalt nog steeds',
        handmatigLockActief === false,
        'lock los', String(handmatigLockActief));

    opzet(40, 15, { kmh: 4 });
    tik(3);
    eis('B7 rijdend telt er niets door — de teller blijft op nul',
        handmatigLockActief === true && handLockVervalTeller === 0,
        'lock blijft, teller 0',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);

    opzet(40, 15);
    tik(2);
    vergrendelNodeHandmatig(GEKOZEN, 'beeld');
    tik(2);
    eis('B8 een verse tik begint met een schone lei — twee oude bevestigingen ' +
        'tellen niet mee',
        handmatigLockActief === true && handLockVervalTeller === 2,
        'lock blijft, teller 2',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);

    // route 1 blijft zonder stabiliteitseis: wegrijden is geen twijfelgeval
    opzet(150, 140, { kmh: 30, heading: 10 });
    const g = naarPunt(190, 150);   // achter je
    osmCache[0] = { id: GEKOZEN, lat: g.lat, lon: g.lon, naam: 'Gekozen' };
    tik(1);
    eis('B9 wegrijden laat de lock nog steeds in één keer vervallen',
        handmatigLockActief === false, 'lock los', String(handmatigLockActief));

    // ═══ C — DE BEZINKTIJD IN SECONDEN ═══════════════════════
    eis('C1 de vier tijden staan op de oude runtijd van 1066 ms per run',
        AI_BEZINK_MS === 2100 && AI_BEZINK_ONVERWACHT_MS === 3200
          && TOLERANTIE_MS === 5300 && STICKY_MISS_MS === 5300,
        '2100, 3200, 5300, 5300',
        [AI_BEZINK_MS, AI_BEZINK_ONVERWACHT_MS, TOLERANTIE_MS, STICKY_MISS_MS].join(', '));
    eis('C1b en de runs-drempels staan er ongewijzigd naast',
        AI_DREMPEL === 2 && AI_DREMPEL_ONVERWACHT === 3
          && TOLERANTIE_RUNS === 5 && STICKY_MISS_MAX === 5,
        '2, 3, 5, 5',
        [AI_DREMPEL, AI_DREMPEL_ONVERWACHT, TOLERANTIE_RUNS, STICKY_MISS_MAX].join(', '));

    // het snelle model: runs zijn er in 0,8 s, de tijd nog niet
    fase = 'rood'; hogeFScoreRuns = 0;
    const nu = Date.now();
    aiTeller = 2; aiTellerStart = nu - 830;
    eis('C2 met het snelle model zijn twee runs er binnen een seconde — de fase ' +
        'wordt dan NIET meteen officieel',
        faseMagOfficieelWorden('rood', 'groen', nu) === false,
        'false', String(faseMagOfficieelWorden('rood', 'groen', nu)));
    aiTeller = 5; aiTellerStart = nu - 2100;
    eis('C2b na 2,1 seconde wel',
        faseMagOfficieelWorden('rood', 'groen', nu) === true,
        'true', String(faseMagOfficieelWorden('rood', 'groen', nu)));
    aiTeller = 1; aiTellerStart = nu - 9000;
    eis('C2c tijd alleen is niet genoeg — één waarneming blijft één waarneming',
        faseMagOfficieelWorden('rood', 'groen', nu) === false,
        'false', String(faseMagOfficieelWorden('rood', 'groen', nu)));

    // het oude, trage model: twee runs duren 2,1 s, dus de runs beslissen
    aiTeller = 2; aiTellerStart = nu - 2132;
    eis('C3 met het oude model van 1066 ms beslissen de runs, precies als vroeger',
        faseMagOfficieelWorden('rood', 'groen', nu) === true,
        'true', String(faseMagOfficieelWorden('rood', 'groen', nu)));
    // een traag model: 2 runs duren 6 s — dan is de tijd allang binnen
    aiTeller = 2; aiTellerStart = nu - 6000;
    eis('C3b en bij een traag model verandert er niets aan het oude gedrag',
        faseMagOfficieelWorden('rood', 'groen', nu) === true,
        'true', String(faseMagOfficieelWorden('rood', 'groen', nu)));

    // Onverwachte omslag: drie runs én 3,2 s.
    // volgordeKennisResetTijd expliciet nullen: binnen VOLGORDE_KENNIS_RESET_MS
    // na een reset geldt ELKE omslag als verwacht (r7741). Een eerdere suite in
    // de batterij kan die klok gezet hebben, en dan toetst dit blok niets.
    volgordeKennisResetTijd = 0;
    aiTeller = 3; aiTellerStart = nu - 2500; hogeFScoreRuns = 0;
    const onverwacht = !isVerwachteOmslag('rood', 'oranje');
    eis('C4 een onverwachte omslag krijgt meer bezinktijd dan een verwachte',
        onverwacht && faseMagOfficieelWorden('rood', 'oranje', nu) === false
          && effectieveBezinkMs('rood', 'oranje') === AI_BEZINK_ONVERWACHT_MS,
        'nog niet officieel bij 2,5 s',
        'onverwacht=' + onverwacht + ', officieel=' + faseMagOfficieelWorden('rood', 'oranje', nu));
    aiTeller = 3; aiTellerStart = nu - 3300;
    eis('C4b en na 3,3 s wel',
        faseMagOfficieelWorden('rood', 'oranje', nu) === true,
        'true', String(faseMagOfficieelWorden('rood', 'oranje', nu)));

    aiMissRuns = 6; laatsteDetectieTijd = nu - 2000;
    eis('C5 zes gemiste runs binnen twee seconden laten de bbox nog staan',
        tolerantieVerlopen(nu) === false, 'false', String(tolerantieVerlopen(nu)));
    laatsteDetectieTijd = nu - 5400;
    eis('C5b na 5,4 seconde zonder detectie wordt hij losgelaten',
        tolerantieVerlopen(nu) === true, 'true', String(tolerantieVerlopen(nu)));
    aiMissRuns = 3; laatsteDetectieTijd = nu - 30000;
    eis('C5c maar alleen als er ook genoeg runs gemist zijn',
        tolerantieVerlopen(nu) === false, 'false', String(tolerantieVerlopen(nu)));

    stickyDetectie = { cx: 100, cy: 100, familie: 'rood', tijd: nu - 2000 };
    stickyMissTeller = 5;
    eis('C6 de sticky-identiteit blijft binnen 5,3 s behouden',
        stickyMagLosgelaten(nu) === false, 'false', String(stickyMagLosgelaten(nu)));
    stickyDetectie.tijd = nu - 5400;
    eis('C6b en wordt daarna losgelaten',
        stickyMagLosgelaten(nu) === true, 'true', String(stickyMagLosgelaten(nu)));
    stickyDetectie = null;
    eis('C6c zonder sticky valt er niets vast te houden',
        stickyMagLosgelaten(nu) === true, 'true', String(stickyMagLosgelaten(nu)));

    // ═══ D — REGRESSIE ═══════════════════════════════════════
    eis('D1 de kleurdrempel en de vormfilters zijn NIET aangeraakt',
        CONF_DREMPEL === 0.10 && MAX_Y_RATIO === 0.75
          && S1_EDGE_MIN === 0.04 && S1_EDGE_MAX === 0.96,
        '0,10 / 0,75 / 0,04 / 0,96',
        [CONF_DREMPEL, MAX_Y_RATIO, S1_EDGE_MIN, S1_EDGE_MAX].join(', '));
    eis('D2 de fasepoort leest de klok, niet de modelsnelheid',
        /faseMagOfficieelWorden/.test(zc(verwerkDetecties))
          && /tolerantieVerlopen/.test(zc(verwerkDetecties)),
        'beide poorten in gebruik', 'ok');
    eis('D3 de vervalregel raakt de auto-lock niet — die houdt zijn eigen marge',
        /HANDTAP_VERVAL_MARGE_M/.test(zc(checkHandLockVerval))
          && !/HANDTAP_VERVAL_MARGE_M/.test(zc(checkNodeCorrectieStilstand)),
        'alleen in de tap-route', 'ok');
    eis('D4 route 1 (wegrijden) heeft geen stabiliteitseis gekregen',
        /wegGereden/.test(zc(checkHandLockVerval))
          && !/wegGereden[\s\S]{0,200}handLockVervalTeller/.test(zc(checkHandLockVerval)),
        'ongewijzigd', 'ok');

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos; snelheidKmh = bewaard.snelheidKmh;
    stilstandSinds = bewaard.stilstandSinds;
    handmatigLockActief = bewaard.handmatigLockActief;
    stilstandAutoLock = bewaard.stilstandAutoLock;
    handmatigGeselecteerdNodeId = bewaard.handmatigGeselecteerdNodeId;
    handmatigGeselecteerdTimestamp = bewaard.handmatigGeselecteerdTimestamp;
    puurDichtsteNodeCache = bewaard.puurDichtsteNodeCache;
    handLockVervalSleutel = bewaard.handLockVervalSleutel;
    handLockVervalTeller = bewaard.handLockVervalTeller;
    aiTeller = bewaard.aiTeller; aiKleur = bewaard.aiKleur;
    aiTellerStart = bewaard.aiTellerStart; laatsteDetectieTijd = bewaard.laatsteDetectieTijd;
    aiMissRuns = bewaard.aiMissRuns; hogeFScoreRuns = bewaard.hogeFScoreRuns;
    volgordeKennisResetTijd = bewaard.volgordeKennisResetTijd;
    fase = bewaard.fase; stickyDetectie = bewaard.stickyDetectie;
    stickyMissTeller = bewaard.stickyMissTeller;
    bboxOverride = bewaard.bboxOverride; bboxOverrideTijd = bewaard.bboxOverrideTijd;
    cropHintPositie = bewaard.cropHintPositie; cropHintTeller = bewaard.cropHintTeller;
    cropAlternatieTeller = bewaard.cropAlternatieTeller; cropRegio = bewaard.cropRegio;
    lbScale = bewaard.lbScale; lbPadX = bewaard.lbPadX; lbPadY = bewaard.lbPadY;
    canvas.width = bewaard.canvasB; canvas.height = bewaard.canvasH;
    laatsteDetecties = bewaard.laatsteDetecties;
    headingBuffer.length = 0; bewaard.headingBuffer.forEach(h => headingBuffer.push(h));
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testTapVast = testTapVast;
