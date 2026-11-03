# Tischeinladungen (#27)

Die Einladungen verbinden Freundschaften aus #26 mit Mitgliedschaft, Rollen und Synchronisierung aus #28. Bedienung: [Gemeinsam am Tisch spielen](../gemeinsame-tische.md).

## Produktentscheidungen

- Nur der Ersteller eines offenen Tisches lädt bestätigte Freunde ein. Beim Senden wählt er ausdrücklich einen vorhandenen lokalen Spielerplatz und die Rolle. Lesen ist vorausgewählt. Auch ein bereits laufender Spielabend kann Einladungen erhalten.
- Eine Einladung reserviert diesen Platz und den Empfänger für weitere Einladungen desselben Tisches. Sie gilt sieben Tage. Abbrechen bzw. Ablehnen beendet sie ohne Änderung am Tisch.
- Der Empfänger sieht Tisch, Einladenden, Platz und Rolle, aber noch keine Spiele oder Salden. Erst die Annahme verknüpft den Account mit dem vorhandenen Platz. Spiele, Salden, Name und Spieler-ID bleiben erhalten. Der Empfänger findet den gemeinsamen Tisch danach in der bestehenden Tischliste; der aktuelle lokale Tisch wird nicht automatisch gewechselt.
- Ist der Tisch geschlossen, der Platz belegt oder entfernt, der Account bereits verknüpft oder die Freundschaft geändert, wird eine Annahme abgelehnt. Blockieren und erneutes Befreunden lassen alte Einladungen nicht wieder gültig werden. Bereits angenommene Tischrechte bleiben bis zur eigenständigen Änderung der Mitgliedschaft erhalten.
- Bestehende direkte Verknüpfungen werden beibehalten. Neue fremde Konten brauchen eine Einladung, auch wenn ein älterer Client direkt zuordnen möchte. Das eigene Konto und lokale Gäste bleiben ohne Einladung nutzbar. Push und E-Mail sind nicht Teil dieses Ablaufs.

## Technische Umsetzung

Migration `20261103171407_table_invitations.sql` ist im verbundenen Supabase-Projekt angewendet. Einladungen liegen in einer privaten Tabelle ohne direkte Nutzergrants. Zwei authentifizierte RPCs geben nur Einladungen des eigenen Accounts zurück und prüfen die übergebene Account-ID gegen `auth.uid()`. Die Ansicht enthält nur den für eine Entscheidung benötigten Ausschnitt.

Senden und Annehmen sperren zuerst das Freundespaar, dann die Tischzeile. So gelten dieselben Sperren wie bei Blockieren, Spieländerungen und Rollenwechseln. Senden prüft die erwartete Tischversion; Annehmen prüft den aktuellen Zustand des ursprünglichen Platzes, auch wenn zwischenzeitlich Spiele hinzugekommen sind. Platzverknüpfung, Mitgliedschaft, Rolle und Tischversion werden zusammen in einer Transaktion gespeichert. Die normale Tischsynchronisierung sieht dadurch die neue Version.

Der Client synchronisiert den Tisch vor dem Senden. Ist der Tisch noch lokal, kann der Ersteller ihn dabei auch ohne eigenen Spielerplatz veröffentlichen. Der Client zeigt Änderungen erst nach Serverbestätigung. Bei unklarem Ausgang speichert er den kleinen Auftrag pro Konto in SecureStore bzw. im Web in sessionStorage. Derselbe Schlüssel kann eine abgeschlossene Einladung nicht wieder öffnen und eine entfernte Mitgliedschaft nicht wiederherstellen. Offene Einladungen werden beim Öffnen, bei App-Rückkehr und manuell geladen. Bei fehlgeschlagener Aktualisierung bleibt der letzte bestätigte Stand sichtbar.

## Prüfung

- 530 Tests in 59 Jest-Suites bestanden, darunter 14 neue Tests für Einladungsservice und Oberfläche. TypeScript und ESLint für die betroffenen Dateien sind grün. Die bestehende Prüfung zur Kontoverknüpfung deckt jetzt den direkten Schutz fremder Accounts ab.
- `npm run test:database`: isolierte PostgreSQL-Tests einschließlich Zustimmung, Zugriffsgrenzen, Rollen, stabiler Spieler-ID und Historie, Ablehnen, Zurückziehen, abgelaufener Einladungen, geänderter Freundschaft, Blockierungen, belegter/entfernter Plätze und geschlossener Tische.
- Authentifizierte Live-HTTP-Prüfung mit drei temporären Konten: kein vorzeitiger Zugriff, genau eine Verknüpfung bei paralleler Annahme, genau eine offene Einladung bei parallelem Senden auf denselben Platz, konkurrierende Annahme und Rücknahme, Tischsichtbarkeit nach Annahme und keine Wiederherstellung entzogener Rechte bei altem Retry.
- Browserprüfung mit zwei getrennten Konten bei 393 × 852: Einladungsversand aus dem laufenden Tisch, Vorschau mit Spielerplatz und Schreibrecht, Annahme nach simuliertem Verbindungsabbruch über **Auftrag prüfen** und Öffnen desselben Tisches mit Schreibrecht. Screenshot: `output/playwright/table-invitation-mobile.png` (ignoriertes QA-Artefakt).
- Der [Supabase Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) meldet die private Tabelle ohne RLS-Policies erwartungsgemäß als Info. Direkte Zugriffe sind absichtlich vollständig gesperrt. Die bestehende [Passwortschutz-Einstellung](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) wurde nicht verändert.

Die temporären Sitzungen wurden widerrufen und alle Testkonten, Testtische und Zugangsdaten entfernt. Physische Geräteabnahme und Store-Build stehen aus.
