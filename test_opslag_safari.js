// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_opslag_safari.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.36.1: de app meet de opslag zoals Safari hem telt (A2 uit de
//  opslag-STAP 0 van 30 september), de duur van een vuring van de rem, en een
//  bewaking op tekens boven U+00FF in de opgeslagen sleutels.
//
//  De telregel van Safari (WebKit-bron, en gemeten op een iPhone met iOS 18.7):
//  naam plus waarde, één byte per teken zolang de string Latin-1 is, anders
//  twee voor de HELE string, grens 5.242.880 bytes per herkomst.
//
//  SA1  berekenSafariOpslag telt naam + waarde, Latin-1 als 1 en breed als 2,
//       meldt de brede sleutels (n16, kb16, top16) en schrijft zelf nooit breed
//  SA2  logOpruiming: kbSafari, safari{..}, ms/msMax/msSom/msN en msMeet in
//       sl_opruimstat; de opruim-regel krijgt kbSafari, ms en n16, geen namen
//  SA3  checkLocalStorageRuimte en de knop geven de duur door
//  SA4  de opslag-export draagt kbSafari en safari naast totaalKb
//  SA5  ALLEEN METEN: zonder de V11.36.1-regels zijn de drie geraakte
//       functies byte-gelijk aan V11.36.0; de telling, de grens en de passen
//       zijn onaangeroerd; de meting schrijft niets
//  LA1  APP_VERSIE heeft een streepje (—), maar wordt alleen kort opgeslagen
//  LA2  elke plek in de bron waar APP_VERSIE staat, is een van de vier bekende
//  LA3  de schrijvers van de grote sleutels hebben geen breed teken in hun
//       code (commentaar en schermtekst niet meegerekend)
//  LA4  wat die schrijvers met gewone invoer wegschrijven, is Latin-1
//  LA5  het echte risico, zichtbaar gemaakt: één straatnaam met een ’ maakt het
//       hele opslaglog breed, en de meting noemt het
//
//  DE TEST WERKT OP ALLE SLEUTELS. Net als test_opruimrem bewaart hij eerst
//  de hele opslag, haalt die sleutel voor sleutel weg (removeItem, niet
//  clear(): de omwikkeling van V11.24.0 ziet clear() niet), en zet na afloop
//  alles exact terug.
// ═══════════════════════════════════════════════════════════════

