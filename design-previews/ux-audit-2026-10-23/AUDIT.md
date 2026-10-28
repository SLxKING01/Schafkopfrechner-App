# Mobile UX-Prüfung – Schafkopfrechner

Stand: 23. Oktober 2026. Analysiert wurde der aktuelle lokale Arbeitsstand unter `http://localhost:8081`, einschließlich der vorherigen Änderungen. Die Oberfläche nennt sich im Onboarding „Version 1.0.0“; „2.0“ wird hier als Bezeichnung des beauftragten Produkts verstanden.

## 1. Bestandsaufnahme und Gesamturteil

**Vorläufiges Urteil: 4 von 10.** Das ist eine grobe Gesamtbewertung, keine Messzahl. Einfache Offline-Spiele lassen sich erfassen und wiederfinden. Für eine abgelenkte Spielrunde ist der Stand wegen beschädigbarer Abrechnungen, fehlender Erreichbarkeit auf kurzen Displays und zweier auseinanderlaufender Bedienmodelle noch nicht zuverlässig genug. Die moderne angemeldete Oberfläche kann wegen ausschließlich codebasierter Prüfung keine positive mobile Freigabe erhalten.

**Kein produktiver Spielstand und keine Datenbank wurden verändert.** Browsertests liefen in frischen, flüchtigen Edge-Profilen ohne Anmeldung. Alle Netzwerkanfragen außerhalb von localhost wurden blockiert. Testnamen: Anna, Max, Flo, Julia. Die gespeicherten JSON-Protokolle enthalten ausschließlich diese isolierten Testdaten. Der Audit hat keinen Anwendungscode geändert.

### Tatsächlich vorhandene Anwendung

| Einstieg | Vorhandener Stand | Prüfstatus |
|---|---|---|
| Ohne Konto | Helle Oberfläche mit Spiele, Neues Spiel, Statistik, Historie, Spieler; eigenes `games`-/`matchDays`-Modell | Im Browser bedient |
| Angemeldet | Dunkle Oberfläche mit Dashboard, Statistik, Tischen, Profil; Tischanlage, Rundeneingabe, Abrechnung | Aus Code abgeleitet; keine echte Anmeldung vorgenommen |
| Dashboard | Fest eingetragene Kennzahlen, Beispielspiele und Beispielzahlungen; mehrere vorbereitete Aktionen | Aus Code abgeleitet |
| Speicherung | Lokale Persistenz; Cloud-Snapshots bei Anmeldung; Konflikte werden gestoppt | Lokale Persistenz im Browser geprüft; Cloud-Verhalten in diesem Audit nur aus Code abgeleitet |
| Tische | Nur aktueller echter Tisch; laufend → Spiel, abgeschlossen → Abrechnung | Aus Code abgeleitet; frühere Komponententests sind kein Browsernachweis dieses Audits |

**Belegarten:** **B** = im automatisierten Browser beobachtet; **C** = aus aktuellem Code abgeleitet; **O** = noch offen. Ein Codebefund wird nicht als erfolgreicher Smartphone-Test gewertet.

### Testumgebung und Grenzen

Headless Microsoft Edge, Chromium-Engine, mobile Browserkonfiguration mit Touch-Unterstützung. Geprüfte CSS-Viewports:

| Viewport | Onboarding | Offline-Eingabe mit 4 Spielern | Offline-Übersicht mit Spiel | Ergebnis |
|---|---|---|---|---|
| 360 × 740 | B | B | B, einschließlich Scrollversuch | Kein dokumentweites horizontales Überlaufen auf den geprüften Ansichten; Spielerchips benötigen zwei Spalten |
| 390 × 844 | B | B | B | Erfassen und Korrigieren möglich; Spielkarte in Übersicht teilweise abgeschnitten |
| 430 × 932 | B | B | B, einschließlich Scrollversuch | Mehr Platz, aber dieselbe strukturelle Bedienreihenfolge |
| 390 × 568 | B | B | B, einschließlich Scrollversuch | Optionen/Verlierer zunächst außerhalb des sichtbaren Formularbereichs; Übersichtsaktionen unten nicht durch normales Scrollen erreichbar |

Die Spieltypenliste scrollt absichtlich horizontal; der teilweise sichtbare nächste Typ ist kein Beleg für dokumentweites Überlaufen. Gemessene Dokumentbreite entsprach bei den Formularprüfungen jeweils der Viewportbreite.

