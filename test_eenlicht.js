// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_eenlicht.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.17.71: de "Eén licht"-markering (intern sl_neutraal_).
//
//  De kern is T2/T3: met de markering aan MOET kiesCountdownBron de drie
//  V5-richtingstappen overslaan en direct op V4 uitkomen, ook als er ruim
//  genoeg V5-data is om stap 1 te laten pakken. Zonder markering hoort V5 juist
//  te winnen. Dat verschil is de hele reden dat de markering bestaat, en het was
//  tot nu toe nergens vastgelegd.
//
//  T4 toetst de omkeerbaarheid: de markering weghalen brengt V5 terug. Zonder
//  die eigenschap zou een vergissing onherstelbaar zijn.
//
//  LET OP bij het lezen: laadMV5Geclusterd trekt via afgerondNaar45 ook de
//  buurrichtingen mee, met gewicht 0,5. Deze test zaait daarom op de EXACTE
//  combinatie (gewicht 1,0); zaaien op een buur zou het resultaat
//  gewichtsafhankelijk en broos maken.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_eenlicht.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testEenLicht().regels);
// ═══════════════════════════════════════════════════════════════

function testEenLicht() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  const NODE = '880001';
  const DD = 'dag';
  const AANRIJ = 'N';
  const AFRIJ = berekenAfrijRichtingViaTik(0, 'rechtdoor');   // N -> Z
  const v5Key = 'sl_v5_' + NODE + '_' + AANRIJ + '_' + AFRIJ + '_' + DD;
  const v4Key = 'sl_v4_' + NODE + '_' + DD;
  const vlagKey = 'sl_neutraal_' + NODE;

  const bewaard = {};
  for (const k of [v5Key, v4Key, vlagKey]) bewaard[k] = localStorage.getItem(k);

  try {
    const nu = Date.now();
    // V5: ruim boven V9_MIN_METINGEN, met een duidelijk andere duur dan V4
    // zodat aan het GETAL te zien is welke bron gewonnen heeft.
    const v5 = [];
    for (let i = 0; i < V9_MIN_METINGEN + 2; i++) v5.push({ duur: 20, tijd: nu - i * 3600000, gewicht: 1.0, bron: 'tik' });
    localStorage.setItem(v5Key, JSON.stringify(v5));
    // V4: ook ruim voldoende, maar 60s in plaats van 20s
    const v4 = [];
    for (let i = 0; i < 8; i++) v4.push({ duur: 60, tijd: nu - i * 3600000, richting: 0, obs: 60, gewicht: 0.89, bron: 's1' });
    localStorage.setItem(v4Key, JSON.stringify(v4));

    eis('T1 opzet klopt: V5 heeft genoeg metingen om te mogen winnen',
        laadMV5Geclusterd(NODE, AANRIJ, AFRIJ, DD).length >= V9_MIN_METINGEN,
        'n >= ' + V9_MIN_METINGEN,
        'n = ' + laadMV5Geclusterd(NODE, AANRIJ, AFRIJ, DD).length);

    // ══ T2 — zonder markering wint V5 ══════════════════════════
    localStorage.removeItem(vlagKey);
    const zonder = kiesCountdownBron(NODE, DD, AANRIJ, AFRIJ);
    eis('T2 zonder markering kiest de app de V5-richtingbron',
        zonder && zonder.v5 === true && String(zonder.bron).startsWith('V5'),
        'bron begint met V5, v5=true',
        zonder ? (zonder.bron + ', v5=' + zonder.v5 + ', gem=' + zonder.gem + 's') : 'null');
    eis('T2b en dat is ook aan het GETAL te zien (20s uit V5, niet 60s uit V4)',
        zonder && zonder.gem === 20, '20', zonder ? String(zonder.gem) : '-');

    // ══ T3 — met markering worden alle drie de V5-stappen overgeslagen ══
    localStorage.setItem(vlagKey, '1');
    eis('T3 de markering staat aan',
        isNodeNeutraal(NODE) === true, 'true', String(isNodeNeutraal(NODE)));
    const met = kiesCountdownBron(NODE, DD, AANRIJ, AFRIJ);
    eis('T3b met markering valt de bron door naar V4',
        met && met.v5 === false && !String(met.bron).startsWith('V5'),
        'v5=false, bron geen V5',
        met ? (met.bron + ', v5=' + met.v5 + ', gem=' + met.gem + 's') : 'null');
    eis('T3c het getal komt nu uit V4 (60s), niet uit V5 (20s)',
        met && met.gem === 60, '60', met ? String(met.gem) : '-');

    // stap 3 ('V5 alle') is de laatste die de markering moet blokkeren: die
    // heeft geen aanrijrichting nodig en zou anders alsnog V5-data pakken.
    const metZonderRichting = kiesCountdownBron(NODE, DD, null, null);
    eis('T3d ook zonder aanrijrichting blijft V5 geblokkeerd (stap 3)',
        metZonderRichting && metZonderRichting.v5 === false,
        'v5=false',
        metZonderRichting ? (metZonderRichting.bron + ', v5=' + metZonderRichting.v5) : 'null');

    // controle dat stap 3 zonder markering WEL zou pakken — anders toetst T3d niets
    localStorage.removeItem(vlagKey);
    const stap3 = kiesCountdownBron(NODE, DD, null, null);
    eis('T3e controle: zonder markering pakt stap 3 wel degelijk V5',
        stap3 && stap3.v5 === true,
        'v5=true (anders zegt T3d niets)',
        stap3 ? (stap3.bron + ', v5=' + stap3.v5) : 'null');

    // ══ T4 — omkeerbaar ════════════════════════════════════════
    localStorage.setItem(vlagKey, '1');
    const aan = kiesCountdownBron(NODE, DD, AANRIJ, AFRIJ);
    localStorage.removeItem(vlagKey);
    const weerUit = kiesCountdownBron(NODE, DD, AANRIJ, AFRIJ);
    eis('T4 markering weghalen brengt de V5-bron terug',
        aan && aan.v5 === false && weerUit && weerUit.v5 === true && weerUit.gem === 20,
        'aan: V4, uit: V5 met 20s',
        (aan ? aan.bron : '-') + ' -> ' + (weerUit ? weerUit.bron + '/' + weerUit.gem + 's' : '-'));

    // ══ T5 — de badge volgt de vlag ════════════════════════════
    localStorage.setItem(vlagKey, '1');
    const badgeAan = renderEenLichtBadge(NODE);
    localStorage.removeItem(vlagKey);
    const badgeUit = renderEenLichtBadge(NODE);
    eis('T5 badge verschijnt met de markering en verdwijnt zonder',
        badgeAan.includes('Eén licht') && badgeUit === '',
        'badge aan, leeg uit',
        'aan=' + (badgeAan ? 'badge' : 'leeg') + ', uit=' + (badgeUit ? 'badge' : 'leeg'));

    // ══ T6 — richtingknoppen blijven verborgen ═════════════════
    // toonRichtingKnoppen keert vroeg terug bij een gemarkeerde node (r8844).
    // Geen demping maar verbergen: bij deze node valt er NOOIT iets te
    // registreren, en een permanent gedempte knop zou dezelfde verwarring geven
    // die V11.17.62 bij de bevestigknoppen juist heeft opgelost.
    localStorage.setItem(vlagKey, '1');
    const wrap = document.getElementById('richting-knoppen');
    const zichtbaarVoor = wrap ? wrap.style.display : null;
    toonRichtingKnoppen(NODE, true);
    eis('T6 toonRichtingKnoppen toont niets voor een gemarkeerde node',
        !wrap || wrap.style.display === zichtbaarVoor,
        'geen zichtbaarheidswijziging',
        wrap ? ('display ' + zichtbaarVoor + ' -> ' + wrap.style.display) : 'element bestaat niet');

  } finally {
    for (const k of [v5Key, v4Key, vlagKey]) {
      if (bewaard[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, bewaard[k]);
    }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testEenLicht = testEenLicht;
