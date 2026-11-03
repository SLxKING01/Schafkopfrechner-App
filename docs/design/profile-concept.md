# Konzept: Persönliches Profil (#25)

Stand: 02.11.2026 · Vom Nutzer zur Umsetzung freigegeben. Umsetzung und Prüfstand: `profile-implementation.md`.

## Ziel und empfohlene Produktentscheidung

Ein Nutzer kann seine Profilangaben und sein Profilbild bearbeiten. Bestätigte Änderungen stehen nach erneutem Anmelden und auf weiteren Geräten zur Verfügung. Bestehende Accounts, Tischmitgliedschaften und Spielerhistorien bleiben über ihre bisherigen IDs verbunden.

Empfehlung: Ein Anzeigename ist erforderlich. Vorname, Nachname, Geburtsdatum und Foto sind freiwillig. Andere Nutzer sehen den Anzeigenamen und das gewählte Profilbild im berechtigten Nutzungskontext. Vorname, Nachname und Geburtsdatum bleiben privat. Das Geburtsdatum hat aktuell keinen erkennbaren fachlichen Zweck; es wird weder für Suche noch für Altershinweise, Geburtstagsmeldungen oder Altersprüfung verwendet. Wenn es aufgenommen wird, bleibt es ausdrücklich optional. Auf das Feld ganz zu verzichten wäre eine zu bestätigende Änderung am Issueumfang.

Die Empfehlungen wurden vom Nutzer mit „setz das so um wie du gedacht hast“ zur Umsetzung freigegeben. Das Geburtsdatum bleibt freiwillig und privat; die eindeutige Freundessuche bleibt Gegenstand von #26.

## Ausgangslage im Projekt

- `RegisterScreen.tsx` erfasst Benutzername, E-Mail und Passwort. `register.ts` speichert den Namen als `user_metadata.username`; eine garantierte Eindeutigkeit dieses Namens ist dort nicht implementiert.
- `ProfileScreen.tsx` enthält einen Profilkopf und die Aktion „Profil bearbeiten“. Letztere zeigt bisher nur einen Platzhalter. Ohne Benutzernamen erscheint im Profilkopf der feste Ersatzname „Simon“; dieser muss durch einen neutralen Ersatz ersetzt werden.
- Tieravatar und Akzentfarbe liegen im lokalen `profileAppearanceStore`, derzeit unter einem gemeinsamen Geräteschlüssel ohne Kontotrennung.
- `sk_player_accounts` liefert für die bestehende Kontosuche Account-ID und Anzeigenamen aus Auth-Metadaten. `usePlayerAccounts` ergänzt bisher einen Standardavatar statt des tatsächlichen Kontobildes.
- Dashboard, Tischanlage und Änderungsprotokoll verwenden ebenfalls Auth-Metadaten für Namen. Diese Stellen brauchen eine abgestimmte Umstellung auf dieselbe Profilquelle.

## Felder und Sichtbarkeit

| Angabe | Vorschlag | Sichtbarkeit | Verhalten |
| --- | --- | --- | --- |
| Anzeigename | Pflicht, 2–40 Zeichen | Eigener Account, bestehende Kontosuche, berechtigte Tischteilnehmer; später Freunde | Veränderbar, keine Identität oder Zugriffsberechtigung |
| Vorname | Optional, höchstens 80 Zeichen | Nur eigener Account | Unicode, Bindestriche und Apostrophe zulassen |
| Nachname | Optional, höchstens 80 Zeichen | Nur eigener Account | Gleiche Regeln wie Vorname |
| Geburtsdatum | Optional | Nur eigener Account | Gültiger Kalendertag, nicht in der Zukunft, entfernbar |
| Profilfoto | Optional | Wie Anzeigename, über autorisierten Bildzugriff | Auswählen, Vorschau, ersetzen, entfernen |
| Tieravatar | Freiwillige Alternative zum Foto | Wie Anzeigename | Bestehende Auswahl erhalten |
| Akzentfarbe | Optional, bestehende Palette | Zusammen mit dem Profil, soweit in der Oberfläche verwendet | Kontobezogen synchronisieren |
| E-Mail | Bestehendes Anmeldemerkmal | Nur eigener Account | Anzeige möglich; Änderung gehört nicht zu #25 |

