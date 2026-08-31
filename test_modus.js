// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_modus.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.74: bepaalCdModus en de spreidingsmaten eronder.
//
//  WAAROM DIT BESTAND BESTAAT
//  bepaalCdModus was tot nu toe NERGENS getest. Alle zes de bestaande
//  testbestanden zetten activeCdModus, cdMin en cdMax rechtstreeks als fixture
//  en leidden ze nooit af. Wie de spreidingsmaat aanraakt verandert daarmee de
//  klasse-indeling van ruim 300 emmers zonder dat één regel dat bewaakt — en
//  deze release raakt precies die maat aan.
//
//  De scheidslijn die dit bestand vastlegt:
//    de KLASSE (ZEKER/GESCHAT/VAAG) blijft op de range   — T2, T3
//    de BAND  (cdMin/cdMax)          gaat op 1,48 x MAD  — T4, T5
//  Als die twee ooit weer door elkaar lopen, valt hier een test om.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_modus.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testModus().regels);
// ═══════════════════════════════════════════════════════════════

function testModus() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  // Verse records: alle recentheidsgewichten ~1, zodat de bron-selectie in
  // spreidingBron niet meespeelt en de toets zuiver over de maat gaat.
  const nu = Date.now();
  const m = (...duren) => duren.map((d, i) => ({ duur: d, tijd: nu - i * 60000, gewicht: 1.0, bron: 's1' }));

  // ══ T1 — de bron-selectie is één definitie ═════════════════
  // spreidingBron is in V11.17.74 uit gewSpreiding en gewSpreidingN getrokken.
  // Zuivere extractie: de twee moeten exact dezelfde set beschrijven.
  const set = m(10, 20, 30, 40);
  eis('T1 gewSpreidingN telt precies wat spreidingBron oplevert',
      gewSpreidingN(set) === spreidingBron(set).length && gewSpreidingN(set) === 4,
      '4 = 4', gewSpreidingN(set) + ' vs ' + spreidingBron(set).length);
  eis('T1b records zonder geldige duur tellen niet mee',
      gewSpreidingN(m(10, 0, 20, -5)) === 2, '2', String(gewSpreidingN(m(10, 0, 20, -5))));

  // ══ T2 — gewSpreiding is en blijft de RANGE ════════════════
  eis('T2 gewSpreiding = max - min',
      gewSpreiding(m(10, 20, 30, 40)) === 30, '30', String(gewSpreiding(m(10, 20, 30, 40))));
  eis('T2b één uitschieter bepaalt de range volledig',
      gewSpreiding(m(20, 20, 20, 90)) === 70, '70', String(gewSpreiding(m(20, 20, 20, 90))));
  eis('T2c minder dan 2 metingen -> 0',
      gewSpreiding(m(20)) === 0, '0', String(gewSpreiding(m(20))));

  // ══ T3 — de KLASSE blijft op de range ══════════════════════
  // relSpr = range / gem, drempels 0,20 en 0,40. Met MAD zouden deze drie
  // gevallen anders uitvallen; dat mag niet gebeuren.
  const klasse = (gem, ms) => bepaalCdModus(gem, ms).modus;
  eis('T3 relSpr < 0,20 -> CD_ZEKER',
      klasse(100, m(95, 100, 105, 100)) === CD_ZEKER, 'CD_ZEKER', String(klasse(100, m(95, 100, 105, 100))));
  eis('T3b relSpr tussen 0,20 en 0,40 -> CD_GESCHAT',
      klasse(100, m(85, 100, 110, 100)) === CD_GESCHAT, 'CD_GESCHAT', String(klasse(100, m(85, 100, 110, 100))));
  eis('T3c relSpr >= 0,40 -> CD_VAAG',
      klasse(100, m(70, 100, 120, 100)) === CD_VAAG, 'CD_VAAG', String(klasse(100, m(70, 100, 120, 100))));

  // De kern van de scheiding: dezelfde set, uitschieter erin. De MAD blijft
  // klein, de range explodeert. De KLASSE moet de range volgen (dus VAAG).
  const uitschieter = m(20, 20, 20, 20, 90);
  eis('T3d één uitschieter maakt de klasse VAAG (range-gedreven, zoals bedoeld)',
      bepaalCdModus(20, uitschieter).modus === CD_VAAG,
      'CD_VAAG', String(bepaalCdModus(20, uitschieter).modus));

  // ══ T4 — de BAND volgt de MAD, niet de range ═══════════════
  eis('T4 gewSpreidingMAD = 1,4826 x mediane absolute afwijking',
      Math.abs(gewSpreidingMAD(m(10, 20, 30, 40)) - 1.4826 * 10) < 0.001,
      String((1.4826 * 10).toFixed(3)), gewSpreidingMAD(m(10, 20, 30, 40)).toFixed(3));

  const r4 = bepaalCdModus(20, uitschieter);
  eis('T4b de band negeert de uitschieter die de klasse wél stuurde',
      r4.cdMin === 19 && r4.cdMax === 21,
      'cdMin 19, cdMax 21 (band ~1,5s)', 'cdMin ' + r4.cdMin + ', cdMax ' + r4.cdMax);
  eis('T4c met de OUDE range-band zou dit 1-90 zijn geweest',
      Math.max(1, Math.round(20 - gewSpreiding(uitschieter))) === 1
      && Math.round(20 + gewSpreiding(uitschieter)) === 90,
      'de oude formule geeft 1-90', 'oud: 1-90, nieuw: ' + r4.cdMin + '-' + r4.cdMax);

  // realistisch geval uit de meting: gem 19s, range 29s -> vroeger '1-48s'
  const echt = m(8, 15, 19, 21, 24, 37);
  const r4d = bepaalCdModus(19, echt);
  eis('T4d realistische emmer geeft een band die de bodem niet raakt',
      r4d.modus === CD_VAAG && r4d.cdMin > 1,
      'CD_VAAG met cdMin > 1',
      r4d.modus + ' ' + r4d.cdMin + '-' + r4d.cdMax + 's (oude band: '
        + Math.max(1, Math.round(19 - gewSpreiding(echt))) + '-' + Math.round(19 + gewSpreiding(echt)) + 's)');

  // ══ T5 — de ondergrens bij MAD = 0 ═════════════════════════
  // Meer dan de helft identiek plus één uitschieter: MAD wordt 0. Zonder
  // ondergrens zou de band nul breed zijn en de pill '20-20s onzeker' tonen.
  const plat = m(20, 20, 20, 60);
  eis('T5 MAD is hier daadwerkelijk 0',
      gewSpreidingMAD(plat) === 0, '0', String(gewSpreidingMAD(plat)));
  const r5 = bepaalCdModus(20, plat);
  eis('T5b de ondergrens van 1s voorkomt een band van nul breed',
      r5.cdMin === 19 && r5.cdMax === 21,
      'cdMin 19, cdMax 21', 'cdMin ' + r5.cdMin + ', cdMax ' + r5.cdMax);

  // ══ T5c/T5d — de band mag nooit breder zijn dan de data ════
  // Bij n=2 is de MAD per constructie gelijk aan de range (mediaan van
  // [range, 0] pakt met de floor-conventie weer de range), dus 1,48 x MAD zou
  // BREDER uitvallen dan de oude band. Gemeten trof dat 31 van de 204
  // CD_VAAG-emmers. De klem op spr voorkomt dat.
  const tweeMetingen = m(10, 30);
  eis('T5c bij n=2 is de MAD gelijk aan de range — dat is het risico',
      gewSpreidingMAD(tweeMetingen) > gewSpreiding(tweeMetingen),
      '1,48 x MAD > range',
      gewSpreidingMAD(tweeMetingen).toFixed(1) + ' > ' + gewSpreiding(tweeMetingen));
  const r5c = bepaalCdModus(20, tweeMetingen);
  eis('T5d de band wordt daar geklemd op de range, niet verbreed',
      (r5c.cdMax - r5c.cdMin) <= 2 * gewSpreiding(tweeMetingen),
      'bandbreedte <= 2 x range (' + (2 * gewSpreiding(tweeMetingen)) + ')',
      'band ' + r5c.cdMin + '-' + r5c.cdMax + ' = ' + (r5c.cdMax - r5c.cdMin) + 's breed');

  // ══ T6 — de dunne-data-poort blijft ongemoeid ══════════════
  const r6 = bepaalCdModus(30, m(30));
  eis('T6 minder dan 2 bruikbare metingen -> CD_GESCHAT zonder band',
      r6.modus === CD_GESCHAT && r6.cdMin === null && r6.cdMax === null,
      'CD_GESCHAT, cdMin/cdMax null',
      r6.modus + ', ' + r6.cdMin + '/' + r6.cdMax);
  const r6b = bepaalCdModus(30, m(30, 30));
  eis('T6b bij precies 2 metingen wordt de spreidingstak wel gehaald',
      r6b.modus === CD_ZEKER, 'CD_ZEKER (spreiding 0)', String(r6b.modus));

  // ══ T7 — ZEKER en GESCHAT dragen nooit een band ════════════
  const rZ = bepaalCdModus(100, m(95, 100, 105, 100));
  const rG = bepaalCdModus(100, m(85, 100, 110, 100));
  eis('T7 alleen CD_VAAG levert cdMin/cdMax; de andere twee blijven null',
      rZ.cdMin === null && rZ.cdMax === null && rG.cdMin === null && rG.cdMax === null,
      'alle vier null',
      'ZEKER ' + rZ.cdMin + '/' + rZ.cdMax + ', GESCHAT ' + rG.cdMin + '/' + rG.cdMax);

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testModus = testModus;
