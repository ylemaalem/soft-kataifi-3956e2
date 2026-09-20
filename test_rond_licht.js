// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_rond_licht.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.11, deel 2: 'Algemeen' heet voor de gebruiker 'Rond licht'.
//
//  WAT HIER BEWAAKT WORDT
//  Een tekstvervanging is pas goed als er twee dingen tegelijk kloppen: de
//  gebruiker ziet het nieuwe woord op ELKE plek, en de code eronder merkt er
//  niets van. Opgeslagen data, exports en logs leunen op de interne waarden
//  'algemeen' / 'ALG', dus die mogen geen letter veranderen.
//
//  R1  de zeven teksten uit de opdracht, elk op zijn eigen plek
//  R2  de twee extra plekken (dashboardbadge, 'algemene metingen')
//  R3  in beeld staat nergens meer 'Algemeen'
//  R4  de interne waarden, klasse, logreden en functienamen zijn ongewijzigd
//  R5  koppelen, losmaken en samenvoegen werken nog, via de echte knoppen
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_rond_licht.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRondLicht().regels);
// ═══════════════════════════════════════════════════════════════

function testRondLicht() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const NODE = 888301;
  const DD = huidigDDActief();
  const nu = Date.now();

  const el = (id) => document.getElementById(id);
  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos, huidigeRichting, snelheidKmh, fase,
    richtingKnoppenNodeId, huidigBevestigdOsmNodeId, richtingGedruktVoorNode,
    richtingLockKeuze, richtingLockNodeId, richtingLockBron,
    richtingTikTijd, richtingTikElement,
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij, preZet, preWis,
    getoondeLaag, getoondDagdeel, richtingBlokVerborgen, laatsteRichtingRijen,
    nodeInfoNodeId, mergeModusAan, mergeSelectie: [...mergeSelectie], mergeUndoBuffer,
    blokHtml: (el('richting-blok-body') || {}).innerHTML,
    infoHtml: (el('node-info-body') || {}).innerHTML,
    instrTxt: (el('node-info-instructie') || {}).textContent,
    dlgHtml: (el('node-info-mergedialoog') || {}).innerHTML,
    dlgDisp: el('node-info-mergedialoog') ? el('node-info-mergedialoog').style.display : null
  };
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };

  const blokTxt = () => (el('richting-blok-body') || {}).textContent || '';
  const infoTxt = () => (el('node-info-body') || {}).textContent || '';
  const algRijLabel = () => {
    const r = el('richting-blok-body').querySelector('.rb-rij[data-key="ALG"] .rb-label');
    return r ? r.textContent.trim() : null;
  };

  const opzet = () => {
    zetLS('sl_opslaglog', '[]');
    zetLS('sl_richting_' + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);
    zetLS('sl_neutraal_' + NODE, null);
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, null);
    for (const k of Object.keys(localStorage)) if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
    zetLS('sl_v4_' + NODE + '_' + DD, JSON.stringify(
      [0, 1, 2].map(i => ({ duur: 40, tijd: nu - i * 60000, richting: 0, gewicht: 1, obs: 40, bron: 's1' }))));
    huidigePos = { lat: 52.0, lon: 4.7 }; huidigeRichting = 0; snelheidKmh = 0; fase = null;
    osmCache = [{ id: NODE, lat: 52.0, lon: 4.7, naam: 'Rondstraat', afstand: 10 }];
    dichtstbijOSM = { ...osmCache[0] };
    richtingKnoppenNodeId = String(NODE); huidigBevestigdOsmNodeId = String(NODE);
    richtingGedruktVoorNode = null;
    richtingLockKeuze = null; richtingLockNodeId = null; richtingLockBron = null;
    richtingTikTijd = 0; richtingTikElement = null;
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0; v9PreSelectieAfrij = null;
    preZet = null; preWis = null;
    getoondeLaag = null; getoondDagdeel = null; richtingBlokVerborgen = false;
    nodeInfoNodeId = String(NODE); mergeModusAan = false; mergeSelectie = []; mergeUndoBuffer = null;
  };

  try {
    // ═══ R1 — DE ZEVEN TEKSTEN ═══════════════════════════════
    opzet();
    eis('R1.1 de ronde-lichtrij heet "Rond licht"',
        algemeenLabel(String(NODE)).tekst === 'Rond licht' && algemeenLabel(String(NODE)).pijl === '⬤',
        '⬤ Rond licht', JSON.stringify(algemeenLabel(String(NODE))));
    renderRichtingBlok(dichtstbijOSM);
    eis('R1.1b en zo staat hij ook in het rijblok',
        algRijLabel() === 'Rond licht', 'Rond licht', String(algRijLabel()));

    // ── V11.18.18: DEZE DRIE TOETSEN ZIJN OMGEDRAAID ────────
    // R1.2 t/m R1.2c legden de tekst van het koppelaanbod vast: "Is het ronde
    // licht hier hetzelfde als linksaf?". Die vraag is vervallen met de release
    // die rond licht tot vaste standaard maakte — het ronde licht is een eigen
    // categorie en geen kandidaat om in een richting op te gaan. Wat hier nu
    // staat is dus geen verzwakte toets maar de tegenovergestelde eis.
    tikRichting('links', 'vraag');
    renderRichtingBlok(dichtstbijOSM);
    let chip = el('richting-blok-body').querySelector('.rb-koppel');
    eis('R1.2 na een tik staat er GEEN koppelaanbod meer op de ronde-lichtregel',
        chip === null, 'geen chip', chip ? chip.getAttribute('title') : 'geen chip');
    opzet();
    tikRichting('rechts', 'vraag');
    renderRichtingBlok(dichtstbijOSM);
    chip = el('richting-blok-body').querySelector('.rb-koppel');
    eis('R1.2b ook niet bij een andere richting',
        chip === null, 'geen chip', chip ? chip.getAttribute('title') : 'geen chip');
    eis('R1.2c en de renderfunctie kent de chiptekst niet meer',
        !/zelfde als/.test(String(renderRichtingBlok).replace(/\/\*[\s\S]*?\*\//g, ' ')
                                                   .replace(/\/\/.*/g, ' ')),
        'geen chiptekst in de code', 'weg');

    opzet();
    mergeModusAan = true;
    renderNodeInfo(String(NODE));
    eis('R1.3 de merge-instructie noemt "een richting + het ronde licht"',
        el('node-info-instructie').textContent
          === 'Kies twee richtingen om samen te voegen (of een richting + het ronde licht)',
        '… (of een richting + het ronde licht)', el('node-info-instructie').textContent);

    zetLS('sl_v5_' + NODE + '_N_W_' + DD, JSON.stringify([{ duur: 30, tijd: nu - 7200000, gewicht: 1, bron: 'tik' }]));
    mergeSelectie = ['ALG', 'N>W'];
    toonMergeDialoog();
    const knoppen = () => [...el('node-info-mergedialoog').querySelectorAll('button')];
    const naarRond = knoppen().find(b => (b.getAttribute('onclick') || '').indexOf("'ALG')") >= 0);
    eis('R1.4 de merge-knop zegt "Naar het ronde licht — richting-label vervalt…"',
        !!naarRond && naarRond.textContent.indexOf('Naar het ronde licht — richting-label vervalt, ') === 0,
        'Naar het ronde licht — richting-label vervalt, …', naarRond ? naarRond.textContent : 'geen knop');

    eis('R1.5 de Eén-licht-uitleg zegt "koppel het ronde licht aan die ene richting"',
        el('node-info-neutraal-uitleg').textContent.indexOf('koppel het ronde licht aan die ene richting.') >= 0,
        '… koppel het ronde licht aan die ene richting.', el('node-info-neutraal-uitleg').textContent.slice(-60));

    // De leerlog-regel draait alleen in een eenmalige migratie; de tekst staat
    // letterlijk in de functie, dus die wordt daar gelezen.
    eis('R1.6 de leerlog van het rv-herstel zegt "tellen weer mee bij het ronde licht"',
        String(migratieRvWezen).indexOf("' kruispunt(en) tellen weer mee bij het ronde licht'") >= 0
          && String(migratieRvWezen).indexOf('bij Algemeen') < 0,
        'nieuwe tekst, oude weg', 'zie migratieRvWezen');

    eis('R1.7 de knop in het node-info-paneel heet "Alles één licht"',
        el('node-info-neutraal').textContent === 'Alles één licht',
        'Alles één licht', el('node-info-neutraal').textContent);
    zetLS('sl_neutraal_' + NODE, '1');
    renderNodeInfo(String(NODE));
    eis('R1.7b en blijft zo heten als de markering aan staat',
        el('node-info-neutraal').textContent === 'Alles één licht'
          && el('node-info-neutraal').classList.contains('actief'),
        'Alles één licht, actief', el('node-info-neutraal').textContent + ' / '
          + el('node-info-neutraal').classList.contains('actief'));

    // ═══ R2 — DE TWEE EXTRA PLEKKEN ══════════════════════════
    eis('R2.1 de dashboardbadge heet ook "Alles één licht"',
        renderEenLichtBadge(NODE).indexOf('>Alles één licht</span>') >= 0,
        'Alles één licht', renderEenLichtBadge(NODE));
    zetLS('sl_neutraal_' + NODE, null);

    opzet();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD, JSON.stringify([{ duur: 30, tijd: nu - 7200000, gewicht: 1, bron: 'tik' }]));
    mergeSelectie = ['ALG', 'N>W'];
    toonMergeDialoog();
    eis('R2.2 de tegenknop spreekt van "metingen van het ronde licht"',
        el('node-info-mergedialoog').textContent.indexOf('3 metingen van het ronde licht gaan voortaan bij deze richting horen') >= 0,
        '3 metingen van het ronde licht …', el('node-info-mergedialoog').textContent.slice(0, 200));
    zetLS('sl_v4_' + NODE + '_' + DD, JSON.stringify(
      [{ duur: 40, tijd: nu - 60000, richting: 0, gewicht: 1, obs: 40, bron: 's1', rv: 1, rvK: 'Z_O' }]));
    toonMergeDialoog();
    eis('R2.3 en de lege variant zegt dat het ronde licht geen eigen metingen meer heeft',
        el('node-info-mergedialoog').textContent.indexOf('Andersom kan hier niet: het ronde licht heeft geen eigen metingen meer') >= 0,
        'Andersom kan hier niet: het ronde licht heeft …', el('node-info-mergedialoog').textContent.slice(0, 200));

    // ═══ R3 — NERGENS MEER 'ALGEMEEN' IN BEELD ═══════════════
    opzet();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD, JSON.stringify([{ duur: 30, tijd: nu - 7200000, gewicht: 1, bron: 'tik' }]));
    tikRichting('links', 'vraag');
    renderRichtingBlok(dichtstbijOSM);
    mergeModusAan = true; mergeSelectie = ['ALG', 'N>W'];
    renderNodeInfo(String(NODE));
    toonMergeDialoog();
    const zichtbaar = [blokTxt(), infoTxt(), el('node-info-instructie').textContent,
      el('node-info-mergedialoog').textContent, el('node-info-neutraal').textContent,
      el('node-info-neutraal-uitleg').textContent,
      [...document.querySelectorAll('#richting-blok-body [title], #node-info-body [title]')]
        .map(x => x.getAttribute('title')).join(' ')].join(' | ');
    eis('R3 rijblok, paneel, instructie, dialoog, knop, uitleg en tooltips: geen "Algemeen"/"algemene"',
        !/algeme(en|ne)/i.test(zichtbaar), 'geen treffer',
        (zichtbaar.match(/.{0,30}algeme(en|ne).{0,30}/i) || ['schoon'])[0]);
    eis('R3b de hoofdpagina zelf (HTML buiten scripts) evenmin',
        !/algeme(en|ne)/i.test(document.body.innerText || ''), 'geen treffer',
        ((document.body.innerText || '').match(/.{0,30}algeme(en|ne).{0,30}/i) || ['schoon'])[0]);

    // ═══ R4 — DE INTERNE WAARDEN BLEVEN STAAN ════════════════
    opzet();
    tikRichting('rechts', 'vraag');
    kiesLaagAlgemeen();
    eis("R4 kiesLaagAlgemeen zet nog steeds de interne waarde 'algemeen'",
        richtingLockKeuze === 'algemeen' && richtingLockBron === 'tik', "'algemeen', 'tik'",
        richtingLockKeuze + ', ' + richtingLockBron);
    eis("R4b en de logreden blijft 'algemeen-tik'",
        preWis && preWis.reden === 'algemeen-tik', 'algemeen-tik', preWis ? preWis.reden : 'geen preWis');
    renderRichtingBlok(dichtstbijOSM);
    const algBlok = el('richting-blok-body').querySelector('.rb-rij[data-key="ALG"]');
    eis("R4c de rij in het rijblok draagt data-key 'ALG' en roept kiesLaagAlgemeen aan",
        !!algBlok && algBlok.getAttribute('onclick') === 'kiesLaagAlgemeen()',
        "ALG, kiesLaagAlgemeen()", algBlok ? algBlok.getAttribute('onclick') : 'geen rij');
    mergeModusAan = false;
    renderNodeInfo(String(NODE));
    const algPaneel = el('node-info-body').querySelector('.ni-rij.ni-rij-algemeen');
    eis("R4d de rij in het paneel draagt nog klasse ni-rij-algemeen en data-key 'ALG'",
        !!algPaneel && algPaneel.getAttribute('data-key') === 'ALG'
          && algPaneel.querySelector('.ni-rij-label').textContent === 'Rond licht',
        'ni-rij-algemeen, ALG, label Rond licht',
        algPaneel ? algPaneel.getAttribute('data-key') + ' / ' + algPaneel.querySelector('.ni-rij-label').textContent : 'geen rij');
    const namen = ['kiesLaagAlgemeen', 'algemeenLabel', 'verplaatsAlgemeenNaarRichting',
      'telAlgemeenVerplaatsbaar', 'laagTerugNaarAlgemeenBijKoppeling', 'migratieRvWezen'];
    const ontbreekt = namen.filter(n => typeof window[n] !== 'function');
    eis('R4e alle interne functienamen bestaan nog',
        ontbreekt.length === 0, 'alle ' + namen.length, ontbreekt.length ? 'ontbreekt: ' + ontbreekt.join(', ') : 'alle');
    eis("R4f rijdersPijlLabel herkent 'ALG' nog als sleutel",
        rijdersPijlLabel('ALG', 'ALG').tekst === 'Rond licht', 'Rond licht', rijdersPijlLabel('ALG', 'ALG').tekst);

    // ═══ R5 — KOPPELEN, LOSMAKEN, SAMENVOEGEN ════════════════
    // V11.18.18: koppelen gebeurt niet meer via een chip op het rijscherm maar
    // bewust vanuit het node-info-paneel. De rest van deze groep (de naam van de
    // rij, losmaken, samenvoegen) is ongewijzigd.
    opzet();
    tikRichting('rechts', 'vraag');
    koppelVanuitPaneel(String(NODE), 'rechts');
    renderRichtingBlok(dichtstbijOSM);
    eis('R5 koppelen via het paneel werkt, en de rij heet dan naar de richting',
        laadEnkelRicht(String(NODE)) === 'rechts' && algRijLabel() && algRijLabel().indexOf('Rechtsaf') === 0
          && blokTxt().indexOf('Rond licht') < 0,
        "'rechts', label Rechtsaf", laadEnkelRicht(String(NODE)) + ' / ' + algRijLabel());

    renderNodeInfo(String(NODE));
    const los = el('node-info-body').querySelector('.ni-koppel-los');
    eis('R5b vooraf: het paneel toont de Losmaken-knop', !!los, 'knop aanwezig', los ? 'aanwezig' : 'ONTBREEKT');
    if (los) los.click();
    eis('R5c een klik op Losmaken ontkoppelt, en de naam Rond licht komt terug',
        // startsWith en niet ===: de koppel-chip staat BINNEN .rb-label, dus na
        // het losmaken leest het label 'Rond licht zelfde als →?'.
        laadEnkelRicht(String(NODE)) == null && algRijLabel().indexOf('Rond licht') === 0
          && el('node-info-body').querySelector('.ni-rij-algemeen .ni-rij-label').textContent === 'Rond licht',
        'geen koppeling, Rond licht', String(laadEnkelRicht(String(NODE))) + ' / ' + algRijLabel());

    opzet();
    const v4Voor = JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + DD)).length;
    zetLS('sl_v5_' + NODE + '_N_W_' + DD, JSON.stringify([{ duur: 30, tijd: nu - 7200000, gewicht: 1, bron: 'tik' }]));
    mergeModusAan = true; mergeSelectie = ['ALG', 'N>W'];
    renderNodeInfo(String(NODE));
    toonMergeDialoog();
    const knop = knoppen().find(b => (b.getAttribute('onclick') || '') === "voerMergeUit('N>W','ALG')");
    eis('R5d vooraf: de knop "Naar het ronde licht" roept voerMergeUit(richting, ALG) aan',
        !!knop, "voerMergeUit('N>W','ALG')", knoppen().map(b => b.getAttribute('onclick')).join(' | '));
    if (knop) knop.click();
    eis('R5e een klik voegt samen: de richting-emmer is weg, de V4-metingen blijven',
        localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD) === null
          && JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + DD)).length === v4Voor,
        'N>W weg, V4 ' + v4Voor,
        'N>W ' + (localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD) === null ? 'weg' : 'bestaat')
          + ', V4 ' + JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + DD)).length);

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos; huidigeRichting = bewaard.huidigeRichting;
    snelheidKmh = bewaard.snelheidKmh; fase = bewaard.fase;
    richtingKnoppenNodeId = bewaard.richtingKnoppenNodeId;
    huidigBevestigdOsmNodeId = bewaard.huidigBevestigdOsmNodeId;
    richtingGedruktVoorNode = bewaard.richtingGedruktVoorNode;
    richtingLockKeuze = bewaard.richtingLockKeuze; richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingLockBron = bewaard.richtingLockBron;
    richtingTikTijd = bewaard.richtingTikTijd; richtingTikElement = bewaard.richtingTikElement;
    v9AanrijHeading = bewaard.v9AanrijHeading; v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij; preZet = bewaard.preZet; preWis = bewaard.preWis;
    getoondeLaag = bewaard.getoondeLaag; getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    laatsteRichtingRijen = bewaard.laatsteRichtingRijen;
    nodeInfoNodeId = bewaard.nodeInfoNodeId; mergeModusAan = bewaard.mergeModusAan;
    mergeSelectie = bewaard.mergeSelectie; mergeUndoBuffer = bewaard.mergeUndoBuffer;
    if (el('richting-blok-body')) el('richting-blok-body').innerHTML = bewaard.blokHtml;
    if (el('node-info-body')) el('node-info-body').innerHTML = bewaard.infoHtml;
    if (el('node-info-instructie')) el('node-info-instructie').textContent = bewaard.instrTxt;
    const dlg = el('node-info-mergedialoog');
    if (dlg) { dlg.innerHTML = bewaard.dlgHtml; dlg.style.display = bewaard.dlgDisp; }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRondLicht = testRondLicht;
