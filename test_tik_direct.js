// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_tik_direct.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.5: een getikte richting wordt geschreven zodra de rode fase
//  afloopt, in plaats van pas na de passage.
//
//  WAT ER OP HET SPEL STAAT
//  De V5-schrijving wachtte op de delayed write, en die wacht 4s bezinktijd
//  (V9_AFRIJ_SETTLE_MS) plus een passagepoort om gpsAfrijRichting te kunnen
//  berekenen. Bij een TIK wordt die waarde nooit gebruikt — r4497 kiest
//  `viaTik ? preAfrij : gpsAfrijRichting`. V11.18.1 telde wat dat kostte: 41
//  kandidaten met een voltooide duurmeting weggegooid in 2,9 dagen, doordat een
//  volgend kruispunt de kandidaat overnam voordat de delayed write kon vuren.
//
//  T3 IS DE KERN — HET GEREDDE SCENARIO
//  Precies het kandidaat_vervangen-geval uit V11.18.1: een kandidaat met een
//  voltooide duur die wordt overgenomen vóórdat de delayed write vuurde. Onder
//  het oude gedrag ging die meting verloren; nu staat ze er al.
//
//  T4 IS DE REGRESSIEWACHT
//  Zonder tik verandert er niets: geen vroege schrijving, de delayed write doet
//  het werk, en de GPS-vergelijking (gps_tik_score) draait zoals altijd.
//
//  T5 BEWAAKT DE EQUIVALENTIE
//  De vroege en de late poort moeten dezelfde tik accepteren. Lopen ze uiteen,
//  dan schrijft de een iets weg dat de ander geweigerd zou hebben en is niet
//  meer na te gaan welke van de twee een record maakte. Sinds V11.18.5 delen ze
//  bepaalGetikteAfrij; T5 toetst dat op de drie herkomsten.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_tik_direct.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testTikDirect().regels);
// ═══════════════════════════════════════════════════════════════

