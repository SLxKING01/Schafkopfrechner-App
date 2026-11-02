# Abrechnung als Bild teilen – Issue #21

Stand: 01.11.2026. Lokal implementiert; noch nicht committed oder per PR integriert.

## Gestalterische Überarbeitung

Nach Nutzerfeedback wurde die Exportkarte kompakter gestaltet: feste Breite von 480 Layout-Einheiten (960 Pixel im PNG), Zahlungsplan vor den Salden, nach angezeigtem Empfänger gruppierte Zahlungen, Namen links und Beträge rechts. Bereits bezahlte Positionen erscheinen zurückhaltender; Erklärungen und Zeitstand stehen klein am Ende. Alle Beträge und vollständigen Namen bleiben enthalten. Das gespeicherte Bild wird in der Vorschau proportional auf die Bildschirmbreite verkleinert.

Die tatsächlichen PNGs für gemischten und vollständig bezahlten Status wurden visuell geprüft (Testfall: fünf Spieler, langer Tisch- und Spielername; 960 × 1598 Pixel). Download ohne Änderung am gespeicherten Spielstand bestätigt. Nach der Überarbeitung: 13 Exporttests bestanden, TypeScript und scoped ESLint erfolgreich. Beispiel: `output/playwright/settlement-redesign-open.png`; Vorschau: `output/playwright/settlement-redesign-preview.png`. Die folgenden ursprünglichen Messwerte dokumentieren die erste Version.

## Bedienung

In der abgeschlossenen Tischabrechnung öffnet „Abrechnung teilen“ eine Vollbildvorschau. Die App rendert eine eigene Exportkarte, erzeugt daraus ein PNG und zeigt genau dieses Bild zur Prüfung an. Auf iOS/Android öffnet „Bild teilen“ das systemweite Teilen-Menü. Im Web bietet „Bild herunterladen“ einen PNG-Download, unabhängig von Web-Share-Unterstützung. Ohne abgeschlossenen und zugänglichen Tisch wird keine Exportaktion angeboten.

Die Vorschau hat einen scrollbaren Bildbereich und dauerhaft erreichbare Aktionen. Schließen, Download oder Abbruch des nativen Teilen-Menüs ändern weder Zahlungen noch Spielstände. Eine während der Vorschau veränderte Abrechnung macht diese ungültig; sie muss erneut geöffnet werden.

## Inhalt und Darstellung

- Tischname, Abschlusszeit soweit vorhanden und Erstellungsstand einschließlich Sekunden und Zeitzone.
- Alle Teilnehmer, einschließlich pausierter Spieler, mit vorzeichenbehafteten Endsalden. Die Salden entsprechen der bestehenden Abrechnung: nach Zwischenzahlungen, vor Abschlusszahlungen. Dieser Bezug wird ausdrücklich erklärt.
- Gespeicherter Zahlungsplan mit Zahler, Empfänger und Centbetrag. Der Export berechnet keinen neuen Plan.
- Offene Zahlungen und als bezahlt markierte Zahlungen sind getrennt. Bereits bezahlte Positionen tragen „nicht erneut zahlen“ und werden nicht erneut als offen gefordert.
- Nicht stornierte Zwischenzahlungen werden gesondert aufgeführt. Ohne offene Positionen erscheint „Keine Zahlungen offen“ beziehungsweise „Keine weiteren Zahlungen nötig“.
- Hinweis auf die unveränderliche Momentaufnahme. Spätere Änderungen aktualisieren bereits geteilte Bilder nicht.
- Keine technischen IDs, Tischcodes, Account-Zuordnungen oder sonstigen Profilfelder im Exportmodell. Angezeigte Spielernamen werden vollständig übernommen.

Die Grün-Gold-Karte verwendet gemeinsame Farben und Abstände. Namen, Titel und Zahlungen können mehrzeilig umbrechen; die Höhe wächst mit dem Inhalt. Erfasst wird die vollständige Exportansicht, nicht der sichtbare Bildschirm. PNG-Ausgabe in doppelter Layoutauflösung. Für Screenreader enthält das fertige Vorschaubild eine Textbeschreibung der Salden und Zahlungspositionen.

## Technischer Aufbau