**Nicht getestet:** echtes Smartphone, Mobile-Preview-Webview selbst, iOS Safari, tatsächliche Bildschirmtastatur, VoiceOver/TalkBack, echte schlechte Beleuchtung, Schrifteinstellung 200 %, reale Cloud-Latenz und Mehrgerätebedienung. Geringe Browserhöhe simuliert keine Bildschirmtastatur vollständig. Keine belastbaren Aussagen über Einhandgeschwindigkeit oder Fehlerraten echter Nutzer.

## 2. Systematische Prüfung der Nutzerabläufe

Interaktionen sind notwendige UI-Aktivierungen im konkret geprüften Beispiel; Texteingabe, Scrollen und Wartezeit werden gesondert genannt. Sie sind keine Zeitmessung.

| Ablauf | Beobachtung / Status | Aufwand und Fehlerrisiko | Kürzerer, sicherer Zielablauf |
|---|---|---|---|
| 1. Erststart | B: Anmelden, Registrieren und „Ohne Account spielen“ klar benannt. Offline-Einstieg öffnet eine andere Oberfläche. „Spieltag abschließen“ steht dort schon ohne Spiele prominent oben. | 1 Aktivierung bis Offline-Übersicht. Orientierung zum eigentlichen Beginn unnötig indirekt. | Primär „Runde starten“; darunter Anmeldung und „Runde fortsetzen“, falls vorhanden. |
| 2. Vier Spieler anlegen / starten | B: Offline-Einstieg → Spieler-Tab → viermal Name eingeben und Hinzufügen → Neues Spiel. Keine explizite Tischanlage in diesem Zweig. Doppelte Namen werden akzeptiert. | 11 Aktivierungen ab Erststart: Einstieg + Spieler-Tab + 4 Feldfokussierungen + 4 Hinzufügen + Neues-Spiel-Tab; dazu 4 Namen tippen. | Eine Startmaske mit vorhandenen Spielern, eindeutigen Chips und einem „Runde starten“-Button. Namenseingabe nur für neue Personen. |
| 3. Ein Spiel erfassen | B: Anna als Gewinner, Max als Verlierer, Standard-Sauspiel, Speichern. Ein Spiel entsteht; Übersicht zeigt +10/−10 und „Max zahlt Anna 10,00 €“. | Ab Übersicht 4 Aktivierungen: Neues Spiel, Gewinner, Verlierer, Speichern. Mit drei Verlierern 6; Typwechsel/Optionen/Scrollen zusätzlich. Was „10 €“ pro Person bzw. insgesamt bedeutet, wird nicht erläutert. | Parteien auswählen, Betrag und Zahlungswirkung zusammenfassen, unten speichern. Automatisch abgeleitete Gegenspieler, soweit Spielart/Teilnehmer das eindeutig erlauben. |
| 4. Weitere Spiele | B: Speichern führt zurück zur Übersicht; neues Spiel erneut über Tab. Typ und Optionen werden zurückgesetzt. Ein Doppelklick beim zweiten Speichern erzeugte in diesem Test nur einen zweiten Datensatz: 1 → 2 Spiele. | Wieder mindestens 4 Aktivierungen, wiederholte Auswahl und Scrollen. Der einzelne Doppelklicktest beweist keine allgemeine Duplikatsicherheit. | „Speichern & nächstes Spiel“ lässt Eingabe offen; relevante Tischvorgaben bleiben erhalten, Gewinner/Parteien werden bewusst zurückgesetzt. |
| 5. Fehler korrigieren | B: Bearbeiten → Solo → Änderungen speichern änderte das vorhandene Spiel von 10 auf 50 €, ohne neuen Datensatz. „Letztes Spiel rückgängig“ entfernte es sofort, ohne Rückholung. C: Moderne `rounds` haben keine entsprechende Editier-/Undo-Aktion im Verlauf. | 3 Aktivierungen für den geprüften Editierfall, 1 für irreversibles Undo. Bei geringer Höhe sind Übersichtsaktionen nicht erreichbar. | Sichtbare Aktion „Letzten Eintrag korrigieren“; nach Löschen/Undo 8 Sekunden „Wiederherstellen“. Gleiche Funktionen für beide Oberflächen. |
| 6. Zwischenstand und Zahlung | B: Zahlungsrichtung ist als Satz verständlich. Nach Löschen einer beteiligten Person wird der Gewinner „Unbekannt“ und trotz −10 € Restschuld „Keine Auszahlungen offen“ angezeigt. | Vor dem Löschen verständlich; danach fachlich unzuverlässig. C: Rufspiel/Sauspiel unterstützt nur einen Gewinner statt zweier Parteien. | Beteiligte historisch stabil halten; Salden auf Konsistenz prüfen; „Erhält“/„Zahlt“ und eindeutige Gewinnparteien darstellen. |
| 7. Unterbrechung / Neuladen | B: Zwei gespeicherte Spiele blieben erhalten. Nach Reload erscheint erst das Onboarding; erneuter Offline-Einstieg nötig. Ein nicht gespeicherter Gewinnerentwurf blieb nicht erhalten. Im bereits geladenen Browser konnte offline ein weiteres Spiel lokal gespeichert werden. | 1 unnötiger Einstiegstipp plus erneute Orientierung; Entwürfe gehen verloren. Kein Offline-Kaltstartnachweis. | Start direkt in laufender Runde; Entwurf wiederherstellen und „Lokal gespeichert / Cloud ausstehend“ getrennt zeigen. |
| 8. Abschließen / Wiederfinden | B: Spieltag abschließen öffnet zunächst eine Zusammenfassung. Erst „Neuen Spieltag starten“ schließt den bisherigen Tag und erzeugt den nächsten. Danach Historie → Heute → Detail mit 2 Spielen erfolgreich. C: Moderne Tischabrechnung wird beim nächsten Tisch zurückgesetzt, ohne gemeinsame Historie. | 4 Aktivierungen bis Historiedetail ab Übersicht, wenn direkt neuer Tag gestartet wird. Abschlusswirkung und Buttontext passen nicht zusammen. | „Abschluss prüfen“ → „Spieltag verbindlich abschließen“ → „Archiviert“. „Neue Runde starten“ separat, alte Ergebnisse dauerhaft erreichbar. |

