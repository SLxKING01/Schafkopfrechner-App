# Design-Handoff: Rundenerfassung

Stand: 01.11.2026. Plattform: Expo 58 / React Native, iOS, Android und Web.

Nachtrag zur Umsetzung am 01.11.2026: Die nachfolgende Bestandsaufnahme entstand vor der UI-Korrektur. Inzwischen liegt der Aktionsbereich mit Validierungshinweis, Speicherbutton und „Schließen“ außerhalb des ScrollView. Er bleibt beim Scrollen sichtbar und reserviert eigenen Layoutplatz; Safe Area und iOS-Tastaturausgleich kommen weiterhin aus `InteractionSheet`. Die erste sekundäre Aktion heißt jetzt „Schließen“, die destruktive Aktion im Bestätigungsdialog weiterhin „Entwurf verwerfen“. Geräte- und Tastaturprüfung stehen aus.

## Grundlage und Verbindlichkeit

Diese Spezifikation beschreibt den vorhandenen Implementierungsstand aus `src/components/game/RoundEntrySheet.tsx` und seinen Komponenten. Sie ist keine neue Designfreigabe. Es liegt keine Figma-Vorlage vor; Maße stammen aus dem Code und werden in React-Native-Layout-Einheiten angegeben. Ältere Screenshots und QA-Berichte belegen frühere Stände, nicht automatisch die aktuelle Darstellung. In dieser Übergabe wurden keine Laufzeit-, Geräte- oder Screenreader-Tests durchgeführt.

## Zweck und Ablauf

Spieler erfassen eine neue Runde oder korrigieren eine vorhandene Runde. Die Oberfläche zeigt die Auswirkungen auf die beteiligten Spieler vor dem Speichern. Eine erfolgreiche Aktion bestätigt die Speicherung auf dem Gerät; daraus darf keine bestätigte Cloud-Synchronisierung abgeleitet werden.

1. Neue Eingabe: Spielauswahl mit verfügbaren Tisch-Spielarten öffnen. „Eigenes Spiel“ wird im Selektor unabhängig von aktivierten Standardspielarten angeboten.
2. Nach Spielauswahl die passende Erfassung zeigen: Ansager, gegebenenfalls Partner, Ergebnis, Spielerbeträge und erlaubte Tarifoptionen.
3. Kartenfarbe, Klopfen und Boni nach Spielart und Tischregeln anpassen. Vorschau und Validierung reagieren auf die Eingaben.
4. Erst gültige Eingaben speichern. Bei Korrekturen lautet die primäre Aktion „Korrektur speichern“, sonst „Runde speichern“.
5. Beim Schließen geänderter Eingaben eine Entscheidung zum Weiterbearbeiten oder Verwerfen anbieten.

## Layout und responsive Darstellung

| Bereich | Umsetzung / Token | Verhalten |
|---|---|---|
| Präsentation | `InteractionSheet`, `fullScreen` | Vollbild-Modal; sichere Ränder übernimmt das Sheet |
| Hintergrund | `AuthBackground`, `withSafeArea={false}` | Gemeinsamer App-Hintergrund ohne doppelte Safe-Area-Abstände |
| Außenabstand horizontal | `authSpacing.lgPlus` = 20 | Innerhalb der sicheren Ränder |
| Außenabstand oben | `authSpacing.md` = 12 | Über dem Kopfbereich |
| Kopfbereich | `authSpacing.md` Abstand, `authSpacing.sm` = 8 unten | Zurück-Schaltfläche und Titel |
| Zurück-Schaltfläche | `authControlSizes.touch` | 44 × 44 auf iOS/Web, 48 × 48 auf Android |
| Hauptinhalt | `ScrollView`, `flex: 1`, `minHeight: 0` | Vertikal scrollbar, Scrollindikator ausgeblendet |
| Optionenfläche | `authSpacing.lg` = 16 horizontal, `authSpacing.sm` = 8 vertikal | Kontur `authColors.borderGold`, Radius `authRadius.lg` = 22 |
| Kartenfarbauswahl | `authControlSizes.suit` = 68 Mindesthöhe | Gleichmäßig verteilte Auswahlflächen, Radius `authRadius.sm` = 16 |
| Zähler | `authControlSizes.stepper` | Breite 96 auf iOS/Web, 100 auf Android; Minus/Plus zusammenhängend |
| Primäre Aktion | `GoldButton`, `authControlSizes.primaryButton` = 60 | Mit Lade- und Deaktivierungszustand |

