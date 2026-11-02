# Designkritik: Rundenerfassung

Stand: 01.11.2026. Ausgeführt nach `design-critique`. Zielgruppe: Spieler, die während eines Schafkopfabends wiederholt Ergebnisse erfassen. Fokus: mobile Bedienung und Verfeinerung der bestehenden Oberfläche.

Umsetzungsnachtrag: Die Befunde zur mitscrollenden Speicheraktion und zur ersten Beschriftung „Verwerfen“ wurden anschließend im Code behoben. Der Aktionsbereich liegt außerhalb des ScrollView; die sekundäre Aktion heißt „Schließen“. Der folgende Review-Text bleibt als ursprüngliche Bestandsaufnahme erhalten. Visuelle Geräteprüfung steht aus.

Weiterer Umsetzungsnachtrag: Auch die Rollenwahl verwendet inzwischen `authControlSizes.touch` als Mindesthöhe, also 48 auf Android und 44 auf iOS/Web.

## Grundlage und Grenzen

Geprüft wurden der aktuelle Code von `RoundEntrySheet`, `InteractionSheet`, `GoldButton`, die Design-Tokens und die Screenshots `round-entry-knocking-coins-393.png` sowie `round-entry-dashboard-options-393.png`. Die Screenshots dokumentieren einen älteren Stand. Visuelle Eindrücke daraus sind entsprechend gekennzeichnet; Aussagen über den aktuellen Ablauf stammen aus dem Code. Keine aktuelle Browser-, Geräte- oder Screenreader-Abnahme. Es wurden keine UI-Änderungen umgesetzt.

## Gesamteindruck

Die Screenshots zeigen eine eigenständige, zum Kartenspiel passende Grün-Gold-Gestaltung. Spielart, Tarif und individuelle Gewinne sind schnell erkennbar. Die größte Verbesserung liegt bei der wiederholten Bedienung: Abschlussaktion und Validierung sollten ohne Scrollsuche erreichbar sein, und Schließen beziehungsweise Verwerfen sollten eindeutiger bezeichnet werden.

## Bedienbarkeit

| Befund | Schwere | Beleg und Auswirkung | Empfehlung |
|---|---|---|---|
| Speicheraktion und Validierung liegen am Ende des Scrollinhalts | Hoch | Im aktuellen `RoundEntrySheet` befindet sich `footer` innerhalb von `EntryScrollView`. Bei langen Optionen sind Speichern und der Grund einer ungültigen Eingabe außerhalb des sichtbaren Bereichs. | Aktionsbereich außerhalb des ScrollView platzieren, Safe Area und Tastatur berücksichtigen. Kurzen Validierungshinweis dort zeigen; feldbezogene Fehler zusätzlich am betreffenden Feld. |
| „Verwerfen“ öffnet zunächst eine Schließentscheidung | Mittel | Die sekundäre Aktion ruft `requestClose` auf. Erst der Folgedialog bietet bei geänderten Eingaben „Entwurf verwerfen“. Die erste Beschriftung verspricht eine andere Aktion. | Erste Aktion „Schließen“ nennen; die destruktive Bezeichnung ausschließlich für das tatsächliche Verwerfen verwenden. |
| Klopfen ist über eine Münze bedienbar, aber die Interaktion ist visuell wenig erklärt | Mittel | Im älteren Screenshot sind 1×/2×-Münzen sichtbar. Im aktuellen Code sind Münzen separate Buttons und „Über Münzen“ ist die ergänzende Erklärung. Neue Nutzer müssen die Bedeutung erschließen. | Beim Klopfbereich einmal knapp erklären: „Münze antippen zum Klopfen“. Kein zusätzlicher Bestätigungsdialog für jeden Tap. |
| Vier-Spieler-Hinweis passt nicht zur Prüfung | Mittel | Der Code prüft bei neuen regulären Runden `players.length !== 4`, nennt aber „Mindestens vier aktive Spieler erforderlich“. Das erklärt mehr als vier aktive Spieler nicht korrekt. | „Für diese Runde müssen genau vier Spieler aktiv sein.“ verwenden und eine passende Möglichkeit zum Prüfen der Besetzung anbieten. |

## Visuelle Hierarchie

- **Erster Blick, ältere Screenshots:** „Herzwenz“ und der große Tarif ziehen die Aufmerksamkeit auf sich. Das hilft bei der Bestätigung von Spielart und Preis.
- **Lesefluss:** Spielart → Tarif → Spielerbeträge → Kartenfarbe → Zusatzoptionen ist nachvollziehbar. Das Ergebnis steht vor den Tarifdetails.
- **Gewichtung:** Gold wird für Aktion, positiven Betrag, gewählte Farbe und Teile der Auswahl verwendet. Die Bedeutung entsteht durch Text und Position; Gold allein sollte keine zusätzliche semantische Rolle erhalten.
- **Verbesserung:** Zusatzoptionen in klar bezeichnete Gruppen wie „Boni“ und „Verdopplungen“ gliedern. Ihre sichtbare Höhe erst nach einer aktuellen Laufzeitprüfung ändern; seltene Optionen nicht pauschal verstecken.
- **Wichtiger Unterschied:** Die älteren Screenshots zeigen eine sichtbare Speicherleiste. Diese gute Hierarchie ist im aktuellen Code nicht durch einen fixierten Aktionsbereich abgesichert.

