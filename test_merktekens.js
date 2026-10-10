// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_merktekens.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.14 (alleen toetsen): de toetsen zelf.
//
//  WAAROM. Veel toetsen laten de regels met een merkteken weg voordat ze een
//  vingerafdruk nemen, met een patroon als V11\.37\.[124]. Zo'n patroon raakt
//  ook V11.37.11, .12, .13 en verder: de regels van een latere versie vielen
//  dan stil weg, en de vingerafdruk bleef groen terwijl er code bij kwam
//  (STAP 0 van 10 okt: 14 plekken in 7 bestanden; ML7b, PS9a, SR10a, SN6b en
//  TW9d slikten zo de regels van V11.37.11 en .12 in). Daarom staat achter
//  elk merkteken-patroon nu (?!\d): geen cijfer erna.
//  Daarnaast: een toets die een rit in een iframe draait, laadt daar zijn eigen
//  script. Mislukte dat (de testserver met een wachtrij van 5), dan faalde de
//  toets met een gewone fout, zoals NB15b en NB16b. Nu proberen die toetsen het
//  nog twee keer, en zegt de fout 'testopstelling'.
//
//  MT1  de lijst met toetsen (de mappenlijst van de testserver)
//  MT2  de toets van de patronen werkt (op voorbeelden)
//  MT3  elk merkteken-patroon in elke toets heeft (?!\d)
//  MT4  elke toets die een script in een iframe laadt, probeert het drie keer
//  MT5  dat herhalen werkt: twee keer mislukt en dan gelukt, en drie keer mislukt
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_merktekens.js';
//      document.head.appendChild(s);
//      s.onload = () => testMerktekens().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// Het merkteken-patroon zoals het in de bron van een toets staat: V<getal>\.<getal>\.<getal of [klasse]>.
// Opgebouwd uit losse tekens, zodat dit bestand zichzelf niet meetelt.
const MERK_BS = String.fromCharCode(92);
const MERK_PATROON = new RegExp('V\\d+' + '\\' + MERK_BS + '\\.' + '\\d+' + '\\' + MERK_BS + '\\.' + '(\\[[^\\]]+\\]|\\d+)', 'g');
const MERK_ERNA = '(?!' + MERK_BS + 'd)';

// Alle plekken in een bron waar een merkteken-patroon niet door (?!\d) gevolgd wordt: [{ regel, patroon }].
function merkZonderGrens(bron) {
  const uit = [];
  String(bron).split(/\r?\n/).forEach((l, i) => {
    MERK_PATROON.lastIndex = 0;
    let m;
    while ((m = MERK_PATROON.exec(l)) !== null) {
      if (l.slice(m.index + m[0].length, m.index + m[0].length + MERK_ERNA.length) !== MERK_ERNA) uit.push({ regel: i + 1, patroon: m[0] });
    }
  });
  return uit;
}
function merkAantal(bron) { MERK_PATROON.lastIndex = 0; return (String(bron).match(MERK_PATROON) || []).length; }

// Het herhaalblok zoals het in elke iframe-toets staat (MT4), en een eigen kopie om het te laten werken (MT5).
const MERK_HERHAAL = [
  '      for (let poging = 1; ; poging++) {   // V11.37.14: een laadfout is de testopstelling, niet de app; zie test_merktekens',
  '        try {',
  '          await new Promise((ok, nee) => {',
  "            const sc = w.document.createElement('script');",
  "            sc.src = bron + '?t=' + Date.now() + '-' + poging; sc.onload = ok; sc.onerror = () => { sc.remove(); nee(new Error('laden')); };",
  '            w.document.head.appendChild(sc);',
  '          });',
  '          break;',
  '        } catch (e) {',
  "          if (poging >= 3) throw new Error('testopstelling: het testscript laadde niet in de iframe (3 pogingen)');",
  '          await new Promise((r) => setTimeout(r, 250 * poging));',
  '        }',
  '      }'].join('\n');

async function merkLaadProef(w, bronnen) {
  let i = 0;
  const volgende = () => bronnen[Math.min(i++, bronnen.length - 1)];
  let bron = null;
  for (let poging = 1; ; poging++) {
    bron = volgende();
    try {
      await new Promise((ok, nee) => {
        const sc = w.document.createElement('script');
        sc.src = bron + '?t=' + Date.now() + '-' + poging; sc.onload = ok; sc.onerror = () => { sc.remove(); nee(new Error('laden')); };
        w.document.head.appendChild(sc);
      });
      return { ok: true, pogingen: poging };
    } catch (e) {
      if (poging >= 3) return { ok: false, pogingen: poging, fout: 'testopstelling: het testscript laadde niet in de iframe (3 pogingen)' };
      await new Promise((r) => setTimeout(r, 250 * poging));
    }
  }
}

