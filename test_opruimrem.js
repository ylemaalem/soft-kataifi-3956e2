// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_opruimrem.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.29.0 (de opruimrem laat zien wat hij doet) en V11.30.0 (pas 5
//  staat uit tot fase 3).
//
//  HOE DEZE TEST TOT STAND KWAM
//  OR0 is eerst geschreven op de ongewijzigde V11.28.0 en was daar 7 van 7
//  groen. In V11.29.0 bleef hij groen: die release telt alleen. In V11.30.0
//  slaat hij om. Hieronder staat OR0 omgedraaid: de juiste waarde, én de eis
//  dat het niet meer de oude is. De oude uitkomsten staan als OUD_* in de code.
//
//  OR0a  een emmer waarvan de nieuwste meting 181 dagen oud is, blijft na vier
//        vuringen 10 records (was 10 -> 5 -> 3 -> 2 -> 1)
//  OR0b  een geschikte emmer met 1 record wordt niet meer herschreven (was bij
//        elke vuring), een verse emmer nooit
//  OR0c  de echte meting blijft staan (ging vroeger als eerste weg, vóór de
//        lege S2-markeringen)
//  OR0d  boven 4,0 MiB vuurt checkLocalStorageRuimte bij elke aanroep, eronder
//        niet (getuige: een sl_pos_ met bron osm, pas 4) - ongewijzigd
//
//  OL1   op een fixture waarin alle zeven passen iets te doen hebben, zijn alle
//        sleutels behalve sl_v4_ byte-gelijk aan een letterlijke kopie van
//        V11.28.0, en blijft elke sl_v4_ precies zoals hij was (OL1b: ook via
//        de grens)
//  OL2   de telling per pas klopt met wat er echt veranderde
//  OL3   sl_opruimstat telt op over vuringen, met p5geschiktNu als momentopname
//  OL4   een 'opruim'-regel alleen bij de eerste vuring van een sessie en als
//        pas 5 echt halveerde (dat gebeurt nu niet meer); nullen gaan niet mee;
//        andere regels krijgen het veld niet
//  OL5   de knop: "zeven passen", een eerlijke schatting, pas 5 "staat uit",
//        telling in de uitslag, en een regel met bron 'knop'
//  OL6   de teller gaat mee in de meetdata-export en niet terug via de import
//  OR2   haal de schakelregel uit voerOpruimPassenUit en de rest is byte-gelijk
//        aan V11.29.0: de schakelaar is de enige wijziging
//  OR3   de schakelaar staat uit
//
//  DE PASSEN WERKEN OP ALLE SLEUTELS. Pas 4 zou dus ook de osm-posities van
//  deze testpagina wissen. Daarom bewaart de suite eerst de hele opslag, haalt
//  die sleutel voor sleutel weg (removeItem en niet clear(): de omwikkeling van
//  V11.24.0 ziet clear() niet), en zet na afloop alles exact terug.
// ═══════════════════════════════════════════════════════════════

