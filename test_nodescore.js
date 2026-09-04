// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nodescore.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.79: bij stilstand telt de peiling mee in de node-keuze.
//
//  HET GEMETEN GEVAL
//  Export 3 september, 16:59:05. Twee nodes allebei op 22m: de gekozene 49
//  graden uit de rijrichting, de juiste 17 graden. De stilstandtak van
//  vindDichtbijScore (r8423) kent geen richtingsterm, dus beide scoren exact
//  0,778689 en alleen conf (spanwijdte 0,05) of de volgorde van osmCache
//  beslist. De gebruiker moest handmatig corrigeren.
//
//  T2 is het hart van dit bestand: hij zet dat geval na en eist de JUISTE
//  uitkomst. Vóór deze release faalt hij. Dat is de bedoeling — een test die
//  het defect niet kan aanwijzen bewijst ook niet dat het weg is.
//
//  T5 tot en met T7 zijn de wacht tegen overcorrectie, en die zijn even
//  belangrijk. Zonder die drie toetst dit bestand alleen of de tiebreak vuurt,
//  niet of hij zich inhoudt waar dat hoort:
//    T5  echt afstandsverschil (> NODE_HOEK_GELIJK_M) mag niet overruled worden
//    T6  onder NODE_HOEK_MIN_AFSTAND_M is de peiling ruis en telt hij niet
//    T7  een hoekwinst onder NODE_HOEK_VOORDEEL_GRAD is ruis en telt niet
//
//  T8 legt vast wat de tiebreak NIET doet: een al zittende node wordt er niet
//  door verdrongen, want de tiebreak staat vóór de hysterese. Dat is geen
//  tekortkoming maar de reden dat de hoekroute in checkNodeCorrectieStilstand
//  bestaat — die heeft de bounce-guard van 10s en de stabiliteitseis.
//
//  T11 tot en met T14 toetsen die tweede route apart, inclusief de dode zone
//  3 <= kmh < 5 waarin het gemeten geval viel.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_nodescore.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testNodescore().regels);
// ═══════════════════════════════════════════════════════════════

