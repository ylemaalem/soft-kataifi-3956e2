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

  // ══ T4 — V11.17.87: het herstel laat nu een spoor na ══════
  // Zelfde opzet als T2, maar met een lege log en een gebruikerspositie die
  // NIET samenvalt met A. Dat laatste is de kern van de toets: de oude node
  // staat op 222 m in dichtstbijOSM, en logOpslagMis zou daar zonder expliciete
  // `afst` op terugvallen — dichtstbijOSM wijst op dat punt namelijk nog naar
  // de VERLATEN node (hij wordt pas een regel later bijgewerkt).
  localStorage.removeItem('sl_opslaglog');
  opzet(A);
  const posBijA = { lat: A.lat + 20 / 111132, lon: A.lon };   // ~20 m ten noorden van A
  huidigePos = posBijA;
  dichtstbijOSM = { ...B, afstand: 222 };     // de verlaten node, ver weg
  vorigOsmId = B.id;
  nodeSessionData[String(A.id)] = {
    roodElapsed: 8000, cdElapsed: 8000, cdDoel: 40,
    cdModus: CD_GESCHAT, opgeslagenOp: Date.now() - 12000   // 12 s oud
  };
  updateDichtbij(posBijA.lat, posBijA.lon);
  let herstelRec = null;
  try {
    const arr = JSON.parse(localStorage.getItem('sl_opslaglog')) || [];
    herstelRec = arr.filter(r => r.reden === 'sessie_hersteld').slice(-1)[0] || null;
  } catch (e) {}
  eis('T4 een sessieherstel schrijft een sessie_hersteld-record',
      herstelRec !== null && String(dichtstbijOSM.id) === String(A.id),
      'record aanwezig, node hersteld naar A',
      herstelRec ? 'aanwezig' : 'ONTBREEKT');
  eis('T4b het record draagt de TERUGGEKEERDE node, niet de verlaten node',
      herstelRec && String(herstelRec.node) === String(A.id),
      'node=A (' + A.id + ')',
      herstelRec ? ('node=' + herstelRec.node) : '-');
  eis('T4c het record draagt de ouderdom van de sessie in seconden',
      herstelRec && typeof herstelRec.dur === 'number'
      && herstelRec.dur >= 11 && herstelRec.dur <= 13,
      'dur ~12s', herstelRec ? ('dur=' + herstelRec.dur) : '-');
  // Dit is waarom `afst` expliciet meegaat: zonder die parameter had hier 222
  // gestaan — de afstand tot het stoplicht dat je juist VERLAAT.
  eis('T4d de afstand hoort bij de teruggekeerde node, niet de 222 m van de verlaten node',
      herstelRec && typeof herstelRec.afst === 'number'
      && herstelRec.afst >= 17 && herstelRec.afst <= 23,
      '~20 m (niet 222)', herstelRec ? ('afst=' + herstelRec.afst) : '-');
  eis('T4e en de snelheid komt gratis mee uit logOpslagMis',
      herstelRec && herstelRec.kmh === 0, 'kmh=0',
      herstelRec ? ('kmh=' + herstelRec.kmh) : '-');

  // ══ T5 — een GEWONE wissel logt deze regel niet ══════════
  localStorage.removeItem('sl_opslaglog');
  opzet(A);
  dichtstbijOSM = { ...A, afstand: 0 }; vorigOsmId = A.id;
  huidigePos = { lat: B.lat, lon: B.lon };
  updateDichtbij(B.lat, B.lon);              // geen bewaarde sessie voor B
  let geenHerstel = [];
  try {
    const arr = JSON.parse(localStorage.getItem('sl_opslaglog')) || [];
    geenHerstel = arr.filter(r => r.reden === 'sessie_hersteld');
  } catch (e) {}
  eis('T5 een wissel zonder bewaarde sessie logt geen sessie_hersteld',
      geenHerstel.length === 0 && String(dichtstbijOSM.id) === String(B.id),
      '0 records, wel gewisseld naar B',
      geenHerstel.length + ' records, node=' + (dichtstbijOSM && dichtstbijOSM.id));

  // ══ T6 — regressiewacht: alleen de logregel is erbij ══════
  // De release voegt één aanroep toe en verandert verder niets. tickCd en het
  // bevestigpad mogen hem niet kennen, en het herstelblok moet nog exact
  // dezelfde velden zetten als voorheen.
  const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
  const udBron = zc(updateDichtbij);
  eis('T6 sessie_hersteld wordt precies één keer gelogd, en alleen in updateDichtbij',
      (udBron.match(/sessie_hersteld/g) || []).length === 1
      && !/sessie_hersteld/.test(zc(tickCd))
      && !/sessie_hersteld/.test(zc(bevestigCountdown)),
      '1x in updateDichtbij, 0x elders',
      (udBron.match(/sessie_hersteld/g) || []).length + 'x in updateDichtbij');
  eis('T6b het herstelblok zet nog steeds fase, pill en countdown terug',
      /fase = 'rood'/.test(udBron) && /faseBevestigd = 'rood'/.test(udBron)
      && /cdStart = performance\.now\(\) - sessie\.cdElapsed/.test(udBron)
      && /cdPill\.classList\.add\('actief'\)/.test(udBron),
      'alle vier de toewijzingen ongewijzigd', 'ongewijzigd');
  eis('T6c het bevestigpad is niet aangeraakt: de KLOPTE-poort staat er nog',
      /categorie === 'klopte' && klopteIsNoOp\(\)/.test(zc(bevestigCountdown))
      && /aiKleur === 'groen'/.test(zc(bevestigCountdown)),
      'KLOPTE-poort uit V11.17.82 intact', 'intact');
  eis('T6d tickCd toont de bevestigknoppen nog op dezelfde twee voorwaarden',
      /cdPillActief && fase === 'rood'/.test(zc(tickCd))
      && /fase === 'groen' && cdBereikteNul/.test(zc(tickCd)),
      'beide takken ongewijzigd', 'ongewijzigd');

  // ── opruimen ──────────────────────────────────────────────────
  osmCache = bewaardCache;
  localStorage.removeItem('sl_opslaglog');
  if (bewaardLog !== null) localStorage.setItem('sl_opslaglog', bewaardLog);
  dichtstbijOSM = null; vorigOsmId = null; puurDichtsteNodeCache = null;
  fase = null; faseStart = null; cdStart = null; stilstandSinds = 0;
  // V11.17.87: de herstel-tak (T2 en T4) zet countdown- en bevestigstaat terug
  // op de waarden uit de bewaarde sessie. Die bleven hier staan en reisden mee
  // naar de volgende suite. Nu volledig opgeruimd, zodat deze suite geen enkel
  // spoor achterlaat — dezelfde afspraak als in test_richting_ui.
  activeCdDoel = 0; activeCdModus = null; activeCdMin = null; activeCdMax = null;
  groenStart = null; countdownNulTijd = null; cdBereikteNul = false;
  bevestigActief = false; bevInertStaat = '';
  bevestigWrap.classList.remove('actief');
  huidigePos = null; snelheidKmh = 0;
  handmatigLockActief = false; handmatigGeselecteerdNodeId = null; stilstandAutoLock = false;
  nodeSessionData = {};
  pill.classList.remove('actief');
  pillGetal.textContent = '—'; pillLabel.textContent = 'groen over';

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testNodewissel = testNodewissel;