Bei Fensterbreite unter 360 oder Schriftfaktor ab 1,3 wird `expandedPlayerLayout` aktiviert. Die betroffenen Spieler-Steuerelemente erhalten mehr Platz beziehungsweise volle Breite. Es gibt in dieser Komponente keine zusätzlichen Tablet-/Desktop-Breakpoints. Eine separate Desktop-Spaltenansicht ist nicht spezifiziert.

Die Speicheraktion befindet sich aktuell **innerhalb des ScrollView**, nach dem Eingabeinhalt. Sie ist nicht am unteren Bildschirmrand fixiert. Der ältere QA-Bericht vom 27.10. beschreibt eine dauerhaft erreichbare Speicheraktion; diese Aussage ist für den aktuellen Code nicht als erfüllt zu übernehmen.

## Design-Tokens

| Token | Wert | Verwendung |
|---|---|---|
| `authColors.textPrimary` | `#F5F5F5` | Primärer Text und Zurück-Icon |
| `authColors.textSecondary` | `#A1A1A1` | Hinweise und ergänzende Informationen |
| `authColors.gold` | `#D4AF37` | Goldakzent und primäre Aktion |
| `authColors.goldHighlight` | `#F2C94C` | Heller Teil des Button-Verlaufs |
| `authColors.selectedSurface` | `rgba(212,175,55,0.22)` | Auswahlfläche |
| `authColors.surfaceElevated` | `rgba(13,27,19,0.78)` | Hinterlegte Flächen |
| `authColors.control` | `rgba(22,51,40,0.8)` | Bedienelemente |
| `authColors.borderGold` | `rgba(212,175,55,0.42)` | Goldene Konturen |
| `authColors.errorText` | `#FCA5A5` | Verfügbare Fehlertextfarbe; Verwendung je Stil prüfen |
| `authInteraction.pressed` | Deckkraft 0,8 | Druckrückmeldung vieler Pressables |
| `authInteraction.disabled` | Deckkraft 0,5 | Deaktivierte Steuerelemente |
| `authFontFamilies` | Inter, Gewichte 400–900 | Gemeinsame Typografiefamilie |
| `authTextStyles.control` | Schriftgröße 12 | Kleine Steuerungsbeschriftungen |
| `authTextStyles.body` | Schriftgröße 16 | Fließtext |
| `authTextStyles.counter` | Schriftgröße 18, tabellarische Zahlen | Zähler |

Tokens direkt referenzieren. Die Zahlen hier dokumentieren den aktuellen Stand und sollen keine parallele lokale Token-Sammlung erzeugen.

## Komponentenvertrag

| Komponente | Eingaben / Varianten | Aufgabe |
|---|---|---|
| `RoundEntrySheet` | `table`, `players`, `editingRound`, `visible`, optional `initialDeclarerId` | Orchestriert Auswahl, Entwurf, Validierung und Speicherung |
| `RoundEntrySheet` Callbacks | `onClose`, `onDismiss`, `onSaved` | Schließen anfordern, Abschluss des Schließens melden, bestätigte Speicherung melden |
| `InteractionSheet` | `fullScreen`, `dismissible={!saving}` | Vollbild-Präsentation und Safe Area |
| `GameTypeSelector` | `enabledTypes`, `variant="list"`, `onSelect` | Spielartliste; unterstützt zusätzlich `chips` und `selectedType` |
| `EuroStyleCoin` | Zustandsabhängige Beschriftung und Darstellung | Klopfen je Spieler sichtbar und antippbar machen |
| `CardSuitIcon` | Kartenfarbe | Eichel, Gras, Herz und Schellen darstellen |
| `CustomAmountsEditor` | Spieler, Einträge, Änderungs-Callback, deaktivierter Zustand | Vorzeichen und Betrag je Spieler sowie Gesamtsumme |
| `GoldButton` | `title`, `onPress`, `disabled`, `loading`, Accessibility-Label/-Hinweis | Primäre Aktion mit erhaltener Beschriftung beim Laden |