„Anzeigename“ bezeichnet vorerst den bisherigen sichtbaren Benutzernamen. Doppelte Anzeigenamen bleiben möglich. Eine eindeutige Freundessuche per Benutzername oder Code wird in #26 entschieden; #25 ändert keine bestehenden Accounts zwangsweise um. Auch gleichnamige Personen bleiben durch ihre Account-IDs unterscheidbar.

Leerzeichen am Rand werden entfernt. Namen dürfen keine Zeilenumbrüche oder Steuerzeichen enthalten. Eine künstliche Beschränkung auf deutsche Buchstaben ist nicht vorgesehen. Das Geburtsdatum wird als Datum ohne Uhrzeit oder Zeitzonenverschiebung gespeichert; es wird keine unbesprochene Altersgrenze eingeführt.

## Bedienung

### Profilübersicht

Der bestehende Profilbereich bleibt der Einstieg. Der Kopf zeigt Bild oder Tieravatar, Anzeigename und Akzentfarbe. Bei fehlender persönlicher Auswahl erscheint ein neutraler Platzhalter. Bestehende bewusst gewählte Tieravatare bleiben nutzbar. „Profil bearbeiten“ führt zu einer eigenen, scrollbar aufgebauten Ansicht im bestehenden App-Stack.

Der Profilkopf und die Bildaktion führen in denselben Bearbeitungsablauf. Foto, Avatar und Farbe werden dort zunächst als Entwurf geändert. Erst „Speichern“ bestätigt diese Änderungen gemeinsam. Damit gibt es keinen unklaren Unterschied zwischen sofort gespeicherten Avataränderungen und noch offenen Textfeldern.

### Profil bearbeiten

Aufbau von oben nach unten:

1. Kopf mit „Abbrechen“, Titel „Profil bearbeiten“ und „Speichern“.
2. Bildvorschau mit „Bild ändern“. Auswahl: „Foto auswählen“, „Tieravatar wählen“ und bei vorhandenem Foto „Foto entfernen“.
3. Anzeigename mit Hinweis „So sehen dich andere am Tisch“.
4. Abschnitt „Private Angaben“ mit Vorname, Nachname und optionalem Geburtsdatum. Hinweis: „Diese Angaben sind nur für dich sichtbar.“
5. Akzentfarbe aus der vorhandenen Palette.

Unter den jeweiligen Feldern stehen konkrete Validierungsfehler. Während des Speicherns werden Änderungen und Doppeltipps gesperrt; der Abschluss bleibt sichtbar. Bei Erfolg Rückkehr zur Profilübersicht. Bei Fehler bleibt der vollständige Entwurf erhalten und „Erneut speichern“ ist möglich. Der Hauptabschluss muss auch mit Tastatur und großer Systemschrift erreichbar sein.

Zurück oder Abbrechen mit offenen Änderungen bietet „Weiter bearbeiten“, „Entwurf behalten“ und „Änderungen verwerfen“. Ein behaltenes Formular gehört ausdrücklich zum aktiven Account. Beim Kontowechsel darf es weder angezeigt noch in einen anderen Account übertragen werden. Private Entwürfe werden nicht dauerhaft in der allgemeinen Spielstandssicherung abgelegt; vor Implementierung ist für behaltene private Entwürfe ein kontobezogenes Speicherverfahren festzulegen. Ein ausgewähltes, noch nicht hochgeladenes Foto muss bei späterer Fortsetzung entweder aus einem geeigneten lokalen Entwurf verfügbar sein oder als erneut auszuwählen erklärt werden.

### Registrierung und vorhandene Accounts

