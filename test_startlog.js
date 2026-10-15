// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_startlog.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.17: de startlog (sl_startlog), alleen meten. Per app-start
//  de tijd tot camera, video, GPS-watch, model, eerste GPS-tik, eerste kaart en
//  eerste licht, de mislukte kaartvragen met status, de GPS-fouten met code en
//  het uit beeld gaan; en een regel bij elk gat van meer dan 30 s zonder run
//  terwijl de pagina in beeld is.
//
//  SL1  een start met de echte startApp: c, p, w op volgorde; p wacht op video.play
//  SL2  GPS: de eerste tik (g, ga), daarna niet meer; de foutroute telt (gf, gc)
//       en zet de pil nog steeds oranje
//  SL3  de kaart: 504 en een afgebroken vraag geteld met status; de eerste kaart
//       (k1, kn) en het eerste licht (l), dat daarna niet meer verschuift
//  SL4  een gat: na 30 s zonder run een gatregel met de stand van model, worker,
//       camera, kaart en GPS; dicht bij de volgende run, met de duur
//  SL5  uit beeld: geen gat, wel geteld (vc, hm); een open gat sluit bij het weggaan
//  SL6  met en zonder de meting doet de start precies hetzelfde (pil, kaart, licht,
//       rem, kaartvragen, watch, opslaglog)
//  SL7  een ring van 40, klein en Latin-1; een vol quotum staakt alleen dit log
//  SL8  de meetdata-export heeft een eigen bak 'start'
//  SL9  de meting beslist niets: geen toewijzing aan de app-toestand, alleen
//       lees- en schrijffuncties van het log
//  SL10 regressie: de zeven geraakte functies zonder de V11.37.17-regels zijn
//       byte-gelijk aan V11.37.15; in de bron staat V11.37.17 buiten het
//       commentaar alleen in die regels
//
//  Alle plekken en nummers zijn bedacht: een basispunt (52.0000, 5.0000),
//  lichten met nummers 96100xx.
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_startlog.js';
//      document.head.appendChild(s);
//      s.onload = () => testStartlog().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

const STARTLOG_WATCH_NU = "    navigator.geolocation.watchPosition(onGPS, (e)=>{ pGPS.className='pill-dot o'; startLogGpsFout(e); }, { enableHighAccuracy:true, maximumAge:5000, timeout:12000 });   // V11.37.17: de fout ook tellen";
const STARTLOG_WATCH_OUD = "    navigator.geolocation.watchPosition(onGPS, ()=>{ pGPS.className='pill-dot o'; }, { enableHighAccuracy:true, maximumAge:5000, timeout:12000 });";

