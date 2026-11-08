// © 2026 StoplichtIQ — Y. Lemaalem
//
// De twee dashboards: beheer (alleen als mijn_profiel().is_admin) en de eigen
// gegevens van elke gebruiker. Volgens het Supabase-contract van 8 nov 2026:
// - alleen de publieke anon-sleutel; alles via rpc, behalve het lezen van app_config;
// - verbergen is geen beveiliging: de database weigert admin-functies zelf;
// - alle tekst uit de database gaat via textContent (namen komen van gebruikers).
(function () {
  'use strict';
  const URL_ = 'https://yizlnymlwkligabvwplt.supabase.co';
  const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpemxueW1sd2tsaWdhYnZ3cGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDM2MjQsImV4cCI6MjEwNTQ3OTYyNH0.QMbWOVxOqazEGdb40NFqn3ArV0ViA52_b5k9z3-yFao';
  const ROL_SLEUTEL = 'dash_rol';          // de laatst bekende rol, voor offline (geen sl_: hoort niet in de backup)
  const VERVERS_MS = 45000;                // binnen de gevraagde 30-60 s
  const PULS_UUR = 3, PULS_MAX = 150;      // pulseren: nieuw in de laatste 3 uur, hooguit 150 punten

  const db = window.supabase.createClient(URL_, ANON, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'dash_sessie' } });
  const app = document.getElementById('app');
  let profiel = null, tab = null, kaart = null, laag = null, uren = 24, klok = null, config = {}, offline = false;

  // ── hulpjes ─────────────────────────────────────────────────
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
  const getal = (x) => (x == null ? '–' : Number(x).toLocaleString('nl-NL'));
  function moment(t) { if (!t) return '–'; const d = new Date(t); return isNaN(d) ? '–' : d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  function dag(t) { const d = new Date(t); return isNaN(d) ? '' : d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }); }
  function foutTekst(e) { return String((e && e.message) || e || 'onbekende fout').slice(0, 160); }
  async function rpc(naam, args) {
    const { data, error } = await db.rpc(naam, args || {});
    if (error) throw error;
    return data;
  }
  function tabel(koppen, rijen, leeg) {
    if (!rijen.length) return el('p', { klasse: 'stil klein', tekst: leeg || 'Nog niets.' });
    return el('div', { klasse: 'schuif' }, el('table', { klasse: 'tabel' },
      el('thead', null, el('tr', null, koppen.map(k => el('th', { tekst: k.t, klasse: k.g ? 'getal' : null })))),
      el('tbody', null, rijen.map(r => el('tr', null, koppen.map(k => { const w = k.w(r); return w instanceof Node ? el('td', null, w) : el('td', { tekst: w == null ? '–' : String(w), klasse: k.g ? 'getal' : null }); }))))));
  }
  function stopKlok() { if (klok !== null) { clearInterval(klok); klok = null; } }
  function vervangInhoud(doel, ...kind) { doel.replaceChildren(...kind.flat().filter(Boolean)); }

  // ── inloggen ────────────────────────────────────────────────
  function toonInlog(melding) {
    stopKlok(); kaart = null;
    const mail = el('input', { type: 'email', autocomplete: 'username', required: true, id: 'mail' });
    const ww = el('input', { type: 'password', autocomplete: 'current-password', required: true, id: 'ww' });
    const st = el('p', { klasse: 'status fout', tekst: melding || '' });
    const knop = el('button', { type: 'submit', tekst: 'Inloggen' });
    const form = el('form', { klasse: 'inlog' }, el('h1', { tekst: 'StoplichtIQ' }), el('label', null, 'E-mailadres', mail), el('label', null, 'Wachtwoord', ww), knop, st);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault(); knop.disabled = true; st.textContent = '';
      const { error } = await db.auth.signInWithPassword({ email: mail.value.trim(), password: ww.value });
      knop.disabled = false;
      if (error) { st.textContent = /invalid/i.test(error.message) ? 'E-mailadres of wachtwoord klopt niet.' : foutTekst(error); return; }
      ww.value = ''; await naInloggen();
    });
    vervangInhoud(app, form);
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
      if (!r || !geenNet) { toonInlog('Kon je profiel niet ophalen: ' + foutTekst(e)); return; }
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
    const kop = el('header', { klasse: 'kop' }, el('h1', { tekst: 'StoplichtIQ' }),
      profiel.is_admin ? el('nav', { klasse: 'tabs' }, knop('kaart', 'Kaart'), knop('gebruikers', 'Gebruikers'), knop('mijn', 'Mijn gegevens')) : null,
      el('span', { klasse: 'ruimte' }), el('button', { tekst: 'Uitloggen', klik: async () => { await db.auth.signOut(); profiel = null; try { localStorage.removeItem(ROL_SLEUTEL); } catch (e) {} toonInlog(); } }));
    const inhoud = el('div', { stijl: { flex: '1', display: 'flex', flexDirection: 'column', minHeight: '0' } });
    vervangInhoud(app, kop,
      offline ? el('div', { klasse: 'melding', tekst: 'Geen verbinding. Je ziet de laatst bekende rol; gegevens kunnen niet worden opgehaald.' }) : null,
      config.bericht ? el('div', { klasse: 'melding', tekst: String(config.bericht) }) : null,
      inhoud);
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
    const leeg = el('div', { klasse: 'leeg', tekst: 'Nog geen kruispunten binnengekomen.', stijl: { display: 'none' } });
    const filter = (u, t) => el('button', { tekst: t, klasse: uren === u ? 'aan' : null, klik: () => { uren = u; teken(); } });
    const legenda = el('div', { klasse: 'legenda' }, el('b', { tekst: 'Nieuw in deze periode' }),
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
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(kaart);
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
    const sectie = (titel, d, maak) => el('section', null, el('h2', { tekst: titel }), d && d.fout ? el('p', { klasse: 'status fout', tekst: d.fout }) : maak(d || []));
    vervangInhoud(zij,
      sectie('Binnenkomst, 30 dagen', inflow, inflowBlok),
      sectie('Steden', steden, d => tabel([{ t: 'Stad', w: r => r.stad }, { t: 'Totaal', g: 1, w: r => getal(r.nodes_totaal) }, { t: 'Vers 7 d', g: 1, w: r => getal(r.nodes_vers_7d) }, { t: 'Geverif.', g: 1, w: r => getal(r.nodes_geverifieerd) }], d.slice(0, 15), 'Nog geen steden.')),
      sectie('Quarantaine', quar, d => tabel([{ t: 'Kruispunt', w: r => r.node_id }, { t: 'Aantal', g: 1, w: r => getal(r.in_quarantaine) }, { t: 'Dagen oud', g: 1, w: r => getal(r.dagen_oud) }], d.slice(0, 10), 'Niets in quarantaine.')),
      sectie('Recente gebeurtenissen', events, d => tabel([{ t: 'Tijd', w: r => moment(r.created_at) }, { t: 'Soort', w: r => r.soort }, { t: 'Stad', w: r => r.city }, { t: 'Wie', w: r => r.gebruiker_kort }], d.slice(0, 15), 'Nog geen gebeurtenissen.')));
  }

  function inflowBlok(rijen) {
    const d = rijen.slice().sort((a, b) => new Date(a.dag) - new Date(b.dag));
    const nu = d[d.length - 1] || {};
    const tegels = el('div', { klasse: 'tegels' },
      [['Geaccepteerd', nu.geaccepteerd], ['Quarantaine', nu.in_quarantaine], ['Actief', nu.actieve_gebruikers]].map(([t, w]) => el('div', { klasse: 'tegel' }, el('b', { tekst: getal(w || 0) }), el('span', { tekst: t + ' vandaag' }))));
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
          { t: 'Bijdragen', g: 1, w: r => getal(r.contributions) },
          { t: 'Vertrouwen', g: 1, w: r => r.trust_score == null ? '–' : Number(r.trust_score).toFixed(2).replace('.', ',') },
          { t: 'Log', w: r => el('button', { tekst: 'Stuur je log', klik: (ev) => actie(ev.target, 'admin_vraag_log', { p_user_id: r.id }, 'Verzoek staat klaar.') }) },
          { t: 'Beta', w: r => el('button', { tekst: 'Beta-tester', klasse: r.is_beta_tester ? 'aan' : null, 'aria-pressed': String(!!r.is_beta_tester), klik: (ev) => actie(ev.target, 'admin_zet_beta', { p_user_id: r.id, p_aan: !r.is_beta_tester }, 'Beta-status gewijzigd.', laad) }) },
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
        el('label', { klasse: 'schakel', for: 'diag' }, toestemming, 'Diagnosegegevens delen om de app te verbeteren')),
      el('section', { klasse: 'blok' }, el('h2', { tekst: 'Mijn data' }), el('div', { klasse: 'rij' }, download), st),
      el('section', { klasse: 'blok' }, el('h2', { tekst: 'Account verwijderen' }), el('p', { klasse: 'klein stil', tekst: 'Dit verwijdert je account en al je gegevens. Dit kan niet ongedaan worden gemaakt.' }), el('div', { klasse: 'rij' }, woord, verwijder))),
      el('footer', { klasse: 'voet', tekst: '© 2026 StoplichtIQ — Y. Lemaalem' }));
    if (offline) { vervangInhoud(lijst, el('p', { klasse: 'stil', tekst: 'Niet beschikbaar zonder verbinding.' })); return; }
    rpc('mijn_kruispunten').then(rijen => vervangInhoud(lijst, tabel([
      { t: 'Kruispunt', w: r => r.naam || r.node_id }, { t: 'Stad', w: r => r.stad },
      { t: 'Metingen', g: 1, w: r => getal(r.n_metingen) }, { t: 'Mediaan (s)', g: 1, w: r => r.mediaan_sec == null ? '–' : Math.round(r.mediaan_sec) },
      { t: 'Laatste', w: r => moment(r.laatste_meting) }], rijen || [], 'Er zijn nog geen kruispunten van jou binnen.')))
      .catch(e => vervangInhoud(lijst, el('p', { klasse: 'status fout', tekst: foutTekst(e) })));
  }

  // ── start ───────────────────────────────────────────────────
  (async () => {
    try {
      const { data } = await db.auth.getSession();
      if (data && data.session) await naInloggen(); else toonInlog();
    } catch (e) { toonInlog(foutTekst(e)); }
  })();
  db.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT' && profiel) { profiel = null; toonInlog(); } });
})();
