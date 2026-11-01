# Gemeinsam am Tisch spielen

Jeder nutzt sein eigenes Benutzerkonto. Beim Erstellen eines Tisches unter **Mitspieler mit Konto → Hinzufügen** nach dem Benutzernamen suchen und die passenden Konten auswählen. Der Ersteller ist bereits mit seinem Konto eingetragen.

Der Tisch wird automatisch gespeichert und erscheint unter **Tische** bei den eingetragenen Konten. Dort den Tisch öffnen: Spiele, Salden, Tarife, Reihenfolge, Leger, Stock und Abrechnung werden gemeinsam abgeglichen. Ein Tischcode oder eine Einladung ist nicht nötig. Andere Benutzer ohne Zuordnung können den Tisch nicht lesen oder ändern.

Ein von Hand eingegebener Name ist ein Gast ohne Kontozugriff. Für bestehende Tische unter **Drei Punkte → Regeln & Tarife → Spielerkonten am Tisch** das Konto zuordnen. Die Zuordnung ändert weder die Spieler-ID noch bisherige Ergebnisse. Nur der Tischbesitzer kann Konten zuordnen oder deren Zugriff entfernen; die Zuordnung wird direkt gespeichert. Der Besitzer behält den Verwaltungszugriff auf seinen Tisch.

Ein Konto kann mehrere gemeinsame Tische unter **Tische** sehen. Beim Wechsel wird zuerst der bisherige Stand übertragen. Ein Tisch mit noch nicht übertragenen Änderungen wird nicht still verworfen.

Änderungen werden über Supabase Realtime, beim Wiederöffnen und zusätzlich alle fünf Sekunden abgeglichen. Offline bleiben lokale Eingaben erhalten und werden nach Wiederverbindung erneut übertragen. Der Zeitstempel im Tischbereich zeigt den letzten bestätigten Serverstand. Noch nicht übertragene Änderungen können deshalb auf anderen Handys noch fehlen.

Gleichzeitige Änderungen werden über die Tischversion erkannt. Die App überschreibt keine Fassung still. Sie bietet an, die eigene ausstehende Fassung auf dem Gerät zu sichern und den aktuellen gemeinsamen Stand zu laden. Die betroffene Eingabe kann anschließend erneut erfasst werden. Lokale Sicherungen liegen unter `shared-conflict-backup:<Konto>:<Tisch>:<Zeit>` im Gerätespeicher.

## Datenbank und Prüfung

Die Migrationen `*_shared_live_tables.sql` und `*_live_table_player_membership.sql` sind auf dem verbundenen Projekt eingerichtet. Auf einem neuen Projekt beide der Reihenfolge nach anwenden. Nicht zusätzlich `schema.sql` ausführen.

`sk_live_tables` enthält den gemeinsamen Stand. `sk_live_members` wird serverseitig aus den Konto-IDs der Tischspieler und dem Besitzer aktualisiert. Nur diese Mitgliedschaften erlauben Lesezugriff per RLS. Direkte Schreibrechte sind gesperrt; die RPC prüft die Anmeldung, Mitgliedschaft, erwartete Version und Besitzerrechte für Kontoänderungen. Benutzername oder E-Mail werden nicht als Zugriffsberechtigung verwendet. Frühere Tischcodes vergeben keinen Zugriff mehr.

Die Kontosuche zeigt angemeldeten Benutzern Namen und Konto-IDs, keine E-Mail-Adressen. Die Standardsuche ohne Eingabe enthält das eigene Konto und bestätigte Freunde. Mindestens zwei eingegebene Zeichen durchsuchen die registrierten Anzeigenamen.

`verify-shared-tables.sql` prüft automatische Sichtbarkeit, gemeinsame Aktualisierungen, Besitzerrechte, Entzug einer Zuordnung, veraltete Schreibversuche und Fremdzugriff in einer Transaktion mit anschließendem ROLLBACK. Sie benötigt drei bestehende Auth-Konten und verändert diese Konten nicht. `verify-sync.sql` prüft die separate Kontosicherung.