## Zustände und Interaktionen

| Zustand / Element | Sichtbares Verhalten | Eingabeverhalten |
|---|---|---|
| Spielauswahl | Titel „Spielauswahl“, verfügbare Spiele | Auswahl öffnet die passende Erfassung |
| Korrektur | Vorhandene Rundendaten als Ausgangswert | Ursprünglichen Runden-/Tarifkontext berücksichtigen |
| Ansager / Partner / Ergebnis | Ausgewählten Zustand darstellen | Partner- und Gewinner-/Verlierergruppen entsprechend Spielart ableiten |
| Kartenfarbe | Optionale Auswahl sichtbar | Erneutes Antippen hebt die Auswahl auf; Spielartwechsel setzt Farbe zurück |
| Klopfen | Spielermünze mit Klopfzustand | Umschalten aktualisiert Tarif; höchstens vier Klopfer, weitere Einschränkungen nach Kontext |
| Zähler | Aktueller Wert mit Minus/Plus | Minus bei 0, Plus am jeweiligen Maximum deaktiviert |
| Ungültige Eingabe | Konkreter Hinweis im Aktionsbereich | Speichern deaktiviert |
| Entwurf wird geladen | Eingabeinhalt gesperrt | Speichern und Änderungen blockiert |
| Speicherung läuft | Spinner, Text „Wird auf dem Gerät gespeichert …“ | Mehrfachspeicherung und Schließen blockiert |
| Fehler vor Eintragung | Fehlertext | Entwurf bleibt zur Korrektur verfügbar |
| Eingetragen, Gerätesicherung fehlgeschlagen | Hinweis und Aktion „Erneut auf Gerät speichern“ | Inhalt gesperrt; Wiederholung sichert dieselbe Runde ohne erneute Eintragung |
| Erfolg | Accessibility-Ansage „Runde auf dem Gerät gespeichert.“ | Entwurf löschen, `onSaved` aufrufen |
| Geänderte Eingabe schließen | Dialog „Eingabe schließen?“ | „Weiter bearbeiten“ oder „Entwurf verwerfen“; nach Eintragung kein Verwerfen anbieten |

## Inhalte und Grenzfälle

- Neue reguläre Runden benötigen genau vier aktive Spieler. Der aktuelle Hinweis nennt „Mindestens vier aktive Spieler erforderlich“; die Formulierung ist mit der tatsächlichen Prüfung abzugleichen.
- Fehlende Ansager-, Partner- oder Ergebnisauswahl verhindert das Speichern und erzeugt einen passenden Hinweis.
- Manuelle Beträge müssen positiv und in ganzen Cent darstellbar sein. Die Eingabe verwendet eine Dezimaltastatur; ein bestehender Betrag wird mit Dezimalkomma vorbelegt.
- „Eigenes Spiel“ zeigt Beträge mit Vorzeichen je Spieler und einen Summenausgleich. Laut UI zählt die Buchung nicht als gespielte Runde; Geber und Leger bleiben erhalten.
- Eine Stockauszahlung ohne verfügbaren Stock bleibt ungültig. Weitere Einschränkungen hängen von Spielart, Parteien und Tischregeln ab.
- Änderungen des aktiven Tisches oder der Besetzung während der Erfassung müssen mit einem Fehler abgefangen werden, damit keine Runde im falschen Kontext gespeichert wird.
- Entwürfe werden lokal gehalten und zusätzlich auf dem Gerät abgelegt. Ladefehler werden angezeigt. Nicht bestätigte Rundenschreibvorgänge werden gesondert im Sitzungszustand gehalten.
- Verbindliche Namenslängen, Kürzungsregeln und ein umfassendes Lokalisierungskonzept sind in dieser Übergabe nicht festgelegt. Lange Namen und Übersetzungen benötigen eine eigene Layoutprüfung.
- In einigen Quelltextmeldungen sind auffällige Zeichenfolgen sichtbar. Vor Freigabe Texte auf tatsächliche Darstellung und korrekte Umlaute prüfen.

