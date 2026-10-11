// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_rond_gewicht.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.37.9.
//
//  RG1  Rond licht weegt elk dagdeel met de metingen met een gemeten duur (het
//       veldgeval: 45 lege S2 en 1 meting); zonder gemeten duur zoals
//       voorheen
//  RG2  het aantal: '(1×)' in het paneel en '1x' in de dagdeeltegel, niet 46
//  RG3  na samenvoegen verdwijnt het oude label (sl_richting_ en de keuze van
//       nu), zonder metingen te wissen; 'Ongedaan maken' zet het terug; staat
//       er nog een rij met dat label, dan blijft het
//  RG4  een tik op Rond licht binnen 1,5 s na een tik in het rijblok telt niet;
//       elke tik geeft een regel algemeen_tik
//  RG5  de meetregel richting_verborgen (de grens van het blok, een tik zonder
//       rij), één regel per verandering
//  RG6  de knop 'Ruim bevestig-lus op' staat uit en doet niets
//  RG7  regressie: welke functies veranderen, en dat de rest byte-gelijk is
//
//  DRAAIEN
//    python testserver.py 8765     (in de repo-map; wachtrij 128, zie testserver.py)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_rond_gewicht.js';
//      document.head.appendChild(s);
//      s.onload = () => testRondGewicht().then(r => console.table(r.regels));
// ═══════════════════════════════════════════════════════════════

