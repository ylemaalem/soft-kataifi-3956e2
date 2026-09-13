// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_mv_trigger.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.9: de verborgen 5-tikken-zone waarmee de modelvergelijking
//  aan en uit gaat zonder console en zonder Mac.
//
//  WAT ER BEWAAKT WORDT
//  T1  vijf tikken binnen het venster schakelen; minder tikken doen niets
//  T2  de tweede keer toont de RESULTATEN in plaats van meteen uit te zetten
//  T3  het TEST-merkteken volgt de toestand, op beide plekken
//  T4  de bestaande meetlogica is ongemoeid — dit is een tweede toegangsweg
//
//  DE HERLAAD WORDT NIET UITGEVOERD IN DE TEST
//  mvTrigger plant een location.reload() via mvPlanHerlaad. De test vervangt
//  location.reload EN annuleert de openstaande timer in de finally — zonder dat
//  tweede deel vuurt hij 1,2 s later alsnog, nadat de echte reload is
//  teruggezet, en herlaadt de pagina midden in de suite.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_mv_trigger.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testMvTrigger().regels);
// ═══════════════════════════════════════════════════════════════

function testMvTrigger() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const bewaardAan = localStorage.getItem('sl_modelvgl_aan');
  const bewaardStat = localStorage.getItem('sl_modelvgl');
  const bewaardTikken = mvTikken.slice();

  // location.reload afvangen: mvTrigger en mvZetUit plannen er een. Zonder
  // deze vervanging zou de testpagina zichzelf midden in de suite herladen.
  const echteReload = location.reload;
  let herlaadTeller = 0;
  try { location.reload = () => { herlaadTeller++; }; } catch (e) {}

  const aanZetten = (aan) => {
    if (aan) localStorage.setItem('sl_modelvgl_aan', '1');
    else localStorage.removeItem('sl_modelvgl_aan');
    mvTikken = [];
    mvWerkIndicatorBij();
  };
  const overlayOpen = () =>
    document.getElementById('mv-overlay').classList.contains('zichtbaar');
  const badgeInDebug = () =>
    !!document.querySelector('#d-test .mv-test-badge');
  const badgeBijVersie = () =>
    !!document.querySelector('#s-versie .mv-test-badge');

  try {
    // ═══ T1 — VIJF TIKKEN SCHAKELEN, MINDER NIET ═════════════
    aanZetten(false);
    let geschakeld = false;
    for (let i = 0; i < 4; i++) geschakeld = mvTik() || geschakeld;
    eis('T1 vier tikken activeren niets',
        geschakeld === false && mvIsAan() === false,
        'niet geschakeld', 'geschakeld=' + geschakeld + ', aan=' + mvIsAan());
    eis('T1b de teller staat wel op 4',
        mvTikken.length === 4, '4', String(mvTikken.length));
    // de vijfde maakt het af
    const vijfde = mvTik();
    eis('T1c de vijfde tik schakelt de modus aan',
        vijfde === true && mvIsAan() === true,
        'true, modus aan', vijfde + ', aan=' + mvIsAan());
    eis('T1d en de teller is daarna leeg, zodat één tik extra niets doet',
        mvTikken.length === 0, '0', String(mvTikken.length));
    eis('T1e er is een herlaad ingepland',
        herlaadTeller === 0, '0 (pas na de vertraging)', String(herlaadTeller));

    // Twee en drie tikken doen evenmin iets.
    for (const n of [2, 3]) {
      aanZetten(false);
      let g = false;
      for (let i = 0; i < n; i++) g = mvTik() || g;
      eis('T1f ' + n + ' tikken activeren niets',
          g === false && mvIsAan() === false, 'niet geschakeld',
          'geschakeld=' + g);
    }

    // Buiten het tijdvenster telt een tik niet mee: vier oude plus één nieuwe
    // mag níét schakelen.
    aanZetten(false);
    for (let i = 0; i < 4; i++) mvTik();
    mvTikken = mvTikken.map(t => t - (MV_TIK_VENSTER_MS + 500));   // veroudert ze
    const naVenster = mvTik();
    eis('T1g tikken van langer dan ' + (MV_TIK_VENSTER_MS / 1000) + 's geleden tellen niet mee',
        naVenster === false && mvIsAan() === false,
        'niet geschakeld', 'geschakeld=' + naVenster);

    // ═══ T2 — DE TWEEDE KEER TOONT RESULTATEN ════════════════
    aanZetten(true);
    mvSluit();
    const uitkomst = mvTrigger();
    eis('T2 met de modus AAN toont de trigger de resultaten',
        uitkomst === 'overlay' && overlayOpen(),
        "'overlay', zichtbaar", uitkomst + ', open=' + overlayOpen());
    eis('T2b en zet hem NIET meteen uit',
        mvIsAan() === true, 'nog steeds aan', String(mvIsAan()));

    // zonder data: de juiste melding
    localStorage.removeItem('sl_modelvgl');
    mvToonOverlay();
    eis('T2c zonder data staat er "Nog geen data"',
        document.getElementById('mv-inhoud').textContent.includes('Nog geen data'),
        'Nog geen data — rijd eerst een rit',
        document.getElementById('mv-inhoud').textContent.slice(0, 40));

    // met data: de zes regels uit de opdracht
    localStorage.setItem('sl_modelvgl', JSON.stringify({
      start: Date.now(), n: 412, somMsA: 412 * 1066, somMsB: 412 * 331,
      maxMsA: 1420, maxMsB: 480, eens: 391, oneens: 21, matrix: {}, voorbeelden: []
    }));
    mvToonOverlay();
    const tekst = document.getElementById('mv-inhoud').textContent;
    eis('T2d met data staan alle zes de regels er',
        tekst.includes('Frames vergeleken: 412')
        && tekst.includes('Model A (groot, 42MB): gem 1066ms')
        && tekst.includes('Model B (klein, 12MB): gem 331ms')
        && tekst.includes('Sneller: 3,2×')
        && tekst.includes('Zelfde uitkomst: 95%')
        && tekst.includes('Verschillend: 5%'),
        'zes regels met de juiste cijfers', tekst.replace(/\n/g, ' | '));

    // 'Laat aan staan' sluit alleen
    mvSluit();
    eis('T2e "Laat aan staan" sluit de overlay en laat de modus aan',
        !overlayOpen() && mvIsAan() === true,
        'dicht, nog aan', 'open=' + overlayOpen() + ', aan=' + mvIsAan());

    // 'Zet uit' zet pas dán uit
    mvToonOverlay();
    const voorUit = herlaadTeller;
    mvZetUit();
    eis('T2f "Zet uit" schakelt de modus uit en sluit de overlay',
        mvIsAan() === false && !overlayOpen(),
        'uit en dicht', 'aan=' + mvIsAan() + ', open=' + overlayOpen());
    eis('T2g en laat de verzamelde resultaten staan',
        localStorage.getItem('sl_modelvgl') !== null,
        'resultaten bewaard', String(localStorage.getItem('sl_modelvgl') !== null));

    // ═══ T3 — HET TEST-MERKTEKEN ═════════════════════════════
    aanZetten(true);
    eis('T3 met de modus aan staat het merkteken in de debugbalk',
        badgeInDebug(), 'TEST zichtbaar', badgeInDebug() ? 'zichtbaar' : 'ONTBREEKT');
    eis('T3b en naast het versienummer',
        badgeBijVersie(), 'TEST zichtbaar', badgeBijVersie() ? 'zichtbaar' : 'ONTBREEKT');
    aanZetten(false);
    eis('T3c met de modus uit is hij op beide plekken weg',
        !badgeInDebug() && !badgeBijVersie(), 'beide weg',
        'debug=' + badgeInDebug() + ', versie=' + badgeBijVersie());
    // twee keer aanroepen mag geen dubbel merkteken geven
    aanZetten(true); mvWerkIndicatorBij(); mvWerkIndicatorBij();
    eis('T3d herhaald bijwerken geeft geen dubbel merkteken',
        document.querySelectorAll('#s-versie .mv-test-badge').length === 1,
        '1', String(document.querySelectorAll('#s-versie .mv-test-badge').length));

    // ═══ T4 — DE BESTAANDE MEETLOGICA IS ONGEMOEID ═══════════
    eis('T4 de UI gebruikt dezelfde sleutel als de console-route',
        mvIsAan() === (localStorage.getItem('sl_modelvgl_aan') === '1'),
        'zelfde sleutel', 'gelijk');
    eis('T4b modelVergelijking() bestaat nog en leest dezelfde opslag',
        typeof window.modelVergelijking === 'function'
        && /412/.test(window.modelVergelijking()),
        'leest 412 frames', String(window.modelVergelijking()).split('\n')[0]);
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    eis('T4c de trigger schrijft alleen de aan/uit-sleutel, niet de resultaten',
        !/sl_modelvgl'/.test(zc(mvTrigger)) && !/sl_modelvgl'/.test(zc(mvZetUit)),
        'raakt sl_modelvgl niet aan', 'schoon');
    eis('T4d de meetfuncties zelf zijn niet vervangen',
        typeof vglKoppel === 'function' && typeof vglBeste === 'function'
        && typeof startVglWorker === 'function',
        'alle drie aanwezig', 'aanwezig');

    // ═══ T5 — HET VERSIELABEL KOMT UIT ÉÉN BRON ════════
    // V11.18.9: het nummer stond in de HTML én in een commentaarkop, en liep
    // daardoor twee releases achter. Nu vult APP_VERSIE het label. Deze toets
    // bewaakt dat ze niet opnieuw uit elkaar lopen: zou iemand de HTML weer
    // hardcoderen, of het vullen weghalen, dan valt hij om.
    aanZetten(false);   // zonder TEST-merkteken, anders plakt dat aan de tekst
    const verEl = document.getElementById('s-versie');
    eis('T5 het zichtbare label is exact APP_VERSIE',
        verEl.textContent === APP_VERSIE,
        APP_VERSIE, verEl.textContent);
    // startsWith en geen reguliere expressie: een versienummer zit vol punten
    // die in een regex ontsnapt moeten worden, en juist dat ging bij het
    // schrijven van dit bestand mis — er belandde een letterlijk
    // backspace-teken in de expressie, waardoor de toets nooit kon slagen.
    // Een kale stringvergelijking kan dat niet overkomen.
    eis('T5b en APP_VERSIE draagt het huidige versienummer',
        APP_VERSIE.startsWith('V11.18.9'),
        'begint met V11.18.9', APP_VERSIE);

    // De tekstwijziging mag de klik-handler niet geraakt hebben: vijf echte
    // kliks op het bijgewerkte label moeten nog steeds schakelen.
    aanZetten(false);
    for (let i = 0; i < 4; i++) verEl.click();
    const naVier = mvIsAan();
    verEl.click();
    eis('T5d vijf ECHTE kliks op het bijgewerkte label schakelen nog steeds',
        naVier === false && mvIsAan() === true,
        'pas bij de vijfde aan', 'na 4: ' + naVier + ', na 5: ' + mvIsAan());

  } finally {
    if (mvHerlaadTimer) { clearTimeout(mvHerlaadTimer); mvHerlaadTimer = null; }
    try { location.reload = echteReload; } catch (e) {}
    if (bewaardAan === null) localStorage.removeItem('sl_modelvgl_aan');
    else localStorage.setItem('sl_modelvgl_aan', bewaardAan);
    if (bewaardStat === null) localStorage.removeItem('sl_modelvgl');
    else localStorage.setItem('sl_modelvgl', bewaardStat);
    mvTikken = bewaardTikken;
    mvSluit();
    mvWerkIndicatorBij();
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testMvTrigger = testMvTrigger;
