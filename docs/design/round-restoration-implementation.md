# Spiele rückgängig machen – Issue #17

Nach Spieleingabe, Korrektur und Löschung erscheint „Rückgängig“ direkt unter Gesamtfaktor/Leger. Die Meldung bleibt acht Sekunden sichtbar, bei aktivem Screenreader länger; Android berücksichtigt die Systemempfehlung. Während Speicherung und bei Fehlern läuft sie nicht ab. Wiederholungen nach Speicherfehlern führen dieselbe Rücknahme nicht mehrfach aus.

Gelöschte Spiele können außerdem über Tischmenü → Änderungsverlauf → „Spiel wiederherstellen“ zurückgeholt werden, auch nach Neuladen oder Ablauf der Meldung. Nur die jüngste Löschung eines aktuell fehlenden Spiels bietet diese Aktion an. Abgeschlossene Tische bleiben lesbar (Folgearbeit #18).

## Daten und Konflikte

- Eine Eingabe wird gezielt entfernt, eine Korrektur auf ihren vorherigen Stand zurückgesetzt. Löschungen werden an ursprünglicher Position mit gleicher ID, Teilnehmern und historischen Tarifen wiederhergestellt.
- Stockbewegungen und Salden werden atomar neu berechnet. Reale Zwischenzahlungen bleiben bestehen. Unvereinbare Stock-/Regelwechsel lehnen die Aktion vollständig ab.
- Geber, Leger und Turbo werden nur zurückgesetzt, wenn der gespeicherte Folgekontext noch unverändert ist. Spätere Spiele, Sitzreihenfolge, Pausierungen und manuelle Einstellungen bleiben erhalten.
- Ereignis-ID und Inhaltsvergleich verhindern Rücknahmen veralteter Spielstände. Ein bereits geöffneter Löschdialog darf keine inzwischen neu hinzugekommene Runde löschen. Gleiche Zeitstempel ersetzen diese Prüfung nicht.
- Jede Rücknahme erzeugt ein neues Audit-Ereignis mit Verfasser, Zeitpunkt und `undoOfEventId`; bestehende Ereignisse bleiben unverändert. Optionale `turnBefore`/`turnAfter` erhalten den Bedienkontext über Neuladen hinweg. Alte Daten bleiben lesbar; ohne Kontext bleiben aktuelle Geber-/Legereinstellungen erhalten.
- Ersteller und Schreibende dürfen rückgängig machen und wiederherstellen. Lesende und abgeschlossene Tische werden im Store abgewehrt.
- Die Versionsprüfung gemeinsamer Tische verhindert, dass eine lokale Rücknahme eine entfernte neuere Korrektur überschreibt; der lokale Stand bleibt als Konflikt erhalten.

## Prüfung und Grenzen

Automatisierte Tests prüfen Eingaben, Korrekturen, Löschungen, Wiederherstellung, historische Tarife, Stock-Neuberechnung, reale Zahlungen, spätere Bedienänderungen, veraltete Dialoge, Berechtigungen, Rehydration, Mehrgeräte-Konflikte und fehlgeschlagene Speicherung mit Wiederholung.

Keine zusätzliche Datenbankmigration nötig: Die optionalen Audit-Felder werden im bestehenden Snapshot gespeichert und durch den Client validiert. Physische iOS-/Android-Geräte und native Screenreader wurden für diese Erweiterung nicht geprüft. Änderungen liegen lokal auf `master`; kein Commit, Push oder Release für #17.

Abschlussprüfung: 50 Jest-Suiten / 460 Tests bestanden, TypeScript ohne Fehler, ESLint für alle betroffenen Dateien bestanden, Datenbankprüfung mit sämtlichen Migrationen und Berechtigungs-/Versionskonfliktfällen bestanden. `git diff --check` ohne Fehler.
