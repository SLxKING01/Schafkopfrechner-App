# Mobile Usability – Korrekturen und Prüfung vom 25.10.2026

Bestehender Draft-PR: [#1](https://github.com/SLxKING01/Schafkopfrechner-App/pull/1), Branch `fix/mobile-usability`, Ziel `master`. Die vorbereiteten Korrekturen wurden geprüft und ergänzt. Uncommittete Änderungen im ursprünglichen Arbeitsverzeichnis bleiben unverändert; die Arbeit liegt im separaten Worktree `Schafkopfrechner-mobile-fix`.

## Korrekturen

- **Spieler und Forderungen:** Beteiligte Offline-Spieler sind gegen Löschen geschützt; die Ansicht erklärt den Grund. Neue Spiele sichern zusätzlich Namen. Fehlende Verzeichniseinträge entfernen keine Forderungen. Gesicherte Namen werden verwendet; nicht rekonstruierbare Namen heißen „Name unbekannt“ mit ID. Beschädigte moderne Salden mit fehlenden Teilnehmern oder einer von null abweichenden Cent-Summe werden aus gespeicherten Runden repariert. Ausgeglichene historische Ergebnisse werden nicht neu interpretiert.
- **Tischwechsel:** Spieler, Runden, Salden und Zahlungsstatus werden archiviert. Neuer Tisch und Zurücksetzen warten auf einen erfolgreichen lokalen Speicher-Checkpoint. Bei Fehler bleibt der alte Tisch aktiv; die sichtbare Meldung erlaubt erneutes Speichern. Schreibvorgänge laufen nacheinander, doppelte Wechsel sind blockiert. Ein veraltetes sekundäres Backup überschreibt den Hauptspeicher nicht. Nicht lesbare Hauptspeicherstände werden nicht durch leere Daten ersetzt. Das Archiv ist im Dashboard und in der Abrechnung erreichbar. Archivzahlungen ändern den aktuellen Tisch nicht. Ungültige Archivverweise öffnen keinen anderen Tisch.
- **Mobile Bedienung:** Offline-Übersicht, Spieltagsdetails, Spieleransicht und Abschluss besitzen einen gemeinsamen vertikalen Scrollfluss. Der Rundendialog passt sich der Fenstergröße an. Lange Namen und vergrößerte Titel umbrechen, Speichern bleibt erreichbar. Dekorative Hintergründe erzeugen keine horizontale Dokumentüberbreite. Native Tastaturvermeidung wurde angepasst; die native Abnahme bleibt offen.
- **Echte Daten:** Beispieltische, erfundene Spiele/Zahlungen und persönliche Erfolgsquoten sind entfernt. Statistiken nutzen gespeicherte Runden, Abrechnungsaktionen öffnen die echte Abrechnung. Der Status benennt lokale Speicherung und Fehler. Cloud-Platzhalter melden keinen erfundenen Erfolg mehr. **Dieser PR implementiert keine Cloud-Synchronisation.** Die separaten lokalen Supabase-Änderungen im ursprünglichen Arbeitsverzeichnis wurden nicht übernommen oder überschrieben.
- **Zwei Gewinner:** Neue Rufspiel-/Sauspiel-Einträge benötigen zwei Gewinner und zwei Verlierer. Verlauf, Bearbeitung und Statistik berücksichtigen beide. Unbekannte/doppelte IDs und Überschneidungen werden abgewiesen. Der Betrag ist der gesamte Transfer zwischen den Parteien; eine Vorschau zeigt individuelle Cent-Anteile. Moderne Bearbeitung aktualisiert dieselbe Runde und bewahrt deren Einstellungsstand. Alte Ein-Gewinner-Einträge behalten bei unveränderten Parteien ihre Bedeutung; kein Partner wird geraten. Die bestehende Cent-Verteilungsreihenfolge beider Datenmodelle bleibt erhalten.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `npm test -- --runInBand` | 45 Tests, 10 Suites erfolgreich |
| `npx tsc --noEmit` | erfolgreich |
| `npm run lint` | erfolgreich |
| `node node_modules/expo/bin/cli export --platform web --output-dir dist/mobile-acceptance` | erfolgreich |
| Edge mit Playwright, Touch-/Mobil-Emulation | erfolgreich; [Browserprotokoll](acceptance-2026-10-25/browser-results.json) |

Regressionstests prüfen referenzierte Spieler, beschädigte Teilnehmerdaten, Namenssicherung, Cent-Summen, Zwei-Gewinner-Berechnung und Statistik, alte Einträge, ungültige Parteien, fehlgeschlagene/doppelte Tischwechsel, veraltete Backups, nicht lesbare Daten, Archiv nach Neuladen und getrennte Archivzahlungen.

Der Browserdurchlauf bedient beide Oberflächen durch UI-Klicks: acht Spieler mit langen Namen, zwölf moderne Runden, Bearbeitung derselben Runde, zwei Gewinner, Abschluss, simulierter Speicherfehler mit blockiertem Wechsel, erfolgreicher Wechsel und Neuladen, Archiv und isolierte Archivzahlung. Offline werden Rufspiel-Erfassung/Bearbeitung, gesperrtes Löschen, Abschluss und Historie geprüft. Breiten 360/390/430 bei Höhe 568 haben keine horizontale Dokumentüberbreite. Zusätzlich geprüft: 200 % Schrift im Dialog/Archiv und reduzierte Höhe 390 × 360.

## Screenshots

- [Betrag und Cent-Anteile](acceptance-2026-10-25/party-preview-390x568.png)
- [Bearbeitung mit 200 % Schrift](acceptance-2026-10-25/modern-input-text-200-percent.png)
- [Verlauf unten bei 390 × 568](acceptance-2026-10-25/modern-history-bottom-390x568.png)
- [Löschsperre mit Erklärung](acceptance-2026-10-25/offline-referenced-player-delete-blocked.png)
- [Speicherfehler verhindert Wechsel](acceptance-2026-10-25/storage-failure-prevents-switch.png)
- [Archiv nach Neuladen](acceptance-2026-10-25/archive-restored-after-reload.png)
- [Archiv mit 200 % Schrift](acceptance-2026-10-25/archive-text-200-percent.png)
- [Beide Gewinner in der Historie](acceptance-2026-10-25/offline-history-both-winners.png)

Vorher-Belege stehen im [ursprünglichen Audit](AUDIT.md).

## Wiederholen und offene Abnahme

[Automatisierter Ablauf](../../scripts/mobile-acceptance.cjs): installiertes Microsoft Edge mit `playwright-core` 1.64.1, kein Chromium-Download. Frische isolierte Browserumgebung mit synthetischer lokaler Testsitzung; alle externen Anfragen sind blockiert. Echter Login und Cloud-Speicherung sind damit nicht geprüft.

Mit installierten Projektabhängigkeiten ausschließlich im Test-Checkout `.env.local` mit `EXPO_PUBLIC_SUPABASE_URL=https://audit.invalid` und `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_audit_only` anlegen. `node node_modules/expo/bin/cli start --web --port 8083 --localhost` starten. In einer zweiten PowerShell `PLAYWRIGHT_CORE` auf den absoluten Pfad einer installierten `playwright-core`-Bibliothek setzen und `node scripts/mobile-acceptance.cjs` ausführen. Optional überschreiben `MOBILE_TEST_URL` und `MOBILE_BROWSER_PATH` Adresse und Browserpfad. Es werden ausschließlich eigene lokale Testdaten verwendet.

**Noch offen:** echte iOS-/Android-Abnahme mit Bildschirmtastatur, System-Schriftvergrößerung, Hintergrund/Vordergrund und Neustart des nativen Prozesses. Hier waren weder Android-Emulator noch `adb` verfügbar. Reduzierte Browserhöhe und CSS-Schriftvergrößerung simulieren Platzbedarf, keine native Tastatur oder Systemskalierung. Daher wird keine vollständige native Abnahme behauptet.

Kein Merge, keine Produktionsbereitstellung und keine Änderung an der produktiven Datenbank.
