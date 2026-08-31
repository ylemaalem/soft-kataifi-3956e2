// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_richting.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Regressietest bij V11.17.70: de richtingconventie en de eenmalige correctie
//  van de records die er vóór V11.17.24 naast zaten.
//
//  WAAROM DIT BESTAND BESTAAT
//  De conventiefout van V11.17.24 (ae892cf) was één ontbrekende +180 op de
//  GPS-route: rechtdoor werd 'Terug' en links/rechts wisselden om. De fix was
//  één regel — en niets bewaakte hem. De conventie stond bovendien op zes
//  plekken in het bestand, waarvan er maar één een functie was.
//
//  T1 is de kern: voor ALLE 360 headings x 3 tikrichtingen moet de omgekeerde
//  afleiding (rijdersPijlLabel) precies terugkomen op de richting waarmee de
//  voorwaartse afleiding (berekenAfrijRichtingViaTik) begon. Zolang die
//  rondgang sluit, kunnen de twee implementaties niet uiteenlopen.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_richting.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRichting().regels);
// ═══════════════════════════════════════════════════════════════

function testRichting() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const LABEL = { rechtdoor: 'Rechtdoor', links: 'Linksaf', rechts: 'Rechtsaf' };

  // ══ T1 — de rondgang sluit voor elke heading ═════════════════
  let mislukt = [];
  for (let h = 0; h < 360; h++) {
    for (const r of ['rechtdoor', 'links', 'rechts']) {
      const aanrij = gpsHeadingNaarWindrichting(h);
      const afrij  = berekenAfrijRichtingViaTik(h, r);
      const terug  = rijdersPijlLabel(aanrij, afrij).tekst;
      if (terug !== LABEL[r]) mislukt.push(h + '° ' + r + ' -> (' + aanrij + ',' + afrij + ') = ' + terug);
    }
  }
  eis('T1 heen en terug sluit voor alle 360 headings x 3 richtingen',
      mislukt.length === 0, '1080 van 1080 kloppen',
      mislukt.length ? (mislukt.length + ' mislukt, eerste: ' + mislukt[0]) : '1080 van 1080');

  // ══ T2 — de drie hoeken zijn wat ze horen te zijn ════════════
  const hoeken = {};
  for (const r of ['links', 'rechtdoor', 'rechts']) {
    const s = new Set();
    for (let h = 0; h < 360; h += 7) s.add(v5HoekVerschil(gpsHeadingNaarWindrichting(h), berekenAfrijRichtingViaTik(h, r)));
    hoeken[r] = [...s];
  }
  eis('T2 links=90, rechtdoor=180, rechts=270, altijd precies één waarde',
      hoeken.links.length === 1 && hoeken.links[0] === 90 &&
      hoeken.rechtdoor.length === 1 && hoeken.rechtdoor[0] === 180 &&
      hoeken.rechts.length === 1 && hoeken.rechts[0] === 270,
      'links 90, rechtdoor 180, rechts 270',
      'links ' + hoeken.links + ', rechtdoor ' + hoeken.rechtdoor + ', rechts ' + hoeken.rechts);

  eis('T2b een tik kan NOOIT hoek 0, 45, 135, 225 of 315 opleveren',
      ![0, 45, 135, 225, 315].some(x => [].concat(hoeken.links, hoeken.rechtdoor, hoeken.rechts).includes(x)),
      'geen van die hoeken', JSON.stringify(hoeken));

  // ══ T3 — tegenover is exact en een involutie ═════════════════
  const W = ['N','NO','O','ZO','Z','ZW','W','NW'];
  eis('T3 tegenover(tegenover(x)) === x voor alle acht',
      W.every(w => windrichtingTegenover(windrichtingTegenover(w)) === w),
      'alle acht', W.map(w => w + '->' + windrichtingTegenover(w)).join(' '));
  eis('T3b tegenover komt overeen met +180 graden',
      W.every((w, i) => windrichtingTegenover(w) === gpsHeadingNaarWindrichting(i * 45 + 180)),
      'alle acht gelijk aan windrichting(i*45+180)', 'ok');

  // ══ T4 — de correctie op de voorbeelden uit commit ae892cf ═══
  const uitCommit = [
    ['Z', 'Z', 'Rechtdoor'],   // rechtdoor (180,180) stond als Terug
    ['Z', 'W', 'Rechtsaf'],    // rechtsaf  (180,270) stond als Linksaf
    ['Z', 'O', 'Linksaf']      // linksaf   (180, 90) stond als Rechtsaf
  ];
  const fout4 = uitCommit.filter(([a, b, verw]) => rijdersPijlLabel(a, windrichtingTegenover(b)).tekst !== verw);
  eis('T4 de drie voorbeelden uit ae892cf worden correct hersteld',
      fout4.length === 0, 'alle drie',
      uitCommit.map(([a, b, v]) => '(' + a + ',' + b + ')->' + rijdersPijlLabel(a, windrichtingTegenover(b)).tekst).join('  '));

  // ══ T5-T8 — de migratie zelf ════════════════════════════════
  const N = '990001';
  const sleutels = {
    hoek0:   'sl_v5_' + N + '_Z_Z_dag',      // besmet, moet naar _Z_N_
    hoek45:  'sl_v5_' + N + '_N_NO_dag',     // besmet maar onzeker: markeren
    hoek90:  'sl_v5_' + N + '_O_Z_dag',      // O->Z = 90 graden; kan van een tik komen: met rust laten
    hoek180: 'sl_v5_' + N + '_W_O_dag',      // idem
    doel0:   'sl_v5_' + N + '_Z_N_dag'
  };
  const bewaard = {};
  for (const k of Object.values(sleutels)) bewaard[k] = localStorage.getItem(k);
  const bewaardVlag = localStorage.getItem('sl_afrijmig_v1');
  const opruimen = () => {
    for (const k of Object.values(sleutels)) {
      if (bewaard[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, bewaard[k]);
    }
    if (bewaardVlag === null) localStorage.removeItem('sl_afrijmig_v1');
    else localStorage.setItem('sl_afrijmig_v1', bewaardVlag);
  };

  try {
    // fixture-controle: de sleutels moeten de hoeken hebben die hun naam belooft.
    // (O->ZO is 45 graden, niet 90 — die vergissing kostte een testronde.)
    eis('T4b de testfixtures hebben de bedoelde hoeken',
        v5HoekVerschil('Z','Z') === 0 && v5HoekVerschil('N','NO') === 45
        && v5HoekVerschil('O','Z') === 90 && v5HoekVerschil('W','O') === 180,
        '0 / 45 / 90 / 180',
        [v5HoekVerschil('Z','Z'), v5HoekVerschil('N','NO'),
         v5HoekVerschil('O','Z'), v5HoekVerschil('W','O')].join(' / '));
    const rec = (duur, tijd) => ({ duur, tijd, gewicht: 1.0 });
    localStorage.setItem(sleutels.hoek0,   JSON.stringify([rec(40, 1000), rec(42, 2000)]));
    localStorage.setItem(sleutels.hoek45,  JSON.stringify([rec(30, 3000)]));
    localStorage.setItem(sleutels.hoek90,  JSON.stringify([rec(20, 4000)]));
    localStorage.setItem(sleutels.hoek180, JSON.stringify([rec(25, 5000)]));
    localStorage.setItem(sleutels.doel0,   JSON.stringify([rec(38, 6000)]));  // bestaat al -> samenvoegen
    localStorage.removeItem('sl_afrijmig_v1');

    migratieAfrijConventie();

    const lees = k => { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } };
    const doel = lees(sleutels.doel0);
    eis('T5 hoek 0 verhuisd en samengevoegd met de bestaande sleutel',
        localStorage.getItem(sleutels.hoek0) === null && Array.isArray(doel) && doel.length === 3,
        'bron weg, doel 3 records', 'bron=' + (localStorage.getItem(sleutels.hoek0) === null ? 'weg' : 'ER NOG')
          + ', doel=' + (doel ? doel.length : 'null'));
    eis('T5b verhuisde records dragen conv=gecorrigeerd, het bestaande record niet',
        doel && doel.filter(r => r.conv === 'gecorrigeerd').length === 2
            && doel.filter(r => r.conv === undefined).length === 1,
        '2 gecorrigeerd, 1 ongemoeid',
        doel ? doel.map(r => r.duur + ':' + (r.conv || '-')).join(' ') : '-');

    const h45 = lees(sleutels.hoek45);
    eis('T6 hoek 45 blijft staan en is alleen gemarkeerd',
        Array.isArray(h45) && h45.length === 1 && h45[0].conv === 'onzeker',
        'sleutel bestaat nog, conv=onzeker',
        h45 ? ('n=' + h45.length + ', conv=' + h45[0].conv) : 'WEG');

    const h90 = lees(sleutels.hoek90), h180 = lees(sleutels.hoek180);
    eis('T7 hoek 90 en 180 volledig ongemoeid',
        Array.isArray(h90) && h90.length === 1 && h90[0].conv === undefined &&
        Array.isArray(h180) && h180.length === 1 && h180[0].conv === undefined,
        'beide onaangeraakt',
        'h90=' + (h90 ? h90[0].conv || 'schoon' : 'WEG') + ', h180=' + (h180 ? h180[0].conv || 'schoon' : 'WEG'));

    // idempotent: nog een keer draaien mag niets meer doen
    const voorTweede = localStorage.getItem(sleutels.doel0);
    migratieAfrijConventie();
    eis('T8 tweede aanroep doet niets (vlag gezet)',
        localStorage.getItem(sleutels.doel0) === voorTweede
        && localStorage.getItem('sl_afrijmig_v1') === 'done',
        'ongewijzigd, vlag done',
        localStorage.getItem(sleutels.doel0) === voorTweede ? 'ongewijzigd' : 'GEWIJZIGD');
  } finally {
    opruimen();
  }

  // ══ T9 — het bron-veld op nieuwe records ════════════════════
  const nk = 'sl_v5_990002_N_Z_dag';
  const nkBewaard = localStorage.getItem(nk);
  try {
    localStorage.removeItem(nk);
    slaOpV5('990002', 'N', 'Z', 'dag', 40, 1.0);
    let r = null; try { r = (JSON.parse(localStorage.getItem(nk)) || [])[0]; } catch(e) {}
    eis('T9 nieuw V5-record draagt bron=tik',
        r && r.bron === 'tik', "bron 'tik'", r ? ('bron=' + r.bron) : 'geen record');
  } finally {
    if (nkBewaard === null) localStorage.removeItem(nk); else localStorage.setItem(nk, nkBewaard);
  }

  // ══ T10 — het signaal bij de knop ═══════════════════════════
  const tk = 'sl_v5_990003_N_Z_dag';
  const tkBewaard = localStorage.getItem(tk);
  const bewaardLock = richtingLockKeuze, bewaardPre = v9PreSelectieAfrij;
  const bewaardAanrij = v9AanrijHeading, bewaardSnelh = v9AanrijSnelheidHeading;
  try {
    localStorage.setItem(tk, JSON.stringify([{ duur: 40, tijd: Date.now(), gewicht: 1 },
                                             { duur: 41, tijd: Date.now(), gewicht: 1 }]));
    richtingLockKeuze = 'rechtdoor';
    v9AanrijHeading = 0; v9AanrijSnelheidHeading = 0;      // N
    v9PreSelectieAfrij = berekenAfrijRichtingViaTik(0, 'rechtdoor');   // Z
    bepaalRichtingTekort('990003');
    eis('T10 bij n=2 meldt de app dat er nog 3 nodig zijn',
        richtingTekort && richtingTekort.nog === V9_MIN_METINGEN - 2,
        'nog ' + (V9_MIN_METINGEN - 2),
        richtingTekort ? ('nog ' + richtingTekort.nog) : 'geen tekort gemeld');

    const vol = []; for (let i = 0; i < V9_MIN_METINGEN; i++) vol.push({ duur: 40, tijd: Date.now() - i, gewicht: 1 });
    localStorage.setItem(tk, JSON.stringify(vol));
    bepaalRichtingTekort('990003');
    eis('T10b bij n>=V9_MIN_METINGEN meldt de app niets meer',
        richtingTekort === null, 'null', String(richtingTekort && richtingTekort.nog));

    richtingLockKeuze = null;
    bepaalRichtingTekort('990003');
    eis('T10c zonder tik geen melding',
        richtingTekort === null, 'null', String(richtingTekort));
  } finally {
    if (tkBewaard === null) localStorage.removeItem(tk); else localStorage.setItem(tk, tkBewaard);
    richtingLockKeuze = bewaardLock; v9PreSelectieAfrij = bewaardPre;
    v9AanrijHeading = bewaardAanrij; v9AanrijSnelheidHeading = bewaardSnelh;
    richtingTekort = null;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRichting = testRichting;
