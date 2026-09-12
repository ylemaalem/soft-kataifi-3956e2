// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_koppel_eenrij.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.4 (samenvoegen stap 2): een gekoppeld kruispunt toont nog
//  één rij in plaats van twee — op het hoofdscherm én in het node-info-paneel.
//
//  WAT ER MIS WAS
//  Een koppeling (sl_enkelricht_) zegt: dit kruispunt heeft geen apart rond
//  licht, en één richting IS het licht dat voor iedereen geldt. Toch stonden er
//  twee regels met dezelfde naam: 'Rechtsaf' als hernoemde Algemeen-rij
//  (algemeenLabel) en 'Rechtsaf' als losse richting-regel — met twee
//  verschillende percentages en cyclustijden voor één lamp.
//
//  WAAROM PAS NU
//  V11.17.99 (stap 1) bracht de cijfers op orde: algemeenMetingen poolt de
//  V5-records van de gekoppelde richting mee, genormaliseerd. Pas toen kon de
//  losse regel weg zonder dat de overgebleven regel het verkeerde getal toont.
//  T2 en T8 toetsen precies dat: de ene rij draagt het GEPOOLDE getal.
//
//  DE VALSTRIK DIE T3 BEWAAKT
//  `aanwezig` wordt afgeleid uit de zichtbare rijen. Haal je de gekoppelde
//  groep daaruit, dan geldt die richting als ONTBREKEND en verschijnt er
//  onderaan een toevoegknop '→ Rechtsaf' voor precies de richting die net als
//  hoofdlicht is aangewezen. Het blok zou dan twee tegengestelde dingen beweren.
//
//  T7 IS DE REGRESSIEWACHT: zonder koppeling verandert er niets, byte-identiek.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_koppel_eenrij.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testKoppelEenrij().regels);
// ═══════════════════════════════════════════════════════════════

