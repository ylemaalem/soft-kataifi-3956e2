// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_kandidaat_verlies.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.1: meten hoeveel van de weggegooide kandidaat-metingen bij
//  een vroegtijdige node-overname daadwerkelijk een geldig V5-record zouden
//  hebben opgeleverd.
//
//  WAAROM DEZE METING BESTAAT
//  Op de export van 28 augustus werden in 2,9 dagen 41 kandidaten met een
//  voltooide meting weggegooid, tegenover 85 geslaagde V4-schrijvingen. Dat
//  verklaart waarom V5 niet groeit — 1055 V4-metingen tegenover 167 V5 op
//  dezelfde 112 kruispunten. Wat ontbreekt is of die 41 er ook echt een
//  richting-record van gemaakt zouden hebben; pas met dat getal is te
//  beoordelen of het repareren van de overname loont.
//
//  DE BELANGRIJKSTE TOETS IS T4 — DE EQUIVALENTIE
//  v5ZouLukken is een tweede beoordeling van dezelfde poorten die
//  voerV9DelayedWriteUit toepast. Twee beoordelingen kunnen uit de pas gaan
//  lopen, en dan meet deze release stilzwijgend iets anders dan ze belooft.
//  T4 draait daarom BEIDE op dezelfde toestand en eist dat hun uitkomst
//  overeenkomt: zegt v5ZouLukken 'ok', dan moet de echte keten een V5-record
//  schrijven, en omgekeerd.
//
//  PUUR OBSERVEREND
//  T5 is de regressiewacht: de kandidaat wordt nog steeds precies zo vervangen
//  als voorheen, en de bestaande kandidaat_vervangen-regel blijft ongewijzigd.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_kandidaat_verlies.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testKandidaatVerlies().regels);
// ═══════════════════════════════════════════════════════════════

