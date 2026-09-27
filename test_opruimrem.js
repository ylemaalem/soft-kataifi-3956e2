// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_opruimrem.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.29.0: de opruimrem laat zien wat hij doet.
//
//  HOE DEZE TEST TOT STAND KWAM
//  OR0 is eerst geschreven op V11.28.0, voordat er iets veranderde, en was
//  daar 7 van 7 groen. OR0 legt het gedrag vast dat V11.29.0 NIET mag
//  veranderen - en dat V11.30.0 wel verandert. In deze release moet OR0 dus
//  groen blijven.
//
//  OR0a  een emmer waarvan de nieuwste meting 181 dagen oud is, gaat bij elke
//        vuring opnieuw naar de helft: 10 -> 5 -> 3 -> 2 -> 1
//  OR0b  een geschikte emmer met 1 record wordt bij elke vuring herschreven,
//        een verse emmer nooit
//  OR0c  is de echte meting ouder dan de lege S2-markeringen, dan gaat bij
//        halveren de echte meting als eerste weg
//  OR0d  boven 4,0 MiB vuurt checkLocalStorageRuimte bij elke aanroep, eronder
//        niet (getuige: een sl_pos_ met bron osm, pas 4)
//
//  OL1   byte-gelijk: op een fixture waarin alle zeven passen iets te doen
//        hebben, geeft de nieuwe voerOpruimPassenUit exact dezelfde opslag als
//        een letterlijke kopie van V11.28.0 (OL1b: ook via de grens)
//  OL2   de telling per pas klopt met wat er echt veranderde
//  OL3   sl_opruimstat telt op over vuringen
//  OL4   een 'opruim'-regel alleen bij de eerste vuring van een sessie en als
//        pas 5 echt halveerde; nullen gaan niet mee; andere regels krijgen het
//        veld niet
//  OL5   de knop: "zeven passen", een eerlijke schatting, telling in de
//        uitslag, en een regel met bron 'knop'
//  OL6   de teller gaat mee in de meetdata-export en niet terug via de import
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
    eis('OR0a vier vuringen halveren dezelfde emmer telkens opnieuw', lengtes.join('>') === '5>3>2>1',
        '5>3>2>1', lengtes.join('>'));
    const a4 = lees(A) || [];
    eis('OR0a2 wat overblijft is de nieuwste meting', a4.length === 1 && a4[0].tijd === a0[0].tijd,
        'tijd ' + a0[0].tijd, a4.map(x => x.tijd).join(','));

    // ══ OR0b — HERSCHRIJVEN ZONDER VERANDERING ════════════════
    leeg();
    const B = 'sl_v4_996002_nacht', BV = 'sl_v4_996002_dag';
    zet(B, [meting(200, 30)]);
    zet(BV, [meting(10, 30)]);
    const perB = telSchrijvingen(() => { for (let i = 0; i < 3; i++) voerOpruimPassenUit(); });
    eis('OR0b een geschikte emmer met 1 record wordt bij elke vuring herschreven', (perB[B] || 0) === 3,
        '3 schrijvingen', String(perB[B] || 0));
    eis('OR0b2 een verse emmer wordt nooit herschreven', !perB[BV], '0', String(perB[BV] || 0));

    // ══ OR0c — DE ECHTE METING GAAT ALS EERSTE ════════════════
    leeg();
    const C = 'sl_v4_996003_avond';
    zet(C, [meting(200, 40), markering(190), markering(189), markering(188)]);
    voerOpruimPassenUit();
    const c1 = lees(C) || [];
    eis('OR0c na één halvering is de echte meting weg en staan er alleen lege markeringen',
        c1.length === 2 && !c1.some(x => x.duur > 0), '2 records, geen met duur > 0',
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

    // ══ OL1 — BYTE-GELIJK AAN V11.28.0 ════════════════════════
    leeg(); fixtuur(); oudeOpruim();
    const oud = momentopname();
    leeg(); fixtuur();
    const tel = voerOpruimPassenUit();
    const nieuw = momentopname();
    eis('OL1 alle sleutels byte-gelijk aan de kopie van V11.28.0', nieuw === oud,
        'gelijk', nieuw === oud ? 'gelijk' : 'VERSCHILT');
    eis('OL1a en de functie zelf schrijft geen log of teller',
        localStorage.getItem('sl_opslaglog') === null && localStorage.getItem('sl_opruimstat') === null,
        'geen sl_opslaglog, geen sl_opruimstat',
        [localStorage.getItem('sl_opslaglog') ? 'log' : '', localStorage.getItem('sl_opruimstat') ? 'teller' : ''].join(' ') || 'geen');
    leeg(); fixtuur(); ballast(true); oudeGrens(); ballast(false);
    const oudG = momentopname();
    leeg(); fixtuur(); ballast(true); opruimGelogdDezeSessie = false; checkLocalStorageRuimte(); ballast(false);
    const nieuwG = momentopname(['sl_opslaglog', 'sl_opruimstat']);
    eis('OL1b via de grens ook: op log en teller na byte-gelijk', nieuwG === oudG,
        'gelijk', nieuwG === oudG ? 'gelijk' : 'VERSCHILT');

    // ══ OL2 — DE TELLING ══════════════════════════════════════
    const verwacht = { p1: 2, p2: 1, p3: 1, p4: 1, p5geschikt: 2, p5emmers: 2, p5weg: 7, p5echt: 3, p6: 1, p7weg: 3, p7kapot: 1 };
    const kreeg = {}; for (const k of Object.keys(verwacht)) kreeg[k] = tel[k];
    eis('OL2 elke pas telt wat hij deed', JSON.stringify(kreeg) === JSON.stringify(verwacht),
        JSON.stringify(verwacht), JSON.stringify(kreeg));
    const emmers = (tel.emmers || []).map(e => e.join(':')).sort().join(' ');
    eis('OL2b de gehalveerde emmers met voor en na', emmers === '996130_dag:10:5 996133_dag_groen:4:2',
        '996130_dag:10:5 996133_dag_groen:4:2', emmers);
    const n1 = lees('sl_v4_996130_dag') || [];
    eis('OL2c p5echt telt de weggehaalde echte metingen, niet de overgebleven',
        n1.length === 5 && n1.every(x => x.duur > 0), '5 echte blijven, 1 echte + 4 leeg weg',
        n1.length + ' over, ' + n1.filter(x => x.duur > 0).length + ' echt');

    // ══ OL3 — DE TELLER ═══════════════════════════════════════
    leeg(); fixtuur(); ballast(true); opruimGelogdDezeSessie = false;
    checkLocalStorageRuimte(); checkLocalStorageRuimte();
    ballast(false);
    const st = lees('sl_opruimstat') || {};
    eis('OL3 twee vuringen, allebei automatisch', st.vuringen === 2 && st.auto === 2 && st.knop === 0,
        'vuringen 2, auto 2, knop 0', `vuringen ${st.vuringen}, auto ${st.auto}, knop ${st.knop}`);
    const pp = st.perPas || {};
    eis('OL3b per pas opgeteld: routes alleen de eerste keer, halveren twee keer',
        pp.p1 === 2 && pp.p5emmers === 4 && pp.p5weg === 10,
        'p1 2, p5emmers 4, p5weg 10', `p1 ${pp.p1}, p5emmers ${pp.p5emmers}, p5weg ${pp.p5weg}`);
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
    const r4 = na4[na4.length - 1] || {};
    eis('OL4b een halvering geeft wel een regel, met de emmer erin', na4.length === 2 && JSON.stringify((r4.opruim || {}).emmers) === '[["996161_dag",4,2]]',
        '2 regels, emmers [["996161_dag",4,2]]', na4.length + ' regels, ' + JSON.stringify((r4.opruim || {}).emmers));
    eis('OL4c nullen gaan niet mee in de regel', r4.opruim && !('p6' in r4.opruim) && !('p1' in r4.opruim) && r4.opruim.p5emmers === 1,
        'geen p1/p6, p5emmers 1', JSON.stringify(r4.opruim));
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
          && /5\. sl_v4_ halveren 2 emmers, 7 records \(3 echte metingen\)/.test(uitslag),
        'per pas, osm 1, halveren 2/7/3', uitslag.split('\n').filter(l => /^\s+[45]\./.test(l)).join(' | ') || 'GEEN');
    const kst = lees('sl_opruimstat') || {};
    const kr = opruimRegels().slice(-1)[0] || {};
    eis('OL5d de knop telt als knop en schrijft een regel', kst.knop === 1 && kst.auto === 0 && (kr.opruim || {}).bron === 'knop',
        'knop 1, auto 0, regel bron knop', `knop ${kst.knop}, auto ${kst.auto}, regel ${(kr.opruim || {}).bron}`);

    // ══ OL6 — EXPORT EN IMPORT ════════════════════════════════
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('OL6 de teller gaat mee in de meetdata-export', /key === 'sl_opruimstat'\)\s*doel = uit\.opslag/.test(zc(exporteerMeetdata)),
        "sl_opruimstat -> uit.opslag", /sl_opruimstat/.test(zc(exporteerMeetdata)) ? 'staat erin' : 'ONTBREEKT');
    eis('OL6b en komt niet terug via de import', !/sl_opruimstat/.test(zc(importeerData)),
        'niet in de import', /sl_opruimstat/.test(zc(importeerData)) ? 'WEL' : 'niet');

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
