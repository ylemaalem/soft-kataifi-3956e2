// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_indeling.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.68: de bevestigindeling GOED / BIJNA / FOUT, gemeten op het
//  GROEN-moment en niet op het tikmoment.
//
//    groen valt 0 tot  2s na nul  -> GOED
//    groen valt 2 tot 10s na nul  -> BIJNA, mét correctie
//    groen valt meer dan 10s      -> FOUT
//    getikt vóór nul              -> BIJNA, ZONDER correctie
//
//  De kern van T5 en T6: dezelfde situatie, maar later getikt, moet dezelfde
//  uitkomst geven. Dat is precies wat de oude indeling niet kon — die mat
//  vanaf het tikmoment en droeg dus de reactietijd van de gebruiker mee.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_indeling.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testIndeling().regels);
// ═══════════════════════════════════════════════════════════════

function testIndeling() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const P = () => performance.now();

  // groen is `overSec` na het nulpunt gevallen, en `sindsSec` geleden.
  // Het TIKmoment is dus nu; de overschrijding hangt daar niet van af.
  function groenNaNul(overSec, sindsSec) {
    fase = 'groen';
    cdBereikteNul = true;
    countdownNulTijd = Date.now() - (overSec + sindsSec) * 1000;
    groenStart = P() - sindsSec * 1000;
    cdStart = null; activeCdDoel = 0;
  }
  function roodVoorNul(doelSec, verSec) {
    fase = 'rood';
    cdBereikteNul = false; countdownNulTijd = null; groenStart = null;
    activeCdDoel = doelSec; cdStart = P() - verSec * 1000;
  }

  // ══ T1-T4 — de vier banden ═══════════════════════════════════
  const banden = [
    ['T1 groen 0,5s na nul  -> GOED',  0.5, 'goed'],
    ['T2 groen 5s na nul    -> BIJNA', 5,   'bijna'],
    ['T3 groen 25s na nul   -> FOUT',  25,  'fout'],
    ['T4 groen 2,0s na nul  -> GOED (bovengrens is inclusief)', 2, 'goed']
  ];
  for (const [naam, over, verwacht] of banden) {
    groenNaNul(over, 1);
    const ind = bevestigIndeling();
    eis(naam, ind === verwacht, verwacht, String(ind));
  }
  groenNaNul(10, 1);
  eis('T4b groen 10,0s na nul -> BIJNA (bovengrens inclusief)',
      bevestigIndeling() === 'bijna', 'bijna', String(bevestigIndeling()));
  groenNaNul(10.5, 1);
  eis('T4c groen 10,5s na nul -> FOUT',
      bevestigIndeling() === 'fout', 'fout', String(bevestigIndeling()));

  // ══ T5 — de indeling is ONGEVOELIG voor de reactietijd ═══════
  groenNaNul(5, 0.2);   const snel = bevestigIndeling();
  groenNaNul(5, 4.0);   const traag = bevestigIndeling();
  eis('T5 zelfde overschrijding, 0,2s vs 4,0s later getikt',
      snel === traag && snel === 'bijna',
      'beide bijna', snel + ' vs ' + traag);

  // ══ T6 — het TIKmoment zou hier wél gekanteld zijn ═══════════
  // 1,5s overschrijding, maar 3s later getikt. Op het tikmoment gemeten is dat
  // 4,5s en dus BIJNA; op het groen-moment is het 1,5s en dus GOED.
  groenNaNul(1.5, 3);
  const opGroen = bevestigIndeling();
  const opTik   = (Date.now() - countdownNulTijd) <= BEV_GOED_MAX_MS ? 'goed' : 'bijna';
  eis('T6 groen-moment zegt GOED waar het tikmoment BIJNA zou zeggen',
      opGroen === 'goed' && opTik === 'bijna',
      'groen-moment goed, tikmoment bijna',
      'groen=' + opGroen + ', tik=' + opTik);

  // ══ T7 — vóór nul: BIJNA bedienbaar, KLOPTE niet ═════════════
  roodVoorNul(40, 25);
  eis('T7 vóór nul: BIJNA bedienbaar, KLOPTE gedempt, indeling null',
      bijnaIsNoOp() === false && klopteIsNoOp() === true && bevestigIndeling() === null,
      'bijna actief, klopte gedempt, indeling null',
      'bijna=' + !bijnaIsNoOp() + ', klopte=' + !klopteIsNoOp() + ', ind=' + bevestigIndeling());
  eis('T7b restMs legt vast hoeveel er nog op de klok stond',
      meetBevestigMoment().restMs === 15000, '15000', String(meetBevestigMoment().restMs));

  // ══ T8 — demping volgt de indeling ═══════════════════════════
  groenNaNul(0.5, 0.2);
  eis('T8 GOED: KLOPTE actief, BIJNA gedempt',
      klopteIsNoOp() === false && bijnaIsNoOp() === true,
      'klopte actief, bijna gedempt',
      'klopte=' + !klopteIsNoOp() + ', bijna=' + !bijnaIsNoOp());
  groenNaNul(5, 0.2);
  eis('T8b BIJNA: KLOPTE gedempt, BIJNA actief',
      klopteIsNoOp() === true && bijnaIsNoOp() === false,
      'klopte gedempt, bijna actief',
      'klopte=' + !klopteIsNoOp() + ', bijna=' + !bijnaIsNoOp());
  groenNaNul(25, 0.2);
  eis('T8c FOUT: KLOPTE en BIJNA allebei gedempt',
      klopteIsNoOp() === true && bijnaIsNoOp() === true,
      'beide gedempt',
      'klopte=' + !klopteIsNoOp() + ', bijna=' + !bijnaIsNoOp());
  eis('T8d FOUT-knop is in alle drie de gevallen actief',
      document.getElementById('bev-fout').classList.contains('inert') === false,
      'nooit inert', String(document.getElementById('bev-fout').classList.contains('inert')));

  // ══ T9 — het schrijfpad ══════════════════════════════════════
  const sleutel = 'sl_bevestig_222222';
  const bewaard = localStorage.getItem(sleutel);
  const v4 = 'sl_v4_222222_' + huidigDDActief();
  const v4Bewaard = localStorage.getItem(v4);
  const schrijfTest = (naam, opzet, moetSchrijven) => {
    localStorage.removeItem(sleutel);
    // een emmer met echte metingen zodat gem bestaat
    const nu = Date.now();
    localStorage.setItem(v4, JSON.stringify(
      [0,1,2,3].map(i => ({ duur: 40, tijd: nu - i * 3600000, richting: 0, obs: 40, gewicht: 0.89, bron: 's1' }))));
    dichtstbijOSM = { id: 222222, lat: 52, lon: 5, afstand: 20, naam: 'TEST' };
    huidigCdBron = 'test'; huidigCdWaarde = 40; snelheidKmh = 0;
    schaduwWaarden = { m1:null,m2:null,m3:null,m4:null };
    schaduwCountdownNul = { m1:null,m2:null,m3:null,m4:null };
    opzet();
    bevestigActief = true;
    bevestigCountdown('bijna');
    let arr = []; try { arr = JSON.parse(localStorage.getItem(v4)) || []; } catch(e) {}
    const geschreven = arr.filter(m => m.bron === 'bevestig_bijna');
    let bev = []; try { bev = JSON.parse(localStorage.getItem(sleutel)) || []; } catch(e) {}
    eis(naam,
        (geschreven.length > 0) === moetSchrijven && bev.length === 1,
        (moetSchrijven ? 'correctie geschreven' : 'GEEN correctie') + ', tik wel gelogd',
        (geschreven.length ? ('correctie ' + Math.round(geschreven[0].duur) + 's') : 'geen correctie')
          + ', ' + bev.length + ' tik gelogd');
    return geschreven[0] || null;
  };

  const g1 = schrijfTest('T9 groen 5s na nul: correctie geschreven',
    () => groenNaNul(5, 0.5), true);
  eis('T9b correctie is gem + overschrijding, niet gem + tikafstand',
      g1 && Math.abs(g1.duur - 45) <= 1, '45s (40 + 5)', g1 ? (g1.duur + 's') : '-');

  schrijfTest('T10 vóór nul: tik gelogd, GEEN correctie',
    () => roodVoorNul(40, 25), false);
  schrijfTest('T11 zandloper (rood na nul): GEEN correctie, waarde nog niet definitief',
    () => { fase = 'rood'; cdBereikteNul = true; countdownNulTijd = Date.now() - 5000;
            groenStart = null; cdStart = null; activeCdDoel = 40; }, false);
  schrijfTest('T12 groen 25s na nul (FOUT-band): GEEN bijna-correctie',
    () => groenNaNul(25, 0.5), false);

  // ── opruimen ──────────────────────────────────────────────────
  localStorage.removeItem(sleutel);
  localStorage.removeItem(v4);
  if (bewaard !== null) localStorage.setItem(sleutel, bewaard);
  if (v4Bewaard !== null) localStorage.setItem(v4, v4Bewaard);
  fase = null; cdStart = null; cdBereikteNul = false; countdownNulTijd = null;
  groenStart = null; activeCdDoel = 0; bevestigActief = false; dichtstbijOSM = null;

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testIndeling = testIndeling;
