// © 2026 StoplichtIQ
//
// Het beheer-dashboard. V11.38.0 (F1): alleen voor de beheerder (mijn_profiel().is_admin).
// Ieder ander wordt hier lokaal uitgelogd en ziet alleen "Geen toegang"; gewone gebruikers
// beheren hun account in de app zelf. Volgens het Supabase-contract van 8 nov 2026:
// - alleen de publieke anon-sleutel; alles via rpc, behalve het lezen van app_config;
// - verbergen is geen beveiliging: de database weigert admin-functies zelf;
// - alle tekst uit de database gaat via textContent (namen komen van gebruikers).
(function () {
  'use strict';
  const S = window.SLIQ;                   // gedeeld met wachtwoord-instellen.html (inlog.js)
  const { el, sv, foutTekst, info } = S;
  const ROL_SLEUTEL = 'dash_rol';          // de laatst bekende rol, voor offline (geen sl_: hoort niet in de backup)
  const VERVERS_MS = 45000;                // binnen de gevraagde 30-60 s
  const PULS_UUR = 3, PULS_MAX = 150;      // pulseren: nieuw in de laatste 3 uur, hooguit 150 punten

  // Een herstellink geeft hier NOOIT toegang. Komt er toch een binnen (bijvoorbeeld
  // omdat de Site URL naar deze pagina wijst), dan gaat hij ongelezen door naar de
  // pagina die alleen een nieuw wachtwoord vraagt. Alleen een bevestigingslink van
  // het registreren (type=signup) mag hier een sessie maken; elke andere link met
  // een token (uitnodiging, magic link) wordt genegeerd en uit de adresbalk gehaald.
  const link = S.linkInfo();
  if (link.soort === 'recovery') { location.replace('wachtwoord-instellen.html' + location.search + location.hash); return; }
  const leesLink = link.soort === 'signup' && link.accessToken;                      // standaardlink: de client leest hem
  const bevestigHash = link.soort === 'signup' && link.tokenHash ? link.tokenHash : null;   // token_hash-link: pas na een klik
  let linkMelding = null;
  if (link.fout) linkMelding = { t: S.linkFoutTekst(link.fout) + ' Log in, of vraag een nieuwe mail aan.', fout: true };
  else if (link.token && !leesLink && !bevestigHash) linkMelding = { t: 'Deze link geeft hier geen toegang. Log in met je wachtwoord, of gebruik "Wachtwoord vergeten".', fout: true };
  const startModus = new URLSearchParams(location.search).get('modus');
  if ((link.token && !leesLink) || link.fout || startModus) S.wisLinkUitAdres();   // ook de token_hash: die staat nu alleen nog in bevestigHash

  const db = window.supabase.createClient(S.URL_, S.ANON, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dash_sessie', detectSessionInUrl: leesLink } });
  const app = document.getElementById('app');
  let profiel = null, tab = null, kaart = null, laag = null, uren = 24, klok = null, config = {}, offline = false;
  let alleenVolledig = false;   // V11.38.14: filter "alleen volledig" (kaart en tab Volledig)

  // ── hulpjes ─────────────────────────────────────────────────
  // De uitleg achter de (i)-knopjes. Nagelezen tegen de databasefuncties (14 nov 2026, alleen lezen):
  // verwerk_meting, evalueer_meting, mijn_profiel, diag_dag_opslaan, diag_log_opslaan, admin_vraag_log,
  // admin_zet_beta, mijn_data_export, admin_inflow_daily, admin_city_progress.
  const UITLEG = {
    bijdragen: 'Aantal geaccepteerde metingen van deze gebruiker. Een teller, geen percentage. Een meting die eerst in quarantaine stond en later alsnog wordt geaccepteerd, telt vanaf dan ook mee, precies een keer.',
    quarlijst: 'Metingen die wachten op een oordeel. "Bekend" is de gewone duur die we voor dit kruispunt en dagdeel al hebben (met het aantal metingen); "nieuw" betekent dat er nog niets bekend is. Goedkeuren telt de meting mee in de statistiek en bij de bijdragen van de gebruiker. Afwijzen laat hem staan maar telt hem nergens mee. Elk oordeel komt in het logboek.',
    kwaliteit: 'Per meting vergelijken we het aantal seconden dat de app toonde bij het begin van de countdown met de duur die daarna echt gemeten is. "Goed" = hoogstens 5 seconden ernaast. Alleen VOLLEDIGE metingen waarbij de app iets toonde tellen mee: bij een onvolledige meting (begin van rood niet gezien) is de gemeten duur te kort, dus zegt de vergelijking niets. Die staan apart in de laatste kolom. Onder de 30 metingen tonen we geen percentage: dat zegt nog niets.',
    feedback: 'Wat gebruikers via "Feedback" in de app hebben gestuurd. Hoogstens 5 berichten per gebruiker per 24 uur, elk hoogstens 1000 tekens. De nieuwste 500 staan hier.',
    mfa: 'Een tweede stap betekent: na je wachtwoord vraagt het dashboard ook een code van 6 cijfers uit een authenticator-app op je telefoon. Koppel eerst de app. Pas daarna kun je de stap verplicht maken; dan weigert ook de database beheerfuncties zonder die code. Raak je je telefoon kwijt, dan kan de verplichting alleen nog in Supabase zelf worden uitgezet (tabel app_config, sleutel admin_mfa_verplicht).',
    laatstesync: 'Het moment waarop de app van deze gebruiker voor het laatst een meting heeft verstuurd. "deelt niet" = de gebruiker heeft geen toestemming gegeven voor synchronisatie; "nog niets" = wel toestemming, nog geen meting ontvangen.',
    vertrouwen: "Getal van 0 tot 1. Nieuw = 0,50. Het stijgt met 0,01 bij elke meting die meteen wordt geaccepteerd, tot maximaal 1,00. Vanaf 0,70 telt iemand als 'vertrouwd' (een beheerder altijd): dan is voor een nieuw kruispunt maar 1 andere gebruiker nodig om het te bevestigen in plaats van 2. Het daalt nu nooit; slechte metingen blijven gewoon in quarantaine.",
    quarantaine: 'Sinds V11.38.2 worden metingen van de beheerder of een vertrouwd account (vertrouwen 0,7 of meer) en onvolledige metingen (begin van rood niet gezien) binnen de harde grenzen direct aangenomen. Voor andere metingen: een meting die afwijkt van wat we al weten (meer dan 15 s of 35% naast de gewone waarde van de metingen van VOOR dat moment, 400 dagen, recente zwaarder), of voor een kruispunt waar nog niets bekend is, wacht tot genoeg andere gebruikers hetzelfde melden: bij een afwijking 2 anderen binnen 7 dagen, bij een nieuw kruispunt 2 anderen (of 1 als er een vertrouwde gebruiker bij is) binnen 30 dagen. Dat gebeurt zodra die laatste meting binnenkomt; daarna is hij automatisch geaccepteerd. Jij hoeft niets goed te keuren.',
    vandaag: 'V11.38.14: metingen die VANDAAG GEMETEN zijn (de dag van de meting zelf, in Nederlandse tijd) en nu zijn aangenomen, met tussen haakjes hoeveel daarvan volledig, onvolledig (begin van rood niet gezien) en onbekend (oude meting van voor de vlag) / die nog wachten / aantal gebruikers. Een meting die later binnenkomt, telt op de dag dat hij gemeten is. Lukt het ophalen van deze telling niet, dan valt het blok terug op de oude telling (dag van binnenkomst, UTC) en staat dat erbij.',
    volledig: 'V11.38.14. Volledig = de app zag het begin en het einde van rood: de hele rode fase is gemeten. Onvolledig = het begin van rood was niet gezien, de gemeten duur is dus te kort. Onbekend = een oude meting van voor de vlag bestond (geimporteerd); die telt hier nergens als volledig. Alleen aangenomen metingen tellen mee; wat in quarantaine staat, staat apart. Het percentage is van alle aangenomen metingen.',
    log: 'Vraagt deze gebruiker EENMALIG om een logbestand te sturen. Dat kan alleen als hij diagnose-toestemming heeft gegeven. Na versturen is het verzoek verbruikt. Let op: de app zelf leest dit verzoek nog niet; dat komt in een volgende fase.',
    beta: 'Een vertrouwde tester die elke dag automatisch logs mag sturen (hoogstens 1 per soort per dag) zonder dat jij het vraagt. Alleen met diagnose-toestemming. Een gewone gebruiker kan dat niet. Let op: de app stuurt nog niets; dat komt in een volgende fase.',
    diag: 'Als je dit aanzet, mag de app dagelijks technische gegevens sturen: appversie, opslag in KB, opstarttijd, gemiddelde rekentijd, aantal ritten en teltallen. Daarin staan geen locatie en geen naam. Met deze toestemming kan ook een logbestand worden gestuurd als de beheerder erom vraagt of als je beta-tester bent; een logbestand kan wel kruispuntnummers bevatten. Staat standaard uit en je kunt het altijd uitzetten. De app stuurt op dit moment nog niets.',
    download: 'Geeft je een bestand met je profiel, je metingen, je validaties en je dagelijkse diagnosegegevens. Ook logbestanden die je hebt gestuurd, je feedback en de momenten waarop je toestemming gaf of introk zitten erin.',
    steden: 'Per stad: Totaal = kruispunten in de database; Vers 7 d = kruispunten met een meting in de laatste 7 dagen; Geverif. = kruispunten met geaccepteerde metingen van minstens 2 verschillende gebruikers. De tabel zelf heeft geen kleuren; die horen bij de kaart.',
    nieuw: 'Kleur van een punt op de kaart = aantal nieuwe metingen in de gekozen periode (1 u, 24 u of 7 d): helderblauw 20 of meer, middenblauw 5 tot 19, donkerblauw 1 tot 4, grijsblauw geen nieuwe. Hoe groter de stip, hoe meer nieuwe metingen. Een pulserende ring: een nieuwe meting in de laatste 3 uur.'
  };
  const metInfo = (tekst, sleutel) => el('span', { klasse: 'met-info' }, tekst, info(UITLEG[sleutel], tekst));
  const getal = (x) => (x == null ? '–' : Number(x).toLocaleString('nl-NL'));
  function moment(t) { if (!t) return '–'; const d = new Date(t); return isNaN(d) ? '–' : d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function dag(t) { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }); }
  async function rpc(naam, args) {
    const { data, error } = await db.rpc(naam, args || {});
    if (error) throw error;
    return data;
  }
  function tabel(koppen, rijen, leeg) {
    if (!rijen.length) return el('p', { klasse: 'stil klein', tekst: leeg || 'Nog niets.' });
    return el('div', { klasse: 'schuif' }, el('table', { klasse: 'tabel' },
      el('thead', null, el('tr', null, koppen.map(k => k.i ? el('th', { klasse: k.g ? 'getal' : null }, metInfo(k.t, k.i)) : el('th', { tekst: k.t, klasse: k.g ? 'getal' : null })))),
      el('tbody', null, rijen.map(r => el('tr', null, koppen.map(k => { const w = k.w(r); return w instanceof Node ? el('td', null, w) : el('td', { tekst: w == null ? '–' : String(w), klasse: k.g ? 'getal' : null }); }))))));
  }
  function stopKlok() { if (klok !== null) { clearInterval(klok); klok = null; } }
  function vervangInhoud(doel, ...kind) { doel.replaceChildren(...kind.flat().filter(Boolean)); }

  // ── inloggen ────────────────────────────────────────────────
  // Drie vormen in één kaart: inloggen, wachtwoord vergeten, registreren.
  // melding: tekst (fout) of { t, ok }. Het ingevulde e-mailadres gaat mee bij wisselen.
  let onthoudMail = '';
  function toonInlog(melding, modus) {
    stopKlok(); kaart = null; profiel = null;
    modus = modus || 'inloggen';
    const OND = { inloggen: 'Inloggen', vergeten: 'Wachtwoord vergeten', registreren: 'Account maken' };
    const veld = (label, invoer, hulp) => el('label', null, label, invoer, hulp ? el('span', { klasse: 'hulp', tekst: hulp }) : null);
    const mail = el('input', { type: 'email', autocomplete: 'username', required: true, id: 'mail', maxlength: '254' });
    mail.value = onthoudMail; mail.addEventListener('input', () => { onthoudMail = mail.value; });
    const ww = el('input', { type: 'password', autocomplete: modus === 'registreren' ? 'new-password' : 'current-password', required: true, id: 'ww', maxlength: String(S.WW_MAX) });
    const ww2 = el('input', { type: 'password', autocomplete: 'new-password', required: true, id: 'ww2', maxlength: String(S.WW_MAX) });
    const st = el('p', { klasse: 'status', role: 'status', 'aria-live': 'polite' });
    const zet = (t, ok) => { st.className = 'status ' + (ok ? 'ok' : 'fout'); st.textContent = t || ''; };
    if (melding) typeof melding === 'string' ? zet(melding) : zet(melding.t, melding.ok);
    const ander = (t, m) => el('button', { type: 'button', klasse: 'link', tekst: t, klik: () => toonInlog(null, m) });
    const extra = el('div', { klasse: 'extra' });
    let velden, knopTekst, verstuur;

    if (modus === 'vergeten') {
      velden = [el('p', { klasse: 'klein stil', tekst: 'Vul je e-mailadres in. Je krijgt een mail met een link om een nieuw wachtwoord in te stellen.' }), veld('E-mailadres', mail)];
      knopTekst = 'Stuur herstelmail';
      verstuur = async () => {
        const { error } = await db.auth.resetPasswordForEmail(mail.value.trim(), { redirectTo: S.HERSTEL_URL });
        // Altijd dezelfde melding, of het adres nu bestaat of niet (verraadt geen accounts).
        if (error && (error.status === 429 || /fetch|network|rate/i.test(foutTekst(error) + ' ' + (error.code || '')))) return zet(S.authMelding(error));
        zet('Als dit e-mailadres bij ons bekend is, ontvang je binnen een paar minuten een mail. Kijk ook in je spam.', true);
      };
    } else if (modus === 'registreren') {
      velden = [veld('E-mailadres', mail), veld('Wachtwoord', ww, 'Minstens ' + S.WW_MIN + ' tekens.'), veld('Herhaal wachtwoord', ww2)];
      knopTekst = 'Account maken';
      verstuur = async () => {
        const f = S.wachtwoordFout(ww.value, ww2.value); if (f) return zet(f);
        const { data, error } = await db.auth.signUp({ email: mail.value.trim(), password: ww.value, options: { emailRedirectTo: S.DASH_URL } });
        ww.value = ''; ww2.value = '';
        if (error) return zet(S.authMelding(error));
        if (data && data.session) return naInloggen();   // alleen als e-mailbevestiging in Supabase uit staat
        // Ook bij een bestaand adres geeft Supabase (met bevestiging aan) geen fout; dezelfde melding verraadt dus niets.
        zet('Bijna klaar. We hebben een bevestigingsmail gestuurd. Klik op de link in die mail en log daarna in.', true);
      };
    } else {
      velden = [veld('E-mailadres', mail), veld('Wachtwoord', ww)];
      knopTekst = 'Inloggen';
      verstuur = async () => {
        const { error } = await db.auth.signInWithPassword({ email: mail.value.trim(), password: ww.value });
        if (error) {
          zet(S.authMelding(error));
          if (error.code === 'email_not_confirmed' || /not.?confirmed/i.test(foutTekst(error))) {
            vervangInhoud(extra, el('button', { type: 'button', klasse: 'link', tekst: 'Stuur de bevestigingsmail opnieuw', klik: async (ev) => {
              ev.target.disabled = true;
              const r = await db.auth.resend({ type: 'signup', email: mail.value.trim(), options: { emailRedirectTo: S.DASH_URL } });
              zet(r.error ? S.authMelding(r.error) : 'De bevestigingsmail is opnieuw verstuurd.', !r.error);
            } }));
          }
          return;
        }
        ww.value = ''; await naInloggen();
      };
    }
    const knop = el('button', { type: 'submit', klasse: 'hoofdknop', tekst: knopTekst });
    const wissel = modus === 'inloggen'
      ? el('div', { klasse: 'wissel' }, ander('Wachtwoord vergeten?', 'vergeten'), ander('Nog geen account? Registreren', 'registreren'))
      : el('div', { klasse: 'wissel' }, ander('← Terug naar inloggen', 'inloggen'));
    const form = el('form', { klasse: 'inlog', novalidate: true, 'aria-label': OND[modus] },
      S.merk(OND[modus]), velden, knop, st, extra, wissel);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      if (!mail.value.trim() || !mail.checkValidity()) return zet('Vul een geldig e-mailadres in.');
      if (modus === 'inloggen' && !ww.value) return zet('Vul je wachtwoord in.');
      knop.disabled = true; zet('');
      try { await verstuur(); } catch (e) { zet(S.authMelding(e)); }
      knop.disabled = false;
    });
    vervangInhoud(app, el('div', { klasse: 'inlogvak' }, form), S.voet());
    (mail.value ? (modus === 'vergeten' ? knop : ww) : mail).focus();
  }

  async function naInloggen() {
    offline = false;
    try {
      const data = await rpc('mijn_profiel');
      profiel = Array.isArray(data) ? data[0] : data;
      if (!profiel) throw new Error('geen profiel');
      try { localStorage.setItem(ROL_SLEUTEL, JSON.stringify({ is_admin: !!profiel.is_admin, t: Date.now() })); } catch (e) {}
    } catch (e) {
      let r = null; try { r = JSON.parse(localStorage.getItem(ROL_SLEUTEL) || 'null'); } catch (x) {}
      const geenNet = !navigator.onLine || /fetch|network/i.test(foutTekst(e));   // alleen zonder netwerk de oude rol, niet bij een verlopen sessie
      if (!r || !geenNet) {
        // Geen profiel (of geen toegang): niet ingelogd laten staan.
        try { await db.auth.signOut({ scope: 'local' }); } catch (x) {}
        try { localStorage.removeItem(ROL_SLEUTEL); } catch (x) {}
        profiel = null;
        toonInlog(/geen profiel/.test(foutTekst(e)) ? 'Dit account heeft geen toegang.' : 'Kon je profiel niet ophalen: ' + foutTekst(e));
        return;
      }
      offline = true; profiel = { is_admin: !!r.is_admin };
    }
    // V11.38.0 (F1): geen beheerder = lokaal uitloggen en alleen "Geen toegang". Er komt geen tabblad, kaart of beheerdata in beeld.
    if (!profiel.is_admin) { await geenToegang(); return; }
    try { const { data } = await db.from('app_config').select('sleutel,waarde'); config = Object.fromEntries((data || []).map(x => [x.sleutel, x.waarde])); } catch (e) { config = {}; }
    // V11.38.0 (F4): staat de schakelaar aan, dan eerst de tweede stap. De database eist hem dan ook (is_admin()).
    if (!offline && config.admin_mfa_verplicht === true && !(await mfaInOrde())) return;
    tab = 'kaart';
    teken();
  }
  async function geenToegang() {
    profiel = null;
    try { await db.auth.signOut({ scope: 'local' }); } catch (x) {}
    try { localStorage.removeItem(ROL_SLEUTEL); } catch (x) {}
    vervangInhoud(app, el('div', { klasse: 'inlogvak', id: 'geen-toegang' }, S.merk(), el('h2', { tekst: 'Geen toegang' }),
      el('p', { klasse: 'stil', tekst: 'Dit dashboard is alleen voor de beheerder. Je bent hier uitgelogd. Je account en je gegevens beheer je in de app.' }),
      el('p', null, el('a', { href: 'index.html', tekst: 'Naar de app' }))), S.voet());
  }

  // ── tweede stap (MFA, een authenticator-app) ────────────────
  async function mfaInOrde() {
    try {
      const { data, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      if (data && data.currentLevel === 'aal2') return true;
      const f = await db.auth.mfa.listFactors();
      const klaar = ((f.data && f.data.totp) || []).filter(x => x.status === 'verified');
      toonMfa(klaar[0] || null);
    } catch (e) { profiel = null; toonInlog('De tweede stap kon niet worden gecontroleerd: ' + foutTekst(e)); }
    return false;
  }
  function codeVeld() { return el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', placeholder: '6 cijfers', 'aria-label': 'Code uit de authenticator-app' }); }
  function toonMfa(factor) {
    const st = el('p', { klasse: 'status' });
    const uit = el('button', { tekst: 'Uitloggen', klik: async () => { profiel = null; await db.auth.signOut(); toonInlog(); } });
    if (!factor) {
      vervangInhoud(app, el('div', { klasse: 'inlogvak', id: 'mfa-instellen' }, S.merk(), el('h2', { tekst: 'Tweede stap instellen' }),
        el('p', { klasse: 'stil', tekst: 'Voor het dashboard is een tweede stap verplicht, en die is op dit account nog niet ingesteld.' }), mfaAanmeldBlok(() => naInloggen()), uit), S.voet());
      return;
    }
    const code = codeVeld();
    const knop = el('button', { klasse: 'hoofd', tekst: 'Controleer', klik: async () => {
      knop.disabled = true;
      try { const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.value.trim() }); if (error) throw error; await naInloggen(); }
      catch (e) { st.className = 'status fout'; st.textContent = 'De code klopt niet of is verlopen. Probeer het opnieuw.'; }
      knop.disabled = false;
    } });
    vervangInhoud(app, el('div', { klasse: 'inlogvak', id: 'mfa-vraag' }, S.merk(), el('h2', { tekst: 'Tweede stap' }),
      el('p', { klasse: 'stil', tekst: 'Open je authenticator-app en typ de code van 6 cijfers voor StoplichtIQ.' }), code, knop, st, uit), S.voet());
    code.focus();
  }
  // Aanmelden van een authenticator-app. Roept `klaar` aan zodra de eerste code is goedgekeurd.
  function mfaAanmeldBlok(klaar) {
    const st = el('p', { klasse: 'status' }), vak = el('div', null);
    const start = el('button', { tekst: 'Authenticator-app koppelen', klik: async () => {
      start.disabled = true; st.className = 'status'; st.textContent = '';
      try {
        const f = await db.auth.mfa.listFactors();
        for (const x of ((f.data && f.data.all) || []).filter(x => x.status !== 'verified')) { try { await db.auth.mfa.unenroll({ factorId: x.id }); } catch (e) {} }
        const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'StoplichtIQ ' + new Date().toISOString().slice(0, 10) });
        if (error) throw error;
        const code = codeVeld();
        const ok = el('button', { klasse: 'hoofd', tekst: 'Bevestig', klik: async () => {
          ok.disabled = true;
          try { const r = await db.auth.mfa.challengeAndVerify({ factorId: data.id, code: code.value.trim() }); if (r.error) throw r.error; st.className = 'status ok'; st.textContent = 'De tweede stap is ingesteld.'; vervangInhoud(vak); if (klaar) await klaar(); }
          catch (e) { st.className = 'status fout'; st.textContent = 'De code klopt niet. Wacht op een nieuwe code in de app en probeer het opnieuw.'; }
          ok.disabled = false;
        } });
        vervangInhoud(vak, el('p', { klasse: 'stil', tekst: '1. Open een authenticator-app (bijvoorbeeld die van je telefoon). 2. Scan deze code. 3. Typ de 6 cijfers die de app toont.' }),
          el('img', { src: data.totp.qr_code, alt: 'QR-code voor de authenticator-app', width: '180', height: '180', stijl: { background: '#fff', borderRadius: '8px' } }),
          el('p', { klasse: 'klein stil', tekst: 'Lukt scannen niet? Typ dan deze sleutel in de app: ' + data.totp.secret }), code, ok);
      } catch (e) { st.className = 'status fout'; st.textContent = /mfa|disabled|not enabled/i.test(foutTekst(e)) ? 'De tweede stap staat nog uit in Supabase (Authentication > Multi-Factor). Zet TOTP daar eerst aan.' : foutTekst(e); }
      start.disabled = false;
    } });
    return el('div', { id: 'mfa-aanmelden' }, start, vak, st);
  }

  // ── de schil ────────────────────────────────────────────────
  function teken() {
    stopKlok(); kaart = null;
    const knop = (id, t) => el('button', { tekst: t, klasse: tab === id ? 'aan' : null, klik: () => { tab = id; teken(); } });
    const kop = el('header', { klasse: 'kop' }, el('h1', { klasse: 'kopmerk' }, S.logo(28), 'Stoplicht', el('span', { tekst: 'IQ' })),
      el('nav', { klasse: 'tabs' }, knop('kaart', 'Kaart'), knop('gebruikers', 'Gebruikers'), knop('quarantaine', 'Quarantaine'), knop('volledig', 'Volledig'), knop('kwaliteit', 'Countdown'), knop('feedback', 'Feedback'), knop('beveiliging', 'Beveiliging'), knop('mijn', 'Mijn gegevens')),
      el('span', { klasse: 'ruimte' }), el('button', { tekst: 'Uitloggen', klik: async () => { await db.auth.signOut(); profiel = null; try { localStorage.removeItem(ROL_SLEUTEL); } catch (e) {} toonInlog(); } }));
    const inhoud = el('div', { stijl: { flex: '1', display: 'flex', flexDirection: 'column', minHeight: '0' } });
    vervangInhoud(app, kop,
      offline ? el('div', { klasse: 'melding', tekst: 'Geen verbinding. Je ziet de laatst bekende rol; gegevens kunnen niet worden opgehaald.' }) : null,
      config.bericht ? el('div', { klasse: 'melding', tekst: String(config.bericht) }) : null,
      inhoud, S.voet());
    if (tab === 'kaart') tekenBeheer(inhoud);
    else if (tab === 'gebruikers') tekenGebruikers(inhoud);
    else if (tab === 'quarantaine') tekenQuarantaine(inhoud);
    else if (tab === 'volledig') tekenVolledig(inhoud);   // V11.38.14
    else if (tab === 'kwaliteit') tekenKwaliteit(inhoud);
    else if (tab === 'feedback') tekenFeedback(inhoud);
    else if (tab === 'beveiliging') tekenBeveiliging(inhoud);
    else tekenMijn(inhoud);
  }

  // ── V11.38.0 (F2): quarantaine, countdown-kwaliteit, feedback, beveiliging ──
  function pagina(doel, titel, sleutel, ...kind) {
    vervangInhoud(doel, el('div', { klasse: 'pagina' }, el('section', { klasse: 'blok' }, el('h2', null, metInfo(titel, sleutel)), ...kind)));
  }
  async function tekenQuarantaine(doel) {
    const lijst = el('div', { id: 'quar-lijst' }, el('p', { klasse: 'stil', tekst: 'Laden…' })), st = el('p', { klasse: 'status' });
    pagina(doel, 'Quarantaine', 'quarlijst', st, lijst);
    const laad = async () => {
      try {
        const rijen = (await rpc('admin_quarantaine_lijst')) || [];
        const doe = (r, goed) => async (ev) => {
          ev.target.disabled = true;
          try { await rpc('admin_beoordeel_meting', { p_id: r.id, p_goedkeuren: goed }); st.className = 'status ok'; st.textContent = goed ? 'Meting goedgekeurd.' : 'Meting afgewezen.'; await laad(); }
          catch (e) { st.className = 'status fout'; st.textContent = foutTekst(e); ev.target.disabled = false; }
        };
        vervangInhoud(lijst, tabel([
          { t: 'Binnen', w: r => moment(r.aangemaakt_op) }, { t: 'Kruispunt', w: r => r.naam || r.node_id }, { t: 'Dagdeel', w: r => r.dagdeel },
          { t: 'Gemeten s', g: 1, w: r => getal(Math.round(r.duur)) }, { t: 'Bekend s', g: 1, w: r => r.mediaan_sec == null ? 'nieuw' : getal(Math.round(r.mediaan_sec)) + ' (n=' + getal(r.n_bekend) + ')' },
          { t: 'Gebruiker', w: r => r.gebruiker }, { t: 'Wacht al', w: r => wachtDuur(r.aangemaakt_op) },
          { t: 'Oordeel', w: r => el('span', null, el('button', { tekst: 'Goedkeuren', klik: doe(r, true) }), ' ', el('button', { tekst: 'Afwijzen', klik: doe(r, false) })) },
        ], rijen, 'Er wacht niets in quarantaine.'));
      } catch (e) { vervangInhoud(lijst, el('p', { klasse: 'status fout', tekst: foutTekst(e) })); }
    };
    laad();
  }
  // Hoe lang een meting al in quarantaine staat. Er wordt niets automatisch verwijderd.
  function wachtDuur(t) {
    const ms = Date.now() - new Date(t).getTime(); if (!(ms >= 0)) return '–';
    const u = Math.floor(ms / 3600000), d = Math.floor(u / 24);
    return d >= 1 ? d + ' d ' + (u % 24) + ' u' : u >= 1 ? u + ' u' : Math.max(1, Math.round(ms / 60000)) + ' min';
  }
  const KWAL_MIN_N = 30;   // onder dit aantal geen percentage: te weinig om iets te zeggen
  async function tekenKwaliteit(doel) {
    const lijst = el('div', { id: 'kwal-lijst' }, el('p', { klasse: 'stil', tekst: 'Laden…' }));
    pagina(doel, 'Hoe vaak klopte de countdown', 'kwaliteit', lijst);
    try {
      const rijen = ((await rpc('admin_countdown_kwaliteit')) || []).filter(r => r.gebruiker === 'alle gebruikers' || Number(r.n) > 0);
      vervangInhoud(lijst, tabel([
        { t: 'Gebruiker', w: r => r.gebruiker }, { t: 'Metingen (n)', g: 1, w: r => getal(r.n) },
        { t: 'Goed', g: 1, w: r => Number(r.n) < KWAL_MIN_N ? 'nog niet genoeg data' : String(r.pct_goed).replace('.', ',') + '% (' + getal(r.n_goed) + ' van ' + getal(r.n) + ')' },
        { t: 'Mediaan ernaast', g: 1, w: r => Number(r.n) < KWAL_MIN_N || r.mediaan_fout_sec == null ? '–' : getal(Math.round(r.mediaan_fout_sec)) + ' s' },
        { t: 'Onvolledig (niet meegeteld)', g: 1, w: r => r.n_onvolledig == null ? '–' : getal(r.n_onvolledig) },
      ], rijen, 'Nog niet genoeg data.'));
    } catch (e) { vervangInhoud(lijst, el('p', { klasse: 'status fout', tekst: foutTekst(e) })); }
  }
  async function tekenFeedback(doel) {
    const lijst = el('div', { id: 'fb-lijst' }, el('p', { klasse: 'stil', tekst: 'Laden…' }));
    pagina(doel, 'Feedback van gebruikers', 'feedback', lijst);
    try {
      const rijen = (await rpc('admin_feedback_lijst')) || [];
      vervangInhoud(lijst, tabel([{ t: 'Wanneer', w: r => moment(r.aangemaakt_op) }, { t: 'Van', w: r => r.email }, { t: 'Versie', w: r => r.app_versie }, { t: 'Tekst', w: r => r.tekst }], rijen, 'Nog geen feedback.'));
    } catch (e) { vervangInhoud(lijst, el('p', { klasse: 'status fout', tekst: foutTekst(e) })); }
  }
  async function tekenBeveiliging(doel) {
    const vak = el('div', { id: 'mfa-vak' }, el('p', { klasse: 'stil', tekst: 'Laden…' })), st = el('p', { klasse: 'status' });
    pagina(doel, 'Tweede stap bij inloggen (MFA)', 'mfa', st, vak);
    const laad = async () => {
      try {
        const f = await db.auth.mfa.listFactors(); if (f.error) throw f.error;
        const klaar = ((f.data && f.data.totp) || []).filter(x => x.status === 'verified');
        const niveau = await db.auth.mfa.getAuthenticatorAssuranceLevel();
        const aal2 = niveau.data && niveau.data.currentLevel === 'aal2', verplicht = config.admin_mfa_verplicht === true;
        const zet = (aan) => async (ev) => {
          ev.target.disabled = true;
          try { await rpc('admin_zet_config', { p_sleutel: 'admin_mfa_verplicht', p_waarde: aan, p_omschrijving: null }); config.admin_mfa_verplicht = aan; st.className = 'status ok'; st.textContent = aan ? 'De tweede stap is nu verplicht voor het dashboard.' : 'De tweede stap is niet meer verplicht.'; await laad(); }
          catch (e) { st.className = 'status fout'; st.textContent = foutTekst(e); ev.target.disabled = false; }
        };
        vervangInhoud(vak,
          el('p', { tekst: klaar.length ? 'Er is een authenticator-app gekoppeld aan dit account.' : 'Er is nog geen authenticator-app gekoppeld.' }),
          klaar.length ? el('button', { tekst: 'Koppeling verwijderen', disabled: verplicht, title: verplicht ? 'Zet eerst "verplicht" uit' : null, klik: async (ev) => { ev.target.disabled = true; try { for (const x of klaar) await db.auth.mfa.unenroll({ factorId: x.id }); await laad(); } catch (e) { st.className = 'status fout'; st.textContent = foutTekst(e); } } }) : mfaAanmeldBlok(laad),
          el('p', { tekst: 'Verplicht voor het dashboard: ' + (verplicht ? 'ja' : 'nee') + '.' }),
          verplicht ? el('button', { tekst: 'Verplichting uitzetten', klik: zet(false) })
                    : el('button', { tekst: 'Tweede stap verplicht maken', disabled: !aal2, title: aal2 ? null : 'Kan pas als je in deze sessie zelf met de tweede stap bent ingelogd', klik: zet(true) }),
          aal2 || verplicht ? null : el('p', { klasse: 'klein stil', tekst: 'Verplicht maken kan pas nadat je een app hebt gekoppeld en in deze sessie een code hebt ingevuld. Zo sluit je jezelf niet buiten.' }));
      } catch (e) { vervangInhoud(vak, el('p', { klasse: 'status fout', tekst: foutTekst(e) })); }
    };
    laad();
  }

  // ── beheer: kaart + zijpaneel ───────────────────────────────
  const STAPPEN = [{ min: 20, kleur: '#22D3EE', t: '20 of meer' }, { min: 5, kleur: '#2AA6C4', t: '5–19' }, { min: 1, kleur: '#2F7C9A', t: '1–4' }, { min: 0, kleur: '#3C5470', t: 'geen nieuwe' }];
  const stap = (n) => STAPPEN.find(s => n >= s.min);
  function straal(n) { return Math.min(14, 3 + Math.sqrt(Math.max(0, n)) * 1.8); }

  function tekenBeheer(doel) {
    const kaartEl = el('div', { id: 'kaart' });
    const status = el('span', { klasse: 'status', tekst: '' });
    const leeg = el('div', { klasse: 'leeg', stijl: { display: 'none' } }, el('b', { tekst: 'Nog geen kruispunten binnengekomen.' }), el('div', { klasse: 'klein stil', tekst: 'Nog geen data. De app stuurt nog geen metingen naar de database; dat komt in een volgende fase.' }));
    const filter = (u, t) => el('button', { tekst: t, klasse: uren === u ? 'aan' : null, klik: () => { uren = u; teken(); } });
    const legenda = el('div', { klasse: 'legenda' }, el('b', null, metInfo('Nieuw in deze periode', 'nieuw')),
      STAPPEN.map(s => el('div', null, el('span', { klasse: 'punt', stijl: { width: '10px', height: '10px', background: s.kleur } }), s.t)),
      el('div', { klasse: 'stil', tekst: 'Pulserend: laatste ' + PULS_UUR + ' uur' }));
    const vFilter = el('button', { tekst: 'Alleen volledig', klasse: alleenVolledig ? 'aan' : null, 'aria-pressed': String(alleenVolledig), klik: () => { alleenVolledig = !alleenVolledig; teken(); } });   // V11.38.14
    const vak = el('div', { klasse: 'kaartvak' }, kaartEl, el('div', { klasse: 'kaartbalk' }, filter(1, '1 u'), filter(24, '24 u'), filter(168, '7 d'), vFilter, status), legenda, leeg);
    const zij = el('aside', { klasse: 'zij' });
    vervangInhoud(doel, el('div', { klasse: 'beheer' }, vak, zij));

    const NL = [[50.72, 3.33], [53.56, 7.25]];
    kaart = L.map(kaartEl, { preferCanvas: true, attributionControl: true, minZoom: 6, maxBounds: [[49.5, 1.5], [54.8, 9.2]] }).setView([52.15, 5.3], 7);
    const dezeKaart = kaart;
    let aangepast = false;
    kaart.on('dragstart zoomstart', (e) => { if (e.originalEvent !== undefined || e.type === 'dragstart') aangepast = true; });
    new ResizeObserver(() => { if (kaart !== dezeKaart) return; dezeKaart.invalidateSize(); if (!aangepast && kaartEl.clientHeight > 100) dezeKaart.fitBounds(NL, { animate: false }); }).observe(kaartEl);
    // 14 nov: de pagina stuurt nergens een Referer mee (meta referrer no-referrer). De tegelserver van
    // OpenStreetMap weigert tegels zonder Referer ("x-blocked: No referer sent", een blokkadeplaatje).
    // Alleen voor de tegels gaat nu de herkomst mee (https://ylemaalem.github.io/), geen pad of query.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, referrerPolicy: 'strict-origin-when-cross-origin',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-bijdragers' }).addTo(kaart);
    laag = L.layerGroup().addTo(kaart);

    // V11.38.14: de volledig-telling een keer per verversing, voor kaart en zijpaneel samen.
    const ververs = async () => { const ov = await haalOverzicht(); return Promise.all([laadKaart(status, leeg, ov), laadZij(zij, ov)]); };
    ververs();
    klok = setInterval(() => { if (!document.hidden) ververs(); }, VERVERS_MS);
  }

  async function laadKaart(status, leeg, ov) {
    const mijnKaart = kaart;
    try {
      const rijen = (await rpc('admin_kaart_activiteit', { p_uren: uren })) || [];
      if (kaart !== mijnKaart) return;
      laag.clearLayers();
      const grens = Date.now() - PULS_UUR * 3600000;
      const perNode = ovPerNode(ov);   // V11.38.14
      const metVolledig = (r) => { const v = perNode.get(String(r.node_id)); return !!v && Number(v.n_volledig) > 0; };   // V11.38.14
      for (const r of rijen) {
        if (typeof r.lat !== 'number' || typeof r.lon !== 'number') continue;
        if (alleenVolledig && !metVolledig(r)) continue;   // V11.38.14
        const vn = perNode.get(String(r.node_id));   // V11.38.14
        const n = Number(r.nieuw_in_periode) || 0, s = stap(n), rad = straal(n);
        const tip = el('div', null, el('b', { tekst: r.naam || r.node_id }), r.stad ? el('div', { tekst: r.stad }) : null,
          el('div', { tekst: 'nieuw: ' + getal(n) + ' · quarantaine: ' + getal(r.in_quarantaine) }),
          el('div', { tekst: 'geaccepteerd: ' + getal(r.totaal_geaccepteerd) + ' · bijdragers: ' + getal(r.bijdragers) }),
          vn ? el('div', { tekst: 'volledig: ' + getal(vn.n_volledig) + ' · onvolledig: ' + getal(vn.n_onvolledig) + ' · onbekend: ' + getal(vn.n_onbekend) }) : null,   // V11.38.14
          vn ? el('div', { klasse: 'stil', tekst: 'laatste volledige: ' + moment(vn.laatste_volledig) }) : null,
          el('div', { klasse: 'stil', tekst: 'laatste: ' + moment(r.laatste_meting) }));
        if (n > 0) L.circleMarker([r.lat, r.lon], { radius: rad * 2.3, stroke: false, fillColor: s.kleur, fillOpacity: 0.16, interactive: false }).addTo(laag);
        L.circleMarker([r.lat, r.lon], { radius: rad, stroke: false, fillColor: s.kleur, fillOpacity: 0.95 }).bindTooltip(tip, { direction: 'top' }).addTo(laag);
      }
      rijen.filter(r => !alleenVolledig || metVolledig(r))   // V11.38.14
        .filter(r => Number(r.nieuw_in_periode) > 0 && r.laatste_meting && new Date(r.laatste_meting).getTime() >= grens && typeof r.lat === 'number')
        .sort((a, b) => new Date(b.laatste_meting) - new Date(a.laatste_meting)).slice(0, PULS_MAX)
        .forEach(r => { const d = 2 * straal(Number(r.nieuw_in_periode)); L.marker([r.lat, r.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'puls', iconSize: [d, d] }) }).addTo(laag); });
      leeg.style.display = rijen.length ? 'none' : '';
      const getoond = alleenVolledig ? rijen.filter(metVolledig).length : rijen.length;   // V11.38.14
      status.className = 'status'; status.textContent = getal(getoond) + ' kruispunten' + (alleenVolledig ? ' met een volledige meting' : '') + ' · ' + new Date().toLocaleTimeString('nl-NL');
    } catch (e) { status.className = 'status fout'; status.textContent = foutTekst(e); }
  }

  async function laadZij(zij, ov) {
    // V11.38.14: de dagtegel en de grafiek komen uit admin_volledig_overzicht (dag van observed_at, Amsterdamse tijd).
    // Lukt dat niet, dan de oude telling (admin_inflow_daily: dag van binnenkomst, UTC), met een melding erbij.
    const oud = !Array.isArray(ov);
    const [inflow, steden, quar, events] = await Promise.all([oud ? 'admin_inflow_daily' : null, 'admin_city_progress', 'admin_quarantaine_monitor', 'admin_recent_events'].map(n => n ? rpc(n).catch(e => ({ fout: foutTekst(e) })) : Promise.resolve(ovDagen(ov))));
    const sectie = (titel, d, maak, sl) => el('section', null, sl ? el('h2', null, metInfo(titel, sl)) : el('h2', { tekst: titel }), d && d.fout ? el('p', { klasse: 'status fout', tekst: d.fout }) : maak(d || []));
    vervangInhoud(zij,
      oud ? null : sectie('Volledig, alle metingen', ov, totaalBlok, 'volledig'),   // V11.38.14
      sectie(oud ? 'Binnenkomst, 30 dagen' : 'Gemeten, 30 dagen', inflow, d => inflowBlok(d, oud)),
      sectie('Steden', steden, d => tabel([{ t: 'Stad', w: r => r.stad }, { t: 'Totaal', g: 1, w: r => getal(r.nodes_totaal) }, { t: 'Vers 7 d', g: 1, w: r => getal(r.nodes_vers_7d) }, { t: 'Geverif.', g: 1, w: r => getal(r.nodes_geverifieerd) }], d.slice(0, 15), 'Nog geen steden.'), 'steden'),
      sectie('Quarantaine', quar, d => tabel([{ t: 'Kruispunt', w: r => r.node_id }, { t: 'Aantal', g: 1, w: r => getal(r.in_quarantaine) }, { t: 'Dagen oud', g: 1, w: r => getal(r.dagen_oud) }], d.slice(0, 10), 'Niets in quarantaine.'), 'quarantaine'),
      sectie('Recente gebeurtenissen', events, d => tabel([{ t: 'Tijd', w: r => moment(r.created_at) }, { t: 'Soort', w: r => r.soort }, { t: 'Stad', w: r => r.city }, { t: 'Wie', w: r => r.gebruiker_kort }], d.slice(0, 15), 'Nog geen gebeurtenissen.')));
  }

  function inflowBlok(rijen, oud) {
    const d = rijen.slice().sort((a, b) => new Date(a.dag) - new Date(b.dag));
    // 14 nov: de laatste rij is de laatste dag MET metingen, niet per se vandaag. Alleen een rij van vandaag telt.
    // V11.38.14: vandaag in Amsterdamse tijd (de dag van observed_at); alleen de oude terugval telt in UTC.
    const vandaag = oud ? new Date().toISOString().slice(0, 10) : amsterdamDag(Date.now());
    const nu = d.find(r => String(r.dag).slice(0, 10) === vandaag) || {};
    const haakjes = (r) => oud ? (Number(r.onvolledig) > 0 ? ' (' + getal(r.onvolledig) + ' onvolledig)' : '')
      : (Number(r.geaccepteerd) > 0 ? ' (' + getal(Number(r.volledig) || 0) + ' volledig, ' + getal(Number(r.onvolledig) || 0) + ' onvolledig' + (Number(r.onbekend) > 0 ? ', ' + getal(r.onbekend) + ' onbekend' : '') + ')' : '');
    const tegels = el('div', null, el('div', { klasse: 'tegels', id: 'dagtegels' },
      [['Geaccepteerd', nu.geaccepteerd, haakjes(nu)], ['Quarantaine', nu.in_quarantaine, ''], ['Actief', nu.actieve_gebruikers, '']].map(([t, w, h]) => el('div', { klasse: 'tegel' }, el('b', { tekst: getal(w || 0) }), el('span', { tekst: t + (oud ? ' vandaag' : ' vandaag gemeten') + h })))),
      oud ? el('div', { klasse: 'melding', id: 'oude-telling', tekst: 'Oude telling: dag van binnenkomst (UTC). De telling per meetdag kon niet worden opgehaald.' }) : null,
      el('div', { klasse: 'klein stil', stijl: { marginTop: '4px' } }, metInfo('Wat tellen deze drie?', 'vandaag')));
    if (!d.length) return el('div', null, tegels, el('p', { klasse: 'stil klein', tekst: 'Nog geen metingen binnen.' }));
    const B = 348, H = 110, onder = 16, max = Math.max(1, ...d.map(r => (Number(r.geaccepteerd) || 0) + (Number(r.in_quarantaine) || 0)));
    const sl = B / d.length, br = Math.max(2, sl - 2), hgt = H - onder, svg = sv('svg', { viewBox: '0 0 ' + B + ' ' + H, role: 'img', 'aria-label': 'Binnenkomst per dag' });
    const tip = el('div', { klasse: 'tip', stijl: { display: 'none' } });
    const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    svg.append(sv('line', { x1: 0, x2: B, y1: hgt + .5, y2: hgt + .5, stroke: css('--lijn') }));
    d.forEach((r, i) => {
      const a = Number(r.geaccepteerd) || 0, q = Number(r.in_quarantaine) || 0, ha = a / max * (hgt - 2), hq = q / max * (hgt - 2), x = i * sl + 1;
      if (a) svg.append(sv('rect', { x, y: hgt - ha, width: br, height: Math.max(1, ha), rx: Math.min(2, br / 2), fill: css('--s1') }));
      if (q) svg.append(sv('rect', { x, y: hgt - ha - hq - (a ? 2 : 0), width: br, height: Math.max(1, hq), rx: Math.min(2, br / 2), fill: css('--s2') }));
      const hit = sv('rect', { x: i * sl, y: 0, width: sl, height: H, class: 'hit' });
      hit.addEventListener('mouseenter', () => { tip.textContent = dag(r.dag) + ': ' + getal(a) + ' geaccepteerd' + (oud ? ' (' + getal(Number(r.onvolledig) || 0) + ' onvolledig)' : haakjes(r)) + ', ' + getal(q) + ' quarantaine, ' + getal(r.actieve_gebruikers) + ' actief'; tip.style.display = ''; tip.style.top = '0'; tip.style.left = Math.min(i * sl, B - 230) + 'px'; });
      hit.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svg.append(hit);
    });
    const lab = (x, t, anker) => { const e = sv('text', { x, y: H - 3, 'font-size': 10, fill: css('--stil'), 'text-anchor': anker }); e.textContent = t; svg.append(e); };
    lab(0, dag(d[0].dag), 'start'); lab(B, dag(d[d.length - 1].dag), 'end');
    return el('div', null, tegels, el('div', { klasse: 'legenda-rij', stijl: { marginTop: '10px' } }, el('span', null, el('i', { klasse: 'blokje s1' }), 'Geaccepteerd'), el('span', null, el('i', { klasse: 'blokje s2' }), 'Quarantaine')),
      el('div', { klasse: 'grafiek' }, svg, tip),
      el('details', null, el('summary', { tekst: 'Als tabel' }), tabel([{ t: 'Dag', w: r => dag(r.dag) }, { t: 'Geacc.', g: 1, w: r => getal(r.geaccepteerd) }, oud ? null : { t: 'Volledig', g: 1, w: r => getal(Number(r.volledig) || 0) }, { t: 'Onvolledig', g: 1, w: r => getal(Number(r.onvolledig) || 0) }, oud ? null : { t: 'Onbekend', g: 1, w: r => getal(Number(r.onbekend) || 0) }, { t: 'Quar.', g: 1, w: r => getal(r.in_quarantaine) }, { t: 'Actief', g: 1, w: r => getal(r.actieve_gebruikers) }].filter(Boolean), d.slice().reverse())));
  }

  // ── V11.38.14: volledig / onvolledig / onbekend ─────────────
  // Een leesfunctie op de server (admin_volledig_overzicht, met de beheerderscontrole van de andere admin_-functies).
  // Rijen: soort 'totaal' (een), 'dag' (sleutel JJJJ-MM-DD = Amsterdamse dag van observed_at, 30 dagen), 'node' (sleutel node_id).
  function amsterdamDag(t) { try { return new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); } catch (e) { return new Date(t).toISOString().slice(0, 10); } }
  async function haalOverzicht() { try { const d = await rpc('admin_volledig_overzicht'); return Array.isArray(d) ? d : { fout: 'geen gegevens' }; } catch (e) { return { fout: foutTekst(e) }; } }
  function ovPerNode(ov) { const m = new Map(); if (Array.isArray(ov)) for (const r of ov) if (r.soort === 'node') m.set(String(r.sleutel), r); return m; }
  function ovDagen(ov) {
    return (Array.isArray(ov) ? ov : []).filter(r => r.soort === 'dag').map(r => ({ dag: r.sleutel, geaccepteerd: Number(r.n_totaal) || 0, volledig: Number(r.n_volledig) || 0,
      onvolledig: Number(r.n_onvolledig) || 0, onbekend: Number(r.n_onbekend) || 0, in_quarantaine: Number(r.in_quarantaine) || 0, actieve_gebruikers: Number(r.actieve_gebruikers) || 0 }));
  }
  const pct = (a, n) => Number(n) > 0 ? (Math.round(1000 * Number(a) / Number(n)) / 10).toLocaleString('nl-NL') + '%' : '–';
  function totaalBlok(ov) {
    const t = (Array.isArray(ov) ? ov : []).find(r => r.soort === 'totaal') || {};
    const n = Number(t.n_totaal) || 0;
    return el('div', null, el('div', { klasse: 'tegels', id: 'volledig-totaal' },
      [['Volledig', t.n_volledig], ['Onvolledig', t.n_onvolledig], ['Onbekend', t.n_onbekend], ['Totaal', t.n_totaal]].map(([s, w]) =>
        el('div', { klasse: 'tegel' }, el('b', { tekst: getal(Number(w) || 0) }), el('span', { tekst: s + (s === 'Totaal' ? ' (n)' : ' · ' + pct(w, n)) })))),
      el('div', { klasse: 'klein stil', tekst: 'Laatste volledige meting: ' + moment(t.laatste_volledig) }));
  }
  async function tekenVolledig(doel) {
    const lijst = el('div', { id: 'vol-lijst' }, el('p', { klasse: 'stil', tekst: 'Laden…' })), top = el('div', null);
    const vink = el('input', { type: 'checkbox', id: 'alleen-volledig' }); vink.checked = alleenVolledig;
    pagina(doel, 'Volledig per kruispunt', 'volledig', top, el('div', { klasse: 'rij' }, el('label', { klasse: 'schakel', for: 'alleen-volledig' }, vink, 'Alleen kruispunten met een volledige meting')), lijst);
    const ov = await haalOverzicht();
    if (!Array.isArray(ov)) { vervangInhoud(lijst, el('p', { klasse: 'status fout', tekst: ov.fout })); return; }
    vervangInhoud(top, totaalBlok(ov));
    const alle = [...ovPerNode(ov).values()].filter(r => Number(r.n_totaal) > 0 || Number(r.in_quarantaine) > 0)
      .sort((a, b) => (new Date(b.laatste_volledig || 0) - new Date(a.laatste_volledig || 0)) || (Number(b.n_totaal) - Number(a.n_totaal)));
    const toon = () => vervangInhoud(lijst, tabel([
      { t: 'Kruispunt', w: r => r.naam || r.sleutel }, { t: 'Stad', w: r => r.stad },
      { t: 'Volledig', g: 1, w: r => getal(r.n_volledig) }, { t: 'Onvolledig', g: 1, w: r => getal(r.n_onvolledig) }, { t: 'Onbekend', g: 1, w: r => getal(r.n_onbekend) },
      { t: 'Totaal', g: 1, w: r => getal(r.n_totaal) }, { t: 'Laatste volledige', w: r => moment(r.laatste_volledig) },
    ], alleenVolledig ? alle.filter(r => Number(r.n_volledig) > 0) : alle, alleenVolledig ? 'Nog geen kruispunt met een volledige meting.' : 'Nog geen metingen.'));
    vink.addEventListener('change', () => { alleenVolledig = vink.checked; toon(); });
    toon();
  }

  // ── beheer: gebruikers ──────────────────────────────────────
  async function tekenGebruikers(doel) {
    const lijst = el('div', null, el('p', { klasse: 'stil', tekst: 'Laden…' }));
    const st = el('p', { klasse: 'status' });
    vervangInhoud(doel, el('div', { klasse: 'pagina' }, el('section', { klasse: 'blok' }, el('h2', { tekst: 'Gebruikers' }), st, lijst)));
    const laad = async () => {
      try {
        const rijen = (await rpc('admin_gebruikers_lijst')) || [];
        vervangInhoud(lijst, tabel([
          { t: 'E-mail', w: r => r.email },
          { t: 'Rol', w: r => r.is_admin ? 'beheerder' : (r.is_beta_tester ? 'beta-tester' : 'gewoon') },
          { t: 'Actief', w: r => moment(r.laatste_activiteit) },
          { t: 'Laatste sync', i: 'laatstesync', w: r => r.laatste_sync ? moment(r.laatste_sync) : (r.sync_toestemming_op ? 'nog niets' : 'deelt niet') },
          { t: 'Quar.', g: 1, w: r => getal(r.in_quarantaine) },
          { t: 'Versie', w: r => r.laatste_versie },
          { t: 'Opslag KB', g: 1, w: r => getal(r.laatste_opslag_kb) },
          { t: 'Bijdragen', g: 1, i: 'bijdragen', w: r => getal(r.contributions) },
          { t: 'Vertrouwen', g: 1, i: 'vertrouwen', w: r => r.trust_score == null ? '–' : Number(r.trust_score).toFixed(2).replace('.', ',') },
          { t: 'Log', i: 'log', w: r => el('button', { tekst: 'Stuur je log', klik: (ev) => actie(ev.target, 'admin_vraag_log', { p_user_id: r.id }, 'Verzoek staat klaar.') }) },
          { t: 'Beta', i: 'beta', w: r => el('button', { tekst: 'Beta-tester', klasse: r.is_beta_tester ? 'aan' : null, 'aria-pressed': String(!!r.is_beta_tester), klik: (ev) => actie(ev.target, 'admin_zet_beta', { p_user_id: r.id, p_aan: !r.is_beta_tester }, 'Beta-status gewijzigd.', laad) }) },
        ], rijen, 'Nog geen gebruikers.'));
      } catch (e) { vervangInhoud(lijst, el('p', { klasse: 'status fout', tekst: foutTekst(e) })); }
    };
    const actie = async (knop, naam, args, goed, daarna) => {
      knop.disabled = true;
      try { await rpc(naam, args); st.className = 'status ok'; st.textContent = goed; if (daarna) await daarna(); }
      catch (e) { st.className = 'status fout'; st.textContent = foutTekst(e); }
      knop.disabled = false;
    };
    laad();
  }

  // ── gebruikersdashboard ─────────────────────────────────────
  function tekenMijn(doel) {
    const lijst = el('div', null, el('p', { klasse: 'stil', tekst: 'Laden…' }));
    const st = el('p', { klasse: 'status' });
    const melding = (t, fout) => { st.className = 'status ' + (fout ? 'fout' : 'ok'); st.textContent = t; };
    const toestemming = el('input', { type: 'checkbox', id: 'diag' });
    toestemming.checked = !!profiel.diag_toestemming_op; toestemming.disabled = offline;
    toestemming.addEventListener('change', async () => {
      const aan = toestemming.checked; toestemming.disabled = true;
      try { await rpc('zet_diag_toestemming', { p_aan: aan }); profiel.diag_toestemming_op = aan ? new Date().toISOString() : null; melding(aan ? 'Toestemming gegeven.' : 'Toestemming ingetrokken.'); }
      catch (e) { toestemming.checked = !aan; melding(foutTekst(e), true); }
      toestemming.disabled = false;
    });
    const download = el('button', { tekst: 'Download mijn data', disabled: offline, klik: async (ev) => {
      ev.target.disabled = true;
      try {
        const data = await rpc('mijn_data_export');
        const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
        const a = el('a', { href: url, download: 'stoplichtiq-mijn-data-' + new Date().toISOString().slice(0, 10) + '.json' }); document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000); melding('Je data is gedownload.');
      } catch (e) { melding(foutTekst(e), true); }
      ev.target.disabled = false;
    } });
    const woord = el('input', { placeholder: 'Typ VERWIJDER', autocomplete: 'off', 'aria-label': 'Typ VERWIJDER om te bevestigen', id: 'woord', stijl: { maxWidth: '200px' } });
    const verwijder = el('button', { tekst: 'Verwijder mijn account', klasse: 'gevaar', disabled: true, klik: async () => {
      verwijder.disabled = true;
      try { await rpc('verwijder_mijn_account'); await db.auth.signOut({ scope: 'local' }); try { localStorage.removeItem(ROL_SLEUTEL); } catch (e) {} profiel = null; toonInlog('Je account en al je gegevens zijn verwijderd.'); }
      catch (e) { melding(foutTekst(e), true); verwijder.disabled = woord.value !== 'VERWIJDER'; }
    } });
    woord.addEventListener('input', () => { verwijder.disabled = offline || woord.value !== 'VERWIJDER'; });
    vervangInhoud(doel, el('div', { klasse: 'pagina' },
      el('section', { klasse: 'blok' }, el('h2', { tekst: 'Mijn kruispunten' }), lijst),
      el('section', { klasse: 'blok' }, el('h2', { tekst: 'Instellingen' }),
        profiel.email ? el('p', { klasse: 'klein stil', tekst: 'Ingelogd als ' + profiel.email }) : null,
        el('div', { klasse: 'rij' }, el('label', { klasse: 'schakel', for: 'diag' }, toestemming, 'Diagnosegegevens delen om de app te verbeteren'), info(UITLEG.diag, 'Diagnosegegevens delen'))),
      el('section', { klasse: 'blok' }, el('h2', { tekst: 'Mijn data' }), el('div', { klasse: 'rij' }, download, info(UITLEG.download, 'Download mijn data')), st),
      el('section', { klasse: 'blok' }, el('h2', { tekst: 'Account verwijderen' }), el('p', { klasse: 'klein stil', tekst: 'Dit verwijdert je account en al je gegevens. Dit kan niet ongedaan worden gemaakt.' }), el('div', { klasse: 'rij' }, woord, verwijder))));
    if (offline) { vervangInhoud(lijst, el('p', { klasse: 'stil', tekst: 'Niet beschikbaar zonder verbinding.' })); return; }
    rpc('mijn_kruispunten').then(rijen => vervangInhoud(lijst, tabel([
      { t: 'Kruispunt', w: r => r.naam || r.node_id }, { t: 'Stad', w: r => r.stad },
      { t: 'Metingen', g: 1, w: r => getal(r.n_metingen) },
      // V11.38.14: geeft de server de drie tellers, dan is de mediaan alleen over volledige metingen (onbekend telt niet als volledig).
      ...((rijen || []).some(r => r.n_volledig !== undefined)
        ? [{ t: 'Volledig', g: 1, w: r => getal(r.n_volledig) }, { t: 'Onvolledig', g: 1, w: r => getal(r.n_onvolledig) }, { t: 'Onbekend', g: 1, w: r => getal(r.n_onbekend) },
           { t: 'Mediaan volledig (s)', g: 1, w: r => r.mediaan_sec == null ? '–' : Math.round(r.mediaan_sec) }]
        : [{ t: 'Mediaan (s)', g: 1, w: r => r.mediaan_sec == null ? '–' : Math.round(r.mediaan_sec) }]),
      { t: 'Laatste', w: r => moment(r.laatste_meting) }], rijen || [], 'Er zijn nog geen kruispunten van jou binnen.')))
      .catch(e => vervangInhoud(lijst, el('p', { klasse: 'status fout', tekst: foutTekst(e) })));
  }

  // ── start ───────────────────────────────────────────────────
  // Bevestigen van een nieuw account met een token_hash-link: pas na een klik.
  function toonBevestig() {
    const st = el('p', { klasse: 'status', role: 'status', 'aria-live': 'polite' });
    const knop = el('button', { type: 'button', klasse: 'hoofdknop', tekst: 'Bevestig mijn e-mailadres', klik: async () => {
      knop.disabled = true; st.className = 'status'; st.textContent = '';
      try {
        const { error } = await db.auth.verifyOtp({ token_hash: bevestigHash, type: 'signup' });
        if (error) return toonInlog(S.linkFoutTekst(error.code || error.message) + ' Log in, of registreer opnieuw.');
      } catch (e) { st.className = 'status fout'; st.textContent = S.authMelding(e); knop.disabled = false; return; }
      linkMelding = { t: 'Je e-mailadres is bevestigd.', ok: true };
      await naInloggen();
      if (profiel) app.insertBefore(el('div', { klasse: 'melding goed', tekst: linkMelding.t }), app.children[1] || null);
    } });
    vervangInhoud(app, el('div', { klasse: 'inlogvak' }, el('div', { klasse: 'inlog' }, S.merk('E-mailadres bevestigen'),
      el('p', { klasse: 'klein stil', tekst: 'Klik op de knop om je e-mailadres te bevestigen.' }), knop, st)), S.voet());
  }

  (async () => {
    if (bevestigHash) { toonBevestig(); return; }
    try {
      const { data } = await db.auth.getSession();
      if (data && data.session) {
        if (leesLink) { S.wisLinkUitAdres(); linkMelding = { t: 'Je e-mailadres is bevestigd.', ok: true }; }
        await naInloggen();
        if (linkMelding && linkMelding.ok && profiel) { const b = el('div', { klasse: 'melding goed', tekst: linkMelding.t }); app.insertBefore(b, app.children[1] || null); }
      } else toonInlog(linkMelding, ['vergeten', 'registreren'].includes(startModus) ? startModus : 'inloggen');
    } catch (e) { toonInlog(foutTekst(e)); }
  })();
  db.auth.onAuthStateChange((ev) => {
    // Vangnet: een herstelsessie mag hier nooit blijven bestaan.
    if (ev === 'PASSWORD_RECOVERY') { db.auth.signOut({ scope: 'local' }).finally(() => location.replace('wachtwoord-instellen.html')); return; }
    if (ev === 'SIGNED_OUT' && profiel) { profiel = null; toonInlog(); }
  });
})();