function testKoppelEenrij() {
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

  const NODE = 999401;
  const DD_NU = huidigDDActief();
  const nu = Date.now();

  const bewaard = {
    dichtstbijOSM, getoondeLaag, getoondDagdeel, richtingBlokVerborgen,
    richtingLockKeuze, richtingLockNodeId, richtingLockBron, richtingKnoppenNodeId,
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij,
    nodeInfoNodeId, mergeModusAan, mergeSelectie, osmCache, huidigePos,
    laatsteRichtingRijen,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML,
    niHtml: (document.getElementById('node-info-body') || {}).innerHTML
  };

  // obs === duur en gewicht 1: hetzelfde pad als een echte s1-meting, zodat
  // vlakGewichtVoor de vlakke weging kiest en de pooling-normalisatie uit
  // V11.17.99 werkelijk getoetst wordt in plaats van omzeild.
  const v4rec = (n, duur) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ duur, tijd: nu - i * 60000, gewicht: 1, obs: duur, bron: 's1' });
    return a;
  };
  const v5rec = (n, duur, offset) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ duur, tijd: nu - (offset || 0) - i * 60000, gewicht: 1.0, bron: 'tik' });
    return a;
  };

  const rijen    = () => [...document.querySelectorAll('#richting-blok-body .rb-rij')];
  const rijLabel = (r) => r.querySelector('.rb-label').textContent.trim();
  const rijKey   = (r) => r.getAttribute('data-key');
  const rijPct   = (r) => r.querySelector('.rb-pct').textContent.trim();
  const rijCyc   = (r) => r.querySelector('.rb-cyc').textContent.trim();
  const tvKnoppen = () => [...document.querySelectorAll('#richting-blok-body .rb-tv-btn')]
    .map(b => b.textContent.trim());
  const niRijen  = () => [...document.querySelectorAll('#node-info-body .ni-rij')];
  const niLabel  = (r) => r.querySelector('.ni-rij-label').textContent.trim();
  const niKey    = (r) => r.getAttribute('data-key');

  // aanrij N (koers 0) + afrij W -> rijdersPijlLabel 'Rechtsaf'
  //           koers 0  + afrij O -> 'Linksaf'
  // De tweede aanrijrichting staat op Z: vier posities van N vandaan, dus
  // buiten het cluster dat laadMV5Geclusterd voor (N, ...) leest.
  const opzet = (opties) => {
    const o = opties || {};
    for (const a of ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'])
      for (const f of ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'])
        zetLS('sl_v5_' + NODE + '_' + a + '_' + f + '_' + DD_NU, null);
    // 3 tegen 5 is geen toevallige verhouding. gewGem is een gewogen MEDIAAN en
    // negeert `gewicht`, dus pooling verschuift het getal alleen als de
    // gekoppelde helft de mediaan over de streep trekt. Met 6x60 naast 4x24
    // blijft de mediaan 60 en zou T2b niets meten; met 3x60 naast 5x24 kantelt
    // hij naar 24 en is het verschil tussen gepoold en ongepoold zichtbaar.
    const v4n = o.v4n != null ? o.v4n : 3;
    const rechtsN = o.rechtsN != null ? o.rechtsN : 5;
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(v4rec(v4n, 60)));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(rechtsN, 24, 0)));
    if (o.metLinks) zetLS('sl_v5_' + NODE + '_N_O_' + DD_NU, JSON.stringify(v5rec(3, 36, 7200000)));
    if (o.metRechtdoor) zetLS('sl_v5_' + NODE + '_N_Z_' + DD_NU, JSON.stringify(v5rec(2, 48, 14400000)));
    zetLS('sl_enkelricht_' + NODE, o.koppel || null);
    zetLS('sl_neutraal_' + NODE, null);
    zetLS('sl_richting_' + NODE, JSON.stringify({
      headings: [0, 2, 1, 3, 0, 1, 2, 1], laatste_update: nu, bevestigingen: 8
    }));
    getoondeLaag = null;
    getoondDagdeel = null;
    richtingBlokVerborgen = false;
    richtingLockKeuze = null; richtingLockNodeId = null; richtingLockBron = null;
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0;
    v9PreSelectieAfrij = null;
    mergeModusAan = false; mergeSelectie = [];
    huidigePos = { lat: 52, lon: 5 };
    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 20, naam: 'Koppelstraat' };
    osmCache = [dichtstbijOSM];
    renderRichtingBlok(dichtstbijOSM);
  };

  try {
    // ═══ T1 — GEKOPPELD: NOG ÉÉN RIJ ══════════════════════════
    opzet({ koppel: 'rechts' });
    let rs = rijen();
    eis('T1 een gekoppeld kruispunt toont precies één rij',
        rs.length === 1, '1 rij',
        rs.length + ' rijen: ' + rs.map(rijLabel).join(' | '));
    eis('T1b en dat is de Algemeen-rij, hernoemd naar de gekoppelde richting',
        rs.length === 1 && rijKey(rs[0]) === 'ALG'
          && rijLabel(rs[0]).startsWith(algemeenLabel(NODE).tekst),
        "data-key ALG, label '" + algemeenLabel(NODE).tekst + "'",
        rs.length ? (rijKey(rs[0]) + ', ' + rijLabel(rs[0])) : 'geen rij');
    eis('T1c er staat geen losse Rechtsaf-rij meer naast',
        !rs.some(r => rijKey(r) !== 'ALG' && rijLabel(r).startsWith('Rechtsaf')),
        'geen tweede Rechtsaf',
        rs.map(r => rijKey(r) + ':' + rijLabel(r)).join(' | '));

    // ═══ T2 — DE OVERGEBLEVEN RIJ TOONT DE GEPOOLDE CIJFERS ═══
    // Het hele bestaansrecht van deze release. Zou de rij het OUDE, ongepoolde
    // Algemeen-getal tonen, dan zijn de vier V5-metingen van rechtsaf van het
    // scherm verdwenen zonder ergens anders op te duiken.
    const gepoold = algemeenMetingen(NODE, DD_NU);
    const ongepoold = zonderRichtingVerwant(laadM(NODE, DD_NU));
    eis('T2 algemeenMetingen poolt de gekoppelde richting daadwerkelijk mee',
        gepoold.length === ongepoold.length + 5,
        (ongepoold.length + 5) + ' metingen (3 V4 + 5 V5)',
        gepoold.length + ' metingen, ongepoold ' + ongepoold.length);
    const gepooldCyc = Math.round(gewGem(gepoold));
    eis('T2b de cyclustijd op de rij is die van de gepoolde set, niet van V4 alleen',
        rs.length === 1 && rijCyc(rs[0]) === gepooldCyc + 's'
          && gepooldCyc !== Math.round(gewGem(ongepoold)),
        gepooldCyc + 's (gepoold), niet ' + Math.round(gewGem(ongepoold)) + 's',
        rs.length ? rijCyc(rs[0]) : 'geen rij');
    eis('T2c en het percentage komt uit diezelfde gepoolde set',
        rs.length === 1 && rijPct(rs[0]) === berekenLeerPct(NODE) + '%',
        berekenLeerPct(NODE) + '%', rs.length ? rijPct(rs[0]) : 'geen rij');

    // ═══ T3 — DE AANWEZIG-VALSTRIK ═══════════════════════════
    eis('T3 er verschijnt GEEN toevoegknop voor de gekoppelde richting',
        !tvKnoppen().some(t => t.includes('Rechtsaf')),
        'geen "Rechtsaf"-knop', tvKnoppen().join(' | ') || 'geen knoppen');
    eis('T3b de andere twee richtingen worden nog wel aangeboden',
        tvKnoppen().some(t => t.includes('Linksaf'))
          && tvKnoppen().some(t => t.includes('Rechtdoor')),
        'Linksaf en Rechtdoor aangeboden', tvKnoppen().join(' | ') || 'geen knoppen');

    // ═══ T4 — EEN ANDERE RICHTING BLIJFT GEWOON STAAN ════════
    opzet({ koppel: 'rechts', metLinks: true });
    rs = rijen();
    eis('T4 een niet-gekoppelde richting blijft zichtbaar naast de Algemeen-rij',
        rs.length === 2 && rs.some(r => rijLabel(r).startsWith('Linksaf')),
        '2 rijen, waarvan één Linksaf',
        rs.length + ' rijen: ' + rs.map(rijLabel).join(' | '));
    eis('T4b en de gekoppelde richting ontbreekt nog steeds als losse rij',
        !rs.some(r => rijKey(r) !== 'ALG' && rijLabel(r).startsWith('Rechtsaf')),
        'geen losse Rechtsaf', rs.map(rijLabel).join(' | '));
    eis('T4c Linksaf telt als aanwezig, dus geen toevoegknop ervoor',
        !tvKnoppen().some(t => t.includes('Linksaf')),
        'geen "Linksaf"-knop', tvKnoppen().join(' | ') || 'geen knoppen');

    // ═══ T5 — DE 2-OF-3-SLICE BLIJFT KLOPPEN ═════════════════
    // heeftAlg is waar, dus de slice is rijen.slice(0, 2). Met drie richtingen
    // waarvan er één gekoppeld is blijven er twee over — precies de max, geen
    // lege plek en geen derde rij die er stiekem bij komt.
    // Alle drie de groepen komen vanaf aanrij N, dus uit dezelfde nadering.
    // Een groep op aanrij Z zou door het naderingsfilter van V11.17.81 sneuvelen
    // en dan meet deze test dat filter in plaats van de slice.
    opzet({ koppel: 'rechts', metLinks: true, metRechtdoor: true });
    rs = rijen();
    eis('T5 met drie richtingen (één gekoppeld) staan er ALG + max 2 rijen',
        rs.length === 3 && rijKey(rs[0]) === 'ALG',
        '3 rijen, eerste is ALG',
        rs.length + ' rijen: ' + rs.map(r => rijKey(r)).join(' | '));
    eis('T5b geen lege plek: elke rij draagt een label en een percentage',
        rs.every(r => rijLabel(r).length > 0 && /%$/.test(rijPct(r))),
        'alle rijen gevuld',
        rs.map(r => rijLabel(r) + ' ' + rijPct(r)).join(' | '));
    eis('T5c en de gekoppelde richting zit er nog steeds niet bij',
        !rs.some(r => rijKey(r) !== 'ALG' && rijLabel(r).startsWith('Rechtsaf')),
        'geen losse Rechtsaf', rs.map(rijLabel).join(' | '));

    // ═══ T6 — LOSMAKEN HERSTELT DE DUBBELE WEERGAVE ══════════
    // Gratis, want er is nooit data verplaatst. Via de echte handler, niet via
    // een directe localStorage-schrijfactie: die knop is wat de gebruiker tikt.
    opzet({ koppel: 'rechts' });
    const voorLos = rijen().length;
    verwijderEnkelRicht(NODE);
    rs = rijen();
    eis('T6 losmaken brengt de richting-rij terug',
        voorLos === 1 && rs.length === 2
          && rs.some(r => rijKey(r) !== 'ALG' && rijLabel(r).startsWith('Rechtsaf')),
        'van 1 rij naar 2, met Rechtsaf terug',
        voorLos + ' -> ' + rs.length + ' rijen: ' + rs.map(rijLabel).join(' | '));
    eis('T6b en de Algemeen-rij heet weer Algemeen',
        rs.length === 2 && rijLabel(rs[0]).startsWith('Algemeen'),
        'Algemeen', rs.length ? rijLabel(rs[0]) : 'geen rij');
    eis('T6c de richting-rij draagt weer haar eigen, ongepoolde cijfers',
        rs.length === 2 && rijCyc(rs[1]) === '24s',
        '24s (de eigen V5-cyclus)', rs.length === 2 ? rijCyc(rs[1]) : 'geen rij');

    // ═══ T7 — REGRESSIE: ZONDER KOPPELING NIETS VERANDERD ════
    opzet({ koppel: null, metLinks: true });
    const zonderKoppeling = document.getElementById('richting-blok-body').innerHTML;
    rs = rijen();
    eis('T7 zonder koppeling staan Algemeen én beide richtingen er gewoon',
        rs.length === 3 && rijKey(rs[0]) === 'ALG'
          && rs.some(r => rijLabel(r).startsWith('Rechtsaf'))
          && rs.some(r => rijLabel(r).startsWith('Linksaf')),
        'ALG + Rechtsaf + Linksaf',
        rs.map(rijLabel).join(' | '));
    // En het filter is écht inert: dezelfde node twee keer tekenen zonder
    // koppeling geeft exact dezelfde HTML.
    renderRichtingBlok(dichtstbijOSM);
    eis('T7b twee keer tekenen zonder koppeling geeft identieke HTML',
        document.getElementById('richting-blok-body').innerHTML === zonderKoppeling,
        'identiek', 'verschil in de opbouw');
    eis('T7c en algemeenMetingen is zonder koppeling gelijk aan de oude bron',
        algemeenMetingen(NODE, DD_NU).length
          === zonderRichtingVerwant(laadM(NODE, DD_NU)).length,
        'zelfde aantal metingen',
        algemeenMetingen(NODE, DD_NU).length + ' vs '
          + zonderRichtingVerwant(laadM(NODE, DD_NU)).length);

    // ═══ T8 — HET NODE-INFO-PANEEL, EIGEN RENDERPAD ══════════
    opzet({ koppel: 'rechts', metLinks: true });
    nodeInfoNodeId = String(NODE);
    mergeModusAan = false; mergeSelectie = [];
    renderNodeInfo(NODE);
    let ns = niRijen();
    eis('T8 het paneel toont de Algemeen-rij en de niet-gekoppelde richting',
        ns.length === 2 && niKey(ns[0]) === 'ALG'
          && ns.some(r => niLabel(r).startsWith('Linksaf')),
        'ALG + Linksaf',
        ns.length + ' rijen: ' + ns.map(r => niKey(r) + ':' + niLabel(r)).join(' | '));
    eis('T8b de gekoppelde richting heeft er geen eigen rij meer',
        !ns.some(r => niKey(r) !== 'ALG' && niLabel(r).startsWith('Rechtsaf')),
        'geen losse Rechtsaf-rij',
        ns.map(r => niKey(r) + ':' + niLabel(r)).join(' | '));
    // Ook hier moet het getal gepoold zijn: het paneel las tot V11.18.4
    // zonderRichtingVerwant(laadM(...)) rechtstreeks, buiten algemeenMetingen om.
    const niAantal = (ns[0].querySelector('.ni-rij-dds').textContent.match(/\((\d+)×\)/) || [])[1];
    eis('T8c het aantal op de Algemeen-rij is het GEPOOLDE aantal',
        String(niAantal) === String(algemeenMetingen(NODE, DD_NU).length)
          && niAantal !== String(zonderRichtingVerwant(laadM(NODE, DD_NU)).length),
        algemeenMetingen(NODE, DD_NU).length + '× (gepoold), niet '
          + zonderRichtingVerwant(laadM(NODE, DD_NU)).length + '×',
        niAantal + '×');
    eis('T8d de losmaakknop staat er, zodat de koppeling omkeerbaar blijft',
        !!document.querySelector('#node-info-body .ni-koppel-los'),
        'losmaakknop aanwezig', 'ONTBREEKT');

    // In MERGE-MODUS staat alles er wel: elke rij is dan een selectievak, en
    // een verborgen rij zou een onzichtbaar aanvinkbaar item opleveren.
    mergeModusAan = true; mergeSelectie = [];
    renderNodeInfo(NODE);
    ns = niRijen();
    eis('T8e in merge-modus staat de gekoppelde rij er wél (selectievak)',
        ns.some(r => niKey(r) !== 'ALG' && niLabel(r).startsWith('Rechtsaf')),
        'Rechtsaf selecteerbaar',
        ns.map(r => niKey(r) + ':' + niLabel(r)).join(' | '));
    mergeModusAan = false; mergeSelectie = [];

    // Losmaken in het paneel herstelt ook daar de dubbele weergave.
    renderNodeInfo(NODE);
    const niVoorLos = niRijen().length;
    ontkoppelVanuitPaneel(String(NODE));
    ns = niRijen();
    eis('T8f losmaken in het paneel brengt de richting-rij terug',
        niVoorLos === 2 && ns.length === 3
          && ns.some(r => niKey(r) !== 'ALG' && niLabel(r).startsWith('Rechtsaf')),
        'van 2 rijen naar 3',
        niVoorLos + ' -> ' + ns.length + ': ' + ns.map(r => niLabel(r)).join(' | '));

    // Regressie op het paneel: zonder koppeling exact het oude beeld.
    opzet({ koppel: null, metLinks: true });
    nodeInfoNodeId = String(NODE);
    renderNodeInfo(NODE);
    ns = niRijen();
    eis('T8g zonder koppeling toont het paneel Algemeen + beide richtingen',
        ns.length === 3 && niKey(ns[0]) === 'ALG'
          && ns.some(r => niLabel(r).startsWith('Rechtsaf'))
          && ns.some(r => niLabel(r).startsWith('Linksaf')),
        'ALG + Rechtsaf + Linksaf',
        ns.map(r => niLabel(r)).join(' | '));

    // ═══ T9 — ALLES GEKOPPELD: GEEN LEGE LIJST, GEEN ONWAARHEID ═══
    // Een kruispunt waar de enige richting de gekoppelde is. De richting-lijst
    // is dan leeg, maar 'Nog geen richtingen opgeslagen' zou pertinent onwaar
    // zijn — er is er juist één, en die IS het licht.
    opzet({ koppel: 'rechts' });
    nodeInfoNodeId = String(NODE);
    renderNodeInfo(NODE);
    const niTekst = document.getElementById('node-info-body').textContent;
    eis('T9 geen misleidende "nog geen richtingen"-melding',
        !niTekst.includes('Nog geen richtingen opgeslagen'),
        'die melding niet', 'melding staat er');
    eis('T9b maar wel een uitleg waar die metingen gebleven zijn',
        niTekst.includes('horen bij') && niTekst.includes('hierboven'),
        'verwijzing naar de Algemeen-rij hierboven',
        niTekst.includes('horen bij') ? 'aanwezig' : 'ONTBREEKT');

    // ═══ T10 — DE GETOONDE LAAG VOLGT DE KOPPELING ═══════════
    // Koppelen terwijl de leerkaart de Rechtsaf-laag toont zou een laag
    // achterlaten zonder zichtbare rij, met de ONGEPOOLDE cijfers eronder.
    opzet({ koppel: null });
    getoondeLaag = { node: String(NODE), key: 'x', paren: [{ aanrij: 'N', afrij: 'W' }] };
    koppelVanuitPaneel(String(NODE), 'rechts');
    eis('T10 koppelen laat de getoonde laag terugvallen op Algemeen',
        getoondeLaag === null, 'null',
        getoondeLaag ? JSON.stringify(getoondeLaag.paren) : 'null');
    // Een laag die NIET over de gekoppelde richting gaat blijft staan.
    opzet({ koppel: null, metLinks: true });
    getoondeLaag = { node: String(NODE), key: 'y', paren: [{ aanrij: 'N', afrij: 'O' }] };
    koppelVanuitPaneel(String(NODE), 'rechts');
    eis('T10b een laag over een ANDERE richting blijft ongemoeid',
        getoondeLaag !== null && getoondeLaag.key === 'y',
        'laag y blijft staan',
        getoondeLaag ? ('laag ' + getoondeLaag.key) : 'null');

    // ═══ T11 — bochtUitLabel: één bron voor zes lezers ═══════
    eis('T11 bochtUitLabel vertaalt de drie labels correct',
        bochtUitLabel('Linksaf') === 'links'
          && bochtUitLabel('Rechtsaf') === 'rechts'
          && bochtUitLabel('Rechtdoor') === 'rechtdoor',
        'links / rechts / rechtdoor',
        [bochtUitLabel('Linksaf'), bochtUitLabel('Rechtsaf'),
         bochtUitLabel('Rechtdoor')].join(' / '));
    eis('T11b Terug geeft null, en alleen op verzoek de oude rechtdoor-fallback',
        bochtUitLabel('Terug') === null && bochtUitLabel('Terug', true) === 'rechtdoor',
        'null, en rechtdoor met fallback',
        String(bochtUitLabel('Terug')) + ', ' + String(bochtUitLabel('Terug', true)));

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    getoondeLaag = bewaard.getoondeLaag;
    getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingLockBron = bewaard.richtingLockBron;
    richtingKnoppenNodeId = bewaard.richtingKnoppenNodeId;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    nodeInfoNodeId = bewaard.nodeInfoNodeId;
    mergeModusAan = bewaard.mergeModusAan;
    mergeSelectie = bewaard.mergeSelectie;
    osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos;
    laatsteRichtingRijen = bewaard.laatsteRichtingRijen;
    const bb = document.getElementById('richting-blok-body');
    if (bb) bb.innerHTML = bewaard.blokHtml;
    const nb = document.getElementById('node-info-body');
    if (nb) nb.innerHTML = bewaard.niHtml;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testKoppelEenrij = testKoppelEenrij;
