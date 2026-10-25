# Expo-Go-Upgrade (25.10.2026)

Basis: `master`, Merge-Commit `1b50bf69953c2d768ebdec45b88e38f818e8687b` (PR #1).
Arbeitsverzeichnis: `Schafkopfrechner-phone-test`, Branch `upgrade/expo-go-iphone`.
Das ursprüngliche Arbeitsverzeichnis und dessen Abhängigkeiten bleiben unverändert.
Der Test-Checkout hat eigene, aus dem Lockfile installierte Abhängigkeiten.

## SDK 54 → 55

- Expo 55.0.32, React Native 0.83.10, React 19.2.0.
- Expo CLI `expo install expo@^55.0.0 --fix` gleicht Laufzeit- und Testpakete ab.
- Reanimated 4.2.1, Worklets 0.7.4, Gesture Handler 2.30.1;
  Bottom Sheet 5.2.14 akzeptiert diese Versionen laut Peer-Abhängigkeiten.
- Node 24.15.0 ist laut SDK-55-Migrationshinweisen unterstützt.
- Expo Doctor: 18/18 erfolgreich. TypeScript und ESLint erfolgreich.
- Vollständige Testsuite: 45 Tests in 10 Suites erfolgreich.
- Jest muss dieselbe verschachtelte `expo-modules-core`-Installation wie Expo
  auflösen; die Konfiguration berücksichtigt auch die vom Preset verwendeten Unterpfade.
  Keine Laufzeitfunktionen werden dadurch gemockt oder deaktiviert.
- Die iPhone-Skripte verwenden den aktuellen Node statt eines fest verdrahteten
  Node 20 (SDK 58 unterstützt Node 20 nicht mehr).

## SDK 55 → 56

- Expo 56.0.24, React Native 0.85.3, React 19.2.3, TypeScript 6.0.3;
  installiert über `expo install expo@^56.0.0 --fix`.
- Reanimated 4.3.1, Worklets 0.8.3 und die von Expo vorgesehene Gestensteuerung.
- Entfernte React-Native-Konstante `absoluteFillObject` durch `absoluteFill`
  ersetzt; identische absolute Positionierung ohne Änderung der Bildschirmstruktur.
- Entfernte `splash`-Konfiguration auf `expo-splash-screen` übertragen;
  Bild, Hintergrundfarbe und Skalierungsmodus bleiben erhalten.
- Shared Values verwenden Reanimateds `set()`-API statt einer Zuweisung an
  `.value`. Formularauswahl und ungültige Spieltypen werden mit bewachten
  Zustandsanpassungen vor dem Rendern übernommen statt in nachgelagerten Effekten.
  Die strengeren React-Hooks-Lint-Regeln bleiben aktiviert.
- Expo Doctor 18/18, TypeScript, ESLint und alle 45 Tests erfolgreich.
- SDK 56 ist nur ein Zwischenschritt; die bekannte Hermes-/Worklets-Regression
  wird mit dem folgenden SDK-57-Schritt vermieden.

## SDK 56 → 57

- Expo 57.0.31, React Native 0.86.3, Reanimated 4.5.1, Worklets 0.10.1.
- Das Jest-Preset muss genau zur React-Native-Version passen. Die alte optionale
  Peer-Abhängigkeit verursachte ERESOLVE; `@react-native/jest-preset@0.86.3`
  wurde explizit als Testabhängigkeit zusammen mit `jest-expo@~57.0.6` ausgerichtet.
  Keine Installation mit `--force` oder `--legacy-peer-deps`.
- Aktueller Expo Doctor: 21/21 erfolgreich. TypeScript, ESLint und alle 45 Tests erfolgreich.

## SDK 57 → 58 (finaler Stand)

- Expo **58.0.19**, React Native **0.88.0**, React **19.3.0**, Node **24.15.0**.
- Expo CLI `expo install expo@^58.0.0` und `expo install --fix` richten die
  Abhängigkeiten aus. Vor dem Abgleich wurden Jest-Preset, jest-expo und
  ESLint-Konfiguration gemeinsam anhand der SDK-Metadaten angehoben, damit
  kein veralteter optionaler Peer die Auflösung blockiert.
- Reanimated 4.7.1, Worklets 0.13.0, Gesture Handler 3.3.0, Screens 4.30.0,
  Safe Area Context 5.10.1; Bottom Sheet bleibt bei 5.2.14. `npm ls` bestätigt
  einen gemeinsamen, gültigen Animations-/Gesten-Abhängigkeitsbaum.
- Jest 30.5.2 und passendes React-Native-Preset 0.88.0.
- Aktueller Expo Doctor **20/20** erfolgreich; TypeScript und ESLint erfolgreich.
- Vollständige Testsuite: **45/45 Tests**, 10 Suites.
- Web-Export nach `dist/sdk58-web` und natives iOS-/Hermes-Bundle nach
  `.expo/sdk58-ios` erfolgreich (lokale Exporte, keine EAS-Builds).
- Zusätzlich Browserprüfung am fertigen Web-Export in isoliertem Edge-Profil:
  acht Spieler, Rufspiel mit zwei Gewinnern erfassen und bearbeiten,
  Löschschutz, Abschluss und Historie, Breiten 360/390/430. Keine Page-Errors.
  Verwendet wurde der Offline-Teil des vorhandenen Acceptance-Skripts;
  Screenshots liegen lokal unter `.expo/upgrade-offline`.
- Keine Änderungen an `src/store`, `src/storage`, `src/models` oder `src/utils`
  gegenüber dem gemergten Ausgangsstand. AsyncStorage bleibt bei 2.2.0.

## Expo Go öffnen und Server bedienen

Arbeitsverzeichnis: `C:\Users\simon\Codeing\Schafkopfrechner-phone-test`.

```powershell
npm run start:iphone -- --port 8081 --max-workers 2
# Wenn der LAN-Zugriff scheitert oder die WLAN-Adresse wechselt:
npm run start:iphone:tunnel -- --port 8081 --max-workers 2
```

Das Tunnel-Skript benutzt bewusst `--tunnel ngrok`, weil der neue Standardtunnel
in SDK 58 eine Expo-Anmeldung verlangt. Es nutzt die bereits vorhandene freie
ngrok-Anbindung; keine Firewalländerung, kein bezahlter Dienst.

Aktuell läuft Metro im Expo-Go-Modus mit geleertem Cache auf Port 8081,
ohne interaktives Terminal. Damit führt die anonyme Manifest-Anfrage nicht
erneut zu einer wartenden Login-Auswahl. Beim manuellen interaktiven Start
gegebenenfalls **Proceed anonymously** auswählen.

Der alte SDK-55-Log zeigte eine nicht beantwortete Login-/Anonym-Auswahl und
einen Timeout. Die vom iPhone gemeldete allgemeine Fehlermeldung allein
bewies daher keinen SDK-Mismatch. SDK 58 ist das vom Nutzer gewünschte Ziel,
abgeglichen mit der offiziellen SDK-58-/Expo-Go-Dokumentation; ein erfolgreicher
Start auf dem physischen Gerät ist noch nicht bestätigt.

- Direkter iPhone-Link in Safari:
  `https://qlhan1k-anonymous-8081.exp.direct/_expo/link?platform=ios&choice=expo-go`
- Expo-Verbindung: `exps://qlhan1k-anonymous-8081.exp.direct`
- QR-Code: `.expo/phone-qr.png`
- Tunnel und iOS-Manifest antworten mit SDK 58.0.0; die Linkroute leitet direkt
  zu Expo Go weiter. Nach einem Neustart die dann angezeigte Adresse verwenden.
- Stoppen bei eigenem Terminalstart mit **Strg+C**. Der hier verwaltete Server
  kann im Chat gestoppt werden. Danach im obigen Verzeichnis neu starten.

## Noch erforderliche iPhone-Abnahme

1. Link in Safari antippen, „In Expo Go öffnen“ bestätigen, bei einer Warnung
   zum anonymen Entwicklungsprojekt nur dieses eigene Projekt fortsetzen.
2. Zunächst **Ohne Account spielen** wählen und eigene Testspieler anlegen.
3. Ein Rufspiel mit zwei Gewinnern erfassen. Bei geöffneter Tastatur alle
   Eingaben und „Speichern“ erreichen und die Cent-Anteile prüfen.
4. Systemschrift vergrößern und Eingabe/Abschluss erneut bedienen.
5. App in den Hintergrund bringen, zurückkehren und den Spielstand kontrollieren.
6. Expo Go vollständig schließen und über denselben Projektlink erneut öffnen;
   gespeicherte Spiele und Historie kontrollieren.

Diese Schritte benötigen das physische iPhone und die Interaktion des Nutzers.
Browserprüfung, Hermes-Bundle und Doctor ersetzen diese Abnahme nicht.

## Schutz der Daten und Grenzen

Keine Änderung an Speicherformaten, Storage-Schlüsseln, Berechnungen, Archiven
oder Spielregeln. Keine Produktionszugänge aus dem ursprünglichen Checkout
übernommen. Für lokale Tests „Ohne Account spielen“ verwenden.
Kein Merge, Deployment, EAS-Build oder produktiver Datenzugriff.

Ein erreichbares Metro-Manifest und erfolgreiche Tests belegen keinen erfolgreichen
Start auf dem physischen iPhone. Die tatsächliche Expo-Go-Kompatibilitätsmeldung
und die native Abnahme erfordern die Interaktion des Nutzers.

## Quellen

- https://docs.expo.dev/versions/v55.0.0/
- https://expo.dev/changelog/sdk-55
- https://expo.dev/changelog/sdk-56
- https://expo.dev/changelog/sdk-57
- https://expo.dev/changelog/sdk-58
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