## 3. Was funktioniert gut?

* **B: Spielerchips mit 104 × 48 CSS-Pixeln** und Standardbuttons mit ca. 45 Pixel Höhe sind im geprüften Offline-Formular ausreichend groß. Beibehalten; die 44-Pixel-Messlatte ist dort überwiegend erfüllt.
* **B: Fester Speicherbereich im Eingabeformular.** Betrag und Speichern bleiben beim Scrollen erreichbar. Beibehalten, aber Platzbelegung auf kurzen Displays reduzieren.
* **B: Gewinner kann nicht gleichzeitig als Verlierer gewählt werden.** Der entsprechende Chip wird deaktiviert; das verhindert einen einfachen Eingabefehler.
* **B: Explizite Zahlungsrichtung.** „Max zahlt Anna 10,00 €“ ist deutlich verständlicher als eine isolierte rote oder grüne Zahl.
* **B: Gespeicherte Daten überleben Reload; lokale Erfassung funktioniert im bereits geladenen Offline-Browser.** Diese Grundlage erhalten und durch sichtbare Bestätigung ergänzen.
* **B: Bestehende Offline-Spiele sind tatsächlich editierbar.** Die Änderung ersetzt den Eintrag. Keine bloß dekorative Bearbeiten-Aktion.
* **C: Die moderne Rundeneingabe enthält beschriftete Auswahlaktionen, einen Dezimal-Tastaturhinweis und einen mindestens 60 Pixel hohen GoldButton.** Gute Ansätze; Tastatur und Screenreader bleiben real zu testen.

## 4. Priorisierte Problemliste

Aufwand: **S** = lokal begrenzte Anpassung; **M** = mehrere Komponenten/Tests; **L** = Datenmodell, Migration oder mehrere Abläufe. Keine verbindliche Zeitschätzung.

