# Integration von Karls Main und Master

Stand 02.11.2026. Quellen: Main `3b76f49`, Master `1bd22e2`.
Branch: `codex/integrate-karl-main`.

## Abgestimmtes Verhalten

- Karls Dashboard: Kartenmuster, reduzierte Inhalte, persönliche Daten über
  zugeordnete Konten. Der zusätzliche Bereich „Laufender Tisch“ entfällt.
  Andere Ansichten behalten den ruhigen Hintergrund aus Master.
- Einstieg über einen Spielernamen wählt ihn als Spielmacher und zunächst als
  Gewinner vor; bei Ramsch als Verlierer. Das Ergebnis ist änderbar. Der
  Spielmacher ist bei diesem Einstieg festgelegt, bei Korrekturen änderbar.
- Neue Tarife gelten nach ausdrücklicher Wahl „Ab jetzt“ oder „Auch bisherige
  Spiele“. Der Dialog ist auch im Web bedienbar; Abbrechen ändert nichts.
- Kurzer Tipp auf den Namen: Eingabe. Gedrückthalten: Geber/Pause. Münze:
  Klopfen. Eigener Ziehgriff: Sitzordnung. Während des Ziehens sind die anderen
  Aktionen gesperrt. Das Listensymbol mit Pfeiltasten bleibt als Alternative.
  Umsortieren verändert nicht die Identität des aktuellen Gebers.

## Erhaltene Daten und Funktionen

Stock/Ramsch-Ausschluss, Fünferrunde, Pausen, Zwischenzahlungen, Bildexport,
Änderungsverlauf, Wiederherstellung und lokale Speicherbestätigung bleiben
erhalten. Geöffnete Korrekturen erkennen inzwischen geänderte Runden.

Rückwirkende Tarife ändern Preise in den historischen Snapshots, nicht die
damaligen Spielentscheidungen oder aktivierten Spielarten. Manuelle Beträge
bleiben unverändert. Stockbewegungen werden chronologisch neu berechnet;
ungültige Regelgrenzen führen zur atomaren Ablehnung. Tatsächlich geleistete
Zahlungen bleiben erhalten. Betroffene Runden bekommen Änderungsereignisse.

Karls gemeinsame Tisch-Snapshots enthalten auch Zahlungsjournal und Historie.
Versionskonflikte und Konfliktsicherungen bleiben erhalten. Die vorhandenen
Supabase-Migrationen werden übernommen, hier nicht erneut ausgeführt.
React Native folgt Main mit 0.88.1; Lockfile-Installation und bestehender
DraggableFlatList-Patch sind erfolgreich durchgelaufen.

## Prüfung

- 46 Jest-Suiten / 429 Tests bestanden: beide Tarifoptionen, kombinierte
  Spieleraktionen, Stock-Neuberechnung mit bestehenden Zahlungen und simulierter
  Accountwechsel einschließlich Protokoll und Wiederherstellung.
- Nach reiner Textkorrektur des Stock-Tarifhinweises: fünf Einstellungstests
  zusätzlich bestanden. TypeScript und scoped ESLint bestanden.
- Vier bestehende Lint-Fehler bleiben in den unveränderten Profilkomponenten
  AccentColorPicker und AvatarGridItem (Reanimated-Immutability).
- Browser mit künstlichem Gasttisch: Ziehen verändert gespeicherte Reihenfolge
  ohne zusätzliche Runde oder Geberwechsel; Gedrückthalten öffnet nur das
  Aktionsmenü. Kurzer Tipp wählt den Spieler mit gewonnenem Wenz vor.
- Tarifwahl rückwirkend im Browser durchlaufen. Ein bestehender Wenz mit zwei
  Laufenden wechselt von 0,70 € auf 0,80 € pro Spieler; eine Runde und deren
  Identität bleiben erhalten, der Änderungsverlauf erhält eine Korrektur.
- iOS-Produktions-JavaScript-Bundle erfolgreich exportiert. Dies ist kein
  nativer Gerätebuild oder Test mit tatsächlichen Touch-Gesten.

Screenshots und Berichte: lokal unter `output/playwright` und `output/qa`.
Keine neue Live-Cloud-Mehrgeräteprüfung, kein VoiceOver-/TalkBack-Test und keine
Prüfung mit maximaler Systemschrift auf einem physischen Gerät.
