// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_merge_alg_bron.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.95 (richting release 4): Algemeen kan nu ook BRON van een
//  samenvoeging zijn, niet alleen doel.
//
//  WAT ER BIJ KOMT
//  Tot nu toe kon een richting opgeslokt worden door Algemeen; andersom
//  blokkeerde voerMergeUit op `bronKey === 'ALG'`. De omgekeerde beweging moet
//  twee dingen tegelijk doen, want een richting-meting leeft in twee stores:
//  het V4-record krijgt rv:1 + rvK van de doelrichting, en er komt een
//  V5-kopie in de emmer van die richting. Doet hij er maar één, dan ontstaat
//  precies de wees die V11.17.92 terugwerkend moest repareren.
//
//  DE INVARIANT DIE HIER BEWAAKT WORDT
//  rv:1 betekent: er is een V5-tweeling. T4 zet dat vast voor het randgeval dat
//  hem kan breken — een record zonder bruikbare duur, dat geen geldige
//  V5-kopie kan krijgen en daarom ook niet gestempeld mag worden.
//
//  T7 IS DE STERKSTE TOETS
//  Heen en weer (Algemeen -> richting -> Algemeen) moet de node in exact
//  dezelfde staat achterlaten. Die rondgang loopt door beide paden en vangt
//  onsymmetrische fouten die geen van de losse toetsen ziet.
//
//  T2 IS DE GEVAARLIJKSTE
//  Te gretig verplaatsen pakt records mee die al bij een ANDERE richting horen
//  en overschrijft hun rvK — dan is hun herkomst weg en tellen ze bij de
//  verkeerde richting. T2 en T6 bewaken die kant.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_merge_alg_bron.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testMergeAlgBron().regels);
// ═══════════════════════════════════════════════════════════════

