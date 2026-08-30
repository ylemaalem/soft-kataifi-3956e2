// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nulpunt.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Regressietest bij V11.17.64, bijgewerkt in V11.17.68 voor de nieuwe
//  bevestigindeling. Toetst dat countdownNulTijd het moment
//  markeert waarop de OORSPRONKELIJKE voorspelling verstrijkt, en niets
//  anders.
//
//  Waarom dit bestand bestaat: de tests bij V11.17.62 zetten cdBereikteNul en
//  countdownNulTijd zelf in het harnas en toetsten daarna de demping en de
//  kleur. Ze waren geldig, maar ze konden de bug van V11.17.64 per constructie
//  niet zien — die zat juist in HOE het nulpunt tot stand komt. T1 en T2
//  hieronder raken die waarden daarom nergens aan: ze laten tickCd() de
//  over===0-tak zelf bereiken en kijken wat de app dan doet.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_nulpunt.js';
//      document.head.appendChild(s);
//      s.onload = () => testNulpunt().then(r => console.table(r.regels));
//
//  Het model hoeft niet te laden en de camera hoeft niet te draaien; alleen
//  het scriptblok van index.html moet geëvalueerd zijn.
// ═══════════════════════════════════════════════════════════════

function testNulpunt() {
  const regels = [];
  const slaap = ms => new Promise(r => setTimeout(r, ms));
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  // ── gedeelde opzet ────────────────────────────────────────────
  // Alles wat een echte rode fase nodig heeft, BEHALVE cdBereikteNul en
  // countdownNulTijd: die moeten door tickCd zelf gezet worden.
  function verseRodeFase(doel, modus, cdMin) {
    fase = 'rood';
    activeCdDoel = doel;
    activeCdModus = modus;
    activeCdMin = cdMin;
    activeCdMax = cdMin != null ? doel * 2 : null;
    huidigCdBron = 'test';
    v9PreSelectieAfrij = null;
    osmVoorspellingActief = false;
    dichtstbijOSM = { id: 111111, lat: 52, lon: 5, afstand: 30, naam: 'TEST' };
    cdWallStart = Date.now();
    cdCondSleutel = null; cdCondTab = null;
    cdCondDoel = null; cdCondDoelVer = 0;
    cdWeergaveNulTijd = null; cdLaatstGetoond = null;
    herzTel = null;
    // dit is het punt van de test: de app moet ze zelf zetten
    cdBereikteNul = false;
    countdownNulTijd = null;
  }
  const tikOp = verSec => { cdStart = performance.now() - verSec * 1000; tickCd(); };

  // ══ T1 — CD_VAAG mag het nulpunt niet vroeg zetten (FIX A) ════
  // Dit is exact de situatie van de Hogeweg-foto: CD_VAAG met cdMin op de
  // bodem 1 en een doel van 20s. Vóór V11.17.64 zette de vroege trigger het
  // nulpunt bij ver=1 en stond KLOPTE de rest van de fase gedempt.
  verseRodeFase(20, CD_VAAG, 1);
  let vroegGezet = null;
  for (const ver of [2, 5, 10, 15, 19]) {
    tikOp(ver);
    if (cdBereikteNul && vroegGezet === null) vroegGezet = ver;
  }
  eis('T1 CD_VAAG zet het nulpunt niet vroeg',
      cdBereikteNul === false && countdownNulTijd === null,
      'cdBereikteNul=false tot over===0',
      vroegGezet !== null ? ('al gezet bij ver=' + vroegGezet) : 'niet gezet');

  // ══ T2 — de app zet het nulpunt zelf op over===0 ══════════════
  const voorTik = Date.now();
  tikOp(20.5);                       // over = max(0, 20 - 20,5) = 0
  const naTik = Date.now();
  eis('T2 nulpunt gezet door de over===0-tak',
      cdBereikteNul === true && typeof countdownNulTijd === 'number',
      'cdBereikteNul=true, countdownNulTijd numeriek',
      'cdBereikteNul=' + cdBereikteNul + ', countdownNulTijd=' + typeof countdownNulTijd);
  eis('T2b nulpunt staat op NU, niet eerder',
      countdownNulTijd >= voorTik && countdownNulTijd <= naTik,
      'binnen het tijdvenster van de tik',
      countdownNulTijd != null ? ((countdownNulTijd - voorTik) + 'ms na de tik') : 'null');

  // ══ T3 — KLOPTE volgt dat nulpunt, niet cdMin ═════════════════
  eis('T3 KLOPTE nog normaal direct na het nulpunt',
      klopteIsNoOp() === false, 'false (< 2s, dus nog GOED)', String(klopteIsNoOp()));

  // V11.17.68: 2,2s in plaats van 1,7s — de GOED-band loopt nu tot
  // BEV_GOED_MAX_MS (2000ms) in plaats van tot 1500ms.
  return slaap(2200).then(() => {
    eis('T3b KLOPTE gedempt 2,2s na het nulpunt',
        klopteIsNoOp() === true, 'true (> 2s, dus niet meer GOED)', String(klopteIsNoOp()));

    // ══ T4 — groen dat VOOR het nulpunt viel ═══════════════
    // V11.17.68: dit was 'BIJNA negeert een stale nulpunt' en toetste dat de
    // knop dan gedempt werd. Onder de nieuwe indeling is dit de toestand
    // 'groen-voor-nul' — de schatting was te LANG — en is BIJNA juist de
    // aangewezen knop: de tik wordt geregistreerd, alleen zonder correctie.
    // Dat de correctie niet geschreven wordt, toetst T5 hieronder.
    fase = 'groen';
    cdBereikteNul = false;                     // deze fase haalde nul niet
    countdownNulTijd = Date.now() - 5000;      // nulpunt van een VORIGE fase
    groenStart = performance.now() - 1000;
    eis('T4 groen-voor-nul: BIJNA blijft bedienbaar',
        bijnaIsNoOp() === false && meetBevestigMoment().toestand === 'groen-voor-nul',
        'false, toestand groen-voor-nul',
        String(bijnaIsNoOp()) + ', ' + meetBevestigMoment().toestand);

    // groen viel 5s NA het nulpunt — dat valt in de BIJNA-band (2-10s)
    cdBereikteNul = true;
    countdownNulTijd = Date.now() - 6000;
    groenStart = performance.now() - 1000;     // groen 5s na nul, 1s geleden getikt
    eis('T4b BIJNA actief bij 5s overschrijding',
        bijnaIsNoOp() === false && bevestigIndeling() === 'bijna',
        'false, indeling bijna',
        String(bijnaIsNoOp()) + ', ' + bevestigIndeling());

    // ══ T5 — stale nulpunt lekt niet naar het leergeheugen (FIX C)
    const sleutel = 'sl_bevestig_111111';
    const bewaard = localStorage.getItem(sleutel);
    localStorage.removeItem(sleutel);
    fase = 'groen';
    cdBereikteNul = false;
    countdownNulTijd = Date.now() - 5000;
    groenStart = null;
    bevestigActief = true;
    bevestigCountdown('bijna');
    let rec = null;
    try { rec = (JSON.parse(localStorage.getItem(sleutel)) || []).slice(-1)[0] || null; } catch (e) {}
    eis('T5 autoVerschilMs blijft null bij een stale nulpunt',
        rec !== null && rec.autoVerschilMs === null,
        'record met autoVerschilMs=null',
        rec ? ('autoVerschilMs=' + rec.autoVerschilMs) : 'geen record geschreven');
    localStorage.removeItem(sleutel);
    if (bewaard !== null) localStorage.setItem(sleutel, bewaard);

    // ══ T6 — de terugsprong wordt gemeten ══════════════════════
    // Herziening die de weergave op nul brengt terwijl `over` nog loopt: de
    // oranje voorlopige tak. Daarna loopt `over` ook af en slaat de teller om.
    //
    // LET OP, twee dingen die deze test moest leren:
    //  - `ver` is gesimuleerd via cdStart, maar cdWeergaveNulTijd en de teller
    //    lopen op WANDKLOKTIJD. Zonder een echte wachttijd blijft overschrS 0
    //    en meet T6 niets. Vandaar de slaap hieronder.
    //  - cdBereikteNul wordt in tickCd pas NA de weergavecascade gezet
    //    (index.html r6618). De omslag van de voorlopige naar de echte teller
    //    valt daardoor één frame later dan het moment waarop `over` nul raakt.
    //    Dat is ~16ms op het toestel en verder onschuldig, maar de test moet
    //    er wel op tikken, anders meet hij de omslag nooit.
    verseRodeFase(60, CD_GESCHAT, null);
    cdCondSleutel = '111111_' + cdWallStart + '_test';
    cdCondTab = new Array(181).fill(3);
    tikOp(40);                                   // herziening pakt: nog 3s
    tikOp(44);                                   // herziene waarde op nul -> oranje

    return slaap(1200).then(() => {
      tikOp(46);                                 // oranje teller: +1s wandklok
      const voorl = herzTel && herzTel.voorlVanaf !== null;
      const maxVoor = herzTel ? herzTel.voorlMax : null;
      eis('T6 voorlopige (oranje) tak wordt geregistreerd',
          voorl === true && maxVoor >= 1,
          'voorlVanaf gezet, voorlMax >= 1',
          'voorlVanaf=' + (voorl ? 'gezet' : 'null') + ', voorlMax=' + maxVoor);

      tikOp(60.5);   // `over` raakt nul; cdBereikteNul gaat AAN HET EIND van deze tik aan
      const naEerste = herzTel ? herzTel.sprong : null;
      tikOp(60.6);   // pas deze cascade ziet het echte nulpunt -> omslag
      eis('T6b omslag valt één frame na over===0',
          naEerste === null && herzTel && typeof herzTel.sprong === 'number',
          'sprong nog null na de eerste tik, numeriek na de tweede',
          'na 1e=' + naEerste + ', na 2e=' + (herzTel ? herzTel.sprong : 'geen herzTel'));
      eis('T6c terugsprong en duur vastgelegd',
          herzTel && typeof herzTel.sprong === 'number' && typeof herzTel.voorlMs === 'number'
            && herzTel.voorlMs >= 1000,
          'sprong numeriek, voorlMs >= 1000ms',
          herzTel ? ('sprong=' + herzTel.sprong + 's, voorlMs=' + herzTel.voorlMs + 'ms') : 'geen herzTel');

      // opruimen zodat de app niet in een testtoestand achterblijft
      fase = null; cdStart = null; cdBereikteNul = false; countdownNulTijd = null;
      bevestigActief = false; herzTel = null;
      cdCondSleutel = null; cdCondTab = null; cdCondDoel = null;
      cdWeergaveNulTijd = null; cdLaatstGetoond = null;

      const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
      return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
    });
  });
}

if (typeof window !== 'undefined') window.testNulpunt = testNulpunt;
