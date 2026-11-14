// © 2026 StoplichtIQ
//
// De twee dashboards: beheer (alleen als mijn_profiel().is_admin) en de eigen
// gegevens van elke gebruiker. Volgens het Supabase-contract van 8 nov 2026:
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

  // ── hulpjes ─────────────────────────────────────────────────
  // De uitleg achter de (i)-knopjes. Nagelezen tegen de databasefuncties (14 nov 2026, alleen lezen):
  // verwerk_meting, evalueer_meting, mijn_profiel, diag_dag_opslaan, diag_log_opslaan, admin_vraag_log,
  // admin_zet_beta, mijn_data_export, admin_inflow_daily, admin_city_progress.
  const UITLEG = {
    bijdragen: 'Aantal metingen van deze gebruiker dat meteen bij binnenkomst is geaccepteerd. Een teller, geen percentage. Een meting die eerst in quarantaine stond en later alsnog werd geaccepteerd, telt hier (nog) niet mee.',
    vertrouwen: "Getal van 0 tot 1. Nieuw = 0,50. Het stijgt met 0,01 bij elke meting die meteen wordt geaccepteerd, tot maximaal 1,00. Vanaf 0,70 telt iemand als 'vertrouwd' (een beheerder altijd): dan is voor een nieuw kruispunt maar 1 andere gebruiker nodig om het te bevestigen in plaats van 2. Het daalt nu nooit; slechte metingen blijven gewoon in quarantaine.",
    quarantaine: 'Een meting die afwijkt van wat we al weten (meer dan 15 s of 35% naast de gewone waarde van de laatste 30 dagen), of voor een kruispunt waar nog niets bekend is, wacht tot genoeg andere gebruikers hetzelfde melden: bij een afwijking 2 anderen binnen 7 dagen, bij een nieuw kruispunt 2 anderen (of 1 als er een vertrouwde gebruiker bij is) binnen 30 dagen. Dat gebeurt zodra die laatste meting binnenkomt; daarna is hij automatisch geaccepteerd. Jij hoeft niets goed te keuren.',
    vandaag: 'Metingen die vandaag zijn binnengekomen en nu zijn aangenomen / die nog wachten / aantal gebruikers dat vandaag iets stuurde. "Vandaag" is de dag in UTC (in Nederland begint die om 01:00 of 02:00).',
    log: 'Vraagt deze gebruiker EENMALIG om een logbestand te sturen. Dat kan alleen als hij diagnose-toestemming heeft gegeven. Na versturen is het verzoek verbruikt. Let op: de app zelf leest dit verzoek nog niet; dat komt in een volgende fase.',
    beta: 'Een vertrouwde tester die elke dag automatisch logs mag sturen (hoogstens 1 per soort per dag) zonder dat jij het vraagt. Alleen met diagnose-toestemming. Een gewone gebruiker kan dat niet. Let op: de app stuurt nog niets; dat komt in een volgende fase.',
    diag: 'Als je dit aanzet, mag de app dagelijks technische gegevens sturen: appversie, opslag in KB, opstarttijd, gemiddelde rekentijd, aantal ritten en teltallen. Daarin staan geen locatie en geen naam. Met deze toestemming kan ook een logbestand worden gestuurd als de beheerder erom vraagt of als je beta-tester bent; een logbestand kan wel kruispuntnummers bevatten. Staat standaard uit en je kunt het altijd uitzetten. De app stuurt op dit moment nog niets.',
    download: 'Geeft je een bestand met je profiel, je metingen, je validaties en je dagelijkse diagnosegegevens. Logbestanden die je hebt gestuurd zitten er nog niet in.',
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
    try { const { data } = await db.from('app_config').select('sleutel,waarde'); config = Object.fromEntries((data || []).map(x => [x.sleutel, x.waarde])); } catch (e) { config = {}; }
    tab = profiel.is_admin ? 'kaart' : 'mijn';
    teken();
  }

  // ── de schil ────────────────────────────────────────────────
  function teken() {
    stopKlok(); kaart = null;
    const knop = (id, t) => el('button', { tekst: t, klasse: tab === id ? 'aan' : null, klik: () => { tab = id; teken(); } });
    const kop = el('header', { klasse: 'kop' }, el('h1', { klasse: 'kopmerk' }, S.logo(28), 'Stoplicht', el('span', { tekst: 'IQ' })),
      profiel.is_admin ? el('nav', { klasse: 'tabs' }, knop('kaart', 'Kaart'), knop('gebruikers', 'Gebruikers'), knop('mijn', 'Mijn gegevens')) : null,
      el('span', { klasse: 'ruimte' }), el('button', { tekst: 'Uitloggen', klik: async () => { await db.auth.signOut(); profiel = null; try { localStorage.removeItem(ROL_SLEUTEL); } catch (e) {} toonInlog(); } }));
    const inhoud = el('div', { stijl: { flex: '1', display: 'flex', flexDirection: 'column', minHeight: '0' } });
    vervangInhoud(app, kop,
      offline ? el('div', { klasse: 'melding', tekst: 'Geen verbinding. Je ziet de laatst bekende rol; gegevens kunnen niet worden opgehaald.' }) : null,
      config.bericht ? el('div', { klasse: 'melding', tekst: String(config.bericht) }) : null,
      inhoud, S.voet());
    if (tab === 'kaart') tekenBeheer(inhoud);
    else if (tab === 'gebruikers') tekenGebruikers(inhoud);
    else tekenMijn(inhoud);
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
    const vak = el('div', { klasse: 'kaartvak' }, kaartEl, el('div', { klasse: 'kaartbalk' }, filter(1, '1 u'), filter(24, '24 u'), filter(168, '7 d'), status), legenda, leeg);
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

    const ververs = () => Promise.all([laadKaart(status, leeg), laadZij(zij)]);
    ververs();
    klok = setInterval(() => { if (!document.hidden) ververs(); }, VERVERS_MS);
  }

  async function laadKaart(status, leeg) {
    const mijnKaart = kaart;
    try {
      const rijen = (await rpc('admin_kaart_activiteit', { p_uren: uren })) || [];
      if (kaart !== mijnKaart) return;
      laag.clearLayers();
      const grens = Date.now() - PULS_UUR * 3600000;
      for (const r of rijen) {
        if (typeof r.lat !== 'number' || typeof r.lon !== 'number') continue;
        const n = Number(r.nieuw_in_periode) || 0, s = stap(n), rad = straal(n);
        const tip = el('div', null, el('b', { tekst: r.naam || r.node_id }), r.stad ? el('div', { tekst: r.stad }) : null,
          el('div', { tekst: 'nieuw: ' + getal(n) + ' · quarantaine: ' + getal(r.in_quarantaine) }),
          el('div', { tekst: 'geaccepteerd: ' + getal(r.totaal_geaccepteerd) + ' · bijdragers: ' + getal(r.bijdragers) }),
          el('div', { klasse: 'stil', tekst: 'laatste: ' + moment(r.laatste_meting) }));
        if (n > 0) L.circleMarker([r.lat, r.lon], { radius: rad * 2.3, stroke: false, fillColor: s.kleur, fillOpacity: 0.16, interactive: false }).addTo(laag);
        L.circleMarker([r.lat, r.lon], { radius: rad, stroke: false, fillColor: s.kleur, fillOpacity: 0.95 }).bindTooltip(tip, { direction: 'top' }).addTo(laag);
      }
      rijen.filter(r => Number(r.nieuw_in_periode) > 0 && r.laatste_meting && new Date(r.laatste_meting).getTime() >= grens && typeof r.lat === 'number')
        .sort((a, b) => new Date(b.laatste_meting) - new Date(a.laatste_meting)).slice(0, PULS_MAX)
        .forEach(r => { const d = 2 * straal(Number(r.nieuw_in_periode)); L.marker([r.lat, r.lon], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'puls', iconSize: [d, d] }) }).addTo(laag); });
      leeg.style.display = rijen.length ? 'none' : '';
      status.className = 'status'; status.textContent = getal(rijen.length) + ' kruispunten · ' + new Date().toLocaleTimeString('nl-NL');
    } catch (e) { status.className = 'status fout'; status.textContent = foutTekst(e); }
  }

  async function laadZij(zij) {
    const [inflow, steden, quar, events] = await Promise.all(['admin_inflow_daily', 'admin_city_progress', 'admin_quarantaine_monitor', 'admin_recent_events'].map(n => rpc(n).catch(e => ({ fout: foutTekst(e) }))));
    const sectie = (titel, d, maak, sl) => el('section', null, sl ? el('h2', null, metInfo(titel, sl)) : el('h2', { tekst: titel }), d && d.fout ? el('p', { klasse: 'status fout', tekst: d.fout }) : maak(d || []));
    vervangInhoud(zij,
      sectie('Binnenkomst, 30 dagen', inflow, inflowBlok),
      sectie('Steden', steden, d => tabel([{ t: 'Stad', w: r => r.stad }, { t: 'Totaal', g: 1, w: r => getal(r.nodes_totaal) }, { t: 'Vers 7 d', g: 1, w: r => getal(r.nodes_vers_7d) }, { t: 'Geverif.', g: 1, w: r => getal(r.nodes_geverifieerd) }], d.slice(0, 15), 'Nog geen steden.'), 'steden'),
      sectie('Quarantaine', quar, d => tabel([{ t: 'Kruispunt', w: r => r.node_id }, { t: 'Aantal', g: 1, w: r => getal(r.in_quarantaine) }, { t: 'Dagen oud', g: 1, w: r => getal(r.dagen_oud) }], d.slice(0, 10), 'Niets in quarantaine.'), 'quarantaine'),
      sectie('Recente gebeurtenissen', events, d => tabel([{ t: 'Tijd', w: r => moment(r.created_at) }, { t: 'Soort', w: r => r.soort }, { t: 'Stad', w: r => r.city }, { t: 'Wie', w: r => r.gebruiker_kort }], d.slice(0, 15), 'Nog geen gebeurtenissen.')));
  }

  function inflowBlok(rijen) {
    const d = rijen.slice().sort((a, b) => new Date(a.dag) - new Date(b.dag));
    // 14 nov: de laatste rij is de laatste dag MET metingen, niet per se vandaag. Alleen een rij van vandaag (UTC, zoals de database telt) telt.
    const vandaagUTC = new Date().toISOString().slice(0, 10);
    const nu = d.find(r => String(r.dag).slice(0, 10) === vandaagUTC) || {};
    const tegels = el('div', null, el('div', { klasse: 'tegels' },
      [['Geaccepteerd', nu.geaccepteerd], ['Quarantaine', nu.in_quarantaine], ['Actief', nu.actieve_gebruikers]].map(([t, w]) => el('div', { klasse: 'tegel' }, el('b', { tekst: getal(w || 0) }), el('span', { tekst: t + ' vandaag' })))),
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
      hit.addEventListener('mouseenter', () => { tip.textContent = dag(r.dag) + ': ' + getal(a) + ' geaccepteerd, ' + getal(q) + ' quarantaine, ' + getal(r.actieve_gebruikers) + ' actief'; tip.style.display = ''; tip.style.top = '0'; tip.style.left = Math.min(i * sl, B - 230) + 'px'; });
      hit.addEventListener('mouseleave', () => { tip.style.display = 'none'; });
      svg.append(hit);
    });
    const lab = (x, t, anker) => { const e = sv('text', { x, y: H - 3, 'font-size': 10, fill: css('--stil'), 'text-anchor': anker }); e.textContent = t; svg.append(e); };
    lab(0, dag(d[0].dag), 'start'); lab(B, dag(d[d.length - 1].dag), 'end');
    return el('div', null, tegels, el('div', { klasse: 'legenda-rij', stijl: { marginTop: '10px' } }, el('span', null, el('i', { klasse: 'blokje s1' }), 'Geaccepteerd'), el('span', null, el('i', { klasse: 'blokje s2' }), 'Quarantaine')),
      el('div', { klasse: 'grafiek' }, svg, tip),
      el('details', null, el('summary', { tekst: 'Als tabel' }), tabel([{ t: 'Dag', w: r => dag(r.dag) }, { t: 'Geacc.', g: 1, w: r => getal(r.geaccepteerd) }, { t: 'Quar.', g: 1, w: r => getal(r.in_quarantaine) }, { t: 'Actief', g: 1, w: r => getal(r.actieve_gebruikers) }], d.slice().reverse())));
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
          { t: 'Actief', w: r => moment(r.laatste_activiteit) },
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
      { t: 'Metingen', g: 1, w: r => getal(r.n_metingen) }, { t: 'Mediaan (s)', g: 1, w: r => r.mediaan_sec == null ? '–' : Math.round(r.mediaan_sec) },
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
