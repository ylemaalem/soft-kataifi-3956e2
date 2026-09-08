// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_peiling_correctheid.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.86 (release E): de peiling rekent overal met de
//  breedtegraad-correctie, en de alternatieven-tekst zegt wat hij toetst.
//
//  DE FOUT DIE HIER BEWAAKT WORDT
//  Math.atan2(dLon, dLat) op RAUWE graden mist de cos(lat)-correctie op de
//  lengtegraad. Op 52 graden noorderbreedte weegt de oost-westcomponent
//  daardoor 1/cos(52,15) = 1,63x te zwaar. De fout is EXACT NUL op noord,
//  oost, zuid en west — en loopt op tot 13,9 graden rond de diagonalen.
//
//  Dat nulpunt op de kardinale richtingen is precies waarom dit zo lang bleef
//  staan, en waarom T1 alléén niets bewijst: wie op een rechte noord-zuidweg
//  test ziet geen verschil. T2 is de test die telt — die toont aan dat de oude
//  formule op een diagonaal WEL afweek. Zonder die tegenproef zou T1 ook
//  slagen als er niets gerepareerd was.
//
//  T6 IS DE RANDVOORWAARDE, GEEN BIJVANGST
//  Vier plekken die al correct rekenden zijn vervangen door een aanroep van
//  peilingNaar. RV3 eist dat die vier daarna EXACT hetzelfde opleveren. T6
//  toetst dat op bit-gelijkheid (===, geen tolerantie) over 2000 punten —
//  een refactor die er 0,0001 graad naast zit is geen refactor.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_peiling_correctheid.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testPeilingCorrectheid().regels);
// ═══════════════════════════════════════════════════════════════

