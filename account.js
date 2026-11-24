// © 2026 StoplichtIQ
//
// V11.38.0: inloggen, account, rollen en synchronisatie voor de rij-app (index.html).
//
// DE REGEL DIE ALLES DRAAGT. Niets in dit bestand mag de camera, de detectie of de
// countdown ophouden. Het wordt als laatste geladen; laadt het niet, of is de server
// onbereikbaar, dan rijdt een ingelogd toestel gewoon door op zijn eigen leergeheugen.
// De poort zelf staat in index.html en hangt niet van dit bestand af.
//
// WAT WAAR STAAT.
//   - het merkteken van de poort (geen token): localStorage 'sliq_poort', en een kopie
//     met tijdstempel in IndexedDB (database StoplichtIQ_Account, store 'staat');
//   - de inlog-tokens van Supabase: alleen in IndexedDB (store 'auth'), nooit in
//     localStorage en dus nooit in een backup, export, log of diagnose;
//   - de wachtrij van de synchronisatie: IndexedDB (stores 'wachtrij' en 'klaar'),
//     los van de leerdata.
//
// WAT ER VERSTUURD WORDT, en alleen na toestemming: kruispunt-ID, dagdeel, duur, het
// tijdstip van de meting, de appversie, wat de app toonde, en of de hele rode fase is
// gezien. Geen GPS-posities van de gebruiker, geen camerabeelden.
(function () {
  'use strict';
  const URL_ = 'https://yizlnymlwkligabvwplt.supabase.co';
  // De publieke anon-sleutel (geen service_role). Deze sleutel mag in de pagina staan.
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpemxueW1sd2tsaWdhYnZ3cGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDM2MjQsImV4cCI6MjEwNTQ3OTYyNH0.QMbWOVxOqazEGdb40NFqn3ArV0ViA52_b5k9z3-yFao';
  const BASIS = 'https://ylemaalem.github.io/soft-kataifi-3956e2/';
  const LIB = 'vendor/supabase-js-2.45.4.js';
  const LIB_SRI = 'sha384-0w2KAL2YHP6wKOkUDzkCDGgVvfmHnj02DHeQ6XcHOgTfFsGyonKOpShMH1x6nk9o';
  const SESSIE_SLEUTEL = 'sliq_app_sessie';   // eigen sleutel: het dashboard gebruikt 'dash_sessie'
  const ADB = 'StoplichtIQ_Account';
  const WW_MIN = 10, WW_MAX = 72;
  const BATCH = 100, RPC_MAX_MS = 20000;
  // V11.38.1: nieuwste eerst, doorsturen met korte pauze, en wachttijden die geen enkele trigger meer overslaat.
  const NIEUW_MS = 48 * 3600000, PAUZE_MS = 300, MAX_PER_MIN = 20;
  const LIMIET_WACHT = 30 * 60000, TOESTEMMING_WACHT = 3600000, KAART_WACHT = 6 * 3600000, KAART_MAX = 5;
  const DAGDELEN = ['ochtend', 'dag', 'avond', 'nacht'];
  // Records van voor deze datum in het dagdeel 'dag' tussen 16 en 20 uur horen bij een oude fout
  // in de dagdeel-indeling (verholpen in de versie van 10 mei 2026) en gaan niet mee.
  const OUDE_DAG_GRENS = Date.UTC(2026, 4, 10);
  const P = window.SLIQ_POORT;
  if (!P) return;

  // ── kleine hulpjes ────────────────────────────────────────────
  function el(tag, attr, ...kind) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attr || {})) {
      if (k === 'tekst') e.textContent = v;
      else if (k === 'klik') e.addEventListener('click', v);
      else if (k === 'klasse') e.className = v;
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of kind.flat()) if (c != null) e.append(c);
    return e;
  }
  const versie = () => { try { return appVersieKort(); } catch (e) { return ''; } };
  const online = () => (typeof navigator === 'undefined' || navigator.onLine !== false);
  function foutTekst(e) { return String((e && e.message) || e || 'onbekende fout').slice(0, 160); }
  function authMelding(e) {
    const code = String((e && e.code) || ''), m = foutTekst(e), st = e && e.status;
    if (st === 429 || /rate.?limit|too.?many/i.test(code + ' ' + m)) return 'Te veel pogingen. Wacht een paar minuten en probeer het dan opnieuw.';
    if (code === 'email_not_confirmed' || /not.?confirmed/i.test(m)) return 'Je e-mailadres is nog niet bevestigd. Klik eerst op de link in de bevestigingsmail.';
    if (code === 'invalid_credentials' || /invalid login/i.test(m)) return 'E-mailadres of wachtwoord klopt niet.';
    if (code === 'same_password' || /different from the old/i.test(m)) return 'Kies een ander wachtwoord dan je huidige.';
    if (code === 'weak_password' || /password should|weak password/i.test(m)) return 'Dit wachtwoord is te zwak. Kies een langer wachtwoord van minstens ' + WW_MIN + ' tekens.';
    if (code === 'signup_disabled' || /signups? (not allowed|disabled)/i.test(m)) return 'Registratie is op dit moment alleen op uitnodiging.';
    if (code === 'user_already_exists' || code === 'email_exists' || /already (been )?registered/i.test(m)) return 'Er bestaat al een account met dit e-mailadres. Log in, of gebruik "Wachtwoord vergeten".';
    if (!online() || /fetch|network|laden mislukt|tijd/i.test(m)) return 'Geen verbinding. Controleer je internet en probeer het opnieuw.';
    return 'Er ging iets mis: ' + m;
  }
  function wachtwoordFout(a, b) {
    if (a.length < WW_MIN) return 'Je wachtwoord moet minstens ' + WW_MIN + ' tekens hebben.';
    if (a.length > WW_MAX) return 'Je wachtwoord mag hoogstens ' + WW_MAX + ' tekens hebben.';
    if (a !== b) return 'De twee wachtwoorden zijn niet gelijk.';
    return '';
  }
  // Een vaste verwijzing per meting: dezelfde meting geeft altijd dezelfde uuid, zodat hij nooit dubbel telt.
  function refVan(tekst) {
    let hex = '';
    for (let zaad = 1; zaad <= 4; zaad++) {
      let h1 = 0xdeadbeef ^ zaad, h2 = 0x41c6ce57 ^ (zaad * 7919);
      for (let i = 0; i < tekst.length; i++) { const c = tekst.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      hex += (h1 >>> 0).toString(16).padStart(8, '0');
    }
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-4' + hex.slice(13, 16) + '-8' + hex.slice(17, 20) + '-' + hex.slice(20, 32);
  }

  // ── de eigen database (IndexedDB), met een terugval in het geheugen ─────────
  let adb = null, adbBelofte = null;
  const geheugen = { auth: new Map(), staat: new Map(), wachtrij: new Map(), klaar: new Map() };
  function dbOpen() {
    if (adbBelofte) return adbBelofte;
    adbBelofte = new Promise((klaar) => {
      let v;
      try { v = indexedDB.open(ADB, 1); } catch (e) { klaar(null); return; }
      v.onupgradeneeded = (e) => {
        const d = e.target.result;
        for (const s of ['auth', 'staat', 'klaar']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
        if (!d.objectStoreNames.contains('wachtrij')) d.createObjectStore('wachtrij', { keyPath: 'ref' });
      };
      v.onsuccess = (e) => { adb = e.target.result; klaar(adb); };
      v.onerror = () => klaar(null); v.onblocked = () => klaar(null);
    });
    return adbBelofte;
  }
  async function db(store, modus, fn) {
    const d = await dbOpen();
    if (!d) return fn(null, geheugen[store]);
    return new Promise((klaar, mis) => {
      let uit;
      try {
        const tx = d.transaction(store, modus), st = tx.objectStore(store);
        const r = fn(st, null);
        if (r && typeof r === 'object' && 'onsuccess' in r) r.onsuccess = () => { uit = r.result; }; else uit = r;
        tx.oncomplete = () => klaar(uit); tx.onerror = () => mis(tx.error); tx.onabort = () => mis(tx.error || new Error('afgebroken'));
      } catch (e) { mis(e); }
    });
  }
  const kvLees = (store, k) => db(store, 'readonly', (st, m) => st ? st.get(k) : m.get(k)).catch(() => undefined);
  const kvZet = (store, k, v) => db(store, 'readwrite', (st, m) => { if (st) st.put(v, k); else m.set(k, v); }).catch(() => {});
  const kvWeg = (store, k) => db(store, 'readwrite', (st, m) => { if (st) st.delete(k); else m.delete(k); }).catch(() => {});
  const wachtrijAlles = () => db('wachtrij', 'readonly', (st, m) => st ? st.getAll() : [...m.values()]).then(x => x || []).catch(() => []);
  const wachtrijZet = (items) => db('wachtrij', 'readwrite', (st, m) => { for (const it of items) { if (st) st.put(it); else m.set(it.ref, it); } }).catch(() => {});
  const wachtrijWeg = (refs) => db('wachtrij', 'readwrite', (st, m) => { for (const r of refs) { if (st) st.delete(r); else m.delete(r); } }).catch(() => {});
  const klaarZet = (refs) => db('klaar', 'readwrite', (st, m) => { for (const r of refs) { if (st) st.put(1, r); else m.set(r, 1); } }).catch(() => {});
  const klaarSleutels = () => db('klaar', 'readonly', (st, m) => st ? st.getAllKeys() : [...m.keys()]).then(x => new Set(x || [])).catch(() => new Set());
  const klaarAantal = () => db('klaar', 'readonly', (st, m) => st ? st.count() : m.size).catch(() => 0);

  // ── de Supabase-client (pas laden als hij nodig is) ───────────
  let libBelofte = null, klant = null;
  function laadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (libBelofte) return libBelofte;
    libBelofte = new Promise((ok, mis) => {
      const s = document.createElement('script');
      s.src = LIB; s.integrity = LIB_SRI; s.crossOrigin = 'anonymous';
      const t = setTimeout(() => { libBelofte = null; mis(new Error('laden mislukt (tijd)')); }, 15000);
      s.onload = () => { clearTimeout(t); (window.supabase && window.supabase.createClient) ? ok() : mis(new Error('laden mislukt')); };
      s.onerror = () => { clearTimeout(t); libBelofte = null; mis(new Error('laden mislukt')); };
      document.head.appendChild(s);
    });
    return libBelofte;
  }
  const tokenOpslag = {
    getItem: async (k) => { const v = await kvLees('auth', k); return v == null ? null : v; },
    setItem: (k, v) => kvZet('auth', k, v),
    removeItem: (k) => kvWeg('auth', k),
  };
  async function client() {
    if (klant) return klant;
    await laadLib();
    klant = window.supabase.createClient(URL_, ANON, { auth: { persistSession: true, autoRefreshToken: true, storageKey: SESSIE_SLEUTEL, storage: tokenOpslag, detectSessionInUrl: false } });
    return klant;
  }
  async function rpc(naam, args, maxMs) {
    const c = await client();
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), maxMs || RPC_MAX_MS);
    try {
      const { data, error } = await c.rpc(naam, args || {}).abortSignal(ac.signal);
      if (error) throw error;
      return data;
    } finally { clearTimeout(t); }
  }

  // ── toestand ──────────────────────────────────────────────────
  let profiel = null, sessieOk = false, configSyncAan = null, mail = null;
  function zetMerk(p) {
    const oud = P.staat() || {};
    const m = { v: 1, uid: String(p.id || oud.uid), ok: Date.now(), rol: { a: p.is_admin === true, b: p.is_beta_tester === true }, rolTs: Date.now(),
                sync: !!p.sync_toestemming_op, diag: !!p.diag_toestemming_op };
    P.zet(m); P.zetSessie(m.uid);
    kvZet('staat', 'poort', m);   // D1: de rol met tijdstempel ook in IndexedDB
    if (p.email) { mail = p.email; kvZet('staat', 'mail', p.email); }
  }
  async function ververs() {
    const data = await rpc('mijn_profiel');
    const p = Array.isArray(data) ? data[0] : data;
    if (!p || !p.id) throw new Error('geen profiel');
    profiel = p; sessieOk = true; zetMerk(p);
    try {
      const c = await client();
      const { data: cfg, error } = await c.from('app_config').select('sleutel,waarde');
      if (!error && cfg) { const o = Object.fromEntries(cfg.map(x => [x.sleutel, x.waarde])); configSyncAan = o.sync_aan !== false; }
    } catch (e) {}
    return p;
  }
  // Loopt op de achtergrond na het openen. Elke fout is stil: een ingelogd toestel blijft rijden (C7).
  async function achtergrond() {
    try {
      if (!online()) return;
      const c = await client();
      const { data } = await c.auth.getSession();
      if (!data || !data.session) { sessieOk = false; return; }
      await ververs();
      Sync.start();
    } catch (e) { /* stil */ }
  }

  // ── opmaak ────────────────────────────────────────────────────
  const CSS = `
  #sliq-poort,#sliq-account{position:fixed;inset:0;z-index:100000;background:#0B1220;color:#E8EEF7;overflow-y:auto;-webkit-overflow-scrolling:touch;font-family:'Rajdhani',system-ui,sans-serif}
  #sliq-account{display:none}#sliq-account.open{display:block}
  .sq-vak{max-width:460px;margin:0 auto;padding:28px 18px 40px}
  .sq-merk{font-size:30px;font-weight:700;letter-spacing:.04em;margin-bottom:4px}.sq-merk span{color:#34C759}
  .sq-stil{color:#8FA0B8;font-size:14px;line-height:1.45}
  .sq-kaart{background:#121C2E;border:1px solid #22314A;border-radius:14px;padding:16px;margin-top:14px}
  .sq-kaart h2{font-size:17px;margin:0 0 8px;letter-spacing:.04em}
  .sq-kaart p,.sq-kaart li{font-size:14px;line-height:1.5;color:#C9D4E5;margin:6px 0}
  .sq-kaart ul{padding-left:18px;margin:6px 0}
  .sq-veld{display:block;margin-top:10px;font-size:13px;color:#8FA0B8}
  .sq-veld input,.sq-veld textarea,.sq-veld select{display:block;width:100%;margin-top:4px;padding:11px 12px;border-radius:10px;border:1px solid #2C3D57;background:#0B1220;color:#fff;font-size:16px;font-family:inherit}
  .sq-knop{display:inline-block;margin-top:12px;padding:11px 16px;border-radius:10px;border:1px solid #2C3D57;background:#1B2638;color:#fff;font-size:15px;font-family:inherit;cursor:pointer;min-height:44px}
  .sq-knop.hoofd{background:#34C759;border-color:#34C759;color:#04210E;font-weight:700;width:100%}
  .sq-knop.gevaar{border-color:#7A2B2B;color:#FF8A8A}
  .sq-knop[disabled]{opacity:.5}
  .sq-rij{display:flex;gap:8px;flex-wrap:wrap}
  .sq-link{background:none;border:0;color:#7FB4FF;font-size:14px;font-family:inherit;padding:10px 4px;cursor:pointer;text-decoration:underline}
  .sq-status{margin-top:10px;font-size:14px;min-height:20px}.sq-status.fout{color:#FF8A8A}.sq-status.ok{color:#7BE39A}
  .sq-badge{display:inline-block;padding:2px 9px;border-radius:99px;font-size:12px;letter-spacing:.08em;border:1px solid #2C3D57;margin-left:8px;vertical-align:middle}
  .sq-badge.beta{border-color:#BF5AF2;color:#D9A6F7}.sq-badge.beheer{border-color:#34C759;color:#7BE39A}
  .sq-kop{display:flex;justify-content:space-between;align-items:center}
  .sq-voet{margin-top:26px;text-align:center;color:#5C6C84;font-size:12px}
  .sq-pre{max-height:140px;overflow:auto;background:#0B1220;border:1px solid #22314A;border-radius:8px;padding:8px;font-family:monospace;font-size:11px;white-space:pre-wrap;word-break:break-all;color:#9FB0C8}`;
  function stijl() { if (!document.getElementById('sliq-stijl')) document.head.appendChild(el('style', { id: 'sliq-stijl', tekst: CSS })); }
  const voet = () => el('div', { klasse: 'sq-voet', tekst: '© 2026 StoplichtIQ' });
  const merk = (onder) => el('div', null, el('div', { klasse: 'sq-merk' }, 'Stoplicht', el('span', { tekst: 'IQ' })), onder ? el('div', { klasse: 'sq-stil', tekst: onder }) : null);
  function veld(label, attr) { const i = el(attr.rijen ? 'textarea' : 'input', attr); return [el('label', { klasse: 'sq-veld' }, label, i), i]; }
  function status() { const s = el('div', { klasse: 'sq-status', role: 'status' }); return [s, (t, soort) => { s.className = 'sq-status' + (soort ? ' ' + soort : ''); s.textContent = t || ''; }]; }
  async function bezig(knop, fn) { knop.disabled = true; try { await fn(); } finally { knop.disabled = false; } }

  // ── het inlogscherm (alleen als de poort dicht is) ────────────
  function toonPoort(scherm, melding) {
    stijl();
    let p = document.getElementById('sliq-poort');
    if (!p) { p = el('div', { id: 'sliq-poort' }); document.body.appendChild(p); }
    const vak = el('div', { klasse: 'sq-vak' });
    p.replaceChildren(vak);
    const [st, zeg] = status();
    const [lMail, iMail] = veld('E-mailadres', { type: 'email', autocomplete: 'username', inputmode: 'email' });
    vak.append(merk('Log in om de app te gebruiken.'));
    if (P.verlopen()) vak.append(el('div', { klasse: 'sq-kaart', id: 'sliq-verlopen' }, el('p', { tekst: 'Je bent langer dan ' + P.MAX_DAGEN + ' dagen niet online geweest met deze app. Maak verbinding met internet en log opnieuw in. Je leerdata staat nog op dit toestel.' })));
    const kaart = el('div', { klasse: 'sq-kaart' });
    vak.append(kaart);
    if (scherm === 'vergeten') {
      const knop = el('button', { klasse: 'sq-knop hoofd', type: 'button', tekst: 'Stuur herstelmail' });
      knop.addEventListener('click', () => bezig(knop, async () => {
        zeg('Bezig…');
        try {
          const c = await client();
          const { error } = await c.auth.resetPasswordForEmail(iMail.value.trim(), { redirectTo: BASIS + 'wachtwoord-instellen.html' });
          if (error) throw error;
          zeg('Als dit adres bij ons bekend is, staat er zo een mail in je inbox. Kijk ook bij ongewenste mail.', 'ok');
        } catch (e) { zeg(authMelding(e), 'fout'); }
      }));
      kaart.append(el('h2', { tekst: 'Wachtwoord vergeten' }), lMail, knop, st, el('button', { klasse: 'sq-link', type: 'button', tekst: '← Terug naar inloggen', klik: () => toonPoort('inlog') }));
    } else if (scherm === 'registreer') {
      const [lW1, iW1] = veld('Wachtwoord (minstens ' + WW_MIN + ' tekens)', { type: 'password', autocomplete: 'new-password' });
      const [lW2, iW2] = veld('Herhaal wachtwoord', { type: 'password', autocomplete: 'new-password' });
      const knop = el('button', { klasse: 'sq-knop hoofd', type: 'button', id: 'sliq-registreer', tekst: 'Account aanmaken' });
      knop.addEventListener('click', () => bezig(knop, async () => {
        const f = wachtwoordFout(iW1.value, iW2.value); if (f) { zeg(f, 'fout'); return; }
        zeg('Bezig…');
        try {
          const c = await client();
          const { data, error } = await c.auth.signUp({ email: iMail.value.trim(), password: iW1.value, options: { emailRedirectTo: BASIS + 'index.html' } });
          if (error) throw error;
          if (data && data.session) { await naInlog(data.session); return; }
          zeg('Gelukt. Klik op de link in de bevestigingsmail en log daarna hier in.', 'ok');
        } catch (e) { zeg(authMelding(e), 'fout'); }
      }));
      kaart.append(el('h2', { tekst: 'Registreren' }), lMail, lW1, lW2, knop, st, el('button', { klasse: 'sq-link', type: 'button', tekst: '← Terug naar inloggen', klik: () => toonPoort('inlog') }));
    } else {
      const [lWw, iWw] = veld('Wachtwoord', { type: 'password', autocomplete: 'current-password' });
      const knop = el('button', { klasse: 'sq-knop hoofd', type: 'button', id: 'sliq-inlog', tekst: 'Inloggen' });
      const doe = () => bezig(knop, async () => {
        zeg('Bezig…');
        try {
          const c = await client();
          const { data, error } = await c.auth.signInWithPassword({ email: iMail.value.trim(), password: iWw.value });
          if (error) throw error;
          await naInlog(data.session);
        } catch (e) { zeg(authMelding(e), 'fout'); }
      });
      knop.addEventListener('click', doe);
      iWw.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doe(); });
      kaart.append(el('h2', { tekst: 'Inloggen' }), lMail, lWw, knop, st,
        el('div', { klasse: 'sq-rij' },
          el('button', { klasse: 'sq-link', type: 'button', tekst: 'Wachtwoord vergeten', klik: () => toonPoort('vergeten') }),
          el('button', { klasse: 'sq-link', type: 'button', id: 'sliq-naar-registreer', tekst: 'Registreren', klik: () => toonPoort('registreer') })));
      if (melding) zeg(melding, 'ok');
    }
    vak.append(el('p', { klasse: 'sq-stil', tekst: 'De eerste keer inloggen heeft internet nodig. Daarna start de app ook zonder bereik.' }), voet());
  }
  async function naInlog(sessie) {
    sessieOk = true;
    try { await ververs(); }
    catch (e) {   // profiel niet op te halen: toch open, als gewone gebruiker; de rol volgt bij de volgende verbinding
      const u = sessie && sessie.user; if (!u || !u.id) throw e;
      zetMerk({ id: u.id, email: u.email, is_admin: false, is_beta_tester: false });
    }
    const p = document.getElementById('sliq-poort'); if (p) p.replaceChildren();
    try { naarStartscherm(); } catch (e) {}
    Sync.start();
    if (!(P.staat() || {}).sync && !(await kvLees('staat', 'toestemming_gevraagd'))) { kvZet('staat', 'toestemming_gevraagd', Date.now()); open('toestemming'); }
  }

  // ── het accountscherm ─────────────────────────────────────────
  function sluit() { const a = document.getElementById('sliq-account'); if (a) { a.classList.remove('open'); a.replaceChildren(); } }
  function kaartKop(titel) { return el('h2', { tekst: titel }); }
  function toestemmingTekst() {
    return [
      el('p', { tekst: 'Wil je je metingen delen? Dan worden de voorspellingen voor iedereen beter. De app werkt ook zonder: dan blijft alles op dit toestel en wordt er niets verstuurd.' }),
      el('p', null, el('strong', { tekst: 'Wat wordt verstuurd, per meting:' })),
      el('ul', null, ...['het nummer van het kruispunt (uit de openbare kaart)', 'het dagdeel (ochtend, dag, avond of nacht)', 'hoe lang het licht rood was', 'het tijdstip van de meting', 'de versie van de app', 'het aantal seconden dat de app toonde, en of de hele rode fase is gezien'].map(t => el('li', { tekst: t }))),
      el('p', null, el('strong', { tekst: 'Wat niet wordt verstuurd:' })),
      el('ul', null, ...['geen GPS-sporen en geen locatiegeschiedenis', 'geen camerabeelden', 'geen positie van jou of je telefoon; van een nieuw kruispunt gaat alleen de plek van het stoplicht zelf mee'].map(t => el('li', { tekst: t }))),
      el('p', null, el('strong', { tekst: 'Let op: ' }), 'uit een kruispunt plus een tijdstip is af te leiden waar en wanneer je hebt gereden.'),
      el('p', { tekst: 'Wie kan dit zien: alleen de beheerder van StoplichtIQ. Andere gebruikers zien jouw metingen niet.' }),
      el('p', { tekst: 'Hoe lang: je metingen blijven bewaard tot je je account verwijdert. Trek je de toestemming in, dan stopt het versturen direct; wat al verstuurd is blijft staan tot je je account verwijdert (hieronder, bij Account). Dan worden al je metingen en gegevens bij ons gewist.' }),
    ];
  }
  function open(deel) {
    if (!P.open()) return;
    stijl();
    let a = document.getElementById('sliq-account');
    if (!a) { a = el('div', { id: 'sliq-account' }); document.body.appendChild(a); }
    const vak = el('div', { klasse: 'sq-vak' });
    a.replaceChildren(vak); a.classList.add('open'); a.scrollTop = 0;
    const rol = P.rol();
    vak.append(el('div', { klasse: 'sq-kop' },
      el('div', { klasse: 'sq-merk' }, 'Stoplicht', el('span', { tekst: 'IQ' }),
        rol === 'beheerder' ? el('span', { klasse: 'sq-badge beheer', tekst: 'BEHEERDER' }) : (rol === 'beta' ? el('span', { klasse: 'sq-badge beta', id: 'sliq-beta-badge', tekst: 'BETA' }) : null)),
      el('button', { klasse: 'sq-knop', type: 'button', tekst: '✕ Sluiten', klik: sluit })));
    if (deel === 'toestemming') { vak.append(blokToestemming(true), voet()); return; }

    // Mijn voortgang
    const kVg = el('div', { klasse: 'sq-kaart', id: 'sliq-voortgang' }, kaartKop('Mijn voortgang'));
    const pVg = el('p', { tekst: 'Bezig met tellen…' }); kVg.append(pVg);
    vak.append(kVg);
    voortgang().then(v => { pVg.textContent = v.n + ' kruispunten geleerd, gemiddeld ' + v.pct + '% geleerd.'; }).catch(() => { pVg.textContent = 'Nog geen kruispunten geleerd.'; });

    // Account
    const kAc = el('div', { klasse: 'sq-kaart' }, kaartKop('Account'));
    const pMail = el('p', { tekst: 'Ingelogd' + (mail ? ' als ' + mail : '') + '.' });
    if (!mail) kvLees('staat', 'mail').then(x => { if (x) { mail = x; pMail.textContent = 'Ingelogd als ' + x + '.'; } });
    const [stAc, zegAc] = status();
    const [lN1, iN1] = veld('Nieuw wachtwoord', { type: 'password', autocomplete: 'new-password' });
    const [lN2, iN2] = veld('Herhaal nieuw wachtwoord', { type: 'password', autocomplete: 'new-password' });
    const kWw = el('button', { klasse: 'sq-knop', type: 'button', tekst: 'Wachtwoord wijzigen' });
    kWw.addEventListener('click', () => bezig(kWw, async () => {
      const f = wachtwoordFout(iN1.value, iN2.value); if (f) { zegAc(f, 'fout'); return; }
      try { const c = await client(); const { error } = await c.auth.updateUser({ password: iN1.value }); if (error) throw error; iN1.value = iN2.value = ''; zegAc('Je wachtwoord is gewijzigd.', 'ok'); }
      catch (e) { zegAc(authMelding(e), 'fout'); }
    }));
    const kUit = el('button', { klasse: 'sq-knop', type: 'button', id: 'sliq-uitloggen', tekst: 'Uitloggen', klik: () => uitloggen() });
    const kWeg = el('button', { klasse: 'sq-knop gevaar', type: 'button', tekst: 'Account verwijderen' });
    kWeg.addEventListener('click', () => bezig(kWeg, async () => {
      if (!window.confirm('Je account en al je gegevens bij StoplichtIQ worden gewist: metingen, diagnose, feedback en toestemmingen. Dit kan niet ongedaan worden gemaakt. De leerdata op dit toestel blijft staan. Doorgaan?')) return;
      try { await rpc('verwijder_mijn_account'); await uitloggen('Je account en al je gegevens bij StoplichtIQ zijn verwijderd.', true); }
      catch (e) { zegAc(/Beheerdersaccount/.test(foutTekst(e)) ? 'Een beheerdersaccount kan niet via de app verwijderd worden.' : authMelding(e), 'fout'); }
    }));
    kAc.append(pMail, lN1, lN2, kWw, stAc, el('div', { klasse: 'sq-rij' }, kUit, kWeg));
    if (rol === 'beheerder') kAc.append(el('p', { klasse: 'alleen-beheerder' }, el('a', { href: 'dashboard.html', id: 'sliq-dashlink', style: 'color:#7FB4FF', tekst: 'Naar het beheer-dashboard →' })));
    vak.append(kAc);

    vak.append(blokToestemming(false));

    // Mijn gegevens en backup
    const kGg = el('div', { klasse: 'sq-kaart' }, kaartKop('Mijn gegevens'));
    const [stGg, zegGg] = status();
    const kDl = el('button', { klasse: 'sq-knop', type: 'button', tekst: 'Download wat StoplichtIQ van mij bewaart' });
    kDl.addEventListener('click', () => bezig(kDl, async () => {
      try { const d = await rpc('mijn_data_export'); bewaarBestand('stoplichtiq-mijn-gegevens.json', JSON.stringify(d, null, 1)); zegGg('Het bestand is gedownload.', 'ok'); }
      catch (e) { zegGg(authMelding(e), 'fout'); }
    }));
    const kBk = el('button', { klasse: 'sq-knop', type: 'button', tekst: 'Backup van de leerdata op dit toestel', klik: () => { try { exporteerData(); } catch (e) { zegGg('De backup is niet gelukt.', 'fout'); } } });
    kGg.append(el('p', { tekst: 'De leerdata staat op dit toestel. Een backup is een bestand dat je zelf bewaart.' }), el('div', { klasse: 'sq-rij' }, kDl, kBk), stGg);
    vak.append(kGg);

    // Feedback (iedereen)
    const kFb = el('div', { klasse: 'sq-kaart', id: 'sliq-feedback' }, kaartKop('Feedback'));
    const [lFb, iFb] = veld('Wat kan beter? (hoogstens 1000 tekens)', { rijen: true, rows: '4', maxlength: '1000' });
    const [stFb, zegFb] = status();
    const kFbV = el('button', { klasse: 'sq-knop', type: 'button', id: 'sliq-feedback-knop', tekst: 'Verstuur feedback' });
    kFbV.addEventListener('click', () => bezig(kFbV, async () => {
      const t = iFb.value.trim(); if (!t) { zegFb('Typ eerst je feedback.', 'fout'); return; }
      try {
        const r = await rpc('feedback_versturen', { p_tekst: t, p_app_versie: versie() });
        if (r && r.opgeslagen) { iFb.value = ''; zegFb('Bedankt, je feedback is verstuurd.', 'ok'); }
        else zegFb('Je hebt vandaag al 5 keer feedback gestuurd. Probeer het morgen weer.', 'fout');
      } catch (e) { zegFb(authMelding(e), 'fout'); }
    }));
    kFb.append(lFb, kFbV, stFb);
    vak.append(kFb);

    // Diagnose en "Stuur je log" (alleen beta-testers en de beheerder)
    if (P.isBeta()) vak.append(blokDiagnose());
    vak.append(voet());
    if (deel === 'voortgang') kVg.scrollIntoView();
  }
  function blokToestemming(eersteKeer) {
    const k = el('div', { klasse: 'sq-kaart', id: 'sliq-sync' }, kaartKop('Metingen delen (synchronisatie)'));
    const m = P.staat() || {}, [st, zeg] = status();
    const pSt = el('p', { id: 'sliq-syncstatus' });
    const zet = (aan) => async () => {
      try {
        await rpc('zet_sync_toestemming', { p_aan: aan }); await ververs();
        if (aan) Sync.historie();
        if (eersteKeer) { sluit(); return; }
        open();
      } catch (e) { zeg(authMelding(e), 'fout'); }
    };
    k.append(...toestemmingTekst());
    if (m.sync) {
      k.append(el('p', null, el('strong', { tekst: 'Je deelt je metingen.' })), pSt, el('button', { klasse: 'sq-knop', type: 'button', tekst: 'Toestemming intrekken', klik: zet(false) }));
      Sync.status().then(s => toonSyncStatus(pSt, s));
    } else {
      k.append(el('p', null, el('strong', { tekst: 'Je deelt nu niets. Alles blijft op dit toestel.' })),
        el('div', { klasse: 'sq-rij' }, el('button', { klasse: 'sq-knop hoofd', type: 'button', id: 'sliq-sync-ja', tekst: 'Ja, deel mijn metingen', klik: zet(true) }),
          eersteKeer ? el('button', { klasse: 'sq-knop', type: 'button', tekst: 'Nee, alleen op dit toestel', klik: sluit }) : null));
    }
    k.append(st);
    return k;
  }
  function tijdKort(t) { return new Date(t).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function toonSyncStatus(pSt, s) {
    const regel = (id, tekst) => el('div', { id, tekst });
    const t = s.tel || {}, red = Object.entries(s.redenen || {}).map(([r, n]) => n + '× ' + r).join(', ');
    const uit = [
      regel('sliq-sync-te', 'Nog te versturen: ' + s.teVersturen + (s.kaart ? ' (waarvan ' + s.kaart + ' wachten tot de kaart het kruispunt kent)' : '')
                            + (s.onvolledig ? ' (waarvan ' + s.onvolledig + ' onvolledig: begin van rood niet gezien)' : '')),
      regel('sliq-sync-klaar', 'Verstuurd: ' + s.klaar + (t.dubbel ? ' (waarvan ' + t.dubbel + ' al op de server stonden)' : '')),
      regel('sliq-sync-af', 'Afgewezen: ' + s.afgewezen + (red ? ' (' + red + ')' : '')),
      regel('sliq-sync-laatst', 'Laatste geslaagde pakket: ' + (s.laatst ? tijdKort(s.laatst) : 'nog geen')),
    ];
    if (s.inhaal) uit.push(regel('sliq-sync-inhaal', 'Inhaalslag (V11.38.11): ' + s.inhaal.n + (s.inhaal.n === 1 ? ' meting' : ' metingen') + ' alsnog in de wachtrij gezet, ' + tijdKort(s.inhaal.t) + '.'));
    if (s.overgeslagen) uit.push(regel('sliq-sync-uit', 'Niet verstuurd: ' + s.overgeslagen + ' metingen; ze blijven op dit toestel.'));
    if (s.wachtReden === 'daglimiet') uit.push(regel('sliq-sync-wacht', 'De server neemt tijdelijk geen nieuwe metingen aan (daglimiet). Volgende poging om ' + tijdKort(s.wachtTot) + '.'));
    else if (s.wachtReden === 'geen_toestemming') uit.push(regel('sliq-sync-wacht', 'De server kent je toestemming nog niet. Volgende poging om ' + tijdKort(s.wachtTot) + '.'));
    else if (s.wachtReden === 'netwerk') uit.push(regel('sliq-sync-wacht', 'Laatste poging mislukt (' + s.fout + '). Volgende poging om ' + tijdKort(s.wachtTot) + '.'));
    if (configSyncAan === false) uit.push(regel('sliq-sync-beheer', 'Synchronisatie is tijdelijk uitgezet door de beheerder.'));
    if (!sessieOk) uit.push(regel('sliq-sync-inlog', 'Log opnieuw in om te synchroniseren.'));
    pSt.replaceChildren(...uit);
  }
  const LOGS = { opslaglog: 'sl_opslaglog', conflog: 'sl_conflog', zichtlog: 'sl_zichtlog', detlog: 'sl_detlog', herzieninglog: 'sl_herzieninglog', schaduwlog: 'sl_schaduwlog' };
  // Haalt alles weg wat een positie kan zijn, voordat een log het toestel verlaat.
  function zonderPositie(x) {
    if (Array.isArray(x)) return x.map(zonderPositie);
    if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) { if (/^(lat|lon|lng|latitude|longitude|pos|positie|coords?|gps)$/i.test(k)) continue; o[k] = zonderPositie(v); } return o; }
    return x;
  }
  function logInhoud(soort) { let d = null; try { d = opslagLees(LOGS[soort], null); } catch (e) {} return zonderPositie(d == null ? [] : d); }
  function blokDiagnose() {
    const k = el('div', { klasse: 'sq-kaart alleen-beta', id: 'sliq-diagnose' }, kaartKop('Diagnose (beta-tester)'));
    const m = P.staat() || {}, [st, zeg] = status();
    k.append(el('p', { tekst: 'Als beta-tester kun je een log van de app naar de beheerder sturen. Dat gebeurt nooit vanzelf: je bevestigt elke keer, en je ziet eerst wat er meegaat. Posities worden uit het log gehaald. Een log is gekoppeld aan je account en wordt 90 dagen bewaard.' }));
    const zetDiag = (aan) => async () => { try { await rpc('zet_diag_toestemming', { p_aan: aan }); await ververs(); open(); } catch (e) { zeg(authMelding(e), 'fout'); } };
    if (!m.diag) { k.append(el('button', { klasse: 'sq-knop', type: 'button', id: 'sliq-diag-ja', tekst: 'Ik geef toestemming voor diagnose', klik: zetDiag(true) }), st); return k; }
    const kies = el('select', { id: 'sliq-logsoort' }, ...Object.keys(LOGS).map(s => el('option', { value: s, tekst: s })));
    const pre = el('div', { klasse: 'sq-pre', id: 'sliq-logvoorbeeld' });
    const toon = () => { const t = JSON.stringify(logInhoud(kies.value)); pre.textContent = 'Voorbeeld (' + Math.ceil(t.length / 1024) + ' KB in totaal):\n' + t.slice(0, 700) + (t.length > 700 ? ' …' : ''); };
    kies.addEventListener('change', toon); toon();
    const kSt = el('button', { klasse: 'sq-knop', type: 'button', id: 'sliq-stuurlog', tekst: 'Stuur je log' });
    kSt.addEventListener('click', () => bezig(kSt, async () => {
      const inhoud = logInhoud(kies.value);
      if (!window.confirm('Het log "' + kies.value + '" wordt naar de beheerder gestuurd. Doorgaan?')) return;
      try {
        const r = await rpc('diag_log_opslaan', { p_soort: kies.value, p_app_versie: versie(), p_inhoud: inhoud, p_reden: 'beta' }, 60000);
        zeg(r && r.opgeslagen ? 'Het log is verstuurd.' : 'Dit log is vandaag al verstuurd.', r && r.opgeslagen ? 'ok' : 'fout');
      } catch (e) { zeg(authMelding(e), 'fout'); }
    }));
    k.append(el('label', { klasse: 'sq-veld' }, 'Welk log', kies), pre, el('div', { klasse: 'sq-rij' }, kSt, el('button', { klasse: 'sq-knop', type: 'button', tekst: 'Toestemming intrekken', klik: zetDiag(false) })), st);
    return k;
  }
  function bewaarBestand(naam, tekst) {
    const url = URL.createObjectURL(new Blob([tekst], { type: 'application/json' }));
    const a = el('a', { href: url, download: naam }); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  // Aantal kruispunten en gemiddeld leerpercentage, in stukjes zodat het scherm niet hapert.
  async function voortgang() {
    const ids = haalAlleOsmIds(); let som = 0;
    for (let i = 0; i < ids.length; i++) {
      som += berekenLeerPct(ids[i]) || 0;
      if (i % 40 === 39) await new Promise(r => setTimeout(r, 0));
    }
    return { n: ids.length, pct: ids.length ? Math.round(som / ids.length) : 0 };
  }
  async function uitloggen(melding, wisWachtrij) {
    Sync.stop();
    const uid = (P.staat() || {}).uid;
    try { const c = await client(); await c.auth.signOut({ scope: 'local' }); } catch (e) {}
    try { await kvWeg('auth', SESSIE_SLEUTEL); await kvWeg('staat', 'poort'); await kvWeg('staat', 'mail'); } catch (e) {}
    if (wisWachtrij) { try { const a = await wachtrijAlles(); await wachtrijWeg(a.filter(x => x.uid === uid).map(x => x.ref)); } catch (e) {} }
    profiel = null; sessieOk = false; mail = null;
    try { naarStartscherm(); } catch (e) {}
    sluit(); P.wis();
    toonPoort('inlog', melding || 'Je bent uitgelogd.');
  }

  // ── de synchronisatie ─────────────────────────────────────────
  const Sync = (function () {
    let loopt = false, gestopt = false, timer = null, pogingen = 0, laatsteFout = null, historieBezig = false;
    let nietVoor = 0, wachtReden = null, volgendeOp = 0, laatsteRegel = -1;
    const pakketTijden = [];
    const magSturen = () => { const m = P.staat(); return !gestopt && P.open() && !!m && m.sync === true && sessieOk && configSyncAan === true && online(); };
    // Plant de volgende poging. Een wachttijd (netwerkfout, daglimiet, geen toestemming) wordt nooit ingekort door een
    // trigger zoals 'weer in beeld' of een nieuwe meting; een eerder geplande poging blijft staan.
    function plan(ms) {
      const nu = Date.now(), wacht = Math.max(ms, nietVoor - nu, 0);
      if (timer && volgendeOp && volgendeOp <= nu + wacht) return;
      if (timer) clearTimeout(timer);
      volgendeOp = nu + wacht;
      timer = setTimeout(() => { timer = null; volgendeOp = 0; rustig(() => verzend(false)); }, wacht);
    }
    function rustig(fn) { (window.requestIdleCallback || ((f) => setTimeout(f, 50)))(() => { fn(); }, { timeout: 4000 }); }
    // De kleine regel op het startscherm: alleen als er iets te versturen is.
    function toonRegel(x) {
      try {
        if (x === laatsteRegel && (x > 0) === !!document.getElementById('sliq-syncregel')) return;
        laatsteRegel = x;
        let e = document.getElementById('sliq-syncregel');
        if (!(x > 0)) { if (e) e.remove(); return; }
        const s = document.getElementById('startscherm'); if (!s) return;
        if (!e) {
          e = document.createElement('div'); e.id = 'sliq-syncregel'; e.setAttribute('role', 'status');
          e.style.cssText = 'margin-top:8px;color:rgba(232,238,247,.6);font-size:12px;text-align:center';
          const c = document.getElementById('s-copyright'); if (c && c.parentNode === s) s.insertBefore(e, c); else s.appendChild(e);
        }
        e.textContent = 'Nog te versturen: ' + x + (x === 1 ? ' meting' : ' metingen');
      } catch (e) {}
    }
    let regelTimer = null;
    function verversRegel() { if (regelTimer) return; regelTimer = setTimeout(() => { regelTimer = null; status().then(x => toonRegel(x.teVersturen)).catch(() => {}); }, 1500); }
    async function telBij(t) {
      const o = Object.assign({ geaccepteerd: 0, quarantaine: 0, dubbel: 0, afgewezen: 0 }, (await kvLees('staat', 'sync_tel')) || {});
      for (const k of Object.keys(t)) o[k] = (o[k] || 0) + t[k];
      await kvZet('staat', 'sync_tel', o);
    }
    async function zetWacht(reden, tot) { wachtReden = reden; nietVoor = tot; await kvZet('staat', 'sync_wacht', reden ? { reden, tot } : null); }
    // Een fout van de server zelf (raise in een functie) is geen netwerkfout.
    const serverWeigert = (e) => !!e && e.code === 'P0001' && !/sync_uit|geen_toestemming|Niet ingelogd/.test(String(e.message || ''));
    function lichtVan(nodeId) {   // de plek van het STOPLICHT uit de kaart; nooit de positie van de gebruiker
      try { if (typeof osmCache !== 'undefined' && Array.isArray(osmCache)) { const n = osmCache.find(x => String(x.id) === String(nodeId)); if (n && typeof n.lat === 'number' && typeof n.lon === 'number') return { lat: n.lat, lon: n.lon, naam: n.naam || null }; } } catch (e) {}
      try { const p = opslagLees('sl_pos_' + nodeId, null); if (p && p.bron === 'osm' && typeof p.lat === 'number' && typeof p.lon === 'number') { let naam = null; try { naam = opslagLeesRuw('sl_naam_' + nodeId); } catch (e) {} return { lat: p.lat, lon: p.lon, naam }; } } catch (e) {}
      return null;
    }
    // V11.38.2: nieuwe sleutel, zodat de leerdata een keer opnieuw worden gelezen en de onvolledige metingen die V11.38.1 oversloeg
    // alsnog meegaan. Wat al verstuurd is of al in de wachtrij staat, wordt niet dubbel opgenomen (zelfde ref).
    // V11.38.11: weer een nieuwe sleutel. Tot V11.38.10 pakte naMeting het nieuwste record van de lijst; kwam er binnen 1,5 s een
    // KLOPTE/BIJNA/FOUT-tik bij, dan was dat het bevestig-record en ging de meting zelf nooit mee. Die metingen staan nog in de
    // leerdata en gaan met deze eenmalige inhaalslag alsnog mee. Hoeveel er meegaan, staat bij de sleutel en in het paneel.
    const HISTORIE_SLEUTEL = 'historie3_';
    function maakItem(uid, nodeId, dd, rec, voorspeld) {
      const duur = rec.duur, tijd = rec.tijd;
      if (typeof duur !== 'number' || !(duur > 3 && duur < 600) || typeof tijd !== 'number') return null;
      if (rec.bron != null && rec.bron !== 's1') return null;          // geen bevestig-regels, geen afgeleide records
      if (rec.s2 === true || DAGDELEN.indexOf(dd) < 0) return null;
      if (tijd < Date.now() - 399 * 86400000 || tijd > Date.now() + 240000) return null;
      if (dd === 'dag' && tijd < OUDE_DAG_GRENS) { const u = new Date(tijd).getHours(); if (u >= 16 && u < 20) return null; }
      const it = { ref: refVan(uid + '|' + nodeId + '|' + dd + '|' + tijd + '|' + duur), uid, st: 'w', node_id: String(nodeId), dagdeel: dd, duur,
                   observed_at: new Date(tijd).toISOString(), voorspeld_sec: null, app_versie: null, volledig: rec.zo === 1 ? true : (rec.zo === 0 ? false : null) };
      if (voorspeld && String(voorspeld.node) === String(nodeId) && typeof voorspeld.geb === 'number' && Date.now() - voorspeld.t < 300000) it.voorspeld_sec = Math.round(voorspeld.geb);
      return it;
    }
    // Aangeroepen vanuit slaOpIntern bij elke nieuwe meting. Doet niets zonder toestemming.
    function noteer(nodeId, dd, rec, voorspeld) {
      const m = P.staat(); if (!m || m.sync !== true || !P.open()) return;
      const it = maakItem(m.uid, nodeId, dd, rec, voorspeld); if (!it) return;
      it.app_versie = versie();
      const l = lichtVan(nodeId); if (l) it.kn = l;
      wachtrijZet([it]).then(() => { plan(5000); verversRegel(); });
    }
    // De bestaande leerdata van dit toestel, eenmalig na toestemming, in kleine stukjes.
    async function historie() {
      const m = P.staat(); if (historieBezig || !m || m.sync !== true) return;
      historieBezig = true;
      try {
        const klaar = await klaarSleutels(), inRij = new Set((await wachtrijAlles()).map(x => x.ref));
        const sleutels = opslagSleutels('sl_v4_'); let aantal = 0;
        for (let i = 0; i < sleutels.length; i++) {
          const mm = /^sl_v4_(.+)_(ochtend|dag|avond|nacht)$/.exec(sleutels[i]); if (!mm) continue;
          const lijst = opslagLees(sleutels[i], []); if (!Array.isArray(lijst)) continue;
          const nieuw = [];
          for (const rec of lijst) { const it = maakItem(m.uid, mm[1], mm[2], rec, null); if (it && !klaar.has(it.ref) && !inRij.has(it.ref)) { inRij.add(it.ref); nieuw.push(it); } }
          if (nieuw.length) { await wachtrijZet(nieuw); aantal += nieuw.length; }
          if (i % 25 === 24) await new Promise(r => setTimeout(r, 30));
        }
        await kvZet('staat', HISTORIE_SLEUTEL + m.uid, { t: Date.now(), n: aantal });   // V11.38.11: met het aantal
      } catch (e) {} finally { historieBezig = false; }
      plan(500);
    }
    async function verzend(dwing) {
      if (loopt || !magSturen()) return;
      const nu0 = Date.now();
      while (pakketTijden.length && nu0 - pakketTijden[0] > 60000) pakketTijden.shift();
      if (!dwing && nu0 < nietVoor) { plan(nietVoor - nu0); return; }
      if (!dwing && pakketTijden.length >= MAX_PER_MIN) { plan(60000 - (nu0 - pakketTijden[0]) + 50); return; }
      loopt = true;
      try {
        const uid = P.staat().uid, nu = Date.now(), grens = nu - NIEUW_MS;
        const kand = [], tijd = new Map();
        for (const it of await wachtrijAlles()) {
          if (it.uid !== uid) continue;
          if (it.st === 'w' || (it.st === 'k' && !(it.kt && nu - it.kt < KAART_WACHT))) { kand.push(it); const t = Date.parse(it.observed_at); tijd.set(it, isNaN(t) ? 0 : t); }
        }
        // Nieuwste eerst; alles van de laatste 48 uur gaat altijd voor de oude achterstand.
        kand.sort((x, y) => ((tijd.get(y) >= grens) - (tijd.get(x) >= grens)) || (tijd.get(y) - tijd.get(x)));
        const nodesOk = new Set((await kvLees('staat', 'nodes_ok')) || []);
        const batch = [];
        for (const it of kand) {
          if (batch.length >= BATCH) break;
          if (it.st === 'k') { const l = lichtVan(it.node_id); if (!l) continue; it.kn = l; it.st = 'w'; }
          batch.push(it);
        }
        if (!batch.length) { pogingen = 0; toonRegel(kand.length); return; }
        let nodesNieuw = false;
        for (const id of new Set(batch.map(x => x.node_id))) {
          if (nodesOk.has(id)) continue;
          const l = (batch.find(x => x.node_id === id && x.kn) || {}).kn || lichtVan(id);
          if (!l) continue;   // de server zegt dan zelf of hij het kruispunt al kent
          const naam = l.naam ? String(l.naam) : null, stad = naam && naam.indexOf(',') >= 0 ? naam.slice(naam.lastIndexOf(',') + 1).trim() || null : null;
          try { await rpc('registreer_node', { p_node_id: id, p_lat: l.lat, p_lon: l.lon, p_city: stad, p_name: naam }); nodesOk.add(id); nodesNieuw = true; }
          catch (e) { if (!serverWeigert(e)) throw e; }   // geweigerd kruispunt: de metingen krijgen dan onbekend_kruispunt
        }
        if (nodesNieuw) await kvZet('staat', 'nodes_ok', [...nodesOk]);
        if (!magSturen()) return;
        const payload = batch.map(x => ({ client_ref: x.ref, node_id: x.node_id, dagdeel: x.dagdeel, duur: x.duur, observed_at: x.observed_at,
                                          voorspeld_sec: x.voorspeld_sec, app_versie: x.app_versie || versie(), volledig: x.volledig }));
        pakketTijden.push(Date.now());
        const antw = await rpc('verwerk_batch', { p_metingen: payload });
        const res = (antw && antw.resultaten) || [];
        if (res.length !== batch.length) throw new Error('onverwacht antwoord');
        const weg = [], bij = [], tel = { geaccepteerd: 0, quarantaine: 0, dubbel: 0, afgewezen: 0 }; let wacht = null;
        for (let i = 0; i < batch.length; i++) {
          const it = batch[i], r = res[i] || {};
          if (r.status === 'geaccepteerd' || r.status === 'quarantaine' || r.status === 'dubbel') { weg.push(it.ref); tel[r.status]++; }
          else if (r.reden === 'geen_toestemming' || r.reden === 'daglimiet') wacht = r.reden;                 // later opnieuw, niet afgewezen
          else if (r.reden === 'onbekend_kruispunt') {                                                          // wacht op de kaart, maar niet eindeloos
            it.kp = (it.kp || 0) + 1; it.kt = Date.now(); delete it.kn; nodesOk.delete(it.node_id);
            if (it.kp >= KAART_MAX) { it.st = 'af'; it.reden = 'onbekend_kruispunt'; tel.afgewezen++; } else it.st = 'k';
            bij.push(it);
          }
          else { it.st = 'af'; it.reden = String(r.reden || 'onbekend'); tel.afgewezen++; bij.push(it); }       // afgewezen: nooit opnieuw
        }
        if (weg.length) { await klaarZet(weg); await wachtrijWeg(weg); }
        if (bij.length) await wachtrijZet(bij);
        await telBij(tel);
        pogingen = 0; laatsteFout = null;
        const over = kand.length - weg.length - tel.afgewezen;
        if (wacht) { await zetWacht(wacht, Date.now() + (wacht === 'daglimiet' ? LIMIET_WACHT : TOESTEMMING_WACHT)); toonRegel(over); plan(0); return; }
        await kvZet('staat', 'sync_laatst', Date.now());
        nietVoor = 0; if (wachtReden) await zetWacht(null, 0);
        toonRegel(over);
        if (kand.length > batch.length) plan(PAUZE_MS);
      } catch (e) {
        pogingen++; laatsteFout = foutTekst(e);
        nietVoor = Date.now() + Math.min(3600000, 30000 * Math.pow(2, Math.min(pogingen - 1, 7)));   // oplopende wachttijd
        plan(0); verversRegel();
      } finally { loopt = false; }
    }
    async function status() {
      const uid = (P.staat() || {}).uid, a = (await wachtrijAlles()).filter(x => x.uid === uid), redenen = {};
      for (const x of a) if (x.st === 'af') redenen[x.reden] = (redenen[x.reden] || 0) + 1;
      const wacht = a.filter(x => x.st === 'w').length, kaart = a.filter(x => x.st === 'k').length, onvolledig = a.filter(x => (x.st === 'w' || x.st === 'k') && x.volledig === false).length;
      return { wacht, kaart, onvolledig, teVersturen: wacht + kaart, afgewezen: a.filter(x => x.st === 'af').length, redenen, overgeslagen: a.filter(x => x.st === 'uit').length,
               klaar: await klaarAantal(), laatst: (await kvLees('staat', 'sync_laatst')) || null, fout: laatsteFout, pogingen,
               tel: (await kvLees('staat', 'sync_tel')) || { geaccepteerd: 0, quarantaine: 0, dubbel: 0, afgewezen: 0 },
               wachtReden: nietVoor > Date.now() ? (wachtReden || (laatsteFout ? 'netwerk' : null)) : null, wachtTot: nietVoor > Date.now() ? nietVoor : null, volgende: volgendeOp || null,
               inhaal: await inhaalStand(uid) };
    }
    // V11.38.11: de uitslag van de eenmalige inhaalslag { t, n }, of null zolang hij niet gedraaid heeft.
    async function inhaalStand(uid) {
      try { const v = await kvLees('staat', HISTORIE_SLEUTEL + uid); return v && typeof v === 'object' && typeof v.n === 'number' ? { t: v.t, n: v.n } : null; } catch (e) { return null; }
    }
    // V11.38.2: onvolledige metingen gaan WEL mee (met volledig=false). Wat V11.38.1 daarom opzij zette, gaat terug in de wachtrij.
    async function opruimen(uid) {
      const a = (await wachtrijAlles()).filter(x => x.uid === uid && x.st === 'uit' && x.reden === 'onvolledig');
      for (const x of a) { x.st = 'w'; delete x.reden; }
      if (a.length) await wachtrijZet(a);
    }
    async function start() {
      gestopt = false;
      const m = P.staat(); if (!m || m.sync !== true) { toonRegel(0); return; }
      try { const w = await kvLees('staat', 'sync_wacht'); if (w && w.tot > Date.now() && w.tot < Date.now() + 2 * 3600000) { wachtReden = w.reden; nietVoor = Math.max(nietVoor, w.tot); } } catch (e) {}
      try { await opruimen(m.uid); } catch (e) {}
      try { const s = await status(); toonRegel(s.teVersturen); } catch (e) {}
      if (!(await kvLees('staat', HISTORIE_SLEUTEL + m.uid))) rustig(historie); else plan(1500);
    }
    function stop() { gestopt = true; if (timer) { clearTimeout(timer); timer = null; volgendeOp = 0; } toonRegel(0); }
    // Na elke echte meting (slaOpIntern, bron s1): het zojuist geschreven record opzoeken en melden. Wat de app
    // toonde komt uit het schaduwlog van dezelfde rode fase. Alleen lezen; het leren zelf is niet aangeraakt.
    // V11.38.11: welk record dat is, staat vast op het moment van schrijven (tijd uit laatsteV4Schrijvingen, zie zojuistGeschreven).
    // Na 1,5 s wordt PRECIES dat record gezocht. Lukt dat niet, dan het nieuwste meetrecord (bron s1 of zonder bron), nooit een
    // bevestig-record: een KLOPTE/BIJNA/FOUT-tik binnen 1,5 s hield de meting tot V11.38.10 van de server.
    const isMeetRecord = (x) => !!x && typeof x.tijd === 'number' && (x.bron == null || x.bron === 's1');
    function zojuistGeschreven(dd) {
      try {
        const l = laatsteV4Schrijvingen, w = Array.isArray(l) && l.length ? l[l.length - 1] : null;   // index.html, gevuld door slaOpIntern
        if (w && w.dd === dd && typeof w.tijd === 'number' && Math.abs(Date.now() - w.tijd) < 5000) return w.tijd;
      } catch (e) {}
      return null;
    }
    function naMeting(nodeId, dd, tijd) {
      const m = P.staat(); if (!m || m.sync !== true) return;
      setTimeout(() => {
        try {
          const lijst = opslagLees('sl_v4_' + nodeId + '_' + dd, []); if (!Array.isArray(lijst) || !lijst.length) return;
          let rec = typeof tijd === 'number' ? lijst.find(x => isMeetRecord(x) && x.tijd === tijd) : null;
          if (!rec) rec = lijst.reduce((a, b) => (isMeetRecord(b) && b.tijd > (a ? a.tijd : 0) ? b : a), null);
          if (!rec || Date.now() - rec.tijd > 20000) return;
          let voorspeld = null;
          try { const sl = opslagLees('sl_schaduwlog', []); const s = Array.isArray(sl) ? sl.filter(x => x && String(x.node) === String(nodeId) && Math.abs(x.t - rec.tijd) < 15000).pop() : null; if (s && typeof s.geb === 'number') voorspeld = { node: nodeId, geb: s.geb, t: Date.now() }; } catch (e) {}
          noteer(nodeId, dd, rec, voorspeld);
        } catch (e) {}
      }, 1500);
    }
    try {
      const orig = window.slaOpIntern;
      if (typeof orig === 'function' && !orig.sliqOrig) {
        const schil = function (osmId, richting, duur, gewichtOverride, dd, bron) {
          const r = orig.apply(this, arguments);
          try { if (bron === undefined || bron === 's1') naMeting(String(osmId), dd, zojuistGeschreven(dd)); } catch (e) {}
          return r;
        };
        schil.toString = () => orig.toString(); schil.sliqOrig = orig; window.slaOpIntern = schil;
      }
    } catch (e) {}
    try {
      // Internet terug: een netwerk-wachttijd mag dan korter (de oorzaak is weg); een daglimiet of ontbrekende toestemming niet.
      window.addEventListener('online', () => { if (!sessieOk) { achtergrond(); return; } if (laatsteFout && !wachtReden) nietVoor = Math.min(nietVoor, Date.now() + 2000); plan(2000); });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') plan(3000); });
    } catch (e) {}
    return { noteer, historie, verzend, status, start, stop };
  })();

  window.SLIQ_SYNC = Object.freeze({ noteer: Sync.noteer, status: Sync.status, nu: () => Sync.verzend(true) });
  window.SLIQ_ACCOUNT = Object.freeze({ open, sluit, ververs: () => ververs().catch(() => null) });

  // ── begin ─────────────────────────────────────────────────────
  function begin() {
    P.pasToe();
    if (!P.open()) {
      // Het merkteken kan uit localStorage verdwenen zijn terwijl de kopie in IndexedDB er nog is: dan herstellen.
      kvLees('staat', 'poort').then((m) => {
        if (m && typeof m.ok === 'number' && m.uid) { P.zet(m); if (P.open()) { achtergrond(); return; } }
        toonPoort('inlog');
      }).catch(() => toonPoort('inlog'));
      return;
    }
    achtergrond();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin); else begin();
})();
