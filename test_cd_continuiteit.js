// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_cd_continuiteit.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.98: de countdown herkent een ECHTE nieuwe rode fase na groen,
//  in plaats van hem aan te zien voor de voortzetting van de vorige.
//
//  WAT ER MIS WAS
//  De dropout-continuïteit in startCd (V11.14.3) rekende cdStart terug naar het
//  oorspronkelijke startmoment zolang `elapsed < activeCdDoel + 12` op dezelfde
//  node. Die voorwaarde meet alleen verstreken wandtijd — of er een groene fase
//  tussen zat weet ze niet, en cdWallStart wordt bij een gewone groen->rood-
//  omslag nergens genuld. Op een druk kruispunt telde de klok daardoor door in
//  de tweede rode fase.
//
//  TWEE SYMPTOMEN, ÉÉN OORZAAK — EN T3 IS DE ERNSTIGSTE
//  Voorbij activeCdDoel toont de pill meteen '+0s te laat' in rood; dat valt op.
//  Daarónder telt hij gewoon af, maar vanaf een te laag getal — en dat ziet er
//  betrouwbaar uit terwijl het dat niet is. T2 bewaakt het zichtbare geval,
//  T3 het stille.
//
//  WAT NIET MAG SNEUVELEN
//  De continuïteit blijft precies doen waar hij voor bedoeld was: een camera die
//  het licht kwijtraakt terwijl het rood blijft. Daar is zagRoodOvergang per
//  definitie false (de vorige fase is dan null, niet groen), dus T1 hoort op
//  zowel de oude als de nieuwe code groen te zijn.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_cd_continuiteit.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testCdContinuiteit().regels);
// ═══════════════════════════════════════════════════════════════

