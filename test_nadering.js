// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nadering.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.81: geleerde naderingen, en één regel per richting.
//
//  HET GEMETEN GEVAL
//  Node 3330495184 (Arnhemseweg) toonde twee regels 'Rechtsaf', uit
//  sl_v5_..._NO_NW_avond en sl_v5_..._N_W_avond. Beide zijn dezelfde manoeuvre:
//  de aanrijkoersen liggen in één wolk die door de bucketgrens op 22,5 graden
//  in tweeën wordt gehakt.
//
//  T1-T5 leggen het clusteralgoritme vast op vier echte nodes uit de export van
//  28 augustus plus het voorbeeld van 3 september. T3 en T4 zijn de wacht tegen
//  overcorrectie: een node die wérkelijk vanaf twee kanten benaderd wordt moet
//  twee naderingen HOUDEN. Zonder die twee zou "alles samenvoegen" ook slagen.
//
//  T6 is de kern: landen N (0 graden) en NO (45 graden) in dezelfde nadering?
//  Dat is precies de vraag of de twee schermregels er één worden.
//
//  T7 legt vast waarom het leider-algoritme gekozen is en niet knippen-op-gaten.
//  Die laatste ketent: op de koersen van 3 september maakt hij er één nadering
//  van 51 graden van, en dan hoort N (0 graden) nergens meer bij. De test rekent
//  dat expliciet na, zodat de keuze niet alleen in commentaar staat.
//
//  T8-T11 toetsen de weergave zelf op een echte DOM: twee botsende V5-sleutels
//  leveren één regel, en die regel draagt geen 'vanaf'-tekst meer.
//
//  T12-T13 bewaken dat deze release PUUR LEZEND is. Geen enkele opslagsleutel
//  verandert; de countdown-keten (laadMV5Geclusterd, kiesCountdownBron) is niet
//  aangeraakt. Dat is de afspraak: het herschrijven van de V5-sleutel naar
//  (nadering, bocht) is een eigen release, want die heeft opgeslagen
//  nadering-ids nodig — het koersvenster is rollend (20, slaRichtingOp) en een
//  schuivend gemiddelde zou bestaande sleutels wezen maken.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_nadering.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testNadering().regels);
// ═══════════════════════════════════════════════════════════════

