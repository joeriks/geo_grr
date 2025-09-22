# Europaexpedition

En enkel 2.5D-upplevelse byggd med Three.js där du kan utforska Europas länder och huvudstäder. Världen bygger på en GeoJSON-karta över Europa med en skala på 10 km per spel-enhet. Länder representeras av flaggstänger och huvudstäder av skyltar med namn.

## Funktioner

- Three.js-renderad scen i 2.5D-perspektiv.
- Europa-karta med landyta och vattenyta där norr alltid är uppåt.
- Spelare som kan röra sig med WASD/piltangenter men hindras från att gå ut i vatten.
- Flaggstänger med respektive nations flagga och skyltar för huvudstäder.
- Upptäcktslogg i UI som visar vilka länder och städer som har besökts.

## Kom igång

Projektet är helt statiskt. För att undvika CORS-problem när kart- och metadata läses in via `fetch`, kör en enkel utvecklingsserver i katalogen:

```bash
npm install -g serve
serve .
```

eller med Python:

```bash
python -m http.server
```

Öppna sedan `http://localhost:8000` (eller motsvarande port) i en webbläsare som stödjer ES-moduler.

## Struktur

- `index.html` – Startfil som laddar Three.js-modulerna.
- `styles.css` – Grundläggande HUD-stil och layout.
- `src/world.js` – Laddar GeoJSON-kartan, bygger land/vatten och placerar flaggor/skyltar.
- `src/player.js` – Spelarkontroller och kamera.
- `src/ui.js` – HUD för instruktioner och upptäcktslista.
- `data/` – GeoJSON och lista över europeiska huvudstäder med flaggor.

## Licens

GeoJSON-kartan hämtas från [leakyMirror/map-of-europe](https://github.com/leakyMirror/map-of-europe). Övrig kod i detta repo är fri att återanvända.