// ── Draait IN een iframe: een start met de echte startApp ─────
// opt: { zonderMeting, playMs }
async function startRitBinnen(opt) {
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const uit = { watch: 0, vragen: 0, fout: null };
  if (opt.zonderMeting) {
    for (const n of ['startLogNieuw', 'startLogMijl', 'startLogGps', 'startLogGpsFout', 'startLogKaartFout', 'startLogKijk']) window[n] = () => {};
  }
  try {
    for (const k of ['sl_startlog', 'sl_opslaglog']) localStorage.setItem(k, '[]');
    const nep = document.createElement('canvas'); nep.width = 32; nep.height = 32; nep.getContext('2d').fillRect(0, 0, 32, 32);
    const stroom = nep.captureStream(5);
    navigator.mediaDevices.getUserMedia = async () => stroom;
    video.play = () => new Promise(r => setTimeout(r, opt.playMs));
    let ok = null, fout = null;
    navigator.geolocation.watchPosition = (a, b) => { uit.watch++; ok = a; fout = b; return 1; };
    let modus = '504';
    window.fetch = async (url, o) => {
      if (String(url) !== OVERPASS_URL) throw new TypeError('geen netwerk in de proef');
      uit.vragen++;
      if (modus === '504') return new Response('druk', { status: 504 });
      if (modus === 'af') throw new DOMException('afgebroken', 'AbortError');
      return new Response(JSON.stringify({ elements: [
        { type: 'node', id: 9610001, lat: 52.0005, lon: 5.0000, tags: { highway: 'traffic_signals' } },
        { type: 'node', id: 9610002, lat: 52.0300, lon: 5.0000, tags: { highway: 'traffic_signals' } }] }), { status: 200 });
    };
    window.refreshStadIndienNodig = async () => {};
    window.toonToast = () => {};
    // de start
    await startApp();
    clearInterval(cameraWatchdogInterval); lusGeneratie++;            // de lus en de waakhond weer stil
    if (startTimer) clearInterval(startTimer);                        // de kijker van de startlog: hier met de hand
    // GPS: een fout, dan de eerste tik (die vraagt de kaart: 504)
    fout({ code: 3, message: 'Timeout expired' });
    uit.pilNaFout = pGPS.className;
    const pos = (lat, lon) => ({ coords: { latitude: lat, longitude: lon, accuracy: 14.4, heading: 0, speed: 5 }, timestamp: Date.now() });
    await ok(pos(52.0000, 5.0000)); await slaap(50);
    // nog een vraag die afbreekt (de rem eerst eraf, zoals na de wachttijd)
    modus = 'af'; kaartRem.nietVoor = 0; cacheBezig = false; await downloadOSM(52.0000, 5.0000);
    // dan een gelukte kaart met een licht vlak voor je
    modus = 'ok'; kaartRem.nietVoor = 0; cacheBezig = false; await downloadOSM(52.0000, 5.0000); await slaap(50);
    uit.lNaKaart = startMeet ? startMeet.l : null;                    // het eerste licht, vóór de volgende tik
    await ok(pos(52.0001, 5.0000)); await slaap(50);
    // een gat: 31 s geen run, dan weer een run
    startLaatsteRun = Date.now() - 31000; startLogKijk();
    uit.gatOpen = (JSON.parse(localStorage.getItem('sl_startlog')) || []).filter(r => r.k === 'g').map(r => ({ ...r }));
    minStatZeker(); startLogKijk();
    // uit beeld: een open gat sluit, geen nieuw gat zolang de pagina weg is
    startLaatsteRun = Date.now() - 31000; startLogKijk();
    Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    startLaatsteRun = Date.now() - 60000; startLogKijk();
    await slaap(30);
    Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    startLogKijk();
    uit.ring = JSON.parse(localStorage.getItem('sl_startlog')) || [];
    uit.toestand = { pil: pGPS.className, osm: pOSM.className + '|' + pOSMT.textContent, n: osmCache.length, geladen: cacheGeladen, licht: dichtstbijOSM ? dichtstbijOSM.id : null,
                     rem: kaartRem.n, opslag: (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).map(r => r.type + ':' + JSON.stringify(r.data || r.d || null)).join(';') };
  } catch (e) { uit.fout = String((e && e.stack) || e).slice(0, 300); }
  return uit;
}

