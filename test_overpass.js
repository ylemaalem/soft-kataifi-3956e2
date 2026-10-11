// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_overpass.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.12: Overpass rustiger.
//    - de fietslijst: opnieuw na 1, 5, 15 en 60 minuten met spreiding,
//      hoogstens vijf pogingen per gebied per dag, het tijdstip bewaard, 429
//      volgt Retry-After, tot vier gebieden bewaard, en een gebied dekt je tot
//      4,6 km van het midden (gekeken na elke kaart en bij elke GPS-tik);
//    - de kaartvraag: na een mislukte vraag een rem (30 s, 1, 2, 5, dan steeds
//      10 minuten, met spreiding; 429 volgt Retry-After).
//  De klok en de wachttijden zijn nagebootst: een uur gaat in een fractie van
//  een seconde voorbij. Plekken zijn verzonnen (een vast punt plus meters).
//
//  OV1  de constanten
//  OV2  de wachttijd: spreiding, Retry-After (seconden en datum), alleen bij 429
//  OV3  vijf keer 504: pogingen na 5 s, ~1, ~5, ~15 en ~60 minuten, dan niets meer
//  OV4  het tijdstip blijft bewaard: na een herstart geen nieuwe poging vóór die tijd
//  OV5  vijf per gebied per dag: een nieuwe dag mag weer, een ander gebied telt apart
//  OV6  429 met Retry-After van twee uur
//  OV7  tot vier gebieden, samen gebruikt; het oudste gaat eruit; de opslag in KB
//  OV8  dekking: 4,5 km van het midden geen vraag, 4,7 km wel
//  OV9  de dekking bij elke GPS-tik: één poging bij het verlaten, pas na een echte kaart
//  OV10 de rem op de kaartvraag
//  OV11 regressie: welke functies veranderen, en dat de rest byte-gelijk is
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_overpass.js';
//      document.head.appendChild(s);
//      s.onload = () => testOverpass().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

