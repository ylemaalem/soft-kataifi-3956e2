// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_richtingtik.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.3: een richtingtik gaat altijd naar het licht waar de box nu
//  op staat (het getoonde licht, dichtstbijOSM).
//
//  Het veldgeval van 4 oktober 19:27: de knoppen verschenen voor licht A
//  (4065739949); Younes koos daarna uit de lijst licht B (9967542165); zijn
//  richtingtik ging toch naar A.
//
//  RT1  het veldgeval: de tik gaat naar B; A blijft onaangeroerd; het
//       richtingslot staat op B; de logregel zegt B, met nieuw = A
//  RT2  knoppen en getoond licht gelijk: alles zoals vroeger, geen 'nieuw'
//  RT3  geen licht getoond: de oude bron (de knoppen) geldt nog
//  RT4  alle drie de ingangen (vraag, toevoeg, rij) gaan naar het getoonde licht
//  RT5  de koppeling aan een uitgestelde V5-schrijving werkt voor het getoonde licht
//  RT6  regressie: alleen tikRichting is veranderd; de lichtkeuze (vijftien
//       functies, onGPS inbegrepen) is byte-gelijk aan V11.37.2
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_richtingtik.js';
//      document.head.appendChild(s);
//      s.onload = () => testRichtingtik().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testRichtingtik() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));

  const A = { id: 4065739949, lat: 52.1716, lon: 5.4120, naam: 'A' }, B = { id: 9967542165, lat: 52.1719, lon: 5.4127, naam: 'B' };
  const namen = ['dichtstbijOSM', 'osmCache', 'richtingKnoppenNodeId', 'huidigBevestigdOsmNodeId', 'richtingLockNodeId', 'richtingLockKeuze',
    'richtingLockBron', 'richtingGedruktVoorNode', 'richtingTikTijd', 'richtingTikElement', 'v9PreSelectieAfrij', 'v9AanrijHeading',
    'v9AanrijSnelheidHeading', 'v9DelayedWriteActief', 'v9KandidaatNode', 'preZet', 'preWis', 'bevestigActief', 'fase'];
  const bewaard = {};
  for (const n of namen) bewaard[n] = eval(n);
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
  const lees = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const opzet = (knoppen, getoond) => {
    osmCache = [A, B];
    dichtstbijOSM = getoond ? { ...getoond, afstand: 5 } : null;
    richtingKnoppenNodeId = knoppen ? String(knoppen.id) : null; huidigBevestigdOsmNodeId = null;
    richtingLockNodeId = null; richtingLockKeuze = null; richtingLockBron = null; richtingGedruktVoorNode = null;
    v9PreSelectieAfrij = null; v9AanrijHeading = null; v9AanrijSnelheidHeading = null; v9DelayedWriteActief = false; v9KandidaatNode = null;
    bevestigActief = false; fase = null;
    for (const n of [A, B]) localStorage.removeItem('sl_richting_' + n.id);
    localStorage.setItem('sl_opslaglog', '[]');
  };
  const regel = () => (lees('sl_opslaglog') || []).filter(r => r.reden === 'richting_tik').pop() || {};

  try {
    // ═══ RT1 — het veldgeval ═══════════════════════════════════
    opzet(A, B);
    tikRichting('rechts', 'toevoeg');
    const rA = lees('sl_richting_' + A.id), rB = lees('sl_richting_' + B.id), r1 = regel();
    eis('RT1a de richtingtik gaat naar het getoonde licht B, niet naar A van de knoppen',
        rB && rB.tikrichting === 'rechts' && rA === null, 'B rechts, A leeg', JSON.stringify({ A: rA && rA.tikrichting, B: rB && rB.tikrichting }));
    eis('RT1b het richtingslot staat op B', richtingLockNodeId === String(B.id) && richtingLockKeuze === 'rechts' && richtingLockBron === 'tik',
        'B / rechts / tik', `${richtingLockNodeId} / ${richtingLockKeuze} / ${richtingLockBron}`);
    eis('RT1c de logregel zegt B, met nieuw = A (waar de tik vroeger heen ging)',
        r1.node === String(B.id) && r1.nieuw === String(A.id) && r1.element === 'toevoeg', 'B, nieuw A, toevoeg', JSON.stringify({ node: r1.node, nieuw: r1.nieuw, el: r1.element }));

    // ═══ RT2 — knoppen en getoond licht gelijk ═════════════════
    opzet(B, B); tikRichting('links', 'vraag'); const r2 = regel();
    eis('RT2 knoppen en getoond licht gelijk: tik op B, geen veld nieuw',
        (lees('sl_richting_' + B.id) || {}).tikrichting === 'links' && r2.node === String(B.id) && r2.nieuw === null,
        'B, nieuw leeg', JSON.stringify({ node: r2.node, nieuw: r2.nieuw }));

    // ═══ RT3 — geen licht getoond ══════════════════════════════
    opzet(A, null); tikRichting('rechtdoor', 'vraag'); const r3 = regel();
    eis('RT3 zonder getoond licht geldt de oude bron nog: de tik gaat naar A van de knoppen',
        (lees('sl_richting_' + A.id) || {}).tikrichting === 'rechtdoor' && richtingLockNodeId === String(A.id) && r3.node === String(A.id),
        'A', JSON.stringify({ node: r3.node, lock: richtingLockNodeId }));

    // ═══ RT4 — de drie ingangen ════════════════════════════════
    const r4 = [];
    for (const el of ['vraag', 'toevoeg', 'rij']) { opzet(A, B); tikRichting('links', el); r4.push(regel().node === String(B.id) && lees('sl_richting_' + A.id) === null); }
    eis('RT4 vraag, toevoeg en rij gaan alle drie naar het getoonde licht', r4.every(Boolean), 'ja ja ja', r4.join(' '));

    // ═══ RT5 — de koppeling aan de uitgestelde V5-schrijving ═══
    opzet(A, B); v9DelayedWriteActief = true; v9KandidaatNode = String(B.id); v9AanrijHeading = 0;
    tikRichting('links', 'vraag');
    eis('RT5 een tik tijdens de uitgestelde V5-schrijving van B koppelt aan B (vroeger niet, want hij ging naar A)',
        v9PreSelectieAfrij !== null && preZet && preZet.node === String(B.id), 'pre-selectie op B',
        JSON.stringify({ pre: v9PreSelectieAfrij, node: preZet && preZet.node }));
  } finally {
    for (const n of namen) { try { eval(n + ' = bewaard[n]'); } catch (e) {} }
    herstel();
  }

  // ═══ RT6 — regressie ════════════════════════════════════════
  // Gemeten op V11.37.2 (f4f6018); deze release raakt ze niet aan.
  const V11372 = { vindDichtbij: ['2db98dab', 2954], vindDichtbijScore: ['bc9b7937', 2105], updateDichtbij: ['e82d3c0', 11914],
    checkHandLockVerval: ['2df4f7ed', 5513], checkNodeCorrectieStilstand: ['8c801fd8', 4751], corrigeerNodeAutomatisch: ['afe7b427', 4118],
    checkNaderingsCorrectie: ['6aeb87b3', 3595], verzamelNaderingsBewijs: ['3d6ad85f', 3526], checkHandLockPassage: ['7f001264', 1768],
    checkTikSlotSnel: ['d3a8edbe', 2071], regelTik: ['9c1b361b', 3087], regelKies: ['fd57785d', 1485], onGPS: ['e1da9bf9', 14694],
    vergrendelNodeHandmatig: ['9a007b96', 2295], selecteerNodeHandmatig: ['5275f4dd', 2379] };
  const anders = Object.entries(V11372).filter(([n, [h, l]]) => { const s = String(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('RT6a de lichtkeuze is onaangeroerd: vijftien functies (onGPS en NB14 inbegrepen) byte-gelijk aan V11.37.2',
      anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const t = String(tikRichting);
  eis('RT6b in tikRichting zijn alleen het doel en het logveld veranderd: drie regels met merkteken V11.37.3',
      (t.match(/V11\.37\.3/g) || []).length === 3 && t.includes('const nodeId = (dichtstbijOSM ? String(dichtstbijOSM.id) : null) || oudDoel;'),
      '3 regels', String((t.match(/V11\.37\.3/g) || []).length));

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRichtingtik = testRichtingtik;