function testNodescore() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  // Zelfde plaatsingshelpers als test_peiling.js r40-46, zodat de twee
  // bestanden dezelfde geometrie spreken.
  const LAT = 52.0, LON = 5.0;
  const M_LAT = 1 / 111320;
  const M_LON = 1 / (111320 * Math.cos(LAT * Math.PI / 180));

  // Node op `af` meter afstand, onder `peiling` graden t.o.v. de rijrichting.
  // De heading van het gemeten geval is 266 graden; peiling +49 betekent dus
  // een kompaskoers van 266+49 = 315.
  const HDG = 266;
  function nodeOp(af, peiling, id) {
    const koers = (HDG + peiling + 360) % 360;
    const rad = koers * Math.PI / 180;
    return { id, naam: 'T' + id,
             lat: LAT + (af * Math.cos(rad)) * M_LAT,
             lon: LON + (af * Math.sin(rad)) * M_LON };
  }

  const bewaard = {
    osmCache, dichtstbijOSM, snelheidKmh, huidigeRichting,
    huidigePos, puurDichtsteNodeCache, stilstandSinds,
    handmatigLockActief, stilstandAutoLock, laatsteNodeCorrectieTijd,
    laatsteNodeWisselTijd, hoekStabielSleutel, hoekStabielTeller,
    s2Kopie: new Map(s2BboxTeller), headingKopie: headingBuffer.slice(),
    vorigOsmId
  };

  // A = de scheve node (49 graden), B = de juiste (17 graden).
  // A krijgt bewust het LAGERE id zodat hij ook in osmCache vooraan staat: bij
  // een exacte scoregelijkstand wint in vindDichtbij de eerste (r8530 gebruikt
  // `>`, niet `>=`). Zo kan de test niet per ongeluk slagen op volgorde.
  const A_ID = 7888678609, B_ID = 7888678612;

  function opzet(afA, peilA, afB, peilB, kmh) {
    const A = nodeOp(afA, peilA, A_ID);
    const B = nodeOp(afB, peilB, B_ID);
    osmCache = [A, B];
    s2BboxTeller.clear();
    huidigeRichting = HDG;
    headingBuffer.length = 0; headingBuffer.push(HDG);  // geldige heading gezien
    huidigePos = { lat: LAT, lon: LON };
    snelheidKmh = kmh;
    dichtstbijOSM = null; vorigOsmId = null;
    laatsteNodeWisselTijd = 0;
    hoekStabielReset();
    return { A, B };
  }
  const kiesId = () => {
    const r = vindDichtbij(LAT, LON, HDG);
    return r ? String(r.id) : null;
  };

  try {
    // ══ T0 — de geometrie klopt ═══════════════════════════════
    // Zonder deze controle zegt de rest niets: als nodeOp de peiling verkeerd
    // plaatst, toetsen T1-T7 een ander geval dan het gemeten.
    opzet(22, 49, 22, 17, 4);
    const pA = peilingTovRijrichting(huidigePos, osmCache[0], HDG);
    const pB = peilingTovRijrichting(huidigePos, osmCache[1], HDG);
    const afA = afstand(LAT, LON, osmCache[0].lat, osmCache[0].lon);
    const afB = afstand(LAT, LON, osmCache[1].lat, osmCache[1].lon);
    eis('T0 opzet reproduceert het gemeten geval (22m/49gr tegen 22m/17gr)',
        Math.abs(pA - 49) <= 1 && Math.abs(pB - 17) <= 1
          && Math.abs(afA - 22) <= 0.5 && Math.abs(afB - 22) <= 0.5,
        'A 22m/49gr, B 22m/17gr',
        'A ' + afA.toFixed(1) + 'm/' + pA + 'gr, B ' + afB.toFixed(1) + 'm/' + pB + 'gr');

    // ══ T1 — rijdend deed de app het al goed ══════════════════
    opzet(22, 49, 22, 17, 30);
    eis('T1 kmh 30 (rijdende tak): kiest de rechte node — ongewijzigd gedrag',
        kiesId() === String(B_ID), 'B (17gr)', kiesId() === String(B_ID) ? 'B' : 'A');

    // ══ T2 — HET GEMETEN GEVAL ════════════════════════════════
    opzet(22, 49, 22, 17, 4);
    eis('T2 kmh 4 (stilstandtak): kiest nu de rechte node',
        kiesId() === String(B_ID), 'B (17gr)', kiesId() === String(B_ID) ? 'B' : 'A');

    opzet(22, 49, 22, 17, 0);
    eis('T2b kmh 0: idem',
        kiesId() === String(B_ID), 'B (17gr)', kiesId() === String(B_ID) ? 'B' : 'A');

    // ══ T3 — zonder de tiebreak zou A winnen ══════════════════
    // Bewijst dat T2 niet toevallig slaagt: met dezelfde opzet maar zonder een
    // geldige heading valt de tiebreak weg (headingBuffer leeg, r8484) en komt
    // de kale stilstandscore weer bovendrijven.
    opzet(22, 49, 22, 17, 4);
    headingBuffer.length = 0;
    eis('T3 zonder ooit geziene heading: tiebreak zwijgt, A wint op volgorde',
        kiesId() === String(A_ID), 'A (geen richtingsinformatie)',
        kiesId() === String(A_ID) ? 'A' : 'B');

    // ══ T4 — conf mag de tiebreak niet overstemmen ════════════
    // A met volle conf (5 bboxen) scoort 0,828689 tegen 0,778689 voor B — de
    // grootst mogelijke voorsprong die de stilstandtak kent.
    opzet(22, 49, 22, 17, 4);
    s2BboxTeller.set(String(A_ID), 5);
    eis('T4 A met volle conf: tiebreak wint alsnog',
        kiesId() === String(B_ID), 'B (17gr)', kiesId() === String(B_ID) ? 'B' : 'A');

    // ══ T5 — echt afstandsverschil blijft leidend ═════════════
    opzet(22, 49, 30, 17, 4);   // 8m verschil > NODE_HOEK_GELIJK_M (5)
    eis('T5 B staat 8m verder (> GELIJK_M): afstand wint, geen swap',
        kiesId() === String(A_ID), 'A (dichterbij)', kiesId() === String(A_ID) ? 'A' : 'B');

    opzet(22, 49, 26, 17, 4);   // 4m verschil <= 5, binnen de band
    eis('T5b B staat 4m verder (binnen GELIJK_M): tiebreak vuurt wel',
        kiesId() === String(B_ID), 'B (17gr)', kiesId() === String(B_ID) ? 'B' : 'A');

    // ══ T6 — te dichtbij: peiling is ruis ═════════════════════
    opzet(8, 49, 8, 17, 4);     // beide onder NODE_HOEK_MIN_AFSTAND_M (12)
    eis('T6 beide op 8m (< MIN_AFSTAND_M): geen hoektoets, A wint op volgorde',
        kiesId() === String(A_ID), 'A (peiling telt niet mee)',
        kiesId() === String(A_ID) ? 'A' : 'B');

    opzet(14, 49, 14, 17, 4);   // net boven de ondergrens
    eis('T6b beide op 14m (> MIN_AFSTAND_M): tiebreak vuurt wel',
        kiesId() === String(B_ID), 'B (17gr)', kiesId() === String(B_ID) ? 'B' : 'A');

    // ══ T7 — hoekwinst onder de drempel telt niet ═════════════
    opzet(22, 30, 22, 17, 4);   // 13 graden winst < NODE_HOEK_VOORDEEL_GRAD (25)
    eis('T7 slechts 13 graden winst (< VOORDEEL_GRAD): geen swap',
        kiesId() === String(A_ID), 'A (verschil is ruis)',
        kiesId() === String(A_ID) ? 'A' : 'B');

    opzet(22, 45, 22, 17, 4);   // 28 graden winst >= 25
    eis('T7b 28 graden winst (>= VOORDEEL_GRAD): wel een swap',
        kiesId() === String(B_ID), 'B (17gr)', kiesId() === String(B_ID) ? 'B' : 'A');

    // Grensgevallen, exact op VOORDEEL_GRAD.
    opzet(22, 17 + NODE_HOEK_VOORDEEL_GRAD, 22, 17, 4);
    eis('T7c exact op VOORDEEL_GRAD telt nog mee',
        kiesId() === String(B_ID), 'B', kiesId() === String(B_ID) ? 'B' : 'A');
    opzet(22, 17 + NODE_HOEK_VOORDEEL_GRAD - 2, 22, 17, 4);
    eis('T7d twee graden eronder telt niet meer',
        kiesId() === String(A_ID), 'A', kiesId() === String(A_ID) ? 'A' : 'B');

    // ══ T8 — de tiebreak verdringt geen zittende node ═════════
    // Bewust vastgelegd: de tiebreak staat VÓÓR de hysterese (r8551), dus een al
    // gekozen node blijft staan. Dat is de reden dat de hoekroute in
    // checkNodeCorrectieStilstand bestaat.
    const g = opzet(22, 49, 22, 17, 4);
    dichtstbijOSM = { ...g.A, afstand: 22 };
    eis('T8 met A al zittend houdt de hysterese hem vast (hoekroute is daarvoor)',
        kiesId() === String(A_ID), 'A blijft (hysterese 1,20)',
        kiesId() === String(A_ID) ? 'A' : 'B');

    // ══ T9 — boven de snelheidsgrens verandert er niets ═══════
    opzet(22, 49, 22, 17, 20);
    eis('T9 kmh 20: rijdende tak, tiebreak niet actief, gedrag ongewijzigd',
        kiesId() === String(B_ID), 'B (via normHoek 0,35)',
        kiesId() === String(B_ID) ? 'B' : 'A');

    // ══ T10 — de gedeelde predikaatfunctie ════════════════════
    // Eén definitie voor beide gebruikers; als iemand er een tweede naast zet,
    // lopen tiebreak en correctieroute uiteen.
    const gg = opzet(22, 49, 22, 17, 4);
    const pos = { lat: LAT, lon: LON };
    eis('T10 peilingDuidelijkBeter: B beter dan A',
        peilingDuidelijkBeter(pos, gg.A, 22, gg.B, 22) === true, 'true',
        String(peilingDuidelijkBeter(pos, gg.A, 22, gg.B, 22)));
    eis('T10b en niet andersom',
        peilingDuidelijkBeter(pos, gg.B, 22, gg.A, 22) === false, 'false',
        String(peilingDuidelijkBeter(pos, gg.B, 22, gg.A, 22)));

    // ══ T11-T14 — de hoekroute in checkNodeCorrectieStilstand ═
    // Opzet: A zit vast als gekozen node, B is de pure closest. Alle
    // veiligheidspoorten open zetten behalve die we willen toetsen.
    function opzetCorrectie(kmh, stilSinds) {
      const gz = opzet(22, 49, 22, 17, kmh);
      dichtstbijOSM = { ...gz.A, afstand: 22 };
      puurDichtsteNodeCache = { ...gz.B, afstand: 22 };
      handmatigLockActief = false; stilstandAutoLock = false;
      laatsteNodeCorrectieTijd = 0;
      stilstandSinds = stilSinds;
      hoekStabielReset();
      return gz;
    }
    // N-1 aanroepen mogen nog niets doen; de N-de wel.
    opzetCorrectie(4, 0);
    for (let i = 0; i < NODE_HOEK_STABIEL_N - 1; i++) checkNodeCorrectieStilstand(LAT, LON);
    const naBijna = String(dichtstbijOSM.id);
    // Vastleggen wat de toestand WERKELIJK was op het moment van corrigeren —
    // T12 hieronder leunt erop en mag dat niet uit een constante halen.
    const kmhBijCorrectie = snelheidKmh;
    const stilBijCorrectie = stilstandSinds;
    checkNodeCorrectieStilstand(LAT, LON);
    const naVol = String(dichtstbijOSM.id);
    eis('T11 hoekroute corrigeert pas na STABIEL_N opeenvolgende oordelen',
        naBijna === String(A_ID) && naVol === String(B_ID),
        'na ' + (NODE_HOEK_STABIEL_N - 1) + 'x nog A, na ' + NODE_HOEK_STABIEL_N + 'x B',
        'na ' + (NODE_HOEK_STABIEL_N - 1) + 'x ' + (naBijna === String(A_ID) ? 'A' : 'B')
          + ', na ' + NODE_HOEK_STABIEL_N + 'x ' + (naVol === String(B_ID) ? 'B' : 'A'));

    // T12 — de dode zone 3 <= kmh < 5. Bij kmh 4 staat stilstandSinds op 0
    // (r12092 nult hem boven 3 km/u), en de oude poort 2 keerde daarop terug
    // vóórdat poort 7 ooit bereikt werd. Deze toets eist dat de correctie
    // plaatsvond terwijl beide voorwaarden van de oude poort 2 ONWAAR waren.
    eis('T12 correctie bij kmh 4 met stilstandSinds 0 — de dode zone is dicht',
        naVol === String(B_ID)
          && kmhBijCorrectie >= NODE_CHK_STANDSTILL_KMH
          && kmhBijCorrectie < NODE_HOEK_KMH
          && stilBijCorrectie === 0,
        'gecorrigeerd bij 3 <= kmh < 5 zonder stilstandSinds',
        (naVol === String(B_ID) ? 'gecorrigeerd' : 'GEBLOKKEERD')
          + ' bij kmh=' + kmhBijCorrectie + ', stilstandSinds=' + stilBijCorrectie);

    // T13 — een wisselende kandidaat mag nooit doortellen.
    const gz = opzetCorrectie(4, 0);
    checkNodeCorrectieStilstand(LAT, LON);
    puurDichtsteNodeCache = { ...nodeOp(22, 10, 999001), afstand: 22 };  // andere kandidaat
    checkNodeCorrectieStilstand(LAT, LON);
    puurDichtsteNodeCache = { ...gz.B, afstand: 22 };                    // terug naar B
    checkNodeCorrectieStilstand(LAT, LON);
    eis('T13 wisselende kandidaat reset de teller — geen correctie na 3 beurten',
        String(dichtstbijOSM.id) === String(A_ID), 'A (teller is gereset)',
        String(dichtstbijOSM.id) === String(A_ID) ? 'A' : 'B');

    // T14 — VEILIGHEID: een echte tap wordt nooit overschreven.
    opzetCorrectie(4, 0);
    handmatigLockActief = true; stilstandAutoLock = false;   // echte tap
    for (let i = 0; i < NODE_HOEK_STABIEL_N + 2; i++) checkNodeCorrectieStilstand(LAT, LON);
    eis('T14 echte handmatige tap wordt NOOIT door de hoekroute overschreven',
        String(dichtstbijOSM.id) === String(A_ID), 'A (tap is heilig)',
        String(dichtstbijOSM.id) === String(A_ID) ? 'A' : 'B');

    // T15 — bounce-guard: geen tweede correctie binnen het interval.
    opzetCorrectie(4, 0);
    laatsteNodeCorrectieTijd = Date.now();
    for (let i = 0; i < NODE_HOEK_STABIEL_N + 2; i++) checkNodeCorrectieStilstand(LAT, LON);
    eis('T15 bounce-guard houdt de hoekroute tegen',
        String(dichtstbijOSM.id) === String(A_ID), 'A (te kort na vorige correctie)',
        String(dichtstbijOSM.id) === String(A_ID) ? 'A' : 'B');

    // T16 — boven NODE_HOEK_KMH doet de route niets.
    opzetCorrectie(8, 0);
    for (let i = 0; i < NODE_HOEK_STABIEL_N + 2; i++) checkNodeCorrectieStilstand(LAT, LON);
    eis('T16 kmh 8 (> HOEK_KMH): hoekroute slaapt',
        String(dichtstbijOSM.id) === String(A_ID), 'A',
        String(dichtstbijOSM.id) === String(A_ID) ? 'A' : 'B');

    // ══ T17-T18 — bronwachten ═════════════════════════════════
    const zonderCommentaar = (bron) => bron
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    eis('T17 de tiebreak staat vóór de hysterese in vindDichtbij',
        (() => { const b = zonderCommentaar(String(vindDichtbij));
                 const t = b.indexOf('peilingDuidelijkBeter');
                 const h = b.indexOf('1.20');
                 return t > -1 && h > -1 && t < h; })(),
        'tiebreak vóór 1.20-hysterese',
        (() => { const b = zonderCommentaar(String(vindDichtbij));
                 return b.indexOf('peilingDuidelijkBeter') < b.indexOf('1.20')
                   ? 'ervoor' : 'ERNA'; })());

    eis('T18 de vier drempels staan waar de toelichting ze zet',
        NODE_HOEK_GELIJK_M === 5 && NODE_HOEK_VOORDEEL_GRAD === 25
          && NODE_HOEK_MIN_AFSTAND_M === 12 && NODE_HOEK_KMH === 5
          && NODE_HOEK_STABIEL_N === 3,
        '5 / 25 / 12 / 5 / 3',
        [NODE_HOEK_GELIJK_M, NODE_HOEK_VOORDEEL_GRAD, NODE_HOEK_MIN_AFSTAND_M,
         NODE_HOEK_KMH, NODE_HOEK_STABIEL_N].join(' / '));

    // T19 — de afstandsroute is niet stukgegaan bij het herschikken van de poorten.
    (function () {
      const gz2 = opzet(60, 10, 20, 10, 1);        // A ver weg, B 40m dichterbij
      dichtstbijOSM = { ...gz2.A, afstand: 60 };
      puurDichtsteNodeCache = { ...gz2.B, afstand: 20 };
      handmatigLockActief = false; stilstandAutoLock = false;
      laatsteNodeCorrectieTijd = 0;
      stilstandSinds = Date.now() - (NODE_CHK_STANDSTILL_DUUR_MS + 1000);
      hoekStabielReset();
      checkNodeCorrectieStilstand(LAT, LON);
      eis('T19 de bestaande afstandsroute werkt nog (40m verschil, kmh 1, 4s stil)',
          String(dichtstbijOSM.id) === String(B_ID), 'B (afstandsroute)',
          String(dichtstbijOSM.id) === String(B_ID) ? 'B' : 'A');
    })();

    // T20 — en hij blijft geblokkeerd waar hij dat hoorde te zijn.
    (function () {
      const gz3 = opzet(22, 10, 22, 10, 1);        // verschil 0m, geen hoekwinst
      dichtstbijOSM = { ...gz3.A, afstand: 22 };
      puurDichtsteNodeCache = { ...gz3.B, afstand: 22 };
      handmatigLockActief = false; stilstandAutoLock = false;
      laatsteNodeCorrectieTijd = 0;
      stilstandSinds = Date.now() - (NODE_CHK_STANDSTILL_DUUR_MS + 1000);
      hoekStabielReset();
      for (let i = 0; i < NODE_HOEK_STABIEL_N + 2; i++) checkNodeCorrectieStilstand(LAT, LON);
      eis('T20 geen afstandsverschil én geen hoekwinst: geen correctie',
          String(dichtstbijOSM.id) === String(A_ID), 'A (niets om op te kiezen)',
          String(dichtstbijOSM.id) === String(A_ID) ? 'A' : 'B');
    })();

  } finally {
    osmCache = bewaard.osmCache;
    dichtstbijOSM = bewaard.dichtstbijOSM;
    vorigOsmId = bewaard.vorigOsmId;
    snelheidKmh = bewaard.snelheidKmh;
    huidigeRichting = bewaard.huidigeRichting;
    huidigePos = bewaard.huidigePos;
    puurDichtsteNodeCache = bewaard.puurDichtsteNodeCache;
    stilstandSinds = bewaard.stilstandSinds;
    handmatigLockActief = bewaard.handmatigLockActief;
    stilstandAutoLock = bewaard.stilstandAutoLock;
    laatsteNodeCorrectieTijd = bewaard.laatsteNodeCorrectieTijd;
    laatsteNodeWisselTijd = bewaard.laatsteNodeWisselTijd;
    hoekStabielSleutel = bewaard.hoekStabielSleutel;
    hoekStabielTeller = bewaard.hoekStabielTeller;
    s2BboxTeller.clear();
    for (const [k, v] of bewaard.s2Kopie) s2BboxTeller.set(k, v);
    headingBuffer.length = 0;
    for (const h of bewaard.headingKopie) headingBuffer.push(h);
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testNodescore = testNodescore;
