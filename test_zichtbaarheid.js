// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_zichtbaarheid.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.78: de bevestigknoppen verschijnen zodra er een countdown
//  loopt, ongeacht snelheid.
//
//  WAT HIER VASTLIGT
//
//  T1-T3 zijn de release zelf: knoppen bij 0, 20 en 50 km/u.
//
//  T4 is de belangrijkste test van het hele bestand. De oude poort had TWEE
//  remmen op dezelfde beweging — de stilstand-eis in de toon-tak, en een
//  aparte verbergtak op snelheidKmh > 15 zeven regels verderop. Wie er later
//  maar één terugzet, breekt de release zonder dat T1-T3 het merken: T1-T3
//  tonen de knoppen in ÉÉN tickCd-aanroep bij een vaste snelheid, en de oude
//  verbergtak sloeg pas toe zodra bevestigActief al true was. T4 draait daarom
//  twee opeenvolgende aanroepen met een snelheid die de oude drempel passeert.
//
//  T5-T7 bewaken de andere kant: "ongeacht snelheid" mag niet verworden tot
//  "altijd". Er moet een countdown lopen, en die moet bij een vaste bbox horen
//  (fase === 'rood'). T7 is de smalle variant die deze release bewust koos —
//  een GPS-voorspelling zonder camera-detectie (osmVoorspellingActief,
//  fase === null) geeft GEEN knoppen, ook al draagt de pill dan .actief.
//
//  T5b legt iets vast dat bij het schrijven van deze tests naar boven kwam:
//  cdPillActief in de poort is tautologisch waar. r6982 zet .actief
//  onvoorwaardelijk zodra de cdActief-guard gepasseerd is, dus de klasse
//  weghalen sluit niets af — tickCd zet hem in dezelfde aanroep terug. De
//  conjunct die werkelijk beslist is fase === 'rood'.
//
//  T8-T9 toetsen niet de groen-tak van de poort maar het pad dat er in
//  werkelijkheid toe leidt. Die tak is ONBEREIKBAAR vanuit tickCd — de guard op
//  r6975-6976 stuurt bij groen terug vóór de poort, wat de codebase zelf al
//  vastlegt bij updateBevestigKnopStaat (r4077-4081). Wat de gebruiker tijdens
//  groen ziet is de rij die de RODE fase aanzette. T9b is daarvan het geval
//  waar deze hele release om begon: een kloppende voorspelling bij 50 km/u —
//  tot nu toe verdween de rij dan ongebruikt en werd het succes nooit geteld.
//
//  T10-T18 zijn de regressiewacht op eis I: deze release raakt UITSLUITEND de
//  zichtbaarheid. Elke matrixtoestand wordt twee keer gedraaid, bij 0 en bij
//  50 km/u, met de eis dat beide runs identiek zijn. Kantelt daar iets, dan is
//  de indeling snelheidsgevoelig geworden — precies wat niet mag.
//
//  T19-T20 zijn de invarianten uit de vorige release: KLOPTE en BIJNA nooit
//  tegelijk, en FOUT nooit gedempt. Ze golden per constructie en moeten dat na
//  het openzetten van de poort nog steeds doen.
//
//  T21-T23 zijn broncode-wachten. Ze toetsen niet gedrag maar de afwezigheid
//  respectievelijk aanwezigheid van een regel, omdat het gedrag dat ze
//  bewaken alleen in een echte rit zichtbaar wordt.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_zichtbaarheid.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testZichtbaarheid().regels);
// ═══════════════════════════════════════════════════════════════

