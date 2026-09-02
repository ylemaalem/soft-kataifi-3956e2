// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_knopkleur.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.77: de kleurstaat van de bevestigknoppen.
//
//  WAT HIER VASTLIGT
//
//  T1-T5 lopen de vijf toestanden uit de bevestigmatrix af en stellen per
//  toestand vast welke knop de inert-klasse draagt. Die matrix is de afspraak
//  tussen wat de gebruiker ziet en wat er geregistreerd wordt: de demping IS
//  de schrijfpoort (bevestigCountdown r7297 keert terug op klopteIsNoOp).
//  Verschuift de matrix, dan verschuift ongemerkt ook wat het leergeheugen in
//  gaat — vandaar dat hij hier per toestand is vastgelegd.
//
//  T6 is de invariant: KLOPTE en BIJNA mogen NOOIT tegelijk oplichten. Hij
//  geldt nu per constructie (klopteIsNoOp eist indeling 'goed', bijnaIsNoOp
//  'bijna' of vóór-nul), maar zodra iemand het venster symmetrisch maakt —
//  de release die hierna komt — breekt hij zonder aanpassing van bijnaIsNoOp.
//  Deze test is de wacht daarop.
//
//  T8-T11 toetsen de visuele helft: uit moet als GRIJS lezen (saturate(0),
//  niet de oude 0.4 die 40% kleur vasthield), en de actieve knop draagt een
//  ring in de eigen kleur. T12 bewaakt dat de ring meeloopt in de bestaande
//  200ms-transitie in plaats van hard te springen.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_knopkleur.js';
//      document.head.appendChild(s);
//      s.onload = async () => console.table((await testKnopkleur()).regels);
// ═══════════════════════════════════════════════════════════════