function testNadering() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const NODE = 777006;
  const RKEY = 'sl_richting_' + NODE;
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };
  const bewaard = {
    dichtstbijOSM, v9AanrijHeading, v9AanrijSnelheidHeading,
    richtingBlokVerborgen, richtingLockKeuze, richtingLockNodeId,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML
  };

  // Zet de koerswolk van een node.
  const zetHeadings = (hs) => zetLS(RKEY, JSON.stringify({
    headings: hs, laatste_update: Date.now(), bevestigingen: hs.length
  }));
  const gem = (n) => n.map(x => x.gem);

  try {
    // ══ T1-T5 — het clusteralgoritme op echte wolken ══════════
    // De koersen van 3 september, zoals in de opdracht opgegeven.
    const SEPT = [12,12,12,12,39,39,39,76,88,88,88,88,88,88,88,50,32,34,32,23];
    zetHeadings(SEPT);
    let n = naderingenVoorNode(NODE);
    eis('T1 voorbeeldnode 3 sept: twee naderingen, 28 en 87 graden',
        n.length === 2 && Math.abs(n[0].gem - 28) <= 2 && Math.abs(n[1].gem - 87) <= 2,
        '2 naderingen: ~28gr, ~87gr',
        n.length + ': ' + gem(n).join(', '));

    // Dezelfde node op 28 augustus: een wolk van TWEE graden, precies op de
    // bucketgrens van 22,5. Het raster splitst hem, het cluster niet.
    zetHeadings([22,22,22,22,22,22,22,22,22,22,22,22,22,21,21,22,22,23,23,23]);
    n = naderingenVoorNode(NODE);
    eis('T2 wolk van 2 graden op de bucketgrens blijft ÉÉN nadering',
        n.length === 1 && Math.abs(n[0].gem - 22) <= 1,
        '1 nadering ~22gr', n.length + ': ' + gem(n).join(', '));

    // ANTI-OVERCORRECTIE: dit kruispunt wordt echt vanaf twee kanten benaderd.
    zetHeadings([164,166,165,344,346,345,164,346]);
    n = naderingenVoorNode(NODE);
    eis('T3 twee tegengestelde naderingen BLIJVEN apart (node 7881376751)',
        n.length === 2, '2 naderingen', n.length + ': ' + gem(n).join(', '));

    zetHeadings([62,63,64,71,72,73]);
    n = naderingenVoorNode(NODE);
    eis('T4 smalle wolk over de grens NO/O wordt één nadering (node 7881213125)',
        n.length === 1, '1 nadering', n.length + ': ' + gem(n).join(', '));

    zetHeadings([152,155,160,165,167]);
    n = naderingenVoorNode(NODE);
    eis('T5 smalle wolk over de grens Z/ZO wordt één nadering (node 4467331940)',
        n.length === 1, '1 nadering', n.length + ': ' + gem(n).join(', '));

    // ══ T6 — DE KERN ══════════════════════════════════════════
    zetHeadings(SEPT);
    n = naderingenVoorNode(NODE);
    const iN  = naderingVoorWindrichting(n, 'N');
    const iNO = naderingVoorWindrichting(n, 'NO');
    eis('T6 N en NO landen in DEZELFDE nadering — de twee regels worden er één',
        iN != null && iN === iNO,
        'zelfde nadering', 'N->' + iN + ', NO->' + iNO);
    // En de tweede nadering is wél een andere: het is geen "alles samenvoegen".
    const iO = naderingVoorWindrichting(n, 'O');
    eis('T6b maar O hoort bij de ANDERE nadering — niet alles wordt samengevoegd',
        iO != null && iO !== iN, 'andere nadering dan N/NO',
        'O->' + iO + ' tegen N->' + iN);

    // ══ T7 — waarom leider en niet knippen-op-gaten ═══════════
    // Nagerekend in de test zelf, zodat de keuze toetsbaar is en niet alleen
    // beweerd. Knippen op een gat > 30 graden ketent 12..88 aan elkaar.
    (function () {
      const s = [...SEPT].sort((a, b) => a - b);
      const cl = []; let cur = [s[0]];
      for (let i = 1; i < s.length; i++) {
        if (s[i] - s[i - 1] > NAD_DREMPEL_GRAD) { cl.push(cur); cur = []; }
        cur.push(s[i]);
      }
      cl.push(cur);
      eis('T7 de gatvariant zou hier ketenen tot één brede nadering',
          cl.length === 1, '1 (en daarom afgewezen)', String(cl.length));
    })();

    // ══ T8-T11 — de weergave ══════════════════════════════════
    // Twee botsende V5-sleutels, precies zoals op de echte node.
    zetHeadings(SEPT);
    zetLS('sl_v5_' + NODE + '_NO_NW_avond', JSON.stringify([{ duur: 31, tijd: Date.now(), gewicht: 1 }]));
    zetLS('sl_v5_' + NODE + '_N_W_avond',   JSON.stringify([{ duur: 9,  tijd: Date.now(), gewicht: 0.6, bron: 'tik' }]));
    zetLS('sl_v4_' + NODE + '_avond', JSON.stringify([{ duur: 30, tijd: Date.now(), richting: 22, obs: 30, gewicht: 0.6, bron: 's1' }]));

    dichtstbijOSM = { id: NODE, lat: 52, lon: 5, afstand: 12, naam: 'TEST-NAD' };
    richtingBlokVerborgen = false;
    richtingLockKeuze = null; richtingLockNodeId = null;
    v9AanrijSnelheidHeading = 28;   // we naderen via nadering 0
    v9AanrijHeading = 28;

    renderRichtingBlok(dichtstbijOSM);
    const body = document.getElementById('richting-blok-body');
    const labels = [...body.querySelectorAll('.rb-rij .rb-label')]
      .map(e => e.textContent.trim())
      .filter(t => t !== 'Algemeen' && !t.startsWith('Algemeen'));

    eis('T8 de twee botsende sleutels leveren ÉÉN richtingregel',
        labels.length === 1, '1 regel', labels.length + ': [' + labels.join(' | ') + ']');
    eis('T8b en die regel heet Rechtsaf',
        labels[0] === 'Rechtsaf', 'Rechtsaf', String(labels[0]));
    eis('T9 geen twee regels lezen nog identiek',
        new Set(labels).size === labels.length, 'alle labels uniek',
        labels.join(' | '));
    eis('T10 de regel draagt geen aanrij-aanduiding meer',
        !/vanaf/i.test(body.innerHTML.replace(/Algemeen[^<]*/g, '')),
        "geen 'vanaf' in het rijblok",
        /vanaf/i.test(body.innerHTML) ? "'vanaf' staat er nog" : "geen 'vanaf'");

    // Naderingsfilter: nader nu via de ANDERE nadering (87 graden). Daar is geen
    // richtingdata, dus de terugval moet vuren en de lijst niet leegmaken.
    v9AanrijSnelheidHeading = 87; v9AanrijHeading = 87;
    renderRichtingBlok(dichtstbijOSM);
    const labels2 = [...document.getElementById('richting-blok-body')
      .querySelectorAll('.rb-rij .rb-label')].map(e => e.textContent.trim())
      .filter(t => !t.startsWith('Algemeen'));
    eis('T11 nadering zonder eigen data laat het blok niet leeg achter',
        labels2.length >= 1, 'minstens 1 regel', String(labels2.length));

    // ══ T15 — DE GRENS VAN DEZE RELEASE ═══════════════════════
    // Zonder koersen kan er niets geleerd worden en valt de groepering terug op
    // (aanrij, bocht). Twee sleutels met een verschillende aanrij geven dan nog
    // steeds twee regels — ook als het in werkelijkheid één manoeuvre is.
    //
    // Dit is geen verzonnen randgeval: test_lijst.js zet in zijn fixture geen
    // sl_richting_ en draait daarom sinds deze release volledig langs deze
    // terugval. Die suite slaagt dus, maar toetst niet meer wat zijn koppen
    // beweren. Hier staat de grens expliciet, zodat hij niet stilletjes
    // verschuift.
    //
    // In de praktijk is het smal: slaRichtingOp (r9545) schrijft een koers bij
    // elke detectie, en op de export van 28 augustus hebben 834 van de 1048
    // nodes met sl_richting_ er minstens twee. Maar op een vers kruispunt, vóór
    // de tweede detectie, kan de dubbele regel dus nog verschijnen.
    zetLS(RKEY, null);                       // geen koersen bekend
    renderRichtingBlok(dichtstbijOSM);
    const labels3 = [...document.getElementById('richting-blok-body')
      .querySelectorAll('.rb-rij .rb-label')].map(e => e.textContent.trim())
      .filter(t => !t.startsWith('Algemeen'));
    eis('T15 zonder koersen valt hij terug op (aanrij, bocht): twee regels blijven',
        labels3.length === 2, '2 regels (bekende grens)',
        labels3.length + ': [' + labels3.join(' | ') + ']');

    // En zodra er wél koersen zijn, worden het er één. Dit paar is het bewijs
    // dat de nadering de oorzaak wegneemt, niet iets anders in de weergave.
    zetHeadings(SEPT);
    renderRichtingBlok(dichtstbijOSM);
    const labels4 = [...document.getElementById('richting-blok-body')
      .querySelectorAll('.rb-rij .rb-label')].map(e => e.textContent.trim())
      .filter(t => !t.startsWith('Algemeen'));
    eis('T15b met koersen worden dezelfde twee sleutels één regel',
        labels4.length === 1, '1 regel',
        labels4.length + ': [' + labels4.join(' | ') + ']');

    // ══ T12-T13 — puur lezend ═════════════════════════════════
    const zonderCommentaar = (b) => b
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    const nadBron = zonderCommentaar(String(naderingenVoorNode))
                  + zonderCommentaar(String(naderingVoorHoek))
                  + zonderCommentaar(String(naderingVoorWindrichting));
    eis('T12 de nadering-functies schrijven niets naar localStorage',
        !/setItem|removeItem/.test(nadBron), 'alleen lezen',
        /setItem|removeItem/.test(nadBron) ? 'SCHRIJFT' : 'alleen lezen');

    const kb = zonderCommentaar(String(kiesCountdownBron));
    eis('T13 de countdown-keten is niet aangeraakt: nog steeds laadMV5Geclusterd',
        /laadMV5Geclusterd/.test(kb) && !/naderingVoor/.test(kb),
        'laadMV5Geclusterd, geen nadering-aanroep',
        (/laadMV5Geclusterd/.test(kb) ? 'clustering intact' : 'CLUSTERING WEG')
          + ', ' + (/naderingVoor/.test(kb) ? 'NADERING GEBRUIKT' : 'geen nadering'));

    const v5s = zonderCommentaar(String(v5Sleutel));
    eis('T13b de V5-sleutelvorm is ongewijzigd (aanrij_afrij_dagdeel)',
        /\$\{aanrij\}_\$\{afrij\}_\$\{dd\}/.test(v5s),
        'sleutel ongewijzigd', v5s.replace(/\s+/g, ' ').slice(0, 80));

    // ══ T14 — de drempel staat waar de toelichting hem zet ════
    eis('T14 NAD_DREMPEL_GRAD is 30',
        NAD_DREMPEL_GRAD === 30, '30', String(NAD_DREMPEL_GRAD));
    // 25 en 35 moeten dezelfde uitkomst geven — de keuze mag niet op een rand liggen.
    eis('T14b de uitkomst is stabiel: 25 en 35 graden geven ook 2 naderingen',
        (function () {
          const tel = (dr) => {
            const s = [...SEPT].sort((a, b) => a - b); const cl = [];
            for (const h of s) {
              let b = null, bd = Infinity;
              for (const c of cl) { const v = nadHoekVerschil(h, c.gem); if (v < bd) { bd = v; b = c; } }
              if (b && bd <= dr) { b.hs.push(h); b.gem = nadCirculairGemiddelde(b.hs); }
              else cl.push({ gem: h, hs: [h] });
            }
            return cl.length;
          };
          return tel(25) === 2 && tel(35) === 2;
        })(), '25gr en 35gr geven allebei 2', 'stabiel');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockNodeId = bewaard.richtingLockNodeId;
    const b = document.getElementById('richting-blok-body');
    if (b && bewaard.blokHtml != null) b.innerHTML = bewaard.blokHtml;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testNadering = testNadering;
