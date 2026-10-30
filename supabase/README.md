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
