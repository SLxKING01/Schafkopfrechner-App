# Spieldaten-Synchronisierung

Das Projekt verwendet `public.game_states`: ein vollstaendiger JSONB-Spielstand
pro angemeldetem Konto. Er enthaelt den aktuellen Tisch mit Einstellungen,
Spielern, Runden, Salden und Zahlungsstatus sowie die separaten Spiele,
Spielerlisten, Spieltage und die Tischreihenfolge. So bleiben beide in der App
verwendeten Datenmodelle zusammen erhalten. Keine einzelnen Teil-Uploads.

`schema.sql` beschreibt die Einrichtung eines neuen Projekts. Im verbundenen
Projekt Schafkopfrechner ist sie bereits angewendet. Die alte Schema-Skizze mit
vier ungenutzten Tabellen wurde ersetzt. Keine bestehenden Spieldaten geloescht.

Nach abgeschlossener lokaler Wiederherstellung und Anmeldung synchronisiert die
App beim Start, etwa 700 ms nach einer Aenderung und beim Wechsel in den
Vordergrund. Alle 30 Sekunden werden Cloud-Aenderungen abgefragt und fehlgeschlagene
Uploads erneut versucht. Ein leeres neues Geraet uebernimmt den Cloud-Spielstand.
Ohne Anmeldung bleibt alles lokal. Bei Konto-Wechsel werden die an ein anderes
Konto gebundenen lokalen Daten nicht hochgeladen.

Speichern erfolgt atomar ueber `save_game_state` mit Versionsvergleich. Haben
zwei Geraete seit der letzten Sicherung unabhaengig Aenderungen vorgenommen,
stoppt die Synchronisierung mit einer Fehlermeldung im Dashboard. Beide Staende
bleiben erhalten; eine automatische Zusammenfuehrung oder eine Oberflaeche zur
manuellen Konfliktaufloesung ist nicht enthalten. Auch bei der ersten Anmeldung
werden unterschiedliche bestehende lokale und Cloud-Daten nicht ueberschrieben.

RLS beschraenkt alle Zugriffe auf `auth.uid() = owner_id`; anonyme Konten ohne
Session haben keinen Zugriff. Die Funktion arbeitet als `SECURITY INVOKER`.
Es werden ausschliesslich oeffentliche Client-Schluessel in der App verwendet.

Pruefung: `npx jest --runInBand`, `npx tsc --noEmit`, ESLint und Web-Export.
`verify-sync.sql` testet direkt in Postgres Speichern, Lesen, Aktualisieren,
Versionskonflikte und Kontotrennung. Saemtliche Testdaten werden zurueckgerollt.
## Passwort zurücksetzen

Unter **Authentication → URL Configuration → Redirect URLs** müssen für die Passwort-Wiederherstellung die Rücksprungziele freigegeben sein:

- Native App: `schafkopfrechner://passwort-zuruecksetzen`
- Web: die jeweilige App-URL mit `?recovery=1`, zum Beispiel `http://localhost:8081/?recovery=1` für die lokale Webvorschau.

Die Vorlage **Reset Password** muss den Supabase-Bestätigungslink `{{ .ConfirmationURL }}` verwenden. Die Mail wird auf demselben Gerät in der installierten App beziehungsweise im selben Browser geöffnet, in dem sie angefordert wurde. Für den nativen Rücksprung ist ein Build mit dem App-Schema erforderlich.

## Kontolöschung

Zuerst die Migration `20261107140826_account_deletion.sql` im Zielprojekt
einspielen, dann die Edge Function `delete-account` mit
`supabase functions deploy delete-account --project-ref <projekt>` bereitstellen.
Die Funktion verwendet die serverseitigen Variablen `SUPABASE_URL` und
`SUPABASE_SERVICE_ROLE_KEY`. Der App-Client sendet nur seine eigene Sitzung.

Nach der Bestätigung im Profil entfernt die Funktion die Profilbilder über die
Storage API. Anschließend löscht Supabase Auth das Konto samt Sitzungen. Die
Datenbank löscht Profil, Freundschaften, Einladungen und persönliche
Cloud-Sicherung. Ein eigener Tisch ohne weiteres Kontomitglied wird gelöscht.
Bei einem gemeinsamen Tisch übernimmt ein verbleibendes Kontomitglied, bevorzugt
mit Schreibrecht. Runden, Salden, Zahlungsstatus und Spielerplatz-IDs bleiben
erhalten. Kontoverknüpfungen und zugehörige Anzeigenamen werden aus dem
gemeinsamen Spiel- und Zahlungsverlauf entfernt oder durch „Gelöschtes Konto“
ersetzt. Lokale Spielstände verbleiben auf dem Gerät.

`npm run test:database` prüft den Datenbankteil mit isolierten Testkonten.
Für die Abnahme im Zielprojekt zwei Wegwerfkonten verwenden. Mit dem ersten
ein Profilbild und einen gemeinsamen Tisch anlegen, das zweite Konto einladen,
dann das erste Konto über **Profil → Konto löschen** löschen. Prüfen, dass
Anmeldung und Sitzungsverlängerung des ersten Kontos fehlschlagen, seine Dateien
verschwunden sind und das zweite Konto den Tisch samt Spielstand weiter öffnen
und verwalten kann.

## Tischzugriff und Abschlusskorrekturen

Die Migrationen `20261107143209_shared_table_access_exit.sql` und
`20261107143748_closed_table_correction.sql` in dieser Reihenfolge anwenden.
Der Zugriffswechsel lässt Spielerplatz und Aktivstatus bestehen. Ehemalige
Teilnehmer sehen unter **Tische → Persönliche Abrechnungen ehemaliger Tische**
ihren Saldo, eigene Zahlungen und deren Historie. Ein erneuter Beitritt zum
laufenden Tisch erfordert eine neue Einladung für denselben Spielerplatz.

Am abgeschlossenen Tisch können Ersteller ein Spiel zur Korrektur öffnen.
Die Vorschau zeigt alte und neue Salden und die zusätzlich nötigen Zahlungen.
Gemeldete, unbestätigte Zahlungen blockieren das Speichern. Die Datenbank
prüft die Tischversion und den Zahlungsstand erneut beim Schreiben. Bestätigte
Zahlungen aus früheren Abrechnungsversionen bleiben erhalten.

`npm run test:database` prüft Rechteentzug, Wiedereinladung, persönliche
Abrechnung und eine Korrektur mit bestätigter Zahlung auf isoliertem PostgreSQL.

## Größe des Tabellenabrufs

`node scripts/measure-shared-table-discovery.cjs` vergleicht zwei synthetische
Antworten mit jeweils zwei Tischen und 1.000 Spielen je Tisch. Die Messung
erfasst unkomprimierte JSON-Bytes beim Listenabruf. Spielhistorie und
Abrechnung werden weiterhin geladen, wenn der Tisch geöffnet wird.