Empfehlung: Anmeldung kurz halten. Der erste Schritt behält Anzeigename, E-Mail und Passwort. Danach wird als Teil des Registrierungsablaufs „Profil ergänzen“ angeboten, mit denselben optionalen Feldern wie in der Profilbearbeitung und einer klaren Aktion „Später“.

Erfordert der Account E-Mail-Bestätigung, erscheint dieser zweite Schritt erst nach Bestätigung und erster authentifizierter Anmeldung. Private Profilangaben werden vorher nicht in frei lesbare Profilfelder oder Auth-Metadaten kopiert. Bild-Uploads erfolgen erst mit gültiger Sitzung. Diese gestufte Registrierung unterstützt die Angaben aus #25, ohne vor bestätigter Anmeldung private Daten zwischenzuspeichern.

Bestehende Nutzer müssen kein Formular ausfüllen, um weiterzuspielen. Sie können ihr Profil freiwillig ergänzen. Es werden keine Vornamen, Nachnamen oder Geburtstage aus dem bisherigen Benutzernamen abgeleitet.

## Bildverhalten

Für den ersten Umfang empfehle ich Fotoauswahl aus der Mediathek beziehungsweise Dateiauswahl im Web. Direkte Kameraaufnahme ist eine optionale Folgeergänzung. Berechtigungen werden erst im passenden Ablauf angefragt; Abbruch oder Ablehnung lässt das restliche Profil vollständig nutzbar.

Die runde Anzeige erhält eine quadratische Bildgrundlage mit Vorschau. Zielwert für das gespeicherte Profilbild: höchstens 512 × 512 Pixel und 500 KB; die konkrete Eingabegrenze wird bei Umsetzung festgelegt und vor Verarbeitung geprüft. Bilder werden dekodiert, ausgerichtet, verkleinert und in ein definiertes Rasterformat neu geschrieben. Originaldatei, GPS- und sonstige EXIF-Metadaten werden nicht als Profilbild übernommen; das wird anhand von Testdateien geprüft. Ungültige Dateien und zu große Eingaben erhalten eine verständliche Fehlermeldung.

Ein neues Foto erscheint zunächst nur in der eigenen Vorschau. Schlägt der Upload fehl, bleibt das bisher bestätigte Profilbild für andere bestehen. Beim Entfernen eines Fotos erscheint ein ausdrücklich gewählter Tieravatar, sonst der neutrale Platzhalter. Ladefehler und abgelaufene Bildfreigaben erzeugen einen Platzhalter und eine erneute autorisierte Ladeanfrage, kein defektes Bildsymbol.

## Datenhaltung und Zugriff

Vorgeschlagene Trennung:

| Datenbereich | Inhalt | Zugriff |
| --- | --- | --- |
| Darstellungsprofil | Account-ID, Anzeigename, Bildobjekt-Verweis, Tieravatar, Akzentfarbe, Änderungsstand | Eigener Account; minimale freigegebene Angaben über autorisierte Kontosuche und Tischbezug |
| Private Profilangaben | Account-ID, Vorname, Nachname, Geburtsdatum | Ausschließlich eigener Account |
| Profilbildspeicher | Aufbereitete Bilddatei unter kontobezogenem Objektpfad | Eigene Schreibrechte; Leserechte passend zur Profilfreigabe |

Tabellennamen und RPC-Signaturen werden erst in der Umsetzung festgelegt. Wichtig ist die tatsächliche Trennung: Ein fremder berechtigter Tischteilnehmer darf private Spalten auch über direkte API-Aufrufe nicht lesen. Namen und Bilder vergeben keine Tischrechte. Die Account-ID bleibt der einzige Bezug zu Authentifizierung und Mitgliedschaft.

Empfehlung: privater Storage-Bucket. Die Anzeige nutzt autorisierte Downloads oder kurzlebige signierte URLs. Signierte URLs werden nicht als dauerhafte Profilidentität gespeichert; gespeichert wird der Objektpfad. Der öffentliche Internetzugriff auf alle Profilfotos ist nicht vorgesehen. Bereits heruntergeladene Bilder und noch gültige signierte URLs lassen sich durch Entfernen eines Kontakts nicht rückwirkend zurückholen; die Gültigkeitsdauer und Cache-Regeln müssen dazu passen.

