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
