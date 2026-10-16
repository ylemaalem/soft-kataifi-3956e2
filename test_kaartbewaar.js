// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_kaartbewaar.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.18: de laatste kaart blijft bewaard (eigen IndexedDB), de
//  inhoud van de kaartvraag heeft een grens, en de pil en het onderste vak
//  zeggen waarom er geen kaart is. Met C5 (de verversing ook vóór de vroege
//  returns van updateDichtbij) en C7 (een vangnet voor aiBezig).
//
//  KB1  een gelukte kaart wordt bewaard; de gekeurde kopie is gelijk aan osmCache
//  KB2  de volgende start: de eerste GPS-tik zet de bewaarde kaart neer (licht,
//       pil 'Bewaard'), de verversing gaat meteen; gelukt -> 'Kaart', vers, bewaard;
//       de fietslijst en de clusters gelden ook voor de bewaarde kaart
//  KB3  bewaarde kaart, verversing mislukt (504): de kaart blijft, pil 'Kaart 504 · m:ss';
//       na de rem een nieuwe poging
//  KB4  kapot (vijf soorten), te oud, te groot, te ver: niet gebruikt; dezelfde
//       start als zonder bewaarde kaart
//  KB5  te ver bij de start, later binnen 3 km: dan wel; na een verse kaart nooit meer
//  KB6  een kaart met een remark wordt niet bewaard; IndexedDB stuk: de app werkt
//  KB7  de leerdata blijven onaangeroerd: de nieuwe functies schrijven niets in
//       de opslag, de spiegel en de export kennen de kaart niet
//  KB8  de inhoud heeft een grens: een hangende inhoud breekt af (met en zonder
//       werkende abort), cacheBezig vrij, reden time-out
//  KB9  de pil en het onderste vak per toestand
//  KB10 C5: de verversing ook zonder licht binnen 400 m (de vroege return)
//  KB11 C7: aiBezig komt vrij; een laat antwoord wordt genegeerd; na 3 keer de worker uit
//  KB12 regressie: de zes geraakte functies zonder de V11.37.18-regels byte-gelijk
//       aan V11.37.17; de merkregels staan op hun plek
//  KB13 stilstand na twee mislukkingen: na de rem zelf opnieuw, zonder GPS-tik;
//       nooit vaker dan eens per 20 s, ook als de rem niet zou staan; niet
//       binnen de rem en niet op het startscherm
//  KB14 terug in beeld: meteen opnieuw (binnen de rem); uit beeld nooit
//  KB15 de pil-tik: nu opnieuw, hooguit eens per minuut, met een melding; twee
//       keer snel = één vraag; niet tijdens een vraag, niet bij een 429 met
//       wachttijd, niet zonder positie, niet als de kaart er al is
//  KB16 een fout van een verversing die niet meer nodig is, laat de pil los
//  KB17 de timer van 30 s in de catch van downloadOSM start geen vraag naast een
//       lopende: na een tik, terug in beeld, een GPS-tik en zelf opnieuw (klok)
//  KB18 het vangnet zonder de oude timer: een hangende download (inhoud hangt,
//       abort doet niets, of geen kopregels) komt na 30 s vrij, daarna een poging
//  KB19 geen extra download: lukt de poging binnen 30 s na een mislukking, dan
//       vraagt de timer niets meer
//  In alle ritten: nooit twee kaartvragen tegelijk (maxTegelijk)
//
//  Alle plekken en nummers zijn bedacht: een basispunt (52.0000, 5.0000),
//  lichten met nummers 96100xx, wegen 96200xx, namen 'Weg A' en 'Plaats B'.
//  Wachttijden van 20 s en meer lopen in de iframe 100x zo snel (KB8: 20x, voor marge).
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_kaartbewaar.js';
//      document.head.appendChild(s);
//      s.onload = () => testKaartbewaar().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

const KB_IDB = { naam: 'StoplichtIQ_Kaart', store: 'kaart', sleutel: 'laatste' };
const KB_INHOUD_NU = "    const d = await kaartLeesInhoud(r, ctrl);   // V11.37.18: ook de inhoud heeft een grens (stond: await r.json()), zie kaartLeesInhoud";
const KB_INHOUD_OUD = "    const d = await r.json();";
const KB_TIMER_NU = "    setTimeout(() => { if (!cacheBezig && huidigePos && kaartNodig(huidigePos.lat, huidigePos.lon)) downloadOSM(huidigePos.lat, huidigePos.lon); }, 30000);   // V11.37.18: alleen zonder lopende vraag en als er nog een kaart nodig is (stond: cacheBezig=false en altijd downloadOSM, ook naast een lopende vraag), zie kaartNodig";
const KB_TIMER_OUD = "    setTimeout(() => { cacheBezig=false; if(huidigePos)downloadOSM(huidigePos.lat,huidigePos.lon); }, 30000);";

function kbIdb() {
  return new Promise((ok, nee) => {
    const v = indexedDB.open(KB_IDB.naam, 1);
    v.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains(KB_IDB.store)) db.createObjectStore(KB_IDB.store); };
    v.onsuccess = (e) => ok(e.target.result);
    v.onerror = () => nee(v.error);
  });
}
async function kbZet(rec) {
  const db = await kbIdb();
  try {
    await new Promise((ok, nee) => {
      const tx = db.transaction(KB_IDB.store, 'readwrite');
      const st = tx.objectStore(KB_IDB.store);
      if (rec === undefined) st.delete(KB_IDB.sleutel); else st.put(rec, KB_IDB.sleutel);
      tx.oncomplete = ok; tx.onerror = () => nee(tx.error);
    });
  } finally { db.close(); }
}
async function kbLees() {
  const db = await kbIdb();
  try {
    return await new Promise((ok, nee) => {
      const v = db.transaction(KB_IDB.store, 'readonly').objectStore(KB_IDB.store).get(KB_IDB.sleutel);
      v.onsuccess = () => ok(v.result); v.onerror = () => nee(v.error);
    });
  } finally { db.close(); }
}

// Een bewaarde kaart rond (lat, lon): licht 9610001 op 55 m van het basispunt,
// 9610004 alleen in de bewaarde kaart (2,2 km verder).
function kbRec(dagenOud, lat, lon) {
  return { v: 1, t: Date.now() - (dagenOud || 0) * 86400000, lat: lat == null ? 52.0000 : lat, lon: lon == null ? 5.0000 : lon, r: 5000,
    lichten: [
      { id: 9610001, lat: 52.0005, lon: 5.0000, naam: 'Weg A, Plaats B', straat: 'Weg A', stad: 'Plaats B', maxspeed: 50, slim: false, eenrichting: [0] },
      { id: 9610004, lat: 52.0200, lon: 5.0000, naam: 'Plaats B', straat: null, stad: 'Plaats B', maxspeed: null, slim: true, eenrichting: null }] };
}

// De verse kaart van de nep-Overpass: drie lichten; 9610001 ligt op een
// eenrichtingsweg met een naam en een limiet.
function kbKaartJson(remark) {
  const d = { elements: [
    { type: 'node', id: 9610001, lat: 52.0005, lon: 5.0000, tags: { highway: 'traffic_signals' } },
    { type: 'node', id: 9610002, lat: 52.0300, lon: 5.0000, tags: { highway: 'traffic_signals' } },
    { type: 'node', id: 9610003, lat: 52.0010, lon: 5.0010, tags: { highway: 'traffic_signals', 'traffic_signals:sound': 'yes' } },
    { type: 'way', id: 9620001, nodes: [9610008, 9610001, 9610009], tags: { highway: 'secondary', name: 'Weg A', maxspeed: '50', oneway: 'yes' },
      geometry: [{ lat: 51.9990, lon: 5.0000 }, { lat: 52.0005, lon: 5.0000 }, { lat: 52.0020, lon: 5.0000 }] }] };
  if (remark) d.remark = 'runtime error: Query timed out in "query" at line 1 after 26 seconds.';
  return d;
}

