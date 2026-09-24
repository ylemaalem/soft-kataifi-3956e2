// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_toast_past.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.23: elke melding past op een telefoonscherm, en de knop
//  in een melding is met een echte vingertik te raken.
//
//  WAT ER MIS WAS. #leer-toast stond op white-space:nowrap zonder max-width en
//  wordt gecentreerd met translateX(-50%). Een te lange regel liep daardoor aan
//  BEIDE kanten even ver buiten beeld — er werd niets afgekapt, het verdween.
//  Gemeten op 375 px waren vijf van de zeventien meldingen te breed, waaronder
//  de twee waarschuwingen van V11.18.12 (461 en 476 px) waarvoor die hele
//  release gebouwd is.
//
//  En de knop deed niets. De toast staat bewust op pointer-events:none omdat
//  hij boven het camerabeeld zweeft; .zichtbaar zette dat nergens terug, dus
//  een knop IN de toast erfde die none. Een tik landde op het element eronder.
//  Dat gold voor "Ongedaan maken" én voor "Wissel" van V11.18.22.
//
//  T1  de CSS-afspraak: geen nowrap meer, wél een max-width
//  T2  width:max-content — zonder dat kromp de toast naar 188 px
//  T3  ALLE meldingen van de app passen binnen een 375 px-scherm
//  T4  vangnet: één woord dat op zichzelf al te breed is
//  T5  de knop is aan te tikken en roept zijn callback aan
//  T6  maar de toast zelf laat tikken door naar het camerabeeld eronder
//  T7  REGRESSIE: korte meldingen blijven kort en gecentreerd; de
//      waarschuwingsvariant en .zichtbaar werken ongewijzigd
//
//  WAAROM DE METING NIET AAN HET ECHTE VENSTER HANGT
//  Deze suite draait op een laptop net zo goed als op een telefoon. T3 zet
//  daarom tijdelijk max-width op 343 px — exact wat calc(100vw - 32px) op een
//  375 px-scherm oplevert — en meet daartegen. T1 controleert los daarvan dat
//  de CSS die 343 px ook wérkelijk uit de vensterbreedte haalt. Samen dekken
//  die twee wat één meting op een toevallig vensterformaat niet kan dekken.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_toast_past.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testToastPast().regels);
// ═══════════════════════════════════════════════════════════════

