# Designsystem-Prüfung – 28.10.2026

## Ergebnis und Umfang

Geprüft wurden 134 TypeScript-Dateien außerhalb von Tests und Theme. Die App verwendet React Native StyleSheet ohne zusätzliche Styling-Bibliothek. Ausgangspunkt waren zwei widersprüchliche Themes: Grün/Gold in src/theme und Hell/Blau in src/constants/theme.ts. AppText, die Basis-Komponenten und Lade-/Fehleransichten bezogen noch das helle Theme.

Die erste Migration umfasst die gemeinsame Theme-Grundlage, AppText, AppButton, AppCard, AppSection, GoldButton und die vollständigen Stilvorgaben der Rundeneingabe. Das vom Nutzer bestätigte Grün/Gold-Design bleibt maßgeblich. Vorhandene Spielabläufe, Navigation und Speicherung wurden nicht umgebaut. Weitere Bildschirme werden nach dem inkrementellen Verfahren getrennt migriert.

## Messung

| Kategorie                              | Vorher: Zeilen mit Treffern | Nachher | Treffer je 100 Quellzeilen vorher → nachher |
| -------------------------------------- | --------------------------: | ------: | ------------------------------------------: |
| Hex-Farbwerte außerhalb des Themes     |                         215 |     202 |                                 1.02 → 0.95 |
| Direkt gesetzte Schriftgrößen          |                         134 |     125 |                                 0.64 → 0.59 |
| Direkt gesetzte Rundungen              |                          90 |      77 |                                 0.43 → 0.36 |
| Legacy-Schatteneigenschaften           |                         184 |     174 |                                 0.88 → 0.82 |
| Abstände außerhalb der benannten Skala |                          72 |      49 |                                 0.34 → 0.23 |

Vorher: 21004, nachher: 21177 Quellzeilen einschließlich Leerzeilen. Es handelt sich um Suchkandidaten, nicht automatisch um bestätigte Fehler. Illustrationen, individuelle Profilfarben und lokale geometrische Werte können bewusst abweichen. Die Rundung 0 eines segmentierten Reglers ist eine absichtliche Ausnahme. Die Abstandsskala wurde um den bereits häufigen 20-Punkt-Schritt erweitert; der Abstandswert ist deshalb nun Teil der Skala.

## Umgesetzt

- Ein zentraler Einstieg: src/theme/index.ts. Das alte src/constants/theme.ts enthält nur einen Kompatibilitäts-Reexport; seine hellen/blauen Werte wurden entfernt.
- Bestehende Namen authColors/authSpacing/authRadius bleiben erhalten. Ältere Screens greifen über die gleichen Werte auf das aktuelle Theme zu.
- Gemeinsame Textstile für Titel, Fließtext, Hinweise, Spieler, Regler und Beträge. Zahlen nutzen tabellarische Ziffern. AppText reicht native TextProps einschließlich selectable, numberOfLines und Accessibility-Eigenschaften weiter; systemweite Schriftvergrößerung wird nicht deaktiviert.
- Benannte Farben für Oberflächen, Auswahl, Regler, Trenner und Overlay; benannte Kontrollgrößen und gemeinsame Interaktionszustände.
- Die Rundeneingabe verwendet die zentralen Tokens für Farben, Schriftgrößen, Abstände und Rundungen. Stärkere Hierarchie entsteht durch kleine Zeilenabstände und größere Gruppierung; alle bestehenden Funktionen bleiben erreichbar.
- Vorhandene Eingabe-Schaltflächen haben Pressed-Rückmeldung; deaktivierte Controls werden zusätzlich optisch abgeschwächt.
- AppButton hat klare primary/secondary/danger-Varianten, einen stabilen zugänglichen Namen und disabled/busy/loading-Zustände. Ein Loading-Zustand sperrt die Betätigung. Layout-Overrides werden zuletzt angewandt.
- AppCard nimmt Inhalte als children entgegen und verwendet die gemeinsamen Flächen, Rundungen und Schatten. Für wiederverwendete Karten und Goldbuttons sind boxShadow-Stufen zentral hinterlegt.

## Komponentenvertrag

| Komponente | Varianten / Größe                                     | Zustände                               | Accessibility / Overrides                                          |
| ---------- | ----------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------ |
| AppText    | Benannte Textvarianten; Standard body                 | Native Text-Skalierung                 | TextProps werden durchgereicht; style zuletzt                      |
| AppButton  | primary / secondary / danger; gemeinsame Touch-Größe  | default / pressed / disabled / loading | button, Label, disabled/busy; style zuletzt                        |
| GoldButton | Bestehende primäre Goldaktion; gemeinsame Mindesthöhe | default / pressed / disabled / loading | Name bleibt beim Laden erhalten; vorhandene Press-Animation bleibt |
| AppCard    | Inhalt per children; feste Designidentität            | Nicht interaktiv                       | style zuletzt; keine künstliche Button-Rolle                       |
| AppSection | Titel plus children; zentrale Abstände                | Nicht interaktiv                       | Gemeinsame Titel-Typografie; style zuletzt                         |

## Verifikation

- Gesamte Jest-Suite: 30 Suites / 236 Tests erfolgreich. Darin sind unter anderem Speicherung, Fehler/Wiederholung beim Speichern, Rundenkorrektur, Klopfen und Kontra/Re abgedeckt.
- TypeScript und ESLint für die geänderten Dateien erfolgreich.
- Gerenderte Webansichten bei 393 × 852 und 375 × 812 geprüft: Namen, Münzen, Auswahl, gruppierte Optionen und feststehender Speicherknopf sind erreichbar. Klopfen verdoppelt den Tarif, Rücknahme stellt ihn wieder her. Entwurf anschließend verworfen; keine neue Runde gespeichert.
- Dashboard und Tischübersicht im Browser geöffnet; Dashboard nach Ende der Einblendung auf Lesbarkeit und gemeinsame Farben geprüft.
- Native iOS-/Android-Gesten, echte Dynamic-Type-Systemeinstellungen und native Tastatur sind in dieser Windows-Umgebung nicht geprüft.

## Verbleibende Schritte

1. ActiveGameScreen hat die meisten verbliebenen Stilwerte (u. a. 41 Farb- und 39 Schriftgrößen-Treffer). Als nächste einzelne Bildschirmmigration vorgesehen.
2. Danach GameLobbyScreen und CreateTableScreen; insbesondere Schatten, Bildschirminsets und eigene Farbtöne abgleichen.
3. AnimalAvatar und Profilpaletten gesondert als Illustrations-/Personalisierungsfarben bewerten. Nicht pauschal durch Markenfarben ersetzen.
4. Erst nach Geräteprüfung Änderungen an Navigation, Sheets, Tab-Leiste oder nativen Bedienelementen planen. Das vorhandene bestätigte Layout bleibt erhalten.

## Wiederholbare Prüfung

Im Projektverzeichnis ausführen:

```powershell
node scripts/audit-design-system.cjs
```

Die Messdaten sind als design-system-baseline-2026-10-28.json und design-system-after-2026-10-28.json abgelegt.

## Screenshots

- [Rundeneingabe 393](../../test-results/design-system-round-entry-393.png)
- [Optionen 375](../../test-results/design-system-options-375.png)
- [Dashboard 375](../../test-results/design-system-dashboard-375.png)
