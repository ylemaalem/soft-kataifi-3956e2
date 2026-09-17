// ═══════════════════════════════════════════════════════════════
//  StoplichtIQ — test_backup_export.js
//  © 2026 StoplichtIQ — Y. Lemaalem
//
//  Test bij V11.18.15: de backup-export neemt elke sl_-sleutel mee.
//
//  WAT ER MIS WAS
//  De export liep over een vaste lijst van 24 prefixen en namen. sl_modelvgl
//  (V11.18.8) stond er niet in en viel twee exports lang stil weg, terwijl hij
//  op het toestel stond (5,4 KB). Geen fout, geen melding.
//
//  X1  sl_modelvgl en zijn twee broers zitten in de backup
//  X2  REGRESSIE: alles wat de oude lijst meenam gaat nog steeds mee, met
//      exact dezelfde waarde
//  X3  alleen sl_-sleutels, niets anders
//  X4  een waarde die geen JSON is gaat als tekst mee, nooit weg
//  X5  de vorm van het exportbestand is ongewijzigd
//  X6  import blijft bewust een lijst, en zet geen testmodus aan
//
//  DE OUDE LIJST STAAT HIERONDER LETTERLIJK. Zo toetst X2 tegen wat er
//  werkelijk stond, en niet tegen een herinnering eraan.
//
//  DRAAIEN
//    python -m http.server 8765 --bind 127.0.0.1     (in de repo-map)
//    open http://127.0.0.1:8765/index.html
//    in de console:
//      var s=document.createElement('script'); s.src='/test_backup_export.js';
//      document.head.appendChild(s);
//      s.onload = () => console.table(testBackupExport().regels);
// ═══════════════════════════════════════════════════════════════

