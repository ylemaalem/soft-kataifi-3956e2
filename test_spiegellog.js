// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_spiegellog.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.31.0: de IndexedDB-spiegel wordt meetbaar.
//
//  WAT ER MIS WAS. idbHerstel() trekt de spiegel bij elke start gelijk met
//  localStorage en meldde wat hij deed alleen aan de console. Een vergelijking
//  na de start was daardoor altijd groen, en het stabiliteitsprotocol kon de
//  spiegel niet beoordelen.
//
//  WAT ER NU IS. Per start een regel in sl_spiegellog met de stand VÓÓR het
//  herstel, hooguit tien sleutelnamen, en wat het herstel daarna deed. De ring
//  gaat mee in stoplichtiq_opslag_*.json.
//
//  SL1  de vergelijking levert de lijsten per soort, de oude velden blijven
//  SL2  een start op een schone spiegel: één kleine regel, 0/0/0
//  SL3  KERN: verschillen worden geteld VÓÓR het herstel, en daarna hersteld
//  SL4  hooguit tien voorbeelden, om de beurt uit de drie soorten
//  SL5  de ring houdt de laatste SPIEGELLOG_MAX starts
//  SL6  KERN: geen gedragswijziging in het herstel
//  SL7  een spiegel die niet opengaat, krijgt ook een regel
//  SL8  de eerste overzet krijgt een eigen soort regel
//  SL9  een log dat stukgaat, breekt de start niet
//  SL10 de ring reist mee in stoplichtiq_opslag_*.json
//
//  DEZE SUITE IS ASYNCHROON — IndexedDB is dat ook. Aanroepen met await.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_spiegellog.js';
//      document.head.appendChild(s);
//      s.onload = () => testSpiegellog().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testSpiegellog() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));

  // V11.30.0-vingerafdrukken, gemeten op het bestand van ac387e8.
  const V1130_HERSTEL  = ['eeaea7f7', 905];    // idbHerstel zonder de twee V11.31.0-regels
  const V1130_MIGRATIE = ['ce51fe80', 1450];   // idbMigratie, ongewijzigd
  const V1130_FLUSH    = ['355ce158', 958];    // idbFlush, ongewijzigd

  const NODE = 860531;
  const sleutel = (s) => `sl_v4_${NODE}_${s}`;
  const origineel = new Map();
  const zet = (k, v) => { if (!origineel.has(k)) origineel.set(k, localStorage.getItem(k)); localStorage.setItem(k, v); };
  const wis = (k) => { if (!origineel.has(k)) origineel.set(k, localStorage.getItem(k)); localStorage.removeItem(k); };
  const wezenInSpiegel = new Set();   // sleutels die ALLEEN in IndexedDB zijn gezet
  const logVoor = localStorage.getItem(SPIEGELLOG_SLEUTEL);
  origineel.set(SPIEGELLOG_SLEUTEL, logVoor);

  const idbSchrijf = (werk) => new Promise((k, m) => {
    const tx = idbDb.transaction(IDB_STORE, 'readwrite');
    const st = tx.objectStore(IDB_STORE);
    for (const [s, w] of werk) { if (w === null) st.delete(s); else st.put(w, s); }
    tx.oncomplete = k; tx.onerror = () => m(tx.error);
  });
  const log = () => { const a = opslagLees(SPIEGELLOG_SLEUTEL, []); return Array.isArray(a) ? a : []; };
  const laatste = () => { const a = log(); return a[a.length - 1] || null; };

  const bewaardOpen = idbOpen, bewaardSchrijf = opslagSchrijf;
  const bewaardDb = idbDb;

  try {
    if (!idbDb) await startIdbSpiegel();
    if (!eis('SL0 de spiegel is open', !!idbDb, 'open', !!idbDb)) {
      const g = regels.filter(r => r.uitslag === 'GEFAALD').length;
      return { geslaagd: regels.length - g, gefaald: g, regels };
    }
    // Een schone uitgangssituatie: wat de testorigin eventueel nog scheef had,
    // trekken we eerst gelijk. Pas daarna meten.
    await idbHerstel();

    // ── SL1: de lijsten per soort ─────────────────────────────
    zet(sleutel('a'), '[{"duur":31,"tijd":1}]');
    await idbFlush();
    await idbSchrijf([[sleutel('a'), null], ['sl_naam_' + NODE + '_wees1', 'x']]);
    wezenInSpiegel.add('sl_naam_' + NODE + '_wees1');
    const v1 = await opslagIdbVergelijk();
    eis('SL1a de oude velden staan er nog',
        'voorbeelden' in v1 && 'mistInSpiegel' in v1 && 'anders' in v1 && 'teveelInSpiegel' in v1,
        'voorbeelden/mistInSpiegel/anders/teveelInSpiegel', Object.keys(v1).join(','));
    eis('SL1b lijsten noemt de soort erbij',
        v1.lijsten && v1.lijsten.mist.includes(sleutel('a'))
          && v1.lijsten.teveel.includes('sl_naam_' + NODE + '_wees1'),
        'a in mist, wees1 in teveel', JSON.stringify(v1.lijsten));
    eis('SL1c voorbeelden is nog de oude menging',
        v1.voorbeelden.includes(sleutel('a')) && v1.voorbeelden.includes('sl_naam_' + NODE + '_wees1'),
        'beide erin', v1.voorbeelden.join(','));
    await idbHerstel();
    wezenInSpiegel.delete('sl_naam_' + NODE + '_wees1');

    // ── SL2: een start op een schone spiegel ──────────────────
    let n0 = log().length;
    await startIdbSpiegel();
    let r = laatste();
    eis('SL2a er komt precies één regel bij', log().length === Math.min(n0 + 1, SPIEGELLOG_MAX),
        Math.min(n0 + 1, SPIEGELLOG_MAX), log().length);
    eis('SL2b soort herstel, 0 / 0 / 0',
        r && r.soort === 'herstel' && r.mist === 0 && r.anders === 0 && r.teveel === 0,
        'herstel 0/0/0', r && `${r.soort} ${r.mist}/${r.anders}/${r.teveel}`);
    eis('SL2c zonder verschil geen voorbeelden en geen hersteltelling',
        r && !('vb' in r) && !('hersteld' in r), 'geen vb, geen hersteld', r && Object.keys(r).join(','));
    eis('SL2d met versie en aantallen', r && /^V\d+\.\d+\.\d+$/.test(r.ver) && r.opslag > 0 && r.spiegel > 0,
        'V11.x.y, opslag>0, spiegel>0', r && `${r.ver} ${r.opslag} ${r.spiegel}`);
    const lengte = JSON.stringify(r).length;
    eis('SL2e een regel zonder verschil blijft klein (< 160 tekens)', lengte < 160, '< 160', lengte);

    // ── SL3: tellen VÓÓR het herstel ─────────────────────────
    zet(sleutel('m1'), '[{"duur":41,"tijd":1}]');
    zet(sleutel('m2'), '[{"duur":42,"tijd":1}]');
    zet(sleutel('x1'), '[{"duur":43,"tijd":1}]');
    await idbFlush();
    await idbSchrijf([
      [sleutel('m1'), null], [sleutel('m2'), null],     // twee ontbreken in de spiegel
      [sleutel('x1'), '[{"duur":99,"tijd":1}]'],         // één wijkt af
      ['sl_naam_' + NODE + '_wees2', 'x']                // één staat er te veel
    ]);
    wezenInSpiegel.add('sl_naam_' + NODE + '_wees2');
    await startIdbSpiegel();
    r = laatste();
    eis('SL3a de telling is die van VÓÓR het herstel: 2 / 1 / 1',
        r && r.mist === 2 && r.anders === 1 && r.teveel === 1,
        '2/1/1', r && `${r.mist}/${r.anders}/${r.teveel}`);
    eis('SL3b de voorbeelden noemen de juiste sleutels per soort',
        r && r.vb && r.vb.mist.includes(sleutel('m1')) && r.vb.mist.includes(sleutel('m2'))
          && r.vb.anders[0] === sleutel('x1') && r.vb.teveel[0] === 'sl_naam_' + NODE + '_wees2',
        'm1,m2 / x1 / wees2', r && JSON.stringify(r.vb));
    eis('SL3c en wat het herstel daarna deed: 4 hersteld, 0 over',
        r && r.hersteld === 4 && r.restant === 0, '4 / 0', r && `${r.hersteld} / ${r.restant}`);
    const na3 = await opslagIdbVergelijk();
    eis('SL3d de spiegel is daarna echt schoon',
        na3.mistInSpiegel === 0 && na3.anders === 0 && na3.teveelInSpiegel === 0,
        '0/0/0', `${na3.mistInSpiegel}/${na3.anders}/${na3.teveelInSpiegel}`);
    wezenInSpiegel.delete('sl_naam_' + NODE + '_wees2');

    // ── SL4: hooguit tien voorbeelden, om de beurt ────────────
    const werk4 = [];
    for (let i = 0; i < 12; i++) { zet(sleutel('mm' + i), '[{"duur":5,"tijd":1}]'); werk4.push([sleutel('mm' + i), null]); }
    for (let i = 0; i < 3; i++) { zet(sleutel('aa' + i), '[{"duur":6,"tijd":1}]'); werk4.push([sleutel('aa' + i), '"anders"']); }
    for (let i = 0; i < 2; i++) { werk4.push(['sl_naam_' + NODE + '_tt' + i, 'x']); wezenInSpiegel.add('sl_naam_' + NODE + '_tt' + i); }
    await idbFlush();
    await idbSchrijf(werk4);
    await startIdbSpiegel();
    r = laatste();
    eis('SL4a de volle aantallen staan erin: 12 / 3 / 2',
        r && r.mist === 12 && r.anders === 3 && r.teveel === 2, '12/3/2', r && `${r.mist}/${r.anders}/${r.teveel}`);
    const nvb = r && r.vb ? r.vb.mist.length + r.vb.anders.length + r.vb.teveel.length : -1;
    eis('SL4b maar hooguit tien namen', nvb === SPIEGELLOG_VOORBEELDEN, SPIEGELLOG_VOORBEELDEN, nvb);
    eis('SL4c om de beurt: 5 / 3 / 2, geen soort verdrongen',
        r && r.vb && r.vb.mist.length === 5 && r.vb.anders.length === 3 && r.vb.teveel.length === 2,
        '5/3/2', r && r.vb && `${r.vb.mist.length}/${r.vb.anders.length}/${r.vb.teveel.length}`);
    eis('SL4d spiegelVoorbeelden los: lege lijsten geven lege uitkomst',
        JSON.stringify(spiegelVoorbeelden({ mist: [], anders: [], teveel: [] }, 10)) === '{"mist":[],"anders":[],"teveel":[]}'
          && JSON.stringify(spiegelVoorbeelden(null, 10)) === '{"mist":[],"anders":[],"teveel":[]}',
        'leeg', JSON.stringify(spiegelVoorbeelden(null, 10)));
    for (let i = 0; i < 2; i++) wezenInSpiegel.delete('sl_naam_' + NODE + '_tt' + i);

    // ── SL5: de ring ──────────────────────────────────────────
    const vol = [];
    for (let i = 0; i < SPIEGELLOG_MAX; i++) vol.push({ t: i, ver: 'V0.0.0', soort: 'herstel', ms: 0, mist: 0, anders: 0, teveel: 0, nr: i });
    localStorage.setItem(SPIEGELLOG_SLEUTEL, JSON.stringify(vol));
    await startIdbSpiegel();
    const ring = log();
    eis('SL5a de ring blijft SPIEGELLOG_MAX lang', ring.length === SPIEGELLOG_MAX, SPIEGELLOG_MAX, ring.length);
    eis('SL5b de oudste valt eraf, de nieuwste staat achteraan',
        ring[0].nr === 1 && ring[ring.length - 1].ver !== 'V0.0.0',
        'nr 1 voorop, nieuwe achter', `${ring[0].nr} / ${ring[ring.length - 1].ver}`);
    eis('SL5c SPIEGELLOG_MAX is 30 en de voorbeeldgrens 10',
        SPIEGELLOG_MAX === 30 && SPIEGELLOG_VOORBEELDEN === 10, '30 / 10',
        SPIEGELLOG_MAX + ' / ' + SPIEGELLOG_VOORBEELDEN);

    // ── SL6: geen gedragswijziging ───────────────────────────
    const zonder = String(idbHerstel).split('\n').filter(l => !l.includes('V11.31.0')).join('\n');
    eis('SL6a idbHerstel zonder de twee V11.31.0-regels is byte-gelijk aan V11.30.0',
        fnv(zonder) === V1130_HERSTEL[0] && zonder.length === V1130_HERSTEL[1],
        V1130_HERSTEL.join(' / '), fnv(zonder) + ' / ' + zonder.length);
    const tagRegels = String(idbHerstel).split('\n').filter(l => l.includes('V11.31.0'));
    eis('SL6b die twee regels schrijven alleen de meetvariabelen',
        tagRegels.length === 2
          && /^\s*idbHerstelVoor = v; idbHerstelNa = null;/.test(tagRegels[0])
          && /^\s*idbHerstelNa = uitslag;/.test(tagRegels[1]),
        '2 regels, alleen idbHerstelVoor/Na', tagRegels.map(s => s.trim()).join(' | '));
    eis('SL6c idbMigratie en idbFlush zijn onaangeroerd',
        fnv(String(idbMigratie)) === V1130_MIGRATIE[0] && String(idbMigratie).length === V1130_MIGRATIE[1]
          && fnv(String(idbFlush)) === V1130_FLUSH[0] && String(idbFlush).length === V1130_FLUSH[1],
        'gelijk', fnv(String(idbMigratie)) + ' / ' + fnv(String(idbFlush)));
    // gedrag: na een start is de spiegel gelijk aan de opslag, en localStorage
    // verandert op één sleutel na (het log zelf) niet
    const lsVoor = new Map();
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); lsVoor.set(k, localStorage.getItem(k)); }
    await startIdbSpiegel();
    let lsAnders = 0;
    for (const [k, w] of lsVoor) if (k !== SPIEGELLOG_SLEUTEL && localStorage.getItem(k) !== w) lsAnders++;
    const nieuweSleutels = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!lsVoor.has(k)) nieuweSleutels.push(k); }
    eis('SL6d een start wijzigt localStorage alleen in sl_spiegellog',
        lsAnders === 0 && nieuweSleutels.length === 0, '0 gewijzigd, 0 nieuw',
        `${lsAnders} gewijzigd, nieuw: ${nieuweSleutels.join(',') || '-'}`);
    await slaap(IDB_FLUSH_MS + 150);
    const v6 = await opslagIdbVergelijk();
    eis('SL6e ... en de spiegel loopt daarna gelijk, het log inbegrepen',
        v6.mistInSpiegel === 0 && v6.anders === 0 && v6.teveelInSpiegel === 0,
        '0/0/0', `${v6.mistInSpiegel}/${v6.anders}/${v6.teveelInSpiegel}`);

    // ── SL7: de spiegel gaat niet open ───────────────────────
    idbOpen = () => Promise.reject(Object.assign(new Error('proef'), { name: 'ProefFout' }));
    let uit7;
    try { uit7 = await startIdbSpiegel(); } finally { idbOpen = bewaardOpen; idbDb = bewaardDb; }
    r = laatste();
    eis('SL7a de start geeft netjes op, zoals altijd', uit7 === null, null, uit7);
    eis('SL7b ... en laat een regel achter: open_mislukt, met de foutnaam',
        r && r.soort === 'open_mislukt' && r.fout === 'ProefFout',
        'open_mislukt / ProefFout', r && `${r.soort} / ${r.fout}`);

    // ── SL8: de eerste overzet ───────────────────────────────
    const vlag = localStorage.getItem(IDB_MIG_VLAG);
    origineel.set(IDB_MIG_VLAG, vlag);
    localStorage.removeItem(IDB_MIG_VLAG);
    await startIdbSpiegel();
    r = laatste();
    eis('SL8a een start met overzet logt soort overzet',
        r && r.soort === 'overzet' && r.vlag === 'gezet' && r.mist === 0 && r.anders === 0,
        'overzet / gezet / 0 / 0', r && `${r.soort} / ${r.vlag} / ${r.mist} / ${r.anders}`);
    eis('SL8b ... en de vlag staat daarna weer op done', localStorage.getItem(IDB_MIG_VLAG) === 'done',
        'done', localStorage.getItem(IDB_MIG_VLAG));

    // ── SL9: een log dat stukgaat, breekt de start niet ───────
    zet(sleutel('z9'), '[{"duur":9,"tijd":1}]');
    await idbFlush();
    await idbSchrijf([[sleutel('z9'), null]]);
    const n9 = log().length;
    opslagSchrijf = () => { throw new Error('proef: log stuk'); };
    let fout9 = null;
    try { await startIdbSpiegel(); } catch (e) { fout9 = e; } finally { opslagSchrijf = bewaardSchrijf; }
    eis('SL9a de start gooit niet', fout9 === null, 'geen fout', fout9 && fout9.message);
    const v9 = await opslagIdbVergelijk();
    eis('SL9b en het herstel is gewoon gedaan', v9.mistInSpiegel === 0, 0, v9.mistInSpiegel);
    eis('SL9c er kwam geen regel bij', log().length === n9, n9, log().length);

    // ── SL10: de export ──────────────────────────────────────
    const blobs = [];
    const bewaard = { url: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click, alert: window.alert,
                      cs: Object.getOwnPropertyDescriptor(navigator, 'canShare') };
    try {
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:proef'; };
      HTMLAnchorElement.prototype.click = function() {};
      window.alert = () => {};
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
      const schaduw = localStorage.getItem('sl_schaduwlog');
      origineel.set('sl_schaduwlog', schaduw);
      exporteerMeetdata();
      for (let i = 0; i < 40 && blobs.length < 2; i++) await slaap(50);
    } finally {
      URL.createObjectURL = bewaard.url;
      HTMLAnchorElement.prototype.click = bewaard.klik;
      window.alert = bewaard.alert;
      if (bewaard.cs) Object.defineProperty(navigator, 'canShare', bewaard.cs); else delete navigator.canShare;
    }
    let opslagJson = null, meetJson = null;
    for (const b of blobs) {
      const j = JSON.parse(await b.text());
      if (Array.isArray(j.sleutels)) opslagJson = j; else meetJson = j;
    }
    eis('SL10a het opslagoverzicht bevat spiegelStarts',
        !!opslagJson && Array.isArray(opslagJson.spiegelStarts), 'array', opslagJson && typeof opslagJson.spiegelStarts);
    eis('SL10b ... gelijk aan de ring', !!opslagJson
        && JSON.stringify(opslagJson.spiegelStarts) === JSON.stringify(log()),
        log().length + ' regels', opslagJson && opslagJson.spiegelStarts.length + ' regels');
    eis('SL10c de bestaande velden en de versie blijven zoals ze waren',
        !!opslagJson && opslagJson.versie === 'V11.17.15' && Array.isArray(opslagJson.sleutels) && 'totaalKb' in opslagJson,
        'V11.17.15 + sleutels + totaalKb', opslagJson && opslagJson.versie);
    eis('SL10d de meetdata-export neemt het log niet over',
        !!meetJson && !JSON.stringify(meetJson).includes('"' + SPIEGELLOG_SLEUTEL + '"'),
        'niet in meetdata', meetJson ? 'gecontroleerd' : 'geen meetdata gevonden');

  } finally {
    idbOpen = bewaardOpen; opslagSchrijf = bewaardSchrijf;
    if (!idbDb) idbDb = bewaardDb;
    try { await idbFlush(); } catch (e) {}
    for (const [k, v] of origineel) {
      try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
    }
    // alles wat met NODE begint en nog in localStorage staat, opruimen
    const rest = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.includes(String(NODE))) rest.push(k); }
    for (const k of rest) localStorage.removeItem(k);
    try {
      await idbFlush();
      const weg = [...wezenInSpiegel].map(k => [k, null]);
      const alles = await idbLeesAlles();
      for (const k of alles.keys()) if (k.includes(String(NODE))) weg.push([k, null]);
      if (weg.length && idbDb) await idbSchrijf(weg);
    } catch (e) {}
  }

  const gefaald = regels.filter(r2 => r2.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
