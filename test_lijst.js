// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_lijst.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.75: de richtinglijst in het node-info-paneel.
//
//  TWEE DINGEN DIE HIER VASTLIGGEN
//
//  1. Twee ECHT verschillende naderingen mogen nooit meer als twee identieke
//     regels verschijnen. rijdersPijlLabel mapt 64 kompasparen op 4 woorden, en
//     renderNodeInfo groepeert op het rauwe paar (aanrij_afrij) — dus O>Z en
//     NO>O zijn allebei 'Linksaf' en stonden twee keer onder elkaar zonder
//     zichtbaar verschil. T1/T2 leggen vast dat de aanrijrichting meekomt.
//     Dit is GEEN opslagbug: de sleutels zijn terecht verschillend. Wie ooit
//     besluit ze samen te voegen gooit echte data weg — vandaar T3.
//
//  2. De koppel-strip ('Algemeen is hetzelfde licht als ↑') mag niet tegelijk
//     met 'Eén licht' te zien zijn. Die twee markeringen zeggen bijna het
//     tegenovergestelde en dat is precies de verwarring die V11.17.75 moet
//     wegnemen. T6 is daarvoor de wacht.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_lijst.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testLijst().regels);
// ═══════════════════════════════════════════════════════════════

function testLijst() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  // MULTI: twee aanrijrichtingen, allebei 'Linksaf' — de botsing uit deel 2.
  //   O  -> Z : hoekverschil  90°  -> Linksaf
  //   NO -> O : hoekverschil  45°  -> Linksaf
  const MULTI = '990101';
  // ENKEL: één aanrijrichting -> isEenRichtingNode true -> koppeling is inert.
  const ENKEL = '990102';
  const DDT = 'dag';

  const sleutels = [
    'sl_v5_' + MULTI + '_O_Z_' + DDT,
    'sl_v5_' + MULTI + '_NO_O_' + DDT,
    'sl_v4_' + MULTI + '_' + DDT,
    'sl_v5_' + ENKEL + '_N_Z_' + DDT,
    'sl_v4_' + ENKEL + '_' + DDT,
    'sl_enkelricht_' + MULTI, 'sl_neutraal_' + MULTI,
    'sl_enkelricht_' + ENKEL, 'sl_neutraal_' + ENKEL,
  ];
  const bewaard = {};
  for (const k of sleutels) bewaard[k] = localStorage.getItem(k);
  const bewaardMerge = mergeModusAan, bewaardSel = mergeSelectie.slice();
  const bewaardNodeInfo = nodeInfoNodeId;

  const body = () => document.getElementById('node-info-body').innerHTML;
  const nu = Date.now();
  const mk = (n, duur) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ duur, tijd: nu - i * 3600000, gewicht: 1.0, bron: 'tik' });
    return JSON.stringify(a);
  };
  const mk4 = (n, duur) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ duur, tijd: nu - i * 3600000, richting: 0, obs: duur, gewicht: 0.9, bron: 's1' });
    return JSON.stringify(a);
  };

  try {
    localStorage.setItem('sl_v5_' + MULTI + '_O_Z_' + DDT,  mk(4, 30));
    localStorage.setItem('sl_v5_' + MULTI + '_NO_O_' + DDT, mk(3, 45));
    localStorage.setItem('sl_v4_' + MULTI + '_' + DDT, mk4(8, 40));
    localStorage.setItem('sl_v5_' + ENKEL + '_N_Z_' + DDT, mk(4, 30));
    localStorage.setItem('sl_v4_' + ENKEL + '_' + DDT, mk4(8, 40));
    localStorage.removeItem('sl_enkelricht_' + MULTI);
    localStorage.removeItem('sl_neutraal_' + MULTI);
    mergeModusAan = false; mergeSelectie = [];

    // ══ T1 — de opzet botst inderdaad ═════════════════════════
    // Zonder deze controle zegt T2 niets: als de twee paren niet allebei
    // 'Linksaf' opleveren is er geen botsing om op te lossen.
    const lblA = rijdersPijlLabel('O', 'Z').tekst;
    const lblB = rijdersPijlLabel('NO', 'O').tekst;
    eis('T1 opzet: twee verschillende naderingen leveren HETZELFDE label',
        lblA === 'Linksaf' && lblB === 'Linksaf',
        "beide 'Linksaf'", lblA + ' / ' + lblB);

    nodeInfoNodeId = MULTI;
    renderNodeInfo(MULTI);
    const h = body();

    eis('T1b beide richtingregels staan er ook echt allebei',
        (h.match(/Linksaf/g) || []).length === 2,
        '2x Linksaf', ((h.match(/Linksaf/g) || []).length) + 'x');

    // ══ T2 — de regels zijn nu te onderscheiden ═══════════════
    eis('T2 de aanrijrichting staat bij elke richtingregel',
        h.includes('vanaf O') && h.includes('vanaf NO'),
        "'vanaf O' en 'vanaf NO'",
        'vanaf O=' + h.includes('vanaf O') + ', vanaf NO=' + h.includes('vanaf NO'));

    // De kern: haal de labelteksten eruit en toets dat ze VERSCHILLEN.
    const labels = [...document.querySelectorAll('#node-info-body .ni-rij-label')]
      .map(e => e.textContent.trim()).filter(t => t !== 'Algemeen');
    eis('T2b geen twee richtingregels lezen nog identiek',
        labels.length === new Set(labels).size && labels.length === 2,
        '2 regels, allebei uniek', JSON.stringify(labels));

    // ══ T3 — het blijven twee aparte sleutels ═════════════════
    // De fix zit in de WEERGAVE. Zou iemand ooit op label groeperen, dan
    // verdwijnt hier een echte nadering en valt deze test om.
    eis('T3 de twee naderingen blijven apart opgeslagen (geen samenvoeging)',
        verzamelV5Richtingen(MULTI).length === 2 && aantalAanrijRichtingen(MULTI) === 2,
        '2 V5-groepen, 2 aanrijrichtingen',
        verzamelV5Richtingen(MULTI).length + ' groepen, ' + aantalAanrijRichtingen(MULTI) + ' aanrij');

    // ══ T4 — de koppel-strip biedt de drie richtingen aan ═════
    eis('T4 zonder markering staan er drie richtingknoppen',
        (h.match(/ni-koppel-btn/g) || []).length === 3,
        '3 knoppen', ((h.match(/ni-koppel-btn/g) || []).length) + ' knoppen');
    eis('T4b met de uitleg dat de rest apart blijft',
        h.includes('blijven apart'), "tekst 'blijven apart'",
        h.includes('blijven apart') ? 'aanwezig' : 'ONTBREEKT');

    // ══ T5 — koppelen werkt zonder actieve rijrichting ════════
    // Dat is het hele punt van de paneel-variant: koppelEnkelRicht leest
    // richtingLockKeuze en doet niets als die leeg is.
    const bewaardLock = richtingLockKeuze;
    richtingLockKeuze = null;
    koppelVanuitPaneel(MULTI, 'rechtdoor');
    const naKoppel = body();
    eis('T5 koppelen lukt zonder dat er een richting actief is',
        laadEnkelRicht(MULTI) === 'rechtdoor',
        "'rechtdoor'", String(laadEnkelRicht(MULTI)));
    eis('T5b de strip toont nu de zin, niet meer de knoppen',
        naKoppel.includes('hetzelfde licht als') && !naKoppel.includes('ni-koppel-btn')
        && naKoppel.includes('Losmaken'),
        'zin + Losmaken, geen keuzeknoppen',
        'zin=' + naKoppel.includes('hetzelfde licht als')
        + ' knoppen=' + naKoppel.includes('ni-koppel-btn')
        + ' losmaken=' + naKoppel.includes('Losmaken'));
    ontkoppelVanuitPaneel(MULTI);
    eis('T5c losmaken zet hem terug op het aanbod',
        laadEnkelRicht(MULTI) === null && body().includes('ni-koppel-btn'),
        'vlag weg, knoppen terug',
        'vlag=' + laadEnkelRicht(MULTI) + ', knoppen=' + body().includes('ni-koppel-btn'));
    richtingLockKeuze = bewaardLock;

    // ══ T6 — DE SCHEIDSLIJN met 'Eén licht' ═══════════════════
    // Beide markeringen tegelijk aanbieden is precies de verwarring die deze
    // release moet wegnemen. 'Eén licht' zegt: ALLE richtingen zijn hetzelfde.
    // De koppeling zegt: Algemeen is ÉÉN richting, de rest blijft apart.
    localStorage.setItem('sl_neutraal_' + MULTI, '1');
    renderNodeInfo(MULTI);
    eis('T6 op een "Eén licht"-node verdwijnt de koppel-strip volledig',
        !body().includes('ni-koppel'),
        'geen koppel-strip', body().includes('ni-koppel') ? 'STRIP AANWEZIG' : 'afwezig');
    localStorage.removeItem('sl_neutraal_' + MULTI);
    renderNodeInfo(MULTI);
    eis('T6b en komt terug zodra de markering eraf gaat',
        body().includes('ni-koppel-btn'), 'strip terug',
        body().includes('ni-koppel-btn') ? 'terug' : 'BLIJFT WEG');

    // ══ T7 — niet tegelijk met merge-selectie ═════════════════
    mergeModusAan = true; mergeSelectie = [];
    renderNodeInfo(MULTI);
    eis('T7 in merge-modus is de Algemeen-rij een selectievak, geen koppelrij',
        !body().includes('ni-koppel') && body().includes('ni-rij-vink'),
        'geen strip, wel vinkjes',
        'strip=' + body().includes('ni-koppel') + ', vink=' + body().includes('ni-rij-vink'));
    mergeModusAan = false; mergeSelectie = [];

    // ══ T8 — eerlijk zijn over wanneer het niets doet ═════════
    // De cap zit in de v4_multi-tak, en die wordt alleen bereikt bij MEER dan
    // één aanrijrichting. Op 105 van de 112 nodes uit de export van 28-08 is
    // dat niet zo; daar verandert koppelen niets aan de countdown.
    renderNodeInfo(MULTI);
    eis('T8 bij twee aanrijrichtingen staat er GEEN inert-waarschuwing',
        !body().includes('ni-koppel-inert'),
        'geen waarschuwing', body().includes('ni-koppel-inert') ? 'WEL waarschuwing' : 'geen');
    nodeInfoNodeId = ENKEL;
    renderNodeInfo(ENKEL);
    eis('T8b bij één aanrijrichting wordt wel gezegd dat het nu niets doet',
        body().includes('ni-koppel-inert') && aantalAanrijRichtingen(ENKEL) === 1,
        'waarschuwing zichtbaar bij 1 aanrijrichting',
        'inert=' + body().includes('ni-koppel-inert') + ', aanrij=' + aantalAanrijRichtingen(ENKEL));
    eis('T8c de knoppen blijven bruikbaar — de markering is vooruitkijkend',
        (body().match(/ni-koppel-btn/g) || []).length === 3,
        '3 knoppen', ((body().match(/ni-koppel-btn/g) || []).length) + ' knoppen');

    // ══ T9 — geen Algemeen-rij, geen strip ════════════════════
    localStorage.removeItem('sl_v4_' + ENKEL + '_' + DDT);
    renderNodeInfo(ENKEL);
    eis('T9 zonder V4-data is er geen Algemeen-rij en dus niets om aan te koppelen',
        !body().includes('ni-koppel') && !body().includes('ni-rij-algemeen'),
        'geen Algemeen-rij, geen strip',
        'strip=' + body().includes('ni-koppel') + ', alg=' + body().includes('ni-rij-algemeen'));

  } finally {
    for (const k of sleutels) {
      if (bewaard[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, bewaard[k]);
    }
    mergeModusAan = bewaardMerge; mergeSelectie = bewaardSel;
    nodeInfoNodeId = bewaardNodeInfo;
    if (nodeInfoNodeId) { try { renderNodeInfo(nodeInfoNodeId); } catch (e) {} }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testLijst = testLijst;
