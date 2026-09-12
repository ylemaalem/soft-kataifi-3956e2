// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_autolock_weiger.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.6: meten welke poort de correctie blokkeert wanneer de
//  stilstand-auto-lock een verkeerde node vasthoudt.
//
//  WAAROM DEZE METING BESTAAT
//  De episode-analyse van 12 september vond 11 episodes, waarvan 3 onder de
//  stilstand-auto-lock. Twee daarvan hadden een afwijking van exact 0 meter —
//  precies het gebied waar de hoekroute (V11.17.79) voor gebouwd is, en toch
//  vuurde ze niet. Er zijn drie kandidaat-oorzaken (hoek, stabiliteitsteller,
//  marge) en de hoek heeft er in zichzelf nog eens vijf. Zonder meting is dat
//  gokken tussen acht mogelijkheden.
//
//  T1 IS DE AFBAKENING
//  De regel mag uitsluitend bij hand=1 && autoLock=1 vuren. Bij een echte tap
//  weigert poort 5 per ontwerp — daar valt niets te leren. Zonder lock is het
//  de hysterese, een ander mechanisme met een eigen reparatie.
//
//  T2-T4 ZIJN DE DRIE KANDIDATEN, elk apart nagebootst.
//
//  T5 IS DE REGRESSIEWACHT: het gedrag van de auto-lock en van beide
//  correctieroutes is onveranderd. De meting leest alleen mee.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_autolock_weiger.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testAutolockWeiger().regels);
// ═══════════════════════════════════════════════════════════════

