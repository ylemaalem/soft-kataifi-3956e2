// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_opslag_export.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.23.0, release B van het opslagplan. Nog steeds GEEN IndexedDB
//  en GEEN gedragswijziging: localStorage blijft de bron van waarheid. Wat
//  verandert is dat de laatste lees- en schrijfpaden buiten de renderlus door
//  de opslaglaag lopen — de export en de import voorop.
//
//  WAAROM DE EXPORT VOOROP. verzamelBackupData las Object.keys(localStorage).
//  Zolang localStorage de bron is klopt dat, maar het opslagplan haalt die
//  bron er later onderuit — en dan zou die lus over een LEGE lijst lopen:
//  geen fout, geen waarschuwing, een geldig backupbestand met niets erin.
//  De export is nu juist het vangnet waar elke latere stap op leunt. Daarom
//  gaat hij als eerste om, ruim voordat er iets aan de bron verandert.
//
//  DE VAL DIE HIERBIJ IS VERMEDEN. `opslagLees(k)` geeft bij onleesbare JSON
//  zijn terugvalwaarde terug, en die is standaard null. Zou de export daarop
//  leunen, dan werden de 2.208 niet-JSON-sleutels van de export van 28
//  augustus (sl_naam_, sl_tag_, vlaggen) stil `null`. E2 legt dat vast.
//
//  E1  verzamelBackupData geeft exact dezelfde inhoud als voorheen
//  E2  KERN: een niet-JSON-waarde gaat als RUWE TEKST mee, niet als null
//  E3  ... en alleen sl_-sleutels doen mee
//  E4  importeerData schrijft door de laag, met dezelfde overslaan-regels
//  E5  de twee top-level lezingen gebeuren nu ná de boot
//  E6  REGRESSIE: de omgezette scanners geven hetzelfde antwoord
//  E7  REGRESSIE: geen sleutelscan meer buiten de laag en de migraties
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_opslag_export.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testOpslagExport().regels);
// ═══════════════════════════════════════════════════════════════