function testMergeAlgBron() {
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
  const NODE = 996201;
  const DD_NU = huidigDDActief();
  const nu = Date.now();

  const bewaard = {
    nodeInfoNodeId, mergeModusAan, mergeSelectie: [...mergeSelectie],
    mergeUndoBuffer, nodeInfoChipLaatsteNode,
    infoHtml: (document.getElementById('node-info-body') || {}).innerHTML,
    dlgHtml: (document.getElementById('node-info-mergedialoog') || {}).innerHTML,
    dlgDisp: (document.getElementById('node-info-mergedialoog') || {}).style
               ? document.getElementById('node-info-mergedialoog').style.display : null
  };

  // Elk record een eigen tijdstempel: laadM ontdubbelt op `tijd`.
  const v4 = (duur, uurGeleden, extra = {}) => ({
    duur, tijd: nu - uurGeleden * 3600000, richting: 0, obs: duur,
    gewicht: 1, bron: 's1', ...extra
  });
  const v5 = (duur, uurGeleden, extra = {}) => ({
    duur, tijd: nu - uurGeleden * 3600000, gewicht: 1, bron: 'tik', ...extra
  });

  const leesV4 = (dd = DD_NU) => {
    try { return JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + dd)) || []; }
    catch (e) { return []; }
  };
  const leesV5 = (aanrij, afrij, dd = DD_NU) => {
    try { return JSON.parse(localStorage.getItem('sl_v5_' + NODE + '_' + aanrij + '_' + afrij + '_' + dd)) || []; }
    catch (e) { return []; }
  };
  const bestaatV5 = (aanrij, afrij, dd = DD_NU) =>
    localStorage.getItem('sl_v5_' + NODE + '_' + aanrij + '_' + afrij + '_' + dd) !== null;

  const wis = () => {
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, null);
    // Momentopname van de sleutels vóór het wissen: localStorage.key(i) leest
    // een live index en slaat bij verwijderen de helft over.
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
    }
    zetLS('sl_opslaglog', null);
    mergeUndoBuffer = null; mergeModusAan = false; mergeSelectie = [];
  };
  const logRegels = (reden) => {
    try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === reden); }
    catch (e) { return []; }
  };

  try {
    nodeInfoNodeId = String(NODE);

    // ══ T1 — NAAR EEN BESTAANDE RICHTING ══════════════════════
    // Twee algemene metingen, een richting N>W die er al één heeft.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3), v4(55, 4)]));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(58, 5)]));
    voerMergeUit('ALG', 'N>W');
    const naV4 = leesV4(), naV5 = leesV5('N', 'W');
    eis('T1 beide algemene records dragen nu rv:1',
        naV4.length === 2 && naV4.every(x => x.rv === 1),
        '2 records met rv:1', naV4.filter(x => x.rv === 1).length + ' van ' + naV4.length);
    eis('T1b met rvK van de doelrichting, zodat de herkomst vastligt',
        naV4.every(x => x.rvK === 'N_W'), "rvK 'N_W'",
        naV4.map(x => String(x.rvK)).join(', '));
    eis('T1c de V5-emmer bevat de overgehevelde metingen naast wat er al stond',
        naV5.length === 3 && naV5.filter(x => x.duur === 60).length === 1
        && naV5.filter(x => x.duur === 55).length === 1
        && naV5.filter(x => x.duur === 58).length === 1,
        '3 metingen: 58 (bestaand) + 60 + 55',
        naV5.map(x => x.duur).sort().join(', '));
    eis('T1d de kopieën dragen een eigen bronlabel, dus ze zijn achteraf te herkennen',
        naV5.filter(x => x.bron === 'merge_alg').length === 2
        && naV5.filter(x => x.bron === 'tik').length === 1,
        "2x 'merge_alg', 1x 'tik'",
        naV5.map(x => x.bron).join(', '));
    eis('T1e de V4-records blijven staan — ze voeden de countdown gewoon door',
        laadM(NODE, DD_NU).length === 2, '2 records in V4', String(laadM(NODE, DD_NU).length));
    eis('T1f maar tellen niet meer mee bij Algemeen',
        zonderRichtingVerwant(laadM(NODE, DD_NU)).length === 0, '0',
        String(zonderRichtingVerwant(laadM(NODE, DD_NU)).length));
    const t1log = logRegels('merge_alg_verplaatst')[0];
    eis('T1g en de verhuizing wordt geteld gelogd',
        t1log && t1log.rvHer === 2 && t1log.rvOnb === 0, 'rvHer=2, rvOnb=0',
        t1log ? ('rvHer=' + t1log.rvHer + ', rvOnb=' + t1log.rvOnb) : 'GEEN REGEL');

    // ══ T2 — EEN ANDERE RICHTING BLIJFT ONGEMOEID ═════════════
    // Het gevaarlijke geval: een record dat al bij Z>O hoort mag niet
    // meeverhuizen en zijn rvK niet kwijtraken.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      v4(60, 3),                              // algemeen: verhuist
      v4(25, 4, { rv: 1, rvK: 'Z_O' }),       // hoort bij Z>O: blijft
      v4(30, 5, { rv: 1 })                    // gestempeld zonder rvK (tussen D2 en release 1)
    ]));
    zetLS('sl_v5_' + NODE + '_Z_O_' + DD_NU, JSON.stringify([v5(25, 4)]));
    voerMergeUit('ALG', 'N>W');
    const t2 = leesV4();
    eis('T2 alleen het ongestempelde record verhuist',
        t2[0].rv === 1 && t2[0].rvK === 'N_W', "rv:1 rvK 'N_W'",
        'rv=' + t2[0].rv + ' rvK=' + t2[0].rvK);
    eis('T2b het record van Z>O houdt zijn eigen rvK — herkomst blijft herleidbaar',
        t2[1].rv === 1 && t2[1].rvK === 'Z_O', "rvK 'Z_O'", String(t2[1].rvK));
    eis('T2c een gestempeld record zonder rvK wordt ook met rust gelaten',
        t2[2].rv === 1 && t2[2].rvK === undefined, 'rv:1, geen rvK',
        'rv=' + t2[2].rv + ' rvK=' + t2[2].rvK);
    eis('T2d de V5-emmer van Z>O is niet aangeraakt',
        leesV5('Z', 'O').length === 1 && leesV5('Z', 'O')[0].duur === 25,
        '1 meting van 25s', leesV5('Z', 'O').map(x => x.duur).join(', '));
    eis('T2e en alleen die ene meting belandt bij N>W',
        leesV5('N', 'W').length === 1 && leesV5('N', 'W')[0].duur === 60,
        '1 meting van 60s', leesV5('N', 'W').map(x => x.duur).join(', '));

    // ══ T3 — NAAR EEN RICHTING DIE NOG NIET BESTAAT ═══════════
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(42, 2), v4(44, 3)]));
    eis('T3 vooraf bestaat de doel-emmer niet',
        !bestaatV5('Z', 'W'), 'geen sleutel', 'sleutel aanwezig');
    voerMergeUit('ALG', 'Z>W');
    eis('T3b hij wordt aangemaakt met de overgehevelde metingen',
        bestaatV5('Z', 'W') && leesV5('Z', 'W').length === 2,
        '2 metingen', (bestaatV5('Z','W') ? leesV5('Z','W').length : 'geen sleutel') + '');
    eis('T3c en de V4-records wijzen naar die richting',
        leesV4().every(x => x.rv === 1 && x.rvK === 'Z_W'), "rvK 'Z_W'",
        leesV4().map(x => String(x.rvK)).join(', '));

    // ══ T4 — DE INVARIANT: GEEN STEMPEL ZONDER TWEELING ═══════
    // slaOpV5 weigert duur < 4 of > 180. Zulke records kunnen geen geldige
    // V5-kopie krijgen en mogen dus ook niet gestempeld worden.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      v4(60, 2),                    // normaal
      v4(2, 3),                     // te kort
      v4(200, 4),                   // te lang
      { tijd: nu - 5 * 3600000, s2: true, gewicht: 1, bron: 's2' }   // geen duur
    ]));
    voerMergeUit('ALG', 'N>W');
    const t4 = leesV4();
    eis('T4 alleen het bruikbare record is gestempeld',
        t4[0].rv === 1 && t4[1].rv === undefined && t4[2].rv === undefined && t4[3].rv === undefined,
        'alleen de eerste', t4.map(x => (x.rv === 1 ? 'rv' : '-')).join(' '));
    eis('T4b en de V5-emmer bevat precies dat ene record',
        leesV5('N', 'W').length === 1 && leesV5('N', 'W')[0].duur === 60,
        '1 meting van 60s', leesV5('N', 'W').map(x => x.duur).join(', '));
    eis('T4c de onbruikbare records blijven gewoon bij Algemeen meetellen',
        zonderRichtingVerwant(leesV4()).length === 3, '3',
        String(zonderRichtingVerwant(leesV4()).length));
    const t4log = logRegels('merge_alg_verplaatst')[0];
    eis('T4d en het aantal achtergeblevenen wordt gemeld',
        t4log && t4log.rvHer === 1 && t4log.rvOnb === 3, 'rvHer=1, rvOnb=3',
        t4log ? ('rvHer=' + t4log.rvHer + ', rvOnb=' + t4log.rvOnb) : 'GEEN REGEL');

    // ══ T5 — UNDO ZET BEIDE HELFTEN TERUG ═════════════════════
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3), v4(55, 4)]));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(58, 5)]));
    const voorV4 = localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU);
    const voorV5 = localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU);
    voerMergeUit('ALG', 'N>W');
    eis('T5 na de actie is er iets veranderd om terug te draaien',
        localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) !== voorV4
        && mergeUndoBuffer !== null,
        'gewijzigd + undo-buffer', mergeUndoBuffer ? 'buffer aanwezig' : 'GEEN BUFFER');
    mergeUndoUitvoeren();
    eis('T5b de V4-stempels zijn weg — byte-identiek aan vóór de actie',
        localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) === voorV4,
        'identiek', leesV4().map(x => 'rv=' + x.rv).join(' '));
    eis('T5c en de V5-emmer staat weer op zijn oude inhoud',
        localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) === voorV5,
        'identiek', leesV5('N', 'W').map(x => x.duur).join(', '));
    // Undo van een richting die vóór de actie nog niet bestond: de sleutel moet
    // helemaal verdwijnen, niet als lege array achterblijven.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(42, 2)]));
    voerMergeUit('ALG', 'Z>W');
    mergeUndoUitvoeren();
    eis('T5d een emmer die door de actie ontstond is na undo helemaal weg',
        !bestaatV5('Z', 'W'), 'geen sleutel', 'sleutel bestaat nog');
    eis('T5e en het V4-record telt weer bij Algemeen',
        zonderRichtingVerwant(leesV4()).length === 1, '1',
        String(zonderRichtingVerwant(leesV4()).length));

    // ══ T6 — IDEMPOTENT ══════════════════════════════════════
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3)]));
    voerMergeUit('ALG', 'N>W');
    const naEen = { v4: localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU),
                    v5: localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) };
    zetLS('sl_opslaglog', null);
    voerMergeUit('ALG', 'N>W');
    eis('T6 een tweede keer dezelfde actie verandert niets',
        localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) === naEen.v4
        && localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) === naEen.v5,
        'byte-identiek', 'V4 ' + (localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) === naEen.v4)
        + ', V5 ' + (localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) === naEen.v5));
    eis('T6b en biedt geen ongedaan-knop aan voor een handeling die niet gebeurd is',
        mergeUndoBuffer === null, 'geen undo-buffer', mergeUndoBuffer ? 'buffer aanwezig' : 'geen buffer');
    eis('T6c de meting wordt niet dubbel in de V5-emmer gezet',
        leesV5('N', 'W').length === 1, '1 meting', String(leesV5('N', 'W').length));

    // ══ T7 — HEEN EN WEER ════════════════════════════════════
    // De sterkste toets: Algemeen -> richting -> Algemeen moet de node in
    // dezelfde staat achterlaten. Loopt door beide paden.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3), v4(55, 4), v4(58, 6)]));
    const startV4 = localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU);
    voerMergeUit('ALG', 'N>W');
    const tussenGestempeld = leesV4().filter(x => x.rv === 1).length;
    voerMergeUit('N>W', 'ALG');
    eis('T7 heen: alle drie verhuizen naar de richting',
        tussenGestempeld === 3, '3 gestempeld', String(tussenGestempeld));
    eis('T7b terug: geen enkel record draagt nog een stempel',
        leesV4().every(x => x.rv === undefined && x.rvK === undefined),
        'geen rv, geen rvK',
        leesV4().map(x => 'rv=' + x.rv + '/rvK=' + x.rvK).join(' '));
    eis('T7c de V5-emmer is weer verdwenen',
        !bestaatV5('N', 'W'), 'geen sleutel', 'sleutel bestaat nog');
    eis('T7d en alle drie tellen weer volledig bij Algemeen',
        zonderRichtingVerwant(leesV4()).length === 3, '3',
        String(zonderRichtingVerwant(leesV4()).length));

    // ══ T8 — HET BESTAANDE PAD IS ONGEWIJZIGD ════════════════
    // Richting -> Algemeen (release 1) en richting -> richting (V11.16.2).
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(30, 3, { rv: 1, rvK: 'N_W' })]));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(30, 3)]));
    voerMergeUit('N>W', 'ALG');
    eis('T8 richting naar Algemeen ontstempelt nog steeds en ruimt de emmer op',
        leesV4()[0].rv === undefined && !bestaatV5('N', 'W'),
        'geen rv, geen V5', 'rv=' + leesV4()[0].rv + ', V5 ' + bestaatV5('N', 'W'));
    wis();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(30, 3)]));
    zetLS('sl_v5_' + NODE + '_Z_O_' + DD_NU, JSON.stringify([v5(40, 4)]));
    voerMergeUit('N>W', 'Z>O');
    eis('T8b richting naar richting voegt de emmers nog steeds samen',
        leesV5('Z', 'O').length === 2 && !bestaatV5('N', 'W'),
        '2 in Z>O, N>W weg',
        leesV5('Z', 'O').length + ' in Z>O, N>W ' + (bestaatV5('N', 'W') ? 'bestaat' : 'weg'));
    eis('T8c en raakt V4 daarbij niet aan',
        leesV4().length === 0, 'geen V4-wijziging', String(leesV4().length));

    // ══ T9 — DE POORT EN DE DIALOOG ══════════════════════════
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3), v4(55, 4)]));
    eis('T9 telAlgemeenVerplaatsbaar telt wat er zou verhuizen',
        telAlgemeenVerplaatsbaar(NODE) === 2, '2', String(telAlgemeenVerplaatsbaar(NODE)));
    // Beide kanten staan in de dialoog zodra Algemeen data heeft.
    mergeSelectie = ['ALG', 'N>W'];
    toonMergeDialoog();
    const dlg = document.getElementById('node-info-mergedialoog');
    // Via getAttribute en niet via innerHTML: daar wordt de '>' in 'N>W' als
    // &gt; teruggegeven, en dan toetst de regex iets anders dan wat de knop doet.
    const acties = () => [...dlg.querySelectorAll('button')]
      .map(b => b.getAttribute('onclick') || '');
    const heeft = (a) => acties().some(x => x.indexOf(a) >= 0);
    eis('T9b de dialoog biedt beide richtingen aan',
        heeft("voerMergeUit('N>W','ALG')") && heeft("voerMergeUit('ALG','N>W')"),
        'twee knoppen, beide kanten op', acties().join(' | '));
    eis('T9c en noemt het aantal dat zou verhuizen',
        dlg.innerHTML.indexOf('2 algemene metingen') >= 0,
        "'2 algemene metingen'", dlg.textContent.slice(0, 120));
    // Is er niets te verplaatsen, dan verdwijnt die knop en zegt de dialoog waarom.
    zetLS('sl_v4_' + NODE + '_' + DD_NU,
          JSON.stringify([v4(60, 3, { rv: 1, rvK: 'Z_O' })]));
    toonMergeDialoog();
    eis('T9d zonder algemene metingen verschijnt de knop niet',
        !heeft("voerMergeUit('ALG','N>W')"),
        'geen knop naar de richting', acties().join(' | '));
    eis('T9e en de dialoog legt uit waarom',
        dlg.textContent.indexOf('Andersom kan hier niet') >= 0,
        'uitleg aanwezig', dlg.textContent.slice(0, 120));
    eis('T9f de andere kant blijft wel beschikbaar',
        heeft("voerMergeUit('N>W','ALG')"),
        'naar-Algemeen blijft', acties().join(' | '));
    // Onzinnige combinaties worden geweigerd zonder iets aan te raken.
    //
    // De tweede is geen theorie. Tot en met V11.17.94 liet voerMergeUit
    // bron === doel gewoon door, en dan draaide mergeRichtingen de emmer op
    // zichzelf: samen = doel.concat(bron) wegschrijven naar doelKey, daarna
    // removeItem(bronKey) — dezelfde sleutel. Gemeten op V11.17.94: een emmer
    // met één meting was daarna weg. De UI bood die combinatie niet aan, dus
    // hij is nooit afgegaan, maar de poort van deze release sluit hem.
    wis();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 3)]));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify([v5(30, 2)]));
    const voorOnzinV4 = localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU);
    const voorOnzinV5 = localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU);
    voerMergeUit('ALG', 'ALG');
    voerMergeUit('N>W', 'N>W');
    voerMergeUit('', 'N>W');
    voerMergeUit('N>W', '');
    eis('T9g bron en doel gelijk verandert niets',
        localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) === voorOnzinV4
        && mergeUndoBuffer === null,
        'onveranderd, geen buffer',
        localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) === voorOnzinV4 ? 'onveranderd' : 'GEWIJZIGD');
    eis('T9h en wist de emmer niet die hij op zichzelf zou samenvoegen',
        localStorage.getItem('sl_v5_' + NODE + '_N_W_' + DD_NU) === voorOnzinV5,
        '1 meting, ongewijzigd',
        bestaatV5('N', 'W') ? (leesV5('N', 'W').length + ' metingen') : 'EMMER WEG');

    // ══ T10 — MEERDERE DAGDELEN ══════════════════════════════
    // De V5-kopie hoort in HETZELFDE dagdeel als het V4-record.
    wis();
    const anderDd = Object.keys(DD).find(d => d !== DD_NU);
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([v4(60, 2)]));
    zetLS('sl_v4_' + NODE + '_' + anderDd, JSON.stringify([v4(90, 3)]));
    voerMergeUit('ALG', 'N>W');
    eis('T10 elk dagdeel krijgt zijn eigen V5-emmer',
        leesV5('N', 'W', DD_NU).length === 1 && leesV5('N', 'W', DD_NU)[0].duur === 60
        && leesV5('N', 'W', anderDd).length === 1 && leesV5('N', 'W', anderDd)[0].duur === 90,
        '60s in ' + DD_NU + ', 90s in ' + anderDd,
        leesV5('N', 'W', DD_NU).map(x => x.duur) + ' / ' + leesV5('N', 'W', anderDd).map(x => x.duur));
    eis('T10b en beide V4-emmers zijn gestempeld',
        leesV4(DD_NU)[0].rvK === 'N_W' && leesV4(anderDd)[0].rvK === 'N_W',
        "beide rvK 'N_W'",
        leesV4(DD_NU)[0].rvK + ' / ' + leesV4(anderDd)[0].rvK);

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    nodeInfoNodeId = bewaard.nodeInfoNodeId;
    mergeModusAan = bewaard.mergeModusAan;
    mergeSelectie = bewaard.mergeSelectie;
    mergeUndoBuffer = bewaard.mergeUndoBuffer;
    nodeInfoChipLaatsteNode = bewaard.nodeInfoChipLaatsteNode;
    const info = document.getElementById('node-info-body');
    if (info && bewaard.infoHtml != null) info.innerHTML = bewaard.infoHtml;
    const dlg = document.getElementById('node-info-mergedialoog');
    if (dlg) { dlg.innerHTML = bewaard.dlgHtml || ''; dlg.style.display = bewaard.dlgDisp || 'none'; }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testMergeAlgBron = testMergeAlgBron;
