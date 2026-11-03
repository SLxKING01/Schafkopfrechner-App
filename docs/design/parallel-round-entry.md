# Parallele Rundeneingabe (#15)

Eine neue Eingabe an einem gemeinsamen Tisch merkt sich die beim Öffnen bekannten Rundeneinträge (stabile IDs, einschließlich gelöschter Spiele im Verlauf). Vor dem gemeinsamen Speichern liest sie den aktuellen Serverstand. Unbekannte Spiele anderer Accounts erscheinen mit Erfasser und Spielart in einer Rückfrage. Gleiche Spielarten, Beträge und Uhrzeiten lösen keine automatische Zusammenführung aus.

„Eintrag ansehen“ zeigt den bestehenden Rundeneintrag samt Verlauf im selben Dialog. Zurück führt zur Rückfrage und anschließend zur unveränderten eigenen Eingabe. „Als weiteres Spiel speichern“ bestätigt ausschließlich den angezeigten Stand; zusätzliche Einträge lösen eine neue Rückfrage aus. Die normale Tischansicht bleibt unverändert.

## Verbindliches Speichern

`saveSharedRound` verwendet die bestehende `sk_live_command`-RPC mit ihrer serverseitigen Tischsperre, Rollenprüfung und erwarteten Version. Nach einem HTTP-409-Konflikt wird neu gelesen und geprüft. Es gibt hier keinen automatischen Append-Merge. Deshalb kann ein zwischen Prüfung und Speicherung hinzugekommenes Spiel nicht unbemerkt übergangen werden. Drei Versuche begrenzen Konfliktschleifen; danach bleibt der Entwurf für einen erneuten Versuch erhalten. Keine neue Migration erforderlich.

Die Rundenerzeugung liegt in `planRoundAddition`: dieselbe Validierung und Berechnung für lokale Eingaben und gemeinsame Speicherung, ohne vorläufige Storeänderung. Erst die bestätigte Serverantwort übernimmt den gemeinsamen Eintrag. Änderungen an Regeln, Besetzung, Sitzordnung oder unpassende Leger-/Stockkontexte verlangen eine Prüfung und werden nicht still umgedeutet. Bei fünf Spielern muss die Eingabe weiterhin zu den aktuell tatsächlich teilnehmenden vier Spielern passen.

Der gemeinsame Speichervorgang und der Hintergrundabgleich verwenden dieselbe lokale Warteschlange. Ändert sich das Konto oder der Tisch während einer Anfrage, werden keine fremden Daten angewendet. Zusätzliche lokale Änderungen während einer akzeptierten Anfrage bleiben als Konflikt erhalten.

## Offline und Wiederholung

Vor dem Senden werden der vollständige Entwurf, bekannte beziehungsweise ausdrücklich bestätigte IDs und eine stabile neue Runden-ID im konten- und tischbezogenen Entwurfsschlüssel gespeichert. Offline wird kein gemeinsam gültiger Eintrag vorgespiegelt und kein Hintergrundupload für diesen Entwurf angelegt. „Entwurf behalten“ erlaubt Schließen und späteres Weiterarbeiten. Neu hinzugekommene Runden machen einen gemeinsamen Entwurf nicht ungültig.

Ein fehlgeschlagener Versuch vor dem Schreiben lässt Bearbeitung zu. Bei ungewisser Serverantwort bleibt die Eingabe bis zum erneuten Speichern gesperrt. Ein Retry liest zuerst: Ist die stabile ID bereits als angelegt protokolliert, wird der bestehende Eintrag bestätigt, auch wenn er inzwischen gelöscht wurde. Er wird nicht erneut angelegt.

## Prüfung

- Servicetests: zwei Accounts, bewusste Freigabe gleichartiger Spiele, zusätzliche Spiele nach einer Rückfrage, HTTP-409 zwischen Lesen und Schreiben, verlorene Antwort, Offline/Reconnect sowie bekannte und eigene Einträge.
- UI-Tests: bestehenden Eintrag ansehen, unveränderten Entwurf wiederfinden, ausdrückliche Freigabe sowie Offlineentwurf mit derselben Operations-ID nach Schließen und Wiederöffnen.
- Bestehende PostgreSQL-Prüfung: Migrationen, Rollen, Rechteentzug, CAS und Rundenidentitäten in isolierter Datenbank.
- Physische Abnahme mit zwei Geräten steht aus.