## Konsistenz

| Element | Befund | Empfehlung |
|---|---|---|
| Farben und Abstände | Die Rundenerfassung verwendet gemeinsame `authColors`, `authSpacing` und `authRadius`. | Beibehalten; Änderungen zentral über Tokens vornehmen. |
| Touch-Flächen | `roleChoice` hat fest `minHeight: 44`, während `authControlSizes.touch` auf Android 48 vorsieht. | Rollenwahl auf den gemeinsamen Touch-Token umstellen. |
| Überschriften | Der Schließdialog verwendet lokal Schriftgröße 24 statt eines Typografie-Tokens. | Passenden gemeinsamen Textstil verwenden, falls Gewicht und Hierarchie passen. |
| Schließen und Verwerfen | Dieselbe Schließfunktion wird mit unterschiedlichen Bedeutungen angeboten. | Beschriftungen an die tatsächliche Aktion angleichen. |

## Barrierefreiheit

- **Touch-Ziele:** Viele Steuerelemente verwenden den plattformabhängigen 44-/48-Token. Die Rollenwahl mit festen 44 Einheiten unterschreitet auf Android die eigene 48-Einheiten-Konvention. Das ist ein konkreter Konsistenzbefund, kein vollständiger Accessibility-Konformitätsnachweis.
- **Lesbarkeit:** Ergebnis-Segmente verwenden Schriftgröße 12. Im älteren 393er-Screenshot sind sie deutlich kleiner als Spielernamen und Hauptbeträge. Größe und Platz für längere Beschriftungen prüfen; bei Bedarf die vorhandene mehrzeilige Spieleranordnung früher aktivieren.
- **Schriftvergrößerung:** Der Code berücksichtigt Breite unter 360 und Schriftfaktor ab 1,3 mit einer erweiterten Spieleranordnung. Das ist ein guter Ansatz; Umbruch und Erreichbarkeit müssen mit großen Systemschriften geprüft werden.
- **Auswahlzustände:** Beschriftungen sowie `accessibilityState.selected` ergänzen die farbige Darstellung. Die Beispiele vermitteln Gewinne und Verluste zusätzlich mit Vorzeichen.
- **Statusmeldungen:** Öffnungs-/Speicheransagen, Live-Region und Fehlerrollen sind vorhanden. Fokus beim Wechsel zwischen Eingabe und Schließdialog sowie Fokusrückgabe sind noch praktisch zu prüfen.
- **Kontrast:** Keine belastbare Pass-/Fail-Aussage. Transparente Flächen und der App-Hintergrund erfordern Messungen an der tatsächlich gerenderten Kombination. Die Screenshots allein ersetzen keine aktuelle Kontrastprüfung.
- **Bewegung:** Der primäre Button berücksichtigt reduzierte Bewegung. Für das native Fade des Schließdialogs ist keine explizite Abfrage im eigenen Code vorhanden; Plattformverhalten testen, bevor ein Fehler behauptet wird.

## Was gut funktioniert

- Spielerbeträge erscheinen direkt bei den Spielern; positive und negative Auswirkungen werden vor dem Speichern sichtbar.
- Die vorhandenen Screenshots zeigen eine klare, thematisch passende Gestaltung und eine starke primäre Aktion.
- Speichern ist gegen Doppelausführung gesperrt. Nach fehlgeschlagener Gerätesicherung wird dieselbe Runde erneut gesichert, statt eine zweite Runde anzulegen.
- Der Code unterscheidet Eingabe-, Lade-, Speicher- und Wiederholungszustände; der Button behält beim Laden seine Beschriftung.
- Preisaufschlüsselung und Tarifvorschau unterstützen die Nachvollziehbarkeit der Abrechnung.

## Priorisierte Empfehlungen

1. **Speichern und Validierung dauerhaft erreichbar machen.** Höchster Nutzen für die wiederholte mobile Eingabe. Mit langer Optionsliste, kleiner Höhe und geöffneter Tastatur prüfen.
2. **Schließen/Verwerfen und Fehlermeldungen präzisieren.** Kleine Textänderungen beseitigen vermeidbare Unsicherheit; Klopfbedienung knapp erklären.
3. **Touch-Ziele und kleine Steuerungstexte vereinheitlichen.** Zuerst Rollenwahl an den Touch-Token anpassen, dann Ergebnis-Segmente bei großer Schrift und langen Namen am Gerät prüfen.

Die Empfehlungen sind ein Review-Ergebnis. Änderungen an Verhalten und Layout sind in diesem Durchlauf nicht umgesetzt worden. Die im Handoff genannten aktuellen Speicher- und Datenregeln bleiben die fachliche Grundlage für eine spätere Umsetzung.