function testCdContinuiteit() {
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

  const NODE = 995201;
  const DD_NU = huidigDDActief();
  const nu = Date.now();
  const DOEL = 40;   // 8 metingen van 40s -> activeCdDoel 40, venster 52

  const bewaard = {
    dichtstbijOSM, fase, faseNodeId, zagRoodOvergang, cdStart, cdWallStart, cdWallNodeId,
    activeCdDoel, activeCdModus, activeCdMin, activeCdMax, cdBereikteNul, countdownNulTijd,
    cdWeergaveNulTijd, cdLaatstGetoond, herzTel, osmVoorspellingActief, huidigCdBron,
    v9PreSelectieAfrij, v9AanrijHeading, v9AanrijSnelheidHeading, richtingTekort,
    cdCondSleutel, cdCondTab, cdCondDoel, groenStart, schaduwWaarden, schaduwCountdownNul,
    getal: document.getElementById('cd-pill-getal').textContent,
    label: document.getElementById('cd-pill-label').textContent,
    kleur: document.getElementById('cd-pill-getal').style.color,
    pillKlasse: cdPill.className,
    // Deze suite roept tickCd aan, en die zet sinds V11.17.78 de bevestigbalk
    // aan zodra er een countdown loopt. Zonder herstel blijft die balk 'actief'
    // achter en start de eerstvolgende klassewissel elders een filter/
    // box-shadow-overgang die in een verborgen paneel niet doorloopt —
    // test_knopkleur T8/T9b/T10/T12b lezen precies die overgangswaarden.
    // Gemeten: die suite geeft alleen 25/25 als deze zes waarden terugkomen.
    // Zelfde herstel als test_richting_ui, dat dezelfde val al eens raakte.
    bevestigActief, bevInertStaat, wrapClass: bevestigWrap.className,
    knopK: bevKlopteBtn.className, knopB: bevBijnaBtn.className, knopF: bevFoutBtn.className
  };

  const pill = () => ({
    getal: document.getElementById('cd-pill-getal').textContent,
    label: document.getElementById('cd-pill-label').textContent,
    kleur: document.getElementById('cd-pill-getal').style.color
  });
  const logRegels = (reden) => {
    try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === reden); }
    catch (e) { return []; }
  };
  const schoon = () => {
    fase = null; faseNodeId = null; zagRoodOvergang = false;
    cdStart = null; cdWallStart = null; cdWallNodeId = null; activeCdDoel = 0;
    cdBereikteNul = false; countdownNulTijd = null; cdWeergaveNulTijd = null;
    cdLaatstGetoond = null; herzTel = null; cdCondSleutel = null; cdCondTab = null;
    cdCondDoel = null; osmVoorspellingActief = false; groenStart = null;
    zetLS('sl_opslaglog', null);
  };

  // Rood 1, dan `tussentijdS` seconden later opnieuw rood. `naGroen` bepaalt of
  // de app de omslag groen->rood zelf zag — precies het onderscheid dat deze
  // release maakt. De tussentijd wordt nagebootst door cdWallStart terug te
  // zetten; dat is exact de grootheid waar startCd op rekent.
  const tweedeRood = (tussentijdS, naGroen) => {
    schoon();
    fase = 'rood'; faseNodeId = String(NODE);
    activeCdDoel = gewGem(laadM(NODE, DD_NU));
    startCd();
    cdWallStart = Date.now() - tussentijdS * 1000;
    if (naGroen) { fase = 'groen'; stopCd(); }
    zagRoodOvergang = !!naGroen;   // wat verwerkFase op r7694 zou hebben gezet
    fase = 'rood';
    activeCdDoel = gewGem(laadM(NODE, DD_NU));
    startCd();
    const verstreken = cdStart != null ? (performance.now() - cdStart) / 1000 : null;
    tickCd();
    return { verstreken: verstreken != null ? Math.round(verstreken) : null, ...pill() };
  };

  try {
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(
      Array.from({ length: 8 }, (_, i) => ({
        duur: DOEL, tijd: nu - i * 3600000, gewicht: 1, obs: DOEL, bron: 's1' }))));
    zetLS('sl_neutraal_' + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
    }
    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 20, naam: 'Druk kruispunt' };
    v9PreSelectieAfrij = null; v9AanrijHeading = null; v9AanrijSnelheidHeading = null;
    richtingTekort = null;

    const VENSTER = DOEL + CD_DROPOUT_MAX_S;
    eis('T0 de opzet klopt: doel 40s, venster 52s',
        Math.round(gewGem(laadM(NODE, DD_NU))) === DOEL && VENSTER === 52,
        'doel 40, venster 52',
        Math.round(gewGem(laadM(NODE, DD_NU))) + ' / ' + VENSTER);

    // ══ T1 — ECHTE DROPOUT: CONTINUÏTEIT BLIJFT ═══════════════
    // De camera raakt het licht kwijt terwijl het rood blijft. Er is geen groen
    // gezien, dus zagRoodOvergang is false en de klok hoort door te lopen.
    const drop = tweedeRood(20, false);
    eis('T1 bij een dropout telt de klok door vanaf de oorspronkelijke start',
        drop.verstreken === 20, '20s verstreken', drop.verstreken + 's');
    eis('T1b en de pill toont de resterende tijd van die ene fase',
        drop.getal === '20s' && drop.label === 'groen over',
        "'20s groen over'", drop.getal + ' ' + drop.label);
    eis('T1c er wordt niets geweigerd, dus ook niets gelogd',
        logRegels('cd_continuiteit_geweigerd').length === 0,
        '0 regels', logRegels('cd_continuiteit_geweigerd').length + ' regels');

    // ══ T2 — HET ZICHTBARE GEVAL: 45s, WAS '+0s TE LAAT' ══════
    const t45 = tweedeRood(45, true);
    eis('T2 na een echte groen->rood-omslag begint de klok opnieuw',
        t45.verstreken === 0, '0s verstreken', t45.verstreken + 's');
    eis('T2b de pill toont een verse voorspelling in plaats van "+0s te laat"',
        t45.getal === DOEL + 's' && t45.label === 'groen over',
        "'40s groen over'", t45.getal + ' ' + t45.label);
    eis('T2c en dus geen rode oplopende teller op het eerste frame',
        t45.getal.indexOf('+') < 0 && t45.kleur !== 'var(--rood)',
        'geen +, niet rood', t45.getal + ' / ' + t45.kleur);

    // ══ T3 — HET STILLE GEVAL: 10-30s, TELDE TE LAAG AF ═══════
    // Dit zag er eerder normaal uit en was juist daarom het vervelendst.
    const stil = [10, 20, 30].map(t => ({ t, ...tweedeRood(t, true) }));
    eis('T3 bij 10, 20 en 30s tussentijd begint de klok ook vers',
        stil.every(x => x.verstreken === 0),
        '3x 0s verstreken', stil.map(x => x.t + 's->' + x.verstreken + 's').join(', '));
    eis('T3b en telt af vanaf het volle doel, niet vanaf een te laag getal',
        stil.every(x => x.getal === DOEL + 's'),
        '3x 40s', stil.map(x => x.t + 's->' + x.getal).join(', '));

    // ══ T4 — DE VENSTERRAND, BEIDE KANTEN OP ══════════════════
    // Binnen het venster beslist zagRoodOvergang; buiten het venster is er
    // sowieso een verse start en mag de vlag niets meer uitmaken.
    const rand = [
      { t: VENSTER - 1, groen: false }, { t: VENSTER - 1, groen: true },
      { t: VENSTER,     groen: false }, { t: VENSTER,     groen: true },
      { t: VENSTER + 1, groen: false }, { t: VENSTER + 1, groen: true }
    ].map(c => ({ ...c, ...tweedeRood(c.t, c.groen) }));
    const binnenZonderGroen = rand.find(r => r.t === VENSTER - 1 && !r.groen);
    const binnenMetGroen    = rand.find(r => r.t === VENSTER - 1 && r.groen);
    eis('T4 net BINNEN het venster zonder groen: doortellen (ongewijzigd)',
        binnenZonderGroen.verstreken === VENSTER - 1,
        (VENSTER - 1) + 's verstreken', binnenZonderGroen.verstreken + 's');
    eis('T4b net binnen het venster MET groen: verse start',
        binnenMetGroen.verstreken === 0 && binnenMetGroen.getal === DOEL + 's',
        '0s, 40s op de pill', binnenMetGroen.verstreken + 's, ' + binnenMetGroen.getal);
    const buiten = rand.filter(r => r.t >= VENSTER);
    eis('T4c buiten het venster is het altijd een verse start, groen of niet',
        buiten.every(r => r.verstreken === 0 && r.getal === DOEL + 's'),
        '4x vers', buiten.map(r => r.t + 's/' + (r.groen ? 'groen' : 'geen') + '->' + r.verstreken + 's').join(', '));

    // ══ T5 — DE MEETREGEL ═════════════════════════════════════
    schoon();
    tweedeRood(45, true);
    const r5 = logRegels('cd_continuiteit_geweigerd');
    eis('T5 een geweigerde continuïteit wordt gelogd',
        r5.length === 1, '1 regel', r5.length + ' regels');
    eis('T5b met node, verstreken tijd, doel en venster',
        r5[0] && String(r5[0].node) === String(NODE) && r5[0].cdVerstr === 45
        && r5[0].cdDoel === DOEL && r5[0].cdVenster === VENSTER,
        'node/45/40/52',
        r5[0] ? [r5[0].node, r5[0].cdVerstr, r5[0].cdDoel, r5[0].cdVenster].join('/') : 'GEEN REGEL');
    // Een echte dropout logt niets — anders zou het meetpunt de reparatie niet
    // meer meten maar het normale gedrag.
    schoon();
    tweedeRood(20, false);
    eis('T5c een geaccepteerde continuïteit logt niets',
        logRegels('cd_continuiteit_geweigerd').length === 0,
        '0 regels', logRegels('cd_continuiteit_geweigerd').length + ' regels');
    // Buiten het venster is er geen continuïteit om te weigeren, dus ook geen regel.
    schoon();
    tweedeRood(90, true);
    eis('T5d buiten het venster wordt er ook niets gelogd — er viel niets te weigeren',
        logRegels('cd_continuiteit_geweigerd').length === 0,
        '0 regels', logRegels('cd_continuiteit_geweigerd').length + ' regels');
    // De velden staan nergens anders: een gewone logregel houdt ze op null.
    schoon();
    logOpslagMis('te_kort', { node: NODE, dur: 2 });
    const ander = logRegels('te_kort')[0];
    eis('T5e de drie nieuwe velden blijven null op elke andere logregel',
        ander && ander.cdVerstr === null && ander.cdDoel === null && ander.cdVenster === null,
        '3x null',
        ander ? [ander.cdVerstr, ander.cdDoel, ander.cdVenster].join('/') : 'GEEN REGEL');

    // ══ T6 — DE VOORSPELLING ZELF IS ONGEWIJZIGD ══════════════
    // Deze release verandert het STARTMOMENT, niet wat er voorspeld wordt.
    schoon();
    tweedeRood(45, true);
    eis('T6 activeCdDoel wordt bij een verse start gewoon opnieuw bepaald',
        Math.round(activeCdDoel) === DOEL, String(DOEL), String(Math.round(activeCdDoel)));
    eis('T6b met de zekerheidsklasse die bij de data hoort',
        activeCdModus === CD_ZEKER, 'zeker', String(activeCdModus));
    eis('T6c en de bron is gezet',
        typeof huidigCdBron === 'string' && huidigCdBron.length > 0,
        'een bronlabel', String(huidigCdBron));
    // Een vage emmer houdt zijn band ook na een geweigerde continuïteit.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(
      [20, 20, 20, 60, 20, 20].map((d, i) => ({
        duur: d, tijd: nu - i * 3600000, gewicht: 1, obs: d, bron: 's1' }))));
    schoon();
    tweedeRood(45, true);
    eis('T6d een vage emmer levert nog steeds CD_VAAG met een band',
        activeCdModus === CD_VAAG && typeof activeCdMin === 'number'
        && typeof activeCdMax === 'number' && activeCdMax > activeCdMin,
        'vaag met cdMin/cdMax',
        activeCdModus + ' ' + activeCdMin + '-' + activeCdMax);
    eis('T6e en de pill toont die onzekerheid, niet een hard getal',
        pill().label === 'onzeker', "'onzeker'", pill().label);

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    fase = bewaard.fase; faseNodeId = bewaard.faseNodeId;
    zagRoodOvergang = bewaard.zagRoodOvergang;
    cdStart = bewaard.cdStart; cdWallStart = bewaard.cdWallStart;
    cdWallNodeId = bewaard.cdWallNodeId;
    activeCdDoel = bewaard.activeCdDoel; activeCdModus = bewaard.activeCdModus;
    activeCdMin = bewaard.activeCdMin; activeCdMax = bewaard.activeCdMax;
    cdBereikteNul = bewaard.cdBereikteNul; countdownNulTijd = bewaard.countdownNulTijd;
    cdWeergaveNulTijd = bewaard.cdWeergaveNulTijd; cdLaatstGetoond = bewaard.cdLaatstGetoond;
    herzTel = bewaard.herzTel; osmVoorspellingActief = bewaard.osmVoorspellingActief;
    huidigCdBron = bewaard.huidigCdBron; v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    richtingTekort = bewaard.richtingTekort;
    cdCondSleutel = bewaard.cdCondSleutel; cdCondTab = bewaard.cdCondTab;
    cdCondDoel = bewaard.cdCondDoel; groenStart = bewaard.groenStart;
    schaduwWaarden = bewaard.schaduwWaarden; schaduwCountdownNul = bewaard.schaduwCountdownNul;
    // De pill terug op wat er stond: hij hangt in het camerascherm en een
    // achtergebleven '+0s te laat' zou daar blijven staan.
    document.getElementById('cd-pill-getal').textContent = bewaard.getal;
    document.getElementById('cd-pill-label').textContent = bewaard.label;
    document.getElementById('cd-pill-getal').style.color = bewaard.kleur;
    cdPill.className = bewaard.pillKlasse;
    bevestigActief = bewaard.bevestigActief;
    bevInertStaat = bewaard.bevInertStaat;
    bevestigWrap.className = bewaard.wrapClass;
    bevKlopteBtn.className = bewaard.knopK;
    bevBijnaBtn.className  = bewaard.knopB;
    bevFoutBtn.className   = bewaard.knopF;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testCdContinuiteit = testCdContinuiteit;
