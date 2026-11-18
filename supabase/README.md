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

## Konto löschen

Migration `20261117203204_account_deletion.sql` stellt das Löschen des eigenen Kontos in der App bereit (App Store Richtlinie 5.1.1(v), Google Play). Ablauf im Client (`src/services/auth/deleteAccount.ts`):

1. `sk_account_release_photo()` entfernt den Profilfoto-Verweis, damit die Storage-Policy das Löschen der Dateien erlaubt.
2. Die App löscht alle Dateien unter `<uid>/` im Bucket `profile-photos` über die Storage-API (direktes Löschen in `storage.objects` blockiert Supabase).
3. `sk_account_delete()` bricht ab, solange noch Fotos existieren, übergibt eigene gemeinsame Tische an ein anderes Mitglied (bevorzugt mit Schreibrecht; es erhält Schreibrecht) bzw. löscht Tische ohne weitere Mitglieder und löscht anschließend `auth.users`. Profil, Freundschaften, Einladungen, Cloud-Spielstand und PayPal.Me-Link folgen per `ON DELETE CASCADE`.

`verify-account-deletion.sql` prüft den Ablauf in PGlite (`npm run test:database`).

## Meldungen von Konten

Migration `20261117214019_profile_reports.sql`: Unter **Profil → Freunde** kann jedes Konto in der Liste, in Anfragen und im Suchergebnis über **Melden** gemeldet werden (Apple-Richtlinie 1.2). Gespeichert werden Grund, optionale Beschreibung und ein Abbild von Anzeigename und Profilbild in `private.sk_profile_reports`. Dieselbe Person kann dasselbe Konto höchstens einmal pro Tag melden, insgesamt höchstens 20 Meldungen pro Tag.

Offene Meldungen im SQL-Editor prüfen:

```sql
select r.created_at, r.reason, r.details, r.display_name, r.photo_path, r.target_id
from private.sk_profile_reports r where r.status = 'open' order by r.created_at;
```

Nach der Prüfung `status` auf `actioned` oder `dismissed` setzen. Ein unpassendes Profil lässt sich zurücksetzen, indem Anzeigename und Bild in `private.sk_profiles` geändert werden; bei schweren Fällen das Konto unter Authentication → Users sperren oder löschen. Apple erwartet eine Bearbeitung innerhalb von 24 Stunden. Für eine Benachrichtigung bei neuen Meldungen eignet sich ein Database Webhook auf die Tabelle.
