// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_bevestig_poort.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.89 (release F): drie risico's in het bevestigpad.
//
//  T1  de tik landt op de node waar hij voor bedoeld was, of nergens
//  T4  een gedempte BIJNA registreert niets meer
//  T9  KLOPTE en BIJNA kunnen niet langer tegelijk fel zijn
//
//  WAAROM T9 ER ANDERS UITZIET DAN DE REST
//  De race die hij bewaakt was intermitterend — ongeveer één op de tien
//  volledige testrondes — en zat op precies één grenswaarde. Een test die de
//  toestand één keer opzet en één keer kijkt zou hem vrijwel altijd missen.
//  T9 dwingt het scenario daarom af in plaats van erop te wachten: hij draait
//  de grenswaarde honderden keren, en toetst daarnaast op de bron dát beide
//  poorten hetzelfde moment krijgen. Die tweede helft is de eigenlijke
//  waarborg — de eerste laat alleen zien dat de reproductie nu op nul staat.
//
//  DE aiKleur-UITZONDERING BIJ BIJNA IS GEEN KOPIEERWERK
//  In de zandloper is overschrMs een DOORLOPENDE ondergrens. Valt groen 9 s na
//  nul (= 'bijna') en tikt de gebruiker 2 s later, dan staat de teller op 11 s
//  en luidt de indeling 'fout' — BIJNA gedempt terwijl de waarheid 'bijna' was.
//  T4b legt vast dat aiKleur='groen' die tik alsnog doorlaat, zodat deze
//  release niet de fout van V11.17.82 op de andere knop herhaalt.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_bevestig_poort.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testBevestigPoort().regels);
// ═══════════════════════════════════════════════════════════════