Die Datenbank wird die maßgebliche Quelle für aktuelle Profilangaben. Auth-Metadaten dienen während der Migration als Rückfall für alte Accounts, nicht als zweite gleichberechtigte Quelle. Alle betroffenen Namens- und Avataranzeigen werden auf denselben Profilzugriff umgestellt. Private Angaben werden nicht in Tischpayloads, Namenssuche oder Rundenevents aufgenommen.

## Speichern, Konflikte und Bilderwechsel

Textangaben und Bildverweis werden in einer autorisierten, versionierten Profiländerung bestätigt. Zwei Geräte dürfen sich nicht unbemerkt überschreiben. Bei veraltetem Stand bleibt der Entwurf erhalten; Nutzer können den neuen Stand ansehen und ihre Änderung gezielt erneut übernehmen. Es gibt kein automatisches Überschreiben nach Gerätezeitstempel.

Ein Profilbild benötigt einen mehrstufigen Ablauf:

1. Aufbereitetes neues Bild unter einem neuen, kontobezogenen Objektpfad hochladen.
2. Profiländerung einschließlich Bildverweis und erwarteter Profilversion serverseitig bestätigen.
3. Eigenes Profil und betroffene Darstellungen aktualisieren.
4. Nicht mehr referenzierte alte Bilder bereinigen. Ein fehlgeschlagener Bereinigungsschritt wird wiederholt; er macht die bestätigte Profiländerung nicht rückgängig.

Schlägt Schritt 2 fehl, bleibt das bisherige Profil gültig. Der neue Upload wird erneut verwendet oder als nicht referenziertes Objekt bereinigt. Bereinigung muss parallele Geräteänderungen berücksichtigen und darf kein noch verwendetes Bild löschen. Wiederholte Anfragen benötigen eine stabile Operations-ID, damit eine verlorene Antwort nicht zu wiederholten Uploads oder irreführenden Konflikten führt.

Nach Speichern und erneutem Anmelden wird der Serverstand geladen. Beim Öffnen des Profils oder Rückkehr in die App werden veraltete Angaben neu geprüft. Für #25 ist keine zusätzliche permanente Realtime-Verbindung nur für Profiländerungen erforderlich. Offline wird ein vorhandener Profilstand angezeigt; Bearbeitung bleibt als Entwurf möglich. Erfolg wird erst nach Serverbestätigung gemeldet.

## Bestand und Migration

- Vorhandene Account-IDs und Tischmitgliedschaften bleiben erhalten.
- Bestehenden sichtbaren Namen kontrolliert aus den vorhandenen Metadaten übernehmen; bei bereits vorhandenen unterschiedlichen `username`-/`display_name`-Werten die Auswahl anhand des Bestands klären und nicht still überschreiben.
- Historische Rundenevents behalten den damals protokollierten Erfasser-Namen. Eine Profiländerung schreibt die Historie nicht um.
- Gespeicherte lokale Spielernamen nicht global ersetzen. Aktuelle Accountdarstellung und historische Spielerbezeichnung bleiben getrennt.
- Die bisherige geräteweite Avatar-/Farbauswahl hat keinen belegbaren Accountbesitzer. Deshalb keine automatische Cloudübernahme beim nächsten Login. Stattdessen eine einmalige Vorschau „Look von diesem Gerät übernehmen“, falls der Account noch keinen eigenen Look hat. Nur bestätigte Übernahmen werden gespeichert.
- Neue Profilcaches und Entwürfe nach Account trennen; Kontoabmeldung und Kontowechsel bereinigen die sichtbaren privaten Daten.

## Umfang und Reihenfolge

