# Gemeinsam am Tisch spielen

Jeder nutzt sein eigenes Benutzerkonto. Beim Erstellen eines Tisches kannst du Gäste per Namen eintragen oder Spielerplätze aus der Freundesliste anlegen. Dein eigenes Konto ist standardmäßig eingetragen. Die anderen Plätze bleiben zunächst lokal.

Der Ersteller lädt über **Regeln & Tarife → Freunde zu diesem Tisch einladen** ein. Wähle einen vorhandenen lokalen Platz, einen Freund und **Lesen** oder **Schreiben**. Unter **Tische → Tischeinladungen ansehen** sieht der Empfänger Tisch, Einladenden, Spielerplatz und Rechte. Erst **Einladung annehmen** verknüpft das Konto und zeigt denselben Tisch unter **Tische**. Die Spieler-ID, Spiele und Salden des Platzes bleiben erhalten.

Offene Einladungen gelten sieben Tage und können abgelehnt oder vom Ersteller zurückgezogen werden. Beitritt ist am laufenden Tisch möglich, solange Platz, Freundschaft und Tischstatus passen. Blockieren oder Entfernen der Freundschaft macht offene Einladungen ungültig; bereits bestehende Tischrechte bleiben erhalten. Falls eine Antwort ausbleibt, lässt sich der Auftrag über **Auftrag prüfen** mit derselben Kennung wiederholen.

Schreiben erlaubt Spiele anlegen, korrigieren, löschen und wiederherstellen. Regeln, Besetzung, Rechteverwaltung und Tischabschluss bleiben beim Ersteller. Unter **Regeln & Tarife → Spielerkonten am Tisch** kann er die Rolle verknüpfter Konten ändern oder ihren Zugriff entfernen. Bestehende Zuordnungen aus früheren App-Versionen bleiben erhalten.

Ein Konto kann mehrere gemeinsame Tische unter **Tische** sehen. Beim Wechsel wird zuerst der bisherige Stand übertragen. Ein Tisch mit noch nicht übertragenen Änderungen wird nicht still verworfen.

Änderungen werden über Supabase Realtime, beim Wiederöffnen und zusätzlich alle fünf Sekunden abgeglichen. Offline bleiben lokale Änderungen erhalten und werden nach Wiederverbindung erneut übertragen. Eine neue gemeinsame Spieleingabe bleibt dagegen als Entwurf erhalten und wird beim erneuten Speichern geprüft, bevor sie gemeinsam verbucht wird. Der Zeitstempel im Tischbereich zeigt den letzten bestätigten Serverstand. Noch nicht übertragene Änderungen können deshalb auf anderen Handys noch fehlen.

Gleichzeitige Änderungen werden über die Tischversion erkannt. Die App überschreibt keine Fassung still. Sie bietet an, die eigene ausstehende Fassung auf dem Gerät zu sichern und den aktuellen gemeinsamen Stand zu laden. Die betroffene Eingabe kann anschließend erneut erfasst werden. Lokale Sicherungen liegen unter `shared-conflict-backup:<Konto>:<Tisch>:<Zeit>` im Gerätespeicher.

## Parallel dasselbe Spiel erfassen

Wenn während deiner geöffneten Spieleingabe ein anderer Teilnehmer ein Spiel einträgt, zeigt die App vor dem Speichern dessen Namen und Spielart. Mit **Eintrag ansehen** kannst du die bestehende Runde prüfen und anschließend zu deiner unveränderten Eingabe zurückkehren. **Als weiteres Spiel speichern** speichert bewusst eine eigenständige Runde. Kommt inzwischen noch eine Runde hinzu, erscheint eine neue Rückfrage. Die App vereinigt oder verwirft keine Eingaben automatisch.

Offline bleibt die neue Runde als Entwurf erhalten. Über **Schließen → Entwurf behalten** lässt sie sich später fortsetzen. Nach einer unklaren Serverantwort bitte erneut speichern: Die App prüft dieselbe Runden-ID und trägt das Spiel nicht doppelt ein.

## Datenbank und Prüfung

Alle Migrationen aus `supabase/migrations` sind auf dem verbundenen Projekt eingerichtet, einschließlich Rundenschutz, Rollen und expliziten HTTP-409-Konflikten. Auf einem neuen Projekt alle Migrationen chronologisch anwenden. Nicht zusätzlich `schema.sql` ausführen. Die ältere Behauptung, gemeinsame Tabellen seien bereits vor dem 02.11.2026 eingerichtet gewesen, war unzutreffend und wurde durch direkte Live-Prüfung korrigiert.

`sk_live_tables` enthält den gemeinsamen Stand. `sk_live_members` wird serverseitig aus den Konto-IDs der Tischspieler und dem Besitzer aktualisiert. Nur diese Mitgliedschaften erlauben Lesezugriff per RLS. Direkte Schreibrechte sind gesperrt; die RPC prüft die Anmeldung, Mitgliedschaft, erwartete Version, aktuelle Lese-/Schreibrolle und Besitzerrechte für Verwaltung. Eine Rollenänderung erhöht die Tischversion. Leserechte wirken auch auf bereits geöffnete Eingaben; nicht übertragene Änderungen bleiben lokal erhalten. Benutzername oder E-Mail werden nicht als Zugriffsberechtigung verwendet. Frühere Tischcodes vergeben keinen Zugriff mehr.

Die Einladungsseite verwendet die bestätigten Kontakte aus [Freunde](freunde.md). Die Migration `20261103171407_table_invitations.sql` verhindert direkte neue Zuordnungen fremder Accounts auch über ältere Clients. Einzelheiten und Prüfergebnisse stehen in der [Umsetzung zu #27](design/table-invitations-implementation.md).

`npm run test:database` prüft die Migrationen isoliert in PostgreSQL. Die historischen Prüfungen der direkten Kontozuordnung laufen vor der Einladungsmigration. `verify-table-invitations.sql` prüft den neuen Zustimmungsablauf und die Rechte danach. `verify-sync.sql` prüft die separate Kontosicherung; `verify-round-identities.sql` prüft Spielidentitäten. Die Live-Prüfungen für Rollen und Realtime sind unter `docs/design/shared-table-permissions.md` dokumentiert.