| Priorität | Seite / Ablauf | Konkretes Problem | Beleg / Reproduktion | Auswirkung am Handy | Konkrete Lösung | Aufwand |
|---|---|---|---|---|---|---|
| **P0** | Offline-Spieler / Abrechnung | Löschen eines verwendeten Spielers beschädigt die fachliche Darstellung. | **B:** Anna gewinnt 10 € gegen Max → Anna im Spieler-Tab löschen → „Unbekannt“, Max −10 €, „Keine Auszahlungen offen“. [Screenshot](after-referenced-player-delete.png). | Falsche Schlussfolgerung über noch nötige Zahlungen; historische Zuordnung verloren. | Verwendete Spieler nur deaktivieren. Historische Teilnehmerdaten erhalten. Nicht ausgeglichene Salden dürfen nie als „Keine Auszahlungen“ ausgegeben werden. | M |
| **P0** | Moderner Tischwechsel / Archiv | Abgeschlossene Tischrunden besitzen keine dauerhafte, gemeinsam abrufbare Historie. | **C:** `SettlementScreen.startNewTable()` ruft `resetGame()` auf. `currentTable`, `rounds`, `settlements` werden gelöscht; `createTable()` ersetzt sie ebenfalls. Die bestehende Historie liest dagegen `games`/`matchDays`. | Nach „Neuen Tisch starten“ kann das vorherige Ergebnis nicht mehr über die App wiedergefunden werden; späterer Cloud-Snapshot enthält es ebenfalls nicht mehr. | Vor jedem Wechsel eine abgeschlossene Sitzung mit Teilnehmern, Tarifen, Spielen und Zahlungen unveränderlich archivieren; Archiv in beiden Einstiegen öffnen. | L |
| **P1** | Offline-Übersicht | Kein gemeinsam scrollbarer Inhaltsbereich. | **B:** Bei 390 × 568 bleibt Undo bei y≈614, unterhalb der ca. 504 Pixel hohen Inhaltsfläche; Wheel-Scroll verändert die Position nicht. Vier-Spieler-Beispiel zeigt auch Auszahlung/Spiele abgeschnitten. [Screenshot](home-after-scroll-390x568.png). **C:** `HomeScreen` ist ein fester View mit mehreren Listen. | Korrigieren und Verständnis des Verlaufs scheitern bei geringer Höhe; kleinere innere Listen ersetzen keine Seitennavigation. | Eine äußere virtuelle Liste mit Headerabschnitten; keine konkurrierenden vertikalen Scrollbereiche. 100–120 Pixel Bottom-Inset einschließlich Tabbar. | M |
| **P1** | Angemeldetes Dashboard | Kennzahlen und Zahlungen sind echte-looking Beispieldaten. | **C:** `DashboardScreen` setzt 24 Runden, 62 %, 16,50 € offen und +28 € fest; `recentGames`/`settlements` sind Konstanten. | Nutzer kann erfundene Zahlen für tatsächliche Schulden halten. | Ausschließlich berechnete Daten anzeigen; ansonsten „Noch keine Spiele“. Demo-Modus ausdrücklich separat und nie mit echten Zahlungen vermischen. | M |
| **P1** | Spielart / Parteien | Rufspiel/Sauspiel bietet nur einen Gewinner. | **C:** Beide Eingaben verwenden `winnerId: string`. Die Rechnung schreibt den gesamten Gewinn einer Person gut. | Ein übliches gewonnenes Partnerspiel lässt sich nicht als zwei Gewinnerparteien abbilden. | Gewinner-/Verliererpartei und spielartspezifische Rollen modellieren; Auszahlung pro Beteiligtem vor Speicherung zeigen. Regeln mit fachkundigen Spielern prüfen. | L |
| **P1** | Moderne Rundeneingabe | Keine Korrektur oder Undo für gespeicherte Tischrunden. | **C:** Verlauf rendert `MatchHistoryCard`; Store bietet für `rounds` Hinzufügen, aber kein Update/Delete/Undo. Die Offline-Editierfunktion bearbeitet das andere Datenmodell. | Versehentlich gespeicherter Betrag/Spieler bleibt abrechnungswirksam. | Rundenzeile öffnet Bearbeiten; idempotentes Update; Undo der letzten Änderung mit Wiederherstellung. | M |
| **P1** | Cloud-Konflikt | Fehlermeldung ohne möglichen Lösungsweg. | **C:** `syncGameState` bricht bei unterschiedlichen Versionen ab; keine Auswahl, Zusammenführung oder Exportaktion im UI. | Nutzer kann nach parallelen Änderungen dauerhaft nicht weiter synchronisieren. | Beide Stände sichern; Konfliktansicht mit Zeitpunkt, Vergleich und ausdrücklich bestätigter Übernahme oder Zusammenführung. | L |
| **P1** | Spielerzuordnung | Doppelte Spielernamen werden ohne Warnung angenommen. | **B:** Anna, Max, Anna anlegen → beide Anna erscheinen identisch. | Während einer abgelenkten Runde ist die Identität nicht zuverlässig erkennbar. | Vor dem Anlegen Namenskonflikt anzeigen; abweichenden Anzeigenamen verlangen oder stabile unterscheidbare Kennzeichnung anbieten. | S |
| **P2** | Erststart / Wiederaufnahme | Offline-Nutzer landen nach Reload erneut im Onboarding. | **B:** 2 gespeicherte Spiele → Reload → Anmelden/Registrieren/Offline statt laufender Runde. [Screenshot](reload-returns-onboarding.png). | Unsicherheit, ob Daten noch vorhanden sind; unnötiger Wiedereinstieg. | Lokale laufende Sitzung vor Auth-Onboarding priorisieren; Kontoanmeldung separat erreichbar halten. | M |
| **P2** | Erfassungsserie | Nach jedem Speichern zurück zur Übersicht; Typ/Optionen zurück auf Standard. | **B/C:** Geprüfter Ablauf und `CreateGameScreen.handleSaveGame`. | Wiederholte Tabwechsel und erneute Auswahl; erhöht Fehlbedienungsrisiko. | „Speichern & nächstes Spiel“; Tischvorgaben erhalten; kleine Bestätigung mit Undo und Rundenzähler. | M |
| **P2** | Entwurf / Abbruch | Nicht gespeicherter Entwurf geht bei Reload verloren; moderne Maske verwirft ihn beim Schließen. | **B:** Gewinner auswählen → Reload → Eingabe nicht fortgesetzt. **C:** Draft nur React-State; moderne Schließaktion ruft `resetRoundDraft()` auf. | Unterbrechungen zwingen zur Neueingabe; versehentlicher Hintergrundtipp kann Arbeit verwerfen. | Entwurf lokal autospeichern; bei geändertem Entwurf Schließen bestätigen oder „Entwurf behalten“ anbieten. | M |
| **P2** | Abschluss / Undo | Ergebniswirksame Aktionen haben unklare oder irreversible Wirkung. | **B:** Undo entfernt sofort; Abschluss findet erst beim Start des nächsten Tages statt. **C:** „Als bezahlt markieren“ ist danach deaktiviert und nicht rücknehmbar. | Falsches Antippen ist schwer zu beheben; Nutzer weiß nicht, ob Abschluss gespeichert ist. | Rückholbare Aktionen, expliziter Abschlussknopf und getrennter Neustart; Zahlung kann mit Bestätigung wieder geöffnet werden. | M |
| **P2** | Accessibility / Auswahl | Offline-Spieler- und Spieltypchips melden keinen Auswahlzustand. | **B:** `aria-selected`/`aria-pressed` fehlen an geprüften Chips. **C:** `PlayerChip` und `GameTypeCard` setzen kein `accessibilityState.selected`. Gewinner und Verlierer heißen jeweils nur „Anna“. | Screenreader-Nutzer erkennen Auswahl und Rolle nicht sicher; visuell dominiert Farbe. | Role + selected/pressed setzen; Namen wie „Anna, Gewinner, ausgewählt“; sichtbares Häkchen ergänzen. | S |
| **P2** | Touch / Onboarding | Offline-Einstieg ist nur 37 Pixel hoch. | **B:** In allen vier Größen ca. 201 × 37 Pixel gegenüber 58 Pixel hohen Anmeldebuttons. | Der für schnellen lokalen Start wichtige Weg ist schlechter treffbar. | Mindestens 44, besser 48 Pixel reale Touchhöhe mit ausreichend Abstand. Moderne „Bezahlt“-Aktion zusätzlich messen; dort fehlt eine Mindesthöhe im Code. | S |
| **P2** | Zahlen / Lesbarkeit | Positive Salden ohne Pluszeichen; Formular zeigt „10 €“, Verlauf „10,00 €“; grüne Offline-Salden haben zu wenig Kontrast für normale 16-Pixel-Schrift. | **B:** Screenshots. **C/rechnerisch:** `#1f8a3b` auf `#f7f8fb` ≈4,16:1; Rot ≈5,29:1. | Geldbeträge und Bedeutung sind weniger schnell erfassbar; Grün ist unter schwierigen Sichtbedingungen schwächer. | „Erhält 10,00 €“/„Zahlt 10,00 €“ oder explizites Plus; zentraler EUR-Formatter; dunkleres Grün mit mindestens 4,5:1. | S |
| **P2** | Betrag / Schafkopf-Regeln | „Live-Betrag“, „Betrag“ und „Einsatzbetrag“ erklären nicht den Geldfluss; moderne Eingabe startet pauschal mit 10. | **B:** Offline-Formular. **C:** Moderne Maske und Saldoberechnung. Keine Aussage, dass der Tarif an sich falsch ist. | Verwechslung zwischen Gesamtgewinn, Zahlung je Gegner und Grundtarif möglich. | Tisch-Tarif ableiten; vor Speichern ausdrücklich „Max zahlt Anna …; Flo zahlt …“ anzeigen, inklusive aller Multiplikatoren. | M |
| **P3** | Begriffe / vorbereitete Funktionen | „Spiel“, „Runde“, „Spieltag“, „Tisch“, „Archivieren“ und „Neuen Spieltag starten“ beschreiben unterschiedliche Zustände nicht konsistent. Vorbereitete Zahlungs-/Freundesaktionen sehen aktiv aus. | **B/C:** Offline-Abschluss und moderne Screens. | Mehr Lernaufwand; scheinbar defekte Klicks. | Ein Wörterbuch für Sitzung/Einzelspiel/Abschluss; nicht vorhandene Funktionen aus Hauptabläufen entfernen oder klar deaktiviert kennzeichnen. | S–M |

