# Reduziertes Dashboard

Umgesetzt nach dem freigegebenen Mockup ohne umrahmte Tischkarte.

- Kompakte persönliche Gesamtbilanz, Anzahl beteiligter Spiele und Gewinnquote. Keine allgemeinen Zählerwand, Schnellzugriffskacheln oder Liste letzter Einzelspiele.
- Aktiver Tisch direkt auf dem grünen Hintergrund mit Rundenzahl, zugeordnetem persönlichem Spielstand und kompakter, matter goldener Weiterspielen-Aktion.
- Offene Abrechnungen zählen eindeutige abgeschlossene Tische, nicht einzelne Überweisungen. Ein Tisch öffnet direkt seine Abrechnung, mehrere öffnen eine kompakte Auswahl. Bei null offenen Abrechnungen entfällt der Abschnitt.
- Profil-Avatar öffnet das Profil. Der dekorative Benachrichtigungsbutton und Online-Punkt sind entfernt. Neuer Tisch respektiert den vorhandenen aktiven Tisch und zeigt einen auch auf Web funktionierenden Hinweis statt einen nicht umsetzbaren zweiten Tisch anzulegen.

## Persönliche Zuordnung

Verifizierte userId am Tisch wird automatisch verwendet. Neue eigene Kontoplätze beim Erstellen eines Tisches speichern diese ID. Namen oder Freund-Vorschau-IDs werden nicht als Identitätsnachweis verwendet.

Für Gäste und ältere lokale Tische wählt der Nutzer pro Tisch ausdrücklich einen eigenen Spieler. Zuordnungen werden auf dem Gerät in schafkopfrechner-dashboard-identity gespeichert und nach Gast / Konto getrennt. Sie verändern keine Rundenergebnisse und werden nicht als Cloud-Spielstand gespeichert. Keine Zuordnung bedeutet unbekannt (Strich), nicht vermeintlich null. Eine leere Installation ohne gespeicherte Tische kann echte Nullwerte zeigen.

Die Statistik bietet dieselbe explizit zusammengefasste Identität als Meine Gesamtstatistik an. So stimmen Dashboard und Spielerstatistik auch bei mehreren lokal zugeordneten Tischen überein.

Spielbilanz und Tisch-Spielstand basieren auf den reinen centgenauen Spielergebnissen der bestehenden Statistikauswertung: Stockbewegungen, ausgezahlter Stockanteil und tatsächliche Zahlungen verändern diese Werte nicht. Aktive / archivierte Kopien werden bereits in buildGameOverview dedupliziert. Nachträgliche Korrekturen aktualisieren denselben Eintrag.

## Verifikation

36 Testsuiten / 280 Tests bestanden; TypeScript und ESLint geprüft. Abgedeckt: unbekannte Identität, explizite Mehrtisch-Zuordnung, verifizierte Konto-Zuordnung, Konto-/Gast-Wechsel, alte lokale Spieltage, Stockausschluss, Korrekturen, Archivierung, Zahlungsstatus, Zählung offener Tische sowie Übereinstimmung mit persönlicher Statistik.

Browserprüfung bei 393 und 320 Pixel Breite mit bereits vorhandenem lokalen Gast-Prüftisch. Zuordnung über die UI ausgewählt und nach Neuladen wiederhergestellt. Keine Cloud-Daten geändert. Große Schrift erhält einen vertikalen Kennzahlenaufbau; physischer iPhone-/VoiceOver-Test steht aus.

Screenshots: test-results/dashboard-minimal-393.png und test-results/dashboard-minimal-320.png.
