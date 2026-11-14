// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_versie_kort.js
//  © 2026 StoplichtIQ
//
//  Test bij V11.37.39: het startscherm toont gewone gebruikers alleen het
//  versienummer; de lange tekst staat alleen in de debugweergave.
//
//  VK1  debugweergave dicht: het label is precies het nummer (V11.x.y), zonder omschrijving
//  VK2  tik op de debugbalk (leerlog open): het label is de hele APP_VERSIE
//  VK3  nog een tik (dicht): weer alleen het nummer
//  VK4  het TEST-merkteken blijft achter het label staan bij het wisselen
//  VK5  de klik op het label (verborgen zone) werkt nog: de handler staat er nog
//
//  DRAAIEN: zoals de andere toetsen; testVersieKort().
// ═══════════════════════════════════════════════════════════════
function testVersieKort() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => { regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen }); return gelukt; };
  const ver = document.getElementById('s-versie'), ll = document.getElementById('leer-log');
  const bew = { ll: ll ? ll.style.display : null, html: ver ? ver.innerHTML : null };
  const tekst = () => (ver && ver.firstChild && ver.firstChild.nodeType === 3) ? ver.firstChild.nodeValue : '';
  const kort = String(APP_VERSIE).split(' ')[0];
  try {
    ll.style.display = 'none'; versieLabelBij();
    eis('VK1 debugweergave dicht: alleen het nummer', tekst() === kort && ver.textContent.indexOf('—') < 0 && /^V11\.\d+\.\d+$/.test(tekst()), kort, tekst());
    toggleLeerLog();
    eis('VK2 tik op de debugbalk: de hele versietekst', ll.style.display === 'block' && tekst() === APP_VERSIE, APP_VERSIE, tekst());
    toggleLeerLog();
    eis('VK3 nog een tik: weer alleen het nummer', ll.style.display === 'none' && tekst() === kort, kort, tekst());
    const b = document.createElement('span'); b.className = 'mv-test-badge'; b.textContent = 'TEST'; ver.appendChild(b);
    toggleLeerLog(); const t2 = tekst(), heeft2 = !!ver.querySelector('.mv-test-badge');
    toggleLeerLog(); const t3 = tekst(), heeft3 = !!ver.querySelector('.mv-test-badge');
    eis('VK4 het TEST-merkteken blijft staan en de tekst wisselt mee', heeft2 && heeft3 && t2 === APP_VERSIE && t3 === kort && ver.querySelectorAll('.mv-test-badge').length === 1, 'merkteken blijft', [heeft2, heeft3, t2, t3].join(' | '));
    const bron = String(versieLabelBij);
    eis('VK5 versieLabelBij zet alleen de tekstknoop (geen textContent of innerHTML, dus de klikhandler en het merkteken blijven)', !/textContent|innerHTML|addEventListener|removeEventListener/.test(bron), 'alleen nodeValue', '');
  } catch (e) {
    eis('VK crash', false, 'geen fout', String(e && e.stack || e).slice(0, 300));
  } finally {
    if (ll) ll.style.display = bew.ll;
    if (ver) { ver.innerHTML = bew.html; }
    try { versieLabelBij(); } catch (e) {}
  }
  const geslaagd = regels.filter(r => r.uitslag === 'OK').length;
  return { geslaagd, gefaald: regels.length - geslaagd, regels };
}

if (typeof window !== 'undefined') window.testVersieKort = testVersieKort;