async function testRondGewicht() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));
  const NL = String.fromCharCode(10);
  const snap = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); snap[k] = localStorage.getItem(k); }
  // Sleutel voor sleutel, niet met clear(): de IndexedDB-spiegel ziet clear() niet.
  const herstel = () => {
    try {
      const nu = []; for (let i = 0; i < localStorage.length; i++) nu.push(localStorage.key(i));
      for (const k of nu) if (!(k in snap)) opslagVerwijder(k);
      for (const k in snap) if (localStorage.getItem(k) !== snap[k]) localStorage.setItem(k, snap[k]);
      opslagHersynchroniseer(Object.keys(snap).concat(nu));
    } catch (e) {}
  };
  const bewaard = {
    dichtstbijOSM, getoondeLaag, getoondDagdeel, richtingBlokVerborgen, richtingLockKeuze, richtingLockNodeId, richtingLockBron,
    richtingKnoppenNodeId, richtingGedruktVoorNode, richtingTikTijd, richtingTikElement, v9AanrijHeading, v9AanrijSnelheidHeading,
    v9PreSelectieAfrij, preZet, huidigCdBron, nodeInfoNodeId, mergeModusAan, mergeSelectie, mergeUndoBuffer, richtingVerborgenLaatste,
    alert: window.alert, confirm: window.confirm, toonToast: window.toonToast, now: Date.now,
    blokHtml: (document.getElementById('richting-blok-body') || {}).innerHTML,
    infoHtml: (document.getElementById('node-info-body') || {}).innerHTML
  };
  const echtNu = Date.now.bind(Date);
  let schuif = 0;
  Date.now = () => echtNu() + schuif;
  window.toonToast = () => {};
  const nu = echtNu();
  const DD_NU = huidigDDActief();
  const NODE = 9930001;
  const v4 = (duur, uurGeleden, extra = {}) => ({ duur, tijd: nu - uurGeleden * 3600000 - Math.random() * 1000, richting: 0, obs: duur, gewicht: 1, bron: duur > 0 ? 's1' : 's2', ...extra });
  const zetLS = (k, v) => { if (v === null) opslagVerwijder(k); else localStorage.setItem(k, v); opslagHersynchroniseer([k]); };
  const leegNode = () => {
    for (const k of opslagSleutels('sl_v4_' + NODE + '_').concat(opslagSleutels('sl_v5_' + NODE + '_'))) zetLS(k, null);
    for (const k of ['sl_richting_' + NODE, 'sl_enkelricht_' + NODE, 'sl_neutraal_' + NODE]) zetLS(k, null);
  };
  const log = () => { try { return JSON.parse(localStorage.getItem('sl_opslaglog')) || []; } catch (e) { return []; } };
  const algRij = () => [...document.querySelectorAll('#richting-blok-body .rb-rij')].find(r => r.getAttribute('data-key') === 'ALG');
  const teken = () => { getoondeLaag = null; bijwerkLeerkaart(dichtstbijOSM); };

  try {
    zetLS('sl_opslaglog', '[]');
    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'Testkruising' };
    getoondDagdeel = null; richtingBlokVerborgen = false;
    richtingLockKeuze = null; richtingLockNodeId = null;
    v9AanrijHeading = null; v9AanrijSnelheidHeading = null; v9PreSelectieAfrij = null;
    mergeModusAan = false; mergeSelectie = [];
    const anderDD = Object.keys(DD).find(d => d !== DD_NU);

    // ═══ RG1 — het gewicht ═════════════════════════════════════
    leegNode();
    const metingenRG1 = [];
    for (let i = 0; i < 45; i++) metingenRG1.push(v4(0, 24 * 30 + i));
    metingenRG1.push(v4(70, 5));
    const avond = []; for (let i = 0; i < 10; i++) avond.push(v4(60 + i, 10 + i));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(metingenRG1));
    zetLS('sl_v4_' + NODE + '_' + anderDD, JSON.stringify(avond));
    // dezelfde formule als de rij, dagdeel voor dagdeel
    const spiegel = () => {
      let mt = 0, pw = 0, gt = 0, gp = 0, gc = 0, cs = 0, cc = 0;
      for (const d of Object.keys(DD)) {
        const m = algemeenMetingen(String(NODE), d);
        if (!m.length) continue;
        const pctD = Math.min(95, Math.max(m.filter(heeftGemetenDuur).length * 4, berekenObsScore(m)));
        const w = m.filter(heeftGemetenDuur).length, g = gewGem(m);
        mt += m.length; pw += pctD * m.length; gt += w; gp += pctD * w;
        if (g) { gc += g * w; cs += g * m.length; cc += m.length; }
      }
      return { oud: mt > 0 ? Math.round(pw / mt) : 0, nieuw: gt > 0 ? Math.round(gp / gt) : (mt > 0 ? Math.round(pw / mt) : 0),
               cycOud: cc > 0 ? Math.round(cs / cc) : null, cycNieuw: gt > 0 ? Math.round(gc / gt) : null };
    };
    teken();
    const sp1 = spiegel(), r1 = algRij();
    const pct1 = r1 ? r1.querySelector('.rb-pct').textContent.trim() : null, cyc1 = r1 ? r1.querySelector('.rb-cyc').textContent.trim() : null;
    eis('RG1a 45 lege S2 + 1 meting in het ene dagdeel, 10 metingen in het andere: de rij weegt 1 tegen 10, niet 46 tegen 10 (en dat scheelt hier)',
        !!r1 && pct1 === sp1.nieuw + '%' && sp1.nieuw !== sp1.oud, sp1.nieuw + '% (was ' + sp1.oud + '%)', pct1);
    eis('RG1b de cyclustijd met hetzelfde gewicht', cyc1 === (sp1.cycNieuw != null ? sp1.cycNieuw + 's' : '—'),
        (sp1.cycNieuw != null ? sp1.cycNieuw + 's' : '—') + ' (was ' + sp1.cycOud + 's)', cyc1);
    // alleen lege S2: zoals voorheen
    leegNode();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(metingenRG1.slice(0, 45)));
    teken();
    const sp2 = spiegel(), r2 = algRij();
    const pct2 = r2 ? r2.querySelector('.rb-pct').textContent.trim() : null;
    eis('RG1c alleen lege S2 (geen gemeten duur): het percentage zoals voorheen, en geen cyclustijd',
        !!r2 && pct2 === sp2.oud + '%' && r2.querySelector('.rb-cyc').textContent.trim() === '—', sp2.oud + '%, —', pct2 + ', ' + (r2 ? r2.querySelector('.rb-cyc').textContent.trim() : '-'));
    // alleen metingen: geen verschil
    leegNode();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(avond.slice(0, 5)));
    zetLS('sl_v4_' + NODE + '_' + anderDD, JSON.stringify(avond.slice(5)));
    teken();
    const sp3 = spiegel(), r3 = algRij();
    eis('RG1d zonder lege S2 is er niets veranderd', !!r3 && sp3.nieuw === sp3.oud && r3.querySelector('.rb-pct').textContent.trim() === sp3.oud + '%',
        sp3.oud + '%', r3 ? r3.querySelector('.rb-pct').textContent.trim() : '-');

    // ═══ RG2 — het aantal ══════════════════════════════════════
    leegNode();
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(metingenRG1));
    teken();
    const tegel = document.getElementById('dc-' + DD_NU).textContent;
    const pctDd = (document.getElementById('leer-pct-dd') || { textContent: '' }).textContent;
    eis('RG2a de dagdeeltegel: 1x (de ene meting), niet 46x', tegel === '1x', '1x', tegel);
    eis('RG2b het bijschrift naast de balk telt hetzelfde', !pctDd || /1x$/.test(pctDd), '... 1x', pctDd || '(geen bijschrift)');
    renderNodeInfo(String(NODE));
    const ni = document.querySelector('#node-info-body .ni-rij-algemeen');
    const niTxt = ni ? ni.textContent : '';
    eis('RG2c het paneel: (1×), niet (46×)', /\(1×\)/.test(niTxt) && !/\(46×\)/.test(niTxt), '(1×)', niTxt.slice(0, 120) || 'geen rij');
    eis('RG2d de tegel houdt de volle set voor het percentage en de startbonus (m), alleen het getal telt anders',
        laagDagdeelCijfers(String(NODE), null, DD_NU).m.length === 46 && laagDagdeelCijfers(String(NODE), null, DD_NU).n === 1, 'm 46, n 1',
        'm ' + laagDagdeelCijfers(String(NODE), null, DD_NU).m.length + ', n ' + laagDagdeelCijfers(String(NODE), null, DD_NU).n);

    // ═══ RG3 — het label na samenvoegen ════════════════════════
    // N_Z = Rechtdoor, N_O = Linksaf, Z_N = Rechtdoor vanaf de andere kant.
    const v5 = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ duur: 50 + i, tijd: nu - (i + 1) * 3600000, gewicht: 1, bron: 'v5' })));
    const RD = { aanrij: 'N', afrij: 'Z' }, LI = { aanrij: 'N', afrij: 'O' }, RD2 = { aanrij: 'Z', afrij: 'N' };
    const zetRichting = (extra = {}) => zetLS('sl_richting_' + NODE, JSON.stringify({ headings: [1, 2, 3], laatste_update: nu, bevestigingen: 5,
      tikrichting: 'rechtdoor', tik_cx_zone: 'midden', tik_bevestigingen: 3, ...extra }));
    const rd = () => { try { return JSON.parse(localStorage.getItem('sl_richting_' + NODE)); } catch (e) { return null; } };
    const metingen = () => opslagSleutels('sl_v5_' + NODE + '_').reduce((s, k) => s + (JSON.parse(localStorage.getItem(k)) || []).length, 0)
                       + opslagSleutels('sl_v4_' + NODE + '_').reduce((s, k) => s + (JSON.parse(localStorage.getItem(k)) || []).length, 0);
    leegNode();
    zetLS(v5Sleutel(NODE, 'N', 'Z', DD_NU), v5(3)); zetLS(v5Sleutel(NODE, 'N', 'O', DD_NU), v5(2));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(avond.slice(0, 4)));
    zetRichting();
    richtingLockNodeId = String(NODE); richtingLockKeuze = 'rechtdoor'; v9PreSelectieAfrij = 'Z';
    zetLS('sl_opslaglog', '[]');
    const voor3 = metingen();
    mergeRichtingen(String(NODE), RD, LI);
    const d3 = rd();
    eis('RG3a Rechtdoor samengevoegd met Linksaf: het label wordt links (en de zone), headings en tellers blijven',
        d3 && d3.tikrichting === 'links' && d3.tik_cx_zone === 'links' && d3.tik_bevestigingen === 3 && JSON.stringify(d3.headings) === '[1,2,3]' && d3.bevestigingen === 5,
        'links/links, 3, [1,2,3], 5', JSON.stringify(d3));
    eis('RG3b de keuze van nu volgt (links), en de voorselectie gaat naar de afrijrichting van het doel',
        richtingLockKeuze === 'links' && v9PreSelectieAfrij === 'O', 'links / O', richtingLockKeuze + ' / ' + v9PreSelectieAfrij);
    eis('RG3c geen meting weg: evenveel als voor het samenvoegen, alle 5 in Linksaf', metingen() === voor3 && opslagSleutels('sl_v5_' + NODE + '_N_Z_').length === 0
        && (JSON.parse(localStorage.getItem(v5Sleutel(NODE, 'N', 'O', DD_NU))) || []).length === 5, voor3 + ', 5 in N_O', metingen() + ', ' + (JSON.parse(localStorage.getItem(v5Sleutel(NODE, 'N', 'O', DD_NU))) || []).length);
    const lg3 = log().filter(r => r.reden === 'merge_label');
    eis('RG3d logregel merge_label rechtdoor>links, label+keuze', lg3.length === 1 && lg3[0].element === 'rechtdoor>links' && lg3[0].poortReden === 'label+keuze',
        'rechtdoor>links label+keuze', JSON.stringify(lg3.map(r => r.element + ' ' + r.poortReden)));
    mergeUndoUitvoeren();
    eis('RG3e Ongedaan maken: label rechtdoor en de keuze rechtdoor weer terug, en de metingen weer in Rechtdoor',
        rd() && rd().tikrichting === 'rechtdoor' && rd().tik_cx_zone === 'midden' && richtingLockKeuze === 'rechtdoor'
          && (JSON.parse(localStorage.getItem(v5Sleutel(NODE, 'N', 'Z', DD_NU))) || []).length === 3,
        'rechtdoor / rechtdoor / 3', JSON.stringify(rd()) + ' / ' + richtingLockKeuze);
    // naar Rond licht
    richtingLockKeuze = 'rechtdoor'; v9PreSelectieAfrij = 'Z'; preZet = { node: String(NODE), tijd: nu, vorm: 'Z', bron: 'tik' };
    mergeRichtingen(String(NODE), RD, 'ALGEMEEN');
    const d3b = rd();
    eis('RG3f Rechtdoor samengevoegd met Rond licht: het label weg (tikrichting en zone), de rest blijft; de keuze wordt algemeen, de voorselectie leeg',
        d3b && d3b.tikrichting === undefined && d3b.tik_cx_zone === undefined && d3b.tik_bevestigingen === 3 && JSON.stringify(d3b.headings) === '[1,2,3]'
          && richtingLockKeuze === 'algemeen' && v9PreSelectieAfrij === null && preZet === null,
        'geen label, algemeen, leeg', JSON.stringify(d3b) + ' / ' + richtingLockKeuze + ' / ' + v9PreSelectieAfrij);
    // nog een Rechtdoor-rij over (van de andere kant): het label blijft
    leegNode();
    zetLS(v5Sleutel(NODE, 'N', 'Z', DD_NU), v5(3)); zetLS(v5Sleutel(NODE, 'N', 'O', DD_NU), v5(2)); zetLS(v5Sleutel(NODE, 'Z', 'N', DD_NU), v5(2));
    zetRichting();
    richtingLockNodeId = String(NODE); richtingLockKeuze = 'rechtdoor'; v9PreSelectieAfrij = 'Z';
    zetLS('sl_opslaglog', '[]');
    mergeRichtingen(String(NODE), RD, LI);
    eis('RG3g staat er nog een Rechtdoor-rij (vanaf de andere kant), dan blijft het label rechtdoor en de keuze ook; geen logregel',
        rd() && rd().tikrichting === 'rechtdoor' && richtingLockKeuze === 'rechtdoor' && log().filter(r => r.reden === 'merge_label').length === 0,
        'rechtdoor / rechtdoor / 0', (rd() && rd().tikrichting) + ' / ' + richtingLockKeuze + ' / ' + log().filter(r => r.reden === 'merge_label').length);
    if (mergeUndoBuffer) mergeUndoBuffer = null;

    // ═══ RG4 — Rond licht kort na een rijbloktik ═══════════════
    leegNode();
    zetLS(v5Sleutel(NODE, 'N', 'Z', DD_NU), v5(2));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(avond.slice(0, 4)));
    richtingLockKeuze = null; richtingLockNodeId = null; zetLS('sl_opslaglog', '[]');
    schuif = 0;
    tikRichting('links', 'rij');
    schuif = 400;
    kiesLaagAlgemeen();
    const k4a = richtingLockKeuze;
    schuif = 1600;
    kiesLaagAlgemeen();
    const k4b = richtingLockKeuze;
    const at = log().filter(r => r.reden === 'algemeen_tik');
    eis('RG4a 0,4 s na een tik op een richtingrij: de tik op Rond licht telt niet (de keuze blijft links)', k4a === 'links', 'links', String(k4a));
    eis('RG4b 1,6 s erna wel (algemeen)', k4b === 'algemeen', 'algemeen', String(k4b));
    const rond = (x, d) => typeof x === 'number' && x >= d && x < d + 100;   // de echte klok loopt een paar ms mee
    eis('RG4c twee regels algemeen_tik: genegeerd na 400 ms, telt na 1600 ms', at.length === 2 && at[0].element === 'genegeerd' && rond(at[0].dur, 400)
        && at[1].element === 'telt' && rond(at[1].dur, 1600), 'genegeerd 400, telt 1600', JSON.stringify(at.map(r => r.element + ' ' + r.dur)));
    schuif = 2000; tikRichting('rechts', 'toevoeg'); schuif = 2300; kiesLaagAlgemeen();
    const k4c = richtingLockKeuze;
    schuif = 2500; tikRichting('links', 'vraag'); schuif = 2700; kiesLaagAlgemeen();
    const k4d = richtingLockKeuze;
    eis('RG4d ook na een toevoegknop telt hij niet; na de losse richtingknoppen (vraag, geen rijblok) wel',
        k4c === 'rechts' && k4d === 'algemeen', 'rechts / algemeen', k4c + ' / ' + k4d);
    eis('RG4e een tik zonder rijbloktik ervoor: telt, met lege dur', (() => { richtingTikTijd = 0; richtingTikElement = null; zetLS('sl_opslaglog', '[]'); kiesLaagAlgemeen();
        const r = log().filter(x => x.reden === 'algemeen_tik'); return r.length === 1 && r[0].element === 'telt' && r[0].dur === null; })(), 'telt, null', JSON.stringify(log().filter(x => x.reden === 'algemeen_tik')));
    schuif = 0;

    // ═══ RG5 — de meetregel richting_verborgen ═════════════════
    leegNode();
    zetLS(v5Sleutel(NODE, 'N', 'Z', DD_NU), v5(4)); zetLS(v5Sleutel(NODE, 'N', 'O', DD_NU), v5(3)); zetLS(v5Sleutel(NODE, 'N', 'W', DD_NU), v5(2));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(avond.slice(0, 4)));
    richtingLockNodeId = null; richtingLockKeuze = null; richtingVerborgenLaatste = '';
    zetLS('sl_opslaglog', '[]');
    teken(); teken();
    const rv1 = log().filter(r => r.reden === 'richting_verborgen');
    eis('RG5a drie richtingen en Rond licht: er passen er twee; één regel (niet twee bij twee keer tekenen): top, 3 rijen, 2 getoond, 1 weg',
        rv1.length === 1 && rv1[0].element === 'top' && rv1[0].rvTot === 3 && rv1[0].rvHer === 2 && rv1[0].rvOnb === 1 && rv1[0].rvExact === 0,
        'top 3/2/1/0', JSON.stringify(rv1.map(r => [r.element, r.rvTot, r.rvHer, r.rvOnb, r.rvExact])));
    richtingLockNodeId = String(NODE); richtingLockKeuze = 'rechts';
    teken();
    const rv2 = log().filter(r => r.reden === 'richting_verborgen');
    eis('RG5b de keuze is rechts, en dat is net de rij die wegvalt: top+tik_zonder_rij', rv2.length === 2 && rv2[1].element === 'top+tik_zonder_rij' && rv2[1].tik === 'rechts',
        'top+tik_zonder_rij', JSON.stringify(rv2.map(r => r.element + ' ' + r.tik)));
    leegNode();
    zetLS(v5Sleutel(NODE, 'N', 'Z', DD_NU), v5(4));
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(avond.slice(0, 4)));
    richtingLockNodeId = String(NODE); richtingLockKeuze = 'links'; zetLS('sl_opslaglog', '[]');
    teken();
    const rv3 = log().filter(r => r.reden === 'richting_verborgen');
    eis('RG5c een toevoegtik (links) zonder V5-metingen: tik_zonder_rij', rv3.length === 1 && rv3[0].element === 'tik_zonder_rij', 'tik_zonder_rij',
        JSON.stringify(rv3.map(r => r.element)));
    richtingLockKeuze = 'rechtdoor'; zetLS('sl_opslaglog', '[]');
    teken();
    eis('RG5d alles zichtbaar: geen regel', log().filter(r => r.reden === 'richting_verborgen').length === 0, '0', String(log().filter(r => r.reden === 'richting_verborgen').length));

    // ═══ RG6 — de bevestig-lus-knop staat uit ══════════════════
    const knop = document.getElementById('bevestig-lus-btn');
    eis('RG6a de knop staat er nog, maar grijs en uit (disabled), met (uit) in de tekst',
        !!knop && knop.disabled === true && /\(uit\)/.test(knop.textContent) && BEVESTIG_LUS_KNOP_AAN === false, 'disabled, (uit)', knop ? knop.disabled + ' / ' + knop.textContent : 'geen knop');
    leegNode();
    const lus = [v4(60, 30), { ...v4(96, 29), bron: 'bevestig_fout' }, { ...v4(150, 28), bron: 'bevestig_fout' }, v4(62, 27)];
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(lus));
    const voor6 = localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU);
    const meld = []; let gevraagd = 0;
    window.alert = (m) => meld.push(String(m)); window.confirm = () => { gevraagd++; return true; };
    ruimBevestigLusOp();
    eis('RG6b ook aangeroepen doet hij niets: een melding dat hij uit staat, geen vraag, en de emmer is byte-gelijk',
        meld.length === 1 && /staat uit/.test(meld[0]) && gevraagd === 0 && localStorage.getItem('sl_v4_' + NODE + '_' + DD_NU) === voor6,
        'melding, 0 vragen, gelijk', meld.join(' | ') + ' / ' + gevraagd);
    eis('RG6c de analyse zelf werkt nog (analyseerBevestigLus ziet de lus)', analyseerBevestigLus().some(r => r.nodeId === String(NODE)), 'gezien', 'ok');
  } finally {
    window.alert = bewaard.alert; window.confirm = bewaard.confirm; window.toonToast = bewaard.toonToast; Date.now = bewaard.now;
    ({ dichtstbijOSM, getoondeLaag, getoondDagdeel, richtingBlokVerborgen, richtingLockKeuze, richtingLockNodeId, richtingLockBron,
       richtingKnoppenNodeId, richtingGedruktVoorNode, richtingTikTijd, richtingTikElement, v9AanrijHeading, v9AanrijSnelheidHeading,
       v9PreSelectieAfrij, preZet, huidigCdBron, nodeInfoNodeId, mergeModusAan, mergeSelectie, mergeUndoBuffer, richtingVerborgenLaatste } = bewaard);
    herstel();
    const b = document.getElementById('richting-blok-body'); if (b && bewaard.blokHtml !== undefined) b.innerHTML = bewaard.blokHtml;
    const n = document.getElementById('node-info-body'); if (n && bewaard.infoHtml !== undefined) n.innerHTML = bewaard.infoHtml;
  }

  // ═══ RG7 — regressie ══════════════════════════════════════
  const terug = (s) => String(s)
    .replace("  const algPct = algGewTot > 0 ? Math.round(algGewPct / algGewTot) : (algMetTot > 0 ? Math.round(algPctWeighted / algMetTot) : 0);   // V11.37.9", "  const algPct = algMetTot > 0 ? Math.round(algPctWeighted / algMetTot) : 0;")
    .replace("  const algCyc = algGewTot > 0 ? Math.round(algGewCyc / algGewTot) : null;   // V11.37.9: zonder gemeten duur was algCycCount ook 0", "  const algCyc = algCycCount > 0 ? Math.round(algCycSum / algCycCount) : null;")
    .replace("(${m.filter(heeftGemetenDuur).length}×)`);   // V11.37.9: alleen metingen met een gemeten duur, zie bij algPct", "(${m.length}×)`);")
    .replace("    return { gem: gewGem(m), n: m.filter(heeftGemetenDuur).length, m };   // V11.37.9: het aantal in de tegel, zie bij algPct; m blijft vol", "    return { gem: gewGem(m), n: m.length, m };")
    .split(NL).filter(l => !/V11\.37\.9(?!\d)/.test(l)).join(NL);
  const merk = (f) => String(f).split(NL).filter(l => /V11\.37\.9(?!\d)/.test(l)).length;
  const V11378 = { renderRichtingBlok: ['50d0ad24', 18184, 6], renderNodeInfo: ['8353a70b', 9891, 1], laagDagdeelCijfers: ['6b47544b', 822, 1],
    mergeRichtingen: ['808553a5', 7340, 2], mergeUndoUitvoeren: ['8fe778b', 560, 1], kiesLaagAlgemeen: ['53d548ba', 1323, 1], ruimBevestigLusOp: ['a6c7c94', 2489, 1] };
  const telAf = Object.entries(V11378).filter(([n, [h, l, m]]) => merk(window[n]) !== m).map(([n]) => n + ' ' + merk(window[n]));
  eis('RG7a zeven functies veranderen, alleen met regels met merkteken V11.37.9', telAf.length === 0, 'precies zoveel', telAf.join(', ') || 'precies zoveel');
  const anders = Object.entries(V11378).filter(([n, [h, l]]) => { const s = terug(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('RG7b met die regels terug (vier waren een andere regel, de rest is nieuw) byte-gelijk aan V11.37.8', anders.length === 0, 'geen afwijking', anders.join(', ') || 'geen');
  const zonderV113715 = (s) => String(s).split('\n').filter(l => !/V11\.37\.15(?!\d)/.test(l)).join('\n');   // V11.37.15: de koersmeting (test_koerslog); hier terug
  const zonderV113713 = (s) => zonderV113715(s).split('\n').filter(l => !/V11\.37\.13(?!\d)/.test(l)).join('\n');   // V11.37.13: R1 en R3 van de tegenrichting-regel (test_tegenbocht); hier terug
  const zonderV113712 = (s) => zonderV113713(s).split('\n').filter(l => !/V11\.37\.12(?!\d)/.test(l)).join('\n');   // V11.37.12: de rem op de kaartvraag en de dekking van de fietslijst (test_overpass); hier terug
  const zonderV113711 = (s) => zonderV113712(s).split('\n').filter(l => !/V11\.37\.11(?!\d)/.test(l)).join('\n');   // V11.37.11: de tegenrichting-regel (test_tegenrichting); hier terug
  const ONGEWIJZIGD = { berekenLeerPct: ['5d38efe9', 986], algemeenMetingen: ['40c40223', 1285], laagDagdeelPct: ['8c863dca', 914], tikRichting: ['b44110d5', 4619],
    kiesLaagRichting: ['94ad3b74', 596], verplaatsAlgemeenNaarRichting: ['f66a53f0', 2052], herstelRvVoorMerge: ['ea697b84', 2338], analyseerBevestigLus: ['e4d5feee', 1468],
    bijwerkLeerkaart: ['8344c773', 8107], laagMetingen: ['ca21e0f9', 421], richtingLeerPct: ['e4a7222', 925], vindDichtbij: ['d444ee3', 3717], updateDichtbij: ['7b7fce62', 12303],
    onGPS: ['d99821b8', 15000], bevestigCountdown: ['8457401d', 16073], verwerkBevestigLeren: ['9163848', 8583], slaOpIntern: ['c284229a', 2342], toonMergeDialoog: ['6d14fe13', 3633] };
  const anders2 = Object.entries(ONGEWIJZIGD).filter(([n, [h, l]]) => { const s = zonderV113711(window[n]); return fnv(s) !== h || s.length !== l; }).map(x => x[0]);
  eis('RG7c achttien functies die V11.37.9 niet raakt (het leren, de percentages, de tik, de verhuizing, de lichtkeuze, de knoppen): byte-gelijk aan V11.37.8',
      anders2.length === 0, 'geen afwijking', anders2.join(', ') || 'geen');

  try { if (typeof idbFlush === 'function') await idbFlush(); } catch (e) {}
  await slaap(50);
  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testRondGewicht = testRondGewicht;