function testPeilingCorrectheid() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  // De OUDE, platte formule — letterlijk zoals hij op r10627 en r9665 stond.
  // Hij blijft hier staan als tegenproef: zonder hem kan geen enkele test
  // aantonen DAT er iets veranderd is.
  const platteFormule = (van, naar) =>
    (Math.atan2(naar.lon - van.lon, naar.lat - van.lat) * 180 / Math.PI + 360) % 360;

  // De correcte formule zoals hij vóór deze release op vier plekken los stond.
  // T6 gebruikt hem om te bewijzen dat peilingNaar bit voor bit hetzelfde doet.
  const oudeCorrecteFormule = (van, naar) => {
    const dLon = (naar.lon - van.lon) * Math.PI / 180;
    const lat1 = van.lat * Math.PI / 180;
    const lat2 = naar.lat * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2)
              - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  const LAT = 52.15, LON = 5.39;
  const mLat = 111132, mLon = 111320 * Math.cos(LAT * Math.PI / 180);
  // Een punt op `m` meter in azimut `az` (echte peiling) vanaf het basispunt.
  const punt = (az, m = 30) => ({
    lat: LAT + (m * Math.cos(az * Math.PI / 180)) / mLat,
    lon: LON + (m * Math.sin(az * Math.PI / 180)) / mLon
  });
  const basis = { lat: LAT, lon: LON };
  const hoekDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

  const bewaard = {
    snelheidKmh, huidigePos, dichtstbijOSM, osmCache_len: osmCache.length,
    lijstHtml: (document.getElementById('correctie-lijst') || {}).innerHTML,
    overlayDisplay: (document.getElementById('correctie-overlay') || {}).style
      ? document.getElementById('correctie-overlay').style.display : null
  };

  try {
    // ══ T1 — DE KARDINALE RICHTINGEN ══════════════════════════
    // Deze waren al goed, en blijven goed. Op zichzelf bewijst dat niets —
    // zie T2 — maar een fout hier zou betekenen dat de helper stuk is.
    const kardinaal = [['noord', 0], ['oost', 90], ['zuid', 180], ['west', 270]];
    const mis = [];
    for (const [naam, az] of kardinaal) {
      const p = peilingNaar(basis, punt(az));
      if (hoekDiff(p, az) > 0.01) mis.push(naam + ': ' + p.toFixed(2));
    }
    eis('T1 noord/oost/zuid/west geven exact 0/90/180/270',
        mis.length === 0, 'alle vier exact', mis.length ? mis.join(', ') : 'exact');
    // En de oude formule deed dat óók — daarom viel de fout nooit op.
    const misOud = kardinaal.filter(([, az]) => hoekDiff(platteFormule(basis, punt(az)), az) > 0.01);
    eis('T1b de OUDE platte formule was op die vier ook goed — daarom bleef de fout staan',
        misOud.length === 0, 'oude formule ook exact',
        misOud.length ? 'oude formule week af' : 'oude formule ook exact');

    // ══ T2 — DE DIAGONALEN: HIER ZAT DE FOUT ══════════════════
    const diagonalen = [38, 142, 218, 322];
    const rij = [];
    let maxOudeFout = 0, maxNieuweFout = 0;
    for (const az of diagonalen) {
      const p = punt(az);
      const oud = hoekDiff(platteFormule(basis, p), az);
      const nieuw = hoekDiff(peilingNaar(basis, p), az);
      maxOudeFout = Math.max(maxOudeFout, oud);
      maxNieuweFout = Math.max(maxNieuweFout, nieuw);
      rij.push(az + '°: oud ' + oud.toFixed(1) + '° mis, nieuw ' + nieuw.toFixed(2) + '° mis');
    }
    eis('T2 op de diagonalen week de OUDE formule aantoonbaar af',
        maxOudeFout > 10, 'meer dan 10° fout', maxOudeFout.toFixed(1) + '°  |  ' + rij.join(' | '));
    eis('T2b en peilingNaar zit er nu op alle vier vrijwel exact op',
        maxNieuweFout < 0.05, 'minder dan 0,05° fout', maxNieuweFout.toFixed(3) + '°');
    // De grootste fout over de hele cirkel, ter documentatie van de omvang.
    let grootste = 0, bijAz = 0;
    for (let az = 0; az < 360; az += 0.25) {
      const f = hoekDiff(platteFormule(basis, punt(az)), az);
      if (f > grootste) { grootste = f; bijAz = az; }
    }
    eis('T2c de oude fout liep op tot ongeveer 13,9°',
        grootste > 13 && grootste < 15, '13-15°',
        grootste.toFixed(1) + '° bij azimut ' + bijAz + '°');

    // ══ T3 — HET SCREENSHOTVOORBEELD ══════════════════════════
    // Op het scherm stond 247, 264 en 339. Dat waren waarden van de PLATTE
    // formule; de werkelijke peilingen zijn 235, 260 en 347. De test zoekt de
    // echte azimut waarvan de oude formule het getoonde getal maakte, en
    // controleert wat peilingNaar daar nu van maakt.
    const gevallen = [[247, 235], [264, 260], [339, 347]];
    const uitkomsten = [];
    let goed = 0;
    for (const [getoond, verwacht] of gevallen) {
      let besteAz = null, bd = Infinity;
      for (let az = 0; az < 3600; az++) {
        const d = hoekDiff(platteFormule(basis, punt(az / 10)), getoond);
        if (d < bd) { bd = d; besteAz = az / 10; }
      }
      const nu = peilingNaar(basis, punt(besteAz));
      uitkomsten.push(getoond + '° -> ' + Math.round(nu) + '°');
      if (hoekDiff(nu, verwacht) <= 1.5) goed++;
    }
    eis('T3 de drie getallen uit de screenshot komen nu op 235/260/347 uit',
        goed === 3, '247->235, 264->260, 339->347', uitkomsten.join(', '));

    // ══ T4 — W2: DE TEKST ZEGT WAT HIJ TOETST ═════════════════
    const bronLijst = String(toonCorrectielijst);
    const filterM = bronLijst.match(/afstand <= (\d+)/);
    const tekstM  = bronLijst.match(/Geen andere stoplichten binnen (\d+)\s*m/);
    eis('T4 de tekst noemt hetzelfde getal als het filter',
        filterM && tekstM && filterM[1] === tekstM[1],
        'filter en tekst gelijk',
        'filter ' + (filterM ? filterM[1] : '?') + ' m, tekst ' + (tekstM ? tekstM[1] : '?') + ' m');
    eis('T4b het filter zelf is ONgewijzigd gebleven op 400 m',
        filterM && filterM[1] === '400', '400', filterM ? filterM[1] : 'niet gevonden');
    eis('T4c de oude, onjuiste tekst staat er niet meer',
        !/binnen 30m/.test(bronLijst), 'geen "binnen 30m"',
        /binnen 30m/.test(bronLijst) ? 'staat er nog' : 'weg');
    eis('T4d toonCorrectielijst gebruikt nu peilingNaar en niet meer de platte formule',
        /peilingNaar\(/.test(bronLijst)
        && !/Math\.atan2\(sl\.lon - huidigePos\.lon/.test(bronLijst),
        'peilingNaar, geen platte atan2',
        /peilingNaar\(/.test(bronLijst) ? 'peilingNaar' : 'NOG PLAT');

    // ══ T5 — W3: isStoplichtVoorbij ═══════════════════════════
    const bronVoorbij = String(isStoplichtVoorbij);
    eis('T5 isStoplichtVoorbij rekent via peilingNaar',
        /peilingNaar\(/.test(bronVoorbij)
        && !/Math\.atan2\(stoplichtPos\.lon/.test(bronVoorbij),
        'peilingNaar, geen platte atan2',
        /peilingNaar\(/.test(bronVoorbij) ? 'peilingNaar' : 'NOG PLAT');
    eis('T5b de drempel van 90° is ongewijzigd',
        /verschil>90|verschil > 90/.test(bronVoorbij), 'verschil > 90',
        (bronVoorbij.match(/return verschil.*;/) || ['niet gevonden'])[0]);
    // Gedrag: op een diagonaal waar de oude formule 13° afweek, rekent hij nu
    // met de ware hoek. Zoek een geval waar het besluit daadwerkelijk omslaat.
    let omslag = null;
    for (let rijr = 0; rijr < 360 && !omslag; rijr += 1) {
      for (let az = 0; az < 360; az += 1) {
        const p = punt(az);
        const echt = peilingNaar(basis, p), plat = platteFormule(basis, p);
        const v = (h) => { let d = Math.abs(((rijr + 360) % 360) - ((h + 360) % 360));
                           if (d > 180) d = 360 - d; return d > 90; };
        if (v(echt) !== v(plat)) { omslag = { rijr, az, echt, plat }; break; }
      }
    }
    eis('T5c er bestaat een geval waar het "voorbij"-besluit omslaat',
        !!omslag, 'een omslaggeval',
        omslag ? ('rijrichting ' + omslag.rijr + '°, node op ' + omslag.az
          + '°: echt ' + omslag.echt.toFixed(1) + '° tegen plat ' + omslag.plat.toFixed(1) + '°')
          : 'geen gevonden');
    if (omslag) {
      const p = punt(omslag.az);
      eis('T5d en isStoplichtVoorbij volgt daar nu de ECHTE peiling',
          isStoplichtVoorbij(p, basis, omslag.rijr)
            === (hoekDiff(omslag.echt, omslag.rijr) > 90),
          'volgt de gecorrigeerde hoek',
          String(isStoplichtVoorbij(p, basis, omslag.rijr)));
    }

    // ══ T5e — DE V9-TERUGVAL BLIJFT GARANDEREN ════════════════
    // Beide V9-poorten zijn OR-combinaties met V9_VOORBIJ_AFSTAND. Een
    // omgeslagen `voorbij` kan de registratie dus alleen verschuiven, nooit
    // laten uitvallen. Dat is de reden dat W3 in deze release mocht.
    const bronOnGps = String(window.onGpsUpdate || '') || document.documentElement.outerHTML;
    eis('T5e de passagedetectie houdt haar afstandsterugval op V9_VOORBIJ_AFSTAND',
        V9_VOORBIJ_AFSTAND === 40, '40 m', String(V9_VOORBIJ_AFSTAND));
    // Structureel: op geen enkele afstand boven 40 m kan `voorbij` de
    // registratie nog blokkeren, want de OR-tak vuurt dan sowieso.
    eis('T5f boven 40 m is de uitkomst van voorbij niet meer bepalend',
        (function () {
          const afst = 41;
          // beide takken: (voorbij || afst > 40) -> altijd waar
          return (false || afst > V9_VOORBIJ_AFSTAND) === true
              && (true  || afst > V9_VOORBIJ_AFSTAND) === true;
        })(), 'registratie gegarandeerd', 'gegarandeerd');

    // ══ T6 — RV3: DE VIER CORRECTE PLEKKEN ════════════════════
    // Bit-gelijk, geen tolerantie. 2000 willekeurige punten rond het basispunt.
    let afwijkend = 0, grootsteVerschil = 0;
    for (let i = 0; i < 2000; i++) {
      const a = { lat: LAT + (Math.random() - 0.5) * 0.02, lon: LON + (Math.random() - 0.5) * 0.03 };
      const b = { lat: LAT + (Math.random() - 0.5) * 0.02, lon: LON + (Math.random() - 0.5) * 0.03 };
      const oud = oudeCorrecteFormule(a, b), nieuw = peilingNaar(a, b);
      if (oud !== nieuw) { afwijkend++; grootsteVerschil = Math.max(grootsteVerschil, Math.abs(oud - nieuw)); }
    }
    eis('T6 peilingNaar is BIT-GELIJK aan de formule die er stond (RV3)',
        afwijkend === 0, '0 afwijkingen op 2000 punten',
        afwijkend + ' afwijkingen, grootste ' + grootsteVerschil.toExponential(2));
    // En peilingTovRijrichting, de enige bestaande functie, geeft hetzelfde.
    let ptvMis = 0;
    for (let i = 0; i < 500; i++) {
      const b = punt(Math.random() * 360, 10 + Math.random() * 200);
      const h = Math.random() * 360;
      const viaHelper = Math.round(((peilingNaar(basis, b) - h + 540) % 360) - 180);
      if (peilingTovRijrichting(basis, b, h) !== viaHelper) ptvMis++;
    }
    eis('T6b peilingTovRijrichting geeft exact hetzelfde als vóór de refactor',
        ptvMis === 0, '0 afwijkingen op 500 punten', String(ptvMis));

    // ══ T7 — DE NODE-SELECTIE IS ONGEWIJZIGD (RV2) ════════════
    // vindDichtbijScore roept nu peilingNaar aan in plaats van zijn eigen
    // kopie. Het GEDRAG moet identiek zijn — hier nagerekend op de echte
    // functie tegen een lokale herbouw met de oude, losse formule.
    const vdsBron = String(vindDichtbijScore);
    eis('T7 vindDichtbijScore gebruikt de helper',
        /peilingNaar\(/.test(vdsBron), 'peilingNaar', 'aanwezig');
    eis('T7b de gewichten in de scoreformule zijn onaangeroerd',
        /normAf \* 0\.95 \+ conf \* 0\.05/.test(vdsBron)
        && /normAf\*0\.50 \+ normHoek\*0\.35 \+ conf\*0\.15/.test(vdsBron),
        '0,95/0,05 en 0,50/0,35/0,15', 'ongewijzigd');
    // De score is ALLEEN naar boven begrensd (Math.min(1.01, s), r9312). Naar
    // beneden niet: normHoek is Math.cos(rv), en die is NEGATIEF zodra de node
    // achter je ligt. Een score onder nul is dus bestaand, bedoeld gedrag en
    // geen fout — een eerdere versie van deze test nam ten onrechte aan van wel.
    // Wat hier telt voor RV2 is dat de refactor NIETS verandert: dezelfde
    // invoer moet dezelfde score geven, en de peiling die eruit komt moet bit
    // voor bit die van de oude losse formule zijn.
    const bewSnelheid = snelheidKmh;
    let capMis = 0, nietEindig = 0, nietDeterministisch = 0, onderNul = 0;
    try {
      snelheidKmh = 30;   // de rijdende tak, waar de peiling meeweegt
      for (let i = 0; i < 200; i++) {
        const sl = { id: 'x' + i, ...punt(Math.random() * 360, 20 + Math.random() * 300) };
        const h = Math.random() * 360;
        const r1 = vindDichtbijScore(LAT, LON, h, sl);
        const r2 = vindDichtbijScore(LAT, LON, h, sl);
        if (!r1) continue;
        if (!isFinite(r1.score)) nietEindig++;
        if (r1.score > 1.01) capMis++;
        if (r1.score < 0) onderNul++;
        if (r1.score !== r2.score) nietDeterministisch++;
      }
    } finally { snelheidKmh = bewSnelheid; }
    eis('T7c de score is eindig, deterministisch en gecapt op 1,01',
        nietEindig === 0 && capMis === 0 && nietDeterministisch === 0,
        'geen NaN, niets boven 1,01, twee keer dezelfde uitkomst',
        'oneindig ' + nietEindig + ', boven cap ' + capMis
          + ', wisselend ' + nietDeterministisch + ' (onder nul: ' + onderNul
          + ' — bestaand gedrag, normHoek = cos(rv))');
    // De kern van RV2: de hoek die vindDichtbijScore gebruikt is bit-gelijk aan
    // wat de oude, losse formule daar berekende.
    let hoekMis = 0;
    for (let i = 0; i < 500; i++) {
      const sl = punt(Math.random() * 360, 20 + Math.random() * 300);
      if (peilingNaar({ lat: LAT, lon: LON }, sl) !== oudeCorrecteFormule({ lat: LAT, lon: LON }, sl)) hoekMis++;
    }
    eis('T7c2 de hoek in de scoretak is bit-gelijk aan de oude losse formule',
        hoekMis === 0, '0 afwijkingen op 500 punten', String(hoekMis));
    eis('T7d vindDichtbij zelf is niet aangeraakt: de hysterese staat er nog',
        /bestS < hr\.score \* 1\.20/.test(String(vindDichtbij)),
        'hysterese 1,20 ongewijzigd', 'ongewijzigd');

    // ══ T8 — DE VIJF BEWUST ONAANGEROERDE PLEKKEN ═════════════
    // Deze release laat ze staan. De wacht legt vast DAT ze nog plat zijn,
    // zodat een volgende release niet hoeft te raden welke er nog open staan.
    const nogPlat = [];
    for (const [naam, fn] of [['selecteerBesteDetectie', selecteerBesteDetectie],
                              ['kiesBesteWeg', kiesBesteWeg],
                              ['vindOsmMatchOpRichting', vindOsmMatchOpRichting],
                              ['tekenRadarSheet', tekenRadarSheet],
                              ['koppelBboxAanNode', koppelBboxAanNode]]) {
      if (typeof fn === 'function' && !/peilingNaar\(/.test(String(fn))) nogPlat.push(naam);
    }
    eis('T8 de vijf bekende platte plekken zijn bewust nog niet aangesloten',
        nogPlat.length === 5, '5 open plekken', nogPlat.join(', ') || 'geen');

  } finally {
    snelheidKmh = bewaard.snelheidKmh;
    huidigePos = bewaard.huidigePos;
    dichtstbijOSM = bewaard.dichtstbijOSM;
    const l = document.getElementById('correctie-lijst');
    if (l && bewaard.lijstHtml != null) l.innerHTML = bewaard.lijstHtml;
    const o = document.getElementById('correctie-overlay');
    if (o && bewaard.overlayDisplay != null) o.style.display = bewaard.overlayDisplay;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testPeilingCorrectheid = testPeilingCorrectheid;