function testOpslagExport() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');

  // Fixture-beheer: per sleutel de OORSPRONKELIJKE waarde onthouden en aan het
  // eind exact terugzetten. De cache-Map wordt met rust gelaten: sinds
  // V11.22.0 werkt elke localStorage-schrijving hem vanzelf bij. Een eerdere
  // versie van deze suite herstelde een momentopname van opslagCache, en gooide
  // daarmee sleutels weg die ANDERE suites er intussen in hadden gezet - dat
  // liet E1b in de volledige ronde omvallen terwijl de app niets mankeerde.
  const origineel = new Map();
  const zetRuw = (k, v) => {
    if (!origineel.has(k)) origineel.set(k, localStorage.getItem(k));
    localStorage.setItem(k, v);
  };
  const onthoud = (k) => { if (!origineel.has(k)) origineel.set(k, localStorage.getItem(k)); };
  const bewaardBootKlaar = opslagBootKlaar;
  const bewaardConflog = klasseVerdelingLog;
  const bewaardStad = huidigeStad;

  const NODE = 870101;

  try {
    opslagBootKlaar = true;

    // ── fixture: JSON én niet-JSON én een vreemde sleutel ─────
    zetRuw(`sl_v4_${NODE}_dag`, JSON.stringify([{ duur: 40, tijd: 1780000001000 }]));
    zetRuw(`sl_naam_${NODE}`, 'Blekerssingel, Gouda');      // GEEN JSON
    zetRuw(`sl_enkelricht_${NODE}`, 'rechtdoor');           // GEEN JSON
    zetRuw(`sl_tag_${NODE}`, 'rond');                       // GEEN JSON
    zetRuw('niet_van_ons_' + NODE, 'x');                    // geen sl_-sleutel

    // ── E1: identiek aan de oude implementatie ────────────────
    const refBackup = () => {
      const data = {};
      for (const key of Object.keys(localStorage)) {
        if (!(typeof key === 'string' && key.startsWith('sl_'))) continue;
        try { data[key] = JSON.parse(localStorage.getItem(key)); }
        catch(e) { data[key] = localStorage.getItem(key); }
      }
      return data;
    };
    const nieuw = verzamelBackupData();
    const oud = refBackup();
    // De laag kan sleutels kennen die localStorage NIET heeft: waarden die deze
    // sessie niet pasten in een vol quotum (`onopgeslagen`). Die horen in de
    // export - zie de toelichting bij verzamelBackupData - maar ze maken de
    // vergelijking met de oude lus eenzijdig. Vandaar: alles wat in
    // localStorage staat moet erin zitten, en wat er extra in zit moet een
    // onopgeslagen waarde zijn.
    const ontbreekt = Object.keys(oud).filter(k => !(k in nieuw));
    eis('E1a niets uit localStorage ontbreekt', ontbreekt.length === 0,
        'geen ontbrekende sleutels', ontbreekt.slice(0, 3).join(', ') || 'geen');
    const extra = Object.keys(nieuw).filter(k => !(k in oud));
    eis('E1a2 wat extra is, is onopgeslagen',
        extra.every(k => opslagCache.get(k)?.onopgeslagen),
        'alleen onopgeslagen waarden',
        extra.filter(k => !opslagCache.get(k)?.onopgeslagen).slice(0, 3).join(', ') || 'klopt');
    // Per sleutel vergelijken, niet de hele objecten stringify-en: de
    // sleutelvolgorde van de Map is een andere dan die van localStorage, en
    // JSON.stringify is daar gevoelig voor. Het gaat om de INHOUD.
    const anders = Object.keys(oud)
      .filter(k => JSON.stringify(nieuw[k]) !== JSON.stringify(oud[k]));
    eis('E1b dezelfde waarden', anders.length === 0,
        'geen verschillen', anders.slice(0, 3).join(', ') || 'geen verschillen');
    eis('E1c de leerdata staat erin',
        Array.isArray(nieuw[`sl_v4_${NODE}_dag`]) && nieuw[`sl_v4_${NODE}_dag`][0].duur === 40,
        '40', nieuw[`sl_v4_${NODE}_dag`] && nieuw[`sl_v4_${NODE}_dag`][0]?.duur);

    // ── E2: DE KERN — niet-JSON blijft tekst ──────────────────
    eis('E2a een straatnaam gaat als tekst mee',
        nieuw[`sl_naam_${NODE}`] === 'Blekerssingel, Gouda',
        'Blekerssingel, Gouda', JSON.stringify(nieuw[`sl_naam_${NODE}`]));
    eis('E2b ... en wordt dus NIET null',
        nieuw[`sl_naam_${NODE}`] !== null, 'niet null', nieuw[`sl_naam_${NODE}`]);
    eis('E2c hetzelfde voor sl_enkelricht_',
        nieuw[`sl_enkelricht_${NODE}`] === 'rechtdoor',
        'rechtdoor', JSON.stringify(nieuw[`sl_enkelricht_${NODE}`]));
    eis('E2d hetzelfde voor sl_tag_',
        nieuw[`sl_tag_${NODE}`] === 'rond', 'rond', JSON.stringify(nieuw[`sl_tag_${NODE}`]));
    eis('E2e de export leunt niet op de terugval van opslagLees',
        !/opslagLees\s*\(\s*key\s*[,)]/.test(zc(verzamelBackupData)),
        'gebruikt opslagLeesRuw + eigen parse', zc(verzamelBackupData).includes('opslagLeesRuw'));

    // ── E3: alleen sl_-sleutels ───────────────────────────────
    eis('E3a een vreemde sleutel doet niet mee',
        !(('niet_van_ons_' + NODE) in nieuw), 'afwezig', ('niet_van_ons_' + NODE) in nieuw);
    eis('E3b de selectie loopt nog via exportSleutelMee',
        zc(verzamelBackupData).includes('exportSleutelMee'),
        'aanwezig', zc(verzamelBackupData).includes('exportSleutelMee'));

    // ── E4: import schrijft door de laag ──────────────────────
    const impBron = zc(importeerData);
    eis('E4a importeerData schrijft via opslagSchrijf',
        impBron.includes('opslagSchrijf('), 'aanwezig', impBron.includes('opslagSchrijf('));
    eis('E4b ... en leest de bestaande sleutel via de laag',
        impBron.includes('opslagLeesRuw('), 'aanwezig', impBron.includes('opslagLeesRuw('));
    eis('E4c ... en schrijft niet meer rechtstreeks',
        !/localStorage\.setItem/.test(impBron), 'geen localStorage.setItem',
        /localStorage\.setItem/.test(impBron) ? 'nog aanwezig' : 'weg');
    // functioneel: een nieuwe sleutel landt, een bestaande wordt overgeslagen
    const impKey = `sl_v4_${NODE}_avond`;
    onthoud(impKey);
    const geschreven = opslagSchrijf(impKey, [{ duur: 55, tijd: 1780000002000 }]);
    eis('E4d een schrijving door de laag landt in localStorage',
        geschreven && JSON.parse(localStorage.getItem(impKey))[0].duur === 55,
        55, geschreven && JSON.parse(localStorage.getItem(impKey) || 'null')?.[0]?.duur);
    eis('E4e ... en komt meteen in de export terug',
        verzamelBackupData()[impKey]?.[0]?.duur === 55,
        55, verzamelBackupData()[impKey]?.[0]?.duur);

    // ── E2f: een onopgeslagen waarde wordt gered ─────────────
    // Simuleert wat opslagSchrijfRuw doet als het quotum vol zit: de waarde
    // staat in de cache, niet in localStorage. Precies die data is het waard
    // om in een backup te belanden.
    const volKey = `sl_v4_${NODE}_nacht`;
    onthoud(volKey);
    opslagCache.set(volKey, { ruw: JSON.stringify([{ duur: 77, tijd: 1780000003000 }]),
                              onopgeslagen: true });
    eis('E2f staat niet in localStorage', localStorage.getItem(volKey) === null,
        null, localStorage.getItem(volKey));
    eis('E2g ... maar wel in de export',
        verzamelBackupData()[volKey]?.[0]?.duur === 77,
        77, verzamelBackupData()[volKey]?.[0]?.duur);
    opslagCache.delete(volKey);

    // ── E5: de twee top-level lezingen ────────────────────────
    eis('E5a herstelOpslagGlobals bestaat', typeof herstelOpslagGlobals === 'function',
        'function', typeof herstelOpslagGlobals);
    const hBron = zc(herstelOpslagGlobals);
    eis('E5b hij herstelt sl_conflog', hBron.includes('sl_conflog'),
        'aanwezig', hBron.includes('sl_conflog'));
    eis('E5c hij herstelt sl_stad_cache', hBron.includes('sl_stad_cache'),
        'aanwezig', hBron.includes('sl_stad_cache'));
    eis('E5d startApp roept hem aan ná de boot',
        /startOpslagBoot[\s\S]{0,200}herstelOpslagGlobals/.test(zc(startApp)),
        'na startOpslagBoot', /startOpslagBoot[\s\S]{0,200}herstelOpslagGlobals/.test(zc(startApp)));
    zetRuw('sl_conflog', JSON.stringify([{ t: 1 }, { t: 2 }]));
    zetRuw('sl_stad_cache', JSON.stringify({ stad: 'Gouda' }));
    klasseVerdelingLog = []; huidigeStad = null;
    herstelOpslagGlobals();
    eis('E5e conflog komt terug', klasseVerdelingLog.length === 2, 2, klasseVerdelingLog.length);
    eis('E5f de stad komt terug', huidigeStad === 'Gouda', 'Gouda', huidigeStad);
    // een kapotte waarde mag geen crash geven en geen rommel achterlaten
    zetRuw('sl_conflog', 'geen json');
    klasseVerdelingLog = [{ t: 9 }];
    herstelOpslagGlobals();
    eis('E5g een kapotte conflog geeft een lege lijst',
        Array.isArray(klasseVerdelingLog) && klasseVerdelingLog.length === 0,
        '[]', JSON.stringify(klasseVerdelingLog));

    // ── E6: de omgezette scanners, tegen hun oude vorm ────────
    const refPos = () => {
      const p = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('sl_pos_')) continue;
        try { const v = JSON.parse(localStorage.getItem(k));
          if (v && v.lat && v.lon) p.push(k); } catch(e) {}
      }
      return p.length;
    };
    zetRuw(`sl_pos_${NODE}`, JSON.stringify({ lat: 52.01, lon: 4.71, bron: 'osm' }));
    eis('E6a laadAlleGeleerdePosities', laadAlleGeleerdePosities().length === refPos(),
        refPos(), laadAlleGeleerdePosities().length);
    const refIds = () => {
      const ids = new Set();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        for (const prefix of LS_PREFIXEN) {
          if (k?.startsWith(prefix)) { const d = k.replace(prefix, '').split('_');
            if (d.length >= 2) ids.add(d[0]); break; }
        }
      }
      return [...ids].sort();
    };
    eis('E6b haalAlleOsmIds', JSON.stringify(haalAlleOsmIds().sort()) === JSON.stringify(refIds()),
        refIds().length + ' ids', haalAlleOsmIds().length + ' ids');
    // berekenLocalStorageKB meet nu de opslaglaag, en die kent ook waarden die
    // deze sessie niet in localStorage pasten (`onopgeslagen`). De juiste eis is
    // dus niet "gelijk aan localStorage" maar "localStorage plus die waarden" —
    // anders faalt deze regel zodra een andere suite een vol quotum heeft
    // gesimuleerd. Dat gebeurde: in omgekeerde volgorde viel hij om.
    let refBytes = 0;
    for (const k of Object.keys(localStorage)) refBytes += (localStorage.getItem(k) || '').length * 2;
    for (const [k, memo] of opslagCache) {
      if (memo.onopgeslagen && localStorage.getItem(k) === null) refBytes += (memo.ruw || '').length * 2;
    }
    eis('E6c berekenLocalStorageKB', berekenLocalStorageKB() === Math.round(refBytes / 1024),
        Math.round(refBytes / 1024), berekenLocalStorageKB());
    zetRuw(`sl_route_${NODE}_${NODE}_${NODE}`, JSON.stringify([{ totaal: 70, timestamp: Date.now() }]));
    eis('E6d nodeIsInBekendeRoute', nodeIsInBekendeRoute(String(NODE)) === true,
        true, nodeIsInBekendeRoute(String(NODE)));
    eis('E6e vindRouteDataVoorNode', vindRouteDataVoorNode(String(NODE))?.observaties === 1,
        1, vindRouteDataVoorNode(String(NODE))?.observaties);

    // ── E7: regressie op de vorm ──────────────────────────────
    const omgezet = {
      verzamelBackupData, laadAlleGeleerdePosities, nodeIsInBekendeRoute,
      vindRouteDataVoorNode, telPassiefMetingen, haalAlleOsmIds, laadDashboard,
      berekenLocalStorageKB, checkLocalStorageRuimte, opslagOverzicht,
      analyseerBevestigLus, toonV9Richtingen, renderV9Lijst, toonKlokAnalyse,
      telTerugRecords, telDuurLabels, ruimRedundantePosCache
    };
    for (const [naam, fn] of Object.entries(omgezet)) {
      const bron = zc(fn);
      const scant = /localStorage\.length/.test(bron) || /localStorage\.key\(/.test(bron)
                 || /Object\.keys\(localStorage\)/.test(bron);
      eis(`E7 ${naam} scant niet meer`, !scant, 'geen sleutelscan',
          scant ? 'scant nog' : 'geen sleutelscan');
    }
    eis('E7x voerOpruimPassenUit scant niet meer...',
        !/Object\.keys\(localStorage\)/.test(zc(voerOpruimPassenUit)),
        'geen scan', /Object\.keys\(localStorage\)/.test(zc(voerOpruimPassenUit)));
    eis('E7y ... maar wist nog steeds RAUW (bewust, zie de toelichting)',
        /localStorage\.removeItem/.test(zc(voerOpruimPassenUit)),
        'rauw wissen behouden', /localStorage\.removeItem/.test(zc(voerOpruimPassenUit)));
    eis('E7z exporteerMeetdata schermt opslagSleutels niet meer af',
        !/const\s+opslagSleutels\s*=/.test(zc(exporteerMeetdata)),
        'geen lokale const opslagSleutels',
        /const\s+opslagSleutels\s*=/.test(zc(exporteerMeetdata)) ? 'schermt nog af' : 'vrij');

  } finally {
    for (const [k, v] of origineel) {
      try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
      catch(e) {}
    }
    opslagBootKlaar = bewaardBootKlaar;
    klasseVerdelingLog = bewaardConflog;
    huidigeStad = bewaardStad;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD').length;
  return { geslaagd: regels.length - gefaald, gefaald, regels };
}