// ── Draait IN een iframe: een start met de echte startApp ─────
// opt: { modi: ['504', 'ok', ...] (per kaartvraag; de laatste blijft gelden),
//        bewaard: record | undefined (geen) , idbStuk, stappen: [...] }
// Een stap: 'start', 'lees' (wacht op de bewaarde kaart), [lat, lon] (een
// GPS-tik), 'kaart' (wacht tot de kaartvraag klaar is), 'rem0', 'stadwissel'
// (cacheGeladen = false, zoals refreshStadIndienNodig), 'bewaar' (wacht op de
// schrijving), { foto: 'naam', zonderBij }, { ms: n }. opt.ls: sleutels vóór de start.
async function kaartRitBinnen(opt) {
  const echtST = window.setTimeout.bind(window);
  const slaap = (ms) => new Promise(r => echtST(r, ms));
  const factor = opt.factor || 100;
  window.setTimeout = (f, ms, ...a) => echtST(f, (typeof ms === 'number' && ms >= 20000) ? ms / factor : ms, ...a);
  const uit = { foto: {}, vragen: [], watch: 0, fout: null, tegelijk: 0, maxTegelijk: 0 };
  try {
    for (const k of ['sl_startlog', 'sl_opslaglog']) localStorage.setItem(k, '[]');
    for (const [k, v] of Object.entries(opt.ls || {})) localStorage.setItem(k, v);
    if (opt.idbStuk) Object.defineProperty(window, 'indexedDB', { get: () => ({ open() { throw new Error('stuk in de proef'); } }), configurable: true });
    const nep = document.createElement('canvas'); nep.width = 32; nep.height = 32; nep.getContext('2d').fillRect(0, 0, 32, 32);
    const stroom = nep.captureStream(5);
    navigator.mediaDevices.getUserMedia = async () => stroom;
    video.play = () => Promise.resolve();
    let ok = null;
    navigator.geolocation.watchPosition = (a) => { uit.watch++; ok = a; return 1; };
    const modi = (opt.modi || ['ok']).slice();
    window.fetch = async (url, o) => {
      if (String(url) !== OVERPASS_URL) throw new TypeError('geen netwerk in de proef');
      if (!/out%20geom|out geom/.test(String(o && o.body))) return new Response('druk', { status: 504 });   // de vraag naar de fietslichten: niet geteld
      const m = modi.length > 1 ? modi.shift() : modi[0];
      uit.vragen.push(m);
      uit.tegelijk++; uit.maxTegelijk = Math.max(uit.maxTegelijk, uit.tegelijk);
      let klaarAl = false;
      const klaar = () => { if (klaarAl) return; klaarAl = true; uit.tegelijk--; };   // hooguit één keer per vraag
      try {
      const sig = o && o.signal;
      const af = () => new DOMException('afgebroken', 'AbortError');
      if (/^\d+$/.test(m)) return new Response('druk', { status: Number(m), headers: m === '429' ? { 'Retry-After': '90' } : {} });
      if (m === 'net') throw new TypeError('Failed to fetch');
      if (m === 'tijd') return new Promise((_, nee) => sig.addEventListener('abort', () => nee(af())));
      if (m === 'hang' || m === 'hangdoof') {
        const body = new ReadableStream({ start(c) {
          c.enqueue(new TextEncoder().encode('{"elements":['));
          if (m === 'hang') sig.addEventListener('abort', () => c.error(af()));
        } });
        return new Response(body, { status: 200 });
      }
      if (m === 'traaginhoud') {   // kopregels meteen, de inhoud na opt.traagMs (echte ms); pas dan is de vraag klaar
        const body = new ReadableStream({ start(c) {
          const t = echtST(() => { c.enqueue(new TextEncoder().encode(JSON.stringify(kbKaartJson()))); c.close(); klaar(); }, opt.traagMs || 1000);
          if (sig) sig.addEventListener('abort', () => { clearTimeout(t); try { c.error(af()); } catch (e) {} klaar(); });
        } });
        return new Response(body, { status: 200 });
      }
      if (m === 'kapot') return new Response('<html>storing</html>', { status: 200 });
      if (m === 'leeg') return new Response(JSON.stringify({ elements: [] }), { status: 200 });
      if (m === 'ok200') await slaap(200);
      return new Response(JSON.stringify(kbKaartJson(m === 'remark')), { status: 200 });
      } finally { if (m === 'traaginhoud') {} else if (!['tijd', 'hang', 'hangdoof'].includes(m)) klaar(); else if (o && o.signal) o.signal.addEventListener('abort', klaar); }
    };
    window.refreshStadIndienNodig = async () => {};
    uit.toasts = [];
    window.toonToast = (t) => { uit.toasts.push(String(t)); };
    window.haalStraatnamenOp = async () => {};
    const pos = (lat, lon) => ({ coords: { latitude: lat, longitude: lon, accuracy: 9, heading: 0, speed: 5 }, timestamp: Date.now() });
    const foto = () => ({ pil: pOSMT.textContent, pk: pOSM.className, naam: kNaam.textContent, af: kAf.textContent, leer: leerNaam.textContent,
      gps: pGPS.className, geladen: cacheGeladen, n: osmCache.length, ids: osmCache.map(s => s.id).join(','), licht: dichtstbijOSM ? dichtstbijOSM.id : null,
      bezig: cacheBezig, vragen: uit.vragen.length, rem: kaartRem.n, cl: clusterNodes.size,
      bewaard: typeof kaartIsBewaard === 'undefined' ? null : kaartIsBewaard, stand: typeof kaartBewaardStand === 'undefined' ? null : kaartBewaardStand,
      fout: typeof kaartFout === 'undefined' ? null : kaartFout });
    for (const stap of (opt.stappen || [])) {
      if (stap === 'start') {
        await startApp();
        clearInterval(cameraWatchdogInterval); lusGeneratie++;
        if (typeof startTimer !== 'undefined' && startTimer) clearInterval(startTimer);
      } else if (stap === 'lees') {
        for (let i = 0; i < 100 && typeof kaartBewaardStand !== 'undefined' && (kaartBewaardStand === null || kaartBewaardStand === 'laden'); i++) await slaap(20);
      } else if (Array.isArray(stap)) {
        await ok(pos(stap[0], stap[1])); await slaap(30);
      } else if (stap === 'kaart') {
        for (let i = 0; i < 150 && cacheBezig; i++) await slaap(20);
        await slaap(30);
      } else if (stap === 'rem0') {
        kaartRem.nietVoor = 0;
      } else if (stap === 'stadwissel') {
        cacheGeladen = false;
      } else if (stap === 'verborgen' || stap === 'zichtbaar') {
        const zv = stap === 'verborgen' ? 'hidden' : 'visible';
        Object.defineProperty(document, 'visibilityState', { get: () => zv, configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));
      } else if (stap === 'startscherm') {
        document.getElementById('startscherm').classList.remove('weg');
      } else if (stap === 'piltik') {
        pOSM.parentElement.click();
      } else if (stap === 'tikklok61') {
        kaartTikT -= 61000;
      } else if (stap === 'bewaar') {
        const t0 = Date.now() - 5000;
        for (let i = 0; i < 100; i++) { let r = null; try { r = await kbLees(); } catch (e) {} if (r && r.t >= t0) break; await slaap(20); }
      } else if (stap.foto) {
        if (typeof kaartWeergaveBij === 'function' && !stap.zonderBij) kaartWeergaveBij();
        uit.foto[stap.foto] = foto();
      } else if (stap.ms) {
        await slaap(stap.ms);
      }
    }
    uit.osm = osmCache.map(s => ({ ...s }));
    uit.ring = JSON.parse(localStorage.getItem('sl_startlog') || '[]');
    uit.opslag = (JSON.parse(localStorage.getItem('sl_opslaglog') || '[]') || []).map(r => r.reden + ':' + (r.element || '') + ':' + (r.poortReden || ''));
  } catch (e) { uit.fout = String((e && e.stack) || e).slice(0, 300); }
  window.setTimeout = echtST;
  return uit;
}

