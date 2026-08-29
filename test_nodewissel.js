// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nodewissel.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Regressietest bij V11.17.65. Toetst de twee wisselpaden op achtergebleven
//  state van de VORIGE node:
//    pad 1  updateDichtbij, nieuw.id !== vorigOsmId        (r10771)
//    pad 2  corrigeerNodeAutomatisch                       (r10934)
//
//  Aanleiding: pad 2 wiste de pill al, pad 1 niet. Daardoor bleef het laatste
//  getal van het verlaten kruispunt bevroren staan onder de NIEUWE naam, tot
//  een volgende detectie updateUI aanriep. T3 legt vast dat de herstel-tak dat
//  juist NIET mag doen — die zet de fase bewust voort.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_nodewissel.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testNodewissel().regels);
// ═══════════════════════════════════════════════════════════════

function testNodewissel() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const pill = document.getElementById('cd-pill');
  const pillGetal = document.getElementById('cd-pill-getal');
  const pillLabel = document.getElementById('cd-pill-label');

  // twee nodes op ~100m van elkaar; A ligt op de testpositie, B verderop
  const A = { id: 900001, lat: 52.1500, lon: 5.4000, naam: 'TEST-A' };
  const B = { id: 900002, lat: 52.1510, lon: 5.4000, naam: 'TEST-B' };
  const bewaardCache = osmCache;
  const bewaardLog = localStorage.getItem('sl_opslaglog');

  function opzet(bijA) {
    osmCache = [A, B];
    cacheGeladen = true;
    handmatigLockActief = false; handmatigGeselecteerdNodeId = null; stilstandAutoLock = false;
    snelheidKmh = 0;
    huidigePos = { lat: bijA.lat, lon: bijA.lon };
    // headingBuffer is een const-array: vullen, niet vervangen
    huidigeRichting = 0;
    headingBuffer.length = 0; headingBuffer.push(0);
    nodeSessionData = {};
    laatsteNodeWisselTijd = 0; laatsteNodeCorrectieTijd = 0;
    fase = null; faseStart = null; cdStart = null;
  }
  // pill in de toestand van een lopende countdown op de OUDE node
  function pillAlsLopend(tekst) {
    pill.classList.add('actief');
    pill.classList.remove('cd-verborgen');
    pillGetal.textContent = tekst;
    pillLabel.textContent = 'groen over';
    activeCdModus = CD_VAAG; activeCdMin = 1; activeCdMax = 48; activeCdDoel = 19;
  }

  // ══ T1 — pad 1 laat geen bevroren pill achter ═════════════════
  opzet(A);
  dichtstbijOSM = { ...A, afstand: 0 }; vorigOsmId = A.id;
  pillAlsLopend('13s');
  // verplaats naar B; updateDichtbij kiest B en doorloopt het wisselpad
  huidigePos = { lat: B.lat, lon: B.lon };
  updateDichtbij(B.lat, B.lon);
  eis('T1 node daadwerkelijk gewisseld naar B',
      String(dichtstbijOSM.id) === String(B.id),
      'dichtstbijOSM = B', 'id=' + (dichtstbijOSM && dichtstbijOSM.id));
  eis('T1b pill niet meer actief na de wissel',
      pill.classList.contains('actief') === false,
      'geen .actief', pill.className || '(geen klassen)');
  eis('T1c pill-tekst niet meer die van de oude node',
      pillGetal.textContent === '—' && pillLabel.textContent === 'groen over',
      "'—' / 'groen over'", pillGetal.textContent + ' / ' + pillLabel.textContent);
  eis('T1d modus-velden van de oude node gewist',
      activeCdModus === null && activeCdMin === null && activeCdMax === null,
      'alle drie null',
      'modus=' + activeCdModus + ' min=' + activeCdMin + ' max=' + activeCdMax);

  // ══ T2 — de herstel-tak moet de pill juist AANHOUDEN ══════════
  // Terugkeer naar A binnen NODE_SESSION_MAX_MS met een bewaarde rode fase:
  // dan zet het herstelblok fase/cdStart terug en hoort de pill te blijven.
  opzet(A);
  dichtstbijOSM = { ...B, afstand: 0 }; vorigOsmId = B.id;
  nodeSessionData[String(A.id)] = {
    roodElapsed: 8000, cdElapsed: 8000, cdDoel: 40,
    cdModus: CD_GESCHAT, opgeslagenOp: Date.now()
  };
  pill.classList.remove('actief');
  pillGetal.textContent = '—';
  updateDichtbij(A.lat, A.lon);
  eis('T2 herstel-tak zet de pill weer aan',
      pill.classList.contains('actief') === true && fase === 'rood',
      '.actief én fase=rood',
      'actief=' + pill.classList.contains('actief') + ', fase=' + fase);
  eis('T2b herstel-tak overschrijft activeCdDoel niet met de nieuwe node',
      activeCdDoel === 40,
      '40 (uit de bewaarde sessie)', String(activeCdDoel));

  // ══ T3 — pad 2 legt de correctie vast in sl_opslaglog ═════════
  localStorage.removeItem('sl_opslaglog');
  opzet(A);
  dichtstbijOSM = { ...B, afstand: 111 };     // gekozen = B, ver weg
  vorigOsmId = B.id;
  puurDichtsteNodeCache = { ...A, afstand: 3 };
  stilstandSinds = Date.now() - 9000;          // 9s stilstand
  corrigeerNodeAutomatisch({ ...A, afstand: 3 }, 'test-correctie');
  let rec = null;
  try {
    const arr = JSON.parse(localStorage.getItem('sl_opslaglog')) || [];
    rec = arr.filter(r => r.reden === 'node_auto_correctie').slice(-1)[0] || null;
  } catch (e) {}
  eis('T3 correctie schrijft een node_auto_correctie-record',
      rec !== null, 'record aanwezig', rec ? 'aanwezig' : 'ONTBREEKT');
  eis('T3b record draagt de OUDE node en afstand',
      rec && String(rec.node) === String(B.id) && rec.afst === 111,
      'node=B, afst=111',
      rec ? ('node=' + rec.node + ', afst=' + rec.afst) : '-');
  eis('T3c record draagt de NIEUWE node en zijn afstand',
      rec && String(rec.nieuw) === String(A.id) && rec.closestAf === 3,
      'nieuw=A, closestAf=3',
      rec ? ('nieuw=' + rec.nieuw + ', closestAf=' + rec.closestAf) : '-');
  eis('T3d record draagt de stilstandsduur',
      rec && typeof rec.dur === 'number' && rec.dur >= 8 && rec.dur <= 11,
      'dur ~9s', rec ? ('dur=' + rec.dur) : '-');

  // ── opruimen ──────────────────────────────────────────────────
  osmCache = bewaardCache;
  localStorage.removeItem('sl_opslaglog');
  if (bewaardLog !== null) localStorage.setItem('sl_opslaglog', bewaardLog);
  dichtstbijOSM = null; vorigOsmId = null; puurDichtsteNodeCache = null;
  fase = null; faseStart = null; cdStart = null; stilstandSinds = 0;
  handmatigLockActief = false; handmatigGeselecteerdNodeId = null; stilstandAutoLock = false;
  nodeSessionData = {};
  pill.classList.remove('actief');
  pillGetal.textContent = '—'; pillLabel.textContent = 'groen over';

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testNodewissel = testNodewissel;
