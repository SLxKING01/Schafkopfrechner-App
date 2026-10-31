# Stock- und Ramschregeln – Issue #7

## Bedienung

„Regeln & Tarife“ enthält die gemeinsame Auswahl „Stock“, „Ramsch“, „Beides aus“. Eine Auswahl schaltet die andere Spielart aus. Bei gefülltem Stock erklärt ein Wechselversuch die Sperre; die bisherige Einstellung und sämtliche Buchungen bleiben erhalten. Der Store prüft dieselbe Sperre nochmals beim Speichern.

Bei neuen Konfigurationen entspricht der vorgeschlagene Stock-Einsatz dem dann eingestellten Rufspiel-Grundtarif. Er ist unabhängig änderbar und bleibt danach bei weiteren Tarif- oder Modusänderungen erhalten. Bereits vorhandene Einsätze und historische Tarif-Snapshots werden nicht überschrieben. Einsatzänderungen betreffen nur folgende Einzahlungen.

Neue Sauspiele buchen den Stock automatisch zusätzlich zum normalen Spielergebnis:

- Alle weiter: Die vier tatsächlichen Rundenteilnehmer zahlen den Einsatz ein; der Geber teilt nochmals aus.
- Ansagende Partei gewinnt: Ansager und Partner erhalten den gesamten Topf.
- Ansagende Partei verliert: Ansager und Partner zahlen zusammen den bisherigen Topf zusätzlich ein; der Stock verdoppelt sich. Die Gegenpartei erhält nur den normalen Spielgewinn.
- Solo, Wenz und andere Spielarten lassen den Stock unverändert. Ein leerer Stock erzeugt keine zusätzliche Sauspielbuchung.
- Beim Abschluss erhält jeder dann aktive Spieler seinen Anteil am Reststock. Manuell Pausierte sind ausgeschlossen; der regulär aussetzende Geber einer Fünferrunde zählt zu den Aktiven. Der Empfängerkreis bleibt in der Abschlussbuchung gespeichert. Ohne aktive Empfänger ist der Abschluss gesperrt und verlangt eine Reaktivierung.

Die Eingabe zeigt die automatische Stockwirkung vor dem Speichern. Im Verlauf stehen Ausgangsbetrag und neuer Stockstand; Ansager und Partner bleiben erkennbar. Der bisherige manuelle Auszahlungsschalter bleibt ausschließlich bei historischen Einträgen ohne neue Regelversion verfügbar.

Die aktive Verlaufsansicht verwendet eine kompakte Tabelle mit den Spalten Spiel, Ergebnis und Betrag. Zeit und Ansager stehen klein in der jeweiligen Zelle; lange Namen werden nach zwei Zeilen gekürzt und bleiben über die Rundeneingabe vollständig erreichbar. Stockbewegungen erscheinen als kurze Zusatzzeile. Die Vorschau liegt unter `output/playwright/history-table-compact-320.png`. Für diese visuelle Anpassung wurden die betroffenen Bildschirmtests, TypeScript und ESLint geprüft.

## Daten und nachträgliche Änderungen

Neue Runden tragen `stockRulesVersion: 1`, `stockBeforeCents` und `stockAfterCents`. `stockAction: double` bezeichnet die zusätzliche Einzahlung der verlierenden ansagenden Partei und zählt weiterhin als gespieltes Sauspiel. Statistikberechnungen entfernen die zusätzliche Stockbewegung aus dem normalen Spielgewinn/-verlust. Alte Runden ohne Regelversion behalten ihre gespeicherten manuellen Bewegungen.

Bei Korrektur oder Undo werden folgende versionierte Stockbewegungen chronologisch neu berechnet. Runden-IDs, historische Teilnehmer, Tarif-Snapshots und aktuelle Geberposition bleiben bei einer Korrektur bestehen. Rechenbeträge sind sichere ganze Cent; Restcents werden nach stabiler ID-Reihenfolge mit höchstens einem Cent Unterschied verteilt. Überläufe werden ohne finanzielle Teiländerung abgelehnt.

Die Modusgrenzen ergeben sich aus den gespeicherten Einstellungssnapshots und der aktuellen Tischeinstellung. Würde eine Korrektur an einer späteren Grenze einen positiven Stock erzeugen, wird die gesamte Änderung abgelehnt. Die Meldung benennt den Regelwechselkonflikt. Zur Auflösung kann man die Korrektur anpassen oder zuerst die späteren Runden zurücknehmen und die frühere Weiter-Regel wiederherstellen. Es wird kein Stock still verworfen oder automatisch zum Ermöglichen eines Regelwechsels ausgezahlt.

Die lokale Speicherprüfung und der Cloud-Snapshot-Vertrag prüfen die abgeleiteten Stockstände gegen die gespeicherten Audit-Felder. Ein gefälschter Ausgangs-/Endbetrag wird abgelehnt. Neue optionale Felder bleiben Teil des bestehenden Snapshot-Formats; es ist keine Datenbankmigration erforderlich.

## Prüfung

Automatisierte Tests decken das Ticketbeispiel, beide Sauspielergebnisse, leeren Stock, wechselnde Einsätze, exklusive Modi, finanzielle Wechsel-Sperre, fehlende Parteien, andere Spielarten, Korrekturreplay, Konflikte vor späteren Regelwechseln, Undo, Fünferrunde, pausierte Empfänger, Centreste, Überlauf, Statistik, Neustart, Archiv und Cloud-Snapshot-Validierung ab. UI-Tests prüfen Modusauswahl, initialen Einsatz, Sperrmeldung und automatische Verbuchung.

Gesamtsuite: 40 Suiten, 376 Tests erfolgreich. TypeScript und ESLint der betroffenen Dateien ohne Fehler. Nach der abschließenden Anpassung der kompakten Verlaufskarten wurden die betroffenen Bildschirmtests erneut ausgeführt.

Browserprüfung bei 320 Pixeln Breite: Einstellung auf Stock, Einzahlung 0,80 €, gesperrter Wechsel auf Ramsch, verloren → 1,60 €, gewonnen → 0,00 €, anschließend erfolgreicher Wechsel auf Ramsch. Screenshots unter `output/playwright/stock-rules-settings-320.png`, `stock-loss-preview-320.png` und `stock-movements-history-320.png`.

Native iPhone-Bedienung, VoiceOver auf einem Gerät und ein echter Cloud-Rundlauf wurden nicht durchgeführt. Ramsch-Fachregeln aus #12 sowie gemeinsame Tischberechtigungen und parallele Mehrgeräte-Eingaben aus #8/#9 bleiben eigenständige Folgepakete. Das GitHub-Issue bleibt für den vereinbarten Praxistest offen.