function testToastPast() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const el = document.getElementById('leer-toast');
  if (!el) {
    eis('T0 #leer-toast bestaat', false, 'een element', 'niet gevonden');
    return { geslaagd: 0, gefaald: 1, regels };
  }

  // 375 px is de iPhone-klasse waarop Younes rijdt; 32 px marge (16 per kant)
  // komt overeen met #correctie-sheet, het andere zwevende paneel in de app.
  const TELEFOON = 375, MARGE = 32, BUDGET = TELEFOON - MARGE;   // 343

  const bewaard = {
    html: el.innerHTML, cls: el.className, stijl: el.getAttribute('style') || '',
    timer: (typeof leerToastTimer !== 'undefined') ? leerToastTimer : null
  };
  const stil = () => { if (typeof leerToastTimer !== 'undefined' && leerToastTimer) clearTimeout(leerToastTimer); };

  // De teksten hieronder spiegelen de toonToast-aanroepen in index.html. De
  // twee met een variabele erin nemen de LANGSTE mogelijke waarde, want dat is
  // het geval dat moet passen.
  const langste = (o) => Object.values(o || {}).sort((a, b) => String(b).length - String(a).length)[0] || '';
  const K  = langste(typeof KLASSE_NAMEN !== 'undefined' ? KLASSE_NAMEN : {});
  const KP = langste(typeof KOPPEL_NAAM  !== 'undefined' ? KOPPEL_NAAM  : {});
  const KNOP = (label) => ({ label, duurMs: 60000, fn: () => { window.__toastKnopGeraakt = label; } });

  const meldingen = [
    ['opslag vol',            '⚠️ Opslag vol - metingen worden niet bewaard', null],
    ['tweede model',          'Tweede model: D-FINE-N', null],
    ['modelvergelijking',     'Modelvergelijking: UIT', null],
    ['klasse + groene fase',  '✅ Opgeslagen als ' + K + ' — groene fase wordt automatisch verzameld', null],
    ['klasse',                '✅ Opgeslagen als ' + K, null],
    ['correctielimiet',       '⚠️ Correctie-limiet sessie bereikt', null],
    ['koppeling losgemaakt',  'Koppeling losgemaakt', null],
    ['telt nu als',           'Dit kruispunt telt nu als ' + KP, null],
    ['max 2',                 'Max 2', null],
    ['opslag vol bij merge',  '⚠️ Opslag vol — samenvoegen teruggedraaid', null],
    ['niets te verplaatsen',  'Niets te verplaatsen — deze metingen horen al bij een richting', null],
    ['samengevoegd + knop',   '✅ Samengevoegd', KNOP('Ongedaan maken')],
    ['teruggedraaid',         '↩️ Teruggedraaid', null],
    ['cluster na beeld-tik',  (typeof CLUSTER_TAP_TEKST !== 'undefined' ? CLUSTER_TAP_TEKST : '⚠ Meerdere masten — klopt deze?'), KNOP('Wissel')],
    ['cluster bij nadering',  '⚠ Meerdere stoplichten dicht bij elkaar', null],
    ['vermoeden afstand',     '⚠ Ander stoplicht ligt 12m dichterbij — tik op de naam', null],
    ['vermoeden hoek',        '⚠ Ander stoplicht staat rechter vooruit — tik op de naam', null]
  ];

  const breedte = (tekst, actie) => {
    toonToast(tekst, actie || null, 'waarschuwing'); stil();
    return el.getBoundingClientRect().width;
  };

  try {
    const cs = getComputedStyle(el);

    // ══ T1 — DE CSS-AFSPRAAK ═════════════════════════════════
    eis('T1 de toast breekt af in plaats van buiten beeld te lopen',
        cs.whiteSpace !== 'nowrap', 'geen nowrap', cs.whiteSpace);
    eis('T1b er is een max-width, en die is smaller dan het scherm',
        cs.maxWidth !== 'none' && parseFloat(cs.maxWidth) > 0
          && parseFloat(cs.maxWidth) < window.innerWidth,
        '< ' + window.innerWidth + 'px', cs.maxWidth);
    eis('T1c die max-width is de vensterbreedte min 32 px — 16 per kant, als #correctie-sheet',
        Math.abs(parseFloat(cs.maxWidth) - (window.innerWidth - MARGE)) < 1.5,
        (window.innerWidth - MARGE) + 'px', cs.maxWidth);

    // ══ T2 — width:max-content ═══════════════════════════════
    // Zonder deze regel rekent de browser de breedte tegen de ruimte RECHTS van
    // left:50%, dus tegen 100vw-50%. De toast kromp daardoor naar 188 px en
    // werd drie regels hoog terwijl hij 343 px had mogen gebruiken.
    el.style.maxWidth = BUDGET + 'px';
    const langeMelding = breedte('⚠ Ander stoplicht ligt 12m dichterbij — tik op de naam', null);
    eis('T2 een lange melding gebruikt de volle breedte, niet de helft van het scherm',
        langeMelding > BUDGET * 0.9,
        '> ' + Math.round(BUDGET * 0.9) + 'px', Math.round(langeMelding) + 'px');

    // ══ T3 — ALLE MELDINGEN PASSEN ═══════════════════════════
    const teBreed = meldingen
      .map(([naam, t, a]) => ({ naam, px: Math.round(breedte(t, a)) }))
      .filter(x => x.px > BUDGET + 0.5);
    eis('T3 alle ' + meldingen.length + ' meldingen passen op een 375 px-scherm',
        teBreed.length === 0, '0 te breed',
        teBreed.length ? teBreed.map(x => x.naam + ' ' + x.px + 'px').join(', ') : '0 te breed');

    // ══ T4 — VANGNET VOOR EEN ONDEELBAAR WOORD ═══════════════
    const woord = Math.round(breedte('A'.repeat(90), null));
    eis('T4 zelfs één onafgebroken woord blijft binnen de marge',
        woord <= BUDGET + 0.5, '<= ' + BUDGET + 'px', woord + 'px');
    el.style.maxWidth = '';

    // ══ T5 — DE KNOP IS TE RAKEN ═════════════════════════════
    // elementFromPoint + click, niet knop.onclick() rechtstreeks: dat laatste
    // omzeilt pointer-events en zou de bug van V11.18.22 niet hebben gezien.
    const tikOpKnop = (tekst, label) => {
      window.__toastKnopGeraakt = null;
      toonToast(tekst, KNOP(label), 'waarschuwing'); stil();
      const b = el.querySelector('.toast-actie');
      if (!b) return { raakt: false, callback: null, reden: 'geen knop' };
      const r = b.getBoundingClientRect();
      const onder = document.elementFromPoint(Math.round(r.left + r.width / 2),
                                              Math.round(r.top + r.height / 2));
      if (onder && onder.click) onder.click();
      return { raakt: onder === b, callback: window.__toastKnopGeraakt,
               reden: onder ? (onder.id || onder.className || onder.tagName) : 'niets' };
    };
    const w = tikOpKnop(typeof CLUSTER_TAP_TEKST !== 'undefined' ? CLUSTER_TAP_TEKST : 'x', 'Wissel');
    eis('T5 een tik midden op "Wissel" landt op de knop en roept hem aan',
        w.raakt && w.callback === 'Wissel',
        'knop + callback', 'raakte ' + w.reden + ', callback ' + w.callback);
    const o = tikOpKnop('✅ Samengevoegd', 'Ongedaan maken');
    eis('T5b hetzelfde voor "Ongedaan maken" — die deed het ook nooit',
        o.raakt && o.callback === 'Ongedaan maken',
        'knop + callback', 'raakte ' + o.reden + ', callback ' + o.callback);

    // ══ T6 — MAAR DE TOAST ZELF BLIJFT DOORLATEND ════════════
    // Cruciaal: de melding zweeft boven het camerabeeld. Zou zij zelf tikken
    // opvangen, dan slikte ze zes seconden lang precies de tik waarmee de
    // gebruiker een stoplicht aanwijst.
    toonToast('⚠ Meerdere stoplichten dicht bij elkaar', null, 'waarschuwing'); stil();
    const rt = el.getBoundingClientRect();
    const onderToast = document.elementFromPoint(Math.round(rt.left + 8),
                                                 Math.round(rt.top + rt.height / 2));
    eis('T6 een tik op de melding zelf gaat door naar wat eronder ligt',
        onderToast !== el && !el.contains(onderToast),
        'niet de toast', onderToast ? (onderToast.id || onderToast.tagName) : 'niets');

    // ══ T7 — REGRESSIE ═══════════════════════════════════════
    const kort = breedte('Max 2', null);
    const rk = el.getBoundingClientRect();
    eis('T7 een korte melding blijft kort — geen balk over het hele scherm',
        kort < 150, '< 150px', Math.round(kort) + 'px');
    eis('T7b en blijft gecentreerd',
        Math.abs(rk.left - (window.innerWidth - rk.right)) < 2,
        'gelijke marges', Math.round(rk.left) + ' vs ' + Math.round(window.innerWidth - rk.right));
    // NIET op getComputedStyle(el).opacity: #leer-toast heeft transition:opacity
    // 0.3s, dus vlak na het zetten van de klasse staat de geanimeerde waarde nog
    // op 0. Dat zou een test opleveren die van timing afhangt. De vraag is of de
    // CSS-REGELS na de herschrijving nog kloppen, en die staan in de CSSOM.
    const toastRegels = [...document.styleSheets]
      .flatMap(sh => { try { return [...sh.cssRules]; } catch (e) { return []; } })
      .filter(r => r.selectorText && r.selectorText.indexOf('leer-toast') !== -1)
      .map(r => r.cssText);
    eis('T7c de waarschuwingsvariant en .zichtbaar staan er nog als eigen regel',
        el.classList.contains('waarschuwing') && el.classList.contains('zichtbaar')
          && toastRegels.some(t => /\.zichtbaar\b/.test(t) && /opacity:\s*1/.test(t))
          && toastRegels.some(t => /\.waarschuwing\b/.test(t) && /background/.test(t)),
        'beide klassen + beide regels',
        el.className + ' | ' + toastRegels.length + ' regels gevonden');
    toonToast('Max 2', null, null); stil();
    eis('T7d en een gewone leermelding is nog steeds niet oranje',
        !el.classList.contains('waarschuwing'), 'geen waarschuwing', el.className);

  } finally {
    stil();
    el.innerHTML = bewaard.html;
    el.className = bewaard.cls;
    if (bewaard.stijl) el.setAttribute('style', bewaard.stijl); else el.removeAttribute('style');
    try { delete window.__toastKnopGeraakt; } catch (e) { window.__toastKnopGeraakt = undefined; }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testToastPast = testToastPast;
