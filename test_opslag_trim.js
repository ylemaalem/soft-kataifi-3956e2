// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_opslag_trim.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.20 — opslag fase 1: logs trimmen.
//
//  WAT DEZE RELEASE DOET, EN WAT ZE NADRUKKELIJK NIET DOET.
//  localStorage loopt tegen het 5 MB-plafond. De noodrem in
//  checkLocalStorageRuimte begint bij 4 MB en gaat in pas 5 LEERDATA
//  halveren: sl_v4_-emmers ouder dan 180 dagen. Deze release koopt tijd door
//  uitsluitend DIAGNOSTIEK op te ruimen, zodat die noodrem niet hoeft te
//  vuren voordat de IndexedDB-migratie (fase 2-5) er is.
//
//  DE HARDE GRENS die deze suite bewaakt: geen enkele leerdata-sleutel wordt
//  aangeraakt. sl_v4_, sl_v5_, sl_klok_ en sl_passief_ komen er ongeschonden
//  doorheen — byte voor byte, niet 'ongeveer'. R1 t/m R3 doen dat.
//
//  T1  MAX_OPSLAGLOG staat op 150 en het log knipt zichzelf daarop
//  T2  trimDiagnostiekLogs knipt een te lang log terug naar zijn cap
//  T3  ... en laat een log dat al onder de cap zit met rust
//  T4  ... en wist een onleesbaar log niet, maar laat het staan
//  T5  ruimRedundantePosCache haalt alleen bron:'osm' weg
//  T6  ... en laat een onleesbare sl_pos_-sleutel staan
//  T7  trimDiagnostiekV1 draait één keer en zet zijn vlag
//  T8  ... en doet niets meer zodra de vlag staat
//  T9  de meetdata-export wist sl_schaduwlog, en alleen die
//  R1  REGRESSIE: geen leerdata-sleutel verandert door de trim
//  R2  REGRESSIE: voerOpruimPassenUit gebruikt nog steeds dezelfde pas 4
//  R3  REGRESSIE: de trim raakt pas 5 (sl_v4_ halveren) niet aan
//  W1  de winst, gemeten met berekenLocalStorageKB vóór en na
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_opslag_trim.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testOpslagTrim().regels);
// ═══════════════════════════════════════════════════════════════

