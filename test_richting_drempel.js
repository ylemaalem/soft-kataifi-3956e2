// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_richting_drempel.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.2: stap 1 van kiesCountdownBron telt vanaf de EERSTE eigen
//  meting, in plaats van pas vanaf V9_MIN_METINGEN (5).
//
//  WAT ER OP HET SPEL STAAT
//  Voor deze wijziging kreeg een getikte richting met 1 tot 4 eigen metingen
//  het ALGEMEEN-gemiddelde van de node te zien — het aggregaat over alle
//  richtingen samen. Op een kruispunt waar rechtsaf een korte eigen cyclus
//  heeft en rechtdoor een lange, toonde de app dus stelselmatig de verkeerde
//  countdown op precies het moment dat de gebruiker de richting had getikt.
//
//  DE VIER KERNGEVALLEN
//    T1  emmer met 1 meting   -> eigen getal, CD_GESCHAT (was: Algemeen)
//    T2  emmer LEEG           -> nog steeds Algemeen (dit is NIET stap 2)
//    T3  2 identieke metingen -> CD_ZEKER (bekend randje, vastgelegd)
//    T4  het gemelde scenario: 1 meting van 32s naast een Algemeen van 60s
//
//  T3 IS GEEN GOEDKEURING
//  bepaalCdModus remt op n < 2, niet op de kwaliteit van 2 gelijke waarden.
//  Twee identieke metingen geven spreiding 0 en dus CD_ZEKER. Dat is bestaand
//  gedrag op elke bron; deze wijziging maakt het voor het eerst bereikbaar op
//  een richting. T3 legt het vast zodat het niet ongemerkt verschuift — het
//  repareren hoort bij de modusklasse en raakt dan alle bronnen tegelijk.
//
//  T8 HOORT BIJ V11.18.3: het 'nog N×'-tekstje achter het pill-label telde
//  naar dezelfde drempel van 5 en klopte daardoor niet meer. Het verdwijnt nu
//  zodra de richting zelf stuurt, en blijft staan bij nul eigen metingen.
//
//  T5 IS DE REGRESSIEWACHT op stap 2, 3 en 4, die ongemoeid blijven.
//  T6 legt vast wat er WEL verschuift als neveneffect: een richting met eigen
//  data wint voortaan van 'V5 alle' en van de rechtdoor-default. Dat is de
//  bedoeling van deze release, geen regressie — maar het moet wel zichtbaar
//  vastliggen.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_richting_drempel.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRichtingDrempel().regels);
// ═══════════════════════════════════════════════════════════════