Das sind funktionale Fehler bzw. Bedienhindernisse. Die Wahl von Gold, Grün, Kartenmotiven oder hell/dunkel an sich ist keine Abwertung. Kritisch sind Datenwahrheit, Kontrast, Zustand und Wirkung.

## 5. Die fünf wichtigsten Verbesserungen

1. **Abrechnung und Identität schützen.** Aktuell: Spiel speichern → beteiligte Person löschen → Historie unklar, Zahlung verschwindet. Ziel: Löschen erkennt Verwendung → „Für neue Runden ausblenden“ → vergangene Spiele und Zahlungen bleiben unverändert. Nutzen: verhindert falsche Abrechnungen; sofort priorisieren.
2. **Abgeschlossene Sitzungen dauerhaft archivieren.** Aktuell im modernen Modell: Abrechnen → neuer Tisch → alter Tischzustand wird ersetzt. Ziel: Abrechnen → prüfbare Zusammenfassung → Abschluss speichern → Archivbestätigung → optional neue Sitzung. Ein Archiv für Offline- und Kontonutzung.
3. **Übersicht wirklich mobil scrollbar machen.** Aktuell: hohe Kopfbereiche, Salden, Auszahlungen und Spielverlauf konkurrieren in festem View. Ziel: kompakter Sitzungsheader → eine scrollbare Inhaltsliste → feste Aktion „Spiel erfassen“; Abschluss als sekundäre Menüaktion. Bearbeiten und Zahlungen bleiben auch bei 568 Pixel Höhe erreichbar.
4. **Eine fachlich korrekte Erfassungsmaske mit Parteien einführen.** Aktuell: genau ein Gewinner, mehrere Verlierer, unklarer Betrag. Ziel: Spielart → beteiligte Parteien → automatisch berechnete konkrete Zahlungen → Speichern. Derselbe Datenpfad erhält Bearbeiten und Undo; Partnerspiele sind explizit möglich.
5. **Dashboard ausschließlich mit echten Ergebnissen verbinden.** Aktuell: feste Erfolgszahlen, Beispielsummen und vorbereitete Aktionen. Ziel: berechneter aktueller Sitzungsstand; ohne Daten ein eindeutiger Einstieg; Wiederaufnahme führt direkt zur laufenden Sitzung. Keine scheinbaren Zahlungsverpflichtungen aus Beispieldaten.

