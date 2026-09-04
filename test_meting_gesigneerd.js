// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_meting_gesigneerd.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.80: de afwijking mét teken in groen-voor-nul.
//
//  WAT DEZE RELEASE DOET, EN VOORAL WAT NIET
//  De app kon wel meten hoe LAAT groen was (overschrMs, positief) maar niet hoe
//  VROEG. Viel groen vóór de voorspelde nul, dan bleef overschrMs null en was er
//  niets te meten. Dat nieuwe getal staat nu in een APART veld, afwijkingMs.
//
//  Dat het een apart veld is, is de kern van de release. bevestigIndeling
//  (r3920) toetst ondertekend: `m.overschrMs <= BEV_GOED_MAX_MS` is waar voor
//  élk negatief getal. Een negatieve waarde in overschrMs zou dus KLOPTE laten
//  oplichten bij groen dat veertig seconden te vroeg viel, en klopteIsNoOp is
//  niet alleen de kleur maar ook de schrijfpoort (r7514) — de tik zou met
//  gewicht 0,4, het zwaarste van de drie, het leergeheugen in lopen.
//
//  T9 en T10 zijn daarom de belangrijkste toetsen van dit bestand. Ze bewijzen
//  dat de meting bestaat en dat er niets aan het gedrag verandert. Ze zijn de
//  wacht tegen precies één toekomstige vergissing: iemand die de gesigneerde
//  waarde alsnog in overschrMs schuift omdat dat "netter" lijkt.
//
//  T11-T13 bewaken de twee geldigheidstoetsen. Die zijn er niet voor de sier:
//  resetNeutraal houdt cdWallStart en cdWallNodeId BEWUST vast na een dropout
//  (r6741-6743), dus zonder die toetsen zou de meting het staleness-patroon
//  reproduceren dat V11.17.64 FIX B voor countdownNulTijd moest opruimen —
//  bijna-records met autoVerschilMs van 230s tot 588s, binnen één rode fase
//  onmogelijk.
//
//  T14 is de ijking. In groen-na-nul meten overschrMs en afwijkingMs hetzelfde
//  ding langs twee verschillende wegen (countdownNulTijd tegen
//  cdWallStart + activeCdDoel). Lopen die uiteen, dan is de nieuwe formule niet
//  te vertrouwen en is de data die deze release verzamelt waardeloos zonder dat
//  iemand dat zou merken.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_meting_gesigneerd.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testMetingGesigneerd().regels);
// ═══════════════════════════════════════════════════════════════

