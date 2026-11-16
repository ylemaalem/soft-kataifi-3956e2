# Inloggen, rollen en synchronisatie (V11.38.0)

© 2026 StoplichtIQ

## Hoe het werkt
- **De poort.** Het eerste script in `index.html` kijkt naar een merkteken in de opslag (`sliq_poort`). Dat merkteken is geen
  wachtwoord en geen token; het zegt alleen: dit toestel is ingelogd geweest, met deze rol, op dit moment. Zonder geldig merkteken
  blijft de app dicht en staat alleen het inlogscherm in beeld. Het merkteken is 30 dagen geldig na de laatste geslaagde controle
  bij de server; zo start de app ook zonder bereik.
- **De inlog-tokens** van Supabase staan alleen in IndexedDB (database `StoplichtIQ_Account`), nooit in localStorage. Daardoor
  komen ze nooit in een backup, export, log of diagnose.
- **Rollen.** `mijn_profiel()` levert `is_admin` en `is_beta_tester`. De app bewaart de rol met een tijdstempel en ververst hem bij
  elke start met bereik. Het verbergen van schermen is bruikbaarheid, geen beveiliging: de beveiliging zit in de database (RLS en
  de controle `is_admin()` in elke beheerfunctie).
- **Synchronisatie** (alleen met toestemming): `account.js` zet elke echte meting in een wachtrij in IndexedDB en verstuurt die met
  `verwerk_batch` in blokken van hoogstens 100. Elke meting heeft een vaste `client_ref`, zodat een herhaalde verzending nooit
  dubbel telt. De noodrem `app_config.sync_aan = false` zet het versturen voor iedereen stil.

## Contract met de database
- `profiles.display_name` bestaat, maar de app vult en toont hem niet. Het e-mailadres komt uit `auth.users` via `mijn_profiel()`.
  (Dit verbetert de eerdere beschrijving, waarin `display_name` de getoonde naam heette.)
- `verwerk_batch(p_metingen jsonb)` geeft `{ resultaten: [{ ref, status, reden }], geaccepteerd, quarantaine, dubbel, afgewezen }`,
  met status `geaccepteerd`, `quarantaine`, `dubbel` of `afgewezen`.
- `measurements.status` kan nu ook `dubbel` zijn (een meting die minder dan 6 s na een gelijke meting kwam). Die telt nergens mee.

## Terugdraaien
De versie van voor deze wijziging heeft de lokale tag `voor-login-v11.37.41`.
