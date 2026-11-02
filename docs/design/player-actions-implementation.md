# Spieleraktionsmenü und manuelle Geberwahl – Issue #5

Gedrückthalten eines Spielernamens öffnet das Spieleraktionsmenü. Erst „Als Geber auswählen“ setzt den aktuellen Geber. Loslassen nach erkanntem Long-Press öffnet keine Spieleingabe. Kurzes Tippen bleibt der Schnelleinstieg mit vorausgewähltem Ansager aus #4; Münz-Buttons klopfen weiterhin unabhängig. Scrollen oder Abbrechen verändert den Geber nicht.

Ohne Gedrückthalten ist derselbe Ablauf über Tischmenü → Spieleraktionen → Spieler erreichbar. Der aktuelle Geber wird am Spieler mit Kartensymbol und „Geber“ gekennzeichnet; im Menü ist eine erneute identische Auswahl deaktiviert. Die Sitzordnung bleibt über ihr eigenes Listensymbol erreichbar. Das gemeinsame Menü ist als eigener PlayerActionsMenu-Baustein angelegt; Pausieren/Reaktivieren aus #16 kann dort ergänzt werden, ist hier noch nicht umgesetzt.

Die Store-Aktion setDealer prüft die Tisch-ID, den aktiven Tischstatus und die Spielerzuordnung. Sie ändert ausschließlich currentTable.dealerId. Gespeicherte Runden einschließlich historischem Geberkontext, Ansager, Parteien, Beträge, Salden, Zahlungen, Regeln, Sitzordnung und Leger bleiben erhalten. Die nächste Runde verwendet den neu gewählten Geber und die vorhandene Geberrotation. Die ID bleibt über die bestehende Tisch-Persistenz und deren Snapshots erhalten.

Das Menü schließt erst nach bestätigter Gerätespeicherung. Bei Schreibfehlern bleibt ein verständlicher Hinweis mit „Erneut auf Gerät sichern“ stehen. Der Retry sichert denselben Zustand erneut und setzt den Geber nicht durch eine weitere Fachaktion zurück.

Prüfung: vollständige Jest-Suite mit 37 Testsuiten / 313 Tests bestanden. TypeScript und scoped ESLint fehlerfrei. Tests für explizite Bestätigung nach Long-Press, getrennten Tap/Münz-Button, Zugang über Tischmenü, Abbruch, genau einen Geber, unveränderte Rundendaten und Leger, nächste Rotation, ungültige Spieler/veraltete oder abgeschlossene Tische, lokale Rehydration und Speicherfehler mit Retry.

Browser bei 320 × 568 Pixeln auf eigener lokaler Gast-Vorschau: echter gehaltener Mausdruck und Loslassen öffnet nur das Menü; Geber zunächst unverändert. Auswahl von Flo ändert ausschließlich die gespeicherte Geber-ID. Über Tischmenü anschließend Ben gewählt. Kurzer Tipp öffnet dessen Spieleingabe, unverändert abgebrochen; Flo-Münze klopft separat. Vier ursprüngliche Spiele bleiben erhalten. Screenshot: output/playwright/player-actions-dealer-320.png. Kein physischer iPhone-/VoiceOver- oder Live-Cloud-Test. Keine Veröffentlichung, kein Commit/Push und keine Änderung des GitHub-Ticketstatus durch diese Umsetzung.

## Vereinfachte Darstellung

Das Spieleraktionsmenü erscheint als kompakter Dialog mittig auf dem Bildschirm: Spielername und Schließen-Symbol in der Kopfzeile, darunter die Aktion „Als Geber auswählen“ mit kleinem Symbol. Erklärungstext und großer goldener Hauptbutton entfallen. Nach Gedrückthalten gibt es keine zusätzliche Spielerauswahl; beim Zugang über das Tischmenü führt ein Zurück-Symbol zur Spielerliste. Der Ablauf und Speicher-Retry bleiben erhalten. Geprüft bei 320 × 568 Pixeln; 25 ActiveGame-Tests bestanden. Screenshot: output/playwright/player-actions-clean-320.png.
