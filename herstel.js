// © 2026 StoplichtIQ
//
// wachtwoord-instellen.html: hier komt de link uit de herstelmail op uit.
// Regels (Wegwijzer-aanpak, strenger):
// - alleen bij het Supabase-event PASSWORD_RECOVERY verschijnt het formulier
//   "nieuw wachtwoord" (minstens 10 tekens, twee keer invullen); anders niets;
// - deze pagina roept geen enkele database-functie aan en toont geen dashboard;
// - de herstelsessie leeft alleen in het geheugen (persistSession: false, eigen
//   storageKey), dus het dashboard ziet hem nooit;
// - na het nieuwe wachtwoord: overal uitloggen (scope global) en de opgeslagen
//   dashboardsessie wissen; daarna moet je opnieuw inloggen.
(function () {
  'use strict';
  const S = window.SLIQ, { el } = S;
  const app = document.getElementById('app');
  const WACHT_MS = 4000;   // zo lang wachten op PASSWORD_RECOVERY na het laden van de sessie
  const link = S.linkInfo();
  let klaar = false;

  function toon(...kind) { app.replaceChildren(el('div', { klasse: 'inlogvak' }, el('div', { klasse: 'inlog' }, S.merk('Nieuw wachtwoord'), kind)), S.voet()); }
  const naarInlog = (t, modus) => el('a', { klasse: 'knoplink', href: 'dashboard.html' + (modus ? '?modus=' + modus : ''), tekst: t });
  function ongeldig(tekst) {
    if (klaar) return; klaar = true;
    toon(el('p', { klasse: 'status fout', role: 'status', tekst }), naarInlog('Nieuwe herstelmail aanvragen', 'vergeten'), el('div', { klasse: 'wissel' }, el('a', { klasse: 'link', href: 'dashboard.html', tekst: '← Naar inloggen' })));
  }

  if (link.fout) { S.wisLinkUitAdres(); ongeldig(S.linkFoutTekst(link.fout) + ' Vraag een nieuwe herstelmail aan.'); return; }
  if (link.soort !== 'recovery' || !link.token) { S.wisLinkUitAdres(); ongeldig('Open deze pagina via de link in de herstelmail.'); return; }

  // token_hash-link: de client leest niets uit de adresbalk; pas de knop controleert de link.
  const hash = link.tokenHash;
  const db = window.supabase.createClient(S.URL_, S.ANON, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: !hash, storageKey: 'herstel_sessie' } });

  function formulier() {
    if (klaar) return; klaar = true;
    const ww = el('input', { type: 'password', autocomplete: 'new-password', required: true, id: 'ww', maxlength: String(S.WW_MAX) });
    const ww2 = el('input', { type: 'password', autocomplete: 'new-password', required: true, id: 'ww2', maxlength: String(S.WW_MAX) });
    const st = el('p', { klasse: 'status', role: 'status', 'aria-live': 'polite' });
    const zet = (t, ok) => { st.className = 'status ' + (ok ? 'ok' : 'fout'); st.textContent = t || ''; };
    const knop = el('button', { type: 'submit', klasse: 'hoofdknop', tekst: 'Wachtwoord opslaan' });
    const form = el('form', { klasse: 'inlog', novalidate: true, 'aria-label': 'Nieuw wachtwoord' }, S.merk('Nieuw wachtwoord'),
      el('p', { klasse: 'klein stil', tekst: 'Kies een nieuw wachtwoord. Daarna log je opnieuw in.' }),
      el('label', null, 'Nieuw wachtwoord', ww, el('span', { klasse: 'hulp', tekst: 'Minstens ' + S.WW_MIN + ' tekens.' })),
      el('label', null, 'Herhaal nieuw wachtwoord', ww2), knop, st);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = S.wachtwoordFout(ww.value, ww2.value); if (f) return zet(f);
      knop.disabled = true; zet('');
      try {
        const { error } = await db.auth.updateUser({ password: ww.value });
        if (error) { zet(S.authMelding(error)); knop.disabled = false; return; }
      } catch (e) { zet(S.authMelding(e)); knop.disabled = false; return; }
      ww.value = ''; ww2.value = '';
      // Overal uitloggen: ook andere apparaten en een eventueel open dashboard.
      try { const r = await db.auth.signOut({ scope: 'global' }); if (r && r.error) await db.auth.signOut({ scope: 'local' }); } catch (e) {}
      try { localStorage.removeItem('dash_sessie'); localStorage.removeItem('dash_rol'); } catch (e) {}
      app.replaceChildren(el('div', { klasse: 'inlogvak' }, el('div', { klasse: 'inlog' }, S.merk('Nieuw wachtwoord'),
        el('p', { klasse: 'status ok', role: 'status', tekst: 'Je wachtwoord is gewijzigd en je bent overal uitgelogd. Log nu opnieuw in met je nieuwe wachtwoord.' }),
        naarInlog('Naar inloggen'))), S.voet());
    });
    app.replaceChildren(el('div', { klasse: 'inlogvak' }, form), S.voet());
    ww.focus();
  }

  // Alleen PASSWORD_RECOVERY opent het formulier; elk ander event (ook SIGNED_IN) niet.
  db.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') formulier(); });

  if (hash) {
    S.wisLinkUitAdres();
    const st = el('p', { klasse: 'status', role: 'status', 'aria-live': 'polite' });
    const knop = el('button', { type: 'button', klasse: 'hoofdknop', tekst: 'Ga verder', klik: async () => {
      knop.disabled = true;
      try {
        const { error } = await db.auth.verifyOtp({ token_hash: hash, type: 'recovery' });
        if (error) return ongeldig(S.linkFoutTekst(error.code || error.message) + ' Vraag een nieuwe herstelmail aan.');
      } catch (e) { st.className = 'status fout'; st.textContent = S.authMelding(e); knop.disabled = false; return; }
      // verifyOtp meldt zelf PASSWORD_RECOVERY; komt dat niet, dan geen formulier.
      setTimeout(() => { if (!klaar) ongeldig('Deze herstellink werkt niet (meer).'); }, WACHT_MS);
    } });
    toon(el('p', { klasse: 'klein stil', tekst: 'Klik op de knop om een nieuw wachtwoord in te stellen.' }), knop, st);
    return;
  }

  toon(el('p', { klasse: 'stil', tekst: 'Link controleren…' }));
  db.auth.getSession().then(() => {
    S.wisLinkUitAdres();   // tokens uit de adresbalk
    setTimeout(() => { if (!klaar) { db.auth.signOut({ scope: 'local' }).catch(() => {}); ongeldig('Deze herstellink werkt niet (meer).'); } }, WACHT_MS);
  }).catch(() => ongeldig('Deze herstellink werkt niet (meer).'));
})();
