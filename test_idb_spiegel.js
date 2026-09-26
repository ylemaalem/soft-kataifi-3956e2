// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_idb_spiegel.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.24.0, release C van het opslagplan: IndexedDB spiegelt mee.
//
//  WAT DEZE RELEASE WEL IS: alles staat vanaf nu OOK in IndexedDB. Elke
//  schrijving gaat naar allebei en de bestaande voorraad is eenmalig overgezet
//  en nageteld.
//
//  WAT ZE NIET IS: de app leest er niets uit. localStorage blijft de bron van
//  waarheid. Daarom is deze release omkeerbaar met een git revert — er is
//  niets weggehaald, dus er kan niets verloren gaan.
//
//  DE EIS DIE ALLES DRAAGT: de vlag sl_idbmig_v1 gaat pas op 'done' als de
//  natelling klopt. Hetzelfde idioom als migratieRvWezen. Een half overgezette
//  spiegel die zich voltooid noemt, zou bij een latere omschakeling stil een
//  gat in de leerdata opleveren. C5 en C6 bewaken dat.
//
//  DEZE SUITE IS ASYNCHROON — IndexedDB is dat ook. Aanroepen met await.
//
//  C1  de spiegel gaat open en de overzet telt
//  C2  na de overzet lopen opslag en spiegel gelijk
//  C3  een nieuwe schrijving landt in de spiegel — ook een rauwe
//  C4  een verwijdering verdwijnt er ook uit
//  C5  KERN: de vlag gaat alleen om als de natelling klopt
//  C6  KERN: bij een onvolledige overzet blijft de vlag UIT
//  C7  de app leest niets uit de spiegel, en raakt localStorage niet aan
//  C8  een kapotte spiegel legt de app niet plat
//  C9  KERN: een verschil dat ontstond terwijl de app dicht was, wordt bij de
//      volgende start alsnog gelijkgetrokken
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_idb_spiegel.js';
//      document.head.appendChild(s);
//      s.onload = () => testIdbSpiegel().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testIdbSpiegel() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  const origineel = new Map();
  const zetRuw = (k, v) => {
    if (!origineel.has(k)) origineel.set(k, localStorage.getItem(k));
    localStorage.setItem(k, v);
  };
  const wis = (k) => {
    if (!origineel.has(k)) origineel.set(k, localStorage.getItem(k));
    localStorage.removeItem(k);
  };
  const NODE = 860501;
  const K1 = `sl_v4_${NODE}_dag`;
  const K2 = `sl_naam_${NODE}`;

  try {
    // ── C1: open en overgezet ─────────────────────────────────
    if (!idbDb) await startIdbSpiegel();
    eis('C1a de spiegel is open', !!idbDb, 'open', !!idbDb);
    if (!idbDb) {
      eis('C1x zonder IndexedDB is de rest niet te toetsen', false,
          'open database', 'geen database — suite gestopt');
      const g = regels.filter(r => r.uitslag === 'GEFAALD').length;
      return { geslaagd: regels.length - g, gefaald: g, regels };
    }
    eis('C1b de overzetvlag staat op done', opslagLeesRuw('sl_idbmig_v1') === 'done',
        'done', opslagLeesRuw('sl_idbmig_v1'));

    // ── C2: opslag en spiegel lopen gelijk ────────────────────
    let v = await opslagIdbVergelijk();
    eis('C2a niets mist in de spiegel', v.mistInSpiegel === 0, 0, v.mistInSpiegel);
    eis('C2b geen afwijkende waarden', v.anders === 0, 0, v.anders);
    eis('C2c geen weesrecords in de spiegel', v.teveelInSpiegel === 0, 0, v.teveelInSpiegel);
    eis('C2d de aantallen kloppen', v.inOpslag === v.gelijk, v.inOpslag, v.gelijk);

    // ── C3: een nieuwe schrijving landt ───────────────────────
    zetRuw(K1, JSON.stringify([{ duur: 44, tijd: 1780000001000 }]));   // rauw, buiten de laag
    opslagSchrijf(K2, 'via de laag');                                   // door de laag
    origineel.set(K2, origineel.has(K2) ? origineel.get(K2) : null);
    await idbFlush();
    const spiegel1 = await idbLeesAlles();
    eis('C3a een RAUWE schrijving staat in de spiegel',
        spiegel1.get(K1) === JSON.stringify([{ duur: 44, tijd: 1780000001000 }]),
        'aanwezig', spiegel1.get(K1));
    eis('C3b een schrijving via de laag ook',
        spiegel1.get(K2) === JSON.stringify('via de laag'),
        'aanwezig', spiegel1.get(K2));
    v = await opslagIdbVergelijk();
    eis('C3c en de vergelijking blijft schoon',
        v.mistInSpiegel === 0 && v.anders === 0 && v.teveelInSpiegel === 0,
        '0/0/0', `${v.mistInSpiegel}/${v.anders}/${v.teveelInSpiegel}`);

    // ── C4: een verwijdering verdwijnt ────────────────────────
    wis(K1);
    await idbFlush();
    const spiegel2 = await idbLeesAlles();
    eis('C4a de verwijderde sleutel is weg uit de spiegel', !spiegel2.has(K1),
        'afwezig', spiegel2.has(K1));

    // ── C5 + C6: de vlag en de natelling ──────────────────────
    const migBron = zc(idbMigratie);
    eis('C5a de vlag wordt pas gezet na de natelling',
        /mist === 0[\s\S]{0,80}anders === 0[\s\S]{0,120}opslagSchrijfRuw\(IDB_MIG_VLAG/.test(migBron),
        'natelling vóór de vlag', /opslagSchrijfRuw\(IDB_MIG_VLAG/.test(migBron));
    eis('C5b de overzet leest uit de cache-Map, niet uit localStorage',
        migBron.includes('opslagCache') && !/localStorage/.test(migBron),
        'uit opslagCache', migBron.includes('opslagCache'));

    // echte proef: één sleutel uit de spiegel slopen en opnieuw laten natellen
    await new Promise((k, m) => {
      const tx = idbDb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(K2);
      tx.oncomplete = k; tx.onerror = () => m(tx.error);
    });
    const kapot = await opslagIdbVergelijk();
    eis('C6a een gat in de spiegel wordt gezien', kapot.mistInSpiegel === 1,
        1, kapot.mistInSpiegel);
    eis('C6b ... en benoemd', kapot.voorbeelden.includes(K2),
        K2, kapot.voorbeelden.join(','));
    // en de overzet herstelt het zonder localStorage aan te raken
    const lsVoor = localStorage.length;
    const uitslag = await idbMigratie();
    eis('C6c de overzet repareert het gat', uitslag.mist === 0 && uitslag.anders === 0,
        'mist 0, anders 0', `mist ${uitslag.mist}, anders ${uitslag.anders}`);
    eis('C6d ... en zet de vlag pas dan', uitslag.vlag === 'gezet',
        'gezet', uitslag.vlag);
    eis('C6e ... zonder localStorage te wijzigen', localStorage.length === lsVoor,
        lsVoor, localStorage.length);

    // ── C7: er wordt niets UIT de spiegel gelezen ─────────────
    eis('C7a opslagLeesRuw raakt IndexedDB niet aan',
        !/idb|indexedDB/i.test(zc(opslagLeesRuw)), 'geen IDB', zc(opslagLeesRuw).slice(0, 40));
    eis('C7b opslagSleutels raakt IndexedDB niet aan',
        !/idb|indexedDB/i.test(zc(opslagSleutels)), 'geen IDB', 'ok');
    eis('C7c verzamelBackupData raakt IndexedDB niet aan',
        !/idb|indexedDB/i.test(zc(verzamelBackupData)), 'geen IDB', 'ok');
    eis('C7d startApp wacht NIET op de spiegel',
        /(?<!await\s)startIdbSpiegel\(\)/.test(zc(startApp)),
        'geen await', zc(startApp).includes('await startIdbSpiegel') ? 'wacht wel' : 'wacht niet');

    // ── C8: een kapotte spiegel legt niets plat ───────────────
    const bewaardDb = idbDb;
    try {
      idbDb = null;                       // simuleert: database ging niet open
      const pech = await opslagIdbVergelijk();
      eis('C8a zonder database geeft de vergelijking netjes op',
          !!pech.fout, 'foutmelding', pech.fout);
      idbNoteer('sl_test_idb_zonder_db', 'x');
      eis('C8b een schrijving in de wachtrij geeft geen fout', true, 'geen fout', 'geen fout');
      const schrijfLukt = opslagSchrijf(`sl_v4_${NODE}_avond`, [{ duur: 1, tijd: 1 }]);
      origineel.set(`sl_v4_${NODE}_avond`, null);
      eis('C8c en de gewone opslag werkt gewoon door', schrijfLukt === true,
          true, schrijfLukt);
    } finally {
      idbDb = bewaardDb;
      idbWachtrij.delete('sl_test_idb_zonder_db');
    }

    // ── C9: de spiegel repareert zichzelf ────────────────────
    // Schrijvingen worden gebundeld (IDB_FLUSH_MS). Sluit het tabblad in dat
    // venster, dan gaat de bundel verloren en loopt de spiegel uit de pas -
    // en omdat de overzet maar EEN keer draait, zou dat verschil blijven
    // staan. idbHerstel() trekt het bij elke start alsnog gelijk.
    const K9a = `sl_v4_${NODE}_ochtend`;      // staat straks wel in de opslag
    const K9b = `sl_naam_${NODE}_wees`;       // staat straks alleen in de spiegel
    zetRuw(K9a, JSON.stringify([{ duur: 33, tijd: 1780000004000 }]));
    await idbFlush();
    // simuleer het verlies: haal K9a uit de spiegel en zet een weesrecord neer
    await new Promise((k, m) => {
      const tx = idbDb.transaction(IDB_STORE, 'readwrite');
      const st = tx.objectStore(IDB_STORE);
      st.delete(K9a); st.put('wees', K9b);
      tx.oncomplete = k; tx.onerror = () => m(tx.error);
    });
    const scheef = await opslagIdbVergelijk();
    eis('C9a het verschil is zichtbaar',
        scheef.mistInSpiegel === 1 && scheef.teveelInSpiegel === 1,
        'mist 1, teveel 1', `mist ${scheef.mistInSpiegel}, teveel ${scheef.teveelInSpiegel}`);
    const lsVoorHerstel = localStorage.length;
    const herstel = await idbHerstel();
    eis('C9b idbHerstel trekt het gelijk', herstel.restant === 0,
        0, herstel.restant);
    eis('C9c ... door één record bij te werken en één weg te halen',
        herstel.bijgewerkt === 1 && herstel.verwijderd === 1,
        '1 bij, 1 weg', `${herstel.bijgewerkt} bij, ${herstel.verwijderd} weg`);
    eis('C9d ... zonder localStorage aan te raken', localStorage.length === lsVoorHerstel,
        lsVoorHerstel, localStorage.length);
    const naHerstel = await opslagIdbVergelijk();
    eis('C9e en de spiegel is weer schoon',
        naHerstel.mistInSpiegel === 0 && naHerstel.anders === 0 && naHerstel.teveelInSpiegel === 0,
        '0/0/0', `${naHerstel.mistInSpiegel}/${naHerstel.anders}/${naHerstel.teveelInSpiegel}`);
    eis('C9f de start roept het herstel aan als de overzet al gedaan is',
        /IDB_MIG_VLAG[\s\S]{0,160}idbHerstel\(\)/.test(zc(startIdbSpiegel)),
        'aanwezig', zc(startIdbSpiegel).includes('idbHerstel('));

  } finally {
    try { await idbFlush(); } catch(e) {}
    for (const [k, v2] of origineel) {
      try { if (v2 === null) localStorage.removeItem(k); else localStorage.setItem(k, v2); }
      catch(e) {}
    }
    try { await idbFlush(); } catch(e) {}
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
