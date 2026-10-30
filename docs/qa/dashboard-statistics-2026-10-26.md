# Dashboard und Statistik – Datenprüfung am 26.10.2026

## Umsetzung

Beide Ansichten nutzen denselben abgeleiteten Überblick über aktive Tische, archivierte Spielabende und ältere lokale Spiele. Ein abgeschlossener Tisch wird anhand seiner ID genau einmal gezählt; die archivierte Kopie liefert den aktuellen Zahlungsstatus.

- Rundenanzahl zählt gespeicherte Runden, nicht Spielereinträge.
- „Heute gespielt“ verwendet den lokalen Kalendertag und aktualisiert sich bei Tageswechsel bzw. Rückkehr in die App.
- „Spielwerte gesamt“ ist die Summe eingetragener Gesamtgewinne der Gewinner, kein Gewinn einer angenommenen Benutzeridentität und kein Zahlungsumsatz. Aggregation erfolgt centgenau, auch über mehrere große Abrechnungen hinweg.
- „Zahlungen offen“ enthält ausschließlich unbezahlte Forderungen abgeschlossener moderner Tische. Laufende Salden sind vorläufig. Ältere Offline-Spiele enthalten keinen Zahlungsstatus und erzeugen deshalb keine erfundenen offenen Forderungen.
- Spielerbilanzen verwenden dieselbe Cent-Verteilung wie die jeweilige Abrechnung. Gewinnraten beziehen sich auf gewonnene / tatsächlich beteiligte Runden; Zuschauer zählen nicht mit. Personen mit gleichen Namen verschiedener Tische werden nicht zusammengelegt.
- Neue Installation: echte Nullwerte und Leerzustände; kein angenommener Benutzername „Simon“, keine Beispielspiele, Beispielgewinne oder PayPal-Funktion.
- Direkte Navigation: aktiver Tisch, exakter archivierter Abend oder älterer lokaler Spieltag. Die Statistik lädt längere Listen schrittweise nach.

## Nachweise

Browserprüfung mit den bereits für den vorherigen Test angelegten lokalen Testtischen:

| Ansicht | Erwartet und sichtbar |
| --- | --- |
| Dashboard | 2 Runden, 2 heute, 1 abgeschlossener Tisch, 1,20 € offene Zahlung |
| Statistik | 2 Runden, Spielwerte 2,40 € + 0,70 € = 3,10 €, häufigster Spieltyp Rufspiel |
| Spielerbilanzen | Eingabetest: Simon +0,70 €, Berkay −0,70 €. Archivabend: Simon +2,40 €, Flo/Berkay je −1,20 €. |
| Rundendetail öffnen | Die archivierte Runde öffnet „Ablauftest 26.10.2026“ mit der dazugehörigen Abrechnung und dem gespeicherten Teilzahlungsstatus. |

Bilder: [Dashboard](../../test-results/dashboard-real-data.png), [Statistik](../../test-results/statistics-real-data.png).

Automatisierte Tests prüfen zusätzlich Nullzustände, doppelte aktuelle/archivierte Kopien, Teilzahlungen, Restcent, Tagesgrenzen, ältere lokale Runden, getrennte gleichnamige Spieler und die Navigation. Der Komponententest bestätigt, dass eine als bezahlt markierte Forderung ohne Neuladen aus dem Dashboard verschwindet.

Keine Datenbankmigration, kein Cloud-Upload und keine Veränderung der vorhandenen Spielhistorie erforderlich. Die Darstellung verwendet bereits lokal gespeicherte bzw. regulär synchronisierte Daten.

Die native iPhone-Prüfung bleibt offen. Browser und React-Native-Komponententests ersetzen keinen Gerätetest mit größerer Schrift, kleinen Displays und nativen Gesten.
