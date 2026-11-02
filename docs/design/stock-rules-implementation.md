# Stock- und Ramschregeln – Issue #7

Nachtrag 02.11.2026: Bei der Integration mit Karls Main wurde die Tarifwahl
„Ab jetzt“ / „Auch bisherige Spiele“ ausdrücklich übernommen. Ein gewählter
rückwirkender Tarifwechsel berechnet auch historische Einzahlungen und deren
abhängige Stockbewegungen neu und protokolliert die Änderungen. Bereits
geleistete Zahlungen bleiben erhalten. Dies erweitert die frühere Vorgabe,
dass Einsatzänderungen ausschließlich künftige Einzahlungen betreffen.

## Bedienung

„Regeln & Tarife“ enthält die gemeinsame Auswahl „Stock“, „Ramsch“, „Beides aus“. Stock und Ramsch sind zusätzlich unter „Grundspiele“ jeweils mit Schalter und Tarif sichtbar; alle Einstiege verwenden denselben Zustand. Ist Stock oder Ramsch bereits aktiv, öffnet der Aktivierungsversuch der anderen Option eine Warnmeldung und lässt die Einstellungen unverändert. Für einen Wechsel muss zuerst die aktive Option deaktiviert werden (etwa über „Beides aus“). Rufspiel bleibt unabhängig aktivierbar. Bei gefülltem Stock erklärt ein Wechselversuch die finanzielle Sperre ebenfalls als Warnung; die bisherige Einstellung und sämtliche Buchungen bleiben erhalten. Der Store prüft die finanzielle Sperre nochmals beim Speichern.

Nachtrag 01.11.2026: Die Warnung gilt für beide Richtungen und auch für den Ramsch-Schalter unter „Grundspiele“. Die Tarife von Stock und Ramsch werden nur unter „Grundspiele“ angezeigt. 24 gezielte Einstellungs-/Stockregeltests bestanden; TypeScript, scoped ESLint und Diff-Prüfung erfolgreich.

Die Warnung erscheint inzwischen als kompakter, mittiger Dialog mit konkretem Titel („Ramsch ist bereits aktiv“ / „Stock ist bereits aktiv“) und kurzer Handlungsanweisung. „Verstanden“ schließt den Dialog ohne Einstellungsänderung. Safe Area, begrenzte Dialogbreite und ein bei Platzmangel scrollbarer Textbereich halten die Bestätigung erreichbar; Warnungen haben kein zusätzliches X am rechten Rand.

Browserprüfung des neuen Dialogs bei 320 × 568: Titel und Text vollständig sichtbar, Bestätigung vollständig im Bildschirm und Schließen erfolgreich. Screenshot: `output/playwright/stock-ramsch-warning-320.png`. 24 gezielte Tests sowie TypeScript und scoped ESLint erfolgreich. Native Darstellung mit vergrößerter Systemschrift noch am Gerät prüfen.

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