function testMetingGesigneerd() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  // De meting loopt over twee klokken (Date.now en performance.now) en over een
  // paar regels code; een marge van 60ms is ruim genoeg om jitter op te vangen
  // en veel te krap om een echte fout te verbergen.
  const RUIM = 60;
  const dichtbij = (a, b) => typeof a === 'number' && Math.abs(a - b) <= RUIM;

  const bewaard = {
    fase, cdBereikteNul, countdownNulTijd, groenStart, cdStart,
    activeCdDoel, cdWallStart, cdWallNodeId, dichtstbijOSM,
    huidigCdBron, huidigCdWaarde, snelheidKmh, bevestigActief, bevInertStaat,
    wrapClass: bevestigWrap.className
  };

  const NODE = 777004;
  // Zet de toestand groen-voor-nul met een gewenste afwijking.
  //   afwMs < 0  -> groen kwam die hoeveelheid TE VROEG
  //   afwMs > 0  -> te laat
  // De rekenregel is groenWand - (cdWallStart + activeCdDoel*1000). Door
  // groenStart op nu te zetten is groenWand = Date.now(), en dan levert
  // cdWallStart = nu - (doel*1000 + afwMs) precies afwijkingMs = afwMs.
  function zetGroenVoorNul(afwMs, doelS) {
    const doel = (doelS == null) ? 30 : doelS;
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 12, naam: 'TEST-MG' };
    fase = 'groen';
    cdBereikteNul = false;
    countdownNulTijd = null;
    groenStart = performance.now();
    activeCdDoel = doel;
    cdWallNodeId = String(NODE);
    cdWallStart = Date.now() - (doel * 1000 + afwMs);
  }

  try {
    // ══ T1-T3 — de drie richtingen ════════════════════════════
    zetGroenVoorNul(-3000);
    let m = meetBevestigMoment();
    eis('T1 groen viel 3s te vroeg -> afwijkingMs ongeveer -3000',
        m.toestand === 'groen-voor-nul' && dichtbij(m.afwijkingMs, -3000),
        'groen-voor-nul, ongeveer -3000',
        m.toestand + ', ' + m.afwijkingMs);

    zetGroenVoorNul(0);
    m = meetBevestigMoment();
    eis('T2 groen viel precies op tijd -> afwijkingMs ongeveer 0',
        dichtbij(m.afwijkingMs, 0), 'ongeveer 0', String(m.afwijkingMs));

    zetGroenVoorNul(5000);
    m = meetBevestigMoment();
    eis('T3 groen viel 5s te laat -> afwijkingMs ongeveer +5000',
        dichtbij(m.afwijkingMs, 5000), 'ongeveer +5000', String(m.afwijkingMs));

    // Een grote afwijking mag niet stilletjes geklemd worden: het hele punt van
    // release 1 is de VERDELING meten, en die beslist of het symmetrische
    // venster (-10/+10) de goede vorm heeft.
    zetGroenVoorNul(-9000);
    m = meetBevestigMoment();
    eis('T3b groen 9s te vroeg wordt niet geklemd',
        dichtbij(m.afwijkingMs, -9000), 'ongeveer -9000', String(m.afwijkingMs));

    // ══ T4-T6 — null-safety, geen crash en geen NaN ═══════════
    zetGroenVoorNul(-3000); cdWallStart = null;
    m = meetBevestigMoment();
    eis('T4 cdWallStart null -> afwijkingMs null, geen crash',
        m.afwijkingMs === null, 'null', String(m.afwijkingMs));

    zetGroenVoorNul(-3000); activeCdDoel = null;
    m = meetBevestigMoment();
    eis('T5 activeCdDoel null -> afwijkingMs null',
        m.afwijkingMs === null, 'null', String(m.afwijkingMs));

    zetGroenVoorNul(-3000); activeCdDoel = 0;
    m = meetBevestigMoment();
    eis('T5b activeCdDoel 0 -> afwijkingMs null (geen deling door een niet-doel)',
        m.afwijkingMs === null, 'null', String(m.afwijkingMs));

    zetGroenVoorNul(-3000); groenStart = null;
    m = meetBevestigMoment();
    eis('T6 groenStart null -> afwijkingMs null',
        m.afwijkingMs === null, 'null', String(m.afwijkingMs));

    // Geen enkele opzet mag NaN opleveren — dat glijdt als "getal" het record in.
    let zagNaN = null;
    for (const opzet of [
      () => { zetGroenVoorNul(-3000); cdWallStart = null; },
      () => { zetGroenVoorNul(-3000); activeCdDoel = null; },
      () => { zetGroenVoorNul(-3000); groenStart = null; },
      () => { zetGroenVoorNul(-3000); cdStart = null; },
      () => { zetGroenVoorNul(-3000); dichtstbijOSM = null; }
    ]) {
      opzet();
      const r = meetBevestigMoment();
      if (typeof r.afwijkingMs === 'number' && isNaN(r.afwijkingMs)) zagNaN = 'NaN gezien';
    }
    eis('T6b geen enkele ontbrekende bron levert NaN op',
        zagNaN === null, 'nooit NaN', zagNaN || 'nooit NaN');

    // ══ T7 — de twee paden lopen niet door elkaar ═════════════
    // In groen-na-nul moet overschrMs uit de BESTAANDE formule komen
    // (groenWand - countdownNulTijd), niet uit de nieuwe. Opzet: zet de twee
    // bronnen expres ver uit elkaar en toets welke overschrMs volgt.
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 12, naam: 'TEST-MG' };
    fase = 'groen';
    cdBereikteNul = true;
    groenStart = performance.now();
    countdownNulTijd = Date.now() - 4000;      // oude formule zegt +4000
    activeCdDoel = 30;
    cdWallNodeId = String(NODE);
    cdWallStart = Date.now() - (30 * 1000 - 7000);  // nieuwe formule zegt -7000
    m = meetBevestigMoment();
    eis('T7 groen-na-nul: overschrMs komt uit de bestaande formule, niet de nieuwe',
        m.toestand === 'groen-na-nul' && dichtbij(m.overschrMs, 4000),
        'toestand groen-na-nul, overschrMs ongeveer +4000',
        m.toestand + ', overschrMs=' + m.overschrMs + ', afwijkingMs=' + m.afwijkingMs);
    eis('T7b en afwijkingMs volgt daar wel de nieuwe formule',
        dichtbij(m.afwijkingMs, -7000), 'ongeveer -7000', String(m.afwijkingMs));

    // ══ T8 — het record draagt mv en afwijkingMs ══════════════
    // Op de bron getoetst en niet door echt te tikken: bevestigCountdown
    // schrijft naar localStorage en roept verwerkBevestigLeren aan, wat het
    // leergeheugen van een testnode zou vervuilen.
    const zonderCommentaar = (b) => b
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const bevBron = zonderCommentaar(String(bevestigCountdown));
    eis('T8 bevestigCountdown schrijft mv: 2 in het record',
        /\bmv:\s*2\b/.test(bevBron), 'mv: 2 aanwezig',
        /\bmv:/.test(bevBron) ? 'mv aanwezig' : 'MV-VELD WEG');
    eis('T8b en schrijft afwijkingMs uit het gemeten moment',
        /afwijkingMs:\s*_mom\.afwijkingMs/.test(bevBron),
        'afwijkingMs uit _mom',
        /afwijkingMs/.test(bevBron) ? 'veld aanwezig' : 'VELD WEG');

    // ══ T9 — GEEN GEDRAGSWIJZIGING, deel 1 ════════════════════
    // bevestigIndeling mag door deze release niet anders gaan antwoorden. In
    // groen-voor-nul blijft overschrMs null, dus de indeling blijft null —
    // óók nu afwijkingMs een getal draagt.
    zetGroenVoorNul(-3000);
    m = meetBevestigMoment();
    eis('T9 groen-voor-nul met afwijkingMs -3000: overschrMs blijft null',
        m.overschrMs === null && typeof m.afwijkingMs === 'number',
        'overschrMs null, afwijkingMs getal',
        'overschrMs=' + m.overschrMs + ', afwijkingMs=' + m.afwijkingMs);
    eis('T9b bevestigIndeling geeft nog steeds null, NIET goed',
        bevestigIndeling(m) === null, 'null',
        String(bevestigIndeling(m)));
    // De wacht tegen de vergissing die dit bestand moet voorkomen: zou iemand
    // de gesigneerde waarde alsnog in overschrMs zetten, dan zegt de
    // ONGEWIJZIGDE bevestigIndeling 'goed' bij -3000. Dat is exact de reden
    // voor het aparte veld, en dit legt het vast.
    eis('T9c bewijs: dezelfde waarde IN overschrMs zou wel goed opleveren',
        bevestigIndeling({ overschrMs: -3000 }) === 'goed',
        "'goed' (daarom een apart veld)",
        String(bevestigIndeling({ overschrMs: -3000 })));
    eis('T9d bevestigIndeling gebruikt de absolute waarde nog NIET (dat is release 2)',
        bevestigIndeling({ overschrMs: -40000 }) === 'goed',
        "'goed' — ondertekend, ongewijzigd",
        String(bevestigIndeling({ overschrMs: -40000 })));

    // ══ T10 — GEEN GEDRAGSWIJZIGING, deel 2 ═══════════════════
    zetGroenVoorNul(-1000);
    eis('T10 klopteIsNoOp blijft true in groen-voor-nul: KLOPTE blijft grijs',
        klopteIsNoOp() === true, 'true', String(klopteIsNoOp()));
    eis('T10b bijnaIsNoOp blijft false in groen-voor-nul: BIJNA blijft actief',
        bijnaIsNoOp() === false, 'false', String(bijnaIsNoOp()));
    eis('T10c bevestigMomentDefinitief blijft false in groen-voor-nul',
        bevestigMomentDefinitief(meetBevestigMoment()) === false, 'false',
        String(bevestigMomentDefinitief(meetBevestigMoment())));

    // En de knopstaat zelf, langs de echte weg.
    zetGroenVoorNul(-1000);
    bevestigActief = true; bevestigWrap.classList.add('actief');
    bevInertStaat = ''; updateBevestigKnopStaat();
    const beeld = (bevKlopteBtn.classList.contains('inert') ? 'grijs' : 'AAN') + ' / '
                + (bevBijnaBtn.classList.contains('inert')  ? 'grijs' : 'AAN') + ' / '
                + (bevFoutBtn.classList.contains('inert')   ? 'grijs' : 'AAN');
    eis('T10d de knoppenrij ziet er onveranderd uit: grijs / AAN / AAN',
        beeld === 'grijs / AAN / AAN', 'grijs / AAN / AAN', beeld);

    // ══ T11-T13 — de twee geldigheidstoetsen ══════════════════
    zetGroenVoorNul(-3000);
    cdWallNodeId = '999999';                    // countdown hoorde bij een andere node
    m = meetBevestigMoment();
    eis('T11 cdWallStart van een ANDERE node -> afwijkingMs null',
        m.afwijkingMs === null, 'null', String(m.afwijkingMs));

    zetGroenVoorNul(-3000);
    dichtstbijOSM = null;                       // geen huidige node om tegen te toetsen
    m = meetBevestigMoment();
    eis('T11b zonder dichtstbijOSM -> afwijkingMs null',
        m.afwijkingMs === null, 'null', String(m.afwijkingMs));

    // Buiten het continuïteitsvenster van startCd (activeCdDoel + 12s) hoort de
    // meting te zwijgen: daarbuiten zou startCd de countdown zelf opnieuw
    // gestart hebben, dus cdWallStart is dan niet de start van DEZE voorspelling.
    zetGroenVoorNul(0, 30);
    cdWallStart = Date.now() - (30 + CD_DROPOUT_MAX_S + 5) * 1000;
    m = meetBevestigMoment();
    eis('T12 cdWallStart ver buiten het dropout-venster -> afwijkingMs null',
        m.afwijkingMs === null, 'null', String(m.afwijkingMs));

    zetGroenVoorNul(0, 30);
    cdWallStart = Date.now() - (30 + CD_DROPOUT_MAX_S - 3) * 1000;
    m = meetBevestigMoment();
    eis('T13 net BINNEN het dropout-venster -> afwijkingMs wel gevuld',
        typeof m.afwijkingMs === 'number',
        'een getal', String(m.afwijkingMs));

    // ══ T14 — de ijking ═══════════════════════════════════════
    // In groen-na-nul meten de twee formules hetzelfde. countdownNulTijd wordt
    // in tickCd (r7420) gezet op het moment dat `over` nul raakt, en dat moment
    // is cdWallStart + activeCdDoel*1000. Wijken ze af, dan deugt de nieuwe
    // formule niet en is alle data van deze release onbruikbaar.
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 12, naam: 'TEST-MG' };
    fase = 'groen'; cdBereikteNul = true;
    activeCdDoel = 30;
    cdWallNodeId = String(NODE);
    cdWallStart = Date.now() - (30 * 1000 + 4000);   // nul lag 4s geleden
    countdownNulTijd = cdWallStart + 30 * 1000;      // zoals tickCd hem zou zetten
    groenStart = performance.now();
    m = meetBevestigMoment();
    eis('T14 groen-na-nul: overschrMs en afwijkingMs meten hetzelfde',
        dichtbij(m.overschrMs, 4000) && dichtbij(m.afwijkingMs, 4000)
          && Math.abs(m.overschrMs - m.afwijkingMs) <= RUIM,
        'beide ongeveer +4000, verschil binnen ' + RUIM + 'ms',
        'overschrMs=' + m.overschrMs + ', afwijkingMs=' + m.afwijkingMs
          + ', verschil=' + (m.overschrMs - m.afwijkingMs));

    // ══ T15 — de valstrik blijft gedocumenteerd ═══════════════
    // cdStart is bij groen altijd al null (stopCd r7117, aangeroepen vanuit
    // verwerkFase r7007). Wie de berekening ooit op cdStart baseert, krijgt in
    // productie NaN terwijl een test met handgezette globals wél slaagt.
    const meetBron = zonderCommentaar(String(verwachtNulWand));
    eis('T15 verwachtNulWand gebruikt cdWallStart en NIET cdStart',
        /cdWallStart/.test(meetBron) && !/\bcdStart\b/.test(meetBron),
        'cdWallStart, geen cdStart',
        (/cdWallStart/.test(meetBron) ? 'cdWallStart aanwezig' : 'CDWALLSTART WEG')
          + ', ' + (/\bcdStart\b/.test(meetBron) ? 'CDSTART GEBRUIKT' : 'geen cdStart'));

    // ══ T16 — de niet-aanraken-lijst ══════════════════════════
    // Bronwacht op de vier functies die deze release met rust moest laten.
    const ind = zonderCommentaar(String(bevestigIndeling));
    eis('T16 bevestigIndeling leest afwijkingMs niet',
        !/afwijkingMs/.test(ind), 'geen afwijkingMs',
        /afwijkingMs/.test(ind) ? 'LEEST AFWIJKINGMS' : 'geen afwijkingMs');
    const def = zonderCommentaar(String(bevestigMomentDefinitief));
    eis('T16b bevestigMomentDefinitief eist nog steeds groen-na-nul',
        /groen-na-nul/.test(def) && !/afwijkingMs/.test(def),
        "toestand groen-na-nul, geen afwijkingMs",
        def.replace(/\s+/g, ' ').slice(0, 90));
    const vbl = zonderCommentaar(String(verwerkBevestigLeren));
    eis('T16c verwerkBevestigLeren leest afwijkingMs niet',
        !/afwijkingMs/.test(vbl), 'geen afwijkingMs',
        /afwijkingMs/.test(vbl) ? 'LEEST AFWIJKINGMS' : 'geen afwijkingMs');
    eis('T16d de drie schrijftakken staan er ongewijzigd in',
        /gem \* 1\.6/.test(vbl) && /gem \+ correctieSec/.test(vbl)
          && /0\.4, dd, 'bevestig_klopte'/.test(vbl),
        'fout 1.6, bijna gem+correctie, klopte 0.4',
        [/gem \* 1\.6/.test(vbl) ? 'fout ok' : 'FOUT GEWIJZIGD',
         /gem \+ correctieSec/.test(vbl) ? 'bijna ok' : 'BIJNA GEWIJZIGD',
         /0\.4, dd, 'bevestig_klopte'/.test(vbl) ? 'klopte ok' : 'KLOPTE GEWIJZIGD'].join(', '));

  } finally {
    fase = bewaard.fase; cdBereikteNul = bewaard.cdBereikteNul;
    countdownNulTijd = bewaard.countdownNulTijd; groenStart = bewaard.groenStart;
    cdStart = bewaard.cdStart; activeCdDoel = bewaard.activeCdDoel;
    cdWallStart = bewaard.cdWallStart; cdWallNodeId = bewaard.cdWallNodeId;
    dichtstbijOSM = bewaard.dichtstbijOSM;
    huidigCdBron = bewaard.huidigCdBron; huidigCdWaarde = bewaard.huidigCdWaarde;
    snelheidKmh = bewaard.snelheidKmh;
    bevestigActief = bewaard.bevestigActief; bevInertStaat = bewaard.bevInertStaat;
    bevestigWrap.className = bewaard.wrapClass;
    bevKlopteBtn.classList.remove('inert');
    bevBijnaBtn.classList.remove('inert');
    bevFoutBtn.classList.remove('inert');
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testMetingGesigneerd = testMetingGesigneerd;