function testAutolockWeiger() {
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

  const GEKOZEN = 999601;   // de actieve (foute) node
  const CLOSEST = 999602;   // de werkelijk dichtstbijzijnde

  const bewaard = {
    dichtstbijOSM, puurDichtsteNodeCache, osmCache, huidigePos, huidigeRichting,
    snelheidKmh, stilstandSinds, laatsteNodeCorrectieTijd,
    handmatigLockActief, stilstandAutoLock, handmatigGeselecteerdNodeId,
    // headingBuffer is een const array (r5451) — bewaar de INHOUD, niet de
    // verwijzing, en herstel straks door te muteren in plaats van toe te wijzen.
    headingBufferInhoud: headingBuffer.slice(),
    hoekStabielSleutel, hoekStabielTeller,
    nodeCorrWeiger, peilingWeigerReden, peilingLaatsteVoordeel,
    vorigOsmId, dichtstbijOSMTwijfel
  };

  const logRegels = (reden) => {
    try {
      return (JSON.parse(localStorage.getItem('sl_opslaglog')) || [])
        .filter(r => r && r.reden === reden);
    } catch (e) { return []; }
  };
  const laatste = (reden) => {
    const r = logRegels(reden);
    return r.length ? r[r.length - 1] : null;
  };

  // Twee nodes pal noord van de waarnemer, op instelbare afstand. Noord = 0°,
  // en huidigeRichting 0 maakt de peiling t.o.v. de rijrichting gelijk aan de
  // kompaspeiling — zo zijn de hoeken in de opzet direct leesbaar.
  const mPerGraadLat = 111320;
  const opzet = (o) => {
    const opt = o || {};
    huidigePos = { lat: 52.0, lon: 4.7 };
    huidigeRichting = 0;
    // gekozen recht vooruit, closest onder een instelbare hoek ernaast
    // 40 tegen 39,6: afwM rondt af op 0, precies zoals de twee 0-meter-records
    // uit de episode-analyse. Exact gelijk zetten zou verschil === 0 geven, en
    // daar zwijgt de meting bewust — dan staat de app immers niet fout.
    const gAf = opt.gekozenAf != null ? opt.gekozenAf : 40;
    const cAf = opt.closestAf != null ? opt.closestAf : 39.6;
    const cHoek = (opt.closestHoek != null ? opt.closestHoek : 0) * Math.PI / 180;
    const gHoek = (opt.gekozenHoek != null ? opt.gekozenHoek : 0) * Math.PI / 180;
    const nodeOp = (id, af, hoek) => ({
      id, naam: 'Test ' + id,
      lat: 52.0 + (af * Math.cos(hoek)) / mPerGraadLat,
      lon: 4.7 + (af * Math.sin(hoek)) / (mPerGraadLat * Math.cos(52.0 * Math.PI / 180)),
      afstand: af
    });
    const g = nodeOp(GEKOZEN, gAf, gHoek);
    const c = nodeOp(CLOSEST, cAf, cHoek);
    osmCache = [g, c];
    dichtstbijOSM = { ...g };
    puurDichtsteNodeCache = { ...c };
    vorigOsmId = GEKOZEN;
    dichtstbijOSMTwijfel = false;
    snelheidKmh = opt.kmh != null ? opt.kmh : 0;
    stilstandSinds = opt.stilstandSinds !== undefined ? opt.stilstandSinds : (Date.now() - 10000);
    laatsteNodeCorrectieTijd = opt.laatsteCorrectie != null
      ? opt.laatsteCorrectie : (Date.now() - 60000);
    handmatigLockActief = opt.hand !== undefined ? opt.hand : true;
    stilstandAutoLock   = opt.autoLock !== undefined ? opt.autoLock : true;
    handmatigGeselecteerdNodeId = String(GEKOZEN);
    headingBuffer.length = 0;
    if (opt.headingBuffer === undefined) headingBuffer.push({ heading: 0, tijd: Date.now() });
    else for (const h of opt.headingBuffer) headingBuffer.push(h);
    hoekStabielSleutel = opt.hoekSleutel !== undefined ? opt.hoekSleutel : null;
    hoekStabielTeller  = opt.hoekTeller  != null ? opt.hoekTeller : 0;
    nodeCorrWeiger = null;
    // de herhaalrem van de meting leeggooien, anders zwijgt de tweede opzet
    autolockWeigerSleutel = null;
    autolockWeigerTijd = 0;
  };

  // één volledige tick: eerst de correctieketen, dan de meting — exact de
  // volgorde uit onGPS (r15152-15154).
  const tick = () => {
    checkNodeCorrectieStilstand(huidigePos.lat, huidigePos.lon);
    meetAutolockWeigering();
  };

  try {
    // ═══ T1 — ALLEEN BIJ DE AUTO-LOCK ════════════════════════
    zetLS('sl_opslaglog', '[]');
    opzet({ hand: true, autoLock: true });
    tick();
    eis('T1 bij de auto-lock verschijnt er een regel',
        logRegels('autolock_correctie_geweigerd').length === 1,
        '1 regel', String(logRegels('autolock_correctie_geweigerd').length));

    zetLS('sl_opslaglog', '[]');
    opzet({ hand: true, autoLock: false });        // echte tap
    tick();
    eis('T1b bij een ECHTE TAP verschijnt er geen regel',
        logRegels('autolock_correctie_geweigerd').length === 0,
        '0 regels', String(logRegels('autolock_correctie_geweigerd').length));

    zetLS('sl_opslaglog', '[]');
    opzet({ hand: false, autoLock: false });       // geen lock
    tick();
    eis('T1c zonder lock verschijnt er geen regel',
        logRegels('autolock_correctie_geweigerd').length === 0,
        '0 regels', String(logRegels('autolock_correctie_geweigerd').length));

    // en niet als de goede node gewoon actief staat
    zetLS('sl_opslaglog', '[]');
    opzet({ hand: true, autoLock: true });
    puurDichtsteNodeCache = { ...dichtstbijOSM };
    tick();
    eis('T1d staat de juiste node actief, dan valt er niets te melden',
        logRegels('autolock_correctie_geweigerd').length === 0,
        '0 regels', String(logRegels('autolock_correctie_geweigerd').length));

    // ═══ T2 — KANDIDAAT 1: DE HOEK ═══════════════════════════
    // Beide nodes op 40m, closest 10° opzij. Het hoekvoordeel is dan 10 graden,
    // ruim onder NODE_HOEK_VOORDEEL_GRAD (25) — de peiling zegt nee.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 40, closestAf: 38, gekozenHoek: 40, closestHoek: 30 });
    tick();
    let r = laatste('autolock_correctie_geweigerd');
    eis('T2 een te klein hoekvoordeel wordt als zodanig herkend',
        r && r.poortReden === 'route' && r.hoekReden === 'te_klein_voordeel',
        "poortReden 'route', hoekReden 'te_klein_voordeel'",
        r ? (r.poortReden + ' / ' + r.hoekReden) : 'geen regel');
    eis('T2b en het gemeten voordeel gaat mee, zodat 24-tegen-25 te ' +
        'onderscheiden is van 3-tegen-25',
        r && typeof r.hoekVoordeel === 'number' && r.hoekVoordeel < NODE_HOEK_VOORDEEL_GRAD,
        'een getal onder ' + NODE_HOEK_VOORDEEL_GRAD,
        r ? String(r.hoekVoordeel) : 'geen regel');

    // De meest verdachte reden uit de analyse: beide nodes dichterbij dan
    // NODE_HOEK_MIN_AFSTAND_M (12). Dan is de peiling ruis en weigert de route,
    // terwijl dit juist het geval is waarvoor ze bedoeld was.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 8, closestAf: 7.6, closestHoek: 60 });
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T2c twee nodes binnen de peilings-ondergrens geven "te_dichtbij"',
        r && r.hoekReden === 'te_dichtbij',
        'te_dichtbij', r ? r.hoekReden : 'geen regel');

    // Ongelijke afstanden: dan is dit de afstandsroute-zaak, niet de hoek.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 40, closestAf: 32, closestHoek: 60 });
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T2d bij ongelijke afstanden meldt de hoekroute "afst_ongelijk"',
        r && r.hoekReden === 'afst_ongelijk',
        'afst_ongelijk', r ? r.hoekReden : 'geen regel');

    // Zonder headingbuffer kan de peiling niet beoordeeld worden.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 40, closestAf: 39.6, closestHoek: 60, headingBuffer: [] });
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T2e zonder headingbuffer meldt de hoekroute "geen_buffer"',
        r && r.hoekReden === 'geen_buffer',
        'geen_buffer', r ? r.hoekReden : 'geen regel');

    // ═══ T3 — KANDIDAAT 2: DE STABILITEITSTELLER ═════════════
    // De peiling zegt JA (voordeel ruim boven 25), maar de teller staat nog
    // onder NODE_HOEK_STABIEL_N. Dan is de hoek niet de dader maar de teller.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 40, closestAf: 39.6, gekozenHoek: 70, closestHoek: 0 });
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T3 de peiling zegt ja maar de teller is te laag: "stabiliteit"',
        r && r.hoekReden === 'stabiliteit',
        'stabiliteit', r ? r.hoekReden : 'geen regel');
    eis('T3b de stand van de teller gaat mee (' + NODE_HOEK_STABIEL_N + ' nodig)',
        r && typeof r.hoekN === 'number' && r.hoekN >= 1 && r.hoekN < NODE_HOEK_STABIEL_N,
        '1 tot ' + (NODE_HOEK_STABIEL_N - 1), r ? String(r.hoekN) : 'geen regel');

    // ═══ T4 — KANDIDAAT 3: DE MARGE ══════════════════════════
    // Afstanden te ver uit elkaar voor de hoekroute, maar niet ver genoeg voor
    // NODE_CHK_CORRECTIE_MARGE_M (20). Dit is het bekende gat van 5 tot 20 m.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 40, closestAf: 28, closestHoek: 60 });
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T4 een verschil in het 5-20m-gat meldt afstReden "marge"',
        r && r.afstReden === 'marge' && r.afwM === 12,
        "marge, afwM 12", r ? (r.afstReden + ', afwM ' + r.afwM) : 'geen regel');

    // Te kort stilgestaan: de afstandsroute eist NODE_CHK_STANDSTILL_DUUR_MS.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 60, closestAf: 20, closestHoek: 60, stilstandSinds: Date.now() });
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T4b nog te kort stil: afstReden "te_kort"',
        r && r.afstReden === 'te_kort',
        'te_kort', r ? r.afstReden : 'geen regel');

    // Rijdend boven de stilstandsdrempel maar onder NODE_HOEK_KMH.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 60, closestAf: 20, closestHoek: 60, kmh: 4 });
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T4c rijdend (4 km/u): afstReden "kmh"',
        r && r.afstReden === 'kmh', 'kmh', r ? r.afstReden : 'geen regel');

    // ═══ T4d — DE VROEGE POORTEN ═════════════════════════════
    zetLS('sl_opslaglog', '[]');
    opzet({ kmh: 9 });                     // boven NODE_HOEK_KMH
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T4d boven de snelheidsdrempel: poortReden "snelheid"',
        r && r.poortReden === 'snelheid', 'snelheid',
        r ? r.poortReden : 'geen regel');

    zetLS('sl_opslaglog', '[]');
    opzet({ laatsteCorrectie: Date.now() });   // bounce-guard actief
    tick();
    r = laatste('autolock_correctie_geweigerd');
    eis('T4e kort na een vorige correctie: poortReden "bounce"',
        r && r.poortReden === 'bounce', 'bounce',
        r ? r.poortReden : 'geen regel');

    // ═══ T5 — REGRESSIEWACHT ═════════════════════════════════
    // De correctie moet nog steeds VUREN als alle poorten open staan, en dan
    // mag er juist géén weigerregel komen.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 60, closestAf: 20, closestHoek: 10 });   // 40m verschil
    const voorId = String(dichtstbijOSM.id);
    tick();
    eis('T5 met alle poorten open corrigeert de app nog steeds',
        String(dichtstbijOSM.id) === String(CLOSEST) && voorId === String(GEKOZEN),
        'node gewisseld naar ' + CLOSEST, String(dichtstbijOSM.id));
    eis('T5b en dan staat er geen weigerregel',
        logRegels('autolock_correctie_geweigerd').length === 0,
        '0 regels', String(logRegels('autolock_correctie_geweigerd').length));

    // peilingDuidelijkBeter geeft nog exact dezelfde ja/nee als voorheen —
    // de toegevoegde regels zijn uitsluitend toewijzingen.
    opzet({ gekozenAf: 40, closestAf: 39.6, gekozenHoek: 70, closestHoek: 0 });
    const jaGeval = peilingDuidelijkBeter(huidigePos, dichtstbijOSM, 40,
                                          puurDichtsteNodeCache, 39.6);
    opzet({ gekozenAf: 40, closestAf: 38, gekozenHoek: 40, closestHoek: 30 });
    const neeGeval = peilingDuidelijkBeter(huidigePos, dichtstbijOSM, 40,
                                           puurDichtsteNodeCache, 38);
    eis('T5c peilingDuidelijkBeter geeft nog steeds true bij een duidelijk voordeel',
        jaGeval === true, 'true', String(jaGeval));
    eis('T5d en false bij een te klein voordeel',
        neeGeval === false, 'false', String(neeGeval));
    eis('T5e bij true blijft de weigerreden leeg',
        (peilingDuidelijkBeter(huidigePos, { lat: 52.0006, lon: 4.7 }, 40,
          { lat: 52.0, lon: 4.7006 }, 40), true),
        'geen uitzondering', 'geen uitzondering');

    // De meting schrijft NIETS buiten sl_opslaglog.
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 40, closestAf: 38, gekozenHoek: 40, closestHoek: 30 });
    const nodeVoor = String(dichtstbijOSM.id);
    const lockVoor = handmatigLockActief, autoVoor = stilstandAutoLock;
    tick();
    eis('T5f de meting raakt de node en de locks niet aan',
        String(dichtstbijOSM.id) === nodeVoor && handmatigLockActief === lockVoor
          && stilstandAutoLock === autoVoor,
        'alles ongewijzigd',
        dichtstbijOSM.id + ', hand=' + handmatigLockActief + ', auto=' + stilstandAutoLock);

    // ═══ T6 — DE HERHAALREM ══════════════════════════════════
    zetLS('sl_opslaglog', '[]');
    opzet({ gekozenAf: 40, closestAf: 38, gekozenHoek: 40, closestHoek: 30 });
    tick(); tick(); tick();
    eis('T6 dezelfde afwijking logt maar één keer binnen de herhaaltermijn',
        logRegels('autolock_correctie_geweigerd').length === 1,
        '1 regel na 3 ticks', String(logRegels('autolock_correctie_geweigerd').length));

    // ═══ T7 — GEEN ENKELE ANDERE LOGREGEL VERANDERT ══════════
    zetLS('sl_opslaglog', '[]');
    logOpslagMis('kandidaat_verlaten', { node: '999999' });
    const ander = laatste('kandidaat_verlaten');
    eis('T7 de nieuwe velden staan op null bij elke andere reden',
        ander && ander.poortReden === null && ander.afstReden === null
          && ander.hoekReden === null && ander.hoekN === null
          && ander.hoekVoordeel === null,
        'alle vijf null',
        ander ? [ander.poortReden, ander.afstReden, ander.hoekReden,
                 ander.hoekN, ander.hoekVoordeel].join(', ') : 'geen regel');

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
    handmatigLockActief = bewaard.handmatigLockActief;
    stilstandAutoLock = bewaard.stilstandAutoLock;
    handmatigGeselecteerdNodeId = bewaard.handmatigGeselecteerdNodeId;
    headingBuffer.length = 0;
    for (const h of bewaard.headingBufferInhoud) headingBuffer.push(h);
    hoekStabielSleutel = bewaard.hoekStabielSleutel;
    hoekStabielTeller = bewaard.hoekStabielTeller;
    nodeCorrWeiger = bewaard.nodeCorrWeiger;
    peilingWeigerReden = bewaard.peilingWeigerReden;
    peilingLaatsteVoordeel = bewaard.peilingLaatsteVoordeel;
    vorigOsmId = bewaard.vorigOsmId;
    dichtstbijOSMTwijfel = bewaard.dichtstbijOSMTwijfel;
    autolockWeigerSleutel = null;
    autolockWeigerTijd = 0;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testAutolockWeiger = testAutolockWeiger;