// ── Draait IN een iframe: de klok, de wachtrij en de antwoorden van Overpass ──
// opt.antwoorden: [{ status, ra?, ids? }] in volgorde (de laatste herhaalt zich).
// Geeft een object terug met de stappen die de toets uitvoert (stap: 'kaart', 'verder', 'herstart', 'gps').
async function overpassBinnen(opt) {
  let klok = opt.klok || Date.UTC(2026, 9, 9, 8, 0, 0);
  const t0 = klok;
  Date.now = () => klok;
  const echtST = window.setTimeout, echtCT = window.clearTimeout;
  const rij = []; let volg = 1e9;
  // Alleen de wachttijden van de fietslijst en de kaartvraag gaan in de nagebootste wachtrij; de rest van de app houdt de echte.
  window.setTimeout = (f, ms, ...a) => { if (!(ms >= 1000) || !/fiets|kaart|downloadOSM|ctrl\.abort/.test(String(f))) return echtST(f, ms, ...a);
    const id = volg++; rij.push({ id, t: klok + ms, f, a }); return id; };
  window.clearTimeout = (id) => { const i = rij.findIndex(x => x.id === id); if (i >= 0) rij.splice(i, 1); else echtCT(id); };
  const rust = async () => { for (let i = 0; i < 6; i++) await new Promise(r => echtST(r, 0)); };
  const vragen = []; let n = 0;
  window.fetch = async (url, init) => {
    if (String(url) !== OVERPASS_URL) return { ok: true, status: 200, json: async () => ({}), headers: { get: () => null } };
    const body = init && init.body ? decodeURIComponent(String(init.body).replace(/^data=/, '')) : '';
    const a = opt.antwoorden[Math.min(n++, opt.antwoorden.length - 1)];
    vragen.push({ t: klok - t0, soort: /\.alleen out ids;$/.test(body) ? 'fiets' : 'kaart', body });
    return { ok: a.status === 200, status: a.status, headers: { get: (k) => (/retry-after/i.test(k) ? (a.ra == null ? null : String(a.ra)) : null) },
             json: async () => (a.json || { elements: (a.ids || []).map(id => ({ type: 'node', id })) }) };
  };
  for (const k of ['sl_opslaglog', FIETS_SLEUTEL, FIETS_POGING_SLEUTEL]) localStorage.removeItem(k);
  try { for (const k of [FIETS_SLEUTEL, FIETS_POGING_SLEUTEL]) opslagCache.delete(k); } catch (e) {}
  localStorage.setItem('sl_opslaglog', '[]');
  if (opt.opslag !== undefined) localStorage.setItem(FIETS_SLEUTEL, JSON.stringify(opt.opslag));
  fietsLichten = null; fietsBezig = false; fietsGebieden = null; fietsTimer = null; huidigePos = null;
  window.updateDichtbij = () => {}; window.haalStraatnamenOp = async () => {};
  const M = (lat, dyM) => ({ lat: lat + dyM / 111320, lon: 5.0 });
  const uit = { stappen: [] };
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  for (const s of opt.stappen) {
    if (s.stap === 'kaart') { const p = M(52.0, s.dy || 0); fietsNaKaart(p.lat, p.lon); await rust(); }
    else if (s.stap === 'verder') { const tot = klok + s.ms;
      for (;;) { rij.sort((a, b) => a.t - b.t); const x = rij[0]; if (!x || x.t > tot) break; rij.shift(); klok = x.t; x.f(...x.a); await rust(); }
      klok = tot; }
    else if (s.stap === 'herstart') { for (const x of rij.splice(0)) {} fietsGebieden = null; fietsTimer = null; fietsLichten = null; fietsBezig = false; if (s.naar) klok = s.naar; }
    else if (s.stap === 'gps') { const p = M(52.0, s.dy || 0); huidigePos = p; fietsDekking(p.lat, p.lon); await rust(); }
    else if (s.stap === 'kijk') { uit.stappen.push({ t: klok - t0, plan: rij.filter(x => /fietsGedekt|fietsHaalOp/.test(String(x.f))).map(x => x.t - klok), poging: lees(FIETS_POGING_SLEUTEL),
        gebieden: (lees(FIETS_SLEUTEL) || {}).gebieden || null, ruw: localStorage.getItem(FIETS_SLEUTEL), lichten: fietsLichten ? fietsLichten.size : null }); }
    else if (s.stap === 'kaartvraag') {   // zoals onGPS: zonder kaart bij elke tik downloadOSM, s.ms lang, een tik per seconde
      cacheGeladen = false; cacheBezig = false; window.fietsNaKaart = () => {};
      const tot = klok + s.ms;
      while (klok < tot) { if (!cacheGeladen && !cacheBezig) await downloadOSM(52.0, 5.0);
        for (;;) { rij.sort((a, b) => a.t - b.t); const x = rij[0]; if (!x || x.t > klok) break; rij.shift(); x.f(...x.a); await rust(); }
        klok += 1000; }
      uit.kaart = { geladen: cacheGeladen, rem: { n: kaartRem.n, nietVoor: kaartRem.nietVoor - klok } };
    }
  }
  uit.vragen = vragen;
  uit.log = (lees('sl_opslaglog') || []).filter(r => r.reden === 'fietslichten' || r.reden === 'kaart_fout').map(r => ({ t: r.t - t0, reden: r.reden, element: r.element, poort: r.poortReden }));
  window.setTimeout = echtST; window.clearTimeout = echtCT;
  return uit;
}

