// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_richting_gewicht.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.19, release 3 van 3 over de richting-leerformule.
//
//  DE KERN. Het STAP 0-rapport noemde drie oorzaken waarom een richting
//  langzamer in percentage groeit dan het ronde licht. Twee ervan zijn een
//  REKENVERSCHIL en worden hier gerepareerd; de derde is een DATAVERSCHIL en
//  moet blijven zoals hij is. Deze suite houdt die scheiding vast:
//
//    A  de tap-bonus viel aan één kant. Een passage met een handmatige
//       bevestiging gaf het V4-record 0,70 en het V5-record van diezelfde
//       passage 0,50 — terwijl dat V5-record er alleen is omdát er getikt is.
//       GEREPAREERD: slaOpV5 zet `tb:1` achter tikHerkomstEcht, v5NaarV4Vorm
//       leest het.
//    B  de drie node-brede bonussen golden alleen voor het ronde licht.
//       GEDEELTELIJK GEREPAREERD: ze tellen nu ook voor een richting, gedeeld
//       door RICHT_NODEBONUS_DELER en naar beneden afgerond.
//    C  elke passage levert een V4-record, maar alleen een GETIKTE passage
//       levert een V5-record. NIET GEREPAREERD, en C2/C3 bewaken dat: minder
//       bewijs hoort minder percentage te geven.
//
//  WAT DE TABEL IN C1 LAAT ZIEN. Dezelfde n, dezelfde tiksituatie, oud
//  tegenover nieuw. Het doel is niet dat richting en rond licht altijd gelijk
//  uitkomen — dat zou oorzaak C wegpoetsen — maar dat het gat bij GELIJK
//  BEWIJS nul wordt.
//
//  A1  een V5-record met `tb` weegt exact als een getapt V4-record
//  A2  een V5-record zonder `tb` houdt zijn oude, lagere gewicht
//  A3  alleen het schrijfpad achter tikHerkomstEcht zet het stempel
//  A4  de afstandskorting blijft een FACTOR, geen vast getal
//  B1  de drie bonussen tellen mee voor een richting, gehalveerd
//  B2  en nooit zwaarder dan voor het ronde licht van dezelfde node
//  B3  zonder nodeId geen enkele bonus (de terugval van de aanroepers)
//  C1  de tabel uit het rapport, n=1..10, oud naast nieuw
//  C2  het datavolume-verschil blijft staan
//  C3  en ook mét tap-bonus aan beide kanten
//  D1  REGRESSIE: de V4-kant van een node zonder koppeling is onveranderd
//  D2  REGRESSIE: dagdeel-lening werkt ongewijzigd met de nieuwe gewichten
//  D3  RANDGEVAL: een rond licht zonder bevestiging houdt 0,50
//  D4  RANDGEVAL: een merge_alg-record krijgt het stempel niet
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_richting_gewicht.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testRichtingGewicht().regels);
// ═══════════════════════════════════════════════════════════════

