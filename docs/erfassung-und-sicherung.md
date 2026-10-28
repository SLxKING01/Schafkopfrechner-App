# Erfassung, Korrekturen und Sicherungsstatus

## Ergebnisse und Korrekturen

- Beim Sauspiel bleibt „gewonnen/verloren“ beim Wechsel von Spieler oder Partner erhalten. Die aktive Ergebniswahl wird hervorgehoben.
- Solo, Wenz, Geier, Bettel und ihre Alleinspiel-Varianten benötigen nur den Alleinspieler und dessen Ergebnis. Die drei Gegner werden automatisch zugeordnet.
- Normaler Ramsch benötigt nur den Verlierer mit den höchsten Augen. Beim Durchmarsch wird stattdessen der Gewinner gewählt.
- Auch eine Korrektur erlaubt „Spielart ändern“. Es stehen die im ursprünglichen Tarif-Snapshot aktivierten Spielarten zur Verfügung. Beim Wechsel werden Parteien und Spielboni neu gewählt; die ursprünglichen Tarife und der damalige Geber-/Multiplikator-Kontext bleiben maßgeblich.
- Betrag, Eingabehinweis und Speichern befinden sich in einer festen Abschlussleiste. Die ausführliche Rechnung lässt sich aufklappen.

## Entwürfe

Schließen fragt bei einer geänderten Eingabe nach „Weiter bearbeiten“, „Entwurf behalten“ oder „Entwurf verwerfen“. Dies gilt für neue Runden und Korrekturen gleichermaßen. Behaltene Entwürfe werden innerhalb der laufenden App-Sitzung auch nach dem Wechsel zwischen verschiedenen Korrekturen wieder geöffnet. Sie werden nicht über einen vollständigen App-Neustart hinweg gespeichert. Eine zwischenzeitlich geänderte Originalrunde oder Spielerbesetzung macht einen alten Korrekturentwurf ungültig.

## Was „gespeichert“ bedeutet

Die Erfolgsmeldung wird erst nach bestätigter Speicherung des kanonischen Spielstands auf dem Gerät angezeigt. Die Eingabe bleibt währenddessen gegen Doppeleingaben gesperrt. Bei einem Schreibfehler bleibt der Eintrag im Arbeitsspeicher ausdrücklich als ungesichert markiert. „Erneut auf Gerät speichern“ wiederholt die Speicherung desselben Eintrags und legt keine zweite Runde an. Ein solcher Eintrag kann ungesichert geschlossen und in derselben Sitzung erneut geöffnet werden; die Warnung bleibt maßgeblich, bis die Speicherung bestätigt wurde.

Gerätespeicherung und Cloud-Abgleich werden am Tisch sowie auf dem Dashboard getrennt angezeigt. Ein gespeicherter lokaler Spielstand ist nicht automatisch bereits auf einem anderen Gerät verfügbar.

## Konflikte und Wiederherstellung

Bei unterschiedlichen lokalen und Cloud-Änderungen bleibt automatisches Überschreiben gesperrt. „Fassungen vergleichen“ zeigt die beiden vollständigen Spielstände mit Tisch, Spielern, Spielzahlen und Salden. Die Auswahl übernimmt eine vollständige Fassung; einzelne Runden werden nicht automatisch zusammengeführt.

Vor einer ausdrücklichen Übernahme werden beide Fassungen mit Konto und Cloud-Version lokal unter `schafkopfrechner-sync-conflict-backup` gesichert. Eine erneute Prüfung erkennt zwischenzeitliche Änderungen. Das Schreiben in die Cloud verwendet weiterhin die serverseitige Versionsvorbedingung.

Eine Übernahme auf das Gerät wird zusätzlich unter `schafkopfrechner-sync-restore` protokolliert, bevor die einzelnen Stores geändert werden. Ein unterbrochener Vorgang wird beim Start vor Freigabe der Bildschirme fortgesetzt. Neuere, gültige lokale Änderungen werden nicht durch ein altes Wiederherstellungsprotokoll ersetzt; sie erfordern einen erneuten Cloud-Vergleich. Bei nicht erreichbarem Gerätespeicher bleibt die Speicherwarnung bestehen.

## Stock und Geber

Eine neue Stock-Einzahlung ist zunächst eine reine Geldbuchung: Geber und gesetzte Leger bleiben erhalten. „Nicht gespielte Gabe abschließen“ schaltet ausdrücklich den Geber weiter und setzt die Leger zurück. Bei Korrekturen bleibt diese ursprüngliche Wirkung fest. Ältere Einzahlungen ohne diese Unterscheidung behalten ihr bisheriges Verhalten. Das Zurücknehmen einer reinen Einzahlung verändert auch nachträglich gesetzte Leger nicht.

## Verifikationsgrenzen

Automatisierte Tests prüfen unter anderem verlorene Spiele bei Partnerwechsel, Korrekturen mit ursprünglichen Tarifen, Entwürfe, Schreibfehler ohne Doppeleinträge, Stock-/Geber-Kontext, Konfliktauflösung und unterbrochene Wiederherstellung. Die Browser-Prüfung umfasst einen kleinen Bildschirm mit 320 × 568 Pixeln. Sie ersetzt weder eine Prüfung mit nativer iOS-Tastatur und VoiceOver noch einen echten Mehrgeräte-Cloud-Test.
