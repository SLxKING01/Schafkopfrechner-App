# Issue #9: Spielidentität und gemeinsame Speicherung

Stand 02.11.2026: Die ursprüngliche Implementierung ist mit `3102c28` auf Main
integriert. Die ergänzenden Korrekturen liegen im Arbeitsstand auf `master`.
Die fehlenden gemeinsamen Tabellen, das ID-Register und die Rollenprüfung sind
auf dem konfigurierten Supabase-Projekt `jujvkphobubxmylekkvd` eingerichtet und geprüft.

## Verhalten

- Neue Spiele erhalten bereits lokal eine Expo-Crypto-UUID. Bearbeiten,
  Wiederherstellen, Archivieren und Synchronisieren behalten diese ID.
- Die gemeinsame Tischversion ist weiterhin ein serverseitiger Compare-and-Swap.
  Bei zwei unabhängigen Neuanlagen wird der zuletzt bestätigte Serverstand als
  Grundlage verwendet und um die noch nicht übertragenen IDs ergänzt. Dieselbe
  ID samt identischem Erstellungsvorgang wird nicht nochmals gebucht.
- Die akzeptierte Serverliste bestimmt die gemeinsame Reihenfolge, nicht die
  Uhrzeiten der Geräte. Nach einem konkurrierenden Schreibzugriff wird neu gelesen
  und höchstens dreimal versucht; niemals ein veralteter Snapshot blind ersetzt.
- Stockbewegungen, Salden, Zahlungsplan und Geberfortschaltung werden für die
  gemeinsame Reihenfolge neu berechnet. Historische Teilnehmer und vom Benutzer
  erfasste Rundendaten bleiben erhalten. Neue Audit-Ereignisse erhalten fortlaufende
  Sequenzen und passende Stock-Snapshots, bestätigte Ereignisse bleiben unverändert.
- Während des Uploads zusätzlich erfasste Spiele bleiben lokal und werden beim
  nächsten Abgleich übertragen. Andere zwischenzeitliche lokale Änderungen werden
  behalten und als Konflikt angezeigt.
- Gleichzeitige Korrekturen, Löschungen, Regel-, Zahlungs- oder Besetzungsänderungen
  werden bewusst nicht automatisch zusammengeführt. Der Konflikthinweis erklärt
  das Laden und erneute Bearbeiten; vor Übernahme der Serverfassung wird die lokale
  Fassung dauerhaft gesichert.
- Eine offene Korrektur vergleicht den fachlichen Spielinhalt statt ausschließlich
  `updatedAt`, sodass gleiche Gerätezeitstempel keinen Schutz umgehen.

## Datenbankmigration

`20261102124835_round_identity_guard.sql` ergänzt ein privates ID-Register mit
global eindeutigem Primärschlüssel. Tisch, ursprünglicher Erfassungszeitpunkt,
authentifizierter registrierender Account und serverseitiger Registrierungszeitpunkt
werden festgehalten. Registrierung ist nicht mit der ursprünglichen Erfassung auf
einem anderen Offline-Gerät gleichzusetzen; deren vorhandener Audit-Autor bleibt
erhalten. Bei Altdaten wird kein ursprünglicher Account erfunden.

Ein Trigger prüft sämtliche aktiven und im Änderungsverlauf referenzierten Spiele.
Doppelte IDs im Snapshot, fremde Tischzugehörigkeit, fehlende IDs und die Änderung
des ursprünglichen Erfassungszeitpunkts werden abgelehnt. Löschung entfernt keine
Registereinträge. Bereits gespeicherte Audit-Ereignisse dürfen nicht ersetzt werden.
Register und Migrationssicherungen haben RLS und keine Client-Rechte. Bestehende
Mitgliedschaftsprüfung einschließlich erneuter Prüfung nach der Tischsperre bleibt
erhalten. Individuelle Lese-/Schreibrollen bleiben Gegenstand von #28.

Vorhandene IDs werden nicht umgeschrieben. Servereinträge ohne ID erhalten einmalig
eine zentrale `legacy-…`-ID; das vollständige ursprüngliche Payload wird gesichert
und die Tischversion erhöht. Die Position dient ausschließlich dieser einmaligen
zentralen Vergabe, nicht dem späteren Wiedererkennen von Spielen. Unklar zuordenbare
Altdaten mit Änderungsverlauf brechen die Migration atomar ab und müssen zuerst
zentral zugeordnet werden. Lokal vorliegende Dateien ohne IDs bleiben durch die
bestehende Speicherprüfung gesichert/gesperrt; sie werden nicht auf jedem Gerät
unabhängig mit Zufalls-IDs versehen oder ungeprüft hochgeladen.

