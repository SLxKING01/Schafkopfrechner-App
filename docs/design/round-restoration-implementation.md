# Gelöschte Spiele wiederherstellen – Issue #17

## Umfang

Der bestätigte Mockup-Ablauf ergänzt das vorhandene Zurücknehmen der letzten
Runde. Nach erfolgreicher Rücknahme erscheint eine kompakte Meldung „Spiel
gelöscht“ mit „Rückgängig“. Sie bleibt acht Sekunden sichtbar; bei Screenreadern
auf iOS/Web zwanzig Sekunden, auf Android gemäß Systemempfehlung. Die Meldung
schwebt oberhalb der gemessenen Aktionsleiste und verkleinert den Tischverlauf
nicht. Die Aktionsleiste bleibt bedienbar. Die kurze Einblendung berücksichtigt
reduzierte Bewegung.

Später kann das Spiel über Tischmenü → Änderungsverlauf → „Spiel
wiederherstellen“ zurückgeholt werden. Der Button erscheint nur an der neuesten
Löschung eines aktuell fehlenden Spiels am laufenden Tisch. Historische
Löschungen bleiben sichtbar, auch nachdem das Spiel wiederhergestellt wurde.
Archivierte Tische bleiben hier ausschließlich lesbar. Beliebige alte
Bearbeitungsstände und das Löschen beliebiger Einträge sind nicht Teil dieser
Erweiterung.

## Daten und Abrechnung

- Wiederhergestellt wird der letzte gespeicherte Stand vor der Löschung mit
  unveränderter Spiel-ID, Teilnehmern, Tarif-Snapshot und ursprünglichem Kontext.
- Neue Löschereignisse halten die damalige Reihenfolge der IDs fest. Die
  Position wird anhand dieser Reihenfolgen rekonstruiert, auch bei mehreren
  Löschungen und Wiederherstellungen in unterschiedlicher Reihenfolge. Alte
  Undo-Ereignisse ohne Positionsdaten werden vor später erfassten Spielen
  eingeordnet; es wird nicht nach Gerätezeit sortiert.
- Stockbewegungen werden in der wiederhergestellten Reihenfolge vollständig
  neu berechnet. Abhängige Änderungen erhalten eigene Historieneinträge mit
  Verweis auf das wiederhergestellte Spiel.
- Salden und Zahlungsplan werden atomar neu berechnet. Bereits geleistete
  Zwischenzahlungen bleiben erhalten.
- Bei Wiederherstellung der letzten, geberwechselnden Runde wird der Geber
  wieder weitergesetzt und die für diese Runde gesetzten Leger werden
  verbraucht. Bei älteren Runden bleibt der aktuelle Geber-/Legerstand bestehen.
- Ein neues Ereignis `restored` dokumentiert Verfasser, Zeitpunkt und Ergebnis;
  die bisherigen Ereignisse bleiben unverändert. Speicherung, Rehydration,
  Archivierung und Snapshot-Validierung unterstützen diesen Ereignistyp.
- Falscher Tisch, abgeschlossener Tisch, fehlende Spieler, doppelte
  Wiederherstellung und widersprüchliche Stock-/Regelwechsel werden abgelehnt.
  Eine Ablehnung verändert weder Rundendaten noch Salden noch Historie.

## Prüfung

- Vollständige Jest-Suite: 45 Suiten / 403 Tests bestanden.
- Danach ergänzte Tests und letzte UI-Anpassungen: 33 Tests in ActiveGame und
  RoundHistoryView sowie 14 RoundHistory-Tests bestanden.
- TypeScript, scoped ESLint und Formatierung geprüft.
- Browser: vorhandenes gelöschtes Wenz-Spiel über Historie wiederhergestellt;
  korrigierter Tarif 0,70 € pro Spieler und Gesamtbetrag 2,10 € erhalten.
  Erneute Rücknahme → Meldung → Rückgängig ergab genau ein Spiel, korrekte
  Salden und ein zusätzliches Wiederherstellungsereignis.
- Wiederherstellung bleibt nach Neuladen erhalten. Beide Wege zusätzlich bei
  320 × 568 Pixeln durchlaufen; abschließender Browserlauf ohne Konsolenfehler.
- Screenshots in `output/playwright/round-restore-history-mobile.png` und
  `output/playwright/round-undo-notice-mobile.png`.

## Grenzen

Lokaler Ablauf auf Basis der bestehenden Snapshot-Speicherung. Kein neuer
serverseitiger Mehrgeräte-Konfliktmechanismus und keine neuen Tischrechte.
Physische iOS-/Android-Geräte, native Screenreader und maximale Systemschrift
sind noch nicht geprüft. Änderungen sind lokal; kein Commit, Push oder Release.