async function testOpruimrem() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const DAG = 86400000;
  const echtNu = Date.now;
  const NU = Date.parse('2026-10-01T12:00:00Z');
  // De uitkomsten van V11.28.0 en V11.29.0, zoals OR0 ze vastlegde.
  const OUD_OR0A = '5>3>2>1', OUD_OR0B = 3, OUD_OR0C = 2;
  // voerOpruimPassenUit van V11.29.0: FNV-1a over String(fn), en de lengte.
  const V11290_OPRUIM = ['f3d3e4a7', 5427];
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const alleSleutels = () => { const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); return ks; };
  const leeg = () => { for (const k of alleSleutels()) localStorage.removeItem(k); };
  const bewaard = alleSleutels().map(k => [k, localStorage.getItem(k)]);
  const bewaardSessie = opruimGelogdDezeSessie;
  const echtConfirm = window.confirm, echtAlert = window.alert;

  // Een gewone meting en een lege S2-markering van vóór V11.2.0, allebei in
  // de vorm waarin ze in de exports staan.
  const meting = (dagen, duur, i = 0) => ({ duur, tijd: NU - dagen * DAG - i * 1000, richting: 90, obs: duur, gewicht: 0.5, bron: 's1' });
  const markering = (dagen, i = 0) => ({ duur: 0, tijd: NU - dagen * DAG - i * 1000, richting: 90, s2: true, gewicht: 0.3, kleur: 'rood' });
  const zet = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const telSchrijvingen = (fn) => {
    const orig = Storage.prototype.setItem, per = {};
    Storage.prototype.setItem = function (k, v) { per[k] = (per[k] || 0) + 1; return orig.call(this, k, v); };
    try { fn(); } finally { Storage.prototype.setItem = orig; }
    return per;
  };
  const momentopname = (behalve = []) => {
    const o = {};
    for (const k of alleSleutels().sort()) if (!behalve.includes(k)) o[k] = localStorage.getItem(k);
    return JSON.stringify(o);
  };
  // 2.100.000 tekens is 4,01 MiB in UTF-16, de eenheid van de grens. Geen
  // sl_-sleutel: de spiegel van V11.24.0 hoeft geen 4 MiB mee te schrijven.
  const ballast = (aan) => { if (aan) localStorage.setItem('or_ballast', 'x'.repeat(2100000)); else localStorage.removeItem('or_ballast'); };
  const opruimRegels = () => (lees('sl_opslaglog') || []).filter(r => r && r.reden === 'opruim');

  // voerOpruimPassenUit van V11.28.0, letterlijk (commentaar weggelaten).
  // Alleen voor OL1: de nieuwe mag niets anders doen dan deze.
  function oudeOpruim() {
    try {
        const nu = Date.now();
        const DAG_MS = 86400000;
        for (const key of opslagSleutels('sl_route_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            const recentste = data.length ? Math.max(...data.map(x => x.timestamp || 0)) : 0;
            if (nu - recentste > 30 * DAG_MS) localStorage.removeItem(key);
          } catch(e) { localStorage.removeItem(key); }
        }
        for (const key of opslagSleutels('')) {
          if (!key.includes('_rood_partieel')) continue;
          try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            const recentste = data.length ? Math.max(...data.map(x => x.tijd || 0)) : 0;
            if (nu - recentste > 60 * DAG_MS) localStorage.removeItem(key);
          } catch(e) { localStorage.removeItem(key); }
        }
        for (const key of opslagSleutels('')) {
          if (!key.includes('_bezoek')) continue;
          try {
            const b = JSON.parse(localStorage.getItem(key) || '{}');
            if ((b.groen||0) + (b.oranje||0) + (b.rood||0) === 0) localStorage.removeItem(key);
          } catch(e) { localStorage.removeItem(key); }
        }
        ruimRedundantePosCache();
        for (const key of opslagSleutels('sl_v4_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '[]');
            if (!Array.isArray(data) || !data.length) continue;
            const recentste = Math.max(...data.map(x => x.tijd || 0));
            if (nu - recentste > 180 * DAG_MS) {
              const helft = Math.ceil(data.length / 2);
              const behouden = data.sort((a,b) => (b.tijd||0) - (a.tijd||0)).slice(0, helft);
              localStorage.setItem(key, JSON.stringify(behouden));
            }
          } catch(e) {}
        }
        for (const key of opslagSleutels('sl_v3_')) localStorage.removeItem(key);
        for (const key of opslagSleutels('sl_s2_')) {
          try {
            const arr = JSON.parse(localStorage.getItem(key) || '[]');
            if (Array.isArray(arr) && arr.length > 5) {
              arr.sort((a,b)=>gew(b.tijd)-gew(a.tijd));
              localStorage.setItem(key, JSON.stringify(arr.slice(0,5)));
            }
          } catch(e) { localStorage.removeItem(key); }
        }
        } catch(e) {}
  }
  // checkLocalStorageRuimte van V11.28.0, met de kopie hierboven.
  function oudeGrens() {
    let totaal = 0;
    for (const key of opslagSleutels('')) totaal += (opslagLeesRuw(key) || '').length * 2;
    if (totaal / (1024 * 1024) > 4.0) oudeOpruim();
  }

  // Een fixture waarin elke pas iets te doen heeft, en iets om te laten staan.
  const fixtuur = () => {
    zet('sl_route_996101_996102_996103', [{ tijden: [40, 8, 11], totaal: 60, timestamp: NU - 40 * DAG, dd: 'dag' }]);
    zet('sl_route_996104_996105_996106', [{ tijden: [40, 8, 11], totaal: 60, timestamp: NU - 5 * DAG, dd: 'dag' }]);
    zet('sl_route_996107_996108_996109', '{kapot');
    zet('sl_v10_996110_dag_rood_partieel', [{ tijd: NU - 70 * DAG, duur: 20 }]);
    zet('sl_v10_996111_dag_rood_partieel', [{ tijd: NU - 5 * DAG, duur: 20 }]);
    zet('sl_v10_996112_dag_bezoek', { groen: 0, oranje: 0, rood: 0 });
    zet('sl_v10_996113_dag_bezoek', { groen: 1, oranje: 0, rood: 2 });
    zet('sl_pos_996120', { lat: 52.1, lon: 5.3, bron: 'osm', tijd: NU });
    zet('sl_pos_996121', { lat: 52.1, lon: 5.3, tijd: NU - 3 * DAG });
    // 6 echte metingen (nieuwst) en 4 lege markeringen (oudst): halveren houdt
    // de 5 nieuwste en haalt 1 echte meting en de 4 markeringen weg.
    zet('sl_v4_996130_dag', [0, 1, 2, 3, 4, 5].map(i => meting(181 + i, 40 + i))
                              .concat([6, 7, 8, 9].map(i => markering(181 + i))));
    zet('sl_v4_996131_nacht', [meting(200, 30)]);
    zet('sl_v4_996132_avond', [meting(3, 30), meting(4, 31), meting(5, 32)]);
    zet('sl_v4_996133_dag_groen', [0, 1, 2, 3].map(i => ({ duur: 20 + i, tijd: NU - (190 + i) * DAG })));
    zet('sl_v3_996140_dag', [{ duur: 30, tijd: NU }]);
    zet('sl_s2_996150', Array.from({ length: 8 }, (_, i) => ({ tijd: NU - i * DAG, dd: 'dag' })));
    zet('sl_s2_996151', '{kapot');
    zet('sl_s2_996152', [{ tijd: NU, dd: 'dag' }, { tijd: NU - DAG, dd: 'dag' }, { tijd: NU - 2 * DAG, dd: 'dag' }]);
    zet('or_vreemd', 'blijft');
  };

  try {
    Date.now = () => NU;

    // ══ OR0a — HERHAALD HALVEREN ══════════════════════════════
    leeg();
    const A = 'sl_v4_996001_dag';
    const a0 = Array.from({ length: 10 }, (_, i) => meting(181 + i, 40 + i));
    zet(A, a0);
    const lengtes = [];
    for (let i = 0; i < 4; i++) { voerOpruimPassenUit(); lengtes.push((lees(A) || []).length); }
    eis('OR0a na vier vuringen staan er nog alle 10', lengtes.join('>') === '10>10>10>10' && lengtes.join('>') !== OUD_OR0A,
        '10>10>10>10 (was ' + OUD_OR0A + ')', lengtes.join('>'));
    eis('OR0a2 en de emmer is byte-gelijk aan wat er stond', localStorage.getItem(A) === JSON.stringify(a0),
        'onveranderd', localStorage.getItem(A) === JSON.stringify(a0) ? 'onveranderd' : 'GEWIJZIGD');

    // ══ OR0b — HERSCHRIJVEN ZONDER VERANDERING ════════════════
    leeg();
    const B = 'sl_v4_996002_nacht', BV = 'sl_v4_996002_dag';
    zet(B, [meting(200, 30)]);
    zet(BV, [meting(10, 30)]);
    const perB = telSchrijvingen(() => { for (let i = 0; i < 3; i++) voerOpruimPassenUit(); });
    eis('OR0b een geschikte emmer met 1 record wordt niet meer herschreven', (perB[B] || 0) === 0 && (perB[B] || 0) !== OUD_OR0B,
        '0 schrijvingen (was ' + OUD_OR0B + ')', String(perB[B] || 0));
    eis('OR0b2 een verse emmer wordt nooit herschreven', !perB[BV], '0', String(perB[BV] || 0));

    // ══ OR0c — DE ECHTE METING GAAT ALS EERSTE ════════════════
    leeg();
    const C = 'sl_v4_996003_avond';
    zet(C, [meting(200, 40), markering(190), markering(189), markering(188)]);
    voerOpruimPassenUit();
    const c1 = lees(C) || [];
    eis('OR0c de echte meting blijft staan, met de drie markeringen',
        c1.length === 4 && c1.length !== OUD_OR0C && c1.filter(x => x.duur > 0).length === 1,
        '4 records, 1 met duur > 0 (was ' + OUD_OR0C + ' records, 0 echt)',
        c1.length + ' records, ' + c1.filter(x => x.duur > 0).length + ' met duur > 0');

    // ══ OR0d — DE GRENS ═══════════════════════════════════════
    leeg();
    const GETUIGE = 'sl_pos_996004';
    const getuige = () => zet(GETUIGE, { lat: 52.1, lon: 5.3, bron: 'osm', tijd: NU });
    getuige();
    checkLocalStorageRuimte();
    eis('OR0d onder 4,0 MiB vuurt de rem niet', localStorage.getItem(GETUIGE) !== null, 'getuige staat', localStorage.getItem(GETUIGE) ? 'staat' : 'WEG');
    ballast(true);
    checkLocalStorageRuimte();
    const eerste = localStorage.getItem(GETUIGE) === null;
    getuige();
    checkLocalStorageRuimte();
    const tweede = localStorage.getItem(GETUIGE) === null;
    ballast(false);
    eis('OR0d2 erboven vuurt hij bij elke aanroep', eerste && tweede, 'twee keer gevuurd',
        (eerste ? 'ja' : 'nee') + ', ' + (tweede ? 'ja' : 'nee'));

    // ══ OL1 — ALLES BEHALVE PAS 5 BYTE-GELIJK AAN V11.28.0 ════
    // sl_v4_ wordt apart vergeleken: met de invoer, niet met de oude uitkomst.
    const v4Sleutels = () => alleSleutels().filter(k => k.startsWith('sl_v4_'));
    leeg(); fixtuur();
    const v4Invoer = momentopname(alleSleutels().filter(k => !k.startsWith('sl_v4_')));
    oudeOpruim();
    const oud = momentopname(v4Sleutels());
    leeg(); fixtuur();
    const tel = voerOpruimPassenUit();
    const nieuw = momentopname(v4Sleutels());
    const nieuwV4 = momentopname(alleSleutels().filter(k => !k.startsWith('sl_v4_')));
    eis('OL1 alle sleutels behalve sl_v4_ byte-gelijk aan de kopie van V11.28.0', nieuw === oud,
        'gelijk', nieuw === oud ? 'gelijk' : 'VERSCHILT');
    eis('OR1 en elke sl_v4_-sleutel staat er precies zoals hij stond', nieuwV4 === v4Invoer,
        'onveranderd', nieuwV4 === v4Invoer ? 'onveranderd' : 'GEWIJZIGD');
    eis('OL1a en de functie zelf schrijft geen log of teller',
        localStorage.getItem('sl_opslaglog') === null && localStorage.getItem('sl_opruimstat') === null,
        'geen sl_opslaglog, geen sl_opruimstat',
        [localStorage.getItem('sl_opslaglog') ? 'log' : '', localStorage.getItem('sl_opruimstat') ? 'teller' : ''].join(' ') || 'geen');
    leeg(); fixtuur(); ballast(true); oudeGrens(); ballast(false);
    const oudG = momentopname(v4Sleutels());
    leeg(); fixtuur(); ballast(true); opruimGelogdDezeSessie = false; checkLocalStorageRuimte(); ballast(false);
    const nieuwG = momentopname(['sl_opslaglog', 'sl_opruimstat'].concat(v4Sleutels()));
    const nieuwGV4 = momentopname(alleSleutels().filter(k => !k.startsWith('sl_v4_')));
    eis('OL1b via de grens ook: op log, teller en sl_v4_ na byte-gelijk', nieuwG === oudG,
        'gelijk', nieuwG === oudG ? 'gelijk' : 'VERSCHILT');
    eis('OR1b en ook via de grens blijft elke sl_v4_ onveranderd', nieuwGV4 === v4Invoer,
        'onveranderd', nieuwGV4 === v4Invoer ? 'onveranderd' : 'GEWIJZIGD');

    // ══ OL2 — DE TELLING ══════════════════════════════════════
    const verwacht = { p1: 2, p2: 1, p3: 1, p4: 1, p5geschikt: 2, p5emmers: 0, p5weg: 0, p5echt: 0, p6: 1, p7weg: 3, p7kapot: 1 };
    const kreeg = {}; for (const k of Object.keys(verwacht)) kreeg[k] = tel[k];
    eis('OL2 elke pas telt wat hij deed; pas 5 telt alleen wat hij zou doen', JSON.stringify(kreeg) === JSON.stringify(verwacht),
        JSON.stringify(verwacht), JSON.stringify(kreeg));
    eis('OL2b er zijn geen gehalveerde emmers', Array.isArray(tel.emmers) && tel.emmers.length === 0,
        '[]', JSON.stringify(tel.emmers));
    const n1 = lees('sl_v4_996130_dag') || [];
    eis('OL2c de emmer met 6 echte metingen en 4 markeringen is heel',
        n1.length === 10 && n1.filter(x => x.duur > 0).length === 6, '10 records, 6 echt',
        n1.length + ' records, ' + n1.filter(x => x.duur > 0).length + ' echt');

    // ══ OL3 — DE TELLER ═══════════════════════════════════════
    leeg(); fixtuur(); ballast(true); opruimGelogdDezeSessie = false;
    checkLocalStorageRuimte(); checkLocalStorageRuimte();
    ballast(false);
    const st = lees('sl_opruimstat') || {};
    eis('OL3 twee vuringen, allebei automatisch', st.vuringen === 2 && st.auto === 2 && st.knop === 0,
        'vuringen 2, auto 2, knop 0', `vuringen ${st.vuringen}, auto ${st.auto}, knop ${st.knop}`);
    const pp = st.perPas || {};
    eis('OL3b per pas opgeteld: routes alleen de eerste keer, halveren nooit',
        pp.p1 === 2 && pp.p5emmers === 0 && pp.p5weg === 0,
        'p1 2, p5emmers 0, p5weg 0', `p1 ${pp.p1}, p5emmers ${pp.p5emmers}, p5weg ${pp.p5weg}`);
    eis('OL3d p5geschiktNu is een momentopname, geen som', st.p5geschiktNu === 2 && pp.p5geschikt === 4,
        'p5geschiktNu 2 (de som over twee vuringen is 4)', `p5geschiktNu ${st.p5geschiktNu}, som ${pp.p5geschikt}`);
    eis('OL3c sinds, laatste en de opslag erboven', st.sinds === NU && st.laatste === NU && st.kbVoor > 4096 && typeof st.kbNa === 'number',
        'sinds = laatste = nu, kbVoor > 4096', `sinds ${st.sinds === NU}, laatste ${st.laatste === NU}, kbVoor ${st.kbVoor}, kbNa ${st.kbNa}`);

    // ══ OL4 — WANNEER EEN REGEL ═══════════════════════════════
    leeg();
    zet('sl_pos_996160', { lat: 52.1, lon: 5.3, bron: 'osm', tijd: NU });
    ballast(true); opruimGelogdDezeSessie = false;
    checkLocalStorageRuimte(); checkLocalStorageRuimte(); checkLocalStorageRuimte();
    const na3 = opruimRegels();
    zet('sl_v4_996161_dag', [meting(181, 30), meting(182, 31), meting(183, 32), meting(184, 33)]);
    checkLocalStorageRuimte();
    ballast(false);
    const na4 = opruimRegels();
    eis('OL4 drie vuringen zonder halvering: één regel, de eerste van de sessie', na3.length === 1 && na3[0].opruim.bron === 'auto' && na3[0].opruim.p4 === 1,
        '1 regel, bron auto, p4 1', na3.length + ' regel(s)' + (na3[0] ? ', ' + JSON.stringify(na3[0].opruim) : ''));
    eis('OL4b een oude emmer geeft geen regel meer, want hij wordt niet gehalveerd',
        na4.length === 1 && (lees('sl_v4_996161_dag') || []).length === 4,
        '1 regel, emmer 4 records', na4.length + ' regels, emmer ' + (lees('sl_v4_996161_dag') || []).length);
    const r1 = na3[0] || {};
    eis('OL4c nullen gaan niet mee in de regel', r1.opruim && !('p6' in r1.opruim) && !('p1' in r1.opruim) && !('p5emmers' in r1.opruim),
        'geen p1/p6/p5emmers', JSON.stringify(r1.opruim));
    eis('OL4d de teller telde alle vier de vuringen', (lees('sl_opruimstat') || {}).vuringen === 4,
        '4', String((lees('sl_opruimstat') || {}).vuringen));
    logOpslagMis('te_kort', { node: 996162, dur: 2 });
    const laatste = (lees('sl_opslaglog') || []).slice(-1)[0] || {};
    eis('OL4e een gewone regel draagt het veld niet', laatste.reden === 'te_kort' && !('opruim' in laatste),
        'geen opruim-veld', Object.keys(laatste).includes('opruim') ? 'WEL' : 'schoon');

    // ══ OL5 — DE KNOP ═════════════════════════════════════════
    leeg(); fixtuur();
    // Een sl_v3_ van 12 KB (gaat zeker weg) en een verse route van 20 KB (blijft
    // staan). De oude schatting telde die route mee; de nieuwe niet.
    zet('sl_v3_996141_dag', 'y'.repeat(6000));
    zet('sl_route_996170_996171_996172', [{ tijden: [40], totaal: 40, timestamp: NU - DAG, dd: 'dag', pad: 'z'.repeat(10000) }]);
    const cats = opslagOverzicht();
    const verwachtKB = Math.round(cats.filter(r => /pas [46]\)/.test(r.naam)).reduce((s, r) => s + r.kb, 0));
    const oudKB = Math.round(cats.filter(r => /pas [1-4]|pas 6/.test(r.naam)).reduce((s, r) => s + r.kb, 0));
    let vraag = '', uitslag = '';
    window.confirm = (t) => { vraag = String(t); return true; };
    window.alert = (t) => { uitslag = String(t); };
    ruimOpslagNuOp();
    await new Promise(r => setTimeout(r, 50));
    window.confirm = echtConfirm; window.alert = echtAlert;
    eis('OL5 de vraag noemt zeven passen', /De zeven passen ruimen op:/.test(vraag) && !/zes passen/.test(vraag),
        'De zeven passen', (vraag.match(/De \w+ passen/) || ['?'])[0]);
    eis('OL5b de schatting telt alleen pas 4 en 6, niet de verse route', verwachtKB >= 10 && oudKB >= verwachtKB + 15
          && vraag.includes('Zeker vrij te maken (pas 4 en 6, zonder voorwaarde): ~' + verwachtKB + ' KB'),
        '~' + verwachtKB + ' KB (de oude formule gaf ~' + oudKB + ')', (vraag.match(/Zeker vrij te maken[^\n]*/) || (vraag.match(/vrij te maken[^\n]*/) || ['GEEN']))[0]);
    eis('OL5c de uitslag toont de telling per pas', /Weggehaald per pas:/.test(uitslag) && /4\. osm-posities\s+1 sleutels/.test(uitslag)
          && /6\. sl_v3_\s+2 sleutels/.test(uitslag)
          && /5\. sl_v4_ halveren staat uit \(2 emmers bewaard\)/.test(uitslag),
        'per pas, osm 1, v3 2, pas 5 uit met 2 bewaard', uitslag.split('\n').filter(l => /^\s+[456]\./.test(l)).join(' | ') || 'GEEN');
    eis('OL5e de vraag zegt dat pas 5 uit staat en de leerdata blijft',
        /5\. sl_v4_ ouder dan 180 dagen: staat uit tot fase 3/.test(vraag) && /Je leerdata \(sl_v4_\) blijft staan\.\n/.test(vraag) && !/oudste helft/.test(vraag),
        'staat uit tot fase 3; blijft staan.', (vraag.match(/5\. sl_v4_[^\n]*/) || ['GEEN'])[0] + ' | ' + (vraag.match(/Je leerdata[^\n]*/) || ['GEEN'])[0]);
    const kst = lees('sl_opruimstat') || {};
    const kr = opruimRegels().slice(-1)[0] || {};
    eis('OL5d de knop telt als knop en schrijft een regel', kst.knop === 1 && kst.auto === 0 && (kr.opruim || {}).bron === 'knop',
        'knop 1, auto 0, regel bron knop', `knop ${kst.knop}, auto ${kst.auto}, regel ${(kr.opruim || {}).bron}`);

    // ══ OL6 — EXPORT EN IMPORT ════════════════════════════════
    eis('OL6 de teller gaat mee in de meetdata-export', /key === 'sl_opruimstat'\)\s*doel = uit\.opslag/.test(zc(exporteerMeetdata)),
        "sl_opruimstat -> uit.opslag", /sl_opruimstat/.test(zc(exporteerMeetdata)) ? 'staat erin' : 'ONTBREEKT');
    eis('OL6b en komt niet terug via de import', !/sl_opruimstat/.test(zc(importeerData)),
        'niet in de import', /sl_opruimstat/.test(zc(importeerData)) ? 'WEL' : 'niet');

    // ══ OR2 — DE SCHAKELAAR IS DE ENIGE WIJZIGING ═════════════
    const bron = String(voerOpruimPassenUit);
    const schakel = bron.match(/\n[ ]*if \(!OPRUIM_V4_HALVEREN\) continue;[^\n]*/g) || [];
    const zonder = bron.replace(/\n[ ]*if \(!OPRUIM_V4_HALVEREN\) continue;[^\n]*/, '');
    eis('OR2 er is precies één schakelregel', schakel.length === 1, '1', String(schakel.length));
    eis('OR2b zonder die regel is voerOpruimPassenUit byte-gelijk aan V11.29.0',
        fnv(zonder) === V11290_OPRUIM[0] && zonder.length === V11290_OPRUIM[1],
        V11290_OPRUIM.join(' / '), fnv(zonder) + ' / ' + zonder.length);
    eis('OR2c en de schakelregel staat NA het tellen van p5geschikt en VÓÓR de eerste schrijving',
        bron.indexOf('tel.p5geschikt++') < bron.indexOf('OPRUIM_V4_HALVEREN')
          && bron.indexOf('OPRUIM_V4_HALVEREN') < bron.indexOf('localStorage.setItem(key, JSON.stringify(behouden))'),
        'tellen < schakelaar < schrijven', 'posities ' + [bron.indexOf('tel.p5geschikt++'), bron.indexOf('OPRUIM_V4_HALVEREN'),
          bron.indexOf('localStorage.setItem(key, JSON.stringify(behouden))')].join(' < '));

    // ══ OR3 — DE SCHAKELAAR STAAT UIT ═════════════════════════
    eis('OR3 OPRUIM_V4_HALVEREN is false', OPRUIM_V4_HALVEREN === false, 'false', String(OPRUIM_V4_HALVEREN));

  } finally {
    Date.now = echtNu;
    window.confirm = echtConfirm; window.alert = echtAlert;
    try { localStorage.removeItem('or_ballast'); } catch (e) {}
    leeg();
    for (const [k, v] of bewaard) localStorage.setItem(k, v);
    opruimGelogdDezeSessie = bewaardSessie;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testOpruimrem = testOpruimrem;