1. Produktentscheidungen und Sichtbarkeit abstimmen.
2. Profilmodell, Eigentümerzugriff, minimale Profilfreigabe und versioniertes Speichern mit Bestandsmigration umsetzen.
3. Bestehende Profilübersicht, Bearbeitung und gestufte Registrierung anschließen; gemeinsame Namensquelle herstellen.
4. Fotoauswahl, Bildverarbeitung, privater Upload, Avatar-/Farbsynchronisierung und Bereinigung anschließen.
5. Gerätewechsel, Offlineabläufe, Fehlerfälle und Zugriff mit mehreren Accounts prüfen.

Freundschaftsanfragen und deren Suchmethode bleiben #26, Tischeinladungen #27, PayPal.Me #11. Eine Bio, neue Abofunktionen oder die Aktivierung sämtlicher vorbereiteter Profileinstellungen gehören nicht zu diesem Konzept.

## Abnahme

- Neuer Account mit und ohne optionale Angaben; Registrierung mit E-Mail-Bestätigung und späterem Ergänzen.
- Bestehender Account ohne Profilzeile, mit abweichenden alten Namensfeldern und mit lokalem Tieravatar.
- Gültige und ungültige Namen; gültiges Schaltjahr, unmögliches Datum, heutiges und zukünftiges Datum; Geburtstagsfeld wieder leeren.
- Foto wählen, Auswahl abbrechen, Berechtigung ablehnen, ersetzen und entfernen; sehr große, beschädigte und unterschiedlich ausgerichtete Bilddateien; Metadatenprüfung.
- Speichern mit Uploadfehler, Serverfehler, Zeitüberschreitung und verlorener Antwort. Entwurf und bisher bestätigtes Profil bleiben nachvollziehbar erhalten.
- Zwei Geräte desselben Accounts: neue Angaben laden und parallele Bearbeitung ohne stillen Datenverlust prüfen.
- Zwei verschiedene Accounts: fremde private Angaben, Profiländerungen und Uploadpfade direkt per API ablehnen; nur freigegebene Darstellung liefern.
- Logout und Kontowechsel während offener Bearbeitung oder Upload; keine Übertragung in ein anderes Konto.
- Unveränderte Spielstände, Salden, IDs und historische Protokolle nach Namens- und Bildänderung.
- iPhone und Web, große Schrift, Tastaturzugänglichkeit, Lade-/Leer-/Fehlerzustände und Rückkehr aus der Bildauswahl.

## Bestätigte Empfehlungen

| Entscheidung | Empfehlung |
| --- | --- |
| Sind Vor-/Nachname Pflicht? | Beide freiwillig |
| Wer sieht Vor-/Nachname? | Nur der Nutzer selbst; andere sehen den Anzeigenamen |
| Soll das Geburtsdatum überhaupt erfasst werden? | Wenn im Issueumfang beibehalten: freiwillig, privat und ohne zusätzliche Verwendung; alternativ nach Bestätigung streichen |
| Müssen Anzeigenamen eindeutig sein? | In #25 nicht erzwingen; eindeutige Auffindbarkeit separat in #26 entscheiden |
| Foto oder bisheriger Tieravatar? | Beides unterstützen; ohne Auswahl neutraler Platzhalter |
| Kameraaufnahme in Version 1? | Zunächst nur Foto-/Dateiauswahl |
| Zusätzliche Registrierungsfelder sofort verpflichtend? | Nein; optionaler Ergänzungsschritt nach authentifizierter Anmeldung |

## Technische Referenzen

- [Issue #25](https://github.com/SLxKING01/Schafkopfrechner-App/issues/25)
- [Expo SDK 58: ImagePicker](https://docs.expo.dev/versions/v58.0.0/sdk/imagepicker/) – Grundlage für die plattformabhängige Bildauswahl; konkrete Optionen vor Implementierung erneut prüfen.
- [Supabase: Storage Buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) – private Buckets, Zugriffskontrolle und zeitlich begrenzte Bildfreigabe.
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) – Zugriff auf eigene und explizit freigegebene Datensätze.