function testZichtbaarheid() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const bewaard = {
    fase, cdBereikteNul, countdownNulTijd, groenStart, cdStart,
    activeCdDoel, activeCdModus, bevestigActief, bevInertStaat,
    bevestigGedaanVoorFase, laatsteRoodFaseStart, snelheidKmh,
    dichtstbijOSM, osmVoorspellingActief, huidigCdBron,
    wrapClass: bevestigWrap.className,
    pillClass: cdPill.className
  };

  const zichtbaar = () => bevestigWrap.classList.contains('actief');
  const inert = (btn) => btn.classList.contains('inert');
  const beeld = () => (inert(bevKlopteBtn) ? 'grijs' : 'AAN') + ' / '
                    + (inert(bevBijnaBtn)  ? 'grijs' : 'AAN') + ' / '
                    + (inert(bevFoutBtn)   ? 'grijs' : 'AAN');

  // Schone uitgangstoestand voor de POORT-tests. Een lopende rode countdown op
  // een testnode, knoppen uit, marker leeg zodat _bevAlGedaan niet blokkeert.
  // dichtstbijOSM moet gezet zijn: bevestigMarkerSleutel keert anders null
  // terug en dan is _bevSleutel falsy — dat werkt hier toevallig ook, maar we
  // willen de sleutel wél door de echte code laten lopen.
  function opzetRoodLopend(kmh) {
    dichtstbijOSM = { id: 777003, lat: 52, lon: 5, afstand: 12, naam: 'TEST-ZICHT' };
    fase = 'rood';
    cdStart = performance.now();
    activeCdDoel = 30;
    cdBereikteNul = false;
    countdownNulTijd = null;
    osmVoorspellingActief = false;
    bevestigGedaanVoorFase = null;
    laatsteRoodFaseStart = Date.now();
    bevestigActief = false;
    bevestigWrap.classList.remove('actief');
    cdPill.classList.add('actief');
    snelheidKmh = kmh;
  }

  try {
    // ══ T1-T3 — de poort bij drie snelheden ═══════════════════
    opzetRoodLopend(0);   tickCd();
    eis('T1 kmh 0: knoppen verschijnen', zichtbaar(), 'zichtbaar',
        zichtbaar() ? 'zichtbaar' : 'WEG');

    opzetRoodLopend(20);  tickCd();
    eis('T2 kmh 20: knoppen verschijnen', zichtbaar(), 'zichtbaar',
        zichtbaar() ? 'zichtbaar' : 'WEG');

    opzetRoodLopend(50);  tickCd();
    eis('T3 kmh 50: knoppen verschijnen', zichtbaar(), 'zichtbaar',
        zichtbaar() ? 'zichtbaar' : 'WEG');

    // ══ T4 — de tweede rem is echt weg ════════════════════════
    // Eerst tonen onder de oude drempel, dan erboven doortikken. Onder de oude
    // code verscheen de rij op 14,9 en verdween hij op 15,1 in dezelfde tick.
    opzetRoodLopend(14.9); tickCd();
    const naEerste = zichtbaar();
    snelheidKmh = 15.1;    tickCd();
    eis('T4 14,9 -> 15,1 km/u: knoppen BLIJVEN staan (verbergtak weg)',
        naEerste && zichtbaar(), 'zichtbaar / zichtbaar',
        (naEerste ? 'zichtbaar' : 'WEG') + ' / ' + (zichtbaar() ? 'zichtbaar' : 'WEG'));

    // Wegrijden op volle snelheid mag ze evenmin weghalen.
    snelheidKmh = 80; tickCd();
    eis('T4b kmh 80: nog steeds zichtbaar', zichtbaar(), 'zichtbaar',
        zichtbaar() ? 'zichtbaar' : 'WEG');

    // ══ T5-T7 — de poort blijft dicht zonder countdown ════════
    // T5 legt vast wat de poort ECHT afsluit. Niet cdPillActief: r6982 zet
    // .actief onvoorwaardelijk zodra de cdActief-guard gepasseerd is, dus wie
    // de poort bereikt heeft de klasse altijd — de klasse eerst weghalen en dan
    // tickCd aanroepen zet hem meteen terug. De guard die telt is r6975-6976:
    // zonder cdStart loopt er geen countdown en keert tickCd terug vóór de
    // poort. Dit is de test die faalt als iemand die guard verruimt.
    opzetRoodLopend(50);
    cdStart = null;
    cdPill.classList.remove('actief');
    tickCd();
    eis('T5 kmh 50 zonder lopende countdown (cdStart null): geen knoppen',
        !zichtbaar(), 'weg', zichtbaar() ? 'ZICHTBAAR' : 'weg');

    // Bewijs bij T5: de pill-klasse is géén poort — tickCd zet hem zelf terug.
    opzetRoodLopend(50);
    cdPill.classList.remove('actief');
    tickCd();
    eis('T5b .actief weghalen sluit niets af — r6982 zet hem terug',
        zichtbaar() && cdPill.classList.contains('actief'),
        'zichtbaar, pill weer .actief',
        (zichtbaar() ? 'zichtbaar' : 'WEG') + ', pill '
          + (cdPill.classList.contains('actief') ? '.actief' : 'zonder .actief'));

    opzetRoodLopend(50);
    fase = 'oranje';
    tickCd();
    eis('T6 kmh 50 bij oranje: geen knoppen',
        !zichtbaar(), 'weg', zichtbaar() ? 'ZICHTBAAR' : 'weg');

    // De smalle variant: GPS-voorspelling zonder camera-detectie. De pill staat
    // op .actief (startCd r7530) maar er zit geen bbox vast, fase is null.
    opzetRoodLopend(50);
    fase = null;
    osmVoorspellingActief = true;
    tickCd();
    eis('T7 kmh 50 bij GPS-voorspelling zonder bbox (fase null): geen knoppen',
        !zichtbaar(), 'weg', zichtbaar() ? 'ZICHTBAAR' : 'weg');

    // ══ T8-T9 — het echte pad naar groen ══════════════════════
    // De `else if (fase === 'groen' && cdBereikteNul)`-tak in tickCd is
    // ONBEREIKBAAR en was dat vóór deze release al: de guard op r6975-6976 eist
    // fase === 'rood' of osmVoorspellingActief, en bij groen is het eerste
    // onwaar en het tweede door checkOsmVoorspelling (r7511-7513) uitgezet.
    // tickCd keert dan terug vóór de poort. Zie ook de toelichting bij
    // updateBevestigKnopStaat (r4077-4081), die om precies deze reden apart
    // vanuit lus() draait.
    //
    // Wat de gebruiker tijdens groen ziet, is dus de rij die de RODE fase heeft
    // aangezet en die daarna door niets verborgen is. Dát is het pad dat deze
    // release moet openen, en dat is wat hier getoetst wordt: aanzetten tijdens
    // rood op snelheid, dan groen laten vallen en vaststellen dat de rij blijft
    // staan en de juiste knop oplicht.
    function roodDanGroen(kmh, overschrMs) {
      opzetRoodLopend(kmh);
      tickCd();                       // rij verschijnt tijdens rood
      const naRood = zichtbaar();
      fase = 'groen';
      cdBereikteNul = true;
      countdownNulTijd = Date.now() - overschrMs;
      groenStart = performance.now();
      tickCd();                       // keert vroeg terug — mag niets verbergen
      bevInertStaat = '';
      updateBevestigKnopStaat();      // dit is wat bij groen wél draait
      return naRood;
    }

    let naRood = roodDanGroen(0, 1000);
    eis('T8 rood -> groen bij kmh 0: rij blijft staan, KLOPTE licht op',
        naRood && zichtbaar() && !inert(bevKlopteBtn) && inert(bevBijnaBtn),
        'zichtbaar, AAN / grijs / AAN',
        (zichtbaar() ? 'zichtbaar' : 'WEG') + ', ' + beeld());

    naRood = roodDanGroen(50, 1000);
    eis('T9 rood -> groen bij kmh 50: rij blijft staan, KLOPTE licht op',
        naRood && zichtbaar() && !inert(bevKlopteBtn) && inert(bevBijnaBtn),
        'zichtbaar, AAN / grijs / AAN',
        (zichtbaar() ? 'zichtbaar' : 'WEG') + ', ' + beeld());

    // T9b is de kern van de release in één regel: dit is precies het geval dat
    // tot nu toe NOOIT gemeten werd. Voorspelling klopt, licht springt op
    // groen, bestuurder rijdt weg — en de knoppen waren er niet meer.
    naRood = roodDanGroen(50, 500);
    eis('T9b de tot nu toe ongemeten situatie: klopte voorspelling bij 50 km/u',
        naRood && zichtbaar() && !inert(bevKlopteBtn),
        'zichtbaar, KLOPTE actief',
        (zichtbaar() ? 'zichtbaar' : 'WEG') + ', ' + beeld());

    // ══ T10-T18 — de indeling is snelheidsonafhankelijk ═══════
    // Zelfde opzet als test_knopkleur.js r80-95: door groenStart op nu te
    // zetten is groenWand = Date.now(), en dan levert countdownNulTijd =
    // nu - X precies overschrMs = X.
    function zet(toestand, overschrMs, kmh) {
      dichtstbijOSM = { id: 777003, lat: 52, lon: 5, afstand: 12, naam: 'TEST-ZICHT' };
      osmVoorspellingActief = false;
      if (toestand === 'rood-voor-nul') {
        fase = 'rood'; cdBereikteNul = false; countdownNulTijd = null;
        cdStart = performance.now(); activeCdDoel = 30;
      } else if (toestand === 'groen-voor-nul') {
        fase = 'groen'; cdBereikteNul = false; countdownNulTijd = null;
      } else if (toestand === 'groen-na-nul') {
        fase = 'groen'; cdBereikteNul = true;
        groenStart = performance.now();
        countdownNulTijd = Date.now() - overschrMs;
      }
      snelheidKmh = kmh;
      bevestigActief = true;
      bevestigWrap.classList.add('actief');
      bevInertStaat = '';              // memo forceren tot een verse schrijving
      updateBevestigKnopStaat();
    }

    // Draait één toestand bij 0 en bij 50 km/u en eist dat het beeld gelijk is
    // én gelijk aan de verwachting.
    function paar(naam, toestand, overschrMs, verwacht) {
      zet(toestand, overschrMs, 0);
      const bij0 = beeld();
      zet(toestand, overschrMs, 50);
      const bij50 = beeld();
      eis(naam, bij0 === verwacht && bij50 === verwacht,
          verwacht + ' bij 0 en 50', bij0 + ' | ' + bij50);
      return { bij0, bij50 };
    }

    paar('T10 rood vóór nul',            'rood-voor-nul',  null,  'grijs / AAN / AAN');
    paar('T11 groen vóór nul',           'groen-voor-nul', null,  'grijs / AAN / AAN');
    paar('T12 groen, 1s na nul',         'groen-na-nul',   1000,  'AAN / grijs / AAN');
    paar('T13 groen, 5s na nul',         'groen-na-nul',   5000,  'grijs / AAN / AAN');
    paar('T14 groen, 15s na nul',        'groen-na-nul',   15000, 'grijs / grijs / AAN');
    paar('T15 exact BEV_GOED_MAX_MS',    'groen-na-nul',   BEV_GOED_MAX_MS,      'AAN / grijs / AAN');
    paar('T16 BEV_GOED_MAX_MS + 1ms',    'groen-na-nul',   BEV_GOED_MAX_MS + 1,  'grijs / AAN / AAN');
    paar('T17 exact BEV_BIJNA_MAX_MS',   'groen-na-nul',   BEV_BIJNA_MAX_MS,     'grijs / AAN / AAN');
    paar('T18 BEV_BIJNA_MAX_MS + 1ms',   'groen-na-nul',   BEV_BIJNA_MAX_MS + 1, 'grijs / grijs / AAN');

    // ══ T19-T20 — de invarianten ══════════════════════════════
    const gevallen = [
      ['rood-voor-nul', null], ['groen-voor-nul', null],
      ['groen-na-nul', 1000], ['groen-na-nul', 5000], ['groen-na-nul', 15000],
      ['groen-na-nul', BEV_GOED_MAX_MS], ['groen-na-nul', BEV_GOED_MAX_MS + 1],
      ['groen-na-nul', BEV_BIJNA_MAX_MS], ['groen-na-nul', BEV_BIJNA_MAX_MS + 1]
    ];
    let beideAan = null, foutGedempt = null;
    for (const [t, o] of gevallen) {
      for (const kmh of [0, 20, 50]) {
        zet(t, o, kmh);
        if (!inert(bevKlopteBtn) && !inert(bevBijnaBtn) && beideAan === null) {
          beideAan = t + '@' + o + ' bij ' + kmh + ' km/u';
        }
        if (inert(bevFoutBtn) && foutGedempt === null) {
          foutGedempt = t + '@' + o + ' bij ' + kmh + ' km/u';
        }
      }
    }
    eis('T19 KLOPTE en BIJNA lichten nooit tegelijk op (9 toestanden x 3 snelheden)',
        beideAan === null, 'nooit beide AAN', beideAan || 'nooit beide AAN');
    eis('T20 FOUT is nooit gedempt (9 toestanden x 3 snelheden)',
        foutGedempt === null, 'FOUT altijd AAN', foutGedempt || 'FOUT altijd AAN');

    // ══ T21 — de tweede rem mag niet terugkomen ═══════════════
    // T4 vangt de terugkeer van de verbergtak alleen als iemand hem exact zo
    // terugzet. Deze wacht is grover en daarmee steviger: er hoort in tickCd
    // helemaal geen snelheidsvergelijking meer te staan.
    //
    // Commentaar MOET er eerst uit. String(fn) levert de bron inclusief
    // commentaar, en de toelichting boven de poort noemt de oude drempel
    // letterlijk ("snelheidKmh < 15, V11.10.1") om vast te leggen wat er weg
    // is. Zonder deze strip toetst T21 zijn eigen documentatie en faalt hij op
    // een correcte codebase — één keer waargenomen tijdens het schrijven.
    const zonderCommentaar = (bron) => bron
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ');
    const tickBron = zonderCommentaar(String(tickCd));
    eis('T21 tickCd bevat geen snelheidsdrempel meer',
        !/snelheidKmh\s*[<>]/.test(tickBron),
        'geen snelheidKmh-vergelijking',
        (tickBron.match(/snelheidKmh\s*[<>]\s*[\d.]+/g) || []).join(', ') || 'geen');

    // ══ T22 — de vensters staan nog waar ze stonden ═══════════
    eis('T22 BEV_GOED_MAX_MS / BEV_BIJNA_MAX_MS ongewijzigd',
        BEV_GOED_MAX_MS === 2000 && BEV_BIJNA_MAX_MS === 10000,
        '2000 / 10000', BEV_GOED_MAX_MS + ' / ' + BEV_BIJNA_MAX_MS);

    // ══ T23 — de verplaatste guard in toonRichtingKnoppen ═════
    // De bevestigActief-return mag niet vóór het persistente-keuze-blok staan:
    // daar blokkeert hij activeerPersistenteRichting, en dan blijft
    // v9PreSelectieAfrij null en kiest startCd een andere countdownbron. Dat is
    // een gedragswijziging aan de countdown, en die valt buiten deze release.
    // Alleen in broncode te toetsen: het echte pad vraagt een GPS-voorspelling
    // gevolgd door een rood-detectie tijdens het rijden.
    // Ook hier het commentaar eruit, om dezelfde reden als bij T21: de
    // toelichting bij de verplaatste guard noemt beide namen.
    const richtBron = zonderCommentaar(String(toonRichtingKnoppen));
    const iGuard = richtBron.indexOf('if (bevestigActief) return;');
    const iPersistent = richtBron.indexOf('activeerPersistenteRichting');
    eis('T23 bevestigActief-guard staat NA activeerPersistenteRichting',
        iGuard > -1 && iPersistent > -1 && iGuard > iPersistent,
        'guard na de persistente activering',
        iGuard === -1 ? 'GUARD WEG'
          : iPersistent === -1 ? 'activeerPersistenteRichting WEG'
          : (iGuard > iPersistent ? 'guard staat erna' : 'GUARD STAAT ERVOOR'));

    // ══ T24 — het kmh-veld in het bevestig-record ═════════════
    // Puur op de bron: bevestigCountdown schrijft naar localStorage en roept
    // verwerkBevestigLeren aan, dus een echte tik zou het leergeheugen van een
    // testnode vervuilen. De wacht is dat het veld bestaat en uit snelheidKmh
    // komt — zonder dat veld is de oude populatie (kmh < 15) later niet meer
    // van de nieuwe te scheiden.
    const bevBron = zonderCommentaar(String(bevestigCountdown));
    eis('T24 bevestigCountdown schrijft kmh in het record',
        /kmh:\s*\(typeof snelheidKmh/.test(bevBron),
        'kmh-veld uit snelheidKmh',
        /kmh:/.test(bevBron) ? 'kmh-veld aanwezig' : 'KMH-VELD WEG');

  } finally {
    fase = bewaard.fase; cdBereikteNul = bewaard.cdBereikteNul;
    countdownNulTijd = bewaard.countdownNulTijd; groenStart = bewaard.groenStart;
    cdStart = bewaard.cdStart; activeCdDoel = bewaard.activeCdDoel;
    activeCdModus = bewaard.activeCdModus;
    bevestigActief = bewaard.bevestigActief; bevInertStaat = bewaard.bevInertStaat;
    bevestigGedaanVoorFase = bewaard.bevestigGedaanVoorFase;
    laatsteRoodFaseStart = bewaard.laatsteRoodFaseStart;
    snelheidKmh = bewaard.snelheidKmh;
    dichtstbijOSM = bewaard.dichtstbijOSM;
    osmVoorspellingActief = bewaard.osmVoorspellingActief;
    huidigCdBron = bewaard.huidigCdBron;
    bevestigWrap.className = bewaard.wrapClass;
    cdPill.className = bewaard.pillClass;
    bevKlopteBtn.classList.remove('inert');
    bevBijnaBtn.classList.remove('inert');
    bevFoutBtn.classList.remove('inert');
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testZichtbaarheid = testZichtbaarheid;