- `src/utils/settlementExport.ts`: reine Projektion und Validierung der benötigten Daten, Formatierung und Accessibility-Beschreibung.
- `src/components/game/SettlementExportCard.tsx`: vollständiges, nicht virtualisiertes Bildlayout.
- `src/components/game/SettlementShare.tsx`: Vorschau, Lade-/Fehlerzustände, erneute Versuche, Veraltungsschutz und Sperre gegen doppelte Share-Aufrufe.
- `src/services/game/settlementImage.ts`: native PNG-Erfassung mit `react-native-view-shot`, Freigabe temporärer Dateien und natives Teilen mit `expo-sharing`.
- `src/services/game/settlementImage.web.ts`: PNG über `html2canvas-pro` nach geladenen Schriftdateien und anschließender Browserdownload.
- Einstieg in `src/screens/app/SettlementScreen.tsx`.

Die neuen nativen Pakete wurden über `expo install` passend zu SDK 58 installiert. Die Web-Abhängigkeit ist auf `html2canvas-pro@2.4.4` festgelegt, damit auch die im Projekt erlaubte Node-22-Version unterstützt bleibt. Es werden keine Share-Extensions zum Empfang fremder Inhalte aktiviert und keine Foto-/Medienberechtigungen angefordert.

Fehler beim Erzeugen erlauben erneutes Erstellen. Fehler oder fehlende native Share-Unterstützung werden in der Vorschau angezeigt. Beim Schließen wird eine temporäre Aufnahme freigegeben; auch eine nachträglich fertig werdende Aufnahme einer bereits geschlossenen Vorschau wird verworfen und freigegeben.

## Validierung

- 49 gezielte Tests in sechs Suiten bestanden: Exportmodell, native Service-Aufrufe, Vorschau, bestehende Tischabrechnung, Archiv und Zwischenzahlungen.
- Prüfungen umfassen Trennung bezahlt/offen, stornierte Zwischenzahlungen, vollständige Namen, Centbeträge, ausgeschlossene private Felder, unvollständige Daten, aktive Tische, Erstellungs-/Share-Fehler mit Retry, Veraltung der Vorschau, Doppeltippen und Bereinigung nach Schließen.
- TypeScript und ESLint der betroffenen Dateien sowie Diff-Prüfung erfolgreich.
- iOS-Produktions-JavaScript-Bundle mit `expo export --platform ios` erfolgreich erstellt (3520 Module). Dies ist keine Installation oder native Geräteabnahme.
- Echter Browserdurchlauf im isolierten lokalen Gastprofil: Testtisch mit fünf Spielern und langem Namen angelegt, Solo gespeichert, Tisch abgeschlossen, eine Zahlung als bezahlt markiert, vollständiges PNG heruntergeladen. Der gespeicherte Zustand vor/nach Download war identisch.
- Bei 320 × 568: gemischter Zahlungsstatus, heruntergeladenes Bild 546 × 2582 Pixel. Bei 393 × 852: alle Zahlungen bezahlt, Bild 692 × 2536 Pixel. Beide tatsächlichen Dateien visuell geprüft: Namen, Endsalden, Zahlungspositionen und Schlussvermerk vollständig.
- Artefakte: `output/playwright/settlement-export-320.png`, `settlement-export-paid-393.png`, `settlement-preview-393.png`. Diese lokalen QA-Dateien sind nicht automatisch veröffentlicht.
- Nach Festlegung auf `html2canvas-pro@2.4.4` den Webserver mit frischem Cache gestartet und Vorschau sowie PNG-Download des vollständig bezahlten Tisches erneut erfolgreich geprüft.

## Offene Abnahme und Abgrenzung

Das native Teilen-Menü, native View-Erfassung und VoiceOver/TalkBack benötigen eine Prüfung auf echten iOS-/Android-Geräten. Automatisierte Service-Mocks und Browserprüfungen ersetzen sie nicht. Bei vorhandenen Development-Clients ohne die neuen nativen Module ist ein passender neuer Development-Build erforderlich; Expo Go führt beide Pakete laut SDK-58-Dokumentation mit.

Der bestehende Datenstand kennt nur `isPaid`, noch keine separate Meldung und Empfängerbestätigung aus #13 oder Korrekturversionen aus #18. Diese späteren Zustände werden nicht vorgetäuscht. Die erste Version exportiert den vorhandenen Plan, dessen Status und einen Zeitstand. Künftige gemeinsame Tischrechte bleiben Aufgabe der entsprechenden Folge-Issues; der Export erweitert den bestehenden Lesezugriff nicht.

Kein PDF, kein kompletter Spielverlauf, keine automatische Nachricht an andere Personen, keine Änderung von Zahlungen und kein automatisches Schließen des GitHub-Issues.
