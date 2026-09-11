// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_nodeinfo_paneel.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.97: het node-info-paneel is niet langer beperkt tot
//  stilstand, en sluit zichzelf na 20 seconden zonder interactie.
//
//  WAT ER VERANDERDE
//  openNodeInfo had `if (snelheidKmh > 15) return;` — een poort die in V11.16.1
//  was overgenomen van de klasse-correctieknop en hier nooit apart is
//  afgewogen. Erger dan de beperking was de vorm: de demping was een
//  CSS-klasse en niet het disabled-attribuut, dus de tap kwam wél aan en
//  verdween stilzwijgend. Beide zijn weg.
//
//  WAT ER NIET MEE MAG VERANDEREN
//  openKlasseCorrectie houdt zijn drempel. Daar is de eis inhoudelijk: die knop
//  beoordeelt een LEVENDE camera-detectie, en dat oordeel kan niet rijdend.
//  T3 is daarom een regressiewacht en geen bijvangst — zou hij meeveranderen,
//  dan was deze release te breed.
//
//  WAAROM DE KLOK NIET MET EEN ECHTE WACHT GETOETST WORDT
//  Twintig seconden per toets is onwerkbaar. nodeInfoAutoSluit is daarom een
//  eigen benoemde functie in plaats van een inline setTimeout-body: elke tak
//  (dicht, dialoog open, al gesloten) is los aan te roepen. De KOPPELING tussen
//  timer en functie wordt apart getoetst — T4 kijkt of er een handle staat en
//  T5 of een aanraking er een nieuwe van maakt.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_nodeinfo_paneel.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testNodeinfoPaneel().regels);
// ═══════════════════════════════════════════════════════════════