async function testKnopkleur() {
  const regels = [];
  // De ring loopt mee in de 200ms-transitie (V4). getComputedStyle levert
  // tijdens die overgang de geïnterpoleerde waarde — vlak na een klassewissel
  // dus een transparante schaduw van nul groot. De ring-toetsen wachten de
  // overgang daarom uit; dat toetst meteen dat hij ook op de júiste kleur
  // uitkomt in plaats van alleen dat er iets gezet is.
  const wacht = (ms) => new Promise(r => setTimeout(r, ms));
  // De ring wordt NIET op getComputedStyle().boxShadow getoetst. box-shadow
  // staat in de transitie (V4), en een transitie die vanaf `none` vertrekt
  // begint op een transparante schaduw van nul groot. In een paneel dat zijn
  // animaties throttelt blijft die waarde daar staan, ook seconden later —
  // gemeten: rgba(0,0,0,0) 0px 0px 0px 0px, ongeacht de wachttijd. Dat zegt
  // niets over de regel zelf.
  // In plaats daarvan: matcht het element de ring-selector in deze toestand,
  // en draagt die regel de juiste kleur? Dat toetst precies wat V2 en V4
  // beloven — de ring hangt aan de inert-klasse en draagt de eigen kleur van
  // de knop — zonder af te hangen van of de animatie loopt.
  const ringRegel = (sel) => {
    for (const ss of document.styleSheets) {
      let rules; try { rules = ss.cssRules; } catch (e) { continue; }
      for (const r of rules) if (r.selectorText === sel) return r.style.boxShadow || '';
    }
    return null;
  };
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const bewaard = {
    fase, cdBereikteNul, countdownNulTijd, groenStart, cdStart,
    activeCdDoel, bevestigActief, bevInertStaat,
    wrapClass: bevestigWrap.className
  };

  const inert = (btn) => btn.classList.contains('inert');
  const stijl = (btn, prop) => getComputedStyle(btn)[prop];

  // Zet een toestand en laat de app zelf de knopstaat bepalen.
  // overschrMs wordt in meetBevestigMoment (r4024-4028) berekend als
  // groenWand - countdownNulTijd, waarbij groenWand de wandkloktijd van
  // groenStart is. Door groenStart op nu te zetten is groenWand = Date.now(),
  // en dan levert countdownNulTijd = nu - X precies overschrMs = X.
  function zet(toestand, overschrMs) {
    if (toestand === 'rood-voor-nul') {
      fase = 'rood'; cdBereikteNul = false; countdownNulTijd = null;
      cdStart = performance.now(); activeCdDoel = 30;
    } else if (toestand === 'groen-voor-nul') {
      fase = 'groen'; cdBereikteNul = false; countdownNulTijd = null;
    } else if (toestand === 'groen-na-nul') {
      fase = 'groen'; cdBereikteNul = true;
      groenStart = performance.now();
      countdownNulTijd = Date.now() - overschrMs;
    }
    bevestigActief = true;
    bevestigWrap.classList.add('actief');
    bevInertStaat = '';              // memo forceren tot een verse schrijving
    updateBevestigKnopStaat();
  }
  const beeld = () => (inert(bevKlopteBtn) ? 'grijs' : 'AAN') + ' / '
                    + (inert(bevBijnaBtn)  ? 'grijs' : 'AAN') + ' / '
                    + (inert(bevFoutBtn)   ? 'grijs' : 'AAN');

  try {
    // ══ T1-T5 — de matrix ═════════════════════════════════════
    zet('rood-voor-nul');
    eis('T1 rood vóór nul: BIJNA aan, KLOPTE grijs',
        inert(bevKlopteBtn) && !inert(bevBijnaBtn) && !inert(bevFoutBtn),
        'grijs / AAN / AAN', beeld());

    zet('groen-voor-nul');
    eis('T2 groen vóór nul: BIJNA aan, KLOPTE grijs',
        inert(bevKlopteBtn) && !inert(bevBijnaBtn) && !inert(bevFoutBtn),
        'grijs / AAN / AAN', beeld());

    zet('groen-na-nul', 1000);
    eis('T3 groen, 1s na nul: KLOPTE aan, BIJNA grijs',
        !inert(bevKlopteBtn) && inert(bevBijnaBtn) && !inert(bevFoutBtn),
        'AAN / grijs / AAN', beeld());

    zet('groen-na-nul', 5000);
    eis('T4 groen, 5s na nul: BIJNA aan, KLOPTE grijs',
        inert(bevKlopteBtn) && !inert(bevBijnaBtn) && !inert(bevFoutBtn),
        'grijs / AAN / AAN', beeld());

    zet('groen-na-nul', 15000);
    eis('T5 groen, 15s na nul: alleen FOUT aan',
        inert(bevKlopteBtn) && inert(bevBijnaBtn) && !inert(bevFoutBtn),
        'grijs / grijs / AAN', beeld());

    // grensgevallen op de twee drempels, die RV1 ongemoeid laat
    zet('groen-na-nul', BEV_GOED_MAX_MS);
    eis('T5b exact op BEV_GOED_MAX_MS telt nog als KLOPTE',
        !inert(bevKlopteBtn) && inert(bevBijnaBtn),
        'KLOPTE aan', beeld());
    zet('groen-na-nul', BEV_GOED_MAX_MS + 1);
    eis('T5c één ms erover kantelt naar BIJNA',
        inert(bevKlopteBtn) && !inert(bevBijnaBtn),
        'BIJNA aan', beeld());
    zet('groen-na-nul', BEV_BIJNA_MAX_MS);
    eis('T5d exact op BEV_BIJNA_MAX_MS telt nog als BIJNA',
        !inert(bevBijnaBtn), 'BIJNA aan', beeld());
    zet('groen-na-nul', BEV_BIJNA_MAX_MS + 1);
    eis('T5e één ms erover laat alleen FOUT over',
        inert(bevKlopteBtn) && inert(bevBijnaBtn) && !inert(bevFoutBtn),
        'alleen FOUT', beeld());

    // ══ T6 — DE INVARIANT ═════════════════════════════════════
    // Zodra het venster symmetrisch wordt (-2s vóór de omslag) is dit de test
    // die omvalt als bijnaIsNoOp niet meebeweegt.
    const gevallen = [
      ['rood-voor-nul', null], ['groen-voor-nul', null],
      ['groen-na-nul', 0], ['groen-na-nul', 1000], ['groen-na-nul', 2000],
      ['groen-na-nul', 2001], ['groen-na-nul', 5000], ['groen-na-nul', 10000],
      ['groen-na-nul', 10001], ['groen-na-nul', 30000]
    ];
    let samen = [], foutGrijs = [];
    for (const [t, o] of gevallen) {
      zet(t, o);
      if (!inert(bevKlopteBtn) && !inert(bevBijnaBtn)) samen.push(t + (o != null ? '@' + o : ''));
      if (inert(bevFoutBtn)) foutGrijs.push(t + (o != null ? '@' + o : ''));
    }
    eis('T6 KLOPTE en BIJNA lichten nooit tegelijk op (10 toestanden)',
        samen.length === 0, 'geen enkele', samen.length ? samen.join(', ') : 'geen enkele');
    eis('T7 FOUT is in geen enkele toestand gedempt',
        foutGrijs.length === 0, 'nooit grijs', foutGrijs.length ? foutGrijs.join(', ') : 'nooit grijs');

    // ══ T8 — uit moet GRIJS zijn, niet donkergroen ════════════
    zet('groen-na-nul', 30000);   // beide grijs
    const fK = stijl(bevKlopteBtn, 'filter');
    const fB = stijl(bevBijnaBtn, 'filter');
    eis('T8 de inert-filter ontkleurt volledig (saturate(0), niet 0.4)',
        /saturate\(0\)/.test(fK) && !/saturate\(0\.4\)/.test(fK),
        'saturate(0) ...', fK);
    eis('T8b KLOPTE en BIJNA krijgen exact dezelfde grijsbehandeling',
        fK === fB, 'identieke filter', fK + '  vs  ' + fB);

    // De grijswaarden die daaruit volgen, ter documentatie: saturate(0) rekent
    // met de luminantiecoefficienten, dus #22c55e -> 155 en #f59e0b -> 166 van
    // 255. Elf stappen uit elkaar op een schaal van 255 is met het blote oog
    // niet te onderscheiden — de uit-staat verraadt dus niet meer welke knop
    // het was.
    const grijs = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    };
    eis('T8c de twee grijswaarden liggen minder dan 20/255 uit elkaar',
        Math.abs(grijs('#22c55e') - grijs('#f59e0b')) < 20,
        'verschil < 20',
        'KLOPTE ' + grijs('#22c55e') + ' vs BIJNA ' + grijs('#f59e0b')
          + ' = ' + Math.abs(grijs('#22c55e') - grijs('#f59e0b')));

    // ══ T9-T11 — de ring ══════════════════════════════════════
    zet('groen-na-nul', 1000);   // KLOPTE aan
    eis('T9 actieve KLOPTE matcht de ring-selector',
        bevKlopteBtn.matches('#bev-klopte:not(.inert)'),
        'matcht', String(bevKlopteBtn.matches('#bev-klopte:not(.inert)')));
    eis('T9b gedempte BIJNA draagt geen ring',
        stijl(bevBijnaBtn, 'boxShadow') === 'none' && !bevBijnaBtn.matches('#bev-bijna:not(.inert)'),
        'none en geen match', stijl(bevBijnaBtn, 'boxShadow'));

    zet('groen-na-nul', 5000);   // BIJNA aan
    eis('T10 actieve BIJNA draagt een ring, gedempte KLOPTE niet',
        stijl(bevBijnaBtn, 'boxShadow') !== 'none' && stijl(bevKlopteBtn, 'boxShadow') === 'none',
        'BIJNA ring, KLOPTE none',
        'BIJNA ' + (stijl(bevBijnaBtn, 'boxShadow') === 'none' ? 'none' : 'ring')
          + ', KLOPTE ' + (stijl(bevKlopteBtn, 'boxShadow') === 'none' ? 'none' : 'ring'));

    const regelK = ringRegel('#bev-klopte:not(.inert)');
    const regelB = ringRegel('#bev-bijna:not(.inert)');
    eis('T10b de ring van KLOPTE draagt het groen van de knop (34,197,94)',
        regelK != null && /34,\s*197,\s*94/.test(regelK), 'rgba met 34,197,94', String(regelK).slice(0, 70));
    eis('T10c de ring van BIJNA draagt het oranje van de knop (245,158,11)',
        regelB != null && /245,\s*158,\s*11/.test(regelB), 'rgba met 245,158,11', String(regelB).slice(0, 70));
    eis('T10d er bestaat geen ring-regel voor FOUT',
        ringRegel('#bev-fout:not(.inert)') === null, 'geen regel', String(ringRegel('#bev-fout:not(.inert)')));

    // FOUT is altijd actief; een permanente ring zou het signaal verdunnen.
    let foutRing = [];
    for (const [t, o] of gevallen) { zet(t, o); if (stijl(bevFoutBtn, 'boxShadow') !== 'none') foutRing.push(t); }
    eis('T11 FOUT krijgt in geen enkele toestand een ring',
        foutRing.length === 0, 'nooit', foutRing.length ? foutRing.join(', ') : 'nooit');

    // ══ T12 — V4: kleur en klikbaarheid blijven synchroon ═════
    eis('T12 box-shadow loopt mee in de transitie (springt niet hard)',
        /box-shadow/.test(stijl(bevKlopteBtn, 'transition')),
        'transition bevat box-shadow', stijl(bevKlopteBtn, 'transition'));
    zet('groen-na-nul', 1000);
    const zonderInert = bevKlopteBtn.matches('#bev-klopte:not(.inert)')
                     && stijl(bevKlopteBtn, 'boxShadow') !== 'none';
    bevKlopteBtn.classList.add('inert');
    const metInert = !bevKlopteBtn.matches('#bev-klopte:not(.inert)')
                  && stijl(bevKlopteBtn, 'boxShadow') === 'none';
    bevKlopteBtn.classList.remove('inert');
    eis('T12b de ring hangt aan de inert-klasse zelf, niet aan een tweede bron',
        zonderInert && metInert,
        'ring zonder inert, weg mét inert',
        'zonder=' + zonderInert + ', met=' + metInert);

    // ══ T13 — V3: de actieve kleuren zijn niet verschoven ═════
    eis('T13 de inline achtergrondkleuren staan onveranderd',
        bevKlopteBtn.style.background === 'rgb(34, 197, 94)'
        && bevBijnaBtn.style.background === 'rgb(245, 158, 11)'
        && bevFoutBtn.style.background === 'rgb(239, 68, 68)',
        '#22c55e / #f59e0b / #ef4444',
        bevKlopteBtn.style.background + ' / ' + bevBijnaBtn.style.background
          + ' / ' + bevFoutBtn.style.background);

    // ══ T14 — RV3: de memo staat er nog ═══════════════════════
    // updateBevestigKnopStaat draait ~60x/sec vanuit de rAF-lus. Zonder de memo
    // wordt de DOM 60x per seconde aangeraakt in plaats van alleen bij een
    // echte wissel. Deze release raakt die functie niet aan; dit is de wacht.
    eis('T14 updateBevestigKnopStaat schrijft alleen bij een staatswissel',
        /if\s*\(staat === bevInertStaat\)\s*return;/.test(String(updateBevestigKnopStaat)),
        'memo-guard aanwezig',
        /bevInertStaat/.test(String(updateBevestigKnopStaat)) ? 'memo aanwezig' : 'MEMO WEG');

  } finally {
    fase = bewaard.fase; cdBereikteNul = bewaard.cdBereikteNul;
    countdownNulTijd = bewaard.countdownNulTijd; groenStart = bewaard.groenStart;
    cdStart = bewaard.cdStart; activeCdDoel = bewaard.activeCdDoel;
    bevestigActief = bewaard.bevestigActief; bevInertStaat = bewaard.bevInertStaat;
    bevestigWrap.className = bewaard.wrapClass;
    bevKlopteBtn.classList.remove('inert');
    bevBijnaBtn.classList.remove('inert');
    bevFoutBtn.classList.remove('inert');
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testKnopkleur = testKnopkleur;
