# Umsetzung der Statistik

## Ansichten

- Gesamt (Standard): gespielte Runden, reine Spielwerte, Ansagequote mit Datenabdeckung, durchschnittlicher Spielwert. Zeitraum gesamt oder letzte 30 Tage.
- Spieler: Auswahl mit Tischkontext, Spielbilanz, Gewinnquote, eigene Ansagen, Durchschnitt, Extremwerte. Lokale gleichnamige Spieler verschiedener Tische werden nicht zusammengelegt; Kontoverknüpfungen können über Tische zusammengeführt werden. Positive Abende entfällt.
- Spielarten aufklappbar: Gewinne / auswertbare Runden, Bilanz beziehungsweise Spielwerte und Durchschnitt. Persönliche Rollenaufteilung, persönlicher Bilanzverlauf der Spielart, gespeicherte Kartenfarben und zugehörige Einzelspiele.
- Tisch: eigene Route über Tischmenü, Abrechnung und Statistik. Saldoverlauf aller Spieler mit Rundenauswahl, alternativ Erfassungszeit bei streng aufsteigenden gültigen Zeitstempeln. Ausgewählter Zeitpunkt und Spielstände, Hoch-/Tiefststände, größte Gewinnsprünge, Führungswechsel zwischen allein Führenden, teuerstes Spiel.
- Sauspiel-Partnerschaften: tatsächlicher Ansager plus Partner, einschließlich verlorener Spiele. Reihenfolge-unabhängiger Teamschlüssel; die Gegenpartei zählt nicht als zweites Sauspielteam. Sortierung Häufigkeit, Quote oder Bilanz. Teambilanz summiert beide Partner. Teamdetails enthalten Kartenfarben und gemeinsame Spiele.

## Datenregeln

Die Statistik verwendet deduplizierte aktive und archivierte Tische sowie ältere lokale Spieltage aus buildGameOverview. Reine Spielgewinne werden centgenau mit der bestehenden Abrechnungsfunktion geteilt, einschließlich Restcent-Reihenfolge. Stockeinzahlungen/-überträge/-rückgaben sind keine gespielten Runden; Stockanteile bei Auszahlungen zählen nicht in die Spielkurven. Zahlungen beeinflussen die Kurven nicht. Eine spätere Korrektur ersetzt denselben Eintrag und aktualisiert die Auswertung.

Solo-Familien speichern die alleinige Partei statt einer gesonderten Ansager-ID: Bei eindeutigem 1-gegen-3-Ergebnis wird dieser Spieler in der Statistik als Ansager erkannt, auch bei verlorenen Solos. Sauspiel-Partner oder Kartenfarben werden niemals aus Gewinnern oder Namen geraten. Fehlende Bonusdaten sind unbekannt, nicht null. Re ist eine Teilmenge der Kontra-Runden; keine persönliche Kontra-Ansagerquote ohne gespeicherten Ansager.

Aktive Runden öffnen direkt den vorhandenen Editor, abgeschlossene Runden eine ausgewählte Leseansicht in der Abrechnung. Ältere Spieltage öffnen ihre bestehende Detailansicht. Archivierte Tische bleiben abgeschlossen.

## Prüfung

33 Testsuiten / 260 Tests bestanden. Zusätzlich gezielte Tests nach textlichen Layoutanpassungen. Neue Abdeckung: Partnerschaften in umgekehrter Ansagerreihenfolge, verlorene Teams, Ausschluss der Gegenpartei, Stockausschluss, Restcent-Verteilung, unbekannte Daten, Solo-Ansager, Kontozuordnung, Rundensequenz trotz abweichender Zeitstempel, Führungswechsel, drei UI-Modi und Navigation aktiver / archivierter Einzelspiele. TypeScript und scoped ESLint geprüft.

Browserprüfung mit einem ausschließlich lokalen Gast-Prüftisch auf eigener Vorschau-Origin: Eichelrufspiel mit Simon/Flo und Grassolo von Berkay mit Kontra/Re. Gesamt-, Spieler- und Tischansicht; Trend-Rundenauswahl öffnete die richtige Konfiguration. Mobile Darstellung bei 393 und 320 Pixeln geprüft. Kein iPhone-Gerätetest und keine Cloud-Datenänderung.

Screenshots: test-results/statistics-overview-393.png und test-results/statistics-table-trend-393.png.
