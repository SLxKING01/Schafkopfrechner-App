# Persönliches Profil (#25) – Implementierung

Stand: 03.11.2026. Das freigegebene Konzept aus `profile-concept.md` ist umgesetzt. Clientänderungen liegen lokal; die Migration `20261102193120_personal_profiles.sql` ist auf dem verbundenen Supabase-Projekt eingerichtet. Die physische Geräteabnahme auf iPhone steht aus.

## Verhalten

- „Profil bearbeiten“, Profilbild, Anzeigename und Akzentfarbe öffnen denselben Bearbeitungsablauf. Namen, Datum und Look bleiben bis „Profil speichern“ ein Entwurf.
- Anzeigename: erforderlich, 2–40 Unicode-Zeichen. Vorname und Nachname: freiwillig, je höchstens 80 Zeichen, nur für den eigenen Account. Geburtsdatum: freiwillig, gültiger Kalendertag, nicht zukünftig, entfernbar und privat. Anzeigenamen müssen nicht eindeutig sein; eindeutige Freundessuche bleibt #26.
- Fotoauswahl über System-Mediathek beziehungsweise Web-Dateiauswahl. Direkte Kameraaufnahme ist nicht enthalten. Die unterstützten System-Picker benötigen keine pauschale Freigabe der gesamten Mediathek; Abbruch oder Fehler lassen die übrige Profilbearbeitung bestehen. Konfigurierbare Berechtigungsbegründung ist hinterlegt, Kamera-/Mikrofonberechtigungen sind deaktiviert.
- Fotos werden beim Dekodieren auf höchstens 1024 Pixel je Achse begrenzt, mittig quadratisch zugeschnitten, auf höchstens 512 × 512 Pixel verkleinert und als JPEG neu kodiert. EXIF/XMP/IPTC und JPEG-Kommentare werden zusätzlich entfernt. Native Bilddaten werden direkt aus der erzeugten Datei gelesen; Browser-Base64-Funktionen werden nur im Web verwendet. Originalgrenze: 20 MB beziehungsweise 100 Megapixel; Uploadgrenze: 512.000 Bytes.
- Tieravatar, neutraler Platzhalter und vorhandene Akzentpalette bleiben verfügbar. Ein vorhandener geräteweiter Look wird nur nach ausdrücklichem „Look von diesem Gerät übernehmen“ übernommen.
- Neue Accounts erhalten nach bestätigter Anmeldung die Wahl „Profil ergänzen“ oder „Später“. Ohne erreichbaren Server kann die Ergänzung für die aktuelle Sitzung übersprungen werden. Bestehende Accounts werden nicht zum Ausfüllen zusätzlicher Felder gezwungen.
- Dashboard, Kontosuche, Tischanlage, aktuelle Accountdarstellung am Tisch und neu erfasste Rundenevents verwenden die Profilquelle, soweit verfügbar. Bestehende lokale Spielernamen und historische Rundenevents werden nicht umgeschrieben.

## Daten und Berechtigungen

Alle neuen Tabellen liegen im nicht exponierten Schema `private`, mit aktivierter RLS und ohne direkte Tabellenrechte für `anon`/`authenticated`:

| Tabelle | Inhalt |
| --- | --- |
| `sk_profiles` | Freigebbare Darstellung, Profilversion und Ergänzungsstatus |
| `sk_profile_private` | Eigentümergebundene Vor-/Nachnamen und Geburtsdatum |
| `sk_profile_requests` | Operations-ID und Request-Hash für idempotente Speicherung; keine vollständigen privaten Requestkopien |
| `sk_profile_image_access` | Kurzlebige Bild-Lesefreigaben für tatsächlich ausgegebene Suchtreffer |

Öffentliche RPC-Wrapper sind ausschließlich für angemeldete Accounts aufrufbar. Die privilegierten Funktionen liegen im privaten Schema, prüfen den angemeldeten Account und setzen einen leeren `search_path`. Eigentümer-RPCs geben private Angaben ausschließlich für `auth.uid()` zurück. Zusätzlich muss der im Speicherauftrag genannte Account zur aktuellen Sitzung passen. Damit kann ein Kontowechsel während einer Anfrage keine alten Formulardaten in einen anderen Account schreiben.

Minimale Profilkarten enthalten keine privaten Namen, Geburtstage oder E-Mail-Adressen. Zugriff gibt es für den eigenen Account, gemeinsame Tischmitgliedschaften und explizite, ablaufende Kontosuchtreffer. Die Suche bleibt begrenzt und sucht anhand des Anzeigenamens, nicht anhand privater Daten.

Der Bucket `profile-photos` ist privat, auf JPEG und 512.000 Bytes begrenzt. Uploadpfade gehören zum aktuellen Account. Ersetzungen verwenden neue Objektpfade; es gibt keine UPDATE-Policy. Aktuell referenzierte Fotos können nicht gelöscht werden. Nach Entfernen des Profilverweises ist die Bereinigung über die Storage-API möglich. Veraltete, unreferenzierte Dateien werden kontobezogen und begrenzt bereinigt; fehlgeschlagene Bereinigungen werden zusätzlich vorgemerkt.

Ein Foto wird nur für aktuell autorisierte Anfragen signiert. URLs gelten fünf Minuten; die Darstellung lädt bei geöffnetem Bild nach vier Minuten eine neue Freigabe. Bereits heruntergeladene Bilder und ausgegebene, noch gültige URLs können nicht rückwirkend zurückgerufen werden. Signierte URLs werden nicht in Tischdaten oder Profilidentitäten gespeichert.

