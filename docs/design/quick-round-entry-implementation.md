# Spieleingabe über Spielernamen und gespeicherter Ansager – Issue #4

## Bedienung

Ein kurzer Tipp auf einen Spielernamen am laufenden Tisch öffnet die vorhandene Spieleingabe. Der angetippte Spieler steht bereits in der Spielartauswahl als Ansager fest und ist danach im eigenen Ansager-Bereich markiert. Die Auswahl bleibt änderbar. Der allgemeine Button „Spiel eintragen“ öffnet die Eingabe ohne vorausgewählten Ansager.

Ansager und Ergebnis sind getrennt: Vorauswahl oder Wechsel des Spielers legt keinen Sieg fest. Für neue Ansagespiele sind Ansager und Ergebnis ausdrücklich erforderlich. Beim Sauspiel kann der Partner separat gewählt werden; alternativ wird bei vollständig ausgewählten Ergebnisparteien und bekanntem Ansager dessen eindeutiger Teampartner übernommen. Ein verlorenes Sauspiel speichert ebenfalls die ansagende Partei. Stockbuchungen und Ramsch verwenden weiterhin ihre vorhandene Eingabelogik.

Der Münz-Button klopft unabhängig. Gedrückthalten öffnet seit der Folgeumsetzung von #5 das Spieleraktionsmenü und unterdrückt eine anschließende versehentliche Spieleingabe. Die Sitzreihenfolge bleibt über das Listensymbol erreichbar. Details zur manuellen Geberwahl stehen in player-actions-implementation.md.

## Daten und Verlauf

Die vorhandene stabile `declarerId` wird jetzt auch bei Solo, Wenz und weiteren Ansagespielen explizit gespeichert. Die Speicherprüfung verlangt für Solospiele die tatsächliche alleinige Partei und beim Sauspiel einen gültigen Partner auf derselben Seite. Korrekturen behalten die Spiel-ID; Ansager, Parteien und Ergebnis bleiben unabhängig korrigierbar.

Der aktive kompakte Verlauf und die abgeschlossene Abrechnung zeigen den Ansager ausdrücklich an. Ohne gespeicherte Ansager-ID steht im Verlauf „Ansager: unbekannt“; bestehende Datensätze werden nicht nachträglich umgeschrieben. Stockbuchungen erhalten keine Ansagerzeile. Änderungen fließen über die bestehenden Spielstände in Archivierung, lokale Speicherung und Cloud-Snapshots ein. Bestehende Statistikauswertungen verwenden die gespeicherte ID.

Behaltene Entwürfe der Schnelleingabe sind zusätzlich nach dem ursprünglich angetippten Spieler getrennt. Ein Entwurf für Spieler A ersetzt deshalb nicht die Vorauswahl beim Einstieg über Spieler B. Zum Fortsetzen wird derselbe Spielereinstieg erneut geöffnet; generische Eingabe und Korrekturen behalten ihre bisherigen Entwurfsschlüssel.

## Prüfung

Vollständige Jest-Suite: 37 Testsuiten / 307 Tests bestanden. TypeScript und ESLint geprüft. Nach der abschließenden Darstellungskorrektur zusätzlich beide betroffenen UI-Suiten mit 43 Tests bestanden.

Neue Fälle: Schnelleinstieg per Namens-Tipp, getrenntes Klopfen und Long-Press, neutrale Ergebniswahl, verlorenes Solo und Wenz mit expliziter ID, erneutes Bearbeiten und Ansagerwechsel, verlorenes Sauspiel mit Partner, Archivierung, Abbrechen ohne Änderung, getrennte dauerhafte Schnelleingabe-Entwürfe und unveränderte unbekannte Altzuordnungen. Bestehende Tests wählen das Ergebnis nun ausdrücklich aus.

Browserprüfung auf einer eigenen lokalen Gast-Origin bei 320 × 568 Pixeln mit langem Spielernamen: Name antippen → Solo wählen → neutralen Ergebniszustand prüfen → verloren wählen → speichern → stabile Ansager-ID und Verliererpartei im tatsächlichen lokalen Speicher prüfen → Anzeige im Verlauf. Abschließender Durchlauf ohne Browserfehler; vorhandene Warnungen zu zyklischen Store-Imports bleiben. Eine SVG-Dekoration verwendet im Web nun `aria-hidden`, native Plattformen weiterhin `accessible={false}`.

Screenshots: `output/playwright/quick-entry-caller-320.png` und `output/playwright/quick-entry-history-320.png`. Physischer iPhone- und echter Mehrgeräte-Cloud-Test wurden nicht durchgeführt. Keine Veröffentlichung, kein Commit/Push und kein Schließen des GitHub-Issues durch diese Umsetzung.