// ── Draait op de testpagina ──────────────────────────────────
async function testOverpass() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const NL = String.fromCharCode(10);
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  // Sleutel voor sleutel, niet met clear(): de IndexedDB-spiegel ziet clear() niet.
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) localStorage.removeItem(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
    } catch (e) {}
  };
  const bron = new URL('test_overpass.js', location.href).href;
  const pagina = location.pathname;
  const inFrame = async (functie, opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?overpass=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.onGPS !== 'function'; poging++) {   // V11.37.14: de app zelf laadde niet (testopstelling): de pagina opnieuw
        if (poging > 3) throw new Error('testopstelling: de app laadde niet in de iframe (3 pogingen)');
        await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; f.src = pagina + '?opnieuw=' + Math.random(); });
      }
      const w = f.contentWindow;
      for (let poging = 1; ; poging++) {   // V11.37.14: een laadfout is de testopstelling, niet de app; zie test_merktekens
        try {
          await new Promise((ok, nee) => {
            const sc = w.document.createElement('script');
            sc.src = bron + '?t=' + Date.now() + '-' + poging; sc.onload = ok; sc.onerror = () => { sc.remove(); nee(new Error('laden')); };
            w.document.head.appendChild(sc);
          });
          break;
        } catch (e) {
          if (poging >= 3) throw new Error('testopstelling: het testscript laadde niet in de iframe (3 pogingen)');
          await new Promise((r) => setTimeout(r, 250 * poging));
        }
      }
      return JSON.parse(JSON.stringify(await w[functie](opt)));
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), vragen: [], log: [], stappen: [] };
    } finally {
      f.remove();
      herstel();
    }
  };
  const ov = (opt) => inFrame('overpassBinnen', opt);
  const fouten = (r) => r.fout || null;
  const MIN = 60000, UUR = 3600000;
  const ids = (n, basis) => Array.from({ length: n }, (_, i) => basis + i * 7919);
  const goed = (n = 346, basis = 3300000000) => ({ status: 200, ids: ids(n, basis) });
  const f504 = { status: 504 };
  const tussen = (x, a, b) => x >= a && x <= b;

  // ═══ OV1 — de constanten ═══════════════════════════════════
  eis('OV1 opnieuw na 1, 5, 15 en 60 min, ±20%, vijf per gebied per dag, vier gebieden, dekking 4,6 km (= OSM_RADIUS - FIETS_GRENS_M); de kaart: 30 s, 1, 2, 5, 10 min',
      JSON.stringify(FIETS_HERHAAL_MS) === JSON.stringify([60000, 300000, 900000, 3600000]) && FIETS_SPREIDING === 0.2 && FIETS_MAX_PER_DAG === 5
        && FIETS_MAX_GEBIEDEN === 4 && FIETS_ZELFDE_M === 4600 && FIETS_ZELFDE_M === OSM_RADIUS - FIETS_GRENS_M && FIETS_EERSTE_MS === 5000
        && JSON.stringify(KAART_REM_MS) === JSON.stringify([30000, 60000, 120000, 300000, 600000]) && KAART_REM_SPREIDING === 0.2,
      'zo', [JSON.stringify(FIETS_HERHAAL_MS), FIETS_SPREIDING, FIETS_MAX_PER_DAG, FIETS_MAX_GEBIEDEN, FIETS_ZELFDE_M, JSON.stringify(KAART_REM_MS)].join(' | '));

  // ═══ OV2 — de wachttijd ════════════════════════════════════
  const spr = [1, 2, 3, 4].map(n => { const b = FIETS_HERHAAL_MS[n - 1]; const w = Array.from({ length: 400 }, () => fietsWacht(n, 504, null));
    return { n, b, min: Math.min(...w), max: Math.max(...w) }; });
  eis('OV2a spreiding: elke wachttijd tussen 80% en 120% van 1, 5, 15 en 60 min, en ze verschillen (400 keer per stap)',
      spr.every(s => s.min >= 0.8 * s.b - 1 && s.max <= 1.2 * s.b + 1 && s.max - s.min > 0.2 * s.b),
      'binnen ±20%, verspreid', spr.map(s => `${s.n}: ${Math.round(s.min / 1000)}-${Math.round(s.max / 1000)} s`).join(' | '));
  const nuD = Date.now();
  const ra1 = fietsWacht(1, 429, '7200'), ra2 = fietsWacht(1, 429, new Date(nuD + 3 * UUR).toUTCString()), ra3 = fietsWacht(1, 429, 'onzin'), ra4 = fietsWacht(1, 503, '7200');
  eis('OV2b 429 volgt Retry-After (7200 s, of een datum over 3 uur); onzin telt niet; alleen bij 429',
      ra1 >= 7200000 && ra2 >= 3 * UUR - 2000 && tussen(ra3, 0.8 * MIN, 1.2 * MIN) && tussen(ra4, 0.8 * MIN, 1.2 * MIN) && overpassRetryAfter('120') === 120000 && overpassRetryAfter(null) === null,
      '>= 2 u, >= 3 u, ~1 min, ~1 min', [ra1, ra2, ra3, ra4].map(x => Math.round(x / 1000) + ' s').join(' / '));

  // ═══ OV3 — vijf keer 504 ═══════════════════════════════════
  const o3 = await ov({ antwoorden: [f504], stappen: [{ stap: 'kaart' }, { stap: 'verder', ms: 3 * UUR }, { stap: 'kijk' }, { stap: 'verder', ms: 6 * UUR }, { stap: 'kijk' }] });
  const t3 = o3.vragen.map(v => v.t), d3 = t3.map((t, i) => i ? t - t3[i - 1] : t);
  eis('OV3a vijf pogingen: na 5 s, en dan na ~1, ~5, ~15 en ~60 minuten (±20%)',
      !fouten(o3) && t3.length === 5 && d3[0] === 5000 && tussen(d3[1], 0.8 * MIN, 1.2 * MIN) && tussen(d3[2], 4 * MIN, 6 * MIN) && tussen(d3[3], 12 * MIN, 18 * MIN) && tussen(d3[4], 48 * MIN, 72 * MIN),
      '5 s, 1, 5, 15, 60 min', fouten(o3) || d3.map(x => Math.round(x / 1000) + ' s').join(', '));
  const p3 = (o3.stappen[1] || {}).poging || [];
  eis('OV3b daarna niets meer, ook niet 6 uur later; sl_fietspoging zegt n=5; de logregels hebben de wachttijd',
      o3.vragen.length === 5 && p3.length === 1 && p3[0].n === 5 && (o3.stappen[1].plan || []).length === 0
        && o3.log.length === 5 && /^http 504 w=\d+ p=0$/.test(o3.log[0].poort) && o3.log[4].poort === 'http 504 p=4',
      '5 vragen, n=5, geen plan', o3.vragen.length + ' | ' + JSON.stringify(p3) + ' | ' + o3.log.map(l => l.poort).join(' ; '));

  // ═══ OV4 — het tijdstip blijft bewaard ═════════════════════
  // Twee pogingen mislukken; de app start opnieuw 10 s na de tweede. Dan geen poging na 5 s, maar pas op het bewaarde tijdstip.
  const o4 = await ov({ antwoorden: [f504, f504, goed()], stappen: [{ stap: 'kaart' }, { stap: 'verder', ms: 5000 + 1.25 * MIN }, { stap: 'kijk' },
    { stap: 'herstart' }, { stap: 'kaart' }, { stap: 'kijk' }, { stap: 'verder', ms: 2 * UUR }, { stap: 'kijk' }] });
  const v4 = o4.stappen[0] && o4.stappen[0].poging && o4.stappen[0].poging[0], plan4 = o4.stappen[1] ? o4.stappen[1].plan : [];
  const verwacht4 = v4 ? (v4.volgende - (Date.UTC(2026, 9, 9, 8, 0, 0) + o4.stappen[1].t)) : null;
  eis('OV4 na een herstart: de volgende poging op het bewaarde tijdstip (~5 min na de tweede), niet na 5 s; daarna lukt hij',
      !fouten(o4) && v4 && v4.n === 2 && plan4.length === 1 && Math.abs(plan4[0] - verwacht4) < 1000 && plan4[0] > 3 * MIN && o4.vragen.length === 3 && o4.stappen[2].lichten === 346,
      'plan = bewaard tijdstip (> 3 min), 3 vragen, 346', fouten(o4) || `n ${v4 && v4.n}, plan ${plan4.map(x => Math.round(x / 1000))} s, verwacht ${Math.round(verwacht4 / 1000)} s, ${o4.vragen.length} vragen, ${o4.stappen[2] && o4.stappen[2].lichten}`);

  // ═══ OV5 — vijf per gebied per dag ═════════════════════════
  const morgen = Date.UTC(2026, 9, 10, 6, 0, 0);
  const o5 = await ov({ antwoorden: [f504, f504, f504, f504, f504, goed(10, 3400000000), goed(12, 3500000000)], stappen: [{ stap: 'kaart' }, { stap: 'verder', ms: 3 * UUR },
    { stap: 'herstart' }, { stap: 'kaart' }, { stap: 'kijk' },
    { stap: 'kaart', dy: 6000 }, { stap: 'verder', ms: MIN }, { stap: 'kijk' },
    { stap: 'herstart', naar: morgen }, { stap: 'kaart' }, { stap: 'verder', ms: MIN }, { stap: 'kijk' }] });
  eis('OV5 na vijf pogingen vandaag niets meer hier; een gebied 6 km verder telt apart (en lukt); de volgende dag mag het hier weer (en lukt)',
      !fouten(o5) && o5.stappen[0].plan.length === 0 && o5.vragen.length === 7 && o5.stappen[1].lichten === 10 && o5.stappen[2].lichten === 22,
      'geen plan, 7 vragen, 10, dan 22 lichten', fouten(o5) || `plan ${JSON.stringify(o5.stappen[0].plan)}, ${o5.vragen.length} vragen, ${o5.stappen[1] && o5.stappen[1].lichten}, ${o5.stappen[2] && o5.stappen[2].lichten}`);

  // ═══ OV6 — 429 met Retry-After ═════════════════════════════
  const o6 = await ov({ antwoorden: [{ status: 429, ra: 7200 }, goed()], stappen: [{ stap: 'kaart' }, { stap: 'verder', ms: 3 * UUR }] });
  const t6 = o6.vragen.map(v => v.t);
  eis('OV6 na 429 met Retry-After 7200: de volgende poging niet vóór twee uur', !fouten(o6) && t6.length === 2 && t6[1] - t6[0] >= 2 * UUR && /^http 429 w=7\d\d\d p=0$/.test(o6.log[0].poort),
      '>= 2 uur, w=72xx', fouten(o6) || t6.map(x => Math.round(x / 1000)).join(', ') + ' s | ' + (o6.log[0] || {}).poort);

  // ═══ OV7 — tot vier gebieden ═══════════════════════════════
  const stap7 = [];
  [0, 6000, 12000, 18000, 24000].forEach(dy => { stap7.push({ stap: 'kaart', dy }, { stap: 'verder', ms: 10000 }, { stap: 'kijk' }); });
  const o7 = await ov({ antwoorden: [goed(1222, 3300000000), goed(1222, 3400000000), goed(1222, 3500000000), goed(1222, 3600000000), goed(1222, 3700000000)], stappen: stap7 });
  const s7 = o7.stappen[4] || {}, g7 = s7.gebieden || [];
  const kb7 = s7.ruw ? (s7.ruw.length + FIETS_SLEUTEL.length) / 1024 : 0;
  eis('OV7a vijf gebieden opgehaald: er blijven er vier, het oudste (het eerste) is eruit, en de lijst is ze samen (4 x 1222)',
      !fouten(o7) && g7.length === 4 && !g7.some(g => Math.abs(g.lat - 52.0) < 1e-6) && s7.lichten === 4 * 1222 && o7.vragen.length === 5,
      '4 gebieden, 4888 lichten', fouten(o7) || `${g7.length} gebieden, ${s7.lichten} lichten, ${o7.vragen.length} vragen`);
  eis('OV7b de opslag van vier gebieden zo groot als gebied G2 (1222 lichten elk): onder 60 KB zoals Safari telt (naam + waarde)',
      kb7 > 40 && kb7 < 60, '40-60 KB', kb7.toFixed(1) + ' KB');
  const o7b = await ov({ antwoorden: [goed(1222, 3300000000), goed(962, 3400000000), goed(346, 3500000000), goed(300, 3600000000)],
    stappen: [0, 6000, 12000, 18000].flatMap(dy => [{ stap: 'kaart', dy }, { stap: 'verder', ms: 10000 }]).concat([{ stap: 'kijk' }]) });
  const kb7b = o7b.stappen[0] && o7b.stappen[0].ruw ? (o7b.stappen[0].ruw.length + FIETS_SLEUTEL.length) / 1024 : 0;
  eis('OV7c vier gebieden zoals G2, G3, G1 en een kleiner vierde (1222, 962, 346, 300 lichten): ~31 KB',
      kb7b > 25 && kb7b < 36, '25-36 KB', kb7b.toFixed(1) + ' KB');
  const oud1 = { v: 1, t: Date.UTC(2026, 9, 8), lat: 52.0, lon: 5.0, r: OSM_RADIUS, ids: [11, 12, 13] };
  const o7d = await ov({ opslag: oud1, antwoorden: [goed(5, 3800000000)], stappen: [{ stap: 'kaart' }, { stap: 'kijk' }, { stap: 'kaart', dy: 6000 }, { stap: 'verder', ms: 10000 }, { stap: 'kijk' }] });
  eis('OV7d de ene lijst van V11.37.8 (v1) telt als één gebied: hier geen vraag; 6 km verder een tweede gebied erbij (3 + 5)',
      !fouten(o7d) && o7d.stappen[0].lichten === 3 && o7d.vragen.length === 1 && (o7d.stappen[1].gebieden || []).length === 2 && o7d.stappen[1].lichten === 8,
      '3, 1 vraag, 2 gebieden, 8', fouten(o7d) || `${o7d.stappen[0].lichten}, ${o7d.vragen.length} vragen, ${(o7d.stappen[1].gebieden || []).length} gebieden, ${o7d.stappen[1].lichten}`);
  const oudG = { v: 2, gebieden: [{ t: Date.UTC(2026, 8, 1), lat: 52.0, lon: 5.0, r: OSM_RADIUS, ids: [11, 12] }] };
  const o7e = await ov({ opslag: oudG, antwoorden: [goed(4, 3900000000)], stappen: [{ stap: 'kaart' }, { stap: 'verder', ms: 10000 }, { stap: 'kijk' }] });
  eis('OV7e een gebied van 38 dagen oud, hier: opnieuw opgehaald en vervangen (niet dubbel)',
      !fouten(o7e) && o7e.vragen.length === 1 && (o7e.stappen[0].gebieden || []).length === 1 && o7e.stappen[0].lichten === 4,
      '1 vraag, 1 gebied, 4', fouten(o7e) || `${o7e.vragen.length}, ${(o7e.stappen[0].gebieden || []).length}, ${o7e.stappen[0].lichten}`);

  // ═══ OV8 — dekking 4,6 km ══════════════════════════════════
  const vers = { v: 2, gebieden: [{ t: Date.UTC(2026, 9, 8), lat: 52.0, lon: 5.0, r: OSM_RADIUS, ids: [11, 12, 13] }] };
  const o8a = await ov({ opslag: vers, antwoorden: [goed()], stappen: [{ stap: 'kaart', dy: 4500 }, { stap: 'verder', ms: MIN }] });
  const o8b = await ov({ opslag: vers, antwoorden: [goed()], stappen: [{ stap: 'kaart', dy: 4700 }, { stap: 'verder', ms: MIN }] });
  eis('OV8 een gebied dekt tot 4,6 km van het midden: op 4,5 km geen vraag, op 4,7 km wel',
      !fouten(o8a) && !fouten(o8b) && o8a.vragen.length === 0 && o8b.vragen.length === 1, '0 / 1', o8a.vragen.length + ' / ' + o8b.vragen.length);

  // ═══ OV9 — de dekking bij elke GPS-tik ═════════════════════
  const gps = []; for (let dy = 0; dy <= 6000; dy += 100) gps.push({ stap: 'gps', dy });
  const o9 = await ov({ opslag: vers, antwoorden: [goed(7, 4000000000)], stappen: [{ stap: 'kaart' }, ...gps, { stap: 'verder', ms: 10000 }, { stap: 'kijk' }] });
  const o9z = await ov({ opslag: vers, antwoorden: [goed(7, 4000000000)], stappen: [...gps, { stap: 'verder', ms: 10000 }] });
  eis('OV9a rijdend van het midden naar 6 km: precies één vraag, voor de plek waar de dekking ophield (na 4,6 km)',
      !fouten(o9) && o9.vragen.length === 1 && o9.stappen[0].lichten === 3 + 7 && (() => { const m = /around:\d+,([\d.]+),/.exec(o9.vragen[0].body); return m && (Number(m[1]) - 52.0) * 111320 > 4600; })(),
      '1 vraag, na 4,6 km', fouten(o9) || o9.vragen.length + ' vragen | ' + (o9.vragen[0] ? o9.vragen[0].body.slice(44, 100) : ''));
  eis('OV9b zonder een echte kaart in deze sessie doet de GPS-tik niets (zo vraagt een toets of een rit zonder kaart nooit iets op)',
      !fouten(o9z) && o9z.vragen.length === 0, '0 vragen', String(o9z.vragen.length));
  eis('OV9c onGPS kijkt bij elke tik naar de dekking, na updateDichtbij', /if \(cacheGeladen\) fietsDekking\(lat, lon\);/.test(String(onGPS)), 'ja', '');

  // ═══ OV10 — de rem op de kaartvraag ═════════════════════════
  const o10 = await ov({ antwoorden: [f504], stappen: [{ stap: 'kaartvraag', ms: 15 * MIN }] });
  const k10 = o10.vragen.filter(v => v.soort === 'kaart').map(v => v.t), dk = k10.map((t, i) => i ? t - k10[i - 1] : 0);
  eis('OV10a 15 minuten zonder kaart, een GPS-tik per seconde, Overpass steeds 504: vijf kaartvragen, na ~30 s, ~1, ~2 en ~5 min (eerst was het elke paar seconden)',
      !fouten(o10) && k10.length === 5 && tussen(dk[1], 24000, 37000) && tussen(dk[2], 48000, 73000) && tussen(dk[3], 96000, 145000) && tussen(dk[4], 240000, 361000),
      '5 vragen: 30 s, 1, 2, 5 min', fouten(o10) || k10.length + ': ' + dk.map(x => Math.round(x / 1000)).join(', ') + ' s');
  const l10 = o10.log.filter(l => l.reden === 'kaart_fout');
  eis('OV10b elke mislukte kaartvraag geeft een regel kaart_fout met de status, n en de wachttijd', l10.length === 5 && /^n=1 w=\d+$/.test(l10[0].poort) && l10[0].element === 'http 504',
      '5 regels', l10.map(l => l.element + ' ' + l.poort).join(' ; '));
  const o10b = await ov({ antwoorden: [f504, f504, { status: 200, json: { elements: [] } }], stappen: [{ stap: 'kaartvraag', ms: 4 * MIN }] });
  eis('OV10c een gelukte kaart haalt de rem eraf (n = 0)', !fouten(o10b) && o10b.kaart && o10b.kaart.geladen === true && o10b.kaart.rem.n === 0,
      'geladen, n=0', fouten(o10b) || JSON.stringify(o10b.kaart));
  const o10c = await ov({ antwoorden: [{ status: 429, ra: 900 }, { status: 200, json: { elements: [] } }], stappen: [{ stap: 'kaartvraag', ms: 20 * MIN }] });
  const k10c = o10c.vragen.map(v => v.t);
  eis('OV10d 429 met Retry-After 900: de volgende kaartvraag niet vóór 15 minuten', !fouten(o10c) && k10c.length === 2 && k10c[1] - k10c[0] >= 900000,
      '>= 900 s', fouten(o10c) || k10c.map(x => Math.round(x / 1000)).join(', ') + ' s');

  // ═══ OV11 — regressie ══════════════════════════════════════
  // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht): nieuwe regels weg, de twee gewijzigde regels van tegenLog terug.
  const terugV113713 = (s) => String(s).replace("    const sleutel = bron + ':' + sl.id + (w ? ':' + w : ''), nu = Date.now();   // V11.37.13: per reden een eigen regel", "    const sleutel = bron + ':' + sl.id, nu = Date.now();").replace("               h: k == null ? null : Math.round(Math.min(...sl.eenrichting.map(r => tegenHoekVerschil(r, k)))), ...(w ? { w } : {}) } });   // V11.37.13: met de reden w",
    "               h: k == null ? null : Math.round(Math.min(...sl.eenrichting.map(r => tegenHoekVerschil(r, k)))) } });").split(NL).filter(l => !/V11\.37\.13(?!\d)/.test(l)).join(NL);   // V11.37.13
  const zonder = (s) => terugV113713(s).split(NL).filter(l => !/V11\.37\.12(?!\d)/.test(l)).join(NL);   // V11.37.13: eerst terugV113713
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.12(?!\d)/.test(l)).length;
  const V113711 = { downloadOSM: ['751a75e4', 4278, 4], onGPS: ['146fb83c', 15195, 1] };
  const telAf = Object.entries(V113711).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('OV11a twee bestaande functies krijgen regels met merkteken V11.37.12 (vier in downloadOSM, één in onGPS); fietsLees, fietsNaKaart en fietsHaalOp zijn nieuw geschreven (OV3-OV9)',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V113711).filter(([n, [h, l]]) => { const s = zonder(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('OV11b zonder die regels (alle zijn nieuw) byte-gelijk aan V11.37.11', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const ONGEWIJZIGD = { vindDichtbij: ['f8fd9aa9', 4395], updateDichtbij: ['67e9f3ec', 12423], regelKies: ['80ca7466', 2976], logOpslagMis: ['6d7fd828', 16172],
    fietsSluitUit: ['ec1d273c', 170], isFietsLicht: ['89f184ad', 98], fietsPuurDichtst: ['2a9b09f8', 418], fietsTerug: ['6f950997', 372],
    tegenSluitUit: ['efd9cae3', 142], tegenIsTegen: ['a03bdbeb', 263], tegenRijrichtingen: ['54bb2b55', 1112], tegenPuurDichtst: ['3c123d89', 515],
    tegenKoers: ['67e36df', 149], tegenLog: ['75f6b5b4', 569], vindDichtbijScore: ['bc9b7937', 2105], achterSluitUit: ['6b7a87d8', 383],
    checkNodeCorrectieStilstand: ['8c801fd8', 4751], selecteerNodeHandmatig: ['8c3e7846', 2480], haalStraatnamenOp: ['2a318437', 1102],
    berekenClusterNodes: ['3c2246d1', 1361], migratieSlPos: ['2f5621af', 396] };
  const anders2 = Object.entries(ONGEWIJZIGD).filter(([n, [h, l]]) => { const s = terugV113713(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);   // V11.37.13: terugV113713
  eis('OV11c eenentwintig functies die V11.37.12 niet raakt (de lichtkeuze, het fietsfilter zelf, de tegenrichting-regel, het log, de kaartverwerking): byte-gelijk aan V11.37.11',
      anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  herstel();
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') {
  window.testOverpass = testOverpass; window.overpassBinnen = overpassBinnen;
}
