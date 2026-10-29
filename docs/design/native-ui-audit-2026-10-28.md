# Native-UI-Prüfung – 28.10.2026

Die Skill `expo-native-ui` wurde auf Anmeldung, Rundeneingabe, gemeinsame Sheet-Komponente und Tischübersicht angewendet. Grundlage bleiben das bestätigte Grün/Gold-Design und die bestehende Navigation. Die laut AGENTS.md vorgeschriebene Expo-v55-Dokumentation einschließlich Expo UI wurde gelesen. Die installierten Expo-Abhängigkeiten wurden nicht geändert.

## Umgesetzt

| Befund                                                   | Änderung                                                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enge Spielerzeilen bei großen Systemschriften            | Ab Font-Skalierung 1,3 oder unter 360 Punkten Breite stehen die Ergebnis-Schalter in einer eigenen Zeile. Spielernamen können dort vollständig umbrechen. Die Schriftvergrößerung wird nicht begrenzt. |
| Einheitliche 44-Punkt-Touchgröße auf allen Plattformen   | Gemeinsame Mindestgröße jetzt 44 Punkte auf iOS/Web und 48 auf Android. Android-Zähler bekommen entsprechend mehr Platz. Der Einstellungs-Knopf nutzt die gemeinsame Größe.                            |
| Seitliche Safe-Area-Ränder im Sheet nicht berücksichtigt | Container berücksichtigt zusätzlich linke/rechte Insets, etwa für Aussparungen im Querformat. Vorhandene obere/untere Insets bleiben erhalten.                                                         |
| Dekorative Kartensymbole im Accessibility-Baum           | Hintergrundmuster sind mit aria-hidden ausgeblendet. Überschriften in Einstieg, Anmeldung und Rundeneingabe sind als Überschriften ausgezeichnet.                                                      |
| Unbeschrifteter Passwort-Schalter                        | Wechselnde Namen „Passwort anzeigen“ / „Passwort verbergen“, ausgewählter Zustand, Pressed-Rückmeldung und ausreichend große Touchfläche.                                                              |
| Standard-Eingaben ohne explizite zugängliche Namen       | AuthInput verwendet den übergebenen Accessibility-Namen oder den Platzhalter. Layout-/Textstil-Overrides werden weitergereicht. „Angemeldet bleiben“ ist benannt.                                      |
| Fehlermeldungen/Beträge schwer kopierbar                 | Login-Fehler, Speichermeldungen und der Rundentarif sind auswählbar; Fehler bekommen eine Alert-Rolle.                                                                                                 |
| Numerische Betragseingabe ohne explizite Abschlussaktion | Done-Rückgabetaste und Tastatur-Dismiss bei Submit. Vorhandenes BottomSheet-TextInput und Keyboard-Verhalten bleiben im Einsatz.                                                                       |
| Namensflächen ohne Aktion als Buttons angekündigt        | Außerhalb der Alleinspieler-Auswahl werden diese Flächen nicht als interaktive Screenreader-Ziele angeboten. Klopfmünzen bleiben unabhängig bedienbare Buttons.                                        |
| Einstellungs-Symbol öffnete nur einen Platzhalter-Alert  | Bei aktivem Tisch öffnet es die tatsächlichen Tischregeln, sonst Profil/Einstellungen.                                                                                                                 |
| Symbolaktion unbeschriftet/irreführend                   | Zusätzliche zugängliche Namen; die Aktion zum Weiterführen eines aktiven Tisches zeigt einen Weiter-Pfeil.                                                                                             |

## Komponentenbasis

Die vorhandenen React-Native-Schalter und das bestehende BottomSheet bleiben die Komponentenbasis. Die Aufgabe führte zu gezielten Bedien- und Accessibility-Verbesserungen. Ein vollständiger Austausch von Navigation und Steuerelementen gegen SwiftUI-/Compose-Komponenten ist eine gesonderte Migration mit eigener Geräteprüfung.

## Verifikation

- Gesamtsuite: **31 Suites / 240 Tests erfolgreich**. Neue Regressionen prüfen Passwort anzeigen/verbergen ohne Datenänderung, lange Namen bei Font-Skalierung 2, unabhängiges Klopfen und Speichern, seitliche Insets sowie echte Einstellungs-Navigation mit und ohne aktiven Tisch.
- Bestehende Tests für Speicherfehler und erneutes Speichern ohne Doppeleintrag sind weiterhin erfolgreich.
- TypeScript und ESLint der geänderten Dateien erfolgreich.
- Lokaler Browser: Namen/Überschriften im Accessibility-Baum kontrolliert. Passwort-Sichtbarkeit mit lokalem Testtext geprüft und Testtext anschließend entfernt; keine Anmeldung abgesendet.
- Rundeneingabe bei **393 × 852** und **320 × 740**: auf 320 funktioniert der zweizeilige Spieleraufbau. Klopfmünzen, Ergebniswahl, Kartenfarben, Kontra/Re und Speicheraktion sind erreichbar. Optionen bleiben scrollbar; der Speicherknopf bleibt sichtbar.
- Entwurf anschließend verworfen; keine neue Runde gespeichert. Der Einstellungs-Knopf wurde bis zum Bildschirm „Regeln & Tarife“ geprüft, ohne Tischpreise zu ändern.

## Grenzen der Prüfung

Die Browserprüfung ist kein iPhone-/Android-Gerätetest. Echte VoiceOver-/TalkBack-Ausgabe, native Tastatur inklusive Dezimal-Pad, Hardware-Zurück, native Gesten und Safe-Area-Verhalten im Querformat sind noch auf Geräten zu prüfen. Die Font-Skalierung wurde im Komponententest simuliert; der schmale Layout-Zweig wurde zusätzlich im Browser visuell geprüft.

## Nachweise

- [Standardansicht 393](../../test-results/native-ui-round-entry-393.png)
- [Zweizeilige Spieleransicht 320](../../test-results/native-ui-round-entry-320.png)
- [Optionen und Speicheraktion 320](../../test-results/native-ui-options-320.png)
