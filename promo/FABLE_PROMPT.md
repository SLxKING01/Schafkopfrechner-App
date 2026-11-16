# Prompt für Fable – Werbevideo „Schafkopfrechner“

Erstelle ein Werbevideo für meine App **„Schafkopfrechner“** (Expo/React Native, dieses Repo).
Arbeite in **drei Phasen** und warte nach Phase 1 und Phase 2 jeweils auf meine Freigabe.

## Eckdaten
- **Einsatz:** Instagram/TikTok Reels
- **Format:** 9:16, 1080×1920, 30 fps, H.264-MP4
- **Länge:** 25–30 Sekunden
- **Ton:** Musik + Texteinblendungen, **kein Sprecher**. Das Video muss auch ohne Ton verständlich sein.
- **Musik:** `promo/assets/music.mp3` (lizenzfrei, von mir geliefert). Schnitte auf den Takt legen, am Ende ausblenden.
- **Stil:** modern, cleanes Design, **leicht bayerisch**. Hochdeutsch mit ein paar bayerischen Sprüchen, überall verständlich.
- **Farben und Schrift:** exakt wie in der App (`src/theme/colors.ts`, `src/theme/typography.ts`, Schrift Inter). Animationen dürfen sich an `src/theme/motion.ts` orientieren.
- **Kein Slogan vorhanden:** Schlag mir 5 Slogans vor.
- **Schluss:** App-Icon (`assets/icon.png`), Name „Schafkopfrechner“, offizielles **„Laden im App Store“-Badge** (nur App Store, kein Google Play). Badge liegt in `promo/assets/app-store-badge.svg`.

## Inhalt: drei Funktionen, in dieser Reihenfolge
1. **Runde schnell erfassen:** Spiel eintragen, Punkte und Tarife werden automatisch berechnet.
2. **Gemeinsame Tische:** Alle am Tisch sehen live denselben Stand.
3. **Statistiken:** Wer gewinnt am meisten, Spielrollen, Auswertungen.

Hintergrundinfos zu den Funktionen findest du in `docs/` (u. a. `erfassung-und-sicherung.md`, `gemeinsame-tische.md`, `statistik-spielrollen.md`).

## Einstieg (Hook, erste 2 Sekunden)
Schlag mir **3 verschiedene Hook-Ideen** vor. Ich wähle eine aus.

## Spielkarten
Verwende **nur** die Kartenbilder aus `promo/assets/cards/`. Lade keine Kartenbilder aus dem Internet und erfinde keine nach.

## App-Aufnahmen (machst du selbst)
- Starte die App als **Web-Version** (`npx expo start --web`) und erstelle die Screenshots bzw. kurzen Aufnahmen mit **Playwright** (iPhone-Viewport, z. B. 430×932 bei deviceScaleFactor 3).
- Nutze **Mock-Daten statt Supabase**, auch für „Gemeinsame Tische“. Vier Spieler mit realistischen Namen (z. B. Sepp, Vroni, Hias, Resi), eine laufende Runde mit Sauspiel, Wenz, Solo, Schneider und Laufenden, glaubwürdige Punktestände und Statistiken.
- Die Mock-Daten dürfen **den normalen App-Code nicht verändern**. Lege sie nur für die Aufnahmen an (eigener Ordner `promo/` bzw. ein Flag, das nur dort greift) und schicke **nichts davon** an einen echten Server.
- Keine Debug-Overlays, Fehlermeldungen oder Dev-Banner im Bild. Die Statusleiste zeigt 9:41 und vollen Akku (oder wird ausgeblendet).
- Zeige die Screens in einem schlichten, modernen **iPhone-Rahmen**.

## Technik
- Wähle das Werkzeug selbst (z. B. **Remotion**, passt zum React-Stack). Begründe die Wahl kurz.
- Alles liegt unter `promo/` und ist reproduzierbar: eine Anleitung bzw. ein Befehl erzeugt Screenshots und Video neu.
- **Instagram-Safe-Zones:** Keine wichtigen Texte in den oberen ~250 px, den unteren ~400 px und am rechten Rand (Buttons).
- Texte groß und kurz (max. ~6 Wörter pro Einblendung), jede mindestens 1,5 s sichtbar.

## Phasen
1. **Storyboard (noch kein Code):** Tabelle mit Szene, Dauer, Einblendetext, Bild/Asset und Animation. Dazu die 3 Hook-Ideen und 5 Slogan-Vorschläge. → **Warten auf Freigabe.**
2. **Aufnahmen und Entwurf:** Screenshots erzeugen, Video bauen, Standbilder jeder Szene plus ein Entwurfsrender in niedriger Auflösung zeigen. → **Warten auf Freigabe bzw. Korrekturen.**
3. **Final:** Render in 1080×1920 nach `promo/out/schafkopfrechner-reel.mp4`. Zusätzlich ein Coverbild (1080×1920) für Instagram.

Frag nach, wenn etwas unklar ist, statt zu raten.
