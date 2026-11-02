# Eigenes Spiel: freie Ausgleichsbuchung – Issue #6

## Vereinbarte Bedeutung

Der Nutzer hat die erste Statistik-Option gewählt: Eigene Spiele wirken ausschließlich auf Tischsaldo, Abrechnung und Verlauf. Sie erhöhen weder Spielanzahl noch Siege, Niederlagen, Ansagequoten oder Gewinnquoten. Geber und Leger bleiben erhalten; Tarife, Turbo Ramsch, Kontra/Re und Stock verändern die Beträge nicht. Es handelt sich um eine Ausgleichsbuchung, nicht um die Erfassung einer tatsächlich geleisteten Zwischenzahlung aus #10.

## Eingabe und Speicherung

„Eigenes Spiel“ ist standardmäßig in derselben Spielartauswahl verfügbar, auch wenn alle konfigurierbaren Spielarten deaktiviert sind. Jeder Spieler erhält ein positives Betragsfeld und explizite Plus-/Minus-Schalter. Deutsches Dezimalkomma wird unterstützt; leere, unvollständige, negative oder mehr als zweistellige Dezimaleingaben sind ungültig. Unbeteiligte Spieler können 0,00 € erhalten. Eine reine Nullbuchung wird nicht angelegt.

Die Oberfläche zeigt die Gesamtsumme und bei Abweichung den noch auf Plus- beziehungsweise Minusseite auszugleichenden Betrag. Speichern erfordert exakt null Cent sowie mindestens einen positiven und einen negativen Betrag. Auch die Speicherlogik prüft vollständige Centbeträge, Nullsumme, eindeutige bekannte Spieler und den sicheren Zahlenbereich.

Eine Buchung wird als einzelner Rundeneintrag mit stabiler ID und einem separaten Feld customAmounts gespeichert. Dieses enthält die tatsächlich gewählten vorzeichenbehafteten Beträge pro Spieler. Es werden kein Ansager und keine Gewinner-/Verlierergruppen erfunden. Das bestehende Feld amount speichert lediglich die Summe der positiven Beträge als Verteilungsvolumen. Eine Gleichverteilung auf Parteien oder zusätzliche Faktoren findet nicht statt.

Korrekturen öffnen dieselben Beträge und Vorzeichen und behalten dieselbe ID. Die vorhandene Entwurfs- und Speicherfehlerbehandlung gilt auch für eigene Spiele. Abbrechen/Verwerfen erzeugt keine Buchung. Undo entfernt die Buchung ohne Geber-/Legeränderung. Bereits tatsächlich geleistete Zwischenzahlungen bleiben bei Korrektur oder Rücknahme bestehen und können deshalb zu Rückforderungen führen.

## Verlauf, Statistik und Sicherung

Aktiver Verlauf und abgeschlossene Abrechnung zeigen „Eigenes Spiel“ mit den individuellen Beträgen. Im kompakten Verlauf erhält die Buchung die volle Zeilenbreite, damit längere Namen nicht in eine schmale Gewinner-Spalte gepresst werden. Die allgemeine Ergebnisspalte ist entsprechend als „Ergebnis“ beschriftet. Gespielte Runden und Buchungen werden getrennt gezählt.

Die Daten fließen in die normalen Tischsalden und minimalen Zahlungspläne ein. Die Statistik filtert diese Buchungen aus. Dabei bleibt der bisherige Stock-Kontext für die Kontoauswertung erhalten, damit Stock-Auszahlungen weiterhin korrekt berechnet werden. Historische Spielerzuordnungen werden vor Löschung geschützt; später hinzugefügte Spieler erhalten für frühere Buchungen keinen Betrag.

Die bestehenden lokalen Rundenspeicher, Archive und Cloud-Snapshots enthalten die neuen individuellen Beträge. Das zusätzliche optionale Feld benötigt keine neue Tabelle oder externe Datenbankänderung. Ältere Datensätze ohne dieses Feld werden nicht automatisch umgeschrieben.

## Prüfung

Vollständige Jest-Suite: 38 Testsuiten / 335 Tests bestanden. TypeScript und scoped ESLint geprüft. Darunter Daten- und UI-Tests für unausgeglichene/ungültige Eingaben, Dezimalkomma, Centbeträge, Nullbeträge, deaktivierte Tarife, ausgeschlossene Multiplikatoren, Korrekturen, Undo mit vorhandener Zwischenzahlung, Stock, Spielstatistik, Spielerreferenzen, lokale Rehydration und Cloud-Snapshot-Validierung. Die bestehende Stock-Regressionssuite ist bestanden.

Browserprüfung auf eigener lokaler Gast-Origin bei 320 × 568 Pixeln: +5,00 €, −3,00 €, −1,00 €, 0,00 € sperrt Speichern; Korrektur auf −2,00 € ermöglicht Speichern. Der gespeicherte Datensatz enthält exakt +5/−3/−2/0, keinen Ansager und unveränderten Geber/Leger. Nach Neuladen dieselbe Buchung auf −2,99/−2,01 korrigiert und anschließend archiviert; ID und Beträge bleiben erhalten. Abschließender Browserlauf ohne Browserfehler; bekannte Store-Importwarnungen bleiben.

Screenshots: output/playwright/custom-round-entry-320.png und output/playwright/custom-round-history-320.png. Kein physischer iPhone-/VoiceOver- oder echter Mehrgeräte-Cloud-Test. Kein Commit/Push, keine Veröffentlichung und keine GitHub-Ticketänderung durch diese Umsetzung.
