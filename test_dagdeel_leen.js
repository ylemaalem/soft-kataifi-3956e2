// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_dagdeel_leen.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.13, twee onderdelen.
//
//  ONDERDEEL 1 — de percentagebalk toont hoeveel metingen HET HUIDIGE DAGDEEL
//  heeft, uit dezelfde bron als de strip eronder.
//
//  ONDERDEEL 2 — een dagdeel met minder dan DD_LEEN_MIN_METINGEN eigen
//  metingen vult zich aan met dezelfde CATEGORIE uit de andere dagdelen.
//  De grens die nooit overschreden mag worden is de categorie: Rechtsaf leent
//  van Rechtsaf, Rond licht van Rond licht. Niet te verwarren met de bestaande
//  lening van V11.17.83 (richting valt terug op Algemeen, binnen hetzelfde
//  dagdeel) — die moet er ongewijzigd naast blijven werken.
//
//  B1  de teller naast de balk
//  D1  lenen bij een dun dagdeel, met zichtbaar label
//  D2  vanaf 5 eigen metingen stopt het lenen
//  D3  DE CATEGORIEGRENS: rechtsaf ziet nooit linksaf of het ronde licht
//  D4  het ronde licht leent alleen van het ronde licht
//  D5  de oude lening (v4_geen_richtingdata) werkt ongewijzigd
//  D6  beide mechanismen samen: eigen data van een ander moment gaat vóór
//  D7  REGRESSIE: met 5+ eigen metingen verandert er niets
//
//  DE FIXTURE-CONVENTIE. laadMV5Geclusterd trekt buurrichtingen mee
//  (afgerondNaar45, r2797), dus de emmers in deze test staan bewust tegenover
//  elkaar: rechtsaf is N>W, linksaf is Z>O. Die twee clusters overlappen niet,
//  zodat een leen over de categoriegrens meteen zichtbaar zou worden.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_dagdeel_leen.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testDagdeelLeen().regels);
// ═══════════════════════════════════════════════════════════════