## Motion

| Element | Auslöser | Vorhandene Bewegung | Dauer / Kurve |
|---|---|---|---|
| Vollbild-Erfassung | Öffnen / Schließen | `Modal` mit `animationType="none"` | Keine eigene Übergangsanimation |
| Schließdialog | Schließentscheidung | Native `Modal`-Einblendung `fade` | Dauer und Kurve im Code nicht explizit gesetzt |
| `GoldButton` | Drücken | Transform-/Deckkraft-Transition | 120 ms, `ease-out`; bei reduzierter Bewegung 0 ms und keine Druckskalierung |
| Übrige Pressables | Drücken | Zustandsabhängige Deckkraft | Keine eigene zeitliche Transition spezifiziert |

Die gemeinsamen Einblendungen aus `src/theme/motion.ts` werden von dieser Rundenerfassung aktuell nicht verwendet. Die Animation des Schließdialogs hat keine eigene explizite Reduced-Motion-Abfrage; das tatsächliche Plattformverhalten ist zu prüfen.

## Barrierefreiheit

Vorhanden sind die Öffnungsansage, Header-Rollen, explizite Button-Labels, ausgewählte/deaktivierte Zustände an vielen Auswahlen, beschriftete Zähler und Betragsfelder, ein höflicher Live-Bereich für Statusmeldungen sowie Alert-Rollen bei Speicherfehlern. Beim gesperrten Formular werden dessen Inhalte für Accessibility ausgeblendet. Der primäre Button meldet `disabled` und `busy`.

Für die Abnahme noch zu prüfen: initialer Fokus und Fokusrückgabe nach Modalwechsel, vollständige Fokusreihenfolge, VoiceOver/TalkBack beim Speichern, Tastaturbedienung im Web, Kontrast aller Zustände und Darstellung bei vergrößerter Schrift. Vorhandene Labels sind kein Nachweis einer vollständigen Accessibility-Abnahme.

## Offene Entscheidungen und Abnahme

1. Soll die Speicheraktion dauerhaft außerhalb des Scrollbereichs liegen? Aktueller Code und ältere QA-Beschreibung weichen ab. Noch keine Änderung freigegeben oder umgesetzt.
2. Sind Fehlermeldungen sprachlich vollständig korrekt und eindeutig, insbesondere die Vier-Spieler-Regel?
3. Wie sollen sehr lange Namen und breite Desktop-Ansichten verbindlich behandelt werden?
4. Soll der Schließdialog reduzierte Bewegung explizit berücksichtigen?

Für die nächste Umsetzung beziehungsweise Abnahme prüfen: neue Runde und Korrektur, Rufspiel mit Partner, Solo, Kartenfarbe an/aus, Klopfen, Grenzwerte der Zähler, Stock ohne Guthaben, ausgeglichene/unausgeglichene eigene Buchung, Entwurf wieder öffnen, Verwerfen, Doppeltippen beim Speichern und Wiederholung nach fehlgeschlagener Gerätesicherung. Darstellung bei 320 und 393 Layout-Einheiten Breite, Schriftfaktor mindestens 1,3 und geöffneter Tastatur prüfen; native Gesten und Accessibility zusätzlich am Gerät.

## Quellen im Repository

- `src/components/game/RoundEntrySheet.tsx`
- `src/components/ui/InteractionSheet.tsx`
- `src/components/auth/GoldButton.tsx`
- `src/components/game/GameTypeSelector.tsx`
- `src/components/game/CustomAmountsEditor.tsx`
- `src/theme/colors.ts`, `spacing.ts`, `typography.ts`, `motion.ts`
- `docs/qa/round-entry-suits-2026-10-27.md` (historischer Kontext)
