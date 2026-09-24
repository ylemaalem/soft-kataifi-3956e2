// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_cluster_tap.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.22: een tik op het camerabeeld die een node vastzet op een
//  plek waar meerdere masten staan, waarschuwt — altijd, ook als de app die
//  cluster deze nadering al eerder aankondigde.
//
//  HET GEVAL DAT DEZE LAAG BESTAAT. Landdroststraat, 24 september:
//    08:11:54  cluster_gemeld            node ...301   45 km/u
//    08:11:56  node_vergrendeld          node ...301   36 km/u  element=beeld
//    08:12:02  stilstand_node_afwijking  node ...301    3 km/u  afwM=9
//    08:12:02  node_vergrendeld          node ...302    3 km/u  element=lijst
//  Tussen de tik en de zelf ontdekte correctie zat zes seconden stilte, mét
//  lopende countdown op het verkeerde licht. Drie op zichzelf terechte regels
//  maakten dat moment onzichtbaar; C4 is de test die precies dát nabouwt.
//
//  C1  de melding zelf: toast, knop, logregel
//  C2  geen cluster -> geen melding
//  C3  een keuze uit de correctielijst -> geen melding (daar zag je de lijst al)
//  C4  DE KERN: de cluster is deze nadering al aangekondigd -> tóch een melding,
//      en laatstGemeldeClusterNode blijft onaangeroerd
//  C5  herhaling: drie keer op hetzelfde licht is één melding
//  C6  een beeld-tik bovenop een lopende auto-lock is een nieuwe beslissing
//  C7  REGRESSIE: de vergrendeling zelf, de node-keuze en de knop veranderen niets
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_cluster_tap.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testClusterTap().regels);
// ═══════════════════════════════════════════════════════════════