async function testKaartbewaar() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen: String(gekregen) });
    return gelukt;
  };
  const NL = '\n';
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const lsBewaard = ['sl_startlog', 'sl_opslaglog', 'sl_fietslichten', 'sl_fietspoging'].map(k => [k, localStorage.getItem(k)]);
  let idbBewaard;
  try { idbBewaard = await kbLees(); } catch (e) { idbBewaard = undefined; }
  const herstel = async () => {
    for (const [k, v] of lsBewaard) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    try { await kbZet(idbBewaard); } catch (e) {}
  };

  const bron = new URL('test_kaartbewaar.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?kaart=' + Math.random();
    document.body.appendChild(f);
    try {
      await new Promise((ok, nee) => { f.onload = ok; f.onerror = nee; });
      for (let poging = 2; typeof f.contentWindow.startApp !== 'function'; poging++) {
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
      if (opt.bewaard !== null) await kbZet(opt.bewaard);
      return await w.kaartRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), foto: {}, vragen: [], ring: [], opslag: [] };
    } finally {
      f.remove();
      for (const [k, v] of lsBewaard) if (k.startsWith('sl_fiets')) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }   // na elke rit, zie KB2f
    }
  };
  const kort = (x) => JSON.stringify(x || {}).slice(0, 260);

  try {
    // ═══ KB1 — een gelukte kaart wordt bewaard ═══════════════════
    const r1 = await rit({ bewaard: undefined, modi: ['ok'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', 'bewaar', { foto: 'na' }] });
    const rec1 = await kbLees().catch(() => null);
    const keur1 = rec1 ? kaartKeur(rec1, Date.now()) : { stand: 'geen' };
    const vers1 = (r1.osm || []).map(s => ({ id: s.id, lat: s.lat, lon: s.lon, naam: s.naam, straat: s.straat, stad: s.stad, maxspeed: s.maxspeed, slim: s.slim, eenrichting: s.eenrichting }));
    eis('KB1a na een gelukte kaart staat er een bewaarde kaart: versie 1, het midden is de plek van de vraag, 3 lichten', !r1.fout && rec1 && rec1.v === 1 && rec1.lat === 52.0000 && rec1.lon === 5.0000 && rec1.lichten.length === 3,
        'v 1, (52, 5), 3 lichten', r1.fout || kort(rec1 && { v: rec1.v, lat: rec1.lat, lon: rec1.lon, n: rec1.lichten && rec1.lichten.length }));
    eis('KB1b de gekeurde kopie is veld voor veld gelijk aan osmCache (naam, limiet, eenrichting, slim)', keur1.stand === 'ok' && JSON.stringify(keur1.rec.lichten) === JSON.stringify(vers1)
        && vers1.some(s => s.id === 9610001 && s.maxspeed === 50 && JSON.stringify(s.eenrichting) === '[0]' && /^Weg A/.test(s.naam)) && vers1.some(s => s.slim),
        'gelijk', keur1.stand + ' ' + JSON.stringify(vers1).slice(0, 200));
    eis('KB1c de pil zegt Kaart (groen) en er is een licht', r1.foto.na && r1.foto.na.pil === 'Kaart' && / g$/.test(r1.foto.na.pk) && r1.foto.na.licht === 9610001, 'Kaart, groen, licht 9610001', kort(r1.foto.na));

    // ═══ KB2 — de volgende start met de bewaarde kaart ═══════════
    const r2 = await rit({ bewaard: kbRec(2), modi: ['ok200'], stappen: ['start', 'lees', { foto: 'voor' }, [52.0000, 5.0000], { foto: 'tik', zonderBij: true }, 'kaart', 'bewaar', { foto: 'na' }] });
    const t2 = r2.foto.tik || {}, n2 = r2.foto.na || {};
    eis('KB2a vóór de eerste tik: gelezen (ok), nog niet neergezet, onderin Wacht op GPS…', r2.foto.voor && r2.foto.voor.stand === 'ok' && !r2.foto.voor.geladen && r2.foto.voor.naam === 'Wacht op GPS…',
        'ok, niet geladen, Wacht op GPS…', r2.fout || kort(r2.foto.voor));
    eis('KB2b de eerste tik zet de bewaarde kaart meteen neer: licht 9610001, pil Bewaard (groen), en de verversing loopt al', t2.geladen && t2.ids === '9610001,9610004' && t2.licht === 9610001 && t2.pil === 'Bewaard' && / g$/.test(t2.pk) && t2.bewaard && t2.vragen === 1,
        'neergezet, Bewaard, 1 vraag', kort(t2));
    eis('KB2c de verversing gelukt: de verse kaart (3 lichten), pil Kaart, niet meer de bewaarde, en opnieuw bewaard', n2.ids === '9610001,9610002,9610003' && n2.pil === 'Kaart' && n2.bewaard === false && n2.vragen === 1,
        'vers, Kaart', kort(n2));
    const s2 = (r2.ring || []).find(r => r.k === 's') || {};
    eis('KB2d de startlog: bl (gelezen, bs ok... daarna gebruikt), bk met bn 2 en bo (uren), en k1 voor de verse kaart', s2.bl >= 0 && s2.bk >= s2.bl && s2.bn === 2 && s2.bo >= 47 && s2.bo <= 49 && s2.k1 >= s2.bk,
        'bl <= bk <= k1, bn 2, bo 48', kort(s2));
    eis('KB2e de opslaglog: een regel kaart_bewaard met het aantal en de leeftijd', (r2.opslag || []).some(x => /^kaart_bewaard:n=2:uur=48 af=0$/.test(x)), 'kaart_bewaard:n=2:uur=48 af=0', (r2.opslag || []).filter(x => /kaart/.test(x)).join(' ; '));

    const rec2f = kbRec(1);
    rec2f.lichten = [rec2f.lichten[0], { id: 9610005, lat: 52.00135, lon: 5.0000, naam: 'Weg A', straat: 'Weg A', stad: null, maxspeed: null, slim: false, eenrichting: null },
      { id: 9610007, lat: 52.0200, lon: 5.0000, naam: null, straat: null, stad: null, maxspeed: null, slim: false, eenrichting: null },
      { id: 9610008, lat: 52.02002, lon: 5.0000, naam: null, straat: null, stad: null, maxspeed: null, slim: false, eenrichting: null }];
    const fiets2f = JSON.stringify({ v: 2, gebieden: [{ t: Date.now(), lat: 52.0000, lon: 5.0000, r: 5000, ids: [9610001] }] });
    const r2f = await rit({ bewaard: rec2f, modi: ['504'], ls: { sl_fietslichten: fiets2f }, stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { foto: 'na' }] });
    eis('KB2f met de bewaarde kaart gelden de fietslijst (het fietslicht op 55 m doet niet mee: licht 9610005 op 150 m) en de clusters (twee lichten 2 m uit elkaar)',
        (r2f.foto.na || {}).licht === 9610005 && (r2f.foto.na || {}).cl === 2 && (r2f.foto.na || {}).bewaard === true, 'licht 9610005, 2 in een cluster', r2f.fout || kort(r2f.foto.na));

    // ═══ KB3 — bewaarde kaart, verversing mislukt ═══════════════
    const r3 = await rit({ bewaard: kbRec(1), modi: ['504', '504', 'ok'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { foto: 'fout' },
      [52.0001, 5.0000], { foto: 'tik2' }, { ms: 400 }, 'rem0', [52.0001, 5.0000], 'kaart', { ms: 400 }, { foto: 'poging2' }, 'rem0', [52.0001, 5.0000], 'kaart', { foto: 'vers' }] });   // ms 400: eerst de timer van 30 s (hier 0,3 s) uit de catch, zie KB3
    const f3 = r3.foto.fout || {};
    eis('KB3a de verversing mislukt (504): de bewaarde kaart blijft, het licht blijft, de pil zegt Kaart 504 met de aftelling (oranje)', f3.geladen && f3.ids === '9610001,9610004' && f3.licht === 9610001 && /^Kaart 504 · \d+:\d\d$/.test(f3.pil) && / o$/.test(f3.pk) && f3.rem === 1,
        'blijft, Kaart 504, rem 1', r3.fout || kort(f3));
    eis('KB3b binnen de rem geen nieuwe vraag (de tik doet niets), het onderste vak toont gewoon het licht', (r3.foto.tik2 || {}).vragen === 1 && (r3.foto.tik2 || {}).licht === 9610001 && (r3.foto.tik2 || {}).naam !== 'Wacht op GPS…',
        '1 vraag, licht', kort(r3.foto.tik2));
    eis('KB3c na de rem: een nieuwe poging; mislukt weer (rem 2), gelukt daarna: de verse kaart', (r3.foto.poging2 || {}).vragen === 2 && (r3.foto.poging2 || {}).rem === 2 && (r3.foto.vers || {}).vragen === 3 && (r3.foto.vers || {}).ids === '9610001,9610002,9610003' && (r3.foto.vers || {}).pil === 'Kaart',
        '2 vragen, rem 2; dan 3, vers', kort(r3.foto.poging2) + ' | ' + kort(r3.foto.vers));

    // ═══ KB4 — kapot, te oud, te groot, te ver ═══════════════════
    const groot = kbRec(0); groot.lichten = Array.from({ length: 6001 }, (_, i) => ({ id: 9700000 + i, lat: 52 + i * 1e-6, lon: 5, naam: null, straat: null, stad: null, maxspeed: null, slim: false, eenrichting: null }));
    const soorten = [
      ['versie', { ...kbRec(0), v: 2 }, 'kapot'], ['lichten geen lijst', { ...kbRec(0), lichten: 'x' }, 'kapot'],
      ['een licht zonder lat', (() => { const r = kbRec(0); r.lichten[1] = { ...r.lichten[1], lat: 'x' }; return r; })(), 'kapot'],
      ['leeg', { ...kbRec(0), lichten: [] }, 'kapot'], ['een tekst', 'onzin', 'kapot'],
      ['te oud (31 dagen)', kbRec(31), 'oud'], ['te groot (6.001 lichten)', groot, 'groot'], ['te ver (5,6 km)', kbRec(0, 52.0500, 5.0000), 'ver']];
    const zonder4 = await rit({ bewaard: undefined, modi: ['504'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { foto: 'na' }] });
    const afw4 = [];
    for (const [naam, rec, stand] of soorten) {
      const r = await rit({ bewaard: rec, modi: ['504'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { foto: 'na' }] });
      const a = r.foto.na || {}, z = zonder4.foto.na || {};
      const klokLos = (x) => String(x).replace(/\d+:\d\d/g, 'm:ss');   // de rem heeft 20% spreiding
      const zelfde = ['pil', 'pk', 'naam', 'leer', 'af', 'geladen', 'n', 'licht', 'vragen', 'rem'].every(k => klokLos(JSON.stringify(a[k])) === klokLos(JSON.stringify(z[k])));
      if (r.fout || !zelfde || a.stand !== stand) afw4.push(naam + ': ' + (r.fout || (a.stand + ' ' + kort(a).slice(0, 120))));
    }
    eis('KB4 kapot (5 soorten), te oud, te groot en te ver: niet gebruikt, en de start is gelijk aan een start zonder bewaarde kaart (pil, vak, kaart, vragen, rem)',
        afw4.length === 0 && (zonder4.foto.na || {}).naam === 'Geen kaart (504)', '8 x gelijk, stand klopt', afw4.join(' | ') || 'gelijk; ' + kort(zonder4.foto.na));

    // ═══ KB5 — te ver bij de start, later binnen 3 km ═══════════
    const r5 = await rit({ bewaard: kbRec(0, 52.0500, 5.0000), modi: ['504'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { foto: 'ver' }, [52.0250, 5.0000], { foto: 'dichter' }] });
    eis('KB5 te ver bij de start (5,6 km): niet gebruikt; na 2,8 km rijden wel (binnen 3 km van het oude midden)',
        (r5.foto.ver || {}).geladen === false && (r5.foto.ver || {}).stand === 'ver' && (r5.foto.dichter || {}).geladen === true && (r5.foto.dichter || {}).ids === '9610001,9610004',
        'eerst niet, dan wel', r5.fout || kort(r5.foto.ver) + ' | ' + kort(r5.foto.dichter));

    const r5b = await rit({ bewaard: kbRec(0, 52.0500, 5.0000), modi: ['ok'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', 'stadwissel', 'rem0', [52.0250, 5.0000], { foto: 'na', zonderBij: true }, 'kaart'] });
    eis('KB5b de bewaarde kaart alleen zolang er in deze sessie nog geen kaart was: na een verse kaart en een stadswissel (cacheGeladen weer onwaar) niet',
        (r5b.foto.na || {}).ids === '9610001,9610002,9610003' && !(r5b.opslag || []).some(x => /^kaart_bewaard/.test(x)), 'de verse kaart, geen kaart_bewaard', r5b.fout || kort(r5b.foto.na));

    // ═══ KB6 — remark niet bewaren; IndexedDB stuk ══════════════
    await kbZet(undefined);
    const r6 = await rit({ bewaard: null, modi: ['remark'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { ms: 300 }, { foto: 'na' }] });
    const rec6 = await kbLees().catch(() => null);
    eis('KB6a een kaart met een remark (half antwoord) wordt gebruikt zoals altijd, maar niet bewaard', (r6.foto.na || {}).n === 3 && rec6 === undefined, '3 lichten, niets bewaard', r6.fout || kort(r6.foto.na) + ' / ' + (rec6 === undefined ? 'niets' : 'bewaard'));
    const r6b = await rit({ bewaard: null, idbStuk: true, modi: ['ok'], stappen: ['start', [52.0000, 5.0000], 'kaart', { ms: 100 }, { foto: 'na' }] });
    eis('KB6b IndexedDB stuk: geen fout, de kaart komt gewoon (Kaart, licht), stand fout', !r6b.fout && (r6b.foto.na || {}).pil === 'Kaart' && (r6b.foto.na || {}).licht === 9610001 && (r6b.foto.na || {}).stand === 'fout',
        'Kaart, licht, fout', r6b.fout || kort(r6b.foto.na));

    // ═══ KB7 — de leerdata blijven onaangeroerd ══════════════════
    const nieuweFn = [kaartIdbOpen, kaartKeur, kaartBewaardLaad, kaartBewaardTik, kaartBewaardZet, kaartNaDownload, kaartBewaar, kaartLeesInhoud, kaartFoutReden, kaartFoutNoteer, kaartKlok, kaartWeergaveBij];
    const code7 = nieuweFn.map(zc).join(NL);
    eis('KB7a de nieuwe kaartfuncties schrijven niets in localStorage of de opslaglaag (alleen de logregel en de startlog)',
        !/localStorage|opslagSchrijf|opslagVerwijder|idbNoteer|idbDb|(?<![A-Z_])IDB_NAAM|(?<![A-Z_])IDB_STORE\b/.test(code7) && /KAART_IDB_NAAM/.test(code7), 'geen', (code7.match(/localStorage|opslagSchrijf|opslagVerwijder|idbNoteer|idbDb|(?<![A-Z_])IDB_NAAM|(?<![A-Z_])IDB_STORE\b/g) || []).join(',') || 'geen');
    eis('KB7b een eigen database: een andere naam dan de spiegel, en de spiegel kent hem niet', KAART_IDB_NAAM !== IDB_NAAM && !/kaart/i.test(zc(idbHerstel) + zc(idbMigratie) + zc(exportSleutelMee)),
        'eigen naam', KAART_IDB_NAAM + ' / ' + IDB_NAAM);
    let spiegelSleutels = [];
    try { if (idbDb) spiegelSleutels = [...(await idbLeesAlles()).keys()].filter(k => /kaart|9610004/i.test(k)); } catch (e) { spiegelSleutels = ['fout ' + e]; }
    const lsKaart = Object.keys(localStorage).filter(k => { const v = localStorage.getItem(k) || ''; return v.includes('9610004'); });
    eis('KB7c na de ritten: geen sleutel in localStorage of de spiegel met een licht dat alleen in de bewaarde kaart stond', lsKaart.length === 0 && spiegelSleutels.length === 0,
        'geen', lsKaart.concat(spiegelSleutels).join(',') || 'geen');

    // ═══ KB8 — de inhoud heeft een grens ═════════════════════════
    const r8 = await rit({ bewaard: undefined, modi: ['hang'], factor: 20, stappen: ['start', 'lees', [52.0000, 5.0000], { ms: 100 }, { foto: 'bezig', zonderBij: true }, { ms: 2500 }, { foto: 'na' }] });
    const r8b = await rit({ bewaard: undefined, modi: ['hangdoof'], factor: 20, stappen: ['start', 'lees', [52.0000, 5.0000], { ms: 2600 }, { foto: 'na' }] });
    const s8 = (r8.ring || []).find(r => r.k === 's') || {};
    eis('KB8a een hangende inhoud: eerst Kaart laden…, na de grens (30 s, hier 1,5 s) afgebroken: cacheBezig vrij, time-out, de rem',
        (r8.foto.bezig || {}).bezig === true && (r8.foto.bezig || {}).naam === 'Kaart laden…' && (r8.foto.na || {}).bezig === false && (r8.foto.na || {}).fout === 'time-out' && /^Kaart time-out · \d+:\d\d$/.test((r8.foto.na || {}).pil) && (r8.foto.na || {}).rem === 1 && JSON.stringify(s8.os) === '["tijd"]',
        'laden, dan time-out', r8.fout || kort(r8.foto.bezig) + ' | ' + kort(r8.foto.na));
    eis('KB8b ook als abort() de inhoud niet zou afbreken: de race maakt cacheBezig vrij', (r8b.foto.na || {}).bezig === false && (r8b.foto.na || {}).fout === 'time-out',
        'vrij, time-out', r8b.fout || kort(r8b.foto.na));

    // ═══ KB9 — de pil en het onderste vak ════════════════════════
    const tekst9 = [];
    const verwacht9 = { '502': ['Kaart 502', 'Geen kaart (502)'], '504': ['Kaart 504', 'Geen kaart (504)'], '429': ['Kaart 429', 'Geen kaart (429)'],
                        tijd: ['Kaart time-out', 'Geen kaart (time-out)'], net: ['Kaart netwerk', 'Geen kaart (netwerk)'], kapot: ['Kaart kapot', 'Geen kaart (kapot)'] };
    for (const [m, [pil, naam]] of Object.entries(verwacht9)) {
      const r = await rit({ bewaard: undefined, modi: [m], stappen: ['start', 'lees', { foto: 'gps' }, [52.0000, 5.0000], 'kaart', { foto: 'fout' }, 'rem0', { foto: 'zo' }] });
      const a = r.foto.fout || {}, z = r.foto.zo || {}, g = r.foto.gps || {};
      const klok = /^over \d+:\d\d$/.test(a.af) && /^Geen kaart · opnieuw over \d+:\d\d$/.test(a.leer);
      const goed = !r.fout && g.naam === 'Wacht op GPS…' && g.leer === 'Wacht op GPS…' && a.pil.startsWith(pil + ' · ') && /^\d+:\d\d$/.test(a.pil.slice(pil.length + 3)) && / o$/.test(a.pk) && a.naam === naam && klok
        && z.pil === pil && z.af === 'zo' && z.leer === 'Geen kaart · zo opnieuw' && a.gps === 'pill-dot b' && (m !== '429' || /^over 1:(2|3)\d$/.test(a.af));
      tekst9.push(m + (goed ? ' ok' : ' FOUT ' + (r.fout || kort(a))));
    }
    eis('KB9a per reden (502, 504, 429, time-out, netwerk, kapot): de pil met de reden en de aftelling, onderin Geen kaart (reden) met de aftelling; na de rem zonder aftelling en zo opnieuw; vóór de tik Wacht op GPS…',
        tekst9.every(x => / ok$/.test(x)), 'zes keer goed', tekst9.join(' | '));
    const r9 = await rit({ bewaard: undefined, modi: ['leeg'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { foto: 'na' }] });
    eis('KB9b een lege kaart: onderin Geen kaartdata (beide regels), de pil Kaart', (r9.foto.na || {}).naam === 'Geen kaartdata' && (r9.foto.na || {}).leer === 'Geen kaartdata' && (r9.foto.na || {}).pil === 'Kaart',
        'Geen kaartdata', r9.fout || kort(r9.foto.na));
    eis('KB9c de klok: 0 -> 0:00, 61.000 ms -> 1:01, 600.001 ms -> 10:01', kaartKlok(0) === '0:00' && kaartKlok(61000) === '1:01' && kaartKlok(600001) === '10:01',
        '0:00, 1:01, 10:01', [kaartKlok(0), kaartKlok(61000), kaartKlok(600001)].join(', '));
    eis('KB9d de reden: status wint; AbortError en TimeoutError = time-out; TypeError = netwerk; de rest = kapot',
        kaartFoutReden(502, null) === '502' && kaartFoutReden(null, { name: 'AbortError' }) === 'time-out' && kaartFoutReden(0, { name: 'TimeoutError' }) === 'time-out'
        && kaartFoutReden(null, { name: 'TypeError' }) === 'netwerk' && kaartFoutReden(null, { name: 'SyntaxError' }) === 'kapot' && kaartFoutReden(null, null) === 'kapot', 'zo', 'ok');

    // ═══ KB10 — C5 ═══════════════════════════════════════════════
    const r10 = await rit({ bewaard: undefined, modi: ['ok'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { foto: 'eerst' }, [52.0000, 5.0500], 'kaart', { foto: 'ver' }] });
    eis('KB10 C5: 3,4 km van het midden zonder licht binnen 400 m (de vroege return): toch een nieuwe kaartvraag, en het midden verschuift',
        (r10.foto.eerst || {}).vragen === 1 && (r10.foto.ver || {}).vragen === 2, '2 vragen', r10.fout || kort(r10.foto.eerst) + ' | ' + kort(r10.foto.ver));

    // ═══ KB13 — stilstand na twee mislukkingen: zelf opnieuw ════
    const r13 = await rit({ bewaard: undefined, modi: ['504', '504', 'ok'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { ms: 400 }, 'rem0',
      [52.0000, 5.0000], 'kaart', { ms: 400 }, { foto: 'twee' }, 'rem0', { ms: 1300 }, 'kaart', { foto: 'zelf' }] });
    const t13 = r13.foto.twee || {}, z13 = r13.foto.zelf || {};
    eis('KB13a stilstand na twee mislukkingen (rem 2): zodra de rem voorbij is, zonder GPS-tik zelf opnieuw met de laatste positie; die lukt: de kaart',
        t13.vragen === 2 && t13.rem === 2 && z13.vragen === 3 && z13.ids === '9610001,9610002,9610003' && z13.pil === 'Kaart' && (r13.opslag || []).some(x => /^kaart_zelf:klok:n=1 rem=2$/.test(x)),
        '2 vragen, rem 2; dan 3e vraag zonder tik, kaart', r13.fout || kort(t13) + ' | ' + kort(z13));
    const r13b = await rit({ bewaard: undefined, modi: ['504'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { ms: 400 }, 'rem0', { ms: 1300 }, 'kaart', { ms: 400 }, { foto: 'zelf' },
      'rem0', { ms: 2300 }, { foto: 'geenlus' }] });
    eis('KB13b geen lus: na een zelf-poging die mislukt, en zelfs als de rem dan zou ontbreken (rem op 0 gezet), binnen 20 s geen volgende',
        (r13b.foto.zelf || {}).vragen === 2 && (r13b.foto.geenlus || {}).vragen === 2 && r13b.maxTegelijk === 1, '2 vragen, en 2 blijft', r13b.fout || kort(r13b.foto.zelf) + ' | ' + kort(r13b.foto.geenlus));

    const r13c = await rit({ bewaard: undefined, modi: ['504', 'ok'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { ms: 1300 }, { foto: 'binnenrem' },
      'startscherm', 'rem0', { ms: 1300 }, { foto: 'start' }] });
    eis('KB13c zelf opnieuw wacht op de rem (1,3 s na de fout: geen vraag), en doet niets op het startscherm (ook niet als de rem voorbij is)',
        (r13c.foto.binnenrem || {}).vragen === 1 && (r13c.foto.start || {}).vragen === 1 && !(r13c.opslag || []).some(x => /^kaart_zelf/.test(x)),
        '1 en 1', r13c.fout || kort(r13c.foto.binnenrem) + ' | ' + kort(r13c.foto.start));

    const r13d = await rit({ bewaard: undefined, modi: ['504', 'hang'], factor: 20, stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { ms: 1700 }, 'rem0',
      [52.0000, 5.0000], { ms: 1200 }, { foto: 'tijdens', zonderBij: true }, { ms: 600 }, { foto: 'na' }] });
    eis('KB13d terwijl een vraag loopt (hier een hangende inhoud, 1,2 s lang), doet zelf opnieuw niets: geen logregel, geen tweede vraag; daarna de time-out',
        (r13d.foto.tijdens || {}).bezig === true && (r13d.foto.tijdens || {}).vragen === 2 && !(r13d.opslag || []).some(x => /^kaart_zelf/.test(x)) && (r13d.foto.na || {}).fout === 'time-out' && r13d.maxTegelijk === 1,
        'bezig, 2 vragen, geen kaart_zelf', r13d.fout || kort(r13d.foto.tijdens) + ' | ' + (r13d.opslag || []).filter(x => /kaart_/.test(x)).join(' ; '));

    // ═══ KB14 — terug in beeld ═══════════════════════════════════
    const r14 = await rit({ bewaard: undefined, modi: ['504', 'ok200'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { ms: 400 }, 'verborgen', 'rem0', { ms: 1300 },
      { foto: 'weg', zonderBij: true }, 'zichtbaar', { ms: 40 }, { foto: 'terug', zonderBij: true }, 'kaart', { foto: 'na' }] });
    eis('KB14 uit beeld geen poging (ook niet na de rem); terug in beeld meteen (binnen 40 ms, dus niet de klok van 1 s), en die lukt',
        (r14.foto.weg || {}).vragen === 1 && (r14.foto.terug || {}).vragen === 2 && (r14.foto.terug || {}).bezig === true && (r14.opslag || []).some(x => /^kaart_zelf:zicht:/.test(x)) && (r14.foto.na || {}).n === 3,
        '1, dan 2 (zicht), kaart', r14.fout || kort(r14.foto.weg) + ' | ' + kort(r14.foto.terug));

    // ═══ KB15 — de pil-tik ═══════════════════════════════════════
    const r15 = await rit({ bewaard: undefined, modi: ['tijd', '504', 'ok'], stappen: ['start', 'lees', 'piltik', { foto: 'voorgps' },
      [52.0000, 5.0000], 'piltik', 'piltik', { foto: 'tijdens', zonderBij: true }, 'kaart', { foto: 'fout1' },
      'piltik', { ms: 100 }, 'piltik', 'kaart', { foto: 'tweesnel' }, 'tikklok61', 'piltik', 'kaart', { foto: 'na61' }, 'piltik', { foto: 'erl' }] });
    const m15 = r15.toasts || [];
    eis('KB15a zonder positie: niets, melding Nog geen GPS-positie', (r15.foto.voorgps || {}).vragen === 0 && m15[0] === 'Nog geen GPS-positie', '0 vragen, melding', r15.fout || m15[0]);
    eis('KB15b tijdens een lopende vraag: twee tikken starten niets, melding De kaart wordt al opgehaald (twee keer)',
        (r15.foto.tijdens || {}).vragen === 1 && (r15.foto.tijdens || {}).bezig === true && m15[1] === 'De kaart wordt al opgehaald' && m15[2] === 'De kaart wordt al opgehaald',
        '1 vraag', kort(r15.foto.tijdens) + ' | ' + m15.slice(1, 3).join(' / '));
    eis('KB15c na de mislukking (rem loopt): twee tikken snel achter elkaar = één nieuwe vraag (de rem genegeerd) en daarna Opnieuw kan over 1:00',
        (r15.foto.fout1 || {}).vragen === 1 && (r15.foto.tweesnel || {}).vragen === 2 && m15[3] === 'Kaart wordt opnieuw opgehaald' && /^Opnieuw kan over (1:00|0:5\d)$/.test(m15[4] || ''),
        '1, dan 2; meldingen', kort(r15.foto.tweesnel) + ' | ' + m15.slice(3, 5).join(' / '));
    eis('KB15d na een minuut mag het weer (die lukt: de kaart); en met de kaart er al: niets, melding De kaart is er al',
        (r15.foto.na61 || {}).vragen === 3 && (r15.foto.na61 || {}).n === 3 && (r15.foto.erl || {}).vragen === 3 && m15[5] === 'Kaart wordt opnieuw opgehaald' && m15[6] === 'De kaart is er al',
        '3 vragen, kaart; dan niets', kort(r15.foto.erl) + ' | ' + m15.slice(5).join(' / '));
    eis('KB15e nooit twee kaartvragen tegelijk (tik, klok en GPS-tik door elkaar)', r15.maxTegelijk === 1 && r13.maxTegelijk === 1 && r14.maxTegelijk === 1,
        '1', [r15.maxTegelijk, r13.maxTegelijk, r14.maxTegelijk].join(', '));
    const r15b = await rit({ bewaard: undefined, modi: ['429'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', 'piltik', { foto: 'na' }] });
    eis('KB15f na een 429 met wachttijd (90 s): de tik wacht wat de server vraagt, met de resttijd', (r15b.foto.na || {}).vragen === 1 && /^De kaartserver vraagt te wachten: nog 1:(2|3)\d$/.test((r15b.toasts || [])[0] || ''),
        '1 vraag, melding', r15b.fout || (r15b.toasts || []).join(' / '));
    const kn15 = document.getElementById('p-osm').parentElement;
    eis('KB15g de pil is de knop: het element rond p-osm, en kaartPilTik wijst niets toe buiten de rem, de eigen tikklok en de melding',
        kn15 && kn15.classList.contains('pill') && !/(?<![.\w$])(osmCache|cacheGeladen|cacheCentrum|cacheBezig|kaartIsBewaard|kaartFout)\s*=(?!=)/.test(zc(kaartPilTik)), 'ja', 'ok');

    // ═══ KB16 — een fout die niet meer geldt ═════════════════════
    const r16 = await rit({ bewaard: undefined, modi: ['ok', '504'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', [52.0000, 5.0500], 'kaart', { foto: 'ver' },
      [52.0000, 5.0000], { foto: 'terug' }, 'piltik', { foto: 'tik' }, { ms: 400 }, 'rem0', { ms: 1300 }, { foto: 'klok' }] });   // ms 400: eerst de timer van 30 s (hier 0,3 s) uit de catch, zie KB3
    eis('KB16 verversing op 3,4 km mislukt: pil Kaart 504 met aftelling; terug binnen 3 km: pil weer Kaart (groen), een tik doet niets (De kaart is er al), en ook na de rem geen zelf-poging',
        /^Kaart 504 · \d+:\d\d$/.test((r16.foto.ver || {}).pil) && (r16.foto.terug || {}).pil === 'Kaart' && / g$/.test((r16.foto.terug || {}).pk) && (r16.foto.tik || {}).vragen === 2 && (r16.toasts || [])[0] === 'De kaart is er al' && (r16.foto.klok || {}).vragen === 2,
        'Kaart 504, dan Kaart; geen vraag', r16.fout || kort(r16.foto.ver) + ' | ' + kort(r16.foto.terug) + ' | ' + (r16.toasts || []).join(' / '));

    // ═══ KB17 — de timer van 30 s start geen tweede vraag ════════
    // De timer gaat 30 s na een mislukking af (hier 3 s, factor 10). Na 1 s start een nieuwe vraag waarvan
    // de inhoud 2,5 s onderweg is: de timer valt er middenin (0,5 s marge aan beide kanten, ook tot de
    // inhoudgrens van 3 s). Was: cacheBezig = false en een vraag erbij (maxTegelijk 2, drie vragen).
    const k17 = { bewaard: undefined, modi: ['504', 'traaginhoud', 'ok'], factor: 10, traagMs: 2500 };
    const k17stap = (route) => ['start', 'lees', [52.0000, 5.0000], 'kaart', { ms: 1000 }, ...route, { ms: 3500 }, { foto: 'na' }];
    const r17a = await rit({ ...k17, stappen: k17stap(['piltik']) });
    const r17b = await rit({ ...k17, stappen: k17stap(['rem0', 'verborgen', 'zichtbaar']) });
    const r17c = await rit({ ...k17, stappen: k17stap(['rem0', [52.0000, 5.0000]]) });
    // zelf opnieuw (klok): de rem eraf na 1,5 s, de klok tikt binnen 1 s (tussen 1,5 en 2,5 s), de inhoud duurt 2,5 s
    const r17d = await rit({ ...k17, stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', { ms: 1500 }, 'rem0', { ms: 4500 }, { foto: 'na' }] });
    const ok17 = (r, bron) => !r.fout && r.maxTegelijk === 1 && r.vragen.length === 2 && (r.foto.na || {}).geladen === true && (r.foto.na || {}).pil === 'Kaart'
      && (!bron || (r.opslag || []).some(x => x.startsWith(bron)));
    const k17t = (r) => r.fout || 'max ' + r.maxTegelijk + ', vragen ' + r.vragen.join(',') + ', ' + kort(r.foto.na).slice(0, 80);
    eis('KB17a tik op de pil na een 504, de kaartserver traag: de timer start er geen vraag naast (max 1, twee vragen, de kaart)', ok17(r17a, 'kaart_tik'), 'max 1, 2 vragen', k17t(r17a));
    eis('KB17b terug in beeld na de rem, traag: de timer start er geen vraag naast', ok17(r17b, 'kaart_zelf:zicht'), 'max 1, 2 vragen', k17t(r17b));
    eis('KB17c een GPS-tik na de rem, traag: de timer start er geen vraag naast', ok17(r17c), 'max 1, 2 vragen', k17t(r17c));
    eis('KB17d stilstand: zelf opnieuw (klok) na de rem, traag: de timer start er geen vraag naast', ok17(r17d, 'kaart_zelf:klok'), 'max 1, 2 vragen', k17t(r17d));

    // ═══ KB18 — het vangnet zonder de oude timer ═════════════════
    // De oude timer zette cacheBezig op false; hij werd pas in de catch gezet, dus nooit tijdens een
    // hangende vraag. Wat een hangende vraag vrijmaakt, is de grens uit V11.37.18 (25 s kopregels,
    // 30 s inhoud; hier 20x zo snel: 1,25 en 1,5 s). Daarna, na de rem, de volgende poging.
    for (const m of ['hang', 'hangdoof', 'tijd']) {
      const r = await rit({ bewaard: undefined, modi: [m, 'ok'], factor: 20, stappen: ['start', 'lees', [52.0000, 5.0000], { ms: 400 }, { foto: 'hangt', zonderBij: true },
        { ms: 1500 }, { foto: 'los', zonderBij: true }, 'rem0', { ms: 1300 }, { foto: 'na' }] });
      eis('KB18 ' + m + ': de vraag hangt, komt na de grens vrij (time-out, cacheBezig vrij), en na de rem komt de volgende poging met de kaart',
          !r.fout && (r.foto.hangt || {}).bezig === true && (r.foto.los || {}).bezig === false && (r.foto.los || {}).fout === 'time-out' && (r.foto.los || {}).vragen === 1
          && r.vragen.length === 2 && (r.foto.na || {}).geladen === true && r.maxTegelijk === 1,
          'bezig, dan vrij (time-out), dan 2 vragen en de kaart', r.fout || kort(r.foto.hangt).slice(0, 60) + ' | ' + kort(r.foto.los).slice(0, 90) + ' | ' + r.vragen.join(','));
    }

    // ═══ KB19 — geen extra download ══════════════════════════════
    // 504, dan binnen 30 s (hier 0,3 s) een gelukte poging: de timer vraagt daarna niets meer. Was: een derde
    // vraag, de hele kaart nog een keer.
    const r19 = await rit({ bewaard: undefined, modi: ['504', 'ok', 'ok'], stappen: ['start', 'lees', [52.0000, 5.0000], 'kaart', 'rem0', [52.0000, 5.0000], 'kaart',
      { foto: 'gelukt' }, { ms: 600 }, { foto: 'na' }] });
    eis('KB19 lukt de poging binnen 30 s na een mislukking, dan komt er geen derde vraag (de timer ziet dat er geen kaart meer nodig is)',
        !r19.fout && (r19.foto.gelukt || {}).geladen === true && r19.vragen.length === 2 && (r19.foto.na || {}).vragen === 2 && r19.maxTegelijk === 1,
        '2 vragen', r19.fout || r19.vragen.join(',') + ' | ' + kort(r19.foto.na).slice(0, 80));
  } finally {
    await herstel();
  }

  // ═══ KB11 — C7 (in deze pagina, alles teruggezet) ══════════════
  {
    const bew = { aiBezig, yoloWorker, workerKlaar, modelGeladen, onnxSession, pre: window.preprocessVoorYOLO, kans: window.runIsKansloos, vis: Object.getOwnPropertyDescriptor(document, 'visibilityState'),
                  rs: Object.getOwnPropertyDescriptor(video, 'readyState'), grens: aiVangnetGrens, reeks: aiVangnetReeks, n: aiVangnetN, zicht: aiZichtbaarT, log: localStorage.getItem('sl_opslaglog') };
    try {
      let gestopt = 0;
      const nepWorker = () => ({ postMessage() {}, terminate() { gestopt++; }, _startTijd: 0, _vangnetGezien: true });
      // a) de voorbewerking gooit terwijl de worker klaar staat
      yoloWorker = nepWorker(); workerKlaar = true; modelGeladen = true; onnxSession = onnxSession || {}; aiBezig = false;
      Object.defineProperty(video, 'readyState', { get: () => 4, configurable: true });
      window.runIsKansloos = () => false;
      window.preprocessVoorYOLO = () => { throw new Error('proef'); };
      await voerAIUit();
      eis('KB11a de voorbewerking gooit terwijl de worker klaar staat: aiBezig weer vrij (was: bleef hangen)', aiBezig === false, 'vrij', aiBezig);
      // b) geen antwoord: pas na 5 s vrij, alleen in beeld
      aiBezig = true; aiZichtbaarT = 0; aiVangnetReeks = 0; yoloWorker._startTijd = Date.now() - 4000;
      aiVangnet(); const na4 = aiBezig;
      Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
      yoloWorker._startTijd = Date.now() - 6000; aiVangnet(); const verborgen = aiBezig;
      Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
      aiZichtbaarT = Date.now() - 1000; aiVangnet(); const netTerug = aiBezig;
      aiZichtbaarT = 0; const ft = frameT; aiVangnet();
      eis('KB11b na 4 s nog niet, uit beeld niet, net terug in beeld niet; na 5 s in beeld vrij, met de grens op het huidige frame',
          na4 === true && verborgen === true && netTerug === true && aiBezig === false && aiVangnetGrens === ft && aiVangnetReeks === 1,
          'true, true, true, dan vrij', [na4, verborgen, netTerug, aiBezig, aiVangnetGrens === ft, aiVangnetReeks].join(', '));
      // c) een laat antwoord op dat bericht wordt genegeerd; een nieuw resultaat breekt de reeks
      const laat = aiVangnetBericht({ type: 'resultaat', frameId: ft }), laatFout = aiVangnetBericht({ type: 'fout', frameId: ft - 1 });
      const nieuw = aiVangnetBericht({ type: 'resultaat', frameId: ft + 1 }), klaar = aiVangnetBericht({ type: 'klaar' });
      eis('KB11c een laat antwoord (resultaat of fout) van vóór de grens wordt genegeerd; een nieuw resultaat niet, en dat breekt de reeks',
          laat === true && laatFout === true && nieuw === false && klaar === false && aiVangnetReeks === 0, 'true, true, false, false, reeks 0', [laat, laatFout, nieuw, klaar, aiVangnetReeks].join(', '));
      // d) drie keer achter elkaar: de worker gaat uit
      for (let i = 0; i < 3; i++) { aiBezig = true; if (yoloWorker) yoloWorker._startTijd = Date.now() - 6000; aiVangnet(); }
      eis('KB11d drie keer achter elkaar zonder resultaat: de worker gestopt (terminate), de route zonder worker neemt het over',
          yoloWorker === null && workerKlaar === false && gestopt === 1 && aiBezig === false, 'gestopt', String(yoloWorker) + ', ' + gestopt);
      // f) tijdens het laden (workerKlaar onwaar): nooit, ook niet na 60 s
      gestopt = 0; aiVangnetReeks = 0; aiZichtbaarT = 0;
      yoloWorker = { postMessage() {}, terminate() { gestopt++; }, _startTijd: Date.now() - 60000 }; workerKlaar = false; aiBezig = true;
      aiVangnet();
      eis('KB11f tijdens het laden van het model in de worker (workerKlaar onwaar) loopt de klok niet: na 60 s nog steeds bezig, geen stop',
          aiBezig === true && yoloWorker !== null && gestopt === 0, 'bezig, worker blijft', aiBezig + ', ' + gestopt);
      // g) de eerste run van deze worker: pas na 30 s; na het eerste resultaat 5 s
      workerKlaar = true;
      yoloWorker._startTijd = Date.now() - 6000; aiVangnet(); const eerste6 = aiBezig;
      yoloWorker._startTijd = Date.now() - 29000; aiVangnet(); const eerste29 = aiBezig;
      yoloWorker._startTijd = Date.now() - 31000; aiVangnet(); const eerste31 = aiBezig;
      const log31 = (JSON.parse(localStorage.getItem('sl_opslaglog') || '[]').filter(r => r.reden === 'ai_vangnet').pop() || {}).poortReden || '';
      eis('KB11g de eerste run van een worker mag tot 30 s duren: na 6 en 29 s niet vrij, na 31 s wel (logregel met eerste)',
          eerste6 === true && eerste29 === true && eerste31 === false && / eerste$/.test(log31) && /ms=3\d{4}/.test(log31), 'true, true, false', [eerste6, eerste29, eerste31, log31].join(', '));
      const gezienVoor = !!yoloWorker._vangnetGezien;
      aiVangnetBericht({ type: 'resultaat', frameId: frameT + 5 });
      aiBezig = true; yoloWorker._startTijd = Date.now() - 6000; aiVangnet();
      eis('KB11h na het eerste echte resultaat geldt voor die worker 5 s: na 6 s vrij',
          gezienVoor === false && yoloWorker._vangnetGezien === true && aiBezig === false, 'eerst niet gezien, dan 5 s', [gezienVoor, yoloWorker._vangnetGezien, aiBezig].join(', '));
      const lm = laadONNXModel.toString();
      const iMsg = lm.indexOf('const msg = e.data;'), iVang = lm.indexOf('if (aiVangnetBericht(msg)) return;'), iKlaar = lm.indexOf("if (msg.type === 'klaar')");
      eis('KB11e de worker-route kijkt het eerst naar het vangnet (meteen na const msg)', iMsg > 0 && iVang > iMsg && iKlaar > iVang && lm.slice(iMsg, iVang).split(NL).length === 2,
          'op volgorde', iMsg + ' < ' + iVang + ' < ' + iKlaar);
    } finally {
      aiBezig = bew.aiBezig; yoloWorker = bew.yoloWorker; workerKlaar = bew.workerKlaar; modelGeladen = bew.modelGeladen; onnxSession = bew.onnxSession;
      window.preprocessVoorYOLO = bew.pre; window.runIsKansloos = bew.kans;
      if (bew.vis) Object.defineProperty(document, 'visibilityState', bew.vis); else delete document.visibilityState;
      if (bew.rs) Object.defineProperty(video, 'readyState', bew.rs); else delete video.readyState;
      aiVangnetGrens = bew.grens; aiVangnetReeks = bew.reeks; aiVangnetN = bew.n; aiZichtbaarT = bew.zicht;
      if (bew.log === null) localStorage.removeItem('sl_opslaglog'); else localStorage.setItem('sl_opslaglog', bew.log);
    }
  }

  // ═══ KB12 — regressie ═══════════════════════════════════════
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.18(?!\d)/.test(l)).length;
  const zonderV113718 = (s) => String(s).replace(KB_INHOUD_NU, KB_INHOUD_OUD).replace(KB_TIMER_NU, KB_TIMER_OUD).split(NL).filter(l => !/V11\.37\.18(?!\d)/.test(l)).join(NL);
  // downloadOSM: ook twee commentaarregels zonder plaatsnaam (was eb30f65/4968); de oude tekst met die twee regels geeft eb30f65/4968 (bewijs in de commit)
  const V113717 = { downloadOSM: ['89781264', 4979, 6], updateDichtbij: ['a02224d6', 12487, 1], onGPS: ['37a4a787', 15517, 1], startApp: ['b07bc88b', 4810, 1],
                    voerAIUit: ['63720b32', 2522, 1], laadONNXModel: ['ffa1087c', 4538, 1] };
  const telAf = Object.entries(V113717).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('KB12a zes functies krijgen regels met merkteken V11.37.18: downloadOSM 6, de andere 1', telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V113717).filter(([n, [h, l]]) => { const s = zonderV113718(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('KB12b zonder die regels (en met de oude r.json- en timerregel) byte-gelijk aan V11.37.17 (downloadOSM: op twee commentaarregels zonder plaatsnaam na)', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  let code12 = [];
  try {
    const html = await (await fetch(new URL('index.html', location.href).href + '?t=' + Date.now())).text();
    code12 = html.split(NL).filter(l => /V11\.37\.18(?!\d)/.test(l) && !/^\s*\/\//.test(l)).map(l => l.trim());
  } catch (e) { code12 = ['fout: ' + e]; }
  eis('KB12c in de bron staat V11.37.18 buiten het commentaar alleen in 13 regels: de versie, de startlog-mijlpalen en de 11 regels in die zes functies',
      code12.length === 13 && code12.filter(l => /^const APP_VERSIE = 'V11\.37\.18(?!\d) — /.test(l)).length === 1 && code12.filter(l => /^const STARTLOG_ALTIJD /.test(l)).length === 1,
      '13 regels', code12.length + ': ' + code12.map(l => l.slice(0, 30)).join(' | '));
  const dl = zc(downloadOSM);
  const i = (s) => dl.indexOf(s);
  eis('KB12d in downloadOSM: de weergave na de pil laden, de reden vóór kaartRemNa, bewaren na de groene pil, de weergave na cacheBezig = false in finally',
      i("pOSMT.textContent='laden'") < i('kaartWeergaveBij()') && i('kaartFoutNoteer(') > i('startLogKaartFout(') && i('kaartFoutNoteer(') < i('kaartRemNa()')
      && i('kaartNaDownload(') > i("pOSMT.textContent='Kaart'") && i('kaartNaDownload(') < i('updateDichtbij(lat, lon)') && dl.lastIndexOf('kaartWeergaveBij()') > dl.lastIndexOf('cacheBezig = false'),
      'op volgorde', 'ok');
  const gp = zc(onGPS);
  eis('KB12e in onGPS: de bewaarde kaart vóór de eerste kaartvraag; in updateDichtbij C5 als eerste regel',
      gp.indexOf('kaartBewaardTik(lat, lon)') > 0 && gp.indexOf('kaartBewaardTik(lat, lon)') < gp.indexOf('if (!eersteGPSVerwerkt)')
      && zc(updateDichtbij).split(NL)[1].trim().startsWith('if (cacheCentrum && afstand(lat,lon,cacheCentrum.lat,cacheCentrum.lon)>OSM_REFRESH && !cacheBezig) downloadOSM(lat, lon);'),
      'op volgorde', 'ok');

  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testKaartbewaar = testKaartbewaar; window.kaartRitBinnen = kaartRitBinnen; }