function testNodeinfoPaneel() {
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

  const NODE = 994001;
  const DD_NU = huidigDDActief();
  const nu = Date.now();

  const bewaard = {
    snelheidKmh, dichtstbijOSM, nodeInfoNodeId, mergeModusAan,
    mergeSelectie: [...mergeSelectie], nodeInfoChipLaatsteNode, laatsteAI,
    overlayDisp: (document.getElementById('node-info-overlay') || {}).style
                   ? document.getElementById('node-info-overlay').style.display : null,
    klasseDisp: (document.getElementById('klasse-correctie-overlay') || {}).style
                   ? document.getElementById('klasse-correctie-overlay').style.display : null,
    dlgDisp: (document.getElementById('node-info-mergedialoog') || {}).style
                   ? document.getElementById('node-info-mergedialoog').style.display : null,
    chipKlasse: (document.getElementById('node-info-chip') || {}).className,
    infoHtml: (document.getElementById('node-info-body') || {}).innerHTML
  };

  const overlay = () => document.getElementById('node-info-overlay');
  const open    = () => overlay().style.display === 'block';
  const chip    = () => document.getElementById('node-info-chip');
  const dlg     = () => document.getElementById('node-info-mergedialoog');
  const sheet   = () => document.getElementById('node-info-sheet');
  const klasseOpen = () => document.getElementById('klasse-correctie-overlay').style.display === 'block';

  const recs = (n, duur) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push({ duur, tijd: nu - i * 60000, gewicht: 1, obs: duur, bron: 's1' });
    return a;
  };

  try {
    zetLS('sl_v4_' + NODE + '_' + DD_NU, JSON.stringify(recs(8, 60)));
    zetLS('sl_neutraal_' + NODE, null);
    zetLS('sl_enkelricht_' + NODE, null);
    dichtstbijOSM = { id: NODE, lat: 52.0, lon: 4.7, afstand: 25, naam: 'Testkruising' };

    // ══ T1 — GEEN SNELHEIDSPOORT MEER ═════════════════════════
    const snelheden = [0, 14, 15, 16, 50, 120];
    const mislukt = [];
    for (const v of snelheden) {
      sluitNodeInfo();
      snelheidKmh = v;
      openNodeInfo();
      if (!open()) mislukt.push(v + ' km/u');
    }
    eis('T1 het paneel gaat open bij elke snelheid',
        mislukt.length === 0, 'alle zes', mislukt.length ? 'dicht bij: ' + mislukt.join(', ') : 'alle zes');
    sluitNodeInfo();
    snelheidKmh = 80;
    openNodeInfo();
    eis('T1b en de node komt gewoon binnen, ook rijdend',
        nodeInfoNodeId === String(NODE), String(NODE), String(nodeInfoNodeId));

    // ══ T2 — DE CHIP IS NIET MEER GEDEMPT ═════════════════════
    // updateKlasseCorrectieBtnState draait 2x per seconde vanuit lus() en zette
    // hier de klasse. Die regel is weg; de chip mag bij geen enkele snelheid
    // nog dimmen.
    const gedimd = [];
    for (const v of [0, 16, 50, 120]) {
      snelheidKmh = v;
      updateKlasseCorrectieBtnState();
      if (chip().classList.contains('disabled')) gedimd.push(v + ' km/u');
    }
    eis('T2 de chip toont geen disabled-staat meer, ongeacht snelheid',
        gedimd.length === 0, 'nooit gedimd',
        gedimd.length ? 'gedimd bij: ' + gedimd.join(', ') : 'nooit gedimd');

    // ══ T3 — REGRESSIEWACHT: DE KLASSEKNOP HOUDT ZIJN DREMPEL ══
    // Die knop beoordeelt wat de camera NU ziet. Zou hij meeveranderd zijn,
    // dan was deze release te breed geweest.
    document.getElementById('klasse-correctie-overlay').style.display = 'none';
    laatsteAI = { kleur: 'rood', box: { x: 10, y: 10, w: 20, h: 40 }, score: 0.9 };
    snelheidKmh = 50;
    openKlasseCorrectie();
    eis('T3 openKlasseCorrectie blijft geblokkeerd boven 15 km/u',
        !klasseOpen(), 'dicht', klasseOpen() ? 'OPEN' : 'dicht');
    snelheidKmh = 60;
    updateKlasseCorrectieBtnState();
    eis('T3b en de klasse-knop zelf blijft rijdend uitgeschakeld',
        document.getElementById('klasse-correctie-btn').disabled === true,
        'disabled', String(document.getElementById('klasse-correctie-btn').disabled));
    snelheidKmh = 0;
    updateKlasseCorrectieBtnState();
    eis('T3c maar bij stilstand mét detectie werkt hij gewoon',
        document.getElementById('klasse-correctie-btn').disabled === false,
        'niet disabled', String(document.getElementById('klasse-correctie-btn').disabled));
    document.getElementById('klasse-correctie-overlay').style.display = 'none';

    // ══ T4 — DE KLOK LOOPT VANAF HET OPENEN ═══════════════════
    sluitNodeInfo();
    eis('T4 met een gesloten paneel loopt er geen klok',
        nodeInfoTimer === null, 'null', String(nodeInfoTimer));
    snelheidKmh = 30;
    openNodeInfo();
    eis('T4b openen zet de klok aan',
        nodeInfoTimer !== null && open(), 'handle + open paneel',
        (nodeInfoTimer !== null ? 'handle' : 'GEEN handle') + ', ' + (open() ? 'open' : 'dicht'));
    eis('T4c en hij staat op 20 seconden',
        NODE_INFO_INACTIEF_MS === 20000, '20000', String(NODE_INFO_INACTIEF_MS));

    // ══ T5 — ELKE AANRAKING ZET DE KLOK OPNIEUW ═══════════════
    // De listener hangt in de CAPTURE-fase op de sheet: de sheet stopt zelf de
    // propagatie naar de overlay, dus een gewone bubbel-listener zou de helft
    // van de taps missen.
    const handleVoor = nodeInfoTimer;
    sheet().dispatchEvent(new Event('pointerdown', { bubbles: true }));
    const naTap = nodeInfoTimer;
    eis('T5 een tik in het paneel vervangt de lopende klok door een nieuwe',
        naTap !== null && naTap !== handleVoor, 'nieuwe handle',
        naTap === handleVoor ? 'ZELFDE handle' : 'nieuwe handle');
    // Ook een tik op een knop DIEP in het paneel, die zijn eigen propagatie stopt.
    const knop = document.getElementById('node-info-sluiten');
    const handle2 = nodeInfoTimer;
    knop.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    eis('T5b ook een tik op een knop binnen het paneel telt als activiteit',
        nodeInfoTimer !== null && nodeInfoTimer !== handle2, 'nieuwe handle',
        nodeInfoTimer === handle2 ? 'ZELFDE handle' : 'nieuwe handle');
    // Scrollen telt ook — daar staat de gebruiker het langst mee stil.
    const handle3 = nodeInfoTimer;
    sheet().dispatchEvent(new Event('scroll', { bubbles: true }));
    eis('T5c en scrollen in de lijst ook',
        nodeInfoTimer !== null && nodeInfoTimer !== handle3, 'nieuwe handle',
        nodeInfoTimer === handle3 ? 'ZELFDE handle' : 'nieuwe handle');
    eis('T5d het paneel staat na al die activiteit nog steeds open',
        open(), 'open', open() ? 'open' : 'DICHT');

    // ══ T6 — DE KLOK LOOPT AF: PANEEL DICHT ═══════════════════
    eis('T6 nodeInfoAutoSluit sluit het paneel',
        (nodeInfoAutoSluit(), !open() && nodeInfoNodeId === null),
        'dicht, node losgelaten',
        (open() ? 'OPEN' : 'dicht') + ', node ' + nodeInfoNodeId);
    eis('T6b en laat geen klok achter',
        nodeInfoTimer === null, 'null', String(nodeInfoTimer));
    // Op een al gesloten paneel is hij een no-op — geen tweede sluiting, geen fout.
    let stuk = false;
    try { nodeInfoAutoSluit(); } catch (e) { stuk = true; }
    eis('T6c op een al gesloten paneel doet hij niets',
        !stuk && !open() && nodeInfoTimer === null,
        'geen fout, blijft dicht', stuk ? 'wierp een fout' : 'geen fout');

    // ══ T7 — EEN OPEN KEUZE-DIALOOG PAUZEERT ══════════════════
    // Daar staat een vraag die de gebruiker nog moet beantwoorden; die mag niet
    // onder zijn handen vandaan verdwijnen.
    openNodeInfo();
    dlg().style.display = 'block';
    const handleDlg = nodeInfoTimer;
    nodeInfoAutoSluit();
    eis('T7 met een open dialoog blijft het paneel staan',
        open() && nodeInfoNodeId === String(NODE),
        'open', open() ? 'open' : 'DICHT');
    eis('T7b en de klok gaat opnieuw lopen in plaats van te stoppen',
        nodeInfoTimer !== null && nodeInfoTimer !== handleDlg,
        'nieuwe handle', nodeInfoTimer === null ? 'GEEN handle' : 'nieuwe handle');
    // Dialoog dicht → de volgende afloop sluit wel.
    sluitMergeDialoog();
    nodeInfoAutoSluit();
    eis('T7c zodra de dialoog dicht is sluit de eerstvolgende afloop het paneel',
        !open(), 'dicht', open() ? 'OPEN' : 'dicht');

    // ══ T8 — HANDMATIG SLUITEN ONGEWIJZIGD ════════════════════
    openNodeInfo();
    mergeModusAan = true; mergeSelectie = ['ALG'];
    dlg().style.display = 'block';
    sluitNodeInfo();
    eis('T8 handmatig sluiten werkt zoals voorheen',
        !open() && nodeInfoNodeId === null && mergeModusAan === false
        && mergeSelectie.length === 0 && dlg().style.display === 'none',
        'alles opgeruimd',
        [open() ? 'open' : 'dicht', 'node ' + nodeInfoNodeId,
         'merge ' + mergeModusAan, 'sel ' + mergeSelectie.length,
         'dlg ' + dlg().style.display].join(', '));
    eis('T8b en ruimt de klok mee op — anders sluit hij straks een paneel dat al opnieuw open is',
        nodeInfoTimer === null, 'null', String(nodeInfoTimer));
    // Opnieuw openen na een handmatige sluiting geeft een verse klok.
    openNodeInfo();
    eis('T8c opnieuw openen start een nieuwe klok',
        nodeInfoTimer !== null && open(), 'handle + open',
        (nodeInfoTimer !== null ? 'handle' : 'GEEN handle'));

    // ══ T9 — DE UNDO-TOAST OVERLEEFT EEN SLUITING ═════════════
    // De 'Ongedaan maken'-knop van een samenvoeging staat in #leer-toast, BUITEN
    // het paneel. Ook een automatische sluiting haalt hem dus niet weg — en in
    // de praktijk komt hij er niet eens aan toe: de tik die de samenvoeging
    // uitvoert reset de klok op 20 seconden, ruim boven de 6 van de toast.
    toonToast('proef', { label: 'Ongedaan maken', duurMs: 6000, fn: () => {} });
    const toastEl = document.getElementById('leer-toast');
    const toastZichtbaar = () => toastEl.className.indexOf('zichtbaar') >= 0
                              || toastEl.style.display !== 'none';
    const voor = toastZichtbaar();
    nodeInfoAutoSluit();
    eis('T9 een sluiting raakt de undo-toast niet',
        voor && toastZichtbaar() && !open(),
        'toast blijft, paneel dicht',
        'toast ' + toastZichtbaar() + ', paneel ' + (open() ? 'open' : 'dicht'));
    eis('T9b en de toastduur past ruim binnen het inactiviteitsvenster',
        6000 < NODE_INFO_INACTIEF_MS, '6000 < 20000',
        '6000 vs ' + NODE_INFO_INACTIEF_MS);

  } finally {
    for (const [k, v] of bewaardLS) {
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    }
    if (nodeInfoTimer) { clearTimeout(nodeInfoTimer); nodeInfoTimer = null; }
    snelheidKmh = bewaard.snelheidKmh;
    dichtstbijOSM = bewaard.dichtstbijOSM;
    nodeInfoNodeId = bewaard.nodeInfoNodeId;
    mergeModusAan = bewaard.mergeModusAan;
    mergeSelectie = bewaard.mergeSelectie;
    nodeInfoChipLaatsteNode = bewaard.nodeInfoChipLaatsteNode;
    laatsteAI = bewaard.laatsteAI;
    const ov = document.getElementById('node-info-overlay');
    if (ov) ov.style.display = bewaard.overlayDisp || 'none';
    const kv = document.getElementById('klasse-correctie-overlay');
    if (kv) kv.style.display = bewaard.klasseDisp || 'none';
    const dg = document.getElementById('node-info-mergedialoog');
    if (dg) dg.style.display = bewaard.dlgDisp || 'none';
    const ch = document.getElementById('node-info-chip');
    if (ch && bewaard.chipKlasse != null) ch.className = bewaard.chipKlasse;
    const bd = document.getElementById('node-info-body');
    if (bd && bewaard.infoHtml != null) bd.innerHTML = bewaard.infoHtml;
    // De proef-toast niet laten staan: hij overlapt het scherm zes seconden en
    // zou een volgende suite die op toastklassen kijkt in de war brengen.
    const tst = document.getElementById('leer-toast');
    if (tst) tst.className = tst.className.replace(/\bzichtbaar\b/g, '').trim();
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testNodeinfoPaneel = testNodeinfoPaneel;
