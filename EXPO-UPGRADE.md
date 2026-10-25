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
