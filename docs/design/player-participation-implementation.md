# Spieler pausieren und zu fünft spielen – Issue #16

Spielername gedrückt halten oder Tischmenü → Spieleraktionen öffnen. Das kompakte Menü bleibt mittig. Aktive Spieler lassen sich pausieren oder als Geber auswählen, pausierte Spieler wieder aktivieren. „Pausiert“ und eine gedämpfte Darstellung kennzeichnen die Pause; Sitz und Saldo bleiben erhalten.

Bei fünf aktiven Spielern setzt der Geber aus. Bei vier spielt er mit. Die vier Teilnehmer stehen über der Spielerliste und in der Eingabe. Aussetzende Spieler können nicht als Ansager, Partner oder Klopfer gewählt werden. Unter vier aktiven Spielern sind neue normale Spiele gesperrt; eigene Ausgleichseinträge und die gemeinsame Abrechnung bleiben möglich. Höchstens fünf aktive Spieler sind erlaubt.

## Speicherung und Korrektur

- Optionales `Player.isPaused`: Ohne Feld bleibt ein Spieler aktiv.
- Neue Spiele speichern `participantIds`, `seatOrderIds` und `roundContext.dealerIdBefore`. Historische Beträge werden anhand dieser IDs berechnet. Ältere Einträge ohne Snapshot bleiben lesbar und bearbeitbar.
- Die Geberrotation überspringt Pausierte. Pausieren des Gebers wählt den nächsten aktiven Sitz. Bearbeiten, Laden, eigene Ausgleichsbuchungen und „Alle weiter“ drehen nicht weiter.
- Offene Eingaben behalten ihre ursprünglichen Teilnehmer. Vor dem Speichern werden Tisch, Geber, Sitzordnung, Pausenstatus und Rundenzahl geprüft. Änderungen verlangen erneutes Öffnen. Die bestehende lokale Speicherbestätigung verhindert doppelte Buchungen bei Schreib-Retries.
- Besetzungswechsel entfernen nicht mehr zulässige ausstehende Leger. Frühere Buchungen bleiben erhalten.
- Spieler mit historischen Teilnehmer- oder Sitzordnungsreferenzen lassen sich nicht löschen. Neue Teilnehmer erhalten eine eigene ID und einen Saldo von null. Geteilte Einladungen folgen #8.
- Rückgängigmachen stellt den früheren Geberkontext wieder her. Ist dieser Spieler inzwischen pausiert, folgt der nächste aktive Sitz. Historische Besetzungen anderer Runden bleiben unverändert. Nachträgliches Einfügen früherer Runden ist keine vorhandene Funktion.

## Stock und Abschluss

„Alle weiter“ belastet genau die vier Teilnehmer. Geber und gesetzte Leger bleiben erhalten. Der Reststock wird beim gemeinsamen Abschluss ausschließlich auf die dann aktiven Spieler verteilt, einschließlich des regulär aussetzenden Gebers. Die Empfänger-IDs stehen dauerhaft in der Abschlussbuchung. Centreste werden deterministisch nach ID-Reihenfolge verteilt. Ohne aktive Empfänger bleibt der Abschluss gesperrt und die Oberfläche fordert eine Reaktivierung.

## Prüfung und verbleibende Integrationen

Tests decken Vierer-/Fünferrunde, Rotation, Pausen, Reaktivierung, Rollen und Leger, offene Eingaben, Korrektur/Undo, Eigenbuchungen, Teilnehmergrenze, neue Salden, Stock und Centreste sowie Neustart und Cloud-Snapshot-Vertrag ab. UI-Tests prüfen Menü und Teilnehmerauswahl. Browser-Vorschau bei 320 Pixeln Breite.

Abschließender Stand: 39 Testsuiten mit 354 erfolgreichen Tests, TypeScript und ESLint für alle betroffenen Dateien ohne Fehler. Im Browser einen Tisch mit fünf Spielern erstellt, den Geber Simon pausiert, mit den vier übrigen Spielern ein Solo gespeichert und anschließend neu geladen: Pause, Salden, vier Rundenteilnehmer, Sitzordnung und neuer Geber Flo blieben erhalten. Keine Browserfehler; drei vorhandene Modulzyklus-Warnungen. Screenshots: `output/playwright/player-participation-menu-320.png` und `output/playwright/player-paused-table-320.png`.

Native iPhone-Bedienung, VoiceOver und ein echter Cloud-Rundlauf wurden nicht durchgeführt. Gemeinsame Tischberechtigungen und parallele Mehrgeräte-Eingaben folgen #8/#9. Exklusive Auswahl Stock/Ramsch und automatische Sauspiel-Stockbewegungen folgen #7.