## 6. Umsetzungsplan und betroffene Dateien

### Sofort, kleine Änderungen

* Doppelte Namen abfangen und verwendete Spieler vor physischem Löschen schützen: `src/store/playerStore.ts`, `src/screens/PlayersScreen.tsx`.
* Feste Dashboard-Zahlen und Beispielzahlungen durch leere Zustände ersetzen, bis Daten angebunden sind: `src/screens/app/DashboardScreen.tsx`.
* Auswahlzustände, Rollenbeschriftung und Häkchen: `src/components/PlayerChip.tsx`, `src/components/GameTypeCard.tsx`.
* Offline-Einstieg auf mindestens 44 Pixel; grünen Text abdunkeln; EUR-Formatter verwenden: `src/screens/OnboardingScreen.tsx`, `src/constants/theme.ts`, `src/screens/HomeScreen.tsx`, `src/screens/CreateGameScreen.tsx`.

### Mittlere Anpassungen

* Eine vertikale Inhaltsliste statt mehrerer konkurrierender Bereiche: `src/screens/HomeScreen.tsx`; ebenso Abschluss und Historiedetail bei kleinen Höhen prüfen.
* Eindeutiger Abschluss, nachträglich rücknehmbare Zahlung und Undo-Rückholung: `src/screens/CloseMatchDayScreen.tsx`, `src/screens/app/SettlementScreen.tsx`, `src/components/game/SettlementCard.tsx`.
* „Speichern & nächstes Spiel“, Entwurfsrettung, direkte Wiederaufnahme: `src/screens/CreateGameScreen.tsx`, `src/screens/app/ActiveGameScreen.tsx`, `src/navigation/RootNavigator.tsx`, Persistenzservices.
* Gemeinsamer sichtbarer Speicherstatus: lokal gespeichert, ausstehend, synchronisiert, fehlgeschlagen. Nicht nur auf dem Dashboard.