async function testMerktekens() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  // ═══ MT1 — de lijst met toetsen ════════════════════════════
  // De lijst komt van testserver.py (/__toetsen.json); in een ronde ook uit de suitelijst van de ronde.
  let namen = [], waar = 'geen';
  try {
    const r = await fetch(new URL('__toetsen.json', location.href).href + '?t=' + Date.now());
    if (r.ok) { const a = await r.json(); if (Array.isArray(a)) { namen = a.filter(n => /^test_[A-Za-z0-9_]+\.js$/.test(n)).sort(); waar = 'testserver'; } }
  } catch (e) {}
  if (!namen.length && Array.isArray(window.__SUITES)) { namen = window.__SUITES.map(x => String(x[0]).replace(/^\//, '')).filter(n => /^test_[A-Za-z0-9_]+\.js$/.test(n)).sort(); waar = 'ronde'; }
  eis('MT1 de lijst met toetsen (test_*.js, van testserver.py), met deze toets en test_tegenbocht',
      namen.length >= 80 && namen.includes('test_merktekens.js') && namen.includes('test_tegenbocht.js'),
      '>= 80, met test_merktekens.js', namen.length + ' toetsen (' + waar + ')' + (namen.length ? '' : ' — start de toetsen met python testserver.py'));
  const bronnen = {};
  // Ook hier drie pogingen: een fetch die mislukt, is de testopstelling (bij de bouw gemeten: 1 keer in 11 rondes, ook met wachtrij 128).
  for (const n of namen) {
    bronnen[n] = null;
    for (let poging = 1; poging <= 3 && bronnen[n] == null; poging++) {
      try { const r = await fetch(new URL(n, location.href).href + '?t=' + Date.now() + '-' + poging); if (r.ok) bronnen[n] = await r.text(); } catch (e) {}
      if (bronnen[n] == null && poging < 3) await new Promise((r) => setTimeout(r, 250 * poging));
    }
  }
  const onleesbaar = namen.filter(n => bronnen[n] == null);

  // ═══ MT2 — de toets van de patronen werkt ═════════════════
  const B = MERK_BS, G = MERK_ERNA;
  const vb = [
    ['/V11' + B + '.37' + B + '.1/.test(l)', 1],
    ['/V11' + B + '.37' + B + '.1' + G + '/.test(l)', 0],
    ['/V11' + B + '.36' + B + '.4|V11' + B + '.37' + B + '.[0124]/', 2],
    ['/V11' + B + '.36' + B + '.4' + G + '|V11' + B + '.37' + B + '.[0124]' + G + '/', 0],
    ["'V11.37.12: gewone tekst, geen patroon'", 0],
  ];
  const vbFout = vb.filter(([s, n]) => merkZonderGrens(s).length !== n).map(([s, n]) => s + ' -> ' + merkZonderGrens(s).length + ' (verwacht ' + n + ')');
  const oud = new RegExp('V11' + B + '.37' + B + '.[124]'), nieuw = new RegExp('V11' + B + '.37' + B + '.[124]' + G);
  eis('MT2a de toets vindt een patroon zonder (?!\\d), ook in een keuze met |, en laat gewone tekst met rust',
      vbFout.length === 0, 'alle vijf goed', vbFout.join(' | ') || 'alle vijf goed');
  eis('MT2b waarom: het oude patroon V11.37.[124] raakt ook V11.37.12; met (?!\\d) alleen nog V11.37.1, .2 en .4',
      oud.test('// V11.37.12: x') === true && nieuw.test('// V11.37.12: x') === false && nieuw.test('// V11.37.1: x') === true && nieuw.test('// V11.37.4 ') === true,
      'oud raakt .12, nieuw niet', [oud.test('// V11.37.12: x'), nieuw.test('// V11.37.12: x'), nieuw.test('// V11.37.1: x')].join(' / '));

  // ═══ MT3 — elk merkteken-patroon heeft (?!\d) ═════════════
  const zonderGrens = [];
  let totaal = 0;
  for (const n of namen) {
    if (bronnen[n] == null || n === 'test_merktekens.js') continue;
    totaal += merkAantal(bronnen[n]);
    for (const p of merkZonderGrens(bronnen[n])) zonderGrens.push(n + ':' + p.regel + ' ' + p.patroon);
  }
  eis('MT3a alle toetsen zijn te lezen (drie pogingen per bestand)', onleesbaar.length === 0, 'alle', onleesbaar.length ? 'testopstelling: niet te lezen: ' + onleesbaar.join(', ') : 'alle');
  eis('MT3b elk merkteken-patroon in elke toets heeft (?!\\d) erachter, dus V11.37.1 raakt nooit V11.37.11 (met bestand en regel als het misgaat)',
      zonderGrens.length === 0 && totaal >= 99, '0 zonder, en minstens 99 patronen', zonderGrens.slice(0, 12).join(' | ') + (zonderGrens.length ? ' (' + zonderGrens.length + ')' : '0 zonder, ' + totaal + ' patronen'));

  // ═══ MT4 — elke iframe-toets probeert het drie keer ════════
  const iframeToetsen = namen.filter(n => bronnen[n] && n !== 'test_merktekens.js' && /createElement\('iframe'\)/.test(bronnen[n]) && /createElement\('script'\)/.test(bronnen[n]));
  const zonderHerhaal = iframeToetsen.filter(n => bronnen[n].replace(/\r\n/g, '\n').indexOf(MERK_HERHAAL) < 0);
  const losLaden = iframeToetsen.filter(n => /sc\.onerror = \(\) => nee\(new Error\('laden'\)\);/.test(bronnen[n]));
  const appToets = iframeToetsen.filter(n => !/testopstelling: de app laadde niet in de iframe/.test(bronnen[n]));
  eis('MT4a elke toets die een script in een iframe laadt (tien), heeft het herhaalblok letterlijk, en nergens nog de oude enkele poging',
      iframeToetsen.length >= 10 && zonderHerhaal.length === 0 && losLaden.length === 0,
      '>= 10 toetsen, 0 zonder', iframeToetsen.length + ' toetsen; zonder: ' + (zonderHerhaal.join(', ') || 'geen') + '; oude poging: ' + (losLaden.join(', ') || 'geen'));
  eis('MT4b en elk kijkt of de app zelf in de iframe laadde (anders: de pagina opnieuw, en daarna testopstelling)',
      appToets.length === 0, '0 zonder', appToets.join(', ') || '0 zonder');

  // ═══ MT5 — het herhalen werkt ══════════════════════════════
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-9999px;top:0;width:200px;height:100px';
  f.src = 'about:blank';
  document.body.appendChild(f);
  let p1 = null, p2 = null;
  try {
    const w = f.contentWindow;
    const goed = new URL('test_merktekens.js', location.href).href, mis = new URL('test_bestaat_niet_' + Date.now() + '.js', location.href).href;
    p1 = await merkLaadProef(w, [mis, mis, goed]);
    p2 = await merkLaadProef(w, [mis, mis, mis]);
  } catch (e) { p1 = p1 || { fout: String(e) }; } finally { f.remove(); }
  eis('MT5a twee keer mislukt en de derde keer gelukt: de toets gaat door', !!p1 && p1.ok === true && p1.pogingen === 3, 'ok na 3 pogingen', JSON.stringify(p1));
  eis("MT5b drie keer mislukt: de fout zegt 'testopstelling', niet een gewone toetsfout", !!p2 && p2.ok === false && p2.pogingen === 3 && /^testopstelling/.test(p2.fout || ''),
      'testopstelling na 3 pogingen', JSON.stringify(p2));
  eis('MT5c het blok in de toetsen en deze proef zijn dezelfde code (zelfde regels voor laden, opnieuw en de fout)',
      MERK_HERHAAL.indexOf("sc.onerror = () => { sc.remove(); nee(new Error('laden')); };") > 0 && String(merkLaadProef).indexOf("sc.onerror = () => { sc.remove(); nee(new Error('laden')); };") > 0
        && MERK_HERHAAL.indexOf("'testopstelling: het testscript laadde niet in de iframe (3 pogingen)'") > 0 && String(merkLaadProef).indexOf("'testopstelling: het testscript laadde niet in de iframe (3 pogingen)'") > 0,
      'gelijk', 'gelijk');

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testMerktekens = testMerktekens; window.merkZonderGrens = merkZonderGrens; }