function testRichtingGewicht() {
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

  const nu = Date.now();
  const NODE = 993101;
  const DD_NU = huidigDDActief();
  const ANDER_DD = Object.keys(DD).find(d => d !== DD_NU);

  // ── DE FIXTURES ──────────────────────────────────────────────
  // De records liggen ELK EEN MILLISECONDE uit elkaar. Dat is geen detail:
  // laadM ontdubbelt op `tijd` (r1992), dus met een gedeelde tijdstempel
  // smelt een hele V4-emmer samen tot één record en meet deze suite iets
  // anders dan ze beweert. Een milliseconde verschil houdt gew() op 1,0 tot
  // ver voorbij de afronding, zodat elk verschil in de uitkomst nog steeds
  // uitsluitend van het GEWICHT komt — en niet van recentheid, zoals in de
  // suites die op uren oplopen (test_richting_pct).

  // Een V4-record ZONDER handmatige bevestiging: obs === duur, dus
  // vlakGewichtVoor herkent de zuinige lezing en geeft OBS_VLAK (0,50).
  const v4rec = (n, duur = 45) => Array.from({ length: n }, (_, i) =>
    ({ duur, tijd: nu - i, richting: 0, obs: duur, gewicht: 1, bron: 's1' }));

  // Een V4-record MET handmatige bevestiging. obs moet onder de 36 liggen,
  // anders klemmen zonderTap en metTap allebei op 1,0 en zijn ze niet meer te
  // onderscheiden — vlakGewichtVoor kiest dan bewust de zuinige lezing
  // (r1652). Met obs 20: zonderTap 0,44 en metTap 0,64, dus 0,64 wijst
  // ondubbelzinnig naar OBS_VLAK_TAP (0,70).
  const V4_TAP_OBS = 20;
  const v4tap = (n, duur = 45) => Array.from({ length: n }, (_, i) =>
    ({ duur, tijd: nu - i, richting: 0, obs: V4_TAP_OBS,
       gewicht: Math.round(Math.min(1, V4_TAP_OBS / OBS_REFERENTIE + OBS_TAP_BONUS) * 100) / 100,
       bron: 's1' }));

  // Een V5-record zoals slaOpV5 hem schrijft. `tb` alleen als het uit een
  // echte tik komt — precies wat het schrijfpad sinds V11.18.19 doet.
  const v5rec = (n, opt = {}) => Array.from({ length: n }, (_, i) => {
    const r = { duur: opt.duur ?? 45, tijd: nu - i,
                gewicht: opt.gewicht ?? V9_GEWICHT_DICHTBIJ, bron: opt.bron ?? 'tik' };
    if (opt.tb) r.tb = 1;
    return r;
  });

  const bewaard = {
    dichtstbijOSM, osmCache, getoondeLaag, getoondDagdeel, richtingBlokVerborgen,
    v9AanrijHeading, v9AanrijSnelheidHeading,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML
  };

  const wisNode = () => {
    for (const d of Object.keys(DD)) zetLS('sl_v4_' + NODE + '_' + d, null);
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('sl_v5_' + NODE + '_')) zetLS(k, null);
    }
    zetLS('sl_richting_' + NODE, null);
    zetLS('sl_bevestig_' + NODE, null);
    zetLS('sl_neutraal_' + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);
  };

  // Het percentage van één richting-emmer, via het pad dat de app ook loopt.
  const richtPct = (arr, dd = DD_NU) => {
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + dd, JSON.stringify(arr));
    const r = berekenRichtingPct(NODE, 'N', 'W', dd);
    return r ? r.pct : null;
  };
  const rondPct = (arr, dd = DD_NU) => {
    wisNode();
    zetLS('sl_v4_' + NODE + '_' + dd, JSON.stringify(arr));
    return berekenLeerPct(NODE);
  };

  try {
    // De node mag niet in osmCache staan: zoekS2BevestigingScore zou anders
    // langs de echte buurnodes van het toestel gaan lopen en de s2-bonus
    // onvoorspelbaar maken. De s2-tak wordt in B1 apart, expliciet gemeten.
    osmCache = [];
    dichtstbijOSM = null;

    // ══ A1 — DE TAP-BONUS VALT NU AAN BEIDE KANTEN ════════════
    // Dezelfde passage, twee records. Het V4-record kreeg 0,70 omdat de
    // gebruiker de bbox bevestigde; het V5-record bestaat alleen doordat de
    // gebruiker een richting tikte. Vanaf deze release wegen ze gelijk.
    const a1 = [];
    for (const n of [1, 2, 3, 4, 5, 6, 8, 12, 20]) {
      const rond = rondPct(v4tap(n));
      const richt = richtPct(v5rec(n, { tb: true }));
      if (rond !== richt) a1.push('n=' + n + ': rond ' + rond + ' vs richting ' + richt);
    }
    eis('A1 een V5-record met tik-herkomst weegt exact als een getapt V4-record',
        a1.length === 0, 'geen enkele afwijking voor n=1..20',
        a1.length ? a1.join(' | ') : 'gelijk voor n=1..20');

    // En het is werkelijk de TAP-tak van vlakGewichtVoor die aan V4-kant
    // gemeten wordt — niet toevallig hetzelfde getal.
    eis('A1b het V4-referentierecord loopt echt langs OBS_VLAK_TAP',
        vlakGewichtVoor(v4tap(1)[0]) === OBS_VLAK_TAP,
        String(OBS_VLAK_TAP), String(vlakGewichtVoor(v4tap(1)[0])));

    // ══ A2 — GEEN TERUGWERKENDE KRACHT ════════════════════════
    // Een V5-record van vóór deze release draagt geen `tb`. Dat blijft zo:
    // er wordt niets herberekend en niets teruggestempeld.
    const a2 = [];
    for (const n of [1, 2, 3, 5, 8]) {
      const oud = richtPct(v5rec(n));                 // zonder tb
      const rondZonderTap = rondPct(v4rec(n));        // 0,50 aan beide kanten
      if (oud !== rondZonderTap) a2.push('n=' + n + ': ' + oud + ' vs ' + rondZonderTap);
    }
    eis('A2 een V5-record ZONDER tik-stempel houdt zijn oude gewicht (0,50)',
        a2.length === 0, 'gelijk aan een V4-record zonder tap',
        a2.length ? a2.join(' | ') : 'ongewijzigd voor n=1..8');
    eis('A2b en dat is aantoonbaar minder dan mét stempel',
        richtPct(v5rec(2)) < richtPct(v5rec(2, { tb: true })),
        'zonder < met', richtPct(v5rec(2)) + '% < ' + richtPct(v5rec(2, { tb: true })) + '%');

    // ══ A3 — ALLEEN ECHTE TIKKEN KRIJGEN HET STEMPEL ══════════
    // slaOpV5 stempelt standaard NIET. Een toekomstige aanroeper die niet
    // aantoonbaar achter tikHerkomstEcht staat krijgt dus vanzelf geen bonus.
    wisNode();
    slaOpV5(NODE, 'N', 'W', DD_NU, 40, V9_GEWICHT_DICHTBIJ);
    const standaard = laadMV5(NODE, 'N', 'W', DD_NU);
    eis('A3 slaOpV5 zet het stempel NIET uit zichzelf',
        standaard.length === 1 && standaard[0].tb === undefined,
        'geen tb-veld', JSON.stringify(standaard[0] || null));
    wisNode();
    slaOpV5(NODE, 'N', 'W', DD_NU, 40, V9_GEWICHT_DICHTBIJ, null, 'tik', true);
    const gestempeld = laadMV5(NODE, 'N', 'W', DD_NU);
    eis('A3b en zet hem wél als de aanroeper de tik bevestigt',
        gestempeld.length === 1 && gestempeld[0].tb === 1,
        'tb:1', JSON.stringify(gestempeld[0] || null));
    // De twee schrijfpaden geven daar tikHerkomstEcht voor door — de poort die
    // V11.18.10 bouwde en die een automatisch herstelde richting weigert.
    const schrijfpaden = String(schrijfV5DirectBijGroen) + String(voerV9DelayedWriteUit);
    const aanroepen = schrijfpaden.match(/slaOpV5\([\s\S]*?\);/g) || [];
    eis('A3c beide schrijfpaden stempelen via tikHerkomstEcht, niet via een vaste true',
        aanroepen.length === 2 && aanroepen.every(a => /tikHerkomstEcht\(/.test(a)),
        '2 aanroepen, beide met tikHerkomstEcht',
        aanroepen.length + ' aanroep(en), ' + aanroepen.filter(a => /tikHerkomstEcht\(/.test(a)).length + ' met poort');
    eis('A3d het stempel zit NIET in het gewicht — gewGem (de countdown) leest het niet',
        !/\bgewicht\b/.test(String(gewGem)),
        'gewGem gebruikt alleen tijd en duur', 'schoon');

    // ══ A4 — DE AFSTANDSKORTING BLIJFT EEN FACTOR ═════════════
    // Zonder stempel is een verre meting nog exact 0,30 = 0,50 x 0,6 waard;
    // dat getal is ongemoeid gebleven. Met stempel wordt het 0,42 = 0,70 x 0,6:
    // de korting zelf verschuift niet, alleen het getal waar ze op werkt.
    const verZonder = richtPct(v5rec(3, { gewicht: V9_GEWICHT_VER }));
    const dichtbijZonder = richtPct(v5rec(3));
    const verMet = richtPct(v5rec(3, { gewicht: V9_GEWICHT_VER, tb: true }));
    const dichtbijMet = richtPct(v5rec(3, { tb: true }));
    eis('A4 een verre meting zonder stempel is onveranderd (0,30-tak)',
        verZonder === berekenObsScore(v5rec(3).map(x =>
          ({ duur: x.duur, tijd: x.tijd, gewicht: OBS_VLAK * V9_GEWICHT_VER }))),
        'ongewijzigd', verZonder + '%');
    eis('A4b een verre meting blijft lichter dan een dichtbij-meting, ook mét stempel',
        verMet < dichtbijMet && verZonder < dichtbijZonder,
        'ver < dichtbij in beide gevallen',
        'zonder ' + verZonder + '<' + dichtbijZonder + ', met ' + verMet + '<' + dichtbijMet);
    eis('A4c en de korting werkt multiplicatief door: ver+stempel ligt tussen ver en dichtbij',
        verMet > verZonder && verMet < dichtbijMet,
        verZonder + '% < ver+stempel < ' + dichtbijMet + '%', verMet + '%');

    // ══ B1 — DE NODE-BREDE BONUSSEN, GEHALVEERD ═══════════════
    // Een concreet doorgerekend voorbeeld met alle drie de bronnen.
    //   gps_tik_score 1,0  -> node 5 punten, richting floor(5/2) = 2
    //   8x KLOPTE          -> node 8 punten, richting floor(8/2) = 4
    //   s2: twee buurnodes met dezelfde cyclus -> node min(10, 2x3) = 6,
    //                                            richting floor(6/2) = 3
    // De s2-tak vraagt om buurnodes in osmCache met elk >= 3 gemeten duren.
    const BUUR1 = 993102, BUUR2 = 993103;
    // DE BASIS EERST, EN ZONDER BONUSBRONNEN. richtingLeerPct zonder nodeId is
    // per definitie de kale observatiescore — het getal waar de drie bonussen
    // straks bovenop komen. Hem via richtPct meten zou niet werken: zodra
    // osmCache de buren kent telt de s2-bonus daar al in mee.
    const basisPct = richtingLeerPct(v5rec(4, { tb: true }));
    osmCache = [
      { id: NODE,  lat: 52.0000, lon: 5.0000 },
      { id: BUUR1, lat: 52.0003, lon: 5.0000 },   // ~33 m
      { id: BUUR2, lat: 52.0004, lon: 5.0000 }    // ~44 m
    ];
    for (const b of [BUUR1, BUUR2]) {
      zetLS('sl_v4_' + b + '_' + DD_NU, JSON.stringify(v4rec(4)));
    }
    // 4 metingen: ruim boven de drie-duren-poort van de s2-tak.
    zetLS('sl_richting_' + NODE, JSON.stringify({ gps_tik_score: 1.0, headings: [], laatste_update: nu }));
    zetLS('sl_bevestig_' + NODE, JSON.stringify(
      Array.from({ length: 8 }, () => ({ categorie: 'klopte', tijd: nu }))));
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(4, { tb: true })));
    const metAlles = berekenRichtingPct(NODE, 'N', 'W', DD_NU).pct;
    const bonusDirect = nodeBredeBonussen(NODE, v5rec(4, { tb: true }), basisPct);
    const verwachtZwak = Math.floor(bonusDirect.s2 / RICHT_NODEBONUS_DELER)
                       + Math.floor(bonusDirect.gpsTik / RICHT_NODEBONUS_DELER)
                       + Math.floor(bonusDirect.bevestig / RICHT_NODEBONUS_DELER);
    eis('B1 alle drie de node-brede bonussen tellen mee voor een richting',
        bonusDirect.s2 > 0 && bonusDirect.gpsTik > 0 && bonusDirect.bevestig > 0,
        's2>0, gps>0, bevestig>0',
        's2=' + bonusDirect.s2 + ' gps=' + bonusDirect.gpsTik + ' bevestig=' + bonusDirect.bevestig);
    eis('B1b en wel precies gehalveerd, naar beneden afgerond',
        Math.min(95, basisPct + verwachtZwak) === metAlles,
        basisPct + '% + ' + verwachtZwak + ' = ' + Math.min(95, basisPct + verwachtZwak) + '%',
        metAlles + '%');
    eis('B1c het doorgerekende voorbeeld: s2 6→3, gps 5→2, bevestig 8→4',
        bonusDirect.s2 === 6 && bonusDirect.gpsTik === 5 && bonusDirect.bevestig === 8
          && verwachtZwak === 9,
        'node 19 punt → richting 9 punt',
        'node ' + (bonusDirect.s2 + bonusDirect.gpsTik + bonusDirect.bevestig)
          + ' punt → richting ' + verwachtZwak + ' punt');

    // ══ B2 — DE ORDENING BLIJFT HEEL ══════════════════════════
    // Dezelfde bonusbronnen op de V4-kant, met exact evenveel bewijs. De
    // richting mag er nooit bovenuit komen.
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(v4tap(4)));
    const rondAlles = berekenLeerPct(NODE);
    eis('B2 een richting komt door deze bonussen nooit boven het ronde licht uit',
        metAlles <= rondAlles, '<= ' + rondAlles + '%', metAlles + '%');
    eis('B2b en de winst is kleiner: verzwakt, niet voluit',
        (metAlles - basisPct) < (bonusDirect.s2 + bonusDirect.gpsTik + bonusDirect.bevestig),
        'minder dan ' + (bonusDirect.s2 + bonusDirect.gpsTik + bonusDirect.bevestig) + ' punt',
        (metAlles - basisPct) + ' punt');

    // ══ B3 — ZONDER nodeId GEEN BONUS ═════════════════════════
    // Met de buren en beide bonusbronnen nog op scherp: dezelfde metingen,
    // zonder nodeId, geven nog steeds de kale observatiescore.
    eis('B3 richtingLeerPct zonder nodeId leest geen enkele bonusbron',
        richtingLeerPct(v5rec(4, { tb: true })) === basisPct,
        basisPct + '%', String(richtingLeerPct(v5rec(4, { tb: true }))));

    // Opruimen voor de rest van de suite: geen buren, geen bonusbronnen.
    osmCache = [];
    for (const b of [BUUR1, BUUR2]) zetLS('sl_v4_' + b + '_' + DD_NU, null);
    wisNode();

    // ══ C1 — DE TABEL UIT HET RAPPORT, OUD NAAST NIEUW ════════
    // Kolom 'rond' is een passage MET handmatige bevestiging. Kolom 'oud' is
    // wat de richting van diezelfde passage kreeg; kolom 'nieuw' is wat ze nu
    // krijgt. De laatste kolom is het rekenverschil dat moet verdwijnen.
    const tabel = [];
    for (let n = 1; n <= 10; n++) {
      const rond = rondPct(v4tap(n));
      const oud = richtPct(v5rec(n));                  // geen stempel = gedrag vóór deze release
      const nieuw = richtPct(v5rec(n, { tb: true }));  // mét stempel = gedrag na deze release
      tabel.push({ n, rond, oud, nieuw, gatOud: rond - oud, gatNieuw: rond - nieuw });
    }
    console.table(tabel);
    eis('C1 het gat bij GELIJK bewijs is nul geworden, voor n=1 t/m 10',
        tabel.every(r => r.gatNieuw === 0), 'gatNieuw 0 voor elke n',
        tabel.map(r => r.gatNieuw).join(','));
    eis('C1b en het was er wel degelijk: het oude gat loopt tot 16 punt op',
        Math.max(...tabel.map(r => r.gatOud)) >= 10 && tabel[0].gatOud > 0,
        'oud gat > 0 en piek >= 10 punt',
        'gatOud ' + tabel.map(r => r.gatOud).join(','));
    eis('C1c de drie regels uit het rapport komen exact terug (32-25, 53-42, 69-56)',
        tabel[0].rond === 32 && tabel[0].oud === 25
          && tabel[1].rond === 53 && tabel[1].oud === 42
          && tabel[2].rond === 69 && tabel[2].oud === 56,
        '32-25 / 53-42 / 69-56',
        tabel.slice(0, 3).map(r => r.rond + '-' + r.oud).join(' / '));

    // ══ C2 — HET DATAVOLUME-VERSCHIL BLIJFT STAAN ═════════════
    // Oorzaak 3 uit het rapport is GEEN rekenfout en wordt niet gerepareerd.
    // Tien passages waarvan er drie getikt zijn: het ronde licht heeft tien
    // records, de richting drie. Dat hoort een lager percentage te geven —
    // ook nu beide kanten dezelfde bonus krijgen.
    const rond10 = rondPct(v4tap(10));
    const richt3 = richtPct(v5rec(3, { tb: true }));
    eis('C2 minder metingen blijven minder percentage geven',
        richt3 < rond10, 'lager dan de ' + rond10 + '% van 10 metingen', richt3 + '%');
    eis('C2b en het verschil komt volledig uit het AANTAL: 3 tegen 3 is gelijk',
        richt3 === rondPct(v4tap(3)), rondPct(v4tap(3)) + '%', richt3 + '%');
    // De monotonie moet heel blijven: meer metingen is nooit minder percentage.
    const reeks = [1, 2, 3, 4, 5, 6, 7, 8].map(n => richtPct(v5rec(n, { tb: true })));
    eis('C3 de reeks loopt monotoon op met het aantal metingen',
        reeks.every((v, i) => i === 0 || v >= reeks[i - 1]),
        'niet-dalend', reeks.join(' ≤ '));

    // ══ D1 — REGRESSIE: DE V4-KANT IS ONVERANDERD ═════════════
    // Vaste verwachtingen, uitgerekend met de formule zoals die vóór deze
    // release stond. Schuift er ooit iets aan de ronde kant, dan valt dit om.
    const v4Verwacht = [[1, 25], [2, 42], [3, 56], [4, 67], [5, 76], [6, 85], [8, 95]];
    const v4Fout = [];
    for (const [n, verw] of v4Verwacht) {
      const p = rondPct(v4rec(n));
      if (p !== verw) v4Fout.push('n=' + n + ': ' + p + ' i.p.v. ' + verw);
    }
    eis('D1 een rond licht zonder bevestiging geeft exact dezelfde getallen als voorheen',
        v4Fout.length === 0, '25/42/56/67/76/85/95',
        v4Fout.length ? v4Fout.join(' | ') : 'ongewijzigd');
    const v4TapVerwacht = [[1, 32], [2, 53], [3, 69], [4, 81], [5, 92], [6, 95]];
    const v4TapFout = [];
    for (const [n, verw] of v4TapVerwacht) {
      const p = rondPct(v4tap(n));
      if (p !== verw) v4TapFout.push('n=' + n + ': ' + p + ' i.p.v. ' + verw);
    }
    eis('D1b en met bevestiging ook: 32/53/69/81/92/95',
        v4TapFout.length === 0, '32/53/69/81/92/95',
        v4TapFout.length ? v4TapFout.join(' | ') : 'ongewijzigd');
    // De V5-kant mag de V4-kant niet binnensluipen zonder koppeling.
    wisNode();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(v4rec(2)));
    const alleenV4 = berekenLeerPct(NODE);
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(6, { tb: true })));
    eis('D1c zes gestempelde richting-metingen raken het ronde licht niet',
        berekenLeerPct(NODE) === alleenV4, alleenV4 + '%', berekenLeerPct(NODE) + '%');

    // ══ D2 — REGRESSIE: DAGDEEL-LENING ════════════════════════
    // De lening werkt op de COUNTDOWN (gewGem), en gewGem leest `tijd` en
    // `duur` — geen gewicht. Het stempel kan daar dus per constructie niets
    // verschuiven. Dat wordt hier gemeten in plaats van beredeneerd.
    wisNode();
    const dun = v5rec(2, { tb: true, duur: 30 });
    const ander = v5rec(4, { tb: true, duur: 30 });
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(dun));
    zetLS('sl_v5_' + NODE + '_N_W_' + ANDER_DD, JSON.stringify(ander));
    const leenMet = metDagdeelLening(
      laadMV5Geclusterd(NODE, 'N', 'W', DD_NU),
      (d) => laadMV5Geclusterd(NODE, 'N', 'W', d), DD_NU);
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(2, { duur: 30 })));
    zetLS('sl_v5_' + NODE + '_N_W_' + ANDER_DD, JSON.stringify(v5rec(4, { duur: 30 })));
    const leenZonder = metDagdeelLening(
      laadMV5Geclusterd(NODE, 'N', 'W', DD_NU),
      (d) => laadMV5Geclusterd(NODE, 'N', 'W', d), DD_NU);
    eis('D2 de lening pakt evenveel metingen, met en zonder stempel',
        leenMet.m.length === leenZonder.m.length && leenMet.geleend && leenZonder.geleend
          && leenMet.eigenN === leenZonder.eigenN,
        '6 metingen, geleend, eigenN 2',
        leenMet.m.length + ' vs ' + leenZonder.m.length + ', eigenN ' + leenMet.eigenN);
    eis('D2b en de geleende cyclustijd is identiek — het stempel raakt gewGem niet',
        gewGem(leenMet.m) === gewGem(leenZonder.m),
        String(gewGem(leenZonder.m)) + 's', String(gewGem(leenMet.m)) + 's');
    // Geen dubbeltelling aan de percentagekant: het gepoolde percentage over
    // twee dagdelen is gelijk aan diezelfde zes metingen in één emmer.
    wisNode();
    zetLS('sl_v5_' + NODE + '_N_W_' + DD_NU, JSON.stringify(v5rec(2, { tb: true })));
    zetLS('sl_v5_' + NODE + '_N_W_' + ANDER_DD, JSON.stringify(v5rec(4, { tb: true })));
    const laag = { node: String(NODE), key: 'k', paren: [{ aanrij: 'N', afrij: 'W' }] };
    const gepoold = laagLeerPct(NODE, laag);
    const zesInEen = richtPct(v5rec(6, { tb: true }));
    eis('D2c 2 + 4 over twee dagdelen geeft hetzelfde als 6 in één emmer — geen dubbeltelling',
        gepoold === zesInEen, zesInEen + '%', gepoold + '%');
    eis('D2d en ook geen onderschatting: het ligt boven de 2 van het eigen dagdeel',
        gepoold > richtPct(v5rec(2, { tb: true })),
        'hoger dan ' + richtPct(v5rec(2, { tb: true })) + '%', gepoold + '%');

    // ══ D3 — RANDGEVAL: ROND LICHT ZONDER BEVESTIGING ═════════
    eis('D3 een rond licht zonder handmatige bevestiging houdt zijn 0,50-basis',
        vlakGewichtVoor(v4rec(1)[0]) === OBS_VLAK,
        String(OBS_VLAK), String(vlakGewichtVoor(v4rec(1)[0])));
    eis('D3b en komt dus lager uit dan datzelfde licht mét bevestiging',
        rondPct(v4rec(3)) < rondPct(v4tap(3)),
        'zonder < met', rondPct(v4rec(3)) + '% < ' + rondPct(v4tap(3)) + '%');

    // ══ D4 — RANDGEVAL: EEN merge_alg-RECORD KRIJGT NIETS ═════
    // verplaatsAlgemeenNaarRichting (r14159) maakt V5-records uit V4-metingen
    // die via 'samenvoegen met Algemeen' bij een richting belanden. Die komen
    // niet uit een tik, dus ze krijgen het stempel niet — en de kopieerregel
    // daar noemt `tb` ook nergens.
    eis('D4 het samenvoegpad bouwt zijn kopie zonder tb-veld',
        !/\btb\b/.test(String(verplaatsAlgemeenNaarRichting)),
        'geen tb in de kopieerregel', 'schoon');
    const mergeRec = [{ duur: 45, tijd: nu, gewicht: 1.0, bron: 'merge_alg' }];  // idem v5rec(1)
    eis('D4b en zo\'n record weegt dus als een gewone, ongestempelde meting',
        richtPct(mergeRec) === richtPct(v5rec(1)),
        richtPct(v5rec(1)) + '%', richtPct(mergeRec) + '%');

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    dichtstbijOSM = bewaard.dichtstbijOSM;
    osmCache = bewaard.osmCache;
    getoondeLaag = bewaard.getoondeLaag;
    getoondDagdeel = bewaard.getoondDagdeel;
    richtingBlokVerborgen = bewaard.richtingBlokVerborgen;
    v9AanrijHeading = bewaard.v9AanrijHeading;
    v9AanrijSnelheidHeading = bewaard.v9AanrijSnelheidHeading;
    const b = document.getElementById('richting-blok-body');
    if (b && bewaard.blokHtml != null) b.innerHTML = bewaard.blokHtml;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRichtingGewicht = testRichtingGewicht;
