# Spieleingabe mit Kartenfarben – 27.10.2026

- Rundeneingabe als volle Ansicht mit Tarif pro Spieler, individuellen Gewinnen/Verlusten und dauerhaft erreichbarer Speicheraktion.
- Eichel, Gras, Herz und Schellen als skalierbare Kartensymbole vor Gelegt; Auswahl durch erneutes Antippen aufhebbar.
- Die optionale Farbe wird getrennt von der tarifbestimmenden Spielart gespeichert. Wenz + Herz erscheint als Herzwenz. Auswahl verändert keine Tischpreise oder erlaubten Boni.
- Farbe bleibt in lokaler Speicherung, Korrektur und Verlaufsanzeige erhalten. Beim Spielartwechsel wird sie zurückgesetzt. Bestehende Runden ohne Farbe bleiben gültig.
- Gelegt zeigt den bestehenden Tischkontext; Leger werden weiterhin am Tisch gesetzt.
- Kontra und Re bedienen weiterhin den bestehenden gemeinsamen Stoßfaktor.

## Verifiziert

Lokale Expo-Web-App auf Port 8081, Gastmodus, eigener Testtisch mit vier Spielern. Wenz und Stoß aktiviert. Flo als Alleinspieler mit Herz gespeichert: Tarif 0,50 €, Flo +1,50 €, Simon/Berkay/Alessandro je −0,50 €. Verlauf zeigt Herzwenz; erneutes Öffnen zur Korrektur zeigt wieder die gewählte Farbe. Mobile Sichtprüfung bei 393 × 852. Keine Cloud-Anmeldung.

Screenshot: [Spieleingabe](../../test-results/round-entry-suits-393.png).

Gesamtsuite: 28 Suites / 209 Tests erfolgreich. Anschließend ergänzter Kontra/Re-Regressionstest zusammen mit allen acht Eingabetests erfolgreich. TypeScript und ESLint für die geänderten Dateien geprüft. Tests decken Farbauswahl, Abwahl, Spielartwechsel, gespeicherte Farbe und Korrektur ab.

Native iPhone-Gesten und Darstellung auf einem echten Gerät sind nicht geprüft.

## Nachbesserung Kontra / Re

Kontra/Re sind bei neuen Tischen standardmäßig aktiviert. Bei bestehenden Tischen mit deaktiviertem Stoß bleiben die Bedienelemente für neue Runden sichtbar; ihre erste Verwendung aktiviert die Tischregel. Historische Tarif-Snapshots bleiben erhalten. Kontra verdoppelt den gesamten Spielwert einschließlich Preisboni, Re zählt mit Minus/Plus von 0 bis 3 und verdoppelt mit jeder Stufe erneut (zusammen ×2 / ×4 / ×8 / ×16). Gesamtsuite nach der Änderung: 28 Suites / 215 Tests erfolgreich, einschließlich Aktivierung bei einem bestehenden Tisch und Auf-/Abzählen von Re.

## Einheitliche Gestaltung mit dem Dashboard

Die Rundeneingabe verwendet direkt `AuthBackground`, einschließlich Grünverlauf, Vignette und zurückhaltenden Kartensymbolen. Die sicheren Bildschirmränder übernimmt hier das vorhandene InteractionSheet. Spieler, Farbauswahl und Optionen haben transparente Flächen und Konturen aus den gemeinsamen Farbtokens. Zahlen sind ausgerichtet; Zähler verwenden zusammenhängende Minus/Plus-Regler. Im Web verwendet die Eingabe einen normalen ScrollView ohne störenden sichtbaren Scrollbalken; native Plattformen behalten BottomSheetScrollView.

Mobile Browserprüfung bei 393 × 852: Spielerbeträge, Farbauswahl, vollständiger Optionsbereich inklusive Kontra/Re und feststehende Speicheraktion erreichbar. Keine neue Runde für diese reine Sichtprüfung gespeichert. Zwölf gezielte Regressionstests für Rundeneingabe, Sheet und Dashboard sowie TypeScript und ESLint erfolgreich.

- [Spieler und Farben](../../test-results/round-entry-dashboard-background-393.png)
- [Optionen mit Kontra und Re](../../test-results/round-entry-dashboard-options-393.png)

## Nachträglich klopfen über Spielermünzen

Initialen in der Rundeneingabe sind durch die gemeinsam mit dem Spieltisch verwendete Münzkomponente ersetzt. Münze und Namensauswahl sind separate Schaltflächen. Grau 1× bedeutet nicht geklopft, Gold 2× bedeutet geklopft; erneutes Antippen nimmt das Klopfen zurück. Bei neuen Runden werden die vorhandenen Tisch-Leger verwendet. Der Tarif reagiert sofort auf deren Änderung.

Bei Korrekturen moderner Runden werden die Spieler-IDs der Klopfer explizit an die Korrektur übergeben, validiert und im Rundenkontext aktualisiert. Die bestehenden Tarife der Runde gelten weiterhin, ihre Salden werden neu berechnet. Geber und bereits gesetzte Klopfer der nächsten Runde bleiben unberührt. Historische manuelle Runden ohne Tarif-/Rundenkontext erlauben diese automatische Tarifänderung nicht.

Gesamtsuite: 28 Suites / 220 Tests erfolgreich; TypeScript und ESLint erfolgreich. Tests prüfen Rücknahme, Speicherung, korrigierte Salden, erneutes Öffnen und ungültige Spieler-IDs. Mobile Webprüfung bei 393 × 852: Münze Simon verdoppelt Wenz von 0,50 € auf 1,00 €, Flo +3,00 € und drei Gegner je −1,00 €. Testklopfen anschließend zurückgenommen; keine weitere Browserrunde gespeichert.

[Münzen in der Eingabe](../../test-results/round-entry-knocking-coins-393.png).