function testBevestigPoort() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };
  const A = 995001, B = 995002;
  const store = (id) => { try { return JSON.parse(localStorage.getItem('sl_bevestig_' + id)) || []; }
                          catch (e) { return []; } };
  const logRegels = (reden) => { try {
    return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === reden);
  } catch (e) { return []; } };

  const bewaard = {
    dichtstbijOSM, fase, faseStart, cdStart, groenStart, countdownNulTijd,
    cdBereikteNul, activeCdDoel, activeCdModus, activeCdMin, activeCdMax,
    bevestigActief, bevestigVoorNodeId, bevInertStaat, aiKleur, snelheidKmh,
    laatsteRoodFaseStart, bevestigGedaanVoorFase, huidigCdBron, huidigCdWaarde,
    cdWallStart, cdWallNodeId, schaduwWaarden, schaduwCountdownNul,
    wrapClass: bevestigWrap.className
  };

  // Zet een toestand waarin de knoppen in beeld staan bij node `id`, met een
  // groen dat `overschrMs` na het nulpunt viel.
  function opzet(id, overschrMs, aiK) {
    zetLS('sl_bevestig_' + id, null);
    dichtstbijOSM = { id, lat: 52, lon: 5, afstand: 12, naam: 'TEST-' + id };
    cdWallStart = null; cdWallNodeId = null;
    huidigCdBron = 'V4'; huidigCdWaarde = 40;
    schaduwWaarden = { m1: null, m2: null, m3: null, m4: null };
    schaduwCountdownNul = { m1: null, m2: null, m3: null, m4: null };
    laatsteRoodFaseStart = Date.now() - 60000;
    bevestigGedaanVoorFase = null;
    activeCdDoel = 40; activeCdModus = CD_GESCHAT; activeCdMin = null; activeCdMax = null;
    snelheidKmh = 0;
    aiKleur = (aiK === undefined) ? 'rood' : aiK;
    if (overschrMs === null) {          // rood, vóór nul
      fase = 'rood'; cdBereikteNul = false; countdownNulTijd = null;
      groenStart = null; cdStart = performance.now();
    } else {                            // groen, `overschrMs` ná nul
      fase = 'groen'; cdBereikteNul = true;
      groenStart = performance.now();
      countdownNulTijd = Date.now() - overschrMs;
      cdStart = null;
    }
    bevestigActief = true;
    bevestigVoorNodeId = String(id);
    bevestigWrap.classList.add('actief');
    bevInertStaat = '';
  }

  try {
    // ══ T1 — DE NODE WISSELT TUSSEN TONEN EN TIKKEN ═══════════
    zetLS('sl_opslaglog', null);
    opzet(A, 15000);                       // knoppen verschenen bij A
    dichtstbijOSM = { id: B, lat: 52, lon: 5, afstand: 12, naam: 'TEST-B' };  // GPS ging naar B
    bevestigCountdown('fout');
    const gewisseld = logRegels('bevestig_node_gewisseld');
    eis('T1 de tik wordt verworpen en niet op de nieuwe node geschreven',
        store(B).length === 0 && store(A).length === 0,
        'beide stores leeg',
        'A=' + store(A).length + ', B=' + store(B).length);
    eis('T1b en hij wordt gelogd met het OUDE en het NIEUWE node-id',
        gewisseld.length === 1 && String(gewisseld[0].node) === String(A)
        && String(gewisseld[0].nieuw) === String(B),
        'node=A, nieuw=B',
        gewisseld.length ? ('node=' + gewisseld[0].node + ', nieuw=' + gewisseld[0].nieuw)
                         : 'GEEN LOGREGEL');
    eis('T1c de knoppenrij verdwijnt na een verworpen tik',
        bevestigActief === false && bevestigVoorNodeId === null
        && !bevestigWrap.classList.contains('actief'),
        'rij weg, id gewist',
        'actief=' + bevestigActief + ', id=' + bevestigVoorNodeId);

    // ══ T2 — GEEN WISSEL: ONGEWIJZIGD GEDRAG ══════════════════
    zetLS('sl_opslaglog', null);
    opzet(A, 15000);                       // 15 s na nul -> 'fout'
    bevestigCountdown('fout');
    eis('T2 zonder node-wissel wordt de tik gewoon geschreven',
        store(A).length === 1 && store(A)[0].categorie === 'fout',
        '1 fout-record op A',
        store(A).length + ' records');
    eis('T2b en er wordt niets als gewisseld gelogd',
        logRegels('bevestig_node_gewisseld').length === 0, '0',
        String(logRegels('bevestig_node_gewisseld').length));

    // ══ T3 — HET ID WORDT OP ELK WISPUNT GEWIST ═══════════════
    const wispunten = [];
    // 1. de tik zelf
    opzet(A, 15000); bevestigCountdown('fout');
    wispunten.push(['de tik zelf', bevestigVoorNodeId === null]);
    // 2. resetNeutraal
    opzet(A, 15000); resetNeutraal('test');
    wispunten.push(['resetNeutraal', bevestigVoorNodeId === null]);
    // 3. node-wissel in updateDichtbij — via de bronregel, want de volledige
    //    aanroep vergt een osmCache-fixture die hier niet ter zake doet.
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    wispunten.push(['updateDichtbij', /bevestigVoorNodeId = null/.test(zc(updateDichtbij))]);
    // 4. corrigeerNodeAutomatisch
    wispunten.push(['corrigeerNodeAutomatisch',
                    /bevestigVoorNodeId = null/.test(zc(corrigeerNodeAutomatisch))]);
    // 5. de verworpen tik uit T1
    opzet(A, 15000);
    dichtstbijOSM = { id: B, lat: 52, lon: 5, afstand: 12, naam: 'TEST-B' };
    bevestigCountdown('fout');
    wispunten.push(['verworpen tik', bevestigVoorNodeId === null]);
    const nietGewist = wispunten.filter(([, ok]) => !ok).map(([n]) => n);
    eis('T3 het vastgelegde id wordt op alle vijf de wispunten gewist',
        nietGewist.length === 0, 'alle vijf',
        nietGewist.length ? ('niet gewist: ' + nietGewist.join(', ')) : 'alle vijf');
    // En het wordt gezet zodra de rij verschijnt.
    eis('T3b tickCd legt het id vast bij het tonen van de rij',
        (zc(tickCd).match(/bevestigVoorNodeId = dichtstbijOSM/g) || []).length === 2,
        '2 zetpunten (rood-tak en groen-na-nul-tak)',
        String((zc(tickCd).match(/bevestigVoorNodeId = dichtstbijOSM/g) || []).length));

    // ══ T4 — GEDEMPTE BIJNA SCHRIJFT NIETS ════════════════════
    // 15 s na nul is 'fout', dus BIJNA is daar gedempt. aiKleur niet groen.
    zetLS('sl_opslaglog', null);
    opzet(A, 15000, 'rood');
    eis('T4a BIJNA is in deze toestand inderdaad gedempt',
        bijnaIsNoOp() === true, 'gedempt', String(bijnaIsNoOp()));
    bevestigCountdown('bijna');
    eis('T4 een tik op een gedempte BIJNA schrijft niets weg',
        store(A).length === 0, '0 records', store(A).length + ' records');
    eis('T7 en de geblokkeerde tik wordt gelogd als bevestig_bijna_inert',
        logRegels('bevestig_bijna_inert').length === 1
        && String(logRegels('bevestig_bijna_inert')[0].node) === String(A),
        '1 regel op node A',
        logRegels('bevestig_bijna_inert').length + ' regels');

    // ══ T4b — MAAR NIET ALS DE CAMERA AL GROEN ZIET ═══════════
    zetLS('sl_opslaglog', null);
    opzet(A, 15000, 'groen');
    bevestigCountdown('bijna');
    eis('T4b met aiKleur=groen komt dezelfde tik er wél door',
        store(A).length === 1 && store(A)[0].categorie === 'bijna',
        '1 bijna-record', store(A).length + ' records');
    eis('T4c en die wordt apart gelogd als bevestig_bijna_vroeg',
        logRegels('bevestig_bijna_vroeg').length === 1
        && logRegels('bevestig_bijna_inert').length === 0,
        'vroeg 1, inert 0',
        'vroeg ' + logRegels('bevestig_bijna_vroeg').length
          + ', inert ' + logRegels('bevestig_bijna_inert').length);

    // ══ T5 — EEN FELLE BIJNA SCHRIJFT GEWOON ══════════════════
    // 5 s na nul valt tussen BEV_GOED_MAX_MS en BEV_BIJNA_MAX_MS -> 'bijna'.
    zetLS('sl_opslaglog', null);
    opzet(A, 5000, 'rood');
    eis('T5a BIJNA is hier fel',
        bijnaIsNoOp() === false, 'fel', String(bijnaIsNoOp()));
    bevestigCountdown('bijna');
    eis('T5 een tik op een felle BIJNA schrijft gewoon weg',
        store(A).length === 1 && store(A)[0].categorie === 'bijna',
        '1 bijna-record', store(A).length + ' records');
    eis('T5b en zonder poortlogregel',
        logRegels('bevestig_bijna_inert').length === 0
        && logRegels('bevestig_bijna_vroeg').length === 0,
        'geen poortregel', 'geen');

    // ══ T6 — FOUT WORDT NOOIT GEBLOKKEERD (RV2) ═══════════════
    const foutGevallen = [
      ['rood vóór nul', null], ['0,5 s na nul', 500], ['5 s na nul', 5000],
      ['15 s na nul', 15000], ['60 s na nul', 60000]
    ];
    const foutMislukt = [];
    for (const [naam, o] of foutGevallen) {
      zetLS('sl_opslaglog', null);
      opzet(A, o, 'rood');
      bevestigCountdown('fout');
      if (store(A).length !== 1) foutMislukt.push(naam);
    }
    eis('T6 FOUT schrijft in elke toestand weg (RV2)',
        foutMislukt.length === 0, 'alle vijf',
        foutMislukt.length ? ('geblokkeerd bij: ' + foutMislukt.join(', ')) : 'alle vijf');
    const bcBron = zc(bevestigCountdown);
    eis('T6b en er is geen enkele poort op FOUT in de bron',
        !/categorie === 'fout' &&[\s\S]{0,40}return/.test(bcBron),
        'geen fout-poort', 'geen');

    // ══ T8 — DE KLOPTE-POORT IS ONGEWIJZIGD ═══════════════════
    eis('T8 de KLOPTE-poort uit V11.17.82 staat er nog, met zijn aiKleur-tak',
        /categorie === 'klopte' && klopteIsNoOp\(_mom\)/.test(bcBron)
        && /aiKleur === 'groen'/.test(bcBron)
        && /bevestig_klopte_vroeg/.test(bcBron)
        && /bevestig_klopte_inert/.test(bcBron),
        'poort + beide logredenen', 'ongewijzigd');
    // Gedrag: gedempte KLOPTE zonder groen blokkeert, mét groen niet.
    zetLS('sl_opslaglog', null);
    opzet(A, 15000, 'rood'); bevestigCountdown('klopte');
    const kGeblokkeerd = store(A).length === 0;
    zetLS('sl_opslaglog', null);
    opzet(A, 15000, 'groen'); bevestigCountdown('klopte');
    const kDoor = store(A).length === 1;
    eis('T8b en hij gedraagt zich nog zoals toen: blokkeert zonder groen, laat door mét groen',
        kGeblokkeerd && kDoor,
        'geblokkeerd / doorgelaten',
        (kGeblokkeerd ? 'geblokkeerd' : 'NIET geblokkeerd') + ' / '
          + (kDoor ? 'doorgelaten' : 'NIET doorgelaten'));

    // ══ T9 — RV4: DE RACE OP DE GRENSWAARDE ═══════════════════
    // De bron is de eigenlijke waarborg: beide poorten krijgen hetzelfde
    // moment mee, dus ze KUNNEN niet meer uiteenlopen.
    const ubBron = zc(updateBevestigKnopStaat);
    eis('T9 updateBevestigKnopStaat meet het moment één keer',
        (ubBron.match(/meetBevestigMoment\(\)/g) || []).length === 1
        && /klopteIsNoOp\(mom\)/.test(ubBron) && /bijnaIsNoOp\(mom\)/.test(ubBron),
        '1 meting, beide poorten krijgen hem',
        (ubBron.match(/meetBevestigMoment\(\)/g) || []).length + ' metingen');
    // En de reproductie: 400 keer precies op de grenswaarde.
    let beideFel = 0;
    for (let i = 0; i < 400; i++) {
      opzet(A, BEV_GOED_MAX_MS, 'rood');
      updateBevestigKnopStaat();
      if (!bevKlopteBtn.classList.contains('inert')
          && !bevBijnaBtn.classList.contains('inert')) beideFel++;
    }
    eis('T9b 400 rondes op exact de 2000 ms-grens: nooit beide fel',
        beideFel === 0, '0 van 400', beideFel + ' van 400');
    // Ook op de andere grens, en op een handvol gewone waarden.
    let beideFel2 = 0;
    for (const o of [BEV_GOED_MAX_MS, BEV_GOED_MAX_MS + 1, BEV_BIJNA_MAX_MS,
                     BEV_BIJNA_MAX_MS + 1, 500, 5000, 15000]) {
      for (let i = 0; i < 30; i++) {
        opzet(A, o, 'rood');
        updateBevestigKnopStaat();
        if (!bevKlopteBtn.classList.contains('inert')
            && !bevBijnaBtn.classList.contains('inert')) beideFel2++;
      }
    }
    eis('T9c en op beide grenzen plus vijf gewone waarden ook niet',
        beideFel2 === 0, '0 van 210', beideFel2 + ' van 210');

    // ══ T10 — DE VOOR-NUL-TOESTANDEN, NA V11.18.0 ═════════════
    // Hier stond dat bijnaIsNoOp vóór het nulpunt ONVOORWAARDELIJK false gaf —
    // de blanco-uitzondering. Die is in V11.18.0 weg: ook voor het nulpunt
    // beslist nu de afstand tot nul. De oorspronkelijke bedoeling van dit blok
    // (de aiKleur-uitzondering hoeft niet aan te komen als de knop legitiem fel
    // staat) blijft overeind, alleen moet de opzet nu binnen het venster liggen.
    zetLS('sl_opslaglog', null);
    opzet(A, null, 'rood');                 // rood-voor-nul, 40s van nul
    eis('T10a ver voor het nulpunt is BIJNA nu GRIJS',
        meetBevestigMoment().toestand === 'rood-voor-nul' && bijnaIsNoOp() === true,
        'toestand rood-voor-nul, gedempt',
        meetBevestigMoment().toestand + ', gedempt=' + bijnaIsNoOp());
    bevestigCountdown('bijna');
    eis('T10a2 en zo ver van nul wordt een BIJNA-tik geweigerd',
        store(A).length === 0 && logRegels('bevestig_bijna_inert').length === 1,
        '0 records, 1 inert-regel',
        store(A).length + ' records, ' + logRegels('bevestig_bijna_inert').length + ' inert');
    // Binnen het venster: fel, en de tik komt er door zonder aiKleur-hulp.
    zetLS('sl_opslaglog', null);
    opzet(A, null, 'rood');
    cdStart = performance.now() - (activeCdDoel - 5) * 1000;   // nog 5s tot nul
    eis('T10 vijf seconden voor nul is BIJNA fel',
        bijnaIsNoOp() === false, 'niet gedempt', 'gedempt=' + bijnaIsNoOp());
    bevestigCountdown('bijna');
    eis('T10b en die tik komt er door zonder dat aiKleur hoeft te helpen',
        store(A).length === 1
        && logRegels('bevestig_bijna_vroeg').length === 0
        && logRegels('bevestig_bijna_inert').length === 0,
        '1 record, geen poortregel',
        store(A).length + ' records, poortregels: '
          + (logRegels('bevestig_bijna_vroeg').length + logRegels('bevestig_bijna_inert').length));
    eis('T10c de blanco-uitzondering is weg — de afstand tot nul beslist overal',
        !/rood-voor-nul/.test(zc(bijnaIsNoOp)) && !/groen-voor-nul/.test(zc(bijnaIsNoOp)),
        'geen toestandsuitzondering meer',
        /voor-nul/.test(zc(bijnaIsNoOp)) ? 'STAAT ER NOG' : 'weg');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    fase = bewaard.fase; faseStart = bewaard.faseStart; cdStart = bewaard.cdStart;
    groenStart = bewaard.groenStart; countdownNulTijd = bewaard.countdownNulTijd;
    cdBereikteNul = bewaard.cdBereikteNul;
    activeCdDoel = bewaard.activeCdDoel; activeCdModus = bewaard.activeCdModus;
    activeCdMin = bewaard.activeCdMin; activeCdMax = bewaard.activeCdMax;
    bevestigActief = bewaard.bevestigActief;
    bevestigVoorNodeId = bewaard.bevestigVoorNodeId;
    bevInertStaat = bewaard.bevInertStaat;
    aiKleur = bewaard.aiKleur; snelheidKmh = bewaard.snelheidKmh;
    laatsteRoodFaseStart = bewaard.laatsteRoodFaseStart;
    bevestigGedaanVoorFase = bewaard.bevestigGedaanVoorFase;
    huidigCdBron = bewaard.huidigCdBron; huidigCdWaarde = bewaard.huidigCdWaarde;
    cdWallStart = bewaard.cdWallStart; cdWallNodeId = bewaard.cdWallNodeId;
    schaduwWaarden = bewaard.schaduwWaarden;
    schaduwCountdownNul = bewaard.schaduwCountdownNul;
    bevestigWrap.className = bewaard.wrapClass;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testBevestigPoort = testBevestigPoort;