### Strukturell

* Ein Modell für Teilnehmer, Sitzung, Einzelspiele, Parteien und Archiv statt `games`/`matchDays` parallel zu `currentTable`/`rounds`. Betroffen: `src/store/gameStore.ts`, `src/store/matchDayStore.ts`, `src/types/game.ts`, `src/models/Game.ts`, beide Navigatoren sowie die Cloud-Snapshot-Struktur.
* Migration vorhandener lokaler und Cloud-Daten mit Sicherung und Rückfallmöglichkeit. Erst danach alte Datenpfade entfernen.
* Konfliktauflösung ohne Verlust beider Stände: `src/services/sync/syncGameState.ts`, Sync-UI und Archivmodell.
* Fachliche Modelltests für Rufspiel, Solo, Verliererpartei, Cent-Verteilung und Multiplikatoren; anschließende Prüfung mit Schafkopfspielern.

Reihenfolge: erst falsche Abrechnung und Datenverlust verhindern, dann Erreichbarkeit und Eingabe verbessern, danach Layout-Feinschliff. Große optische Überarbeitung vorher hätte wenig Nutzen.

## 7. Prüfbare Abnahmekriterien

1. **Historische Teilnehmer:** Anna +10 €, Max −10 € erzeugen. Anna für neue Spiele ausblenden. Name, Salden, Zahlung und Historie bleiben identisch; Summe aller Salden bleibt 0 Cent. Eine nicht ausgeglichene Rechnung kann niemals „Keine Auszahlungen offen“ anzeigen.
2. **Archiv:** Sitzung mit mindestens 3 Spielen und einem Zahlungsstatus abschließen; neue Sitzung starten; App neu laden. Die alte Sitzung ist aus einem beschrifteten Archiv erreichbar und hat unveränderte Beträge, Teilnehmer, Zeitpunkte und Zahlungsstatus. Gilt offline und nach Cloud-Wiederherstellung auf zweitem Testgerät.
3. **Mobile Erreichbarkeit:** Bei 360 × 740, 390 × 844, 430 × 932 und 390 × 568 sowie 8 Teilnehmern sind Erfassen, Bearbeiten, Undo und Abrechnung durch normales Touch-Scrollen erreichbar. Kein Aktionsziel liegt vollständig hinter Tabbar, Footer oder Tastatur. Kein unbeabsichtigtes horizontales Seitenscrollen.
4. **Parteien und Vorschau:** Ein gewonnenes Rufspiel lässt zwei Gewinner gegen zwei Verlierer zu. Vor Speichern werden Zahlungen je Person angezeigt. Gespeicherte Salden entsprechen dieser Vorschau centgenau. Solo und Rufspiel besitzen fachlich bestätigte Testfälle.
5. **Datenwahrheit:** Frisches Profil zeigt 0 Spiele und keine Schulden, niemals feste 24 Runden oder Beispielzahlungen. Nach einem Testspiel ändern sich Dashboard, Verlauf und Abrechnung konsistent.
6. **Korrektur:** Ein gespeichertes Spiel kann unter derselben ID geändert werden; keine Doppelzählung. Löschen und Undo bieten eine sichtbare Wiederherstellung. Jede Änderung aktualisiert Salden und Zahlungen korrekt.
7. **Schnellerfassung:** Nach Speichern ist eine weitere Eingabe ohne erzwungenen Besuch der Übersicht möglich. Ein Standardsolo benötigt nach Öffnen höchstens Parteienauswahl und eine Speicheraktion, zuzüglich fachlich notwendiger Abweichungen. Die konkrete Schrittzahl für Rufspiel wird mit dem finalen Parteienmodell festgelegt.
8. **Entwurf und Wiederaufnahme:** Betrag und Parteien eingeben, App unterbrechen oder Seite neu laden. Gespeicherte Sitzung öffnet direkt; ungespeicherter Entwurf wird als solcher wieder angeboten. Kein stilles Verwerfen bei Hintergrundtippen.
9. **Touch und Accessibility:** Reale Ziele mindestens 44 × 44 CSS-Pixel. Screenreader sagt Rolle und Auswahlzustand jedes Spielers an. Gewinn/Verlust sind auch ohne Farbe erkennbar. Relevanter normal großer Text mindestens 4,5:1 Kontrast.
10. **Verbindung und Duplikate:** In isolierter Testumgebung langsames Netz, Request-Abbruch, Doppeltippen, Background und Wiederholung testen. Pro bestätigtem Spiel entsteht genau eine ID. Lokal gespeicherte Spiele bleiben nach Fehler erhalten. Ein Versionskonflikt hat einen nutzbaren Lösungsweg und bewahrt beide Ausgangsstände.

