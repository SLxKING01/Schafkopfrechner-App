# Umsetzung: Freunde und Kontaktanfragen (#26)

Stand: 03.11.2026. Grundlage ist das [bestätigte Konzept](friends-concept.md), einschließlich Blockieren. Bedienung: [Freunde](../freunde.md).

## Oberfläche und Client

Die neue Route `Friends` ist im Profil erreichbar und verwendet eine virtualisierte SectionList für Freunde, eingehende/ausgehende Anfragen und eigene Blockierungen. Die vollständige Codesuche zeigt vor dem Senden eine Profilvorschau. Entfernen, Blockieren und Entblockieren verlangen eine Bestätigung. Kopieren verwendet Expo Clipboard v58 direkt aus der Benutzeraktion.

Der bestätigte Zustand liegt ausschließlich im kontogebundenen Speicher. Laden, Fehler, leere Listen und vorhandene Daten bei fehlgeschlagener Aktualisierung sind getrennte Zustände. Aktualisierung erfolgt beim Fokus, bei Rückkehr in den Vordergrund, manuell und nach Änderungen; es gibt kein Polling. Späte Antworten eines abgemeldeten Accounts werden verworfen. Suche verwirft Antworten für inzwischen geänderte Eingaben.

Vor einer Mutation speichert der Client den kleinen Auftrag samt Operations-ID in SecureStore, im Web in sessionStorage. Ein unbekannter Ausgang bleibt wiederholbar; eine neue Aktion darf diesen Auftrag nicht ersetzen. Wiederholungen verwenden dieselbe ID und denselben Payload. Listen und Blockierungen werden nicht dauerhaft lokal gespeichert. Clientseitige Schreib- und Ladeoperationen sind gegeneinander gesperrt; neue Zustände ersetzen nur ältere oder gleich versionierte Zustände.

## Datenbank

Migration: `20261103155732_friendships_and_blocks.sql`, auch im verbundenen Supabase-Projekt angewendet.

Private Tabellen speichern zufällige persönliche Codes, je ein kanonisches Accountpaar, gerichtete Blockierungen, Limits und Operations-IDs. Codes entstehen beim ersten Zugriff: zwölf unabhängige Zeichen aus `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (60 Bit), eindeutig und als `XXXX-XXXX-XXXX` dargestellt. Es gibt keine Präfixsuche und keine öffentliche Codeliste.

Die öffentlichen RPCs `sk_friends_state`, `sk_friends_find` und `sk_friends_command` prüfen den übergebenen Account gegen `auth.uid()`. Private Definer-Funktionen kapseln alle Tabellenzugriffe; Hilfsfunktionen sind nicht direkt für authentifizierte Nutzer ausführbar. Auf den privaten Tabellen sind RLS und fehlende direkte Grants absichtlich eine vollständige Zugriffssperre. Entsprechende Advisor-Infos über RLS ohne Policies sind daher erwartet.

Paarweise Zeilensperren serialisieren konkurrierende Anfragen, Annahmen und Blockierungen. Versionsnummern und Anfrage-/Blockierungs-IDs schützen vor veralteten Aktionen. Gegenläufiges Senden erzeugt keine automatische Freundschaft. Blockieren beendet Beziehung und Anfrage atomar. Gegenseitige Blockierungen bleiben getrennt; Entblockieren entfernt ausschließlich die eigene passende Blockierung und stellt nichts wieder her.

Operations-IDs sind pro Account gebunden. Derselbe Auftrag liefert beim Retry den aktuellen Zustand, ohne eine inzwischen entfernte Beziehung wieder anzulegen. Derselbe Schlüssel mit anderem Payload wird abgelehnt. Auftragseinträge werden nach 30 Tagen bei folgenden Schreibzugriffen bereinigt.

Limits pro Account/Minutenfenster: 120 Zustandsabfragen, 20 Codesuchen, 10 Sendeversuche, 30 sonstige Änderungen. Geschäftliche Ablehnungen verwenden Fehlerantworten statt Transaktionsabbrüchen, damit die Limits auch dabei fortgeschrieben werden.

Profilzugriff umfasst Freunde und offene Anfragen. Ein exakter Suchtreffer erlaubt die Bildvorschau für 15 Minuten. Blockieren entfernt solche Freigaben in beiden Richtungen. Bestehende gemeinsame Tischmitgliedschaften behalten ihren Profilzugriff. Die private Liste eigener Blockierungen enthält einen gespeicherten Anzeigenamen und einen neutralen Avatar, keine aktuellen privaten Profildaten des blockierten Accounts.

## Prüfung

- Gesamte Jest-Suite: **516 Tests in 57 Suites bestanden**. Davon 21 neue Tests für DTOs, Service, Wiederholungen, Kontowechsel und Oberfläche.
- TypeScript und ESLint für die neuen Dateien bestanden.
- `npm run test:database`: alle Migrationen und SQL-Prüfungen einschließlich `verify-friends.sql` bestanden; Transaktion wird zurückgerollt.
- Live mit drei temporären bestätigten Accounts und getrennten authentifizierten Sitzungen: Zugriffsschutz, genaue Suche, private Felder, wiederholte Operationen, Gegenanfragen, Annahme/Ablehnung/Zurückziehen/Entfernen, gleichzeitige Anfragen, Blockieren gegen Annahme, gegenseitiges Blockieren, einseitiges Entblockieren und paralleles Suchlimit geprüft. Gemeinsame Tischdaten und Rechte blieben unverändert. Es wurden keine E-Mails versendet.
- Mobiler Browser (393 × 852) und zweites isoliertes Browserkonto: Vorschau, Senden, ausdrückliche Annahme und Freundesliste sowie Blockieren und eigene Blockliste geprüft. Bildschirmaufnahme unter `output/playwright/friends-mobile.png` (ignoriertes QA-Artefakt).
- Browser offline während Entblockieren: bestätigte Blockierung bleibt sichtbar, Auftrag bleibt über Neuladen erhalten, erneutes Prüfen nach Wiederherstellung der Verbindung hebt ausschließlich die eigene Blockierung auf. Keine Freundschaft wird wiederhergestellt.

Die temporären Live-Testkonten und ihr gemeinsamer Testtisch wurden nach der Prüfung entfernt; übrig bleiben der zuvor vorhandene Account und sein Profil. Die separaten Browser wurden geschlossen und die temporären Zugangsdaten entfernt.

Ein nativer Test auf einem physischen iPhone/Android-Gerät und ein Store-Build stehen aus. Tisch-Einladungen über Freunde (#27), Push und E-Mail sind kein Bestandteil dieser Umsetzung.