async function testOpslagSafari() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const breed = /[^\u0000-\u00ff]/;
  const alleSleutels = () => { const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); return ks; };
  const leeg = () => { for (const k of alleSleutels()) localStorage.removeItem(k); };
  const zet = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const telSchrijvingen = (fn) => {
    const orig = Storage.prototype.setItem; let n = 0;
    Storage.prototype.setItem = function (k, v) { n++; return orig.call(this, k, v); };
    try { fn(); } finally { Storage.prototype.setItem = orig; }
    return n;
  };
  const nulTel = () => ({ p1: 0, p2: 0, p3: 0, p4: 0, p5geschikt: 0, p5emmers: 0, p5weg: 0, p5echt: 0, p6: 0, p7weg: 0, p7kapot: 0, emmers: [] });
  const opruimRegels = () => (lees('sl_opslaglog') || []).filter(r => r && r.reden === 'opruim');

  const bewaard = alleSleutels().map(k => [k, localStorage.getItem(k)]);
  const bew = { sessie: opruimGelogdDezeSessie, dicht: dichtstbijOSM, osm: osmCache,
                tikArr: tikLogArr, tikStop: tikLogStop, tikVorige: tikLogVorige,
                confirm: window.confirm, alert: window.alert };

  try {
    dichtstbijOSM = null;

    // ═══ SA1 — de telregel ══════════════════════════════════
    leeg();
    zet('sl_a', 'x'.repeat(10240));               // ASCII: 1 byte per teken
    zet('sl_b', '\u00e9'.repeat(5120));           // é is Latin-1: ook 1 byte
    zet('sl_c', '\u2014' + 'y'.repeat(2047));     // één streepje: de hele waarde telt 2
    zet('sl_' + 'n'.repeat(1021), 'v');           // een naam van 1.024 tekens: namen tellen mee, 1 byte per teken
    const s1 = berekenSafariOpslag() || {};
    // 10240 + 5120 + 2048*2 + 1 + namen 4+4+4+1024 = 20.493 bytes
    eis('SA1a naam + waarde, Latin-1 één byte, een brede waarde twee: 20.493 bytes = 20,0 KB, namen 1,0 KB',
        s1.kb === 20.0 && s1.namenKb === 1.0 && s1.pct === 0.4, '20 / 1 / 0.4', `${s1.kb} / ${s1.namenKb} / ${s1.pct}`);
    eis('SA1b de brede sleutel is gemeld: n16 1, kb16 2,0, top16 met de code van het streepje',
        s1.n16 === 1 && s1.kb16 === 2.0 && Array.isArray(s1.top16) && s1.top16.length === 1 && s1.top16[0] === 'sl_c:2:u2014',
        '1 / 2 / sl_c:2:u2014', `${s1.n16} / ${s1.kb16} / ${JSON.stringify(s1.top16)}`);
    zet('sl_b', '\u0142'.repeat(5120));           // ł staat NIET in Latin-1
    const s1c = berekenSafariOpslag() || {};
    eis('SA1c een ł (U+0142) in plaats van é: die sleutel telt dubbel, +5 KB',
        s1c.kb === 25.0 && s1c.n16 === 2 && s1c.top16[0] === 'sl_b:5:u0142',
        '25 / 2 / sl_b eerst', `${s1c.kb} / ${s1c.n16} / ${JSON.stringify(s1c.top16)}`);
    zet('sl_x\u2192', 'z');
    const s1d = berekenSafariOpslag() || {};
    eis('SA1d een brede sleutelnaam telt ook dubbel, en komt ontsnapt in top16',
        s1d.n16 === 3 && s1d.top16.includes('sl_x\\u2192:0:u2192') && !breed.test(JSON.stringify(s1d)),
        'sl_x\\u2192:0:u2192, uitvoer Latin-1', JSON.stringify(s1d.top16));
    leeg();
    const s1e = berekenSafariOpslag() || {};
    eis('SA1e een lege opslag: 0 KB, geen top16', s1e.kb === 0 && s1e.n16 === 0 && !('top16' in s1e),
        '0 / 0 / geen top16', JSON.stringify(s1e));
    eis('SA1f berekenSafariOpslag scant via de opslaglaag, niet over localStorage',
        !/localStorage\.(length|key\()/.test(zc(berekenSafariOpslag)) && /opslagSleutels\(''\)/.test(zc(berekenSafariOpslag)),
        'opslagSleutels', 'ok');
    eis('SA1g de grens is 5.242.880 bytes', SAFARI_QUOTUM_BYTES === 5242880, '5242880', String(SAFARI_QUOTUM_BYTES));

    // ═══ SA2 — logOpruiming ═════════════════════════════════
    leeg();
    zet('sl_v4_996801_dag', [{ duur: 40, tijd: 1, richting: 90, obs: 40, gewicht: 1, bron: 's1' }]);
    const ref2 = (berekenSafariOpslag() || {}).kb;
    opruimGelogdDezeSessie = false;
    logOpruiming('auto', 4200, nulTel(), 12.4);
    const st1 = lees('sl_opruimstat') || {};
    eis('SA2a de duur: ms 12, msMax 12, msSom 12, msN 1, en msMeet is een getal',
        st1.ms === 12 && st1.msMax === 12 && st1.msSom === 12 && st1.msN === 1 && typeof st1.msMeet === 'number',
        '12 / 12 / 12 / 1 / getal', `${st1.ms} / ${st1.msMax} / ${st1.msSom} / ${st1.msN} / ${typeof st1.msMeet}`);
    eis('SA2b kbSafari is de meting van vóór de teller, met namenKb, pct, n16, kb16 en ms',
        st1.kbSafari === ref2 && st1.safari && 'namenKb' in st1.safari && 'pct' in st1.safari
          && st1.safari.n16 === 0 && st1.safari.kb16 === 0 && typeof st1.safari.ms === 'number' && !('top16' in st1.safari),
        ref2 + ', velden compleet', `${st1.kbSafari}, ${JSON.stringify(st1.safari)}`);
    logOpruiming('auto', 4200, nulTel(), 30);
    logOpruiming('auto', 4200, nulTel());
    const st2 = lees('sl_opruimstat') || {};
    eis('SA2c ... telt op: ms 30, msMax 30, msSom 42, msN 2; een vuring zonder duur telt niet mee',
        st2.ms === 30 && st2.msMax === 30 && st2.msSom === 42 && st2.msN === 2 && st2.vuringen === 3,
        '30 / 30 / 42 / 2 / 3 vuringen', `${st2.ms} / ${st2.msMax} / ${st2.msSom} / ${st2.msN} / ${st2.vuringen}`);
    const or2 = opruimRegels();
    const k2 = (or2[0] || {}).opruim || {};
    eis('SA2d de opruim-regel: kbSafari en ms erbij, geen namen, geen safari-blok, n16 alleen als het er is',
        or2.length === 1 && k2.kbSafari === ref2 && k2.ms === 12 && !('safari' in k2) && !('top16' in k2) && !('n16' in k2),
        '1 regel, kbSafari ' + ref2 + ', ms 12', JSON.stringify(k2));
    leeg();
    zet('sl_breed\u2014', '\u2014' + 'q'.repeat(99));
    opruimGelogdDezeSessie = false;
    logOpruiming('auto', 4200, nulTel(), 5);
    const st3 = localStorage.getItem('sl_opruimstat') || '';
    const k3 = ((opruimRegels()[0] || {}).opruim) || {};
    eis('SA2e met een brede sleutel: top16 noemt hem ontsnapt, en de teller zelf blijft Latin-1',
        /sl_breed\\\\u2014:/.test(st3) && !breed.test(st3), 'ontsnapt, Latin-1', st3.slice(st3.indexOf('top16'), st3.indexOf('top16') + 60));
    eis('SA2f ... en de opruim-regel krijgt alleen het aantal (n16 1), geen naam, en blijft Latin-1',
        k3.n16 === 1 && !breed.test(localStorage.getItem('sl_opslaglog') || '') && !/sl_breed/.test(localStorage.getItem('sl_opslaglog') || ''),
        'n16 1, geen naam', JSON.stringify(k3));

    // ═══ SA3 — de duur komt door ════════════════════════════
    leeg();
    localStorage.setItem('or_ballast', 'x'.repeat(2100000));   // 4,01 MiB in UTF-16: boven de grens van de rem
    opruimGelogdDezeSessie = false;
    checkLocalStorageRuimte();
    localStorage.removeItem('or_ballast');
    const st4 = lees('sl_opruimstat') || {};
    eis('SA3a boven de grens: checkLocalStorageRuimte geeft een duur door (msN 1, ms een getal >= 0)',
        st4.msN === 1 && typeof st4.ms === 'number' && st4.ms >= 0 && st4.auto === 1,
        'msN 1', `msN ${st4.msN}, ms ${st4.ms}`);
    eis('SA3b ... en kbSafari telt de ballast als 1 byte per teken (~2.051 KB, niet ~4.102)',
        st4.kbSafari > 2040 && st4.kbSafari < 2070, '~2051', String(st4.kbSafari));
    leeg();
    checkLocalStorageRuimte();
    eis('SA3c onder de grens schrijft de rem niets, ook geen duur', localStorage.getItem('sl_opruimstat') === null,
        'geen teller', localStorage.getItem('sl_opruimstat') === null ? 'geen' : 'WEL');
    window.confirm = () => true; window.alert = () => {};
    ruimOpslagNuOp();
    await slaap(60);
    window.confirm = bew.confirm; window.alert = bew.alert;
    const st5 = lees('sl_opruimstat') || {};
    eis('SA3d de knop geeft ook een duur door', st5.knop === 1 && st5.msN === 1 && typeof st5.ms === 'number',
        'knop 1, msN 1', `knop ${st5.knop}, msN ${st5.msN}`);

    // ═══ SA4 — de opslag-export ═════════════════════════════
    leeg();
    zet('sl_v4_996802_dag', [{ duur: 41, tijd: 2, richting: 90, obs: 41, gewicht: 1, bron: 's1' }]);
    const ref4 = (berekenSafariOpslag() || {}).kb;
    const blobs = [];
    const eb = { url: URL.createObjectURL, klik: HTMLAnchorElement.prototype.click,
                 cs: Object.getOwnPropertyDescriptor(navigator, 'canShare') };
    try {
      URL.createObjectURL = (b) => { blobs.push(b); return 'blob:proef'; };
      HTMLAnchorElement.prototype.click = function () {};
      window.alert = () => {};
      Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
      exporteerMeetdata();
      for (let i = 0; i < 40 && blobs.length < 2; i++) await slaap(50);
    } finally {
      URL.createObjectURL = eb.url; HTMLAnchorElement.prototype.click = eb.klik; window.alert = bew.alert;
      if (eb.cs) Object.defineProperty(navigator, 'canShare', eb.cs); else delete navigator.canShare;
    }
    let opj = null;
    for (const b of blobs) { const j = JSON.parse(await b.text()); if (Array.isArray(j.sleutels)) opj = j; }
    eis('SA4a de opslag-export draagt kbSafari en safari, gelijk aan de meting ervoor',
        !!opj && opj.kbSafari === ref4 && opj.safari && opj.safari.kb === ref4 && typeof opj.safari.namenKb === 'number',
        String(ref4), opj ? `${opj.kbSafari} / ${JSON.stringify(opj.safari)}` : 'geen export');
    eis('SA4b ... en het oude formaat staat er nog: versie V11.17.15, totaalKb en de sleutellijst',
        !!opj && opj.versie === 'V11.17.15' && typeof opj.totaalKb === 'number' && opj.sleutels.length > 0 && Array.isArray(opj.spiegelStarts),
        'ongewijzigd', opj ? `${opj.versie} / ${opj.totaalKb} / ${opj.sleutels.length}` : 'geen export');

    // ═══ SA5 — alleen meten ═════════════════════════════════
    // De drie geraakte functies, met de V11.36.1-regels teruggedraaid. Twee
    // regels zijn niet toegevoegd maar aangepast (een extra argument); die
    // worden hier terug in hun V11.36.0-vorm gezet.
    const terug = (s) => s.split('\n').map(l => {
      if (!/V11\.36\.1/.test(l)) return l;
      if (/, performance\.now\(\) - t\w+\);/.test(l)) return l.replace(/, performance\.now\(\) - t\w+\);\s*\/\/.*$/, ');');
      if (/function logOpruiming\(bron, kbVoor, tel, ms\)/.test(l)) return 'function logOpruiming(bron, kbVoor, tel) {';
      return null;
    }).filter(l => l !== null).join('\n');
    const V11360 = { checkLocalStorageRuimte: ['8de1f9d8', 564], logOpruiming: ['27e9e21b', 1415], ruimOpslagNuOp: ['8bb75695', 3142] };
    const afw = Object.entries(V11360).filter(([n, [h, l]]) => { const s = terug(String(eval(n))); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
    eis('SA5a zonder de V11.36.1-regels zijn checkLocalStorageRuimte, logOpruiming en ruimOpslagNuOp byte-gelijk aan V11.36.0',
        afw.length === 0, 'geen afwijking', afw.join(', ') || 'geen');
    const ONGEMOEID = { berekenLocalStorageKB: ['8fd8ab6c', 193], voerOpruimPassenUit: ['b5221ec9', 5515], opslagOverzicht: ['5ff742b9', 1762] };
    const afw2 = Object.entries(ONGEMOEID).filter(([n, [h, l]]) => fnv(String(eval(n))) !== h || String(eval(n)).length !== l).map(x => x[0]);
    eis('SA5b de UTF-16-telling, de passen en het overzicht zijn onaangeroerd', afw2.length === 0, 'geen afwijking', afw2.join(', ') || 'geen');
    const zonder = String(exporteerMeetdata).split('\n').filter(l => !/V11\.34\.[2-9]|V11\.36\.1/.test(l)).join('\n');
    eis('SA5c exporteerMeetdata zonder meetregels is nog steeds V11.34.1', fnv(zonder) === 'ef1e19bb' && zonder.length === 7864,
        'ef1e19bb / 7864', fnv(zonder) + ' / ' + zonder.length);
    zet('sl_v4_996803_dag', [{ duur: 42, tijd: 3 }]);
    const n5 = telSchrijvingen(() => berekenSafariOpslag());
    eis('SA5d de meting zelf schrijft niets', n5 === 0, '0 schrijvingen', String(n5));

    // ═══ LA1-LA2 — APP_VERSIE ═══════════════════════════════
    eis('LA1 APP_VERSIE heeft een teken boven U+00FF (het streepje), de korte vorm niet',
        breed.test(APP_VERSIE) && !breed.test(appVersieKort()) && !breed.test(String(APP_VERSIE).split(' ')[0]),
        'lang breed, kort Latin-1', `${breed.test(APP_VERSIE)} / ${breed.test(appVersieKort())}`);
    let bron = null;
    try { bron = await (await fetch('/index.html?' + Date.now())).text(); } catch (e) {}
    const gebruik = (bron || '').split('\n').filter(l => /APP_VERSIE/.test(l.replace(/\/\/.*$/, '').replace(/<!--.*$/, '')));
    const toegestaan = [/^const APP_VERSIE = '/, /String\(APP_VERSIE\)\.split\(' '\)\[0\]/, /\.textContent = APP_VERSIE;/];
    const vreemd = gebruik.filter(l => !toegestaan.some(r => r.test(l.trim())));
    eis('LA2 APP_VERSIE staat in de bron alleen als definitie, in de korte vorm of op het scherm (4 plekken)',
        !!bron && gebruik.length === 4 && vreemd.length === 0, '4, geen vreemde', bron ? `${gebruik.length}, vreemd: ${vreemd.map(l => l.trim()).join(' | ') || 'geen'}` : 'bron niet gelezen');

    // ═══ LA3 — geen breed teken in de code van de schrijvers ═
    // Commentaar telt niet mee, en regels die alleen iets op het scherm of in de
    // console zetten ook niet: die komen nooit in de opslag.
    const SCHRIJVERS = ['logOpslagMis', 'detLogSchrijf', 'zichtLogSample', 'richtingLog', 'logKlasseVerdelingIndienBeschikbaar',
      'herzieningLogSluit', 'schaduwLogSluit', 'vglStatBewaar', 'spiegelLogStart', 'tikLogNoteer', 'tikLogRun', 'tikLogLos',
      'tikLogTik', 'tikLogWaak', 'tikLogSprong', 'tikTelAf', 'tikTelRun', 'camcapNoteer', 'modelLogNoteer', 'minStatSluit',
      'meetRingSchrijf', 'logOpruiming', 'berekenSafariOpslag', 'latin1Veilig', 'slaPassiefMeting', 'passiefLog', 'slaKlokMoment',
      'slaS2Aanwezigheid', 'slaOpIntern', 'slaOpV5', 'slaRichtingOp', 'naderLeegMerk', 'naderLeegMeet', 'schrijfV5DirectBijGroen',
      'bevestigCountdown', 'meetBevestigMoment', 'appVersieKort'];
    const scherm = /console\.|toonToast\(|toonLeerToast\(|alert\(|confirm\(|textContent|innerHTML/;
    const ontbreekt = SCHRIJVERS.filter(n => typeof window[n] !== 'function');
    const metBreed = SCHRIJVERS.filter(n => typeof window[n] === 'function').filter(n => {
      const code = String(window[n]).replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n')
        .filter(l => !scherm.test(l)).map(l => l.replace(/\/\/.*$/, '')).join('\n');
      return breed.test(code);
    });
    eis('LA3 de ' + SCHRIJVERS.length + ' schrijvers van de grote sleutels hebben geen breed teken in hun code',
        ontbreekt.length === 0 && metBreed.length === 0, 'geen', `ontbreekt: ${ontbreekt.join(',') || '-'}; breed: ${metBreed.join(',') || '-'}`);

    // ═══ LA4 — wat ze met gewone invoer schrijven ═══════════
    leeg();
    tikLogArr = null; tikLogStop = false; tikLogVorige = { tak: null, t: 0 };
    logOpslagMis('te_kort', { node: '996804', dur: 3 });
    logOpslagMis('nadering_leeg', { node: '996804', dur: 1, resetAf: 12, resetNa: 0.4 });
    tikLogNoteer('tik', { pad: 'A', cx: 100, cy: 200, n: 2, snap: 1 });
    tikLogNoteer('run', { tak: 'leeg', skip: 0 });
    tikLogNoteer('los', { reden: 'nieuw', duur: 800 });
    spiegelLogStart('herstel', Date.now() - 5, { voor: { inOpslag: 3, inSpiegel: 3, mistInSpiegel: 0, anders: 0, teveelInSpiegel: 0,
      lijsten: { mist: [], anders: [], teveel: [] } } });
    opruimGelogdDezeSessie = false;
    logOpruiming('auto', 4200, nulTel(), 7);
    const geschreven = alleSleutels();
    const breedGeschreven = geschreven.filter(k => breed.test(k) || breed.test(localStorage.getItem(k) || ''));
    eis('LA4 opslaglog, tiklog, spiegellog en opruimteller: met gewone invoer is alles Latin-1',
        ['sl_opslaglog', TIKLOG_SLEUTEL, SPIEGELLOG_SLEUTEL, 'sl_opruimstat'].every(k => geschreven.includes(k)) && breedGeschreven.length === 0,
        'vier sleutels, geen breed', `${geschreven.join(',')} / breed: ${breedGeschreven.join(',') || 'geen'}`);

    // ═══ LA5 — het echte risico: een straatnaam ═════════════
    leeg();
    logOpslagMis('te_kort', { node: '996805', dur: 3 });
    const smal = (berekenSafariOpslag() || {});
    osmCache = [{ id: 996806, lat: 52.1, lon: 5.1, naam: '\u2019s-Gravenweg, Amsterdam' }];
    logOpslagMis('te_kort', { node: '996806', dur: 3 });
    const log5 = localStorage.getItem('sl_opslaglog') || '';
    const s5 = berekenSafariOpslag() || {};
    eis('LA5a één straatnaam met een ’ (U+2019) maakt het hele opslaglog breed, en de meting noemt het',
        breed.test(log5) && s5.n16 === 1 && Array.isArray(s5.top16) && /^sl_opslaglog:[0-9.]+:u2019$/.test(s5.top16[0]),
        'n16 1, sl_opslaglog:..:u2019', `${s5.n16} / ${JSON.stringify(s5.top16)}`);
    eis('LA5b ... en het log telt dan dubbel: kb16 is de hele lengte van het log',
        s5.kb16 === Math.round(log5.length / 1024 * 10) / 10 && smal.n16 === 0,
        String(Math.round(log5.length / 1024 * 10) / 10), `${s5.kb16} (vooraf n16 ${smal.n16})`);

  } finally {
    window.confirm = bew.confirm; window.alert = bew.alert;
    try { localStorage.removeItem('or_ballast'); } catch (e) {}
    leeg();
    for (const [k, v] of bewaard) localStorage.setItem(k, v);
    opruimGelogdDezeSessie = bew.sessie; dichtstbijOSM = bew.dicht; osmCache = bew.osm;
    tikLogArr = bew.tikArr; tikLogStop = bew.tikStop; tikLogVorige = bew.tikVorige;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testOpslagSafari = testOpslagSafari;
