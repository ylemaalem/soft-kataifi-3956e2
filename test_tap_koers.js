// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tap_koers.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.19.0: een handmatige tap laat voortaan los zodra een ander
//  stoplicht 8 meter dichterbij ligt — maar alleen als dat licht ook vóór je
//  staat. Dit is de reparatie van klacht 3: de app blijft vastzitten op het
//  verkeerde kruispunt nadat je hebt getikt.
//
//  HET GAT DAT DICHTGAAT
//  Er bestonden twee marges. De automatische correctie mocht bij 8 meter
//  verschil wisselen; het loslaten van een TAP eiste 20. Tussen die twee ligt
//  precies de afstand tussen twee masten op één kruising. Zat de app daar op de
//  verkeerde, dan corrigeerde niets: de automatische route is geblokkeerd zodra
//  er getikt is (poort 5), en de vervalroute wilde 20 meter zien.
//  Gemeten: Landdroststraat, 24 september. Tik op het beeld om 08:11:56,
//  stilstand_node_afwijking met afwM=9 om 08:12:02. Dat het die dag kort duurde
//  kwam doordat de bestuurder zelf ingreep, niet doordat de app herstelde.
//
//  WAAROM DE KOERSTOETS ERBIJ MOEST, EN NIET ERNA
//  vindDichtbijScore rekent bij snelheidKmh < 5 — exact de toestand waarin de
//  vervalroute werkt — met `normAf * 0.95 + conf * 0.05`. Bij stilstand kiest de
//  app haar kruispunt dus voor 95% op pure afstand, zonder koers. Valt de lock,
//  dan pakt updateDichtbij in dezelfde GPS-tik de dichtstbijzijnde node, ook een
//  mast pal naast de auto — en die wissel passeert nergens een 60-gradentoets,
//  want poort 8 bewaakt alleen het CORRIGEREN. Zonder koerstoets zou 8 meter
//  dus een achterdeur openen waarlangs een kruisend licht een bewuste tap
//  ongedaan maakt.
//
//  K1  de gedeelde helper koersAfwijkingNaar
//  K2  KERN: 8 m dichterbij én vóór je -> de tap vervalt
//  K3  8 m dichterbij maar naast je -> de tap blijft (Hospitaaldreef)
//  K4  het Landdroststraat-geval (9 m) — precies het gat, end to end
//  K5  onbekende koers -> de rest van het bewijs beslist (bewuste keuze)
//  K6  REGRESSIE: poort 8 van de automatische correctie is ongewijzigd
//  K7  REGRESSIE: de teller, de stilstandseisen en route 1 zijn onaangeroerd
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tap_koers.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testTapKoers().regels);
// ═══════════════════════════════════════════════════════════════

