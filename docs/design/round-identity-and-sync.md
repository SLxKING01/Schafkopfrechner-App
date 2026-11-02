# Issue #9: Spielidentität und gemeinsame Speicherung

Implementierung im lokalen Main-Arbeitsstand. Keine produktive Datenbankänderung,
kein Commit und kein Push im Rahmen dieser Umsetzung.

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

`20261102111436_round_identity_guard.sql` ergänzt ein privates ID-Register mit
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

## Validierung und noch ausstehende Freigabe

- Jest prüft unabhängige Accounts, Reihenfolge bei abweichenden Geräteuhren,
  verlorene Upload-Bestätigung, Compare-and-Swap-Rennen, konkurrierende Korrekturen,
  Stock-Neuberechnung und neue Eingaben während des Uploads.
- `supabase/verify-round-identities.sql` prüft IDs, Wiederholung, Löschung und
  Wiederherstellung, unveränderliche Erfassungszeit und private Zugriffsrechte.
- Alle drei Migrationen und beide SQL-Prüfskripte werden in isoliertem PostgreSQL
  über PGlite ausgeführt. Der lokale Prüflauf prüft zusätzlich die zentrale Migration
  eines ID-losen Altspiels und den Erhalt vorhandener IDs. Supabase-Realtime-
  Publication-Anweisungen werden dort ausgelassen; dies ist kein Realtime-E2E-Test.

Vor produktiver Aktivierung: Migration gegen den tatsächlichen Datenbestand
vorprüfen und anwenden; anschließend mit zwei echten Accounts/Geräten parallele
Offline-Eingabe, Wiederverbindung, Korrekturkonflikt, Stock und Rechteentzug prüfen.
Die SQL-Sicherungstabellen bleiben für eine mögliche manuelle Wiederherstellung
erhalten. Das Issue sollte bis zur Datenbankaktivierung und dieser Abnahme offen
bleiben. Fachliche Doppelmeldungen derselben realen Runde haben unterschiedliche
IDs und werden hier nicht automatisch zusammengeführt (Folgeissue #15).