function testDagdeelLeen() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const NODE = 664001;
  const NU = huidigDDActief();
  // Een ander dagdeel dan het huidige, om van te lenen.
  const ANDER = Object.keys(DD).find(d => d !== NU);
  const nu = Date.now();

  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos, huidigeRichting, snelheidKmh,
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij,
    getoondeLaag, getoondDagdeel, richtingBlokVerborgen,
    huidigCdBron, huidigCdDdGeleend,
    richtingLockNodeId, richtingLockKeuze, richtingLockBron,
    leerNaam: (document.getElementById('leer-naam') || {}).textContent,
    pctTxt: (leerPctGetal || {}).textContent,
    ddTxt: (leerPctDd || {}).textContent,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML
  };
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };

  // n metingen van `duur` seconden, elk met een eigen tijdstempel (laadM
  // ontdubbelt op `tijd`).
  let tikker = 0;
  const mk = (n, duur) => Array.from({ length: n }, () => ({
    duur, tijd: nu - (++tikker) * 60000, gewicht: 1, bron: 'tik', obs: duur
  }));
  const zetV5 = (aanrij, afrij, dd, n, duur) =>
    zetLS(`sl_v5_${NODE}_${aanrij}_${afrij}_${dd}`, n ? JSON.stringify(mk(n, duur)) : null);
  const zetV4 = (dd, n, duur) =>
    zetLS(`sl_v4_${NODE}_${dd}`, n ? JSON.stringify(mk(n, duur).map(x => ({ ...x, richting: 0, bron: 's1' }))) : null);

  const wis = () => {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(`sl_v5_${NODE}_`) || k.startsWith(`sl_v4_${NODE}_`)) zetLS(k, null);
    }
    zetLS('sl_neutraal_' + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);
    zetLS('sl_bevestig_' + NODE, null);
    zetLS('sl_richting_' + NODE, null);
    huidigCdBron = null; huidigCdDdGeleend = false;
    // V11.18.18: stap 1 van kiesCountdownBron eist sinds deze release een ECHTE
    // tik (tikHerkomstEcht). In de app is v9PreSelectieAfrij niet anders te
    // vullen — het herstelpad bestaat niet meer — dus de opzet zet die herkomst
    // er expliciet bij. Zonder deze twee regels meet de toets de nieuwe poort
    // in plaats van wat hij wil meten.
    richtingLockNodeId = String(NODE);
    richtingLockKeuze = 'rechts';
    richtingLockBron = 'tik';
  };
  // rechtsaf = N>W, linksaf = Z>O — twee clusters die elkaar niet raken.
  const RA = ['N', 'W'], LA = ['Z', 'O'];
  const bron = (afrij = RA[1], aanrij = RA[0]) => kiesCountdownBron(String(NODE), NU, aanrij, afrij);

  try {
    // ═══ B1 — DE TELLER NAAST DE BALK ════════════════════════
    wis();
    zetV4(NU, 2, 40);
    zetV4(ANDER, 9, 60);
    huidigePos = { lat: 52.0, lon: 4.7 }; huidigeRichting = 0; snelheidKmh = 0;
    osmCache = [{ id: NODE, lat: 52.0, lon: 4.7, naam: 'Dagdeelstraat', afstand: 12 }];
    dichtstbijOSM = { ...osmCache[0] };
    v9AanrijHeading = null; v9AanrijSnelheidHeading = null; v9PreSelectieAfrij = null;
    getoondeLaag = null; getoondDagdeel = null; richtingBlokVerborgen = false;
    bijwerkLeerkaart(dichtstbijOSM);
    eis('B1 de balk zegt erbij hoeveel metingen DIT dagdeel heeft',
        leerPctDd.textContent === `${DD[NU].ic} 2x`,
        `${DD[NU].ic} 2x`, leerPctDd.textContent);
    eis('B1b en dat is exact wat de dagdeelstrip eronder toont',
        leerPctDd.textContent.endsWith(document.getElementById(`dc-${NU}`).textContent),
        document.getElementById(`dc-${NU}`).textContent, leerPctDd.textContent);
    eis('B1c het percentage zelf telt nog steeds alle dagdelen samen',
        leerPctGetal.textContent === berekenLeerPct(String(NODE)) + '%',
        berekenLeerPct(String(NODE)) + '%', leerPctGetal.textContent);
    getoondDagdeel = ANDER;
    bijwerkLeerkaart(dichtstbijOSM);
    eis('B1d bij een vastgezet dagdeel volgt de teller dat dagdeel',
        leerPctDd.textContent === `${DD[ANDER].ic} 9x`,
        `${DD[ANDER].ic} 9x`, leerPctDd.textContent);
    getoondDagdeel = null;

    // ═══ D1 — LENEN BIJ EEN DUN DAGDEEL ══════════════════════
    wis();
    zetV5(RA[0], RA[1], NU, 2, 30);        // 2 eigen metingen van 30s
    zetV5(RA[0], RA[1], ANDER, 12, 60);    // 12 metingen van 60s in een ander dagdeel
    let r = bron();
    eis('D1 met 2 eigen metingen leent rechtsaf van rechtsaf op een ander dagdeel',
        !!r && r.ddGeleend === true && r.metingen === 14 && r.eigenMetingen === 2,
        'geleend, 14 gepoold, 2 eigen',
        r ? [r.ddGeleend, r.metingen, r.eigenMetingen].join(', ') : 'geen bron');
    eis('D1b het getal ligt tussen de eigen 30s en de geleende 60s, dichter bij de 12',
        !!r && r.gem > 30 && r.gem <= 60,
        '> 30s en <= 60s', r ? Math.round(r.gem) + 's' : '-');
    eis('D1c geleend heet nooit "zeker"',
        !!r && r.modus !== CD_ZEKER, 'geschat of onzeker', r ? r.modus : '-');
    eis('D1d het bronlabel blijft dat van de richting zelf',
        !!r && r.bron === `V5 ${RA[1]}` && r.v5 === true,
        `V5 ${RA[1]}`, r ? r.bron : '-');
    // en het label op het scherm
    huidigCdBron = r.bron; huidigCdDdGeleend = !!r.ddGeleend;
    const labelVoor = 'geschat';
    cdPillLabel.textContent = labelVoor;
    v9PreSelectieAfrij = RA[1];
    if (typeof richtingTekort !== 'undefined') richtingTekort = null;
    // alleen het suffix-blok naspelen zoals tickCd het doet
    if (v9PreSelectieAfrij == null && (huidigCdBron === 'v4_multi' || huidigCdBron === 'V5 alle')) {
      cdPillLabel.textContent += ' · richting?';
    } else if (huidigCdDdGeleend) {
      cdPillLabel.textContent += ' · ander dagdeel';
    }
    eis('D1e op het scherm staat "· ander dagdeel" achter de countdown',
        cdPillLabel.textContent === 'geschat · ander dagdeel',
        'geschat · ander dagdeel', cdPillLabel.textContent);

    // ═══ D2 — VANAF 5 EIGEN METINGEN STOPT HET ═══════════════
    wis();
    zetV5(RA[0], RA[1], NU, 5, 30);
    zetV5(RA[0], RA[1], ANDER, 12, 60);
    r = bron();
    eis('D2 met 5 eigen metingen leent rechtsaf niets meer',
        !!r && r.ddGeleend === false && r.metingen === 5,
        'niet geleend, 5 metingen',
        r ? [r.ddGeleend, r.metingen].join(', ') : 'geen bron');
    eis('D2b en het getal is weer puur de eigen 30s',
        !!r && Math.round(r.gem) === 30, '30s', r ? Math.round(r.gem) + 's' : '-');
    eis('D2c de drempel staat op 5',
        DD_LEEN_MIN_METINGEN === 5, '5', String(DD_LEEN_MIN_METINGEN));

    // ═══ D3 — DE CATEGORIEGRENS ══════════════════════════════
    wis();
    zetV5(RA[0], RA[1], ANDER, 12, 60);    // rechtsaf kent alleen een ander dagdeel
    zetV5(LA[0], LA[1], NU, 20, 200);      // linksaf zit vol, met een heel ander getal
    zetV4(NU, 20, 100);                    // en het ronde licht ook
    r = bron();
    eis('D3 rechtsaf leent van rechtsaf, niet van linksaf en niet van het ronde licht',
        !!r && r.bron === `V5 ${RA[1]}` && Math.round(r.gem) === 60 && r.ddGeleend === true,
        `V5 ${RA[1]}, 60s`, r ? r.bron + ', ' + Math.round(r.gem) + 's' : 'geen bron');
    eis('D3b geen spoor van de 200s van linksaf of de 100s van het ronde licht',
        !!r && r.metingen === 12,
        '12 metingen (alleen rechtsaf)', r ? String(r.metingen) : '-');

    // rechtsaf kent NERGENS iets: dan mag de dagdeellening niets opleveren
    wis();
    zetV5(LA[0], LA[1], NU, 20, 200);
    zetV5(LA[0], LA[1], ANDER, 20, 200);
    zetV4(NU, 20, 100);
    r = bron();
    const eigenLabel = (r && typeof r.bron === 'string'
      && r.bron.startsWith('V5 ') && r.bron !== 'V5 alle' && r.bron !== 'V5 ↑');
    eis('D3c zonder eigen data waar dan ook draagt niets het label van rechtsaf',
        !eigenLabel, 'geen richting-eigen label', r ? r.bron : 'geen bron');
    eis('D3d wat er dan wel staat is de bestaande, gelabelde terugval — nooit stil',
        !r || ['V5 alle', 'V4', 'v4_s2bevestigd', 'v4_multi', 'v4_enkelricht',
               'v4_geen_richtingdata', 'lerend'].includes(r.bron),
        'bekend terugval-label', r ? r.bron : 'geen bron');

    // ═══ D4 — HET RONDE LICHT LEENT VAN ZICHZELF ═════════════
    wis();
    zetLS('sl_neutraal_' + NODE, '1');     // neutrale node: stap 1-3 vervallen
    zetV4(NU, 2, 40);
    zetV4(ANDER, 10, 70);
    zetV5(RA[0], RA[1], NU, 20, 200);      // een richting met een heel ander getal
    r = kiesCountdownBron(String(NODE), NU, RA[0], RA[1]);
    eis('D4 het ronde licht met 2 eigen metingen leent van het ronde licht',
        !!r && r.ddGeleend === true && r.metingen === 12 && r.v5 === false,
        'geleend, 12 metingen, V4',
        r ? [r.ddGeleend, r.metingen, r.v5].join(', ') : 'geen bron');
    eis('D4b en nooit van de richting: de 200s komt er niet in voor',
        !!r && r.gem > 40 && r.gem <= 70,
        'tussen 40s en 70s', r ? Math.round(r.gem) + 's' : '-');
    zetLS('sl_neutraal_' + NODE, null);

    // ═══ D5 — DE OUDE LENING WERKT ONGEWIJZIGD ═══════════════
    // Multi-richting node (twee aanrij-emmers), getikte richting zonder eigen
    // data in welk dagdeel dan ook -> de bestaande terugval op V4.
    // Twee emmers van 2, samen 4: de node is multi-richting, maar stap 3
    // ('V5 alle') haalt zijn eigen poort van V9_MIN_METINGEN niet. Die stap
    // kent bewust GEEN dagdeellening — hij pools over richtingen heen en is
    // dus de andere as. Zo komt de keten bij stap 4 uit, precies waar de
    // terugval van V11.17.83 woont.
    wis();
    zetV5(LA[0], LA[1], NU, 2, 200);       // tweede aanrij-emmer: node is multi
    zetV5('O', 'N', NU, 2, 210);
    zetV4(NU, 10, 55);
    r = bron();
    eis('D5 een richting zonder eigen data valt nog steeds terug op het ronde licht',
        !!r && r.bron === 'v4_geen_richtingdata',
        'v4_geen_richtingdata', r ? r.bron : 'geen bron');
    eis('D5b met het getal van het ronde licht, en zonder dagdeellening',
        !!r && Math.round(r.gem) === 55 && r.ddGeleend === false,
        '55s, niet geleend', r ? Math.round(r.gem) + 's, ' + r.ddGeleend : '-');

    // ═══ D6 — BEIDE MECHANISMEN SAMEN ════════════════════════
    // Dezelfde node, maar nu heeft rechtsaf 1 eigen nachtmeting en 12 op een
    // ander dagdeel. Eigen data van een ander moment hoort te winnen van
    // andermans data van dit moment.
    wis();
    zetV5(LA[0], LA[1], NU, 3, 200);
    zetV5('O', 'N', NU, 3, 210);
    zetV4(NU, 10, 55);
    zetV5(RA[0], RA[1], NU, 1, 30);
    zetV5(RA[0], RA[1], ANDER, 12, 62);
    r = bron();
    eis('D6 de dagdeellening gaat vóór de terugval op het ronde licht',
        !!r && r.bron === `V5 ${RA[1]}` && r.ddGeleend === true && r.metingen === 13,
        `V5 ${RA[1]}, geleend, 13`,
        r ? [r.bron, r.ddGeleend, r.metingen].join(', ') : 'geen bron');
    eis('D6b dus niet de 55s van het ronde licht',
        !!r && Math.round(r.gem) !== 55, 'niet 55s', r ? Math.round(r.gem) + 's' : '-');

    // ═══ D7 — REGRESSIE ══════════════════════════════════════
    wis();
    zetV5(RA[0], RA[1], NU, 8, 45);
    const eigenM = laadMV5Geclusterd(String(NODE), RA[0], RA[1], NU);
    r = bron();
    eis('D7 met genoeg eigen data is de uitkomst identiek aan vóór deze release',
        !!r && r.metingen === eigenM.length && Math.round(r.gem) === Math.round(gewGem(eigenM))
          && r.ddGeleend === false,
        eigenM.length + ' metingen, ' + Math.round(gewGem(eigenM)) + 's',
        r ? r.metingen + ' metingen, ' + Math.round(r.gem) + 's' : 'geen bron');
    eis('D7b een leeg dagdeel zonder enige data waar dan ook geeft geen crash',
        (() => { wis(); try { const x = bron(); return x === null || typeof x === 'object'; }
                 catch (e) { return false; } })(),
        'null of object, geen fout', 'geen fout');
    eis('D7c de helper laat een volle emmer ongemoeid',
        (() => {
          const vol = mk(6, 50);
          const uit = metDagdeelLening(vol, () => mk(99, 1), NU);
          return uit.m === vol && uit.geleend === false && uit.eigenN === 6;
        })(), 'zelfde array, niet geleend', 'ok');

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos; huidigeRichting = bewaard.huidigeRichting;
    snelheidKmh = bewaard.snelheidKmh;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    getoondeLaag = bewaard.getoondeLaag; getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    huidigCdBron = bewaard.huidigCdBron; huidigCdDdGeleend = bewaard.huidigCdDdGeleend;
    richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockBron = bewaard.richtingLockBron;
    const ln = document.getElementById('leer-naam');
    if (ln) ln.textContent = bewaard.leerNaam;
    if (leerPctGetal) leerPctGetal.textContent = bewaard.pctTxt;
    if (leerPctDd) leerPctDd.textContent = bewaard.ddTxt;
    const bb = document.getElementById('richting-blok-body');
    if (bb) bb.innerHTML = bewaard.blokHtml;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testDagdeelLeen = testDagdeelLeen;