function testTapKoers() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const LAT = 52.0, LON = 4.7;
  const LOCK = 9831508301, ANDER = 9831508302;   // de node-ids van 24 september

  // meters -> graden op 52 graden noorderbreedte, GEIJKT TEGEN afstand()
  //
  // De platte benadering met 111320 m per graad zit ongeveer 0,11% naast wat
  // afstand() zelf teruggeeft. Op dertig meter is dat drie centimeter, en in
  // elke andere suite valt dat weg. Hier niet: K2c legt de grens op exact 8,00
  // meter vast, en ongeijkt kwam 30 min 22 uit op 7,991 — net de verkeerde kant
  // van `>=`. Eén ijkmeting tegen afstand() maakt "22 meter" ook echt 22,00, op
  // elke peiling. Zonder dit zou de fixture een codewijziging suggereren waar
  // de code niets mankeert.
  const IJK = (() => {
    const p = { lat: LAT + 100 / 111320, lon: LON };
    return 100 / afstand(LAT, LON, p.lat, p.lon);
  })();
  const naarPunt = (peiling, meters) => {
    const m = meters * IJK;
    const r = peiling * Math.PI / 180;
    return { lat: LAT + (m * Math.cos(r)) / 111320,
             lon: LON + (m * Math.sin(r)) / (111320 * Math.cos(LAT * Math.PI / 180)) };
  };

  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos, huidigeRichting, snelheidKmh, stilstandSinds,
    handmatigLockActief, stilstandAutoLock, handmatigGeselecteerdNodeId,
    handmatigGeselecteerdTimestamp, puurDichtsteNodeCache,
    handLockVervalSleutel, handLockVervalTeller,
    hoekStabielSleutel, hoekStabielTeller, nodeCorrWeiger, peilingWeigerReden,
    vorigOsmId, laatsteNodeCorrectieTijd, laatsteNodeWisselTijd,
    activeCdDoel, activeCdModus, fase, faseBevestigd, faseStart, cdStart,
    richtingBlokVerborgen, headingBuffer: [...headingBuffer]
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
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  // De vergrendelde mast staat pal vooruit (peiling 0); de andere op een
  // instelbare peiling. De koers staat op 0, dus `anderHoek` IS het
  // koersverschil — dat maakt elk geval hieronder in één blik te lezen.
  const opzet = (o) => {
    const opt = o || {};
    zetLS('sl_opslaglog', '[]');
    const lockAf  = opt.lockAf  != null ? opt.lockAf  : 30;
    const anderAf = opt.anderAf != null ? opt.anderAf : 21;
    const g = naarPunt(0, lockAf);
    const a = naarPunt(opt.anderHoek != null ? opt.anderHoek : 0, anderAf);
    huidigePos = { lat: LAT, lon: LON };
    huidigeRichting = 0;
    osmCache = [{ id: LOCK, lat: g.lat, lon: g.lon, naam: 'Landdroststraat' },
                { id: ANDER, lat: a.lat, lon: a.lon, naam: 'Landdroststraat' }];
    dichtstbijOSM = { ...osmCache[0], afstand: lockAf };
    puurDichtsteNodeCache = opt.geenClosest ? null : { ...osmCache[1], afstand: anderAf };
    vorigOsmId = LOCK;
    snelheidKmh = opt.kmh != null ? opt.kmh : 0;
    stilstandSinds = opt.stilstandSinds !== undefined ? opt.stilstandSinds : Date.now() - 10000;
    laatsteNodeCorrectieTijd = Date.now() - 60000;
    laatsteNodeWisselTijd = Date.now() - 60000;
    // een ECHTE tap: hand aan, auto uit
    handmatigLockActief = opt.hand !== undefined ? opt.hand : true;
    stilstandAutoLock   = opt.autoLock !== undefined ? opt.autoLock : false;
    handmatigGeselecteerdNodeId = String(LOCK);
    handmatigGeselecteerdTimestamp = Date.now();
    handLockVervalReset();
    hoekStabielSleutel = null; hoekStabielTeller = 0;
    nodeCorrWeiger = null;
    // KALE GRADEN, geen objecten: met objecten geeft getSmoothedHeading NaN,
    // en dan zou elke koerspoort er ongemerkt doorheen glippen.
    headingBuffer.length = 0;
    if (!opt.geenKoers) headingBuffer.push(opt.heading != null ? opt.heading : 0);
  };
  const tik = (n) => { for (let i = 0; i < n; i++) checkHandLockVerval(LAT, LON); };

  try {
    // ═══ K1 — DE GEDEELDE HELPER ═════════════════════════════
    eis('K1 koersAfwijkingNaar bestaat en meet het koersverschil',
        typeof koersAfwijkingNaar === 'function', 'een functie', typeof koersAfwijkingNaar);
    opzet({ anderHoek: 0 });
    const meet = (hoek) => {
      const p = naarPunt(hoek, 25);
      return Math.round(koersAfwijkingNaar({ lat: LAT, lon: LON }, p));
    };
    eis('K1b pal vooruit is 0, dwars is 90, pal achter is 180',
        meet(0) === 0 && meet(90) === 90 && meet(180) === 180,
        '0, 90, 180', [meet(0), meet(90), meet(180)].join(', '));
    eis('K1c en hij rekent over de korte kant om: 350 graden is 10, niet 350',
        meet(350) === 10, '10', String(meet(350)));
    headingBuffer.length = 0;
    eis('K1d zonder koers geeft hij null — "geen oordeel", niet "afgekeurd"',
        koersAfwijkingNaar({ lat: LAT, lon: LON }, naarPunt(90, 25)) === null,
        'null', String(koersAfwijkingNaar({ lat: LAT, lon: LON }, naarPunt(90, 25))));

    // ═══ K2 — DE KERN: 8 METER, RECHT VOORUIT ════════════════
    //
    // DE GRENS WORDT OP EEN DECIMETER GETEST EN NIET OP DE NANOMETER. Een
    // fixture van 30 en 22 meter levert via afstand() een verschil van
    // 7,999999999798 op — haversine-afrondingsruis, een vijfde van een
    // nanometer onder de drempel. Daar `>=` op afvuren zou een toets opleveren
    // die bij de eerste de beste herschrijving van afstand() omslaat zonder dat
    // er iets aan het gedrag verandert. De grens wordt daarom van twee kanten
    // benaderd met een decimeter speling; dat de drempel zélf 8 is, legt K6c
    // vast op de constante.
    opzet({ lockAf: 30, anderAf: 21.9, anderHoek: 0 });   // 8,1 m
    tik(2);
    eis('K2 acht meter laat de tap na twee tikken nog staan',
        handmatigLockActief === true && handLockVervalTeller === 2,
        'lock blijft, teller 2',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);
    tik(1);
    eis('K2b en bij de derde bevestiging vervalt hij — met 20 m kon dit niet',
        handmatigLockActief === false && handmatigGeselecteerdNodeId === null
          && stilstandAutoLock === false,
        'lock los, alle vlaggen gewist',
        [handmatigLockActief, handmatigGeselecteerdNodeId, stilstandAutoLock].join(', '));
    const vervaltBij = (afw) => {
      opzet({ lockAf: 30, anderAf: 30 - afw, anderHoek: 0 });
      tik(3);
      return handmatigLockActief === false;
    };
    eis('K2c de grens ligt rond 8 m: 8,1 haalt het, 7,9 niet',
        vervaltBij(8.1) === true && vervaltBij(7.9) === false,
        '8,1 wel, 7,9 niet', '8,1: ' + vervaltBij(8.1) + ', 7,9: ' + vervaltBij(7.9));
    eis('K2d en de oude marge van 20 m is daadwerkelijk verlaten — 12 m vervalt nu ook',
        vervaltBij(12) === true, 'lock los bij 12 m', String(vervaltBij(12)));

    // ═══ K3 — NAAST JE: DE TAP BLIJFT ════════════════════════
    // De drie gemeten Hospitaaldreef-gevallen, nu ook tegen de kleinere marge.
    for (const [hoek, afw] of [[95, 33], [97, 35], [144, 33], [95, 9], [61, 20]]) {
      opzet({ lockAf: 45, anderAf: 45 - afw, anderHoek: hoek });
      tik(5);
      eis('K3 ' + afw + ' m dichterbij maar ' + hoek + ' graden opzij: de tap blijft staan',
          handmatigLockActief === true && handLockVervalTeller === 0,
          'lock blijft, teller 0',
          'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);
    }
    opzet({ lockAf: 45, anderAf: 25, anderHoek: 60 });   // precies op de grens
    tik(3);
    eis('K3b op exact 60 graden mag hij nog wel — dezelfde operator als poort 8',
        handmatigLockActief === false, 'lock los', String(handmatigLockActief));

    // ═══ K4 — HET LANDDROSTSTRAAT-GEVAL, END TO END ══════════
    // 24 september, 08:12:02: vergrendeld op ...301, een ander licht 9 m
    // dichterbij. Met de oude marge van 20 gebeurde er niets en greep de
    // bestuurder zelf in. Met 8 + koerstoets laat de app zelf los en corrigeert
    // de bestaande route daarna naar de juiste mast.
    zetLS('sl_opslaglog', '[]');
    opzet({ lockAf: 30, anderAf: 21, anderHoek: 20 });   // afwM = 9
    eis('K4 vooraf: de tap staat en de verkeerde mast is actief',
        handmatigLockActief === true && String(dichtstbijOSM.id) === String(LOCK),
        'lock aan, node ' + LOCK,
        'hand=' + handmatigLockActief + ', node=' + dichtstbijOSM.id);
    tik(3);
    eis('K4b de app laat nu zelf los bij 9 meter — dit deed hij op 24 september niet',
        handmatigLockActief === false, 'lock los', String(handmatigLockActief));
    const r = logRegels('handlock_vervallen')[0];
    eis('K4c met het gemeten verschil, het aantal bevestigingen en het koersverschil in het log',
        !!r && r.afwM === 9 && r.hoekN === 3 && r.hoekVoordeel === 20,
        'afwM 9, hoekN 3, koers 20',
        r ? [r.afwM, r.hoekN, r.hoekVoordeel].join(', ') : 'geen regel');
    // en dan doet de bestaande correctieroute de rest
    checkNodeCorrectieStilstand(LAT, LON);
    eis('K4d waarna de app zelf naar het juiste stoplicht corrigeert',
        String(dichtstbijOSM.id) === String(ANDER),
        String(ANDER), String(dichtstbijOSM.id));

    // ═══ K5 — ONBEKENDE KOERS ════════════════════════════════
    // Bewuste keuze: null betekent "geen oordeel", dus de rest van het bewijs
    // beslist. Poort 8 doet het al zo; en dit is een VERVALroute, waar weigeren
    // de verkeerde lock juist vasthoudt. Het overgebleven bewijs is niet dun:
    // 8 m, drie seconden stil, drie opeenvolgende fixes.
    opzet({ lockAf: 30, anderAf: 21, anderHoek: 90, geenKoers: true });
    eis('K5 vooraf: zonder koers geeft de helper geen oordeel',
        koersAfwijkingNaar({ lat: LAT, lon: LON }, puurDichtsteNodeCache) === null,
        'null', String(koersAfwijkingNaar({ lat: LAT, lon: LON }, puurDichtsteNodeCache)));
    tik(3);
    eis('K5b dan laat de app los op het overgebleven bewijs — een vervalroute ' +
        'mag een fout niet vasthouden omdat de koers toevallig onbekend is',
        handmatigLockActief === false, 'lock los', String(handmatigLockActief));
    eis('K5c en het log laat zien dat de toets is overgeslagen (koers -1)',
        (logRegels('handlock_vervallen')[0] || {}).hoekVoordeel === -1,
        '-1', String((logRegels('handlock_vervallen')[0] || {}).hoekVoordeel));
    // maar het overige bewijs blijft onverkort gelden
    opzet({ lockAf: 30, anderAf: 25, anderHoek: 90, geenKoers: true });   // 5 m
    tik(5);
    eis('K5d zonder koers vervalt hij niet op een te klein verschil',
        handmatigLockActief === true && handLockVervalTeller === 0,
        'lock blijft, teller 0',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);

    // ═══ K6 — REGRESSIE: DE AUTOMATISCHE ROUTE ═══════════════
    // Poort 8 rekent nu uit dezelfde helper, maar moet zich exact hetzelfde
    // gedragen. Geen lock, zodat poort 5 niet in de weg zit.
    opzet({ hand: false, autoLock: false, lockAf: 40, anderAf: 30, anderHoek: 20 });
    checkNodeCorrectieStilstand(LAT, LON);
    eis('K6 de automatische correctie wisselt nog steeds bij 10 m recht vooruit',
        String(dichtstbijOSM.id) === String(ANDER), String(ANDER), String(dichtstbijOSM.id));
    opzet({ hand: false, autoLock: false, lockAf: 40, anderAf: 30, anderHoek: 95 });
    checkNodeCorrectieStilstand(LAT, LON);
    eis('K6b en weigert nog steeds bij 95 graden, met dezelfde reden en hetzelfde getal',
        String(dichtstbijOSM.id) === String(LOCK)
          && !!nodeCorrWeiger && nodeCorrWeiger.poort === 'heading'
          && nodeCorrWeiger.voordeel === 95,
        "poort 'heading', voordeel 95",
        String(dichtstbijOSM.id) + ', ' + JSON.stringify(nodeCorrWeiger));
    eis('K6c NODE_CHK_CORRECTIE_MARGE_M en de koersdrempel staan onaangeroerd',
        NODE_CHK_CORRECTIE_MARGE_M === 8 && NODE_CHK_HEADING_MAX_GRAD === 60,
        '8 en 60',
        NODE_CHK_CORRECTIE_MARGE_M + ', ' + NODE_CHK_HEADING_MAX_GRAD);

    // ═══ K7 — REGRESSIE: DE REST VAN DE VERVALROUTE ══════════
    opzet({ lockAf: 30, anderAf: 21, anderHoek: 0, kmh: 4 });
    tik(3);
    eis('K7 rijdend (4 km/u) vervalt er niets',
        handmatigLockActief === true && handLockVervalTeller === 0,
        'lock blijft, teller 0',
        'hand=' + handmatigLockActief + ', teller=' + handLockVervalTeller);
    opzet({ lockAf: 30, anderAf: 21, anderHoek: 0, stilstandSinds: Date.now() });
    tik(3);
    eis('K7b nog geen drie seconden stil: ook niets',
        handmatigLockActief === true, 'lock blijft', String(handmatigLockActief));
    opzet({ hand: true, autoLock: true, lockAf: 30, anderAf: 21, anderHoek: 0 });
    tik(3);
    eis('K7c een AUTO-lock blijft buiten deze route — die heeft een eigen pad',
        handmatigLockActief === true && stilstandAutoLock === true,
        'beide nog true',
        'hand=' + handmatigLockActief + ', auto=' + stilstandAutoLock);
    // route 1 heeft geen koerstoets nodig en heeft er ook geen gekregen
    eis('K7d route 1 (wegrijden) is onaangeroerd: geen koersAfwijkingNaar ervoor',
        /wegGereden/.test(zc(checkHandLockVerval))
          && zc(checkHandLockVerval).indexOf('koersAfwijkingNaar')
             > zc(checkHandLockVerval).indexOf('wegGereden'),
        'koerstoets staat na route 1', 'ok');
    eis('K7e en de koerstoets nult de teller in dezelfde tak als een te klein verschil',
        /koersOk && \(lockAfstand - closestAf\) >= HANDTAP_VERVAL_MARGE_M/
          .test(zc(checkHandLockVerval)),
        'één if, twee voorwaarden', 'ok');

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos; huidigeRichting = bewaard.huidigeRichting;
    snelheidKmh = bewaard.snelheidKmh; stilstandSinds = bewaard.stilstandSinds;
    handmatigLockActief = bewaard.handmatigLockActief;
    stilstandAutoLock = bewaard.stilstandAutoLock;
    handmatigGeselecteerdNodeId = bewaard.handmatigGeselecteerdNodeId;
    handmatigGeselecteerdTimestamp = bewaard.handmatigGeselecteerdTimestamp;
    puurDichtsteNodeCache = bewaard.puurDichtsteNodeCache;
    handLockVervalSleutel = bewaard.handLockVervalSleutel;
    handLockVervalTeller = bewaard.handLockVervalTeller;
    hoekStabielSleutel = bewaard.hoekStabielSleutel;
    hoekStabielTeller = bewaard.hoekStabielTeller;
    nodeCorrWeiger = bewaard.nodeCorrWeiger;
    peilingWeigerReden = bewaard.peilingWeigerReden;
    vorigOsmId = bewaard.vorigOsmId;
    laatsteNodeCorrectieTijd = bewaard.laatsteNodeCorrectieTijd;
    laatsteNodeWisselTijd = bewaard.laatsteNodeWisselTijd;
    activeCdDoel = bewaard.activeCdDoel; activeCdModus = bewaard.activeCdModus;
    fase = bewaard.fase; faseBevestigd = bewaard.faseBevestigd;
    faseStart = bewaard.faseStart; cdStart = bewaard.cdStart;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    headingBuffer.length = 0; bewaard.headingBuffer.forEach(h => headingBuffer.push(h));
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testTapKoers = testTapKoers;
