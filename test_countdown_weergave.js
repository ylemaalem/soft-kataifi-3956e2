// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_countdown_weergave.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.82: één aftellend getal bij een onzekere countdown, een
//  gedimde KLOPTE die klikbaar blijft als de camera al groen ziet, en
//  aiKleur/aiTeller in het bevestigrecord.
//
//  HET DODE GAT
//  De CD_VAAG-weergave toonde twee getallen die GELIJKTIJDIG aftelden vanaf
//  dezelfde `ver`, dus met een constant verschil. Het linkergetal klemde op 0
//  (Math.max(0, ...)) en bleef daar staan. Maar de knoppen draaien op gem
//  (activeCdDoel, r7275), niet op cdMin — dus zolang links 0 toonde gebeurde
//  er nog niets. Gemeten over 200 CD_VAAG-emmers: dat gat is mediaan 12s,
//  p90 33s, en bij 51% groter dan 10 seconden.
//
//  T1-T5 leggen vast dat er nog één getal aftelt en dat dat hetzelfde getal is
//  waarop het nulpunt draait. T3 is de kern: de marge mag NIET meetellen in het
//  aftellen, anders is het dode gat alleen van vorm veranderd.
//
//  T6-T8 zijn de klikpoort. T8 is de veiligheidstest: bij een onbekende
//  aiKleur (detectieverlies, r6755 zet hem op null) moet het OUDE, blokkerende
//  gedrag gelden. Onbekend is nooit een reden om door te laten.
//
//  T10-T11 zijn de regressiewachten op RV1/RV4: deze release raakt de indeling
//  en het leren niet, en KLOPTE en BIJNA mogen nooit tegelijk fel zijn.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_countdown_weergave.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testCountdownWeergave().regels);
// ═══════════════════════════════════════════════════════════════

