# De kaart van de app (map `kaart/`)

Sinds V11.37.20 haalt de app de verkeerslichten uit deze map, en niet meer bij elke kaart van Overpass. Overpass blijft de reserve als dit bestand niet te krijgen is.

## Wat er staat

| Bestand | Wat |
|---|---|
| `lichten.json` | Alle verkeerslichten van Nederland, en de wegen met een naam of snelheidslimiet waar ze op liggen. Dezelfde vorm als het antwoord van Overpass. Eén element per regel, op oplopend nummer. |
| `fiets.json` | De lichten die alleen op een fiets- of voetpad liggen. Dezelfde vorm als het antwoord op de fietslijst-vraag. |
| `versie.json` | De datum van de data (zonder kloktijd), de aantallen, de groottes en de sha256 van beide bestanden. De app haalt dit kleine bestand bij elke start op. |
| `maak.py` | Het script dat de drie bestanden maakt. |
| `LICENTIE.md` | De licentie (ODbL) en de bron. |

Alleen in deze map staan OSM-nummers en straatnamen: het is de volledige, openbare set van heel Nederland, zonder selectie. Buiten deze map mogen ze nergens staan (zie `test_privacyscan.js`).

## Hoe de app het gebruikt (kort)

- Bij elke start vraagt de app `versie.json`. Is de sha256 dezelfde als van het bestand dat al in de telefoon staat, dan haalt hij niets op.
- Is er een nieuwe versie, of nog geen bestand, dan haalt een worker `lichten.json` en `fiets.json` op, controleert de sha256 en de vorm, en bewaart ze in vakken van 0,1 bij 0,15 graad in een eigen database in de telefoon (`StoplichtIQ_Kaartbestand`). De oude versie blijft in gebruik tot de nieuwe goedgekeurd is.
- Elke kaart van 5 km wordt uit die vakken geknipt, met de rekenwijze van Overpass (10.000 km per 90 graden). De rest van de app ziet hetzelfde als een antwoord van Overpass.
- Lukt het bestand niet, dan doet de app wat hij vóór V11.37.20 deed: de bewaarde kaart en Overpass.

## Verversen ("ververs de kaart")

Eén keer per maand is genoeg (gemeten: in 45 dagen veranderde 1,6% van de lichten). Younes zegt "ververs de kaart"; Claude doet dan:

1. Het nieuwste uittreksel ophalen en controleren:
   ```
   curl -O https://download.geofabrik.de/europe/netherlands-latest.osm.pbf
   curl -O https://download.geofabrik.de/europe/netherlands-latest.osm.pbf.md5
   ```
   (ongeveer 1,4 GB; de md5 moet kloppen).
2. Op een nieuwe tak vanaf main: `python kaart/maak.py <uittreksel.osm.pbf>` (pyosmium nodig: `python -m pip install osmium`; ongeveer 4 minuten). Het script stopt als het aantal lichten meer dan 2% of het aantal wegen meer dan 3% verandert.
3. Wees-leerdata tellen, vóór het publiceren (sinds V11.37.21). Neem de nieuwste backup van Younes en zoek elk lichtnummer met leerdata (`sl_v4_`, `sl_v5_`, `sl_bevestig_`, `sl_klok_`, met een meting met duur > 0) op in de nieuwe `lichten.json`. Ontbreekt een nummer, dan heeft OSM dat licht opnieuw ingetekend: zoek per ontbrekend nummer een kandidaat binnen 15 m in de nieuwe kaart. Rapporteer dit eerst aan Younes (aantal nummers, aantal metingen, met en zonder kandidaat), vóór er iets gepubliceerd wordt. De leerdata zelf wordt niet aangeraakt. Bij de kaart van V11.37.20 waren het er 0 (486 nummers met metingen, alle 486 aanwezig).
4. De toetsen draaien, in elk geval `test_kaartbestand.js` en `test_privacyscan.js`, en daarna alle suites.
5. Committen met alleen aantallen in het bericht (geen namen of nummers), en een rapport schrijven.
6. Pushen pas nadat Claude het rapport beoordeeld heeft en Younes "ga verder" zegt.
7. Na de push op de echte iPhone de vervangroute toetsen: start de app via het icoon en controleer in de startlog dat `kbv` op `nieuw` staat en dat de kaart uit het bestand komt. Die route (een nieuwe versie vervangt de oude) is in het veld nog niet doorlopen; tot 22 okt waren alleen de eerste start en 'zelfde' gezien (34 starts, 33 keer zelfde).

Gebruik het uittreksel daarna niet meer: het mag weg (1,4 GB).

## Bron en licentie

© OpenStreetMap-bijdragers, ODbL 1.0. Bewerkt uit het uittreksel van Geofabrik GmbH. Zie `LICENTIE.md`.
