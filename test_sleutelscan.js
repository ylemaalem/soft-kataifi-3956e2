// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_sleutelscan.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.22.0, release A van het opslagplan: de sleutelscan uit het
//  geheugen. GEEN IndexedDB, GEEN gedragswijziging — localStorage blijft de
//  bron van waarheid. Wat verandert is waar de sl_v5_-SLEUTELLIJST vandaan
//  komt: uit de cache-Map van fase 2 in plaats van uit localStorage.key(i).
//
//  WAAROM. Gemeten op 12.272 sleutels kost isEenRichtingNode 12,6 ms per
//  aanroep, en tickCd → updateGlosa → berekenGlosa roept hem ELKE FRAME aan
//  zolang je een rood licht nadert. Een frame duurt 16,7 ms. Uit de Map kost
//  dezelfde vraag 0,6 ms.
//
//  DE VOORWAARDE DIE BEWAAKT MOET WORDEN. De Map klopt alleen als elke
//  schrijver hem bijwerkt — ook de honderd plekken die nog rechtstreeks
//  localStorage.setItem doen, en de 44 testsuites die hun fixtures zo
//  neerzetten. Daarom wikkelt de app Storage.prototype eenmalig om: elke
//  rauwe schrijving werkt de Map vanzelf bij. Geen afspraak, een eigenschap.
//
//  EERST GEPROBEERD EN AFGEKEURD: een teller op localStorage.length. Die is
//  gratis, maar mist de wissel waarbij evenveel sleutels bijkomen als er
//  weggaan — precies wat een merge doet en wat drie suites doen. Drie suites
//  vielen erop om. S6 legt dat geval expliciet vast zodat het niet terugkomt.
//
//  S1  opslagSleutels geeft exact dezelfde sleutels als een rauwe scan
//  S2  ... en valt terug op localStorage zolang de boot niet klaar is
//  S3  de vijf omgezette functies geven hetzelfde antwoord als voorheen
//  S4  ... ook in de randgevallen: nul sleutels, één richting, vreemde vormen
//  S5  KERN: een gelezen-maar-afwezige sleutel (spook) telt niet mee
//  S6  KERN: rauwe schrijvers worden gezien — en het ene gat dat overblijft
//  S7  REGRESSIE: geen volledige sleutelscan meer in de omgezette functies
//  S8  de Map-weg is aantoonbaar sneller dan de sleutelscan
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_sleutelscan.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testSleutelscan().regels);
// ═══════════════════════════════════════════════════════════════