function testCountdownWeergave() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const NODE = 777007;
  const bewaard = {
    fase, cdStart, cdWallStart, cdWallNodeId, activeCdDoel, activeCdModus,
    activeCdMin, activeCdMax, cdBereikteNul, countdownNulTijd, groenStart,
    dichtstbijOSM, huidigCdBron, huidigCdWaarde, aiKleur, aiTeller,
    bevestigActief, bevInertStaat, richtingLockKeuze,
    v9PreSelectieAfrij, osmVoorspellingActief, snelheidKmh,
    getal: cdPillGetal.textContent, label: cdPillLabel.textContent,
    pillClass: cdPill.className, wrapClass: bevestigWrap.className
  };
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };

  // Zet een lopende CD_VAAG-countdown met doel `gem` en band `band`, waarbij
  // `verS` seconden verstreken zijn. cdMin/cdMax worden gezet zoals
  // bepaalCdModus ze zou opleveren (r2870-2872), inclusief de klem op cdMin.
  function zetVaag(gem, band, verS) {
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 12, naam: 'TEST-CW' };
    fase = 'rood';
    cdStart = performance.now() - verS * 1000;
    cdWallStart = Date.now() - verS * 1000;
    cdWallNodeId = String(NODE);
    activeCdDoel = gem;
    activeCdModus = CD_VAAG;
    activeCdMin = band == null ? null : Math.max(1, Math.round(gem - band));
    activeCdMax = band == null ? null : Math.round(gem + band);
    cdBereikteNul = false;
    countdownNulTijd = null;
    groenStart = null;
    osmVoorspellingActief = false;
    v9PreSelectieAfrij = null;
    richtingLockKeuze = null;
    huidigCdBron = 'V4';
    snelheidKmh = 0;
    cdPill.classList.add('actief');
    tickCd();
    return { getal: cdPillGetal.textContent, label: cdPillLabel.textContent };
  }

  try {
    // ══ T1 — één getal plus een marge, niet "11-33" ═══════════
    let r = zetVaag(22, 11, 0);
    eis('T1 CD_VAAG toont één aftellend getal met een marge, niet min-max',
        /±/.test(r.getal) && !/\d+-\d+s/.test(r.getal),
        'één getal met ±, geen "11-33s"',
        r.getal + '  /  ' + r.label);
    eis('T1b de marge is 11 (uit activeCdMax - activeCdDoel)',
        /±11$/.test(r.getal), '±11', r.getal);

    // ══ T2 — het getal is Math.ceil(over) ═════════════════════
    // over = activeCdDoel - ver. Bij gem 22 en ver 6 is dat 16.
    r = zetVaag(22, 11, 6);
    eis('T2 het aftellende getal is Math.ceil(over) — hetzelfde getal als het nulpunt',
        /~16s/.test(r.getal), '~16s ±11', r.getal);
    // en dat is NIET het oude linkergetal: cdMin - ver = 11 - 6 = 5
    eis('T2b het is dus niet meer het oude linkergetal (dat zou 5 zijn)',
        !/~5s/.test(r.getal), 'niet ~5s', r.getal);

    // ══ T3 — DE KERN: de marge telt niet af ═══════════════════
    const a = zetVaag(30, 8, 0), b = zetVaag(30, 8, 10), c = zetVaag(30, 8, 20);
    const marge = s => (s.getal.match(/±(\d+)/) || [])[1];
    eis('T3 de marge blijft staan terwijl ver oploopt (statisch)',
        marge(a) === '8' && marge(b) === '8' && marge(c) === '8',
        '8 / 8 / 8', marge(a) + ' / ' + marge(b) + ' / ' + marge(c));
    eis('T3b het getal telt WEL af',
        /~30s/.test(a.getal) && /~20s/.test(b.getal) && /~10s/.test(c.getal),
        '30 / 20 / 10', [a.getal, b.getal, c.getal].join('  |  '));

    // ══ T4 — bij nul neemt de "+Ns te laat"-tak het over ══════
    // over <= 0 en fase rood: tak 1 (r7419) wint van de CD_VAAG-tak.
    r = zetVaag(22, 11, 25);
    eis('T4 zodra over 0 is en de fase rood, toont de pill de overschrijding',
        /\+\d+s/.test(r.getal) && !/±/.test(r.getal),
        '+Ns, geen marge meer', r.getal + '  /  ' + r.label);
    eis('T4b en het nulpunt is dan gezet',
        cdBereikteNul === true, 'true', String(cdBereikteNul));

    // ══ T5 — RV3: geen bruikbare band, geen kapotte string ════
    r = zetVaag(22, null, 5);   // activeCdMin/Max blijven null
    eis('T5 zonder band valt hij terug op één getal zonder marge',
        !/NaN|undefined|±/.test(r.getal),
        'geen NaN/undefined/±', r.getal + '  /  ' + r.label);
    // en met een onbruikbare cdMax (band zou 0 of negatief worden)
    zetVaag(22, 11, 5); activeCdMax = activeCdDoel; tickCd();
    eis('T5b band 0 levert ook geen "±0" op',
        !/±/.test(cdPillGetal.textContent) && !/NaN/.test(cdPillGetal.textContent),
        'geen ±, geen NaN', cdPillGetal.textContent);

    // ══ T6-T8 — de klikpoort ══════════════════════════════════
    // Opzet: rood, nulpunt gezet, 30s overschrijding -> KLOPTE is inert.
    function zetInert() {
      zetLS('sl_bevestig_' + NODE, null);
      dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 12, naam: 'TEST-CW' };
      fase = 'rood';
      cdBereikteNul = true;
      countdownNulTijd = Date.now() - 30000;    // ver buiten BEV_BIJNA_MAX_MS
      groenStart = null;
      cdStart = performance.now() - 60000;
      activeCdDoel = 30;
      huidigCdBron = 'V4'; huidigCdWaarde = 30;
      snelheidKmh = 0;
    }
    const recs = () => {
      try { return JSON.parse(localStorage.getItem('sl_bevestig_' + NODE)) || []; }
      catch (e) { return []; }
    };

    zetInert(); aiKleur = 'rood'; aiTeller = 3;
    eis('T6 KLOPTE is hier inert (voorwaarde voor T6-T8)',
        klopteIsNoOp() === true, 'true', String(klopteIsNoOp()));
    bevestigCountdown('klopte');
    eis('T6b gedimde KLOPTE met aiKleur rood: geblokkeerd, geen record',
        recs().length === 0, '0 records', String(recs().length));

    zetInert(); aiKleur = 'groen'; aiTeller = 1;
    bevestigCountdown('klopte');
    eis('T7 gedimde KLOPTE met aiKleur GROEN: doorgelaten, record geschreven',
        recs().length === 1, '1 record', String(recs().length));
    eis('T7b en dat record draagt categorie klopte',
        recs()[0] && recs()[0].categorie === 'klopte', 'klopte',
        recs()[0] ? recs()[0].categorie : '(geen)');

    zetInert(); aiKleur = null; aiTeller = 0;
    bevestigCountdown('klopte');
    eis('T8 gedimde KLOPTE met aiKleur null: geblokkeerd (RV2, veilig falen)',
        recs().length === 0, '0 records', String(recs().length));
    zetInert(); aiKleur = undefined;
    bevestigCountdown('klopte');
    eis('T8b idem bij undefined',
        recs().length === 0, '0 records', String(recs().length));

    // ══ T9 — aiK en aiT in het record ═════════════════════════
    zetInert(); aiKleur = 'groen'; aiTeller = 2;
    bevestigCountdown('klopte');
    const rec = recs()[0];
    eis('T9 het record draagt aiK en aiT met de juiste waarden',
        rec && rec.aiK === 'groen' && rec.aiT === 2,
        "aiK 'groen', aiT 2",
        rec ? ('aiK ' + JSON.stringify(rec.aiK) + ', aiT ' + JSON.stringify(rec.aiT)) : '(geen record)');
    zetLS('sl_bevestig_' + NODE, null);
    zetInert(); aiKleur = null; aiTeller = 0;
    bevestigCountdown('fout');            // FOUT kent de poort niet
    const rec2 = recs()[0];
    eis('T9b bij onbekende camera-staat zijn aiK en aiT null, geen crash',
        rec2 && rec2.aiK === null && rec2.aiT === 0,
        'aiK null, aiT 0',
        rec2 ? ('aiK ' + JSON.stringify(rec2.aiK) + ', aiT ' + JSON.stringify(rec2.aiT)) : '(geen record)');

    // ══ T10 — RV4: KLOPTE en BIJNA nooit tegelijk fel ═════════
    const zet = (toestand, overschrMs) => {
      dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 12, naam: 'TEST-CW' };
      cdWallStart = null; cdWallNodeId = null;
      groenStart = null; cdStart = null; activeCdDoel = 0;
      if (toestand === 'rood-voor-nul') {
        fase = 'rood'; cdBereikteNul = false; countdownNulTijd = null;
        cdStart = performance.now(); activeCdDoel = 30;
      } else if (toestand === 'groen-voor-nul') {
        fase = 'groen'; cdBereikteNul = false; countdownNulTijd = null;
      } else {
        fase = 'groen'; cdBereikteNul = true;
        groenStart = performance.now();
        countdownNulTijd = Date.now() - overschrMs;
      }
      bevestigActief = true; bevestigWrap.classList.add('actief');
      bevInertStaat = ''; updateBevestigKnopStaat();
    };
    let beide = null;
    for (const [t, o] of [['rood-voor-nul', null], ['groen-voor-nul', null],
                          ['groen-na-nul', 1000], ['groen-na-nul', 5000],
                          ['groen-na-nul', 15000], ['groen-na-nul', BEV_GOED_MAX_MS],
                          ['groen-na-nul', BEV_BIJNA_MAX_MS + 1]]) {
      zet(t, o);
      if (!bevKlopteBtn.classList.contains('inert')
          && !bevBijnaBtn.classList.contains('inert') && beide === null) beide = t + '@' + o;
    }
    eis('T10 KLOPTE en BIJNA lichten nooit tegelijk op',
        beide === null, 'nooit beide fel', beide || 'nooit beide fel');

    // ══ T11 — RV1: indeling en vensters ongewijzigd ═══════════
    const zc = b2 => b2.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    eis('T11 BEV_GOED_MAX_MS / BEV_BIJNA_MAX_MS ongewijzigd',
        BEV_GOED_MAX_MS === 2000 && BEV_BIJNA_MAX_MS === 10000,
        '2000 / 10000', BEV_GOED_MAX_MS + ' / ' + BEV_BIJNA_MAX_MS);
    eis('T11b bevestigIndeling toetst nog ondertekend op overschrMs',
        /m\.overschrMs <= BEV_GOED_MAX_MS/.test(zc(String(bevestigIndeling))),
        'ongewijzigd', zc(String(bevestigIndeling)).replace(/\s+/g, ' ').slice(0, 80));
    eis('T11c bijnaIsNoOp houdt de blanco-uitzondering (Release B raakt hem)',
        /rood-voor-nul/.test(zc(String(bijnaIsNoOp))) && /groen-voor-nul/.test(zc(String(bijnaIsNoOp))),
        'uitzondering aanwezig',
        /rood-voor-nul/.test(zc(String(bijnaIsNoOp))) ? 'aanwezig' : 'WEG');
    eis('T11d bepaalCdModus berekent cdMin/cdMax nog steeds (Release B heeft ze nodig)',
        /cdMin = Math\.max\(1, Math\.round\(gem - band\)\)/.test(zc(String(bepaalCdModus)))
          && /cdMax = Math\.round\(gem \+ band\)/.test(zc(String(bepaalCdModus))),
        'beide aanwezig',
        /cdMin = Math\.max/.test(zc(String(bepaalCdModus))) ? 'aanwezig' : 'WEG');
    const vbl = zc(String(verwerkBevestigLeren));
    eis('T11e de drie schrijftakken in verwerkBevestigLeren ongewijzigd',
        /gem \* 1\.6/.test(vbl) && /gem \+ correctieSec/.test(vbl)
          && /0\.4, dd, 'bevestig_klopte'/.test(vbl),
        'fout 1.6, bijna gem+correctie, klopte 0.4',
        [/gem \* 1\.6/.test(vbl) ? 'fout ok' : 'FOUT GEWIJZIGD',
         /gem \+ correctieSec/.test(vbl) ? 'bijna ok' : 'BIJNA GEWIJZIGD',
         /0\.4, dd, 'bevestig_klopte'/.test(vbl) ? 'klopte ok' : 'KLOPTE GEWIJZIGD'].join(', '));

    // ══ T12 — de poort is voorwaardelijk, niet geschrapt ══════
    const bc = zc(String(bevestigCountdown));
    eis('T12 de blokkerende return bestaat nog, nu achter aiKleur',
        /aiKleur === 'groen'/.test(bc) && /return;/.test(bc),
        'voorwaardelijke poort', /aiKleur/.test(bc) ? 'voorwaardelijk' : 'POORT WEG');
    eis('T12b beide paden loggen apart',
        /bevestig_klopte_vroeg/.test(bc) && /bevestig_klopte_inert/.test(bc),
        'twee logredenen',
        (/bevestig_klopte_vroeg/.test(bc) ? 'vroeg' : 'VROEG WEG') + ', '
          + (/bevestig_klopte_inert/.test(bc) ? 'inert' : 'INERT WEG'));

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    fase = bewaard.fase; cdStart = bewaard.cdStart;
    cdWallStart = bewaard.cdWallStart; cdWallNodeId = bewaard.cdWallNodeId;
    activeCdDoel = bewaard.activeCdDoel; activeCdModus = bewaard.activeCdModus;
    activeCdMin = bewaard.activeCdMin; activeCdMax = bewaard.activeCdMax;
    cdBereikteNul = bewaard.cdBereikteNul; countdownNulTijd = bewaard.countdownNulTijd;
    groenStart = bewaard.groenStart; dichtstbijOSM = bewaard.dichtstbijOSM;
    huidigCdBron = bewaard.huidigCdBron; huidigCdWaarde = bewaard.huidigCdWaarde;
    aiKleur = bewaard.aiKleur; aiTeller = bewaard.aiTeller;
    bevestigActief = bewaard.bevestigActief; bevInertStaat = bewaard.bevInertStaat;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    osmVoorspellingActief = bewaard.osmVoorspellingActief;
    snelheidKmh = bewaard.snelheidKmh;
    cdPillGetal.textContent = bewaard.getal; cdPillLabel.textContent = bewaard.label;
    cdPill.className = bewaard.pillClass; bevestigWrap.className = bewaard.wrapClass;
    bevKlopteBtn.classList.remove('inert');
    bevBijnaBtn.classList.remove('inert');
    bevFoutBtn.classList.remove('inert');
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testCountdownWeergave = testCountdownWeergave;