function testBackupExport() {
  const regels = [];
  const eis = (naam, gelukt, verwacht, gekregen) => {
    regels.push({ test: naam, uitslag: gelukt ? 'OK' : 'GEFAALD', verwacht, gekregen });
    return gelukt;
  };

  // letterlijk overgenomen uit exporteerData vóór V11.18.15
  const oudeLijst = (key) =>
    key.startsWith('sl_v10_')||key.startsWith('sl_v5_')||key.startsWith('sl_v4_')||key.startsWith('sl_v3_')||key.startsWith('sl_s2_')||key.startsWith('sl_klok_')||key==='sl_opslaglog'||key==='sl_richtinglog'||key==='sl_schaduwlog'||key==='sl_herzieninglog'||key.startsWith('sl_passief_')||key==='sl_conflog'||key==='sl_zichtlog'||key==='sl_detlog'||key.startsWith('sl_tag_')||key.startsWith('sl_naam_')||key.startsWith('sl_richting_')||key.startsWith('sl_route_')||key.startsWith('sl_bevestig_')||key.startsWith('sl_pos_')||key.startsWith('sl_neutraal_')||key.startsWith('sl_enkelricht_')||key==='sl_cam_stats'||key==='sl_stad_cache';

  const bewaardLS = new Map();
  const zetLS = (k, v) => {
    if (!bewaardLS.has(k)) bewaardLS.set(k, localStorage.getItem(k));
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  };

  // Eén sleutel voor ELKE vorm uit de oude lijst, zodat X2 geen enkele tak
  // ongetoetst laat ook als het toestel er toevallig geen van heeft.
  const N = '991177';
  const vasteVormen = {
    [`sl_v10_${N}_dag`]: { rood: 2 },
    [`sl_v5_${N}_N_W_dag`]: [{ duur: 40, tijd: 1 }],
    [`sl_v4_${N}_dag`]: [{ duur: 41, tijd: 2 }],
    [`sl_v3_${N}_dag`]: [{ duur: 42, tijd: 3 }],
    [`sl_s2_${N}`]: [{ duur: 0, tijd: 4 }],
    [`sl_klok_${N}`]: [{ t: 5, type: 'groen' }],
    [`sl_passief_${N}`]: [{ t: 6 }],
    [`sl_tag_${N}`]: 'hoek',
    [`sl_naam_${N}`]: 'Teststraat',
    [`sl_richting_${N}`]: { tikrichting: 'links' },
    [`sl_route_${N}_1_2`]: { n: 1 },
    [`sl_bevestig_${N}`]: [{ categorie: 'klopte' }],
    [`sl_pos_${N}`]: { lat: 52, lon: 4.7 },
    [`sl_neutraal_${N}`]: 1,
    [`sl_enkelricht_${N}`]: 'rechts'
  };
  const vasteNamen = ['sl_opslaglog', 'sl_richtinglog', 'sl_schaduwlog', 'sl_herzieninglog',
                      'sl_conflog', 'sl_zichtlog', 'sl_detlog', 'sl_cam_stats', 'sl_stad_cache'];

  try {
    for (const [k, v] of Object.entries(vasteVormen)) zetLS(k, JSON.stringify(v));
    for (const k of vasteNamen) if (localStorage.getItem(k) === null) zetLS(k, JSON.stringify([]));
    const modelvgl = { start: 1, n: 12, somMsA: 5000, somMsB: 1500, eens: 10, oneens: 2,
                       matrix: { '0>0': 10 }, voorbeelden: [], nC: 4, somMsC: 2100 };
    zetLS('sl_modelvgl', JSON.stringify(modelvgl));
    zetLS('sl_modelvgl_aan', '1');
    zetLS('sl_modelvgl_model', 'dfine');
    zetLS('geen_sl_sleutel', 'x');
    zetLS('SL_hoofdletters', 'x');
    zetLS(`sl_ruw_${N}`, 'dit is {geen json');

    const data = verzamelBackupData();

    // ═══ X1 — DE ONTBREKENDE SLEUTEL ═════════════════════════
    eis('X1 sl_modelvgl zit in de backup',
        'sl_modelvgl' in data, 'aanwezig', String('sl_modelvgl' in data));
    eis('X1b met exact de waarde die op het toestel staat',
        JSON.stringify(data.sl_modelvgl) === JSON.stringify(modelvgl),
        JSON.stringify(modelvgl).slice(0, 60), JSON.stringify(data.sl_modelvgl || null).slice(0, 60));
    eis('X1c en de oude lijst nam hem inderdaad NIET mee — dit was de fout',
        oudeLijst('sl_modelvgl') === false, 'false', String(oudeLijst('sl_modelvgl')));
    eis('X1d sl_modelvgl_aan en sl_modelvgl_model gaan ook mee',
        data.sl_modelvgl_aan === 1 && data.sl_modelvgl_model === 'dfine',
        '1 en dfine', data.sl_modelvgl_aan + ' en ' + data.sl_modelvgl_model);

    // ═══ X2 — NIETS WAT MEEGING VALT WEG ═════════════════════
    // De oude lus, letterlijk nagebouwd, over de huidige opslag.
    const oud = {};
    for (const key of Object.keys(localStorage)) {
      if (oudeLijst(key)) {
        try { oud[key] = JSON.parse(localStorage.getItem(key)); }
        catch (e) { oud[key] = localStorage.getItem(key); }
      }
    }
    const kwijt = Object.keys(oud).filter(k => !(k in data));
    eis('X2 elke sleutel die de oude export meenam, zit ook in de nieuwe',
        kwijt.length === 0 && Object.keys(oud).length > 0,
        '0 kwijt', kwijt.length + ' kwijt van ' + Object.keys(oud).length);
    const anders = Object.keys(oud).filter(k => JSON.stringify(oud[k]) !== JSON.stringify(data[k]));
    eis('X2b met byte-voor-byte dezelfde waarde',
        anders.length === 0, '0 verschillend', anders.length + ': ' + anders.slice(0, 3).join(','));
    const vormenGedekt = Object.keys(vasteVormen).concat(vasteNamen).filter(k => !(k in data));
    eis('X2c alle 24 vormen uit de oude lijst zijn afzonderlijk gedekt',
        vormenGedekt.length === 0, 'alle aanwezig', vormenGedekt.join(',') || 'alle aanwezig');
    const extra = Object.keys(data).filter(k => !(k in oud));
    eis('X2d wat er nieuw bijkomt zijn uitsluitend sl_-sleutels die niet op de oude lijst stonden',
        extra.every(k => k.startsWith('sl_') && !oudeLijst(k)) && extra.includes('sl_modelvgl'),
        'alleen sl_, niet op de oude lijst', extra.slice(0, 6).join(', '));

    // ═══ X3 — ALLEEN sl_ ═════════════════════════════════════
    eis('X3 sleutels die niet met sl_ beginnen gaan niet mee',
        !('geen_sl_sleutel' in data) && !('SL_hoofdletters' in data),
        'uitgesloten', 'geen_sl_sleutel=' + ('geen_sl_sleutel' in data) + ', SL_=' + ('SL_hoofdletters' in data));
    eis('X3b de regel zelf: sl_ ja, "sl" en andere prefixen nee',
        exportSleutelMee('sl_x') && !exportSleutelMee('sl') && !exportSleutelMee('slx_')
          && !exportSleutelMee(null) && !exportSleutelMee(undefined),
        'alleen sl_', 'ok');

    // ═══ X4 — GEEN STIL VERLIES BIJ ONGELDIGE JSON ═══════════
    eis('X4 een waarde die geen JSON is gaat als ruwe tekst mee',
        data[`sl_ruw_${N}`] === 'dit is {geen json',
        'dit is {geen json', String(data[`sl_ruw_${N}`]));

    // ═══ X5 — DE VORM VAN HET BESTAND ════════════════════════
    const zc = (f) => String(f).replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*/g, ' ');
    const exp = zc(exporteerData);
    eis('X5 het exportbestand heeft dezelfde vijf velden als voorheen',
        exp.indexOf("versie:'11.4.4'") >= 0 && exp.indexOf('exportDatum:') >= 0
          && exp.indexOf("app:'StoplichtIQ'") >= 0 && exp.indexOf('data:{}') >= 0
          && exp.indexOf('scores:{}') >= 0,
        'versie, exportDatum, app, data, scores', 'aanwezig');
    eis('X5b en de export gebruikt de nieuwe verzamelaar, niet meer de vaste lijst',
        exp.indexOf('verzamelBackupData()') >= 0 && exp.indexOf("key==='sl_opslaglog'") < 0,
        'verzamelBackupData, geen lijst', 'ok');
    eis('X5c de scores en de bestandsnaam zijn onaangeroerd',
        exp.indexOf('berekenDrieScores(id)') >= 0 && exp.indexOf('stoplichtiq-backup-') >= 0,
        'berekenDrieScores + stoplichtiq-backup-', 'aanwezig');

    // ═══ X6 — IMPORT BLIJFT EEN BEWUSTE LIJST ════════════════
    const imp = zc(importeerData);
    eis('X6 import zet sl_modelvgl* niet terug — een backup zet nergens een testmodus aan',
        imp.indexOf('sl_modelvgl') < 0, 'niet in de importlijst', 'ok');
    eis('X6b en de importlijst zelf is ongewijzigd',
        imp.indexOf("key!=='sl_opslaglog'") >= 0 && imp.indexOf("!key.startsWith('sl_enkelricht_')") >= 0
          && imp.indexOf("key!=='sl_stad_cache'") >= 0,
        'dezelfde 24 vormen', 'aanwezig');

  } finally {
    for (const [k, v] of bewaardLS) { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
  }

  const gefaald = regels.filter(r => r.uitslag === 'GEFAALD');
  return { geslaagd: regels.length - gefaald.length, gefaald: gefaald.length, regels };
}

if (typeof window !== 'undefined') window.testBackupExport = testBackupExport;
