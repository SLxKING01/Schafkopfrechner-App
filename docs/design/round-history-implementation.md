# Änderungsverlauf – Issue #14

Stand: 02.11.2026

## Verhalten

- Die normale Spielliste zeigt weiterhin genau einen aktuellen Eintrag je Spiel.
- Über das Drei-Punkte-Menü sind „Spiel bearbeiten“ und „Änderungsverlauf“ getrennt erreichbar. Direktes Antippen öffnet weiterhin die Bearbeitung.
- Der Verlauf zeigt den aktuellen Stand sowie Erfassung, Korrekturen und Rücknahmen in umgekehrter zeitlicher Reihenfolge. Bei Korrekturen erscheinen nur geänderte fachliche Werte als Alt → Neu.
- Zeitpunkt und Verfasser werden mit dem Ereignis gespeichert. Angemeldete Nutzer werden mit Account-ID und Anzeigenamen erfasst, Gäste als „Lokale Erfassung“. Die persönliche Spielerzuordnung wird nicht als Verfassernachweis verwendet.
- Der Tischmenü-Eintrag „Änderungsverlauf“ enthält auch zurückgenommene Spiele. Archivierte Tische bieten denselben lesenden Zugriff.
- Frühere Aktionen bestehender Tische werden nicht erfunden. Die erste echte Änderung enthält einen Vorher-Schnappschuss; die Ansicht weist auf fehlende ältere Aktionen hin.

## Daten und Abrechnung

`GameTable.roundHistory` enthält optionale Ereignisse mit stabiler UUID, fortlaufender Sequenz, Zeitpunkt, Akteur, Spielernamen sowie Vorher-/Nachher-Schnappschüssen. Die Ereignisse werden in derselben Store-Transaktion wie die erfolgreiche Buchung angehängt. Fehlgeschlagene Vorgänge und unveränderte Korrekturen erzeugen keinen Eintrag.

Die Abrechnung verwendet ausschließlich die aktuellen Runden. Abhängige Stock-Neuberechnungen werden ebenfalls erfasst und über `causeRoundId` mit ihrem Auslöser verbunden. Abschluss- und Stockübertragsbuchungen werden berücksichtigt.

Das optionale Feld bleibt beim lokalen Speichern, Wiederherstellen, Archivieren und in bestehenden Cloud-Snapshots erhalten. Validierung prüft Ereignis-IDs, Sequenz, Schnappschüsse, Ereigniskette und Übereinstimmung mit dem aktuellen Rundenstand. Alte Daten ohne Verlauf bleiben gültig.

## Prüfung

- Gesamte Jest-Suite vor dem ergänzten Stockfall: 395 Tests bestanden.
- Zusätzlicher Stockfall: Korrektur einer früheren Runde ändert spätere Stockbewegung; Ursache und beide Schnappschüsse stimmen, Cloud-Snapshot bleibt gültig.
- Neue Tests prüfen außerdem unveränderliche Schnappschüsse, Verfasser, relevante Feldunterschiede, fehlgeschlagene/unveränderte Aktionen, Rücknahmen ohne Restbetrag, Geräte-Persistenz, Archivierung, Snapshot-Serialisierung, Altdaten und beschädigte Ereignisse.
- Browserprüfung in Edge bei 393 × 852 und 320 × 568: Tisch erstellen, Wenz erfassen, über das Menü bearbeiten, Laufende korrigieren, separaten Verlauf öffnen. Die normale Liste behält eine Zeile; Betrag und Protokoll stimmen mit dem gespeicherten Zustand überein.
- Nach dem Neuladen bleibt der korrigierte Stand erhalten. Rücknahme im Browser: keine aktuelle Runde, alle vier Salden null; Tischverlauf enthält weiterhin Erfassung, Korrektur und Rücknahme.
- Visuelle Belege: `output/playwright/round-history-mobile.png` und `round-history-small.png`.

## Grenzen

Dies ist ein lokales Änderungsprotokoll, das mit dem bestehenden Snapshot synchronisiert wird. Es ist kein serverseitig signiertes oder manipulationssicheres Mehrbenutzer-Audit. Serverseitig bestätigte Identitäten, Konfliktzusammenführung paralleler Bearbeitungen und Rechte gemeinsamer Tische benötigen die dafür vorgesehenen Folgearbeiten. Ein Test auf einem echten iPhone/Android-Gerät steht noch aus.
