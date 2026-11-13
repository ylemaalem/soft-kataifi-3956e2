// © 2026 StoplichtIQ — Y. Lemaalem
//
// Gedeeld door dashboard.html en wachtwoord-instellen.html: de projectgegevens,
// de vaste adressen voor mails, het logo, en de meldingen bij inlogfouten.
// De adressen staan hier vast als volledige https-URL, zodat een herstel- of
// bevestigingsmail nooit naar localhost wijst. Supabase gebruikt zo'n adres
// alleen als het op de lijst "Redirect URLs" staat; anders valt het terug op de
// Site URL. Die lijst stelt Younes zelf in.
(function () {
  'use strict';
  const BASIS = 'https://ylemaalem.github.io/soft-kataifi-3956e2/';
  const URL_ = 'https://yizlnymlwkligabvwplt.supabase.co';
  // De publieke anon-sleutel (geen service_role). Deze sleutel mag in de pagina staan.
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpemxueW1sd2tsaWdhYnZ3cGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDM2MjQsImV4cCI6MjEwNTQ3OTYyNH0.QMbWOVxOqazEGdb40NFqn3ArV0ViA52_b5k9z3-yFao';
  const WW_MIN = 10, WW_MAX = 72;   // 72: daarboven kapt Supabase (bcrypt) het wachtwoord af

  function el(tag, attr, ...kind) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (k === 'tekst') e.textContent = v;
      else if (k === 'klik') e.addEventListener('click', v);
      else if (k === 'klasse') e.className = v;
      else if (k === 'stijl') Object.assign(e.style, v);
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of kind.flat()) if (c != null) e.append(c);
    return e;
  }
  const SVG = 'http://www.w3.org/2000/svg';
  function sv(tag, attr) { const e = document.createElementNS(SVG, tag); for (const [k, v] of Object.entries(attr || {})) e.setAttribute(k, v); return e; }

  // Het logo: een stoplicht met drie lampen, zoals op het startscherm van de app.
  function logo(px) {
    const s = sv('svg', { viewBox: '0 0 24 48', width: String(Math.round(px / 2)), height: String(px), 'aria-hidden': 'true', class: 'logo' });
    s.append(sv('rect', { x: '2', y: '1', width: '20', height: '46', rx: '8', fill: '#1B2638', stroke: '#2C3D57' }));
    [['#EF4444', 10], ['#F59E0B', 24], ['#22C55E', 38]].forEach(([k, y]) => s.append(sv('circle', { cx: '12', cy: String(y), r: '5.2', fill: k })));
    return s;
  }
  function merk(ondertitel) {
    return el('div', { klasse: 'merk' }, logo(44), el('div', null, el('div', { klasse: 'merknaam' }, 'Stoplicht', el('span', { tekst: 'IQ' })), ondertitel ? el('div', { klasse: 'stil klein', tekst: ondertitel }) : null));
  }
  const voet = () => el('footer', { klasse: 'voet', tekst: '© 2026 StoplichtIQ — Y. Lemaalem' });

  function foutTekst(e) { return String((e && e.message) || e || 'onbekende fout').slice(0, 160); }
  // Eén plek voor de meldingen bij inloggen, registreren en wachtwoord instellen.
  function authMelding(e) {
    const code = String((e && e.code) || ''), m = foutTekst(e), st = e && e.status;
    if (st === 429 || /rate.?limit|too.?many/i.test(code + ' ' + m)) return 'Te veel pogingen. Wacht een paar minuten en probeer het dan opnieuw.';
    if (code === 'email_not_confirmed' || /not.?confirmed/i.test(m)) return 'Je e-mailadres is nog niet bevestigd. Klik eerst op de link in de bevestigingsmail.';
    if (code === 'invalid_credentials' || /invalid login/i.test(m)) return 'E-mailadres of wachtwoord klopt niet.';
    if (code === 'same_password' || /different from the old/i.test(m)) return 'Kies een ander wachtwoord dan je huidige.';
    if (code === 'weak_password' || /password should|weak password/i.test(m)) return 'Dit wachtwoord is te zwak. Kies een langer wachtwoord van minstens ' + WW_MIN + ' tekens.';
    if (code === 'signup_disabled' || /signups? not allowed/i.test(m)) return 'Registreren staat op dit moment uit.';
    if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered/i.test(m)) return 'Er bestaat al een account met dit e-mailadres. Log in, of gebruik "Wachtwoord vergeten".';
    if (code === 'email_address_invalid' || /email address .*invalid|invalid email/i.test(m)) return 'Dit e-mailadres wordt niet geaccepteerd.';
    if (code === 'session_not_found' || code === 'session_expired' || /auth session missing|jwt expired/i.test(m)) return 'Deze link is verlopen. Vraag een nieuwe herstelmail aan.';
    if ((typeof navigator !== 'undefined' && !navigator.onLine) || /fetch|network/i.test(m)) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
    return 'Er ging iets mis: ' + m;
  }
  // Controle van een nieuw wachtwoord (registreren en wachtwoord instellen): leeg = goed.
  function wachtwoordFout(a, b) {
    if (a.length < WW_MIN) return 'Je wachtwoord moet minstens ' + WW_MIN + ' tekens hebben.';
    if (a.length > WW_MAX) return 'Je wachtwoord mag hoogstens ' + WW_MAX + ' tekens hebben.';
    if (a !== b) return 'De twee wachtwoorden zijn niet gelijk.';
    return '';
  }
  // Leest de parameters die Supabase achter # of ? aan een link uit een mail plakt.
  // Twee soorten links:
  // - de standaardlink: Supabase controleert het token al bij het openen en zet
  //   #access_token=... in de adresbalk. Een mailscanner (Outlook Safe Links) die de
  //   link vooraf opent, kan hem daarmee al opgebruiken;
  // - de token_hash-link (eigen mailsjabloon): ?token_hash=...&type=...; de pagina
  //   controleert pas bij een klik op de knop (verifyOtp), dus een scanner verbruikt niets.
  function linkInfo() {
    const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
    const g = (k) => h.get(k) || q.get(k);
    const accessToken = !!h.get('access_token'), tokenHash = q.get('token_hash') || h.get('token_hash') || null;
    return { soort: g('type'), accessToken, tokenHash, token: !!(accessToken || tokenHash || q.get('code')), fout: g('error_code') || g('error') };
  }
  function linkFoutTekst(code) {
    return /otp_expired|expired/i.test(code || '') ? 'Deze link is verlopen of al gebruikt.' : 'Deze link werkt niet (meer).';
  }
  // Haalt tokens en foutcodes uit de adresbalk, zodat ze niet in de geschiedenis blijven staan.
  function wisLinkUitAdres() { try { history.replaceState(null, '', location.pathname); } catch (e) {} }

  window.SLIQ = Object.freeze({
    URL_, ANON, WW_MIN, WW_MAX,
    DASH_URL: BASIS + 'dashboard.html', HERSTEL_URL: BASIS + 'wachtwoord-instellen.html',
    el, sv, logo, merk, voet, foutTekst, authMelding, wachtwoordFout, linkInfo, linkFoutTekst, wisLinkUitAdres,
  });
})();
