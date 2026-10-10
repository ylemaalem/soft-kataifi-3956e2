// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_logs_bewaren.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.6: de vier losse logknoppen (conf, zicht, herziening, det)
//  wissen hun log niet meer na het delen.
//
//  LB1  in de vier exportfuncties staat geen removeItem van hun eigen sleutel meer
//  LB2  per knop en per route (delen lukt, delen mislukt en dan downloaden, alleen
//       downloaden): na de export staat de log er nog, op schijf én in het geheugen
//  LB3  de ringen zelf zijn ongewijzigd (50 / 300 / 200 / 500)
//  LB4  regressie: de lichtkeuze is byte-gelijk aan V11.37.5
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_logs_bewaren.js';
//      document.head.appendChild(s);
//      s.onload = () => testLogsBewaren().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testLogsBewaren() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
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

  // ═══ LB1 — geen removeItem meer ════════════════════════════
  const knoppen = [['exporteerConfLog', 'sl_conflog'], ['exporteerZichtLog', 'sl_zichtlog'], ['exporteerHerzieningLog', 'sl_herzieninglog'], ['exporteerDetLog', 'sl_detlog']];
  const nogWis = knoppen.filter(([f, k]) => zc(window[f]).includes("removeItem('" + k + "')")).map(x => x[0]);
  eis('LB1 in de vier exportfuncties staat geen removeItem van hun eigen sleutel meer', nogWis.length === 0, 'geen', nogWis.join(', ') || 'geen');

  // ═══ LB2 — per knop en per route ════════════════════════════
  const bewaar = { alert: window.alert, maak: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click,
                   share: Object.getOwnPropertyDescriptor(navigator, 'share'), canShare: Object.getOwnPropertyDescriptor(navigator, 'canShare'),
                   zicht: zichtLogArr, det: detLogArr, conf: klasseVerdelingLog.slice() };
  const routes = {
    'delen lukt': () => { Object.defineProperty(navigator, 'share', { value: () => Promise.resolve(), configurable: true });
                          Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true }); },
    'delen mislukt, dan downloaden': () => { Object.defineProperty(navigator, 'share', { value: () => Promise.reject(new Error('mislukt')), configurable: true });
                          Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true }); },
    'alleen downloaden': () => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
                          Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }); }
  };
  const uit = [];
  try {
    window.alert = () => {};
    URL.createObjectURL = () => 'blob:test';
    HTMLAnchorElement.prototype.click = function () {};
    for (const [route, zet] of Object.entries(routes)) {
      zet();
      const rij = (i) => ({ t: 1790000000000 + i, s: 'test', route });
      // vullen, op schijf en in het geheugen
      klasseVerdelingLog.length = 0; for (let i = 0; i < 3; i++) klasseVerdelingLog.push(rij(i));
      localStorage.setItem('sl_conflog', JSON.stringify([rij(0), rij(1), rij(2)]));
      zichtLogArr = [rij(0), rij(1)]; localStorage.setItem('sl_zichtlog', JSON.stringify(zichtLogArr));
      localStorage.setItem('sl_herzieninglog', JSON.stringify([rij(0), rij(1), rij(2), rij(3)]));
      detLogArr = [rij(0), rij(1), rij(2), rij(3), rij(4)]; localStorage.setItem('sl_detlog', JSON.stringify(detLogArr));
      const voor = {};
      for (const [, k] of knoppen) voor[k] = localStorage.getItem(k);
      for (const [f] of knoppen) { try { window[f](); } catch (e) { uit.push(f + ' fout: ' + e.message); } }
      await slaap(250);   // de exports draaien in een setTimeout, delen in een promise
      const weg = knoppen.filter(([, k]) => localStorage.getItem(k) !== voor[k]).map(x => x[1]);
      const geheugen = (Array.isArray(zichtLogArr) && zichtLogArr.length === 2) && (Array.isArray(detLogArr) && detLogArr.length === 5) && klasseVerdelingLog.length === 3;
      uit.push(`${route}: ${weg.length ? 'WEG ' + weg.join(',') : 'alles bewaard'}${geheugen ? '' : ', geheugen leeg'}`);
      eis('LB2 ' + route + ': na de export van conf, zicht, herziening en det staat elke log er nog, op schijf en in het geheugen',
          weg.length === 0 && geheugen, 'alles bewaard', uit[uit.length - 1]);
    }
  } finally {
    window.alert = bewaar.alert; URL.createObjectURL = bewaar.maak; HTMLAnchorElement.prototype.click = bewaar.klik;
    if (bewaar.share) Object.defineProperty(navigator, 'share', bewaar.share); else delete navigator.share;
    if (bewaar.canShare) Object.defineProperty(navigator, 'canShare', bewaar.canShare); else delete navigator.canShare;
    zichtLogArr = bewaar.zicht; detLogArr = bewaar.det;
    klasseVerdelingLog.length = 0; for (const r of bewaar.conf) klasseVerdelingLog.push(r);
    for (const id of ['export-conflog-btn', 'export-zichtlog-btn', 'export-detlog-btn', 'export-herzlog-btn']) {
      const b = document.getElementById(id); if (b) b.disabled = false;
    }
    herstel();
  }

  // ═══ LB3 — de ringen ════════════════════════════════════════
  eis('LB3 de ringen zelf zijn ongewijzigd: conflog 50, zichtlog 300, herzieningslog 200, detlog 500',
      MAX_ZICHTLOG === 300 && MAX_HERZIENINGLOG === 200 && MAX_DETLOG === 500 && /opslag\.length > 50/.test(zc(logKlasseVerdelingIndienBeschikbaar) + zc(window.logKlasseVerdeling || '')),
      '50/300/200/500', [MAX_ZICHTLOG, MAX_HERZIENINGLOG, MAX_DETLOG].join('/'));

  // ═══ LB4 — regressie ════════════════════════════════════════
  const V11375 = { vindDichtbij: ['55d1f775', 3320], updateDichtbij: ['42aee748', 12051], onGPS: ['d99821b8', 15000], regelKies: ['d8d1f767', 1993],
    achterTik: ['e9e105a3', 1583], checkHandLockVerval: ['2df4f7ed', 5513], checkHandLockPassage: ['7f001264', 1768], checkNodeCorrectieStilstand: ['8c801fd8', 4751],
    corrigeerNodeAutomatisch: ['afe7b427', 4118], checkTikSlotSnel: ['d3a8edbe', 2071], vindDichtbijScore: ['bc9b7937', 2105] };
  const zonderV113713 = (s) => String(s).split('\n').filter(l => !/V11\.37\.13/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const terugV11378 = (s) => zonderV113711(s).replace("      if (wisselStaat.min === null || af < wisselStaat.min) { wisselStaat.min = af; wisselStaat.minT = Date.now(); }   // V11.37.8: en wanneer (tMin)", "      if (wisselStaat.min === null || af < wisselStaat.min) wisselStaat.min = af;").replace("  if (!dichtstbijOSM) { logOpslagMis('bevestig_geen_licht', { element: categorie }); return; }   // V11.37.8: niet meer stil", "  if (!dichtstbijOSM) return;").split('\n').filter(l => !/V11\.37\.8/.test(l)).join('\n');   // V11.37.8: het fietsfilter en de bevroren knoppen (test_fietslicht); hier terug
  const anders = Object.entries(V11375).filter(([n, [h, l]]) => { const s = terugV11378(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('LB4 de lichtkeuze is byte-gelijk aan V11.37.5 (elf functies, onGPS en NB14 inbegrepen)', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testLogsBewaren = testLogsBewaren;