## Offene Prüfungen vor einer mobilen Freigabe

* Angemeldete komplette Nutzerstrecke mit freigegebenem Testkonto und separatem Supabase-Testprojekt. Der hier durchgeführte Audit bestätigt keine reale Cloud-Synchronisierung und keine Mehrgerätebedienung.
* Direkter Mobile-Preview-Test sowie echter Android-/iPhone-Test: Tap-Weiterleitung, Scrollgesten, Safe Areas, Browserleisten und Zurücknavigation.
* Geöffnete Softwaretastatur bei kurzem Display, insbesondere Betrag und Tischanlage. Dezimalkomma, 0,01 €, sehr große Beträge und fehlerhafte Eingaben.
* VoiceOver/TalkBack, Hardwaretastatur/Fokus, 200 % Textvergrößerung und lange Namen. Kein Accessibility-Gesamttest bestanden behauptet.
* Vier bis acht Schafkopfspieler: Partnerwahl, Ramsch/Stock, Stoß/Legen, Tarifverständnis und Zahlungsrichtung. Die fachliche Zieldefinition braucht echte Spielregeln statt bloßer Bildschirmannahmen.
* Kurze Nutzertests unter Ablenkung, einhändig und bei schwachem Licht. Erfassen von Fehlern, Zeit bis zum sicheren Speichern und Verständnis der Abrechnung; aktuell keine gemessenen Nutzungszeiten.
* Offline-Kaltstart, App-Kill während des Speicherns, voller Speicher und Wiederaufnahme nach längerer Pause. Der positive Offline-Test betrifft nur eine bereits geladene Anwendung.

## Belege

* [Startseite 390 × 844](onboarding-390x844.png)
* [Offline-Übersicht ohne Daten](home-empty-390.png)
* [Erfassung 360 × 740](create-360x740.png), [390 × 844](create-390x844.png), [430 × 932](create-430x932.png), [390 × 568](create-390x568.png)
* [Spiel gespeichert](saved-game-home.png)
* [Kurzes Display nach Scrollversuch](home-after-scroll-390x568.png)
* [Beschädigte Zuordnung nach Spielerlöschung](after-referenced-player-delete.png)
* [Historiedetail](history-detail.png)
* Browserprotokolle: `initial.json`, `flows.json`, `corrections.json`, `edge-cases.json`. Die DOM-Textprotokolle enthalten auch montierte, gerade inaktive Tabseiten; Aussagen über Sichtbarkeit beruhen deshalb zusätzlich auf Screenshots, Geometrie und tatsächlichen Aktionen, nicht allein auf `body.innerText`.
