// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_privacyscan.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.20: de privacyscan. Sinds V11.37.20 staat het landelijke,
//  openbare OSM-bestand in de map kaart/ (OSM-nummers en straatnamen van alle
//  verkeerslichten van Nederland). Dat is de enige uitzondering: buiten kaart/
//  mogen geen OSM-nummers, straatnamen of echte tijden staan.
//
//  WAT DE SCAN ZOEKT, in elk tekstbestand buiten kaart/ (de lijst komt van de
//  testserver, /__bestanden.json):
//    nummer  een getal van 6 tot 12 cijfers dat in kaart/lichten.json een
//            licht, een weg of een punt van een weg is;
//    naam    een straatnaam uit kaart/lichten.json: met twee of meer woorden,
//            of één woord van minstens 6 letters dat eindigt op een
//            straatwoord (straat, weg, laan, plein, ...). Hoofdletters tellen.
//    tijd    een moment: een kloktijd met seconden (uu:mm:ss), een datum met
//            een kloktijd erachter (jjjj-mm-dd uu:mm, of dag maand uu:mm), of een
//            tijdstempel in milliseconden tussen 1 juli 2026 en eind 2027 dat
//            geen rond getal is (rond = een veelvoud van 10.000.000, zoals de
//            bedachte klokken van de toetsen).
//    Niet gezocht: een kloktijd zonder datum (22:00 als grens van de nacht,
//    0:28 als aftelling) en een datum zonder kloktijd.
//  BEKEND. Wat er bij de bouw van V11.37.20 al stond, staat hieronder als
//  vingerafdruk (bestand, soort en waarde samen, fnv), met de reden; de waarde
//  zelf staat niet in deze toets. Bekende plekken keuren de toets niet af,
//  maar worden wel gemeld (PV6). Een nieuwe plek keurt hem af.
//
//  PV1  de lijst met bestanden en het woordenboek uit kaart/lichten.json
//  PV2  de scan werkt (op voorbeelden: wel en niet)
//  PV3  geen nieuwe OSM-nummers buiten kaart/
//  PV4  geen nieuwe straatnamen buiten kaart/
//  PV5  geen nieuwe echte tijden buiten kaart/
//  PV6  de bekende plekken (de restlijst), per soort en per bestand
//  PV7  kaart/ bevat alleen de zeven bestanden met neutrale namen
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_privacyscan.js';
//      document.head.appendChild(s);
//      s.onload = () => testPrivacyscan().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

const PV_STRAATWOORD = /(straat|weg|laan|plein|kade|gracht|singel|dijk|dreef|pad|baan|ring|park|hof|steeg|markt|brug|plantsoen|boulevard|allee|wal|veld|tunnel|viaduct|haven|poort|zijde|oever|dam|kanaal|rotonde|erf|kamp|akker|weide|berg|bos)$/;
const PV_MAAND = '(jan|januari|feb|februari|mrt|maart|apr|april|mei|jun|juni|jul|juli|aug|augustus|sep|sept|september|okt|oktober|nov|november|dec|december)';
const PV_VAN = Date.UTC(2026, 6, 1), PV_TOT = Date.UTC(2028, 0, 1);

const pvFnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };

// Het woordenboek uit de tekst van kaart/lichten.json: { ids: Set, namen: Map(eerste woord -> [namen]), lichten, wegen }.
function pvWoordenboek(tekst) {
  const ids = new Set(), namen = new Set();
  let lichten = 0, wegen = 0;
  for (const r of tekst.split('\n')) {
    if (!r.startsWith('{"type"')) continue;
    const e = JSON.parse(r.endsWith(',') ? r.slice(0, -1) : r);
    ids.add(String(e.id));
    if (e.type === 'node') lichten++;
    else { wegen++; for (const n of e.nodes) ids.add(String(n)); if (e.tags && typeof e.tags.name === 'string') namen.add(e.tags.name); }
  }
  const perEerste = new Map();
  for (const n of namen) {
    const delen = n.split(/\s+/);
    if (!(delen.length >= 2 || (n.length >= 6 && PV_STRAATWOORD.test(n.toLowerCase())))) continue;   // alleen wat duidelijk een straatnaam is
    if (!perEerste.has(delen[0])) perEerste.set(delen[0], []);
    perEerste.get(delen[0]).push(n);
  }
  return { ids, namen: perEerste, lichten, wegen, aantalNamen: namen.size };
}