async function testStartlog() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen: String(gekregen) });
    return gelukt;
  };
  const NL = '\n';
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const bewaardLs = localStorage.getItem(STARTLOG_SLEUTEL);
  const herstel = () => { if (bewaardLs === null) localStorage.removeItem(STARTLOG_SLEUTEL); else localStorage.setItem(STARTLOG_SLEUTEL, bewaardLs); meetRingGestopt.delete(STARTLOG_SLEUTEL); };

  // ═══ SL1-SL6 — met de echte startApp, in een iframe ════════════
  const bron = new URL('test_startlog.js', location.href).href;
  const pagina = location.pathname;
  const rit = async (opt) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:300px';
    f.src = pagina + '?start=' + Math.random();
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
      return await w.startRitBinnen(opt);
    } catch (e) {
      return { fout: String((e && e.stack) || e).slice(0, 300), ring: [], toestand: {} };
    } finally {
      f.remove();
      herstel();
    }
  };
  try {
    const met = await rit({ playMs: 400 });
    const zonder = await rit({ playMs: 400, zonderMeting: true });
    eis('SL0 de proef liep zonder fout (met en zonder meting)', !met.fout && !zonder.fout, 'geen fout', (met.fout || '') + ' | ' + (zonder.fout || ''));
    const s = (met.ring || []).find(r => r.k === 's') || {};
    eis('SL1a één startregel met de appversie', (met.ring || []).filter(r => r.k === 's').length === 1 && s.v === appVersieKort(), '1 regel, ' + appVersieKort(), JSON.stringify(s).slice(0, 200));
    eis('SL1b camera, video en watch op volgorde; de watch wacht op video.play (400 ms)', s.c >= 0 && s.p >= 350 && s.p >= s.c && s.w >= s.p,
        'c <= p, p >= 350, w >= p', 'c ' + s.c + ', p ' + s.p + ', w ' + s.w);
    eis('SL1c het model: m = 0 als het al klaar was, anders de tijd tot klaar met de laadduur (ml), of nog leeg', ('m' in s) ? (s.m === 0 || (s.m > 0 && s.ml > 0)) : true,
        'm 0, of m > 0 met ml, of afwezig', 'm ' + s.m + ', ml ' + s.ml);
    eis('SL2a de eerste GPS-tik: g en de nauwkeurigheid (14,4 -> 14)', s.g >= s.w && s.ga === 14, 'g >= w, ga 14', 'g ' + s.g + ', ga ' + s.ga);
    eis('SL2b de foutroute telt (gf 1, gc 3) en zet de pil nog steeds oranje', s.gf === 1 && s.gc === 3 && / o\b/.test(met.pilNaFout || ''),
        'gf 1, gc 3, pill-dot o', 'gf ' + s.gf + ', gc ' + s.gc + ', ' + met.pilNaFout);
    eis('SL3a mislukte kaartvragen met status: 504, dan afgebroken', s.of === 2 && JSON.stringify(s.os) === '[504,"tijd"]', 'of 2, os [504,"tijd"]', 'of ' + s.of + ', os ' + JSON.stringify(s.os));
    eis('SL3b de eerste kaart (k1) met het aantal lichten, en het eerste licht in bereik (l)', s.k1 >= s.g && s.kn === 2 && s.l >= s.k1,
        'k1 >= g, kn 2, l >= k1', 'k1 ' + s.k1 + ', kn ' + s.kn + ', l ' + s.l);
    eis('SL3c een mijlpaal blijft het eerste moment: een latere GPS-tik met een licht in bereik verandert l niet', met.lNaKaart != null && s.l === met.lNaKaart,
        'l gelijk aan l na de kaart', 'l ' + s.l + ', na de kaart ' + met.lNaKaart);
    const g0 = (met.gatOpen || [])[0] || {};
    eis('SL4a na 31 s zonder run een gatregel met de stand', (met.gatOpen || []).length === 1 && g0.d >= 31000 && g0.r !== undefined && 'tr' in g0 && 'rf' in g0 && 'gt' in g0,
        '1 gat, d >= 31000, met r, tr, rf, gt', JSON.stringify(g0).slice(0, 220));
    const gaten = (met.ring || []).filter(r => r.k === 'g');
    eis('SL4b het gat sluit bij de volgende run, met de duur (31 s)', gaten.length >= 1 && gaten[0].d >= 31000 && gaten[0].d < 33000 && !gaten[0].vb,
        'd ~31000, geen vb', JSON.stringify(gaten[0] || {}).slice(0, 120));
    eis('SL5a uit beeld: het open gat sluit (vb 1), en zolang de pagina weg is komt er geen nieuw gat', gaten.length === 2 && gaten[1].vb === 1,
        '2 gaten, het tweede vb 1', gaten.length + ' gaten, ' + JSON.stringify(gaten[1] || {}).slice(0, 80));
    eis('SL5b uit en in beeld geteld (vc 2) met de tijd uit beeld (hm > 0); terug in beeld geen gat', s.vc === 2 && s.hm > 0 && gaten.length === 2,
        'vc 2, hm > 0', 'vc ' + s.vc + ', hm ' + s.hm);
    const zt = zonder.toestand || {}, mt = met.toestand || {};
    const velden = ['pil', 'osm', 'n', 'geladen', 'licht', 'rem', 'opslag'];
    const afw = velden.filter(k => JSON.stringify(zt[k]) !== JSON.stringify(mt[k]));
    eis('SL6a met en zonder de meting dezelfde start: pil, kaart, licht, rem en opslaglog', afw.length === 0 && mt.n === 2 && mt.licht === 9610001,
        'gelijk, 2 lichten, licht 9610001', afw.length ? afw.map(k => k + ': ' + JSON.stringify(mt[k]).slice(0, 40) + ' / ' + JSON.stringify(zt[k]).slice(0, 40)).join('; ') : 'gelijk, licht ' + mt.licht);
    eis('SL6b met en zonder: evenveel kaartvragen en één watch', met.vragen === zonder.vragen && met.watch === 1 && zonder.watch === 1,
        'gelijk, 1 watch', met.vragen + '/' + zonder.vragen + ' vragen, ' + met.watch + '/' + zonder.watch + ' watch');
    eis('SL6c zonder meting komt er niets in sl_startlog', (zonder.ring || []).length === 0, '0 regels', (zonder.ring || []).length);

    // ═══ SL7 — de ring ═════════════════════════════════════════
    localStorage.setItem(STARTLOG_SLEUTEL, '[]'); meetRingGestopt.delete(STARTLOG_SLEUTEL);
    const volle = (i) => ({ k: 's', t: 1790000000000 + i * 600000, v: 'V11.37.17', c: 812, p: 930, w: 951, m: 0, ml: 2104, g: 4210 + i, ga: 12,
      k1: 16020, kn: 212, l: 30400, of: 2, os: [504, 504], gf: 1, gc: 3, vc: 2, hm: 3012 });
    for (let i = 0; i < 45; i++) startLogSchrijf(volle(i));
    startLogSchrijf({ ...volle(44), g: 9999 });
    const ringS = JSON.parse(localStorage.getItem(STARTLOG_SLEUTEL)) || [], ruwS = localStorage.getItem(STARTLOG_SLEUTEL) || '';
    eis('SL7a een ring van hoogstens 40 regels; een regel met dezelfde soort en t wordt bijgewerkt, niet verdubbeld',
        ringS.length === 40 && ringS[39].g === 9999 && ringS[39].m === 0 && ringS.filter(r => r.t === volle(44).t).length === 1, '40, laatste bijgewerkt, m 0 bewaard', ringS.length + ', g ' + (ringS[39] || {}).g + ', m ' + (ringS[39] || {}).m);
    for (let i = 0; i < 20; i++) startLogSchrijf({ k: 'g', t: 1790000000000 + i * 600000 + 5000, d: 45012, mg: true, wo: true, wk: true, ai: true, am: 44980, r: 4, pa: false,
      tr: 'live', mu: false, rf: 18, kl: false, kb: null, gt: 1020 });
    const ruwM = localStorage.getItem(STARTLOG_SLEUTEL) || '';
    eis('SL7b klein en Latin-1: een volle ring met alleen volle startregels < 8 K tekens, met de helft gatregels < 6,5 K (gemeten)',
        ruwS.length < 8000 && ruwM.length < 6500 && !/[^ -ÿ]/.test(ruwS + ruwM), '< 8 K en < 6,5 K, Latin-1',
        (ruwS.length / 40).toFixed(1) + ' tekens per startregel: ' + (ruwS.length / 1024).toFixed(1) + ' K; gemengd ' + (ruwM.length / 1024).toFixed(1) + ' K');
    const bewSchrijf = opslagSchrijf;
    opslagSchrijf = (k, v) => (k === STARTLOG_SLEUTEL ? false : bewSchrijf(k, v));
    startLogSchrijf({ k: 's', t: 1, v: 'x' });
    opslagSchrijf = bewSchrijf;
    eis('SL7c een vol quotum staakt alleen dit log (meetRingGestopt), en wist zijn eigen sleutel',
        meetRingGestopt.has(STARTLOG_SLEUTEL) && localStorage.getItem(STARTLOG_SLEUTEL) === null && !meetRingGestopt.has(MINUUTLOG_SLEUTEL), 'gestopt, sleutel weg',
        meetRingGestopt.has(STARTLOG_SLEUTEL) + ' / ' + localStorage.getItem(STARTLOG_SLEUTEL));
    meetRingGestopt.delete(STARTLOG_SLEUTEL);

    // ═══ SL8 — de export ═══════════════════════════════════════
    localStorage.setItem(STARTLOG_SLEUTEL, JSON.stringify([{ k: 's', t: 1, proef: 'start' }]));
    const blobs = [];
    const bew = { url: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click, alert: window.alert, cs: Object.getOwnPropertyDescriptor(navigator, 'canShare') };
    try {
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:proef'; };
      HTMLAnchorElement.prototype.click = function () {};
      window.alert = () => {};
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
      exporteerMeetdata();
      for (let i = 0; i < 40 && blobs.length < 1; i++) await slaap(50);
    } finally {
      URL.createObjectURL = bew.url; HTMLAnchorElement.prototype.click = bew.klik; window.alert = bew.alert;
      if (bew.cs) Object.defineProperty(navigator, 'canShare', bew.cs); else delete navigator.canShare;
    }
    let meet = null;
    for (const b of blobs) { const j = JSON.parse(await b.text()); if (!Array.isArray(j.sleutels)) meet = j; }
    const r8 = meet && meet.start && meet.start[STARTLOG_SLEUTEL];
    eis('SL8 de meetdata-export heeft een bak start met sl_startlog erin', Array.isArray(r8) && r8[0] && r8[0].proef === 'start',
        'start / sl_startlog', meet ? Object.keys(meet.start || {}).join(',') || 'leeg' : 'geen export');

    // ═══ SL9 — de meting beslist niets ═════════════════════════
    const nieuw = [startLogSchrijf, startLogNieuw, startLogMijl, startLogGps, startLogGpsFout, startLogKaartFout, startLogKijk];
    const code = nieuw.map(zc).join(NL);
    const toegewezen = (code.match(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*(\+\+|--|[-+*/]?=)(?!=)/g) || []).map(x => x.replace(/\s*(\+\+|--|[-+*/]?=)$/, ''));
    const eigen = ['startMeet', 'startGat', 'startGatU', 'startLaatsteRun', 'startLaatsteGps', 'startVerborgenT', 'startTimer', 'schoon', 'arr', 'i', 'nu', 'v', 'k', 'acc', 's', 'tr', 'kl'];
    const vreemd1 = [...new Set(toegewezen)].filter(x => !eigen.includes(x));
    eis('SL9a de meting wijst alleen haar eigen variabelen toe (geen app-toestand)', vreemd1.length === 0, 'alleen eigen', vreemd1.join(', ') || 'alleen eigen');
    const roept = (code.match(/\b[a-zA-Z_$][\w$]*\s*\(/g) || []).map(x => x.replace(/\s*\($/, '')).filter(x => !['if', 'for', 'function', 'catch', 'return', 'while'].includes(x));
    const mag = ['startLogSchrijf', 'startLogNieuw', 'startLogMijl', 'startLogGps', 'startLogGpsFout', 'startLogKaartFout', 'startLogKijk', 'has', 'keys', 'isArray', 'slice', 'opslagLees', 'opslagSchrijf', 'Error', 'add', 'removeItem', 'now', 'appVersieKort',
                 'setInterval', 'assign', 'isFinite', 'round', 'push', 'runIsKansloos'];
    const vreemd2 = [...new Set(roept)].filter(x => !mag.includes(x));
    eis('SL9b de meting roept alleen het log, de opslag en runIsKansloos (alleen lezen) aan', vreemd2.length === 0, 'alleen die', vreemd2.join(', ') || 'alleen die');
    eis('SL9c runIsKansloos wijst niets toe', !/(?<![=!<>])=(?!=)|\+\+|--/.test(zc(runIsKansloos).replace(/const afst = /, '')), 'alleen lezen', 'ok');
  } finally {
    herstel();
  }

  // ═══ SL10 — regressie ═══════════════════════════════════════
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.17(?!\d)/.test(l)).length;
  const zonderV113717 = (s) => String(s).replace(STARTLOG_WATCH_NU, STARTLOG_WATCH_OUD).split(NL).filter(l => !/V11\.37\.17(?!\d)/.test(l)).join(NL);
  const V113715 = { startApp: ['7f067c8a', 4583, 5], onGPS: ['b8aa01fe', 15469, 1], downloadOSM: ['e89feb02', 4655, 3], updateDichtbij: ['67e9f3ec', 12423, 1],
                    laadONNXModel: ['68b764e9', 4402, 1], minStatZeker: ['17831b15', 292, 1], exporteerMeetdata: ['c7a3b47a', 9327, 2] };
  const telAf = Object.entries(V113715).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('SL10a zeven functies krijgen regels met merkteken V11.37.17: startApp 5, downloadOSM 3, exporteerMeetdata 2, de andere 1',
      telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V113715).filter(([n, [h, l]]) => { const s = zonderV113717(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('SL10b zonder die regels (en met de oude foutroute van de watch) byte-gelijk aan V11.37.15', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  let code10 = [];
  try {
    const html = await (await fetch(new URL('index.html', location.href).href + '?t=' + Date.now())).text();
    code10 = html.split(NL).filter(l => /V11\.37\.17(?!\d)/.test(l) && !/^\s*\/\//.test(l)).map(l => l.trim());
  } catch (e) { code10 = ['fout: ' + e]; }
  eis('SL10c in de bron staat V11.37.17 buiten het commentaar alleen in 15 regels: de versie en de 14 regels in die zeven functies',
      code10.length === 15 && code10.filter(l => /^const APP_VERSIE = 'V11\.37\.17(?!\d) — /.test(l)).length === 1, '15 regels', code10.length + ': ' + code10.map(l => l.slice(0, 30)).join(' | '));
  const sa = zc(startApp);
  const iW = sa.indexOf("startLogMijl('w')"), iWatch = sa.indexOf('navigator.geolocation.watchPosition'), iP = sa.indexOf("startLogMijl('p')"), iPlay = sa.indexOf('await video.play()');
  eis('SL10d in startApp: de start eerst, p direct na video.play, w direct vóór de watch (de volgorde van de app blijft)',
      sa.indexOf('startLogNieuw()') < sa.indexOf('await startOpslagBoot()') && iP > iPlay && iW < iWatch && iW > iP && iWatch - iW < 80, 'op volgorde', 'p ' + iP + ', w ' + iW + ', watch ' + iWatch);
  const dl = zc(downloadOSM);
  eis('SL10e in downloadOSM: de fout geteld vóór kaartRemNa (die kaartRem.fout leegmaakt)', dl.indexOf('startLogKaartFout(') > 0 && dl.indexOf('startLogKaartFout(') < dl.indexOf('kaartRemNa()'),
      'vóór', 'positie ' + dl.indexOf('startLogKaartFout(') + ' / ' + dl.indexOf('kaartRemNa()'));

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') { window.testStartlog = testStartlog; window.startRitBinnen = startRitBinnen; }