function testRichtingDrempel() {
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

  const NODE = 999301;
  const DDNU = huidigDDActief();
  const NU = Date.now();

  const bewaard = {
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij, osmCache, huidigePos,
    // T8 roept bepaalRichtingTekort aan en die schrijft in een global die de
    // pill per frame leest. Zonder herstel blijft een suffix van deze fixture
    // achter op het scherm van de volgende suite.
    richtingTekort, richtingLockKeuze, richtingLockNodeId
  };

  // Alle V5-emmers die deze suite ooit aanraakt — ook de buren, want
  // laadMV5Geclusterd leest N/NO/NW en W/ZW/NW mee (met gewicht 0,5). Die
  // moeten leeg zijn, anders is m1.length niet het aantal dat we neerzetten.
  const RICHTINGEN = ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'];
  const wisAlleV5 = () => {
    for (const a of RICHTINGEN) for (const f of RICHTINGEN) {
      zetLS('sl_v5_' + NODE + '_' + a + '_' + f + '_' + DDNU, null);
    }
  };

  // duur-lijst -> V5-emmer. gewicht 1.0, bron 'tik', zoals slaOpV5 schrijft.
  //
  // ELKE EMMER KRIJGT EEN EIGEN TIJDVAK. haalAlleV5MetingenVoorNode (r2650)
  // ontdubbelt op `tijd`: twee emmers met identieke tijdstempels tellen samen
  // voor één meting. Zouden alle emmers op NU - i*60000 beginnen, dan meet T5c
  // (stap 3, 'alle V5 samen') stilletjes 3 in plaats van 5 en faalt hij om een
  // reden die niets met deze release te maken heeft.
  let emmerNr = 0;
  const zetV5 = (aanrij, afrij, duren) => {
    const basis = NU - (emmerNr++) * 3600000;
    zetLS('sl_v5_' + NODE + '_' + aanrij + '_' + afrij + '_' + DDNU, JSON.stringify(
      duren.map((d, i) => ({ duur: d, tijd: basis - i * 60000, gewicht: 1.0, bron: 'tik' }))));
  };
  const zetV4 = (duren) => {
    zetLS('sl_v4_' + NODE + '_' + DDNU, JSON.stringify(
      duren.map((d, i) => ({ duur: d, tijd: NU - i * 60000, gewicht: 1.0 }))));
  };

  // Schone uitgangspositie: niet-neutraal, geen enkelricht-vlag, geen heading
  // (zodat stap 2 — de rechtdoor-default — uit zichzelf overslaat en we stap 1
  // geïsoleerd meten). Elke test die stap 2 nodig heeft zet de heading zelf.
  const opzet = () => {
    emmerNr = 0;                   // tijdvakken beginnen per test weer bij nu
    wisAlleV5();
    zetLS('sl_neutraal_' + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);
    zetLS('sl_bevestig_' + NODE, null);
    zetLS('sl_v4_' + NODE + '_' + DDNU, null);
    v9AanrijSnelheidHeading = null;
    v9AanrijHeading = null;
    v9PreSelectieAfrij = null;
    huidigePos = null;
    osmCache = [];
  };

  try {
    // ─── T1 — één eigen meting stuurt nu zelf ──────────────────
    opzet();
    zetV5('N', 'W', [32]);           // rechtsaf vanuit het noorden, één keer gemeten
    zetV4([60, 60, 60, 60, 60]);     // Algemeen zit er ruim naast
    let r = kiesCountdownBron(NODE, DDNU, 'N', 'W');
    eis('T1 richting met 1 eigen meting stuurt zelf',
        r !== null && r.bron === 'V5 W' && r.metingen === 1 && r.v5 === true,
        "bron 'V5 W', 1 meting",
        r ? (r.bron + ', ' + r.metingen + ' metingen') : 'null');
    eis('T1b het getal is de eigen meting, niet Algemeen',
        r !== null && Math.round(r.gem) === 32,
        '32s', r ? String(Math.round(r.gem)) : 'null');
    eis('T1c één meting geeft CD_GESCHAT, niet CD_ZEKER',
        r !== null && r.modus === CD_GESCHAT,
        CD_GESCHAT, r ? r.modus : 'null');
    eis('T1d bij CD_GESCHAT bestaat er geen band',
        r !== null && r.cdMin === null && r.cdMax === null,
        'cdMin en cdMax null',
        r ? ('cdMin=' + r.cdMin + ', cdMax=' + r.cdMax) : 'null');

    // De rem komt van bepaalCdModus zelf, niet van iets nieuws in stap 1: een
    // gloednieuw kruispunt met 1 V4-meting krijgt exact dezelfde klasse.
    const eenMeting = [{ duur: 32, tijd: NU, gewicht: 1.0 }];
    eis('T1e zelfde rem als een nieuw kruispunt met 1 meting',
        bepaalCdModus(32, eenMeting).modus === CD_GESCHAT,
        CD_GESCHAT, bepaalCdModus(32, eenMeting).modus);

    // ─── T2 — een LEGE emmer leent nog steeds Algemeen ─────────
    // Dit is expliciet NIET stap 2 van het plan. Zonder één eigen meting is er
    // niets om op terug te vallen en weegt RV1 zwaarder.
    opzet();
    zetV4([60, 60, 60, 60, 60]);     // alleen Algemeen, geen enkele V5
    r = kiesCountdownBron(NODE, DDNU, 'N', 'W');
    eis('T2 lege richting-emmer valt terug op Algemeen',
        r !== null && r.v5 === false && Math.round(r.gem) === 60,
        'V4-bron, 60s',
        r ? (r.bron + ', ' + Math.round(r.gem) + 's') : 'null');
    eis('T2b de bron is geen V5-label (dus ook geen richtingspijl)',
        r !== null && !String(r.bron).startsWith('V5'),
        'label begint niet met V5', r ? r.bron : 'null');

    // Één meting toevoegen is het enige verschil tussen T2 en T1: dat is precies
    // waar de nieuwe grens ligt.
    zetV5('N', 'W', [32]);
    r = kiesCountdownBron(NODE, DDNU, 'N', 'W');
    eis('T2c één meting erbij kantelt hem naar de eigen richting',
        r !== null && r.bron === 'V5 W' && Math.round(r.gem) === 32,
        'V5 W, 32s', r ? (r.bron + ', ' + Math.round(r.gem) + 's') : 'null');

    // ─── T3 — het bekende randje: 2 identieke metingen ─────────
    // VASTLEGGEN, NIET REPAREREN. gewSpreidingN is 2, de spreiding 0, dus
    // relSpr 0 en de klasse CD_ZEKER. Dat is bestaand gedrag van bepaalCdModus
    // (de rem zit op n < 2) en wordt hier voor het eerst bereikbaar op een
    // richting. Zodra iemand de modusklasse aanpakt valt deze test om — dat is
    // de bedoeling: dan is het een bewuste wijziging, geen sluipende.
    opzet();
    zetV5('N', 'W', [32, 32]);
    r = kiesCountdownBron(NODE, DDNU, 'N', 'W');
    eis('T3 twee identieke metingen geven CD_ZEKER (bekend randje)',
        r !== null && r.metingen === 2 && r.modus === CD_ZEKER,
        '2 metingen, ' + CD_ZEKER,
        r ? (r.metingen + ' metingen, ' + r.modus) : 'null');
    const tweeGelijk = [{ duur: 32, tijd: NU, gewicht: 1.0 },
                        { duur: 32, tijd: NU - 60000, gewicht: 1.0 }];
    eis('T3b het randje komt uit bepaalCdModus, niet uit stap 1',
        bepaalCdModus(32, tweeGelijk).modus === CD_ZEKER,
        CD_ZEKER, bepaalCdModus(32, tweeGelijk).modus);
    // Twee UITEENLOPENDE metingen gedragen zich wel netjes: de klasse volgt de
    // relatieve spreiding en blijft dus weg bij CD_ZEKER.
    opzet();
    zetV5('N', 'W', [32, 48]);
    r = kiesCountdownBron(NODE, DDNU, 'N', 'W');
    eis('T3c twee uiteenlopende metingen geven geen CD_ZEKER',
        r !== null && r.modus !== CD_ZEKER,
        'niet ' + CD_ZEKER, r ? r.modus : 'null');

    // ─── T4 — het gemelde scenario, end to end ─────────────────
    // "rechtsaf krijgt dus eigenlijk verkeerde countdown, want die is op
    // algemeen gebaseerd." Rechtsaf is één keer gemeten op 32s; Algemeen staat
    // op 60s omdat rechtdoor de lange cyclus heeft. Voor deze release toonde de
    // pill 60s, nu 32s met voorbehoud.
    opzet();
    zetV5('N', 'W', [32]);                       // rechtsaf, één meting
    zetV4([60, 58, 62, 60, 61]);                 // Algemeen, gedomineerd door rechtdoor
    const naRelease = kiesCountdownBron(NODE, DDNU, 'N', 'W');
    // en wat de app vóór deze release deed, met dezelfde data: stap 1 viel weg
    // bij n < 5, dus kwam stap 4 aan bod — reken die na op dezelfde emmer.
    const voorRelease = gewGem(laadM(NODE, DDNU));
    eis('T4 het gemelde geval toont nu 32s in plaats van ~60s',
        naRelease !== null && Math.round(naRelease.gem) === 32
          && Math.round(voorRelease) >= 58,
        'na: 32s, daarvoor: ~60s',
        (naRelease ? Math.round(naRelease.gem) : 'null') + 's, daarvoor '
          + Math.round(voorRelease) + 's');
    eis('T4b en het draagt het eerlijke voorbehoud',
        naRelease !== null && naRelease.modus === CD_GESCHAT && naRelease.metingen === 1,
        CD_GESCHAT + ' op 1 meting',
        naRelease ? (naRelease.modus + ' op ' + naRelease.metingen) : 'null');
    eis('T4c het verschil met Algemeen is geen afrondingsruis',
        naRelease !== null && Math.abs(naRelease.gem - voorRelease) > 20,
        'meer dan 20s verschil',
        naRelease ? (Math.abs(naRelease.gem - voorRelease).toFixed(1) + 's') : 'null');

    // ─── T5 — regressiewacht op stap 2, 3 en 4 ─────────────────
    // STAP 2 (rechtdoor-default) wordt alleen bereikt zonder getikte richting.
    // Heading 0 = noord, rechtdoor -> afrij Z.
    opzet();
    zetV5('N', 'Z', [40, 41, 39, 40, 42]);
    v9AanrijSnelheidHeading = 0;
    v9AanrijHeading = 0;
    r = kiesCountdownBron(NODE, DDNU, 'N', null);   // geen tik
    eis('T5 stap 2 (rechtdoor-default) ongewijzigd',
        r !== null && r.bron === 'V5 ↑' && r.metingen === 5,
        "'V5 ↑', 5 metingen",
        r ? (r.bron + ', ' + r.metingen) : 'null');
    // en de drempel van 5 staat daar nog steeds: 4 metingen is niet genoeg.
    opzet();
    zetV5('N', 'Z', [40, 41, 39, 40]);
    zetV4([70, 70, 70, 70, 70]);
    v9AanrijSnelheidHeading = 0;
    v9AanrijHeading = 0;
    r = kiesCountdownBron(NODE, DDNU, 'N', null);
    eis('T5b stap 2 houdt zijn eigen drempel van 5',
        r !== null && r.bron !== 'V5 ↑',
        "niet 'V5 ↑'", r ? r.bron : 'null');

    // STAP 3 (alle V5 samen) — bereikbaar zonder tik en zonder heading.
    opzet();
    zetV5('N', 'W', [30, 31]);
    zetV5('O', 'N', [50, 51, 52]);
    r = kiesCountdownBron(NODE, DDNU, 'N', null);   // geen tik, geen heading
    eis('T5c stap 3 (alle V5 samen) ongewijzigd',
        r !== null && r.bron === 'V5 alle' && r.metingen === 5,
        "'V5 alle', 5 metingen",
        r ? (r.bron + ', ' + r.metingen) : 'null');

    // STAP 4 (V4-terugval) — bereikbaar zonder enige V5.
    opzet();
    zetV4([45, 46, 44, 45, 47]);
    r = kiesCountdownBron(NODE, DDNU, 'N', null);
    eis('T5d stap 4 (V4-terugval) ongewijzigd',
        r !== null && r.v5 === false && Math.round(r.gem) === 45,
        'V4-bron, 45s',
        r ? (r.bron + ', ' + Math.round(r.gem) + 's') : 'null');

    // Een NEUTRALE node slaat stap 1-3 nog steeds over, ook nu stap 1 al bij
    // één meting zou vuren. Dat is de c2-regel van V11.16.1.
    opzet();
    zetV5('N', 'W', [32]);
    zetV4([60, 60, 60, 60, 60]);
    zetLS('sl_neutraal_' + NODE, '1');
    r = kiesCountdownBron(NODE, DDNU, 'N', 'W');
    eis('T5e een neutrale node slaat stap 1 nog steeds over',
        r !== null && r.v5 === false && Math.round(r.gem) === 60,
        'V4-bron, 60s',
        r ? (r.bron + ', ' + Math.round(r.gem) + 's') : 'null');

    // Zonder aanrijrichting is stap 1 onbereikbaar — ongewijzigd.
    opzet();
    zetV5('N', 'W', [32]);
    zetV4([60, 60, 60, 60, 60]);
    r = kiesCountdownBron(NODE, DDNU, null, 'W');
    eis('T5f zonder aanrijrichting geen stap 1',
        r !== null && r.v5 === false,
        'V4-bron', r ? r.bron : 'null');

    // ─── T6 — wat er bewust WEL verschuift ─────────────────────
    // Een getikte richting met eigen data wint voortaan van stap 2 en stap 3.
    // Dat is geen neveneffect om te repareren: het is het hele punt — twee
    // eigen metingen van rechtsaf zeggen meer over rechtsaf dan vijf metingen
    // van rechtdoor. Vastgelegd zodat de voorrangsorde niet ongemerkt schuift.
    opzet();
    zetV5('N', 'W', [30, 31]);                  // rechtsaf: 2 eigen metingen
    zetV5('N', 'Z', [60, 61, 59, 60, 62]);      // rechtdoor: 5, haalt stap 2
    v9AanrijSnelheidHeading = 0;
    v9AanrijHeading = 0;
    r = kiesCountdownBron(NODE, DDNU, 'N', 'W');  // rechtsaf getikt
    eis('T6 eigen richtingdata wint van de rechtdoor-default',
        r !== null && r.bron === 'V5 W' && Math.round(r.gem) <= 31,
        "'V5 W', ~30s", r ? (r.bron + ', ' + Math.round(r.gem) + 's') : 'null');
    // en zonder tik pakt dezelfde data gewoon weer de rechtdoor-default.
    r = kiesCountdownBron(NODE, DDNU, 'N', null);
    eis('T6b zonder tik blijft de rechtdoor-default gelden',
        r !== null && r.bron === 'V5 ↑',
        "'V5 ↑'", r ? r.bron : 'null');

    // Idem tegenover stap 3.
    opzet();
    zetV5('N', 'W', [30]);                      // rechtsaf: 1 meting
    zetV5('O', 'N', [70, 71, 72, 73, 74]);      // genoeg voor 'V5 alle'
    r = kiesCountdownBron(NODE, DDNU, 'N', 'W');
    eis('T6c eigen richtingdata wint van het V5-aggregaat',
        r !== null && r.bron === 'V5 W' && Math.round(r.gem) === 30,
        "'V5 W', 30s", r ? (r.bron + ', ' + Math.round(r.gem) + 's') : 'null');

    // ─── T7 — de drempel zelf staat er niet meer ───────────────
    // Bronbewaking, maar op intentie: stap 1 mag geen aantalsdrempel meer
    // hebben, terwijl stap 2 en 3 die wel houden.
    const zc = f => String(f).replace(/\/\/.*/g, '').replace(/\s+/g, ' ');
    const bronKcb = zc(kiesCountdownBron);
    const drempels = (bronKcb.match(/length >= V9_MIN_METINGEN/g) || []).length;
    eis('T7 nog precies twee aantalsdrempels in kiesCountdownBron (stap 2 en 3)',
        drempels === 2, '2', String(drempels));
    eis('T7b stap 1 toetst op "meer dan nul"',
        bronKcb.includes('m1.length > 0'),
        'm1.length > 0 aanwezig',
        bronKcb.includes('m1.length > 0') ? 'aanwezig' : 'ONTBREEKT');

    // ─── T8 — de melding "nog N×" is meegedraaid (V11.18.3) ────
    // Deze test legde bij V11.18.2 nog het gat vast: bepaalRichtingTekort hield
    // de drempel van 5 aan, waardoor er bij 1-4 metingen '~26s · geschat ·
    // nog 4×' op het scherm kon staan terwijl die 26s al uit de eigen emmer
    // kwam. V11.18.3 heeft die poort meegenomen, dus de test draait mee: de
    // suffix verdwijnt zodra de richting zelf stuurt.
    eis('T8 bepaalRichtingTekort gebruikt dezelfde grens als stap 1',
        zc(bepaalRichtingTekort).includes('if (n > 0) return;')
          && !zc(bepaalRichtingTekort).includes('n >= V9_MIN_METINGEN'),
        'n > 0, geen drempel van 5 meer',
        zc(bepaalRichtingTekort).includes('n >= V9_MIN_METINGEN')
          ? 'oude drempel staat er nog' : 'n > 0');

    // GEDRAG, NIET ALLEEN DE BRON. Dezelfde emmer als T1: één eigen meting.
    // De countdown komt dan van de richting zelf, dus er mag geen 'nog N×'
    // meer achter het label komen.
    opzet();
    zetV5('N', 'W', [32]);
    zetV4([60, 60, 60, 60, 60]);
    v9AanrijSnelheidHeading = 0;
    v9AanrijHeading = 0;
    v9PreSelectieAfrij = 'W';
    const bewaardLock = richtingLockKeuze, bewaardLockNode = richtingLockNodeId;
    richtingLockKeuze = 'rechts'; richtingLockNodeId = String(NODE);
    bepaalRichtingTekort(NODE);
    const tekortBijEen = richtingTekort;
    // en met een LEGE emmer hoort het signaal er nog wel te staan: dan leent de
    // countdown uit Algemeen en heeft de tik echt nog geen effect op het getal.
    wisAlleV5();
    bepaalRichtingTekort(NODE);
    const tekortBijNul = richtingTekort;
    richtingTekort = null;
    richtingLockKeuze = bewaardLock; richtingLockNodeId = bewaardLockNode;

    eis('T8a bij 1 eigen meting verschijnt er geen "nog N×" meer',
        tekortBijEen === null, 'null',
        tekortBijEen ? ('nog ' + tekortBijEen.nog + '\u00d7') : 'null');
    eis('T8b bij 0 eigen metingen blijft het signaal staan (ongewijzigd)',
        tekortBijNul !== null && tekortBijNul.node === String(NODE)
          && tekortBijNul.nog === V9_MIN_METINGEN,
        'een melding, nog ' + V9_MIN_METINGEN + '\u00d7',
        tekortBijNul ? ('nog ' + tekortBijNul.nog + '\u00d7') : 'geen melding');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos;
    richtingTekort = bewaard.richtingTekort;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockNodeId = bewaard.richtingLockNodeId;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRichtingDrempel = testRichtingDrempel;
