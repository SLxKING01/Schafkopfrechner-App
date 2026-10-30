# Statistik-Konzept – Beispieldaten

## Datengrundlage

40 erfundene Runden, vier Abende mit je zehn Runden und denselben vier Spielern: Simon, Flo, Alessandro und Berkay. 20 Rufspiele, acht Solos, acht Wenz, vier Ramsch. Keine Stockbuchungen und keine Zahlungen. Alle Beträge werden intern in Cent gerechnet. Jede Runde und die Gesamtbilanz sind nullsummig. Die Daten sind illustrativ und keine echten Nutzerdaten; die kleinen Stichproben erlauben keine belastbare Bewertung der Spielstärke.

Tarif je Gegner bei Solo/Wenz: 0,50 €; Rufspiel je Person: 0,20 €; Ramsch je Gewinner: 0,20 €. Leger und jede Stoßstufe verdoppeln den jeweiligen Wert. stoss=1 bedeutet Kontra, stoss=2 Kontra plus eine Re-Stufe. In diesen Beispielen werden keine weiteren Zuschläge verwendet.

## KPIs für Simon

| KPI | Rechnung | Ergebnis | Vorteil | Grenze |
|---|---|---|---|---|
| Spielbilanz | Summe aller individuellen Rundenergebnisse | -11,30 € | Zeigt das tatsächliche Spielergebnis | Hängt stark von Tarifen und wenigen teuren Runden ab; kein reines Könnenmaß |
| Gewinnquote | 19 / 40 | 47,5 % | Leicht verständlicher Erfolgsüberblick | Partner, Gegenpartei und Spielarten haben unterschiedliche Rollen; keine pauschale 50-%-Sollmarke |
| Selbst angesagt gewonnen | 5 / 7 | 71,4 % | Trennt eigene Ansagen vom Mitspielen | Kleine Stichprobe, Kartenverteilung und Ansageauswahl beeinflussen die Quote; diese sieben Runden ergeben trotzdem -3,70 € |
| Durchschnitt je Runde | -11,30 € / 40 | -0,2825 €, angezeigt -0,28 € | Vergleicht verschieden lange Abende besser als Summen | Unterschiedliche Tarife machen Spieler- oder Tischvergleiche unfair |
| Positive Abende | 1 / 4 | 25 % | Zeigt, wie häufig ein Abend positiv endete | Abende haben unterschiedliche Länge; Ergebnis sagt nichts über Schwankungen innerhalb eines Abends |
| Runden mit Leger | 10 / 40 | 25 % | Zeigt Häufigkeit erhöhter Spielwerte | Keine persönliche Klopfquote ohne Spielerzuordnung; keine Empfehlung zum Klopfen |
| Runden mit Kontra / davon mit Re | 6 / 40; 3 / 6 | 15 %; 50 % | Macht hohe Multiplikatoren sichtbar | Nicht bekannt, wer Kontra/Re angesagt hat; kein kausaler Erfolgsvergleich |
| Extremwerte | Maximum / Minimum des individuellen Rundenergebnisses | +1,60 € / -6,00 € | Erklärt den Einfluss einzelner Runden | Spektakuläre Ausreißer sind keine verlässliche Spielstärkemessung |

## Spielarten

| Spielart | Beteiligte Runden | Siege | Quote | Spielbilanz |
|---|---:|---:|---:|---:|
| Rufspiel | 20 | 12 | 60 % | +2,80 € |
| Solo | 8 | 2 | 25 % | -5,00 € |
| Wenz | 8 | 2 | 25 % | -8,50 € |
| Ramsch | 4 | 3 | 75 % | -0,60 € |

Diese Zahlen zählen alle beteiligten Runden, einschließlich Gegenpartei, nicht nur selbst angesagte Spiele. Bei Ramsch bedeutet Sieg hier eine Runde mit positivem Rundenergebnis. Eine weitere Filtermöglichkeit nach Ansager / Partner / Gegenpartei wäre sinnvoll. Vorteil: konkrete Muster je Spielart. Grenze: sehr kleine Teilmengen und unterschiedliche Tarif-/Multiplikatorprofile. Keine Behauptung, dass Simon deshalb schlecht Wenz spielt.

## Verlauf

| Abend | Abendbilanz | Kumulierte Spielbilanz |
|---|---:|---:|
| 1 | +0,40 € | +0,40 € |
| 2 | -6,10 € | -5,70 € |
| 3 | -4,50 € | -10,20 € |
| 4 | -1,10 € | -11,30 € |

Kontra-Runden tragen -9,40 € zur Bilanz bei; übrige Runden -1,90 €. Das beschreibt diese Stichprobe, nicht die Wirkung einer Kontra-Entscheidung.

## Gestaltung und Datenregeln

Persönliche Übersicht mit Spielerauswahl, Zeitraum, Rundenzahl, Spielbilanz, Gewinnquote, eigener Ansagequote und kumuliertem Verlauf. Details unter Spielarten: kompakte Tabelle, Leger-/Stoß-Häufigkeit, Extremwerte. Kein unklarer Gesamtscore und keine Rangliste als vermeintliches Können-Ranking. Offene Zahlungen bleiben bei Abrechnung.

Nur gespielte Runden zählen: Stockeinzahlungen, Überträge und Zahlungen separat behandeln. Bei Stockauszahlung reinen Spielgewinn und Stockanteil trennen. Korrekturen ersetzen das vorherige Ergebnis. Archive und aktive Tische deduplizieren. Gleiche Namen verschiedener lokaler Spieler nicht ungeprüft zusammenführen. Jede Quote erhält Zähler und Nenner. Fehlende historische Bonus-/Ansagerdaten bedeuten unbekannt, nicht null; Detailquoten brauchen die Zahl auswertbarer Runden und Datenabdeckung. Die aktuelle App speichert Stoßstufen, aber nicht deren Ansager. Keine Zeit-KPIs: Erfassungszeit ist nicht gleich Spieldauer.

Mockup ist ein Entwurf, keine Umsetzung der App. Erstellung mit dem integrierten imagegen-Tool, bestehender Dashboard-Screenshot als Stilreferenz. Exakte Eingabe- und Auswertungsdaten in example-data.json und beispielrunden.csv.