function testTikDirect() {
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

  const NODE = 999501;        // de kandidaat
  const NIEUW = 999502;       // het kruispunt dat hem zou overnemen
  const DD_NU = huidigDDActief();

  const bewaard = {
    v9KandidaatNode, v9KandidaatDuur, v9KandidaatDagdeel, v9KandidaatZagOvergang,
    v9KandidaatV4Geschreven, v9KandidaatV4Stempels,
    v9KandidaatV5Geschreven, v9KandidaatV5Paar,
    v9DelayedWriteActief, v9AanrijHeading, v9AanrijSnelheidHeading,
    v9PreSelectieAfrij, v9PassageStartTijd, afrijHeadingBuffer,
    huidigePos, osmCache, preZet, dichtstbijOSM, huidigeRichting,
    richtingLockKeuze, richtingLockNodeId, richtingLockBron
  };

  // aanrij 0 graden (noord) + tik 'rechts' -> afrij W.
  const V5_SLEUTEL = 'sl_v5_' + NODE + '_N_W_' + DD_NU;

  const v5Records = () => {
    try { return JSON.parse(localStorage.getItem(V5_SLEUTEL)) || []; } catch (e) { return []; }
  };
  const logRegels = (reden) => {
    try {
      return (JSON.parse(localStorage.getItem('sl_opslaglog')) || [])
        .filter(r => r && r.reden === reden);
    } catch (e) { return []; }
  };

  // Een kandidaat waarvan de rode fase zojuist is afgelopen: duur bekend, node
  // vastgeklikt, aanrijheading bevroren. huidigePos valt samen met de node.
  const opzet = (opties) => {
    const o = opties || {};
    for (const a of ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'])
      for (const f of ['N', 'NO', 'O', 'ZO', 'Z', 'ZW', 'W', 'NW'])
        zetLS('sl_v5_' + NODE + '_' + a + '_' + f + '_' + DD_NU, null);
    zetLS('sl_v4_' + NODE + '_' + DD_NU, null);
    zetLS('sl_richting_' + NODE, o.tikOpslag
      ? JSON.stringify({ tikrichting: o.tikOpslag, tik_bevestigingen: 1,
                         headings: [], laatste_update: Date.now(), bevestigingen: 0 })
      : null);
    osmCache = [
      { id: NODE,  lat: 52.0,    lon: 4.7, naam: 'Kandidaat', afstand: 5 },
      { id: NIEUW, lat: 52.0003, lon: 4.7, naam: 'Volgende',  afstand: 33 }
    ];
    huidigePos = { lat: 52.0, lon: 4.7 };
    dichtstbijOSM = osmCache[0];
    v9KandidaatNode = String(NODE);
    v9KandidaatDuur = null;
    v9KandidaatDagdeel = DD_NU;
    v9KandidaatZagOvergang = null;
    v9KandidaatV4Geschreven = false;
    v9KandidaatV4Stempels = [];
    v9KandidaatV5Geschreven = false;
    v9KandidaatV5Paar = null;
    v9DelayedWriteActief = false;
    v9AanrijSnelheidHeading = (o.aanrij !== undefined) ? o.aanrij : 0;
    v9AanrijHeading = v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = (o.pre !== undefined) ? o.pre : 'W';
    v9PassageStartTijd = null;
    afrijHeadingBuffer = [];
    huidigeRichting = 270;
    preZet = o.preZet || null;
    richtingLockKeuze = 'rechts';
    richtingLockNodeId = String(NODE);
    richtingLockBron = 'tik';
  };

  try {
    // ═══ T1 — DE VROEGE SCHRIJVING ═══════════════════════════
    opzet();
    let geschreven = schrijfV5DirectBijGroen(String(NODE), 40, DD_NU, 5, []);
    eis('T1 een getikte richting wordt direct geschreven',
        geschreven === true && v5Records().length === 1,
        'true, 1 V5-record',
        geschreven + ', ' + v5Records().length + ' records');
    eis('T1b het record draagt de duur en de juiste emmer',
        v5Records().length === 1 && v5Records()[0].duur === 40,
        '40s in sl_v5_' + NODE + '_N_W',
        v5Records().length ? (v5Records()[0].duur + 's') : 'geen record');
    eis('T1c er staat een logregel zodat dit in een export telbaar is',
        logRegels('v5_vroeg_geschreven').length >= 1,
        'minstens 1 regel', String(logRegels('v5_vroeg_geschreven').length));
    eis('T1d en de paarsleutel is onthouden voor het rv-stempel',
        v9KandidaatV5Paar === 'N_W', 'N_W', String(v9KandidaatV5Paar));

    // ═══ T2 — DE VLAG EN DE LATE POORT ═══════════════════════
    // De delayed write mag niet nog eens schrijven, maar moet dat wel melden.
    opzet();
    v9KandidaatDuur = 40;
    v9KandidaatV5Geschreven = schrijfV5DirectBijGroen(String(NODE), 40, DD_NU, 5, []);
    eis('T2 de vlag staat na een geslaagde vroege schrijving',
        v9KandidaatV5Geschreven === true, 'true', String(v9KandidaatV5Geschreven));
    const naVroeg = v5Records().length;
    // nu de late keten laten vuren op dezelfde kandidaat
    v9DelayedWriteActief = true;
    v9PassageStartTijd = Date.now();
    const dubbelVoor = logRegels('v5_dubbel_voorkomen').length;
    voerV9DelayedWriteUit(270, 'test', '-', false);
    eis('T2b de delayed write schrijft NIET nog een tweede record',
        v5Records().length === naVroeg,
        naVroeg + ' records (ongewijzigd)', String(v5Records().length));
    eis('T2c maar meldt het wel, zoals v4_dubbel_voorkomen dat doet',
        logRegels('v5_dubbel_voorkomen').length === dubbelVoor + 1,
        (dubbelVoor + 1) + ' regels', String(logRegels('v5_dubbel_voorkomen').length));

    // ═══ T3 — HET GEREDDE SCENARIO UIT V11.18.1 ══════════════
    // De kandidaat wordt overgenomen VOORDAT de delayed write kon vuren. Onder
    // het oude gedrag was de meting weg; nu staat ze er al.
    opzet();
    v9KandidaatDuur = 40;
    v9KandidaatV5Geschreven = schrijfV5DirectBijGroen(String(NODE), 40, DD_NU, 5, []);
    const voorOvername = v5Records().length;
    // precies wat onGPS doet bij een kandidaat-overname (r15040 e.v.)
    v9KandidaatNode = String(NIEUW);
    v9KandidaatDuur = null;
    v9KandidaatV5Geschreven = false;
    v9KandidaatV5Paar = null;
    v9KandidaatV4Geschreven = false;
    v9KandidaatV4Stempels = [];
    eis('T3 de meting overleeft een vroegtijdige kandidaat-overname',
        voorOvername === 1 && v5Records().length === 1,
        '1 record, ook na de overname',
        voorOvername + ' -> ' + v5Records().length + ' records');
    // en de oude route zou hier niets meer opleveren: de duur is weg
    eis('T3b de late keten heeft na de overname geen duur meer — precies het ' +
        'verlies dat V11.18.1 telde',
        v9KandidaatDuur === null && String(v9KandidaatNode) === String(NIEUW),
        'kandidaat verschoven, duur weg',
        'node ' + v9KandidaatNode + ', duur ' + v9KandidaatDuur);
    // v5ZouLukken zou dit geval als 'bruikbaar' hebben geteld: dat is dezelfde
    // populatie die deze release redt.
    opzet();
    const zl = v5ZouLukken(String(NODE), 40);
    eis('T3c v5ZouLukken merkt dit geval aan als bruikbaar — dezelfde populatie',
        zl.ok === true, 'ok', zl.ok + (zl.reden ? (' (' + zl.reden + ')') : ''));

    // ═══ T4 — ZONDER TIK VERANDERT ER NIETS ══════════════════
    opzet({ pre: null, tikOpslag: null, preZet: null });
    geschreven = schrijfV5DirectBijGroen(String(NODE), 40, DD_NU, 5, []);
    eis('T4 zonder tik gebeurt er geen vroege schrijving',
        geschreven === false && v5Records().length === 0,
        'false, 0 records',
        geschreven + ', ' + v5Records().length + ' records');
    eis('T4b en de vlag blijft uit, dus de delayed write doet gewoon zijn werk',
        v9KandidaatV5Geschreven === false, 'false', String(v9KandidaatV5Geschreven));
    // De late keten meldt dan nog steeds v5_geen_tik, zoals altijd.
    opzet({ pre: null, tikOpslag: null, preZet: null });
    v9KandidaatDuur = 40;
    v9DelayedWriteActief = true;
    v9PassageStartTijd = Date.now();
    const geenTikVoor = logRegels('v5_geen_tik').length;
    voerV9DelayedWriteUit(270, 'test', '-', false);
    eis('T4c de late keten meldt nog steeds v5_geen_tik zonder tik',
        logRegels('v5_geen_tik').length === geenTikVoor + 1,
        (geenTikVoor + 1) + ' regels', String(logRegels('v5_geen_tik').length));
    eis('T4d en schrijft geen V5-record op de GPS-richting',
        v5Records().length === 0, '0 records', String(v5Records().length));

    // ═══ T5 — VROEG EN LAAT ACCEPTEREN DEZELFDE TIK ══════════
    // Alle drie de herkomsten die bepaalGetikteAfrij kent.
    opzet();
    const kaal = bepaalGetikteAfrij(String(NODE), 0);
    eis('T5 de kale pre-selectie wordt herkend',
        kaal && kaal.afrij === 'W' && kaal.bron === 'pre',
        'W via pre', kaal ? (kaal.afrij + ' via ' + kaal.bron) : 'null');
    // late conversie: tikRichting bewaarde een tekstlabel omdat er bij stilstand
    // nog geen heading was — bij een koude start voor rood is dat de regel.
    opzet({ pre: 'rechts' });
    const laat = bepaalGetikteAfrij(String(NODE), 0);
    eis('T5b een tekstlabel wordt alsnog omgezet (V11.17.38 A3)',
        laat && laat.afrij === 'W' && laat.bron === 'laat_omgezet',
        'W via laat_omgezet', laat ? (laat.afrij + ' via ' + laat.bron) : 'null');
    // terugval op sl_richting_ (V11.17.56 R5)
    opzet({ pre: null, tikOpslag: 'rechts', preZet: { node: String(NODE) } });
    const herst = bepaalGetikteAfrij(String(NODE), 0);
    eis('T5c de sl_richting_-terugval werkt (V11.17.56 R5)',
        herst && herst.afrij === 'W' && herst.bron === 'hersteld',
        'W via hersteld', herst ? (herst.afrij + ' via ' + herst.bron) : 'null');
    // en de guard: een tik van een ANDERE node mag hier nooit landen
    opzet({ pre: null, tikOpslag: 'rechts', preZet: { node: String(NIEUW) } });
    eis('T5d een tik van een andere node wordt niet overgenomen',
        bepaalGetikteAfrij(String(NODE), 0) === null, 'null',
        JSON.stringify(bepaalGetikteAfrij(String(NODE), 0)));
    // de late keten leest dezelfde functie, dus kan niet uit de pas lopen
    eis('T5e voerV9DelayedWriteUit gebruikt dezelfde resolver',
        String(voerV9DelayedWriteUit).includes('bepaalGetikteAfrij'),
        'aanroep aanwezig', 'ONTBREEKT');

    // ═══ T6 — WAT ER NIET VERVALT ════════════════════════════
    // De duurgrenzen van slaOpV5 gelden onverkort op het vroege pad.
    opzet();
    geschreven = schrijfV5DirectBijGroen(String(NODE), 2, DD_NU, 5, []);   // < V5_MIN_DUUR_S
    eis('T6 een te korte duur levert ook vroeg geen record op',
        v5Records().length === 0, '0 records', String(v5Records().length));
    opzet();
    schrijfV5DirectBijGroen(String(NODE), 500, DD_NU, 5, []);              // > V5_MAX_DUUR_S
    eis('T6b een te lange duur evenmin',
        v5Records().length === 0, '0 records', String(v5Records().length));
    // Het afstandsgewicht volgt dezelfde drempel als de delayed write.
    opzet();
    schrijfV5DirectBijGroen(String(NODE), 40, DD_NU, 20, []);   // < V9_DICHTBIJ_AFSTAND
    const dichtbij = v5Records()[0];
    opzet();
    schrijfV5DirectBijGroen(String(NODE), 40, DD_NU, 60, []);   // > V9_DICHTBIJ_AFSTAND
    const ver = v5Records()[0];
    eis('T6c het afstandsgewicht volgt V9_DICHTBIJ_AFSTAND, net als de late keten',
        dichtbij && ver && dichtbij.gewicht === V9_GEWICHT_DICHTBIJ
          && ver.gewicht === V9_GEWICHT_VER,
        V9_GEWICHT_DICHTBIJ + ' dichtbij, ' + V9_GEWICHT_VER + ' ver',
        (dichtbij ? dichtbij.gewicht : '?') + ' / ' + (ver ? ver.gewicht : '?'));
    // Zonder aanrijheading kan de afrij niet berekend worden — dan niets doen en
    // de late keten zijn werk laten doen (die heeft de terugval op r4520).
    opzet({ aanrij: null });
    v9AanrijHeading = null; v9AanrijSnelheidHeading = null;
    eis('T6d zonder aanrijheading schrijft de vroege poort niets',
        schrijfV5DirectBijGroen(String(NODE), 40, DD_NU, 5, []) === false
          && v5Records().length === 0,
        'false, 0 records', String(v5Records().length) + ' records');

    // ═══ T7 — HET RV-STEMPEL REIST MEE ═══════════════════════
    // Zonder stempel zou een kandidaat die daarna wordt overgenomen een
    // V5-record hebben met ONGESTEMPELDE V4-records ernaast — de wezen die
    // V11.17.92 met terugwerkende kracht moest repareren.
    opzet();
    const nu = Date.now();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify([
      { duur: 40, tijd: nu, gewicht: 1, obs: 40, bron: 's1' },
      { duur: 38, tijd: nu - 60000, gewicht: 1, obs: 38, bron: 's1' }
    ]));
    schrijfV5DirectBijGroen(String(NODE), 40, DD_NU, 5, [{ dd: DD_NU, tijd: nu }]);
    let v4na = [];
    try { v4na = JSON.parse(localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU)) || []; } catch (e) {}
    const gestempeld = v4na.filter(x => x.rv === 1);
    eis('T7 het bijbehorende V4-record wordt meteen als richting-verwant gemerkt',
        gestempeld.length === 1 && gestempeld[0].tijd === nu,
        '1 gestempeld record', gestempeld.length + ' gestempeld');
    eis('T7b met de paarsleutel van de emmer die werkelijk geschreven is',
        gestempeld.length === 1 && gestempeld[0].rvK === 'N_W',
        'rvK N_W', gestempeld.length ? String(gestempeld[0].rvK) : 'geen');
    eis('T7c en het andere record blijft ongemoeid',
        v4na.filter(x => x.rv !== 1).length === 1,
        '1 ongestempeld record', String(v4na.filter(x => x.rv !== 1).length));

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    v9KandidaatNode = bewaard.v9KandidaatNode;
    v9KandidaatDuur = bewaard.v9KandidaatDuur;
    v9KandidaatDagdeel = bewaard.v9KandidaatDagdeel;
    v9KandidaatZagOvergang = bewaard.v9KandidaatZagOvergang;
    v9KandidaatV4Geschreven = bewaard.v9KandidaatV4Geschreven;
    v9KandidaatV4Stempels = bewaard.v9KandidaatV4Stempels;
    v9KandidaatV5Geschreven = bewaard.v9KandidaatV5Geschreven;
    v9KandidaatV5Paar = bewaard.v9KandidaatV5Paar;
    v9DelayedWriteActief = bewaard.v9DelayedWriteActief;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = bewaard.v9PreSelectieAfrij;
    v9PassageStartTijd = bewaard.v9PassageStartTijd;
    afrijHeadingBuffer = bewaard.afrijHeadingBuffer;
    huidigePos = bewaard.huidigePos;
    osmCache = bewaard.osmCache;
    preZet = bewaard.preZet;
    dichtstbijOSM = bewaard.dichtstbijOSM;
    huidigeRichting = bewaard.huidigeRichting;
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingLockBron = bewaard.richtingLockBron;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testTikDirect = testTikDirect;