function testSleutelscan() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  // ── fixture-beheer ────────────────────────────────────────
  // Nooit localStorage.clear(): dat zou de echte leerdata wissen van het
  // toestel waarop de suite toevallig draait.
  // Per sleutel de OORSPRONKELIJKE waarde onthouden en exact terugzetten. De
  // cache-Map wordt met rust gelaten - de omwikkeling van Storage.prototype
  // houdt hem gelijk. Een momentopname van opslagCache terugzetten zou sleutels
  // wegvagen die andere suites er intussen in hebben gezet.
  const origineel = new Map();
  const gezet = [];
  const zetRuw = (k, v) => {
    if (!origineel.has(k)) origineel.set(k, localStorage.getItem(k));
    localStorage.setItem(k, v); gezet.push(k);
  };
  const zetV5 = (node, aanrij, afrij, dd, metingen) =>
    zetRuw(`sl_v5_${node}_${aanrij}_${afrij}_${dd}`, JSON.stringify(metingen));
  const meting = (duur, tijd) => ({ duur, tijd, gewicht: 1.0, bron: 'test' });

  const bewaardBootKlaar = opslagBootKlaar;

  const NODE = 880001;          // bestaat niet in echte data
  const LEEG = 880002;
  const EEN  = 880003;

  try {
    // ── fixture ───────────────────────────────────────────────
    zetV5(NODE, 'N', 'R', 'dag',     [meting(40, 1780000001000)]);
    zetV5(NODE, 'N', 'L', 'dag',     [meting(42, 1780000002000)]);
    zetV5(NODE, 'O', 'R', 'dag',     [meting(38, 1780000003000)]);
    zetV5(NODE, 'O', 'R', 'nacht',   [meting(50, 1780000004000)]);
    zetV5(EEN,  'Z', 'R', 'dag',     [meting(35, 1780000005000)]);
    zetV5(EEN,  'Z', 'L', 'nacht',   [meting(36, 1780000006000)]);
    zetRuw(`sl_v5_${NODE}_kapot`, '[]');            // te weinig delen
    zetRuw(`sl_v4_${NODE}_dag`, JSON.stringify([meting(41, 1780000007000)]));
    zetRuw(`sl_naam_${NODE}`, 'Teststraat');
    // de cache gelijktrekken zoals de boot dat zou doen
    opslagHersynchroniseer(gezet);
    opslagBootKlaar = true;

    // ── S1: dezelfde sleutels als een rauwe scan ──────────────
    const rauweScan = (voorvoegsel) => {
      const uit = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(voorvoegsel)) uit.push(k);
      }
      return uit.sort();
    };
    const viaMap = opslagSleutels(`sl_v5_${NODE}_`).sort();
    const viaLs  = rauweScan(`sl_v5_${NODE}_`);
    eis('S1a sleutellijst identiek', JSON.stringify(viaMap) === JSON.stringify(viaLs),
        viaLs.length + ' sleutels', viaMap.length + ' sleutels');
    eis('S1b geen vreemde voorvoegsels', viaMap.every(k => k.startsWith(`sl_v5_${NODE}_`)),
        'alle sl_v5_' + NODE + '_', viaMap.filter(k => !k.startsWith(`sl_v5_${NODE}_`)).join(',') || 'geen');
    eis('S1c sl_v4_ en sl_naam_ niet meegenomen', !viaMap.some(k => k.includes('sl_v4_') || k.includes('sl_naam_')),
        'niet aanwezig', viaMap.filter(k => k.includes('v4') || k.includes('naam')).join(',') || 'niet aanwezig');
    eis('S1d lege node geeft lege lijst', opslagSleutels(`sl_v5_${LEEG}_`).length === 0,
        0, opslagSleutels(`sl_v5_${LEEG}_`).length);

    // ── S2: terugval zolang de boot niet klaar is ─────────────
    // De Map wordt met opzet leeggemaakt terwijl localStorage vol staat.
    // Met opslagBootKlaar=false MOET de functie toch alles vinden.
    const cacheKopie = new Map(opslagCache);
    opslagCache.clear();
    opslagBootKlaar = false;
    const terugval = opslagSleutels(`sl_v5_${NODE}_`).sort();
    eis('S2a terugval leest localStorage', JSON.stringify(terugval) === JSON.stringify(viaLs),
        viaLs.length + ' sleutels', terugval.length + ' sleutels');
    opslagBootKlaar = true;
    const zonderCache = opslagSleutels(`sl_v5_${NODE}_`);
    eis('S2b met lege Map en boot-klaar: leeg', zonderCache.length === 0,
        '0 (bewijst dat S2a echt de terugval was)', zonderCache.length);
    for (const [k, v] of cacheKopie) if (!opslagCache.has(k)) opslagCache.set(k, v);

    // ── S3: de omgezette functies geven hetzelfde antwoord ────
    // Referentie: de code zoals hij vóór V11.22.0 was.
    const refEenRichting = (nodeId) => {
      const s = new Set();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(`sl_v5_${nodeId}_`)) continue;
        const delen = k.replace(`sl_v5_${nodeId}_`, '').split('_');
        if (delen.length >= 3) s.add(delen[0]);
      }
      return s.size <= 1;
    };
    const refAantal = (nodeId) => {
      const s = new Set();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(`sl_v5_${nodeId}_`)) continue;
        const delen = k.replace(`sl_v5_${nodeId}_`, '').split('_');
        if (delen.length >= 3) s.add(delen[0]);
      }
      return s.size;
    };
    eis('S3a isEenRichtingNode (2 richtingen)', isEenRichtingNode(NODE) === refEenRichting(NODE),
        refEenRichting(NODE), isEenRichtingNode(NODE));
    eis('S3b isEenRichtingNode (1 richting)', isEenRichtingNode(EEN) === refEenRichting(EEN),
        refEenRichting(EEN), isEenRichtingNode(EEN));
    eis('S3c isEenRichtingNode (0 sleutels)', isEenRichtingNode(LEEG) === refEenRichting(LEEG),
        refEenRichting(LEEG), isEenRichtingNode(LEEG));
    eis('S3d aantalAanrijRichtingen', aantalAanrijRichtingen(NODE) === refAantal(NODE),
        refAantal(NODE), aantalAanrijRichtingen(NODE));
    eis('S3e aantalAanrijRichtingen (1)', aantalAanrijRichtingen(EEN) === refAantal(EEN),
        refAantal(EEN), aantalAanrijRichtingen(EEN));

    const alle = haalAlleV5MetingenVoorNode(NODE, 'dag');
    eis('S3f haalAlleV5MetingenVoorNode telt de dag-emmers', alle.length === 3,
        3, alle.length);
    eis('S3g ... en laat het andere dagdeel staan', !alle.some(m => m.duur === 50),
        'geen nacht-meting', alle.map(m => m.duur).join(','));
    const nacht = haalAlleV5MetingenVoorNode(NODE, 'nacht');
    eis('S3h ... en vindt het nacht-dagdeel wel', nacht.length === 1 && nacht[0].duur === 50,
        '1 meting van 50s', nacht.length + ' / ' + (nacht[0] && nacht[0].duur));

    // ── S4: randgevallen ─────────────────────────────────────
    eis('S4a kapotte sleutel telt niet mee', aantalAanrijRichtingen(NODE) === 2,
        '2 (N en O, niet "kapot")', aantalAanrijRichtingen(NODE));
    const versObject = haalAlleV5MetingenVoorNode(NODE, 'dag');
    versObject.sort((a, b) => a.duur - b.duur);
    const nogmaals = haalAlleV5MetingenVoorNode(NODE, 'dag');
    eis('S4b elke aanroep geeft een VERS object', nogmaals.length === 3
        && nogmaals !== versObject,
        'geen gedeelde array', nogmaals.length + ' / gedeeld=' + (nogmaals === versObject));

    // ── S5: de spooksleutel ──────────────────────────────────
    // opslagLeesRuw zet OOK een misser in de Map: { ruw: null }. Die sleutel
    // bestaat niet en mag dus nooit in een sleutellijst opduiken. Dit was de
    // eerste fout van deze release — 14 sleutels uit de Map tegen 5 uit
    // localStorage — en hij kwam pas boven in de volledige testronde.
    const spookKey = `sl_v5_${NODE}_ZZ_R_dag`;
    eis('S5a de spooksleutel bestaat niet', localStorage.getItem(spookKey) === null,
        null, localStorage.getItem(spookKey));
    opslagLeesRuw(spookKey);                       // dit zet { ruw: null } in de Map
    eis('S5b ... maar staat nu wel IN de Map', opslagCache.has(spookKey),
        true, opslagCache.has(spookKey));
    eis('S5c ... en wordt tóch niet meegeteld',
        !opslagSleutels(`sl_v5_${NODE}_`).includes(spookKey),
        'niet in de lijst', opslagSleutels(`sl_v5_${NODE}_`).includes(spookKey));
    eis('S5d ... dus het aantal richtingen klopt nog', aantalAanrijRichtingen(NODE) === 2,
        2, aantalAanrijRichtingen(NODE));
    opslagCache.delete(spookKey);

    // ── S6: rauwe schrijvers buiten de laag ──────────────────
    // Dit is de kern van de release. Elke localStorage.setItem, waar hij ook
    // vandaan komt, moet de Map bijwerken — anders wordt een fixture (of een
    // merge) onzichtbaar en meet een groene test niets meer.
    const sluipKey = `sl_v5_${NODE}_W_R_dag`;
    localStorage.setItem(sluipKey, JSON.stringify([meting(44, 1780000008000)]));
    gezet.push(sluipKey);
    eis('S6a een rauwe TOEVOEGING wordt vanzelf gezien', aantalAanrijRichtingen(NODE) === 3,
        '3 (N, O, W)', aantalAanrijRichtingen(NODE));
    localStorage.removeItem(sluipKey);
    eis('S6b een rauwe VERWIJDERING ook', aantalAanrijRichtingen(NODE) === 2,
        2, aantalAanrijRichtingen(NODE));

    // ── S6c-f: de wissel die een teller zou missen ───────────
    // Evenveel sleutels erbij als eraf: localStorage.length blijft gelijk.
    // Dit is wat een merge doet (doelsleutel erbij, bronsleutel eraf) en wat
    // drie testsuites doen (alles wissen, evenveel terugzetten). Een eerdere
    // opzet van deze release gebruikte die teller en brak er precies hier op.
    const bronKey = `sl_v5_${NODE}_O_R_dag`;       // bestaat
    const doelKey = `sl_v5_${NODE}_Q_R_dag`;       // nieuw
    const telVoor = localStorage.length;
    localStorage.setItem(doelKey, JSON.stringify([meting(45, 1780000009000)]));
    localStorage.removeItem(bronKey);
    gezet.push(doelKey, bronKey);
    eis('S6c de sleuteltelling verschuift niet bij zo’n wissel',
        localStorage.length === telVoor, telVoor, localStorage.length);
    const naWissel = opslagSleutels(`sl_v5_${NODE}_`);
    eis('S6d ... en de Map klopt tóch',
        !naWissel.includes(bronKey) && naWissel.includes(doelKey),
        'bron weg, doel aanwezig',
        'bron=' + naWissel.includes(bronKey) + ' doel=' + naWissel.includes(doelKey));
    // N (twee emmers), O (alleen nog de nacht-emmer — die is niet verplaatst)
    // en de nieuwe Q. Dus drie, niet twee: de dag-emmer van O verdween wel,
    // maar zijn aanrijrichting leeft voort in het andere dagdeel.
    eis('S6e ... ook in het afgeleide antwoord', aantalAanrijRichtingen(NODE) === 3,
        '3 (N, O via nacht, Q)', aantalAanrijRichtingen(NODE));
    // fixture herstellen voor de rest van de suite
    localStorage.removeItem(doelKey);
    zetV5(NODE, 'O', 'R', 'dag', [meting(38, 1780000003000)]);
    eis('S6f fixture hersteld', aantalAanrijRichtingen(NODE) === 2,
        2, aantalAanrijRichtingen(NODE));

    // ── S6g: de omwikkeling zit er, en breekt geen schrijving ─
    eis('S6g Storage.prototype.setItem is omwikkeld',
        !/\[native code\]/.test(String(Storage.prototype.setItem)),
        'omwikkeld', String(Storage.prototype.setItem).slice(0, 40));
    let gooideDoor = false;
    try { localStorage.setItem('sl_test_quota', 'x'.repeat(10)); }
    catch(e) { gooideDoor = true; }
    gezet.push('sl_test_quota');
    eis('S6h een gewone schrijving gaat gewoon door', !gooideDoor
        && localStorage.getItem('sl_test_quota') === 'xxxxxxxxxx',
        'geschreven zonder fout', localStorage.getItem('sl_test_quota'));
    eis('S6i ... en staat meteen in de Map',
        opslagCache.get('sl_test_quota')?.ruw === 'xxxxxxxxxx',
        'xxxxxxxxxx', opslagCache.get('sl_test_quota')?.ruw);

    // ── S6j-l: de merge houdt zijn eigen vangnet ─────────────
    const mergeBron = zc(mergeRichtingen);
    eis('S6j mergeRichtingen synchroniseert na afloop',
        (mergeBron.match(/opslagHersynchroniseer\(/g) || []).length >= 2,
        '>=2 (succespad en rollback)',
        (mergeBron.match(/opslagHersynchroniseer\(/g) || []).length);
    eis('S6k mergeUndoUitvoeren synchroniseert',
        zc(mergeUndoUitvoeren).includes('opslagHersynchroniseer('),
        'aanwezig', zc(mergeUndoUitvoeren).includes('opslagHersynchroniseer('));
    eis('S6l de merge blijft RAUW schrijven (rollback moet kunnen gooien)',
        mergeBron.includes('localStorage.setItem'),
        'localStorage.setItem aanwezig', mergeBron.includes('localStorage.setItem'));

    // ── S7: regressie — geen volledige scan meer ─────────────
    const omgezet = {
      isEenRichtingNode, aantalAanrijRichtingen, haalAlleV5MetingenVoorNode,
      verzamelV5Richtingen, algemeenMetingen, zetEnkelRicht, berekenDekkingScore,
      renderV9RichtingenVoorNode
    };
    for (const [naam, fn] of Object.entries(omgezet)) {
      const bron = zc(fn);
      const scant = /localStorage\.length/.test(bron) || /localStorage\.key\(/.test(bron)
                 || /Object\.keys\(localStorage\)/.test(bron);
      eis(`S7 ${naam} scant niet meer`, !scant, 'geen sleutelscan',
          scant ? 'scant nog' : 'geen sleutelscan');
    }
    eis('S7x opslagSleutels mag dat juist wél (de terugval)',
        /localStorage\.length/.test(zc(opslagSleutels)),
        'terugval aanwezig', /localStorage\.length/.test(zc(opslagSleutels)));

    // ── S8: en het is ook echt sneller ───────────────────────
    const extra = [];
    for (let i = 0; i < 3000; i++) {
      const k = `sl_v4_${870000 + i}_dag`;
      localStorage.setItem(k, '[]'); gezet.push(k); extra.push(k);
    }
    opslagHersynchroniseer(extra);
    const klok = (fn, n = 12) => {
      fn(); const t = [];
      for (let i = 0; i < n; i++) { const a = performance.now(); fn(); t.push(performance.now() - a); }
      t.sort((x, y) => x - y); return t[Math.floor(n / 2)];
    };
    const tNieuw = klok(() => isEenRichtingNode(NODE));
    const tOud   = klok(() => refEenRichting(NODE));
    eis('S8a zelfde antwoord bij 3.000 extra sleutels',
        isEenRichtingNode(NODE) === refEenRichting(NODE),
        refEenRichting(NODE), isEenRichtingNode(NODE));
    eis('S8b de Map-weg is minstens 2x sneller', tNieuw * 2 <= tOud,
        'oud/nieuw >= 2', (tOud / Math.max(tNieuw, 0.001)).toFixed(1) + 'x'
          + ' (' + tOud.toFixed(2) + ' ms -> ' + tNieuw.toFixed(2) + ' ms)');

  } finally {
    // ── alles exact terugdraaien ──────────────────────────────
    for (const k of gezet) if (!origineel.has(k)) origineel.set(k, null);
    for (const [k, v] of origineel) {
      try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
      catch(e) {}
    }
    opslagBootKlaar = bewaardBootKlaar;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
