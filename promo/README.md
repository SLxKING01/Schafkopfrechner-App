# Werbevideo „Schafkopfrechner“ (Reel, 9:16)

Alles für das Instagram/TikTok-Reel und die App-Screenshots. Der Ordner ist
vom App-Code getrennt: `src/` wird nur gelesen, nie verändert.

## Neu erzeugen

```bash
cd promo
npm install
npm run capture   # Screenshots aus der Web-Version (ca. 4 Minuten)
npm run draft     # Entwurf 540×960  -> out/draft/
npm run stills    # ein Standbild je Szene -> out/stills/
npm run render    # Final 1080×1920 -> out/schafkopfrechner-reel.mp4 + Cover
```

`npm run all` führt Aufnahme und Final-Render nacheinander aus.
Voraussetzung: im App-Ordner wurde `npm ci` ausgeführt, Node 20+, ffmpeg ist
nicht nötig (Remotion bringt es mit). Soll ein vorhandener Chrome verwendet
werden: `PROMO_CHROME=/pfad/zu/chrome-headless-shell npm run render`.

## Einstellungen

| Einstellung | Werte | Wirkung |
|---|---|---|
| `--endCard` | `soon` (Standard), `live` | Schlusskarte „Bald im App Store“ oder Badge |
| `--icon` | `app-logo` (Standard), `assets-icon` | Eichel-Logo der App oder `assets/icon.png` |

Beispiel: `node scripts/render.mjs final --endCard=live --icon=assets-icon`
(Kurzform: `npm run render:live`).

**Variante „live“:** Lege das offizielle Badge als
`promo/assets/app-store-badge.svg` ab. Fehlt die Datei, zeigt die Schlusskarte
stattdessen den Text „Jetzt im App Store“ – es bricht nichts.

## Aufbau

- `capture/` – Playwright-Aufnahme. `run.mjs` startet `expo start --web` mit
  einer Schein-Supabase-Adresse (`promo-mock.invalid`) und ohne `.env.local`.
  `mock-backend.mjs` beantwortet alle Supabase-Aufrufe aus dem Arbeitsspeicher
  und blockiert jede Anfrage, die nicht an localhost geht. `seed.mjs` spielt
  die Demo-Spieltage (Sepp, Vroni, Hias, Resi) über die echten Store-Aktionen
  der App ein; `entry.ts` ist der dafür nötige, nur hier genutzte Einstieg.
- `video/` – Remotion-Projekt. Farben kommen direkt aus `src/theme/colors.ts`,
  Farbsymbole aus `src/components/game/CardSuitIcon.tsx`, Schrift ist dieselbe
  Inter-Datei wie in der App. Szenenplan in `video/Root.tsx` (`TIMELINE`).
- `scripts/` – `prepare.mjs` (Eingaben zusammenstellen), `render.mjs`.
- `out/screenshots/` – Screenshots in 1290×2796 (iPhone 6,7"), auch für den
  App-Store-Eintrag verwendbar. `shots.json` enthält Tipp-Positionen.

## Raster

120 BPM, 30 fps: 1 Schlag = 15 Frames, 1 Takt = 60 Frames (2 s). Jeder
Szenenwechsel liegt auf einem Taktanfang, Schnitte innerhalb auf Schlägen.
Das Video hat keine Tonspur.