Der Supabase-Sicherheitsberater meldet für die privaten Tabellen „RLS Enabled No Policy“ als Information. Hier ist fehlender direkter Zugriff beabsichtigt: Tabellenrechte sind entzogen, RLS verweigert direkte Zugriffe, Freigaben laufen ausschließlich über kontrollierte Funktionen. Die Auth-Konfiguration meldet außerdem deaktivierten [Schutz vor kompromittierten Passwörtern](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); diese Auth-Einstellung wurde durch #25 nicht geändert.

## Speichern, Entwürfe und Offlinebetrieb

- Profilversion und Operations-ID werden serverseitig unter einer Zeilensperre geprüft. Ein veralteter Auftrag erhält HTTP 409. Der Nutzer kann den aktuellen Stand ansehen, übernehmen oder die eigenen Änderungen ausdrücklich auf diesen Stand anwenden.
- Vor dem Senden werden Entwurf, erwartete Version und Operations-ID gesichert. Eine verlorene Antwort wird mit derselben Operations-ID geprüft, ohne die Änderung erneut anzuwenden. Bereits bestätigte Operationen liefern den aktuellen Profilstand.
- Neue Bilder werden vor dem Profilverweis hochgeladen. Ein fehlgeschlagener Upload verändert das bestätigte Profil nicht. Nach bestätigtem Bilderwechsel wird das bisherige Objekt bereinigt.
- Native Textentwürfe und eigener Profilcache liegen in SecureStore; vorbereitete Fotos liegen im kontobezogenen App-Dateibereich. Im Web werden private Entwürfe und Cache nur im `sessionStorage` dieses Tabs gehalten. Beim Schließen des Tabs gehen nicht gemeinsam gespeicherte Webentwürfe verloren.
- Private Profildaten gehen nicht in den allgemeinen Spielstand-Backup. Sichtbare Daten und späte Antworten werden nach Account getrennt. Logout/Kontowechsel bereinigt den sichtbaren Profilstand und den privaten Profilcache. Entwürfe bleiben für denselben Account geschützt fortsetzbar.
- Native Zurück-Navigation, Web-Zurück und die Abbrechen-Aktion verwenden denselben Entwurfsschutz. Bei einer unklaren Speicherantwort bleibt die Bearbeitung bis zur Prüfung gesperrt.

## Validierung

- Vollständiger Jest-Lauf: **492 Tests in 53 Testsuiten erfolgreich**. Nach dem Abschluss des nativen Fotoablaufs zusätzlich **27 gezielte Tests in vier Testsuiten erfolgreich**, einschließlich drei neuer Tests für native Dateidaten, Fotoabbruch/Kontowechsel und Größenbegrenzung.
- Neue Tests decken Datums-/Namensprüfung, Metadatenentfernung, Serverfehler und Retry, Offline-Entwürfe, verlorene Antworten, Versionskonflikte, Kontowechsel, Fotoabbruch und Doppeltipps ab.
- TypeScript und ESLint für die betroffenen Dateien erfolgreich; Diff ohne Whitespacefehler.
- `npm run test:database` prüft alle Migrationen einschließlich Profile, private Daten, Eigentümerprüfung, Geburtstag, doppelte Anzeigenamen und Storage-RLS auf isoliertem PostgreSQL. `verify-profiles.sql` verwendet isolierte Storage-Fixtures und ist für diesen Lauf bestimmt.
- Tatsächliche Auth-/HTTP-/Storage-Prüfung mit drei Clients: zwei Sitzungen desselben Testaccounts und ein fremder Testaccount. Erfolgreich geprüft: geräteübergreifende private Angaben, CAS, idempotente Wiederholung, verweigerter Fremdzugriff, Suchtreffer ohne private Angaben, signierter Download, unveränderliche Fotos, Fremdupload-Verweigerung, Löschschutz referenzierter Fotos und Löschen über die Storage-API.
- Browserabnahme in Edge bei 393 × 852: Ergänzungsdialog nach erster Anmeldung, ungültiger und gültiger Geburtstag, Foto auswählen/aufbereiten/vorschauen/speichern, aktualisierter Dashboardname und Foto, Profil wiederöffnen, Offlinefehler, Entwurf behalten, Seiten-Neuladen und unveränderte Wiederaufnahme, Foto entfernen, Tieravatar wählen und speichern, Logout.
- Browserkonsole im normalen Ablauf ohne Fehler; im absichtlich offline gesetzten Ablauf erwartete Netzwerkfehler. Bestehende React-Native-Web-Warnungen bleiben.
- Zwei temporäre bestätigte Testaccounts wurden ohne Registrierungs-E-Mails bereitgestellt und nach der Prüfung vollständig entfernt. Abschließende Kontrolle: **ein bestehender Account, ein zugehöriges Profil, keine temporären Testaccounts und keine Profilfoto-Testdateien**.

Die HTTP-Prüfung ist in `scripts/verify-profiles-live.cjs` reproduzierbar. Sie benötigt frisch provisionierte, bestätigte QA-Accounts in der ignorierten Datei `output/qa/profile-live-credentials.json` (`users` mit `id`, `email`, `password`) und die JPEG-Testdatei `output/qa/profile-test.jpg`. Sie legt selbst keine Accounts an und versendet keine E-Mails. Testkonten anschließend wieder entfernen. Keine Zugangsdaten einchecken.

## Verbleibende Abnahme

Physisches iPhone: System-Fotopicker einschließlich Abbruch/Ablehnung, orientierte HEIC-/JPEG-Fotos, SecureStore-Entwurf nach App-Neustart, Tastatur, große Systemschrift, native Zurück-Geste und zweites Gerät. Ein nativer Store-Build wurde nicht erstellt. Clientänderungen sind noch nicht committed/gepusht.