function testKandidaatVerlies() {
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

  const NODE = 999101;        // de kandidaat die we verliezen
  const NIEUW = 999102;       // het kruispunt dat hem overneemt
  const DD_NU = huidigDDActief();

  const bewaard = {
    v9KandidaatNode, v9KandidaatDuur, v9KandidaatDagdeel, v9KandidaatZagOvergang,
    v9KandidaatV4Geschreven, v9KandidaatV4Stempels, v9DelayedWriteActief,
    v9AanrijHeading, v9AanrijSnelheidHeading, v9PreSelectieAfrij, v9PassageStartTijd,
    afrijHeadingBuffer, huidigePos, osmCache, preZet, dichtstbijOSM,
    richtingLockKeuze, richtingLockNodeId, richtingLockBron, huidigeRichting
  };

  const logRegels = (reden) => {
    try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r.reden === reden); }
    catch (e) { return []; }
  };

  // Een kandidaat met een voltooide meting, klaar om overgenomen te worden.
  // aanrij 0 graden (noord), tik rechtsaf -> afrij W. huidigePos valt samen met
  // de node, dus de 80m-poort staat wijd open tenzij een toets hem verzet.
  const opzet = (opties) => {
    const o = opties || {};
    osmCache = [
      { id: NODE,  lat: 52.0,       lon: 4.7, naam: 'Kandidaat', afstand: 5 },
      { id: NIEUW, lat: 52.0003,    lon: 4.7, naam: 'Volgende',  afstand: 33 }
    ];
    huidigePos = { lat: (o.lat != null) ? o.lat : 52.0, lon: 4.7 };
    v9KandidaatNode = String(NODE);
    v9KandidaatDuur = (o.duur !== undefined) ? o.duur : 40;
    v9KandidaatDagdeel = DD_NU;
    v9KandidaatZagOvergang = null;
    v9KandidaatV4Geschreven = true;      // V4 stond er al; alleen V5 staat op het spel
    v9KandidaatV4Stempels = [];
    v9DelayedWriteActief = false;
    v9AanrijSnelheidHeading = (o.aanrij !== undefined) ? o.aanrij : 0;
    v9AanrijHeading = v9AanrijSnelheidHeading;
    v9PreSelectieAfrij = (o.pre !== undefined) ? o.pre : 'W';   // noord + rechtsaf
    v9PassageStartTijd = Date.now();
    afrijHeadingBuffer = [];
    huidigeRichting = 270;               // rijdt naar het westen na de bocht
    preZet = null;
    wisRichtingLock();
    dichtstbijOSM = osmCache[1];
    zetLS('sl_opslaglog', null);
    for (const d of Object.keys(DD)) {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
      }
    }
    zetLS('sl_richting_' + NODE, null);
  };

  const v5Records = () => {
    let n = 0;
    for (const k of Object.keys(localStorage)) {
      if (!k.startsWith('sl_v5_' + NODE + '_')) continue;
      try { n += (JSON.parse(localStorage.getItem(k)) || []).length; } catch (e) {}
    }
    return n;
  };

  try {
    // ══ T1 — DE POORTEN, LOS BEOORDEELD ═══════════════════════
    opzet();
    const goed = v5ZouLukken(NODE, 40);
    eis('T1 een complete kandidaat haalt alle vier de poorten',
        goed.ok === true && goed.reden === null && goed.aanrij === 'N' && goed.afrij === 'W',
        'ok, aanrij N, afrij W',
        JSON.stringify({ ok: goed.ok, reden: goed.reden, aanrij: goed.aanrij, afrij: goed.afrij }));

    opzet({ aanrij: null });
    eis('T1b zonder aanrijheading valt hij op geen_aanrij',
        v5ZouLukken(NODE, 40).reden === 'geen_aanrij', 'geen_aanrij',
        String(v5ZouLukken(NODE, 40).reden));

    opzet({ pre: null });
    eis('T1c zonder getikte richting valt hij op v5_geen_tik',
        v5ZouLukken(NODE, 40).reden === 'v5_geen_tik', 'v5_geen_tik',
        String(v5ZouLukken(NODE, 40).reden));

    // Ruim buiten de leerafstand: 52.0 -> 52.0012 is ongeveer 133 meter.
    opzet({ lat: 52.0012 });
    const ver = v5ZouLukken(NODE, 40);
    eis('T1d buiten V9_MAX_LEER_AFSTAND valt hij op te_ver_dw',
        ver.reden === 'te_ver_dw' && ver.afst > V9_MAX_LEER_AFSTAND,
        'te_ver_dw, afstand > ' + V9_MAX_LEER_AFSTAND,
        ver.reden + ', ' + Math.round(ver.afst) + 'm');

    opzet();
    eis('T1e een te korte of te lange duur valt op v5_guard',
        v5ZouLukken(NODE, V5_MIN_DUUR_S - 1).reden === 'v5_guard'
        && v5ZouLukken(NODE, V5_MAX_DUUR_S + 1).reden === 'v5_guard',
        '2x v5_guard',
        v5ZouLukken(NODE, 3).reden + ' / ' + v5ZouLukken(NODE, 181).reden);
    eis('T1f en precies op de grenzen komt hij er nog doorheen',
        v5ZouLukken(NODE, V5_MIN_DUUR_S).ok === true
        && v5ZouLukken(NODE, V5_MAX_DUUR_S).ok === true,
        'beide ok',
        v5ZouLukken(NODE, V5_MIN_DUUR_S).ok + ' / ' + v5ZouLukken(NODE, V5_MAX_DUUR_S).ok);

    // ══ T2 — GEEN LOSSE KOPIE VAN DE DREMPELS ═════════════════
    // De duurgrenzen wonen sinds deze release op één plek. Zou iemand er in
    // slaOpV5 weer een kaal getal van maken, dan meet v5ZouLukken iets anders
    // dan de app doet — en dat is precies de fout die deze release niet mag maken.
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T2 slaOpV5 toetst op de gedeelde constanten, niet op kale getallen',
        /V5_MIN_DUUR_S/.test(zc(slaOpV5)) && /V5_MAX_DUUR_S/.test(zc(slaOpV5)),
        'beide constanten',
        [/V5_MIN_DUUR_S/.test(zc(slaOpV5)) ? 'min' : 'MIN KAAL',
         /V5_MAX_DUUR_S/.test(zc(slaOpV5)) ? 'max' : 'MAX KAAL'].join(' + '));
    eis('T2b en v5ZouLukken leest dezelfde twee',
        /V5_MIN_DUUR_S/.test(zc(v5ZouLukken)) && /V5_MAX_DUUR_S/.test(zc(v5ZouLukken)),
        'beide constanten', 'beide constanten');
    eis('T2c de leerafstand komt ook uit de gedeelde constante',
        /V9_MAX_LEER_AFSTAND/.test(zc(v5ZouLukken))
        && /V9_MAX_LEER_AFSTAND/.test(zc(voerV9DelayedWriteUit)),
        'beide V9_MAX_LEER_AFSTAND', 'beide');
    eis('T2d en de richtingafleiding gebruikt dezelfde functies',
        /gpsHeadingNaarWindrichting/.test(zc(v5ZouLukken))
        && /berekenAfrijRichtingViaTik/.test(zc(v5ZouLukken)),
        'beide functies', 'beide functies');

    // ══ T3 — DE LOGREGEL OP HET VERLIESMOMENT ═════════════════
    // updateDichtbij aanroepen is te veel state; de tak zelf is hier nagebootst
    // met exact dezelfde aanroep als in de code staat.
    const simuleerOvername = (afstNieuw) => {
      zetLS('sl_opslaglog', null);
      logOpslagMis('kandidaat_vervangen', {
        node: v9KandidaatNode, dur: v9KandidaatDuur, nieuw: String(NIEUW) });
      if (v9KandidaatDuur) {
        const _zl = v5ZouLukken(v9KandidaatNode, v9KandidaatDuur);
        logOpslagMis(_zl.ok ? 'kandidaat_verloren_bruikbaar' : 'kandidaat_verloren_onbruikbaar', {
          node: v9KandidaatNode, nieuw: String(NIEUW), dur: v9KandidaatDuur,
          afst: _zl.afst, nieuwAf: afstNieuw, v5Reden: _zl.reden,
          aanrij: _zl.aanrij || null, afrij: _zl.afrij || null });
      }
    };
    opzet();
    simuleerOvername(33);
    const br = logRegels('kandidaat_verloren_bruikbaar');
    eis('T3 een bruikbaar verlies wordt als bruikbaar gelogd',
        br.length === 1 && logRegels('kandidaat_verloren_onbruikbaar').length === 0,
        '1 bruikbaar, 0 onbruikbaar',
        br.length + ' / ' + logRegels('kandidaat_verloren_onbruikbaar').length);
    eis('T3b met node, nieuwe node, duur en beide afstanden',
        br[0] && String(br[0].node) === String(NODE) && String(br[0].nieuw) === String(NIEUW)
        && br[0].dur === 40 && br[0].nieuwAf === 33 && br[0].afst != null,
        'node/nieuw/40/33/afst',
        br[0] ? [br[0].node, br[0].nieuw, br[0].dur, br[0].nieuwAf, br[0].afst].join('/') : 'GEEN REGEL');
    eis('T3c en zonder faalreden, want hij zou geslaagd zijn',
        br[0] && br[0].v5Reden === null && br[0].aanrij === 'N' && br[0].afrij === 'W',
        'v5Reden null, N>W',
        br[0] ? br[0].v5Reden + ', ' + br[0].aanrij + '>' + br[0].afrij : 'GEEN REGEL');

    opzet({ lat: 52.0012 });          // te ver weg
    simuleerOvername(33);
    const onbr = logRegels('kandidaat_verloren_onbruikbaar');
    eis('T3d een verlies dat toch was afgewezen wordt als onbruikbaar gelogd',
        onbr.length === 1 && logRegels('kandidaat_verloren_bruikbaar').length === 0,
        '1 onbruikbaar, 0 bruikbaar',
        onbr.length + ' / ' + logRegels('kandidaat_verloren_bruikbaar').length);
    eis('T3e met de poort die hem zou hebben geveld',
        onbr[0] && onbr[0].v5Reden === 'te_ver_dw',
        "'te_ver_dw'", onbr[0] ? String(onbr[0].v5Reden) : 'GEEN REGEL');

    // Zonder voltooide meting: alleen de bestaande regel, geen nieuwe.
    opzet({ duur: null });
    simuleerOvername(33);
    eis('T3f zonder voltooide meting komt er geen verliesregel bij',
        logRegels('kandidaat_verloren_bruikbaar').length === 0
        && logRegels('kandidaat_verloren_onbruikbaar').length === 0
        && logRegels('kandidaat_vervangen').length === 1,
        'alleen kandidaat_vervangen',
        logRegels('kandidaat_vervangen').length + ' vervangen, '
          + (logRegels('kandidaat_verloren_bruikbaar').length
             + logRegels('kandidaat_verloren_onbruikbaar').length) + ' verlies');
    // De twee nieuwe velden blijven leeg op elke andere regel.
    zetLS('sl_opslaglog', null);
    logOpslagMis('te_kort', { node: NODE, dur: 2 });
    const ander = logRegels('te_kort')[0];
    eis('T3g nieuwAf en v5Reden blijven null op elke andere logregel',
        ander && ander.nieuwAf === null && ander.v5Reden === null,
        '2x null', ander ? ander.nieuwAf + '/' + ander.v5Reden : 'GEEN REGEL');

    // ══ T4 — EQUIVALENTIE MET DE ECHTE KETEN ══════════════════
    // De kern van deze suite: zegt v5ZouLukken 'ok', dan moet de echte keten
    // een V5-record schrijven — en andersom. Zonder deze toets kunnen de twee
    // beoordelingen uit elkaar lopen en meet deze release iets anders dan ze zegt.
    const echteKeten = (opties) => {
      opzet(opties);
      const voorspeld = v5ZouLukken(NODE, v9KandidaatDuur);
      v9DelayedWriteActief = true;                 // de keten mag lopen
      const voor = v5Records();
      voerV9DelayedWriteUit(270, 'test', '-', false);
      return { voorspeld: voorspeld.ok, reden: voorspeld.reden, geschreven: v5Records() > voor };
    };
    const gevallen = [
      { naam: 'compleet',            opt: {} },
      { naam: 'geen tik',            opt: { pre: null } },
      { naam: 'te ver weg',          opt: { lat: 52.0012 } },
      { naam: 'duur te kort',        opt: { duur: 3 } },
      { naam: 'duur te lang',        opt: { duur: 181 } },
      { naam: 'tik als tekstlabel',  opt: { pre: 'rechts' } }
    ];
    const mis = [];
    for (const g of gevallen) {
      const r = echteKeten(g.opt);
      if (r.voorspeld !== r.geschreven) {
        mis.push(g.naam + ': voorspeld ' + r.voorspeld + ', werkelijk ' + r.geschreven
                 + (r.reden ? ' (' + r.reden + ')' : ''));
      }
    }
    eis('T4 v5ZouLukken voorspelt in alle zes de gevallen wat de echte keten doet',
        mis.length === 0, '6 van 6 gelijk',
        mis.length ? mis.join(' | ') : '6 van 6 gelijk');
    // En expliciet het positieve geval, zodat een suite die overal false
    // voorspelt niet per ongeluk groen is.
    const compleet = echteKeten({});
    eis('T4b het complete geval schrijft daadwerkelijk een V5-record',
        compleet.voorspeld === true && compleet.geschreven === true,
        'voorspeld en geschreven',
        compleet.voorspeld + ' / ' + compleet.geschreven);

    // ══ T5 — REGRESSIEWACHT: ER VERANDERT NIETS ═══════════════
    // De meting hangt binnen de bestaande if, na de bestaande logregel, en
    // raakt geen enkele toewijzing.
    // De tak woont in onGPS (r14532), niet in updateDichtbij — die laatste is de
    // node-SELECTIE, dit is de kandidaat-administratie erna.
    const bron = zc(onGPS);
    eis('T5 de bestaande kandidaat_vervangen-regel staat er ongewijzigd',
        /logOpslagMis\('kandidaat_vervangen', \{\s*node: v9KandidaatNode, dur: v9KandidaatDuur, nieuw: nodeId \}\)/
          .test(bron.replace(/\s+/g, ' ')),
        'ongewijzigd',
        /kandidaat_vervangen/.test(bron) ? 'aanwezig' : 'WEG');
    eis('T5b de overname zelf is ongewijzigd: node overgenomen, duur gewist',
        /v9KandidaatNode = nodeId;/.test(bron) && /v9KandidaatDuur = null;/.test(bron),
        'beide toewijzingen',
        [/v9KandidaatNode = nodeId;/.test(bron) ? 'node' : 'ONTBREEKT',
         /v9KandidaatDuur = null;/.test(bron) ? 'duur' : 'ONTBREEKT'].join(' + '));
    eis('T5c v5ZouLukken schrijft zelf nergens naar de opslag',
        !/setItem|removeItem|slaOp/.test(zc(v5ZouLukken)),
        'alleen lezen',
        /setItem|removeItem|slaOp/.test(zc(v5ZouLukken)) ? 'SCHRIJFT' : 'alleen lezen');
    // En gedrag: de functie laat de V9-staat met rust.
    opzet();
    const voorStaat = JSON.stringify([v9KandidaatNode, v9KandidaatDuur, v9PreSelectieAfrij,
                                      v9AanrijHeading, v9DelayedWriteActief]);
    v5ZouLukken(NODE, 40);
    eis('T5d en laat de kandidaat-staat onaangeroerd',
        JSON.stringify([v9KandidaatNode, v9KandidaatDuur, v9PreSelectieAfrij,
                        v9AanrijHeading, v9DelayedWriteActief]) === voorStaat,
        'identiek', 'identiek');

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
    richtingLockKeuze = bewaard.richtingLockKeuze;
    richtingLockNodeId = bewaard.richtingLockNodeId;
    richtingLockBron = bewaard.richtingLockBron;
    huidigeRichting = bewaard.huidigeRichting;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testKandidaatVerlies = testKandidaatVerlies;
