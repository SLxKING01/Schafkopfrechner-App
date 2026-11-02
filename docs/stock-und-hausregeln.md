# Stock und Hausregeln

## Bedienung

- Unter „Regeln & Tarife“ die Spielarten, Einsätze und globalen Bonuspreise festlegen. Für „Wenn alle weiter sagen“ exklusiv Stock, Ramsch oder „Beides aus“ wählen. Ein Wechsel ist nur bei leerem Stock möglich.
- Unter „Hausregeln je Spielart“ erlaubte Boni sowie Mindest- und Maximallaufende konfigurieren. Bei Ramsch können Jungfrauen und Durchmarsch ausgeschaltet werden.
- „Stock“ bucht den konfigurierten Einsatz einmal für jeden der vier tatsächlichen Rundenteilnehmer. Bei fünf aktiven Spielern zahlt der aussetzende Geber nicht mit. Nach „Alle weiter“ teilt derselbe Geber erneut aus; gesetzte Leger bleiben erhalten. Spielboni und Multiplikatoren verändern diese Einzahlung nicht.
- Beim Rufspiel Ansager und Partner wählen, anschließend das Ergebnis: Bei neuen Spielen erhält die gewinnende ansagende Partei automatisch den gesamten Stock. Verliert sie, zahlen die beiden zusammen den bisherigen Stock zusätzlich ein und verdoppeln ihn. Die normale Spielabrechnung bleibt bestehen. Andere Spielarten verändern den Stock nicht. Historische manuelle Stockbuchungen behalten ihre Bedeutung.
- Beim Abschluss mit Rest-Stock entweder unter den dann aktiven Spielern verteilen (einschließlich des regulär aussetzenden Gebers, ohne manuell pausierte Spieler) oder auf einen automatisch erstellten Folgetisch mit denselben Spielern übernehmen. Die Übernahme wird in beiden Spieltagen gebucht. Sie ist keine weitere Bareinzahlung. Die anfängliche Übernahmebuchung kann nicht einzeln gelöscht oder geändert werden.
- Stock-Buchungen bleiben im Verlauf sichtbar, zählen aber nicht als gespielte Spiele, Siege, Niederlagen oder Lieblingsspielart.

## Neue Tische und historische Daten

Neue Tische verwenden spielabhängige Vorschläge. Rufspiel startet ab drei Laufenden mit einer Obergrenze von 14, Solo ab drei bis acht, Wenz und Geier ab zwei bis vier, Farbwenz und Farbgeier ab drei bis acht. Die Grenzen können für Hausregeln angepasst werden. Bettel und Ramsch haben zunächst keine Laufenden-, Schneider- oder Schwarz-Zuschläge. Global aktivierte Leger und Stöße gelten nur, wenn sie auch für die jeweilige Spielart erlaubt sind.

Historische Rundeneinträge behalten ihre Tarif-Snapshots. Ein Snapshot ohne spielabhängige Regeln wird weiterhin nach der früheren Berechnung ausgewertet. Bestehende Tische können ihre Hausregeln ausdrücklich über den Editor ergänzen; ältere Runden werden dabei nicht neu bepreist.

Ramsch wird als Festtarif gespielt: Der Spieler mit den höchsten Augen zahlt an die drei anderen. Jede ausgewählte Jungfrau verdoppelt den Tarif. Beim Durchmarsch gewinnt ein Spieler gegen drei; ein zusätzlicher Jungfrauenfaktor wird dann nicht angewendet. Bettel verwendet den konfigurierten Festtarif gegen drei Spieler; das Ergebnis wird anhand der tatsächlichen Stiche gewählt.

Die Vorschläge orientieren sich für Rufspiel, Solo, Wenz und Farbwenz an den [Erläuterungen der Schafkopfschule](https://schafkopfschule.de/fragen-an-die-schafkopfschule.html) und der [Farbwenz-Erklärung von Sauspiel](https://www.sauspiel.de/hilfe). Die konfigurierten Hausregeln sind für die App maßgeblich.

## Verifikation

Automatisierte Prüfungen decken Tarifberechnung, Parteien, Stock-Salden, Abschluss, Übernahme, Korrektur, Zurücknehmen, Statistik sowie Wiederherstellung aus dem Speicher ab. Eine schmale Browser-Vorschau prüft Auswahl, automatische Parteien und Scrollen bis zum Speichern. Der iOS-JavaScript-Bundle-Export prüft den Build, ersetzt aber keinen Test in Expo Go auf einem echten iPhone.

### Noch am iPhone prüfen

1. Über den aktuellen Expo-Go-Link öffnen; Spielauswahl und Tarifanzeige kontrollieren.
2. Sauspieler und Partner auswählen, gewonnen/verloren wechseln; Stock darf nur bei gewonnener Spielerpartei ausgezahlt werden.
3. In der langen Eingabe bis zum Speichern scrollen; auch mit größerer Systemschrift und geöffneter Tastatur bei einer alten manuellen Runde.
4. Stock einzahlen, auszahlen, letzte Runde zurücknehmen und erneut speichern. Kontostände und Topf vergleichen.
5. Mit Rest-Stock abschließen: Verteilung sowie Übernahme auf einen Folgetisch getrennt prüfen.
6. App vollständig schließen und erneut öffnen. Kontostände, Stock, Archiv und Zahlungsstände müssen erhalten bleiben.
7. Beim Wechseln der Bildschirme prüfen, dass der frühere Statusleistenfehler nicht wieder erscheint.

Ein echter iPhone-Test wurde in dieser Arbeitsumgebung nicht durchgeführt.