function testOpslagTrim() {
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

  const nu = Date.now();
  const NODE = 995001;

  // Een logrecord in de vorm die logOpslagMis schrijft — alleen de velden die
  // deze suite nodig heeft; de trim kijkt uitsluitend naar de LENGTE.
  const logrecs = (n) => Array.from({ length: n }, (_, i) =>
    ({ t: nu - i * 1000, reden: 'test', node: String(NODE), volg: i }));

  // De vier leerdata-soorten die deze release met geen mogelijkheid mag raken.
  const LEERSLEUTELS = {
    ['sl_v4_' + NODE + '_dag']: JSON.stringify(
      [{ duur: 45, tijd: nu, richting: 0, obs: 45, gewicht: 1, bron: 's1' }]),
    ['sl_v5_' + NODE + '_N_W_dag']: JSON.stringify(
      [{ duur: 45, tijd: nu, gewicht: 1, bron: 'tik', tb: 1 }]),
    ['sl_klok_' + NODE]: JSON.stringify({ offset: 12, n: 3 }),
    ['sl_passief_' + NODE]: JSON.stringify([{ duur: 30, tijd: nu }])
  };
  // Nadrukkelijk óók een oude sl_v4_-emmer: dat is precies wat pas 5 van
  // voerOpruimPassenUit zou halveren. Als de trim ooit die kant op glijdt,
  // valt R3 om.
  const OUD_V4 = 'sl_v4_' + (NODE + 1) + '_dag';
  const OUD_V4_WAARDE = JSON.stringify(Array.from({ length: 6 }, (_, i) =>
    ({ duur: 40 + i, tijd: nu - 200 * 86400000 - i * 1000, gewicht: 1, bron: 's1' })));

  const zetLeerdata = () => {
    for (const [k, v] of Object.entries(LEERSLEUTELS)) zetLS(k, v);
    zetLS(OUD_V4, OUD_V4_WAARDE);
  };
  const leerdataOngeschonden = () => {
    const fout = [];
    for (const [k, v] of Object.entries(LEERSLEUTELS)) {
      if (localStorage.getItem(k) !== v) fout.push(k);
    }
    if (localStorage.getItem(OUD_V4) !== OUD_V4_WAARDE) fout.push(OUD_V4 + ' (oud)');
    return fout;
  };

  // De logsleutels die deze suite aanraakt, plus de vlag.
  const LOGS = ['sl_opslaglog', 'sl_schaduwlog', 'sl_richtinglog',
                'sl_herzieninglog', 'sl_zichtlog', 'sl_detlog', 'sl_conflog'];
  const wisAlles = () => {
    for (const k of LOGS) zetLS(k, null);
    zetLS('sl_trimv1', null);
    for (const k of Object.keys(LEERSLEUTELS)) zetLS(k, null);
    zetLS(OUD_V4, null);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_pos_' + NODE)) zetLS(k, null);
    }
  };

  try {
    // ══ T1 — DE CAP ZELF ══════════════════════════════════════
    eis('T1 MAX_OPSLAGLOG staat op 150 (was 500)',
        MAX_OPSLAGLOG === 150, '150', String(MAX_OPSLAGLOG));
    wisAlles();
    zetLS('sl_opslaglog', JSON.stringify(logrecs(MAX_OPSLAGLOG)));
    logOpslagMis('test_cap', { node: NODE });
    const naSchrijf = JSON.parse(localStorage.getItem('sl_opslaglog'));
    eis('T1b en de schrijver knipt zichzelf op die cap',
        naSchrijf.length === MAX_OPSLAGLOG, String(MAX_OPSLAGLOG), String(naSchrijf.length));
    eis('T1c waarbij het NIEUWSTE record bewaard blijft en het oudste wijkt',
        naSchrijf[naSchrijf.length - 1].reden === 'test_cap',
        'laatste record is de nieuwe', naSchrijf[naSchrijf.length - 1].reden);

    // ══ T2 — DE TERUGWERKENDE TRIM ════════════════════════════
    // Dit is de kern van de release: een verlaagde cap doet pas iets bij de
    // volgende schrijving. Een log van 500 records blijft dus op 500 staan —
    // en juist dan kan de 4 MB-noodrem al gevuurd hebben.
    wisAlles();
    zetLS('sl_opslaglog', JSON.stringify(logrecs(500)));
    zetLS('sl_detlog', JSON.stringify(logrecs(640)));
    const weg = trimDiagnostiekLogs();
    const opslagNa = JSON.parse(localStorage.getItem('sl_opslaglog'));
    eis('T2 een log van 500 wordt teruggeknipt naar MAX_OPSLAGLOG',
        opslagNa.length === MAX_OPSLAGLOG && weg['sl_opslaglog'] === 500 - MAX_OPSLAGLOG,
        MAX_OPSLAGLOG + ' records, ' + (500 - MAX_OPSLAGLOG) + ' weg',
        opslagNa.length + ' records, ' + weg['sl_opslaglog'] + ' weg');
    eis('T2b en het knipt de OUDSTE weg, niet de nieuwste',
        opslagNa[0].volg === 500 - MAX_OPSLAGLOG && opslagNa[opslagNa.length - 1].volg === 499,
        'volg ' + (500 - MAX_OPSLAGLOG) + '..499',
        'volg ' + opslagNa[0].volg + '..' + opslagNa[opslagNa.length - 1].volg);
    eis('T2c elk log leest zijn EIGEN cap, niet die van het opslaglog',
        JSON.parse(localStorage.getItem('sl_detlog')).length === MAX_DETLOG,
        String(MAX_DETLOG),
        String(JSON.parse(localStorage.getItem('sl_detlog')).length));

    // ══ T3 — ONDER DE CAP BLIJFT ONAANGERAAKT ═════════════════
    wisAlles();
    const kort = JSON.stringify(logrecs(12));
    zetLS('sl_richtinglog', kort);
    const weg3 = trimDiagnostiekLogs();
    eis('T3 een log onder zijn cap blijft byte-identiek',
        localStorage.getItem('sl_richtinglog') === kort && weg3['sl_richtinglog'] === undefined,
        'onveranderd, niet in het verslag',
        localStorage.getItem('sl_richtinglog') === kort ? 'onveranderd' : 'GEWIJZIGD');

    // ══ T4 — ONLEESBAAR ≠ WEGGOOIEN ═══════════════════════════
    // Dezelfde terughoudendheid als de sl_pos_-pas: bij twijfel niets doen.
    wisAlles();
    zetLS('sl_zichtlog', '{kapot');
    trimDiagnostiekLogs();
    eis('T4 een onleesbaar log blijft staan in plaats van gewist te worden',
        localStorage.getItem('sl_zichtlog') === '{kapot',
        '{kapot', String(localStorage.getItem('sl_zichtlog')));

    // ══ T5 — DE POSITIECACHE ══════════════════════════════════
    wisAlles();
    zetLS('sl_pos_' + NODE + '1', JSON.stringify({ lat: 52, lon: 5, bron: 'osm' }));
    zetLS('sl_pos_' + NODE + '2', JSON.stringify({ lat: 52, lon: 5, bron: 'osm' }));
    zetLS('sl_pos_' + NODE + '3', JSON.stringify({ lat: 52, lon: 5, tijd: nu }));   // eigen
    const posWeg = ruimRedundantePosCache();
    eis('T5 alleen de records met bron osm verdwijnen',
        posWeg === 2 && localStorage.getItem('sl_pos_' + NODE + '1') === null
          && localStorage.getItem('sl_pos_' + NODE + '3') !== null,
        '2 weg, de eigen blijft',
        posWeg + ' weg, eigen ' + (localStorage.getItem('sl_pos_' + NODE + '3') ? 'staat' : 'WEG'));

    // ══ T6 — ONLEESBARE POSITIE BLIJFT ════════════════════════
    wisAlles();
    zetLS('sl_pos_' + NODE + '4', 'geen json');
    ruimRedundantePosCache();
    eis('T6 een onleesbare sl_pos_-sleutel blijft staan (bij twijfel niets)',
        localStorage.getItem('sl_pos_' + NODE + '4') === 'geen json',
        'geen json', String(localStorage.getItem('sl_pos_' + NODE + '4')));

    // ══ T7 — DE EENMALIGE PAS ═════════════════════════════════
    wisAlles();
    zetLeerdata();
    zetLS('sl_opslaglog', JSON.stringify(logrecs(500)));
    zetLS('sl_pos_' + NODE + '5', JSON.stringify({ lat: 52, lon: 5, bron: 'osm' }));
    trimDiagnostiekV1();
    const log7 = JSON.parse(localStorage.getItem('sl_opslaglog'));
    eis('T7 trimDiagnostiekV1 zet zijn vlag',
        localStorage.getItem('sl_trimv1') === 'done',
        'done', String(localStorage.getItem('sl_trimv1')));
    eis('T7b en doet het werk: log geknipt, osm-positie weg',
        log7.length <= MAX_OPSLAGLOG && localStorage.getItem('sl_pos_' + NODE + '5') === null,
        '<=' + MAX_OPSLAGLOG + ' records, positie weg',
        log7.length + ' records, positie ' + (localStorage.getItem('sl_pos_' + NODE + '5') ? 'STAAT' : 'weg'));
    eis('T7c en laat een regel achter die vertelt wat het opleverde',
        log7.some(r => r.reden === 'trim_v1'),
        'een trim_v1-regel',
        log7.filter(r => r.reden === 'trim_v1').length + ' regels');

    // ══ R1 — DE HARDE GRENS ═══════════════════════════════════
    const geschonden = leerdataOngeschonden();
    eis('R1 geen enkele leerdata-sleutel is door de trim veranderd',
        geschonden.length === 0, 'sl_v4_/sl_v5_/sl_klok_/sl_passief_ onaangeroerd',
        geschonden.length ? geschonden.join(' | ') : 'alle vier byte-identiek');

    // ══ T8 — TWEEDE KEER: NIETS ═══════════════════════════════
    zetLS('sl_pos_' + NODE + '6', JSON.stringify({ lat: 52, lon: 5, bron: 'osm' }));
    zetLS('sl_opslaglog', JSON.stringify(logrecs(400)));
    trimDiagnostiekV1();
    eis('T8 met de vlag gezet doet de pas niets meer',
        localStorage.getItem('sl_pos_' + NODE + '6') !== null
          && JSON.parse(localStorage.getItem('sl_opslaglog')).length === 400,
        'positie staat, log nog 400',
        (localStorage.getItem('sl_pos_' + NODE + '6') ? 'positie staat' : 'positie WEG')
          + ', log ' + JSON.parse(localStorage.getItem('sl_opslaglog')).length);

    // ══ R3 — PAS 5 BLIJFT BUITEN BEELD ════════════════════════
    // De trim mag nooit de sl_v4_-halvering van voerOpruimPassenUit doen. Dat
    // wordt hier twee keer getoetst: op gedrag (de oude emmer is intact, zie
    // R1) en op de broncode, want een latere uitbreiding zou het gedrag pas
    // laten omvallen als er toevallig een oude emmer in de fixture staat.
    const bronTrim = String(trimDiagnostiekV1) + String(trimDiagnostiekLogs)
                   + String(ruimRedundantePosCache);
    eis('R3 de trim noemt geen enkele leerdata-prefix in zijn broncode',
        !/sl_v4_|sl_v5_|sl_klok_|sl_passief_|sl_s2_/.test(bronTrim),
        'geen leerdata-prefix', 'schoon');
    eis('R3b en 180 dagen / halveren komt er niet in voor',
        !/180|helft|Math\.ceil\(data\.length/.test(bronTrim),
        'geen halveringslogica', 'schoon');

    // ══ R2 — PAS 4 IS DEZELFDE GEBLEVEN ═══════════════════════
    eis('R2 voerOpruimPassenUit draait pas 4 via de gedeelde functie',
        /ruimRedundantePosCache\(\)/.test(String(voerOpruimPassenUit)),
        'roept ruimRedundantePosCache aan',
        /ruimRedundantePosCache\(\)/.test(String(voerOpruimPassenUit)) ? 'ja' : 'NEE');
    eis('R2b en heeft er geen tweede kopie van de lus naast staan',
        (String(voerOpruimPassenUit).match(/bron === 'osm'/g) || []).length === 0,
        'geen losse kopie',
        (String(voerOpruimPassenUit).match(/bron === 'osm'/g) || []).length + ' kopie(en)');

    // ══ T9 — SCHADUWLOG WISSEN NA EXPORT ══════════════════════
    // De export zelf draait hier niet (die deelt of downloadt een bestand);
    // getoetst wordt dat de wisser bestaat, precies één sleutel noemt, en dat
    // het schaduwlog wel degelijk in die export meegaat.
    const bronExp = String(exporteerMeetdata);
    const wisRegels = bronExp.match(/removeItem\('([^']+)'\)/g) || [];
    eis('T9 de meetdata-export wist sl_schaduwlog na afloop',
        wisRegels.length === 1 && wisRegels[0] === "removeItem('sl_schaduwlog')",
        "alleen removeItem('sl_schaduwlog')",
        wisRegels.join(' | ') || 'GEEN');
    eis('T9b en het log gaat in diezelfde export wel degelijk mee',
        /sl_schaduwlog'\)\s*doel = uit\.schaduw/.test(bronExp.replace(/\s+/g, ' '))
          || /uit\.schaduw/.test(bronExp),
        'uit.schaduw wordt gevuld', /uit\.schaduw/.test(bronExp) ? 'ja' : 'NEE');
    eis('T9c en wissen gebeurt pas na een GESLAAGDE export, niet bij afbreken',
        /AbortError'\) \{ herstelBtn\(\); return; \}/.test(bronExp),
        'AbortError keert terug zonder te wissen',
        /AbortError/.test(bronExp) ? 'afbreektak aanwezig' : 'ONTBREEKT');

    // ══ W1 — DE WINST, GEMETEN ════════════════════════════════
    wisAlles();
    zetLeerdata();
    zetLS('sl_opslaglog', JSON.stringify(logrecs(500)));
    for (let i = 0; i < 40; i++) {
      zetLS('sl_pos_' + NODE + '_w' + i, JSON.stringify({ lat: 52.1, lon: 5.1, bron: 'osm' }));
    }
    const kbVoor = berekenLocalStorageKB();
    ruimRedundantePosCache();
    trimDiagnostiekLogs();
    const kbNa = berekenLocalStorageKB();
    eis('W1 de trim levert meetbaar ruimte op',
        kbNa < kbVoor, 'minder dan ' + kbVoor + 'KB', kbNa + 'KB (−' + (kbVoor - kbNa) + 'KB)');
    const geschonden2 = leerdataOngeschonden();
    eis('W1b en de leerdata staat er ná de meting nog precies zo',
        geschonden2.length === 0, 'onaangeroerd',
        geschonden2.length ? geschonden2.join(' | ') : 'byte-identiek');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testOpslagTrim = testOpslagTrim;