// De scan van één bestand: [{ soort, waarde, regel }].
function pvScan(tekst, wb) {
  const uit = [];
  const letter = /[A-Za-zÀ-ÿ0-9]/;
  const regelVan = (i) => { let n = 1; for (let k = tekst.indexOf('\n'); k >= 0 && k < i; k = tekst.indexOf('\n', k + 1)) n++; return n; };
  for (const m of tekst.matchAll(/(?<![\d.])\d{6,12}(?![\d.])/g)) if (wb.ids.has(m[0])) uit.push({ soort: 'nummer', waarde: m[0], regel: regelVan(m.index) });
  for (const m of tekst.matchAll(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'.-]*/g)) {
    const l = wb.namen.get(m[0]);
    if (!l || letter.test(tekst[m.index - 1] || '')) continue;
    for (const n of l) if (tekst.startsWith(n, m.index) && !letter.test(tekst[m.index + n.length] || '')) uit.push({ soort: 'naam', waarde: n, regel: regelVan(m.index) });
  }
  const tijd = new RegExp('\\b([01]?\\d|2[0-3]):[0-5]\\d:[0-5]\\d\\b|\\b20\\d\\d-[01]\\d-[0-3]\\d[T ][0-2]?\\d:[0-5]\\d|\\b[0-3]?\\d ' + PV_MAAND + '\\.?( 20\\d\\d)?,? [0-2]?\\d:[0-5]\\d', 'gi');
  for (const m of tekst.matchAll(tijd)) uit.push({ soort: 'tijd', waarde: m[0], regel: regelVan(m.index) });
  for (const m of tekst.matchAll(/(?<![\d.])1[78]\d{11}(?![\d.])/g)) {
    const v = Number(m[0]);
    if (v >= PV_VAN && v < PV_TOT && v % 10000000 !== 0) uit.push({ soort: 'tijd', waarde: m[0], regel: regelVan(m.index) });
  }
  return uit;
}

// De bekende plekken bij de bouw van V11.37.20: vingerafdruk van 'bestand|soort|waarde' -> reden. Zie PV6.
const PV_BEKEND = {
  // OSM-nummers: 3 nummers op 14 plekken
  '9ba2b910': 'index.html: één nummer in de eenmalige reparatie van één richting-record (V11.37.4): de functienaam, de sleutel en de logregel (4 regels, code)',
  '918adad0': 'test_achter.js: hetzelfde nummer in de toets van die reparatie (AR10, 7 regels)',
  '5c66422': 'index.html: één nummer in twee commentaarregels (een veldgeval)',
  'fbf796ae': 'index.html: één nummer in een commentaarregel (een veldgeval)',
  // straatnaam: vals alarm
  '96b7712a': 'index.html: het woord voor de buitenste ring van de radar (commentaar), geen straat',
  // tijden: 8 momenten op 10 plekken
  'c83111d1': 'index.html: een ritmoment in een commentaarregel (een veldgeval)',
  '3afe64f3': 'index.html: het tijdstip van het record dat de reparatie zoekt, in het commentaar naast de code',
  '279619eb': 'index.html: datzelfde tijdstip als getal (code van de reparatie)',
  '260f162b': 'test_achter.js: datzelfde tijdstip als getal (AR10)',
  '5b58f668': 'index.html: het tijdstip van een commit (commentaar naast FASE8_DEPLOY_MS)',
  '25555d3d': 'index.html: datzelfde tijdstip als getal (FASE8_DEPLOY_MS, code)',
  '763da2d0': 'index.html: het tijdstip van een eerdere versie in een commentaarregel (ontwikkeling)',
  '7e41cd59': 'index.html: het tijdstip van een eerdere versie in een commentaarregel (ontwikkeling)',
  '2abc26b': 'test_opruimrem.js: een bedachte klok van de toets (datum met tijd)',
};

// ── Draait op de testpagina ──────────────────────────────────
async function testPrivacyscan() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const haal = async (pad) => { const r = await fetch(new URL(pad, location.href).href + (pad.includes('?') ? '&' : '?') + 't=' + Date.now(), { cache: 'no-store' }); if (!r.ok) throw new Error(pad + ' ' + r.status); return r; };
  try {
    // ═══ PV1 — de lijst en het woordenboek ═══════════════════════
    let lijst, bron = '/__bestanden.json';
    try { lijst = await (await haal('/__bestanden.json')).json(); }
    catch (e) { bron = '/__toetsen.json (beperkt)'; lijst = ['index.html', 'testserver.py', '.gitignore'].concat(await (await haal('/__toetsen.json')).json()); }
    const wb = pvWoordenboek(await (await haal('kaart/lichten.json')).text());
    eis('PV1 de testserver geeft de bestanden buiten kaart/ (met index.html, testserver.py en deze toets, zonder kaart/); het woordenboek: > 40.000 lichten, > 200.000 nummers, > 5.000 namen',
        Array.isArray(lijst) && lijst.includes('index.html') && lijst.includes('testserver.py') && lijst.includes('test_privacyscan.js') && !lijst.some(x => /^kaart\//.test(x))
          && wb.lichten > 40000 && wb.ids.size > 200000 && wb.aantalNamen > 5000 && bron === '/__bestanden.json',
        'zo', bron + ': ' + (lijst || []).length + ' bestanden | ' + wb.lichten + ' lichten, ' + wb.ids.size + ' nummers, ' + wb.aantalNamen + ' namen (' + [...wb.namen.values()].reduce((s, l) => s + l.length, 0) + ' als straatnaam gezocht)');

    // ═══ PV2 — de scan werkt ═══════════════════════════════════
    const eenId = [...wb.ids][1234], eenNaam = [...wb.namen.values()].find(l => l.some(n => n.includes(' '))).find(n => n.includes(' '));
    const k = (...d) => d.join(':');   // de voorbeelden in delen, zodat deze toets zichzelf niet vindt
    const wel = pvScan('a ' + eenId + ' b\n// bij ' + eenNaam + ' links\nom ' + k('12', '34', '56') + ' uur; 3 okt ' + k('12', '34') + '; 2026-01-02T' + k('12', '34') + '; t = ' + (Date.UTC(2026, 9, 4, 19, 28, 58) + 561) + ';', wb).map(x => x.soort);
    const niet = pvScan("const z = 'Zoom'; // Kaart 504 · 0:28, 22:00-06:00 nacht, V11.37.20, 52.0000, 1790000000000, 2026-10-16, de ring", wb);
    eis('PV2 de scan vindt een nummer, een straatnaam en drie soorten tijd; niet: een gewoon woord, een aftelling, een nachtgrens, een versie, een coördinaat, een rond tijdstip, een datum zonder tijd',
        JSON.stringify(wel) === JSON.stringify(['nummer', 'naam', 'tijd', 'tijd', 'tijd', 'tijd']) && niet.length === 0, 'nummer, naam, 4x tijd; niets', wel.join(',') + ' | niet: ' + JSON.stringify(niet));

    // ═══ PV3-PV5 — de scan van de repository ═════════════════════
    const vond = [];
    for (const naam of lijst) {
      let tekst;
      try { tekst = await (await haal(naam)).text(); } catch (e) { vond.push({ bestand: naam, soort: 'fout', waarde: String(e), regel: 0 }); continue; }
      for (const v of pvScan(tekst, wb)) vond.push({ bestand: naam, ...v });
    }
    const vinger = (v) => pvFnv(v.bestand + '|' + v.soort + '|' + v.waarde);
    const nieuw = vond.filter(v => !PV_BEKEND[vinger(v)]);
    const toon = (l) => l.slice(0, 8).map(v => v.bestand + ':' + v.regel + ' ' + v.soort + ' ' + vinger(v)).join(' | ');   // zonder de waarde
    for (const [code, soort, wat] of [['PV3', 'nummer', 'OSM-nummers'], ['PV4', 'naam', 'straatnamen'], ['PV5', 'tijd', 'echte tijden']]) {
      const n = nieuw.filter(v => v.soort === soort);
      eis(code + ' geen nieuwe ' + wat + ' buiten kaart/ (bekende plekken: zie PV6)', n.length === 0, '0 nieuw', n.length ? n.length + ' nieuw: ' + toon(n) : '0 nieuw');
    }
    eis('PV5b geen bestand dat niet te lezen was', !vond.some(v => v.soort === 'fout'), '0', toon(vond.filter(v => v.soort === 'fout')) || '0');

    // ═══ PV6 — de restlijst ════════════════════════════════════
    const bekend = vond.filter(v => PV_BEKEND[vinger(v)]);
    const per = {};
    for (const v of bekend) { const k = v.soort + ' ' + v.bestand; per[k] = (per[k] || 0) + 1; }
    const ongebruikt = Object.keys(PV_BEKEND).filter(k => !bekend.some(v => vinger(v) === k));
    eis('PV6 de bekende plekken (niet afgekeurd, wel gemeld): elke vingerafdruk uit de lijst komt nog voor (anders mag hij eruit)',
        ongebruikt.length === 0, 'alle nog gevonden', Object.entries(per).map(([k, n]) => k + ': ' + n).join(' | ') + (ongebruikt.length ? ' | niet meer gevonden: ' + ongebruikt.join(',') : ''));

    // ═══ PV7 — kaart/ ════════════════════════════════════════════
    let inKaart = [];
    try { const html = await (await haal('kaart/')).text(); inKaart = [...html.matchAll(/href="([^"?/]+)"/g)].map(m => decodeURIComponent(m[1])).sort(); } catch (e) { inKaart = ['fout ' + e]; }
    const verwacht = ['.gitattributes', 'LEESMIJ.md', 'LICENTIE.md', 'fiets.json', 'lichten.json', 'maak.py', 'versie.json'];
    eis('PV7 kaart/ bevat precies de zeven bestanden met neutrale namen', JSON.stringify(inKaart) === JSON.stringify(verwacht), verwacht.join(', '), inKaart.join(', '));
  } catch (e) {
    eis('PV de toets zelf', false, 'geen fout', String((e && e.stack) || e).slice(0, 300));
  }
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') {
  window.testPrivacyscan = testPrivacyscan;
}
