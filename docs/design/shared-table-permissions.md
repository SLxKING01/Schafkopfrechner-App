# Issue #28: Berechtigungen gemeinsamer Tische

Stand 02.11.2026, Arbeitsstand auf `master`. Datenbankteile sind bereits auf dem
konfigurierten Supabase-Projekt eingerichtet; Clientänderungen noch nicht integriert.

## Abgestimmte Rollen

| Rolle | Erlaubt |
| --- | --- |
| Lesen | Gemeinsamen Tisch, Spiele, Salden, Stock, Abrechnung und Verlauf ansehen |
| Schreiben | Zusätzlich Spiele anlegen, korrigieren, löschen und wiederherstellen; Leger und Turbo für die Spieleingabe bedienen |
| Ersteller | Zusätzlich Regeln, Kontozuordnung, Besetzung, Sitzfolge, manuelle Geberauswahl, Tischabschluss und bestehende Zahlungsverwaltung |

Der Nutzer hat ausdrücklich bestätigt, dass Schreibende auch löschen und
wiederherstellen dürfen. Das separate Melden/Bestätigen von Zahlungen aus #13
ist weiterhin ein Folgefeature. Freundschaften und angenommene Einladungen
aus #26/#27 werden nicht vorweggenommen: Der vorhandene Einstieg über vom
Ersteller zugeordnete Spielerkonten bleibt bestehen.

## Umsetzung

- Neue Kontomitgliedschaften erhalten serverseitig `read`. Der Ersteller bleibt
  unabhängig von seinem Spielerplatz verwaltungsberechtigt. Nur er kann unter
  „Regeln & Tarife → Spielerkonten am Tisch“ auf Lesen/Schreiben umstellen.
- Die Rolle wird getrennt vom hochgeladenen Tischpayload in `sk_live_members`
  gespeichert; ein Client kann sie nicht durch Änderung seines Snapshots erhöhen.
- Jede Speicherung prüft Anmeldung, Mitgliedschaft und Rolle erneut nach der
  Tischsperre. Versionsprüfung und Rollenänderungen verwenden dieselbe Sperre.
- Leser haben keinerlei Schreibzugriff. Schreibende dürfen weder Spielerliste
  noch feste Tischkonfiguration, Abschluss oder Zahlungen verändern. Direkte
  Tabellen-Schreibrechte bleiben gesperrt; Lesezugriff erfolgt per RLS.
- Rollenwechsel erhöhen die Tischversion. Mitglieder- und Tischänderungen werden
  per Realtime gemeldet; der bestehende Fünf-Sekunden-Abgleich bleibt Rückfallweg.
- Der Client zeigt „Nur lesen“ und die eigene Berechtigung. Nicht erlaubte
  Bedienelemente sind deaktiviert/ausgeblendet. Auch Storeaktionen und offene
  Eingaben prüfen die aktuelle Berechtigung, einschließlich Accountwechsel.
- Entzug bei ausstehender Offline-Eingabe verwirft nichts: lokaler Stand bleibt
  als Konflikt erhalten, weitere Schreibaktionen sind gesperrt. Vor Laden der
  Serverfassung wird die lokale Fassung dauerhaft gesichert.
- Rollenänderungen werden erst nach Serverbestätigung angezeigt; Fehler bleiben
  sichtbar und lassen sich erneut versuchen. Alte Bindungen ohne Rolle sind bis
  zum erneuten Abgleich für Nicht-Ersteller nur lesbar.

## Prüfungen

- `npm run test:database`: vollständige Migration einer frischen PostgreSQL-Instanz,
  Alt-IDs und Sicherung, Mitgliedschaft, RLS, Leser/Schreiber/Ersteller, verbotene
  Verwaltung, veraltete Version, Downgrade und Entzug in SQL.
- Jest: 446 Tests im vollständigen Lauf sowie drei anschließend ergänzte Rollenbedienungstests bestanden. Lokale Mutationssperren, erlaubte Korrektur/Löschung/Wiederherstellung,
  Erstellerrechte, falsches Konto, Speicherformat für Konfliktsicherungen,
  Rechteentzug vor Upload und bei bereits geöffneter Eingabe; fehlgeschlagene Rollenänderung mit Retry und Doppeltippsperre.
- Live: drei getrennte Auth-Clients einschließlich echter Realtime-Nachricht,
  Versionskonflikt, Retry und Rechteentzug. Testdaten anschließend vollständig entfernt.
- Die privaten Register/Sicherungstabellen haben absichtlich RLS ohne Clientpolicies
  und keine Clientrechte. Die entsprechenden Advisor-Infos sind beabsichtigt.
- Vorbestehende Auth-Warnung für deaktivierten Schutz gegen kompromittierte
  Kennwörter bleibt eine separate Projekteinstellung; keine Auth-Konfiguration geändert.

Manuelle Bedienung auf zwei physischen Geräten bleibt eine ergänzende Geräteabnahme.