## Validierung und Live-Abnahme

- Jest prüft unabhängige Accounts, Reihenfolge bei abweichenden Geräteuhren,
  verlorene Upload-Bestätigung, Compare-and-Swap-Rennen, konkurrierende Korrekturen,
  Stock-Neuberechnung und neue Eingaben während des Uploads.
- `supabase/verify-round-identities.sql` prüft IDs, Wiederholung, Löschung und
  Wiederherstellung, unveränderliche Erfassungszeit und private Zugriffsrechte.
- Sämtliche Migrationen und die SQL-Prüfskripte werden in isoliertem PostgreSQL
  über PGlite ausgeführt. Der lokale Prüflauf prüft zusätzlich die zentrale Migration
  eines ID-losen Altspiels und den Erhalt vorhandener IDs. Supabase-Realtime-
  Publication-Anweisungen werden dort ausgelassen; dies ist kein Realtime-E2E-Test.

- Der tatsächliche Datenbestand enthielt nur die Kontosicherung, entgegen einer
  früheren Dokumentationsaussage noch keine gemeinsamen Tabellen. Der bestehende
  Kontosicherungsstand blieb während Migration und Live-Prüfung bytegleich
  (zusätzlich per Hash geprüft). Die lokale Migrationshistorie entspricht jetzt
  der tatsächlich auf Supabase angewendeten Historie.
- Die Kontosuche verwendet die vorhandenen Auth-Accounts statt nicht vorhandener
  Profil-/Freundschaftstabellen. Ohne Suchtext wird das eigene Konto angeboten;
  mit mindestens zwei Zeichen werden Anzeigenamen gesucht. Keine E-Mail-Ausgabe.
- Konfliktsicherungen und Kontowechsel-Sicherungen werden jetzt von der realen
  lokalen Speicherprüfung akzeptiert. Zuvor wurden sie trotz korrekter Daten
  abgewiesen; reine RPC-Mocks hatten dies nicht aufgedeckt.
- Ein tatsächlicher HTTP-Durchlauf deckte auf, dass PostgREST 14.5 bei künstlich
  ausgelöstem SQLSTATE `40001` intern endlos wiederholt. Die Migration
  `*_explicit_version_conflicts.sql` stellt erwartete Versionskonflikte der beiden
  Speicher-RPCs auf `PT409` um. Der Tischclient liest bei HTTP 409 neu und rebasiert
  begrenzt, statt denselben alten Stand erneut zu senden. Alte `40001`-Antworten
  werden während des Übergangs weiterhin erkannt.
- `scripts/verify-shared-live.cjs` wurde mit drei getrennten, tatsächlich angemeldeten
  temporären Auth-Clients ausgeführt: Leser/Schreiber/Ersteller, fremder Account,
  Realtime-Zustellung, veralteter paralleler Schreibzugriff, Zusammenführung nach
  erneutem Lesen, identische Wiederholung, Löschen/Wiederherstellen derselben ID
  und Rechteentzug während eines ausstehenden Schreibstands bestanden.
- Alle temporären Auth-Konten, Sitzungen, Rundeneinträge und der Testtisch wurden
  entfernt; die lokale temporäre Kennwortdatei ebenfalls. Keine E-Mails versendet.
- SQL-Identitätsprüfungen einschließlich fehlender/doppelter IDs, ursprünglicher
  Erfassungszeit, tischübergreifender Wiederverwendung und Audit-Erhalt wurden
  zusätzlich direkt auf Supabase in zurückgerollten Transaktionen ausgeführt.
- Dieser Durchlauf prüft reale Auth-, HTTP-, Realtime- und Datenbankverträge.
  Er ersetzt keinen manuellen Funkloch-/Tastaturtest auf zwei physischen Handys.
  Stock-Neuberechnung und lokale In-Flight-Rebases sind automatisiert abgedeckt.

Fachliche Doppelmeldungen derselben echten Runde mit verschiedenen IDs bleiben
Gegenstand von #15. GitHub-Issues wurden im Rahmen dieser Arbeit nicht geändert;
der Arbeitsstand muss noch integriert werden.
