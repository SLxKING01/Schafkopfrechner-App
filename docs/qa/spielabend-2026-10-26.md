# Prüfung eines vollständigen Spielabends – 26.10.2026

## Umgebung und Grenzen

Bedienbarer Test auf der lokalen Expo-Web-App unter http://localhost:8082, ohne Anmeldung. Es wurden ausschließlich eigens angelegte Testtische verwendet. Kein echtes Geld transferiert, keine Cloud-Kontodaten verwendet. Browser-Neuladen prüft Wiederherstellung aus dem tatsächlichen lokalen Browser-Speicher. Es ersetzt keinen Test auf iOS mit SecureStore, nativer Tastatur und nativen Gesten.

Auf diesem Windows-Rechner steht kein steuerbares iPhone oder iOS-Simulator zur Verfügung. Der physische Gerätetest ist daher offen. Die Parameter „ios“ in Komponententests simulieren Plattformverzweigungen und sind kein Gerätetest.

## Durchgeführter Ablauf

| Schritt | Ergebnis / Nachweis |
| --- | --- |
| Ohne Account spielen | Öffnet nach Korrektur die aktuelle Oberfläche statt des alten Spiele-Tabs. |
| Tisch erstellen | „Ablauftest 26.10.2026“ mit vier Spielern; Standardtarife und automatisch datierter Name sichtbar. |
| Zwei Leger + Turbo Ramsch | Gesamtfaktor 8x. |
| Browser vollständig neu laden | Beide Leger, Turbo und Faktor 8x bleiben erhalten. Wiedereinstieg erfolgt über „Ohne Account spielen“. |
| Sitzreihenfolge ändern | Simon bleibt Geber; nach Tauschen von Berkay/Flo ist Flo der nächste Geber. Geprüft über die Reihenfolge-Schaltflächen; native Zieh-Geste nicht geprüft. |
| Runde erfassen | Eingabe 0,30 €, Faktor 8, Simon gewinnt gegen Flo/Berkay. Ergebnis +2,40 €, −1,20 €, −1,20 €, 0,00 €. |
| Speichern | Leger zurück auf 1x je Spieler, Turbo bleibt an; Flo wird Geber. |
| Tisch verlassen/öffnen | Tisch bleibt in Spielen sichtbar, Spielstände unverändert. |
| Abschließen | Zwei Zahlungen von jeweils 1,20 €, vollständiger Verlauf und Endstände. |
| Eine Zahlung markieren und neu laden | Archiv bleibt sichtbar; genau eine Zahlung bezahlt und eine offen. |
| Neuer Tisch / Dezimaleingabe | „Eingabetest Web“: 0,70 € eingeben, Fokus wechseln, speichern; +0,70 €/−0,70 €, keine neuen Konsolenfehler im erneuten Eingabetest. |

Screenshot nach Wiederherstellung des Archivs: [spielabend-archiv-web.png](../../test-results/spielabend-archiv-web.png).

## Dabei behoben

- Gastzugang führte noch in die alte Oberfläche.
- Leger lagen ausschließlich im lokalen Bildschirmzustand. Sie sind jetzt Teil des gespeicherten Tischs, überstehen erneutes Öffnen und werden mit einer gültigen Runde atomar zurückgesetzt.
- Der Inhalt des Rundendialogs war im Accessibility-Baum durch die Regler-Rolle der gesamten Fläche verborgen. Bedienelemente sind jetzt einzeln zugänglich.
- BottomSheetTextInput nutzte beim Fokusverlust eine unter React Native Web nicht verfügbare native Fokus-API. Die Web-Rundeneingabe verwendet jetzt TextInput; native Plattformen behalten BottomSheetTextInput.
- Native Accessibility-Attribute des dekorativen Kartensymbols wurden an SVG-DOM-Elemente weitergegeben. Web verwendet jetzt aria-hidden.

## Vor Veröffentlichung noch offen

- Echte iPhone-Prüfung: Tastatur verdeckt keine Aktionen, Scrollen mit kleinem Display, längere Namen, größere Schrift, Long-Press/Drag, App beenden/neustarten, Flugmodus während eines Spielabends, späterer Wiederverbindungsversuch.
- Live-Cloud-Synchronisierung mit zwei Testgeräten und einem ausdrücklich dafür vorgesehenen Testkonto. Netzwerkfehler/Konflikte werden automatisiert simuliert, in diesem Browserlauf erfolgte kein Cloud-Upload.
- Dashboard zeigt weiterhin Beispielkennzahlen, Beispielspiele und Beispielzahlungen. Diese dürfen vor einer Veröffentlichung nicht als echte Nutzerdaten erscheinen.
- Im modernen Rundendialog ist ein manueller Betrag voreingestellt; die vollständige Tarifberechnung sowie Partner-/Parteienmodell und Bearbeiten bestehender moderner Runden sind noch gesondert zu prüfen/umzusetzen.
- Konsolenwarnungen zu zyklischen Store-Imports und einer veralteten navigate-Aufrufform bestehen weiterhin. Der geprüfte Ablauf funktioniert; das ist keine Freigabe als produktionsreif.

Automatisierte Regressionen: vollständige Jest-Suite, TypeScript sowie ESLint für die in diesem Schritt geänderten Dateien. Konkrete abschließende Ergebnisse stehen in der begleitenden Chat-Antwort.
