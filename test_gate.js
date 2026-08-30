// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_gate.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.69: de afstandsgate op kansloze YOLO-runs.
//
//  Een run wordt overgeslagen als hij boven GATE_MIN_AFSTAND_M zou draaien op
//  een crop waarvan het centrum een gok is (hint 4) of een OSM-peiling op
//  grote afstand (hint 3). Drie waarborgen houden de ingang open: een
//  volbeeld-run gaat er nooit doorheen, en een actieve tap of anchor heft de
//  gate op.
//
//  T5 is de belangrijkste: preprocessVoorYOLO ververst cropHintPositie uit
//  bboxOverride aan zijn eigen begin, dus op het moment dat de gate draait kan
//  cropHintPositie nog null zijn terwijl er wel een geldige tap ligt. Zonder de
//  spiegeling van die conditie gooit de gate precies de runs weg die de
//  gebruiker zojuist heeft aangewezen.
//
//  T9-T11 toetsen dat de gate het stale-mechanisme niet kan versnellen.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_gate.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testGate().regels);
// ═══════════════════════════════════════════════════════════════

function testGate() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const bewaardLog = localStorage.getItem('sl_detlog');

  // Schone uitgangstoestand: ver weg, geen tap, geen anchor, en de teller zo
  // gezet dat de VOLGENDE poging geen volbeeld-run is.
  function opzet(afst) {
    dichtstbijOSM = { id: 777001, lat: 52, lon: 5, afstand: afst, naam: 'TEST' };
    cropAlternatieTeller = 0;          // volgende poging = 1, dus geen volbeeld
    cropHintPositie = null; cropHintTeller = 0;
    bboxOverride = null; bboxOverrideCamX = null; bboxOverrideTijd = 0;
    bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
    snelheidKmh = 40;
  }

  // ══ T1-T3 — de afstandsdrempel ═══════════════════════════════
  opzet(200);
  eis('T1 200m, geen tap/anchor -> gate vuurt',
      runIsKansloos() === true, 'true', String(runIsKansloos()));
  opzet(130);
  eis('T2 exact 130m -> gate vuurt NIET (drempel is exclusief)',
      runIsKansloos() === false, 'false', String(runIsKansloos()));
  opzet(131);
  eis('T2b 131m -> gate vuurt wel',
      runIsKansloos() === true, 'true', String(runIsKansloos()));
  opzet(60);
  eis('T3 60m -> gate vuurt niet',
      runIsKansloos() === false, 'false', String(runIsKansloos()));
  dichtstbijOSM = null;
  eis('T3b geen node -> gate vuurt niet',
      runIsKansloos() === false, 'false', String(runIsKansloos()));

  // ══ T4 — waarborg 1: de volbeeld-run ═════════════════════════
  opzet(200);
  cropAlternatieTeller = 4;            // volgende poging = 5 -> volbeeld
  eis('T4 volbeeld-run wordt nooit gegate',
      runIsKansloos() === false, 'false', String(runIsKansloos()));

  // ══ T5-T6 — waarborg 2: tap ══════════════════════════════════
  opzet(200);
  cropHintPositie = { x: 100, y: 100 }; cropHintTeller = 5;
  eis('T5 lopende tap-hint heft de gate op',
      runIsKansloos() === false, 'false', String(runIsKansloos()));

  // DE VAL: bboxOverride actief, maar cropHintPositie nog niet ververst.
  // preprocessVoorYOLO zou hem zetten; de gate draait daarvóór.
  opzet(200);
  bboxOverride = { cx: 300, cy: 200 };
  bboxOverrideCamX = 1000; bboxOverrideCamY = 800;
  bboxOverrideTijd = Date.now() - 3000;   // ruim binnen TAP_FORCE_TIMEOUT
  eis('T5b VAL: verse tap zonder cropHintPositie heft de gate óók op',
      runIsKansloos() === false && cropHintPositie === null,
      'false, en cropHintPositie is inderdaad nog null',
      String(runIsKansloos()) + ', cropHintPositie=' + cropHintPositie);

  opzet(200);
  bboxOverride = { cx: 300, cy: 200 };
  bboxOverrideCamX = 1000; bboxOverrideCamY = 800;
  bboxOverrideTijd = Date.now() - (TAP_FORCE_TIMEOUT + 5000);  // verlopen
  eis('T6 verlopen tap heft de gate niet meer op',
      runIsKansloos() === true, 'true', String(runIsKansloos()));

  // ══ T7-T8 — waarborg 2c: anchor ══════════════════════════════
  opzet(200);
  bboxAnchorCx = 0.5; bboxAnchorCy = 0.3; bboxAnchorTijd = Date.now() - 5000;
  eis('T7 verse anchor heft de gate op',
      runIsKansloos() === false, 'false', String(runIsKansloos()));
  bboxAnchorTijd = Date.now() - (BBOX_ANCHOR_TIMEOUT + 2000);
  eis('T8 verlopen anchor heft de gate niet meer op',
      runIsKansloos() === true, 'true', String(runIsKansloos()));

  // ══ T9 — de logregel ═════════════════════════════════════════
  localStorage.removeItem('sl_detlog');
  detLogArr = null; detLogStop = false;
  opzet(214);
  gemiddeldeInferentieTijd = 1100;
  slaKanslozeRunOver();
  let rec = null;
  try { rec = (JSON.parse(localStorage.getItem('sl_detlog')) || []).slice(-1)[0] || null; } catch (e) {}
  eis('T9 gegate run schrijft een detlog-record',
      rec !== null && rec.afwijs === 'gegate' && rec.afst === 214,
      "afwijs 'gegate', afst 214",
      rec ? (rec.afwijs + ', afst=' + rec.afst) : 'GEEN RECORD');
  eis('T9b het record draagt geen verzonnen detectiegegevens',
      rec && rec.fam === null && rec.h === null && rec.hint === null && rec.ratio === null,
      'fam/h/hint/ratio allemaal null',
      rec ? ('fam=' + rec.fam + ' h=' + rec.h + ' hint=' + rec.hint + ' ratio=' + rec.ratio) : '-');

  // ══ T10 — de alternatie blijft lopen ═════════════════════════
  // Zonder de ophoging in slaKanslozeRunOver zou de teller boven de drempel
  // bevriezen en zou de volbeeld-run nooit meer aan de beurt komen.
  opzet(200);
  let gegate = 0, doorgelaten = 0;
  for (let poging = 0; poging < 20; poging++) {
    if (runIsKansloos()) { slaKanslozeRunOver(); gegate++; }
    else { cropAlternatieTeller++; doorgelaten++; }   // wat preprocess zou doen
  }
  eis('T10 1 op de 5 pogingen komt er nog doorheen als volbeeld-run',
      doorgelaten === 4 && gegate === 16,
      '4 doorgelaten, 16 gegate op 20 pogingen',
      doorgelaten + ' doorgelaten, ' + gegate + ' gegate');

  // ══ T11 — de gate raakt het stale-mechanisme niet ════════════
  opzet(200);
  geenTeller = 3;
  staleFaseSinds = Date.now() - 4000;
  const geenVoor = geenTeller, staleVoor = staleFaseSinds;
  slaKanslozeRunOver();
  eis('T11 gegate run hoogt geenTeller niet op en raakt staleFaseSinds niet',
      geenTeller === geenVoor && staleFaseSinds === staleVoor,
      'beide ongewijzigd',
      'geenTeller ' + geenVoor + '->' + geenTeller + ', stale ' + (staleFaseSinds === staleVoor ? 'gelijk' : 'GEWIJZIGD'));
  eis('T11b anchor-venster is even lang als de stale-bodem',
      BBOX_ANCHOR_TIMEOUT === STALE_FASE_BODEM_MS,
      'BBOX_ANCHOR_TIMEOUT === STALE_FASE_BODEM_MS',
      BBOX_ANCHOR_TIMEOUT + ' vs ' + STALE_FASE_BODEM_MS);

  // ── opruimen ──────────────────────────────────────────────────
  localStorage.removeItem('sl_detlog');
  detLogArr = null;
  if (bewaardLog !== null) localStorage.setItem('sl_detlog', bewaardLog);
  dichtstbijOSM = null; cropAlternatieTeller = 0;
  cropHintPositie = null; cropHintTeller = 0;
  bboxOverride = null; bboxOverrideCamX = null; bboxOverrideCamY = null; bboxOverrideTijd = 0;
  bboxAnchorCx = null; bboxAnchorCy = null; bboxAnchorTijd = 0;
  geenTeller = 0; staleFaseSinds = null;

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testGate = testGate;