function testClusterTap() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const LAT = 52.0, LON = 4.7;
  const CLUSTER_A = 881001;   // zit in het cluster — de node die de tik vastzet
  const CLUSTER_B = 881002;   // de tweede mast van datzelfde kruispunt
  const SOLO      = 881003;   // een losse node, geen cluster

  const bewaard = {
    dichtstbijOSM, osmCache, huidigePos,
    handmatigLockActief, stilstandAutoLock,
    handmatigGeselecteerdNodeId, handmatigGeselecteerdTimestamp,
    clusterNodes: new Set(clusterNodes),
    laatstGemeldeClusterNode,
    toastHtml: (document.getElementById('leer-toast') || {}).innerHTML,
    toastCls: document.getElementById('leer-toast')
      ? document.getElementById('leer-toast').className : '',
    overlayDisplay: document.getElementById('correctie-overlay')
      ? document.getElementById('correctie-overlay').style.display : ''
  };
  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };
  const regelsVan = (reden) => {
    try { return (JSON.parse(localStorage.getItem('sl_opslaglog')) || []).filter(r => r && r.reden === reden); }
    catch (e) { return []; }
  };
  const laatste = (reden) => { const r = regelsVan(reden); return r.length ? r[r.length - 1] : null; };
  const toast = () => document.getElementById('leer-toast');
  const toastTekst = () => (toast() ? toast().textContent : '');
  const toastZichtbaar = () => !!(toast() && toast().classList.contains('zichtbaar'));
  const toastKnop = () => (toast() ? toast().querySelector('.toast-actie') : null);
  const overlay = () => document.getElementById('correctie-overlay');

  // De drie nodes liggen dicht bij elkaar; de exacte meters doen er niet toe,
  // want deze laag kijkt alleen naar clusterNodes en naar `element`. De posities
  // staan er omdat toonCorrectielijst (C7) osmCache en huidigePos nodig heeft.
  const opzet = (lock) => {
    zetLS('sl_opslaglog', '[]');
    huidigePos = { lat: LAT, lon: LON };
    osmCache = [
      { id: CLUSTER_A, lat: LAT + 0.00018, lon: LON, naam: 'Mast A' },
      { id: CLUSTER_B, lat: LAT + 0.00022, lon: LON + 0.00006, naam: 'Mast B' },
      { id: SOLO,      lat: LAT + 0.00300, lon: LON, naam: 'Losse node' }
    ];
    dichtstbijOSM = { ...osmCache[0], afstand: afstand(LAT, LON, osmCache[0].lat, osmCache[0].lon) };
    clusterNodes = new Set([String(CLUSTER_A), String(CLUSTER_B)]);
    laatstGemeldeClusterNode = null;
    // lock: 'vrij' | 'hand' | 'auto' — de toestand waarin de tik binnenkomt
    handmatigLockActief = (lock === 'hand' || lock === 'auto');
    stilstandAutoLock   = (lock === 'auto');
    handmatigGeselecteerdNodeId = handmatigLockActief ? String(CLUSTER_A) : null;
    handmatigGeselecteerdTimestamp = Date.now();
    if (toast()) { toast().innerHTML = ''; toast().className = ''; }
    if (overlay()) overlay().style.display = 'none';
  };

  try {

    // ═══ C1 — DE MELDING ZELF ════════════════════════════════
    opzet('vrij');
    vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
    eis('C1 een beeld-tik op een clusternode waarschuwt',
        toastZichtbaar() && toastTekst().indexOf('Meerdere masten') !== -1,
        'zichtbare toast over meerdere masten',
        (toastZichtbaar() ? 'zichtbaar: ' : 'onzichtbaar: ') + (toastTekst() || '(leeg)'));
    eis('C1b het is de waarschuwingsvariant, niet de gewone leertoast',
        !!toast() && toast().classList.contains('waarschuwing'),
        'class waarschuwing', toast() ? toast().className : 'geen element');
    eis('C1c er zit een knop bij die naar de correctielijst leidt',
        !!toastKnop() && toastKnop().textContent === 'Wissel',
        'knop "Wissel"', toastKnop() ? toastKnop().textContent : 'geen knop');
    let r = laatste('cluster_tap_gemeld');
    eis('C1d en de melding is meetbaar: een logregel met node en herkomst',
        !!r && r.node === String(CLUSTER_A) && r.element === 'beeld',
        String(CLUSTER_A) + ', beeld',
        r ? (r.node + ', ' + r.element) : 'geen regel');

    // #leer-toast staat op white-space:nowrap zonder max-width (index.html r606)
    // en wordt gecentreerd met translateX(-50%): een te lange regel loopt aan
    // BEIDE kanten even ver buiten beeld en is dus onleesbaar. Op 375 px bij
    // 13 px font is het budget ~360 px; met de knop erbij past deze tekst op
    // 341 px. Gemeten: 32 tekens = 341 px, dus 34 is de grens met marge.
    eis('C1e de tekst past op een telefoonscherm — de toast knipt niet af',
        CLUSTER_TAP_TEKST.length <= 34,
        '<= 34 tekens', CLUSTER_TAP_TEKST.length + ' tekens: ' + CLUSTER_TAP_TEKST);

    // ═══ C2 — GEEN CLUSTER, GEEN MELDING ═════════════════════
    opzet('vrij');
    dichtstbijOSM = { ...osmCache[2], afstand: 300 };
    vergrendelNodeHandmatig(SOLO, 'beeld');
    eis('C2 op een losse node zwijgt de app — daar valt niets te verwarren',
        !toastZichtbaar() && regelsVan('cluster_tap_gemeld').length === 0,
        'geen toast, 0 logregels',
        (toastZichtbaar() ? 'toast: ' + toastTekst() : 'geen toast')
          + ', ' + regelsVan('cluster_tap_gemeld').length + ' logregels');
    eis('C2b maar de vergrendeling zelf gebeurde wel gewoon',
        handmatigLockActief === true && String(handmatigGeselecteerdNodeId) === String(SOLO),
        'lock op ' + SOLO, handmatigLockActief + ', ' + handmatigGeselecteerdNodeId);

    // ═══ C3 — EEN KEUZE UIT DE LIJST WAARSCHUWT NIET ═════════
    opzet('vrij');
    vergrendelNodeHandmatig(CLUSTER_A, 'lijst');
    eis('C3 wie uit de correctielijst kiest heeft de masten al met afstand gezien',
        !toastZichtbaar() && regelsVan('cluster_tap_gemeld').length === 0,
        'geen toast, 0 logregels',
        (toastZichtbaar() ? 'toast: ' + toastTekst() : 'geen toast')
          + ', ' + regelsVan('cluster_tap_gemeld').length + ' logregels');

    // ═══ C4 — DE KERN: HET GEVAL VAN 24 SEPTEMBER ════════════
    // De app heeft deze cluster deze nadering al aangekondigd; daarom zweeg
    // vóór deze release álles wat daarna nog iets had kunnen zeggen.
    opzet('vrij');
    laatstGemeldeClusterNode = String(CLUSTER_A);
    vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
    eis('C4 de cluster was al aangekondigd — de tik waarschuwt tóch',
        toastZichtbaar() && toastTekst().indexOf('Meerdere masten') !== -1,
        'zichtbare toast', toastZichtbaar() ? toastTekst() : 'stilte (de oude bug)');
    eis('C4b en de naderingsmelding van het volgende kruispunt blijft mogelijk',
        laatstGemeldeClusterNode === String(CLUSTER_A),
        String(CLUSTER_A) + ' (onaangeroerd)', String(laatstGemeldeClusterNode));

    // ═══ C5 — HERHALING ══════════════════════════════════════
    opzet('vrij');
    vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
    if (toast()) { toast().innerHTML = ''; toast().className = ''; }
    vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
    vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
    eis('C5 drie keer op hetzelfde licht tikken geeft één melding',
        !toastZichtbaar() && regelsVan('cluster_tap_gemeld').length === 1,
        'geen tweede toast, 1 logregel',
        (toastZichtbaar() ? 'toast: ' + toastTekst() : 'geen toast')
          + ', ' + regelsVan('cluster_tap_gemeld').length + ' logregels');
    eis('C5b toast en logregel blijven in de pas — even vaak als node_vergrendeld',
        regelsVan('cluster_tap_gemeld').length === regelsVan('node_vergrendeld').length,
        'gelijk aantal',
        regelsVan('cluster_tap_gemeld').length + ' vs ' + regelsVan('node_vergrendeld').length);

    // Vervalt de lock, dan is een nieuwe tik een nieuwe beslissing.
    if (toast()) { toast().innerHTML = ''; toast().className = ''; }
    handmatigLockActief = false;
    handmatigGeselecteerdNodeId = null;
    vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
    eis('C5c na verval van de lock waarschuwt een nieuwe tik weer',
        toastZichtbaar() && regelsVan('cluster_tap_gemeld').length === 2,
        'toast, 2 logregels',
        (toastZichtbaar() ? 'toast' : 'geen toast')
          + ', ' + regelsVan('cluster_tap_gemeld').length + ' logregels');

    // ═══ C6 — BEELD-TIK BOVENOP EEN AUTO-LOCK ════════════════
    opzet('auto');
    vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
    eis('C6 een tik bovenop de stilstand-auto-lock is een eigen beslissing en waarschuwt',
        toastZichtbaar() && regelsVan('cluster_tap_gemeld').length === 1,
        'toast, 1 logregel',
        (toastZichtbaar() ? 'toast' : 'geen toast')
          + ', ' + regelsVan('cluster_tap_gemeld').length + ' logregels');
    eis('C6b maar een tik bovenop een handlock op dezelfde node niet',
        (() => {
          opzet('hand');
          vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
          return !toastZichtbaar() && regelsVan('cluster_tap_gemeld').length === 0;
        })(), 'geen toast, 0 logregels',
        (toastZichtbaar() ? 'toast' : 'geen toast')
          + ', ' + regelsVan('cluster_tap_gemeld').length + ' logregels');

    // ═══ C7 — REGRESSIE: PUUR WEERGAVE ═══════════════════════
    opzet('vrij');
    const nodeVoor = dichtstbijOSM ? String(dichtstbijOSM.id) : null;
    vergrendelNodeHandmatig(CLUSTER_A, 'beeld');
    eis('C7 de vergrendeling zet dezelfde vier velden als voorheen',
        handmatigLockActief === true && stilstandAutoLock === false
          && String(handmatigGeselecteerdNodeId) === String(CLUSTER_A)
          && typeof handmatigGeselecteerdTimestamp === 'number',
        'hand=true, auto=false, id=' + CLUSTER_A,
        handmatigLockActief + ', ' + stilstandAutoLock + ', ' + handmatigGeselecteerdNodeId);
    eis('C7b de melding wisselt de actieve node niet',
        (dichtstbijOSM ? String(dichtstbijOSM.id) : null) === nodeVoor,
        nodeVoor, dichtstbijOSM ? String(dichtstbijOSM.id) : 'null');
    eis('C7c en ze raakt het cluster-overzicht zelf niet aan',
        clusterNodes.has(String(CLUSTER_A)) && clusterNodes.has(String(CLUSTER_B))
          && clusterNodes.size === 2,
        '2 nodes', String(clusterNodes.size));

    // De knop doet één ding: de lijst openen waar de kruispuntnaam ook heen gaat.
    const knop = toastKnop();
    if (knop) knop.onclick({ stopPropagation: () => {} });
    eis('C7d de knop opent de correctielijst',
        !!overlay() && overlay().style.display === 'block',
        'display block', overlay() ? overlay().style.display : 'geen overlay');
    eis('C7e en kiest daarbij niets voor de gebruiker',
        (dichtstbijOSM ? String(dichtstbijOSM.id) : null) === nodeVoor
          && String(handmatigGeselecteerdNodeId) === String(CLUSTER_A),
        nodeVoor + ', lock ' + CLUSTER_A,
        (dichtstbijOSM ? String(dichtstbijOSM.id) : 'null') + ', lock ' + handmatigGeselecteerdNodeId);

    // De bestaande regel uit V11.18.12 mag niet zijn meegewijzigd: meldNodeVermoeden
    // laat bij een cluster nog steeds de toast vallen. Zonder dit zouden er na één
    // tik twee waarschuwingen over hetzelfde kruispunt kunnen komen.
    eis('C7f meldNodeVermoeden zwijgt bij een cluster nog steeds — geen dubbele toast',
        typeof meldNodeVermoeden === 'function'
          && /if \(!cluster\) \{/.test(String(meldNodeVermoeden)),
        'de !cluster-poort staat er nog',
        /if \(!cluster\) \{/.test(String(meldNodeVermoeden)) ? 'staat er' : 'WEG');

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
    dichtstbijOSM = bewaard.dichtstbijOSM; osmCache = bewaard.osmCache;
    huidigePos = bewaard.huidigePos;
    handmatigLockActief = bewaard.handmatigLockActief;
    stilstandAutoLock = bewaard.stilstandAutoLock;
    handmatigGeselecteerdNodeId = bewaard.handmatigGeselecteerdNodeId;
    handmatigGeselecteerdTimestamp = bewaard.handmatigGeselecteerdTimestamp;
    clusterNodes = bewaard.clusterNodes;
    laatstGemeldeClusterNode = bewaard.laatstGemeldeClusterNode;
    if (leerToastTimer) clearTimeout(leerToastTimer);
    const t = document.getElementById('leer-toast');
    if (t) { t.innerHTML = bewaard.toastHtml; t.className = bewaard.toastCls; }
    const o = document.getElementById('correctie-overlay');
    if (o) o.style.display = bewaard.overlayDisplay;
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testClusterTap = testClusterTap;
